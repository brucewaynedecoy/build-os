/**
 * `.os/manifest.json` (PRD 20 Project Initialization and Adoption, Manifest
 * Contract; PRD 06 Contracts and Data).
 *
 * The one manifest contract (W1 R7 P6 review round 2). `parseManifest`
 * implements it here, and `system/.os/scripts/pinned-version.cjs` mirrors it
 * exactly for the wrappers (it runs on any Node.js version, with no
 * dependency). `test/fixtures/manifest-contract.json` is the shared table of
 * accepted and refused manifests that both are tested against.
 *
 * - Encoding: UTF-8, at most `MANIFEST_MAX_BYTES`. One UTF-8 byte order mark
 *   at the start is allowed and ignored. Bytes that are not valid UTF-8 are
 *   refused.
 * - Content: one JSON object. Other fields are allowed (W2 adds some).
 * - `schema_version`: the number 1.
 * - `buildos_version`: either an exact version or `dev`. An exact version is
 *   a semver.org 2.0.0 version with no build metadata: `MAJOR.MINOR.PATCH`
 *   with no leading zeros, and an optional pre-release (`-` and
 *   dot-separated identifiers of ASCII letters, digits, and `-`; a
 *   numeric identifier has no leading zero), at most 256 characters. No
 *   range, tag, `v` prefix, or build metadata (`+...`, which npm ignores, so
 *   it would not pin one package). `dev` is what a source build of BuildOS
 *   writes: it has no published package, so the wrappers stop with a plain
 *   message (exit 3) instead of running `npx`.
 * - `initialized_at`: an ISO 8601 UTC time, `YYYY-MM-DDTHH:MM:SS` with an
 *   optional fraction of 1 to 9 digits and a final `Z`, that names a real
 *   calendar time (no month 13, no February 30, no hour 24).
 */

/** The manifest schema version. W2 extends the same file for update and sync. */
export const MANIFEST_SCHEMA_VERSION = 1;

/** The largest `.os/manifest.json` BuildOS reads: far above a real manifest. */
export const MANIFEST_MAX_BYTES = 64 * 1024;

/** The longest version string (npm's own limit). */
const VERSION_MAX_LENGTH = 256;

export interface ProjectManifest {
  schema_version: number;
  /** The BuildOS package version that set up the project, or `dev` for a source build. The wrappers pin it. */
  buildos_version: string;
  /** When `buildos init` set up or adopted the project, as an ISO 8601 UTC time. */
  initialized_at: string;
}

export function createManifest(version: string, now: Date): ProjectManifest {
  return { schema_version: MANIFEST_SCHEMA_VERSION, buildos_version: version, initialized_at: now.toISOString() };
}

export function serializeManifest(manifest: ProjectManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const NUMERIC = "0|[1-9][0-9]*";
const PRERELEASE_ID = `(?:${NUMERIC}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const EXACT_VERSION = new RegExp(`^(?:${NUMERIC})\\.(?:${NUMERIC})\\.(?:${NUMERIC})(?:-${PRERELEASE_ID}(?:\\.${PRERELEASE_ID})*)?$`);

/**
 * The largest MAJOR, MINOR, or PATCH number that npm reads as a version
 * (semver's Number.MAX_SAFE_INTEGER bound). npm reads a version with a
 * larger one as a dist-tag (W1 R7 P8 pin-first review round 2, finding 6).
 */
const MAX_VERSION_NUMBER = "9007199254740991";

/** True when the digits `n` (no leading zero) are at most MAX_VERSION_NUMBER. */
function isSafeVersionNumber(n: string): boolean {
  return n.length < MAX_VERSION_NUMBER.length || (n.length === MAX_VERSION_NUMBER.length && n <= MAX_VERSION_NUMBER);
}

/** True when `version` is an exact version under the manifest contract (not `dev`). */
export function isExactVersion(version: string): boolean {
  if (version.length > VERSION_MAX_LENGTH || !EXACT_VERSION.test(version)) return false;
  const core = version.split("-", 1)[0] ?? "";
  return core.split(".").every(isSafeVersionNumber);
}

/** True when `version` may be written to, or read from, `buildos_version`. */
export function isManifestVersion(version: string): boolean {
  return version === "dev" || isExactVersion(version);
}

const UTC_TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,9})?Z$/;

/** True when `text` is an ISO 8601 UTC time under the manifest contract. */
export function isUtcTimestamp(text: string): boolean {
  const m = UTC_TIME.exec(text);
  if (m === null) return false;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day <= days;
}

/** Reads `.os/manifest.json` bytes under the manifest contract; `undefined` when they break it. */
export function parseManifest(bytes: Uint8Array): ProjectManifest | undefined {
  if (bytes.length > MANIFEST_MAX_BYTES) return undefined;
  let text: string;
  try {
    // `ignoreBOM: false` (the default) drops one leading UTF-8 byte order mark.
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const m = value as Record<string, unknown>;
  const version = m["buildos_version"];
  const time = m["initialized_at"];
  if (m["schema_version"] !== MANIFEST_SCHEMA_VERSION || typeof version !== "string" || typeof time !== "string") return undefined;
  if (!isManifestVersion(version) || !isUtcTimestamp(time)) return undefined;
  return { schema_version: MANIFEST_SCHEMA_VERSION, buildos_version: version, initialized_at: time };
}
