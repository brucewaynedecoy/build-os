// Ported Go tests for design promotion (W1 R7 P5 t7):
// toolkits/buildos-design/internal/design/promotion_test.go and
// toolkits/buildos-design/cmd/buildos-design/main_test.go, by Go test name.
// Also: A35 (a dry run writes nothing and reports `planned` in JSON mode),
// A36 (a promotion adds exactly one file under docs/ and changes nothing
// else under docs/ or .make-docs/), and t11 (the atomic replaces work on
// Windows: a promotion exits 0 and leaves no half-applied state).
//
// Go paths in this comment name the Go sources at the frozen baseline
// commit 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).

import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { after, describe, it } from "node:test";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import { createDesignDomain, DESIGN_USAGE } from "../src/cli/commands/design.ts";
import { BUILTIN_DOMAINS, run } from "../src/cli/run.ts";
import { promoteFinding, type DesignContext, type PromoteFindingOptions } from "../src/core/design/promote.ts";
import { PathRefusedError } from "../src/core/shared/errors.ts";
import { GoError, GoFiles } from "../src/core/shared/go-files.ts";
import { goLocalDate } from "../src/core/shared/go-text.ts";
import { loadExceptions } from "./golden/harness.ts";
import { assertSameTree, captureIo } from "./helpers.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "buildos-design-"));
  roots.push(root);
  return root;
}

const context = (extra: Partial<DesignContext> = {}): DesignContext => ({ cwd: process.cwd(), openFs: createNodeFsPort, ...extra });

interface Row {
  id: string;
  type?: string;
  path?: string;
  title?: string;
  status?: string;
  summary?: string;
  observed?: string;
  outcome?: string;
  polarity?: string;
  run_id?: string;
  origin_run?: string;
  raw_anchor?: string;
  qualification_test?: string;
  systems?: string[];
  environments?: string[];
  owners?: string[];
  qualified_at?: string;
  designs?: string[];
  related?: string[];
  created_at?: string;
  updated_at?: string;
  redirect?: Record<string, unknown>;
}

/** Go `json.Marshal(findingIndexRow)`: every typed field in struct order, nil slices as null, `negative_assertion` and `redirect` omitted when empty. */
function marshalRow(row: Row): string {
  const s = (v: string | undefined) => v ?? "";
  const l = (v: string[] | undefined) => v ?? null;
  const out: Record<string, unknown> = {
    id: row.id, type: s(row.type), path: s(row.path), title: s(row.title), status: s(row.status), summary: s(row.summary), observed: s(row.observed),
    basis_refs: null, confidence: "", implications: null, outcome: s(row.outcome), polarity: s(row.polarity), run_id: s(row.run_id), origin_run: s(row.origin_run),
    raw_anchor: s(row.raw_anchor), qualification_test: s(row.qualification_test), confirmation_test: "", confirmation_evidence: "",
    systems: l(row.systems), environments: l(row.environments), owners: l(row.owners), qualified_at: s(row.qualified_at), designs: l(row.designs),
    source_anchor: "", doc_anchor: "", source_refs: null, related: l(row.related), created_at: s(row.created_at), updated_at: s(row.updated_at),
  };
  if (row.redirect !== undefined) out["redirect"] = row.redirect;
  return JSON.stringify(out);
}

