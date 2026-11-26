/**
 * The parts of Go 1.24.1 `encoding/json` that the entity port needs, so
 * error text, decoded values, and written bytes match the Go seed byte for
 * byte (PRD 20 Compatibility). It reads no disk and writes nothing.
 *
 * - `GoScanner` is a port of the byte state machine in `scanner.go`, with
 *   Go's syntax error text (`invalid character 'n' looking for beginning of
 *   object key string`, `unexpected end of JSON input`).
 * - `goUnmarshal` and `goDecodeFirst` follow `json.Unmarshal` and
 *   `json.Decoder.Decode` (with `DisallowUnknownFields`) for the Go types the
 *   entity seed decodes: strings, `int`, slices, string-keyed maps,
 *   `json.RawMessage`, and structs. Type errors keep Go's text, the first one
 *   wins, and decoding goes on after it, as in Go.
 * - `goEncodeString`, `goCompact`, and `goMarshalIndent` follow the encoder:
 *   HTML escaping when asked, ` ` and ` ` always, `�` for
 *   invalid UTF-8.
 *
 * Go works on bytes, so the input is a `Uint8Array` and a `json.RawMessage`
 * is a byte slice of it, kept as Go keeps it. Decoded strings follow Go's
 * `unquote`: invalid UTF-8 and bad surrogates become U+FFFD.
 *
 * Ported from Go 1.24.1 `src/encoding/json` (`scanner.go`, `decode.go`,
 * `encode.go`, `indent.go`, `fold.go`) and `src/unicode/utf8`, Copyright
 * The Go Authors, BSD-3-Clause; see THIRD_PARTY_NOTICES.md.
 */

import { GO_FOLD_TABLE } from "./go-fold.ts";
import { goQuote } from "./go-quote.ts";

// ---------------------------------------------------------------- Scanner

/** Go's scanner op codes. */
const Op = {
  Continue: 0,
  BeginLiteral: 1,
  BeginObject: 2,
  ObjectKey: 3,
  ObjectValue: 4,
  EndObject: 5,
  BeginArray: 6,
  ArrayValue: 7,
  EndArray: 8,
  SkipSpace: 9,
  End: 10,
  Error: 11,
} as const;
type Op = (typeof Op)[keyof typeof Op];

/** Go's parse states. */
const Parse = { ObjectKey: 0, ObjectValue: 1, ArrayValue: 2 } as const;
type Parse = (typeof Parse)[keyof typeof Parse];

const MAX_NESTING_DEPTH = 10000;

type Step = (s: GoScanner, c: number) => Op;

const isSpace = (c: number) => c === 0x20 || c === 0x09 || c === 0x0d || c === 0x0a;
const isDigit = (c: number) => c >= 0x30 && c <= 0x39;
const isHex = (c: number) => isDigit(c) || (c >= 0x61 && c <= 0x66) || (c >= 0x41 && c <= 0x46);

/** Go's `quoteChar`: a byte for a syntax error message. */
function quoteChar(c: number): string {
  if (c === 0x27) return "'\\''";
  if (c === 0x22) return "'\"'";
  // Go: strconv.Quote(string(c)), where string(byte) is the rune U+00XX.
  const quoted = goQuote(String.fromCodePoint(c));
  return `'${quoted.slice(1, -1)}'`;
}

/** A port of Go's `scanner`. */
export class GoScanner {
  step: Step = stateBeginValue;
  parseState: Parse[] = [];
  endTop = false;
  err: string | undefined;

  reset(): void {
    this.step = stateBeginValue;
    this.parseState = [];
    this.err = undefined;
    this.endTop = false;
  }

  /** Go `eof`: the op after the last byte, with the end-of-input error. */
  eof(): Op {
    if (this.err !== undefined) return Op.Error;
    if (this.endTop) return Op.End;
    this.step(this, 0x20);
    if (this.endTop) return Op.End;
    this.err ??= "unexpected end of JSON input";
    return Op.Error;
  }

  pushParseState(c: number, state: Parse, success: Op): Op {
    this.parseState.push(state);
    if (this.parseState.length <= MAX_NESTING_DEPTH) return success;
    return this.error(c, "exceeded max depth");
  }

  popParseState(): void {
    this.parseState.pop();
    if (this.parseState.length === 0) {
      this.step = stateEndTop;
      this.endTop = true;
    } else {
      this.step = stateEndValue;
    }
  }

  error(c: number, context: string): Op {
    this.step = stateError;
    this.err = `invalid character ${quoteChar(c)} ${context}`;
    return Op.Error;
  }
}

function stateBeginValueOrEmpty(s: GoScanner, c: number): Op {
  if (isSpace(c)) return Op.SkipSpace;
  if (c === 0x5d) return stateEndValue(s, c);
  return stateBeginValue(s, c);
}

function stateBeginValue(s: GoScanner, c: number): Op {
  if (isSpace(c)) return Op.SkipSpace;
  switch (c) {
    case 0x7b:
      s.step = stateBeginStringOrEmpty;
      return s.pushParseState(c, Parse.ObjectKey, Op.BeginObject);
    case 0x5b:
      s.step = stateBeginValueOrEmpty;
      return s.pushParseState(c, Parse.ArrayValue, Op.BeginArray);
    case 0x22:
      s.step = stateInString;
      return Op.BeginLiteral;
    case 0x2d:
      s.step = stateNeg;
      return Op.BeginLiteral;
    case 0x30:
      s.step = state0;
      return Op.BeginLiteral;
    case 0x74:
      s.step = literal("rue", "true");
      return Op.BeginLiteral;
    case 0x66:
      s.step = literal("alse", "false");
      return Op.BeginLiteral;
    case 0x6e:
      s.step = literal("ull", "null");
      return Op.BeginLiteral;
  }
  if (c >= 0x31 && c <= 0x39) {
    s.step = state1;
    return Op.BeginLiteral;
  }
  return s.error(c, "looking for beginning of value");
}

