// Release candidates (W1 R7 P8 t3; review round 1, P8-R1-06): computes,
// checks, and verifies entries of toolkits/buildos/release-candidates.json
// (the ledger; schema in scripts/release-ledger.ts). A reviewed entry is
// committed before its GitHub Release; the release workflow
// (buildos-release.yml) stages a package only when the tarball has the
// entry's SHA-256.
//
//   node scripts/release-candidate.ts check [--file <candidates.json>]
//       Checks a ledger: schema version 2, every field of every entry, one
//       entry per tag and per digest. The committed ledger (the default
//       file) may hold `reviewed` entries only.
//   node scripts/release-candidate.ts compute --tarball <file> --build <release-build.json> --reviewed-by <name> --reviewed-on <YYYY-MM-DD> --evidence <text>
//       Prints the `reviewed` entry for the tarball the maintainer downloaded
//       and inspected. The digest is computed from that tarball, and it must
//       equal the digest in the run's release-build.json. Refuses a dirty
//       build, a build that is not the reference Node, npm, and runner image,
//       a tarball whose package.json is not this package at that version, and
//       a version that is not exact semver. It never writes the file: the
//       maintainer adds the printed entry by hand.
//   node scripts/release-candidate.ts verify --tag <tag> --tarball <file> [--file <candidates.json>]
//       Checks that the tarball's SHA-256 equals the reviewed entry of that tag.
//   node scripts/release-candidate.ts self --build <release-build.json> --out <file>
//       Dry runs only: writes a ledger with one `self` entry for that build
//       (the agreement case of A64). It is never a review. It refuses an
//       --out inside the repository, so a self entry cannot be committed.
//
// Maintainer steps for one release (also in toolkits/buildos/AGENTS.md and
// SECURITY.md, Release Procedure; review round 2, P8-R2-05):
//   1. Set the new version in package.json and package-lock.json; merge it.
//   2. Push that commit to a branch named release-dry-run/<short-sha> (or run
//      the workflow by hand: Actions > buildos-release > Run workflow,
//      purpose dry-run, candidates `self`). The run builds on the reference
//      runner image and uploads the tarball, release-build.json, and the
//      SBOM as the artifact
//      buildos-release-<run id>-<run attempt> (kept 3 days). The gate results are in the
//      run's job summary.
//   3. Download that artifact and inspect the tarball:
//        tar -tzvf <tarball>                     (every file, mode, and size)
//        npm diff --diff=@brucewaynedecoy/buildos@<previous> --diff=<tarball>
//                                                (against the previous release;
//                                                 skip for the first release)
//        npm install --offline --ignore-scripts --no-save --prefix <scratch> <tarball>
//        <scratch>/node_modules/.bin/buildos version --json
//        <scratch>/node_modules/.bin/buildos help
//      and read the job summary, SECURITY.md, the notices, and the SBOM.
//      Then run `compute --tarball <that tarball> --build <its release-build.json> ...`
//      and add the printed entry to release-candidates.json in a pull request.
//      Nothing else may change in that pull request: the identity gate
//      refuses a source commit whose files differ from the tag commit outside
//      this file (or where this file is not a plain file), or that is not an
//      ancestor of the tag commit.
//   4. After it merges, create the tag v<version> on that merge commit and a
//      DRAFT GitHub Release for it (`gh release create v<version> --draft
//      --verify-tag ...`).
//   5. Run the workflow from the default branch with purpose prepare and the
//      tag. It runs every verify gate, the ruleset and environment checks,
//      the real deny list, and attaches the checked tarball and the SBOM to
//      the draft.
//   6. Review the draft (download the tarball and compare its SHA-256 with
//      the entry), then publish it. With release immutability on, its tag and
//      assets are then fixed. Publishing starts the release run: it rebuilds
//      and checks again, and waits for a required reviewer to approve the
//      buildos-npm-stage environment before it stages the release asset.
//   7. Approve the staged package with `npm stage approve <stage-id>`, or on
//      npmjs.com in the Staged Packages tab of your account settings, with
//      2FA, only after the recorded maintainer approval of the publication.

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReleaseBuild } from "./release-build.ts";
import {
  CANDIDATES_FILE,
  candidateProblems,
  git,
  isFullSha,
  LEDGER_SCHEMA_VERSION,
  loadCandidates,
  PACKAGE_NAME,
  RELEASE_NODE_VERSION,
  RELEASE_NPM_VERSION,
  RELEASE_RUNNER_IMAGE_OS,
  RELEASE_RUNNER_LABEL,
  type ReleaseCandidate,
  REPO_ROOT,
  runnerImageOs,
  sha256File,
  tagForVersion,
  tarballName,
  tarballPackageJson,
} from "./release-lib.ts";

