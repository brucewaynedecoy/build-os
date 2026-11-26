// Golden parity harness (W1 R7 P2, PRD 20 Compatibility).
//
// Runs the bundled TypeScript CLI for every case in cases.json, under the
// case's invocation name, in a fresh copy of the case fixture, and compares
// stdout, stderr, the exit code, JSON output (stdout), and the file tree byte
// for byte against the Go goldens. PDF text cases compare written `.txt`
// bodies after whitespace normalization, under the PE-009 class check in both
// directions, also when the port text equals Go's
// (pdfWordGapClass in harness.ts), with the source PDF's word separations.
//
// Enforced domains fail on any difference without an exact parity exception
// and on any exception that no longer matches a real difference. Pending
// domains run and are listed in the summary, but do not fail.
//
// Each case uses the golden captured on the running operating system when one
// exists (os/<platform>/), else the shared golden. An OS-dependent case with no
// golden for the running operating system is reported as missing-golden: it
// fails an enforced domain and is listed for a pending domain.
//
// BUILDOS_GOLDEN_BIN_DIR runs each case from an installed package's .bin
// folder (W1 R7 P6 t5; on Windows through npm's .cmd shims).
// BUILDOS_GOLDEN_EXPECT_VERSION and BUILDOS_GOLDEN_EXPECT_REVISION (both or
// neither) name the release identity of a release-stamped tarball: the
// comparison then expects that identity where a golden holds the development
// identity (withBuildIdentity in harness.ts; W1 R7 P8 review round 1).
// BUILDOS_GOLDEN_ROOT points the harness at
// another golden folder, and
// BUILDOS_GOLDEN_CASES (comma-separated IDs) limits the cases. The
// planted-difference self-test uses both.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../../scripts/build.ts";
import { intakeParsers } from "../../src/adapters/intake-parsers.ts";
import {
  GOLDEN_ROOT,
  bundleRunner,
  installedRunner,
  compareObservations,
  derivedGoldenProblems,
  derivedGoldenRecords,
  describeVerdict,
  exceptionsWithBuildIdentity,
  existingGoldenDirs,
  expectedBuildIdentity,
  GOLDEN_PLATFORMS,
  goldenDir,
  hasGoldenDir,
  judge,
  listGoldenFiles,
  loadExceptions,
  loadProposed,
  loadManifest,
  PACKAGE_ROOT,
  pdfSeparations,
  readGoldenDir,
  runCase,
  selectGolden,
  stripLegacyNotice,
  type GoldenCase,
  type Runner,
  withBuildIdentity,
} from "./harness.ts";

const goldenRoot = process.env["BUILDOS_GOLDEN_ROOT"] ?? GOLDEN_ROOT;
const only = process.env["BUILDOS_GOLDEN_CASES"]?.split(",").filter((s) => s !== "");
const manifest = loadManifest(goldenRoot);
const selected = manifest.cases.filter((c) => only === undefined || only.includes(c.id));
const buildIdentity = expectedBuildIdentity();
// A release-stamped build: the exact values the exceptions pin hold the release identity too.
const capturedExceptions = loadExceptions(goldenRoot);
const capturedProposed = loadProposed(goldenRoot);
const exceptions = buildIdentity === undefined ? capturedExceptions : { ...capturedExceptions, exceptions: exceptionsWithBuildIdentity(capturedExceptions.exceptions, buildIdentity) };
const proposed = buildIdentity === undefined ? capturedProposed : { ...capturedProposed, proposed: exceptionsWithBuildIdentity(capturedProposed.proposed, buildIdentity) };

let dir: string;
let runner: Runner;
/** The source PDF's word separations (pdfSeparations) for each PDF text case with one PDF source file. */
const separations = new Map<string, string>();

