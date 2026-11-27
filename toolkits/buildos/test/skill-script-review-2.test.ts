// W1 R7 P9 review round 2: one test (or more) per finding P9-R2-01 to
// P9-R2-13, each failing without its fix. Write faults are injected before a
// port call and after it took effect (the rename done, then the folder flush
// fails), as the reviewer asked. Divergences from the scripts are recorded in
// test/golden/skills/divergences.json. Every input is invented (the library
// book-lending topic). Failures print counts, tags, and sizes only
// (test-output-safety.test.ts).

import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { writeRaceHooks } from "../src/adapters/node-fs.ts";
import { fnmatchRegex } from "../src/core/fitgap/fitgap.ts";
import { assertIncludes, assertSame, assertSameTree } from "./helpers.ts";
import { buildos, canLink, CONFIG, envelopeOf, fixtureFile, frameWith, instrumented, merged, ownedReview, posixPermissions, project, stagedAndDecided, tree } from "./skill-script-support.ts";

afterEach(() => {
  delete writeRaceHooks.beforeStep;
  delete writeRaceHooks.beforeOpen;
});

const REVIEW = "extractions/REF-001-lending-policy.json";
const LOCK = "extractions/staging/.buildos-extract-bulk-stage.lock";
type Left = { path: string; reason: string; state: string };
const notRestored = (r: Parameters<typeof envelopeOf>[0]): Left[] => ((envelopeOf(r)["result"] as { not_restored?: Left[] } | null)?.not_restored ?? []);
const copies = (dir: string): number => (readFileSync(join(dir, ".os", "data", "requirements.jsonl"), "utf8").match(/"Renewal rule a"/g) ?? []).length;
/** The project tree without the staging folder entry the lock made (it stays only when it holds something). */
const treeOf = (dir: string): Map<string, string> => {
  const t = tree(dir);
  t.delete("extractions/staging/");
  return t;
};

// ---------------------------------------------------------------- P9-R2-01

