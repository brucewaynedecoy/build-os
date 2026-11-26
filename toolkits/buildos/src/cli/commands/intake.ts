/**
 * The `buildos intake` adapter, ported from the Go intake tool
 * (`toolkits/buildos-intake/cmd/buildos-intake/main.go`). It takes the same
 * arguments (`convert`, `index references`, `index playbooks`) and prints
 * exactly what the Go tool prints: its usage text, Go `flag` errors and flag
 * lists, `wrote ...` lines on stdout, and `buildos-intake: error: ...` on
 * stderr with exit 1.
 *
 * `--json` (parity exception PE-022, owner decision of 2026-11-25 on
 * register D-010) is a TypeScript addition: the Go tool has no JSON form.
 * It follows the same rules as discovery and design (`go-tool.ts`): a whole
 * `--json` argument in flag position of `convert`, `index references`, or
 * `index playbooks` prints the shared envelope (`intake.convert`,
 * `intake.index.references`, `intake.index.playbooks`) on stdout and
 * nothing on stderr, with the exit code of the human form. A conversion
 * warning becomes a `warning` diagnostic. Help and the usage text stay the
 * Go text (PE-001, PE-002), so `--json` is not in the usage text. Review
 * round 1 of the intake envelope: `root` is intake's cleaned root once the
 * flags parse, result paths are project-relative with `/` (`reportPath`),
 * and an unexpected error is reported once in the leaf's mode (`fail`).
 * Review round 2: intake does not undo; the envelope names what stayed. A
 * failed write keeps what the run's writes made or changed, with and
 * without `--json` (Go). With `--json`, when a write call of the run made or
 * changed something, the envelope reports `partially_applied`, exit 10,
 * and each such path once in `result.left_in_place` (`WriteRecord`); else
 * `not_requested` and the exit code of the text form.
 *
 * `--allow-outside-root` (parity exception PE-010) is a TypeScript-only
 * switch the Go tool does not define. By default the filesystem port refuses
 * a write target outside `--repo-root` (exit 3, and the message names the
 * flag); with the switch, an outside target (an absolute `--assets-root` or
 * `--output`, or a folder link that leads out of the root) is written as Go
 * writes it. It is the same switch as discovery and design have
 * (`go-tool.ts`), parsed by the same Go `flag` port (`go-flagset.ts`): only
 * a whole argument in flag position, before the first non-flag argument and
 * before `--`, and never the value of a flag (`--source
 * --allow-outside-root` names a source). It is not in the usage text.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { intakeParsers } from "../../adapters/intake-parsers.ts";
import { createNodeInPlaceWriter } from "../../adapters/node-fs.ts";
import { cleanRoot, convert, hostPlatform, reportPath, type ConvertOptions } from "../../core/intake/convert/convert.ts";
import { buildPlaybooksIndex, buildReferencesIndex, type IndexOptions } from "../../core/intake/index/index.ts";
import { IntakeWriteFailure, type IntakeContext, type WriteChange } from "../../core/intake/io.ts";
import type { IntakeParsers } from "../../core/intake/convert/parsers.ts";
import type { Diagnostic } from "../../core/shared/diagnostics.ts";
import type { InPlaceWritePortFactory } from "../../core/shared/fs-port.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { EXIT_CODES } from "../exit-codes.ts";
import { goParseFlags, GoFlagError, type GoFlagDef } from "../go-flagset.ts";
import { goQuote } from "../parse.ts";
import { applyExtras, fail, GO_TOOL_EXTRAS, succeed, usageFailure, type GoToolRun, type Stayed } from "./go-tool.ts";

const TOOL = "buildos-intake";

/** Go `printUsage`, byte for byte. */
export const INTAKE_USAGE = `Usage:
  buildos-intake convert --source <path> [--repo-root <path>] [--assets-root system/assets] [--type auto|csv|docx|xlsx|pdf|html|html-dir] [--force] [--dry-run]
  buildos-intake index references [--repo-root <path>] [--assets-root system/assets] [--output system/.os/indexes/references.json]
  buildos-intake index playbooks [--repo-root <path>] [--playbooks-root system/playbooks] [--output system/.os/indexes/playbooks.json]
`;

export const CONVERT_FLAGS: readonly GoFlagDef[] = [
  { name: "repo-root", kind: "string", usage: "repository root", default: "." },
  { name: "source", kind: "string", usage: "source file or HTML directory to convert" },
  { name: "assets-root", kind: "string", usage: "converted asset root", default: "system/assets" },
  { name: "type", kind: "string", usage: "source type: auto, csv, docx, xlsx, pdf, html, html-dir", default: "auto" },
  { name: "force", kind: "bool", usage: "overwrite existing converted twins" },
  { name: "dry-run", kind: "bool", usage: "print planned outputs without writing" },
];

