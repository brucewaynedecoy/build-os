// The package source of scripts/published-smoke.ts (W1 R7 P9, F-P9-15): the
// public npm registry (`--version <version>`) or one release tarball
// (`--tarball <file> --sha256 <hex>`). This module starts no process and
// writes nothing, so a test can run every part of it with stubs. Node
// built-ins and scripts/tar-reader.mjs only.
//
// Why a tarball mode: a version that is staged on npm cannot be installed
// before a maintainer approves it, so the smoke before the approval runs on
// the release tarball, which has the same bytes as the stage (runbook steps
// c, h1, and h2).
//
// How each step gets the package in tarball mode, so that each step stays as
// close as possible to what an adopter runs:
// - The direct steps (version, init, intake, entities validate, validate,
//   the legacy name, and the `entities validate --json` runs of step 10) run
//   `npx -y --package=<tarball> -- buildos <args>` (the legacy name:
//   `npx -y --package=<tarball> buildos-intake --help`). npx installs the
//   file into its own cache folder and starts the bin, as it does for
//   `npx -y build-os@<version>`; only the package spec differs.
// - Before the wrapper step (9), the tarball is installed into the project
//   (`npm install --offline --ignore-scripts --no-save --no-package-lock
//   --prefix <project> <tarball>`), the offline install of the user guide
//   (chapter 4). The wrapper then runs the pinned version from that local
//   install, which it accepts because its version equals the pin (pin first,
//   SECURITY.md "Rollback by Version Pin").
// - Step 10 checks the printed text exactly (the JSON field and the human
//   `action:` line), then runs that same text through the system shell. npm
//   resolves `build-os@<version>` to the project's local install of the
//   tarball (npm takes an installed package of exactly the named version
//   from the local tree), so the printed program, arguments, and quoting run
//   as printed, and the package bytes are the tarball's.
//
// The registry guard (review round 1 of pull request 12, finding 1): every
// process that the smoke starts gets `npm_config_offline=true`,
// `npm_config_registry=http://127.0.0.1:9/` (a closed local port), the new
// npm cache, a new empty global prefix (`npm_config_prefix`), bin links on
// (`npm_config_bin_links=true`, review round 2, finding 1), and npm's
// `node-options` equal to the launch probe's NODE_OPTIONS
// (`npm_config_node_options`, review round 3, finding 3), each in one
// spelling only. So npm makes no network request at all, a request for
// `build-os` from a registry fails (ENOTCACHED), no global install can stand
// in, npm makes a launcher for each bin, and npm passes the probe on to the
// processes that it starts. The run then requires positive evidence of which
// bytes ran, and records the entry scripts that the launch probe observed:
// - Before step 1: npm reads offline, the blocked registry, bin links on, and
//   node-options equal to the probe; the run selects one npm installation
//   (the npm next to the Node.js that runs the smoke, by real path), and the
//   probe observes the preflight's npm process. On Windows the canonical
//   shims of each bin are made with that npm's cmd-shim. When any of this
//   fails, the run stops there, writes the report, and runs no other step.
// - After step 7, before the project install exists: the npx install that
//   steps 1 to 7 used. npx (libnpmexec in npm 11.19.1, the npm of CI) installs
//   a `--package` spec that is not in the local tree into
//   `<cache>/_npx/<hash>`, records the spec in that folder's package.json
//   (`_npx.packages`), and puts that folder's `node_modules/.bin` first on
//   PATH, before every `node_modules/.bin` from the working folder up and the
//   caller's PATH (@npmcli/run-script set-path.js). The check requires exactly
//   one npx folder, made for exactly the tarball file; every file of its
//   `node_modules/build-os` equal by SHA-256 to the tarball's file of the
//   same path, and no other file; its hidden lockfile entry with the
//   tarball's version, a `file:` spec of the tarball's name, and the
//   tarball's integrity; and no other `build-os` folder below the temporary
//   root (the global prefix is there too). The comparison reads every entry:
//   an entry it cannot read, or a folder below the depth limit, fails it
//   (review round 2, finding 2).
// - The launchers and the launch records (review round 2, finding 1; round
//   3, findings 1 and 2). The launchers: each bin that a step starts has its
//   launcher in the copy's `node_modules/.bin`. On macOS and Linux it is
//   npm's symbolic link, whose real path is that bin's file inside the
//   verified copy. On Windows each of the three shims (`<name>`,
//   `<name>.cmd`, `<name>.ps1`) is byte-equal to the shim that the selected
//   npm's own cmd-shim writes for that bin file in the same relative layout;
//   no target is parsed from the shim text. The launch records: the launch
//   probe (PROBE_SOURCE, through NODE_OPTIONS `--require`) records the real
//   path of the entry script of each Node.js process that it observes. The
//   check allows, by exact real path (pathKey), only the selected npm's own
//   program files (npmPrograms), the project's own `.os/scripts/
//   pinned-version.cjs` (the wrapper step), and the expected bin file of the
//   verified copy, which must be observed at least once. What this shows is
//   limited (PROBE_LIMIT): a process that is not Node.js, or a Node.js process
//   started with a cleared environment, is not observed. The probe changes
//   no product code and prints nothing.
// - After step 10: the project install that the wrapper (step 9) and the
//   printed command of step 10 used, by the same file and lockfile checks,
//   its launchers (`build-os`, the bin that npm starts for
//   `npx -y build-os@<version>`, and `buildos`), the wrapper's own lookup
//   (`localEntry` of the project's `.os/scripts/pinned-version.cjs`, which
//   the wrapper runs first), the launch records of steps 9 and 10, and the
//   npx install again (the `entities validate --json` runs of step 10).
// - Last, the npm cache: its index (`<cache>/_cacache/index-v5`, one
//   `<hash>\t<JSON>` line per entry, pacote 21.5.1 and cacache 20.0.4 in npm
//   11.19.1) holds at least one entry, every entry has the key
//   `pacote:tarball:file:<path>` with the tarball's file name and the
//   integrity `sha512-<base64 SHA-512 of the tarball file>`, and the cache
//   content for that integrity (`content-v2/sha512/<2>/<2>/<rest of the hex
//   digest>`) has the tarball's SHA-256. An empty index, an entry of another
//   kind (a registry response), or an entry for another file fails.
//
// The claims of the report (what tarball mode proved in this run) are made
// from the steps that ran and their outcomes (`tarballClaims`), never fixed
// text (review round 1, finding 2). Last, every string of the report loses
// any absolute path that the cleaning left (scrubAbsolutePaths, review round
// 3, finding 5); npm's program paths are cleaned to `{NPM}` before that.

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readTar } from "./tar-reader.mjs";

