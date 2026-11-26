// Generates the conversion eval set (W1 R7 P4 t1) byte for byte.
//
//   node test/conversion-eval/generate-eval.ts [<out-root>]
//
// With no argument it writes into test/conversion-eval/. It writes the eval
// inputs under inputs/, manifest.json, and the review page review.html. It
// never writes the reference text under references/: a person owns that text
// after review (t3). The review page shows each reference, so regenerate the
// page after any reference change. generate.test.ts regenerates into memory
// and checks that every committed generated file matches.
//
// The output depends only on this file, the reference files, and the stored
// ZIP writer in ../golden/generate-fixtures.ts. ZIP entries are stored with a
// fixed 1980-01-01 timestamp. PDF streams and PNG image data use stored
// deflate blocks, so no zlib version changes a byte. No clock or locale is
// read.
//
// All content is invented for these tests. It names no real person,
// organization, client, or address. The sample organization is "the Sample
// Housing Cooperative". People appear only as roles.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { png, zip } from "../golden/generate-fixtures.ts";
import { EVAL_ROOT, type EvalFile, type EvalManifest, parseReference } from "./references.ts";

// ---------------------------------------------------------------- bytes

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

/** A zlib stream made only of stored deflate blocks: valid FlateDecode, and the same bytes on every zlib. */
function zlibStored(data: Uint8Array): Buffer {
  const parts: Buffer[] = [Buffer.from([0x78, 0x01])];
  let i = 0;
  do {
    const block = data.subarray(i, Math.min(i + 65535, data.length));
    const final = i + 65535 >= data.length ? 1 : 0;
    const len = block.length;
    parts.push(Buffer.from([final, len & 0xff, len >> 8, ~len & 0xff, (~len >> 8) & 0xff]), Buffer.from(block));
    i += 65535;
  } while (i < data.length);
  parts.push(u32be(adler32(data)));
  return Buffer.concat(parts);
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typed = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
  return Buffer.concat([u32be(data.length), typed, u32be(crc32(typed))]);
}

// ---------------------------------------------------------------- 1-bit bitmaps (scanned pages)

/** A 1-bit image. Each row is packed, most significant bit first. A set bit is white. */
interface Bitmap {
  width: number;
  height: number;
  rows: Uint8Array[];
}

function bitmap(width: number, height: number): Bitmap {
  const rowBytes = Math.ceil(width / 8);
  return { width, height, rows: Array.from({ length: height }, () => new Uint8Array(rowBytes).fill(0xff)) };
}

function ink(bm: Bitmap, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= bm.width || y >= bm.height) return;
  const row = bm.rows[y] as Uint8Array;
  row[x >> 3] = (row[x >> 3] as number) & ~(0x80 >> (x & 7));
}

function rule(bm: Bitmap, x1: number, x2: number, y: number, thickness = 2): void {
  for (let t = 0; t < thickness; t++) for (let x = x1; x <= x2; x++) ink(bm, x, y + t);
}

// A 5x7 pixel font for the scanned-page text. Only the image holds this text;
// the PDF has no text layer for it.
const GLYPHS: Record<string, string> = {
  A: " ### |#   #|#   #|#####|#   #|#   #|#   #", B: "#### |#   #|#   #|#### |#   #|#   #|#### ",
  C: " ####|#    |#    |#    |#    |#    | ####", D: "#### |#   #|#   #|#   #|#   #|#   #|#### ",
  E: "#####|#    |#    |#### |#    |#    |#####", F: "#####|#    |#    |#### |#    |#    |#    ",
  G: " ####|#    |#    |#  ##|#   #|#   #| ####", H: "#   #|#   #|#   #|#####|#   #|#   #|#   #",
  I: "#####|  #  |  #  |  #  |  #  |  #  |#####", J: "  ###|   # |   # |   # |   # |#  # | ##  ",
  K: "#   #|#  # |# #  |##   |# #  |#  # |#   #", L: "#    |#    |#    |#    |#    |#    |#####",
  M: "#   #|## ##|# # #|# # #|#   #|#   #|#   #", N: "#   #|##  #|# # #|#  ##|#   #|#   #|#   #",
  O: " ### |#   #|#   #|#   #|#   #|#   #| ### ", P: "#### |#   #|#   #|#### |#    |#    |#    ",
  Q: " ### |#   #|#   #|#   #|# # #|#  # | ## #", R: "#### |#   #|#   #|#### |# #  |#  # |#   #",
  S: " ####|#    |#    | ### |    #|    #|#### ", T: "#####|  #  |  #  |  #  |  #  |  #  |  #  ",
  U: "#   #|#   #|#   #|#   #|#   #|#   #| ### ", V: "#   #|#   #|#   #|#   #|#   #| # # |  #  ",
  W: "#   #|#   #|#   #|# # #|# # #|## ##|#   #", X: "#   #|#   #| # # |  #  | # # |#   #|#   #",
  Y: "#   #|#   #| # # |  #  |  #  |  #  |  #  ", Z: "#####|    #|   # |  #  | #   |#    |#####",
  "0": " ### |#   #|#  ##|# # #|##  #|#   #| ### ", "1": "  #  | ##  |  #  |  #  |  #  |  #  | ### ",
  "2": " ### |#   #|    #|   # |  #  | #   |#####", "3": "#####|   # |  #  |   # |    #|#   #| ### ",
  "4": "   # |  ## | # # |#  # |#####|   # |   # ", "5": "#####|#    |#### |    #|    #|#   #| ### ",
  "6": "  ## | #   |#    |#### |#   #|#   #| ### ", "7": "#####|    #|   # |  #  | #   | #   | #   ",
  "8": " ### |#   #|#   #| ### |#   #|#   #| ### ", "9": " ### |#   #|#   #| ####|    #|   # | ##  ",
  "-": "     |     |     |#####|     |     |     ", ".": "     |     |     |     |     | ##  | ##  ",
  ":": "     | ##  | ##  |     | ##  | ##  |     ", "/": "    #|    #|   # |  #  | #   |#    |#    ",
  " ": "     |     |     |     |     |     |     ",
};

function stamp(bm: Bitmap, text: string, x: number, y: number, scale: number): void {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (glyph === undefined) throw new Error(`no glyph for ${JSON.stringify(ch)}`);
    glyph.split("|").forEach((row, gy) => {
      [...row].forEach((cell, gx) => {
        if (cell !== "#") return;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) ink(bm, cx + gx * scale + sx, y + gy * scale + sy);
      });
    });
    cx += 6 * scale;
  }
}

/** Sparse dark specks, as a scanner leaves. A fixed seed keeps the bytes stable. */
function speckle(bm: Bitmap, count: number, seed: number): void {
  let s = seed >>> 0;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < count; i++) ink(bm, next() % bm.width, next() % bm.height);
}

