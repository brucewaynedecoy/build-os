// W1 R7 P8 t15: smoke test of a published build-os version, through
// `npx -y build-os@<version>`, in clean folders, with a clean npm cache. The
// `buildos-smoke` workflow runs it on ubuntu-latest, windows-latest, and
// macos-latest with Node 24; a maintainer can run it on any machine. Node
// built-ins only; it installs nothing from this repository.
//
// Usage: node scripts/published-smoke.ts --version <version> --out <folder>
//        node scripts/published-smoke.ts --tarball <file> --sha256 <hex> --out <folder>
//
// Tarball mode (W1 R7 P9, F-P9-15): the same steps on one release tarball,
// before its version is on the registry (a staged version cannot be
// installed before the npm approval). The file's SHA-256 must equal
// --sha256 before any step runs, and the version is read from the tarball.
// How each step gets the package, the registry guard, and what the mode
// proves and does not prove are in scripts/smoke-source.ts. The report
// records the mode, the tarball's file name, SHA-256, and version, and
// those limits.
//
// Each step runs in a new empty folder below one temporary root. The npm
// cache is a new empty folder in that root, npm install scripts are off
// (npm_config_ignore_scripts=true), and npm's update notice is off, so stderr
// holds only what BuildOS (or the wrapper) prints. Every check reads the raw
// output (only CRLF line ends made LF), so a user or folder name that the
// cleaning replaces cannot change a result (follow-up F-P8-13: an account
// named buildos made a correct legacy notice fail). The captured output is
// cleaned before it is written to the report: the temporary root, the home folder, and the
// user name are replaced by {TMP}, {HOME}, and {USER}, and each step's
// project folder by {PROJECT}; the converter timestamp and the init time are
// replaced by {TIMESTAMP}. It writes <out>/smoke-<os>.json and
// <out>/smoke-<os>.md and exits 1 when a step fails, 2 on a usage error.
//
// Steps (t15): version (human and JSON), init with no TTY (exit 10, folder
// unchanged), init --skip-make-docs, one intake conversion (HTML),
// entities validate, validate, one legacy name (buildos-intake), the project
// wrapper with Node.js missing (exit 127, the plain message), and the project
// wrapper with Node.js present (it runs the pinned version through npx).
//
// Step 10 (F-P8-11, PE-023; owner decision 2026-11-26): the printed fix
// command, in scripts/printed-fix-step.ts (its header says what it checks).
// It runs the printed command (through `sh -c`, or Command Prompt with
// delayed expansion off on Windows) only when both the JSON field and the
// human `action:` line are exactly the expected ones, and then requires
// `result.index.current` true and no index diagnostic. So the
// step count is 13 on Linux and macOS (12 on Windows, which has one wrapper
// step for Node.js missing) for 0.1.0, and 15 (14) for a later version:
// version 2, init 2, intake 1, entities validate 1, validate 1, legacy name
// 2, wrapper 3 (2), and step 10 with 1 for 0.1.0 or 3 for a later version.
// Tarball mode adds 5 (review round 1 of pull request 12, finding 1): the
// registry guard preflight before step 1 (when it fails, the run stops there
// and writes the report), the check of the npx install after step 7, the
// install of the tarball into the project before step 9, and after step 10
// the check of the project install (and the npx install again) and of the
// npm cache (20 on Linux and macOS, 19 on Windows, for 0.2.0).
//
// The report (review round 1, findings 2 and 3): every claim of what tarball
// mode proved comes from the steps that ran and their outcomes
// (tarballClaims in scripts/smoke-source.ts), and the check labels are
// cleaned like stdout and stderr, so the report holds no runner path.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { commandPromptArgs, printedFixStep } from "./printed-fix-step.ts";
import { cacheContentSha256, findBuildOsFolders, readCacheIndex, readInstalledCopy, readNpxFolders } from "./smoke-evidence.ts";
import {
  BLOCKED_REGISTRY,
  cacheContentProblems,
  cacheIndexProblems,
  copyProblems,
  guardedEnv,
  legacyNpxArgs,
  npxArgs,
  npxFolderProblems,
  parseSmokeArgs,
  readTarballIdentity,
  sha256Hex,
  strayProblems,
  TARBALL_MODE_LIMITS,
  tarballClaims,
  USAGE,
  UsageError,
  type SmokeSource,
  type StepRole,
  type TarballIdentity,
} from "./smoke-source.ts";

