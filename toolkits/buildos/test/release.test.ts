// W1 R7 P8 Stage 1 (t2 to t6, A64, A65, A66): the release scripts and the
// release workflow. Every gate is tested with the agreement case and with
// its planted failure, offline. The real gates (npm audit and osv-scanner
// need the network) run in .github/workflows/buildos-release.yml and in
// scripts/release-dry-run.ts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { bundle } from "../scripts/build.ts";
import { TAR_END, tarGz, ustarEntry } from "./tar-fixture.ts";
import { assertOutsideRepository, computeCandidate, selfCandidate } from "../scripts/release-candidate.ts";
import { releaseRevision } from "../scripts/release-build.ts";
import { buildPlaceholder, PLACEHOLDER_DIST_TAG, PLACEHOLDER_VERSION, placeholderFiles, placeholderPackageJson, placeholderTarballProblems } from "../scripts/reserved-placeholder.ts";
import {
  auditGate,
  denyListGate,
  denyListLines,
  digestGate,
  evalGate,
  identityGate,
  imageOsOfLabel,
  osvGate,
  PLANT_FIXTURES,
  provenanceGate,
  runGate,
  summaryLines,
  tapCounts,
  testRunProblems,
  versionGate,
  type IdentityInput,
} from "../scripts/release-gate.ts";
import {
  CANDIDATES_FILE,
  candidatesFileProblems,
  LEDGER_SCHEMA_VERSION,
  loadCandidates,
  packedManifestProblems,
  readTarball,
  RELEASE_NODE_VERSION,
  RELEASE_NPM_VERSION,
  type ReleaseCandidate,
} from "../scripts/release-lib.ts";
import { manifestDifferences, type PackManifest } from "../scripts/reproducible-pack.ts";
import { bundledPackages, PDFJS_INNER, sbomProblems, stableUuid, type Sbom } from "../scripts/sbom.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const DIGEST = "0123456789abcdef".repeat(4);

/** A reviewed fixture entry. It names no real release. */
function entry(overrides: Partial<ReleaseCandidate> = {}): ReleaseCandidate {
  return {
    kind: "reviewed",
    version: "9.8.7",
    tag: "v9.8.7",
    tarball_name: "build-os-9.8.7.tgz",
    tarball_sha256: DIGEST,
    source_commit: SHA_A,
    node_version: RELEASE_NODE_VERSION,
    npm_version: RELEASE_NPM_VERSION,
    runner_image: "ubuntu-24.04",
    reviewed_by: "fixture reviewer",
    reviewed_on: "2026-11-24",
    review_evidence: "test fixture, not a release",
    ...overrides,
  };
}

function identity(overrides: Partial<IdentityInput> = {}): IdentityInput {
  return {
    tag: "v9.8.7",
    packageVersion: "9.8.7",
    candidates: [entry()],
    head: SHA_B,
    expectHead: SHA_B,
    diff: () => ["toolkits/buildos/release-candidates.json"],
    ancestor: () => true,
    mode: "release",
    env: { node: RELEASE_NODE_VERSION, npm: RELEASE_NPM_VERSION, imageOs: "ubuntu24" },
    ...overrides,
  };
}

