// W1 R7 P9 review round 1: one test (or more) per finding P9-R1-01 to
// P9-R1-22 (P9-R1-09 in fixture-tracking.test.ts), each failing without its fix. Divergences from the scripts are
// recorded in test/golden/skills/divergences.json (SD-15 to SD-19 are new in
// this round). Every input is invented (the library book-lending topic).
// Failures print counts, tags, and sizes only (test-output-safety.test.ts).

import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { createNodeFsPort } from "../src/adapters/node-fs.ts";
import { xlsxZip } from "../src/adapters/xlsx-zip.ts";
import { BulkFs } from "../src/core/extract/bulk-files.ts";
import { readWorkbook } from "../src/core/fitgap/xlsx-read.ts";
import { assertIncludes, assertNoProblems, assertSame, assertSameList, assertSameTree, tag } from "./helpers.ts";
import { buildos, canLink, CONFIG, envelopeOf, fixtureFile, frameWith, instrumented, merged, ownedReview, posixPermissions, project, stagedAndDecided, temps, tree } from "./skill-script-support.ts";

// ---------------------------------------------------------------- P9-R1-01

describe("P9-R1-01: extract bulk checks the rows it would publish with buildos validate's rules", () => {
  it("check and stage stop on an owner the config does not name; publish stops when the owner was retired after staging", async () => {
    const dir = project("bulk-extract", "library");
    mkdirSync(join(dir, ".os", "config"), { recursive: true });
    writeFileSync(join(dir, ".os", "config", "instance.yaml"), CONFIG(["front-desk"]));
    const bulk = (...args: string[]) => buildos(["extract", "bulk", "--root", dir, ...args], dir);
    assertSame((await bulk("start", "REF-001")).exit, 0, "start");
    writeFileSync(join(dir, "extractions", "REF-001-lending-policy.json"), ownedReview());
    const checked = await bulk("check", "REF-001");
    assertSame(checked.exit, 4, "check exit");
    assertIncludes(checked.stdout, "REF-001: needs-repair");
    assertIncludes(checked.stdout, "Candidate renewals would not pass buildos validate (unknown_id at owners[0])");
    const staged = await bulk("stage", "REF-001");
    assertSame(staged.exit, 4, "stage exit");
    assertIncludes(staged.stderr, "would not pass buildos validate");
    // The owner is in the config: the flow goes through to the decisions.
    writeFileSync(join(dir, ".os", "config", "instance.yaml"), CONFIG(["front-desk", "circulation-desk"]));
    assertSame((await bulk("stage", "REF-001")).exit, 0, "stage");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "decide", "REF-001", "--reviewer", "Branch Supervisor"], dir, { stdin: fixtureFile("bulk-extract", "approve-two.json") })).exit, 0, "decide");
    // The owner is retired before publication: nothing is written.
    writeFileSync(join(dir, ".os", "config", "instance.yaml"), CONFIG(["front-desk"]));
    const before = tree(dir);
    const refused = await bulk("publish", "REF-001");
    assertSame(refused.exit, 4, "publish exit");
    assertIncludes(refused.stderr, "would not pass buildos validate");
    assertSameTree(tree(dir), before, "project after the refused publication");
    writeFileSync(join(dir, ".os", "config", "instance.yaml"), CONFIG(["front-desk", "circulation-desk"]));
    const published = await bulk("publish", "REF-001");
    assertSame(published.exit, 0, "publish");
    assertIncludes(published.stdout, "Published 2 candidates as EXT-");
  });
});

// ---------------------------------------------------------------- P9-R1-02, P9-R1-07

