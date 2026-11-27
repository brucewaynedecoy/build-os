/**
 * Python value rules that `cm_build.py` (the tool of the capability-matrix
 * skill) relies on and that `fitgap/py.ts` does not hold yet (W1 R7 P9,
 * F-P9-04): a `dict` and a `set` keyed by any hashable value (Python's `1`,
 * `1.0`, and `True` are one key), `collections.Counter`, `x in y`, `len`,
 * `x[k]` on a dict, a list, or a string, `os.path.dirname`, `int(str)`, and
 * `json.dump` of a dict whose keys are not all strings (a `Counter` of
 * statuses). An operation that raised a Python error the script did not
 * catch throws a `FitgapShapeError` with the error's last line, as a
 * traceback ended.
 *
 * F-P9-04 review round 1 (finding 1): numbers compare, hash, and sort by
 * their exact value, as Python's do. JSON reads an integer above 2^53 as a
 * `bigint`, and the fitgap helpers (`pyEq`, `hashKey`, `pyCompare`) turn it
 * into a JavaScript number, which rounds it (9007199254740992 and
 * 9007199254740993 became one value). `pyEqual`, `pyHashKey`, `pyOrder`, and
 * `pySorted` here keep every digit: an integer is compared as a `bigint`, a
 * float by its exact value against an integer (`1 == 1.0 == True`, `-0.0 ==
 * 0`, `2**53 + 1 != 2.0**53`), and a float that is not a whole number never
 * equals an integer. Python compares the items of a list, a dict, `x in
 * list`, and `list.index` by identity first; every `NaN` that `json` reads
 * is the same object (`json.decoder.NaN`), so there a `NaN` equals a `NaN`,
 * while a plain `==` or `!=` of two floats does not (`pyEqualItem` and
 * `pyEqual`).
 */

import { sep } from "node:path";
import { isDict, isList, PY_INT_MAX_STR_DIGITS, PyFloat, pyFloatRepr, pyJsonString, pyRepr, pyStr, type PyDict, type PyValue } from "../shared/py-json.ts";
import { FitgapShapeError, iter, joinStr, truthy, typeName, type V } from "../fitgap/py.ts";

/** A Python number's exact value: an integer as a `bigint`, a float as itself. Undefined for a value that is not a number. */
function exact(v: V): bigint | number | undefined {
  if (typeof v === "boolean") return v ? 1n : 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return Number.isInteger(v) ? BigInt(v) : v;
  if (v instanceof PyFloat) return v.value;
  return undefined;
}

/** The `bigint` of a float that is a whole number, else undefined. */
function wholeFloat(x: number): bigint | undefined {
  return Number.isFinite(x) && Number.isInteger(x) ? BigInt(x) : undefined;
}

/** Python `==` of two numbers (exact; a `NaN` equals nothing). */
function numEqual(a: bigint | number, b: bigint | number): boolean {
  if (typeof a === "bigint" && typeof b === "bigint") return a === b;
  if (typeof a === "number" && typeof b === "number") return a === b;
  const big = typeof a === "bigint" ? a : (b as bigint);
  const float = typeof a === "number" ? a : (b as number);
  return wholeFloat(float) === big;
}

/** Python `a < b` for two numbers: -1, 0 (equal, or a `NaN`, which is never less), or 1. */
function numOrder(a: bigint | number, b: bigint | number): number {
  if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
  const flip = typeof a === "bigint";
  const float = (flip ? b : a) as number;
  const big = (flip ? a : b) as bigint;
  let order: number;
  if (Number.isNaN(float)) return 0;
  if (!Number.isFinite(float)) order = float > 0 ? 1 : -1;
  else {
    const floor = BigInt(Math.floor(float));
    order = floor < big ? -1 : floor > big ? 1 : float > Math.floor(float) ? 1 : 0;
  }
  return flip ? -order : order;
}

const isJsonNaN = (v: V): boolean => v instanceof PyFloat && Number.isNaN(v.value);

