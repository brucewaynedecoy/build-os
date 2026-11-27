/**
 * The `buildos entities` adapter, ported from the Go seed
 * (`internal/cli/cli.go` `runEntities` and `parseEntityOptions`). It parses
 * the Go flags, requires an explicit `--root` and `--mode`, calls the core
 * command, and prints the envelope exactly as the seed does: JSON on stdout
 * with `--json`; else the human form on stdout, or on stderr for a failure,
 * with the diagnostics before the result.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import {
  consolidateCommand,
  rebuildIndexCommand,
  resolveCommand,
  validateCommand,
  type EntityCommandResult,
  type EntityContext,
  type EntityHooks,
} from "../../core/entities/commands.ts";
import type { Diagnostic } from "../../core/shared/diagnostics.ts";
import { createEnvelope, serializeEnvelope, type Envelope, type WriteStatus } from "../../core/shared/envelope.ts";
import { goMarshalIndent, type GoJsonValue } from "../../core/shared/go-json.ts";
import { runProgram } from "../../core/shared/run-command.ts";
import { formatDiagnosticsHuman } from "../diagnostics.ts";
import type { CommandContext, Domain } from "../domain.ts";
import { EXIT_CODES, exitCodeFor } from "../exit-codes.ts";
import { formatEnvelopeHuman } from "../output.ts";
import { goQuote, parseCommandFlags, wantsJson, type FlagSpec } from "../parse.ts";
import { UsageError } from "../usage-error.ts";

/** Go `entitiesHelp`, byte for byte. */
export const ENTITIES_HELP = `Usage:
  buildos entities resolve --root <path> --mode compat|strict --id <entity-id> [--json]
  buildos entities validate --root <path> --mode compat|strict [--json]
  buildos entities consolidate --root <path> --mode compat|strict --manifest <path> [--apply] [--json]
  buildos entities rebuild-index --root <path> --mode compat|strict [--check|--apply] [--json]

Mutation commands are dry-run/check-only unless --apply is supplied.
Every entity command requires an explicit BuildOS root and validation mode.
`;

const COMMON = { root: "string", mode: "string", json: "boolean" } as const;

/** Go `parseEntityOptions`: the flags each command defines. */
function flagSpec(command: string): FlagSpec {
  switch (command) {
    case "resolve":
      return { ...COMMON, id: "string" };
    case "consolidate":
      return { ...COMMON, manifest: "string", apply: "boolean" };
    case "rebuild-index":
      return { ...COMMON, check: "boolean", apply: "boolean" };
    default:
      return COMMON;
  }
}

interface EntityOptions {
  root: string;
  mode: string;
  id: string;
  manifest: string;
  json: boolean;
  apply: boolean;
  check: boolean;
}

/** Go `parseEntityOptions`. A usage error is JSON when the literal `--json` is among the arguments (Go `containsJSON`). */
function parseOptions(command: string, commandName: string, args: readonly string[]): EntityOptions {
  const json = wantsJson(args);
  const usage = (message: string) => new UsageError(message, { command: commandName, json });
  const { values, positionals } = parseCommandFlags(commandName, flagSpec(command), args, (_partial, raw) => wantsJson(raw));
  const text = (name: string) => {
    const value = (values as Record<string, unknown>)[name];
    return typeof value === "string" ? value : "";
  };
  const flag = (name: string) => (values as Record<string, unknown>)[name] === true;
  const options: EntityOptions = { root: text("root"), mode: text("mode"), id: text("id"), manifest: text("manifest"), json: flag("json"), apply: flag("apply"), check: flag("check") };
  if (positionals.length !== 0) throw usage(`unexpected arguments: ${positionals.join(" ")}`);
  if (options.root === "") throw usage("--root is required");
  if (options.mode !== "compat" && options.mode !== "strict") throw usage("--mode must be compat or strict");
  switch (command) {
    case "resolve":
      if (options.id === "") throw usage("--id is required");
      break;
    case "validate":
      break;
    case "consolidate":
      if (options.manifest === "") throw usage("--manifest is required");
      break;
    case "rebuild-index":
      if (options.check && options.apply) throw usage("--check and --apply are mutually exclusive");
      break;
    default:
      throw usage(`unknown entities command ${goQuote(command)}`);
  }
  return options;
}