export const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/;
/** A closed local port: a registry request can never reach a registry. */
export const BLOCKED_REGISTRY = "http://127.0.0.1:9/";

export type SmokeSource = { kind: "registry"; version: string } | { kind: "tarball"; file: string; sha256: string };

export interface SmokeArgs {
  source: SmokeSource;
  out: string;
}

export class UsageError extends Error {}

export const USAGE = "Usage: node scripts/published-smoke.ts (--version <version> | --tarball <file> --sha256 <hex>) --out <folder>";

/** Reads the command line. Throws a UsageError for any problem. */
export function parseSmokeArgs(argv: readonly string[]): SmokeArgs {
  let version: string | undefined;
  let tarball: string | undefined;
  let sha256: string | undefined;
  let out = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--version") version = argv[++i] ?? "";
    else if (a === "--tarball") tarball = argv[++i] ?? "";
    else if (a === "--sha256") sha256 = argv[++i] ?? "";
    else if (a === "--out") out = argv[++i] ?? "";
    else throw new UsageError(`unknown argument: ${a}`);
  }
  if (version !== undefined && tarball !== undefined) throw new UsageError("--version and --tarball cannot be used together");
  if (tarball === undefined) {
    if (sha256 !== undefined) throw new UsageError("--sha256 goes with --tarball only");
    // A plain semver version only: npm reads an empty spec as "any version".
    if (version === undefined || !VERSION_PATTERN.test(version)) throw new UsageError("--version must be a plain version such as 0.1.0 (or give --tarball <file> --sha256 <hex>)");
    if (out === "") throw new UsageError("--out is required");
    return { source: { kind: "registry", version }, out };
  }
  if (tarball === "") throw new UsageError("--tarball needs a file");
  if (sha256 === undefined || !SHA256_PATTERN.test(sha256)) throw new UsageError("--sha256 must be the 64 lowercase hex characters of the tarball's SHA-256");
  if (out === "") throw new UsageError("--out is required");
  return { source: { kind: "tarball", file: tarball, sha256 }, out };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface TarballIdentity {
  sha256: string;
  /** npm's integrity of the file, as its cache index and lockfiles record it: `sha512-` and the base64 SHA-512. */
  integrity: string;
  name: string;
  version: string;
  /** SHA-256 of each bin file, by its package-relative path (for example `dist/buildos.js`). */
  bins: Record<string, string>;
  /** Each bin name and its package-relative file (for example `buildos` and `dist/buildos.js`), as package.json names them. */
  binFiles: Map<string, string>;
  /** The bytes of each bin file, by its package-relative path: the canonical Windows shims are generated for these bytes (review round 3 of pull request 12, finding 2). */
  binBodies: Map<string, Uint8Array>;
  /** SHA-256 of every regular file of the package, by its package-relative path (the first path part, `package/`, removed, as npm extracts it). A Map, so a file named like an inherited object key (`constructor`, `__proto__`) is one entry like any other (review round 2 of pull request 12, finding 2). */
  files: Map<string, string>;
  /** Each tarball entry that is not a regular file or a folder (a symbolic link, a hard link, or another kind), as `<path> (<kind>)`; npm pack writes none. */
  nonFileEntries: string[];
}

