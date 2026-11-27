// W1 R7 P7 review round 2 (P7-R2-01 and P7-R2-03): every domain against the
// real output of `buildos init --skip-make-docs` (no `docs/`, by design), and
// against that output with the committed Make Docs 2.0.9 companion files. The
// project is made in the test by the built package (its packaged `system/`
// content), with no network and no `make-docs` program. The Make Docs setup
// command that a design promotion prints is run for real, through the shell
// the message names, against a stub that models Make Docs 2.0.9: it refuses a
// folder whose root AGENTS.md or CLAUDE.md holds no Make Docs section, and
// else writes the design inputs.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { isInstalledLayout } from "../src/core/shared/buildos-layout.ts";
import { assertOutputDoesNotMatch, assertOutputMatches, assertSame, shape } from "./helpers.ts";

const windows = process.platform === "win32";
const COMPANION = join(import.meta.dirname, "fixtures", "make-docs-companion");
const DESIGN_FIXTURE = join(import.meta.dirname, "fixtures", "golden", "design-installed");
const DISCOVERY_FIXTURE = join(import.meta.dirname, "fixtures", "golden", "discovery-installed");
const MAKE_DOCS_BEGIN = "<!-- make-docs:begin -->";
const COMPANION_FILES = ["docs/designs/AGENTS.md", ".make-docs/system/references/design-workflow.md", ".make-docs/system/contracts/design-contract.md", ".make-docs/system/templates/design.md", ".make-docs/system/prompts/designs-to-plan.prompt.md", ".make-docs/system/prompts/designs-to-plan-change.prompt.md"];

let scratch: string;
let cli: string;
let stub: string;
let counter = 0;

before(
  async () => {
    scratch = mkdtempSync(join(tmpdir(), "buildos-installed-"));
    cli = await bundle({ outfile: join(scratch, "dist", "buildos.js") });
    stub = makeMakeDocsStub();
  },
  { timeout: 120_000 },
);
after(() => rmSync(scratch, { recursive: true, force: true }));

/**
 * A stub `npx` (the program of the command BuildOS prints) that models Make
 * Docs 2.0.9 setup, as observed with Make Docs 2.0.9 (W1 R7 P7 review rounds
 * 2 and 3). It records each call, then:
 *
 * - a root AGENTS.md or CLAUDE.md that holds no `<!-- make-docs:begin -->`
 *   line: exit 1, as 2.0.9 does after `buildos init --skip-make-docs`;
 * - a `.stub-copied` file in the target (a project folder that was copied or
 *   moved; Make Docs keeps the checkout identity in its Store): exit 0 with
 *   `"status": "blocked"` and "Checkout identity needs a path choice.", and
 *   nothing written (P7-R3-05);
 * - one of the six design inputs there but empty (a changed managed file):
 *   exit 0 with `"status": "blocked"`, the file `skip-conflict`, and nothing
 *   written (P7-R3-05);
 * - else it writes each missing design input (the committed byte copy) and
 *   `.make-docs/config.yaml` under `--target`, and exits 0 with
 *   `"status": "complete"`.
 */
