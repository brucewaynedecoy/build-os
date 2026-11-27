// W1 R7 P9 t10, A79: fails when the packaged skills (system/.os/skills/) hold
// a Python file or tell an agent to run Python. From 0.2.0 an adopter needs
// Node.js and nothing else (PRD 20 Command Surface); the skills reach BuildOS
// through the project wrapper, never a script of their own.
//
// Usage, from toolkits/buildos/:
//
//   node scripts/check-no-python.ts [--dir <skills folder>]
//
// The default folder is system/.os/skills/ of this repository. Exit codes:
// 0 no finding outside the exceptions below; 1 a finding, or an exception
// that no longer matches anything (remove it); 2 the command was not written
// correctly.
//
// Findings:
//   - file: a Python source, compiled, notebook, or package file
//     (.py, .pyc, .pyo, .pyw, .pyz, .pyi, .ipynb, __pycache__/,
//     requirements*.txt, pyproject.toml, setup.py, setup.cfg, Pipfile,
//     Pipfile.lock, poetry.lock, uv.lock);
//   - call: a line of a text file that runs Python: the commands `python`,
//     `python3`, `python3.N`, `py -<flag>` or `py <file>`, each also after a
//     folder or in quotes (`/usr/bin/python3`, `"python3"`, `"py"`), also with
//     `.exe` and in Windows casing (`PYTHON.EXE`), also right before a shell
//     operator or a redirection (`python3>/dev/null`), `pip install`,
//     `pip3 install`, `pipx`, `uv run`, `uv pip`, or `uvx`, and a quoted `pip`,
//     `pip3`, `pipx`, `uv`, or `uvx` as a program to start; a `#!` line that
//     names python; a `python` or `py` code fence; or a `.py` file name.
// Prose that names Python ("needs Python 3") is not a call.
//
// Like the other checks over shipped content, the output names each finding
// by a tag of its path (`node scripts/locate-hash.ts <tag>` finds it), its
// line, and its rule, never the line itself.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");
export const DEFAULT_DIR = join(PACKAGE_ROOT, "..", "..", "system", ".os", "skills");

/**
 * The named exceptions. Each one is a skill folder that may still hold Python
 * findings, with the follow-up and the decision it waits for. An exception
 * that matches no finding fails the check, so it is removed when its skill no
 * longer needs Python.
 *
 * None since F-P9-04 (2026-11-26): the last one, `capability-matrix/`, went
 * when `buildos capability-matrix` replaced the Python tool that the skill
 * embedded (owner decision 2026-11-26). The list stays, so a later exception
 * needs a named follow-up and is checked for staleness the same way.
 */
export const EXCEPTIONS: readonly { prefix: string; status: string; reason: string }[] = [];