/** npm's integrity string of a file: `sha512-` and the base64 SHA-512 (ssri, as pacote computes it). */
export function sha512Integrity(bytes: Uint8Array): string {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

/**
 * The identity of an npm tarball: its SHA-256, and the name, version, and bin
 * file digests read from `package/package.json` inside it. Throws when the
 * file is not a gzip tar, when `package/package.json` is missing, repeated,
 * or not JSON, when the name is not `build-os`, when the version is not
 * plain, or when a bin file is missing.
 */
export function readTarballIdentity(bytes: Uint8Array): TarballIdentity {
  const entries = readTar(gunzipSync(bytes));
  const byPath = new Map<string, Uint8Array>();
  const files = new Map<string, string>();
  const nonFileEntries: string[] = [];
  for (const e of entries) {
    if (e.type !== "file" && e.type !== "dir") nonFileEntries.push(`${e.path} (${e.type})`);
    if (e.type !== "file" || e.body === undefined) continue;
    if (byPath.has(e.path)) throw new Error(`the tarball holds ${e.path} twice`);
    byPath.set(e.path, e.body);
    const rel = e.path.split("/").slice(1).join("/");
    if (rel !== "") files.set(rel, sha256Hex(e.body));
  }
  const manifest = byPath.get("package/package.json");
  if (manifest === undefined) throw new Error("the tarball holds no package/package.json");
  let pkg: { name?: unknown; version?: unknown; bin?: unknown };
  try {
    pkg = JSON.parse(Buffer.from(manifest).toString("utf8")) as typeof pkg;
  } catch {
    throw new Error("package/package.json in the tarball is not JSON");
  }
  if (pkg.name !== "build-os") throw new Error(`the tarball's package name is ${JSON.stringify(pkg.name)}, not "build-os"`);
  if (typeof pkg.version !== "string" || !VERSION_PATTERN.test(pkg.version)) throw new Error(`the tarball's version ${JSON.stringify(pkg.version)} is not a plain version`);
  const bins: Record<string, string> = {};
  const binFiles = new Map<string, string>();
  const binBodies = new Map<string, Uint8Array>();
  const binEntries = typeof pkg.bin === "object" && pkg.bin !== null ? Object.entries(pkg.bin as Record<string, unknown>) : [];
  for (const [binName, p] of binEntries) {
    if (typeof p !== "string") continue;
    const rel = p.replace(/^\.\//, "");
    const body = byPath.get(`package/${rel}`);
    if (body === undefined) throw new Error(`the tarball holds no bin file ${rel}`);
    bins[rel] = sha256Hex(body);
    binFiles.set(binName, rel);
    binBodies.set(rel, body);
  }
  if (Object.keys(bins).length === 0) throw new Error("the tarball's package.json names no bin file");
  return { sha256: sha256Hex(bytes), integrity: sha512Integrity(bytes), name: pkg.name, version: pkg.version, bins, binFiles, binBodies, files, nonFileEntries };
}

/** The npx arguments of a direct step: the registry version, or the tarball file. */
export function npxArgs(source: SmokeSource, version: string, args: readonly string[]): string[] {
  return source.kind === "registry" ? ["-y", `build-os@${version}`, ...args] : ["-y", `--package=${source.file}`, "--", "buildos", ...args];
}

/** The npx arguments of the legacy-name step (step 7). */
export function legacyNpxArgs(source: SmokeSource, version: string): string[] {
  return ["-y", `--package=${source.kind === "registry" ? `build-os@${version}` : source.file}`, "buildos-intake", "--help"];
}

/** The npm settings that the smoke sets itself; the caller's value in any spelling (case, `-` or `_`) is dropped first. */
const GUARD_KEYS = /^npm_config_(offline|prefer[-_]online|prefer[-_]offline|registry|cache|prefix|bin[-_]links|node[-_]options)$/i;

/**
 * The Node.js options of every process in tarball mode: only the launch
 * probe (review round 2 of pull request 12, finding 1), as one `--require`
 * with the path in double quotes. Node.js reads a backslash inside quotes as
 * an escape, so each backslash and quote of the path is escaped.
 */
export function probeNodeOptions(probe: string): string {
  return `--require "${probe.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** The environment variable that names the launch log of the current step (one JSON line per Node.js process). */
export const PROBE_LOG_VARIABLE = "SMOKE_LAUNCH_LOG";

/**
 * The launch probe: a CommonJS file that Node.js loads before the main
 * script of every Node.js process of a tarball-mode step that it reaches
 * (NODE_OPTIONS `--require`). It appends one JSON line to the file that
 * SMOKE_LAUNCH_LOG names: the entry script as started (`process.argv[1]`)
 * and its real path, the file that Node.js loads. It writes nothing to
 * stdout or stderr. Node built-ins only. What it observes is limited
 * (review round 3 of pull request 12, finding 1): a process that is not
 * Node.js, or a Node.js process started with a cleared environment (without
 * the probe in NODE_OPTIONS), is not observed (PROBE_LIMIT).
 */
export const PROBE_SOURCE = `"use strict";
const fs = require("fs");
const log = process.env.${PROBE_LOG_VARIABLE};
if (typeof log === "string" && log !== "") {
  const argv1 = typeof process.argv[1] === "string" ? process.argv[1] : null;
  let real = null;
  try {
    if (argv1 !== null) real = fs.realpathSync.native(argv1);
  } catch {
    real = null;
  }
  try {
    fs.appendFileSync(log, JSON.stringify({ pid: process.pid, argv1, real }) + "\\n");
  } catch {
    // A missing record fails the launch check.
  }
}
`;

/** What the launch probe cannot observe, in every claim and doc that rests on it (review round 3 of pull request 12, finding 1). */
export const PROBE_LIMIT = "A process that is not Node.js, or a Node.js process started with a cleared environment (without the probe in NODE_OPTIONS), is not observed.";

/**
 * The environment of every process in tarball mode: the caller's npm
 * offline, prefer-online, prefer-offline, registry, cache, prefix,
 * bin-links, and node-options settings (in any spelling) are dropped, then
 * npm is set offline with the blocked registry, the smoke's new npm cache, a
 * new empty global prefix, and bin links on, so no caller cache and no
 * global install can stand in, and npm makes the launcher of each bin
 * (review round 2 of pull request 12, finding 1: with bin links off, npx
 * found no `buildos`). An environment value overrides every npmrc file, so a
 * caller's `bin-links=false` in a config file does not count either. With
 * `probe`, the caller's NODE_OPTIONS (any case) is dropped and replaced by
 * the launch probe alone, and npm's `node-options` is set to the same value
 * (review round 3, finding 3: npm sets a child's NODE_OPTIONS from its
 * `node-options` setting, so a caller's `node-options=--no-warnings` in an
 * npmrc removed the probe from the processes that npm started).
 */
export function guardedEnv(env: NodeJS.ProcessEnv, paths: { cache: string; prefix: string; probe?: string }): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (GUARD_KEYS.test(key)) continue;
    if (paths.probe !== undefined && (/^node_options$/i.test(key) || key.toUpperCase() === PROBE_LOG_VARIABLE)) continue;
    out[key] = value;
  }
  out["npm_config_offline"] = "true";
  out["npm_config_registry"] = BLOCKED_REGISTRY;
  out["npm_config_cache"] = paths.cache;
  out["npm_config_prefix"] = paths.prefix;
  out["npm_config_bin_links"] = "true";
  if (paths.probe !== undefined) {
    out["NODE_OPTIONS"] = probeNodeOptions(paths.probe);
    out["npm_config_node_options"] = probeNodeOptions(paths.probe);
  }
  return out;
}

/** The npm settings that the preflight reads (`npm config get <keys>`). */
export const PREFLIGHT_KEYS = ["offline", "registry", "bin-links", "node-options"] as const;

/** What the preflight requires `npm config get offline registry bin-links node-options` to print, for the launch probe at `probe`. */
export function preflightStdout(probe: string): string {
  return `offline=true\nregistry=${BLOCKED_REGISTRY}\nbin-links=true\nnode-options=${probeNodeOptions(probe)}\n`;
}

/** One entry of an npm cache index: its key and the integrity it records. */
export interface CacheEntry {
  key: string;
  integrity: string | undefined;
}

/** The key that cacheIndexEntries gives a line that is not an entry. */
const NOT_AN_ENTRY = "(an index line that is not an entry)";

/** The entries of an npm cache index (`<cache>/_cacache/index-v5`), from the text of its bucket files (`<hash>\t<JSON>` lines). */
export function cacheIndexEntries(bucketTexts: readonly string[]): CacheEntry[] {
  const entries: CacheEntry[] = [];
  for (const text of bucketTexts) {
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      const tab = line.indexOf("\t");
      let entry: { key?: unknown; integrity?: unknown } = {};
      try {
        entry = JSON.parse(line.slice(tab + 1)) as typeof entry;
      } catch {
        entry = {};
      }
      if (tab < 0 || typeof entry.key !== "string") {
        entries.push({ key: NOT_AN_ENTRY, integrity: undefined });
        continue;
      }
      entries.push({ key: entry.key, integrity: typeof entry.integrity === "string" ? entry.integrity : undefined });
    }
  }
  return entries;
}

/** The last part of a path or a `file:` spec, for `/` and `\` separators. */
export function lastPathPart(path: string): string {
  return path.split(/[\\/]/).pop() ?? "";
}

const FILE_KEY = "pacote:tarball:file:";

/**
 * A cache key for the report (review round 3 of pull request 12, finding 5):
 * a tarball file key for the tarball's own file name shows only that name,
 * because npm records the path relative to the folder that read it, which
 * names runner folders; any other key shows only its kind (the first two
 * `:` parts, such as `make-fetch-happen:request-cache`, or the tarball file
 * kind with "another file"), never its text, which can hold a path or a URL.
 */
export function reportCacheKey(key: string, tarballName: string): string {
  if (key === NOT_AN_ENTRY) return key;
  if (key.startsWith(FILE_KEY)) return lastPathPart(key.slice(FILE_KEY.length)) === tarballName ? `${FILE_KEY}.../${tarballName}` : `${FILE_KEY}(another file; its name is not shown)`;
  const kind = /^([a-z0-9-]+:[a-z0-9-]+):/.exec(key);
  return kind !== null ? `${kind[1]}:(the rest of the key is not shown)` : "(a key of an unknown kind; it is not shown)";
}

/**
 * The problems of the npm cache index: no entry at all (no positive
 * evidence that npm read the tarball), an entry that is not a tarball file
 * entry (a registry or other response), and an entry for a file with
 * another name or another integrity. Each names a key only by
 * reportCacheKey.
 */
export function cacheIndexProblems(entries: readonly CacheEntry[], identity: TarballIdentity, tarballName: string): string[] {
  const problems: string[] = [];
  if (entries.length === 0) problems.push("the npm cache index is empty: no evidence that npm read the tarball");
  for (const e of entries) {
    const shown = reportCacheKey(e.key, tarballName);
    if (!e.key.startsWith(FILE_KEY)) {
      problems.push(`the npm cache holds an entry that is not a tarball file entry: ${shown}`);
      continue;
    }
    if (lastPathPart(e.key.slice(FILE_KEY.length)) !== tarballName) problems.push(`the npm cache holds an entry for another file: ${shown}`);
    if (e.integrity !== identity.integrity) problems.push(`the npm cache entry ${shown} has the integrity ${e.integrity ?? "(none)"}, not the tarball's ${identity.integrity}`);
  }
  return problems;
}

/** The problems of the cache content for the tarball's integrity: missing (`contentSha256` undefined), or other bytes. */
export function cacheContentProblems(identity: TarballIdentity, contentSha256: string | undefined): string[] {
  if (contentSha256 === undefined) return [`the npm cache holds no content for the tarball's integrity ${identity.integrity}`];
  if (contentSha256 !== identity.sha256) return [`the npm cache content for the tarball's integrity has the SHA-256 ${contentSha256}, not the tarball's ${identity.sha256}`];
  return [];
}

/** The kind marks of an installed entry that is not a regular file (InstalledCopy.files). */
export const SYMLINK_MARK = "(symbolic link)";
export const NOT_REGULAR_MARK = "(not a regular file)";

/** One installed `build-os` package folder, as read from disk. */
export interface InstalledCopy {
  /** A cleaned name for the report, for example `{TMP}/project/node_modules/build-os`. */
  where: string;
  /** SHA-256 of every regular file below the folder, by its package-relative path with `/` separators; SYMLINK_MARK for a symbolic link (never followed) and NOT_REGULAR_MARK for any other kind. A Map: own entries only. */
  files: Map<string, string>;
  /** Every folder below the package folder, by its package-relative path with `/` separators (review round 3 of pull request 12, finding 4: an extra folder, also an empty one, fails). */
  dirs: string[];
  /** Each part of the folder that the traversal could not read (an unreadable folder or entry, a folder deeper than the depth limit), cleaned; any entry makes the comparison incomplete, and it fails. */
  incomplete: string[];
  /** The `node_modules/build-os` entry of the hidden lockfile `node_modules/.package-lock.json`, or undefined. */
  lock: { version?: unknown; resolved?: unknown; integrity?: unknown } | undefined;
}

/** Every folder that holds a regular file of the tarball, by its package-relative path (`dist` for `dist/buildos.js`). */
export function tarballFolders(identity: Pick<TarballIdentity, "files">): Set<string> {
  const out = new Set<string>();
  for (const path of identity.files.keys()) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) out.add(parts.slice(0, i).join("/"));
  }
  return out;
}

