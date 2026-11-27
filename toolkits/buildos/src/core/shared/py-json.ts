/**
 * Python's `json` module and the value reprs that the skill scripts print,
 * ported for the W1 R7 P9 skill-script commands (`buildos extract bulk` from
 * `work.py`, `buildos fitgap` from `fitgap.py`). The scripts read JSON with
 * `json.loads` and write it with `json.dumps`, and they print Python values
 * (`repr` of a string, a list, or a dict) in their messages. Output parity
 * needs the same bytes, so this module keeps what Python keeps and the plain
 * JavaScript `JSON` loses:
 *
 * - A JSON object is a `Map`, in source order (a repeated key keeps its first
 *   place and its last value, as a Python `dict` does). A JavaScript object
 *   would move integer-like keys such as `"2026"` to the front.
 * - An integer is a `number` when it is a safe integer, else a `bigint`, so
 *   every digit stays. A number with a fraction or an exponent is a
 *   `PyFloat`, so `1.0` is written back as `1.0`, not `1`.
 * - `NaN`, `Infinity`, and `-Infinity` read and write as Python does.
 * - Errors carry Python's text: `Expecting value: line 1 column 1 (char 0)`,
 *   with positions in code points.
 * - An integer of more than 4300 digits is Python's `ValueError` of `int()`
 *   (`PyIntDigitsError`); a shorter one, and a float of any length, is read
 *   (F-P9-04 review round 1, finding 2: a 4096-digit integer was refused).
 *
 * Nesting is capped at `PY_JSON_MAX_DEPTH`; Python stops near its recursion
 * limit with a `RecursionError` (a traceback), so a deeper document is a
 * recorded divergence, not a parity case.
 */

/** A Python `float`. */
export class PyFloat {
  readonly value: number;
  constructor(value: number) {
    this.value = value;
  }
}

/** A Python `dict` of JSON data: keys are strings, in insertion order. */
export type PyDict = Map<string, PyValue>;

/** A value `json.loads` returns. `true`/`false` are Python's `True`/`False`. */
export type PyValue = null | boolean | number | bigint | PyFloat | string | PyValue[] | PyDict;

/** Nesting levels `pyLoads` reads. Python's C scanner fails near its recursion limit (1000). */
export const PY_JSON_MAX_DEPTH = 512;

/** `json.JSONDecodeError`: `message` is Python's full `str(exc)`. */
export class PyJsonError extends Error {
  /** The message without the position, for example `Expecting value`. */
  readonly msg: string;
  /** The position in code points. */
  readonly pos: number;
  constructor(msg: string, text: string, unitPos: number) {
    const pos = codePointIndex(text, unitPos);
    const before = text.slice(0, unitPos);
    const lineno = countChar(before, "\n") + 1;
    const lastNewline = before.lastIndexOf("\n");
    const colno = lastNewline === -1 ? pos + 1 : pos - codePointIndex(text, lastNewline);
    super(`${msg}: line ${lineno} column ${colno} (char ${pos})`);
    this.name = "PyJsonError";
    this.msg = msg;
    this.pos = pos;
  }
}

/** The document nests deeper than `PY_JSON_MAX_DEPTH` (Python: `RecursionError`). */
export class PyJsonDepthError extends Error {
  constructor() {
    super(`the JSON nests more than ${PY_JSON_MAX_DEPTH} levels deep`);
    this.name = "PyJsonDepthError";
  }
}

function countChar(text: string, char: string): number {
  let count = 0;
  for (let i = text.indexOf(char); i !== -1; i = text.indexOf(char, i + 1)) count++;
  return count;
}