before(
  async () => {
    dir = mkdtempSync(join(tmpdir(), "buildos-golden-bundle-"));
    const file = await bundle({ outfile: join(dir, "buildos.js") });
    // BUILDOS_GOLDEN_BIN_DIR: run every case from an installed package instead (t5).
    const binDir = process.env["BUILDOS_GOLDEN_BIN_DIR"];
    runner = binDir === undefined || binDir === "" ? bundleRunner(file) : installedRunner(binDir);
    for (const testCase of selected) {
      const source = testCase.args[testCase.args.indexOf("--source") + 1];
      if (testCase.pdf_text !== true || testCase.fixture === null || source === undefined || !source.endsWith(".pdf")) continue;
      const path = join(PACKAGE_ROOT, testCase.fixture, testCase.cwd ?? "", source);
      if (!existsSync(path) || !statSync(path).isFile()) continue;
      try {
        separations.set(testCase.id, pdfSeparations(await intakeParsers.pdfText(new Uint8Array(readFileSync(path)))));
      } catch {
        // A PDF pdf.js cannot read has no twin to compare.
      }
    }
  },
  { timeout: 60_000 },
);

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function stateOf(testCase: GoldenCase) {
  const domain = manifest.domains[testCase.domain];
  assert.ok(domain !== undefined, `case ${testCase.id} names unknown domain ${testCase.domain}`);
  return domain.state;
}