function bitmapPng(bm: Bitmap): Buffer {
  const header = Buffer.concat([u32be(bm.width), u32be(bm.height), Buffer.from([1, 0, 0, 0, 0])]);
  const raw = Buffer.concat(bm.rows.map((row) => Buffer.concat([Buffer.from([0]), Buffer.from(row)])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlibStored(raw)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function signInSheetScan(): Bitmap {
  const bm = bitmap(480, 300);
  stamp(bm, "VOLUNTEER SIGN-IN SHEET", 24, 18, 3);
  stamp(bm, "DAY: 18 OCT 2026", 24, 54, 2);
  const rows = [["VOLUNTEER", "TASK", "HOURS"], ["VOLUNTEER 1", "GUTTERS", "3"], ["VOLUNTEER 2", "BIKE SHED", "4"], ["VOLUNTEER 3", "LOST PROPERTY", "2"], ["VOLUNTEER 4", "GUTTERS", "5"]];
  rows.forEach((row, r) => {
    const y = 96 + r * 38;
    stamp(bm, row[0] as string, 24, y, 2);
    stamp(bm, row[1] as string, 200, y, 2);
    stamp(bm, row[2] as string, 400, y, 2);
    rule(bm, 18, 462, y + 24, r === 0 ? 3 : 1);
  });
  speckle(bm, 420, 7);
  return bm;
}

function repairNoticeScan(): Bitmap {
  const bm = bitmap(400, 520);
  stamp(bm, "SAMPLE HOUSING", 30, 30, 3);
  stamp(bm, "COOPERATIVE", 30, 60, 3);
  rule(bm, 30, 370, 92, 3);
  stamp(bm, "REPAIR NOTICE", 30, 120, 4);
  ["WATER WILL BE OFF", "ON 4 NOV 2026", "FROM 09:00 TO 12:00.", "NORTH BUILDING ONLY.", "", "SORRY FOR THE TROUBLE.", "- MAINTENANCE TEAM"].forEach((line, i) => {
    stamp(bm, line, 30, 190 + i * 36, 2);
  });
  speckle(bm, 700, 11);
  return bm;
}

// ---------------------------------------------------------------- PDF

interface PdfText {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  text: string;
  /** Write the line as a TJ array: strings and kerning numbers in 1/1000 em. A large negative number is a word gap with no space character. */
  tj?: (string | number)[];
}

interface PdfPage {
  texts: PdfText[];
  /** Ruled lines as [x1, y1, x2, y2]. */
  rules?: [number, number, number, number][];
  /** A scanned image drawn over most of the page. The page has no text layer for it. */
  scan?: { x: number; y: number; w: number; h: number; bitmap: Bitmap };
}

interface PdfDoc {
  title: string;
  pages: PdfPage[];
}

// WinAnsiEncoding codes for the non-ASCII characters the eval PDFs use.
const WIN_ANSI: Record<string, number> = { "€": 0x80, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "°": 0xb0, "·": 0xb7, "é": 0xe9 };

function pdfLiteral(text: string): string {
  let out = "(";
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (cp >= 0x20 && cp < 0x7f) out += ch;
    else {
      const code = WIN_ANSI[ch];
      if (code === undefined) throw new Error(`no WinAnsi code for ${JSON.stringify(ch)}`);
      out += `\\${code.toString(8).padStart(3, "0")}`;
    }
  }
  return `${out})`;
}

// Helvetica advance widths in 1/1000 em, for layout only.
const HELVETICA: Record<string, number> = (() => {
  const w: Record<string, number> = {};
  const set = (chars: string, width: number) => {
    for (const ch of chars) w[ch] = width;
  };
  set(" !,./:;I[\\]fijlt'·", 278);
  set("0123456789#$?_abdeghnopqu€–", 556);
  set("ckrsvxyzJ", 500);
  set("ABEKPSVXY&", 667);
  set("CDHNRUw", 722);
  set("FTZ", 611);
  set("GOQ", 778);
  set("Mm%", 833);
  set("W", 944);
  set("L", 556);
  set("\"", 355);
  set("()-*`", 333);
  set("r", 333);
  set("’‘", 222);
  set("“”", 333);
  set("—", 1000);
  set("•", 350);
  set("°", 400);
  set("é", 556);
  set("+<=>~", 584);
  set("@", 1015);
  return w;
})();

function textWidth(text: string, size: number): number {
  let total = 0;
  for (const ch of text) total += HELVETICA[ch] ?? 556;
  return (total * size) / 1000;
}

function wrap(text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line === "" ? word : `${line} ${word}`;
    if (line !== "" && textWidth(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** Lays out a wrapped paragraph from the top line down and returns the y below it. */
function flow(out: PdfText[], text: string, o: { x: number; y: number; size: number; width: number; bold?: boolean; leading?: number; tj?: boolean }): number {
  const leading = o.leading ?? o.size * 1.35;
  let y = o.y;
  for (const line of wrap(text, o.size, o.width)) {
    const t: PdfText = { x: o.x, y, size: o.size, text: line };
    if (o.bold === true) t.bold = true;
    if (o.tj === true) t.tj = typesetLine(line);
    out.push(t);
    y -= leading;
  }
  return y;
}

/** A TeX-style line: words placed by kerning gaps, with no space characters, and pair kerns inside some words. */
function typesetLine(line: string): (string | number)[] {
  const KERN_PAIRS: Record<string, number> = { Tw: 40, Tr: 30, Wa: 60, Yo: 70, Av: 40, "o,": 15 };
  const parts: (string | number)[] = [];
  line.split(" ").forEach((word, i) => {
    if (i > 0) parts.push(-333);
    let chunk = "";
    for (let c = 0; c < word.length; c++) {
      chunk += word.charAt(c);
      const kern = KERN_PAIRS[word.slice(c, c + 2)];
      if (kern !== undefined && c + 1 < word.length) {
        parts.push(chunk, kern);
        chunk = "";
      }
    }
    if (chunk !== "") parts.push(chunk);
  });
  return parts;
}

function pdf(doc: PdfDoc): Buffer {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer): number => {
    objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
    return objects.length;
  };
  const stream = (dict: string, data: Buffer): Buffer =>
    Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream", "latin1")]);
  const catalog = add("");
  const pagesObj = add("");
  const info = add(`<< /Title ${pdfLiteral(doc.title)} /Producer (BuildOS conversion eval generator) /CreationDate (D:20261001090000Z) >>`);
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const page of doc.pages) {
    const ops: string[] = [];
    if ((page.rules ?? []).length > 0) ops.push("0.6 w");
    for (const [x1, y1, x2, y2] of page.rules ?? []) ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    let image: number | undefined;
    if (page.scan !== undefined) {
      const { bitmap: bm, x, y, w, h } = page.scan;
      image = add(stream(`/Type /XObject /Subtype /Image /Width ${bm.width} /Height ${bm.height} /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode`, zlibStored(Buffer.concat(bm.rows))));
      ops.push(`q ${w} 0 0 ${h} ${x} ${y} cm /Im1 Do Q`);
    }
    for (const t of page.texts) {
      const show = t.tj !== undefined ? `[${t.tj.map((p) => (typeof p === "number" ? String(p) : pdfLiteral(p))).join(" ")}] TJ` : `${pdfLiteral(t.text)} Tj`;
      ops.push(`BT /${t.bold === true ? "F2" : "F1"} ${t.size} Tf 1 0 0 1 ${t.x} ${t.y} Tm ${show} ET`);
    }
    const content = add(stream("/Filter /FlateDecode", zlibStored(Buffer.from(`${ops.join("\n")}\n`, "latin1"))));
    const xobject = image !== undefined ? ` /XObject << /Im1 ${image} 0 R >>` : "";
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >>${xobject} >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`, "latin1");
  objects[pagesObj - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`, "latin1");
  const out: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let length = (out[0] as Buffer).length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    out.push(chunk);
    length += chunk.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  out.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${length}\n%%EOF\n`, "latin1"));
  return Buffer.concat(out);
}

const ORG = "Sample Housing Cooperative";

function annualReportPdf(): PdfDoc {
  const p1: PdfText[] = [];
  let y = 720;
  p1.push({ x: 72, y, size: 18, bold: true, text: "Annual Report Summary 2025–26" });
  y -= 22;
  p1.push({ x: 72, y, size: 11, text: `${ORG} · Prepared for the annual general meeting` });
  y -= 36;
  p1.push({ x: 72, y, size: 13, bold: true, text: "Overview" });
  y = flow(p1, "The cooperative ended the year with all 64 homes occupied and a small operating surplus. Members voted to keep monthly charges flat for a second year. The board thanks the volunteers who gave more than 1,900 hours of their time.", { x: 72, y: y - 20, size: 11, width: 468 });
  p1.push({ x: 72, y: y - 14, size: 13, bold: true, text: "Membership" });
  y = flow(p1, "Nine households moved in and seven moved out. The waiting list grew to 112 households, the longest it has been since the cooperative opened. The membership committee ran four welcome evenings and one open day.", { x: 72, y: y - 34, size: 11, width: 468 });
  flow(p1, "Two new members joined the board in March. Training for new board members now runs over three evenings instead of one. Year-round support comes from a mentor on the board.", { x: 72, y: y - 8, size: 11, width: 468, tj: true });
  const p2: PdfText[] = [];
  y = 720;
  p2.push({ x: 72, y, size: 13, bold: true, text: "Finances" });
  y = flow(p2, "Income from monthly charges was €612,400. Spending was €598,150, so the surplus was €14,250. Most of the surplus goes to the repairs reserve, which now holds €186,000.", { x: 72, y: y - 20, size: 11, width: 468 });
  y = flow(p2, "Energy costs fell by 9% after the boiler upgrade in the south building. Insurance rose by 6%.", { x: 72, y: y - 8, size: 11, width: 468 });
  p2.push({ x: 72, y: y - 14, size: 13, bold: true, text: "Looking Ahead" });
  flow(p2, "Next year the cooperative will replace the north building’s roof, add bicycle storage, and review the visitor policy. The board will report on progress at each quarterly members’ meeting.", { x: 72, y: y - 34, size: 11, width: 468 });
  return { title: "Annual Report Summary 2025–26", pages: [{ texts: p1 }, { texts: p2 }] };
}

function newsletterPdf(): PdfDoc {
  const t: PdfText[] = [];
  t.push({ x: 54, y: 730, size: 22, bold: true, text: "Cooperative News" });
  t.push({ x: 54, y: 708, size: 11, text: "Autumn 2026 · Issue 14" });
  const column = (x: number, stories: [string, string][]) => {
    let y = 672;
    for (const [heading, body] of stories) {
      t.push({ x, y, size: 12, bold: true, text: heading });
      y = flow(t, body, { x, y: y - 18, size: 10, width: 240, leading: 13 }) - 16;
    }
  };
  column(54, [
    ["Roof Works Start in May", "Contractors will put up scaffolding on the north building in the first week of May. Work should take ten weeks. Balconies on the top floor will be closed while the scaffold is up. The maintenance committee will post a weekly update in the lobby."],
    ["Bike Store Plans", "The bike store will go in the old drying room. It will hold 40 bikes on two-tier racks, plus space for two cargo bikes. Members can comment on the plan until 15 December."],
  ]);
  column(318, [
    ["New Members Welcome Evening", "Seven households joined the cooperative this autumn. A welcome evening takes place on 28 November in the common room. Bring a dish to share if you can."],
    ["Garden Volunteers Needed", "The roof garden team needs three more volunteers for the winter. Tasks include covering the raised beds, clearing leaves, and checking the water butts once a week."],
  ]);
  t.push({ x: 54, y: 40, size: 9, text: `${ORG} · Page 1 of 1` });
  return { title: "Cooperative News, Autumn 2026", pages: [{ texts: t, rules: [[54, 694, 558, 694], [306, 400, 306, 684], [54, 56, 558, 56]] }] };
}

function ratesTablePdf(): PdfDoc {
  const t: PdfText[] = [];
  t.push({ x: 72, y: 720, size: 16, bold: true, text: "Common Room and Guest Suite Rates" });
  let y = flow(t, "Rates apply from 1 January 2027. Members pay the member rate. Non-member groups need a member to sponsor the booking.", { x: 72, y: 690, size: 11, width: 468 });
  const rows = [
    ["Space", "Member rate", "Non-member rate", "Deposit"],
    ["Common room, half day", "€20", "€45", "€50"],
    ["Common room, full day", "€35", "€80", "€50"],
    ["Roof garden, evening", "€15", "€40", "€25"],
    ["Guest suite, per night", "€25", "Not available", "€40"],
    ["Workshop, per hour", "€5", "€12", "None"],
    ["Meeting room, per hour", "€4", "€10", "None"],
  ];
  const rightEdges = [0, 330, 450, 536];
  const rules: [number, number, number, number][] = [];
  y -= 16;
  rows.forEach((row, r) => {
    rules.push([66, y + 14, 542, y + 14]);
    row.forEach((cell, c) => {
      const size = 10.5;
      const x = c === 0 ? 72 : (rightEdges[c] as number) - Math.round(textWidth(cell, size));
      const text: PdfText = { x, y, size, text: cell };
      if (r === 0) text.bold = true;
      t.push(text);
    });
    y -= 20;
  });
  rules.push([66, y + 14, 542, y + 14]);
  flow(t, "Deposits are returned within ten working days if the space is left clean. Cancel at least 48 hours ahead to avoid a charge.", { x: 72, y: y - 14, size: 11, width: 468 });
  return { title: "Common Room and Guest Suite Rates", pages: [{ texts: t, rules }] };
}

function petPolicyPdf(): PdfDoc {
  const bodies: [string, string][][] = [
    [
      ["Pet Policy", "This policy sets out which pets members may keep and how to keep them without disturbing neighbours. It applies to every home and to all shared spaces."],
      ["Pets Allowed", "Members may keep up to two cats or one dog per home. Small caged animals and fish do not need approval. Any other animal needs written approval from the board."],
    ],
    [
      ["Registration", "Register each cat or dog with the front desk within two weeks of moving in or getting the pet. Bring proof of vaccination. The front desk keeps the register and shares it only with the maintenance team when they need to enter a home."],
      ["Shared Spaces", "Dogs must be on a lead in all corridors, lifts, and the courtyard. Pets are not allowed in the common room, the laundry room, or the roof garden, except for assistance animals."],
    ],
    [
      ["Complaints", "If a pet causes repeated noise or damage, the membership committee will first talk with the member. If the problem continues, the committee may ask the board to withdraw approval."],
      ["Review", "The board will review this policy every two years."],
    ],
  ];
  const pages = bodies.map((sections, i): PdfPage => {
    const t: PdfText[] = [{ x: 72, y: 760, size: 9, text: `${ORG} — Pet Policy` }];
    let y = 700;
    sections.forEach(([heading, body], s) => {
      t.push({ x: 72, y, size: i === 0 && s === 0 ? 16 : 13, bold: true, text: heading });
      y = flow(t, body, { x: 72, y: y - 22, size: 11, width: 468 }) - 18;
    });
    const pageLabel = `Page ${i + 1} of ${bodies.length}`;
    t.push({ x: 72, y: 40, size: 9, text: "Approved by the board on 3 June 2026" });
    t.push({ x: 540 - Math.round(textWidth(pageLabel, 9)), y: 40, size: 9, text: pageLabel });
    return { texts: t, rules: [[72, 752, 540, 752], [72, 52, 540, 52]] };
  });
  return { title: "Pet Policy", pages };
}

function signupWithScanPdf(): PdfDoc {
  const t: PdfText[] = [];
  t.push({ x: 72, y: 720, size: 16, bold: true, text: "Volunteer Day Sign-Up" });
  let y = flow(t, "The autumn volunteer day is on Saturday 18 October 2026, from 10:00 to 15:00. Tasks include clearing gutters, painting the bike shed, and sorting the lost-property box.", { x: 72, y: 692, size: 11, width: 468 });
  t.push({ x: 72, y: y - 14, size: 12, bold: true, text: "How to Sign Up" });
  flow(t, "Add your name to the sheet at the front desk. A scanned copy of the sheet is on the next page for members who cannot reach the desk.", { x: 72, y: y - 34, size: 11, width: 468 });
  return {
    title: "Volunteer Day Sign-Up",
    pages: [{ texts: t }, { texts: [], scan: { x: 66, y: 404, w: 480, h: 300, bitmap: signInSheetScan() } }],
  };
}

function scannedNoticePdf(): PdfDoc {
  return { title: "Scanned repair notice", pages: [{ texts: [], scan: { x: 106, y: 136, w: 400, h: 520, bitmap: repairNoticeScan() } }] };
}

// ---------------------------------------------------------------- DOCX

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Wrap the run in Word's spelling-check markers, as Word leaves them in real files. */
  proof?: boolean;
}

type DocBlock =
  | { kind: "heading"; style: "Title" | "Heading1" | "Heading2" | "Heading3"; text: string }
  | { kind: "para"; runs: (string | Run)[] }
  | { kind: "item"; num: "1" | "2"; level: number; runs: (string | Run)[] }
  | { kind: "table"; rows: string[][]; widths: number[] }
  | { kind: "image"; alt: string; media: string };

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wRun(run: string | Run): string {
  const r: Run = typeof run === "string" ? { text: run } : run;
  const rpr: string[] = [];
  if (r.bold === true) rpr.push("<w:b/><w:bCs/>");
  if (r.italic === true) rpr.push("<w:i/><w:iCs/>");
  if (r.underline === true) rpr.push('<w:u w:val="single"/>');
  const pieces = r.text.split(/(\t|\n)/).filter((p) => p !== "").map((p) => (p === "\t" ? "<w:tab/>" : p === "\n" ? "<w:br/>" : `<w:t xml:space="preserve">${xml(p)}</w:t>`));
  const body = `<w:r>${rpr.length > 0 ? `<w:rPr>${rpr.join("")}</w:rPr>` : ""}${pieces.join("")}</w:r>`;
  return r.proof === true ? `<w:proofErr w:type="spellStart"/>${body}<w:proofErr w:type="spellEnd"/>` : body;
}

function wPara(runs: (string | Run)[], ppr = ""): string {
  return `<w:p>${ppr !== "" ? `<w:pPr>${ppr}</w:pPr>` : ""}${runs.map(wRun).join("")}</w:p>`;
}

function docxBody(blocks: DocBlock[]): { xml: string; media: string[] } {
  const media: string[] = [];
  let bookmark = 0;
  const parts = blocks.map((b) => {
    switch (b.kind) {
      case "heading":
        bookmark++;
        return `<w:p><w:pPr><w:pStyle w:val="${b.style}"/></w:pPr><w:bookmarkStart w:id="${bookmark}" w:name="_Toc${1000 + bookmark}"/>${wRun(b.text)}<w:bookmarkEnd w:id="${bookmark}"/></w:p>`;
      case "para":
        return wPara(b.runs);
      case "item":
        return wPara(b.runs, `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${b.level}"/><w:numId w:val="${b.num}"/></w:numPr>`);
      case "table": {
        const grid = b.widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
        const rows = b.rows.map((row, r) => `<w:tr>${row.map((cell, c) => `<w:tc><w:tcPr><w:tcW w:w="${b.widths[c]}" w:type="dxa"/></w:tcPr>${cell.split("\n").map((p) => wPara([{ text: p, bold: r === 0 }])).join("")}</w:tc>`).join("")}</w:tr>`).join("");
        return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
      }
      case "image": {
        media.push(b.media);
        const rid = `rIdImg${media.length}`;
        const id = media.length;
        return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="2743200" cy="1828800"/><wp:docPr id="${id}" name="Picture ${id}" descr="${xml(b.alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(b.media)}" descr="${xml(b.alt)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2743200" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
      }
    }
  });
  return { xml: parts.join(""), media };
}

