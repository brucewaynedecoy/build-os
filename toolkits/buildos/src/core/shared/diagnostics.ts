/**
 * Diagnostic records shared by every BuildOS domain.
 *
 * The core creates diagnostics as typed values. Only the CLI adapter turns
 * them into stdout or stderr text.
 */

export type DiagnosticSeverity = "error" | "warning" | "info";

/** One stable diagnostic record. Optional fields are omitted when unset. */
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  dataset?: string;
  line?: number;
  entity_id?: string;
  target_id?: string;
  chain?: string[];
  correction?: string;
}

/** Field order of a serialized diagnostic. It is part of the JSON contract. */
export const DIAGNOSTIC_FIELD_ORDER = [
  "code",
  "severity",
  "message",
  "dataset",
  "line",
  "entity_id",
  "target_id",
  "chain",
  "correction",
] as const satisfies readonly (keyof Diagnostic)[];

/**
 * Returns a copy of the diagnostic with fields in contract order and empty
 * optional fields removed, so JSON output stays stable.
 */
export function normalizeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  const normalized: Record<string, unknown> = {};
  for (const field of DIAGNOSTIC_FIELD_ORDER) {
    const value = diagnostic[field];
    if (value === undefined || value === "" || value === 0) {
      if (field === "code" || field === "severity" || field === "message") {
        normalized[field] = value ?? "";
      }
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    normalized[field] = value;
  }
  return normalized as unknown as Diagnostic;
}
