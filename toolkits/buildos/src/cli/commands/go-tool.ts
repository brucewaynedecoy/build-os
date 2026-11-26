/**
 * Output for the domains ported from the separate Go tools
 * (`buildos-discovery`, `buildos-design`). Without `--json`, the output is the
 * Go tool's, byte for byte: the result lines on stdout, and on failure the
 * Go `flag` output (if any) and `<tool>: error: <message>` on stderr, exit 1.
 *
 * `--json` is a TypeScript addition (parity exception PE-011; PRD 20 Output
 * and Exit Contract; the Go tools have no JSON mode). It counts only as a
 * whole argument in flag position, with Go `flag` rules (see `GO_TOOL_EXTRAS`
 * and `goParseFlags`): `--title --json` sets the title to `--json`, and a
 * `--json` after `--` or after the first non-flag argument is not a switch,
 * as in Go. Then the result or the failure is printed as the shared envelope
 * on stdout, with nothing on stderr. The exit code is the same in both forms.
 *
 * `--allow-outside-root` (parity exceptions PE-010 for intake and PE-012 for
 * discovery and design) is the opt-in to a write that lands outside the
 * repository root. By default the filesystem port refuses such a write
 * (exit 3), and the message names the flag (`refusalMessage`); the Go tools
 * write there. It has the same flag-position rule as `--json`, and the
 * intake command uses the same switch and the same parser.
 */

import type { Diagnostic } from "../../core/shared/diagnostics.ts";
import { createEnvelope, serializeEnvelope, type WriteStatus } from "../../core/shared/envelope.ts";
import { isCoreError, PathRefusedError } from "../../core/shared/errors.ts";
import { GoError } from "../../core/shared/go-files.ts";
import { rootAsGiven } from "../../core/shared/root.ts";
import type { CommandContext, CommandOutcome } from "../domain.ts";
import { EXIT_CODES, exitCodeFor, type ExitCode } from "../exit-codes.ts";
import { GoFlagError } from "../go-flagset.ts";

export interface GoToolRun {
  /** The Go tool name, for the `<tool>: error:` prefix. */
  tool: string;
  /** The envelope command name, for example `discovery.run`. */
  command: string;
  json: boolean;
  /** `--allow-outside-root` was given (PE-012). */
  allowOutsideRoot?: boolean;
  context: CommandContext;
}

/** The TypeScript-only switch that allows a write outside the repository root (PE-010, PE-012). */
export const ALLOW_OUTSIDE_ROOT = "--allow-outside-root";

/** The TypeScript-only switches of the ported Go tools, recognized only in flag position. */
export const GO_TOOL_EXTRAS = ["--json", ALLOW_OUTSIDE_ROOT] as const;

/**
 * The text of a typed core error, for every ported Go tool (intake,
 * discovery, design): a write refused as outside the repository root, when
 * the switch was not given, names the switch.
 */
export function refusalMessage(error: Error, allowOutsideRoot: boolean): string {
  if (!(error instanceof PathRefusedError) || error.reason !== "outside-root") return error.message;
  // W1 R7 P7 review round 3 (P7-R3-03): the switch is for write destinations only (PE-010, PE-012), so a refused read never names it.
  if (error.forRead) return `${error.message}; BuildOS reads this file only inside the project, so move it into the project or replace the link with the file`;
  return allowOutsideRoot ? error.message : `${error.message}; pass ${ALLOW_OUTSIDE_ROOT} to allow a write outside the repository root`;
}

/** Records the extra switches that `goParseFlags` found (also on a `GoFlagError`). */
export function applyExtras(run: GoToolRun, extras: ReadonlySet<string>): void {
  run.json = extras.has("--json");
  run.allowOutsideRoot = extras.has(ALLOW_OUTSIDE_ROOT);
}

/** Go `cleanRepoRoot` for the envelope root: `.` for an empty flag, else `filepath.Abs`. */
export function envelopeRoot(repoRoot: string | undefined, context: CommandContext): string {
  if (repoRoot === undefined) return "";
  return repoRoot === "" ? "." : rootAsGiven(repoRoot, context.io.cwd);
}

/** A success: Go's stdout text, or the envelope. */
export function succeed(run: GoToolRun, stdout: string, root: string, dryRun: boolean, result: unknown): CommandOutcome {
  if (!run.json) return { command: run.command, json: false, rendered: { stdout, stderr: "", exitCode: EXIT_CODES.ok } };
  const writeStatus: WriteStatus = dryRun ? "planned" : "applied";
  return { command: run.command, json: true, rendered: { stdout: envelope(run, true, root, writeStatus, result, []), stderr: "", exitCode: EXIT_CODES.ok } };
}

/**
 * A failure. A Go error, a flag error, or a usage error exits 1, as the Go
 * tool does. A typed core error (a refusal by the filesystem port, which the
 * Go tool never makes) keeps its central exit code.
 */
export function fail(run: GoToolRun, error: unknown, root: string, preamble = ""): CommandOutcome {
  let message: string;
  let output = preamble;
  let exitCode: ExitCode = EXIT_CODES.internal;
  let code = "command_failed";
  let correction = "Correct the input named in the message, then run the command again.";
  if (error instanceof GoFlagError) {
    applyExtras(run, error.extras);
    message = error.message;
    output += error.output;
    code = "usage_error";
  } else if (error instanceof GoError) {
    message = error.message;
  } else if (isCoreError(error)) {
    message = refusalMessage(error, run.allowOutsideRoot === true);
    exitCode = exitCodeFor(error);
    code = error.code;
    if (error.correction !== undefined) correction = error.correction;
  } else {
    throw error;
  }
  if (!run.json) return { command: run.command, json: false, rendered: { stdout: "", stderr: `${output}${run.tool}: error: ${message}\n`, exitCode } };
  const diagnostic: Diagnostic = { code, severity: "error", message, correction };
  return { command: run.command, json: true, rendered: { stdout: envelope(run, false, root, "not_requested", null, [diagnostic]), stderr: "", exitCode } };
}

/** A command-line failure (`missing command`, `unknown command`, a missing subcommand): Go prints `usage` first when given. */
export function usageFailure(run: GoToolRun, message: string, usage = ""): CommandOutcome {
  return fail(run, new GoFlagError(message, usage), "");
}

function envelope(run: GoToolRun, ok: boolean, root: string, writeStatus: WriteStatus, result: unknown, diagnostics: Diagnostic[]): string {
  return serializeEnvelope(
    createEnvelope({
      ok,
      command: run.command,
      version: run.context.buildInfo.version,
      sourceRevision: run.context.buildInfo.sourceRevision,
      root,
      writeStatus,
      result,
      diagnostics,
    }),
  );
}
