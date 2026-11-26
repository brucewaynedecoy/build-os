// The Make Docs contract check (W1 R7 P6 t23; PRD 20 Make Docs Companion
// Setup; register Q-010 and R-001). BuildOS relies on only three Make Docs
// commands. This script runs each against one Make Docs program in a fresh
// temporary project and Make Docs home, and fails when a flag BuildOS passes
// or a JSON field BuildOS reads changes:
//
// 1. `make-docs --version` exits 0 and prints a version.
// 2. `make-docs setup --help` names every flag of the BuildOS setup call, and
//    `make-docs setup <BuildOS arguments>` exits 0 with JSON whose `status`
//    is `complete` (the one field `buildos init` reads).
// 3. `make-docs project state status --target-root <project> --json` exits 0
//    with JSON whose `status` is a string.
//
// Usage: node scripts/make-docs-contract.ts [--expect-version <x.y.z>] -- <program> [<args>...]
// For example: -- npx -y @brucewaynedecoy/make-docs@2.0.9
// The CI job `make-docs-contract` runs it at both bounds of MAKE_DOCS_RANGE.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeDocsSetupArgs } from "../src/core/init/make-docs.ts";

export interface ContractReport {
  version: string | undefined;
  problems: string[];
}

export function checkMakeDocsContract(program: readonly string[], options: { expectVersion?: string } = {}): ContractReport {
  const problems: string[] = [];
  const scratch = realpathSync(mkdtempSync(join(tmpdir(), "buildos-make-docs-contract-")));
  const project = join(scratch, "project");
  const home = join(scratch, "home");
  const env = { ...process.env, MAKE_DOCS_HOME: home, HOME: home, USERPROFILE: home, npm_config_update_notifier: "false" };
  const exec = (args: string[], cwd = scratch) => {
    const [file, ...lead] = program;
    const r = spawnSync(file!, [...lead, ...args], { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error };
  };
  const json = (text: string): Record<string, unknown> | undefined => {
    try {
      const value = JSON.parse(text) as unknown;
      return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  };
  let version: string | undefined;
  try {
    mkdirSync(project);
    mkdirSync(home);

    const v = exec(["--version"]);
    version = /\d+\.\d+\.\d+\S*/.exec(v.stdout)?.[0];
    if (v.status !== 0 || version === undefined) problems.push(`make-docs --version: exit ${String(v.status)}, stdout ${JSON.stringify(v.stdout.trim())}${v.error ? `, ${v.error.message}` : ""}`);
    else if (options.expectVersion !== undefined && version !== options.expectVersion) problems.push(`make-docs --version: expected ${options.expectVersion}, got ${version}`);

    const setupArgs = makeDocsSetupArgs(project);
    const help = exec(["setup", "--help"]);
    if (help.status !== 0) problems.push(`make-docs setup --help: exit ${String(help.status)}`);
    for (const flag of setupArgs.filter((a) => a.startsWith("--"))) {
      if (!new RegExp(`(?:^|\\s)${flag.replace(/[-]/g, "\\-")}(?=\\s|$|=|,)`, "m").test(help.stdout + help.stderr)) problems.push(`make-docs setup --help does not name ${flag}`);
    }
    const setup = exec(setupArgs, project);
    const setupJson = json(setup.stdout);
    if (setup.status !== 0) problems.push(`make-docs setup: exit ${String(setup.status)}: ${(setup.stderr.trim().split("\n")[0] ?? "").slice(0, 300)}`);
    if (setupJson === undefined) problems.push("make-docs setup --json: stdout is not one JSON object");
    else if (setupJson["status"] !== "complete") problems.push(`make-docs setup --json: status is ${JSON.stringify(setupJson["status"])}, not "complete"`);

    const state = exec(["project", "state", "status", "--target-root", project, "--json"], project);
    const stateJson = json(state.stdout);
    if (state.status !== 0) problems.push(`make-docs project state status: exit ${String(state.status)}`);
    if (stateJson === undefined || typeof stateJson["status"] !== "string") problems.push("make-docs project state status --json: no string status field");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return { version, problems };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const split = args.indexOf("--");
  const program = split < 0 ? [] : args.slice(split + 1);
  const flags = split < 0 ? args : args.slice(0, split);
  const expect = flags.indexOf("--expect-version");
  if (program.length === 0) {
    process.stderr.write("usage: node scripts/make-docs-contract.ts [--expect-version <x.y.z>] -- <program> [<args>...]\n");
    process.exit(2);
  }
  const report = checkMakeDocsContract(program, expect < 0 ? {} : { expectVersion: flags[expect + 1] ?? "" });
  for (const problem of report.problems) process.stdout.write(`FAIL ${problem}\n`);
  process.stdout.write(`make-docs contract: ${report.problems.length === 0 ? "pass" : "fail"} (make-docs ${report.version ?? "unknown"})\n`);
  process.exitCode = report.problems.length === 0 ? 0 : 1;
}
