// Generates the binary golden fixtures (DOCX, XLSX, PDF, PNG) byte for byte.
//
//   node test/golden/generate-fixtures.ts [<out-root>]
//
// With no argument it writes into test/fixtures/golden/. The output depends
// only on this file: ZIP entries are stored (no compression) with a fixed
// 1980-01-01 timestamp, PNG image data uses stored deflate blocks, and PDF
// objects and offsets are written in a fixed order. No zlib version, clock,
// or locale changes a byte. test/golden/fixtures.test.ts regenerates into a
// temporary folder and checks that every committed binary fixture matches.
//
// All content is invented for these tests. It names no real person,
// organization, or client.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------------------------------------------------------------- CRC and Adler

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

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function u32be(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

// ---------------------------------------------------------------- ZIP (stored)

/** A ZIP archive with stored entries, in the given order, dated 1980-01-01 00:00. */
export function zip(entries: readonly (readonly [string, string | Uint8Array])[]): Buffer {
  const DOS_TIME = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
    const nameBytes = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(DOS_TIME), u16(DOS_DATE),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    centrals.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(DOS_TIME), u16(DOS_DATE),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), nameBytes,
    ]));
    locals.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locals, central, end]);
}

// ---------------------------------------------------------------- PNG (stored deflate)

function zlibStored(data: Uint8Array): Buffer {
  const parts: Buffer[] = [Buffer.from([0x78, 0x01])];
  for (let i = 0; i < data.length || i === 0; i += 65535) {
    const block = data.subarray(i, Math.min(i + 65535, data.length));
    const final = i + 65535 >= data.length ? 1 : 0;
    const len = block.length;
    parts.push(Buffer.from([final, len & 0xff, len >> 8, ~len & 0xff, (~len >> 8) & 0xff]), Buffer.from(block));
    if (data.length === 0) break;
  }
  parts.push(u32be(adler32(data)));
  return Buffer.concat(parts);
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typed = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
  return Buffer.concat([u32be(data.length), typed, u32be(crc32(typed))]);
}

/** An 8-bit grayscale PNG, `size` x `size`, with a diagonal stripe pattern set by `seed`. */
export function png(size: number, seed: number): Buffer {
  const raw: number[] = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter: none
    for (let x = 0; x < size; x++) raw.push(((x + y + seed) % 4) * 64);
  }
  const header = Buffer.concat([u32be(size), u32be(size), Buffer.from([8, 0, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlibStored(Uint8Array.from(raw))),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

// ---------------------------------------------------------------- PDF

interface PdfText {
  x: number;
  y: number;
  size?: number;
  text: string;
}

interface PdfPage {
  texts?: PdfText[];
  /** Ruled lines as [x1, y1, x2, y2]. */
  lines?: [number, number, number, number][];
  /** Draws an 8x8 grayscale image over the page, as a scanner does. */
  scan?: boolean;
  /** Raw content-stream operators, written after the texts (font /F1 is Helvetica). */
  ops?: string[];
}

function pdfString(text: string): string {
  return `(${text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

/** A PDF 1.4 file with uncompressed content streams and Helvetica (WinAnsi). */
export function pdf(pages: readonly PdfPage[]): Buffer {
  const objects: Buffer[] = [];
  const add = (body: string | Buffer): number => {
    objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
    return objects.length;
  };
  const catalog = add(""); // 1, filled below
  const pagesObj = add(""); // 2, filled below
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const scanPixels = Buffer.from(Array.from({ length: 64 }, (_, i) => ((i * 37) % 251) & 0xff));
  const image = add(
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${scanPixels.length} >>\nstream\n`, "latin1"),
      scanPixels,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
  const pageIds: number[] = [];
  for (const page of pages) {
    const ops: string[] = [];
    for (const [x1, y1, x2, y2] of page.lines ?? []) ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    if (page.scan === true) ops.push("q 468 0 0 648 72 72 cm /Im1 Do Q");
    for (const t of page.texts ?? []) ops.push(`BT /F1 ${t.size ?? 11} Tf ${t.x} ${t.y} Td ${pdfString(t.text)} Tj ET`);
    ops.push(...(page.ops ?? []));
    const stream = `${ops.join("\n")}\n`;
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`);
    const resources = page.scan === true
      ? `<< /Font << /F1 ${font} 0 R >> /XObject << /Im1 ${image} 0 R >> >>`
      : `<< /Font << /F1 ${font} 0 R >> >>`;
    pageIds.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`, "latin1");
  objects[pagesObj - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`, "latin1");

  const out: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let length = out[0]!.length;
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    out.push(chunk);
    length += chunk.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  out.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF\n`, "latin1"));
  return Buffer.concat(out);
}

// ---------------------------------------------------------------- DOCX

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function wp(text: string, opts: { style?: string; num?: [string, number]; bold?: boolean; underline?: boolean } = {}): string {
  const ppr: string[] = [];
  if (opts.style !== undefined) ppr.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.num !== undefined) ppr.push(`<w:numPr><w:ilvl w:val="${opts.num[1]}"/><w:numId w:val="${opts.num[0]}"/></w:numPr>`);
  const rpr: string[] = [];
  if (opts.bold === true) rpr.push("<w:b/>");
  if (opts.underline === true) rpr.push('<w:u w:val="single"/>');
  const runs = text.split("\t").map((part, i) => `${i > 0 ? "<w:tab/>" : ""}<w:t xml:space="preserve">${xml(part)}</w:t>`).join("");
  return `<w:p>${ppr.length > 0 ? `<w:pPr>${ppr.join("")}</w:pPr>` : ""}<w:r>${rpr.length > 0 ? `<w:rPr>${rpr.join("")}</w:rPr>` : ""}${runs}</w:r></w:p>`;
}

