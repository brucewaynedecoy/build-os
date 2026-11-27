// W1 R7 P9 t13, review round 1 of pull request 11: the GitHub Release body of
// 0.2.0 is extracted from the notes file at the tag (step e of the release
// runbook in the W1 R7 evidence, and step 2 of the SECURITY.md Release
// Procedure). This test reads the extraction command from both documents,
// checks that they hold the same command, runs it with bash on the notes file
// tagged in a scratch git repository, and checks the result: the nine sections
// of 0.2.0 in order, no draft status line (the scratch copy holds one, as the
// notes did before the publication), and nothing of 0.1.0. So a later
// heading change cannot silently break the release body.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const text = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const notes = text(join(packageRoot, "RELEASE_NOTES.md"));
const evidence = text(join(repoRoot, "docs", "work", "2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite", "evidence.md"));
const security = text(join(packageRoot, "SECURITY.md"));
// The real notes have no status line since the publication of 0.2.0. The
// scratch copy gets one back (review round 1 of pull request 14, finding 4),
// so the test still proves that the filter removes it.
const DRAFT_LINE = "Status: draft. This version is not published yet. The maintainer removes this line when the release is approved and published.";
const fixtureNotes = notes.replace("\n## 0.2.0\n\n", `\n## 0.2.0\n\n${DRAFT_LINE}\n\n`);

const SECTIONS = [
  "### What is new",
  "### Fix commands run as printed",
  "### Changed for 0.1.0 users",
  "### Removed",
  "### Upgrade a project from 0.1.0",
  "### Legacy command names end in 0.3.0",
  "### Known limits",
  "### Check the package",
  "### Roll back",
];

/** The extraction pipeline of a document: the text before ` > ` on its one `git show v0.2.0:` line. */
function pipeline(doc: string, name: string): string {
  const lines = doc.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("git show v0.2.0:toolkits/buildos/RELEASE_NOTES.md | "));
  assert.equal(lines.length, 1, `${name}: exactly one extraction line`);
  const line = lines[0] ?? "";
  const cut = line.lastIndexOf(" > ");
  assert.ok(cut > 0, `${name}: the line writes to a file`);
  return line.slice(0, cut);
}

describe("release notes: the 0.2.0 release body extracted at the tag", () => {
  const command = pipeline(evidence, "the release runbook");
  let root: string;
  const git = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  };
  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-notes-"));
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "commit.gpgsign", "false"]);
    git(["config", "core.autocrlf", "false"]);
    mkdirSync(join(root, "toolkits", "buildos"), { recursive: true });
    assert.ok(fixtureNotes.includes(`\n## 0.2.0\n\n${DRAFT_LINE}\n`), "the scratch copy holds the draft line");
    writeFileSync(join(root, "toolkits", "buildos", "RELEASE_NOTES.md"), fixtureNotes);
    git(["add", "."]);
    git(["commit", "-q", "-m", "notes"]);
    git(["tag", "v0.2.0"]);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  it("the runbook and SECURITY.md use the same command", () => {
    assert.equal(pipeline(security, "SECURITY.md"), command);
    assert.match(command, /\| awk '\/\^## 0\\\.2\\\.0\$\/\{p=1;next\} \/\^## \/\{p=0\} p' \| grep -v '\^Status: draft'$/);
  });

  it("selects the nine 0.2.0 sections in order and drops the draft line and 0.1.0", () => {
    const r = spawnSync("bash", ["-c", command], { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const out = r.stdout;
    const headings = out.split("\n").filter((l) => l.startsWith("#"));
    assert.deepEqual(headings, SECTIONS);
    assert.doesNotMatch(out, /^Status: draft/m);
    assert.doesNotMatch(out, /^## /m);
    assert.doesNotMatch(out, /`0\.1\.0` is the first npm release/);
    // Exactly the 0.2.0 section of the tagged file, without its status line.
    const start = fixtureNotes.indexOf("\n## 0.2.0\n") + "\n## 0.2.0\n".length;
    const end = fixtureNotes.indexOf("\n## 0.1.0\n");
    assert.ok(start > 0 && end > start);
    const section = fixtureNotes.slice(start, end + 1);
    assert.ok(section.includes(`\n${DRAFT_LINE}\n`), "the tagged section holds the draft line");
    const expected = section.split("\n").filter((l) => !l.startsWith("Status: draft")).join("\n");
    assert.equal(out, expected);
    assert.ok(!out.includes(DRAFT_LINE));
    // The filter removed only that line: apart from the blank line before it, the real notes, which have none, give the same section.
    const real = notes.slice(notes.indexOf("\n## 0.2.0\n") + "\n## 0.2.0\n".length, notes.indexOf("\n## 0.1.0\n") + 1);
    assert.equal(out.replace(/^\n+/, ""), real.replace(/^\n+/, ""));
    assert.match(out, /^`0\.2\.0` moves the tools/m);
  });
});
