/**
 * Hand-written Office Open XML parts for the fit-gap workbook (W1 R7 P9
 * t5): `[Content_Types].xml`, the package and workbook relationships, the
 * workbook, one worksheet per sheet (cells, column widths, row heights,
 * frozen panes, merged cells, conditional formats, internal links, page
 * setup), one table part per table, the styles (fonts, fills, cell formats,
 * differential formats), the shared strings, and the document properties.
 * The document properties hold the title and the creator the script set
 * (`fit-gap-analysis`), no user name, and a fixed time, so the same inputs
 * give the same bytes. The CLI's ZIP port zips the parts in this order.
 */

import { columnLetter, parseRef, type XAlignment, type XCell, type XFont, type XRule, type XSheet, type XStyle, type XWorkbook } from "./xlsx-model.ts";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** The fixed document time: the same workbook bytes for the same inputs. */
export const XLSX_FIXED_TIME = "2000-01-01T00:00:00Z";

/**
 * W1 R7 P9 review round 2 (P9-R2-13): a character XML 1.0 cannot hold: a
 * control character other than tab, line feed, and carriage return, the
 * noncharacters U+FFFE and U+FFFF, or a lone surrogate. The workbook cleans
 * free text and refuses a code or name that holds one before it builds, so
 * none reaches a part; the writer stops on one as an internal error.
 */
