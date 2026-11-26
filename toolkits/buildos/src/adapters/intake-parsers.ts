/**
 * The intake parser port (`src/core/intake/convert/parsers.ts`), built from
 * the bundled outside packages chosen in W1 R7 P4 t7 (see SECURITY.md):
 *
 * - `fflate` 0.8.3 inflates ZIP entries (DOCX and XLSX). The adapter reads
 *   the ZIP central directory itself and inflates an entry only when core
 *   asks for it, in small chunks, so every size limit counts real output.
 *   It imports fflate's browser build, which loads no Node module.
 * - `parse5` 8.1.1 parses HTML as the WHATWG algorithm does, as Go's
 *   `golang.org/x/net/html` does.
 * - `unpdf` 2.1.0 (its bundled serverless pdf.js) reads PDF text runs. Font
 *   loading, WebAssembly, and console output are turned off. No OCR.
 *
 * XML is not here: core reads it with its port of Go's `encoding/xml`.
 *
 * Every input is untrusted. Each parser enforces `INTAKE_LIMITS` and fails
 * with a `GoError` before core writes anything. The packages sit behind
 * this adapter, not in core, because core may load only the modules the
 * boundary rule allows. Each function takes bytes and returns plain data;
 * nothing here reads or writes a file or prints.
 */

import { crc32 } from "node:zlib";
import { Inflate } from "fflate/browser";
import { defaultTreeAdapter, parse as parseHtml5 } from "parse5";
import { getResolvedPDFJS } from "unpdf";
import { INTAKE_LIMITS, IntakeLimitError } from "../core/intake/limits.ts";
import type { HtmlAttr, HtmlNode, IntakeParsers, PdfTextItem, ZipEntry } from "../core/intake/convert/parsers.ts";
import { GoError } from "../core/shared/go-fs.ts";
import { goQuote } from "../core/shared/go-quote.ts";

// ---------------------------------------------------------------- ZIP

/** Go `zip.ErrFormat`, `zip.ErrAlgorithm`, and `zip.ErrChecksum`. */
const ZIP_FORMAT = "zip: not a valid zip file";
const ZIP_ALGORITHM = "zip: unsupported compression algorithm";
const ZIP_CHECKSUM = "zip: checksum error";
/** Compressed bytes pushed into the inflater at a time, so one push expands to at most about 1 MiB. */
const INFLATE_CHUNK = 1024;

const MiB = 1024 * 1024;
const sizeText = (bytes: number) => `${bytes / MiB} MiB`;

/**
 * True when an entry name could leave the folder it is extracted into, or
 * means something else on another system: an absolute path, a drive
 * letter, a `..` part, a backslash, or a NUL. Office packages never use one.
 */
export function unsafeZipName(name: string): boolean {
  if (name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name)) return true;
  return name.split("/").some((part) => part === "..");
}