/** Go `writeHuman`: the header, each diagnostic, then the result as `json.MarshalIndent` (HTML escaped). */
function formatGoHuman(envelope: Envelope, result: GoJsonValue): string {
  const header = formatEnvelopeHuman({ ...envelope, result: null });
  const body = result === null ? "" : `${goMarshalIndent(result, true)}\n`;
  return `${header}${formatDiagnosticsHuman(envelope.diagnostics)}${body}`;
}

function run(command: string, options: EntityOptions, context: CommandContext, hooks: Partial<EntityHooks> | undefined): EntityCommandResult {
  const entityContext: EntityContext = { cwd: context.io.cwd, openFs: context.openFs, program: runProgram(context.buildInfo.version), ...(hooks === undefined ? {} : { hooks }) };
  switch (command) {
    case "resolve":
      return resolveCommand(entityContext, options.root, options.mode, options.id);
    case "validate":
      return validateCommand(entityContext, options.root, options.mode);
    case "consolidate":
      return consolidateCommand(entityContext, options.root, options.mode, options.manifest, options.apply);
    default:
      return rebuildIndexCommand(entityContext, options.root, options.mode, options.apply);
  }
}

/**
 * The `entities` domain. `hooks` replaces core steps, as the Go seed's tests
 * replace `buildResolutionIndex`, `checkResolutionIndex`,
 * `applyResolutionIndex`, and `canonicalDatasetWriter`; the CLI passes none.
 */
export function createEntitiesDomain(hooks?: Partial<EntityHooks>): Domain {
  return {
    name: "entities",
    summary: "Resolve, validate, consolidate, and index entity records",
    help: ENTITIES_HELP,
    run(args, context) {
      const [command, ...rest] = args;
      if (command === undefined) return { command: "entities", json: false, rendered: { stdout: ENTITIES_HELP, stderr: "", exitCode: EXIT_CODES.ok } };
      const commandName = `entities.${command}`;
      context.setCommand(commandName);
      const options = parseOptions(command, commandName, rest);
      const outcome = run(command, options, context, hooks);

      const failure = outcome.failure;
      const exitCode = failure === undefined ? EXIT_CODES.ok : exitCodeFor(failure);
      let diagnostics: Diagnostic[] = outcome.diagnostics;
      if (failure !== undefined) {
        // Go adds its internal_error diagnostic only when nothing else explains the failure.
        if (!outcome.goFailure) diagnostics = [...diagnostics, ...failure.diagnostics];
        else if (diagnostics.length === 0) diagnostics = failure.diagnostics;
      }
      let writeStatus: WriteStatus = "not_requested";
      if ((command === "consolidate" && !options.apply) || (command === "rebuild-index" && !options.apply && !options.check)) writeStatus = "planned";
      if (options.apply && failure === undefined) writeStatus = "applied";
      if (options.apply && exitCode === EXIT_CODES.canonicalAppliedIndexFailed) writeStatus = "canonical_applied_index_failed";

      const envelope = createEnvelope({
        ok: failure === undefined,
        command: commandName,
        version: context.buildInfo.version,
        sourceRevision: context.buildInfo.sourceRevision,
        root: outcome.root,
        mode: options.mode,
        writeStatus,
        result: outcome.payload,
        diagnostics,
      });
      let stdout = "";
      let stderr = "";
      if (options.json) stdout = serializeEnvelope(envelope);
      else if (failure !== undefined) stderr = formatGoHuman(envelope, outcome.payload);
      else stdout = formatGoHuman(envelope, outcome.payload);
      return { command: commandName, json: options.json, rendered: { stdout, stderr, exitCode } };
    },
  };
}

export const entitiesDomain: Domain = createEntitiesDomain();
