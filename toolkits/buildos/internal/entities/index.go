package entities

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"sort"
)

const IndexVersion = 1

const (
	CodeIndexStale           = "index_stale"
	CodeIndexNonReproducible = "index_non_reproducible"
)

// ResolutionIndex is the derived entity-resolution cache. Canonical JSONL is
// always authoritative; this value may be discarded and rebuilt at any time.
type ResolutionIndex struct {
	Version            int                 `json:"version"`
	CanonicalByID      map[string]string   `json:"canonical_by_id"`
	MembersByCanonical map[string][]string `json:"members_by_canonical"`
}

// IndexCheckState describes how an on-disk index compares with a canonical
// rebuild. Non-current states never mutate either canonical data or the index.
type IndexCheckState string

const (
	IndexCurrent         IndexCheckState = "current"
	IndexMissing         IndexCheckState = "missing"
	IndexStale           IndexCheckState = "stale"
	IndexMalformed       IndexCheckState = "malformed"
	IndexNonReproducible IndexCheckState = "non_reproducible"
)

// IndexCheckResult is stable data for human and JSON command output. The
// remediation command is supplied by the caller so this package never guesses
// the executable path, resolved root, or validation mode.
type IndexCheckResult struct {
	State              IndexCheckState `json:"state"`
	Current            bool            `json:"current"`
	DiagnosticCode     string          `json:"diagnostic_code,omitempty"`
	Message            string          `json:"message"`
	ExpectedSHA256     string          `json:"expected_sha256"`
	ActualSHA256       string          `json:"actual_sha256,omitempty"`
	RemediationCommand string          `json:"remediation_command,omitempty"`
}

// BuildIndex derives the complete forward and reverse projections from a
// loaded graph. It does not read a prior index. Any failed redirect resolution
// makes the build fail closed without returning a partial index.
func BuildIndex(graph *Graph) (ResolutionIndex, []Diagnostic) {
	if graph == nil {
		return ResolutionIndex{}, []Diagnostic{{
			Code:     CodeInputContract,
			Severity: SeverityError,
			Message:  "cannot build entity-resolution index without a loaded graph",
			Action:   "load and validate canonical entity JSONL before rebuilding the index",
		}}
	}

	index := newResolutionIndex()
	var diagnostics []Diagnostic
	for _, record := range graph.Records() {
		if record.Redirect == nil {
			continue
		}

		resolution, resolveDiagnostics := graph.Resolve(record.ID)
		diagnostics = append(diagnostics, resolveDiagnostics...)
		if HasErrors(resolveDiagnostics) || !resolution.Resolved || resolution.CanonicalID == "" {
			continue
		}

		index.CanonicalByID[record.ID] = resolution.CanonicalID
		index.MembersByCanonical[resolution.CanonicalID] = append(
			index.MembersByCanonical[resolution.CanonicalID],
			record.ID,
		)
	}

	if HasErrors(diagnostics) {
		return ResolutionIndex{}, diagnostics
	}
	return canonicalIndex(index), diagnostics
}

// MarshalIndex returns the canonical v1 representation: UTF-8 JSON, two-space
// indentation, lexically ordered keys and members, and one final newline.
func MarshalIndex(index ResolutionIndex) ([]byte, error) {
	canonical := canonicalIndex(index)
	if err := validateIndexShape(canonical); err != nil {
		return nil, err
	}

	encoded, err := json.MarshalIndent(canonical, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal entity-resolution index: %w", err)
	}
	return append(encoded, '\n'), nil
}

// BuildIndexBytes combines graph derivation and canonical serialization.
func BuildIndexBytes(graph *Graph) ([]byte, []Diagnostic, error) {
	index, diagnostics := BuildIndex(graph)
	if HasErrors(diagnostics) {
		return nil, diagnostics, nil
	}
	encoded, err := MarshalIndex(index)
	return encoded, diagnostics, err
}

// CheckIndex compares an existing index with a canonical rebuild. Missing,
// malformed, stale, and non-canonical-but-equivalent content are distinguished
// so callers can emit the precise contract diagnostic. No writes occur.
func CheckIndex(path string, expected ResolutionIndex, remediationCommand string) (IndexCheckResult, error) {
	expectedBytes, err := MarshalIndex(expected)
	if err != nil {
		return IndexCheckResult{}, fmt.Errorf("prepare expected entity-resolution index: %w", err)
	}

	result := IndexCheckResult{
		ExpectedSHA256:     digest(expectedBytes),
		RemediationCommand: remediationCommand,
	}
	actualBytes, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		result.State = IndexMissing
		result.DiagnosticCode = CodeIndexStale
		result.Message = "entity-resolution index is missing"
		return result, nil
	}
	if err != nil {
		return IndexCheckResult{}, fmt.Errorf("read entity-resolution index %q: %w", path, err)
	}
	result.ActualSHA256 = digest(actualBytes)

	actual, err := unmarshalIndex(actualBytes)
	if err != nil {
		result.State = IndexMalformed
		result.DiagnosticCode = CodeInputContract
		result.Message = fmt.Sprintf("entity-resolution index is malformed: %v", err)
		return result, nil
	}

	if !reflect.DeepEqual(canonicalIndex(actual), canonicalIndex(expected)) {
		result.State = IndexStale
		result.DiagnosticCode = CodeIndexStale
		result.Message = "entity-resolution index differs from the canonical graph rebuild"
		return result, nil
	}
	if !bytes.Equal(actualBytes, expectedBytes) {
		result.State = IndexNonReproducible
		result.DiagnosticCode = CodeIndexNonReproducible
		result.Message = "entity-resolution index is semantically current but not canonically serialized"
		return result, nil
	}

	result.State = IndexCurrent
	result.Current = true
	result.Message = "entity-resolution index is current and reproducible"
	result.RemediationCommand = ""
	return result, nil
}

