// W1 R7 P9 t11, A80: runs the three commands that replaced the skill scripts
// (`buildos extract bulk`, `buildos fitgap`, `buildos export azure-boards`) on
// a machine where Python cannot be found, from an installed BuildOS package.
//
// Usage, from toolkits/buildos/, with PATH set to the folders the run may use:
//
//   node scripts/no-python-smoke.ts --project <folder> --work <folder>
//
// <project> is a BuildOS project made by `buildos init`, with the package to
// test installed in its node_modules/ (`npm install --prefix <project>
// <tarball>`). <work> is a new or empty folder for the fixture copies.
//
// 1. PATH proof: no `python`, `python3`, or `py` program is on PATH (each
//    PATHEXT form on Windows). One found stops the run (exit 1).
// 2. The project wrapper `.os/scripts/buildos` (`buildos.cmd` on Windows), as
//    the skills call it: `help` lists the three domains (the published 0.1.0
//    has none of them, so an npx fallback cannot pass), and each skill's own
//    commands run: `extract bulk status`, `next`, and `template`; `fitgap
//    frame`; `export azure-boards adapters`, `template`, `emit` of both skill
//    manifests (each CSV byte for byte the skill's golden example), and
//    `validate`.
// 3. Every fixture case of the three commands (test/fixtures/skills/), run by
//    the installed package's own bin: each step's exit code is the one the
//    goldens give (the SD-01 rule table of test/golden/skills/divergences.json)
//    and it writes each file the golden step wrote. Text output and file
//    content are not compared here, because this run has the real clock;
//    test/skill-script-parity.test.ts compares them byte for byte with the
//    fixed clock, and the CI job also runs that test with this PATH.
//
// Exit codes: 0 every check passed; 1 a check failed; 2 the command was not
// written correctly. The output names a case, a step, and a check, never a
// fixture's content.

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDENS, SCRIPTS, loadCases, loadGolden, runCase, type Runner, type ScriptName, type StepResult } from "../test/golden/skills/scenario.ts";

const windows = process.platform === "win32";
const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
const SKILL = join(PACKAGE_ROOT, "..", "..", "system", ".os", "skills", "buildos-export-azure-boards");
const PREFIX: Record<ScriptName, string[]> = { "bulk-extract": ["extract", "bulk"], fitgap: ["fitgap"], "azure-boards": ["export", "azure-boards"] };

function usage(message: string): never {
  process.stderr.write(`no-python-smoke: ${message}\nUsage: node scripts/no-python-smoke.ts --project <folder> --work <folder>\n`);
  process.exit(2);
}

function parse(argv: string[]): { project: string; work: string } {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    const value = argv[i + 1];
    if ((name !== "--project" && name !== "--work") || value === undefined || value === "") usage(`unexpected argument ${JSON.stringify(name)}`);
    out[name.slice(2)] = resolve(value);
  }
  if (out["project"] === undefined) usage("--project is required");
  if (out["work"] === undefined) usage("--work is required");
  return { project: out["project"], work: out["work"] };
}

