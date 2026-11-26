// W1 R7 P9 review round 3 (the final check of Stages 1 and 2): one test (or
// more) per finding P9-F-01 to P9-F-08, each failing without its fix.
// Divergences from the scripts are recorded in
// test/golden/skills/divergences.json (SD-16, SD-18, SD-20, SD-21, SD-22).
// Every input is invented (the library book-lending topic). Failures print
// counts, tags, and sizes only (test-output-safety.test.ts).

import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assertIncludes, assertSame, assertSameTree } from "./helpers.ts";
import { buildos, canLink, CONFIG, envelopeOf, fixtureFile, frameWith, instrumented, merged, ownedReview, project, tree } from "./skill-script-support.ts";

const REVIEW = "extractions/REF-001-lending-policy.json";
const CAPS = ".os/data/capabilities.jsonl";
const configPath = (dir: string): string => join(dir, ".os", "config", "instance.yaml");
const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const linkKind = process.platform === "win32" ? "junction" : "dir";
const treeOf = (dir: string): Map<string, string> => {
  const t = tree(dir);
  t.delete("extractions/staging/");
  return t;
};

// ---------------------------------------------------------------- P9-F-01

/** A package as `fitgap packages` writes it, then a grader's note added to its item (no longer the generated shape). */
const ANNOTATED_PACKAGE = JSON.stringify([{ id: "OLD", name: "Old", layer_code: "L", layer_name: "Layer", type: "t", status: "s", maturity: "m", summary: "", requirements: [{ id: "R", kind: "k", status: "s", text: "", option_values: [] }], notes: "Checked with the circulation desk." }], null, 1);

describe("P9-F-01: fitgap packages never writes over a package file BuildOS did not write (divergence SD-20)", () => {
  for (const outside of [false, true]) {
    it(`${outside ? "an authorized folder outside the project" : "inside the project"}: an annotated pkg-01.json stops the run before any change (exit 4) and is named`, async () => {
      const dir = project("fitgap", "library");
      const out = outside ? join(dir, "..", "outside-work") : join(dir, "work");
      mkdirSync(join(out, "packages"), { recursive: true });
      writeFileSync(join(out, "packages", "pkg-01.json"), ANNOTATED_PACKAGE);
      const beforeProject = tree(dir);
      const beforeOut = tree(out);
      const r = await buildos(["fitgap", "--root", dir, "--json", "packages", "--frame", "analysis/frame.json", "--out", outside ? out : "work", ...(outside ? ["--allow-outside-root"] : [])], dir);
      assertSame(r.exit, 4, "exit");
      assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
      const message = (envelopeOf(r)["diagnostics"] as { message: string }[])[0]!.message;
      assertIncludes(message, "packages/pkg-01.json (its items do not have the fields BuildOS writes)");
      assertIncludes(message, "so it changed nothing");
      assertIncludes(message, "choose another --out folder");
      assertSame(readFileSync(join(out, "packages", "pkg-01.json"), "utf8"), ANNOTATED_PACKAGE, "the annotated package");
      assertSameTree(tree(out), beforeOut, "the output folder");
      if (outside) assertSameTree(tree(dir), beforeProject, "the project");
    });
  }

  it("a link at a name the run writes stops it too; a kept file at a name it does not write is still only named", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const dir = project("fitgap", "library");
    mkdirSync(join(dir, "work", "packages"), { recursive: true });
    writeFileSync(join(dir, "work", "elsewhere.json"), "[]");
    symlinkSync(join(dir, "work", "elsewhere.json"), join(dir, "work", "packages", "pkg-01.json"), "file");
    const r = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", "work"], dir);
    assertSame(r.exit, 4, "exit with a link at pkg-01.json");
    assertIncludes(r.stderr, "work/packages/pkg-01.json (it is a link");
    const other = project("fitgap", "library");
    mkdirSync(join(other, "work", "packages"), { recursive: true });
    writeFileSync(join(other, "work", "packages", "pkg-02.json"), ANNOTATED_PACKAGE);
    const kept = await buildos(["fitgap", "--root", other, "packages", "--frame", "analysis/frame.json", "--out", "work"], other);
    assertSame(kept.exit, 0, "exit with a kept pkg-02.json (the run writes only pkg-01.json)");
    assertIncludes(kept.stderr, "fitgap: kept work/packages/pkg-02.json");
    assertSame(readFileSync(join(other, "work", "packages", "pkg-02.json"), "utf8"), ANNOTATED_PACKAGE, "the kept file");
  });
});