// ApplyIndex atomically installs the canonical index bytes. It returns false
// when the existing file is already byte-identical. Existing file permissions
// are preserved; new indexes use mode 0644.
func ApplyIndex(path string, index ResolutionIndex) (bool, error) {
	encoded, err := MarshalIndex(index)
	if err != nil {
		return false, err
	}

	current, err := os.ReadFile(path)
	if err == nil && bytes.Equal(current, encoded) {
		return false, nil
	}
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return false, fmt.Errorf("read existing entity-resolution index %q: %w", path, err)
	}

	mode := os.FileMode(0o644)
	if info, statErr := os.Stat(path); statErr == nil {
		mode = info.Mode().Perm()
	} else if !errors.Is(statErr, os.ErrNotExist) {
		return false, fmt.Errorf("stat existing entity-resolution index %q: %w", path, statErr)
	}

	if err := writeIndexAtomic(path, encoded, mode); err != nil {
		return false, err
	}
	return true, nil
}

func newResolutionIndex() ResolutionIndex {
	return ResolutionIndex{
		Version:            IndexVersion,
		CanonicalByID:      make(map[string]string),
		MembersByCanonical: make(map[string][]string),
	}
}

func canonicalIndex(index ResolutionIndex) ResolutionIndex {
	canonical := newResolutionIndex()
	canonical.Version = index.Version
	for id, target := range index.CanonicalByID {
		canonical.CanonicalByID[id] = target
	}
	for id, members := range index.MembersByCanonical {
		cloned := append([]string(nil), members...)
		sort.Strings(cloned)
		canonical.MembersByCanonical[id] = cloned
	}
	return canonical
}

func unmarshalIndex(data []byte) (ResolutionIndex, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var index ResolutionIndex
	if err := decoder.Decode(&index); err != nil {
		return ResolutionIndex{}, err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return ResolutionIndex{}, fmt.Errorf("multiple JSON values")
		}
		return ResolutionIndex{}, fmt.Errorf("trailing content: %w", err)
	}
	if err := validateIndexShape(index); err != nil {
		return ResolutionIndex{}, err
	}
	return index, nil
}

func validateIndexShape(index ResolutionIndex) error {
	if index.Version != IndexVersion {
		return fmt.Errorf("version must be %d", IndexVersion)
	}
	if index.CanonicalByID == nil {
		return fmt.Errorf("canonical_by_id must be an object")
	}
	if index.MembersByCanonical == nil {
		return fmt.Errorf("members_by_canonical must be an object")
	}

	seenMembers := make(map[string]string)
	for id, canonical := range index.CanonicalByID {
		if id == "" || canonical == "" {
			return fmt.Errorf("canonical_by_id keys and values must be non-empty")
		}
		if id == canonical {
			return fmt.Errorf("canonical_by_id[%q] must not target itself", id)
		}
	}
	for canonical, members := range index.MembersByCanonical {
		if canonical == "" {
			return fmt.Errorf("members_by_canonical keys must be non-empty")
		}
		if len(members) == 0 {
			return fmt.Errorf("members_by_canonical[%q] must not be empty", canonical)
		}
		for _, member := range members {
			if member == "" {
				return fmt.Errorf("members_by_canonical[%q] contains an empty member", canonical)
			}
			if member == canonical {
				return fmt.Errorf("members_by_canonical[%q] must exclude the canonical ID", canonical)
			}
			if previous, exists := seenMembers[member]; exists {
				return fmt.Errorf("member %q appears under both %q and %q", member, previous, canonical)
			}
			seenMembers[member] = canonical
			if target, ok := index.CanonicalByID[member]; !ok || target != canonical {
				return fmt.Errorf("member %q does not map to canonical ID %q", member, canonical)
			}
		}
	}
	for member, canonical := range index.CanonicalByID {
		if seenMembers[member] != canonical {
			return fmt.Errorf("canonical_by_id member %q is absent from members_by_canonical[%q]", member, canonical)
		}
	}
	return nil
}

func writeIndexAtomic(path string, data []byte, mode os.FileMode) (returnErr error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create entity-resolution index directory %q: %w", dir, err)
	}

	temp, err := os.CreateTemp(dir, ".entity-resolution-*.tmp")
	if err != nil {
		return fmt.Errorf("create same-filesystem entity-resolution temporary file: %w", err)
	}
	tempPath := temp.Name()
	defer func() {
		_ = temp.Close()
		if removeErr := os.Remove(tempPath); returnErr == nil && removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			returnErr = fmt.Errorf("remove entity-resolution temporary file: %w", removeErr)
		}
	}()

	if err := temp.Chmod(mode.Perm()); err != nil {
		return fmt.Errorf("preserve entity-resolution index permissions: %w", err)
	}
	if _, err := temp.Write(data); err != nil {
		return fmt.Errorf("write entity-resolution temporary file: %w", err)
	}
	if err := temp.Sync(); err != nil {
		return fmt.Errorf("sync entity-resolution temporary file: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close entity-resolution temporary file: %w", err)
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("atomically replace entity-resolution index %q: %w", path, err)
	}

	directory, err := os.Open(dir)
	if err != nil {
		return fmt.Errorf("open entity-resolution index directory for sync: %w", err)
	}
	defer directory.Close()
	if err := directory.Sync(); err != nil {
		return fmt.Errorf("sync entity-resolution index directory: %w", err)
	}
	return nil
}

func digest(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
