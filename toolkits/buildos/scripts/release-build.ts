// Release build (W1 R7 P8 t2 and t6): a clean bundle that reports the real
// package version and source revision, then `npm pack`, then the tarball's
// SHA-256.
//
//   node scripts/release-build.ts [--out <folder>] [--revision <commit>] [--allow-dirty]
//
// - Version: the `package.json` version. Every command and envelope reports
//   it (`buildos version`, `version` in each JSON envelope).
// - Source revision: the full commit SHA of HEAD, or `--revision <commit>`
//   (the release workflow passes the reviewed candidate's `source_commit`).
//   A given revision must be a commit whose files equal HEAD's, except
//   `toolkits/buildos/release-candidates.json`, which does not ship: so the
//   reviewed commit and the release tag commit give the same bytes. The
//   revision comes from git, never from a clock, so two builds of one commit
//   give the same tarball.
// - Dirty tree: the build refuses to run when git reports any change or
//   untracked file in the repository, or any ignored file under `system/`
//   (the build copies `system/` from the disk). With `--allow-dirty` (local
//   trials only) it builds and reports the revision as `<commit>-dirty`, so
//   such a build can never pass for a commit; the release gates compare the
//   reported revision with the reviewed one.
// - `dist/` is removed first, so nothing from an earlier build stays.
//
// Prints one JSON object: version, source_revision, dirty, tarball (path),
// tarball_sha256, node_version, npm_version, runner_image. Writes the same
// object to `<out>/release-build.json`. A plain `npm run build` stays a
// development build: version `dev`, revision `unknown`.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./build.ts";
import { CANDIDATES_REPO_PATH, changedFiles, git, isFullSha, npmVersion, PACKAGE_ROOT, readPackageIdentity, REPO_ROOT, runNpm, runnerImageOs, sha256File } from "./release-lib.ts";

export { changedFiles } from "./release-lib.ts";

export interface TreeState {
  head: string;
  /** `git status --porcelain` lines (whole repository) plus ignored files under `system/`. */
  changes: string[];
}

export function readTreeState(repoRoot: string = REPO_ROOT): TreeState {
  const head = git(["rev-parse", "HEAD"], repoRoot);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"], repoRoot);
  const ignored = git(["status", "--porcelain=v1", "--ignored", "--untracked-files=all", "--", "system"], repoRoot)
    .split("\n")
    .filter((line) => line.startsWith("!! "));
  const changes = [...status.split("\n").filter((line) => line !== ""), ...ignored];
  return { head, changes };
}

/**
 * The source revision a release build reports. Throws when the tree is dirty
 * without `allowDirty`, or when `revision` is not a commit whose files equal
 * HEAD's apart from the release-candidates file.
 */
export function releaseRevision(input: {
  state: TreeState;
  revision?: string | undefined;
  allowDirty?: boolean;
  diff?: (from: string, to: string) => string[];
}): { revision: string; dirty: boolean } {
  const { state } = input;
  let base = state.head;
  if (input.revision !== undefined) {
    if (!isFullSha(input.revision)) throw new Error(`--revision must be a full 40-character commit SHA, not "${input.revision}"`);
    const other = (input.diff ?? changedFiles)(input.revision, state.head).filter((path) => path !== CANDIDATES_REPO_PATH);
    if (other.length > 0) {
      throw new Error(`the files at ${input.revision} differ from HEAD ${state.head} outside ${CANDIDATES_REPO_PATH}: ${other.slice(0, 10).join(", ")}${other.length > 10 ? ", ..." : ""}`);
    }
    base = input.revision;
  }
  const dirty = state.changes.length > 0;
  if (dirty && input.allowDirty !== true) {
    throw new Error(`the working tree is not clean, so a release build would not match its commit (${state.changes.length} change(s), first: ${state.changes[0]}). Commit or remove the changes, or pass --allow-dirty for a local trial build.`);
  }
  return { revision: dirty ? `${base}-dirty` : base, dirty };
}

export interface ReleaseBuild {
  version: string;
  source_revision: string;
  dirty: boolean;
  tarball: string;
  tarball_sha256: string;
  node_version: string;
  npm_version: string;
  runner_image: string;
}

/** Runs `npm pack` in the package root into `out`. Returns the tarball path. */
export function npmPack(out: string, packageRoot: string = PACKAGE_ROOT): string {
  const result = runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", out], { cwd: packageRoot });
  if (result.status !== 0) throw new Error(`npm pack failed (exit ${result.status}): ${result.stderr.trim()}`);
  const packed = JSON.parse(result.stdout) as { filename: string }[];
  const filename = packed[0]?.filename;
  if (filename === undefined) throw new Error("npm pack printed no tarball name");
  return join(out, filename);
}

export async function releaseBuild(options: { out: string; revision?: string | undefined; allowDirty?: boolean }): Promise<ReleaseBuild> {
  const { version } = readPackageIdentity();
  const { revision, dirty } = releaseRevision({ state: readTreeState(), revision: options.revision, allowDirty: options.allowDirty === true });
  rmSync(join(PACKAGE_ROOT, "dist"), { recursive: true, force: true });
  await bundle({ version, sourceRevision: revision });
  mkdirSync(options.out, { recursive: true });
  const tarball = npmPack(options.out);
  const result: ReleaseBuild = {
    version,
    source_revision: revision,
    dirty,
    tarball,
    tarball_sha256: sha256File(tarball),
    node_version: process.version,
    npm_version: npmVersion(),
    runner_image: runnerImageOs(),
  };
  writeFileSync(join(options.out, "release-build.json"), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  let out: string | undefined;
  let revision: string | undefined;
  let allowDirty = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") out = argv[++i];
    else if (arg === "--revision") revision = argv[++i];
    else if (arg === "--allow-dirty") allowDirty = true;
    else {
      process.stderr.write(`release-build: unknown argument ${arg}\nusage: node scripts/release-build.ts [--out <folder>] [--revision <commit>] [--allow-dirty]\n`);
      process.exit(2);
    }
  }
  try {
    const result = await releaseBuild({ out: resolve(out ?? mkdtempSync(join(tmpdir(), "buildos-release-"))), revision, allowDirty });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`release-build: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