// ---------------------------------------------------------------- P9-F-02

/** A project whose review names the owner circulation-desk on the renewals row, staged and approved while the config defines that owner. */
async function ownedAndApproved(): Promise<string> {
  const dir = project("bulk-extract", "library");
  mkdirSync(join(dir, ".os", "config"), { recursive: true });
  writeFileSync(configPath(dir), CONFIG(["front-desk", "circulation-desk"]));
  assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
  writeFileSync(join(dir, ...REVIEW.split("/")), ownedReview());
  assertSame((await buildos(["extract", "bulk", "--root", dir, "stage", "REF-001"], dir)).exit, 0, "stage");
  assertSame((await buildos(["extract", "bulk", "--root", dir, "decide", "REF-001", "--reviewer", "Branch Supervisor"], dir, { stdin: fixtureFile("bulk-extract", "approve-two.json") })).exit, 0, "decide");
  return dir;
}

const intentOf = (dir: string): Record<string, unknown> | undefined => readJson(join(dir, ...REVIEW.split("/")))["publication"] as Record<string, unknown> | undefined;
/** The capability ID the pending publication gave its minted capability. */
const plannedCapability = (dir: string): string => {
  const files = intentOf(dir)!["files"] as Record<string, { operations: { append: { id: string }[] } }>;
  return files[CAPS]!.operations.append[0]!.id;
};
const rowsWithId = (dir: string, id: string): number => readFileSync(join(dir, ...CAPS.split("/")), "utf8").split("\n").filter((line) => line.trim() !== "" && (JSON.parse(line) as { id?: string }).id === id).length;
/** Appends a capability row the publication does not know (a copy of the first row with another ID and title). */
function appendUnrelated(dir: string, id = "CAP-900"): void {
  const path = join(dir, ...CAPS.split("/"));
  const text = readFileSync(path, "utf8");
  const row = JSON.parse(text.split("\n").find((line) => line.trim() !== "")!) as Record<string, unknown>;
  row["id"] = id;
  row["title"] = "Branch hours board";
  appendFileSync(path, `${text.endsWith("\n") ? "" : "\n"}${JSON.stringify(row)}\n`);
}

/** An interrupted publication: capabilities.jsonl written, requirements.jsonl put back, the intent kept (exit 10). */
async function capabilitiesWritten(dir: string): Promise<void> {
  const { factory } = instrumented((method, path, n) => (method === "writeFileAtomic" && path === ".os/data/requirements.jsonl" && n <= 2 ? "after" : false));
  assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory })).exit, 10, "the interrupted publication");
  assertSame(rowsWithId(dir, plannedCapability(dir)), 1, "the publication's capability is in the file");
}

/** An interrupted publication: no data file written, the intent kept (exit 10). */
async function nothingWritten(dir: string): Promise<void> {
  const { factory } = instrumented((method, path, n) => method === "writeFileAtomic" && ((path === CAPS && n === 1) || (path === REVIEW && n === 2)));
  assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory })).exit, 10, "the interrupted publication");
  assertSame(typeof intentOf(dir), "object", "the intent stays");
}

