// GitHub API steps of the privileged release jobs (W1 R7 P8 review round 2,
// P8-R2-01, P8-R2-04, P8-R2-05, and the reviewer notes; final check,
// P8-F-01, P8-F-02, P8-F-03). Node built-ins and the global fetch only; it
// imports nothing but scripts/release-ledger.ts, scripts/release-stage-check.ts,
// and scripts/json-schema.ts (with the vendored schemas in
// scripts/schemas/cyclonedx-1.5/). The trusted jobs of
// .github/workflows/buildos-release.yml run it from the default-branch
// checkout. The token comes from the environment (GITHUB_TOKEN), never from
// the command line; it is sent only to the GitHub API and upload hosts, and
// never on a redirect to another host.
//
//   node scripts/release-github.ts environment --name <env> --allow <type:pattern>[,<type:pattern>...] [--require-reviewers] [--run-id <id>]
//       The environment exists, deploys only from exactly the listed refs
//       (for example tag:v* or branch:main,tag:v*), and, with
//       --require-reviewers, has a required-reviewers rule with at least one
//       reviewer; with --run-id, the run's review history holds an approval
//       of that environment. Needs `actions: read` (GitHub documents the
//       environment, deployment-branch-policy, and run-approval endpoints
//       under the Actions read permission). Fails closed when it cannot read
//       them.
//   node scripts/release-github.ts rulesets --branch <default branch>
//       The default branch has active rules that restrict deletion, block
//       force pushes, require a pull request with at least one approval and
//       code-owner review, and require the CI checks in REQUIRED_CHECKS; and
//       an active tag ruleset that targets refs/tags/v* restricts creation,
//       update, and deletion. GitHub lists rulesets and the effective rules of
//       a branch under the Metadata read permission, which the job token
//       always has. It cannot read the bypass list (GitHub returns it only to
//       a user with write access to the ruleset) or the immutable-releases
//       setting (Administration permission). Fails closed when it cannot read
//       the rules.
//   node scripts/release-github.ts find-draft --tag <tag>
//       Exactly one release has that tag; it is a draft with no asset, and its
//       prerelease flag fits the version. Prints release_id. Needs
//       `contents: write` (GitHub lists drafts only to push access).
//   node scripts/release-github.ts attach --release-id <id> --repo <git dir> --commit <sha> --tag <tag> --tarball <file> --sbom <file>
//       The trusted digest check of the tarball against the committed ledger
//       at <commit>; the SBOM records that tarball's SHA-256 and the reviewed
//       source commit and is valid against the vendored CycloneDX 1.5 schema;
//       the release is still that draft with no asset. Then it
//       uploads the tarball and the SBOM to that release ID and checks the
//       release lists exactly those two assets with their SHA-256 digests.
//   node scripts/release-github.ts download-asset --release-id <id> --tag <tag> --out <folder> --repo <git dir> --commit <sha> --expect-sha256 <digest> --verify-sbom <file>
//       The release is published, immutable, and has that tag; it holds
//       exactly two assets, the tarball and the SBOM of the tag's version,
//       each uploaded and with GitHub's SHA-256 digest. Downloads both (a
//       direct 200 body or a redirect, followed without the token) into
//       <folder>, checks each size and digest, the tarball against the
//       committed ledger at <commit> and the verify digest, and the SBOM: it
//       records that tarball's SHA-256 and the reviewed source commit, it is
//       valid against the vendored CycloneDX 1.5 schema, and its bytes equal
//       the SBOM that this run's verify job generated (<file>).
//   node scripts/release-github.ts discard --run-id <id> --artifact-id <id> --name <artifact name>
//       Deletes the artifact only when it belongs to that run and has that
//       name. Needs `actions: write`.
//
// Prints `release github <name>: pass` or `... FAIL: <reason>`; exit 0 or 1
// (2 for a usage error).

import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cyclonedxSchemaProblems } from "./json-schema.ts";
import { isExactVersion, isReleaseTag, isSha256, PACKAGE_NAME, sha256, tarballName, writeGithubOutput } from "./release-ledger.ts";
import { digestCheck } from "./release-stage-check.ts";

export interface GithubContext {
  repository: string;
  token: string;
  api: string;
  fetch: typeof fetch;
}

export interface Result {
  name: string;
  problems: string[];
  notes: string[];
  outputs: Record<string, string>;
}