const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="56"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>
`;

const DOCX_NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>
`;

function docx(blocks: DocBlock[], media: Record<string, Buffer>): Buffer {
  const body = docxBody(blocks);
  const rels = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    ...body.media.map((name, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`),
  ];
  const entries: [string, string | Uint8Array][] = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>
`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>
`],
    ["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Conversion eval generator</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-01T09:00:00Z</dcterms:created></cp:coreProperties>
`],
    ["word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS}><w:body>${body.xml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>
`],
    ["word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>
`],
    ["word/styles.xml", DOCX_STYLES],
    ["word/numbering.xml", DOCX_NUMBERING],
  ];
  for (const name of body.media) {
    const data = media[name];
    if (data === undefined) throw new Error(`missing media ${name}`);
    entries.push([`word/media/${name}`, data]);
  }
  return zip(entries);
}

const h = (style: "Title" | "Heading1" | "Heading2" | "Heading3", text: string): DocBlock => ({ kind: "heading", style, text });
const p = (...runs: (string | Run)[]): DocBlock => ({ kind: "para", runs });
const li = (num: "1" | "2", level: number, ...runs: (string | Run)[]): DocBlock => ({ kind: "item", num, level, runs });

const SITE_PLAN_PNG = png(12, 3);

function handbookModel(): DocBlock[] {
  return [
    h("Title", `${ORG} Operations Handbook`),
    p("This handbook explains how the sample housing cooperative runs day-to-day operations. It is written for new committee members and staff. Every name in it is invented."),
    p({ text: "Version 3.2 — reviewed in October 2026.", italic: true }),
    h("Heading1", "1. Roles and Responsibilities"),
    p("The cooperative has three standing committees. Each committee meets once a month and reports to the board."),
    h("Heading2", "Board"),
    p("The board sets the annual budget, approves contracts over the spending limit, and hires the operations manager."),
    h("Heading2", "Maintenance Committee"),
    p("The ", { text: "main", proof: true }, { text: "tenance", proof: true }, " committee plans repairs, reviews requests, and keeps the contractor list current."),
    h("Heading2", "Membership Committee"),
    p("The membership committee runs the waiting list, welcomes new members, and handles move-outs."),
    h("Heading1", "2. Handling a Repair Request"),
    p("Use these steps for every request, even small ones:"),
    li("1", 0, "Log the request in the maintenance tracker within one working day."),
    li("1", 0, "Assign a priority:"),
    li("1", 1, { text: "High:", bold: true }, " no heat, no water, a safety risk, or a door that will not lock."),
    li("1", 1, { text: "Medium:", bold: true }, " a fault that affects daily use."),
    li("1", 1, { text: "Low:", bold: true }, " anything else."),
    li("1", 0, "Book a contractor or a volunteer."),
    li("1", 0, "Confirm the fix with the member and close the request."),
    p({ text: "Emergency Contacts", bold: true, underline: true }),
    p("Out of hours:\tcall the on-call line listed on the notice board."),
    li("2", 0, "Water or gas leak: shut the valve first, then call."),
    li("2", 0, "Lift fault: call the lift contractor."),
    li("2", 0, "Fire: leave the building and call emergency services."),
    h("Heading1", "3. Spending Limits"),
    p("The operations manager may approve spending up to the limits below. Anything above a limit goes to the board."),
    {
      kind: "table",
      widths: [2600, 2000, 2000, 2400],
      rows: [
        ["Category", "Single item limit", "Monthly limit", "Notes"],
        ["Routine repairs", "€500", "€3,000", "Two quotes over €250"],
        ["Cleaning supplies", "€150", "€600", "Use the approved supplier"],
        ["Emergency work", "€2,000", "No limit", "Report to the board\nwithin 48 hours"],
        ["Office costs", "€100", "€400", "Keep all receipts"],
      ],
    },
    p("Limits are reviewed each January.\nThe next review is in January 2027."),
    h("Heading1", "4. Records"),
    p("Keep signed contracts for seven years. Keep repair photos for two years. Store both in the shared drive under the year and the building name."),
    { kind: "image", alt: "Site plan of the three buildings", media: "image1.png" },
  ];
}

