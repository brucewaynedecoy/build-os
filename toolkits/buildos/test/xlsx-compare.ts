// The `.xlsx` comparison rule of the skill-script parity tests (W1 R7 P9 t3,
// parity exception PE-021, approved 2026-11-25): two workbooks are equal when their
// content is equal, not their archive bytes. Both are read with the
// repository's own reader (src/core/fitgap/xlsx-read.ts, on the port of Go's
// encoding/xml and the intake ZIP reader), and these are compared:
//
//   - the sheet names and their order, and the sheet that opens first;
//   - every cell that has a value or a style: its value and type (text,
//     number, boolean, formula), its font (bold, italic, underline, size,
//     color), its solid fill color, its alignment (vertical, wrap), and its
//     number format;
//   - merged cells, column widths, row heights, and frozen panes;
//   - internal links (cell and target), tables (name, range, columns, style,
//     row stripes), conditional formats (range, type, priority, operator,
//     formula, the format's fill and font color, color-scale and data-bar
//     points and colors), and the landscape fit-to-width page setup;
//   - the document title and creator.
//
// Not compared: archive bytes, ZIP times and order, XML spelling, style
// indexes, shared or inline strings, the color alpha byte, document times,
// the application name, and parts the skill does not set (theme, printer
// settings). A difference is reported by sheet, cell, and field only: never
// a cell value, so no content reaches a CI log.

import { readFileSync } from "node:fs";
import { xlsxZip } from "../src/adapters/xlsx-zip.ts";
import { readWorkbook } from "../src/core/fitgap/xlsx-read.ts";
import type { XCell, XSheet, XWorkbook } from "../src/core/fitgap/xlsx-model.ts";
import { columnLetter } from "../src/core/fitgap/xlsx-model.ts";

export function readXlsx(data: Uint8Array): XWorkbook {
  return readWorkbook(xlsxZip.unzip(data));
}

export function readXlsxFile(path: string): XWorkbook {
  return readXlsx(readFileSync(path));
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Excel's error values: openpyxl stores cell text that is exactly one of them as an error cell. */
export const EXCEL_ERRORS = ["#NULL!", "#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#NUM!", "#N/A"];

/**
 * W1 R7 P9 review round 1 (P9-R1-21, divergence SD-19): text that is exactly
 * an Excel error token (such as `#N/A` in evidence text) is an error cell in
 * openpyxl's workbook and a text cell in BuildOS's. BuildOS keeps the text,
 * which is what the user wrote, so the rule counts an error cell and a text
 * cell with the same token as the same value.
 */
function sameValue(a: XCell["value"], b: XCell["value"]): boolean {
  if (a !== null && b !== null && ((a.t === "e" && b.t === "s") || (a.t === "s" && b.t === "e")) && a.v === b.v && EXCEL_ERRORS.includes(String(a.v))) return true;
  return same(a, b);
}

/** A cell that a reader would show: a value, or any style. */
function shown(cell: XCell | undefined): boolean {
  if (cell === undefined) return false;
  const s = cell.style;
  return cell.value !== null || s.font !== undefined || s.fill !== undefined || s.alignment !== undefined || s.numFmt !== undefined;
}

function normalizedStyle(cell: XCell | undefined): unknown {
  const s = cell?.style ?? {};
  return { font: s.font ?? null, fill: s.fill ?? null, alignment: s.alignment ?? null, numFmt: s.numFmt ?? null };
}

function compareSheet(name: string, a: XSheet, b: XSheet, out: string[]): void {
  const keys = new Set([...a.cells.keys(), ...b.cells.keys()]);
  let cellDiffs = 0;
  for (const key of [...keys].sort()) {
    const ca = a.cells.get(key);
    const cb = b.cells.get(key);
    if (!shown(ca) && !shown(cb)) continue;
    const [r, c] = key.split(",").map(Number) as [number, number];
    const ref = `${columnLetter(c)}${r}`;
    if (!sameValue(ca?.value ?? null, cb?.value ?? null)) {
      const ta = ca?.value?.t ?? "empty";
      const tb = cb?.value?.t ?? "empty";
      if (cellDiffs++ < 20) out.push(`${name}!${ref}: value differs (${ta === tb ? `both ${ta}` : `${ta} vs ${tb}`})`);
    }
    const sa = normalizedStyle(ca);
    const sb = normalizedStyle(cb);
    for (const field of ["font", "fill", "alignment", "numFmt"] as const) {
      if (!same((sa as Record<string, unknown>)[field], (sb as Record<string, unknown>)[field]) && cellDiffs++ < 20) out.push(`${name}!${ref}: ${field} differs`);
    }
  }
  if (cellDiffs > 20) out.push(`${name}: ${cellDiffs - 20} more cell differences`);
  const pairs: [string, unknown, unknown][] = [
    ["merged cells", [...a.merges].sort(), [...b.merges].sort()],
    ["column widths", [...a.colWidths].sort((x, y) => x[0] - y[0]), [...b.colWidths].sort((x, y) => x[0] - y[0])],
    ["row heights", [...a.rowHeights].sort((x, y) => x[0] - y[0]), [...b.rowHeights].sort((x, y) => x[0] - y[0])],
    ["frozen pane", a.freeze ?? null, b.freeze ?? null],
    ["links", [...a.hyperlinks].sort((x, y) => x.ref.localeCompare(y.ref)), [...b.hyperlinks].sort((x, y) => x.ref.localeCompare(y.ref))],
    ["tables", a.tables, b.tables],
    ["conditional formats", a.rules, b.rules],
    ["page setup", a.landscape, b.landscape],
  ];
  for (const [what, x, y] of pairs) if (!same(x, y)) out.push(`${name}: ${what} differ`);
}

/** The content differences of two workbooks, by location only. Empty when equal. */
export function compareWorkbooks(a: XWorkbook, b: XWorkbook): string[] {
  const out: string[] = [];
  const na = a.sheets.map((s) => s.name);
  const nb = b.sheets.map((s) => s.name);
  if (!same(na, nb)) out.push(`sheet names or order differ (${na.length} vs ${nb.length} sheets)`);
  if (a.activeTab !== b.activeTab) out.push(`the opening sheet differs (${a.activeTab} vs ${b.activeTab})`);
  if (a.title !== b.title) out.push("the document title differs");
  if (a.creator !== b.creator) out.push("the document creator differs");
  for (const sheet of a.sheets) {
    const other = b.sheets.find((s) => s.name === sheet.name);
    if (other !== undefined) compareSheet(sheet.name, sheet, other, out);
  }
  return out;
}