describe("P9-R1-02: fitgap patterns expand inside the project from their literal folder, however they are spelled", () => {
  it("absolute, relative, and ..-containing spellings give the same result; outside the project is exit 3", async () => {
    const dir = project("fitgap", "library");
    const uncited = (rows: string) => buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", rows], dir);
    const rel = await uncited("analysis/scored/*.json");
    assertSame(rel.exit, 0, "relative exit");
    assertIncludes(rel.stdout, "uncited: 2 of 8 target capabilities");
    for (const spelling of [join(dir, "analysis", "scored", "*.json"), "analysis/../analysis/scored/*.json", `${join(dir, "analysis")}${sep}..${sep}analysis${sep}scored${sep}pkg-0[1-2].json`]) {
      const r = await uncited(spelling);
      assertSame(r.exit, 0, `exit (${tag(spelling)})`);
      assertSame(r.stdout, rel.stdout, `stdout (${tag(spelling)})`);
    }
    // A pattern inside the project that matches nothing: no rows, as the script's glob.glob.
    const none = await uncited("analysis/nothing/*.json");
    assertSame(none.exit, 0, "no match exit");
    assertIncludes(none.stdout, "uncited: 8 of 8 target capabilities");
    mkdirSync(join(dir, "..", "elsewhere"), { recursive: true });
    writeFileSync(join(dir, "..", "elsewhere", "pkg.json"), "[]");
    for (const outside of ["../elsewhere/*.json", join(dir, "..", "elsewhere", "*.json"), "analysis/*/../../../elsewhere/*.json", join(dir, "..", "elsewhere", "pkg.json")]) {
      const r = await uncited(outside);
      assertSame(r.exit, 3, `outside exit (${tag(outside)})`);
      assertIncludes(r.stderr, "is outside the project folder");
    }
    for (const flag of ["--only", "--todos"]) {
      const r = await buildos(["fitgap", "--root", dir, "merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", flag, join(dir, "..", "elsewhere", "*.json"), "--out", "out", "--draft"], dir);
      assertSame(r.exit, 3, `${flag} outside exit`);
    }
  });
});

describe("P9-R1-07: uncited reads a mark's target IDs as merge does (divergence SD-15)", () => {
  it("a '|'-separated string cites each ID it names (the script iterated its characters)", async () => {
    const dir = project("fitgap", "library");
    const path = join(dir, "analysis", "scored", "pkg-02.json");
    const rows = JSON.parse(readFileSync(path, "utf8")) as { baseline_capability_id: string; marks: { target_capability_ids: unknown }[] }[];
    rows.find((r) => r.baseline_capability_id === "CIRC-CAT-01")!.marks[0]!.target_capability_ids = "LIB-CAT-01 | LIB-RPT-01 | LIB-RPT-02";
    writeFileSync(path, JSON.stringify(rows));
    const r = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json"], dir);
    assertSame(r.exit, 0, "exit");
    // The script printed "uncited: 3 of 8": LIB-CAT-01 was cited only by this string.
    assertIncludes(r.stdout, "uncited: 0 of 8 target capabilities");
  });
});

// ---------------------------------------------------------------- P9-R1-03, P9-R1-08, P9-R1-19, P9-R1-20, P9-R1-21

describe("P9-R1-03: fitgap workbook checks every sheet name before it builds (divergence SD-17)", () => {
  it("a forbidden character, an apostrophe at an end, a long name, and names that differ only by case stop with the code named", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const path = join(dir, ...fitgap.split("/"));
    const original = readFileSync(path, "utf8");
    for (const [code, why] of [
      ["LIB/X", "holds '/'"],
      ["'LIB", "starts or ends with an apostrophe"],
      ["LIBRARYPLATFORMCANDIDATE", "characters long, and a sheet name has at most 31"],
      ["circ", "when case is ignored"],
    ] as [string, string][]) {
      writeFileSync(path, original.replace('"target": {\n   "code": "LIB"', `"target": {\n   "code": ${JSON.stringify(code)}`));
      const frame = frameWith(dir, "frame-code.json", (f) => {
        f["target"]!["code"] = code;
      });
      const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/book.xlsx"], dir);
      assertSame(r.exit, 4, `exit (${tag(code)})`);
      assertIncludes(r.stderr, `the target code '${code}' gives the sheet name`);
      assertIncludes(r.stderr, why);
      assertSame(existsSync(join(dir, "out", "book.xlsx")), false, "no workbook");
    }
  });

  it("an apostrophe inside a code is valid, and every link to that sheet doubles it", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const path = join(dir, ...fitgap.split("/"));
    writeFileSync(path, readFileSync(path, "utf8").replace('"target": {\n   "code": "LIB"', '"target": {\n   "code": "LIB\'S"'));
    const frame = frameWith(dir, "frame-code.json", (f) => {
      f["target"]!["code"] = "LIB'S";
    });
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/book.xlsx"], dir);
    assertSame(r.exit, 0, "exit");
    const wb = readWorkbook(xlsxZip.unzip(readFileSync(join(dir, "out", "book.xlsx"))));
    const links = wb.sheets.flatMap((s) => s.hyperlinks.map((h) => h.location));
    assert.ok(links.includes("'LIB''S Capabilities'!A2"), "a link to the target sheet, escaped");
    assert.ok(!links.some((l) => /^'LIB'S/.test(l)), "no unescaped link");
  });
});

