// W1 R7 P9 review round 1 (P9-R1-09): CI run 45535678445 failed 25 tests on
// all three systems because the root .gitignore rule `build/` hid the 36
// generated files of the fit-gap fixture, so they were never committed. The
// fixture folder is now `analysis/`. This guard fails when any file under
// test/fixtures/ or test/golden/ matches an ignore rule, so a test can never
// depend on a file that a fresh checkout lacks. It names files by tag only.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { assertNoProblems, tag } from "./helpers.ts";

const PACKAGE = resolve(import.meta.dirname, "..");

describe("P9-R1-09: every fixture and golden file a test needs is tracked by git, never ignored", () => {
  const inGit = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: PACKAGE, encoding: "utf8" }).stdout?.trim() === "true";
  it("no path under test/fixtures/ or test/golden/ matches an ignore rule", { skip: inGit ? false : "not a git checkout (a source archive): nothing to check" }, () => {
    const files: string[] = [];
    const walk = (at: string): void => {
      for (const e of readdirSync(at, { withFileTypes: true })) {
        const full = join(at, e.name);
        if (e.isDirectory()) walk(full);
        else files.push(relative(PACKAGE, full).split(sep).join("/"));
      }
    };
    for (const root of ["test/fixtures", "test/golden"]) walk(join(PACKAGE, ...root.split("/")));
    // --no-index: the ignore rules themselves, also for a file that is tracked, so a new file in the same folder cannot be lost.
    const checked = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], { cwd: PACKAGE, input: files.join("\n"), encoding: "utf8" });
    const ignored = checked.stdout.split("\n").filter((line) => line !== "");
    assertNoProblems(
      ignored.map((path) => `${tag(`toolkits/buildos/${path}`)}: ignored by a .gitignore rule`),
      `${files.length} fixture and golden files`,
    );
    assert.ok(files.length > 1000, "the walk found the fixture tree");
  });

  it("the check sees an ignored path (the old fixture folder)", { skip: inGit ? false : "not a git checkout" }, () => {
    const probe = "test/fixtures/skills/fitgap/bases/library/build/frame.json";
    const checked = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], { cwd: PACKAGE, input: probe, encoding: "utf8" });
    assert.ok(checked.stdout.includes(probe), "build/ is still an ignore rule, so the guard has something to catch");
  });
});
