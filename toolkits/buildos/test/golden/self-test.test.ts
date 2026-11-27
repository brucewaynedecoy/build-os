// Planted-difference self-test for the golden harness (W1 R7 P2 t11, A17, A19).
//
// End to end: plants a one-byte change in a copy of the goldens for stdout,
// stderr, and the exit code of enforced cases, runs the real harness
// (compare.test.ts) against the copy, and asserts that it fails and names the
// case, the field, and the first differing line.
//
// Comparator level: plants one changed byte in a written file, checks the
// PDF whitespace rule both ways, and checks the parity-exception rules. No
// enforced domain writes files before P3, so the written-file plant compares
// a pending golden with itself; the comparator is the same code path the
// enforced cases use. Those plants read whichever golden of the case exists
// (shared, or one operating system's), because the comparator does not run
// the CLI and so does not depend on the running operating system.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  GOLDEN_ROOT,
  PACKAGE_ROOT,
  compareObservations,
  describeVerdict,
  existingGoldenDirs,
  firstDifference,
  goldenDir,
  judge,
  legacyNoticeLine,
  loadExceptions,
  loadProposed,
  stripLegacyNotice,
  loadManifest,
  readGolden,
  readGoldenDir,
  type ExceptionsFile,
  type GoldenCase,
} from "./harness.ts";

const manifest = loadManifest();
const byId = (id: string): GoldenCase => {
  const found = manifest.cases.find((c) => c.id === id);
  assert.ok(found !== undefined, `no case ${id}`);
  return found;
};

/** The first golden folder that exists for a case: shared, else one operating system's. */
const anyGoldenDir = (testCase: GoldenCase): string => {
  const [first] = existingGoldenDirs(testCase);
  assert.ok(first !== undefined, `case ${testCase.id} has no golden`);
  return first.dir;
};

let planted: string;

before(() => {
  planted = mkdtempSync(join(tmpdir(), "buildos-golden-planted-"));
  cpSync(GOLDEN_ROOT, planted, { recursive: true });
});

after(() => {
  rmSync(planted, { recursive: true, force: true });
});

/** Changes the byte at `offset` in a file (default: the first byte). */
function flipByte(path: string, offset = 0): void {
  const data = readFileSync(path);
  assert.ok(data.length > offset, `${path} is too short to plant a change`);
  data[offset] = (data[offset] as number) ^ 0x01;
  writeFileSync(path, data);
}

describe("planted differences through the real harness", () => {
  it("fails on one changed byte in stdout, stderr, and the exit code, and names case, field, and line", { timeout: 120_000 }, () => {
    const version = byId("cli-version");
    const badFlag = byId("cli-version-bad-flag");
    const json = byId("cli-version-json");
    // stdout: change one byte inside "version: dev".
    const stdoutPath = join(goldenDir(version, planted), "stdout");
    flipByte(stdoutPath, readFileSync(stdoutPath).indexOf("version: dev") + "version: ".length);
    const stdoutDetail = firstDifference(readFileSync(stdoutPath), readFileSync(join(goldenDir(version), "stdout")));
    assert.match(stdoutDetail, /^first difference at line \d+, byte offset \d+: expected "version: eev", actual "version: dev"$/);
    // stderr: change one byte in the middle of the error line.
    const stderrPath = join(goldenDir(badFlag, planted), "stderr");
    flipByte(stderrPath, readFileSync(stderrPath).indexOf("provided"));
    const stderrDetail = firstDifference(readFileSync(stderrPath), readFileSync(join(goldenDir(badFlag), "stderr")));
    // exit code: 0 becomes 1.
    const resultPath = join(goldenDir(json, planted), "result.json");
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as { exit: number };
    result.exit = 1;
    writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    const cases = JSON.parse(readFileSync(join(planted, "cases.json"), "utf8")) as { cases: GoldenCase[] };
    for (const c of cases.cases) if (c.id === json.id) c.exit = 1;
    writeFileSync(join(planted, "cases.json"), `${JSON.stringify(cases, null, 2)}\n`);

    // A child of `node --test` inherits NODE_TEST_CONTEXT and would report to
    // this run instead of running on its own; drop it.
    const env: NodeJS.ProcessEnv = { ...process.env, BUILDOS_GOLDEN_ROOT: planted, BUILDOS_GOLDEN_CASES: [version.id, badFlag.id, json.id, "cli-help"].join(",") };
    delete env["NODE_TEST_CONTEXT"];
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=spec", join(PACKAGE_ROOT, "test", "golden", "compare.test.ts")], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
      env,
    });
    const output = run.stdout + run.stderr;
    assert.equal(run.status, 1, `the harness must fail on planted differences:\n${output}`);
    assert.ok(output.includes(`golden case cli-version, field stdout: ${stdoutDetail}`), output);
    assert.ok(output.includes(`golden case cli-version-bad-flag, field stderr: ${stderrDetail}`), output);
    assert.match(output, /golden case cli-version-json, field exit: expected exit 1, actual exit 0/);
    // The unplanted case with a recorded exception still passes.
    assert.match(output, /✔ cli cli-help: buildos help/);
  });
});