const ok = (name: string, notes: string[] = [], outputs: Record<string, string> = {}): Result => ({ name, problems: [], notes, outputs });
const bad = (name: string, problems: string[], notes: string[] = []): Result => ({ name, problems, notes, outputs: {} });

export class UsageError extends Error {}
class ApiError extends Error {}

const SBOM_LIMIT = 16 * 1024 * 1024;
const TARBALL_LIMIT = 64 * 1024 * 1024;

function apiHeaders(ctx: GithubContext, accept = "application/vnd.github+json", contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "buildos-release",
  };
  if (contentType !== undefined) headers["Content-Type"] = contentType;
  return headers;
}

async function call(ctx: GithubContext, method: string, url: string, init: { body?: Uint8Array; contentType?: string; accept?: string } = {}): Promise<{ status: number; json: unknown; headers: Headers }> {
  const headers = apiHeaders(ctx, init.accept, init.contentType);
  const response = await ctx.fetch(url, { method, headers, redirect: "manual", ...(init.body === undefined ? {} : { body: init.body }) });
  const text = await response.text();
  let json: unknown;
  try {
    json = text === "" ? undefined : JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, headers: response.headers };
}

async function getJson(ctx: GithubContext, path: string, what: string): Promise<unknown> {
  const r = await call(ctx, "GET", `${ctx.api}${path}`);
  if (r.status !== 200) throw new ApiError(`cannot read ${what} (HTTP ${r.status})`);
  return r.json;
}

const record = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// ---------------------------------------------------------------- environment

/** Judges an environment and its deployment branch and tag policies. */
export function environmentProblems(input: { name: string; environment: unknown; policies: unknown; allow: string[]; requireReviewers: boolean }): string[] {
  const env = record(input.environment);
  const problems: string[] = [];
  if (env["name"] !== input.name) return [`the environment ${input.name} does not exist`];
  const rules = Array.isArray(env["protection_rules"]) ? (env["protection_rules"] as unknown[]).map(record) : [];
  if (input.requireReviewers) {
    const reviewers = rules.filter((r) => r["type"] === "required_reviewers").flatMap((r) => (Array.isArray(r["reviewers"]) ? (r["reviewers"] as unknown[]) : []));
    if (reviewers.length === 0) problems.push(`the environment ${input.name} has no required reviewer, so no person approves this job before it starts (Settings > Environments > ${input.name} > Required reviewers)`);
  }
  const policy = record(env["deployment_branch_policy"]);
  if (policy["custom_branch_policies"] !== true || policy["protected_branches"] !== false) {
    problems.push(`the environment ${input.name} does not limit its deployment refs to selected branches and tags (Settings > Environments > ${input.name} > Deployment branches and tags > Selected branches and tags)`);
  } else {
    const list = Array.isArray(record(input.policies)["branch_policies"]) ? (record(input.policies)["branch_policies"] as unknown[]).map(record) : [];
    const got = list.map((p) => `${String(p["type"] ?? "branch")}:${String(p["name"])}`).sort();
    const want = [...input.allow].sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`the environment ${input.name} deploys from ${got.join(", ") || "no ref"}; it must deploy from exactly ${want.join(", ")}`);
  }
  return problems;
}

/** True when the run's review history approves the environment. */
export function runApproves(approvals: unknown, name: string): boolean {
  if (!Array.isArray(approvals)) return false;
  return approvals.map(record).some((a) => a["state"] === "approved" && Array.isArray(a["environments"]) && (a["environments"] as unknown[]).map(record).some((e) => e["name"] === name));
}

export async function environmentCheck(ctx: GithubContext, input: { name: string; allow: string[]; requireReviewers: boolean; runId?: string | undefined }): Promise<Result> {
  const name = "environment";
  const encoded = encodeURIComponent(input.name);
  let environment: unknown;
  let policies: unknown;
  try {
    environment = await getJson(ctx, `/repos/${ctx.repository}/environments/${encoded}`, `the environment ${input.name}; the job needs permissions actions: read`);
    policies = record(record(environment)["deployment_branch_policy"])["custom_branch_policies"] === true ? await getJson(ctx, `/repos/${ctx.repository}/environments/${encoded}/deployment-branch-policies?per_page=100`, `the deployment refs of ${input.name}`) : {};
  } catch (error) {
    return bad(name, [(error as Error).message]);
  }
  const problems = environmentProblems({ name: input.name, environment, policies, allow: input.allow, requireReviewers: input.requireReviewers });
  if (input.runId !== undefined) {
    try {
      const approvals = await getJson(ctx, `/repos/${ctx.repository}/actions/runs/${input.runId}/approvals`, "the review history of this run");
      if (!runApproves(approvals, input.name)) problems.push(`no reviewer approved the environment ${input.name} in this run`);
    } catch (error) {
      problems.push((error as Error).message);
    }
  }
  return problems.length === 0 ? ok(name, [`environment ${input.name}: deploys from ${input.allow.join(", ")}${input.requireReviewers ? "; a required reviewer approves each job" : ""}${input.runId === undefined ? "" : "; approved in this run"}`]) : bad(name, problems);
}

