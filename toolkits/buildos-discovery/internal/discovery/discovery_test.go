package discovery

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRecordDiscoveryRunCreatesArtifactsAndDoesNotPromoteRawFinding(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	writeTextFile(t, root, "inputs/evidence.txt", "evidence")
	writeTextFile(t, root, "inputs/raw.md", "raw finding text")

	result, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "negative",
		Targets:         []string{"REQ-001"},
		DatasetRefs:     []string{"system/workspace/datasets/example.csv"},
		EvidencePaths:   []string{"inputs/evidence.txt"},
		RawFindingPaths: []string{"inputs/raw.md"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.RunID != "RUN-001" || result.RawFindingCount != 1 || result.EvidenceCount != 1 {
		t.Fatalf("unexpected result: %#v", result)
	}
	assertExists(t, root, "system/workspace/runs/RUN-001/run.md")
	assertExists(t, root, "system/workspace/runs/RUN-001/raw-findings.md")
	assertExists(t, root, "system/workspace/runs/RUN-001/evidence/001-evidence.txt")
	if _, err := os.Stat(filepath.Join(root, "system/.os/data/findings.jsonl")); !os.IsNotExist(err) {
		t.Fatalf("raw finding should not promote to findings.jsonl, err=%v", err)
	}

	raw := readTextFile(t, root, "system/workspace/runs/RUN-001/raw-findings.md")
	if !strings.Contains(raw, "raw-finding-1") || !strings.Contains(raw, "raw finding text") {
		t.Fatalf("raw findings missing anchor/content:\n%s", raw)
	}
	row := readSingleJSONLRow(t, root, "system/.os/data/runs.jsonl")
	if row["id"] != "RUN-001" || row["outcome"] != "negative" || row["playbook_id"] != "PB-010" {
		t.Fatalf("unexpected run row: %#v", row)
	}
}

func TestRecordDiscoveryRunDryRunDoesNotWrite(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	writeTextFile(t, root, "inputs/raw.md", "raw finding text")

	result, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "positive",
		RawFindingPaths: []string{"inputs/raw.md"},
		DryRun:          true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.DryRun || result.RunID != "RUN-001" {
		t.Fatalf("unexpected result: %#v", result)
	}
	assertNotExists(t, root, "system/workspace/runs/RUN-001")
	assertNotExists(t, root, "system/.os/data/runs.jsonl")
}

func TestRecordDiscoveryRunRejectsImmutableRunFolder(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	if err := os.MkdirAll(filepath.Join(root, "system/workspace/runs/RUN-001"), 0o755); err != nil {
		t.Fatal(err)
	}

	_, err := RecordDiscoveryRun(RunDiscoveryOptions{RepoRoot: root, PlaybookID: "PB-010", Outcome: "positive"})
	if err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Fatalf("expected immutable write refusal, got %v", err)
	}
}

func TestRecordDiscoveryRunRejectsDuplicateIDs(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	writeTextFile(t, root, "system/.os/data/runs.jsonl", `{"id":"RUN-001"}`+"\n"+`{"id":"RUN-001"}`+"\n")

	_, err := RecordDiscoveryRun(RunDiscoveryOptions{RepoRoot: root, PlaybookID: "PB-010", Outcome: "positive"})
	if err == nil || !strings.Contains(err.Error(), "duplicates") {
		t.Fatalf("expected duplicate ID rejection, got %v", err)
	}
}

func TestRecordDiscoveryRunRejectsInactiveAndNonDiscoveryPlaybooks(t *testing.T) {
	tests := []struct {
		name     string
		playbook PlaybookEntry
		runnable bool
		want     string
	}{
		{
			name:     "not runnable",
			playbook: activeDiscoveryPlaybookFixture("PB-010"),
			runnable: false,
			want:     "not active/runnable",
		},
		{
			name: "wrong category",
			playbook: func() PlaybookEntry {
				playbook := activeDiscoveryPlaybookFixture("PB-010")
				playbook.Category = "testing"
				return playbook
			}(),
			runnable: true,
			want:     "category discovery",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			root := t.TempDir()
			writePlaybookIndex(t, root, tt.playbook, tt.runnable)
			_, err := RecordDiscoveryRun(RunDiscoveryOptions{RepoRoot: root, PlaybookID: "PB-010", Outcome: "positive"})
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected %q, got %v", tt.want, err)
			}
		})
	}
}

