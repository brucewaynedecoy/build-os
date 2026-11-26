// PE-005, the Go Windows directory-sync defect (W1 R7 P2). Go 1.24.1 fails
// its post-rename folder sync on Windows with `Access is denied.` in six
// cases. The owner decision makes the Linux/macOS Go result the Windows
// parity target. These tests simulate win32 on any operating system: golden
// selection, the capture skip, and the rule that the harness accepts a
// derived golden only for a case that PE-005 lists. None of them runs Go.

import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import {
  CAPTURE_RECORD,
  GOLDEN_ROOT,
  deriveGolden,
  derivedGoldenProblems,
  derivedGoldenRecords,
  goldenDirDigest,
  goldenDir,
  goldenObservationDigest,
  goldenSetManifest,
  loadExceptions,
  loadManifest,
  observationDigest,
  osGoldenDir,
  parityExceptionMismatch,
  parityExceptionSkip,
  platformExceptionCases,
  readDerived,
  readGoldenDir,
  selectGolden,
  verifyGoldenSet,
  windowsPathSpelling,
  writeGolden,
  type DerivedGoldenRecord,
  type ExceptionsFile,
  type GoldenCase,
  type Observation,
  type ParityExceptionSkip,
} from "./harness.ts";

const manifest = loadManifest();
const exceptions = loadExceptions();
const byId = (id: string): GoldenCase => {
  const found = manifest.cases.find((c) => c.id === id);
  assert.ok(found !== undefined, `no case ${id}`);
  return found;
};

const ENTITY_CASES = ["entities-rebuild-apply-missing-json", "entities-consolidate-apply-json", "entities-consolidate-apply-index-failure-json"];
const DESIGN_CASES = ["design-promote-baseline", "design-promote-change-redirected", "design-installed-promote"];

function withoutPe005(file: ExceptionsFile): ExceptionsFile {
  return { ...file, exceptions: file.exceptions.filter((e) => e.id !== "PE-005") };
}

