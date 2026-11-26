// W1 R7 P9 t8, A77: each BuildOS command that replaces a skill script gives
// the script's result on every fixture case (test/fixtures/skills/), against
// the goldens the script wrote (test/golden/skills/, captured once with
// Python and Node by capture.ts; this test needs no Python):
//
//   - stdout and stderr byte for byte, after normalization N1 (the project
//     folder as <root>), except where a divergence in
//     test/golden/skills/divergences.json allows a difference on that step;
//   - the exit code by the SD-01 rule table (PRD 20 exit codes);
//   - every file a step created, changed, or removed byte for byte (CSV,
//     Markdown, JSON, JSONL), and each .xlsx by content (parity
//     exception PE-021, test/xlsx-compare.ts).
//
// A failure names the case, the step, and the field, never the content.

import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { assertNoProblems, assertSame, assertSameBytes, assertSameList } from "./helpers.ts";
import { buildosRunner } from "./golden/skills/buildos-runner.ts";
import { GOLDENS, SCRIPTS, loadCases, loadGolden, runCase, xlsxGoldenPath, type FileState, type ScriptName, type StepResult } from "./golden/skills/scenario.ts";
import { compareWorkbooks, readXlsx, readXlsxFile } from "./xlsx-compare.ts";

interface ExitRule {
  script: ScriptName;
  script_exit: number;
  buildos_exit: number;
  stderr?: string;
}
interface Divergence {
  id: string;
  steps?: string[];
  allowed?: Record<string, string>;
  exit_rules?: ExitRule[];
}
const divergences = (JSON.parse(readFileSync(join(GOLDENS, "divergences.json"), "utf8")) as { divergences: Divergence[] }).divergences;
const exitRules = divergences.find((d) => d.id === "SD-01")!.exit_rules!;

/** `script/case#a-b` or `script/case#n` to the step keys it names. */
function expandSteps(spec: string): string[] {
  const [head, range] = spec.split("#") as [string, string];
  const [from, to] = range.split("-").map(Number) as [number, number | undefined];
  const out: string[] = [];
  for (let i = from; i <= (to ?? from); i++) out.push(`${head}#${i}`);
  return out;
}
const textAllowed = new Map<string, string>();
for (const d of divergences) {
  if (d.id === "SD-02" || d.allowed !== undefined) for (const spec of d.steps ?? []) for (const key of expandSteps(spec)) textAllowed.set(key, d.id);
}
/** The stderr each pinned step must print (SD-03; SD-20 since review round 2): stdout and files stay the script's. */
const pins = new Map<string, string>(divergences.flatMap((d) => Object.entries(d.allowed ?? {})));

export function expectedExit(script: ScriptName, golden: StepResult): number {
  if (golden.exit === 0) return 0;
  for (const rule of exitRules) {
    if (rule.script !== script || rule.script_exit !== golden.exit) continue;
    if (rule.stderr !== undefined && !new RegExp(rule.stderr).test(golden.stderr)) continue;
    return rule.buildos_exit;
  }
  return -1;
}

const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-skill-parity-")));
after(() => rmSync(work, { recursive: true, force: true }));
const windows = process.platform === "win32";

