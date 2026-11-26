// W1 R7 P8 pin-first review round 2 (orchestrator decision of 2026-11-25):
// the program that runs checks itself. On every launch (a local install, a
// `buildos` on PATH, or npx), the project wrapper sets BUILDOS_REQUIRE_VERSION
// to the version pinned in .os/manifest.json. main.ts calls
// `takeVersionRequirement` first, before any command code, output, or file
// access. When the variable is set, not empty, and not exactly this
// program's own build identity (the version `buildos version` reports: a
// release version or `dev`), the program stops: nothing on stdout, one plain
// message on stderr, exit code 3 (PRD 20: a required input, the pinned
// version, cannot be loaded). With `--json` on the command line the refusal
// is the JSON failure envelope on stdout instead, as for any other failure.
// There is no fallback after a refusal.
//
// The check ends the wrapper's part: the variable is removed from this
// program's environment, so a program that BuildOS starts (Make Docs, a
// nested tool) never inherits it. When the wrapper turned npm bin links on
// for npx, the caller's own npm bin-links settings come back here too, before
// any child process starts.
//
// An unset or empty variable means no check: a direct `buildos` run is
// unchanged.

import type { BuildInfo } from "../core/shared/build-info.ts";
import type { Diagnostic } from "../core/shared/diagnostics.ts";
import { createEnvelope, serializeEnvelope } from "../core/shared/envelope.ts";
import { EXIT_CODES, type ExitCode } from "./exit-codes.ts";
import { wantsJson } from "./parse.ts";

/** The variable the project wrappers set to the pinned version. */
export const REQUIRE_VERSION = "BUILDOS_REQUIRE_VERSION";

/** Set to `1` by a project wrapper that turned npm bin links on for npx. */
export const NPM_BIN_LINKS_OVERRIDE = "BUILDOS_NPM_BIN_LINKS_OVERRIDE";

/** The prefix of the variables that keep the caller's own npm bin-links settings while npx runs. */
export const SAVED_PREFIX = "BUILDOS_SAVED_";

/** The npm config names for bin links, in any case, with `_` or `-`. */
const BIN_LINKS_NAME = /^npm_config_bin[-_]links$/i;

/**
 * Reads and removes the wrapper's variables from `env`. Returns the
 * required version, or `undefined` when there is none (unset or empty).
 * When the wrapper turned npm bin links on, removes its value and puts back
 * the caller's own settings.
 */
export function takeVersionRequirement(env: NodeJS.ProcessEnv): string | undefined {
  const required = env[REQUIRE_VERSION];
  delete env[REQUIRE_VERSION];
  const override = env[NPM_BIN_LINKS_OVERRIDE] === "1";
  delete env[NPM_BIN_LINKS_OVERRIDE];
  const saved: [string, string][] = [];
  for (const key of Object.keys(env)) {
    if (!key.startsWith(SAVED_PREFIX) || !BIN_LINKS_NAME.test(key.slice(SAVED_PREFIX.length))) continue;
    const value = env[key];
    delete env[key];
    if (value !== undefined) saved.push([key.slice(SAVED_PREFIX.length), value]);
  }
  // Only a wrapper that turned bin links on changes them back: a saved value
  // with no override mark is a leftover, and the caller's own value stays.
  if (override) {
    for (const key of Object.keys(env)) {
      if (BIN_LINKS_NAME.test(key)) delete env[key];
    }
    for (const [name, value] of saved) env[name] = value;
  }
  return required === undefined || required === "" ? undefined : required;
}

/** A version as the message shows it: as it is when it is plain, else quoted. */
function shown(version: string): string {
  return /^[0-9A-Za-z.+-]{1,256}$/.test(version) ? version : JSON.stringify(version.slice(0, 256));
}

/** The refusal message, without its line feed. */
export function refusalMessage(required: string, actual: string): string {
  return `BuildOS stopped: this project needs BuildOS ${shown(required)}, but BuildOS ${shown(actual)} started. Nothing ran.`;
}

/**
 * The development-build recovery (pin-first final check, finding 7): a
 * project-local install of a release runs before a linked development build
 * on PATH.
 */