/** Python `a == b` on JSON data, with every digit of an integer. */
export function pyEqual(a: V, b: V): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  const x = exact(a);
  const y = exact(b);
  if (x !== undefined && y !== undefined) return numEqual(x, y);
  if (x !== undefined || y !== undefined) return false;
  if (typeof a === "string" || typeof b === "string" || a === null || b === null) return a === b;
  if (isList(a)) return isList(b) && a.length === b.length && a.every((item, i) => pyEqualItem(item, b[i]));
  if (isDict(a)) {
    if (!isDict(b) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !pyEqualItem(v, b.get(k))) return false;
    return true;
  }
  return false;
}

/** `PyObject_RichCompareBool(a, b, Py_EQ)`: identity first (the one `NaN` of `json`), then `==`. */
export function pyEqualItem(a: V, b: V): boolean {
  if (isJsonNaN(a) && isJsonNaN(b)) return true;
  if (a === b && a !== undefined) return true;
  return pyEqual(a, b);
}

/** Where a value is hashed: Python 3.14 names the use in its `TypeError` (`cannot use 'list' as a set element (unhashable type: 'list')`); `hash` alone (as `Counter(...)` does) names none. */
export type HashUse = "set element" | "dict key" | "hash";

/**
 * A key for a Python `dict` or `set` (`TypeError` for a list or a dict, with
 * Python 3.14's text for `use`): `1`, `1.0`, and `True` are one key, `2**53`
 * and `2**53 + 1` are two, and every `NaN` of `json` is one key.
 */
export function pyHashKey(value: V, use: HashUse = "hash"): string {
  if (isList(value) || isDict(value)) {
    const type = isList(value) ? "list" : "dict";
    throw new FitgapShapeError(use === "hash" ? `TypeError: unhashable type: '${type}'` : `TypeError: cannot use '${type}' as a ${use} (unhashable type: '${type}')`);
  }
  if (value === undefined || value === null) return "None";
  if (typeof value === "string") return `s${value}`;
  const x = exact(value)!;
  if (typeof x === "bigint") return `n${x}`;
  const whole = wholeFloat(x);
  return whole !== undefined ? `n${whole}` : `f${String(x)}`;
}

/** Python `<` for the values `sorted` compares: numbers by exact value, strings by code point; any other pair is the `TypeError` (`None < None` too). */
export function pyOrder(a: V, b: V): number {
  const x = exact(a);
  const y = exact(b);
  if (x !== undefined && y !== undefined) return numOrder(x, y);
  if (typeof a === "string" && typeof b === "string") {
    const xa = [...a];
    const xb = [...b];
    for (let i = 0; i < Math.min(xa.length, xb.length); i++) {
      const d = xa[i]!.codePointAt(0)! - xb[i]!.codePointAt(0)!;
      if (d !== 0) return d < 0 ? -1 : 1;
    }
    return xa.length - xb.length;
  }
  throw new FitgapShapeError(`TypeError: '<' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
}

/** `sorted(items, key=key)`: stable, with `pyOrder`. */
export function pySorted<T>(items: readonly T[], key: (item: T) => V): T[] {
  const keyed = items.map((item, i) => ({ item, k: key(item), i }));
  keyed.sort((p, q) => pyOrder(p.k, q.k) || p.i - q.i);
  return keyed.map((p) => p.item);
}

/** A Python `dict` or `set` keyed by any hashable value, in insertion order (a repeated key keeps its first key and place). */
export class PyMap<T> {
  private readonly items = new Map<string, { key: PyValue; value: T }>();
  /** How a key is named in the `TypeError` of an unhashable one. */
  protected readonly use: HashUse;

  constructor(use: HashUse = "dict key") {
    this.use = use;
  }

  set(key: V, value: T): void {
    const k = pyHashKey(key, this.use);
    const found = this.items.get(k);
    if (found !== undefined) found.value = value;
    else this.items.set(k, { key: key ?? null, value });
  }

  has(key: V): boolean {
    return this.items.has(pyHashKey(key, this.use));
  }

  get(key: V): T | undefined {
    return this.items.get(pyHashKey(key, this.use))?.value;
  }

  /** `d[key]`: a `KeyError` with the key's repr when it is missing. */
  at(key: V): T {
    const found = this.items.get(pyHashKey(key, this.use));
    if (found === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(key ?? null)}`);
    return found.value;
  }

  get size(): number {
    return this.items.size;
  }

  keys(): PyValue[] {
    return [...this.items.values()].map((e) => e.key);
  }

  entries(): [PyValue, T][] {
    return [...this.items.values()].map((e) => [e.key, e.value]);
  }
}

