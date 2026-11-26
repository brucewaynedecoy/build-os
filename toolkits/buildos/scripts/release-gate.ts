// Release gates (W1 R7 P8 t4, A64, A65, A66). Each gate is one subcommand
// that runs the same way on a maintainer machine and in
// .github/workflows/buildos-release.yml. A gate prints one line
// `release gate <name>: pass` or `release gate <name>: FAIL: <reason>` and
// exits 0 or 1. Every gate fails closed: a missing input, a tool error, or an
// output it cannot read is a failure.
//
//   node scripts/release-gate.ts <gate> [--mode release|dry-run] [--plant <gate>] [options]
//
// Gates, in workflow order:
//   identity   --tag <tag> --head <commit> [--candidates <file>] [--prerelease true|false]
//              The committed ledger is read from git at HEAD (a regular blob,
//              mode 100644; P8-R2-08). --candidates names a dry run's self
//              entry file outside the repository; release mode refuses it.
//              The tag is v<package.json version>; the candidates file has an
//              entry for it with the same version (release mode: a `reviewed`
//              entry); HEAD is <commit> (the commit the workflow resolved from
//              the release event); the entry's source commit is an ancestor of
//              HEAD and has the same files apart from the candidates file; and
//              (release mode) Node, npm, and the runner image are the reference
//              ones. Prints source_commit and dist_tag (also to the step output).
//   digest     --tag <tag> --tarball <file> [--candidates <file>]
//              The rebuilt tarball's SHA-256 equals the reviewed one.
//   version    --tarball <file> --expect-revision <commit>
//              The packed bundle reports the package version and that revision (A66).
//   tests      Typecheck, the unit tests, and the golden suites (from the checkout).
//   installed  --tarball <file> --expect-revision <commit>
//              Installs the tarball offline in a scratch folder and runs the
//              golden comparison from its .bin entries, with the release
//              identity expected in place of the goldens' dev identity.
//   eval       The conversion eval gate (test/conversion-eval/eval.test.ts, PRD 07):
//              every eval file of the manifest ran and passed.
//   audit      [--report <npm-audit.json> --exit-code <n>]
//              `npm audit --audit-level=high --include=dev --json`: fails on a
//              high or critical advisory, on an exit status that disagrees with
//              the counts, and on any npm error.
//   osv        --exit-code <n> --results <osv-results.json>
//              The OSV gate (scripts/osv-gate.ts) on an osv-scanner run.
//   deny-list  --tarball <file> (--list-file <file> | --invented-list)
//              The client-name deny-list check (scripts/check-deny-list.mjs)
//              over the repository tree and every file of the tarball. The
//              verify job never holds the real list (P8-R1-02): it runs with
//              --invented-list, which checks home-folder paths and unread files
//              and carries the planted failure. The real list is checked by the
//              release workflow's deny-list job, from trusted code.
//   sbom       --tarball <file> --out <file> --revision <commit>
//              Writes the CycloneDX SBOM (scripts/sbom.ts), validates it against
//              the vendored CycloneDX 1.5 JSON schema, and checks it against the
//              bundle, SECURITY.md, and THIRD_PARTY_NOTICES.md.
//   provenance --visibility <public|private|internal> [--repository <owner/repo>]
//              npm provenance needs a public repository and a package.json
//              repository URL equal to it. In dry-run mode a problem is printed
//              as a warning and the gate passes. The staging job checks it again
//              with the OIDC token request (scripts/release-stage-check.ts).
//
// Dry run and planted failures: `--mode dry-run` (the default) is what a
// person runs; the workflow uses it for every run that is not a published
// GitHub Release. `--plant <gate>` (dry-run only) injects one known failure
// into that gate, through the same code path: `tag` (the tag gets a suffix),
// `version` (the reviewed entry's version gets a suffix), `digest` (the
// reviewed SHA-256 is changed), `eval` (a converter that loses every
// section, test/fixtures/release/planted-converter.ts), `audit` (a saved npm
// audit report with a high advisory), `osv` (a saved osv-scanner report with a
// high finding), `deny-list` (an invented term, added to the list and written
// to a file in the repository tree). A gate ignores a plant meant for another
// gate. In release mode any plant stops the gate (exit 2).

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateGate, isBlocking } from "./osv-gate.ts";
import {
  CANDIDATES_FILE,
  CANDIDATES_REPO_PATH,
  changedFiles,
  distTagFor,
  entryFor,
  extractTarball,
  git,
  isAncestor,
  isFullSha,
  isReleaseTag,
  ledgerEntryProblems,
  loadCandidates,
  loadCandidatesAtCommit,
  npmVersion,
  PACKAGE_ROOT,
  readPackageIdentity,
  REPO_ROOT,
  type ReleaseCandidate,
  runNpm,
  runnerImageOs,
  sha256File,
  tagForVersion,
  treeEntryAt,
  writeGithubOutput,
} from "./release-lib.ts";
import { provenanceCheck } from "./release-stage-check.ts";