const NODE_REQUIRED = "BuildOS needs Node.js 24 or newer on this computer. Install it from https://nodejs.org, then try again.";
const LEGACY_NOTICE = 'Note: the command name "buildos-intake" goes away in BuildOS 0.3.0. Use "buildos intake" instead.';
const WINDOWS = process.platform === "win32";

interface Step {
  name: string;
  /** The part this step plays, for the claims of a tarball-mode report. */
  role?: StepRole;
  command: string;
  exit: number | null;
  /** null for a check that starts no process (the provenance and cache checks). */
  expected_exit: number | null;
  stdout: string;
  stderr: string;
  files?: Record<string, string>;
  checks: { check: string; ok: boolean }[];
  ok: boolean;
}

function usage(message: string): never {
  process.stderr.write(`${message}\n${USAGE}\n`);
  process.exit(2);
}

function parseArgs(argv: string[]): { source: SmokeSource; out: string } {
  try {
    return parseSmokeArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) usage(e.message);
    throw e;
  }
}

/** npx or npm as `node <npx-cli.js>` (or `npm-cli.js`), so no shell is needed on Windows; else the program on PATH. */
function npmTool(name: "npx" | "npm"): { file: string; prefix: string[]; shell: boolean } {
  const nodeDir = dirname(process.execPath);
  for (const cli of [join(nodeDir, "node_modules", "npm", "bin", `${name}-cli.js`), join(nodeDir, "..", "lib", "node_modules", "npm", "bin", `${name}-cli.js`)]) {
    if (existsSync(cli)) return { file: process.execPath, prefix: [cli], shell: false };
  }
  return { file: name, prefix: [], shell: WINDOWS };
}

