/**
 * Python value semantics that `fitgap.py` relies on (W1 R7 P9 t5): dict and
 * attribute access that fails as Python does (a `KeyError` or a `TypeError`
 * the script did not catch becomes a `FitgapShapeError`), truthiness,
 * `str()`, f-string width formatting, `sum` (Python 3.12 and later add
 * floats with compensation), `round`, comparison for `sorted`, and the
 * repr of the counters the script prints.
 */

import { isDict, isList, isPyNumber, PyFloat, pyFloatRepr, pyNumber, pyRepr, pyStr, pyStrip, pyLen, type PyDict, type PyValue } from "../shared/py-json.ts";

export type V = PyValue | undefined;

/** The script stopped with a Python error it did not catch (a traceback). `pyText` is its last line. */
export class FitgapShapeError extends Error {
  readonly pyText: string;
  constructor(pyText: string) {
    super(pyText);
    this.name = "FitgapShapeError";
    this.pyText = pyText;
  }
}

export function typeName(value: V): string {
  if (value === null || value === undefined) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number" || typeof value === "bigint") return "int";
  if (value instanceof PyFloat) return "float";
  if (typeof value === "string") return "str";
  if (isList(value)) return "list";
  return "dict";
}

/** `d[key]` on a dict. */
export function idx(d: V, key: string): PyValue {
  if (!isDict(d)) {
    if (isList(d)) throw new FitgapShapeError("TypeError: list indices must be integers or slices, not str");
    if (typeof d === "string") throw new FitgapShapeError("TypeError: string indices must be integers, not 'str'");
    throw new FitgapShapeError(`TypeError: '${typeName(d)}' object is not subscriptable`);
  }
  if (!d.has(key)) throw new FitgapShapeError(`KeyError: ${pyRepr(key)}`);
  return d.get(key)!;
}

/** `d.get(key)` (and `d.get(key, fallback)`); a non-dict is an `AttributeError`. */
export function get(d: V, key: string, fallback: PyValue | undefined = undefined): V {
  if (!isDict(d)) throw new FitgapShapeError(`AttributeError: '${typeName(d)}' object has no attribute 'get'`);
  return d.has(key) ? d.get(key) : fallback;
}

/** `d.get(key)` that is `None` when missing. */
export function getN(d: V, key: string): PyValue {
  return get(d, key) ?? null;
}

export function truthy(value: V): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === 0n || value === "") return false;
  if (value instanceof PyFloat) return value.value !== 0;
  if (isList(value)) return value.length > 0;
  if (isDict(value)) return value.size > 0;
  return true;
}

/** `a or b`. */
export function or(a: V, b: PyValue): PyValue {
  return truthy(a) ? a! : b;
}

/** `(value or '').strip()`: a truthy non-string is an `AttributeError`. */
export function stripOrEmpty(value: V): string {
  const v = or(value, "");
  if (typeof v !== "string") throw new FitgapShapeError(`AttributeError: '${typeName(v)}' object has no attribute 'strip'`);
  return pyStrip(v);
}

/** `value.strip()` on a value that must be a string. */
export function strip(value: V): string {
  if (typeof value !== "string") throw new FitgapShapeError(`AttributeError: '${typeName(value)}' object has no attribute 'strip'`);
  return pyStrip(value);
}

/** Python iteration of a value. */
export function iter(value: V): PyValue[] {
  if (isList(value)) return value;
  if (isDict(value)) return [...value.keys()];
  if (typeof value === "string") return [...value];
  throw new FitgapShapeError(`TypeError: '${typeName(value)}' object is not iterable`);
}

/** A hashable key for a dict or set lookup (`TypeError` for a list or a dict). Python's `1`, `1.0`, and `True` are one key. */
export function hashKey(value: V): string {
  if (isList(value)) throw new FitgapShapeError("TypeError: unhashable type: 'list'");
  if (isDict(value)) throw new FitgapShapeError("TypeError: unhashable type: 'dict'");
  if (value === undefined || value === null) return "None";
  if (typeof value === "string") return `s${value}`;
  if (isPyNumber(value)) return `n${pyNumber(value)}`;
  return `?${String(value)}`;
}

/** `str(value)`. */
export function str(value: V): string {
  return pyStr(value ?? null);
}

/** `split_list(v)`: a list as it is, else the `|`-separated parts of a string. */
export function splitList(value: V): PyValue[] {
  if (isList(value)) return value;
  const text = or(value, "");
  if (typeof text !== "string") throw new FitgapShapeError(`AttributeError: '${typeName(text)}' object has no attribute 'split'`);
  return text
    .split("|")
    .map((x) => pyStrip(x))
    .filter((x) => x !== "");
}

/** `' | '.join(v) if v else ''`. */
export function joinBar(value: PyValue[]): string {
  return value.length > 0 ? joinStr(" | ", value) : "";
}