/**
 * The problems of one install of the tarball: none found, a traversal that
 * did not read every entry, a file of the tarball that is missing, is not a
 * regular file, or has other bytes, an entry that the tarball does not hold,
 * a folder that holds no tarball file (also an empty one), and a lockfile entry without the tarball's version, a `file:` spec of the
 * tarball's name, and the tarball's integrity. Every lookup is by own key
 * (a Map), so a path such as `constructor` or `__proto__` is compared like
 * any other (review round 2 of pull request 12, finding 2).
 */
export function copyProblems(label: string, copy: InstalledCopy | undefined, identity: TarballIdentity, tarballName: string): string[] {
  if (copy === undefined) return [`${label}: no build-os install was found`];
  const problems: string[] = [];
  for (const part of copy.incomplete) problems.push(`${label} (${copy.where}): the comparison is incomplete: ${part}`);
  for (const [path, hash] of identity.files) {
    const found = copy.files.get(path);
    if (found === undefined) problems.push(`${label} (${copy.where}): ${path} is missing`);
    else if (found === SYMLINK_MARK || found === NOT_REGULAR_MARK) problems.push(`${label} (${copy.where}): ${path} is ${found === SYMLINK_MARK ? "a symbolic link" : "not a regular file"}, where the tarball's entry is a regular file`);
    else if (found !== hash) problems.push(`${label} (${copy.where}): ${path} is not the tarball's file`);
  }
  for (const [path, found] of copy.files) if (!identity.files.has(path)) problems.push(`${label} (${copy.where}): ${path}${found === SYMLINK_MARK ? " (a symbolic link)" : found === NOT_REGULAR_MARK ? " (not a regular file)" : ""} is not in the tarball`);
  // Review round 3, finding 4: npm makes only the folders that hold the
  // tarball's files (npm pack writes no folder entry), so any other folder,
  // also an empty one, fails.
  const folders = tarballFolders(identity);
  for (const dir of copy.dirs) if (!folders.has(dir)) problems.push(`${label} (${copy.where}): the folder ${dir}/ is not in the tarball (no tarball file is below it)`);
  const lock = copy.lock;
  if (lock === undefined) problems.push(`${label} (${copy.where}): no node_modules/build-os entry in node_modules/.package-lock.json`);
  else {
    if (lock.version !== identity.version) problems.push(`${label}: the lockfile records version ${JSON.stringify(lock.version)}, not ${identity.version}`);
    if (typeof lock.resolved !== "string" || !lock.resolved.startsWith("file:") || lastPathPart(lock.resolved) !== tarballName) problems.push(`${label}: the lockfile records the source ${JSON.stringify(lock.resolved)}, not a file: spec of ${tarballName}`);
    if (lock.integrity !== identity.integrity) problems.push(`${label}: the lockfile records the integrity ${JSON.stringify(lock.integrity)}, not the tarball's ${identity.integrity}`);
  }
  return problems;
}

