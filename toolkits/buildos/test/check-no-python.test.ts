// W1 R7 P9 t10, A79: the no-Python check over the packaged skills
// (scripts/check-no-python.ts). It passes on this repository with no
// exception (the last one, capability-matrix, went with F-P9-04), and it fails
// on each planted Python file and call, naming each by a tag, never by its
// text. Every planted value below is invented.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { EXCEPTIONS, check, findPython, tag } from "../scripts/check-no-python.ts";
import { PYTHON_NAME, runnablePython, searchDisk } from "../scripts/no-python-smoke.ts";

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
  it("passes on this repository with no exception: capability-matrix runs buildos capability-matrix since F-P9-04 (A79)", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /no-python check: passed\n$/);
    assert.doesNotMatch(r.stdout, /exception/);
    assert.deepEqual(EXCEPTIONS, []);
    const report = check(resolve(import.meta.dirname, "..", "..", "..", "system", ".os", "skills"));
    assert.deepEqual(report.failing, []);
    assert.deepEqual(report.stale, []);
    assert.deepEqual(findPython(resolve(import.meta.dirname, "..", "..", "..", "system", ".os", "skills")), [], "no Python file and no Python call anywhere in the skills");
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

  // Review round 1 of pull request 7, finding 3: a name after a folder and a quoted name were missed.
  it("finds a path-qualified or quoted Python name, and still finds each spelling it found before", () => {
    const lines = [
      "/usr/bin/python3 -V",
      'spawnSync("python3", args);',
      "spawnSync('python', ['-c', 'x']);",
      'execFile("/usr/local/bin/python3.12", ["qzvnopy"]);',
      "C:\\Python312\\python.exe -m qzvnopy",
      'spawnSync("py", ["-3", "qzvnopy"]);',
      "spawn('C:\\Windows\\py.exe', args)",
      "/usr/bin/pip3 install qzvnopy",
      ".venv/bin/uv run qzvnopy",
      "Run python3.12 -m qzvnopy.",
      "Run py -3 qzvnopy.",
      "#!/usr/bin/python3",
      "~~~py",
      "Install it: pip install qzvnopy.",
      "Or: uv run qzvnopy.",
      "",
    ];
    const dir = skills({ "qzvnopy-e/notes.md": lines.join("\n") });
    const rules = findPython(dir).map((f) => `${f.line} ${f.rule}`);
    for (const want of [
      "1 python command",
      "2 python command",
      "3 python command",
      "4 python command",
      "5 python command",
      "6 py launcher",
      "7 py launcher",
      "8 pip install",
      "9 uv",
      "10 python command",
      "11 py launcher",
      "12 python shebang",
      "13 python code fence",
      "14 pip install",
      "15 uv",
    ]) assert.ok(rules.includes(want), `${want} in ${JSON.stringify(rules)}`);
    const lineHits = new Set(findPython(dir).map((f) => f.line));
    for (let n = 1; n <= 15; n++) assert.ok(lineHits.has(n), `line ${n} has a finding`);
    assert.doesNotMatch(run(dir).stdout, /qzvnopy/, "the output never names a planted value");
  });

  // Review round 2 of pull request 7, finding 2: Windows casing, a shell operator or a redirection
  // right after the name, and a quoted installer as the program to start were missed.
  it("finds a Windows-cased name, a name before a shell operator or a redirection, and a quoted installer", () => {
    const lines = [
      "PYTHON.EXE -V",
      "/usr/bin/python3>/dev/null",
      'spawnSync("pip3", ["install", "qzvnopy"]);',
      "Python.exe -m qzvnopy",
      "Python3 -V",
      "PYTHON3 qzvnopy",
      "C:\\Python312\\PYTHON.EXE -c x",
      "python3|tee out.txt",
      "python3;echo done",
      "command -v python3&&echo yes",
      "(python3)",
      "python<qzvnopy.txt",
      "PY.EXE -3 qzvnopy",
      "py>nul",
      "spawn('pip', ['install', 'qzvnopy'])",
      'execFile("/usr/local/bin/pipx", ["run", "qzvnopy"])',
      'spawnSync("uv", ["run", "qzvnopy"])',
      'spawnSync("C:\\\\Tools\\\\UV.EXE", args)',
      "PIP3.EXE install qzvnopy",
      "UV RUN qzvnopy",
      "",
    ];
    const dir = skills({ "qzvnopy-g/notes.md": lines.join("\n") });
    const found = findPython(dir);
    const rules = found.map((f) => `${f.line} ${f.rule}`);
    for (const want of [
      "1 python command",
      "2 python command",
      "3 pip install",
      "4 python command",
      "5 python command",
      "6 python command",
      "7 python command",
      "8 python command",
      "9 python command",
      "10 python command",
      "11 python command",
      "12 python command",
      "13 py launcher",
      "14 py launcher",
      "15 pip install",
      "16 pip install",
      "17 uv",
      "18 uv",
      "19 pip install",
      "20 uv",
    ]) assert.ok(rules.includes(want), `${want} in ${JSON.stringify(rules)}`);
    assert.doesNotMatch(run(dir).stdout, /qzvnopy/, "the output never names a planted value");
  });

  it("still does not count prose that names Python in another case, or words that only contain the names", () => {
    const dir = skills({
      "qzvnopy-h/SKILL.md": [
        "This skill needs Python 3 (or Python).",
        "Python, Node.js, and Go; Python|Node in a table; Python's tools.",
        "A pipeline, a pip-free setup, the uv-index, and a uvula; a Pipfile-free folder.",
        'The "pipe" and "uvula" words, and "pipes" in quotes.',
        "",
      ].join("\n"),
    });
    assert.deepEqual(check(dir).failing, []);
  });

  it("does not count a path or a URL that only contains the word python", () => {
    const dir = skills({ "qzvnopy-f/SKILL.md": "See https://docs.python.org/3/ and github.com/python/cpython and my-python3-notes and python-helpers/ and the spy.py-less copy.\n" });
    assert.deepEqual(check(dir).failing, []);
  });

  it("does not count prose that names Python, or a word that only contains py", () => {
    const dir = skills({
      "qzvnopy-d/SKILL.md": "This skill needs Python 3. It copies the happy path, a .pyramid of data, and spy notes. Python is not needed here.\n",
    });
    assert.deepEqual(check(dir).failing, []);
    assert.equal(run(dir).status, 0);
  });

  it("an exception allows the findings under its folder, and one that no longer matches anything is stale, so it is removed when its skill needs no Python", () => {
    const exception = [{ prefix: "qzvnopy-g/", status: "invented", reason: "invented" }];
    const covered = check(skills({ "qzvnopy-g/SKILL.md": "Run `python3 tools/qzvnopy.json`.\n" }), exception);
    assert.deepEqual(covered.failing, []);
    assert.equal(covered.excepted.get("qzvnopy-g/"), 1);
    assert.deepEqual(covered.stale, []);
    const stale = check(skills({ "qzvnopy-g/SKILL.md": "Needs Node.js only.\n" }), exception);
    assert.deepEqual(stale.stale, ["qzvnopy-g/"]);
    const r = run(skills({ "qzvnopy-g/SKILL.md": "Run `python3 tools/qzvnopy.json`.\n" }));
    assert.equal(r.status, 1, "with no exception, the same call fails");
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

// W1 R7 P9, A80 (review round 1 of pull request 7, finding 1): the smoke inside
// a Linux image with Node 24 and no Python at all, and the filesystem search
// that proves the image has none.
describe("CI: the no-Python image job (A80)", () => {
  const workflow = readFileSync(resolve(import.meta.dirname, "..", "..", "..", ".github", "workflows", "buildos-ci.yml"), "utf8").replace(/\r\n/g, "\n");
  const start = workflow.indexOf("\n  no-python-image:\n");
  const rest = workflow.slice(start + 1);
  const next = rest.search(/\n {2}[a-z][\w-]*:\n/);
  const job = next < 0 ? rest : rest.slice(0, next);
  const script = readFileSync(resolve(import.meta.dirname, "..", "scripts", "no-python-image.sh"), "utf8").replace(/\r\n/g, "\n");
  const security = readFileSync(resolve(import.meta.dirname, "..", "SECURITY.md"), "utf8");

  it("runs the official node:24-slim image pulled by digest, the digest SECURITY.md records, with docker run and only the checkout mounted, read-only", () => {
    assert.ok(start >= 0, "the job is there");
    assert.match(job, /runs-on: ubuntu-latest\n/);
    const image = /NO_PYTHON_IMAGE: (node:24-slim@sha256:[0-9a-f]{64})\n/.exec(job)?.[1];
    assert.ok(image !== undefined, "the image is pinned by digest");
    assert.ok(security.includes(image), "SECURITY.md records the same image and digest");
    assert.doesNotMatch(job, /\n {4}container:|services:/, "no job container: it would mount the runner's tool cache, which holds Python");
    assert.match(job, /run: docker pull "\$NO_PYTHON_IMAGE"\n/);
    assert.match(job, /run: docker run --rm --volume "\$GITHUB_WORKSPACE:\/build-os:ro" --workdir \/build-os\/toolkits\/buildos "\$NO_PYTHON_IMAGE" sh -eu scripts\/no-python-image\.sh\n/);
    assert.equal(job.match(/--volume|-v /g)?.length, 1, "one mount");
    assert.doesNotMatch(job, /--privileged|--network|permissions:|secrets\.|environment:|id-token|GITHUB_TOKEN|github\.token|continue-on-error|\$\{\{|^\s+if:/m);
    assert.match(job, /persist-credentials: false/);
    for (const use of job.match(/uses: \S+/g) ?? []) assert.match(use, /@[0-9a-f]{40}$/, use);
  });

  it("the script runs the guards, the install with scripts off, the build, the smoke with the filesystem search, and the parity test, and installs no Python", () => {
    for (const line of [
      "node scripts/check-dependencies.ts\n",
      "npm ci --ignore-scripts --no-audit --no-fund\n",
      "node scripts/check-dependencies.ts --installed\n",
      "node scripts/check-no-python.ts\n",
      "npm run build\n",
      'npm install --offline --ignore-scripts --no-save --no-audit --no-fund --prefix "$temp/project" "$temp/$tarball"\n',
      'node scripts/no-python-smoke.ts --project "$temp/project" --work "$temp/no-python-work" --filesystem / --skip "$checkout" --skip "$copy"\n',
      "node --test --test-reporter=spec test/skill-script-parity.test.ts\n",
    ]) assert.ok(script.includes(line), line);
    const code = script.split("\n").filter((l) => !l.startsWith("#")).join("\n");
    // Review round 2 of pull request 7 (hardening): the mounted checkout is only read; the script
    // copies it to a scratch folder and moves there before its first command that writes.
    const copied = code.indexOf('cp -R "$checkout/." "$copy"\ncd "$copy/toolkits/buildos"\n');
    assert.ok(copied >= 0, "the script copies the checkout and works in the copy");
    assert.ok(copied < code.indexOf("npm ci"), "the copy comes before the install");
    assert.ok(copied < code.indexOf("node "), "the copy comes before the first node command");
    assert.doesNotMatch(code, /\b(?:apt|apt-get|apk|pip|pip3|uv|git)\b|(?<![\w-])python/, "installs nothing, runs no Python, needs no git");
  });

  it("the filesystem search fails on a Python that can run, and lists a data folder or a source file with a Python name without failing", () => {
    const posix = process.platform !== "win32";
    const root = skills({
      "usr/bin/node": "",
      "usr/bin/python3.12": "",
      "usr/lib/python3.11/os.py": "",
      "usr/lib/libpython3.11.so.1.0": "",
      "opt/qzvnopy/py": "",
      "opt/pypy3/x": "",
      "usr/share/gcc/python/libstdcxx/printers.py": "",
      "usr/share/doc/python.txt": "",
      "tools/gyp/gyp_main.py": "",
      "skipme/python3": "",
    });
    if (posix) {
      symlinkSync("node", join(root, "usr", "bin", "python3"));
      chmodSync(join(root, "usr", "bin", "python3.12"), 0o755);
      chmodSync(join(root, "opt", "qzvnopy", "py"), 0o755);
      chmodSync(join(root, "skipme", "python3"), 0o755);
    }
    const result = searchDisk(root, [join(root, "skipme")]);
    const rel = (list: string[]) => list.map((p) => p.slice(root.length + 1).split(/[\\/]/).join("/")).sort();
    const want = [
      "opt/pypy3 (standard library folder)",
      "usr/lib/libpython3.11.so.1.0 (interpreter library)",
      "usr/lib/python3.11 (standard library folder)",
      ...(posix ? ["opt/qzvnopy/py (program)", "usr/bin/python3 (link to a program)", "usr/bin/python3.12 (program)"] : []),
    ].sort();
    assert.deepEqual(rel(result.found), want);
    const other = ["usr/share/doc/python.txt (file)", "usr/share/gcc/python (folder)", ...(posix ? [] : ["opt/qzvnopy/py (file)", "usr/bin/python3.12 (file)"])].sort();
    assert.deepEqual(rel(result.other), other, "a data folder and a data file are listed, not failed on");
    assert.deepEqual(result.unreadable, []);
    assert.equal([...result.sources.values()].reduce((a, b) => a + b, 0), 3, "the .py sources are counted, not failed on");
    for (const name of ["py", "python", "python3", "python3.12", "python.exe", "pypy3", "libpython3.11.so"]) assert.match(name, PYTHON_NAME, name);
    for (const name of ["pyc", "spy", "gyp_main.py", "find-python.js", "pylib", "cpython"]) assert.doesNotMatch(name, PYTHON_NAME, name);
    assert.equal(runnablePython("python", "folder", 0), undefined, "/usr/share/gcc/python is not a Python");
    assert.equal(runnablePython("python3", "file", 0o644), undefined, "a file without an execute bit does not run");
    assert.equal(runnablePython("python3", "file", 0o755), "program");
  });

  it("the filesystem search reports a folder it cannot read, so an incomplete search fails", { skip: process.platform === "win32" || process.getuid?.() === 0 ? "needs a non-root POSIX user" : false }, () => {
    const root = skills({ "locked/x": "" });
    chmodSync(join(root, "locked"), 0o000);
    try {
      assert.deepEqual(searchDisk(root).unreadable, [join(root, "locked")]);
    } finally {
      chmodSync(join(root, "locked"), 0o755);
    }
  });
});
