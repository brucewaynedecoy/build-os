package entities

import (
	"encoding/json"
	"errors"
	"sort"
	"unicode/utf8"
)

const (
	PersonaIdentitySchemeV1 = "persona-v1"

	PersonaOutcomeMatched = "matched"
	PersonaOutcomeReview  = "review"

	PersonaBasisExactID       = "exact_id"
	PersonaBasisApprovedAlias = "approved_alias"
)

type PersonaCandidate struct {
	Type     string                    `json:"type"`
	ID       string                    `json:"id,omitempty"`
	Alias    string                    `json:"alias,omitempty"`
	Identity *PersonaCandidateIdentity `json:"identity,omitempty"`
}

type PersonaCandidateIdentity struct {
	Scheme string `json:"scheme"`
	Phrase string `json:"phrase"`
}

type PersonaMatchResult struct {
	Outcome      string   `json:"outcome"`
	Basis        string   `json:"basis,omitempty"`
	CanonicalID  string   `json:"canonical_id,omitempty"`
	Chain        []string `json:"chain,omitempty"`
	CandidateIDs []string `json:"candidate_ids,omitempty"`
	Reason       string   `json:"reason,omitempty"`
	Mutated      bool     `json:"mutated"`
}

// NormalizePersonaV1 performs only the byte-preserving normalization allowed
// by persona-v1: ASCII whitespace trim/collapse and ASCII lowercase.
func NormalizePersonaV1(value string) (string, error) {
	if !utf8.ValidString(value) {
		return "", errors.New("persona identity input must be valid UTF-8")
	}
	result := make([]byte, 0, len(value))
	pendingSpace := false
	started := false
	for index := 0; index < len(value); index++ {
		current := value[index]
		if isASCIIWhitespace(current) {
			if started {
				pendingSpace = true
			}
			continue
		}
		if pendingSpace {
			result = append(result, ' ')
			pendingSpace = false
		}
		if current >= 'A' && current <= 'Z' {
			current += 'a' - 'A'
		}
		result = append(result, current)
		started = true
	}
	if len(result) == 0 {
		return "", errors.New("persona identity input must not be empty after normalization")
	}
	return string(result), nil
}

func isASCIIWhitespace(value byte) bool {
	switch value {
	case ' ', '\t', '\n', '\r', '\f', '\v':
		return true
	default:
		return false
	}
}

// MatchPersonaExact applies only the reviewed persona identity contract. It is
// read-only: every non-deterministic or invalid case returns a review result.
func MatchPersonaExact(graph *Graph, candidate PersonaCandidate) PersonaMatchResult {
	if graph == nil {
		return personaReview("invalid_graph", nil)
	}
	if candidate.Type != "persona" {
		return personaReview("unsupported_entity_type", nil)
	}
	if candidate.ID != "" {
		if !isPersonaID(candidate.ID) {
			return personaReview("invalid_persona_id", []string{candidate.ID})
		}
		record, ok := graph.Record(candidate.ID)
		if !ok || record.Type != "persona" {
			return personaReview("persona_not_found", []string{candidate.ID})
		}
		resolution, diagnostics := graph.Resolve(candidate.ID)
		if HasErrors(diagnostics) {
			return personaReview("invalid_or_inactive_terminal", []string{candidate.ID})
		}
		return PersonaMatchResult{Outcome: PersonaOutcomeMatched, Basis: PersonaBasisExactID, CanonicalID: resolution.CanonicalID, Chain: resolution.Chain, Mutated: false}
	}

	if candidate.Alias != "" {
		normalized, err := NormalizePersonaV1(candidate.Alias)
		if err != nil {
			return personaReview("invalid_alias", nil)
		}
		matches, invalidRows := matchingPersonaRows(graph, normalized)
		if len(invalidRows) > 0 {
			return personaReview("invalid_stored_aliases", append(matches, invalidRows...))
		}
		if len(matches) > 0 {
			return resolvePersonaMatches(graph, matches, PersonaBasisApprovedAlias, "ambiguous_alias")
		}
	}

	if candidate.Identity != nil {
		if candidate.Identity.Scheme != PersonaIdentitySchemeV1 {
			return personaReview("unsupported_identity_scheme", nil)
		}
		normalized, err := NormalizePersonaV1(candidate.Identity.Phrase)
		if err != nil {
			return personaReview("invalid_identity_phrase", nil)
		}
		matches, invalidRows, invalidReason := matchingIdentityRows(graph, normalized)
		if len(invalidRows) > 0 {
			return personaReview(invalidReason, append(matches, invalidRows...))
		}
		if len(matches) > 0 {
			return resolvePersonaMatches(graph, matches, PersonaIdentitySchemeV1, "persona_identity_collision")
		}
	}

	return personaReview("no_exact_match", nil)
}

