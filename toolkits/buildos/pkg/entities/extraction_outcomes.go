package entities

import "fmt"

const ExtractionOutcomesV1 = "extraction-outcomes-v1"

type ExtractionOutcomes struct {
	OutcomeContract string   `json:"outcome_contract"`
	Minted          []string `json:"minted"`
	Referenced      []string `json:"referenced"`
	Updated         []string `json:"updated"`
}

type ExtractionOutcomeIssue struct {
	Code     string `json:"code"`
	List     string `json:"list,omitempty"`
	EntityID string `json:"entity_id,omitempty"`
	Message  string `json:"message"`
}

// PlaybookResolver validates a PB-NNN against the authoritative playbook
// index and returns the current canonical playbook ID. Playbooks use a
// registered outcome prefix but are not stored in the eight entity JSONL
// datasets, so callers must provide this separate authority when PB outcomes
// are present.
type PlaybookResolver func(id string) (canonicalID string, err error)

// ValidateExtractionOutcomes verifies the extraction-outcomes-v1 list shape,
// disjointness, registered prefixes, and terminal-ID requirement.
func ValidateExtractionOutcomes(graph *Graph, outcomes ExtractionOutcomes) []ExtractionOutcomeIssue {
	return ValidateExtractionOutcomesWithPlaybooks(graph, outcomes, nil)
}

// ValidateExtractionOutcomesWithPlaybooks validates entity outcomes and uses
// playbooks for PB-NNN outcomes. A missing playbook resolver fails closed only
// when a PB outcome is actually present.
func ValidateExtractionOutcomesWithPlaybooks(graph *Graph, outcomes ExtractionOutcomes, playbooks PlaybookResolver) []ExtractionOutcomeIssue {
	var issues []ExtractionOutcomeIssue
	if outcomes.OutcomeContract != ExtractionOutcomesV1 {
		issues = append(issues, ExtractionOutcomeIssue{Code: "invalid_outcome_contract", Message: "outcome_contract must be extraction-outcomes-v1"})
	}
	lists := []struct {
		name string
		ids  []string
	}{{"minted", outcomes.Minted}, {"referenced", outcomes.Referenced}, {"updated", outcomes.Updated}}
	seen := make(map[string]string)
	for _, list := range lists {
		if list.ids == nil {
			issues = append(issues, ExtractionOutcomeIssue{Code: "missing_outcome_list", List: list.name, Message: fmt.Sprintf("%s must be present, even when empty", list.name)})
			continue
		}
		for _, id := range list.ids {
			if previous, exists := seen[id]; exists {
				issues = append(issues, ExtractionOutcomeIssue{Code: "duplicate_outcome_id", List: list.name, EntityID: id, Message: fmt.Sprintf("%s also occurs in %s", id, previous)})
				continue
			}
			seen[id] = list.name
			if !hasRegisteredEntityPrefix(id) {
				issues = append(issues, ExtractionOutcomeIssue{Code: "invalid_entity_id", List: list.name, EntityID: id, Message: fmt.Sprintf("%s does not use a registered entity prefix", id)})
				continue
			}
			if isPlaybookID(id) {
				if playbooks == nil {
					issues = append(issues, ExtractionOutcomeIssue{Code: "playbook_resolver_required", List: list.name, EntityID: id, Message: "PB outcomes require the authoritative playbook index resolver"})
					continue
				}
				canonicalID, err := playbooks(id)
				if err != nil || canonicalID == "" {
					issues = append(issues, ExtractionOutcomeIssue{Code: "playbook_not_resolvable", List: list.name, EntityID: id, Message: fmt.Sprintf("%s is not an active resolvable playbook", id)})
					continue
				}
				if canonicalID != id {
					issues = append(issues, ExtractionOutcomeIssue{Code: "non_terminal_entity_id", List: list.name, EntityID: id, Message: fmt.Sprintf("%s must be recorded as terminal canonical ID %s", id, canonicalID)})
				}
				continue
			}
			if graph == nil {
				issues = append(issues, ExtractionOutcomeIssue{Code: "invalid_graph", List: list.name, EntityID: id, Message: "terminal IDs cannot be checked without an entity graph"})
				continue
			}
			resolution, diagnostics := graph.Resolve(id)
			if HasErrors(diagnostics) {
				issues = append(issues, ExtractionOutcomeIssue{Code: "entity_not_resolvable", List: list.name, EntityID: id, Message: fmt.Sprintf("%s does not resolve to an active terminal entity", id)})
				continue
			}
			if resolution.Resolved || resolution.CanonicalID != id || len(resolution.Chain) != 1 {
				issues = append(issues, ExtractionOutcomeIssue{Code: "non_terminal_entity_id", List: list.name, EntityID: id, Message: fmt.Sprintf("%s must be recorded as terminal canonical ID %s", id, resolution.CanonicalID)})
			}
		}
	}
	return issues
}

func isPlaybookID(id string) bool {
	return len(id) >= 4 && id[:3] == "PB-"
}

func hasRegisteredEntityPrefix(id string) bool {
	dash := -1
	for index, value := range id {
		if value == '-' {
			dash = index
			break
		}
	}
	if dash < 1 {
		return false
	}
	switch id[:dash] {
	case "REQ", "CAP", "PER", "TC", "RES", "RUN", "FIND", "EXT", "PB":
	default:
		return false
	}
	return numericSuffix(id)
}

func numericSuffix(id string) bool {
	dash := -1
	for index, value := range id {
		if value == '-' {
			dash = index
			break
		}
	}
	if dash < 1 || len(id)-dash-1 != 3 {
		return false
	}
	for _, digit := range id[dash+1:] {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return true
}