function stateBeginStringOrEmpty(s: GoScanner, c: number): Op {
  if (isSpace(c)) return Op.SkipSpace;
  if (c === 0x7d) {
    s.parseState[s.parseState.length - 1] = Parse.ObjectValue;
    return stateEndValue(s, c);
  }
  return stateBeginString(s, c);
}

function stateBeginString(s: GoScanner, c: number): Op {
  if (isSpace(c)) return Op.SkipSpace;
  if (c === 0x22) {
    s.step = stateInString;
    return Op.BeginLiteral;
  }
  return s.error(c, "looking for beginning of object key string");
}

function stateEndValue(s: GoScanner, c: number): Op {
  const n = s.parseState.length;
  if (n === 0) {
    s.step = stateEndTop;
    s.endTop = true;
    return stateEndTop(s, c);
  }
  if (isSpace(c)) {
    s.step = stateEndValue;
    return Op.SkipSpace;
  }
  switch (s.parseState[n - 1]) {
    case Parse.ObjectKey:
      if (c === 0x3a) {
        s.parseState[n - 1] = Parse.ObjectValue;
        s.step = stateBeginValue;
        return Op.ObjectKey;
      }
      return s.error(c, "after object key");
    case Parse.ObjectValue:
      if (c === 0x2c) {
        s.parseState[n - 1] = Parse.ObjectKey;
        s.step = stateBeginString;
        return Op.ObjectValue;
      }
      if (c === 0x7d) {
        s.popParseState();
        return Op.EndObject;
      }
      return s.error(c, "after object key:value pair");
    case Parse.ArrayValue:
      if (c === 0x2c) {
        s.step = stateBeginValue;
        return Op.ArrayValue;
      }
      if (c === 0x5d) {
        s.popParseState();
        return Op.EndArray;
      }
      return s.error(c, "after array element");
  }
  return s.error(c, "");
}

function stateEndTop(s: GoScanner, c: number): Op {
  if (!isSpace(c)) s.error(c, "after top-level value");
  return Op.End;
}

function stateInString(s: GoScanner, c: number): Op {
  if (c === 0x22) {
    s.step = stateEndValue;
    return Op.Continue;
  }
  if (c === 0x5c) {
    s.step = stateInStringEsc;
    return Op.Continue;
  }
  if (c < 0x20) return s.error(c, "in string literal");
  return Op.Continue;
}

function stateInStringEsc(s: GoScanner, c: number): Op {
  switch (c) {
    case 0x62: // b
    case 0x66: // f
    case 0x6e: // n
    case 0x72: // r
    case 0x74: // t
    case 0x5c: // \
    case 0x2f: // /
    case 0x22: // "
      s.step = stateInString;
      return Op.Continue;
    case 0x75: // u
      s.step = hexState(3);
      return Op.Continue;
  }
  return s.error(c, "in string escape code");
}

/** One of the four `\u` hex states; `left` hex digits follow this one. */
function hexState(left: number): Step {
  return (s, c) => {
    if (isHex(c)) {
      s.step = left === 0 ? stateInString : hexState(left - 1);
      return Op.Continue;
    }
    return s.error(c, "in \\u hexadecimal character escape");
  };
}

function stateNeg(s: GoScanner, c: number): Op {
  if (c === 0x30) {
    s.step = state0;
    return Op.Continue;
  }
  if (c >= 0x31 && c <= 0x39) {
    s.step = state1;
    return Op.Continue;
  }
  return s.error(c, "in numeric literal");
}

function state1(s: GoScanner, c: number): Op {
  if (isDigit(c)) {
    s.step = state1;
    return Op.Continue;
  }
  return state0(s, c);
}

function state0(s: GoScanner, c: number): Op {
  if (c === 0x2e) {
    s.step = stateDot;
    return Op.Continue;
  }
  if (c === 0x65 || c === 0x45) {
    s.step = stateE;
    return Op.Continue;
  }
  return stateEndValue(s, c);
}

function stateDot(s: GoScanner, c: number): Op {
  if (isDigit(c)) {
    s.step = stateDot0;
    return Op.Continue;
  }
  return s.error(c, "after decimal point in numeric literal");
}

function stateDot0(s: GoScanner, c: number): Op {
  if (isDigit(c)) return Op.Continue;
  if (c === 0x65 || c === 0x45) {
    s.step = stateE;
    return Op.Continue;
  }
  return stateEndValue(s, c);
}

function stateE(s: GoScanner, c: number): Op {
  if (c === 0x2b || c === 0x2d) {
    s.step = stateESign;
    return Op.Continue;
  }
  return stateESign(s, c);
}

function stateESign(s: GoScanner, c: number): Op {
  if (isDigit(c)) {
    s.step = stateE0;
    return Op.Continue;
  }
  return s.error(c, "in exponent of numeric literal");
}

function stateE0(s: GoScanner, c: number): Op {
  if (isDigit(c)) return Op.Continue;
  return stateEndValue(s, c);
}

