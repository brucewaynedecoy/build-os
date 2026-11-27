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
// npm cache, and a new empty global prefix (`npm_config_prefix`), each in one
// spelling only. So npm makes no network request at all, a request for
// `build-os` from a registry fails (ENOTCACHED), and no global install can
// stand in. The run then requires positive evidence of which bytes ran:
// - Before step 1: npm reads offline and the blocked registry. When it does
//   not, the run stops there, writes the report, and runs no other step.
// - After step 7, before the project install exists: the npx install that
//   steps 1 to 7 ran. npx (libnpmexec in npm 11.19.1, the npm of CI) installs
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
//   root (the global prefix is there too).
// - After step 10: the project install that the wrapper (step 9) and the
//   printed command of step 10 ran, by the same file and lockfile checks, and
//   the npx install again (the `entities validate --json` runs of step 10).
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
// text (review round 1, finding 2).

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
  /** SHA-256 of every file of the package, by its package-relative path (the first path part, `package/`, removed, as npm extracts it). */
  files: Record<string, string>;
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
  const files: Record<string, string> = {};
  for (const e of entries) {
    if (e.type !== "file" || e.body === undefined) continue;
    if (byPath.has(e.path)) throw new Error(`the tarball holds ${e.path} twice`);
    byPath.set(e.path, e.body);
    const rel = e.path.split("/").slice(1).join("/");
    if (rel !== "") files[rel] = sha256Hex(e.body);
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
  const binPaths = typeof pkg.bin === "object" && pkg.bin !== null ? Object.values(pkg.bin as Record<string, unknown>) : [];
  for (const p of binPaths) {
    if (typeof p !== "string") continue;
    const rel = p.replace(/^\.\//, "");
    const body = byPath.get(`package/${rel}`);
    if (body === undefined) throw new Error(`the tarball holds no bin file ${rel}`);
    bins[rel] = sha256Hex(body);
  }
  if (Object.keys(bins).length === 0) throw new Error("the tarball's package.json names no bin file");
  return { sha256: sha256Hex(bytes), integrity: sha512Integrity(bytes), name: pkg.name, version: pkg.version, bins, files };
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
const GUARD_KEYS = /^npm_config_(offline|prefer[-_]online|prefer[-_]offline|registry|cache|prefix)$/i;

/**
 * The environment of every process in tarball mode: the caller's npm
 * offline, prefer-online, prefer-offline, registry, cache, and prefix
 * settings (in any spelling) are dropped, then npm is set offline with the
 * blocked registry, the smoke's new npm cache, and a new empty global
 * prefix, so no caller cache and no global install can stand in.
 */
export function guardedEnv(env: NodeJS.ProcessEnv, paths: { cache: string; prefix: string }): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (GUARD_KEYS.test(key)) continue;
    out[key] = value;
  }
  out["npm_config_offline"] = "true";
  out["npm_config_registry"] = BLOCKED_REGISTRY;
  out["npm_config_cache"] = paths.cache;
  out["npm_config_prefix"] = paths.prefix;
  return out;
}

/** One entry of an npm cache index: its key and the integrity it records. */
export interface CacheEntry {
  key: string;
  integrity: string | undefined;
}

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
        entries.push({ key: "(an index line that is not an entry)", integrity: undefined });
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

/** A cache key for the report: a tarball file key shows only its file name, because npm records the path relative to the folder that read it, which names runner folders. */
export function reportCacheKey(key: string): string {
  return key.startsWith(FILE_KEY) ? `${FILE_KEY}.../${lastPathPart(key.slice(FILE_KEY.length))}` : key;
}

/**
 * The problems of the npm cache index: no entry at all (no positive
 * evidence that npm read the tarball), an entry that is not a tarball file
 * entry (a registry or other response), and an entry for a file with
 * another name or another integrity.
 */
export function cacheIndexProblems(entries: readonly CacheEntry[], identity: TarballIdentity, tarballName: string): string[] {
  const problems: string[] = [];
  if (entries.length === 0) problems.push("the npm cache index is empty: no evidence that npm read the tarball");
  for (const e of entries) {
    if (!e.key.startsWith(FILE_KEY)) {
      problems.push(`the npm cache holds an entry that is not a tarball file entry: ${e.key}`);
      continue;
    }
    if (lastPathPart(e.key.slice(FILE_KEY.length)) !== tarballName) problems.push(`the npm cache holds an entry for another file: ${e.key}`);
    if (e.integrity !== identity.integrity) problems.push(`the npm cache entry ${e.key} has the integrity ${e.integrity ?? "(none)"}, not the tarball's ${identity.integrity}`);
  }
  return problems;
}

/** The problems of the cache content for the tarball's integrity: missing (`contentSha256` undefined), or other bytes. */
export function cacheContentProblems(identity: TarballIdentity, contentSha256: string | undefined): string[] {
  if (contentSha256 === undefined) return [`the npm cache holds no content for the tarball's integrity ${identity.integrity}`];
  if (contentSha256 !== identity.sha256) return [`the npm cache content for the tarball's integrity has the SHA-256 ${contentSha256}, not the tarball's ${identity.sha256}`];
  return [];
}

