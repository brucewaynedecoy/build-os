// F-P9-17 (W1 R7 P9): the project wrappers in system/.os/scripts/ must give
// the caller the exit code of the BuildOS program they start, on every route
// and in every way that a person or an agent starts them. The rollback smoke
// (runs 46056570552 and 46060191323) saw `.os\scripts\buildos.cmd` exit 0 on
// Windows where the pinned BuildOS exited 2.
//
// Unlike test/wrappers.test.ts, these cases use the REAL node (no `node.cmd`
// stub: a `.cmd` stub started without `call` ends the wrapper in its place,
// so the wrapper's own exit path never runs). The BuildOS program is a fake:
// a bin file that writes one line to stdout and one to stderr and exits with
// the code in FAKE_BUILDOS_EXIT. It is reached through the routes that work
// offline:
//
// - local install: `node_modules/build-os` in the project folder;
// - global install: an npm `.cmd` shim on PATH with `node_modules\build-os`
//   next to it (Windows), or a `bin/buildos` link into
//   `lib/node_modules/build-os` (macOS and Linux);
// - npx: on Windows a copy of npm's own `npx.cmd` (from the folder of this
//   test's Node, else the npm 11 text below) whose `npx-cli.js` is the fake;
//   on macOS and Linux an `npx` script that runs the fake with the real node.
//
// Windows starts each `.cmd` wrapper as `cmd.exe /d /s /c "<wrapper> args"`
// (what Node.js, Python, CI runners, and agents do), as
// `cmd.exe /d /s /c "call <wrapper> args"`, and from PowerShell as
// `& <wrapper> args` with `$LASTEXITCODE` (when `pwsh` is on PATH). One more
// case runs, under ONE cmd.exe, the helper the way buildos.cmd starts it
// (`node.exe pinned-version.cjs --cmd ...`) and then the wrapper, and reads
// %ERRORLEVEL% right after each. macOS and Linux start the `sh` wrappers
// directly and through `sh -c`.
//
// The "cmd.exe exit code" probes (Windows) are small batch files with one
// shape each (a program, then `exit /b`; a program at the end of the file;
// `exit /b %ERRORLEVEL%`; and so on). They show the cmd.exe rule that the
// wrapper meets, apart from BuildOS.

import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(packageRoot, "..", "..");
const scriptsSource = resolve(repoRoot, "system", ".os", "scripts");
const windows = process.platform === "win32";
const CODES = [0, 1, 2, 7, 127];
const WRAPPERS = ["buildos", "buildos-intake", "buildos-discovery", "buildos-design"];
const MANIFEST = '{\n  "schema_version": 1,\n  "buildos_version": "1.2.3",\n  "initialized_at": "2026-11-24T00:00:00.000Z"\n}\n';
const FAKE_STDOUT = "fake buildos stdout";
const fakeStderr = (code: number) => `fake buildos stderr: exit ${code}`;
/** The fake BuildOS program (a bin file, or npm's npx-cli.js): one line on each stream, then the code in FAKE_BUILDOS_EXIT. */
const FAKE_SOURCE = [
  'var code = Number(process.env.FAKE_BUILDOS_EXIT);',
  `process.stdout.write(${JSON.stringify(`${FAKE_STDOUT}\n`)});`,
  'process.stderr.write("fake buildos stderr: exit " + code + "\\n");',
  "process.exit(code);",
  "",
].join("\n");
/** npm 11's npx.cmd (npm 11.20.0, bin/npx.cmd), for a Node.js folder that has none. */
const NPM_NPX_CMD = [
  ":: Created by npm, please don't edit manually.",
  "@ECHO OFF",
  "",
  "SETLOCAL",
  "",
  'SET "NODE_EXE=%~dp0\\node.exe"',
  'IF NOT EXIST "%NODE_EXE%" (',
  '  SET "NODE_EXE=node"',
  ")",
  "",
  'SET "NPM_PREFIX_JS=%~dp0\\node_modules\\npm\\bin\\npm-prefix.js"',
  'SET "NPX_CLI_JS=%~dp0\\node_modules\\npm\\bin\\npx-cli.js"',
  "FOR /F \"delims=\" %%F IN ('CALL \"%NODE_EXE%\" \"%NPM_PREFIX_JS%\"') DO (",
  '  SET "NPM_PREFIX_NPX_CLI_JS=%%F\\node_modules\\npm\\bin\\npx-cli.js"',
  ")",
  'IF EXIST "%NPM_PREFIX_NPX_CLI_JS%" (',
  '  SET "NPX_CLI_JS=%NPM_PREFIX_NPX_CLI_JS%"',
  ")",
  "",
  '"%NODE_EXE%" "%NPX_CLI_JS%" %*',
  "",
].join("\r\n");

