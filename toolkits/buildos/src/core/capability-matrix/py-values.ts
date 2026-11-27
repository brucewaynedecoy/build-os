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
 */

import { sep } from "node:path";
import { isDict, isList, PyFloat, pyFloatRepr, pyJsonString, pyRepr, pyStr, pyStrip, type PyDict, type PyValue } from "../shared/py-json.ts";
import { FitgapShapeError, hashKey, iter, joinStr, pyEq, truthy, typeName, type V } from "../fitgap/py.ts";

/** A Python `dict` or `set` keyed by any hashable value, in insertion order (a repeated key keeps its first key and place). */
export class PyMap<T> {
  private readonly items = new Map<string, { key: PyValue; value: T }>();

  set(key: V, value: T): void {
    const k = hashKey(key);
    const found = this.items.get(k);
    if (found !== undefined) found.value = value;
    else this.items.set(k, { key: key ?? null, value });
  }

  has(key: V): boolean {
    return this.items.has(hashKey(key));
  }

  get(key: V): T | undefined {
    return this.items.get(hashKey(key))?.value;
  }

  /** `d[key]`: a `KeyError` with the key's repr when it is missing. */
  at(key: V): T {
    const found = this.items.get(hashKey(key));
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
    super();
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
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
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

/** `json.dump(o, f, indent=1, ensure_ascii=False)` (no final line break), with `PyPairs` dicts. */
export function cmDumps(value: JsonOut): string {
  const indent = 1;
  const wrap = (open: string, close: string, items: string[], level: number): string => {
    const inner = "\n" + " ".repeat(indent * (level + 1));
    const outer = "\n" + " ".repeat(indent * level);
    return `${open}${inner}${items.join("," + inner)}${outer}${close}`;
  };
  const encode = (v: JsonOut, level: number): string => {
    if (v === null) return "null";
    if (v === true) return "true";
    if (v === false) return "false";
    if (typeof v === "number" || typeof v === "bigint") return String(v);
    if (v instanceof PyFloat) return floatJson(v.value);
    if (typeof v === "string") return pyJsonString(v, false);
    if (Array.isArray(v)) return v.length === 0 ? "[]" : wrap("[", "]", v.map((x) => encode(x, level + 1)), level);
    const pairs: [string, JsonOut][] = v instanceof PyPairs ? v.pairs.map(([k, x]) => [jsonKey(k), x]) : [...v];
    if (pairs.length === 0) return "{}";
    return wrap("{", "}", pairs.map(([k, x]) => `${pyJsonString(k, false)}: ${encode(x, level + 1)}`), level);
  };
  return encode(value, 0);
}

/** True when `value` is hashable (not a list or a dict). */
function hashable(value: V): void {
  hashKey(value);
}

/** `x in container`. */
export function pyIn(x: V, container: V | PyMap<unknown>): boolean {
  if (container instanceof PyMap) return container.has(x);
  if (isDict(container)) {
    hashable(x);
    return typeof x === "string" && container.has(x);
  }
  if (isList(container)) return container.some((item) => pyEq(item, x));
  if (typeof container === "string") {
    if (typeof x !== "string") throw new FitgapShapeError(`TypeError: 'in <string>' requires string as left operand, not ${typeName(x)}`);
    return container.includes(x);
  }
  throw new FitgapShapeError(`TypeError: argument of type '${typeName(container)}' is not iterable`);
}

/** `x in {fixed set of strings}` (`TYPES`, `KINDS`, ...): an unhashable value is a `TypeError`. */
export function inStrings(x: V, set: ReadonlySet<string>): boolean {
  hashable(x);
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
    hashable(key);
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
  hashable(key);
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

/** `list.index(value)` (Python `==`). */
export function indexOf(list: readonly PyValue[], value: V): number {
  const i = list.findIndex((item) => pyEq(item, value));
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

/** `int(text)`: Python's base-10 parse of a string (white space, a sign, Unicode digits, `_` between digits). */
export function pyIntOf(value: V): bigint {
  if (value === null || value === undefined || isList(value) || isDict(value)) throw new FitgapShapeError(`TypeError: int() argument must be a string, a bytes-like object or a real number, not '${typeName(value)}'`);
  if (typeof value !== "string") throw new FitgapShapeError(`TypeError: int() can't convert ${typeName(value)} with an explicit base`);
  const text = pyStrip(value);
  const m = /^([+-]?)(\p{Nd}+(?:_\p{Nd}+)*)$/u.exec(text);
  if (m === null) throw new FitgapShapeError(`ValueError: invalid literal for int() with base 10: ${pyRepr(value)}`);
  let n = 0n;
  for (const ch of m[2]!) if (ch !== "_") n = n * 10n + BigInt(digitValue(ch));
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

/** Throws Python's `UnicodeEncodeError` when `text` cannot be written as UTF-8. */
export function checkEncodable(text: string): void {
  const m = LONE_SURROGATE.exec(text);
  if (m === null) return;
  const position = [...text.slice(0, m.index)].length;
  throw new FitgapShapeError(`UnicodeEncodeError: 'utf-8' codec can't encode character '\\u${m[0].charCodeAt(0).toString(16)}' in position ${position}: surrogates not allowed`);
}

/** stderr's `backslashreplace` for a lone surrogate (`sys.exit(message)`). */
export function backslashReplace(text: string): string {
  return text.replace(new RegExp(LONE_SURROGATE.source, "g"), (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);
}

export type { PyDict };
