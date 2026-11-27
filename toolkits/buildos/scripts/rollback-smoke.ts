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
// the run sets COPYCMD=/Y, which answers yes, as a person at the prompt
// would. Upgrade step 6 (the pin) is an edit, made here by changing only
// that one field. After the rollback, the project wrapper must run the
// pinned 0.1.0 (its version, its JSON source revision equal to that of
// `npx -y build-os@0.1.0 version --json`, no 0.2.0 domain in help, and a
// 0.2.0 command stops with exit 2), the five compare commands against the
// backup print nothing, and the tree equals the "Before BuildOS 0.2.0"
// commit; the original project is untouched; and the npm cache holds only
// registry entries of build-os, with the registry's integrity for both
// tarballs.
//
// The captured output is cleaned for the report ({TMP}, {PROJECT},
// {ORIGINAL}, {HOME}, {USER}, {TIMESTAMP}, then any other absolute path). It
// writes <out>/rollback-<os>.json and <out>/rollback-<os>.md and exits 1 when
// a step fails, 2 on a usage error.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { commandPromptArgs } from "./printed-fix-step.ts";
import { readCacheIndex, readNpxFolders } from "./smoke-evidence.ts";
import { scrubAbsolutePaths } from "./smoke-source.ts";
import {
  ALL_COMMANDS,
  cacheProblems,
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
const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_(cache|prefix|ignore[-_]scripts|update[-_]notifier|fund|audit)$/i.test(key) && !key.startsWith("BUILDOS_") && !/^GIT_/.test(key))),
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

function run(name: string, shown: string, file: string, args: string[], expected: number | null, cwd: string, opts: { shell?: boolean; verbatim?: boolean } = {}): Step {
  const options: SpawnSyncOptions = {
    cwd,
    env,
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

function npxRun(name: string, args: string[], expected: number, cwd: string): Step {
  const t = npmTool("npx");
  return run(name, `npx ${args.join(" ")}`, t.file, [...t.prefix, ...args], expected, cwd, { shell: t.shell });
}

/** A step that starts no process: it reads the disk and records each problem in stderr. */
function evidenceStep(name: string, what: string, stdout: string, checks: { check: string; problems: string[] }[]): void {
  steps.push({ name, command: what, exit: null, expected_exit: null, stdout, stderr: checks.flatMap((c) => c.problems).map((p) => `${p}\n`).join(""), checks: checks.map((c) => ({ check: c.check, ok: c.problems.length === 0 })), ok: false });
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
  const reported = steps.map((s) => ({ ...s, command: scrub(s.command), stdout: scrub(s.stdout), stderr: scrub(s.stderr), checks: s.checks.map((c) => ({ ...c, check: scrub(c.check) })) }));
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

// 0. No buildos on PATH, so the wrapper can only run a version through npx.
{
  const names = WINDOWS ? ["buildos.cmd", "buildos.exe", "buildos.bat", "buildos.ps1", "buildos"] : ["buildos"];
  const found = (env["PATH"] ?? env["Path"] ?? "").split(delimiter).filter((d) => d !== "").flatMap((d) => names.map((n) => join(d, n)).filter((p) => existsSync(p)));
  evidenceStep("no buildos on PATH", "no process; it looks for a buildos program in each PATH folder", found.map((f) => `${f}\n`).join(""), [{ check: "no PATH folder holds a buildos program (so the wrapper finds no global install and runs the pinned version through npx)", problems: found.map((f) => `found ${f}`) }]);
}

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
  const cm = wrapper("rollback 5 (also)", "capability-matrix --help", 2);
  check(cm, 'a 0.2.0 command stops with unknown command (the guide: "exit code 2")', /unknown command/.test(cm.stdout + cm.stderr));
  const legacy = guide({ step: "rollback 5 (also)", sh: ".os/scripts/buildos-intake version", guide: "literal" }, 1);
  check(legacy, `the legacy project script runs ${FROM_VERSION}: its notice, and "unknown command" for version (it shows the legacy route works; the version itself is shown by the wrapper checks above)`, legacy.stderr.startsWith(`${LEGACY_NOTICE}\n`) && legacy.stderr.includes('buildos-intake: error: unknown command "version"'));
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
