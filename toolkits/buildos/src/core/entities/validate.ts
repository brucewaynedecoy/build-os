/**
 * Compatibility and strict validation, ported from the Go seed
 * (`internal/entities/validator.go`). It checks local redirect rules and
 * every complete redirect chain. In `compat` mode a superseded record with
 * no redirect is a warning; in `strict` mode it is an error.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { goQuote } from "../shared/go-quote.ts";
import type { EntityGraph } from "./graph.ts";
import { canonicalCycle, trace } from "./resolve.ts";
import {
  CODE,
  diagnosticForRecord,
  isLegalLifecycleStatus,
  isTerminalCanonical,
  lifecycleStatusAction,
  sortDiagnostics,
  type EntityDiagnostic,
  type Mode,
} from "./types.ts";

/** Go `Graph.Validate`. */
export function validateGraph(graph: EntityGraph, mode: Mode): EntityDiagnostic[] {
  if (mode !== "compat" && mode !== "strict") {
    return [{ code: CODE.inputContract, severity: "error", message: `unsupported entity validation mode ${goQuote(mode)}`, action: "use compatibility mode compat or release-gate mode strict" }];
  }
  const diagnostics: EntityDiagnostic[] = [];
  for (const record of graph.records()) {
    if (!isLegalLifecycleStatus(record)) {
      diagnostics.push(diagnosticForRecord(CODE.inputContract, "error", `entity ${record.id} has unsupported status ${goQuote(record.status)}`, record, lifecycleStatusAction(record)));
      continue;
    }
    if (record.status === "superseded" && record.redirect === undefined) {
      diagnostics.push(
        diagnosticForRecord(
          CODE.legacyMissingRedirect,
          mode === "strict" ? "error" : "warning",
          `superseded entity ${record.id} has no reviewed successor`,
          record,
          "review the record and add one complete redirect to a same-type successor",
        ),
      );
      continue;
    }
    if (record.status !== "superseded" && record.redirect !== undefined) {
      const diagnostic = diagnosticForRecord(
        CODE.redirectIllegalStatus,
        "error",
        `entity ${record.id} has status ${record.status} but carries redirect`,
        record,
        "remove redirect or change the record to superseded through a reviewed consolidation",
      );
      diagnostic.target_id = record.redirect.target_id;
      diagnostics.push(diagnostic);
      continue;
    }
    if (record.redirect === undefined) continue;
    const targetId = record.redirect.target_id;
    if (targetId === record.id) {
      const diagnostic = diagnosticForRecord(CODE.redirectSelf, "error", `entity ${record.id} redirects to itself`, record, "choose a different active same-type successor");
      diagnostic.target_id = record.id;
      diagnostic.chain = [record.id, record.id];
      diagnostics.push(diagnostic);
      continue;
    }
    const target = graph.record(targetId);
    if (target === undefined) {
      const diagnostic = diagnosticForRecord(
        CODE.redirectMissingTarget,
        "error",
        `entity ${record.id} redirects to missing target ${targetId}`,
        record,
        "restore the target record or review a different existing same-type successor",
      );
      diagnostic.target_id = targetId;
      diagnostic.chain = [record.id, targetId];
      diagnostics.push(diagnostic);
      continue;
    }
    if (target.type !== record.type) {
      const diagnostic = diagnosticForRecord(
        CODE.redirectCrossType,
        "error",
        `entity ${record.id} (${record.type}) redirects to ${target.id} (${target.type})`,
        record,
        "remove the redirect and use related for a non-canonical cross-type relationship",
      );
      diagnostic.target_id = target.id;
      diagnostic.chain = [record.id, target.id];
      diagnostics.push(diagnostic);
    }
  }
  diagnostics.push(...validateChains(graph));
  sortDiagnostics(diagnostics);
  return diagnostics;
}

/** Go `validateChains`. */
function validateChains(graph: EntityGraph): EntityDiagnostic[] {
  const diagnostics: EntityDiagnostic[] = [];
  const seenCycles = new Set<string>();
  for (const source of graph.records()) {
    if (source.redirect === undefined || source.status !== "superseded") continue;
    const traced = trace(graph, source.id);
    if (traced.cycle !== undefined) {
      const canonical = canonicalCycle(traced.cycle);
      const key = canonical.join("\0");
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        const diagnostic = diagnosticForRecord(
          CODE.redirectCycle,
          "error",
          `redirect cycle detected: ${canonical.join(" -> ")}`,
          source,
          "review the cycle and remove or replace at least one redirect so the chain reaches one active record",
        );
        diagnostic.chain = canonical;
        diagnostics.push(diagnostic);
      }
      continue;
    }
    if (!traced.valid || traced.terminal === undefined || traced.terminal.id === "") continue;
    if (!isTerminalCanonical(traced.terminal)) {
      const diagnostic = diagnosticForRecord(
        CODE.redirectInactiveTerminal,
        "error",
        `redirect chain from ${source.id} terminates at ${traced.terminal.id} with status ${traced.terminal.status}`,
        source,
        "review the chain and redirect it to a current same-type terminal record",
      );
      diagnostic.target_id = traced.terminal.id;
      diagnostic.chain = traced.chain;
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}

/**
 * Go `Graph.CheckRedirect`: an attempted implicit remap of an existing
 * redirect, or undefined for a new or an idempotent one.
 */
export function checkRedirect(graph: EntityGraph, sourceId: string, targetId: string): EntityDiagnostic | undefined {
  const source = graph.record(sourceId);
  if (source === undefined || source.redirect === undefined || source.redirect.target_id === targetId) return undefined;
  const diagnostic = diagnosticForRecord(
    CODE.redirectRemapConflict,
    "error",
    `entity ${sourceId} already redirects to ${source.redirect.target_id}; requested target is ${targetId}`,
    source,
    "submit a separate reviewed redirect-change decision; do not overwrite the existing successor implicitly",
  );
  diagnostic.target_id = targetId;
  diagnostic.chain = [sourceId, source.redirect.target_id, targetId];
  return diagnostic;
}
