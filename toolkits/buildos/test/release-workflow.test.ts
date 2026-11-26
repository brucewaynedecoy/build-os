// W1 R7 P8 review round 1: the release and deny-list workflows. The YAML is
// read as text (no YAML package). The resolve job's script is run here on
// scratch git repositories (P8-R1-01: one commit, the tag peels to it, the
// commit is on the default branch; the dispatch tag input is validated before
// any use), and the job graph is checked for who holds which permission or
// secret and which code each job runs (P8-R1-01, P8-R1-02, P8-R1-04,
// P8-R1-07).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { REQUIRED_CHECKS } from "../scripts/release-github.ts";
import { RELEASE_NODE_VERSION, RELEASE_NPM_VERSION } from "../scripts/release-lib.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const read = (name: string) => readFileSync(join(repoRoot, ".github", "workflows", name), "utf8").replace(/\r\n/g, "\n");

/** The text of one job (from `  <name>:` to the next job). */
function job(text: string, name: string): string {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `no job ${name}`);
  const next = text.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
  return next < 0 ? text.slice(start) : text.slice(start, start + 1 + next);
}

/** Every `run:` script of a workflow (the block scalar body, or the one-line value). */
function runScripts(text: string): string[] {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:- )?run: (.*)$/.exec(lines[i] ?? "");
    if (m === null) continue;
    if (m[2] !== "|") {
      out.push(m[2] ?? "");
      continue;
    }
    const indent = (m[1] ?? "").length;
    const body: string[] = [];
    for (i++; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line.trim() !== "" && line.length - line.trimStart().length <= indent) break;
      body.push(line);
    }
    i--;
    out.push(body.join("\n"));
  }
  return out;
}

/** The script of the step with `id: <id>`, unindented. */
function stepScript(text: string, id: string): string {
  const at = text.indexOf(`        id: ${id}\n`);
  assert.ok(at >= 0, `no step ${id}`);
  const runAt = text.indexOf("        run: |\n", at);
  const body: string[] = [];
  for (const line of text.slice(runAt + "        run: |\n".length).split("\n")) {
    if (line.trim() !== "" && !line.startsWith("          ")) break;
    body.push(line.slice(10));
  }
  return body.join("\n");
}

