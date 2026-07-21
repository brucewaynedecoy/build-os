package entities

import (
	"fmt"
	"strings"
)

// Resolve follows zero or more immediate-successor edges to one active record.
func (g *Graph) Resolve(id string) (Resolution, []Diagnostic) {
	requested := id
	record, ok := g.records[id]
	if !ok {
		return Resolution{}, []Diagnostic{{
			Code: CodeEntityNotFound, Severity: SeverityError,
			Message: fmt.Sprintf("requested entity %s does not exist", requested), EntityID: requested,
			Action: "use an existing governed entity ID or restore the missing canonical row",
		}}
	}
	if record.Status == "superseded" && record.Redirect == nil {
		return Resolution{}, []Diagnostic{diagnosticForRecord(
			CodeLegacyMissingRedirect, SeverityError,
			fmt.Sprintf("superseded entity %s has no reviewed successor", record.ID), record,
			"review the record and add one complete redirect to a same-type successor",
		)}
	}

	chain, terminal, cycle, valid := g.trace(id)
	if cycle != nil {
		cycle = canonicalCycle(cycle)
		diagnostic := diagnosticForRecord(CodeRedirectCycle, SeverityError, fmt.Sprintf("redirect cycle detected: %s", strings.Join(cycle, " -> ")), record, "review the cycle and remove or replace at least one redirect so the chain reaches one active record")
		diagnostic.Chain = cycle
		return Resolution{}, []Diagnostic{diagnostic}
	}
	if !valid {
		return Resolution{}, g.pathDiagnostics(record, chain)
	}
	if terminal.Status != "active" {
		if terminal.Status == "superseded" && terminal.Redirect == nil {
			return Resolution{}, []Diagnostic{diagnosticForRecord(
				CodeLegacyMissingRedirect, SeverityError,
				fmt.Sprintf("redirect chain from %s reaches superseded entity %s without a reviewed successor", requested, terminal.ID), terminal,
				"review the terminal record and add one complete redirect to a same-type successor",
			)}
		}
		diagnostic := diagnosticForRecord(CodeRedirectInactiveTerminal, SeverityError, fmt.Sprintf("resolution of %s terminates at %s with status %s", requested, terminal.ID, terminal.Status), record, "review the chain and redirect it to a terminal active record")
		diagnostic.TargetID = terminal.ID
		diagnostic.Chain = chain
		return Resolution{}, []Diagnostic{diagnostic}
	}
	return Resolution{RequestedID: requested, CanonicalID: terminal.ID, Chain: chain, Resolved: len(chain) > 1}, nil
}

func (g *Graph) pathDiagnostics(source Record, chain []string) []Diagnostic {
	current := source
	for current.Redirect != nil {
		targetID := current.Redirect.TargetID
		if targetID == current.ID {
			diagnostic := diagnosticForRecord(CodeRedirectSelf, SeverityError, fmt.Sprintf("entity %s redirects to itself", current.ID), current, "choose a different active same-type successor")
			diagnostic.TargetID = targetID
			diagnostic.Chain = append([]string(nil), chain...)
			return []Diagnostic{diagnostic}
		}
		target, ok := g.records[targetID]
		if !ok {
			diagnostic := diagnosticForRecord(CodeRedirectMissingTarget, SeverityError, fmt.Sprintf("entity %s redirects to missing target %s", current.ID, targetID), current, "restore the target record or review a different existing same-type successor")
			diagnostic.TargetID = targetID
			diagnostic.Chain = append([]string(nil), chain...)
			return []Diagnostic{diagnostic}
		}
		if target.Type != source.Type {
			diagnostic := diagnosticForRecord(CodeRedirectCrossType, SeverityError, fmt.Sprintf("entity %s (%s) redirects to %s (%s)", current.ID, current.Type, target.ID, target.Type), current, "remove the redirect and use related for a non-canonical cross-type relationship")
			diagnostic.TargetID = targetID
			diagnostic.Chain = append([]string(nil), chain...)
			return []Diagnostic{diagnostic}
		}
		if current.Status != "superseded" {
			diagnostic := diagnosticForRecord(CodeRedirectIllegalStatus, SeverityError, fmt.Sprintf("entity %s has status %s but carries redirect", current.ID, current.Status), current, "remove redirect or change the record to superseded through a reviewed consolidation")
			diagnostic.TargetID = targetID
			diagnostic.Chain = append([]string(nil), chain...)
			return []Diagnostic{diagnostic}
		}
		current = target
	}
	return []Diagnostic{diagnosticForRecord(CodeInputContract, SeverityError, fmt.Sprintf("entity %s could not be resolved", source.ID), source, "validate the complete graph and repair every reported redirect error")}
}
