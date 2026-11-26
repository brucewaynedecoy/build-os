/**
 * Go's `filepath.Abs` and `filepath.Clean`, ported for root spelling parity
 * with the Go seed (PRD 20 Compatibility). The seed reports a root as
 * `filepath.Clean(filepath.Abs(root))`, so BuildOS reports it the same way.
 *
 * These are text rules only. They never read the disk and never follow a
 * symlink: `link/..` folds to the folder that holds `link`, as in Go.
 *
 * Ported from Go 1.24.1 `internal/filepathlite` (`Clean`, `lazybuf`,
 * `postClean`, `volumeNameLen`). Go works on bytes of UTF-8 and this code
 * works on UTF-16 code units. Every index, length, and slice here is in
 * code units; never split a path by code point (`[...s]`, `for...of` on a
 * string), because a non-BMP character is two code units and the indexes
 * would no longer agree. Every rule tests only ASCII characters, and an
 * ASCII character is one unit in both encodings, so the result is the same,
 * except for the drive-letter test, which needs one ASCII character before
 * the `:` (a non-ASCII first character is more than one byte in Go).
 *
 * On Windows, Go's `Abs` is `Clean(GetFullPathNameW(path))`; see
 * `win32FullPath` for the Win32 rules this port follows and the cases it
 * does not cover.
 */

export type GoPathPlatform = "posix" | "win32";

/** `filepath.Abs` for `platform`, with `cwd` as the current folder. Never empty when `cwd` is absolute. */
export function goAbs(path: string, cwd: string, platform: GoPathPlatform): string {
  if (platform === "posix") {
    // unixAbs: Clean(path) when absolute, else Join(cwd, path).
    if (path.startsWith("/")) return goClean(path, "posix");
    return goJoin(cwd, path, "posix");
  }
  return goClean(win32FullPath(path === "" ? "." : path, cwd), "win32");
}

/** `filepath.Join(a, b)`: empty elements are skipped, and the result is cleaned. */
function goJoin(a: string, b: string, platform: GoPathPlatform): string {
  if (a === "" && b === "") return "";
  if (a === "") return goClean(b, platform);
  return goClean(`${a}${platform === "posix" ? "/" : "\\"}${b}`, platform);
}

/** `filepath.Join(elem...)` for `platform`: empty elements are skipped, and the result is cleaned. */
export function goJoinAll(platform: GoPathPlatform, ...elements: string[]): string {
  const parts = elements.filter((e) => e !== "");
  if (parts.length === 0) return "";
  return goClean(parts.join(platform === "posix" ? "/" : "\\"), platform);
}

/** `filepath.Dir` for `platform`. */
export function goDir(path: string, platform: GoPathPlatform): string {
  const vol = platform === "win32" ? volumeNameLen(path) : 0;
  const isSep = platform === "win32" ? isWinSep : (c: string | undefined) => c === "/";
  let i = path.length - 1;
  while (i >= vol && !isSep(path[i])) i--;
  const dir = goClean(path.slice(vol, i + 1), platform);
  if (dir === "." && vol > 2) return path.slice(0, vol);
  return path.slice(0, vol) + dir;
}

/** `filepath.Base` for `platform`. */
export function goBase(path: string, platform: GoPathPlatform): string {
  if (path === "") return ".";
  const isSep = platform === "win32" ? isWinSep : (c: string | undefined) => c === "/";
  while (path.length > 0 && isSep(path.at(-1))) path = path.slice(0, -1);
  if (platform === "win32") path = path.slice(volumeNameLen(path));
  let i = path.length - 1;
  while (i >= 0 && !isSep(path[i])) i--;
  if (i >= 0) path = path.slice(i + 1);
  if (path === "") return platform === "win32" ? "\\" : "/";
  return path;
}

/** `filepath.VolumeName` for `platform`: `""` on POSIX. */
export function goVolumeName(path: string, platform: GoPathPlatform): string {
  return platform === "win32" ? path.slice(0, volumeNameLen(path)) : "";
}

