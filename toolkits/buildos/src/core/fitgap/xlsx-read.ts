/**
 * Reads an `.xlsx` workbook into the content model of `xlsx-model.ts` (W1
 * R7 P9 t3): sheet names and order, the opening sheet, cell values and
 * types (shared, inline, and formula strings, numbers, booleans,
 * formulas), the font, fill, alignment, and number format of each cell,
 * merged cells, column widths, row heights, frozen panes, internal links,
 * tables, conditional formats, page setup, and the title and creator. It
 * reads the XML with the repository's port of Go's `encoding/xml`
 * (`src/core/intake/convert/go-xml.ts`), the same reader the intake XLSX
 * converter uses, and it reads openpyxl's workbooks and BuildOS's alike.
 * `buildos fitgap workbook` uses it to check what it wrote; the parity test
 * uses it to compare a BuildOS workbook with the script's (parity exception
 * PE-021).
 *
 * Colors are compared as `RRGGBB`: the alpha byte is dropped (openpyxl
 * writes `00`, BuildOS `FF`; Excel draws both the same). A cell whose font
 * is the workbook's default font (index 0) has no font in the model.
 */

import { goXmlParse, goXmlTokens } from "../intake/convert/go-xml.ts";
import type { XmlElement } from "../intake/convert/parsers.ts";
import { newSheet, type XAlignment, type XFont, type XRule, type XSheet, type XStyle, type XValue, type XWorkbook, parseRef } from "./xlsx-model.ts";

const BUILTIN_FORMATS: Record<number, string> = { 0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 14: "mm-dd-yy", 49: "@" };

function children(el: XmlElement | undefined, local: string): XmlElement[] {
  return (el?.children ?? []).filter((c): c is XmlElement => c.kind === "element" && c.local === local);
}

function child(el: XmlElement | undefined, local: string): XmlElement | undefined {
  return children(el, local)[0];
}

function attr(el: XmlElement | undefined, local: string): string | undefined {
  return el?.attrs.find((a) => a.local === local)?.value;
}

function text(el: XmlElement | undefined): string {
  if (el === undefined) return "";
  return el.children.map((c) => (c.kind === "text" ? c.text : text(c))).join("");
}

function rgb(el: XmlElement | undefined): string | undefined {
  const value = attr(el, "rgb");
  return value === undefined ? undefined : value.slice(-6).toUpperCase();
}

function boolAttr(el: XmlElement, name: string, fallback: boolean): boolean {
  const v = attr(el, name);
  if (v === undefined) return fallback;
  return v === "1" || v === "true";
}

interface Styles {
  xfs: XStyle[];
  dxfs: { fill?: string; fontColor?: string }[];
}

function parseFont(el: XmlElement): XFont {
  const font: XFont = {};
  const b = child(el, "b");
  if (b !== undefined && boolAttr(b, "val", true)) font.bold = true;
  const i = child(el, "i");
  if (i !== undefined && boolAttr(i, "val", true)) font.italic = true;
  const u = child(el, "u");
  if (u !== undefined) font.underline = attr(u, "val") ?? "single";
  const sz = child(el, "sz");
  if (sz !== undefined && attr(sz, "val") !== undefined) font.size = Number(attr(sz, "val"));
  const color = rgb(child(el, "color"));
  if (color !== undefined) font.color = color;
  return font;
}

function parseFill(el: XmlElement | undefined): string | undefined {
  const pattern = child(el, "patternFill");
  if (pattern === undefined || attr(pattern, "patternType") !== "solid") return undefined;
  return rgb(child(pattern, "fgColor")) ?? rgb(child(pattern, "bgColor"));
}