export const GATES = ["identity", "digest", "version", "tests", "installed", "eval", "audit", "osv", "deny-list", "sbom", "provenance"] as const;
export type GateName = (typeof GATES)[number];
export const PLANTS = ["tag", "version", "digest", "eval", "audit", "osv", "deny-list"] as const;
export type Plant = (typeof PLANTS)[number];
export type Mode = "release" | "dry-run";

/** Which gate each plant targets. */
export const PLANT_GATE: Record<Plant, GateName> = {
  tag: "identity",
  version: "identity",
  digest: "digest",
  eval: "eval",
  audit: "audit",
  osv: "osv",
  "deny-list": "deny-list",
};

export const PLANT_FIXTURES = {
  converter: join(PACKAGE_ROOT, "test", "fixtures", "release", "planted-converter.ts"),
  audit: join(PACKAGE_ROOT, "test", "fixtures", "release", "npm-audit-high.json"),
  osv: join(PACKAGE_ROOT, "test", "fixtures", "osv", "findings-above-threshold.json"),
  /** An invented term. It names no client. Joined at run time, so no repository file holds it. */
  denyTerm: ["zq", "planted", "deny", "term", "7f3k"].join("-"),
  /** The invented list of the verify job and of dry runs (P8-R1-02). It names no client. */
  inventedTerm: ["zq", "invented", "client", "term", "4h2m"].join("-"),
  denyFile: join(PACKAGE_ROOT, "release-plant-deny-list.txt"),
};

export interface GateResult {
  gate: GateName;
  pass: boolean;
  /** Why it failed; empty when it passed. */
  problems: string[];
  /** Lines worth printing on a pass too (warnings in dry-run mode, redacted deny-list locations). */
  notes: string[];
  outputs?: Record<string, string>;
}

const result = (gate: GateName, problems: string[], notes: string[] = [], outputs?: Record<string, string>): GateResult => ({
  gate,
  pass: problems.length === 0,
  problems,
  notes,
  ...(outputs === undefined ? {} : { outputs }),
});

// ---------------------------------------------------------------- identity

export interface IdentityInput {
  tag: string;
  packageVersion: string;
  candidates: ReleaseCandidate[];
  head: string;
  /** The commit the workflow resolved from the release event; HEAD must be it. Undefined: not asked (a local dry run). */
  expectHead?: string | undefined;
  /** Files that differ between two commits. */
  diff: (from: string, to: string) => string[];
  /** True when the first commit is the second or one of its ancestors. */
  ancestor: (ancestor: string, descendant: string) => boolean;
  mode: Mode;
  plant?: Plant | undefined;
  prerelease?: boolean | undefined;
  env: { node: string; npm: string; imageOs: string };
  /** The ledger's tree entry at HEAD; see sourceCommitProblems. */
  ledgerAtHead?: (() => { mode: string; type: string } | undefined) | undefined;
}

/** The release runner image label, as GitHub's `ImageOS` names it. */
export function imageOsOfLabel(label: string): string {
  const match = /^ubuntu-(\d+)\.04$/.exec(label);
  return match === null ? label : `ubuntu${match[1]}`;
}

/**
 * The only files that may differ between the reviewed source commit and the
 * tag commit: the ledger. Anything else changes what ships, so the reviewed
 * digest would not describe it.
 */