describe("P9-R1-08: fitgap workbook stops on a merged file made for other models (divergence SD-18)", () => {
  it("another target with as many capabilities, or the same code with other capabilities, is refused (the script built the workbook)", async () => {
    const dir = project("fitgap", "library");
    const fitgap = await merged(dir);
    const lib = JSON.parse(readFileSync(join(dir, "deliver", "LIB", "lib-capability-model.json"), "utf8")) as { meta: Record<string, unknown>; capabilities: { id: string }[] };
    const other = { ...lib, meta: { ...lib.meta, code: "NEO" }, capabilities: lib.capabilities.map((c) => ({ ...c, id: c.id.replace(/^LIB/, "NEO") })) };
    writeFileSync(join(dir, "deliver", "LIB", "neo-model.json"), JSON.stringify(other));
    const renamed = { ...lib, capabilities: lib.capabilities.map((c, i) => (i === 0 ? { ...c, id: "LIB-NEW-01" } : c)) };
    writeFileSync(join(dir, "deliver", "LIB", "renamed-model.json"), JSON.stringify(renamed));
    for (const [model, why] of [
      ["../deliver/LIB/neo-model.json", "the target code differs"],
      ["../deliver/LIB/renamed-model.json", "the target capabilities differ"],
    ] as [string, string][]) {
      const frame = frameWith(dir, "frame-other.json", (f) => {
        f["target"] = { model };
      });
      const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/other.xlsx"], dir);
      assertSame(r.exit, 4, `exit (${why})`);
      assertSame(r.stderr, `fitgap: the fit-gap JSON was merged from different models than the frame names now (${why}). Run merge again.\n`, "stderr");
      assertSame(existsSync(join(dir, "out", "other.xlsx")), false, "no workbook");
    }
  });
});