/** A Python `set`. */
export class PySet extends PyMap<true> {
  constructor(values: Iterable<V> = []) {
    super("set element");
    for (const v of values) this.add(v);
  }

  add(value: V): void {
    this.set(value, true);
  }

  /** `self - other`. */
  minus(other: PySet): PySet {
    return new PySet(this.keys().filter((k) => !other.has(k)));
  }

  /** `self == other`. */
  equals(other: PySet): boolean {
    return this.size === other.size && this.keys().every((k) => other.has(k));
  }
}

/** `collections.Counter(values)`, as `dict(...)`: each value with its count, in first-seen order. */
export function counter(values: Iterable<V>): PyMap<number> {
  const out = new PyMap<number>();
  for (const v of values) {
    pyHashKey(v); // Counter's C helper hashes each element first: `unhashable type: 'list'`.
    out.set(v, (out.get(v) ?? 0) + 1);
  }
  return out;
}

/** `repr(dict(counter))`. */
export function counterRepr(c: PyMap<number>): string {
  return `{${c.entries().map(([k, n]) => `${pyRepr(k)}: ${n}`).join(", ")}}`;
}

/** A dict for `json.dump` whose keys are any JSON scalars (a `Counter`): `json` turns each key into a string. */
export class PyPairs {
  readonly pairs: [PyValue, JsonOut][];
  constructor(pairs: [PyValue, JsonOut][]) {
    this.pairs = pairs;
  }
}

/** What `cmDumps` writes: JSON data, or a dict with non-string keys. */
export type JsonOut = PyValue | PyPairs | JsonOut[] | Map<string, JsonOut>;

export function counterJson(c: PyMap<number>): PyPairs {
  return new PyPairs(c.entries());
}

function floatJson(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Infinity";
  if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
  return pyFloatRepr(value);
}

/** The string `json` makes of a dict key (`True` is `"true"`, `None` is `"null"`, a float its repr). */
function jsonKey(key: PyValue): string {
  if (typeof key === "string") return key;
  if (key === null) return "null";
  if (key === true) return "true";
  if (key === false) return "false";
  if (typeof key === "number" || typeof key === "bigint") return String(key);
  if (key instanceof PyFloat) return floatJson(key.value);
  throw new FitgapShapeError(`TypeError: keys must be str, int, float, bool or None, not ${typeName(key)}`);
}

/**
 * The chunks that `json.dump(o, f, indent=1, ensure_ascii=False)` hands to
 * `f.write`, one at a time, as Python's pure-Python encoder yields them
 * (`json.dump` never uses the C encoder): a dict key alone, `": "`, a string
 * value alone; a scalar in a list with the separator before it (`"[\n "`
 * for the first, `",\n "` for the others). The text file encodes each chunk
 * on its own, so a lone surrogate's `UnicodeEncodeError` counts its position
 * from the start of its chunk (review round 2, finding 3).
 */