describe("release candidates file (t3; P8-R1-03, P8-R1-06)", () => {
  // P8-R1-03: the committed ledger is checked for its schema and uniqueness, not for being empty,
  // so the first reviewed entry passes. The empty ledger is a fixture.
  it("the committed ledger is valid: schema version 2, reviewed entries only, one per tag and per digest", () => {
    const file = loadCandidates(CANDIDATES_FILE, { committed: true });
    assert.equal(file.schema_version, LEDGER_SCHEMA_VERSION);
    for (const c of file.candidates) assert.equal(c.kind, "reviewed", c.tag);
    assert.equal(new Set(file.candidates.map((c) => c.tag)).size, file.candidates.length);
    assert.equal(new Set(file.candidates.map((c) => c.tarball_sha256)).size, file.candidates.length);
  });

  it("an empty ledger (fixture) is valid and a ledger with a first reviewed entry is valid too", () => {
    const empty = JSON.parse(readFileSync(join(packageRoot, "test", "fixtures", "release", "empty-ledger.json"), "utf8")) as unknown;
    assert.deepEqual(candidatesFileProblems(empty, { committed: true }), []);
    assert.deepEqual((empty as { candidates: unknown[] }).candidates, []);
    assert.deepEqual(candidatesFileProblems({ schema_version: 2, candidates: [entry({ version: "0.1.0", tag: "v0.1.0", tarball_name: "build-os-0.1.0.tgz" })] }, { committed: true }), []);
  });

  it("the committed ledger refuses a self entry; a ledger outside the repository may hold one for a dry run", () => {
    const self = entry({ kind: "self" });
    assert.ok(candidatesFileProblems({ schema_version: 2, candidates: [self] }, { committed: true }).some((p) => /dry-run self entry; the committed ledger holds reviewed entries only/.test(p)));
    assert.deepEqual(candidatesFileProblems({ schema_version: 2, candidates: [self] }), []);
    assert.ok(candidatesFileProblems({ schema_version: 2, candidates: [entry({ kind: "maybe" as "self" })] }).some((p) => /kind "maybe" is not reviewed or self/.test(p)));
    const { kind: _, ...noKind } = entry();
    assert.ok(candidatesFileProblems({ schema_version: 2, candidates: [noKind] }).some((p) => /kind is missing/.test(p)));
  });

  it("the tooling never writes a self entry inside the repository", () => {
    assert.throws(() => assertOutsideRepository(CANDIDATES_FILE), /only outside the repository/);
    assert.throws(() => assertOutsideRepository(join(packageRoot, "self-candidates.json")), /only outside the repository/);
    assert.doesNotThrow(() => assertOutsideRepository(join(tmpdir(), "self-candidates.json")));
    const run = spawnSync(process.execPath, [join(packageRoot, "scripts", "release-candidate.ts"), "self", "--build", join(packageRoot, "package.json"), "--out", CANDIDATES_FILE], { cwd: packageRoot, encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /only outside the repository/);
  });

  it("accepts a well-formed entry and names each malformed field", () => {
    assert.deepEqual(candidatesFileProblems({ schema_version: 2, candidates: [entry()] }), []);
    const problems = candidatesFileProblems({
      schema_version: 2,
      candidates: [entry({ tag: "9.8.7", tarball_sha256: "xyz", source_commit: "abc", reviewed_on: "today" }), { ...entry(), extra: "x" }, entry()],
    });
    assert.ok(problems.some((p) => /candidates\[0\]\.tag "9\.8\.7" is not v9\.8\.7/.test(p)), problems.join("\n"));
    assert.ok(problems.some((p) => /tarball_sha256 is not 64/.test(p)));
    assert.ok(problems.some((p) => /source_commit is not a full/.test(p)));
    assert.ok(problems.some((p) => /reviewed_on "today"/.test(p)));
    assert.ok(problems.some((p) => /candidates\[1\] has an unknown field "extra"/.test(p)));
    assert.ok(problems.some((p) => /repeats tag v9\.8\.7/.test(p)));
    assert.ok(problems.some((p) => /repeats tarball SHA-256/.test(p)));
    assert.ok(candidatesFileProblems({ schema_version: 1, candidates: [] }).includes("schema_version is not 2"));
  });

  it("an entry needs every review field, so an unreviewed build cannot pass as reviewed", () => {
    const { reviewed_by: _, ...unreviewed } = entry();
    assert.ok(candidatesFileProblems({ schema_version: 2, candidates: [unreviewed] }).some((p) => /reviewed_by is missing or empty/.test(p)));
    assert.ok(candidatesFileProblems({ schema_version: 2, candidates: [entry({ reviewed_by: " " })] }).some((p) => /reviewed_by is missing or empty/.test(p)));
  });

  it("compute takes the inspected tarball: it refuses a dirty build, a build outside the reference environment, and a tarball that is not the build's, and makes a reviewed entry otherwise", () => {
    const build = {
      version: "9.8.7",
      source_revision: SHA_A,
      dirty: false,
      tarball: "x.tgz",
      tarball_sha256: DIGEST,
      node_version: RELEASE_NODE_VERSION,
      npm_version: RELEASE_NPM_VERSION,
      runner_image: "ubuntu24",
    };
    const review = { by: "fixture reviewer", on: "2026-11-24", evidence: "fixture" };
    const tarball = { sha256: DIGEST, name: "build-os-9.8.7.tgz", packageJson: { name: "build-os", version: "9.8.7" } };
    assert.deepEqual(computeCandidate(build, review, tarball), entry({ review_evidence: "fixture" }));
    assert.equal(computeCandidate(build, review, tarball).kind, "reviewed");
    assert.throws(() => computeCandidate({ ...build, dirty: true, source_revision: `${SHA_A}-dirty` }, review, tarball), /not of a clean commit/);
    assert.throws(() => computeCandidate({ ...build, node_version: "v26.13.1" }, review, tarball), /not the reference v24\.22\.3/);
    assert.throws(() => computeCandidate({ ...build, npm_version: "11.20.0" }, review, tarball), /not the reference 11\.19\.1/);
    assert.throws(() => computeCandidate({ ...build, runner_image: "local" }, review, tarball), /not the reference ubuntu-24\.04/);
    assert.throws(() => computeCandidate(build, review, { ...tarball, sha256: "f".repeat(64) }), /inspected tarball SHA-256 f{64} is not the 0123/);
    assert.throws(() => computeCandidate(build, review, { ...tarball, packageJson: { name: "build-os", version: "9.8.6" } }), /holds build-os@9\.8\.6/);
  });

  it("a dry-run self entry is kind self and says it is not a review", () => {
    const self = selfCandidate({ version: "9.8.7", source_revision: `${SHA_A}-dirty`, dirty: true, tarball: "x", tarball_sha256: DIGEST, node_version: "v26.13.1", npm_version: "11.20.0", runner_image: "local" }, SHA_A, "local");
    assert.equal(self.kind, "self");
    assert.equal(self.source_commit, SHA_A);
    assert.match(self.reviewed_by, /not a review/);
    assert.deepEqual(candidatesFileProblems({ schema_version: 2, candidates: [self] }), []);
  });
});

describe("identity gate (A64: tag, version, reviewed entry)", () => {
  it("P8-R2-08: the ledger change is exempt only as a plain file; a link or an executable at HEAD fails", () => {
    const link = identityGate(identity({ ledgerAtHead: () => ({ mode: "120000", type: "blob" }) }));
    assert.match(link.problems.join(";"), /is not a regular file \(git mode 120000, type blob\)/);
    assert.match(identityGate(identity({ ledgerAtHead: () => ({ mode: "100755", type: "blob" }) })).problems.join(";"), /git mode 100755/);
    assert.deepEqual(identityGate(identity({ ledgerAtHead: () => ({ mode: "100644", type: "blob" }) })).problems, []);
  });

  it("P8-R2-08: release mode reads the committed ledger from git and refuses a --candidates file", async () => {
    await assert.rejects(runGate("identity", ["--mode", "release", "--tag", "v9.8.7", "--head", SHA_A, "--candidates", join(tmpdir(), "x.json")]), /release mode reads the committed ledger from git at HEAD/);
    await assert.rejects(runGate("digest", ["--mode", "release", "--tag", "v9.8.7", "--tarball", join(packageRoot, "package.json"), "--candidates", join(tmpdir(), "x.json")]), /--candidates is for a dry run's self entry only/);
  });

  it("passes when the tag, the package version, and the reviewed entry agree, and names the source commit and dist tag", () => {
    const r = identityGate(identity());
    assert.deepEqual(r.problems, []);
    assert.equal(r.outputs?.["source_commit"], SHA_A);
    assert.equal(r.outputs?.["dist_tag"], "latest");
    assert.equal(identityGate(identity({ tag: "v9.8.7-rc.1", packageVersion: "9.8.7-rc.1", candidates: [entry({ version: "9.8.7-rc.1", tag: "v9.8.7-rc.1" })] })).outputs?.["dist_tag"], "next");
  });

  it("fails when the tag and the package version disagree (and on the planted tag)", () => {
    assert.match(identityGate(identity({ tag: "v9.8.8" })).problems.join(";"), /the tag v9\.8\.8 and the package\.json version 9\.8\.7 disagree/);
    const planted = identityGate(identity({ mode: "dry-run", plant: "tag" }));
    assert.equal(planted.pass, false);
    assert.match(planted.problems.join(";"), /v9\.8\.7-planted and the package\.json version 9\.8\.7 disagree/);
  });

  it("fails when the reviewed entry's version differs (and on the planted version)", () => {
    assert.match(identityGate(identity({ packageVersion: "9.8.7", candidates: [{ ...entry(), version: "9.8.6" }] })).problems.join(";"), /has version 9\.8\.6, but package\.json has 9\.8\.7/);
    assert.match(identityGate(identity({ mode: "dry-run", plant: "version" })).problems.join(";"), /has version 9\.8\.7-planted, but package\.json has 9\.8\.7/);
  });

  it("fails with no reviewed entry for the tag, a non-semver tag, or a prerelease flag that disagrees", () => {
    assert.match(identityGate(identity({ candidates: [] })).problems.join(";"), /no reviewed entry for tag v9\.8\.7/);
    assert.match(identityGate(identity({ tag: "release-1" })).problems.join(";"), /not v followed by an exact semver version/);
    assert.match(identityGate(identity({ prerelease: true })).problems.join(";"), /prerelease flag \(true\) disagrees/);
  });

  it("fails when the release commit's files differ from the reviewed commit outside the candidates file", () => {
    const r = identityGate(identity({ diff: () => ["toolkits/buildos/release-candidates.json", "toolkits/buildos/src/cli/main.ts"] }));
    assert.match(r.problems.join(";"), /differ from b{40} outside toolkits\/buildos\/release-candidates\.json: toolkits\/buildos\/src\/cli\/main\.ts/);
  });

  it("fails when the reviewed source commit is not an ancestor of the tag commit (P8-R1-08)", () => {
    assert.match(identityGate(identity({ ancestor: () => false })).problems.join(";"), /reviewed source commit a{40} is not an ancestor of b{40}/);
  });

  it("fails when the checkout is not the commit the workflow resolved from the release event (P8-R1-01)", () => {
    assert.match(identityGate(identity({ expectHead: "c".repeat(40) })).problems.join(";"), /the checkout is b{40}, not the resolved release commit c{40}/);
  });

  it("release mode accepts only a reviewed entry; a self entry fails (P8-R1-06)", () => {
    const r = identityGate(identity({ candidates: [entry({ kind: "self" })] }));
    assert.equal(r.pass, false);
    assert.match(r.problems.join(";"), /is a self entry, not a reviewed one/);
    assert.equal(identityGate(identity({ mode: "dry-run", candidates: [entry({ kind: "self" })] })).pass, true);
    assert.match(digestGate({ tag: "v9.8.7", candidates: [entry({ kind: "self" })], actualSha256: DIGEST, mode: "release" }).problems.join(";"), /self entry, not a reviewed one/);
  });

  it("release mode fails outside the reference environment; a dry run only notes the environment", () => {
    const off = identity({ env: { node: "v24.1.0", npm: "11.0.0", imageOs: "macos15" } });
    const release = identityGate(off);
    assert.equal(release.problems.length, 3, release.problems.join("\n"));
    const dry = identityGate({ ...off, mode: "dry-run" });
    assert.equal(dry.pass, true);
    assert.equal(dry.notes.length, 3);
    assert.equal(imageOsOfLabel("ubuntu-24.04"), "ubuntu24");
  });
});

describe("digest gate (A64: digest)", () => {
  it("passes on the reviewed SHA-256 and fails on any other (and on the planted digest)", () => {
    assert.equal(digestGate({ tag: "v9.8.7", candidates: [entry()], actualSha256: DIGEST }).pass, true);
    assert.match(digestGate({ tag: "v9.8.7", candidates: [entry()], actualSha256: "f".repeat(64) }).problems.join(";"), /is not the reviewed/);
    assert.equal(digestGate({ tag: "v9.8.7", candidates: [entry()], actualSha256: DIGEST, plant: "digest" }).pass, false);
    assert.equal(digestGate({ tag: "v9.8.8", candidates: [entry()], actualSha256: DIGEST }).pass, false);
  });
});

describe("version gate (A66)", () => {
  it("passes only when the packed CLI reports the package version and the expected revision", () => {
    const report = (version: string, revision: string) => JSON.stringify({ ok: true, version, source_revision: revision });
    assert.equal(versionGate({ reported: report("9.8.7", SHA_A), packageVersion: "9.8.7", expectRevision: SHA_A }).pass, true);
    assert.match(versionGate({ reported: report("dev", "unknown"), packageVersion: "9.8.7", expectRevision: SHA_A }).problems.join(";"), /reports dev, not 9\.8\.7.*source revision unknown/);
    assert.equal(versionGate({ reported: "not json", packageVersion: "9.8.7", expectRevision: SHA_A }).pass, false);
  });
});

describe("audit gate (A65)", () => {
  const clean = JSON.stringify({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { info: 0, low: 1, moderate: 2, high: 0, critical: 0, total: 3 } } });
  it("passes below high with exit 0 and fails on high or critical, an npm error, a report it cannot read, or an exit status the counts do not explain (P8-R1-10)", () => {
    assert.equal(auditGate({ reportText: clean, exitCode: 0 }).pass, true);
    assert.match(auditGate({ reportText: clean, exitCode: 1 }).problems.join(";"), /exited 1 with no high or critical advisory/);
    assert.equal(auditGate({ reportText: readFileSync(PLANT_FIXTURES.audit, "utf8"), exitCode: 0 }).pass, false);
    assert.match(auditGate({ reportText: readFileSync(PLANT_FIXTURES.audit, "utf8"), exitCode: 1 }).problems.join(";"), /1 high and 0 critical/);
    assert.match(auditGate({ reportText: JSON.stringify({ error: { code: "ENOTFOUND", summary: "request failed" } }), exitCode: 1 }).problems.join(";"), /npm audit failed: ENOTFOUND/);
    assert.equal(auditGate({ reportText: "", exitCode: 1 }).pass, false);
    assert.equal(auditGate({ reportText: JSON.stringify({ auditReportVersion: 1 }), exitCode: 0 }).pass, false);
    assert.equal(auditGate({ reportText: clean, exitCode: 254 }).pass, false);
  });

  it("runs npm audit with the high threshold and dev packages, so the exit status and the threshold agree", () => {
    const source = readFileSync(join(packageRoot, "scripts", "release-gate.ts"), "utf8");
    assert.match(source, /AUDIT_ARGS = \["audit", "--audit-level=high", "--include=dev", "--json"\]/);
  });

  it("the planted audit failure stops the gate in a dry run and is refused in release mode", async () => {
    assert.equal((await runGate("audit", ["--plant", "audit"])).pass, false);
    await assert.rejects(runGate("audit", ["--mode", "release", "--plant", "audit"]), /only allowed in dry-run mode/);
  });
});

describe("OSV gate (A65)", () => {
  it("passes a clean scan and fails the planted high finding and a scanner error", async () => {
    assert.equal(osvGate({ exitCode: 0, resultsText: readFileSync(join(packageRoot, "test", "fixtures", "osv", "clean.json"), "utf8") }).pass, true);
    assert.equal((await runGate("osv", ["--plant", "osv"])).pass, false);
    assert.equal(osvGate({ exitCode: 127, resultsText: readFileSync(join(packageRoot, "test", "fixtures", "osv", "unreachable-api.json"), "utf8") }).pass, false);
    assert.equal(osvGate({ exitCode: undefined, resultsText: undefined }).pass, false);
  });
});

describe("eval gate (A65; P8-R1-10)", () => {
  it("the planted converter fails the conversion eval gate", async () => {
    const r = await runGate("eval", ["--plant", "eval"]);
    assert.equal(r.pass, false);
    assert.match(r.problems.join(";"), /conversion eval gate failed .* with the planted converter/);
  });

  const tap = (pass: number, fail: number) => `TAP version 13\n# tests ${pass + fail}\n# pass ${pass}\n# fail ${fail}\n`;
  const report = (ids: string[], failing: string[] = []) => JSON.stringify({ results: ids.map((id) => ({ id, pass: !failing.includes(id) })) });
  it("needs a positive number of executed tests and the whole corpus in the report, all passing", () => {
    const ok = { status: 0, stdout: tap(8, 0) };
    assert.equal(evalGate({ run: ok, reportText: report(["a", "b"]), manifestIds: ["a", "b"], planted: false }).pass, true);
    assert.match(evalGate({ run: { status: 0, stdout: tap(0, 0) }, reportText: report(["a", "b"]), manifestIds: ["a", "b"], planted: false }).problems.join(";"), /ran no test/);
    assert.match(evalGate({ run: { status: 0, stdout: "no summary" }, reportText: report(["a"]), manifestIds: ["a"], planted: false }).problems.join(";"), /printed no test summary/);
    assert.match(evalGate({ run: ok, reportText: undefined, manifestIds: ["a"], planted: false }).problems.join(";"), /wrote no report/);
    assert.match(evalGate({ run: ok, reportText: report(["a"]), manifestIds: ["a", "b"], planted: false }).problems.join(";"), /ran 1 of the 2 manifest files/);
    assert.match(evalGate({ run: ok, reportText: report(["a", "b"], ["b"]), manifestIds: ["a", "b"], planted: false }).problems.join(";"), /below the gate: b/);
    assert.match(evalGate({ run: ok, reportText: report([]), manifestIds: [], planted: false }).problems.join(";"), /lists no file/);
  });

  it("reads TAP summaries and judges a test run", () => {
    assert.deepEqual(tapCounts(tap(3, 1)), { pass: 3, fail: 1 });
    assert.equal(tapCounts("nothing"), undefined);
    assert.deepEqual(testRunProblems("x", { status: 0, stdout: tap(2, 0) }), []);
    assert.match(testRunProblems("x", { status: 1, stdout: tap(2, 1) }).join(";"), /x failed \(exit 1, 2 passed, 1 failed\)/);
    assert.match(testRunProblems("x", { status: null, stdout: "", error: new Error("spawn failed") }).join(";"), /could not run: spawn failed/);
  });
});

describe("deny-list gate (A65)", () => {
  let root: string;
  let list: string;
  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-release-deny-"));
    spawnSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(join(root, "note.txt"), "an ordinary file\n");
    list = join(mkdtempSync(join(tmpdir(), "buildos-release-list-")), "list.txt");
    // Joined here, so no repository file holds the invented term.
    writeFileSync(list, `${["zz", "invented", "client", "alpha"].join("-")}\n`);
  });
  after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(dirname(list), { recursive: true, force: true });
  });

  it("passes on a clean tree, fails with the planted term only, and removes the planted file", () => {
    const base = { tarball: undefined, listFile: list, root, mode: "dry-run" as const, env: { ...process.env, BUILDOS_DENY_LIST: undefined } };
    assert.equal(denyListGate({ ...base, plant: undefined }).pass, true);
    const plantFile = join(root, "release-plant-deny-list.txt");
    const planted = denyListGate({ ...base, plant: "deny-list", plantFile });
    assert.equal(planted.pass, false);
    assert.match(planted.problems.join(";"), /deny-list check failed \(exit 1\)/);
    // P8-R1-07: the scanner's redacted location (file and line) is kept, in the result and the job summary; the term never is.
    assert.ok(planted.notes.includes("deny-list: match in release-plant-deny-list.txt:1"), planted.notes.join("\n"));
    assert.ok(summaryLines(planted).includes("  - deny-list: match in release-plant-deny-list.txt:1"));
    assert.equal(JSON.stringify(planted).includes(PLANT_FIXTURES.denyTerm), false);
    assert.equal(existsSync(plantFile), false);
    assert.equal(denyListGate({ ...base, plant: undefined }).pass, true, "the tree is clean again");
  });

  it("no repository file holds the planted term", () => {
    const hits = spawnSync("git", ["grep", "-l", "-F", PLANT_FIXTURES.denyTerm], { cwd: repoRoot, encoding: "utf8" });
    assert.equal(hits.stdout, "");
  });

  it("the invented list passes a clean tree, carries the planted failure, and ignores a real list in the environment", () => {
    const base = { tarball: undefined, listFile: undefined, invented: true, root, mode: "dry-run" as const, plant: undefined, env: { ...process.env, BUILDOS_DENY_LIST: "note" } };
    // "note" would match note.txt; the invented list replaces any list in the environment.
    assert.equal(denyListGate(base).pass, true);
    const planted = denyListGate({ ...base, plant: "deny-list", plantFile: join(root, "release-plant-deny-list.txt") });
    assert.equal(planted.pass, false);
    assert.match(planted.problems.join(";"), /\(invented list\)/);
    assert.deepEqual(denyListLines("deny-list: match in a.txt:3\ndeny-list: checked 2 files\n"), { locations: ["deny-list: match in a.txt:3"], summary: "deny-list: checked 2 files" });
  });

  it("fails closed with no list and, in release mode, with no tarball", () => {
    const noList = denyListGate({ tarball: undefined, listFile: undefined, root, mode: "dry-run", plant: undefined, env: { ...process.env, BUILDOS_DENY_LIST: "" } });
    assert.equal(noList.pass, false);
    assert.equal(denyListGate({ tarball: undefined, listFile: list, root, mode: "release", plant: undefined, env: process.env }).pass, false);
  });
});