// ---------------------------------------------------------------- rulesets

/** The CI checks the default-branch ruleset must require (SECURITY.md, Owner Settings for Releases). */
export const REQUIRED_CHECKS = [
  "test (ubuntu-latest, Node 24)",
  "test (macos-latest, Node 24)",
  "test (windows-latest, Node 24)",
  "OSV scan of package-lock.json",
  "Make Docs contract (pinned range bounds)",
  "Deny list (invented list, every push and pull request)",
] as const;

const RULES_HINT = "Settings > Rules > Rulesets";

/** Judges the effective active rules of the default branch (GET /repos/{repo}/rules/branches/{branch}). */
export function branchRulesProblems(rules: unknown, branch: string): string[] {
  const list = Array.isArray(rules) ? (rules as unknown[]).map(record) : [];
  const of = (type: string) => list.filter((r) => r["type"] === type);
  const problems: string[] = [];
  if (of("deletion").length === 0) problems.push(`no active rule restricts deleting ${branch} (${RULES_HINT} > the branch ruleset > Restrict deletions)`);
  if (of("non_fast_forward").length === 0) problems.push(`no active rule blocks force pushes to ${branch} (${RULES_HINT} > the branch ruleset > Block force pushes)`);
  const reviewed = of("pull_request").some((r) => {
    const p = record(r["parameters"]);
    return typeof p["required_approving_review_count"] === "number" && p["required_approving_review_count"] >= 1 && p["require_code_owner_review"] === true;
  });
  if (!reviewed) problems.push(`no active rule on ${branch} requires a pull request with at least 1 approval and code-owner review (${RULES_HINT} > the branch ruleset > Require a pull request before merging)`);
  const contexts = new Set(of("required_status_checks").flatMap((r) => {
    const checks = record(r["parameters"])["required_status_checks"];
    return Array.isArray(checks) ? (checks as unknown[]).map((c) => String(record(c)["context"])) : [];
  }));
  const missing = REQUIRED_CHECKS.filter((c) => !contexts.has(c));
  if (missing.length > 0) problems.push(`the active rules on ${branch} do not require the status check(s) ${missing.map((c) => `"${c}"`).join(", ")} (${RULES_HINT} > the branch ruleset > Require status checks to pass)`);
  return problems;
}

/** Judges the tag rulesets (each read with GET /repos/{repo}/rulesets/{id}): active, targeting refs/tags/v*, restricting creation, update, and deletion. */
export function tagRulesetProblems(rulesets: unknown[]): string[] {
  const matching = rulesets.map(record).filter((r) => {
    if (r["target"] !== "tag" || r["enforcement"] !== "active") return false;
    const ref = record(record(r["conditions"])["ref_name"]);
    const include = Array.isArray(ref["include"]) ? (ref["include"] as unknown[]) : [];
    const exclude = Array.isArray(ref["exclude"]) ? (ref["exclude"] as unknown[]) : [];
    return (include.includes("refs/tags/v*") || include.includes("~ALL")) && exclude.length === 0;
  });
  if (matching.length === 0) return [`no active tag ruleset targets refs/tags/v* with no exclusion (${RULES_HINT} > New tag ruleset, Include by pattern v*)`];
  const types = new Set(matching.flatMap((r) => (Array.isArray(r["rules"]) ? (r["rules"] as unknown[]).map((x) => String(record(x)["type"])) : [])));
  const missing = ["creation", "update", "deletion"].filter((t) => !types.has(t));
  return missing.length === 0 ? [] : [`the active tag ruleset for v* does not restrict ${missing.join(", ")} (${RULES_HINT} > the tag ruleset > Restrict creations, Restrict updates, Restrict deletions)`];
}