describe("planted differences at the comparator", () => {
  it("fails on one changed byte in a written file and names the file and line", () => {
    const testCase = byId("intake-convert-csv");
    const golden = readGoldenDir(anyGoldenDir(testCase));
    const copy = mkdtempSync(join(tmpdir(), "buildos-golden-file-"));
    try {
      cpSync(anyGoldenDir(testCase), goldenDir(testCase, copy), { recursive: true });
      const [path] = [...golden.files.keys()];
      assert.ok(path !== undefined);
      const plantedFile = join(goldenDir(testCase, copy), "files", ...path.split("/"));
      const text = readFileSync(plantedFile, "utf8");
      flipByte(plantedFile, text.indexOf("desk volunteer"));
      const diffs = compareObservations(testCase, readGoldenDir(goldenDir(testCase, copy)), golden);
      assert.equal(diffs.length, 1);
      assert.equal(diffs[0]?.field, `file:${path}`);
      const message = describeVerdict(judge(testCase, diffs, { exceptions: [] }));
      assert.match(message, new RegExp(`golden case intake-convert-csv, field file:${path.replace(/[.]/g, "\\.")}: first difference at line 10`));
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it("fails on a changed file tree", () => {
    const testCase = byId("intake-convert-csv");
    const golden = readGoldenDir(anyGoldenDir(testCase));
    const actual = { ...golden, added: golden.added.slice(1) };
    const diffs = compareObservations(testCase, golden, actual);
    assert.deepEqual(diffs.map((d) => d.field), ["tree"]);
  });

  it("passes a whitespace-only PDF text change and fails a changed PDF word", () => {
    const testCase = byId("intake-convert-pdf-plain");
    assert.equal(testCase.pdf_text, true);
    const golden = readGoldenDir(anyGoldenDir(testCase));
    const [path, data] = [...golden.files].find(([p]) => p.endsWith(".txt")) ?? [];
    assert.ok(path !== undefined && data !== undefined);
    const text = data.toString("utf8");
    const bodyStart = text.indexOf("\n---\n") + 5;
    const spaced = text.slice(0, bodyStart) + text.slice(bodyStart).replace(/\n/g, "  \r\n\n\t").replace(/ /g, "   ");
    const withSpacing = { ...golden, files: new Map(golden.files).set(path, Buffer.from(spaced)) };
    assert.deepEqual(compareObservations(testCase, golden, withSpacing), []);

    const changedWord = { ...golden, files: new Map(golden.files).set(path, Buffer.from(text.replace("bicycles", "bicycler"))) };
    const diffs = compareObservations(testCase, golden, changedWord);
    assert.deepEqual(diffs.map((d) => d.field), [`file:${path}`]);

    // The PDF front matter stays exact.
    const changedFrontMatter = { ...golden, files: new Map(golden.files).set(path, Buffer.from(text.replace('type: "text"', 'type:  "text"'))) };
    assert.equal(compareObservations(testCase, golden, changedFrontMatter).length, 1);

    // The same whitespace change fails a case that is not PDF text.
    assert.equal(compareObservations({ ...testCase, pdf_text: false }, golden, withSpacing).length, 1);
  });

  it("allows a difference only with an exact exception, and fails on a stale exception", () => {
    const testCase = byId("cli-version");
    const golden = readGolden(testCase);
    const actual = { ...golden, stdout: Buffer.from("changed\n") };
    const diffs = compareObservations(testCase, golden, actual);
    const exact: ExceptionsFile = { exceptions: [{ id: "PE-900", summary: "", reason: "test", owner_decision: "test", go_seed: [], golden: [{ case: testCase.id, field: "stdout", actual: "changed\n" }] }] };
    assert.equal(judge(testCase, diffs, exact).unexplained.length, 0);
    const wrongValue: ExceptionsFile = { exceptions: [{ ...exact.exceptions[0]!, golden: [{ case: testCase.id, field: "stdout", actual: "other\n" }] }] };
    assert.equal(judge(testCase, diffs, wrongValue).unexplained.length, 1);
    const pending: ExceptionsFile = { exceptions: [{ ...exact.exceptions[0]!, golden: [{ case: testCase.id, field: "stdout", actual: null }] }] };
    assert.equal(judge(testCase, diffs, pending).unexplained.length, 1);
    const stale = judge(testCase, [], exact);
    assert.deepEqual(stale.stale, [{ id: "PE-900", case: testCase.id, field: "stdout" }]);
    assert.match(describeVerdict(stale), /parity exception PE-900 no longer matches a real difference/);
  });

  it("keeps every real exception on a real difference", () => {
    const exceptions = loadExceptions();
    assert.deepEqual(exceptions.exceptions.map((e) => e.id), ["PE-001", "PE-002", "PE-003", "PE-004", "PE-005", "PE-006", "PE-007", "PE-008", "PE-009", "PE-010", "PE-011", "PE-012", "PE-013", "PE-014", "PE-015", "PE-016", "PE-017", "PE-018", "PE-019", "PE-020", "PE-021", "PE-022"]);
  });

  it("no exception is pending; PE-018 and PE-019 (2026-11-24) and PE-021 (2026-11-25, the .xlsx content rule) were approved and carry the owner decision", () => {
    assert.deepEqual(loadProposed().proposed, []);
    for (const id of ["PE-018", "PE-019"]) {
      const entry = loadExceptions().exceptions.find((e) => e.id === id) as { owner_decision?: string } | undefined;
      assert.match(entry?.owner_decision ?? "", /evidence\.md#owner-decisions \(2026-11-24, the owner approved/);
    }
    const pe021 = loadExceptions().exceptions.find((e) => e.id === "PE-021");
    assert.match(pe021?.owner_decision ?? "", /evidence\.md#p9-owner-decisions-2026-11-25 \(2026-11-25, the owner approved PE-021/);
    assert.equal(pe021?.xlsx?.helper, "test/xlsx-compare.ts compareWorkbooks");
  });

  it("PE-016: requires exactly the legacy-name notice line first on stderr and removes it once", () => {
    const exceptions = loadExceptions();
    const line = "Note: the command name \"buildos-intake\" goes away in BuildOS 0.3.0. Use \"buildos intake\" instead.\n";
    assert.equal(legacyNoticeLine("buildos-intake", exceptions), line);
    assert.equal(legacyNoticeLine("buildos", exceptions), undefined);
    const rest = Buffer.from("buildos-intake: error: x\n");
    assert.deepEqual(stripLegacyNotice("buildos-intake", Buffer.concat([Buffer.from(line), rest]), exceptions), { stderr: rest });
    assert.match(stripLegacyNotice("buildos-intake", rest, exceptions).problem ?? "", /^PE-016: stderr under buildos-intake must start with exactly/);
    assert.match(stripLegacyNotice("buildos-intake", Buffer.from(line.replace("0.3.0", "0.4.0")), exceptions).problem ?? "", /^PE-016/);
    assert.match(stripLegacyNotice("buildos-design", Buffer.from(line), exceptions).problem ?? "", /^PE-016/);
    const twice = Buffer.concat([Buffer.from(line), Buffer.from(line)]);
    assert.deepEqual(stripLegacyNotice("buildos-intake", twice, exceptions).stderr, Buffer.from(line));
    assert.deepEqual(stripLegacyNotice("buildos", rest, exceptions), { stderr: rest });
  });

  it("reports the first differing line and byte offset", () => {
    assert.equal(firstDifference(Buffer.from("a\nb\nc"), Buffer.from("a\nb\nc")), "identical");
    assert.equal(firstDifference(Buffer.from("a\nbx\n"), Buffer.from("a\nby\n")), 'first difference at line 2, byte offset 3: expected "bx", actual "by"');
    assert.equal(firstDifference(Buffer.from("a\n"), Buffer.from("a\nmore\n")), 'first difference at line 2, byte offset 2: expected "", actual "more"');
  });
});
