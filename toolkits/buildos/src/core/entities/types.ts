/**
 * Entity records, diagnostics, and lifecycle rules, ported from the Go seed
 * (`internal/entities/types.go`, `diagnostic.go`, and `lifecycle.go`).
 * PRD 17 Entity Identity and Canonical Resolution owns the contract.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import type { Diagnostic as CliDiagnostic } from "../shared/diagnostics.ts";
import { goCompare, goTrimSpace, type RawObject } from "../shared/go-json.ts";
import { goQuote } from "../shared/go-quote.ts";

/** How legacy gaps are classified during validation. */
export type Mode = "compat" | "strict";

/** Go `ParseMode`. Throws the Go error text for any other value. */
export function parseMode(value: string): Mode {
  const mode = goTrimSpace(value).toLowerCase();
  if (mode === "compat" || mode === "strict") return mode;
  throw new Error(`unsupported entity validation mode ${goQuote(value)} (want compat or strict)`);
}

/** The reviewed immediate-successor decision on a superseded record. */
export interface Redirect {
  target_id: string;
  kind: string;
  decided_at: string;
  decided_by: string;
  reason: string;
  /** Null when the JSON value was `null` (a Go nil slice). */
  evidence_refs: string[] | null;
}

/** The graph-owned fields of one row plus the complete original object. */
export interface EntityRecord {
  id: string;
  type: string;
  status: string;
  redirect: Redirect | undefined;
  dataset: string;
  /** The dataset path as the Go seed spells it (absolute). */
  path: string;
  line: number;
  /** Every field of the row, value for value, so writers keep unknown fields. */
  raw: RawObject;
}

/** The terminal-resolution result contract. */
export interface Resolution {
  requested_id: string;
  canonical_id: string;
  /** Null in the zero value (a Go nil slice). */
  chain: string[] | null;
  resolved: boolean;
}

export type Severity = "warning" | "error";

export const CODE = {
  inputContract: "input_contract",
  entityNotFound: "entity_not_found",
  legacyMissingRedirect: "legacy_missing_redirect",
  redirectMissingTarget: "redirect_missing_target",
  redirectSelf: "redirect_self",
  redirectCrossType: "redirect_cross_type",
  redirectCycle: "redirect_cycle",
  redirectInactiveTerminal: "redirect_inactive_terminal",
  redirectIllegalStatus: "redirect_illegal_status",
  duplicateId: "duplicate_id",
  redirectRemapConflict: "redirect_remap_conflict",
  indexStale: "index_stale",
  indexNonReproducible: "index_non_reproducible",
} as const;

/** A contract violation and one exact corrective action. Empty fields are unset. */
export interface EntityDiagnostic {
  code: string;
  severity: Severity;
  message: string;
  dataset?: string;
  path?: string;
  line?: number;
  entity_id?: string;
  target_id?: string;
  chain?: string[];
  action: string;
}

/** Go `HasErrors`. */
export function hasErrors(diagnostics: readonly EntityDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}

export function diagnosticForRecord(code: string, severity: Severity, message: string, record: EntityRecord, action: string): EntityDiagnostic {
  return { code, severity, message, dataset: record.dataset, path: record.path, line: record.line, entity_id: record.id, action };
}

/** Go `sortDiagnostics`: stable, by path, line, entity ID, then code. */
export function sortDiagnostics(diagnostics: EntityDiagnostic[]): void {
  const indexed = diagnostics.map((d, i) => ({ d, i }));
  indexed.sort((a, b) => {
    const l = a.d;
    const r = b.d;
    const byPath = goCompare(l.path ?? "", r.path ?? "");
    if (byPath !== 0) return byPath;
    if ((l.line ?? 0) !== (r.line ?? 0)) return (l.line ?? 0) < (r.line ?? 0) ? -1 : 1;
    const byEntity = goCompare(l.entity_id ?? "", r.entity_id ?? "");
    if (byEntity !== 0) return byEntity;
    const byCode = goCompare(l.code, r.code);
    if (byCode !== 0) return byCode;
    return a.i - b.i;
  });
  indexed.forEach(({ d }, i) => {
    diagnostics[i] = d;
  });
}

/** Go `toCLIDiagnostics`: the CLI form drops the path and names the action as the correction. */
export function toCliDiagnostics(input: readonly EntityDiagnostic[]): CliDiagnostic[] {
  return input.map((d) => {
    const out: CliDiagnostic = { code: d.code, severity: d.severity, message: d.message };
    if (d.dataset !== undefined && d.dataset !== "") out.dataset = d.dataset;
    if (d.line !== undefined && d.line !== 0) out.line = d.line;
    if (d.entity_id !== undefined && d.entity_id !== "") out.entity_id = d.entity_id;
    if (d.target_id !== undefined && d.target_id !== "") out.target_id = d.target_id;
    if (d.chain !== undefined && d.chain.length > 0) out.chain = [...d.chain];
    if (d.action !== "") out.correction = d.action;
    return out;
  });
}

/**
 * Go `isLegalLifecycleStatus`: the common vocabulary, plus `qualified` for
 * findings and `running`, `closed`, and `aborted` for runs.
 */
export function isLegalLifecycleStatus(record: EntityRecord): boolean {
  switch (record.status) {
    case "draft":
    case "active":
    case "superseded":
    case "archived":
      return true;
    case "qualified":
      return record.type === "finding";
    case "running":
    case "closed":
    case "aborted":
      return record.type === "run";
    default:
      return false;
  }
}

/** Go `isTerminalCanonical`: a row that is current and may end a resolution chain. */
export function isTerminalCanonical(record: EntityRecord): boolean {
  if (record.status === "active" || (record.type === "finding" && record.status === "qualified")) return true;
  return record.type === "run" && (record.status === "running" || record.status === "closed" || record.status === "aborted");
}

export function lifecycleStatusAction(record: EntityRecord): string {
  if (record.type === "finding") return "set status to draft, active, qualified, superseded, or archived";
  if (record.type === "run") return "set status to running, closed, aborted, active, superseded, or archived";
  return "set status to draft, active, superseded, or archived";
}