export async function rulesetsCheck(ctx: GithubContext, input: { branch: string }): Promise<Result> {
  const name = "rulesets";
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(input.branch)) return bad(name, ["the branch name is not a plain branch name"]);
  const branchRules: unknown[] = [];
  const tagRulesets: unknown[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const list = await getJson(ctx, `/repos/${ctx.repository}/rules/branches/${input.branch.split("/").map(encodeURIComponent).join("/")}?per_page=100&page=${page}`, `the rules of ${input.branch}`);
      if (!Array.isArray(list)) throw new ApiError(`the rules of ${input.branch} are not a list`);
      branchRules.push(...list);
      if (list.length < 100) break;
    }
    const ids: number[] = [];
    for (let page = 1; page <= 10; page++) {
      const list = await getJson(ctx, `/repos/${ctx.repository}/rulesets?targets=tag&includes_parents=true&per_page=100&page=${page}`, "the rulesets");
      if (!Array.isArray(list)) throw new ApiError("the rulesets list is not a list");
      for (const r of list.map(record)) if (r["target"] === "tag" && r["enforcement"] === "active" && Number.isSafeInteger(r["id"])) ids.push(Number(r["id"]));
      if (list.length < 100) break;
    }
    for (const id of ids) tagRulesets.push(await getJson(ctx, `/repos/${ctx.repository}/rulesets/${id}`, `ruleset ${id}`));
  } catch (error) {
    return bad(name, [(error as Error).message]);
  }
  const problems = [...branchRulesProblems(branchRules, input.branch), ...tagRulesetProblems(tagRulesets)];
  const limit = "not checked from the job: who may bypass a ruleset (GitHub returns the bypass list only to a user with write access to the ruleset) and the release-immutability setting (the stage job checks that the release itself is immutable)";
  return problems.length === 0 ? ok(name, [`${input.branch}: deletion and force pushes blocked, a pull request with code-owner review, ${REQUIRED_CHECKS.length} required checks; tags v*: creation, update, and deletion restricted`, limit]) : bad(name, problems, [limit]);
}

// ---------------------------------------------------------------- releases

interface Release {
  id: number;
  tag: string;
  draft: boolean;
  prerelease: boolean;
  immutable: boolean;
  uploadUrl: string;
  assets: { id: number; name: string; size: number; digest: string | null; state: string }[];
}

function asRelease(v: unknown): Release {
  const r = record(v);
  return {
    id: Number(r["id"]),
    tag: String(r["tag_name"]),
    draft: r["draft"] === true,
    prerelease: r["prerelease"] === true,
    immutable: r["immutable"] === true,
    uploadUrl: String(r["upload_url"] ?? ""),
    assets: (Array.isArray(r["assets"]) ? (r["assets"] as unknown[]) : []).map(record).map((a) => ({ id: Number(a["id"]), name: String(a["name"]), size: Number(a["size"]), digest: typeof a["digest"] === "string" ? a["digest"] : null, state: String(a["state"]) })),
  };
}

const versionOf = (tag: string) => tag.slice(1);

/** Problems with a draft that the prepare run attaches to. */
export function draftProblems(release: Release, tag: string): string[] {
  const problems: string[] = [];
  if (release.tag !== tag) problems.push(`release ${release.id} has the tag ${release.tag}, not ${tag}`);
  if (!release.draft) problems.push(`release ${release.id} is not a draft: assets go on a draft, before it is published and immutable`);
  if (release.prerelease !== versionOf(tag).includes("-")) problems.push(`release ${release.id} prerelease flag (${String(release.prerelease)}) does not fit the version ${versionOf(tag)}`);
  if (release.assets.length > 0) problems.push(`release ${release.id} already has ${release.assets.length} asset(s); the prepare run attaches to a draft with no asset`);
  return problems;
}

export async function findDraft(ctx: GithubContext, tag: string): Promise<Result> {
  const name = "find-draft";
  const found: Release[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const list = await getJson(ctx, `/repos/${ctx.repository}/releases?per_page=100&page=${page}`, "the releases; the job needs permissions contents: write to see drafts");
      if (!Array.isArray(list)) throw new ApiError("the releases list is not a list");
      found.push(...list.map(asRelease).filter((r) => r.tag === tag));
      if (list.length < 100) break;
    }
  } catch (error) {
    return bad(name, [(error as Error).message]);
  }
  if (found.length !== 1) return bad(name, [`${found.length} releases have the tag ${tag}; the maintainer creates exactly one draft release for it`]);
  const release = found[0] as Release;
  const problems = draftProblems(release, tag);
  return problems.length === 0 ? ok(name, [`draft release ${release.id} for ${tag}`], { release_id: String(release.id) }) : bad(name, problems);
}

