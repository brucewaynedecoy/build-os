/**
 * The CLI dispatcher. It picks the domain, calls the domain adapter, and alone
 * turns outcomes and errors into stdout, stderr, and an exit code.
 */

import type { BuildInfo } from "../core/shared/build-info.ts";
import type { Diagnostic } from "../core/shared/diagnostics.ts";
import { createEnvelope, serializeEnvelope, type Envelope, type WriteStatus } from "../core/shared/envelope.ts";
import { isCoreError } from "../core/shared/errors.ts";
import type { FsPortFactory } from "../core/shared/fs-port.ts";
import { createNodeFsPort } from "../adapters/node-fs.ts";
import { rootAsGiven } from "../core/shared/root.ts";
import { currentBuildInfo } from "./build-info.ts";
import { designDomain } from "./commands/design.ts";
import { discoveryDomain } from "./commands/discovery.ts";
import { entitiesDomain } from "./commands/entities.ts";
import { exportDomain } from "./commands/export.ts";
import { extractDomain } from "./commands/extract.ts";
import { fitgapDomain } from "./commands/fitgap.ts";
import { initDomain } from "./commands/init.ts";
import { intakeDomain } from "./commands/intake.ts";
import { validateDomain } from "./commands/validate.ts";
import { versionDomain } from "./commands/version.ts";
import { formatDiagnosticsHuman, writeNotice } from "./diagnostics.ts";
import type { CommandContext, CommandOutcome, Domain, HelpEntry } from "./domain.ts";
import { EXIT_CODES, exitCodeFor, type ExitCode } from "./exit-codes.ts";
import { HELP_ENTRY, rootHelp } from "./help.ts";
import type { CliIo } from "./io.ts";
import { formatEnvelopeHuman, formatFailureHuman } from "./output.ts";
import { goQuote, wantsJson } from "./parse.ts";
import { UsageError } from "./usage-error.ts";
import { printedRun, runCommand } from "../core/shared/run-command.ts";

const HELP_FLAGS = new Set(["help", "--help", "-h"]);

/** Domains shipped in the CLI. Later phases register more here. */
export const BUILTIN_DOMAINS: readonly Domain[] = [
  entitiesDomain,
  intakeDomain,
  discoveryDomain,
  designDomain,
  initDomain,
  validateDomain,
  extractDomain,
  fitgapDomain,
  exportDomain,
  versionDomain,
];

export interface RunOptions {
  /** Domains to register. Defaults to `BUILTIN_DOMAINS`. */
  domains?: readonly Domain[];
  buildInfo?: BuildInfo;
  /** Opens the core filesystem port. Defaults to the `node:fs` adapter. */
  openFs?: FsPortFactory;
  /** The clock for written time stamps (W1 R7 P9). Defaults to the system clock. */
  now?: () => Date;
}

/** Runs one BuildOS command and returns its exit code. Never throws. */
export async function run(argv: readonly string[], io: CliIo, options: RunOptions = {}): Promise<ExitCode> {
  const buildInfo = options.buildInfo ?? currentBuildInfo();
  const domains = options.domains ?? BUILTIN_DOMAINS;
  const state: DispatchState = { command: argv[0] ?? "buildos", root: "" };
  const factory = options.openFs ?? createNodeFsPort;
  // Records the root as the Go seed spells it before the port touches the
  // disk, so a failure envelope names it even when opening the root fails.
  const openFs: FsPortFactory = (root, cwd, options) => {
    if (typeof root === "string" && root !== "" && !root.includes("\0")) state.root = rootAsGiven(root, cwd ?? io.cwd);
    return factory(root, cwd, options);
  };
  try {
    return await dispatch(argv, io, buildInfo, domains, state, openFs, options.now);
  } catch (error) {
    return reportFailure(error, io, buildInfo, wantsJson(argv), state);
  }
}

interface DispatchState {
  command: string;
  /** The root as given, folded as the Go seed spells it; `""` until a domain opens a root. */
  root: string;
}

