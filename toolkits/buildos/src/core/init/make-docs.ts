/**
 * The Make Docs companion setup (PRD 20 Make Docs Companion Setup). BuildOS
 * runs Make Docs only through its public CLI: `make-docs` on `PATH`, else
 * `npx -y @brucewaynedecoy/make-docs@<pinned range>`, with every setup choice
 * given explicitly. BuildOS itself never writes a Make Docs-owned file.
 *
 * BuildOS relies on only these Make Docs commands: `make-docs --version`,
 * `make-docs project state status --json`, and `make-docs setup --json`. This
 * module runs only the setup. The CI contract job checks all three.
 */

import type { ProcessPort } from "../shared/process-port.ts";
import { MAKE_DOCS_PACKAGE, MAKE_DOCS_RANGE } from "./make-docs-range.ts";

/** The exact setup arguments after `make-docs`. */
export function makeDocsSetupArgs(target: string): string[] {
  return [
    "setup",
    "--target",
    target,
    "--codex-method",
    "none",
    "--claude-code-method",
    "none",
    "--no-github-copilot",
    "--no-skills",
    "--project-resources",
    "all",
    "--yes",
    "--json",
  ];
}

export interface MakeDocsCommand {
  /** The program to start: the full path of `make-docs` or `npx`. */
  program: string;
  args: string[];
  /** The command as a user would type it, for the output and the retry. */
  display: string;
}

/** `make-docs` on `PATH`, else `npx`; `undefined` when neither is there. */
export function makeDocsCommand(port: ProcessPort, target: string, platform: string): MakeDocsCommand | undefined {
  const setup = makeDocsSetupArgs(target);
  const makeDocs = port.find("make-docs");
  if (makeDocs !== undefined) return { program: makeDocs, args: setup, display: commandLine(["make-docs", ...setup], platform) };
  const npx = port.find("npx");
  const args = ["-y", `${MAKE_DOCS_PACKAGE}@${MAKE_DOCS_RANGE}`, ...setup];
  if (npx !== undefined) return { program: npx, args, display: commandLine(["npx", ...args], platform) };
  return undefined;
}

/** The npx form, shown as the retry command when nothing can start Make Docs here. */
export function npxMakeDocsDisplay(target: string, platform: string): string {
  return commandLine(["npx", "-y", `${MAKE_DOCS_PACKAGE}@${MAKE_DOCS_RANGE}`, ...makeDocsSetupArgs(target)], platform);
}

export type MakeDocsOutcome =
  | { status: "set_up"; command: string }
  | { status: "failed"; command: string; reason: string; detail?: string };

/** Make Docs setup can download Make Docs first, so it gets ten minutes. */
const SETUP_TIMEOUT_MS = 10 * 60 * 1000;

export function runMakeDocsSetup(port: ProcessPort, target: string, platform: string): MakeDocsOutcome {
  const command = makeDocsCommand(port, target, platform);
  if (command === undefined) {
    return { status: "failed", command: npxMakeDocsDisplay(target, platform), reason: "Make Docs could not start, because this computer has neither make-docs nor npx" };
  }
  const result = port.run(command.program, command.args, { cwd: target, timeoutMs: SETUP_TIMEOUT_MS });
  if (result.failure !== undefined) return { status: "failed", command: command.display, reason: "Make Docs could not start or finish", detail: result.failure };
  const status = setupStatus(result.stdout);
  if (result.exitCode === 0 && status === "complete") return { status: "set_up", command: command.display };
  const detail = errorDetail(result.stderr) ?? (status === undefined ? undefined : `setup status: ${status}`);
  return {
    status: "failed",
    command: command.display,
    reason: result.exitCode === 0 ? "Make Docs did not finish its setup" : `Make Docs stopped with exit code ${result.exitCode === null ? "none" : String(result.exitCode)}`,
    ...(detail === undefined ? {} : { detail }),
  };
}

/** The `status` field of the setup JSON, the one field BuildOS reads. */
function setupStatus(stdout: string): string | undefined {
  try {
    const value = JSON.parse(stdout) as unknown;
    if (typeof value === "object" && value !== null && typeof (value as { status?: unknown }).status === "string") return (value as { status: string }).status;
  } catch {
    // Not JSON: no status.
  }
  return undefined;
}

/** The first line of a Make Docs error: its JSON `message`, else the first stderr line. */
function errorDetail(stderr: string): string | undefined {
  const text = stderr.trim();
  if (text === "") return undefined;
  try {
    const value = JSON.parse(text) as { message?: unknown };
    if (typeof value.message === "string" && value.message.trim() !== "") return firstLine(value.message);
  } catch {
    // Plain text.
  }
  return firstLine(text);
}

function firstLine(text: string): string {
  const line = (text.trim().split(/\r?\n/, 1)[0] ?? "").trim();
  return line.length > 300 ? `${line.slice(0, 297)}...` : line;
}

/**
 * A command line as a user would type it, ready to copy and paste (W1 R7
 * P6 review round 1). Each argument with only safe characters stays bare.
 *
 * - macOS and Linux (`sh`, `bash`, `zsh`): other arguments go in single
 *   quotes, and a single quote inside is written `'\''`. Nothing inside
 *   single quotes is special.
 * - Windows (Command Prompt, `cmd.exe`): other arguments go in double
 *   quotes. Inside them, `&`, `|`, `<`, `>`, `^`, `(`, `)`, and spaces are
 *   plain text. A `%` is written as `"^%"` (close the quotes, an escaped
 *   `%`, open them again), so `%NAME%` is never read as a variable. A
 *   backslash run before each closing quote is doubled, as Windows programs
 *   read it. A Windows path cannot hold `"`. The same text works when the
 *   program is an npm `.cmd` shim, which passes it on with `%*`.
 *
 * W1 R7 P6 review round 2: the output names the shell (`shell`: `sh` or
 * `cmd`, and "in Command Prompt" in the human text on Windows). The Windows
 * form is for Command Prompt with its default settings. With delayed
 * expansion on (`cmd /v:on`), a `!` in an argument would still be read as a
 * variable; no one spelling of `!` works both with it on and off, so that
 * case is a stated limit (`SECURITY.md`). PowerShell needs other quoting
 * (`$` and the backtick are special there); BuildOS does not show a
 * PowerShell form, because npm's PowerShell shims depend on the machine's
 * script policy and BuildOS cannot test that form here.
 */
export function commandLine(args: readonly string[], platform: string): string {
  return args.map((arg) => quoteArg(arg, platform)).join(" ");
}

export function quoteArg(arg: string, platform: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-][A-Za-z0-9_@%+=:,./~-]*$/.test(arg) && !(platform === "win32" && arg.includes("%"))) return arg;
  if (platform === "win32") {
    // Each part between two `%` is quoted on its own, so a backslash run before every closing quote is doubled.
    return arg
      .split("%")
      .map((part) => `"${part.replace(/"/g, '""').replace(/(\\+)$/, "$1$1")}"`)
      .join("^%");
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