function writeTextFile(root: string, rel: string, body: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

const readTextFile = (root: string, rel: string) => readFileSync(join(root, rel), "utf8");

function writeRouterInputs(root: string, prefix = "system/"): void {
  writeTextFile(root, `${prefix}docs/designs/AGENTS.md`, "# Designs Router\n");
  writeTextFile(root, `${prefix}docs/assets/references/design-workflow.md`, "# Design Workflow\n");
  writeTextFile(root, `${prefix}docs/assets/references/design-contract.md`, "# Design Contract\n");
  writeTextFile(root, `${prefix}docs/assets/templates/design.md`, "# {{TITLE}}\n");
  writeTextFile(root, `${prefix}docs/assets/prompts/designs-to-plan.prompt.md`, "# Prompt\n");
  writeTextFile(root, `${prefix}docs/assets/prompts/designs-to-plan-change.prompt.md`, "# Prompt\n");
}

function writeEmptyGovernedDatasets(root: string, dataDir: string): void {
  for (const name of ["requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "extractions.jsonl"]) writeTextFile(root, `${dataDir}/${name}`, "");
}

function writeQualifiedFindingFixture(root: string, input: Row): void {
  writeRouterInputs(root);
  const row: Row = { ...input, type: input.type ?? "finding", title: input.title ?? `Qualified finding ${input.id}`, path: input.path ?? `system/workspace/findings/${input.id}/` };
  writeTextFile(root, "system/.os/data/findings.jsonl", `${marshalRow(row)}\n`);
  writeEmptyGovernedDatasets(root, "system/.os/data");
  writeTextFile(root, `${row.path}finding.md`, `# ${row.title}\n\n## Finding ${row.id} {#finding-${row.id.toLowerCase()}}\n\n- Status: ${row.status ?? ""}\n\n## Observation\n\nObserved.\n\n## Designs\n\nNo design hand-off recorded.\n`);
  writeTextFile(root, `${row.path}qualification.md`, "# Qualification\n\n## Confirmation Test {#confirmation-test}\n\n- Result: pass\n");
  writeTextFile(root, "system/workspace/runs/RUN-001/raw-findings.md", "# Raw Findings\n\n## Raw Finding 1 {#raw-finding-1}\n\nRaw.\n");
}

const timeStampedDesignPath = (slug: string) => `system/docs/designs/${goLocalDate(new Date())}-${slug}.md`;

const options = (root: string, extra: Partial<PromoteFindingOptions>): PromoteFindingOptions => ({ repoRoot: root, findingId: "", route: "", title: "", slug: "", dryRun: false, ...extra });

function goError(action: () => unknown, includes: string): void {
  assert.throws(action, (error: unknown) => error instanceof GoError && error.message.includes(includes), `expected an error with ${JSON.stringify(includes)}`);
}

function readSingleFindingRow(root: string, rel = "system/.os/data/findings.jsonl"): Record<string, unknown> {
  const lines = readTextFile(root, rel).trim().split("\n");
  assert.equal(lines.length, 1);
  return JSON.parse(lines[0]!) as Record<string, unknown>;
}

describe("design promotion (Go internal/design tests)", () => {
  it("TestPromoteFindingResolvesCanonicalFindingAndPreservesHistoricalRecord", () => {
    const root = tempRoot();
    writeRouterInputs(root);
    writeEmptyGovernedDatasets(root, "system/.os/data");
    const loser: Row = {
      id: "FIND-001", type: "finding", path: "system/workspace/findings/FIND-001/", title: "Historical finding", status: "superseded",
      designs: ["system/docs/designs/2026-07-01-historical.md"], related: ["RUN-OLD"],
      redirect: { target_id: "FIND-002", kind: "duplicate", decided_at: "2026-07-20T10:00:00Z", decided_by: "reviewer", reason: "same finding", evidence_refs: ["review.md"] },
    };
    const canonical: Row = {
      id: "FIND-002", type: "finding", path: "system/workspace/findings/FIND-002/", title: "Canonical qualified finding", status: "qualified",
      summary: "Canonical summary", observed: "Canonical observation", outcome: "positive", polarity: "positive", run_id: "RUN-002", origin_run: "RUN-002",
      raw_anchor: "system/workspace/runs/RUN-002/raw-findings.md#raw-finding-1", qualification_test: "system/workspace/findings/FIND-002/qualification.md#confirmation-test",
      designs: [], related: ["RUN-002"],
    };
    // Go adds x_type_specific through a map, so the keys come out sorted.
    const withExtra = (row: Row) => {
      const object = JSON.parse(marshalRow(row)) as Record<string, unknown>;
      object["x_type_specific"] = { owner: "preserve-me" };
      return JSON.stringify(Object.fromEntries(Object.keys(object).sort().map((k) => [k, object[k]])));
    };
    const originalLoserLine = withExtra(loser);
    writeTextFile(root, "system/.os/data/findings.jsonl", `${originalLoserLine}\n${withExtra(canonical)}\n`);
    const historicalRecord = "# Historical finding\n\n## Designs\n\n- [Historical](../../../docs/designs/2026-07-01-historical.md)\n";
    writeTextFile(root, "system/workspace/findings/FIND-001/finding.md", historicalRecord);
    writeTextFile(root, "system/workspace/findings/FIND-002/finding.md", "# Canonical qualified finding\n\n## Designs\n\nNo design hand-off recorded.\n");
    writeTextFile(root, "system/workspace/findings/FIND-002/qualification.md", "# Qualification\n\n## Confirmation Test {#confirmation-test}\n");
    writeTextFile(root, "system/workspace/runs/RUN-002/raw-findings.md", "## Raw Finding 1 {#raw-finding-1}\n");

    const result = promoteFinding(context(), options(root, { findingId: "FIND-001", route: "change-plan", slug: "canonical-finding" }));
    assert.deepEqual([result.requestedFindingId, result.canonicalFindingId, result.findingId], ["FIND-001", "FIND-002", "FIND-002"]);
    assert.deepEqual(result.redirectChain, ["FIND-001", "FIND-002"]);
    assert.equal(readTextFile(root, "system/workspace/findings/FIND-001/finding.md"), historicalRecord);
    const lines = readTextFile(root, "system/.os/data/findings.jsonl").replace(/\n$/, "").split("\n");
    assert.equal(lines[0], originalLoserLine);
    const rows = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(rows[0]!["designs"], loser.designs);
    assert.deepEqual(rows[1]!["designs"], [result.designPath]);
    assert.ok(rows[0]!["x_type_specific"] !== undefined && rows[1]!["x_type_specific"] !== undefined, "unknown fields were not preserved");
    const design = readTextFile(root, result.designPath);
    assert.ok(design.includes("FIND-002") && !design.includes("FIND-001"));
  });

  it("TestPromoteFindingCreatesDesignAndUpdatesFinding", () => {
    const root = tempRoot();
    writeQualifiedFindingFixture(root, {
      id: "FIND-001", type: "finding", path: "system/workspace/findings/FIND-001/", title: "Qualified finding FIND-001", status: "qualified",
      summary: "Finding qualified from run RUN-001.", observed: "Raw finding was confirmed.", outcome: "positive", polarity: "positive", run_id: "RUN-001", origin_run: "RUN-001",
      raw_anchor: "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1", qualification_test: "system/workspace/findings/FIND-001/qualification.md#confirmation-test",
      systems: ["primary-system"], environments: ["baseline"], owners: ["adopter-team"], qualified_at: "2026-06-05T00:00:00Z", designs: [], related: ["RUN-001"],
      created_at: "2026-06-05T00:00:00Z", updated_at: "2026-06-05T00:00:00Z",
    });
    const result = promoteFinding(context(), options(root, { findingId: "FIND-001", route: "change-plan", title: "Resolve Qualified Finding", slug: "resolve-qualified-finding" }));
    assert.equal(result.findingId, "FIND-001");
    assert.ok(result.designPath.includes("resolve-qualified-finding.md"));
    const design = readTextFile(root, result.designPath);
    for (const want of [
      "# Resolve Qualified Finding", "## Purpose", "## Context", "## Decision", "## Alternatives Considered", "## Consequences", "## Intended Follow-On",
      "- Route: `change-plan`", "../assets/prompts/designs-to-plan-change.prompt.md", "primary-system", "baseline", "adopter-team",
      "../../workspace/findings/FIND-001/qualification.md#confirmation-test",
    ]) {
      assert.ok(design.includes(want), want);
    }
    assert.equal(result.designContent, design);
    assert.deepEqual(readSingleFindingRow(root)["designs"], [result.designPath]);
    const record = readTextFile(root, "system/workspace/findings/FIND-001/finding.md");
    assert.ok(!record.includes("No design hand-off recorded") && record.includes("../../../docs/designs/"));
  });

  it("TestPromoteFindingSupportsInstalledRootLayout", () => {
    const root = tempRoot();
    for (const rel of [".os", "assets", "docs", "playbooks", "workspace"]) mkdirSync(join(root, rel), { recursive: true });
    writeRouterInputs(root, "");
    const row: Row = {
      id: "FIND-001", type: "finding", path: "system/workspace/findings/FIND-001/", title: "Installed qualified finding", status: "qualified",
      summary: "Finding qualified from installed root run RUN-001.", observed: "Raw finding was confirmed in the installed workspace.", outcome: "positive", polarity: "positive",
      run_id: "RUN-001", origin_run: "RUN-001", raw_anchor: "system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1",
      qualification_test: "system/workspace/findings/FIND-001/qualification.md#confirmation-test", systems: ["primary-system"], environments: ["baseline"], owners: ["adopter-team"],
      qualified_at: "2026-06-05T00:00:00Z", designs: [], related: ["RUN-001"], created_at: "2026-06-05T00:00:00Z", updated_at: "2026-06-05T00:00:00Z",
    };
    writeTextFile(root, ".os/data/findings.jsonl", `${marshalRow(row)}\n`);
    writeEmptyGovernedDatasets(root, ".os/data");
    writeTextFile(root, "workspace/findings/FIND-001/finding.md", `# ${row.title}\n\n## Finding FIND-001 {#finding-find-001}\n\n- Status: qualified\n\n## Observation\n\nObserved.\n\n## Designs\n\nNo design hand-off recorded.\n`);
    writeTextFile(root, "workspace/findings/FIND-001/qualification.md", "# Qualification\n\n## Confirmation Test {#confirmation-test}\n\n- Result: pass\n");
    writeTextFile(root, "workspace/runs/RUN-001/raw-findings.md", "# Raw Findings\n\n## Raw Finding 1 {#raw-finding-1}\n\nRaw.\n");
    const result = promoteFinding(context(), options(root, { findingId: "FIND-001", route: "change-plan", title: "Installed Design Hand Off", slug: "installed-design-hand-off" }));
    assert.ok(result.designPath.startsWith("docs/designs/"));
    assert.equal(result.findingsIndexPath, ".os/data/findings.jsonl");
    assert.ok(existsSync(join(root, result.designPath)));
    assert.ok(!existsSync(join(root, `system/${result.designPath}`)));
    const design = readTextFile(root, result.designPath);
    for (const want of [
      "# Installed Design Hand Off", "- Route: `change-plan`", "../assets/prompts/designs-to-plan-change.prompt.md",
      "../../workspace/findings/FIND-001/qualification.md#confirmation-test", "../../workspace/runs/RUN-001/raw-findings.md#raw-finding-1", "primary-system", "baseline", "adopter-team",
    ]) {
      assert.ok(design.includes(want), want);
    }
    const updated = readSingleFindingRow(root, ".os/data/findings.jsonl");
    assert.deepEqual(updated["designs"], [result.designPath]);
    for (const key of ["path", "raw_anchor", "qualification_test"]) assert.ok(!(updated[key] as string).startsWith("system/"), key);
    const record = readTextFile(root, "workspace/findings/FIND-001/finding.md");
    assert.ok(!record.includes("No design hand-off recorded") && record.includes("../../../docs/designs/"));
  });

  const qualified = (extra: Partial<Row> = {}): Row => ({ id: "FIND-001", path: "system/workspace/findings/FIND-001/", status: "qualified", qualification_test: "system/workspace/findings/FIND-001/qualification.md#confirmation-test", ...extra });
  for (const tt of [
    { name: "unknown finding", row: undefined, opts: { findingId: "FIND-999", route: "baseline-plan", slug: "valid-slug" }, want: "does not exist" },
    { name: "not qualified", row: qualified({ status: "draft" }), opts: { findingId: "FIND-001", route: "baseline-plan", slug: "valid-slug" }, want: "redirect_inactive_terminal" },
    { name: "missing qualification anchor", row: qualified({ qualification_test: "system/workspace/findings/FIND-001/qualification.md" }), opts: { findingId: "FIND-001", route: "baseline-plan", slug: "valid-slug" }, want: "missing a qualification anchor" },
    { name: "unknown qualification anchor", row: qualified({ qualification_test: "system/workspace/findings/FIND-001/qualification.md#missing" }), opts: { findingId: "FIND-001", route: "baseline-plan", slug: "valid-slug" }, want: "not found" },
    { name: "invalid route", row: qualified(), opts: { findingId: "FIND-001", route: "maybe", slug: "valid-slug" }, want: "requires --route" },
    { name: "missing route", row: undefined, opts: { findingId: "FIND-001", slug: "valid-slug" }, want: "requires --route" },
    { name: "invalid slug", row: qualified(), opts: { findingId: "FIND-001", route: "baseline-plan", slug: "Bad Slug" }, want: "must use lowercase" },
  ]) {
    it(`TestPromoteFindingRejectsInvalidInputs/${tt.name}`, () => {
      const root = tempRoot();
      if (tt.row !== undefined) {
        writeQualifiedFindingFixture(root, tt.row);
      } else {
        writeRouterInputs(root);
        writeTextFile(root, "system/.os/data/findings.jsonl", "");
        writeEmptyGovernedDatasets(root, "system/.os/data");
      }
      goError(() => promoteFinding(context(), options(root, tt.opts)), tt.want);
    });
  }

  it("TestPromoteFindingFailsClosedOnInvalidRedirectGraph", () => {
    const root = tempRoot();
    writeRouterInputs(root);
    writeEmptyGovernedDatasets(root, "system/.os/data");
    const row: Row = {
      id: "FIND-001", type: "finding", path: "system/workspace/findings/FIND-001/", status: "superseded",
      redirect: { target_id: "FIND-999", kind: "duplicate", decided_at: "2026-07-20T10:00:00Z", decided_by: "reviewer", reason: "invalid fixture", evidence_refs: [] },
    };
    writeTextFile(root, "system/.os/data/findings.jsonl", `${marshalRow(row)}\n`);
    const before = readTextFile(root, "system/.os/data/findings.jsonl");
    goError(() => promoteFinding(context(), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "must-not-exist" })), "redirect_missing_target");
    assert.equal(readTextFile(root, "system/.os/data/findings.jsonl"), before);
    assert.ok(!existsSync(join(root, timeStampedDesignPath("must-not-exist"))));
  });

  it("TestPromoteFindingRejectsDuplicateDesignTarget", () => {
    const root = tempRoot();
    writeQualifiedFindingFixture(root, qualified());
    const result = promoteFinding(context(), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "duplicate-target" }));
    assert.throws(
      () => promoteFinding(context(), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "duplicate-target" })),
      (error: unknown) => error instanceof GoError && error.message.includes("already exists") && error.message.includes(result.designPath),
    );
  });

  it("TestPromoteFindingRejectsReferencedDesignTarget", () => {
    const root = tempRoot();
    writeQualifiedFindingFixture(root, qualified({ designs: [timeStampedDesignPath("referenced-target")] }));
    goError(() => promoteFinding(context(), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "referenced-target" })), "already referenced");
  });

  it("TestPromoteFindingDryRunDoesNotWrite", () => {
    const root = tempRoot();
    writeQualifiedFindingFixture(root, qualified());
    const beforeIndex = readTextFile(root, "system/.os/data/findings.jsonl");
    const beforeRecord = readTextFile(root, "system/workspace/findings/FIND-001/finding.md");
    const result = promoteFinding(context(), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "dry-run-design", dryRun: true }));
    assert.ok(result.dryRun && result.designPath.includes("dry-run-design.md") && result.designContent.includes("## Intended Follow-On"));
    assert.ok(!existsSync(join(root, result.designPath)));
    assert.equal(readTextFile(root, "system/.os/data/findings.jsonl"), beforeIndex);
    assert.equal(readTextFile(root, "system/workspace/findings/FIND-001/finding.md"), beforeRecord);
  });

  it("TestAtomicReplaceFileLeavesOriginalAndCleansTempOnRenameFailure", () => {
    // Go injects a rename failure. Here the rename fails for real: the
    // target is a folder with content, which a file cannot replace.
    const root = tempRoot();
    writeTextFile(root, "findings.jsonl/keep.txt", "original\n");
    const files = new GoFiles(context(), root);
    goError(() => files.atomicReplace(join(root, "findings.jsonl"), new TextEncoder().encode("replacement\n")), `rename ${join(root, ".findings.jsonl.tmp-")}`);
    assert.equal(readTextFile(root, "findings.jsonl/keep.txt"), "original\n");
    assert.deepEqual(readdirSync(root).filter((name) => name.startsWith(".findings.jsonl.tmp-")), [], "temporary files remain");
  });

  it("TestPromoteFindingRollsBackIndexWhenFindingRecordReplacementFails", () => {
    const root = tempRoot();
    writeQualifiedFindingFixture(root, qualified());
    const indexPath = "system/.os/data/findings.jsonl";
    const recordPath = "system/workspace/findings/FIND-001/finding.md";
    const beforeIndex = readTextFile(root, indexPath);
    const beforeRecord = readTextFile(root, recordPath);
    let failed = false;
    goError(
      () =>
        promoteFinding(
          context({
            hooks: {
              replaceExistingFile: (files, path, data) => {
                if (!failed && /[\\/]finding\.md$/.test(path)) {
                  failed = true;
                  throw new GoError("injected finding record failure");
                }
                files.atomicReplace(path, data);
              },
            },
          }),
          options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "record-failure" }),
        ),
      "injected finding record failure",
    );
    assert.equal(readTextFile(root, indexPath), beforeIndex);
    assert.equal(readTextFile(root, recordPath), beforeRecord);
    assert.ok(!existsSync(join(root, timeStampedDesignPath("record-failure"))));
  });

  it("TestPromoteFindingRollsBackExistingFilesWhenDesignCreationFails", () => {
    const root = tempRoot();
    writeQualifiedFindingFixture(root, qualified());
    const indexPath = "system/.os/data/findings.jsonl";
    const recordPath = "system/workspace/findings/FIND-001/finding.md";
    const beforeIndex = readTextFile(root, indexPath);
    const beforeRecord = readTextFile(root, recordPath);
    goError(
      () =>
        promoteFinding(
          context({
            hooks: {
              createExclusiveFile: () => {
                throw new GoError("injected design creation failure");
              },
            },
          }),
          options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "design-failure" }),
        ),
      "injected design creation failure",
    );
    assert.equal(readTextFile(root, indexPath), beforeIndex);
    assert.equal(readTextFile(root, recordPath), beforeRecord);
    assert.ok(!existsSync(join(root, timeStampedDesignPath("design-failure"))));
  });
});