type Route = "local install" | "global install" | "npx";
const ROUTES: Route[] = ["local install", "global install", "npx"];

let scratch: string;
let counter = 0;
before(() => {
  scratch = mkdtempSync(join(tmpdir(), "buildos-exit-codes-"));
});
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const system32 = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32");
const nodeDir = dirname(process.execPath);

/** The first `name` on this test's own PATH, or undefined. */
function onPath(name: string): string | undefined {
  const dirs = (process.env["PATH"] ?? process.env["Path"] ?? "").split(delimiter).filter((dir) => dir !== "");
  return dirs.map((dir) => join(dir, name)).find((file) => existsSync(file));
}

/** A fake build-os package in `dir`: package.json of the pinned version and the fake bin file. */
function fakePackage(dir: string): string {
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "build-os", version: "1.2.3", bin: { buildos: "dist/buildos.js" } }, null, 2)}\n`);
  const entry = join(dir, "dist", "buildos.js");
  writeFileSync(entry, FAKE_SOURCE);
  chmodSync(entry, 0o755);
  return entry;
}

interface Fixture {
  project: string;
  scripts: string;
  /** The PATH folders before the system folders. */
  path: string[];
  route: Route;
  /** Which npx.cmd the npx route uses (Windows). */
  npxCmd?: string;
}

/** A project with this tree's wrappers, the manifest, and the fake BuildOS on `route`. */
function fixture(route: Route): Fixture {
  const base = join(scratch, `case-${++counter}`);
  const project = join(base, "project with space");
  const scripts = join(project, ".os", "scripts");
  mkdirSync(scripts, { recursive: true });
  cpSync(scriptsSource, scripts, { recursive: true });
  writeFileSync(join(project, ".os", "manifest.json"), MANIFEST);
  // The real node: on Windows its own folder; on macOS and Linux a folder with links to node and sh only.
  let tools = nodeDir;
  if (!windows) {
    tools = join(base, "tools");
    mkdirSync(tools);
    symlinkSync(process.execPath, join(tools, "node"));
    symlinkSync("/bin/sh", join(tools, "sh"));
  }
  const path = [tools];
  let npxCmd: string | undefined;
  if (route === "local install") fakePackage(join(project, "node_modules", "build-os"));
  if (route === "global install") {
    if (windows) {
      const prefix = join(base, "npm-global");
      fakePackage(join(prefix, "node_modules", "build-os"));
      // The shim never runs (the helper starts the package's bin file itself); it exits 99 if it does.
      writeFileSync(join(prefix, "buildos.cmd"), "@exit /b 99\r\n");
      path.unshift(prefix);
    } else {
      const prefix = join(base, "npm-global");
      const entry = fakePackage(join(prefix, "lib", "node_modules", "build-os"));
      mkdirSync(join(prefix, "bin"));
      symlinkSync(entry, join(prefix, "bin", "buildos"));
      path.unshift(join(prefix, "bin"));
    }
  }
  if (route === "npx") {
    const npm = join(base, "npm");
    mkdirSync(npm);
    if (windows) {
      const real = join(nodeDir, "npx.cmd");
      npxCmd = existsSync(real) ? `npm's npx.cmd of this Node.js (${real})` : "the npm 11.20.0 npx.cmd text in this test";
      writeFileSync(join(npm, "npx.cmd"), existsSync(real) ? readFileSync(real) : NPM_NPX_CMD);
      const bin = join(npm, "node_modules", "npm", "bin");
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(bin, "npx-cli.js"), FAKE_SOURCE);
      // npx.cmd asks npm-prefix.js for npm's global prefix; this one names none, so npx.cmd keeps its own npx-cli.js.
      writeFileSync(join(bin, "npm-prefix.js"), "");
    } else {
      writeFileSync(join(npm, "fake-npx.cjs"), FAKE_SOURCE);
      writeFileSync(join(npm, "npx"), `#!/bin/sh\nexec "${process.execPath}" "${join(npm, "fake-npx.cjs")}" "$@"\n`);
      chmodSync(join(npm, "npx"), 0o755);
    }
    path.unshift(npm);
  }
  return { project, scripts, path, route, ...(npxCmd === undefined ? {} : { npxCmd }) };
}