/** `filepath.Clean` for `platform`. */
export function goClean(path: string, platform: GoPathPlatform): string {
  const win = platform === "win32";
  const sep = win ? "\\" : "/";
  const isSep = win ? isWinSep : (c: string | undefined) => c === "/";
  const fromSlash = (s: string) => (win ? s.replaceAll("/", "\\") : s);

  const original = path;
  const volLen = win ? volumeNameLen(path) : 0;
  path = path.slice(volLen);
  if (path === "") {
    if (volLen > 1 && isSep(original[0]) && isSep(original[1])) return fromSlash(original);
    return original + ".";
  }
  const rooted = isSep(path[0]);
  const n = path.length;
  const out = new LazyBuf(path, original, volLen);
  let r = 0;
  let dotdot = 0;
  if (rooted) {
    out.append(sep);
    r = 1;
    dotdot = 1;
  }
  while (r < n) {
    if (isSep(path[r])) {
      r++;
    } else if (path[r] === "." && (r + 1 === n || isSep(path[r + 1]))) {
      r++;
    } else if (path[r] === "." && path[r + 1] === "." && (r + 2 === n || isSep(path[r + 2]))) {
      r += 2;
      if (out.w > dotdot) {
        out.w--;
        while (out.w > dotdot && !isSep(out.index(out.w))) out.w--;
      } else if (!rooted) {
        if (out.w > 0) out.append(sep);
        out.append(".");
        out.append(".");
        dotdot = out.w;
      }
    } else {
      if ((rooted && out.w !== 1) || (!rooted && out.w !== 0)) out.append(sep);
      for (; r < n && !isSep(path[r]); r++) out.append(path[r]!);
    }
  }
  if (out.w === 0) out.append(".");
  if (win) postClean(out);
  return fromSlash(out.toString());
}

/** Go's `lazybuf`: copies `path` only once the output differs from it. */
class LazyBuf {
  buf: string[] | undefined;
  w = 0;
  readonly path: string;
  readonly volAndPath: string;
  readonly volLen: number;
  constructor(path: string, volAndPath: string, volLen: number) {
    this.path = path;
    this.volAndPath = volAndPath;
    this.volLen = volLen;
  }

  index(i: number): string {
    return this.buf !== undefined ? this.buf[i]! : this.path[i]!;
  }

  append(c: string): void {
    if (this.buf === undefined) {
      if (this.w < this.path.length && this.path[this.w] === c) {
        this.w++;
        return;
      }
      // Go: make([]byte, len(path)), zero-filled past the copied prefix.
      this.buf = Array.from({ length: this.path.length }, (_, i) => (i < this.w ? this.path[i]! : "\0"));
    }
    this.buf[this.w] = c;
    this.w++;
  }

  prepend(...prefix: string[]): void {
    this.buf = [...prefix, ...(this.buf ?? [])];
    this.w += prefix.length;
  }

  toString(): string {
    if (this.buf === undefined) return this.volAndPath.slice(0, this.volLen + this.w);
    return this.volAndPath.slice(0, this.volLen) + this.buf.slice(0, this.w).join("");
  }
}

function isWinSep(c: string | undefined): boolean {
  return c === "\\" || c === "/";
}

/** Windows `postClean`: keeps a cleaned relative path from turning into a volume or `\??\` path. */
function postClean(out: LazyBuf): void {
  if (out.volLen !== 0 || out.buf === undefined) return;
  // Go ranges over the whole buffer, past `w` too.
  for (const c of out.buf) {
    if (isWinSep(c)) break;
    if (c === ":") {
      out.prepend(".", "\\");
      return;
    }
  }
  if (out.buf.length >= 3 && isWinSep(out.buf[0]) && out.buf[1] === "?" && out.buf[2] === "?") out.prepend("\\", ".");
}

/** Windows `volumeNameLen`. */
function volumeNameLen(path: string): number {
  if (path.length >= 2 && path.charCodeAt(0) < 0x80 && path[1] === ":") return 2;
  if (path.length === 0 || !isWinSep(path[0])) return 0;
  // Device namespace prefixes are matched by character (`/` and `\` alike),
  // because the core boundary rule bans device path text in core.
  // Go: pathHasPrefixFold(path, `\\.\UNC`); the UNC host and share are the volume.
  if (devicePrefix(path, ".") && pathHasPrefixFold(path.slice(4), "UNC")) return uncLen(path, 8);
  // Go: pathHasPrefixFold with `\\.`, `\\?`, or `\??`.
  if (devicePrefix(path, ".") || devicePrefix(path, "?") || pathHasPrefixFold(path, "\\??")) {
    if (path.length === 3) return 3;
    // cutPath(path[4:]): the volume ends at the next separator.
    for (let i = 4; i < path.length; i++) if (isWinSep(path[i])) return i;
    return path.length;
  }
  if (path.length >= 2 && isWinSep(path[1])) return uncLen(path, 2);
  return 0;
}

