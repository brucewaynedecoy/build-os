/**
 * A port of the cross-reference checks of Go's `pdf.NewReader`
 * (`github.com/ledongthuc/pdf` v0.0.0-20250511090121-5959a4027728,
 * `read.go` and `lex.go`, BSD-3-Clause), so that a PDF Go refuses before
 * it reads any page is refused here with Go's text, and exit 1.
 *
 * After the header, `%%EOF`, and final `startxref` line checks
 * (`goPdfOpenError` in `pdf.ts`), Go reads the `startxref` operand (it must
 * be an integer), then the cross-reference section at that offset: an
 * `xref` table with its rows, its trailer dictionary, every `/Prev` table,
 * and the trailer's `/Size`; or an `xref` stream object with `/Type /XRef`,
 * `/Size`, `/Index`, and `/W`. This port runs the same token reader over the
 * same bytes and returns Go's error text. It does not decode the stream
 * data of an `xref` stream or check encryption; pdf.js reads those (see the
 * evidence report, P4 open items).
 *
 * Go's lexer panics on some malformed input (a read past the end of the
 * file, an integer out of range, a bad escape). The Go tool then crashes
 * with exit 2 and a stack trace. The port fails cleanly instead: exit 1 and
 * `open pdf: <the panic message>`.
 */

import { INTAKE_LIMITS, IntakeLimitError } from "../limits.ts";
import { goQuote } from "../../shared/go-quote.ts";

const PDF_MAX_OBJECT_DEPTH = INTAKE_LIMITS.pdfMaxObjectDepth;
const PDF_MAX_XREF_SECTIONS = INTAKE_LIMITS.pdfMaxXrefSections;

/** A panic of Go's lexer, carried as an exception. */
class GoPdfPanic extends Error {}

type PdfObject =
  | null
  | { k: "kw"; v: string }
  | { k: "name"; v: string }
  | { k: "str"; v: string }
  | { k: "int"; v: bigint }
  | { k: "real"; v: number }
  | { k: "bool"; v: boolean }
  | { k: "eof" }
  | { k: "dict"; v: Map<string, PdfObject> }
  | { k: "array"; v: PdfObject[] }
  | { k: "stream"; hdr: Map<string, PdfObject>; id: number; gen: number; offset: number }
  | { k: "ptr"; id: number; gen: number }
  | { k: "def"; id: number; gen: number; obj: PdfObject };

const isSpace = (b: number): boolean => b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0c || b === 0x0d || b === 0x20;
const isDelim = (b: number): boolean => b === 0x3c || b === 0x3e || b === 0x28 || b === 0x29 || b === 0x5b || b === 0x5d || b === 0x7b || b === 0x7d || b === 0x2f || b === 0x25;
const unhex = (b: number): number => (b >= 0x30 && b <= 0x39 ? b - 0x30 : b >= 0x61 && b <= 0x66 ? b - 0x61 + 10 : b >= 0x41 && b <= 0x46 ? b - 0x41 + 10 : -1);
const latin1 = (bytes: Uint8Array | number[]): string => {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
};
const kw = (v: string): PdfObject => ({ k: "kw", v });
const isKw = (tok: PdfObject, v: string): boolean => tok !== null && tok.k === "kw" && tok.v === v;

const BLOCK = 4096;

/** Go's `buffer`: a reader over `data` from `start` to the end of the file, as `io.NewSectionReader(f, start, end-start)`. */
class GoPdfBuffer {
  private pos: number;
  private readonly unread: PdfObject[] = [];
  /** The object being read (`b.objptr`), for a stream's pointer. */
  objId = 0;
  objGen = 0;
  private depth = 0;

  private readonly data: Uint8Array;
  private readonly start: number;

  constructor(data: Uint8Array, start: number) {
    this.data = data;
    this.start = start;
    this.pos = start;
  }

  /** Go's `b.offset` when a read runs out: the end of what was loaded. */
  private eofOffset(): number {
    return Math.max(this.start, this.data.length);
  }

  readByte(): number {
    if (this.start < 0) throw new GoPdfPanic(`malformed PDF: reading at offset ${this.start}: negative offset`);
    if (this.pos >= this.data.length) throw new GoPdfPanic(`malformed PDF: reading at offset ${this.eofOffset()}: EOF`);
    return this.data[this.pos++]!;
  }

  unreadByte(): void {
    if (this.pos > this.start) this.pos--;
  }

  unreadToken(tok: PdfObject): void {
    this.unread.push(tok);
  }

  /** The offset of the next byte (`b.readOffset`). */
  offset(): number {
    return this.pos;
  }

