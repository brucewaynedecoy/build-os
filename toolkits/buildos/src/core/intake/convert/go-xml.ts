/*! XML decoder ported from the Go standard library (go1.24.1),
 * src/encoding/xml/xml.go (Decoder.Token, rawToken, text, name, nsname,
 * and the name tables) and src/encoding/xml/read.go (Unmarshal's search for
 * the root element). Copyright 2009 The Go Authors. Licensed under the
 * BSD-3-Clause license. The full license text is in THIRD_PARTY_NOTICES.md.
 * @license BSD-3-Clause
 */

/**
 * Go's `encoding/xml` decoder in strict mode, as the Go intake tool uses it
 * (`xml.Unmarshal` and `Decoder.Token`): the same well-formedness rules, the
 * same error texts (`XML syntax error on line N: ...`), and the same name
 * space translation. As in Go, a `<!DOCTYPE ...>` directive is skipped:
 * no entity it declares is ever expanded, no external entity is loaded,
 * and only the five predefined entities and character references are
 * read. Unlike Go, open elements and nodes are bounded (see
 * `INTAKE_LIMITS`). The decoder is iterative, so nesting never grows the
 * JavaScript stack.
 */

import { GoError } from "../../shared/go-fs.ts";
import { goQuote } from "../../shared/go-quote.ts";
import { INTAKE_LIMITS, IntakeLimitError } from "../limits.ts";
import type { XmlAttr, XmlElement, XmlNode } from "./parsers.ts";