/** The environment of a run: only what Windows or sh needs, the fixture PATH, and the code for the fake. */
function environment(f: Fixture, code: number, extra: Record<string, string> = {}): Record<string, string> {
  if (windows) {
    return { SystemRoot: process.env["SystemRoot"] ?? "C:\\Windows", ComSpec: join(system32, "cmd.exe"), PATH: [...f.path, system32].join(delimiter), PATHEXT: ".COM;.EXE;.BAT;.CMD", TEMP: scratch, TMP: scratch, FAKE_BUILDOS_EXIT: String(code), ...extra };
  }
  return { PATH: f.path.join(delimiter), HOME: scratch, FAKE_BUILDOS_EXIT: String(code), ...extra };
}

type Form = "cmd /c" | "cmd /c call" | "PowerShell &" | "direct" | "sh -c";
const pwsh = windows ? onPath("pwsh.exe") : undefined;
const FORMS: Form[] = windows ? ["cmd /c", "cmd /c call", ...(pwsh === undefined ? [] : (["PowerShell &"] as Form[]))] : ["direct", "sh -c"];
const ARGS = ["some-command", "--flag"];

interface Ran {
  result: SpawnSyncReturns<string>;
  explain: string;
}

function explainRun(result: SpawnSyncReturns<string>, line: string, f: Fixture, env: Record<string, string>): string {
  return [`exit code: ${String(result.status)}${result.signal === null ? "" : ` (signal ${result.signal})`}`, `error: ${result.error?.message ?? "none"}`, `route: ${f.route}${f.npxCmd === undefined ? "" : ` (${f.npxCmd})`}`, `command: ${line}`, `PATH: ${env["PATH"]}`, `stdout: ${JSON.stringify(result.stdout)}`, `stderr: ${JSON.stringify(result.stderr)}`].join("\n");
}

/** Starts wrapper `name` of fixture `f` in the project folder, in the given `form`. */
function runForm(f: Fixture, name: string, form: Form, code: number, extra: Record<string, string> = {}): Ran {
  const env = environment(f, code, extra);
  let result: SpawnSyncReturns<string>;
  let line: string;
  if (form === "cmd /c" || form === "cmd /c call") {
    line = `${form === "cmd /c call" ? "call " : ""}"${join(f.scripts, `${name}.cmd`)}" ${ARGS.join(" ")}`;
    result = spawnSync(join(system32, "cmd.exe"), ["/d", "/s", "/c", `"${line}"`], { cwd: f.project, env, encoding: "utf8", windowsVerbatimArguments: true, timeout: 60_000 });
    line = `cmd.exe /d /s /c "${line}"`;
  } else if (form === "PowerShell &") {
    // PowerShell needs its own environment (profile folders, module path); only PATH and the fake's code are set here.
    const full: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined && !/^(path|node_options)$/i.test(key)) full[key] = value;
    const psEnv = { ...full, ...env };
    line = `& '${join(f.scripts, `${name}.cmd`).replace(/'/g, "''")}' ${ARGS.join(" ")}; exit $LASTEXITCODE`;
    result = spawnSync(pwsh!, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", line], { cwd: f.project, env: psEnv, encoding: "utf8", timeout: 60_000 });
    line = `pwsh -Command ${line}`;
  } else if (form === "direct") {
    line = [join(f.scripts, name), ...ARGS].map((a) => JSON.stringify(a)).join(" ");
    result = spawnSync(join(f.scripts, name), ARGS, { cwd: f.project, env, encoding: "utf8", timeout: 60_000 });
  } else {
    line = `"${join(f.scripts, name)}" ${ARGS.join(" ")}; exit $?`;
    result = spawnSync("/bin/sh", ["-c", line], { cwd: f.project, env, encoding: "utf8", timeout: 60_000 });
    line = `sh -c '${line}'`;
  }
  return { result, explain: explainRun(result, line, f, env) };
}

