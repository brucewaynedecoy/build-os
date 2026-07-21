package entities_test

import (
	"testing"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos/pkg/entities"
)

func TestNormalizePersonaV1IsDeliberatelyNarrow(t *testing.T) {
	got, err := entities.NormalizePersonaV1(" \tRelease\r\n MANAGER | PLATFÖRM\v")
	if err != nil || got != "release manager | platfÖrm" {
		t.Fatalf("NormalizePersonaV1 = %q, %v", got, err)
	}
	if got, _ := entities.NormalizePersonaV1("Support-Lead"); got != "support-lead" {
		t.Fatalf("punctuation changed: %q", got)
	}
	if _, err := entities.NormalizePersonaV1(string([]byte{0xff})); err == nil {
		t.Fatal("invalid UTF-8 was accepted")
	}
	if _, err := entities.NormalizePersonaV1(" \t\r\n"); err == nil {
		t.Fatal("empty normalized input was accepted")
	}
}

func TestMatchPersonaExactUsesIDAliasThenIdentity(t *testing.T) {
	graph := openEntityGraph(t, []string{
		personaRow("PER-001", "active", "", []string{"Enterprise Support Lead"}, "release manager | platform"),
		personaRow("PER-002", "superseded", "PER-001", []string{"Support Director"}, ""),
		personaRow("PER-003", "superseded", "PER-001", []string{"Support Director"}, ""),
	})

	byID := entities.MatchPersonaExact(graph, entities.PersonaCandidate{Type: "persona", ID: "PER-002", Alias: "does not matter"})
	if byID.Outcome != "matched" || byID.Basis != "exact_id" || byID.CanonicalID != "PER-001" || len(byID.Chain) != 2 || byID.Mutated {
		t.Fatalf("ID result = %#v", byID)
	}
	byAlias := entities.MatchPersonaExact(graph, entities.PersonaCandidate{Type: "persona", Alias: "  SUPPORT\t director "})
	if byAlias.Outcome != "matched" || byAlias.Basis != "approved_alias" || byAlias.CanonicalID != "PER-001" || byAlias.Mutated {
		t.Fatalf("alias result = %#v", byAlias)
	}
	byIdentity := entities.MatchPersonaExact(graph, entities.PersonaCandidate{
		Type: "persona", Alias: "unknown", Identity: &entities.PersonaCandidateIdentity{Scheme: entities.PersonaIdentitySchemeV1, Phrase: " Release  MANAGER | platform "},
	})
	if byIdentity.Outcome != "matched" || byIdentity.Basis != entities.PersonaIdentitySchemeV1 || byIdentity.CanonicalID != "PER-001" {
		t.Fatalf("identity result = %#v", byIdentity)
	}
}

func TestMatchPersonaExactReturnsReviewWithoutMutation(t *testing.T) {
	graph := openEntityGraph(t, []string{
		personaRow("PER-001", "active", "", []string{"Buyer", "Support Lead"}, "finance lead | north america"),
		personaRow("PER-002", "active", "", []string{"Buyer"}, "finance lead | north america"),
		personaRow("PER-003", "archived", "", []string{"Retired Lead"}, ""),
		personaRow("PER-004", "active", "", nil, "finance lead | europe"),
	})

	cases := []struct {
		name      string
		candidate entities.PersonaCandidate
		reason    string
	}{
		{"non persona", entities.PersonaCandidate{Type: "requirement", Alias: "Buyer"}, "unsupported_entity_type"},
		{"ambiguous alias", entities.PersonaCandidate{Type: "persona", Alias: "buyer"}, "ambiguous_alias"},
		{"identity collision", entities.PersonaCandidate{Type: "persona", Identity: &entities.PersonaCandidateIdentity{Scheme: "persona-v1", Phrase: "finance lead | north america"}}, "persona_identity_collision"},
		{"inactive", entities.PersonaCandidate{Type: "persona", Alias: "Retired Lead"}, "invalid_or_inactive_terminal"},
		{"punctuation is not fuzzy", entities.PersonaCandidate{Type: "persona", Alias: "Support-Lead"}, "no_exact_match"},
		{"wrong scheme", entities.PersonaCandidate{Type: "persona", Identity: &entities.PersonaCandidateIdentity{Scheme: "persona-v2", Phrase: "Buyer"}}, "unsupported_identity_scheme"},
		{"malformed id", entities.PersonaCandidate{Type: "persona", ID: "PER-1", Alias: "Buyer"}, "invalid_persona_id"},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			result := entities.MatchPersonaExact(graph, test.candidate)
			if result.Outcome != "review" || result.Reason != test.reason || result.Mutated {
				t.Fatalf("result = %#v", result)
			}
		})
	}
}

