/**
 * Diagnostics formatter. JSON mode carries diagnostics inside the envelope as
 * stable records. Human mode writes short messages to stderr.
 */

import { normalizeDiagnostic, type Diagnostic } from "../core/shared/diagnostics.ts";
import type { CliIo } from "./io.ts";

/** One diagnostic as short human text, ending in a newline. */
export function formatDiagnosticHuman(diagnostic: Diagnostic): string {
  let text = `${diagnostic.severity.toUpperCase()} [${diagnostic.code}]: ${diagnostic.message}`;
  if (diagnostic.correction !== undefined && diagnostic.correction !== "") {
    text += `\n  action: ${diagnostic.correction}`;
  }
  return `${text}\n`;
}

export function formatDiagnosticsHuman(diagnostics: readonly Diagnostic[]): string {
  return diagnostics.map(formatDiagnosticHuman).join("");
}

/** Stable JSON records: contract field order, empty optional fields removed. */
export function formatDiagnosticsJson(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.map(normalizeDiagnostic);
}

/**
 * Writes an informational notice to stderr. A notice never changes stdout or
 * the exit code of a successful command.
 */
export function writeNotice(io: CliIo, message: string): void {
  io.writeStderr(`${message}\n`);
}