  /** The rest of the current 4096-byte block (`b.buf[b.pos:]`). */
  private restOfBlock(): Uint8Array {
    const blockEnd = Math.min(this.data.length, (Math.floor((this.pos - 1) / BLOCK) + 1) * BLOCK);
    return this.data.subarray(this.pos, Math.max(this.pos, blockEnd));
  }

  readToken(): PdfObject {
    const queued = this.unread.pop();
    if (queued !== undefined) return queued;
    let c = this.readByte();
    for (;;) {
      if (isSpace(c)) {
        c = this.readByte();
      } else if (c === 0x25) {
        while (c !== 0x0d && c !== 0x0a) c = this.readByte();
      } else {
        break;
      }
    }
    switch (c) {
      case 0x3c: // <
        if (this.readByte() === 0x3c) return kw("<<");
        this.unreadByte();
        return this.readHexString();
      case 0x28: // (
        return this.readLiteralString();
      case 0x5b:
      case 0x5d:
      case 0x7b:
      case 0x7d:
        return kw(String.fromCharCode(c));
      case 0x2f: // /
        return this.readName();
      default:
        if (c === 0x3e) {
          // >: Go falls through to the delimiter check.
          if (this.readByte() === 0x3e) return kw(">>");
          this.unreadByte();
        }
        if (isDelim(c)) throw new GoPdfPanic(`unexpected delimiter '${String.fromCharCode(c)}'`);
        this.unreadByte();
        return this.readKeyword();
    }
  }

  private readHexString(): PdfObject {
    const tmp: number[] = [];
    for (;;) {
      const c = this.readByte();
      if (c === 0x3e) break;
      if (isSpace(c)) continue;
      let c2 = this.readByte();
      while (isSpace(c2)) c2 = this.readByte();
      const x = (unhex(c) << 4) | unhex(c2);
      if (x < 0) throw new GoPdfPanic(`malformed hex string ${String.fromCharCode(c)} ${String.fromCharCode(c2)} ${latin1(this.restOfBlock())}`);
      tmp.push(x);
    }
    return { k: "str", v: latin1(tmp) };
  }

  private readLiteralString(): PdfObject {
    const tmp: number[] = [];
    let depth = 1;
    for (;;) {
      let c = this.readByte();
      if (c === 0x28) {
        depth++;
        tmp.push(c);
      } else if (c === 0x29) {
        if (--depth === 0) break;
        tmp.push(c);
      } else if (c === 0x5c) {
        c = this.readByte();
        switch (c) {
          case 0x6e: tmp.push(0x0a); break;
          case 0x72: tmp.push(0x0d); break;
          case 0x62: tmp.push(0x08); break;
          case 0x74: tmp.push(0x09); break;
          case 0x66: tmp.push(0x0c); break;
          case 0x28:
          case 0x29:
          case 0x5c:
            tmp.push(c);
            break;
          case 0x0d:
            if (this.readByte() !== 0x0a) this.unreadByte();
            break;
          case 0x0a:
            break;
          default:
            if (c >= 0x30 && c <= 0x37) {
              let x = c - 0x30;
              for (let i = 0; i < 2; i++) {
                c = this.readByte();
                if (c < 0x30 || c > 0x37) {
                  this.unreadByte();
                  break;
                }
                x = x * 8 + (c - 0x30);
              }
              if (x > 255) throw new GoPdfPanic(`invalid octal escape \\${x.toString(8).padStart(3, "0")}`);
              tmp.push(x);
            } else {
              throw new GoPdfPanic(`invalid escape sequence \\${String.fromCharCode(c)}`);
            }
        }
      } else {
        tmp.push(c);
      }
    }
    return { k: "str", v: latin1(tmp) };
  }

  private readName(): PdfObject {
    const tmp: number[] = [];
    for (;;) {
      const c = this.readByte();
      if (isDelim(c) || isSpace(c)) {
        this.unreadByte();
        break;
      }
      if (c === 0x23) {
        const x = (unhex(this.readByte()) << 4) | unhex(this.readByte());
        if (x < 0) throw new GoPdfPanic("malformed name");
        tmp.push(x);
        continue;
      }
      tmp.push(c);
    }
    return { k: "name", v: latin1(tmp) };
  }