function parseStyles(data: Uint8Array | undefined): Styles {
  if (data === undefined) return { xfs: [], dxfs: [] };
  const root = goXmlParse(data, "unmarshal");
  const custom = new Map<number, string>();
  for (const f of children(child(root, "numFmts"), "numFmt")) custom.set(Number(attr(f, "numFmtId")), attr(f, "formatCode") ?? "");
  const fonts = children(child(root, "fonts"), "font").map(parseFont);
  const fills = children(child(root, "fills"), "fill").map(parseFill);
  const xfs = children(child(root, "cellXfs"), "xf").map((xf): XStyle => {
    const style: XStyle = {};
    const fontId = Number(attr(xf, "fontId") ?? 0);
    if (fontId !== 0 && fonts[fontId] !== undefined) style.font = fonts[fontId];
    const fill = fills[Number(attr(xf, "fillId") ?? 0)];
    if (fill !== undefined) style.fill = fill;
    const numFmtId = Number(attr(xf, "numFmtId") ?? 0);
    if (numFmtId !== 0) style.numFmt = custom.get(numFmtId) ?? BUILTIN_FORMATS[numFmtId] ?? `#${numFmtId}`;
    const alignment = child(xf, "alignment");
    if (alignment !== undefined) {
      const a: XAlignment = {};
      const vertical = attr(alignment, "vertical");
      if (vertical !== undefined) a.vertical = vertical;
      if (boolAttr(alignment, "wrapText", false)) a.wrap = true;
      if (a.vertical !== undefined || a.wrap !== undefined) style.alignment = a;
    }
    return style;
  });
  const dxfs = children(child(root, "dxfs"), "dxf").map((dxf) => {
    const out: { fill?: string; fontColor?: string } = {};
    const fill = child(dxf, "fill");
    const pattern = child(fill, "patternFill");
    const color = rgb(child(pattern, "bgColor")) ?? rgb(child(pattern, "fgColor"));
    if (color !== undefined) out.fill = color;
    const fontColor = rgb(child(child(dxf, "font"), "color"));
    if (fontColor !== undefined) out.fontColor = fontColor;
    return out;
  });
  return { xfs, dxfs };
}

/**
 * Office Open XML's own escape in text (ECMA-376 Part 1, 22.9.2.19
 * `ST_Xstring`): `_xHHHH_` is the character with that code, read as Excel
 * reads it (W1 R7 P9 review round 1, P9-R1-20). So `_x005F_` is `_`.
 */