describe("P9-R2-01: a bulk write that took effect before a later part of it failed is undone, and publish stays idempotent", () => {
  it("publish: requirements.jsonl renamed into place, then the folder flush fails: undone (exit 5, not_requested); the retry writes one copy", async () => {
    const dir = project("bulk-extract", "library");
    await stagedAndDecided(dir);
    const before = treeOf(dir);
    const { factory } = instrumented((method, path, n) => (method === "writeFileAtomic" && path === ".os/data/requirements.jsonl" && n === 1 ? "after" : false));
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 5, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertIncludes((envelopeOf(r)["diagnostics"] as { message: string }[])[0]!.message, "BuildOS put back every file it had changed");
    assertSameTree(treeOf(dir), before, "project after the undone publication");
    const retry = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(retry.exit, 0, "retry exit");
    assertSame(copies(dir), 1, "copies of the minted requirement");
    assertIncludes((await buildos(["extract", "bulk", "--root", dir, "check", "REF-001"], dir)).stdout, "REF-001: complete");
  });

  it("publish: the undo of that file also fails after its rename: the intent stays (exit 10, partially_applied, exact paths); the retry finishes with one copy", async () => {
    const dir = project("bulk-extract", "library");
    await stagedAndDecided(dir);
    const { factory } = instrumented((method, path, n) => (method === "writeFileAtomic" && path === ".os/data/requirements.jsonl" && n <= 2 ? "after" : false));
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertSame(envelopeOf(r)["write_status"], "partially_applied", "write_status");
    const left = notRestored(r);
    assertSame(left.find((item) => item.path === ".os/data/requirements.jsonl")?.state, "unsure", "requirements.jsonl state");
    assertSame(left.find((item) => item.path === REVIEW)?.state, "left", "review state");
    assertSame(left.find((item) => item.path === ".os/data/capabilities.jsonl")?.state, "left", "capabilities state");
    const review = JSON.parse(readFileSync(join(dir, ...REVIEW.split("/")), "utf8")) as Record<string, unknown>;
    assertSame(typeof review["publication"], "object", "the publication intent stays in the review");
    const human = await buildos(["extract", "bulk", "--root", dir, "status"], dir);
    assertIncludes(human.stdout, "publishing: 1");
    const retry = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(retry.exit, 0, "retry exit");
    assertSame(copies(dir), 1, "copies of the minted requirement");
    assertIncludes((await buildos(["extract", "bulk", "--root", dir, "check", "REF-001"], dir)).stdout, "REF-001: complete");
  });

  it("publish: the final review write fails after its rename: every step is undone (exit 5); the retry writes one copy", async () => {
    const dir = project("bulk-extract", "library");
    await stagedAndDecided(dir);
    const before = treeOf(dir);
    const { factory } = instrumented((method, path, n) => (method === "writeFileAtomic" && path === REVIEW && n === 2 ? "after" : false));
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 5, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertSameTree(treeOf(dir), before, "project after the undone publication");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir)).exit, 0, "retry exit");
    assertSame(copies(dir), 1, "copies of the minted requirement");
  });

  it("publish with the real adapter: the folder flush after the rename of requirements.jsonl fails once (POSIX)", { skip: process.platform === "win32" ? "Windows has no folder flush (PE-005)" : false }, async () => {
    const dir = project("bulk-extract", "library");
    await stagedAndDecided(dir);
    const before = treeOf(dir);
    let failed = 0;
    writeRaceHooks.beforeStep = (step, entry) => {
      if (step === "sync-parent" && entry.endsWith("requirements.jsonl") && failed === 0) {
        failed++;
        throw Object.assign(new Error("EIO: i/o error, fsync"), { code: "EIO", syscall: "fsync" });
      }
    };
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir);
    delete writeRaceHooks.beforeStep;
    assertSame(failed, 1, "the flush failed once");
    assertSame(r.exit, 5, "exit");
    assertSameTree(treeOf(dir), before, "project after the undone publication");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir)).exit, 0, "retry exit");
    assertSame(copies(dir), 1, "copies of the minted requirement");
  });

  for (const [name, args, method, path, stdin] of [
    ["start", ["start", "REF-001"], "writeNewFile", REVIEW, undefined],
    ["stage", ["stage", "REF-001"], "writeFileAtomic", "extractions/staging/requirements.jsonl", undefined],
    ["stage-update", ["stage-update", "REF-001", "REQ-001", "--key", "copy"], "writeFileAtomic", REVIEW, undefined],
    ["decide", ["decide", "REF-001", "--reviewer", "Branch Supervisor"], "writeFileAtomic", "extractions/staging/requirements.jsonl", "approve-two.json"],
    ["replace-row", ["replace-row", "REF-001", "holds-desk"], "writeFileAtomic", "extractions/staging/capabilities.jsonl", "replacement-row.json"],
  ] as [string, string[], string, string, string | undefined][]) {
    it(`${name}: a write that took effect, then failed, is undone (exit 5, the project as it was)`, async () => {
      const dir = project("bulk-extract", "library");
      if (name !== "start") {
        assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
        writeFileSync(join(dir, ...REVIEW.split("/")), fixtureFile("bulk-extract", "full-flow-review.json"));
      }
      if (name === "decide" || name === "replace-row") assertSame((await buildos(["extract", "bulk", "--root", dir, "stage", "REF-001"], dir)).exit, 0, "stage");
      const stdinText = stdin === undefined ? undefined : stdin === "replacement-row.json" ? replacementRow(dir) : fixtureFile("bulk-extract", stdin);
      const before = treeOf(dir);
      const { factory, calls } = instrumented((m, p, n) => (m === method && p === path && n === 1 ? "after" : false));
      const r = await buildos(["extract", "bulk", "--root", dir, "--json", ...args], dir, { openFs: factory, ...(stdinText === undefined ? {} : { stdin: stdinText }) });
      assert.ok(calls.some((c) => c.method === method && c.path === path), "the injected call ran");
      assertSame(r.exit, 5, "exit");
      assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
      assertSameTree(treeOf(dir), before, "project after the undone write");
    });
  }
});

/** A replacement for the staged row `holds-desk`: the staged row itself, without its `_stage` block, with a new statement. */
function replacementRow(dir: string): string {
  const lines = readFileSync(join(dir, "extractions", "staging", "capabilities.jsonl"), "utf8").split("\n").filter((l) => l.trim() !== "");
  for (const line of lines) {
    const row = JSON.parse(line) as Record<string, unknown>;
    const meta = row["_stage"] as Record<string, unknown>;
    if (meta["key"] === "holds-desk") {
      delete row["_stage"];
      row["summary"] = "Staff keep holds on a shelf for one week.";
      return JSON.stringify(row);
    }
  }
  throw new Error("no staged row holds-desk");
}

// ---------------------------------------------------------------- P9-R2-08

