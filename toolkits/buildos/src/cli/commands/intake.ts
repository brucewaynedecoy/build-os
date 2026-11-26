/**
 * The `buildos intake` adapter, ported from the Go intake tool
 * (`toolkits/buildos-intake/cmd/buildos-intake/main.go`). It takes the same
 * arguments (`convert`, `index references`, `index playbooks`) and prints
 * exactly what the Go tool prints: its usage text, Go `flag` errors and flag
 * lists, `wrote ...` lines on stdout, and `buildos-intake: error: ...` on
 * stderr with exit 1. The Go tool has no JSON form, so this command has
 * none either.
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
import { convert, type ConvertOptions } from "../../core/intake/convert/convert.ts";
import { buildPlaybooksIndex, buildReferencesIndex, type IndexOptions } from "../../core/intake/index/index.ts";
import { GoError, type IntakeContext } from "../../core/intake/io.ts";
import type { IntakeParsers } from "../../core/intake/convert/parsers.ts";
import type { InPlaceWritePortFactory } from "../../core/shared/fs-port.ts";
import { isCoreError } from "../../core/shared/errors.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { EXIT_CODES, exitCodeFor, type ExitCode } from "../exit-codes.ts";
import { goParseFlags, GoFlagError, type GoFlagDef } from "../go-flagset.ts";
import { goQuote } from "../parse.ts";
import { ALLOW_OUTSIDE_ROOT, refusalMessage } from "./go-tool.ts";

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

/** A Go intake failure: the text after `buildos-intake: error: `, and anything Go printed to stderr before it. */
class IntakeFailure extends Error {
  readonly before: string;
  constructor(message: string, before = "") {
    super(message);
    this.name = "IntakeFailure";
    this.before = before;
  }
}

/**
 * Go `flag.NewFlagSet(name, flag.ContinueOnError)` with output on stderr,
 * then `Parse`, with `--allow-outside-root` as the one TypeScript-only switch
 * (PE-010). Returns the flag values and whether the switch was given.
 */
function parseFlags(name: string, flags: readonly GoFlagDef[], args: readonly string[]): { values: Record<string, string | boolean>; allowOutsideRoot: boolean } {
  try {
    const parsed = goParseFlags(name, flags, args, { extras: [ALLOW_OUTSIDE_ROOT] });
    const values: Record<string, string | boolean> = {};
    for (const [key, value] of parsed.strings) values[key] = value;
    for (const [key, value] of parsed.bools) values[key] = value;
    return { values, allowOutsideRoot: parsed.extras.has(ALLOW_OUTSIDE_ROOT) };
  } catch (error) {
    if (!(error instanceof GoFlagError)) throw error;
    // Go's flag package prints the error and the usage for a failure, and only the usage for -h.
    throw new IntakeFailure(error.message, error.output);
  }
}

export interface IntakeRunOptions {
  /** The parsers core uses. Tests pass fakes; defaults to the bundled packages. */
  parsers?: IntakeParsers;
  /** The in-place writer. Defaults to the `node:fs` adapter. */
  openWriter?: InPlaceWritePortFactory;
  now?: () => Date;
}

/** Runs the Go intake tool's `run(args)` and returns its stdout, stderr, and exit code. */
export async function runIntake(args: readonly string[], context: CommandContext, options: IntakeRunOptions = {}): Promise<{ stdout: string; stderr: string; exitCode: ExitCode }> {
  const intake: IntakeContext = { cwd: context.io.cwd, openFs: context.openFs, openWriter: options.openWriter ?? createNodeInPlaceWriter, parsers: options.parsers ?? intakeParsers, ...(options.now === undefined ? {} : { now: options.now }) };
  /** Parses a subcommand's flags and records `--allow-outside-root`. */
  const parse = (name: string, flags: readonly GoFlagDef[], rest: readonly string[]) => {
    const parsed = parseFlags(name, flags, rest);
    if (parsed.allowOutsideRoot) intake.allowOutsideRoot = true;
    return parsed.values;
  };
  let stdout = "";
  let stderr = "";
  try {
    const [command, ...rest] = args;
    if (command === undefined) throw new IntakeFailure("missing command", INTAKE_USAGE);
    switch (command) {
      case "convert": {
        const v = parse("convert", CONVERT_FLAGS, rest);
        const opts: ConvertOptions = {
          repoRoot: v["repo-root"] as string,
          source: v["source"] as string,
          assetsRoot: v["assets-root"] as string,
          type: v["type"] as string,
          force: v["force"] as boolean,
          dryRun: v["dry-run"] as boolean,
        };
        if (opts.source === "") throw new IntakeFailure("convert requires --source");
        const result = await convert(intake, opts);
        for (const output of result.outputs) stdout += `${opts.dryRun ? "would write" : "wrote"} ${output.path}\n`;
        for (const artifact of result.sideArtifacts) stdout += `${opts.dryRun ? "would write side artifact" : "wrote side artifact"} ${artifact}\n`;
        // P7-R3-02, P7-R3-06: an image BuildOS did not copy for a reason of its own is named on stderr; the command still succeeds.
        for (const warning of result.warnings) stderr += `buildos-intake: warning: ${warning}\n`;
        break;
      }
      case "index": {
        const [sub, ...flags] = rest;
        const blank: IndexOptions = { repoRoot: ".", assetsRoot: "", playbooksRoot: "", output: "" };
        if (sub === "references") {
          const v = parse("index references", REFERENCES_FLAGS, flags);
          const result = buildReferencesIndex(intake, { ...blank, repoRoot: v["repo-root"] as string, assetsRoot: v["assets-root"] as string, output: v["output"] as string });
          stdout += `wrote ${result.outputPath} (${result.count} references)\n`;
        } else if (sub === "playbooks") {
          const v = parse("index playbooks", PLAYBOOKS_FLAGS, flags);
          const result = buildPlaybooksIndex(intake, { ...blank, repoRoot: v["repo-root"] as string, playbooksRoot: v["playbooks-root"] as string, output: v["output"] as string });
          stdout += `wrote ${result.outputPath} (${result.count} playbooks)\n`;
        } else {
          throw new IntakeFailure("index requires subcommand references or playbooks");
        }
        break;
      }
      case "help":
      case "-h":
      case "--help":
        return { stdout: INTAKE_USAGE, stderr: "", exitCode: EXIT_CODES.ok as 0 };
      default:
        throw new IntakeFailure(`unknown command ${goQuote(command)}`, INTAKE_USAGE);
    }
  } catch (error) {
    if (error instanceof IntakeFailure) return { stdout: "", stderr: `${error.before}buildos-intake: error: ${error.message}\n`, exitCode: 1 };
    if (error instanceof GoError) return { stdout: "", stderr: `buildos-intake: error: ${error.message}\n`, exitCode: 1 };
    // A typed refusal from the filesystem port, which the Go tool never makes
    // (a write outside the repository root, a device, a special file), keeps
    // its central exit code (3).
    if (isCoreError(error)) return { stdout: "", stderr: `buildos-intake: error: ${refusalMessage(error, intake.allowOutsideRoot === true)}\n`, exitCode: exitCodeFor(error) };
    throw error;
  }
  return { stdout, stderr, exitCode: 0 };
}

export const intakeDomain: Domain = {
  name: "intake",
  summary: "Convert source files and rebuild the reference and playbook indexes",
  help: INTAKE_USAGE,
  async run(args: readonly string[], context: CommandContext): Promise<CommandOutcome> {
    context.setCommand(`intake.${args[0] ?? ""}`);
    const rendered = await runIntake(args, context);
    return { command: `intake.${args[0] ?? ""}`, json: false, rendered };
  },
};