describe("P9-F-02: a pending publication over a data file that changed since it started (divergence SD-22)", () => {
  it("the reviewer's case: a row written, an unrelated row appended, the owner retired: no withdrawal is offered; after the config is restored the row is there once", async () => {
    const dir = await ownedAndApproved();
    await capabilitiesWritten(dir);
    const id = plannedCapability(dir);
    appendUnrelated(dir);
    writeFileSync(configPath(dir), CONFIG(["front-desk"]));
    const before = tree(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, `${CAPS} already holds rows of it`);
    assertIncludes(r.stderr, 'do not delete the "publication" entry');
    assert.ok(!r.stderr.includes("by hand; the approved rows stay staged"), "no withdrawal step");
    assertSameTree(tree(dir), before, "project after the refusal");
    writeFileSync(configPath(dir), CONFIG(["front-desk", "circulation-desk"]));
    const finished = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(finished.exit, 0, "publish after the config is restored");
    assertSame(rowsWithId(dir, id), 1, "copies of the publication's capability");
    assertSame(rowsWithId(dir, "CAP-900"), 1, "the unrelated row stays");
    assertIncludes((await buildos(["extract", "bulk", "--root", dir, "check", "REF-001"], dir)).stdout, "REF-001: complete");
  });

  it("unrelated append, the row present: resume completes with exactly one copy", async () => {
    const dir = await ownedAndApproved();
    await capabilitiesWritten(dir);
    const id = plannedCapability(dir);
    appendUnrelated(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 0, "exit");
    assertSame(rowsWithId(dir, id), 1, "copies of the publication's capability");
    assertSame(rowsWithId(dir, "CAP-900"), 1, "the unrelated row stays");
    assertSame((readFileSync(join(dir, ".os", "data", "requirements.jsonl"), "utf8").match(/"Renewal rule a"/g) ?? []).length, 1, "copies of the minted requirement");
  });

  it("unrelated append, the row absent: resume applies it once", async () => {
    const dir = await ownedAndApproved();
    await nothingWritten(dir);
    const id = plannedCapability(dir);
    assertSame(rowsWithId(dir, id), 0, "the row is not there yet");
    appendUnrelated(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 0, "exit");
    assertSame(rowsWithId(dir, id), 1, "copies of the publication's capability");
    assertSame(rowsWithId(dir, "CAP-900"), 1, "the unrelated row stays");
    assertSame(intentOf(dir), undefined, "no intent");
  });

  it("unrelated append, the row absent, the owner retired: withdrawal is not offered (the file is not as it was before)", async () => {
    const dir = await ownedAndApproved();
    await nothingWritten(dir);
    appendUnrelated(dir);
    writeFileSync(configPath(dir), CONFIG(["front-desk"]));
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, `${CAPS} changed since the publication started`);
    assert.ok(!r.stderr.includes("by hand; the approved rows stay staged"), "no withdrawal step");
  });

  it("a row with the publication's ID that is not its row: a conflict (exit 10, nothing written, the intent kept), with steps that never duplicate a row", async () => {
    const dir = await ownedAndApproved();
    await nothingWritten(dir);
    const id = plannedCapability(dir);
    appendUnrelated(dir, id);
    const before = tree(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir);
    assertSame(r.exit, 10, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    const diagnostic = (envelopeOf(r)["diagnostics"] as { code: string; message: string }[])[0]!;
    assertSame(diagnostic.code, "needs_operator_review", "code");
    assertIncludes(diagnostic.message, `${CAPS} (rows ${id}`);
    assertIncludes(diagnostic.message, "BuildOS cannot tell whether the publication's rows are in it");
    assertIncludes(diagnostic.message, 'Do not delete the "publication" entry');
    assertSameTree(tree(dir), before, "project after the stop");
    // The safe step: remove the rows with that ID by hand, then publish again: the row is written once, with its ID.
    const path = join(dir, ...CAPS.split("/"));
    writeFileSync(path, readFileSync(path, "utf8").split("\n").filter((line) => line.trim() === "" || (JSON.parse(line) as { id?: string }).id !== id).join("\n"));
    assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir)).exit, 0, "publish after the repair");
    assertSame(rowsWithId(dir, id), 1, "copies of the publication's capability");
  });
});

// ---------------------------------------------------------------- P9-F-03

describe("P9-F-03: the workbook stops when a score-driving model field changed after the merge (divergence SD-18)", () => {
  it("a capability's maturity proven -> planned: exit 4, the capability named, no workbook; a new merge builds it", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const modelPath = join(dir, "deliver", "CIRC", "circ-capability-model.json");
    const model = readJson(modelPath) as { capabilities: { id: string; maturity: string }[] };
    const cap = model.capabilities.find((c) => c.maturity === "proven")!;
    cap.maturity = "planned";
    writeFileSync(modelPath, JSON.stringify(model, null, 1));
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", "analysis/frame.json", "--fitgap", fitgap], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, `the maturity of baseline capability changed since the merge: ${cap.id} (merged as proven, now planned)`);
    assertIncludes(r.stderr, "Run merge again.");
    assertSame(existsSync(join(dir, "out", "circ-lib-fit-gap-analysis.xlsx")), false, "no workbook");
    await merged(dir);
    assertSame((await buildos(["fitgap", "--root", dir, "workbook", "--frame", "analysis/frame.json", "--fitgap", fitgap], dir)).exit, 0, "workbook after a new merge");
  });
});