async function dispatch(
  argv: readonly string[],
  io: CliIo,
  buildInfo: BuildInfo,
  domains: readonly Domain[],
  state: DispatchState,
  openFs: FsPortFactory,
  now?: () => Date,
): Promise<ExitCode> {
  const [first, ...rest] = argv;
  if (first === undefined || HELP_FLAGS.has(first)) {
    return runHelp(rest, io, [HELP_ENTRY, ...domains], buildInfo.version);
  }
  const domain = domains.find((candidate) => candidate.name === first);
  if (domain === undefined) {
    // The Go seed never writes this error as JSON.
    throw new UsageError(`unknown command ${goQuote(first)}`, { command: "buildos", json: false });
  }
  if (rest[0] !== undefined && HELP_FLAGS.has(rest[0])) {
    io.writeStdout(domain.helpFor?.(buildInfo.version) ?? domain.help);
    return EXIT_CODES.ok;
  }
  const context: CommandContext = {
    io,
    buildInfo,
    notice: (message) => writeNotice(io, message),
    setCommand: (command) => {
      state.command = command;
    },
    openFs,
    ...(now === undefined ? {} : { now }),
  };
  const outcome = await domain.run(rest, context);
  if (outcome.rendered !== undefined) {
    if (outcome.rendered.stdout !== "") io.writeStdout(outcome.rendered.stdout);
    if (outcome.rendered.stderr !== "") io.writeStderr(outcome.rendered.stderr);
    return outcome.rendered.exitCode;
  }
  writeOutcome(outcome, io, buildInfo);
  return EXIT_CODES.ok;
}

/**
 * `buildos help [<domain>]`. Like the Go seed, help never fails: any argument
 * that is not a registered domain prints the root help with exit 0, and
 * arguments after the domain are ignored. Printing a domain's help for
 * `help <domain>` differs from the seed; see the parity exceptions.
 */
function runHelp(args: readonly string[], io: CliIo, entries: readonly HelpEntry[], version: string): ExitCode {
  const [target] = args;
  const entry = target === undefined ? undefined : entries.find((candidate) => candidate.name === target);
  io.writeStdout(entry === undefined ? rootHelp(entries) : (entry.helpFor?.(version) ?? entry.help));
  return EXIT_CODES.ok;
}

function writeOutcome(outcome: CommandOutcome, io: CliIo, buildInfo: BuildInfo): void {
  const envelope = createEnvelope({
    ok: true,
    command: outcome.command,
    version: buildInfo.version,
    sourceRevision: buildInfo.sourceRevision,
    root: outcome.root,
    mode: outcome.mode,
    writeStatus: outcome.writeStatus,
    result: outcome.result,
    diagnostics: outcome.diagnostics,
  });
  if (outcome.json) {
    io.writeStdout(serializeEnvelope(envelope));
    return;
  }
  io.writeStdout(formatEnvelopeHuman(envelope));
  if (envelope.diagnostics.length > 0) {
    io.writeStderr(formatDiagnosticsHuman(envelope.diagnostics));
  }
}

function reportFailure(error: unknown, io: CliIo, buildInfo: BuildInfo, json: boolean, state: DispatchState): ExitCode {
  const code = exitCodeFor(error);
  const { command } = state;
  if (error instanceof UsageError) {
    const diagnostic: Diagnostic = {
      code: "usage_error",
      severity: "error",
      message: error.message,
      correction: `Run ${runCommand(printedRun(buildInfo.version, process.platform), ["help"])} for command syntax.`,
    };
    writeFailure(failureEnvelope(buildInfo, error.command, "", "not_requested", [diagnostic]), io, error.json);
    return code;
  }
  if (isCoreError(error)) {
    writeFailure(failureEnvelope(buildInfo, command, error.root ?? state.root, error.writeStatus, error.diagnostics), io, json);
    return code;
  }
  // Unexpected failure: one short stderr line and no stack trace.
  const message = firstLine(error);
  io.writeStderr(`buildos: internal error: ${message}\n`);
  if (json) {
    const diagnostic: Diagnostic = {
      code: "internal_error",
      severity: "error",
      message,
      correction: "Report this BuildOS failure with the command you ran.",
    };
    io.writeStdout(serializeEnvelope(failureEnvelope(buildInfo, command, state.root, "not_requested", [diagnostic])));
  }
  return code;
}

function failureEnvelope(
  buildInfo: BuildInfo,
  command: string,
  root: string,
  writeStatus: WriteStatus,
  diagnostics: Diagnostic[],
): Envelope {
  return createEnvelope({
    ok: false,
    command,
    version: buildInfo.version,
    sourceRevision: buildInfo.sourceRevision,
    root,
    writeStatus,
    diagnostics,
  });
}

function writeFailure(envelope: Envelope, io: CliIo, json: boolean): void {
  if (json) {
    io.writeStdout(serializeEnvelope(envelope));
  } else {
    io.writeStderr(formatFailureHuman(envelope));
  }
}

function firstLine(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const line = (text.split(/\r?\n/, 1)[0] ?? "").trim();
  return line === "" ? "unexpected failure" : line;
}