func TestRecordDiscoveryRunRejectsInvalidOutcomeAndMissingRawFile(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	if _, err := RecordDiscoveryRun(RunDiscoveryOptions{RepoRoot: root, PlaybookID: "PB-010", Outcome: "maybe"}); err == nil {
		t.Fatal("expected invalid outcome error")
	}
	_, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "positive",
		RawFindingPaths: []string{"missing.md"},
	})
	if err == nil || !strings.Contains(err.Error(), "missing.md") {
		t.Fatalf("expected missing raw file error, got %v", err)
	}
}

func TestRecordDiscoveryRunSupportsInstalledRootLayout(t *testing.T) {
	root := t.TempDir()
	writeInstalledSystemRoot(t, root)
	playbook := activeDiscoveryPlaybookFixture("PB-010")
	playbook.Path = "playbooks/discovery/sample.md"
	writeInstalledPlaybookIndex(t, root, playbook, true)
	writeTextFile(t, root, "assets/_incoming/evidence.txt", "evidence")
	writeTextFile(t, root, "assets/_incoming/raw.md", "raw finding text")

	result, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "positive",
		DatasetRefs:     []string{"system/workspace/datasets/example.csv"},
		EvidencePaths:   []string{"assets/_incoming/evidence.txt"},
		RawFindingPaths: []string{"assets/_incoming/raw.md"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.RunPath != "workspace/runs/RUN-001/" || result.RunsIndexPath != ".os/data/runs.jsonl" {
		t.Fatalf("unexpected installed-root result: %#v", result)
	}
	assertExists(t, root, "workspace/runs/RUN-001/run.md")
	assertExists(t, root, "workspace/runs/RUN-001/raw-findings.md")
	assertExists(t, root, "workspace/runs/RUN-001/evidence/001-evidence.txt")
	assertExists(t, root, ".os/data/runs.jsonl")
	assertNotExists(t, root, "system/workspace/runs/RUN-001/run.md")

	row := readSingleJSONLRow(t, root, ".os/data/runs.jsonl")
	if row["path"] != "workspace/runs/RUN-001/" {
		t.Fatalf("path kept development-root prefix: %#v", row)
	}
	if row["doc_anchor"] != "docs/prd/10-discovery-runs-and-qualification.md#run-artifacts" {
		t.Fatalf("doc anchor kept development-root prefix: %#v", row)
	}
	if got := stringSliceFromAny(t, row["dataset_refs"]); len(got) != 1 || got[0] != "workspace/datasets/example.csv" {
		t.Fatalf("dataset refs not normalized: %#v", row["dataset_refs"])
	}
	sourceRefs := stringSliceFromAny(t, row["source_refs"])
	for _, want := range []string{"assets/_incoming/raw.md", "playbooks/discovery/sample.md"} {
		if !containsString(sourceRefs, want) {
			t.Fatalf("source refs missing %s in %#v", want, sourceRefs)
		}
	}
}

func TestQualifyFindingPromotesPositiveAndNegativeFindings(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	writeTextFile(t, root, "inputs/raw.md", "raw finding text")
	if _, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "negative",
		RawFindingPaths: []string{"inputs/raw.md"},
	}); err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, "tests/confirm-positive.spec.ts", "test('positive', async () => {})")
	writeTextFile(t, root, "tests/confirm-negative.spec.ts", "test('negative', async () => {})")
	writeTextFile(t, root, "evidence/positive.txt", "passed")
	writeTextFile(t, root, "evidence/negative.txt", "passed")

	positive, err := QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "#raw-finding-1",
		Outcome:              "positive",
		ConfirmationTest:     "tests/confirm-positive.spec.ts",
		ConfirmationEvidence: "evidence/positive.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if positive.FindingID != "FIND-001" {
		t.Fatalf("unexpected positive result: %#v", positive)
	}

	negative, err := QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "raw-findings.md#raw-finding-1",
		Outcome:              "negative",
		ConfirmationTest:     "tests/confirm-negative.spec.ts",
		ConfirmationEvidence: "evidence/negative.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if negative.FindingID != "FIND-002" {
		t.Fatalf("unexpected negative result: %#v", negative)
	}
	assertExists(t, root, "system/workspace/findings/FIND-001/finding.md")
	assertExists(t, root, "system/workspace/findings/FIND-002/qualification.md")
	qualification := readTextFile(t, root, "system/workspace/findings/FIND-002/qualification.md")
	if !strings.Contains(qualification, "Negative Assertion") || !strings.Contains(qualification, "asserts the negative condition") {
		t.Fatalf("negative qualification missing assertion:\n%s", qualification)
	}
	rows := readJSONLRows(t, root, "system/.os/data/findings.jsonl")
	if len(rows) != 2 || rows[0]["status"] != "qualified" || rows[1]["negative_assertion"] == nil {
		t.Fatalf("unexpected finding rows: %#v", rows)
	}
}

