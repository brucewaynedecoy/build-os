/**
 * The `buildos discovery` adapter, ported from the Go tool
 * `toolkits/buildos-discovery/cmd/buildos-discovery/main.go`. It takes the
 * same subcommands and flags (`run discovery`, `qualify finding`), parses
 * them with Go `flag` rules, calls the core, and prints what the Go tool
 * prints. See `go-tool.ts` for `--json` and `--allow-outside-root`.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import {
  formatQualifyOutput,
  formatRunOutput,
  qualifyFinding,
  recordDiscoveryRun,
  type DiscoveryContext,
} from "../../core/discovery/discovery.ts";
import { goQuote } from "../../core/shared/go-quote.ts";
import type { CommandOutcome, Domain } from "../domain.ts";
import { EXIT_CODES } from "../exit-codes.ts";
import { goParseFlags, type GoFlagDef } from "../go-flagset.ts";
import { applyExtras, envelopeRoot, fail, GO_TOOL_EXTRAS, succeed, usageFailure, type GoToolRun } from "./go-tool.ts";

/** Go `printUsage`, byte for byte. */
export const DISCOVERY_USAGE = `Usage:
  buildos-discovery run discovery --playbook-id <PB-NNN> --outcome positive|negative|inconclusive [--title <text>] [--target <ID>] [--dataset-ref <path>] [--evidence <path>] [--raw-finding <path>] [--repo-root <path>] [--dry-run]
  buildos-discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome positive|negative [--title <text>] --confirmation-test <path> --confirmation-evidence <path> [--repo-root <path>] [--dry-run]
`;

const TOOL = "buildos-discovery";

/** Go `runDiscovery` flags. */
const RUN_FLAGS: GoFlagDef[] = [
  { name: "repo-root", kind: "string", usage: "repository root", default: "." },
  { name: "playbook-id", kind: "string", usage: "active discovery playbook ID" },
  { name: "outcome", kind: "string", usage: "run outcome: positive, negative, inconclusive" },
  { name: "title", kind: "string", usage: "run title" },
  { name: "target", kind: "list", usage: "entity target addressed by the run; may be repeated" },
  { name: "dataset-ref", kind: "list", usage: "dataset reference used by the run; may be repeated" },
  { name: "evidence", kind: "list", usage: "evidence file to copy into the run; may be repeated" },
  { name: "raw-finding", kind: "list", usage: "raw finding text/markdown file; may be repeated" },
  { name: "dry-run", kind: "bool", usage: "print planned run without writing" },
];

/** Go `runQualifyFinding` flags. */
const QUALIFY_FLAGS: GoFlagDef[] = [
  { name: "repo-root", kind: "string", usage: "repository root", default: "." },
  { name: "run-id", kind: "string", usage: "origin run ID" },
  { name: "raw-finding-ref", kind: "string", usage: "raw finding reference under the origin run" },
  { name: "outcome", kind: "string", usage: "finding outcome: positive or negative" },
  { name: "title", kind: "string", usage: "finding title" },
  { name: "confirmation-test", kind: "string", usage: "deterministic Playwright confirmation test file" },
  { name: "confirmation-evidence", kind: "string", usage: "confirmation evidence file" },
  { name: "dry-run", kind: "bool", usage: "print planned finding without writing" },
];

/** Test seams: the clock and the core context. */
export interface DiscoveryDomainOptions {
  now?: () => Date;
}

function coreContext(run: GoToolRun, options: DiscoveryDomainOptions): DiscoveryContext {
  const { context } = run;
  return {
    cwd: context.io.cwd,
    openFs: context.openFs,
    ...(run.allowOutsideRoot === true ? { allowOutsideRoot: true } : {}),
    ...(options.now === undefined ? {} : { now: options.now }),
  };
}