/** True when `path` starts with two separators and `c`, then a separator or the end. */
function devicePrefix(path: string, c: string): boolean {
  return isWinSep(path[0]) && isWinSep(path[1]) && path[2] === c && (path.length === 3 || isWinSep(path[3]));
}

function pathHasPrefixFold(s: string, prefix: string): boolean {
  if (s.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (isWinSep(prefix[i])) {
      if (!isWinSep(s[i])) return false;
    } else if (asciiUpper(prefix[i]!) !== asciiUpper(s[i]!)) {
      return false;
    }
  }
  return !(s.length > prefix.length && !isWinSep(s[prefix.length]));
}

function asciiUpper(c: string): string {
  return c >= "a" && c <= "z" ? c.toUpperCase() : c;
}

function uncLen(path: string, prefixLen: number): number {
  let count = 0;
  for (let i = prefixLen; i < path.length; i++) {
    if (isWinSep(path[i]) && ++count === 2) return i;
  }
  return path.length;
}

/**
 * `GetFullPathNameW`. Go 1.24.1 `filepath.Abs` on Windows calls
 * `syscall.FullPath`, which calls `GetFullPathNameW` directly, so this is
 * the Win32 call itself, not .NET's `Path.GetFullPath` (which returns a
 * `\\?\` path unchanged and expands 8.3 names).
 *
 * The steps follow the Win32 path normalization rules as Microsoft's .NET
 * file IO owner documents them (Jeremy Kuhne, "Path Normalization", 2016,
 * with real `GetFullPathNameW` output), in the shape of Wine's
 * `collapse_path`, with the changes those outputs show:
 *
 * 1. Separators: every `/` becomes `\`, then a run of `\` collapses to one,
 *    except the first two characters (`////server` becomes `\\\server`).
 * 2. Path type and current folder: `\\?\x` and `\\.\x` are device paths
 *    (root `\\?\` or `\\.\`; a `\\?\` path is normalized too when it is
 *    passed to `GetFullPathNameW`); `\\.` and `\\?` alone get a separator;
 *    any other `\\` start is UNC (root `\\server\share`); `\x` takes the
 *    drive or UNC share of the current folder; `C:\x` is absolute; `C:x`
 *    joins the current folder when it is on drive C, else `C:\`; anything
 *    else joins the current folder.
 * 3. `.` and `..` segments fold, but never into the root.
 * 4. A folder name that ends in a single dot loses that dot (`a.\` becomes
 *    `a\`); a name that ends in two or more dots keeps them (`a..\`,
 *    `...\`). A name that ends in a space keeps it.
 * 5. When the path does not end in a separator, all trailing dots and
 *    spaces go.
 * 6. A final `.` or `..` that folds a UNC path to its root also drops the
 *    separator after the share (`\\s\sh\..` becomes `\\s\sh`), while
 *    `\\s\sh\a\..\` keeps it.
 *
 * Not ported: legacy device names (`CON`, `LPT1`; Windows 11 changed
 * them), the per-drive current folder (`=D:`), and the error for a path of
 * only spaces.
 */
function win32FullPath(name: string, cwd: string): string {
  const given = canonicalSeparators(name);
  const cd = canonicalSeparators(isWinSep(cwd.at(-1)) ? cwd : `${cwd}\\`);
  let joined: string;
  if (given[0] === "\\" && given[1] !== "\\") {
    // Rooted (`\x`): the drive or UNC share of the current folder.
    joined = (cd[1] === ":" ? cd.slice(0, 2) : cd.slice(0, uncRootEnd(cd))) + given;
  } else if (given[0] === "\\") {
    joined = given.length === 3 && (given[2] === "." || given[2] === "?") ? `${given}\\` : given;
  } else if (given.length >= 2 && given[1] === ":") {
    if (given[2] === "\\") joined = given;
    else if (cd[1] === ":" && asciiUpper(cd[0]!) === asciiUpper(given[0]!)) joined = cd + given.slice(2);
    else joined = `${given.slice(0, 2)}\\${given.slice(2)}`;
  } else {
    joined = cd + given;
  }
  joined = canonicalSeparators(joined);
  let mark: number;
  let unc = false;
  if (joined[1] === ":") {
    mark = 3;
  } else if ((joined[2] === "." || joined[2] === "?") && joined[3] === "\\") {
    mark = 4;
  } else {
    unc = true;
    mark = uncRootEnd(joined);
    if (joined[mark] === "\\") mark++;
  }
  return collapsePath(joined, mark, unc);
}

