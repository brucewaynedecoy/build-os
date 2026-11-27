// W1 R7 P6 Stages 3 and 4: `buildos init` through the built bundle (with its
// packaged `system/` content), on every operating system. Make Docs is
// always a stub on a controlled PATH; the real Make Docs runs only in the CI
// contract job (t23).
//
// A43 adoption byte check, A44 dry run, A44a existing files and clashes, A45
// no walk-up, A46 new project tree, A47 no TTY, A48 Yes, A49 Make Docs
// failure and retry, plus injected Yes and No answers through `run`.
//
// The shared files (owner decision 2026-11-24): `AGENTS.md`, `CLAUDE.md`,
// and `.gitignore` get a marked BuildOS section; lines outside it, line
// breaks, a BOM, and a missing final line break stay; a run again is
// idempotent; malformed markers, a link, or a too-large file stop before any
// write; a failure undoes every section write; Make Docs runs before BuildOS
// writes anything.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, relative, sep } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { WRAPPER_FILES } from "../src/core/init/content.ts";
import { MAKE_DOCS_RANGE } from "../src/core/init/make-docs-range.ts";
import { makeDocsSetupArgs } from "../src/core/init/make-docs.ts";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import { SHARED_FILE_MAX_BYTES, SHARED_PATHS } from "../src/core/init/shared-files.ts";
import type { FsPortFactory } from "../src/core/shared/fs-port.ts";
import { run } from "../src/cli/run.ts";
import type { ProcessPort } from "../src/core/shared/process-port.ts";
import { assertOutputDoesNotMatch, assertOutputMatches, assertSame, assertSameList, assertSameTree, buildosSection, captureIo, shape, tag } from "./helpers.ts";

const windows = process.platform === "win32";
/** The words before each shown command: Windows names its shell (Command Prompt), as the product prints it. */
const RUN = windows ? "run this in Command Prompt" : "run";
const FIXTURE = join(import.meta.dirname, "fixtures", "init", "go-era-project");
const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const TIP = "Move or back up these files, then run the same init command again.";

let scratch: string;
let cli: string;
let stubs: { working: string; failing: string; none: string; npxOnly: string };

before(
  async () => {
    scratch = mkdtempSync(join(tmpdir(), "buildos-init-"));
    cli = await bundle({ outfile: join(scratch, "dist", "buildos.js") });
    stubs = { working: makeStub("working", 0), failing: makeStub("failing", 1), none: mkdirIn("stubs-none"), npxOnly: makeStub("npx-only", 0, "npx") };
  },
  { timeout: 60_000 },
);
after(() => rmSync(scratch, { recursive: true, force: true }));

