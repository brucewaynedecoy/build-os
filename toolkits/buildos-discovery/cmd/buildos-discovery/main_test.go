package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos-discovery/internal/discovery"
)

func TestUsageIncludesDiscoveryCommands(t *testing.T) {
	usage := captureFileOutput(t, printUsage)
	for _, want := range []string{
		"buildos-discovery run discovery",
		"buildos-discovery qualify finding",
	} {
		if !strings.Contains(usage, want) {
			t.Fatalf("usage missing %q:\n%s", want, usage)
		}
	}
}

func TestRunDiscoveryCommand(t *testing.T) {
	root := t.TempDir()
	writeCommandDiscoveryIndex(t, root)
	writeCommandTextFile(t, root, "inputs/raw.md", "raw finding")

	stdout, err := captureStdout(t, func() error {
		return run([]string{
			"run", "discovery",
			"--repo-root", root,
			"--playbook-id", "PB-010",
			"--outcome", "positive",
			"--raw-finding", "inputs/raw.md",
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stdout, "wrote ") || !strings.Contains(stdout, "RUN-001") {
		t.Fatalf("stdout=%q", stdout)
	}
}

func TestQualifyFindingCommand(t *testing.T) {
	root := t.TempDir()
	writeCommandDiscoveryIndex(t, root)
	writeCommandTextFile(t, root, "inputs/raw.md", "raw finding")
	if _, err := captureStdout(t, func() error {
		return run([]string{
			"run", "discovery",
			"--repo-root", root,
			"--playbook-id", "PB-010",
			"--outcome", "negative",
			"--raw-finding", "inputs/raw.md",
		})
	}); err != nil {
		t.Fatal(err)
	}
	writeCommandTextFile(t, root, "tests/confirm.spec.ts", "test('negative assertion', async () => {})")
	writeCommandTextFile(t, root, "evidence/confirmation.txt", "passed")

	stdout, err := captureStdout(t, func() error {
		return run([]string{
			"qualify", "finding",
			"--repo-root", root,
			"--run-id", "RUN-001",
			"--raw-finding-ref", "#raw-finding-1",
			"--outcome", "negative",
			"--confirmation-test", "tests/confirm.spec.ts",
			"--confirmation-evidence", "evidence/confirmation.txt",
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stdout, "wrote ") || !strings.Contains(stdout, "FIND-001") {
		t.Fatalf("stdout=%q", stdout)
	}
}

func writeCommandDiscoveryIndex(t *testing.T, root string) {
	t.Helper()
	playbook := discovery.PlaybookEntry{
		ID:            "PB-010",
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
	index := discovery.PlaybookIndex{
		Version:           1,
		Playbooks:         []discovery.PlaybookEntry{playbook},
		RunnablePlaybooks: []discovery.PlaybookEntry{playbook},
	}
	data, err := jsonMarshal(index)
	if err != nil {
		t.Fatal(err)
	}
	writeCommandTextFile(t, root, "system/.os/indexes/playbooks.json", string(data)+"\n")
}

func jsonMarshal(value any) ([]byte, error) {
	return json.Marshal(value)
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