/** The states after the first letter of `true`, `false`, or `null`. */
function literal(rest: string, word: string): Step {
  return (s, c) => {
    const want = rest.charCodeAt(0);
    if (c === want) {
      s.step = rest.length === 1 ? stateEndValue : literal(rest.slice(1), word);
      return Op.Continue;
    }
    return s.error(c, `in literal ${word} (expecting '${rest[0]}')`);
  };
}

function stateError(): Op {
  return Op.Error;
}

/** Go `checkValid`: the syntax error text for the whole input, or undefined. */
export function goCheckValid(data: Uint8Array): string | undefined {
  const scan = new GoScanner();
  for (const c of data) {
    if (scan.step(scan, c) === Op.Error) return scan.err;
  }
  if (scan.eof() === Op.Error) return scan.err;
  return undefined;
}

/** What `json.Decoder` reads for its next value. */
export type DecoderRead = { kind: "eof" } | { kind: "error"; message: string } | { kind: "value"; start: number; end: number };

/**
 * Go `Decoder.readValue` from `offset`: the next value, `EOF` when only
 * white space is left, or the error (`unexpected EOF` for a value cut short).
 */
export function goDecoderRead(data: Uint8Array, offset: number): DecoderRead {
  const scan = new GoScanner();
  let i = offset;
  for (; i < data.length; i++) {
    const c = data[i]!;
    const op = scan.step(scan, c);
    if (op === Op.End) return { kind: "value", start: offset, end: i };
    if ((op === Op.EndObject || op === Op.EndArray) && scan.step(scan, 0x20) === Op.End) return { kind: "value", start: offset, end: i + 1 };
    if (op === Op.Error) return { kind: "error", message: scan.err ?? "" };
  }
  if (scan.step(scan, 0x20) === Op.End) return { kind: "value", start: offset, end: i };
  for (let j = offset; j < data.length; j++) if (!isSpace(data[j]!)) return { kind: "error", message: "unexpected EOF" };
  return { kind: "eof" };
}

// ---------------------------------------------------------------- Tree

/** One parsed value of valid JSON, with its byte span. */
export type JsonNode =
  | { kind: "object"; start: number; end: number; entries: { key: string; value: JsonNode }[] }
  | { kind: "array"; start: number; end: number; items: JsonNode[] }
  | { kind: "string" | "number" | "true" | "false" | "null"; start: number; end: number };

/**
 * Parses one value of input that `goCheckValid` already accepted. It keeps
 * its own stack, not the call stack, so any depth the scanner accepts (Go's
 * limit is 10000 levels) parses.
 */
export function parseTree(data: Uint8Array, start = 0, end = data.length): JsonNode {
  let i = start;
  const skip = () => {
    while (i < end && isSpace(data[i]!)) i++;
  };
  const stringEnd = (from: number) => {
    let j = from + 1;
    while (data[j] !== 0x22) j += data[j] === 0x5c ? 2 : 1;
    return j + 1;
  };
  type Open =
    | { kind: "object"; node: Extract<JsonNode, { kind: "object" }>; key: string }
    | { kind: "array"; node: Extract<JsonNode, { kind: "array" }> };
  const stack: Open[] = [];
  /** Reads an object key and its colon into the open object on top. */
  const readKey = (top: Extract<Open, { kind: "object" }>) => {
    skip();
    const ks = i;
    i = stringEnd(i);
    top.key = goUnquote(data.subarray(ks, i));
    skip();
    i++; // :
  };
  for (;;) {
    // Read one value: a scalar is complete; an object or array opens.
    skip();
    const s = i;
    const c = data[i]!;
    let done: JsonNode | undefined;
    if (c === 0x7b) {
      i++;
      const node: Extract<JsonNode, { kind: "object" }> = { kind: "object", start: s, end: s, entries: [] };
      skip();
      if (data[i] === 0x7d) {
        i++;
        node.end = i;
        done = node;
      } else {
        const open: Extract<Open, { kind: "object" }> = { kind: "object", node, key: "" };
        stack.push(open);
        readKey(open);
        continue;
      }
    } else if (c === 0x5b) {
      i++;
      const node: Extract<JsonNode, { kind: "array" }> = { kind: "array", start: s, end: s, items: [] };
      skip();
      if (data[i] === 0x5d) {
        i++;
        node.end = i;
        done = node;
      } else {
        stack.push({ kind: "array", node });
        continue;
      }
    } else if (c === 0x22) {
      i = stringEnd(i);
      done = { kind: "string", start: s, end: i };
    } else if (c === 0x74) {
      i += 4;
      done = { kind: "true", start: s, end: i };
    } else if (c === 0x66) {
      i += 5;
      done = { kind: "false", start: s, end: i };
    } else if (c === 0x6e) {
      i += 4;
      done = { kind: "null", start: s, end: i };
    } else {
      i++;
      while (i < end && (isDigit(data[i]!) || data[i] === 0x2e || data[i] === 0x65 || data[i] === 0x45 || data[i] === 0x2b || data[i] === 0x2d)) i++;
      done = { kind: "number", start: s, end: i };
    }
    // Hand the finished value to its parent, closing each parent that ends.
    for (;;) {
      const top = stack[stack.length - 1];
      if (top === undefined) return done;
      if (top.kind === "object") top.node.entries.push({ key: top.key, value: done });
      else top.node.items.push(done);
      skip();
      const next = data[i++];
      if (next === 0x2c) {
        if (top.kind === "object") readKey(top);
        break;
      }
      // `}` or `]`: the parent is complete.
      stack.pop();
      top.node.end = i;
      done = top.node;
    }
  }
}