export function cmDumpChunks(value: JsonOut): string[] {
  const out: string[] = [];
  const scalar = (v: JsonOut): string | undefined => {
    if (v === null) return "null";
    if (v === true) return "true";
    if (v === false) return "false";
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (v instanceof PyFloat) return floatJson(v.value);
    if (typeof v === "string") return pyJsonString(v, false);
    return undefined;
  };
  const encode = (v: JsonOut, level: number): void => {
    const text = scalar(v);
    if (text !== undefined) {
      out.push(text);
      return;
    }
    const inner = "\n" + " ".repeat(level + 1);
    const outer = "\n" + " ".repeat(level);
    if (Array.isArray(v)) {
      if (v.length === 0) {
        out.push("[]");
        return;
      }
      v.forEach((x, i) => {
        const buf = i === 0 ? `[${inner}` : `,${inner}`;
        const item = scalar(x);
        if (item !== undefined) out.push(buf + item);
        else {
          out.push(buf);
          encode(x, level + 1);
        }
      });
      out.push(outer, "]");
      return;
    }
    const pairs: [string, JsonOut][] = v instanceof PyPairs ? v.pairs.map(([k, x]) => [jsonKey(k), x]) : [...(v as Map<string, JsonOut>)];
    if (pairs.length === 0) {
      out.push("{}");
      return;
    }
    out.push("{", inner);
    pairs.forEach(([k, x], i) => {
      if (i > 0) out.push(`,${inner}`);
      out.push(pyJsonString(k, false), ": ");
      encode(x, level + 1);
    });
    out.push(outer, "}");
  };
  encode(value, 0);
  return out;
}

/** `json.dump(o, f, indent=1, ensure_ascii=False)` (no final line break), with `PyPairs` dicts. */
export function cmDumps(value: JsonOut): string {
  return cmDumpChunks(value).join("");
}

/** Throws the `TypeError` of an unhashable value (a list or a dict) used as `use`. */
function hashable(value: V, use: HashUse): void {
  pyHashKey(value, use);
}

/** `x in container`. */
export function pyIn(x: V, container: V | PyMap<unknown>): boolean {
  if (container instanceof PyMap) return container.has(x);
  if (isDict(container)) {
    hashable(x, "dict key");
    return typeof x === "string" && container.has(x);
  }
  if (isList(container)) return container.some((item) => pyEqualItem(item, x));
  if (typeof container === "string") {
    if (typeof x !== "string") throw new FitgapShapeError(`TypeError: 'in <string>' requires string as left operand, not ${typeName(x)}`);
    return container.includes(x);
  }
  throw new FitgapShapeError(`TypeError: argument of type '${typeName(container)}' is not iterable`);
}

/** `x in {fixed set of strings}` (`TYPES`, `KINDS`, ...): an unhashable value is a `TypeError`. */
export function inStrings(x: V, set: ReadonlySet<string>): boolean {
  hashable(x, "set element");
  return typeof x === "string" && set.has(x);
}

/** `len(x)`. */
export function pyLength(x: V | PyMap<unknown>): number {
  if (x instanceof PyMap) return x.size;
  if (typeof x === "string") return [...x].length;
  if (isList(x)) return x.length;
  if (isDict(x)) return x.size;
  throw new FitgapShapeError(`TypeError: object of type '${typeName(x)}' has no len()`);
}

/** `container[key]` on JSON data: a dict by key, a list or a string by integer index. */
export function gi(container: V, key: V): PyValue {
  if (isDict(container)) {
    hashable(key, "dict key");
    if (typeof key === "string" && container.has(key)) return container.get(key)!;
    throw new FitgapShapeError(`KeyError: ${pyRepr(key ?? null)}`);
  }
  if (isList(container) || typeof container === "string") {
    const items = isList(container) ? container : [...container];
    const what = isList(container) ? "list" : "string";
    if (typeof key !== "number" && typeof key !== "boolean" && typeof key !== "bigint") {
      throw new FitgapShapeError(isList(container) ? `TypeError: list indices must be integers or slices, not ${typeName(key)}` : `TypeError: string indices must be integers, not '${typeName(key)}'`);
    }
    let i = typeof key === "boolean" ? (key ? 1 : 0) : Number(key);
    if (i < 0) i += items.length;
    if (i < 0 || i >= items.length) throw new FitgapShapeError(`IndexError: ${what} index out of range`);
    return items[i]!;
  }
  throw new FitgapShapeError(`TypeError: '${typeName(container)}' object is not subscriptable`);
}