export function sourceCommitProblems(input: {
  sourceCommit: string;
  head: string;
  diff: IdentityInput["diff"];
  ancestor: IdentityInput["ancestor"];
  /** The ledger's tree entry at HEAD (P8-R2-08). When given, it must be a regular blob with mode 100644. */
  ledgerAtHead?: (() => { mode: string; type: string } | undefined) | undefined;
}): string[] {
  if (!isFullSha(input.sourceCommit)) return [`the reviewed source commit "${input.sourceCommit}" is not a full commit SHA`];
  try {
    if (input.ledgerAtHead !== undefined) {
      const entry = input.ledgerAtHead();
      // The exemption below covers a change of the ledger's bytes only, never a change of its kind (a link, an executable).
      if (entry !== undefined) {
        const problems = ledgerEntryProblems(entry, input.head);
        if (problems.length > 0) return problems;
      }
    }
    if (!input.ancestor(input.sourceCommit, input.head)) return [`the reviewed source commit ${input.sourceCommit} is not an ancestor of ${input.head}`];
    const other = input.diff(input.sourceCommit, input.head).filter((p) => p !== CANDIDATES_REPO_PATH);
    if (other.length > 0) return [`the files at the reviewed commit ${input.sourceCommit} differ from ${input.head} outside ${CANDIDATES_REPO_PATH}: ${other.slice(0, 5).join(", ")}`];
  } catch (error) {
    return [`the reviewed commit ${input.sourceCommit} cannot be compared with ${input.head}: ${(error as Error).message.split("\n")[0]}`];
  }
  return [];
}

export function identityGate(input: IdentityInput): GateResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const tag = input.plant === "tag" ? `${input.tag}-planted` : input.tag;
  const version = input.packageVersion;
  if (!isReleaseTag(tag)) problems.push(`the tag "${tag}" is not v followed by an exact semver version`);
  if (tag !== tagForVersion(version)) problems.push(`the tag ${tag} and the package.json version ${version} disagree (expected tag ${tagForVersion(version)})`);
  if (input.expectHead !== undefined && input.expectHead !== input.head) problems.push(`the checkout is ${input.head}, not the resolved release commit ${input.expectHead}`);
  const found = entryFor(input.candidates, tag, input.mode);
  if (found.entry === undefined) {
    problems.push(found.problem ?? `no entry for ${tag}`);
    return result("identity", problems, notes);
  }
  let entry = found.entry;
  if (input.plant === "version") entry = { ...entry, version: `${entry.version}-planted` };
  if (entry.version !== version) problems.push(`the reviewed entry for ${tag} has version ${entry.version}, but package.json has ${version}`);
  if (input.prerelease !== undefined && input.prerelease !== version.includes("-")) {
    problems.push(`the GitHub Release prerelease flag (${input.prerelease}) disagrees with the version ${version}`);
  }
  problems.push(...sourceCommitProblems({ sourceCommit: entry.source_commit, head: input.head, diff: input.diff, ancestor: input.ancestor, ledgerAtHead: input.ledgerAtHead }));
  const envProblems: string[] = [];
  if (input.env.node !== entry.node_version) envProblems.push(`this Node is ${input.env.node}, the reviewed build used ${entry.node_version}`);
  if (input.env.npm !== entry.npm_version) envProblems.push(`this npm is ${input.env.npm}, the reviewed build used ${entry.npm_version}`);
  if (input.env.imageOs !== imageOsOfLabel(entry.runner_image)) envProblems.push(`this runner image is ${input.env.imageOs}, the reviewed build used ${entry.runner_image}`);
  if (input.mode === "release") problems.push(...envProblems);
  else notes.push(...envProblems.map((p) => `dry run: ${p}; a release would stop here`));
  if (entry.kind === "self") notes.push("dry run: the entry is a self entry made by this dry run; it is not a review");
  return result("identity", problems, notes, { source_commit: entry.source_commit, dist_tag: distTagFor(version) });
}

// ---------------------------------------------------------------- digest

export function digestGate(input: { tag: string; candidates: ReleaseCandidate[]; actualSha256: string; mode?: Mode; plant?: Plant | undefined }): GateResult {
  const found = entryFor(input.candidates, input.tag, input.mode ?? "dry-run");
  if (found.entry === undefined) return result("digest", [found.problem ?? `no entry for ${input.tag}`]);
  let expected = found.entry.tarball_sha256;
  if (input.plant === "digest") expected = `${expected.slice(0, -1)}${expected.endsWith("0") ? "1" : "0"}`;
  if (input.actualSha256 !== expected) {
    return result("digest", [`the rebuilt tarball SHA-256 ${input.actualSha256} is not the reviewed ${expected}: the package differs from what was reviewed`]);
  }
  return result("digest", [], [`tarball SHA-256 ${input.actualSha256}`], { tarball_sha256: input.actualSha256 });
}

// ---------------------------------------------------------------- version (A66)