/** The code point index of UTF-16 index `unit` in `text`. */
export function codePointIndex(text: string, unit: number): number {
  let count = 0;
  for (let i = 0; i < unit && i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < unit) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

const WS = new Set([0x20, 0x09, 0x0a, 0x0d]);

/** Python's `NUMBER_RE` of `json.scanner`, matched at one position (no length cap: Python reads a number of any length). */
const NUMBER = /(-?(?:0|[1-9][0-9]*))(\.[0-9]+)?([eE][-+]?[0-9]+)?/y;

/**
 * `sys.int_info.default_max_str_digits`: the most decimal digits that `int()`
 * converts from a string (Python 3.11 and later; 4300 on Python 3.14, the
 * version of the skill-script captures). `json` parses an integer with
 * `int()`, so it has the same limit; a float has none.
 */
export const PY_INT_MAX_STR_DIGITS = 4300;

/** Python's `ValueError` for a string of more than `PY_INT_MAX_STR_DIGITS` digits. `pyText` is Python's message; `message` is plain words. */
export class PyIntDigitsError extends Error {
  readonly digits: number;
  readonly pyText: string;
  constructor(digits: number) {
    super(`an integer has ${digits} digits; Python reads at most ${PY_INT_MAX_STR_DIGITS}`);
    this.name = "PyIntDigitsError";
    this.digits = digits;
    this.pyText = `Exceeds the limit (${PY_INT_MAX_STR_DIGITS} digits) for integer string conversion: value has ${digits} digits; use sys.set_int_max_str_digits() to increase the limit`;
  }
}

/** `json.loads(text)` for a `str`. */
export function pyLoads(text: string): PyValue {
  if (text.startsWith("\ufeff")) throw new PyJsonError("Unexpected UTF-8 BOM (decode using utf-8-sig)", text, 0);
  const parser = new Parser(text);
  let at = parser.skip(0);
  const [value, end] = parser.value(at, 0);
  at = parser.skip(end);
  if (at !== text.length) throw new PyJsonError("Extra data", text, at);
  return value;
}

class Parser {
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }

  skip(at: number): number {
    while (at < this.s.length && WS.has(this.s.charCodeAt(at))) at++;
    return at;
  }

  value(at: number, depth: number): [PyValue, number] {
    const s = this.s;
    if (depth >= PY_JSON_MAX_DEPTH) throw new PyJsonDepthError();
    const c = s[at];
    if (c === '"') return this.string(at + 1);
    if (c === "{") return this.object(at + 1, depth + 1);
    if (c === "[") return this.array(at + 1, depth + 1);
    if (c === "n" && s.startsWith("null", at)) return [null, at + 4];
    if (c === "t" && s.startsWith("true", at)) return [true, at + 4];
    if (c === "f" && s.startsWith("false", at)) return [false, at + 5];
    if (c === "N" && s.startsWith("NaN", at)) return [new PyFloat(Number.NaN), at + 3];
    if (c === "I" && s.startsWith("Infinity", at)) return [new PyFloat(Number.POSITIVE_INFINITY), at + 8];
    if (c === "-" && s.startsWith("-Infinity", at)) return [new PyFloat(Number.NEGATIVE_INFINITY), at + 9];
    NUMBER.lastIndex = at;
    const number = NUMBER.exec(s);
    if (number !== null && (c === "-" || (c !== undefined && c >= "0" && c <= "9"))) {
      const [text, integer, frac, exp] = number;
      if (frac === undefined && exp === undefined) {
        // Python converts the digits with int(), which refuses more than 4300 of them (a ValueError, not a JSONDecodeError).
        const digits = integer!.length - (integer!.startsWith("-") ? 1 : 0);
        if (digits > PY_INT_MAX_STR_DIGITS) throw new PyIntDigitsError(digits);
        return [pyInt(integer!), at + text.length];
      }
      return [new PyFloat(Number(text)), at + text.length];
    }
    throw new PyJsonError("Expecting value", s, at);
  }

  string(at: number): [string, number] {
    const s = this.s;
    const begin = at - 1;
    let out = "";
    let chunk = at;
    for (;;) {
      if (at >= s.length) throw new PyJsonError("Unterminated string starting at", s, begin);
      const code = s.charCodeAt(at);
      if (code === 0x22) {
        out += s.slice(chunk, at);
        return [out, at + 1];
      }
      if (code < 0x20) throw new PyJsonError("Invalid control character at", s, at);
      if (code !== 0x5c) {
        at++;
        continue;
      }
      out += s.slice(chunk, at);
      const esc = s[at + 1];
      if (esc === undefined) throw new PyJsonError("Unterminated string starting at", s, begin);
      if (esc === "u") {
        const unit = this.hex4(at + 2, at);
        let next = at + 6;
        let text = String.fromCharCode(unit);
        if (unit >= 0xd800 && unit <= 0xdbff && s[next] === "\\" && s[next + 1] === "u") {
          const low = this.hex4(next + 2, next);
          if (low >= 0xdc00 && low <= 0xdfff) {
            text += String.fromCharCode(low);
            next += 6;
          }
        }
        out += text;
        at = next;
      } else {
        const simple: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        const mapped = Object.hasOwn(simple, esc) ? simple[esc] : undefined;
        if (mapped === undefined) throw new PyJsonError("Invalid \\escape", s, at);
        out += mapped;
        at += 2;
      }
      chunk = at;
    }
  }

  hex4(at: number, backslash: number): number {
    const digits = this.s.slice(at, at + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(digits)) throw new PyJsonError("Invalid \\uXXXX escape", this.s, backslash + 1);
    return Number.parseInt(digits, 16);
  }

  object(at: number, depth: number): [PyDict, number] {
    const s = this.s;
    const out: PyDict = new Map();
    at = this.skip(at);
    if (s[at] === "}") return [out, at + 1];
    for (;;) {
      if (s[at] !== '"') throw new PyJsonError("Expecting property name enclosed in double quotes", s, at);
      const [key, afterKey] = this.string(at + 1);
      at = this.skip(afterKey);
      if (s[at] !== ":") throw new PyJsonError("Expecting ':' delimiter", s, at);
      at = this.skip(at + 1);
      const [value, afterValue] = this.value(at, depth);
      out.set(key, value);
      at = this.skip(afterValue);
      if (s[at] === "}") return [out, at + 1];
      if (s[at] !== ",") throw new PyJsonError("Expecting ',' delimiter", s, at);
      const comma = at;
      at = this.skip(at + 1);
      if (s[at] === "}") throw new PyJsonError("Illegal trailing comma before end of object", s, comma);
    }
  }

  array(at: number, depth: number): [PyValue[], number] {
    const s = this.s;
    const out: PyValue[] = [];
    at = this.skip(at);
    if (s[at] === "]") return [out, at + 1];
    for (;;) {
      const [value, afterValue] = this.value(at, depth);
      out.push(value);
      at = this.skip(afterValue);
      if (s[at] === "]") return [out, at + 1];
      if (s[at] !== ",") throw new PyJsonError("Expecting ',' delimiter", s, at);
      const comma = at;
      at = this.skip(at + 1);
      if (s[at] === "]") throw new PyJsonError("Illegal trailing comma before end of array", s, comma);
    }
  }
}