const parsed = parseArgs(process.argv.slice(2));
const out = parsed.out;
// Tarball mode (F-P9-15): the file as an absolute path, its SHA-256 checked
// against --sha256 before any step, and the version read from the tarball.
const source: SmokeSource = parsed.source.kind === "tarball" ? { ...parsed.source, file: resolve(parsed.source.file) } : parsed.source;
let identity: TarballIdentity | undefined;
if (source.kind === "tarball") {
  let bytes: Uint8Array = new Uint8Array();
  try {
    bytes = readFileSync(source.file);
  } catch {
    process.stderr.write(`cannot read the tarball ${source.file}; no step ran\n`);
    process.exit(1);
  }
  const actual = sha256Hex(bytes);
  if (actual !== source.sha256) {
    process.stderr.write(`the tarball's SHA-256 is ${actual}, not the expected ${source.sha256}; no step ran\n`);
    process.exit(1);
  }
  try {
    identity = readTarballIdentity(bytes);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}; no step ran\n`);
    process.exit(1);
  }
}
const version = identity !== undefined ? identity.version : source.kind === "registry" ? source.version : "";
// The real path (review round 1 of pull request 12): on macOS the temporary
// folder is below a symbolic link (/var, /tmp), and through a linked path npm
// records the hidden lockfile keys of an install relative to the link (on
// Windows, the native form also expands a short 8.3 name such as RUNNER~1).
const root = realpathSync.native(mkdtempSync(join(tmpdir(), "buildos-smoke-")));
const cache = join(root, "npm-cache");
mkdirSync(cache);
// Tarball mode: npm's global prefix is this new empty folder, so no global install can stand in.
const globalPrefix = join(root, "npm-prefix");
mkdirSync(globalPrefix);
const npx = npmTool("npx");
const npm = npmTool("npm");
const callerEnv: NodeJS.ProcessEnv = {
  // The caller's value of a setting below, in any spelling, never counts.
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_(cache|ignore[-_]scripts|update[-_]notifier|fund|audit)$/i.test(key))),
  npm_config_cache: cache,
  npm_config_ignore_scripts: "true",
  npm_config_update_notifier: "false",
  npm_config_fund: "false",
  npm_config_audit: "false",
};
// A BuildOS variable from the caller never counts.
for (const key of Object.keys(callerEnv)) if (key.startsWith("BUILDOS_")) delete callerEnv[key];
// Tarball mode: npm offline, with a blocked registry, for every process that
// the smoke starts (the registry guard, scripts/smoke-source.ts).
const baseEnv: NodeJS.ProcessEnv = source.kind === "tarball" ? guardedEnv(callerEnv, { cache, prefix: globalPrefix }) : callerEnv;

/** Every spelling of a path that output can hold: as given, real path, short and long forms, and JSON-escaped. */
function spellings(path: string): string[] {
  const forms = new Set<string>([path]);
  try {
    forms.add(realpathSync(path));
    forms.add(realpathSync.native(path));
  } catch {
    // The path may be gone; the given form is enough.
  }
  for (const f of [...forms]) {
    if (f.startsWith("/private/")) forms.add(f.slice("/private".length));
    else if (f.startsWith("/var/") || f.startsWith("/tmp/")) forms.add(`/private${f}`);
  }
  for (const f of [...forms]) {
    // JSON-escaped once, and twice: a Go-quoted path inside a JSON string
    // (for example the entities remediation_command on Windows).
    const once = JSON.stringify(f).slice(1, -1);
    forms.add(once);
    forms.add(JSON.stringify(once).slice(1, -1));
    if (WINDOWS) forms.add(f.replace(/\\/g, "/"));
  }
  return [...forms].filter((f) => f.length > 1).sort((a, b) => b.length - a.length);
}

function clean(text: string, project?: string): string {
  let t = text.replace(/\r\n/g, "\n");
  const pairs: [string, string][] = [];
  if (source.kind === "tarball") for (const s of spellings(source.file)) pairs.push([s, "{TARBALL}"]);
  if (project !== undefined) for (const s of spellings(project)) pairs.push([s, "{PROJECT}"]);
  for (const s of spellings(root)) pairs.push([s, "{TMP}"]);
  for (const s of spellings(tmpdir())) pairs.push([s, "{TMP}"]);
  for (const s of spellings(homedir())) pairs.push([s, "{HOME}"]);
  for (const [from, to] of pairs) t = t.split(from).join(to);
  const user = userInfo().username;
  if (user.length >= 3) t = t.split(user).join("{USER}");
  t = t.replace(/(timestamp|initialized_at)(": "|: ")[0-9TZ:.-]+"/g, '$1$2{TIMESTAMP}"');
  return t;
}

function newFolder(name: string): string {
  const dir = join(root, name);
  mkdirSync(dir);
  return dir;
}

const steps: Step[] = [];
/** The project folder of each step, for the cleaning of its report. */
const stepFolder = new WeakMap<Step, string>();

function run(name: string, shown: string, file: string, args: string[], expected: number, cwd: string, opts: { env?: NodeJS.ProcessEnv; shell?: boolean; verbatim?: boolean; role?: StepRole } = {}): Step {
  const options: SpawnSyncOptions = {
    cwd,
    env: opts.env ?? baseEnv,
    // No TTY: stdin is closed, as in a chat app or CI.
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: opts.shell ?? false,
    windowsVerbatimArguments: opts.verbatim ?? false,
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  };
  const r = spawnSync(file, args, options);
  const step: Step = {
    name,
    ...(opts.role !== undefined ? { role: opts.role } : {}),
    command: clean(shown, cwd),
    exit: r.status,
    expected_exit: expected,
    // Raw output for the checks; cleaned only for the report (F-P8-13).
    stdout: String(r.stdout ?? "").replace(/\r\n/g, "\n"),
    stderr: (String(r.stderr ?? "") + (r.error ? `\n[spawn error] ${r.error.message}` : "")).replace(/\r\n/g, "\n"),
    checks: [{ check: `exit code ${expected}`, ok: r.status === expected }],
    ok: false,
  };
  steps.push(step);
  stepFolder.set(step, cwd);
  return step;
}

function check(step: Step, what: string, ok: boolean): void {
  step.checks.push({ check: what, ok });
}

function npxRun(name: string, args: string[], expected: number, cwd: string, role: StepRole = "direct"): Step {
  const full = npxArgs(source, version, args);
  return run(name, `npx ${full.join(" ")}`, npx.file, [...npx.prefix, ...full], expected, cwd, { shell: npx.shell, role });
}

/** A step that starts no process: it reads the disk and records each problem in stderr. */
function evidenceStep(name: string, role: StepRole, command: string, stdout: string, checks: { check: string; problems: string[] }[]): void {
  steps.push({ name, role, command, exit: null, expected_exit: null, stdout, stderr: checks.flatMap((c) => c.problems).map((p) => `${p}\n`).join(""), checks: checks.map((c) => ({ check: c.check, ok: c.problems.length === 0 })), ok: false });
}

const os = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : process.platform;

/** Writes the JSON and Markdown reports, prints the summary, removes the temporary root, and exits (1 unless every step passed). */
function finish(stopped?: string): never {
  for (const s of steps) s.ok = s.checks.every((c) => c.ok);
  const passed = stopped === undefined && steps.every((s) => s.ok);
  // The checks are done: only now is the output cleaned, for the report;
  // the check labels too, which can hold a project path (finding 3).
  const reported = steps.map((s) => ({ ...s, stdout: clean(s.stdout, stepFolder.get(s)), stderr: clean(s.stderr, stepFolder.get(s)), checks: s.checks.map((c) => ({ ...c, check: clean(c.check, stepFolder.get(s)) })) }));
  const npmVersion = spawnSync(npx.file, [...npx.prefix, "--version"], { env: baseEnv, encoding: "utf8", shell: npx.shell, cwd: root }).stdout?.toString().trim() ?? "";
  const tarballRecord = source.kind === "tarball" && identity !== undefined ? { file: basename(source.file), sha256: identity.sha256, integrity: identity.integrity, name: identity.name, version: identity.version, file_count: Object.keys(identity.files).length, bin_sha256: identity.bins } : null;
  // Finding 2: what this run proved comes from the steps that ran, never fixed text.
  const claims = identity !== undefined ? tarballClaims(reported, { version, sha256: identity.sha256, integrity: identity.integrity }) : null;
  const packageSource = source.kind === "registry" ? `the public npm registry: npx -y build-os@${version}` : `the tarball file ${basename(source.file)} (tarball mode), with npm offline and the registry ${BLOCKED_REGISTRY} (blocked) for every process`;
  const report = {
    package: `build-os@${version}`,
    mode: source.kind,
    package_source: packageSource,
    tarball: tarballRecord,
    ...(claims !== null ? { tarball_mode: { ...claims, does_not_prove: TARBALL_MODE_LIMITS.does_not_prove } } : {}),
    os,
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
    npm: npmVersion,
    npm_cache: "a new empty folder below {TMP}",
    paths_replaced: `{TMP} temporary root, {PROJECT} step folder, {HOME} home folder, {USER} user name, {TIMESTAMP} times${source.kind === "tarball" ? ", {TARBALL} tarball path" : ""}`,
    passed,
    ...(stopped !== undefined ? { stopped } : {}),
    steps: reported,
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `smoke-${os}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const md: string[] = [`# build-os@${version} smoke on ${os}`, "", `Node ${process.version}, npm ${npmVersion}, ${process.platform} ${process.arch}. Result: ${passed ? "passed" : "FAILED"}. Paths are replaced as stated in the JSON report.`, ""];
  if (stopped !== undefined) md.push(`Stopped: ${stopped}`, "");
  if (tarballRecord !== null && claims !== null) {
    md.push(`Mode: tarball. File \`${tarballRecord.file}\`, SHA-256 \`${tarballRecord.sha256}\`, version ${tarballRecord.version} (read from the tarball). Package source: ${packageSource}.`, "");
    const list = (title: string, lines: readonly string[]): void => {
      md.push(title, "");
      for (const line of lines.length > 0 ? lines : ["(none)"]) md.push(`- ${line}`);
      md.push("");
    };
    list("This run proved (each claim from steps that ran and passed):", claims.proves);
    list("This run did not prove:", claims.not_proven);
    list("Ran nothing:", claims.not_run);
    list("Tarball mode does not prove (in any run):", TARBALL_MODE_LIMITS.does_not_prove);
  } else {
    md.push(`Mode: registry. Package source: ${packageSource}.`, "");
  }
  for (const s of reported) {
    md.push(`## ${s.ok ? "pass" : "FAIL"}: ${s.name}`, "", s.expected_exit === null ? `Check: ${s.command}.` : `Command: \`${s.command}\` (exit ${s.exit}, expected ${s.expected_exit})`, "");
    for (const c of s.checks) md.push(`- ${c.ok ? "ok" : "FAILED"}: ${c.check}`);
    md.push("", "stdout:", "", "```text", s.stdout.replace(/\n$/, ""), "```", "", "stderr:", "", "```text", s.stderr.replace(/\n$/, ""), "```", "");
    for (const [path, text] of Object.entries(s.files ?? {})) md.push(`File \`${path}\`:`, "", "```text", text.replace(/\n$/, ""), "```", "");
  }
  writeFileSync(join(out, `smoke-${os}.md`), md.join("\n"));
  process.stdout.write(`build-os@${version}${tarballRecord !== null ? ` (tarball, SHA-256 ${tarballRecord.sha256})` : ""} smoke on ${os}: ${passed ? "passed" : "FAILED"} (${steps.filter((s) => s.ok).length} of ${steps.length} steps)\n`);
  if (stopped !== undefined) process.stdout.write(`  STOPPED: ${stopped}\n`);
  for (const s of steps) if (!s.ok) process.stdout.write(`  FAILED: ${s.name}: ${s.checks.filter((c) => !c.ok).map((c) => clean(c.check, stepFolder.get(s))).join("; ")}\n`);
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  process.exit(passed ? 0 : 1);
}