// ---------------------------------------------------------------- P9-F-04

/** A frame whose baseline model is the fixture model changed by `change`. */
function changedModel(dir: string, name: string, change: (caps: { id: string; requirements: { id: string; text: string }[] }[]) => void): string {
  const model = readJson(join(dir, "deliver", "CIRC", "circ-capability-model.json")) as { capabilities: { id: string; requirements: { id: string; text: string }[] }[] };
  change(model.capabilities);
  writeFileSync(join(dir, "deliver", "CIRC", `${name}.json`), JSON.stringify(model, null, 1));
  return frameWith(dir, `frame-${name}.json`, (frame) => {
    frame["baseline"] = { model: `../deliver/CIRC/${name}.json` };
  });
}

describe("P9-F-04: a requirement ID used twice in one capability is refused by every command that loads a model (divergence SD-21)", () => {
  it("frame, packages, uncited, merge, and workbook: exit 4, the capability and the repeated ID named", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const frame = changedModel(dir, "circ-copied-id", (caps) => {
      const first = caps.find((c) => c.requirements.length > 0)!;
      first.requirements.push({ ...first.requirements[0]!, text: "Scan a library card from a phone." });
    });
    const runs: [string, string[]][] = [
      ["frame", ["frame", "--frame", frame]],
      ["packages", ["packages", "--frame", frame, "--out", "work"]],
      ["merge", ["merge", "--frame", frame, "--rows", "analysis/scored/*.json", "--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json", "--out", "out2"]],
      ["workbook", ["workbook", "--frame", frame, "--fitgap", fitgap]],
    ];
    for (const [name, args] of runs) {
      const r = await buildos(["fitgap", "--root", dir, ...args], dir);
      assertSame(r.exit, 4, `${name} exit`);
      assertIncludes(r.stderr, "fitgap: baseline CIRC-COR-01: the requirement id 'CIRC-COR-01-R01' is used more than once in this capability");
    }
    assertSame(existsSync(join(dir, "work")) || existsSync(join(dir, "out2")), false, "nothing written");
    // uncited loads only the target model (as the script): a copied ID there stops it the same way.
    const target = readJson(join(dir, "deliver", "LIB", "lib-capability-model.json")) as { capabilities: { requirements?: { id: string; text: string }[] }[] };
    const withReqs = target.capabilities.find((c) => (c.requirements ?? []).length > 0)!;
    withReqs.requirements!.push({ ...withReqs.requirements![0]!, text: "Renew a loan from the catalogue page." });
    writeFileSync(join(dir, "deliver", "LIB", "lib-copied-id.json"), JSON.stringify(target, null, 1));
    const targetFrame = frameWith(dir, "frame-lib-copied-id.json", (f) => {
      f["target"] = { model: "../deliver/LIB/lib-copied-id.json" };
    });
    for (const args of [["frame", "--frame", targetFrame], ["uncited", "--frame", targetFrame, "--rows", "analysis/scored/*.json"]]) {
      const r = await buildos(["fitgap", "--root", dir, ...args], dir);
      assertSame(r.exit, 4, `${args[0]} exit (target)`);
      assertIncludes(r.stderr, "fitgap: target LIB-COR-01: the requirement id 'LIB-COR-01-R01' is used more than once in this capability");
    }
  });

  it("the same requirement ID under two different capabilities is valid (IDs are scoped to their capability, as in the script)", async () => {
    const dir = project("fitgap", "library");
    const frame = changedModel(dir, "circ-shared-id", (caps) => {
      const [a, b] = caps.filter((c) => c.requirements.length > 0);
      b!.requirements[0]!.id = a!.requirements[0]!.id;
    });
    const r = await buildos(["fitgap", "--root", dir, "frame", "--frame", frame], dir);
    assertSame(r.exit, 0, "frame exit");
  });
});