/**
 * The `reviewed` entry for a reference build. `tarball` is what the maintainer
 * downloaded and inspected: its digest is computed here and must equal the
 * build record's. Throws when the build cannot be a release candidate.
 */
export function computeCandidate(build: ReleaseBuild, review: { by: string; on: string; evidence: string }, tarball: { sha256: string; name: string; packageJson: Record<string, unknown> }): ReleaseCandidate {
  const problems: string[] = [];
  if (build.dirty || !isFullSha(build.source_revision)) problems.push(`the build is not of a clean commit (source revision "${build.source_revision}")`);
  if (build.node_version !== RELEASE_NODE_VERSION) problems.push(`the build ran on Node ${build.node_version}, not the reference ${RELEASE_NODE_VERSION}`);
  if (build.npm_version !== RELEASE_NPM_VERSION) problems.push(`the build ran with npm ${build.npm_version}, not the reference ${RELEASE_NPM_VERSION}`);
  if (build.runner_image !== RELEASE_RUNNER_IMAGE_OS) problems.push(`the build ran on runner image "${build.runner_image}", not the reference ${RELEASE_RUNNER_LABEL} (${RELEASE_RUNNER_IMAGE_OS})`);
  if (tarball.sha256 !== build.tarball_sha256) problems.push(`the inspected tarball SHA-256 ${tarball.sha256} is not the ${build.tarball_sha256} of the build record; inspect the tarball of that same run`);
  if (tarball.name !== tarballName(PACKAGE_NAME, build.version)) problems.push(`the inspected tarball is named ${tarball.name}, not ${tarballName(PACKAGE_NAME, build.version)}`);
  if (tarball.packageJson["name"] !== PACKAGE_NAME || tarball.packageJson["version"] !== build.version) {
    problems.push(`the inspected tarball holds ${String(tarball.packageJson["name"])}@${String(tarball.packageJson["version"])}, not ${PACKAGE_NAME}@${build.version}`);
  }
  const entry: ReleaseCandidate = {
    kind: "reviewed",
    version: build.version,
    tag: tagForVersion(build.version),
    tarball_name: tarballName(PACKAGE_NAME, build.version),
    tarball_sha256: tarball.sha256,
    source_commit: build.source_revision,
    node_version: build.node_version,
    npm_version: build.npm_version,
    runner_image: RELEASE_RUNNER_LABEL,
    reviewed_by: review.by,
    reviewed_on: review.on,
    review_evidence: review.evidence,
  };
  problems.push(...candidateProblems(entry, 0).map((p) => p.replace("candidates[0]", "the entry")));
  if (problems.length > 0) throw new Error(`this build cannot be a release candidate:\n  ${problems.join("\n  ")}`);
  return entry;
}

/** A dry-run entry for a build: the agreement case. It is a `self` entry and claims no review. */
export function selfCandidate(build: ReleaseBuild, head: string, imageOs: string): ReleaseCandidate {
  return {
    kind: "self",
    version: build.version,
    tag: tagForVersion(build.version),
    tarball_name: tarballName(PACKAGE_NAME, build.version),
    tarball_sha256: build.tarball_sha256,
    source_commit: head,
    node_version: build.node_version,
    npm_version: build.npm_version,
    runner_image: imageOs === RELEASE_RUNNER_IMAGE_OS ? RELEASE_RUNNER_LABEL : imageOs,
    reviewed_by: "dry run self entry (not a review)",
    reviewed_on: new Date().toISOString().slice(0, 10),
    review_evidence: "made by a release dry run for this build only",
  };
}