/**
 * Step 1: `/` to `\`, and a run of `\` to one `\`, after the first two
 * characters. A UNC path (`\\server\share`) keeps its server and share as
 * `GetFullPathNameW` parses them before it collapses separators: the server
 * ends at the next separator, and the share, which can be empty, starts right
 * after it. So `\\foo\\bar` is server `foo`, an empty share, and `bar`
 * below it, not share `bar`. A run of separators right after the leading two
 * is one separator (an empty server), as before (W1 R7 P3 t13).
 */
function canonicalSeparators(path: string): string {
  const p = path.replaceAll("/", "\\");
  const device = (p[2] === "." || p[2] === "?") && (p.length === 3 || p[3] === "\\");
  if (!p.startsWith("\\\\") || device) return collapseRuns(p, "", 0);
  let out = "\\\\";
  let i = 2;
  if (p[i] === "\\") {
    // An empty server: the run after the leading two is one separator.
    out += "\\";
    while (p[i] === "\\") i++;
  } else {
    while (i < p.length && p[i] !== "\\") out += p[i++];
    if (p[i] === "\\") {
      out += "\\";
      i++;
    }
  }
  // The share, which can be empty, and the one separator that ends it.
  while (i < p.length && p[i] !== "\\") out += p[i++];
  if (p[i] === "\\") {
    out += "\\";
    i++;
  }
  return collapseRuns(p, out, i);
}

/** Appends `p` from `from` to `out`, with each run of `\` as one `\` once `out` holds more than two characters. */
function collapseRuns(p: string, out: string, from: number): string {
  for (let i = from; i < p.length; i++) {
    const c = p[i]!;
    if (c === "\\" && out.length > 2 && out.endsWith("\\")) continue;
    out += c;
  }
  return out;
}

/**
 * The end of `\\server\share`, before any separator that follows it. The
 * server ends at the first separator after the leading two, and the share,
 * which can be empty, starts right after that one separator.
 */
function uncRootEnd(path: string): number {
  let i = 2;
  while (i < path.length && path[i] !== "\\") i++;
  if (path[i] === "\\") i++;
  while (i < path.length && path[i] !== "\\") i++;
  return i;
}

/** Steps 3 to 6 on a canonical path, where `mark` is the length of the root. */
function collapsePath(text: string, mark: number, unc: boolean): string {
  // Split by UTF-16 code unit, not code point (`[...text]`): `mark` is a
  // code unit index, and Win32 works on UTF-16 units too.
  const path = text.split("");
  const at = (i: number) => path[i];
  // Step 6: a final `.` or `..` that reaches the UNC root drops its separator.
  const endAt = (p: number) => {
    path.length = unc && p === mark && mark > 0 && at(mark - 1) === "\\" ? mark - 1 : p;
  };
  let p = mark;
  while (p < path.length) {
    if (at(p) === ".") {
      if (at(p + 1) === "\\") {
        path.splice(p, 2); // `.\`
        continue;
      }
      if (p + 1 === path.length) {
        // Final `.`.
        if (p > mark) p--;
        endAt(p);
        continue;
      }
      if (at(p + 1) === ".") {
        if (at(p + 2) === "\\") {
          // `..\`
          const next = p + 3;
          if (p > mark) {
            p--;
            while (p > mark && at(p - 1) !== "\\") p--;
          }
          path.splice(p, next - p);
          continue;
        }
        if (p + 2 === path.length) {
          // Final `..`.
          if (p > mark) {
            p--;
            while (p > mark && at(p - 1) !== "\\") p--;
            if (p > mark) p--;
          }
          endAt(p);
          continue;
        }
      }
    }
    // Skip to the next component.
    while (p < path.length && at(p) !== "\\") p++;
    if (p < path.length) {
      // Step 4: a folder name that ends in a single dot loses it.
      if (p > mark && at(p - 1) === "." && at(p - 2) !== ".") path.splice(p - 1, 1);
      else p++;
    }
  }
  // Step 5: trailing dots and spaces.
  while (p > mark && (at(p - 1) === " " || at(p - 1) === ".")) p--;
  path.length = Math.min(path.length, p);
  return path.join("");
}
