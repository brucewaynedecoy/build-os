package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRunIndexPlaybooksCommand(t *testing.T) {
	root := t.TempDir()
	writeCommandTestPlaybook(t, root, "system/playbooks/testing/sample.md")
	output := filepath.Join(root, "custom", "playbooks.json")

	stdout, err := captureStdout(t, func() error {
		return run([]string{"index", "playbooks", "--repo-root", root, "--playbooks-root", "system/playbooks", "--output", output})
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stdout, "wrote "+output+" (1 playbooks)") {
		t.Fatalf("stdout=%q", stdout)
	}
	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`"version": 1`, `"playbooks":`, `"runnable_playbooks":`, `"id": "PB-001"`, `"path": "system/playbooks/testing/sample.md"`} {
		if !strings.Contains(string(data), want) {
			t.Fatalf("missing %q in\n%s", want, string(data))
		}
	}
}

func TestUsageIncludesPlaybooksIndex(t *testing.T) {
	usage := captureFileOutput(t, printUsage)
	if !strings.Contains(usage, "buildos-intake index playbooks") {
		t.Fatalf("usage missing playbooks command:\n%s", usage)
	}
}

func writeCommandTestPlaybook(t *testing.T, root, rel string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	body := `---
id: PB-001
title: Sample playbook
category: testing
execution_mode: explicit-steps
state_nature: standing
status: active
audience: both
harness: [shell]
systems: []
environments: []
owners: []
targets: []
produces: [run-record]
source_anchor: null
version: 1.0.0
related: []
---
# Sample
`
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
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	fn(w)
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}