describe("P9-R1-20 and P9-R1-21: workbook text", () => {
  it("shared strings count every reference; entered _xHHHH_ text and #N/A stay text; a control character in the title is dropped", async () => {
    const dir = project("fitgap", "library");
    const path = join(dir, "analysis", "scored", "pkg-01.json");
    const rows = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[];
    rows[0]!["migration_note"] = "Line _x000D_ stays as typed.";
    rows[1]!["migration_note"] = "#N/A";
    writeFileSync(path, JSON.stringify(rows));
    const frame = frameWith(dir, "frame-title.json", (f) => {
      (f as unknown as Record<string, unknown>)["title"] = "Circulation\fto Platform";
    });
    const fitgap = await merged(dir, frame);
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", fitgap, "--out", "out/book.xlsx"], dir);
    assertSame(r.exit, 0, "exit");
    const parts = new Map(xlsxZip.unzip(readFileSync(join(dir, "out", "book.xlsx"))).map((p) => [p.name, new TextDecoder().decode(p.data)]));
    const sst = parts.get("xl/sharedStrings.xml")!;
    const count = Number(/count="(\d+)"/.exec(sst)![1]);
    const unique = Number(/uniqueCount="(\d+)"/.exec(sst)![1]);
    const refs = [...parts].filter(([n]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).reduce((n, [, xml]) => n + (xml.match(/ t="s"/g) ?? []).length, 0);
    assertSame(count, refs, "sst count");
    assert.ok(unique < count, "fewer unique strings than references");
    assert.ok(sst.includes("_x005F_x000D_"), "the entered escape is written escaped");
    assertSame(parts.get("docProps/core.xml")!.includes("<dc:title>Circulationto Platform</dc:title>"), true, "the title without its control character");
    const wb = readWorkbook(xlsxZip.unzip(readFileSync(join(dir, "out", "book.xlsx"))));
    const values = wb.sheets.flatMap((s) => [...s.cells.values()].map((c) => c.value));
    assert.ok(values.some((v) => v !== null && v.t === "s" && v.v === "Line _x000D_ stays as typed."), "read back as typed");
    assert.ok(values.some((v) => v !== null && v.t === "s" && v.v === "#N/A"), "#N/A is text");
    assert.ok(!values.some((v) => v !== null && v.t === "e"), "no error cell");
  });
});

describe("P9-R1-19: the workbook self-check handles a large sheet", () => {
  it("a Requirement Marks sheet of more than 200,000 cells is built and checked in a sane time", { timeout: 300_000 }, async () => {
    const dir = project("fitgap", "library");
    const caps = 2600;
    const per = 10;
    const req = (id: string) => ({ id, kind: "function", status: "built", maturity: "proven", text: "Lend a book.", option_values: null });
    const base = {
      meta: { code: "BIG", name: "Big Circulation" },
      layers: [{ id: "L1", code: "CORE", name: "Circulation" }],
      capabilities: Array.from({ length: caps }, (_, i) => ({ id: `BIG-COR-${String(i).padStart(4, "0")}`, parent_id: null, name: `Desk task ${i}`, layer_id: "L1", doc_ref: null, type: "process", status: "built", maturity: "proven", summary: "A desk task.", requirements: Array.from({ length: per }, (_, j) => req(`BIG-COR-${String(i).padStart(4, "0")}-R${String(j).padStart(2, "0")}`)) })),
    };
    writeFileSync(join(dir, "deliver", "CIRC", "big-model.json"), JSON.stringify(base));
    const frame = frameWith(dir, "frame-big.json", (f) => {
      f["baseline"] = { model: "../deliver/CIRC/big-model.json" };
      delete (f as Record<string, unknown>)["tracks"];
      delete (f as Record<string, unknown>)["owners"];
    });
    const rows = base.capabilities.map((c) => ({ baseline_capability_id: c.id, objective_ids: [], confidence: "high", effort: "low", marks: c.requirements.map((r) => ({ requirement_id: r.id, mark: "met", target_capability_ids: ["LIB-COR-01"], note: "" })), evidence: "The candidate platform documents this desk task in its guide, and staff confirmed it in a walk-through.", gap_detail: "", migration_note: "Train the desk staff." }));
    rmSync(join(dir, "analysis", "scored"), { recursive: true });
    mkdirSync(join(dir, "analysis", "big"));
    writeFileSync(join(dir, "analysis", "big", "rows.json"), JSON.stringify(rows));
    const m = await buildos(["fitgap", "--root", dir, "merge", "--frame", frame, "--rows", "analysis/big/rows.json", "--out", "out", "--draft"], dir);
    assertSame(m.exit, 0, "merge exit");
    const started = Date.now();
    const r = await buildos(["fitgap", "--root", dir, "workbook", "--frame", frame, "--fitgap", "out/big-lib-fit-gap-analysis.json", "--out", "out/big.xlsx"], dir);
    const seconds = (Date.now() - started) / 1000;
    assertSame(r.exit, 0, "workbook exit");
    assertIncludes(r.stdout, "  PASS  Requirement Marks has one row per BIG requirement (26000)");
    const wb = readWorkbook(xlsxZip.unzip(readFileSync(join(dir, "out", "big.xlsx"))));
    const cells = wb.sheets.find((s) => s.name === "Requirement Marks")!.cells.size;
    assert.ok(cells > 200_000, `the sheet has ${cells} cells`);
    assert.ok(seconds < 120, `the workbook took ${seconds.toFixed(1)} s`);
  });
});

// ---------------------------------------------------------------- P9-R1-04, P9-R1-06

describe("P9-R1-04 and P9-R1-06: writes outside the root with --allow-outside-root", () => {
  it("packages into an outside folder removes only its own stale pkg files, replaces a link at a written name without following it, and reads no destination", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const dir = project("fitgap", "library");
    const out = join(dir, "..", "outside-work");
    mkdirSync(join(out, "packages"), { recursive: true });
    // Review round 2 (P9-R2-02): stale packages in the shape packages writes; only those are removed.
    const stale = JSON.stringify([{ id: "OLD", name: "Old", layer_code: "L", layer_name: "Layer", type: "t", status: "s", maturity: "m", summary: "", requirements: [{ id: "R", kind: "k", status: "s", text: "", option_values: [] }] }], null, 1);
    for (let i = 1; i <= 9; i++) writeFileSync(join(out, "packages", `pkg-0${i}.json`), stale);
    writeFileSync(join(out, "packages", "notes.json"), "keep");
    writeFileSync(join(out, "kept.json"), "linked file");
    symlinkSync(join(out, "kept.json"), join(out, "target-index.json"), "file");
    const { factory, calls } = instrumented();
    const r = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", out, "--max-requirements", "99", "--allow-outside-root"], dir, { openFs: factory });
    assertSame(r.exit, 0, "exit");
    assertSameList(readdirSync(join(out, "packages")).sort(), ["notes.json", "pkg-01.json"], "packages folder");
    assertSame(readFileSync(join(out, "kept.json"), "utf8"), "linked file", "the file the link named");
    assertSame(lstatSync(join(out, "target-index.json")).isSymbolicLink(), false, "the link was replaced by the file");
    assertSame(readdirSync(out).filter((n) => n.includes(".buildos-")).length, 0, "no temporary or backup file left");
    // Names only (readDir) are allowed; no file content at a destination is read, except the ownership check of a numbered package (P9-R2-02).
    const outsideReads = calls.filter((c) => ["readFileLimited", "readBytes", "readText", "openRead", "matchesEntry"].includes(c.method) && !c.path.startsWith(".") && resolve(c.path).startsWith(realpathSync(join(dir, ".."))) && !resolve(c.path).startsWith(realpathSync(dir)) && !/[\\/]packages[\\/]pkg-0[1-9]\.json$/.test(c.path));
    assertSame(outsideReads.length, 0, "reads of outside destinations");
  });

  it("a failed later write puts back the outside file and the link as they were, by rename, with no backup left", { skip: canLink ? false : "symbolic links are not available" }, async () => {
    const dir = project("fitgap", "library");
    const out = join(dir, "..", "outside-work");
    mkdirSync(join(out, "packages"), { recursive: true });
    // An earlier package that BuildOS wrote (P9-F-01: a file of another shape at pkg-01.json now stops the run before any change).
    writeFileSync(join(out, "packages", "pkg-01.json"), JSON.stringify([{ id: "OLD", name: "Old", layer_code: "L", layer_name: "Layer", type: "t", status: "s", maturity: "m", summary: "", requirements: [{ id: "R", kind: "k", status: "s", text: "", option_values: [] }] }], null, 1));
    writeFileSync(join(out, "kept.json"), "linked file");
    symlinkSync(join(out, "kept.json"), join(out, "target-index.json"), "file");
    const before = tree(out);
    const linkId = lstatSync(join(out, "target-index.json")).ino;
    const { factory } = instrumented((method, path) => method === "writeNewFile" && path.includes("objectives.md"));
    const r = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", out, "--allow-outside-root"], dir, { openFs: factory });
    assertSame(r.exit, 5, "exit");
    assertIncludes(r.stderr, "BuildOS put back every file it had changed.");
    assertSameTree(tree(out), before, "outside folder after the failed write");
    assertSame(lstatSync(join(out, "target-index.json")).ino, linkId, "the same link entry");
  });
});