/** A Python `int` from its decimal digits: a `number` when safe, else a `bigint`. */
export function pyInt(digits: string): number | bigint {
  const big = BigInt(digits);
  return big >= BigInt(Number.MIN_SAFE_INTEGER) && big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big;
}

// ---------------------------------------------------------------- dumps

export interface PyDumpOptions {
  /** `indent`: `undefined` for one line. */
  indent?: number;
  /** `ensure_ascii` (Python's default is true). */
  ensureAscii?: boolean;
  sortKeys?: boolean;
  /** `separators`; default `(", ", ": ")`, or `(",", ": ")` with an indent. */
  separators?: [string, string];
}

/** `json.dumps(value, ...)`. Only `PyValue`s; any other value throws. */
export function pyDumps(value: PyValue, options: PyDumpOptions = {}): string {
  const ensureAscii = options.ensureAscii ?? true;
  const indent = options.indent;
  const [itemSep, keySep] = options.separators ?? (indent === undefined ? [", ", ": "] : [",", ": "]);
  const encode = (v: PyValue, level: number): string => {
    if (v === null) return "null";
    if (v === true) return "true";
    if (v === false) return "false";
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (v instanceof PyFloat) return floatJson(v.value);
    if (typeof v === "string") return pyJsonString(v, ensureAscii);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      const items = v.map((x) => encode(x, level + 1));
      return wrap("[", "]", items, level);
    }
    if (v instanceof Map) {
      if (v.size === 0) return "{}";
      let keys = [...v.keys()];
      if (options.sortKeys === true) keys = keys.sort(comparePyStrings);
      const items = keys.map((k) => `${pyJsonString(k, ensureAscii)}${keySep}${encode(v.get(k)!, level + 1)}`);
      return wrap("{", "}", items, level);
    }
    throw new TypeError(`Object of type ${typeof v} is not JSON serializable`);
  };
  const wrap = (open: string, close: string, items: string[], level: number): string => {
    if (indent === undefined) return `${open}${items.join(itemSep)}${close}`;
    const inner = "\n" + " ".repeat(indent * (level + 1));
    const outer = "\n" + " ".repeat(indent * level);
    return `${open}${inner}${items.join(itemSep + inner)}${outer}${close}`;
  };
  return encode(value, 0);
}

/** Python's string order: by code point (JavaScript's `<` compares UTF-16 units). */
export function comparePyStrings(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done === true) return y.done === true ? 0 : -1;
    if (y.done === true) return 1;
    const cx = x.value.codePointAt(0)!;
    const cy = y.value.codePointAt(0)!;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
}

