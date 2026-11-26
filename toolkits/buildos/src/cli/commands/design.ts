/**
 * The `buildos design` adapter, ported from the Go tool
 * `toolkits/buildos-design/cmd/buildos-design/main.go`:
 * `buildos design promote finding --finding-id <id> --route
 * baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root
 * <path>] [--dry-run]`. It parses the flags with Go `flag` rules, calls the
 * core, and prints what the Go tool prints. See `go-tool.ts` for `--json` and
 * `--allow-outside-root`;
 * a dry run reports `write_status` `planned` there.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { formatPromoteOutput, promoteFinding, type DesignContext, type PromoteHooks } from "../../core/design/promote.ts";
import { goQuote } from "../../core/shared/go-quote.ts";
import type { CommandOutcome, Domain } from "../domain.ts";
import { EXIT_CODES } from "../exit-codes.ts";
import { goParseFlags, type GoFlagDef } from "../go-flagset.ts";
import { applyExtras, envelopeRoot, fail, GO_TOOL_EXTRAS, succeed, usageFailure, type GoToolRun } from "./go-tool.ts";

/** Go `printUsage`, byte for byte. */
export const DESIGN_USAGE = `Usage:
  buildos-design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]
`;

const TOOL = "buildos-design";

/** Go `runPromoteFinding` flags. */
const PROMOTE_FLAGS: GoFlagDef[] = [
  { name: "repo-root", kind: "string", usage: "repository root", default: "." },
  { name: "finding-id", kind: "string", usage: "qualified finding ID" },
  { name: "route", kind: "string", usage: "design follow-on route: baseline-plan or change-plan" },
  { name: "title", kind: "string", usage: "design title" },
  { name: "slug", kind: "string", usage: "design slug; lowercase letters, numbers, and hyphens" },
  { name: "dry-run", kind: "bool", usage: "print planned design hand-off without writing" },
];

/** Test seams: the clock and the write steps Go's tests replace. */
export interface DesignDomainOptions {
  now?: () => Date;
  hooks?: Partial<PromoteHooks>;
}

function coreContext(run: GoToolRun, options: DesignDomainOptions): DesignContext {
  const { context } = run;
  return {
    cwd: context.io.cwd,
    openFs: context.openFs,
    ...(run.allowOutsideRoot === true ? { allowOutsideRoot: true } : {}),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.hooks === undefined ? {} : { hooks: options.hooks }),
  };
}

function runPromoteFinding(args: readonly string[], run: GoToolRun, options: DesignDomainOptions): CommandOutcome {
  let root: string | undefined;
  try {
    const flags = goParseFlags("promote finding", PROMOTE_FLAGS, args, { extras: GO_TOOL_EXTRAS });
    applyExtras(run, flags.extras);
    root = flags.strings.get("repo-root")!;
    const result = promoteFinding(coreContext(run, options), {
      repoRoot: root,
      findingId: flags.strings.get("finding-id")!,
      route: flags.strings.get("route")!,
      title: flags.strings.get("title")!,
      slug: flags.strings.get("slug")!,
      dryRun: flags.bools.get("dry-run")!,
    });
    return succeed(run, formatPromoteOutput(result), result.repoRoot, result.dryRun, {
      finding_id: result.findingId,
      requested_finding_id: result.requestedFindingId,
      canonical_finding_id: result.canonicalFindingId,
      redirect_chain: result.redirectChain ?? [],
      design_path: result.designPath,
      finding_path: result.findingPath,
      findings_index_path: result.findingsIndexPath,
      design_content: result.designContent,
      dry_run: result.dryRun,
    });
  } catch (error) {
    return fail(run, error, envelopeRoot(root, run.context));
  }
}

export function createDesignDomain(options: DesignDomainOptions = {}): Domain {
  return {
    name: "design",
    summary: "Promote a qualified finding into a design file",
    help: DESIGN_USAGE,
    run(rawArgs, context) {
      const [first, second, ...rest] = rawArgs;
      const base = { tool: TOOL, json: false, context };
      if (first === undefined) return usageFailure({ ...base, command: "design" }, "missing command", DESIGN_USAGE);
      switch (first) {
        case "promote": {
          const run: GoToolRun = { ...base, command: "design.promote" };
          context.setCommand(run.command);
          if (second !== "finding") return usageFailure(run, "promote requires subcommand finding");
          return runPromoteFinding(rest, run, options);
        }
        case "help":
        case "-h":
        case "--help":
          return { command: "design", json: false, rendered: { stdout: DESIGN_USAGE, stderr: "", exitCode: EXIT_CODES.ok } };
        default:
          return usageFailure({ ...base, command: "design" }, `unknown command ${goQuote(first)}`, DESIGN_USAGE);
      }
    },
  };
}

export const designDomain: Domain = createDesignDomain();