function runDiscovery(args: readonly string[], run: GoToolRun, options: DiscoveryDomainOptions): CommandOutcome {
  let root: string | undefined;
  try {
    const flags = goParseFlags("run discovery", RUN_FLAGS, args, { extras: GO_TOOL_EXTRAS });
    applyExtras(run, flags.extras);
    root = flags.strings.get("repo-root")!;
    const result = recordDiscoveryRun(coreContext(run, options), {
      repoRoot: root,
      playbookId: flags.strings.get("playbook-id")!,
      outcome: flags.strings.get("outcome")!,
      title: flags.strings.get("title")!,
      targets: flags.lists.get("target")!,
      datasetRefs: flags.lists.get("dataset-ref")!,
      evidencePaths: flags.lists.get("evidence")!,
      rawFindingPaths: flags.lists.get("raw-finding")!,
      dryRun: flags.bools.get("dry-run")!,
    });
    return succeed(run, formatRunOutput(result), result.repoRoot, result.dryRun, {
      run_id: result.runId,
      run_path: result.runPath,
      runs_index_path: result.runsIndexPath,
      requested_targets: result.requestedTargets,
      canonical_targets: result.canonicalTargets,
      target_resolutions: result.targetResolutions,
      evidence_count: result.evidenceCount,
      raw_finding_count: result.rawFindingCount,
      dry_run: result.dryRun,
    });
  } catch (error) {
    return fail(run, error, envelopeRoot(root, run.context));
  }
}

function runQualifyFinding(args: readonly string[], run: GoToolRun, options: DiscoveryDomainOptions): CommandOutcome {
  let root: string | undefined;
  try {
    const flags = goParseFlags("qualify finding", QUALIFY_FLAGS, args, { extras: GO_TOOL_EXTRAS });
    applyExtras(run, flags.extras);
    root = flags.strings.get("repo-root")!;
    const result = qualifyFinding(coreContext(run, options), {
      repoRoot: root,
      runId: flags.strings.get("run-id")!,
      rawFindingRef: flags.strings.get("raw-finding-ref")!,
      outcome: flags.strings.get("outcome")!,
      title: flags.strings.get("title")!,
      confirmationTest: flags.strings.get("confirmation-test")!,
      confirmationEvidence: flags.strings.get("confirmation-evidence")!,
      dryRun: flags.bools.get("dry-run")!,
    });
    return succeed(run, formatQualifyOutput(result), result.repoRoot, result.dryRun, {
      finding_id: result.findingId,
      finding_path: result.findingPath,
      findings_index_path: result.findingsIndexPath,
      requested_run_id: result.requestedRunId,
      canonical_run_id: result.canonicalRunId,
      run_resolution: result.runResolution,
      dry_run: result.dryRun,
    });
  } catch (error) {
    return fail(run, error, envelopeRoot(root, run.context));
  }
}

export function createDiscoveryDomain(options: DiscoveryDomainOptions = {}): Domain {
  return {
    name: "discovery",
    summary: "Run discovery, anchor raw findings, and qualify findings",
    help: DISCOVERY_USAGE,
    run(rawArgs, context) {
      const [first, second, ...rest] = rawArgs;
      const base = { tool: TOOL, json: false, context };
      if (first === undefined) return usageFailure({ ...base, command: "discovery" }, "missing command", DISCOVERY_USAGE);
      switch (first) {
        case "run": {
          const run: GoToolRun = { ...base, command: "discovery.run" };
          context.setCommand(run.command);
          if (second !== "discovery") return usageFailure(run, "run requires subcommand discovery");
          return runDiscovery(rest, run, options);
        }
        case "qualify": {
          const run: GoToolRun = { ...base, command: "discovery.qualify" };
          context.setCommand(run.command);
          if (second !== "finding") return usageFailure(run, "qualify requires subcommand finding");
          return runQualifyFinding(rest, run, options);
        }
        case "help":
        case "-h":
        case "--help":
          return { command: "discovery", json: false, rendered: { stdout: DISCOVERY_USAGE, stderr: "", exitCode: EXIT_CODES.ok } };
        default:
          return usageFailure({ ...base, command: "discovery" }, `unknown command ${goQuote(first)}`, DISCOVERY_USAGE);
      }
    },
  };
}

export const discoveryDomain: Domain = createDiscoveryDomain();