// ---------------------------------------------------------------- P9-R1-05

describe("P9-R1-05: every project read of the three commands goes through the opened-file-checked reader", () => {
  it("no readBytes or readText call in a bulk flow, a fit-gap merge and workbook, and an Azure Boards emit and validate", async () => {
    const { factory, calls } = instrumented();
    const bulkDir = project("bulk-extract", "library");
    await buildos(["extract", "bulk", "--root", bulkDir, "start", "REF-001"], bulkDir, { openFs: factory });
    writeFileSync(join(bulkDir, "extractions", "REF-001-lending-policy.json"), fixtureFile("bulk-extract", "full-flow-review.json"));
    for (const args of [["check", "REF-001"], ["stage", "REF-001"], ["show", "REF-001"], ["publish", "REF-001"], ["status"]]) await buildos(["extract", "bulk", "--root", bulkDir, ...args], bulkDir, { openFs: factory });
    await buildos(["extract", "bulk", "--root", bulkDir, "decide", "REF-001", "--reviewer", "Branch Supervisor"], bulkDir, { stdin: fixtureFile("bulk-extract", "approve-two.json"), openFs: factory });
    await buildos(["extract", "bulk", "--root", bulkDir, "publish", "REF-001"], bulkDir, { openFs: factory });
    const fitDir = project("fitgap", "library");
    const m = await buildos(["fitgap", "--root", fitDir, "merge", "--frame", "analysis/frame.json", "--rows", "analysis/scored/*.json", "--only", "analysis/only.json", "--findings", "analysis/findings.json", "--todos", "analysis/todos.json", "--out", "out"], fitDir, { openFs: factory });
    assertSame(m.exit, 0, "merge");
    assertSame((await buildos(["fitgap", "--root", fitDir, "workbook", "--frame", "analysis/frame.json", "--fitgap", "out/circ-lib-fit-gap-analysis.json"], fitDir, { openFs: factory })).exit, 0, "workbook");
    const azDir = project("azure-boards", "project");
    assertSame((await buildos(["export", "azure-boards", "--root", azDir, "emit", "--input", "backlog/holds.json", "--output", "out/holds.csv"], azDir, { openFs: factory })).exit, 0, "emit");
    assertSame((await buildos(["export", "azure-boards", "--root", azDir, "validate", "--input", "out/holds.csv"], azDir, { openFs: factory })).exit, 0, "validate");
    const unchecked = calls.filter((c) => c.method === "readBytes" || c.method === "readText" || c.method === "openRead");
    assertSame(unchecked.length, 0, "reads that are not opened-file checked");
    assert.ok(calls.filter((c) => c.method === "readFileLimited").length > 50, "the reads went through readFileLimited");
  });
});

