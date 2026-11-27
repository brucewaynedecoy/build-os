// Step 10 of scripts/published-smoke.ts (F-P8-11, PE-023; owner decision
// 2026-11-26): the printed fix command, run as printed. It is in its own
// module, with every process start passed in, so a test can run it with
// stubs (F-P8-11 review round 2, finding 4). Node built-ins only; it starts
// nothing itself.
//
// `entities validate --json` in the project of step 3 (which has no entity
// index yet) prints the rebuild command in `result.index.remediation_command`.
//
// - 0.1.0 prints a bare `buildos` (the known defect F-P8-11, fixed in
//   0.2.0): the step checks that form and that the human `action:` line of
//   step 5 holds the same text, and runs nothing.
// - Any other version: the step states on its own the exact command for
//   this project (`expectedRebuild`) and the exact human `action:` line (on
//   Windows with its label, `run this in Command Prompt: `, and
//   `, with delayed expansion off` before the colon when the command holds a
//   `!`). Only when BOTH the JSON field and the human line are exactly the
//   expected ones does it run the command through the system shell (`sh -c`,
//   or Command Prompt with delayed expansion off, `cmd /d /v:off /s /c`, on
//   Windows); on any mismatch it records the failure and runs nothing. After
//   the run, `entities validate --json` must report `result.index.current`
//   true (state `current`) and no `index_` diagnostic, so an index that is
//   there but not reproducible (`index_non_reproducible`, a warning with
//   exit 0) fails the step.
//
// Tarball mode (F-P9-15, `source: "tarball"`): the same exact checks of the
// printed text, and the same run of that text through the system shell. The
// smoke has installed the tarball into the project and blocked the
// registry, so npm resolves `build-os@<version>` to that local install: the
// printed program, arguments, and quoting run as printed, on the tarball's
// bytes. The step's name says so. What this cannot prove before publication
// is the registry fetch of the literal command (runbook step k).

/** The parts of a smoke step that this step reads. */
export interface RanStep {
  stdout: string;
  stderr: string;
  exit: number | null;
}

export interface PrintedFixInput<S extends RanStep> {
  version: string;
  /** Where the package comes from (scripts/smoke-source.ts); "registry" when not given. */
  source?: "registry" | "tarball";
  windows: boolean;
  /** The project folder of step 3. */
  project: string;
  /** The stdout of step 5 (human `entities validate`), or undefined when it did not run. */
  humanStdout: string | undefined;
  /** Runs `npx -y build-os@<version> <args>` in the project; `expected` is the exit code it must give. */
  npxRun: (name: string, args: string[], expected: number) => S;
  /** Runs `command` through the system shell in the project (exit 0 expected). */
  shellRun: (name: string, command: string) => S;
  check: (step: S, what: string, ok: boolean) => void;
}

/**
 * The exact rebuild command that a BuildOS release prints for `root` (PE-023),
 * stated here on its own and not taken from BuildOS: `npx -y build-os@<version>
 * entities rebuild-index --root <root> --mode compat --apply`, with the root
 * in POSIX single quotes (a `'` as `'\\''`), or on Windows in Command Prompt
 * double quotes, each `%` outside them as `^%` and a backslash run before a
 * closing quote doubled.
 */
export function expectedRebuild(root: string, version: string, windows: boolean): string {
  const quoted = windows
    ? root
        .split("%")
        .map((part) => `"${part.replace(/(\\+)$/, "$1$1")}"`)
        .join("^%")
    : `'${root.replace(/'/g, "'\\''")}'`;
  return `npx -y build-os@${version} entities rebuild-index --root ${quoted} --mode compat --apply`;
}

/** The exact human `action:` line (with its two leading spaces) for `expected`. */
export function expectedActionLine(expected: string, windows: boolean): string {
  return windows ? `  action: run this in Command Prompt${expected.includes("!") ? ", with delayed expansion off" : ""}: ${expected}` : `  action: ${expected}`;
}

/** The Command Prompt arguments that run `command` with delayed expansion off, whatever the machine default. */
export function commandPromptArgs(command: string): string[] {
  return [`/d /v:off /s /c "${command}"`];
}

interface ValidateJson {
  ok?: boolean;
  result?: { index?: { state?: string; current?: boolean; remediation_command?: string } };
  diagnostics?: { code?: string; severity?: string }[];
}

function parse(text: string): ValidateJson {
  try {
    return JSON.parse(text) as ValidateJson;
  } catch {
    return {};
  }
}

/** Runs step 10. */
export function printedFixStep<S extends RanStep>(input: PrintedFixInput<S>): void {
  const { version, windows, project, check } = input;
  const json = input.npxRun("entities validate --json (the printed fix command)", ["entities", "validate", "--root", project, "--mode", "compat", "--json"], 0);
  const printed = parse(json.stdout).result?.index?.remediation_command ?? "";
  const humanLines = input.humanStdout === undefined ? [] : input.humanStdout.split("\n");
  if (version === "0.1.0") {
    check(json, "result.index.remediation_command holds a rebuild-index command", printed.includes(" entities rebuild-index --root ") && printed.endsWith(" --mode compat --apply"));
    check(json, "the human action: line of step 5 holds the same command", humanLines.includes(`  action: ${printed}`));
    check(json, "0.1.0 prints a bare buildos (the known defect F-P8-11, fixed in 0.2.0); the step does not run it", printed.startsWith("buildos entities rebuild-index --root "));
    return;
  }
  const expected = expectedRebuild(project, version, windows);
  const line = expectedActionLine(expected, windows);
  const jsonMatch = printed === expected;
  const humanMatch = humanLines.includes(line);
  check(json, `result.index.remediation_command is exactly ${expected}`, jsonMatch);
  check(json, `the human action: line of step 5 is exactly ${line.trim()}`, humanMatch);
  // Review round 1, finding 3, and review round 2, finding 4: both must match before anything runs.
  if (!jsonMatch || !humanMatch) {
    check(json, "the printed command did not match in the JSON field and the human action: line, so the step stopped and ran nothing", false);
    return;
  }
  const shellName = windows ? "the printed fix command, as printed, in Command Prompt (delayed expansion off)" : "the printed fix command, as printed, in sh";
  const tarballNote = ` (tarball mode: npm resolves build-os@${version} to the project's local install of the tarball, with the registry blocked; the registry fetch of this literal command is proven only after publication, runbook step k)`;
  const step = input.shellRun(input.source === "tarball" ? `${shellName}${tarballNote}` : shellName, printed);
  check(step, "stdout says entities.rebuild-index: ok and the write was applied", step.stdout.startsWith("entities.rebuild-index: ok\n") && step.stdout.includes("write status: applied\n"));
  const after = input.npxRun("entities validate --json after the printed fix command", ["entities", "validate", "--root", project, "--mode", "compat", "--json"], 0);
  const parsed = parse(after.stdout);
  const index = parsed.result?.index;
  const indexDiagnostics = (parsed.diagnostics ?? []).filter((d) => typeof d.code === "string" && d.code.startsWith("index_")).map((d) => d.code);
  check(after, "ok is true, and result.index.current is true with state current", parsed.ok === true && index?.current === true && index.state === "current");
  check(after, `no index diagnostic (index_non_reproducible, index_stale, or another)${indexDiagnostics.length > 0 ? `; found ${indexDiagnostics.join(", ")}` : ""}`, indexDiagnostics.length === 0 && !after.stderr.includes("index_"));
}