/** Every program named `name` on PATH (with each PATHEXT form on Windows). */
export function onPath(name: string, path = process.env["PATH"] ?? "", pathext = process.env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD"): string[] {
  const forms = windows ? ["", ...pathext.split(";").filter((e) => e !== "")].map((e) => `${name}${e}`) : [name];
  const found: string[] = [];
  for (const dir of path.split(delimiter)) {
    if (dir === "") continue;
    for (const form of forms) {
      const full = isAbsolute(dir) ? join(dir, form) : resolve(dir, form);
      try {
        if (statSync(full).isFile()) found.push(full);
      } catch {
        // Not there.
      }
    }
  }
  return found;
}

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;
/** One argument of a `.cmd` wrapper line for `cmd.exe /d /s /c` (the quoting test/golden/harness.ts uses for npm shims). */
function cmdArg(arg: string): string {
  const quoted = `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1")}"`;
  return quoted.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

/** Runs the project wrapper with `args` in `cwd`, as a skill does. */
function wrapper(project: string, args: string[], cwd: string, input?: Buffer): SpawnSyncReturns<string> {
  const options = { cwd, encoding: "utf8" as const, input, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 };
  if (!windows) return spawnSync(join(project, ".os", "scripts", "buildos"), args, options);
  const cmd = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe");
  const line = [join(project, ".os", "scripts", "buildos.cmd").replace(CMD_META, "^$1"), ...args.map(cmdArg)].join(" ");
  return spawnSync(cmd, ["/d", "/s", "/c", `"${line}"`], { ...options, windowsVerbatimArguments: true });
}

interface ExitRule {
  script: ScriptName;
  script_exit: number;
  buildos_exit: number;
  stderr?: string;
}
const exitRules = (JSON.parse(readFileSync(join(GOLDENS, "divergences.json"), "utf8")) as { divergences: { id: string; exit_rules?: ExitRule[] }[] }).divergences.find((d) => d.id === "SD-01")?.exit_rules ?? [];

/** The BuildOS exit code for a golden step (the same SD-01 table test/skill-script-parity.test.ts applies). */
export function expectedExit(script: ScriptName, golden: StepResult): number {
  if (golden.exit === 0) return 0;
  const rule = exitRules.find((r) => r.script === script && r.script_exit === golden.exit && (r.stderr === undefined || new RegExp(r.stderr).test(golden.stderr)));
  return rule === undefined ? -1 : rule.buildos_exit;
}

async function main(): Promise<number> {
  const { project, work } = parse(process.argv.slice(2));
  const problems: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  };

  // 1. PATH proof.
  const entries = (process.env["PATH"] ?? "").split(delimiter).filter((d) => d !== "").length;
  const pythons = ["python", "python3", "py"].flatMap((name) => onPath(name).map((full) => `${name} at ${full}`));
  if (pythons.length > 0) {
    process.stderr.write(`no-python-smoke: Python is on PATH, so this run proves nothing:\n${pythons.map((p) => `  ${p}\n`).join("")}`);
    process.exit(1);
  }
  process.stdout.write(`PATH: ${entries} folder(s); no python, python3, or py program on it.\n`);

  const bin = join(project, "node_modules", "build-os", "dist", "buildos.js");
  if (!existsSync(bin) || !existsSync(join(project, ".os", "manifest.json"))) usage("--project needs .os/manifest.json and node_modules/build-os (buildos init, then npm install --prefix)");
  if (existsSync(work) && readdirSync(work).length > 0) usage("--work must be a new or empty folder");
  mkdirSync(work, { recursive: true });

  // 2. The project wrapper, as the skills call it.
  const help = wrapper(project, ["help"], project);
  check(help.status === 0, "wrapper help: exit 0");
  for (const domain of ["extract", "fitgap", "export"]) check(new RegExp(`^\\s+${domain}\\b`, "m").test(help.stdout), `wrapper help: lists ${domain}`);

  const extract = join(work, "wrapper-extract");
  cpSync(join(PACKAGE_ROOT, "test", "fixtures", "skills", "bulk-extract", "bases", "library"), extract, { recursive: true });
  for (const args of [["status"], ["next", "--stage", "extract", "--count", "5"], ["template", "requirement"]]) {
    const r = wrapper(project, ["extract", "bulk", "--root", ".", ...args], extract);
    check(r.status === 0, `wrapper extract bulk ${args[0]}: exit 0 (got ${r.status})`);
  }

  const fitgap = join(work, "wrapper-fitgap");
  cpSync(join(PACKAGE_ROOT, "test", "fixtures", "skills", "fitgap", "bases", "library"), fitgap, { recursive: true });
  const frame = wrapper(project, ["fitgap", "frame", "--root", fitgap, "--frame", join(fitgap, "analysis", "frame.json")], work);
  check(frame.status === 0 && /frame OK/.test(frame.stdout), `wrapper fitgap frame: exit 0 and frame OK (got ${frame.status})`);

  const adapters = wrapper(project, ["export", "azure-boards", "adapters"], project);
  check(adapters.status === 0 && adapters.stdout.includes("dynamics-365-ce"), `wrapper export azure-boards adapters: exit 0 and lists the adapter (got ${adapters.status})`);
  const template = wrapper(project, ["export", "azure-boards", "template", "--output", "workspace/template.csv", "--profile", "target17-new"], project);
  check(template.status === 0 && readFileSync(join(project, "workspace", "template.csv")).equals(readFileSync(join(SKILL, "assets", "target-17-column-template.csv"))), `wrapper export azure-boards template: exit 0 and the skill's template (got ${template.status})`);
  for (const [manifest, golden, adapter] of [["assets/synthetic-manifest.json", "assets/synthetic-golden-example.csv", []], ["assets/adapters/dynamics-365-ce-manifest.json", "assets/adapters/dynamics-365-ce-golden-example.csv", ["--adapter", "dynamics-365-ce"]]] as const) {
    const emit = wrapper(project, ["export", "azure-boards", "emit", "--input", `.os/skills/buildos-export-azure-boards/${manifest}`, "--output", "workspace/azure-boards.csv", "--profile", "target17-new"], project);
    check(emit.status === 0, `wrapper export azure-boards emit ${manifest}: exit 0 (got ${emit.status})`);
    check(emit.status === 0 && readFileSync(join(project, "workspace", "azure-boards.csv")).equals(readFileSync(join(SKILL, ...golden.split("/")))), `wrapper export azure-boards emit ${manifest}: the skill's golden CSV byte for byte`);
    const validate = wrapper(project, ["export", "azure-boards", "validate", "--input", "workspace/azure-boards.csv", "--profile", "target17-new", ...adapter], project);
    check(validate.status === 0, `wrapper export azure-boards validate ${manifest}: exit 0 (got ${validate.status})`);
  }
  process.stdout.write(`wrapper: ${problems.length === 0 ? "every skill command passed" : `${problems.length} problem(s)`}\n`);

  // 3. Every fixture case, by the installed bin.
  const lines: string[] = [];
  for (const script of SCRIPTS) {
    const runner: Runner = async (args, dir, stdin) => {
      const r = spawnSync(process.execPath, [bin, ...PREFIX[script], "--root", dir, ...args], { cwd: dir, encoding: "utf8", input: stdin, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
      return { exit: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
    };
    let cases = 0;
    let steps = 0;
    const before = problems.length;
    for (const testCase of loadCases(script)) {
      cases++;
      const golden = loadGolden(script, testCase.id);
      const actual = await runCase(script, testCase, join(work, script), runner, (dir) => [dir]);
      if (actual.steps.length !== golden.steps.length) problems.push(`${script}/${testCase.id}: step count`);
      golden.steps.forEach((want, i) => {
        const got = actual.steps[i];
        if (got === undefined) return;
        steps++;
        const where = `${script}/${testCase.id} step ${want.step}`;
        const exit = expectedExit(script, want);
        if (exit < 0) problems.push(`${where}: no SD-01 rule for exit ${want.exit}`);
        else if (got.exit !== exit) problems.push(`${where}: exit ${got.exit}, expected ${exit}`);
        // Each file the golden step wrote is written here too. A removal (null) counts as no change, as
        // stateEqual in test/skill-script-parity.test.ts has it (SD-20 keeps a stale package). An extra
        // written file is allowed: with the real clock, a step can change a time that the fixed clock of
        // the goldens left the same (for example `decide` after `publish` in another second).
        const missing = Object.keys(want.files).filter((path) => want.files[path] !== null && (got.files[path] === undefined || got.files[path] === null));
        if (missing.length > 0) problems.push(`${where}: does not write ${missing.length} file(s) the golden step wrote`);
      });
    }
    lines.push(`${PREFIX[script].join(" ")}: ${cases} case(s), ${steps} step(s), ${problems.length === before ? "passed" : `${problems.length - before} problem(s)`}\n`);
  }
  process.stdout.write(lines.join(""));
  if (problems.length > 0) {
    process.stderr.write(`no-python-smoke: ${problems.length} problem(s):\n${problems.map((p) => `  ${p}\n`).join("")}`);
    return 1;
  }
  process.stdout.write("no-python-smoke: passed\n");
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
