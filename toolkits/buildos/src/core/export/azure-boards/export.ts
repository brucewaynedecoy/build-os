/**
 * `buildos export azure-boards`: the subcommands of the skill script
 * `buildos-export-azure-boards/scripts/azure_boards_csv.mjs` (W1 R7 P9 t6):
 * `emit`, `validate`, `template`, and `adapters`. The script's option
 * grammar, checks, messages, and JSON reports are kept. What changes
 * (recorded in `test/golden/skills/divergences.json`): paths are relative to
 * the project root (`--root`, default the current folder); a read stays
 * inside the project folder and is bounded; a write lands inside the project
 * folder unless `--allow-outside-root` is given, is checked before it runs,
 * and is atomic; exit codes follow PRD 20; help names `buildos`.
 */

import type { FsPortFactory } from "../../shared/fs-port.ts";
import { ProjectFileError, ProjectFiles } from "../../shared/project-files.ts";
import type { NotRestored } from "../../shared/not-restored.ts";
import { READ_LIMITS } from "../../shared/read-limits.ts";
import { buildRows, encodeCsv, encodeCsvField, getProfile, validateCsvText, type AzureAdapter, type CsvValidation } from "./csv.ts";
import { dynamics365Ce } from "./dynamics-365-ce.ts";

const ADAPTERS: AzureAdapter[] = [dynamics365Ce];
const ADAPTER_IDS = ADAPTERS.map((adapter) => adapter.id);

/** How a run ended; the CLI maps it to an exit code (PRD 20). */
export type ExportOutcome = "ok" | "usage" | "input" | "contract" | "io" | "help";

export interface ExportRun {
  outcome: ExportOutcome;
  stdout: string;
  stderr: string;
  /** The report the script printed (the JSON result), when there is one. */
  report?: Record<string, unknown>;
  /** Files written. */
  written: string[];
  /** The root as given, absolute. */
  root: string;
  /** What a failed write left that BuildOS could not put back or remove, with exact paths (P9-R2-07). */
  notRestored?: NotRestored[];
  /** A backup BuildOS could not delete after a complete write (harmless, named). */
  leftBehind?: NotRestored[];
}

export interface ExportInput {
  /** The arguments after `azure-boards`, without `--root`, `--json`, and `--allow-outside-root`. */
  args: readonly string[];
  root?: string | undefined;
  cwd: string;
  openFs: FsPortFactory;
  allowOutsideRoot?: boolean;
}

class UsageFailure extends Error {}
class ContractFailure extends Error {}
class InputFailure extends Error {}

