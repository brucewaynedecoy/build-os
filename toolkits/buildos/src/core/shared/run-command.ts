/**
 * The commands BuildOS prints for the adopter to run (F-P8-11 and F-P8-10,
 * parity exception PE-023; owner decision of 2026-11-26). A command printed
 * as a fix to copy and run starts with `npx -y build-os@<running version>`,
 * which runs on every system with Node.js and no global install. Every such
 * command is built here.
 *
 * Edge cases (each has a test in test/run-command.test.ts):
 *
 * - A release version (an exact `MAJOR.MINOR.PATCH`, with or without a
 *   prerelease part such as `0.2.0-rc.1`) gives the `npx` form. npm can hold
 *   that exact version, and the exact pin runs this same version.
 * - A source build (`dev`), the reserved `0.0.0-dev`, and any other version
 *   that is not an exact npm version (for example one with build metadata,
 *   `0.2.0+local`: npm drops the `+local` part and would run the registry
 *   `0.2.0`, a different build) give the plain `buildos` form. No npm
 *   version names such a build, so an `npx` form could not run it; `buildos`
 *   is the name a source build gets from `npm link` or a global install of
 *   its packed file. `buildos init` used this rule for its shown command
 *   since W1 R7 P6.
 * - A folder path (a `{ path }` word) is always quoted, as Go's `%q` always
 *   quoted the root, so the command has the same shape for every folder:
 *   POSIX single quotes (the shell expands nothing inside them; a `'` is
 *   written `'\''`), and on Windows Command Prompt double quotes. In those, a
 *   `\` stays one `\` (Go's `%q` doubled each one, F-P8-10), a backslash run
 *   is doubled only before a closing quote (the Microsoft C runtime rule),
 *   and each `%` is outside the quotes as `^%`. Other words are quoted only
 *   when they hold a character outside the safe set (`quoteArg` in
 *   src/core/init/make-docs.ts). The Windows form is the Command Prompt
 *   form, as for every shown command; PowerShell runs it as shown when the
 *   folder name holds no `$`, backtick, or `%` and npm's `npx` shim may run.
 */

import { quoteAlways, quoteArg } from "../init/make-docs.ts";
import { isExactVersion } from "../init/manifest.ts";

/** The npm package that holds the `buildos` program. */
export const PACKAGE_NAME = "build-os";

/** The program name of a source build, and in usage text. */
export const PROGRAM_NAME = "buildos";

/** How BuildOS spells a printed command: the program words and the shell rules. */
export interface PrintedRun {
  /** `["npx", "-y", "build-os@<version>"]`, or `["buildos"]` for a source build. */
  program: readonly string[];
  /** `win32` for Command Prompt quoting; anything else is POSIX. */
  platform: string;
}

/** One word of a printed command: plain text, or a folder path, which is always quoted. */
export type CommandWord = string | { path: string };

/** True when `version` names a version that npm can hold, so `build-os@<version>` runs this same version. */
export function isRegistryVersion(version: string): boolean {
  return isExactVersion(version) && version !== "0.0.0-dev";
}

/** The program words for a build with `version`. */
export function runProgram(version: string): string[] {
  return isRegistryVersion(version) ? ["npx", "-y", `${PACKAGE_NAME}@${version}`] : [PROGRAM_NAME];
}

/** The printed-command style for a build with `version` on `platform`. */
export function printedRun(version: string, platform: string): PrintedRun {
  return { program: runProgram(version), platform };
}

/** The source-build style: plain `buildos`, POSIX quoting. The default where no style is given. */
export const SOURCE_RUN: PrintedRun = { program: [PROGRAM_NAME], platform: "posix" };

/** The whole command, as a user would type it: the program, then `words`, each quoted for the platform. */
export function runCommand(run: PrintedRun, words: readonly CommandWord[]): string {
  const quoted = [...run.program, ...words].map((word) => (typeof word === "string" ? quoteArg(word, run.platform) : quoteAlways(word.path, run.platform)));
  return quoted.join(" ");
}