// ---------------------------------------------------------------- P9-F-05

/** CONFIG with `extra` more systems that have no description: each is one finding of validate that does not concern owners. */
function configWithFindings(owners: string[], extra: number): string {
  const lines = CONFIG(owners).split("\n");
  const at = lines.indexOf("environments:");
  const systems = Array.from({ length: extra }, (_, i) => [`  - id: branch-system-${i + 1}`, `    name: Branch system ${i + 1}`]).flat();
  return [...lines.slice(0, at - 1), ...systems, ...lines.slice(at - 1)].join("\n");
}

describe("P9-F-05: extract bulk builds the same complete config index as buildos validate", () => {
  it("20 config findings that do not concern owners: publish accepts the owner; validate then reports those findings and none on the rows", async () => {
    const dir = await ownedAndApproved();
    writeFileSync(configPath(dir), configWithFindings(["front-desk", "circulation-desk"], 20));
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 0, "publish exit");
    const validated = envelopeOf(await buildos(["validate", "--root", dir, "--json"], dir));
    const findings = ((validated["result"] as { findings?: { code: string; path: string }[] }).findings ?? []) as { code: string; path: string }[];
    assertSame(findings.filter((f) => f.path === ".os/config/instance.yaml" && f.code === "required").length, 20, "config findings");
    assertSame(findings.filter((f) => f.path.startsWith(".os/data/")).length, 0, "row findings");
  });

  it("agreement: with those 20 findings, a retired owner is refused by both bulk and validate", async () => {
    const dir = await ownedAndApproved();
    writeFileSync(configPath(dir), configWithFindings(["front-desk"], 20));
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 4, "publish exit");
    assertIncludes(r.stderr, "unknown_id at owners[0]");
  });
});

// ---------------------------------------------------------------- P9-F-06

describe("P9-F-06: a config that cannot be read as text stops decide, also a withdrawal", () => {
  it("a non-UTF-8 byte in the config: decide pending exits 4 with validate's finding, nothing written", async () => {
    const dir = await ownedAndApproved();
    appendFileSync(configPath(dir), Buffer.from([0x23, 0x20, 0x63, 0x61, 0x66, 0xe9, 0x0a]));
    const before = tree(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "decide", "REF-001", "--reviewer", "Branch Supervisor"], dir, { stdin: JSON.stringify([{ key: "renewals", review_state: "pending" }]) });
    assertSame(r.exit, 4, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertIncludes((envelopeOf(r)["diagnostics"] as { message: string }[])[0]!.message, "not_utf8");
    assertSameTree(tree(dir), before, "project after the refusal");
  });

  it("a readable config that retired the owner still lets the withdrawal through (P9-R2-05)", async () => {
    const dir = await ownedAndApproved();
    writeFileSync(configPath(dir), CONFIG(["front-desk"]));
    const r = await buildos(["extract", "bulk", "--root", dir, "decide", "REF-001", "--reviewer", "Branch Supervisor"], dir, { stdin: JSON.stringify([{ key: "renewals", review_state: "pending" }]) });
    assertSame(r.exit, 0, "exit");
  });
});

// ---------------------------------------------------------------- P9-F-07

