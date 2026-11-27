// W1 R7 P9 t10, A79: the no-Python check over the packaged skills
// (scripts/check-no-python.ts). It passes on this repository with one named
// exception, and it fails on each planted Python file and call, naming each by
// a tag, never by its text. Every planted value below is invented.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { EXCEPTIONS, check, findPython, tag } from "../scripts/check-no-python.ts";

const SCRIPT = resolve(import.meta.dirname, "..", "scripts", "check-no-python.ts");
const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
function skills(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "buildos-no-python-"));
  temps.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, ...path.split("/"))), { recursive: true });
    writeFileSync(join(dir, ...path.split("/")), text);
  }
  return dir;
}
const run = (dir: string) => spawnSync(process.execPath, [SCRIPT, "--dir", dir], { encoding: "utf8" });

describe("no-Python check of the packaged skills (t10, A79)", () => {
  it("passes on this repository; the only exception is capability-matrix, owner decision open (F-P9-04), and it still matches", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /no-python check: passed\n$/);
    assert.deepEqual(EXCEPTIONS.map((e) => e.prefix), ["capability-matrix/"]);
    assert.equal(EXCEPTIONS[0]!.status, "owner decision open (F-P9-04)");
    const report = check(resolve(import.meta.dirname, "..", "..", "..", "system", ".os", "skills"));
    assert.deepEqual(report.failing, []);
    assert.deepEqual(report.stale, []);
    assert.ok((report.excepted.get("capability-matrix/") ?? 0) > 0, "the exception still covers a Python call");
  });

  it("finds each planted Python file and call, and prints a tag and a line, never the planted text", () => {
    const dir = skills({
      "qzvnopy-a/scripts/qzvnopy_tool.py": "print(1)\n",
      "qzvnopy-a/requirements.txt": "x\n",
      "qzvnopy-b/SKILL.md": [
        "# Skill",
        "",
        "Run `python3 tools/qzvnopy.json` first.",
        "Then python -m qzvnopy.",
        "On Windows: py -3 qzvnopy.",
        "Install it: pip install qzvnopy.",
        "Or: uv run --with qzvnopy x.",
        "```python",
        "print(2)",
        "```",
        "The tool is qzvnopy_build.py.",
        "",
      ].join("\n"),
      "qzvnopy-c/run": "#!/usr/bin/env python3\n",
    });
    const rules = findPython(dir).map((f) => `${f.path}${f.line === undefined ? "" : `:${f.line}`} ${f.rule}`);
    for (const want of [
      "qzvnopy-a/scripts/qzvnopy_tool.py python file",
      "qzvnopy-a/requirements.txt python file",
      "qzvnopy-b/SKILL.md:3 python command",
      "qzvnopy-b/SKILL.md:4 python command",
      "qzvnopy-b/SKILL.md:5 py launcher",
      "qzvnopy-b/SKILL.md:6 pip install",
      "qzvnopy-b/SKILL.md:7 uv",
      "qzvnopy-b/SKILL.md:8 python code fence",
      "qzvnopy-b/SKILL.md:11 .py file name",
      "qzvnopy-c/run:1 python shebang",
    ]) assert.ok(rules.includes(want), want);
    const r = run(dir);
    assert.equal(r.status, 1);
    assert.ok(r.stdout.includes(`FAIL ${tag("qzvnopy-b/SKILL.md")} line 3: python command`), "a tag and a line");
    assert.doesNotMatch(r.stdout, /qzvnopy/, "the output never names a planted value");
  });

  it("does not count prose that names Python, or a word that only contains py", () => {
    const dir = skills({
      "capability-matrix/SKILL.md": "Run `python3 build/tool.json`.\n",
      "qzvnopy-d/SKILL.md": "This skill needs Python 3. It copies the happy path, a .pyramid of data, and spy notes. Python is not needed here.\n",
    });
    assert.deepEqual(check(dir).failing, []);
    assert.equal(run(dir).status, 0);
  });

  it("fails on an exception that no longer matches anything, so it is removed when its skill needs no Python", () => {
    const dir = skills({ "capability-matrix/SKILL.md": "Needs Node.js only.\n" });
    const report = check(dir);
    assert.deepEqual(report.stale, ["capability-matrix/"]);
    const r = run(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /STALE exception capability-matrix\//);
  });

  it("refuses an argument it does not know (exit 2)", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--root", "x"], { encoding: "utf8" });
    assert.equal(r.status, 2);
  });
});

// W1 R7 P9 t11, A80: the CI job that runs the three commands with no Python.
describe("CI: the no-Python job (t11, A80)", () => {
  const workflow = readFileSync(resolve(import.meta.dirname, "..", "..", "..", ".github", "workflows", "buildos-ci.yml"), "utf8").replace(/\r\n/g, "\n");
  const jobOf = (name: string) => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    assert.ok(start >= 0, `job ${name}`);
    const next = workflow.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/);
    return workflow.slice(start, next < 0 ? undefined : start + 1 + next);
  };
  const job = jobOf("no-python");

  it("runs on Ubuntu, macOS, and Windows with Node 24, with the workflow's read-only token and no secret", () => {
    assert.match(job, /os: \[ubuntu-latest, macos-latest, windows-latest\]/);
    assert.match(job, /node-version: "24"/);
    assert.match(workflow, /\npermissions:\n {2}contents: read\n/);
    assert.doesNotMatch(job, /permissions:|secrets\.|environment:|id-token|GITHUB_TOKEN|github\.token|continue-on-error/);
    assert.match(job, /persist-credentials: false/);
    for (const use of job.match(/uses: \S+/g) ?? []) assert.match(use, /@[0-9a-f]{40}$/, use);
    assert.doesNotMatch(job, /\$\{\{ (?!matrix\.os)/, "no expression but the matrix name");
  });

  it("installs with install scripts off, and runs the check, the smoke, and the parity test with the no-Python PATH", () => {
    assert.match(job, /run: npm ci --ignore-scripts\n/);
    assert.match(job, /npm install --offline --ignore-scripts --no-save /);
    assert.match(job, /run: node scripts\/check-no-python\.ts\n/);
    assert.match(job, /run: PATH="\$NO_PYTHON_PATH" "\$NO_PYTHON_NODE" scripts\/no-python-smoke\.ts --project "\$RUNNER_TEMP\/project" --work "\$RUNNER_TEMP\/no-python-work"\n/);
    assert.match(job, /run: PATH="\$NO_PYTHON_PATH" "\$NO_PYTHON_NODE" --test --test-reporter=spec test\/skill-script-parity\.test\.ts\n/);
    assert.doesNotMatch(job, /^\s+if:/m, "every step runs on every system");
  });

  it("the test job also runs the no-Python check", () => {
    assert.match(jobOf("test"), /run: node scripts\/check-no-python\.ts\n/);
  });
});
