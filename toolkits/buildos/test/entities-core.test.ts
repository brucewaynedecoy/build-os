// W1 R7 P3 t6: the Go seed's entity unit tests (toolkits/buildos/internal/entities/*_test.go),
// ported to node:test. Each Go test keeps its name and its checks. Reads and
// writes go through the real node:fs port, in scratch roots.
//
// Go paths in this comment name the Go sources at the frozen baseline
// commit 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).

import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import { consolidate, rfc3339Offset, writeCanonicalAtomic, type ManifestSource } from "../src/core/entities/consolidate.ts";
import { EntityGraph, GOVERNED_DATASETS, loadGraph, type Location } from "../src/core/entities/graph.ts";
import { applyIndex, buildIndex, checkIndex, marshalIndex, type ResolutionIndex } from "../src/core/entities/index.ts";
import { GoError } from "../src/core/entities/io.ts";
import { resolveEntity } from "../src/core/entities/resolve.ts";
import { CODE, hasErrors, type EntityDiagnostic, type EntityRecord } from "../src/core/entities/types.ts";
import { checkRedirect, validateGraph } from "../src/core/entities/validate.ts";
import { FsWriteFailure } from "../src/core/shared/errors.ts";
import type { FsPort } from "../src/core/shared/fs-port.ts";
import { goCheckValid, goCompare, goDecodeFirst, goEncodeString, goFoldName, goFoldRune, goGrowCap, goMarshalIndent, goMarshalRawObject, goUnmarshalRawObject, parseTree, utf8, type GoDecoded, type GoType } from "../src/core/shared/go-json.ts";