function readZip(data: Uint8Array): ZipEntry[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const u64 = (at: number) => {
    const n = view.getBigUint64(at, true);
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new GoError(ZIP_FORMAT);
    return Number(n);
  };
  const within = (at: number, length: number) => at >= 0 && length >= 0 && at + length <= data.length;

  // The end of central directory record, within the last 64 KiB plus its own 22 bytes.
  let eocd = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 22 - 0xffff); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) <= data.length) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new GoError(ZIP_FORMAT);
  let count = u16(eocd + 10);
  let dirSize = u32(eocd + 12);
  let dirOffset = u32(eocd + 16);
  if ((count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) && eocd >= 20 && u32(eocd - 20) === 0x07064b50) {
    const at = u64(eocd - 20 + 8);
    if (!within(at, 56) || u32(at) !== 0x06064b50) throw new GoError(ZIP_FORMAT);
    count = u64(at + 32);
    dirSize = u64(at + 40);
    dirOffset = u64(at + 48);
  }
  if (count > INTAKE_LIMITS.zipMaxEntries) throw new IntakeLimitError("zip", `the entry count ${count}`, `${INTAKE_LIMITS.zipMaxEntries} entries`);
  if (!within(dirOffset, dirSize)) throw new GoError(ZIP_FORMAT);

  const names = new TextDecoder("utf-8", { ignoreBOM: true });
  const budget = { used: 0 };
  const entries: ZipEntry[] = [];
  let at = dirOffset;
  for (let i = 0; i < count; i++) {
    if (!within(at, 46) || u32(at) !== 0x02014b50) throw new GoError(ZIP_FORMAT);
    const method = u16(at + 10);
    const crc = u32(at + 16);
    let compressedSize = u32(at + 20);
    let size = u32(at + 24);
    const nameLength = u16(at + 28);
    const extraLength = u16(at + 30);
    const commentLength = u16(at + 32);
    let localOffset = u32(at + 42);
    if (!within(at + 46, nameLength + extraLength + commentLength)) throw new GoError(ZIP_FORMAT);
    const name = names.decode(data.subarray(at + 46, at + 46 + nameLength));
    // The ZIP64 extra field holds each value that is 0xFFFFFFFF above, in this order.
    for (let x = at + 46 + nameLength; x + 4 <= at + 46 + nameLength + extraLength; ) {
      const id = u16(x);
      const length = u16(x + 2);
      if (id === 0x0001) {
        let field = x + 4;
        const next = () => {
          if (field + 8 > x + 4 + length) throw new GoError(ZIP_FORMAT);
          const value = u64(field);
          field += 8;
          return value;
        };
        if (size === 0xffffffff) size = next();
        if (compressedSize === 0xffffffff) compressedSize = next();
        if (localOffset === 0xffffffff) localOffset = next();
      }
      x += 4 + length;
    }
    if (unsafeZipName(name)) throw new GoError(`zip: insecure file path ${goQuote(name)}`);
    entries.push({ name, read: () => inflateEntry(data, { name, method, crc, compressedSize, size, localOffset }, budget) });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

interface EntryHeader {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

/** Go `zip.File.Open` and a read to EOF, within the limits. */
function inflateEntry(data: Uint8Array, entry: EntryHeader, budget: { used: number }): Uint8Array {
  const limits = INTAKE_LIMITS;
  const label = `the entry ${goQuote(entry.name)}`;
  if (entry.size > limits.zipMaxEntryBytes) throw new IntakeLimitError("zip", `${label} (${entry.size} bytes expanded)`, `${sizeText(limits.zipMaxEntryBytes)} per entry`);
  if (budget.used + entry.size > limits.zipMaxTotalBytes) throw new IntakeLimitError("zip", `the expanded size of the entries read`, `${sizeText(limits.zipMaxTotalBytes)} in all`);
  if (entry.size > limits.zipRatioFloorBytes && entry.size > entry.compressedSize * limits.zipMaxRatio) {
    throw new IntakeLimitError("zip", `the compression ratio of ${label}`, `${limits.zipMaxRatio} to 1`);
  }
  const header = entry.localOffset;
  if (header + 30 > data.length || new DataView(data.buffer, data.byteOffset + header, 30).getUint32(0, true) !== 0x04034b50) throw new GoError(ZIP_FORMAT);
  const local = new DataView(data.buffer, data.byteOffset + header, 30);
  const start = header + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  if (start + entry.compressedSize > data.length) throw new GoError(ZIP_FORMAT);
  const raw = data.subarray(start, start + entry.compressedSize);

  // Never more than the declared size (Go fails a longer entry) or the limits.
  const cap = entry.size;
  let out: Uint8Array;
  if (entry.method === 0) {
    if (raw.length !== cap) throw new GoError(ZIP_FORMAT);
    out = raw.slice();
  } else if (entry.method === 8) {
    out = new Uint8Array(cap);
    let written = 0;
    let ended = false;
    const inflater = new Inflate((chunk, final) => {
      if (written + chunk.length > cap) throw new GoError(ZIP_FORMAT);
      out.set(chunk, written);
      written += chunk.length;
      if (final) ended = true;
    });
    try {
      for (let at = 0; at < raw.length; at += INFLATE_CHUNK) inflater.push(raw.subarray(at, at + INFLATE_CHUNK), at + INFLATE_CHUNK >= raw.length);
      if (raw.length === 0) inflater.push(new Uint8Array(0), true);
    } catch (error) {
      if (error instanceof GoError) throw error;
      throw new GoError(ZIP_FORMAT);
    }
    if (!ended || written !== cap) throw new GoError(ZIP_FORMAT);
  } else {
    throw new GoError(ZIP_ALGORITHM);
  }
  budget.used += out.length;
  if (crc32(out) >>> 0 !== entry.crc >>> 0) throw new GoError(ZIP_CHECKSUM);
  return out;
}

// ---------------------------------------------------------------- HTML

const HTML_NS = "http://www.w3.org/1999/xhtml";
const NAMESPACE: Record<string, string> = { "http://www.w3.org/2000/svg": "svg", "http://www.w3.org/1998/Math/MathML": "math" };

interface P5Node {
  nodeName: string;
  tagName?: string;
  namespaceURI?: string;
  attrs?: { name: string; value: string; prefix?: string }[];
  childNodes?: P5Node[];
  content?: P5Node;
  parentNode?: P5Node | null;
  value?: string;
  data?: string;
  name?: string;
  publicId?: string | null;
  systemId?: string | null;
}

/** The parse5 node tree as the port's plain data. Depth is already bounded by the parse. */
function htmlNode(n: P5Node): HtmlNode {
  switch (n.nodeName) {
    case "#document":
    case "#document-fragment":
      return { kind: "document", children: (n.childNodes ?? []).map(htmlNode) };
    case "#documentType":
      return { kind: "doctype", name: n.name ?? "", publicId: n.publicId ?? "", systemId: n.systemId ?? "" };
    case "#comment":
      return { kind: "comment", data: n.data ?? "" };
    case "#text":
      return { kind: "text", data: n.value ?? "" };
  }
  const attrs: HtmlAttr[] = (n.attrs ?? []).map((a) => ({ namespace: a.prefix ?? "", key: a.name, value: a.value }));
  const kids = n.tagName === "template" && n.namespaceURI === HTML_NS && n.content !== undefined ? (n.content.childNodes ?? []) : (n.childNodes ?? []);
  return { kind: "element", tag: n.tagName ?? n.nodeName, namespace: NAMESPACE[n.namespaceURI ?? ""] ?? "", attrs, children: kids.map(htmlNode) };
}

/**
 * parse5's default tree adapter, with the depth and node limits checked as
 * each node is inserted, so a hostile document stops early, before parse5's
 * own work grows with its depth.
 */
function limitedTreeAdapter(): typeof defaultTreeAdapter {
  const hosts = new WeakMap<object, P5Node>();
  let nodes = 0;
  const count = () => {
    if (++nodes > INTAKE_LIMITS.htmlMaxNodes) throw new IntakeLimitError("html", "the node count", `${INTAKE_LIMITS.htmlMaxNodes} nodes`);
  };
  const checkDepth = (parent: P5Node) => {
    let depth = 1;
    for (let cur: P5Node | null | undefined = parent; cur !== undefined && cur !== null; cur = cur.parentNode ?? hosts.get(cur)) {
      if (++depth > INTAKE_LIMITS.htmlMaxDepth) throw new IntakeLimitError("html", "the element nesting", `${INTAKE_LIMITS.htmlMaxDepth} levels`);
    }
  };
  const base = defaultTreeAdapter;
  return {
    ...base,
    appendChild(parent, child) {
      count();
      checkDepth(parent as unknown as P5Node);
      base.appendChild(parent, child);
    },
    insertBefore(parent, child, reference) {
      count();
      checkDepth(parent as unknown as P5Node);
      base.insertBefore(parent, child, reference);
    },
    insertText(parent, text) {
      count();
      base.insertText(parent, text);
    },
    insertTextBefore(parent, text, reference) {
      count();
      base.insertTextBefore(parent, text, reference);
    },
    setTemplateContent(template, content) {
      hosts.set(content, template as unknown as P5Node);
      base.setTemplateContent(template, content);
    },
  };
}

function parseHtml(data: Uint8Array): HtmlNode {
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(data);
  return htmlNode(parseHtml5(text, { treeAdapter: limitedTreeAdapter() }) as unknown as P5Node);
}

// ---------------------------------------------------------------- PDF

async function pdfText(data: Uint8Array): Promise<PdfTextItem[][]> {
  const { getDocument } = await getResolvedPDFJS();
  let doc;
  try {
    doc = await getDocument({
      data: new Uint8Array(data),
      verbosity: 0,
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: false,
      stopAtErrors: false,
    }).promise;
  } catch (error) {
    throw new GoError(error instanceof Error ? error.message : String(error));
  }
  try {
    if (doc.numPages > INTAKE_LIMITS.pdfMaxPages) throw new IntakeLimitError("pdf", `the page count ${doc.numPages}`, `${INTAKE_LIMITS.pdfMaxPages} pages`);
    const pages: PdfTextItem[][] = [];
    let chars = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      // The page's text is read chunk by chunk (pdf.js `streamTextContent`,
      // the stream behind `getTextContent`), and each chunk is charged to the
      // text budget as it arrives. Once the budget is spent, reading stops,
      // so the rest of the page is never read into the port.
      const reader = (await doc.getPage(p)).streamTextContent().getReader();
      const items: PdfTextItem[] = [];
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const item of value.items) {
            if (!("str" in item)) continue;
            chars += item.str.length;
            // No more chunks are read; the stream's high-water mark pauses
            // the producer, and destroying the document below ends it.
            // (`reader.cancel()` makes pdf.js enqueue into a closed stream.)
            if (chars > INTAKE_LIMITS.pdfMaxTextChars) throw new IntakeLimitError("pdf", "the extracted text", `${INTAKE_LIMITS.pdfMaxTextChars} characters`);
            const t = item.transform as number[];
            items.push({ str: item.str, x: t[4] ?? 0, y: t[5] ?? 0, width: item.width, size: Math.hypot(t[2] ?? 0, t[3] ?? 0) || 10 });
          }
        }
      } finally {
        reader.releaseLock();
      }
      pages.push(items);
    }
    return pages;
  } catch (error) {
    if (error instanceof GoError) throw error;
    throw new GoError(error instanceof Error ? error.message : String(error));
  } finally {
    await doc.loadingTask.destroy();
  }
}

/** The parsers the CLI passes to the intake core. */
export const intakeParsers: IntakeParsers = { readZip, parseHtml, pdfText };