/** The wrapper passed the fake's code, and its output reached the caller. */
function assertPassed(ran: Ran, code: number): void {
  assert.equal(ran.result.status, code, `the wrapper must exit with the program's code ${code}\n${ran.explain}`);
  assert.ok(ran.result.stdout.includes(FAKE_STDOUT), `the program's stdout must reach the caller\n${ran.explain}`);
  assert.ok(ran.result.stderr.includes(fakeStderr(code)), `the program's stderr must reach the caller (so the code is the program's, not the wrapper's own)\n${ran.explain}`);
}

describe(`F-P9-17: the project wrappers (${windows ? ".cmd" : "sh"}) exit with the code of the BuildOS program, with the real node`, () => {
  for (const route of ROUTES) {
    describe(`buildos, ${route} route`, () => {
      for (const form of FORMS) {
        it(`${form}: exit codes ${CODES.join(", ")}`, () => {
          const f = fixture(route);
          for (const code of CODES) assertPassed(runForm(f, "buildos", form, code), code);
        });
      }
    });
  }

  for (const name of WRAPPERS.filter((w) => w !== "buildos")) {
    describe(`${name} (legacy name)`, () => {
      for (const form of FORMS) {
        it(`${form}, local install route: exit codes ${CODES.join(", ")}`, () => {
          const f = fixture("local install");
          for (const code of CODES) assertPassed(runForm(f, name, form, code), code);
        });
      }
      it(`${FORMS[0]}, npx route: exit code 2`, () => {
        assertPassed(runForm(fixture("npx"), name, FORMS[0]!, 2), 2);
      });
    });
  }

  it(`a variable named ERRORLEVEL in the caller's environment does not change the exit code (${FORMS[0]})`, () => {
    const f = fixture("local install");
    assertPassed(runForm(f, "buildos", FORMS[0]!, 2, { ERRORLEVEL: "0" }), 2);
  });
});

