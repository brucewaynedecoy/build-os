// The capture tools read old files from git. Every commit they read must be
// in this public repository (W1 R7 P9 review round 1 on the public
// repository, finding 1: the skill-script capture read a commit of the
// private archive and failed in a public clone).
//
// - The skill-script capture revision is a full SHA, the first commit of the
//   public repository as test/golden/CAPTURE.md documents it, and the one the
//   capture record names.
// - In a git checkout, that commit resolves, has no parent, is an ancestor of
//   HEAD, and holds each pinned file with its pinned SHA-256. CI checks out
//   the full history for this (buildos-ci.yml, fetch-depth 0); a shallow
//   clone fails here.
// - No code or workflow file holds a commit-like literal that does not
//   resolve in this repository, unless it is listed below as provenance only,
//   and a file with such a literal never runs git.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PALETTE_PATH, SCRIPT_FILES, SCRIPT_REVISION, embeddedKey, embeddedScript } from "./golden/skills/script-source.ts";

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(PACKAGE, "..", "..");

function git(args: string[]): { status: number; stdout: Buffer } {
  const run = spawnSync("git", args, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
  return { status: run.status ?? -1, stdout: run.stdout ?? Buffer.alloc(0) };
}
const inGit = git(["rev-parse", "--is-inside-work-tree"]).stdout.toString("utf8").trim() === "true";
const shallow = inGit && git(["rev-parse", "--is-shallow-repository"]).stdout.toString("utf8").trim() === "true";
const notGit = inGit ? false : "not a git checkout (a source archive): no history to check";

function resolves(id: string): boolean {
  return git(["cat-file", "-e", `${id}^{commit}`]).status === 0 && git(["merge-base", "--is-ancestor", id, "HEAD"]).status === 0;
}

/**
 * Commit-like literals of the earlier history that code may hold as
 * provenance only, by file. These commits exist only in the private archive
 * repository brucewaynedecoy/build-os-archive; a file listed here must never
 * run git.
 */
const PROVENANCE_ONLY: Record<string, string[]> = {
  // The frozen Go baseline (test/golden/CAPTURE.md, Frozen Go Baseline): printed, never read.
  "toolkits/buildos/test/golden/capture.mjs": ["263f5ca76082b42ed9a3fb43bab67929889010ed", "e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb"],
  "toolkits/buildos/test/golden/review-fixes.test.ts": ["263f5ca76082b42ed9a3fb43bab67929889010ed", "e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb"],
  // The validator capture takes `--script <path>` (CAPTURE.md, Skill-Script and Validator Sources).
  "toolkits/buildos/test/golden/validate/capture.ts": ["0560ba1"],
  // An invented release revision, not a commit.
  "toolkits/buildos/test/cli.test.ts": ["abc1234"],
};

function codeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) codeFiles(path, out);
    else if (/\.(?:[cm]?[jt]s|ya?ml)$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * The commit IDs that `text` names: a quoted ID (with an optional `:path`),
 * and, in a workflow file, a bare ID on a line that runs git (for example
 * `run: git show 38d1e08:package.json`).
 */
function commitIds(text: string, workflow: boolean): string[] {
  const found: string[] = [];
  const add = (id: string | undefined): void => {
    // A commit ID is 7 to 12 characters (abbreviated) or 40 (full), with a letter and a digit.
    if (id === undefined || (id.length > 12 && id.length !== 40) || !/[a-f]/.test(id) || !/[0-9]/.test(id)) return;
    found.push(id);
  };
  for (const match of text.matchAll(/["'`]([0-9a-f]{7,40})(?::[^"'`\s]*)?["'`]/g)) add(match[1]);
  if (workflow) {
    for (const line of text.split("\n")) {
      if (!/\bgit\s/.test(line)) continue;
      for (const match of line.matchAll(/(?<![0-9A-Za-z_\/@-])([0-9a-f]{7,40})(?![0-9A-Za-z_])/g)) add(match[1]);
    }
  }
  return [...new Set(found)];
}

describe("capture sources are public commits", () => {
  it("the skill-script capture revision is the documented first public commit", () => {
    assert.match(SCRIPT_REVISION, /^[0-9a-f]{40}$/, "a full SHA");
    const doc = readFileSync(join(PACKAGE, "test", "golden", "CAPTURE.md"), "utf8");
    const row = /\| Skill scripts and palette are read from \(the first commit of the public repository\) \| `([0-9a-f]{40})` \|/.exec(doc);
    assert.ok(row, "CAPTURE.md names the first public commit");
    assert.equal(SCRIPT_REVISION, row[1]);
    const record = JSON.parse(readFileSync(join(PACKAGE, "test", "golden", "skills", "capture-record.json"), "utf8")) as { script_revision: string };
    assert.equal(record.script_revision, SCRIPT_REVISION);
  });

  it("the revision resolves here, is the root commit, and holds every pinned file", { skip: notGit }, () => {
    assert.equal(shallow, false, "a shallow clone cannot check the capture revision; check out the full history (fetch-depth: 0)");
    assert.ok(resolves(SCRIPT_REVISION), `${SCRIPT_REVISION} is a commit reachable from HEAD`);
    const parents = git(["rev-list", "--parents", "-n", "1", SCRIPT_REVISION]).stdout.toString("utf8").trim().split(" ");
    assert.deepEqual(parents, [SCRIPT_REVISION], "the first commit of the repository has no parent");
    const pinned = JSON.parse(readFileSync(join(PACKAGE, "test", "golden", "skills", "script-sha256.json"), "utf8")) as Record<string, string>;
    const paths = [...Object.values(SCRIPT_FILES).flat().map((f) => f.path), PALETTE_PATH];
    // F-P9-04: an embedded script (cm_build.py in the capability-matrix skill) is pinned by its file and by its block.
    const embedded = Object.values(SCRIPT_FILES).flat().filter((f) => f.embedded !== undefined);
    assert.deepEqual([...paths, ...embedded.map(embeddedKey)].sort(), Object.keys(pinned).filter((k) => k !== "$comment").sort(), "every pinned file is read");
    for (const path of paths) {
      const show = git(["show", `${SCRIPT_REVISION}:${path}`]);
      assert.equal(show.status, 0, `${path} at ${SCRIPT_REVISION}`);
      assert.equal(createHash("sha256").update(show.stdout).digest("hex"), pinned[path], path);
    }
    for (const file of embedded) {
      const block = embeddedScript(git(["show", `${SCRIPT_REVISION}:${file.path}`]).stdout.toString("utf8"), file.embedded!);
      assert.equal(createHash("sha256").update(block, "utf8").digest("hex"), pinned[embeddedKey(file)], embeddedKey(file));
    }
  });

  it("no code or workflow file names an unknown commit, and provenance-only files never run git", { skip: notGit }, () => {
    assert.equal(shallow, false, "a shallow clone cannot resolve commits; check out the full history (fetch-depth: 0)");
    const files = [...codeFiles(join(PACKAGE, "src")), ...codeFiles(join(PACKAGE, "scripts")), ...codeFiles(join(PACKAGE, "test")), ...codeFiles(join(REPO, ".github"))];
    const problems: string[] = [];
    for (const file of files) {
      const name = relative(REPO, file).split(sep).join("/");
      if (name === "toolkits/buildos/test/capture-sources.test.ts") continue; // holds the list itself
      const text = readFileSync(file, "utf8");
      const allowed = PROVENANCE_ONLY[name] ?? [];
      for (const id of commitIds(text, /\.ya?ml$/.test(name))) {
        if (allowed.includes(id) || resolves(id)) continue;
        problems.push(`${name}: ${id} does not resolve in this repository`);
      }
      if (allowed.length > 0 && /(?:execFileSync|spawnSync|execSync|spawn)\(\s*["']git["']/.test(text)) problems.push(`${name}: holds provenance-only commits and runs git`);
    }
    assert.deepEqual(problems, []);
  });

  it("finds a quoted commit ID in code and a bare one in a workflow git command", () => {
    assert.deepEqual(commitIds('git(["show", "38d1e08:package.json"])', false), ["38d1e08"]);
    assert.deepEqual(commitIds("      - run: git show 38d1e08:package.json\n", true), ["38d1e08"]);
    assert.deepEqual(commitIds("      - run: git diff 38d1e08..4c02048 --stat\n", true), ["38d1e08", "4c02048"]);
    assert.deepEqual(commitIds("      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683\n", true), []);
    assert.deepEqual(commitIds("      - run: git show 38d1e08:package.json\n", false), [], "a bare ID counts only in a workflow file");
  });
});
