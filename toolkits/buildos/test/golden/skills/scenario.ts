// The scenario harness of the skill-script goldens (W1 R7 P9 t1, t2, t8).
// A case copies a base project (test/fixtures/skills/<script>/bases/<base>/),
// lays an overlay over it, and runs its steps in order: `run` (one command,
// with stdin from a file), `write` (a file into the project), or `remove`.
// The same code runs the legacy script (capture.ts, a maintainer machine with
// Python) and the BuildOS command (the parity test, CI, no Python), so both
// see exactly the same project and the same steps.
//
// Recorded per run step: the exit code, stdout, stderr, and every file the
// step created, changed, or removed. Normalizations (capture-record.json):
//   N1  the project folder path (as given and as resolved) becomes <root>;
//       in BuildOS output on Windows, `\` after <root> becomes `/`.
//   N2  a Python traceback keeps its last line only (no machine path).
//   N3  a .xlsx file is recorded by its SHA-256 and kept beside the golden;
//       it is compared by content (parity exception PE-021).

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const FIXTURES = join(PACKAGE_ROOT, "test", "fixtures", "skills");
export const GOLDENS = join(PACKAGE_ROOT, "test", "golden", "skills");

export const SCRIPTS = ["bulk-extract", "fitgap", "azure-boards"] as const;
export type ScriptName = (typeof SCRIPTS)[number];

export interface Step {
  run?: string[];
  stdin?: string;
  write?: string;
  from?: string;
  remove?: string;
}

export interface Case {
  id: string;
  description: string;
  base: string;
  overlay?: string;
  remove?: string[];
  /** fitgap: the skill palette file is in the project (and beside the script). */
  palette?: boolean;
  steps: Step[];
}

/** A file a step wrote: UTF-8 text, else base64, or an `.xlsx` by its SHA-256. */
export type FileState = { text: string } | { base64: string } | { xlsx: string } | null;

export interface StepResult {
  step: number;
  args: string[];
  exit: number;
  stdout: string;
  stderr: string;
  /** Path (with `/`) to its new state; `null` for a removed file. */
  files: Record<string, FileState>;
}

export interface CaseGolden {
  case: string;
  steps: StepResult[];
}

export function loadCases(script: ScriptName): Case[] {
  return (JSON.parse(readFileSync(join(FIXTURES, script, "cases.json"), "utf8")) as { cases: Case[] }).cases;
}

export function fixtureFile(script: ScriptName, name: string): Buffer {
  return readFileSync(join(FIXTURES, script, "files", name));
}

/** Builds the project of `testCase` in `dir` (which must not exist). */
export function materialize(script: ScriptName, testCase: Case, dir: string): void {
  mkdirSync(dir, { recursive: true });
  cpSync(join(FIXTURES, script, "bases", testCase.base), dir, { recursive: true });
  if (testCase.overlay !== undefined) {
    const overlay = join(FIXTURES, script, "overlays", testCase.overlay);
    if (existsSync(overlay)) cpSync(overlay, dir, { recursive: true });
  }
  for (const path of testCase.remove ?? []) rmSync(join(dir, path), { force: true, recursive: true });
}

/** Every file under `dir`, by `/` path. */
export function snapshot(dir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (folder: string): void => {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else out.set(relative(dir, path).split(sep).join("/"), readFileSync(path));
    }
  };
  walk(dir);
  return out;
}

export function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function fileState(path: string, data: Buffer): FileState {
  if (path.endsWith(".xlsx")) return { xlsx: sha256(data) };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data) };
  } catch {
    return { base64: data.toString("base64") };
  }
}

/** The files that differ between two snapshots. */
export function changedFiles(before: Map<string, Buffer>, after: Map<string, Buffer>): Record<string, FileState> {
  const out: Record<string, FileState> = {};
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const path of paths) {
    const a = before.get(path);
    const b = after.get(path);
    if (b === undefined) out[path] = null;
    else if (a === undefined || !a.equals(b)) out[path] = fileState(path, b);
  }
  return out;
}

/** N1: the project folder (each spelling) becomes `<root>`; on Windows, `\` in the path after it becomes `/`. */
export function normalizeRoot(text: string, roots: readonly string[], windows = false): string {
  let out = text;
  for (const root of [...new Set(roots)].sort((a, b) => b.length - a.length)) {
    out = out.split(root).join("<root>");
    out = out.split(JSON.stringify(root).slice(1, -1)).join("<root>");
  }
  if (windows) out = out.replace(/<root>[^\s"')]*/g, (m) => m.replace(/\\\\/g, "/").replace(/\\/g, "/"));
  return out;
}

/** N2: a traceback keeps its last line. */
export function normalizeTraceback(stderr: string): string {
  if (!stderr.includes("Traceback (most recent call last):")) return stderr;
  const last = stderr.split("\n").filter((line) => line.trim() !== "").pop() ?? "";
  return `${last}\n`;
}

/** A step runner: runs one command in the project folder `dir`. */
export type Runner = (args: string[], dir: string, stdin: Buffer | undefined) => Promise<{ exit: number; stdout: string; stderr: string }>;

/** Runs every step of a case in a fresh project under `work`. `keep` gets each written `.xlsx` (path, bytes, step). */
export async function runCase(script: ScriptName, testCase: Case, work: string, runner: Runner, roots: (dir: string) => string[], keep?: (path: string, data: Buffer, step: number) => void, windows = false): Promise<CaseGolden> {
  const dir = join(work, testCase.id);
  rmSync(dir, { recursive: true, force: true });
  materialize(script, testCase, dir);
  const results: StepResult[] = [];
  let before = snapshot(dir);
  for (const [index, step] of testCase.steps.entries()) {
    if (step.write !== undefined && step.from !== undefined) {
      const target = join(dir, step.write);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, fixtureFile(script, step.from));
      before = snapshot(dir);
      continue;
    }
    if (step.remove !== undefined) {
      rmSync(join(dir, step.remove), { recursive: true, force: true });
      before = snapshot(dir);
      continue;
    }
    const args = step.run ?? [];
    const stdin = step.stdin === undefined ? undefined : fixtureFile(script, step.stdin);
    const outcome = await runner(args, dir, stdin);
    const after = snapshot(dir);
    const files = changedFiles(before, after);
    for (const [path, state] of Object.entries(files)) if (state !== null && "xlsx" in state) keep?.(path, after.get(path)!, index);
    const r = roots(dir);
    results.push({ step: index, args, exit: outcome.exit, stdout: normalizeRoot(outcome.stdout, r, windows), stderr: normalizeTraceback(normalizeRoot(outcome.stderr, r, windows)), files });
    before = after;
  }
  return { case: testCase.id, steps: results };
}

/** The golden file of a case. */
export function goldenPath(script: ScriptName, id: string): string {
  return join(GOLDENS, script, "cases", `${id}.json`);
}

/** The kept `.xlsx` file of a step. */
export function xlsxGoldenPath(script: ScriptName, id: string, step: number, path: string): string {
  return join(GOLDENS, script, "xlsx", `${id}.${step}.${path.split("/").join("~")}`);
}

export function loadGolden(script: ScriptName, id: string): CaseGolden {
  return JSON.parse(readFileSync(goldenPath(script, id), "utf8")) as CaseGolden;
}
