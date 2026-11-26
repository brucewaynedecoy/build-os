// Regression tests for stale golden folders (W1 R7 P2): a shared golden of
// an OS-dependent case, an OS golden of a shared case, and a golden folder of
// a case that is not in cases.json. `capture.mjs --check` must fail and name
// each one (staleGoldenProblems). A capture, with or without --report, must
// record each removal in golden_changes as removed-stale (removeStaleGoldens)
// and never remove a folder without recording it. None of them runs Go.

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import {
  GOLDEN_ROOT,
  findStaleGoldens,
  goldenDir,
  loadManifest,
  osGoldenDir,
  planCapture,
  removeStaleGoldens,
  staleGoldenProblems,
  type GoldenCase,
} from "./harness.ts";

const manifest = loadManifest();
const byId = (id: string): GoldenCase => {
  const found = manifest.cases.find((c) => c.id === id);
  assert.ok(found !== undefined, `no case ${id}`);
  return found;
};

// Two OS-dependent cases and one shared case.
const osCase = byId("entities-validate-missing-root-json");
const osCase2 = byId("entities-validate-compat");
const sharedCase = byId("discovery-help");

describe("stale golden folders: --check fails and a capture records every removal", () => {
  let root: string;
  let goldens: string;

  beforeEach(() => {
    rmSync(root ?? "", { recursive: true, force: true });
    root = mkdtempSync(join(tmpdir(), "buildos-golden-stale-"));
    goldens = join(root, "goldens");
    cpSync(GOLDEN_ROOT, goldens, { recursive: true });
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** Plants one stale folder of each kind; returns their paths, sorted. */
  function plantAll(): string[] {
    // 1. A shared golden of an OS-dependent case, with stdout that differs from the darwin golden.
    const shared = goldenDir(osCase, goldens);
    cpSync(osGoldenDir(osCase, "darwin", goldens), shared, { recursive: true });
    writeFileSync(join(shared, "stdout"), "planted stdout\n");
    // 1b. An incomplete shared golden (no result.json) of a second OS-dependent case.
    const shared2 = goldenDir(osCase2, goldens);
    mkdirSync(shared2, { recursive: true });
    writeFileSync(join(shared2, "stdout"), "partial\n");
    // 2. An OS golden of a shared case, on another operating system.
    cpSync(goldenDir(sharedCase, goldens), osGoldenDir(sharedCase, "linux", goldens), { recursive: true });
    // 3. Golden folders of cases that are not in cases.json, shared and per OS.
    mkdirSync(join(goldens, "buildos", "no-such-case"), { recursive: true });
    writeFileSync(join(goldens, "buildos", "no-such-case", "result.json"), "{}\n");
    mkdirSync(join(goldens, "os", "darwin", "buildos-intake", "gone-case"), { recursive: true });
    return [
      `os/linux/${sharedCase.tool}/${sharedCase.id}`,
      `${osCase.tool}/${osCase.id}`,
      `${osCase2.tool}/${osCase2.id}`,
      "buildos/no-such-case",
      "os/darwin/buildos-intake/gone-case",
    ].sort();
  }

  it("finds no stale golden folder in the committed goldens", () => {
    assert.deepEqual(findStaleGoldens(manifest), []);
    assert.deepEqual(staleGoldenProblems(manifest, goldens), []);
  });

  it("--check names every stale folder of all three kinds", () => {
    const paths = plantAll();
    const problems = staleGoldenProblems(manifest, goldens);
    assert.equal(problems.length, paths.length);
    const text = problems.join("\n");
    for (const p of paths) assert.ok(text.includes(`stale golden folder ${p}:`), `--check does not name ${p}:\n${text}`);
    assert.match(text, new RegExp(`${osCase.id}: stale golden folder ${osCase.tool}/${osCase.id}: shared golden of an OS-dependent case`));
    assert.match(text, new RegExp(`${osCase2.id}: stale golden folder ${osCase2.tool}/${osCase2.id}: shared golden of an OS-dependent case`));
    assert.match(text, /discovery-help: stale golden folder os\/linux\/buildos-discovery\/discovery-help: OS golden of a case that is not OS-dependent/);
    assert.match(text, /no-such-case: stale golden folder buildos\/no-such-case: golden folder of a case that is not in cases\.json/);
    assert.match(text, /gone-case: stale golden folder os\/darwin\/buildos-intake\/gone-case: golden folder of a case that is not in cases\.json/);
  });

  it("--check names this OS's own golden of a shared case", () => {
    cpSync(goldenDir(sharedCase, goldens), osGoldenDir(sharedCase, "darwin", goldens), { recursive: true });
    assert.deepEqual(staleGoldenProblems(manifest, goldens), [
      "discovery-help: stale golden folder os/darwin/buildos-discovery/discovery-help: OS golden of a case that is not OS-dependent (a shared case reads the shared golden)",
    ]);
  });

  it("--report records every removal as removed-stale with its path, and removes only those folders", () => {
    const paths = plantAll();
    const changes = removeStaleGoldens(manifest, { platform: "darwin", root: goldens });
    assert.deepEqual(changes.map((c) => c.kind), paths.map(() => "removed-stale"));
    assert.deepEqual(changes.map((c) => c.path), paths);
    assert.deepEqual(
      changes.map((c) => c.reason),
      changes.map((c) =>
        c.path?.startsWith("os/linux/") === true
          ? "os-golden-for-shared-case"
          : c.case === "no-such-case" || c.case === "gone-case"
            ? "case-not-in-manifest"
            : "shared-golden-for-os-dependent-case",
      ),
    );
    for (const p of paths) assert.equal(existsSync(join(goldens, ...p.split("/"))), false, `${p} was not removed`);
    assert.deepEqual(findStaleGoldens(manifest, { root: goldens }), []);
    // The goldens that are not stale stay.
    assert.ok(existsSync(join(osGoldenDir(osCase, "darwin", goldens), "result.json")));
    assert.ok(existsSync(join(goldenDir(sharedCase, goldens), "result.json")));
  });

  it("--report leaves this OS's own golden of a shared case to planCapture, which records it as removed-stale with its path and reason", () => {
    const own = osGoldenDir(sharedCase, "darwin", goldens);
    cpSync(goldenDir(sharedCase, goldens), own, { recursive: true });
    assert.deepEqual(removeStaleGoldens(manifest, { platform: "darwin", root: goldens }), []);
    assert.ok(existsSync(own));
    const plan = planCapture(sharedCase, goldenDir(sharedCase, goldens), { platform: "darwin", writeShared: false, root: goldens });
    assert.deepEqual(plan.drift, [
      { case: "discovery-help", kind: "removed-stale", path: "os/darwin/buildos-discovery/discovery-help", reason: "os-golden-for-shared-case" },
    ]);
    assert.equal(plan.removeOwn, true);
    // --write-shared removes it too, and records it the same way.
    const shared = planCapture(sharedCase, goldenDir(sharedCase, goldens), { platform: "darwin", writeShared: true, root: goldens });
    assert.deepEqual(shared.drift, [
      { case: "discovery-help", kind: "removed-stale", path: "os/darwin/buildos-discovery/discovery-help", reason: "os-golden-for-shared-case" },
    ]);
    assert.equal(shared.removeOwn, true);
  });

  it("planCapture never removes the shared golden of an OS-dependent case on its own", () => {
    plantAll();
    const plan = planCapture(osCase, osGoldenDir(osCase, "darwin", goldens), { platform: "darwin", writeShared: false, root: goldens });
    assert.deepEqual(plan, { write: "own", removeOwn: false, drift: [] });
    assert.ok(existsSync(goldenDir(osCase, goldens)));
  });
});