func TestQualifyFindingSupportsInstalledRootLayout(t *testing.T) {
	root := t.TempDir()
	writeInstalledSystemRoot(t, root)
	playbook := activeDiscoveryPlaybookFixture("PB-010")
	playbook.Path = "playbooks/discovery/sample.md"
	writeInstalledPlaybookIndex(t, root, playbook, true)
	writeTextFile(t, root, "assets/_incoming/raw.md", "raw finding text")
	if _, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "positive",
		RawFindingPaths: []string{"assets/_incoming/raw.md"},
	}); err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, "workspace/tests/confirm.spec.ts", "test('confirm', async () => {})")
	writeTextFile(t, root, "workspace/evidence/confirmation.txt", "passed")

	result, err := QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		Outcome:              "positive",
		ConfirmationTest:     "system/workspace/tests/confirm.spec.ts",
		ConfirmationEvidence: "system/workspace/evidence/confirmation.txt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.FindingPath != "workspace/findings/FIND-001/" || result.FindingsIndexPath != ".os/data/findings.jsonl" {
		t.Fatalf("unexpected installed-root result: %#v", result)
	}
	assertExists(t, root, "workspace/findings/FIND-001/finding.md")
	assertExists(t, root, "workspace/findings/FIND-001/qualification.md")
	assertExists(t, root, ".os/data/findings.jsonl")
	assertNotExists(t, root, "system/workspace/findings/FIND-001/finding.md")

	row := readSingleJSONLRow(t, root, ".os/data/findings.jsonl")
	for key, want := range map[string]string{
		"path":                  "workspace/findings/FIND-001/",
		"raw_anchor":            "workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		"qualification_test":    "workspace/findings/FIND-001/qualification.md#confirmation-test",
		"confirmation_test":     "workspace/findings/FIND-001/confirmation-test/001-confirm.spec.ts",
		"confirmation_evidence": "workspace/findings/FIND-001/evidence/001-confirmation.txt",
		"doc_anchor":            "docs/prd/10-discovery-runs-and-qualification.md#finding-qualification",
	} {
		if row[key] != want {
			t.Fatalf("%s=%#v want %q in %#v", key, row[key], want, row)
		}
	}
}

func TestQualifyFindingDryRunDoesNotWrite(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	writeTextFile(t, root, "inputs/raw.md", "raw finding text")
	if _, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "positive",
		RawFindingPaths: []string{"inputs/raw.md"},
	}); err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, "tests/confirm.spec.ts", "test('confirm', async () => {})")
	writeTextFile(t, root, "evidence/confirmation.txt", "passed")

	result, err := QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "#raw-finding-1",
		Outcome:              "positive",
		ConfirmationTest:     "tests/confirm.spec.ts",
		ConfirmationEvidence: "evidence/confirmation.txt",
		DryRun:               true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.DryRun || result.FindingID != "FIND-001" {
		t.Fatalf("unexpected dry-run result: %#v", result)
	}
	assertNotExists(t, root, "system/workspace/findings/FIND-001")
	assertNotExists(t, root, "system/.os/data/findings.jsonl")
}

func TestQualifyFindingRejectsMissingRawAnchorMissingEvidenceAndDuplicateIDs(t *testing.T) {
	root := t.TempDir()
	writePlaybookIndex(t, root, activeDiscoveryPlaybookFixture("PB-010"), true)
	writeTextFile(t, root, "inputs/raw.md", "raw finding text")
	if _, err := RecordDiscoveryRun(RunDiscoveryOptions{
		RepoRoot:        root,
		PlaybookID:      "PB-010",
		Outcome:         "positive",
		RawFindingPaths: []string{"inputs/raw.md"},
	}); err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, "tests/confirm.spec.ts", "test('confirm', async () => {})")
	writeTextFile(t, root, "evidence/confirmation.txt", "passed")

	_, err := QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "#missing",
		Outcome:              "positive",
		ConfirmationTest:     "tests/confirm.spec.ts",
		ConfirmationEvidence: "evidence/confirmation.txt",
	})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected missing raw-anchor error, got %v", err)
	}

	_, err = QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "#raw-finding-1",
		Outcome:              "positive",
		ConfirmationTest:     "tests/confirm.spec.ts",
		ConfirmationEvidence: "missing.txt",
	})
	if err == nil || !strings.Contains(err.Error(), "missing.txt") {
		t.Fatalf("expected missing evidence error, got %v", err)
	}

	writeTextFile(t, root, "system/.os/data/findings.jsonl", `{"id":"FIND-001"}`+"\n"+`{"id":"FIND-001"}`+"\n")
	_, err = QualifyFinding(QualifyFindingOptions{
		RepoRoot:             root,
		RunID:                "RUN-001",
		RawFindingRef:        "#raw-finding-1",
		Outcome:              "positive",
		ConfirmationTest:     "tests/confirm.spec.ts",
		ConfirmationEvidence: "evidence/confirmation.txt",
	})
	if err == nil || !strings.Contains(err.Error(), "duplicates") {
		t.Fatalf("expected duplicate finding ID error, got %v", err)
	}
}

