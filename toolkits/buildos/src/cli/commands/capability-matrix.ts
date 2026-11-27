/**
 * The `buildos capability-matrix` adapter (W1 R7 P9, F-P9-04): the port of
 * `cm_build.py`, the tool that the capability-matrix skill embedded in its
 * appendix, with its subcommands `skeleton`, `assemble`, `fitgap`, and
 * `validate`. Human output is the script's (stdout, and its stop messages
 * on stderr); `--json` gives the shared envelope. Exit codes (PRD 20): 0
 * done, 2 usage, 3 an input cannot be read or has the wrong shape (the
 * script crashed), 4 a stop or a failed check, 5 a write failed, 10 a write
 * whose undo was incomplete. No subcommand needs Python.
 */

import { CmFail, CmPatternCode, CmStop, cmAssemble, cmFitgap, cmSkeleton, cmValidate, type CmContext } from "../../core/capability-matrix/cm-build.ts";
import { FitgapInput } from "../../core/fitgap/fitgap.ts";
import { FitgapShapeError } from "../../core/fitgap/py.ts";
import type { NotRestored } from "../../core/shared/not-restored.ts";
import { ProjectFileError, ProjectFiles } from "../../core/shared/project-files.ts";
import { xlsxZip } from "../../adapters/xlsx-zip.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { UsageError } from "../usage-error.ts";
import { renderSkillRun, takeSharedFlags, wantsHelp, type SkillOutcome } from "./skill-output.ts";

export const CAPABILITY_MATRIX_HELP = `Usage:
  buildos capability-matrix skeleton --skeleton <skeleton.json>
  buildos capability-matrix assemble --skeleton <skeleton.json> --parts <file-or-pattern>... --out <folder> [--date <text>]
  buildos capability-matrix fitgap [--mode replacement|selection|integration] --rows <file-or-pattern>... --out <folder>
                                   [--baseline <model.json> --target <model.json>] [--only <file-or-pattern>...]
                                   [--models <model.json>...] [--date <text>]
  buildos capability-matrix validate --model <model.json> [--narrative <file.md>] [--fitgap <fit-gap.json>]
                                     [--baseline <model.json> --target <model.json>]

Deterministic build and validate tooling for the capability-matrix skill:

  skeleton  check a skeleton before dispatching extractors (ids, prefixes, types, statuses, scope briefs)
  assemble  skeleton + extraction parts -> <code>-capability-model.json, -capabilities.csv, -requirements.csv
  fitgap    scored rows + models -> <b>-<t>-fit-gap.json and .csv (replacement or selection, with --baseline
            and --target), or <a>-<b>-integration-map.json and .csv (integration, with --models)
  validate  model [+ narrative] [+ fit/gap] -> PASS and FAIL lines

Field vocabularies are fixed on purpose: they make models from different
systems joinable. Paths are relative to the project folder; quote a pattern
such as "build/<code>/parts/*.json" so BuildOS expands it.

  --root <folder>          the project folder (default: the current folder)
  --json                   print the stable JSON envelope
  --allow-outside-root     allow an output outside the project folder

Exit codes:
  0  done (validate: ALL CHECKS PASSED)
  2  the command was not written correctly
  3  a file cannot be read, or has the wrong shape
  4  a check failed or the run stopped (each problem is listed)
  5  a write failed (BuildOS put back every file it had changed)
  10 a write failed and BuildOS could not put back every file; each one left is named
`;

export const capabilityMatrixDomain: Domain = {
  name: "capability-matrix",
  summary: "Build and check capability models and their fit/gap",
  help: CAPABILITY_MATRIX_HELP,
  run: runCapabilityMatrix,
};

type OptionKind = "value" | "some" | "any" | "choice";

interface OptionSpec {
  kind: OptionKind;
  required?: boolean;
  choices?: readonly string[];
}

