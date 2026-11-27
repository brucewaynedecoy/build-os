// W1 R7 P6 t9: the project wrappers in system/.os/scripts/ (`sh` on macOS and
// Linux, `.cmd` on Windows). Each case runs a wrapper with a controlled PATH
// that holds only stubs and fixtures, so the machine's real `buildos`, `npx`,
// and Node never count:
//
// - pin first (owner decision 2026-11-25, Q-015; W1 R7 P8 pin-first review
//   round 1): the wrapper never starts a program to learn its version. It
//   runs an npm install of exactly the version pinned in .os/manifest.json
//   (in the project's node_modules, in npm's local project folder, or the
//   first `buildos` on PATH when that is an npm install) as
//   `node <bin file> ...`, with the same node and working folder. Any other
//   layout does not count;
// - no such install, Node 24: the stub `npx` records
//   `-y build-os@<version from .os/manifest.json> ...`;
// - Node absent, and Node 22: the one plain message, no stack trace, exit 127;
// - a legacy-name project script (Q-016, PE-016) writes the package's
//   legacy-name notice line once, first on stderr, and changes nothing else.
//
// The `node` stub runs this test's own Node (24 or newer); the Node 22 stub
// runs it with a preload that reports version 22.11.0. Every stub that
// stands for a program is a recorder: it writes the exact argument list it
// got as JSON (W1 R7 P6 review round 2, P6-R2-13), so the tests compare argv
// arrays, never text joined with spaces. A fixture npm package has a
// `buildos` bin file that records its arguments, its Node, and its working
// folder. Each program that must not run records any start, and the tests
// check that count. On failure, each assertion prints the exit code, stdout,
// stderr, PATH, and the command line, so a CI log is enough to see what
// happened on a system the developer cannot run.

import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertOutputDoesNotMatch, assertOutputMatches, assertSame, shape, tag } from "./helpers.ts";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(packageRoot, "..", "..");
const scriptsSource = resolve(repoRoot, "system", ".os", "scripts");
const windows = process.platform === "win32";
const MESSAGE = readFileSync(join(scriptsSource, "node-required.txt"), "utf8").trim();
const NPX_MESSAGE = "BuildOS needs npx to fetch the BuildOS version this project uses. npx comes with Node.js: install Node.js 24 or newer from https://nodejs.org, then try again.";
const LOOP_MESSAGE = "BuildOS stopped: its project wrappers kept calling each other. Remove the other BuildOS wrapper folders from PATH, then try again.";
const PACKAGE = "build-os";
const WRAPPERS = [
  { name: "buildos", domain: [] as string[] },
  { name: "buildos-intake", domain: ["intake"] },
  { name: "buildos-discovery", domain: ["discovery"] },
  { name: "buildos-design", domain: ["design"] },
];
/** Arguments with characters that Command Prompt or a shell could change: each must arrive exactly. */
const HARD_ARGS = ["help", "with space", "a&b|c", "x^y", "(paren)", "100%", "semi;colon", "comma,eq=", "<angle>", "it's"];
const MANIFEST = '{\n  "schema_version": 1,\n  "buildos_version": "1.2.3",\n  "initialized_at": "2026-11-24T00:00:00.000Z"\n}\n';
const DEV_MANIFEST = '{"schema_version":1,"buildos_version":"dev","initialized_at":"2026-11-24T00:00:00Z"}';
/** What a fixture `buildos` bin file writes to stdout: the wrapper must pass it on unchanged. */
const STUB_STDOUT = "buildos stub stdout\n";
/** The legacy-name notice lines of the package (PE-016); the project scripts write the same lines (Q-016). */
const LEGACY_NOTICE = (JSON.parse(readFileSync(join(packageRoot, "test", "golden", "parity-exceptions.json"), "utf8")) as { exceptions: { id: string; legacy_notice?: Record<string, string> }[] }).exceptions.find((e) => e.id === "PE-016")!.legacy_notice!;
const helper = createRequire(import.meta.url)(join(scriptsSource, "pinned-version.cjs")) as {
  splitWindowsPath(value: string): string[];
  packageEntry(dir: string, version: string | null): string | undefined;
  localEntry(projectRoot: string, version: string | null): string | undefined;
  isShWrapper(file: string): boolean;
  cmdLineTooLong(program: string, args: string[]): boolean;
  programEnvironment(version: string): Record<string, string>;
  npxEnvironment(version: string): Record<string, string>;
  CMD_LINE_LIMIT: number;
  windowsCandidateEntry(candidate: string, version: string): string | undefined;
  npmLocalPrefix(cwd: string): string;
  DEV_MESSAGE: string;
};

/**
 * The stderr of a run of wrapper `name` after its legacy-name notice: for a
 * legacy name the notice must be the first line, exactly once; for
 * `buildos` there is none. Line ends are read as LF (Command Prompt's echo
 * writes CRLF).
 */
function afterNotice(name: string, stderr: string, explain: string): string {
  const text = stderr.replace(/\r\n/g, "\n");
  const line = LEGACY_NOTICE[name];
  if (line === undefined) {
    assertOutputDoesNotMatch(text, /goes away in BuildOS/, shape(explain));
    return text;
  }
  assert.ok(text.startsWith(line), shape(`stderr must start with the notice ${JSON.stringify(line)}\n${explain}`));
  assertSame(text.split(line).length - 1, 1, shape(`the notice must be there once\n${explain}`));
  return text.slice(line.length);
}

/** The full path of program `name` on this test's own PATH (POSIX), or `undefined`. */
function onPath(name: string): string | undefined {
  return (process.env["PATH"] ?? "").split(delimiter).filter((dir) => dir !== "").map((dir) => join(dir, name)).find((file) => existsSync(file));
}

let scratch: string;
let recordScript: string;

before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-wrappers-"));
  recordScript = join(scratch, "record.cjs");
  // Writes the arguments as JSON to the file, the npm bin-links setting it got to <file>.env, and the
  // version the wrapper requires (BUILDOS_REQUIRE_VERSION, review round 2) to <file>.req.
  writeFileSync(recordScript, 'const fs = require("fs");\nconst [file, code, ...args] = process.argv.slice(2);\nfs.writeFileSync(file, JSON.stringify(args));\nfs.writeFileSync(file + ".env", JSON.stringify(process.env.npm_config_bin_links ?? null));\nfs.writeFileSync(file + ".req", JSON.stringify(process.env.BUILDOS_REQUIRE_VERSION ?? null));\nprocess.exit(Number(code));\n');
});
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

let counter = 0;

/** A project with the wrappers and a manifest, and an empty stub folder. */
function setup(manifest: string | Buffer | null = MANIFEST, projectName = "project with space") {
  const base = join(scratch, `case-${++counter}`);
  const project = join(base, projectName);
  const scripts = join(project, ".os", "scripts");
  mkdirSync(scripts, { recursive: true });
  cpSync(scriptsSource, scripts, { recursive: true });
  if (manifest !== null) writeFileSync(join(project, ".os", "manifest.json"), manifest);
  const stubs = join(base, "stubs");
  mkdirSync(stubs);
  const record = join(base, "record.json");
  return { base, project, scripts, stubs, record };
}

/** A recorder program `name` in `dir`: it writes `[name, ...args]` as JSON to `record` and exits `code`. */
function recorder(dir: string, name: string, record: string, code = 0): void {
  if (windows) {
    writeFileSync(join(dir, `${name}.cmd`), `@"${process.execPath}" "${recordScript}" "${record}" ${code} ${name} %*\r\n`);
    return;
  }
  const file = join(dir, name);
  writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${recordScript}" "${record}" ${code} ${name} "$@"\n`);
  chmodSync(file, 0o755);
}

/** The source of a fixture bin file: it records its arguments, Node, and working folder, writes STUB_STDOUT, and exits `code`. */
function binSource(record: string, code: number): string {
  return [
    'const fs = require("fs");',
    `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify(["buildos", ...process.argv.slice(2)]));`,
    `fs.writeFileSync(${JSON.stringify(`${record}.meta`)}, JSON.stringify({ execPath: process.execPath, cwd: process.cwd(), require: process.env.BUILDOS_REQUIRE_VERSION ?? null }));`,
    `process.stdout.write(${JSON.stringify(STUB_STDOUT)});`,
    `process.exit(${code});`,
    "",
  ].join("\n");
}

interface PackageOptions {
  version?: string;
  /** The exact package.json text, instead of the default one. */
  packageJson?: string;
  /** The bin file name inside the package (default `dist/buildos.js`). */
  bin?: string;
  /** The bin file source (default: a recorder). */
  source?: string;
  code?: number;
}

/** An npm package folder `dir` for build-os with a recording bin file. Returns the bin file. */
function writePackage(dir: string, record: string, options: PackageOptions = {}): string {
  const bin = options.bin ?? "dist/buildos.js";
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "package.json"), options.packageJson ?? `${JSON.stringify({ name: PACKAGE, version: options.version ?? "1.2.3", bin: { buildos: bin } }, null, 2)}\n`);
  const entry = join(dir, ...bin.split("/"));
  mkdirSync(resolve(entry, ".."), { recursive: true });
  writeFileSync(entry, options.source ?? binSource(record, options.code ?? 0));
  chmodSync(entry, 0o755);
  return entry;
}

/**
 * A global npm install of the package under `prefix`, laid out as npm lays
 * it out: on macOS and Linux `prefix/bin/buildos` is a link to the bin file
 * in `prefix/lib/node_modules/build-os`; on Windows
 * `prefix\buildos.cmd` is a shim (here a recorder to `<record>.shim` that
 * exits 99, so a test sees if it ever runs) next to
 * `prefix\node_modules\build-os`. Returns the folder to put
 * on PATH. With `binDir`, the link (or shim) goes there instead.
 */
function npmGlobal(prefix: string, record: string, options: PackageOptions & { binDir?: string } = {}): string {
  if (windows) {
    const dir = options.binDir ?? prefix;
    mkdirSync(dir, { recursive: true });
    writePackage(join(dir, "node_modules", "build-os"), record, options);
    recorder(dir, "buildos", `${record}.shim`, 99);
    return dir;
  }
  const entry = writePackage(join(prefix, "lib", "node_modules", "build-os"), record, options);
  const dir = options.binDir ?? join(prefix, "bin");
  mkdirSync(dir, { recursive: true });
  symlinkSync(entry, join(dir, "buildos"));
  return dir;
}

