// The release ledger (toolkits/buildos/release-candidates.json) and the
// small checks the privileged release jobs run (W1 R7 P8 review round 1,
// P8-R1-04 and P8-R1-06). Node built-ins only: this module and
// scripts/release-stage-check.ts must run in a job that has no
// node_modules (test/release-privileged.test.ts runs them in a clean copy).
// Never import a build module, an npm package, or a file under src/ here.
//
// An entry has a `kind`:
//   reviewed  a maintainer inspected the downloaded tarball and recorded its
//             SHA-256 (`release-candidate.ts compute`). Only this kind may be
//             in the committed ledger, and only this kind passes release mode.
//   self      a dry run made it from its own build (the agreement case of
//             A64). It is never a review. The tooling writes it only to a
//             file outside the repository, and the committed ledger refuses it.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { duplicatePaths, readTar } from "./tar-reader.mjs";

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = resolve(PACKAGE_ROOT, "..", "..");
export const PACKAGE_NAME = "build-os";
/** The ledger, as a path from the repository root. The only file that may differ between the reviewed commit and the tag commit. */
export const CANDIDATES_REPO_PATH = "toolkits/buildos/release-candidates.json";
export const CANDIDATES_FILE = join(PACKAGE_ROOT, "release-candidates.json");

export const ENTRY_KINDS = ["reviewed", "self"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** One ledger entry. Every field is required; no other field is allowed. */
export interface ReleaseCandidate {
  kind: EntryKind;
  version: string;
  tag: string;
  tarball_name: string;
  tarball_sha256: string;
  source_commit: string;
  node_version: string;
  npm_version: string;
  runner_image: string;
  reviewed_by: string;
  reviewed_on: string;
  review_evidence: string;
}

export interface CandidatesFile {
  schema_version: 2;
  candidates: ReleaseCandidate[];
}

export const LEDGER_SCHEMA_VERSION = 2;

export const CANDIDATE_FIELDS: readonly (keyof ReleaseCandidate)[] = [
  "kind",
  "version",
  "tag",
  "tarball_name",
  "tarball_sha256",
  "source_commit",
  "node_version",
  "npm_version",
  "runner_image",
  "reviewed_by",
  "reviewed_on",
  "review_evidence",
];

const NUMERIC = "0|[1-9][0-9]*";
const PRERELEASE_ID = `(?:${NUMERIC}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const EXACT_VERSION = new RegExp(`^(?:${NUMERIC})\\.(?:${NUMERIC})\\.(?:${NUMERIC})(?:-${PRERELEASE_ID}(?:\\.${PRERELEASE_ID})*)?$`);

/** An exact semver version with no build metadata (the same rule as src/core/init/manifest.ts, which this module may not import). */
export function isExactVersion(version: string): boolean {
  return version.length <= 256 && EXACT_VERSION.test(version);
}

/** The release tag of a version: `v<version>`. */
export function tagForVersion(version: string): string {
  return `v${version}`;
}

/** True for a release tag: `v` and an exact version. */
export function isReleaseTag(tag: string): boolean {
  return tag.startsWith("v") && isExactVersion(tag.slice(1));
}

export function isFullSha(text: string): boolean {
  return /^[0-9a-f]{40}$/.test(text);
}

export function isSha256(text: string): boolean {
  return /^[0-9a-f]{64}$/.test(text);
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(file: string): string {
  return sha256(new Uint8Array(readFileSync(file)));
}

/** The npm tarball file name of a version (`npm pack` names it so). */
export function tarballName(name: string, version: string): string {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

/** The npm dist-tag a version goes to: `next` for a prerelease, else `latest`. */
export function distTagFor(version: string): "latest" | "next" {
  return version.includes("-") ? "next" : "latest";
}

/** Problems with one entry. Empty when it is well formed. */
export function candidateProblems(entry: unknown, index: number): string[] {
  const at = `candidates[${index}]`;
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [`${at} is not an object`];
  const record = entry as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(record)) {
    if (!(CANDIDATE_FIELDS as readonly string[]).includes(key)) problems.push(`${at} has an unknown field "${key}"`);
  }
  for (const key of CANDIDATE_FIELDS) {
    if (typeof record[key] !== "string" || (record[key] as string).trim() === "") problems.push(`${at}.${key} is missing or empty`);
  }
  if (problems.length > 0) return problems;
  const c = record as unknown as ReleaseCandidate;
  if (!(ENTRY_KINDS as readonly string[]).includes(c.kind)) problems.push(`${at}.kind "${c.kind}" is not reviewed or self`);
  if (!isExactVersion(c.version)) problems.push(`${at}.version "${c.version}" is not an exact semver version`);
  if (c.tag !== tagForVersion(c.version)) problems.push(`${at}.tag "${c.tag}" is not ${tagForVersion(c.version)}`);
  if (c.tarball_name !== tarballName(PACKAGE_NAME, c.version)) problems.push(`${at}.tarball_name "${c.tarball_name}" is not ${tarballName(PACKAGE_NAME, c.version)}`);
  if (!isSha256(c.tarball_sha256)) problems.push(`${at}.tarball_sha256 is not 64 lowercase hex characters`);
  if (!isFullSha(c.source_commit)) problems.push(`${at}.source_commit is not a full 40-character commit SHA`);
  if (!/^v\d+\.\d+\.\d+$/.test(c.node_version)) problems.push(`${at}.node_version "${c.node_version}" is not an exact Node version such as v24.22.3`);
  if (!/^\d+\.\d+\.\d+$/.test(c.npm_version)) problems.push(`${at}.npm_version "${c.npm_version}" is not an exact npm version`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.reviewed_on)) problems.push(`${at}.reviewed_on "${c.reviewed_on}" is not a date in the form YYYY-MM-DD`);
  return problems;
}

/**
 * Problems with a whole candidates file. `committed: true` is the rule for
 * the committed ledger: only `reviewed` entries.
 */
export function candidatesFileProblems(value: unknown, options: { committed?: boolean } = {}): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["the file is not a JSON object"];
  const record = value as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(record)) if (key !== "schema_version" && key !== "candidates") problems.push(`unknown top-level field "${key}"`);
  if (record["schema_version"] !== LEDGER_SCHEMA_VERSION) problems.push(`schema_version is not ${LEDGER_SCHEMA_VERSION}`);
  if (!Array.isArray(record["candidates"])) return [...problems, "candidates is not a list"];
  const tags = new Set<string>();
  const digests = new Set<string>();
  (record["candidates"] as unknown[]).forEach((entry, index) => {
    problems.push(...candidateProblems(entry, index));
    const e = (entry ?? {}) as Record<string, unknown>;
    if (typeof e["tag"] === "string") {
      if (tags.has(e["tag"])) problems.push(`candidates[${index}] repeats tag ${e["tag"]}`);
      tags.add(e["tag"]);
    }
    if (typeof e["tarball_sha256"] === "string") {
      if (digests.has(e["tarball_sha256"])) problems.push(`candidates[${index}] repeats tarball SHA-256 ${e["tarball_sha256"]}`);
      digests.add(e["tarball_sha256"]);
    }
    if (options.committed === true && e["kind"] === "self") problems.push(`candidates[${index}] is a dry-run self entry; the committed ledger holds reviewed entries only`);
  });
  return problems;
}

/** Parses and checks the text of a candidates file. Throws with every problem. */
export function parseCandidates(text: string, label: string, options: { committed?: boolean } = {}): CandidatesFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`release candidates file ${label} cannot be read as JSON: ${(error as Error).message}`);
  }
  const problems = candidatesFileProblems(value, options);
  if (problems.length > 0) throw new Error(`release candidates file ${label} is not valid:\n  ${problems.join("\n  ")}`);
  return value as CandidatesFile;
}

/**
 * Reads and checks a candidates file from disk. Only for a dry run's self
 * entry outside the repository and for maintainer tools; a release reads
 * the committed ledger by commit and path (`loadCandidatesAtCommit`).
 */
export function loadCandidates(file: string = CANDIDATES_FILE, options: { committed?: boolean } = {}): CandidatesFile {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`release candidates file ${file} cannot be read as JSON: ${(error as Error).message}`);
  }
  return parseCandidates(text, file, options);
}

function gitRun(repo: string, args: string[]): { status: number | null; stdout: Buffer } {
  const run = spawnSync("git", ["-C", repo, ...args], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  if (run.error !== undefined) throw new Error(`git could not run: ${run.error.message}`);
  return { status: run.status, stdout: run.stdout };
}

/**
 * The tree entry of a path at a commit, read with `git ls-tree` (W1 R7 P8
 * review round 2, P8-R2-08): its mode, object type, and object id, or
 * undefined when the commit has no entry at that path.
 */
export function treeEntryAt(repo: string, commit: string, path: string): { mode: string; type: string; object: string } | undefined {
  if (!isFullSha(commit)) throw new Error(`"${commit}" is not a full commit SHA`);
  const run = gitRun(repo, ["ls-tree", "-z", "--full-tree", commit, "--", path]);
  if (run.status !== 0) throw new Error(`git ls-tree failed for commit ${commit} (is the commit in this clone?)`);
  const out = run.stdout.toString("utf8").split("\0").filter((l) => l !== "");
  const line = out.find((l) => l.slice(l.indexOf("\t") + 1) === path);
  if (line === undefined) return undefined;
  const [mode = "", type = "", object = ""] = line.slice(0, line.indexOf("\t")).split(" ");
  return { mode, type, object };
}

/** Problems with the ledger's tree entry at a commit: it must be a regular file blob, mode 100644. */
export function ledgerEntryProblems(entry: { mode: string; type: string } | undefined, commit: string): string[] {
  if (entry === undefined) return [`the commit ${commit} has no ${CANDIDATES_REPO_PATH}`];
  if (entry.type !== "blob" || entry.mode !== "100644") return [`${CANDIDATES_REPO_PATH} at ${commit} is not a regular file (git mode ${entry.mode}, type ${entry.type}); the ledger must be a plain file with mode 100644, never a link`];
  return [];
}

/**
 * The committed ledger at a commit, read by commit and path as data (W1 R7
 * P8 review round 2, P8-R2-08). The tree entry must be a regular blob with
 * mode 100644, so a symbolic link or an executable never counts as the
 * ledger, and nothing in a working tree is read or followed.
 */
export function loadCandidatesAtCommit(repo: string, commit: string): CandidatesFile {
  const entry = treeEntryAt(repo, commit, CANDIDATES_REPO_PATH);
  const problems = ledgerEntryProblems(entry, commit);
  if (problems.length > 0 || entry === undefined) throw new Error(problems.join("; "));
  const run = gitRun(repo, ["cat-file", "blob", entry.object]);
  if (run.status !== 0) throw new Error(`git cat-file could not read ${CANDIDATES_REPO_PATH} at ${commit}`);
  return parseCandidates(run.stdout.toString("utf8"), `${CANDIDATES_REPO_PATH} at ${commit}`, { committed: true });
}

/** The entry of a tag. In release mode only a `reviewed` entry is returned. */
export function entryFor(candidates: ReleaseCandidate[], tag: string, mode: "release" | "dry-run"): { entry?: ReleaseCandidate; problem?: string } {
  const entry = candidates.find((c) => c.tag === tag);
  if (entry === undefined) return { problem: `release-candidates.json has no reviewed entry for tag ${tag}` };
  if (mode === "release" && entry.kind !== "reviewed") return { problem: `the entry for ${tag} is a ${entry.kind} entry, not a reviewed one; a release needs a reviewed entry` };
  return { entry };
}

// ---------------------------------------------------------------- Tarball reader

export interface TarEntry {
  path: string;
  type: "file" | "dir" | "other";
  mode: number;
  size: number;
  sha256: string;
}

/**
 * Reads a gzipped tar (an npm tarball) with the strict reader
 * (scripts/tar-reader.mjs; W1 R7 P8 review round 2, P8-R2-06). Returns the
 * entries in archive order, with each file's SHA-256. Throws on a malformed
 * or truncated archive and on a path that occurs twice (when a tar is
 * extracted, the later entry replaces the earlier one, so a check of one
 * copy would not describe what installs).
 */
export function readTarball(bytes: Uint8Array): { entries: TarEntry[]; files: Map<string, Buffer> } {
  const raw = readTar(new Uint8Array(gunzipSync(bytes)));
  const duplicates = duplicatePaths(raw);
  if (duplicates.length > 0) throw new Error(`the tarball holds ${duplicates.length} path(s) more than once`);
  const entries: TarEntry[] = [];
  const files = new Map<string, Buffer>();
  for (const e of raw) {
    const type = e.type === "file" ? "file" : e.type === "dir" ? "dir" : "other";
    entries.push({ path: e.path, type, mode: e.mode, size: e.size, sha256: e.body === undefined ? "" : sha256(e.body) });
    if (e.body !== undefined) files.set(e.path, Buffer.from(e.body));
  }
  return { entries, files };
}

/** The package.json inside an npm tarball, read as data (nothing from the tarball runs). */
export function tarballPackageJson(tarball: string): Record<string, unknown> {
  const { files } = readTarball(new Uint8Array(readFileSync(tarball)));
  const body = files.get("package/package.json");
  if (body === undefined) throw new Error(`${tarball} has no package/package.json`);
  return JSON.parse(body.toString("utf8")) as Record<string, unknown>;
}

/** npm lifecycle script names (docs.npmjs.com, Scripts); any `pre` or `post` hook counts too. */
export const LIFECYCLE_SCRIPTS = [
  "preinstall", "install", "postinstall", "prepublish", "preprepare", "prepare", "postprepare", "prepublishOnly",
  "prepack", "postpack", "publish", "postpublish", "preversion", "version", "postversion", "dependencies",
  "preuninstall", "uninstall", "postuninstall", "prestage", "stage", "poststage",
] as const;

/**
 * Problems with the package.json inside a tarball that npm would act on when
 * it stages the file (W1 R7 P8 review round 2, P8-R2-02). npm reads the
 * packed manifest: `publishConfig` can hold any npm setting (a registry, a
 * dist-tag, an access level), and a top-level `tag` was read as one too. So
 * the stage check refuses them, an unexpected name, version, or `private`,
 * any lifecycle script, and any runtime dependency field.
 */
export function packedManifestProblems(pkg: Record<string, unknown>, expect: { version: string }): string[] {
  const problems: string[] = [];
  if (pkg["name"] !== PACKAGE_NAME) problems.push(`the tarball's package.json names ${String(pkg["name"])}, not ${PACKAGE_NAME}`);
  if (pkg["version"] !== expect.version) problems.push(`the tarball's package.json has version ${String(pkg["version"])}, the reviewed entry needs ${expect.version}`);
  for (const key of ["publishConfig", "tag", "private", "dependencies", "optionalDependencies", "peerDependencies", "bundleDependencies", "bundledDependencies", "workspaces"]) {
    if (Object.prototype.hasOwnProperty.call(pkg, key)) problems.push(`the tarball's package.json has a "${key}" field, which the release never ships (npm could act on it when it stages the file)`);
  }
  const scripts = pkg["scripts"];
  if (scripts !== undefined) {
    if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) problems.push("the tarball's package.json scripts field is not an object");
    else {
      const hooks = Object.keys(scripts).filter((k) => (LIFECYCLE_SCRIPTS as readonly string[]).includes(k) || /^(pre|post)/.test(k));
      if (hooks.length > 0) problems.push(`the tarball's package.json declares lifecycle script(s): ${hooks.join(", ")}`);
    }
  }
  return problems;
}