const SPECS: Record<string, Record<string, OptionSpec>> = {
  skeleton: { "--skeleton": { kind: "value", required: true } },
  assemble: { "--skeleton": { kind: "value", required: true }, "--parts": { kind: "some", required: true }, "--out": { kind: "value", required: true }, "--date": { kind: "value" } },
  fitgap: {
    "--mode": { kind: "choice", choices: ["replacement", "selection", "integration"] },
    "--baseline": { kind: "value" },
    "--target": { kind: "value" },
    "--models": { kind: "any" },
    "--rows": { kind: "some", required: true },
    "--only": { kind: "any" },
    "--out": { kind: "value", required: true },
    "--date": { kind: "value" },
  },
  validate: { "--model": { kind: "value", required: true }, "--narrative": { kind: "value" }, "--fitgap": { kind: "value" }, "--baseline": { kind: "value" }, "--target": { kind: "value" } },
};
const SUBCOMMANDS = Object.keys(SPECS);

// argparse's negative-number pattern in the capture Python (3.14,
// `_negative_number_matcher`, r'-\.?\d' with `re.match`): a minus, an
// optional dot, and one Unicode decimal digit (category Nd).
const NEGATIVE_NUMBER = /^-\.?\p{Nd}/u;

/**
 * Whether argparse (`_parse_optional` in the capture Python) reads `arg` as an
 * option, not as a value, in a subparser whose option strings are the spec's
 * names plus `-h` and `--help`. In its order: an exact option string, or one
 * before an `=`; a prefix of an option string (argparse's abbreviations, and
 * `-h` followed by more text); then a value that looks like a negative number
 * (no option here looks like one) or that holds a space is a value; anything
 * else that starts with `-` and is longer than one character is an option.
 * Review round 3, finding 3.
 */
function seenAsOption(arg: string, spec: Record<string, OptionSpec>): boolean {
  if (!arg.startsWith("-")) return false;
  const names = [...Object.keys(spec), "-h", "--help"];
  if (names.includes(arg)) return true;
  if (arg.length === 1) return false;
  const eq = arg.indexOf("=");
  const before = eq >= 0 ? arg.slice(0, eq) : arg;
  if (eq >= 0 && names.includes(before)) return true;
  if (arg[1] === "-" ? names.some((n) => n.startsWith(before)) : names.some((n) => n === arg.slice(0, 2) || n.startsWith(before))) return true;
  if (NEGATIVE_NUMBER.test(arg)) return false;
  if (arg.includes(" ")) return false;
  return true;
}

/** An `argparse`-like parse: `--name value`, `--name=value`, lists (`nargs='+'` and `'*'`), choices; the last one wins. */
function parse(command: string, args: readonly string[]): Record<string, string | string[]> {
  const spec = SPECS[command]!;
  const out: Record<string, string | string[]> = {};
  const usage = (message: string): never => {
    throw new UsageError(`capability-matrix ${command}: ${message}`, { command: `buildos capability-matrix ${command}`, json: false });
  };
  const looksLikeOption = (arg: string): boolean => seenAsOption(arg, spec);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const eq = arg.indexOf("=");
    const name = arg.startsWith("--") && eq > 0 ? arg.slice(0, eq) : arg;
    const option = Object.hasOwn(spec, name) ? spec[name] : undefined;
    if (option === undefined) usage(looksLikeOption(arg) ? `unknown option ${name}` : `unexpected argument ${arg}`);
    if (option!.kind === "some" || option!.kind === "any") {
      const values: string[] = eq > 0 ? [arg.slice(eq + 1)] : [];
      while (eq < 0 && i + 1 < args.length && !looksLikeOption(args[i + 1]!)) values.push(args[++i]!);
      if (values.length === 0 && option!.kind === "some") usage(`${name} needs at least one file or pattern`);
      out[name] = values;
      continue;
    }
    const value = eq > 0 ? arg.slice(eq + 1) : args[++i];
    if (value === undefined || (eq < 0 && looksLikeOption(value))) usage(`${name} needs a value`);
    if (option!.kind === "choice" && !option!.choices!.includes(value!)) usage(`${name} must be one of ${option!.choices!.join(", ")}; got ${value}`);
    out[name] = value!;
  }
  for (const [name, option] of Object.entries(spec)) {
    if (option.required === true && out[name] === undefined) throw new UsageError(`capability-matrix ${command} needs ${name}`, { command: `buildos capability-matrix ${command}`, json: false });
  }
  return out;
}