/** `d.get(key, fallback)` on JSON data (a non-string key is never there; an unhashable one is a `TypeError`). */
export function getOr(d: V, key: V, fallback: PyValue | undefined = undefined): V {
  if (!isDict(d)) throw new FitgapShapeError(`AttributeError: '${typeName(d)}' object has no attribute 'get'`);
  hashable(key, "dict key");
  return typeof key === "string" && d.has(key) ? d.get(key) : fallback;
}

/** `d[key] = value` on a dict from JSON. */
export function setItem(d: V, key: string, value: PyValue): void {
  if (!isDict(d)) throw new FitgapShapeError(isList(d) ? "TypeError: list indices must be integers or slices, not str" : `TypeError: '${typeName(d)}' object does not support item assignment`);
  d.set(key, value);
}

/** `d.setdefault(key, value)`. */
export function setDefault(d: V, key: string, value: PyValue): void {
  if (!isDict(d)) throw new FitgapShapeError(`AttributeError: '${typeName(d)}' object has no attribute 'setdefault'`);
  if (!d.has(key)) d.set(key, value);
}

/** `d.pop(key, None)`. */
export function popKey(d: V, key: string): void {
  if (!isDict(d)) throw new FitgapShapeError(`AttributeError: '${typeName(d)}' object has no attribute 'pop'`);
  d.delete(key);
}

/** `J = lambda v: ' | '.join(v) if v else ''`. */
export function joinBars(v: V): string {
  if (!truthy(v)) return "";
  if (typeof v !== "string" && !isList(v) && !isDict(v)) throw new FitgapShapeError("TypeError: can only join an iterable");
  return joinStr(" | ", iter(v));
}

/** `x.lower()` on a string. */
export function lower(x: V): string {
  if (typeof x !== "string") throw new FitgapShapeError(`AttributeError: '${typeName(x)}' object has no attribute 'lower'`);
  return x.toLowerCase();
}

/** `x.split(sep)` on a string. */
export function split(x: V, by: string): string[] {
  if (typeof x !== "string") throw new FitgapShapeError(`AttributeError: '${typeName(x)}' object has no attribute 'split'`);
  return x.split(by);
}

/** An f-string field with no format spec: `format(x, '')`, which is `str(x)`. */
export function f(x: V): string {
  return pyStr(x ?? null);
}

/** `a + b` on two lists. */
export function concat(a: V, b: V): PyValue[] {
  if (!isList(a) || !isList(b)) throw new FitgapShapeError(`TypeError: can only concatenate ${isList(a) ? "list" : typeName(a)} (not "${typeName(b)}") to ${isList(a) ? "list" : typeName(a)}`);
  return [...a, ...b];
}

/** `list.index(value)` (identity, then Python `==`). */
export function indexOf(list: readonly PyValue[], value: V): number {
  const i = list.findIndex((item) => pyEqualItem(item, value));
  if (i < 0) throw new FitgapShapeError(`ValueError: ${pyRepr(value ?? null)} is not in list`);
  return i;
}

/** The numeric value of a Unicode decimal digit (`\p{Nd}`): digits come in runs of ten from a zero. */
function digitValue(ch: string): number {
  let cp = ch.codePointAt(0)!;
  let start = cp;
  while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
  cp -= start;
  return cp % 10;
}

/**
 * The white space `int()` skips around the digits: ASCII space, tab, and
 * `\n \v \f \r` (`Py_ISSPACE`), and the non-ASCII white space of
 * `str.isspace`, which `int()` turns into a space first
 * (`_PyUnicode_TransformDecimalAndSpaceToASCII`). The ASCII separators
 * `\x1c` to `\x1f` are white space to `str.strip()` but not to `int()`.
 */