// 0. Tarball mode only: the registry guard is on (npm reads offline and the
// blocked registry). When it is not, no step runs (finding 1).
if (source.kind === "tarball") {
  const step = run("registry guard (tarball mode): npm config get offline registry", "npm config get offline registry", npm.file, [...npm.prefix, "config", "get", "offline", "registry"], 0, root, { shell: npm.shell, role: "guard-preflight" });
  check(step, `npm reads offline=true and registry=${BLOCKED_REGISTRY}`, step.stdout === `offline=true\nregistry=${BLOCKED_REGISTRY}\n`);
  if (!step.checks.every((c) => c.ok)) finish("the registry guard preflight failed (npm did not read offline=true and the blocked registry), so the run stopped before step 1 and no other step ran");
}

// 1. version, human and JSON.
{
  const dir = newFolder("version");
  const human = npxRun("version", ["version"], 0, dir);
  check(human, `stdout names version ${version}`, human.stdout.includes(`version: ${version}\n`));
  check(human, "stderr is empty", human.stderr === "");
  const json = npxRun("version --json", ["version", "--json"], 0, dir);
  let parsed: { ok?: boolean; version?: string; source_revision?: string } = {};
  try {
    parsed = JSON.parse(json.stdout) as typeof parsed;
  } catch {
    // Reported by the check below.
  }
  check(json, `JSON ok true and version ${version}`, parsed.ok === true && parsed.version === version);
  check(json, "JSON source_revision is a full commit hash", /^[0-9a-f]{40}$/.test(parsed.source_revision ?? ""));
  check(json, "stderr is empty", json.stderr === "");
}