function minutesModel(): DocBlock[] {
  return [
    h("Heading1", "Maintenance Committee Minutes"),
    p({ text: "Date:", bold: true }, " 14 October 2026. ", { text: "Location:", bold: true }, " the common room."),
    p("Present: chair, treasurer, two volunteers, and the operations manager. Apologies: the secretary."),
    h("Heading2", "Agenda"),
    p("• Review of open repair requests"),
    p("• Winter heating check"),
    p("• Contractor list"),
    h("Heading2", "1. Open Repair Requests"),
    p("Seven requests are open. Two are high priority: the dead outlet in the annex and the radiator in the south building, which is fixed now."),
    h("Heading2", "2. Winter Heating Check"),
    p("The heating contractor will service both boilers in the first week of November. Members get two days’ notice before each visit."),
    {
      kind: "table",
      widths: [4200, 2600, 2200],
      rows: [
        ["Decision", "Owner", "Due"],
        ["Approve the boiler service quote", "Treasurer", "31 Oct 2026"],
        ["Send the visit notice to members", "Operations manager", "3 Nov 2026"],
      ],
    },
    h("Heading2", "3. Contractor List"),
    p("The list has eleven contractors. The committee removed one roofing firm after two missed visits."),
    h("Heading2", "Actions"),
    li("1", 0, "Treasurer to sign the boiler quote."),
    li("1", 0, "Operations manager to update the contractor list."),
    p({ text: "Next meeting:", bold: true }, " 11 November 2026."),
  ];
}

// ---------------------------------------------------------------- XLSX

type CellValue = string | number | { formula: string; value: number } | { rich: { text: string; bold?: boolean }[] };

interface SheetModel {
  name: string;
  rows: { r: number; cells: [string, CellValue][]; header?: boolean }[];
}

function budgetModel(): SheetModel[] {
  const f = (formula: string, value: number) => ({ formula, value });
  return [
    {
      name: "Summary",
      rows: [
        { r: 1, cells: [["A", `${ORG} — 2026 Budget`]] },
        { r: 3, header: true, cells: [["A", "Category"], ["B", "Budget"], ["C", "Spent to date"], ["D", "Remaining"]] },
        { r: 4, cells: [["A", "Maintenance"], ["B", 48000], ["C", 31250.5], ["D", f("B4-C4", 16749.5)]] },
        { r: 5, cells: [["A", "Utilities"], ["B", 36000], ["C", 29880], ["D", f("B5-C5", 6120)]] },
        { r: 6, cells: [["A", "Insurance"], ["B", 12500], ["C", 12500], ["D", f("B6-C6", 0)]] },
        { r: 7, cells: [["A", "Administration"], ["B", 8000], ["C", 5410.75], ["D", f("B7-C7", 2589.25)]] },
        { r: 8, header: true, cells: [["A", "Total"], ["B", f("SUM(B4:B7)", 104500)], ["C", f("SUM(C4:C7)", 79041.25)], ["D", f("SUM(D4:D7)", 25458.75)]] },
        { r: 10, cells: [["A", "Figures in euros. Spent to date runs to 30 September 2026."]] },
      ],
    },
    {
      name: "Q3 Expenses",
      rows: [
        { r: 1, header: true, cells: [["A", "Date"], ["B", "Vendor"], ["C", "Category"], ["D", "Amount"], ["E", "Invoice"], ["F", "Note"]] },
        { r: 2, cells: [["A", "2026-07-03"], ["B", "Sample Plumbing & Heating"], ["C", "Maintenance"], ["D", 640], ["E", "INV-2207"]] },
        { r: 3, cells: [["A", "2026-07-15"], ["B", "Sample Grid Energy"], ["C", "Utilities"], ["D", 2410.4], ["E", "EL-7781"]] },
        { r: 4, cells: [["A", "2026-07-28"], ["B", "Sample Office Supply"], ["C", "Administration"], ["D", 86.9], ["F", "Paid by card"]] },
        { r: 5, cells: [["A", "2026-08-04"], ["B", "Sample Lift Services"], ["C", "Maintenance"], ["D", 1180], ["E", "LS-0412"], ["F", "Annual lift check"]] },
        { r: 6, cells: [["A", "2026-08-19"], ["B", "Sample Grid Energy"], ["C", "Utilities"], ["D", 2295.15], ["E", "EL-7802"]] },
        { r: 7, cells: [["A", "2026-09-02"], ["B", "Sample Plumbing & Heating"], ["C", "Maintenance"], ["D", 310], ["E", "INV-2251"], ["F", "Radiator valve, south building"]] },
        { r: 8, cells: [["A", "2026-09-22"], ["B", "Sample Mutual Insurance"], ["C", "Insurance"], ["D", 3125], ["E", "POL-55-Q3"]] },
        { r: 10, header: true, cells: [["C", "Quarter total"], ["D", f("SUM(D2:D8)", 10047.45)]] },
      ],
    },
    {
      name: "Vendors",
      rows: [
        { r: 1, header: true, cells: [["A", "Vendor"], ["B", "Service"], ["C", "Contact role"], ["D", "Terms"], ["E", "Comment"]] },
        { r: 2, cells: [["A", { rich: [{ text: "Sample", bold: true }, { text: " Plumbing & Heating" }] }], ["B", "Plumbing, boilers"], ["C", "Service desk"], ["D", "Net 30"], ["E", 'Prefers email, not "urgent" calls']] },
        { r: 3, cells: [["A", "Sample Lift Services"], ["B", "Lift maintenance"], ["C", "Account manager"], ["D", "Net 45\nEarly payment 2%"]] },
        { r: 4, cells: [["A", "Sample Office Supply"], ["B", "Stationery"], ["C", "Online orders"], ["D", "Card"], ["E", " Free delivery over €50"]] },
        { r: 5, cells: [["A", "Sample Grid Energy"], ["B", "Electricity"], ["C", "Business team"], ["D", "Direct debit"]] },
      ],
    },
    {
      name: "Notes",
      rows: [
        { r: 1, cells: [["A", "Budget approved by the board on 9 December 2025."]] },
        { r: 2, cells: [["A", "Maintenance includes the boiler service contract."]] },
        { r: 3, cells: [["A", "Next review: March 2026."]] },
      ],
    },
  ];
}

