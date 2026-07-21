package entities

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var (
	ErrConsolidationInput      = errors.New("consolidation input is invalid")
	ErrConsolidationValidation = errors.New("consolidation validation failed")
	ErrConsolidationConflict   = errors.New("consolidation requires review")
	replaceCanonicalFile       = os.Rename
)

var canonicalDatasetFiles = []string{
	"requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl",
	"results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl",
}

// ConsolidationManifest is reviewed, root-independent version 1 input.
type ConsolidationManifest struct {
	Version  int                    `json:"version"`
	Mappings []ConsolidationMapping `json:"mappings"`
}

// ConsolidationMapping is one reviewed immediate-successor decision.
type ConsolidationMapping struct {
	SourceID     string   `json:"source_id"`
	TargetID     string   `json:"target_id"`
	Kind         string   `json:"kind"`
	DecidedAt    string   `json:"decided_at"`
	DecidedBy    string   `json:"decided_by"`
	Reason       string   `json:"reason"`
	EvidenceRefs []string `json:"evidence_refs"`
}

// ConsolidationChange is stable plan output for one mapping.
type ConsolidationChange struct {
	SourceID string `json:"source_id"`
	TargetID string `json:"target_id"`
	Dataset  string `json:"dataset"`
	Action   string `json:"action"`
}

// ConsolidationResult describes both a dry run and an applied operation.
type ConsolidationResult struct {
	ManifestVersion int                   `json:"manifest_version"`
	MappingCount    int                   `json:"mapping_count"`
	ChangeCount     int                   `json:"change_count"`
	NoOpCount       int                   `json:"no_op_count"`
	AffectedFiles   []string              `json:"affected_files"`
	Changes         []ConsolidationChange `json:"changes"`
	Applied         bool                  `json:"applied"`
}

// CanonicalWriteFunc installs one validated canonical dataset replacement.
// Callers may inject it to exercise I/O failure handling deterministically.
type CanonicalWriteFunc func(path string, data []byte, mode os.FileMode) error

// Consolidate preflights the whole prospective graph and optionally replaces
// changed canonical JSONL files atomically. It deliberately does not rebuild
// the derived index; the caller must do so after a successful canonical write.
// The returned graph is the validated prospective graph on dry-run and the
// freshly loaded canonical graph after apply.
func Consolidate(dataDir, manifestPath string, mode Mode, apply bool) (ConsolidationResult, *Graph, []Diagnostic, error) {
	return ConsolidateWithWriter(dataDir, manifestPath, mode, apply, nil)
}

