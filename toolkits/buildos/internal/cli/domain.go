package cli

import (
	"errors"
	"fmt"

	entitydomain "github.com/brucewaynedecoy/build-os/toolkits/buildos/internal/entities"
	"github.com/brucewaynedecoy/build-os/toolkits/buildos/internal/layout"
)

type domainService struct{}

var (
	canonicalDatasetWriter entitydomain.CanonicalWriteFunc
	buildResolutionIndex   = entitydomain.BuildIndex
	checkResolutionIndex   = entitydomain.CheckIndex
	applyResolutionIndex   = entitydomain.ApplyIndex
)

type validationPayload struct {
	Valid       bool                          `json:"valid"`
	RecordCount int                           `json:"record_count"`
	Index       entitydomain.IndexCheckResult `json:"index"`
}

type rebuildPayload struct {
	Before entitydomain.IndexCheckResult `json:"before"`
	After  entitydomain.IndexCheckResult `json:"after"`
}

type consolidationPayload struct {
	Consolidation   entitydomain.ConsolidationResult `json:"consolidation"`
	Index           *entitydomain.IndexCheckResult   `json:"index,omitempty"`
	RecoveryCommand string                           `json:"recovery_command,omitempty"`
}

func (domainService) Resolve(rootPath, modeValue, id string) (string, any, []Diagnostic, error) {
	root, _, graph, diagnostics, indexCheck, err := openValidatedRoot(rootPath, modeValue, true)
	if err != nil {
		return root.Path, nil, diagnostics, err
	}
	resolution, resolveDiagnostics := graph.Resolve(id)
	diagnostics = append(diagnostics, toCLIDiagnostics(resolveDiagnostics)...)
	if entitydomain.HasErrors(resolveDiagnostics) {
		return root.Path, nil, diagnostics, validationError("entity resolution failed")
	}
	payload := struct {
		entitydomain.Resolution
		Index entitydomain.IndexCheckResult `json:"index"`
	}{Resolution: resolution, Index: indexCheck}
	return root.Path, payload, diagnostics, nil
}

func (domainService) Validate(rootPath, modeValue string) (string, any, []Diagnostic, error) {
	root, _, graph, diagnostics, indexCheck, err := openValidatedRoot(rootPath, modeValue, true)
	payload := validationPayload{Valid: err == nil, Index: indexCheck}
	if graph != nil {
		payload.RecordCount = len(graph.Records())
	}
	return root.Path, payload, diagnostics, err
}

func (domainService) Consolidate(rootPath, modeValue, manifestPath string, apply bool) (string, bool, any, []Diagnostic, error) {
	root, err := layout.Resolve(rootPath)
	if err != nil {
		return "", false, nil, nil, inputError(err.Error())
	}
	mode, err := entitydomain.ParseMode(modeValue)
	if err != nil {
		return root.Path, false, nil, nil, inputError(err.Error())
	}
	result, graph, domainDiagnostics, consolidateErr := entitydomain.ConsolidateWithWriter(root.DataDir, manifestPath, mode, apply, canonicalDatasetWriter)
	diagnostics := toCLIDiagnostics(domainDiagnostics)
	payload := consolidationPayload{Consolidation: result}
	if consolidateErr != nil {
		if errors.Is(consolidateErr, entitydomain.ErrConsolidationInput) {
			return root.Path, result.Applied, payload, diagnostics, inputError(consolidateErr.Error())
		}
		if errors.Is(consolidateErr, entitydomain.ErrConsolidationConflict) {
			return root.Path, result.Applied, payload, diagnostics, validationError(consolidateErr.Error())
		}
		if errors.Is(consolidateErr, entitydomain.ErrConsolidationValidation) {
			return root.Path, result.Applied, payload, diagnostics, validationError(consolidateErr.Error())
		}
		return root.Path, result.Applied, payload, diagnostics, ioError(consolidateErr.Error())
	}
	if !apply {
		return root.Path, false, payload, diagnostics, nil
	}

	index, indexDiagnostics := buildResolutionIndex(graph)
	diagnostics = append(diagnostics, toCLIDiagnostics(indexDiagnostics)...)
	if entitydomain.HasErrors(indexDiagnostics) {
		return failedAfterCanonical(root, mode, result, payload, diagnostics, errors.New("index graph derivation failed"))
	}
	recovery := rebuildCommand(root.Path, mode)
	before, checkErr := checkResolutionIndex(root.IndexPath, index, recovery)
	if checkErr != nil {
		return failedAfterCanonical(root, mode, result, payload, diagnostics, checkErr)
	}
	indexChanged, applyErr := applyResolutionIndex(root.IndexPath, index)
	if applyErr != nil {
		payload.Index = &before
		return failedAfterCanonical(root, mode, result, payload, diagnostics, applyErr)
	}
	after, checkErr := checkResolutionIndex(root.IndexPath, index, recovery)
	if checkErr != nil {
		return failedAfterCanonical(root, mode, result, payload, diagnostics, checkErr)
	}
	payload.Index = &after
	return root.Path, result.Applied || indexChanged, payload, diagnostics, nil
}