describe("provenance gate", () => {
  const url = "git+https://github.com/brucewaynedecoy/build-os.git";
  const oidc = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "x" };
  it("release mode stops before staging for a private repository, a wrong repository URL, or no OIDC", () => {
    const ok = { mode: "release" as const, visibility: "public", repository: "brucewaynedecoy/build-os", repositoryUrl: url, requireOidc: true, env: oidc };
    assert.equal(provenanceGate(ok).pass, true);
    assert.match(provenanceGate({ ...ok, visibility: "private" }).problems.join(";"), /npm provenance needs a public GitHub repository, and this repository is private/);
    assert.match(provenanceGate({ ...ok, repositoryUrl: undefined }).problems.join(";"), /repository\.url is missing/);
    assert.match(provenanceGate({ ...ok, env: {} }).problems.join(";"), /cannot request a GitHub OIDC token/);
  });

  it("a dry run reports the problem as a warning and passes", () => {
    const r = provenanceGate({ mode: "dry-run", visibility: "private", repository: "brucewaynedecoy/build-os", repositoryUrl: url, requireOidc: false, env: {} });
    assert.equal(r.pass, true);
    assert.match(r.notes.join(";"), /^dry run: npm provenance needs a public/);
  });

  it("package.json names the GitHub repository, as npm trusted publishing needs", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { repository: { url: string; directory: string } };
    assert.equal(pkg.repository.url, url);
    assert.equal(pkg.repository.directory, "toolkits/buildos");
  });
});