describe("refusals roll back like Go errors (P5 review round 1)", () => {
  const cases: [string, () => DesignContext["hooks"]][] = [
    [
      "a refusal of the finding record after the index was replaced",
      () => {
        let refused = false;
        return {
          replaceExistingFile: (files, path, data) => {
            if (!refused && /[\\/]finding\.md$/.test(path)) {
              refused = true;
              throw new PathRefusedError("outside-root", "planted record refusal");
            }
            files.atomicReplace(path, data);
          },
        };
      },
    ],
    [
      "a refusal of the design file after both replacements",
      () => ({
        createExclusiveFile: () => {
          throw new PathRefusedError("outside-root", "planted design refusal");
        },
      }),
    ],
  ];
  for (const [label, hooks] of cases) {
    it(`${label}: the refusal is thrown, and the index and the record are restored`, () => {
      const root = tempRoot();
      writeQualifiedFindingFixture(root, { id: "FIND-001", path: "system/workspace/findings/FIND-001/", status: "qualified", qualification_test: "system/workspace/findings/FIND-001/qualification.md#confirmation-test" });
      const indexPath = "system/.os/data/findings.jsonl";
      const recordPath = "system/workspace/findings/FIND-001/finding.md";
      const beforeIndex = readTextFile(root, indexPath);
      const beforeRecord = readTextFile(root, recordPath);
      assert.throws(() => promoteFinding(context({ hooks: hooks()! }), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "refused" })), PathRefusedError);
      assert.equal(readTextFile(root, indexPath), beforeIndex);
      assert.equal(readTextFile(root, recordPath), beforeRecord);
      assert.ok(!existsSync(join(root, timeStampedDesignPath("refused"))));
    });
  }
});

async function cli(args: string[], cwd = process.cwd()): Promise<{ code: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const code = await run(["design", ...args], io);
  return { code, stdout: io.stdout(), stderr: io.stderr() };
}

function writeCommandFixture(root: string): void {
  writeRouterInputs(root);
  writeQualifiedFindingFixture(root, {
    id: "FIND-001", path: "system/workspace/findings/FIND-001/", title: "Qualified finding FIND-001", status: "qualified", systems: ["primary-system"],
    qualification_test: "system/workspace/findings/FIND-001/qualification.md#confirmation-test", designs: [],
  });
}

describe("buildos design (Go cmd/buildos-design tests)", () => {
  it("TestUsageIncludesPromoteFindingCommand", () => {
    assert.ok(DESIGN_USAGE.includes("buildos-design promote finding"));
  });

  it("TestPromoteFindingCommandWritesDesignAndFindingBackRefs", async () => {
    const root = tempRoot();
    writeCommandFixture(root);
    const out = await cli(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan", "--title", "Payment Retry Repair", "--slug", "payment-retry-repair"]);
    assert.equal(out.code, 0, out.stderr);
    const designRelPath = timeStampedDesignPath("payment-retry-repair");
    assert.ok(out.stdout.includes(`wrote ${designRelPath} (requested=FIND-001 canonical=FIND-001 chain=[FIND-001])`), out.stdout);
    const design = readTextFile(root, designRelPath);
    for (const want of ["# Payment Retry Repair", "qualified finding `FIND-001`", "- Route: `baseline-plan`", "[designs-to-plan.prompt.md](../assets/prompts/designs-to-plan.prompt.md)", "- Systems: primary-system"]) {
      assert.ok(design.includes(want), want);
    }
    assert.ok(readTextFile(root, "system/.os/data/findings.jsonl").includes(designRelPath));
    assert.ok(readTextFile(root, "system/workspace/findings/FIND-001/finding.md").includes(`../../../docs/designs/${designRelPath.split("/").pop()}`));
  });

  it("TestPromoteFindingCommandDryRunDoesNotWrite", async () => {
    const root = tempRoot();
    writeCommandFixture(root);
    const out = await cli(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "change-plan", "--title", "Payment Retry Change", "--slug", "payment-retry-change", "--dry-run"]);
    assert.equal(out.code, 0, out.stderr);
    const designRelPath = timeStampedDesignPath("payment-retry-change");
    assert.ok(out.stdout.includes(`would write ${designRelPath} (requested=FIND-001 canonical=FIND-001 chain=[FIND-001])`), out.stdout);
    assert.ok(!existsSync(join(root, designRelPath)));
    assert.ok(!readTextFile(root, "system/.os/data/findings.jsonl").includes(designRelPath));
    assert.ok(readTextFile(root, "system/workspace/findings/FIND-001/finding.md").includes("No design hand-off recorded."));
  });

  it("TestPromoteFindingCommandRequiresRouterInputs", async () => {
    // Go: exit 1, "read design router ...". With no Make Docs layout at all, BuildOS now stops with exit 3 and names
    // the missing input and the Make Docs setup command (parity exception PE-017, approved 2026-11-24; P7-R1-05).
    const root = tempRoot();
    writeCommandFixture(root);
    rmSync(join(root, "system/docs"), { recursive: true });
    const out = await cli(["promote", "finding", "--repo-root", root, "--finding-id", "FIND-001", "--route", "baseline-plan"]);
    assert.equal(out.code, 3);
    assert.ok(out.stderr.startsWith("buildos-design: error: the Make Docs design router system/docs/designs/AGENTS.md is missing, so BuildOS cannot write the design."), out.stderr);
    // With the legacy layout there, only the router missing: Go's text and exit 1.
    const legacy = tempRoot();
    writeCommandFixture(legacy);
    rmSync(join(legacy, "system/docs/designs/AGENTS.md"));
    const go = await cli(["promote", "finding", "--repo-root", legacy, "--finding-id", "FIND-001", "--route", "baseline-plan"]);
    assert.equal(go.code, 1);
    assert.ok(go.stderr.startsWith("buildos-design: error: read design router"), go.stderr);
  });
});

/** Every entry under `root`, with a digest of each file, keyed by its relative path with `/`. */
function tree(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const rel = relative(root, path).split(sep).join("/");
      if (lstatSync(path).isDirectory()) {
        out.set(`${rel}/`, "dir");
        walk(path);
      } else {
        out.set(rel, readFileSync(path, "base64"));
      }
    }
  };
  walk(root);
  return out;
}

function changes(before: Map<string, string>, afterTree: Map<string, string>): { added: string[]; changed: string[]; removed: string[] } {
  const added = [...afterTree.keys()].filter((k) => !before.has(k)).sort();
  const changed = [...afterTree.keys()].filter((k) => before.has(k) && before.get(k) !== afterTree.get(k)).sort();
  const removed = [...before.keys()].filter((k) => !afterTree.has(k)).sort();
  return { added, changed, removed };
}