const INT_SPACE = "[\\t\\n\\v\\f\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
const INT_LITERAL = new RegExp(`^${INT_SPACE}*([+-]?)(\\p{Nd}+(?:_\\p{Nd}+)*)${INT_SPACE}*$`, "u");

/**
 * `int(text)`: Python's base-10 parse of a string (Python 3.14): white space
 * around it (`INT_SPACE`), a sign, Unicode decimal digits, `_` between
 * digits. A bad literal is the `ValueError` with the repr cut to 200
 * characters (`%.200R`); a good one of more than 4300 digits (leading zeros
 * counted, `_` not) is the `ValueError` of `sys.int_info.default_max_str_digits`.
 */
export function pyIntOf(value: V): bigint {
  if (value === null || value === undefined || isList(value) || isDict(value)) throw new FitgapShapeError(`TypeError: int() argument must be a string, a bytes-like object or a real number, not '${typeName(value)}'`);
  if (typeof value !== "string") throw new FitgapShapeError(`TypeError: int() can't convert ${typeName(value)} with an explicit base`);
  const m = INT_LITERAL.exec(value);
  if (m === null) throw new FitgapShapeError(`ValueError: invalid literal for int() with base 10: ${[...pyRepr(value)].slice(0, 200).join("")}`);
  const digits = [...m[2]!].filter((ch) => ch !== "_");
  if (digits.length > PY_INT_MAX_STR_DIGITS) throw new FitgapShapeError(`ValueError: Exceeds the limit (${PY_INT_MAX_STR_DIGITS} digits) for integer string conversion: value has ${digits.length} digits; use sys.set_int_max_str_digits() to increase the limit`);
  let n = 0n;
  for (const ch of digits) n = n * 10n + BigInt(digitValue(ch));
  return m[1] === "-" ? -n : n;
}

/** `os.path.dirname(path)` of this system's Python. */
export function pyDirname(path: string): string {
  const windows = sep === "\\";
  let drive = "";
  let rest = path;
  if (windows) {
    const unc = /^[\\/]{2}[^\\/]+[\\/][^\\/]+/.exec(path);
    const letter = /^[A-Za-z]:/.exec(path);
    drive = unc?.[0] ?? letter?.[0] ?? "";
    rest = path.slice(drive.length);
  }
  const isSep = (c: string): boolean => c === "/" || (windows && c === "\\");
  let i = rest.length;
  while (i > 0 && !isSep(rest[i - 1]!)) i--;
  let head = rest.slice(0, i);
  const trimmed = head.replace(windows ? /[\\/]+$/ : /\/+$/, "");
  if (trimmed !== "") head = trimmed;
  return drive + head;
}

/** A character that `str.encode('utf-8')` refuses: a lone surrogate. */
export const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Throws Python's `UnicodeEncodeError` when `text` (one `write` call) cannot
 * be written as UTF-8. Python's UTF-8 encoder reports the whole run of
 * consecutive surrogates from the first one (`can't encode characters in
 * position 2-3`), positions in code points (review round 2, finding 3).
 */
export function checkEncodable(text: string): void {
  const m = LONE_SURROGATE.exec(text);
  if (m === null) return;
  const points = [...text.slice(m.index)];
  const start = [...text.slice(0, m.index)].length;
  let end = 1;
  while (end < points.length && points[end]!.length === 1 && /[\uD800-\uDFFF]/.test(points[end]!)) end++;
  if (end === 1) throw new FitgapShapeError(`UnicodeEncodeError: 'utf-8' codec can't encode character '\\u${m[0].charCodeAt(0).toString(16)}' in position ${start}: surrogates not allowed`);
  throw new FitgapShapeError(`UnicodeEncodeError: 'utf-8' codec can't encode characters in position ${start}-${start + end - 1}: surrogates not allowed`);
}

/** stderr's `backslashreplace` for a lone surrogate (`sys.exit(message)`). */
export function backslashReplace(text: string): string {
  return text.replace(new RegExp(LONE_SURROGATE.source, "g"), (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);
}

export type { PyDict };
