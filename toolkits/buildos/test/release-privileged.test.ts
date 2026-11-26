// W1 R7 P8 review rounds 1 and 2 (P8-R1-04, P8-R1-01, P8-R1-02; P8-R2-01,
// -02, -04, -05, -06, -08, and the reviewer notes): the entry points of the
// privileged release jobs run with Node built-ins only. Each one is copied
// into a clean folder with NO node_modules (and NODE_PATH unset) and run
// there, the way the trusted jobs run them: the stage check on a tarball and
// the committed ledger read from git at a commit, the publish step with a
// recorder in place of npm, and the deny-list scanner on a tree and a
// tarball as data. The GitHub API steps run in process with a fake fetch.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { attach, branchRulesProblems, discard, downloadAsset, environmentCheck, environmentProblems, findDraft, type GithubContext, REQUIRED_CHECKS, rulesetsCheck, runApproves, sbomBindingProblems, tagRulesetProblems } from "../scripts/release-github.ts";
import { packedManifestProblems, sha256 } from "../scripts/release-ledger.ts";
import { droppedFromNpmEnv, NPM_REGISTRY, runStageCheck, stagePublishPlan } from "../scripts/release-stage-check.ts";
import { TAR_END, tarGz, tarGzRaw, ustarEntry } from "./tar-fixture.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The privileged entry points and the only files they may import. */
export const PRIVILEGED = ["scripts/release-stage-check.ts", "scripts/release-github.ts", "scripts/release-ledger.ts", "scripts/json-schema.ts", "scripts/tar-reader.mjs", "scripts/check-deny-list.mjs", "scripts/deny-list-paths.mjs"];
const ALLOWED_IMPORTS = ["./release-ledger.ts", "./release-stage-check.ts", "./json-schema.ts", "./tar-reader.mjs", "./deny-list-paths.mjs"];
const ENTRY = { stage: "scripts/release-stage-check.ts", github: "scripts/release-github.ts", scanner: "scripts/check-deny-list.mjs" };
const LEDGER_PATH = "toolkits/buildos/release-candidates.json";
const REPO_URL = "git+https://github.com/brucewaynedecoy/build-os.git";

/** A gzipped tar of `files` under package/, as npm packs it (ustar magic, checksums). */
function tarball(files: Record<string, string>): Buffer {
  return Buffer.from(tarGz(Object.fromEntries(Object.entries(files).map(([name, text]) => [`package/${name}`, text]))));
}

const goodPkg = { name: "@brucewaynedecoy/buildos", version: "9.8.7", repository: { type: "git", url: REPO_URL }, scripts: { build: "node scripts/build.ts", test: "node --test" } };

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function entry(digest: string, kind = "reviewed") {
  return { kind, version: "9.8.7", tag: "v9.8.7", tarball_name: "brucewaynedecoy-buildos-9.8.7.tgz", tarball_sha256: digest, source_commit: "a".repeat(40), node_version: "v24.22.3", npm_version: "11.19.1", runner_image: "ubuntu-24.04", reviewed_by: "fixture reviewer", reviewed_on: "2026-11-24", review_evidence: "fixture, not a release" };
}