export function versionGate(input: { reported: string; packageVersion: string; expectRevision: string }): GateResult {
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(input.reported) as Record<string, unknown>;
  } catch {
    return result("version", ["buildos version --json did not print JSON"]);
  }
  const problems: string[] = [];
  if (envelope["version"] !== input.packageVersion) problems.push(`buildos version reports ${String(envelope["version"])}, not ${input.packageVersion}`);
  if (envelope["source_revision"] !== input.expectRevision) problems.push(`buildos version reports source revision ${String(envelope["source_revision"])}, not ${input.expectRevision}`);
  return result("version", problems, [`buildos version: ${String(envelope["version"])} at ${String(envelope["source_revision"])}`]);
}

// ---------------------------------------------------------------- tests and the installed golden comparison

/** The pass and fail counts of a `node --test --test-reporter=tap` run, or undefined when it printed no summary. */
export function tapCounts(stdout: string): { pass: number; fail: number } | undefined {
  const pass = /^# pass (\d+)$/m.exec(stdout);
  const fail = /^# fail (\d+)$/m.exec(stdout);
  if (pass === null || fail === null) return undefined;
  return { pass: Number(pass[1]), fail: Number(fail[1]) };
}

/** Judges one `node --test` run: exit 0, a summary, at least one passing test, no failures. */
export function testRunProblems(label: string, run: { status: number | null; stdout: string; error?: Error | undefined }): string[] {
  if (run.error !== undefined) return [`${label} could not run: ${run.error.message}`];
  const counts = tapCounts(run.stdout);
  if (counts === undefined) return [`${label} printed no test summary (exit ${String(run.status)})`];
  if (run.status !== 0 || counts.fail > 0) return [`${label} failed (exit ${String(run.status)}, ${counts.pass} passed, ${counts.fail} failed)`];
  if (counts.pass === 0) return [`${label} ran no test`];
  return [];
}

function runNodeTests(files: string[], env: NodeJS.ProcessEnv): { status: number | null; stdout: string; error?: Error | undefined } {
  // A gate started inside `node --test` must not report to that runner: without
  // NODE_TEST_CONTEXT the child prints its own TAP summary.
  const childEnv = { ...env };
  delete childEnv["NODE_TEST_CONTEXT"];
  const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { cwd: PACKAGE_ROOT, encoding: "utf8", env: childEnv, maxBuffer: 256 * 1024 * 1024 });
  return { status: run.status, stdout: run.stdout ?? "", error: run.error };
}

// ---------------------------------------------------------------- eval

/** Judges the eval run: the TAP summary and the eval report, which must name every manifest file once, all passing. */
export function evalGate(input: { run: { status: number | null; stdout: string; error?: Error | undefined }; reportText: string | undefined; manifestIds: string[]; planted: boolean }): GateResult {
  const suffix = input.planted ? " with the planted converter" : "";
  const problems = testRunProblems("the conversion eval gate", input.run).map((p) => `${p}${suffix}`);
  let ids: string[] = [];
  let failed: string[] = [];
  if (input.reportText === undefined) problems.push(`the conversion eval gate wrote no report${suffix}`);
  else {
    try {
      const report = JSON.parse(input.reportText) as { results?: { id?: unknown; pass?: unknown }[] };
      ids = (report.results ?? []).map((r) => String(r.id));
      failed = (report.results ?? []).filter((r) => r.pass !== true).map((r) => String(r.id));
    } catch {
      problems.push("the conversion eval report is not JSON");
    }
    const want = [...input.manifestIds].sort();
    if (input.manifestIds.length === 0) problems.push("the conversion eval manifest lists no file");
    if (JSON.stringify([...ids].sort()) !== JSON.stringify(want)) problems.push(`the conversion eval ran ${ids.length} of the ${want.length} manifest files`);
    if (failed.length > 0) problems.push(`eval files below the gate: ${failed.join(", ")}${suffix}`);
  }
  return result("eval", problems, [`conversion eval gate: ${ids.length} of ${input.manifestIds.length} files ran, ${ids.length - failed.length} passed`]);
}

// ---------------------------------------------------------------- audit

/**
 * Judges one `npm audit --audit-level=high --include=dev --json` run. With
 * that threshold npm exits 0 when no advisory is high or critical and 1 when
 * one is; any other exit status, or an exit status that disagrees with the
 * counts, is a failure. A report it cannot read is a failure.
 */
