/** The shape every `buildos <domain>` adapter implements. */

import type { BuildInfo } from "../core/shared/build-info.ts";
import type { Diagnostic } from "../core/shared/diagnostics.ts";
import type { WriteStatus } from "../core/shared/envelope.ts";
import type { FsPortFactory } from "../core/shared/fs-port.ts";
import type { ExitCode } from "./exit-codes.ts";
import type { CliIo } from "./io.ts";

export interface CommandContext {
  io: CliIo;
  buildInfo: BuildInfo;
  /** Writes an informational notice to stderr. */
  notice(message: string): void;
  /**
   * Names the envelope command, for example `entities.resolve`, as soon as
   * the domain knows it. A failure envelope uses this name.
   */
  setCommand(command: string): void;
  /**
   * Opens the filesystem port that core uses for every read and write. Core
   * never loads `fs`; a domain passes this factory to core.
   */
  openFs: FsPortFactory;
}

/**
 * A command result. The dispatcher formats it, unless `rendered` holds the
 * exact output, as a domain whose Go seed formats its own output needs
 * (`buildos entities`: success or failure, with the result payload in both).
 */
export interface CommandOutcome {
  /** Exact stdout and stderr text and the exit code (from `exitCodeFor`). The other fields are then ignored. */
  rendered?: { stdout: string; stderr: string; exitCode: ExitCode };
  /** Envelope command name, for example `entities.resolve`. */
  command: string;
  json: boolean;
  root?: string;
  mode?: string;
  writeStatus?: WriteStatus;
  result?: unknown;
  diagnostics?: Diagnostic[];
}

/** The help-facing part of a domain. */
export interface HelpEntry {
  /** The first argument after `buildos`. */
  name: string;
  /** One line for the root help. */
  summary: string;
  /** Full help text for `buildos <domain> --help`, ending in a newline. */
  help: string;
}

export interface Domain extends HelpEntry {
  /**
   * Parses `args`, calls the core, and returns a typed outcome. Throws a
   * `UsageError` or a core error on failure.
   */
  run(args: readonly string[], context: CommandContext): CommandOutcome | Promise<CommandOutcome>;
}
