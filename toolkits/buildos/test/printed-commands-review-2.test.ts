// F-P8-11 and F-P8-10, review round 2 of pull request 9 (parity exception
// PE-023; owner decision 2026-11-26). One or more tests per finding:
//
// - Finding 1: the adoption note names the project folder that the wrapper
//   must run in, also for `init --root <other>` from another folder.
// - Finding 2: after Make Docs ran, every retry advice of `init` (the result
//   `tip`, each problem `fix`, each diagnostic `correction`, human and JSON)
//   carries the flag change; with no Make Docs run, none does.
// - Finding 3: every shown Windows command with a folder in it carries the
//   command-aware label (`, with delayed expansion off` for a `!`), and no
//   source file spells the label itself.
//
// Finding 4 is in test/post-publication-scripts.test.ts; the Windows shell
// runs of finding 3 (`cmd /v:off`) are in test/run-command.test.ts.

import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, describe, it } from "node:test";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import { retryAdvice, SAME_INIT, SAME_INIT_AFTER_MAKE_DOCS, sameInit, type MakeDocsReport } from "../src/core/init/init.ts";
import { legacyValidatorNote } from "../src/core/init/plan.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { COMMAND_PROMPT_LABEL, runWords } from "../src/core/shared/run-command.ts";
import { assertIncludes, captureIo, shape } from "./helpers.ts";