const FIXTURE = join(import.meta.dirname, "fixtures", "golden", "design");

function fixtureCopy(): string {
  const root = tempRoot();
  cpSync(FIXTURE, root, { recursive: true });
  mkdirSync(join(root, ".make-docs"), { recursive: true });
  writeFileSync(join(root, ".make-docs", "index.json"), "{}\n");
  return root;
}

describe("design promotion boundary and JSON mode", () => {
  it("A35: a dry run writes nothing and reports write_status planned in JSON mode, with the target design path", async () => {
    const root = fixtureCopy();
    const before = tree(root);
    const out = await cli(["promote", "finding", "--finding-id", "FIND-001", "--route", "change-plan", "--dry-run", "--json"], root);
    assert.equal(out.code, 0, out.stdout);
    assert.equal(out.stderr, "");
    const envelope = JSON.parse(out.stdout) as { ok: boolean; command: string; write_status: string; root: string; result: { design_path: string; dry_run: boolean } };
    assert.deepEqual([envelope.ok, envelope.command, envelope.write_status, envelope.result.dry_run], [true, "design.promote", "planned", true]);
    assert.equal(envelope.result.design_path, timeStampedDesignPath("coupon-drops-tax-from-cart-total"));
    assert.deepEqual(changes(before, tree(root)), { added: [], changed: [], removed: [] });
    // Human form: the same target path, before anything is written.
    const human = await cli(["promote", "finding", "--finding-id", "FIND-001", "--route", "change-plan", "--dry-run"], root);
    assert.equal(human.stdout, `would write ${timeStampedDesignPath("coupon-drops-tax-from-cart-total")} (requested=FIND-001 canonical=FIND-001 chain=[FIND-001])\n`);
    assert.deepEqual(changes(before, tree(root)), { added: [], changed: [], removed: [] });
  });

  it("A35: a write reports applied, and a failure is an envelope with exit 1", async () => {
    const root = fixtureCopy();
    const applied = JSON.parse((await cli(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--json"], root)).stdout) as { write_status: string };
    assert.equal(applied.write_status, "applied");
    const failed = await cli(["promote", "finding", "--finding-id", "FIND-001", "--route", "fast-track", "--json"], root);
    assert.equal(failed.code, 1);
    const envelope = JSON.parse(failed.stdout) as { ok: boolean; diagnostics: { message: string }[] };
    assert.deepEqual([envelope.ok, envelope.diagnostics[0]!.message], [false, "promote finding requires --route baseline-plan or change-plan"]);
  });

  for (const [label, args] of [
    ["baseline", ["--finding-id", "FIND-001", "--route", "baseline-plan"]],
    ["redirected change", ["--finding-id", "FIND-002", "--route", "change-plan", "--title", "Keep tax with coupons", "--slug", "keep-tax"]],
  ] as const) {
    it(`A36 and R-009: a ${label} promotion adds exactly one file under docs/ and changes nothing else under docs/ or .make-docs/`, async () => {
      const root = fixtureCopy();
      const before = tree(root);
      const out = await cli(["promote", "finding", ...args], root);
      assert.equal(out.code, 0, out.stderr);
      const diff = changes(before, tree(root));
      const underDocs = (path: string) => path.startsWith("system/docs/") || path.startsWith(".make-docs/");
      assert.deepEqual(diff.added.filter(underDocs).filter((p) => !p.endsWith("/")), [diff.added.find((p) => p.startsWith("system/docs/designs/") && p.endsWith(".md"))]);
      assert.equal(diff.added.filter(underDocs).length, 1, "no new folder under docs/");
      assert.deepEqual(diff.changed.filter(underDocs), []);
      assert.deepEqual(diff.removed, []);
      assert.deepEqual(diff.changed, ["system/.os/data/findings.jsonl", "system/workspace/findings/FIND-001/finding.md"]);
    });
  }
});

describe("t11: atomic replaces leave no half-applied state", () => {
  function assertWhole(root: string, designRel: string): void {
    assert.ok(existsSync(join(root, designRel)), "design file");
    const rows = readTextFile(root, "system/.os/data/findings.jsonl").trim().split("\n").map((l) => JSON.parse(l) as { id: string; designs?: string[] });
    const designs = rows.find((r) => r.id === "FIND-001")?.designs ?? [];
    assert.deepEqual(designs, [designRel], "findings index row");
    for (const design of designs) assert.ok(existsSync(join(root, design)), `index row ${design} has its design file`);
    assert.ok(readTextFile(root, "system/workspace/findings/FIND-001/finding.md").includes(`../../../docs/designs/${designRel.split("/").pop()}`), "finding record");
    const temps: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (lstatSync(path).isDirectory()) walk(path);
        else if (name.includes(".tmp-")) temps.push(path);
      }
    };
    walk(root);
    assert.deepEqual(temps, [], "no temporary file");
  }

  it("a promotion exits 0 and writes the design file, the finding record, and the findings index row (every OS)", async () => {
    const root = fixtureCopy();
    const out = await cli(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan"], root);
    assert.equal(out.code, 0, out.stderr);
    assert.equal(out.stderr, "");
    assertWhole(root, timeStampedDesignPath("coupon-drops-tax-from-cart-total"));
  });

  it("on Windows: design-promote-baseline, -change-redirected, and installed-promote exit 0 with no half-applied state (PE-005)", { skip: process.platform !== "win32" ? "Windows only; runs on the Windows CI job" : false }, async () => {
    const baseline = fixtureCopy();
    assert.equal((await cli(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan"], baseline)).code, 0);
    assertWhole(baseline, timeStampedDesignPath("coupon-drops-tax-from-cart-total"));
    const redirected = fixtureCopy();
    const out = await cli(["promote", "finding", "--finding-id", "FIND-002", "--route", "change-plan", "--title", "Keep tax with coupons", "--slug", "keep-tax"], redirected);
    assert.equal(out.code, 0, out.stderr);
    assertWhole(redirected, timeStampedDesignPath("keep-tax"));
    const installed = tempRoot();
    cpSync(join(import.meta.dirname, "fixtures", "golden", "design-installed"), installed, { recursive: true });
    const inst = await cli(["promote", "finding", "--finding-id", "FIND-002", "--route", "baseline-plan"], installed);
    assert.equal(inst.code, 0, inst.stderr);
    assert.equal(inst.stderr, "");
  });

  it("registers design and discovery in the CLI", () => {
    assert.ok(BUILTIN_DOMAINS.some((d) => d.name === "design") && BUILTIN_DOMAINS.some((d) => d.name === "discovery"));
    assert.equal(createDesignDomain().help, DESIGN_USAGE);
  });
});

describe("a failed promotion restores every replaced entry as it was (P5 review round 2)", { skip: process.platform === "win32" ? "POSIX symlinks and modes" : false }, () => {
  // The same injected failures run against the Go 1.24.1 design tool (a
  // scratch Go test in package design that wraps replaceExistingFile and
  // createExclusiveFile, on test/fixtures/golden/design). Go's end states:
  // - index flush fails after its rename: Go keeps the new index (c6ee4480...).
  // - record flush fails after its rename: Go restores the index but keeps the
  //   new record (531e997f...), which names a design that does not exist.
  // - design creation fails: Go restores both; with symlinked inputs, Go's
  //   rollback writes regular files (mode 640) in place of the links.
  // Here every case ends in the state before the command: the original
  // bytes and mode, or the original link. Go ends in that state too for a
  // design creation failure on regular files. The error text is Go's.
  // PE-014 (approved 2026-11-23) lists the five cases where Go ends elsewhere.
  const GO_ORIGINAL = { index: "91955507baa155007bd66d17409370645b2478d3a0c0da05c23704e3a5a8ba9f", record: "81e907b47740fc196c5ad7a9685ed058ff1188727d124c5a424a93a82b602e75" };
  const INDEX = "system/.os/data/findings.jsonl";
  const RECORD = "system/workspace/findings/FIND-001/finding.md";
  const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

  function fixture(linked: boolean): { work: string; root: string } {
    const work = realpathSync(tempRoot());
    const root = join(work, "root");
    cpSync(join(import.meta.dirname, "fixtures", "golden", "design"), root, { recursive: true });
    if (linked) {
      for (const rel of [INDEX, RECORD]) {
        const outside = join(work, `outside-${rel.split("/").pop()}`);
        renameSync(join(root, rel), outside);
        chmodSync(outside, 0o640);
        symlinkSync(outside, join(root, rel));
      }
    }
    return { work, root };
  }

  /** The kind, link text or SHA-256 and mode of each entry the promotion replaces, and of the outside files. */
  function state(work: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rel of [`root/${INDEX}`, `root/${RECORD}`, "outside-findings.jsonl", "outside-finding.md"]) {
      const path = join(work, rel);
      let stats;
      try {
        stats = lstatSync(path);
      } catch {
        out[rel] = "missing";
        continue;
      }
      out[rel] = stats.isSymbolicLink() ? `link ${readlinkSync(path)}` : `file ${(stats.mode & 0o777).toString(8)} ${sha(path)}`;
    }
    const designs = readdirSync(join(work, "root/system/docs/designs"));
    out["designs"] = designs.filter((name) => name !== "AGENTS.md").join(",");
    const temps = [join(work, "root/system/.os/data"), join(work, "root/system/workspace/findings/FIND-001"), work].flatMap((dir) => readdirSync(dir).filter((name) => /\.tmp-|\.link-/.test(name)));
    out["temporary"] = temps.join(",");
    return out;
  }

  const failures: [string, (n: { calls: number }) => DesignContext["hooks"], (root: string) => string][] = [
    [
      "the index folder flush fails after its rename",
      (n) => ({ replaceExistingFile: (files, path, data, mode) => { files.atomicReplace(path, data, mode); if (++n.calls === 1) throw new GoError(`sync ${dirname(path)}: input/output error`); } }),
      (root) => `replace findings index: sync ${join(root, "system/.os/data")}: input/output error`,
    ],
    [
      "the record folder flush fails after its rename",
      (n) => ({ replaceExistingFile: (files, path, data, mode) => { files.atomicReplace(path, data, mode); if (++n.calls === 2) throw new GoError(`sync ${dirname(path)}: input/output error`); } }),
      (root) => `replace finding record: sync ${join(root, "system/workspace/findings/FIND-001")}: input/output error`,
    ],
    ["the design creation fails", () => ({ createExclusiveFile: () => { throw new GoError("injected design creation failure"); } }), () => "create design: injected design creation failure"],
  ];
  for (const linked of [false, true]) {
    for (const [label, hooks, message] of failures) {
      it(`${linked ? "symlinked" : "regular"} index and record: ${label}`, () => {
        const { work, root } = fixture(linked);
        const before = state(work);
        assert.throws(
          () => promoteFinding(context({ hooks: hooks({ calls: 0 })! }), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "r2" })),
          (error: unknown) => error instanceof GoError && error.message === message(root),
        );
        assert.deepEqual(state(work), before);
        if (linked) {
          assert.equal(before[`root/${INDEX}`], `link ${join(work, "outside-findings.jsonl")}`);
          assert.equal(before["outside-findings.jsonl"], `file 640 ${GO_ORIGINAL.index}`);
          assert.equal(before["outside-finding.md"], `file 640 ${GO_ORIGINAL.record}`);
        } else {
          assert.equal(before[`root/${INDEX}`], `file 644 ${GO_ORIGINAL.index}`);
          assert.equal(before[`root/${RECORD}`], `file 644 ${GO_ORIGINAL.record}`);
        }
      });
    }
  }

  it("PE-014 lists exactly the cases where Go's end state differs from the start state", () => {
    const titles = [false, true].flatMap((linked) => failures.map(([label]) => `${linked ? "symlinked" : "regular"} index and record: ${label}`));
    const goEndsInStartState = "regular index and record: the design creation fails";
    const pe014 = loadExceptions().exceptions.find((e) => e.id === "PE-014");
    assert.ok(pe014?.design_rollback !== undefined, "PE-014 has design_rollback");
    assert.deepEqual(
      pe014.design_rollback.map((x) => x.case),
      titles.filter((t) => t !== goEndsInStartState),
    );
    for (const x of pe014.design_rollback) assert.equal(x.allowed, "the start state");
  });
});

describe("a rollback keeps every original mode whatever the umask (P5 review round 3)", { skip: process.platform === "win32" ? "POSIX symlinks and modes" : false }, () => {
  // The reviewer's case: links made under umask 077 (mode 0700 on macOS)
  // came back as 0755 after a rollback under umask 022. Each case makes the
  // fixture under one umask and runs the failed promotion under the other,
  // with odd regular file and folder modes, and compares every entry's kind,
  // mode, and bytes or link text (macOS keeps a link's mode; Linux links are
  // always 0777).
  const INDEX = "system/.os/data/findings.jsonl";
  const RECORD = "system/workspace/findings/FIND-001/finding.md";
  const DIRS = ["system/.os/data", "system/workspace/findings/FIND-001", "system/docs/designs"];

  function fixture(linked: boolean, umask: number): { work: string; root: string } {
    const work = realpathSync(tempRoot());
    const root = join(work, "root");
    const previous = process.umask(umask);
    try {
      cpSync(join(import.meta.dirname, "fixtures", "golden", "design"), root, { recursive: true });
      for (const [rel, mode] of [[INDEX, 0o604], [RECORD, 0o600]] as const) {
        if (linked) {
          const outside = join(work, `outside-${rel.split("/").pop()}`);
          renameSync(join(root, rel), outside);
          chmodSync(outside, mode);
          symlinkSync(outside, join(root, rel));
        } else chmodSync(join(root, rel), mode);
      }
      for (const [i, rel] of DIRS.entries()) chmodSync(join(root, rel), [0o750, 0o711, 0o755][i]!);
    } finally {
      process.umask(previous);
    }
    return { work, root };
  }

  /** Kind, own mode, and SHA-256 or link text of every entry under the scratch folder. */
  function state(work: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string, rel: string) => {
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        const key = rel === "" ? name : `${rel}/${name}`;
        const stats = lstatSync(full);
        const mode = (stats.mode & 0o7777).toString(8);
        if (stats.isSymbolicLink()) out[key] = `link ${mode} ${readlinkSync(full)}`;
        else if (stats.isDirectory()) {
          out[key] = `dir ${mode}`;
          walk(full, key);
        } else out[key] = `file ${mode} ${createHash("sha256").update(readFileSync(full)).digest("hex")}`;
      }
    };
    walk(work, "");
    return out;
  }

  const failures: [string, (n: { calls: number }) => DesignContext["hooks"]][] = [
    ["the first folder flush fails", (n) => ({ replaceExistingFile: (files, path, data, mode) => { files.atomicReplace(path, data, mode); if (++n.calls === 1) throw new GoError(`sync ${dirname(path)}: input/output error`); } })],
    ["the second folder flush fails", (n) => ({ replaceExistingFile: (files, path, data, mode) => { files.atomicReplace(path, data, mode); if (++n.calls === 2) throw new GoError(`sync ${dirname(path)}: input/output error`); } })],
    ["the design creation fails", () => ({ createExclusiveFile: () => { throw new GoError("injected design creation failure"); } })],
  ];
  for (const [createUmask, runUmask] of [[0o077, 0o022], [0o022, 0o077]] as const) {
    for (const linked of [false, true]) {
      for (const [label, hooks] of failures) {
        it(`${linked ? "symlinked" : "regular"} entries made under umask ${createUmask.toString(8)}, rollback under ${runUmask.toString(8)}: ${label}`, () => {
          const { work, root } = fixture(linked, createUmask);
          const before = state(work);
          if (linked && process.platform === "darwin") assert.equal(before[`root/${INDEX}`], `link ${(0o777 & ~createUmask).toString(8)} ${join(work, "outside-findings.jsonl")}`);
          if (!linked) assert.match(before[`root/${INDEX}`]!, /^file 604 /);
          assert.equal(before["root/system/.os/data"], "dir 750");
          const previous = process.umask(runUmask);
          try {
            assert.throws(() => promoteFinding(context({ hooks: hooks({ calls: 0 })! }), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "r3" })), GoError);
          } finally {
            process.umask(previous);
          }
          assert.deepEqual(state(work), before);
        });
      }
    }
  }
});