describe("F-P9-17: under one cmd.exe, %ERRORLEVEL% after the helper started directly and after the wrapper", { skip: !windows && "Windows only" }, () => {
  for (const route of ROUTES) {
    it(`${route} route: exit codes ${CODES.join(", ")}`, () => {
      const f = fixture(route);
      const helper = join(f.scripts, "pinned-version.cjs");
      const wrapper = join(f.scripts, "buildos.cmd");
      const manifest = join(f.scripts, "..", "manifest.json");
      const driver = join(f.project, "..", "driver.cmd");
      // The helper gets the arguments and the two variables that buildos.cmd gives it; then the wrapper runs with call, and
      // through a nested cmd.exe without call. %ERRORLEVEL% is read on the line right after each.
      writeFileSync(
        driver,
        [
          "@echo off",
          "setlocal",
          'set "BUILDOS_WRAPPER_ACTIVE=1"',
          'set "NoDefaultCurrentDirectoryInExePath=1"',
          `"${process.execPath}" "${helper}" --cmd "${wrapper}" "${manifest}" ${ARGS.join(" ")}`,
          "echo direct=%ERRORLEVEL%",
          "endlocal",
          `call "${wrapper}" ${ARGS.join(" ")}`,
          "echo call=%ERRORLEVEL%",
          `cmd /d /s /c ""${wrapper}" ${ARGS.join(" ")}"`,
          "echo nested=%ERRORLEVEL%",
          "exit /b 0",
          "",
        ].join("\r\n"),
      );
      for (const code of CODES) {
        const env = environment(f, code);
        const result = spawnSync(join(system32, "cmd.exe"), ["/d", "/s", "/c", `""${driver}""`], { cwd: f.project, env, encoding: "utf8", windowsVerbatimArguments: true, timeout: 60_000 });
        const explain = explainRun(result, `cmd.exe /d /s /c "${driver}" (driver: direct helper, call wrapper, nested cmd.exe wrapper)`, f, env);
        const read = (key: string) => /^(-?\d+)\r?$/m.exec(result.stdout.split(`${key}=`)[1] ?? "")?.[1];
        const seen = { direct: read("direct"), call: read("call"), nested: read("nested") };
        const want = String(code);
        assert.deepEqual(seen, { direct: want, call: want, nested: want }, `%ERRORLEVEL% after each form must be the program's code ${code}\n${explain}`);
      }
    });
  }
});

describe("F-P9-17: the cmd.exe exit code rule, apart from BuildOS (record only)", { skip: !windows && "Windows only" }, () => {
  // Each probe ends with a program that exits 2. Its batch shape decides what cmd.exe gives back.
  const program = `"${process.execPath}" -e "process.exit(2)"`;
  const PROBES: Record<string, string[]> = {
    "program, then exit /b": [program, "exit /b"],
    "program at the end of the file": [program],
    "program, then goto :eof": [program, "goto :eof"],
    "program, then exit /b %ERRORLEVEL%": [program, "exit /b %ERRORLEVEL%"],
    "setlocal DisableDelayedExpansion, program, then exit /b": ["setlocal DisableDelayedExpansion", program, "exit /b"],
    "setlocal DisableDelayedExpansion, program, then exit /b %ERRORLEVEL%": ["setlocal DisableDelayedExpansion", program, "exit /b %ERRORLEVEL%"],
    'setlocal, set "ERRORLEVEL=", program, then exit /b %ERRORLEVEL%': ["setlocal DisableDelayedExpansion", 'set "ERRORLEVEL="', program, "exit /b %ERRORLEVEL%"],
  };
  it("records the exit code of cmd.exe for each batch shape, without and with call, and with a caller variable ERRORLEVEL=0", (t) => {
    const dir = join(scratch, "probes");
    mkdirSync(dir, { recursive: true });
    const rows: string[] = [];
    let index = 0;
    for (const [shape, lines] of Object.entries(PROBES)) {
      const file = join(dir, `probe-${++index}.cmd`);
      writeFileSync(file, ["@echo off", ...lines, ""].join("\r\n"));
      const codes: string[] = [];
      for (const [label, line, extra] of [["cmd /c", `""${file}""`, {}], ["cmd /c call", `"call "${file}""`, {}], ["cmd /c, ERRORLEVEL=0 set", `""${file}""`, { ERRORLEVEL: "0" }]] as const) {
        const env = { SystemRoot: process.env["SystemRoot"] ?? "C:\\Windows", PATH: system32, TEMP: scratch, TMP: scratch, ...extra };
        const result = spawnSync(join(system32, "cmd.exe"), ["/d", "/s", "/c", line], { env, encoding: "utf8", windowsVerbatimArguments: true, timeout: 60_000 });
        codes.push(`${label}: ${String(result.status)}`);
      }
      rows.push(`probe ${index} (${shape}): ${codes.join("; ")}`);
    }
    for (const row of rows) t.diagnostic(row);
    console.log(["F-P9-17 cmd.exe probes (the program exits 2):", ...rows].join("\n"));
  });
});
