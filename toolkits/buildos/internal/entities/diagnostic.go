package entities

// Severity is the stable machine-readable diagnostic classification.
type Severity string

const (
	SeverityWarning Severity = "warning"
	SeverityError   Severity = "error"
)

const (
	CodeInputContract            = "input_contract"
	CodeEntityNotFound           = "entity_not_found"
	CodeLegacyMissingRedirect    = "legacy_missing_redirect"
	CodeRedirectMissingTarget    = "redirect_missing_target"
	CodeRedirectSelf             = "redirect_self"
	CodeRedirectCrossType        = "redirect_cross_type"
	CodeRedirectCycle            = "redirect_cycle"
	CodeRedirectInactiveTerminal = "redirect_inactive_terminal"
	CodeRedirectIllegalStatus    = "redirect_illegal_status"
	CodeDuplicateID              = "duplicate_id"
	CodeRedirectRemapConflict    = "redirect_remap_conflict"
)

// Diagnostic explains a contract violation and one exact corrective action.
type Diagnostic struct {
	Code     string   `json:"code"`
	Severity Severity `json:"severity"`
	Message  string   `json:"message"`
	Dataset  string   `json:"dataset,omitempty"`
	Path     string   `json:"path,omitempty"`
	Line     int      `json:"line,omitempty"`
	EntityID string   `json:"entity_id,omitempty"`
	TargetID string   `json:"target_id,omitempty"`
	Chain    []string `json:"chain,omitempty"`
	Action   string   `json:"action"`
}

// HasErrors reports whether diagnostics contain a fail-closed condition.
func HasErrors(diagnostics []Diagnostic) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Severity == SeverityError {
			return true
		}
	}
	return false
}

func diagnosticForRecord(code string, severity Severity, message string, record Record, action string) Diagnostic {
	return Diagnostic{
		Code:     code,
		Severity: severity,
		Message:  message,
		Dataset:  record.Dataset,
		Path:     record.Path,
		Line:     record.Line,
		EntityID: record.ID,
		Action:   action,
	}
}