describe("P9-F-07: after an incomplete undo, publish describes the review as it is on disk", () => {
  it("the review put back as it was (no intent, no row published): it says so, not 'still holds the pending publication'", async () => {
    const dir = await ownedAndApproved();
    const { factory } = instrumented((method, path, n) => method === "writeFileAtomic" && ((path === ".os/data/extractions.jsonl" && n === 1) || (path === REVIEW && n === 2)) && "after");
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertSame(intentOf(dir), undefined, "no intent on disk");
    assertIncludes(r.stderr, `The review ${REVIEW} holds no pending publication, and none of its rows is published`);
    assert.ok(!r.stderr.includes("still holds the pending publication"), "no claim of a pending publication");
  });

  it("the review complete (no intent, every row published): it says so", async () => {
    const dir = await ownedAndApproved();
    const { factory } = instrumented((method, path, n) => method === "writeFileAtomic" && path === REVIEW && (n === 2 ? "after" : n === 3));
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertSame(intentOf(dir), undefined, "no intent on disk");
    assertIncludes(r.stderr, "shows the publication as complete: all 2 rows are published as");
  });

  it("the review still holds the intent: it says so", async () => {
    const dir = await ownedAndApproved();
    const { factory } = instrumented((method, path, n) => (method === "writeFileAtomic" && path === ".os/data/requirements.jsonl" && n <= 2 ? "after" : false));
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertSame(typeof intentOf(dir), "object", "the intent on disk");
    assertIncludes(r.stderr, `The review ${REVIEW} still holds the pending publication`);
  });

  it("a review BuildOS cannot read after the failure: the state is uncertain, with the command that shows it", async () => {
    const dir = await ownedAndApproved();
    let failed = false;
    const { factory } = instrumented((method, path, n) => {
      if (method === "writeFileAtomic" && path === ".os/data/requirements.jsonl" && n <= 2) {
        failed = true;
        return "after";
      }
      return failed && method === "readFileLimited" && path === REVIEW;
    });
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertIncludes(r.stderr, `BuildOS cannot tell what the review ${REVIEW} holds now. Run buildos extract bulk check REF-001`);
  });
});

// ---------------------------------------------------------------- P9-F-08

describe("P9-F-08: a project folder that is a link to an outside folder, with and without --allow-outside-root", () => {
  const linked = (script: "fitgap" | "azure-boards", base: string): { dir: string; outside: string } => {
    const dir = project(script, base);
    const outside = join(dir, "..", "shared-exports");
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(dir, "exports"), linkKind);
    return { dir, outside };
  };

  it("export azure-boards template: refused without the switch (exit 3, the switch named); written through the link with it", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const { dir, outside } = linked("azure-boards", "project");
    const refused = await buildos(["export", "azure-boards", "--root", dir, "template", "--output", "exports/t.csv"], dir);
    assertSame(refused.exit, 3, "exit without the switch");
    assertIncludes(refused.stderr, "Pass --allow-outside-root");
    assertSame(readdirSync(outside).length, 0, "nothing written outside");
    const allowed = await buildos(["export", "azure-boards", "--root", dir, "--allow-outside-root", "template", "--output", "exports/t.csv"], dir);
    assertSame(allowed.exit, 0, "exit with the switch");
    assertSame(readdirSync(outside).join(","), "t.csv", "the file in the outside folder");
    assertSame(readFileSync(join(outside, "t.csv"), "utf8") === "", false, "the file has content");
  });

  it("fitgap packages: refused without the switch (exit 3); written through the link with it, and a rerun replaces its own packages", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const { dir, outside } = linked("fitgap", "library");
    const refused = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", "exports/work"], dir);
    assertSame(refused.exit, 3, "exit without the switch");
    assertIncludes(refused.stderr, "Pass --allow-outside-root");
    assertSame(readdirSync(outside).length, 0, "nothing written outside");
    const allowed = await buildos(["fitgap", "--root", dir, "--allow-outside-root", "packages", "--frame", "analysis/frame.json", "--out", "exports/work"], dir);
    assertSame(allowed.exit, 0, "exit with the switch");
    assertSame(existsSync(join(outside, "work", "packages", "pkg-01.json")), true, "pkg-01.json in the outside folder");
    const again = await buildos(["fitgap", "--root", dir, "--allow-outside-root", "packages", "--frame", "analysis/frame.json", "--out", "exports/work"], dir);
    assertSame(again.exit, 0, "rerun exit");
    assertSame(again.stderr, "", "no kept file on the rerun");
  });

  it("a content read through the same link stays refused with the switch (exit 3)", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const { dir, outside } = linked("azure-boards", "project");
    writeFileSync(join(outside, "in.json"), readFileSync(join(dir, "backlog", "holds.json")));
    const r = await buildos(["export", "azure-boards", "--root", dir, "--allow-outside-root", "emit", "--input", "exports/in.json", "--output", "out/x.csv"], dir);
    assertSame(r.exit, 3, "exit");
    assert.ok(!r.stderr.includes("Pass --allow-outside-root"), "the read refusal does not offer the write switch");
  });
});

void treeOf;
