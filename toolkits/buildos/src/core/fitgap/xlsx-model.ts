/**
 * The workbook content model of `buildos fitgap workbook` (W1 R7 P9 t3, t5):
 * what the `fitgap.py` script sets through openpyxl, as plain data. The
 * writer (`xlsx-write.ts`) turns it into Office Open XML parts; the reader
 * (`xlsx-read.ts`) turns any workbook (openpyxl's or BuildOS's) back into
 * it, so two workbooks compare by content (parity exception PE-021), not by archive bytes.
 */

export interface XFont {
  bold?: boolean;
  italic?: boolean;
  /** `single` for a hyperlink. */
  underline?: string;
  size?: number;
  /** RRGGBB, upper case. */
  color?: string;
}

export interface XAlignment {
  vertical?: string;
  wrap?: boolean;
}

export interface XStyle {
  font?: XFont;
  /** A solid fill color, RRGGBB. */
  fill?: string;
  alignment?: XAlignment;
  /** A number format code, for example `0%`. */
  numFmt?: string;
}

/** A cell value. `e` (an Excel error such as `#N/A`) is only read back from a workbook another writer made: BuildOS writes such text as a string (divergence SD-19). */
export type XValue = { t: "s"; v: string } | { t: "n"; v: number } | { t: "b"; v: boolean } | { t: "f"; v: string } | { t: "e"; v: string } | null;

export interface XCell {
  value: XValue;
  style: XStyle;
}

export interface XRule {
  /** `cellIs`, `colorScale`, or `dataBar`. */
  type: string;
  sqref: string;
  priority: number;
  operator?: string;
  formula?: string[];
  /** For `cellIs`: the differential style. */
  dxf?: { fill?: string; fontColor?: string };
  /** For `colorScale` and `dataBar`: each `cfvo` as `type` or `type:val`. */
  cfvo?: string[];
  /** For `colorScale` and `dataBar`: RRGGBB. */
  colors?: string[];
}

export interface XTable {
  name: string;
  ref: string;
  columns: string[];
  style: string;
  showRowStripes: boolean;
}

export interface XSheet {
  name: string;
  /** `row,col` (1-based) to cell. */
  cells: Map<string, XCell>;
  colWidths: Map<number, number>;
  rowHeights: Map<number, number>;
  merges: string[];
  /** The top-left cell of the scrolling pane, for example `E2`. */
  freeze?: string;
  hyperlinks: { ref: string; location: string }[];
  tables: XTable[];
  rules: XRule[];
  /** Landscape, fit to one page wide and any number high. */
  landscape: boolean;
}

export interface XWorkbook {
  sheets: XSheet[];
  /** The index of the sheet that opens first. */
  activeTab: number;
  title: string;
  creator: string;
}

/** The ZIP port: writes and reads the `.xlsx` archive (the CLI passes one built on the bundled `fflate`). */
export interface XlsxZip {
  zip(entries: { name: string; data: Uint8Array }[]): Uint8Array;
  unzip(data: Uint8Array): { name: string; data: Uint8Array }[];
}

/** `A`, `B`, ..., `Z`, `AA`, ... (openpyxl's `get_column_letter`). */
export function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** `A1` to [row, col]. */
export function parseRef(ref: string): [number, number] {
  const m = /^([A-Z]+)([0-9]+)$/.exec(ref);
  if (m === null) throw new Error(`not a cell reference: ${ref}`);
  let col = 0;
  for (const ch of m[1]!) col = col * 26 + (ch.charCodeAt(0) - 64);
  return [Number(m[2]), col];
}

export function newSheet(name: string): XSheet {
  return { name, cells: new Map(), colWidths: new Map(), rowHeights: new Map(), merges: [], hyperlinks: [], tables: [], rules: [], landscape: false };
}