function xml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function wtable(rows: string[][]): string {
  return `<w:tbl>${rows.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${cell.split("\n").map((p) => wp(p)).join("")}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}

function docx(body: string, options: { numbering?: boolean; media?: boolean } = {}): Buffer {
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>
`;
  const entries: [string, string | Uint8Array][] = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>
`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>
`],
    ["word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body}</w:body></w:document>
`],
  ];
  if (options.numbering === true) entries.push(["word/numbering.xml", numbering]);
  if (options.media === true) {
    entries.push(["word/media/", new Uint8Array()]);
    entries.push(["word/media/image1.png", png(4, 1)]);
    entries.push(["word/media/image2.png", png(6, 2)]);
  }
  return zip(entries);
}

function serviceGuideDocx(): Buffer {
  const body = [
    wp("Sample Tool Library Service Guide", { style: "Title" }),
    wp("This guide describes how the sample tool library lends equipment to members. All names are invented."),
    wp("Opening Hours", { style: "Heading1" }),
    wp("The front desk opens at 09:00 and closes at 17:30.\tWeekend hours vary."),
    wp("Lending Steps", { style: "Heading2" }),
    wp("Check the member card.", { num: ["1", 0] }),
    wp("Scan the tool tag.", { num: ["1", 0] }),
    wp("Confirm the return date with the member.", { num: ["1", 1] }),
    wp("Record the loan.", { num: ["1", 0] }),
    wp("Safety Notes", { bold: true, underline: true }),
    wp("Wear eye protection near the saw bench.", { num: ["2", 0] }),
    wp("Keep cords off the floor.", { num: ["2", 1] }),
    wp("• Report damaged tools at once", { bold: true }),
    wp("Tag the tool as held.", { num: ["2", 0] }),
    wp("Tool Categories", { style: "Heading2" }),
    wtable([
      ["Category", "Loan days", "Deposit"],
      ["Hand tools", "7", "None"],
      ["Power tools", "3", "Small | refundable"],
      ["Garden tools", "14", "None\nSeasonal only"],
    ]),
    wp("Questions go to the front desk team."),
  ].join("");
  return docx(body, { numbering: true, media: true });
}

function minutesDocx(): Buffer {
  const body = [
    wp("Volunteer Meeting Notes", { style: "Heading1" }),
    wp("Attendees: desk volunteer, repair volunteer, and the coordinator role."),
    wp("· Decision: extend Saturday hours for a trial month"),
    wp("Follow up in four weeks.", { num: ["9", 0] }),
  ].join("");
  return docx(body);
}

// ---------------------------------------------------------------- XLSX

function xlsx(options: { badTarget?: boolean } = {}): Buffer {
  const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const shared = ["Item", "Count", "Shelf", "Claw hammer", "B2", "Ladder, 6 ft", "Note", 'Quote "tall"', "Supplier", "Terms"];
  const sharedXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst ${S} count="${shared.length + 1}" uniqueCount="${shared.length + 1}">${shared.map((s) => `<si><t>${xml(s)}</t></si>`).join("")}<si><r><t>Sample </t></r><r><t>Supply Depot</t></r></si></sst>
`;
  const c = (ref: string, value: string, type?: string) => `<c r="${ref}"${type !== undefined ? ` t="${type}"` : ""}><v>${xml(value)}</v></c>`;
  const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${S}><sheetData><row r="1">${c("A1", "0", "s")}${c("B1", "1", "s")}${c("C1", "2", "s")}</row><row r="2">${c("A2", "3", "s")}${c("B2", "12")}${c("C2", "4", "s")}</row><row r="3">${c("A3", "5", "s")}${c("B3", "2")}</row><row r="5">${c("A5", "6", "s")}${c("D5", "7", "s")}</row><row r="6">${c("A6", "Total", "str")}${c("B6", "14.5")}</row></sheetData></worksheet>
`;
  const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${S}><sheetData><row r="1">${c("A1", "8", "s")}${c("B1", "9", "s")}</row><row r="2">${c("A2", "10", "s")}${c("B2", "Net 30", "str")}</row><row r="3">${c("B3", "multi\nline", "str")}</row></sheetData></worksheet>
`;
  const sheet3 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${S}><sheetData><row r="1">${c("A1", "Reviewed", "str")}</row></sheetData></worksheet>
`;
  const target2 = options.badTarget === true ? "../../outside.xml" : "worksheets/sheet2.xml";
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>
`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>
`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${S} ${R}><sheets><sheet name="Stock Levels" sheetId="1" r:id="rId1"/><sheet name="Suppliers &amp; Terms" sheetId="2" r:id="rId2"/><sheet name="Notes" sheetId="3" r:id="rId3"/></sheets></workbook>
`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="${target2}"/><Relationship Id="rId3" Target="/xl/worksheets/sheet3.xml"/></Relationships>
`],
    ["xl/sharedStrings.xml", sharedXml],
    ["xl/worksheets/sheet1.xml", sheet1],
    ["xl/worksheets/sheet2.xml", sheet2],
    ["xl/worksheets/sheet3.xml", sheet3],
    ["xl/media/image1.png", png(5, 3)],
  ]);
}

// ---------------------------------------------------------------- PDF fixtures

const LEFT = 72;

function lines(texts: string[], top: number, step = 16, x = LEFT): PdfText[] {
  return texts.map((text, i) => ({ x, y: top - i * step, text }));
}

function plainPdf(): Buffer {
  return pdf([
    { texts: [{ x: LEFT, y: 720, size: 16, text: "Repair Cafe Handbook" }, ...lines([
      "The repair cafe meets on the first Saturday of each month.",
      "Volunteers fix lamps, toasters, and bicycles for free.",
      "Visitors sign in at the front table before they wait.",
    ], 690)] },
    { texts: lines(["Page two lists the tools on the repair bench.", "Solder, screwdrivers, and a multimeter are shared."], 720) },
  ]);
}

function columnsPdf(): Buffer {
  return pdf([{ texts: [
    ...lines(["Left column starts here.", "Seed swaps happen in spring.", "Bring labeled envelopes."], 700, 16, LEFT),
    ...lines(["Right column starts here.", "Compost pickup is weekly.", "Bins go out by eight."], 700, 16, 330),
  ] }]);
}

function tablePdf(): Buffer {
  const rows = [["Room", "Seats", "Projector"], ["Workshop A", "12", "Yes"], ["Workshop B", "8", "No"], ["Quiet room", "4", "No"]];
  const texts: PdfText[] = [{ x: LEFT, y: 730, size: 14, text: "Room Booking Table" }];
  const ruled: [number, number, number, number][] = [];
  rows.forEach((row, r) => {
    const y = 700 - r * 20;
    ruled.push([LEFT - 4, y + 14, 420, y + 14]);
    row.forEach((cell, col) => texts.push({ x: LEFT + col * 120, y, text: cell }));
  });
  ruled.push([LEFT - 4, 700 - rows.length * 20 + 14, 420, 700 - rows.length * 20 + 14]);
  return pdf([{ texts, lines: ruled }]);
}

function headerFooterPdf(): Buffer {
  const page = (n: number, body: string[]): PdfPage => ({ texts: [
    { x: LEFT, y: 760, size: 9, text: "Sample Garden Club - Internal Newsletter" },
    ...lines(body, 700),
    { x: LEFT, y: 40, size: 9, text: `Page ${n} of 2` },
  ] });
  return pdf([
    page(1, ["Plot fees are due in March.", "The water tap opens in April."]),
    page(2, ["Tool shed keys are at the front desk.", "Please return them the same day."]),
  ]);
}

function mixedScanPdf(): Buffer {
  return pdf([
    { texts: lines(["Intake form summary", "The second page is a scanned signature sheet."], 720) },
    { scan: true },
  ]);
}

function scanOnlyPdf(): Buffer {
  return pdf([{ scan: true }]);
}

// ---------------------------------------------------------------- HTML with an embedded image

function handbookHtml(): Buffer {
  const dataUri = `data:image/png;base64,${png(4, 6).toString("base64")}`;
  return Buffer.from(`<!doctype html>
<html>
<head><title>Member Handbook</title><style>p { margin: 0 }</style></head>
<body>
<h1>Member Handbook</h1>
<p>Members borrow tools for free. See the <a href="https://example.org/rules">house rules</a> and
   the   <a href="#fees">fee table</a>.</p>
<h3>Before You Borrow</h3>
<ul>
  <li>Show your member card</li>
  <li>Check the tool <em>before</em> you leave</li>
  <li>   </li>
</ul>
<ol><li>Return tools clean</li></ol>
<table id="fees">
  <tr><th>Tool</th><th>Late fee</th></tr>
  <tr><td>Drill</td><td>1 token | day</td></tr>
  <tr><td>Ladder</td></tr>
</table>
<p>Floor plan:<br>front room, then workshop.</p>
<img src="images/floor-plan.png?v=2" alt="  Floor   plan ">
<img src="${dataUri}">
<img src="https://example.org/static/map.png" alt="Street map">
<img src="images/missing.png" alt="Missing photo">
<img src="data:image/png,not-base64" alt="Odd data">
<svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8"></rect></svg>
<pre class="mermaid">
sequenceDiagram
  Member->>Desk: Borrow drill
</pre>
<div class="mermaid">   </div>
</body>
</html>
`, "utf8");
}

// ---------------------------------------------------------------- Output

/** Every generated fixture file, relative to test/fixtures/golden/. */
export function generatedFixtures(): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const intake = (root: string, rel: string, data: Buffer) => files.set(`${root}/${rel}`, data);
  intake("intake", "inputs/service-guide.docx", serviceGuideDocx());
  intake("intake", "inputs/volunteer-minutes.docx", minutesDocx());
  intake("intake", "inputs/broken.docx", Buffer.from("This file is not a ZIP archive.\n", "utf8"));
  intake("intake", "inputs/inventory.xlsx", xlsx());
  intake("intake", "inputs/escaping-sheet.xlsx", xlsx({ badTarget: true }));
  intake("intake", "inputs/pdf/repair-cafe-handbook.pdf", plainPdf());
  intake("intake", "inputs/pdf/two-columns.pdf", columnsPdf());
  intake("intake", "inputs/pdf/room-table.pdf", tablePdf());
  intake("intake", "inputs/pdf/garden-newsletter.pdf", headerFooterPdf());
  intake("intake", "inputs/pdf/intake-with-scan.pdf", mixedScanPdf());
  intake("intake", "inputs/pdf/scanned-only.pdf", scanOnlyPdf());
  intake("intake", "inputs/handbook.html", handbookHtml());
  intake("intake", "inputs/images/floor-plan.png", png(8, 4));
  intake("intake", "inputs/site/assets/logo.png", png(3, 5));
  intake("intake-installed", "inputs/inventory.xlsx", xlsx());
  return files;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outRoot = process.argv[2] !== undefined ? resolve(process.argv[2]) : join(packageRoot, "test", "fixtures", "golden");
  for (const [rel, data] of generatedFixtures()) {
    const target = join(outRoot, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  process.stdout.write(`wrote ${generatedFixtures().size} generated fixtures under ${outRoot}\n`);
}
