package entities

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConsolidateDryRunApplyPreservationAndIdempotence(t *testing.T) {
	dataDir := writeConsolidationRoot(t, []map[string]any{
		{"id": "PER-003", "type": "persona", "status": "active", "name": "Administrator", "x_extension": map[string]any{"keep": true}},
		{"id": "PER-041", "type": "persona", "status": "active", "name": "Admin", "x_extension": map[string]any{"nested": []any{1.0, "two"}}},
	})
	personaPath := filepath.Join(dataDir, "personas.jsonl")
	if err := os.Chmod(personaPath, 0o640); err != nil {
		t.Fatal(err)
	}
	manifestPath := writeManifest(t, ConsolidationManifest{Version: 1, Mappings: []ConsolidationMapping{{
		SourceID: "PER-041", TargetID: "PER-003", Kind: "duplicate", DecidedAt: "2026-07-21T15:30:00Z",
		DecidedBy: "product-research", Reason: "same reviewed persona", EvidenceRefs: []string{"research.md#review"},
	}}})
	before, err := os.ReadFile(personaPath)
	if err != nil {
		t.Fatal(err)
	}

	plan, graph, diagnostics, err := Consolidate(dataDir, manifestPath, ModeCompat, false)
	if err != nil || HasErrors(diagnostics) {
		t.Fatalf("dry run failed: %v %+v", err, diagnostics)
	}
	if plan.Applied || plan.ChangeCount != 1 || graph == nil {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	afterDryRun, _ := os.ReadFile(personaPath)
	if string(afterDryRun) != string(before) {
		t.Fatal("dry run changed canonical data")
	}

	result, graph, diagnostics, err := Consolidate(dataDir, manifestPath, ModeCompat, true)
	if err != nil || HasErrors(diagnostics) {
		t.Fatalf("apply failed: %v %+v", err, diagnostics)
	}
	if !result.Applied || result.ChangeCount != 1 || graph == nil {
		t.Fatalf("unexpected apply result: %+v", result)
	}
	info, _ := os.Stat(personaPath)
	if info.Mode().Perm() != 0o640 {
		t.Fatalf("mode = %o", info.Mode().Perm())
	}
	record, ok := graph.Record("PER-041")
	if !ok || record.Status != "superseded" || record.Redirect == nil || record.Redirect.TargetID != "PER-003" {
		t.Fatalf("unexpected changed record: %+v", record)
	}
	var extension map[string]any
	if err := json.Unmarshal(record.Raw["x_extension"], &extension); err != nil || extension["nested"] == nil {
		t.Fatalf("unknown field not preserved: %s, %v", record.Raw["x_extension"], err)
	}
	var updatedAt string
	if err := json.Unmarshal(record.Raw["updated_at"], &updatedAt); err != nil || updatedAt != "2026-07-21T15:30:00Z" {
		t.Fatalf("updated_at = %q, %v", updatedAt, err)
	}

	appliedBytes, _ := os.ReadFile(personaPath)
	replay, _, diagnostics, err := Consolidate(dataDir, manifestPath, ModeCompat, true)
	if err != nil || HasErrors(diagnostics) {
		t.Fatalf("replay failed: %v %+v", err, diagnostics)
	}
	if replay.Applied || replay.ChangeCount != 0 || replay.NoOpCount != 1 {
		t.Fatalf("unexpected replay: %+v", replay)
	}
	replayedBytes, _ := os.ReadFile(personaPath)
	if string(replayedBytes) != string(appliedBytes) {
		t.Fatal("idempotent replay changed canonical bytes")
	}
}

func TestConsolidateRemapConflictFailsClosed(t *testing.T) {
	dataDir := writeConsolidationRoot(t, []map[string]any{
		{"id": "PER-001", "type": "persona", "status": "active"},
		{"id": "PER-002", "type": "persona", "status": "active"},
		{"id": "PER-003", "type": "persona", "status": "superseded", "redirect": redirectObject("PER-001")},
	})
	manifestPath := writeManifest(t, ConsolidationManifest{Version: 1, Mappings: []ConsolidationMapping{{
		SourceID: "PER-003", TargetID: "PER-002", Kind: "duplicate", DecidedAt: "2026-07-21T15:30:00Z",
		DecidedBy: "reviewer", Reason: "remap", EvidenceRefs: []string{},
	}}})
	path := filepath.Join(dataDir, "personas.jsonl")
	before, _ := os.ReadFile(path)
	_, _, diagnostics, err := Consolidate(dataDir, manifestPath, ModeCompat, true)
	if !errors.Is(err, ErrConsolidationConflict) {
		t.Fatalf("error = %v", err)
	}
	if !diagnosticsContain(diagnostics, CodeRedirectRemapConflict) {
		t.Fatalf("diagnostics = %+v", diagnostics)
	}
	after, _ := os.ReadFile(path)
	if string(after) != string(before) {
		t.Fatal("conflict changed canonical data")
	}
}

func TestConsolidateRejectsMappingsAcrossCanonicalDatasets(t *testing.T) {
	dataDir := writeConsolidationRoot(t, []map[string]any{
		{"id": "PER-001", "type": "persona", "status": "active"},
		{"id": "PER-002", "type": "persona", "status": "active"},
	})
	requirements := []byte("{\"id\":\"REQ-001\",\"type\":\"requirement\",\"status\":\"active\",\"x_keep\":true}\n{\"id\":\"REQ-002\",\"type\":\"requirement\",\"status\":\"active\"}\n")
	if err := os.WriteFile(filepath.Join(dataDir, "requirements.jsonl"), requirements, 0o644); err != nil {
		t.Fatal(err)
	}
	manifestPath := writeManifest(t, ConsolidationManifest{Version: 1, Mappings: []ConsolidationMapping{
		{SourceID: "PER-002", TargetID: "PER-001", Kind: "duplicate", DecidedAt: "2026-07-21T15:30:00Z", DecidedBy: "reviewer", Reason: "same persona", EvidenceRefs: []string{}},
		{SourceID: "REQ-002", TargetID: "REQ-001", Kind: "replaced", DecidedAt: "2026-07-21T15:30:00Z", DecidedBy: "reviewer", Reason: "same requirement", EvidenceRefs: []string{}},
	}})
	personaPath := filepath.Join(dataDir, "personas.jsonl")
	requirementPath := filepath.Join(dataDir, "requirements.jsonl")
	personasBefore, _ := os.ReadFile(personaPath)
	requirementsBefore, _ := os.ReadFile(requirementPath)
	_, _, diagnostics, err := Consolidate(dataDir, manifestPath, ModeCompat, true)
	if !errors.Is(err, ErrConsolidationConflict) {
		t.Fatalf("error = %v", err)
	}
	if !diagnosticsContain(diagnostics, CodeInputContract) {
		t.Fatalf("diagnostics = %+v", diagnostics)
	}
	personasAfter, _ := os.ReadFile(personaPath)
	requirementsAfter, _ := os.ReadFile(requirementPath)
	if string(personasAfter) != string(personasBefore) || string(requirementsAfter) != string(requirementsBefore) {
		t.Fatal("cross-dataset manifest changed canonical data")
	}
}

func TestConsolidateProspectiveCycleAndAtomicFailure(t *testing.T) {
	t.Run("prospective cycle", func(t *testing.T) {
		dataDir := writeConsolidationRoot(t, []map[string]any{
			{"id": "PER-001", "type": "persona", "status": "active"},
			{"id": "PER-002", "type": "persona", "status": "active"},
		})
		manifestPath := writeManifest(t, ConsolidationManifest{Version: 1, Mappings: []ConsolidationMapping{
			{SourceID: "PER-001", TargetID: "PER-002", Kind: "duplicate", DecidedAt: "2026-07-21T15:30:00Z", DecidedBy: "reviewer", Reason: "cycle a", EvidenceRefs: []string{}},
			{SourceID: "PER-002", TargetID: "PER-001", Kind: "duplicate", DecidedAt: "2026-07-21T15:30:00Z", DecidedBy: "reviewer", Reason: "cycle b", EvidenceRefs: []string{}},
		}})
		path := filepath.Join(dataDir, "personas.jsonl")
		before, _ := os.ReadFile(path)
		_, _, diagnostics, err := Consolidate(dataDir, manifestPath, ModeCompat, true)
		if !errors.Is(err, ErrConsolidationValidation) || !diagnosticsContain(diagnostics, CodeRedirectCycle) {
			t.Fatalf("error=%v diagnostics=%+v", err, diagnostics)
		}
		after, _ := os.ReadFile(path)
		if string(after) != string(before) {
			t.Fatal("failed preflight changed canonical data")
		}
	})

	t.Run("atomic replacement failure", func(t *testing.T) {
		dataDir := writeConsolidationRoot(t, []map[string]any{
			{"id": "PER-001", "type": "persona", "status": "active"},
			{"id": "PER-002", "type": "persona", "status": "active"},
		})
		manifestPath := writeManifest(t, ConsolidationManifest{Version: 1, Mappings: []ConsolidationMapping{{
			SourceID: "PER-002", TargetID: "PER-001", Kind: "duplicate", DecidedAt: "2026-07-21T15:30:00Z",
			DecidedBy: "reviewer", Reason: "same", EvidenceRefs: []string{},
		}}})
		path := filepath.Join(dataDir, "personas.jsonl")
		before, _ := os.ReadFile(path)
		originalReplace := replaceCanonicalFile
		replaceCanonicalFile = func(string, string) error { return errors.New("injected rename failure") }
		t.Cleanup(func() { replaceCanonicalFile = originalReplace })
		_, _, _, err := Consolidate(dataDir, manifestPath, ModeCompat, true)
		if err == nil || !strings.Contains(err.Error(), "injected rename failure") {
			t.Fatalf("error = %v", err)
		}
		after, _ := os.ReadFile(path)
		if string(after) != string(before) {
			t.Fatal("failed atomic replacement changed canonical data")
		}
		matches, _ := filepath.Glob(filepath.Join(dataDir, ".buildos-consolidation-*.tmp"))
		if len(matches) != 0 {
			t.Fatalf("temporary files remain: %v", matches)
		}
	})
}

func writeConsolidationRoot(t *testing.T, personas []map[string]any) string {
	t.Helper()
	dataDir := filepath.Join(t.TempDir(), ".os", "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range canonicalDatasetFiles {
		var content strings.Builder
		if name == "personas.jsonl" {
			for _, row := range personas {
				encoded, err := json.Marshal(row)
				if err != nil {
					t.Fatal(err)
				}
				content.Write(encoded)
				content.WriteByte('\n')
			}
		}
		if err := os.WriteFile(filepath.Join(dataDir, name), []byte(content.String()), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dataDir
}

func writeManifest(t *testing.T, manifest ConsolidationManifest) string {
	t.Helper()
	data, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "manifest.json")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func redirectObject(target string) map[string]any {
	return map[string]any{
		"target_id": target, "kind": "duplicate", "decided_at": "2026-07-20T10:00:00Z",
		"decided_by": "reviewer", "reason": "same", "evidence_refs": []string{},
	}
}

func diagnosticsContain(diagnostics []Diagnostic, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return true
		}
	}
	return false
}
