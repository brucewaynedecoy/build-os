// W1 R7 P8 t15: smoke test of a published (or staged) build-os version,
// through `npx -y build-os@<version>`, in clean folders, with a clean npm
// cache. The `buildos-smoke` workflow runs it on ubuntu-latest,
// windows-latest, and macos-latest with Node 24; a maintainer can run it on
// any machine. Node built-ins only; it installs nothing from this repository.
//
// Usage: node scripts/published-smoke.ts --version <version> --out <folder>
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
// command. `entities validate --json` in the project of step 3 (which has no
// entity index yet) prints the rebuild command in
// `result.index.remediation_command`; the step checks that the human
// `action:` line holds the same text. For 0.1.0 the text starts with a bare
// `buildos` (the known defect F-P8-11, fixed in 0.2.0), so the step checks
// that form and does not run it. For any other version the text must start
// with `npx -y build-os@<version> `, and the step runs it as printed through
// the system shell (`sh -c`, or Command Prompt on Windows), then runs
// `entities validate` again, which must print no index warning. So the
// step count is 13 on Linux and macOS (12 on Windows, which has one wrapper
// step for Node.js missing) for 0.1.0, and 15 (14) for a later version:
// version 2, init 2, intake 1, entities validate 1, validate 1, legacy name
// 2, wrapper 3 (2), and step 10 with 1 for 0.1.0 or 3 for a later version.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";

const NODE_REQUIRED = "BuildOS needs Node.js 24 or newer on this computer. Install it from https://nodejs.org, then try again.";
const LEGACY_NOTICE = 'Note: the command name "buildos-intake" goes away in BuildOS 0.3.0. Use "buildos intake" instead.';
const WINDOWS = process.platform === "win32";

interface Step {
  name: string;
  command: string;
  exit: number | null;
  expected_exit: number;
  stdout: string;
  stderr: string;
  files?: Record<string, string>;
  checks: { check: string; ok: boolean }[];
  ok: boolean;
}

function usage(message: string): never {
  process.stderr.write(`${message}\nUsage: node scripts/published-smoke.ts --version <version> --out <folder>\n`);
  process.exit(2);
}

function parseArgs(argv: string[]): { version: string; out: string } {
  let version = "";
  let out = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version") version = argv[++i] ?? "";
    else if (a === "--out") out = argv[++i] ?? "";
    else usage(`unknown argument: ${a}`);
  }
  // A plain semver version only: npm reads an empty spec as "any version".
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version)) usage("--version must be a plain version such as 0.1.0");
  if (out === "") usage("--out is required");
  return { version, out };
}

/** npx as `node <npx-cli.js>`, so no shell is needed on Windows; else npx on PATH. */
function npxCommand(): { file: string; prefix: string[]; shell: boolean } {
  const nodeDir = dirname(process.execPath);
  for (const cli of [join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"), join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npx-cli.js")]) {
    if (existsSync(cli)) return { file: process.execPath, prefix: [cli], shell: false };
  }
  return { file: "npx", prefix: [], shell: WINDOWS };
}

const { version, out } = parseArgs(process.argv.slice(2));
const root = mkdtempSync(join(tmpdir(), "buildos-smoke-"));
const cache = join(root, "npm-cache");
mkdirSync(cache);
const npx = npxCommand();
const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  npm_config_cache: cache,
  npm_config_ignore_scripts: "true",
  npm_config_update_notifier: "false",
  npm_config_fund: "false",
  npm_config_audit: "false",
};
// A BuildOS variable from the caller never counts.
for (const key of Object.keys(baseEnv)) if (key.startsWith("BUILDOS_")) delete baseEnv[key];

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

