// The checks of the privileged release jobs (W1 R7 P8 review rounds 1 and
// 2). Node built-ins only; it imports nothing but scripts/release-ledger.ts
// (and, through it, scripts/tar-reader.mjs). The privileged jobs of
// .github/workflows/buildos-release.yml run it from the TRUSTED checkout (the
// default-branch commit that `resolve` found), never from the candidate, with
// no node_modules and no build. They read the candidate only as data: its
// ledger by commit and path from git, and the tarball as bytes.
//
//   node scripts/release-stage-check.ts digest --repo <git dir> --commit <sha> --tag <tag> --tarball <file> [--expect-sha256 <digest>]
//       The committed ledger at <commit> (a regular blob, mode 100644, read
//       with git; P8-R2-08) has a reviewed entry for <tag>, and the tarball:
//       its SHA-256, computed here, equals that entry (and --expect-sha256
//       when given); its name is the entry's; every entry of it is a regular
//       file or folder under package/, read with the strict tar reader (no
//       duplicate path, no truncated or malformed archive; P8-R2-06); and its
//       package.json names this package at the entry's version, with no
//       publishConfig, no top-level tag, no private, no lifecycle script, and
//       no runtime dependency (P8-R2-02). Prints tarball_sha256, dist_tag,
//       tarball_name, source_commit (also to the GitHub step output).
//   node scripts/release-stage-check.ts precheck --visibility <v> --repository <owner/repo> [--require-oidc]
//       The npm provenance preconditions, before anything else: a public
//       repository and (with --require-oidc) the GitHub OIDC token request.
//   node scripts/release-stage-check.ts stage <the digest options> --visibility <v> --repository <owner/repo> [--require-oidc]
//       The digest checks, then the provenance preconditions with the
//       tarball's repository URL.
//   node scripts/release-stage-check.ts publish <the stage options> --work <empty folder> [--npm-cli <npm-cli.js>]
//       The stage checks, then `npm stage publish <tarball> --provenance
//       --access public --tag <latest|next> --registry https://registry.npmjs.org/
//       --ignore-scripts` from an empty folder, with an environment that has
//       no npm_config_* value and empty user and global npmrc files (P8-R2-02).
//       The dist-tag comes from the reviewed entry's version here, never from
//       the tarball or an input.
//
// Prints `release stage check <name>: pass` or `... FAIL: <reason>`; exit 0
// or 1 (2 for a usage error). Every check fails closed.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  distTagFor,
  entryFor,
  isFullSha,
  isReleaseTag,
  isSha256,
  loadCandidatesAtCommit,
  packedManifestProblems,
  PACKAGE_NAME,
  readTarball,
  type ReleaseCandidate,
  repositoryUrlOf,
  sha256,
  tarballLayoutProblems,
  writeGithubOutput,
} from "./release-ledger.ts";

/** The one registry the release stages to. */
export const NPM_REGISTRY = "https://registry.npmjs.org/";

export interface CheckResult {
  name: string;
  problems: string[];
  notes: string[];
  outputs: Record<string, string>;
}

export interface DigestInput {
  /** A git clone that holds the commit (the trusted checkout, full history). */
  repo: string;
  /** The resolved release commit: the ledger is read from it. */
  commit: string;
  tag: string;
  tarball: string;
  /** A digest an earlier job reported; checked when given. */
  expectSha256?: string | undefined;
}

