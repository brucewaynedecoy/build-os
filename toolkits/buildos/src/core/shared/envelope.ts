/**
 * The shared JSON result envelope.
 *
 * Field order is part of the automation contract. `serializeEnvelope`
 * returns text; it never writes to a stream.
 */

import { normalizeDiagnostic, type Diagnostic } from "./diagnostics.ts";

export const WRITE_STATUSES = [
  "not_requested",
  "planned",
  "applied",
  "canonical_applied_index_failed",
  "partially_applied",
] as const;

export type WriteStatus = (typeof WRITE_STATUSES)[number];

export interface Envelope {
  ok: boolean;
  command: string;
  version: string;
  source_revision: string;
  root: string;
  mode: string;
  write_status: WriteStatus;
  result: unknown;
  diagnostics: Diagnostic[];
}

/** The nine envelope fields, in serialized order. */
export const ENVELOPE_FIELDS = [
  "ok",
  "command",
  "version",
  "source_revision",
  "root",
  "mode",
  "write_status",
  "result",
  "diagnostics",
] as const satisfies readonly (keyof Envelope)[];

export interface EnvelopeInput {
  ok?: boolean;
  command: string;
  version: string;
  sourceRevision: string;
  root?: string;
  mode?: string;
  writeStatus?: WriteStatus;
  result?: unknown;
  diagnostics?: Diagnostic[];
}

export function createEnvelope(input: EnvelopeInput): Envelope {
  return {
    ok: input.ok ?? true,
    command: input.command,
    version: input.version,
    source_revision: input.sourceRevision,
    root: input.root ?? "",
    mode: input.mode ?? "",
    write_status: input.writeStatus ?? "not_requested",
    result: input.result === undefined ? null : input.result,
    diagnostics: (input.diagnostics ?? []).map(normalizeDiagnostic),
  };
}

/**
 * Serializes an envelope as indented JSON with a trailing newline. U+2028 and
 * U+2029 are escaped, as the Go encoder does, so output stays byte-stable.
 */
export function serializeEnvelope(envelope: Envelope): string {
  const ordered: Record<string, unknown> = {};
  for (const field of ENVELOPE_FIELDS) {
    ordered[field] = envelope[field];
  }
  return `${escapeLineSeparators(JSON.stringify(ordered, null, 2))}\n`;
}

export function escapeLineSeparators(text: string): string {
  return text.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