describe("privileged release entry points run with no node_modules (P8-R1-04, P8-R2-01)", () => {
  let dir: string;
  let pkg: string;
  let repo: string;
  let tgz: string;
  let digest: string;
  /** Commits of the scratch repository: the ledger as a plain file, as a link, and as an executable. */
  const commits: Record<"good" | "symlink" | "executable" | "self", string> = { good: "", symlink: "", executable: "", self: "" };
  const env = (): NodeJS.ProcessEnv => ({ PATH: process.env["PATH"] ?? "", SystemRoot: process.env["SystemRoot"] ?? "" });
  const run = (file: string, args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [join(pkg, file), ...args], { cwd: dir, encoding: "utf8", env: { ...env(), ...extra } });
  const digestArgs = (commit: string, file = tgz, d = digest) => ["--repo", repo, "--commit", commit, "--tag", "v9.8.7", "--tarball", file, "--expect-sha256", d];

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "buildos-privileged-"));
    pkg = join(dir, "trusted", "toolkits", "buildos");
    mkdirSync(join(pkg, "scripts"), { recursive: true });
    for (const file of PRIVILEGED) copyFileSync(join(packageRoot, file), join(pkg, file));
    // The vendored CycloneDX schemas that scripts/json-schema.ts reads (P8-F-02).
    cpSync(join(packageRoot, "scripts", "schemas"), join(pkg, "scripts", "schemas"), { recursive: true });
    const bytes = tarball({ "package.json": `${JSON.stringify(goodPkg)}\n`, "README.md": "an ordinary file\n" });
    mkdirSync(join(dir, "out"));
    tgz = join(dir, "out", "brucewaynedecoy-buildos-9.8.7.tgz");
    writeFileSync(tgz, bytes);
    digest = sha256(new Uint8Array(bytes));
    // A scratch repository whose commits hold the ledger in different git modes.
    repo = join(dir, "repo");
    mkdirSync(join(repo, "toolkits", "buildos"), { recursive: true });
    git(repo, ["init", "-q", "-b", "main"]);
    git(repo, ["config", "user.email", "fixture@example.invalid"]);
    git(repo, ["config", "user.name", "Fixture"]);
    git(repo, ["config", "commit.gpgsign", "false"]);
    git(repo, ["config", "core.symlinks", "true"]);
    const ledger = join(repo, LEDGER_PATH);
    writeFileSync(ledger, `${JSON.stringify({ schema_version: 2, candidates: [entry(digest)] })}\n`);
    git(repo, ["add", "."]);
    git(repo, ["commit", "-q", "-m", "good"]);
    commits.good = git(repo, ["rev-parse", "HEAD"]);
    // The same text with mode 100755.
    git(repo, ["update-index", "--chmod=+x", LEDGER_PATH]);
    git(repo, ["commit", "-q", "-m", "executable"]);
    commits.executable = git(repo, ["rev-parse", "HEAD"]);
    git(repo, ["update-index", "--chmod=-x", LEDGER_PATH]);
    // The ledger as a symbolic link (mode 120000) to a file that holds a valid ledger.
    writeFileSync(join(repo, "toolkits", "buildos", "other.json"), readFileSync(ledger));
    rmSync(ledger);
    const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd: repo, input: "other.json", encoding: "utf8" }).stdout.trim();
    git(repo, ["add", "toolkits/buildos/other.json"]);
    git(repo, ["update-index", "--add", "--cacheinfo", `120000,${blob},${LEDGER_PATH}`]);
    git(repo, ["commit", "-q", "-m", "symlink"]);
    commits.symlink = git(repo, ["rev-parse", "HEAD"]);
    // A self entry in the committed ledger.
    git(repo, ["rm", "-q", "--cached", LEDGER_PATH]);
    writeFileSync(ledger, `${JSON.stringify({ schema_version: 2, candidates: [entry(digest, "self")] })}\n`);
    git(repo, ["add", LEDGER_PATH]);
    git(repo, ["commit", "-q", "-m", "self"]);
    commits.self = git(repo, ["rev-parse", "HEAD"]);
    // A working-tree file that would pass if it were read: the checks must read git, not this.
    writeFileSync(ledger, `${JSON.stringify({ schema_version: 2, candidates: [entry(digest)] })}\n`);
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it("the copies import only node: built-ins and each other, and no node_modules is reachable", () => {
    for (const file of PRIVILEGED) {
      const text = readFileSync(join(packageRoot, file), "utf8");
      for (const m of text.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gms)) {
        const spec = m[1] ?? "";
        assert.ok(spec.startsWith("node:") || ALLOWED_IMPORTS.includes(spec), `${file} imports ${spec}`);
      }
      assert.doesNotMatch(text, /import\(\s*["'](?!node:)/, `${file} has a dynamic import of a package`);
    }
    for (let d = pkg; d !== dirname(d); d = dirname(d)) assert.equal(existsSync(join(d, "node_modules")), false, `${d} has node_modules`);
  });

  it("digest: passes for the reviewed tarball with the ledger read from git at the commit, and prints the dist-tag", () => {
    const out = join(dir, "github-output");
    writeFileSync(out, "");
    const r = run(ENTRY.stage, ["digest", ...digestArgs(commits.good)], { GITHUB_OUTPUT: out });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /release stage check digest: pass/);
    assert.match(r.stdout, new RegExp(`ledger read from git at ${commits.good}`));
    assert.equal(readFileSync(out, "utf8"), `tarball_sha256=${digest}\ndist_tag=latest\ntarball_name=brucewaynedecoy-buildos-9.8.7.tgz\nsource_commit=${"a".repeat(40)}\n`);
  });

  it("P8-R2-08: refuses the ledger as a symbolic link or an executable at the commit, and a self entry", () => {
    const link = run(ENTRY.stage, ["digest", ...digestArgs(commits.symlink)]);
    assert.equal(link.status, 1);
    assert.match(link.stdout, /is not a regular file \(git mode 120000, type blob\)/);
    const exec = run(ENTRY.stage, ["digest", ...digestArgs(commits.executable)]);
    assert.equal(exec.status, 1);
    assert.match(exec.stdout, /git mode 100755/);
    const self = run(ENTRY.stage, ["digest", ...digestArgs(commits.self)]);
    assert.equal(self.status, 1);
    assert.match(self.stdout, /dry-run self entry; the committed ledger holds reviewed entries only/);
  });

  it("digest: fails for another expected digest, a bad tag, and a usage error", () => {
    assert.match(run(ENTRY.stage, ["digest", ...digestArgs(commits.good, tgz, "f".repeat(64))]).stdout, /is not the f{64} an earlier job checked/);
    assert.equal(run(ENTRY.stage, ["digest", "--repo", repo, "--commit", commits.good, "--tag", "v9.8.7\nx=1", "--tarball", tgz]).status, 1);
    assert.equal(run(ENTRY.stage, ["digest", "--repo", repo, "--bogus", "1"]).status, 2);
  });

  it("P8-R2-02: refuses a tarball whose package.json has publishConfig, a top-level tag, private, a lifecycle script, or a dependency", () => {
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ publishConfig: { registry: "https://example.invalid/" } }, /"publishConfig" field/],
      [{ tag: "evil" }, /"tag" field/],
      [{ private: false }, /"private" field/],
      [{ scripts: { postinstall: "node x.js" } }, /lifecycle script\(s\): postinstall/],
      [{ scripts: { prepack: "x" } }, /lifecycle script\(s\): prepack/],
      [{ dependencies: { left: "1.0.0" } }, /"dependencies" field/],
      [{ name: "@someone/else" }, /names @someone\/else/],
      [{ version: "9.8.8" }, /has version 9\.8\.8/],
    ];
    for (const [change, pattern] of cases) assert.match(packedManifestProblems({ ...goodPkg, ...change }, { version: "9.8.7" }).join(" "), pattern, JSON.stringify(change));
    assert.deepEqual(packedManifestProblems(goodPkg, { version: "9.8.7" }), []);
    // End to end: such a tarball, even with the right digest in the ledger, is refused.
    const bad = tarball({ "package.json": JSON.stringify({ ...goodPkg, publishConfig: { tag: "latest", registry: "https://example.invalid/" } }) });
    const r = runStageCheck(["digest", "--repo", repo, "--commit", commits.good, "--tag", "v9.8.7", "--tarball", writeTo("bad1", bad)]);
    assert.match(r[0]?.problems.join(" ") ?? "", /"publishConfig" field/);
  });

  function writeTo(name: string, bytes: Uint8Array | Buffer): string {
    mkdirSync(join(dir, name), { recursive: true });
    const file = join(dir, name, "brucewaynedecoy-buildos-9.8.7.tgz");
    writeFileSync(file, bytes);
    return file;
  }

  it("P8-R2-06: refuses a tarball that holds package.json twice, a link, a path outside package/, or a truncated archive", () => {
    const pkgText = JSON.stringify(goodPkg);
    const twice = tarGzRaw([ustarEntry("package/package.json", pkgText), ustarEntry("package/package.json", JSON.stringify({ ...goodPkg, publishConfig: { tag: "x" } })), TAR_END]);
    const linked = tarGzRaw([ustarEntry("package/package.json", pkgText), ustarEntry("package/evil", "", { typeFlag: "2", linkName: "../../etc/passwd" }), TAR_END]);
    const outside = tarGzRaw([ustarEntry("package/package.json", pkgText), ustarEntry("other/x.txt", "x"), TAR_END]);
    const truncated = tarGzRaw([ustarEntry("package/package.json", pkgText).subarray(0, 600)]);
    const expect: [Uint8Array, RegExp][] = [[twice, /more than once/], [linked, /not a regular file or a folder/], [outside, /outside package\//], [truncated, /truncated/]];
    for (const [bytes, pattern] of expect) {
      const r = runStageCheck(["digest", "--repo", repo, "--commit", commits.good, "--tag", "v9.8.7", "--tarball", writeTo(`crafted-${String(pattern).length}`, bytes)]);
      assert.match(r[0]?.problems.join(" ") ?? "", pattern, String(pattern));
    }
  });

  it("precheck and stage: need a public repository, the repository URL in the tarball, and OIDC", () => {
    const oidc = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "x" };
    assert.equal(run(ENTRY.stage, ["precheck", "--visibility", "public", "--repository", "brucewaynedecoy/build-os", "--require-oidc"], oidc).status, 0);
    assert.match(run(ENTRY.stage, ["precheck", "--visibility", "private", "--repository", "brucewaynedecoy/build-os", "--require-oidc"], oidc).stdout, /needs a public GitHub repository/);
    assert.match(run(ENTRY.stage, ["precheck", "--visibility", "public", "--repository", "brucewaynedecoy/build-os", "--require-oidc"]).stdout, /cannot request a GitHub OIDC token/);
    const base = ["stage", ...digestArgs(commits.good), "--repository", "brucewaynedecoy/build-os"];
    const ok = run(ENTRY.stage, [...base, "--visibility", "public", "--require-oidc"], oidc);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(run(ENTRY.stage, ["stage", ...digestArgs(commits.good), "--repository", "someone/else", "--visibility", "public"]).stdout, /need git\+https:\/\/github\.com\/someone\/else\.git/);
  });

  it("P8-R2-02: publish runs npm stage publish with the trusted dist-tag, the npm registry, and a clean npm environment", () => {
    // A recorder in place of npm-cli.js: it writes its arguments, environment, and working folder.
    const npmDir = join(dir, "fake-npm", "lib", "node_modules", "npm", "bin");
    mkdirSync(npmDir, { recursive: true });
    const record = join(dir, "npm-record.json");
    const cli = join(npmDir, "npm-cli.js");
    writeFileSync(cli, `require("node:fs").writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), env: process.env, cwd: process.cwd() }));\n`);
    const oidc = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "x", GITHUB_REPOSITORY: "brucewaynedecoy/build-os" };
    const hostile = { npm_config_registry: "https://example.invalid/", NPM_CONFIG_TAG: "evil", NPM_CONFIG_USERCONFIG: join(dir, "evil-npmrc"), NODE_AUTH_TOKEN: "t", NODE_PATH: join(dir, "nowhere") };
    const work = join(dir, "stage-work");
    const r = run(ENTRY.stage, ["publish", ...digestArgs(commits.good), "--visibility", "public", "--repository", "brucewaynedecoy/build-os", "--require-oidc", "--work", work, "--npm-cli", cli], { ...oidc, ...hostile });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    const got = JSON.parse(readFileSync(record, "utf8")) as { argv: string[]; env: Record<string, string>; cwd: string };
    assert.deepEqual(got.argv, ["stage", "publish", tgz, "--provenance", "--access", "public", "--tag", "latest", "--registry", NPM_REGISTRY, "--ignore-scripts"]);
    assert.equal(got.env["npm_config_registry"], undefined);
    assert.equal(got.env["NPM_CONFIG_TAG"], undefined);
    assert.equal(got.env["NODE_AUTH_TOKEN"], undefined);
    assert.equal(got.env["NODE_PATH"], undefined);
    assert.equal(got.env["NPM_CONFIG_USERCONFIG"], join(work, "empty-userconfig"));
    assert.equal(readFileSync(got.env["NPM_CONFIG_USERCONFIG"] ?? "", "utf8"), "");
    assert.equal(readFileSync(got.env["NPM_CONFIG_GLOBALCONFIG"] ?? "", "utf8"), "");
    assert.equal(got.env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"], "x", "the OIDC request reaches npm");
    assert.equal(realpathSync(got.cwd), realpathSync(join(work, "cwd")));
    // A builtin npmrc next to npm, a reused work folder, and a failed check each stop it before npm runs.
    writeFileSync(join(dir, "fake-npm", "lib", "node_modules", "npm", "npmrc"), "registry=https://example.invalid/\n");
    const builtin = run(ENTRY.stage, ["publish", ...digestArgs(commits.good), "--visibility", "public", "--repository", "brucewaynedecoy/build-os", "--require-oidc", "--work", join(dir, "stage-work-2"), "--npm-cli", cli], oidc);
    assert.equal(builtin.status, 1);
    assert.match(builtin.stdout, /builtin config file/);
    rmSync(join(dir, "fake-npm", "lib", "node_modules", "npm", "npmrc"));
    assert.match(run(ENTRY.stage, ["publish", ...digestArgs(commits.good), "--visibility", "public", "--repository", "brucewaynedecoy/build-os", "--require-oidc", "--work", work, "--npm-cli", cli], oidc).stdout, /is not empty/);
    rmSync(record);
    assert.equal(run(ENTRY.stage, ["publish", ...digestArgs(commits.symlink), "--visibility", "public", "--repository", "brucewaynedecoy/build-os", "--require-oidc", "--work", join(dir, "stage-work-3"), "--npm-cli", cli], oidc).status, 1);
    assert.equal(existsSync(record), false, "npm never ran");
  });

  it("the npm plan for a prerelease uses next, and drops every npm_config_ value", () => {
    const plan = stagePublishPlan({ tarball: "t.tgz", distTag: "next", work: "/w", env: { npm_config_x: "1", Npm_Config_Y: "2", NPM_ID_TOKEN: "z", KEEP: "k" }, npmCli: "/n/npm-cli.js" });
    assert.ok(plan.argv.includes("next"));
    assert.deepEqual(Object.keys(plan.env).filter((k) => !k.startsWith("NPM_CONFIG_")), ["KEEP"]);
    assert.equal(droppedFromNpmEnv("npm_config_registry"), true);
    assert.equal(droppedFromNpmEnv("GITHUB_SHA"), false);
  });

  it("the deny-list scanner reads the tree and the tarball as data, with no npm, and prints redacted locations only", () => {
    const root = join(dir, "candidate");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "note.txt"), "an ordinary file\n");
    const listFile = join(dir, "list.txt");
    const term = ["zq", "privileged", "fixture", "9k"].join("-");
    writeFileSync(listFile, `${term}\n`);
    const clean = run(ENTRY.scanner, ["--root", root, "--walk", "--tarball", tgz, "--list-file", listFile], { PATH: "" });
    assert.equal(clean.status, 0, `${clean.stdout}${clean.stderr}`);
    assert.match(clean.stdout, /2 of 2 package files read/);
    const dirty = join(dir, "dirty.tgz");
    writeFileSync(dirty, tarball({ "package.json": "{}\n", "notes.txt": `line one\na ${term} here\n` }));
    const hit = run(ENTRY.scanner, ["--root", root, "--walk", "--tarball", dirty, "--list-file", listFile], { PATH: "" });
    assert.equal(hit.status, 1);
    assert.match(hit.stdout, /deny-list: match in \[tarball\]\/notes\.txt:2/);
    assert.equal(`${hit.stdout}${hit.stderr}`.includes(term), false);
    const missing = run(ENTRY.scanner, ["--root", root, "--walk", "--tarball", tgz], { PATH: "", CI: "true" });
    assert.equal(missing.status, 2, "no list fails closed");
    // P8-R2-04: the message names the environment secret and the environment, not a repository secret.
    assert.match(missing.stderr, /environment secret BUILDOS_DENY_LIST_ENV of the GitHub environment buildos-deny-list/);
    assert.doesNotMatch(missing.stderr, /the repository secret/);
  });

  it("the GitHub API script refuses a token on the command line and needs GITHUB_TOKEN in the environment", () => {
    const r = run(ENTRY.github, ["find-draft", "--tag", "v9.8.7"], { GITHUB_REPOSITORY: "brucewaynedecoy/build-os" });
    assert.equal(r.status, 2);
    assert.match(r.stdout, /GITHUB_TOKEN is not set \(pass it through env:, never on the command line\)/);
    assert.equal(run(ENTRY.github, ["find-draft", "--tag", "v9.8.7", "--token", "x"], { GITHUB_REPOSITORY: "a/b", GITHUB_TOKEN: "t" }).status, 2);
  });

  // ------------------------------------------------------------ GitHub API steps, with a fake fetch

  type Route = (url: string, init: RequestInit) => { status: number; body?: unknown; bytes?: Uint8Array; headers?: Record<string, string> };
  function fakeFetch(route: Route, log: { url: string; method: string; auth: string | null }[] = []): typeof fetch {
    return (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      log.push({ url, method: init.method ?? "GET", auth: new Headers(init.headers).get("authorization") });
      const r = route(url, init);
      const body = r.bytes ?? (r.body === undefined ? new Uint8Array() : new TextEncoder().encode(JSON.stringify(r.body)));
      return new Response(r.status === 204 || r.status === 302 ? null : body, { status: r.status, headers: r.headers ?? {} });
    }) as typeof fetch;
  }
  const ctx = (f: typeof fetch): GithubContext => ({ repository: "brucewaynedecoy/build-os", token: "fixture-token", api: "https://api.github.com", fetch: f });
  const API = "https://api.github.com/repos/brucewaynedecoy/build-os";
  const release = (over: Record<string, unknown> = {}) => ({ id: 42, tag_name: "v9.8.7", draft: true, prerelease: false, immutable: false, upload_url: "https://uploads.github.com/repos/brucewaynedecoy/build-os/releases/42/assets{?name,label}", assets: [], ...over });

  it("environment: needs exactly the listed deployment refs, a required reviewer, and an approval in this run (fails closed when unreadable)", async () => {
    const env = { name: "buildos-npm-stage", protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User", reviewer: { login: "owner" } }] }], deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } };
    const policies = { branch_policies: [{ name: "v*", type: "tag" }] };
    const approvals = [{ state: "approved", environments: [{ name: "buildos-npm-stage" }] }];
    const route = (e: unknown, p: unknown, a: unknown): Route => (url) => (url.endsWith("/environments/buildos-npm-stage") ? { status: 200, body: e } : url.includes("/deployment-branch-policies") ? { status: 200, body: p } : url.endsWith("/runs/7/approvals") ? { status: 200, body: a } : { status: 404 });
    const input = { name: "buildos-npm-stage", allow: ["tag:v*"], requireReviewers: true, runId: "7" };
    assert.deepEqual((await environmentCheck(ctx(fakeFetch(route(env, policies, approvals))), input)).problems, []);
    assert.match((await environmentCheck(ctx(fakeFetch(route({ ...env, protection_rules: [] }, policies, approvals))), input)).problems.join(), /no required reviewer/);
    assert.match((await environmentCheck(ctx(fakeFetch(route({ ...env, deployment_branch_policy: null }, policies, approvals))), input)).problems.join(), /does not limit its deployment refs/);
    assert.match((await environmentCheck(ctx(fakeFetch(route(env, { branch_policies: [{ name: "*", type: "branch" }, { name: "v*", type: "tag" }] }, approvals))), input)).problems.join(), /must deploy from exactly tag:v\*/);
    assert.match((await environmentCheck(ctx(fakeFetch(route(env, policies, [{ state: "rejected", environments: [{ name: "buildos-npm-stage" }] }]))), input)).problems.join(), /no reviewer approved/);
    assert.match((await environmentCheck(ctx(fakeFetch(() => ({ status: 403 }))), input)).problems.join(), /cannot read the environment buildos-npm-stage; the job needs permissions actions: read \(HTTP 403\)/);
    assert.deepEqual(environmentProblems({ name: "buildos-deny-list", environment: { ...env, name: "buildos-deny-list" }, policies: { branch_policies: [{ name: "main", type: "branch" }, { name: "v*", type: "tag" }] }, allow: ["branch:main", "tag:v*"], requireReviewers: false }), []);
    assert.equal(runApproves("nope", "x"), false);
  });

  it("find-draft: exactly one draft with no asset for the tag", async () => {
    const list = (items: unknown[]): Route => (url) => (url.includes("/releases?") ? { status: 200, body: items } : { status: 404 });
    const ok = await findDraft(ctx(fakeFetch(list([release(), release({ id: 1, tag_name: "v1.0.0" })]))), "v9.8.7");
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.outputs["release_id"], "42");
    assert.match((await findDraft(ctx(fakeFetch(list([]))), "v9.8.7")).problems.join(), /0 releases have the tag/);
    assert.match((await findDraft(ctx(fakeFetch(list([release({ draft: false })]))), "v9.8.7")).problems.join(), /is not a draft/);
    assert.match((await findDraft(ctx(fakeFetch(list([release({ assets: [{ id: 1, name: "x" }] })]))), "v9.8.7")).problems.join(), /already has 1 asset/);
    assert.match((await findDraft(ctx(fakeFetch(list([release({ prerelease: true })]))), "v9.8.7")).problems.join(), /prerelease flag/);
  });

  function sbomFor(over: { sha?: string; revision?: string; version?: string; extra?: string } = {}): string {
    return JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.5", version: 1, metadata: { component: { type: "library", name: "@brucewaynedecoy/buildos", version: over.version ?? "9.8.7", hashes: [{ alg: "SHA-256", content: over.sha ?? digest }], properties: [{ name: "buildos:source_revision", value: over.revision ?? "a".repeat(40) }] } }, ...(over.extra === undefined ? {} : { components: [{ type: "library", name: over.extra }] }) });
  }

  it("P8-R2-05: the SBOM must record the verified tarball digest and the reviewed source commit", () => {
    const want = { version: "9.8.7", tarballSha256: digest, sourceCommit: "a".repeat(40) };
    assert.deepEqual(sbomBindingProblems(sbomFor(), want), []);
    assert.match(sbomBindingProblems(sbomFor({ sha: "0".repeat(64) }), want).join(), /package hash is not the verified tarball/);
    assert.match(sbomBindingProblems(sbomFor({ revision: "b".repeat(40) }), want).join(), /source revision is not the reviewed source commit/);
    assert.match(sbomBindingProblems(sbomFor({ version: "1.0.0" }), want).join(), /describes/);
    assert.match(sbomBindingProblems("not json", want).join(), /not JSON/);
    // P8-F-02: the binding also validates the document against the vendored CycloneDX 1.5 schema.
    const invalid = JSON.parse(sbomFor()) as { metadata: { component: Record<string, unknown> } };
    delete invalid.metadata.component["type"];
    assert.match(sbomBindingProblems(JSON.stringify(invalid), want).join(), /CycloneDX 1\.5 schema/);
  });

  it("P8-R2-05: attach uploads both files to the draft by release ID, never sends the token elsewhere, and checks the result", async () => {
    const sbomFile = join(dir, "buildos-9.8.7.cdx.json");
    writeFileSync(sbomFile, sbomFor());
    const uploaded: { name: string; bytes: Uint8Array }[] = [];
    const log: { url: string; method: string; auth: string | null }[] = [];
    const route: Route = (url, init) => {
      if (url === `${API}/releases/42`) {
        const assets = uploaded.map((u, i) => ({ id: i + 1, name: u.name, size: u.bytes.length, digest: `sha256:${sha256(u.bytes)}`, state: "uploaded" }));
        return { status: 200, body: release({ assets }) };
      }
      const m = /^https:\/\/uploads\.github\.com\/repos\/brucewaynedecoy\/build-os\/releases\/42\/assets\?name=(.+)$/.exec(url);
      if (m !== null && init.method === "POST") {
        const bytes = new Uint8Array(init.body as Uint8Array);
        uploaded.push({ name: decodeURIComponent(m[1] ?? ""), bytes });
        return { status: 201, body: { name: decodeURIComponent(m[1] ?? ""), size: bytes.length } };
      }
      return { status: 404 };
    };
    const input = { releaseId: "42", repo, commit: commits.good, tag: "v9.8.7", tarball: tgz, sbom: sbomFile };
    const r = await attach(ctx(fakeFetch(route, log)), input);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(uploaded.map((u) => u.name).sort(), ["brucewaynedecoy-buildos-9.8.7.tgz", "buildos-9.8.7.cdx.json"]);
    for (const call of log) assert.match(call.url, /^https:\/\/(api|uploads)\.github\.com\//);
    // A wrong SBOM, a non-draft, a release that already has assets, and the ledger as a link stop it before any upload.
    writeFileSync(sbomFile, sbomFor({ sha: "0".repeat(64) }));
    const posts = () => log.filter((l) => l.method === "POST").length;
    const before = posts();
    assert.match((await attach(ctx(fakeFetch(route, log)), input)).problems.join(), /package hash/);
    writeFileSync(sbomFile, sbomFor());
    assert.match((await attach(ctx(fakeFetch(() => ({ status: 200, body: release({ draft: false }) }), log)), input)).problems.join(), /is not a draft/);
    assert.match((await attach(ctx(fakeFetch(route, log)), input)).problems.join(), /already has 2 asset/);
    assert.match((await attach(ctx(fakeFetch(route, log)), { ...input, commit: commits.symlink })).problems.join(), /not a regular file/);
    assert.match((await attach(ctx(fakeFetch(() => ({ status: 200, body: release({ upload_url: "https://example.invalid/x{?name}" }) }), log)), input)).problems.join(), /upload URL is not/);
    assert.equal(posts(), before, "no upload after a failed check");
  });

  it("P8-F-02, P8-F-03: download-asset needs exactly the tarball and the SBOM, GitHub's digests, both response forms, and the verify SBOM", async () => {
    const bytes = new Uint8Array(readFileSync(tgz));
    const sbomText = sbomFor();
    const sbomBytes = new TextEncoder().encode(sbomText);
    const verifySbom = join(dir, "verify-sbom.cdx.json");
    writeFileSync(verifySbom, sbomText);
    const tarAsset = { id: 9, name: "brucewaynedecoy-buildos-9.8.7.tgz", size: bytes.length, digest: `sha256:${sha256(bytes)}`, state: "uploaded" };
    const sbomAsset = (b: Uint8Array = sbomBytes) => ({ id: 10, name: "buildos-9.8.7.cdx.json", size: b.length, digest: `sha256:${sha256(b)}`, state: "uploaded" });
    type Form = "redirect" | "direct";
    const route = (rel: Record<string, unknown>, served: { 9?: Uint8Array; 10?: Uint8Array } = {}, form: Form = "redirect"): Route => (url): ReturnType<Route> => {
      if (url === `${API}/releases/42`) return { status: 200, body: release(rel) };
      const m = /\/releases\/assets\/(9|10)$/.exec(url);
      const id = m?.[1] === "9" ? 9 : m?.[1] === "10" ? 10 : undefined;
      const body = (n: 9 | 10) => served[n] ?? (n === 9 ? bytes : sbomBytes);
      if (id !== undefined && url.startsWith(API)) return form === "direct" ? { status: 200, bytes: body(id), headers: { "content-type": "application/octet-stream" } } : { status: 302, headers: { location: `https://objects.example.invalid/asset/${id}` } };
      if (url === "https://objects.example.invalid/asset/9") return { status: 200, bytes: body(9) };
      if (url === "https://objects.example.invalid/asset/10") return { status: 200, bytes: body(10) };
      return { status: 404 };
    };
    const published = (assets: unknown[]) => ({ draft: false, immutable: true, assets });
    const out = join(dir, "asset");
    const input = { releaseId: "42", tag: "v9.8.7", out, repo, commit: commits.good, expectSha256: digest, verifySbom };
    const problems = async (r: Route, over: Partial<typeof input> = {}) => (await downloadAsset(ctx(fakeFetch(r)), { ...input, ...over })).problems.join(" ");

    // Success through a redirect: the token never reaches the storage host.
    const log: { url: string; method: string; auth: string | null }[] = [];
    const ok = await downloadAsset(ctx(fakeFetch(route(published([tarAsset, sbomAsset()])), log)), input);
    assert.deepEqual(ok.problems, []);
    assert.equal(sha256(new Uint8Array(readFileSync(join(out, tarAsset.name)))), digest);
    assert.equal(ok.outputs["tarball"], join(out, tarAsset.name));
    assert.ok(log.some((l) => l.url.startsWith("https://objects.")), "the redirect was followed");
    for (const l of log.filter((x) => x.url.startsWith("https://objects."))) assert.equal(l.auth, null, "no token to the storage host");
    // Success with a direct 200 octet-stream body (P8-F-03: this used to fail with HTTP 200).
    const directLog: { url: string; method: string; auth: string | null }[] = [];
    assert.deepEqual((await downloadAsset(ctx(fakeFetch(route(published([tarAsset, sbomAsset()]), {}, "direct"), directLog)), input)).problems, []);
    assert.equal(directLog.some((l) => l.url.startsWith("https://objects.")), false);

    // The asset set (P8-F-02): one tarball only (the old success case), a missing SBOM, an extra asset, a repeated tarball.
    assert.match(await problems(route(published([tarAsset]))), /0 assets named buildos-9\.8\.7\.cdx\.json/);
    assert.match(await problems(route(published([{ ...sbomAsset() }]))), /0 assets named brucewaynedecoy-buildos-9\.8\.7\.tgz/);
    assert.match(await problems(route(published([tarAsset, sbomAsset(), { id: 11, name: "notes.txt", size: 1, digest: `sha256:${"0".repeat(64)}`, state: "uploaded" }]))), /not part of a BuildOS release: notes\.txt/);
    assert.match(await problems(route(published([tarAsset, tarAsset, sbomAsset()]))), /2 assets named brucewaynedecoy-buildos-9\.8\.7\.tgz/);
    assert.match(await problems(route(published([tarAsset, { ...sbomAsset(), state: "open" }]))), /not fully uploaded/);
    // GitHub's digest is required (P8-F-03): absent, the check fails closed, for either response form.
    assert.match(await problems(route(published([{ ...tarAsset, digest: null }, sbomAsset()]))), /no SHA-256 digest for asset brucewaynedecoy/);
    assert.match(await problems(route(published([{ ...tarAsset, digest: null }, sbomAsset()]), {}, "direct")), /no SHA-256 digest/);
    // Changed bytes on the storage host or in a direct body.
    const changed = new Uint8Array(bytes);
    changed[changed.length - 1] = (changed[changed.length - 1] ?? 0) ^ 1;
    assert.match(await problems(route(published([tarAsset, sbomAsset()]), { 9: changed })), /tgz's SHA-256 is not the digest GitHub lists/);
    assert.match(await problems(route(published([tarAsset, sbomAsset()]), { 9: changed }, "direct")), /tgz's SHA-256 is not the digest GitHub lists/);
    // A replaced SBOM: valid and bound to the same tarball, but not the bytes this run's verify job generated.
    const replaced = new TextEncoder().encode(sbomFor({ extra: "something-else" }));
    assert.match(await problems(route(published([tarAsset, sbomAsset(replaced)]), { 10: replaced })), /is not the SBOM this run's verify job generated/);
    // An SBOM for another tarball digest, and one for another source commit.
    const other = new TextEncoder().encode(sbomFor({ sha: "0".repeat(64) }));
    assert.match(await problems(route(published([tarAsset, sbomAsset(other)]), { 10: other })), /buildos-9\.8\.7\.cdx\.json: the SBOM's package hash is not the verified tarball SHA-256/);
    const otherCommit = new TextEncoder().encode(sbomFor({ revision: "b".repeat(40) }));
    assert.match(await problems(route(published([tarAsset, sbomAsset(otherCommit)]), { 10: otherCommit })), /source revision is not the reviewed source commit/);
    // The release and the ledger.
    assert.match(await problems(route({ ...published([tarAsset, sbomAsset()]), immutable: false })), /is not immutable/);
    assert.match(await problems(route({ ...published([tarAsset, sbomAsset()]), draft: true })), /still a draft/);
    assert.match(await problems(route({ ...published([tarAsset, sbomAsset()]), tag_name: "v9.9.9" })), /has the tag v9\.9\.9/);
    assert.match(await problems(route(published([tarAsset, sbomAsset()])), { expectSha256: "f".repeat(64) }), /is not the f{64} an earlier job checked/);
    assert.match(await problems(route(published([tarAsset, sbomAsset()])), { commit: commits.symlink }), /not a regular file/);
    // A failed download of either form.
    assert.match(await problems((url) => (url === `${API}/releases/42` ? { status: 200, body: release(published([tarAsset, sbomAsset()])) } : { status: 403 })), /download of brucewaynedecoy-buildos-9\.8\.7\.tgz failed \(HTTP 403\)/);
    assert.match(await problems((url) => (url === `${API}/releases/42` ? { status: 200, body: release(published([tarAsset, sbomAsset()])) } : url.startsWith(API) ? { status: 302, headers: { location: "http://objects.example.invalid/x" } } : { status: 200 })), /did not redirect to an https address/);
  });

  it("P8-F-01: rulesets needs the branch rules and the v* tag ruleset, active, and fails closed when unreadable", async () => {
    const branchRules = [
      { type: "deletion", ruleset_id: 1 },
      { type: "non_fast_forward", ruleset_id: 1 },
      { type: "pull_request", ruleset_id: 1, parameters: { required_approving_review_count: 1, require_code_owner_review: true, dismiss_stale_reviews_on_push: false, require_last_push_approval: false, required_review_thread_resolution: false } },
      { type: "required_status_checks", ruleset_id: 1, parameters: { strict_required_status_checks_policy: false, required_status_checks: REQUIRED_CHECKS.map((context) => ({ context })) } },
    ];
    const tagRuleset = { id: 2, name: "release tags", target: "tag", enforcement: "active", conditions: { ref_name: { include: ["refs/tags/v*"], exclude: [] } }, rules: [{ type: "creation" }, { type: "update" }, { type: "deletion" }] };
    assert.deepEqual(branchRulesProblems(branchRules, "main"), []);
    assert.deepEqual(tagRulesetProblems([tagRuleset]), []);
    assert.match(branchRulesProblems(branchRules.filter((r) => r.type !== "deletion"), "main").join(), /restricts deleting main/);
    assert.match(branchRulesProblems(branchRules.filter((r) => r.type !== "non_fast_forward"), "main").join(), /blocks force pushes/);
    assert.match(branchRulesProblems(branchRules.map((r) => (r.type === "pull_request" ? { ...r, parameters: { required_approving_review_count: 1, require_code_owner_review: false } } : r)), "main").join(), /code-owner review/);
    assert.match(branchRulesProblems(branchRules.map((r) => (r.type === "pull_request" ? { ...r, parameters: { required_approving_review_count: 0, require_code_owner_review: true } } : r)), "main").join(), /at least 1 approval/);
    assert.match(branchRulesProblems(branchRules.map((r) => (r.type === "required_status_checks" ? { ...r, parameters: { required_status_checks: [{ context: "test (ubuntu-latest, Node 24)" }] } } : r)), "main").join(), /"OSV scan of package-lock\.json"/);
    assert.match(branchRulesProblems([], "main").join(), /restricts deleting/);
    assert.match(tagRulesetProblems([]).join(), /no active tag ruleset targets refs\/tags\/v\*/);
    assert.match(tagRulesetProblems([{ ...tagRuleset, enforcement: "evaluate" }]).join(), /no active tag ruleset/);
    assert.match(tagRulesetProblems([{ ...tagRuleset, conditions: { ref_name: { include: ["refs/tags/v*"], exclude: ["refs/tags/v9*"] } } }]).join(), /no active tag ruleset/);
    assert.match(tagRulesetProblems([{ ...tagRuleset, rules: [{ type: "deletion" }] }]).join(), /does not restrict creation, update/);
    // Through the fake API: the rules of the branch, the tag ruleset list, then each tag ruleset.
    const log: { url: string; method: string; auth: string | null }[] = [];
    const route = (rules: unknown, list: unknown, detail: unknown): Route => (url) =>
      url === `${API}/rules/branches/main?per_page=100&page=1` ? { status: 200, body: rules } : url === `${API}/rulesets?targets=tag&includes_parents=true&per_page=100&page=1` ? { status: 200, body: list } : url === `${API}/rulesets/2` ? { status: 200, body: detail } : { status: 404 };
    const summary = [{ id: 2, name: "release tags", target: "tag", enforcement: "active" }];
    const ok = await rulesetsCheck(ctx(fakeFetch(route(branchRules, summary, tagRuleset), log)), { branch: "main" });
    assert.deepEqual(ok.problems, []);
    assert.match(ok.notes.join(), /not checked from the job: who may bypass a ruleset/);
    assert.ok(log.every((l) => l.method === "GET"), "only reads");
    assert.match((await rulesetsCheck(ctx(fakeFetch(route(branchRules, [], tagRuleset))), { branch: "main" })).problems.join(), /no active tag ruleset/);
    assert.match((await rulesetsCheck(ctx(fakeFetch(route([], summary, tagRuleset))), { branch: "main" })).problems.join(), /restricts deleting main/);
    assert.match((await rulesetsCheck(ctx(fakeFetch(() => ({ status: 403 }))), { branch: "main" })).problems.join(), /cannot read the rules of main \(HTTP 403\)/);
    assert.match((await rulesetsCheck(ctx(fakeFetch(route(branchRules, summary, tagRuleset))), { branch: "main;x" })).problems.join(), /not a plain branch name/);
  });

  it("discard deletes only an artifact of this run with this run attempt's name", async () => {
    const log: { url: string; method: string; auth: string | null }[] = [];
    const route: Route = (url, init) => {
      if (url === `${API}/actions/runs/7/artifacts?per_page=100`) return { status: 200, body: { artifacts: [{ id: 5, name: "buildos-release-7-2" }] } };
      if (url === `${API}/actions/artifacts/5` && init.method === "DELETE") return { status: 204 };
      return { status: 404 };
    };
    assert.deepEqual((await discard(ctx(fakeFetch(route, log)), { runId: "7", artifactId: "5", name: "buildos-release-7-2" })).problems, []);
    assert.match((await discard(ctx(fakeFetch(route, log)), { runId: "7", artifactId: "6", name: "buildos-release-7-2" })).problems.join(), /is not an artifact of run 7; nothing deleted/);
    assert.match((await discard(ctx(fakeFetch(route, log)), { runId: "7", artifactId: "5", name: "buildos-release-7-1" })).problems.join(), /is not named buildos-release-7-1; nothing deleted/);
    assert.equal(log.filter((l) => l.method === "DELETE").length, 1);
  });
});