export const XML_FORBIDDEN = /[\x00-\x08\x0b\x0c\x0e-\x1f\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Text in an element. Tab, line feed, and carriage return stay as they are, as openpyxl writes them. */
export function xmlText(text: string): string {
  if (XML_FORBIDDEN.test(text)) throw new Error("internal error: text that XML cannot hold reached the workbook writer");
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * W1 R7 P9 review round 1 (P9-R1-20): entered text that already looks like
 * Office Open XML's own escape (`_xHHHH_`) gets its `_` written as `_x005F_`,
 * so Excel shows the text as it was entered (openpyxl wrote it as it was, and
 * Excel then showed the character with that code).
 */
export function encodeOoxmlEscapes(text: string): string {
  if (!text.includes("_x")) return text;
  return text.replace(/_(x[0-9A-Fa-f]{4}_)/g, "_x005F_$1");
}

/** An attribute value. */
export function xmlAttr(text: string): string {
  return xmlText(text).replace(/"/g, "&quot;").replace(/\t/g, "&#9;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
}

function fontXml(f: XFont): string {
  let s = "<font>";
  if (f.bold === true) s += '<b val="1"/>';
  if (f.italic === true) s += '<i val="1"/>';
  if (f.underline !== undefined) s += `<u val="${f.underline}"/>`;
  if (f.size !== undefined) s += `<sz val="${f.size}"/>`;
  if (f.color !== undefined) s += `<color rgb="FF${f.color}"/>`;
  return `${s}</font>`;
}

function fillXml(rgb: string): string {
  return `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor rgb="FF${rgb}"/></patternFill></fill>`;
}

function alignmentXml(a: XAlignment): string {
  return `<alignment${a.vertical !== undefined ? ` vertical="${a.vertical}"` : ""}${a.wrap === true ? ' wrapText="1"' : ""}/>`;
}

const BUILTIN_FORMATS: Record<string, number> = { General: 0, "0": 1, "0.00": 2, "0%": 9, "0.00%": 10 };

class Styles {
  readonly fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'];
  readonly fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  readonly numFmts: string[] = [];
  readonly xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  readonly dxfs: string[] = [];
  private readonly xfIndex = new Map<string, number>([[this.xfs[0]!, 0]]);

  private index(list: string[], xml: string): number {
    const at = list.indexOf(xml);
    if (at >= 0) return at;
    list.push(xml);
    return list.length - 1;
  }

  numFmtId(code: string): number {
    if (Object.hasOwn(BUILTIN_FORMATS, code)) return BUILTIN_FORMATS[code]!;
    const xml = `<numFmt numFmtId="${164 + this.numFmts.length}" formatCode="${xmlAttr(code)}"/>`;
    const at = this.numFmts.findIndex((x) => x.endsWith(`formatCode="${xmlAttr(code)}"/>`));
    if (at >= 0) return 164 + at;
    this.numFmts.push(xml);
    return 164 + this.numFmts.length - 1;
  }

  xf(style: XStyle): number {
    const fontId = style.font === undefined ? 0 : this.index(this.fonts, fontXml(style.font));
    const fillId = style.fill === undefined ? 0 : this.index(this.fills, fillXml(style.fill));
    const numFmtId = style.numFmt === undefined ? 0 : this.numFmtId(style.numFmt);
    const applies = `${fontId !== 0 ? ' applyFont="1"' : ""}${fillId !== 0 ? ' applyFill="1"' : ""}${numFmtId !== 0 ? ' applyNumberFormat="1"' : ""}${style.alignment !== undefined ? ' applyAlignment="1"' : ""}`;
    const body = style.alignment === undefined ? "" : alignmentXml(style.alignment);
    const xml = `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${applies}${body === "" ? "/>" : `>${body}</xf>`}`;
    const known = this.xfIndex.get(xml);
    if (known !== undefined) return known;
    this.xfs.push(xml);
    this.xfIndex.set(xml, this.xfs.length - 1);
    return this.xfs.length - 1;
  }

  dxf(rule: NonNullable<XRule["dxf"]>): number {
    let xml = "<dxf>";
    if (rule.fontColor !== undefined) xml += `<font><color rgb="FF${rule.fontColor}"/></font>`;
    if (rule.fill !== undefined) xml += fillXml(rule.fill);
    xml += "</dxf>";
    return this.index(this.dxfs, xml);
  }

  xml(): string {
    const numFmts = this.numFmts.length > 0 ? `<numFmts count="${this.numFmts.length}">${this.numFmts.join("")}</numFmts>` : "";
    return (
      `${HEAD}<styleSheet xmlns="${MAIN}">${numFmts}` +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      `<dxfs count="${this.dxfs.length}">${this.dxfs.join("")}</dxfs>` +
      '<tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>' +
      "</styleSheet>"
    );
  }
}

class SharedStrings {
  readonly list: string[] = [];
  private readonly index = new Map<string, number>();
  /** Every cell that references a string (the `count` attribute; P9-R1-20). */
  private refs = 0;
  add(text: string): number {
    this.refs++;
    const known = this.index.get(text);
    if (known !== undefined) return known;
    this.list.push(text);
    this.index.set(text, this.list.length - 1);
    return this.list.length - 1;
  }
  xml(): string {
    const items = this.list.map((s) => `<si><t${/^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : ""}>${xmlText(encodeOoxmlEscapes(s))}</t></si>`).join("");
    return `${HEAD}<sst xmlns="${MAIN}" count="${this.refs}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

function numberText(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(n);
}

function hasStyle(style: XStyle): boolean {
  return style.font !== undefined || style.fill !== undefined || style.alignment !== undefined || style.numFmt !== undefined;
}

function cfvoXml(spec: string): string {
  const [type, val] = spec.split(":");
  return `<cfvo type="${type}"${val === undefined ? "" : ` val="${val}"`}/>`;
}

function ruleXml(rule: XRule, styles: Styles): string {
  if (rule.type === "cellIs") {
    const dxfId = styles.dxf(rule.dxf ?? {});
    return `<cfRule type="cellIs" dxfId="${dxfId}" priority="${rule.priority}" operator="${rule.operator}">${(rule.formula ?? []).map((f) => `<formula>${xmlText(f)}</formula>`).join("")}</cfRule>`;
  }
  const colors = (rule.colors ?? []).map((c) => `<color rgb="FF${c}"/>`).join("");
  const cfvo = (rule.cfvo ?? []).map(cfvoXml).join("");
  if (rule.type === "colorScale") return `<cfRule type="colorScale" priority="${rule.priority}"><colorScale>${cfvo}${colors}</colorScale></cfRule>`;
  return `<cfRule type="dataBar" priority="${rule.priority}"><dataBar>${cfvo}${colors}</dataBar></cfRule>`;
}

function paneXml(freeze: string): string {
  const [row, col] = parseRef(freeze);
  const xSplit = col - 1;
  const ySplit = row - 1;
  if (xSplit === 0 && ySplit === 0) return "";
  if (xSplit === 0) return `<pane ySplit="${ySplit}" topLeftCell="${freeze}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${freeze}" sqref="${freeze}"/>`;
  if (ySplit === 0) return `<pane xSplit="${xSplit}" topLeftCell="${freeze}" activePane="topRight" state="frozen"/><selection pane="topRight" activeCell="${freeze}" sqref="${freeze}"/>`;
  return `<pane xSplit="${xSplit}" ySplit="${ySplit}" topLeftCell="${freeze}" activePane="bottomRight" state="frozen"/><selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="${freeze}" sqref="${freeze}"/>`;
}

function sheetXml(sheet: XSheet, index: number, active: boolean, styles: Styles, strings: SharedStrings, tableIds: number[]): string {
  const rows = new Map<number, [number, XCell][]>();
  let maxRow = 1;
  let maxCol = 1;
  for (const [key, cell] of sheet.cells) {
    if (cell.value === null && !hasStyle(cell.style)) continue;
    const [r, c] = key.split(",").map(Number) as [number, number];
    let list = rows.get(r);
    if (list === undefined) {
      list = [];
      rows.set(r, list);
    }
    list.push([c, cell]);
    maxRow = Math.max(maxRow, r);
    maxCol = Math.max(maxCol, c);
  }
  for (const r of sheet.rowHeights.keys()) if (!rows.has(r)) rows.set(r, []);
  let s = `${HEAD}<worksheet xmlns="${MAIN}" xmlns:r="${REL}">`;
  if (sheet.landscape) s += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
  s += `<dimension ref="${rows.size === 0 ? "A1" : `A1:${columnLetter(maxCol)}${maxRow}`}"/>`;
  s += `<sheetViews><sheetView${active ? ' tabSelected="1"' : ""} workbookViewId="0">${sheet.freeze === undefined ? "" : paneXml(sheet.freeze)}</sheetView></sheetViews>`;
  s += '<sheetFormatPr defaultRowHeight="15"/>';
  const widths = [...sheet.colWidths].sort((a, b) => a[0] - b[0]);
  if (widths.length > 0) s += `<cols>${widths.map(([c, w]) => `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  s += "<sheetData>";
  for (const r of [...rows.keys()].sort((a, b) => a - b)) {
    const height = sheet.rowHeights.get(r);
    s += `<row r="${r}"${height === undefined ? "" : ` ht="${height}" customHeight="1"`}>`;
    for (const [c, cell] of rows.get(r)!.sort((a, b) => a[0] - b[0])) {
      const ref = `${columnLetter(c)}${r}`;
      const xf = hasStyle(cell.style) ? styles.xf(cell.style) : 0;
      const sAttr = xf === 0 ? "" : ` s="${xf}"`;
      const v = cell.value;
      if (v === null) s += `<c r="${ref}"${sAttr}/>`;
      else if (v.t === "s") s += `<c r="${ref}"${sAttr} t="s"><v>${strings.add(v.v)}</v></c>`;
      else if (v.t === "n") s += `<c r="${ref}"${sAttr}><v>${numberText(v.v)}</v></c>`;
      else if (v.t === "b") s += `<c r="${ref}"${sAttr} t="b"><v>${v.v ? 1 : 0}</v></c>`;
      else if (v.t === "e") s += `<c r="${ref}"${sAttr} t="e"><v>${xmlText(v.v)}</v></c>`;
      else s += `<c r="${ref}"${sAttr}><f>${xmlText(v.v)}</f></c>`;
    }
    s += "</row>";
  }
  s += "</sheetData>";
  if (sheet.merges.length > 0) s += `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`;
  const groups = new Map<string, XRule[]>();
  for (const rule of sheet.rules) {
    const list = groups.get(rule.sqref);
    if (list === undefined) groups.set(rule.sqref, [rule]);
    else list.push(rule);
  }
  for (const [sqref, rules] of groups) s += `<conditionalFormatting sqref="${sqref}">${rules.map((rule) => ruleXml(rule, styles)).join("")}</conditionalFormatting>`;
  if (sheet.hyperlinks.length > 0) s += `<hyperlinks>${sheet.hyperlinks.map((h) => `<hyperlink ref="${h.ref}" location="${xmlAttr(h.location)}"/>`).join("")}</hyperlinks>`;
  s += '<pageMargins left="0.75" right="0.75" top="1" bottom="1" header="0.5" footer="0.5"/>';
  if (sheet.landscape) s += '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
  if (tableIds.length > 0) s += `<tableParts count="${tableIds.length}">${tableIds.map((_, i) => `<tablePart r:id="rId${i + 1}"/>`).join("")}</tableParts>`;
  void index;
  return `${s}</worksheet>`;
}

function tableXml(table: XSheet["tables"][number], id: number): string {
  const cols = table.columns.map((name, i) => `<tableColumn id="${i + 1}" name="${xmlAttr(name)}"/>`).join("");
  return `${HEAD}<table xmlns="${MAIN}" id="${id}" name="${xmlAttr(table.name)}" displayName="${xmlAttr(table.name)}" ref="${table.ref}" totalsRowShown="0"><autoFilter ref="${table.ref}"/><tableColumns count="${table.columns.length}">${cols}</tableColumns><tableStyleInfo name="${xmlAttr(table.style)}" showFirstColumn="0" showLastColumn="0" showRowStripes="${table.showRowStripes ? 1 : 0}" showColumnStripes="0"/></table>`;
}

/** Every part of the workbook, in archive order. */
export function writeWorkbookParts(wb: XWorkbook): { name: string; data: Uint8Array }[] {
  const enc = new TextEncoder();
  const styles = new Styles();
  const strings = new SharedStrings();
  const parts: { name: string; data: string }[] = [];
  const sheetParts: { name: string; data: string }[] = [];
  const tableParts: { name: string; data: string }[] = [];
  let tableId = 0;
  wb.sheets.forEach((sheet, i) => {
    const ids: number[] = [];
    const rels: string[] = [];
    for (const table of sheet.tables) {
      tableId += 1;
      ids.push(tableId);
      rels.push(`<Relationship Id="rId${ids.length}" Type="${REL}/table" Target="../tables/table${tableId}.xml"/>`);
      tableParts.push({ name: `xl/tables/table${tableId}.xml`, data: tableXml(table, tableId) });
    }
    sheetParts.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sheet, i, i === wb.activeTab, styles, strings, ids) });
    if (rels.length > 0) sheetParts.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: `${HEAD}<Relationships xmlns="${PKG_REL}">${rels.join("")}</Relationships>` });
  });
  const n = wb.sheets.length;
  const overrides = [
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    ...wb.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
    ...tableParts.map((t) => `<Override PartName="/${t.name}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`),
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
  ];
  parts.push({
    name: "[Content_Types].xml",
    data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.join("")}</Types>`,
  });
  parts.push({
    name: "_rels/.rels",
    data: `${HEAD}<Relationships xmlns="${PKG_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  });
  parts.push({
    name: "docProps/app.xml",
    data: `${HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BuildOS</Application></Properties>`,
  });
  parts.push({
    name: "docProps/core.xml",
    data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlText(wb.title)}</dc:title><dc:creator>${xmlText(wb.creator)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${XLSX_FIXED_TIME}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${XLSX_FIXED_TIME}</dcterms:modified></cp:coreProperties>`,
  });
  const sheetsXml = wb.sheets.map((s, i) => `<sheet name="${xmlAttr(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  parts.push({
    name: "xl/workbook.xml",
    data: `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView activeTab="${wb.activeTab}"/></bookViews><sheets>${sheetsXml}</sheets></workbook>`,
  });
  parts.push({
    name: "xl/_rels/workbook.xml.rels",
    data: `${HEAD}<Relationships xmlns="${PKG_REL}">${wb.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
  });
  parts.push(...sheetParts, ...tableParts);
  // Styles and strings are complete only after every sheet is written.
  parts.push({ name: "xl/styles.xml", data: styles.xml() });
  parts.push({ name: "xl/sharedStrings.xml", data: strings.xml() });
  return parts.map((p) => ({ name: p.name, data: enc.encode(p.data) }));
}
