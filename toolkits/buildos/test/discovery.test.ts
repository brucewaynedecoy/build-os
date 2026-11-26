// Ported Go tests for discovery (W1 R7 P5 t3):
// toolkits/buildos-discovery/internal/discovery/discovery_test.go and
// toolkits/buildos-discovery/cmd/buildos-discovery/main_test.go, by Go test
// name, plus A33: discovery resolves entities in this process, never through
// a subprocess.
//
// Go paths in this comment name the Go sources at the frozen baseline
// commit 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).

import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs, { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import { DISCOVERY_USAGE } from "../src/cli/commands/discovery.ts";
import { run } from "../src/cli/run.ts";
import {
  qualifyFinding,
  recordDiscoveryRun,
  type DiscoveryContext,
  type QualifyFindingOptions,
  type RunDiscoveryOptions,
} from "../src/core/discovery/discovery.ts";
import { FsReadFailure, FsWriteFailure } from "../src/core/shared/errors.ts";
import type { FsPortFactory } from "../src/core/shared/fs-port.ts";
import { COPY_CHUNK_BYTES, GoError } from "../src/core/shared/go-files.ts";
import { captureIo } from "./helpers.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "buildos-discovery-"));
  roots.push(root);
  return root;
}

/**
 * The text the port gives a planted `EIO`: Go's `input/output error` on
 * darwin and linux. On Windows a real I/O error reaches Go as a Win32 error
 * whose text depends on which one it is, and libuv folds several into
 * `EIO`, so the port keeps the code name there (`EIO`). The tests that plant
 * an `EIO` check this text, so on Windows they still prove the cleanup and
 * the retry. The text is a literal per OS, not a value from the code under
 * test.
 */
const EIO_TEXT = process.platform === "win32" ? "EIO" : "input/output error";
const EIO_PATTERN = EIO_TEXT.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const context = (cwd = process.cwd()): DiscoveryContext => ({ cwd, openFs: createNodeFsPort });

interface Playbook {
  id: string;
  path: string;
  title: string;
  category: string;
  execution_mode: string;
  state_nature: string;
  status: string;
  audience: string;
  harness: string[];
  systems: string[];
  environments: string[];
  owners: string[];
  targets: string[];
  produces: string[];
  source_anchor: null;
  version: string;
  related: string[];
}

function activeDiscoveryPlaybookFixture(id: string): Playbook {
  return {
    id,
    path: "system/playbooks/discovery/sample.md",
    title: "Sample discovery playbook",
    category: "discovery",
    execution_mode: "guided-objective",
    state_nature: "stateful",
    status: "active",
    audience: "both",
    harness: ["computer-use"],
    systems: ["primary-system"],
    environments: ["baseline"],
    owners: ["adopter-team"],
    targets: ["REQ-001"],
    produces: ["finding"],
    source_anchor: null,
    version: "1.0.0",
    related: [],
  };
}