function mkdirIn(name: string): string {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * A stub program (`make-docs` or `npx`) on its own folder. It records its
 * arguments (JSON, one run per line) in `<folder>/calls.jsonl`. Exit 0: it
 * writes `docs/README.md` and `.make-docs/config.yaml` under `--target`, as
 * only Make Docs may, and prints `{"status":"complete"}`. Exit 1: it prints a
 * Make Docs-style error on stderr and writes nothing.
 */
function makeStub(name: string, code: number, program = "make-docs"): string {
  const dir = mkdirIn(`stubs-${name}`);
  const script = join(dir, "stub.cjs");
  writeFileSync(
    script,
    `const fs = require("fs"), path = require("path");
fs.appendFileSync(path.join(__dirname, "calls.jsonl"), JSON.stringify(process.argv.slice(2)) + "\\n");
const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
if (${code} === 0) {
  fs.mkdirSync(path.join(target, "docs"), { recursive: true });
  fs.writeFileSync(path.join(target, "docs", "README.md"), "docs\\n");
  fs.mkdirSync(path.join(target, ".make-docs"), { recursive: true });
  fs.writeFileSync(path.join(target, ".make-docs", "config.yaml"), "x: 1\\n");
  process.stdout.write(JSON.stringify({ schemaVersion: 2, operation: "setup", status: "complete" }));
} else {
  process.stderr.write(JSON.stringify({ ok: false, code: "operation-error", message: "This target requires manual review.\\nMore detail." }));
}
process.exit(${code});
`,
  );
  if (windows) {
    writeFileSync(join(dir, `${program}.cmd`), `@"${process.execPath}" "${script}" %*\r\n`);
  } else {
    writeFileSync(join(dir, program), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
    chmodSync(join(dir, program), 0o755);
  }
  return dir;
}

function calls(stubDir: string): string[][] {
  const file = join(stubDir, "calls.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as string[]) : [];
}

function env(stubDir: string): NodeJS.ProcessEnv {
  const path = windows ? [stubDir, join(process.env["SystemRoot"] ?? "C:\\Windows", "System32")].join(delimiter) : stubDir;
  return { PATH: path, SystemRoot: process.env["SystemRoot"], PATHEXT: ".COM;.EXE;.BAT;.CMD", HOME: scratch, TEMP: scratch, TMP: scratch };
}

function init(cwd: string, args: string[], stubDir = stubs.none) {
  const result = spawnSync(process.execPath, [cli, "init", ...args], { cwd, env: { ...env(stubDir), PWD: cwd }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr };
}

let counter = 0;
function folder(name = "project"): string {
  const dir = join(scratch, `case-${++counter}`, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Every entry under `dir`: a file's mode (POSIX) and SHA-256, a link's text, a folder. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      const rel = relative(dir, full).split(sep).join("/");
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) out.set(rel, `link ${readlinkSync(full)}`);
      else if (stat.isDirectory()) {
        out.set(`${rel}/`, "folder");
        walk(full);
      } else out.set(rel, `file ${windows ? "" : (stat.mode & 0o7777).toString(8)} ${createHash("sha256").update(readFileSync(full)).digest("hex")}`);
    }
  };
  walk(dir);
  return out;
}

const packagePaths = () => loadSourceContent(SYSTEM).files.map((f) => f.path).filter((p) => !SHARED_PATHS.has(p));
const packageText = (path: string) => readFileSync(join(SYSTEM, path), "utf8");

/** The BuildOS section of `path` as `buildos init` writes it, with `eol` line breaks and `last` at its end. */
function section(path: string, eol = "\n", last = eol): string {
  return buildosSection(packageText(path), { gitignore: path === ".gitignore", eol, last });
}

describe("buildos init: new project (A44, A46)", () => {
  it("A44: --dry-run in an empty folder lists the folder and every planned path, writes nothing, and exits 0", () => {
    const dir = folder();
    const human = init(dir, ["--dry-run"]);
    assert.equal(human.exit, 0, shape(human.stderr));
    assertSame(human.stdout.split("\n")[0], `Project folder: ${dir}`);
    assertOutputMatches(human.stdout.split("\n")[1] ?? "", /^Dry run\. Nothing was changed\./);
    for (const path of [...packagePaths(), ".os/manifest.json", ".os/skills/"]) assertOutputMatches(human.stdout, new RegExp(`\\n  add      ${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n`), path);
    assert.ok(human.stdout.includes("\n\nShared files. BuildOS changes only its own section of these files, between its buildos:begin and buildos:end lines, and only when that section is still exactly as BuildOS wrote it.\n  add      AGENTS.md (a new file with only the BuildOS section)\n  add      CLAUDE.md (a new file with only the BuildOS section)\n  add      .gitignore (a new file with only the BuildOS section)\n"), shape(human.stdout));
    const json = init(dir, ["--dry-run", "--json"]);
    assert.equal(json.exit, 0);
    const envelope = JSON.parse(json.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.root, dir);
    assert.equal(envelope.write_status, "planned");
    assert.equal(envelope.result.status, "planned");
    const planned = envelope.result.planned.map((p: { path: string }) => p.path);
    for (const path of [...packagePaths(), ".os/manifest.json", ".os/skills/"]) assert.ok(planned.includes(path), tag(String(path)));
    for (const path of SHARED_PATHS) assert.ok(!planned.includes(path), tag(String(path)));
    assertSame(envelope.result.shared_files, [
      { path: "AGENTS.md", action: "create" },
      { path: "CLAUDE.md", action: "create" },
      { path: ".gitignore", action: "create" },
    ]);
    assert.deepEqual(readdirSync(dir), []);
  });

  it("A46: --skip-make-docs makes .os/, assets/, playbooks/, workspace/, the manifest, and no docs/ or .make-docs/", () => {
    const dir = folder();
    const result = init(dir, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    assertSame(result.stderr, "");
    for (const path of [".os", "assets", "playbooks", "workspace", ".os/skills", ".os/scripts"]) assert.ok(lstatSync(join(dir, path)).isDirectory(), tag(String(path)));
    assert.equal(existsSync(join(dir, "docs")), false);
    assert.equal(existsSync(join(dir, ".make-docs")), false);
    const manifest = JSON.parse(readFileSync(join(dir, ".os", "manifest.json"), "utf8"));
    assertSame(Object.keys(manifest), ["schema_version", "buildos_version", "initialized_at"]);
    assertSame(manifest.schema_version, 1);
    assertSame(manifest.buildos_version, "dev");
    assert.ok(!Number.isNaN(Date.parse(manifest.initialized_at)));
    // Every package file arrived byte for byte, with `.gitignore` under its own name;
    // each shared file holds only its BuildOS section.
    for (const file of loadSourceContent(SYSTEM).files) {
      if (SHARED_PATHS.has(file.path)) assertSame(readFileSync(join(dir, file.path), "utf8"), section(file.path), tag(String(file.path)));
      else assertSame(new Uint8Array(readFileSync(join(dir, file.path))), file.data, tag(String(file.path)));
    }
    assert.ok(existsSync(join(dir, ".gitignore")));
    assertOutputMatches(result.stdout, /\n\nShared files\. BuildOS changes only its own section of these files, between its buildos:begin and buildos:end lines, and only when that section is still exactly as BuildOS wrote it\.\n {2}AGENTS\.md: created, with only the BuildOS section\n {2}CLAUDE\.md: created, with only the BuildOS section\n {2}\.gitignore: created, with only the BuildOS section\n/);
    if (!windows) assert.equal(lstatSync(join(dir, ".os", "scripts", "buildos")).mode & 0o111, 0o111);
    assert.ok(result.stdout.endsWith(
        "\n\nDone. BuildOS is set up in this folder.\nMake Docs: not set up, as chosen. With this Make Docs version, Make Docs cannot be set up in this folder later. This Make Docs version does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write.\n",
      ), shape(result.stdout));
    // UX note (review round 1): with a flag, the shared files are listed once, in the result.
    assert.equal(result.stdout.split("Shared files.").length, 2);
  });

  it("A45: from a child folder of a set-up project, init --dry-run targets the child folder, not the parent", () => {
    const parent = folder();
    assert.equal(init(parent, ["--skip-make-docs"]).exit, 0);
    const child = join(parent, "workspace", "runs", "deep");
    mkdirSync(child, { recursive: true });
    const result = JSON.parse(init(child, ["--dry-run", "--json"]).stdout);
    assertSame(result.root, child);
    assertSame(result.result.setup, "new_project");
  });
});

describe("buildos init: a folder with other files (A44a)", () => {
  it("adds the BuildOS files next to unrelated files and leaves each one byte for byte", () => {
    const dir = folder();
    writeFileSync(join(dir, "README.md"), "my project\n");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "app.js"), "console.log(1)\n");
    mkdirSync(join(dir, "playbooks"));
    writeFileSync(join(dir, "playbooks", "my-own.md"), "mine\n");
    const before = snapshot(dir);
    const result = init(dir, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    const after = snapshot(dir);
    for (const [path, value] of before) assertSame(after.get(path), value, tag(String(path)));
    assert.ok(existsSync(join(dir, ".os", "manifest.json")));
  });

  it("writes nothing and exits 10 when a planned path exists, and lists every clash with the tip in both outputs", () => {
    const dir = folder();
    // The shared files never clash: only `workspace` and `assets/AGENTS.md` do.
    writeFileSync(join(dir, "AGENTS.md"), "mine\n");
    writeFileSync(join(dir, ".gitignore"), "mine\n");
    writeFileSync(join(dir, "workspace"), "a file where a folder goes\n");
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "AGENTS.md"), "mine\n");
    const before = snapshot(dir);
    const human = init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 10);
    assertSame(human.stdout, `Project folder: ${dir}\nStopped. Nothing was changed. 2 paths that BuildOS must add are already in this folder.\n\nThese paths are already here:\n  workspace\n  assets/AGENTS.md\n\n${TIP}\n`);
    const json = init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(json.exit, 10);
    const envelope = JSON.parse(json.stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.result.status, "stopped");
    assertSame(envelope.result.reason, "paths_exist");
    assertSame(envelope.result.problems, []);
    assertSame(envelope.result.clashes.map((c: { path: string }) => c.path), ["workspace", "assets/AGENTS.md"]);
    assertSame(envelope.result.tip, TIP);
    assert.equal(envelope.diagnostics[0].code, "init_paths_exist");
    assertSameTree(snapshot(dir), before, "project tree");
  });
});