describe("P9-R2-08: lock errors are classified by what happened", () => {
  it("a real I/O error creating the lock is a write error at the lock path (exit 5), not another writer", async () => {
    const dir = project("bulk-extract", "library");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    const { factory } = instrumented((method, path) => method === "writeNewFile" && path === LOCK);
    const r = await buildos(["extract", "bulk", "--root", dir, "stage-update", "REF-001", "REQ-001", "--key", "copy"], dir, { openFs: factory });
    assertSame(r.exit, 5, "exit");
    assertIncludes(r.stderr, ".buildos-extract-bulk-stage.lock");
    assert.ok(!r.stderr.includes("Another staged write is active"), "not blamed on another writer");
  });

  it("a lock file that cannot be removed after a complete write is named (exit 10, partially_applied); the write itself stays", async () => {
    const dir = project("bulk-extract", "library");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    const { factory } = instrumented((method, path) => method === "remove" && path === LOCK);
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "stage-update", "REF-001", "REQ-001", "--key", "copy"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertSame(envelopeOf(r)["write_status"], "partially_applied", "write_status");
    assertSame(notRestored(r).map((item) => item.path).join(","), LOCK, "not_restored");
    assertIncludes(readFileSync(join(dir, ...REVIEW.split("/")), "utf8"), '"key": "copy"');
    assertSame(existsSync(join(dir, ...LOCK.split("/"))), true, "the lock file stays");
    const human = await buildos(["extract", "bulk", "--root", dir, "stage-update", "REF-001", "REQ-001", "--key", "copy-2"], dir, { openFs: instrumented((method, path) => method === "remove" && path === LOCK).factory });
    assertSame(human.exit, 4, "the next command stops on the lock");
  });

  it("human output names the lock file that stays", async () => {
    const dir = project("bulk-extract", "library");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    const { factory } = instrumented((method, path) => method === "remove" && path === LOCK);
    const r = await buildos(["extract", "bulk", "--root", dir, "stage-update", "REF-001", "REQ-001", "--key", "copy"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertIncludes(r.stdout, "Copied REQ-001");
    assertIncludes(r.stderr, `could not remove its lock file ${LOCK}`);
  });
});


// ---------------------------------------------------------------- P9-R2-04, P9-R2-05, P9-R2-11

const configPath = (dir: string): string => join(dir, ".os", "config", "instance.yaml");

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

const pendingIntent = (dir: string): boolean => typeof (JSON.parse(readFileSync(join(dir, ...REVIEW.split("/")), "utf8")) as Record<string, unknown>)["publication"] === "object";

describe("P9-R2-04: a pending publication is finished only when its rows pass buildos validate with the current config", () => {
  it("no data file written yet: the owner is retired, publish refuses (exit 4), keeps the intent, and says how to go on", async () => {
    const dir = await ownedAndApproved();
    // The first data write fails before it acts, and putting the review back fails: the intent stays and no data file changed.
    const { factory } = instrumented((method, path, n) => method === "writeFileAtomic" && ((path === ".os/data/capabilities.jsonl" && n === 1) || (path === REVIEW && n === 2)));
    assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory })).exit, 10, "the interrupted publication");
    assertSame(pendingIntent(dir), true, "the intent stays");
    writeFileSync(configPath(dir), CONFIG(["front-desk"]));
    const before = tree(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, "would write rows that do not pass buildos validate with the config as it is now");
    assertIncludes(r.stderr, "unknown_id at owners[0]");
    assertIncludes(r.stderr, `delete the "publication" entry from ${REVIEW} by hand`);
    assertSameTree(tree(dir), before, "project after the refusal");
    writeFileSync(configPath(dir), CONFIG(["front-desk", "circulation-desk"]));
    const finished = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(finished.exit, 0, "publish after the config is restored");
    assertSame(copies(dir), 1, "copies of the minted requirement");
  });

  it("a data file already holds part of it: the refusal says to restore the config and finish", async () => {
    const dir = await ownedAndApproved();
    const { factory } = instrumented((method, path, n) => (method === "writeFileAtomic" && path === ".os/data/requirements.jsonl" && n <= 2 ? "after" : false));
    assertSame((await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir, { openFs: factory })).exit, 10, "the interrupted publication");
    writeFileSync(configPath(dir), CONFIG(["front-desk"]));
    const r = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, ".os/data/capabilities.jsonl already holds rows of it");
    assertSame(pendingIntent(dir), true, "the intent stays");
  });
});