describe("release workflow: job graph, permissions, secrets, and code (P8-R1-01, -02, -04, -07; P8-R2-01, -02, -04, -05)", () => {
  const text = read("buildos-release.yml");
  const code = text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
  const TRUSTED = ["deny-list", "attach", "stage", "discard"];

  it("starts on a published release, by hand (dry-run or prepare), or on a release-dry-run/** push; never on pull_request_target", () => {
    assert.match(text, /\non:\n {2}release:\n {4}types: \[published\]\n {2}workflow_dispatch:/);
    assert.match(text, /\n {2}push:\n {4}branches:\n {6}- "release-dry-run\/\*\*"\n/);
    assert.match(text, /purpose:\n(?:.*\n){3} {8}options: \[dry-run, prepare\]\n/);
    assert.doesNotMatch(text, /pull_request/);
  });

  it("no run: script holds a ${{ }} expression: event values reach scripts through env: only", () => {
    const scripts = runScripts(text);
    assert.ok(scripts.length > 20);
    for (const script of scripts) assert.doesNotMatch(script, /\$\{\{/, script);
    for (const script of runScripts(read("buildos-deny-list.yml"))) assert.doesNotMatch(script, /\$\{\{/, script);
    for (const script of runScripts(read("buildos-ci.yml"))) assert.doesNotMatch(script, /\$\{\{/, script);
  });

  it("read-only by default; id-token: write only in stage; contents: write only in attach; actions: write only in discard; actions: read where environments are read", () => {
    assert.match(text, /\npermissions:\n {2}contents: read\n/);
    assert.equal(code.match(/id-token: write/g)?.length, 1);
    assert.match(job(text, "stage"), /permissions:\n {6}contents: read\n {6}actions: read\n {6}id-token: write\n/);
    assert.equal(code.match(/contents: write/g)?.length, 1);
    assert.match(job(text, "attach"), /permissions:\n {6}contents: write\n {4}defaults/);
    assert.equal(code.match(/actions: write/g)?.length, 1);
    assert.match(job(text, "discard"), /permissions:\n {6}actions: write\n {4}defaults/);
    assert.match(job(text, "deny-list"), /permissions:\n {6}contents: read\n {6}actions: read\n/);
    for (const name of ["resolve", "verify"]) assert.doesNotMatch(job(text, name), /permissions:/, name);
  });

  it("P8-R2-04: the real list is only in the deny-list job, as the environment-only secret BUILDOS_DENY_LIST_ENV; no other secret is used", () => {
    const lines = code.split("\n").filter((l) => l.includes("secrets."));
    assert.deepEqual(lines.map((l) => l.trim()), ["BUILDOS_DENY_LIST: ${{ secrets.BUILDOS_DENY_LIST_ENV }}"]);
    assert.ok(job(text, "deny-list").includes("secrets.BUILDOS_DENY_LIST_ENV"));
    assert.match(job(text, "deny-list"), /\n {4}environment: buildos-deny-list\n/);
    assert.match(job(text, "stage"), /\n {4}environment: buildos-npm-stage\n/);
    assert.doesNotMatch(text, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\.BUILDOS_DENY_LIST\b(?!_ENV)/);
  });

  it("the token reaches only the steps that call the GitHub API, through env:", () => {
    const tokenSteps = text.split("\n      - name: ").filter((step) => step.includes("GITHUB_TOKEN: ${{ github.token }}"));
    assert.equal(tokenSteps.length, 8);
    for (const step of tokenSteps) assert.match(step, /node trusted\/toolkits\/buildos\/scripts\/release-github\.ts /, step.split("\n")[0]);
    assert.doesNotMatch(code, /--token|gh release upload|gh api/);
  });

  it("verify checks out the resolved SHA; every trusted job checks out the trusted default-branch SHA, never the candidate's scripts", () => {
    assert.match(job(text, "verify"), /ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}/);
    for (const name of TRUSTED) {
      const j = job(text, name);
      assert.match(j, /name: Check out the trusted release scripts \(default branch\)\n {8}uses: [^\n]+\n {8}with:\n {10}ref: \$\{\{ needs\.resolve\.outputs\.trusted_sha \}\}\n {10}path: trusted\n/, name);
      for (const m of job(code, name).matchAll(/(?:run: |^\s+)node (\S+)/gm)) assert.match(m[1] ?? "", /^trusted\/toolkits\/buildos\/scripts\/(release-stage-check\.ts|release-github\.ts|check-deny-list\.mjs)$/, `${name} runs ${m[1]}`);
      for (const forbidden of ["npm ci", "npm install", "npm run", "npm pack", "release-gate.ts", "release-build.ts", "sbom.ts", "build.ts"]) assert.equal(j.includes(forbidden), false, `${name} runs ${forbidden}`);
      assert.equal(j.includes("sparse-checkout: toolkits/buildos/scripts\n"), true, name);
    }
    // Only deny-list checks out the candidate, and only as data (its tree is scanned, nothing of it runs).
    assert.match(job(text, "deny-list"), /ref: \$\{\{ needs\.resolve\.outputs\.sha \}\}\n {10}path: candidate\n/);
    for (const name of ["attach", "stage", "discard"]) assert.doesNotMatch(job(text, name), /outputs\.sha \}\}\n {10}path/, name);
    assert.doesNotMatch(code, /ref: \$\{\{ github\.event\.release\.tag_name/);
  });

  it("P8-R2-01 / P8-R2-08: the trusted checks read the ledger from git at the release commit, never a checked-out ledger file", () => {
    assert.doesNotMatch(code, /--ledger /);
    assert.match(job(text, "deny-list"), /release-stage-check\.ts digest --repo trusted --commit "\$SHA" --tag "\$TAG"/);
    assert.match(job(text, "stage"), /release-stage-check\.ts publish --repo trusted --commit "\$SHA" --tag "\$TAG" --tarball "\$ASSET" --expect-sha256 "\$TARBALL_SHA256" .* --require-oidc --work "\$RUNNER_TEMP\/stage"/);
    assert.match(job(text, "attach"), /release-github\.ts attach --release-id "\$RELEASE_ID" --repo trusted --commit "\$SHA" --tag "\$TAG"/);
    for (const name of TRUSTED.slice(0, 3)) assert.match(job(text, name), /fetch-depth: 0\n/, `${name} has the full history to read the release commit`);
  });

  it("P8-F-01: the deny-list job checks the environment and the rulesets before the step that holds the secret", () => {
    const deny = job(code, "deny-list");
    const env = deny.indexOf("release-github.ts environment --name buildos-deny-list");
    const rules = deny.indexOf("release-github.ts rulesets --branch \"$DEFAULT_BRANCH\"");
    const secret = deny.indexOf("secrets.BUILDOS_DENY_LIST_ENV");
    assert.ok(env > 0 && rules > env && secret > rules, "environment, then rulesets, then the secret");
  });

  it("stage: the provenance precheck comes first, then the environment protection and approval check, then the release asset, then the clean npm call", () => {
    const stage = job(code, "stage");
    const order = [
      "release-stage-check.ts precheck",
      "release-github.ts environment --name buildos-npm-stage --allow \"tag:v*\" --require-reviewers --run-id \"$GITHUB_RUN_ID\"",
      "release-github.ts rulesets --branch \"$DEFAULT_BRANCH\"",
      "download-artifact",
      "release-github.ts download-asset --release-id \"$RELEASE_ID\" --tag \"$TAG\" --out \"$RUNNER_TEMP/asset\" --repo trusted --commit \"$SHA\" --expect-sha256 \"$TARBALL_SHA256\" --verify-sbom \"$RUNNER_TEMP/artifact/buildos-${TAG#v}.cdx.json\"",
      "release-stage-check.ts publish",
    ];
    let at = -1;
    for (const part of order) {
      const i = stage.indexOf(part);
      assert.ok(i > at, `${part} is in place`);
      at = i;
    }
    assert.doesNotMatch(stage, /registry-url/, "setup-node writes no npmrc");
    // P8-F-02: the only artifact stage reads is this run's verify SBOM, to compare with the release SBOM; the staged file is the release asset ("$ASSET").
    assert.equal(stage.match(/download-artifact/g)?.length, 1);
    assert.match(stage, /ASSET: \$\{\{ steps\.asset\.outputs\.tarball \}\}/);
    assert.match(stage, /DEFAULT_BRANCH: \$\{\{ needs\.resolve\.outputs\.default_branch \}\}/);
    assert.doesNotMatch(code, /npm publish|npm stage publish/, "npm is started only by the trusted script");
  });

  it("verify runs every gate in order, the deny-list gate with an invented list, and uploads only after they all pass, under a run-attempt name", () => {
    const verify = job(text, "verify");
    const order = [
      "Gate: tag, version, and reviewed entry",
      "Release build B and pack",
      "Gate: rebuilt tarball digest",
      "Gate: the packed CLI reports",
      "Gate: typecheck, unit tests, and golden suites",
      "Gate: golden parity from the installed release-stamped tarball",
      "Gate: conversion eval",
      "Gate: npm audit",
      "Gate: OSV scan",
      "Gate: deny-list scanner with an invented list",
      "Gate: CycloneDX SBOM",
      "Gate: provenance preconditions",
      "Keep the tarball, SBOM, and build record",
    ];
    let at = -1;
    for (const name of order) {
      const i = verify.indexOf(name);
      assert.ok(i > at, `${name} is in place`);
      at = i;
    }
    assert.match(verify, /args=\(identity --mode "\$MODE" --plant "\$PLANT" --tag "\$TAG" --head "\$SHA"\)/);
    assert.match(verify, /MODE: \$\{\{ needs\.resolve\.outputs\.gate_mode \}\}/);
    for (const gate of ["digest", "version", "tests", "installed", "eval", "audit", "osv", "deny-list", "sbom", "provenance"]) assert.match(verify, new RegExp(`${gate} --mode "\\$MODE" --plant "\\$PLANT"`), gate);
    assert.match(verify, /release-gate\.ts deny-list --mode "\$MODE" --plant "\$PLANT" --invented-list --tarball "\$TARBALL"/);
    const upload = verify.slice(verify.indexOf("- name: Keep the tarball, SBOM, and build record"));
    assert.doesNotMatch(upload, /\n {8}if:/, "the upload runs only when every earlier step passed");
    assert.match(upload, /name: buildos-release-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}\n/);
    assert.match(upload, /retention-days: \$\{\{ needs\.resolve\.outputs\.mode == 'dry-run' && 3 \|\| 1 \}\}/);
    assert.doesNotMatch(verify, /secrets\./);
    for (const name of ["deny-list", "attach"]) assert.match(job(text, name), /name: buildos-release-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}\n/, name);
  });

  it("the job graph: a dry run stops after verify; prepare attaches after the real deny list; a release stages after it; discard only after a deny-list failure", () => {
    assert.match(job(text, "deny-list"), /\n {4}needs: \[resolve, verify\]\n {4}if: needs\.resolve\.outputs\.mode != 'dry-run'\n/);
    assert.match(job(text, "attach"), /\n {4}needs: \[resolve, verify, deny-list\]\n {4}if: needs\.resolve\.outputs\.mode == 'prepare'\n/);
    assert.match(job(text, "stage"), /\n {4}needs: \[resolve, verify, deny-list\]\n {4}if: needs\.resolve\.outputs\.mode == 'release'\n/);
    assert.match(job(text, "discard"), /if: always\(\) && needs\.resolve\.outputs\.mode != 'dry-run' && needs\.deny-list\.result == 'failure'/);
    assert.match(job(text, "discard"), /release-github\.ts discard --run-id "\$GITHUB_RUN_ID" --artifact-id "\$ARTIFACT_ID" --name "\$ARTIFACT_NAME"/);
    assert.match(job(text, "discard"), /ARTIFACT_NAME: buildos-release-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}\n/);
    assert.equal(job(text, "verify").includes("npm stage publish"), false);
  });

  it("pins actions to commit SHAs and keeps the reference environment of scripts/release-lib.ts", () => {
    for (const use of text.match(/uses: \S+/g) ?? []) assert.match(use, /@[0-9a-f]{40}$/, use);
    assert.equal(text.match(/runs-on: ubuntu-24\.04/g)?.length, 6);
    assert.match(text, /node-version: "24\.22\.3"/);
    assert.match(text, new RegExp(`test "\\$\\(node --version\\)" = "${RELEASE_NODE_VERSION}"`));
    assert.match(text, new RegExp(`test "\\$\\(npm --version\\)" = "${RELEASE_NPM_VERSION.replace(/\./g, "\\.")}"`));
  });
});

describe("the maintainer steps name the artifact as the workflow does (P8-R1-11)", () => {
  it("release-candidate.ts says buildos-release-<run id> and the job summary, as buildos-release.yml uploads and reports", () => {
    const header = readFileSync(join(packageRoot, "scripts", "release-candidate.ts"), "utf8");
    assert.match(read("buildos-release.yml"), /name: buildos-release-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
    assert.match(header, /artifact\n\/\/ {6}buildos-release-<run id>-<run attempt>/);
    assert.match(header, /The gate results are in the\n\/\/ {6}run's job summary/);
    assert.doesNotMatch(header, /buildos-release-<sha>|every gate result as the artifact/);
  });
});

describe("deny-list workflow: the real list only on the default branch, from trusted code (P8-R1-02, P8-R2-03, -04; P8-D-07)", () => {
  const text = read("buildos-deny-list.yml");
  it("runs on every push and pull request; the invented-list job has no secret; the real-list job is the default branch only, in its environment", () => {
    assert.match(text, /\non:\n {2}push:\n {2}pull_request:\n {2}workflow_dispatch:\n/);
    assert.doesNotMatch(job(text, "invented"), /secrets\./);
    const real = job(text, "deny-list");
    assert.match(real, /\n {4}if: github\.event_name != 'pull_request' && github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)\n/);
    assert.match(real, /\n {4}environment: buildos-deny-list\n/);
    assert.match(real, /BUILDOS_DENY_LIST: \$\{\{ secrets\.BUILDOS_DENY_LIST_ENV \}\}/);
    assert.doesNotMatch(text, /secrets\.BUILDOS_DENY_LIST\b(?!_ENV)/);
    assert.match(real, /node toolkits\/buildos\/scripts\/release-github\.ts environment --name buildos-deny-list --allow "branch:\$DEFAULT_BRANCH,tag:v\*"/);
    // P8-F-01: the rulesets are checked before the step that holds the secret.
    const rules = real.indexOf("node toolkits/buildos/scripts/release-github.ts rulesets --branch \"$DEFAULT_BRANCH\"");
    assert.ok(rules > real.indexOf("release-github.ts environment") && rules < real.indexOf("secrets.BUILDOS_DENY_LIST_ENV"), "rulesets before the secret");
    for (const forbidden of ["npm ci", "npm install", "npm run", "npm pack", "release-gate.ts", "build.ts"]) assert.equal(real.includes(forbidden), false, forbidden);
    assert.match(real, /node toolkits\/buildos\/scripts\/check-deny-list\.mjs --root \. --tarball "\$tarball"/);
    assert.match(job(text, "invented"), /release-gate\.ts deny-list --invented-list --tarball "\$TARBALL"/);
    assert.match(job(text, "invented"), /FORK_PR: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.repo\.full_name != github\.repository \}\}/);
  });

  it("P8-R2-03: the invented job packs through scripts/pack-for-scan.ts (which creates the pack folder), not inline shell", () => {
    const invented = job(text, "invented");
    assert.match(invented, /id: pack\n {8}run: node scripts\/pack-for-scan\.ts --out "\$RUNNER_TEMP\/pack"\n/);
    assert.match(invented, /TARBALL: \$\{\{ steps\.pack\.outputs\.tarball \}\}/);
    assert.doesNotMatch(invented, /npm pack/);
    assert.match(invented, /path: \$\{\{ runner\.temp \}\}\/pack\//);
  });

  it("P8-D-07: job names are stable and say which list runs where (the names SECURITY.md tells the owner to require)", () => {
    assert.match(job(text, "invented"), /\n {4}name: Deny list \(invented list, every push and pull request\)\n/);
    assert.match(job(text, "deny-list"), /\n {4}name: Deny list \(real list, default branch only\)\n/);
    const security = readFileSync(join(packageRoot, "SECURITY.md"), "utf8");
    assert.match(security, /"Deny list \(invented list, every push and pull request\)"/);
    assert.doesNotMatch(security, /"Client-name deny list"/);
  });
});

describe("P8-R2-03: scripts/pack-for-scan.ts, the deny-list workflow's pack step, in a clean temp folder", () => {
  it("creates a pack folder that does not exist yet, writes the tarball there, and prints it; refuses a folder with files", () => {
    const base = mkdtempSync(join(tmpdir(), "buildos pack scan "));
    try {
      const out = join(base, "not", "there", "yet");
      const outputFile = join(base, "github-output");
      writeFileSync(outputFile, "");
      // --skip-build: the suite runs after the build, as CI does; the workflow step builds first.
      const r = spawnSync(process.execPath, [join(packageRoot, "scripts", "pack-for-scan.ts"), "--out", out, "--skip-build"], { cwd: packageRoot, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: outputFile } });
      assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
      const version = (JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { version: string }).version;
      const tarball = join(out, `brucewaynedecoy-buildos-${version}.tgz`);
      assert.equal(r.stdout, `tarball=${tarball}\n`);
      assert.equal(readFileSync(outputFile, "utf8"), `tarball=${tarball}\n`);
      assert.ok(readFileSync(tarball).length > 1000);
      const again = spawnSync(process.execPath, [join(packageRoot, "scripts", "pack-for-scan.ts"), "--out", out, "--skip-build"], { cwd: packageRoot, encoding: "utf8" });
      assert.equal(again.status, 1);
      assert.match(again.stderr, /is not empty/);
      assert.equal(spawnSync(process.execPath, [join(packageRoot, "scripts", "pack-for-scan.ts")], { cwd: packageRoot, encoding: "utf8" }).status, 2);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("release workflow: the resolve script (P8-R1-01, dispatch tag input)", () => {
  const script = stepScript(read("buildos-release.yml"), "resolve");
  let root: string;
  let main: string;
  let feature: string;
  const git = (args: string[], cwd = root) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-resolve-"));
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "commit.gpgsign", "false"]);
    mkdirSync(join(root, "toolkits", "buildos"), { recursive: true });
    writeFileSync(join(root, "toolkits", "buildos", "package.json"), `${JSON.stringify({ name: "x", version: "9.8.7" })}\n`);
    git(["add", "."]);
    git(["commit", "-q", "-m", "one"]);
    main = git(["rev-parse", "HEAD"]);
    git(["checkout", "-q", "-b", "feature"]);
    writeFileSync(join(root, "f.txt"), "f\n");
    git(["add", "."]);
    git(["commit", "-q", "-m", "two"]);
    feature = git(["rev-parse", "HEAD"]);
    // What actions/checkout with fetch-depth 0 leaves: remote branches and tags.
    git(["update-ref", "refs/remotes/origin/main", main]);
    git(["tag", "v9.8.7", main]);
    git(["tag", "v9.8.8", feature]);
    // A branch with the same name as a tag (P8-R1-01: checkout would prefer it).
    git(["branch", "v9.8.7", feature]);
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  function run(env: Record<string, string>, head: string) {
    git(["checkout", "-q", "--detach", head]);
    const out = join(mkdtempSync(join(tmpdir(), "buildos-resolve-out-")), "out");
    writeFileSync(out, "");
    const summary = `${out}.summary`;
    const r = spawnSync("bash", ["-c", script], {
      cwd: root,
      encoding: "utf8",
      env: { PATH: process.env["PATH"] ?? "", GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: summary, DEFAULT_BRANCH: "main", GITHUB_SHA: head, GITHUB_REF: "", GITHUB_REF_NAME: "", EVENT_NAME: "", RELEASE_TAG: "", RELEASE_PRERELEASE: "", RELEASE_ID: "", REPOSITORY_VISIBILITY: "public", INPUT_PURPOSE: "", INPUT_TAG: "", INPUT_CANDIDATES: "", INPUT_PLANT: "", ...env },
    });
    const output = Object.fromEntries(readFileSync(out, "utf8").split("\n").filter((l) => l !== "").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    rmSync(dirname(out), { recursive: true, force: true });
    return { status: r.status, stdout: r.stdout, output };
  }
  const release = (tag: string, head: string, extra: Record<string, string> = {}) => run({ EVENT_NAME: "release", RELEASE_TAG: tag, RELEASE_PRERELEASE: "false", RELEASE_ID: "42", GITHUB_REF: `refs/tags/${tag}`, ...extra }, head);
  const dispatch = (extra: Record<string, string>, head: string) => run({ EVENT_NAME: "workflow_dispatch", INPUT_PURPOSE: "dry-run", INPUT_CANDIDATES: "self", INPUT_PLANT: "none", ...extra }, head);

  it("a release whose tag peels to the event commit on the default branch resolves that one SHA", () => {
    const r = release("v9.8.7", main);
    assert.equal(r.status, 0, r.stdout);
    assert.deepEqual(r.output, { sha: main, tag: "v9.8.7", mode: "release", gate_mode: "release", candidates: "committed", plant: "none", prerelease: "false", release_id: "42", trusted_sha: main, default_branch: "main" });
  });

  it("refuses a release whose tag points at another commit, even with a same-named branch", () => {
    const r = release("v9.8.7", feature);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /the release tag does not point at the event commit/);
    assert.deepEqual(r.output, {}, "nothing is written to the step output");
  });

  it("refuses a release commit that is not on the default branch", () => {
    const r = release("v9.8.8", feature);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not on the default branch/);
  });

  it("refuses an event ref that is not the tag ref, and a prerelease flag that is not a boolean", () => {
    assert.match(release("v9.8.7", main, { GITHUB_REF: "refs/heads/v9.8.7" }).stdout, /event ref is not the release tag ref/);
    assert.match(release("v9.8.7", main, { RELEASE_PRERELEASE: "maybe" }).stdout, /prerelease flag is not true or false/);
    assert.match(release("v9.8.7", main, { RELEASE_ID: "42\nsha=0" }).stdout, /release ID is not a number/);
  });

  it("P8-R2-01: a release from a private repository stops in resolve, before any build", () => {
    const r = release("v9.8.7", main, { REPOSITORY_VISIBILITY: "private" });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /npm provenance needs a public repository; this one is private/);
    assert.deepEqual(r.output, {});
  });

  it("P8-R2-05: prepare runs from the default branch, resolves the tag's commit, reads the committed ledger, and refuses a plant", () => {
    const ok = dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "v9.8.7", INPUT_CANDIDATES: "committed", GITHUB_REF: "refs/heads/main" }, main);
    assert.equal(ok.status, 0, ok.stdout);
    assert.deepEqual(ok.output, { sha: main, tag: "v9.8.7", mode: "prepare", gate_mode: "release", candidates: "committed", plant: "none", prerelease: "", release_id: "", trusted_sha: main, default_branch: "main" });
    assert.match(dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "v9.8.7", INPUT_CANDIDATES: "committed", GITHUB_REF: "refs/heads/feature" }, feature).stdout, /run prepare from the default branch/);
    assert.match(dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "v9.9.9", INPUT_CANDIDATES: "committed", GITHUB_REF: "refs/heads/main" }, main).stdout, /the tag does not exist/);
    assert.match(dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "v9.8.8", INPUT_CANDIDATES: "committed", GITHUB_REF: "refs/heads/main" }, main).stdout, /not on the default branch/);
    assert.match(dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "v9.8.7", INPUT_CANDIDATES: "self", GITHUB_REF: "refs/heads/main" }, main).stdout, /choose candidates committed/);
    assert.match(dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "v9.8.7", INPUT_CANDIDATES: "committed", INPUT_PLANT: "osv", GITHUB_REF: "refs/heads/main" }, main).stdout, /refuses a planted failure/);
    assert.match(dispatch({ INPUT_PURPOSE: "prepare", INPUT_TAG: "", INPUT_CANDIDATES: "committed", GITHUB_REF: "refs/heads/main" }, main).stdout, /needs the tag/);
    assert.match(dispatch({ INPUT_PURPOSE: "publish" }, main).stdout, /purpose must be dry-run or prepare/);
  });

  it("validates the dispatch tag input before any use: a multi-line value cannot add an output", () => {
    const evil = dispatch({ INPUT_TAG: "v9.8.7\nsha=0000000000000000000000000000000000000000" }, feature);
    assert.equal(evil.status, 1);
    assert.match(evil.stdout, /not v followed by an exact semver version/);
    assert.deepEqual(evil.output, {});
    for (const tag of ["9.8.7", "v9.8", "v09.8.7", "v9.8.7+build", `v9.8.7-${"a".repeat(130)}`, "v9.8.7 "]) {
      assert.equal(dispatch({ INPUT_TAG: tag }, feature).status, 1, tag);
    }
    assert.equal(dispatch({ INPUT_TAG: "v9.8.7", INPUT_CANDIDATES: "other" }, feature).status, 1);
    assert.equal(dispatch({ INPUT_TAG: "v9.8.7", INPUT_PLANT: "everything" }, feature).status, 1);
  });

  it("a dry run off the default branch resolves its own commit; an empty tag is v plus package.json's version", () => {
    const r = dispatch({ INPUT_TAG: "", INPUT_CANDIDATES: "committed", INPUT_PLANT: "digest" }, feature);
    assert.equal(r.status, 0, r.stdout);
    assert.deepEqual(r.output, { sha: feature, tag: "v9.8.7", mode: "dry-run", gate_mode: "dry-run", candidates: "committed", plant: "digest", prerelease: "", release_id: "", trusted_sha: main, default_branch: "main" });
    const push = run({ EVENT_NAME: "push", GITHUB_REF_NAME: "release-dry-run/x-plant-osv" }, feature);
    assert.equal(push.output["plant"], "osv");
    assert.equal(push.output["candidates"], "self");
    assert.equal(run({ EVENT_NAME: "push", GITHUB_REF_NAME: "release-dry-run/x-plant-bogus" }, feature).status, 1);
  });

  it("refuses a checkout that is not the event commit", () => {
    const r = dispatch({ INPUT_TAG: "v9.8.7", GITHUB_SHA: main }, feature);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /checkout is not the event commit/);
  });
});

