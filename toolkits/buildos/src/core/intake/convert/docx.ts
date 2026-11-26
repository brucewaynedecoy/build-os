/**
 * DOCX to Markdown, ported from the Go intake tool (`docx.go`). The Go code
 * walks the `word/document.xml` token stream (`encoding/xml` `Decoder.Token`)
 * and reads `word/numbering.xml` with `xml.Unmarshal`; this port walks the
 * same element tree from the parser port in document order.
 */

import { goAtoi, goToLower, goTrimSpace, normalizeSpace } from "../go-text.ts";
import type { XmlToken } from "./go-xml.ts";
import type { XmlElement } from "./parsers.ts";

/** Go `attrValue`: the first attribute with this local name, in any namespace. */
export function attrValue(el: XmlElement, local: string): string {
  return el.attrs.find((a) => a.local === local)?.value ?? "";
}

/** Go `xml.Unmarshal` of an `attr` field with no namespace: the last attribute with this local name. */
export function unmarshalAttr(el: XmlElement, local: string, space = ""): string | undefined {
  let value: string | undefined;
  for (const a of el.attrs) if (a.local === local && (space === "" || a.space === space)) value = a.value;
  return value;
}

/** The direct child elements with this local name, in any namespace (Go `xml:"name"`). */
export function childElements(el: XmlElement | undefined, local: string): XmlElement[] {
  return (el?.children ?? []).filter((c): c is XmlElement => c.kind === "element" && c.local === local);
}

/** Go `xml.Unmarshal` of a string field from an element: its direct character data only. */
export function directText(el: XmlElement): string {
  return el.children.map((c) => (c.kind === "text" ? c.text : "")).join("");
}

/** Go `markdownTable`. */
export function markdownTable(rows: readonly (readonly string[])[]): string {
  let width = 0;
  for (const row of rows) if (row.length > width) width = row.length;
  if (width === 0) return "";
  let b = "";
  const writeRow = (row: readonly string[]) => {
    b += "|";
    for (let i = 0; i < width; i++) {
      const cell = i < row.length ? row[i]!.replaceAll("|", "\\|") : "";
      b += ` ${cell} |`;
    }
    b += "\n";
  };
  writeRow(rows[0]!);
  b += "|";
  for (let i = 0; i < width; i++) b += " --- |";
  b += "\n";
  for (const row of rows.slice(1)) writeRow(row);
  return b.replace(/\n+$/, "");
}

/** Go `appendBlock`. */
function appendBlock(out: string[], block: string): void {
  block = goTrimSpace(block);
  if (block === "") return;
  if (out.length > 0 && out[out.length - 1] !== "") out.push("");
  out.push(...block.split("\n"));
}

/** Go `isMarkdownListLine`. */
function isMarkdownListLine(line: string): boolean {
  const trimmed = line.replace(/^ +/, "");
  return trimmed.startsWith("- ") || trimmed.startsWith("1. ");
}

/** Go `appendListItem`. */
function appendListItem(out: string[], line: string): void {
  if (out.length > 0 && out[out.length - 1] !== "" && !isMarkdownListLine(out[out.length - 1]!)) out.push("");
  out.push(line);
}

const LITERAL_BULLETS = ["", "•", "·", "◦", "▪", ""];

/** Go `literalBulletText`. */
function literalBulletText(text: string): [string, boolean] {
  const trimmed = goTrimSpace(text);
  for (const bullet of LITERAL_BULLETS) {
    if (trimmed.startsWith(bullet)) return [normalizeSpace(goTrimSpace(trimmed.slice(bullet.length))), true];
  }
  return [text, false];
}

/** Numbering formats by `numId`, then by level (Go `docxNumbering`). */
export type DocxNumbering = Map<string, Map<number, string>>;

const ORDERED_FORMATS = new Set(["decimal", "decimalzero", "lowerletter", "upperletter", "lowerroman", "upperroman"]);

/** Go `docxNumbering.marker`. */
function marker(numbering: DocxNumbering, numID: string, ilvl: number): string {
  const format = numbering.get(numID)?.get(ilvl) ?? "";
  return ORDERED_FORMATS.has(goToLower(format)) ? "1." : "-";
}

/**
 * Go `parseNumbering`: `xml.Unmarshal` into `wordNumbering`. `root` is the
 * parsed `word/numbering.xml`, or undefined when it is missing, empty, or
 * not valid XML (Go then uses no numbering).
 */
export function parseNumbering(root: XmlElement | undefined): DocxNumbering {
  const numbering: DocxNumbering = new Map();
  if (root === undefined) return numbering;
  const abstractFormats = new Map<string, Map<number, string>>();
  for (const abstract of childElements(root, "abstractNum")) {
    const levels = new Map<number, string>();
    for (const level of childElements(abstract, "lvl")) {
      let format = "";
      for (const numFmt of childElements(level, "numFmt")) format = unmarshalAttr(numFmt, "val") ?? format;
      const n = goAtoi(unmarshalAttr(level, "ilvl") ?? "");
      if (n !== undefined) levels.set(n, format);
    }
    abstractFormats.set(unmarshalAttr(abstract, "abstractNumId") ?? "", levels);
  }
  for (const num of childElements(root, "num")) {
    let abstractID = "";
    for (const ref of childElements(num, "abstractNumId")) abstractID = unmarshalAttr(ref, "val") ?? abstractID;
    const formats = abstractFormats.get(abstractID);
    if (formats !== undefined) numbering.set(unmarshalAttr(num, "numId") ?? "", formats);
  }
  return numbering;
}

