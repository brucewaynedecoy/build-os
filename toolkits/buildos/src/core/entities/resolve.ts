/**
 * Terminal resolution, ported from the Go seed (`internal/entities/resolver.go`
 * and the chain walk in `validator.go`). It follows zero or more
 * immediate-successor edges to one current record, and fails closed with one
 * diagnostic when it cannot.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { goCompare } from "../shared/go-json.ts";
import type { EntityGraph } from "./graph.ts";
import { CODE, diagnosticForRecord, isTerminalCanonical, type EntityDiagnostic, type EntityRecord, type Resolution } from "./types.ts";

/** The zero `Resolution`, as Go returns it with a failure. */
export const NO_RESOLUTION: Resolution = { requested_id: "", canonical_id: "", chain: null, resolved: false };

export interface Trace {
  chain: string[];
  /** The terminal record, or undefined (Go's zero `Record`). */
  terminal: EntityRecord | undefined;
  /** A closed cycle, when one was found. */
  cycle: string[] | undefined;
  /** True when every traversed edge exists and stays the same type. */
  valid: boolean;
}

/** Go `trace`. */
export function trace(graph: EntityGraph, start: string): Trace {
  const chain: string[] = [];
  const positions = new Map<string, number>();
  const startRecord = graph.record(start);
  if (startRecord === undefined) return { chain: [], terminal: undefined, cycle: undefined, valid: false };
  let currentId = start;
  for (;;) {
    const position = positions.get(currentId);
    if (position !== undefined) {
      return { chain, terminal: undefined, cycle: [...chain.slice(position), currentId], valid: false };
    }
    positions.set(currentId, chain.length);
    chain.push(currentId);
    const record = graph.record(currentId);
    if (record === undefined) return { chain, terminal: undefined, cycle: undefined, valid: false };
    if (record.redirect === undefined) return { chain, terminal: record, cycle: undefined, valid: true };
    if (record.status !== "superseded" || record.redirect.target_id === record.id) return { chain, terminal: undefined, cycle: undefined, valid: false };
    const target = graph.record(record.redirect.target_id);
    if (target === undefined || target.type !== startRecord.type) {
      return { chain: [...chain, record.redirect.target_id], terminal: undefined, cycle: undefined, valid: false };
    }
    currentId = record.redirect.target_id;
  }
}

/** Go `canonicalCycle`: the cycle rotated to start at its smallest ID, closed again. */
export function canonicalCycle(closed: readonly string[]): string[] {
  if (closed.length < 2) return [...closed];
  const cycle = closed.slice(0, -1);
  let minimum = 0;
  for (let i = 1; i < cycle.length; i++) if (goCompare(cycle[i]!, cycle[minimum]!) < 0) minimum = i;
  const rotated = [...cycle.slice(minimum), ...cycle.slice(0, minimum)];
  return [...rotated, rotated[0]!];
}

/** Go `Graph.Resolve`. */
export function resolveEntity(graph: EntityGraph, id: string): { resolution: Resolution; diagnostics: EntityDiagnostic[] } {
  const fail = (diagnostics: EntityDiagnostic[]) => ({ resolution: NO_RESOLUTION, diagnostics });
  const record = graph.record(id);
  if (record === undefined) {
    return fail([
      {
        code: CODE.entityNotFound,
        severity: "error",
        message: `requested entity ${id} does not exist`,
        entity_id: id,
        action: "use an existing governed entity ID or restore the missing canonical row",
      },
    ]);
  }
  if (record.status === "superseded" && record.redirect === undefined) {
    return fail([
      diagnosticForRecord(
        CODE.legacyMissingRedirect,
        "error",
        `superseded entity ${record.id} has no reviewed successor`,
        record,
        "review the record and add one complete redirect to a same-type successor",
      ),
    ]);
  }
  const traced = trace(graph, id);
  if (traced.cycle !== undefined) {
    const cycle = canonicalCycle(traced.cycle);
    const diagnostic = diagnosticForRecord(
      CODE.redirectCycle,
      "error",
      `redirect cycle detected: ${cycle.join(" -> ")}`,
      record,
      "review the cycle and remove or replace at least one redirect so the chain reaches one active record",
    );
    diagnostic.chain = cycle;
    return fail([diagnostic]);
  }
  if (!traced.valid) return fail(pathDiagnostics(graph, record, traced.chain));
  const terminal = traced.terminal!;
  if (!isTerminalCanonical(terminal)) {
    if (terminal.status === "superseded" && terminal.redirect === undefined) {
      return fail([
        diagnosticForRecord(
          CODE.legacyMissingRedirect,
          "error",
          `redirect chain from ${id} reaches superseded entity ${terminal.id} without a reviewed successor`,
          terminal,
          "review the terminal record and add one complete redirect to a same-type successor",
        ),
      ]);
    }
    const diagnostic = diagnosticForRecord(
      CODE.redirectInactiveTerminal,
      "error",
      `resolution of ${id} terminates at ${terminal.id} with status ${terminal.status}`,
      record,
      "review the chain and redirect it to a current same-type terminal record",
    );
    diagnostic.target_id = terminal.id;
    diagnostic.chain = traced.chain;
    return fail([diagnostic]);
  }
  return { resolution: { requested_id: id, canonical_id: terminal.id, chain: traced.chain, resolved: traced.chain.length > 1 }, diagnostics: [] };
}

/** Go `pathDiagnostics`: the first broken edge on the chain from `source`. */
function pathDiagnostics(graph: EntityGraph, source: EntityRecord, chain: readonly string[]): EntityDiagnostic[] {
  let current = source;
  while (current.redirect !== undefined) {
    const targetId = current.redirect.target_id;
    const edge = (code: string, message: string, action: string): EntityDiagnostic[] => {
      const diagnostic = diagnosticForRecord(code, "error", message, current, action);
      diagnostic.target_id = targetId;
      diagnostic.chain = [...chain];
      return [diagnostic];
    };
    if (targetId === current.id) return edge(CODE.redirectSelf, `entity ${current.id} redirects to itself`, "choose a different active same-type successor");
    const target = graph.record(targetId);
    if (target === undefined) {
      return edge(CODE.redirectMissingTarget, `entity ${current.id} redirects to missing target ${targetId}`, "restore the target record or review a different existing same-type successor");
    }
    if (target.type !== source.type) {
      return edge(
        CODE.redirectCrossType,
        `entity ${current.id} (${current.type}) redirects to ${target.id} (${target.type})`,
        "remove the redirect and use related for a non-canonical cross-type relationship",
      );
    }
    if (current.status !== "superseded") {
      return edge(
        CODE.redirectIllegalStatus,
        `entity ${current.id} has status ${current.status} but carries redirect`,
        "remove redirect or change the record to superseded through a reviewed consolidation",
      );
    }
    current = target;
  }
  return [diagnosticForRecord(CODE.inputContract, "error", `entity ${source.id} could not be resolved`, source, "validate the complete graph and repair every reported redirect error")];
}