// ---------------------------------------------------------------- UTF-8 and strings

/** Go `utf8.DecodeRune`: the rune and its size; an invalid byte is U+FFFD of size 1. */
export function goDecodeRune(b: Uint8Array, i: number): [number, number] {
  const b0 = b[i]!;
  if (b0 < 0x80) return [b0, 1];
  const cont = (k: number, lo = 0x80, hi = 0xbf) => {
    const x = b[i + k];
    return x !== undefined && x >= lo && x <= hi;
  };
  if (b0 >= 0xc2 && b0 < 0xe0) {
    if (cont(1)) return [((b0 & 0x1f) << 6) | (b[i + 1]! & 0x3f), 2];
  } else if (b0 >= 0xe0 && b0 < 0xf0) {
    const lo = b0 === 0xe0 ? 0xa0 : 0x80;
    const hi = b0 === 0xed ? 0x9f : 0xbf;
    if (cont(1, lo, hi) && cont(2)) return [((b0 & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f), 3];
  } else if (b0 >= 0xf0 && b0 < 0xf5) {
    const lo = b0 === 0xf0 ? 0x90 : 0x80;
    const hi = b0 === 0xf4 ? 0x8f : 0xbf;
    if (cont(1, lo, hi) && cont(2) && cont(3)) {
      return [((b0 & 0x07) << 18) | ((b[i + 1]! & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f), 4];
    }
  }
  return [0xfffd, 1];
}

/** Bytes as a Go string read as runes: each invalid byte becomes U+FFFD. */
export function goDecodeUtf8(b: Uint8Array): string {
  let out = "";
  for (let i = 0; i < b.length; ) {
    const [r, size] = goDecodeRune(b, i);
    out += String.fromCodePoint(r);
    i += size;
  }
  return out;
}

const encoder = new TextEncoder();

/** UTF-8 bytes of a string. */
export function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

function getu4(b: Uint8Array, i: number): number {
  if (b[i] !== 0x5c || b[i + 1] !== 0x75) return -1;
  let r = 0;
  for (let k = 2; k < 6; k++) {
    const c = b[i + k];
    if (c === undefined || !isHex(c)) return -1;
    r = r * 16 + parseInt(String.fromCharCode(c), 16);
  }
  return r;
}

/** Go `unquote` of a valid JSON string literal (quotes included). */
export function goUnquote(literal: Uint8Array): string {
  const b = literal.subarray(1, literal.length - 1);
  let out = "";
  let i = 0;
  while (i < b.length) {
    const c = b[i]!;
    if (c === 0x5c) {
      const e = b[i + 1]!;
      switch (e) {
        case 0x22:
        case 0x5c:
        case 0x2f:
        case 0x27:
          out += String.fromCharCode(e);
          i += 2;
          continue;
        case 0x62:
          out += "\b";
          i += 2;
          continue;
        case 0x66:
          out += "\f";
          i += 2;
          continue;
        case 0x6e:
          out += "\n";
          i += 2;
          continue;
        case 0x72:
          out += "\r";
          i += 2;
          continue;
        case 0x74:
          out += "\t";
          i += 2;
          continue;
        case 0x75: {
          let rr = getu4(b, i);
          i += 6;
          if (rr >= 0xd800 && rr < 0xe000) {
            const rr1 = getu4(b, i);
            if (rr < 0xdc00 && rr1 >= 0xdc00 && rr1 < 0xe000) {
              out += String.fromCodePoint(((rr - 0xd800) << 10) + (rr1 - 0xdc00) + 0x10000);
              i += 6;
              continue;
            }
            rr = 0xfffd;
          }
          out += String.fromCodePoint(rr);
          continue;
        }
      }
    }
    const [r, size] = goDecodeRune(b, i);
    out += String.fromCodePoint(r);
    i += size;
  }
  return out;
}

const HEX = "0123456789abcdef";

/** Go `appendString` for a string value: JSON quoting with `escapeHTML` as asked. */
export function goEncodeString(text: string, escapeHTML: boolean): string {
  let out = '"';
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) {
      if (c === 0x5c || c === 0x22) out += `\\${ch}`;
      else if (c === 0x08) out += "\\b";
      else if (c === 0x0c) out += "\\f";
      else if (c === 0x0a) out += "\\n";
      else if (c === 0x0d) out += "\\r";
      else if (c === 0x09) out += "\\t";
      else if (c < 0x20 || (escapeHTML && (c === 0x3c || c === 0x3e || c === 0x26))) out += `\\u00${HEX[c >> 4]}${HEX[c & 0xf]}`;
      else out += ch;
    } else if (c === 0x2028 || c === 0x2029) {
      out += `\\u202${HEX[c & 0xf]}`;
    } else if (c >= 0xd800 && c <= 0xdfff) {
      // A lone surrogate is not valid UTF-8; Go writes the replacement escape.
      out += "\\ufffd";
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

/**
 * Go `appendCompact` of valid JSON bytes: drops insignificant white space,
 * and with `escape` writes `<`, `>`, `&`, U+2028, and U+2029 as `\u` escapes.
 */
export function goCompact(src: Uint8Array, escape: boolean): Uint8Array {
  const out: number[] = [];
  const scan = new GoScanner();
  let start = 0;
  const copy = (from: number, to: number) => {
    for (let k = from; k < to; k++) out.push(src[k]!);
  };
  const ascii = (text: string) => {
    for (let k = 0; k < text.length; k++) out.push(text.charCodeAt(k));
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (escape && (c === 0x3c || c === 0x3e || c === 0x26)) {
      if (start < i) copy(start, i);
      ascii(`\\u00${HEX[c >> 4]}${HEX[c & 0xf]}`);
      start = i + 1;
    }
    if (escape && c === 0xe2 && i + 2 < src.length && src[i + 1] === 0x80 && (src[i + 2]! & ~1) === 0xa8) {
      if (start < i) copy(start, i);
      ascii(`\\u202${HEX[src[i + 2]! & 0xf]}`);
      start = i + 3;
    }
    const op = scan.step(scan, c);
    if (op >= Op.SkipSpace) {
      if (op === Op.Error) break;
      if (start < i) copy(start, i);
      start = i + 1;
    }
  }
  if (start < src.length) copy(start, src.length);
  return Uint8Array.from(out);
}

/**
 * A JavaScript value to encode as Go would: strings, finite integers,
 * booleans, `null` (a Go nil slice, map, pointer, or interface), arrays,
 * plain objects, whose keys are written in insertion order (a Go struct in
 * field order), and `Map`s (a Go map), whose keys are written in Go's map
 * order: sorted by the bytes of their UTF-8 (`goCompare`). A Go map must be a
 * `Map`, never a plain object: JavaScript puts integer-like keys such as
 * `"2"` and `"10"` first, in numeric order, which is not Go's order.
 */
export type GoJsonValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | readonly GoJsonValue[]
  | ReadonlyMap<string, GoJsonValue>
  | { readonly [key: string]: GoJsonValue | undefined };

/** The entries Go writes for an object: a struct's fields in order, or a map's keys in Go's sorted order. */
function objectEntries(v: ReadonlyMap<string, GoJsonValue> | { readonly [key: string]: GoJsonValue | undefined }): [string, GoJsonValue][] {
  if (v instanceof Map) return [...(v as ReadonlyMap<string, GoJsonValue>).keys()].sort(goCompare).map((key) => [key, (v as ReadonlyMap<string, GoJsonValue>).get(key)!]);
  return Object.entries(v as Record<string, GoJsonValue | undefined>).filter((entry): entry is [string, GoJsonValue] => entry[1] !== undefined);
}

/** Go `json.MarshalIndent(v, "", "  ")` (escapeHTML on) or an indented Encoder. */
export function goMarshalIndent(value: GoJsonValue, escapeHTML: boolean, indent = "  "): string {
  const write = (v: GoJsonValue, depth: number): string => {
    if (v === null) return "null";
    if (typeof v === "string") return goEncodeString(v, escapeHTML);
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    const pad = `\n${indent.repeat(depth + 1)}`;
    const close = `\n${indent.repeat(depth)}`;
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return `[${v.map((item) => pad + write(item as GoJsonValue, depth + 1)).join(",")}${close}]`;
    }
    const entries = objectEntries(v as ReadonlyMap<string, GoJsonValue> | { readonly [key: string]: GoJsonValue | undefined });
    if (entries.length === 0) return "{}";
    return `{${entries.map(([key, item]) => `${pad}${goEncodeString(key, escapeHTML)}: ${write(item, depth + 1)}`).join(",")}${close}}`;
  };
  return write(value, 0);
}

/** Go `strings.Compare` / `sort.Strings` order: byte order of UTF-8, which is code point order. */
export function goCompare(a: string, b: string): number {
  if (a === b) return 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a.codePointAt(i)!;
    const y = b.codePointAt(i)!;
    if (x !== y) return x < y ? -1 : 1;
    if (x > 0xffff) i++;
  }
  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
}

const UNICODE_SPACE = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000]);

