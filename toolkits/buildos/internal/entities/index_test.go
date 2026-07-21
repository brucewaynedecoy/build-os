package entities

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildIndexFlattensMultiHopGraph(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	for _, dataset := range governedDatasets {
		payload := ""
		if dataset.filename == "personas.jsonl" {
			payload = strings.Join([]string{
				`{"id":"PER-101","type":"persona","status":"active"}`,
				`{"id":"PER-102","type":"persona","status":"superseded","redirect":{"target_id":"PER-101","kind":"duplicate","decided_at":"2026-07-21T15:30:00Z","decided_by":"reviewer","reason":"same persona","evidence_refs":[]}}`,
				`{"id":"PER-103","type":"persona","status":"superseded","redirect":{"target_id":"PER-102","kind":"consolidated","decided_at":"2026-07-21T15:31:00Z","decided_by":"reviewer","reason":"same persona","evidence_refs":[]}}`,
			}, "\n") + "\n"
		}
		if err := os.WriteFile(filepath.Join(dataDir, dataset.filename), []byte(payload), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	graph, diagnostics := Load(dataDir)
	if HasErrors(diagnostics) {
		t.Fatalf("Load() diagnostics = %#v", diagnostics)
	}
	if diagnostics = graph.Validate(ModeStrict); HasErrors(diagnostics) {
		t.Fatalf("Validate() diagnostics = %#v", diagnostics)
	}

	index, diagnostics := BuildIndex(graph)
	if HasErrors(diagnostics) {
		t.Fatalf("BuildIndex() diagnostics = %#v", diagnostics)
	}
	want := personaResolutionIndex()
	gotBytes, err := MarshalIndex(index)
	if err != nil {
		t.Fatal(err)
	}
	wantBytes, err := MarshalIndex(want)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(gotBytes, wantBytes) {
		t.Fatalf("BuildIndex() =\n%s\nwant:\n%s", gotBytes, wantBytes)
	}

	for iteration := 0; iteration < 50; iteration++ {
		rebuilt, buildDiagnostics, err := BuildIndexBytes(graph)
		if err != nil || HasErrors(buildDiagnostics) {
			t.Fatalf("BuildIndexBytes() iteration %d error = %v, diagnostics = %#v", iteration, err, buildDiagnostics)
		}
		if !bytes.Equal(rebuilt, gotBytes) {
			t.Fatalf("BuildIndexBytes() iteration %d was not byte-identical", iteration)
		}
	}
}

func TestMarshalIndexCanonicalAndReproducible(t *testing.T) {
	t.Parallel()

	index := ResolutionIndex{
		Version: IndexVersion,
		CanonicalByID: map[string]string{
			"PER-103": "PER-101",
			"PER-102": "PER-101",
		},
		MembersByCanonical: map[string][]string{
			"PER-101": {"PER-103", "PER-102"},
		},
	}
	want := []byte("{\n  \"version\": 1,\n  \"canonical_by_id\": {\n    \"PER-102\": \"PER-101\",\n    \"PER-103\": \"PER-101\"\n  },\n  \"members_by_canonical\": {\n    \"PER-101\": [\n      \"PER-102\",\n      \"PER-103\"\n    ]\n  }\n}\n")

	first, err := MarshalIndex(index)
	if err != nil {
		t.Fatalf("MarshalIndex() error = %v", err)
	}
	if !bytes.Equal(first, want) {
		t.Fatalf("MarshalIndex() =\n%s\nwant:\n%s", first, want)
	}

	for iteration := 0; iteration < 100; iteration++ {
		got, err := MarshalIndex(index)
		if err != nil {
			t.Fatalf("MarshalIndex() iteration %d error = %v", iteration, err)
		}
		if !bytes.Equal(got, first) {
			t.Fatalf("MarshalIndex() iteration %d was not byte-identical", iteration)
		}
	}
}

func TestCheckIndexStatesAndDoesNotWrite(t *testing.T) {
	t.Parallel()

	expected := personaResolutionIndex()
	expectedBytes, err := MarshalIndex(expected)
	if err != nil {
		t.Fatal(err)
	}
	remediation := "/tmp/staged/buildos entities rebuild-index --root '/tmp/copied root' --mode strict --apply"

	tests := []struct {
		name string
		data []byte
		want IndexCheckState
		code string
	}{
		{name: "current", data: expectedBytes, want: IndexCurrent},
		{
			name: "stale",
			data: []byte("{\n  \"version\": 1,\n  \"canonical_by_id\": {\n    \"PER-102\": \"PER-101\",\n    \"PER-103\": \"PER-102\"\n  },\n  \"members_by_canonical\": {\n    \"PER-101\": [\"PER-102\"],\n    \"PER-102\": [\"PER-103\"]\n  }\n}\n"),
			want: IndexStale,
			code: "index_stale",
		},
		{
			name: "non reproducible",
			data: []byte("{\"version\":1,\"members_by_canonical\":{\"PER-101\":[\"PER-103\",\"PER-102\"]},\"canonical_by_id\":{\"PER-103\":\"PER-101\",\"PER-102\":\"PER-101\"}}\n"),
			want: IndexNonReproducible,
			code: "index_non_reproducible",
		},
		{name: "malformed JSON", data: []byte("{not-json\n"), want: IndexMalformed, code: "input_contract"},
		{name: "malformed schema", data: []byte("{\"version\":1,\"canonical_by_id\":{},\"members_by_canonical\":{},\"extra\":true}\n"), want: IndexMalformed, code: "input_contract"},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			path := filepath.Join(t.TempDir(), "entity-resolution.json")
			if err := os.WriteFile(path, test.data, 0o644); err != nil {
				t.Fatal(err)
			}
			before := append([]byte(nil), test.data...)

			result, err := CheckIndex(path, expected, remediation)
			if err != nil {
				t.Fatalf("CheckIndex() error = %v", err)
			}
			if result.State != test.want {
				t.Fatalf("CheckIndex() state = %q, want %q; message = %s", result.State, test.want, result.Message)
			}
			if result.DiagnosticCode != test.code {
				t.Fatalf("CheckIndex() diagnostic = %q, want %q", result.DiagnosticCode, test.code)
			}
			if test.want == IndexCurrent {
				if !result.Current || result.RemediationCommand != "" {
					t.Fatalf("current result = %#v", result)
				}
			} else if result.Current || result.RemediationCommand != remediation {
				t.Fatalf("non-current result = %#v", result)
			}

			after, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(after, before) {
				t.Fatal("CheckIndex() modified the index")
			}
		})
	}

	t.Run("missing", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "entity-resolution.json")
		result, err := CheckIndex(path, expected, remediation)
		if err != nil {
			t.Fatalf("CheckIndex() error = %v", err)
		}
		if result.State != IndexMissing || result.DiagnosticCode != "index_stale" || result.RemediationCommand != remediation {
			t.Fatalf("CheckIndex() missing result = %#v", result)
		}
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("CheckIndex() created a missing index: %v", err)
		}
	})
}

