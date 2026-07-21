package design

import (
	"fmt"

	entityresolver "github.com/brucewaynedecoy/build-os/toolkits/buildos/pkg/entities"
)

type findingResolution struct {
	RequestedID string
	CanonicalID string
	Chain       []string
}

func resolveFinding(layout buildOSLayout, requestedID string) (findingResolution, error) {
	entityRoot := layout.repoRoot
	if !layout.installedRoot {
		entityRoot = layout.path("system")
	}
	graph, diagnostics := entityresolver.OpenRoot(entityRoot, entityresolver.ModeStrict)
	if graph == nil || entityresolver.HasErrors(diagnostics) {
		return findingResolution{}, fmt.Errorf("finding entity graph is invalid: %s", formatEntityDiagnostics(diagnostics))
	}
	resolution, diagnostics := graph.Resolve(requestedID)
	if entityresolver.HasErrors(diagnostics) {
		return findingResolution{}, fmt.Errorf("resolve finding %s: %s", requestedID, formatEntityDiagnostics(diagnostics))
	}
	return findingResolution{RequestedID: resolution.RequestedID, CanonicalID: resolution.CanonicalID, Chain: append([]string(nil), resolution.Chain...)}, nil
}

func formatEntityDiagnostics(diagnostics []entityresolver.Diagnostic) string {
	if len(diagnostics) == 0 {
		return "unknown graph error"
	}
	message := diagnostics[0].Code + ": " + diagnostics[0].Message
	if diagnostics[0].Action != "" {
		message += "; " + diagnostics[0].Action
	}
	return message
}