function writeTextFile(root: string, rel: string, body: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

function readTextFile(root: string, rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function writeEntityGraph(root: string, installed: boolean, requirements?: string[]): void {
  const prefix = installed ? "" : "system/";
  for (const name of ["requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"]) {
    writeTextFile(root, `${prefix}.os/data/${name}`, "");
  }
  const rows = requirements ?? ['{"id":"REQ-001","type":"requirement","status":"active"}'];
  writeTextFile(root, `${prefix}.os/data/requirements.jsonl`, `${rows.join("\n")}\n`);
}

function writePlaybookIndex(root: string, playbook: Playbook, runnable: boolean, installed = false): void {
  const index = { version: 1, playbooks: [playbook], runnable_playbooks: runnable ? [playbook] : null };
  writeTextFile(root, `${installed ? "" : "system/"}.os/indexes/playbooks.json`, `${JSON.stringify(index)}\n`);
  writeEntityGraph(root, installed);
}

function writeInstalledSystemRoot(root: string): void {
  for (const rel of [".os", "assets", "docs", "playbooks", "workspace"]) mkdirSync(join(root, rel), { recursive: true });
}

function readJsonlRows(root: string, rel: string): Record<string, unknown>[] {
  const text = readTextFile(root, rel).trim();
  if (text === "") return [];
  return text.split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

function readSingleJsonlRow(root: string, rel: string): Record<string, unknown> {
  const rows = readJsonlRows(root, rel);
  assert.equal(rows.length, 1, `expected one row in ${rel}`);
  return rows[0]!;
}

const runOptions = (root: string, extra: Partial<RunDiscoveryOptions>): RunDiscoveryOptions => ({
  repoRoot: root,
  playbookId: "",
  outcome: "",
  title: "",
  targets: [],
  datasetRefs: [],
  evidencePaths: [],
  rawFindingPaths: [],
  dryRun: false,
  ...extra,
});

const qualifyOptions = (root: string, extra: Partial<QualifyFindingOptions>): QualifyFindingOptions => ({
  repoRoot: root,
  runId: "",
  rawFindingRef: "",
  outcome: "",
  title: "",
  confirmationTest: "",
  confirmationEvidence: "",
  dryRun: false,
  ...extra,
});

function goError(action: () => unknown, includes: string): void {
  assert.throws(action, (error: unknown) => error instanceof GoError && error.message.includes(includes), `expected an error with ${JSON.stringify(includes)}`);
}

describe("discovery (Go internal/discovery tests)", () => {
  it("TestRecordDiscoveryRunCreatesArtifactsAndDoesNotPromoteRawFinding", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/evidence.txt", "evidence");
    writeTextFile(root, "inputs/raw.md", "raw finding text");
    const result = recordDiscoveryRun(
      context(),
      runOptions(root, {
        playbookId: "PB-010",
        outcome: "negative",
        targets: ["REQ-001"],
        datasetRefs: ["system/workspace/datasets/example.csv"],
        evidencePaths: ["inputs/evidence.txt"],
        rawFindingPaths: ["inputs/raw.md"],
      }),
    );
    assert.equal(result.runId, "RUN-001");
    assert.equal(result.rawFindingCount, 1);
    assert.equal(result.evidenceCount, 1);
    for (const rel of ["system/workspace/runs/RUN-001/run.md", "system/workspace/runs/RUN-001/raw-findings.md", "system/workspace/runs/RUN-001/evidence/001-evidence.txt"]) {
      assert.ok(existsSync(join(root, rel)), rel);
    }
    assert.equal(readJsonlRows(root, "system/.os/data/findings.jsonl").length, 0, "raw finding should not promote to findings.jsonl");
    const raw = readTextFile(root, "system/workspace/runs/RUN-001/raw-findings.md");
    assert.ok(raw.includes("raw-finding-1") && raw.includes("raw finding text"));
    const row = readSingleJsonlRow(root, "system/.os/data/runs.jsonl");
    assert.equal(row["id"], "RUN-001");
    assert.equal(row["status"], "closed");
    assert.equal(row["outcome"], "negative");
    assert.equal(row["playbook_id"], "PB-010");
  });

  it("TestRecordDiscoveryRunDryRunDoesNotWrite", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding text");
    const result = recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"], dryRun: true }));
    assert.ok(result.dryRun);
    assert.equal(result.runId, "RUN-001");
    assert.ok(!existsSync(join(root, "system/workspace/runs/RUN-001")));
    assert.equal(readJsonlRows(root, "system/.os/data/runs.jsonl").length, 0);
  });

  it("TestRecordDiscoveryRunRejectsImmutableRunFolder", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    mkdirSync(join(root, "system/workspace/runs/RUN-001"), { recursive: true });
    goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" })), "already exists");
  });

  it("TestRecordDiscoveryRunRejectsDuplicateIDs", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "system/.os/data/runs.jsonl", '{"id":"RUN-001","type":"run","status":"active"}\n{"id":"RUN-001","type":"run","status":"active"}\n');
    goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" })), "duplicate_id");
  });

  for (const tt of [
    { name: "not runnable", playbook: activeDiscoveryPlaybookFixture("PB-010"), runnable: false, want: "not active/runnable" },
    { name: "wrong category", playbook: { ...activeDiscoveryPlaybookFixture("PB-010"), category: "testing" }, runnable: true, want: "category discovery" },
  ]) {
    it(`TestRecordDiscoveryRunRejectsInactiveAndNonDiscoveryPlaybooks/${tt.name}`, () => {
      const root = tempRoot();
      writePlaybookIndex(root, tt.playbook, tt.runnable);
      goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" })), tt.want);
    });
  }

  it("TestRecordDiscoveryRunRejectsInvalidOutcomeAndMissingRawFile", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "maybe" })), "requires --outcome");
    goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["missing.md"] })), "missing.md");
  });

  it("TestRecordDiscoveryRunSupportsInstalledRootLayout", () => {
    const root = tempRoot();
    writeInstalledSystemRoot(root);
    writePlaybookIndex(root, { ...activeDiscoveryPlaybookFixture("PB-010"), path: "playbooks/discovery/sample.md" }, true, true);
    writeTextFile(root, "assets/_incoming/evidence.txt", "evidence");
    writeTextFile(root, "assets/_incoming/raw.md", "raw finding text");
    const result = recordDiscoveryRun(
      context(),
      runOptions(root, {
        playbookId: "PB-010",
        outcome: "positive",
        datasetRefs: ["system/workspace/datasets/example.csv"],
        evidencePaths: ["assets/_incoming/evidence.txt"],
        rawFindingPaths: ["assets/_incoming/raw.md"],
      }),
    );
    assert.equal(result.runPath, "workspace/runs/RUN-001/");
    assert.equal(result.runsIndexPath, ".os/data/runs.jsonl");
    for (const rel of ["workspace/runs/RUN-001/run.md", "workspace/runs/RUN-001/raw-findings.md", "workspace/runs/RUN-001/evidence/001-evidence.txt", ".os/data/runs.jsonl"]) {
      assert.ok(existsSync(join(root, rel)), rel);
    }
    assert.ok(!existsSync(join(root, "system/workspace/runs/RUN-001/run.md")));
    const row = readSingleJsonlRow(root, ".os/data/runs.jsonl");
    assert.equal(row["path"], "workspace/runs/RUN-001/");
    assert.equal(row["doc_anchor"], "docs/prd/10-discovery-runs-and-qualification.md#run-artifacts");
    assert.deepEqual(row["dataset_refs"], ["workspace/datasets/example.csv"]);
    const sourceRefs = row["source_refs"] as string[];
    for (const want of ["assets/_incoming/raw.md", "playbooks/discovery/sample.md"]) assert.ok(sourceRefs.includes(want), want);
  });

  function recordedRun(root: string, outcome = "positive", rawPath = "inputs/raw.md"): void {
    recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome, rawFindingPaths: [rawPath] }));
  }

  it("TestQualifyFindingPromotesPositiveAndNegativeFindings", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding text");
    recordedRun(root, "negative");
    writeTextFile(root, "tests/confirm-positive.spec.ts", "test('positive', async () => {})");
    writeTextFile(root, "tests/confirm-negative.spec.ts", "test('negative', async () => {})");
    writeTextFile(root, "evidence/positive.txt", "passed");
    writeTextFile(root, "evidence/negative.txt", "passed");
    const positive = qualifyFinding(
      context(),
      qualifyOptions(root, { runId: "RUN-001", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm-positive.spec.ts", confirmationEvidence: "evidence/positive.txt" }),
    );
    assert.equal(positive.findingId, "FIND-001");
    const negative = qualifyFinding(
      context(),
      qualifyOptions(root, { runId: "RUN-001", rawFindingRef: "raw-findings.md#raw-finding-1", outcome: "negative", confirmationTest: "tests/confirm-negative.spec.ts", confirmationEvidence: "evidence/negative.txt" }),
    );
    assert.equal(negative.findingId, "FIND-002");
    assert.ok(existsSync(join(root, "system/workspace/findings/FIND-001/finding.md")));
    assert.ok(existsSync(join(root, "system/workspace/findings/FIND-002/qualification.md")));
    const qualification = readTextFile(root, "system/workspace/findings/FIND-002/qualification.md");
    assert.ok(qualification.includes("Negative Assertion") && qualification.includes("asserts the negative condition"));
    const rows = readJsonlRows(root, "system/.os/data/findings.jsonl");
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!["status"], "qualified");
    assert.notEqual(rows[1]!["negative_assertion"], undefined);
    assert.equal(rows[0]!["negative_assertion"], undefined, "omitempty drops an empty negative assertion");
  });

  it("TestQualifyFindingSupportsInstalledRootLayout", () => {
    const root = tempRoot();
    writeInstalledSystemRoot(root);
    writePlaybookIndex(root, { ...activeDiscoveryPlaybookFixture("PB-010"), path: "playbooks/discovery/sample.md" }, true, true);
    writeTextFile(root, "assets/_incoming/raw.md", "raw finding text");
    recordedRun(root, "positive", "assets/_incoming/raw.md");
    writeTextFile(root, "workspace/tests/confirm.spec.ts", "test('confirm', async () => {})");
    writeTextFile(root, "workspace/evidence/confirmation.txt", "passed");
    const result = qualifyFinding(
      context(),
      qualifyOptions(root, {
        runId: "RUN-001",
        rawFindingRef: "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
        outcome: "positive",
        confirmationTest: "system/workspace/tests/confirm.spec.ts",
        confirmationEvidence: "system/workspace/evidence/confirmation.txt",
      }),
    );
    assert.equal(result.findingPath, "workspace/findings/FIND-001/");
    assert.equal(result.findingsIndexPath, ".os/data/findings.jsonl");
    for (const rel of ["workspace/findings/FIND-001/finding.md", "workspace/findings/FIND-001/qualification.md", ".os/data/findings.jsonl"]) assert.ok(existsSync(join(root, rel)), rel);
    assert.ok(!existsSync(join(root, "system/workspace/findings/FIND-001/finding.md")));
    const row = readSingleJsonlRow(root, ".os/data/findings.jsonl");
    for (const [key, want] of Object.entries({
      path: "workspace/findings/FIND-001/",
      raw_anchor: "workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
      qualification_test: "workspace/findings/FIND-001/qualification.md#confirmation-test",
      confirmation_test: "workspace/findings/FIND-001/confirmation-test/001-confirm.spec.ts",
      confirmation_evidence: "workspace/findings/FIND-001/evidence/001-confirmation.txt",
      doc_anchor: "docs/prd/10-discovery-runs-and-qualification.md#finding-qualification",
    })) {
      assert.equal(row[key], want, key);
    }
  });

  it("TestQualifyFindingDryRunDoesNotWrite", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding text");
    recordedRun(root);
    writeTextFile(root, "tests/confirm.spec.ts", "test('confirm', async () => {})");
    writeTextFile(root, "evidence/confirmation.txt", "passed");
    const result = qualifyFinding(
      context(),
      qualifyOptions(root, { runId: "RUN-001", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/confirmation.txt", dryRun: true }),
    );
    assert.ok(result.dryRun);
    assert.equal(result.findingId, "FIND-001");
    assert.ok(!existsSync(join(root, "system/workspace/findings/FIND-001")));
    assert.equal(readJsonlRows(root, "system/.os/data/findings.jsonl").length, 0);
  });

  it("TestQualifyFindingRejectsMissingRawAnchorMissingEvidenceAndDuplicateIDs", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding text");
    recordedRun(root);
    writeTextFile(root, "tests/confirm.spec.ts", "test('confirm', async () => {})");
    writeTextFile(root, "evidence/confirmation.txt", "passed");
    const base = { runId: "RUN-001", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/confirmation.txt" };
    goError(() => qualifyFinding(context(), qualifyOptions(root, { ...base, rawFindingRef: "#missing" })), "not found");
    goError(() => qualifyFinding(context(), qualifyOptions(root, { ...base, confirmationEvidence: "missing.txt" })), "missing.txt");
    writeTextFile(root, "system/.os/data/findings.jsonl", '{"id":"FIND-001","type":"finding","status":"active"}\n{"id":"FIND-001","type":"finding","status":"active"}\n');
    goError(() => qualifyFinding(context(), qualifyOptions(root, base)), "duplicate_id");
  });

  it("TestRecordDiscoveryRunResolvesRedirectedTargetsAndPersistsCanonicalReferences", () => {
    const root = tempRoot();
    writePlaybookIndex(root, { ...activeDiscoveryPlaybookFixture("PB-010"), targets: ["REQ-002"] }, true);
    writeEntityGraph(root, false, [
      '{"id":"REQ-001","type":"requirement","status":"active"}',
      '{"id":"REQ-002","type":"requirement","status":"superseded","redirect":{"target_id":"REQ-001","kind":"duplicate","decided_at":"2026-07-21T12:00:00Z","decided_by":"test-reviewer","reason":"same requirement","evidence_refs":[]}}',
    ]);
    writeTextFile(root, "system/.os/indexes/entity-resolution.json", '{"version":1,"canonical_by_id":{"REQ-002":"REQ-999"},"members_by_canonical":{"REQ-999":["REQ-002"]}}\n');
    const result = recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" }));
    assert.deepEqual(result.requestedTargets, ["REQ-002"]);
    assert.deepEqual(result.canonicalTargets, ["REQ-001"]);
    assert.deepEqual(result.targetResolutions, [{ requested_id: "REQ-002", canonical_id: "REQ-001", chain: ["REQ-002", "REQ-001"] }]);
    const row = readSingleJsonlRow(root, "system/.os/data/runs.jsonl");
    assert.deepEqual(row["requested_targets"], ["REQ-002"]);
    assert.deepEqual(row["targets"], ["REQ-001"]);
    const related = row["related"] as string[];
    assert.ok(related.includes("REQ-001") && !related.includes("REQ-002"));
    assert.deepEqual((row["inputs"] as Record<string, unknown>)["requested_targets"], ["REQ-002"]);
    const runDoc = readTextFile(root, "system/workspace/runs/RUN-001/run.md");
    for (const want of ["Requested targets: REQ-002", "Targets: REQ-001", "REQ-002 -> REQ-001"]) assert.ok(runDoc.includes(want), want);
    assert.ok(readTextFile(root, "system/.os/indexes/playbooks.json").includes('"targets":["REQ-002"]'), "authored playbook target was rewritten");
  });

  it("TestRecordDiscoveryRunFailsClosedOnInvalidEntityGraph", () => {
    const root = tempRoot();
    writePlaybookIndex(root, { ...activeDiscoveryPlaybookFixture("PB-010"), targets: ["REQ-002"] }, true);
    writeEntityGraph(root, false, [
      '{"id":"REQ-002","type":"requirement","status":"superseded","redirect":{"target_id":"REQ-999","kind":"duplicate","decided_at":"2026-07-21T12:00:00Z","decided_by":"test-reviewer","reason":"invalid fixture","evidence_refs":[]}}',
    ]);
    goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" })), "redirect_missing_target");
    assert.ok(!existsSync(join(root, "system/workspace/runs/RUN-001")));
    assert.equal(readJsonlRows(root, "system/.os/data/runs.jsonl").length, 0);
  });

  it("TestRecordDiscoveryRunFailsClosedOnUnknownTarget", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    goError(() => recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", targets: ["CAP-999"] })), "entity_not_found");
  });

  it("TestQualifyFindingResolvesRedirectedRunAndPersistsCanonicalReferences", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(
      root,
      "system/.os/data/runs.jsonl",
      [
        '{"id":"RUN-001","type":"run","status":"closed","systems":["canonical-system"],"environments":["canonical-environment"],"owners":["canonical-owner"]}',
        '{"id":"RUN-002","type":"run","status":"superseded","systems":["historical-system"],"environments":["historical-environment"],"owners":["historical-owner"],"redirect":{"target_id":"RUN-001","kind":"duplicate","decided_at":"2026-07-21T12:00:00Z","decided_by":"test-reviewer","reason":"same discovery run","evidence_refs":[]}}',
      ].join("\n") + "\n",
    );
    writeTextFile(root, "system/.os/indexes/entity-resolution.json", '{"version":1,"canonical_by_id":{"RUN-002":"RUN-999"},"members_by_canonical":{"RUN-999":["RUN-002"]}}\n');
    writeTextFile(root, "system/workspace/runs/RUN-002/raw-findings.md", "# Raw Findings\n\n## Raw Finding 1 {#raw-finding-1}\n\nhistorical evidence\n");
    writeTextFile(root, "tests/confirm.spec.ts", "test('confirm', async () => {})");
    writeTextFile(root, "evidence/confirmation.txt", "passed");
    const beforeRuns = readTextFile(root, "system/.os/data/runs.jsonl");
    const beforeRaw = readTextFile(root, "system/workspace/runs/RUN-002/raw-findings.md");
    const result = qualifyFinding(
      context(),
      qualifyOptions(root, { runId: "RUN-002", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/confirmation.txt" }),
    );
    assert.equal(result.requestedRunId, "RUN-002");
    assert.equal(result.canonicalRunId, "RUN-001");
    assert.deepEqual(result.runResolution.chain, ["RUN-002", "RUN-001"]);
    const row = readSingleJsonlRow(root, "system/.os/data/findings.jsonl");
    for (const [key, want] of Object.entries({
      status: "qualified",
      requested_run_id: "RUN-002",
      run_id: "RUN-001",
      origin_run: "RUN-001",
      raw_anchor: "system/workspace/runs/RUN-002/raw-findings.md#raw-finding-1",
      source_anchor: "system/workspace/runs/RUN-002/raw-findings.md#raw-finding-1",
    })) {
      assert.equal(row[key], want, key);
    }
    for (const key of ["basis_refs", "related"]) {
      const refs = row[key] as string[];
      assert.ok(refs.includes("RUN-001") && !refs.includes("RUN-002"), key);
    }
    assert.deepEqual(row["systems"], ["canonical-system"]);
    const findingDoc = readTextFile(root, "system/workspace/findings/FIND-001/finding.md");
    for (const want of ["Requested run: RUN-002", "Origin run: RUN-001", "RUN-002/raw-findings.md#raw-finding-1"]) assert.ok(findingDoc.includes(want), want);
    assert.equal(readTextFile(root, "system/.os/data/runs.jsonl"), beforeRuns);
    assert.equal(readTextFile(root, "system/workspace/runs/RUN-002/raw-findings.md"), beforeRaw);
  });

  it("TestQualifyFindingResolverFailureDoesNotWrite", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "tests/confirm.spec.ts", "test('confirm', async () => {})");
    writeTextFile(root, "evidence/confirmation.txt", "passed");
    goError(
      () => qualifyFinding(context(), qualifyOptions(root, { runId: "RUN-999", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/confirmation.txt" })),
      "entity_not_found",
    );
    assert.ok(!existsSync(join(root, "system/workspace/findings/FIND-001")));
    assert.equal(readJsonlRows(root, "system/.os/data/findings.jsonl").length, 0);
  });
});

describe("buildos discovery (Go cmd/buildos-discovery tests)", () => {
  it("TestUsageIncludesDiscoveryCommands", () => {
    for (const want of ["buildos-discovery run discovery", "buildos-discovery qualify finding"]) assert.ok(DISCOVERY_USAGE.includes(want), want);
  });

  async function cli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    const io = captureIo();
    const code = await run(["discovery", ...args], io);
    return { code, stdout: io.stdout(), stderr: io.stderr() };
  }

  it("TestRunDiscoveryCommand", async () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding");
    const out = await cli(["run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "positive", "--raw-finding", "inputs/raw.md"]);
    assert.equal(out.code, 0, out.stderr);
    assert.ok(out.stdout.includes("wrote ") && out.stdout.includes("RUN-001"), out.stdout);
    assert.ok(out.stdout.includes("target REQ-001 -> REQ-001 (REQ-001)"), out.stdout);
  });

  it("TestQualifyFindingCommand", async () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding");
    assert.equal((await cli(["run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "negative", "--raw-finding", "inputs/raw.md"])).code, 0);
    writeTextFile(root, "tests/confirm.spec.ts", "test('negative assertion', async () => {})");
    writeTextFile(root, "evidence/confirmation.txt", "passed");
    const out = await cli([
      "qualify", "finding", "--repo-root", root, "--run-id", "RUN-001", "--raw-finding-ref", "#raw-finding-1", "--outcome", "negative",
      "--confirmation-test", "tests/confirm.spec.ts", "--confirmation-evidence", "evidence/confirmation.txt",
    ]);
    assert.equal(out.code, 0, out.stderr);
    assert.ok(out.stdout.includes("wrote ") && out.stdout.includes("FIND-001"), out.stdout);
    assert.ok(out.stdout.includes("run RUN-001 -> RUN-001 (RUN-001)"), out.stdout);
  });

  it("prints the shared envelope with --json: planned for a dry run, applied for a write, and a failure with exit 1", async () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    const dry = await cli(["run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "positive", "--dry-run", "--json"]);
    assert.equal(dry.code, 0, dry.stderr);
    assert.equal(dry.stderr, "");
    const planned = JSON.parse(dry.stdout) as { ok: boolean; command: string; write_status: string; result: { run_id: string; dry_run: boolean } };
    assert.deepEqual([planned.ok, planned.command, planned.write_status, planned.result.run_id, planned.result.dry_run], [true, "discovery.run", "planned", "RUN-001", true]);
    assert.ok(!existsSync(join(root, "system/workspace/runs/RUN-001")));
    const applied = JSON.parse((await cli(["run", "discovery", "--repo-root", root, "--playbook-id", "PB-010", "--outcome", "positive", "--json"])).stdout) as { write_status: string };
    assert.equal(applied.write_status, "applied");
    const failed = await cli(["run", "discovery", "--repo-root", root, "--playbook-id", "PB-999", "--outcome", "positive", "--json"]);
    assert.equal(failed.code, 1);
    const envelope = JSON.parse(failed.stdout) as { ok: boolean; write_status: string; diagnostics: { message: string }[] };
    assert.deepEqual([envelope.ok, envelope.write_status, envelope.diagnostics[0]!.message], [false, "not_requested", "playbook PB-999 not found in playbook index"]);
  });
});

describe("folder modes", () => {
  it("creates run folders as Go's MkdirAll(dir, 0o755) under umask 002", { skip: process.platform === "win32" ? "no POSIX permission bits" : false }, () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    const previous = process.umask(0o002);
    try {
      recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] }));
    } finally {
      process.umask(previous);
    }
    for (const rel of ["system/workspace", "system/workspace/runs", "system/workspace/runs/RUN-001", "system/workspace/runs/RUN-001/evidence"]) {
      assert.equal(statSync(join(root, rel)).mode & 0o777, 0o755, rel);
    }
    assert.equal(statSync(join(root, "system/workspace/runs/RUN-001/run.md")).mode & 0o777, 0o644);
  });
});