/** The script's `parseArgs`: the command, then `--name value` pairs only. */
function parseArgs(argv: readonly string[]): { command: string | undefined; options: Record<string, string> } {
  const [command, ...rest] = argv;
  const options: Record<string, string> = Object.create(null) as Record<string, string>;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]!;
    if (token === "--help" || token === "-h") return { command: "help", options };
    if (!token.startsWith("--")) throw new UsageFailure(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new UsageFailure(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function requireOption(options: Record<string, string>, name: string): string {
  const value = options[name];
  if (!value) throw new UsageFailure(`Missing required option --${name}`);
  return value;
}

function loadAdapter(name: string): AzureAdapter {
  const adapter = ADAPTERS.find((candidate) => candidate.id === name);
  if (adapter === undefined) throw new UsageFailure(`Unknown adapter '${name}'. Registered adapters: ${ADAPTER_IDS.join(", ")}.`);
  return adapter;
}

function resolveAdapterParams(adapter: AzureAdapter, supplied: Record<string, unknown> | undefined, rows: NonNullable<CsvValidation["adapterRows"]>) {
  let params = supplied;
  if ((!params || Object.keys(params).length === 0) && typeof adapter.inferParams === "function") params = adapter.inferParams(rows) ?? undefined;
  return adapter.normalizeParams(params ?? {});
}

function runAdapter(name: string, suppliedParams: Record<string, unknown> | undefined, validation: CsvValidation) {
  const adapter = loadAdapter(name);
  const { params, warnings } = resolveAdapterParams(adapter, suppliedParams, validation.adapterRows ?? []);
  const result = adapter.validateRows({ headers: validation.headers ?? [], rows: validation.adapterRows ?? [], params });
  return { adapter: name, adapterParams: params, errors: result.errors, warnings: [...warnings, ...result.warnings] };
}

function parseAdapterParams(options: Record<string, string>): Record<string, unknown> | undefined {
  if (options["adapter-params"]) {
    let parsed: unknown;
    try {
      parsed = parseJsonBounded(options["adapter-params"], "--adapter-params");
    } catch (error) {
      if (error instanceof InputFailure) throw new UsageFailure(`--adapter-params must be valid JSON: ${error.message}`);
      throw new UsageFailure(`--adapter-params must be valid JSON: ${(error as Error).message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new UsageFailure("--adapter-params must be a JSON object.");
    return parsed as Record<string, unknown>;
  }
  if (options["publisher-prefix"]) return { publisher_prefix: options["publisher-prefix"] };
  return undefined;
}

function reportable(validation: CsvValidation, adapterResult: ReturnType<typeof runAdapter> | null): Record<string, unknown> & { valid: boolean; errors: string[] } {
  const { headers: _headers, adapterRows: _rows, ...rest } = validation;
  if (!adapterResult) return rest;
  return {
    ...rest,
    valid: rest.valid && adapterResult.errors.length === 0,
    adapter: adapterResult.adapter,
    adapter_params: adapterResult.adapterParams,
    errors: [...rest.errors, ...adapterResult.errors],
    warnings: [...rest.warnings, ...adapterResult.warnings],
  };
}

/** Node's `fs.readFile` error text (Node 26, the capture's Node) for the few errors a user can reach, so stderr matches the script on every Node version. */
function nodeReadErrorText(errno: string | undefined, path: string): string | undefined {
  if (errno === "ENOENT") return `ENOENT: no such file or directory, open '${path}'`;
  if (errno === "EISDIR") return `EISDIR: illegal operation on a directory, read '${path}'`;
  if (errno === "EACCES") return `EACCES: permission denied, open '${path}'`;
  return undefined;
}

function readText(files: ProjectFiles, path: string): string {
  try {
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(files.readBytes(path, READ_LIMITS.data));
  } catch (error) {
    if (error instanceof ProjectFileError && error.failure === "input") {
      const text = nodeReadErrorText(error.errno, path);
      throw new InputFailure(text ?? error.message);
    }
    if (error instanceof ProjectFileError) throw new InputFailure(error.message);
    throw error;
  }
}

/** Runs one subcommand. Never throws for a user error. */
export function runAzureBoards(input: ExportInput): ExportRun {
  const files = new ProjectFiles({ root: input.root, cwd: input.cwd, openFs: input.openFs, allowOutsideRoot: input.allowOutsideRoot === true });
  const run: ExportRun = { outcome: "ok", stdout: "", stderr: "", written: [], root: files.root };
  const print = (value: Record<string, unknown>): void => {
    run.report = value;
    run.stdout += `${JSON.stringify(value, null, 2)}\n`;
  };
  try {
    const { command, options } = parseArgs(input.args);
    if (!command || ["help", "--help", "-h"].includes(command)) {
      run.outcome = "help";
      return run;
    }
    if (command === "emit") {
      const inputPath = requireOption(options, "input");
      const outputPath = requireOption(options, "output");
      let manifest: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const text = readText(files, inputPath);
      try {
        manifest = parseJsonBounded(text, inputPath);
      } catch (error) {
        throw new InputFailure((error as Error).message);
      }
      const profileName = options["profile"] ?? manifest.profile ?? "target17-new";
      const adapterName = options["adapter"] ?? manifest.adapter ?? null;
      const adapterParams = parseAdapterParams(options) ?? manifest.adapter_params;
      if (adapterName) loadAdapter(adapterName).normalizeParams(adapterParams ?? {});
      const { headers, rows } = buildRows(manifest, profileName);
      const csv = encodeCsv(headers, rows);
      const validation = validateCsvText(csv, profileName);
      const adapterResult = adapterName ? runAdapter(adapterName, adapterParams, validation) : null;
      const report = reportable(validation, adapterResult);
      if (!report.valid) throw new ContractFailure(`Generated CSV failed validation:\n${report.errors.join("\n")}`);
      writeOutput(run, files, outputPath, csv);
      run.written.push(outputPath);
      print({ operation: "emit", output: files.abs(outputPath), ...report });
      return run;
    }
    if (command === "validate") {
      const inputPath = requireOption(options, "input");
      const profileName = options["profile"] ?? "auto";
      getProfileOrUsage(profileName, true);
      const csv = readText(files, inputPath);
      const validation = validateCsvText(csv, profileName);
      const adapterName = options["adapter"] ?? null;
      const adapterResult = adapterName ? runAdapter(adapterName, parseAdapterParams(options), validation) : null;
      const report = reportable(validation, adapterResult);
      print({ operation: "validate", input: files.abs(inputPath), ...report });
      if (!report.valid) run.outcome = "contract";
      return run;
    }
    if (command === "template") {
      const outputPath = requireOption(options, "output");
      const profileName = options["profile"] ?? "target17-new";
      const profile = getProfileOrUsage(profileName)!;
      const csv = `\ufeff${profile.headers.map(encodeCsvField).join(",")}`;
      writeOutput(run, files, outputPath, csv);
      run.written.push(outputPath);
      print({ operation: "template", output: files.abs(outputPath), profile: profileName });
      return run;
    }
    if (command === "adapters") {
      print({ operation: "adapters", adapters: ADAPTERS.map((adapter) => ({ id: adapter.id, label: adapter.label, required_params: adapter.requiredParams })) });
      return run;
    }
    throw new UsageFailure(`Unknown command '${command}'.\nRun "buildos export azure-boards --help" for the commands.`);
  } catch (error) {
    run.stdout = "";
    run.report = undefined;
    if (error instanceof UsageFailure || (error instanceof Error && error.message.startsWith("Unknown profile '"))) run.outcome = "usage";
    else if (error instanceof InputFailure || error instanceof SyntaxError || error instanceof TypeError) run.outcome = "input";
    else if (error instanceof ProjectFileError) {
      run.outcome = error.failure === "io" ? "io" : error.failure === "size" ? "contract" : "input";
      if (error.notRestored.length > 0) run.notRestored = error.notRestored;
    } else if (error instanceof Error) run.outcome = "contract";
    else throw error;
    run.stderr = `${(error as Error).message}\n`;
    return run;
  }
}

function getProfileOrUsage(name: string, allowAuto = false) {
  try {
    return getProfile(name, allowAuto);
  } catch (error) {
    throw new UsageFailure((error as Error).message);
  }
}

/** Writes one output file; a backup it could not remove is named on stderr and in the run (P9-R1-04, P9-R2-07). */
function writeOutput(run: ExportRun, files: ProjectFiles, outputPath: string, content: string): void {
  const plan = files.plan();
  plan.write(outputPath, content, { limit: READ_LIMITS.data });
  const { leftBehind } = plan.commit();
  for (const left of leftBehind) run.stderr += `BuildOS wrote the output, but could not delete ${left.path} (${left.reason}).\n`;
  if (leftBehind.length > 0) run.leftBehind = [...(run.leftBehind ?? []), ...leftBehind];
}

/** The JSON nesting bound of every JSON input of the skill-script commands (SD-06; P9-R1-16). */
export const JSON_MAX_DEPTH = 512;

/**
 * `JSON.parse(text)` with the depth bound: a document that nests more than
 * `JSON_MAX_DEPTH` arrays and objects is refused before it is parsed (exit
 * 3), so no later step recurses through it. Strings are skipped, so a bracket
 * inside a string does not count.
 */
export function parseJsonBounded(text: string, what: string): unknown {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x22) {
      for (i++; i < text.length; i++) {
        const d = text.charCodeAt(i);
        if (d === 0x5c) i++;
        else if (d === 0x22) break;
      }
    } else if (c === 0x5b || c === 0x7b) {
      if (++depth > JSON_MAX_DEPTH) throw new InputFailure(`${what} nests more than ${JSON_MAX_DEPTH} levels deep, so BuildOS did not read it`);
    } else if (c === 0x5d || c === 0x7d) depth--;
  }
  return JSON.parse(text);
}
