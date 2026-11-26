// Shared helpers of the release scripts (W1 R7 P8 Stage 1): the reference
// build environment, git, npm, and the tarball extractor. Node built-ins
// only. The ledger (release-candidates.json), SHA-256, and the tarball reader
// are in scripts/release-ledger.ts, which the privileged jobs run without
// node_modules; this module re-exports them.
//
// See scripts/release-candidate.ts for the maintainer steps and
// scripts/release-gate.ts for the release gates.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { PACKAGE_ROOT, readTarball, REPO_ROOT, repositoryUrlOf } from "./release-ledger.ts";

export {
  CANDIDATE_FIELDS,
  CANDIDATES_FILE,
  CANDIDATES_REPO_PATH,
  candidateProblems,
  candidatesFileProblems,
  distTagFor,
  entryFor,
  ENTRY_KINDS,
  isExactVersion,
  isFullSha,
  isReleaseTag,
  isSha256,
  LEDGER_SCHEMA_VERSION,
  ledgerEntryProblems,
  loadCandidates,
  loadCandidatesAtCommit,
  packedManifestProblems,
  PACKAGE_NAME,
  parseCandidates,
  PACKAGE_ROOT,
  readTarball,
  REPO_ROOT,
  sha256,
  sha256File,
  tagForVersion,
  tarballLayoutProblems,
  tarballName,
  tarballPackageJson,
  treeEntryAt,
  writeGithubOutput,
} from "./release-ledger.ts";
export type { CandidatesFile, EntryKind, ReleaseCandidate, TarEntry } from "./release-ledger.ts";

/**
 * The reference build environment (W1 R7 P8 t2). The release build runs on
 * this runner image with this Node and this npm, and a reviewed digest is
 * only claimed for a tarball built there. `RELEASE_RUNNER_IMAGE_OS` is the
 * value GitHub sets in `ImageOS` on that image.
 */
export const RELEASE_RUNNER_LABEL = "ubuntu-24.04";
export const RELEASE_RUNNER_IMAGE_OS = "ubuntu24";
export const RELEASE_NODE_VERSION = "v24.22.3";
/** The npm that Node 24.22.3 bundles; staged publishing needs 11.15.0 or newer. */
export const RELEASE_NPM_VERSION = "11.19.1";

export interface PackageIdentity {
  name: string;
  version: string;
  repositoryUrl: string | undefined;
}

export function readPackageIdentity(root: string = PACKAGE_ROOT): PackageIdentity {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<string, unknown>;
  return { name: String(pkg["name"]), version: String(pkg["version"]), repositoryUrl: repositoryUrlOf(pkg) };
}

export function git(args: string[], cwd: string = REPO_ROOT): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Files that differ between two commits (paths from the repository root). */
export function changedFiles(from: string, to: string, repoRoot: string = REPO_ROOT): string[] {
  const out = git(["diff", "--name-only", "--no-renames", from, to, "--"], repoRoot);
  return out === "" ? [] : out.split("\n");
}

/** True when `ancestor` is `descendant` or one of its ancestors. */
export function isAncestor(ancestor: string, descendant: string, repoRoot: string = REPO_ROOT): boolean {
  const run = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: repoRoot });
  if (run.status !== 0 && run.status !== 1) throw new Error(`git merge-base --is-ancestor failed (exit ${String(run.status)})`);
  return run.status === 0;
}

/**
 * The npm CLI this Node runs: `npm_execpath` when npm started this script,
 * else the npm next to this Node (where `npm install --global npm@<version>`
 * puts the pinned npm on the release runner). Started with this Node, never
 * through a shell, so no argument is read by a shell.
 */
export function npmCliPath(env: NodeJS.ProcessEnv = process.env): string {
  const fromNpm = env["npm_execpath"];
  if (fromNpm !== undefined && /npm-cli\.js$/.test(fromNpm)) return fromNpm;
  const windows = process.platform === "win32";
  return join(dirname(process.execPath), windows ? "" : "..", windows ? "" : "lib", "node_modules", "npm", "bin", "npm-cli.js");
}

export function runNpm(args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [npmCliPath(), ...args], {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The npm version that this Node's npm reports. */
export function npmVersion(): string {
  const result = runNpm(["--version"], { cwd: PACKAGE_ROOT });
  if (result.status !== 0) throw new Error(`npm --version failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

/** The runner image as GitHub names it (`ImageOS`), or `local` outside a GitHub runner. */
export function runnerImageOs(env: NodeJS.ProcessEnv = process.env): string {
  const os = env["ImageOS"];
  return os === undefined || os === "" ? "local" : os;
}

/** Writes the files of an npm tarball under `target` (each tar path stays inside it). Returns the package folder. */
export function extractTarball(tarball: string, target: string): string {
  const { files } = readTarball(new Uint8Array(readFileSync(tarball)));
  const root = resolve(target);
  for (const [path, body] of files) {
    const destination = resolve(root, normalize(path));
    if (destination !== root && !destination.startsWith(root + sep)) throw new Error(`tarball path ${path} leaves the extract folder`);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, body);
  }
  return join(root, "package");
}
