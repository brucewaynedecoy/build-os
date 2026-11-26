/**
 * XLSX worksheets to CSV, ported from the Go intake tool (`xlsx.go`): Go's
 * `xml.Unmarshal` into the `workbook`, `relationships`, `sharedStrings`, and
 * `worksheet` types, read from the parser port's element tree with the same
 * matching rules (direct children by local name; character data directly
 * inside an element; for a repeated element in a single field, the last one
 * wins). Kept as in Go, and recorded by the eval set: a rich-text shared
 * string (`<si><r><t>`) has no direct `<t>` child, so its text is dropped.
 */

import { GoError } from "../../shared/go-fs.ts";
import { goClean } from "../../shared/go-path.ts";
import { goQuote } from "../../shared/go-quote.ts";
import { goAtoi, goTrimSpace } from "../go-text.ts";
import { INTAKE_LIMITS, IntakeLimitError } from "../limits.ts";
import { CsvWriter } from "./csv.ts";
import { childElements, unmarshalAttr } from "./docx.ts";
import type { XmlToken } from "./go-xml.ts";
import type { XmlElement } from "./parsers.ts";

const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Go `resolvePackageRelationshipTarget`, with Go's `path` package (always `/`). */
export function resolvePackageRelationshipTarget(sourcePart: string, target: string): string {
  const cleanSource = goClean(sourcePart, "posix");
  if (cleanSource.startsWith("/") || cleanSource === ".." || cleanSource.startsWith("../")) {
    throw new GoError(`source part ${goQuote(sourcePart)} escapes package root`);
  }
  let resolved: string;
  if (target.startsWith("/")) {
    resolved = goClean(target.slice(1), "posix");
  } else {
    const slash = cleanSource.lastIndexOf("/");
    const dir = slash === -1 ? "." : goClean(cleanSource.slice(0, slash + 1), "posix");
    resolved = goClean(target === "" ? dir : `${dir}/${target}`, "posix");
  }
  if (resolved.startsWith("/") || resolved === ".." || resolved.startsWith("../")) throw new GoError("target escapes package root");
  return resolved;
}

/** Go `workbook`: the `sheets>sheet` elements, with their `name` and relationship `id`. */
export function workbookSheets(root: XmlElement): { name: string; rid: string }[] {
  const out: { name: string; rid: string }[] = [];
  for (const sheets of childElements(root, "sheets")) {
    for (const sheet of childElements(sheets, "sheet")) {
      out.push({ name: unmarshalAttr(sheet, "name") ?? "", rid: unmarshalAttr(sheet, "id", RELATIONSHIPS_NS) ?? "" });
    }
  }
  return out;
}

/** Go `relationships`: each `Relationship` with its `Id` and `Target`. */
export function workbookRelationships(root: XmlElement): { id: string; target: string }[] {
  return childElements(root, "Relationship").map((rel) => ({ id: unmarshalAttr(rel, "Id") ?? "", target: unmarshalAttr(rel, "Target") ?? "" }));
}

/**
 * Go `parseSharedStrings` from the token stream of `xl/sharedStrings.xml`
 * (`xml.Unmarshal` into `sharedStrings`): each `si` child of the root, its
 * direct `t` children's direct character data joined.
 */
export function sharedStrings(tokens: Iterable<XmlToken>): string[] {
  const out: string[] = [];
  let chars = 0;
  let depth = 0;
  let item: string[] | undefined;
  let text: string | undefined;
  for (const t of tokens) {
    if (t.t === "start") {
      depth++;
      if (depth === 2 && t.local === "si") item = [];
      else if (depth === 3 && item !== undefined && t.local === "t") text = "";
    } else if (t.t === "end") {
      if (depth === 3 && text !== undefined) {
        item!.push(text);
        text = undefined;
      } else if (depth === 2 && item !== undefined) {
        if (out.length >= INTAKE_LIMITS.xlsxMaxSharedStrings) throw new IntakeLimitError("xlsx", "the shared string count", `${INTAKE_LIMITS.xlsxMaxSharedStrings} strings`);
        out.push(item.join(""));
        item = undefined;
      }
      depth--;
    } else if (depth === 3 && text !== undefined) {
      chars += t.text.length;
      if (chars > INTAKE_LIMITS.xlsxMaxSharedStringChars) throw new IntakeLimitError("xlsx", "the shared string text", `${INTAKE_LIMITS.xlsxMaxSharedStringChars} characters`);
      text += t.text;
    }
  }
  return out;
}

/** Past Excel's last column the exact number does not matter: the caller refuses the row. */
const COLUMN_CLAMP = INTAKE_LIMITS.xlsxMaxColumns + 1;