/** One installed `build-os` package folder, as read from disk. */
export interface InstalledCopy {
  /** A cleaned name for the report, for example `{TMP}/project/node_modules/build-os`. */
  where: string;
  /** SHA-256 of every file below the folder, by its package-relative path with `/` separators (`(symlink)` for a link). */
  files: Record<string, string>;
  /** The `node_modules/build-os` entry of the hidden lockfile `node_modules/.package-lock.json`, or undefined. */
  lock: { version?: unknown; resolved?: unknown; integrity?: unknown } | undefined;
}

/**
 * The problems of one install of the tarball: none found, a file of the
 * tarball that is missing or has other bytes, a file that the tarball does
 * not hold, and a lockfile entry without the tarball's version, a `file:`
 * spec of the tarball's name, and the tarball's integrity.
 */
export function copyProblems(label: string, copy: InstalledCopy | undefined, identity: TarballIdentity, tarballName: string): string[] {
  if (copy === undefined) return [`${label}: no build-os install was found`];
  const problems: string[] = [];
  for (const [path, hash] of Object.entries(identity.files)) {
    const found = copy.files[path];
    if (found === undefined) problems.push(`${label} (${copy.where}): ${path} is missing`);
    else if (found !== hash) problems.push(`${label} (${copy.where}): ${path} is not the tarball's file`);
  }
  for (const path of Object.keys(copy.files)) if (!(path in identity.files)) problems.push(`${label} (${copy.where}): ${path} is not in the tarball`);
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

/** The problems of the npx cache: not exactly one install folder, or a folder made for another spec than the tarball file. */
export function npxFolderProblems(folders: readonly NpxFolder[], tarballFile: string): string[] {
  const problems: string[] = [];
  const withBuildOs = folders.filter((f) => f.hasBuildOs);
  if (withBuildOs.length !== 1) problems.push(`the npx cache holds ${withBuildOs.length} build-os install folders, not 1`);
  for (const f of folders) {
    const specs = f.packages;
    if (!Array.isArray(specs) || specs.length !== 1 || specs[0] !== tarballFile) problems.push(`the npx folder ${f.where} was made for ${JSON.stringify(specs)}, not for the tarball file alone`);
  }
  return problems;
}

/** The problems of the `build-os` folders below the temporary root: each one that is not an expected install. */
export function strayProblems(found: readonly string[], expected: readonly string[]): string[] {
  return found.filter((f) => !expected.includes(f)).map((f) => `another build-os folder is below the temporary root: ${f}`);
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
  claim(`npm ran offline with the blocked registry ${BLOCKED_REGISTRY} for every process, and the npm cache holds only entries for the tarball file with its integrity ${tarball.integrity}, whose cache content has the SHA-256 ${tarball.sha256}: no build-os came from a registry.`, ["guard-preflight", "cache-guard"]);
  const direct = of("direct").length;
  claim(`The ${direct} direct runs (version to the legacy name, steps 1 to 7) ran through npx -y --package=<tarball> -- buildos from one npx install folder made for the tarball file, whose build-os package holds exactly the tarball's files with the tarball's bytes, and no other build-os folder was below the temporary root.`, ["guard-preflight", "direct", "npx-copy", "cache-guard"]);
  claim(`The project wrapper (step 9) ran version ${tarball.version} from the project's local install of the tarball, which holds exactly the tarball's files with the tarball's bytes after step 10.`, ["project-install", "wrapper", "project-copy", "cache-guard"]);
  const check = of("fix-check");
  if (of("fix-run").length > 0) {
    claim(`Step 10 checked the printed fix command text exactly (the JSON field and the human action: line) and ran that text, as printed, through the system shell, with npm taking build-os@${tarball.version} from the project's local install of the tarball (registry blocked); entities validate then reported a current index.`, ["fix-check", "fix-run", "fix-after", "project-copy", "cache-guard"]);
  } else if (check.length > 0) {
    const reason = check[check.length - 1]!.checks.at(-1)?.check ?? "no reason was recorded";
    notRun.push(`Step 10 ran no printed command: ${reason}`);
  } else {
    notRun.push("Step 10 did not run.");
  }
  return { proves, not_proven: notProven, not_run: notRun };
}

/** What tarball mode cannot prove in any run, for the report (no claim about a step that ran). */
export const TARBALL_MODE_LIMITS = {
  does_not_prove: [
    "That npx -y build-os@<version> fetches the package from the public registry: before publication the version is not there. The literal printed command with a registry fetch is proven only after publication (runbook step k, the smoke on the published version).",
    "That the registry copy has the same bytes as this tarball: that is runbook step h1 (the stage download) and step k (npm pack of the published version).",
    "The project wrapper's npx fallback (no local install): that needs the published version (runbook step k).",
  ],
};
