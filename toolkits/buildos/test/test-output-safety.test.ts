// W1 R7 P7 final check (P7-F-03, P7-F-07): a failing test about shipped,
// imported, or guide content prints a field or category, a count, a tag, and
// a line number, never the content, a discovered value, the captured output of
// the validator or scanner, or a raw path; and every tag a test prints can be
// found with `node scripts/locate-hash.ts <tag>`.
//
// Every planted value below is invented.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { locate } from "../scripts/locate-hash.ts";
import { assertIncludes, assertNoProblems, assertSameList, assertSameTree, tag } from "./helpers.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const REPO = resolve(PACKAGE, "..", "..");
const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "buildos-output-safety-"));
  temps.push(dir);
  return dir;
}
function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, ...path.split("/"))), { recursive: true });
  writeFileSync(join(root, ...path.split("/")), text);
}
const messageOf = (fn: () => void): string => {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  return "";
};
const tagsIn = (message: string) => new Set(message.match(/#[0-9a-f]{8}/g) ?? []);

describe("P7-F-07: the locator finds every tag form the tests print", () => {
  const root = temp();
  const SKILL = "qzvlocate-skill";
  write(root, `system/.os/skills/${SKILL}/SKILL.md`, "---\nname: x\n---\n");
  write(root, "system/.os/skills/buildos-intake/references/qzvlocate-notes.md", "# Notes\n\nSee [the plan](qzvlocate-missing.md).\n");
  write(root, "guide/content/07-example.md", '```json\n{\n  "environments": ["qzvlocate-env"]\n}\n```\n');
  write(root, "system/.os/skills/fit-gap-analysis/scripts/fitgap.py", "COLORS = {\n    'QzvlocateOwner': ('FFFFFF', '000000'),\n}\n");
  write(root, "system/.os/scripts/tool.cmd", "@echo off\nrem qzvlocate line & more\n");

  const cases: { helper: string; message: string; expect: string }[] = [
    { helper: "assertSameList (an extra skill folder)", message: messageOf(() => assertSameList(["buildos-intake", SKILL], ["buildos-intake"], "packaged skill folders")), expect: `system/.os/skills/${SKILL}` },
    { helper: "assertSameTree (an added file, project-relative)", message: messageOf(() => assertSameTree(new Map([[".os/skills/buildos-intake/references/qzvlocate-notes.md", "x"]]), new Map(), "installed tree")), expect: "system/.os/skills/buildos-intake/references/qzvlocate-notes.md" },
    { helper: "assertNoProblems with a skill-relative file tag (skill paths)", message: messageOf(() => assertNoProblems([`${tag("buildos-intake/references/qzvlocate-notes.md")}: not classified`], "skill path problems")), expect: "system/.os/skills/buildos-intake/references/qzvlocate-notes.md" },
    { helper: "assertNoProblems with a repository file tag and line (broken links, A63)", message: messageOf(() => assertNoProblems([`${tag("system/.os/skills/buildos-intake/references/qzvlocate-notes.md")} line 3: a link to a missing file`], "broken relative links")), expect: "system/.os/skills/buildos-intake/references/qzvlocate-notes.md" },
    { helper: "a value tag (an unknown ID in a guide example)", message: `environments ${tag(String("qzvlocate-env"))} is configured`, expect: "guide/content/07-example.md:3 (value)" },
    { helper: "a value tag (an owner key in palette code)", message: `color constant for ${tag(String("QzvlocateOwner"))}`, expect: "system/.os/skills/fit-gap-analysis/scripts/fitgap.py:2 (value)" },
    { helper: "a line tag (a .cmd comment line)", message: `${tag("tool.cmd")} line 2: ${tag(String("rem qzvlocate line & more"))}`, expect: "system/.os/scripts/tool.cmd:2 (line)" },
    { helper: "assertIncludes (a missing text)", message: messageOf(() => assertIncludes("other text", "qzvlocate-env")), expect: "guide/content/07-example.md:3 (value)" },
  ];

  for (const { helper, message, expect } of cases) {
    it(`${helper}: the message holds a tag and no planted value, and the locator finds the item`, () => {
      const tags = tagsIn(message);
      assert.ok(tags.size > 0, "the message holds a tag");
      assert.ok(!/qzvlocate/i.test(message), "the message never names the planted value");
      const found = locate(root, tags);
      assert.ok(found.some((line) => line.includes(` ${expect}`)), `the locator finds the planted item (${found.length} match(es))`);
    });
  }

  it("the command line prints `<tag> <path>[:<line>] (<form>)` and a count, and exits 1 when nothing matches", () => {
    const script = join(PACKAGE, "scripts", "locate-hash.ts");
    const found = spawnSync(process.execPath, [script, tag("qzvlocate-env"), "--root", root], { encoding: "utf8" });
    assert.equal(found.status, 0);
    assert.ok(found.stdout.includes(`${tag("qzvlocate-env")} guide/content/07-example.md:3 (value)\n`), "the match line");
    assert.ok(/1 match\(es\) for 1 tag\(s\)/.test(found.stdout), "the count");
    const none = spawnSync(process.execPath, [script, "#00000000", "--root", root], { encoding: "utf8" });
    assert.equal(none.status, 1);
  });
});

// P7-F-03: the real test files, run in a child process against a temporary
// copy of the repository with invented values planted in shipped, imported,
// and guide content. Each planted value makes a test fail; the failing output
// never holds it.
describe("P7-F-03: failing tests never print a planted value", () => {
  const PLANTED = ["QzvplantOwner", "qzvplant-env", "qzvplant-notes", "qzvplantpath", "qzvplant-missing", "qzvplantterm", "qzvplantacct"];

  function plantedCopy(): string {
    const root = temp();
    const pkg = join(root, "toolkits", "buildos");
    for (const name of ["package.json", "tsconfig.json", ".npmrc", "LICENSE", "SECURITY.md", "THIRD_PARTY_NOTICES.md", "README.md"]) cpSync(join(PACKAGE, name), join(pkg, name));
    for (const dir of ["src", "scripts", "test"]) cpSync(join(PACKAGE, dir), join(pkg, dir), { recursive: true });
    symlinkSync(join(PACKAGE, "node_modules"), join(pkg, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    for (const dir of ["system", join("guide", "content"), join("docs", "prd")]) cpSync(join(REPO, dir), join(root, dir), { recursive: true });
    cpSync(join(REPO, ".github", "workflows", "buildos-ci.yml"), join(root, ".github", "workflows", "buildos-ci.yml"));
    // 1. An owner key in the palette code and in the palette file.
    const fitgap = join(root, "system", ".os", "skills", "fit-gap-analysis");
    writeFileSync(join(fitgap, "scripts", "fitgap.py"), `${readFileSync(join(fitgap, "scripts", "fitgap.py"), "utf8")}\n# 'QzvplantOwner': ('FFFFFF', '000000')\n`);
    const colors = JSON.parse(readFileSync(join(fitgap, "config", "owner-colors.json"), "utf8")) as Record<string, unknown>;
    writeFileSync(join(fitgap, "config", "owner-colors.json"), `${JSON.stringify({ ...colors, QzvplantOwner: { fill: "FFFFFF", font: "000000" } }, null, 2)}\n`);
    // 2. An unknown environment ID in a guide example.
    const chapter = join(root, "guide", "content", "07-pull-knowledge-out-of-it.md");
    writeFileSync(chapter, readFileSync(chapter, "utf8").replace('"environments": ["vendor-baseline"]', '"environments": ["qzvplant-env"]'));
    // 3. An extra named file in a skill, with a path no layout has and a broken link.
    write(root, "system/.os/skills/buildos-intake/references/qzvplant-notes.md", "# Notes\n\nWrite to `workspace/qzvplantpath/` first.\n\nSee [the plan](qzvplant-missing.md).\n");
    // 4. An invented term in a shipped file name, with a home-folder path that fails the scanner's self-test.
    write(root, "system/.os/skills/buildos-intake/references/qzvplantterm.md", `${["", "Users", "qzvplantacct", "src"].join("/")}\n`);
    return root;
  }

  it("skills, guide examples, system content, and the deny-list self-test fail on the planted values and print none of them", { timeout: 300_000 }, () => {
    const root = plantedCopy();
    const pkg = join(root, "toolkits", "buildos");
    const env: NodeJS.ProcessEnv = { ...process.env, npm_config_cache: join(temp(), "npm-cache"), npm_config_offline: "true", npm_config_update_notifier: "false" };
    delete env["NODE_TEST_CONTEXT"];
    const runs = [
      spawnSync(process.execPath, ["--test", "--test-reporter=spec", "test/skills.test.ts", "test/guide-examples.test.ts", "test/system-content.test.ts"], { cwd: pkg, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 }),
      spawnSync(process.execPath, ["--test", "--test-reporter=spec", "--test-name-pattern", "passes on this repository", "test/deny-list.test.ts"], { cwd: pkg, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 }),
    ];
    const output = runs.map((r) => `${r.stdout}\n${r.stderr}`).join("\n");
    for (const r of runs) assert.notEqual(r.status, 0, "each child run fails on the planted values");
    // Each planted value made its own test fail (test names are fixed text).
    for (const name of [
      "fit-gap-analysis code holds no owner name and no owner color",
      "the chapter 4 config and the chapter 7 records load into a new project and pass buildos validate",
      "every scoped ID the chapter 7 records use is configured in chapter 4",
      "every path is in a fresh --skip-make-docs project, or is classified",
      "A63: every relative Markdown link in system/ and docs/prd/ resolves",
      "passes on this repository's tracked and untracked files",
    ]) assert.ok(output.split("\n").some((line) => line.includes("✖") && line.includes(name)), `the test "${name}" failed`);
    const lower = output.toLowerCase();
    const shown = PLANTED.filter((value) => lower.includes(value.toLowerCase()));
    assert.equal(shown.length, 0, `${shown.length} planted value(s) appear in the failing output (${shown.map((value) => tag(value)).join(", ")})`);
  });
});
