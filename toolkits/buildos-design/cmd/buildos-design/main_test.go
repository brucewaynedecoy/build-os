package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestUsageIncludesPromoteFindingCommand(t *testing.T) {
	usage := captureFileOutput(t, printUsage)
	if !strings.Contains(usage, "buildos-design promote finding") {
		t.Fatalf("usage missing promote finding command:\n%s", usage)
	}
}

func TestPromoteFindingCommandWritesDesignAndFindingBackRefs(t *testing.T) {
	root := t.TempDir()
	writeCommandRouterInputs(t, root)
	writeCommandFindingFixture(t, root)

	stdout, err := captureStdout(t, func() error {
		return run([]string{
			"promote", "finding",
			"--repo-root", root,
			"--finding-id", "FIND-001",
			"--route", "baseline-plan",
			"--title", "Payment Retry Repair",
			"--slug", "payment-retry-repair",
		})
	})
	if err != nil {
		t.Fatal(err)
	}

	designRelPath := "system/docs/designs/" + time.Now().Format("2006-01-02") + "-payment-retry-repair.md"
	if !strings.Contains(stdout, "wrote "+designRelPath+" (FIND-001)") {
		t.Fatalf("stdout=%q", stdout)
	}
	design := readCommandTextFile(t, root, designRelPath)
	for _, want := range []string{
		"# Payment Retry Repair",
		"qualified finding `FIND-001`",
		"- Route: `baseline-plan`",
		"[designs-to-plan.prompt.md](../assets/prompts/designs-to-plan.prompt.md)",
		"- Systems: primary-system",
	} {
		if !strings.Contains(design, want) {
			t.Fatalf("design missing %q:\n%s", want, design)
		}
	}

	index := readCommandTextFile(t, root, "system/.os/data/findings.jsonl")
	if !strings.Contains(index, designRelPath) {
		t.Fatalf("findings index missing design path:\n%s", index)
	}
	finding := readCommandTextFile(t, root, "system/workspace/findings/FIND-001/finding.md")
	if !strings.Contains(finding, "../../../docs/designs/"+filepath.Base(designRelPath)) {
		t.Fatalf("finding record missing relative design link:\n%s", finding)
	}
}

func TestPromoteFindingCommandDryRunDoesNotWrite(t *testing.T) {
	root := t.TempDir()
	writeCommandRouterInputs(t, root)
	writeCommandFindingFixture(t, root)

	stdout, err := captureStdout(t, func() error {
		return run([]string{
			"promote", "finding",
			"--repo-root", root,
			"--finding-id", "FIND-001",
			"--route", "change-plan",
			"--title", "Payment Retry Change",
			"--slug", "payment-retry-change",
			"--dry-run",
		})
	})
	if err != nil {
		t.Fatal(err)
	}

	designRelPath := "system/docs/designs/" + time.Now().Format("2006-01-02") + "-payment-retry-change.md"
	if !strings.Contains(stdout, "would write "+designRelPath+" (FIND-001)") {
		t.Fatalf("stdout=%q", stdout)
	}
	assertCommandNotExists(t, root, designRelPath)
	index := readCommandTextFile(t, root, "system/.os/data/findings.jsonl")
	if strings.Contains(index, designRelPath) {
		t.Fatalf("dry-run mutated findings index:\n%s", index)
	}
	finding := readCommandTextFile(t, root, "system/workspace/findings/FIND-001/finding.md")
	if !strings.Contains(finding, "No design hand-off recorded.") {
		t.Fatalf("dry-run mutated finding record:\n%s", finding)
	}
}

func TestPromoteFindingCommandRequiresRouterInputs(t *testing.T) {
	root := t.TempDir()
	writeCommandFindingFixture(t, root)

	_, err := captureStdout(t, func() error {
		return run([]string{
			"promote", "finding",
			"--repo-root", root,
			"--finding-id", "FIND-001",
			"--route", "baseline-plan",
		})
	})
	if err == nil || !strings.Contains(err.Error(), "read design router") {
		t.Fatalf("expected missing router input error, got %v", err)
	}
}

func writeCommandRouterInputs(t *testing.T, root string) {
	t.Helper()
	files := map[string]string{
		"system/docs/designs/AGENTS.md":                               "# Designs Router\n",
		"system/docs/assets/references/design-workflow.md":            "# Design Workflow\n",
		"system/docs/assets/references/design-contract.md":            "# Design Contract\n",
		"system/docs/assets/templates/design.md":                      "# {{TITLE}}\n",
		"system/docs/assets/prompts/designs-to-plan.prompt.md":        "baseline prompt\n",
		"system/docs/assets/prompts/designs-to-plan-change.prompt.md": "change prompt\n",
	}
	for rel, body := range files {
		writeCommandTextFile(t, root, rel, body)
	}
}

func writeCommandFindingFixture(t *testing.T, root string) {
	t.Helper()
	row := map[string]any{
		"id":                    "FIND-001",
		"type":                  "finding",
		"path":                  "system/workspace/findings/FIND-001/",
		"title":                 "Qualified finding FIND-001",
		"status":                "qualified",
		"summary":               "Finding qualified from run RUN-001.",
		"observed":              "Payment retry behavior was deterministically confirmed.",
		"basis_refs":            []string{"RUN-001", "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1"},
		"confidence":            "high",
		"implications":          []string{},
		"outcome":               "positive",
		"polarity":              "positive",
		"run_id":                "RUN-001",
		"origin_run":            "RUN-001",
		"raw_anchor":            "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		"qualification_test":    "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
		"confirmation_test":     "system/workspace/findings/FIND-001/confirmation-test/001-confirm.spec.ts",
		"confirmation_evidence": "system/workspace/findings/FIND-001/evidence/001-confirm.txt",
		"systems":               []string{"primary-system"},
		"environments":          []string{"baseline"},
		"owners":                []string{"adopter-team"},
		"qualified_at":          "2026-06-05T00:00:00Z",
		"designs":               []string{},
		"source_anchor":         "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
		"doc_anchor":            "system/docs/prd/10-discovery-runs-and-qualification.md#finding-qualification",
		"source_refs":           []string{"system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1"},
		"related":               []string{"RUN-001"},
		"created_at":            "2026-06-05T00:00:00Z",
		"updated_at":            "2026-06-05T00:00:00Z",
	}
	data, err := json.Marshal(row)
	if err != nil {
		t.Fatal(err)
	}
	writeCommandTextFile(t, root, "system/.os/data/findings.jsonl", string(data)+"\n")
	writeCommandTextFile(t, root, "system/workspace/findings/FIND-001/finding.md", "# Qualified finding FIND-001\n\n## Designs\n\nNo design hand-off recorded.\n")
	writeCommandTextFile(t, root, "system/workspace/findings/FIND-001/qualification.md", "# Qualification\n\n## Confirmation Test {#confirmation-test}\n")
	writeCommandTextFile(t, root, "system/workspace/runs/RUN-001/raw-findings.md", "## Raw Finding 1 {#raw-finding-1}\n")
}

func writeCommandTextFile(t *testing.T, root, rel, body string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func readCommandTextFile(t *testing.T, root, rel string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func assertCommandNotExists(t *testing.T, root, rel string) {
	t.Helper()
	if _, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel))); !os.IsNotExist(err) {
		t.Fatalf("expected %s to not exist, err=%v", rel, err)
	}
}

func captureStdout(t *testing.T, fn func() error) (string, error) {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	runErr := fn()
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	os.Stdout = old
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	return string(data), runErr
}

func captureFileOutput(t *testing.T, fn func(*os.File)) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	fn(w)
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	os.Stdout = old
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
