package entities

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type governedDataset struct {
	filename   string
	entityType string
}

var governedDatasets = []governedDataset{
	{filename: "requirements.jsonl", entityType: "requirement"},
	{filename: "capabilities.jsonl", entityType: "capability"},
	{filename: "personas.jsonl", entityType: "persona"},
	{filename: "test-cases.jsonl", entityType: "test-case"},
	{filename: "results.jsonl", entityType: "result"},
	{filename: "runs.jsonl", entityType: "run"},
	{filename: "findings.jsonl", entityType: "finding"},
	{filename: "extractions.jsonl", entityType: "extraction"},
}

type recordLocation struct {
	dataset string
	path    string
	line    int
}

// Load reads every governed JSONL dataset from dataDir into one graph.
// Syntactic, shape, and duplicate-ID failures are returned as diagnostics.
func Load(dataDir string) (*Graph, []Diagnostic) {
	graph := &Graph{records: make(map[string]Record)}
	var diagnostics []Diagnostic
	locations := make(map[string][]recordLocation)

	for _, dataset := range governedDatasets {
		path := filepath.Join(dataDir, dataset.filename)
		file, err := os.Open(path)
		if err != nil {
			diagnostics = append(diagnostics, Diagnostic{
				Code: CodeInputContract, Severity: SeverityError,
				Message: fmt.Sprintf("cannot read governed dataset %s: %v", dataset.filename, err),
				Dataset: dataset.filename, Path: path,
				Action: fmt.Sprintf("restore a readable JSONL dataset at %s", path),
			})
			continue
		}

		scanner := bufio.NewScanner(file)
		buffer := make([]byte, 64*1024)
		scanner.Buffer(buffer, 16*1024*1024)
		line := 0
		for scanner.Scan() {
			line++
			payload := append([]byte(nil), scanner.Bytes()...)
			if len(bytes.TrimSpace(payload)) == 0 {
				diagnostics = append(diagnostics, inputDiagnostic(dataset.filename, path, line, "blank JSONL row", "remove the blank line or replace it with one complete JSON object"))
				continue
			}
			record, recordDiagnostics := decodeRecord(payload, dataset, path, line)
			diagnostics = append(diagnostics, recordDiagnostics...)
			if record.ID != "" {
				locations[record.ID] = append(locations[record.ID], recordLocation{dataset: dataset.filename, path: path, line: line})
			}
			if HasErrors(recordDiagnostics) {
				continue
			}
			if _, exists := graph.records[record.ID]; !exists {
				graph.records[record.ID] = record
			}
		}
		if err := scanner.Err(); err != nil {
			diagnostics = append(diagnostics, inputDiagnostic(dataset.filename, path, line, fmt.Sprintf("read JSONL: %v", err), "repair the dataset so every row can be read completely"))
		}
		_ = file.Close()
	}

	ids := make([]string, 0, len(locations))
	for id := range locations {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		occurrences := locations[id]
		if len(occurrences) < 2 {
			continue
		}
		parts := make([]string, 0, len(occurrences))
		for _, occurrence := range occurrences {
			parts = append(parts, fmt.Sprintf("%s:%d", occurrence.path, occurrence.line))
		}
		message := fmt.Sprintf("entity ID %s occurs more than once: %s", id, strings.Join(parts, ", "))
		for _, occurrence := range occurrences {
			diagnostics = append(diagnostics, Diagnostic{
				Code: CodeDuplicateID, Severity: SeverityError, Message: message,
				Dataset: occurrence.dataset, Path: occurrence.path, Line: occurrence.line, EntityID: id,
				Action: "assign one globally unique stable ID to each governed entity row",
			})
		}
	}

	sortDiagnostics(diagnostics)
	return graph, diagnostics
}