  private readKeyword(): PdfObject {
    const tmp: number[] = [];
    for (;;) {
      const c = this.readByte();
      if (isDelim(c) || isSpace(c)) {
        this.unreadByte();
        break;
      }
      tmp.push(c);
    }
    const s = latin1(tmp);
    if (s === "true") return { k: "bool", v: true };
    if (s === "false") return { k: "bool", v: false };
    if (/^[+-]?[0-9]+$/.test(s)) {
      const v = BigInt(s);
      if (v > 9223372036854775807n || v < -9223372036854775808n) throw new GoPdfPanic(`invalid integer ${s}`);
      return { k: "int", v };
    }
    if (/^[+-]?[0-9.]+$/.test(s) && s.split(".").length === 2) {
      const body = s.replace(/^[+-]/, "");
      if (body === ".") throw new GoPdfPanic(`invalid real ${s}`);
      return { k: "real", v: Number(s) };
    }
    return kw(s);
  }

  readObject(): PdfObject {
    const tok = this.readToken();
    if (tok !== null && tok.k === "kw") {
      switch (tok.v) {
        case "null":
          return null;
        case "<<":
          return this.nested(() => this.readDict());
        case "[":
          return this.nested(() => this.readArray());
        case ">>":
          return null;
      }
      throw new GoPdfPanic(`unexpected keyword ${goQuote(tok.v)} parsing object`);
    }
    if (tok !== null && tok.k === "int" && tok.v >= 0n && tok.v <= 0xffffffffn) {
      const tok2 = this.readToken();
      if (tok2 !== null && tok2.k === "int" && tok2.v >= 0n && tok2.v <= 0xffffn) {
        const tok3 = this.readToken();
        if (isKw(tok3, "R")) return { k: "ptr", id: Number(tok.v), gen: Number(tok2.v) };
        if (isKw(tok3, "obj")) {
          const [oldId, oldGen] = [this.objId, this.objGen];
          this.objId = Number(tok.v);
          this.objGen = Number(tok2.v);
          const obj = this.readObject();
          if (obj === null || obj.k !== "stream") {
            const tok4 = this.readToken();
            if (!isKw(tok4, "endobj")) throw new GoPdfPanic("missing endobj after indirect object definition");
          }
          this.objId = oldId;
          this.objGen = oldGen;
          return { k: "def", id: Number(tok.v), gen: Number(tok2.v), obj };
        }
        this.unreadToken(tok3);
      }
      this.unreadToken(tok2);
    }
    return tok;
  }

  private nested(read: () => PdfObject): PdfObject {
    if (++this.depth > PDF_MAX_OBJECT_DEPTH) throw new IntakeLimitError("pdf", "the object nesting", `${PDF_MAX_OBJECT_DEPTH} levels`);
    try {
      return read();
    } finally {
      this.depth--;
    }
  }

  private readArray(): PdfObject {
    const x: PdfObject[] = [];
    for (;;) {
      const tok = this.readToken();
      if (tok === null || isKw(tok, "]")) break;
      this.unreadToken(tok);
      x.push(this.readObject());
    }
    return { k: "array", v: x };
  }

  private readDict(): PdfObject {
    const x = new Map<string, PdfObject>();
    for (;;) {
      const tok = this.readToken();
      if (tok === null || isKw(tok, ">>")) break;
      if (tok.k !== "name") throw new GoPdfPanic(`unexpected non-name key ${goTypeName(tok)}(${goSprint(tok)}) parsing dictionary`);
      x.set(tok.v, this.readObject());
    }
    const tok = this.readToken();
    if (!isKw(tok, "stream")) {
      this.unreadToken(tok);
      return { k: "dict", v: x };
    }
    switch (this.readByte()) {
      case 0x0d:
        if (this.readByte() !== 0x0a) this.unreadByte();
        break;
      case 0x0a:
        break;
      default:
        throw new GoPdfPanic("stream keyword not followed by newline");
    }
    return { k: "stream", hdr: x, id: this.objId, gen: this.objGen, offset: this.offset() };
  }
}

/** Go's `%T` of a token. */
function goTypeName(tok: PdfObject): string {
  if (tok === null) return "<nil>";
  switch (tok.k) {
    case "kw": return "pdf.keyword";
    case "name": return "pdf.name";
    case "str": return "string";
    case "int": return "int64";
    case "real": return "float64";
    case "bool": return "bool";
    case "eof": return "*errors.errorString";
    default: return `pdf.${tok.k}`;
  }
}