// 2. init with no TTY and no flag: exit 10, nothing written.
{
  const dir = newFolder("init-no-tty");
  const step = npxRun("init (no TTY, no flag)", ["init"], 10, dir);
  check(step, "stdout says nothing was changed and asks the Make Docs question", step.stdout.includes("Stopped. Nothing was changed. BuildOS needs one answer from the user first.") && step.stdout.includes('Ask the user: "Set up Make Docs in this project?"'));
  check(step, `the shown commands use npx -y build-os@${version}`, step.stdout.includes(`npx -y build-os@${version} init --root`));
  check(step, "the folder is still empty", readdirSync(dir).length === 0);
}

// 3. init --skip-make-docs in a clean folder; later steps use this project.
const project = newFolder("project");
{
  const step = npxRun("init --skip-make-docs", ["init", "--skip-make-docs"], 0, project);
  check(step, "stdout says BuildOS is set up", step.stdout.includes("Done. BuildOS is set up in this folder."));
  let pinned = "";
  try {
    pinned = (JSON.parse(readFileSync(join(project, ".os", "manifest.json"), "utf8")) as { buildos_version?: string }).buildos_version ?? "";
  } catch {
    // Reported by the check below.
  }
  check(step, `.os/manifest.json pins ${version}`, pinned === version);
  check(step, "no docs/ or .make-docs/ folder", !existsSync(join(project, "docs")) && !existsSync(join(project, ".make-docs")));
  if (existsSync(join(project, ".os", "manifest.json"))) step.files = { ".os/manifest.json": clean(readFileSync(join(project, ".os", "manifest.json"), "utf8"), project) };
}

