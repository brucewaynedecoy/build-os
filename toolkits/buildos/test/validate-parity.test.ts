// W1 R7 P7 t15 and A60: `buildos validate` parity with the legacy validator
// (`validate_config.py`) on every validate fixture case.
//
// For each case in test/fixtures/validate/cases.json, the case project is
// built in a temporary folder (installed layout) and checked with
// `buildos validate --root <folder> --json`. The findings must equal the
// recorded legacy findings (test/golden/validate/cases/<id>.json) as a
// multiset of parity keys (code, path, field, detail), after the recorded
// deliberate divergences (test/golden/validate/divergences.json) are
// applied, and the command must pass or fail as that set says. No Python
// runs: the legacy results were captured once by capture.ts.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { run } from "../src/cli/run.ts";
import { GOLDENS, keyText, loadCases, loadGolden, materialize, pythonKeys, type ParityKey } from "./golden/validate/cases.ts";
import { captureIo } from "./helpers.ts";

interface CaseDivergence {
  divergence: string;
  python_only: [string, string, string, string | null][];
  buildos_only: [string, string, string, string | null][];
}

interface DivergenceFile {
  divergences: { id: string; summary: string; reason: string; authority: string; changes_pass_fail: string }[];
  cases: Record<string, CaseDivergence>;
}

const DIVERGENCES = JSON.parse(readFileSync(join(GOLDENS, "divergences.json"), "utf8")) as DivergenceFile;
const scratch = mkdtempSync(join(tmpdir(), "buildos-validate-parity-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const asKey = ([code, path, field, detail]: [string, string, string, string | null]): string =>
  keyText(detail === null ? { code, path, field } : { code, path, field, detail });

function removeEach(from: string[], items: string[], what: string): string[] {
  const left = [...from];
  for (const item of items) {
    const index = left.indexOf(item);
    assert.ok(index >= 0, `${what} ${item} is not a real difference`);
    left.splice(index, 1);
  }
  return left;
}

async function validate(id: string): Promise<{ exit: number; envelope: { ok: boolean; result: { status: string; findings: ParityKey[] } } }> {
  const root = join(scratch, `case-${id}`);
  materialize(id, root);
  const io = captureIo(scratch);
  const exit = await run(["validate", "--root", root, "--json"], io);
  assert.equal(io.stderr(), "");
  return { exit, envelope: JSON.parse(io.stdout()) };
}

describe("buildos validate parity with the legacy validator (A60)", () => {
  const cases = loadCases();

  it("every case has a recorded legacy result, and every recorded result has a case", () => {
    const ids = cases.map((c) => c.id).sort();
    const goldens = readdirSync(join(GOLDENS, "cases")).map((name) => name.replace(/\.json$/, "")).sort();
    assert.deepEqual(goldens, ids);
    assert.ok(ids.includes("crlf") && ids.length >= 70, "the fixture set is complete");
    for (const id of Object.keys(DIVERGENCES.cases)) assert.ok(ids.includes(id), `divergence case ${id} has a fixture`);
    const known = new Set(DIVERGENCES.divergences.map((d) => d.id));
    for (const [id, entry] of Object.entries(DIVERGENCES.cases)) assert.ok(known.has(entry.divergence), `${id} names a recorded divergence`);
  });

  it("the base project passes, as it did with the legacy script", async () => {
    const { exit, envelope } = await validate("base");
    assert.equal(exit, 0);
    assert.equal(envelope.ok, true);
  });

  for (const testCase of cases) {
    it(`${testCase.id}: ${testCase.about}`, async () => {
      const golden = loadGolden(testCase.id);
      const divergence = DIVERGENCES.cases[testCase.id];
      if (golden.crashed) assert.ok(divergence !== undefined, "a legacy crash needs a recorded divergence");
      // The legacy keys, less what buildos validate no longer reports, plus what it adds.
      const expected = [...removeEach(pythonKeys(golden), (divergence?.python_only ?? []).map(asKey), "python_only"), ...(divergence?.buildos_only ?? []).map(asKey)].sort();
      for (const key of (divergence?.buildos_only ?? []).map(asKey)) assert.ok(!pythonKeys(golden).includes(key) || golden.crashed, `buildos_only ${key} is also a legacy finding`);
      const { exit, envelope } = await validate(testCase.id);
      const actual = envelope.result.findings.map(keyText).sort();
      assert.deepEqual(actual, expected);
      const passes = expected.length === 0;
      assert.equal(envelope.ok, passes);
      assert.equal(envelope.result.status, passes ? "passed" : "failed");
      assert.equal(exit, passes ? 0 : 4);
      if (divergence === undefined) assert.equal(passes, golden.exit === 0, "pass or fail matches the legacy script");
    });
  }
});