export function auditGate(input: { reportText: string; exitCode: number | null }): GateResult {
  let report: Record<string, unknown>;
  try {
    report = JSON.parse(input.reportText) as Record<string, unknown>;
  } catch {
    return result("audit", [`npm audit printed no JSON report (exit ${String(input.exitCode)})`]);
  }
  if (report["error"] !== undefined) {
    const error = report["error"] as Record<string, unknown>;
    return result("audit", [`npm audit failed: ${String(error["code"] ?? "")} ${String(error["summary"] ?? "")}`.trim()]);
  }
  const counts = (report["metadata"] as Record<string, unknown> | undefined)?.["vulnerabilities"] as Record<string, unknown> | undefined;
  const levels = ["info", "low", "moderate", "high", "critical"];
  if (report["auditReportVersion"] !== 2 || counts === undefined || !levels.every((l) => Number.isInteger(counts[l]))) {
    return result("audit", ["the npm audit report does not have the version 2 shape (auditReportVersion 2 with metadata.vulnerabilities counts)"]);
  }
  const high = (counts["high"] as number) + (counts["critical"] as number);
  if (input.exitCode !== 0 && input.exitCode !== 1) return result("audit", [`npm audit exited ${String(input.exitCode)}`]);
  if (high > 0) return result("audit", [`npm audit reports ${String(counts["high"])} high and ${String(counts["critical"])} critical advisories`]);
  if (input.exitCode === 1) return result("audit", ["npm audit exited 1 with no high or critical advisory: the run did not finish as the report says"]);
  return result("audit", [], [`npm audit: ${levels.map((l) => `${l} ${String(counts[l])}`).join(", ")}`]);
}

export const AUDIT_ARGS = ["audit", "--audit-level=high", "--include=dev", "--json"] as const;

// ---------------------------------------------------------------- osv

export function osvGate(input: { exitCode: number | undefined; resultsText: string | undefined }): GateResult {
  const decision = evaluateGate({ scannerExitCode: input.exitCode, outputText: input.resultsText });
  const blocking = decision.blocking.map((f) => `${f.package}@${f.version} ${f.ids.join(",")} severity ${f.maxSeverity || "none"}`);
  const problems = decision.pass ? [] : [...decision.problems, ...blocking.map((b) => `blocking finding: ${b}`)];
  const below = decision.findings.filter((f) => !isBlocking(f)).length;
  return result("osv", problems, [`osv-scanner exit ${String(input.exitCode)}, ${decision.findings.length} finding(s), ${below} below high`]);
}

// ---------------------------------------------------------------- provenance

export function provenanceGate(input: Parameters<typeof provenanceCheck>[0]): GateResult {
  const r = provenanceCheck(input);
  return result("provenance", r.problems, r.notes);
}

// ---------------------------------------------------------------- runners

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

function required(argv: string[], name: string): string {
  const value = option(argv, name);
  if (value === undefined) throw new Error(`${name} is required`);
  return value;
}