function runCapabilityMatrix(args: readonly string[], context: CommandContext): CommandOutcome {
  const flags = takeSharedFlags(args, true);
  const [command, ...rest] = flags.rest;
  const name = command !== undefined && Object.hasOwn(SPECS, command) ? `capability-matrix.${command}` : "capability-matrix";
  context.setCommand(name);
  if (flags.error !== undefined) throw new UsageError(flags.error, { command: "buildos capability-matrix", json: flags.json });
  // `--help` at any level prints the help and exits 0, as argparse did (`cm_build.py validate --help`).
  if (wantsHelp(flags.rest) || command === "help") return { rendered: { stdout: CAPABILITY_MATRIX_HELP, stderr: "", exitCode: 0 }, command: name, json: false };
  if (command === undefined) throw new UsageError(`capability-matrix needs a subcommand: ${SUBCOMMANDS.join(", ")}`, { command: "buildos capability-matrix", json: flags.json });
  if (!Object.hasOwn(SPECS, command)) throw new UsageError(`capability-matrix: unknown subcommand ${command}; use ${SUBCOMMANDS.join(", ")}`, { command: "buildos capability-matrix", json: flags.json });
  let parsed: Record<string, string | string[]>;
  try {
    parsed = parse(command, rest);
  } catch (error) {
    if (error instanceof UsageError) throw new UsageError(error.message, { command: error.command, json: flags.json });
    throw error;
  }
  const files = new ProjectFiles({ root: flags.root, cwd: context.io.cwd, openFs: context.openFs, allowOutsideRoot: flags.allowOutsideRoot });
  const ctx: CmContext = { files, out: [], zip: xlsxZip, today: "", written: [], notices: [], leftBehind: [], kept: [] };
  const value = (key: string): string | undefined => parsed[key] as string | undefined;
  const list = (key: string): string[] | undefined => parsed[key] as string[] | undefined;
  let outcome: SkillOutcome = "ok";
  let stderr = "";
  let notRestored: NotRestored[] | undefined;
  const prefix = `capability-matrix ${command}: `;
  try {
    if (command === "skeleton") cmSkeleton(ctx, value("--skeleton")!);
    else if (command === "assemble") cmAssemble(ctx, { skeleton: value("--skeleton")!, parts: list("--parts")!, out: value("--out")!, date: value("--date") ?? "" });
    else if (command === "fitgap") {
      cmFitgap(ctx, {
        mode: value("--mode") ?? "replacement",
        baseline: value("--baseline"),
        target: value("--target"),
        models: list("--models"),
        rows: list("--rows")!,
        only: list("--only"),
        out: value("--out")!,
        date: value("--date") ?? "",
      });
    } else cmValidate(ctx, { model: value("--model")!, narrative: value("--narrative"), fitgap: value("--fitgap"), baseline: value("--baseline"), target: value("--target") });
  } catch (error) {
    if (error instanceof CmStop) {
      outcome = "contract";
      stderr = `${error.message}\n`;
    } else if (error instanceof CmFail) {
      outcome = "contract";
    } else if (error instanceof CmPatternCode) {
      outcome = "contract";
      stderr = `${prefix}${error.message}\n`;
    } else if (error instanceof FitgapInput) {
      outcome = "input";
      stderr = `${prefix}${error.message}\n`;
    } else if (error instanceof FitgapShapeError) {
      outcome = "input";
      stderr = `${prefix}an input file is missing a field or has a value of the wrong type (${error.pyText}). Check the inputs against the schema reference in the skill.\n`;
    } else if (error instanceof ProjectFileError) {
      outcome = error.failure === "io" ? "io" : error.failure === "size" ? "contract" : "input";
      stderr = `${prefix}${error.message}\n`;
      if (error.notRestored.length > 0) notRestored = error.notRestored;
    } else throw error;
  }
  return renderSkillRun(
    {
      command: name,
      root: files.root,
      outcome,
      stdout: ctx.out.join(""),
      stderr: `${stderr}${ctx.notices.map((n) => `${n}\n`).join("")}`,
      result: { output: ctx.out.join("").split("\n").slice(0, -1), written: ctx.written },
      wrote: ctx.written.length > 0,
      notRestored,
      leftBehind: ctx.leftBehind,
      ...(outcome === "contract" && stderr === "" ? { code: "check_failed", correction: "Fix each FAIL line in result.output, then run the command again." } : {}),
    },
    flags.json,
    context,
  );
}
