/**
 * Small ports of Go standard library text and path behavior that the
 * discovery and design ports print or write: `strings.ToLower`,
 * `bytes.TrimSpace`, `bytes.Contains`, `filepath.IsAbs`, `filepath.FromSlash`,
 * `filepath.ToSlash`, `filepath.Rel`, and `fmt`'s `%v` of a `[]string`.
 * Each follows Go 1.24.1.
 */

import { goCompare, goDecodeRune, goEncodeString, goFoldName, goIsSpace, utf8, type GoJsonValue } from "./go-json.ts";
import { goClean, goVolumeName, type GoPathPlatform } from "./go-path.ts";

/** Go `unicode.ToLower` of one code point. JavaScript's full mapping differs only for U+0130, which Go maps to `i`. */
function lowerRune(cp: number): number {
  if (cp < 0x80) return cp >= 0x41 && cp <= 0x5a ? cp + 0x20 : cp;
  if (cp === 0x130) return 0x69;
  const lower = String.fromCodePoint(cp).toLowerCase();
  const first = lower.codePointAt(0)!;
  return lower.length === String.fromCodePoint(first).length ? first : cp;
}

/** Go `strings.ToLower`: one simple mapping per code point, with no context rules. */
export function goToLower(text: string): string {
  let out = "";
  for (const ch of text) out += String.fromCodePoint(lowerRune(ch.codePointAt(0)!));
  return out;
}

/** Go `bytes.TrimSpace`: drops leading and trailing Unicode white space. Invalid UTF-8 is not space. */
export function goTrimSpaceBytes(b: Uint8Array): Uint8Array {
  let start = 0;
  while (start < b.length) {
    const [r, size] = goDecodeRune(b, start);
    if (!goIsSpace(r) || (r === 0xfffd && size === 1)) break;
    start += size;
  }
  let end = b.length;
  while (end > start) {
    // Step back to the start of the last rune.
    let k = end - 1;
    while (k > start && (b[k]! & 0xc0) === 0x80 && end - k < 4) k--;
    const [r, size] = goDecodeRune(b, k);
    if (k + size !== end || !goIsSpace(r) || (r === 0xfffd && size === 1)) break;
    end = k;
  }
  return b.slice(start, end);
}

/** Go `bytes.Contains(haystack, needle)`. */
export function goBytesContains(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0) return true;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Go `strings.Contains(string(data), text)` on the bytes of `data`. */
export function goContainsText(data: Uint8Array, text: string): boolean {
  return goBytesContains(data, utf8(text));
}

/** Go `fmt.Sprint([]string)` (`%v`): `[a b c]`; a nil or empty slice is `[]`. */
export function goSprintStrings(values: readonly string[] | null): string {
  return `[${(values ?? []).join(" ")}]`;
}

/** Go `filepath.IsAbs` for `platform`. */
export function goIsAbs(path: string, platform: GoPathPlatform): boolean {
  if (platform === "posix") return path.startsWith("/");
  const vol = goVolumeName(path, "win32").length;
  if (vol === 0) return false;
  if (isWinSep(path[0]) && isWinSep(path[1])) return true;
  const rest = path.slice(vol);
  return rest !== "" && isWinSep(rest[0]);
}

/** Go `filepath.FromSlash`. */
export function goFromSlash(path: string, platform: GoPathPlatform): string {
  return platform === "win32" ? path.replaceAll("/", "\\") : path;
}

/** Go `filepath.ToSlash`. */
export function goToSlash(path: string, platform: GoPathPlatform): string {
  return platform === "win32" ? path.replaceAll("\\", "/") : path;
}

function isWinSep(c: string | undefined): boolean {
  return c === "\\" || c === "/";
}

/** Go's `sameWord`: exact on POSIX, `strings.EqualFold` on Windows. */
function sameWord(a: string, b: string, platform: GoPathPlatform): boolean {
  return platform === "win32" ? a === b || goFoldName(a) === goFoldName(b) : a === b;
}

/**
 * Go `filepath.Rel(basepath, targpath)` for `platform`: the lexical relative
 * path, or `undefined` where Go returns an error.
 */
