// Local release dry run (W1 R7 P8 t4, A64, A65; review round 1, P8-R1-08).
// Runs the release gates of the workflow's verify job, in its order, and
// stops at the first failure. It never stages or publishes: a dry run has no
// staging step at all.
//
//   node scripts/release-dry-run.ts [--plant <gate>] [--allow-dirty]
//       [--tag <tag> --candidates <file>]      (both or neither; default: self)
//       [--list-file <file>]                   (else BUILDOS_DENY_LIST, else an invented list)
//       [--osv-results <file> --osv-exit <n>]  (both or neither; else runs osv-scanner from PATH)
//       [--visibility <public|private>]        (default: unknown)
//
// Identity comes first, before any build:
// - `self` (no --tag and --candidates): build A at HEAD makes a temporary
//   `self` entry (outside the repository; never a review). Build B, a second
//   independent build of HEAD from an empty dist/, must give the same bytes:
//   the agreement case of A64.
// - committed (--tag and --candidates): the dry run reads the entry of the
//   tag first, checks that its source commit is an ancestor of HEAD and that
//   the two commits differ in toolkits/buildos/release-candidates.json only,
//   and then builds with the entry's source commit as the reported
//   revision. So the usual release commit (only the ledger changed on top of
//   the reviewed commit) verifies.
//
// Gates after the build: digest, version, tests (typecheck, unit, golden),
// installed (the golden comparison from the installed tarball, expecting the
// release identity), eval, audit, osv, deny-list, sbom (with the CycloneDX
// schema), provenance. Prints one line per gate (pass, FAIL, or not run) and
// exits 1 when a gate fails, 2 on a usage error. `npm audit` and osv-scanner
// need the network.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { releaseBuild, type ReleaseBuild } from "./release-build.ts";
import { selfCandidate } from "./release-candidate.ts";
import { formatResult, type GateName, type GateResult, identityGate, PLANTS, runGate, sourceCommitProblems } from "./release-gate.ts";
import {
  CANDIDATES_FILE,
  changedFiles,
  entryFor,
  git,
  isAncestor,
  LEDGER_SCHEMA_VERSION,
  loadCandidates,
  loadCandidatesAtCommit,
  npmVersion,
  REPO_ROOT,
  readPackageIdentity,
  runnerImageOs,
  tagForVersion,
} from "./release-lib.ts";

export class UsageError extends Error {}

export interface DryRunArgs {
  plant: string;
  allowDirty: boolean;
  tag?: string;
  candidates?: string;
  listFile?: string;
  osvResults?: string;
  osvExit?: string;
  visibility: string;
}

const VALUE_OPTIONS = ["--plant", "--tag", "--candidates", "--list-file", "--osv-results", "--osv-exit", "--visibility"];