func decodeRecord(payload []byte, dataset governedDataset, path string, line int) (Record, []Diagnostic) {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(payload, &object); err != nil {
		return Record{}, []Diagnostic{inputDiagnostic(dataset.filename, path, line, fmt.Sprintf("invalid JSON object: %v", err), "replace the row with one complete JSON object")}
	}
	if object == nil {
		return Record{}, []Diagnostic{inputDiagnostic(dataset.filename, path, line, "JSONL row must be an object", "replace the row with one complete JSON object")}
	}

	var record Record
	var diagnostics []Diagnostic
	for key, destination := range map[string]*string{"id": &record.ID, "type": &record.Type, "status": &record.Status} {
		raw, ok := object[key]
		if !ok || json.Unmarshal(raw, destination) != nil || strings.TrimSpace(*destination) == "" {
			diagnostics = append(diagnostics, inputDiagnostic(dataset.filename, path, line, fmt.Sprintf("field %q must be a non-empty string", key), fmt.Sprintf("set %s to the value required by the entity records contract", key)))
		}
	}
	record.Dataset = dataset.filename
	record.Path = path
	record.Line = line
	record.Raw = cloneRawObject(object)

	if record.Type != "" && record.Type != dataset.entityType {
		diagnostics = append(diagnostics, inputDiagnostic(dataset.filename, path, line, fmt.Sprintf("record type %q does not match dataset type %q", record.Type, dataset.entityType), fmt.Sprintf("move the row to its governed dataset or set type to %q", dataset.entityType)))
	}

	if raw, ok := object["redirect"]; ok {
		if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			diagnostics = append(diagnostics, inputDiagnostic(dataset.filename, path, line, "redirect must be an object, not null", "remove redirect or provide the complete redirect object"))
		} else {
			redirect, redirectDiagnostics := decodeRedirect(raw, record)
			record.Redirect = redirect
			diagnostics = append(diagnostics, redirectDiagnostics...)
		}
	}
	return record, diagnostics
}

func decodeRedirect(payload []byte, record Record) (*Redirect, []Diagnostic) {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(payload, &object); err != nil || object == nil {
		return nil, []Diagnostic{inputDiagnostic(record.Dataset, record.Path, record.Line, "redirect must be a JSON object", "replace redirect with the complete contract object")}
	}
	allowed := map[string]bool{"target_id": true, "kind": true, "decided_at": true, "decided_by": true, "reason": true, "evidence_refs": true}
	var diagnostics []Diagnostic
	for key := range object {
		if !allowed[key] {
			diagnostics = append(diagnostics, inputDiagnostic(record.Dataset, record.Path, record.Line, fmt.Sprintf("redirect contains unknown field %q", key), "remove the field; redirect objects contain exactly the six contract fields"))
		}
	}
	redirect := &Redirect{}
	for key, destination := range map[string]*string{
		"target_id": &redirect.TargetID, "kind": &redirect.Kind, "decided_at": &redirect.DecidedAt,
		"decided_by": &redirect.DecidedBy, "reason": &redirect.Reason,
	} {
		raw, ok := object[key]
		if !ok || json.Unmarshal(raw, destination) != nil || strings.TrimSpace(*destination) == "" {
			diagnostics = append(diagnostics, inputDiagnostic(record.Dataset, record.Path, record.Line, fmt.Sprintf("redirect.%s must be a non-empty string", key), fmt.Sprintf("set redirect.%s to the value required by the entity records contract", key)))
		}
	}
	if raw, ok := object["evidence_refs"]; !ok || json.Unmarshal(raw, &redirect.EvidenceRefs) != nil || redirect.EvidenceRefs == nil {
		diagnostics = append(diagnostics, inputDiagnostic(record.Dataset, record.Path, record.Line, "redirect.evidence_refs must be an array of strings", "set redirect.evidence_refs to an array, which may be empty only when no evidence exists"))
	}
	if redirect.Kind != "" && redirect.Kind != "duplicate" && redirect.Kind != "consolidated" && redirect.Kind != "replaced" {
		diagnostics = append(diagnostics, inputDiagnostic(record.Dataset, record.Path, record.Line, fmt.Sprintf("redirect.kind %q is not allowed", redirect.Kind), "set redirect.kind to duplicate, consolidated, or replaced"))
	}
	return redirect, diagnostics
}

func inputDiagnostic(dataset, path string, line int, message, action string) Diagnostic {
	return Diagnostic{Code: CodeInputContract, Severity: SeverityError, Message: message, Dataset: dataset, Path: path, Line: line, Action: action}
}

func sortDiagnostics(diagnostics []Diagnostic) {
	sort.SliceStable(diagnostics, func(i, j int) bool {
		left, right := diagnostics[i], diagnostics[j]
		if left.Path != right.Path {
			return left.Path < right.Path
		}
		if left.Line != right.Line {
			return left.Line < right.Line
		}
		if left.EntityID != right.EntityID {
			return left.EntityID < right.EntityID
		}
		return left.Code < right.Code
	})
}
