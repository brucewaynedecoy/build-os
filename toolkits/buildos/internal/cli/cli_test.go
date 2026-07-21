package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

type fakeService struct {
	root        string
	mode        string
	id          string
	manifest    string
	apply       bool
	written     bool
	payload     any
	diagnostics []Diagnostic
	err         error
}

func (f *fakeService) Resolve(root, mode, id string) (string, any, []Diagnostic, error) {
	f.root, f.mode, f.id = root, mode, id
	return root, f.payload, f.diagnostics, f.err
}
func (f *fakeService) Validate(root, mode string) (string, any, []Diagnostic, error) {
	f.root, f.mode = root, mode
	return root, f.payload, f.diagnostics, f.err
}
func (f *fakeService) Consolidate(root, mode, manifest string, apply bool) (string, bool, any, []Diagnostic, error) {
	f.root, f.mode, f.manifest, f.apply = root, mode, manifest, apply
	return root, f.written, f.payload, f.diagnostics, f.err
}
func (f *fakeService) RebuildIndex(root, mode string, apply bool) (string, bool, any, []Diagnostic, error) {
	f.root, f.mode, f.apply = root, mode, apply
	return root, f.written, f.payload, f.diagnostics, f.err
}

func TestRunHelpAndVersion(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := Run([]string{"help"}, &stdout, &stderr, BuildInfo{}); code != ExitOK {
		t.Fatalf("help exit = %d", code)
	}
	if !strings.Contains(stdout.String(), "buildos entities") {
		t.Fatalf("help missing entities surface: %s", stdout.String())
	}

	stdout.Reset()
	if code := Run([]string{"version", "--json"}, &stdout, &stderr, BuildInfo{}); code != ExitOK {
		t.Fatalf("version exit = %d", code)
	}
	var envelope Envelope
	if err := json.Unmarshal(stdout.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Version != "dev" || envelope.SourceRevision != "unknown" {
		t.Fatalf("unexpected source defaults: %+v", envelope)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(stdout.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	expectedKeys := []string{"ok", "command", "version", "source_revision", "root", "mode", "write_status", "result", "diagnostics"}
	if len(raw) != len(expectedKeys) {
		t.Fatalf("envelope keys=%v", raw)
	}
	for _, key := range expectedKeys {
		if _, ok := raw[key]; !ok {
			t.Fatalf("missing envelope key %q: %v", key, raw)
		}
	}

	stdout.Reset()
	if code := Run([]string{"version"}, &stdout, &stderr, BuildInfo{}); code != ExitOK {
		t.Fatalf("human version exit=%d", code)
	}
	for _, want := range []string{"root: not_applicable", "mode: not_applicable", "write status: not_requested"} {
		if !strings.Contains(stdout.String(), want) {
			t.Fatalf("human version missing %q: %s", want, stdout.String())
		}
	}
}

func TestResolveJSONEnvelopeAndForwarding(t *testing.T) {
	service := &fakeService{payload: map[string]any{
		"requested_id": "PER-041", "canonical_id": "PER-003",
		"chain": []string{"PER-041", "PER-003"}, "resolved": true,
	}}
	var stdout, stderr bytes.Buffer
	code := runEntities([]string{"resolve", "--root", "/tmp/root", "--mode", "compat", "--id", "PER-041", "--json"}, &stdout, &stderr, BuildInfo{Version: "0.1.0", SourceRevision: "abc123"}, service)
	if code != ExitOK {
		t.Fatalf("exit = %d, stderr=%s", code, stderr.String())
	}
	if service.root != "/tmp/root" || service.mode != "compat" || service.id != "PER-041" {
		t.Fatalf("options not forwarded: %+v", service)
	}
	var envelope Envelope
	if err := json.Unmarshal(stdout.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Command != "entities.resolve" || envelope.Version != "0.1.0" || envelope.SourceRevision != "abc123" {
		t.Fatalf("unexpected envelope: %+v", envelope)
	}
	if envelope.WriteStatus != WriteNotRequested || envelope.Diagnostics == nil {
		t.Fatalf("unexpected stable fields: %+v", envelope)
	}
}

func TestConsolidateDryRunAndApplyStatus(t *testing.T) {
	for _, test := range []struct {
		name        string
		args        []string
		written     bool
		writeStatus string
	}{
		{name: "dry-run", args: []string{"consolidate", "--root", "/tmp/root", "--mode", "strict", "--manifest", "review.json", "--json"}, writeStatus: WritePlanned},
		{name: "apply", args: []string{"consolidate", "--root", "/tmp/root", "--mode", "strict", "--manifest", "review.json", "--apply", "--json"}, written: true, writeStatus: WriteApplied},
	} {
		t.Run(test.name, func(t *testing.T) {
			service := &fakeService{written: test.written, payload: map[string]any{"changed": test.written}}
			var stdout, stderr bytes.Buffer
			if code := runEntities(test.args, &stdout, &stderr, BuildInfo{}, service); code != ExitOK {
				t.Fatalf("exit = %d, stderr=%s", code, stderr.String())
			}
			var envelope Envelope
			if err := json.Unmarshal(stdout.Bytes(), &envelope); err != nil {
				t.Fatal(err)
			}
			if envelope.WriteStatus != test.writeStatus {
				t.Fatalf("write status = %+v", envelope.WriteStatus)
			}
		})
	}
}

func TestUsageAndClassifiedErrors(t *testing.T) {
	var stdout, stderr bytes.Buffer
	if code := runEntities([]string{"validate", "--mode", "compat", "--json"}, &stdout, &stderr, BuildInfo{}, &fakeService{}); code != ExitUsage {
		t.Fatalf("usage exit = %d", code)
	}
	var envelope Envelope
	if err := json.Unmarshal(stdout.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Diagnostics[0].Code != "usage_error" {
		t.Fatalf("diagnostic = %+v", envelope.Diagnostics)
	}

	stdout.Reset()
	service := &fakeService{err: &commandError{class: classValidation, cause: errors.New("review required")}, diagnostics: []Diagnostic{{Code: "redirect_remap_conflict", Severity: "error", Message: "review required"}}}
	if code := runEntities([]string{"consolidate", "--root", "/tmp/root", "--mode", "compat", "--manifest", "review.json", "--apply", "--json"}, &stdout, &stderr, BuildInfo{}, service); code != ExitValidation {
		t.Fatalf("conflict exit = %d", code)
	}
}

func TestRebuildIndexRejectsMutuallyExclusiveModes(t *testing.T) {
	_, err := parseEntityOptions("rebuild-index", []string{"--root", "/tmp/root", "--mode", "strict", "--check", "--apply"})
	if err == nil || !strings.Contains(err.Error(), "mutually exclusive") {
		t.Fatalf("error = %v", err)
	}
}

func TestRebuildIndexWriteStatusDistinguishesPlanAndCheck(t *testing.T) {
	for _, test := range []struct {
		name   string
		extra  []string
		status string
	}{
		{name: "default plan", status: WritePlanned},
		{name: "explicit check", extra: []string{"--check"}, status: WriteNotRequested},
	} {
		t.Run(test.name, func(t *testing.T) {
			args := []string{"rebuild-index", "--root", "/tmp/root", "--mode", "compat", "--json"}
			args = append(args, test.extra...)
			var stdout, stderr bytes.Buffer
			if code := runEntities(args, &stdout, &stderr, BuildInfo{}, &fakeService{}); code != ExitOK {
				t.Fatalf("exit=%d stderr=%s", code, stderr.String())
			}
			var envelope Envelope
			if err := json.Unmarshal(stdout.Bytes(), &envelope); err != nil {
				t.Fatal(err)
			}
			if envelope.WriteStatus != test.status {
				t.Fatalf("write_status=%s", envelope.WriteStatus)
			}
		})
	}
}
