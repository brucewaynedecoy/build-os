/**
 * The `buildos fitgap` adapter (W1 R7 P9 t5, t7): the port of the skill
 * script `fit-gap-analysis/scripts/fitgap.py`, with its subcommands
 * `frame`, `packages`, `uncited`, `merge`, and `workbook`. Human output is
 * the script's (stdout, and `fitgap: <message>` on stderr); `--json` gives
 * the shared envelope. Exit codes (PRD 20): 0 done, 2 usage, 3 an input
 * cannot be read or has the wrong shape, 4 a check failed, 5 a write
 * failed. No subcommand needs Python or openpyxl.
 */

import { xlsxZip } from "../../adapters/xlsx-zip.ts";
import type { NotRestored } from "../../core/shared/not-restored.ts";
import { cmdFrame, cmdMerge, cmdPackages, cmdUncited, cmdWorkbook, FitgapDie, FitgapFail, FitgapInput, type FitgapContext } from "../../core/fitgap/fitgap.ts";
import { FitgapShapeError } from "../../core/fitgap/py.ts";
import { ProjectFileError, ProjectFiles } from "../../core/shared/project-files.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { UsageError } from "../usage-error.ts";
import { renderSkillRun, takeSharedFlags, wantsHelp, type SkillOutcome } from "./skill-output.ts";

export const FITGAP_HELP = `Usage:
  buildos fitgap frame --frame <frame.json>
  buildos fitgap packages --frame <frame.json> --out <folder> [--max-requirements N]
  buildos fitgap uncited --frame <frame.json> --rows <file-or-pattern>... [--out <file.json>]
  buildos fitgap merge --frame <frame.json> --rows <file-or-pattern>... --out <folder>
                       [--only <file>...] [--findings <file>] [--todos <file>...] [--date YYYY-MM-DD] [--draft]
  buildos fitgap workbook --frame <frame.json> --fitgap <merged.json> [--out <file.xlsx>]

Deterministic tooling for the fit-gap-analysis skill:

  frame     check the frame: both systems load, objectives are valid, layers line up
  packages  split the baseline into scoring packages; write the target index and evidence CSV
  uncited   list target capabilities that no mark cites (input to the target-only pass)
  merge     scored rows + target-only rows + findings -> <a>-<b>-fit-gap-analysis.json
  workbook  merged JSON + both models -> <a>-<b>-fit-gap-analysis.xlsx

The verdict, fit score, and priority are computed here from the requirement
marks, never by an agent. Owner names come from the frame (take them from
owners[].name in .os/config/instance.yaml); owner colors from the frame's
owner_colors, else .os/skills/fit-gap-analysis/config/owner-colors.json.
Paths are relative to the project folder; quote a pattern such as
"build/scored/*.json" so BuildOS expands it.

  --root <folder>          the project folder (default: the current folder)
  --json                   print the stable JSON envelope
  --allow-outside-root     allow an output outside the project folder

Exit codes:
  0  done
  2  the command was not written correctly
  3  a file cannot be read, or has the wrong shape
  4  a check failed (each problem is listed)
  5  a write failed
`;

export const fitgapDomain: Domain = {
  name: "fitgap",
  summary: "Score a fit-gap analysis and write its workbook (.xlsx)",
  help: FITGAP_HELP,
  run: runFitgap,
};

type OptionKind = "value" | "list" | "flag" | "int";

const SPECS: Record<string, Record<string, { kind: OptionKind; required?: boolean }>> = {
  frame: { "--frame": { kind: "value", required: true } },
  packages: { "--frame": { kind: "value", required: true }, "--out": { kind: "value", required: true }, "--max-requirements": { kind: "int" } },
  uncited: { "--frame": { kind: "value", required: true }, "--rows": { kind: "list", required: true }, "--out": { kind: "value" } },
  merge: {
    "--frame": { kind: "value", required: true },
    "--rows": { kind: "list", required: true },
    "--only": { kind: "list" },
    "--findings": { kind: "value" },
    "--todos": { kind: "list" },
    "--out": { kind: "value", required: true },
    "--date": { kind: "value" },
    "--draft": { kind: "flag" },
  },
  workbook: { "--frame": { kind: "value", required: true }, "--fitgap": { kind: "value", required: true }, "--out": { kind: "value" } },
};

const looksLikeOption = (arg: string): boolean => arg.startsWith("-") && arg.length > 1 && !/^-[0-9.]/.test(arg);