describe("buildos init: adoption of a Go-era project (A43)", () => {
  it("changes no pre-existing file outside the adoption set and adds only allowed paths", () => {
    const dir = folder("go-era");
    cpSync(FIXTURE, dir, { recursive: true });
    if (!windows) {
      chmodSync(join(dir, ".os", "scripts", "legacy-tool.sh"), 0o755);
      symlinkSync("references/sample/twin.md", join(dir, "assets", "latest-twin.md"));
    }
    const before = snapshot(dir);
    const result = init(dir, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    assertOutputMatches(result.stdout, /\nDone\. BuildOS adopted this existing project\.\nYour project data was not changed\./);
    const after = snapshot(dir);
    const allowed = new Set([".os/manifest.json", ...WRAPPER_FILES, ".os/skills/"]);
    const isAllowed = (path: string) => allowed.has(path) || path.startsWith(".os/skills/");
    const changed = [...before].filter(([path, value]) => after.get(path) !== value).map(([path]) => path);
    const added = [...after.keys()].filter((path) => !before.has(path));
    assertSameList(changed.filter((p) => !isAllowed(p)), [], "pre-existing files outside the adoption set changed");
    assertSameList(added.filter((p) => !isAllowed(p)), [], "paths outside the adoption set were added");
    assertSameList(changed.sort(), [".os/scripts/buildos", ".os/scripts/buildos-design", ".os/scripts/buildos-discovery", ".os/scripts/buildos-intake"], "changed paths");
    // W1 R7 P7 t11: the adoption adds every packaged skill file and its folders under .os/skills/.
    const skillFiles = packagePaths().filter((p) => p.startsWith(".os/skills/"));
    const skillFolders = new Set(skillFiles.flatMap((p) => p.split("/").slice(2, -1).map((_, i, parts) => `.os/skills/${parts.slice(0, i + 1).join("/")}/`)));
    assert.ok(skillFiles.includes(".os/skills/AGENTS.md"));
    assertSameList(added.sort(), [...[...allowed].filter((p) => !before.has(p)), ...skillFiles, ...skillFolders].sort(), "added paths");
    // The report of the byte check, for the evidence report: counts only, never the path list (P7S-R1-03).
    console.log(`adoption byte check (${process.platform}): ${before.size} entries before, ${changed.length} changed (all wrappers), ${added.length} added (${skillFiles.length} skill files, ${skillFolders.size} skill folders)`);
  });
});

describe("buildos init: the legacy Python validator (W1 R7 P7 t16)", () => {
  it("the package no longer ships it, and an adoption keeps a Go-era copy byte for byte", () => {
    const fresh = folder("fresh");
    assert.equal(init(fresh, ["--skip-make-docs"]).exit, 0);
    assert.equal(existsSync(join(fresh, ".os", "scripts", "validate_config.py")), false);

    const dir = folder("go-era-validator");
    cpSync(FIXTURE, dir, { recursive: true });
    // A stand-in for the file a Go-era project has (no real script is committed).
    const legacy = join(dir, ".os", "scripts", "validate_config.py");
    writeFileSync(legacy, "# a Go-era project's own copy of the earlier validator\n");
    const before = readFileSync(legacy);
    const result = init(dir, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    assertSame(readFileSync(legacy), before);
  });

  // W1 R7 P7 review round 1 (P7-R1-09): the user is told that the old script is no longer used.
  it("an adoption that finds it says so in plain words, in the human and JSON output, the dry run too, and changes nothing about it", () => {
    // F-P8-11 review round 2 (finding 1): the note names the project folder that the wrapper must run in.
    const note = (dir: string) => `.os/scripts/validate_config.py is the old Python config check. BuildOS no longer uses it. After adoption completes, in the project folder ${dir}, run .os/scripts/buildos validate instead (on Windows, .os\\scripts\\buildos.cmd validate). Where .os/scripts/AGENTS.md or your own notes name the old script, use that command instead. BuildOS left the file as it is. You can delete it.`;
    const make = (name: string): { dir: string; legacy: string } => {
      const dir = folder(name);
      cpSync(FIXTURE, dir, { recursive: true });
      const legacy = join(dir, ".os", "scripts", "validate_config.py");
      writeFileSync(legacy, "# a Go-era project's own copy of the earlier validator\n");
      return { dir, legacy };
    };
    const human = make("note-human");
    const before = readFileSync(human.legacy);
    const out = init(human.dir, ["--skip-make-docs"]);
    assert.equal(out.exit, 0, shape(out.stderr));
    assert.ok(out.stdout.includes(`\nNote: ${note(human.dir)}\n`), shape(out.stdout));
    assertSame(readFileSync(human.legacy), before);

    const json = make("note-json");
    const envelope = JSON.parse(init(json.dir, ["--skip-make-docs", "--json"]).stdout) as { result: { notes?: { code: string; path: string; message: string }[] } };
    assertSame(envelope.result.notes, [{ code: "legacy_validator_kept", path: ".os/scripts/validate_config.py", message: note(json.dir) }]);

    const dry = make("note-dry");
    const planned = init(dry.dir, ["--skip-make-docs", "--dry-run"]);
    assert.equal(planned.exit, 0, shape(planned.stderr));
    assert.ok(planned.stdout.includes(`Note: ${note(dry.dir)}`));

    // No old script: no note, and no notes key.
    const plain = folder("note-none");
    cpSync(FIXTURE, plain, { recursive: true });
    const none = JSON.parse(init(plain, ["--skip-make-docs", "--json"]).stdout) as { result: Record<string, unknown> };
    assertSame(Object.hasOwn(none.result, "notes"), false);
  });

  it("P7-R2-07: a folder or a link named validate_config.py is not the old validator: no note", () => {
    const dir = folder("note-folder");
    cpSync(FIXTURE, dir, { recursive: true });
    mkdirSync(join(dir, ".os", "scripts", "validate_config.py"));
    const result = JSON.parse(init(dir, ["--skip-make-docs", "--json", "--dry-run"]).stdout) as { result: Record<string, unknown> };
    assertSame(Object.hasOwn(result.result, "notes"), false);
    if (windows) return;
    const linked = folder("note-link");
    cpSync(FIXTURE, linked, { recursive: true });
    writeFileSync(join(linked, "elsewhere.py"), "# not in .os/scripts\n");
    symlinkSync(join(linked, "elsewhere.py"), join(linked, ".os", "scripts", "validate_config.py"));
    const viaLink = JSON.parse(init(linked, ["--skip-make-docs", "--json", "--dry-run"]).stdout) as { result: Record<string, unknown> };
    assertSame(Object.hasOwn(viaLink.result, "notes"), false);
  });
});

describe("buildos init: the Make Docs choice (A47 to A49, t24)", () => {
  it("A47: with no TTY and no flag, exits 10, writes nothing, and both outputs explain both choices with exact commands", () => {
    const dir = folder();
    const human = init(dir, []);
    assert.equal(human.exit, 10);
    assert.deepEqual(readdirSync(dir), []);
    const lines = human.stdout.split("\n");
    assertSame(lines[0], `Project folder: ${dir}`);
    assertSame(lines[1], "Stopped. Nothing was changed. BuildOS needs one answer from the user first.");
    assertOutputMatches(human.stdout, /It adds docs\/ folders for designs, plans, requirements, and work/);
    // Option A (orchestrator decision pending owner veto): the "later" text says what works with the pinned Make Docs version.
    assert.ok(human.stdout.includes(
        "If the user says no, Make Docs cannot be set up in this folder later with this Make Docs version: it does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write, and BuildOS adds such a file here.\n",
      ), shape(human.stdout));
    assertOutputMatches(human.stdout, new RegExp(`If the user says yes, ${RUN}:\\n {2}.+ --make-docs\\n`));
    assertOutputMatches(human.stdout, new RegExp(`If the user says no, ${RUN}:\\n {2}.+ --skip-make-docs\\n`));
    assertOutputDoesNotMatch(human.stdout, /make_docs_choice_needed|\[/);
    const json = init(dir, ["--json"]);
    assert.equal(json.exit, 10);
    const envelope = JSON.parse(json.stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.write_status, "not_requested");
    assertSame(envelope.result.reason, "make_docs_choice_needed");
    assertOutputMatches(envelope.result.about_make_docs, /docs\/ folder/);
    assertOutputMatches(envelope.result.later, /cannot be set up in this folder later/);
    assertSame(envelope.result.choices.map((c: { answer: string }) => c.answer), ["yes", "no"]);
    assertOutputMatches(envelope.result.choices[0].command, /init --root .* --make-docs --json$/);
    assertOutputMatches(envelope.result.choices[1].command, /init --root .* --skip-make-docs --json$/);
    // A53: the folder, the stopped state, and both choices come before any diagnostic code.
    const text = json.stdout;
    assert.ok(text.indexOf('"root"') < text.indexOf('"status": "stopped"'));
    assert.ok(text.indexOf('"choices"') < text.indexOf("make_docs_choice_needed"));
    assert.deepEqual(readdirSync(dir), []);
  });

  it("A47: in a folder with the user's own AGENTS.md, the no-TTY stop says Make Docs setup will not finish here, now or later", () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    const envelope = JSON.parse(init(dir, ["--json"]).stdout);
    assertSame(envelope.result.later, "This folder already has an AGENTS.md or CLAUDE.md file that Make Docs did not write. This Make Docs version does not set up such a folder, so Make Docs setup will not finish here, now or later. BuildOS setup finishes either way.");
  });

  it("A48: --make-docs runs make-docs from PATH with exactly the PRD 20 arguments, and only Make Docs writes docs/ and .make-docs/", () => {
    const dir = folder();
    const before = calls(stubs.working).length;
    const result = init(dir, ["--make-docs", "--json"], stubs.working);
    assert.equal(result.exit, 0, shape(result.stderr));
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.result.status, "complete");
    assert.equal(envelope.result.make_docs.status, "set_up");
    assert.deepEqual(calls(stubs.working).slice(before), [makeDocsSetupArgs(dir)]);
    assertSame(makeDocsSetupArgs(dir), ["setup", "--target", dir, "--codex-method", "none", "--claude-code-method", "none", "--no-github-copilot", "--no-skills", "--project-resources", "all", "--yes", "--json"]);
    assert.ok(envelope.result.written.every((w: { path: string }) => !/^(?:docs|\.make-docs)(?:\/|$)/.test(w.path)));
    assert.deepEqual(readdirSync(join(dir, "docs")), ["README.md"]);
    assertSame(readdirSync(join(dir, ".make-docs")), ["config.yaml"]);
  });

  it("uses npx with the pinned Make Docs range when make-docs is not on PATH", () => {
    const dir = folder();
    const before = calls(stubs.npxOnly).length;
    const result = init(dir, ["--make-docs", "--json"], stubs.npxOnly);
    assert.equal(result.exit, 0, shape(result.stderr));
    assert.deepEqual(calls(stubs.npxOnly).slice(before), [["-y", `@brucewaynedecoy/make-docs@${MAKE_DOCS_RANGE}`, ...makeDocsSetupArgs(dir)]]);
  });

  it("A49: a failing Make Docs still completes BuildOS setup (exit 0, partial), and the shown retry command works", () => {
    const dir = folder();
    const human = init(dir, ["--make-docs"], stubs.failing);
    assert.equal(human.exit, 0);
    assertSame(human.stderr, "Setting up Make Docs. This can take a minute.\n");
    assertOutputMatches(
      human.stdout,
      new RegExp(String.raw`\nPartly done\. BuildOS is set up in this folder, but Make Docs is not set up\.\nWhy: Make Docs stopped with exit code 1: This target requires manual review\.\nThis Make Docs version does not set up a folder that has an AGENTS\.md or CLAUDE\.md file that Make Docs did not write\. So with this version, the command below stops the same way in this folder\. It can work with a newer Make Docs version\.\nTo try Make Docs again, ${RUN}:\n {2}(.+)\n$`),
    );
    assert.ok(existsSync(join(dir, ".os", "manifest.json")));
    assert.equal(existsSync(join(dir, "docs")), false);
    const dir2 = folder();
    const json = init(dir2, ["--make-docs", "--json"], stubs.failing);
    assert.equal(json.exit, 0);
    const envelope = JSON.parse(json.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.write_status, "applied");
    assert.equal(envelope.result.status, "partial");
    assert.equal(envelope.result.make_docs.status, "failed");
    const retry = envelope.result.make_docs.retry_command as string;
    assert.match(retry, /^make-docs setup --target /);
    // The retry command, run as shown against a working stub, sets up Make Docs.
    const shell = windows
      ? spawnSync(join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe"), ["/d", "/s", "/c", `"${retry}"`], { cwd: dir2, env: env(stubs.working), encoding: "utf8", windowsVerbatimArguments: true })
      : spawnSync("/bin/sh", ["-c", retry], { cwd: dir2, env: env(stubs.working), encoding: "utf8" });
    assert.equal(shell.status, 0, shape(shell.stderr));
    assert.ok(existsSync(join(dir2, "docs", "README.md")));
  });

  it("A49: with neither make-docs nor npx, setup is partial and shows the npx retry command", () => {
    const dir = folder();
    const envelope = JSON.parse(init(dir, ["--make-docs", "--json"], stubs.none).stdout);
    assert.equal(envelope.result.status, "partial");
    assertOutputMatches(envelope.result.make_docs.reason, /neither make-docs nor npx/);
    assertOutputMatches(envelope.result.make_docs.retry_command, /^npx -y @brucewaynedecoy\/make-docs@~2\.0\.9 setup --target /);
  });

  it("refuses --make-docs with --skip-make-docs as a usage error (exit 2) and writes nothing", () => {
    const dir = folder();
    const result = init(dir, ["--make-docs", "--skip-make-docs"]);
    assert.equal(result.exit, 2);
    assertOutputMatches(result.stderr, /use either --make-docs or --skip-make-docs, not both/);
    assert.deepEqual(readdirSync(dir), []);
  });
});

describe("buildos init: injected terminal answers (t18, t24)", () => {
  const content = loadSourceContent(SYSTEM);
  function fakeProcess(code: number): { port: ProcessPort; runs: string[][] } {
    const runs: string[][] = [];
    return {
      runs,
      port: {
        find: (name) => (name === "make-docs" ? "/stub/make-docs" : undefined),
        run: (_program, args) => {
          runs.push([...args]);
          return code === 0 ? { exitCode: 0, stdout: '{"status":"complete"}', stderr: "" } : { exitCode: code, stdout: "", stderr: "boom" };
        },
      },
    };
  }
  async function answer(text: string | undefined, interactive = true) {
    const dir = folder();
    const io = captureIo(dir);
    const questions: string[] = [];
    io.interactive = interactive;
    io.prompt = async (q) => {
      questions.push(q);
      return text;
    };
    const fake = fakeProcess(0);
    const domain = createInitDomain({ openProcess: () => fake.port, loadContent: () => content, now: () => new Date("2026-11-24T00:00:00Z") });
    const exit = await run(["init"], io, { domains: [domain] });
    return { dir, exit, io, questions, runs: fake.runs };
  }

  it("asks the question once in a terminal, after showing the plan, and an empty answer is Yes", async () => {
    const r = await answer("");
    assert.equal(r.exit, 0);
    assert.deepEqual(r.questions, ["Set up Make Docs in this project? [Y/n] "]);
    assert.deepEqual(r.runs, [makeDocsSetupArgs(r.dir)]);
    assert.match(r.io.stdout(), /^Project folder: .*\n\nPlanned changes \(new BuildOS project, \d+ paths\):\n/);
    assert.match(r.io.stdout(), /\n\nDone\. BuildOS is set up in this folder, with Make Docs\.\nMake Docs: set up\.\n$/);
  });

  it("No at the prompt sets up BuildOS only", async () => {
    const r = await answer("n");
    assert.equal(r.exit, 0);
    assert.deepEqual(r.runs, []);
    assert.ok(existsSync(join(r.dir, ".os", "manifest.json")));
    assert.match(r.io.stdout(), /Make Docs: not set up, as chosen\./);
  });

  it("stops with exit 10 and writes nothing when the terminal input ends", async () => {
    const r = await answer(undefined);
    assert.equal(r.exit, 10);
    assert.deepEqual(readdirSync(r.dir), []);
  });

  it("asks again after an unclear answer, three times at most", async () => {
    const r = await answer("maybe");
    assert.equal(r.exit, 10);
    assert.equal(r.questions.length, 3);
    assert.equal(r.io.stderr(), "Please answer y (yes) or n (no).\n".repeat(3));
  });

  it("does not ask without a terminal", async () => {
    const r = await answer("y", false);
    assert.equal(r.exit, 10);
    assert.deepEqual(r.questions, []);
  });
});

describe("buildos init: shared files AGENTS.md, CLAUDE.md, .gitignore (owner decision 2026-11-24)", () => {
  const BOM = "\uFEFF";
  const PROBLEM_FIX = "To fix it: Delete the buildos lines that are not part of one BuildOS section, or delete all of them. Then run the same init command again.";

  /** Removes what BuildOS added, except the shared files, so `init` sees a new project again. */
  function removeBuildOs(dir: string): void {
    for (const name of [".os", "assets", "playbooks", "workspace"]) rmSync(join(dir, name), { recursive: true, force: true });
  }

  it("adds its section after the user's lines and keeps their bytes, line breaks, BOM, and missing final line break", () => {
    const dir = folder();
    const agents = `${BOM}# My project\r\n\r\nUse tabs.\r\n`;
    const claude = "See AGENTS.md";
    const ignore = "node_modules/\n.env\n";
    writeFileSync(join(dir, "AGENTS.md"), agents);
    writeFileSync(join(dir, "CLAUDE.md"), claude);
    writeFileSync(join(dir, ".gitignore"), ignore);
    if (!windows) chmodSync(join(dir, "AGENTS.md"), 0o600);
    const result = init(dir, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `${agents}\r\n${section("AGENTS.md", "\r\n")}`);
    assertSame(readFileSync(join(dir, "CLAUDE.md"), "utf8"), `${claude}\n\n${section("CLAUDE.md", "\n", "")}`);
    assertSame(readFileSync(join(dir, ".gitignore"), "utf8"), `${ignore}\n${section(".gitignore")}`);
    if (!windows) assert.equal(lstatSync(join(dir, "AGENTS.md")).mode & 0o777, 0o600);
    assert.ok(result.stdout.includes(
        "\n\nShared files. BuildOS changes only its own section of these files, between its buildos:begin and buildos:end lines, and only when that section is still exactly as BuildOS wrote it.\n  AGENTS.md: BuildOS section added; the other lines were not changed\n  CLAUDE.md: BuildOS section added; the other lines were not changed\n  .gitignore: BuildOS section added; the other lines were not changed\n\nDone.",
      ), shape(result.stdout));
  });

  it("runs again idempotently: an equal section is not written, a changed one is updated in place, and the user's lines stay", () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    assert.equal(init(dir, ["--skip-make-docs"]).exit, 0);
    const once = readFileSync(join(dir, "AGENTS.md"), "utf8");
    removeBuildOs(dir);
    const again = JSON.parse(init(dir, ["--skip-make-docs", "--json"]).stdout);
    assertSame(again.result.shared_files, [
      { path: "AGENTS.md", result: "unchanged" },
      { path: "CLAUDE.md", result: "unchanged" },
      { path: ".gitignore", result: "unchanged" },
    ]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), once);
    assert.equal(once.split("<!-- buildos:begin -->").length, 2, "one section only");
    // A stale section, with user lines before and after it, is updated in place.
    removeBuildOs(dir);
    writeFileSync(join(dir, "AGENTS.md"), `# Mine\n\n${buildosSection("old text\n")}\n## After\n`);
    const human = init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 0, shape(human.stderr));
    assertOutputMatches(human.stdout, /\n {2}AGENTS\.md: BuildOS section updated; the other lines were not changed\n/);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `# Mine\n\n${section("AGENTS.md")}\n## After\n`);
  });

  it("the dry run describes each shared-file action and writes nothing", () => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), `# Mine\n\n${section("AGENTS.md")}`);
    writeFileSync(join(dir, "CLAUDE.md"), `# Mine\n${buildosSection("old\n")}`);
    const before = snapshot(dir);
    const human = init(dir, ["--dry-run"]);
    assert.equal(human.exit, 0);
    assert.ok(human.stdout.includes(
        "\n  keep     AGENTS.md (the BuildOS section is already up to date)\n  update   CLAUDE.md (refresh the BuildOS section; the other lines stay as they are)\n  add      .gitignore (a new file with only the BuildOS section)\n",
      ), shape(human.stdout));
    const json = JSON.parse(init(dir, ["--dry-run", "--json"]).stdout);
    assertSame(json.result.shared_files, [
      { path: "AGENTS.md", action: "unchanged" },
      { path: "CLAUDE.md", action: "update_block" },
      { path: ".gitignore", action: "create" },
    ]);
    assertSameTree(snapshot(dir), before, "project tree");
  });

  const malformed: [string, string, string, string][] = [
    ["begin_without_end", "AGENTS.md", "# Mine\n<!-- buildos:begin -->\nx\n", 'AGENTS.md line 2 is a "<!-- buildos:begin -->" line, but no "<!-- buildos:end -->" line comes after it.'],
    ["end_without_begin", "CLAUDE.md", "x\n<!-- buildos:end -->\n", 'CLAUDE.md line 2 is a "<!-- buildos:end -->" line, but no "<!-- buildos:begin -->" line comes before it.'],
    ["end_before_begin", ".gitignore", "# buildos:end\nx\n# buildos:begin\n", '.gitignore line 1 is a "# buildos:end" line that comes before the "# buildos:begin" line.'],
    [
      "more_than_one_section",
      "AGENTS.md",
      "<!-- buildos:begin -->\na\n<!-- buildos:end -->\n<!-- buildos:begin -->\nb\n<!-- buildos:end -->\n",
      'AGENTS.md line 4 starts a second BuildOS section: this file has more than one "<!-- buildos:begin -->" or "<!-- buildos:end -->" line.',
    ],
  ];
  for (const [problem, path, text, message] of malformed) {
    it(`stops before any write on malformed markers (${problem}), exits 10, and names the file`, () => {
      const dir = folder();
      writeFileSync(join(dir, path), text);
      const before = snapshot(dir);
      const human = init(dir, ["--skip-make-docs"]);
      assert.equal(human.exit, 10);
      assertSame(human.stdout, `Project folder: ${dir}\nStopped. Nothing was changed. BuildOS cannot safely add its section to 1 file.\n\n${message}\n${PROBLEM_FIX}\n`);
      const json = init(dir, ["--skip-make-docs", "--json"]);
      assert.equal(json.exit, 10);
      const envelope = JSON.parse(json.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.write_status, "not_requested");
      assertSame(envelope.result.reason, "shared_file_problem");
      assertSame(envelope.result.clashes, []);
      assertSame(envelope.result.problems.map((p: { path: string; problem: string; message: string }) => [p.path, p.problem, p.message]), [[path, problem, message]]);
      assert.equal(envelope.diagnostics[0].code, "init_shared_file_problem");
      // --make-docs too: the check comes before Make Docs runs.
      const calls0 = calls(stubs.working).length;
      assert.equal(init(dir, ["--make-docs"], stubs.working).exit, 10);
      assert.equal(calls(stubs.working).length, calls0);
      assertSameTree(snapshot(dir), before, "project tree");
    });
  }

  it("lists clashes and shared-file problems together, and still writes nothing", () => {
    const dir = folder();
    writeFileSync(join(dir, "workspace"), "x\n");
    writeFileSync(join(dir, ".gitignore"), "# buildos:begin\n");
    const before = snapshot(dir);
    const human = init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 10);
    assertSame(human.stdout, `Project folder: ${dir}\nStopped. Nothing was changed. 1 path that BuildOS must add is already in this folder, and BuildOS cannot safely add its section to 1 file.\n\nThese paths are already here:\n  workspace\n\n${TIP}\n\n.gitignore line 1 is a "# buildos:begin" line, but no "# buildos:end" line comes after it.\n${PROBLEM_FIX}\n`);
    assertSameTree(snapshot(dir), before, "project tree");
  });

  it("stops on a shared file larger than the read limit, without reading it", () => {
    const dir = folder();
    writeFileSync(join(dir, ".gitignore"), Buffer.alloc(SHARED_FILE_MAX_BYTES + 1, 0x61));
    const human = init(dir, ["--skip-make-docs"]);
    assert.equal(human.exit, 10);
    assertOutputMatches(human.stdout, /\n\.gitignore is larger than 4 MiB, so BuildOS does not read it\.\nTo fix it: Make the file smaller, or move it away\. Then run the same init command again\.\n$/);
    assert.deepEqual(readdirSync(dir), [".gitignore"]);
  });

  it("a shared file that is a folder is a clash", () => {
    const dir = folder();
    mkdirSync(join(dir, "CLAUDE.md"));
    const envelope = JSON.parse(init(dir, ["--skip-make-docs", "--json"]).stdout);
    assertSame(envelope.result.clashes, [{ path: "CLAUDE.md", found: "folder" }]);
  });

  /** A symlink, or `undefined` where this OS user may not make one (Windows without the right). */
  function trySymlink(target: string, path: string): boolean {
    try {
      symlinkSync(target, path);
      return true;
    } catch {
      return false;
    }
  }

  it("keeps CLAUDE.md as a link to AGENTS.md, which gets the section; any other link stops before any write", (t) => {
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    if (!trySymlink("AGENTS.md", join(dir, "CLAUDE.md"))) return t.skip("this OS user cannot make a symbolic link");
    const result = init(dir, ["--skip-make-docs", "--json"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    assertSame(JSON.parse(result.stdout).result.shared_files[1], { path: "CLAUDE.md", result: "unchanged", link_to: "AGENTS.md" });
    assert.ok(lstatSync(join(dir, "CLAUDE.md")).isSymbolicLink());
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `# Mine\n\n${section("AGENTS.md")}`);

    const other = folder();
    const outside = join(scratch, `outside-${counter}.md`);
    writeFileSync(outside, "outside\n");
    assert.ok(trySymlink(outside, join(other, "AGENTS.md")));
    const before = snapshot(other);
    const human = init(other, ["--skip-make-docs"]);
    assert.equal(human.exit, 10);
    assertSame(human.stdout, `Project folder: ${other}\nStopped. Nothing was changed. BuildOS cannot safely add its section to 1 file.\n\nAGENTS.md is a link that does not lead to another of these shared files in this folder. BuildOS does not change a file through a link.\nTo fix it: Put a regular file in place of the link, or move the link away. Then run the same init command again.\n`);
    assertSameTree(snapshot(other), before, "project tree");
    assertSame(readFileSync(outside, "utf8"), "outside\n");
  });

  it("a failure after a section write undoes everything: each shared file gets its exact bytes and mode back, a created one is removed", async () => {
    const dir = folder();
    const agents = "# Mine\r\nkeep me\r\n";
    writeFileSync(join(dir, "AGENTS.md"), agents);
    writeFileSync(join(dir, ".gitignore"), "node_modules/\n");
    if (!windows) chmodSync(join(dir, "AGENTS.md"), 0o640);
    const before = snapshot(dir);
    // The .gitignore write fails, after AGENTS.md got its section and CLAUDE.md was created.
    const openFs: FsPortFactory = (root, cwd, options) => {
      const port = createNodeFsPort(root, cwd, options);
      return {
        ...port,
        root: port.root,
        writeFileAtomic: (path, data, opts) => {
          // The forward write (it expects the planned bytes); the undo expects the entry it made.
          if (path === ".gitignore" && opts?.expect?.kind === "file") throw new Error("injected write failure");
          return port.writeFileAtomic(path, data, opts);
        },
      };
    };
    const io = captureIo(dir);
    const domain = createInitDomain({ loadContent: () => loadSourceContent(SYSTEM), now: () => new Date("2026-11-24T00:00:00Z") });
    const exit = await run(["init", "--skip-make-docs"], io, { domains: [domain], openFs });
    assert.equal(exit, 1);
    assertOutputMatches(io.stdout(), /\nFailed\. BuildOS could not finish its setup, so it undid its own changes\.\nWhy: injected write failure\.\n\nFix the problem shown in "Why", then run the same init command again\.\n$/);
    assertSameTree(snapshot(dir), before, "project tree");
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), agents);
  });
});