function cellText(value: CellValue): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if ("formula" in value) return String(value.value);
  return value.rich.map((r) => r.text).join("");
}

function xlsx(sheets: SheetModel[], chart: Buffer): Buffer {
  const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();
  const sharedFor = (value: string | { rich: { text: string; bold?: boolean }[] }): number => {
    const key = typeof value === "string" ? `s:${value}` : `r:${JSON.stringify(value.rich)}`;
    const known = sharedIndex.get(key);
    if (known !== undefined) return known;
    const t = (text: string) => `<t${/^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : ""}>${xml(text)}</t>`;
    shared.push(typeof value === "string" ? `<si>${t(value)}</si>` : `<si>${value.rich.map((r) => `<r>${r.bold === true ? '<rPr><b/><sz val="11"/><rFont val="Calibri"/></rPr>' : '<rPr><sz val="11"/><rFont val="Calibri"/></rPr>'}${t(r.text)}</r>`).join("")}</si>`);
    sharedIndex.set(key, shared.length - 1);
    return shared.length - 1;
  };
  let refs = 0;
  const sheetXml = sheets.map((sheet, i) => {
    let maxCol = "A";
    let maxRow = 1;
    const rows = sheet.rows.map((row) => {
      maxRow = Math.max(maxRow, row.r);
      const cells = row.cells.map(([col, value]) => {
        if (col > maxCol) maxCol = col;
        const ref = `${col}${row.r}`;
        const style = row.header === true ? ' s="1"' : "";
        refs++;
        if (typeof value === "number") return `<c r="${ref}"${style}><v>${value}</v></c>`;
        if (typeof value === "object" && "formula" in value) return `<c r="${ref}"${style}><f>${value.formula}</f><v>${value.value}</v></c>`;
        return `<c r="${ref}"${style} t="s"><v>${sharedFor(value)}</v></c>`;
      });
      const first = row.cells[0]?.[0] ?? "A";
      const last = row.cells[row.cells.length - 1]?.[0] ?? "A";
      const span = `${first.charCodeAt(0) - 64}:${last.charCodeAt(0) - 64}`;
      return `<row r="${row.r}" spans="${span}">${cells.join("")}</row>`;
    });
    const drawing = i === 0 ? '<drawing r:id="rId1"/>' : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${S}><dimension ref="A1:${maxCol}${maxRow}"/><sheetViews><sheetView${i === 0 ? ' tabSelected="1"' : ""} workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rows.join("")}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${drawing}</worksheet>
`;
  });
  const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${refs}" uniqueCount="${shared.length}">${shared.join("")}</sst>
`;
  const entries: [string, string | Uint8Array][] = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>
`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>
`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${S}><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><calcPr calcId="191029"/></workbook>
`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>
`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>
`],
    ["xl/sharedStrings.xml", sst],
    ...sheetXml.map((body, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, body]),
    ["xl/worksheets/_rels/sheet1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>
`],
    ["xl/drawings/drawing1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="2743200" cy="1828800"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Spending chart" descr="Chart of spending against budget"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>
`],
    ["xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>
`],
    ["xl/media/image1.png", chart],
  ];
  return zip(entries);
}

// ---------------------------------------------------------------- CSV

const MAINTENANCE_ROWS: string[][] = [
  ["Request ID", "Opened", "Building", "Unit", "Category", "Summary", "Priority", "Status", "Closed"],
  ["MR-1041", "2026-09-02", "North", "N-104", "Plumbing", "Kitchen tap drips, worse at night", "Medium", "Closed", "2026-09-05"],
  ["MR-1042", "2026-09-03", "North", "N-210", "Electrical", "Hall light flickers", "Low", "Closed", "2026-09-10"],
  ["MR-1043", "2026-09-08", "South", "S-003", "Heating", 'Radiator cold; member says "no heat since Sunday"', "High", "Closed", "2026-09-09"],
  ["MR-1044", "2026-09-11", "South", "S-115", "Doors", "Front door closer sticks\nNeeds a new arm", "Medium", "Closed", "2026-09-19"],
  ["MR-1045", "2026-09-15", "Annex", "A-2", "Pest control", "Ants near the back step", "Low", "Closed", "2026-09-22"],
  ["MR-1046", "2026-09-21", "North", "", "Grounds", "Fallen branch by the bike shed", "Medium", "Closed", "2026-09-21"],
  ["MR-1047", "2026-10-01", "South", "S-207", "Plumbing", "Shower drain slow", "Low", "Open", ""],
  ["MR-1048", "2026-10-04", "Annex", "A-5", "Electrical", "Outlet by the window is dead – breaker checked", "High", "Open", ""],
  ["MR-1049", "2026-10-09", "North", "N-301", "Windows", "Sash cord broken", "Medium", "Open", ""],
  ["MR-1050", "2026-10-12", "South", "S-118", "Appliances", "Fridge seal torn, about 30 cm", "Medium", "Open", ""],
  ["MR-1051", "2026-10-17", "North", "N-112", "Heating", "Thermostat reads 3° high", "Low", "Open", ""],
  ["MR-1052", "2026-10-20", "Annex", "", "Common room", "Café table wobbles", "Low", "Open", ""],
];

