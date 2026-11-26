/**
 * Go standard library text and path rules that the Go intake tool
 * (`toolkits/buildos-intake/`) relies on, so the port prints and names
 * files byte for byte as Go 1.24.1 does: `strings.Fields`,
 * `strings.TrimSpace`, `strings.ToLower`, `strings.EqualFold`,
 * `filepath.Rel`, `filepath.IsAbs`, `filepath.Ext`, `filepath.ToSlash`, and
 * `filepath.FromSlash`.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { goFoldRune, goIsSpace, goTrimSpace } from "../shared/go-json.ts";
import { goClean, goVolumeName, type GoPathPlatform } from "../shared/go-path.ts";

export { goTrimSpace };

/** Go `strings.Fields`: the runs between `unicode.IsSpace` runes. */
export function goFields(text: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const ch of text) {
    if (goIsSpace(ch.codePointAt(0)!)) {
      if (current !== "") out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current !== "") out.push(current);
  return out;
}

/** The Go intake `normalizeSpace`: `strings.Join(strings.Fields(s), " ")`. */
export function normalizeSpace(text: string): string {
  return goFields(text).join(" ");
}

/**
 * Go `unicode.ToLower` for one code point: the simple lower-case mapping.
 * JavaScript's `toLowerCase` uses full mappings; they differ only where the
 * full mapping has more than one code point (`İ` becomes `i̇` in JavaScript,
 * `i` in Go).
 */
function goLowerRune(ch: string): string {
  if (ch === "İ") return "i";
  const lower = ch.toLowerCase();
  return [...lower].length === 1 ? lower : ch;
}

/** Go `strings.ToLower`, rune by rune (no context-dependent final sigma). */
export function goToLower(text: string): string {
  let out = "";
  for (const ch of text) out += goLowerRune(ch);
  return out;
}

/** Go `strings.EqualFold`: equal under Unicode simple case folding. */
export function goEqualFold(a: string, b: string): boolean {
  const x = [...a];
  const y = [...b];
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) {
    const p = x[i]!.codePointAt(0)!;
    const q = y[i]!.codePointAt(0)!;
    if (p === q) continue;
    const fp = p < 0x80 ? (p >= 0x61 && p <= 0x7a ? p - 0x20 : p) : goFoldRune(p);
    const fq = q < 0x80 ? (q >= 0x61 && q <= 0x7a ? q - 0x20 : q) : goFoldRune(q);
    if (fp !== fq) return false;
  }
  return true;
}

const isSep = (platform: GoPathPlatform) => (c: string | undefined) => c === "/" || (platform === "win32" && c === "\\");

/** Go `filepath.IsAbs`. */
export function goIsAbs(path: string, platform: GoPathPlatform): boolean {
  if (platform === "posix") return path.startsWith("/");
  const sep = isSep("win32");
  const vol = goVolumeName(path, "win32");
  if (vol === "") return false;
  if (sep(path[0]) && sep(path[1])) return true;
  const rest = path.slice(vol.length);
  return rest !== "" && sep(rest[0]);
}

/** Go `filepath.Ext`: the suffix from the final dot of the last element, or `""`. */
export function goExt(path: string, platform: GoPathPlatform): string {
  const sep = isSep(platform);
  for (let i = path.length - 1; i >= 0 && !sep(path[i]); i--) {
    if (path[i] === ".") return path.slice(i);
  }
  return "";
}

/** Go `filepath.ToSlash`. */
export function goToSlash(path: string, platform: GoPathPlatform): string {
  return platform === "win32" ? path.replaceAll("\\", "/") : path;
}

/** Go `filepath.FromSlash`. */
export function goFromSlash(path: string, platform: GoPathPlatform): string {
  return platform === "win32" ? path.replaceAll("/", "\\") : path;
}

/** Go `filepath.Rel(base, target)`, or `undefined` for Go's error. */
export function goRel(basepath: string, targpath: string, platform: GoPathPlatform): string | undefined {
  const win = platform === "win32";
  const sepChar = win ? "\\" : "/";
  const same = (a: string, b: string) => (win ? goEqualFold(a, b) : a === b);
  const baseVol = goVolumeName(basepath, platform);
  const targVol = goVolumeName(targpath, platform);
  let base = goClean(basepath, platform);
  let targ = goClean(targpath, platform);
  if (same(targ, base)) return ".";
  base = base.slice(baseVol.length);
  targ = targ.slice(targVol.length);
  if (base === ".") base = "";
  else if (base === "" && baseVol.length > 2) base = sepChar;
  const baseSlashed = base.length > 0 && base[0] === sepChar;
  const targSlashed = targ.length > 0 && targ[0] === sepChar;
  if (baseSlashed !== targSlashed || !same(baseVol, targVol)) return undefined;
  const bl = base.length;
  const tl = targ.length;
  let b0 = 0;
  let bi = 0;
  let t0 = 0;
  let ti = 0;
  for (;;) {
    while (bi < bl && base[bi] !== sepChar) bi++;
    while (ti < tl && targ[ti] !== sepChar) ti++;
    if (!same(targ.slice(t0, ti), base.slice(b0, bi))) break;
    if (bi < bl) bi++;
    if (ti < tl) ti++;
    b0 = bi;
    t0 = ti;
  }
  if (base.slice(b0, bi) === "..") return undefined;
  if (b0 !== bl) {
    const seps = base.slice(b0, bl).split(sepChar).length - 1;
    let out = "..";
    for (let i = 0; i < seps; i++) out += `${sepChar}..`;
    if (t0 !== tl) out += sepChar + targ.slice(t0);
    return out;
  }
  return targ.slice(t0);
}

/** The Go intake `slugify`: lower-case ASCII letters and digits, other runs become one `-`. */
export function slugify(text: string, fallback: string): string {
  let out = "";
  let lastHyphen = false;
  for (const r of goToLower(text)) {
    if ((r >= "a" && r <= "z") || (r >= "0" && r <= "9")) {
      out += r;
      lastHyphen = false;
      continue;
    }
    if (!lastHyphen && out.length > 0) {
      out += "-";
      lastHyphen = true;
    }
  }
  out = out.replace(/^-+|-+$/g, "");
  return out === "" ? fallback : out;
}

/** Go `strconv.Atoi` for the decimal forms the intake tool reads: an optional sign and digits, within int64. */
export function goAtoi(text: string): number | undefined {
  if (!/^[+-]?[0-9]+$/.test(text)) return undefined;
  const value = BigInt(text);
  if (value > 9223372036854775807n || value < -9223372036854775808n) return undefined;
  return Number(value);
}

/** Go `strconv.Atoi` on a 64-bit platform, exact: the value as a `bigint`, or undefined for Go's error. */
export function goAtoiExact(text: string): bigint | undefined {
  if (!/^[+-]?[0-9]+$/.test(text)) return undefined;
  const value = BigInt(text);
  if (value > 9223372036854775807n || value < -9223372036854775808n) return undefined;
  return value;
}

/** Go `int` (64-bit) addition, which wraps on overflow. */
export function goIntAdd(a: bigint, b: bigint): bigint {
  return BigInt.asIntN(64, a + b);
}

/** Go `fmt.Sprintf("%03d", n)`: at least three characters, zeros after the sign. */
export function goPad3(n: bigint): string {
  const digits = (n < 0n ? -n : n).toString();
  const sign = n < 0n ? "-" : "";
  return sign + digits.padStart(3 - sign.length, "0");
}

/** UTF-8 bytes of a string. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Go `string(bytes)` read back as text: UTF-8, with U+FFFD for invalid bytes, and a byte order mark kept. */
export function utf8Text(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
}