describe("P9-R2-05: a reviewer can withdraw an approval and repair the row after its owner is retired", () => {
  it("decide resets the approval, replace-row fixes the row, decide approves it, publish passes", async () => {
    const dir = await ownedAndApproved();
    writeFileSync(configPath(dir), CONFIG(["front-desk"]));
    const bulk = (args: string[], stdin?: string) => buildos(["extract", "bulk", "--root", dir, ...args], dir, stdin === undefined ? {} : { stdin });
    assertSame((await bulk(["publish", "REF-001"])).exit, 4, "publish with the retired owner");
    const blocked = await bulk(["replace-row", "REF-001", "renewals"], "{}");
    assertSame(blocked.exit, 4, "replace-row of an approved row");
    assertIncludes(blocked.stderr, "Reset an approved decision before changing its row");
    const approveAgain = await bulk(["decide", "REF-001", "--reviewer", "Branch Supervisor"], JSON.stringify([{ key: "renewals", review_state: "approved" }]));
    assertSame(approveAgain.exit, 4, "an approval still needs a row that passes");
    const reset = await bulk(["decide", "REF-001", "--reviewer", "Branch Supervisor"], JSON.stringify([{ key: "renewals", review_state: "pending" }]));
    assertSame(reset.exit, 0, "decide that withdraws the approval");
    const staged = readFileSync(join(dir, "extractions", "staging", "requirements.jsonl"), "utf8").split("\n").find((line) => line.includes('"renewals"'))!;
    const row = JSON.parse(staged) as Record<string, unknown>;
    delete row["_stage"];
    row["owners"] = ["front-desk"];
    assertSame((await bulk(["replace-row", "REF-001", "renewals"], JSON.stringify(row))).exit, 0, "replace-row with a valid owner");
    assertSame((await bulk(["decide", "REF-001", "--reviewer", "Branch Supervisor"], JSON.stringify([{ key: "renewals", review_state: "approved" }]))).exit, 0, "approve the fixed row");
    const published = await bulk(["publish", "REF-001"]);
    assertSame(published.exit, 0, "publish");
    assertIncludes(readFileSync(join(dir, ".os", "data", "requirements.jsonl"), "utf8"), '"owners": ["front-desk"]');
  });
});

