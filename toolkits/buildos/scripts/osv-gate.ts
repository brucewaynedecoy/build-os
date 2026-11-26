// Decides the CI OSV job from the osv-scanner exit code and its JSON output.
//
// The scanner exit code is the only signal that the scan completed. A run that
// cannot reach the OSV API exits 127 and writes the same `{"results": []}` as a
// clean run, so the gate never trusts the JSON alone. It fails closed:
//
// - exit 0: the scan completed with no findings. The output must parse and hold
//   no findings.
// - exit 1: the scan completed with findings. The output must parse and hold at
//   least one finding. Severity filtering applies only here: the gate passes
//   only when every reported vulnerability sits in a group whose max_severity
//   is a complete CVSS score (0.0 to 10.0, at most one decimal place) below
//   7.0. A score of 7.0 or more, a score such as "6.99", a missing,
//   empty, or malformed score (for example "5.3garbage"), or a vulnerability
//   that no group names fails the gate.
// - in both cases, the whole report must have the osv-scanner shape: every
//   result, package record, group, and vulnerability is a well-formed object,
//   and every group ID names a reported vulnerability. See collectFindings.
// - any other exit code, a missing exit code, or a missing, unreadable, or
//   malformed output file fails the gate as an operational error.
//
// Usage: node scripts/osv-gate.ts --exit-code <n> <osv-results.json>

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** CVSS base score at or above which a finding is high or critical. */
export const HIGH_SEVERITY_SCORE = 7.0;

/** osv-scanner 2.x return codes that mean the scan completed. */
export const SCANNER_EXIT_CLEAN = 0;
export const SCANNER_EXIT_FINDINGS = 1;

const SCANNER_EXIT_MEANING: Record<number, string> = {
  127: "general error, for example the OSV API could not be reached",
  128: "no packages found in the lockfile",
};

export interface OsvFinding {
  package: string;
  version: string;
  ids: string[];
  /** The group `max_severity` text, or "" when the finding has no score. */
  maxSeverity: string;
  /** Why the finding has no usable score. Absent for a scored group. */
  unscored?: string;
}