/** Go `unicode.IsSpace`. */
export function goIsSpace(r: number): boolean {
  return UNICODE_SPACE.has(r);
}

/** Go `strings.TrimSpace`. */
export function goTrimSpace(text: string): string {
  const chars = [...text];
  let a = 0;
  let b = chars.length;
  while (a < b && goIsSpace(chars[a]!.codePointAt(0)!)) a++;
  while (b > a && goIsSpace(chars[b - 1]!.codePointAt(0)!)) b--;
  return chars.slice(a, b).join("");
}

/** Go `len(bytes.TrimSpace(b)) == 0`. */
export function goIsBlank(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; ) {
    const [r, size] = goDecodeRune(b, i);
    if (!(goIsSpace(r) && !(r === 0xfffd && size === 1))) return false;
    i += size;
  }
  return true;
}

// ---------------------------------------------------------------- Decoding into Go types

/** A Go type the decoder fills. `name` is Go's `reflect.Type.String()`. */
export type GoType =
  | { kind: "string" }
  /** A Go `int` (64 bits). With `exact`, it decodes to a `bigint`, so values past 2^53 keep every digit. */
  | { kind: "int"; exact?: true }
  | { kind: "raw" }
  /**
   * Go `interface {}`: kept as raw bytes, but decoded as Go does, so a number
   * that `strconv.ParseFloat(s, 64)` rejects (such as `1e400`, at any depth)
   * is the error `json: cannot unmarshal number <n> into ... of type float64`.
   */
  | { kind: "any" }
  | { kind: "slice"; name: string; elem: GoType }
  | { kind: "map"; name: string; elem: GoType }
  | { kind: "struct"; name: string; short: string; fields: readonly { name: string; type: GoType }[] };