const POSIX = process.platform !== "win32";
const platform = POSIX ? ("posix" as const) : ("win32" as const);
const EXAMPLES = join(import.meta.dirname, "..", "..", "..", "system", ".os", "contracts", "examples", "entity-resolution");
const scratch = mkdtempSync(join(tmpdir(), "buildos-p3-core-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;

/** A scratch root with `.os/data/` holding the given dataset texts (every governed dataset exists). */
function makeRoot(datasets: Record<string, string> = {}): { root: string; fs: FsPort; data: Location } {
  const root = join(scratch, `root-${++counter}`);
  mkdirSync(join(root, ".os", "data"), { recursive: true });
  for (const { filename } of GOVERNED_DATASETS) writeFileSync(join(root, ".os", "data", filename), datasets[filename] ?? "", { mode: 0o644 });
  return { root, fs: createNodeFsPort(root), data: { port: ".os/data", go: join(root, ".os", "data"), platform } };
}

/** Go `writeRows`: each row compacted into its type's dataset. */
function writeRows(rows: unknown[]): ReturnType<typeof makeRoot> {
  const contents: Record<string, string> = {};
  for (const row of rows) {
    const type = (row as { type: string }).type;
    const dataset = GOVERNED_DATASETS.find((d) => d.entityType === type);
    assert.ok(dataset !== undefined, `unknown fixture type ${type}`);
    contents[dataset.filename] = `${contents[dataset.filename] ?? ""}${JSON.stringify(row)}\n`;
  }
  return makeRoot(contents);
}

function readJsonlLines(name: string): unknown[] {
  return readFileSync(join(EXAMPLES, name), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as unknown);
}

function assertNoErrors(diagnostics: readonly EntityDiagnostic[]): void {
  assert.equal(hasErrors(diagnostics), false, JSON.stringify(diagnostics));
}

function diagnosticWithCode(diagnostics: readonly EntityDiagnostic[], code: string): EntityDiagnostic {
  const found = diagnostics.find((d) => d.code === code);
  assert.ok(found !== undefined, `diagnostics ${JSON.stringify(diagnostics)} do not contain code ${code}`);
  return found;
}

function assertContainsCode(diagnostics: readonly EntityDiagnostic[], code: string, severity: "error" | "warning"): void {
  const diagnostic = diagnosticWithCode(diagnostics, code);
  assert.equal(diagnostic.severity, severity, `diagnostic ${code} severity`);
  assert.notEqual(diagnostic.action.trim(), "", `diagnostic ${code} has no corrective action`);
}

describe("graph loader, resolver, and validator (graph_test.go)", () => {
  it("TestLoadValidateAndResolveAllGovernedTypes", () => {
    const { fs, data } = writeRows(readJsonlLines("valid-all-types.jsonl"));
    const { graph, diagnostics } = loadGraph(fs, data);
    assertNoErrors(diagnostics);
    assertNoErrors(validateGraph(graph, "strict"));
    assert.equal(graph.records().length, 16);
    const seen = new Set<string>();
    for (const record of graph.records()) {
      seen.add(record.type);
      if (record.redirect === undefined) continue;
      const { resolution, diagnostics: found } = resolveEntity(graph, record.id);
      assertNoErrors(found);
      assert.ok(resolution.resolved && resolution.chain?.length === 2 && resolution.canonical_id === record.redirect.target_id, JSON.stringify(resolution));
    }
    assert.deepEqual([...seen].sort(goCompare), ["capability", "extraction", "finding", "persona", "requirement", "result", "run", "test-case"]);
    const record = graph.record("CAP-002");
    assert.ok(record?.raw.get("x_fixture_extension") !== undefined, "unknown field was not retained");
    record.raw.get("x_fixture_extension")![0] = 0x78;
    assert.notEqual(graph.record("CAP-002")!.raw.get("x_fixture_extension")![0], 0x78, "record returned graph-owned raw bytes instead of a clone");
  });

  it("TestResolveZeroAndMultiHopAfterWinnerReplacement", () => {
    const { fs, data } = writeRows(readJsonlLines("valid-multi-hop.jsonl"));
    const { graph, diagnostics } = loadGraph(fs, data);
    assertNoErrors(diagnostics);
    assertNoErrors(validateGraph(graph, "strict"));
    const zero = resolveEntity(graph, "PER-101");
    assertNoErrors(zero.diagnostics);
    assert.deepEqual(zero.resolution, { requested_id: "PER-101", canonical_id: "PER-101", chain: ["PER-101"], resolved: false });
    const multi = resolveEntity(graph, "PER-103");
    assertNoErrors(multi.diagnostics);
    assert.deepEqual(multi.resolution, { requested_id: "PER-103", canonical_id: "PER-101", chain: ["PER-103", "PER-102", "PER-101"], resolved: true });
  });

  describe("TestInvalidGraphFixturesProduceContractDiagnostics", () => {
    const fixture = JSON.parse(readFileSync(join(EXAMPLES, "invalid-graph-cases.json"), "utf8")) as {
      cases: { name: string; records: unknown[]; manifest?: { mappings: { source_id: string; target_id: string }[] } }[];
    };
    const wantCodes: Record<string, string> = {
      "legacy-missing-redirect": CODE.legacyMissingRedirect,
      "missing-target": CODE.redirectMissingTarget,
      "self-redirect": CODE.redirectSelf,
      "cross-type": CODE.redirectCrossType,
      cycle: CODE.redirectCycle,
      "inactive-terminal": CODE.redirectInactiveTerminal,
      "illegal-redirect-status": CODE.redirectIllegalStatus,
      "duplicate-ids": CODE.duplicateId,
      "remap-conflict": CODE.redirectRemapConflict,
    };
    for (const testCase of fixture.cases) {
      it(testCase.name, () => {
        const { fs, data } = writeRows(testCase.records);
        const { graph, diagnostics } = loadGraph(fs, data);
        if (testCase.name === "duplicate-ids") {
          assertContainsCode(diagnostics, wantCodes[testCase.name]!, "error");
          return;
        }
        assertNoErrors(diagnostics);
        if (testCase.name === "remap-conflict") {
          const mapping = testCase.manifest!.mappings[0]!;
          const conflict = checkRedirect(graph, mapping.source_id, mapping.target_id);
          assert.ok(conflict?.code === CODE.redirectRemapConflict && conflict.target_id === mapping.target_id, JSON.stringify(conflict));
          assert.equal(checkRedirect(graph, mapping.source_id, "PER-213"), undefined, "idempotent mapping returned a diagnostic");
          return;
        }
        assertContainsCode(validateGraph(graph, "compat"), wantCodes[testCase.name]!, testCase.name === "legacy-missing-redirect" ? "warning" : "error");
        const strict = validateGraph(graph, "strict");
        assertContainsCode(strict, wantCodes[testCase.name]!, "error");
        if (testCase.name === "cycle") {
          const chain = diagnosticWithCode(strict, CODE.redirectCycle).chain ?? [];
          assert.ok(chain.length >= 3 && chain[0] === chain.at(-1), `cycle chain is not complete and closed: ${chain.join(",")}`);
        }
      });
    }
  });

  it("TestLoadRejectsMissingMalformedAndShapeInvalidDatasets", () => {
    const { root, fs, data } = makeRoot();
    writeFileSync(join(root, ".os", "data", "personas.jsonl"), "not-json\n");
    rmSync(join(root, ".os", "data", "runs.jsonl"));
    const { diagnostics } = loadGraph(fs, data);
    assert.ok(diagnostics.filter((d) => d.code === CODE.inputContract).length >= 2 && hasErrors(diagnostics), JSON.stringify(diagnostics));
    const bad = writeRows([{ id: "PER-900", type: "persona", status: "superseded", redirect: { target_id: "PER-901", kind: "guessed" } }]);
    assertContainsCode(loadGraph(bad.fs, bad.data).diagnostics, CODE.inputContract, "error");
  });

  it("TestResolveFailsClosedForMissingAndLegacyEntities", () => {
    const { fs, data } = writeRows([{ id: "PER-901", type: "persona", status: "superseded" }]);
    const { graph, diagnostics } = loadGraph(fs, data);
    assertNoErrors(diagnostics);
    const missing = resolveEntity(graph, "PER-999").diagnostics;
    assert.ok(missing.length === 1 && missing[0]!.code === CODE.entityNotFound, JSON.stringify(missing));
    const legacy = resolveEntity(graph, "PER-901").diagnostics;
    assert.ok(legacy.length === 1 && legacy[0]!.code === CODE.legacyMissingRedirect, JSON.stringify(legacy));
  });
});

describe("lifecycle statuses (lifecycle_test.go)", () => {
  const graphOf = (records: Partial<EntityRecord>[]) =>
    new EntityGraph(new Map(records.map((r) => [r.id!, { id: "", type: "", status: "", redirect: undefined, dataset: "", path: "", line: 0, raw: new Map(), ...r } as EntityRecord])));
  const redirect = (target: string) => ({ target_id: target, kind: "", decided_at: "", decided_by: "", reason: "", evidence_refs: null });

  it("TestFindingQualifiedIsATypeSpecificCanonicalTerminal", () => {
    const graph = graphOf([
      { id: "FIND-001", type: "finding", status: "superseded", redirect: redirect("FIND-002") },
      { id: "FIND-002", type: "finding", status: "qualified" },
    ]);
    assertNoErrors(validateGraph(graph, "strict"));
    const { resolution, diagnostics } = resolveEntity(graph, "FIND-001");
    assertNoErrors(diagnostics);
    assert.equal(resolution.canonical_id, "FIND-002");
  });

  it("TestQualifiedDoesNotBecomeAGeneralEntityStatus", () => {
    const graph = graphOf([{ id: "REQ-001", type: "requirement", status: "qualified" }]);
    assert.ok(hasErrors(validateGraph(graph, "strict")), "qualified requirement should fail validation");
    assert.ok(hasErrors(resolveEntity(graph, "REQ-001").diagnostics), "qualified requirement should not resolve as canonical");
  });

  for (const status of ["running", "closed", "aborted"]) {
    it(`TestRunLifecycleStatusesRemainTypeSpecificCanonicalTerminals/${status}`, () => {
      const graph = graphOf([{ id: "RUN-001", type: "run", status }]);
      assertNoErrors(validateGraph(graph, "strict"));
      assertNoErrors(resolveEntity(graph, "RUN-001").diagnostics);
    });
  }
});

const personaIndex = (): ResolutionIndex => ({
  version: 1,
  canonical_by_id: new Map([
    ["PER-102", "PER-101"],
    ["PER-103", "PER-101"],
  ]),
  members_by_canonical: new Map([["PER-101", ["PER-102", "PER-103"]]]),
});

describe("derived index (index_test.go)", () => {
  const remediation = "/tmp/staged/buildos entities rebuild-index --root '/tmp/copied root' --mode strict --apply";
  const indexLocation = (root: string, name = "entity-resolution.json"): Location => ({ port: name, go: join(root, name), platform });

  it("TestBuildIndexFlattensMultiHopGraph", () => {
    const personas = [
      '{"id":"PER-101","type":"persona","status":"active"}',
      '{"id":"PER-102","type":"persona","status":"superseded","redirect":{"target_id":"PER-101","kind":"duplicate","decided_at":"2026-07-21T15:30:00Z","decided_by":"reviewer","reason":"same persona","evidence_refs":[]}}',
      '{"id":"PER-103","type":"persona","status":"superseded","redirect":{"target_id":"PER-102","kind":"consolidated","decided_at":"2026-07-21T15:31:00Z","decided_by":"reviewer","reason":"same persona","evidence_refs":[]}}',
    ].join("\n");
    const { fs, data } = makeRoot({ "personas.jsonl": `${personas}\n` });
    const { graph, diagnostics } = loadGraph(fs, data);
    assertNoErrors(diagnostics);
    assertNoErrors(validateGraph(graph, "strict"));
    const built = buildIndex(graph);
    assertNoErrors(built.diagnostics);
    const got = marshalIndex(built.index);
    assert.deepEqual(got, marshalIndex(personaIndex()));
    for (let i = 0; i < 50; i++) assert.deepEqual(marshalIndex(buildIndex(graph).index), got, `iteration ${i} was not byte-identical`);
  });

  it("TestMarshalIndexCanonicalAndReproducible", () => {
    const index: ResolutionIndex = {
      version: 1,
      canonical_by_id: new Map([
        ["PER-103", "PER-101"],
        ["PER-102", "PER-101"],
      ]),
      members_by_canonical: new Map([["PER-101", ["PER-103", "PER-102"]]]),
    };
    const want = '{\n  "version": 1,\n  "canonical_by_id": {\n    "PER-102": "PER-101",\n    "PER-103": "PER-101"\n  },\n  "members_by_canonical": {\n    "PER-101": [\n      "PER-102",\n      "PER-103"\n    ]\n  }\n}\n';
    const first = marshalIndex(index);
    assert.equal(new TextDecoder().decode(first), want);
    for (let i = 0; i < 100; i++) assert.deepEqual(marshalIndex(index), first);
  });

  describe("TestCheckIndexStatesAndDoesNotWrite", () => {
    const expected = personaIndex();
    const expectedText = new TextDecoder().decode(marshalIndex(expected));
    const cases: { name: string; data: string; want: string; code?: string }[] = [
      { name: "current", data: expectedText, want: "current" },
      {
        name: "stale",
        data: '{\n  "version": 1,\n  "canonical_by_id": {\n    "PER-102": "PER-101",\n    "PER-103": "PER-102"\n  },\n  "members_by_canonical": {\n    "PER-101": ["PER-102"],\n    "PER-102": ["PER-103"]\n  }\n}\n',
        want: "stale",
        code: "index_stale",
      },
      {
        name: "non reproducible",
        data: '{"version":1,"members_by_canonical":{"PER-101":["PER-103","PER-102"]},"canonical_by_id":{"PER-103":"PER-101","PER-102":"PER-101"}}\n',
        want: "non_reproducible",
        code: "index_non_reproducible",
      },
      { name: "malformed JSON", data: "{not-json\n", want: "malformed", code: "input_contract" },
      { name: "malformed schema", data: '{"version":1,"canonical_by_id":{},"members_by_canonical":{},"extra":true}\n', want: "malformed", code: "input_contract" },
    ];
    for (const test of cases) {
      it(test.name, () => {
        const { root, fs } = makeRoot();
        writeFileSync(join(root, "entity-resolution.json"), test.data);
        const result = checkIndex(fs, indexLocation(root), expected, remediation);
        assert.equal(result.state, test.want, result.message);
        assert.equal(result.diagnostic_code, test.code);
        if (test.want === "current") assert.ok(result.current && result.remediation_command === undefined, JSON.stringify(result));
        else assert.ok(!result.current && result.remediation_command === remediation, JSON.stringify(result));
        assert.equal(readFileSync(join(root, "entity-resolution.json"), "utf8"), test.data, "CheckIndex modified the index");
      });
    }
    it("missing", () => {
      const { root, fs } = makeRoot();
      const result = checkIndex(fs, indexLocation(root), expected, remediation);
      assert.ok(result.state === "missing" && result.diagnostic_code === "index_stale" && result.remediation_command === remediation, JSON.stringify(result));
      assert.throws(() => statSync(join(root, "entity-resolution.json")), "CheckIndex created a missing index");
    });
    it("names Go's malformed-index errors", () => {
      const { root, fs } = makeRoot();
      const check = (text: string) => {
        writeFileSync(join(root, "entity-resolution.json"), text);
        return checkIndex(fs, indexLocation(root), expected, remediation).message;
      };
      assert.equal(check("{not-json\n"), "entity-resolution index is malformed: invalid character 'n' looking for beginning of object key string");
      assert.equal(check('{"version":1,"canonical_by_id":{},"members_by_canonical":{},"extra":true}'), 'entity-resolution index is malformed: json: unknown field "extra"');
      assert.equal(check('{"version":"1"}'), "entity-resolution index is malformed: json: cannot unmarshal string into Go struct field ResolutionIndex.version of type int");
      assert.equal(check('{"version":1.5}'), "entity-resolution index is malformed: json: cannot unmarshal number 1.5 into Go struct field ResolutionIndex.version of type int");
      assert.equal(check("[]"), "entity-resolution index is malformed: json: cannot unmarshal array into Go value of type entities.ResolutionIndex");
      assert.equal(check('{"version":1,"canonical_by_id":{},"members_by_canonical":{}} {}'), "entity-resolution index is malformed: multiple JSON values");
      assert.equal(check('{"version":1,"canonical_by_id":{},"members_by_canonical":{}} x'), "entity-resolution index is malformed: trailing content: invalid character 'x' looking for beginning of value");
      assert.equal(check('{"version":1,"canonical_by_id":{}'), "entity-resolution index is malformed: unexpected EOF");
      assert.equal(check(""), "entity-resolution index is malformed: EOF");
      assert.equal(check('{"version":2}'), "entity-resolution index is malformed: version must be 1");
      assert.equal(check('{"version":1,"canonical_by_id":null,"members_by_canonical":{}}'), "entity-resolution index is malformed: canonical_by_id must be an object");
      assert.equal(check('{"version":1,"canonical_by_id":{"A":"B"},"members_by_canonical":{"B":[]}}'), 'entity-resolution index is malformed: members_by_canonical["B"] must not be empty');
    });
  });

  it("TestApplyIndexAtomicIdempotentAndPermissionPreserving", () => {
    const { root, fs } = makeRoot();
    const path: Location = { port: ".os/indexes/entity-resolution.json", go: join(root, ".os", "indexes", "entity-resolution.json"), platform };
    const index = personaIndex();
    assert.equal(applyIndex(fs, path, index), true, "first apply changed = false");
    assert.deepEqual(new Uint8Array(readFileSync(join(root, ".os", "indexes", "entity-resolution.json"))), marshalIndex(index));
    assert.equal(applyIndex(fs, path, index), false, "idempotent apply changed = true");
    chmodSync(join(root, ".os", "indexes", "entity-resolution.json"), 0o640);
    index.canonical_by_id!.set("PER-104", "PER-101");
    index.members_by_canonical!.get("PER-101")!.push("PER-104");
    assert.equal(applyIndex(fs, path, index), true, "replacement changed = false");
    if (POSIX) assert.equal(statSync(join(root, ".os", "indexes", "entity-resolution.json")).mode & 0o777, 0o640);
    assert.deepEqual(readdirSync(join(root, ".os", "indexes")).filter((f) => f.startsWith(".entity-resolution-")), [], "temporary files left behind");
  });

  it("TestMarshalIndexRejectsInconsistentShape", () => {
    assert.throws(
      () =>
        marshalIndex({ version: 1, canonical_by_id: new Map([["PER-102", "PER-101"]]), members_by_canonical: new Map([["PER-101", ["PER-999"]]]) }),
      (error) => error instanceof GoError,
    );
  });
});

/** A root for consolidation with these persona rows, compacted as Go's json.Marshal of a map (sorted keys). */
function consolidationRoot(personas: Record<string, unknown>[]): ReturnType<typeof makeRoot> {
  const sortKeys = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sortKeys)
      : typeof value === "object" && value !== null
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]))
        : value;
  return makeRoot({ "personas.jsonl": personas.map((row) => `${JSON.stringify(sortKeys(row))}\n`).join("") });
}

