// The disk reads of the tarball-mode guard of scripts/published-smoke.ts
// (W1 R7 P9, F-P9-15; review round 1 of pull request 12, finding 1). This
// module reads files and starts no process and writes nothing; the rules
// that judge what it reads are in scripts/smoke-source.ts, which says where
// each layout comes from (npm 11.19.1: pacote 21.5.1, cacache 20.0.4,
// libnpmexec 10.3, cmd-shim 8). Node built-ins only.
//
// Review round 2 of pull request 12, finding 2: a traversal never skips a
// part silently. A folder or entry that cannot be read, an entry of another
// kind, and a folder below the depth limit are recorded, and the check that
// reads them fails and names the path.
//
// Review round 3 of pull request 12, finding 2: the one write of this
// module is canonicalShims, which runs the selected npm's own cmd-shim into
// a new scratch folder that the caller gives (outside the smoke's temporary
// root) and removes it again.

import { createRequire } from "node:module";
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  cacheIndexEntries,
  NOT_REGULAR_MARK,
  pathKey,
  sha256Hex,
  SHIM_EXTENSIONS,
  SYMLINK_MARK,
  type CacheEntry,
  type InstalledCopy,
  type LauncherRead,
  type NpxFolder,
} from "./smoke-source.ts";

/** The deepest folder level that a traversal reads; a folder below it makes the traversal incomplete. */
export const MAX_DEPTH = 32;

function isDir(path: string): boolean {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

type Kind = "file" | "symlink" | "other" | "dir";

/**
 * Every entry below `dir`, by its relative path with `/` separators (a
 * folder too, before its entries); a symbolic link is not followed. Each part that cannot be read (the folder
 * itself, an entry, a folder deeper than MAX_DEPTH) goes to `incomplete` as
 * its relative path and the reason; a missing `dir` is not a problem here
 * (the caller decides).
 */
function walk(dir: string, visit: (rel: string, path: string, kind: Kind) => void, incomplete: string[], rel = "", depth = 0): void {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch (e) {
    if (depth === 0 && (e as NodeJS.ErrnoException).code === "ENOENT") return;
    incomplete.push(`${rel === "" ? "." : rel}: the folder cannot be read (${(e as NodeJS.ErrnoException).code ?? "error"})`);
    return;
  }
  for (const name of names) {
    const path = join(dir, name);
    const r = rel === "" ? name : `${rel}/${name}`;
    let st;
    try {
      st = lstatSync(path);
    } catch (e) {
      incomplete.push(`${r}: the entry cannot be read (${(e as NodeJS.ErrnoException).code ?? "error"})`);
      continue;
    }
    if (st.isSymbolicLink()) visit(r, path, "symlink");
    else if (st.isDirectory()) {
      visit(r, path, "dir");
      if (depth + 1 > MAX_DEPTH) incomplete.push(`${r}: the folder is deeper than ${MAX_DEPTH} levels and was not read`);
      else walk(path, visit, incomplete, r, depth + 1);
    } else if (st.isFile()) visit(r, path, "file");
    else visit(r, path, "other");
  }
}

/** The entries of the npm cache index `<cache>/_cacache/index-v5` (every bucket file), and each part of the index that could not be read. */
export function readCacheIndex(cache: string): { entries: CacheEntry[]; incomplete: string[] } {
  const texts: string[] = [];
  const incomplete: string[] = [];
  walk(
    join(cache, "_cacache", "index-v5"),
    (rel, path, kind) => {
      if (kind === "dir") return;
      if (kind !== "file") {
        incomplete.push(`${rel}: not a regular file`);
        return;
      }
      try {
        texts.push(readFileSync(path, "utf8"));
      } catch (e) {
        incomplete.push(`${rel}: the file cannot be read (${(e as NodeJS.ErrnoException).code ?? "error"})`);
      }
    },
    incomplete,
  );
  return { entries: cacheIndexEntries(texts), incomplete: incomplete.map((p) => `_cacache/index-v5/${p}`) };
}

/** The SHA-256 of the cache content for a `sha512-` integrity (cacache content-v2 path), or undefined when there is none. */
export function cacheContentSha256(cache: string, integrity: string): string | undefined {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity);
  if (match === null) return undefined;
  const hex = Buffer.from(match[1]!, "base64").toString("hex");
  try {
    return sha256Hex(readFileSync(join(cache, "_cacache", "content-v2", "sha512", hex.slice(0, 2), hex.slice(2, 4), hex.slice(4))));
  } catch {
    return undefined;
  }
}

