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

  it("the report and the Markdown summary are built from the cleaned copy, after every check", () => {
    const at = text.indexOf("const reported = steps.map((s) => ({ ...s, stdout: clean(s.stdout, stepFolder.get(s)), stderr: clean(s.stderr, stepFolder.get(s)) }));");
    assert.ok(at > text.lastIndexOf("check("), "cleaned after the last check");
    assert.match(text, /\n {2}steps: reported,\n/);
    assert.match(text, /\nfor \(const s of reported\) \{\n {2}md\.push\(/);
    assert.doesNotMatch(text.slice(at), /\n {2}steps,\n/);
  });
});