export function goRel(basepath: string, targpath: string, platform: GoPathPlatform): string | undefined {
  const sep = platform === "win32" ? "\\" : "/";
  const baseVol = goVolumeName(basepath, platform);
  const targVol = goVolumeName(targpath, platform);
  let base = goClean(basepath, platform);
  let targ = goClean(targpath, platform);
  if (sameWord(targ, base, platform)) return ".";
  base = base.slice(baseVol.length);
  targ = targ.slice(targVol.length);
  if (base === ".") base = "";
  else if (base === "" && baseVol.length > 2) base = sep;
  const baseSlashed = base.length > 0 && base[0] === sep;
  const targSlashed = targ.length > 0 && targ[0] === sep;
  if (baseSlashed !== targSlashed || !sameWord(baseVol, targVol, platform)) return undefined;
  const bl = base.length;
  const tl = targ.length;
  let b0 = 0;
  let bi = 0;
  let t0 = 0;
  let ti = 0;
  for (;;) {
    while (bi < bl && base[bi] !== sep) bi++;
    while (ti < tl && targ[ti] !== sep) ti++;
    if (!sameWord(targ.slice(t0, ti), base.slice(b0, bi), platform)) break;
    if (bi < bl) bi++;
    if (ti < tl) ti++;
    b0 = bi;
    t0 = ti;
  }
  if (base.slice(b0, bi) === "..") return undefined;
  if (b0 !== bl) {
    const seps = base.slice(b0, bl).split(sep).length - 1;
    let out = "..";
    for (let i = 0; i < seps; i++) out += `${sep}..`;
    if (t0 !== tl) out += sep + targ.slice(t0);
    return out;
  }
  return targ.slice(t0);
}

/**
 * Go `json.Marshal(v)` (compact, HTML escaped) for a value in the
 * `GoJsonValue` shape: a plain object is a struct (fields in order, an
 * `undefined` field left out, as `omitempty`), a `Map` is a Go map (keys in
 * Go's sorted order), and `null` is a nil slice, map, or pointer.
 */
export function goMarshal(value: GoJsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return goEncodeString(value, true);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map((item) => goMarshal(item as GoJsonValue)).join(",")}]`;
  if (value instanceof Map) {
    const map = value as ReadonlyMap<string, GoJsonValue>;
    return `{${[...map.keys()].sort(goCompare).map((key) => `${goEncodeString(key, true)}:${goMarshal(map.get(key)!)}`).join(",")}}`;
  }
  const entries = Object.entries(value as Record<string, GoJsonValue | undefined>).filter((entry): entry is [string, GoJsonValue] => entry[1] !== undefined);
  return `{${entries.map(([key, item]) => `${goEncodeString(key, true)}:${goMarshal(item)}`).join(",")}}`;
}

/** Go `time.Now().UTC().Format(time.RFC3339)` for `date`. */
export function goRfc3339Utc(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

/** Go `time.Now().Format("2006-01-02")` in the local time zone (`TZ`). */
export function goLocalDate(date: Date): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/**
 * The lines Go's `bufio.Scanner` with `ScanLines` and the default 64 KiB
 * buffer yields from `data`, without the newline and one carriage return
 * before it, each with its 1-based number. `tooLong` is true when the
 * scanner stops after these lines with `bufio.Scanner: token too long`.
 */
export function goScanLines(data: Uint8Array, maxToken = 64 * 1024): { lines: { number: number; bytes: Uint8Array }[]; tooLong: boolean } {
  const lines: { number: number; bytes: Uint8Array }[] = [];
  let at = 0;
  while (at < data.length) {
    let end = data.indexOf(0x0a, at);
    const terminated = end !== -1;
    if (!terminated) end = data.length;
    if (end - at >= maxToken) return { lines, tooLong: true };
    let payloadEnd = end;
    if (payloadEnd > at && data[payloadEnd - 1] === 0x0d) payloadEnd--;
    lines.push({ number: lines.length + 1, bytes: data.slice(at, payloadEnd) });
    at = terminated ? end + 1 : end;
  }
  return { lines, tooLong: false };
}

/** The error text of `bufio.ErrTooLong`. */
export const GO_SCANNER_TOO_LONG = "bufio.Scanner: token too long";
