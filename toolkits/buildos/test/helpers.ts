import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { CliIo } from "../src/cli/io.ts";

export interface CapturedIo extends CliIo {
  stdout: () => string;
  stderr: () => string;
}

export function captureIo(cwd = process.cwd()): CapturedIo {
  let out = "";
  let err = "";
  return {
    writeStdout: (text) => {
      out += text;
    },
    writeStderr: (text) => {
      err += text;
    },
    cwd,
    stdout: () => out,
    stderr: () => err,
  };
}

/** Fails unless `text` contains `part`. Neither text is printed (P7S-R1-03, P7-F-03): only sizes and the tag of `part`. */
export function assertIncludes(text: string, part: string, message?: string): void {
  if (text.includes(part)) return;
  assert.fail(message ?? `expected a text of ${text.length} characters to include a text of ${part.length} characters (${tag(part)}); texts not shown`);
}

/** Fails unless every key in `expected` matches `actual`, recursing into plain objects. */
export function assertMatchObject(actual: unknown, expected: Record<string, unknown>, path = "value"): void {
  assert.ok(typeof actual === "object" && actual !== null, `${path} must be an object`);
  const record = actual as Record<string, unknown>;
  for (const [key, want] of Object.entries(expected)) {
    const got = record[key];
    if (typeof want === "object" && want !== null && !Array.isArray(want)) {
      assertMatchObject(got, want as Record<string, unknown>, `${path}.${key}`);
    } else {
      assertSame(got, want, `${path}.${key}`);
    }
  }
}

/**
 * A BuildOS section as `buildos init` writes it (W1 R7 P6 review round 3),
 * computed here on its own: the begin line, the integrity line with the
 * SHA-256 of the body lines (each ending in LF), the body lines, and the
 * end line, joined with `eol`, ending in `last`. `gitignore` picks the `#`
 * markers. A body with a stale text still has a valid hash: that is a
 * section BuildOS wrote with an earlier text.
 */
export function buildosSection(body: string, options: { gitignore?: boolean; eol?: string; last?: string } = {}): string {
  const eol = options.eol ?? "\n";
  const last = options.last ?? eol;
  const lines = body.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  const hash = createHash("sha256").update(lines.map((l) => `${l}\n`).join("")).digest("hex");
  const [begin, integrity, end] = options.gitignore === true ? ["# buildos:begin", `# buildos:section v1 sha256=${hash}`, "# buildos:end"] : ["<!-- buildos:begin -->", `<!-- buildos:section v1 sha256=${hash} -->`, "<!-- buildos:end -->"];
  return [begin, integrity, ...lines, end].join(eol) + last;
}

// W1 R7 P7 skills review round 1 (P7S-R1-03): a failing assertion about
// shipped files or a whole project tree must not print file contents or a long
// path list into the CI log. These helpers fail with counts, sizes, and the
// first differing byte.
//
// Skills review round 2 (P7S-R2-03): they never print a discovered name
// either, because a name can itself be the leak (an accidentally added,
// client-named skill folder). A name is shown as a tag: `#` and the first 8
// hex digits of the SHA-256 of the name exactly as the list holds it. To find
// the item on your own machine, run from toolkits/buildos/:
//
//   node scripts/locate-hash.ts <tag> [<tag> ...] [--root <folder>]
//
// It prints every repository path (or path suffix, or a name inside one) with
// that tag. Tests that enumerate shipped or imported content use tag() for
// every name in a message.
const SHOWN = 5;
export const LOCATE_HINT = "find a tag and its line with, from toolkits/buildos/: node scripts/locate-hash.ts <tag>";

/** A stable tag for a discovered name that does not reveal it (P7S-R2-03). */
export function tag(name: string): string {
  return `#${createHash("sha256").update(name, "utf8").digest("hex").slice(0, 8)}`;
}

function few(names: readonly string[]): string {
  const tags = names.map(tag);
  return tags.length <= SHOWN ? tags.join(", ") : `${tags.slice(0, SHOWN).join(", ")}, and ${tags.length - SHOWN} more`;
}

/**
 * Fails unless `problems` is empty. Each entry must already be safe to print:
 * built from tag() for every discovered name, plus a fixed reason.
 */
export function assertNoProblems(problems: readonly string[], label: string): void {
  if (problems.length === 0) return;
  const shown = problems.slice(0, SHOWN).join("; ");
  assert.fail(`${label}: ${problems.length} problem(s): ${shown}${problems.length > SHOWN ? `; and ${problems.length - SHOWN} more` : ""} (${LOCATE_HINT})`);
}