const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const SRC = join(import.meta.dirname, "..", "src");
const FIXTURE = join(import.meta.dirname, "fixtures", "init", "go-era-project");
const RELEASE = "0.2.0";
const content = loadSourceContent(SYSTEM);
const scratch = mkdtempSync(join(tmpdir(), "buildos-printed-review-2-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;

function folder(name: string): string {
  const dir = join(scratch, `case-${++counter}`, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A Make Docs stub: `action` runs in the target folder, then it reports success (or exit `code`). */
function makeDocs(action: (target: string) => void = () => {}, code = 0): ProcessPort {
  return {
    find: (name) => (name === "make-docs" ? "/stub/make-docs" : undefined),
    run: (_program, _args, options) => {
      action(options.cwd);
      return code === 0 ? { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" } : { exitCode: code, stdout: "", stderr: "make-docs cannot classify this target safely enough to write changes." };
    },
  };
}

async function init(cwd: string, args: string[], options: { process?: ProcessPort; platform?: string } = {}) {
  const io = captureIo(cwd);
  const domain = createInitDomain({
    loadContent: () => content,
    now: () => new Date("2026-11-26T00:00:00Z"),
    openProcess: () => options.process ?? makeDocs(),
    ...(options.platform === undefined ? {} : { platform: options.platform }),
  });
  const exit = await run(["init", ...args], io, { domains: [domain], buildInfo: { version: RELEASE, sourceRevision: "unknown" } });
  const stdout = io.stdout();
  return { exit, stdout, json: args.includes("--json") ? (JSON.parse(stdout) as Envelope) : undefined };
}

interface Envelope {
  root: string;
  result: { status: string; reason?: string; tip?: string; notes?: { message: string }[]; problems?: { fix: string }[]; make_docs?: { status: string } };
  diagnostics: { code: string; correction?: string }[];
}

/** Every string in `value`, at any depth. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === "object") for (const item of Object.values(value)) strings(item, out);
  return out;
}

const RETRY = /run the same init command again/i;
const FLAG_CHANGE = "with --skip-make-docs and without --make-docs, because Make Docs already ran";

describe("finding 1: the adoption note names the project folder the wrapper must run in", () => {
  it("init --root <project> from another folder: the note names <project>, not the current folder, in the human and JSON output", async () => {
    for (const json of [false, true]) {
      const elsewhere = folder("elsewhere");
      const project = folder("project");
      cpSync(FIXTURE, project, { recursive: true });
      writeFileSync(join(project, ".os", "scripts", "validate_config.py"), "# a Go-era project's own copy of the earlier validator\n");
      const result = await init(elsewhere, ["--root", project, "--skip-make-docs", ...(json ? ["--json"] : [])]);
      assert.equal(result.exit, 0, shape(result.stdout));
      const note = legacyValidatorNote(project);
      assertIncludes(note, `in the project folder ${project}, run .os/scripts/buildos validate instead`);
      assert.ok(!note.includes(elsewhere), "the note does not name the current folder");
      if (json) {
        assert.equal(result.json!.root, project);
        assert.deepEqual(result.json!.result.notes?.map((n) => n.message), [note]);
      } else {
        assertIncludes(result.stdout, `Project folder: ${project}\n`);
        assertIncludes(result.stdout, `\nNote: ${note}\n`);
      }
      assert.deepEqual(readdirSync(elsewhere), [], "nothing written in the current folder");
    }
  });
});

describe("finding 2: after Make Docs ran, every retry advice of init carries the flag change, from one source", () => {
  it("the shared words", () => {
    assert.equal(sameInit(), SAME_INIT);
    assert.equal(sameInit({ choice: "no", status: "skipped", later: "x" }), SAME_INIT);
    const setUp: MakeDocsReport = { choice: "yes", status: "set_up", command: "make-docs setup" };
    const failed: MakeDocsReport = { choice: "yes", status: "failed", reason: "r", retry_command: "make-docs setup" };
    for (const report of [setUp, failed]) {
      assert.equal(sameInit(report), SAME_INIT_AFTER_MAKE_DOCS);
      assert.equal(retryAdvice("Move it away. Then run the same init command again.", report), `Move it away. Then r${SAME_INIT_AFTER_MAKE_DOCS.slice(1)}.`);
      assert.equal(retryAdvice("Run the same init command again.", report), `R${SAME_INIT_AFTER_MAKE_DOCS.slice(1)}.`);
    }
    assert.equal(retryAdvice("Run the same init command again.", undefined), "Run the same init command again.");
    assertIncludes(SAME_INIT_AFTER_MAKE_DOCS, FLAG_CHANGE);
  });

  // Make Docs writes a file where BuildOS must add a folder (a clash), or an AGENTS.md with a broken BuildOS section (a problem).
  const cases: { name: string; action: (target: string) => void; reason: string }[] = [
    { name: "a clash (a path BuildOS must add)", action: (target) => writeFileSync(join(target, "workspace"), "not a folder\n"), reason: "paths_exist" },
    { name: "a shared-file problem (a broken BuildOS section)", action: (target) => writeFileSync(join(target, "AGENTS.md"), "<!-- make-docs:begin -->\n# A\n<!-- make-docs:end -->\n<!-- buildos:begin -->\nhalf\n"), reason: "shared_file_problem" },
  ];
  for (const c of cases) {
    it(`init --make-docs, then ${c.name}: the JSON tip, every fix, and every correction say --skip-make-docs; the human output too`, async () => {
      const dir = folder("project");
      const json = await init(dir, ["--root", dir, "--make-docs", "--json"], { process: makeDocs(c.action) });
      assert.equal(json.exit, 10, shape(json.stdout));
      const envelope = json.json!;
      assert.equal(envelope.result.reason, c.reason);
      assert.equal(envelope.result.make_docs?.status, "set_up");
      assertIncludes(envelope.result.tip ?? "", FLAG_CHANGE);
      for (const d of envelope.diagnostics) assertIncludes(d.correction ?? "", FLAG_CHANGE);
      for (const p of envelope.result.problems ?? []) assertIncludes(p.fix, FLAG_CHANGE);
      const advice = strings(envelope).filter((text) => RETRY.test(text));
      assert.ok(advice.length > 0, "the output advises a retry");
      for (const text of advice) assertIncludes(text, FLAG_CHANGE);

      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir);
      const human = await init(dir, ["--root", dir, "--make-docs"], { process: makeDocs(c.action) });
      assert.equal(human.exit, 10, shape(human.stdout));
      const lines = human.stdout.split("\n").filter((line) => RETRY.test(line));
      assert.ok(lines.length > 0, "the output advises a retry");
      for (const line of lines) assertIncludes(line, FLAG_CHANGE);
    });

    it(`init --skip-make-docs with ${c.name} already there: no advice names the flag change, and the correction is the tip`, async () => {
      const dir = folder("project");
      c.action(dir);
      const json = await init(dir, ["--root", dir, "--skip-make-docs", "--json"]);
      assert.equal(json.exit, 10, shape(json.stdout));
      const envelope = json.json!;
      assert.equal(envelope.result.make_docs, undefined);
      for (const text of strings(envelope)) assert.ok(!text.includes("--skip-make-docs and without"), text);
      if (c.reason === "paths_exist") {
        assert.equal(envelope.result.tip, "Move or back up these files, then run the same init command again.");
        assert.equal(envelope.diagnostics[0]!.correction, envelope.result.tip);
      }
      const human = await init(dir, ["--root", dir, "--skip-make-docs"]);
      assert.ok(!human.stdout.includes("--skip-make-docs and without"), human.stdout);
      assert.ok(RETRY.test(human.stdout), "the output still advises a retry");
    });
  }

  it("a Make Docs run that did not finish: the retry advice says --skip-make-docs too", async () => {
    const dir = folder("project");
    const json = await init(dir, ["--root", dir, "--make-docs", "--json"], { process: makeDocs((target) => writeFileSync(join(target, "workspace"), "x\n"), 1) });
    assert.equal(json.exit, 10, shape(json.stdout));
    assert.equal(json.json!.result.make_docs?.status, "failed");
    for (const text of strings(json.json).filter((t) => RETRY.test(t))) assertIncludes(text, FLAG_CHANGE);
  });
});

describe("finding 3: every shown Windows command with a folder carries the command-aware label", () => {
  it("runWords: the label on Windows, with delayed expansion off for a !; the plain words elsewhere", () => {
    assert.equal(runWords("win32", 'buildos init --root "C:\\a b"'), COMMAND_PROMPT_LABEL);
    assert.equal(runWords("win32", 'buildos init --root "C:\\a!b"'), `${COMMAND_PROMPT_LABEL}, with delayed expansion off`);
    assert.equal(runWords("linux", "buildos init --root '/a!b'"), "run");
    assert.equal(runWords("darwin", "x", "run this"), "run this");
  });

  it("init on Windows in a folder with !: the choice lines and the Make Docs later line say delayed expansion off", async () => {
    const dir = folder("bang!it!");
    const stop = await init(dir, ["--root", dir], { platform: "win32" });
    assert.equal(stop.exit, 10, shape(stop.stdout));
    assertIncludes(stop.stdout, "\nIf the user says yes, run this in Command Prompt, with delayed expansion off:\n");
    assertIncludes(stop.stdout, "\nIf the user says no, run this in Command Prompt, with delayed expansion off:\n");
    const plain = folder("plain");
    const plainStop = await init(plain, ["--root", plain], { platform: "win32" });
    assertIncludes(plainStop.stdout, "\nIf the user says yes, run this in Command Prompt:\n");
    // An adopted project with no root router files: Make Docs can be set up later, so the later command is shown.
    const adopted = folder("adopt!ed");
    cpSync(FIXTURE, adopted, { recursive: true });
    rmSync(join(adopted, "AGENTS.md"));
    rmSync(join(adopted, "CLAUDE.md"));
    const later = await init(adopted, ["--root", adopted, "--skip-make-docs"], { platform: "win32" });
    assert.equal(later.exit, 0, shape(later.stdout));
    assertIncludes(later.stdout, "To set it up later, run this in Command Prompt, with delayed expansion off:\n");
    const failed = await init(dir, ["--root", dir, "--make-docs"], { platform: "win32", process: makeDocs(() => {}, 1) });
    assertIncludes(failed.stdout, "To try Make Docs again, run this in Command Prompt, with delayed expansion off:\n");
  });

  it("no source file spells the Windows label itself: each shown command gets it from run-command.ts", () => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".ts") && relative(SRC, path) !== join("core", "shared", "run-command.ts") && /["'`]run this in Command Prompt/.test(readFileSync(path, "utf8"))) found.push(relative(SRC, path));
      }
    };
    walk(SRC);
    assert.deepEqual(found, []);
  });
});
