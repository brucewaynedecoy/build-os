package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestPersonaCopiedRootRehearsal(t *testing.T) {
	fixture := filepath.Join("..", "..", "testdata", "persona-pilot")
	root := copyPersonaRehearsalRoot(t, filepath.Join(fixture, "root"))
	manifest := filepath.Join(fixture, "manifests", "approved-persona-consolidations-v1.json")
	conflict := filepath.Join(fixture, "manifests", "intentionally-conflicting-remap-v1.json")
	personas := filepath.Join(root, ".os", "data", "personas.jsonl")
	index := filepath.Join(root, ".os", "indexes", "entity-resolution.json")

	run := func(want int, args ...string) Envelope {
		t.Helper()
		var stdout, stderr bytes.Buffer
		code := Run(append(args, "--json"), &stdout, &stderr, BuildInfo{Version: "dev", SourceRevision: "rehearsal"})
		if code != want {
			t.Fatalf("Run(%v) exit=%d want=%d stdout=%s stderr=%s", args, code, want, stdout.String(), stderr.String())
		}
		return decodeEnvelope(t, stdout.Bytes())
	}

	// Compatibility establishes the copied-root baseline without touching live data.
	run(ExitOK, "entities", "validate", "--root", root, "--mode", "compat")
	run(ExitOK, "entities", "rebuild-index", "--root", root, "--mode", "compat", "--apply")
	snapshotPersonas := mustRead(t, personas)
	snapshotIndex := mustRead(t, index)

	// A reviewed consolidation is dry-run by default and changes no canonical bytes.
	dry := run(ExitOK, "entities", "consolidate", "--root", root, "--mode", "compat", "--manifest", manifest)
	if dry.WriteStatus != WritePlanned || !bytes.Equal(snapshotPersonas, mustRead(t, personas)) || !bytes.Equal(snapshotIndex, mustRead(t, index)) {
		t.Fatal("dry run did not remain non-mutating")
	}

	applied := run(ExitOK, "entities", "consolidate", "--root", root, "--mode", "compat", "--manifest", manifest, "--apply")
	if applied.WriteStatus != WriteApplied {
		t.Fatalf("apply write status=%q", applied.WriteStatus)
	}
	appliedPersonas, appliedIndex := mustRead(t, personas), mustRead(t, index)
	run(ExitOK, "entities", "validate", "--root", root, "--mode", "strict")

	for id, terminal := range map[string]string{"PER-003": "PER-001", "PER-004": "PER-001", "PER-005": "PER-001", "PER-006": "PER-007", "PER-008": "PER-008"} {
		envelope := run(ExitOK, "entities", "resolve", "--root", root, "--mode", "strict", "--id", id)
		result := envelope.Result.(map[string]any)
		if result["canonical_id"] != terminal {
			t.Fatalf("resolve %s canonical=%v want=%s", id, result["canonical_id"], terminal)
		}
	}

	rows := decodePersonaRows(t, appliedPersonas)
	loser := rows["PER-004"]
	if loser["x_preserve"] == nil || loser["source_refs"] == nil || loser["source_anchor"] == nil {
		t.Fatalf("loser provenance or unknown fields were lost: %#v", loser)
	}
	if rows["PER-008"]["status"] != "active" || rows["PER-008"]["redirect"] != nil {
		t.Fatalf("ambiguous persona was mutated: %#v", rows["PER-008"])
	}

	// Rebuilding and replaying are byte-stable.
	run(ExitOK, "entities", "rebuild-index", "--root", root, "--mode", "strict", "--apply")
	if !bytes.Equal(appliedIndex, mustRead(t, index)) {
		t.Fatal("deterministic index rebuild changed bytes")
	}
	run(ExitOK, "entities", "consolidate", "--root", root, "--mode", "strict", "--manifest", manifest, "--apply")
	if !bytes.Equal(appliedPersonas, mustRead(t, personas)) || !bytes.Equal(appliedIndex, mustRead(t, index)) {
		t.Fatal("identical replay changed copied-root bytes")
	}

	run(ExitValidation, "entities", "consolidate", "--root", root, "--mode", "compat", "--manifest", conflict, "--apply")
	if !bytes.Equal(appliedPersonas, mustRead(t, personas)) || !bytes.Equal(appliedIndex, mustRead(t, index)) {
		t.Fatal("conflicting remap changed copied-root bytes")
	}

	// A pre-commit write failure is recoverable and leaves the copy unchanged.
	originalWriter := canonicalDatasetWriter
	canonicalDatasetWriter = func(string, []byte, os.FileMode) error { return errors.New("injected rehearsal write failure") }
	t.Cleanup(func() { canonicalDatasetWriter = originalWriter })
	failureRoot := copyPersonaRehearsalRoot(t, filepath.Join(fixture, "root"))
	failureBefore := mustRead(t, filepath.Join(failureRoot, ".os", "data", "personas.jsonl"))
	var stdout, stderr bytes.Buffer
	code := Run([]string{"entities", "consolidate", "--root", failureRoot, "--mode", "compat", "--manifest", manifest, "--apply", "--json"}, &stdout, &stderr, BuildInfo{})
	canonicalDatasetWriter = originalWriter
	if code != ExitIO || !bytes.Equal(failureBefore, mustRead(t, filepath.Join(failureRoot, ".os", "data", "personas.jsonl"))) {
		t.Fatalf("injected failure exit=%d changed canonical bytes", code)
	}

	// Snapshot rollback restores exact pre-migration canonical and derived bytes.
	if err := os.WriteFile(personas, snapshotPersonas, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(index, snapshotIndex, 0o644); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(snapshotPersonas, mustRead(t, personas)) || !bytes.Equal(snapshotIndex, mustRead(t, index)) {
		t.Fatal("rollback did not restore byte identity")
	}
}

func copyPersonaRehearsalRoot(t *testing.T, source string) string {
	t.Helper()
	root := t.TempDir()
	err := filepath.WalkDir(source, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(root, relative)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode().Perm())
	})
	if err != nil {
		t.Fatalf("copy persona rehearsal fixture: %v", err)
	}
	return root
}

func mustRead(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func decodePersonaRows(t *testing.T, data []byte) map[string]map[string]any {
	t.Helper()
	rows := map[string]map[string]any{}
	for _, line := range bytes.Split(bytes.TrimSpace(data), []byte("\n")) {
		var row map[string]any
		if err := json.Unmarshal(line, &row); err != nil {
			t.Fatal(err)
		}
		rows[row["id"].(string)] = row
	}
	return rows
}
