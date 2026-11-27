// W1 R7 P8 follow-ups F-P8-12 and F-P8-13, fixed in W1 R7 P9 Stage 3:
//
// - F-P8-12: scripts/measure-npx-first-run.ts starts every child with the
//   folder of the Node.js that runs it first on PATH (scripts/node-first-path.ts),
//   so the BuildOS CLI that npx starts by the name `node` runs under that Node.js.
// - F-P8-13: scripts/published-smoke.ts checks the raw output and cleans it
//   only for the saved report, so a user or folder name that the cleaning
//   replaces cannot change a check.
//
// Neither script is run here: both need the npm registry.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { withNodeFirst } from "../scripts/node-first-path.ts";
import { commandPromptArgs, expectedActionLine, expectedRebuild, printedFixStep, type RanStep } from "../scripts/printed-fix-step.ts";

const SCRIPTS = resolve(import.meta.dirname, "..", "scripts");
const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("F-P8-12: the child PATH starts with the Node.js of the script", () => {
  it("puts the Node.js folder first and folds every PATH spelling into one key", () => {
    assert.deepEqual(withNodeFirst({ PATH: "/a:/b", X: "1" }, "/opt/node/bin/node", "linux"), { PATH: "/opt/node/bin:/a:/b", X: "1" });
    assert.deepEqual(withNodeFirst({ X: "1" }, "/opt/node/bin/node", "darwin"), { PATH: "/opt/node/bin", X: "1" });
    assert.deepEqual(withNodeFirst({ Path: "C:\\a;C:\\b", PATH: "C:\\c" }, "C:\\Program Files\\nodejs\\node.exe", "win32"), { Path: "C:\\Program Files\\nodejs;C:\\a;C:\\b;C:\\c" });
  });

  it("a child that starts `node` by name gets this Node.js, also when another node is first on the PATH it was given", { skip: process.platform === "win32" ? "a fake node.exe is not built here; the unit test above covers the Windows form" : false }, () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-node-first-"));
    temps.push(dir);
    writeFileSync(join(dir, "node"), "#!/bin/sh\necho other-node\n");
    chmodSync(join(dir, "node"), 0o755);
    const given = { ...process.env, PATH: `${dir}:${process.env["PATH"] ?? ""}` };
    assert.equal(spawnSync("node", ["-p", "process.execPath"], { encoding: "utf8", env: given }).stdout.trim(), "other-node", "the planted node is first without the fix");
    const fixed = spawnSync("node", ["-p", "process.execPath"], { encoding: "utf8", env: withNodeFirst(given) });
    assert.equal(realpathSync(fixed.stdout.trim()), realpathSync(process.execPath));
    assert.equal(dirname(process.execPath), withNodeFirst(given)["PATH"]!.split(":")[0]);
  });

  it("measure-npx-first-run.ts gives every child that PATH, checks the child node before it measures, and records it", () => {
    const text = readFileSync(join(SCRIPTS, "measure-npx-first-run.ts"), "utf8");
    assert.match(text, /import \{ withNodeFirst \} from "\.\/node-first-path\.ts";/);
    assert.match(text, /\n {2}return withNodeFirst\(e\);\n\};/);
    assert.equal(text.match(/env: env\(/g)?.length ?? 0, 2, "the version check and the npm version read use env()");
    assert.equal(text.match(/, env\(cache\)/g)?.length ?? 0, 3, "the three timed runs use env()");
    assert.match(text, /childVersion !== process\.version \|\| realpathSync\(/);
    assert.match(text, /\n {6}child_node: childVersion,\n/);
  });
});

