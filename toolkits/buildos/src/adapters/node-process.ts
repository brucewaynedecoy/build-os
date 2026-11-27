/**
 * The process port (`src/core/shared/process-port.ts`) on `node:child_process`.
 * This is the only source file that may spawn a process (the boundary check
 * in `test/boundary-rules.ts` allows `child_process` here and nowhere else).
 * It runs no shell on macOS and Linux. On Windows, npm installs `make-docs`
 * and `npx` as `.cmd` files, which only `cmd.exe` can run, so a `.cmd` or
 * `.bat` program runs through `cmd.exe /d /s /c` with every argument quoted;
 * an argument that `cmd.exe` could still read as a variable or a new line
 * (`%`, `!`, `"`, a line break) is refused before anything starts. It never
 * starts BuildOS itself (PRD 20 Command Surface: an adapter never shells out
 * to another `buildos` command).
 */

import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { basename, delimiter, extname, isAbsolute, join } from "node:path";
import type { ProcessPort, ProcessResult } from "../core/shared/process-port.ts";

const WINDOWS = process.platform === "win32";

export function createNodeProcessPort(env: NodeJS.ProcessEnv = process.env): ProcessPort {
  return {
    find: (name) => findOnPath(name, env),
    run: (program, args, options) => runProgram(program, args, options, env),
  };
}

/**
 * True when `path` is a file this user can run: on macOS and Linux, a file
 * with execute permission for this user (W1 R7 P6 review round 1: a file
 * without it does not hide a working one later on PATH); on Windows, any
 * file (the PATHEXT extension makes it a program).
 */
function isProgram(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (!WINDOWS) accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The first program `name` on PATH, as a shell finds it. On Windows, with each PATHEXT extension (a bare name too only with an extension). */
export function findOnPath(name: string, env: NodeJS.ProcessEnv): string | undefined {
  if (name.includes("/") || name.includes("\\")) return undefined;
  const pathValue = env["PATH"] ?? env["Path"] ?? "";
  const extensions = WINDOWS ? (env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";").filter((e) => e !== "") : [""];
  for (const dir of pathValue.split(delimiter)) {
    if (dir === "" || !isAbsolute(dir) || !existsSync(dir)) continue;
    for (const ext of extensions) {
      const candidate = join(dir, `${name}${ext}`);
      if (isProgram(candidate)) return candidate;
    }
  }
  return undefined;
}

function refusesBuildos(program: string): boolean {
  return /^buildos(?:-|\.|$)/i.test(basename(program));
}

/** Quotes one argument for `cmd.exe /s /c`; `undefined` when cmd.exe could still change it. */
export function cmdQuote(arg: string): string | undefined {
  if (/[%!"\r\n]/.test(arg)) return undefined;
  return `"${arg}"`;
}

export function runProgram(program: string, args: readonly string[], options: { cwd: string; timeoutMs?: number }, env: NodeJS.ProcessEnv): ProcessResult {
  if (refusesBuildos(program)) return { exitCode: null, stdout: "", stderr: "", failure: "the BuildOS CLI never starts itself", started: false };
  let file = program;
  let argv = [...args];
  let verbatim = false;
  if (WINDOWS && /^\.(?:cmd|bat)$/i.test(extname(program))) {
    const quoted = [program, ...args].map(cmdQuote);
    if (quoted.some((q) => q === undefined)) {
      return { exitCode: null, stdout: "", stderr: "", failure: "a path holds a character that Windows cmd.exe cannot pass safely (%, !, or a quote)", started: false };
    }
    file = join(env["SystemRoot"] ?? env["SYSTEMROOT"] ?? "C:\\Windows", "System32", "cmd.exe");
    argv = ["/d", "/s", "/c", `"${quoted.join(" ")}"`];
    verbatim = true;
  }
  const result = spawnSync(file, argv, {
    cwd: options.cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    windowsVerbatimArguments: verbatim,
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  });
  if (result.error !== undefined) {
    const code = (result.error as NodeJS.ErrnoException).code;
    // F-P8-11 review round 3 (finding 3): Node gives pid 0 when the program never started (ENOENT, EACCES); a timeout has a real pid.
    return {
      exitCode: null,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      failure: code === "ETIMEDOUT" ? "it took too long and was stopped" : `it could not start (${code ?? result.error.message})`,
      ...(result.pid ? {} : { started: false as const }),
    };
  }
  if (result.status === null) return { exitCode: null, stdout: result.stdout, stderr: result.stderr, failure: `it was stopped by signal ${String(result.signal)}` };
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}