describe("a rollback keeps the setuid, setgid, and sticky bits (W1 R7 P5 fix)", { skip: process.platform === "win32" ? "POSIX modes" : false }, () => {
  // The reviewer's case: a findings index at 01604 and a finding record at
  // 01640 came back as 0604 and 0640 after a rollback (the snapshot masked
  // the mode with 0o777). Go's rollback replaces each file with
  // Chmod(info.Mode().Perm()) and drops the special bits; PE-014 restores the
  // start state, so the full mode (mode & 0o7777) comes back. Folders are
  // never replaced, so a sticky or setgid folder keeps its bits. A
  // successful promotion replaces the files as Go does, with Perm() only:
  // no special bit is granted or kept that Go would not keep.
  const INDEX = "system/.os/data/findings.jsonl";
  const RECORD = "system/workspace/findings/FIND-001/finding.md";
  const DIRS = ["system/.os/data", "system/workspace/findings/FIND-001", "system/docs/designs"];

  /** True when this OS and user keep `bit` on a new file or folder here (setgid needs the folder's group; a sandbox can drop it). */
  function keeps(bit: number, folder: boolean): boolean {
    const dir = realpathSync(tempRoot());
    const path = join(dir, "probe");
    if (folder) mkdirSync(path);
    else writeFileSync(path, "");
    try {
      chmodSync(path, (folder ? 0o755 : 0o644) | bit);
    } catch {
      return false;
    }
    return (lstatSync(path).mode & bit) === bit;
  }

  const variants = [
    { name: "sticky", files: [0o1604, 0o1640], dirs: [0o1750, 0o1711, 0o1755], bit: 0o1000 },
    { name: "setgid", files: [0o2604, 0o2640], dirs: [0o2750, 0o2711, 0o2755], bit: 0o2000 },
  ] as const;

  function fixture(variant: (typeof variants)[number]): { work: string; root: string } {
    const work = realpathSync(tempRoot());
    const root = join(work, "root");
    cpSync(join(import.meta.dirname, "fixtures", "golden", "design"), root, { recursive: true });
    chmodSync(join(root, INDEX), variant.files[0]);
    chmodSync(join(root, RECORD), variant.files[1]);
    for (const [i, rel] of DIRS.entries()) chmodSync(join(root, rel), variant.dirs[i]!);
    return { work, root };
  }

  /** Kind, full mode (mode & 0o7777), and SHA-256 of every entry under the scratch folder. */
  function state(work: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string, rel: string) => {
      for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        const key = rel === "" ? name : `${rel}/${name}`;
        const stats = lstatSync(full);
        const mode = (stats.mode & 0o7777).toString(8);
        if (stats.isDirectory()) {
          out[key] = `dir ${mode}`;
          walk(full, key);
        } else out[key] = `file ${mode} ${createHash("sha256").update(readFileSync(full)).digest("hex")}`;
      }
    };
    walk(work, "");
    return out;
  }

  const failures: [string, (n: { calls: number }) => DesignContext["hooks"]][] = [
    ["the index folder flush fails after its rename", (n) => ({ replaceExistingFile: (files, path, data, mode) => { files.atomicReplace(path, data, mode); if (++n.calls === 1) throw new GoError(`sync ${dirname(path)}: input/output error`); } })],
    ["the record folder flush fails after its rename", (n) => ({ replaceExistingFile: (files, path, data, mode) => { files.atomicReplace(path, data, mode); if (++n.calls === 2) throw new GoError(`sync ${dirname(path)}: input/output error`); } })],
    ["the design creation fails", () => ({ createExclusiveFile: () => { throw new GoError("injected design creation failure"); } })],
  ];
  for (const variant of variants) {
    const fileSkip = keeps(variant.bit, false) ? false : `this OS or user does not keep the ${variant.name} bit on a file here`;
    const dirSkip = keeps(variant.bit, true) ? false : `this OS or user does not keep the ${variant.name} bit on a folder here`;
    for (const [label, hooks] of failures) {
      it(`${variant.name} index, record, and folders: ${label}`, { skip: fileSkip || dirSkip }, () => {
        const { work, root } = fixture(variant);
        const before = state(work);
        assert.match(before[`root/${INDEX}`]!, new RegExp(`^file ${variant.files[0].toString(8)} `));
        assert.match(before[`root/${RECORD}`]!, new RegExp(`^file ${variant.files[1].toString(8)} `));
        assert.equal(before["root/system/.os/data"], `dir ${variant.dirs[0].toString(8)}`);
        assert.throws(() => promoteFinding(context({ hooks: hooks({ calls: 0 })! }), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "special" })), GoError);
        assert.deepEqual(state(work), before);
      });
    }
    it(`${variant.name}: a successful promotion drops the special bits of the replaced files, as Go's Perm(), and keeps the folders'`, { skip: fileSkip || dirSkip }, () => {
      const { work, root } = fixture(variant);
      promoteFinding(context(), options(root, { findingId: "FIND-001", route: "baseline-plan", slug: "special" }));
      const after = state(work);
      assert.match(after[`root/${INDEX}`]!, new RegExp(`^file ${(variant.files[0] & 0o777).toString(8)} `));
      assert.match(after[`root/${RECORD}`]!, new RegExp(`^file ${(variant.files[1] & 0o777).toString(8)} `));
      for (const [i, rel] of DIRS.entries()) assert.equal(after[`root/${rel}`], `dir ${variant.dirs[i]!.toString(8)}`);
    });
  }
});