function manifestOf(mappings: Record<string, unknown>[]): ManifestSource {
  const dir = join(scratch, `manifest-${++counter}`);
  mkdirSync(dir);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ version: 1, mappings }));
  return { fs: createNodeFsPort(dir), given: join(dir, "manifest.json"), port: "manifest.json" };
}

const mapping = (source: string, target: string, extra: Record<string, unknown> = {}) => ({
  source_id: source,
  target_id: target,
  kind: "duplicate",
  decided_at: "2026-07-21T15:30:00Z",
  decided_by: "reviewer",
  reason: "same",
  evidence_refs: [],
  ...extra,
});

const redirectObject = (target: string) => ({ target_id: target, kind: "duplicate", decided_at: "2026-07-20T10:00:00Z", decided_by: "reviewer", reason: "same", evidence_refs: [] });

describe("consolidation (consolidate_test.go)", () => {
  it("TestConsolidateDryRunApplyPreservationAndIdempotence", () => {
    const { root, fs, data } = consolidationRoot([
      { id: "PER-003", type: "persona", status: "active", name: "Administrator", x_extension: { keep: true } },
      { id: "PER-041", type: "persona", status: "active", name: "Admin", x_extension: { nested: [1.0, "two"] } },
    ]);
    const personaPath = join(root, ".os", "data", "personas.jsonl");
    chmodSync(personaPath, 0o640);
    const manifest = manifestOf([mapping("PER-041", "PER-003", { decided_by: "product-research", reason: "same reviewed persona", evidence_refs: ["research.md#review"] })]);
    const before = readFileSync(personaPath, "utf8");
    const plan = consolidate(fs, data, manifest, "compat", false);
    assert.ok(plan.error === undefined && !hasErrors(plan.diagnostics), JSON.stringify(plan));
    assert.ok(!plan.result.applied && plan.result.change_count === 1 && plan.graph !== undefined);
    assert.equal(readFileSync(personaPath, "utf8"), before, "dry run changed canonical data");

    const applied = consolidate(fs, data, manifest, "compat", true);
    assert.ok(applied.error === undefined && !hasErrors(applied.diagnostics), JSON.stringify(applied));
    assert.ok(applied.result.applied && applied.result.change_count === 1 && applied.graph !== undefined);
    if (POSIX) assert.equal(statSync(personaPath).mode & 0o777, 0o640);
    const record = applied.graph.record("PER-041");
    assert.ok(record?.status === "superseded" && record.redirect?.target_id === "PER-003", JSON.stringify(record));
    assert.deepEqual(JSON.parse(new TextDecoder().decode(record.raw.get("x_extension"))), { nested: [1, "two"] }, "unknown field not preserved");
    assert.equal(JSON.parse(new TextDecoder().decode(record.raw.get("updated_at"))), "2026-07-21T15:30:00Z");

    const appliedBytes = readFileSync(personaPath, "utf8");
    const replay = consolidate(fs, data, manifest, "compat", true);
    assert.ok(replay.error === undefined && !hasErrors(replay.diagnostics), JSON.stringify(replay));
    assert.ok(!replay.result.applied && replay.result.change_count === 0 && replay.result.no_op_count === 1, JSON.stringify(replay.result));
    assert.equal(readFileSync(personaPath, "utf8"), appliedBytes, "idempotent replay changed canonical bytes");
  });

  it("TestConsolidateRemapConflictFailsClosed", () => {
    const { root, fs, data } = consolidationRoot([
      { id: "PER-001", type: "persona", status: "active" },
      { id: "PER-002", type: "persona", status: "active" },
      { id: "PER-003", type: "persona", status: "superseded", redirect: redirectObject("PER-001") },
    ]);
    const path = join(root, ".os", "data", "personas.jsonl");
    const before = readFileSync(path, "utf8");
    const outcome = consolidate(fs, data, manifestOf([mapping("PER-003", "PER-002", { reason: "remap" })]), "compat", true);
    assert.equal(outcome.error?.kind, "conflict");
    assert.ok(outcome.diagnostics.some((d) => d.code === CODE.redirectRemapConflict), JSON.stringify(outcome.diagnostics));
    assert.equal(readFileSync(path, "utf8"), before, "conflict changed canonical data");
  });

  it("TestConsolidateRejectsMappingsAcrossCanonicalDatasets", () => {
    const { root, fs, data } = consolidationRoot([
      { id: "PER-001", type: "persona", status: "active" },
      { id: "PER-002", type: "persona", status: "active" },
    ]);
    writeFileSync(join(root, ".os", "data", "requirements.jsonl"), '{"id":"REQ-001","type":"requirement","status":"active","x_keep":true}\n{"id":"REQ-002","type":"requirement","status":"active"}\n');
    const personas = readFileSync(join(root, ".os", "data", "personas.jsonl"), "utf8");
    const requirements = readFileSync(join(root, ".os", "data", "requirements.jsonl"), "utf8");
    const outcome = consolidate(fs, data, manifestOf([mapping("PER-002", "PER-001"), mapping("REQ-002", "REQ-001", { kind: "replaced" })]), "compat", true);
    assert.equal(outcome.error?.kind, "conflict");
    assert.ok(outcome.diagnostics.some((d) => d.code === CODE.inputContract));
    assert.equal(readFileSync(join(root, ".os", "data", "personas.jsonl"), "utf8"), personas);
    assert.equal(readFileSync(join(root, ".os", "data", "requirements.jsonl"), "utf8"), requirements);
  });

  it("TestConsolidateProspectiveCycleAndAtomicFailure/prospective cycle", () => {
    const { root, fs, data } = consolidationRoot([
      { id: "PER-001", type: "persona", status: "active" },
      { id: "PER-002", type: "persona", status: "active" },
    ]);
    const path = join(root, ".os", "data", "personas.jsonl");
    const before = readFileSync(path, "utf8");
    const outcome = consolidate(fs, data, manifestOf([mapping("PER-001", "PER-002", { reason: "cycle a" }), mapping("PER-002", "PER-001", { reason: "cycle b" })]), "compat", true);
    assert.equal(outcome.error?.kind, "validation");
    assert.ok(outcome.diagnostics.some((d) => d.code === CODE.redirectCycle), JSON.stringify(outcome.diagnostics));
    assert.equal(readFileSync(path, "utf8"), before, "failed preflight changed canonical data");
    assert.deepEqual(readdirSync(join(root, ".os")).sort(), ["data"], "the dry-run preflight wrote to .os");
  });

  it("TestConsolidateProspectiveCycleAndAtomicFailure/atomic replacement failure", () => {
    const { root, fs, data } = consolidationRoot([
      { id: "PER-001", type: "persona", status: "active" },
      { id: "PER-002", type: "persona", status: "active" },
    ]);
    const path = join(root, ".os", "data", "personas.jsonl");
    const before = readFileSync(path, "utf8");
    // Go replaces os.Rename; here the port's rename step fails, after the temporary file was written.
    const failingRename: FsPort = {
      ...fs,
      writeFileAtomic: () => {
        throw new FsWriteFailure("write failed", { code: "write_failed", fs: { errno: "EXDEV", step: "rename", tempName: ".buildos-consolidation-x.tmp" } });
      },
    };
    const outcome = consolidate(failingRename, data, manifestOf([mapping("PER-002", "PER-001")]), "compat", true, writeCanonicalAtomic);
    assert.equal(outcome.error?.kind, "io");
    assert.match(outcome.error?.message ?? "", /^atomically replace canonical dataset ".*personas\.jsonl": rename .*\.buildos-consolidation-x\.tmp .*personas\.jsonl: /);
    assert.equal(readFileSync(path, "utf8"), before, "failed atomic replacement changed canonical data");
    assert.deepEqual(readdirSync(join(root, ".os", "data")).filter((f) => f.endsWith(".tmp")), [], "temporary files remain");
  });

  it("writes the changed row as Go's json.Marshal of the row map: sorted keys, compact, HTML escaped", () => {
    const { root, fs, data } = makeRoot({
      "personas.jsonl": '{"id":"PER-001","type":"persona","status":"active"}\r\n{"type":"persona", "status":"active","id":"PER-002","z":[1, 2],"a":"<&> "}\n',
    });
    const outcome = consolidate(fs, data, manifestOf([mapping("PER-002", "PER-001", { reason: "a<b" })]), "compat", true);
    assert.equal(outcome.error, undefined, JSON.stringify(outcome));
    const text = readFileSync(join(root, ".os", "data", "personas.jsonl"), "utf8");
    assert.equal(
      text,
      '{"id":"PER-001","type":"persona","status":"active"}\r\n{"a":"\\u003c\\u0026\\u003e\\u2028","id":"PER-002","redirect":{"target_id":"PER-001","kind":"duplicate","decided_at":"2026-07-21T15:30:00Z","decided_by":"reviewer","reason":"a\\u003cb","evidence_refs":[]},"status":"superseded","type":"persona","updated_at":"2026-07-21T15:30:00Z","z":[1,2]}\n',
    );
  });

  it("names Go's manifest errors", () => {
    const { fs, data } = consolidationRoot([{ id: "PER-001", type: "persona", status: "active" }]);
    const dir = join(scratch, `manifest-${++counter}`);
    mkdirSync(dir);
    const message = (text: string) => {
      writeFileSync(join(dir, "m.json"), text);
      return consolidate(fs, data, { fs: createNodeFsPort(dir), given: "m.json", port: "m.json" }, "compat", false).diagnostics[0]?.message;
    };
    assert.equal(message('{"version":1,"mappings":[],"x":1}'), 'invalid consolidation manifest: json: unknown field "x"');
    assert.equal(message('{"version":1,"mappings":[{"source_id":1}]}'), "invalid consolidation manifest: json: cannot unmarshal number into Go struct field ConsolidationMapping.mappings.source_id of type string");
    assert.equal(message('{"version":1,"mappings":[{"evidence_refs":[1]}]}'), "invalid consolidation manifest: json: cannot unmarshal number into Go struct field ConsolidationMapping.mappings.evidence_refs of type string");
    assert.equal(message('{"version":1,"mappings":{}}'), "invalid consolidation manifest: json: cannot unmarshal object into Go struct field ConsolidationManifest.mappings of type []entities.ConsolidationMapping");
    assert.equal(message('{"VERSION":2,"Mappings":[]}'), "manifest version must be 1 and mappings must be a non-empty list");
    assert.equal(message(" "), "invalid consolidation manifest: EOF");
    assert.equal(message("{} {}"), "invalid consolidation manifest trailing content: multiple JSON values");
    assert.equal(message(`{"version":1,"mappings":[${JSON.stringify(mapping("PER-001", "PER-001", { decided_at: "2026-07-21T15:30:00+01:00" }))}]}`), "mapping 1: decided_at must use UTC");
    assert.equal(message(`{"version":1,"mappings":[${JSON.stringify(mapping("PER-001", "PER-001", { evidence_refs: null }))}]}`), "mapping 1: evidence_refs must be a JSON list (an empty list is allowed)");
    rmSync(join(dir, "m.json"));
    const missing = consolidate(fs, data, { fs: createNodeFsPort(dir), given: "m.json", port: "m.json" }, "compat", false);
    assert.equal(missing.diagnostics[0]?.message, `cannot read consolidation manifest: open m.json: ${POSIX ? "no such file or directory" : "The system cannot find the file specified."}`);
    assert.equal(missing.error?.kind, "input");
  });
});