function run(name: string, shown: string, file: string, args: string[], expected: number, cwd: string, opts: { env?: NodeJS.ProcessEnv; shell?: boolean; verbatim?: boolean } = {}): Step {
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

function npxRun(name: string, args: string[], expected: number, cwd: string): Step {
  const full = ["-y", `build-os@${version}`, ...args];
  return run(name, `npx ${full.join(" ")}`, npx.file, [...npx.prefix, ...full], expected, cwd, { shell: npx.shell });
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
  const legacyArgs = ["-y", `--package=build-os@${version}`, "buildos-intake", "--help"];
  const legacy = run("legacy name buildos-intake --help", `npx ${legacyArgs.join(" ")}`, npx.file, [...npx.prefix, ...legacyArgs], 0, project, { shell: npx.shell });
  const plain = npxRun("intake --help (for the legacy comparison)", ["intake", "--help"], 0, project);
  const lines = legacy.stderr.split("\n");
  check(legacy, "the first stderr line is the legacy notice", lines[0] === LEGACY_NOTICE);
  check(legacy, "the rest of stderr equals that of buildos intake --help", lines.slice(1).join("\n") === plain.stderr);
  check(legacy, "stdout equals that of buildos intake --help", legacy.stdout === plain.stdout);
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
    const step = run("wrapper with Node.js missing (.os\\scripts\\buildos.cmd version)", "PATH=%SystemRoot%\\System32;%SystemRoot% .os\\scripts\\buildos.cmd version", comspec, [line], 127, project, { env, verbatim: true });
    check(step, "no node.exe in the PATH folders", !nodeFound);
    check(step, "stderr is exactly the plain message", step.stderr === `${NODE_REQUIRED}\n`);
    check(step, "stdout is empty", step.stdout === "");
  } else {
    const bin = newFolder("path-without-node");
    symlinkSync("/bin/sh", join(bin, "sh"));
    const env = { ...baseEnv, PATH: bin };
    for (const name of ["buildos", "buildos-intake"]) {
      const step = run(`wrapper with Node.js missing (.os/scripts/${name} version)`, `PATH=<folder with only sh> sh .os/scripts/${name} version`, "/bin/sh", [join(scripts, name), "version"], 127, project, { env });
      const expected = name === "buildos" ? `${NODE_REQUIRED}\n` : `${LEGACY_NOTICE}\n${NODE_REQUIRED}\n`;
      check(step, "stderr is exactly the expected lines", step.stderr === expected);
      check(step, "stdout is empty", step.stdout === "");
    }
  }
}

// 9. The project wrapper with Node.js present: it runs the pinned version (through npx).
{
  const scripts = join(project, ".os", "scripts");
  const step = WINDOWS
    ? run("wrapper with Node.js present (.os\\scripts\\buildos.cmd version --json)", ".os\\scripts\\buildos.cmd version --json", process.env["ComSpec"] ?? "cmd.exe", [`/d /s /c ""${join(scripts, "buildos.cmd")}" version --json"`], 0, project, { verbatim: true })
    : run("wrapper with Node.js present (.os/scripts/buildos version --json)", "sh .os/scripts/buildos version --json", "/bin/sh", [join(scripts, "buildos"), "version", "--json"], 0, project);
  let parsed: { version?: string } = {};
  try {
    parsed = JSON.parse(step.stdout) as typeof parsed;
  } catch {
    // Reported by the check below.
  }
  check(step, `the wrapper ran version ${version}`, parsed.version === version);
}