function makeMakeDocsStub(): string {
  const dir = join(scratch, "stub");
  mkdirSync(dir, { recursive: true });
  const script = join(dir, "stub.cjs");
  writeFileSync(
    script,
    `const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, "calls.jsonl"), JSON.stringify(args) + "\\n");
const target = args[args.indexOf("--target") + 1];
for (const name of ["AGENTS.md", "CLAUDE.md"]) {
  const file = path.join(target, name);
  if (fs.existsSync(file) && !fs.readFileSync(file, "utf8").includes(${JSON.stringify(MAKE_DOCS_BEGIN)})) {
    process.stdout.write(JSON.stringify({ ok: false, code: "operation-error", message: "This target requires an explicit backup-and-reinstall migration flow before make-docs can write changes." }));
    process.exit(1);
  }
}
if (fs.existsSync(path.join(target, ".stub-copied"))) {
  process.stdout.write(JSON.stringify({ schemaVersion: 2, operation: "setup", status: "blocked", failedCondition: "Checkout identity needs a path choice." }));
  process.exit(0);
}
const files = ${JSON.stringify(COMPANION_FILES)};
const changed = files.filter((rel) => fs.existsSync(path.join(target, rel)) && fs.readFileSync(path.join(target, rel)).length === 0);
if (changed.length > 0) {
  process.stdout.write(JSON.stringify({ schemaVersion: 2, operation: "setup", status: "blocked", project: { actions: changed.map((p) => ({ path: p, action: "skip-conflict" })) } }));
  process.exit(0);
}
for (const rel of files) {
  const dest = path.join(target, rel);
  if (fs.existsSync(dest)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(${JSON.stringify(COMPANION)}, rel), dest);
}
fs.writeFileSync(path.join(target, ".make-docs", "config.yaml"), "resourceProjection: [ contract, prompt, reference, template ]\\n");
process.stdout.write(JSON.stringify({ schemaVersion: 2, operation: "setup", status: "complete" }));
`,
  );
  if (windows) {
    writeFileSync(join(dir, "npx.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
  } else {
    writeFileSync(join(dir, "npx"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
    chmodSync(join(dir, "npx"), 0o755);
  }
  return dir;
}

function stubCalls(): string[][] {
  const file = join(stub, "calls.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as string[]) : [];
}

function buildos(args: string[], cwd = scratch): { exit: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** A new project made by the built package's `buildos init --skip-make-docs`. */
function initSkipMakeDocs(): string {
  const root = join(scratch, `p${++counter}`);
  mkdirSync(root);
  const out = buildos(["init", "--skip-make-docs", "--root", root]);
  assert.equal(out.exit, 0, out.stderr);
  assert.ok(!existsSync(join(root, "docs")), "init --skip-make-docs writes no docs/ folder");
  assert.ok(existsSync(join(root, ".os", "manifest.json")));
  return root;
}

/** The design fixture's qualified finding and its data, laid over a project. */
function addFindingData(root: string): void {
  cpSync(join(DESIGN_FIXTURE, ".os", "data"), join(root, ".os", "data"), { recursive: true });
  cpSync(join(DESIGN_FIXTURE, "workspace", "findings"), join(root, "workspace", "findings"), { recursive: true });
}

const PROMOTE = ["design", "promote", "finding", "--finding-id", "FIND-001", "--route", "change-plan", "--slug", "keep-tax", "--dry-run"];

/** The command a stop message shows after `run this[ in Command Prompt], then run this command again: `. */
function shownCommand(stderr: string): string {
  const match = /then run this command again: (.+)\n$/.exec(stderr);
  assert.ok(match !== null, stderr);
  return match[1]!;
}

/** Runs a shown command in the shell the message names, with the stub first on PATH. */
function runShown(command: string, cwd: string): number | null {
  const PATH = [stub, process.env["PATH"] ?? ""].join(delimiter);
  const env = { ...process.env, PATH };
  const result = windows
    ? spawnSync(process.env["ComSpec"] ?? "cmd.exe", ["/d", "/s", "/c", `"${command}"`], { cwd, env, encoding: "utf8", windowsVerbatimArguments: true })
    : spawnSync("/bin/sh", ["-c", command], { cwd, env, encoding: "utf8" });
  return result.status;
}

describe("the installed-root rule (P7-R2-01)", () => {
  const probe = (entries: Record<string, "file" | "directory">) => (rel: string) => entries[rel];
  it("decides from .os/, system/.os/, and the init manifest, and keeps Go's five-folder rule", () => {
    const five = { ".os": "directory", assets: "directory", docs: "directory", playbooks: "directory", workspace: "directory" } as const;
    assert.equal(isInstalledLayout(probe(five)), true, "Go's rule");
    assert.equal(isInstalledLayout(probe({ ...five, "system/.os": "directory" })), true, "Go's rule wins over a system/ child");
    assert.equal(isInstalledLayout(probe({ ".os": "directory", assets: "directory", playbooks: "directory", workspace: "directory" })), true, "init --skip-make-docs: no docs/");
    assert.equal(isInstalledLayout(probe({ ".os": "directory" })), true, "a root .os/ alone");
    assert.equal(isInstalledLayout(probe({ "system/.os": "directory" })), false, "a source checkout");
    assert.equal(isInstalledLayout(probe({ ".os": "directory", "system/.os": "directory" })), false, "both, no manifest: source, as Go");
    assert.equal(isInstalledLayout(probe({ ".os": "directory", "system/.os": "directory", ".os/manifest.json": "file" })), true, "both, with the init manifest: installed");
    assert.equal(isInstalledLayout(probe({ ".os": "directory", "system/.os": "directory", ".os/manifest.json": "directory" })), false, "a folder is not the manifest");
    assert.equal(isInstalledLayout(probe({ ".os": "file" })), false, "a file named .os");
    assert.equal(isInstalledLayout(probe({})), false, "neither: the source layout, whose first read fails as in Go");
  });
});

describe("every domain on real buildos init --skip-make-docs output (P7-R2-01)", () => {
  it("entities validate reads the project's .os/data/", () => {
    const root = initSkipMakeDocs();
    const out = buildos(["entities", "validate", "--root", root, "--mode", "compat", "--json"]);
    assert.equal(out.exit, 0, shape(out.stdout + out.stderr));
  });

  it("intake index playbooks reads playbooks/ and writes .os/indexes/playbooks.json, equal to the packaged index", () => {
    const root = initSkipMakeDocs();
    const before = readFileSync(join(root, ".os", "indexes", "playbooks.json"));
    const out = buildos(["intake", "index", "playbooks", "--repo-root", root]);
    assert.equal(out.exit, 0, shape(out.stderr));
    assert.ok(!existsSync(join(root, "system")), "nothing is written under a system/ folder");
    assertSame(readFileSync(join(root, ".os", "indexes", "playbooks.json")), before);
  });

  it("a discovery dry run reads .os/indexes/playbooks.json and .os/data/", () => {
    const root = initSkipMakeDocs();
    cpSync(join(DISCOVERY_FIXTURE, ".os", "indexes", "playbooks.json"), join(root, ".os", "indexes", "playbooks.json"));
    cpSync(join(DISCOVERY_FIXTURE, ".os", "data"), join(root, ".os", "data"), { recursive: true });
    cpSync(join(DISCOVERY_FIXTURE, "inputs"), join(root, "inputs"), { recursive: true });
    const out = buildos(["discovery", "run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--evidence", "inputs/evidence/checkout-notes.txt", "--raw-finding", "inputs/raw/raw-1.md", "--dry-run"]);
    assert.equal(out.exit, 0, shape(out.stderr));
    assertOutputMatches(out.stdout, /^would write workspace\/runs\/RUN-003\/ \(RUN-003\)\n/);
    assertOutputDoesNotMatch(out.stdout, /system\//);
  });

  it("validate passes", () => {
    const root = initSkipMakeDocs();
    const out = buildos(["validate", "--root", root]);
    assert.equal(out.exit, 0, shape(out.stdout + out.stderr));
  });

  it("a design promotion stops truthfully: Make Docs 2.0.9 cannot be set up here, so no setup command is shown", () => {
    const root = initSkipMakeDocs();
    addFindingData(root);
    const human = buildos([...PROMOTE, "--repo-root", root]);
    assert.equal(human.exit, 3, shape(human.stderr));
    assertSame(human.stderr, "buildos-design: error: the Make Docs design router docs/designs/AGENTS.md is missing, so BuildOS cannot write the design. Make Docs is not set up in this folder, and it cannot be set up here. This Make Docs version does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write. This folder has such a file: AGENTS.md and CLAUDE.md. BuildOS changed nothing.\n");
    assertOutputDoesNotMatch(human.stderr, /npx|make-docs setup/);
    const json = buildos([...PROMOTE, "--repo-root", root, "--json"]);
    const diagnostic = (JSON.parse(json.stdout) as { diagnostics: { code: string; correction: string }[] }).diagnostics[0]!;
    assert.equal(json.exit, 3);
    assert.equal(diagnostic.code, "make_docs_setup_blocked");
    assert.doesNotMatch(diagnostic.correction, /npx|make-docs setup/);
    // The setup command init would show is known to fail here: the stub (Make Docs 2.0.9) refuses this folder.
    const calls = stubCalls().length;
    assertSame(runShown(`npx -y @brucewaynedecoy/make-docs setup --target ${JSON.stringify(root)}`, root), 1);
    assert.equal(stubCalls().length, calls + 1);
  });

  it("with the Make Docs 2.0.9 companion files laid over it, validate passes and a promotion dry run succeeds", () => {
    const root = initSkipMakeDocs();
    cpSync(COMPANION, root, { recursive: true });
    const validate = buildos(["validate", "--root", root]);
    assert.equal(validate.exit, 0, shape(validate.stdout));
    addFindingData(root);
    const out = buildos([...PROMOTE, "--repo-root", root]);
    assert.equal(out.exit, 0, shape(out.stderr));
    assertOutputMatches(out.stdout, /^would write docs\/designs\/\d{4}-\d{2}-\d{2}-keep-tax\.md \(requested=FIND-001 canonical=FIND-001 chain=\[FIND-001\]\)\n$/);
  });
});

describe("the printed Make Docs command works where BuildOS shows one (P7-R2-03)", () => {
  /** The init output with root routers that Make Docs 2.0.9 accepts: each holds a Make Docs section, as after init --make-docs. */
  function withMakeDocsRouters(root: string): void {
    for (const name of ["AGENTS.md", "CLAUDE.md"]) {
      const file = join(root, name);
      writeFileSync(file, `${MAKE_DOCS_BEGIN}\n# Make Docs\n<!-- make-docs:end -->\n\n${readFileSync(file, "utf8")}`);
    }
  }

  it("Make Docs set up, one file missing: the shown repair command puts it back, and the promotion then succeeds", () => {
    const root = initSkipMakeDocs();
    addFindingData(root);
    withMakeDocsRouters(root);
    cpSync(COMPANION, root, { recursive: true });
    rmSync(join(root, ".make-docs", "system", "templates", "design.md"));
    const stop = buildos([...PROMOTE, "--repo-root", root]);
    assert.equal(stop.exit, 3);
    const run = windows ? "run this in Command Prompt" : "run this";
    assert.ok(stop.stderr.startsWith(
        `buildos-design: error: the Make Docs design template .make-docs/system/templates/design.md is missing, so BuildOS cannot write the design. Make Docs is set up in this folder, but this file is missing. If this project folder was copied or moved, Make Docs stops that command with "Checkout identity needs a path choice." and gives its own next step; do that step first. To put the Make Docs files back, ${run}, then run this command again: npx -y @brucewaynedecoy/make-docs@`,
      ), shape(stop.stderr));
    const command = shownCommand(stop.stderr);
    assert.equal(runShown(command, scratch), 0);
    const call = stubCalls().at(-1)!;
    assertSame(call[call.indexOf("--target") + 1], root, "the command targets the project folder");
    assert.equal(buildos([...PROMOTE, "--repo-root", root]).exit, 0);
  });

  it("P7-R3-05: Make Docs set up, one file empty: the command alone is blocked (as Make Docs 2.0.9), and the shown steps (delete, then the command) repair it", () => {
    const root = initSkipMakeDocs();
    addFindingData(root);
    withMakeDocsRouters(root);
    cpSync(COMPANION, root, { recursive: true });
    const template = join(root, ".make-docs", "system", "templates", "design.md");
    writeFileSync(template, "");
    const stop = buildos([...PROMOTE, "--repo-root", root]);
    assert.equal(stop.exit, 3);
    assertOutputMatches(stop.stderr, /design\.md is empty, so BuildOS cannot write the design\. Make Docs keeps a changed copy of a file it manages, and BuildOS does not change this file either\./);
    // F-P8-11 review round 3 (finding 1): run from another folder with --repo-root, the file to delete is the one in the project.
    assert.ok(stop.stderr.includes(` To get the Make Docs file back, delete ${template}, then run this`), shape(stop.stderr));
    assertOutputDoesNotMatch(stop.stderr, /delete \.make-docs/);
    assertOutputDoesNotMatch(stop.stderr, /missing/);
    const command = shownCommand(stop.stderr);
    // The command alone does not repair an empty file: Make Docs 2.0.9 exits 0 with status blocked and keeps it.
    assert.equal(runShown(command, scratch), 0);
    assert.equal(readFileSync(template).length, 0);
    assert.equal(buildos([...PROMOTE, "--repo-root", root]).exit, 3);
    // The steps the message gives: delete the file, then the command.
    rmSync(template);
    assert.equal(runShown(command, scratch), 0);
    assert.ok(readFileSync(template).length > 0);
    assert.equal(buildos([...PROMOTE, "--repo-root", root]).exit, 0);
  });

  it("P7-R3-05: a copied project: the message says what Make Docs answers there and does not promise the command works", () => {
    const root = initSkipMakeDocs();
    addFindingData(root);
    withMakeDocsRouters(root);
    cpSync(COMPANION, root, { recursive: true });
    writeFileSync(join(root, ".stub-copied"), "");
    rmSync(join(root, ".make-docs", "system", "templates", "design.md"));
    const stop = buildos([...PROMOTE, "--repo-root", root]);
    assert.equal(stop.exit, 3);
    assertOutputMatches(stop.stderr, /If this project folder was copied or moved, Make Docs stops that command with "Checkout identity needs a path choice\." and gives its own next step; do that step first\./);
    assertSame(runShown(shownCommand(stop.stderr), scratch), 0);
    assert.ok(!existsSync(join(root, ".make-docs", "system", "templates", "design.md")), "Make Docs 2.0.9 writes nothing in a copied project");
    assert.equal(buildos([...PROMOTE, "--repo-root", root]).exit, 3);
  });

  it("Make Docs not set up, no root routers: the shown setup command sets it up, and the promotion then succeeds", () => {
    const root = initSkipMakeDocs();
    addFindingData(root);
    rmSync(join(root, "AGENTS.md"));
    rmSync(join(root, "CLAUDE.md"));
    const stop = buildos([...PROMOTE, "--repo-root", root, "--json"]);
    assert.equal(stop.exit, 3);
    const diagnostic = (JSON.parse(stop.stdout) as { diagnostics: { code: string; message: string; correction: string }[] }).diagnostics[0]!;
    assert.equal(diagnostic.code, "make_docs_not_set_up");
    assertOutputMatches(diagnostic.message, /Make Docs is not set up in this folder\. To set up Make Docs, /);
    const command = /then run this command again: (.+)$/.exec(diagnostic.correction)![1]!;
    assert.equal(runShown(command, scratch), 0);
    assert.equal(buildos([...PROMOTE, "--repo-root", root]).exit, 0);
  });

  it("repository layout: the message names system/.make-docs/ and the command targets system/, where the files go", () => {
    const work = join(scratch, `repo${++counter}`);
    const root = join(work, "checkout");
    mkdirSync(join(root, "system"), { recursive: true });
    cpSync(join(DESIGN_FIXTURE, ".os"), join(root, "system", ".os"), { recursive: true });
    cpSync(join(DESIGN_FIXTURE, "workspace"), join(root, "system", "workspace"), { recursive: true });
    // The installed fixture's anchors are installed paths; the repository layout reads them under system/.
    const stop = buildos([...PROMOTE, "--repo-root", root]);
    assert.equal(stop.exit, 3, stop.stderr);
    assert.match(stop.stderr, /the Make Docs design router system\/docs\/designs\/AGENTS\.md is missing, /);
    const command = shownCommand(stop.stderr);
    assert.equal(runShown(command, scratch), 0);
    const call = stubCalls().at(-1)!;
    assert.equal(call[call.indexOf("--target") + 1], join(root, "system"));
    assert.ok(existsSync(join(root, "system", ".make-docs", "system", "templates", "design.md")));
  });
});