const REFERENCES_FLAGS: readonly GoFlagDef[] = [
  { name: "repo-root", kind: "string", usage: "repository root", default: "." },
  { name: "assets-root", kind: "string", usage: "converted asset root", default: "system/assets" },
  { name: "output", kind: "string", usage: "references index output path", default: "system/.os/indexes/references.json" },
];

const PLAYBOOKS_FLAGS: readonly GoFlagDef[] = [
  { name: "repo-root", kind: "string", usage: "repository root", default: "." },
  { name: "playbooks-root", kind: "string", usage: "playbooks root", default: "system/playbooks" },
  { name: "output", kind: "string", usage: "playbooks index output path", default: "system/.os/indexes/playbooks.json" },
];

/**
 * Go `flag.NewFlagSet(name, flag.ContinueOnError)` with output on stderr,
 * then `Parse`, with `--json` (PE-022) and `--allow-outside-root` (PE-010)
 * as the TypeScript-only switches. Records both on `run` and on the core
 * context, also when the parse fails, so a flag error after `--json` prints
 * the envelope. Go's flag package prints the error and the usage for a
 * failure, and only the usage for -h; `fail` prints them.
 */
function parseFlags(name: string, flags: readonly GoFlagDef[], args: readonly string[], run: GoToolRun, intake: IntakeContext): Record<string, string | boolean> {
  let parsed: ReturnType<typeof goParseFlags>;
  try {
    parsed = goParseFlags(name, flags, args, { extras: GO_TOOL_EXTRAS });
  } catch (error) {
    if (error instanceof GoFlagError) applyExtras(run, error.extras);
    throw error;
  }
  applyExtras(run, parsed.extras);
  if (run.allowOutsideRoot === true) intake.allowOutsideRoot = true;
  const values: Record<string, string | boolean> = {};
  for (const [key, value] of parsed.strings) values[key] = value;
  for (const [key, value] of parsed.bools) values[key] = value;
  return values;
}

export interface IntakeRunOptions {
  /** The parsers core uses. Tests pass fakes; defaults to the bundled packages. */
  parsers?: IntakeParsers;
  /** The in-place writer. Defaults to the `node:fs` adapter. */
  openWriter?: InPlaceWritePortFactory;
  now?: () => Date;
}

/** The warnings of a conversion: Go-style stderr lines for the human form, warning diagnostics for the envelope (PE-022). */
function convertWarnings(warnings: readonly string[]): { stderr: string; diagnostics: Diagnostic[] } {
  return {
    // P7-R3-02, P7-R3-06: an image BuildOS did not copy for a reason of its own is named on stderr; the command still succeeds.
    stderr: warnings.map((warning) => `${TOOL}: warning: ${warning}\n`).join(""),
    diagnostics: warnings.map((message) => ({ code: "image_not_copied", severity: "warning", message, correction: "Move the image into the document's folder or the project, or make it smaller, then convert again." })),
  };
}

/**
 * Runs the Go intake tool's `run(args)`. Without `--json`, the outcome holds
 * exactly the Go tool's stdout, stderr, and exit code. With `--json` in flag
 * position (PE-022), it holds the shared envelope on stdout, nothing on
 * stderr, and the same exit code.
 */