/** The SBOM records the tarball digest and the reviewed source commit (the trusted binding of a candidate-made file). */
export function sbomBindingProblems(text: string, expect: { version: string; tarballSha256: string; sourceCommit: string }): string[] {
  let sbom: Record<string, unknown>;
  try {
    sbom = record(JSON.parse(text));
  } catch {
    return ["the SBOM is not JSON"];
  }
  const problems: string[] = [];
  if (sbom["bomFormat"] !== "CycloneDX" || sbom["specVersion"] !== "1.5") problems.push("the SBOM is not a CycloneDX 1.5 document");
  const main = record(record(sbom["metadata"])["component"]);
  if (main["name"] !== PACKAGE_NAME || main["version"] !== expect.version) problems.push(`the SBOM describes ${String(main["name"])}@${String(main["version"])}, not ${PACKAGE_NAME}@${expect.version}`);
  const hashes = (Array.isArray(main["hashes"]) ? (main["hashes"] as unknown[]) : []).map(record);
  if (hashes.length !== 1 || hashes[0]?.["alg"] !== "SHA-256" || hashes[0]?.["content"] !== expect.tarballSha256) problems.push("the SBOM's package hash is not the verified tarball SHA-256");
  const props = (Array.isArray(main["properties"]) ? (main["properties"] as unknown[]) : []).map(record).filter((p) => p["name"] === "buildos:source_revision");
  if (props.length !== 1 || props[0]?.["value"] !== expect.sourceCommit) problems.push("the SBOM's source revision is not the reviewed source commit");
  if (problems.length === 0) problems.push(...cyclonedxSchemaProblems(sbom));
  return problems;
}

/** Problems with the asset set of a release: exactly the expected names, each once, uploaded, with GitHub's SHA-256 digest. */
export function assetSetProblems(release: Release, expected: readonly string[]): string[] {
  const problems: string[] = [];
  const names = release.assets.map((a) => a.name);
  for (const want of expected) {
    const count = names.filter((n) => n === want).length;
    if (count !== 1) problems.push(`release ${release.id} has ${count} assets named ${want}; it must have exactly one`);
  }
  const extra = [...new Set(names.filter((n) => !expected.includes(n)))];
  if (extra.length > 0) problems.push(`release ${release.id} has asset(s) that are not part of a BuildOS release: ${extra.join(", ")}`);
  for (const a of release.assets.filter((x) => expected.includes(x.name))) {
    if (a.state !== "uploaded") problems.push(`asset ${a.name} of release ${release.id} is not fully uploaded (state ${a.state})`);
    if (a.digest === null || !/^sha256:[0-9a-f]{64}$/.test(a.digest)) problems.push(`GitHub lists no SHA-256 digest for asset ${a.name} of release ${release.id}`);
  }
  return problems;
}

/**
 * Downloads a release asset. GitHub documents two success forms for
 * `Accept: application/octet-stream`: the API streams the bytes directly
 * (200), or it redirects (302) to a storage host. The redirect is followed by
 * hand, without the Authorization header (P8-F-03).
 */