/** The digest, layout, and manifest checks of a tarball against the committed ledger at a commit. */
export function digestCheck(input: DigestInput): CheckResult & { entry?: ReleaseCandidate; pkg?: Record<string, unknown> } {
  const fail = (problem: string) => ({ name: "digest", problems: [problem], notes: [], outputs: {} });
  if (!isReleaseTag(input.tag)) return fail(`the tag "${input.tag}" is not v followed by an exact semver version`);
  if (!isFullSha(input.commit)) return fail(`the commit "${input.commit}" is not a full commit SHA`);
  const problems: string[] = [];
  if (input.expectSha256 !== undefined && !isSha256(input.expectSha256)) problems.push("the digest passed on by an earlier job is not a SHA-256");
  let candidates;
  try {
    candidates = loadCandidatesAtCommit(input.repo, input.commit).candidates;
  } catch (error) {
    return fail((error as Error).message);
  }
  const { entry, problem } = entryFor(candidates, input.tag, "release");
  if (entry === undefined) return fail(problem ?? "no entry");
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(input.tarball));
  } catch {
    return fail(`the tarball ${basename(input.tarball)} cannot be read`);
  }
  const actual = sha256(bytes);
  if (input.expectSha256 !== undefined && actual !== input.expectSha256) problems.push(`the tarball SHA-256 ${actual} is not the ${input.expectSha256} an earlier job checked`);
  if (actual !== entry.tarball_sha256) problems.push(`the tarball SHA-256 ${actual} is not the reviewed ${entry.tarball_sha256} of ${input.tag} in the committed ledger at ${input.commit}`);
  if (basename(input.tarball) !== entry.tarball_name) problems.push(`the tarball is named ${basename(input.tarball)}, the reviewed entry names ${entry.tarball_name}`);
  let pkg: Record<string, unknown> | undefined;
  try {
    const { entries, files } = readTarball(bytes);
    problems.push(...tarballLayoutProblems(entries));
    const body = files.get("package/package.json");
    if (body === undefined) problems.push("the tarball has no package/package.json");
    else {
      pkg = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
      problems.push(...packedManifestProblems(pkg, { version: entry.version }));
    }
  } catch (error) {
    problems.push(`the tarball cannot be read as an npm tarball: ${(error as Error).message}`);
  }
  const outputs = { tarball_sha256: actual, dist_tag: distTagFor(entry.version), tarball_name: entry.tarball_name, source_commit: entry.source_commit };
  return { name: "digest", problems, notes: [`tarball SHA-256 ${actual}; reviewed entry ${entry.tag} (${entry.reviewed_by}, ${entry.reviewed_on}); ledger read from git at ${input.commit}`], outputs, entry, ...(pkg === undefined ? {} : { pkg }) };
}

