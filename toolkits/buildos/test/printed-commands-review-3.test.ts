// F-P8-11 and F-P8-10, review round 3 of pull request 9, the final fix pass
// (parity exception PE-023). One or more tests per finding:
//
// - Finding 2: the adoption note says the wrapper command is for after
//   adoption completes, in the dry run and the applied run.
// - Finding 3: the retry words tell three states apart: Make Docs not
//   requested; requested and a process started; requested and no process
//   started (a launch failure). A stub counts the starts. The late
//   write-permission correction carries the flag change once.
//
// Finding 1 is in test/design.test.ts and test/installed-layout.test.ts.

import assert from "node:assert/strict";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { runProgram } from "../src/adapters/node-process.ts";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import { legacyValidatorNote } from "../src/core/init/plan.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { assertIncludes, captureIo, shape } from "./helpers.ts";

const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const FIXTURE = join(import.meta.dirname, "fixtures", "init", "go-era-project");
const content = loadSourceContent(SYSTEM);
const scratch = mkdtempSync(join(tmpdir(), "buildos-printed-review-3-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;

function folder(name: string): string {
  const dir = join(scratch, `case-${++counter}`, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

interface Envelope {
  root: string;
  result: { status: string; summary: string; reason?: string; tip?: string; notes?: { message: string }[]; make_docs?: { status: string; started?: boolean } };
  diagnostics: { code: string; correction?: string }[];
}

async function init(cwd: string, args: string[], process?: ProcessPort) {
  const io = captureIo(cwd);
  const domain = createInitDomain({
    loadContent: () => content,
    now: () => new Date("2026-11-26T00:00:00Z"),
    ...(process === undefined ? {} : { openProcess: () => process }),
  });
  const exit = await run(["init", ...args], io, { domains: [domain], buildInfo: { version: "0.2.0", sourceRevision: "unknown" } });
  const stdout = io.stdout();
  return { exit, stdout, json: args.includes("--json") ? (JSON.parse(stdout) as Envelope) : undefined };
}

/** Every string in `value`, at any depth. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

const FLAG_CHANGE = "with --skip-make-docs and without --make-docs, because Make Docs already ran";
const RETRY = /run the same init command again/i;

describe("finding 2: the adoption note is for after adoption completes", () => {
  for (const dry of [true, false]) {
    it(`init --root <project> from another folder, ${dry ? "dry run" : "apply"}: the note says the wrapper command is for after adoption completes, human and JSON`, async () => {
      for (const json of [false, true]) {
        const elsewhere = folder("elsewhere");
        const project = folder("project");
        cpSync(FIXTURE, project, { recursive: true });
        writeFileSync(join(project, ".os", "scripts", "validate_config.py"), "# a Go-era project's own copy of the earlier validator\n");
        const result = await init(elsewhere, ["--root", project, "--skip-make-docs", ...(dry ? ["--dry-run"] : []), ...(json ? ["--json"] : [])]);
        assert.equal(result.exit, 0, shape(result.stdout));
        const note = legacyValidatorNote(project);
        assertIncludes(note, `BuildOS no longer uses it. After adoption completes, in the project folder ${project}, run .os/scripts/buildos validate instead`);
        if (json) assert.deepEqual(result.json!.result.notes?.map((n) => n.message), [note]);
        else assertIncludes(result.stdout, `\nNote: ${note}\n`);
        // A dry run only plans the wrapper (the Go-era file stays as it was); the applied run writes it.
        const wrapper = readFileSync(join(project, ".os", "scripts", "buildos"));
        assert.equal(wrapper.equals(readFileSync(join(FIXTURE, ".os", "scripts", "buildos"))), dry);
      }
    });
  }
});

/** A Make Docs stub that counts starts. `found`: whether it finds a program; `onFind` and `onRun` act on the target folder. */
function countingStub(options: { found: boolean; onFind?: () => void; onRun?: (target: string) => void }): { port: ProcessPort; starts: () => number } {
  let starts = 0;
  return {
    port: {
      find: (name) => {
        options.onFind?.();
        return options.found && name === "make-docs" ? "/stub/make-docs" : undefined;
      },
      run: (_program, _args, run) => {
        starts++;
        options.onRun?.(run.cwd);
        return { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" };
      },
    },
    starts: () => starts,
  };
}

describe("finding 3: the retry words tell the three Make Docs states apart", () => {
  const clash = (dir: string) => writeFileSync(join(dir, "workspace"), "not a folder\n");

  it("not requested (--skip-make-docs), with a clash: no flag change, and no start", async () => {
    for (const json of [false, true]) {
      const dir = folder("project");
      clash(dir);
      const stub = countingStub({ found: true });
      const result = await init(dir, ["--root", dir, "--skip-make-docs", ...(json ? ["--json"] : [])], stub.port);
      assert.equal(result.exit, 10, shape(result.stdout));
      assert.equal(stub.starts(), 0);
      const text = json ? strings(result.json) : [result.stdout];
      for (const t of text) assert.ok(!t.includes("already ran") && !t.includes("--skip-make-docs and without"), t);
      if (json) assert.equal(result.json!.result.tip, "Move or back up these files, then run the same init command again.");
      else assert.ok(RETRY.test(result.stdout));
    }
  });

  it("requested, and a process started: one start, and every retry says --skip-make-docs, because Make Docs already ran", async () => {
    for (const json of [false, true]) {
      const dir = folder("project");
      const stub = countingStub({ found: true, onRun: clash });
      const result = await init(dir, ["--root", dir, "--make-docs", ...(json ? ["--json"] : [])], stub.port);
      assert.equal(result.exit, 10, shape(result.stdout));
      assert.equal(stub.starts(), 1);
      if (json) {
        assert.equal(result.json!.result.make_docs?.status, "set_up");
        assertIncludes(result.json!.result.tip ?? "", FLAG_CHANGE);
        for (const t of strings(result.json).filter((s) => RETRY.test(s))) assertIncludes(t, FLAG_CHANGE);
      } else {
        const lines = result.stdout.split("\n").filter((line) => RETRY.test(line));
        assert.ok(lines.length > 0);
        for (const line of lines) assertIncludes(line, FLAG_CHANGE);
      }
    }
  });

  it("requested, and no process started (neither make-docs nor npx), with a clash on replan: no start, the retry keeps the adopter's own command, and nothing says Make Docs ran", async () => {
    for (const json of [false, true]) {
      const dir = folder("project");
      // The clash appears between the first plan and the replan, while BuildOS looks for Make Docs.
      const stub = countingStub({ found: false, onFind: () => clash(dir) });
      const result = await init(dir, ["--root", dir, "--make-docs", ...(json ? ["--json"] : [])], stub.port);
      assert.equal(result.exit, 10, shape(result.stdout));
      assert.equal(stub.starts(), 0);
      const text = json ? strings(result.json) : [result.stdout];
      for (const t of text) {
        assert.ok(!t.includes("already ran"), t);
        assert.ok(!t.includes("--skip-make-docs"), t);
        assert.ok(!t.includes("Make Docs ran"), t);
      }
      if (json) {
        const envelope = result.json!;
        assert.equal(envelope.result.make_docs?.status, "failed");
        assert.equal(envelope.result.make_docs?.started, false);
        assert.ok(envelope.result.summary.startsWith("Nothing was changed."), envelope.result.summary);
        assert.equal(envelope.result.tip, "Move or back up these files, then run the same init command again.");
        assert.equal(envelope.diagnostics[0]!.correction, envelope.result.tip);
      } else {
        assertIncludes(result.stdout, "Make Docs could not start, because this computer has neither make-docs nor npx");
        assertIncludes(result.stdout, "run the same init command again.");
      }
    }
  });

  it("the process adapter: a program that never starts reports started false; one that starts does not", () => {
    const missing = runProgram(join(scratch, "no-such-program"), [], { cwd: scratch }, process.env);
    assert.equal(missing.started, false);
    assertIncludes(missing.failure ?? "", "it could not start");
    const ran = runProgram(process.execPath, ["-e", ""], { cwd: scratch }, process.env);
    assert.equal(ran.exitCode, 0);
    assert.equal(ran.started, undefined);
  });

  const posixUser = process.platform !== "win32" && process.getuid?.() !== 0;
  it("the late write-permission diagnostic: the flag change once after a start, and none after a launch failure", { skip: posixUser ? false : "POSIX folder modes, not as root" }, async () => {
    // The Make Docs step leaves the project folder, where BuildOS must add files, without write permission.
    const lock = (dir: string) => chmodSync(dir, 0o555);
    const cases = [
      { started: true, stub: (dir: string) => countingStub({ found: true, onRun: () => lock(dir) }) },
      { started: false, stub: (dir: string) => countingStub({ found: false, onFind: () => lock(dir) }) },
    ];
    for (const c of cases) {
      const dir = folder("project");
      const stub = c.stub(dir);
      try {
        const result = await init(dir, ["--root", dir, "--make-docs", "--json"], stub.port);
        assert.equal(stub.starts(), c.started ? 1 : 0);
        const envelope = result.json!;
        assert.equal(envelope.result.status, "failed", shape(result.stdout));
        const correction = envelope.diagnostics.find((d) => d.code === "init_folder_not_writable")?.correction ?? "";
        assertIncludes(correction, "Allow your user to write in these folders, then run the same init command again");
        assert.equal(correction.split(FLAG_CHANGE).length - 1, c.started ? 1 : 0, correction);
        assert.equal(correction.split("--skip-make-docs").length - 1, c.started ? 1 : 0, correction);
        if (!c.started) {
          assertIncludes(envelope.result.summary, "Make Docs could not start before this.");
          assert.ok(!envelope.result.summary.includes("Make Docs ran"), envelope.result.summary);
        }
        const human = await init(dir, ["--root", dir, "--make-docs"], c.stub(dir).port);
        for (const line of human.stdout.split("\n")) assert.ok(line.split(FLAG_CHANGE).length - 1 <= 1, line);
      } finally {
        chmodSync(dir, 0o755);
      }
    }
  });
});
