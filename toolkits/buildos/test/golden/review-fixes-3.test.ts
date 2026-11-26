// Regression tests for the W1 R7 P2 win32 import round: --verify-artifact
// enumerates every folder in a downloaded set (not only the manifest
// cases), and the capture workflow's last step reports a mismatch even
// after `capture.mjs --report` fails. None of them runs Go.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { CAPTURE_RECORD, GOLDEN_ROOT, PACKAGE_ROOT, goldenDir, goldenSetManifest, loadManifest, osGoldenDir, verifyGoldenSet, type GoldenCase } from "./harness.ts";

const manifest = loadManifest();
const byId = (id: string): GoldenCase => {
  const found = manifest.cases.find((c) => c.id === id);
  assert.ok(found !== undefined, `no case ${id}`);
  return found;
};

describe("--verify-artifact refuses every folder that is not a derived golden or a capture result (win32 import round, finding 1)", () => {
  let root: string;
  let set: string;
  const recordPath = () => join(set, CAPTURE_RECORD);
  /** Rewrites golden_files from the set, as a consistent (resealed) artifact would. */
  const seal = (change: (r: Record<string, unknown>) => void = () => {}) => {
    const record = JSON.parse(readFileSync(recordPath(), "utf8")) as Record<string, unknown>;
    change(record);
    rmSync(recordPath());
    record["golden_files"] = goldenSetManifest(set);
    writeFileSync(recordPath(), `${JSON.stringify(record, null, 2)}\n`);
  };
  const problems = () => verifyGoldenSet(set, manifest).join("\n");
  const derivedCase = byId("entities-rebuild-apply-missing-json");
  const sharedCase = manifest.cases.find((c) => c.os_dependent === undefined && c.tool === "buildos-intake");
  assert.ok(sharedCase !== undefined);

  beforeEach(() => {
    rmSync(root ?? "", { recursive: true, force: true });
    root = mkdtempSync(join(tmpdir(), "buildos-golden-folders-"));
    set = join(root, "win32");
    cpSync(join(GOLDEN_ROOT, "os", "win32"), set, { recursive: true });
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("accepts the committed win32 set: 70 captured goldens and the three PE-005 derived goldens", () => {
    assert.deepEqual(verifyGoldenSet(set, manifest), []);
    const record = JSON.parse(readFileSync(recordPath(), "utf8")) as { os_goldens: number; derived_goldens: unknown[] };
    assert.equal(record.os_goldens, 70);
    assert.equal(record.derived_goldens.length, 3);
  });

  it("refuses an unlisted derived-looking case folder whose files golden_files lists (the reviewer's plant)", () => {
    cpSync(osGoldenDir(derivedCase, "win32", GOLDEN_ROOT), join(set, "buildos", "unlisted-derived-case"), { recursive: true });
    seal();
    assert.match(problems(), /buildos\/unlisted-derived-case names no case in cases\.json; the set must not hold it/);
    const run = spawnSync(process.execPath, [join(GOLDEN_ROOT, "capture.mjs"), "--verify-artifact", set], { cwd: PACKAGE_ROOT, encoding: "utf8" });
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, /buildos\/unlisted-derived-case names no case in cases\.json/);
  });

  it("refuses the same plant with a matching derived_goldens entry", () => {
    cpSync(join(set, "buildos", derivedCase.id), join(set, "buildos", "unlisted-derived-case"), { recursive: true });
    seal((r) => {
      (r["derived_goldens"] as Record<string, unknown>[]).push({ case: "unlisted-derived-case", path: "os/win32/buildos/unlisted-derived-case", derived: "PE-005" });
    });
    const found = problems();
    assert.match(found, /buildos\/unlisted-derived-case names no case in cases\.json/);
    assert.match(found, /derived_goldens lists unlisted-derived-case, which no platform exception class lists/);
  });

  it("refuses a case folder under another tool than the manifest names", () => {
    cpSync(join(set, "buildos", derivedCase.id), join(set, "buildos-intake", derivedCase.id), { recursive: true });
    seal();
    assert.match(problems(), new RegExp(`buildos-intake/${derivedCase.id} names no case in cases\\.json`));
  });

  it("refuses an OS golden of a shared case that is not a platform exception case", () => {
    const c = sharedCase;
    cpSync(goldenDir(c), join(set, c.tool, c.id), { recursive: true });
    seal();
    assert.match(problems(), new RegExp(`${c.tool}/${c.id} is an OS golden of a case that is not OS-dependent; a win32 set holds only OS-dependent cases`));
  });

  it("refuses a stray top-level folder or file, and a loose file in a tool folder", () => {
    mkdirSync(join(set, "extra", "case"), { recursive: true });
    writeFileSync(join(set, "extra", "case", "result.json"), "{}\n");
    writeFileSync(join(set, "notes.txt"), "x\n");
    writeFileSync(join(set, "buildos", "loose"), "x\n");
    seal();
    const found = problems();
    assert.match(found, /extra is not a golden tool folder/);
    assert.match(found, /notes\.txt is not a golden tool folder/);
    assert.match(found, /buildos\/loose is not a case folder/);
  });

  it("requires os_goldens to equal the captured folders, and refuses a skipped case's folder outside derived_goldens", () => {
    seal((r) => {
      r["os_goldens"] = 71;
    });
    assert.match(problems(), /os_goldens is 71, but the set holds 70 captured golden folder\(s\)/);
    seal((r) => {
      r["os_goldens"] = 70;
      (r["parity_exception_skips"] as Record<string, unknown>[]).push({ case: "entities-validate-compat", kind: "pe-005-skipped", exception: "PE-005" });
    });
    assert.match(problems(), /buildos\/entities-validate-compat: parity_exception_skips lists entities-validate-compat, so it was not captured, and derived_goldens does not list it/);
  });

  it("the committed darwin and linux sets still pass", () => {
    for (const platform of ["darwin", "linux"]) assert.deepEqual(verifyGoldenSet(join(GOLDEN_ROOT, "os", platform), manifest), [], platform);
  });
});

// W1 R7 P8 t12: the capture workflow this block checked is deleted with the
// Go sources; review-fixes.test.ts checks the frozen baseline instead.
