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
// The registry guard: every process that the smoke starts gets
// `npm_config_offline=true` and `npm_config_registry=http://127.0.0.1:9/`
// (a closed local port). So npm makes no network request at all, and a
// request for `build-os` from a registry fails (ENOTCACHED). The run checks
// the guard twice: first that npm reads both values, last that the new npm
// cache holds only `pacote:tarball:file:` entries (no registry response) and
// that every `build-os` package that a step could have run (each npx cache
// install and the project's local install) has the tarball's version and
// the tarball's bytes for each bin file.

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
  name: string;
  version: string;
  /** SHA-256 of each bin file, by its package-relative path (for example `dist/buildos.js`). */
  bins: Record<string, string>;
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
  const seen = new Set<string>();
  for (const e of entries) {
    if (e.type !== "file" || e.body === undefined) continue;
    if (seen.has(e.path)) throw new Error(`the tarball holds ${e.path} twice`);
    seen.add(e.path);
    byPath.set(e.path, e.body);
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
  return { sha256: sha256Hex(bytes), name: pkg.name, version: pkg.version, bins };
}

/** The npx arguments of a direct step: the registry version, or the tarball file. */
export function npxArgs(source: SmokeSource, version: string, args: readonly string[]): string[] {
  return source.kind === "registry" ? ["-y", `build-os@${version}`, ...args] : ["-y", `--package=${source.file}`, "--", "buildos", ...args];
}

/** The npx arguments of the legacy-name step (step 7). */
export function legacyNpxArgs(source: SmokeSource, version: string): string[] {
  return ["-y", `--package=${source.kind === "registry" ? `build-os@${version}` : source.file}`, "buildos-intake", "--help"];
}

/**
 * The environment of every process in tarball mode: the caller's npm
 * offline, prefer-online, prefer-offline, and registry settings (in any
 * spelling) are dropped, then npm is set offline with the blocked registry.
 */
export function guardedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/^npm_config_(offline|prefer[-_]online|prefer[-_]offline|registry)$/i.test(key)) continue;
    out[key] = value;
  }
  out["npm_config_offline"] = "true";
  out["npm_config_registry"] = BLOCKED_REGISTRY;
  return out;
}

/** The keys of an npm cache index (`<cache>/_cacache/index-v5`), from the text of its bucket files. */
export function cacheIndexKeys(bucketTexts: readonly string[]): string[] {
  const keys: string[] = [];
  for (const text of bucketTexts) {
    for (const line of text.split("\n")) {
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      try {
        const entry = JSON.parse(line.slice(tab + 1)) as { key?: unknown };
        if (typeof entry.key === "string") keys.push(entry.key);
      } catch {
        keys.push(`(an index line that is not JSON)`);
      }
    }
  }
  return keys;
}

/** One `build-os` package folder that a step could have run. */
export interface FoundPackage {
  /** A cleaned name for the report, for example `{TMP}/npm-cache/_npx/<hash>`. */
  where: string;
  version: string | undefined;
  /** SHA-256 of each bin file of the tarball identity, as found in this folder (undefined when missing). */
  bins: Record<string, string | undefined>;
}

/**
 * The problems that the final guard check finds: a cache key that is not a
 * tarball file entry (so npm stored a registry or other network response),
 * no package at all, or a package whose version or bin bytes differ from
 * the tarball's. An empty list means the guard held.
 */
export function registryGuardProblems(input: { cacheKeys: readonly string[]; packages: readonly FoundPackage[]; identity: TarballIdentity }): string[] {
  const problems: string[] = [];
  for (const key of input.cacheKeys) if (!key.startsWith("pacote:tarball:file:")) problems.push(`the npm cache holds an entry that is not the tarball file: ${key}`);
  if (input.packages.length === 0) problems.push("no build-os package was found in the npx cache or the project");
  for (const p of input.packages) {
    if (p.version !== input.identity.version) problems.push(`${p.where} holds build-os ${p.version ?? "(no version)"}, not ${input.identity.version}`);
    for (const [bin, hash] of Object.entries(input.identity.bins)) if (p.bins[bin] !== hash) problems.push(`${p.where}: ${bin} is not the tarball's file`);
  }
  return problems;
}

/** What tarball mode proves and does not prove, for the report. */
export const TARBALL_MODE_LIMITS = {
  proves: [
    "Every step ran the package bytes of the tarball whose SHA-256 is recorded here (the registry guard and the final package check).",
    "The direct steps ran through npx, which installed the tarball into its own cache, as npx does for a registry version.",
    "The project wrapper ran the pinned version from a local install of the tarball in the project, which it accepts because the version equals the pin.",
    "Step 10: the printed fix command text is exactly the expected one in the JSON field and the human action: line, and that text, run through the system shell, works; npm resolved build-os@<version> to the project's local install of the tarball.",
  ],
  does_not_prove: [
    "That npx -y build-os@<version> fetches the package from the public registry: before publication the version is not there. The literal printed command with a registry fetch is proven only after publication (runbook step k, the smoke on the published version).",
    "That the registry copy has the same bytes as this tarball: that is runbook step h1 (the stage download) and step k (npm pack of the published version).",
    "The project wrapper's npx fallback (no local install): that needs the published version (runbook step k).",
  ],
};
