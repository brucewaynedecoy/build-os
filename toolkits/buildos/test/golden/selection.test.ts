// Golden selection tests (W1 R7 P2, per-OS goldens).
//
// Unit level: selectGolden picks the running OS's golden when one exists,
// else the shared golden, and reports missing-golden for an OS-dependent
// case with no golden for the running OS. It never uses another OS's golden,
// and never the shared golden of an OS-dependent case.
//
// End to end: runs the real harness (compare.test.ts) against a planted copy
// of the goldens and asserts that missing-golden fails an enforced domain and
// is only listed for a pending domain.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  GOLDEN_ROOT,
  PACKAGE_ROOT,
  existingGoldenDirs,
  goldenDir,
  loadManifest,
  osGoldenDir,
  osGoldenRoot,
  selectGolden,
  writeGolden,
  type GoldenCase,
  type Observation,
} from "./harness.ts";

const sample: GoldenCase = { id: "sample", tool: "buildos", domain: "cli", invocation: "buildos", args: [], fixture: null, kind: "success", exit: 0 };
const osDependent: GoldenCase = { ...sample, id: "sample-os", os_dependent: "OSD-1" };
const observation = (text: string): Observation => ({
  exit: 0,
  stdout: Buffer.from(text),
  stderr: Buffer.alloc(0),
  added: [],
  changed: [],
  removed: [],
  files: new Map(),
});

describe("golden selection", () => {
  let root: string;
  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-golden-select-"));
  });
  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("uses the shared golden when the operating system has none", () => {
    writeGolden(sample, observation("shared\n"), goldenDir(sample, root));
    assert.deepEqual(selectGolden(sample, "linux", root), { status: "shared", dir: goldenDir(sample, root) });
  });

  it("uses the operating system's golden over the shared golden", () => {
    writeGolden(sample, observation("windows\n"), osGoldenDir(sample, "win32", root));
    assert.deepEqual(selectGolden(sample, "win32", root), { status: "os", platform: "win32", dir: osGoldenDir(sample, "win32", root) });
    // Another operating system's golden never counts.
    assert.equal(selectGolden(sample, "linux", root).status, "shared");
    assert.equal(selectGolden(sample, "darwin", root).status, "shared");
  });

  it("reports missing-golden for an OS-dependent case without a golden for the running operating system", () => {
    writeGolden(osDependent, observation("darwin\n"), osGoldenDir(osDependent, "darwin", root));
    // A shared golden of an OS-dependent case is never used.
    writeGolden(osDependent, observation("shared\n"), goldenDir(osDependent, root));
    assert.equal(selectGolden(osDependent, "darwin", root).status, "os");
    const missing = selectGolden(osDependent, "win32", root);
    assert.equal(missing.status, "missing-golden");
    assert.match(missing.status === "missing-golden" ? missing.reason : "", /OS-dependent case \(OSD-1\) has no golden for win32/);
  });

  it("reports missing-golden for a case with no golden at all", () => {
    const none: GoldenCase = { ...sample, id: "sample-none" };
    assert.equal(selectGolden(none, "linux", root).status, "missing-golden");
    assert.deepEqual(existingGoldenDirs(none, root), []);
  });

  it("lists every existing golden of a case, shared first", () => {
    assert.deepEqual(existingGoldenDirs(sample, root).map((g) => g.source), ["shared", "win32"]);
  });
});

describe("missing-golden through the real harness", () => {
  const current = process.platform;
  const other = current === "linux" ? "win32" : "linux";
  let planted: string;

  before(() => {
    planted = mkdtempSync(join(tmpdir(), "buildos-golden-missing-"));
    cpSync(GOLDEN_ROOT, planted, { recursive: true });
    const manifest = loadManifest(planted);
    // Enforced: mark cli-version OS-dependent and keep its golden only on another OS.
    const enforced = manifest.cases.find((c) => c.id === "cli-version");
    assert.ok(enforced !== undefined && manifest.domains[enforced.domain]?.state === "enforced");
    moveToOtherOs(enforced);
    enforced.os_dependent = "OSD-1";
    // Pending: an OS-dependent discovery case with a golden only on another
    // OS. Every domain is enforced since the P4 and P5 merge, so the planted
    // copy marks the discovery domain pending again.
    const pending = manifest.cases.find((c) => c.id === "discovery-run-missing-root");
    assert.ok(pending !== undefined && pending.os_dependent !== undefined && manifest.domains[pending.domain] !== undefined);
    manifest.domains[pending.domain]!.state = "pending";
    moveToOtherOs(pending);
    writeFileSync(join(planted, "cases.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    // The other OS's set needs a capture record listed in CAPTURE.md.
    const recordFile = join(osGoldenRoot(other, planted), "capture-record.json");
    if (!existsSync(recordFile)) {
      mkdirSync(osGoldenRoot(other, planted), { recursive: true });
      writeFileSync(recordFile, JSON.stringify({ platform: other, repository_commit: "planted", go_version: "planted" }));
      const capturePath = join(planted, "CAPTURE.md");
      const text = readFileSync(capturePath, "utf8").replace(new RegExp(`^\\| \`${other}\` \\|.*$`, "m"), `| \`${other}\` | planted | planted | \`planted\` | \`planted\` | 0 | none |`);
      writeFileSync(capturePath, text);
    }
  });

  after(() => {
    rmSync(planted, { recursive: true, force: true });
  });

  function moveToOtherOs(testCase: GoldenCase) {
    const [source] = existingGoldenDirs(testCase, planted);
    assert.ok(source !== undefined);
    const target = osGoldenDir(testCase, other, planted);
    if (source.dir !== target) {
      rmSync(target, { recursive: true, force: true });
      cpSync(source.dir, target, { recursive: true });
    }
    rmSync(goldenDir(testCase, planted), { recursive: true, force: true });
    rmSync(osGoldenDir(testCase, current, planted), { recursive: true, force: true });
  }

  function runHarness(caseIds: string[]) {
    const env: NodeJS.ProcessEnv = { ...process.env, BUILDOS_GOLDEN_ROOT: planted, BUILDOS_GOLDEN_CASES: caseIds.join(",") };
    delete env["NODE_TEST_CONTEXT"];
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=spec", join(PACKAGE_ROOT, "test", "golden", "compare.test.ts")], {
      cwd: PACKAGE_ROOT,
      encoding: "utf8",
      env,
    });
    return { status: run.status, output: run.stdout + run.stderr };
  }

  it("fails an enforced case with no golden for the running operating system", { timeout: 120_000 }, () => {
    const { status, output } = runHarness(["cli-version"]);
    assert.equal(status, 1, output);
    assert.match(output, new RegExp(`golden case cli-version: missing-golden: OS-dependent case \\(OSD-1\\) has no golden for ${current}`));
    assert.match(output, /golden domain cli: enforced: 0\/1 cases match, 0 \S+ golden\(s\), 1 missing-golden/);
  });

  it("lists a pending case with no golden for the running operating system and does not fail", { timeout: 120_000 }, () => {
    const { status, output } = runHarness(["discovery-run-missing-root"]);
    assert.equal(status, 0, output);
    assert.match(output, /pending, not enforced: golden case discovery-run-missing-root: missing-golden/);
    assert.match(output, /golden domain discovery: pending \(enforced in P5; does not fail CI\): 0\/1 cases match, 0 \S+ golden\(s\), 1 missing-golden/);
  });
});