export async function runIntake(args: readonly string[], context: CommandContext, options: IntakeRunOptions = {}): Promise<CommandOutcome> {
  const intake: IntakeContext = { cwd: context.io.cwd, openFs: context.openFs, openWriter: options.openWriter ?? createNodeInPlaceWriter, parsers: options.parsers ?? intakeParsers, ...(options.now === undefined ? {} : { now: options.now }) };
  const [command, ...rest] = args;
  const begin = (name: string): GoToolRun => {
    context.setCommand(name);
    return { tool: TOOL, command: name, json: false, context };
  };
  if (command === undefined) return usageFailure(begin("intake"), "missing command", INTAKE_USAGE);
  // W1 R7 P9 intake JSON review round 1 (finding 4): the envelope root is
  // the root intake itself uses (Go `cleanRoot`: `filepath.Abs`, also of an
  // empty `--repo-root`), from the moment the flags are parsed; before that
  // it is empty, as for discovery and design. Finding 5: every path in the
  // result is shown with `reportPath` (project-relative with `/`).
  const platform = intake.platform ?? hostPlatform();
  const cleaned = (root: string | undefined): string => (root === undefined ? "" : cleanRoot(root, intake.cwd, platform));
  const shown = (root: string, path: string): string => reportPath(root, path, platform);
  /** A failure; a failed write in JSON mode names what its write calls made or changed (review round 2). */
  const failed = (run: GoToolRun, error: unknown, root: string, what: "file" | "index"): CommandOutcome =>
    error instanceof IntakeWriteFailure ? fail(run, error.failure, root, "", error.changes.map((change) => stayed(root, change, what))) : fail(run, error, root);
  const stayed = (root: string, change: WriteChange, what: "file" | "index"): Stayed => {
    const path = change.folder ? `${shown(root, change.path)}/` : shown(root, change.path);
    let message: string;
    // Final check, finding 4: the message says what the run did at that time, never what is at the path now.
    if (change.reason === "created") message = `this run created this ${change.folder ? "folder" : "file"} before the failure and did not remove it (intake does not undo); another program can have changed this path after that`;
    // Finding 3: a removed link is not an overwritten file; the file the link pointed to keeps its bytes.
    else if (change.link === true) message = "this run removed the link at this path before the failure, and the file that the link pointed to is not changed; make this link again if you need it";
    // Review round 2 (finding 8): the index commands have no --force; the one write overwrote the index that was there.
    else if (what === "index") message = "the existing index was partly or fully overwritten before the failure, and its earlier content is lost";
    else message = "this run overwrote or replaced this existing entry before the failure, and its earlier content is lost";
    return { item: { path, reason: change.reason, state: "left" }, message };
  };
  switch (command) {
    case "convert": {
      const run = begin("intake.convert");
      let root: string | undefined;
      try {
        const v = parseFlags("convert", CONVERT_FLAGS, rest, run, intake);
        root = cleaned(v["repo-root"] as string);
        const opts: ConvertOptions = {
          repoRoot: v["repo-root"] as string,
          source: v["source"] as string,
          assetsRoot: v["assets-root"] as string,
          type: v["type"] as string,
          force: v["force"] as boolean,
          dryRun: v["dry-run"] as boolean,
          recordWrites: run.json,
        };
        if (opts.source === "") return usageFailure(run, "convert requires --source", "", root);
        const result = await convert(intake, opts);
        let stdout = "";
        for (const output of result.outputs) stdout += `${opts.dryRun ? "would write" : "wrote"} ${output.path}\n`;
        for (const artifact of result.sideArtifacts) stdout += `${opts.dryRun ? "would write side artifact" : "wrote side artifact"} ${artifact}\n`;
        const at = root;
        return succeed(run, stdout, at, opts.dryRun, {
          // Review round 2 (finding 7): `source` is shown as every other envelope path; the twin's front matter keeps Go's text.
          outputs: result.outputs.map((output) => ({ path: shown(at, output.path), source: shown(at, result.sourcePath), type: output.type, status: output.status, sha256: output.sha256 })),
          side_artifacts: result.sideArtifacts.map((artifact) => shown(at, artifact)),
          warnings: result.warnings,
          dry_run: opts.dryRun,
        }, convertWarnings(result.warnings));
      } catch (error) {
        return failed(run, error, root ?? "", "file");
      }
    }
    case "index": {
      const [sub, ...flags] = rest;
      const blank: IndexOptions = { repoRoot: ".", assetsRoot: "", playbooksRoot: "", output: "" };
      if (sub !== "references" && sub !== "playbooks") return usageFailure(begin("intake.index"), "index requires subcommand references or playbooks");
      const run = begin(`intake.index.${sub}`);
      let root: string | undefined;
      try {
        if (sub === "references") {
          const v = parseFlags("index references", REFERENCES_FLAGS, flags, run, intake);
          root = cleaned(v["repo-root"] as string);
          const result = buildReferencesIndex(intake, { ...blank, repoRoot: v["repo-root"] as string, assetsRoot: v["assets-root"] as string, output: v["output"] as string, recordWrites: run.json });
          return succeed(run, `wrote ${result.outputPath} (${result.count} references)\n`, root, false, { output_path: shown(root, result.outputPath), count: result.count });
        }
        const v = parseFlags("index playbooks", PLAYBOOKS_FLAGS, flags, run, intake);
        root = cleaned(v["repo-root"] as string);
        const result = buildPlaybooksIndex(intake, { ...blank, repoRoot: v["repo-root"] as string, playbooksRoot: v["playbooks-root"] as string, output: v["output"] as string, recordWrites: run.json });
        return succeed(run, `wrote ${result.outputPath} (${result.count} playbooks)\n`, root, false, { output_path: shown(root, result.outputPath), count: result.count });
      } catch (error) {
        return failed(run, error, root ?? "", "index");
      }
    }
    case "help":
    case "-h":
    case "--help":
      return { command: "intake", json: false, rendered: { stdout: INTAKE_USAGE, stderr: "", exitCode: EXIT_CODES.ok } };
    default:
      return usageFailure(begin("intake"), `unknown command ${goQuote(command)}`, INTAKE_USAGE);
  }
}

export const intakeDomain: Domain = {
  name: "intake",
  summary: "Convert source files and rebuild the reference and playbook indexes",
  help: INTAKE_USAGE,
  run(args: readonly string[], context: CommandContext): Promise<CommandOutcome> {
    return runIntake(args, context);
  },
};