/** `sep.join(items)`: every item must be a string. */
export function joinStr(sep: string, items: readonly PyValue[]): string {
  items.forEach((item, i) => {
    if (typeof item !== "string") throw new FitgapShapeError(`TypeError: sequence item ${i}: expected str instance, ${typeName(item)} found`);
  });
  return items.join(sep);
}

/** `format(value, spec)` for the f-string widths the script uses (`8`, `5`, `3`, `14`, ...). */
export function fmt(value: V, width: number): string {
  if (value === null || value === undefined) throw new FitgapShapeError("TypeError: unsupported format string passed to NoneType.__format__");
  if (typeof value === "string") return value + " ".repeat(Math.max(0, width - pyLen(value)));
  if (isPyNumber(value)) {
    const text = typeof value === "boolean" ? (value ? "1" : "0") : value instanceof PyFloat ? pyFloatRepr(value.value) : String(value);
    return " ".repeat(Math.max(0, width - text.length)) + text;
  }
  throw new FitgapShapeError(`TypeError: unsupported format string passed to ${typeName(value)}.__format__`);
}

/** A Python number result: an `int` (`number`) or a `float` (`PyFloat`). */
export type Num = number | PyFloat;

/** `sum(values)`: ints exactly; from the first float on, Neumaier-compensated float addition (Python 3.12 and later). */
export function pySum(values: readonly V[]): Num {
  let intTotal = 0;
  let i = 0;
  for (; i < values.length; i++) {
    const v = values[i];
    if (v instanceof PyFloat) break;
    if (!isPyNumber(v)) throw new FitgapShapeError(`TypeError: unsupported operand type(s) for +: 'int' and '${typeName(v)}'`);
    intTotal += pyNumber(v);
  }
  if (i === values.length) return intTotal;
  let total = intTotal;
  let c = 0;
  for (; i < values.length; i++) {
    const v = values[i];
    if (!isPyNumber(v)) throw new FitgapShapeError(`TypeError: unsupported operand type(s) for +: 'float' and '${typeName(v)}'`);
    const x = pyNumber(v);
    const t = total + x;
    if (Math.abs(total) >= Math.abs(x)) c += total - t + x;
    else c += x - t + total;
    total = t;
  }
  if (c !== 0 && Number.isFinite(c)) total += c;
  return new PyFloat(total);
}

export function num(value: Num | V): number {
  return pyNumber(value as PyValue);
}

/** Python's `round(x)` (half to even), an `int`. */
export function pyRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Python `<` for the values `sorted` compares: numbers, strings, `None` is a `TypeError`, tuples element by element. */
export function pyCompare(a: unknown, b: unknown): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = pyCompare(a[i], b[i]);
      if (c !== 0) return c;
    }
    return a.length - b.length;
  }
  const isNum = (x: unknown): boolean => isPyNumber(x as PyValue);
  if (isNum(a) && isNum(b)) {
    const x = pyNumber(a as PyValue);
    const y = pyNumber(b as PyValue);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === "string" && typeof b === "string") {
    const xa = [...a];
    const xb = [...b];
    for (let i = 0; i < Math.min(xa.length, xb.length); i++) {
      const d = xa[i]!.codePointAt(0)! - xb[i]!.codePointAt(0)!;
      if (d !== 0) return d < 0 ? -1 : 1;
    }
    return xa.length - xb.length;
  }
  if (pyEqualsLoose(a, b)) return 0;
  throw new FitgapShapeError(`TypeError: '<' not supported between instances of '${typeName(a as V)}' and '${typeName(b as V)}'`);
}

function pyEqualsLoose(a: unknown, b: unknown): boolean {
  return a === b;
}

/** `sorted(items, key=key)`: stable. */
export function sortedBy<T>(items: readonly T[], key: (item: T) => unknown): T[] {
  const keyed = items.map((item, i) => ({ item, k: key(item), i }));
  keyed.sort((x, y) => pyCompare(x.k, y.k) || x.i - y.i);
  return keyed.map((x) => x.item);
}

/** `x in list` (Python `==`). */
export function inList(value: V, list: readonly PyValue[]): boolean {
  return list.some((item) => pyEq(item, value));
}

/** Python `==` on JSON data. */
export function pyEq(a: V, b: V): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (isPyNumber(a) && isPyNumber(b)) return pyNumber(a) === pyNumber(b);
  if (typeof a === "string" || typeof b === "string" || a === null || b === null) return a === b;
  if (isList(a)) return isList(b) && a.length === b.length && a.every((x, i) => pyEq(x, b[i]));
  if (isDict(a)) {
    if (!isDict(b) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !pyEq(v, b.get(k))) return false;
    return true;
  }
  return false;
}

/** The repr of a dict whose keys may be any value (a `Counter` of objective weights, for example). */
export function reprPairs(pairs: readonly [PyValue, PyValue][]): string {
  return `{${pairs.map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`).join(", ")}}`;
}

/** The repr of a dict of string keys. */
export function reprDict(d: PyDict): string {
  return pyRepr(d);
}

/** A dict from pairs. */
export function dict(pairs: [string, PyValue][]): PyDict {
  return new Map(pairs);
}