/** Decoded values: strings, numbers, raw bytes, arrays or null, Maps or null, and struct records. */
export type GoDecoded = string | number | bigint | Uint8Array | GoDecoded[] | Map<string, GoDecoded> | { [field: string]: GoDecoded } | null;

const typeName = (t: GoType): string => {
  switch (t.kind) {
    case "string":
      return "string";
    case "int":
      return "int";
    case "raw":
      return "json.RawMessage";
    case "any":
      return "interface {}";
    default:
      return t.name;
  }
};

/** The zero value of a Go type. */
export function goZero(t: GoType): GoDecoded {
  switch (t.kind) {
    case "string":
      return "";
    case "int":
      return t.exact === true ? 0n : 0;
    case "raw":
    case "any":
      return null;
    case "slice":
    case "map":
      return null;
    case "struct": {
      const out: { [field: string]: GoDecoded } = {};
      for (const f of t.fields) out[f.name] = goZero(f.type);
      return out;
    }
  }
}

let foldTable: Map<number, number> | undefined;

/** Go `foldRune` (src/encoding/json/fold.go): the smallest rune of the rune's `unicode.SimpleFold` orbit, from Go's own table. */
export function goFoldRune(r: number): number {
  if (foldTable === undefined) {
    foldTable = new Map();
    let rune = 0;
    for (const entry of GO_FOLD_TABLE.split(",")) {
      const [delta, fold] = entry.split(":") as [string, string];
      rune += parseInt(delta, 36);
      foldTable.set(rune, parseInt(fold, 36));
    }
  }
  return foldTable.get(r) ?? r;
}

/**
 * Go `foldName`: ASCII letters to upper case, and every other rune to
 * `foldRune`, so `foldName(x) == foldName(y)` exactly when Go's
 * `bytes.EqualFold(x, y)`. `ſ` matches `s` and `K` (Kelvin) matches `k`,
 * but `ı` (dotless i) matches nothing else.
 */
export function goFoldName(name: string): string {
  let out = "";
  for (const ch of name) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out += c >= 0x61 && c <= 0x7a ? String.fromCharCode(c - 0x20) : ch;
    else out += String.fromCodePoint(goFoldRune(c));
  }
  return out;
}

/**
 * Go `cachedTypeFields` lookup for one key: the field with that exact name,
 * else the first field (in field order) whose folded name matches.
 */
function fieldFor<T extends { name: string }>(fields: readonly T[], key: string): T | undefined {
  const exact = fields.find((f) => f.name === key);
  if (exact !== undefined) return exact;
  const folded = goFoldName(key);
  return fields.find((f) => goFoldName(f.name) === folded);
}

interface DecodeContext {
  data: Uint8Array;
  disallowUnknownFields: boolean;
  saved: string | undefined;
  struct: string | undefined;
  fieldStack: string[];
  hasContext: boolean;
}

function saveTypeError(ctx: DecodeContext, value: string, type: GoType | "float64"): void {
  if (ctx.saved !== undefined) return;
  const name = type === "float64" ? type : typeName(type);
  const contextual = ctx.hasContext && (ctx.struct !== undefined || ctx.fieldStack.length > 0);
  ctx.saved = contextual
    ? `json: cannot unmarshal ${value} into Go struct field ${ctx.struct ?? ""}.${ctx.fieldStack.join(".")} of type ${name}`
    : `json: cannot unmarshal ${value} into Go value of type ${name}`;
}

function saveError(ctx: DecodeContext, message: string): void {
  ctx.saved ??= message;
}

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

// Go slices have a length and a capacity. Decoding a JSON array into a slice
// that holds values already (a repeated or case-folded key) reuses its
// backing array: Go 1.24.1 `decodeState.array` decodes element i into slot i,
// shows a slot between the old length and the capacity again with the value
// it held, grows the backing array with `reflect.Value.Grow(1)` only when i
// reaches the capacity, and truncates the length at the end. So a `null`
// element (which leaves a string or struct as it is) or a `{}` element (which
// merges into a struct) can bring back an old value. A decoded slice is a
// JavaScript array of its length; SLICE_BACKING keeps its whole backing array.

const SLICE_BACKING = new WeakMap<GoDecoded[], GoDecoded[]>();

/** `unsafe.Sizeof` of a value of `t` on a 64-bit platform. Every type here is 8-byte aligned. */
function goSizeof(t: GoType): number {
  switch (t.kind) {
    case "string":
      return 16;
    case "int":
      return 8;
    case "raw":
    case "slice":
      return 24;
    case "any":
      return 16;
    case "map":
      return 8;
    case "struct":
      return t.fields.reduce((n, f) => n + goSizeof(f.type), 0);
  }
}

/** Go `abi.Type.Pointers()`: whether a value of `t` holds a pointer (the allocation is not `noscan`). */
function goHasPointers(t: GoType): boolean {
  if (t.kind === "int") return false;
  if (t.kind === "struct") return t.fields.some((f) => goHasPointers(f.type));
  return true;
}

// Go 1.24.1 runtime/sizeclasses.go (64-bit).
const CLASS_TO_SIZE = [0, 8, 16, 24, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 352, 384, 416, 448, 480, 512, 576, 640, 704, 768, 896, 1024, 1152, 1280, 1408, 1536, 1792, 2048, 2304, 2688, 3072, 3200, 3456, 4096, 4864, 5376, 6144, 6528, 6784, 6912, 8192, 9472, 9728, 10240, 10880, 12288, 13568, 14336, 16384, 18432, 19072, 20480, 21760, 24576, 27264, 28672, 32768];
const MAX_SMALL_SIZE = 32768;
const MALLOC_HEADER_SIZE = 8;
const MIN_SIZE_FOR_MALLOC_HEADER = 512;
const PAGE_SIZE = 8192;