/** npm provenance preconditions. In dry-run mode a problem is a note, so a dry run can show the rest. */
export function provenanceCheck(input: {
  mode: "release" | "dry-run";
  visibility: string | undefined;
  repository: string | undefined;
  /** The tarball's or the checkout's package.json repository URL; undefined skips the URL check (the precheck). */
  repositoryUrl: string | undefined;
  checkUrl?: boolean;
  requireOidc: boolean;
  env: NodeJS.ProcessEnv;
}): CheckResult {
  const problems: string[] = [];
  if (input.visibility !== "public") {
    problems.push(`npm provenance needs a public GitHub repository, and this repository is ${input.visibility ?? "of unknown visibility"}. npm would refuse the provenance statement, so the package is not staged. Make the repository public (an owner decision), then publish the release again.`);
  }
  if (input.repository === undefined || input.repository === "") problems.push("the GitHub repository name is unknown (GITHUB_REPOSITORY or --repository)");
  else if (input.checkUrl !== false && input.repositoryUrl !== `git+https://github.com/${input.repository}.git`) {
    problems.push(`package.json repository.url is ${input.repositoryUrl ?? "missing"}; npm trusted publishing and provenance need git+https://github.com/${input.repository}.git`);
  }
  if (input.requireOidc && (input.env["ACTIONS_ID_TOKEN_REQUEST_URL"] === undefined || input.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"] === undefined)) {
    problems.push("this job cannot request a GitHub OIDC token (it needs permissions id-token: write), so npm trusted publishing and provenance cannot work");
  }
  if (input.mode === "dry-run") return { name: "provenance", problems: [], notes: problems.map((p) => `dry run: ${p}`), outputs: {} };
  return { name: "provenance", problems, notes: [], outputs: {} };
}

/**
 * The npm CLI next to this Node (where actions/setup-node puts its npm). It
 * is started with this Node, never through a shell.
 */
export function npmCliNextToNode(execPath: string = process.execPath, platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? join(dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js") : join(dirname(execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
}

/** Environment names that must not reach npm: every npm setting, tokens, and Node options. */
export function droppedFromNpmEnv(name: string): boolean {
  return /^npm_config_/i.test(name) || ["NPM_ID_TOKEN", "NODE_AUTH_TOKEN", "NPM_TOKEN", "NODE_OPTIONS", "NODE_PATH"].includes(name.toUpperCase());
}

/**
 * The exact `npm stage publish` command (P8-R2-02). Flag names checked
 * against npm 11.19.1 (`npm stage publish --help`, lib/commands/publish.js,
 * and @npmcli/config definitions): `--tag`, `--access`, `--provenance`,
 * `--registry`, and `--ignore-scripts`. npm merges a packed manifest's
 * publishConfig into its settings except for keys given on the command
 * line; the digest check refuses a publishConfig anyway. The user and
 * global npmrc are empty files and no npm_config_* value is inherited, so
 * no npmrc and no environment value can change the registry, the dist-tag,
 * or the access.
 */
export function stagePublishPlan(input: { tarball: string; distTag: "latest" | "next"; work: string; env: NodeJS.ProcessEnv; npmCli: string }): { argv: string[]; env: NodeJS.ProcessEnv; cwd: string; files: Record<string, string> } {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(input.env)) if (!droppedFromNpmEnv(k) && v !== undefined) env[k] = v;
  const userconfig = join(input.work, "empty-userconfig");
  const globalconfig = join(input.work, "empty-globalconfig");
  env["NPM_CONFIG_USERCONFIG"] = userconfig;
  env["NPM_CONFIG_GLOBALCONFIG"] = globalconfig;
  env["NPM_CONFIG_CACHE"] = join(input.work, "npm-cache");
  env["NPM_CONFIG_UPDATE_NOTIFIER"] = "false";
  return {
    argv: [input.npmCli, "stage", "publish", input.tarball, "--provenance", "--access", "public", "--tag", input.distTag, "--registry", NPM_REGISTRY, "--ignore-scripts"],
    env,
    cwd: join(input.work, "cwd"),
    files: { [userconfig]: "", [globalconfig]: "" },
  };
}

/** Problems with the npm the plan would run: a builtin npmrc next to it could set the registry. */
export function npmInstallProblems(npmCli: string): string[] {
  if (!existsSync(npmCli)) return [`npm is not at ${npmCli}`];
  const builtin = join(dirname(npmCli), "..", "npmrc");
  return existsSync(builtin) ? [`npm's builtin config file ${builtin} exists; it could set the registry, so the release does not stage`] : [];
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new UsageError(`${name} needs a value`);
  return value;
}

function required(argv: string[], name: string): string {
  const value = option(argv, name);
  if (value === undefined) throw new UsageError(`${name} is required`);
  return value;
}

export class UsageError extends Error {}

const DIGEST_OPTIONS = ["--repo", "--commit", "--tag", "--tarball", "--expect-sha256"];
const PRECHECK_OPTIONS = ["--visibility", "--repository"];
const STAGE_OPTIONS = [...DIGEST_OPTIONS, ...PRECHECK_OPTIONS];
const PUBLISH_OPTIONS = [...STAGE_OPTIONS, "--work", "--npm-cli"];
const FLAGS = ["--require-oidc"];

/** Runs one subcommand. `run` starts npm (tests pass a recorder). */
export function runStageCheck(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  run: (plan: ReturnType<typeof stagePublishPlan>) => { status: number | null } = (plan) => spawnSync(process.execPath, plan.argv, { cwd: plan.cwd, env: plan.env, stdio: "inherit" }),
): CheckResult[] {
  const [command, ...rest] = argv;
  const allowed = { digest: DIGEST_OPTIONS, precheck: PRECHECK_OPTIONS, stage: STAGE_OPTIONS, publish: PUBLISH_OPTIONS }[command as "digest"];
  if (allowed === undefined) throw new UsageError("the first argument must be digest, precheck, stage, or publish");
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] ?? "";
    if (command !== "digest" && FLAGS.includes(arg)) continue;
    if (!allowed.includes(arg)) throw new UsageError(`unknown argument ${arg.startsWith("--") ? arg : "(not an option)"}`);
    i++;
  }
  const requireOidc = rest.includes("--require-oidc");
  if (command === "precheck") {
    return [provenanceCheck({ mode: "release", visibility: required(rest, "--visibility"), repository: required(rest, "--repository"), repositoryUrl: undefined, checkUrl: false, requireOidc, env })];
  }
  const digest = digestCheck({ repo: resolve(required(rest, "--repo")), commit: required(rest, "--commit"), tag: required(rest, "--tag"), tarball: resolve(required(rest, "--tarball")), expectSha256: option(rest, "--expect-sha256") });
  if (command === "digest") return [digest];
  const provenance = provenanceCheck({ mode: "release", visibility: required(rest, "--visibility"), repository: required(rest, "--repository"), repositoryUrl: digest.pkg === undefined ? undefined : repositoryUrlOf(digest.pkg), requireOidc, env });
  if (command === "stage") return [digest, provenance];
  const results: CheckResult[] = [digest, provenance];
  if (digest.problems.length > 0 || provenance.problems.length > 0 || digest.entry === undefined) return results;
  const work = resolve(required(rest, "--work"));
  const npmCli = resolve(option(rest, "--npm-cli") ?? npmCliNextToNode());
  const publishProblems: string[] = [...npmInstallProblems(npmCli)];
  if (existsSync(work) && readdirSync(work).length > 0) publishProblems.push(`the work folder ${work} is not empty`);
  if (publishProblems.length > 0) return [...results, { name: "publish", problems: publishProblems, notes: [], outputs: {} }];
  const plan = stagePublishPlan({ tarball: resolve(required(rest, "--tarball")), distTag: distTagFor(digest.entry.version), work, env, npmCli });
  mkdirSync(plan.cwd, { recursive: true });
  for (const [file, text] of Object.entries(plan.files)) writeFileSync(file, text);
  const status = run(plan).status;
  const note = `npm stage publish ${PACKAGE_NAME}@${digest.entry.version} --tag ${distTagFor(digest.entry.version)} --registry ${NPM_REGISTRY}`;
  return [...results, { name: "publish", problems: status === 0 ? [] : [`npm stage publish exited ${String(status)}`], notes: [note], outputs: {} }];
}