export function decodeOoxmlEscapes(text: string): string {
  if (!text.includes("_x")) return text;
  return text.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function parseSharedStrings(data: Uint8Array | undefined): string[] {
  if (data === undefined) return [];
  const out: string[] = [];
  let depth = 0;
  let item: string | undefined;
  let inT = false;
  let inRph = false;
  for (const t of goXmlTokens(data, "unmarshal")) {
    if (t.t === "start") {
      depth++;
      if (depth === 2 && t.local === "si") item = "";
      else if (t.local === "rPh") inRph = true;
      else if (t.local === "t" && item !== undefined && !inRph) inT = true;
    } else if (t.t === "end") {
      if (t.local === "t") inT = false;
      else if (t.local === "rPh") inRph = false;
      else if (depth === 2 && t.local === "si" && item !== undefined) {
        out.push(decodeOoxmlEscapes(item));
        item = undefined;
      }
      depth--;
    } else if (inT && item !== undefined) item += t.text;
  }
  return out;
}

function resolveTarget(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function relsOf(files: Map<string, Uint8Array>, part: string): Map<string, string> {
  const slash = part.lastIndexOf("/");
  const relsPath = `${part.slice(0, slash + 1)}_rels/${part.slice(slash + 1)}.rels`;
  const data = files.get(relsPath);
  const out = new Map<string, string>();
  if (data === undefined) return out;
  for (const rel of children(goXmlParse(data, "unmarshal"), "Relationship")) out.set(attr(rel, "Id") ?? "", resolveTarget(part, attr(rel, "Target") ?? ""));
  return out;
}

function parseSheet(name: string, data: Uint8Array, path: string, files: Map<string, Uint8Array>, styles: Styles, strings: string[]): XSheet {
  const sheet = newSheet(name);
  let fitToPage = false;
  let orientation: string | undefined;
  let fitToWidth: string | undefined;
  let fitToHeight: string | undefined;
  const tableRids: string[] = [];
  let cell: { ref: string; s: number; t: string; v: string; f?: string; inT: boolean; inline: string; seenV: boolean } | undefined;
  let inV = false;
  let inF = false;
  let currentRow = 0;
  let cf: { sqref: string } | undefined;
  let rule: XRule | undefined;
  let inFormula = false;
  let formulaText = "";
  for (const t of goXmlTokens(data, "unmarshal")) {
    if (t.t === "start") {
      const a = (n: string): string | undefined => t.attrs.find((x) => x.local === n)?.value;
      switch (t.local) {
        case "pageSetUpPr":
          fitToPage = a("fitToPage") === "1" || a("fitToPage") === "true";
          break;
        case "pane":
          if (a("state") === "frozen" || a("state") === "frozenSplit") sheet.freeze = a("topLeftCell") ?? "";
          break;
        case "col": {
          const min = Number(a("min"));
          const max = Number(a("max"));
          const width = a("width");
          if (width !== undefined) for (let c = min; c <= max; c++) sheet.colWidths.set(c, Number(width));
          break;
        }
        case "row":
          currentRow = Number(a("r"));
          if (a("ht") !== undefined && (a("customHeight") === "1" || a("customHeight") === "true")) sheet.rowHeights.set(currentRow, Number(a("ht")));
          break;
        case "c":
          cell = { ref: a("r") ?? "", s: Number(a("s") ?? 0), t: a("t") ?? "n", v: "", inT: false, inline: "", seenV: false };
          break;
        case "v":
          inV = true;
          if (cell !== undefined) cell.seenV = true;
          break;
        case "f":
          inF = true;
          if (cell !== undefined) cell.f = "";
          break;
        case "t":
          if (cell !== undefined && cell.t === "inlineStr") cell.inT = true;
          break;
        case "mergeCell":
          sheet.merges.push(a("ref") ?? "");
          break;
        case "conditionalFormatting":
          cf = { sqref: a("sqref") ?? "" };
          break;
        case "cfRule": {
          const dxfId = a("dxfId");
          rule = { type: a("type") ?? "", sqref: cf?.sqref ?? "", priority: Number(a("priority") ?? 0) };
          const operator = a("operator");
          if (operator !== undefined) rule.operator = operator;
          if (dxfId !== undefined) {
            const dxf = styles.dxfs[Number(dxfId)];
            if (dxf !== undefined) rule.dxf = { ...dxf };
          }
          break;
        }
        case "formula":
          inFormula = true;
          formulaText = "";
          break;
        case "cfvo":
          if (rule !== undefined) (rule.cfvo ??= []).push(a("val") === undefined ? (a("type") ?? "") : `${a("type") ?? ""}:${a("val")}`);
          break;
        case "color":
          if (rule !== undefined && a("rgb") !== undefined) (rule.colors ??= []).push(a("rgb")!.slice(-6).toUpperCase());
          break;
        case "hyperlink":
          sheet.hyperlinks.push({ ref: a("ref") ?? "", location: a("location") ?? "" });
          break;
        case "pageSetup":
          orientation = a("orientation");
          fitToWidth = a("fitToWidth");
          fitToHeight = a("fitToHeight");
          break;
        case "tablePart": {
          const rid = t.attrs.find((x) => x.local === "id")?.value;
          if (rid !== undefined) tableRids.push(rid);
          break;
        }
      }
    } else if (t.t === "end") {
      switch (t.local) {
        case "v":
          inV = false;
          break;
        case "f":
          inF = false;
          break;
        case "t":
          if (cell !== undefined) cell.inT = false;
          break;
        case "c":
          if (cell !== undefined) {
            let value: XValue = null;
            if (cell.f !== undefined) value = { t: "f", v: cell.f };
            else if (cell.t === "s" && cell.seenV) value = { t: "s", v: strings[Number(cell.v)] ?? "" };
            else if (cell.t === "inlineStr") value = { t: "s", v: decodeOoxmlEscapes(cell.inline) };
            else if (cell.t === "str" && cell.seenV) value = { t: "s", v: cell.v };
            else if (cell.t === "b" && cell.seenV) value = { t: "b", v: cell.v === "1" || cell.v === "true" };
            else if (cell.t === "e" && cell.seenV) value = { t: "e", v: cell.v };
            else if (cell.seenV && cell.v !== "") value = { t: "n", v: Number(cell.v) };
            const [r, c] = parseRef(cell.ref);
            sheet.cells.set(`${r},${c}`, { value, style: styles.xfs[cell.s] ?? {} });
            cell = undefined;
          }
          break;
        case "formula":
          inFormula = false;
          if (rule !== undefined) (rule.formula ??= []).push(formulaText);
          break;
        case "cfRule":
          if (rule !== undefined) sheet.rules.push(rule);
          rule = undefined;
          break;
        case "conditionalFormatting":
          cf = undefined;
          break;
      }
    } else {
      if (cell !== undefined && inV) cell.v += t.text;
      else if (cell !== undefined && inF) cell.f = (cell.f ?? "") + t.text;
      else if (cell !== undefined && cell.inT) cell.inline += t.text;
      else if (inFormula) formulaText += t.text;
    }
  }
  sheet.landscape = orientation === "landscape" && fitToPage && fitToWidth === "1" && fitToHeight === "0";
  sheet.rules.sort((x, y) => x.priority - y.priority);
  const rels = relsOf(files, path);
  for (const rid of tableRids) {
    const target = rels.get(rid);
    const tdata = target === undefined ? undefined : files.get(target);
    if (tdata === undefined) continue;
    const root = goXmlParse(tdata, "unmarshal");
    const info = child(root, "tableStyleInfo");
    sheet.tables.push({
      name: attr(root, "displayName") ?? attr(root, "name") ?? "",
      ref: attr(root, "ref") ?? "",
      columns: children(child(root, "tableColumns"), "tableColumn").map((c) => attr(c, "name") ?? ""),
      style: attr(info, "name") ?? "",
      showRowStripes: info !== undefined && boolAttr(info, "showRowStripes", false),
    });
  }
  return sheet;
}

/** Reads the workbook content from its ZIP entries. */
export function readWorkbook(entries: { name: string; data: Uint8Array }[]): XWorkbook {
  const files = new Map(entries.map((e) => [e.name, e.data]));
  const workbookData = files.get("xl/workbook.xml");
  if (workbookData === undefined) throw new Error("the workbook has no xl/workbook.xml part");
  const root = goXmlParse(workbookData, "unmarshal");
  const rels = relsOf(files, "xl/workbook.xml");
  const styles = parseStyles(files.get("xl/styles.xml"));
  const strings = parseSharedStrings(files.get("xl/sharedStrings.xml"));
  const sheets: XSheet[] = [];
  for (const s of children(child(root, "sheets"), "sheet")) {
    const rid = s.attrs.find((a) => a.local === "id" && a.space !== "")?.value ?? "";
    const path = rels.get(rid) ?? "";
    const data = files.get(path);
    if (data === undefined) throw new Error(`the workbook names a sheet part that is missing: ${path}`);
    sheets.push(parseSheet(attr(s, "name") ?? "", data, path, files, styles, strings));
  }
  const view = child(child(root, "bookViews"), "workbookView");
  const core = files.get("docProps/core.xml");
  let title = "";
  let creator = "";
  if (core !== undefined) {
    const c = goXmlParse(core, "unmarshal");
    title = text(child(c, "title"));
    creator = text(child(c, "creator"));
  }
  return { sheets, activeTab: Number(attr(view, "activeTab") ?? 0), title, creator };
}