const DEV_RECOVERY =
  " For a development build: in the project folder, replace the local install with the built development package (npm install <path to toolkits/buildos>). Or remove the local install (npm uninstall @brucewaynedecoy/buildos), so that the linked build on PATH runs.";

/** The two fixes, without a line feed. For a `dev` pin, also the development-build recovery. */
export function refusalCorrection(required: string): string {
  return `Fix the BuildOS install so that version ${shown(required)} runs, then run the project wrapper (.os/scripts/buildos) again. Or set buildos_version in .os/manifest.json to the version that you want to use.${required === "dev" ? DEV_RECOVERY : ""}`;
}

export interface Refusal {
  stdout: string;
  stderr: string;
  exitCode: ExitCode;
}

/**
 * The refusal for `args` (the `buildos` arguments, legacy names already
 * mapped) when `required` is not this program's identity; else `undefined`.
 */
export function versionRefusal(required: string | undefined, buildInfo: BuildInfo, args: readonly string[]): Refusal | undefined {
  if (required === undefined || required === buildInfo.version) return undefined;
  const message = refusalMessage(required, buildInfo.version);
  const correction = refusalCorrection(required);
  if (wantsJson(args)) {
    const diagnostic: Diagnostic = { code: "version_mismatch", severity: "error", message, correction };
    const envelope = createEnvelope({
      ok: false,
      command: args[0] ?? "buildos",
      version: buildInfo.version,
      sourceRevision: buildInfo.sourceRevision,
      writeStatus: "not_requested",
      diagnostics: [diagnostic],
    });
    return { stdout: serializeEnvelope(envelope), stderr: "", exitCode: EXIT_CODES.input };
  }
  return { stdout: "", stderr: `${message}\n${correction}\n`, exitCode: EXIT_CODES.input };
}

// W1 R7 P8 pin-first final check, finding 3: a project can hold its own
// older node (node_modules/.bin/node), and npx can start BuildOS with it. So
// BuildOS checks its own Node.js version first, before the version check and
// before the command modules load. This module and the modules it imports
// use no syntax or API that an older Node.js cannot run before this check.

/** The lowest Node.js major version: package.json "engines" (">=24.0.0"). */
export const MINIMUM_NODE_MAJOR = 24;

/** The refusal message, without its line feed. */
export function nodeRefusalMessage(found: string): string {
  return `BuildOS stopped: BuildOS needs Node.js ${MINIMUM_NODE_MAJOR} or newer, but Node.js ${shown(found)} started it. Nothing ran.`;
}

const NODE_CORRECTION = `Install Node.js ${MINIMUM_NODE_MAJOR} or newer from https://nodejs.org. If the project holds an older node (node_modules/.bin/node), remove it or replace it with Node.js ${MINIMUM_NODE_MAJOR} or newer. Then try again.`;

/**
 * The refusal for `args` when `nodeVersion` (`process.versions.node`)
 * is below MINIMUM_NODE_MAJOR; else `undefined`. Exit code 3, as for the
 * version check: a required input, a Node.js that BuildOS supports, is
 * missing. Nothing on stdout; with `--json`, the failure envelope.
 */
export function nodeRefusal(nodeVersion: string, buildInfo: BuildInfo, args: readonly string[]): Refusal | undefined {
  const major = Number(nodeVersion.split(".")[0]);
  if (major >= MINIMUM_NODE_MAJOR) return undefined;
  const message = nodeRefusalMessage(nodeVersion);
  if (wantsJson(args)) {
    const diagnostic: Diagnostic = { code: "node_version", severity: "error", message, correction: NODE_CORRECTION };
    const envelope = createEnvelope({
      ok: false,
      command: args[0] ?? "buildos",
      version: buildInfo.version,
      sourceRevision: buildInfo.sourceRevision,
      writeStatus: "not_requested",
      diagnostics: [diagnostic],
    });
    return { stdout: serializeEnvelope(envelope), stderr: "", exitCode: EXIT_CODES.input };
  }
  return { stdout: "", stderr: `${message}\n${NODE_CORRECTION}\n`, exitCode: EXIT_CODES.input };
}