describe("run and finding folder reservation and cleanup (P5 review round 1)", () => {
  /** A port factory whose write port runs `before` ahead of each matching call. */
  const plantedFs =
    (hook: { mkdir?: (path: string, recursive: boolean) => void; writeNewFile?: (path: string) => void; remove?: (path: string) => void }): FsPortFactory =>
    (r, cwd, options) => {
      const port = createNodeFsPort(r, cwd, options);
      return {
        ...port,
        remove: (path) => {
          hook.remove?.(path);
          port.remove(path);
        },
        mkdir: (path, opts) => {
          hook.mkdir?.(path, opts?.recursive !== false);
          port.mkdir(path, opts);
        },
        writeNewFile: (path, data, opts) => {
          hook.writeNewFile?.(path);
          return port.writeNewFile(path, data, opts);
        },
      };
    };

  it("fails cleanly when another command creates the run folder after the ID is chosen, and keeps that command's files", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    const runsIndex = readFileSync(join(root, "system/.os/data/runs.jsonl"));
    const runDir = join(root, "system/workspace/runs/RUN-001");
    // The other command reserves RUN-001 between our ID choice and our first write.
    const openFs = plantedFs({
      mkdir: (path, recursive) => {
        if (!recursive && path === "system/workspace/runs/RUN-001" && !existsSync(runDir)) {
          mkdirSync(runDir, { recursive: true });
          writeFileSync(join(runDir, "run.md"), "the other command\n");
        }
      },
    });
    assert.throws(
      () => recordDiscoveryRun({ cwd: process.cwd(), openFs }, runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] })),
      (error: unknown) => error instanceof GoError && error.message === "run artifact system/workspace/runs/RUN-001/ already exists",
    );
    assert.deepEqual(readdirSync(runDir), ["run.md"]);
    assert.equal(readFileSync(join(runDir, "run.md"), "utf8"), "the other command\n");
    assert.deepEqual(readFileSync(join(root, "system/.os/data/runs.jsonl")), runsIndex);
  });

  it("removes what it created when a step after the reservation fails, so the same run can be recorded again", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    writeTextFile(root, "inputs/evidence.txt", "evidence");
    const runsIndex = readFileSync(join(root, "system/.os/data/runs.jsonl"));
    const openFs = plantedFs({
      writeNewFile: (path) => {
        if (path.endsWith("raw-findings.md")) throw new FsWriteFailure("planted", { code: "write_failed", fs: { errno: "EIO", syscall: "write" } });
      },
    });
    const options = runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"], evidencePaths: ["inputs/evidence.txt"] });
    assert.throws(
      () => recordDiscoveryRun({ cwd: process.cwd(), openFs }, options),
      (error: unknown) => error instanceof GoError && new RegExp(`^write .*raw-findings\\.md: ${EIO_PATTERN}$`).test(error.message),
    );
    assert.deepEqual(readdirSync(join(root, "system/workspace/runs")), []);
    assert.deepEqual(readFileSync(join(root, "system/.os/data/runs.jsonl")), runsIndex);
    const retry = recordDiscoveryRun(context(), options);
    assert.equal(retry.runId, "RUN-001");
    assert.deepEqual(readdirSync(join(root, "system/workspace/runs/RUN-001")).sort(), ["evidence", "raw-findings.md", "run.md"]);
  });

  it("fails cleanly when another command creates the finding folder after the ID is chosen", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] }));
    writeTextFile(root, "tests/confirm.spec.ts", "test");
    writeTextFile(root, "evidence/run.txt", "evidence");
    const findingsIndex = readFileSync(join(root, "system/.os/data/findings.jsonl"));
    const findingDir = join(root, "system/workspace/findings/FIND-001");
    const openFs = plantedFs({
      mkdir: (path, recursive) => {
        if (!recursive && path === "system/workspace/findings/FIND-001" && !existsSync(findingDir)) mkdirSync(findingDir, { recursive: true });
      },
    });
    const qualify: QualifyFindingOptions = {
      repoRoot: root,
      runId: "RUN-001",
      rawFindingRef: "#raw-finding-1",
      outcome: "positive",
      title: "",
      confirmationTest: "tests/confirm.spec.ts",
      confirmationEvidence: "evidence/run.txt",
      dryRun: false,
    };
    assert.throws(
      () => qualifyFinding({ cwd: process.cwd(), openFs }, qualify),
      (error: unknown) => error instanceof GoError && error.message === "finding artifact system/workspace/findings/FIND-001/ already exists",
    );
    assert.deepEqual(readdirSync(findingDir), []);
    assert.deepEqual(readFileSync(join(root, "system/.os/data/findings.jsonl")), findingsIndex);
  });

  it("copies evidence as a stream: a source read failure removes the partial copy and the run folder", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    writeTextFile(root, "inputs/evidence.bin", "x".repeat(COPY_CHUNK_BYTES + 10));
    const openFs: FsPortFactory = (r, cwd, options) => {
      const port = createNodeFsPort(r, cwd, options);
      return {
        ...port,
        openRead: (path) => {
          const stream = port.openRead(path);
          let reads = 0;
          return {
            read: (length) => {
              if (++reads === 2) throw new FsReadFailure("planted", { code: "path_unreadable", fs: { errno: "EIO", syscall: "read" } });
              return stream.read(length);
            },
            close: () => stream.close(),
          };
        },
      };
    };
    const options = runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"], evidencePaths: ["inputs/evidence.bin"] });
    // The separator is `/` on POSIX; Windows prints the native `\\`.
    const separator = process.platform === "win32" ? "\\\\" : "/";
    assert.throws(
      () => recordDiscoveryRun({ cwd: process.cwd(), openFs }, options),
      (error: unknown) => error instanceof GoError && new RegExp(`^read .*inputs${separator}evidence\\.bin: ${EIO_PATTERN}$`).test(error.message),
    );
    assert.deepEqual(readdirSync(join(root, "system/workspace/runs")), []);
    // The cleanup left nothing behind: a retry with a working read records the run and the full copy.
    const retry = recordDiscoveryRun(context(), options);
    assert.equal(retry.runId, "RUN-001");
    const copied = readdirSync(join(root, "system/workspace/runs/RUN-001/evidence"));
    assert.equal(copied.length, 1);
    assert.equal(readFileSync(join(root, "system/workspace/runs/RUN-001/evidence", copied[0]!), "utf8"), "x".repeat(COPY_CHUNK_BYTES + 10));
  });

  // P4-P5 merge fix round, finding 1: a record file that another process put
  // in the reserved folder is never removed. Only a file this command
  // created is listed for the cleanup.
  for (const [label, record] of [["run.md", "run"], ["raw-findings.md", "run"], ["finding.md", "finding"], ["qualification.md", "finding"]] as const) {
    it(`never removes a ${label} that another process made in the reserved folder (EEXIST)`, () => {
      const root = tempRoot();
      writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
      writeTextFile(root, "inputs/raw.md", "raw");
      writeTextFile(root, "inputs/evidence.txt", "evidence");
      writeTextFile(root, "tests/confirm.spec.ts", "test");
      writeTextFile(root, "evidence/run.txt", "evidence");
      if (record === "finding") recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] }));
      const indexRel = record === "run" ? "system/.os/data/runs.jsonl" : "system/.os/data/findings.jsonl";
      const index = existsSync(join(root, indexRel)) ? readFileSync(join(root, indexRel)) : undefined;
      const removed: string[] = [];
      let other = "";
      const openFs = plantedFs({
        writeNewFile: (path) => {
          if (path.endsWith(`/${label}`)) {
            other = join(root, path);
            writeFileSync(other, "the other process\n");
          }
        },
        remove: (path) => removed.push(path),
      });
      const fail = (error: unknown) => error instanceof GoError && error.message.startsWith("open ") && error.message.includes(label);
      if (record === "run") {
        assert.throws(() => recordDiscoveryRun({ cwd: process.cwd(), openFs }, runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"], evidencePaths: ["inputs/evidence.txt"] })), fail);
      } else {
        const qualify = qualifyOptions(root, { runId: "RUN-001", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/run.txt" });
        assert.throws(() => qualifyFinding({ cwd: process.cwd(), openFs }, qualify), fail);
      }
      assert.notEqual(other, "", "the planted file was made");
      assert.deepEqual(removed.filter((path) => path.endsWith(label)), [], "the cleanup never asks to remove the other process's file");
      assert.equal(readFileSync(other, "utf8"), "the other process\n");
      // Everything this command made is gone; the folder stays only because it holds the other file.
      assert.deepEqual(readdirSync(dirname(other)), [label]);
      assert.deepEqual(existsSync(join(root, indexRel)) ? readFileSync(join(root, indexRel)) : undefined, index);
    });
  }

  // P4-P5 merge fix round, finding 2: an EIO when the copied evidence file is
  // closed removes the partial copy and the run folder, so a retry works.
  it("an EIO on the close of a copied evidence file removes the copy and the run folder, and a retry succeeds", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    writeTextFile(root, "inputs/raw-1.md", "evidence body");
    type Open = (path: fs.PathLike, flags?: fs.OpenMode, mode?: fs.Mode | null) => number;
    const nodeFs = fs as unknown as { openSync: Open; closeSync: (fd: number) => void };
    const originalOpen = nodeFs.openSync;
    const originalClose = nodeFs.closeSync;
    let target: number | undefined;
    let planted = false;
    nodeFs.openSync = (path, flags, mode) => {
      const fd = originalOpen(path, flags, mode);
      if (!planted && String(path).endsWith(join("evidence", "001-raw-1.md"))) target = fd;
      return fd;
    };
    nodeFs.closeSync = (fd) => {
      originalClose(fd);
      if (!planted && fd === target) {
        // The descriptor is released, as POSIX close does even when it reports EIO.
        planted = true;
        throw Object.assign(new Error("EIO: i/o error, close"), { code: "EIO", syscall: "close" });
      }
    };
    syncBuiltinESMExports();
    const options = runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"], evidencePaths: ["inputs/raw-1.md"] });
    try {
      assert.throws(
        () => recordDiscoveryRun(context(), options),
        (error: unknown) => error instanceof GoError && error.message.startsWith("close ") && error.message.endsWith(`001-raw-1.md: ${EIO_TEXT}`),
      );
    } finally {
      nodeFs.openSync = originalOpen;
      nodeFs.closeSync = originalClose;
      syncBuiltinESMExports();
    }
    assert.ok(planted, "the planted close failure ran");
    assert.deepEqual(readdirSync(join(root, "system/workspace/runs")), []);
    const retry = recordDiscoveryRun(context(), options);
    assert.equal(retry.runId, "RUN-001");
    assert.equal(readFileSync(join(root, "system/workspace/runs/RUN-001/evidence/001-raw-1.md"), "utf8"), "evidence body");
  });
});