/** An `argparse`-like parse: `--name value`, `--name=value`, lists (`nargs`), flags; the last one wins. */
function parse(command: string, args: readonly string[]): Record<string, string | string[] | boolean> {
  const spec = SPECS[command]!;
  const out: Record<string, string | string[] | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const eq = arg.indexOf("=");
    const name = arg.startsWith("--") && eq > 0 ? arg.slice(0, eq) : arg;
    const option = Object.hasOwn(spec, name) ? spec[name] : undefined;
    if (option === undefined) throw new UsageError(looksLikeOption(arg) ? `fitgap ${command}: unknown option ${name}` : `fitgap ${command}: unexpected argument ${arg}`, { command: `buildos fitgap ${command}`, json: false });
    if (option.kind === "flag") {
      if (eq > 0) throw new UsageError(`fitgap ${command}: ${name} takes no value`, { command: `buildos fitgap ${command}`, json: false });
      out[name] = true;
      continue;
    }
    if (option.kind === "list") {
      const values: string[] = eq > 0 ? [arg.slice(eq + 1)] : [];
      while (eq < 0 && i + 1 < args.length && !looksLikeOption(args[i + 1]!)) values.push(args[++i]!);
      if (values.length === 0 && name === "--rows") throw new UsageError(`fitgap ${command}: --rows needs at least one file or pattern`, { command: `buildos fitgap ${command}`, json: false });
      out[name] = values;
      continue;
    }
    const value = eq > 0 ? arg.slice(eq + 1) : args[++i];
    if (value === undefined || (eq < 0 && looksLikeOption(value))) throw new UsageError(`fitgap ${command}: ${name} needs a value`, { command: `buildos fitgap ${command}`, json: false });
    if (option.kind === "int" && !/^\s*[-+]?[0-9]+\s*$/.test(value)) throw new UsageError(`fitgap ${command}: ${name} needs a whole number; got ${value}`, { command: `buildos fitgap ${command}`, json: false });
    out[name] = value;
  }
  for (const [name, option] of Object.entries(spec)) {
    if (option.required === true && out[name] === undefined) throw new UsageError(`fitgap ${command} needs ${name}`, { command: `buildos fitgap ${command}`, json: false });
  }
  return out;
}

function localDate(now: Date): string {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function runFitgap(args: readonly string[], context: CommandContext): CommandOutcome {
  const flags = takeSharedFlags(args, true);
  const [command, ...rest] = flags.rest;
  const name = command !== undefined && Object.hasOwn(SPECS, command) ? `fitgap.${command}` : "fitgap";
  context.setCommand(name);
  if (flags.error !== undefined) throw new UsageError(flags.error, { command: "buildos fitgap", json: flags.json });
  // P9-R1-15: `--help` at any level prints the help and exits 0, as argparse did (`fitgap.py workbook --help`).
  if (wantsHelp(flags.rest) || command === "help") return { rendered: { stdout: FITGAP_HELP, stderr: "", exitCode: 0 }, command: name, json: false };
  if (command === undefined) throw new UsageError("fitgap needs a subcommand: frame, packages, uncited, merge, or workbook", { command: "buildos fitgap", json: flags.json });
  if (!Object.hasOwn(SPECS, command)) throw new UsageError(`fitgap: unknown subcommand ${command}; use frame, packages, uncited, merge, or workbook`, { command: "buildos fitgap", json: flags.json });
  let parsed: Record<string, string | string[] | boolean>;
  try {
    parsed = parse(command, rest);
  } catch (error) {
    if (error instanceof UsageError) throw new UsageError(error.message, { command: error.command, json: flags.json });
    throw error;
  }
  const files = new ProjectFiles({ root: flags.root, cwd: context.io.cwd, openFs: context.openFs, allowOutsideRoot: flags.allowOutsideRoot });
  const ctx: FitgapContext = { files, out: [], zip: xlsxZip, today: localDate((context.now ?? (() => new Date()))()), written: [], notices: [], leftBehind: [], kept: [] };
  const value = (key: string): string => parsed[key] as string;
  const list = (key: string): string[] => (parsed[key] as string[] | undefined) ?? [];
  let outcome: SkillOutcome = "ok";
  let stderr = "";
  let notRestored: NotRestored[] | undefined;
  try {
    if (command === "frame") cmdFrame(ctx, value("--frame"));
    else if (command === "packages") cmdPackages(ctx, value("--frame"), value("--out"), parsed["--max-requirements"] === undefined ? 180 : Number.parseInt((parsed["--max-requirements"] as string).trim(), 10));
    else if (command === "uncited") cmdUncited(ctx, value("--frame"), list("--rows"), parsed["--out"] as string | undefined);
    else if (command === "merge") {
      cmdMerge(ctx, {
        frame: value("--frame"),
        rows: list("--rows"),
        only: list("--only"),
        findings: parsed["--findings"] as string | undefined,
        todos: list("--todos"),
        out: value("--out"),
        date: (parsed["--date"] as string | undefined) ?? ctx.today,
        draft: parsed["--draft"] === true,
      });
    } else if (!cmdWorkbook(ctx, value("--frame"), value("--fitgap"), parsed["--out"] as string | undefined)) outcome = "contract";
  } catch (error) {
    if (error instanceof FitgapDie) {
      outcome = "contract";
      stderr = `${error.message}\n`;
    } else if (error instanceof FitgapFail) {
      outcome = "contract";
    } else if (error instanceof FitgapInput) {
      outcome = "input";
      stderr = `fitgap: ${error.message}\n`;
    } else if (error instanceof FitgapShapeError) {
      outcome = "input";
      stderr = `fitgap: an input file is missing a field or has a value of the wrong type (${error.pyText}). Check the inputs against references/formats.md in the skill.\n`;
    } else if (error instanceof ProjectFileError) {
      outcome = error.failure === "io" ? "io" : error.failure === "size" ? "contract" : "input";
      stderr = `fitgap: ${error.message}\n`;
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
      result: { output: ctx.out.join("").split("\n").slice(0, -1), written: ctx.written, ...(ctx.kept.length > 0 ? { kept: ctx.kept } : {}) },
      wrote: ctx.written.length > 0,
      notRestored,
      leftBehind: ctx.leftBehind,
      ...(outcome === "contract" && stderr === "" ? { code: "check_failed", correction: "Fix each FAIL line in result.output, then run the command again." } : {}),
    },
    flags.json,
    context,
  );
}
