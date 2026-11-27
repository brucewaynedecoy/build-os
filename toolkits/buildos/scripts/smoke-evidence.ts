// The disk reads of the tarball-mode guard of scripts/published-smoke.ts
// (W1 R7 P9, F-P9-15; review round 1 of pull request 12, finding 1). This
// module reads files and starts no process and writes nothing; the rules
// that judge what it reads are in scripts/smoke-source.ts, which says where
// each layout comes from (npm 11.19.1: pacote 21.5.1, cacache 20.0.4,
// libnpmexec 10.3). Node built-ins only.

import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cacheIndexEntries, sha256Hex, type CacheEntry, type InstalledCopy, type NpxFolder } from "./smoke-source.ts";

function list(dir: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

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

/** Every file below `dir`, by its relative path with `/` separators; a symbolic link is not followed. */
function filesBelow(dir: string, visit: (rel: string, path: string, symlink: boolean) => void, rel = "", depth = 0): void {
  if (depth > 32) return;
  for (const name of list(dir)) {
    const path = join(dir, name);
    const r = rel === "" ? name : `${rel}/${name}`;
    let st;
    try {
      st = lstatSync(path);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) visit(r, path, true);
    else if (st.isDirectory()) filesBelow(path, visit, r, depth + 1);
    else if (st.isFile()) visit(r, path, false);
  }
}

/** The entries of the npm cache index `<cache>/_cacache/index-v5` (every bucket file). */
export function readCacheIndex(cache: string): CacheEntry[] {
  const texts: string[] = [];
  filesBelow(join(cache, "_cacache", "index-v5"), (_rel, path, symlink) => {
    if (!symlink) texts.push(readFileSync(path, "utf8"));
  });
  return cacheIndexEntries(texts);
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
  const files: Record<string, string> = {};
  filesBelow(dir, (rel, path, symlink) => {
    files[rel] = symlink ? "(symlink)" : sha256Hex(readFileSync(path));
  });
  // The hidden lockfile of this node_modules folder. Its key is
  // `node_modules/build-os`; when npm saw the folder through a linked path,
  // the key is a longer relative path that ends the same way, and then the
  // one such key counts.
  const packages = (readJson(join(base, "node_modules", ".package-lock.json")) as { packages?: Record<string, InstalledCopy["lock"]> } | undefined)?.packages ?? {};
  const keys = Object.keys(packages).filter((k) => k === "node_modules/build-os" || k.endsWith("/node_modules/build-os"));
  const key = "node_modules/build-os" in packages ? "node_modules/build-os" : keys.length === 1 ? keys[0]! : undefined;
  return { where, files, lock: key !== undefined ? packages[key] : undefined };
}

/** Every folder below `<cache>/_npx`: its path, its `_npx.packages`, and whether it holds a build-os install. */
export function readNpxFolders(cache: string, clean: (path: string) => string): (NpxFolder & { dir: string })[] {
  const npxRoot = join(cache, "_npx");
  return list(npxRoot)
    .map((name) => join(npxRoot, name))
    .filter(isDir)
    .map((dir) => ({ dir, where: clean(dir), packages: (readJson(join(dir, "package.json")) as { _npx?: { packages?: unknown } } | undefined)?._npx?.packages, hasBuildOs: isDir(join(dir, "node_modules", "build-os")) }));
}

/** Every `node_modules/build-os` folder below `root` (symbolic links are not followed; the npm cache's own store is skipped). */
export function findBuildOsFolders(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 32) return;
    for (const name of list(dir)) {
      const path = join(dir, name);
      if (!isDir(path) || name === "_cacache" || name === "_logs") continue;
      if (name === "build-os" && basename(dir) === "node_modules") found.push(path);
      walk(path, depth + 1);
    }
  };
  walk(root, 0);
  return found.sort();
}