/** Parses the options. Throws a UsageError for an unknown option, a missing value, or an incomplete pair. */
export function parseDryRunArgs(argv: string[]): DryRunArgs {
  const values = new Map<string, string>();
  let allowDirty = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--allow-dirty") {
      allowDirty = true;
      continue;
    }
    if (!VALUE_OPTIONS.includes(arg)) throw new UsageError(`unknown argument ${arg.startsWith("--") ? arg : "(not an option)"}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new UsageError(`${arg} needs a value`);
    if (values.has(arg)) throw new UsageError(`${arg} is given twice`);
    values.set(arg, value);
    i++;
  }
  const plant = values.get("--plant") ?? "none";
  if (plant !== "none" && !(PLANTS as readonly string[]).includes(plant)) throw new UsageError(`--plant must be one of ${PLANTS.join(", ")}, or none`);
  if (values.has("--tag") !== values.has("--candidates")) throw new UsageError("--tag and --candidates go together: give both to check a ledger, or neither for a self entry");
  if (values.has("--osv-results") !== values.has("--osv-exit")) throw new UsageError("--osv-results and --osv-exit go together");
  const out: DryRunArgs = { plant, allowDirty, visibility: values.get("--visibility") ?? "unknown" };
  for (const [flag, key] of [["--tag", "tag"], ["--candidates", "candidates"], ["--list-file", "listFile"], ["--osv-results", "osvResults"], ["--osv-exit", "osvExit"]] as const) {
    const v = values.get(flag);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/** The committed ledger is read from git at HEAD (P8-R2-08); any other file is a dry-run ledger outside the repository. */
function readLedger(file: string, head: string) {
  return file === CANDIDATES_FILE ? loadCandidatesAtCommit(REPO_ROOT, head).candidates : loadCandidates(file, { committed: false }).candidates;
}

export type Identity = { kind: "self" } | { kind: "committed"; tag: string; candidates: string; sourceCommit: string };

/**
 * Reads the identity before any build. For a ledger: the tag's entry, its
 * source commit an ancestor of HEAD, and only the ledger different between
 * them. Returns the problems instead of throwing, so the dry run reports them
 * as the identity gate.
 */
export function readIdentity(args: DryRunArgs, deps: { head: string; diff: (a: string, b: string) => string[]; ancestor: (a: string, b: string) => boolean }): { identity?: Identity; problems: string[] } {
  if (args.tag === undefined || args.candidates === undefined) return { identity: { kind: "self" }, problems: [] };
  const file = resolve(args.candidates);
  let candidates;
  try {
    candidates = readLedger(file, deps.head);
  } catch (error) {
    return { problems: [(error as Error).message] };
  }
  const { entry, problem } = entryFor(candidates, args.tag, "dry-run");
  if (entry === undefined) return { problems: [problem ?? `no entry for ${args.tag}`] };
  const problems = sourceCommitProblems({ sourceCommit: entry.source_commit, head: deps.head, diff: deps.diff, ancestor: deps.ancestor });
  if (problems.length > 0) return { problems };
  return { identity: { kind: "committed", tag: args.tag, candidates: file, sourceCommit: entry.source_commit }, problems: [] };
}

async function main(argv: string[]): Promise<number> {
  let args: DryRunArgs;
  try {
    args = parseDryRunArgs(argv);
  } catch (error) {
    process.stderr.write(`release-dry-run: ${(error as Error).message}\nusage: node scripts/release-dry-run.ts [--plant <gate>] [--allow-dirty] [--tag <tag> --candidates <file>] [--list-file <file>] [--osv-results <file> --osv-exit <n>] [--visibility <public|private>]\n`);
    return 2;
  }
  const scratch = mkdtempSync(join(tmpdir(), "buildos-dry-run-"));
  const common = ["--mode", "dry-run", "--plant", args.plant];
  const head = git(["rev-parse", "HEAD"]);
  const say = (line: string) => process.stdout.write(`${line}\n`);

  // 1. Identity, before any build.
  const read = readIdentity(args, { head, diff: (a, b) => changedFiles(a, b), ancestor: (a, b) => isAncestor(a, b) });
  if (read.identity === undefined) {
    say(formatResult({ gate: "identity", pass: false, problems: read.problems, notes: [] }));
    say("release dry run: stopped before any build; a dry run never stages or publishes");
    return 1;
  }
  const identity = read.identity;

  // 2. Builds. Self: build A makes the entry, build B is checked against it. Committed: one build at the reviewed source commit.
  let tag: string;
  let candidates: string;
  let build: ReleaseBuild;
  let identityResult: GateResult | undefined;
  if (identity.kind === "self") {
    say(`release dry run: build A at HEAD ${head} (plant: ${args.plant})`);
    const a = await releaseBuild({ out: join(scratch, "build-a"), allowDirty: args.allowDirty });
    tag = tagForVersion(a.version);
    candidates = join(scratch, "release-candidates.json");
    writeFileSync(candidates, `${JSON.stringify({ schema_version: LEDGER_SCHEMA_VERSION, candidates: [selfCandidate(a, head, runnerImageOs())] }, null, 2)}\n`);
    say(`release dry run: a self entry for ${tag} from build A (SHA-256 ${a.tarball_sha256}), in ${candidates}; it is not a review`);
    say("release dry run: build B, an independent second build of HEAD");
    build = await releaseBuild({ out: join(scratch, "build-b"), allowDirty: args.allowDirty });
  } else {
    tag = identity.tag;
    candidates = identity.candidates;
    // The identity gate runs before the build here, so a wrong tag or version stops the dry run first.
    identityResult = identityGate({
      tag,
      packageVersion: readPackageIdentity().version,
      candidates: readLedger(candidates, head),
      head,
      diff: (a, b) => changedFiles(a, b),
      ancestor: (a, b) => isAncestor(a, b),
      mode: "dry-run",
      plant: args.plant === "tag" || args.plant === "version" ? args.plant : undefined,
      env: { node: process.version, npm: npmVersion(), imageOs: runnerImageOs() },
    });
    say(formatResult(identityResult));
    if (!identityResult.pass) {
      say("release dry run: stopped before any build; a dry run never stages or publishes");
      return 1;
    }
    say(`release dry run: building with the reviewed source commit ${identity.sourceCommit} as the revision`);
    build = await releaseBuild({ out: join(scratch, "build"), revision: identity.sourceCommit, allowDirty: args.allowDirty });
  }
  say(`release dry run: ${build.tarball} SHA-256 ${build.tarball_sha256}, version ${build.version}, revision ${build.source_revision}`);

  // 3. The osv-scanner run (or a saved one).
  let osvExit = args.osvExit;
  let osvResults = args.osvResults;
  if (osvResults === undefined && args.plant !== "osv") {
    osvResults = join(scratch, "osv-results.json");
    const scan = spawnSync("osv-scanner", ["scan", "source", `--lockfile=${resolve("package-lock.json")}`, "--format=json", `--output-file=${osvResults}`], { encoding: "utf8" });
    osvExit = scan.error === undefined ? String(scan.status) : "missing";
  }

  const denyArgs = args.listFile !== undefined ? ["--list-file", args.listFile] : (process.env["BUILDOS_DENY_LIST"] ?? "") !== "" ? [] : ["--invented-list"];
  const gateArgs: Record<GateName, string[]> = {
    identity: ["--tag", tag, "--candidates", candidates, "--head", head],
    digest: ["--tag", tag, "--candidates", candidates, "--tarball", build.tarball],
    version: ["--tarball", build.tarball, "--expect-revision", build.source_revision],
    tests: [],
    installed: ["--tarball", build.tarball, "--expect-revision", build.source_revision],
    eval: [],
    audit: [],
    osv: ["--exit-code", osvExit ?? "missing", "--results", osvResults ?? join(scratch, "none.json")],
    "deny-list": ["--tarball", build.tarball, ...denyArgs],
    sbom: ["--tarball", build.tarball, "--revision", build.source_revision, "--out", join(scratch, "sbom.cdx.json")],
    provenance: ["--visibility", args.visibility, "--repository", "brucewaynedecoy/build-os"],
  };
  const order: GateName[] = identityResult === undefined ? ["identity"] : [];
  order.push("digest", "version", "tests", "installed", "eval", "audit", "osv", "deny-list", "sbom", "provenance");

  let failed = false;
  for (const gate of order) {
    if (failed) {
      say(`release gate ${gate}: not run (an earlier gate failed)`);
      continue;
    }
    let r: GateResult;
    try {
      r = await runGate(gate, [...gateArgs[gate], ...common]);
    } catch (error) {
      r = { gate, pass: false, problems: [(error as Error).message], notes: [] };
    }
    say(formatResult(r));
    if (!r.pass) failed = true;
  }
  say(`release dry run: ${failed ? "stopped before staging" : "every gate passed"}; a dry run never stages or publishes`);
  say(`release dry run: files in ${scratch}`);
  return failed ? 1 : 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
