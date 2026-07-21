package design

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	entityresolver "github.com/brucewaynedecoy/build-os/toolkits/buildos/pkg/entities"
)

func TestPromoteFindingResolvesCanonicalFindingAndPreservesHistoricalRecord(t *testing.T) {
	root := t.TempDir()
	writeRouterInputs(t, root)
	writeEmptyGovernedDatasets(t, root, "system/.os/data")
	loser := findingIndexRow{
		ID: "FIND-001", Type: "finding", Path: "system/workspace/findings/FIND-001/", Title: "Historical finding",
		Status: "superseded", Designs: []string{"system/docs/designs/2026-07-01-historical.md"}, Related: []string{"RUN-OLD"},
		Redirect: &entityresolver.Redirect{TargetID: "FIND-002", Kind: "duplicate", DecidedAt: "2026-07-20T10:00:00Z", DecidedBy: "reviewer", Reason: "same finding", EvidenceRefs: []string{"review.md"}},
	}
	canonical := findingIndexRow{
		ID: "FIND-002", Type: "finding", Path: "system/workspace/findings/FIND-002/", Title: "Canonical qualified finding",
		Status: "qualified", Summary: "Canonical summary", Observed: "Canonical observation", Outcome: "positive", Polarity: "positive",
		RunID: "RUN-002", OriginRun: "RUN-002", RawAnchor: "system/workspace/runs/RUN-002/raw-findings.md#raw-finding-1",
		QualificationTest: "system/workspace/findings/FIND-002/qualification.md#confirmation-test", Designs: []string{}, Related: []string{"RUN-002"},
	}
	var index strings.Builder
	var originalLoserLine string
	for rowIndex, row := range []findingIndexRow{loser, canonical} {
		data, err := json.Marshal(row)
		if err != nil {
			t.Fatal(err)
		}
		var object map[string]json.RawMessage
		if err := json.Unmarshal(data, &object); err != nil {
			t.Fatal(err)
		}
		object["x_type_specific"] = json.RawMessage(`{"owner":"preserve-me"}`)
		data, err = json.Marshal(object)
		if err != nil {
			t.Fatal(err)
		}
		if rowIndex == 0 {
			originalLoserLine = string(data)
		}
		index.Write(data)
		index.WriteByte('\n')
	}
	writeTextFile(t, root, "system/.os/data/findings.jsonl", index.String())
	historicalRecord := "# Historical finding\n\n## Designs\n\n- [Historical](../../../docs/designs/2026-07-01-historical.md)\n"
	writeTextFile(t, root, "system/workspace/findings/FIND-001/finding.md", historicalRecord)
	writeTextFile(t, root, "system/workspace/findings/FIND-002/finding.md", "# Canonical qualified finding\n\n## Designs\n\nNo design hand-off recorded.\n")
	writeTextFile(t, root, "system/workspace/findings/FIND-002/qualification.md", "# Qualification\n\n## Confirmation Test {#confirmation-test}\n")
	writeTextFile(t, root, "system/workspace/runs/RUN-002/raw-findings.md", "## Raw Finding 1 {#raw-finding-1}\n")

	result, err := PromoteFinding(PromoteFindingOptions{RepoRoot: root, FindingID: "FIND-001", Route: "change-plan", Slug: "canonical-finding"})
	if err != nil {
		t.Fatal(err)
	}
	if result.RequestedFindingID != "FIND-001" || result.CanonicalFindingID != "FIND-002" || result.FindingID != "FIND-002" {
		t.Fatalf("identity reporting=%#v", result)
	}
	if strings.Join(result.RedirectChain, ",") != "FIND-001,FIND-002" {
		t.Fatalf("redirect chain=%v", result.RedirectChain)
	}
	if got := readTextFile(t, root, "system/workspace/findings/FIND-001/finding.md"); got != historicalRecord {
		t.Fatalf("historical record changed:\n%s", got)
	}
	if got := strings.Split(strings.TrimSuffix(readTextFile(t, root, "system/.os/data/findings.jsonl"), "\n"), "\n")[0]; got != originalLoserLine {
		t.Fatalf("historical JSONL row changed:\n got: %s\nwant: %s", got, originalLoserLine)
	}
	rows, loserIndex, err := readFindingRows(filepath.Join(root, "system/.os/data/findings.jsonl"), "FIND-001")
	if err != nil {
		t.Fatal(err)
	}
	_, canonicalIndex, err := readFindingRows(filepath.Join(root, "system/.os/data/findings.jsonl"), "FIND-002")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows[loserIndex].Designs) != 1 || rows[loserIndex].Designs[0] != loser.Designs[0] {
		t.Fatalf("historical back-references changed: %#v", rows[loserIndex].Designs)
	}
	if len(rows[canonicalIndex].Designs) != 1 || rows[canonicalIndex].Designs[0] != result.DesignPath {
		t.Fatalf("canonical back-reference missing: %#v", rows[canonicalIndex].Designs)
	}
	if rows[loserIndex].Raw["x_type_specific"] == nil || rows[canonicalIndex].Raw["x_type_specific"] == nil {
		t.Fatal("unknown fields were not preserved on historical and canonical rows")
	}
	if design := readTextFile(t, root, result.DesignPath); !strings.Contains(design, "FIND-002") || strings.Contains(design, "FIND-001") {
		t.Fatalf("design did not use canonical finding:\n%s", design)
	}
}

