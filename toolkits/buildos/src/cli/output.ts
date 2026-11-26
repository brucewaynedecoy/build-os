/** Turns envelopes into stdout or stderr text. */

import { serializeEnvelope, type Envelope } from "../core/shared/envelope.ts";
import { formatDiagnosticsHuman } from "./diagnostics.ts";

export { serializeEnvelope };

/**
 * Human form of an envelope, without diagnostics. The line layout matches the
 * Go seed in `internal/cli/output.go` (Go sources at the frozen baseline
 * commit 263f5ca; test/golden/CAPTURE.md, Frozen Go Baseline).
 */
export function formatEnvelopeHuman(envelope: Envelope): string {
  const lines = [`${envelope.command}: ${envelope.ok ? "ok" : "error"}`];
  if (envelope.root !== "") {
    lines.push(`root: ${envelope.root}`);
  }
  if (envelope.mode !== "") {
    lines.push(`mode: ${envelope.mode}`);
  }
  lines.push(`version: ${envelope.version}`);
  lines.push(`source revision: ${envelope.source_revision}`);
  lines.push(`write status: ${envelope.write_status}`);
  let text = `${lines.join("\n")}\n`;
  if (envelope.result !== null && envelope.result !== undefined) {
    text += `${JSON.stringify(envelope.result, null, 2)}\n`;
  }
  return text;
}

/** Human form of a failed envelope: header, diagnostics, and result. */
export function formatFailureHuman(envelope: Envelope): string {
  const header = formatEnvelopeHuman({ ...envelope, result: null });
  const result =
    envelope.result !== null && envelope.result !== undefined ? `${JSON.stringify(envelope.result, null, 2)}\n` : "";
  return `${header}${formatDiagnosticsHuman(envelope.diagnostics)}${result}`;
}
