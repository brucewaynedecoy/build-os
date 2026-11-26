// W1 R7 P8 review round 1: the local release dry run reads identity first
// and refuses incomplete arguments (P8-R1-08); the golden harness expects the
// release identity of a release-stamped tarball (release-stamped goldens);
// every advertised just recipe shares one guarded dependency step (P8-R1-09).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseDryRunArgs, readIdentity, UsageError } from "../scripts/release-dry-run.ts";
import { changedFiles, isAncestor } from "../scripts/release-lib.ts";
import { exceptionsWithBuildIdentity, expectedBuildIdentity, GOLDEN_BUILD_IDENTITY, withBuildIdentity, type Observation } from "./golden/harness.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");

describe("release dry run arguments (P8-R1-08)", () => {
  it("--tag and --candidates go together; so do --osv-results and --osv-exit", () => {
    assert.throws(() => parseDryRunArgs(["--tag", "v0.1.0"]), (e: unknown) => e instanceof UsageError && /--tag and --candidates go together/.test(e.message));
    assert.throws(() => parseDryRunArgs(["--candidates", "x.json"]), /go together/);
    assert.throws(() => parseDryRunArgs(["--osv-results", "r.json"]), /--osv-results and --osv-exit go together/);
    assert.deepEqual(parseDryRunArgs(["--tag", "v0.1.0", "--candidates", "x.json"]), { plant: "none", allowDirty: false, visibility: "unknown", tag: "v0.1.0", candidates: "x.json" });
    assert.deepEqual(parseDryRunArgs([]), { plant: "none", allowDirty: false, visibility: "unknown" });
  });

  it("refuses an unknown option, a missing value, a repeated option, and an unknown plant", () => {
    assert.throws(() => parseDryRunArgs(["--bogus"]), /unknown argument --bogus/);
    assert.throws(() => parseDryRunArgs(["stray"]), /unknown argument \(not an option\)/);
    assert.throws(() => parseDryRunArgs(["--tag"]), /--tag needs a value/);
    assert.throws(() => parseDryRunArgs(["--plant", "x", "--plant", "y"]), /given twice/);
    assert.throws(() => parseDryRunArgs(["--plant", "everything"]), /--plant must be one of/);
  });

  it("the command exits 2 with a usage message for --tag alone (it never builds)", () => {
    const run = spawnSync(process.execPath, [join(packageRoot, "scripts", "release-dry-run.ts"), "--tag", "v0.1.0"], { cwd: packageRoot, encoding: "utf8" });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /--tag and --candidates go together/);
    assert.doesNotMatch(run.stdout, /build/);
  });
});

describe("release dry run identity, before any build (P8-R1-08)", () => {
  let root: string;
  let reviewed: string;
  let candidatesOnly: string;
  let otherChange: string;
  let unrelated: string;
  const ledgerPath = "toolkits/buildos/release-candidates.json";
  const git = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const commit = (files: Record<string, string>, message: string) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    git(["add", "."]);
    git(["commit", "-q", "-m", message]);
    return git(["rev-parse", "HEAD"]);
  };
  const ledger = (sourceCommit: string) =>
    `${JSON.stringify({ schema_version: 2, candidates: [{ kind: "reviewed", version: "9.8.7", tag: "v9.8.7", tarball_name: "build-os-9.8.7.tgz", tarball_sha256: "0".repeat(64), source_commit: sourceCommit, node_version: "v24.22.3", npm_version: "11.19.1", runner_image: "ubuntu-24.04", reviewed_by: "fixture reviewer", reviewed_on: "2026-11-24", review_evidence: "fixture, not a release" }] }, null, 2)}\n`;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-dry-identity-"));
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "commit.gpgsign", "false"]);
    reviewed = commit({ "toolkits/buildos/src.txt": "source\n", [ledgerPath]: `${JSON.stringify({ schema_version: 2, candidates: [] })}\n` }, "the reviewed commit");
    // The usual release commit: only the ledger changes on top of the reviewed commit.
    candidatesOnly = commit({ [ledgerPath]: ledger(reviewed) }, "the reviewed entry");
    otherChange = commit({ "toolkits/buildos/src.txt": "changed\n" }, "a later change");
    git(["checkout", "-q", "--orphan", "side"]);
    unrelated = commit({ "x.txt": "x\n", [ledgerPath]: ledger(reviewed) }, "unrelated history");
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  const identityAt = (head: string) => {
    const file = join(root, `ledger-${head.slice(0, 7)}.json`);
    writeFileSync(file, ledger(reviewed));
    return readIdentity({ plant: "none", allowDirty: false, visibility: "unknown", tag: "v9.8.7", candidates: file }, { head, diff: (a, b) => changedFiles(a, b, root), ancestor: (a, b) => isAncestor(a, b, root) });
  };

  it("a candidates-only commit on top of the reviewed source commit verifies, with the source commit as the revision", () => {
    const r = identityAt(candidatesOnly);
    assert.deepEqual(r.problems, []);
    assert.equal(r.identity?.kind, "committed");
    assert.equal(r.identity?.kind === "committed" ? r.identity.sourceCommit : "", reviewed);
  });

  it("refuses a commit that changes more than the ledger, and one that does not descend from the source commit", () => {
    assert.match(identityAt(otherChange).problems.join(";"), /differ from .* outside toolkits\/buildos\/release-candidates\.json: toolkits\/buildos\/src\.txt/);
    assert.match(identityAt(unrelated).problems.join(";"), /is not an ancestor of/);
  });

  it("without --tag and --candidates it is a self run (an entry from build A, checked against build B)", () => {
    assert.deepEqual(readIdentity({ plant: "none", allowDirty: false, visibility: "unknown" }, { head: reviewed, diff: () => [], ancestor: () => true }), { identity: { kind: "self" }, problems: [] });
  });
});