/** One folder below `<cache>/_npx`, as read from disk. */
export interface NpxFolder {
  where: string;
  /** `_npx.packages` of its package.json (the specs that npx installed there). */
  packages: unknown;
  hasBuildOs: boolean;
}

/** The problems of the npx cache: not exactly one folder below `_npx` (whatever it holds; review round 2, finding 2), or a folder made for another spec than the tarball file. */
export function npxFolderProblems(folders: readonly NpxFolder[], tarballFile: string): string[] {
  const problems: string[] = [];
  if (folders.length !== 1) problems.push(`the npx cache holds ${folders.length} install folders, not 1`);
  if (folders.length === 1 && !folders[0]!.hasBuildOs) problems.push(`the npx folder ${folders[0]!.where} holds no node_modules/build-os`);
  for (const f of folders) {
    const specs = f.packages;
    if (!Array.isArray(specs) || specs.length !== 1 || specs[0] !== tarballFile) problems.push(`the npx folder ${f.where} was made for ${JSON.stringify(specs)}, not for the tarball file alone`);
  }
  return problems;
}

/**
 * A path for comparison (review round 3 of pull request 12, finding 1): on
 * Windows, `\` and `/` are the same separator and names are
 * case-insensitive, so both become `/` and lower case; on macOS and Linux a
 * backslash is an ordinary character of a name, and the path is compared as
 * it is. A trailing separator is removed.
 */