function stateEqual(a: FileState | undefined, b: FileState | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

const seenDiffering = new Set<string>();

for (const script of SCRIPTS) {
  describe(`skill-script parity: ${script} (A77)`, () => {
    for (const testCase of loadCases(script)) {
      it(`${testCase.id}: ${testCase.description}`, async () => {
        const golden = loadGolden(script, testCase.id);
        const kept = new Map<string, Buffer>();
        const actual = await runCase(script, testCase, join(work, script), buildosRunner(script), (dir) => [dir, realpathSync(dir)], (path, data, step) => kept.set(`${step}:${path}`, data), windows);
        assertSame(actual.steps.length, golden.steps.length, `${testCase.id}: step count`);
        const problems: string[] = [];
        golden.steps.forEach((want, i) => {
          const got = actual.steps[i]!;
          const key = `${script}/${testCase.id}#${want.step}`;
          const where = `${testCase.id} step ${want.step}`;
          const allowed = textAllowed.get(key);
          if (allowed === undefined) {
            if (got.stdout !== want.stdout) problems.push(`${where}: stdout differs`);
            if (got.stderr !== want.stderr) problems.push(`${where}: stderr differs`);
          } else {
            if (got.stdout !== want.stdout || got.stderr !== want.stderr) seenDiffering.add(key);
            if (allowed !== "SD-02" && got.stderr !== pins.get(key)) problems.push(`${where}: stderr is not the one ${allowed} pins`);
            if (allowed !== "SD-02" && got.stdout !== want.stdout) problems.push(`${where}: stdout differs`);
            if (allowed === "SD-02" && got.exit !== 0 && got.exit !== 2) problems.push(`${where}: a usage error exits ${got.exit}, not 2`);
          }
          const exit = expectedExit(script, want);
          if (exit < 0) problems.push(`${where}: no SD-01 rule for script exit ${want.exit}`);
          else if (got.exit !== exit) problems.push(`${where}: exit ${got.exit}, expected ${exit} (script ${want.exit})`);
          const paths = new Set([...Object.keys(want.files), ...Object.keys(got.files)]);
          for (const path of [...paths].sort()) {
            const a = want.files[path];
            const b = got.files[path];
            if (a !== undefined && a !== null && "xlsx" in a) {
              if (b === undefined || b === null || !("xlsx" in b)) {
                problems.push(`${where}: ${path} was not written`);
                continue;
              }
              const diffs = compareWorkbooks(readXlsxFile(xlsxGoldenPath(script, testCase.id, want.step, path)), readXlsx(kept.get(`${want.step}:${path}`)!));
              for (const d of diffs.slice(0, 5)) problems.push(`${where}: ${path}: ${d}`);
              continue;
            }
            if (!stateEqual(a, b)) problems.push(`${where}: file ${path} differs (${a === undefined ? "not written by the script" : b === undefined ? "not written by buildos" : "content"})`);
          }
        });
        assertNoProblems(problems, `${script}/${testCase.id}`);
      });
    }
  });
}

describe("skill-script divergences stay real (A77)", () => {
  it("every SD-02 step and every pinned step still differs from the script", async () => {
    // The parity cases above ran first in this file (node:test runs in order).
    const stale = [...textAllowed.keys()].filter((key) => !seenDiffering.has(key));
    assertNoProblems(stale.map((key) => `${key} no longer differs`), "divergences.json");
  });

  it("every SD-01 rule is used by some golden step, and every failing step has a rule", () => {
    const used = new Set<ExitRule>();
    const missing: string[] = [];
    for (const script of SCRIPTS) {
      for (const testCase of loadCases(script)) {
        for (const step of loadGolden(script, testCase.id).steps) {
          if (step.exit === 0) continue;
          const rule = exitRules.find((r) => r.script === script && r.script_exit === step.exit && (r.stderr === undefined || new RegExp(r.stderr).test(step.stderr)));
          if (rule === undefined) missing.push(`${script}/${testCase.id}#${step.step}`);
          else used.add(rule);
        }
      }
    }
    assertNoProblems(missing, "steps with no SD-01 rule");
    const unused = exitRules.filter((r) => !used.has(r)).map((r) => `${r.script} exit ${r.script_exit} -> ${r.buildos_exit}`);
    assertNoProblems(unused, "unused SD-01 rules");
  });

  it("the .xlsx content rule is recorded as parity exception PE-021, approved by the owner on 2026-11-25 (A76)", () => {
    const approved = JSON.parse(readFileSync(join(GOLDENS, "..", "parity-exceptions.json"), "utf8")) as { exceptions: { id: string; owner_decision: string; xlsx?: { helper: string } }[] };
    const entry = approved.exceptions.find((p) => p.id === "PE-021");
    assertSame(/2026-11-25, the owner approved PE-021/.test(entry?.owner_decision ?? ""), true, "PE-021 owner decision");
    assertSame(entry?.xlsx?.helper, "test/xlsx-compare.ts compareWorkbooks", "PE-021 helper");
    const proposed = JSON.parse(readFileSync(join(GOLDENS, "..", "proposed-exceptions.json"), "utf8")) as { proposed: { id: string }[] };
    assertSame(proposed.proposed.some((p) => p.id === "PE-021"), false, "PE-021 is no longer proposed");
  });

  it("the golden case files and the fixture cases match one to one", () => {
    for (const script of SCRIPTS) {
      const ids = loadCases(script).map((c) => c.id);
      for (const id of ids) assertSameBytes(String(loadGolden(script, id).case), id, `${script}/${id} golden`);
      // W1 R7 P9 review round 1 (P9-R1-18): both directions, so a golden with no fixture case fails too.
      const goldens = readdirSync(join(GOLDENS, script, "cases"))
        .filter((name) => name.endsWith(".json"))
        .map((name) => name.slice(0, -".json".length))
        .sort();
      assertSameList(goldens, [...ids].sort(), `${script} golden case files`);
    }
  });
});