func activeDiscoveryPlaybookFixture(id string) PlaybookEntry {
	return PlaybookEntry{
		ID:            id,
		Path:          "system/playbooks/discovery/sample.md",
		Title:         "Sample discovery playbook",
		Category:      "discovery",
		ExecutionMode: "guided-objective",
		StateNature:   "stateful",
		Status:        "active",
		Audience:      "both",
		Harness:       []string{"computer-use"},
		Systems:       []string{"primary-system"},
		Environments:  []string{"baseline"},
		Owners:        []string{"adopter-team"},
		Targets:       []string{"REQ-001"},
		Produces:      []string{"finding"},
		Version:       "1.0.0",
		Related:       []string{},
	}
}

func writePlaybookIndex(t *testing.T, root string, playbook PlaybookEntry, runnable bool) {
	t.Helper()
	index := PlaybookIndex{
		Version:   1,
		Playbooks: []PlaybookEntry{playbook},
	}
	if runnable {
		index.RunnablePlaybooks = []PlaybookEntry{playbook}
	}
	data, err := json.Marshal(index)
	if err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, "system/.os/indexes/playbooks.json", string(data)+"\n")
}

func writeInstalledSystemRoot(t *testing.T, root string) {
	t.Helper()
	for _, rel := range []string{".os", "assets", "docs", "playbooks", "workspace"} {
		if err := os.MkdirAll(filepath.Join(root, filepath.FromSlash(rel)), 0o755); err != nil {
			t.Fatal(err)
		}
	}
}

func writeInstalledPlaybookIndex(t *testing.T, root string, playbook PlaybookEntry, runnable bool) {
	t.Helper()
	index := PlaybookIndex{
		Version:   1,
		Playbooks: []PlaybookEntry{playbook},
	}
	if runnable {
		index.RunnablePlaybooks = []PlaybookEntry{playbook}
	}
	data, err := json.Marshal(index)
	if err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, ".os/indexes/playbooks.json", string(data)+"\n")
}

func writeTextFile(t *testing.T, root, rel, body string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func readTextFile(t *testing.T, root, rel string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func readSingleJSONLRow(t *testing.T, root, rel string) map[string]any {
	t.Helper()
	rows := readJSONLRows(t, root, rel)
	if len(rows) != 1 {
		t.Fatalf("expected one row in %s, got %d", rel, len(rows))
	}
	return rows[0]
}

func readJSONLRows(t *testing.T, root, rel string) []map[string]any {
	t.Helper()
	text := strings.TrimSpace(readTextFile(t, root, rel))
	if text == "" {
		return nil
	}
	lines := strings.Split(text, "\n")
	rows := make([]map[string]any, 0, len(lines))
	for _, line := range lines {
		var row map[string]any
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			t.Fatal(err)
		}
		rows = append(rows, row)
	}
	return rows
}

func stringSliceFromAny(t *testing.T, value any) []string {
	t.Helper()
	items, ok := value.([]any)
	if !ok {
		t.Fatalf("expected JSON array, got %#v", value)
	}
	out := make([]string, len(items))
	for i, item := range items {
		text, ok := item.(string)
		if !ok {
			t.Fatalf("expected string at index %d, got %#v", i, item)
		}
		out[i] = text
	}
	return out
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func assertExists(t *testing.T, root, rel string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); err != nil {
		t.Fatalf("expected %s to exist: %v", rel, err)
	}
}

func assertNotExists(t *testing.T, root, rel string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); !os.IsNotExist(err) {
		t.Fatalf("expected %s not to exist, err=%v", rel, err)
	}
}
