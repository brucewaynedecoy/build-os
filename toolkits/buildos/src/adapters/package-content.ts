/**
 * The `system/` package content that `buildos init` places in a project
 * (PRD 20 Runtime and Package, Project Initialization and Adoption).
 *
 * The build (`scripts/build.ts`) copies `system/` into `dist/system/`,
 * without the Make Docs content (`system/docs/`, `system/.make-docs/`) and
 * without local clutter, and writes `dist/system.json`: every file with its
 * project path, the name it has in the package, its mode, and its SHA-256.
 * npm leaves `.gitignore` and `.npmrc` files out of a package, so such a file
 * is stored as `_dot<name>` and gets its own name back in the project.
 *
 * The bundle reads `system.json` next to itself. Run from source (tests), the
 * same rules read the repository's `system/` folder directly.
 */

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageContent, PackageFile } from "../core/init/content.ts";

/** Top-level `system/` folders that are not BuildOS package content: Make Docs owns them. */
export const EXCLUDED_TOP_LEVEL: readonly string[] = ["docs", ".make-docs"];

/** Names never shipped at any depth: local tool clutter and app folders (`buildos init` never writes `.claude/` or `.agents/`). */
export const EXCLUDED_NAMES: readonly string[] = ["__pycache__", ".DS_Store", "Thumbs.db", ".claude", ".agents", "node_modules"];

/** File names npm leaves out of a package; they are stored as `_dot<name>`. */
export const NPM_DROPPED_NAMES: readonly string[] = [".gitignore", ".npmignore", ".npmrc"];

export interface ContentManifestEntry {
  /** Project path, `/`-separated. */
  path: string;
  /** Path inside `dist/system/`, `/`-separated. */
  stored: string;
  mode: number;
  sha256: string;
}

export interface ContentManifest {
  schema_version: 1;
  files: ContentManifestEntry[];
}

export function storedName(path: string): string {
  const parts = path.split("/");
  const last = parts.pop() ?? "";
  return [...parts, NPM_DROPPED_NAMES.includes(last) ? `_dot${last}` : last].join("/");
}

/** Every package file in a `system/` source tree, in path order, with the exclusions applied. */
export function listSourceContent(systemDir: string): { path: string; source: string; mode: number }[] {
  const out: { path: string; source: string; mode: number }[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const name of readdirSync(dir).sort()) {
      if (EXCLUDED_NAMES.includes(name) || name.endsWith(".pyc") || name.endsWith(".pyo")) continue;
      if (prefix === "" && EXCLUDED_TOP_LEVEL.includes(name)) continue;
      const full = join(dir, name);
      const path = prefix === "" ? name : `${prefix}/${name}`;
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error(`system/${path} is a symbolic link; the package content holds only files and folders`);
      if (stat.isDirectory()) walk(full, path);
      else if (stat.isFile()) out.push({ path, source: full, mode: isScript(full) ? 0o755 : 0o644 });
    }
  };
  walk(systemDir, "");
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * A file is executable in the project when it starts with `#!` (a script).
 * The rule reads the bytes, not the checkout's mode bits, so the content is
 * the same when the package is built on Windows.
 */
function isScript(path: string): boolean {
  const head = readFileSync(path).subarray(0, 2);
  return head.length === 2 && head[0] === 0x23 && head[1] === 0x21;
}

export function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Reads the packaged content from `dist/system.json` and `dist/system/`, and checks every file's SHA-256. */
export function loadPackagedContent(distDir: string): PackageContent {
  const manifest = JSON.parse(readFileSync(join(distDir, "system.json"), "utf8")) as ContentManifest;
  const files: PackageFile[] = manifest.files.map((entry) => {
    const data = new Uint8Array(readFileSync(join(distDir, "system", ...entry.stored.split("/"))));
    if (sha256(data) !== entry.sha256) throw new Error(`the BuildOS package file system/${entry.stored} is damaged; reinstall BuildOS`);
    return { path: entry.path, data, mode: entry.mode };
  });
  return { files };
}

/** Reads the content straight from a `system/` source tree (run from source). */
export function loadSourceContent(systemDir: string): PackageContent {
  return { files: listSourceContent(systemDir).map((f) => ({ path: f.path, data: new Uint8Array(readFileSync(f.source)), mode: f.mode })) };
}

/** The content for this program: packaged next to the bundle, else the repository's `system/`. */
export function loadPackageContent(): PackageContent {
  const here = dirname(fileURLToPath(import.meta.url));
  if (existsSync(join(here, "system.json"))) return loadPackagedContent(here);
  return loadSourceContent(resolve(here, "..", "..", "..", "..", "system"));
}