describe("A33: discovery resolves entities in this process", () => {
  it("records a run and qualifies a finding through a redirect while every child_process entry point throws", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw finding text");
    writeTextFile(root, "tests/confirm.spec.ts", "test('confirm', async () => {})");
    writeTextFile(root, "evidence/confirmation.txt", "passed");
    const names = ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"] as const;
    const target = childProcess as unknown as Record<string, unknown>;
    const saved = new Map(names.map((name) => [name, target[name]]));
    let calls = 0;
    for (const name of names) {
      target[name] = () => {
        calls++;
        throw new Error(`child_process.${name} called`);
      };
    }
    syncBuiltinESMExports();
    try {
      recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] }));
      const result = qualifyFinding(
        context(),
        qualifyOptions(root, { runId: "RUN-001", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/confirmation.txt" }),
      );
      assert.equal(result.canonicalRunId, "RUN-001");
    } finally {
      for (const [name, value] of saved) target[name] = value;
      syncBuiltinESMExports();
    }
    assert.equal(calls, 0);
  });

  it("imports the P3 entity core and no process module from src/core/discovery/ or src/core/design/", () => {
    for (const file of ["src/core/discovery/discovery.ts", "src/core/design/promote.ts", "src/core/shared/go-files.ts"]) {
      const source = readFileSync(join(import.meta.dirname, "..", file), "utf8");
      assert.ok(!/child_process|worker_threads|from "node:/.test(source), `${file} loads a Node module`);
    }
    const files = readFileSync(join(import.meta.dirname, "..", "src/core/shared/go-files.ts"), "utf8");
    assert.ok(files.includes('from "../entities/graph.ts"') && files.includes('from "../entities/validate.ts"'));
  });
});