describe("PE-005 entry", () => {
  it("lists exactly the six cases for win32, sourced only from parity-exceptions.json", () => {
    const pe = exceptions.exceptions.find((e) => e.id === "PE-005");
    assert.ok(pe !== undefined);
    assert.equal(pe.class, "Go Windows directory-sync defect");
    assert.equal(pe.platform, "win32");
    assert.match(pe.owner_decision, /evidence\.md#owner-decisions/);
    assert.deepEqual([...platformExceptionCases(exceptions, "win32").keys()].sort(), [...ENTITY_CASES, ...DESIGN_CASES].sort());
    assert.equal(platformExceptionCases(exceptions, "linux").size, 0);
    assert.equal(platformExceptionCases(exceptions, "darwin").size, 0);
    for (const id of ENTITY_CASES) assert.equal(platformExceptionCases(exceptions, "win32").get(id)?.entry.win32_golden.source, `os/linux/buildos/${id}`);
    for (const id of DESIGN_CASES) {
      assert.equal(platformExceptionCases(exceptions, "win32").get(id)?.entry.win32_golden.source, "shared");
      assert.equal(byId(id).os_dependent, undefined, `${id} must be a shared case`);
    }
  });
});

describe("simulated win32 golden selection", () => {
  for (const id of ENTITY_CASES) {
    it(`${id} uses its derived PE-005 golden, with the Linux/macOS exit code`, () => {
      const testCase = byId(id);
      const selection = selectGolden(testCase, "win32");
      assert.equal(selection.status, "os");
      assert.ok(selection.status === "os");
      assert.equal(selection.dir, osGoldenDir(testCase, "win32"));
      assert.deepEqual(readDerived(selection.dir)?.exception, "PE-005");
      const golden = readGoldenDir(selection.dir);
      const linux = readGoldenDir(osGoldenDir(testCase, "linux"));
      assert.equal(golden.exit, testCase.exit);
      assert.deepEqual(golden.added, linux.added);
      assert.deepEqual(golden.changed, linux.changed);
      assert.deepEqual(golden.removed, linux.removed);
      assert.deepEqual([...golden.files.keys()], [...linux.files.keys()]);
      for (const [path, data] of golden.files) assert.ok(data.equals(linux.files.get(path) as Buffer), `${path} must keep the Linux bytes`);
      assert.equal(golden.modes, undefined, "Windows has no permission bits");
      const stdout = golden.stdout.toString("utf8");
      assert.ok(!stdout.includes("{ROOT}/"), "every {ROOT} path uses Windows separators");
      assert.ok(!stdout.includes("Access is denied"), "the derived golden never holds the Go defect");
      assert.match(stdout, /"root": "\{ROOT\}\\\\root"/);
    });
  }

  for (const id of DESIGN_CASES) {
    it(`${id} uses the shared golden`, () => {
      const testCase = byId(id);
      const selection = selectGolden(testCase, "win32");
      assert.equal(selection.status, "shared");
      assert.ok(selection.status === "shared");
      assert.equal(readGoldenDir(selection.dir).exit, 0);
    });
  }

  it("the index-failure case keeps exit 6 and the recovery command, with the Windows error text", () => {
    const stdout = readGoldenDir(osGoldenDir(byId("entities-consolidate-apply-index-failure-json"), "win32")).stdout.toString("utf8");
    const parsed = JSON.parse(stdout) as { write_status: string; result: { recovery_command: string; index: { state: string } }; diagnostics: { message: string }[] };
    assert.equal(parsed.write_status, "canonical_applied_index_failed");
    assert.equal(parsed.result.recovery_command, 'buildos entities rebuild-index --root "{ROOT}\\\\root" --mode strict --apply');
    assert.equal(parsed.result.index.state, "missing");
    assert.equal(
      parsed.diagnostics[0]?.message,
      'canonical entity data was applied, but index completion failed: create entity-resolution index directory "{ROOT}\\\\root\\\\.os\\\\indexes": mkdir {ROOT}\\root\\.os\\indexes: The system cannot find the path specified.',
    );
  });
});

/** The real Go defect observation on win32 (capture run 45293367433), committed as evidence. */
const EVIDENCE = join(GOLDEN_ROOT, "evidence", "pe-005-win32");
const realDefect = (testCase: GoldenCase): Observation => readGoldenDir(join(EVIDENCE, testCase.tool, testCase.id));

describe("PE-005 capture skip", () => {
  for (const id of [...ENTITY_CASES, ...DESIGN_CASES]) {
    it(`${id}: the recorded digest is the real Go defect observation, which is pe-005-skipped on win32`, () => {
      const testCase = byId(id);
      const entry = platformExceptionCases(exceptions, "win32").get(id)?.entry;
      assert.ok(entry !== undefined);
      assert.equal(goldenObservationDigest(join(EVIDENCE, testCase.tool, id)), entry.go_observation_sha256);
      const observation = realDefect(testCase);
      assert.equal(observation.exit, entry.go_exit);
      assert.ok(observation[entry.go_stream].toString("utf8").includes(entry.go_text), "the evidence holds the described defect text");
      const skip = parityExceptionSkip(testCase, observation, "win32", exceptions);
      assert.ok(skip !== undefined);
      assert.equal(skip.kind, "pe-005-skipped");
      assert.equal(skip.exception, "PE-005");
      assert.equal(skip.manifest_exit, testCase.exit);
      assert.notEqual(skip.go_exit, testCase.exit);
      assert.equal(skip.observation_sha256, entry.go_observation_sha256);
      assert.equal(skip.golden, DESIGN_CASES.includes(id) ? "shared" : `os/win32/buildos/${id}`);
      assert.equal(parityExceptionMismatch(testCase, observation, "win32", exceptions), undefined);
    });
  }

  const refused = (testCase: GoldenCase, observation: Observation) => {
    assert.equal(parityExceptionSkip(testCase, observation, "win32", exceptions), undefined);
    assert.match(parityExceptionMismatch(testCase, observation, "win32", exceptions) ?? "", /PE-005 lists this case for win32, but Go's observation .* is not the recorded defect/);
  };

  it("refuses the defect with a second, different error appended (the reviewer's plant)", () => {
    for (const id of DESIGN_CASES) {
      const testCase = byId(id);
      const observation = realDefect(testCase);
      refused(testCase, { ...observation, stderr: Buffer.concat([observation.stderr, Buffer.from("buildos-design: error: a second, different error\n")]) });
    }
    for (const id of ENTITY_CASES) {
      const testCase = byId(id);
      const observation = realDefect(testCase);
      refused(testCase, { ...observation, stderr: Buffer.from("buildos: error: a second, different error\n") });
      refused(testCase, { ...observation, stdout: Buffer.from(observation.stdout.toString("utf8").replace('"diagnostics": [', '"diagnostics": [\n    {"code": "other", "message": "a second error"},')) });
    }
  });

  it("refuses the defect with a changed filesystem effect", () => {
    for (const id of [...ENTITY_CASES, ...DESIGN_CASES]) {
      const testCase = byId(id);
      const observation = realDefect(testCase);
      const [path, data] = [...observation.files][0] as [string, Buffer];
      refused(testCase, { ...observation, files: new Map([[path, Buffer.concat([data, Buffer.from("x")])]]) });
      refused(testCase, { ...observation, added: [...observation.added, { path: "extra.md", kind: "file" }], files: new Map([...observation.files, ["extra.md", Buffer.from("x")]]) });
      refused(testCase, { ...observation, changed: [], added: [], files: new Map() });
      refused(testCase, { ...observation, modes: new Map([[path, "0644"]]) });
    }
  });

  it("refuses the defect with a different stderr or stdout", () => {
    const testCase = byId("design-promote-baseline");
    const observation = realDefect(testCase);
    refused(testCase, { ...observation, stderr: Buffer.from("buildos-design: error: something else\n") });
    refused(testCase, { ...observation, stderr: Buffer.from(observation.stderr.toString("utf8").replace("Access is denied.", "Access is denied!")) });
    refused(testCase, { ...observation, stdout: Buffer.from("x") });
    refused(testCase, { ...observation, exit: 0 });
    refused(testCase, { ...observation, exit: 2 });
  });

  it("skips nothing else: another OS, an unlisted case, a zero or missing digest, or no PE-005", () => {
    const testCase = byId("design-promote-baseline");
    const observation = realDefect(testCase);
    assert.equal(parityExceptionSkip(testCase, observation, "linux", exceptions), undefined);
    assert.equal(parityExceptionSkip(testCase, observation, "darwin", exceptions), undefined);
    assert.equal(parityExceptionMismatch(testCase, observation, "linux", exceptions), undefined, "PE-005 does not list the case for linux");
    assert.equal(parityExceptionSkip(testCase, observation, "win32", withoutPe005(exceptions)), undefined);
    const other = byId("design-promote-dry-run");
    assert.equal(parityExceptionSkip(other, observation, "win32", exceptions), undefined);
    assert.equal(parityExceptionMismatch(other, observation, "win32", exceptions), undefined);
    for (const digest of ["0".repeat(64), "", undefined]) {
      const changed = withDigest(exceptions, testCase.id, digest);
      assert.equal(parityExceptionSkip(testCase, observation, "win32", changed), undefined);
      assert.match(derivedGoldenProblems(manifest, changed).join("\n"), /PE-005: design-promote-baseline needs go_observation_sha256/);
    }
  });

  it("the digest covers the exit code, both full streams, and every filesystem change", () => {
    const observation = realDefect(byId("entities-consolidate-apply-json"));
    const base = observationDigest(observation);
    assert.equal(observationDigest({ ...observation }), base);
    assert.notEqual(observationDigest({ ...observation, exit: 6 }), base);
    assert.notEqual(observationDigest({ ...observation, stdout: Buffer.concat([observation.stdout, Buffer.from(" ")]) }), base);
    assert.notEqual(observationDigest({ ...observation, stderr: Buffer.from(" ") }), base);
    assert.notEqual(observationDigest({ ...observation, removed: [{ path: "gone", kind: "file" }] }), base);
    assert.notEqual(observationDigest({ ...observation, links: new Map([["l", "t"]]) }), base);
  });
});

/** A copy of `file` with one PE-005 case's go_observation_sha256 replaced (or removed). */
function withDigest(file: ExceptionsFile, caseId: string, digest: string | undefined): ExceptionsFile {
  const copy = JSON.parse(JSON.stringify(file)) as ExceptionsFile;
  for (const e of copy.exceptions) {
    for (const c of e.cases ?? []) {
      if (c.case !== caseId) continue;
      if (digest === undefined) delete (c as Partial<typeof c>).go_observation_sha256;
      else c.go_observation_sha256 = digest;
    }
  }
  return copy;
}

describe("derived goldens are accepted only for PE-005 cases", () => {
  let root: string;
  let goldens: string;

  beforeEach(() => {
    rmSync(root ?? "", { recursive: true, force: true });
    root = mkdtempSync(join(tmpdir(), "buildos-golden-pe005-"));
    goldens = join(root, "goldens");
    cpSync(GOLDEN_ROOT, goldens, { recursive: true });
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("the committed derived goldens equal a fresh derivation", () => {
    assert.deepEqual(derivedGoldenProblems(manifest, exceptions, goldens), []);
  });

  it("refuses a derived golden for a case that PE-005 does not list", () => {
    const testCase = byId("entities-validate-compat");
    const golden = readGoldenDir(osGoldenDir(testCase, "linux", goldens));
    writeGolden(testCase, golden, osGoldenDir(testCase, "win32", goldens), { exception: "PE-005", source: `os/linux/buildos/${testCase.id}`, source_sha256: "0".repeat(64) });
    const selection = selectGolden(testCase, "win32", goldens);
    assert.equal(selection.status, "missing-golden");
    assert.ok(selection.status === "missing-golden");
    assert.match(selection.reason, /derived \(PE-005\)/);
    assert.match(derivedGoldenProblems(manifest, exceptions, goldens).join("\n"), /entities-validate-compat: derived golden os\/win32\/buildos\/entities-validate-compat \(PE-005\) is not allowed/);
  });

  it("refuses a derived golden of a PE-005 case in another set", () => {
    const testCase = byId("entities-consolidate-apply-json");
    cpSync(osGoldenDir(testCase, "win32", goldens), osGoldenDir(testCase, "linux", goldens), { recursive: true });
    assert.equal(selectGolden(testCase, "linux", goldens).status, "missing-golden");
    assert.match(derivedGoldenProblems(manifest, exceptions, goldens).join("\n"), /derived golden os\/linux\/buildos\/entities-consolidate-apply-json \(PE-005\) is not allowed/);
  });

  it("refuses every derived golden once PE-005 is gone", () => {
    const file = join(goldens, "parity-exceptions.json");
    writeFileSync(file, `${JSON.stringify(withoutPe005(JSON.parse(readFileSync(file, "utf8")) as ExceptionsFile), null, 2)}\n`);
    for (const id of ENTITY_CASES) assert.equal(selectGolden(byId(id), "win32", goldens).status, "missing-golden", id);
    const problems = derivedGoldenProblems(manifest, withoutPe005(exceptions), goldens);
    for (const id of ENTITY_CASES) assert.match(problems.join("\n"), new RegExp(`${id}: derived golden os/win32/buildos/${id} \\(PE-005\\) is not allowed`));
  });

  it("fails a changed or missing derived golden", () => {
    const testCase = byId("entities-rebuild-apply-missing-json");
    const dir = osGoldenDir(testCase, "win32", goldens);
    writeFileSync(join(dir, "stdout"), Buffer.concat([readFileSync(join(dir, "stdout")), Buffer.from(" ")]));
    assert.match(derivedGoldenProblems(manifest, exceptions, goldens).join("\n"), /entities-rebuild-apply-missing-json: the committed derived golden differs from a fresh derivation/);
    rmSync(dir, { recursive: true, force: true });
    assert.match(derivedGoldenProblems(manifest, exceptions, goldens).join("\n"), /entities-rebuild-apply-missing-json has no derived golden os\/win32\/buildos\/entities-rebuild-apply-missing-json/);
  });

  it("refuses to derive when the linux and darwin goldens differ", () => {
    const testCase = byId("entities-consolidate-apply-json");
    const entry = platformExceptionCases(exceptions, "win32").get(testCase.id)?.entry;
    assert.ok(entry !== undefined);
    writeFileSync(join(osGoldenDir(testCase, "darwin", goldens), "stderr"), "planted\n");
    assert.throws(() => deriveGolden(testCase, "PE-005", entry, goldens), /linux and darwin goldens differ/);
  });

  it("refuses a Windows text that does not occur exactly once", () => {
    const testCase = byId("entities-consolidate-apply-index-failure-json");
    const entry = platformExceptionCases(exceptions, "win32").get(testCase.id)?.entry;
    assert.ok(entry !== undefined);
    const broken = { ...entry, win32_golden: { ...entry.win32_golden, windows_text: [{ from: "no such text", to: "x", evidence: "test" }] } };
    assert.throws(() => deriveGolden(testCase, "PE-005", broken, goldens), /must occur exactly once/);
  });

});

describe("--verify-artifact enforces PE-005 on a win32 set", () => {
  let root: string;
  let goldens: string;
  let set: string;

  type SetRecord = { platform: string; golden_files: { [path: string]: string }; derived_goldens: Partial<DerivedGoldenRecord>[]; parity_exception_skips: Partial<ParityExceptionSkip>[] };
  const recordPath = () => join(set, CAPTURE_RECORD);
  const readRecord = () => JSON.parse(readFileSync(recordPath(), "utf8")) as SetRecord;
  /** Writes the capture record, with golden_files recomputed from the set (a consistent artifact). */
  const seal = (change: (r: SetRecord) => void = () => {}) => {
    const record: SetRecord = existsSync(recordPath()) ? readRecord() : { platform: "win32", golden_files: {}, derived_goldens: derivedGoldenRecords(manifest, "win32", goldens), parity_exception_skips: [] };
    if (record.parity_exception_skips.length === 0) {
      for (const id of [...ENTITY_CASES, ...DESIGN_CASES]) {
        const skip = parityExceptionSkip(byId(id), realDefect(byId(id)), "win32", exceptions);
        assert.ok(skip !== undefined);
        record.parity_exception_skips.push({ ...skip });
      }
    }
    change(record);
    rmSync(recordPath(), { force: true });
    record.golden_files = goldenSetManifest(set);
    writeFileSync(recordPath(), `${JSON.stringify(record, null, 2)}\n`);
  };
  const problems = (file: ExceptionsFile = exceptions) => verifyGoldenSet(set, manifest, file, { root: goldens }).filter((p) => !p.startsWith("OS-dependent case"));
  const resultPath = (id: string) => join(osGoldenDir(byId(id), "win32", goldens), "result.json");
  const editResult = (id: string, change: (r: { derived: { [field: string]: string } }) => void) => {
    const r = JSON.parse(readFileSync(resultPath(id), "utf8")) as { derived: { [field: string]: string } };
    change(r);
    writeFileSync(resultPath(id), `${JSON.stringify(r, null, 2)}\n`);
  };

  beforeEach(() => {
    rmSync(root ?? "", { recursive: true, force: true });
    root = mkdtempSync(join(tmpdir(), "buildos-golden-pe005-verify-"));
    goldens = join(root, "goldens");
    cpSync(GOLDEN_ROOT, goldens, { recursive: true });
    set = join(goldens, "os", "win32");
    // The committed win32 set and its capture record (CI run 45298345720).
    seal();
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("accepts the three derived goldens and six exact-digest skips", () => {
    assert.deepEqual(problems(), []);
    assert.equal(readRecord().derived_goldens.length, ENTITY_CASES.length);
  });

  it("the committed win32 set passes as imported, and its skips carry the recorded digests", () => {
    assert.deepEqual(verifyGoldenSet(join(GOLDEN_ROOT, "os", "win32"), manifest), []);
    const record = JSON.parse(readFileSync(join(GOLDEN_ROOT, "os", "win32", CAPTURE_RECORD), "utf8")) as SetRecord;
    assert.deepEqual(record.parity_exception_skips.map((s) => s.case).sort(), [...ENTITY_CASES, ...DESIGN_CASES].sort());
    for (const s of record.parity_exception_skips) assert.equal(s.observation_sha256, platformExceptionCases(exceptions, "win32").get(String(s.case))?.entry.go_observation_sha256);
  });

  it("refuses an all-zero derived source SHA-256, in result.json or in the record", () => {
    editResult("entities-consolidate-apply-json", (r) => {
      r.derived["source_sha256"] = "0".repeat(64);
    });
    seal((r) => {
      for (const d of r.derived_goldens) if (d.case === "entities-consolidate-apply-json") d.source_sha256 = "0".repeat(64);
    });
    const found = problems().join("\n");
    assert.match(found, /entities-consolidate-apply-json: result\.json source_sha256 0{64} is not the SHA-256 [0-9a-f]{64} of the committed source/);
    assert.match(found, /entities-consolidate-apply-json: derived_goldens source_sha256 is "0{64}", recomputed "[0-9a-f]{64}"/);
  });

  it("refuses a derived folder hash in the record that is not the folder's", () => {
    seal((r) => {
      for (const d of r.derived_goldens) if (d.case === "entities-rebuild-apply-missing-json") d.sha256 = "0".repeat(64);
    });
    assert.match(problems().join("\n"), /entities-rebuild-apply-missing-json: derived_goldens sha256 is "0{64}", recomputed/);
  });

  it("refuses a derived golden that differs from a fresh derivation, even in a consistent artifact", () => {
    const dir = osGoldenDir(byId("entities-rebuild-apply-missing-json"), "win32", goldens);
    writeFileSync(join(dir, "stdout"), Buffer.concat([readFileSync(join(dir, "stdout")), Buffer.from(" ")]));
    seal((r) => {
      for (const d of r.derived_goldens) if (d.case === "entities-rebuild-apply-missing-json") d.sha256 = goldenDirDigest(dir);
    });
    assert.match(problems().join("\n"), /entities-rebuild-apply-missing-json differs from a fresh derivation/);
  });

  it("refuses a changed committed source golden", () => {
    const source = osGoldenDir(byId("entities-consolidate-apply-json"), "linux", goldens);
    writeFileSync(join(source, "stderr"), "planted\n");
    assert.match(problems().join("\n"), /entities-consolidate-apply-json: result\.json source_sha256 [0-9a-f]{64} is not the SHA-256/);
  });

  for (const id of DESIGN_CASES) {
    it(`refuses any win32 override of the shared case ${id}: the failing Windows output marked derived from shared, or a captured golden`, () => {
      const testCase = byId(id);
      const dir = osGoldenDir(testCase, "win32", goldens);
      writeGolden(testCase, realDefect(testCase), dir, { exception: "PE-005", source: "shared", source_sha256: goldenDirDigest(goldenDir(testCase, goldens)) });
      seal();
      assert.match(problems().join("\n"), new RegExp(`buildos-design/${id} is a shared case of a platform exception class; the set must not hold an OS golden`));
      writeGolden(testCase, readGoldenDir(goldenDir(testCase, goldens)), dir);
      seal();
      assert.match(problems().join("\n"), new RegExp(`buildos-design/${id} is a shared case`));
    });
  }

  it("refuses a derived entry or folder that PE-005 does not list", () => {
    seal((r) => {
      r.derived_goldens.push({ case: "entities-validate-compat", path: "os/win32/buildos/entities-validate-compat", derived: "PE-005", source: "os/linux/buildos/entities-validate-compat", source_sha256: "0".repeat(64), sha256: "0".repeat(64) });
    });
    assert.match(problems().join("\n"), /derived_goldens lists entities-validate-compat, which no platform exception class lists with a derived golden for win32/);
    const testCase = byId("entities-validate-compat");
    writeGolden(testCase, readGoldenDir(osGoldenDir(testCase, "linux", goldens)), osGoldenDir(testCase, "win32", goldens), { exception: "PE-005", source: `os/linux/buildos/${testCase.id}`, source_sha256: "0".repeat(64) });
    seal();
    assert.match(problems().join("\n"), /derived golden buildos\/entities-validate-compat \(PE-005\) is not allowed for win32/);
    const refused = problems(withoutPe005(exceptions)).join("\n");
    for (const id of ENTITY_CASES) assert.match(refused, new RegExp(`derived golden buildos/${id} \\(PE-005\\) is not allowed for win32`));
  });

  it("requires exactly the three authorized derived goldens, each with one record entry", () => {
    const dir = osGoldenDir(byId("entities-consolidate-apply-json"), "win32", goldens);
    rmSync(dir, { recursive: true, force: true });
    seal();
    assert.match(problems().join("\n"), /PE-005: buildos\/entities-consolidate-apply-json must be the derived golden from os\/linux\/buildos\/entities-consolidate-apply-json, but the set has no golden/);
    const testCase = byId("entities-consolidate-apply-json");
    writeGolden(testCase, realDefect(testCase), dir);
    seal();
    assert.match(problems().join("\n"), /entities-consolidate-apply-json must be the derived golden .* holds a golden that is not derived/);
  });

  it("requires one derived_goldens entry per derived golden", () => {
    seal((r) => {
      r.derived_goldens = r.derived_goldens.filter((d) => d.case !== "entities-rebuild-apply-missing-json");
    });
    assert.match(problems().join("\n"), /entities-rebuild-apply-missing-json needs exactly one derived_goldens entry in capture-record\.json, found 0/);
  });

  it("requires each skip to carry the exact recorded digest", () => {
    seal((r) => {
      for (const k of r.parity_exception_skips) if (k.case === "design-promote-baseline") delete k.observation_sha256;
      for (const k of r.parity_exception_skips) if (k.case === "design-installed-promote") k.observation_sha256 = "0".repeat(64);
    });
    const found = problems().join("\n");
    assert.match(found, /design-promote-baseline: parity_exception_skips entry has no observation_sha256 \(captured before the PE-005 digest rule\); run a fresh capture/);
    assert.match(found, /design-installed-promote: parity_exception_skips observation_sha256 0{64} is not the recorded defect/);
  });

  it("requires exactly the six listed skips, and nothing else", () => {
    seal((r) => {
      r.parity_exception_skips = r.parity_exception_skips.filter((k) => k.case !== "design-promote-change-redirected");
      r.parity_exception_skips.push({ case: "design-promote-dry-run", kind: "pe-005-skipped", exception: "PE-005" });
    });
    const found = problems().join("\n");
    assert.match(found, /needs exactly one parity_exception_skips entry for design-promote-change-redirected, found 0/);
    assert.match(found, /parity_exception_skips lists design-promote-dry-run, which no platform exception class lists for win32/);
  });

  it("the committed darwin and linux sets have no derived golden, no skip, and no design override", () => {
    for (const platform of ["darwin", "linux"]) assert.deepEqual(verifyGoldenSet(join(GOLDEN_ROOT, "os", platform), manifest), [], platform);
  });
});

describe("Windows path spelling", () => {
  it("uses \\ after {ROOT}, and \\\\ inside a Go %q string", () => {
    assert.equal(windowsPathSpelling("{ROOT}/root"), "{ROOT}\\root");
    assert.equal(windowsPathSpelling('--root "{ROOT}/root" --mode'), '--root "{ROOT}\\\\root" --mode');
    assert.equal(windowsPathSpelling('dir "{ROOT}/root/.os/indexes": mkdir {ROOT}/root/.os/indexes: text'), 'dir "{ROOT}\\\\root\\\\.os\\\\indexes": mkdir {ROOT}\\root\\.os\\indexes: text');
    assert.equal(windowsPathSpelling("{ROOT}"), "{ROOT}");
    assert.equal(windowsPathSpelling("wrote system/docs/designs/x.md"), "wrote system/docs/designs/x.md");
  });
});