describe("P9-R2-11: extract bulk reads the config with buildos validate's reader", () => {
  it("a non-UTF-8 byte in a config comment stops stage with validate's finding (exit 4), as validate rejects it", async () => {
    const dir = project("bulk-extract", "library");
    mkdirSync(join(dir, ".os", "config"), { recursive: true });
    writeFileSync(configPath(dir), Buffer.concat([Buffer.from(CONFIG(["front-desk", "circulation-desk"])), Buffer.from([0x23, 0x20, 0x63, 0x61, 0x66, 0xe9, 0x0a])]));
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    writeFileSync(join(dir, ...REVIEW.split("/")), ownedReview());
    const before = tree(dir);
    const r = await buildos(["extract", "bulk", "--root", dir, "stage", "REF-001"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, ".os/config/instance.yaml would not pass buildos validate");
    assertIncludes(r.stderr, "not_utf8");
    assertSameTree(tree(dir), before, "project after the refusal");
    const validated = await buildos(["validate", "--root", dir, "--json"], dir);
    assertIncludes(validated.stdout, '"not_utf8"');
  });
});

// ---------------------------------------------------------------- P9-R2-02

const STALE_PACKAGE = JSON.stringify([{ id: "OLD", name: "Old", layer_code: "L", layer_name: "Layer", type: "t", status: "s", maturity: "m", summary: "", requirements: [{ id: "R", kind: "k", status: "s", text: "", option_values: [] }] }], null, 1);

describe("P9-R2-02: fitgap packages deletes only its own earlier package files (divergence SD-20)", () => {
  for (const outside of [false, true]) {
    it(`${outside ? "an authorized folder outside the project" : "inside the project"}: a user's pkg-review-notes.json, a hand-made pkg-08.json, and a link stay and are named; a stale generated pkg-07.json goes`, { skip: canLink ? false : "symbolic links are not available" }, async () => {
      const dir = project("fitgap", "library");
      const out = outside ? join(dir, "..", "outside-work") : join(dir, "work");
      mkdirSync(join(out, "packages"), { recursive: true });
      writeFileSync(join(out, "packages", "pkg-review-notes.json"), '{"notes": "keep me"}');
      writeFileSync(join(out, "packages", "pkg-07.json"), STALE_PACKAGE);
      writeFileSync(join(out, "packages", "pkg-08.json"), '[{"id": "MINE"}]');
      writeFileSync(join(out, "linked.json"), STALE_PACKAGE);
      symlinkSync(join(out, "linked.json"), join(out, "packages", "pkg-09.json"), "file");
      const r = await buildos(["fitgap", "--root", dir, "--json", "packages", "--frame", "analysis/frame.json", "--out", outside ? out : "work", ...(outside ? ["--allow-outside-root"] : [])], dir);
      assertSame(r.exit, 0, "exit");
      const names = readdirSync(join(out, "packages")).sort();
      assertSame(names.includes("pkg-07.json"), false, "the stale generated package is gone");
      for (const kept of ["pkg-review-notes.json", "pkg-08.json", "pkg-09.json"]) assertSame(names.includes(kept), true, `${kept} stays`);
      assertSame(readFileSync(join(out, "packages", "pkg-review-notes.json"), "utf8"), '{"notes": "keep me"}', "the user's notes");
      const kept = ((envelopeOf(r)["result"] as { kept?: string[] }).kept ?? []).map((path) => path.slice(path.lastIndexOf("/") + 1)).sort();
      assertSame(kept.join(","), "pkg-08.json,pkg-09.json,pkg-review-notes.json", "result.kept");
    });
  }

  it("human output names each kept file with its reason", async () => {
    const dir = project("fitgap", "library");
    mkdirSync(join(dir, "work", "packages"), { recursive: true });
    writeFileSync(join(dir, "work", "packages", "pkg-review-notes.json"), "{}");
    const r = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", "work"], dir);
    assertSame(r.exit, 0, "exit");
    assertIncludes(r.stderr, "fitgap: kept work/packages/pkg-review-notes.json: its name is not one BuildOS writes");
  });
});

// ---------------------------------------------------------------- P9-R2-06

const notRoot = process.platform === "win32" || process.getuid?.() !== 0;

describe("P9-R2-06: a replaced output keeps its permission bits, and a read-only output is not replaced", () => {
  it("a 0600 CSV stays 0600 after export azure-boards template, and a fit-gap output keeps 0640 (POSIX)", { skip: posixPermissions ? false : "POSIX permissions only" }, async () => {
    const dir = project("azure-boards", "project");
    mkdirSync(join(dir, "out"), { recursive: true });
    writeFileSync(join(dir, "out", "t.csv"), "old");
    chmodSync(join(dir, "out", "t.csv"), 0o600);
    assertSame((await buildos(["export", "azure-boards", "--root", dir, "template", "--output", "out/t.csv"], dir)).exit, 0, "exit");
    assertSame(statSync(join(dir, "out", "t.csv")).mode & 0o7777, 0o600, "mode");
    assert.ok(readFileSync(join(dir, "out", "t.csv"), "utf8") !== "old", "the file was replaced");
    const fit = project("fitgap", "library");
    mkdirSync(join(fit, "work"), { recursive: true });
    writeFileSync(join(fit, "work", "objectives.md"), "old");
    chmodSync(join(fit, "work", "objectives.md"), 0o640);
    assertSame((await buildos(["fitgap", "--root", fit, "packages", "--frame", "analysis/frame.json", "--out", "work"], fit)).exit, 0, "fitgap exit");
    assertSame(statSync(join(fit, "work", "objectives.md")).mode & 0o7777, 0o640, "fitgap output mode");
  });

  it("a read-only CSV is not replaced (exit 5, the file and its mode as they were, no temporary file)", { skip: notRoot ? false : "root can write a read-only file" }, async () => {
    const dir = project("azure-boards", "project");
    mkdirSync(join(dir, "out"), { recursive: true });
    writeFileSync(join(dir, "out", "t.csv"), "old");
    chmodSync(join(dir, "out", "t.csv"), 0o444);
    const r = await buildos(["export", "azure-boards", "--root", dir, "--json", "template", "--output", "out/t.csv"], dir);
    chmodSync(join(dir, "out", "t.csv"), 0o644);
    assertSame(r.exit, 5, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertIncludes((envelopeOf(r)["diagnostics"] as { message: string }[])[0]!.message, "the file is read-only or permission is denied");
    assertSame(readFileSync(join(dir, "out", "t.csv"), "utf8"), "old", "content");
    assertSame(readdirSync(join(dir, "out")).join(","), "t.csv", "no temporary or backup file");
  });
});

// ---------------------------------------------------------------- P9-R2-07

describe("P9-R2-07: leftovers of the shared writer are reported with exact paths", () => {
  const template = (dir: string, options: Parameters<typeof buildos>[2], json = true) => buildos(["export", "azure-boards", "--root", dir, ...(json ? ["--json"] : []), "template", "--output", "out/t.csv"], dir, options);
  const withOld = (): string => {
    const dir = project("azure-boards", "project");
    mkdirSync(join(dir, "out"), { recursive: true });
    writeFileSync(join(dir, "out", "t.csv"), "old");
    return dir;
  };

  it("a failed restore of the backup: exit 10, partially_applied, the result names the backup that holds the earlier file", async () => {
    const dir = withOld();
    const { factory } = instrumented((method, path) => method === "rename" && (path.endsWith(".new") || path.endsWith(".backup")));
    const r = await template(dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    assertSame(envelopeOf(r)["write_status"], "partially_applied", "write_status");
    const left = notRestored(r);
    assertSame(left.length, 1, "one path not restored");
    assertSame(left[0]!.path, "out/t.csv", "path");
    const backup = readdirSync(join(dir, "out")).find((name) => name.endsWith(".backup"))!;
    assertIncludes(left[0]!.reason, `it is kept as out/${backup}`);
    assertSame(readFileSync(join(dir, "out", backup), "utf8"), "old", "the backup holds the earlier file");
    assertSame(existsSync(join(dir, "out", "t.csv")), false, "the destination is absent");
    assertSame(readdirSync(join(dir, "out")).some((name) => name.endsWith(".new")), false, "the temporary file was removed");
  });

  it("a backup that cannot be deleted after success: exit 0, applied, a warning and result.left_behind name it", async () => {
    const dir = withOld();
    const { factory } = instrumented((method, path) => method === "remove" && path.endsWith(".backup"));
    const r = await template(dir, { openFs: factory });
    assertSame(r.exit, 0, "exit");
    assertSame(envelopeOf(r)["write_status"], "applied", "write_status");
    const backup = readdirSync(join(dir, "out")).find((name) => name.endsWith(".backup"))!;
    const left = (envelopeOf(r)["result"] as { left_behind?: Left[] }).left_behind ?? [];
    assertSame(left.map((item) => item.path).join(","), `out/${backup}`, "result.left_behind");
    const warnings = (envelopeOf(r)["diagnostics"] as { code: string; severity: string }[]).filter((d) => d.code === "cleanup_incomplete" && d.severity === "warning");
    assertSame(warnings.length, 1, "warnings");
    const human = await template(withOld(), { openFs: instrumented((method, path) => method === "remove" && path.endsWith(".backup")).factory }, false);
    assertSame(human.exit, 0, "human exit");
    assertIncludes(human.stderr, ".backup (the earlier out/t.csv, kept under this backup name");
  });

  it("a temporary file created, then the write fails: removed (exit 5); when it cannot be removed it is named (exit 10)", async () => {
    const clean = withOld();
    const r = await template(clean, { openFs: instrumented((method, path) => (method === "writeNewFile" && path.endsWith(".new") ? "after" : false)).factory });
    assertSame(r.exit, 5, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertSame(readdirSync(join(clean, "out")).join(","), "t.csv", "nothing left");
    const dirty = withOld();
    const left = await template(dirty, { openFs: instrumented((method, path) => (method === "writeNewFile" && path.endsWith(".new") ? "after" : method === "remove" && path.endsWith(".new"))).factory });
    assertSame(left.exit, 10, "exit");
    assertSame(envelopeOf(left)["write_status"], "partially_applied", "write_status");
    const temp = readdirSync(join(dirty, "out")).find((name) => name.endsWith(".new"))!;
    assertSame(notRestored(left).map((item) => item.path).join(","), `out/${temp}`, "not_restored");
    assertSame(readFileSync(join(dirty, "out", "t.csv"), "utf8"), "old", "the destination as it was");
  });
});

// ---------------------------------------------------------------- P9-R2-12

/** Python 3.14.10 `re.compile(fnmatch.translate(pattern)).match(name)` for each pattern, over NAMES (recorded on macOS: case-sensitive). */
const NAMES: string[] = ["a", "b", "z", "A", "ab", "😀", "a😀", "😀😀", "]", "pkg-].json", "pkg-a.json", "pkg-01.json", "-", "!", "^", "\\", "&", "x&y", "[", "[a", "a[", "ä", "a-b", "~"];
const PYTHON_FNMATCH: Record<string, string[]> = {"?": ["a", "b", "z", "A", "😀", "]", "-", "!", "^", "\\", "&", "[", "ä", "~"], "??": ["ab", "a😀", "😀😀", "[a", "a["], "a?": ["ab", "a😀", "a["], "[]]": ["]"], "pkg-[]].json": ["pkg-].json"], "pkg-[!]].json": ["pkg-a.json"], "[z-a]": [], "[!z-a]": ["a", "b", "z", "A", "😀", "]", "-", "!", "^", "\\", "&", "[", "ä", "~"], "[!a]": ["b", "z", "A", "😀", "]", "-", "!", "^", "\\", "&", "[", "ä", "~"], "[!]": [], "[a-]": ["a", "-"], "[-a]": ["a", "-"], "[!]a]": ["b", "z", "A", "😀", "-", "!", "^", "\\", "&", "[", "ä", "~"], "[^a]": ["a", "^"], "[&]": ["&"], "[\\]": ["\\"], "[a-c-e]": ["a", "b", "-"], "*": ["a", "b", "z", "A", "ab", "😀", "a😀", "😀😀", "]", "pkg-].json", "pkg-a.json", "pkg-01.json", "-", "!", "^", "\\", "&", "x&y", "[", "[a", "a[", "ä", "a-b", "~"], "[": ["["], "[a": ["[a"], "a[": ["a["], "[]": [], "[!]]": ["a", "b", "z", "A", "😀", "-", "!", "^", "\\", "&", "[", "ä", "~"], "[a-z]": ["a", "b", "z"], "[😀]": ["😀"], "?😀": ["a😀", "😀😀"], "[%-&]": ["&"], "[--0]": ["-"], "[~]": ["~"], "pkg-[0-9][0-9].json": ["pkg-01.json"], "*[!a]*": ["b", "z", "A", "ab", "😀", "a😀", "😀😀", "]", "pkg-].json", "pkg-a.json", "pkg-01.json", "-", "!", "^", "\\", "&", "x&y", "[", "[a", "a[", "ä", "a-b", "~"], "[a-b-c]": ["a", "b", "-"], "[b-a-c]": ["-"], "[!-]": ["a", "b", "z", "A", "😀", "]", "!", "^", "\\", "&", "[", "ä", "~"]};

describe("P9-R2-12: glob patterns follow Python's fnmatch", () => {
  it(`${Object.keys(PYTHON_FNMATCH).length} patterns over ${NAMES.length} names match as Python's fnmatch.translate does (code-point ?, ] in a set, ! negation, reversed ranges)`, () => {
    const problems: string[] = [];
    for (const [pattern, want] of Object.entries(PYTHON_FNMATCH)) {
      let got: string[];
      try {
        const re = fnmatchRegex(pattern, false);
        got = NAMES.filter((name) => re.test(name));
      } catch (error) {
        problems.push(`pattern #${Object.keys(PYTHON_FNMATCH).indexOf(pattern)}: ${error instanceof Error ? error.name : "error"}`);
        continue;
      }
      if (got.join("\0") !== want.join("\0")) problems.push(`pattern #${Object.keys(PYTHON_FNMATCH).indexOf(pattern)}: ${got.length} matches, Python ${want.length}`);
    }
    assertSame(problems.length, 0, `fnmatch differences (${problems.join("; ")})`);
  });

  it("a pattern in --rows with a set holding ] and one with a reversed range expands as Python's glob", async () => {
    const dir = project("fitgap", "library");
    writeFileSync(join(dir, "analysis", "scored", "pkg-].json"), readFileSync(join(dir, "analysis", "scored", "pkg-01.json")));
    const r = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", "analysis/scored/pkg-[]].json"], dir);
    assertSame(r.exit, 0, "exit");
    assertIncludes(r.stdout, "uncited: 5 of 8 target capabilities", "the set with ] matched pkg-].json (Python: 5 of 8)");
    const reversed = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", "analysis/scored/pkg-0[2-1].json"], dir);
    assertSame(reversed.exit, 0, "a reversed range is no match, not an error");
    assertIncludes(reversed.stdout, "uncited: 8 of 8 target capabilities", "a reversed range matches nothing (Python: 8 of 8)");
  });
});

// ---------------------------------------------------------------- P9-R2-10

/** A folder link: a junction on Windows (no privilege needed), else a symbolic link. */
const DIR_LINK = process.platform === "win32" ? "junction" : "dir";

/** The same folder through another spelling, when the volume says so (same device and inode), else undefined. */
function sameFolderAs(dir: string, spelled: string): string | undefined {
  try {
    const a = statSync(dir);
    const b = statSync(spelled);
    return a.ino === b.ino && a.dev === b.dev ? spelled : undefined;
  } catch {
    return undefined;
  }
}

/** Runs `uncited` with an absolute --rows pattern and --out under `spelledRoot`, the project spelled another way. */
async function uncitedThrough(dir: string, spelledRoot: string): Promise<void> {
  const plain = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json"], dir);
  const r = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", join(spelledRoot, "analysis", "scored", "*.json"), "--out", join(spelledRoot, "out", "uncited.json")], dir);
  assertSame(r.exit, 0, "exit");
  assertSame(r.stdout, plain.stdout, "the same report as the relative pattern");
  assertSame(existsSync(join(dir, "out", "uncited.json")), true, "the output was written inside the project");
}

describe("P9-R2-10: a typed absolute path names the project folder by identity, not by spelling", () => {
  it("through a link to the project folder (an alias)", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const dir = project("fitgap", "library");
    const alias = join(dirname(dir), "alias");
    symlinkSync(dir, alias, DIR_LINK);
    await uncitedThrough(dir, alias);
    const az = project("azure-boards", "project");
    const azAlias = join(dirname(az), "alias");
    symlinkSync(az, azAlias, DIR_LINK);
    assertSame((await buildos(["export", "azure-boards", "--root", az, "validate", "--input", join(azAlias, "csv", "good.csv")], az)).exit, 0, "export azure-boards validate through the alias");
  });

  it("in another letter case, when the volume ignores case (probed)", async (t) => {
    const dir = project("fitgap", "library");
    const variant = sameFolderAs(dir, join(dirname(dir), basename(dir).toUpperCase()));
    if (variant === undefined) {
      t.skip("this volume is case-sensitive");
      return;
    }
    await uncitedThrough(dir, variant);
  });

  it("through the unresolved temporary folder spelling (macOS /var for /private/var; probed)", async (t) => {
    const dir = project("fitgap", "library");
    const given = tmpdir();
    const real = realpathSync(given);
    if (real === given || !dir.startsWith(real)) {
      t.skip("the temporary folder has no other spelling here");
      return;
    }
    await uncitedThrough(dir, `${given}${dir.slice(real.length)}`);
  });

  it("a path that is really outside the project is still refused (exit 3)", async () => {
    const dir = project("fitgap", "library");
    const other = project("fitgap", "library");
    const r = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", join(other, "analysis", "scored", "*.json")], dir);
    assertSame(r.exit, 3, "exit");
  });
});

// ---------------------------------------------------------------- P9-R2-09

describe("P9-R2-09: fitgap workbook compares the models by ID, in any order (divergence SD-18)", () => {
  it("the same baseline capabilities in another order build the workbook; another requirement under a capability still stops it", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const modelPath = join(dir, "deliver", "CIRC", "circ-capability-model.json");
    const model = JSON.parse(readFileSync(modelPath, "utf8")) as { capabilities: { requirements?: { id: string }[] }[] };
    model.capabilities.reverse();
    writeFileSync(join(dir, "deliver", "CIRC", "circ-reordered.json"), JSON.stringify(model, null, 1));
    const frame = frameWith(dir, "frame-reordered.json", (f) => {
      f["baseline"]!["model"] = "../deliver/CIRC/circ-reordered.json";
    });
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/book.xlsx"], dir);
    assertSame(r.exit, 0, "exit");
    assertSame(existsSync(join(dir, "out", "book.xlsx")), true, "the workbook");
    // A requirement moved to another capability: the merged file's marks no longer fit the model.
    const first = model.capabilities.find((c) => (c.requirements ?? []).length > 0)!;
    const other = model.capabilities.find((c) => c !== first)!;
    (other.requirements ??= []).push(first.requirements!.shift()!);
    writeFileSync(join(dir, "deliver", "CIRC", "circ-reordered.json"), JSON.stringify(model, null, 1));
    const moved = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/book2.xlsx"], dir);
    assertSame(moved.exit, 4, "exit with a moved requirement");
    assertIncludes(moved.stderr, "the requirements of baseline capability");
    assertSame(existsSync(join(dir, "out", "book2.xlsx")), false, "no workbook");
  });
});

// ---------------------------------------------------------------- P9-R2-13

describe("P9-R2-13: one XML-safe text rule for every workbook part (divergence SD-19)", () => {
  it("U+FFFE in the title and in cell text is dropped and reported; the workbook opens", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const path = join(dir, ...fitgap.split("/"));
    const g = JSON.parse(readFileSync(path, "utf8")) as { meta: Record<string, unknown>; rows: Record<string, unknown>[] };
    g.meta["title"] = `${String(g.meta["title"])} \uFFFE draft`;
    g.rows[0]!["baseline_name"] = `Desk \uFFFF ${String(g.rows[0]!["baseline_name"])}`;
    writeFileSync(path, JSON.stringify(g, null, 1));
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", "analysis/frame.json", "--fitgap", fitgap, "--out", "out/book.xlsx"], dir);
    assertSame(r.exit, 0, "exit");
    assertIncludes(r.stderr, " characters that a workbook cannot hold (U+FFFE, U+FFFF, or a lone surrogate) from the workbook text.");
    assertSame(existsSync(join(dir, "out", "book.xlsx")), true, "the workbook");
  });

  it("a model code with a form feed stops before anything is built (exit 4, a plain message, no file)", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const path = join(dir, ...fitgap.split("/"));
    const original = readFileSync(path, "utf8");
    writeFileSync(path, original.replace('"target": {\n   "code": "LIB"', `"target": {\n   "code": ${JSON.stringify("LIB\f")}`));
    const frame = frameWith(dir, "frame-ff.json", (f) => {
      f["target"]!["code"] = "LIB\f";
    });
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/book.xlsx"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, "holds the character U+000C, which a workbook cannot hold");
    assertSame(existsSync(join(dir, "out", "book.xlsx")), false, "no workbook");
  });
});