export function pathKey(path: string, windows: boolean): string {
  return windows ? path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() : path.replace(/\/+$/, "");
}

/** The problems of the `build-os` folders below the temporary root: each one that is not an expected install (compared case-insensitively on Windows). */
export function strayProblems(found: readonly string[], expected: readonly string[], windows = false): string[] {
  const want = new Set(expected.map((e) => pathKey(e, windows)));
  return found.filter((f) => !want.has(pathKey(f, windows))).map((f) => `another build-os folder is below the temporary root: ${f}`);
}

/** The three files that npm's cmd-shim writes for one bin on Windows: the shell shim (no extension), the `.cmd` shim, and the PowerShell shim. */
export const SHIM_EXTENSIONS = ["", ".cmd", ".ps1"] as const;

/**
 * One launcher of a bin, as read from disk. On macOS and Linux: the link
 * (or file) `<bin folder>/<name>`, with the absolute path that it resolves
 * to. On Windows (review round 3 of pull request 12, finding 2): each of the
 * three shims, compared byte for byte with the shim that the selected npm's
 * own cmd-shim writes for the same bin file in the same relative layout
 * (`equal`); no target is parsed from the text.
 */
export interface LauncherRead {
  /** The bin name, for example `buildos`. */
  name: string;
  files: { where: string; kind: "symlink" | "file" | "shim" | "missing"; resolved?: string; equal?: boolean; reason?: string }[];
}

/**
 * The problems of the launchers of one route (review round 2 of pull
 * request 12, finding 1; round 3, finding 2): each named bin must have its
 * launcher. On macOS and Linux npm makes a symbolic link, which must resolve
 * to that bin's file inside the verified copy (a regular file there is not
 * npm's launcher). On Windows each shim must be byte-equal to the canonical
 * shim of that bin file.
 */
export function launcherProblems(route: string, launchers: readonly LauncherRead[], expected: ReadonlyMap<string, string>, windows: boolean): string[] {
  const problems: string[] = [];
  for (const [name, want] of expected) {
    const l = launchers.find((x) => x.name === name);
    if (l === undefined || l.files.length === 0) {
      problems.push(`${route}: no launcher was read for the bin ${name}`);
      continue;
    }
    for (const f of l.files) {
      if (f.kind === "missing") problems.push(`${route}: the launcher ${f.where} is missing`);
      else if (f.kind === "shim") {
        if (!windows) problems.push(`${route}: the launcher ${f.where} is a Windows shim, not npm's symbolic link`);
        else if (f.equal !== true) problems.push(`${route}: the shim ${f.where} is not byte-equal to the shim that the selected npm's cmd-shim writes for the package's bin file ${want}${f.reason !== undefined ? ` (${f.reason})` : ""}`);
      } else if (f.resolved === undefined) problems.push(`${route}: the launcher ${f.where} resolves to no file${f.reason !== undefined ? ` (${f.reason})` : ""}`);
      else if (!windows && f.kind !== "symlink") problems.push(`${route}: the launcher ${f.where} is a regular file, not npm's symbolic link`);
      else if (windows) problems.push(`${route}: the launcher ${f.where} is not one of npm's Windows shims`);
      else if (pathKey(f.resolved, windows) !== pathKey(want, windows)) problems.push(`${route}: the launcher ${f.where} resolves to ${f.resolved}, not to the package's bin file ${want}`);
    }
  }
  return problems;
}

/** One record of the launch probe: the main script of one Node.js process, as started and as a real path. */
export interface LaunchRecord {
  argv1: string | null;
  real: string | null;
}

/** The records of a launch log (one JSON line per process); a line that is not a record is kept as one with no paths, so it fails. */
export function launchRecords(text: string): LaunchRecord[] {
  const out: LaunchRecord[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const r = JSON.parse(line) as { argv1?: unknown; real?: unknown };
      out.push({ argv1: typeof r.argv1 === "string" ? r.argv1 : null, real: typeof r.real === "string" ? r.real : null });
    } catch {
      out.push({ argv1: null, real: null });
    }
  }
  return out;
}

