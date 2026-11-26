// W1 R7 P9 t3: the .xlsx comparison rule (parity exception PE-021, approved
// 2026-11-25) finds real differences and reports them by location only.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { xlsxZip } from "../src/adapters/xlsx-zip.ts";
import { GOLDENS } from "./golden/skills/scenario.ts";
import { assertNoProblems, assertSame } from "./helpers.ts";
import { compareWorkbooks, readXlsx, readXlsxFile } from "./xlsx-compare.ts";

const book = (name: string): string => join(GOLDENS, "fitgap", "xlsx", name);
const MAIN = book("merge-and-workbook.1.deliver~fit-gap~circ-lib-fit-gap-analysis.xlsx");
const COLORS = book("workbook-owner-colors.1.deliver~books~colors.xlsx");
const NO_PLAN = book("workbook-no-plan.1.deliver~fit-gap~circ-lib-fit-gap-analysis.xlsx");

describe("the .xlsx content comparison (t3, PE-021)", () => {
  it("reads an openpyxl workbook: 13 sheets, the Summary opens first, every table and rule", () => {
    const wb = readXlsxFile(MAIN);
    assertSame(wb.sheets.length, 13, "sheets");
    assertSame(wb.activeTab, 1, "active tab");
    assertSame(wb.creator, "fit-gap-analysis", "creator");
    assertSame(wb.sheets.reduce((n, s) => n + s.tables.length, 0), 11, "tables");
    assert.ok(wb.sheets.every((s) => s.cells.size > 0));
    assert.ok(wb.sheets.find((s) => s.name === "To-Dos")!.rules.some((r) => r.type === "cellIs" && r.dxf?.fill !== undefined));
  });

  it("a workbook equals itself, also after its parts are zipped again by the BuildOS ZIP port", () => {
    const data = readFileSync(MAIN);
    assertNoProblems(compareWorkbooks(readXlsx(data), readXlsx(data)), "same bytes");
    const rezipped = xlsxZip.zip(xlsxZip.unzip(data).reverse());
    assertNoProblems(compareWorkbooks(readXlsx(data), readXlsx(rezipped)), "other archive bytes");
  });

  it("finds a changed owner color, a changed value, and missing sheets, and names no cell value", () => {
    const owner = compareWorkbooks(readXlsxFile(MAIN), readXlsxFile(COLORS));
    assert.ok(owner.includes("To-Dos: conditional formats differ"));
    const plan = compareWorkbooks(readXlsxFile(MAIN), readXlsxFile(NO_PLAN));
    assert.ok(plan.some((d) => d.startsWith("sheet names or order differ")));
    const changed = readXlsxFile(MAIN);
    const cell = changed.sheets[0]!.cells.get("1,1")!;
    const secret = "Invented changed title";
    cell.value = { t: "s", v: secret };
    cell.style = { ...cell.style, font: { bold: false } };
    const diffs = compareWorkbooks(readXlsxFile(MAIN), changed);
    assertSame(diffs, ["Read Me!A1: value differs (both s)", "Read Me!A1: font differs"], "differences");
    assert.ok(!diffs.join(" ").includes(secret));
  });

  it("an Excel error token is the same value as an error cell and as a text cell (P9-R1-21); other text is not", () => {
    const a = readXlsxFile(MAIN);
    const b = readXlsxFile(MAIN);
    a.sheets[0]!.cells.get("1,1")!.value = { t: "e", v: "#N/A" };
    b.sheets[0]!.cells.get("1,1")!.value = { t: "s", v: "#N/A" };
    assertNoProblems(compareWorkbooks(a, b), "error token");
    b.sheets[0]!.cells.get("1,1")!.value = { t: "s", v: "#N/B" };
    a.sheets[0]!.cells.get("1,1")!.value = { t: "e", v: "#N/B" };
    assertSame(compareWorkbooks(a, b), ["Read Me!A1: value differs (e vs s)"], "not a token");
  });
});