func TestMatchPersonaExactFailsClosedOnInvalidStoredAliases(t *testing.T) {
	cases := []struct {
		name string
		row  string
	}{
		{"non-string entry", `{"id":"PER-002","type":"persona","status":"active","aliases":["Buyer",7]}`},
		{"null list", `{"id":"PER-002","type":"persona","status":"active","aliases":null}`},
		{"empty alias", `{"id":"PER-002","type":"persona","status":"active","aliases":[""]}`},
		{"not lexically sorted", `{"id":"PER-002","type":"persona","status":"active","aliases":["Support Lead","Buyer"]}`},
		{"normalized duplicate", `{"id":"PER-002","type":"persona","status":"active","aliases":[" Buyer ","Buyer"]}`},
		{"raw duplicate", `{"id":"PER-002","type":"persona","status":"active","aliases":["Buyer","Buyer"]}`},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			graph := openEntityGraph(t, []string{
				personaRow("PER-001", "active", "", []string{"Buyer"}, ""),
				test.row,
			})
			result := entities.MatchPersonaExact(graph, entities.PersonaCandidate{Type: "persona", Alias: "buyer"})
			if result.Outcome != entities.PersonaOutcomeReview || result.Reason != "invalid_stored_aliases" || result.Mutated {
				t.Fatalf("result = %#v", result)
			}
			if len(result.CandidateIDs) != 2 || result.CandidateIDs[0] != "PER-001" || result.CandidateIDs[1] != "PER-002" {
				t.Fatalf("candidate IDs = %#v", result.CandidateIDs)
			}
		})
	}
}

func TestMatchPersonaExactFailsClosedOnInvalidStoredIdentity(t *testing.T) {
	cases := []struct {
		name   string
		row    string
		reason string
	}{
		{"non-string key", `{"id":"PER-002","type":"persona","status":"active","identity":{"scheme":"persona-v1","key":7}}`, "invalid_stored_identity"},
		{"null identity", `{"id":"PER-002","type":"persona","status":"active","identity":null}`, "invalid_stored_identity"},
		{"missing key", `{"id":"PER-002","type":"persona","status":"active","identity":{"scheme":"persona-v1"}}`, "invalid_stored_identity"},
		{"unsupported scheme", `{"id":"PER-002","type":"persona","status":"active","identity":{"scheme":"persona-v2","key":"buyer | enterprise"}}`, "unsupported_stored_identity_scheme"},
		{"unnormalized matching key", `{"id":"PER-002","type":"persona","status":"active","identity":{"scheme":"persona-v1","key":" Buyer  | enterprise "}}`, "persona_identity_key_not_normalized"},
		{"unnormalized other key", `{"id":"PER-002","type":"persona","status":"active","identity":{"scheme":"persona-v1","key":" Other | segment "}}`, "persona_identity_key_not_normalized"},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			graph := openEntityGraph(t, []string{
				personaRow("PER-001", "active", "", nil, "buyer | enterprise"),
				test.row,
			})
			result := entities.MatchPersonaExact(graph, entities.PersonaCandidate{
				Type: "persona",
				Identity: &entities.PersonaCandidateIdentity{
					Scheme: entities.PersonaIdentitySchemeV1,
					Phrase: "buyer | enterprise",
				},
			})
			if result.Outcome != entities.PersonaOutcomeReview || result.Reason != test.reason || result.Mutated {
				t.Fatalf("result = %#v", result)
			}
			if len(result.CandidateIDs) != 2 || result.CandidateIDs[0] != "PER-001" || result.CandidateIDs[1] != "PER-002" {
				t.Fatalf("candidate IDs = %#v", result.CandidateIDs)
			}
		})
	}
}