/** Throws when `out` is inside the repository: a self entry must never be written where it could be committed. */
export function assertOutsideRepository(out: string, repoRoot: string = REPO_ROOT, what = "a self entry is written only outside the repository (it is not a review)"): void {
  const real = (path: string) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };
  const root = real(repoRoot);
  const target = resolve(real(dirname(resolve(out))), basename(out));
  const rel = relative(root, target);
  if (rel === "" || !(rel === ".." || rel.startsWith(`..${sep}`) || resolve(rel) === rel)) {
    throw new Error(`${what}; ${out} is inside it`);
  }
}

/** The entry of a tag, or a plain reason why there is none. */
export function findCandidate(tag: string, file: string = CANDIDATES_FILE): ReleaseCandidate {
  const { candidates } = loadCandidates(file, { committed: true });
  const entry = candidates.find((c) => c.tag === tag && c.kind === "reviewed");
  if (entry === undefined) throw new Error(`release-candidates.json has no reviewed entry for tag ${tag}`);
  return entry;
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...argv] = process.argv.slice(2);
  const file = resolve(option(argv, "--file") ?? CANDIDATES_FILE);
  try {
    if (command === "check") {
      const { candidates } = loadCandidates(file, { committed: file === CANDIDATES_FILE });
      process.stdout.write(`release candidates: ${file} is valid, ${candidates.length} entr${candidates.length === 1 ? "y" : "ies"}\n`);
    } else if (command === "compute") {
      const tarball = option(argv, "--tarball");
      const buildFile = option(argv, "--build");
      const by = option(argv, "--reviewed-by");
      const on = option(argv, "--reviewed-on");
      const evidence = option(argv, "--evidence");
      if (tarball === undefined || buildFile === undefined || by === undefined || on === undefined || evidence === undefined) throw new Error("compute needs --tarball, --build, --reviewed-by, --reviewed-on, and --evidence");
      const build = JSON.parse(readFileSync(buildFile, "utf8")) as ReleaseBuild;
      const entry = computeCandidate(build, { by, on, evidence }, { sha256: sha256File(tarball), name: basename(tarball), packageJson: tarballPackageJson(tarball) });
      process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
    } else if (command === "verify") {
      const tag = option(argv, "--tag");
      const tarball = option(argv, "--tarball");
      if (tag === undefined || tarball === undefined) throw new Error("verify needs --tag and --tarball");
      const entry = findCandidate(tag, file);
      const actual = sha256File(tarball);
      if (actual !== entry.tarball_sha256) throw new Error(`the tarball SHA-256 ${actual} is not the reviewed ${entry.tarball_sha256} of ${tag}`);
      process.stdout.write(`release candidates: ${tag} tarball SHA-256 ${actual} matches the reviewed entry\n`);
    } else if (command === "self") {
      const buildFile = option(argv, "--build");
      const out = option(argv, "--out");
      if (buildFile === undefined || out === undefined) throw new Error("self needs --build and --out");
      assertOutsideRepository(out);
      const build = JSON.parse(readFileSync(buildFile, "utf8")) as ReleaseBuild;
      const entry = selfCandidate(build, git(["rev-parse", "HEAD"]), runnerImageOs());
      writeFileSync(out, `${JSON.stringify({ schema_version: LEDGER_SCHEMA_VERSION, candidates: [entry] }, null, 2)}\n`);
      process.stdout.write(`release candidates: wrote a dry-run self entry for ${entry.tag} (SHA-256 ${entry.tarball_sha256}) to ${out}\n`);
    } else {
      process.stderr.write("usage: node scripts/release-candidate.ts check | compute | verify | self (see the header of this file)\n");
      process.exit(2);
    }
  } catch (error) {
    process.stderr.write(`release candidates: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