export function formatCheck(r: CheckResult): string {
  const lines = r.notes.map((n) => `  ${n}`);
  return [r.problems.length === 0 ? `release stage check ${r.name}: pass` : `release stage check ${r.name}: FAIL: ${r.problems.join("; ")}`, ...lines].join("\n");
}

/** True when this file is the script Node started (real paths, so a symlinked temp folder still matches). */
function isMain(): boolean {
  const started = process.argv[1];
  if (started === undefined) return false;
  try {
    return realpathSync(resolve(started)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  try {
    const results = runStageCheck(process.argv.slice(2));
    const failed = results.some((r) => r.problems.length > 0);
    for (const r of results) process.stdout.write(`${formatCheck(r)}\n`);
    const summary = process.env["GITHUB_STEP_SUMMARY"];
    if (summary !== undefined && summary !== "") for (const r of results) appendFileSync(summary, `- release stage check \`${r.name}\`: ${r.problems.length === 0 ? "pass" : `FAIL: ${r.problems.join("; ")}`}\n`);
    if (!failed) {
      const outputs = Object.assign({}, ...results.map((r) => r.outputs)) as Record<string, string>;
      for (const [k, v] of Object.entries(outputs)) process.stdout.write(`${k}=${v}\n`);
      writeGithubOutput(outputs);
    }
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    process.stdout.write(`release stage check: FAIL: ${(error as Error).message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
