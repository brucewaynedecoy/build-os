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

import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve, win32 } from "node:path";
import {
  cacheIndexEntries,
  cmdShimTarget,
  NOT_REGULAR_MARK,
  ps1ShimTarget,
  sha256Hex,
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

type Kind = "file" | "symlink" | "other";

/**
 * Every entry below `dir`, by its relative path with `/` separators; a
 * symbolic link is not followed. Each part that cannot be read (the folder
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
  const incomplete: string[] = [];
  walk(
    dir,
    (rel, path, kind) => {
      if (kind === "symlink") files.set(rel, SYMLINK_MARK);
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
  return { where, files, incomplete: incomplete.map((p) => `${where}/${p}`), lock: key !== undefined ? packages[key] : undefined };
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

/** Every `node_modules/build-os` folder below `root` (symbolic links are not followed; the npm cache's own store is skipped), and each part that could not be read. */
export function findBuildOsFolders(root: string): { found: string[]; incomplete: string[] } {
  const found: string[] = [];
  const incomplete: string[] = [];
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
      if (!st.isDirectory() || name === "_cacache" || name === "_logs") continue;
      if (name === "build-os" && basename(dir) === "node_modules") found.push(path);
      if (depth + 1 > MAX_DEPTH) incomplete.push(`${path}: the folder is deeper than ${MAX_DEPTH} levels and was not read`);
      else visit(path, depth + 1);
    }
  };
  visit(root, 0);
  return { found: found.sort(), incomplete };
}

/**
 * The launcher of each bin name in the npm bin folder `binDir`
 * (`<install>/node_modules/.bin`). On macOS and Linux: `<binDir>/<name>`,
 * which npm makes as a symbolic link, resolved to its real path. On Windows:
 * the `.cmd` shim (what Command Prompt and npm's run-script start) and the
 * PowerShell shim, each resolved from the target that its text names,
 * against the shim's folder (cmd-shim 8 in npm 11).
 */
export function readLaunchers(binDir: string, names: readonly string[], windows: boolean, clean: (path: string) => string): LauncherRead[] {
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
    for (const [ext, kind, parse, sep] of [
      [".cmd", "cmd", cmdShimTarget, "\\"],
      [".ps1", "ps1", ps1ShimTarget, "/"],
    ] as const) {
      const file = join(binDir, `${name}${ext}`);
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        files.push({ where: clean(file), kind: "missing" });
        continue;
      }
      const target = parse(text);
      if (target === undefined) files.push({ where: clean(file), kind, reason: "the shim text names no single target" });
      else files.push({ where: clean(file), kind, resolved: win32.resolve(binDir, target.split(sep).join("\\")) });
    }
    return { name, files };
  });
}