export async function downloadAssetBytes(ctx: GithubContext, assetId: number, label: string, limit: number): Promise<Uint8Array> {
  const first = await ctx.fetch(`${ctx.api}/repos/${ctx.repository}/releases/assets/${assetId}`, { method: "GET", headers: apiHeaders(ctx, "application/octet-stream"), redirect: "manual" });
  let response: Response;
  if (first.status === 200) response = first;
  else if ([301, 302, 303, 307, 308].includes(first.status)) {
    await first.body?.cancel();
    const location = first.headers.get("location");
    if (location === null || !location.startsWith("https://")) throw new ApiError(`the download of ${label} did not redirect to an https address`);
    // The token is never sent to the storage host.
    response = await ctx.fetch(location, { method: "GET", headers: { "User-Agent": "buildos-release" }, redirect: "error" });
    if (response.status !== 200) throw new ApiError(`the download of ${label} from the storage host failed (HTTP ${response.status})`);
  } else throw new ApiError(`the download of ${label} failed (HTTP ${first.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > limit) throw new ApiError(`the download of ${label} is larger than ${limit} bytes`);
  return bytes;
}

/** The upload URL of a release, from its upload_url template, bound to this repository and release ID. */
export function uploadBase(release: Release, repository: string): string {
  const base = release.uploadUrl.replace(/\{[^}]*\}$/, "");
  const want = `https://uploads.github.com/repos/${repository}/releases/${release.id}/assets`;
  if (base !== want) throw new ApiError(`the release upload URL is not ${want}`);
  return base;
}

export async function attach(ctx: GithubContext, input: { releaseId: string; repo: string; commit: string; tag: string; tarball: string; sbom: string }): Promise<Result> {
  const name = "attach";
  if (!/^[1-9][0-9]{0,19}$/.test(input.releaseId)) return bad(name, ["the release ID is not a number"]);
  const digest = digestCheck({ repo: input.repo, commit: input.commit, tag: input.tag, tarball: input.tarball });
  if (digest.problems.length > 0 || digest.entry === undefined) return bad(name, digest.problems);
  const entry = digest.entry;
  let sbomBytes: Uint8Array;
  try {
    sbomBytes = new Uint8Array(readFileSync(input.sbom));
  } catch {
    return bad(name, ["the SBOM cannot be read"]);
  }
  if (sbomBytes.length > SBOM_LIMIT) return bad(name, ["the SBOM is larger than 16 MiB"]);
  const sbomName = `buildos-${entry.version}.cdx.json`;
  const binding = sbomBindingProblems(new TextDecoder().decode(sbomBytes), { version: entry.version, tarballSha256: entry.tarball_sha256, sourceCommit: entry.source_commit });
  if (binding.length > 0) return bad(name, binding);
  const tarballBytes = new Uint8Array(readFileSync(input.tarball));
  const assets = [
    { name: entry.tarball_name, bytes: tarballBytes, type: "application/gzip" },
    { name: sbomName, bytes: sbomBytes, type: "application/vnd.cyclonedx+json" },
  ];
  try {
    const release = asRelease(await getJson(ctx, `/repos/${ctx.repository}/releases/${input.releaseId}`, `release ${input.releaseId}`));
    const problems = draftProblems(release, input.tag);
    if (problems.length > 0) return bad(name, problems);
    const base = uploadBase(release, ctx.repository);
    for (const asset of assets) {
      const r = await call(ctx, "POST", `${base}?name=${encodeURIComponent(asset.name)}`, { body: asset.bytes, contentType: asset.type });
      const got = record(r.json);
      if (r.status !== 201 || got["name"] !== asset.name || Number(got["size"]) !== asset.bytes.length) throw new ApiError(`the upload of ${asset.name} failed (HTTP ${r.status})`);
    }
    const after = asRelease(await getJson(ctx, `/repos/${ctx.repository}/releases/${input.releaseId}`, `release ${input.releaseId}`));
    const listed = after.assets.map((a) => `${a.name}:${a.size}:${a.digest ?? "none"}`).sort();
    const want = assets.map((a) => `${a.name}:${a.bytes.length}:sha256:${sha256(a.bytes)}`).sort();
    if (!after.draft || JSON.stringify(listed) !== JSON.stringify(want)) return bad(name, [`after the upload, release ${input.releaseId} does not list exactly the tarball and the SBOM with their SHA-256 digests (or is no longer a draft)`]);
  } catch (error) {
    return bad(name, [(error as Error).message]);
  }
  return ok(name, [`attached ${entry.tarball_name} (SHA-256 ${entry.tarball_sha256}) and ${sbomName} to draft release ${input.releaseId}; review the draft, then publish it`]);
}

export interface DownloadInput {
  releaseId: string;
  tag: string;
  out: string;
  /** A git clone that holds the release commit (the trusted checkout, full history). */
  repo: string;
  /** The resolved release commit: the ledger is read from it. */
  commit: string;
  /** The tarball SHA-256 that this run's verify job reported. */
  expectSha256: string;
  /** The SBOM that this run's verify job generated. */
  verifySbom: string;
}

export async function downloadAsset(ctx: GithubContext, input: DownloadInput): Promise<Result> {
  const name = "download-asset";
  if (!/^[1-9][0-9]{0,19}$/.test(input.releaseId)) return bad(name, ["the release ID is not a number"]);
  if (!isReleaseTag(input.tag) || !isExactVersion(versionOf(input.tag))) return bad(name, ["the tag is not v and an exact version"]);
  if (!isSha256(input.expectSha256)) return bad(name, ["the digest passed on by the verify job is not a SHA-256"]);
  const version = versionOf(input.tag);
  const fileName = tarballName(PACKAGE_NAME, version);
  const sbomName = `buildos-${version}.cdx.json`;
  let verifySbom: Uint8Array;
  try {
    verifySbom = new Uint8Array(readFileSync(input.verifySbom));
  } catch {
    return bad(name, ["the SBOM of this run's verify job cannot be read"]);
  }
  try {
    const release = asRelease(await getJson(ctx, `/repos/${ctx.repository}/releases/${input.releaseId}`, `release ${input.releaseId}`));
    const problems: string[] = [];
    if (release.tag !== input.tag) problems.push(`release ${release.id} has the tag ${release.tag}, not ${input.tag}`);
    if (release.draft) problems.push(`release ${release.id} is still a draft`);
    if (!release.immutable) problems.push(`release ${release.id} is not immutable: turn on release immutability (Settings > General > Releases > Enable release immutability) before the release is published, then make a new release`);
    problems.push(...assetSetProblems(release, [fileName, sbomName]));
    if (problems.length > 0) return bad(name, problems);
    const downloaded = new Map<string, Uint8Array>();
    for (const [assetName, limit] of [[fileName, TARBALL_LIMIT], [sbomName, SBOM_LIMIT]] as const) {
      const asset = release.assets.find((a) => a.name === assetName) as Release["assets"][number];
      if (asset.size > limit) return bad(name, [`release ${release.id} lists ${assetName} with ${asset.size} bytes, more than ${limit}`]);
      const bytes = await downloadAssetBytes(ctx, asset.id, assetName, limit);
      if (bytes.length !== asset.size) return bad(name, [`the downloaded ${assetName} has ${bytes.length} bytes, the release lists ${asset.size}`]);
      if (asset.digest !== `sha256:${sha256(bytes)}`) return bad(name, [`the downloaded ${assetName}'s SHA-256 is not the digest GitHub lists for it`]);
      downloaded.set(assetName, bytes);
    }
    const tarballBytes = downloaded.get(fileName) as Uint8Array;
    const sbomBytes = downloaded.get(sbomName) as Uint8Array;
    mkdirSync(input.out, { recursive: true });
    const tarballFile = join(input.out, fileName);
    writeFileSync(tarballFile, tarballBytes);
    const digest = digestCheck({ repo: input.repo, commit: input.commit, tag: input.tag, tarball: tarballFile, expectSha256: input.expectSha256 });
    if (digest.problems.length > 0 || digest.entry === undefined) return bad(name, digest.problems);
    const entry = digest.entry;
    const binding = sbomBindingProblems(new TextDecoder().decode(sbomBytes), { version: entry.version, tarballSha256: entry.tarball_sha256, sourceCommit: entry.source_commit });
    if (binding.length > 0) return bad(name, binding.map((p) => `release asset ${sbomName}: ${p}`));
    if (sha256(sbomBytes) !== sha256(verifySbom)) return bad(name, [`the release asset ${sbomName} (SHA-256 ${sha256(sbomBytes)}) is not the SBOM this run's verify job generated (SHA-256 ${sha256(verifySbom)})`]);
    const sbomFile = join(input.out, sbomName);
    writeFileSync(sbomFile, sbomBytes);
    return ok(name, [`downloaded ${fileName} (sha256:${entry.tarball_sha256}) and ${sbomName} (sha256:${sha256(sbomBytes)}) from immutable release ${release.id}; the SBOM records that tarball and source commit ${entry.source_commit}, is valid CycloneDX 1.5, and equals this run's verify SBOM`], { tarball: tarballFile, sbom: sbomFile });
  } catch (error) {
    return bad(name, [(error as Error).message]);
  }
}

// ---------------------------------------------------------------- artifacts

export async function discard(ctx: GithubContext, input: { runId: string; artifactId: string; name: string }): Promise<Result> {
  const name = "discard";
  if (!/^[1-9][0-9]{0,19}$/.test(input.runId) || !/^[1-9][0-9]{0,19}$/.test(input.artifactId)) return bad(name, ["the run ID or artifact ID is not a number"]);
  try {
    const list = record(await getJson(ctx, `/repos/${ctx.repository}/actions/runs/${input.runId}/artifacts?per_page=100`, "this run's artifacts"));
    const artifacts = (Array.isArray(list["artifacts"]) ? (list["artifacts"] as unknown[]) : []).map(record);
    const match = artifacts.find((a) => String(a["id"]) === input.artifactId);
    if (match === undefined) return bad(name, [`artifact ${input.artifactId} is not an artifact of run ${input.runId}; nothing deleted`]);
    if (match["name"] !== input.name) return bad(name, [`artifact ${input.artifactId} is not named ${input.name}; nothing deleted`]);
    const r = await call(ctx, "DELETE", `${ctx.api}/repos/${ctx.repository}/actions/artifacts/${input.artifactId}`);
    if (r.status !== 204) return bad(name, [`deleting artifact ${input.artifactId} failed (HTTP ${r.status})`]);
  } catch (error) {
    return bad(name, [(error as Error).message]);
  }
  return ok(name, [`deleted artifact ${input.artifactId} (${input.name}) of run ${input.runId}`]);
}

// ---------------------------------------------------------------- command line

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

const OPTIONS: Record<string, string[]> = {
  environment: ["--name", "--allow", "--run-id"],
  "find-draft": ["--tag"],
  attach: ["--release-id", "--repo", "--commit", "--tag", "--tarball", "--sbom"],
  "download-asset": ["--release-id", "--tag", "--out", "--repo", "--commit", "--expect-sha256", "--verify-sbom"],
  rulesets: ["--branch"],
  discard: ["--run-id", "--artifact-id", "--name"],
};

export function contextFromEnv(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): GithubContext {
  const repository = env["GITHUB_REPOSITORY"] ?? "";
  const token = env["GITHUB_TOKEN"] ?? "";
  const api = env["GITHUB_API_URL"] ?? "https://api.github.com";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new UsageError("GITHUB_REPOSITORY is not owner/repository");
  if (token === "") throw new UsageError("GITHUB_TOKEN is not set (pass it through env:, never on the command line)");
  if (api !== "https://api.github.com") throw new UsageError("GITHUB_API_URL is not https://api.github.com");
  return { repository, token, api, fetch: fetchImpl };
}

export async function runGithub(argv: string[], env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Promise<Result> {
  const [command, ...rest] = argv;
  const allowed = OPTIONS[command ?? ""];
  if (allowed === undefined) throw new UsageError(`the first argument must be one of ${Object.keys(OPTIONS).join(", ")}`);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] ?? "";
    if (command === "environment" && arg === "--require-reviewers") continue;
    if (!allowed.includes(arg)) throw new UsageError(`unknown argument ${arg.startsWith("--") ? arg : "(not an option)"}`);
    i++;
  }
  const ctx = contextFromEnv(env, fetchImpl);
  switch (command) {
    case "environment":
      return environmentCheck(ctx, { name: required(rest, "--name"), allow: required(rest, "--allow").split(","), requireReviewers: rest.includes("--require-reviewers"), runId: option(rest, "--run-id") });
    case "find-draft":
      return findDraft(ctx, required(rest, "--tag"));
    case "attach":
      return attach(ctx, { releaseId: required(rest, "--release-id"), repo: resolve(required(rest, "--repo")), commit: required(rest, "--commit"), tag: required(rest, "--tag"), tarball: resolve(required(rest, "--tarball")), sbom: resolve(required(rest, "--sbom")) });
    case "download-asset":
      return downloadAsset(ctx, { releaseId: required(rest, "--release-id"), tag: required(rest, "--tag"), out: resolve(required(rest, "--out")), repo: resolve(required(rest, "--repo")), commit: required(rest, "--commit"), expectSha256: required(rest, "--expect-sha256"), verifySbom: resolve(required(rest, "--verify-sbom")) });
    case "rulesets":
      return rulesetsCheck(ctx, { branch: required(rest, "--branch") });
    default:
      return discard(ctx, { runId: required(rest, "--run-id"), artifactId: required(rest, "--artifact-id"), name: required(rest, "--name") });
  }
}

export function formatGithub(r: Result): string {
  return [r.problems.length === 0 ? `release github ${r.name}: pass` : `release github ${r.name}: FAIL: ${r.problems.join("; ")}`, ...r.notes.map((n) => `  ${n}`)].join("\n");
}

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
    const r = await runGithub(process.argv.slice(2));
    process.stdout.write(`${formatGithub(r)}\n`);
    const summary = process.env["GITHUB_STEP_SUMMARY"];
    if (summary !== undefined && summary !== "") appendFileSync(summary, `- release github \`${r.name}\`: ${r.problems.length === 0 ? "pass" : `FAIL: ${r.problems.join("; ")}`}\n`);
    if (r.problems.length === 0) writeGithubOutput(r.outputs);
    process.exitCode = r.problems.length === 0 ? 0 : 1;
  } catch (error) {
    process.stdout.write(`release github: FAIL: ${(error as Error).message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