func (domainService) RebuildIndex(rootPath, modeValue string, apply bool) (string, bool, any, []Diagnostic, error) {
	root, err := layout.Resolve(rootPath)
	if err != nil {
		return "", false, nil, nil, inputError(err.Error())
	}
	mode, err := entitydomain.ParseMode(modeValue)
	if err != nil {
		return root.Path, false, nil, nil, inputError(err.Error())
	}
	graph, domainDiagnostics := entitydomain.Load(root.DataDir)
	diagnostics := toCLIDiagnostics(domainDiagnostics)
	if graph == nil || entitydomain.HasErrors(domainDiagnostics) {
		return root.Path, false, nil, diagnostics, inputError("entity graph could not be loaded")
	}
	validationDiagnostics := graph.Validate(mode)
	diagnostics = append(diagnostics, toCLIDiagnostics(validationDiagnostics)...)
	if entitydomain.HasErrors(validationDiagnostics) {
		return root.Path, false, nil, diagnostics, validationError("entity graph is invalid")
	}
	index, buildDiagnostics := buildResolutionIndex(graph)
	diagnostics = append(diagnostics, toCLIDiagnostics(buildDiagnostics)...)
	if entitydomain.HasErrors(buildDiagnostics) {
		return root.Path, false, nil, diagnostics, validationError("entity-resolution index cannot be derived")
	}
	recovery := rebuildCommand(root.Path, mode)
	before, err := checkResolutionIndex(root.IndexPath, index, recovery)
	if err != nil {
		return root.Path, false, nil, diagnostics, ioError(err.Error())
	}
	payload := rebuildPayload{Before: before, After: before}
	if !apply {
		if !before.Current {
			diagnostics = append(diagnostics, indexDiagnostic(before, mode))
			if mode == entitydomain.ModeStrict {
				return root.Path, false, payload, diagnostics, validationError(before.Message)
			}
		}
		return root.Path, false, payload, diagnostics, nil
	}
	written, err := applyResolutionIndex(root.IndexPath, index)
	if err != nil {
		return root.Path, false, payload, diagnostics, ioError(err.Error())
	}
	after, err := checkResolutionIndex(root.IndexPath, index, recovery)
	if err != nil {
		return root.Path, written, payload, diagnostics, ioError(err.Error())
	}
	payload.After = after
	return root.Path, written, payload, diagnostics, nil
}

