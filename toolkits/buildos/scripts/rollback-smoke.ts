// W1 R7 P9, F-P9-16 (F-P8-09): the rollback proof from the public registry.
// A project made with build-os 0.1.0 is upgraded to 0.2.0 and rolled back to
// 0.1.0 with the commands of the user guide, chapter 4 ("From 0.1.0 to
// 0.2.0" and "Roll back from 0.2.0 to 0.1.0"; scripts/rollback-steps.ts
// holds them). The `buildos-smoke` workflow runs it on ubuntu-latest,
// windows-latest, and macos-latest with Node 24 (source rollback, and every
// pull request that changes the smoke files); a maintainer can run it on any
// machine with the registry.
//
// Usage: node scripts/rollback-smoke.ts --out <folder>
//
// It makes the checks of the macOS hand proof of 2026-11-27 (the evidence
// report, "Rollback From 0.2.0 to 0.1.0 Through npx (F-P8-09)"). Every
// build-os comes from the registry through npx: the run makes no npm install
// of build-os, npm's global prefix is a new empty folder, and no `buildos` is
// on PATH (checked). The npm cache is a new empty folder. A project is made
// in {TMP}/original (git init, `npx -y build-os@0.1.0 init --skip-make-docs`,
// a commit) and copied to {TMP}/project, the test project. In the copy, each
// guide command runs as the guide writes it: through `sh -c` on Linux and
// macOS, and on Windows in its Command Prompt form (rollback-steps.ts), with
// `cmd /d /v:off /s /c`. Command Prompt asks before `copy` replaces a file;
// the run sets COPYCMD=/Y, which answers yes, as the guide tells a person at
// the prompt to do (review round 1 of pull request 15, finding 3). Upgrade step 6 (the pin) is an edit, made here by changing only
// that one field. After the rollback, the project wrapper must run the
// pinned 0.1.0 (its version, its JSON source revision equal to that of
// `npx -y build-os@0.1.0 version --json`, no 0.2.0 domain in help, and a
// 0.2.0 command stops with exit 2; on Windows the .cmd wrapper exits 0
// there, F-P9-17), the five compare commands against the backup print nothing, and the tree equals the "Before BuildOS 0.2.0"
// commit; the original project is untouched; and the npm cache holds only
// registry entries of build-os, with the registry's integrity for both
// tarballs.
//
// The captured output is cleaned for the report ({TMP}, {PROJECT},
// {ORIGINAL}, {HOME}, {USER}, {TIMESTAMP}, then any other absolute path). It
// writes <out>/rollback-<os>.json and <out>/rollback-<os>.md and exits 1 when
// a step fails, 2 on a usage error.
//
// F-P9-17 (pull-request run 46054715769, 2026-11-27): on Windows the project
// wrapper `.os\scripts\buildos.cmd`, on its npx route, exited 0 when the
// pinned 0.1.0 stopped with exit 2 (`capability-matrix --help`), and
// `.os\scripts\buildos-intake.cmd version` exited 0 where 0.1.0 stops with
// exit 1; stderr held the 0.1.0 error each time. Linux and macOS gave 2 and 1.
// The run asserts that true behavior on Windows (exit 0 and the 0.1.0 error
// text). The steps named "F-P9-17 evidence" find the layer that loses the
// code: they run the same failure through each layer of the wrapper's npx
// route, and on Windows they record the exit code without a check. Review
// round 1 of pull request 15, finding 2: on Windows one more evidence step
// starts the project's own helper directly with node.exe
// (`pinned-version.cjs --cmd <buildos.cmd> <manifest> capability-matrix
// --help`, no batch file) and records its exit code next to that of
// `buildos.cmd` for the same command: 2 there and 0 through the batch file
// is consistent with cause (b), the batch wrapper's own exit path, but does
// not isolate it (review round 2 of pull request 15, finding 1: the helper is
// started directly and the wrapper through cmd.exe, so the two do not run
// under the same shell); 0 in both shows cause (a), the cmd.exe that the
// helper starts for npm's npx.cmd. On Linux and
// macOS the same step starts the helper's `--npx` route directly and checks
// exit 2.
//
// The route guard (review round 1 of pull request 15, finding 1): the
// wrapper's helper runs a `node_modules/build-os` install in the project
// folder or in any folder above it, or above npm's local project folder, in
// place of npx, and npx without `--prefix` (the reference and setup
// commands) takes an install from npm's local project folder too. So before
// any npx command (with the repository's own helper, for the temporary root
// and every folder above it), again after the copy before the first wrapper
// run, and again after the last one (both with the project's own
// `.os/scripts/pinned-version.cjs`, for the test project and the original
// project), the run fails when any `node_modules/build-os` entry is in a
// folder that the helper's lookup reads (`wrapperLookupFolders`, with the
// helper's own `npmLocalPrefix`), when a buildos program is in a PATH folder
// as the helper reads PATH (on Windows with its own `splitWindowsPath`), or
// when npm's global prefix is not empty. The positive proof is the launch
// probe of scripts/published-smoke.ts (a preload through NODE_OPTIONS and
// npm's `node-options`): after the run, every Node.js process that it
// observed in each wrapper step has as its entry script the project's own
// helper, a program of the selected npm, or a bin file of the npx folder of
// the npm cache that holds build-os at the step's pin, and at least one is
// that bin file. What the probe cannot observe is PROBE_LIMIT.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir, userInfo } from "node:os";
import * as nodePath from "node:path";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { commandPromptArgs } from "./printed-fix-step.ts";
import { readCacheIndex, readNpxFolders } from "./smoke-evidence.ts";
import { launchProblems, launchRecords, npmPrograms, PROBE_LIMIT, PROBE_LOG_VARIABLE, PROBE_SOURCE, probeNodeOptions, scrubAbsolutePaths } from "./smoke-source.ts";
import {
  ALL_COMMANDS,
  ancestorInstalls,
  cacheProblems,
  fP917Reading,
  pathBuildosPrograms,
  wrapperLookupFolders,
  type WrapperHelper,
  changedLines,
  changePin,
  commandPromptForm,
  FROM_VERSION,
  helpDomains,
  NEW_DOMAINS,
  ROLLBACK_CHECK_COMPARE,
  ROLLBACK_CHECK_WRAPPER,
  ROLLBACK_PUT_BACK,
  TO_VERSION,
  UPGRADE_BACKUP,
  UPGRADE_CHECK_COMPARE,
  UPGRADE_CHECK_WRAPPER,
  UPGRADE_CLEAN_COPIES,
  UPGRADE_COMMIT,
  UPGRADE_FINAL_COMMIT,
  UPGRADE_FIND_CHANGES,
  UPGRADE_REFRESH,
  UPGRADE_WORK_FOLDER,
  type GuideCommand,
} from "./rollback-steps.ts";