// ConsolidateWithWriter is Consolidate with an injectable canonical write
// boundary. A nil writer uses the production same-filesystem atomic writer.
func ConsolidateWithWriter(dataDir, manifestPath string, mode Mode, apply bool, writer CanonicalWriteFunc) (ConsolidationResult, *Graph, []Diagnostic, error) {
	if writer == nil {
		writer = writeCanonicalAtomic
	}
	manifest, diagnostics, err := loadConsolidationManifest(manifestPath)
	if err != nil {
		return ConsolidationResult{}, nil, diagnostics, err
	}

	graph, loadDiagnostics := Load(dataDir)
	diagnostics = append(diagnostics, loadDiagnostics...)
	if graph == nil || HasErrors(loadDiagnostics) {
		return ConsolidationResult{}, nil, diagnostics, fmt.Errorf("%w: current graph is invalid", ErrConsolidationValidation)
	}
	validationDiagnostics := graph.Validate(mode)
	diagnostics = append(diagnostics, validationDiagnostics...)
	if HasErrors(validationDiagnostics) {
		return ConsolidationResult{}, nil, diagnostics, fmt.Errorf("%w: current graph is invalid", ErrConsolidationValidation)
	}

	result := ConsolidationResult{
		ManifestVersion: manifest.Version,
		MappingCount:    len(manifest.Mappings),
		AffectedFiles:   []string{},
		Changes:         []ConsolidationChange{},
	}
	changedRows := make(map[string]map[int]map[string]json.RawMessage)
	manifestDatasets := make(map[string]struct{})
	conflict := false
	for _, mapping := range manifest.Mappings {
		source, ok := graph.Record(mapping.SourceID)
		if !ok {
			diagnostics = append(diagnostics, Diagnostic{
				Code: CodeEntityNotFound, Severity: SeverityError,
				Message: fmt.Sprintf("manifest source entity %s does not exist", mapping.SourceID), EntityID: mapping.SourceID,
				Action: "correct source_id to a governed entity ID and repeat the dry run",
			})
			continue
		}
		target, ok := graph.Record(mapping.TargetID)
		if !ok {
			diagnostics = append(diagnostics, Diagnostic{
				Code: CodeRedirectMissingTarget, Severity: SeverityError,
				Message: fmt.Sprintf("manifest target entity %s does not exist", mapping.TargetID), Dataset: source.Dataset,
				Path: source.Path, Line: source.Line, EntityID: source.ID, TargetID: mapping.TargetID,
				Action: "correct target_id to an existing same-type entity and repeat the dry run",
			})
			continue
		}
		manifestDatasets[source.Path] = struct{}{}
		if mapping.SourceID == mapping.TargetID {
			diagnostics = append(diagnostics, Diagnostic{
				Code: CodeRedirectSelf, Severity: SeverityError, Message: fmt.Sprintf("entity %s cannot redirect to itself", source.ID),
				Dataset: source.Dataset, Path: source.Path, Line: source.Line, EntityID: source.ID, TargetID: target.ID,
				Action: "choose a different same-type target",
			})
			continue
		}
		if source.Type != target.Type {
			diagnostics = append(diagnostics, Diagnostic{
				Code: CodeRedirectCrossType, Severity: SeverityError,
				Message: fmt.Sprintf("entity %s (%s) cannot redirect to %s (%s)", source.ID, source.Type, target.ID, target.Type),
				Dataset: source.Dataset, Path: source.Path, Line: source.Line, EntityID: source.ID, TargetID: target.ID,
				Action: "choose a same-type canonical target; use related for non-canonical cross-type links",
			})
			continue
		}
		if redirectConflict := graph.CheckRedirect(source.ID, target.ID); redirectConflict != nil {
			diagnostics = append(diagnostics, *redirectConflict)
			conflict = true
			continue
		}
		change := ConsolidationChange{SourceID: source.ID, TargetID: target.ID, Dataset: source.Dataset}
		if source.Redirect != nil && source.Redirect.TargetID == target.ID {
			change.Action = "no_op"
			result.NoOpCount++
			result.Changes = append(result.Changes, change)
			continue
		}

		change.Action = "supersede"
		result.ChangeCount++
		result.Changes = append(result.Changes, change)
		if changedRows[source.Path] == nil {
			changedRows[source.Path] = make(map[int]map[string]json.RawMessage)
		}
		row := cloneRawObject(source.Raw)
		row["status"] = json.RawMessage(`"superseded"`)
		redirectBytes, marshalErr := json.Marshal(Redirect{
			TargetID: target.ID, Kind: mapping.Kind, DecidedAt: mapping.DecidedAt,
			DecidedBy: mapping.DecidedBy, Reason: mapping.Reason, EvidenceRefs: append([]string{}, mapping.EvidenceRefs...),
		})
		if marshalErr != nil {
			return ConsolidationResult{}, nil, diagnostics, fmt.Errorf("marshal redirect for %s: %w", source.ID, marshalErr)
		}
		row["redirect"] = redirectBytes
		updatedAt, _ := json.Marshal(mapping.DecidedAt)
		row["updated_at"] = updatedAt
		changedRows[source.Path][source.Line] = row
	}

	if HasErrors(diagnostics) {
		if conflict {
			return result, nil, diagnostics, ErrConsolidationConflict
		}
		return result, nil, diagnostics, ErrConsolidationValidation
	}
	if len(manifestDatasets) != 1 {
		diagnostics = append(diagnostics, Diagnostic{
			Code: CodeInputContract, Severity: SeverityError,
			Message: "version 1 consolidation mappings must affect exactly one canonical dataset",
			Action:  "split the reviewed mappings into one manifest per canonical JSONL dataset and repeat the dry run",
		})
		return result, nil, diagnostics, fmt.Errorf("%w: mappings span %d canonical datasets", ErrConsolidationConflict, len(manifestDatasets))
	}

	paths := make([]string, 0, len(changedRows))
	for path := range changedRows {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	prepared := make(map[string][]byte, len(paths))
	for _, path := range paths {
		if err := requireWithinDataDir(dataDir, path); err != nil {
			return result, nil, diagnostics, fmt.Errorf("%w: %v", ErrConsolidationValidation, err)
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return result, nil, diagnostics, fmt.Errorf("read canonical dataset %q: %w", path, readErr)
		}
		updated, updateErr := updateJSONLRows(data, changedRows[path])
		if updateErr != nil {
			return result, nil, diagnostics, fmt.Errorf("%w: update %q: %v", ErrConsolidationValidation, path, updateErr)
		}
		prepared[path] = updated
		result.AffectedFiles = append(result.AffectedFiles, filepath.Base(path))
	}
	sort.Strings(result.AffectedFiles)

	prospectiveGraph, prospectiveDiagnostics, preflightErr := preflightProspectiveGraph(dataDir, prepared, mode)
	diagnostics = append(diagnostics, prospectiveDiagnostics...)
	if preflightErr != nil {
		return result, nil, diagnostics, preflightErr
	}
	if !apply || len(prepared) == 0 {
		return result, prospectiveGraph, diagnostics, nil
	}

	for _, path := range paths {
		info, statErr := os.Stat(path)
		if statErr != nil {
			return result, nil, diagnostics, fmt.Errorf("stat canonical dataset %q: %w", path, statErr)
		}
		if writeErr := writer(path, prepared[path], info.Mode().Perm()); writeErr != nil {
			return result, nil, diagnostics, writeErr
		}
	}
	result.Applied = true
	canonicalGraph, reloadDiagnostics := Load(dataDir)
	diagnostics = append(diagnostics, reloadDiagnostics...)
	if canonicalGraph == nil || HasErrors(reloadDiagnostics) {
		return result, nil, diagnostics, fmt.Errorf("reload graph after canonical write: %w", ErrConsolidationValidation)
	}
	return result, canonicalGraph, diagnostics, nil
}

func loadConsolidationManifest(path string) (ConsolidationManifest, []Diagnostic, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		diagnostic := manifestDiagnostic(fmt.Sprintf("cannot read consolidation manifest: %v", err), "provide a readable UTF-8 JSON manifest")
		return ConsolidationManifest{}, []Diagnostic{diagnostic}, fmt.Errorf("%w: %v", ErrConsolidationInput, err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var manifest ConsolidationManifest
	if err := decoder.Decode(&manifest); err != nil {
		diagnostic := manifestDiagnostic(fmt.Sprintf("invalid consolidation manifest: %v", err), "correct the manifest to the exact version 1 contract")
		return ConsolidationManifest{}, []Diagnostic{diagnostic}, fmt.Errorf("%w: %v", ErrConsolidationInput, err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			err = errors.New("multiple JSON values")
		}
		diagnostic := manifestDiagnostic(fmt.Sprintf("invalid consolidation manifest trailing content: %v", err), "remove content after the single manifest object")
		return ConsolidationManifest{}, []Diagnostic{diagnostic}, fmt.Errorf("%w: %v", ErrConsolidationInput, err)
	}
	if manifest.Version != 1 || len(manifest.Mappings) == 0 {
		diagnostic := manifestDiagnostic("manifest version must be 1 and mappings must be a non-empty list", "set version to 1 and include at least one reviewed mapping")
		return ConsolidationManifest{}, []Diagnostic{diagnostic}, ErrConsolidationInput
	}
	seen := make(map[string]struct{}, len(manifest.Mappings))
	var diagnostics []Diagnostic
	for index, mapping := range manifest.Mappings {
		if err := validateManifestMapping(mapping); err != nil {
			diagnostics = append(diagnostics, manifestDiagnostic(fmt.Sprintf("mapping %d: %v", index+1, err), "correct the named mapping field and repeat the dry run"))
		}
		if _, exists := seen[mapping.SourceID]; exists {
			diagnostics = append(diagnostics, manifestDiagnostic(fmt.Sprintf("source_id %s occurs more than once", mapping.SourceID), "keep one reviewed immediate-target mapping per source_id"))
		}
		seen[mapping.SourceID] = struct{}{}
	}
	if HasErrors(diagnostics) {
		return ConsolidationManifest{}, diagnostics, ErrConsolidationInput
	}
	sort.SliceStable(manifest.Mappings, func(i, j int) bool { return manifest.Mappings[i].SourceID < manifest.Mappings[j].SourceID })
	return manifest, diagnostics, nil
}

func validateManifestMapping(mapping ConsolidationMapping) error {
	if strings.TrimSpace(mapping.SourceID) == "" || strings.TrimSpace(mapping.TargetID) == "" {
		return errors.New("source_id and target_id must be non-empty")
	}
	if mapping.Kind != "duplicate" && mapping.Kind != "consolidated" && mapping.Kind != "replaced" {
		return errors.New("kind must be duplicate, consolidated, or replaced")
	}
	parsed, err := time.Parse(time.RFC3339, mapping.DecidedAt)
	if err != nil {
		return errors.New("decided_at must be an ISO 8601 UTC datetime")
	}
	_, offset := parsed.Zone()
	if offset != 0 {
		return errors.New("decided_at must use UTC")
	}
	if strings.TrimSpace(mapping.DecidedBy) == "" || strings.TrimSpace(mapping.Reason) == "" {
		return errors.New("decided_by and reason must be non-empty")
	}
	if mapping.EvidenceRefs == nil {
		return errors.New("evidence_refs must be a JSON list (an empty list is allowed)")
	}
	for _, ref := range mapping.EvidenceRefs {
		if strings.TrimSpace(ref) == "" {
			return errors.New("evidence_refs entries must be non-empty")
		}
	}
	return nil
}

func manifestDiagnostic(message, action string) Diagnostic {
	return Diagnostic{Code: CodeInputContract, Severity: SeverityError, Message: message, Action: action}
}

func updateJSONLRows(data []byte, replacements map[int]map[string]json.RawMessage) ([]byte, error) {
	trailingNewline := len(data) > 0 && data[len(data)-1] == '\n'
	lines := bytes.Split(data, []byte{'\n'})
	if trailingNewline {
		lines = lines[:len(lines)-1]
	}
	for lineNumber, row := range replacements {
		if lineNumber < 1 || lineNumber > len(lines) {
			return nil, fmt.Errorf("line %d is outside the dataset", lineNumber)
		}
		encoded, err := json.Marshal(row)
		if err != nil {
			return nil, fmt.Errorf("marshal line %d: %w", lineNumber, err)
		}
		lines[lineNumber-1] = encoded
	}
	result := bytes.Join(lines, []byte{'\n'})
	if trailingNewline {
		result = append(result, '\n')
	}
	return result, nil
}

func requireWithinDataDir(dataDir, path string) error {
	dataAbs, err := filepath.Abs(dataDir)
	if err != nil {
		return err
	}
	pathAbs, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	relative, err := filepath.Rel(dataAbs, pathAbs)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return fmt.Errorf("canonical dataset %q escapes data directory %q", path, dataDir)
	}
	return nil
}

func preflightProspectiveGraph(dataDir string, changed map[string][]byte, mode Mode) (*Graph, []Diagnostic, error) {
	parent := filepath.Dir(dataDir)
	tempDir, err := os.MkdirTemp(parent, ".buildos-consolidation-preflight-*")
	if err != nil {
		return nil, nil, fmt.Errorf("create prospective graph directory: %w", err)
	}
	defer os.RemoveAll(tempDir)
	for _, name := range canonicalDatasetFiles {
		sourcePath := filepath.Join(dataDir, name)
		data, readErr := os.ReadFile(sourcePath)
		if readErr != nil {
			return nil, nil, fmt.Errorf("read prospective input %q: %w", sourcePath, readErr)
		}
		if replacement, exists := changed[sourcePath]; exists {
			data = replacement
		}
		if writeErr := os.WriteFile(filepath.Join(tempDir, name), data, 0o600); writeErr != nil {
			return nil, nil, fmt.Errorf("write prospective input %q: %w", name, writeErr)
		}
	}
	graph, diagnostics := Load(tempDir)
	if graph == nil || HasErrors(diagnostics) {
		return nil, diagnostics, fmt.Errorf("%w: prospective graph does not load", ErrConsolidationValidation)
	}
	validationDiagnostics := graph.Validate(mode)
	diagnostics = append(diagnostics, validationDiagnostics...)
	if HasErrors(validationDiagnostics) {
		return nil, diagnostics, fmt.Errorf("%w: prospective graph is invalid", ErrConsolidationValidation)
	}
	return graph, diagnostics, nil
}

func writeCanonicalAtomic(path string, data []byte, mode os.FileMode) (returnErr error) {
	directory := filepath.Dir(path)
	temp, err := os.CreateTemp(directory, ".buildos-consolidation-*.tmp")
	if err != nil {
		return fmt.Errorf("create same-filesystem canonical temporary file: %w", err)
	}
	tempPath := temp.Name()
	defer func() {
		_ = temp.Close()
		_ = os.Remove(tempPath)
	}()
	if err := temp.Chmod(mode.Perm()); err != nil {
		return fmt.Errorf("preserve canonical dataset permissions: %w", err)
	}
	if _, err := temp.Write(data); err != nil {
		return fmt.Errorf("write canonical temporary file: %w", err)
	}
	if err := temp.Sync(); err != nil {
		return fmt.Errorf("sync canonical temporary file: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close canonical temporary file: %w", err)
	}
	if err := replaceCanonicalFile(tempPath, path); err != nil {
		return fmt.Errorf("atomically replace canonical dataset %q: %w", path, err)
	}
	dirHandle, err := os.Open(directory)
	if err != nil {
		return fmt.Errorf("open canonical directory for sync: %w", err)
	}
	defer dirHandle.Close()
	if err := dirHandle.Sync(); err != nil {
		return fmt.Errorf("sync canonical directory: %w", err)
	}
	return nil
}