/** Go 1.24.1 `runtime.roundupsize`. The smallest size class that holds `size` gives the same answer as Go's `size_to_class` tables. */
function goRoundupsize(size: number, noscan: boolean): number {
  let req = size;
  if (req <= MAX_SMALL_SIZE - MALLOC_HEADER_SIZE) {
    if (!noscan && req > MIN_SIZE_FOR_MALLOC_HEADER) req += MALLOC_HEADER_SIZE;
    const cls = CLASS_TO_SIZE.find((c) => c >= req)!;
    return cls - (req - size);
  }
  return Math.ceil(req / PAGE_SIZE) * PAGE_SIZE;
}

/** Go 1.24.1 `runtime.nextslicecap`. */
function goNextSliceCap(newLen: number, oldCap: number): number {
  let newcap = oldCap;
  const doublecap = newcap + newcap;
  if (newLen > doublecap) return newLen;
  const threshold = 256;
  if (oldCap < threshold) return doublecap;
  do newcap += (newcap + 3 * threshold) >> 2;
  while (newcap < newLen);
  return newcap;
}

/** The capacity after Go's `reflect.Value.Grow(1)` on a full slice of capacity `cap` (`runtime.growslice`). */
export function goGrowCap(cap: number, elem: GoType): number {
  const size = goSizeof(elem);
  const newcap = goNextSliceCap(cap + 1, cap);
  return Math.floor(goRoundupsize(newcap * size, !goHasPointers(elem)) / size);
}

/** Go `decodeState.array` into a slice that holds `current` (a decoded slice or null). */
function decodeSlice(ctx: DecodeContext, items: readonly JsonNode[], elem: GoType, current: GoDecoded): GoDecoded {
  // An empty array sets a new empty slice with capacity 0.
  if (items.length === 0) return [];
  const visible = Array.isArray(current) ? current : [];
  const backing = [...(SLICE_BACKING.get(visible) ?? visible)];
  items.forEach((item, i) => {
    if (i >= backing.length) {
      const cap = goGrowCap(backing.length, elem);
      while (backing.length < cap) backing.push(goZero(elem));
    }
    backing[i] = decodeValue(ctx, item, elem, backing[i]!);
  });
  const out = backing.slice(0, items.length);
  SLICE_BACKING.set(out, backing);
  return out;
}

/** Decodes `node` into a value of `type`, starting from `current` (Go reuses existing maps and slices). */
function decodeValue(ctx: DecodeContext, node: JsonNode, type: GoType, current: GoDecoded): GoDecoded {
  const raw = () => ctx.data.slice(node.start, node.end);
  if (type.kind === "raw") return raw();
  if (type.kind === "any") {
    // Go `valueInterface`: the first out-of-range number, in document order,
    // saves Go's `convertNumber` error with the current field context.
    const bad = firstOutOfRangeNumber(ctx.data, node);
    if (bad !== undefined) saveTypeError(ctx, `number ${bad}`, "float64");
    return raw();
  }
  if (node.kind === "null") {
    // Go literalStore: null zeroes a map, slice, pointer, or interface, and leaves anything else.
    return type.kind === "map" || type.kind === "slice" ? null : current;
  }
  if (node.kind === "object") {
    if (type.kind === "map") {
      const map = current instanceof Map ? current : new Map<string, GoDecoded>();
      const orig = { struct: ctx.struct, depth: ctx.fieldStack.length };
      for (const entry of node.entries) {
        map.set(entry.key, decodeValue(ctx, entry.value, type.elem, goZero(type.elem)));
        if (ctx.hasContext) {
          ctx.fieldStack.length = orig.depth;
          ctx.struct = orig.struct;
        }
      }
      return map;
    }
    if (type.kind === "struct") {
      const record = current as { [field: string]: GoDecoded };
      const orig = { struct: ctx.struct, depth: ctx.fieldStack.length };
      for (const entry of node.entries) {
        const field = fieldFor(type.fields, entry.key);
        if (field !== undefined) {
          ctx.hasContext = true;
          ctx.struct = type.short;
          ctx.fieldStack.push(field.name);
          record[field.name] = decodeValue(ctx, entry.value, field.type, record[field.name] ?? goZero(field.type));
        } else if (ctx.disallowUnknownFields) {
          saveError(ctx, `json: unknown field ${goQuote(entry.key)}`);
        }
        if (ctx.hasContext) {
          ctx.fieldStack.length = orig.depth;
          ctx.struct = orig.struct;
        }
      }
      return record;
    }
    saveTypeError(ctx, "object", type);
    return current;
  }
  if (node.kind === "array") {
    if (type.kind !== "slice") {
      saveTypeError(ctx, "array", type);
      return current;
    }
    return decodeSlice(ctx, node.items, type.elem, current);
  }
  if (node.kind === "true" || node.kind === "false") {
    saveTypeError(ctx, "bool", type);
    return current;
  }
  if (node.kind === "string") {
    if (type.kind === "string") return goUnquote(ctx.data.subarray(node.start, node.end));
    saveTypeError(ctx, "string", type);
    return current;
  }
  // Number.
  const text = new TextDecoder().decode(ctx.data.subarray(node.start, node.end));
  if (type.kind === "int") {
    if (/^-?[0-9]+$/.test(text)) {
      const n = BigInt(text);
      if (n >= INT64_MIN && n <= INT64_MAX) return type.exact === true ? n : Number(n);
    }
    saveTypeError(ctx, `number ${text}`, type);
    return current;
  }
  saveTypeError(ctx, "number", type);
  return current;
}