describe("the owner checklist protects the refs before any secret exists (P8-F-01)", () => {
  const security = readFileSync(join(import.meta.dirname, "..", "SECURITY.md"), "utf8");
  const section = security.slice(security.indexOf("### Owner Settings for Releases"), security.indexOf("### Sole Maintainer or Two Maintainers"));
  const steps = [...section.matchAll(/^(\d+)\. (.*)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2] ?? "" }));
  /** The number of the one step that matches. */
  const step = (pattern: RegExp): number => {
    const found = steps.filter((s) => pattern.test(s.text));
    assert.equal(found.length, 1, `exactly one step matches ${String(pattern)}: ${found.map((s) => s.n).join(", ")}`);
    return (found[0] as { n: number }).n;
  };

  it("numbers the steps 1, 2, 3, ... with no gap", () => {
    assert.deepEqual(steps.map((s) => s.n), steps.map((_, i) => i + 1));
  });

  it("deletes the repository secret first, then rulesets and immutability, then a verification, then environments, then the environment secret, then npm", () => {
    const order = [
      step(/^Delete the old repository secret/),
      step(/^Rename the current repository to `build-os-archive`/),
      step(/^Create the new repository/),
      step(/^Make the new repository public/),
      step(/^Default branch ruleset/),
      step(/^Release tags: .*New tag ruleset/),
      step(/^Immutable releases/),
      step(/^Verify steps/),
      step(/^Environment `buildos-deny-list`/),
      step(/^Environment `buildos-npm-stage`/),
      step(/^Only now add the environment secret/),
      step(/npm trusted publishing/),
    ];
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `steps in order: ${order.join(", ")}`);
    assert.equal(order[0], 1, "the old repository secret goes first");
    assert.equal(order.at(-1), steps.length, "npm trusted publishing is last");
  });

  // W1 R7 P8 pin-first final check, finding 4: GitHub Free has rulesets only on a public repository, and a branch rule
  // never stops a tag. The new repository is private and empty, gets one commit from a fresh folder (only main pushed),
  // is checked for one commit, one branch, and no tag before it is public and again after the settings, and gets its
  // rulesets at once after it is public.
  it("finding 4: pushes only main from a fresh folder, checks the remote before it is public and again, and adds no ruleset while private", () => {
    const create = step(/^Create the new repository/);
    const fresh = step(/^Make the one clean commit in a fresh folder, and push only `main`/);
    const check = step(/^Check the remote, in a new empty folder/);
    const visible = step(/^Make the new repository public/);
    const again = step(/^Check the remote again, as in step \d+/);
    const npm = step(/npm trusted publishing/);
    assert.deepEqual([create, fresh, check, visible, step(/^Default branch ruleset/)], [create, create + 1, create + 2, create + 3, create + 4]);
    for (const later of [/^Release tags:/, /^Immutable releases/, /^Environment `buildos-npm-stage`/, /^Only now add the environment secret/, /^Private vulnerability reporting/]) assert.ok(step(later) < again, String(later));
    assert.equal(again, npm - 1);
    assert.match(section, new RegExp(`Check the remote again, as in step ${check},`));
    const freshText = steps.find((s) => s.n === fresh)?.text ?? "";
    assert.match(freshText, /`git init -b main`/);
    assert.match(freshText, /check-deny-list\.mjs --root \. --list-file/);
    assert.match(freshText, /`git push origin refs\/heads\/main:refs\/heads\/main`/);
    assert.match(freshText, /Never use `--all`, `--mirror`, or `--tags`/);
    for (const n of [check, again]) {
      const text = steps.find((s) => s.n === n)?.text ?? "";
      assert.match(text, /git ls-remote --heads --tags https:\/\/github\.com\/brucewaynedecoy\/build-os\.git` prints exactly one line, `<commit> refs\/heads\/main`/);
      assert.match(text, /rev-list --all --count` prints `1`/);
      assert.match(text, /tags --jq length` prints `0`/);
    }
    for (const s of steps.filter((x) => x.n < visible)) assert.doesNotMatch(s.text, /New ruleset|Restrict creations/, `no ruleset before the repository is public (step ${s.n})`);
    assert.doesNotMatch(section, /`cutover`/);
  });

  it("only the environment-secret step sets a secret, and only after both rulesets, immutability, and both environments", () => {
    const setters = steps.filter((s) => /gh secret set|Add environment secret/.test(s.text)).map((s) => s.n);
    assert.deepEqual(setters, [step(/^Only now add the environment secret/)]);
    for (const before of [/^Default branch ruleset/, /^Release tags:/, /^Immutable releases/, /^Environment `buildos-deny-list`/, /^Environment `buildos-npm-stage`/]) assert.ok(step(before) < (setters[0] ?? 0), String(before));
  });

  it("the branch-ruleset step names exactly the checks the in-job ruleset check requires", () => {
    const text = steps.find((s) => /^Default branch ruleset/.test(s.text))?.text ?? "";
    const named = [...(text.slice(text.indexOf("with these checks:"), text.indexOf("Do not require")).matchAll(/`([^`]+)`/g))].map((m) => m[1]);
    assert.deepEqual(named, [...REQUIRED_CHECKS]);
  });

  it("states the trust rule and what the in-job ruleset check cannot see", () => {
    assert.match(security, /Trust rule: write access to this repository is a release-trusted role\./);
    assert.match(security, /Untrusted contributions come through pull requests from forks/);
    assert.match(security, /What the job cannot check: who may bypass a ruleset/);
    assert.doesNotMatch(security, /cannot check the rulesets or branch protection from inside the job/);
  });
});