describe("release build identity (t6)", () => {
  const state = (changes: string[] = []) => ({ head: SHA_B, changes });
  it("reports the commit; refuses a dirty tree unless --allow-dirty, which marks the revision", () => {
    assert.deepEqual(releaseRevision({ state: state() }), { revision: SHA_B, dirty: false });
    assert.throws(() => releaseRevision({ state: state([" M toolkits/buildos/src/cli/main.ts"]) }), /working tree is not clean/);
    assert.deepEqual(releaseRevision({ state: state(["?? x"]), allowDirty: true }), { revision: `${SHA_B}-dirty`, dirty: true });
  });

  it("takes a reviewed revision only when its files equal HEAD's apart from the candidates file", () => {
    assert.deepEqual(releaseRevision({ state: state(), revision: SHA_A, diff: () => ["toolkits/buildos/release-candidates.json"] }), { revision: SHA_A, dirty: false });
    assert.throws(() => releaseRevision({ state: state(), revision: SHA_A, diff: () => ["README.md"] }), /differ from HEAD .* outside/);
    assert.throws(() => releaseRevision({ state: state(), revision: "abc" }), /full 40-character commit SHA/);
  });

  it("a bundle built with a version and revision reports them, and the wrappers accept the version as a pin", async () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-release-version-"));
    try {
      const out = await bundle({ outfile: join(dir, "dist", "buildos.js"), version: "0.1.0", sourceRevision: SHA_A });
      const run = spawnSync(process.execPath, [out, "version", "--json"], { encoding: "utf8" });
      assert.equal(run.status, 0, run.stderr);
      const envelope = JSON.parse(run.stdout) as Record<string, unknown>;
      assert.equal(envelope["version"], "0.1.0");
      assert.equal(envelope["source_revision"], SHA_A);
      // buildos init writes that version as the project pin, and the wrapper helper reads it back.
      const project = join(dir, "project");
      mkdirSync(project);
      const init = spawnSync(process.execPath, [out, "init", "--skip-make-docs"], { cwd: project, encoding: "utf8" });
      assert.equal(init.status, 0, init.stderr);
      const manifest = JSON.parse(readFileSync(join(project, ".os", "manifest.json"), "utf8")) as Record<string, unknown>;
      assert.equal(manifest["buildos_version"], "0.1.0");
      const fromInit = spawnSync(process.execPath, [join(repoRoot, "system", ".os", "scripts", "pinned-version.cjs"), "--sh", join(dir, "self"), join(project, ".os", "manifest.json")], { cwd: dir, env: { ...process.env, PATH: "" }, encoding: "utf8" });
      assert.equal(fromInit.stdout, "0.1.0\n", fromInit.stderr);
      const pin = spawnSync(process.execPath, [join(repoRoot, "system", ".os", "scripts", "pinned-version.cjs"), "--sh", join(dir, "self"), join(dir, "manifest.json")], { cwd: dir, env: { ...process.env, PATH: "" }, encoding: "utf8" });
      assert.notEqual(pin.status, 0, "no manifest yet");
      writeFileSync(join(dir, "manifest.json"), `${JSON.stringify({ schema_version: 1, buildos_version: "0.1.0", initialized_at: "2026-11-24T00:00:00Z" })}\n`);
      const pinned = spawnSync(process.execPath, [join(repoRoot, "system", ".os", "scripts", "pinned-version.cjs"), "--sh", join(dir, "self"), join(dir, "manifest.json")], { cwd: dir, env: { ...process.env, PATH: "" }, encoding: "utf8" });
      assert.equal(pinned.status, 0, pinned.stderr);
      assert.equal(pinned.stdout, "0.1.0\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("reproducible bundle (t2)", () => {
  it("the bundle bytes do not depend on the folder the build starts in, and hold no absolute path of the checkout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-release-cwd-"));
    const start = process.cwd();
    try {
      const a = await bundle({ outfile: join(dir, "a", "buildos.js") });
      process.chdir(tmpdir());
      const b = await bundle({ outfile: join(dir, "b", "buildos.js") });
      process.chdir(start);
      const textA = readFileSync(a, "utf8");
      assert.equal(textA, readFileSync(b, "utf8"));
      assert.equal(textA.includes(packageRoot), false);
      assert.equal(textA.includes(packageRoot.replace(/\\/g, "/")), false);
      assert.deepEqual(readFileSync(join(dir, "a", "system.json")), readFileSync(join(dir, "b", "system.json")));
    } finally {
      process.chdir(start);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the tarball reader lists entries in order with each SHA-256, and the comparison names every kind of difference", () => {
    const tar = Buffer.concat([ustarEntry("package/a.txt", "A"), ustarEntry("package/b.txt", "B", { mode: 0o755 }), TAR_END]);
    const { entries } = readTarball(new Uint8Array(gzipSync(tar)));
    assert.deepEqual(entries.map((e) => [e.path, e.mode.toString(8), e.size]), [["package/a.txt", "644", 1], ["package/b.txt", "755", 1]]);
    const m = (list: typeof entries): PackManifest => ({ tarball_sha256: "", version: "", source_revision: "", node_version: "", npm_version: "", platform: "", gzip_header: "1f8b", entries: list });
    assert.deepEqual(manifestDifferences(m(entries), m(entries)), []);
    const changed = [{ ...entries[1]!, sha256: "x" }, { ...entries[0]!, mode: 0o600 }];
    const diffs = manifestDifferences(m(entries), m(changed));
    assert.ok(diffs.includes("package/b.txt: content differs"), diffs.join("\n"));
    assert.ok(diffs.includes("package/a.txt: mode 644 against 600"));
    assert.ok(diffs.includes("package/a.txt: position 0 against 1"));
  });
});

describe("SBOM (t5)", () => {
  let sbom: Sbom;
  before(() => {
    // Built from npm's own SBOM of the lockfile, through the same steps as generateSbom, offline.
    const run = spawnSync(process.execPath, [join(packageRoot, "scripts", "sbom.ts"), "--tarball", join(packageRoot, "package.json"), "--revision", "HEAD", "--out", join(tmpdir(), `buildos-sbom-${process.pid}.json`)], {
      cwd: packageRoot,
      encoding: "utf8",
      env: { ...process.env, npm_config_offline: "true" },
    });
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    sbom = JSON.parse(readFileSync(join(tmpdir(), `buildos-sbom-${process.pid}.json`), "utf8")) as Sbom;
  });
  after(() => rmSync(join(tmpdir(), `buildos-sbom-${process.pid}.json`), { force: true }));

  it("marks exactly the bundled packages as required and every other lockfile package as excluded", async () => {
    const bundled = await bundledPackages();
    assert.deepEqual([...bundled.keys()].sort(), ["entities", "fflate", "parse5", "unpdf"]);
    for (const c of sbom.components.filter((x) => String(x["purl"]).startsWith("pkg:npm/"))) {
      assert.equal(c["scope"], bundled.has(String(c["name"])) ? "required" : "excluded", String(c["name"]));
    }
  });

  it("lists pdf.js with its six inner components and the ported Go code, and agrees with SECURITY.md and THIRD_PARTY_NOTICES.md", async () => {
    const unpdf = sbom.components.find((c) => c["name"] === "unpdf")!;
    const pdfjs = (unpdf["components"] as Record<string, unknown>[])[0]!;
    assert.equal(pdfjs["name"], "pdf.js");
    assert.deepEqual((pdfjs["components"] as Record<string, unknown>[]).map((c) => c["name"]), PDFJS_INNER.map((c) => c.name));
    assert.deepEqual(await sbomProblems(sbom), []);
  });

  it("finds a gap: a bundled package missing from SECURITY.md, or marked build-time only", async () => {
    const security = readFileSync(join(packageRoot, "SECURITY.md"), "utf8").replace("| `fflate` | 0.8.3 | ", "| `fflate-renamed` | 0.8.3 | ");
    assert.ok((await sbomProblems(sbom, { security })).some((p) => /SECURITY\.md has no Bundled npm Packages row for fflate 0\.8\.3/.test(p)));
    const wrong = structuredClone(sbom);
    const fflate = wrong.components.find((c) => c["name"] === "fflate")!;
    fflate["scope"] = "excluded";
    assert.ok((await sbomProblems(wrong)).some((p) => /fflate: the SBOM says .* but the bundle holds it/.test(p)));
  });

  it("P8-D-08: compares values: a changed SBOM hash, a wrong license or version in either SECURITY.md table, a wrong notice license, or a wrong count", async () => {
    const security = readFileSync(join(packageRoot, "SECURITY.md"), "utf8");
    const notices = readFileSync(join(packageRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
    assert.deepEqual(await sbomProblems(sbom), []);
    const hashChanged = structuredClone(sbom);
    const hashes = hashChanged.components.find((c) => c["name"] === "parse5")!["hashes"] as { content: string }[];
    hashes[0]!.content = `${hashes[0]!.content.slice(0, -1)}${hashes[0]!.content.endsWith("0") ? "1" : "0"}`;
    assert.ok((await sbomProblems(hashChanged)).some((p) => /parse5: the SBOM SHA-512 is not the lockfile integrity value/.test(p)));
    const cases: [string, string, RegExp][] = [
      [security.replace("| `entities` | 9.0.0 | BSD-2-Clause | HTML entity tables", "| `entities` | 9.0.0 | MIT | HTML entity tables"), notices, /Bundled npm Packages gives entities license MIT/],
      [security.replace("| `@esbuild/aix-ppc64` | 0.28.2 | MIT |", "| `@esbuild/aix-ppc64` | 0.28.2 | ISC |"), notices, /Lockfile Inventory gives @esbuild\/aix-ppc64 license ISC/],
      [security.replace("| `@esbuild/aix-ppc64` | 0.28.2 |", "| `@esbuild/aix-ppc64` | 0.28.1 |"), notices, /Lockfile Inventory gives @esbuild\/aix-ppc64 version 0\.28\.1/],
      [security, notices.replace("## npm Package: `entities` 9.0.0\n\n- What ships: HTML entity decoding; a dependency of `parse5`.\n- License: BSD-2-Clause.", "## npm Package: `entities` 9.0.0\n\n- What ships: HTML entity decoding; a dependency of `parse5`.\n- License: MIT."), /THIRD_PARTY_NOTICES\.md gives entities license MIT/],
      [security.replace("any of the 54 lockfile packages", "any of the 53 lockfile packages"), notices, /does not state the lockfile package count 54/],
    ];
    for (const [sec, not, pattern] of cases) {
      assert.notEqual(sec + not, security + notices, `the fixture changed something for ${String(pattern)}`);
      assert.ok((await sbomProblems(sbom, { security: sec, notices: not })).some((p) => pattern.test(p)), String(pattern));
    }
  });

  it("P8-D-08: the packed package.json declares no lifecycle script (consumers do not inherit this repository's .npmrc)", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as Record<string, unknown>;
    assert.deepEqual(packedManifestProblems({ ...pkg, version: "9.8.7" }, { version: "9.8.7" }), []);
    assert.match(packedManifestProblems({ ...pkg, version: "9.8.7", scripts: { ...(pkg["scripts"] as object), postinstall: "x" } }, { version: "9.8.7" }).join(), /lifecycle script/);
  });

  it("has a stable serial number and the commit time, not a clock time", () => {
    assert.match(sbom.serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(stableUuid("x"), stableUuid("x"));
    assert.notEqual(stableUuid("x"), stableUuid("y"));
  });
});

describe("reserved-name placeholder for the first publication (t1, owner decision A)", () => {
  it("is a prerelease with no code: no bin, no scripts, no dependencies, the real repository URL, and a dist-tag that is not latest", () => {
    const pkg = placeholderPackageJson();
    assert.equal(pkg["name"], "build-os");
    assert.equal(pkg["version"], PLACEHOLDER_VERSION);
    assert.match(PLACEHOLDER_VERSION, /^0\.0\.0-reserved\.\d+$/);
    for (const key of ["bin", "scripts", "dependencies", "main", "exports"]) assert.equal(key in pkg, false, key);
    assert.equal((pkg["repository"] as { url: string }).url, "git+https://github.com/brucewaynedecoy/build-os.git");
    assert.notEqual(PLACEHOLDER_DIST_TAG, "latest");
  });

  it("packs to three files: package.json, README.md, LICENSE", () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-placeholder-"));
    try {
      const r = buildPlaceholder(dir);
      assert.deepEqual(r.files, ["package/LICENSE", "package/README.md", "package/package.json"]);
      assert.match(r.sha256, /^[0-9a-f]{64}$/);
      const { files } = readTarball(new Uint8Array(readFileSync(r.tarball)));
      assert.match(files.get("package/README.md")?.toString() ?? "", /only reserves the package name/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("P8-R2-07: refuses a folder that already holds files, so nothing stray is packed or overwritten", () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-placeholder-used-"));
    try {
      writeFileSync(join(dir, "stray.txt"), "left over\n");
      assert.throws(() => buildPlaceholder(dir), /is not empty/);
      assert.deepEqual(readdirSync(dir), ["stray.txt"]);
      // A folder that does not exist yet is created.
      const fresh = join(dir, "new", "out");
      const r = buildPlaceholder(fresh);
      assert.deepEqual(readdirSync(fresh), [basename(r.tarball)]);
      assert.deepEqual(r.files, ["package/LICENSE", "package/README.md", "package/package.json"]);
      // The same folder again holds the tarball, so it is refused, not overwritten.
      assert.throws(() => buildPlaceholder(fresh), /is not empty/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("P8-R2-07: the tarball check refuses an extra file, a missing file, and changed content", () => {
    const want = placeholderFiles();
    assert.deepEqual(placeholderTarballProblems(tarGz(want)), []);
    assert.match(placeholderTarballProblems(tarGz({ ...want, "package/extra.js": Buffer.from("x") })).join(), /not exactly/);
    const { ["package/LICENSE"]: _license, ...withoutLicense } = want;
    assert.match(placeholderTarballProblems(tarGz(withoutLicense)).join(), /not exactly/);
    assert.match(placeholderTarballProblems(tarGz({ ...want, "package/README.md": Buffer.from("changed\n") })).join(), /README\.md does not have the expected SHA-256/);
    assert.match(placeholderTarballProblems(tarGz({ ...want, "package/package.json": Buffer.from('{"name":"x"}') })).join(), /package\.json is not the expected one/);
  });
});