// ---------------------------------------------------------------- P9-R1-10, P9-R1-11

describe("P9-R1-10: extract bulk writes as one transaction and reports write_status truthfully", () => {
  it("a read-only data folder stops publish before any change (exit 5, not_requested); a no-op publish is not_requested", { skip: posixPermissions ? false : "POSIX permissions only" }, async () => {
    const dir = project("bulk-extract", "library");
    await stagedAndDecided(dir);
    const before = tree(dir);
    chmodSync(join(dir, ".os", "data"), 0o555);
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir);
    chmodSync(join(dir, ".os", "data"), 0o755);
    assertSame(r.exit, 5, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertSameTree(tree(dir), before, "project after the refused publication");
    const published = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir);
    assertSame(published.exit, 0, "publish");
    assertSame(envelopeOf(published)["write_status"], "applied", "write_status");
    const again = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir);
    assertSame(again.exit, 0, "publish again");
    assertSame((envelopeOf(again)["result"] as { message: string }).message, "Review complete; no rows to publish", "message");
    assertSame(envelopeOf(again)["write_status"], "not_requested", "write_status of a no-op");
  });

  it("a failed write in stage is undone: the staged file and the review are as they were (exit 5)", async () => {
    const dir = project("bulk-extract", "library");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    writeFileSync(join(dir, "extractions", "REF-001-lending-policy.json"), fixtureFile("bulk-extract", "full-flow-review.json"));
    const before = tree(dir);
    const { factory } = instrumented((method, path, n) => method === "writeFileAtomic" && path === "extractions/REF-001-lending-policy.json" && n === 2);
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "stage", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 5, "exit");
    assertSame(envelopeOf(r)["write_status"], "not_requested", "write_status");
    assertIncludes((envelopeOf(r)["diagnostics"] as { message: string }[])[0]!.message, "BuildOS put back every file it had changed");
    // The lock file is gone too; the staging folder the lock made stays only when it holds something.
    const after = tree(dir);
    after.delete("extractions/staging/");
    assertSameTree(after, before, "project after the failed stage");
  });

  it("a publication whose undo is incomplete names what stays (exit 10, partially_applied); the next publish resumes it", async () => {
    const dir = project("bulk-extract", "library");
    await stagedAndDecided(dir);
    const { factory } = instrumented((method, path, n) => method === "writeFileAtomic" && ((path === ".os/data/extractions.jsonl" && n === 1) || (path === ".os/data/requirements.jsonl" && n === 2)));
    const r = await buildos(["extract", "bulk", "--root", dir, "--json", "publish", "REF-001"], dir, { openFs: factory });
    assertSame(r.exit, 10, "exit");
    const envelope = envelopeOf(r);
    assertSame(envelope["write_status"], "partially_applied", "write_status");
    const message = (envelope["diagnostics"] as { message: string }[])[0]!.message;
    // The undo stops at the first step it cannot undo (requirements.jsonl), so what stays is what a crash there leaves: the intent in the review names it.
    assertIncludes(message, "BuildOS could not put back: .os/data/requirements.jsonl, .os/data/capabilities.jsonl, extractions/REF-001-lending-policy.json");
    const resumed = await buildos(["extract", "bulk", "--root", dir, "publish", "REF-001"], dir);
    assertSame(resumed.exit, 0, "resume exit");
    assertIncludes(resumed.stdout, "Published 2 candidates as EXT-");
    const checked = await buildos(["extract", "bulk", "--root", dir, "check", "REF-001"], dir);
    assertSame(checked.exit, 0, "check exit");
    assertIncludes(checked.stdout, "REF-001: complete");
    const requirements = readFileSync(join(dir, ".os", "data", "requirements.jsonl"), "utf8");
    assertSame((requirements.match(/"Renewal rule a"/g) ?? []).length, 1, "the minted row once");
  });
});