describe("buildos init: Make Docs and the shared files (owner decision 2026-11-24)", () => {
  /**
   * A Make Docs stub that records whether BuildOS had written anything when
   * it ran, and writes its own marked root AGENTS.md and CLAUDE.md, as Make
   * Docs 2.0.9 does in a folder that has none.
   */
  function routerStub(name: string, refuseUserRouters: boolean): string {
    const dir = mkdirIn(`stubs-${name}`);
    const script = join(dir, "stub.cjs");
    writeFileSync(
      script,
      `const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
const seen = { os: fs.existsSync(path.join(target, ".os")), agents: fs.existsSync(path.join(target, "AGENTS.md")) };
fs.appendFileSync(path.join(__dirname, "seen.jsonl"), JSON.stringify(seen) + "\\n");
if (${refuseUserRouters} && (seen.agents || fs.existsSync(path.join(target, "CLAUDE.md")))) {
  process.stderr.write(JSON.stringify({ ok: false, code: "operation-error", message: "make-docs cannot classify this target safely enough to write changes.\\nMore." }));
  process.exit(1);
}
for (const f of ["AGENTS.md", "CLAUDE.md"]) fs.writeFileSync(path.join(target, f), "<!-- make-docs:begin -->\\n# Make Docs router\\n<!-- make-docs:end -->\\n");
fs.mkdirSync(path.join(target, "docs"), { recursive: true });
process.stdout.write(JSON.stringify({ status: "complete" }));
`,
    );
    if (windows) writeFileSync(join(dir, "make-docs.cmd"), `@"${process.execPath}" "${script}" %*\r\n`);
    else {
      writeFileSync(join(dir, "make-docs"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
      chmodSync(join(dir, "make-docs"), 0o755);
    }
    return dir;
  }
  const seen = (dir: string) => readFileSync(join(dir, "seen.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { os: boolean; agents: boolean });

  it("runs Make Docs before BuildOS writes anything, then adds the BuildOS section to the Make Docs files", () => {
    const stub = routerStub("routers", true);
    const dir = folder();
    const result = init(dir, ["--make-docs", "--json"], stub);
    assert.equal(result.exit, 0, shape(result.stderr));
    assert.deepEqual(seen(stub), [{ os: false, agents: false }]);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.result.status, "complete");
    assertSame(envelope.result.shared_files, [
      { path: "AGENTS.md", result: "block_added" },
      { path: "CLAUDE.md", result: "block_added" },
      { path: ".gitignore", result: "created" },
    ]);
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `<!-- make-docs:begin -->\n# Make Docs router\n<!-- make-docs:end -->\n\n${section("AGENTS.md")}`);
  });

  it("with the user's own AGENTS.md, a Make Docs refusal gives a partial result (exit 0) with a plain tip, and BuildOS still adds its section", () => {
    const stub = routerStub("routers-user", true);
    const dir = folder();
    writeFileSync(join(dir, "AGENTS.md"), "# Mine\n");
    const human = init(dir, ["--make-docs"], stub);
    assert.equal(human.exit, 0, shape(human.stderr));
    assertOutputMatches(
      human.stdout,
      new RegExp(String.raw`\nPartly done\. BuildOS is set up in this folder, but Make Docs is not set up\.\nWhy: Make Docs stopped with exit code 1: make-docs cannot classify this target safely enough to write changes\.\nThis folder already had its own AGENTS\.md or CLAUDE\.md\. Your files were kept, and BuildOS added its section to AGENTS\.md\.\nThis Make Docs version does not set up a folder that has an AGENTS\.md or CLAUDE\.md file that Make Docs did not write\. So with this version, the command below stops the same way in this folder\. It can work with a newer Make Docs version\.\nTo try Make Docs again, ${RUN}:\n {2}make-docs setup --target `),
    );
    assertSame(readFileSync(join(dir, "AGENTS.md"), "utf8"), `# Mine\n\n${section("AGENTS.md")}`);
    const dir2 = folder();
    writeFileSync(join(dir2, "CLAUDE.md"), "# Mine\n");
    const envelope = JSON.parse(init(dir2, ["--make-docs", "--json"], stub).stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.result.status, "partial");
    assertOutputMatches(envelope.result.make_docs.tip, /^This folder already had its own AGENTS\.md or CLAUDE\.md\./);
    assertOutputMatches(envelope.result.make_docs.retry_note, /^This Make Docs version does not set up a folder that has an AGENTS\.md or CLAUDE\.md file that Make Docs did not write\./);
  });

  it("gives no such tip when Make Docs fails in a folder with no AGENTS.md or CLAUDE.md of the user's", () => {
    const envelope = JSON.parse(init(folder(), ["--make-docs", "--json"], stubs.failing).stdout);
    assert.equal(envelope.result.status, "partial");
    assertSame(envelope.result.make_docs.tip, undefined);
  });
});

describe("the Make Docs question says what the pinned Make Docs installs (W1 R7 P8 final check, P8-F-06)", () => {
  it("names the docs/ folders, their agent instructions, and .make-docs/, each true for the 2.0.9 layout; no guides or templates in docs/", async () => {
    const { MAKE_DOCS_ABOUT } = await import("../src/core/init/init.ts");
    const layout = new Set(readFileSync(join(import.meta.dirname, "fixtures", "make-docs-2.0.9-layout.txt"), "utf8").split("\n").filter((l) => l !== ""));
    assert.equal(MAKE_DOCS_RANGE, "~2.0.9", "the layout fixture is the 2.0.9 install; update this test and the message when the range moves");
    assert.match(MAKE_DOCS_ABOUT, /docs\/ folders for designs, plans, requirements, and work, each with instructions for agents/);
    for (const folder of ["designs", "plans", "prd", "work"]) for (const router of ["AGENTS.md", "CLAUDE.md"]) assert.ok(layout.has(`docs/${folder}/${router}`), `docs/${folder}/${router}`);
    assert.match(MAKE_DOCS_ABOUT, /keeps its templates, rules, and prompts in \.make-docs\//);
    for (const kind of ["templates", "contracts", "prompts"]) assert.ok([...layout].some((l) => l.startsWith(`.make-docs/system/${kind}/`)), kind);
    assert.doesNotMatch(MAKE_DOCS_ABOUT, /guides and templates/);
    assert.equal([...layout].some((l) => /^docs\/.*template/i.test(l)), false, "no template is installed under docs/");
  });
});