// (lo, hi, stride) triples of Go's `first` (Letter | '_' | ':') and `second` (NameChar) tables.
const FIRST = [
  0x003A, 0x003A, 1, 0x0041, 0x005A, 1, 0x005F, 0x005F, 1, 0x0061, 0x007A, 1, 0x00C0, 0x00D6, 1, 0x00D8, 0x00F6, 1, 0x00F8, 0x00FF, 1, 0x0100, 0x0131, 1,
  0x0134, 0x013E, 1, 0x0141, 0x0148, 1, 0x014A, 0x017E, 1, 0x0180, 0x01C3, 1, 0x01CD, 0x01F0, 1, 0x01F4, 0x01F5, 1, 0x01FA, 0x0217, 1, 0x0250, 0x02A8, 1,
  0x02BB, 0x02C1, 1, 0x0386, 0x0386, 1, 0x0388, 0x038A, 1, 0x038C, 0x038C, 1, 0x038E, 0x03A1, 1, 0x03A3, 0x03CE, 1, 0x03D0, 0x03D6, 1, 0x03DA, 0x03E0, 2,
  0x03E2, 0x03F3, 1, 0x0401, 0x040C, 1, 0x040E, 0x044F, 1, 0x0451, 0x045C, 1, 0x045E, 0x0481, 1, 0x0490, 0x04C4, 1, 0x04C7, 0x04C8, 1, 0x04CB, 0x04CC, 1,
  0x04D0, 0x04EB, 1, 0x04EE, 0x04F5, 1, 0x04F8, 0x04F9, 1, 0x0531, 0x0556, 1, 0x0559, 0x0559, 1, 0x0561, 0x0586, 1, 0x05D0, 0x05EA, 1, 0x05F0, 0x05F2, 1,
  0x0621, 0x063A, 1, 0x0641, 0x064A, 1, 0x0671, 0x06B7, 1, 0x06BA, 0x06BE, 1, 0x06C0, 0x06CE, 1, 0x06D0, 0x06D3, 1, 0x06D5, 0x06D5, 1, 0x06E5, 0x06E6, 1,
  0x0905, 0x0939, 1, 0x093D, 0x093D, 1, 0x0958, 0x0961, 1, 0x0985, 0x098C, 1, 0x098F, 0x0990, 1, 0x0993, 0x09A8, 1, 0x09AA, 0x09B0, 1, 0x09B2, 0x09B2, 1,
  0x09B6, 0x09B9, 1, 0x09DC, 0x09DD, 1, 0x09DF, 0x09E1, 1, 0x09F0, 0x09F1, 1, 0x0A05, 0x0A0A, 1, 0x0A0F, 0x0A10, 1, 0x0A13, 0x0A28, 1, 0x0A2A, 0x0A30, 1,
  0x0A32, 0x0A33, 1, 0x0A35, 0x0A36, 1, 0x0A38, 0x0A39, 1, 0x0A59, 0x0A5C, 1, 0x0A5E, 0x0A5E, 1, 0x0A72, 0x0A74, 1, 0x0A85, 0x0A8B, 1, 0x0A8D, 0x0A8D, 1,
  0x0A8F, 0x0A91, 1, 0x0A93, 0x0AA8, 1, 0x0AAA, 0x0AB0, 1, 0x0AB2, 0x0AB3, 1, 0x0AB5, 0x0AB9, 1, 0x0B05, 0x0B0C, 1, 0x0B0F, 0x0B10, 1, 0x0B13, 0x0B28, 1,
  0x0B2A, 0x0B30, 1, 0x0B32, 0x0B33, 1, 0x0B36, 0x0B39, 1, 0x0B3D, 0x0B3D, 1, 0x0B5C, 0x0B5D, 1, 0x0B5F, 0x0B61, 1, 0x0B85, 0x0B8A, 1, 0x0B8E, 0x0B90, 1,
  0x0B92, 0x0B95, 1, 0x0B99, 0x0B9A, 1, 0x0B9C, 0x0B9C, 1, 0x0B9E, 0x0B9F, 1, 0x0BA3, 0x0BA4, 1, 0x0BA8, 0x0BAA, 1, 0x0BAE, 0x0BB5, 1, 0x0BB7, 0x0BB9, 1,
  0x0C05, 0x0C0C, 1, 0x0C0E, 0x0C10, 1, 0x0C12, 0x0C28, 1, 0x0C2A, 0x0C33, 1, 0x0C35, 0x0C39, 1, 0x0C60, 0x0C61, 1, 0x0C85, 0x0C8C, 1, 0x0C8E, 0x0C90, 1,
  0x0C92, 0x0CA8, 1, 0x0CAA, 0x0CB3, 1, 0x0CB5, 0x0CB9, 1, 0x0CDE, 0x0CDE, 1, 0x0CE0, 0x0CE1, 1, 0x0D05, 0x0D0C, 1, 0x0D0E, 0x0D10, 1, 0x0D12, 0x0D28, 1,
  0x0D2A, 0x0D39, 1, 0x0D60, 0x0D61, 1, 0x0E01, 0x0E2E, 1, 0x0E30, 0x0E30, 1, 0x0E32, 0x0E33, 1, 0x0E40, 0x0E45, 1, 0x0E81, 0x0E82, 1, 0x0E84, 0x0E84, 1,
  0x0E87, 0x0E88, 1, 0x0E8A, 0x0E8D, 3, 0x0E94, 0x0E97, 1, 0x0E99, 0x0E9F, 1, 0x0EA1, 0x0EA3, 1, 0x0EA5, 0x0EA7, 2, 0x0EAA, 0x0EAB, 1, 0x0EAD, 0x0EAE, 1,
  0x0EB0, 0x0EB0, 1, 0x0EB2, 0x0EB3, 1, 0x0EBD, 0x0EBD, 1, 0x0EC0, 0x0EC4, 1, 0x0F40, 0x0F47, 1, 0x0F49, 0x0F69, 1, 0x10A0, 0x10C5, 1, 0x10D0, 0x10F6, 1,
  0x1100, 0x1100, 1, 0x1102, 0x1103, 1, 0x1105, 0x1107, 1, 0x1109, 0x1109, 1, 0x110B, 0x110C, 1, 0x110E, 0x1112, 1, 0x113C, 0x1140, 2, 0x114C, 0x1150, 2,
  0x1154, 0x1155, 1, 0x1159, 0x1159, 1, 0x115F, 0x1161, 1, 0x1163, 0x1169, 2, 0x116D, 0x116E, 1, 0x1172, 0x1173, 1, 0x11AE, 0x11AF, 1, 0x11B7, 0x11B8, 1,
  0x11BA, 0x11BA, 1, 0x11BC, 0x11C2, 1, 0x11F9, 0x11F9, 1, 0x1E00, 0x1E9B, 1, 0x1EA0, 0x1EF9, 1, 0x1F00, 0x1F15, 1, 0x1F18, 0x1F1D, 1, 0x1F20, 0x1F45, 1,
  0x1F48, 0x1F4D, 1, 0x1F50, 0x1F57, 1, 0x1F5D, 0x1F5D, 1, 0x1F5F, 0x1F7D, 1, 0x1F80, 0x1FB4, 1, 0x1FB6, 0x1FBC, 1, 0x1FBE, 0x1FBE, 1, 0x1FC2, 0x1FC4, 1,
  0x1FC6, 0x1FCC, 1, 0x1FD0, 0x1FD3, 1, 0x1FD6, 0x1FDB, 1, 0x1FE0, 0x1FEC, 1, 0x1FF2, 0x1FF4, 1, 0x1FF6, 0x1FFC, 1, 0x2126, 0x2126, 1, 0x212A, 0x212B, 1,
  0x212E, 0x212E, 1, 0x2180, 0x2182, 1, 0x3007, 0x3007, 1, 0x3021, 0x3029, 1, 0x3041, 0x3094, 1, 0x30A1, 0x30FA, 1, 0x3105, 0x312C, 1, 0x4E00, 0x9FA5, 1,
  0xAC00, 0xD7A3, 1,
];
const SECOND = [
  0x002D, 0x002E, 1, 0x0030, 0x0039, 1, 0x00B7, 0x00B7, 1, 0x02D0, 0x02D1, 1, 0x0300, 0x0345, 1, 0x0360, 0x0361, 1, 0x0387, 0x0387, 1, 0x0483, 0x0486, 1,
  0x0591, 0x05A1, 1, 0x05A3, 0x05B9, 1, 0x05BB, 0x05BD, 1, 0x05BF, 0x05BF, 1, 0x05C1, 0x05C2, 1, 0x064B, 0x0652, 1, 0x0660, 0x0669, 1, 0x0670, 0x0670, 1,
  0x06D6, 0x06DC, 1, 0x06DD, 0x06DF, 1, 0x06E0, 0x06E4, 1, 0x06E7, 0x06E8, 1, 0x06EA, 0x06ED, 1, 0x06F0, 0x06F9, 1, 0x0901, 0x0903, 1, 0x093C, 0x093C, 1,
  0x093E, 0x094C, 1, 0x094D, 0x094D, 1, 0x0951, 0x0954, 1, 0x0962, 0x0963, 1, 0x0966, 0x096F, 1, 0x0981, 0x0983, 1, 0x09BC, 0x09BC, 1, 0x09BE, 0x09BF, 1,
  0x09C0, 0x09C4, 1, 0x09C7, 0x09C8, 1, 0x09CB, 0x09CD, 1, 0x09D7, 0x09D7, 1, 0x09E2, 0x09E3, 1, 0x09E6, 0x09EF, 1, 0x0A3E, 0x0A3F, 1, 0x0A40, 0x0A42, 1,
  0x0A47, 0x0A48, 1, 0x0A4B, 0x0A4D, 1, 0x0A66, 0x0A6F, 1, 0x0A70, 0x0A71, 1, 0x0A81, 0x0A83, 1, 0x0ABC, 0x0ABC, 1, 0x0ABE, 0x0AC5, 1, 0x0AC7, 0x0AC9, 1,
  0x0ACB, 0x0ACD, 1, 0x0AE6, 0x0AEF, 1, 0x0B01, 0x0B03, 1, 0x0B3C, 0x0B3C, 1, 0x0B3E, 0x0B43, 1, 0x0B47, 0x0B48, 1, 0x0B4B, 0x0B4D, 1, 0x0B56, 0x0B57, 1,
  0x0B66, 0x0B6F, 1, 0x0B82, 0x0B83, 1, 0x0BBE, 0x0BC2, 1, 0x0BC6, 0x0BC8, 1, 0x0BCA, 0x0BCD, 1, 0x0BD7, 0x0BD7, 1, 0x0BE7, 0x0BEF, 1, 0x0C01, 0x0C03, 1,
  0x0C3E, 0x0C44, 1, 0x0C46, 0x0C48, 1, 0x0C4A, 0x0C4D, 1, 0x0C55, 0x0C56, 1, 0x0C66, 0x0C6F, 1, 0x0C82, 0x0C83, 1, 0x0CBE, 0x0CC4, 1, 0x0CC6, 0x0CC8, 1,
  0x0CCA, 0x0CCD, 1, 0x0CD5, 0x0CD6, 1, 0x0CE6, 0x0CEF, 1, 0x0D02, 0x0D03, 1, 0x0D3E, 0x0D43, 1, 0x0D46, 0x0D48, 1, 0x0D4A, 0x0D4D, 1, 0x0D57, 0x0D57, 1,
  0x0D66, 0x0D6F, 1, 0x0E31, 0x0E31, 1, 0x0E34, 0x0E3A, 1, 0x0E46, 0x0E46, 1, 0x0E47, 0x0E4E, 1, 0x0E50, 0x0E59, 1, 0x0EB1, 0x0EB1, 1, 0x0EB4, 0x0EB9, 1,
  0x0EBB, 0x0EBC, 1, 0x0EC6, 0x0EC6, 1, 0x0EC8, 0x0ECD, 1, 0x0ED0, 0x0ED9, 1, 0x0F18, 0x0F19, 1, 0x0F20, 0x0F29, 1, 0x0F35, 0x0F39, 2, 0x0F3E, 0x0F3F, 1,
  0x0F71, 0x0F84, 1, 0x0F86, 0x0F8B, 1, 0x0F90, 0x0F95, 1, 0x0F97, 0x0F97, 1, 0x0F99, 0x0FAD, 1, 0x0FB1, 0x0FB7, 1, 0x0FB9, 0x0FB9, 1, 0x20D0, 0x20DC, 1,
  0x302A, 0x302F, 1, 0x3031, 0x3035, 1, 0x3099, 0x309A, 1, 0x309D, 0x309E, 1, 0x30FC, 0x30FE, 1,
];

