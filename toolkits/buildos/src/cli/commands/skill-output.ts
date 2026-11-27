/**
 * Output of the skill-script commands (W1 R7 P9: `buildos extract bulk`,
 * `buildos fitgap`, `buildos export azure-boards`). Human output is the
 * script's own stdout and stderr, byte for byte, so a skill that read the
 * script's output reads the same text. `--json` prints the shared envelope
 * (PRD 20) with the command's result and one diagnostic on failure. The exit
 * code follows PRD 20 (divergence SD-01 in `test/golden/skills/divergences.json`).
 */

import type { Diagnostic } from "../../core/shared/diagnostics.ts";
import type { NotRestored } from "../../core/shared/not-restored.ts";
import { createEnvelope, serializeEnvelope, type WriteStatus } from "../../core/shared/envelope.ts";
import type { CommandContext, CommandOutcome } from "../domain.ts";
import { EXIT_CODES, type ExitCode } from "../exit-codes.ts";

/** How a skill-script run ended. */
/** `review`: the command stopped before any change and needs a person to look first (exit 10, nothing written; P9-F-02). */
export type SkillOutcome = "ok" | "usage" | "input" | "contract" | "io" | "partial" | "review";

export const SKILL_EXIT: Record<SkillOutcome, ExitCode> = {
  ok: EXIT_CODES.ok,
  usage: EXIT_CODES.usage,
  input: EXIT_CODES.input,
  contract: EXIT_CODES.contract,
  io: EXIT_CODES.io,
  partial: EXIT_CODES.needsOperatorReview,
  review: EXIT_CODES.needsOperatorReview,
};

export interface SkillRun {
  /** Envelope command name, for example `extract.bulk.status`. */
  command: string;
  root: string;
  outcome: SkillOutcome;
  stdout: string;
  stderr: string;
  /** The JSON result. */
  result?: unknown;
  /** True when the run wrote a file. */
  wrote: boolean;
  /**
   * W1 R7 P9 review round 2 (P9-R2-07): what the run left that it could not
   * put back or clean up, with exact paths and reasons (a failed write whose
   * undo was incomplete, a temporary file, an earlier file kept under a
   * backup name, a lock file). Not empty: exit 10, `partially_applied`, as
   * `buildos init` reports leftovers.
   */
  notRestored?: NotRestored[] | undefined;
  /**
   * A harmless leftover after a run whose outputs are complete and correct:
   * a backup under a private hidden name that BuildOS could not delete. The
   * exit code and `write_status` stay; the human output names it on stderr,
   * JSON names it in a warning and in `result.left_behind`.
   */
  leftBehind?: NotRestored[] | undefined;
  /** Stable code of the failure diagnostic. */
  code?: string;
  /** The next step for the failure diagnostic. */
  correction?: string;
}

const DEFAULT_CODES: Record<SkillOutcome, string> = {
  ok: "ok",
  usage: "usage_error",
  input: "input_unreadable",
  contract: "check_failed",
  io: "write_failed",
  partial: "partially_applied",
  review: "needs_operator_review",
};

const DEFAULT_CORRECTIONS: Record<SkillOutcome, string> = {
  ok: "",
  usage: "Run the command with --help for its syntax.",
  input: "Check the file named in the message, then run the command again.",
  contract: "Fix what the message names, then run the command again.",
  io: "Check that the folder can be written, then run the command again.",
  partial: "Check the files named in the message; BuildOS could not put them back.",
  review: "Follow the steps in the message, then run the command again.",
};