export const ROLLBACK_USAGE = "Usage: node scripts/rollback-smoke.ts --out <folder>";
const LEGACY_NOTICE = 'Note: the command name "buildos-intake" goes away in BuildOS 0.3.0. Use "buildos intake" instead.';
const WINDOWS = process.platform === "win32";

function usage(message: string): never {
  process.stderr.write(`${message}\n${ROLLBACK_USAGE}\n`);
  process.exit(2);
}

const argv = process.argv.slice(2);
if (argv.length !== 2 || argv[0] !== "--out" || (argv[1] ?? "") === "" || argv[1]!.startsWith("--")) usage(argv.includes("--out") ? "--out needs a folder" : "--out is required");
const out = argv[1]!;

interface Step {
  name: string;
  command: string;
  exit: number | null;
  expected_exit: number | null;
  stdout: string;
  stderr: string;
  checks: { check: string; ok: boolean }[];
  ok: boolean;
}

/** The npm installation next to the Node.js that runs the script (as in scripts/published-smoke.ts), or undefined. */
function npmInstallation(): string | undefined {
  const nodeDir = dirname(process.execPath);
  for (const dir of [join(nodeDir, "node_modules", "npm"), join(nodeDir, "..", "lib", "node_modules", "npm")]) {
    if (existsSync(join(dir, "bin", "npm-cli.js")) && existsSync(join(dir, "bin", "npx-cli.js"))) return realpathSync.native(dir);
  }
  return undefined;
}
const npmRoot = npmInstallation();
function npmTool(name: "npx" | "npm"): { file: string; prefix: string[]; shell: boolean } {
  if (npmRoot !== undefined) return { file: process.execPath, prefix: [join(npmRoot, "bin", `${name}-cli.js`)], shell: false };
  return { file: name, prefix: [], shell: WINDOWS };
}

const root = realpathSync.native(mkdtempSync(join(tmpdir(), "buildos-rollback-")));
const cache = join(root, "npm-cache");
const globalPrefix = join(root, "npm-prefix");
mkdirSync(cache);
mkdirSync(globalPrefix);
const original = join(root, "original");
const project = join(root, "project");
// The launch probe (finding 1 of review round 1 of pull request 15), as in scripts/published-smoke.ts.
const probeDir = join(root, "launch-probe");
const probe = join(probeDir, "probe.cjs");
mkdirSync(probeDir);
writeFileSync(probe, PROBE_SOURCE);
const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_(cache|prefix|ignore[-_]scripts|update[-_]notifier|fund|audit|node[-_]options)$/i.test(key) && !/^node_options$/i.test(key) && key.toUpperCase() !== PROBE_LOG_VARIABLE && !key.startsWith("BUILDOS_") && !/^GIT_/.test(key))),
  NODE_OPTIONS: probeNodeOptions(probe),
  npm_config_node_options: probeNodeOptions(probe),
  npm_config_cache: cache,
  npm_config_prefix: globalPrefix,
  npm_config_ignore_scripts: "true",
  npm_config_update_notifier: "false",
  npm_config_fund: "false",
  npm_config_audit: "false",
  GIT_AUTHOR_NAME: "BuildOS rollback smoke",
  GIT_AUTHOR_EMAIL: "rollback-smoke@example.invalid",
  GIT_COMMITTER_NAME: "BuildOS rollback smoke",
  GIT_COMMITTER_EMAIL: "rollback-smoke@example.invalid",
  ...(WINDOWS ? { COPYCMD: "/Y" } : {}),
};

function spellings(path: string): string[] {
  const forms = new Set<string>([path]);
  try {
    forms.add(realpathSync(path));
    forms.add(realpathSync.native(path));
  } catch {
    // The given form is enough.
  }
  for (const f of [...forms]) {
    if (f.startsWith("/private/")) forms.add(f.slice("/private".length));
    else if (f.startsWith("/var/") || f.startsWith("/tmp/")) forms.add(`/private${f}`);
  }
  for (const f of [...forms]) {
    const once = JSON.stringify(f).slice(1, -1);
    forms.add(once);
    forms.add(JSON.stringify(once).slice(1, -1));
    if (WINDOWS) forms.add(f.replace(/\\/g, "/"));
  }
  return [...forms].filter((f) => f.length > 1).sort((a, b) => b.length - a.length);
}