export interface GateDecision {
  pass: boolean;
  /** Why the gate failed. Empty when it passed. */
  problems: string[];
  findings: OsvFinding[];
  blocking: OsvFinding[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/**
 * A CVSS base score as CVSS writes it: 0.0 to 10.0 in tenths, with at most one
 * decimal place. No sign, leading zero, space, exponent, or trailing text, so
 * "6.99", "07.0", "-0.0", " 7.0", and "7e0" are not scores.
 */
const CVSS_SCORE = /^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/;

/** The score in `text`, or undefined when it is not a complete CVSS base score. */
export function parseCvssScore(text: string): number | undefined {
  return CVSS_SCORE.test(text) ? Number(text) : undefined;
}

/** Reads an optional array field. Absent means empty; any other type is malformed. */
function optionalArray(record: Record<string, unknown>, field: string, where: string): unknown[] {
  const value = record[field];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${where} "${field}" is not an array`);
  return value;
}

/**
 * Reads findings from parsed osv-scanner JSON. Throws when any part of the
 * report is not the osv-scanner 2.x shape, so a malformed file cannot pass:
 *
 * - the report is an object with a `results` array;
 * - each result is an object with a `packages` array;
 * - each package record is an object with a `package` object that has a
 *   non-empty `name` and a string `version`, and optional `groups` and
 *   `vulnerabilities` arrays;
 * - each vulnerability is an object with a non-empty string `id`;
 * - each group is an object with a non-empty `ids` array of strings, each
 *   naming a vulnerability of the same package record, and an optional
 *   string `max_severity`.
 *
 * Each group is one finding. A vulnerability that no group names is an
 * unaccounted finding with no score, so it blocks.
 */
export function collectFindings(output: unknown): OsvFinding[] {
  if (!isRecord(output) || !Array.isArray(output["results"])) {
    throw new Error('output has no "results" array');
  }
  const findings: OsvFinding[] = [];
  output["results"].forEach((result: unknown, r: number) => {
    const resultWhere = `results[${r}]`;
    if (!isRecord(result) || !Array.isArray(result["packages"])) {
      throw new Error(`${resultWhere} is not an object with a "packages" array`);
    }
    result["packages"].forEach((entry: unknown, p: number) => {
      const where = `${resultWhere}.packages[${p}]`;
      if (!isRecord(entry)) throw new Error(`${where} is not an object`);
      const info = entry["package"];
      if (!isRecord(info) || !isNonEmptyString(info["name"]) || typeof info["version"] !== "string") {
        throw new Error(`${where}.package is not an object with a name and a version`);
      }
      const name = info["name"];
      const version = info["version"];

      const vulnerabilityIds = new Set<string>();
      optionalArray(entry, "vulnerabilities", where).forEach((vulnerability: unknown, v: number) => {
        if (!isRecord(vulnerability) || !isNonEmptyString(vulnerability["id"])) {
          throw new Error(`${where}.vulnerabilities[${v}] is not an object with a string "id"`);
        }
        vulnerabilityIds.add(vulnerability["id"]);
      });

      const grouped = new Set<string>();
      optionalArray(entry, "groups", where).forEach((group: unknown, g: number) => {
        const groupWhere = `${where}.groups[${g}]`;
        if (!isRecord(group)) throw new Error(`${groupWhere} is not an object`);
        const ids = group["ids"];
        if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isNonEmptyString)) {
          throw new Error(`${groupWhere}.ids is not a non-empty array of strings`);
        }
        for (const id of ids) {
          if (!vulnerabilityIds.has(id)) throw new Error(`${groupWhere} names ${id}, which is not in "vulnerabilities"`);
          grouped.add(id);
        }
        const severity = group["max_severity"];
        if (severity !== undefined && typeof severity !== "string") {
          throw new Error(`${groupWhere}.max_severity is not a string`);
        }
        const maxSeverity = severity ?? "";
        const finding: OsvFinding = { package: name, version, ids: [...ids], maxSeverity };
        if (parseCvssScore(maxSeverity) === undefined) {
          finding.unscored = maxSeverity === "" ? "no max_severity" : `max_severity ${JSON.stringify(maxSeverity)} is not a CVSS score`;
        }
        findings.push(finding);
      });

      const unaccounted = [...vulnerabilityIds].filter((id) => !grouped.has(id));
      if (unaccounted.length > 0) {
        findings.push({ package: name, version, ids: unaccounted, maxSeverity: "", unscored: "not in any group" });
      }
    });
  });
  return findings;
}

/** True when the finding blocks: no complete CVSS score, or a score of 7.0 or more. */
export function isBlocking(finding: OsvFinding): boolean {
  const score = parseCvssScore(finding.maxSeverity);
  return finding.unscored !== undefined || score === undefined || score >= HIGH_SEVERITY_SCORE;
}

/**
 * The gate decision. `outputText` is the scanner output file content, or
 * `undefined` when the file is missing or unreadable.
 */
export function evaluateGate(input: { scannerExitCode: number | undefined; outputText: string | undefined }): GateDecision {
  const { scannerExitCode, outputText } = input;
  const problems: string[] = [];
  if (scannerExitCode === undefined || !Number.isInteger(scannerExitCode)) {
    problems.push("scanner exit code is missing");
  } else if (scannerExitCode !== SCANNER_EXIT_CLEAN && scannerExitCode !== SCANNER_EXIT_FINDINGS) {
    const meaning = SCANNER_EXIT_MEANING[scannerExitCode] ?? "operational error";
    problems.push(`scanner exited ${scannerExitCode} (${meaning}); the scan did not complete`);
  }

  let findings: OsvFinding[] = [];
  if (outputText === undefined) {
    problems.push("scanner output file is missing or unreadable");
  } else {
    try {
      findings = collectFindings(JSON.parse(outputText) as unknown);
    } catch (error) {
      problems.push(`scanner output is malformed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (problems.length === 0) {
    if (scannerExitCode === SCANNER_EXIT_CLEAN && findings.length > 0) {
      problems.push(`scanner exited 0 but the output holds ${findings.length} finding(s)`);
    }
    if (scannerExitCode === SCANNER_EXIT_FINDINGS && findings.length === 0) {
      problems.push("scanner exited 1 (findings) but the output holds no finding");
    }
  }

  const blocking = findings.filter(isBlocking);
  if (problems.length === 0 && blocking.length > 0) {
    problems.push(`${blocking.length} high, critical, or unscored finding(s)`);
  }
  return { pass: problems.length === 0, problems, findings, blocking };
}

/** Parses `--exit-code <n> <file>`. Returns undefined on bad usage. */
export function parseGateArgs(argv: readonly string[]): { exitCode: number | undefined; file: string } | undefined {
  let exitCodeText: string | undefined;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--exit-code") {
      exitCodeText = argv[++i];
      if (exitCodeText === undefined) return undefined;
    } else if (arg.startsWith("--exit-code=")) {
      exitCodeText = arg.slice("--exit-code=".length);
    } else {
      positionals.push(arg);
    }
  }
  if (exitCodeText === undefined || positionals.length !== 1) return undefined;
  const trimmed = exitCodeText.trim();
  const exitCode = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  return { exitCode, file: positionals[0]! };
}

function readOptional(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseGateArgs(process.argv.slice(2));
  if (args === undefined) {
    process.stderr.write("usage: node scripts/osv-gate.ts --exit-code <scanner-exit-code> <osv-results.json>\n");
    process.exit(2);
  }
  const decision = evaluateGate({ scannerExitCode: args.exitCode, outputText: readOptional(args.file) });
  for (const finding of decision.findings) {
    const label = isBlocking(finding) ? "BLOCKING" : "below high";
    const note = finding.unscored === undefined ? "" : ` (unscored: ${finding.unscored})`;
    process.stdout.write(`${label}: ${finding.package}@${finding.version} ${finding.ids.join(",")} severity=${finding.maxSeverity || "none"}${note}\n`);
  }
  for (const problem of decision.problems) {
    process.stdout.write(`FAIL: ${problem}\n`);
  }
  process.stdout.write(
    `osv gate: scanner exit ${args.exitCode ?? "missing"}, ${decision.findings.length} finding(s), ${decision.blocking.length} blocking: ${decision.pass ? "pass" : "fail"}\n`,
  );
  process.exitCode = decision.pass ? 0 : 1;
}