describe("golden manifest", () => {
  it("has unique IDs, known domains, and a golden for every case", () => {
    const ids = new Set<string>();
    for (const c of manifest.cases) {
      assert.ok(!ids.has(c.id), `duplicate case ID ${c.id}`);
      ids.add(c.id);
      stateOf(c);
      assert.ok(manifest.domains[c.domain]?.tools.includes(c.tool), `case ${c.id}: tool ${c.tool} is not a tool of domain ${c.domain}`);
      if (c.os_dependent === undefined) {
        assert.ok(hasGoldenDir(goldenDir(c, goldenRoot)), `case ${c.id} has no shared golden; run test/golden/capture.mjs --write-shared`);
      } else {
        assert.ok(!hasGoldenDir(goldenDir(c, goldenRoot)), `OS-dependent case ${c.id} has a shared golden, which is never used; remove it by a new capture`);
      }
      const goldens = existingGoldenDirs(c, goldenRoot);
      assert.ok(goldens.length > 0, `case ${c.id} has no golden on any operating system; run test/golden/capture.mjs`);
      for (const g of goldens) {
        assert.equal(readGoldenDir(g.dir).exit, c.exit, `case ${c.id}: the manifest exit code must equal the ${g.source} golden exit code`);
      }
    }
  });

  it("gives every OS-dependent case a known group with a reason", () => {
    const groups = new Map(manifest.os_dependent_groups.map((g) => [g.id, g]));
    for (const g of groups.values()) assert.ok(g.reason.length > 40 && g.summary.length > 0, `${g.id} needs a summary and a reason`);
    const used = new Set<string>();
    for (const c of manifest.cases) {
      if (c.os_dependent === undefined) continue;
      assert.ok(groups.has(c.os_dependent), `case ${c.id} names unknown OS-dependent group ${c.os_dependent}`);
      used.add(c.os_dependent);
    }
    assert.deepEqual([...used].sort(), [...groups.keys()].sort(), "every OS-dependent group must be used");
  });

  it("lists every OS golden set in CAPTURE.md with its capture record", () => {
    const capture = readFileSync(join(goldenRoot, "CAPTURE.md"), "utf8");
    for (const platform of GOLDEN_PLATFORMS) {
      const recordFile = join(goldenRoot, "os", platform, "capture-record.json");
      if (!existsSync(recordFile)) {
        // Before its first capture, a set may hold only derived goldens
        // (PE-005), which a capture keeps and lists in its record.
        const setRoot = join(goldenRoot, "os", platform);
        const derived = new Set(derivedGoldenRecords(manifest, platform, goldenRoot).map((d) => `${d.path.slice(`os/${platform}/`.length)}/`));
        const captured = listGoldenFiles(setRoot).filter((f) => ![...derived].some((d) => f.startsWith(d)));
        assert.deepEqual(captured, [], `os/${platform}/ has captured goldens but no capture-record.json`);
        continue;
      }
      const record = JSON.parse(readFileSync(recordFile, "utf8")) as { platform: string; repository_commit: string; go_version: string };
      assert.equal(record.platform, platform);
      const row = capture.split("\n").find((line) => line.startsWith(`| \`${platform}\` |`));
      assert.ok(row?.includes(record.repository_commit) && row.includes(record.go_version), `CAPTURE.md must list the ${platform} capture record; run node test/golden/capture.mjs --record`);
    }
  });

  it("covers success and an error exit for each Go tool, and help and version for each invocation name", () => {
    for (const tool of ["buildos", "buildos-intake", "buildos-discovery", "buildos-design"]) {
      const cases = manifest.cases.filter((c) => c.tool === tool);
      assert.ok(cases.some((c) => c.kind === "success" && c.exit === 0), `${tool} has no success case`);
      assert.ok(cases.some((c) => c.exit !== 0), `${tool} has no error-exit case`);
    }
    for (const invocation of ["buildos", "buildos-intake", "buildos-discovery", "buildos-design"]) {
      const cases = manifest.cases.filter((c) => c.invocation === invocation);
      assert.ok(cases.some((c) => c.kind === "help"), `${invocation} has no help case`);
      assert.ok(cases.some((c) => c.kind === "version"), `${invocation} has no version case`);
    }
  });

  it("lists every normalization with a reason and marks the commands that had no JSON mode in Go", () => {
    assert.deepEqual(manifest.normalizations.map((n) => n.id), ["N1", "N2", "N3"]);
    for (const n of manifest.normalizations) assert.ok(n.reason.length > 20, `${n.id} needs a reason`);
    assert.ok(manifest.commands.some((c) => !c.go_json_mode));
  });

  it("accepts a derived golden only for a case of a platform exception class, equal to a fresh derivation", () => {
    assert.deepEqual(derivedGoldenProblems(manifest, exceptions, goldenRoot), []);
  });

  it("gives every parity exception a reason, an owner decision, and known cases", () => {
    const ids = new Set(manifest.cases.map((c) => c.id));
    for (const e of exceptions.exceptions) {
      assert.match(e.id, /^PE-\d{3}$/);
      assert.ok(e.reason.length > 0 && e.owner_decision.includes("evidence.md#owner-decisions"), `${e.id} needs a reason and an owner decision link`);
      for (const c of e.cases ?? []) {
        assert.ok(ids.has(c.case), `${e.id} names unknown case ${c.case}`);
        assert.ok(e.platform !== undefined && (e.rule ?? "").length > 0 && (e.class ?? "").length > 0, `${e.id} needs a class, a platform, and a rule`);
      }
      for (const g of e.golden) {
        assert.ok(ids.has(g.case), `${e.id} names unknown case ${g.case}`);
        const testCase = manifest.cases.find((c) => c.id === g.case);
        if (testCase !== undefined && stateOf(testCase) === "enforced") {
          assert.notEqual(g.actual, null, `${e.id} entry for enforced case ${g.case} needs the exact allowed value`);
        }
      }
    }
  });
});

// W1 R7 P6 review round 2 (P6-R1-14): when CI runs this file from the
// installed tarball, every case must start from that package's own `.bin`
// entries (npm's real `.cmd` shims on Windows), never from the bundle. So a
// CI change that stops using them fails here, and the workflow check in
// `test/package.test.ts` fails when the step stops setting the folder.
describe("installed runner", () => {
  it("runs every invocation name from the installed package's node_modules/.bin (the .cmd shims on Windows)", (t) => {
    const binDir = process.env["BUILDOS_GOLDEN_BIN_DIR"];
    if (binDir === undefined || binDir === "") return t.skip("runs only in the CI step that installs the tarball (BUILDOS_GOLDEN_BIN_DIR)");
    const bin = resolve(binDir);
    assert.ok(bin.endsWith(`${sep}node_modules${sep}.bin`), `BUILDOS_GOLDEN_BIN_DIR must be an installed node_modules/.bin, got ${bin}`);
    for (const name of ["buildos", "buildos-intake", "buildos-discovery", "buildos-design"]) {
      const shim = join(bin, process.platform === "win32" ? `${name}.cmd` : name);
      assert.ok(existsSync(shim), `${shim} is not there`);
      const [program] = runner.command(name);
      assert.equal(resolve(program), shim, `${name} must start from ${shim}`);
      if (process.platform === "win32") {
        const run = runner.windowsShim?.(name, ["version"]);
        assert.ok(run !== undefined, "on Windows, every case runs through cmd.exe and the shim");
        assert.match(run.file, /cmd\.exe$/i);
        assert.ok(run.args.join(" ").includes(name), run.args.join(" "));
      }
    }
  });
});

