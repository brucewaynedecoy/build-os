package entities

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"testing"
)

func TestLoadValidateAndResolveAllGovernedTypes(t *testing.T) {
	rows := readJSONLLines(t, fixturePath(t, "valid-all-types.jsonl"))
	dataDir := writeRows(t, rows)

	graph, diagnostics := Load(dataDir)
	assertNoErrors(t, diagnostics)
	assertNoErrors(t, graph.Validate(ModeStrict))
	if got := len(graph.Records()); got != 16 {
		t.Fatalf("record count = %d, want 16", got)
	}

	wantTypes := []string{"capability", "extraction", "finding", "persona", "requirement", "result", "run", "test-case"}
	seenTypes := make(map[string]bool)
	for _, record := range graph.Records() {
		seenTypes[record.Type] = true
		if record.Redirect == nil {
			continue
		}
		result, resolveDiagnostics := graph.Resolve(record.ID)
		assertNoErrors(t, resolveDiagnostics)
		if !result.Resolved || len(result.Chain) != 2 || result.CanonicalID != record.Redirect.TargetID {
			t.Fatalf("Resolve(%s) = %#v", record.ID, result)
		}
	}
	var gotTypes []string
	for entityType := range seenTypes {
		gotTypes = append(gotTypes, entityType)
	}
	sort.Strings(gotTypes)
	if !reflect.DeepEqual(gotTypes, wantTypes) {
		t.Fatalf("types = %v, want %v", gotTypes, wantTypes)
	}

	record, ok := graph.Record("CAP-002")
	if !ok || record.Raw["x_fixture_extension"] == nil {
		t.Fatal("unknown field was not retained")
	}
	record.Raw["x_fixture_extension"][0] = 'x'
	again, _ := graph.Record("CAP-002")
	if again.Raw["x_fixture_extension"][0] == 'x' {
		t.Fatal("Record returned graph-owned raw bytes instead of a clone")
	}
}

func TestResolveZeroAndMultiHopAfterWinnerReplacement(t *testing.T) {
	dataDir := writeRows(t, readJSONLLines(t, fixturePath(t, "valid-multi-hop.jsonl")))
	graph, diagnostics := Load(dataDir)
	assertNoErrors(t, diagnostics)
	assertNoErrors(t, graph.Validate(ModeStrict))

	zero, resolveDiagnostics := graph.Resolve("PER-101")
	assertNoErrors(t, resolveDiagnostics)
	if zero.Resolved || !reflect.DeepEqual(zero.Chain, []string{"PER-101"}) || zero.CanonicalID != "PER-101" {
		t.Fatalf("zero-hop result = %#v", zero)
	}

	multi, resolveDiagnostics := graph.Resolve("PER-103")
	assertNoErrors(t, resolveDiagnostics)
	want := Resolution{RequestedID: "PER-103", CanonicalID: "PER-101", Chain: []string{"PER-103", "PER-102", "PER-101"}, Resolved: true}
	if !reflect.DeepEqual(multi, want) {
		t.Fatalf("multi-hop result = %#v, want %#v", multi, want)
	}
}