/** The result of a Go decode: the value, and Go's error text when it failed. */
export interface GoDecodeResult {
  value: GoDecoded;
  error: string | undefined;
}

function decodeValid(data: Uint8Array, start: number, end: number, type: GoType, disallowUnknownFields: boolean): GoDecodeResult {
  const ctx: DecodeContext = { data, disallowUnknownFields, saved: undefined, struct: undefined, fieldStack: [], hasContext: false };
  const value = decodeValue(ctx, parseTree(data, start, end), type, goZero(type));
  return { value, error: ctx.saved };
}

/** Go `json.Unmarshal(data, &v)` for a zero `v` of `type`. */
export function goUnmarshal(data: Uint8Array, type: GoType): GoDecodeResult {
  const syntax = goCheckValid(data);
  if (syntax !== undefined) return { value: goZero(type), error: syntax };
  return decodeValid(data, 0, data.length, type, false);
}

/** The first `Decoder.Decode` and the check that nothing but white space follows it. */
export interface GoDecoderResult {
  value: GoDecoded;
  /** Error text of the first `Decode`, or undefined. */
  error: string | undefined;
  /** For a successful first value: `undefined` (only white space follows), `multiple`, or the second read's error text. */
  trailing: undefined | "multiple" | string;
}

/**
 * Go `json.NewDecoder(bytes.NewReader(data))` with `DisallowUnknownFields`:
 * the first `Decode(&v)`, then a second `Decode(&any)` to look for trailing
 * content, as the seed's manifest and index readers do.
 */
export function goDecodeFirst(data: Uint8Array, type: GoType): GoDecoderResult {
  const first = goDecoderRead(data, 0);
  if (first.kind === "eof") return { value: goZero(type), error: "EOF", trailing: undefined };
  if (first.kind === "error") return { value: goZero(type), error: first.message, trailing: undefined };
  const decoded = decodeValid(data, first.start, first.end, type, true);
  if (decoded.error !== undefined) return { value: decoded.value, error: decoded.error, trailing: undefined };
  const second = goDecoderRead(data, first.end);
  const trailing = second.kind === "eof" ? undefined : second.kind === "value" ? (goDecodeAnyError(data, second.start, second.end) ?? "multiple") : second.message;
  return { value: decoded.value, error: undefined, trailing };
}

/**
 * The error of Go `Decode(&v)` with `v` of type `any` for one valid value:
 * the first number, in document order, that `strconv.ParseFloat(s, 64)`
 * rejects (out of range, such as `1e999`), as Go's `convertNumber` reports
 * it, or `undefined`. Nothing else in valid JSON fails to decode into `any`.
 */
function goDecodeAnyError(data: Uint8Array, start: number, end: number): string | undefined {
  const bad = firstOutOfRangeNumber(data, parseTree(data, start, end));
  return bad === undefined ? undefined : `json: cannot unmarshal number ${bad} into Go value of type float64`;
}

/** The text of the first number under `root`, in document order, that Go's `strconv.ParseFloat(s, 64)` rejects, or `undefined`. */
function firstOutOfRangeNumber(data: Uint8Array, root: JsonNode): string | undefined {
  const pending: JsonNode[] = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.kind === "object") for (let k = node.entries.length - 1; k >= 0; k--) pending.push(node.entries[k]!.value);
    else if (node.kind === "array") for (let k = node.items.length - 1; k >= 0; k--) pending.push(node.items[k]!);
    else if (node.kind === "number") {
      const text = new TextDecoder().decode(data.subarray(node.start, node.end));
      // JavaScript and Go both round to the nearest float64; a value past the
      // largest float64 by half an ULP or more is Infinity here and ErrRange in Go.
      if (!Number.isFinite(Number(text))) return text;
    }
  }
  return undefined;
}

/** A map of `json.RawMessage` values as Go decodes it: decoded keys, raw value bytes, last duplicate wins. */
export type RawObject = Map<string, Uint8Array>;

const RAW_OBJECT: GoType = { kind: "map", name: "map[string]json.RawMessage", elem: { kind: "raw" } };

/** Go `json.Unmarshal(data, &map[string]json.RawMessage{})`: the map (null for JSON `null`), or the error. */
export function goUnmarshalRawObject(data: Uint8Array): { object: RawObject | null; error: string | undefined } {
  const { value, error } = goUnmarshal(data, RAW_OBJECT);
  return { object: value instanceof Map ? (value as RawObject) : null, error };
}

/** Go `json.Marshal(map[string]json.RawMessage)`: keys sorted, values compacted, HTML escaped. */
export function goMarshalRawObject(object: RawObject): Uint8Array {
  const keys = [...object.keys()].sort(goCompare);
  const parts: Uint8Array[] = [utf8("{")];
  keys.forEach((key, index) => {
    if (index > 0) parts.push(utf8(","));
    parts.push(utf8(`${goEncodeString(key, true)}:`));
    parts.push(goCompact(object.get(key)!, true));
  });
  parts.push(utf8("}"));
  return concatBytes(parts);
}

/** Joins byte arrays. */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