describe("P9-R1-11: no queued write is larger than its reader's bound", () => {
  it("apply stops before the first change when one file is too large, and makes no folder", () => {
    const parent = realpathSync(mkdtempSync(join(tmpdir(), "buildos-skill-review-")));
    temps.push(parent);
    const fs = new BulkFs(createNodeFsPort(parent, parent), parent, sep);
    fs.mkdirp("extractions");
    fs.replace("extractions/small.json", new TextEncoder().encode("{}"));
    fs.replace("extractions/big.json", new TextEncoder().encode("x".repeat(11)));
    assert.throws(() => fs.apply(10), (error: Error) => error.message === "extractions/big.json would be 11 bytes, more than BuildOS reads from one such file (10 bytes); nothing was written");
    assertSame(existsSync(join(parent, "extractions")), false, "no folder made");
  });
});

// ---------------------------------------------------------------- P9-R1-12, P9-R1-15, P9-R1-16, P9-R1-22

describe("P9-R1-12: a missing --root value gives the JSON envelope in JSON mode", () => {
  for (const args of [
    ["fitgap", "frame", "--root", "--json"],
    ["extract", "bulk", "status", "--root", "--json"],
    ["export", "azure-boards", "adapters", "--root", "--json"],
  ]) {
    it(args.slice(0, 2).join(" "), async () => {
      const r = await buildos(args, process.cwd());
      assertSame(r.exit, 2, "exit");
      assertSame(envelopeOf(r)["ok"], false, "ok");
      assertSame(r.stderr, "", "stderr");
    });
  }
});

describe("P9-R1-15: help at every level exits 0", () => {
  for (const [args, text] of [
    [["fitgap", "workbook", "--help"], "buildos fitgap workbook --frame"],
    [["fitgap", "packages", "-h"], "buildos fitgap packages --frame"],
    [["extract", "bulk", "next", "--help"], "Subcommands:"],
    [["extract", "bulk", "decide", "REF-001", "-h"], "Subcommands:"],
    [["export", "azure-boards", "emit", "--help"], "Registered adapters: dynamics-365-ce"],
    [["export", "azure-boards", "validate", "--input", "x.csv", "-h"], "Registered adapters: dynamics-365-ce"],
  ] as [string[], string][]) {
    it(args.join(" "), async () => {
      const r = await buildos(args, process.cwd());
      assertSame(r.exit, 0, "exit");
      assertIncludes(r.stdout, text);
    });
  }
});

describe("P9-R1-16: oversized standard input and deep JSON inputs are unreadable inputs", () => {
  it("export azure-boards refuses a manifest nested 600 levels deep (exit 3) and deep --adapter-params (exit 2)", async () => {
    const dir = project("azure-boards", "project");
    writeFileSync(join(dir, "deep.json"), `${"[".repeat(600)}${"]".repeat(600)}`);
    const r = await buildos(["export", "azure-boards", "--root", dir, "emit", "--input", "deep.json", "--output", "out.csv"], dir);
    assertSame(r.exit, 3, "exit");
    assertSame(r.stderr, "deep.json nests more than 512 levels deep, so BuildOS did not read it\n", "stderr");
    const params = await buildos(["export", "azure-boards", "--root", dir, "validate", "--input", "csv/d365-rules.csv", "--adapter", "dynamics-365-ce", "--adapter-params", `${'{"a":'.repeat(600)}1${"}".repeat(600)}`], dir);
    assertSame(params.exit, 2, "adapter params exit");
    assertIncludes(params.stderr, "--adapter-params must be valid JSON: --adapter-params nests more than 512 levels deep");
    // Brackets inside strings do not count.
    writeFileSync(join(dir, "strings.json"), JSON.stringify({ title: "[".repeat(600) }));
    const strings = await buildos(["export", "azure-boards", "--root", dir, "emit", "--input", "strings.json", "--output", "out.csv"], dir);
    assert.ok(!strings.stderr.includes("nests more than"), "brackets in a string");
  });
});