function inTable(table: readonly number[], r: number): boolean {
  let lo = 0;
  let hi = table.length / 3;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    const a = table[m * 3]!;
    const b = table[m * 3 + 1]!;
    if (r < a) hi = m;
    else if (r > b) lo = m + 1;
    else return (r - a) % table[m * 3 + 2]! === 0;
  }
  return false;
}

const RUNE_ERROR = 0xfffd;

/** Go `utf8.DecodeRune`: the rune and its size; an invalid byte is `[RUNE_ERROR, 1]`. */
function decodeRune(b: Uint8Array, i: number, end: number): [number, number] {
  const c0 = b[i]!;
  if (c0 < 0x80) return [c0, 1];
  const cont = (k: number) => i + k < end && (b[i + k]! & 0xc0) === 0x80;
  if (c0 >= 0xc2 && c0 <= 0xdf) return cont(1) ? [((c0 & 0x1f) << 6) | (b[i + 1]! & 0x3f), 2] : [RUNE_ERROR, 1];
  if (c0 >= 0xe0 && c0 <= 0xef) {
    if (!cont(1) || !cont(2)) return [RUNE_ERROR, 1];
    const c1 = b[i + 1]!;
    if ((c0 === 0xe0 && c1 < 0xa0) || (c0 === 0xed && c1 > 0x9f)) return [RUNE_ERROR, 1];
    return [((c0 & 0x0f) << 12) | ((c1 & 0x3f) << 6) | (b[i + 2]! & 0x3f), 3];
  }
  if (c0 >= 0xf0 && c0 <= 0xf4) {
    if (!cont(1) || !cont(2) || !cont(3)) return [RUNE_ERROR, 1];
    const c1 = b[i + 1]!;
    if ((c0 === 0xf0 && c1 < 0x90) || (c0 === 0xf4 && c1 > 0x8f)) return [RUNE_ERROR, 1];
    return [((c0 & 0x07) << 18) | ((c1 & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f), 4];
  }
  return [RUNE_ERROR, 1];
}

/** Go `isName`. */
function isName(b: Uint8Array, start: number, end: number): boolean {
  if (start >= end) return false;
  let i = start;
  let firstRune = true;
  while (i < end) {
    const [c, n] = decodeRune(b, i, end);
    if (c === RUNE_ERROR && n === 1) return false;
    if (firstRune ? !inTable(FIRST, c) : !inTable(FIRST, c) && !inTable(SECOND, c)) return false;
    firstRune = false;
    i += n;
  }
  return true;
}

/** Go `isNameByte`. */
function isNameByte(c: number): boolean {
  return (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c === 0x5f || c === 0x3a || c === 0x2e || c === 0x2d;
}

/** Go `isInCharacterRange`. */
function isInCharacterRange(r: number): boolean {
  return r === 0x09 || r === 0x0a || r === 0x0d || (r >= 0x20 && r <= 0xd7ff) || (r >= 0xe000 && r <= 0xfffd) || (r >= 0x10000 && r <= 0x10ffff);
}

/** Go `fmt.Sprintf("%U", r)`. */
function formatU(r: number): string {
  return `U+${r.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** UTF-8 bytes of Go `string(rune(n))` (a surrogate becomes U+FFFD). */
function runeBytes(n: number): number[] {
  if (n >= 0xd800 && n <= 0xdfff) n = RUNE_ERROR;
  if (n < 0x80) return [n];
  if (n < 0x800) return [0xc0 | (n >> 6), 0x80 | (n & 0x3f)];
  if (n < 0x10000) return [0xe0 | (n >> 12), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)];
  return [0xf0 | (n >> 18), 0x80 | ((n >> 12) & 0x3f), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)];
}

/** `ignoreBOM`: a U+FEFF in a token is text, as in Go; the decoder never drops it. */
const utf8 = new TextDecoder("utf-8", { ignoreBOM: true });
const PREDEFINED: Record<string, number> = { lt: 0x3c, gt: 0x3e, amp: 0x26, apos: 0x27, quot: 0x22 };

/** A growable byte buffer, Go's `bytes.Buffer` as the decoder uses it. */
class ByteBuf {
  bytes = new Uint8Array(256);
  len = 0;
  reset(): void {
    this.len = 0;
  }
  push(b: number): void {
    if (this.len === this.bytes.length) {
      const next = new Uint8Array(this.bytes.length * 2);
      next.set(this.bytes);
      this.bytes = next;
    }
    this.bytes[this.len++] = b;
  }
  text(start = 0, end = this.len): string {
    return utf8.decode(this.bytes.subarray(start, end));
  }
}

interface Name {
  space: string;
  local: string;
}

type Token =
  | { t: "start"; name: Name; attrs: { name: Name; value: string }[] }
  | { t: "end"; name: Name }
  | { t: "chardata"; text: string }
  | { t: "other" };

/** Go `procInst(param, s)`. */
function procInst(param: string, s: string): string {
  param = `${param}=`;
  const lenp = param.length;
  let i = 0;
  let sep = "";
  while (i < s.length) {
    const sub = s.slice(i);
    const k = sub.indexOf(param);
    if (k < 0 || lenp + k >= sub.length) return "";
    i += lenp + k + 1;
    const c = sub[lenp + k]!;
    if (c === "'" || c === '"') {
      sep = c;
      break;
    }
  }
  if (sep === "") return "";
  const j = s.slice(i).indexOf(sep);
  if (j < 0) return "";
  return s.slice(i, i + j);
}

const XML_URL = "http://www.w3.org/XML/1998/namespace";

/** Go's strict `xml.Decoder` over one in-memory document. */
class Decoder {
  private readonly data: Uint8Array;
  private pos = 0;
  line = 1;
  private readonly buf = new ByteBuf();
  private needClose = false;
  private toClose: Name = { space: "", local: "" };
  private readonly ns = new Map<string, string>();
  /** Go's `stk`: element starts and the name space values they replaced. */
  private readonly stk: ({ kind: "start"; name: Name } | { kind: "ns"; local: string; url: string; ok: boolean })[] = [];
  depth = 0;

  /** Charged once per attribute as it is read, for the tree budget of a parsed part. */
  private readonly charge: (() => void) | undefined;

  constructor(data: Uint8Array, charge?: () => void) {
    this.data = data;
    this.charge = charge;
  }

  private fail(message: string): never {
    throw new GoError(`XML syntax error on line ${this.line}: ${message}`);
  }

  /** Go `getc`: the next byte, or -1 at EOF. */
  private getc(): number {
    if (this.pos >= this.data.length) return -1;
    const b = this.data[this.pos++]!;
    if (b === 0x0a) this.line++;
    return b;
  }

  /** Go `mustgetc`: EOF is `unexpected EOF`. */
  private mustgetc(): number {
    const b = this.getc();
    if (b < 0) this.fail("unexpected EOF");
    return b;
  }

  private ungetc(b: number): void {
    if (b === 0x0a) this.line--;
    this.pos--;
  }

  /** Go `space`. */
  private space(): void {
    for (;;) {
      const b = this.getc();
      if (b < 0) return;
      if (b !== 0x20 && b !== 0x0d && b !== 0x0a && b !== 0x09) {
        this.ungetc(b);
        return;
      }
    }
  }

  /** Go `readName`: appends a name's bytes to the buffer; false when the next byte cannot start one. */
  private readName(): boolean {
    let b = this.mustgetc();
    if (b < 0x80 && !isNameByte(b)) {
      this.ungetc(b);
      return false;
    }
    this.buf.push(b);
    for (;;) {
      b = this.mustgetc();
      if (b < 0x80 && !isNameByte(b)) {
        this.ungetc(b);
        break;
      }
      this.buf.push(b);
    }
    return true;
  }

  /** Go `name`: undefined when no name is there (no error set). */
  private name(): string | undefined {
    this.buf.reset();
    if (!this.readName()) return undefined;
    if (!isName(this.buf.bytes, 0, this.buf.len)) this.fail(`invalid XML name: ${this.buf.text()}`);
    return this.buf.text();
  }

  /** Go `nsname`: undefined when no name is there or it has more than one colon. */
  private nsname(): Name | undefined {
    const s = this.name();
    if (s === undefined) return undefined;
    const colons = s.split(":").length - 1;
    if (colons > 1) return undefined;
    const i = s.indexOf(":");
    if (i < 0 || i === 0 || i === s.length - 1) return { space: "", local: s };
    return { space: s.slice(0, i), local: s.slice(i + 1) };
  }

  /** Go `text(quote, cdata)`. */
  private text(quote: number, cdata: boolean, limit?: number): string {
    let b0 = 0;
    let b1 = 0;
    let trunc = 0;
    const buf = this.buf;
    buf.reset();
    for (;;) {
      if (limit !== undefined && buf.len > limit) {
        throw new IntakeLimitError("xml", `the attribute size of an element on line ${this.line}`, `${INTAKE_LIMITS.xmlMaxAttributeBytes / (1024 * 1024)} MiB per element`);
      }
      let b = this.getc();
      if (b < 0) {
        if (cdata) this.fail("unexpected EOF in CDATA section");
        break;
      }
      if (quote < 0 && b0 === 0x5d && b1 === 0x5d && b === 0x3e) {
        if (cdata) {
          trunc = 2;
          break;
        }
        this.fail("unescaped ]]> not in CDATA section");
      }
      if (b === 0x3c && !cdata) {
        if (quote >= 0) this.fail("unescaped < inside quoted string");
        this.ungetc(0x3c);
        break;
      }
      if (quote >= 0 && b === quote) break;
      if (b === 0x26 && !cdata) {
        const before = buf.len;
        buf.push(0x26);
        let text: number[] | undefined;
        b = this.mustgetc();
        if (b === 0x23) {
          buf.push(b);
          b = this.mustgetc();
          let base = 10;
          if (b === 0x78) {
            base = 16;
            buf.push(b);
            b = this.mustgetc();
          }
          const start = buf.len;
          while ((b >= 0x30 && b <= 0x39) || (base === 16 && ((b >= 0x61 && b <= 0x66) || (b >= 0x41 && b <= 0x46)))) {
            buf.push(b);
            b = this.mustgetc();
          }
          if (b !== 0x3b) {
            this.ungetc(b);
          } else {
            const digits = buf.text(start);
            buf.push(0x3b);
            // Go strconv.ParseUint(s, base, 64): an empty or too long number fails.
            if (digits !== "") {
              const n = BigInt(base === 16 ? `0x${digits}` : digits);
              if (n <= 0x10ffffn) text = runeBytes(Number(n));
            }
          }
        } else {
          this.ungetc(b);
          this.readName();
          b = this.mustgetc();
          if (b !== 0x3b) {
            this.ungetc(b);
          } else {
            const nameStart = before + 1;
            const nameEnd = buf.len;
            buf.push(0x3b);
            if (isName(buf.bytes, nameStart, nameEnd)) {
              const r = PREDEFINED[buf.text(nameStart, nameEnd)];
              if (r !== undefined) text = [r];
            }
          }
        }
        if (text !== undefined) {
          buf.len = before;
          for (const c of text) buf.push(c);
          b0 = 0;
          b1 = 0;
          continue;
        }
        let ent = buf.text(before);
        if (!ent.endsWith(";")) ent += " (no semicolon)";
        this.fail(`invalid character entity ${ent}`);
      }
      if (b === 0x0d) buf.push(0x0a);
      else if (b1 === 0x0d && b === 0x0a) {
        // Skip \r\n: \n is already written.
      } else buf.push(b);
      b0 = b1;
      b1 = b;
    }
    const end = buf.len - trunc;
    for (let i = 0; i < end; ) {
      const [r, size] = decodeRune(buf.bytes, i, end);
      if (r === RUNE_ERROR && size === 1) this.fail("invalid UTF-8");
      if (!isInCharacterRange(r)) this.fail(`illegal character code ${formatU(r)}`);
      i += size;
    }
    return buf.text(0, end);
  }

  /** Go `attrval`. */
  /** Go `attrval`. `limit`: the attribute bytes the element has left. */
  private attrval(limit: number): string {
    const b = this.mustgetc();
    if (b === 0x22 || b === 0x27) return this.text(b, false, limit);
    this.fail("unquoted or missing attribute value in element");
  }

  /** Go `rawToken`: undefined at EOF. */
  private rawToken(): Token | undefined {
    if (this.needClose) {
      this.needClose = false;
      return { t: "end", name: { ...this.toClose } };
    }
    let b = this.getc();
    if (b < 0) return undefined;
    if (b !== 0x3c) {
      this.ungetc(b);
      return { t: "chardata", text: this.text(-1, false) };
    }
    b = this.mustgetc();
    switch (b) {
      case 0x2f: {
        const name = this.nsname();
        if (name === undefined) this.fail("expected element name after </");
        this.space();
        b = this.mustgetc();
        if (b !== 0x3e) this.fail(`invalid characters between </${name.local} and >`);
        return { t: "end", name };
      }
      case 0x3f: {
        const target = this.name();
        if (target === undefined) this.fail("expected target name after <?");
        this.space();
        const start = this.pos;
        let prev = 0;
        for (;;) {
          b = this.mustgetc();
          if (prev === 0x3f && b === 0x3e) break;
          prev = b;
        }
        if (target === "xml") {
          const content = utf8.decode(this.data.subarray(start, this.pos - 2));
          const ver = procInst("version", content);
          if (ver !== "" && ver !== "1.0") throw new GoError(`xml: unsupported version ${goQuote(ver)}; only version 1.0 is supported`);
          const enc = procInst("encoding", content);
          if (enc !== "" && !/^utf-8$/i.test(enc)) {
            throw new GoError(`xml: encoding ${goQuote(enc)} declared but Decoder.CharsetReader is nil`);
          }
        }
        return { t: "other" };
      }
      case 0x21: {
        b = this.mustgetc();
        if (b === 0x2d) {
          b = this.mustgetc();
          if (b !== 0x2d) this.fail("invalid sequence <!- not part of <!--");
          let c0 = 0;
          let c1 = 0;
          for (;;) {
            b = this.mustgetc();
            if (c0 === 0x2d && c1 === 0x2d) {
              if (b !== 0x3e) this.fail('invalid sequence "--" not allowed in comments');
              break;
            }
            c0 = c1;
            c1 = b;
          }
          return { t: "other" };
        }
        if (b === 0x5b) {
          for (const c of [0x43, 0x44, 0x41, 0x54, 0x41, 0x5b]) {
            b = this.mustgetc();
            if (b !== c) this.fail("invalid <![ sequence");
          }
          return { t: "chardata", text: this.text(-1, true) };
        }
        // A directive such as <!DOCTYPE ...>: skipped, as Go returns it
        // unread. No entity it declares is expanded.
        let inquote = 0;
        let depth = 0;
        for (;;) {
          b = this.mustgetc();
          if (inquote === 0 && b === 0x3e && depth === 0) break;
          for (;;) {
            if (b === inquote) inquote = 0;
            else if (inquote !== 0) {
              // In quotes: nothing special.
            } else if (b === 0x27 || b === 0x22) inquote = b;
            else if (b === 0x3e) depth--;
            else if (b === 0x3c) {
              let matched = true;
              for (const c of [0x21, 0x2d, 0x2d]) {
                b = this.mustgetc();
                if (b !== c) {
                  matched = false;
                  break;
                }
              }
              if (!matched) {
                depth++;
                continue; // Go's `goto HandleB` with the byte that broke the match.
              }
              let c0 = 0;
              let c1 = 0;
              for (;;) {
                b = this.mustgetc();
                if (c0 === 0x2d && c1 === 0x2d && b === 0x3e) break;
                c0 = c1;
                c1 = b;
              }
            }
            break;
          }
        }
        return { t: "other" };
      }
    }
    this.ungetc(b);
    const name = this.nsname();
    if (name === undefined) this.fail("expected element name after <");
    const attrs: { name: Name; value: string }[] = [];
    // Attributes are charged as they are read: their count, their bytes
    // (names and values), and the tree budget of a parsed part. So one
    // element with a flood of attributes stops before it is built.
    let attrBytes = 0;
    let empty = false;
    for (;;) {
      this.space();
      b = this.mustgetc();
      if (b === 0x2f) {
        empty = true;
        b = this.mustgetc();
        if (b !== 0x3e) this.fail("expected /> in element");
        break;
      }
      if (b === 0x3e) break;
      this.ungetc(b);
      const attrName = this.nsname();
      if (attrName === undefined) this.fail("expected attribute name in element");
      this.space();
      b = this.mustgetc();
      if (b !== 0x3d) this.fail("attribute name without = in element");
      this.space();
      attrBytes += attrName.space.length + attrName.local.length;
      const value = this.attrval(INTAKE_LIMITS.xmlMaxAttributeBytes - attrBytes);
      attrBytes += this.buf.len;
      attrs.push({ name: attrName, value });
      if (attrs.length > INTAKE_LIMITS.xmlMaxAttributes) {
        throw new IntakeLimitError("xml", `the attribute count of an element on line ${this.line}`, `${INTAKE_LIMITS.xmlMaxAttributes} attributes`);
      }
      this.charge?.();
    }
    if (empty) {
      this.needClose = true;
      this.toClose = { ...name };
    }
    return { t: "start", name, attrs };
  }

  /** Go `translate`. */
  private translate(n: Name, isElementName: boolean): void {
    if (n.space === "xmlns") return;
    if (n.space === "" && !isElementName) return;
    if (n.space === "xml") n.space = XML_URL;
    else if (n.space === "" && n.local === "xmlns") return;
    const v = this.ns.get(n.space);
    if (v !== undefined) n.space = v;
  }

  /** Go `Token`: undefined at EOF with every element closed. */
  token(): Token | undefined {
    const t = this.rawToken();
    if (t === undefined) {
      if (this.depth > 0) this.fail("unexpected EOF");
      return undefined;
    }
    if (t.t === "start") {
      for (const a of t.attrs) {
        if (a.name.space === "xmlns") {
          this.stk.push({ kind: "ns", local: a.name.local, url: this.ns.get(a.name.local) ?? "", ok: this.ns.has(a.name.local) });
          this.ns.set(a.name.local, a.value);
        }
        if (a.name.space === "" && a.name.local === "xmlns") {
          this.stk.push({ kind: "ns", local: "", url: this.ns.get("") ?? "", ok: this.ns.has("") });
          this.ns.set("", a.value);
        }
      }
      this.stk.push({ kind: "start", name: { ...t.name } });
      this.depth++;
      if (this.depth > INTAKE_LIMITS.xmlMaxDepth) throw new IntakeLimitError("xml", `element nesting on line ${this.line}`, `${INTAKE_LIMITS.xmlMaxDepth} levels`);
      this.translate(t.name, true);
      for (const a of t.attrs) this.translate(a.name, false);
      return t;
    }
    if (t.t === "end") {
      const s = this.stk.pop();
      const name = t.name;
      if (s === undefined || s.kind !== "start") this.fail(`unexpected end element </${name.local}>`);
      if (s.name.local !== name.local) this.fail(`element <${s.name.local}> closed by </${name.local}>`);
      if (s.name.space !== name.space) {
        this.fail(`element <${s.name.local}> in space ${s.name.space} closed by </${name.local}> in space ${name.space === "" ? '""' : name.space}`);
      }
      this.depth--;
      this.translate(t.name, true);
      for (let top = this.stk[this.stk.length - 1]; top !== undefined && top.kind === "ns"; top = this.stk[this.stk.length - 1]) {
        this.stk.pop();
        if (top.ok) this.ns.set(top.local, top.url);
        else this.ns.delete(top.local);
      }
    }
    return t;
  }
}

/** A token of the stream: an element start (names translated) or end, or character data (CDATA included). */
export type XmlToken =
  | { t: "start"; local: string; space: string; attrs: XmlAttr[] }
  | { t: "end"; local: string; space: string }
  | { t: "text"; text: string };

/**
 * Go's token stream, as the Go intake tool reads it.
 *
 * - `unmarshal` is Go's `xml.Unmarshal`: tokens before the first start
 *   element are read and dropped (EOF before one is the error `EOF`), and
 *   the stream ends at that element's end tag. Anything after it is never
 *   read.
 * - `stream` is a `Decoder.Token` loop to EOF: every token is read and
 *   checked, also after the first root element.
 *
 * Comments, processing instructions, and directives are read and dropped.
 * Throws a `GoError` with Go's text, or an `IntakeLimitError`.
 */
export function* goXmlTokens(data: Uint8Array, mode: "unmarshal" | "stream", charge?: () => void): Generator<XmlToken> {
  const d = new Decoder(data, charge);
  let started = false;
  for (;;) {
    const t = d.token();
    if (t === undefined) {
      if (mode === "unmarshal") throw new GoError("EOF");
      return;
    }
    if (t.t === "other") continue;
    if (mode === "unmarshal" && !started && t.t !== "start") continue;
    if (t.t === "chardata") {
      yield { t: "text", text: t.text };
    } else if (t.t === "start") {
      started = true;
      yield { t: "start", local: t.name.local, space: t.name.space, attrs: t.attrs.map((a) => ({ local: a.name.local, space: a.name.space, value: a.value })) };
    } else {
      yield { t: "end", local: t.name.local, space: t.name.space };
      if (mode === "unmarshal" && d.depth === 0) return;
    }
  }
}

/**
 * Parses XML into an element tree, from `goXmlTokens`. In `unmarshal` mode
 * the result is the root element; in `stream` mode it is an element with an
 * empty name that holds every top-level element and text run, in order.
 * The tree is bounded by `INTAKE_LIMITS.xmlMaxNodes`; large parts (a DOCX
 * body, a worksheet, shared strings) are read from the token stream
 * instead, so they never build a tree.
 */
export function goXmlParse(data: Uint8Array, mode: "unmarshal" | "stream"): XmlElement {
  const top: XmlElement = { kind: "element", local: "", space: "", attrs: [], children: [] };
  const open: XmlElement[] = [top];
  let nodes = 0;
  const charge = (): void => {
    if (++nodes > INTAKE_LIMITS.xmlMaxNodes) throw new IntakeLimitError("xml", "the node count of a parsed part", `${INTAKE_LIMITS.xmlMaxNodes} nodes`);
  };
  // Attributes are charged by the decoder as it reads them; each element,
  // text run, and end tag here.
  for (const t of goXmlTokens(data, mode, charge)) {
    charge();
    const parent = open[open.length - 1]!;
    if (t.t === "text") {
      parent.children.push({ kind: "text", text: t.text } satisfies XmlNode);
    } else if (t.t === "start") {
      const el: XmlElement = { kind: "element", local: t.local, space: t.space, attrs: t.attrs, children: [] };
      parent.children.push(el);
      open.push(el);
    } else {
      open.pop();
    }
  }
  return mode === "unmarshal" ? (top.children[0] as XmlElement) : top;
}