/** Go's `%v` of a float64: `%g` with the shortest digits, in exponent form below 1e-4 or from 1e+06. */
function goFloat(v: number): string {
  if (Number.isNaN(v)) return "NaN";
  if (!Number.isFinite(v)) return v > 0 ? "+Inf" : "-Inf";
  if (v === 0) return Object.is(v, -0) ? "-0" : "0";
  const [mant, expText] = v.toExponential().split("e") as [string, string];
  const exp = Number(expText);
  if (exp < -4 || exp >= 6) return `${mant}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  return String(v);
}

/** Go's `fmt.Sprint` (`%v`) of an object, as the library's error texts print it. */
function goSprint(x: PdfObject): string {
  if (x === null) return "<nil>";
  switch (x.k) {
    case "kw":
    case "name":
    case "str":
      return x.v;
    case "int":
      return String(x.v);
    case "real":
      return goFloat(x.v);
    case "bool":
      return String(x.v);
    case "eof":
      return "EOF";
    case "dict":
      return `map[${[...x.v.keys()].sort().map((k) => `${k}:${goSprint(x.v.get(k)!)}`).join(" ")}]`;
    case "array":
      return `[${x.v.map(goSprint).join(" ")}]`;
    case "stream":
      return `{${goSprint({ k: "dict", v: x.hdr })} {${x.id} ${x.gen}} ${x.offset}}`;
    case "ptr":
      return `{${x.id} ${x.gen}}`;
    case "def":
      return `{{${x.id} ${x.gen}} ${goSprint(x.obj)}}`;
  }
}

const NO_RUNE = -1;
/** The library's `pdfDocEncoding` table (PDF 32000-1:2008, Table D.2). */
const PDF_DOC_ENCODING: readonly number[] = (() => {
  const table = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0; i < 0x20; i++) table[i] = NO_RUNE;
  table[0x09] = 0x09;
  table[0x0a] = 0x0a;
  table[0x0d] = 0x0d;
  [0x02d8, 0x02c7, 0x02c6, 0x02d9, 0x02dd, 0x02db, 0x02da, 0x02dc].forEach((r, i) => (table[0x18 + i] = r));
  table[0x7f] = NO_RUNE;
  [
    0x2022, 0x2020, 0x2021, 0x2026, 0x2014, 0x2013, 0x0192, 0x2044, 0x2039, 0x203a, 0x2212, 0x2030, 0x201e, 0x201c, 0x201d, 0x2018,
    0x2019, 0x201a, 0x2122, 0xfb01, 0xfb02, 0x0141, 0x0152, 0x0160, 0x0178, 0x017d, 0x0131, 0x0142, 0x0153, 0x0161, 0x017e, NO_RUNE,
    0x20ac,
  ].forEach((r, i) => (table[0x80 + i] = r));
  table[0xad] = NO_RUNE;
  return table;
})();

/** Go's `strconv.Quote` of a byte string: valid UTF-8 as text, any other byte as `\xNN`. */
function goQuoteBytes(s: string): string {
  const bytes = Uint8Array.from(s, (ch) => ch.charCodeAt(0));
  try {
    return goQuote(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    let out = "";
    for (const b of bytes) out += b >= 0x80 ? `\\x${b.toString(16).padStart(2, "0")}` : goQuote(String.fromCharCode(b)).slice(1, -1);
    return `"${out}"`;
  }
}

/** The library's `objfmt`. */
function objfmt(x: PdfObject): string {
  if (x === null) return "<nil>";
  switch (x.k) {
    case "str": {
      const s = x.v;
      const utf16 = s.length >= 2 && s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff && s.length % 2 === 0;
      if (!utf16 && [...s].every((ch) => PDF_DOC_ENCODING[ch.charCodeAt(0)] !== NO_RUNE)) {
        return goQuote([...s].map((ch) => String.fromCodePoint(PDF_DOC_ENCODING[ch.charCodeAt(0)]!)).join(""));
      }
      if (utf16) {
        let text = "";
        for (let i = 2; i < s.length; i += 2) text += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
        return goQuote(text.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "�"));
      }
      return goQuoteBytes(s);
    }
    case "name":
      return `/${x.v}`;
    case "dict":
      return `<<${[...x.v.keys()].sort().map((k) => `/${k} ${objfmt(x.v.get(k)!)}`).join(" ")}>>`;
    case "array":
      return `[${x.v.map(objfmt).join(" ")}]`;
    case "stream":
      return `${objfmt({ k: "dict", v: x.hdr })}@${x.offset}`;
    case "ptr":
      return `${x.id} ${x.gen} R`;
    case "def":
      return `{${x.id} ${x.gen} obj}${objfmt(x.obj)}`;
    default:
      return goSprint(x);
  }
}

/** Go `readXrefTableData`: true when the rows are well formed, up to `trailer`. */
function readXrefTableData(b: GoPdfBuffer): boolean {
  for (;;) {
    const tok = b.readToken();
    if (isKw(tok, "trailer")) return true;
    const n = b.readToken();
    if (tok === null || tok.k !== "int" || n === null || n.k !== "int") return false;
    for (let i = 0n; i < n.v; i++) {
      const off = b.readToken();
      const gen = b.readToken();
      const alloc = b.readToken();
      if (off === null || off.k !== "int" || gen === null || gen.k !== "int" || alloc === null || alloc.k !== "kw" || (alloc.v !== "f" && alloc.v !== "n")) return false;
    }
  }
}

/** Go `readXrefTable`, after the `xref` keyword. */
function readXrefTable(data: Uint8Array, b: GoPdfBuffer): string | undefined {
  if (!readXrefTableData(b)) return "malformed PDF: malformed xref table";
  const trailer = b.readObject();
  if (trailer === null || trailer.k !== "dict") return "malformed PDF: xref table not followed by trailer dictionary";
  let prev = trailer.v.get("Prev");
  for (let sections = 1; prev !== undefined && prev !== null; sections++) {
    if (sections > PDF_MAX_XREF_SECTIONS) throw new IntakeLimitError("pdf", "the /Prev cross-reference chain", `${PDF_MAX_XREF_SECTIONS} sections`);
    if (prev.k !== "int") return `malformed PDF: xref Prev is not integer: ${goSprint(prev)}`;
    const pb = new GoPdfBuffer(data, Number(prev.v));
    if (!isKw(pb.readToken(), "xref")) return "malformed PDF: xref Prev does not point to xref";
    if (!readXrefTableData(pb)) return "malformed PDF: malformed xref table";
    const next = pb.readObject();
    if (next === null || next.k !== "dict") return "malformed PDF: xref Prev table not followed by trailer dictionary";
    prev = next.v.get("Prev");
  }
  const size = trailer.v.get("Size");
  if (size === undefined || size === null || size.k !== "int") return "malformed PDF: trailer missing /Size entry";
  return undefined;
}

/** Go `readXrefStream`, up to the stream data, which pdf.js reads. */
function readXrefStream(b: GoPdfBuffer): string | undefined {
  const obj1 = b.readObject();
  if (obj1 === null || obj1.k !== "def") return `malformed PDF: cross-reference table not found: ${objfmt(obj1)}`;
  const strm = obj1.obj;
  if (strm === null || strm.k !== "stream") return `malformed PDF: cross-reference table not found: ${objfmt(obj1)}`;
  const type = strm.hdr.get("Type");
  if (type === undefined || type === null || type.k !== "name" || type.v !== "XRef") return "malformed PDF: xref stream does not have type XRef";
  const size = strm.hdr.get("Size");
  if (size === undefined || size === null || size.k !== "int") return "malformed PDF: xref stream missing Size";
  if (size.v < 0n) return "malformed PDF: makeslice: len out of range";
  const index = strm.hdr.get("Index");
  if (index !== undefined && index !== null && index.k === "array" && index.v.length > 0 && index.v.length % 2 !== 0) return `malformed PDF: invalid Index array ${objfmt(index)}`;
  const ww = strm.hdr.get("W");
  if (ww === undefined || ww === null || ww.k !== "array") return "malformed PDF: xref stream missing W array";
  if (ww.v.length < 3 || ww.v.some((w) => w === null || w.k !== "int")) return `malformed PDF: invalid W array ${objfmt(ww)}`;
  return undefined;
}

/**
 * Go's `pdf.NewReader` checks from the final `startxref` line on: `at` is
 * the offset of that line's `startxref` keyword. Returns Go's error text,
 * or undefined when the cross-reference section passes.
 */
export function goPdfXrefError(data: Uint8Array, at: number): string | undefined {
  try {
    const b = new GoPdfBuffer(data, at);
    if (!isKw(b.readToken(), "startxref")) return "malformed PDF file: missing startxref";
    const startxref = b.readToken();
    if (startxref === null || startxref.k !== "int") return "malformed PDF file: startxref not followed by integer";
    const offset = startxref.v;
    if (offset > BigInt(Number.MAX_SAFE_INTEGER) || offset < -BigInt(Number.MAX_SAFE_INTEGER)) return `malformed PDF: reading at offset ${offset}: EOF`;
    const xb = new GoPdfBuffer(data, Number(offset));
    const tok = xb.readToken();
    if (isKw(tok, "xref")) return readXrefTable(data, xb);
    if (tok !== null && tok.k === "int") {
      xb.unreadToken(tok);
      return readXrefStream(xb);
    }
    return `malformed PDF: cross-reference table not found: ${goSprint(tok)}`;
  } catch (error) {
    if (error instanceof GoPdfPanic) return error.message;
    throw error;
  }
}