func TestPromoteFindingCreatesDesignAndUpdatesFinding(t *testing.T) {
	root := t.TempDir()
	writeQualifiedFindingFixture(t, root, findingIndexRow{
		ID:                "FIND-001",
		Type:              "finding",
		Path:              "system/workspace/findings/FIND-001/",
		Title:             "Qualified finding FIND-001",
		Status:            "qualified",
		Summary:           "Finding qualified from run RUN-001.",
		Observed:          "Raw finding was confirmed.",
		Outcome:           "positive",
		Polarity:          "positive",
		RunID:             "RUN-001",
		OriginRun:         "RUN-001",
		RawAnchor:         "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
		Systems:           []string{"primary-system"},
		Environments:      []string{"baseline"},
		Owners:            []string{"adopter-team"},
		QualifiedAt:       "2026-06-05T00:00:00Z",
		Designs:           []string{},
		Related:           []string{"RUN-001"},
		CreatedAt:         "2026-06-05T00:00:00Z",
		UpdatedAt:         "2026-06-05T00:00:00Z",
	})

	result, err := PromoteFinding(PromoteFindingOptions{
		RepoRoot:  root,
		FindingID: "FIND-001",
		Route:     "change-plan",
		Title:     "Resolve Qualified Finding",
		Slug:      "resolve-qualified-finding",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.FindingID != "FIND-001" || !strings.Contains(result.DesignPath, "resolve-qualified-finding.md") {
		t.Fatalf("unexpected result: %#v", result)
	}

	design := readTextFile(t, root, result.DesignPath)
	for _, want := range []string{
		"# Resolve Qualified Finding",
		"## Purpose",
		"## Context",
		"## Decision",
		"## Alternatives Considered",
		"## Consequences",
		"## Intended Follow-On",
		"- Route: `change-plan`",
		"../assets/prompts/designs-to-plan-change.prompt.md",
		"primary-system",
		"baseline",
		"adopter-team",
		"../../workspace/findings/FIND-001/qualification.md#confirmation-test",
	} {
		if !strings.Contains(design, want) {
			t.Fatalf("design missing %q:\n%s", want, design)
		}
	}
	if result.DesignContent != design {
		t.Fatalf("result design content does not match written design")
	}

	row := readSingleFindingRow(t, root)
	if len(row.Designs) != 1 || row.Designs[0] != result.DesignPath {
		t.Fatalf("unexpected designs in row: %#v", row.Designs)
	}
	record := readTextFile(t, root, "system/workspace/findings/FIND-001/finding.md")
	if strings.Contains(record, "No design hand-off recorded") || !strings.Contains(record, "../../../docs/designs/") {
		t.Fatalf("finding record not updated:\n%s", record)
	}
}

func TestPromoteFindingSupportsInstalledRootLayout(t *testing.T) {
	root := t.TempDir()
	writeInstalledSystemRoot(t, root)
	writeInstalledRouterInputs(t, root)
	row := findingIndexRow{
		ID:                "FIND-001",
		Type:              "finding",
		Path:              "system/workspace/findings/FIND-001/",
		Title:             "Installed qualified finding",
		Status:            "qualified",
		Summary:           "Finding qualified from installed root run RUN-001.",
		Observed:          "Raw finding was confirmed in the installed workspace.",
		Outcome:           "positive",
		Polarity:          "positive",
		RunID:             "RUN-001",
		OriginRun:         "RUN-001",
		RawAnchor:         "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
		Systems:           []string{"primary-system"},
		Environments:      []string{"baseline"},
		Owners:            []string{"adopter-team"},
		QualifiedAt:       "2026-06-05T00:00:00Z",
		Designs:           []string{},
		Related:           []string{"RUN-001"},
		CreatedAt:         "2026-06-05T00:00:00Z",
		UpdatedAt:         "2026-06-05T00:00:00Z",
	}
	data, err := json.Marshal(row)
	if err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, ".os/data/findings.jsonl", string(data)+"\n")
	writeEmptyGovernedDatasets(t, root, ".os/data")
	writeTextFile(t, root, "workspace/findings/FIND-001/finding.md", "# "+row.Title+"\n\n## Finding FIND-001 {#finding-find-001}\n\n- Status: qualified\n\n## Observation\n\nObserved.\n\n## Designs\n\nNo design hand-off recorded.\n")
	writeTextFile(t, root, "workspace/findings/FIND-001/qualification.md", "# Qualification\n\n## Confirmation Test {#confirmation-test}\n\n- Result: pass\n")
	writeTextFile(t, root, "workspace/runs/RUN-001/raw-findings.md", "# Raw Findings\n\n## Raw Finding 1 {#raw-finding-1}\n\nRaw.\n")

	result, err := PromoteFinding(PromoteFindingOptions{
		RepoRoot:  root,
		FindingID: "FIND-001",
		Route:     "change-plan",
		Title:     "Installed Design Hand Off",
		Slug:      "installed-design-hand-off",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(result.DesignPath, "docs/designs/") || result.FindingsIndexPath != ".os/data/findings.jsonl" {
		t.Fatalf("unexpected installed-root result: %#v", result)
	}
	assertExists(t, root, result.DesignPath)
	assertNotExists(t, root, "system/"+result.DesignPath)

	design := readTextFile(t, root, result.DesignPath)
	for _, want := range []string{
		"# Installed Design Hand Off",
		"- Route: `change-plan`",
		"../assets/prompts/designs-to-plan-change.prompt.md",
		"../../workspace/findings/FIND-001/qualification.md#confirmation-test",
		"../../workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		"primary-system",
		"baseline",
		"adopter-team",
	} {
		if !strings.Contains(design, want) {
			t.Fatalf("design missing %q:\n%s", want, design)
		}
	}

	updated := readSingleFindingRowAt(t, root, ".os/data/findings.jsonl")
	if len(updated.Designs) != 1 || updated.Designs[0] != result.DesignPath {
		t.Fatalf("unexpected designs in row: %#v", updated.Designs)
	}
	for _, value := range []string{updated.Path, updated.RawAnchor, updated.QualificationTest, updated.Designs[0]} {
		if strings.HasPrefix(value, "system/") {
			t.Fatalf("installed-root row kept system prefix: %#v", updated)
		}
	}
	record := readTextFile(t, root, "workspace/findings/FIND-001/finding.md")
	if strings.Contains(record, "No design hand-off recorded") || !strings.Contains(record, "../../../docs/designs/") {
		t.Fatalf("finding record not updated:\n%s", record)
	}
}

func TestPromoteFindingRejectsInvalidInputs(t *testing.T) {
	tests := []struct {
		name string
		row  findingIndexRow
		opts PromoteFindingOptions
		want string
	}{
		{
			name: "unknown finding",
			opts: PromoteFindingOptions{FindingID: "FIND-999", Route: "baseline-plan", Slug: "valid-slug"},
			want: "does not exist",
		},
		{
			name: "not qualified",
			row:  findingIndexRow{ID: "FIND-001", Path: "system/workspace/findings/FIND-001/", Status: "draft", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test"},
			opts: PromoteFindingOptions{FindingID: "FIND-001", Route: "baseline-plan", Slug: "valid-slug"},
			want: "redirect_inactive_terminal",
		},
		{
			name: "missing qualification anchor",
			row:  findingIndexRow{ID: "FIND-001", Path: "system/workspace/findings/FIND-001/", Status: "qualified", QualificationTest: "system/workspace/findings/FIND-001/qualification.md"},
			opts: PromoteFindingOptions{FindingID: "FIND-001", Route: "baseline-plan", Slug: "valid-slug"},
			want: "missing a qualification anchor",
		},
		{
			name: "unknown qualification anchor",
			row:  findingIndexRow{ID: "FIND-001", Path: "system/workspace/findings/FIND-001/", Status: "qualified", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#missing"},
			opts: PromoteFindingOptions{FindingID: "FIND-001", Route: "baseline-plan", Slug: "valid-slug"},
			want: "not found",
		},
		{
			name: "invalid route",
			row:  findingIndexRow{ID: "FIND-001", Path: "system/workspace/findings/FIND-001/", Status: "qualified", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test"},
			opts: PromoteFindingOptions{FindingID: "FIND-001", Route: "maybe", Slug: "valid-slug"},
			want: "requires --route",
		},
		{
			name: "missing route",
			opts: PromoteFindingOptions{FindingID: "FIND-001", Slug: "valid-slug"},
			want: "requires --route",
		},
		{
			name: "invalid slug",
			row:  findingIndexRow{ID: "FIND-001", Path: "system/workspace/findings/FIND-001/", Status: "qualified", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test"},
			opts: PromoteFindingOptions{FindingID: "FIND-001", Route: "baseline-plan", Slug: "Bad Slug"},
			want: "must use lowercase",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			root := t.TempDir()
			if tt.row.ID != "" {
				writeQualifiedFindingFixture(t, root, tt.row)
			} else {
				writeRouterInputs(t, root)
				writeTextFile(t, root, "system/.os/data/findings.jsonl", "")
				writeEmptyGovernedDatasets(t, root, "system/.os/data")
			}
			tt.opts.RepoRoot = root
			_, err := PromoteFinding(tt.opts)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected %q, got %v", tt.want, err)
			}
		})
	}
}

func TestPromoteFindingFailsClosedOnInvalidRedirectGraph(t *testing.T) {
	root := t.TempDir()
	writeRouterInputs(t, root)
	writeEmptyGovernedDatasets(t, root, "system/.os/data")
	row := findingIndexRow{
		ID: "FIND-001", Type: "finding", Path: "system/workspace/findings/FIND-001/", Status: "superseded",
		Redirect: &entityresolver.Redirect{TargetID: "FIND-999", Kind: "duplicate", DecidedAt: "2026-07-20T10:00:00Z", DecidedBy: "reviewer", Reason: "invalid fixture", EvidenceRefs: []string{}},
	}
	data, err := json.Marshal(row)
	if err != nil {
		t.Fatal(err)
	}
	indexPath := "system/.os/data/findings.jsonl"
	writeTextFile(t, root, indexPath, string(data)+"\n")
	before := readTextFile(t, root, indexPath)
	_, err = PromoteFinding(PromoteFindingOptions{RepoRoot: root, FindingID: "FIND-001", Route: "baseline-plan", Slug: "must-not-exist"})
	if err == nil || !strings.Contains(err.Error(), "redirect_missing_target") {
		t.Fatalf("expected redirect graph failure, got %v", err)
	}
	if got := readTextFile(t, root, indexPath); got != before {
		t.Fatal("invalid redirect graph changed findings index")
	}
	assertNotExists(t, root, timeStampedDesignPath("must-not-exist"))
}

func TestPromoteFindingRejectsDuplicateDesignTarget(t *testing.T) {
	root := t.TempDir()
	writeQualifiedFindingFixture(t, root, findingIndexRow{
		ID:                "FIND-001",
		Path:              "system/workspace/findings/FIND-001/",
		Status:            "qualified",
		QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
	})
	result, err := PromoteFinding(PromoteFindingOptions{
		RepoRoot:  root,
		FindingID: "FIND-001",
		Route:     "baseline-plan",
		Slug:      "duplicate-target",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = PromoteFinding(PromoteFindingOptions{
		RepoRoot:  root,
		FindingID: "FIND-001",
		Route:     "baseline-plan",
		Slug:      "duplicate-target",
	})
	if err == nil || !strings.Contains(err.Error(), "already exists") || !strings.Contains(err.Error(), result.DesignPath) {
		t.Fatalf("expected duplicate target error, got %v", err)
	}
}

func TestPromoteFindingRejectsReferencedDesignTarget(t *testing.T) {
	root := t.TempDir()
	writeQualifiedFindingFixture(t, root, findingIndexRow{
		ID:                "FIND-001",
		Path:              "system/workspace/findings/FIND-001/",
		Status:            "qualified",
		QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
		Designs:           []string{timeStampedDesignPath("referenced-target")},
	})

	_, err := PromoteFinding(PromoteFindingOptions{
		RepoRoot:  root,
		FindingID: "FIND-001",
		Route:     "baseline-plan",
		Slug:      "referenced-target",
	})
	if err == nil || !strings.Contains(err.Error(), "already referenced") {
		t.Fatalf("expected referenced target error, got %v", err)
	}
}

func TestPromoteFindingDryRunDoesNotWrite(t *testing.T) {
	root := t.TempDir()
	writeQualifiedFindingFixture(t, root, findingIndexRow{
		ID:                "FIND-001",
		Path:              "system/workspace/findings/FIND-001/",
		Status:            "qualified",
		QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
	})
	beforeIndex := readTextFile(t, root, "system/.os/data/findings.jsonl")
	beforeRecord := readTextFile(t, root, "system/workspace/findings/FIND-001/finding.md")

	result, err := PromoteFinding(PromoteFindingOptions{
		RepoRoot:  root,
		FindingID: "FIND-001",
		Route:     "baseline-plan",
		Slug:      "dry-run-design",
		DryRun:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !result.DryRun || !strings.Contains(result.DesignPath, "dry-run-design.md") || !strings.Contains(result.DesignContent, "## Intended Follow-On") {
		t.Fatalf("unexpected result: %#v", result)
	}
	assertNotExists(t, root, result.DesignPath)
	if got := readTextFile(t, root, "system/.os/data/findings.jsonl"); got != beforeIndex {
		t.Fatalf("dry run changed findings index:\n%s", got)
	}
	if got := readTextFile(t, root, "system/workspace/findings/FIND-001/finding.md"); got != beforeRecord {
		t.Fatalf("dry run changed finding record:\n%s", got)
	}
}

func TestAtomicReplaceFileLeavesOriginalAndCleansTempOnRenameFailure(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "findings.jsonl")
	if err := os.WriteFile(path, []byte("original\n"), 0o640); err != nil {
		t.Fatal(err)
	}
	originalRename := renameAtomicFile
	renameAtomicFile = func(_, _ string) error { return errors.New("injected rename failure") }
	t.Cleanup(func() { renameAtomicFile = originalRename })

	if err := atomicReplaceFile(path, []byte("replacement\n")); err == nil || !strings.Contains(err.Error(), "injected rename failure") {
		t.Fatalf("expected injected failure, got %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != "original\n" {
		t.Fatalf("original changed: %q, %v", data, err)
	}
	matches, err := filepath.Glob(filepath.Join(root, ".findings.jsonl.tmp-*"))
	if err != nil || len(matches) != 0 {
		t.Fatalf("temporary files remain: %v, %v", matches, err)
	}
}

func TestPromoteFindingRollsBackIndexWhenFindingRecordReplacementFails(t *testing.T) {
	root := t.TempDir()
	writeQualifiedFindingFixture(t, root, findingIndexRow{
		ID: "FIND-001", Status: "qualified", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
	})
	indexPath := "system/.os/data/findings.jsonl"
	recordPath := "system/workspace/findings/FIND-001/finding.md"
	beforeIndex := readTextFile(t, root, indexPath)
	beforeRecord := readTextFile(t, root, recordPath)
	originalReplace := replaceExistingFile
	failed := false
	replaceExistingFile = func(path string, data []byte) error {
		if !failed && filepath.Base(path) == "finding.md" {
			failed = true
			return errors.New("injected finding record failure")
		}
		return originalReplace(path, data)
	}
	t.Cleanup(func() { replaceExistingFile = originalReplace })

	_, err := PromoteFinding(PromoteFindingOptions{RepoRoot: root, FindingID: "FIND-001", Route: "baseline-plan", Slug: "record-failure"})
	if err == nil || !strings.Contains(err.Error(), "injected finding record failure") {
		t.Fatalf("expected injected failure, got %v", err)
	}
	if got := readTextFile(t, root, indexPath); got != beforeIndex {
		t.Fatalf("findings index was not rolled back:\n%s", got)
	}
	if got := readTextFile(t, root, recordPath); got != beforeRecord {
		t.Fatalf("finding record changed:\n%s", got)
	}
	assertNotExists(t, root, timeStampedDesignPath("record-failure"))
}

func TestPromoteFindingRollsBackExistingFilesWhenDesignCreationFails(t *testing.T) {
	root := t.TempDir()
	writeQualifiedFindingFixture(t, root, findingIndexRow{
		ID: "FIND-001", Status: "qualified", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
	})
	indexPath := "system/.os/data/findings.jsonl"
	recordPath := "system/workspace/findings/FIND-001/finding.md"
	beforeIndex := readTextFile(t, root, indexPath)
	beforeRecord := readTextFile(t, root, recordPath)
	originalCreate := createExclusiveFile
	createExclusiveFile = func(string, []byte) error { return errors.New("injected design creation failure") }
	t.Cleanup(func() { createExclusiveFile = originalCreate })

	_, err := PromoteFinding(PromoteFindingOptions{RepoRoot: root, FindingID: "FIND-001", Route: "baseline-plan", Slug: "design-failure"})
	if err == nil || !strings.Contains(err.Error(), "injected design creation failure") {
		t.Fatalf("expected injected failure, got %v", err)
	}
	if got := readTextFile(t, root, indexPath); got != beforeIndex {
		t.Fatalf("findings index was not rolled back:\n%s", got)
	}
	if got := readTextFile(t, root, recordPath); got != beforeRecord {
		t.Fatalf("finding record was not rolled back:\n%s", got)
	}
	assertNotExists(t, root, timeStampedDesignPath("design-failure"))
}

func writeQualifiedFindingFixture(t *testing.T, root string, row findingIndexRow) {
	t.Helper()
	writeRouterInputs(t, root)
	if row.Type == "" {
		row.Type = "finding"
	}
	if row.Title == "" {
		row.Title = "Qualified finding " + row.ID
	}
	if row.Path == "" {
		row.Path = "system/workspace/findings/" + row.ID + "/"
	}
	data, err := json.Marshal(row)
	if err != nil {
		t.Fatal(err)
	}
	writeTextFile(t, root, "system/.os/data/findings.jsonl", string(data)+"\n")
	writeEmptyGovernedDatasets(t, root, "system/.os/data")
	writeTextFile(t, root, row.Path+"finding.md", "# "+row.Title+"\n\n## Finding "+row.ID+" {#finding-"+strings.ToLower(row.ID)+"}\n\n- Status: "+row.Status+"\n\n## Observation\n\nObserved.\n\n## Designs\n\nNo design hand-off recorded.\n")
	writeTextFile(t, root, row.Path+"qualification.md", "# Qualification\n\n## Confirmation Test {#confirmation-test}\n\n- Result: pass\n")
	writeTextFile(t, root, "system/workspace/runs/RUN-001/raw-findings.md", "# Raw Findings\n\n## Raw Finding 1 {#raw-finding-1}\n\nRaw.\n")
}

func writeRouterInputs(t *testing.T, root string) {
	t.Helper()
	writeTextFile(t, root, "system/docs/designs/AGENTS.md", "# Designs Router\n")
	writeTextFile(t, root, "system/docs/assets/references/design-workflow.md", "# Design Workflow\n")
	writeTextFile(t, root, "system/docs/assets/references/design-contract.md", "# Design Contract\n")
	writeTextFile(t, root, "system/docs/assets/templates/design.md", "# {{TITLE}}\n")
	writeTextFile(t, root, "system/docs/assets/prompts/designs-to-plan.prompt.md", "# Prompt\n")
	writeTextFile(t, root, "system/docs/assets/prompts/designs-to-plan-change.prompt.md", "# Prompt\n")
}

func writeEmptyGovernedDatasets(t *testing.T, root, dataDir string) {
	t.Helper()
	for _, name := range []string{"requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "extractions.jsonl"} {
		writeTextFile(t, root, filepath.ToSlash(filepath.Join(dataDir, name)), "")
	}
}

func writeInstalledSystemRoot(t *testing.T, root string) {
	t.Helper()
	for _, rel := range []string{".os", "assets", "docs", "playbooks", "workspace"} {
		if err := os.MkdirAll(filepath.Join(root, filepath.FromSlash(rel)), 0o755); err != nil {
			t.Fatal(err)
		}
	}
}

func writeInstalledRouterInputs(t *testing.T, root string) {
	t.Helper()
	writeTextFile(t, root, "docs/designs/AGENTS.md", "# Designs Router\n")
	writeTextFile(t, root, "docs/assets/references/design-workflow.md", "# Design Workflow\n")
	writeTextFile(t, root, "docs/assets/references/design-contract.md", "# Design Contract\n")
	writeTextFile(t, root, "docs/assets/templates/design.md", "# {{TITLE}}\n")
	writeTextFile(t, root, "docs/assets/prompts/designs-to-plan.prompt.md", "# Prompt\n")
	writeTextFile(t, root, "docs/assets/prompts/designs-to-plan-change.prompt.md", "# Prompt\n")
}

func readSingleFindingRow(t *testing.T, root string) findingIndexRow {
	t.Helper()
	return readSingleFindingRowAt(t, root, "system/.os/data/findings.jsonl")
}

func readSingleFindingRowAt(t *testing.T, root, rel string) findingIndexRow {
	t.Helper()
	data := readTextFile(t, root, rel)
	lines := strings.Split(strings.TrimSpace(data), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected one finding row in %s, got %d:\n%s", rel, len(lines), data)
	}
	var row findingIndexRow
	if err := json.Unmarshal([]byte(lines[0]), &row); err != nil {
		t.Fatal(err)
	}
	return row
}

func timeStampedDesignPath(slug string) string {
	return filepath.ToSlash(filepath.Join("system/docs/designs", nowUTC()[:10]+"-"+slug+".md"))
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

func assertExists(t *testing.T, root, rel string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); err != nil {
		t.Fatalf("expected %s to exist: %v", rel, err)
	}
}

func assertNotExists(t *testing.T, root, rel string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); !os.IsNotExist(err) {
		t.Fatalf("%s should not exist, err=%v", rel, err)
	}
}