describe("golden harness: release-stamped builds (P8-R1 release-stamped goldens)", () => {
  const obs = (stdout: string, stderr = ""): Observation => ({ exit: 0, stdout: Buffer.from(stdout), stderr: Buffer.from(stderr), added: [], changed: [], removed: [], files: new Map() });
  const identity = { version: "0.1.0", sourceRevision: "a".repeat(40) };

  it("stamps only the four build identity places, and leaves every other byte", () => {
    const golden = obs('version: dev\nsource revision: unknown\n{\n  "version": "dev",\n  "source_revision": "unknown",\n  "note": "version: dev in a value",\n  "other_version": "dev"\n}\n', "buildos: error\nversion: dev\nsource revision: unknown\n");
    const stamped = withBuildIdentity(golden, identity);
    assert.equal(stamped.stdout.toString(), `version: 0.1.0\nsource revision: ${"a".repeat(40)}\n{\n  "version": "0.1.0",\n  "source_revision": "${"a".repeat(40)}",\n  "note": "version: dev in a value",\n  "other_version": "dev"\n}\n`);
    assert.equal(stamped.stderr.toString(), `buildos: error\nversion: 0.1.0\nsource revision: ${"a".repeat(40)}\n`);
    assert.deepEqual(GOLDEN_BUILD_IDENTITY, { version: "dev", sourceRevision: "unknown" });
  });

  it("a development build no longer matches when a release identity is expected", () => {
    const golden = obs('{\n  "version": "dev"\n}\n');
    assert.notDeepEqual(withBuildIdentity(golden, identity).stdout, golden.stdout);
  });

  it("stamps the exact values that parity exceptions pin, and nothing else in them", () => {
    const list = [{ id: "PE-X", golden: [{ case: "c", field: "stdout", actual: '{\n  "version": "dev"\n}\n' }, { case: "d", field: "exit", actual: null }] }];
    const stamped = exceptionsWithBuildIdentity(list, identity);
    assert.equal(stamped[0]?.golden[0]?.actual, '{\n  "version": "0.1.0"\n}\n');
    assert.equal(stamped[0]?.golden[1]?.actual, null);
    assert.equal(list[0]?.golden[0]?.actual, '{\n  "version": "dev"\n}\n', "the loaded exceptions are not changed");
  });

  it("reads the expected identity from the environment: both or neither, a version and a full SHA", () => {
    assert.equal(expectedBuildIdentity({}), undefined);
    assert.deepEqual(expectedBuildIdentity({ BUILDOS_GOLDEN_EXPECT_VERSION: "0.1.0", BUILDOS_GOLDEN_EXPECT_REVISION: "a".repeat(40) }), identity);
    assert.throws(() => expectedBuildIdentity({ BUILDOS_GOLDEN_EXPECT_VERSION: "0.1.0" }), /both/);
    assert.throws(() => expectedBuildIdentity({ BUILDOS_GOLDEN_EXPECT_VERSION: "0.1.0", BUILDOS_GOLDEN_EXPECT_REVISION: "HEAD" }), /full commit SHA/);
  });
});

describe("just recipes share one guarded dependency step (P8-R1-09)", () => {
  const justfile = readFileSync(join(repoRoot, "justfile"), "utf8").replace(/\r\n/g, "\n");
  it("build-buildos, test-buildos, install-toolkits, and release-dry-run depend on buildos-deps", () => {
    for (const recipe of ["build-buildos", "test-buildos", "install-toolkits", "release-dry-run *args"]) assert.match(justfile, new RegExp(`\\n${recipe.replace(/[*]/g, "\\*")}: buildos-deps\\n`), recipe);
  });

  it("buildos-deps checks the policy, installs with scripts off when the lockfile changed, and checks the installed manifests", () => {
    const start = justfile.indexOf("\nbuildos-deps:\n");
    const body = justfile.slice(start, justfile.indexOf("\n\n", start));
    assert.match(body, /node scripts\/check-dependencies\.ts\n/);
    assert.match(body, /npm ci --ignore-scripts\n/);
    assert.match(body, /node_modules\/\.buildos-lock-sha256/);
    assert.match(body, /node scripts\/check-dependencies\.ts --installed/);
    assert.match(justfile, /\[private\]\nbuildos-deps:/);
  });
});