/** Problems with the layout of a tarball: every entry a regular file or folder under package/, no link, no path that leaves it. */
export function tarballLayoutProblems(entries: readonly TarEntry[]): string[] {
  const problems: string[] = [];
  for (const e of entries) {
    const parts = e.path.split("/");
    if (!e.path.startsWith("package/") || e.path.includes("\\") || parts.some((p) => p === ".." || p === ".") || e.path.includes("\0")) problems.push("the tarball holds a path outside package/");
    else if (e.type !== "file" && e.type !== "dir") problems.push("the tarball holds an entry that is not a regular file or a folder");
  }
  return [...new Set(problems)];
}

/** The repository URL of a package.json (string or `{ url }`). */
export function repositoryUrlOf(pkg: Record<string, unknown>): string | undefined {
  const repository = pkg["repository"];
  if (typeof repository === "string") return repository;
  if (typeof repository === "object" && repository !== null && typeof (repository as Record<string, unknown>)["url"] === "string") return (repository as Record<string, string>)["url"];
  return undefined;
}

/** Appends `name=value` lines to the GitHub step output file, when there is one. Refuses a value with a line break. */
export function writeGithubOutput(values: Record<string, string>, env: NodeJS.ProcessEnv = process.env): void {
  for (const [name, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value) || /[\r\n=]/.test(name)) throw new Error(`step output ${name} holds a line break`);
  }
  const file = env["GITHUB_OUTPUT"];
  if (file === undefined || file === "") return;
  appendFileSync(file, Object.entries(values).map(([name, value]) => `${name}=${value}\n`).join(""));
}
