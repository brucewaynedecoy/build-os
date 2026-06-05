package design

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
			want: "not found",
		},
		{
			name: "not qualified",
			row:  findingIndexRow{ID: "FIND-001", Path: "system/workspace/findings/FIND-001/", Status: "draft", QualificationTest: "system/workspace/findings/FIND-001/qualification.md#confirmation-test"},
			opts: PromoteFindingOptions{FindingID: "FIND-001", Route: "baseline-plan", Slug: "valid-slug"},
			want: "requires qualified",
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
			}
			tt.opts.RepoRoot = root
			_, err := PromoteFinding(tt.opts)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected %q, got %v", tt.want, err)
			}
		})
	}
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

func readSingleFindingRow(t *testing.T, root string) findingIndexRow {
	t.Helper()
	data := readTextFile(t, root, "system/.os/data/findings.jsonl")
	lines := strings.Split(strings.TrimSpace(data), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected one finding row, got %d:\n%s", len(lines), data)
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

func assertNotExists(t *testing.T, root, rel string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); !os.IsNotExist(err) {
		t.Fatalf("%s should not exist, err=%v", rel, err)
	}
}