func openValidatedRoot(rootPath, modeValue string, validateIndex bool) (layout.Root, entitydomain.Mode, *entitydomain.Graph, []Diagnostic, entitydomain.IndexCheckResult, error) {
	root, err := layout.Resolve(rootPath)
	if err != nil {
		return layout.Root{}, "", nil, nil, entitydomain.IndexCheckResult{}, inputError(err.Error())
	}
	mode, err := entitydomain.ParseMode(modeValue)
	if err != nil {
		return root, "", nil, nil, entitydomain.IndexCheckResult{}, inputError(err.Error())
	}
	graph, loadDiagnostics := entitydomain.Load(root.DataDir)
	diagnostics := toCLIDiagnostics(loadDiagnostics)
	if graph == nil || entitydomain.HasErrors(loadDiagnostics) {
		return root, mode, graph, diagnostics, entitydomain.IndexCheckResult{}, inputError("entity graph could not be loaded")
	}
	validationDiagnostics := graph.Validate(mode)
	diagnostics = append(diagnostics, toCLIDiagnostics(validationDiagnostics)...)
	if entitydomain.HasErrors(validationDiagnostics) {
		return root, mode, graph, diagnostics, entitydomain.IndexCheckResult{}, validationError("entity graph is invalid")
	}
	if !validateIndex {
		return root, mode, graph, diagnostics, entitydomain.IndexCheckResult{}, nil
	}
	index, indexDiagnostics := buildResolutionIndex(graph)
	diagnostics = append(diagnostics, toCLIDiagnostics(indexDiagnostics)...)
	if entitydomain.HasErrors(indexDiagnostics) {
		return root, mode, graph, diagnostics, entitydomain.IndexCheckResult{}, validationError("entity-resolution index cannot be derived")
	}
	check, err := checkResolutionIndex(root.IndexPath, index, rebuildCommand(root.Path, mode))
	if err != nil {
		return root, mode, graph, diagnostics, check, ioError(err.Error())
	}
	if !check.Current {
		diagnostics = append(diagnostics, indexDiagnostic(check, mode))
		if mode == entitydomain.ModeStrict {
			return root, mode, graph, diagnostics, check, validationError(check.Message)
		}
	}
	return root, mode, graph, diagnostics, check, nil
}

func rebuildCommand(root string, mode entitydomain.Mode) string {
	return fmt.Sprintf("buildos entities rebuild-index --root %q --mode %s --apply", root, mode)
}

func indexDiagnostic(check entitydomain.IndexCheckResult, mode entitydomain.Mode) Diagnostic {
	severity := "warning"
	if mode == entitydomain.ModeStrict {
		severity = "error"
	}
	return Diagnostic{
		Code: check.DiagnosticCode, Severity: severity, Message: check.Message,
		Correction: check.RemediationCommand,
	}
}

func toCLIDiagnostics(input []entitydomain.Diagnostic) []Diagnostic {
	if input == nil {
		return nil
	}
	output := make([]Diagnostic, 0, len(input))
	for _, diagnostic := range input {
		output = append(output, Diagnostic{
			Code: diagnostic.Code, Severity: string(diagnostic.Severity), Message: diagnostic.Message,
			Dataset: diagnostic.Dataset, Line: diagnostic.Line, EntityID: diagnostic.EntityID,
			TargetID: diagnostic.TargetID, Chain: append([]string(nil), diagnostic.Chain...),
			Correction: diagnostic.Action,
		})
	}
	return output
}

func validationError(message string) error {
	return &commandError{class: classValidation, cause: errors.New(message)}
}

func inputError(message string) error {
	return &commandError{class: classInput, cause: errors.New(message)}
}

func ioError(message string) error {
	return &commandError{class: classIO, cause: errors.New(message)}
}

func committedIndexError(message string) error {
	return &commandError{class: classCommittedIndex, cause: errors.New(message)}
}

func failedAfterCanonical(root layout.Root, mode entitydomain.Mode, result entitydomain.ConsolidationResult, payload consolidationPayload, diagnostics []Diagnostic, cause error) (string, bool, any, []Diagnostic, error) {
	if !result.Applied {
		return root.Path, false, payload, diagnostics, ioError(cause.Error())
	}
	recovery := rebuildCommand(root.Path, mode)
	diagnostics = append(diagnostics, Diagnostic{
		Code: "index_stale", Severity: "error",
		Message:    fmt.Sprintf("canonical entity data was applied, but index completion failed: %v", cause),
		Correction: recovery,
	})
	payload.RecoveryCommand = recovery
	return root.Path, true, payload, diagnostics, committedIndexError("canonical write succeeded but index completion failed")
}
