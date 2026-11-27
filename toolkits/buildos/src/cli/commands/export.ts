/**
 * The `buildos export` adapter (W1 R7 P9 t6, t7). One target today:
 * `buildos export azure-boards`, the port of the skill script
 * `buildos-export-azure-boards/scripts/azure_boards_csv.mjs`. Human output is
 * the script's (a JSON report on stdout, a message on stderr); `--json` gives
 * the shared envelope. Exit codes (PRD 20): 0 done, 2 usage, 3 an input
 * cannot be read or a path is outside the project, 4 a check failed (an
 * invalid manifest or CSV), 5 a write failed.
 */

import { runAzureBoards } from "../../core/export/azure-boards/export.ts";
import { printedRun } from "../../core/shared/run-command.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { UsageError } from "../usage-error.ts";
import { renderSkillRun, takeSharedFlags, wantsHelp, wantsJson, type SkillOutcome } from "./skill-output.ts";

export const EXPORT_AZURE_BOARDS_HELP = `Usage:
  buildos export azure-boards emit --input <manifest.json> --output <file.csv> [--profile target17-new|new|update] [--adapter <id>] [--adapter-params <json>] [--publisher-prefix <value>]
  buildos export azure-boards validate --input <file.csv> [--profile target17-new|new|update|auto] [--adapter <id>] [--adapter-params <json>] [--publisher-prefix <value>]
  buildos export azure-boards template --output <file.csv> [--profile target17-new|new|update]
  buildos export azure-boards adapters

Writes and checks Azure Boards import CSV files (UTF-8 with a byte order
mark, CRLF between records), for the buildos-export-azure-boards skill.

  emit       renders a work-item manifest as CSV, checks it, then writes it
  validate   checks a CSV file and prints a JSON report
  template   writes an empty CSV with the profile's headers
  adapters   lists the registered target adapters

Registered adapters: dynamics-365-ce
On emit, the adapter comes from the manifest keys 'adapter' and 'adapter_params'.

Paths are relative to the project folder.

  --root <folder>          the project folder (default: the current folder)
  --json                   print the stable JSON envelope
  --allow-outside-root     allow --output outside the project folder

Exit codes:
  0  done
  2  the command was not written correctly
  3  a file cannot be read, or a path is outside the project folder
  4  the manifest or the CSV failed a check
  5  a write failed
`;

export const EXPORT_HELP = `Usage:
  buildos export azure-boards <emit|validate|template|adapters> [options]

Exports BuildOS work to a work tracker.

Targets:
  azure-boards   Azure Boards import CSV files

Run "buildos export azure-boards --help" for its options.
`;

export const exportDomain: Domain = {
  name: "export",
  summary: "Export work to a tracker (Azure Boards CSV)",
  help: EXPORT_HELP,
  run: runExport,
};

function runExport(args: readonly string[], context: CommandContext): CommandOutcome {
  const [target, ...rest] = args;
  const json = wantsJson(args);
  if (target !== "azure-boards") {
    context.setCommand("export");
    throw new UsageError(target === undefined ? "export needs a target: azure-boards" : `unknown export target "${target}"; the target is azure-boards`, { command: "buildos export", json });
  }
  context.setCommand("export.azure-boards");
  const flags = takeSharedFlags(rest, true);
  if (flags.error !== undefined) throw new UsageError(flags.error, { command: "buildos export azure-boards", json: flags.json });
  // P9-R1-15: `--help` at any level (`export azure-boards emit --help`) prints the help and exits 0.
  if (wantsHelp(flags.rest)) return { rendered: { stdout: EXPORT_AZURE_BOARDS_HELP, stderr: "", exitCode: 0 }, command: "export.azure-boards", json: false };
  const run = runAzureBoards({ args: flags.rest, root: flags.root, cwd: context.io.cwd, openFs: context.openFs, allowOutsideRoot: flags.allowOutsideRoot, run: printedRun(context.buildInfo.version, process.platform) });
  if (run.outcome === "help") return { rendered: { stdout: EXPORT_AZURE_BOARDS_HELP, stderr: "", exitCode: 0 }, command: "export.azure-boards", json: false };
  const outcome: SkillOutcome = run.outcome;
  return renderSkillRun(
    {
      command: "export.azure-boards",
      root: run.root,
      outcome,
      stdout: run.stdout,
      stderr: run.stderr,
      result: run.report,
      wrote: run.written.length > 0,
      notRestored: run.notRestored,
      leftBehind: run.leftBehind,
      ...(run.outcome === "contract" && run.report !== undefined ? { code: "validation_failed", correction: "Fix each entry in result.errors, then validate again." } : {}),
    },
    flags.json,
    context,
  );
}