// 4. One intake conversion (HTML to Markdown), source outside the project.
{
  const src = newFolder("source");
  const html = join(src, "smoke-page.html");
  writeFileSync(html, "<!doctype html><html><head><title>Smoke</title></head><body><h1>Smoke Test</h1><p>One <b>bold</b> line.</p><ul><li>a</li><li>b</li></ul></body></html>\n");
  const step = npxRun("intake convert (HTML)", ["intake", "convert", "--source", html, "--repo-root", project, "--assets-root", "assets"], 0, project);
  const md = join(project, "assets", "smoke-page", "smoke-page.md");
  const text = existsSync(md) ? readFileSync(md, "utf8") : "";
  check(step, "assets/smoke-page/smoke-page.md holds the converted heading", text.includes("# Smoke Test") && text.includes('status: "converted"'));
  if (text !== "") step.files = { "assets/smoke-page/smoke-page.md": clean(text, project) };
}

// 5. entities validate.
{
  const step = npxRun("entities validate", ["entities", "validate", "--root", project, "--mode", "compat"], 0, project);
  check(step, "stdout says entities.validate: ok", step.stdout.startsWith("entities.validate: ok\n"));
  check(step, `stdout names version ${version}`, step.stdout.includes(`version: ${version}\n`));
}

// 6. validate.
{
  const step = npxRun("validate", ["validate", "--root", project], 0, project);
  check(step, "stdout says no problems found", step.stdout.includes("OK. No problems found."));
}

// 7. One legacy name, from the package: the notice, then the same output as `buildos intake --help`.
{
  const legacyArgs = legacyNpxArgs(source, version);
  const legacy = run("legacy name buildos-intake --help", `npx ${legacyArgs.join(" ")}`, npx.file, [...npx.prefix, ...legacyArgs], 0, project, { shell: npx.shell, role: "direct" });
  const plain = npxRun("intake --help (for the legacy comparison)", ["intake", "--help"], 0, project);
  const lines = legacy.stderr.split("\n");
  check(legacy, "the first stderr line is the legacy notice", lines[0] === LEGACY_NOTICE);
  check(legacy, "the rest of stderr equals that of buildos intake --help", lines.slice(1).join("\n") === plain.stderr);
  check(legacy, "stdout equals that of buildos intake --help", legacy.stdout === plain.stdout);
}

// Tarball mode only, after step 7 and before the project install exists: the
// npx install that steps 1 to 7 ran (scripts/smoke-source.ts says why it is
// the one that ran). Exactly one npx folder, made for the tarball file; its
// build-os package holds exactly the tarball's files with the tarball's
// bytes; its lockfile names the tarball's version, file, and integrity; and
// no other build-os folder is below the temporary root.
let npxInstallDir: string | undefined;
function npxCopyCheck(): { folders: string; problems: { check: string; problems: string[] }[] } {
  const id = identity!;
  const folders = readNpxFolders(cache, (p) => clean(p));
  const withBuildOs = folders.filter((f) => f.hasBuildOs);
  if (withBuildOs.length === 1) npxInstallDir = withBuildOs[0]!.dir;
  const copy = npxInstallDir !== undefined ? readInstalledCopy(npxInstallDir, clean(join(npxInstallDir, "node_modules", "build-os"))) : undefined;
  return {
    folders: folders.map((f) => `${f.where}: _npx.packages ${JSON.stringify(f.packages).split(source.kind === "tarball" ? source.file : "\0").join("{TARBALL}")}${f.hasBuildOs ? ", holds node_modules/build-os" : ""}\n`).join(""),
    problems: [
      { check: "the npx cache holds exactly one install folder, made for the tarball file alone (_npx.packages)", problems: npxFolderProblems(folders, source.kind === "tarball" ? source.file : "") },
      { check: `its node_modules/build-os holds exactly the tarball's ${Object.keys(id.files).length} files, each with the tarball's SHA-256, and its lockfile entry names version ${id.version}, the tarball file, and the integrity ${id.integrity}`, problems: copyProblems("the npx install", copy, id, basename(source.kind === "tarball" ? source.file : "")) },
    ],
  };
}
if (source.kind === "tarball" && identity !== undefined) {
  const r = npxCopyCheck();
  const expected = npxInstallDir !== undefined ? [join(npxInstallDir, "node_modules", "build-os")] : [];
  const stray = strayProblems(findBuildOsFolders(root), expected).map((p) => clean(p));
  evidenceStep("provenance (tarball mode): the npx install that steps 1 to 7 ran", "npx-copy", "no process; it reads {TMP}/npm-cache/_npx and every node_modules/build-os folder below {TMP}", r.folders, [...r.problems, { check: "no other build-os folder is below the temporary root (the global prefix {TMP}/npm-prefix included); the project has no install yet", problems: stray }]);
}