/** The command outcome: the script's text in human mode, the envelope with `--json`. */
export function renderSkillRun(run: SkillRun, json: boolean, context: CommandContext): CommandOutcome {
  const notRestored = run.notRestored ?? [];
  const leftBehind = run.leftBehind ?? [];
  const outcome: SkillOutcome = notRestored.length > 0 ? "partial" : run.outcome;
  const exitCode = SKILL_EXIT[outcome];
  if (!json) return { rendered: { stdout: run.stdout, stderr: run.stderr, exitCode }, command: run.command, json: false };
  const ok = outcome === "ok";
  const writeStatus: WriteStatus = outcome === "partial" ? "partially_applied" : run.wrote ? "applied" : "not_requested";
  const message = run.stderr.trim() === "" ? run.stdout.trim().split("\n").slice(0, 1).join("") : run.stderr.trim();
  const diagnostics: Diagnostic[] = ok
    ? []
    : [{ code: run.code ?? DEFAULT_CODES[outcome], severity: "error", message: message === "" ? "The command failed." : message, correction: run.correction ?? DEFAULT_CORRECTIONS[outcome] }];
  for (const item of notRestored) diagnostics.push({ code: "undo_incomplete", severity: "error", message: `${item.path}: ${item.reason}`, correction: item.state === "unsure" ? "Check that this file holds what it held before, then run the command again." : "Look at this path and put it right (the reason says how), then run the command again." });
  for (const item of leftBehind) diagnostics.push({ code: "cleanup_incomplete", severity: "warning", message: `${item.path}: ${item.reason}`, correction: "Delete this file; the command's outputs are complete." });
  let result: unknown = run.result ?? null;
  if (notRestored.length > 0 || leftBehind.length > 0) {
    const base = typeof result === "object" && result !== null && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
    result = { ...base, ...(notRestored.length > 0 ? { not_restored: notRestored } : {}), ...(leftBehind.length > 0 ? { left_behind: leftBehind } : {}) };
  }
  const envelope = createEnvelope({
    ok,
    command: run.command,
    version: context.buildInfo.version,
    sourceRevision: context.buildInfo.sourceRevision,
    root: run.root,
    mode: "not_applicable",
    writeStatus,
    result,
    diagnostics,
  });
  return { rendered: { stdout: serializeEnvelope(envelope), stderr: "", exitCode }, command: run.command, json: true };
}

/**
 * Takes the shared flags out of `args` wherever they are, as the scripts let
 * options follow positionals: `--json` and `--allow-outside-root` (no value),
 * and `--root <folder>` or `--root=<folder>`. Returns the rest in order.
 * Arguments after a lone `--` are left as they are.
 */
export function takeSharedFlags(args: readonly string[], allowOutside: boolean): { rest: string[]; root?: string; json: boolean; allowOutsideRoot: boolean; error?: string } {
  const rest: string[] = [];
  let root: string | undefined;
  // W1 R7 P9 review round 1 (P9-R1-12): JSON mode is known before the first
  // parse failure, so `--root --json` (no folder) still gets the envelope.
  const json = wantsJson(args);
  let allowOutsideRoot = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--") {
      rest.push(...args.slice(i));
      break;
    }
    if (arg === "--json") continue;
    else if (allowOutside && arg === "--allow-outside-root") allowOutsideRoot = true;
    else if (arg === "--root") {
      const value = args[i + 1];
      if (value === undefined || value === "" || value.startsWith("--")) return { rest, json, allowOutsideRoot, error: "--root needs a folder" };
      root = value;
      i++;
    } else if (arg.startsWith("--root=")) {
      root = arg.slice("--root=".length);
      if (root === "") return { rest, json, allowOutsideRoot, error: "--root needs a folder" };
    } else rest.push(arg);
  }
  return { rest, ...(root === undefined ? {} : { root }), json, allowOutsideRoot };
}

/** True when `--json` is among the arguments before a lone `--`. */
export function wantsJson(args: readonly string[]): boolean {
  for (const arg of args) {
    if (arg === "--") return false;
    if (arg === "--json") return true;
  }
  return false;
}

/** True when `--help` or `-h` is among the arguments before a lone `--` (P9-R1-15: help at every level, before any required-option check). */
export function wantsHelp(args: readonly string[]): boolean {
  for (const arg of args) {
    if (arg === "--") return false;
    if (arg === "--help" || arg === "-h") return true;
  }
  return false;
}
