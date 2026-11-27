/**
 * The `buildos validate` adapter (W1 R7 P7; PRD 20 Command Surface, PRD 13
 * buildos validate checks). It parses the flags, calls the core, and prints
 * the report. Human output goes to stdout: the project folder, what was
 * checked, then each problem grouped by file, then the next step. `--json`
 * prints the shared envelope with every finding in `result.findings`.
 *
 * Exit codes (PRD 20): 0 when no problem is found, 4 when a check finds a
 * problem, 3 when the folder is not a BuildOS project or cannot be read, 2
 * for a usage error.
 */

import type { Diagnostic } from "../../core/shared/diagnostics.ts";
import { createEnvelope, serializeEnvelope } from "../../core/shared/envelope.ts";
import type { ValidateFinding } from "../../core/validate/checks.ts";
import { validateProject, type ValidateResult } from "../../core/validate/validate.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { EXIT_CODES } from "../exit-codes.ts";
import { parseCommandFlags } from "../parse.ts";
import { UsageError } from "../usage-error.ts";
import { printedRun } from "../../core/shared/run-command.ts";

const COMMAND = "buildos validate";
const FLAGS = { root: "string", json: "boolean" } as const;

export const VALIDATE_HELP = `Usage:
  buildos validate [--root <folder>] [--json]

Checks a BuildOS project: --root, or else the current folder. It never
looks in a parent folder. It changes no file.

It checks:
  .os/contracts/config-contract.md   names every config term
  .os/config/instance.yaml           systems, environments, owners, defaults
  playbooks/ and .os/templates/      scoped frontmatter uses configured IDs
  .os/data/*.jsonl                   entity records: IDs, types, status,
                                     anchors, and scoped fields

Exit codes:
  0  no problems found
  4  problems found; each one names the file, the field, and what to fix
  3  the folder is not a BuildOS project (no .os/ folder)
  2  the command was not written correctly

  --root <folder>   the project folder (default: the current folder)
  --json            print the stable JSON envelope
`;

export const validateDomain: Domain = {
  name: "validate",
  summary: "Check the project config, scoped frontmatter, and entity records",
  help: VALIDATE_HELP,
  run: runValidate,
};

function runValidate(args: readonly string[], context: CommandContext): CommandOutcome {
  const { values, positionals } = parseCommandFlags(COMMAND, FLAGS, args, (partial) => partial.json === true);
  const json = values.json === true;
  context.setCommand("validate");
  if (positionals.length !== 0) throw new UsageError(`validate takes no arguments; got ${positionals[0] ?? ""}`, { command: COMMAND, json });

  const run = printedRun(context.buildInfo.version, process.platform);
  const { root, result } = validateProject({ root: values.root, cwd: context.io.cwd, openFs: context.openFs, run });
  const passed = result.status === "passed";
  const exitCode = passed ? EXIT_CODES.ok : EXIT_CODES.contract;
  if (json) {
    const diagnostics: Diagnostic[] = passed
      ? []
      : [{ code: "validation_failed", severity: "error", message: result.summary, correction: "Fix each finding in result.findings, then run the same validate command again." }];
    const envelope = createEnvelope({
      ok: passed,
      command: "validate",
      version: context.buildInfo.version,
      sourceRevision: context.buildInfo.sourceRevision,
      root,
      mode: "not_applicable",
      writeStatus: "not_requested",
      result,
      diagnostics,
    });
    return { rendered: { stdout: serializeEnvelope(envelope), stderr: "", exitCode }, command: "validate", json: true };
  }
  return { rendered: { stdout: humanReport(root, result), stderr: "", exitCode }, command: "validate", json: false };
}

/** The human report. */
export function humanReport(root: string, result: ValidateResult): string {
  const { checked } = result;
  const playbooks = checked.frontmatter_files.length;
  const lines = [
    `Project folder: ${root}`,
    `Checked: the config contract, the config file, ${playbooks} ${playbooks === 1 ? "file" : "files"} with scoped frontmatter, and ${checked.entity_files.length} entity data files.`,
    "",
  ];
  if (result.status === "passed") {
    lines.push(`OK. ${result.summary}`);
    return `${lines.join("\n")}\n`;
  }
  lines.push(`${result.summary}`, "");
  for (const [path, findings] of groupByPath(result.findings)) {
    lines.push(path);
    for (const finding of findings) lines.push(`  ${finding.field}: ${finding.message} [${finding.code}]`);
    lines.push("");
  }
  lines.push("Fix each problem, then run the same validate command again.");
  return `${lines.join("\n")}\n`;
}

function groupByPath(findings: readonly ValidateFinding[]): Map<string, ValidateFinding[]> {
  const groups = new Map<string, ValidateFinding[]>();
  for (const finding of findings) {
    const group = groups.get(finding.path);
    if (group === undefined) groups.set(finding.path, [finding]);
    else group.push(finding);
  }
  return groups;
}
