package entities

import (
	"fmt"
	"sort"
	"strings"
)

// Validate checks local redirect rules and every complete redirect chain.
func (g *Graph) Validate(mode Mode) []Diagnostic {
	if g == nil {
		return []Diagnostic{{Code: CodeInputContract, Severity: SeverityError, Message: "entity graph is nil", Action: "load all governed entity datasets before validation"}}
	}
	if mode != ModeCompat && mode != ModeStrict {
		return []Diagnostic{{Code: CodeInputContract, Severity: SeverityError, Message: fmt.Sprintf("unsupported entity validation mode %q", mode), Action: "use compatibility mode compat or release-gate mode strict"}}
	}

	var diagnostics []Diagnostic
	records := g.Records()
	for _, record := range records {
		if !isLegalLifecycleStatus(record) {
			diagnostic := diagnosticForRecord(CodeInputContract, SeverityError, fmt.Sprintf("entity %s has unsupported status %q", record.ID, record.Status), record, lifecycleStatusAction(record))
			diagnostics = append(diagnostics, diagnostic)
			continue
		}
		if record.Status == "superseded" && record.Redirect == nil {
			severity := SeverityWarning
			if mode == ModeStrict {
				severity = SeverityError
			}
			diagnostics = append(diagnostics, diagnosticForRecord(
				CodeLegacyMissingRedirect, severity,
				fmt.Sprintf("superseded entity %s has no reviewed successor", record.ID), record,
				"review the record and add one complete redirect to a same-type successor",
			))
			continue
		}
		if record.Status != "superseded" && record.Redirect != nil {
			diagnostic := diagnosticForRecord(
				CodeRedirectIllegalStatus, SeverityError,
				fmt.Sprintf("entity %s has status %s but carries redirect", record.ID, record.Status), record,
				"remove redirect or change the record to superseded through a reviewed consolidation",
			)
			diagnostic.TargetID = record.Redirect.TargetID
			diagnostics = append(diagnostics, diagnostic)
			continue
		}
		if record.Redirect == nil {
			continue
		}
		if record.Redirect.TargetID == record.ID {
			diagnostic := diagnosticForRecord(CodeRedirectSelf, SeverityError, fmt.Sprintf("entity %s redirects to itself", record.ID), record, "choose a different active same-type successor")
			diagnostic.TargetID = record.ID
			diagnostic.Chain = []string{record.ID, record.ID}
			diagnostics = append(diagnostics, diagnostic)
			continue
		}
		target, ok := g.records[record.Redirect.TargetID]
		if !ok {
			diagnostic := diagnosticForRecord(CodeRedirectMissingTarget, SeverityError, fmt.Sprintf("entity %s redirects to missing target %s", record.ID, record.Redirect.TargetID), record, "restore the target record or review a different existing same-type successor")
			diagnostic.TargetID = record.Redirect.TargetID
			diagnostic.Chain = []string{record.ID, record.Redirect.TargetID}
			diagnostics = append(diagnostics, diagnostic)
			continue
		}
		if target.Type != record.Type {
			diagnostic := diagnosticForRecord(CodeRedirectCrossType, SeverityError, fmt.Sprintf("entity %s (%s) redirects to %s (%s)", record.ID, record.Type, target.ID, target.Type), record, "remove the redirect and use related for a non-canonical cross-type relationship")
			diagnostic.TargetID = target.ID
			diagnostic.Chain = []string{record.ID, target.ID}
			diagnostics = append(diagnostics, diagnostic)
		}
	}

	diagnostics = append(diagnostics, g.validateChains()...)
	sortDiagnostics(diagnostics)
	return diagnostics
}