// 8. The project wrapper with Node.js missing: the plain message, exit 127.
{
  const scripts = join(project, ".os", "scripts");
  if (WINDOWS) {
    const sys = process.env["SystemRoot"] ?? "C:\\Windows";
    const path = `${sys}\\System32;${sys}`;
    const env = { ...baseEnv, PATH: path, Path: path };
    const comspec = process.env["ComSpec"] ?? `${sys}\\System32\\cmd.exe`;
    const nodeFound = path.split(";").some((d) => existsSync(join(d, "node.exe")));
    const line = `/d /s /c ""${join(scripts, "buildos.cmd")}" version"`;
    const step = run("wrapper with Node.js missing (.os\\scripts\\buildos.cmd version)", "PATH=%SystemRoot%\\System32;%SystemRoot% .os\\scripts\\buildos.cmd version", comspec, [line], 127, project, { env, verbatim: true, role: "wrapper-missing" });
    check(step, "no node.exe in the PATH folders", !nodeFound);
    check(step, "stderr is exactly the plain message", step.stderr === `${NODE_REQUIRED}\n`);
    check(step, "stdout is empty", step.stdout === "");
  } else {
    const bin = newFolder("path-without-node");
    symlinkSync("/bin/sh", join(bin, "sh"));
    const env = { ...baseEnv, PATH: bin };
    for (const name of ["buildos", "buildos-intake"]) {
      const step = run(`wrapper with Node.js missing (.os/scripts/${name} version)`, `PATH=<folder with only sh> sh .os/scripts/${name} version`, "/bin/sh", [join(scripts, name), "version"], 127, project, { env, role: "wrapper-missing" });
      const expected = name === "buildos" ? `${NODE_REQUIRED}\n` : `${LEGACY_NOTICE}\n${NODE_REQUIRED}\n`;
      check(step, "stderr is exactly the expected lines", step.stderr === expected);
      check(step, "stdout is empty", step.stdout === "");
    }
  }
}

// Tarball mode only, before step 9: the offline install of the tarball into
// the project (the user guide, chapter 4), so the wrapper runs the pinned
// version from that local install. Registry mode has none: the wrapper uses npx.
if (source.kind === "tarball") {
  const step = run("install the tarball into the project (tarball mode)", "npm install --offline --ignore-scripts --no-save --no-package-lock --prefix . <tarball>", npm.file, [...npm.prefix, "install", "--offline", "--ignore-scripts", "--no-save", "--no-package-lock", "--prefix", project, source.file], 0, project, { shell: npm.shell, role: "project-install" });
  let installed = "";
  try {
    installed = (JSON.parse(readFileSync(join(project, "node_modules", "build-os", "package.json"), "utf8")) as { version?: string }).version ?? "";
  } catch {
    // Reported by the check below.
  }
  check(step, `node_modules/build-os in the project is ${version}, the pinned version`, installed === version);
}