/** Runs one gate from its command-line options. */
export async function runGate(gate: GateName, argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<GateResult> {
  const mode = (option(argv, "--mode") ?? "dry-run") as Mode;
  if (mode !== "release" && mode !== "dry-run") throw new Error(`--mode must be release or dry-run, not ${String(mode)}`);
  const plantText = option(argv, "--plant");
  if (plantText !== undefined && plantText !== "none" && !(PLANTS as readonly string[]).includes(plantText)) throw new Error(`--plant must be one of ${PLANTS.join(", ")}, or none`);
  const anyPlant = plantText === undefined || plantText === "none" ? undefined : (plantText as Plant);
  if (anyPlant !== undefined && mode === "release") throw new PlantInReleaseError();
  const plant = anyPlant !== undefined && PLANT_GATE[anyPlant] === gate ? anyPlant : undefined;
  const pkg = readPackageIdentity();
  const candidatesOption = option(argv, "--candidates");
  const candidatesFile = candidatesOption === undefined ? undefined : resolve(candidatesOption);
  // P8-R2-08: the committed ledger is read by commit and path from git (a regular blob with mode 100644 at HEAD),
  // never from the working tree. Only a dry run may pass a file: a self entry, outside the repository.
  if (mode === "release" && candidatesFile !== undefined) throw new Error("release mode reads the committed ledger from git at HEAD; --candidates is for a dry run's self entry only");
  const loadLedger = () =>
    candidatesFile === undefined || candidatesFile === CANDIDATES_FILE
      ? loadCandidatesAtCommit(REPO_ROOT, git(["rev-parse", "HEAD"])).candidates
      : loadCandidates(candidatesFile, { committed: false }).candidates;

  switch (gate) {
    case "identity": {
      const prerelease = option(argv, "--prerelease");
      return identityGate({
        tag: required(argv, "--tag"),
        packageVersion: pkg.version,
        candidates: loadLedger(),
        head: git(["rev-parse", "HEAD"]),
        expectHead: mode === "release" ? required(argv, "--head") : option(argv, "--head"),
        diff: (from, to) => changedFiles(from, to),
        ancestor: (a, d) => isAncestor(a, d),
        mode,
        plant,
        prerelease: prerelease === undefined ? undefined : prerelease === "true",
        env: { node: process.version, npm: npmVersion(), imageOs: runnerImageOs(env) },
        ledgerAtHead: () => treeEntryAt(REPO_ROOT, git(["rev-parse", "HEAD"]), CANDIDATES_REPO_PATH),
      });
    }
    case "digest":
      return digestGate({ tag: required(argv, "--tag"), candidates: loadLedger(), actualSha256: sha256File(required(argv, "--tarball")), mode, plant });
    case "version": {
      const scratch = mkdtempSync(join(tmpdir(), "buildos-gate-version-"));
      try {
        const packageDir = extractTarball(required(argv, "--tarball"), scratch);
        const run = spawnSync(process.execPath, [join(packageDir, "dist", "buildos.js"), "version", "--json"], { encoding: "utf8" });
        if (run.status !== 0) return result("version", [`buildos version exited ${String(run.status)}: ${run.stderr.trim()}`]);
        return versionGate({ reported: run.stdout, packageVersion: pkg.version, expectRevision: required(argv, "--expect-revision") });
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
    case "tests": {
      const typecheck = runNpm(["run", "typecheck"], { cwd: PACKAGE_ROOT, env });
      if (typecheck.status !== 0) return result("tests", [`the typecheck failed (exit ${String(typecheck.status)}): ${`${typecheck.stdout}${typecheck.stderr}`.trim().split("\n").slice(-5).join(" | ")}`]);
      const unit = runNodeTests(["test/*.test.ts"], env);
      const golden = runNodeTests(["test/golden/*.test.ts"], env);
      const problems = [...testRunProblems("the unit tests", unit), ...testRunProblems("the golden suites", golden)];
      const u = tapCounts(unit.stdout);
      const g = tapCounts(golden.stdout);
      return result("tests", problems, [`typecheck passed; unit tests ${u?.pass ?? 0} passed, ${u?.fail ?? 0} failed; golden suites ${g?.pass ?? 0} passed, ${g?.fail ?? 0} failed`]);
    }
    case "installed":
      return installedGate({ tarball: required(argv, "--tarball"), version: pkg.version, revision: required(argv, "--expect-revision"), env });
    case "eval": {
      const scratch = mkdtempSync(join(tmpdir(), "buildos-gate-eval-"));
      try {
        const report = join(scratch, "eval-report.json");
        const evalEnv: NodeJS.ProcessEnv = { ...env, BUILDOS_EVAL_REPORT: report };
        if (plant === "eval") evalEnv["BUILDOS_EVAL_CONVERTER"] = PLANT_FIXTURES.converter;
        else delete evalEnv["BUILDOS_EVAL_CONVERTER"];
        delete evalEnv["BUILDOS_EVAL_FORMATS"];
        const run = runNodeTests([join("test", "conversion-eval", "eval.test.ts")], evalEnv);
        const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, "test", "conversion-eval", "manifest.json"), "utf8")) as { files: { id: string }[] };
        return evalGate({ run, reportText: existsSync(report) ? readFileSync(report, "utf8") : undefined, manifestIds: manifest.files.map((f) => f.id), planted: plant === "eval" });
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
    case "audit": {
      if (plant === "audit") return auditGate({ reportText: readFileSync(PLANT_FIXTURES.audit, "utf8"), exitCode: 1 });
      const saved = option(argv, "--report");
      if (saved !== undefined) {
        const code = option(argv, "--exit-code");
        return auditGate({ reportText: readFileSync(saved, "utf8"), exitCode: code === undefined ? null : Number(code) });
      }
      let run;
      try {
        run = runNpm([...AUDIT_ARGS], { cwd: PACKAGE_ROOT, env });
      } catch (error) {
        return result("audit", [`npm audit could not run: ${(error as Error).message}`]);
      }
      return auditGate({ reportText: run.stdout, exitCode: run.status });
    }
    case "osv": {
      if (plant === "osv") return osvGate({ exitCode: 1, resultsText: readFileSync(PLANT_FIXTURES.osv, "utf8") });
      const code = option(argv, "--exit-code");
      let text: string | undefined;
      try {
        text = readFileSync(required(argv, "--results"), "utf8");
      } catch {
        text = undefined;
      }
      return osvGate({ exitCode: code === undefined || !/^\d+$/.test(code) ? undefined : Number(code), resultsText: text });
    }
    case "deny-list":
      return denyListGate({
        tarball: option(argv, "--tarball"),
        listFile: option(argv, "--list-file"),
        invented: argv.includes("--invented-list"),
        root: resolve(option(argv, "--root") ?? REPO_ROOT),
        mode,
        plant,
        env,
      });
    case "sbom": {
      // Loaded here, not at the top: sbom.ts needs esbuild, and the other gates must run without it.
      const { generateSbom, sbomProblems } = await import("./sbom.ts");
      const tarball = required(argv, "--tarball");
      const sbom = await generateSbom({ tarballSha256: sha256File(tarball), revision: required(argv, "--revision") });
      writeFileSync(required(argv, "--out"), `${JSON.stringify(sbom, null, 2)}\n`);
      const problems = await sbomProblems(sbom);
      return result("sbom", problems, [`SBOM: ${sbom.components.length} components, valid against the CycloneDX ${sbom.specVersion} schema, written to ${required(argv, "--out")}`]);
    }
    case "provenance":
      return provenanceGate({
        mode,
        visibility: option(argv, "--visibility"),
        repository: option(argv, "--repository") ?? env["GITHUB_REPOSITORY"],
        repositoryUrl: pkg.repositoryUrl,
        requireOidc: false,
        env,
      });
  }
}

export class PlantInReleaseError extends Error {
  constructor() {
    super("a planted failure is only allowed in dry-run mode");
  }
}

/**
 * The installed golden comparison (P8-R1 release-stamped goldens): installs
 * the tarball offline into a scratch prefix and cache, then runs
 * test/golden/compare.test.ts from that install's .bin entries with the
 * release identity expected where a golden holds the development identity.
 */
export function installedGate(input: { tarball: string; version: string; revision: string; env: NodeJS.ProcessEnv }): GateResult {
  const scratch = mkdtempSync(join(tmpdir(), "buildos-gate-installed-"));
  try {
    const npmEnv = { ...input.env, npm_config_cache: join(scratch, "cache"), npm_config_update_notifier: "false" };
    const install = runNpm(["install", "--offline", "--ignore-scripts", "--no-save", "--no-audit", "--no-fund", "--prefix", join(scratch, "installed"), resolve(input.tarball)], { cwd: scratch, env: npmEnv });
    if (install.status !== 0) return result("installed", [`npm install of the tarball failed (exit ${String(install.status)}): ${install.stderr.trim().split("\n").slice(-3).join(" | ")}`]);
    const run = runNodeTests([join("test", "golden", "compare.test.ts")], {
      ...input.env,
      BUILDOS_GOLDEN_BIN_DIR: join(scratch, "installed", "node_modules", ".bin"),
      BUILDOS_GOLDEN_EXPECT_VERSION: input.version,
      BUILDOS_GOLDEN_EXPECT_REVISION: input.revision,
    });
    const counts = tapCounts(run.stdout);
    return result("installed", testRunProblems("the installed golden comparison", run), [`installed golden comparison (expects ${input.version} at ${input.revision}): ${counts?.pass ?? 0} passed, ${counts?.fail ?? 0} failed`]);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The redacted lines of the deny-list scanner worth keeping: each location (file tag and line, never a term) and the summary. */
export function denyListLines(output: string): { locations: string[]; summary: string } {
  const lines = output.split("\n").filter((l) => l.startsWith("deny-list: "));
  const summary = lines.filter((l) => l.startsWith("deny-list: checked ")).slice(-1)[0] ?? lines.slice(-1)[0] ?? "";
  const locations = lines.filter((l) => l !== summary);
  return { locations, summary };
}

/**
 * The deny-list gate: scripts/check-deny-list.mjs over the repository tree
 * and, with a tarball, every file of that tarball (read from the tarball as
 * data; npm never runs in it). The list is never printed or written, except
 * the invented terms. The scanner prints redacted locations only (a match
 * label and line, never the term); the gate keeps every one of them.
 */
export function denyListGate(input: {
  tarball: string | undefined;
  listFile: string | undefined;
  invented?: boolean;
  root: string;
  mode: Mode;
  plant: Plant | undefined;
  env: NodeJS.ProcessEnv;
  /** Where the planted file goes (tests); default: the package folder. */
  plantFile?: string;
}): GateResult {
  const plantFile = input.plantFile ?? PLANT_FIXTURES.denyFile;
  if (input.mode === "release" && input.tarball === undefined) return result("deny-list", ["release mode needs --tarball, so the shipped files are read"]);
  const scratch = mkdtempSync(join(tmpdir(), "buildos-gate-deny-"));
  const env: NodeJS.ProcessEnv = { ...input.env };
  // The verify job never holds the real list; a stray one in the environment is not used.
  if (input.invented === true) delete env["BUILDOS_DENY_LIST"];
  const args = [join(PACKAGE_ROOT, "scripts", "check-deny-list.mjs"), "--root", input.root];
  const planted = input.plant === "deny-list";
  try {
    if (input.tarball !== undefined) args.push("--tarball", resolve(input.tarball));
    let list = input.listFile;
    if (input.invented === true) {
      list = join(scratch, "invented-list.txt");
      writeFileSync(list, `${PLANT_FIXTURES.inventedTerm}\n`);
    }
    if (list !== undefined) {
      if (planted) {
        const combined = join(scratch, "list.txt");
        writeFileSync(combined, `${readFileSync(list, "utf8")}\n${PLANT_FIXTURES.denyTerm}\n`);
        args.push("--list-file", combined);
      } else args.push("--list-file", list);
    } else if (planted) {
      env["BUILDOS_DENY_LIST"] = `${env["BUILDOS_DENY_LIST"] ?? ""}\n${PLANT_FIXTURES.denyTerm}`;
    }
    if (planted) writeFileSync(plantFile, `Planted for the release gate dry run: ${PLANT_FIXTURES.denyTerm}\n`);
    const run = spawnSync(process.execPath, args, { cwd: PACKAGE_ROOT, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
    const { locations, summary } = denyListLines(`${run.stdout ?? ""}${run.stderr ?? ""}`);
    const listKind = input.invented === true ? " (invented list)" : "";
    return run.status === 0
      ? result("deny-list", [], [`${summary}${listKind}`])
      : result("deny-list", [`the client-name deny-list check failed (exit ${String(run.status)})${listKind}: ${summary}`], locations);
  } finally {
    if (planted) rmSync(plantFile, { force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function formatResult(r: GateResult): string {
  const lines = r.notes.map((n) => `  ${n}`);
  if (r.pass) return [`release gate ${r.gate}: pass`, ...lines].join("\n");
  return [`release gate ${r.gate}: FAIL: ${r.problems.join("; ")}`, ...lines].join("\n");
}

/** The job summary lines of one gate: the result, then each redacted location of a failure. */
export function summaryLines(r: GateResult): string[] {
  const head = `- release gate \`${r.gate}\`: ${r.pass ? "pass" : `FAIL: ${r.problems.join("; ")}`}`;
  return r.pass ? [head] : [head, ...r.notes.map((n) => `  - ${n}`)];
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [gate, ...argv] = process.argv.slice(2);
  if (gate === undefined || !(GATES as readonly string[]).includes(gate)) {
    process.stderr.write(`usage: node scripts/release-gate.ts <${GATES.join("|")}> [options] (see the header of this file)\n`);
    process.exit(2);
  }
  try {
    const r = await runGate(gate as GateName, argv);
    process.stdout.write(`${formatResult(r)}\n`);
    for (const note of r.notes) if (note.startsWith("dry run:")) process.stdout.write(`::warning title=Release gate ${r.gate}::${note}\n`);
    if (r.outputs !== undefined && r.pass) {
      for (const [k, v] of Object.entries(r.outputs)) process.stdout.write(`${k}=${v}\n`);
      writeGithubOutput(r.outputs);
    }
    const summary = process.env["GITHUB_STEP_SUMMARY"];
    if (summary !== undefined && summary !== "") appendFileSync(summary, `${summaryLines(r).join("\n")}\n`);
    process.exitCode = r.pass ? 0 : 1;
  } catch (error) {
    process.stdout.write(`release gate ${gate}: FAIL: ${(error as Error).message}\n`);
    process.exitCode = error instanceof PlantInReleaseError ? 2 : 1;
  }
}