func (g *Graph) validateChains() []Diagnostic {
	var diagnostics []Diagnostic
	seenCycles := make(map[string]bool)
	for _, source := range g.Records() {
		if source.Redirect == nil || source.Status != "superseded" {
			continue
		}
		chain, terminal, cycle, valid := g.trace(source.ID)
		if cycle != nil {
			canonical := canonicalCycle(cycle)
			key := strings.Join(canonical, "\x00")
			if !seenCycles[key] {
				seenCycles[key] = true
				diagnostic := diagnosticForRecord(CodeRedirectCycle, SeverityError, fmt.Sprintf("redirect cycle detected: %s", strings.Join(canonical, " -> ")), source, "review the cycle and remove or replace at least one redirect so the chain reaches one active record")
				diagnostic.Chain = canonical
				diagnostics = append(diagnostics, diagnostic)
			}
			continue
		}
		if !valid || terminal.ID == "" {
			continue
		}
		if !isTerminalCanonical(terminal) {
			diagnostic := diagnosticForRecord(CodeRedirectInactiveTerminal, SeverityError, fmt.Sprintf("redirect chain from %s terminates at %s with status %s", source.ID, terminal.ID, terminal.Status), source, "review the chain and redirect it to a current same-type terminal record")
			diagnostic.TargetID = terminal.ID
			diagnostic.Chain = chain
			diagnostics = append(diagnostics, diagnostic)
		}
	}
	return diagnostics
}

// trace returns a full chain, its terminal, a closed cycle when found, and
// whether every traversed edge exists and remains same-type.
func (g *Graph) trace(start string) ([]string, Record, []string, bool) {
	chain := make([]string, 0, 4)
	positions := make(map[string]int)
	currentID := start
	startRecord, ok := g.records[start]
	if !ok {
		return nil, Record{}, nil, false
	}
	for {
		if position, visited := positions[currentID]; visited {
			cycle := append([]string(nil), chain[position:]...)
			cycle = append(cycle, currentID)
			return chain, Record{}, cycle, false
		}
		positions[currentID] = len(chain)
		chain = append(chain, currentID)
		record, exists := g.records[currentID]
		if !exists {
			return chain, Record{}, nil, false
		}
		if record.Redirect == nil {
			return chain, record, nil, true
		}
		if record.Status != "superseded" || record.Redirect.TargetID == record.ID {
			return chain, Record{}, nil, false
		}
		target, exists := g.records[record.Redirect.TargetID]
		if !exists || target.Type != startRecord.Type {
			return append(chain, record.Redirect.TargetID), Record{}, nil, false
		}
		currentID = record.Redirect.TargetID
	}
}

func canonicalCycle(closed []string) []string {
	if len(closed) < 2 {
		return append([]string(nil), closed...)
	}
	cycle := append([]string(nil), closed[:len(closed)-1]...)
	minimum := 0
	for index := 1; index < len(cycle); index++ {
		if cycle[index] < cycle[minimum] {
			minimum = index
		}
	}
	rotated := append(append([]string(nil), cycle[minimum:]...), cycle[:minimum]...)
	rotated = append(rotated, rotated[0])
	return rotated
}

// CheckRedirect detects an idempotent replay or an attempted implicit remap.
// A nil diagnostic means the proposed immediate successor does not conflict.
func (g *Graph) CheckRedirect(sourceID, targetID string) *Diagnostic {
	source, ok := g.records[sourceID]
	if !ok || source.Redirect == nil || source.Redirect.TargetID == targetID {
		return nil
	}
	diagnostic := diagnosticForRecord(
		CodeRedirectRemapConflict, SeverityError,
		fmt.Sprintf("entity %s already redirects to %s; requested target is %s", sourceID, source.Redirect.TargetID, targetID),
		source,
		"submit a separate reviewed redirect-change decision; do not overwrite the existing successor implicitly",
	)
	diagnostic.TargetID = targetID
	diagnostic.Chain = []string{sourceID, source.Redirect.TargetID, targetID}
	return &diagnostic
}

func sortedRecordIDs(records map[string]Record) []string {
	ids := make([]string, 0, len(records))
	for id := range records {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}