// 9. The project wrapper with Node.js present: it runs the pinned version
// (registry mode: through npx; tarball mode: from the local install).
{
  const scripts = join(project, ".os", "scripts");
  const step = WINDOWS
    ? run("wrapper with Node.js present (.os\\scripts\\buildos.cmd version --json)", ".os\\scripts\\buildos.cmd version --json", process.env["ComSpec"] ?? "cmd.exe", [`/d /s /c ""${join(scripts, "buildos.cmd")}" version --json"`], 0, project, { verbatim: true, role: "wrapper" })
    : run("wrapper with Node.js present (.os/scripts/buildos version --json)", "sh .os/scripts/buildos version --json", "/bin/sh", [join(scripts, "buildos"), "version", "--json"], 0, project, { role: "wrapper" });
  let parsed: { version?: string } = {};
  try {
    parsed = JSON.parse(step.stdout) as typeof parsed;
  } catch {
    // Reported by the check below.
  }
  check(step, `the wrapper ran version ${version}`, parsed.version === version);
}

// 10. A printed fix command (F-P8-11, PE-023), run as printed (scripts/printed-fix-step.ts). Last, because it writes the project's entity index.
printedFixStep({
  version,
  source: source.kind,
  windows: WINDOWS,
  project,
  humanStdout: steps.find((s) => s.name === "entities validate")?.stdout,
  npxRun: (name, args, expected, role) => npxRun(name, args, expected, project, role),
  shellRun: (name, command) =>
    WINDOWS ? run(name, command, process.env["ComSpec"] ?? "cmd.exe", commandPromptArgs(command), 0, project, { verbatim: true, role: "fix-run" }) : run(name, command, "/bin/sh", ["-c", command], 0, project, { role: "fix-run" }),
  check,
});

// Tarball mode only, after step 10: the project install that the wrapper
// (step 9) and the printed command of step 10 ran, the npx install again
// (the entities validate --json runs of step 10), and no other build-os
// folder below the temporary root. Last, the npm cache: at least one entry,
// every entry a tarball file entry for the tarball's file name and
// integrity, and the cache content for that integrity with the tarball's
// SHA-256 (scripts/smoke-source.ts).
if (source.kind === "tarball" && identity !== undefined) {
  const id = identity;
  const name = basename(source.file);
  const copy = readInstalledCopy(project, clean(join(project, "node_modules", "build-os")));
  const again = npxCopyCheck();
  const expected = [join(project, "node_modules", "build-os"), ...(npxInstallDir !== undefined ? [join(npxInstallDir, "node_modules", "build-os")] : [])];
  const stray = strayProblems(findBuildOsFolders(root), expected).map((p) => clean(p));
  evidenceStep("provenance (tarball mode): the project install that steps 9 and 10 ran, and the npx install again", "project-copy", "no process; it reads {TMP}/project/node_modules, {TMP}/npm-cache/_npx, and every node_modules/build-os folder below {TMP}", `${copy?.where ?? "(no project install)"}: ${Object.keys(copy?.files ?? {}).length} files\n${again.folders}`, [
    { check: `the project's node_modules/build-os holds exactly the tarball's ${Object.keys(id.files).length} files, each with the tarball's SHA-256, and its lockfile entry names version ${id.version}, the tarball file, and the integrity ${id.integrity}`, problems: copyProblems("the project install", copy, id, name) },
    ...again.problems.map((c) => ({ check: `after step 10: ${c.check}`, problems: c.problems })),
    { check: "no other build-os folder is below the temporary root (the global prefix {TMP}/npm-prefix included)", problems: stray },
  ]);
  const entries = readCacheIndex(cache);
  evidenceStep("registry guard (tarball mode): the npm cache holds only the tarball", "cache-guard", "no process; it reads the npm cache index {TMP}/npm-cache/_cacache/index-v5 and the cache content", entries.map((e) => `${clean(e.key)} ${e.integrity ?? "(no integrity)"}\n`).join(""), [
    { check: `the npm cache index holds at least one entry, and every entry is a pacote:tarball:file: entry for ${name} with the integrity ${id.integrity} (no registry response)`, problems: cacheIndexProblems(entries, id, name).map((p) => clean(p)) },
    { check: `the cache content for that integrity has the tarball's SHA-256 ${id.sha256}`, problems: cacheContentProblems(id, cacheContentSha256(cache, id.integrity)) },
  ]);
}

finish();