/** The `build-os` install in `<base>/node_modules/build-os`, with its hidden lockfile entry, or undefined when there is none. */
export function readInstalledCopy(base: string, where: string): InstalledCopy | undefined {
  const dir = join(base, "node_modules", "build-os");
  if (!isDir(dir)) return undefined;
  // A Map: a file named like an inherited object key is an own entry (finding 2).
  const files = new Map<string, string>();
  const dirs: string[] = [];
  const incomplete: string[] = [];
  walk(
    dir,
    (rel, path, kind) => {
      if (kind === "dir") dirs.push(rel);
      else if (kind === "symlink") files.set(rel, SYMLINK_MARK);
      else if (kind === "other") files.set(rel, NOT_REGULAR_MARK);
      else {
        try {
          files.set(rel, sha256Hex(readFileSync(path)));
        } catch (e) {
          incomplete.push(`${rel}: the file cannot be read (${(e as NodeJS.ErrnoException).code ?? "error"})`);
        }
      }
    },
    incomplete,
  );
  // The hidden lockfile of this node_modules folder. Its key is
  // `node_modules/build-os`; when npm saw the folder through a linked path,
  // the key is a longer relative path that ends the same way, and then the
  // one such key counts.
  const packages = (readJson(join(base, "node_modules", ".package-lock.json")) as { packages?: Record<string, InstalledCopy["lock"]> } | undefined)?.packages ?? {};
  const keys = Object.keys(packages).filter((k) => k === "node_modules/build-os" || k.endsWith("/node_modules/build-os"));
  const key = Object.hasOwn(packages, "node_modules/build-os") ? "node_modules/build-os" : keys.length === 1 ? keys[0]! : undefined;
  return { where, files, dirs, incomplete: incomplete.map((p) => `${where}/${p}`), lock: key !== undefined ? packages[key] : undefined };
}

/** Every folder below `<cache>/_npx`: its path, its `_npx.packages`, and whether it holds a build-os install. Every entry counts, whatever it holds (finding 2). */
export function readNpxFolders(cache: string, clean: (path: string) => string): (NpxFolder & { dir: string })[] {
  const npxRoot = join(cache, "_npx");
  let names: string[] = [];
  try {
    names = readdirSync(npxRoot).sort();
  } catch {
    names = [];
  }
  return names
    .map((name) => join(npxRoot, name))
    .map((dir) => ({ dir, where: clean(dir), packages: (readJson(join(dir, "package.json")) as { _npx?: { packages?: unknown } } | undefined)?._npx?.packages, hasBuildOs: isDir(join(dir, "node_modules", "build-os")) }));
}

/**
 * Every `node_modules/build-os` folder below `root` (symbolic links are not
 * followed), and each part that could not be read. Only the folders in
 * `skip` are not searched: the exact paths of this run's npm cache store and
 * log folders (review round 3 of pull request 12, finding 4), compared by
 * pathKey; a folder of the same name elsewhere is searched. On Windows the
 * names `node_modules` and `build-os` are matched case-insensitively.
 */
export function findBuildOsFolders(root: string, skip: readonly string[], windows: boolean): { found: string[]; incomplete: string[] } {
  const found: string[] = [];
  const incomplete: string[] = [];
  const skipped = new Set(skip.map((p) => pathKey(p, windows)));
  const same = (a: string, b: string): boolean => (windows ? a.toLowerCase() === b.toLowerCase() : a === b);
  const visit = (dir: string, depth: number): void => {
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch (e) {
      incomplete.push(`${dir}: the folder cannot be read (${(e as NodeJS.ErrnoException).code ?? "error"})`);
      return;
    }
    for (const name of names) {
      const path = join(dir, name);
      let st;
      try {
        st = lstatSync(path);
      } catch (e) {
        incomplete.push(`${path}: the entry cannot be read (${(e as NodeJS.ErrnoException).code ?? "error"})`);
        continue;
      }
      if (!st.isDirectory() || skipped.has(pathKey(path, windows))) continue;
      if (same(name, "build-os") && same(basename(dir), "node_modules")) found.push(path);
      if (depth + 1 > MAX_DEPTH) incomplete.push(`${path}: the folder is deeper than ${MAX_DEPTH} levels and was not read`);
      else visit(path, depth + 1);
    }
  };
  visit(root, 0);
  return { found: found.sort(), incomplete };
}

