/**
 * The Go intake tool's small front matter reader (`parseFrontmatter`,
 * `parseBracketList`, `cleanFrontmatterValue` in `index.go`), with Go's
 * `strconv.Unquote` for double-quoted values.
 */

import { goDecodeRune } from "../../shared/go-json.ts";
import { goTrimSpace, utf8Bytes, utf8Text } from "../go-text.ts";

export interface FrontmatterFields {
  scalars: Map<string, string>;
  lists: Map<string, string[]>;
}

const unhex = (c: number): number | undefined => {
  if (c >= 0x30 && c <= 0x39) return c - 0x30;
  if (c >= 0x61 && c <= 0x66) return c - 0x61 + 10;
  if (c >= 0x41 && c <= 0x46) return c - 0x41 + 10;
  return undefined;
};

const validRune = (r: number) => r >= 0 && r <= 0x10ffff && !(r >= 0xd800 && r <= 0xdfff);

/** Go `strconv.Unquote` for a double-quoted literal, or undefined for `ErrSyntax`. */
export function goUnquoteDouble(literal: string): string | undefined {
  const s = utf8Bytes(literal);
  if (s.length < 2 || s[0] !== 0x22) return undefined;
  const QUOTE = 0x22;
  const end = s.indexOf(QUOTE, 1);
  if (end < 0) return undefined;
  const inner = s.subarray(1, end);
  // Fast path: no escape and no line break before the first closing quote.
  if (!inner.includes(0x5c) && !inner.includes(0x0a)) {
    let valid = true;
    for (let i = 0; i < inner.length; ) {
      const [r, size] = goDecodeRune(inner, i);
      if (r === 0xfffd && size === 1) valid = false;
      i += size;
    }
    if (valid) return end + 1 === s.length ? literal.slice(1, -1) : undefined;
  }
  const out: number[] = [];
  let i = 1;
  while (i < s.length && s[i] !== QUOTE) {
    const c = s[i]!;
    if (c === 0x0a) return undefined;
    if (c >= 0x80) {
      const [, size] = goDecodeRune(s, i);
      for (let k = 0; k < size; k++) out.push(s[i + k]!);
      i += size;
      continue;
    }
    if (c !== 0x5c) {
      out.push(c);
      i++;
      continue;
    }
    if (i + 1 >= s.length) return undefined;
    const e = s[i + 1]!;
    i += 2;
    const simple: Record<number, number> = { 0x61: 7, 0x62: 8, 0x66: 12, 0x6e: 10, 0x72: 13, 0x74: 9, 0x76: 11, 0x5c: 0x5c, 0x22: 0x22 };
    if (e in simple) {
      out.push(simple[e]!);
    } else if (e === 0x78 || e === 0x75 || e === 0x55) {
      const n = e === 0x78 ? 2 : e === 0x75 ? 4 : 8;
      if (i + n > s.length) return undefined;
      let v = 0;
      for (let j = 0; j < n; j++) {
        const x = unhex(s[i + j]!);
        if (x === undefined) return undefined;
        v = v * 16 + x;
      }
      i += n;
      if (e === 0x78) {
        out.push(v);
      } else {
        if (!validRune(v)) return undefined;
        out.push(...utf8Bytes(String.fromCodePoint(v)));
      }
    } else if (e >= 0x30 && e <= 0x37) {
      let v = e - 0x30;
      if (i + 2 > s.length) return undefined;
      for (let j = 0; j < 2; j++) {
        const x = s[i + j]! - 0x30;
        if (x < 0 || x > 7) return undefined;
        v = (v << 3) | x;
      }
      i += 2;
      if (v > 255) return undefined;
      out.push(v);
    } else {
      return undefined;
    }
  }
  if (i >= s.length || s[i] !== QUOTE || i + 1 !== s.length) return undefined;
  return utf8Text(Uint8Array.from(out));
}

/** Go `cleanFrontmatterValue`. */
export function cleanFrontmatterValue(value: string): string {
  value = goTrimSpace(value);
  const bytes = utf8Bytes(value).length;
  if (bytes >= 2 && value.startsWith('"') && value.endsWith('"')) {
    const unquoted = goUnquoteDouble(value);
    if (unquoted !== undefined) return unquoted;
  }
  if (bytes >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

/** Go `parseBracketList`. */
function parseBracketList(value: string): string[] | undefined {
  if (!value.startsWith("[") || !value.endsWith("]")) return undefined;
  let inner = value.slice(1);
  if (inner.endsWith("]")) inner = inner.slice(0, -1);
  inner = goTrimSpace(inner);
  if (inner === "") return [];
  const values: string[] = [];
  for (const raw of inner.split(",")) {
    const part = cleanFrontmatterValue(raw);
    if (part !== "") values.push(part);
  }
  return values;
}

/** Go `parseFrontmatter`: the fields, or undefined when the text has no front matter block. */
export function parseFrontmatter(text: string): FrontmatterFields | undefined {
  text = text.replaceAll("\r\n", "\n");
  if (!text.startsWith("---\n")) return undefined;
  const end = text.slice(4).indexOf("\n---");
  if (end < 0) return undefined;
  const block = text.slice(4, 4 + end);
  const fields: FrontmatterFields = { scalars: new Map(), lists: new Map() };
  let currentListKey = "";
  for (let line of block.split("\n")) {
    line = goTrimSpace(line);
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("- ") && currentListKey !== "") {
      fields.lists.get(currentListKey)!.push(cleanFrontmatterValue(goTrimSpace(line.slice(2))));
      continue;
    }
    currentListKey = "";
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = goTrimSpace(line.slice(0, colon));
    const value = goTrimSpace(line.slice(colon + 1));
    const list = parseBracketList(value);
    if (list !== undefined) {
      fields.lists.set(key, list);
      continue;
    }
    if (value === "") {
      fields.lists.set(key, []);
      currentListKey = key;
      continue;
    }
    fields.scalars.set(key, cleanFrontmatterValue(value));
  }
  return fields;
}