/** A local npm install of the package in `base/node_modules`, with no bin link (as `npm install --no-bin-links` leaves it). */
function npmLocal(base: string, record: string, options: PackageOptions = {}): void {
  writePackage(join(base, "node_modules", "build-os"), record, options);
}

/** A hand-made `buildos` program in `dir` (not an npm install): it records any start to `<record>.handmade` and exits 98. */
function handMade(dir: string, record: string): void {
  mkdirSync(dir, { recursive: true });
  recorder(dir, "buildos", `${record}.handmade`, 98);
}

/** A `node` stub that runs this test's Node, with an optional preload. */
function nodeStub(stubs: string, preload?: string): void {
  const args = preload === undefined ? "" : ` --require "${preload}"`;
  if (windows) {
    writeFileSync(join(stubs, "node.cmd"), `@"${process.execPath}"${args} %*\r\n`);
    return;
  }
  const file = join(stubs, "node");
  writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}"${args} "$@"\n`);
  chmodSync(file, 0o755);
}

function node22Preload(stubs: string): string {
  const file = join(stubs, "fake-node-22.cjs");
  writeFileSync(file, 'Object.defineProperty(process, "version", { value: "v22.11.0" });\nObject.defineProperty(process.versions, "node", { value: "22.11.0" });\n');
  return file;
}

/** One argument for a Windows command line: quoted for the C runtime's rules (cmd.exe keeps quoted text as it is). */
function winQuote(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;
}

interface Ran {
  result: SpawnSyncReturns<string>;
  /** Everything a reader of a CI log needs to see what happened. */
  explain: string;
}

/**
 * Runs a wrapper with only `stubs` (and, for `sh`, a `sh` link; for `.cmd`,
 * the Windows system folder) on PATH, after `extraPath`. `cmdFlags` are
 * extra `cmd.exe` switches (Windows), such as `/v:on`. `pathText` replaces
 * the whole PATH value as it is (Windows quoted entries).
 */
function runWrapper(setupResult: ReturnType<typeof setup>, name: string, args: string[], extraPath: string[] = [], options: { cmdFlags?: string[]; pathText?: string; cwd?: string; relative?: boolean; env?: Record<string, string>; shell?: string } = {}): Ran {
  const { project, scripts, stubs } = setupResult;
  const cwd = options.cwd ?? project;
  let result: SpawnSyncReturns<string>;
  let line: string;
  let path: string;
  if (windows) {
    const system = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32");
    path = options.pathText ?? [...extraPath, stubs, system].join(delimiter);
    const env = { SystemRoot: process.env["SystemRoot"] ?? "C:\\Windows", PATH: path, PATHEXT: ".COM;.EXE;.BAT;.CMD", TEMP: scratch, TMP: scratch, ...options.env };
    // With `relative`, the wrapper is named from the project folder, so the caller's own command line holds no folder name.
    const program = options.relative === true ? `.os\\scripts\\${name}.cmd` : join(scripts, `${name}.cmd`);
    line = `"${program}" ${args.map(winQuote).join(" ")}`;
    result = spawnSync(join(system, "cmd.exe"), ["/d", ...(options.cmdFlags ?? []), "/s", "/c", `"${line}"`], { cwd, env, encoding: "utf8", windowsVerbatimArguments: true, timeout: 30_000 });
  } else {
    // With `shell` (such as dash, the sh of Ubuntu), the wrapper's first line finds that shell as sh.
    const tools = join(stubs, "..", options.shell === undefined ? "tools" : `tools-${options.shell.replace(/[^A-Za-z0-9]/g, "_")}`);
    if (!existsSync(tools)) {
      mkdirSync(tools);
      symlinkSync(options.shell ?? "/bin/sh", join(tools, "sh"));
    }
    path = options.pathText ?? [...extraPath, stubs, tools].join(delimiter);
    line = [join(scripts, name), ...args].map((a) => JSON.stringify(a)).join(" ");
    result = spawnSync(join(scripts, name), args, { cwd, env: { PATH: path, HOME: scratch, ...options.env }, encoding: "utf8", timeout: 30_000 });
  }
  const explain = [`exit code: ${String(result.status)}${result.signal === null ? "" : ` (signal ${result.signal})`}`, `error: ${result.error?.message ?? "none"}`, `command: ${line}`, `cwd: ${cwd}`, `PATH: ${path}`, `stdout: ${JSON.stringify(result.stdout)}`, `stderr: ${JSON.stringify(result.stderr)}`].join("\n");
  return { result, explain };
}

function recorded(file: string, explain: string): string[] {
  assert.ok(existsSync(file), shape(`nothing was recorded at ${file}\n${explain}`));
  return JSON.parse(readFileSync(file, "utf8")) as string[];
}