describe("Go encoding/json port", () => {
  it("gives Go's syntax error text", () => {
    const err = (text: string) => goCheckValid(utf8(text));
    assert.equal(err("{not json"), "invalid character 'n' looking for beginning of object key string");
    assert.equal(err("[1,]"), "invalid character ']' looking for beginning of value");
    assert.equal(err('{"a" 1}'), "invalid character '1' after object key");
    assert.equal(err('{"a":1 "b"}'), "invalid character '\"' after object key:value pair");
    assert.equal(err("[1 2]"), "invalid character '2' after array element");
    assert.equal(err("01"), "invalid character '1' after top-level value");
    assert.equal(err("-"), "invalid character ' ' in numeric literal");
    assert.equal(err("1."), "invalid character ' ' after decimal point in numeric literal");
    assert.equal(err("1e"), "invalid character ' ' in exponent of numeric literal");
    assert.equal(err("tru"), "invalid character ' ' in literal true (expecting 'e')");
    assert.equal(err("nul!"), "invalid character '!' in literal null (expecting 'l')");
    assert.equal(err('"\\x"'), "invalid character 'x' in string escape code");
    assert.equal(err('"\\u12g4"'), "invalid character 'g' in \\u hexadecimal character escape");
    assert.equal(err('"a\tb"'), "invalid character '\\t' in string literal");
    assert.equal(err("'"), "invalid character '\\'' looking for beginning of value");
    assert.equal(goCheckValid(Uint8Array.of(0xc3)), "invalid character 'Ã' looking for beginning of value");
    assert.equal(err('{"a":'), "unexpected end of JSON input");
    assert.equal(err(""), "unexpected end of JSON input");
    assert.equal(err(' {"a":[1,{"b":null}]} '), undefined);
  });

  it("decodes keys as Go does, keeps raw values, and lets the last duplicate win", () => {
    const { object } = goUnmarshalRawObject(utf8('{"a":1,"\\u0061":  [ 1 , 2 ] ,"b":"\\ud800x","c":null}'));
    assert.ok(object !== null);
    assert.equal(new TextDecoder().decode(object.get("a")), "[ 1 , 2 ]");
    assert.equal(new TextDecoder().decode(object.get("c")), "null");
    assert.equal(new TextDecoder().decode(goMarshalRawObject(object)), '{"a":[1,2],"b":"\\ud800x","c":null}');
    assert.equal(goUnmarshalRawObject(utf8("[1]")).error, "json: cannot unmarshal array into Go value of type map[string]json.RawMessage");
    assert.equal(goUnmarshalRawObject(utf8("null")).object, null);
  });

  it("reads one value with json.Decoder rules", () => {
    const type = { kind: "int" } as const;
    assert.deepEqual(goDecodeFirst(utf8("1 2"), type), { value: 1, error: undefined, trailing: "multiple" });
    assert.equal(goDecodeFirst(utf8("-"), type).error, "unexpected EOF");
    assert.equal(goDecodeFirst(utf8("1x"), type).trailing, "invalid character 'x' looking for beginning of value");
  });

  it("parses decided_at as Go's time.Parse(time.RFC3339) and its zone offset", () => {
    assert.equal(rfc3339Offset("2026-07-21T15:30:00Z"), 0);
    assert.equal(rfc3339Offset("2026-07-21T15:30:00.123Z"), 0);
    assert.equal(rfc3339Offset("2026-07-21T15:30:00-00:00"), 0);
    assert.equal(rfc3339Offset("2026-07-21T15:30:00+01:30"), 5400);
    assert.equal(rfc3339Offset("2026-07-21T5:30:00Z"), 0, "Go's layout parser takes a one-digit hour");
    assert.equal(rfc3339Offset("2026-07-21T15:30:00,5Z"), 0, "Go's layout parser takes a comma fraction");
    for (const bad of ["2026-07-21", "2026-02-30T00:00:00Z", "2026-07-21 15:30:00Z", "2026-07-21T15:30:00", "2026-07-21T15:30:00z", "2026-07-21T24:00:00Z", "2026-07-21T15:30:60Z", "2026-07-21t15:30:00Z"]) {
      assert.equal(rfc3339Offset(bad), undefined, bad);
    }
    assert.equal(rfc3339Offset("2024-02-29T00:00:00Z"), 0);
    assert.equal(rfc3339Offset("2023-02-29T00:00:00Z"), undefined);
  });
});

