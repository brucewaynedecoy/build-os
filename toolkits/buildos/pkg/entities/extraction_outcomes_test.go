package entities_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos/pkg/entities"
)

func openEntityGraph(t *testing.T, personaRows []string) *entities.Graph {
	t.Helper()
	dataDir := filepath.Join(t.TempDir(), ".os", "data")
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		t.Fatal(err)
	}
	for _, dataset := range []string{"requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"} {
		var content string
		if dataset == "personas.jsonl" && len(personaRows) > 0 {
			content = strings.Join(personaRows, "\n") + "\n"
		}
		if err := os.WriteFile(filepath.Join(dataDir, dataset), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	graph, diagnostics := entities.Load(dataDir)
	if entities.HasErrors(diagnostics) {
		t.Fatalf("load diagnostics = %#v", diagnostics)
	}
	return graph
}

func TestValidateExtractionOutcomesAcceptsDisjointTerminalIDsAndRepeatedExtraction(t *testing.T) {
	graph := openEntityGraph(t, []string{
		personaRow("PER-001", "active", "", nil, ""),
		personaRow("PER-002", "active", "", nil, ""),
		personaRow("PER-003", "active", "", nil, ""),
	})
	outcomes := entities.ExtractionOutcomes{
		OutcomeContract: entities.ExtractionOutcomesV1,
		Minted:          []string{"PER-001"}, Referenced: []string{"PER-002"}, Updated: []string{"PER-003"},
	}
	if issues := entities.ValidateExtractionOutcomes(graph, outcomes); len(issues) != 0 {
		t.Fatalf("issues = %#v", issues)
	}
	for run := 0; run < 2; run++ {
		repeated := entities.ExtractionOutcomes{OutcomeContract: entities.ExtractionOutcomesV1, Minted: []string{}, Referenced: []string{"PER-002"}, Updated: []string{}}
		if issues := entities.ValidateExtractionOutcomes(graph, repeated); len(issues) != 0 {
			t.Fatalf("repeated extraction %d issues = %#v", run, issues)
		}
	}
}

func TestRepeatedPersonaExtractionReferencesCanonicalInsteadOfMinting(t *testing.T) {
	graph := openEntityGraph(t, []string{
		personaRow("PER-001", "active", "", []string{"Support Director"}, "support director | enterprise"),
		personaRow("PER-002", "superseded", "PER-001", []string{"Enterprise Support Lead"}, ""),
	})

	for run := 0; run < 2; run++ {
		match := entities.MatchPersonaExact(graph, entities.PersonaCandidate{Type: "persona", Alias: " enterprise  support lead "})
		if match.Outcome != entities.PersonaOutcomeMatched || match.CanonicalID != "PER-001" || match.Mutated {
			t.Fatalf("repeated extraction %d match = %#v", run, match)
		}
		outcomes := entities.ExtractionOutcomes{
			OutcomeContract: entities.ExtractionOutcomesV1,
			Minted:          []string{},
			Referenced:      []string{match.CanonicalID},
			Updated:         []string{},
		}
		if issues := entities.ValidateExtractionOutcomes(graph, outcomes); len(issues) != 0 {
			t.Fatalf("repeated extraction %d issues = %#v", run, issues)
		}
	}
}

func TestValidateExtractionOutcomesRejectsNonTerminalOverlapAndShapeErrors(t *testing.T) {
	graph := openEntityGraph(t, []string{
		personaRow("PER-001", "active", "", nil, ""),
		personaRow("PER-002", "superseded", "PER-001", nil, ""),
	})
	outcomes := entities.ExtractionOutcomes{
		OutcomeContract: "wrong",
		Minted:          []string{"PER-002", "BAD-001"},
		Referenced:      []string{"PER-002"},
		Updated:         nil,
	}
	issues := entities.ValidateExtractionOutcomes(graph, outcomes)
	wantCodes := []string{"invalid_outcome_contract", "non_terminal_entity_id", "invalid_entity_id", "duplicate_outcome_id", "missing_outcome_list"}
	for _, code := range wantCodes {
		found := false
		for _, issue := range issues {
			found = found || issue.Code == code
		}
		if !found {
			t.Fatalf("missing %s in %#v", code, issues)
		}
	}
}

func TestValidateExtractionOutcomesUsesSeparatePlaybookAuthority(t *testing.T) {
	graph := openEntityGraph(t, nil)
	outcomes := entities.ExtractionOutcomes{
		OutcomeContract: entities.ExtractionOutcomesV1,
		Minted:          []string{"PB-001"},
		Referenced:      []string{},
		Updated:         []string{},
	}
	if issues := entities.ValidateExtractionOutcomes(graph, outcomes); !hasOutcomeIssue(issues, "playbook_resolver_required") {
		t.Fatalf("missing playbook authority should fail closed: %#v", issues)
	}
	resolver := func(id string) (string, error) {
		if id == "PB-001" {
			return id, nil
		}
		return "", os.ErrNotExist
	}
	if issues := entities.ValidateExtractionOutcomesWithPlaybooks(graph, outcomes, resolver); len(issues) != 0 {
		t.Fatalf("active playbook should validate: %#v", issues)
	}
	outcomes.Referenced = []string{"PB-002"}
	if issues := entities.ValidateExtractionOutcomesWithPlaybooks(graph, outcomes, resolver); !hasOutcomeIssue(issues, "playbook_not_resolvable") {
		t.Fatalf("unknown playbook should fail closed: %#v", issues)
	}
}

func hasOutcomeIssue(issues []entities.ExtractionOutcomeIssue, code string) bool {
	for _, issue := range issues {
		if issue.Code == code {
			return true
		}
	}
	return false
}

func personaRow(id, status, target string, aliases []string, identityKey string) string {
	fields := []string{"\"id\":\"" + id + "\"", "\"type\":\"persona\"", "\"status\":\"" + status + "\""}
	if target != "" {
		fields = append(fields, "\"redirect\":{\"target_id\":\""+target+"\",\"kind\":\"duplicate\",\"decided_at\":\"2026-07-21T12:00:00Z\",\"decided_by\":\"test\",\"reason\":\"same persona\",\"evidence_refs\":[]}")
	}
	if aliases != nil {
		quoted := make([]string, len(aliases))
		for index, alias := range aliases {
			quoted[index] = "\"" + alias + "\""
		}
		fields = append(fields, "\"aliases\":["+strings.Join(quoted, ",")+"]")
	}
	if identityKey != "" {
		fields = append(fields, "\"identity\":{\"scheme\":\"persona-v1\",\"key\":\""+identityKey+"\"}")
	}
	return "{" + strings.Join(fields, ",") + "}"
}