func matchingPersonaRows(graph *Graph, wanted string) ([]string, []string) {
	var matches, invalidRows []string
	for _, record := range graph.Records() {
		if record.Type != "persona" {
			continue
		}
		raw, present := record.Raw["aliases"]
		if !present {
			continue
		}
		var aliases []string
		if !utf8.Valid(raw) || json.Unmarshal(raw, &aliases) != nil || aliases == nil {
			invalidRows = append(invalidRows, record.ID)
			continue
		}
		seen := make(map[string]struct{}, len(aliases))
		valid := true
		matched := false
		for _, alias := range aliases {
			normalized, err := NormalizePersonaV1(alias)
			if err != nil {
				valid = false
				continue
			}
			if _, duplicate := seen[normalized]; duplicate {
				valid = false
			}
			seen[normalized] = struct{}{}
			matched = matched || normalized == wanted
		}
		for index := 1; index < len(aliases); index++ {
			if aliases[index-1] >= aliases[index] {
				valid = false
			}
		}
		if !valid {
			invalidRows = append(invalidRows, record.ID)
			continue
		}
		if matched {
			matches = append(matches, record.ID)
		}
	}
	return matches, invalidRows
}

func matchingIdentityRows(graph *Graph, wanted string) ([]string, []string, string) {
	var matches, malformedRows, unsupportedRows, unnormalizedRows []string
	for _, record := range graph.Records() {
		if record.Type != "persona" {
			continue
		}
		raw, present := record.Raw["identity"]
		if !present {
			continue
		}
		var identity struct {
			Scheme *string `json:"scheme"`
			Key    *string `json:"key"`
		}
		if !utf8.Valid(raw) || json.Unmarshal(raw, &identity) != nil || identity.Scheme == nil || identity.Key == nil {
			malformedRows = append(malformedRows, record.ID)
			continue
		}
		if *identity.Scheme != PersonaIdentitySchemeV1 {
			unsupportedRows = append(unsupportedRows, record.ID)
			continue
		}
		normalized, err := NormalizePersonaV1(*identity.Key)
		if err != nil {
			malformedRows = append(malformedRows, record.ID)
			continue
		}
		if *identity.Key != normalized {
			unnormalizedRows = append(unnormalizedRows, record.ID)
			continue
		}
		if normalized == wanted {
			matches = append(matches, record.ID)
		}
	}
	if len(malformedRows) > 0 {
		return matches, malformedRows, "invalid_stored_identity"
	}
	if len(unsupportedRows) > 0 {
		return matches, unsupportedRows, "unsupported_stored_identity_scheme"
	}
	if len(unnormalizedRows) > 0 {
		return matches, unnormalizedRows, "persona_identity_key_not_normalized"
	}
	return matches, nil, ""
}

func resolvePersonaMatches(graph *Graph, matches []string, basis, ambiguousReason string) PersonaMatchResult {
	terminals := make(map[string]Resolution)
	for _, id := range matches {
		resolution, diagnostics := graph.Resolve(id)
		if HasErrors(diagnostics) {
			return personaReview("invalid_or_inactive_terminal", matches)
		}
		terminal, ok := graph.Record(resolution.CanonicalID)
		if !ok || terminal.Type != "persona" || terminal.Status != "active" {
			return personaReview("invalid_or_inactive_terminal", matches)
		}
		terminals[resolution.CanonicalID] = resolution
	}
	canonicalIDs := make([]string, 0, len(terminals))
	for id := range terminals {
		canonicalIDs = append(canonicalIDs, id)
	}
	sort.Strings(canonicalIDs)
	if len(canonicalIDs) != 1 {
		return personaReview(ambiguousReason, canonicalIDs)
	}
	return PersonaMatchResult{Outcome: PersonaOutcomeMatched, Basis: basis, CanonicalID: canonicalIDs[0], CandidateIDs: canonicalIDs, Mutated: false}
}

func personaReview(reason string, candidateIDs []string) PersonaMatchResult {
	seen := make(map[string]struct{}, len(candidateIDs))
	ids := make([]string, 0, len(candidateIDs))
	for _, id := range candidateIDs {
		if _, duplicate := seen[id]; duplicate {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return PersonaMatchResult{Outcome: PersonaOutcomeReview, Reason: reason, CandidateIDs: ids, Mutated: false}
}

func isPersonaID(value string) bool {
	if len(value) != len("PER-000") || value[:4] != "PER-" {
		return false
	}
	for _, digit := range value[4:] {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return true
}