describe("index writes and resolution races (P5 review round 2)", () => {
  type WriteBytes = (fd: number, buffer: Uint8Array, offset: number, length: number) => number;
  const nodeFs = fs as unknown as { writeSync: WriteBytes; realpathSync: { native: (path: string) => string } };

  it("a short write and EIO on the index leave the old index bytes, the cleanup removes the run, and a retry succeeds", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "system/.os/data/runs.jsonl", "");
    writeTextFile(root, "inputs/raw.md", "raw");
    const indexPath = join(root, "system/.os/data/runs.jsonl");
    const before = readFileSync(indexPath);
    const original = nodeFs.writeSync;
    let planted = false;
    nodeFs.writeSync = (fd, buffer, offset, length) => {
      if (!planted && Buffer.from(buffer).includes('"type":"run"')) {
        planted = true;
        original(fd, buffer, offset, Math.floor(length / 2));
        throw Object.assign(new Error("EIO: i/o error, write"), { code: "EIO", syscall: "write" });
      }
      return original(fd, buffer, offset, length);
    };
    syncBuiltinESMExports();
    const options = runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] });
    try {
      assert.throws(
        () => recordDiscoveryRun(context(), options),
        (error: unknown) => error instanceof GoError && new RegExp(`^write .*runs\\.jsonl: ${EIO_PATTERN}$`).test(error.message),
      );
    } finally {
      nodeFs.writeSync = original;
      syncBuiltinESMExports();
    }
    assert.ok(planted, "the planted short write ran");
    assert.deepEqual(readFileSync(indexPath), before, "the old index bytes");
    assert.deepEqual(readdirSync(join(root, "system/.os/data")).filter((name) => name.includes(".tmp")), [], "no temporary file");
    assert.deepEqual(readdirSync(join(root, "system/workspace/runs")), []);
    assert.equal(recordDiscoveryRun(context(), options).runId, "RUN-001");
    assert.equal(readSingleJsonlRow(root, "system/.os/data/runs.jsonl")["id"], "RUN-001");
  });

  it("adds Go's bytes (the index as it is plus one line) and keeps the index mode", { skip: process.platform === "win32" ? "no POSIX permission bits" : false }, () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    const existing = '{"id":"RUN-007","type":"run","status":"closed"}\n';
    writeTextFile(root, "system/.os/data/runs.jsonl", existing);
    chmodSync(join(root, "system/.os/data/runs.jsonl"), 0o640);
    recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" }));
    const text = readTextFile(root, "system/.os/data/runs.jsonl");
    assert.ok(text.startsWith(existing) && text.endsWith("\n") && text.slice(existing.length).split("\n").length === 2, "one line added after the old bytes");
    assert.equal(JSON.parse(text.slice(existing.length))["id"], "RUN-008");
    assert.equal(statSync(join(root, "system/.os/data/runs.jsonl")).mode & 0o777, 0o640);
  });

  it("keeps the index's special bits as Go's append in place does (W1 R7 P5 fix)", { skip: process.platform === "win32" ? "no POSIX permission bits" : false }, () => {
    // Go's append keeps the file: the sticky bit stays, and the OS clears
    // setuid and setgid on the write (macOS always; Linux setgid only with
    // group execute). The port's replace gets the full mode and then writes,
    // so the same OS rule applies. The expected mode is what an append in
    // place does to a probe file with the same mode, in the same folder.
    for (const mode of [0o1640, 0o1604, 0o2640, 0o2670, 0o4640, 0o6754]) {
      const root = tempRoot();
      writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
      const index = join(root, "system/.os/data/runs.jsonl");
      writeTextFile(root, "system/.os/data/runs.jsonl", '{"id":"RUN-007","type":"run","status":"closed"}\n');
      const probe = join(root, "system/.os/data/probe");
      writeFileSync(probe, "x\n");
      try {
        chmodSync(index, mode);
        chmodSync(probe, mode);
      } catch {
        continue;
      }
      const set = statSync(index).mode & 0o7777;
      fs.appendFileSync(probe, "y\n");
      const expected = statSync(probe).mode & 0o7777;
      rmSync(probe);
      recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive" }));
      assert.equal((statSync(index).mode & 0o7777).toString(8), expected.toString(8), `index at ${mode.toString(8)} (set ${set.toString(8)})`);
      if ((set & 0o1000) !== 0) assert.equal(statSync(index).mode & 0o1000, 0o1000, "the sticky bit stays");
    }
  });

  it("replaces, never follows, a symlink at runs.jsonl, also with allowOutsideRoot (PE-012)", { skip: process.platform === "win32" ? "POSIX symlinks" : false }, () => {
    for (const allowOutsideRoot of [false, true]) {
      const work = tempRoot();
      const root = join(work, "root");
      writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
      const outside = join(work, "outside-runs.jsonl");
      const outsideBytes = '{"id":"RUN-001","type":"run","status":"closed"}\n';
      writeFileSync(outside, outsideBytes);
      chmodSync(outside, 0o640);
      rmSync(join(root, "system/.os/data/runs.jsonl"));
      symlinkSync(outside, join(root, "system/.os/data/runs.jsonl"));
      const result = recordDiscoveryRun({ ...context(), allowOutsideRoot }, runOptions(root, { playbookId: "PB-010", outcome: "positive" }));
      assert.equal(result.runId, "RUN-002");
      assert.equal(readFileSync(outside, "utf8"), outsideBytes, "the outside file is kept");
      const index = join(root, "system/.os/data/runs.jsonl");
      assert.ok(lstatSync(index).isFile(), "the link is replaced by a file");
      assert.ok(readFileSync(index, "utf8").startsWith(outsideBytes));
      assert.equal(lstatSync(index).mode & 0o777, 0o640);
    }
  });

  it("a qualify finding that loses a race for a new folder fails with Go's already exists, not a refusal", () => {
    const root = tempRoot();
    writePlaybookIndex(root, activeDiscoveryPlaybookFixture("PB-010"), true);
    writeTextFile(root, "inputs/raw.md", "raw");
    recordDiscoveryRun(context(), runOptions(root, { playbookId: "PB-010", outcome: "positive", rawFindingPaths: ["inputs/raw.md"] }));
    writeTextFile(root, "tests/confirm.spec.ts", "test");
    writeTextFile(root, "evidence/run.txt", "evidence");
    const findings = join(root, "system/workspace/findings");
    const original = nodeFs.realpathSync.native;
    let planted = false;
    // The other command creates findings/FIND-001 while this one resolves the path.
    nodeFs.realpathSync.native = (path: string) => {
      if (!planted && path.endsWith(join("system", "workspace", "findings")) && !existsSync(findings)) {
        planted = true;
        mkdirSync(join(findings, "FIND-001"), { recursive: true });
        throw Object.assign(new Error(`ENOENT: no such file or directory, realpath '${path}'`), { code: "ENOENT", syscall: "realpath" });
      }
      return original(path);
    };
    try {
      assert.throws(
        () => qualifyFinding(context(), qualifyOptions(root, { runId: "RUN-001", rawFindingRef: "#raw-finding-1", outcome: "positive", confirmationTest: "tests/confirm.spec.ts", confirmationEvidence: "evidence/run.txt" })),
        (error: unknown) => error instanceof GoError && error.message === "finding artifact system/workspace/findings/FIND-001/ already exists",
      );
    } finally {
      nodeFs.realpathSync.native = original;
    }
    assert.ok(planted, "the planted race ran");
    assert.deepEqual(readdirSync(join(findings, "FIND-001")), []);
  });
});