/**
 * The canonical Windows shims of each bin (review round 3 of pull request
 * 12, finding 2): the files that the selected npm's own cmd-shim module
 * (`<npm root>/node_modules/cmd-shim`, the module that npm's bin-links uses
 * on Windows) writes for that bin, in a scratch folder with the same
 * relative layout as an install: `node_modules/.bin/<name>` for the bin file
 * `node_modules/build-os/<path>`, which holds the tarball's bytes. cmd-shim's
 * output depends only on the relative path from the shim's folder to the bin
 * file and on the bin file's first line (its `#!` line), and both are the
 * same as in an install, so nothing is normalized before the byte
 * comparison. Returns, per bin name, the bytes of each shim file by its
 * extension (SHIM_EXTENSIONS). The scratch folder must not exist; it is
 * removed again.
 */
export async function canonicalShims(npmRoot: string, scratch: string, bins: ReadonlyMap<string, string>, bodies: ReadonlyMap<string, Uint8Array>): Promise<Map<string, Map<string, Uint8Array>>> {
  const cmdShim = createRequire(join(npmRoot, "package.json"))(join(npmRoot, "node_modules", "cmd-shim")) as (from: string, to: string) => Promise<void>;
  const out = new Map<string, Map<string, Uint8Array>>();
  mkdirSync(scratch);
  try {
    for (const [name, rel] of bins) {
      const body = bodies.get(rel);
      if (body === undefined) continue;
      const base = join(scratch, name);
      const target = join(base, "node_modules", "build-os", ...rel.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
      const to = join(base, "node_modules", ".bin", name);
      await cmdShim(target, to);
      out.set(name, new Map(SHIM_EXTENSIONS.map((ext) => [ext, readFileSync(`${to}${ext}`)] as const)));
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return out;
}

/**
 * The launcher of each bin name in the npm bin folder `binDir`
 * (`<install>/node_modules/.bin`). On macOS and Linux: `<binDir>/<name>`,
 * which npm makes as a symbolic link, resolved to its real path. On Windows
 * (review round 3 of pull request 12, finding 2): each of the three shims
 * that npm's cmd-shim writes (`<name>`, `<name>.cmd`, and `<name>.ps1`),
 * compared byte for byte with the canonical shims of that bin
 * (canonicalShims); no target is parsed from the text.
 */
export function readLaunchers(binDir: string, names: readonly string[], windows: boolean, clean: (path: string) => string, canonical?: ReadonlyMap<string, ReadonlyMap<string, Uint8Array>>): LauncherRead[] {
  return names.map((name) => {
    if (!windows) {
      const file = join(binDir, name);
      let st;
      try {
        st = lstatSync(file);
      } catch {
        return { name, files: [{ where: clean(file), kind: "missing" as const }] };
      }
      if (!st.isSymbolicLink()) {
        let real: string | undefined;
        try {
          real = realpathSync.native(file);
        } catch {
          real = undefined;
        }
        return { name, files: [{ where: clean(file), kind: "file" as const, ...(real !== undefined ? { resolved: real } : { reason: "its real path cannot be read" }) }] };
      }
      try {
        return { name, files: [{ where: clean(file), kind: "symlink" as const, resolved: realpathSync.native(file) }] };
      } catch {
        let target = "";
        try {
          target = readlinkSync(file);
        } catch {
          target = "";
        }
        return { name, files: [{ where: clean(file), kind: "symlink" as const, reason: `its target ${clean(resolve(dirname(file), target))} does not exist` }] };
      }
    }
    const files: LauncherRead["files"] = [];
    for (const ext of SHIM_EXTENSIONS) {
      const file = join(binDir, `${name}${ext}`);
      let bytes: Buffer;
      try {
        bytes = readFileSync(file);
      } catch {
        files.push({ where: clean(file), kind: "missing" });
        continue;
      }
      const want = canonical?.get(name)?.get(ext);
      if (want === undefined) files.push({ where: clean(file), kind: "shim", equal: false, reason: "no canonical shim was generated for this bin" });
      else if (Buffer.compare(bytes, Buffer.from(want)) === 0) files.push({ where: clean(file), kind: "shim", equal: true });
      else files.push({ where: clean(file), kind: "shim", equal: false, reason: `its ${bytes.length} bytes differ from the canonical ${want.length} bytes` });
    }
    return { name, files };
  });
}
