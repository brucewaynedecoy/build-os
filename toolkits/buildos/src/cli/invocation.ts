/**
 * The legacy Go tool names (`buildos-intake`, `buildos-discovery`,
 * `buildos-design`). A legacy name maps its arguments to the matching
 * `buildos <domain>` command and keeps the Go tool's output and exit code,
 * byte for byte (PRD 20 Legacy Command Names). It also writes one stderr
 * line that names the new command and says the old name goes away in
 * `0.3.0` (W1 R7 P6 t3; parity exception PE-016).
 *
 * Each legacy name has its own small entry file next to the bundle
 * (`dist/buildos-intake.js` and the others; owner decision 2026-11-24). The
 * entry file passes its name to the bundle explicitly, through a global
 * keyed by `COMMAND_NAME_KEY`, then loads the bundle. The program never
 * reads its name from the path it was started under, so npm's Windows
 * `.cmd` and `.ps1` shims (`node <path>/buildos-intake.js args`) and the
 * POSIX `.bin` links work the same way. `dist/buildos.js` itself is always
 * `buildos`.
 */

export const LEGACY_NAMES: ReadonlyMap<string, string> = new Map([
  ["buildos-intake", "intake"],
  ["buildos-discovery", "discovery"],
  ["buildos-design", "design"],
]);

/** The release that removes the legacy names (PRD 20 Legacy Command Names). */
export const LEGACY_REMOVAL_VERSION = "0.3.0";

/** The `Symbol.for` key under which an entry file passes its command name. */
export const COMMAND_NAME_KEY = "buildos.commandName";

/** The command name an entry file passed, or `undefined` (the program runs as `buildos`). */
export function entryCommandName(): string | undefined {
  const value = (globalThis as Record<symbol, unknown>)[Symbol.for(COMMAND_NAME_KEY)];
  return typeof value === "string" ? value : undefined;
}

/** The `buildos` arguments for a run started under the command name `name`. */
export function invocationArgs(name: string | undefined, args: readonly string[]): string[] {
  const domain = name === undefined ? undefined : LEGACY_NAMES.get(name);
  return domain === undefined ? [...args] : [domain, ...args];
}

/** The one stderr line for a legacy name, with its newline, or `undefined` for `buildos`. */
export function legacyNotice(name: string | undefined): string | undefined {
  const domain = name === undefined ? undefined : LEGACY_NAMES.get(name);
  if (domain === undefined) return undefined;
  return `Note: the command name "${name}" goes away in BuildOS ${LEGACY_REMOVAL_VERSION}. Use "buildos ${domain}" instead.\n`;
}

/**
 * The text of the entry file for the legacy name `name`, which loads the
 * bundle `bundleFile` (a file name in the same folder). The build writes it.
 */
export function legacyEntrySource(name: string, bundleFile: string): string {
  if (!LEGACY_NAMES.has(name)) throw new Error(`${name} is not a legacy command name`);
  if (!/^[A-Za-z0-9._-]+$/.test(bundleFile)) throw new Error(`the bundle file name ${bundleFile} is not a plain file name`);
  return [
    "#!/usr/bin/env node",
    `// The legacy command name "${name}" (PRD 20 Legacy Command Names). It runs`,
    `// the same program as "buildos ${LEGACY_NAMES.get(name)!}" and goes away in BuildOS ${LEGACY_REMOVAL_VERSION}.`,
    `globalThis[Symbol.for(${JSON.stringify(COMMAND_NAME_KEY)})] = ${JSON.stringify(name)};`,
    `await import(${JSON.stringify(`./${bundleFile}`)});`,
    "",
  ].join("\n");
}