/**
 * W1 R7 P7 review round 1 (P7-R1-05): Make Docs 2.0.9 keeps the design
 * workflow, contract, template, and prompts under `.make-docs/system/`, not
 * under `docs/assets/`. The companion files are a byte copy of a real
 * `buildos init --make-docs` with Make Docs 2.0.9
 * (test/golden/make-docs-companion/capture.ts), so no test needs Make Docs.
 */
describe("design promote with the Make Docs 2.0.9 layout (P7-R1-05)", () => {
  const COMPANION = join(import.meta.dirname, "fixtures", "make-docs-companion");
  const INSTALLED = join(import.meta.dirname, "fixtures", "golden", "design-installed");
  const NOW = new Date("2026-11-24T12:00:00Z");
  const cliAt = async (args: string[], root: string): Promise<{ code: number; stdout: string; stderr: string }> => {
    const io = captureIo(root);
    const code = await run(["design", ...args], io, { domains: [createDesignDomain({ now: () => NOW })] });
    return { code, stdout: io.stdout(), stderr: io.stderr() };
  };
  /** The installed design fixture with its legacy `docs/assets/` inputs replaced by the Make Docs 2.0.9 files. */
  const companionProject = (): string => {
    const root = tempRoot();
    cpSync(INSTALLED, root, { recursive: true });
    rmSync(join(root, "docs", "assets"), { recursive: true });
    rmSync(join(root, "docs", "designs", "AGENTS.md"));
    cpSync(COMPANION, root, { recursive: true });
    return root;
  };
  const args = ["promote", "finding", "--finding-id", "FIND-001", "--route", "change-plan", "--slug", "keep-tax"];

  it("a dry run and a promotion succeed with only the .make-docs/system/ inputs; the design is in the 2.0.9 form (PE-020) and the finding data equals the legacy layout's", async () => {
    const root = companionProject();
    assert.ok(!existsSync(join(root, "docs", "assets")));
    const dry = await cliAt([...args, "--dry-run"], root);
    assert.equal(dry.code, 0, dry.stderr);
    assert.equal(dry.stderr, "");
    const applied = await cliAt(args, root);
    assert.equal(applied.code, 0, applied.stderr);
    const legacy = tempRoot();
    cpSync(INSTALLED, legacy, { recursive: true });
    assert.equal((await cliAt(args, legacy)).code, 0);
    const design = `docs/designs/${goLocalDate(NOW)}-keep-tax.md`;
    assert.notEqual(readTextFile(root, design), readTextFile(legacy, design));
    assert.ok(readTextFile(root, design).startsWith('---\ntitle: "'), "W1 R7 P7 Stage 6: the 2.0.9 frontmatter");
    assert.ok(readTextFile(legacy, design).startsWith("# "), "the legacy layout keeps Go's form");
    assert.equal(readTextFile(root, ".os/data/findings.jsonl"), readTextFile(legacy, ".os/data/findings.jsonl"));
  });

  for (const [label, rel] of [
    ["design workflow", ".make-docs/system/references/design-workflow.md"],
    ["design contract", ".make-docs/system/contracts/design-contract.md"],
    ["design template", ".make-docs/system/templates/design.md"],
    ["next prompt", ".make-docs/system/prompts/designs-to-plan-change.prompt.md"],
    ["design router", "docs/designs/AGENTS.md"],
  ] as const) {
    it(`a missing ${label} stops with exit 3, names ${rel}, and gives the Make Docs setup command; nothing is written`, async () => {
      const root = companionProject();
      rmSync(join(root, ...rel.split("/")));
      const before = readTextFile(root, ".os/data/findings.jsonl");
      const out = await cliAt(args, root);
      assert.equal(out.code, 3);
      assert.equal(out.stdout, "");
      assert.ok(out.stderr.startsWith(`buildos-design: error: the Make Docs ${label} ${rel} is missing, so BuildOS cannot write the design. Make Docs is set up in this folder, but this file is missing. If this project folder was copied or moved, Make Docs stops that command with "Checkout identity needs a path choice." and gives its own next step; do that step first.`), out.stderr);
      // P7-R2-03: the command buildos init shows for a later setup (npx), for the shell this OS uses.
      assert.match(out.stderr, new RegExp(` To put the Make Docs files back, ${process.platform === "win32" ? "run this in Command Prompt" : "run this"}, then run this command again: npx -y @brucewaynedecoy/make-docs@\\S+ setup --target .+ --project-resources all --yes --json\n$`));
      assert.equal(readTextFile(root, ".os/data/findings.jsonl"), before);
      assert.deepEqual(readdirSync(join(root, "docs", "designs")).filter((name) => name.endsWith("keep-tax.md")), []);
      const json = await cliAt([...args, "--json"], root);
      const envelope = JSON.parse(json.stdout) as { diagnostics: { code: string; correction: string }[] };
      assert.equal(json.code, 3);
      assert.equal(envelope.diagnostics[0]!.code, "make_docs_input_missing");
      assert.match(envelope.diagnostics[0]!.correction, /^To put the Make Docs files back, run this( in Command Prompt)?, then run this command again: npx -y @brucewaynedecoy\/make-docs@\S+ setup --target /);
    });
  }

  it("P7-R3-05: an empty local body is not valid: exit 3, the file is named as empty, and the fix deletes it before the setup command", async () => {
    const root = companionProject();
    writeFileSync(join(root, ".make-docs", "system", "templates", "design.md"), " \n");
    const out = await cliAt(args, root);
    assert.equal(out.code, 3);
    const run = process.platform === "win32" ? "run this in Command Prompt" : "run this";
    assert.ok(
      out.stderr.startsWith(
        `buildos-design: error: the Make Docs design template .make-docs/system/templates/design.md is empty, so BuildOS cannot write the design. Make Docs keeps a changed copy of a file it manages, and BuildOS does not change this file either. If this project folder was copied or moved, Make Docs stops that command with "Checkout identity needs a path choice." and gives its own next step; do that step first. To get the Make Docs file back, delete .make-docs/system/templates/design.md, then ${run}, then run this command again: npx -y @brucewaynedecoy/make-docs@`,
      ),
      out.stderr,
    );
    assert.doesNotMatch(out.stderr, /is missing/);
    const json = await cliAt([...args, "--json"], root);
    const envelope = JSON.parse(json.stdout) as { diagnostics: { code: string }[] };
    assert.equal(envelope.diagnostics[0]!.code, "make_docs_input_empty");
    // An empty current body decides: it never falls back to a legacy body (P7-R3-06).
    const mixed = tempRoot();
    cpSync(INSTALLED, mixed, { recursive: true });
    cpSync(join(COMPANION, ".make-docs"), join(mixed, ".make-docs"), { recursive: true });
    writeFileSync(join(mixed, ".make-docs", "system", "templates", "design.md"), "");
    const fellBack = await cliAt([...args, "--dry-run"], mixed);
    assert.equal(fellBack.code, 3, fellBack.stderr);
    assert.match(fellBack.stderr, /design\.md is empty/);
  });

  it("F-P8-11 review round 3 (finding 1): from project A with --repo-root B, the file to delete is B's empty template, human and JSON", async () => {
    const a = companionProject();
    const b = companionProject();
    const aTemplate = join(a, ".make-docs", "system", "templates", "design.md");
    const bTemplate = join(b, ".make-docs", "system", "templates", "design.md");
    writeFileSync(aTemplate, "a real template.\n");
    writeFileSync(bTemplate, "");
    const fromA = [...args, "--repo-root", relative(a, b)];
    const out = await cliAt(fromA, a);
    assert.equal(out.code, 3, out.stderr);
    assert.ok(out.stderr.includes(` To get the Make Docs file back, delete ${bTemplate}, then `), out.stderr);
    assert.doesNotMatch(out.stderr, /delete \.make-docs/);
    const json = await cliAt([...fromA, "--json"], a);
    const envelope = JSON.parse(json.stdout) as { diagnostics: { code: string; correction: string }[] };
    assert.equal(json.code, 3);
    assert.equal(envelope.diagnostics[0]!.code, "make_docs_input_empty");
    assert.ok(envelope.diagnostics[0]!.correction.startsWith(`To get the Make Docs file back, delete ${bTemplate}, then `), envelope.diagnostics[0]!.correction);
    // The named file is B's empty template; A's real template is not named and stays.
    assert.equal(readFileSync(bTemplate).length, 0);
    assert.equal(readFileSync(aTemplate, "utf8"), "a real template.\n");
  });

  it("a Go-era project (docs/assets/ inputs, no .make-docs/system/) keeps the Go error text and exit 1", async () => {
    const root = tempRoot();
    cpSync(INSTALLED, root, { recursive: true });
    rmSync(join(root, "docs", "assets", "templates", "design.md"));
    const out = await cliAt(args, root);
    assert.equal(out.code, 1);
    assert.ok(out.stderr.startsWith("buildos-design: error: read design template docs/assets/templates/design.md: open "), out.stderr);
  });

  /** Makes a symlink, or returns false where the OS does not allow it (Windows without the privilege). */
  const tryLink = (target: string, path: string, type: "file" | "dir" = "file"): boolean => {
    try {
      symlinkSync(target, path, type);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return false;
      throw error;
    }
  };

  it("P7-R2-02: a design input that is a link to a regular file inside the project is read", async (t) => {
    const root = companionProject();
    const template = join(root, ".make-docs", "system", "templates", "design.md");
    renameSync(template, join(root, "design-template-copy.md"));
    if (!tryLink(join(root, "design-template-copy.md"), template)) return t.skip("this OS does not allow a symlink here");
    const out = await cliAt([...args, "--dry-run"], root);
    assert.equal(out.code, 0, out.stderr);
  });

  it("P7-R2-02, P7-R3-03: a design input that is a link out of the project is refused (exit 3), also for a legacy input and with --allow-outside-root", async (t) => {
    const work = tempRoot();
    const outside = join(work, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "design.md"), "# Outside template\n");
    const root = join(work, "project");
    cpSync(INSTALLED, root, { recursive: true });
    cpSync(COMPANION, root, { recursive: true });
    const current = join(root, ".make-docs", "system", "templates", "design.md");
    rmSync(current);
    if (!tryLink(join(outside, "design.md"), current)) return t.skip("this OS does not allow a symlink here");
    const refused = await cliAt([...args, "--dry-run"], root);
    assert.equal(refused.code, 3, refused.stderr);
    assert.match(refused.stderr, /^buildos-design: error: \.make-docs\/system\/templates\/design\.md is a link that leads outside the root .+; BuildOS reads this file only inside the project, so move it into the project or replace the link with the file\n$/);
    assert.doesNotMatch(refused.stderr, /allow-outside-root/, "P7-R3-03: the write switch is never offered for a read");
    const flagged = await cliAt([...args, "--dry-run", "--allow-outside-root"], root);
    assert.equal(flagged.code, 3, "P7-R3-03: the switch does not widen a design input read");
    // The legacy input (Go read it through the link).
    rmSync(current);
    const legacy = join(root, "docs", "assets", "templates", "design.md");
    rmSync(legacy);
    assert.ok(tryLink(join(outside, "design.md"), legacy));
    const legacyRefused = await cliAt([...args, "--dry-run"], root);
    assert.equal(legacyRefused.code, 3, legacyRefused.stderr);
    assert.match(legacyRefused.stderr, /docs\/assets\/templates\/design\.md is a link that leads outside the root /);
    const allowed = await cliAt([...args, "--dry-run", "--allow-outside-root"], root);
    assert.equal(allowed.code, 3, allowed.stderr);
    assert.match(allowed.stderr, /docs\/assets\/templates\/design\.md is a link that leads outside the root /);
  });

  it("P7-R2-02: a dangling link or a folder at a design input is a missing input (exit 3)", async (t) => {
    const root = companionProject();
    const template = join(root, ".make-docs", "system", "templates", "design.md");
    rmSync(template);
    mkdirSync(template);
    let out = await cliAt([...args, "--dry-run"], root);
    assert.equal(out.code, 3);
    assert.match(out.stderr, /the Make Docs design template \.make-docs\/system\/templates\/design\.md is missing, /);
    rmSync(template, { recursive: true });
    if (!tryLink(join(root, "no-such-file.md"), template)) return t.skip("this OS does not allow a symlink here");
    out = await cliAt([...args, "--dry-run"], root);
    assert.equal(out.code, 3);
    assert.match(out.stderr, /the Make Docs design template \.make-docs\/system\/templates\/design\.md is missing, /);
  });

  it("P7-R2-02, P7-R3-06: a design input over 4 MiB is not read: a current or a legacy body fails with the bound (exit 1), with no fall back", async () => {
    const root = companionProject();
    const big = Buffer.alloc(4 * 1024 * 1024 + 1, 0x61);
    writeFileSync(join(root, ".make-docs", "system", "templates", "design.md"), big);
    const current = await cliAt([...args, "--dry-run"], root);
    assert.equal(current.code, 1);
    assert.match(current.stderr, /^buildos-design: error: read design template \.make-docs\/system\/templates\/design\.md: read .+design\.md: file too large: BuildOS reads at most 4 MiB from one such file\n$/);
    // A legacy template is there too: the over-limit current body still decides.
    const mixed = tempRoot();
    cpSync(INSTALLED, mixed, { recursive: true });
    cpSync(join(COMPANION, ".make-docs"), join(mixed, ".make-docs"), { recursive: true });
    writeFileSync(join(mixed, ".make-docs", "system", "templates", "design.md"), big);
    const noFallback = await cliAt([...args, "--dry-run"], mixed);
    assert.equal(noFallback.code, 1, noFallback.stderr);
    assert.match(noFallback.stderr, /file too large/);
    const legacy = tempRoot();
    cpSync(INSTALLED, legacy, { recursive: true });
    writeFileSync(join(legacy, "docs", "assets", "templates", "design.md"), big);
    const out = await cliAt([...args, "--dry-run"], legacy);
    assert.equal(out.code, 1);
    assert.match(out.stderr, /^buildos-design: error: read design template docs\/assets\/templates\/design\.md: read .+design\.md: file too large: BuildOS reads at most 4 MiB from one such file\n$/);
  });

  it("a valid .make-docs/system/ body wins over a legacy body, and a missing one falls back to it", async () => {
    const root = tempRoot();
    cpSync(INSTALLED, root, { recursive: true });
    cpSync(join(COMPANION, ".make-docs"), join(root, ".make-docs"), { recursive: true });
    rmSync(join(root, "docs", "assets", "templates", "design.md"));
    assert.equal((await cliAt([...args, "--dry-run"], root)).code, 0);
    rmSync(join(root, ".make-docs", "system", "templates", "design.md"));
    const out = await cliAt([...args, "--dry-run"], root);
    assert.equal(out.code, 1);
    assert.match(out.stderr, /^buildos-design: error: read design template docs\/assets\/templates\/design\.md: open /);
  });
});