function clean(text: string): string {
  let t = text.replace(/\r\n/g, "\n");
  const pairs: [string, string][] = [];
  for (const s of spellings(project)) pairs.push([s, "{PROJECT}"]);
  for (const s of spellings(original)) pairs.push([s, "{ORIGINAL}"]);
  if (npmRoot !== undefined) for (const s of spellings(npmRoot)) pairs.push([s, "{NPM}"]);
  for (const s of spellings(root)) pairs.push([s, "{TMP}"]);
  for (const s of spellings(tmpdir())) pairs.push([s, "{TMP}"]);
  for (const s of spellings(homedir())) pairs.push([s, "{HOME}"]);
  for (const [from, to] of pairs) t = t.split(from).join(to);
  const user = userInfo().username;
  if (user.length >= 3) t = t.split(user).join("{USER}");
  return t.replace(/(timestamp|initialized_at)(": "|: )[0-9TZ:.-]+"/g, '$1$2{TIMESTAMP}"');
}

const steps: Step[] = [];
/** The launch log of each step that started a process. */
const stepLaunchLog = new WeakMap<Step, string>();
/** Each run of the project wrapper (or of its helper, started directly), with the pin and the project folder at the time of the run. */
const wrapperRuns: { step: Step; pin: string; dir: string }[] = [];

function run(name: string, shown: string, file: string, args: string[], expected: number | null, cwd: string, opts: { shell?: boolean; verbatim?: boolean; extraEnv?: NodeJS.ProcessEnv; wrapperRoute?: boolean } = {}): Step {
  const launchLog = join(probeDir, `step-${steps.length + 1}.jsonl`);
  const options: SpawnSyncOptions = {
    cwd,
    env: { ...env, ...opts.extraEnv, [PROBE_LOG_VARIABLE]: launchLog },
    // No TTY. stdin is an empty pipe, not closed: some Command Prompt programs (xcopy) need a stdin handle.
    input: "",
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
    shell: opts.shell ?? false,
    windowsVerbatimArguments: opts.verbatim ?? false,
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  };
  const r = spawnSync(file, args, options);
  const step: Step = {
    name,
    command: shown,
    exit: r.status,
    expected_exit: expected,
    stdout: String(r.stdout ?? "").replace(/\r\n/g, "\n"),
    stderr: (String(r.stderr ?? "") + (r.error ? `\n[spawn error] ${r.error.message}` : "")).replace(/\r\n/g, "\n"),
    checks: expected === null ? [] : [{ check: `exit code ${expected}`, ok: r.status === expected }],
    ok: false,
  };
  steps.push(step);
  stepLaunchLog.set(step, launchLog);
  if (opts.wrapperRoute === true || /^\.os[\\/]scripts[\\/]/.test(shown)) wrapperRuns.push({ step, pin: readPin(cwd), dir: cwd });
  return step;
}

function check(step: Step, what: string, ok: boolean): void {
  step.checks.push({ check: what, ok });
}

/** A guide command, as the guide writes it for this system, in the given folder. */
function guide(c: GuideCommand, expected: number | null, cwd = project): Step {
  if (WINDOWS) {
    const line = commandPromptForm(c.sh);
    return run(`${c.step}: ${line}`, line, process.env["ComSpec"] ?? "cmd.exe", commandPromptArgs(line), expected, cwd, { verbatim: true });
  }
  return run(`${c.step}: ${c.sh}`, c.sh, "/bin/sh", ["-c", c.sh], expected, cwd);
}

function plain(name: string, file: string, args: string[], expected: number, cwd: string): Step {
  return run(name, [file === process.execPath ? "node" : file, ...args].join(" "), file, args, expected, cwd);
}

/**
 * F-P9-17 evidence: one shell line in the test project (Command Prompt on
 * Windows, sh elsewhere). Linux and macOS check `posixExit`; Windows records
 * the exit code with no check, because the cause of F-P9-17 is not known yet.
 */
function evidenceLine(name: string, windowsLine: string, posixLine: string, posixExit: number): Step {
  if (WINDOWS) return run(`${name}: ${windowsLine}`, windowsLine, process.env["ComSpec"] ?? "cmd.exe", commandPromptArgs(windowsLine), null, project, { verbatim: true });
  return run(`${name}: ${posixLine}`, posixLine, "/bin/sh", ["-c", posixLine], posixExit, project);
}

/** The stderr of a BuildOS usage error for an unknown command, as `version` prints it. */
function unknownCommand(stderr: string, version: string, command: string): boolean {
  return stderr.includes(`version: ${version}\n`) && stderr.includes(`ERROR [usage_error]: unknown command "${command}"`);
}

function npxRun(name: string, args: string[], expected: number, cwd: string): Step {
  const t = npmTool("npx");
  return run(name, `npx ${args.join(" ")}`, t.file, [...t.prefix, ...args], expected, cwd, { shell: t.shell });
}

/** A step that starts no process: it reads the disk and records each problem in stderr. */
function evidenceStep(name: string, what: string, stdout: string, checks: { check: string; problems: string[] }[]): Step {
  const step: Step = { name, command: what, exit: null, expected_exit: null, stdout, stderr: checks.flatMap((c) => c.problems).map((p) => `${p}\n`).join(""), checks: checks.map((c) => ({ check: c.check, ok: c.problems.length === 0 })), ok: false };
  steps.push(step);
  return step;
}

function readPin(dir: string): string {
  try {
    return (JSON.parse(readFileSync(join(dir, ".os", "manifest.json"), "utf8")) as { buildos_version?: string }).buildos_version ?? "";
  } catch {
    return "";
  }
}

function parseJson(text: string): { ok?: boolean; version?: string; source_revision?: string } {
  try {
    return JSON.parse(text) as { version?: string; source_revision?: string };
  } catch {
    return {};
  }
}

/** The project wrapper, as the guide runs it (`.os/scripts/buildos ...`; Windows `.os\scripts\buildos.cmd ...`). */
function wrapper(name: string, args: string, expected: number, cwd = project): Step {
  return guide({ step: name, sh: `.os/scripts/buildos ${args}`, guide: "literal" }, expected, cwd);
}

const os = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : process.platform;

function finish(stopped?: string): never {
  for (const s of steps) s.ok = s.checks.every((c) => c.ok);
  const passed = stopped === undefined && steps.every((s) => s.ok);
  let removed = 0;
  const scrub = (text: string): string => {
    const r = scrubAbsolutePaths(clean(text));
    removed += r.removed;
    return r.text;
  };
  // A step name can hold the test project's folder (an F-P9-17 evidence step): clean() replaces it with {PROJECT}.
  const reported = steps.map((s) => ({ ...s, name: clean(s.name), command: scrub(s.command), stdout: scrub(s.stdout), stderr: scrub(s.stderr), checks: s.checks.map((c) => ({ ...c, check: scrub(c.check) })) }));
  const t = npmTool("npm");
  const npmVersion = spawnSync(t.file, [...t.prefix, "--version"], { env, encoding: "utf8", shell: t.shell, cwd: root }).stdout?.toString().trim() ?? "";
  const report = {
    proof: `rollback of build-os@${TO_VERSION} to build-os@${FROM_VERSION} with the user guide's steps (chapter 4), every build-os from the public npm registry through npx`,
    from: `build-os@${FROM_VERSION}`,
    to: `build-os@${TO_VERSION}`,
    shell: WINDOWS ? "Command Prompt (cmd /d /v:off /s /c), the guide's Windows form, COPYCMD=/Y" : "sh -c, the guide's commands as written",
    os,
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
    npm: npmVersion,
    npm_cache: "a new empty folder below {TMP}",
    npm_global_prefix: "a new empty folder below {TMP}",
    paths_replaced: "{TMP} temporary root, {PROJECT} the test project, {ORIGINAL} the original project, {HOME} home folder, {USER} user name, {TIMESTAMP} times, {NPM} the npm installation; any other absolute path is replaced by {ABSOLUTE-PATH} (absolute_paths_removed)",
    absolute_paths_removed: removed,
    passed,
    ...(stopped !== undefined ? { stopped } : {}),
    steps: reported,
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `rollback-${os}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const md: string[] = [`# build-os rollback ${TO_VERSION} to ${FROM_VERSION} on ${os}`, "", `Node ${process.version}, npm ${npmVersion}, ${process.platform} ${process.arch}, ${report.shell}. Result: ${passed ? "passed" : "FAILED"}. Paths are replaced as stated in the JSON report.`, ""];
  if (stopped !== undefined) md.push(`Stopped: ${stopped}`, "");
  for (const s of reported) {
    md.push(`## ${s.ok ? "pass" : "FAIL"}: ${s.name}`, "", s.exit === null && s.expected_exit === null ? `Check: ${s.command}.` : `Command: \`${s.command}\` (exit ${s.exit}${s.expected_exit !== null ? `, expected ${s.expected_exit}` : ""})`, "");
    for (const c of s.checks) md.push(`- ${c.ok ? "ok" : "FAILED"}: ${c.check}`);
    md.push("", "stdout:", "", "```text", s.stdout.replace(/\n$/, ""), "```", "", "stderr:", "", "```text", s.stderr.replace(/\n$/, ""), "```", "");
  }
  writeFileSync(join(out, `rollback-${os}.md`), md.join("\n"));
  process.stdout.write(`build-os rollback ${TO_VERSION} to ${FROM_VERSION} on ${os}: ${passed ? "passed" : "FAILED"} (${steps.filter((s) => s.ok).length} of ${steps.length} steps)\n`);
  if (stopped !== undefined) process.stdout.write(`  STOPPED: ${stopped}\n`);
  for (const s of steps) if (!s.ok) process.stdout.write(`  FAILED: ${clean(s.name)}: ${s.checks.filter((c) => !c.ok).map((c) => clean(c.check)).join("; ")}\n`);
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  process.exit(passed ? 0 : 1);
}

/** Stops the run when a step failed that later steps need. */
function need(step: Step, what: string): void {
  if (!step.checks.every((c) => c.ok)) finish(`${what} failed, so the later steps did not run`);
}

/** True when an entry of any kind (a link too) is at `path`. */
function entryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** The functions of a pinned-version.cjs helper that the route guard uses, or the reason it cannot be loaded. */
function loadHelper(file: string): WrapperHelper | string {
  try {
    const h = createRequire(import.meta.url)(file) as Partial<WrapperHelper>;
    if (typeof h.npmLocalPrefix !== "function" || typeof h.splitWindowsPath !== "function") return `${file} does not export npmLocalPrefix and splitWindowsPath`;
    return h as WrapperHelper;
  } catch (e) {
    return `${file} cannot be loaded (${(e as Error).message})`;
  }
}

/** The PATH value of the run's environment (any spelling of the name, as Windows reads it). */
const pathValue = Object.entries(env).find(([k]) => (WINDOWS ? k.toUpperCase() === "PATH" : k === "PATH"))?.[1] ?? "";

/**
 * The route guard (finding 1 of review round 1 of pull request 15): no
 * `node_modules/build-os` entry in any folder that the helper `helperFile`
 * reads for a run in each project folder of `places`, no buildos program in
 * a PATH folder as that helper reads PATH, and npm's global prefix empty. So
 * the wrapper (and npx) can only run a version that npx fetches.
 */
function routeGuard(name: string, helperFile: string, helperLabel: string, places: readonly string[]): Step {
  const helper = loadHelper(helperFile);
  const installs: string[] = [];
  const programs: string[] = [];
  let folders = 0;
  if (typeof helper !== "string") {
    for (const dir of places) {
      const lookup = wrapperLookupFolders(dir, dir, helper, nodePath);
      folders += lookup.length;
      installs.push(...ancestorInstalls(lookup, entryExists, nodePath));
      programs.push(...pathBuildosPrograms(pathValue, dir, WINDOWS, helper, entryExists, nodePath));
    }
  }
  const prefix = readdirSync(globalPrefix);
  return evidenceStep(
    name,
    `no process; with the lookup of ${helperLabel} (npmLocalPrefix, splitWindowsPath), it reads each folder of the wrapper's node_modules lookup for ${places.map((d) => clean(d)).join(" and ")}, each PATH folder, and npm's global prefix`,
    `${folders} lookup folders read (each project folder and each folder above it, then npm's local project folder and each folder above it)\n`,
    [
      { check: `the helper ${helperLabel} loads`, problems: typeof helper === "string" ? [helper] : [] },
      { check: "no node_modules/build-os entry (of any kind, any version) in a folder that the wrapper's lookup reads (so no local install can stand in for npx)", problems: [...new Set(installs)].map((f) => `found ${f}`) },
      { check: "no buildos program in a PATH folder, PATH read as the wrapper's helper reads it (so the wrapper finds no global install)", problems: [...new Set(programs)].map((f) => `found ${f}`) },
      { check: "npm's global prefix is empty (so npx finds no global install)", problems: prefix.length > 0 ? [`the global prefix holds ${prefix.join(", ")}`] : [] },
    ],
  );
}

// 0. The route guard before any npx command: the repository's own helper (the
// same file as the project wrappers of 0.1.0 and 0.2.0), for the temporary
// root and each folder above it. Every folder of the run is in the root.
const repositoryHelper = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "system", ".os", "scripts", "pinned-version.cjs");
// Review round 2 of pull request 15, finding 3: a failed guard stops the run here, before any command runs on a disqualified route.
need(routeGuard("route guard (before any npx command)", repositoryHelper, "system/.os/scripts/pinned-version.cjs of this repository", [root]), "the route guard (before any npx command)");

// 1. The reference versions, from the registry.
const revision: Record<string, string> = {};
for (const v of [FROM_VERSION, TO_VERSION]) {
  const dir = join(root, `reference-${v}`);
  mkdirSync(dir);
  const s = npxRun(`reference: npx -y build-os@${v} version --json`, ["-y", `build-os@${v}`, "version", "--json"], 0, dir);
  const j = parseJson(s.stdout);
  revision[v] = j.source_revision ?? "";
  check(s, `JSON version ${v} and a full source revision`, j.version === v && /^[0-9a-f]{40}$/.test(revision[v]!));
  need(s, `npx -y build-os@${v} version --json`);
}

// 2. The original project, made with 0.1.0, committed; the copy is the test project.
mkdirSync(original);
{
  need(plain("setup: git init (original)", "git", ["init", "-q"], 0, original), "git init");
  const init = npxRun(`setup: npx -y build-os@${FROM_VERSION} init --skip-make-docs (original)`, ["-y", `build-os@${FROM_VERSION}`, "init", "--skip-make-docs"], 0, original);
  check(init, `.os/manifest.json pins ${FROM_VERSION}`, readPin(original) === FROM_VERSION);
  need(init, "the setup init");
  need(plain("setup: git add -A (original)", "git", ["add", "-A"], 0, original), "git add");
  need(plain("setup: git commit (original)", "git", ["commit", "-q", "-m", `BuildOS ${FROM_VERSION}`], 0, original), "git commit");
  cpSync(original, project, { recursive: true, verbatimSymlinks: true });
  const status = plain("setup: the copy is clean (git status --porcelain)", "git", ["status", "--porcelain"], 0, project);
  check(status, "git status prints nothing", status.stdout === "");
  const apps = [".claude", ".agents", ".github"].filter((d) => existsSync(join(project, d)));
  check(status, "no app folder (.claude, .agents, .github), so the app-folder steps do not apply", apps.length === 0);
  need(status, "the copy");
}
need(routeGuard("route guard (before the first wrapper run)", join(project, ".os", "scripts", "pinned-version.cjs"), "the test project's .os/scripts/pinned-version.cjs", [project, original]), "the route guard (before the first wrapper run)");

// Upgrade step 1: commit ("nothing to commit" is fine), the work folder, the backup.
guide(UPGRADE_COMMIT[0]!, 0);
{
  const s = guide(UPGRADE_COMMIT[1]!, null);
  check(s, "exit 0, or exit 1 with git's \"nothing to commit\" (the guide: that is fine)", s.exit === 0 || (s.exit === 1 && /nothing to commit/.test(s.stdout)));
}
const before = plain("upgrade 1: the \"Before BuildOS 0.2.0\" commit (git rev-parse HEAD)", "git", ["rev-parse", "HEAD"], 0, project).stdout.trim();
{
  const s = guide(UPGRADE_WORK_FOLDER, 0);
  check(s, "it prints nothing (the work folder was not there)", s.stdout === "" && s.stderr === "");
  need(s, "the work folder");
}
for (const c of UPGRADE_BACKUP) need(guide(c, 0), c.sh);

// Upgrade step 2: clean copies of both versions.
for (const [i, c] of UPGRADE_CLEAN_COPIES.entries()) {
  const s = guide(c, 0);
  const v = i === 0 ? FROM_VERSION : TO_VERSION;
  const dir = join(root, "buildos-upgrade", i === 0 ? "old" : "new");
  check(s, `stdout says "Done." and ${i === 0 ? "old" : "new"}/.os/manifest.json pins ${v}`, s.stdout.includes("Done.") && readPin(dir) === v);
  need(s, c.sh);
}

// Upgrade step 3: no own changes.
for (const c of UPGRADE_FIND_CHANGES) {
  const s = guide(c, 0);
  check(s, "it prints nothing (no own change)", s.stdout === "");
}

// Upgrade step 4: refresh. Step 5: the step 3 list is empty, so nothing to put back.
for (const c of UPGRADE_REFRESH) need(guide(c, 0), c.sh);

// Upgrade step 6: the pin, one field.
{
  const file = join(project, ".os", "manifest.json");
  const text = readFileSync(file, "utf8");
  const next = changePin(text, FROM_VERSION, TO_VERSION);
  if (next !== undefined) writeFileSync(file, next);
  evidenceStep(`upgrade 6: change "buildos_version" from "${FROM_VERSION}" to "${TO_VERSION}" in .os/manifest.json`, "an edit of one field; no process", next !== undefined ? clean(next) : "", [
    { check: "the field is there exactly once, and exactly one line changed", problems: next === undefined ? ["the manifest does not hold the field exactly once"] : changedLines(text, next) === 1 ? [] : ["not exactly one line changed"] },
    { check: "no node_modules folder in the project (no npm install of build-os)", problems: existsSync(join(project, "node_modules")) ? ["the project has a node_modules folder"] : [] },
  ]);
}

// Upgrade step 7: the checks, then commit.
{
  const [version, help, adapters, cm] = UPGRADE_CHECK_WRAPPER.map((c) => guide(c, 0));
  check(version!, `stdout names version ${TO_VERSION}`, version!.stdout.includes(`version: ${TO_VERSION}\n`));
  check(version!, `stdout names the ${TO_VERSION} source revision of the registry package`, version!.stdout.includes(revision[TO_VERSION]!));
  const domains = helpDomains(help!.stdout);
  check(help!, `help lists ${NEW_DOMAINS.join(", ")}`, NEW_DOMAINS.every((d) => domains.includes(d)));
  check(adapters!, "it lists dynamics-365-ce", adapters!.stdout.includes("dynamics-365-ce"));
  check(cm!, "it prints the usage of buildos capability-matrix", /buildos capability-matrix /.test(cm!.stdout + cm!.stderr));
  const json = wrapper("upgrade 7 (also)", "version --json", 0);
  const j = parseJson(json.stdout);
  check(json, `JSON version ${TO_VERSION} and the source revision of npx -y build-os@${TO_VERSION}`, j.version === TO_VERSION && j.source_revision === revision[TO_VERSION]);
  // F-P9-17 evidence: does the wrapper lose the exit code with the 0.2.0 pin too?
  const bad = evidenceLine("upgrade 7 (F-P9-17 evidence)", ".os\\scripts\\buildos.cmd no-such-command", ".os/scripts/buildos no-such-command", 2);
  check(bad, `${TO_VERSION} runs it and stops with unknown command "no-such-command" (stderr)`, unknownCommand(bad.stderr, TO_VERSION, "no-such-command"));
}
for (const c of UPGRADE_CHECK_COMPARE) {
  const s = guide(c, 0);
  check(s, "it prints nothing (the skill is the clean 0.2.0 copy)", s.stdout === "");
}
for (const c of UPGRADE_FINAL_COMMIT) need(guide(c, 0), c.sh);

// The rollback, steps 1 and 2 (steps 3 and 4 do not apply: no app folder, no npm install).
for (const c of ROLLBACK_PUT_BACK) need(guide(c, 0), c.sh);

// Rollback step 5: the checks. The wrapper runs the pinned 0.1.0.
{
  const pin = readPin(project);
  evidenceStep(`rollback 5: .os/manifest.json pins ${FROM_VERSION}`, "no process; it reads .os/manifest.json", `buildos_version: ${pin}\n`, [{ check: `"buildos_version" is "${FROM_VERSION}"`, problems: pin === FROM_VERSION ? [] : [`it is "${pin}"`] }]);
  const v = guide(ROLLBACK_CHECK_WRAPPER, 0);
  check(v, `stdout names version ${FROM_VERSION}`, v.stdout.includes(`version: ${FROM_VERSION}\n`));
  check(v, `stdout names the ${FROM_VERSION} source revision of the registry package`, v.stdout.includes(revision[FROM_VERSION]!));
  const vj = wrapper("rollback 5 (also)", "version --json", 0);
  const j = parseJson(vj.stdout);
  check(vj, `JSON version ${FROM_VERSION} and the source revision of npx -y build-os@${FROM_VERSION}`, j.version === FROM_VERSION && j.source_revision === revision[FROM_VERSION]);
  const help = wrapper("rollback 5 (also)", "help", 0);
  const domains = helpDomains(help.stdout);
  check(help, `help lists none of ${NEW_DOMAINS.join(", ")}, and lists version`, domains.includes("version") && NEW_DOMAINS.every((d) => !domains.includes(d)));
  // F-P9-17: 0.1.0 stops with exit 2 here (the guide: "exit code 2"). On
  // Windows the .cmd wrapper exits 0 on its npx route (run 46054715769), so
  // there the run asserts 0, the true behavior, until F-P9-17 is fixed.
  const cm = wrapper("rollback 5 (also)", "capability-matrix --help", WINDOWS ? 0 : 2);
  check(cm, `${FROM_VERSION} runs it and stops with unknown command "capability-matrix" (stderr: version ${FROM_VERSION} and the usage error)`, unknownCommand(cm.stderr, FROM_VERSION, "capability-matrix"));
  // F-P9-17 evidence (finding 2 of review round 1 of pull request 15): the
  // same command through the project's own helper, started directly by
  // node.exe (no batch file), with the variables that buildos.cmd sets.
  const helperFile = join(project, ".os", "scripts", "pinned-version.cjs");
  if (WINDOWS) {
    const self = join(project, ".os", "scripts", "buildos.cmd");
    const manifest = join(project, ".os", "scripts", "..", "manifest.json");
    const args = [helperFile, "--cmd", self, manifest, "capability-matrix", "--help"];
    const direct = run(`rollback 5 (F-P9-17 evidence): node.exe .os\\scripts\\pinned-version.cjs --cmd .os\\scripts\\buildos.cmd <manifest> capability-matrix --help (no batch file)`, ["node", ...args].join(" "), process.execPath, args, null, project, { extraEnv: { BUILDOS_WRAPPER_ACTIVE: "1", NoDefaultCurrentDirectoryInExePath: "1" }, wrapperRoute: true });
    check(direct, `${FROM_VERSION} runs it and stops with unknown command "capability-matrix" (stderr)`, unknownCommand(direct.stderr, FROM_VERSION, "capability-matrix"));
    evidenceStep("rollback 5 (F-P9-17 evidence): which layer loses the exit code", "no process; it compares the exit code of the helper started directly by node.exe with that of buildos.cmd started through cmd.exe, for the same command (recorded, no check; the two do not run under the same cmd.exe)", `node.exe pinned-version.cjs --cmd ... capability-matrix --help: exit ${direct.exit}\n.os\\scripts\\buildos.cmd capability-matrix --help: exit ${cm.exit}\n${fP917Reading(direct.exit, cm.exit, 2)}\n`, []);
  } else if (npmRoot !== undefined) {
    const args = [helperFile, "--npx", join(npmRoot, "bin", "npx-cli.js"), FROM_VERSION, "capability-matrix", "--help"];
    const direct = run("rollback 5 (F-P9-17 evidence): node .os/scripts/pinned-version.cjs --npx <npx> 0.1.0 capability-matrix --help (the helper's npx route, started directly)", ["node", ...args].join(" "), process.execPath, args, 2, project, { extraEnv: { BUILDOS_WRAPPER_ACTIVE: "1" }, wrapperRoute: true });
    check(direct, `${FROM_VERSION} runs it and stops with unknown command "capability-matrix" (stderr)`, unknownCommand(direct.stderr, FROM_VERSION, "capability-matrix"));
  }
  // F-P9-17: 0.1.0 exits 1 here; on Windows the .cmd wrapper exits 0, as above.
  const legacy = guide({ step: "rollback 5 (also)", sh: ".os/scripts/buildos-intake version", guide: "literal" }, WINDOWS ? 0 : 1);
  check(legacy, `the legacy project script runs ${FROM_VERSION}: its notice, and "unknown command" for version (it shows the legacy route works; the version itself is shown by the wrapper checks above)`, legacy.stderr.startsWith(`${LEGACY_NOTICE}\n`) && legacy.stderr.includes('buildos-intake: error: unknown command "version"'));
}
// F-P9-17 evidence: the same 0.1.0 failure through each layer of the
// wrapper's npx route. npx-cli.js started by node (no Command Prompt layer
// above npm), then npx in the shell (on Windows npm's npx.cmd), then npx in
// the shell with the wrapper's own npx arguments (pinned-version.cjs:
// --prefix with the project folder, --workspaces=false). The wrapper itself
// is the step "rollback 5 (also): ... capability-matrix --help" above.
{
  const t = npmTool("npx");
  const direct = run(`rollback 5 (F-P9-17 evidence): node npx-cli.js -y build-os@${FROM_VERSION} capability-matrix --help`, `npx -y build-os@${FROM_VERSION} capability-matrix --help (npx-cli.js started by node)`, t.file, [...t.prefix, "-y", `build-os@${FROM_VERSION}`, "capability-matrix", "--help"], WINDOWS ? null : 2, project, { shell: t.shell });
  const shell = evidenceLine("rollback 5 (F-P9-17 evidence)", `npx -y build-os@${FROM_VERSION} capability-matrix --help`, `npx -y build-os@${FROM_VERSION} capability-matrix --help`, 2);
  const wrapperArgs = evidenceLine("rollback 5 (F-P9-17 evidence)", `npx -y --prefix "${project}" --workspaces=false build-os@${FROM_VERSION} capability-matrix --help`, `npx -y --prefix '${project}' --workspaces=false build-os@${FROM_VERSION} capability-matrix --help`, 2);
  for (const s of [direct, shell, wrapperArgs]) check(s, `${FROM_VERSION} runs it and stops with unknown command "capability-matrix" (stderr)`, unknownCommand(s.stderr, FROM_VERSION, "capability-matrix"));
}
for (const c of ROLLBACK_CHECK_COMPARE) {
  const s = guide(c, 0);
  check(s, "it prints nothing (the skill is the backup)", s.stdout === "");
}
{
  plain("rollback 5 (also): git add -A", "git", ["add", "-A"], 0, project);
  const s = plain(`rollback 5 (also): the tree equals the "Before BuildOS 0.2.0" commit (git diff --cached --quiet <commit>)`, "git", ["diff", "--cached", "--quiet", before], 0, project);
  check(s, "the commit was found", /^[0-9a-f]{40}$/.test(before));
}

// The original project is untouched.
{
  const s = plain("original: git status --porcelain", "git", ["status", "--porcelain"], 0, original);
  check(s, "git status prints nothing", s.stdout === "");
  check(s, `.os/manifest.json pins ${FROM_VERSION}`, readPin(original) === FROM_VERSION);
  const v = wrapper("original", "version", 0, original);
  check(v, `stdout names version ${FROM_VERSION}`, v.stdout.includes(`version: ${FROM_VERSION}\n`));
}

// The route guard again, after the last wrapper run.
routeGuard("route guard (after the last wrapper run)", join(project, ".os", "scripts", "pinned-version.cjs"), "the test project's .os/scripts/pinned-version.cjs", [project, original]);

// The positive proof (finding 1 of review round 1 of pull request 15): the
// entry scripts that the launch probe observed in each wrapper run.
{
  const allowedNpm = npmRoot !== undefined ? npmPrograms(npmRoot, WINDOWS) : [];
  const npxBins = new Map<string, string[]>();
  for (const f of readNpxFolders(cache, (p) => p).filter((x) => x.hasBuildOs)) {
    const pkgDir = join(f.dir, "node_modules", "build-os");
    try {
      const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { version?: string; bin?: Record<string, string> };
      const bins = Object.values(pkg.bin ?? {}).map((b) => {
        try {
          return realpathSync.native(join(pkgDir, b));
        } catch {
          return join(pkgDir, b);
        }
      });
      if (typeof pkg.version === "string") npxBins.set(pkg.version, [...(npxBins.get(pkg.version) ?? []), ...new Set(bins)]);
    } catch {
      // A folder without a readable package.json gives no expected bin file.
    }
  }
  const problems: string[] = [];
  const lines: string[] = [];
  for (const w of wrapperRuns) {
    const log = stepLaunchLog.get(w.step);
    const records = log !== undefined && existsSync(log) ? launchRecords(readFileSync(log, "utf8")) : [];
    let helper = join(w.dir, ".os", "scripts", "pinned-version.cjs");
    try {
      helper = realpathSync.native(helper);
    } catch {
      // The plain path is compared then.
    }
    const expected = npxBins.get(w.pin) ?? [];
    lines.push(`${clean(w.step.name)} (pin ${w.pin}): ${records.length > 0 ? records.map((r) => clean(r.real ?? r.argv1 ?? "(none)")).join(", ") : "(no Node.js process)"}\n`);
    if (expected.length === 0) problems.push(`step "${clean(w.step.name)}": the npx cache has no build-os ${w.pin} with a bin file`);
    problems.push(...launchProblems(w.step.name, records, expected.length > 0 ? expected : ["(the npx bin file of build-os " + w.pin + ")"], [helper, ...allowedNpm], WINDOWS).map((p) => clean(p)));
  }
  evidenceStep(
    "launch probe: each wrapper run started the pinned build-os from the npx cache",
    `no process; it reads the launch probe's records of each of the ${wrapperRuns.length} wrapper runs. ${PROBE_LIMIT}`,
    lines.join(""),
    [{ check: `in each of the ${wrapperRuns.length} wrapper runs, the entry script of each Node.js process that the probe observed is a bin file of the npx folder of the npm cache that holds build-os at the step's pin, the project's own .os/scripts/pinned-version.cjs, or a program of the selected npm ({NPM}/bin), and at least one is that bin file`, problems: wrapperRuns.length === 0 ? ["no wrapper run was recorded"] : problems }],
  );
}

// Where each version came from: the registry, with the registry's integrity.
{
  const t = npmTool("npm");
  const integrity: Record<string, string> = {};
  for (const v of [FROM_VERSION, TO_VERSION]) {
    const s = run(`registry: npm view build-os@${v} dist.integrity`, `npm view build-os@${v} dist.integrity`, t.file, [...t.prefix, "view", `build-os@${v}`, "dist.integrity"], 0, root, { shell: t.shell });
    integrity[v] = s.stdout.trim();
    check(s, "a sha512 integrity", /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(integrity[v]!));
  }
  const index = readCacheIndex(cache);
  const folders = readNpxFolders(cache, (p) => clean(p)).filter((f) => f.hasBuildOs);
  const versions = folders.map((f) => {
    try {
      return (JSON.parse(readFileSync(join(f.dir, "node_modules", "build-os", "package.json"), "utf8")) as { version?: string }).version ?? "";
    } catch {
      return "";
    }
  });
  const buildOsEntries = index.entries.filter((e) => /build-os/.test(e.key));
  evidenceStep("registry: the npm cache holds only registry entries of build-os", "no process; it reads the npm cache index and the npx folders", [...buildOsEntries.map((e) => `${e.key} ${e.integrity ?? "(no integrity)"}\n`), ...folders.map((f, i) => `${f.where}: build-os ${versions[i]}\n`)].join(""), [
    { check: `every build-os cache entry is the registry document or the registry tarball of ${FROM_VERSION} or ${TO_VERSION}, each tarball with the registry's integrity, and the whole index was read`, problems: [...index.incomplete, ...cacheProblems(index.entries, integrity)] },
    { check: `the npx cache has build-os ${FROM_VERSION} and ${TO_VERSION}, and no other build-os`, problems: [...versions].sort().join(",") === [FROM_VERSION, TO_VERSION].sort().join(",") ? [] : [`the npx folders hold build-os ${versions.join(", ") || "(none)"}`] },
    { check: "no node_modules folder in the test project or the original project, and the global prefix is empty (no npm install of build-os)", problems: [project, original].filter((d) => existsSync(join(d, "node_modules"))).map((d) => `${clean(d)} has a node_modules folder`).concat(readdirSync(globalPrefix).length > 0 ? ["the global prefix is not empty"] : []) },
  ]);
}

// Every guide command of rollback-steps.ts ran (a guard against a list that drifts from this script).
{
  const ran = new Set(steps.map((s) => s.command));
  const missing = ALL_COMMANDS.filter((c) => !ran.has(WINDOWS ? commandPromptForm(c.sh) : c.sh));
  evidenceStep("every guide command ran", "no process; it compares the commands that ran with scripts/rollback-steps.ts", "", [{ check: `each of the ${new Set(ALL_COMMANDS.map((c) => c.sh)).size} guide commands ran`, problems: missing.map((c) => `did not run: ${c.sh}`) }]);
}

finish();