const PYTHON_FILE = /(?:\.(?:py|pyc|pyo|pyw|pyz|pyi|ipynb)$|(?:^|\/)__pycache__\/|(?:^|\/)(?:requirements[^/]*\.txt|pyproject\.toml|setup\.py|setup\.cfg|Pipfile|Pipfile\.lock|poetry\.lock|uv\.lock)$)/i;
// Where a command name ends: a space, the end of the line, a quote, a bracket, a comma, or a shell
// operator or redirection (`>`, `<`, `|`, `;`, `&`, `)`).
const END = String.raw`(?=[\s\`'"),;\]<>|&]|$)`;
// A quoted program name, also after a folder: `spawnSync("pip3", args)`, `"C:\\Windows\\py.exe"`.
const quoted = (names: string) => new RegExp(String.raw`(["'])(?:[^"'\s]*[/\\])?(?:${names})(?:\.exe)?\1`, "i");
const PYTHON = String.raw`python(?:[23](?:\.\d+)?)?`;
const CALLS: readonly { rule: string; patterns: readonly RegExp[] }[] = [
  // A name may follow a folder (`/usr/bin/python3`, `C:\Python312\python.exe`) and may be quoted
  // (`spawnSync("python3", args)`), so a slash, a backslash, or a quote can come before it (review
  // round 1 of pull request 7, finding 3). Windows names are not case-sensitive (`PYTHON.EXE -V`),
  // and a shell operator or a redirection can follow a name (`python3>/dev/null`) (review round 2,
  // finding 2). A name that is not all lower case can be prose ("needs Python 3"), so it counts only
  // in capitals, with `.exe`, or before a flag (`Python -V`).
  {
    rule: "python command",
    patterns: [
      new RegExp(String.raw`(?<![\w.-])${PYTHON}(?:\.exe)?${END}`),
      new RegExp(String.raw`(?<![\w.-])PYTHON(?:[23](?:\.\d+)?)?(?:\.EXE)?${END}`),
      new RegExp(String.raw`(?<![\w.-])${PYTHON}(?:\.exe${END}|(?:\.exe)?\s+-[a-z])`, "i"),
    ],
  },
  { rule: "py launcher", patterns: [/(?<![\w.-])py(?:\.exe)?(?:\s+(?:-[0-9a-z]|[^\s]+\.pyw?\b)|(?=[<>|;&]))/i, quoted("py")] },
  { rule: "pip install", patterns: [/(?<![\w.-])(?:pip[23]?|pipx)(?:\.exe)?\s+(?:install|run)\b|(?<![\w.-])pipx\b/i, quoted("pip[23]?|pipx")] },
  { rule: "uv", patterns: [/(?<![\w.-])(?:uv(?:\.exe)?\s+(?:run|pip|tool)\b|uvx\b)/i, quoted("uvx?")] },
  { rule: "python shebang", patterns: [/^#!.*\bpython/i] },
  { rule: "python code fence", patterns: [/^\s*(?:```|~~~)\s*(?:python[0-9]?|py)\s*$/] },
  { rule: ".py file name", patterns: [/[\w-]\.pyw?\b(?![\w-])/] },
];

export interface Finding {
  path: string;
  line?: number;
  rule: string;
}

export const tag = (name: string): string => `#${createHash("sha256").update(name, "utf8").digest("hex").slice(0, 8)}`;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__pycache__") out.push(`${relative(dir, full).split(sep).join("/")}/`);
        walk(full);
      } else out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** Every Python file and Python call under `dir`. */
export function findPython(dir: string): Finding[] {
  const findings: Finding[] = [];
  for (const path of filesUnder(dir)) {
    if (PYTHON_FILE.test(path)) {
      findings.push({ path, rule: "python file" });
      if (path.endsWith("/")) continue;
    }
    const full = join(dir, ...path.split("/"));
    if (statSync(full).size > 16 * 1024 * 1024) continue;
    const data = readFileSync(full);
    if (data.subarray(0, 8192).includes(0)) continue;
    const lines = data.toString("utf8").replace(/^﻿/, "").split(/\r?\n/);
    lines.forEach((text, index) => {
      for (const { rule, patterns } of CALLS) {
        if (patterns.some((pattern) => pattern.test(text))) findings.push({ path, line: index + 1, rule });
      }
    });
  }
  return findings;
}

export interface Report {
  failing: Finding[];
  excepted: Map<string, number>;
  stale: string[];
  files: number;
}

export function check(dir: string, exceptions = EXCEPTIONS): Report {
  const findings = findPython(dir);
  const excepted = new Map<string, number>(exceptions.map((e) => [e.prefix, 0]));
  const failing: Finding[] = [];
  for (const finding of findings) {
    const exception = exceptions.find((e) => finding.path.startsWith(e.prefix));
    if (exception === undefined) failing.push(finding);
    else excepted.set(exception.prefix, (excepted.get(exception.prefix) ?? 0) + 1);
  }
  const stale = [...excepted].filter(([, count]) => count === 0).map(([prefix]) => prefix);
  return { failing, excepted, stale, files: filesUnder(dir).length };
}

function main(argv: string[]): number {
  let dir = DEFAULT_DIR;
  if (argv.length === 2 && argv[0] === "--dir" && argv[1] !== "") dir = resolve(argv[1]!);
  else if (argv.length !== 0) {
    process.stderr.write("Usage: node scripts/check-no-python.ts [--dir <skills folder>]\n");
    return 2;
  }
  const report = check(dir);
  process.stdout.write(`no-python check: ${report.files} file(s) read under the skills folder\n`);
  for (const exception of EXCEPTIONS) {
    process.stdout.write(`  exception ${exception.prefix} (${exception.status}): ${report.excepted.get(exception.prefix) ?? 0} finding(s) allowed. ${exception.reason}\n`);
  }
  for (const prefix of report.stale) process.stdout.write(`  STALE exception ${prefix}: it matches no finding; remove it from scripts/check-no-python.ts\n`);
  for (const f of report.failing) process.stdout.write(`  FAIL ${tag(f.path)}${f.line === undefined ? "" : ` line ${f.line}`}: ${f.rule} (find it with: node scripts/locate-hash.ts ${tag(f.path)})\n`);
  const ok = report.failing.length === 0 && report.stale.length === 0;
  process.stdout.write(ok ? "no-python check: passed\n" : `no-python check: failed (${report.failing.length} finding(s), ${report.stale.length} stale exception(s))\n`);
  return ok ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
