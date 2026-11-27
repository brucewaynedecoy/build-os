/**
 * Diagnostics formatter. JSON mode carries diagnostics inside the envelope as
 * stable records. Human mode writes short messages to stderr.
 */

import { normalizeDiagnostic, type Diagnostic } from "../core/shared/diagnostics.ts";
import type { CliIo } from "./io.ts";

/**
 * One diagnostic as short human text, ending in a newline. `action` turns
 * the correction into the text of the `action:` line (PE-023: the shell
 * label of a printed command on Windows); by default it is the correction.
 */
export function formatDiagnosticHuman(diagnostic: Diagnostic, action: (correction: string) => string = (correction) => correction): string {
  let text = `${diagnostic.severity.toUpperCase()} [${diagnostic.code}]: ${diagnostic.message}`;
  if (diagnostic.correction !== undefined && diagnostic.correction !== "") {
    text += `\n  action: ${action(diagnostic.correction)}`;
  }
  return `${text}\n`;
}

export function formatDiagnosticsHuman(diagnostics: readonly Diagnostic[], action?: (correction: string) => string): string {
  return diagnostics.map((diagnostic) => formatDiagnosticHuman(diagnostic, action)).join("");
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