func TestApplyIndexAtomicIdempotentAndPermissionPreserving(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), ".os", "indexes", "entity-resolution.json")
	index := personaResolutionIndex()

	changed, err := ApplyIndex(path, index)
	if err != nil {
		t.Fatalf("ApplyIndex() first error = %v", err)
	}
	if !changed {
		t.Fatal("ApplyIndex() first changed = false, want true")
	}
	want, err := MarshalIndex(index)
	if err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("applied bytes =\n%s\nwant:\n%s", got, want)
	}

	changed, err = ApplyIndex(path, index)
	if err != nil {
		t.Fatalf("ApplyIndex() idempotent error = %v", err)
	}
	if changed {
		t.Fatal("ApplyIndex() idempotent changed = true, want false")
	}

	if err := os.Chmod(path, 0o640); err != nil {
		t.Fatal(err)
	}
	index.CanonicalByID["PER-104"] = "PER-101"
	index.MembersByCanonical["PER-101"] = append(index.MembersByCanonical["PER-101"], "PER-104")
	changed, err = ApplyIndex(path, index)
	if err != nil {
		t.Fatalf("ApplyIndex() replacement error = %v", err)
	}
	if !changed {
		t.Fatal("ApplyIndex() replacement changed = false, want true")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if gotMode := info.Mode().Perm(); gotMode != 0o640 {
		t.Fatalf("ApplyIndex() mode = %o, want 640", gotMode)
	}
	temps, err := filepath.Glob(filepath.Join(filepath.Dir(path), ".entity-resolution-*.tmp"))
	if err != nil {
		t.Fatal(err)
	}
	if len(temps) != 0 {
		t.Fatalf("ApplyIndex() left temporary files: %v", temps)
	}
}

func TestMarshalIndexRejectsInconsistentShape(t *testing.T) {
	t.Parallel()

	_, err := MarshalIndex(ResolutionIndex{
		Version:            IndexVersion,
		CanonicalByID:      map[string]string{"PER-102": "PER-101"},
		MembersByCanonical: map[string][]string{"PER-101": {"PER-999"}},
	})
	if err == nil {
		t.Fatal("MarshalIndex() error = nil, want inconsistent projection error")
	}
}

func personaResolutionIndex() ResolutionIndex {
	return ResolutionIndex{
		Version: IndexVersion,
		CanonicalByID: map[string]string{
			"PER-102": "PER-101",
			"PER-103": "PER-101",
		},
		MembersByCanonical: map[string][]string{
			"PER-101": {"PER-102", "PER-103"},
		},
	}
}