describe("F-P8-13: published-smoke.ts checks raw output and cleans only the report", () => {
  const text = readFileSync(join(SCRIPTS, "published-smoke.ts"), "utf8");

  it("run() keeps the raw stdout and stderr (CRLF made LF) for the checks", () => {
    const body = text.slice(text.indexOf("function run("), text.indexOf("function check("));
    assert.match(body, /stdout: String\(r\.stdout \?\? ""\)\.replace\(\/\\r\\n\/g, "\\n"\),/);
    assert.doesNotMatch(body, /stdout: clean\(|stderr: clean\(/);
  });

  it("the report and the Markdown summary are built from the cleaned copy (check labels included, PR 12 review round 1 finding 3), only in finish(), which runs after every check", () => {
    const body = text.slice(text.indexOf("function finish(stopped?: string): never {"), text.indexOf("\n}\n", text.indexOf("function finish(")));
    // Review round 3 of pull request 12, finding 5: the cleaned copy, then the last scrub of any absolute path left.
    assert.ok(body.includes("const reported = scrub(steps.map((s) => ({ ...s, stdout: clean(s.stdout, stepFolder.get(s)), stderr: clean(s.stderr, stepFolder.get(s)), checks: s.checks.map((c) => ({ ...c, check: clean(c.check, stepFolder.get(s)) })) })));"), body);
    assert.ok(body.includes("const launchers = scrub(launcherRecord);"), body);
    assert.match(body, /\n {4}steps: reported,\n/);
    assert.match(body, /\n {2}for \(const s of reported\) \{\n {4}md\.push\(/);
    assert.doesNotMatch(body, /\n {4}steps,\n/);
    // finish() runs last, after the last check, or right after a failed preflight (before step 1).
    assert.ok(text.trimEnd().endsWith("\nfinish();"));
    assert.equal(text.match(/\bfinish\(/g)?.length, 3, "the definition, the preflight stop, and the end");
  });
});

describe("F-P8-11 review rounds 1 and 2 (findings 3 and 4): smoke step 10 runs a printed fix command only when both outputs are exact, and then needs a current index", () => {
  const text = readFileSync(join(SCRIPTS, "published-smoke.ts"), "utf8");
  const PROJECT_POSIX = "/tmp/smoke/project";
  const PROJECT_WIN = "C:\\T\\bang!it!";

  /** A stubbed step 10: `before` and `after` are the two `entities validate --json` outputs; `human` is the stdout of step 5. */
  function stubbed(options: { version?: string; windows?: boolean; printed?: string; human?: string; after?: unknown }) {
    const version = options.version ?? "0.2.0";
    const windows = options.windows ?? false;
    const project = windows ? PROJECT_WIN : PROJECT_POSIX;
    const expected = expectedRebuild(project, version, windows);
    const printed = options.printed ?? expected;
    const checks: { what: string; ok: boolean }[] = [];
    const shellRuns: string[] = [];
    let validates = 0;
    const step = (stdout: string): RanStep => ({ stdout, stderr: "", exit: 0 });
    const current = { ok: true, result: { index: { state: "current", current: true } }, diagnostics: [] };
    printedFixStep({
      version,
      windows,
      project,
      humanStdout: options.human ?? `entities.validate: ok\n${expectedActionLine(printed, windows)}\n`,
      npxRun: () => step(JSON.stringify(validates++ === 0 ? { ok: true, result: { index: { state: "missing", current: false, remediation_command: printed } }, diagnostics: [{ code: "index_stale", severity: "warning" }] } : (options.after ?? current))),
      shellRun: (_name, command) => {
        shellRuns.push(command);
        return step("entities.rebuild-index: ok\nwrite status: applied\n");
      },
      check: (_step, what, ok) => checks.push({ what, ok }),
    });
    return { expected, checks, shellRuns, failed: checks.filter((c) => !c.ok).map((c) => c.what) };
  }

  it("both outputs exact and a current index after the run: every check passes, and the expected command ran once", () => {
    for (const windows of [false, true]) {
      const r = stubbed({ windows });
      assert.deepEqual(r.failed, [], String(windows));
      assert.deepEqual(r.shellRuns, [r.expected]);
    }
  });

  it("the JSON field matches but the human action: line does not: the failure is recorded and nothing runs (the review's case)", () => {
    for (const windows of [false, true]) {
      const expected = expectedRebuild(windows ? PROJECT_WIN : PROJECT_POSIX, "0.2.0", windows);
      for (const human of [`  action: buildos entities rebuild-index --root x\n`, `  action: ${expected} \n`, windows ? `  action: run this in Command Prompt: ${expected}\n` : `  action: run this: ${expected}\n`, ""]) {
        const r = stubbed({ windows, human });
        assert.deepEqual(r.shellRuns, [], human);
        assert.ok(r.failed.some((what) => what.includes("ran nothing")), human);
        assert.ok(r.failed.some((what) => what.startsWith("the human action: line")), human);
      }
    }
  });

  it("the human line matches but the JSON field does not: nothing runs", () => {
    const expected = expectedRebuild(PROJECT_POSIX, "0.2.0", false);
    const r = stubbed({ printed: `${expected} ; echo planted`, human: `${expectedActionLine(expected, false)}\n` });
    assert.deepEqual(r.shellRuns, []);
    assert.ok(r.failed.some((what) => what.includes("ran nothing")));
  });

  it("after the run, a validation that exits 0 with index_non_reproducible and index.current false fails the step", () => {
    const warned = { ok: true, result: { index: { state: "non_reproducible", current: false } }, diagnostics: [{ code: "index_non_reproducible", severity: "warning" }] };
    const r = stubbed({ after: warned });
    assert.equal(r.shellRuns.length, 1);
    assert.ok(r.failed.some((what) => what.startsWith("ok is true, and result.index.current is true")), r.failed.join("; "));
    assert.ok(r.failed.some((what) => what.includes("found index_non_reproducible")), r.failed.join("; "));
    // index.current true is not enough while an index diagnostic is there.
    const mixed = stubbed({ after: { ...warned, result: { index: { state: "current", current: true } } } });
    assert.deepEqual(mixed.failed.length, 1);
    assert.ok(mixed.failed[0]!.includes("found index_non_reproducible"));
    // No JSON at all fails too.
    assert.ok(stubbed({ after: "not json" }).failed.length > 0);
  });

  it("0.1.0: the bare buildos form is checked and never run", () => {
    const printed = "buildos entities rebuild-index --root '/tmp/smoke/project' --mode compat --apply";
    const r = stubbed({ version: "0.1.0", printed, human: `  action: ${printed}\n` });
    assert.deepEqual(r.failed, []);
    assert.deepEqual(r.shellRuns, []);
  });

  it("expectedRebuild and the action line state the program, the arguments, the quoting, and the label on their own", () => {
    const body = readFileSync(join(SCRIPTS, "printed-fix-step.ts"), "utf8");
    assert.doesNotMatch(body, /^import /m);
    assert.equal(expectedRebuild("/tmp/a b/it's", "0.2.0", false), "npx -y build-os@0.2.0 entities rebuild-index --root '/tmp/a b/it'\\''s' --mode compat --apply");
    assert.equal(expectedRebuild("C:\\T\\a%b\\", "0.2.0", true), 'npx -y build-os@0.2.0 entities rebuild-index --root "C:\\T\\a"^%"b\\\\" --mode compat --apply');
    assert.equal(expectedActionLine("x!y", true), "  action: run this in Command Prompt, with delayed expansion off: x!y");
    assert.equal(expectedActionLine("xy", true), "  action: run this in Command Prompt: xy");
    assert.equal(expectedActionLine("x!y", false), "  action: x!y");
  });

  it("published-smoke.ts runs step 10 through printedFixStep, on Windows in Command Prompt with delayed expansion off", () => {
    assert.deepEqual(commandPromptArgs("a b"), ['/d /v:off /s /c "a b"']);
    const step = text.slice(text.indexOf("// 10. A printed fix command"), text.indexOf("// Tarball mode only, after step 10"));
    assert.match(step, /^\/\/ 10\. A printed fix command[^\n]*\nprintedFixStep\(\{\n/);
    assert.match(step, /WINDOWS \? run\(name, command, process\.env\["ComSpec"\] \?\? "cmd\.exe", commandPromptArgs\(command\), 0, project, \{ verbatim: true, role: "fix-run" \}\) : run\(name, command, "\/bin\/sh", \["-c", command\], 0, project, \{ role: "fix-run" \}\)/);
    assert.equal(text.match(/\bprintedFixStep\(/g)?.length ?? 0, 1);
    assert.doesNotMatch(text, /function expectedRebuild\(/);
  });
});