// 10. A printed fix command (F-P8-11, PE-023), run as printed. Last, because it writes the project's entity index.
{
  const json = npxRun("entities validate --json (the printed fix command)", ["entities", "validate", "--root", project, "--mode", "compat", "--json"], 0, project);
  let printed = "";
  try {
    printed = (JSON.parse(json.stdout) as { result?: { index?: { remediation_command?: string } } }).result?.index?.remediation_command ?? "";
  } catch {
    // Reported by the checks below.
  }
  const human = steps.find((s) => s.name === "entities validate");
  check(json, "result.index.remediation_command holds a rebuild-index command", printed.includes(" entities rebuild-index --root ") && printed.endsWith(" --mode compat --apply"));
  check(json, "the human action: line of step 5 holds the same command", human !== undefined && human.stdout.split("\n").includes(`  action: ${printed}`));
  if (version === "0.1.0") {
    check(json, "0.1.0 prints a bare buildos (the known defect F-P8-11, fixed in 0.2.0); the step does not run it", printed.startsWith("buildos entities rebuild-index --root "));
  } else {
    check(json, `the command starts with npx -y build-os@${version}`, printed.startsWith(`npx -y build-os@${version} entities rebuild-index --root `));
    const step = WINDOWS
      ? run("the printed fix command, as printed, in Command Prompt", printed, process.env["ComSpec"] ?? "cmd.exe", [`/d /s /c "${printed}"`], 0, project, { verbatim: true })
      : run("the printed fix command, as printed, in sh", printed, "/bin/sh", ["-c", printed], 0, project);
    check(step, "stdout says entities.rebuild-index: ok and the write was applied", step.stdout.startsWith("entities.rebuild-index: ok\n") && step.stdout.includes("write status: applied\n"));
    const after = npxRun("entities validate after the printed fix command", ["entities", "validate", "--root", project, "--mode", "compat"], 0, project);
    check(after, "no index warning", after.stdout.startsWith("entities.validate: ok\n") && !after.stdout.includes("index_stale") && !after.stderr.includes("index_stale"));
  }
}

for (const s of steps) s.ok = s.checks.every((c) => c.ok);
const passed = steps.every((s) => s.ok);
// The checks are done: only now is the output cleaned, for the report.
const reported = steps.map((s) => ({ ...s, stdout: clean(s.stdout, stepFolder.get(s)), stderr: clean(s.stderr, stepFolder.get(s)) }));
const os = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : process.platform;
const npmVersion = spawnSync(npx.file, [...npx.prefix, "--version"], { env: baseEnv, encoding: "utf8", shell: npx.shell, cwd: root }).stdout?.toString().trim() ?? "";
const report = {
  package: `build-os@${version}`,
  os,
  platform: `${process.platform} ${process.arch}`,
  node: process.version,
  npm: npmVersion,
  npm_cache: "a new empty folder below {TMP}",
  paths_replaced: "{TMP} temporary root, {PROJECT} step folder, {HOME} home folder, {USER} user name, {TIMESTAMP} times",
  passed,
  steps: reported,
};
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `smoke-${os}.json`), `${JSON.stringify(report, null, 2)}\n`);
const md: string[] = [`# build-os@${version} smoke on ${os}`, "", `Node ${process.version}, npm ${npmVersion}, ${process.platform} ${process.arch}. Result: ${passed ? "passed" : "FAILED"}. Paths are replaced as stated in the JSON report.`, ""];
for (const s of reported) {
  md.push(`## ${s.ok ? "pass" : "FAIL"}: ${s.name}`, "", `Command: \`${s.command}\` (exit ${s.exit}, expected ${s.expected_exit})`, "");
  for (const c of s.checks) md.push(`- ${c.ok ? "ok" : "FAILED"}: ${c.check}`);
  md.push("", "stdout:", "", "```text", s.stdout.replace(/\n$/, ""), "```", "", "stderr:", "", "```text", s.stderr.replace(/\n$/, ""), "```", "");
  for (const [path, text] of Object.entries(s.files ?? {})) md.push(`File \`${path}\`:`, "", "```text", text.replace(/\n$/, ""), "```", "");
}
writeFileSync(join(out, `smoke-${os}.md`), md.join("\n"));
process.stdout.write(`build-os@${version} smoke on ${os}: ${passed ? "passed" : "FAILED"} (${steps.filter((s) => s.ok).length} of ${steps.length} steps)\n`);
for (const s of steps) if (!s.ok) process.stdout.write(`  FAILED: ${s.name}: ${s.checks.filter((c) => !c.ok).map((c) => c.check).join("; ")}\n`);
rmSync(root, { recursive: true, force: true, maxRetries: 5 });
process.exit(passed ? 0 : 1);