func TestInvalidGraphFixturesProduceContractDiagnostics(t *testing.T) {
	type fixtureCase struct {
		Name     string            `json:"name"`
		Records  []json.RawMessage `json:"records"`
		Manifest struct {
			Mappings []struct {
				SourceID string `json:"source_id"`
				TargetID string `json:"target_id"`
			} `json:"mappings"`
		} `json:"manifest"`
	}
	var fixture struct {
		Cases []fixtureCase `json:"cases"`
	}
	payload, err := os.ReadFile(fixturePath(t, "invalid-graph-cases.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(payload, &fixture); err != nil {
		t.Fatal(err)
	}

	wantCodes := map[string]string{
		"legacy-missing-redirect": CodeLegacyMissingRedirect,
		"missing-target":          CodeRedirectMissingTarget,
		"self-redirect":           CodeRedirectSelf,
		"cross-type":              CodeRedirectCrossType,
		"cycle":                   CodeRedirectCycle,
		"inactive-terminal":       CodeRedirectInactiveTerminal,
		"illegal-redirect-status": CodeRedirectIllegalStatus,
		"duplicate-ids":           CodeDuplicateID,
		"remap-conflict":          CodeRedirectRemapConflict,
	}

	for _, testCase := range fixture.Cases {
		t.Run(testCase.Name, func(t *testing.T) {
			graph, loadDiagnostics := Load(writeRows(t, testCase.Records))
			if testCase.Name == "duplicate-ids" {
				assertContainsCode(t, loadDiagnostics, wantCodes[testCase.Name], SeverityError)
				return
			}
			assertNoErrors(t, loadDiagnostics)
			if testCase.Name == "remap-conflict" {
				mapping := testCase.Manifest.Mappings[0]
				diagnostic := graph.CheckRedirect(mapping.SourceID, mapping.TargetID)
				if diagnostic == nil || diagnostic.Code != CodeRedirectRemapConflict || diagnostic.TargetID != mapping.TargetID {
					t.Fatalf("CheckRedirect diagnostic = %#v", diagnostic)
				}
				if same := graph.CheckRedirect(mapping.SourceID, "PER-213"); same != nil {
					t.Fatalf("idempotent mapping returned diagnostic %#v", same)
				}
				return
			}

			compat := graph.Validate(ModeCompat)
			wantSeverity := SeverityError
			if testCase.Name == "legacy-missing-redirect" {
				wantSeverity = SeverityWarning
			}
			assertContainsCode(t, compat, wantCodes[testCase.Name], wantSeverity)
			strict := graph.Validate(ModeStrict)
			assertContainsCode(t, strict, wantCodes[testCase.Name], SeverityError)

			if testCase.Name == "cycle" {
				cycle := diagnosticWithCode(t, strict, CodeRedirectCycle)
				if len(cycle.Chain) < 3 || cycle.Chain[0] != cycle.Chain[len(cycle.Chain)-1] {
					t.Fatalf("cycle chain is not complete and closed: %v", cycle.Chain)
				}
			}
		})
	}
}

func TestLoadRejectsMissingMalformedAndShapeInvalidDatasets(t *testing.T) {
	dataDir := writeRows(t, nil)
	if err := os.WriteFile(filepath.Join(dataDir, "personas.jsonl"), []byte("not-json\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(dataDir, "runs.jsonl")); err != nil {
		t.Fatal(err)
	}
	_, diagnostics := Load(dataDir)
	if countCode(diagnostics, CodeInputContract) < 2 || !HasErrors(diagnostics) {
		t.Fatalf("load diagnostics = %#v", diagnostics)
	}

	badRedirect := json.RawMessage(`{"id":"PER-900","type":"persona","status":"superseded","redirect":{"target_id":"PER-901","kind":"guessed"}}`)
	_, diagnostics = Load(writeRows(t, []json.RawMessage{badRedirect}))
	assertContainsCode(t, diagnostics, CodeInputContract, SeverityError)
}

func TestResolveFailsClosedForMissingAndLegacyEntities(t *testing.T) {
	legacy := json.RawMessage(`{"id":"PER-901","type":"persona","status":"superseded"}`)
	graph, diagnostics := Load(writeRows(t, []json.RawMessage{legacy}))
	assertNoErrors(t, diagnostics)

	if _, got := graph.Resolve("PER-999"); len(got) != 1 || got[0].Code != CodeEntityNotFound {
		t.Fatalf("missing resolution diagnostics = %#v", got)
	}
	if _, got := graph.Resolve("PER-901"); len(got) != 1 || got[0].Code != CodeLegacyMissingRedirect {
		t.Fatalf("legacy resolution diagnostics = %#v", got)
	}
}

func writeRows(t *testing.T, rows []json.RawMessage) string {
	t.Helper()
	dataDir := t.TempDir()
	contents := make(map[string][]byte)
	for _, dataset := range governedDatasets {
		contents[dataset.filename] = nil
	}
	for _, row := range rows {
		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(row, &envelope); err != nil {
			t.Fatalf("test row is not JSON: %v", err)
		}
		filename := datasetForType(t, envelope.Type)
		var compact bytes.Buffer
		if err := json.Compact(&compact, row); err != nil {
			t.Fatalf("compact test row: %v", err)
		}
		contents[filename] = append(contents[filename], compact.Bytes()...)
		contents[filename] = append(contents[filename], '\n')
	}
	for filename, content := range contents {
		if err := os.WriteFile(filepath.Join(dataDir, filename), content, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return dataDir
}

func datasetForType(t *testing.T, entityType string) string {
	t.Helper()
	for _, dataset := range governedDatasets {
		if dataset.entityType == entityType {
			return dataset.filename
		}
	}
	t.Fatalf("unknown fixture type %q", entityType)
	return ""
}

func readJSONLLines(t *testing.T, path string) []json.RawMessage {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	var rows []json.RawMessage
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		rows = append(rows, append(json.RawMessage(nil), scanner.Bytes()...))
	}
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	return rows
}

func fixturePath(t *testing.T, filename string) string {
	t.Helper()
	_, source, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot locate test source")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(source), "..", "..", "..", ".."))
	return filepath.Join(root, "system", ".os", "contracts", "examples", "entity-resolution", filename)
}

func assertNoErrors(t *testing.T, diagnostics []Diagnostic) {
	t.Helper()
	if HasErrors(diagnostics) {
		t.Fatalf("unexpected error diagnostics: %#v", diagnostics)
	}
}

func assertContainsCode(t *testing.T, diagnostics []Diagnostic, code string, severity Severity) {
	t.Helper()
	diagnostic := diagnosticWithCode(t, diagnostics, code)
	if diagnostic.Severity != severity {
		t.Fatalf("diagnostic %s severity = %s, want %s", code, diagnostic.Severity, severity)
	}
	if strings.TrimSpace(diagnostic.Action) == "" {
		t.Fatalf("diagnostic %s has no corrective action", code)
	}
}

func diagnosticWithCode(t *testing.T, diagnostics []Diagnostic, code string) Diagnostic {
	t.Helper()
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return diagnostic
		}
	}
	t.Fatalf("diagnostics %#v do not contain code %q", diagnostics, code)
	return Diagnostic{}
}

func countCode(diagnostics []Diagnostic, code string) int {
	count := 0
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			count++
		}
	}
	return count
}