/**
 * The npm programs that may start in a step (review round 3 of pull request
 * 12, finding 1): the exact real paths of the program files of the one npm
 * installation that the run selected in the preflight (the npm next to the
 * Node.js that runs the smoke): `bin/npm-cli.js` and `bin/npx-cli.js`, and
 * on Windows `bin/npm-prefix.js`, which npm's `npx.cmd` shim starts first to
 * find the global prefix (seen in CI run 45994727376). No path suffix of
 * another npm installation counts.
 */
export function npmPrograms(npmRoot: string, windows: boolean): string[] {
  const sep = windows ? "\\" : "/";
  return ["npm-cli.js", "npx-cli.js", ...(windows ? ["npm-prefix.js"] : [])].map((f) => `${npmRoot}${sep}bin${sep}${f}`);
}

/**
 * The problems of the launch records of one step (review round 2 of pull
 * request 12, finding 1; round 3, finding 1). The records are the entry
 * scripts of the Node.js processes that the launch probe observed in the
 * step (PROBE_LIMIT says what it cannot observe). Each must be one of the
 * `expected` files or one of the `allowed` files (the selected npm's own
 * programs, and for the wrapper step the project's own helper), each
 * compared as an exact real path (pathKey), and at least one must be an
 * expected file.
 */
export function launchProblems(step: string, records: readonly LaunchRecord[], expected: readonly string[], allowed: readonly string[], windows: boolean): string[] {
  const want = new Set(expected.map((e) => pathKey(e, windows)));
  const ok = new Set(allowed.map((h) => pathKey(h, windows)));
  const problems: string[] = [];
  let ran = 0;
  for (const r of records) {
    if (r.real === null) {
      problems.push(`step "${step}": the launch probe observed a Node.js process with the entry script ${r.argv1 ?? "(none)"}, whose real path could not be read`);
      continue;
    }
    const key = pathKey(r.real, windows);
    if (want.has(key)) ran++;
    else if (!ok.has(key)) problems.push(`step "${step}": the launch probe observed the entry script ${r.real}, which is not ${expected.join(" or ")} and not an allowed program (${allowed.length > 0 ? allowed.join(", ") : "none"})`);
  }
  if (ran === 0) problems.push(`step "${step}": the launch probe observed no Node.js process with the entry script ${expected.join(" or ")}`);
  return problems;
}

/** The part of the smoke that a step plays, for the claims of the report. */
export type StepRole =
  | "guard-preflight"
  | "direct"
  | "npx-copy"
  | "wrapper-missing"
  | "project-install"
  | "wrapper"
  | "fix-check"
  | "fix-run"
  | "fix-after"
  | "project-copy"
  | "cache-guard";

/** What the claims read of a step: its name, role, outcome, and check labels (already cleaned for the report). */
export interface StepOutcome {
  name: string;
  role?: StepRole | undefined;
  ok: boolean;
  checks: readonly { check: string; ok: boolean }[];
}

export interface TarballClaims {
  /** What this run proved: each claim only when every step it rests on ran and passed. */
  proves: string[];
  /** Each claim that this run did not prove, with the steps that did not run or failed. */
  not_proven: string[];
  /** Each step that ran nothing it could have run, with the reason it recorded. */
  not_run: string[];
}

/**
 * The claims of a tarball-mode report, made only from the steps that ran and
 * their outcomes (review round 1 of pull request 12, finding 2). A claim
 * about a step appears in `proves` only when that step and every check it
 * rests on ran and passed; else it appears in `not_proven` with the reason.
 * When step 10 ran no command (the 0.1.0 form, or a mismatch), `not_run`
 * says so with the step's own recorded reason, and no claim says it ran.
 */
export function tarballClaims(steps: readonly StepOutcome[], tarball: { version: string; sha256: string; integrity: string }): TarballClaims {
  const of = (role: StepRole) => steps.filter((s) => s.role === role);
  const proves: string[] = [];
  const notProven: string[] = [];
  const notRun: string[] = [];
  const claim = (text: string, needs: StepRole[]): void => {
    const reasons: string[] = [];
    for (const role of needs) {
      const ran = of(role);
      if (ran.length === 0) reasons.push(`the ${role} step did not run`);
      for (const s of ran) if (!s.ok) reasons.push(`step "${s.name}" failed`);
    }
    if (reasons.length === 0) proves.push(text);
    else notProven.push(`${text} Not proven: ${reasons.join("; ")}.`);
  };
  claim(`Every process that the smoke started got npm offline, the blocked registry ${BLOCKED_REGISTRY}, bin links on, and node-options set to the launch probe, and npm read those values in the preflight; the npm cache holds only entries for the tarball file with its integrity ${tarball.integrity}, whose cache content has the SHA-256 ${tarball.sha256}: no build-os came from a registry.`, ["guard-preflight", "cache-guard"]);
  const direct = of("direct").length;
  claim(`The ${direct} direct runs (version to the legacy name, steps 1 to 7) ran through npx -y --package=<tarball> -- buildos with one npx install folder made for the tarball file, whose build-os package holds exactly the tarball's regular files with the tarball's bytes and no other entry; its launchers (node_modules/.bin) resolve to that package's bin files (macOS and Linux: npm's symbolic links; Windows: shims byte-equal to the ones that the selected npm's cmd-shim writes); in each of these runs, the entry scripts of the Node.js processes that the launch probe observed were only the selected npm's own programs and that package's bin file, with that bin file at least once (${PROBE_LIMIT}); and no other build-os folder was below the temporary root.`, ["guard-preflight", "direct", "npx-copy", "cache-guard"]);
  claim(`The project wrapper (step 9) printed version ${tarball.version} with the project's local install of the tarball in place, which holds exactly the tarball's regular files with the tarball's bytes after step 10: the wrapper's own lookup chose that install's bin file, and the entry scripts of the Node.js processes that the launch probe observed in step 9 were only the project's .os/scripts/pinned-version.cjs and that bin file, with that bin file at least once (${PROBE_LIMIT}).`, ["project-install", "wrapper", "project-copy", "cache-guard"]);
  const check = of("fix-check");
  if (of("fix-run").length > 0) {
    claim(`Step 10 checked the printed fix command text exactly (the JSON field and the human action: line) and ran that text, as printed, through the system shell; the project's build-os launcher resolves to the local install's bin file, and the entry scripts of the Node.js processes that the launch probe observed in that run were only the selected npm's own programs and that bin file, with that bin file at least once (registry blocked; ${PROBE_LIMIT}); entities validate then reported a current index.`, ["fix-check", "fix-run", "fix-after", "project-copy", "cache-guard"]);
  } else if (check.length > 0) {
    const reason = check[check.length - 1]!.checks.at(-1)?.check ?? "no reason was recorded";
    notRun.push(`Step 10 ran no printed command: ${reason}`);
  } else {
    notRun.push("Step 10 did not run.");
  }
  return { proves, not_proven: notProven, not_run: notRun };
}