describe("Go encoding/json review fixes (P3 review, findings 4 to 6)", () => {
  it("folds keys as Go's foldName: ASCII upper case, else the smallest rune of the SimpleFold orbit", () => {
    assert.equal(goFoldName("version"), "VERSION");
    assert.notEqual(goFoldName("versıon"), goFoldName("version"), "dotless i is its own orbit in Go");
    assert.notEqual(goFoldName("VERSİON"), goFoldName("version"), "dotted capital I is its own orbit in Go");
    assert.equal(goFoldName("mappingſ"), goFoldName("mappings"), "long s folds to S");
    assert.equal(goFoldName("\u212Aind"), goFoldName("kind"), "Kelvin sign folds to K");
    assert.equal(goFoldRune(0x3c2), 0x3a3, "final sigma folds to capital sigma");
    assert.equal(goFoldRune(0x131), 0x131);
  });

  it("writes a Map in Go's map order (UTF-8 byte order), never JavaScript's integer-key order", () => {
    const map = new Map<string, string>([["b", "x"], ["10", "x"], ["2", "x"], ["\uE000", "x"], ["𐀀", "x"], ["é", "x"]]);
    const keys = [...goMarshalIndent(map, true).matchAll(/"([^"]+)":/g)].map((m) => m[1]);
    assert.deepEqual(keys, ["10", "2", "b", "é", "\uE000", "𐀀"]);
    // A plain object with integer-like keys would put "2" before "10".
    assert.deepEqual(Object.keys({ "10": 1, "2": 1 }), ["2", "10"]);
  });

  it("marshals an index with integer-like IDs in Go's order", () => {
    const text = new TextDecoder().decode(
      marshalIndex({ version: 1, canonical_by_id: new Map([["2", "Z"], ["10", "Z"]]), members_by_canonical: new Map([["Z", ["2", "10"]]]) }),
    );
    assert.equal(text, '{\n  "version": 1,\n  "canonical_by_id": {\n    "10": "Z",\n    "2": "Z"\n  },\n  "members_by_canonical": {\n    "Z": [\n      "10",\n      "2"\n    ]\n  }\n}\n');
  });

  it("parses 10000 levels of nesting without the call stack, and refuses 10001 as Go does", () => {
    const deep = (n: number) => utf8(`${"[".repeat(n)}0${"]".repeat(n)}`);
    assert.equal(goCheckValid(deep(10000)), undefined);
    let node = parseTree(deep(10000));
    let depth = 0;
    while (node.kind === "array") {
      depth++;
      node = node.items[0]!;
    }
    assert.equal(depth, 10000);
    assert.equal(goCheckValid(deep(10001)), "invalid character '[' exceeded max depth");
  });

  it("reports an out-of-range trailing number as Go's float64 decode error", () => {
    const type: GoType = { kind: "struct", name: "main.T", short: "T", fields: [] };
    assert.equal(goDecodeFirst(utf8("{} 1e999"), type).trailing, "json: cannot unmarshal number 1e999 into Go value of type float64");
    assert.equal(goDecodeFirst(utf8("{} 1e308"), type).trailing, "multiple");
    assert.equal(goDecodeFirst(utf8('{} {"1e999":["x",-2e999,3e999]}'), type).trailing, "json: cannot unmarshal number -2e999 into Go value of type float64");
  });
});