/**
 * W1 R7 P7 Stage 6 (t20, t21; register R-009 option B; parity exception
 * PE-020): in a project whose design template resolves from the Make Docs
 * 2.0.9 layout, the design is written in the 2.0.9 form, built from the
 * project's own template and contract. The legacy layout keeps Go's bytes
 * (the goldens). Checked against the committed 2.0.9 companion fixture and
 * its capture record (the names of every file Make Docs 2.0.9 wrote under
 * `.make-docs/system/`); no test needs Make Docs.
 */
describe("design promote writes the Make Docs 2.0.9 form (Stage 6, PE-020)", () => {
  const COMPANION = join(import.meta.dirname, "fixtures", "make-docs-companion");
  const INSTALLED = join(import.meta.dirname, "fixtures", "golden", "design-installed");
  const RECORD = JSON.parse(readFileSync(join(import.meta.dirname, "golden", "make-docs-companion", "capture-record.json"), "utf8")) as { make_docs_system_files: string[] };
  const NOW = new Date("2026-11-24T12:00:00Z");
  const cliAt = async (args: string[], root: string): Promise<{ code: number; stdout: string; stderr: string }> => {
    const io = captureIo(root);
    const code = await run(["design", ...args], io, { domains: [createDesignDomain({ now: () => NOW })] });
    return { code, stdout: io.stdout(), stderr: io.stderr() };
  };
  const companionProject = (): string => {
    const root = tempRoot();
    cpSync(INSTALLED, root, { recursive: true });
    rmSync(join(root, "docs", "assets"), { recursive: true });
    rmSync(join(root, "docs", "designs", "AGENTS.md"));
    cpSync(COMPANION, root, { recursive: true });
    return root;
  };
  const design = (root: string, slug: string) => readTextFile(root, `docs/designs/${goLocalDate(NOW)}-${slug}.md`);
  const headings = (text: string) => [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);
  const frontmatter = (text: string) => text.slice(4, text.indexOf("\n---\n"));
  const TEMPLATE = readFileSync(join(COMPANION, ".make-docs", "system", "templates", "design.md"), "utf8");
  /** The body of `## heading` in `text`, without surrounding blank lines. */
  const section = (text: string, heading: string) => {
    const start = text.indexOf(`\n## ${heading}\n`);
    const rest = text.slice(start + heading.length + 5);
    const end = rest.indexOf("\n## ");
    return (end === -1 ? rest : rest.slice(0, end)).trim();
  };

  for (const [route, prompt] of [
    ["baseline-plan", "designs-to-plan.prompt.md"],
    ["change-plan", "designs-to-plan-change.prompt.md"],
  ] as const) {
    it(`${route}: the 2.0.9 frontmatter, the template's sections in order, the empty Human Experience Intent, and a next prompt that resolves`, async () => {
      const root = companionProject();
      const out = await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", route, "--slug", "keep-tax"], root);
      assert.equal(out.code, 0, out.stderr);
      const text = design(root, "keep-tax");
      assert.ok(text.startsWith("---\n"));
      const handoff = route === "baseline-plan" ? "not applicable for baseline planning." : "unresolved; planner must resolve before writing.";
      const why = route === "baseline-plan" ? "This design should feed a fresh baseline planning flow for the promoted finding." : "This design should feed additive planning from qualified evidence into the active Build OS planning path.";
      const title = text.match(/^# (.+)$/m)![1]!;
      assert.equal(
        frontmatter(text),
        [`title: ${JSON.stringify(title)}`, 'kind: "design"', 'status: "draft"', "follow_on:", `  route: "${route}"`, `  next_prompt: "make-docs://system/prompt/${prompt}"`, `  why: ${JSON.stringify(why)}`, `  coordinate_handoff: ${JSON.stringify(handoff)}`].join("\n"),
      );
      assert.deepEqual(headings(text), ["Purpose", "Context", "Human Experience Intent", "Performance Evidence Candidates", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"]);
      // Left for the planner: the template's own text, unfilled.
      assert.equal(section(text, "Human Experience Intent"), section(TEMPLATE, "Human Experience Intent"));
      assert.equal(section(text, "Performance Evidence Candidates"), section(TEMPLATE, "Performance Evidence Candidates"));
      assert.doesNotMatch(text, /system\/docs\//);
      assert.doesNotMatch(frontmatter(text), /\{\{/);
      assert.doesNotMatch(section(text, "Intended Follow-On"), /\{\{/);
      assert.match(section(text, "Intended Follow-On"), new RegExp(`^- Route: \`${route}\`\\n- Next Prompt: \\[${prompt.replaceAll(".", "\\.")}\\]\\(\\.\\./\\.\\./\\.make-docs/system/prompts/${prompt.replaceAll(".", "\\.")}\\)\\. Read \`make-docs://system/prompt/${prompt.replaceAll(".", "\\.")}\` with \`make-docs resource read\`\\.\\n- Why: `));
      assert.match(section(text, "Alternatives Considered"), /the `docs\/designs\/` router/);
      // Every heading the project's design contract requires is there.
      for (const required of ["Purpose", "Context", "Human Experience Intent", "Decision", "Alternatives Considered", "Consequences", "Intended Follow-On"]) assert.ok(headings(text).includes(required), required);
    });
  }

  it("every relative link and every make-docs:// URI in the design resolves against the companion fixture and the finding data", async () => {
    const root = companionProject();
    // The finding's raw anchor names its run's raw findings record, which a real project has (discovery wrote it); the fixture has only the finding.
    mkdirSync(join(root, "workspace", "runs", "RUN-001"), { recursive: true });
    writeFileSync(join(root, "workspace", "runs", "RUN-001", "raw-findings.md"), "# Raw Findings\n\n## raw-finding-1\n");
    assert.equal((await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "change-plan", "--slug", "keep-tax"], root)).code, 0);
    const rel = `docs/designs/${goLocalDate(NOW)}-keep-tax.md`;
    const text = design(root, "keep-tax");
    const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]!).filter((l) => !/^[a-z]+:/.test(l) && !l.startsWith("#"));
    assert.ok(links.length >= 4, links.join(", "));
    for (const link of links) {
      const target = join(root, dirname(rel), link.split("#")[0]!);
      assert.ok(existsSync(target), `${link} resolves`);
      // A design link never leads out of the project.
      assert.ok(!relative(root, target).startsWith(".."), link);
    }
    const uris = [...new Set([...text.matchAll(/make-docs:\/\/system\/([a-z]+)\/([A-Za-z0-9._/-]+[A-Za-z0-9_-])/g)].map((m) => `.make-docs/system/${m[1]}s/${m[2]}`))];
    assert.ok(uris.length >= 3, uris.join(", "));
    for (const file of uris) assert.ok(RECORD.make_docs_system_files.includes(file), `${file} is a Make Docs 2.0.9 resource`);
  });

  it("the dry run shows the 2.0.9 form and writes nothing", async () => {
    const root = companionProject();
    const out = await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "keep-tax", "--dry-run", "--json"], root);
    assert.equal(out.code, 0, out.stderr);
    const content = (JSON.parse(out.stdout) as { result: { design_content: string } }).result.design_content;
    assert.ok(content.startsWith('---\ntitle: "'), content.slice(0, 40));
    assert.ok(!existsSync(join(root, "docs", "designs", `${goLocalDate(NOW)}-keep-tax.md`)));
    // A real promotion writes exactly the dry run's text.
    assert.equal((await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "keep-tax"], root)).code, 0);
    assert.equal(design(root, "keep-tax"), content);
  });

  it("the legacy layout keeps Go's form; a mixed project follows the template it read, with a prompt link to the file it read", async () => {
    const legacy = tempRoot();
    cpSync(INSTALLED, legacy, { recursive: true });
    assert.equal((await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "keep-tax"], legacy)).code, 0);
    assert.match(design(legacy, "keep-tax"), /^# .+\n\n## Purpose\n/);
    assert.match(design(legacy, "keep-tax"), /\(\.\.\/assets\/prompts\/designs-to-plan\.prompt\.md\)\n/);
    const mixed = tempRoot();
    cpSync(INSTALLED, mixed, { recursive: true });
    mkdirSync(join(mixed, ".make-docs", "system", "templates"), { recursive: true });
    mkdirSync(join(mixed, ".make-docs", "system", "contracts"), { recursive: true });
    cpSync(join(COMPANION, ".make-docs", "system", "templates", "design.md"), join(mixed, ".make-docs", "system", "templates", "design.md"));
    cpSync(join(COMPANION, ".make-docs", "system", "contracts", "design-contract.md"), join(mixed, ".make-docs", "system", "contracts", "design-contract.md"));
    assert.equal((await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "keep-tax"], mixed)).code, 0);
    const text = design(mixed, "keep-tax");
    assert.ok(text.startsWith("---\n"));
    assert.match(text, /- Next Prompt: \[designs-to-plan\.prompt\.md\]\(\.\.\/assets\/prompts\/designs-to-plan\.prompt\.md\)/);
  });

  for (const [name, change] of [
    ["an unknown frontmatter key", (t: string) => t.replace('status: "draft"\n', 'status: "draft"\nowner: "{{OWNER}}"\n')],
    ["a missing Decision section", (t: string) => t.replace("## Decision\n", "## Choice\n")],
    ["a missing Next Prompt line", (t: string) => t.replace(/^- Next Prompt:.*\n/m, "")],
    ["no title line", (t: string) => t.replace("# {{TITLE}}\n", "")],
  ] as const) {
    it(`fails safe on a template of a form this version does not know (${name}): exit 3, nothing written`, async () => {
      const root = companionProject();
      const template = join(root, ".make-docs", "system", "templates", "design.md");
      writeFileSync(template, change(readFileSync(template, "utf8")));
      const before = readTextFile(root, ".os/data/findings.jsonl");
      const out = await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "keep-tax", "--json"], root);
      assert.equal(out.code, 3, out.stdout);
      const diagnostic = (JSON.parse(out.stdout) as { diagnostics: { code: string; message: string }[] }).diagnostics[0]!;
      assert.equal(diagnostic.code, "make_docs_design_form_unknown");
      assert.match(diagnostic.message, /^the Make Docs design template \.make-docs\/system\/templates\/design\.md has a form this BuildOS version does not know \(.+\), so BuildOS cannot write the design\. BuildOS changed nothing\./);
      assert.equal(readTextFile(root, ".os/data/findings.jsonl"), before);
      assert.ok(!existsSync(join(root, "docs", "designs", `${goLocalDate(NOW)}-keep-tax.md`)));
    });
  }

  it("fails safe when the contract requires a heading the template lacks", async () => {
    const root = companionProject();
    const contract = join(root, ".make-docs", "system", "contracts", "design-contract.md");
    writeFileSync(contract, readFileSync(contract, "utf8").replace("- `## Decision`\n", "- `## Decision`\n- `## Risks`\n"));
    const out = await cliAt(["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan", "--slug", "keep-tax"], root);
    assert.equal(out.code, 3);
    // P7-R4-04: a contract whose required headings are not the 2.0.9 list is an unknown form.
    assert.match(out.stderr, /the design contract requires the headings Purpose, Context, Human Experience Intent, Decision, Risks, .* not the Make Docs 2\.0\.9 list/);
  });

  it("PE-014 still holds: a failed design creation in the 2.0.9 form restores the start state", () => {
    const root = companionProject();
    const before = tree(root);
    assert.throws(
      () =>
        promoteFinding(
          { cwd: root, openFs: createNodeFsPort, now: () => NOW, hooks: { createExclusiveFile: () => { throw new GoError("injected"); } } },
          { repoRoot: root, findingId: "FIND-001", route: "baseline-plan", title: "", slug: "keep-tax", dryRun: false },
        ),
      /create design: injected/,
    );
    assertSameTree(tree(root), before, "project tree");
  });
});
