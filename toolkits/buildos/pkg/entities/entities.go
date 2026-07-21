// Package entities exposes the temporary W1 R4 cross-module entity resolver.
// W1 R5 will internalize consumers after the domain modules are consolidated.
package entities

import (
	"path/filepath"

	core "github.com/brucewaynedecoy/build-os/toolkits/buildos/internal/entities"
)

type (
	Mode       = core.Mode
	Severity   = core.Severity
	Redirect   = core.Redirect
	Record     = core.Record
	Resolution = core.Resolution
	Diagnostic = core.Diagnostic
	Graph      = core.Graph
)

const (
	ModeCompat = core.ModeCompat
	ModeStrict = core.ModeStrict

	SeverityWarning = core.SeverityWarning
	SeverityError   = core.SeverityError

	CodeInputContract            = core.CodeInputContract
	CodeEntityNotFound           = core.CodeEntityNotFound
	CodeLegacyMissingRedirect    = core.CodeLegacyMissingRedirect
	CodeRedirectMissingTarget    = core.CodeRedirectMissingTarget
	CodeRedirectSelf             = core.CodeRedirectSelf
	CodeRedirectCrossType        = core.CodeRedirectCrossType
	CodeRedirectCycle            = core.CodeRedirectCycle
	CodeRedirectInactiveTerminal = core.CodeRedirectInactiveTerminal
	CodeRedirectIllegalStatus    = core.CodeRedirectIllegalStatus
	CodeDuplicateID              = core.CodeDuplicateID
	CodeRedirectRemapConflict    = core.CodeRedirectRemapConflict
)

func ParseMode(value string) (Mode, error) { return core.ParseMode(value) }

func HasErrors(diagnostics []Diagnostic) bool { return core.HasErrors(diagnostics) }

// Load reads a complete graph from an explicit .os/data directory.
func Load(dataDir string) (*Graph, []Diagnostic) { return core.Load(dataDir) }

// OpenRoot reads and validates a graph from an explicit BuildOS system root.
func OpenRoot(root string, mode Mode) (*Graph, []Diagnostic) {
	graph, diagnostics := core.Load(filepath.Join(root, ".os", "data"))
	if graph != nil {
		diagnostics = append(diagnostics, graph.Validate(mode)...)
	}
	return graph, diagnostics
}