/** Fails unless the two byte (or text) values are equal; the message has sizes and the first differing offset only. */
export function assertSameBytes(actual: Uint8Array | string, expected: Uint8Array | string, label: string): void {
  const a = typeof actual === "string" ? Buffer.from(actual, "utf8") : Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength);
  const b = typeof expected === "string" ? Buffer.from(expected, "utf8") : Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength);
  if (a.equals(b)) return;
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at += 1;
  assert.fail(`${label}: ${a.length} bytes, expected ${b.length} bytes; first difference at byte ${at} (contents not shown)`);
}

/** Fails unless the two lists hold the same names in the same order; the message has counts and a few names. */
export function assertSameList(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length === expected.length && actual.every((name, i) => name === expected[i])) return;
  const want = new Set(expected);
  const got = new Set(actual);
  const missing = expected.filter((name) => !got.has(name));
  const extra = actual.filter((name) => !want.has(name));
  const detail = missing.length === 0 && extra.length === 0 ? "same names in a different order" : `${missing.length} missing (${few(missing)}); ${extra.length} extra (${few(extra)}); ${LOCATE_HINT}`;
  assert.fail(`${label}: ${actual.length} entries, expected ${expected.length}; ${detail}`);
}

/** Fails unless two tree snapshots (path to digest or state) are equal; the message has counts and a few paths. */
export function assertSameTree(actual: ReadonlyMap<string, string>, expected: ReadonlyMap<string, string>, label: string): void {
  const added = [...actual.keys()].filter((k) => !expected.has(k)).sort();
  const removed = [...expected.keys()].filter((k) => !actual.has(k)).sort();
  const changed = [...actual.keys()].filter((k) => expected.has(k) && expected.get(k) !== actual.get(k)).sort();
  if (added.length + removed.length + changed.length === 0) return;
  assert.fail(`${label}: ${added.length} added (${few(added)}); ${removed.length} removed (${few(removed)}); ${changed.length} changed (${few(changed)}); ${LOCATE_HINT}`);
}

function outputShape(text: string): string {
  return `${text.split("\n").length} lines, ${text.length} characters (output not shown; run the test locally to see it)`;
}

/** assert.match for command output that can list every shipped path: a failure names the pattern and the output size only. */
export function assertOutputMatches(text: string, pattern: RegExp, label = "output"): void {
  if (!pattern.test(text)) assert.fail(`${label} does not match ${pattern}: ${outputShape(text)}`);
}

/** assert.doesNotMatch for command output that can list every shipped path; see assertOutputMatches. */
export function assertOutputDoesNotMatch(text: string, pattern: RegExp, label = "output"): void {
  if (pattern.test(text)) assert.fail(`${label} matches ${pattern}: ${outputShape(text)}`);
}

// W1 R7 P7 final check (P7-F-03): an assertion about shipped, imported, or
// guide content, or about the captured output of a command run on it, never
// lets Node print the values. Node's AssertionError keeps `actual` and
// `expected`, and the test reporter prints both even when a message is given,
// so these helpers compare first and fail through assert.fail with sizes only.

/** A captured process output as its size only, for an assertion message. */
export function shape(text: string | null | undefined): string {
  return typeof text === "string" ? outputShape(text) : "no output";
}

function sizeOf(value: unknown): string {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (typeof value === "string") return `a text of ${value.length} characters`;
  if (value instanceof Uint8Array) return `${value.length} bytes`;
  if (Array.isArray(value)) return `a list of ${value.length} entries`;
  if (value instanceof Map || value instanceof Set) return `a collection of ${value.size} entries`;
  return typeof value === "object" ? `an object with ${Object.keys(value).length} keys` : typeof value;
}

function firstDifference(actual: unknown, expected: unknown): string {
  const text = typeof actual === "string" && typeof expected === "string";
  const bytes = actual instanceof Uint8Array && expected instanceof Uint8Array;
  if (!text && !bytes) return "";
  const a = actual as ArrayLike<unknown>;
  const b = expected as ArrayLike<unknown>;
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at += 1;
  return `; first difference at ${text ? "character" : "byte"} ${at}`;
}

/** assert.deepStrictEqual that never prints either value: the message has the label, the sizes, and the first differing offset. */
export function assertSame(actual: unknown, expected: unknown, label = "value"): void {
  if (isDeepStrictEqual(actual, expected)) return;
  assert.fail(`${label}: ${sizeOf(actual)}, expected ${sizeOf(expected)}${firstDifference(actual, expected)} (values not shown; run the test locally to see them)`);
}

/** assert.notDeepStrictEqual that never prints either value. */
export function assertDifferent(actual: unknown, expected: unknown, label = "value"): void {
  if (!isDeepStrictEqual(actual, expected)) return;
  assert.fail(`${label}: ${sizeOf(actual)}, expected a different value (values not shown)`);
}