describe("golden parity", () => {
  const summary = new Map<string, { state: string; total: number; match: number; allowed: number; pending: string[]; missing: number; os: number }>();

  for (const testCase of selected) {
    const state = stateOf(testCase);
    const name = `${testCase.domain} ${testCase.id}: ${testCase.invocation} ${testCase.args.join(" ")}`.trim();
    it(name, (t) => {
      const row = summary.get(testCase.domain) ?? { state, total: 0, match: 0, allowed: 0, pending: [] as string[], missing: 0, os: 0 };
      summary.set(testCase.domain, row);
      row.total++;
      const selection = selectGolden(testCase, process.platform, goldenRoot);
      if (selection.status === "missing-golden") {
        row.missing++;
        const message = `golden case ${testCase.id}: missing-golden: ${selection.reason}`;
        if (state === "pending") {
          t.diagnostic(`pending, not enforced: ${message}`);
          return;
        }
        assert.fail(message);
      }
      if (selection.status === "os") row.os++;
      const captured = readGoldenDir(selection.dir);
      const golden = buildIdentity === undefined ? captured : withBuildIdentity(captured, buildIdentity);
      const run = runCase(testCase, runner);
      // PE-016: a legacy name writes one notice line first; it is checked and removed here.
      const notice = stripLegacyNotice(testCase.invocation, run.observation.stderr, exceptions);
      assert.equal(notice.problem, undefined, notice.problem);
      const observation = { ...run.observation, stderr: notice.stderr };
      const diffs = compareObservations(testCase, golden, observation, { pdfSeparations: separations.get(testCase.id), pdfClass: true });
      const verdict = judge(testCase, diffs, exceptions, process.platform, proposed);
      if (verdict.unexplained.length === 0 && verdict.stale.length === 0) row.match++;
      row.allowed += verdict.allowed.length;
      for (const p of verdict.pending) row.pending.push(`${testCase.id} ${p.diff.field} (${p.id}, waits for an owner decision)`);
      if (state === "pending") {
        if (verdict.unexplained.length > 0) t.diagnostic(`pending, not enforced: ${verdict.unexplained.length} difference(s)`);
        return;
      }
      assert.ok(verdict.unexplained.length === 0 && verdict.stale.length === 0, describeVerdict(verdict));
    });
  }

  it("summary", (t) => {
    t.diagnostic(buildIdentity === undefined ? "build identity expected: the goldens' development identity (dev, unknown)" : `build identity expected: ${buildIdentity.version} at ${buildIdentity.sourceRevision} (a release-stamped build)`);
    for (const [domain, info] of Object.entries(manifest.domains)) {
      const row = summary.get(domain);
      const counts =
        row === undefined
          ? "no cases selected"
          : `${row.match}/${row.total} cases match${row.allowed > 0 ? `, ${row.allowed} recorded exception field(s)` : ""}${row.pending.length > 0 ? `, pending (not approved): ${row.pending.join("; ")}` : ""}` +
            `, ${row.os} ${process.platform} golden(s)${row.missing > 0 ? `, ${row.missing} missing-golden` : ""}`;
      t.diagnostic(`golden domain ${domain}: ${info.state}${info.state === "pending" ? ` (enforced in ${info.owner_phase}; does not fail CI)` : ""}: ${counts}`);
    }
  });
});