/** The same folder, as the OS reports it (real path; any case on Windows). */
function sameFolder(a: string, b: string): boolean {
  const x = realpathSync(a);
  const y = realpathSync(b);
  return windows ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** Checks that the fixture bin file ran with this test's Node and in `cwd`, and that a Windows shim never ran. */
function assertRanDirectly(record: string, cwd: string, explain: string): void {
  const meta = JSON.parse(readFileSync(`${record}.meta`, "utf8")) as { execPath: string; cwd: string };
  assert.ok(sameFolder(meta.execPath, process.execPath), shape(`the bin file must run with the wrapper's own node: ${meta.execPath}\n${explain}`));
  assert.ok(sameFolder(meta.cwd, cwd), shape(`the bin file must run in the caller's working folder: ${meta.cwd}\n${explain}`));
  assertSame(existsSync(`${record}.shim`), false, shape(`the npm shim must not run\n${explain}`));
}

/** The BUILDOS_REQUIRE_VERSION value the fixture bin file got. */
function requiredBy(record: string): string | null {
  return (JSON.parse(readFileSync(`${record}.meta`, "utf8")) as { require: string | null }).require;
}

/**
 * What a stub npx recorded, after a check that it got
 * `--prefix <cwd> --workspaces=false` (pin-first final check, finding 2),
 * without that part.
 */
function npxRecorded(file: string, explain: string, cwd: string): string[] {
  const args = recorded(file, explain);
  assertSame(args[2], "--prefix", shape(explain));
  assert.ok(args[3] !== undefined && sameFolder(args[3], cwd), shape(`npx must get --prefix with the caller's folder ${cwd}: ${String(args[3])}\n${explain}`));
  assertSame(args[4], "--workspaces=false", shape(explain));
  return [...args.slice(0, 2), ...args.slice(5)];
}

/** The npx argument list for the pinned version 1.2.3. */
function npxArgs(...args: string[]): string[] {
  return ["npx", "-y", `${PACKAGE}@1.2.3`, ...args];
}

describe(`project wrappers (${windows ? ".cmd" : "sh"})`, () => {
  for (const wrapper of WRAPPERS) {
    describe(wrapper.name, () => {
      it("runs the npm install on PATH of the pinned version with the same node, the same working folder, the exact arguments, stdout, and exit code", () => {
        const s = setup();
        const bin = npmGlobal(join(s.base, "global"), s.record, { code: 7 });
        recorder(s.stubs, "npx", `${s.record}.npx`);
        nodeStub(s.stubs);
        const { result, explain } = runWrapper(s, wrapper.name, ["version", "--json", ...HARD_ARGS], [bin]);
        assert.equal(result.status, 7, explain);
        assert.deepEqual(recorded(s.record, explain), ["buildos", ...wrapper.domain, "version", "--json", ...HARD_ARGS], explain);
        assertSame(result.stdout, STUB_STDOUT, shape(explain));
        assertSame(afterNotice(wrapper.name, result.stderr, explain), "", shape(explain));
        assertRanDirectly(s.record, s.project, explain);
        assertSame(requiredBy(s.record), "1.2.3", shape(`the wrapper sets BUILDOS_REQUIRE_VERSION to the pin\n${explain}`));
        assert.equal(existsSync(`${s.record}.npx`), false, `npx must not run when the npm install on PATH has the pinned version\n${explain}`);
      });

      // Owner decision 2026-11-25 (Q-015, pin first).
      it("does not run an npm install on PATH of another version: npx runs the pinned version with the exact arguments and npm bin links on", () => {
        const s = setup();
        const bin = npmGlobal(join(s.base, "global"), s.record, { version: "9.9.9" });
        recorder(s.stubs, "npx", `${s.record}.npx`, 5);
        nodeStub(s.stubs);
        const { result, explain } = runWrapper(s, wrapper.name, HARD_ARGS, [bin]);
        assert.equal(result.status, 5, explain);
        assertSame(npxRecorded(`${s.record}.npx`, explain, s.project), npxArgs(...wrapper.domain, ...HARD_ARGS), shape(explain));
        assertSame(JSON.parse(readFileSync(`${s.record}.npx.env`, "utf8")), "true", shape(explain));
        assertSame(JSON.parse(readFileSync(`${s.record}.npx.req`, "utf8")), "1.2.3", shape(`the wrapper sets BUILDOS_REQUIRE_VERSION for npx too\n${explain}`));
        assertSame(existsSync(s.record), false, shape(`the buildos on PATH must not run\n${explain}`));
        assertSame(existsSync(`${s.record}.shim`), false, shape(explain));
        assertSame(result.stdout, "", shape(explain));
        assertSame(afterNotice(wrapper.name, result.stderr, explain), "", shape(explain));
      });

      it("skips itself on PATH and, with Node 24, runs npx with the version pinned in .os/manifest.json and the exact arguments", () => {
        const s = setup();
        recorder(s.stubs, "npx", s.record, 0);
        nodeStub(s.stubs);
        const { result, explain } = runWrapper(s, wrapper.name, HARD_ARGS, [s.scripts]);
        assert.equal(result.status, 0, explain);
        assert.deepEqual(npxRecorded(s.record, explain, s.project), npxArgs(...wrapper.domain, ...HARD_ARGS), explain);
        assertSame(afterNotice(wrapper.name, result.stderr, explain), "", shape(explain));
      });

      it("prints the one plain message and exits 127 when Node is absent", () => {
        const s = setup();
        recorder(s.stubs, "npx", s.record, 0);
        const { result, explain } = runWrapper(s, wrapper.name, ["help"]);
        assert.equal(result.status, 127, explain);
        assert.equal(result.stdout, "", explain);
        assert.equal(afterNotice(wrapper.name, result.stderr, explain).trim(), MESSAGE, explain);
        assert.equal(existsSync(s.record), false, explain);
      });

      it("prints the same plain message and exits 127 with Node 22", () => {
        const s = setup();
        recorder(s.stubs, "npx", s.record, 0);
        nodeStub(s.stubs, node22Preload(s.stubs));
        const { result, explain } = runWrapper(s, wrapper.name, ["help"]);
        assert.equal(result.status, 127, explain);
        assert.equal(result.stdout, "", explain);
        assert.equal(afterNotice(wrapper.name, result.stderr, explain).trim(), MESSAGE, explain);
        assert.doesNotMatch(result.stderr, /\n\s+at\s|Error:/, explain);
        assert.equal(existsSync(s.record), false, explain);
      });
    });
  }

  // W1 R7 P8 pin-first review round 1, finding 1: npx takes a local install of the pinned version as found and then starts
  // its bin by name from PATH ("build-os" since the package name of 2026-11-26) when the bin link is missing. The wrapper
  // runs that local install itself.
  it("runs a local install of the pinned version in the project's node_modules (no bin link) and never a buildos on PATH", () => {
    const s = setup();
    npmLocal(s.project, s.record, { code: 6 });
    handMade(join(s.base, "planted"), s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", HARD_ARGS, [join(s.base, "planted")]);
    assert.equal(result.status, 6, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", ...HARD_ARGS], shape(explain));
    assertRanDirectly(s.record, s.project, explain);
    assertSame(existsSync(`${s.record}.handmade`), false, shape(`the buildos on PATH must not run\n${explain}`));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  it("runs a local install of the pinned version in npm's local project folder (the first folder up from the current folder with a node_modules folder)", () => {
    const s = setup();
    const work = join(s.base, "work");
    npmLocal(work, s.record);
    const deep = join(work, "deep", "er");
    mkdirSync(deep, { recursive: true });
    handMade(join(s.base, "planted"), s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [join(s.base, "planted")], { cwd: deep });
    assert.equal(result.status, 0, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
    assertRanDirectly(s.record, deep, explain);
    assertSame(existsSync(`${s.record}.handmade`), false, shape(explain));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  // Pin-first final check, finding 1: npm hoisted the install to the root of an npm workspace above the project, with
  // no bin link. The project folder has its own package.json (a workspace member), so npm's local project folder is the
  // project folder too. The wrapper looks in each folder above, as Node.js does, and runs it.
  it("runs a local install of the pinned version in a folder above the project (hoisted to an npm workspace root), never a buildos on PATH or npx", () => {
    const s = setup();
    npmLocal(s.base, s.record, { code: 4 });
    writeFileSync(join(s.project, "package.json"), '{"name":"app","version":"1.0.0"}\n');
    handMade(join(s.base, "planted"), s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [join(s.base, "planted")]);
    assert.equal(result.status, 4, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
    assertRanDirectly(s.record, s.project, explain);
    assertSame(existsSync(`${s.record}.handmade`), false, shape(`the buildos on PATH must not run\n${explain}`));
    assertSame(existsSync(`${s.record}.npx`), false, shape(`npx must not run\n${explain}`));
  });

  it("does not run a local install of another version: npx runs the pinned version", () => {
    const s = setup();
    npmLocal(s.project, s.record, { version: "1.2.4" });
    recorder(s.stubs, "npx", `${s.record}.npx`);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(npxRecorded(`${s.record}.npx`, explain, s.project), npxArgs("help"), shape(explain));
    assertSame(existsSync(s.record), false, shape(explain));
  });

  // W1 R7 P6 review round 1, P6-R1-11: the wrapper keeps searching PATH after it skips itself.
  it("with this wrapper folder first on PATH, still runs an npm install later on PATH (no npx)", () => {
    const s = setup();
    const bin = npmGlobal(join(s.base, "global"), s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], [s.scripts, bin]);
    assert.equal(result.status, 0, explain);
    assert.deepEqual(recorded(s.record, explain), ["buildos", "version"], explain);
    assert.equal(existsSync(`${s.record}.npx`), false, explain);
  });

  // W1 R7 P8 pin-first review round 1, finding 7: the other wrapper records each start, and an install later on PATH must run.
  it("skips another project's wrapper on PATH without starting it, and runs the npm install after it", () => {
    const s = setup();
    const other = setup();
    const entered = join(other.base, "entered.txt");
    if (windows) {
      const file = join(other.scripts, "buildos.cmd");
      const lines = readFileSync(file, "utf8").split("\r\n");
      lines.splice(2, 0, `@echo entered>>"${entered}"`);
      writeFileSync(file, lines.join("\r\n"));
    } else {
      const file = join(other.scripts, "buildos");
      const lines = readFileSync(file, "utf8").split("\n");
      lines.splice(2, 0, `echo entered >> '${entered}'`);
      writeFileSync(file, lines.join("\n"));
    }
    const bin = npmGlobal(join(s.base, "global"), s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [other.scripts, s.scripts, bin]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
    assertSame(existsSync(entered), false, shape(`the other project's wrapper must not start\n${explain}`));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  it("knows itself through another spelling of its folder (a link to it)", (t) => {
    if (windows) return t.skip("the .cmd wrapper skips every BuildOS wrapper by its first lines; links need a privilege on Windows");
    const s = setup();
    const alias = join(s.stubs, "..", "alias");
    symlinkSync(s.scripts, alias);
    const bin = npmGlobal(join(s.base, "global"), s.record);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], [alias, bin]);
    assert.equal(result.status, 0, explain);
    assert.deepEqual(recorded(s.record, explain), ["buildos", "version"], explain);
  });

  // W1 R7 P6 review round 2, P6-R2-12.
  it("skips the Go-era wrapper (commit 7cfc0b7) first on PATH and runs an npm install later on PATH", (t) => {
    if (windows) return t.skip("the Go-era tools shipped no .cmd wrapper");
    const s = setup();
    const goEra = join(s.base, "go-era");
    mkdirSync(goEra);
    writeFileSync(join(goEra, "buildos"), goEraWrapper());
    chmodSync(join(goEra, "buildos"), 0o755);
    const bin = npmGlobal(join(s.base, "global"), s.record);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], [goEra, bin]);
    assert.equal(result.status, 0, explain);
    assert.deepEqual(recorded(s.record, explain), ["buildos", "version"], explain);
  });

  it("finds an npm install through a relative PATH entry, relative to the current folder", () => {
    const s = setup();
    npmGlobal(join(s.base, "global"), s.record, { binDir: join(s.base, "work", "bin") });
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], ["bin"], { cwd: join(s.base, "work") });
    assert.equal(result.status, 0, explain);
    assert.deepEqual(recorded(s.record, explain), ["buildos", "version"], explain);
  });

  // W1 R7 P8 pin-first review round 1, finding 6: a relative PATH entry that starts with - is never read as an option.
  // Review round 2, finding 1 (ubuntu CI run 45720263841): node and npx are started by path too, so dash never reads
  // "-npx/npx" as options when it runs a script's first line. Each sh on this system runs it, dash too.
  for (const shell of windows ? [undefined] : [undefined, ...(onPath("dash") === undefined ? [] : [onPath("dash")!])]) {
    it(`finds an npm install, node, and npx through relative PATH entries that start with -${shell === undefined ? "" : ` (${shell})`}`, () => {
      const s = setup();
      const work = join(s.base, "work");
      npmGlobal(join(s.base, "global"), s.record, { binDir: join(work, "-tools") });
      mkdirSync(join(work, "-node"), { recursive: true });
      nodeStub(join(work, "-node"));
      const found = runWrapper(s, "buildos", ["version"], ["-tools", "-node"], { cwd: work, ...(shell === undefined ? {} : { shell }) });
      assert.equal(found.result.status, 0, shape(found.explain));
      assertSame(recorded(s.record, found.explain), ["buildos", "version"], shape(found.explain));
      mkdirSync(join(work, "-npx"));
      recorder(join(work, "-npx"), "npx", `${s.record}.npx`);
      const viaNpx = runWrapper(s, "buildos", ["help"], ["-npx", "-node"], { cwd: work, ...(shell === undefined ? {} : { shell }) });
      assert.equal(viaNpx.result.status, 0, shape(viaNpx.explain));
      assertSame(npxRecorded(`${s.record}.npx`, viaNpx.explain, work), npxArgs("help"), shape(viaNpx.explain));
    });
  }

  // W1 R7 P8 pin-first review round 2, finding 14: on Windows the current folder holds an npm shim and package that
  // the wrapper would run from PATH (a node_modules\.bin folder with its own package.json, so npm's local project
  // folder is that folder and the project's local-package search does not find the package).
  // Final check CI run 45763347158 (Windows): the local lookup now walks up from the current folder, so a
  // verified package above the current folder runs as a local install. The shim file itself never runs.
  it(windows ? "never runs a buildos.cmd shim from the current folder; a verified package above it runs as a local install" : "reads an empty PATH entry as the current folder, as POSIX does", () => {
    const s = setup();
    let work = join(s.base, "work");
    mkdirSync(work);
    if (windows) {
      work = join(s.base, "outer", "node_modules", ".bin");
      mkdirSync(work, { recursive: true });
      writeFileSync(join(work, "package.json"), "{}\n");
      writePackage(join(s.base, "outer", "node_modules", "build-os"), s.record);
      recorder(work, "buildos", `${s.record}.shim`, 99);
    } else npmGlobal(join(s.base, "global"), s.record, { binDir: work });
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], windows ? [] : [""], { cwd: work });
    assert.equal(result.status, 0, explain);
    if (windows) {
      assertSame(recorded(s.record, explain), ["buildos", "version"], shape(explain));
      assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
      assertSame(existsSync(`${s.record}.shim`), false, shape(explain));
      // The same folder on PATH, from the project folder, is an install that counts too.
      rmSync(s.record, { force: true });
      const onPathRun = runWrapper(s, "buildos", ["version"], [work], { cwd: s.project });
      assert.equal(onPathRun.result.status, 0, shape(onPathRun.explain));
      assertSame(recorded(s.record, onPathRun.explain), ["buildos", "version"], shape(onPathRun.explain));
      assertSame(existsSync(`${s.record}.npx`), false, shape(onPathRun.explain));
    } else assert.deepEqual(recorded(s.record, explain), ["buildos", "version"], explain);
  });

  // A chain that comes back to a project wrapper is not an npm install, so it never starts, and npx runs the pinned version.
  it("does not start a hand-made chain of wrappers on PATH: npx runs the pinned version", () => {
    const s = setup();
    const loop = join(s.base, "loop");
    mkdirSync(loop);
    const entered = join(s.base, "entered.txt");
    if (windows) writeFileSync(join(loop, "buildos.cmd"), `@echo off\r\necho entered>>"${entered}"\r\n"${join(s.scripts, "buildos.cmd")}" %*\r\n`);
    else {
      writeFileSync(join(loop, "buildos"), `#!/bin/sh\necho entered >> '${entered}'\nexec sh "${join(s.scripts, "buildos")}" "$@"\n`);
      chmodSync(join(loop, "buildos"), 0o755);
    }
    recorder(s.stubs, "npx", s.record, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [loop]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(npxRecorded(s.record, explain, s.project), npxArgs("help"), shape(explain));
    assertSame(existsSync(entered), false, shape(explain));
    assertSame(result.stderr, "", shape(explain));
  });

  it("stops with one plain message (exit 127) when it starts inside a chain of wrappers (the guard is set)", () => {
    const s = setup();
    const bin = npmGlobal(join(s.base, "global"), s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [bin], { env: { BUILDOS_WRAPPER_ACTIVE: "1" } });
    assert.equal(result.status, 127, shape(explain));
    assertSame(result.stderr.trim(), LOOP_MESSAGE, shape(explain));
    assertSame(existsSync(s.record), false, shape(explain));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  // W1 R7 P6 CI run 45420565710: the caller's own Command Prompt expands !TEMP! in its command line
  // before the wrapper runs, so the wrapper is named from the project folder, with no ! in its name.
  it("keeps a folder name with ! and the arguments unchanged in Command Prompt with delayed expansion on", (t) => {
    if (!windows) return t.skip("Command Prompt only");
    const s = setup(MANIFEST, "bang !TEMP! dir");
    recorder(s.stubs, "npx", s.record, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help", "with space"], [], { cmdFlags: ["/v:on"], relative: true });
    assert.equal(result.status, 0, shape(explain));
    assertSame(npxRecorded(s.record, explain, s.project), npxArgs("help", "with space"), shape(explain));
  });

  // Owner decision 2026-11-25 (Q-016): the legacy-name .cmd script writes its notice and keeps a folder name with ! unchanged.
  it("a legacy-name script keeps a folder name with ! and the arguments unchanged in Command Prompt with delayed expansion on, and writes the notice once", (t) => {
    if (!windows) return t.skip("Command Prompt only");
    const s = setup(MANIFEST, "bang !TEMP! dir");
    recorder(s.stubs, "npx", s.record, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos-intake", ["help", "with space"], [], { cmdFlags: ["/v:on"], relative: true });
    assert.equal(result.status, 0, shape(explain));
    assertSame(npxRecorded(s.record, explain, s.project), npxArgs("intake", "help", "with space"), shape(explain));
    assertSame(afterNotice("buildos-intake", result.stderr, explain), "", shape(explain));
  });

  it("runs an npm install in a PATH folder whose name holds ! (delayed expansion on in the caller)", (t) => {
    if (!windows) return t.skip("Command Prompt only");
    const s = setup(MANIFEST, "bang !TEMP! dir");
    const bin = npmGlobal(join(s.base, "tools !PATH! x"), s.record, { code: 4 });
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help", "with space"], [bin], { cmdFlags: ["/v:on"], relative: true });
    assert.equal(result.status, 4, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help", "with space"], shape(explain));
    assertRanDirectly(s.record, s.project, explain);
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  // W1 R7 P8 pin-first review round 1, finding 8: folder names that hold %TEMP% (a variable that is set), an argument
  // with a double quote, and an empty argument, on both ways the wrapper starts BuildOS. The caller names the wrapper
  // from the project folder, so its own command line holds no %TEMP%; the recorders hold no fixture folder name.
  it("keeps folder names with %TEMP%, an argument with a double quote, and an empty argument unchanged, through the bin file and through npx", (t) => {
    if (!windows) return t.skip("Command Prompt only");
    const args = ["help", 'say "hi"', "", "with space", "it's"];
    const s = setup(MANIFEST, "pct %TEMP% dir");
    const bin = npmGlobal(join(s.base, "global %TEMP% x"), s.record);
    nodeStub(s.stubs);
    const direct = runWrapper(s, "buildos", args, [bin], { relative: true });
    assert.equal(direct.result.status, 0, shape(direct.explain));
    assertSame(recorded(s.record, direct.explain), ["buildos", ...args], shape(direct.explain));
    assertRanDirectly(s.record, s.project, direct.explain);
    const npxDir = join(s.base, "npx %TEMP% y");
    mkdirSync(npxDir);
    recorder(npxDir, "npx", `${s.record}.npx`);
    const viaNpx = runWrapper(s, "buildos-intake", args, [npxDir], { relative: true });
    assert.equal(viaNpx.result.status, 0, shape(viaNpx.explain));
    assertSame(npxRecorded(`${s.record}.npx`, viaNpx.explain, s.project), npxArgs("intake", ...args), shape(viaNpx.explain));
  });

  // W1 R7 P8 pin-first review round 1, finding 5: a quoted PATH entry may hold a ; as part of the folder name.
  it("finds buildos.cmd and npx.cmd in a quoted PATH entry whose folder name holds a ;", (t) => {
    if (!windows) return t.skip("Command Prompt only");
    const s = setup();
    const system = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32");
    const bin = npmGlobal(join(s.base, "Build;Tools"), s.record);
    nodeStub(s.stubs);
    const found = runWrapper(s, "buildos", ["help"], [], { pathText: `${s.stubs};"${bin}";${system}` });
    assert.equal(found.result.status, 0, shape(found.explain));
    assertSame(recorded(s.record, found.explain), ["buildos", "help"], shape(found.explain));
    const npxDir = join(s.base, "Npx;Tools");
    mkdirSync(npxDir);
    recorder(npxDir, "npx", `${s.record}.npx`);
    const viaNpx = runWrapper(s, "buildos", ["help"], [], { pathText: `${s.stubs};"${npxDir}";${system}` });
    assert.equal(viaNpx.result.status, 0, shape(viaNpx.explain));
    assertSame(npxRecorded(`${s.record}.npx`, viaNpx.explain, s.project), npxArgs("help"), shape(viaNpx.explain));
  });

  // Pin first, and no program starts to learn its version: only an npm install of exactly the pinned version counts.
  const refused: [string, (s: ReturnType<typeof setup>) => string][] = [
    ["a package with another name", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: JSON.stringify({ name: "buildos", version: "1.2.3", bin: { buildos: "dist/buildos.js" } }) })],
    ["a package whose version only starts with the pinned one", (s) => npmGlobal(join(s.base, "global"), s.record, { version: "1.2.3-rc.1" })],
    ["a package.json that is not strict JSON", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: `{"name":"${PACKAGE}","version":"1.2.3","bin":{"buildos":"dist/buildos.js"},}` })],
    ["a package.json with a byte order mark", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: `\ufeff${JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: { buildos: "dist/buildos.js" } })}` })],
    ["a package.json over the size limit", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: { buildos: "dist/buildos.js" }, pad: "x".repeat(256 * 1024) }) })],
    ["a package with no buildos bin", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: { other: "dist/buildos.js" } }) })],
    ["a package whose bin file is outside the package", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: { buildos: "../outside.js" } }) })],
    ["a package whose bin file is missing", (s) => npmGlobal(join(s.base, "global"), s.record, { packageJson: JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: { buildos: "dist/missing.js" } }) })],
    // Review round 2, finding 7: a bin file inside a nested dependency's node_modules folder.
    ["a package whose bin file is inside a node_modules folder below it", (s) => npmGlobal(join(s.base, "global"), s.record, { bin: "node_modules/other/buildos.js" })],
    [
      "a hand-made script with no package",
      (s) => {
        handMade(join(s.base, "planted"), s.record);
        return join(s.base, "planted");
      },
    ],
  ];
  if (!windows) {
    refused.push(
      [
        "a link to a file in the package that is not its buildos bin file",
        (s) => {
          const entry = writePackage(join(s.base, "global", "lib", "node_modules", "build-os"), s.record);
          const other = join(resolve(entry, ".."), "other.js");
          writeFileSync(other, binSource(s.record, 0));
          // Review round 2, finding 14: executable, so only the package check refuses it.
          chmodSync(other, 0o755);
          mkdirSync(join(s.base, "global", "bin"));
          symlinkSync(other, join(s.base, "global", "bin", "buildos"));
          return join(s.base, "global", "bin");
        },
      ],
      [
        // Review round 2, finding 10: a bin file that this user cannot read (Node would fail to load it).
        "a package whose bin file cannot be read",
        (s) => {
          const bin = npmGlobal(join(s.base, "global"), s.record);
          chmodSync(join(s.base, "global", "lib", "node_modules", "build-os", "dist", "buildos.js"), 0o311);
          return bin;
        },
      ],
      [
        "a package.json that is a link",
        (s) => {
          const bin = npmGlobal(join(s.base, "global"), s.record);
          const pkg = join(s.base, "global", "lib", "node_modules", "build-os");
          writeFileSync(join(s.base, "real-package.json"), readFileSync(join(pkg, "package.json")));
          rmSync(join(pkg, "package.json"));
          symlinkSync(join(s.base, "real-package.json"), join(pkg, "package.json"));
          return bin;
        },
      ],
      [
        "a shim script that starts the package (as pnpm, yarn, or Volta make)",
        (s) => {
          const entry = writePackage(join(s.base, "store", "build-os"), s.record);
          mkdirSync(join(s.base, "shims"));
          writeFileSync(join(s.base, "shims", "buildos"), `#!/bin/sh\nexec node "${entry}" "$@"\n`);
          chmodSync(join(s.base, "shims", "buildos"), 0o755);
          return join(s.base, "shims");
        },
      ],
    );
  } else {
    refused.push([
      "a buildos.exe next to the package (not an npm .cmd shim)",
      (s) => {
        const dir = join(s.base, "exe");
        writePackage(join(dir, "node_modules", "build-os"), s.record);
        writeFileSync(join(dir, "buildos.exe"), "not a program");
        return dir;
      },
    ]);
  }
  for (const [what, make] of refused) {
    it(`does not run ${what} on PATH, and starts nothing to check it: npx runs the pinned version`, (t) => {
      if (what.includes("cannot be read") && process.getuid?.() === 0) return t.skip("root reads every file");
      const s = setup();
      const bin = make(s);
      recorder(s.stubs, "npx", `${s.record}.npx`, 0);
      nodeStub(s.stubs);
      const { result, explain } = runWrapper(s, "buildos", ["help", "with space"], [bin]);
      assert.equal(result.status, 0, shape(explain));
      assertSame(npxRecorded(`${s.record}.npx`, explain, s.project), npxArgs("help", "with space"), shape(explain));
      assertSame(existsSync(s.record), false, shape(explain));
      assertSame(existsSync(`${s.record}.handmade`), false, shape(explain));
      assertSame(existsSync(`${s.record}.shim`), false, shape(explain));
      assertSame(result.stdout, "", shape(explain));
      assertSame(result.stderr, "", shape(explain));
    });
  }

  it("with an npm install of another version on PATH and no npx, says that npx is missing (exit 127)", () => {
    const s = setup();
    const bin = npmGlobal(join(s.base, "global"), s.record, { version: "9.9.9" });
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [bin]);
    assert.equal(result.status, 127, shape(explain));
    assertSame(result.stderr.trim(), NPX_MESSAGE, shape(explain));
    assertSame(existsSync(s.record), false, shape(explain));
  });

  // A dev pin (a project set up by a source build) has no published version: only an install of a source build (0.0.0-dev) runs.
  it("with a dev pin, runs an npm install of a source build (version 0.0.0-dev) on PATH", () => {
    const s = setup(DEV_MANIFEST);
    const bin = npmGlobal(join(s.base, "global"), s.record, { version: "0.0.0-dev" });
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [bin]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
    assertRanDirectly(s.record, s.project, explain);
  });

  it("with a dev pin, runs a local install of a source build (version 0.0.0-dev)", () => {
    const s = setup(DEV_MANIFEST);
    npmLocal(s.project, s.record, { version: "0.0.0-dev" });
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
  });

  // W1 R7 P8 pin-first review round 1, finding 12: the dev message names the two ways that work.
  // Review round 2, finding 3: a package of any version counts for a dev pin (the program decides), so here no
  // package is there at all: only a hand-made buildos on PATH.
  it("with a dev pin and no install that counts, stops with the dev message that names working steps (exit 3), and runs nothing", () => {
    const s = setup(DEV_MANIFEST);
    handMade(join(s.base, "planted"), s.record);
    const bin = join(s.base, "planted");
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [bin]);
    assert.equal(result.status, 3, shape(explain));
    assertSame(result.stderr.replace(/\r\n/g, "\n"), helper.DEV_MESSAGE, shape(explain));
    assertOutputMatches(result.stderr, /npm link/, shape(explain));
    assertOutputMatches(result.stderr, /set buildos_version in \.os\/manifest\.json to a published version/, shape(explain));
    assertOutputDoesNotMatch(result.stderr, /Install BuildOS, then try again/, shape(explain));
    assertSame(existsSync(`${s.record}.handmade`), false, shape(explain));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  it("with a dev pin, a package of any version counts, and the wrapper requires dev (the program decides)", () => {
    const s = setup(DEV_MANIFEST);
    npmLocal(s.project, s.record, { version: "0.1.0" });
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
    assertSame(requiredBy(s.record), "dev", shape(explain));
  });

  it("with a manifest that breaks the contract, runs no buildos (exit 3)", () => {
    const s = setup("{");
    const bin = npmGlobal(join(s.base, "global"), s.record);
    npmLocal(s.project, s.record);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [bin]);
    assert.equal(result.status, 3, shape(explain));
    assertOutputMatches(result.stderr, /Run "buildos init" in the project folder/, shape(explain));
    assertSame(existsSync(s.record), false, shape(explain));
  });

  // P6-R1-12: one helper result, and never an empty or unsafe version on the npx line.
  for (const [what, output] of [
    ["an empty version", ""],
    ["a version with a shell character", "1.2.3&x"],
    ["a version that starts with a letter", "latest"],
    ["a run result with a relative bin file", "run\\n1.2.3\\n/bin/node\\nrelative.js"],
    ["a run result with a relative node", "run\\n1.2.3\\nnode\\n/abs/entry.js"],
    ["a run result with a version with a shell character", "run\\n1.2.3&x\\n/bin/node\\n/abs/entry.js"],
    ["a run result with an empty version", "run\\n\\n/bin/node\\n/abs/entry.js"],
    ["a run result in the earlier three-line form", "run\\n/bin/node\\n/abs/entry.js"],
    ["dev as an npx version", "dev"],
  ] as const) {
    it(`refuses ${what} from the version helper (exit 3, nothing runs)`, (t) => {
      // W1 R7 P6 review round 3 (P6-R3-11): the .cmd wrapper reads no helper output; the helper starts the program itself.
      if (windows) return t.skip("the .cmd wrapper reads no helper output; the manifest contract tests cover the helper's version check");
      const s = setup();
      recorder(s.stubs, "npx", s.record, 0);
      // A fake node that prints a fixed helper result and exits 0.
      writeFileSync(join(s.stubs, "node"), `#!/bin/sh\nprintf '${output}\\n'\n`);
      chmodSync(join(s.stubs, "node"), 0o755);
      const { result, explain } = runWrapper(s, "buildos", ["help"]);
      assert.equal(result.status, 3, shape(explain));
      assertOutputMatches(result.stderr, /Run "buildos init" in the project folder/, shape(explain));
      assertSame(existsSync(s.record), false, shape(explain));
    });
  }

  // W1 R7 P6 review round 3, P6-R3-15: the pin is read before npx matters.
  it("with Node but no npx, a dev pin still stops with its own message (exit 3)", () => {
    const s = setup(DEV_MANIFEST);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"]);
    assert.equal(result.status, 3, shape(explain));
    assertOutputMatches(result.stderr, /development build of BuildOS/, shape(explain));
  });

  it("with Node and a valid pin but no npx, says that npx is missing (exit 127)", () => {
    const s = setup();
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"]);
    assert.equal(result.status, 127, shape(explain));
    assertSame(result.stderr.trim(), NPX_MESSAGE, shape(explain));
  });

  // W1 R7 P6 review round 3, P6-R3-11: no path goes back to Command Prompt as text, so any code page works.
  it("runs an npm install and npx from folders whose names are not ASCII, with the exact arguments", (t) => {
    let s: ReturnType<typeof setup>;
    const prefix = () => join(s.base, "outils \u00dcn\u00ef \u65e5\u672c");
    try {
      s = setup(MANIFEST, "projet Jos\u00e9 \u65e5\u672c");
      mkdirSync(prefix());
    } catch (error) {
      return t.skip(`this file system refuses the folder name: ${String(error)}`);
    }
    const bin = npmGlobal(prefix(), s.record);
    nodeStub(s.stubs);
    const found = runWrapper(s, "buildos", ["version", ...HARD_ARGS], [bin]);
    assert.equal(found.result.status, 0, shape(found.explain));
    assertSame(recorded(s.record, found.explain), ["buildos", "version", ...HARD_ARGS], shape(found.explain));
    // No install: npx from a folder with such a name, with the pinned version.
    const npxDir = join(s.base, "npx \u00dcn\u00ef \u65e5\u672c");
    mkdirSync(npxDir);
    recorder(npxDir, "npx", `${s.record}.npx`, 0);
    const viaNpx = runWrapper(s, "buildos", HARD_ARGS, [npxDir]);
    assert.equal(viaNpx.result.status, 0, shape(viaNpx.explain));
    assertSame(npxRecorded(`${s.record}.npx`, viaNpx.explain, s.project), npxArgs(...HARD_ARGS), shape(viaNpx.explain));
  });

  // W1 R7 P6 review round 3, P6-R3-08: BuildOS ends the wrapper guard when it starts.
  for (const shell of windows ? ["cmd"] : ["sh", ...(onPath("dash") === undefined ? [] : [onPath("dash")!])]) {
    it(`a program that BuildOS starts can call the project wrapper again (${shell}): no false loop`, () => {
      // A dev pin, and the real CLI from source as an npm install of a source build (0.0.0-dev).
      const s = setup(DEV_MANIFEST);
      const target = join(s.base, "target");
      mkdirSync(target);
      const main = join(packageRoot, "src", "cli", "main.ts");
      const real = npmGlobal(join(s.base, "real"), s.record, { version: "0.0.0-dev", bin: "entry.mjs", source: `await import(${JSON.stringify(pathToFileURL(main).href)});\n` });
      // Pin-first final check, finding 9: the nested call goes to another project with another pin (1.2.4) and its
      // own local install, so its reported version shows that the nested wrapper read its own pin.
      const other = join(s.base, "other project");
      mkdirSync(join(other, ".os"), { recursive: true });
      cpSync(scriptsSource, join(other, ".os", "scripts"), { recursive: true });
      writeFileSync(join(other, ".os", "manifest.json"), MANIFEST.replace('"1.2.3"', '"1.2.4"'));
      npmLocal(other, `${s.record}.other`, { version: "1.2.4", bin: "entry.mjs", source: realCliSource("1.2.4") });
      // A companion program that BuildOS starts (here Make Docs), which calls the other project's wrapper.
      const companion = join(s.base, "companion");
      mkdirSync(companion);
      const script = join(companion, "make-docs.cjs");
      const nested = windows
        ? `spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", '"' + '"' + wrapper + '.cmd" version --json"'], { encoding: "utf8", windowsVerbatimArguments: true })`
        : `spawnSync(${JSON.stringify(shell === "sh" ? "/bin/sh" : shell)}, [wrapper, "version", "--json"], { encoding: "utf8" })`;
      writeFileSync(
        script,
        `const { spawnSync } = require("child_process");\nconst wrapper = ${JSON.stringify(join(other, ".os", "scripts", "buildos"))};\nconst r = ${nested};\nrequire("fs").writeFileSync(${JSON.stringify(`${s.record}.inner`)}, JSON.stringify({ code: r.status, stdout: r.stdout, stderr: r.stderr }));\nprocess.stdout.write(JSON.stringify({ status: "complete" }));\n`,
      );
      if (windows) writeFileSync(join(companion, "make-docs.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
      else {
        writeFileSync(join(companion, "make-docs"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
        chmodSync(join(companion, "make-docs"), 0o755);
      }
      nodeStub(s.stubs);
      const args = ["init", "--root", target, "--make-docs", "--json"];
      let ran: Ran;
      if (shell === "cmd" || shell === "sh") ran = runWrapper(s, "buildos", args, [real, companion]);
      else {
        const tools = join(s.base, "tools");
        mkdirSync(tools, { recursive: true });
        if (!existsSync(join(tools, "sh"))) symlinkSync("/bin/sh", join(tools, "sh"));
        const path = [real, companion, s.stubs, tools].join(delimiter);
        const result = spawnSync(shell, [join(s.scripts, "buildos"), ...args], { cwd: s.project, env: { PATH: path, HOME: scratch }, encoding: "utf8", timeout: 60_000 });
        ran = { result, explain: `exit code: ${String(result.status)}\nPATH: ${path}\nstdout: ${JSON.stringify(result.stdout)}\nstderr: ${JSON.stringify(result.stderr)}` };
      }
      assert.equal(ran.result.status, 0, shape(ran.explain));
      assert.equal(JSON.parse(ran.result.stdout).result.make_docs.status, "set_up", shape(ran.explain));
      const inner = JSON.parse(readFileSync(`${s.record}.inner`, "utf8")) as { code: number; stdout: string; stderr: string };
      assert.equal(inner.code, 0, shape(`the nested wrapper call: ${JSON.stringify(inner)}\n${ran.explain}`));
      assertSame(JSON.parse(inner.stdout).command, "version", shape(JSON.stringify(inner)));
      assertSame(JSON.parse(inner.stdout).version, "1.2.4", shape(`the nested wrapper runs its own pin\n${JSON.stringify(inner)}`));
    });
  }

  // W1 R7 P8 pin-first review round 2 (the program that runs checks itself): the real CLI from source, with the
  // build identity `version` (a release build sets it through esbuild; here a global before the import).
  function realCliSource(version: string | undefined): string {
    const main = pathToFileURL(join(packageRoot, "src", "cli", "main.ts")).href;
    return `${version === undefined ? "" : `globalThis.__BUILDOS_VERSION__ = ${JSON.stringify(version)};\n`}await import(${JSON.stringify(main)});\n`;
  }

  /**
   * An `npx` in `dir` that does what npx does once it has chosen a package:
   * it records its arguments and environment to `record`, then starts the
   * bin file `entry` (after `--require preload`, when given) with the
   * arguments after `-y --prefix <folder> --workspaces=false <spec>`, and
   * exits with its exit code.
   */
  function npxStarting(dir: string, entry: string, record: string, preload?: string): void {
    mkdirSync(dir, { recursive: true });
    const script = join(dir, "npx-sim.cjs");
    writeFileSync(
      script,
      [
        'const { spawnSync } = require("child_process");',
        'const fs = require("fs");',
        "const args = process.argv.slice(2);",
        "const env = {};",
        'for (const key of Object.keys(process.env)) if (/^(BUILDOS_|npm_config_bin)/i.test(key)) env[key] = process.env[key];',
        `fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({ args, env }));`,
        `const r = spawnSync(process.execPath, [${preload === undefined ? "" : `"--require", ${JSON.stringify(preload)}, `}${JSON.stringify(entry)}, ...args.slice(5)], { stdio: "inherit" });`,
        "process.exit(r.status === null ? 1 : r.status);",
        "",
      ].join("\n"),
    );
    if (windows) writeFileSync(join(dir, "npx.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
    else {
      writeFileSync(join(dir, "npx"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
      chmodSync(join(dir, "npx"), 0o755);
    }
  }

  const refusalText = (required: string, started: string) =>
    `BuildOS stopped: this project needs BuildOS ${required}, but BuildOS ${started} started. Nothing ran.\nFix the BuildOS install so that version ${required} runs, then run the project wrapper (.os/scripts/buildos) again. Or set buildos_version in .os/manifest.json to the version that you want to use.\n`;

  // Finding 5: npm upgrades the package between the wrapper's read of package.json and the start. Here package.json
  // still says the pin, and the code that starts is another version: it refuses itself.
  for (const wrapper of WRAPPERS) {
    it(`finding 5 (${wrapper.name}): an install whose package.json says the pin but whose program is another version refuses itself (exit 3, nothing on stdout, no program notice)`, () => {
      const s = setup();
      const bin = npmGlobal(join(s.base, "global"), s.record, { bin: "entry.mjs", source: realCliSource("1.2.4") });
      recorder(s.stubs, "npx", `${s.record}.npx`, 0);
      nodeStub(s.stubs);
      const { result, explain } = runWrapper(s, wrapper.name, ["version"], [bin]);
      assert.equal(result.status, 3, shape(explain));
      assertSame(result.stdout, "", shape(explain));
      // A legacy-name project script writes its own notice first (Q-016); the program itself writes only the refusal.
      assertSame(afterNotice(wrapper.name, result.stderr, explain), refusalText("1.2.3", "1.2.4"), shape(explain));
      assertSame(existsSync(`${s.record}.npx`), false, shape(`no fallback after a refusal\n${explain}`));
      const json = runWrapper(s, wrapper.name, ["version", "--json"], [bin]);
      assert.equal(json.result.status, 3, shape(json.explain));
      const envelope = JSON.parse(json.result.stdout) as { ok: boolean; command: string; version: string; write_status: string; diagnostics: { code: string; message: string; correction: string }[] };
      assertSame(envelope.ok, false, shape(json.explain));
      assertSame(envelope.command, wrapper.domain[0] ?? "version", shape(json.explain));
      assertSame(envelope.version, "1.2.4", shape(json.explain));
      assertSame(envelope.write_status, "not_requested", shape(json.explain));
      assertSame(envelope.diagnostics.map((d) => d.code), ["version_mismatch"], shape(json.explain));
      assertSame(`${envelope.diagnostics[0]!.message}\n${envelope.diagnostics[0]!.correction}\n`, refusalText("1.2.3", "1.2.4"), shape(json.explain));
      assertSame(afterNotice(wrapper.name, json.result.stderr, json.explain), "", shape(json.explain));
    });
  }

  it("finding 5: the same install runs when its program is the pinned version", () => {
    const s = setup();
    const bin = npmGlobal(join(s.base, "global"), s.record, { bin: "entry.mjs", source: realCliSource("1.2.3") });
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version", "--json"], [bin]);
    assert.equal(result.status, 0, shape(explain));
    assertSame((JSON.parse(result.stdout) as { version: string }).version, "1.2.3", shape(explain));
  });

  // Finding 2, simulated (package.test.ts has it with real npm): npx starts another version than the pin.
  it("finding 2: when npx starts another version than the pin, that program refuses itself (exit 3, nothing on stdout)", () => {
    const s = setup();
    const entry = join(s.base, "other", "entry.mjs");
    mkdirSync(join(s.base, "other"));
    writeFileSync(entry, realCliSource("1.2.3-local.1"));
    npxStarting(join(s.base, "npx"), entry, `${s.record}.npx`);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], [join(s.base, "npx")]);
    assert.equal(result.status, 3, shape(explain));
    assertSame(result.stdout, "", shape(explain));
    assertSame(result.stderr.replace(/\r\n/g, "\n"), refusalText("1.2.3", "1.2.3-local.1"), shape(explain));
  });

  // Pin-first final check, finding 3: the project holds an older node (node_modules/.bin/node), so npx starts the
  // pinned BuildOS with Node 20 (here a preload that reports 20.18.0). BuildOS checks its own Node.js version first.
  it("finding 3 (final check): when npx starts BuildOS with Node.js older than 24, it stops (exit 3, nothing on stdout)", () => {
    const s = setup();
    const entry = join(s.base, "pinned", "entry.mjs");
    mkdirSync(join(s.base, "pinned"));
    writeFileSync(entry, realCliSource("1.2.3"));
    const preload = join(s.base, "fake-node-20.cjs");
    writeFileSync(preload, 'Object.defineProperty(process.versions, "node", { value: "20.18.0" });\n');
    npxStarting(join(s.base, "npx"), entry, `${s.record}.npx`, preload);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["version"], [join(s.base, "npx")]);
    assert.equal(result.status, 3, shape(explain));
    assertSame(result.stdout, "", shape(explain));
    assertOutputMatches(result.stderr, /^BuildOS stopped: BuildOS needs Node\.js 24 or newer, but Node\.js 20\.18\.0 started it\. Nothing ran\.\r?\n/, shape(explain));
    const json = runWrapper(s, "buildos", ["version", "--json"], [join(s.base, "npx")]);
    assert.equal(json.result.status, 3, shape(json.explain));
    assertSame((JSON.parse(json.result.stdout) as { diagnostics: { code: string }[] }).diagnostics[0]?.code, "node_version", shape(json.explain));
    assertSame(json.result.stderr, "", shape(json.explain));
  });

  // Finding 12: the wrapper turns npm bin links on for npx; BuildOS puts the caller's own settings back, and removes
  // BUILDOS_REQUIRE_VERSION, before it starts any other program (here the Make Docs companion of buildos init).
  // Pin-first final check, finding 5: the caller's bin-links setting in another case (npm reads the name in any case).
  const callers: [string, string | undefined][] = [["npm_config_bin_links", undefined], ["npm_config_bin_links", "false"], ["npm_config_Bin_Links", "false"]];
  for (const [linksName, callerLinks] of callers) {
    it(`finding 12: a program that BuildOS starts after npx gets the caller's npm bin-links setting (${callerLinks === undefined ? "unset" : `${linksName}=${callerLinks}`}) and no self-check variable`, () => {
      const s = setup();
      const target = join(s.base, "target");
      mkdirSync(target);
      const entry = join(s.base, "pinned", "entry.mjs");
      mkdirSync(join(s.base, "pinned"));
      writeFileSync(entry, realCliSource("1.2.3"));
      npxStarting(join(s.base, "npx"), entry, `${s.record}.npx`);
      const companion = join(s.base, "companion");
      mkdirSync(companion);
      const script = join(companion, "make-docs.cjs");
      writeFileSync(
        script,
        `const env = {};\nfor (const key of Object.keys(process.env)) if (/^(BUILDOS_|npm_config_bin)/i.test(key)) env[key] = process.env[key];\nrequire("fs").writeFileSync(${JSON.stringify(`${s.record}.companion`)}, JSON.stringify(env));\nprocess.stdout.write(JSON.stringify({ status: "complete" }));\n`,
      );
      if (windows) writeFileSync(join(companion, "make-docs.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
      else {
        writeFileSync(join(companion, "make-docs"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
        chmodSync(join(companion, "make-docs"), 0o755);
      }
      nodeStub(s.stubs);
      const { result, explain } = runWrapper(s, "buildos", ["init", "--root", target, "--make-docs", "--json"], [join(s.base, "npx"), companion], { env: callerLinks === undefined ? {} : { [linksName]: callerLinks } });
      assert.equal(result.status, 0, shape(explain));
      const seenByNpx = JSON.parse(readFileSync(`${s.record}.npx`, "utf8")) as { env: Record<string, string> };
      assertSame(seenByNpx.env["npm_config_bin_links"], "true", shape(explain));
      assertSame(Object.keys(seenByNpx.env).filter((key) => /^npm_config_bin[-_]links$/i.test(key)).join(","), "npm_config_bin_links", shape(`npx gets only the wrapper's bin-links setting\n${explain}`));
      assertSame(seenByNpx.env["BUILDOS_REQUIRE_VERSION"], "1.2.3", shape(explain));
      const seen = JSON.parse(readFileSync(`${s.record}.companion`, "utf8")) as Record<string, string>;
      const expected: Record<string, string> = callerLinks === undefined ? {} : { [linksName]: callerLinks };
      assertSame(JSON.stringify(seen), JSON.stringify(expected), shape(`the companion's BUILDOS_ and npm bin-links variables\n${explain}`));
    });
  }

  it("finding 12: a program that BuildOS starts from a local install gets no BUILDOS_REQUIRE_VERSION", () => {
    const s = setup();
    const target = join(s.base, "target");
    mkdirSync(target);
    // Pin-first final check, finding 9: a local install, as the test name says.
    npmLocal(s.project, s.record, { bin: "entry.mjs", source: realCliSource("1.2.3") });
    const companion = join(s.base, "companion");
    mkdirSync(companion);
    const script = join(companion, "make-docs.cjs");
    writeFileSync(script, `require("fs").writeFileSync(${JSON.stringify(`${s.record}.companion`)}, JSON.stringify(process.env.BUILDOS_REQUIRE_VERSION ?? null));\nprocess.stdout.write(JSON.stringify({ status: "complete" }));\n`);
    if (windows) writeFileSync(join(companion, "make-docs.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
    else {
      writeFileSync(join(companion, "make-docs"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
      chmodSync(join(companion, "make-docs"), 0o755);
    }
    nodeStub(s.stubs);
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    const { result, explain } = runWrapper(s, "buildos", ["init", "--root", target, "--make-docs", "--json"], [companion]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(existsSync(`${s.record}.npx`), false, shape(`the local install runs, not npx\n${explain}`));
    assertSame(JSON.parse(readFileSync(`${s.record}.companion`, "utf8")), null, shape(explain));
  });

  // Finding 9: the wrapper reads PATH candidates only after the local lookup misses, and only a few bytes of each.
  // A 1 GiB sparse file first on PATH: the earlier sh line reads took that whole file.
  it("finding 9: with a local install, never reads a PATH candidate; without one, reads only a bounded head of it", (t) => {
    if (windows) return t.skip("the .cmd wrapper's PATH search was in Node.js already");
    const s = setup();
    const huge = join(s.base, "huge");
    mkdirSync(huge);
    writeFileSync(join(huge, "buildos"), "");
    truncateSync(join(huge, "buildos"), 1024 * 1024 * 1024);
    chmodSync(join(huge, "buildos"), 0o755);
    npmLocal(s.project, s.record);
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const local = runWrapper(s, "buildos", ["help"], [huge]);
    assert.equal(local.result.status, 0, shape(local.explain));
    assertSame(recorded(s.record, local.explain), ["buildos", "help"], shape(local.explain));
    rmSync(join(s.project, "node_modules"), { recursive: true });
    const started = Date.now();
    const viaNpx = runWrapper(s, "buildos", ["help"], [huge]);
    assert.equal(viaNpx.result.status, 0, shape(viaNpx.explain));
    assertSame(npxRecorded(`${s.record}.npx`, viaNpx.explain, s.project), npxArgs("help"), shape(viaNpx.explain));
    assert.ok(Date.now() - started < 20_000, shape(`the PATH candidate must not be read whole\n${viaNpx.explain}`));
  });

  // Finding 10: a regular file named node_modules is not npm's local project folder: npm goes on to the parent.
  it("finding 10: a file named node_modules in the current folder does not stop the local lookup; the parent's install runs", () => {
    const s = setup();
    const outer = join(s.base, "outer");
    npmLocal(outer, s.record);
    const work = join(outer, "work");
    mkdirSync(work);
    writeFileSync(join(work, "node_modules"), "not a folder\n");
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"], [], { cwd: work });
    assert.equal(result.status, 0, shape(explain));
    assertSame(recorded(s.record, explain), ["buildos", "help"], shape(explain));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
  });

  // Finding 11: Command Prompt takes at most 8,191 characters on one line. The npx fallback goes through cmd.exe.
  it("finding 11: an npx command line too long for Command Prompt stops with a plain message (exit 2) and starts nothing", (t) => {
    if (!windows) return t.skip("Command Prompt only");
    const s = setup();
    recorder(s.stubs, "npx", `${s.record}.npx`, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help", "&".repeat(2500)]);
    assert.equal(result.status, 2, shape(explain));
    assertOutputMatches(result.stderr, /8,191 characters/, shape(explain));
    assertSame(existsSync(`${s.record}.npx`), false, shape(explain));
    // A local install starts with Node.js directly, so the same argument works there.
    npmLocal(s.project, s.record);
    const local = runWrapper(s, "buildos", ["help", "&".repeat(2500)]);
    assert.equal(local.result.status, 0, shape(local.explain));
    assertSame(recorded(s.record, local.explain), ["buildos", "help", "&".repeat(2500)], shape(local.explain));
  });

  it("names Node.js 24 or newer and where to get it in the message", () => {
    assert.match(MESSAGE, /Node\.js 24 or newer/);
    assert.match(MESSAGE, /https:\/\/nodejs\.org/);
    assert.equal(MESSAGE.split("\n").length, 1);
  });

  it("stops with a plain message, and runs no npx, when .os/manifest.json is missing or breaks the manifest contract", () => {
    for (const manifest of [null, "{", '{"buildos_version":"1.2.3 && echo hi"}', '{"schema_version":1,"buildos_version":"latest","initialized_at":"2026-11-24T00:00:00Z"}', DEV_MANIFEST]) {
      const s = setup(manifest);
      recorder(s.stubs, "npx", s.record, 0);
      nodeStub(s.stubs);
      const { result, explain } = runWrapper(s, "buildos", ["help"]);
      assert.equal(result.status, 3, shape(explain));
      assertSame(result.stdout, "", shape(explain));
      assertOutputMatches(result.stderr, manifest === DEV_MANIFEST ? /development build of BuildOS/ : /Run "buildos init" in the project folder/, shape(explain));
      assertOutputDoesNotMatch(result.stderr, /\n\s+at\s/, shape(explain));
      assertSame(existsSync(s.record), false, shape(explain));
    }
  });

  // P6-R2-09: the manifest contract allows one UTF-8 byte order mark, in init and in the wrappers alike.
  it("runs npx with the version from a manifest that starts with a UTF-8 byte order mark", () => {
    const s = setup(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(MANIFEST)]));
    recorder(s.stubs, "npx", s.record, 0);
    nodeStub(s.stubs);
    const { result, explain } = runWrapper(s, "buildos", ["help"]);
    assert.equal(result.status, 0, shape(explain));
    assertSame(npxRecorded(s.record, explain, s.project), npxArgs("help"), shape(explain));
  });
});

// The helper's rules, on every system (the Windows-only parts too).
describe("the wrapper helper's installed-package and PATH rules", () => {
  // W1 R7 P8 pin-first review round 1, finding 5.
  it("splits a Windows PATH on ; outside double quotes only, and removes the quotes", () => {
    assert.deepEqual(helper.splitWindowsPath('C:\\a;"C:\\Build;Tools";;C:\\b'), ["C:\\a", "C:\\Build;Tools", "C:\\b"]);
    assert.deepEqual(helper.splitWindowsPath('"C:\\x";C:\\y"z"'), ["C:\\x", "C:\\yz"]);
    assert.deepEqual(helper.splitWindowsPath(""), []);
  });

  it("accepts only build-os at exactly the version, with an object bin that names buildos", () => {
    const dir = join(scratch, `pkg-${++counter}`);
    writePackage(dir, join(dir, "r.json"));
    assert.equal(helper.packageEntry(dir, "1.2.3"), realpathSync(join(dir, "dist", "buildos.js")));
    assert.equal(helper.packageEntry(dir, "1.2.4"), undefined);
    assert.equal(helper.packageEntry(dir, "1.2"), undefined);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: "dist/buildos.js" }));
    assert.equal(helper.packageEntry(dir, "1.2.3"), undefined, "a string bin declares only the build-os command");
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: PACKAGE, version: "1.2.3", bin: { buildos: join(dir, "dist", "buildos.js") } }));
    assert.equal(helper.packageEntry(dir, "1.2.3"), undefined, "an absolute bin path");
    writeFileSync(join(dir, "package.json"), "[]");
    assert.equal(helper.packageEntry(dir, "1.2.3"), undefined);
  });

  // Owner decision of 2026-11-26: the package name is build-os. A package with
  // the earlier scoped name, or any other name, never counts, in any layout.
  it("refuses a package with the earlier scoped name @brucewaynedecoy/buildos, or another name, also in its old folder", () => {
    const dir = join(scratch, `pkg-${++counter}`);
    writePackage(dir, join(dir, "r.json"), { packageJson: JSON.stringify({ name: "@brucewaynedecoy/buildos", version: "1.2.3", bin: { buildos: "dist/buildos.js" } }) });
    assert.equal(helper.packageEntry(dir, "1.2.3"), undefined, "the earlier scoped name");
    assert.equal(helper.packageEntry(dir, null), undefined, "the earlier scoped name, dev pin");
    for (const name of ["buildos", "Build-OS", "build-os-cli", "@build-os/build-os"]) {
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.2.3", bin: { buildos: "dist/buildos.js" } }));
      assert.equal(helper.packageEntry(dir, "1.2.3"), undefined, name);
    }
    const project = join(scratch, `old-layout-${++counter}`);
    writePackage(join(project, "node_modules", "@brucewaynedecoy", "buildos"), join(project, "r.json"));
    assert.equal(helper.localEntry(project, "1.2.3"), undefined, "a package in node_modules/@brucewaynedecoy/buildos is not looked at");
    writePackage(join(project, "node_modules", "build-os"), join(project, "r.json"));
    assert.equal(helper.localEntry(project, "1.2.3"), realpathSync(join(project, "node_modules", "build-os", "dist", "buildos.js")));
  });

  it("on Windows, takes a .cmd shim as an npm install only with the package next to it, or in the node_modules folder of a .bin folder", () => {
    const root = join(scratch, `shims-${++counter}`);
    writePackage(join(root, "global", "node_modules", "build-os"), join(root, "r.json"));
    writePackage(join(root, "local", "node_modules", "build-os"), join(root, "r.json"));
    assert.equal(helper.windowsCandidateEntry(join(root, "global", "buildos.cmd"), "1.2.3"), realpathSync(join(root, "global", "node_modules", "build-os", "dist", "buildos.js")));
    assert.equal(helper.windowsCandidateEntry(join(root, "local", "node_modules", ".bin", "buildos.cmd"), "1.2.3"), realpathSync(join(root, "local", "node_modules", "build-os", "dist", "buildos.js")));
    assert.equal(helper.windowsCandidateEntry(join(root, "global", "buildos.exe"), "1.2.3"), undefined, "not a .cmd shim");
    assert.equal(helper.windowsCandidateEntry(join(root, "global", "buildos.cmd"), "9.9.9"), undefined, "another version");
    assert.equal(helper.windowsCandidateEntry(join(root, "other", "buildos.cmd"), "1.2.3"), undefined, "no package next to it");
  });

  it("finds npm's local project folder as npm does: the first folder up with package.json or node_modules", () => {
    const root = join(scratch, `prefix-${++counter}`);
    mkdirSync(join(root, "a", "node_modules"), { recursive: true });
    mkdirSync(join(root, "a", "b", "c"), { recursive: true });
    assert.equal(helper.npmLocalPrefix(join(root, "a", "b", "c")), join(root, "a"));
    writeFileSync(join(root, "a", "b", "package.json"), "{}");
    assert.equal(helper.npmLocalPrefix(join(root, "a", "b", "c")), join(root, "a", "b"));
  });

  // W1 R7 P8 pin-first review round 2.
  it("finding 7: refuses a bin file inside a node_modules folder below the package, in any case", () => {
    const dir = join(scratch, `pkg-${++counter}`);
    writePackage(dir, join(dir, "r.json"), { bin: "node_modules/dep/buildos.js" });
    assert.equal(helper.packageEntry(dir, "1.2.3"), undefined);
    writePackage(dir, join(dir, "r.json"), { bin: "Node_Modules/dep/buildos.js" });
    assert.equal(helper.packageEntry(dir, "1.2.3"), undefined);
    writePackage(dir, join(dir, "r.json"), { bin: "dist/node_modules.js" });
    assert.equal(helper.packageEntry(dir, "1.2.3"), realpathSync(join(dir, "dist", "node_modules.js")), "a file name, not a folder");
  });

  it("finding 3: a dev pin (null) takes a package of any version with the right name", () => {
    const dir = join(scratch, `pkg-${++counter}`);
    writePackage(dir, join(dir, "r.json"), { version: "0.1.0" });
    assert.equal(helper.packageEntry(dir, null), realpathSync(join(dir, "dist", "buildos.js")));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "other", version: "0.1.0", bin: "dist/buildos.js" }));
    assert.equal(helper.packageEntry(dir, null), undefined);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: PACKAGE, bin: "dist/buildos.js" }));
    assert.equal(helper.packageEntry(dir, null), undefined, "no version at all");
  });

  it("finding 10: a file named node_modules is not npm's local project folder", () => {
    const root = join(scratch, `prefix-${++counter}`);
    mkdirSync(join(root, "a", "b"), { recursive: true });
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "a", "b", "node_modules"), "");
    assert.equal(helper.npmLocalPrefix(join(root, "a", "b")), root);
    mkdirSync(join(root, "a", "package.json"));
    assert.equal(helper.npmLocalPrefix(join(root, "a", "b")), root, "a folder named package.json does not count either");
  });

  it("finding 9: reads at most 1024 bytes of a PATH candidate to tell a wrapper", () => {
    const file = join(scratch, `head-${++counter}`);
    writeFileSync(file, `#!/bin/sh\n${"x".repeat(4 * 1024 * 1024)}\n# BuildOS project wrapper\n`);
    const fsModule = createRequire(import.meta.url)("fs") as typeof import("node:fs");
    const original = fsModule.readSync;
    let read = 0;
    fsModule.readSync = ((...args: Parameters<typeof original>) => {
      const n = original(...args);
      read += n;
      return n;
    }) as typeof original;
    try {
      assert.equal(helper.isShWrapper(file), false);
    } finally {
      fsModule.readSync = original;
    }
    assert.ok(read <= 1024, `read ${read} bytes`);
    writeFileSync(file, "#!/usr/bin/env sh\n# BuildOS project wrapper. Pin first\n");
    assert.equal(helper.isShWrapper(file), true);
  });

  it("finding 11: knows when Command Prompt cannot take the npx line (8,191 characters)", () => {
    const npx = "C:\\Program Files\\nodejs\\npx.cmd";
    assert.equal(helper.CMD_LINE_LIMIT, 8191);
    assert.equal(helper.cmdLineTooLong(npx, ["-y", `${PACKAGE}@1.2.3`, "help", ...HARD_ARGS]), false);
    assert.equal(helper.cmdLineTooLong(npx, ["-y", `${PACKAGE}@1.2.3`, "x".repeat(7000)]), false);
    assert.equal(helper.cmdLineTooLong(npx, ["-y", `${PACKAGE}@1.2.3`, "x".repeat(7600)]), true, "npm's npx.cmd line");
    assert.equal(helper.cmdLineTooLong(npx, ["-y", `${PACKAGE}@1.2.3`, "&".repeat(2500)]), true, "each & is escaped twice");
  });

  it("finding 12: npx gets bin links on, the pin, and the caller's own bin-links settings to put back", () => {
    const saved = { ...process.env };
    try {
      process.env["npm_config_bin_links"] = "false";
      process.env["BUILDOS_SAVED_npm_config_bin_links"] = "stale";
      process.env["BUILDOS_REQUIRE_VERSION"] = "9.9.9";
      const env = helper.npxEnvironment("1.2.3");
      assert.equal(env["npm_config_bin_links"], "true");
      assert.equal(env["BUILDOS_NPM_BIN_LINKS_OVERRIDE"], "1");
      assert.equal(env["BUILDOS_SAVED_npm_config_bin_links"], "false");
      assert.equal(env["BUILDOS_REQUIRE_VERSION"], "1.2.3");
      const plain = helper.programEnvironment("1.2.3");
      assert.equal(plain["npm_config_bin_links"], "false");
      assert.equal(plain["BUILDOS_SAVED_npm_config_bin_links"], undefined);
      assert.equal(plain["BUILDOS_NPM_BIN_LINKS_OVERRIDE"], undefined);
      assert.equal(plain["BUILDOS_REQUIRE_VERSION"], "1.2.3");
      // Pin-first final check, finding 5: every case and spelling is saved, and npx gets only the wrapper's value.
      delete process.env["npm_config_bin_links"];
      process.env["npm_config_Bin_Links"] = "false";
      process.env["npm_config_bin-links"] = "0";
      const any = helper.npxEnvironment("1.2.3");
      assert.deepEqual(Object.keys(any).filter((key) => /^npm_config_bin[-_]links$/i.test(key)), ["npm_config_bin_links"]);
      assert.equal(any["BUILDOS_SAVED_npm_config_Bin_Links"], "false");
      assert.equal(any["BUILDOS_SAVED_npm_config_bin-links"], "0");
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });

  it("has no version check that starts a program (W1 R7 P8 pin-first review round 1)", () => {
    const source = readFileSync(join(scriptsSource, "pinned-version.cjs"), "utf8");
    assertOutputDoesNotMatch(source, /version --json|"version", "--json"|VERSION_CHECK/, "pinned-version.cjs");
    assertOutputDoesNotMatch(readFileSync(join(scriptsSource, "buildos"), "utf8"), /exec "\$candidate"/, "buildos");
  });
});