describe("Go 1.24.1 encoding/json and time.Parse goldens (test/fixtures/go-seed/entity-json.json)", () => {
  const goldens = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "go-seed", "entity-json.json"), "utf8")) as {
    goVersion: string;
    input: Record<"unmarshal" | "manifest" | "index" | "times" | "raw_marshal" | "slice_cap", string[]>;
    output: Record<string, string[]>;
  };
  // The capture program's types live in package main, so Go names them main.X.
  const strings = (names: string[]) => names.map((name) => ({ name, type: { kind: "string" } as GoType }));
  const MANIFEST: GoType = {
    kind: "struct",
    name: "main.ConsolidationManifest",
    short: "ConsolidationManifest",
    fields: [
      { name: "version", type: { kind: "int" } },
      {
        name: "mappings",
        type: {
          kind: "slice",
          name: "[]main.ConsolidationMapping",
          elem: {
            kind: "struct",
            name: "main.ConsolidationMapping",
            short: "ConsolidationMapping",
            fields: [...strings(["source_id", "target_id", "kind", "decided_at", "decided_by", "reason"]), { name: "evidence_refs", type: { kind: "slice", name: "[]string", elem: { kind: "string" } } }],
          },
        },
      },
    ],
  };
  const INDEX: GoType = {
    kind: "struct",
    name: "main.ResolutionIndex",
    short: "ResolutionIndex",
    fields: [
      { name: "version", type: { kind: "int" } },
      { name: "canonical_by_id", type: { kind: "map", name: "map[string]string", elem: { kind: "string" } } },
      { name: "members_by_canonical", type: { kind: "map", name: "map[string][]string", elem: { kind: "slice", name: "[]string", elem: { kind: "string" } } } },
    ],
  };
  /** Go's json.Marshal of a decoded value (HTML escaped; maps in key order). */
  const goJson = (v: GoDecoded): string => {
    if (v === null) return "null";
    if (typeof v === "string") return goEncodeString(v, true);
    if (typeof v === "number") return String(v);
    if (v instanceof Map) return `{${[...v.keys()].sort(goCompare).map((k) => `${goEncodeString(k, true)}:${goJson(v.get(k)!)}`).join(",")}}`;
    if (Array.isArray(v)) return `[${v.map(goJson).join(",")}]`;
    if (v instanceof Uint8Array) throw new Error("raw value");
    return `{${Object.entries(v).map(([k, x]) => `${goEncodeString(k, true)}:${goJson(x)}`).join(",")}}`;
  };
  const decode = (text: string, type: GoType) => {
    const r = goDecodeFirst(utf8(text), type);
    if (r.error !== undefined) return `first: ${r.error}`;
    if (r.trailing === "multiple") return "trailing: multiple";
    if (r.trailing !== undefined) return `trailing: ${r.trailing}`;
    return `ok ${goJson(r.value)}`;
  };
  const ours: Record<string, (s: string) => string> = {
    unmarshal: (s) => {
      const r = goUnmarshalRawObject(utf8(s));
      return r.error ?? (r.object === null ? "nil" : "ok");
    },
    manifest: (s) => decode(s, MANIFEST),
    index: (s) => decode(s, INDEX),
    times: (s) => String(rfc3339Offset(s) ?? "error"),
    raw_marshal: (s) => {
      const r = goUnmarshalRawObject(utf8(s));
      return r.error !== undefined ? `error ${r.error}` : new TextDecoder().decode(goMarshalRawObject(r.object!));
    },
    // Capacity of []string, []main.ConsolidationMapping, and []int after n elements are decoded into a nil slice.
    slice_cap: (s) => {
      const cap = (elem: GoType) => {
        let c = 0;
        while (c < Number(s)) c = goGrowCap(c, elem);
        return c;
      };
      const mapping = (MANIFEST as { fields: readonly { type: GoType }[] }).fields[1]!.type as { elem: GoType };
      return `${cap({ kind: "string" })} ${cap(mapping.elem)} ${cap({ kind: "int" })}`;
    },
  };
  it("was captured with Go 1.24.1", () => assert.match(goldens.goVersion, /^go version go1\.24\.1 /));
  for (const [kind, inputs] of Object.entries(goldens.input)) {
    it(`matches Go for every ${kind} input`, () => {
      inputs.forEach((input, i) => assert.equal(ours[kind]!(input), goldens.output[kind]![i], JSON.stringify(input)));
    });
  }
});

describe("isNullLiteral (W1 R7 P6 t29)", () => {
  it("is Go bytes.TrimSpace then null: spaces around null count, a leading U+FEFF does not", async () => {
    const { isNullLiteral } = await import("../src/core/entities/graph.ts");
    const bytes = (text: string) => new TextEncoder().encode(text);
    assert.equal(isNullLiteral(bytes("null")), true);
    assert.equal(isNullLiteral(bytes(" \t\r\nnull\n ")), true);
    assert.equal(isNullLiteral(bytes("\u0085null ")), true);
    assert.equal(isNullLiteral(bytes("﻿null")), false);
    assert.equal(isNullLiteral(bytes("null﻿")), false);
    assert.equal(isNullLiteral(bytes("nul")), false);
    assert.equal(isNullLiteral(new Uint8Array([0xef, 0xbb, 0xbf, 0x6e, 0x75, 0x6c, 0x6c])), false);
  });
});