/** One CSV field, quoted when it holds a comma, a quote, a line break, or leading white space. */
function csvField(field: string): string {
  if (field === "") return field;
  if (/[",\r\n]/.test(field) || /^\s/u.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

function csv(rows: string[][], eol: string): string {
  return rows.map((row) => row.map(csvField).join(",") + eol).join("");
}

// ---------------------------------------------------------------- HTML

const POLICY_IMAGE = png(8, 2);

function visitorPolicyHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Visitor and Guest Policy — ${ORG}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 46rem; margin: 2rem auto; line-height: 1.5; }
  .callout { border-left: 4px solid #c90; padding: 0.5rem 1rem; background: #fff8e6; }
  table { border-collapse: collapse; } td, th { border: 1px solid #999; padding: 0.25rem 0.5rem; }
</style>
<script>window.siteConfig = { analytics: false };</script>
</head>
<body>
<header>
  <p class="site-name">${ORG}</p>
</header>
<main>
  <h1>Visitor and Guest Policy</h1>
  <p class="lede">This policy explains how members host visitors and overnight guests. It applies to all three buildings.</p>

  <h2>Day Visitors</h2>
  <p>Members may host day visitors at any time. Visitors must leave the common room by <strong>22:00</strong>.</p>

  <h2>Overnight Guests</h2>
  <p>A member may host an overnight guest for up to <em>14 nights</em> in any 90-day period.
     Longer stays need written approval from the <a href="/committees/membership.html">membership committee</a>.</p>
  <ul>
    <li>Tell the front desk the guest’s name and dates.</li>
    <li>Guests may not use the laundry room alone.</li>
    <li>Parking: guests use the visitor bays only.
      <ul>
        <li>Bays V1 to V4 are in the north lot.</li>
        <li>Bay V5 is kept for deliveries.</li>
      </ul>
    </li>
  </ul>

  <h3>Approval Steps</h3>
  <ol>
    <li>Fill in the guest form.</li>
    <li>Send it to the membership committee.</li>
    <li>Wait for the written reply, usually within five working days.</li>
  </ol>

  <div class="callout"><strong>Note:</strong> Guests who stay longer than 30 nights in a year count as occupants under the lease.</div>

  <h2>Shared Spaces</h2>
  <table>
    <thead><tr><th>Space</th><th>Guests allowed</th><th>Booking</th></tr></thead>
    <tbody>
      <tr><td>Common room</td><td>Up to 10</td><td>Book at the front desk</td></tr>
      <tr><td>Roof garden</td><td>Up to 6</td><td>No booking</td></tr>
      <tr><td>Guest suite</td><td>2 per night</td><td>Book online, €25 per night</td></tr>
    </tbody>
  </table>
  <p>Route for guests:<br>front desk, then the common room, then the guest suite.</p>
  <img src="data:image/png;base64,${POLICY_IMAGE.toString("base64")}" alt="Ground floor plan">
  <pre class="mermaid">
flowchart LR
  Member --> Form --> Committee --> Reply
  </pre>

  <h2>Questions</h2>
  <p>Ask at the front desk or email <a href="mailto:desk@example.org">desk@example.org</a>.</p>
</main>
<footer>
  <p>Last updated 2 October 2026. Policy owner: membership committee.</p>
</footer>
<script>document.documentElement.dataset.ready = "1";</script>
</body>
</html>
`;
}

function helpPage(title: string, up: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} — Member Help Center</title>
<link rel="icon" href="data:,">
</head>
<body>
<nav aria-label="Breadcrumb"><a href="${up}index.html">Help Center</a></nav>
${body}
</body>
</html>
`;
}

const HELP_LOGO = png(10, 5);

function helpCenter(): Map<string, string | Buffer> {
  const files = new Map<string, string | Buffer>();
  files.set("index.html", helpPage("Member Help Center", "", `<h1>Member Help Center</h1>
<img src="assets/logo.png" alt="Help Center logo">
<p>Find answers about living in the cooperative. Most questions are answered in the guides below.</p>
<ul>
  <li><a href="guides/getting-started.html">Getting started</a></li>
  <li><a href="guides/paying-charges.html">Paying monthly charges</a></li>
  <li><a href="faq.htm">Frequently asked questions</a></li>
</ul>
<p>Cannot find an answer? Visit the front desk from 09:00 to 17:30.</p>`));
  files.set("guides/getting-started.html", helpPage("Getting Started", "../", `<h1>Getting Started</h1>
<p>Welcome to the cooperative. This guide covers your first two weeks.</p>
<h2>Your First Day</h2>
<ol>
  <li>Collect your keys and fob from the front desk.</li>
  <li>Read the house rules in your welcome pack.</li>
  <li>Test the smoke alarm in your home.</li>
</ol>
<h2>Your First Two Weeks</h2>
<p>Register any pets, set up your monthly charge payment, and come to a welcome evening. The membership committee will contact you to arrange a short visit.</p>`));
  files.set("guides/paying-charges.html", helpPage("Paying Monthly Charges", "../", `<h1>Paying Monthly Charges</h1>
<p>Monthly charges cover the cost of running the buildings. They are due on the first day of each month.</p>
<table>
  <tr><th>Home size</th><th>Monthly charge</th><th>Repairs reserve share</th></tr>
  <tr><td>Studio</td><td>€610</td><td>€45</td></tr>
  <tr><td>One bedroom</td><td>€780</td><td>€60</td></tr>
  <tr><td>Two bedrooms</td><td>€945</td><td>€75</td></tr>
</table>
<h2>Late Payments</h2>
<p>If you cannot pay on time, tell the treasurer before the due date. The cooperative can agree a payment plan.</p>`));
  files.set("faq.htm", helpPage("Frequently Asked Questions", "", `<h1>Frequently Asked Questions</h1>
<h3>Can I paint my walls?</h3>
<p>Yes. Use a light color, and return the walls to white when you move out.</p>
<h3>Who fixes a broken appliance?</h3>
<p>The cooperative fixes appliances that came with the home. Report the fault through the maintenance tracker.</p>
<h3>Can I sublet my home?</h3>
<p>No. Subletting is not allowed under the lease.</p>`));
  files.set("assets/logo.png", HELP_LOGO);
  files.set("assets/site.css", "body { font-family: system-ui, sans-serif; }\n");
  return files;
}

// ---------------------------------------------------------------- Eval files

const CHART_PNG = png(14, 1);

interface EvalSource {
  file: EvalFile;
  /** Generated input files, relative to the eval root. */
  inputs: Map<string, Buffer>;
  /** HTML shown in the review page for the source. */
  review: () => string;
}

function evalFile(f: Omit<EvalFile, "reference" | "outOfScope" | "expect"> & Partial<Pick<EvalFile, "outOfScope" | "expect">>): EvalFile {
  return {
    id: f.id,
    format: f.format,
    source: f.source,
    reference: `references/${f.id}.txt`,
    twin: f.twin,
    expect: f.expect ?? "text",
    sections: f.sections,
    parts: f.parts,
    covers: f.covers,
    outOfScope: f.outOfScope ?? [],
  };
}

function sources(): EvalSource[] {
  const list: EvalSource[] = [];
  const one = (file: EvalFile, data: Buffer, review: () => string) => list.push({ file, inputs: new Map([[file.source, data]]), review });

  one(evalFile({
    id: "csv-maintenance-requests", format: "csv", source: "inputs/csv/maintenance-requests.csv", twin: "csv", parts: ["maintenance-requests.csv"],
    sections: ["Header row", "Closed requests", "Open requests"],
    covers: ["CRLF line endings", "quoted fields with commas, quotes, and a line break", "empty cells", "non-ASCII text (en dash, degree sign, é)"],
  }), Buffer.from(csv(MAINTENANCE_ROWS, "\r\n"), "utf8"), () => gridTable(MAINTENANCE_ROWS, true));

  const handbook = handbookModel();
  one(evalFile({
    id: "docx-operations-handbook", format: "docx", source: "inputs/docx/operations-handbook.docx", twin: "markdown", parts: ["operations-handbook.md"],
    sections: ["Title and introduction", "Roles and Responsibilities", "Board", "Maintenance Committee", "Membership Committee", "Handling a Repair Request", "Emergency Contacts", "Spending Limits", "Records", "Embedded assets"],
    covers: ["Title and Heading 1 and 2 styles", "numbered list with a lettered second level", "bullet list", "bold and underlined pseudo-heading", "tab and line break", "a word split across runs with spelling marks", "table with a two-paragraph cell", "embedded image"],
  }), docx(handbook, { "image1.png": SITE_PLAN_PNG }), () => renderDoc(handbook, { "image1.png": SITE_PLAN_PNG }));

  const minutes = minutesModel();
  one(evalFile({
    id: "docx-committee-minutes", format: "docx", source: "inputs/docx/committee-minutes.docx", twin: "markdown", parts: ["committee-minutes.md"],
    sections: ["Title and attendance", "Agenda", "Open Repair Requests", "Winter Heating Check", "Contractor List", "Actions"],
    covers: ["typed bullet characters instead of list numbering", "mixed bold and plain runs", "curly apostrophe", "decision table", "numbered action list"],
  }), docx(minutes, {}), () => renderDoc(minutes, {}));

  const budget = budgetModel();
  one(evalFile({
    id: "xlsx-annual-budget", format: "xlsx", source: "inputs/xlsx/annual-budget.xlsx", twin: "csv",
    parts: budget.map((s) => `annual-budget-${slug(s.name)}.csv`),
    sections: budget.map((s) => `Sheet: ${s.name}`),
    covers: ["four sheets, one CSV twin each", "formulas with cached values", "skipped rows and sparse columns", "rich-text cell", "cell with a line break, quotes, and leading space", "embedded chart image"],
  }), xlsx(budget, CHART_PNG), () => renderWorkbook(budget));

  one(evalFile({
    id: "html-visitor-policy", format: "html", source: "inputs/html/visitor-policy.html", twin: "markdown", parts: ["visitor-policy.md"],
    sections: ["Site name", "Visitor and Guest Policy", "Day Visitors", "Overnight Guests", "Approval Steps", "Callout note", "Shared Spaces", "Ground floor plan and diagram", "Questions", "Footer"],
    covers: ["head, style, and script content that must not appear", "inline links and a mailto link", "nested bullet list", "ordered list", "text in a div callout", "table with thead and tbody", "line break inside a paragraph", "data-URI image", "Mermaid diagram"],
  }), Buffer.from(visitorPolicyHtml(), "utf8"), () => renderHtml(visitorPolicyHtml(), {}));

  const help = helpCenter();
  const helpFile = evalFile({
    id: "html-dir-help-center", format: "html-dir", source: "inputs/html-dir/help-center", twin: "markdown",
    parts: ["faq.md", "guides-getting-started.md", "guides-paying-charges.md", "index.md"],
    sections: ["faq.htm", "guides/getting-started.html", "guides/paying-charges.html", "index.html"],
    covers: ["four pages in two folders, one Markdown twin each", "an .htm page", "local image", "table without thead", "non-HTML files that are skipped"],
    outOfScope: ["Each page starts with a one-link breadcrumb (\"Help Center\") in a nav element. The reference treats it as site navigation, not page content, and leaves it out. Change this if you disagree."],
  });
  list.push({
    file: helpFile,
    inputs: new Map([...help].map(([rel, data]): [string, Buffer] => [`${helpFile.source}/${rel}`, typeof data === "string" ? Buffer.from(data, "utf8") : data])),
    review: () => [...help].filter(([rel]) => /\.html?$/.test(rel)).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([rel, data]) => `<h4 class="part">${esc(rel)}</h4>${renderHtml(String(data), { "assets/logo.png": HELP_LOGO })}`).join("")
      + `<p class="note">Also in the folder, not converted: <code>assets/logo.png</code> (copied as a side artifact when an HTML page uses it) and <code>assets/site.css</code>.</p>`,
  });

  const pdfs: [EvalFile, PdfDoc][] = [
    [evalFile({
      id: "pdf-annual-report", format: "pdf", source: "inputs/pdf/annual-report-summary.pdf", twin: "text", parts: ["annual-report-summary.txt"],
      sections: ["Title", "Overview", "Membership", "Finances", "Looking Ahead"],
      covers: ["plain text over two pages", "compressed content streams", "bold headings", "WinAnsi characters (en dash, euro, curly apostrophe)", "one paragraph set with kerning gaps and no space characters"],
    }), annualReportPdf()],
    [evalFile({
      id: "pdf-newsletter-columns", format: "pdf", source: "inputs/pdf/newsletter-two-columns.pdf", twin: "text", parts: ["newsletter-two-columns.txt"],
      sections: ["Masthead", "Roof Works Start in May", "Bike Store Plans", "New Members Welcome Evening", "Garden Volunteers Needed", "Footer"],
      covers: ["two text columns read left column first", "masthead across both columns", "footer"],
    }), newsletterPdf()],
    [evalFile({
      id: "pdf-rates-table", format: "pdf", source: "inputs/pdf/room-rates-table.pdf", twin: "text", parts: ["room-rates-table.txt"],
      sections: ["Title and introduction", "Rate table", "Notes"],
      covers: ["ruled table with a bold header row", "right-aligned money columns", "text before and after the table"],
    }), ratesTablePdf()],
    [evalFile({
      id: "pdf-pet-policy-headers", format: "pdf", source: "inputs/pdf/pet-policy.pdf", twin: "text", parts: ["pet-policy.txt"],
      sections: ["Page 1 header", "Pet Policy", "Pets Allowed", "Page 1 footer", "Page 2 header", "Registration", "Shared Spaces", "Page 2 footer", "Page 3 header", "Complaints", "Review", "Page 3 footer"],
      covers: ["running header on three pages", "footer with left and right text on one line", "page numbers"],
    }), petPolicyPdf()],
    [evalFile({
      id: "pdf-signup-with-scan", format: "pdf", source: "inputs/pdf/volunteer-signup-with-scan.pdf", twin: "text", parts: ["volunteer-signup-with-scan.txt"],
      sections: ["Volunteer Day Sign-Up", "How to Sign Up"],
      covers: ["page 1 has a text layer", "page 2 is a scanned image with no text layer"],
      outOfScope: ["Page 2 is a scanned sign-in sheet. Its text is only in the image. Reading it needs OCR, which is out of scope (PRD 07), so the reference leaves it out. A converter that returns page 2 text fails the similarity gate."],
    }), signupWithScanPdf()],
    [evalFile({
      id: "pdf-scanned-notice", format: "pdf", source: "inputs/pdf/scanned-repair-notice.pdf", twin: "text", parts: [], expect: "no-text",
      sections: [],
      covers: ["a scan-only PDF with no text layer"],
      outOfScope: ["The whole page is a scanned image. OCR is out of scope (PRD 07). The converter must report that it found no usable text, as the Go golden intake-convert-pdf-scanned-only shows. It must not write a twin."],
    }), scannedNoticePdf()],
  ];
  for (const [file, doc] of pdfs) one(file, pdf(doc), () => renderPdf(doc));
  return list;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------- Review page

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dataUri(type: string, data: Buffer): string {
  return `data:${type};base64,${data.toString("base64")}`;
}

function gridTable(rows: string[][], header: boolean): string {
  const width = Math.max(...rows.map((r) => r.length));
  const cell = (tag: string, text: string) => `<${tag}>${text === "" ? '<span class="empty">empty</span>' : esc(text).replace(/\n/g, "<br>")}</${tag}>`;
  return `<table class="grid">${rows.map((row, i) => `<tr>${Array.from({ length: width }, (_, c) => cell(header && i === 0 ? "th" : "td", row[c] ?? "")).join("")}</tr>`).join("")}</table>`;
}

function renderRuns(runs: (string | Run)[]): string {
  return runs.map((run) => {
    const r: Run = typeof run === "string" ? { text: run } : run;
    let html = esc(r.text).replace(/\t/g, '<span class="tab">⇥</span>').replace(/\n/g, "<br>");
    if (r.bold === true) html = `<b>${html}</b>`;
    if (r.italic === true) html = `<i>${html}</i>`;
    if (r.underline === true) html = `<u>${html}</u>`;
    return html;
  }).join("");
}

function renderDoc(blocks: DocBlock[], media: Record<string, Buffer>): string {
  const out: string[] = ['<div class="doc">'];
  const counters: number[] = [];
  let lastNum = "";
  for (const b of blocks) {
    if (b.kind !== "item") {
      counters.length = 0;
      lastNum = "";
    }
    switch (b.kind) {
      case "heading": {
        const tag = b.style === "Title" ? "h1" : b.style === "Heading1" ? "h2" : b.style === "Heading2" ? "h3" : "h4";
        out.push(`<${tag} class="${b.style}">${esc(b.text)} <span class="style">${b.style}</span></${tag}>`);
        break;
      }
      case "para":
        out.push(`<p>${renderRuns(b.runs)}</p>`);
        break;
      case "item": {
        if (b.num !== lastNum) counters.length = 0;
        lastNum = b.num;
        counters.length = b.level + 1;
        counters[b.level] = (counters[b.level] ?? 0) + 1;
        const n = counters[b.level] as number;
        const marker = b.num === "2" ? (b.level === 0 ? "•" : "o") : b.level === 0 ? `${n}.` : `${String.fromCharCode(96 + n)}.`;
        out.push(`<div class="li" style="margin-left:${1.5 + b.level * 1.75}em"><span class="marker">${marker}</span> ${renderRuns(b.runs)}</div>`);
        break;
      }
      case "table":
        out.push(`<table class="grid">${b.rows.map((row, r) => `<tr>${row.map((cell) => `<${r === 0 ? "th" : "td"}>${cell.split("\n").map(esc).join("<br>")}</${r === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table>`);
        break;
      case "image": {
        const data = media[b.media];
        out.push(`<figure><img class="pixel" src="${data !== undefined ? dataUri("image/png", data) : ""}" alt="${esc(b.alt)}" width="160"><figcaption>Embedded image <code>word/media/${esc(b.media)}</code>, alt text “${esc(b.alt)}”</figcaption></figure>`);
        break;
      }
    }
  }
  out.push("</div>");
  return out.join("");
}

function renderWorkbook(sheets: SheetModel[]): string {
  return sheets.map((sheet, i) => {
    const maxRow = Math.max(...sheet.rows.map((r) => r.r));
    const maxCol = Math.max(...sheet.rows.flatMap((r) => r.cells.map(([c]) => c.charCodeAt(0) - 64)));
    const cols = Array.from({ length: maxCol }, (_, c) => String.fromCharCode(65 + c));
    const body = Array.from({ length: maxRow }, (_, r) => {
      const row = sheet.rows.find((x) => x.r === r + 1);
      return `<tr><th class="rn">${r + 1}</th>${cols.map((col) => {
        const value = row?.cells.find(([c]) => c === col)?.[1];
        if (value === undefined) return "<td></td>";
        let html = typeof value === "object" && "rich" in value
          ? value.rich.map((run) => (run.bold === true ? `<b>${esc(run.text)}</b>` : esc(run.text))).join("")
          : esc(cellText(value)).replace(/\n/g, "<br>");
        if (row?.header === true) html = `<b>${html}</b>`;
        const formula = typeof value === "object" && "formula" in value ? ` title="=${esc(value.formula)}" class="formula"` : typeof value === "number" ? ' class="num"' : "";
        return `<td${formula}>${html}</td>`;
      }).join("")}</tr>`;
    }).join("");
    return `<h4 class="part">Sheet ${i + 1}: ${esc(sheet.name)}</h4><table class="sheet"><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${body}</table>`;
  }).join("") + `<p class="note">Cells marked ƒ hold a formula; the cached value is shown. Hover a cell to see its formula. The workbook also embeds one chart image (<code>xl/media/image1.png</code>) on the Summary sheet.</p>`
    + `<figure><img class="pixel" src="${dataUri("image/png", CHART_PNG)}" alt="Chart of spending against budget" width="160"><figcaption>Embedded chart image. It holds no text.</figcaption></figure>`;
}

function renderHtml(source: string, images: Record<string, Buffer>): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(source)?.[1] ?? source;
  let inner = body.replace(/<script[\s\S]*?<\/script>/gi, "");
  for (const [rel, data] of Object.entries(images)) inner = inner.split(`src="${rel}"`).join(`src="${dataUri("image/png", data)}"`);
  return `<div class="html-render">${inner}</div><details><summary>HTML source</summary><pre class="src">${esc(source)}</pre></details>`;
}

function renderPdf(doc: PdfDoc): string {
  return doc.pages.map((page, i) => {
    const parts: string[] = ['<rect x="0" y="0" width="612" height="792" class="paper"/>'];
    for (const [x1, y1, x2, y2] of page.rules ?? []) parts.push(`<line x1="${x1}" y1="${792 - y1}" x2="${x2}" y2="${792 - y2}" class="rule"/>`);
    if (page.scan !== undefined) {
      const s = page.scan;
      parts.push(`<image x="${s.x}" y="${792 - s.y - s.h}" width="${s.w}" height="${s.h}" preserveAspectRatio="none" href="${dataUri("image/png", bitmapPng(s.bitmap))}"/>`);
    }
    for (const t of page.texts) {
      const weight = t.bold === true ? ' font-weight="bold"' : "";
      let content = esc(t.text);
      if (t.tj !== undefined) {
        let dx = 0;
        content = t.tj.map((part) => {
          if (typeof part === "number") {
            dx += (-part / 1000) * t.size;
            return "";
          }
          const span = `<tspan dx="${dx.toFixed(2)}">${esc(part)}</tspan>`;
          dx = 0;
          return span;
        }).join("");
      }
      parts.push(`<text x="${t.x}" y="${792 - t.y}" font-size="${t.size}"${weight}>${content}</text>`);
    }
    const label = page.scan !== undefined && page.texts.length === 0 ? " — scanned image, no text layer" : "";
    return `<figure class="pdf-page"><svg viewBox="0 0 612 792" role="img" aria-label="Page ${i + 1}">${parts.join("")}</svg><figcaption>Page ${i + 1} of ${doc.pages.length}${label}</figcaption></figure>`;
  }).join("");
}

const REVIEW_CSS = `
:root { --bg: #f6f6f4; --fg: #1d1d1b; --muted: #5d5d58; --card: #ffffff; --line: #d6d6d0; --accent: #2f5d8a; --mark: #fff3c4; --paper: #ffffff; --ink: #111111; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #171716; --fg: #ecece8; --muted: #a8a8a0; --card: #222220; --line: #3a3a36; --accent: #8fb8e0; --mark: #4a4220; --paper: #f4f4f0; --ink: #111111; } }
:root[data-theme="dark"] { --bg: #171716; --fg: #ecece8; --muted: #a8a8a0; --card: #222220; --line: #3a3a36; --accent: #8fb8e0; --mark: #4a4220; --paper: #f4f4f0; --ink: #111111; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1400px; margin: 0 auto; }
h1 { font-size: 1.6rem; margin: 0.2em 0; }
h2.file { font-size: 1.25rem; margin: 0; }
code, pre { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.85rem; }
a { color: var(--accent); }
.intro, .file-card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin: 16px 0; }
.summary { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.summary th, .summary td { border-bottom: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
.meta { color: var(--muted); font-size: 0.9rem; margin: 4px 0 12px; }
.checks { margin: 8px 0 12px; padding-left: 1.2em; }
.oos { background: var(--mark); padding: 8px 12px; border-radius: 6px; }
.compare { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 900px) { .compare { grid-template-columns: minmax(0, 1fr); } }
.pane { border: 1px solid var(--line); border-radius: 6px; padding: 12px; min-width: 0; overflow-x: auto; }
.pane > h3 { margin: 0 0 8px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.ref-section { margin: 0 0 10px; }
.ref-name { font-size: 0.8rem; font-weight: 600; color: var(--accent); }
.ref-text { margin: 2px 0 0; padding: 8px; white-space: pre-wrap; word-break: break-word; background: var(--bg); border-radius: 4px; }
.grid, .sheet, .html-render table { border-collapse: collapse; margin: 8px 0; font-size: 0.85rem; }
.grid td, .grid th, .sheet td, .sheet th, .html-render td, .html-render th { border: 1px solid var(--line); padding: 3px 6px; vertical-align: top; }
.sheet th { background: var(--bg); color: var(--muted); font-weight: 500; }
.sheet td.num, .sheet td.formula { text-align: right; }
.sheet td.formula::before { content: "ƒ "; color: var(--muted); }
.empty { color: var(--muted); font-style: italic; font-size: 0.75rem; }
.doc .style { font-size: 0.7rem; font-weight: 400; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; vertical-align: middle; }
.doc .marker { display: inline-block; min-width: 1.5em; }
.tab { color: var(--muted); padding: 0 1em; }
.pixel { image-rendering: pixelated; border: 1px solid var(--line); background: #fff; }
figure { margin: 8px 0; }
figcaption, .note { color: var(--muted); font-size: 0.85rem; }
.part { margin: 14px 0 4px; font-size: 0.9rem; border-top: 1px dashed var(--line); padding-top: 8px; }
.html-render { border-left: 3px solid var(--line); padding-left: 12px; }
.src { white-space: pre-wrap; word-break: break-word; max-height: 24rem; overflow: auto; background: var(--bg); padding: 8px; }
.pdf-page svg { width: 100%; max-width: 520px; height: auto; display: block; border: 1px solid var(--line); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.pdf-page .paper { fill: var(--paper); }
.pdf-page text { font-family: Helvetica, Arial, sans-serif; fill: var(--ink); white-space: pre; }
.pdf-page .rule { stroke: var(--ink); stroke-width: 0.6; }
`;

function reviewPage(list: EvalSource[], root: string): string {
  const cards = list.map(({ file, review }) => {
    const sections = parseReference(readFileSync(join(root, ...file.reference.split("/")), "utf8"));
    const refHtml = sections.length === 0
      ? '<p class="note">This reference is empty on purpose: the converter must produce no text.</p>'
      : sections.map((s) => `<div class="ref-section"><div class="ref-name">§ ${esc(s.name)}</div><pre class="ref-text">${esc(s.text.replace(/^\n+|\n+$/g, ""))}</pre></div>`).join("");
    const oos = file.outOfScope.length > 0 ? `<div class="oos"><b>Out of scope on purpose:</b> ${file.outOfScope.map(esc).join(" ")}</div>` : "";
    return `<section class="file-card" id="${file.id}">
<h2 class="file">${esc(file.id)}</h2>
<p class="meta">Format <b>${file.format}</b> · source <code>${esc(file.source)}</code> · reference <code>${esc(file.reference)}</code> · twin parts: ${file.parts.length > 0 ? file.parts.map((p) => `<code>${esc(p)}</code>`).join(", ") : "none"}</p>
<p><b>Check that the reference has every visible section and the same text as the source.</b> This file covers:</p>
<ul class="checks">${file.covers.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
${oos}
<div class="compare">
<div class="pane"><h3>Source, rendered</h3>${review()}</div>
<div class="pane"><h3>Draft reference text (${sections.length} sections)</h3>${refHtml}</div>
</div>
</section>`;
  }).join("\n");
  const rows = list.map(({ file }) => `<tr><td><a href="#${file.id}">${esc(file.id)}</a></td><td>${file.format}</td><td><code>${esc(file.source)}</code></td><td>${file.sections.length}</td></tr>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<title>Conversion Eval Review</title>
<style>${REVIEW_CSS}</style>
</head>
<body>
<main>
<h1>Conversion Eval Review</h1>
<div class="intro">
<p>This page puts each eval source beside its draft reference text, so you can review the references for W1 R7 P4 t3 without opening each file. It works offline and runs no scripts. The source renderings come from the same generator that writes the eval files (<code>test/conversion-eval/generate-eval.ts</code>). For PDF, each page is drawn from the same page layout the generator writes into the PDF. For DOCX and XLSX, the document and sheet content is drawn from the same model the generator writes into the file. For HTML, the page body is shown with its scripts removed.</p>
<p>A reference is the body that a correct converter should write under the intake translation contract: Markdown for DOCX and HTML, CSV for CSV and XLSX, and plain text for PDF. Line breaks and runs of spaces do not count, because the eval compares text after white-space normalization. Record your decision for each file in <code>test/conversion-eval/REVIEW.md</code>. If you change a reference, run <code>node test/conversion-eval/generate-eval.ts</code> to refresh this page.</p>
<table class="summary"><tr><th>Eval file</th><th>Format</th><th>Source</th><th>Sections</th></tr>${rows}</table>
</div>
${cards}
</main>
</body>
</html>
`;
}

// ---------------------------------------------------------------- Output

/** Every generated file, relative to the eval root. Reads the reference files under `root` for the review page. */
export function generatedEvalFiles(root = EVAL_ROOT): Map<string, Buffer> {
  const list = sources();
  const files = new Map<string, Buffer>();
  for (const s of list) for (const [rel, data] of s.inputs) files.set(rel, data);
  const manifest: EvalManifest = { version: 1, files: list.map((s) => s.file) };
  files.set("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  files.set("review.html", Buffer.from(reviewPage(list, root), "utf8"));
  return files;
}

/** Content the draft references were written from. Exported for the drafting helper and tests only. */
export const models = { handbookModel, minutesModel, budgetModel, annualReportPdf, newsletterPdf, ratesTablePdf, petPolicyPdf, signupWithScanPdf, maintenanceRows: MAINTENANCE_ROWS, csv, cellText };

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outRoot = process.argv[2] !== undefined ? resolve(process.argv[2]) : EVAL_ROOT;
  const files = generatedEvalFiles(EVAL_ROOT);
  for (const [rel, data] of files) {
    const target = join(outRoot, ...rel.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  process.stdout.write(`wrote ${files.size} generated eval files under ${outRoot}\n`);
}