describe("P9-R1-22: number spellings and the lock record", () => {
  it("--max-requirements refuses the digit forms Python's int() took (SD-02)", async () => {
    const dir = project("fitgap", "library");
    for (const value of ["٢", "1_0"]) {
      const r = await buildos(["fitgap", "--root", dir, "packages", "--frame", "analysis/frame.json", "--out", "work", "--max-requirements", value], dir);
      assertSame(r.exit, 2, `exit (${tag(value)})`);
    }
  });

  it("a lock file left by a crash names the process, the host, and the time, and how to check and clear it (SD-09)", async () => {
    const dir = project("bulk-extract", "library");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    mkdirSync(join(dir, "extractions", "staging"), { recursive: true });
    writeFileSync(join(dir, "extractions", "staging", ".buildos-extract-bulk-stage.lock"), `${JSON.stringify({ command: "buildos extract bulk", pid: 4242, host: "desk-laptop", started_at: "2026-01-15T11:00:00Z" })}\n`);
    const r = await buildos(["extract", "bulk", "--root", dir, "stage-update", "REF-001", "REQ-001", "--key", "x"], dir);
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stderr, "It was taken at 2026-01-15T11:00:00Z by process 4242 on desk-laptop.");
    assertIncludes(r.stderr, "also when only one person works in the project");
    assertIncludes(r.stderr, 'ps -p 4242; Windows: tasklist /FI "PID eq 4242"');
  });

  it("a lock this command takes records its process, host, and time, and is gone after the command", async () => {
    const dir = project("bulk-extract", "library");
    assertSame((await buildos(["extract", "bulk", "--root", dir, "start", "REF-001"], dir)).exit, 0, "start");
    let seen = "";
    const { factory } = instrumented((method, path) => {
      if (method === "remove" && path.endsWith(".lock")) seen = readFileSync(join(dir, ...path.split("/")), "utf8");
      return false;
    });
    await buildos(["extract", "bulk", "--root", dir, "stage-update", "REF-001", "REQ-001", "--key", "copy"], dir, { openFs: factory });
    const record = JSON.parse(seen) as Record<string, unknown>;
    assertSame(record["pid"], process.pid, "pid");
    assertSame(typeof record["host"], "string", "host");
    assertSame(record["started_at"], "2026-01-15T12:00:00Z", "time");
    assertSame(existsSync(join(dir, "extractions", "staging", ".buildos-extract-bulk-stage.lock")), false, "lock removed");
  });
});

// ---------------------------------------------------------------- P9-R1-13

describe("P9-R1-13: a typed path follows the shared layout rule", () => {
  it("in an initialized project with no system entry, system/<path> is the earlier spelling; with a system folder, it names that folder", async () => {
    const dir = project("azure-boards", "project");
    mkdirSync(join(dir, ".os"));
    const plain = await buildos(["export", "azure-boards", "--root", dir, "validate", "--input", "csv/good.csv"], dir);
    assertSame(plain.exit, 0, "plain exit");
    const legacy = await buildos(["export", "azure-boards", "--root", dir, "validate", "--input", "system/csv/good.csv"], dir);
    assertSame(legacy.exit, 0, "legacy exit");
    assertSame(legacy.stdout, plain.stdout, "the same report");
    mkdirSync(join(dir, "system"));
    const owned = await buildos(["export", "azure-boards", "--root", dir, "validate", "--input", "system/csv/good.csv"], dir);
    assertSame(owned.exit, 3, "a project that owns system/ exit");
    mkdirSync(join(dir, "system", "csv"));
    cpSync(join(dir, "csv", "good.csv"), join(dir, "system", "csv", "good.csv"));
    const read = await buildos(["export", "azure-boards", "--root", dir, "validate", "--input", "system/csv/good.csv"], dir);
    assertSame(read.exit, 0, "reads the project's own system folder");
    // W1 R7 P9 review round 2 (P9-R2-03): the report is JSON, which escapes each Windows backslash, so the parsed field is compared.
    assertSame((JSON.parse(read.stdout) as { input?: unknown }).input, join(dir, "system", "csv", "good.csv"), "the input the report names");
  });

  it("the same for a fit-gap output and an emit output", async () => {
    const dir = project("fitgap", "library");
    const r = await buildos(["fitgap", "--root", dir, "uncited", "--frame", "system/analysis/frame.json", "--rows", "system/analysis/scored/*.json", "--out", "system/out/uncited.json"], dir);
    assertSame(r.exit, 0, "exit");
    assertSame(existsSync(join(dir, "out", "uncited.json")), true, "written without system/");
    assertSame(statSync(join(dir, "analysis")).isDirectory(), true, "inputs read without system/");
    // P9-R2-03: the emit output too (the test named it but ran only fitgap).
    const az = project("azure-boards", "project");
    mkdirSync(join(az, ".os"));
    const emitted = await buildos(["export", "azure-boards", "--root", az, "emit", "--input", "system/backlog/holds.json", "--output", "system/out/holds.csv"], az);
    assertSame(emitted.exit, 0, "emit exit");
    assertSame(existsSync(join(az, "out", "holds.csv")), true, "emit output written without system/");
    assertSame(existsSync(join(az, "system")), false, "no system folder made");
    assertSame((JSON.parse(emitted.stdout) as { output?: unknown }).output, join(az, "out", "holds.csv"), "the output the report names");
  });
});