/**
 * What the install checks compare, for the report (review round 2 of pull
 * request 12, finding 2; round 3, finding 4): a fixed statement of the
 * method, with the tarball's own count of entries that are not regular files
 * or folders.
 */
export function comparisonStatement(identity: Pick<TarballIdentity, "files" | "nonFileEntries">): string {
  const links = identity.nonFileEntries.length === 0 ? "The tarball holds no entry that is not a regular file or a folder (no symbolic link, no hard link)." : `The tarball holds ${identity.nonFileEntries.length} entries that are not regular files or folders: ${identity.nonFileEntries.join(", ")}; they are not compared.`;
  return `Each install is compared with the tarball by the bytes (SHA-256) of each regular file, by its package-relative path: each of the tarball's ${identity.files.size} regular files must be in the install as a regular file with the same bytes (a symbolic link or another kind there fails), the install may hold no other entry of any kind (no other file, link, or folder; a folder that holds no tarball file, also an empty one, fails), and a part of the install that cannot be read fails the comparison. File modes, owners, and times are not compared. ${links}`;
}

/** What tarball mode cannot prove in any run, for the report (no claim about a step that ran). */
export const TARBALL_MODE_LIMITS = {
  does_not_prove: [
    "That npx -y build-os@<version> fetches the package from the public registry: before publication the version is not there. The literal printed command with a registry fetch is proven only after publication (runbook step k, the smoke on the published version).",
    "That the registry copy has the same bytes as this tarball: that is runbook step h1 (the stage download) and step k (npm pack of the published version).",
    "The project wrapper's npx fallback (no local install): that needs the published version (runbook step k).",
    `Every executable that a step ran. The launch probe (a --require preload in NODE_OPTIONS and npm's node-options) shows only the entry scripts of the Node.js processes that it observed in each step. ${PROBE_LIMIT} Such a process leaves no record, so the report cannot name it or show that it did not run.`,
  ],
};

/**
 * Absolute paths in report text (review round 3 of pull request 12, finding
 * 5): a POSIX path (a `/` and a name character, at the start of a line or
 * after a space, a quote, or one of `( [ < = , ;`) and a Windows drive path
 * (a letter, `:`, and a separator, not after a letter or digit). A
 * placeholder such as `{TMP}/project` is not matched, because a `/` after
 * `}` is not one of these starts, and a URL is not matched, because its
 * `//` follows `:`.
 */
export const ABSOLUTE_PATH_PATTERNS: readonly RegExp[] = [/(?<=^|[\s"'`(\[<=,;])\/[A-Za-z0-9._~$%@+-]/gm, /(?<![A-Za-z0-9])[A-Za-z]:[\\/]/g];

/** What scrubAbsolutePaths puts in place of an absolute path that the cleaning did not replace. */
export const ABSOLUTE_PATH_MARK = "{ABSOLUTE-PATH}";

/**
 * The text with each absolute path that the cleaning left (ABSOLUTE_PATH_PATTERNS)
 * replaced by ABSOLUTE_PATH_MARK, up to the next space, quote, or one of
 * `) ] > , ;`, and the number replaced. The report runs it on every string
 * as the last step, so no report holds an absolute path, and it records the
 * number (`absolute_paths_removed`); the cleaning is expected to leave none.
 */
export function scrubAbsolutePaths(text: string): { text: string; removed: number } {
  let removed = 0;
  const out = text
    .replace(/(?<=^|[\s"'`(\[<=,;])\/[A-Za-z0-9._~$%@+-][^\s"'`)\]>,;]*/gm, () => {
      removed++;
      return ABSOLUTE_PATH_MARK;
    })
    .replace(/(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'`)\]>,;]*/g, () => {
      removed++;
      return ABSOLUTE_PATH_MARK;
    });
  return { text: out, removed };
}