/** `json.encoder` string form. */
export function pyJsonString(text: string, ensureAscii: boolean): string {
  let out = '"';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const ch = text[i]!;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (c < 0x20 || (ensureAscii && c > 0x7e)) out += `\\u${c.toString(16).padStart(4, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

/** `float.__repr__` (shortest round trip; exponent form below 1e-4 and from 1e16). */
export function pyFloatRepr(value: number): string {
  if (Number.isNaN(value)) return "nan";
  if (value === Number.POSITIVE_INFINITY) return "inf";
  if (value === Number.NEGATIVE_INFINITY) return "-inf";
  if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";
  const [mantissa, expText] = value.toExponential().split("e") as [string, string];
  const exp = Number(expText);
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace("-", "").replace(".", "");
  const sign = negative ? "-" : "";
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${m}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  if (exp < 0) return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
  const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, "0");
  const frac = digits.slice(exp + 1);
  return `${sign}${intPart}.${frac === "" ? "0" : frac}`;
}

function floatJson(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Infinity";
  if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
  return pyFloatRepr(value);
}

// ---------------------------------------------------------------- repr and str

const NOT_PRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u;

/** `str.__repr__`. */
export function pyStrRepr(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (ch === quote || ch === "\\") out += `\\${ch}`;
    else if (ch === "\t") out += "\\t";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (cp < 0x20 || cp === 0x7f) out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else if (cp < 0x7f || ch === " ") out += ch;
    else if (NOT_PRINTABLE.test(ch)) {
      if (cp <= 0xff) out += `\\x${cp.toString(16).padStart(2, "0")}`;
      else if (cp <= 0xffff) out += `\\u${cp.toString(16).padStart(4, "0")}`;
      else out += `\\U${cp.toString(16).padStart(8, "0")}`;
    } else out += ch;
  }
  return out + quote;
}

/** `repr(value)` for JSON data (and `undefined` as `None`). */
export function pyRepr(value: PyValue | undefined): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value instanceof PyFloat) return pyFloatRepr(value.value);
  if (typeof value === "string") return pyStrRepr(value);
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  return `{${[...value].map(([k, v]) => `${pyStrRepr(k)}: ${pyRepr(v)}`).join(", ")}}`;
}

/** `str(value)`: a string as it is, any other value as its repr. */
export function pyStr(value: PyValue | undefined): string {
  return typeof value === "string" ? value : pyRepr(value);
}

/** Python truthiness of JSON data. */
export function pyTruthy(value: PyValue | undefined): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (value === 0 || value === 0n || value === "") return false;
  if (value instanceof PyFloat) return value.value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map) return value.size > 0;
  return true;
}

/** True for a Python `dict`. */
export function isDict(value: PyValue | undefined): value is PyDict {
  return value instanceof Map;
}

/** True for a Python `list`. */
export function isList(value: PyValue | undefined): value is PyValue[] {
  return Array.isArray(value);
}

/** `isinstance(value, (int, float))` (a `bool` is an `int` in Python). */
export function isPyNumber(value: PyValue | undefined): boolean {
  return typeof value === "number" || typeof value === "bigint" || typeof value === "boolean" || value instanceof PyFloat;
}

/** The number of a Python `int`, `float`, or `bool`. */
export function pyNumber(value: PyValue | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof PyFloat) return value.value;
  throw new TypeError("not a number");
}

/** Python `==` for JSON data (`1 == 1.0 == True`). */
export function pyEquals(a: PyValue | undefined, b: PyValue | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (isPyNumber(a) && isPyNumber(b)) {
    if (typeof a === "bigint" || typeof b === "bigint") {
      const ai = typeof a === "bigint" ? a : Number.isInteger(pyNumber(a)) ? BigInt(pyNumber(a)) : undefined;
      const bi = typeof b === "bigint" ? b : Number.isInteger(pyNumber(b)) ? BigInt(pyNumber(b)) : undefined;
      return ai !== undefined && bi !== undefined && ai === bi;
    }
    return pyNumber(a) === pyNumber(b);
  }
  if (typeof a === "string" || typeof b === "string" || a === null || b === null) return a === b;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => pyEquals(x, b[i]));
  if (a instanceof Map) {
    if (!(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !pyEquals(v, b.get(k))) return false;
    return true;
  }
  return false;
}

/** `copy.deepcopy` of JSON data. */
export function pyDeepCopy<T extends PyValue>(value: T): T {
  if (Array.isArray(value)) return value.map(pyDeepCopy) as T;
  if (value instanceof Map) return new Map([...(value as PyDict)].map(([k, v]) => [k, pyDeepCopy(v)])) as T;
  return value;
}

/** Python's `round(x)` for a float: half to even. */
export function pyRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

const PY_WHITESPACE = /[\t\n\v\f\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/;

/** Python's `str.isspace` for one character. */
export function pyIsSpace(ch: string): boolean {
  return PY_WHITESPACE.test(ch);
}

/** Python's `str.strip()`. */
export function pyStrip(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && pyIsSpace(text[start]!)) start++;
  while (end > start && pyIsSpace(text[end - 1]!)) end--;
  return text.slice(start, end);
}

/** Python's `str.splitlines()` (no line ends kept). */
export function pySplitlines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Python's `str.splitlines()` with no line end in the text: universal newlines as `read_text()` reads, then splitlines. */
export function pyReadTextLines(text: string): string[] {
  return pySplitlines(pyUniversalNewlines(text));
}

/** Python text mode reading (`newline=None`): `\r\n` and `\r` become `\n`. */
export function pyUniversalNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Python's `len(text)` (code points). */
export function pyLen(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}