/** Go `columnIndex`: the zero-based column of a cell reference such as `B7`, or -1. Columns past the limit read as the first column past it. */
export function columnIndex(ref: string): number {
  if (ref === "") return -1;
  let n = 0;
  let seen = false;
  for (const r of ref) {
    if (r >= "A" && r <= "Z") {
      n = Math.min(n * 26 + (r.charCodeAt(0) - 64), COLUMN_CLAMP);
      seen = true;
    } else if (r >= "a" && r <= "z") {
      n = Math.min(n * 26 + (r.charCodeAt(0) - 96), COLUMN_CLAMP);
      seen = true;
    } else {
      break;
    }
  }
  return seen ? n - 1 : -1;
}

interface Cell {
  ref: string;
  type: string;
  v: string;
}

/**
 * Go `worksheetToCSV` from the token stream of a worksheet (`xml.Unmarshal`
 * into `worksheet`: `sheetData>row` children, each row's direct `c`
 * children with their `r` and `t` attributes and the direct character data
 * of their last direct `v` child). Each row is written as soon as it ends,
 * so memory follows one row and the CSV, never the whole sheet.
 */
export function worksheetToCsv(tokens: Iterable<XmlToken>, shared: readonly string[]): Uint8Array {
  const csv = new CsvWriter(INTAKE_LIMITS.xlsxMaxCsvBytes, () => new IntakeLimitError("xlsx", "the CSV size of a worksheet", `${INTAKE_LIMITS.xlsxMaxCsvBytes / (1024 * 1024)} MiB`));
  let rowCount = 0;
  let allocated = 0;
  let depth = 0;
  let inSheetData = false;
  let cells: Cell[] | undefined;
  let cell: Cell | undefined;
  let v: string | undefined;
  for (const t of tokens) {
    if (t.t === "start") {
      depth++;
      if (depth === 2 && t.local === "sheetData") inSheetData = true;
      else if (depth === 3 && inSheetData && t.local === "row") cells = [];
      else if (depth === 4 && cells !== undefined && t.local === "c") {
        let ref = "";
        let type = "";
        for (const a of t.attrs) {
          if (a.local === "r") ref = a.value;
          if (a.local === "t") type = a.value;
        }
        cell = { ref, type, v: "" };
      } else if (depth === 5 && cell !== undefined && t.local === "v") v = "";
      continue;
    }
    if (t.t === "text") {
      if (depth === 5 && v !== undefined) v += t.text;
      continue;
    }
    if (depth === 5 && v !== undefined) {
      cell!.v = v;
      v = undefined;
    } else if (depth === 4 && cell !== undefined) {
      cells!.push(cell);
      cell = undefined;
    } else if (depth === 3 && cells !== undefined) {
      if (rowCount >= INTAKE_LIMITS.xlsxMaxRows) throw new IntakeLimitError("xlsx", "the worksheet row count", `${INTAKE_LIMITS.xlsxMaxRows} rows`);
      allocated += writeRow(csv, cells, shared, rowCount);
      if (allocated > INTAKE_LIMITS.xlsxMaxCells) throw new IntakeLimitError("xlsx", "the worksheet cell count", `${INTAKE_LIMITS.xlsxMaxCells} cells`);
      rowCount++;
      cells = undefined;
    } else if (depth === 2 && inSheetData) {
      inSheetData = false;
    }
    depth--;
  }
  return csv.bytes();
}

/** Go's loop body for one row: `rowWidth`, the values, and `csv.Writer.Write`. Returns the cells allocated. */
function writeRow(csv: CsvWriter, cells: readonly Cell[], shared: readonly string[], rowIndex: number): number {
  // The row's largest possible width, bounded before anything is allocated.
  let width = 0;
  for (const c of cells) {
    const idx = columnIndex(c.ref);
    if (idx >= width) width = idx + 1;
  }
  let bound = width;
  for (const c of cells) if (columnIndex(c.ref) < 0) bound++;
  if (bound > INTAKE_LIMITS.xlsxMaxColumns) throw new IntakeLimitError("xlsx", `the column count ${bound} of row ${rowIndex + 1}`, `${INTAKE_LIMITS.xlsxMaxColumns} columns`);
  const values: string[] = Array.from({ length: width }, () => "");
  for (const c of cells) {
    let idx = columnIndex(c.ref);
    if (idx < 0) idx = values.length;
    while (idx >= values.length) values.push("");
    values[idx] = cellValue(c, shared);
  }
  csv.writeText(values);
  return values.length;
}

/** Go `cellValue`. */
function cellValue(cell: Cell, shared: readonly string[]): string {
  if (cell.type === "s") {
    const i = goAtoi(goTrimSpace(cell.v));
    if (i !== undefined && i >= 0 && i < shared.length) return shared[i]!;
  }
  return cell.v;
}