interface Paragraph {
  text: string;
  style: string;
  numID: string;
  ilvl: number;
  hasNum: boolean;
  bold: boolean;
  underline: boolean;
}

const freshParagraph = (): Paragraph => ({ text: "", style: "", numID: "", ilvl: -1, hasNum: false, bold: false, underline: false });

/** Go `boolElementActive` and `underlineElementActive`. */
function elementActive(el: XmlElement, off: readonly string[]): boolean {
  return !off.includes(goToLower(attrValue(el, "val")));
}

/** Go `headingLevel`. */
function headingLevel(para: Paragraph): number {
  const style = goToLower(para.style);
  if (style.startsWith("heading")) {
    for (const r of style) if (r >= "1" && r <= "6") return Number(r);
    return 2;
  }
  if (style === "title") return 1;
  if (!para.hasNum && para.bold && para.underline) return 2;
  return 0;
}

type Token = { t: "start"; el: XmlElement } | { t: "end"; el: XmlElement } | { t: "text"; text: string };

/** Go's token stream of `word/document.xml` (`Decoder.Token` to EOF), as `documentXmlToMarkdown` reads it. */
export function* docxTokens(stream: Iterable<XmlToken>): Generator<Token> {
  for (const t of stream) {
    if (t.t === "text") yield t;
    else yield { t: t.t, el: { kind: "element", local: t.local, space: t.space, attrs: t.t === "start" ? t.attrs : [], children: [] } };
  }
}

/** Go `documentXMLToMarkdown`. */
export function documentXmlToMarkdown(document: Iterable<Token>, numbering: DocxNumbering): string {
  const out: string[] = [];
  let para = freshParagraph();
  let cell = "";
  let row: string[] = [];
  let table: string[][] = [];
  let inTable = false;
  let inCell = false;
  let inParagraph = false;
  let inText = false;
  let literalBulletParent = false;

  const renderParagraph = () => {
    const text = normalizeSpace(para.text);
    if (text === "") return;
    const level = headingLevel(para);
    if (level > 0) {
      appendBlock(out, `${"#".repeat(level)} ${literalBulletText(text)[0]}`);
      literalBulletParent = false;
      return;
    }
    const [stripped, isBullet] = literalBulletText(text);
    if (isBullet) {
      appendListItem(out, `- ${para.bold || para.underline ? `**${stripped}**` : stripped}`);
      literalBulletParent = true;
      return;
    }
    if (para.hasNum) {
      let lvl = para.ilvl < 0 ? 0 : para.ilvl;
      if (literalBulletParent) lvl++;
      appendListItem(out, `${"  ".repeat(lvl)}${marker(numbering, para.numID, para.ilvl)} ${text}`);
      return;
    }
    appendBlock(out, text);
    literalBulletParent = false;
  };
  const flushPara = () => {
    if (!inParagraph) return;
    if (!inTable) renderParagraph();
    para = freshParagraph();
    inParagraph = false;
  };
  const flushTable = () => {
    if (table.length === 0) return;
    appendBlock(out, markdownTable(table));
    table = [];
    literalBulletParent = false;
  };

  for (const token of document) {
    if (token.t === "start") {
      const el = token.el;
      switch (el.local) {
        case "p":
          para = freshParagraph();
          inParagraph = true;
          break;
        case "tbl":
          flushPara();
          inTable = true;
          table = [];
          break;
        case "pStyle":
          if (inParagraph) para.style = attrValue(el, "val");
          break;
        case "ilvl":
          if (inParagraph) {
            const n = goAtoi(attrValue(el, "val"));
            if (n !== undefined) para.ilvl = n;
          }
          break;
        case "numId":
          if (inParagraph) {
            para.numID = attrValue(el, "val");
            para.hasNum = para.numID !== "";
          }
          break;
        case "b":
          if (inParagraph && elementActive(el, ["0", "false", "off"])) para.bold = true;
          break;
        case "u":
          if (inParagraph && elementActive(el, ["0", "false", "off", "none"])) para.underline = true;
          break;
        case "tr":
          row = [];
          break;
        case "tc":
          inCell = true;
          cell = "";
          break;
        case "t":
          inText = true;
          break;
        case "tab":
          if (inCell) cell += "\t";
          else if (inParagraph) para.text += "\t";
          break;
        case "br":
          if (inCell) cell += "\n";
          else if (inParagraph) para.text += "\n";
          break;
      }
    } else if (token.t === "end") {
      switch (token.el.local) {
        case "p":
          if (inCell) {
            if (goTrimSpace(cell) !== "") cell += " ";
          } else {
            flushPara();
          }
          break;
        case "tbl":
          inTable = false;
          flushTable();
          break;
        case "tc":
          inCell = false;
          row.push(normalizeSpace(cell));
          break;
        case "tr":
          if (row.length > 0) table.push(row);
          break;
        case "t":
          inText = false;
          break;
      }
    } else if (inText) {
      if (inCell) cell += token.text;
      else if (inParagraph) para.text += token.text;
    }
  }
  flushPara();
  flushTable();
  return `${goTrimSpace(out.join("\n"))}\n`;
}