/**
 * The Go-era `buildos` wrapper, exactly as commit 7cfc0b7 shipped it. That
 * commit is in the earlier history, which exists only in the private archive
 * repository `brucewaynedecoy/build-os-archive`, so the text is kept here and
 * never read from git. Its SHA-256 is GO_ERA_WRAPPER_SHA256.
 */
const GO_ERA_WRAPPER_SHA256 = "ba55476467d14d9de6ed1ba682206604eb645d6b472d1d1821b6aad0f4f158c8";
function goEraWrapper(): string {
  const text = [
    "#!/usr/bin/env sh",
    "set -eu",
    "",
    'if [ "${BUILDOS_BIN:-}" ]; then',
    '  exec "$BUILDOS_BIN" "$@"',
    "fi",
    "",
    "if command -v buildos >/dev/null 2>&1; then",
    '  exec buildos "$@"',
    "fi",
    "",
    'script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
    'dev_root=$(CDPATH= cd -- "$script_dir/../../.." && pwd)',
    'local_bin="$dev_root/toolkits/buildos/bin/buildos"',
    "",
    'if [ -x "$local_bin" ]; then',
    '  exec "$local_bin" "$@"',
    "fi",
    "",
    "printf '%s\\n' \"buildos binary not found. Set BUILDOS_BIN or build the staged source binary with 'just build-buildos'.\" >&2",
    "exit 127",
    "",
  ].join("\n");
  assert.equal(createHash("sha256").update(text).digest("hex"), GO_ERA_WRAPPER_SHA256, "the Go-era wrapper text changed");
  return text;
}

// P6-R2-14: `cmd.exe` reads redirection and command characters even in a comment line.
describe("the .cmd wrappers have no <, >, |, or & in a comment line", () => {
  for (const name of readdirSync(scriptsSource).filter((n) => n.endsWith(".cmd"))) {
    it(name, () => {
      const lines = readFileSync(join(scriptsSource, name), "utf8").split(/\r\n/);
      for (const [index, line] of lines.entries()) {
        if (/^\s*@?(?:rem(?:\s|$)|::)/i.test(line)) assertOutputDoesNotMatch(line, /[<>|&]/, `${tag(String(name))} line ${index + 1}: ${tag(String(line))}`);
      }
      // Every line ends with CRLF, so cmd.exe reads labels and the last line as written.
      assertSame(readFileSync(join(scriptsSource, name), "utf8").replace(/\r\n/g, "").includes("\n"), false, tag(String(name)));
    });
  }
});
