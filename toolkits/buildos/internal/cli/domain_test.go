package cli

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	entitydomain "github.com/brucewaynedecoy/build-os/toolkits/buildos/internal/entities"
)

func TestRealDomainValidateRebuildAndStrictGate(t *testing.T) {
	root := writeCLIRoot(t)
	var stdout, stderr bytes.Buffer
	service := domainService{}

	code := runEntities([]string{"validate", "--root", root, "--mode", "compat", "--json"}, &stdout, &stderr, BuildInfo{}, service)
	if code != ExitOK {
		t.Fatalf("compat validate exit=%d stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}
	envelope := decodeEnvelope(t, stdout.Bytes())
	if !envelope.OK || envelope.WriteStatus != WriteNotRequested || !hasCLIDiagnostic(envelope.Diagnostics, "index_stale") {
		t.Fatalf("compat envelope=%+v", envelope)
	}

	stdout.Reset()
	code = runEntities([]string{"validate", "--root", root, "--mode", "strict", "--json"}, &stdout, &stderr, BuildInfo{}, service)
	if code != ExitValidation || decodeEnvelope(t, stdout.Bytes()).OK {
		t.Fatalf("strict missing-index exit=%d stdout=%s", code, stdout.String())
	}

	stdout.Reset()
	code = runEntities([]string{"rebuild-index", "--root", root, "--mode", "compat", "--apply", "--json"}, &stdout, &stderr, BuildInfo{}, service)
	if code != ExitOK {
		t.Fatalf("rebuild exit=%d stdout=%s", code, stdout.String())
	}
	if envelope := decodeEnvelope(t, stdout.Bytes()); envelope.WriteStatus != WriteApplied || !envelope.OK {
		t.Fatalf("rebuild envelope=%+v", envelope)
	}
	if _, err := os.Stat(filepath.Join(root, ".os", "indexes", "entity-resolution.json")); err != nil {
		t.Fatalf("index not written: %v", err)
	}

	stdout.Reset()
	code = runEntities([]string{"validate", "--root", root, "--mode", "strict", "--json"}, &stdout, &stderr, BuildInfo{}, service)
	if code != ExitOK || !decodeEnvelope(t, stdout.Bytes()).OK {
		t.Fatalf("strict current-index exit=%d stdout=%s", code, stdout.String())
	}
}

func TestRealDomainConsolidationDryRun(t *testing.T) {
	root := writeCLIRoot(t)
	manifest := writeCLIManifest(t)
	personas := filepath.Join(root, ".os", "data", "personas.jsonl")
	before, _ := os.ReadFile(personas)
	var stdout, stderr bytes.Buffer
	code := runEntities([]string{"consolidate", "--root", root, "--mode", "compat", "--manifest", manifest, "--json"}, &stdout, &stderr, BuildInfo{}, domainService{})
	if code != ExitOK {
		t.Fatalf("exit=%d stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}
	envelope := decodeEnvelope(t, stdout.Bytes())
	if !envelope.OK || envelope.WriteStatus != WritePlanned {
		t.Fatalf("envelope=%+v", envelope)
	}
	after, _ := os.ReadFile(personas)
	if string(after) != string(before) {
		t.Fatal("dry run changed canonical data")
	}
}

func TestCanonicalApplyIndexFailuresUseExitSixAndRecovery(t *testing.T) {
	tests := []struct {
		name   string
		inject func()
	}{
		{
			name: "derive",
			inject: func() {
				buildResolutionIndex = func(*entitydomain.Graph) (entitydomain.ResolutionIndex, []entitydomain.Diagnostic) {
					return entitydomain.ResolutionIndex{}, []entitydomain.Diagnostic{{
						Code: "input_contract", Severity: entitydomain.SeverityError,
						Message: "injected derivation failure", Action: "rebuild after correcting the graph",
					}}
				}
			},
		},
		{
			name: "inspect",
			inject: func() {
				checkResolutionIndex = func(string, entitydomain.ResolutionIndex, string) (entitydomain.IndexCheckResult, error) {
					return entitydomain.IndexCheckResult{}, errors.New("injected inspection failure")
				}
			},
		},
		{
			name: "apply",
			inject: func() {
				applyResolutionIndex = func(string, entitydomain.ResolutionIndex) (bool, error) {
					return false, errors.New("injected index apply failure")
				}
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			originalBuild, originalCheck, originalApply := buildResolutionIndex, checkResolutionIndex, applyResolutionIndex
			t.Cleanup(func() {
				buildResolutionIndex, checkResolutionIndex, applyResolutionIndex = originalBuild, originalCheck, originalApply
			})
			test.inject()

			root := writeCLIRoot(t)
			manifest := writeCLIManifest(t)
			var stdout, stderr bytes.Buffer
			code := runEntities([]string{"consolidate", "--root", root, "--mode", "compat", "--manifest", manifest, "--apply", "--json"}, &stdout, &stderr, BuildInfo{}, domainService{})
			if code != ExitCommittedIndex {
				t.Fatalf("exit=%d stdout=%s stderr=%s", code, stdout.String(), stderr.String())
			}
			envelope := decodeEnvelope(t, stdout.Bytes())
			if envelope.OK || envelope.WriteStatus != WriteCanonicalAppliedIndexFailed {
				t.Fatalf("envelope=%+v", envelope)
			}
			recovery := "buildos entities rebuild-index --root \"" + root + "\" --mode compat --apply"
			if !hasCorrection(envelope.Diagnostics, recovery) {
				t.Fatalf("missing exact recovery %q: %+v", recovery, envelope.Diagnostics)
			}
			payload, ok := envelope.Result.(map[string]any)
			if !ok || payload["recovery_command"] != recovery {
				t.Fatalf("payload=%#v", envelope.Result)
			}
			data, err := os.ReadFile(filepath.Join(root, ".os", "data", "personas.jsonl"))
			if err != nil || !strings.Contains(string(data), "\"status\":\"superseded\"") {
				t.Fatalf("canonical write was not retained: %v %s", err, data)
			}
		})
	}
}

func TestCanonicalApplyPostWriteIndexCheckFailureUsesExitSixAndRecovery(t *testing.T) {
	originalCheck := checkResolutionIndex
	checks := 0
	checkResolutionIndex = func(path string, index entitydomain.ResolutionIndex, recovery string) (entitydomain.IndexCheckResult, error) {
		checks++
		if checks == 1 {
			return originalCheck(path, index, recovery)
		}
		return entitydomain.IndexCheckResult{}, errors.New("injected post-write index verification failure")
	}
	t.Cleanup(func() { checkResolutionIndex = originalCheck })

	root := writeCLIRoot(t)
	manifest := writeCLIManifest(t)
	var stdout, stderr bytes.Buffer
	code := runEntities([]string{"consolidate", "--root", root, "--mode", "compat", "--manifest", manifest, "--apply", "--json"}, &stdout, &stderr, BuildInfo{}, domainService{})
	if code != ExitCommittedIndex {
		t.Fatalf("exit=%d stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}
	if checks != 2 {
		t.Fatalf("index checks=%d; want pre-apply and post-apply checks", checks)
	}
	envelope := decodeEnvelope(t, stdout.Bytes())
	if envelope.OK || envelope.WriteStatus != WriteCanonicalAppliedIndexFailed {
		t.Fatalf("envelope=%+v", envelope)
	}
	recovery := "buildos entities rebuild-index --root \"" + root + "\" --mode compat --apply"
	if !hasCorrection(envelope.Diagnostics, recovery) {
		t.Fatalf("missing exact recovery %q: %+v", recovery, envelope.Diagnostics)
	}
	payload, ok := envelope.Result.(map[string]any)
	if !ok || payload["recovery_command"] != recovery {
		t.Fatalf("payload=%#v", envelope.Result)
	}
	data, err := os.ReadFile(filepath.Join(root, ".os", "data", "personas.jsonl"))
	if err != nil || !strings.Contains(string(data), "\"status\":\"superseded\"") {
		t.Fatalf("canonical write was not retained: %v %s", err, data)
	}
}

func TestCanonicalWriteFailureUsesExitFiveWithoutMutationOrRecovery(t *testing.T) {
	originalWriter := canonicalDatasetWriter
	canonicalDatasetWriter = func(string, []byte, os.FileMode) error {
		return errors.New("injected canonical temporary-file creation failure")
	}
	t.Cleanup(func() { canonicalDatasetWriter = originalWriter })

	root := writeCLIRoot(t)
	manifest := writeCLIManifest(t)
	personaPath := filepath.Join(root, ".os", "data", "personas.jsonl")
	before, err := os.ReadFile(personaPath)
	if err != nil {
		t.Fatal(err)
	}
	var stdout, stderr bytes.Buffer
	code := runEntities([]string{"consolidate", "--root", root, "--mode", "compat", "--manifest", manifest, "--apply", "--json"}, &stdout, &stderr, BuildInfo{}, domainService{})
	if code != ExitIO {
		t.Fatalf("exit=%d stdout=%s stderr=%s", code, stdout.String(), stderr.String())
	}
	envelope := decodeEnvelope(t, stdout.Bytes())
	if envelope.OK || envelope.WriteStatus == WriteCanonicalAppliedIndexFailed {
		t.Fatalf("envelope=%+v", envelope)
	}
	recovery := "buildos entities rebuild-index --root \"" + root + "\" --mode compat --apply"
	if hasCorrection(envelope.Diagnostics, recovery) {
		t.Fatalf("pre-commit failure emitted exit-6 recovery: %+v", envelope.Diagnostics)
	}
	payload, _ := envelope.Result.(map[string]any)
	if payload != nil && payload["recovery_command"] != nil {
		t.Fatalf("pre-commit failure emitted recovery payload: %#v", payload)
	}
	after, err := os.ReadFile(personaPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(after, before) {
		t.Fatal("canonical write failure changed canonical bytes")
	}
}

func TestRealDomainInputExitCode(t *testing.T) {
	var stdout, stderr bytes.Buffer
	code := runEntities([]string{"validate", "--root", filepath.Join(t.TempDir(), "missing"), "--mode", "compat", "--json"}, &stdout, &stderr, BuildInfo{}, domainService{})
	if code != ExitInput {
		t.Fatalf("exit=%d stdout=%s", code, stdout.String())
	}
}

func writeCLIRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	dataDir := filepath.Join(root, ".os", "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	files := []string{"requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"}
	for _, name := range files {
		content := []byte{}
		if name == "personas.jsonl" {
			content = []byte("{\"id\":\"PER-001\",\"type\":\"persona\",\"status\":\"active\",\"name\":\"Administrator\"}\n{\"id\":\"PER-002\",\"type\":\"persona\",\"status\":\"active\",\"name\":\"Admin\",\"x_keep\":true}\n")
		}
		if err := os.WriteFile(filepath.Join(dataDir, name), content, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func writeCLIManifest(t *testing.T) string {
	t.Helper()
	manifest := map[string]any{
		"version": 1,
		"mappings": []any{map[string]any{
			"source_id": "PER-002", "target_id": "PER-001", "kind": "duplicate",
			"decided_at": "2026-07-21T15:30:00Z", "decided_by": "reviewer",
			"reason": "same reviewed persona", "evidence_refs": []string{},
		}},
	}
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

func decodeEnvelope(t *testing.T, data []byte) Envelope {
	t.Helper()
	var envelope Envelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		t.Fatalf("decode envelope: %v\n%s", err, data)
	}
	return envelope
}

func hasCLIDiagnostic(diagnostics []Diagnostic, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return true
		}
	}
	return false
}

func hasCorrection(diagnostics []Diagnostic, correction string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Correction == correction {
			return true
		}
	}
	return false
}
