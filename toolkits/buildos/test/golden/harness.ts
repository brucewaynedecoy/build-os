// Shared golden-parity machinery (W1 R7 P2).
//
// capture.mjs uses it to record what the Go tools do, and compare.test.ts
// uses it to run the TypeScript CLI the same way and compare. Both sides run
// each case in a fresh copy of its fixture, snapshot the folder before and
// after, and normalize the same run-to-run values, so the only thing that can
// differ is the program under test.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { goQuote } from "../../src/cli/parse.ts";
import type { PdfTextItem } from "../../src/core/intake/convert/parsers.ts";

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const GOLDEN_ROOT = join(PACKAGE_ROOT, "test", "golden");

// ---------------------------------------------------------------- Manifest

export type DomainState = "pending" | "enforced";

export interface PrepareStep {
  /** Writes `text` to this path (relative to the fixture copy), creating folders. */
  write?: string;
  text?: string;
  /** Removes this file or folder. */
  remove?: string;
  /** Creates this folder. */
  mkdir?: string;
  /** Sets the permission bits of this path to `mode` (octal text, for example "0444"). Runs last. */
  chmod?: string;
  mode?: string;
}

export interface GoldenCase {
  id: string;
  /** The Go tool that produced the golden: buildos, buildos-intake, buildos-discovery, or buildos-design. */
  tool: string;
  domain: string;
  /** The command name the case runs under. */
  invocation: string;
  args: string[];
  /** Fixture folder, relative to the package root, or null for an empty folder. */
  fixture: string | null;
  /** Working folder inside the fixture copy. Defaults to the copy itself. */
  cwd?: string;
  prepare?: PrepareStep[];
  kind: string;
  exit: number;
  /** Written `.txt` files from PDF text: the body is compared after whitespace normalization. */
  pdf_text?: boolean;
  /** Stdout is a JSON envelope. */
  json?: boolean;
  /**
   * ID of the `os_dependent_groups` entry when the Go output differs by
   * operating system. Such a case has no shared golden: it needs a golden
   * captured on each operating system, under `os/<platform>/`.
   */
  os_dependent?: string;
  note?: string;
}

export interface OsDependentGroup {
  id: string;
  summary: string;
  reason: string;
}

export interface Normalization {
  id: string;
  token: string;
  applies_to: string[];
  reason: string;
}

export interface Manifest {
  domains: Record<string, { state: DomainState; owner_phase: string; tools: string[] }>;
  normalizations: Normalization[];
  os_dependent_groups: OsDependentGroup[];
  commands: { invocation: string; command: string; go_json_mode: boolean; json_coverage: string }[];
  cases: GoldenCase[];
}

export function loadManifest(root = GOLDEN_ROOT): Manifest {
  return JSON.parse(readFileSync(join(root, "cases.json"), "utf8")) as Manifest;
}

/**
 * Runs the TypeScript bundle under each invocation name. A legacy name runs
 * its entry file, which the build writes next to the bundle, as npm's
 * Windows shim does: `node <folder>/<name>.js` (owner decision 2026-11-24).
 */
export function bundleRunner(bundle: string): Runner {
  return {
    command(invocation: string): [string, string[]] {
      if (invocation === "buildos") return [process.execPath, [bundle]];
      const entry = join(dirname(bundle), `${invocation}.js`);
      if (!existsSync(entry)) throw new Error(`the build wrote no entry file ${entry}`);
      return [process.execPath, [entry]];
    },
  };
}

/**
 * Runs each invocation name from an installed package's `.bin` folder (W1 R7
 * P6 t5): `buildos` and the legacy names as npm installed them. On macOS and
 * Linux it starts the `.bin` links directly. On Windows (W1 R7 P6 review
 * round 1) it runs npm's real `.cmd` shims through `cmd.exe /d /s /c`, with
 * each argument quoted for the Windows argument rules and every `cmd.exe`
 * special character escaped with `^` twice (once for the `cmd.exe` line,
 * once for the shim's `%*`), as cross-spawn does for npm shims.
 */
export function installedRunner(binDir: string): Runner {
  return {
    command(invocation: string): [string, string[]] {
      return [join(binDir, process.platform === "win32" ? `${invocation}.cmd` : invocation), []];
    },
    ...(process.platform === "win32"
      ? {
          windowsShim(invocation: string, args: readonly string[]) {
            const shim = join(binDir, `${invocation}.cmd`);
            const line = [escapeCmdCommand(shim), ...args.map((a) => escapeCmdShimArg(a))].join(" ");
            return { file: join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "cmd.exe"), args: ["/d", "/s", "/c", `"${line}"`] };
          },
        }
      : {}),
  };
}

const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/** The program path for a `cmd.exe` line: each special character escaped once. */
export function escapeCmdCommand(command: string): string {
  return command.replace(CMD_META, "^$1");
}

/** One argument for an npm `.cmd` shim run by `cmd.exe /d /s /c`: Windows argument quoting, then `^` escapes twice. */
export function escapeCmdShimArg(arg: string): string {
  let quoted = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  quoted = `"${quoted}"`;
  return quoted.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

// ---------------------------------------------------------------- Observation

/** The type of a tree entry, from lstat: a symbolic link is never followed. */
export type EntryKind = "file" | "dir" | "symlink" | "other";

export interface TreeChange {
  path: string;
  kind: EntryKind;
}

export interface Observation {
  exit: number;
  stdout: Buffer;
  stderr: Buffer;
  added: TreeChange[];
  changed: TreeChange[];
  removed: TreeChange[];
  /** Bytes of every added or changed file, by normalized path. */
  files: Map<string, Buffer>;
  /** Target text of every added or changed symbolic link, by normalized path. Absent means none. */
  links?: Map<string, string>;
  /**
   * Set when the case expects JSON on stdout (`json: true`) and stdout is not
   * one valid JSON document. Such stdout is normalized as plain text only.
   */
  stdoutJsonError?: string;
  /**
   * Permission bits (octal text, for example "0644") of every added or
   * changed file and folder, by normalized path. Undefined where the
   * operating system has no POSIX permission bits (Windows).
   */
  modes?: Map<string, string>;
}

/** True where the file system has POSIX permission bits that the harness records and compares. */
export const MODES_SUPPORTED = process.platform !== "win32";

/** The umask every case runs under, so permission bits do not depend on the caller's shell. */
export const CASE_UMASK = 0o022;

interface SnapshotEntry {
  kind: EntryKind;
  data?: Buffer;
  /** Target text of a symbolic link. */
  target?: string;
  mode?: string;
}

interface Snapshot {
  entries: Map<string, SnapshotEntry>;
}

export function modeText(mode: number): string {
  return `0${(mode & 0o7777).toString(8).padStart(3, "0")}`;
}

/** The snapshot path of the fixture copy folder itself. */
export const ROOT_ENTRY = ".";

/**
 * Records every entry under `root`, and `root` itself as ROOT_ENTRY, with
 * lstat: a symbolic link is recorded as a link (with its target text), never
 * as the file or folder it points to, and is never followed.
 */
function snapshot(root: string): Snapshot {
  const entries = new Map<string, SnapshotEntry>();
  const modeOf = (full: string) => (MODES_SUPPORTED ? { mode: modeText(lstatSync(full).mode) } : {});
  entries.set(ROOT_ENTRY, { kind: "dir", ...modeOf(root) });
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const full = join(dir, name);
      const stats = lstatSync(full);
      const mode = MODES_SUPPORTED ? { mode: modeText(stats.mode) } : {};
      if (stats.isSymbolicLink()) {
        entries.set(childRel, { kind: "symlink", target: readlinkSync(full), ...mode });
      } else if (stats.isDirectory()) {
        entries.set(childRel, { kind: "dir", ...mode });
        walk(full, childRel);
      } else if (stats.isFile()) {
        entries.set(childRel, { kind: "file", data: readFileSync(full), ...mode });
      } else {
        entries.set(childRel, { kind: "other", ...mode });
      }
    }
  };
  walk(root, "");
  return { entries };
}

// ---------------------------------------------------------------- Normalization

export interface RunContext {
  /**
   * Every text the fixture copy folder can appear as in output, longest
   * first: each spelling (see rootSpellings) raw, JSON-escaped, and Go-quoted
   * (see rootEncodings).
   */
  roots: string[];
  startMs: number;
  endMs: number;
  /** UTC dates (YYYY-MM-DD) during the run. */
  dates: string[];
}

const TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g;

function isUtf8(data: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Token escape. Real output that already holds `{ROOT}`, `{TIMESTAMP}`, or
 * `{DATE}` (or the escape mark `{!`) gets `{!` in place of its `{` before
 * any substitution, so a program that prints the literal text `{ROOT}` can
 * never pass for one that printed the fixture folder. The escape is
 * injective: substitution only adds `{` followed by a token name, never
 * `{!`. So two normalized texts are byte-equal exactly when their unescaped
 * token sequences are equal, and the comparator compares the escaped bytes.
 */
const LITERAL_TOKEN = /\{(?=!|ROOT\}|TIMESTAMP\}|DATE\})/g;

export function escapeTokens(text: string): string {
  return text.replace(LITERAL_TOKEN, "{!");
}

/** Reverses escapeTokens for display: `{!` becomes `{`. */
export function unescapeTokens(text: string): string {
  return text.replace(/\{!/g, "{");
}

/**
 * Applies the manifest normalizations N1-N3 to text, after the token escape.
 * N1: the fixture copy folder becomes {ROOT} in every encoding in
 * `ctx.roots`; the separators and the relative path after it stay as
 * printed. N2: an RFC 3339 UTC time stamp from the run window becomes
 * {TIMESTAMP}. N3: the UTC date of the run that starts a promoted design
 * file name (`designs/<date>-`, with `/`, `\`, or JSON-escaped `\\`)
 * becomes `{DATE}`. Time stamps and dates outside the run window are
 * fixture data and stay as they are.
 */
export function normalizeText(text: string, ctx: RunContext): string {
  let out = escapeTokens(text);
  for (const root of withNestedQuoting(ctx.roots, out)) out = out.split(root).join("{ROOT}");
  out = out.replace(TIMESTAMP, (stamp) => {
    const ms = Date.parse(stamp);
    return ms >= Math.floor(ctx.startMs / 1000) * 1000 - 1000 && ms <= ctx.endMs + 1000 ? "{TIMESTAMP}" : stamp;
  });
  for (const date of ctx.dates) {
    out = out.replace(new RegExp(`designs(/|\\\\\\\\|\\\\)${escapeRegExp(date)}-`, "g"), "designs$1{DATE}-");
  }
  return out;
}

function longestBackslashRun(text: string): number {
  let longest = 0;
  for (const run of text.match(/\\+/g) ?? []) longest = Math.max(longest, run.length);
  return longest;
}

/**
 * The root encodings plus every deeper nesting of Go quoting that can occur
 * in `text`: `%q` (or encoding/json) applied again to an already quoted
 * root, any number of times, as when a `%q` message is quoted once more.
 * Each nesting at least doubles the backslash runs, so it stops at the
 * longest backslash run and the length of `text`. Longest first.
 */
function withNestedQuoting(roots: readonly string[], text: string): string[] {
  const seen = new Set(roots);
  const maxRun = longestBackslashRun(text);
  let level = [...roots];
  while (level.length > 0) {
    const next: string[] = [];
    for (const root of level) {
      for (const quoted of [goQuote(root).slice(1, -1), goJsonEscape(root), JSON.stringify(root).slice(1, -1)]) {
        if (seen.has(quoted) || quoted.length > text.length || longestBackslashRun(quoted) > maxRun) continue;
        seen.add(quoted);
        next.push(quoted);
      }
    }
    level = next;
  }
  return [...seen].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
}

/** One JSON string token, in text that is already known to be valid JSON. */
const JSON_STRING = /"(?:[^"\\]|\\.)*"/g;

/**
 * Normalizes JSON output (a case with `json: true`). The text must be one
 * valid JSON document, else this throws: invalid JSON must never normalize
 * to the same bytes as valid JSON. Each string token is decoded, normalized
 * as text (so a root inside a `%q`-quoted message, at any nesting, is found
 * in its decoded form), and encoded again with the escaping the token used
 * (Go encoding/json or JSON.stringify). Everything outside string tokens,
 * and every byte of a string that is not a substituted value, stays as
 * printed. A token with any other escape spelling is normalized as text.
 */
export function normalizeJsonText(text: string, ctx: RunContext): string {
  JSON.parse(text);
  return text.replace(JSON_STRING, (token) => {
    const value = JSON.parse(token) as string;
    const normalized = normalizeText(value, ctx);
    if (`"${goJsonEscape(value)}"` === token) return `"${goJsonEscape(normalized)}"`;
    if (JSON.stringify(value) === token) return JSON.stringify(normalized);
    return normalizeText(token, ctx);
  });
}

/** Go encoding/json string escaping (with its default HTML escaping), without the quotes. */
export function goJsonEscape(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (ch === "\\" || ch === '"') out += `\\${ch}`;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || ch === "<" || ch === ">" || ch === "&" || code === 0x2028 || code === 0x2029) {
      out += `\\u${code.toString(16).padStart(4, "0")}`;
    } else out += ch;
  }
  return out;
}

/**
 * Every text a root spelling can appear as in Go output: as printed (`%s`,
 * `%v`), JSON-escaped (encoding/json, with and without HTML escaping, and
 * JavaScript's JSON.stringify), and Go-quoted (`%q`, strconv.Quote). Quotes
 * are not included, so the relative suffix after the root keeps its own
 * encoding. Longest first, so a longer encoding wins over a shorter one it
 * contains.
 */
export function rootEncodings(spellings: readonly string[]): string[] {
  const out = new Set<string>();
  for (const s of spellings) {
    out.add(s);
    out.add(goJsonEscape(s));
    out.add(JSON.stringify(s).slice(1, -1));
    out.add(goQuote(s).slice(1, -1));
  }
  return [...out].filter((s) => s.length > 1).sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Adds the separator and drive-letter variants of each spelling. Every
 * spelling gets its `/` form. On Windows each also gets its `\` form and
 * both cases of a drive letter. 8.3 short and long forms come in as separate
 * spellings (the given path and its real path).
 */
export function spellingVariants(spellings: readonly string[], windows: boolean): string[] {
  const out = new Set<string>();
  for (const s of spellings) {
    const forms = [s, s.replace(/\\/g, "/")];
    if (windows) forms.push(s.replace(/\//g, "\\"));
    for (const f of forms) {
      out.add(f);
      if (windows && /^[A-Za-z]:/.test(f)) {
        out.add(`${f[0]?.toUpperCase() ?? ""}${f.slice(1)}`);
        out.add(`${f[0]?.toLowerCase() ?? ""}${f.slice(1)}`);
      }
    }
  }
  return [...out].filter((s) => s.length > 1);
}

function normalizeBytes(data: Buffer, ctx: RunContext): Buffer {
  return isUtf8(data) ? Buffer.from(normalizeText(data.toString("utf8"), ctx), "utf8") : data;
}

/** Normalizes stdout; for a JSON case, as JSON (see normalizeJsonText), with the error when it is not valid JSON. */
export function normalizeStdout(data: Buffer, ctx: RunContext, json: boolean): { stdout: Buffer; jsonError?: string } {
  if (!json) return { stdout: normalizeBytes(data, ctx) };
  if (!isUtf8(data)) return { stdout: data, jsonError: "stdout is not UTF-8" };
  try {
    return { stdout: Buffer.from(normalizeJsonText(data.toString("utf8"), ctx), "utf8") };
  } catch (error) {
    return { stdout: normalizeBytes(data, ctx), jsonError: `stdout is not valid JSON: ${(error as Error).message}` };
  }
}

/**
 * Every spelling of the fixture copy folder: as given, its real path, and
 * its native real path (on Windows that expands 8.3 short names such as
 * `RUNNER~1`, and the given path from the temporary folder may be short).
 */
export function rootSpellings(root: string): string[] {
  const spellings = new Set<string>([root]);
  try {
    spellings.add(realpathSync(root));
    spellings.add(realpathSync.native(root));
  } catch {
    // The folder always exists here; keep the given spelling.
  }
  return spellingVariants([...spellings], sep === "\\");
}

function utcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- Running a case

export interface Runner {
  /** The program and leading arguments that run `invocation`. */
  command(invocation: string): [string, string[]];
  /**
   * Windows: the whole `cmd.exe` call that runs `invocation` with `args`
   * through an npm `.cmd` shim, passed verbatim (W1 R7 P6 review round 1).
   */
  windowsShim?(invocation: string, args: readonly string[]): { file: string; args: string[] };
}

export interface CaseRun {
  observation: Observation;
  ctx: RunContext;
}

function substituteDate(text: string, date: string): string {
  return text.split("{DATE}").join(date);
}

/** Copies the fixture into a fresh temporary folder and applies the prepare steps. */
export function prepareFixture(testCase: GoldenCase, date: string): string {
  const base = mkdtempSync(join(tmpdir(), "buildos-golden-"));
  const root = join(base, "work");
  if (testCase.fixture === null) {
    mkdirSync(root);
  } else {
    cpSync(join(PACKAGE_ROOT, testCase.fixture), root, { recursive: true });
  }
  for (const step of testCase.prepare ?? []) {
    if (step.remove !== undefined) rmSync(join(root, substituteDate(step.remove, date)), { recursive: true, force: true });
    if (step.mkdir !== undefined) mkdirSync(join(root, substituteDate(step.mkdir, date)), { recursive: true });
    if (step.write !== undefined) {
      const target = join(root, substituteDate(step.write, date));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, step.text ?? "");
    }
  }
  for (const step of testCase.prepare ?? []) {
    if (step.chmod !== undefined) chmodSync(join(root, substituteDate(step.chmod, date)), Number.parseInt(step.mode ?? "", 8));
  }
  return root;
}

/** Makes every entry writable again so a read-only prepare step never blocks cleanup (Windows read-only attribute). */
function makeWritable(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    try {
      chmodSync(join(entry.parentPath, entry.name), entry.isDirectory() ? 0o755 : 0o644);
    } catch {
      // Best effort; rmSync reports anything that still blocks it.
    }
  }
}

/** Runs one case with `runner` and returns the normalized observation. */
export function runCase(testCase: GoldenCase, runner: Runner): CaseRun {
  const startMs = Date.now();
  const root = prepareFixture(testCase, utcDate(startMs));
  try {
    const cwd = testCase.cwd === undefined ? root : join(root, testCase.cwd);
    const before = snapshot(root);
    const [program, lead] = runner.command(testCase.invocation);
    const shim = runner.windowsShim?.(testCase.invocation, testCase.args);
    const previousUmask = MODES_SUPPORTED ? process.umask(CASE_UMASK) : undefined;
    let result;
    try {
      result = spawnSync(shim?.file ?? program, shim?.args ?? [...lead, ...testCase.args], {
        cwd,
        windowsVerbatimArguments: shim !== undefined,
        env: { ...process.env, PWD: cwd, TZ: "UTC", NO_COLOR: "1" },
        maxBuffer: 64 * 1024 * 1024,
      });
    } finally {
      if (previousUmask !== undefined) process.umask(previousUmask);
    }
    const endMs = Date.now();
    // W1 R7 P6 review round 3: a case that could not run says what was started, where, and what it printed.
    const started = () => `${JSON.stringify(shim?.file ?? program)} ${JSON.stringify(shim?.args ?? [...lead, ...testCase.args])} in ${cwd}; stdout ${JSON.stringify(String(result.stdout ?? ""))}; stderr ${JSON.stringify(String(result.stderr ?? ""))}`;
    if (result.error !== undefined) throw new Error(`case ${testCase.id}: could not run ${started()}: ${result.error.message}`, { cause: result.error });
    if (result.status === null) throw new Error(`case ${testCase.id}: killed by signal ${String(result.signal)}: ${started()}`);
    const after = snapshot(root);
    const dates = [...new Set([utcDate(startMs), utcDate(endMs)])];
    const ctx: RunContext = { roots: rootEncodings(rootSpellings(root)), startMs, endMs, dates };
    return { observation: observe(before, after, result.status, result.stdout, result.stderr, ctx, testCase.json === true), ctx };
  } finally {
    makeWritable(dirname(root));
    rmSync(dirname(root), { recursive: true, force: true });
  }
}

function observe(before: Snapshot, after: Snapshot, exit: number, stdout: Buffer, stderr: Buffer, ctx: RunContext, json: boolean): Observation {
  const added: TreeChange[] = [];
  const changed: TreeChange[] = [];
  const removed: TreeChange[] = [];
  const files = new Map<string, Buffer>();
  const links = new Map<string, string>();
  const modes = MODES_SUPPORTED ? new Map<string, string>() : undefined;
  const norm = (path: string) => normalizeText(path, ctx);
  const record = (path: string, entry: SnapshotEntry) => {
    if (entry.data !== undefined) files.set(norm(path), normalizeBytes(entry.data, ctx));
    if (entry.target !== undefined) links.set(norm(path), normalizeText(entry.target, ctx));
    if (modes !== undefined && entry.mode !== undefined) modes.set(norm(path), entry.mode);
  };
  for (const [path, entry] of after.entries) {
    const old = before.entries.get(path);
    if (old === undefined) {
      added.push({ path: norm(path), kind: entry.kind });
      record(path, entry);
    } else if (
      old.kind !== entry.kind ||
      (entry.data !== undefined && old.data !== undefined && !entry.data.equals(old.data)) ||
      old.target !== entry.target ||
      old.mode !== entry.mode
    ) {
      changed.push({ path: norm(path), kind: entry.kind });
      record(path, entry);
    }
  }
  for (const [path, entry] of before.entries) {
    if (!after.entries.has(path)) removed.push({ path: norm(path), kind: entry.kind });
  }
  const byPath = (a: TreeChange, b: TreeChange) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const out = normalizeStdout(stdout, ctx, json);
  return {
    exit,
    stdout: out.stdout,
    stderr: normalizeBytes(stderr, ctx),
    added: added.sort(byPath),
    changed: changed.sort(byPath),
    removed: removed.sort(byPath),
    files,
    ...(links.size === 0 ? {} : { links: sortedMap(links) }),
    ...(modes === undefined ? {} : { modes: sortedMap(modes) }),
    ...(out.jsonError === undefined ? {} : { stdoutJsonError: out.jsonError }),
  };
}

function sortedMap<V>(map: Map<string, V>): Map<string, V> {
  return new Map([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// ---------------------------------------------------------------- Golden files

/** The operating systems that have their own golden sets (Node `process.platform` names). */
export const GOLDEN_PLATFORMS = ["darwin", "linux", "win32"] as const;
export type GoldenPlatform = (typeof GOLDEN_PLATFORMS)[number];

/** The shared golden of a case: used on every operating system that has no golden of its own. */
export function goldenDir(testCase: GoldenCase, root = GOLDEN_ROOT): string {
  return join(root, testCase.tool, testCase.id);
}

/** The root of one operating system's golden set. */
export function osGoldenRoot(platform: string, root = GOLDEN_ROOT): string {
  return join(root, "os", platform);
}

/** The golden of a case for one operating system. */
export function osGoldenDir(testCase: GoldenCase, platform: string, root = GOLDEN_ROOT): string {
  return goldenDir(testCase, osGoldenRoot(platform, root));
}

export type GoldenSelection =
  | { status: "os"; platform: string; dir: string }
  | { status: "shared"; dir: string }
  | { status: "missing-golden"; reason: string };

/**
 * Picks the golden a case is compared with on `platform`. A golden captured
 * on that operating system wins. Otherwise a case that is not OS-dependent
 * uses the shared golden. An OS-dependent case never falls back to the
 * shared set, so it is `missing-golden` until its operating system has a
 * capture.
 */
export function selectGolden(testCase: GoldenCase, platform: string = process.platform, root = GOLDEN_ROOT): GoldenSelection {
  const osDir = osGoldenDir(testCase, platform, root);
  if (hasGoldenDir(osDir)) {
    // A derived golden (not captured from Go) counts only for a case that a
    // platform exception class lists for this operating system.
    const derived = readDerived(osDir);
    if (derived !== undefined && !derivedGoldenAllowed(testCase, platform, derived, root)) {
      return {
        status: "missing-golden",
        reason: `the ${platform} golden is derived (${derived.exception}), but no platform exception class in parity-exceptions.json lists ${testCase.id} with a derived golden for ${platform}`,
      };
    }
    return { status: "os", platform, dir: osDir };
  }
  if (testCase.os_dependent !== undefined) {
    return {
      status: "missing-golden",
      reason: `OS-dependent case (${testCase.os_dependent}) has no golden for ${platform}; run the golden capture workflow on ${platform} and commit its artifact (see CAPTURE.md)`,
    };
  }
  const shared = goldenDir(testCase, root);
  if (hasGoldenDir(shared)) return { status: "shared", dir: shared };
  return { status: "missing-golden", reason: `no shared golden and no golden for ${platform}; run test/golden/capture.mjs (see CAPTURE.md)` };
}

/** Every golden folder that exists for a case: the shared one, then one per operating system. */
export function existingGoldenDirs(testCase: GoldenCase, root = GOLDEN_ROOT): { source: string; dir: string }[] {
  const all = [{ source: "shared", dir: goldenDir(testCase, root) }, ...GOLDEN_PLATFORMS.map((p) => ({ source: p, dir: osGoldenDir(testCase, p, root) }))];
  return all.filter((g) => hasGoldenDir(g.dir));
}

interface ResultFile {
  id: string;
  tool: string;
  invocation: string;
  args: string[];
  exit: number;
  stdout_sha256: string;
  stderr_sha256: string;
  added: TreeChange[];
  changed: TreeChange[];
  removed: TreeChange[];
  files: Record<string, string>;
  /** Target text of every added or changed symbolic link. Absent when there is none. */
  links?: Record<string, string>;
  /** Permission bits of every added or changed entry. Absent in a golden captured on Windows. */
  modes?: Record<string, string>;
  /** Present only in a derived golden (see deriveGolden): not captured from Go. */
  derived?: DerivedMark;
}

/** The mark of a derived golden in its result.json. */
export interface DerivedMark {
  /** The platform exception class that allows it, for example PE-005. */
  exception: string;
  /** The source golden folder, relative to the golden root, `/`-separated. */
  source: string;
  /** goldenDirDigest of the source golden folder. */
  source_sha256: string;
}

export const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** Writes one case's golden into `dir`: result.json, stdout, stderr, and files/<path>. */
export function writeGolden(testCase: GoldenCase, observation: Observation, dir: string, derived?: DerivedMark): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "stdout"), observation.stdout);
  writeFileSync(join(dir, "stderr"), observation.stderr);
  const files: Record<string, string> = {};
  for (const [path, data] of [...observation.files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const target = join(dir, "files", ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    files[path] = sha256(data);
  }
  const result: ResultFile = {
    id: testCase.id,
    tool: testCase.tool,
    invocation: testCase.invocation,
    args: testCase.args,
    exit: observation.exit,
    stdout_sha256: sha256(observation.stdout),
    stderr_sha256: sha256(observation.stderr),
    added: observation.added,
    changed: observation.changed,
    removed: observation.removed,
    files,
    ...(observation.links === undefined || observation.links.size === 0 ? {} : { links: Object.fromEntries(observation.links) }),
    ...(observation.modes === undefined ? {} : { modes: Object.fromEntries(observation.modes) }),
    ...(derived === undefined ? {} : { derived }),
  };
  writeFileSync(join(dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
}

/** Reads one case's golden for `platform` (see selectGolden) into an observation. */
export function readGolden(testCase: GoldenCase, root = GOLDEN_ROOT, platform: string = process.platform): Observation {
  const selection = selectGolden(testCase, platform, root);
  if (selection.status === "missing-golden") throw new Error(`golden case ${testCase.id}: missing-golden: ${selection.reason}`);
  return readGoldenDir(selection.dir);
}

/** Reads the golden in one folder into an observation. */
export function readGoldenDir(dir: string): Observation {
  const result = JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) as ResultFile;
  const files = new Map<string, Buffer>();
  for (const path of Object.keys(result.files)) files.set(path, readFileSync(join(dir, "files", ...path.split("/"))));
  return {
    exit: result.exit,
    stdout: readFileSync(join(dir, "stdout")),
    stderr: readFileSync(join(dir, "stderr")),
    added: result.added,
    changed: result.changed,
    removed: result.removed,
    files,
    ...(result.links === undefined ? {} : { links: new Map(Object.entries(result.links)) }),
    ...(result.modes === undefined ? {} : { modes: new Map(Object.entries(result.modes)) }),
  };
}

/** The build identity a golden holds: a development build (`npm run build`). */
export const GOLDEN_BUILD_IDENTITY = { version: "dev", sourceRevision: "unknown" } as const;

export interface BuildIdentity {
  version: string;
  sourceRevision: string;
}

/**
 * The release identity the comparison expects (W1 R7 P8 review round 1):
 * BUILDOS_GOLDEN_EXPECT_VERSION and BUILDOS_GOLDEN_EXPECT_REVISION, both or
 * neither. Undefined: the goldens' development identity is expected.
 */
export function expectedBuildIdentity(env: NodeJS.ProcessEnv = process.env): BuildIdentity | undefined {
  const version = env["BUILDOS_GOLDEN_EXPECT_VERSION"] ?? "";
  const sourceRevision = env["BUILDOS_GOLDEN_EXPECT_REVISION"] ?? "";
  if (version === "" && sourceRevision === "") return undefined;
  if (version === "" || sourceRevision === "") throw new Error("set both BUILDOS_GOLDEN_EXPECT_VERSION and BUILDOS_GOLDEN_EXPECT_REVISION, or neither");
  if (!/^[0-9A-Za-z.+-]+$/.test(version) || !/^[0-9a-f]{40}(?:-dirty)?$/.test(sourceRevision)) throw new Error("BUILDOS_GOLDEN_EXPECT_VERSION or BUILDOS_GOLDEN_EXPECT_REVISION is not a version and a full commit SHA");
  return { version, sourceRevision };
}

/**
 * The golden as a build with `identity` would print it. Only the four places
 * where the CLI prints its build identity change: the text lines
 * `version: dev` and `source revision: unknown`, and the JSON members
 * `"version": "dev"` and `"source_revision": "unknown"`. Every other byte is
 * compared as captured, and the expected identity must appear exactly there;
 * a build that still prints `dev` fails. The golden files never change.
 */
export function withBuildIdentity(golden: Observation, identity: BuildIdentity): Observation {
  const stamp = (data: Buffer): Buffer => (isUtf8(data) ? Buffer.from(stampBuildIdentity(data.toString("utf8"), identity), "utf8") : data);
  return { ...golden, stdout: stamp(golden.stdout), stderr: stamp(golden.stderr) };
}

/**
 * PE-023 (owner decision 2026-11-26): the class of printed fix commands. The
 * `rebuild` form occurs in the goldens listed per operating system (the set
 * the running system selects: its own golden, a derived golden, or the
 * shared one), in the entity edge seeds, and in the $PWD seeds. The `usage`
 * form occurs in the shared goldens listed. test/golden/printed-command.test.ts
 * checks that each list is exactly where the form occurs.
 */
export interface PrintedCommandClass {
  rule: string;
  program: { source_build: string; release: string };
  rebuild: { go: string; ours: string; cases: Record<"darwin" | "linux" | "win32", string[]>; edge: string[]; pwd: string[] };
  usage: { go: string; ours: string; cases: string[] };
  /** F-P8-11 review round 1 (finding 1): the shell label of the human `action:` line on Windows. */
  label: { go: string; ours: string; platform: "win32"; cases: string[] };
}

/** The PE-023 class, or throws when parity-exceptions.json has none. */
export function printedCommandClass(exceptions: ExceptionsFile): PrintedCommandClass {
  const found = exceptions.exceptions.filter((e) => e.printed_command !== undefined);
  if (found.length !== 1) throw new Error(`exactly one parity exception must hold printed_command, found ${found.length}`);
  return found[0]!.printed_command!;
}

/**
 * PE-023: the program a printed fix command starts with, for the build
 * identity the comparison expects. A release version gives
 * `npx -y build-os@<version>`: an exact semver version of at most 256
 * characters, MAJOR.MINOR.PATCH without leading zeros and each at most
 * Number.MAX_SAFE_INTEGER, with an optional prerelease part whose numeric
 * identifiers have no leading zero, and not 0.0.0-dev. The development
 * identity and any other version give `buildos`. This is the harness's own
 * statement of the rule (the manifest contract's exact version), not a call
 * to the CLI's code.
 */
export function printedProgram(identity: BuildIdentity | undefined): string {
  const version = identity?.version;
  return version !== undefined && isPrintedReleaseVersion(version) ? `npx -y build-os@${version}` : "buildos";
}

function isPrintedReleaseVersion(version: string): boolean {
  if (version.length > 256 || version === "0.0.0-dev") return false;
  const m = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (m === null) return false;
  if (![m[1], m[2], m[3]].every((n) => BigInt(n!) <= BigInt(Number.MAX_SAFE_INTEGER))) return false;
  return (m[4] ?? "").split(".").every((id) => id === "" || !/^0[0-9]+$/.test(id));
}

/** Go's `%q` string literal decoded (the forms the goldens hold: printable text, `\\`, `\"`, and `\xHH`). */
function goUnquote(literal: string): string {
  if (/\\[^\\"x]/.test(literal.replace(/\\\\/g, ""))) throw new Error(`PE-023: Go string ${literal} has an escape the rule does not decode`);
  return JSON.parse(literal.replace(/\\x([0-9a-fA-F]{2})/g, "\\u00$1")) as string;
}

/**
 * PE-023: a folder path as the port prints it in a fix command, always
 * quoted. POSIX: single quotes, a `'` as `'\''`. Windows: Command Prompt
 * double quotes with each `\` kept single; a path with `"` or `%` or a
 * trailing `\` never occurs in a golden (the normalized root is `{ROOT}`),
 * so the rule refuses it rather than guess.
 */
export function printedPath(path: string, platform: string): string {
  if (platform === "win32") {
    if (/["%]|\\$/.test(path)) throw new Error(`PE-023: the Windows path ${JSON.stringify(path)} needs quoting the rule does not state`);
    return `"${path}"`;
  }
  return `'${path.replace(/'/g, "'\\''")}'`;
}

const GO_REBUILD = /(  action: )?buildos entities rebuild-index --root ("(?:[^"\\]|\\.)*") --mode (strict|compat) --apply/g;
const GO_USAGE = "Run buildos help for command syntax.";

/** Counts of the PE-023 forms that applyPrintedCommands replaced. */
export interface PrintedCommandHits {
  rebuild: number;
  usage: number;
  /** Human `action:` lines on Windows that got the shell label. */
  label: number;
}

/**
 * PE-023 label rule (F-P8-11 review round 1, finding 1), stated here on its
 * own: on Windows, a human `action:` line that is the rebuild command reads
 * `  action: run this in Command Prompt: <command>`, with `, with delayed
 * expansion off` after `Command Prompt` when the command holds a `!`. Only
 * in the text as printed: a JSON string holds the command alone.
 */
function windowsLabel(command: string): string {
  return command.includes("!") ? "run this in Command Prompt, with delayed expansion off" : "run this in Command Prompt";
}

function printedText(text: string, program: string, platform: string, hits: PrintedCommandHits, human: boolean): string {
  const rebuilt = text.replace(GO_REBUILD, (_m, action: string | undefined, quoted: string, mode: string) => {
    hits.rebuild++;
    const command = `${program} entities rebuild-index --root ${printedPath(goUnquote(quoted), platform)} --mode ${mode} --apply`;
    if (action === undefined) return command;
    if (!human || platform !== "win32") return `${action}${command}`;
    hits.label++;
    return `${action}${windowsLabel(command)}: ${command}`;
  });
  const parts = rebuilt.split(GO_USAGE);
  hits.usage += parts.length - 1;
  return parts.join(`Run ${program} help for command syntax.`);
}

/**
 * PE-023: Go's text with each printed fix command as the port prints it.
 * The `rebuild` form `buildos entities rebuild-index --root <Go %q root>
 * --mode <mode> --apply` becomes `<program> entities rebuild-index --root
 * <printedPath> --mode <mode> --apply`; the `usage` form `Run buildos help
 * for command syntax.` becomes `Run <program> help for command syntax.`.
 * Each is replaced in the text as printed and inside each JSON string,
 * which is decoded first and encoded again with Go's escaping (the string
 * must be in Go encoding/json form). On Windows, a rebuild command on a
 * human `action:` line in the text as printed also gets the shell label
 * (`windowsLabel`). Nothing else changes.
 */
export function applyPrintedCommands(text: string, program: string, platform: string): { text: string; hits: PrintedCommandHits } {
  const hits: PrintedCommandHits = { rebuild: 0, usage: 0, label: 0 };
  const raw = printedText(text, program, platform, hits, true);
  const out = raw.replace(JSON_STRING, (token) => {
    let value: string;
    try {
      value = JSON.parse(token) as string;
    } catch {
      return token;
    }
    const next = printedText(value, program, platform, hits, false);
    if (next === value) return token;
    if (`"${goJsonEscape(value)}"` !== token) throw new Error(`PE-023: JSON string ${token} is not in Go encoding/json form`);
    return `"${goJsonEscape(next)}"`;
  });
  return { text: out, hits };
}

/** PE-023 applied to a golden's stdout and stderr (see applyPrintedCommands), with the total hits. */
export function withPrintedCommands(golden: Observation, program: string, platform: string): { observation: Observation; hits: PrintedCommandHits } {
  const total: PrintedCommandHits = { rebuild: 0, usage: 0, label: 0 };
  const stamp = (data: Buffer): Buffer => {
    if (!isUtf8(data)) return data;
    const { text, hits } = applyPrintedCommands(data.toString("utf8"), program, platform);
    total.rebuild += hits.rebuild;
    total.usage += hits.usage;
    total.label += hits.label;
    return Buffer.from(text, "utf8");
  };
  return { observation: { ...golden, stdout: stamp(golden.stdout), stderr: stamp(golden.stderr) }, hits: total };
}

/**
 * PE-023 applied to a Go seed result (an entity edge seed or a $PWD seed)
 * for a development build: its stdout and stderr with each printed fix
 * command in the port's form. Throws when the form occurs in a seed that
 * PE-023 does not list under `key`, or does not occur in one it lists.
 */
export function seedWithPrintedCommands<T extends { stdout: string; stderr: string }>(name: string, seed: T, key: "edge" | "pwd", exceptions: ExceptionsFile, platform: string = process.platform): T {
  const listed = printedCommandClass(exceptions).rebuild[key].includes(name);
  const stdout = applyPrintedCommands(seed.stdout, "buildos", platform);
  const stderr = applyPrintedCommands(seed.stderr, "buildos", platform);
  const hits = stdout.hits.rebuild + stderr.hits.rebuild + stdout.hits.usage + stderr.hits.usage;
  if ((hits > 0) !== listed) throw new Error(`PE-023: the ${key} seed ${name} holds ${hits} printed fix command(s), and PE-023 ${listed ? "lists" : "does not list"} it under rebuild.${key}`);
  return { ...seed, stdout: stdout.text, stderr: stderr.text };
}

/** The text with the four build identity places stamped (see withBuildIdentity). */
export function stampBuildIdentity(text: string, identity: BuildIdentity): string {
  return text
    .replace(/^version: dev$/gm, () => `version: ${identity.version}`)
    .replace(/^source revision: unknown$/gm, () => `source revision: ${identity.sourceRevision}`)
    .replace(/"version": "dev"/g, () => `"version": ${JSON.stringify(identity.version)}`)
    .replace(/"source_revision": "unknown"/g, () => `"source_revision": ${JSON.stringify(identity.sourceRevision)}`);
}

/**
 * The exact allowed golden values of the parity exceptions, stamped as
 * withBuildIdentity stamps a golden: an exception that pins a whole stdout
 * pins the build identity in it too. Nothing else in an exception changes.
 */
export function exceptionsWithBuildIdentity<T extends { golden: GoldenException[] }>(list: T[], identity: BuildIdentity): T[] {
  return list.map((e) => ({ ...e, golden: e.golden.map((g) => (g.actual === null ? g : { ...g, actual: stampBuildIdentity(g.actual, identity) })) }));
}

export function hasGoldenDir(dir: string): boolean {
  return existsSync(join(dir, "result.json"));
}

/** True when a golden folder exists at all, complete or not (for example without result.json). */
export function goldenDirExists(dir: string): boolean {
  return existsSync(dir);
}

/** Every file under a golden folder, as sorted `/`-separated relative paths. */
export function listGoldenFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join("/"))
    .sort();
}

/**
 * True when two golden folders hold the same files with the same bytes.
 * With `ignoreModes` (a capture on Windows, which has no permission bits),
 * the `modes` field of result.json is left out of the comparison.
 */
export function sameGoldenDirs(a: string, b: string, options: { ignoreModes?: boolean } = {}): boolean {
  const files = listGoldenFiles(a);
  if (files.join("\n") !== listGoldenFiles(b).join("\n")) return false;
  return files.every((rel) => {
    const x = readFileSync(join(a, ...rel.split("/")));
    const y = readFileSync(join(b, ...rel.split("/")));
    if (options.ignoreModes === true && rel === "result.json") {
      const strip = (data: Buffer) => {
        const parsed = JSON.parse(data.toString("utf8")) as Record<string, unknown>;
        delete parsed["modes"];
        return JSON.stringify(parsed);
      };
      return strip(x) === strip(y);
    }
    return x.equals(y);
  });
}

// ---------------------------------------------------------------- Comparison

export interface Difference {
  case: string;
  /** exit, stdout, stdout:json, stderr, tree, file:<path>, link:<path>, or mode:<path>. */
  field: string;
  /** Where the bytes first differ, for the failure message. */
  detail: string;
  /** The actual (TypeScript) value of the field, as text, for exception matching. */
  actual: string;
}

/** Collapses every whitespace run, line breaks included, to one space (PRD 07 PDF rule). */
export function normalizePdfWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** For a PDF `.txt` twin: the front matter stays exact and only the body is whitespace-normalized. */
function pdfComparable(data: Buffer): string {
  const text = data.toString("utf8");
  const match = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/.exec(text);
  if (match === null) return normalizePdfWhitespace(text);
  return `${match[1] ?? ""}${normalizePdfWhitespace(match[2] ?? "")}`;
}

/**
 * The PE-009 class check of two PDF twins, in both directions: the front
 * matter must be the same, and the bodies must pass pdfWordGapClass with
 * the source PDF's separations, so the port's body must hold every word
 * gap the PDF renders and may differ from Go's only by those spaces. A
 * port body equal to Go's fails where Go ran rendered words together.
 * Returns the problem, or undefined. Without separations the check cannot
 * run, which is a problem.
 */
function pdfWordGapProblem(expected: Buffer, got: Buffer, separations: string | undefined): string | undefined {
  if (separations === undefined) return "PE-009: the source PDF's word separations are missing, so the class check cannot run";
  const split = (data: Buffer) => /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/.exec(data.toString("utf8"));
  const [e, g] = [split(expected), split(got)];
  if (e === null || g === null) return "PE-009: a PDF twin has no front matter";
  if (e[1] !== g[1]) return `front matter differs: ${firstDifference(Buffer.from(e[1] ?? ""), Buffer.from(g[1] ?? ""))}`;
  return pdfWordGapClass(e[2] ?? "", g[2] ?? "", separations).problems[0];
}

/** Names the first differing line (1-based) and byte offset of two byte strings. */
export function firstDifference(expected: Buffer, actual: Buffer): string {
  const limit = Math.min(expected.length, actual.length);
  let offset = 0;
  while (offset < limit && expected[offset] === actual[offset]) offset++;
  if (offset === limit && expected.length === actual.length) return "identical";
  const line = expected.subarray(0, offset).toString("utf8").split("\n").length;
  const lineOf = (data: Buffer) => {
    const lines = data.toString("utf8").split("\n");
    return lines[line - 1] ?? "<end of output>";
  };
  return `first difference at line ${line}, byte offset ${offset}: expected ${JSON.stringify(lineOf(expected))}, actual ${JSON.stringify(lineOf(actual))}`;
}

function treeText(o: Observation): string {
  const row = (status: string) => (c: TreeChange) => `${status} ${c.kind} ${c.path}`;
  return [...o.added.map(row("added")), ...o.changed.map(row("changed")), ...o.removed.map(row("removed"))].join("\n") + "\n";
}

/** Every difference between a golden and an observation. */
/**
 * Options of compareObservations. `pdfClass` applies the PE-009 class check
 * (pdfWordGapProblem) to every PDF twin of a `pdf_text` case, even when the
 * port's text equals Go's after white-space normalization, with the source
 * PDF's `pdfSeparations`; a missing separation string is then a difference.
 * It defaults to true when `pdfSeparations` is given. Without it (a golden
 * compared with a golden), PDF twins are compared after white-space
 * normalization only. The golden harness always sets it.
 */
export interface CompareOptions {
  pdfSeparations?: string;
  pdfClass?: boolean;
}

export function compareObservations(testCase: GoldenCase, golden: Observation, actual: Observation, options: CompareOptions = {}): Difference[] {
  const diffs: Difference[] = [];
  const push = (field: string, expected: Buffer, got: Buffer) => {
    diffs.push({ case: testCase.id, field, detail: firstDifference(expected, got), actual: got.toString("utf8") });
  };
  if (golden.exit !== actual.exit) {
    diffs.push({ case: testCase.id, field: "exit", detail: `expected exit ${golden.exit}, actual exit ${actual.exit}`, actual: String(actual.exit) });
  }
  if (!golden.stdout.equals(actual.stdout)) push("stdout", golden.stdout, actual.stdout);
  if (testCase.json === true) {
    // JSON output must be one valid JSON document on both sides; raw text
    // normalization alone can make invalid JSON look like valid JSON.
    for (const [side, o] of [["golden", golden], ["actual", actual]] as const) {
      let problem = o.stdoutJsonError;
      if (problem === undefined) {
        try {
          JSON.parse(o.stdout.toString("utf8"));
        } catch (error) {
          problem = `stdout is not valid JSON: ${(error as Error).message}`;
        }
      }
      if (problem !== undefined) {
        diffs.push({ case: testCase.id, field: "stdout:json", detail: `${side} ${problem}`, actual: actual.stdout.toString("utf8") });
      }
    }
  }
  if (!golden.stderr.equals(actual.stderr)) push("stderr", golden.stderr, actual.stderr);
  const expectedTree = Buffer.from(treeText(golden));
  const actualTree = Buffer.from(treeText(actual));
  if (!expectedTree.equals(actualTree)) push("tree", expectedTree, actualTree);
  for (const [path, expected] of golden.files) {
    const got = actual.files.get(path);
    if (got === undefined) continue; // reported by the tree comparison
    if (testCase.pdf_text === true && path.endsWith(".txt")) {
      const a = Buffer.from(pdfComparable(expected));
      const b = Buffer.from(pdfComparable(got));
      if (options.pdfClass ?? options.pdfSeparations !== undefined) {
        // Both directions, also when the texts are equal (review round 3).
        const problem = pdfWordGapProblem(expected, got, options.pdfSeparations);
        if (problem !== undefined) diffs.push({ case: testCase.id, field: `file:${path}`, detail: problem, actual: got.toString("utf8") });
      } else if (!a.equals(b)) {
        push(`file:${path}`, a, b);
      }
    } else if (!expected.equals(got)) {
      push(`file:${path}`, expected, got);
    }
  }
  for (const [path, expected] of golden.links ?? new Map<string, string>()) {
    const got = actual.links?.get(path);
    if (got === undefined || got === expected) continue; // a missing link is a tree difference
    diffs.push({ case: testCase.id, field: `link:${path}`, detail: `expected link target ${JSON.stringify(expected)}, actual ${JSON.stringify(got)}`, actual: got });
  }
  // Permission bits: compared wherever both sides recorded them (POSIX).
  if (golden.modes !== undefined && actual.modes !== undefined) {
    const paths = [...new Set([...golden.modes.keys(), ...actual.modes.keys()])].sort();
    for (const path of paths) {
      const expected = golden.modes.get(path);
      const got = actual.modes.get(path);
      if (expected === undefined || got === undefined || expected === got) continue; // a missing entry is a tree difference
      diffs.push({ case: testCase.id, field: `mode:${path}`, detail: `expected mode ${expected}, actual mode ${got}`, actual: got });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------- Parity exceptions

export interface GoldenException {
  case: string;
  field: string;
  /** The exact allowed actual value of the field. Null while the domain is pending. */
  actual: string | null;
  /**
   * The operating system (`darwin`, `linux`, or `win32`) this entry applies
   * to, for a value that differs by operating system (an OS-dependent case).
   * Absent: every operating system.
   */
  platform?: string;
}

export interface ParityException {
  id: string;
  summary: string;
  reason: string;
  owner_decision: string;
  golden: GoldenException[];
  /** P1 seed goldens (test/fixtures/go-seed/cli-goldens.json) that differ, with the exact allowed values. */
  go_seed: SeedException[];
  /**
   * Entity edge goldens (test/fixtures/go-seed/entity-edge-goldens.json, from
   * scripts/capture-entity-edge-goldens.ts) that differ, with the exact
   * allowed values. See edgeExceptionProblems.
   */
  edge?: EdgeException[];
  /**
   * Intake write-target edge goldens (test/fixtures/go-seed/intake-edge-goldens.json,
   * from scripts/capture-intake-edge-goldens.ts) that differ, with the exact
   * allowed values, as `edge`. See test/intake-edge.test.ts.
   */
  intake_edge?: EdgeException[];
  /** PE-009 class fixtures: PDF bodies with the exact spaces the class check finds (see pdfWordGapClass). */
  pdf?: PdfWordGap[];
  /**
   * Conversion eval twins that differ from the Go intake tool's body for the
   * same eval file (test/fixtures/go-seed/intake-eval-goldens.json), with the
   * exact allowed TypeScript body. See test/intake-eval-parity.test.ts.
   */
  eval?: EvalException[];
  /**
   * Cases of test/intake-hostile.test.ts that differ from Go (PE-013
   * preflight cases, PE-015), with the exact allowed TypeScript result.
   * That test checks them.
   */
  hostile?: HostileException[];
  /** A platform exception class (for example PE-005): its name, operating system, golden rule, and cases. */
  class?: string;
  platform?: string;
  rule?: string;
  cases?: PlatformExceptionCase[];
  /**
   * PE-014: test/design.test.ts promotion-rollback cases (by test title) where
   * Go's end state after an injected failure differs from the start state
   * that the port restores (`allowed`).
   */
  design_rollback?: { case: string; go_end_state: string; allowed: string }[];
  /**
   * PE-016: the one stderr line a legacy command name writes first (PRD 20
   * Legacy Command Names), by invocation name, with its newline. See
   * stripLegacyNotice.
   */
  legacy_notice?: Record<string, string>;
  /**
   * PE-023: the printed fix commands (owner decision 2026-11-26, F-P8-11 and
   * F-P8-10). Each form names Go's text, the text the port prints, and the
   * exact cases where the form occurs. See applyPrintedCommands.
   */
  printed_command?: PrintedCommandClass;
  /** W1 R7 P9 (PE-021, approved 2026-11-25): the .xlsx content rule of the skill-script parity test: its helper, goldens, and test. */
  xlsx?: { helper: string; goldens: string; test: string };
}

/** The PE-016 notice line for `invocation`, or `undefined` when it has none. */
export function legacyNoticeLine(invocation: string, exceptions: ExceptionsFile): string | undefined {
  for (const e of exceptions.exceptions) {
    const line = e.legacy_notice?.[invocation];
    if (line !== undefined) return line;
  }
  return undefined;
}

/**
 * PE-016: a run under a legacy name must write exactly the recorded notice
 * line first on stderr. The line is removed once, and the rest of stderr is
 * compared byte for byte as before. A run under `buildos` has no line. A
 * missing or different line is a problem, so the exception cannot go stale
 * or grow unseen.
 */
export function stripLegacyNotice(invocation: string, stderr: Buffer, exceptions: ExceptionsFile): { stderr: Buffer; problem?: string } {
  const line = legacyNoticeLine(invocation, exceptions);
  if (line === undefined) return { stderr };
  const expected = Buffer.from(line, "utf8");
  if (stderr.length < expected.length || !stderr.subarray(0, expected.length).equals(expected)) {
    return { stderr, problem: `PE-016: stderr under ${invocation} must start with exactly ${JSON.stringify(line)}; got ${JSON.stringify(stderr.subarray(0, expected.length + 40).toString("utf8"))}` };
  }
  return { stderr: Buffer.from(stderr.subarray(expected.length)) };
}

/**
 * One case of a platform exception class: Go's output on `platform` has a
 * known defect. `go_observation_sha256` (observationDigest) identifies the
 * complete defect observation; `go_exit` and `go_text` in `go_stream`
 * describe it for readers. The parity target there is `win32_golden`: the
 * shared golden (`shared`), or a golden derived from the `source` folder
 * (see deriveGolden).
 */
export interface PlatformExceptionCase {
  case: string;
  go_exit: number;
  go_stream: "stdout" | "stderr";
  go_text: string;
  /** observationDigest of the complete normalized Go defect observation on the platform. */
  go_observation_sha256: string;
  /** Where the digest comes from (the capture run and artifact folder), and what confirms it. */
  go_observation_evidence: string;
  win32_golden: { source: string; windows_text?: WindowsText[] };
}

/**
 * One Windows-only text that legitimately differs, with the evidence for it.
 * `raw` replaces text in the stream as printed (before the JSON strings are
 * decoded); `json-string` (the default) replaces text inside each decoded
 * JSON string, or in the whole text of a stream that is not JSON.
 */
export interface WindowsText {
  scope?: "raw" | "json-string";
  from: string;
  to: string;
  evidence: string;
}

export type SeedField = "exit" | "stdout" | "stderr";

export interface SeedException {
  args: string[];
  /** The exact TypeScript value of each field that may differ from Go. Every other field must equal Go. */
  allowed: { exit?: number; stdout?: string; stderr?: string };
}

export interface SeedResult {
  exit: number;
  stdout: string;
  stderr: string;
}

/**
 * Checks one Go seed case that has a parity exception. Each field in
 * `allowed` must equal its exact allowed value and must still differ from
 * Go (else the exception is stale). Every other field must equal Go.
 * Returns the problems.
 */
export function seedExceptionProblems(id: string, go: SeedResult, actual: SeedResult, allowed: SeedException["allowed"]): string[] {
  const problems: string[] = [];
  for (const field of ["exit", "stdout", "stderr"] as const) {
    const show = (v: string | number) => JSON.stringify(v);
    if (Object.hasOwn(allowed, field)) {
      const value = allowed[field];
      if (actual[field] !== value) problems.push(`${id}: ${field} is ${show(actual[field])}, but the exception allows exactly ${show(value as string | number)}`);
      else if (go[field] === value) problems.push(`${id}: ${field} now equals Go; remove it from the exception`);
    } else if (actual[field] !== go[field]) {
      problems.push(`${id}: ${field} is ${show(actual[field])}, Go is ${show(go[field])}, and the exception does not allow a difference in ${field}`);
    }
  }
  return problems;
}

/**
 * One conversion eval twin that may differ from Go's: `actual` is the exact
 * TypeScript body, and Go's body must equal it with each of `added_blocks`
 * (a Markdown block and the blank line after it) removed once.
 */
export interface EvalException {
  file: string;
  part: string;
  added_blocks: string[];
  actual: string;
}

export type EdgeField = "exit" | "stdout" | "stderr" | "tree";

/** One field of an entity edge case that may differ from Go, with its exact allowed TypeScript value as text. */
export interface EdgeException {
  case: string;
  field: EdgeField;
  /** `exit`: the decimal exit code; `stdout` and `stderr`: the normalized text; `tree`: `JSON.stringify` of the normalized file-tree snapshot. */
  actual: string;
}

/** The normalized result of one entity edge case (see scripts/capture-entity-edge-goldens.ts). */
export interface EdgeResult {
  exit: number;
  stdout: string;
  stderr: string;
  tree: Record<string, string>;
}

const edgeFieldText = (r: EdgeResult, field: EdgeField): string => (field === "exit" ? String(r.exit) : field === "tree" ? JSON.stringify(r.tree) : r[field]);

/**
 * Checks one entity edge case against its Go golden and the `edge` entries
 * of the parity exceptions. A case with no entry must equal Go in every
 * field. A case with entries must name exactly one exception (`id`), each
 * entry's field must equal its exact allowed value and must still differ
 * from Go (else the exception is stale), and every other field must equal
 * Go. Returns the problems.
 */
export function edgeExceptionProblems(caseName: string, id: string | undefined, go: EdgeResult, actual: EdgeResult, exceptions: ExceptionsFile, key: "edge" | "intake_edge" = "edge"): string[] {
  const entries = exceptions.exceptions.flatMap((e) => (e[key] ?? []).filter((x) => x.case === caseName).map((entry) => ({ id: e.id, entry })));
  const problems: string[] = [];
  const ids = [...new Set(entries.map((x) => x.id))];
  if (id === undefined && ids.length > 0) problems.push(`${caseName}: ${ids.join(", ")} lists the case, but the case names no exception`);
  if (id !== undefined && (ids.length !== 1 || ids[0] !== id)) problems.push(`${caseName}: the case names ${id}, but parity-exceptions.json lists it under ${ids.length === 0 ? "no exception" : ids.join(", ")}`);
  const show = (text: string) => JSON.stringify(text.length > 400 ? `${text.slice(0, 400)}...` : text);
  for (const field of ["exit", "stdout", "stderr", "tree"] as const) {
    const ours = edgeFieldText(actual, field);
    const theirs = edgeFieldText(go, field);
    const match = entries.filter((x) => x.entry.field === field);
    if (match.length > 1) problems.push(`${caseName}: more than one exception entry for ${field}`);
    const entry = match[0];
    if (entry === undefined) {
      if (ours !== theirs) problems.push(`${caseName}: ${field} is ${show(ours)}, Go is ${show(theirs)}, and no exception allows a difference in ${field}`);
    } else if (ours !== entry.entry.actual) {
      problems.push(`${caseName}: ${field} is ${show(ours)}, but ${entry.id} allows exactly ${show(entry.entry.actual)}`);
    } else if (theirs === entry.entry.actual) {
      problems.push(`${caseName}: ${field} now equals Go; remove it from ${entry.id}`);
    }
  }
  return problems;
}

export interface ExceptionsFile {
  exceptions: ParityException[];
}

export function loadExceptions(root = GOLDEN_ROOT): ExceptionsFile {
  return JSON.parse(readFileSync(join(root, "parity-exceptions.json"), "utf8")) as ExceptionsFile;
}

/**
 * Proposed parity exceptions (test/golden/proposed-exceptions.json): each
 * waits for an owner decision and is not approved. The harness still holds
 * each one to its exact pinned value, so the difference cannot change or
 * grow unseen, and the summary lists every case it covers as pending.
 */
export interface ProposedException {
  id: string;
  status: "pending owner decision";
  summary: string;
  reason: string;
  /** Golden fields with their exact TypeScript value, as `golden` in parity-exceptions.json. */
  golden: GoldenException[];
  /** PDF bodies whose text may differ from Go's only by the listed inserted spaces. See pdfWordGapProblems. */
  pdf?: PdfWordGap[];
  /** Cases of test/intake-hostile.test.ts that differ from Go, with the exact allowed TypeScript result. That test checks them. */
  hostile?: HostileException[];
  /** The .xlsx content rule of the skill-script parity test, as `xlsx` in parity-exceptions.json (PE-021 was proposed with it). */
  xlsx?: { helper: string; goldens: string; test: string };
}

/**
 * One hostile-input case that differs from Go. `go` records Go's observed
 * result for readers (CI has no Go tool); `allowed` is the exact TypeScript
 * exit code, stdout, and stderr, where `{PROJECT}` stands for the project
 * folder. The port writes no file. Go writes none either (PE-015), or
 * writes the side artifact that `go.outcome` names (PE-013).
 */
export interface HostileException {
  case: string;
  go: { exit: number | null; outcome: string; stderr_first_line: string };
  allowed: { exit: number; stdout: string; stderr: string };
}

/**
 * A PE-009 fixture (the class is approved 2026-11-23; see pdfWordGapClass).
 * The class check applies to every PDF comparison with Go; a fixture also
 * records, as a regression check, the exact offsets in Go's body after
 * normalizePdfWhitespace where the class check finds one added space.
 * `context` shows each spot for readers (`Go|TypeScript`).
 */
export interface PdfWordGap {
  /** `eval:<eval file id>` or `fixture:<name>` (a PDF built by the test). */
  source: string;
  part: string;
  inserted_spaces: number[];
  context: string[];
}

export interface ProposedFile {
  proposed: ProposedException[];
}

export function loadProposed(root = GOLDEN_ROOT): ProposedFile {
  return JSON.parse(readFileSync(join(root, "proposed-exceptions.json"), "utf8")) as ProposedFile;
}

/** The mark `pdfSeparations` puts where the PDF draws two runs as separate words. */
const SEPARATION = "\u0001";

/**
 * How the PDF renders its words, from its text runs (pdf.js, as the port
 * reads them), computed here and not taken from the port's output: the runs
 * in content-stream order, after normalizePdfWhitespace. A space inside a
 * run is one pdf.js renders: a space character, or a word gap that a `TJ`
 * offset or a glyph position draws. Between two runs, SEPARATION (U+0001)
 * marks where the PDF draws them as separate words and neither run brings
 * its own white space: the second run starts a new line (the baseline moves
 * by more than half the larger font size), starts a new page, or starts
 * more than 0.15 of its font size to the right of the end of the first.
 */
export function pdfSeparations(pages: readonly (readonly PdfTextItem[])[]): string {
  let raw = "";
  let previous: PdfTextItem | undefined;
  for (const page of pages) {
    let last: PdfTextItem | undefined;
    for (const item of page) {
      if (item.str === "") continue;
      if (previous !== undefined) {
        const newLine = last === undefined || Math.abs(item.y - last.y) > Math.max(item.size, last.size) * 0.5;
        const gap = !newLine && item.x - (last!.x + last!.width) > item.size * 0.15;
        if (newLine || gap) raw += SEPARATION;
      }
      raw += item.str;
      last = item;
      previous = item;
    }
  }
  // A white-space run that holds real white space stays one space (Go has
  // it too); a run of only separations stays one separation.
  return raw
    .replace(/[\s\u0001]+/g, (run) => (/\s/.test(run) ? " " : SEPARATION))
    .replace(/^[ \u0001]+|[ \u0001]+$/g, "");
}

/**
 * The PE-009 class check (approved 2026-11-23): the port's PDF text may
 * differ from Go's only by spaces between words that Go ran together. Both
 * texts are compared after normalizePdfWhitespace. They must be identical
 * after removing, from the port's text, only single spaces that sit at
 * positions where Go has two adjacent non-space characters that the PDF
 * renders as separate words: a space pdf.js renders inside a run, or a
 * SEPARATION between runs (see pdfSeparations). No other character may
 * differ, and the port may never drop a space Go has. So that the port
 * cannot add a space the PDF does not render, its text must equal the
 * PDF's runs with one space at each SEPARATION. Returns the problems and
 * `removed`, the offsets in Go's normalized text where the port has one
 * more space.
 */
export function pdfWordGapClass(go: string, ours: string, separations: string): { problems: string[]; removed: number[] } {
  const a = normalizePdfWhitespace(go);
  const b = normalizePdfWhitespace(ours);
  const problems: string[] = [];
  const removed: number[] = [];
  const spaced = separations.replaceAll(SEPARATION, " ");
  if (spaced !== b) {
    let at = 0;
    while (at < b.length && b[at] === spaced[at]) at++;
    problems.push(`PE-009: the port's text is not the PDF's runs with one space at each word separation, from offset ${at}: ${JSON.stringify(b.slice(at, at + 24))} against ${JSON.stringify(spaced.slice(at, at + 24))}`);
    return { problems, removed };
  }
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    // The port's text equals the PDF's rendering (checked above), so this
    // space is one the PDF renders: a space in a run, or a SEPARATION.
    const rendered = separations[j] === SEPARATION || separations[j] === " ";
    const removable = j < b.length && b[j] === " " && rendered && i > 0 && i < a.length && a[i - 1] !== " " && a[i] !== " ";
    if (removable) {
      removed.push(i);
      j++;
      continue;
    }
    problems.push(`PE-009: Go ${JSON.stringify(a.slice(Math.max(0, i - 12), i + 12))} and the port ${JSON.stringify(b.slice(Math.max(0, j - 12), j + 12))} differ at Go offset ${i} by more than a space between words that Go ran together`);
    return { problems, removed };
  }
  return { problems, removed };
}

/** Checks one PE-009 fixture: the class check passes and removes exactly the fixture's spaces. */
export function pdfWordGapProblems(id: string, entry: PdfWordGap, go: string, ours: string, separations: string): string[] {
  const { problems, removed } = pdfWordGapClass(go, ours, separations);
  if (problems.length > 0) return problems.map((p) => `${id}: ${entry.source} ${entry.part}: ${p}`);
  if (JSON.stringify(removed) !== JSON.stringify(entry.inserted_spaces)) {
    return [`${id}: ${entry.source} ${entry.part} adds spaces at ${JSON.stringify(removed)}, but the fixture records ${JSON.stringify(entry.inserted_spaces)}`];
  }
  return [];
}

/** The `Go|TypeScript` context of each inserted space, for a PdfWordGap entry. */
export function wordGapContext(go: string, spaces: readonly number[]): string[] {
  const a = normalizePdfWhitespace(go);
  return spaces.map((at) => `${a.slice(Math.max(0, at - 12), at)}|${a.slice(at, at + 12)}`);
}

export interface Verdict {
  /** Differences with no exception, or whose actual value is not the allowed one. */
  unexplained: Difference[];
  /** Exception entries that no longer match a real difference. */
  stale: { id: string; case: string; field: string }[];
  /** Differences covered by an exception. */
  allowed: { id: string; diff: Difference }[];
  /** Differences covered by a proposed exception that waits for an owner decision (also exact). */
  pending: { id: string; diff: Difference }[];
}

/**
 * Applies the exceptions to the differences of one enforced case, on
 * `platform` (default: this one). Entries of `proposed` exceptions match
 * the same way, exactly, but land in `pending`, not `allowed`.
 */
export function judge(testCase: GoldenCase, diffs: Difference[], exceptions: ExceptionsFile, platform: string = process.platform, proposed: ProposedFile = { proposed: [] }): Verdict {
  const pendingIds = new Set(proposed.proposed.map((p) => p.id));
  const entries = [...exceptions.exceptions, ...proposed.proposed].flatMap((e) =>
    e.golden.filter((g) => g.case === testCase.id && (g.platform === undefined || g.platform === platform)).map((g) => ({ id: e.id, entry: g })),
  );
  const verdict: Verdict = { unexplained: [], stale: [], allowed: [], pending: [] };
  for (const diff of diffs) {
    const match = entries.find((x) => x.entry.field === diff.field);
    if (match === undefined) {
      verdict.unexplained.push(diff);
    } else if (match.entry.actual === null || match.entry.actual !== diff.actual) {
      verdict.unexplained.push({ ...diff, detail: `${diff.detail}; ${match.id} allows a different exact value for this field` });
    } else if (pendingIds.has(match.id)) {
      verdict.pending.push({ id: match.id, diff });
    } else {
      verdict.allowed.push({ id: match.id, diff });
    }
  }
  for (const { id, entry } of entries) {
    if (!diffs.some((d) => d.field === entry.field)) verdict.stale.push({ id, case: entry.case, field: entry.field });
  }
  return verdict;
}

// ---------------------------------------------------------------- Platform exception classes

/** The platform exception case entries for `platform`, by case ID. Sourced only from parity-exceptions.json. */
export function platformExceptionCases(exceptions: ExceptionsFile, platform: string): Map<string, { id: string; entry: PlatformExceptionCase }> {
  const out = new Map<string, { id: string; entry: PlatformExceptionCase }>();
  for (const e of exceptions.exceptions) {
    if (e.platform !== platform || e.cases === undefined) continue;
    for (const entry of e.cases) out.set(entry.case, { id: e.id, entry });
  }
  return out;
}

/** The record of one case that a capture skipped under a platform exception class. */
export interface ParityExceptionSkip {
  case: string;
  /** `<exception id, lower case>-skipped`, for example pe-005-skipped. */
  kind: string;
  exception: string;
  go_exit: number;
  manifest_exit: number;
  /** The golden this operating system uses instead: `shared`, or the derived golden's path. */
  golden: string;
  /** observationDigest of the skipped Go observation; equals the entry's go_observation_sha256. */
  observation_sha256: string;
}

const byKey = <T>(entries: [string, T][]) => entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * SHA-256 of one complete normalized observation: the exit code, the SHA-256
 * of the full normalized stdout and stderr, and the normalized filesystem
 * snapshot of changes (added, changed, and removed entries in order, the
 * SHA-256 of every added or changed file, every link target, and the
 * permission bits, or null where the operating system has none). It is the
 * SHA-256 of the JSON text of
 * `{exit, stdout_sha256, stderr_sha256, added, changed, removed, files, links, modes}`,
 * with `files`, `links`, and `modes` as `[path, value]` pairs sorted by path.
 */
export function observationDigest(observation: Observation): string {
  const canonical = {
    exit: observation.exit,
    stdout_sha256: sha256(observation.stdout),
    stderr_sha256: sha256(observation.stderr),
    added: observation.added.map((c) => [c.path, c.kind]),
    changed: observation.changed.map((c) => [c.path, c.kind]),
    removed: observation.removed.map((c) => [c.path, c.kind]),
    files: byKey([...observation.files].map(([path, data]): [string, string] => [path, sha256(data)])),
    links: byKey([...(observation.links ?? new Map<string, string>())]),
    modes: observation.modes === undefined ? null : byKey([...observation.modes]),
  };
  return sha256(Buffer.from(JSON.stringify(canonical)));
}

/** observationDigest of the observation stored in one golden folder (for example a capture artifact's). */
export function goldenObservationDigest(dir: string): string {
  return observationDigest(readGoldenDir(dir));
}

/**
 * capture.mjs: decides whether Go's output for a case on `platform` is the
 * known defect of a platform exception class. Only an exact match of the
 * complete observation (observationDigest equal to the entry's
 * go_observation_sha256) is skipped (no golden written or compared, no exit
 * mismatch). Any other output of a listed case is a mismatch
 * (parityExceptionMismatch) and fails the capture.
 */
export function parityExceptionSkip(testCase: GoldenCase, observation: Observation, platform: string, exceptions: ExceptionsFile): ParityExceptionSkip | undefined {
  const match = platformExceptionCases(exceptions, platform).get(testCase.id);
  if (match === undefined) return undefined;
  const { id, entry } = match;
  const digest = observationDigest(observation);
  if (!SHA256_HEX.test(entry.go_observation_sha256 ?? "") || digest !== entry.go_observation_sha256) return undefined;
  return { case: testCase.id, kind: `${id.toLowerCase()}-skipped`, exception: id, go_exit: observation.exit, manifest_exit: testCase.exit, golden: parityExceptionGolden(testCase, entry, platform), observation_sha256: digest };
}

/**
 * capture.mjs: for a case that a platform exception class lists for
 * `platform` but whose observation is not the exact recorded defect, the
 * problem text. Undefined for an unlisted case or an exact match.
 */
export function parityExceptionMismatch(testCase: GoldenCase, observation: Observation, platform: string, exceptions: ExceptionsFile): string | undefined {
  const match = platformExceptionCases(exceptions, platform).get(testCase.id);
  if (match === undefined || parityExceptionSkip(testCase, observation, platform, exceptions) !== undefined) return undefined;
  return `${testCase.id}: ${match.id} lists this case for ${platform}, but Go's observation (exit ${observation.exit}, observation SHA-256 ${observationDigest(observation)}) is not the recorded defect (${match.entry.go_observation_sha256}); review the output and update ${match.id} (see CAPTURE.md)`;
}

/** The golden a platform uses for a platform exception case: `shared`, or the derived golden's path. */
function parityExceptionGolden(testCase: GoldenCase, entry: PlatformExceptionCase, platform: string): string {
  return entry.win32_golden.source === "shared" ? "shared" : relative(GOLDEN_ROOT, osGoldenDir(testCase, platform)).split(sep).join("/");
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const ZERO_SHA256 = "0".repeat(64);

/** The derived mark in a golden folder's result.json, if any. */
export function readDerived(dir: string): DerivedMark | undefined {
  try {
    return (JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) as ResultFile).derived;
  } catch {
    return undefined;
  }
}

/** True when a platform exception class at `root` lists the case with a derived golden for `platform`. */
export function derivedGoldenAllowed(testCase: GoldenCase, platform: string, derived: DerivedMark, root = GOLDEN_ROOT): boolean {
  if (!statIsFile(join(root, "parity-exceptions.json"))) return false;
  const match = platformExceptionCases(loadExceptions(root), platform).get(testCase.id);
  return match !== undefined && match.id === derived.exception && match.entry.win32_golden.source !== "shared" && match.entry.win32_golden.source === derived.source;
}

/** SHA-256 of a golden folder: of the sorted `<path> <SHA-256>\n` lines of its files. */
export function goldenDirDigest(dir: string): string {
  return sha256(Buffer.from(listGoldenFiles(dir).map((rel) => `${rel} ${sha256(readFileSync(join(dir, ...rel.split("/"))))}\n`).join("")));
}

/**
 * Windows path spelling (PE-005 rule): every `{ROOT}` followed by
 * `/`-separated segments gets `\` separators, or `\\` when the `{ROOT}`
 * directly follows a `"` (a Go %q string, which doubles each `\`).
 */
export function windowsPathSpelling(text: string): string {
  return text.replace(/(")?\{ROOT\}((?:\/[^/\s"':]+)+)/g, (_m, quote: string | undefined, suffix: string) =>
    `${quote ?? ""}{ROOT}${suffix.split("/").join(quote === undefined ? "\\" : "\\\\")}`,
  );
}

/**
 * Makes the derived win32 golden of a platform exception case from its
 * committed source golden: Windows path spelling (after each `windows_text`
 * replacement) in stdout and stderr, each JSON string decoded first and
 * encoded again with Go's escaping; `modes` dropped; every other byte, file,
 * and tree entry as captured. A source under os/linux/ must equal the darwin
 * golden of the case, so the target is the Linux and macOS result. Throws on
 * anything it cannot derive exactly.
 */
export function deriveGolden(testCase: GoldenCase, exceptionId: string, entry: PlatformExceptionCase, root = GOLDEN_ROOT): { observation: Observation; derived: DerivedMark } {
  const source = entry.win32_golden.source;
  if (source === "shared") throw new Error(`${testCase.id}: the shared golden is used as is; nothing to derive`);
  const sourceDir = join(root, ...source.split("/"));
  if (!hasGoldenDir(sourceDir)) throw new Error(`${testCase.id}: source golden ${source} is missing`);
  if (source !== relative(root, osGoldenDir(testCase, "linux", root)).split(sep).join("/")) {
    throw new Error(`${testCase.id}: the source must be the linux golden of the case, not ${source}`);
  }
  const darwin = osGoldenDir(testCase, "darwin", root);
  if (!hasGoldenDir(darwin) || !sameGoldenDirs(sourceDir, darwin)) throw new Error(`${testCase.id}: the linux and darwin goldens differ, so there is no single Linux/macOS result`);
  const golden = readGoldenDir(sourceDir);
  const replacements = (entry.win32_golden.windows_text ?? []).map((w) => ({ ...w, count: 0 }));
  const replace = (text: string, scope: "raw" | "json-string") => {
    let out = text;
    for (const r of replacements) {
      if ((r.scope ?? "json-string") !== scope) continue;
      const parts = out.split(r.from);
      r.count += parts.length - 1;
      out = parts.join(r.to);
    }
    return out;
  };
  const transform = (text: string) => windowsPathSpelling(replace(text, "json-string"));
  const transformStream = (data: Buffer, json: boolean) => {
    const text = replace(data.toString("utf8"), "raw");
    if (!json) return Buffer.from(transform(text));
    return Buffer.from(
      text.replace(JSON_STRING, (token) => {
        const value = JSON.parse(token) as string;
        const next = transform(value);
        if (next === value) return token;
        if (`"${goJsonEscape(value)}"` !== token) throw new Error(`${testCase.id}: JSON string ${token} is not in Go encoding/json form`);
        return `"${goJsonEscape(next)}"`;
      }),
    );
  };
  const stdout = transformStream(golden.stdout, testCase.json === true);
  const stderr = transformStream(golden.stderr, false);
  for (const r of replacements) {
    if (r.count !== 1) throw new Error(`${testCase.id}: windows_text ${JSON.stringify(r.from)} must occur exactly once in the source golden, found ${r.count}`);
  }
  if (testCase.json === true) JSON.parse(stdout.toString("utf8"));
  const { modes: _modes, ...rest } = golden;
  return {
    observation: { ...rest, stdout, stderr },
    derived: { exception: exceptionId, source, source_sha256: goldenDirDigest(sourceDir) },
  };
}

/** Writes every derived golden of the platform exception classes into os/<platform>/ under `outRoot`. Returns their paths. */
export function writeDerivedGoldens(manifest: Manifest, exceptions: ExceptionsFile, options: { root?: string; outRoot?: string } = {}): string[] {
  const root = options.root ?? GOLDEN_ROOT;
  const outRoot = options.outRoot ?? root;
  const written: string[] = [];
  for (const e of exceptions.exceptions) {
    if (e.platform === undefined || e.cases === undefined) continue;
    for (const entry of e.cases) {
      if (entry.win32_golden.source === "shared") continue;
      const testCase = manifest.cases.find((c) => c.id === entry.case);
      if (testCase === undefined) throw new Error(`${e.id} names unknown case ${entry.case}`);
      const { observation, derived } = deriveGolden(testCase, e.id, entry, root);
      const dir = osGoldenDir(testCase, e.platform, outRoot);
      writeGolden(testCase, observation, dir, derived);
      written.push(relative(outRoot, dir).split(sep).join("/"));
    }
  }
  return written;
}

/** One derived golden of an OS set, for the capture record. */
export interface DerivedGoldenRecord {
  case: string;
  path: string;
  derived: string;
  source: string;
  source_sha256: string;
  /** goldenDirDigest of the derived golden folder. */
  sha256: string;
}

/** Every derived golden in os/<platform>/, for the capture record. */
export function derivedGoldenRecords(manifest: Manifest, platform: string, root = GOLDEN_ROOT): DerivedGoldenRecord[] {
  const out: DerivedGoldenRecord[] = [];
  for (const c of manifest.cases) {
    const dir = osGoldenDir(c, platform, root);
    const mark = readDerived(dir);
    if (mark === undefined) continue;
    out.push({ case: c.id, path: relative(root, dir).split(sep).join("/"), derived: mark.exception, source: mark.source, source_sha256: mark.source_sha256, sha256: goldenDirDigest(dir) });
  }
  return out;
}

/**
 * Checks the derived goldens and the platform exception classes: a derived
 * golden only for a listed case, in its platform's set, and byte-identical
 * to a fresh derivation from its source; every listed derived golden
 * present; a `shared` case not OS-dependent. Returns the problems.
 */
export function derivedGoldenProblems(manifest: Manifest, exceptions: ExceptionsFile, root = GOLDEN_ROOT): string[] {
  const problems: string[] = [];
  const ids = new Set(manifest.cases.map((c) => c.id));
  for (const c of manifest.cases) {
    for (const set of [{ platform: undefined as string | undefined, dir: goldenDir(c, root) }, ...GOLDEN_PLATFORMS.map((p) => ({ platform: p as string | undefined, dir: osGoldenDir(c, p, root) }))]) {
      const mark = readDerived(set.dir);
      if (mark === undefined) continue;
      const where = relative(root, set.dir).split(sep).join("/");
      if (set.platform === undefined || !derivedGoldenAllowed(c, set.platform, mark, root)) {
        problems.push(`${c.id}: derived golden ${where} (${mark.exception}) is not allowed: no platform exception class lists this case with a derived golden for this set`);
      }
    }
  }
  const scratch = mkdtempSync(join(tmpdir(), "buildos-golden-derive-"));
  try {
    for (const e of exceptions.exceptions) {
      if (e.cases === undefined) continue;
      if (e.platform !== "win32") problems.push(`${e.id}: a platform exception class needs platform win32 (the only derivation rule is Windows path spelling)`);
      for (const entry of e.cases) {
        const testCase = manifest.cases.find((c) => c.id === entry.case);
        if (!ids.has(entry.case) || testCase === undefined) {
          problems.push(`${e.id} names unknown case ${entry.case}`);
          continue;
        }
        if (!SHA256_HEX.test(entry.go_observation_sha256 ?? "") || entry.go_observation_sha256 === ZERO_SHA256) {
          problems.push(`${e.id}: ${entry.case} needs go_observation_sha256, the observationDigest of the real Go defect observation (see CAPTURE.md)`);
        }
        if (typeof entry.go_observation_evidence !== "string" || entry.go_observation_evidence === "") {
          problems.push(`${e.id}: ${entry.case} needs go_observation_evidence naming the capture run and artifact folder of the digest`);
        }
        if (entry.win32_golden.source === "shared") {
          if (testCase.os_dependent !== undefined) problems.push(`${e.id}: ${entry.case} is OS-dependent, so it has no shared golden to use on ${e.platform}`);
          continue;
        }
        const committed = osGoldenDir(testCase, e.platform ?? "win32", root);
        if (!hasGoldenDir(committed)) {
          problems.push(`${e.id}: ${entry.case} has no derived golden ${relative(root, committed).split(sep).join("/")}; run node test/golden/capture.mjs --derive`);
          continue;
        }
        try {
          const { observation, derived } = deriveGolden(testCase, e.id, entry, root);
          const fresh = osGoldenDir(testCase, e.platform ?? "win32", scratch);
          writeGolden(testCase, observation, fresh, derived);
          if (!sameGoldenDirs(committed, fresh)) problems.push(`${e.id}: ${entry.case}: the committed derived golden differs from a fresh derivation; run node test/golden/capture.mjs --derive`);
        } catch (error) {
          problems.push(`${e.id}: ${(error as Error).message}`);
        }
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return problems;
}

export function describeVerdict(verdict: Verdict): string {
  const lines = [
    ...verdict.unexplained.map((d) => `golden case ${d.case}, field ${d.field}: ${d.detail}`),
    ...verdict.stale.map((s) => `golden case ${s.case}, field ${s.field}: parity exception ${s.id} no longer matches a real difference; remove it`),
  ];
  return lines.join("\n");
}

/** Reads a file under the golden root, or returns undefined. */
export function statIsFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- Capture decisions

/** One change a capture found against the committed goldens. */
export interface CaptureDrift {
  case: string;
  /**
   * shared-drift: a case that is not OS-dependent printed output on this
   * operating system that differs from the shared golden (or has none).
   * changed-os-golden: an existing golden of this operating system differs
   * from the fresh capture. changed-shared-golden: --write-shared would
   * replace an existing shared golden with different bytes.
   * removed-stale: a stale golden folder (see findStaleGoldens) was removed;
   * `path` and `reason` name it. This includes this operating system's own
   * golden of a shared case that planCapture removes (the fresh capture
   * equals the shared golden, or --write-shared rewrites it).
   */
  kind: "shared-drift" | "changed-os-golden" | "changed-shared-golden" | "removed-stale";
  /** For removed-stale: the removed folder, relative to the golden root, `/`-separated. */
  path?: string;
  /** For removed-stale: why the folder was stale. */
  reason?: StaleReason;
}

export interface CapturePlan {
  /** Where the fresh capture goes. */
  write: "own" | "shared" | "none";
  removeOwn: boolean;
  drift: CaptureDrift[];
}

export interface CaptureOptions {
  platform: string;
  writeShared: boolean;
  /** The golden root to compare with (default: the committed goldens). */
  root?: string;
}

/**
 * Decides what one capture does with a case, comparing the fresh capture
 * (`freshDir`) with every existing golden it would replace or remove before
 * anything is written. Any changed existing golden is listed as drift.
 */
export function planCapture(testCase: GoldenCase, freshDir: string, options: CaptureOptions): CapturePlan {
  const root = options.root ?? GOLDEN_ROOT;
  const ignoreModes = options.platform === "win32";
  const same = (dir: string) => sameGoldenDirs(dir, freshDir, { ignoreModes });
  const shared = goldenDir(testCase, root);
  const own = osGoldenDir(testCase, options.platform, root);
  // Any existing folder counts, complete or not: an incomplete golden (for
  // example without result.json) differs from the fresh capture, so
  // replacing it is drift.
  const hasShared = goldenDirExists(shared);
  const hasOwn = goldenDirExists(own);
  const drift: CaptureDrift[] = [];
  const add = (kind: CaptureDrift["kind"]) => drift.push({ case: testCase.id, kind });
  // This system's own golden of a shared case is stale (findStaleGoldens):
  // record its removal with its path and reason, like every other one.
  const removeOwnStale = () =>
    drift.push({ case: testCase.id, kind: "removed-stale", path: relative(root, own).split(sep).join("/"), reason: "os-golden-for-shared-case" });
  if (testCase.os_dependent !== undefined) {
    // A shared golden of an OS-dependent case is stale; removeStaleGoldens
    // removes and records it after every case has run.
    if (hasOwn && !same(own)) add("changed-os-golden");
    return { write: "own", removeOwn: false, drift };
  }
  if (options.writeShared) {
    if (hasShared && !same(shared)) add("changed-shared-golden");
    if (hasOwn) removeOwnStale();
    return { write: "shared", removeOwn: hasOwn, drift };
  }
  if (hasShared && same(shared)) {
    if (hasOwn) removeOwnStale();
    return { write: "none", removeOwn: hasOwn, drift };
  }
  add("shared-drift");
  if (hasOwn && !same(own)) add("changed-os-golden");
  return { write: "own", removeOwn: false, drift };
}

// ---------------------------------------------------------------- Stale goldens

/** The tools that have golden folders (one folder per tool in each golden set). */
export const GOLDEN_TOOLS = ["buildos", "buildos-intake", "buildos-discovery", "buildos-design"] as const;

/**
 * shared-golden-for-os-dependent-case: `<tool>/<id>/` exists, but the case
 * is OS-dependent, so no operating system ever reads it.
 * os-golden-for-shared-case: `os/<platform>/<tool>/<id>/` exists, but the
 * case is not OS-dependent, so it must use the shared golden.
 * case-not-in-manifest: the folder names no case in cases.json.
 */
export type StaleReason = "shared-golden-for-os-dependent-case" | "os-golden-for-shared-case" | "case-not-in-manifest";

export interface StaleGolden {
  /** The case ID the folder is named after. */
  case: string;
  /** The folder, relative to the golden root, `/`-separated. */
  path: string;
  reason: StaleReason;
}

const STALE_TEXT: Record<StaleReason, string> = {
  "shared-golden-for-os-dependent-case": "shared golden of an OS-dependent case (an OS-dependent case never reads the shared set)",
  "os-golden-for-shared-case": "OS golden of a case that is not OS-dependent (a shared case reads the shared golden)",
  "case-not-in-manifest": "golden folder of a case that is not in cases.json",
};

/**
 * Every stale golden folder under `root`, complete or not, sorted by path.
 * With `keepOwnOf`, an OS golden of that operating system for a shared
 * case is not listed: during a capture, planCapture already decided (and
 * recorded) what happens to it.
 */
export function findStaleGoldens(manifest: Manifest, options: { root?: string; keepOwnOf?: string } = {}): StaleGolden[] {
  const root = options.root ?? GOLDEN_ROOT;
  const cases = new Map(manifest.cases.map((c) => [`${c.tool}/${c.id}`, c]));
  const stale: StaleGolden[] = [];
  const sets: { platform?: string; dir: string }[] = [{ dir: root }, ...GOLDEN_PLATFORMS.map((p) => ({ platform: p, dir: osGoldenRoot(p, root) }))];
  for (const set of sets) {
    for (const tool of GOLDEN_TOOLS) {
      const toolDir = join(set.dir, tool);
      if (!existsSync(toolDir)) continue;
      for (const entry of readdirSync(toolDir).sort()) {
        const path = relative(root, join(toolDir, entry)).split(sep).join("/");
        const testCase = cases.get(`${tool}/${entry}`);
        let reason: StaleReason | undefined;
        if (testCase === undefined) reason = "case-not-in-manifest";
        else if (set.platform === undefined && testCase.os_dependent !== undefined) reason = "shared-golden-for-os-dependent-case";
        else if (set.platform !== undefined && testCase.os_dependent === undefined && set.platform !== options.keepOwnOf) reason = "os-golden-for-shared-case";
        if (reason !== undefined) stale.push({ case: entry, path, reason });
      }
    }
  }
  return stale.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** `capture.mjs --check`: one problem line per stale golden folder. */
export function staleGoldenProblems(manifest: Manifest, root = GOLDEN_ROOT): string[] {
  return findStaleGoldens(manifest, { root }).map((s) => `${s.case}: stale golden folder ${s.path}: ${STALE_TEXT[s.reason]}`);
}

/**
 * Capture (with or without --report): removes every stale golden folder
 * and returns one `removed-stale` record for each, so nothing is removed
 * without being recorded. Runs after every case has been captured on
 * `platform`; that operating system's own goldens of shared cases are left
 * to planCapture.
 */
export function removeStaleGoldens(manifest: Manifest, options: { platform: string; root?: string }): CaptureDrift[] {
  const root = options.root ?? GOLDEN_ROOT;
  return findStaleGoldens(manifest, { root, keepOwnOf: options.platform }).map((s) => {
    rmSync(join(root, ...s.path.split("/")), { recursive: true, force: true });
    return { case: s.case, kind: "removed-stale", path: s.path, reason: s.reason };
  });
}

/** One line that describes a drift record, for the capture log. */
export function describeStale(d: CaptureDrift): string {
  return `${d.path ?? d.case}: ${d.reason === undefined ? "stale golden folder" : STALE_TEXT[d.reason]}`;
}

/**
 * `capture.mjs --check` for one case: the fresh capture must equal the golden
 * this operating system uses, and a case that is not OS-dependent must also
 * equal the shared golden (else it is shared drift). Returns the problems.
 */
export function checkCapture(testCase: GoldenCase, freshDir: string, options: { platform: string; root?: string }): string[] {
  const root = options.root ?? GOLDEN_ROOT;
  const ignoreModes = options.platform === "win32";
  const problems: string[] = [];
  for (const dir of [osGoldenDir(testCase, options.platform, root), goldenDir(testCase, root)]) {
    if (goldenDirExists(dir) && !hasGoldenDir(dir)) problems.push(`${testCase.id}: incomplete golden folder ${relative(root, dir).split(sep).join("/")} has no result.json`);
  }
  const selection = selectGolden(testCase, options.platform, root);
  if (selection.status === "missing-golden") {
    problems.push(`${testCase.id}: missing-golden: ${selection.reason}`);
  } else if (!sameGoldenDirs(selection.dir, freshDir, { ignoreModes })) {
    problems.push(`${testCase.id}: fresh capture differs from the ${selection.status === "os" ? `${options.platform} golden` : "shared golden"}`);
  }
  if (testCase.os_dependent === undefined) {
    const shared = goldenDir(testCase, root);
    if (!hasGoldenDir(shared) || !sameGoldenDirs(shared, freshDir, { ignoreModes })) {
      problems.push(`${testCase.id}: shared-drift: the fresh capture on ${options.platform} differs from the shared golden; mark the case os_dependent with a reason, or refresh the shared set`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- Artifact manifest

export const CAPTURE_RECORD = "capture-record.json";

/** SHA-256 of every file in one OS golden set (hidden files included), except the capture record. */
export function goldenSetManifest(dir: string): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const rel of listGoldenFiles(dir)) {
    if (rel === CAPTURE_RECORD) continue;
    manifest[rel] = sha256(readFileSync(join(dir, ...rel.split("/"))));
  }
  return manifest;
}

/** The capture record of one OS golden set, as verifyGoldenSet reads it. */
interface CaptureRecordFile {
  platform?: string;
  /** Goldens the capture wrote to this set (not counting derived goldens). */
  os_goldens?: number;
  golden_files?: Record<string, string>;
  parity_exception_skips?: Partial<ParityExceptionSkip>[];
  derived_goldens?: Partial<DerivedGoldenRecord>[];
}

/**
 * Checks a downloaded capture artifact (one OS golden set) against the
 * manifest in its capture record: the same file list, hidden files
 * included, and the same SHA-256 for each file. With `manifest`, it also
 * checks that the record names a known platform and that the set holds a
 * golden for every OS-dependent case, and enforces the platform exception
 * classes in `exceptions` against the committed goldens at `options.root`:
 *
 * - The derived goldens in the set are exactly the derived cases that a
 *   class lists for the record's platform, each marked with that class and
 *   source, each with exactly one matching `derived_goldens` record entry,
 *   and no record entry for any other case. Each folder's SHA-256 and its
 *   committed source golden's SHA-256 are recomputed and must equal the
 *   record entry and the result.json mark, and the folder must equal a fresh
 *   derivation from the committed source.
 * - A case that a class lists with `shared` has no folder in any set,
 *   derived or captured.
 * - The `parity_exception_skips` are exactly the listed cases for the
 *   record's platform, each with its class, kind, exit codes, golden, and an
 *   `observation_sha256` equal to the class's `go_observation_sha256`.
 * - Every entry in the set is a tool folder or the capture record, and every
 *   case folder is an OS-dependent case of cases.json that is a derived
 *   golden or a capture result. The captured folders number `os_goldens`.
 *
 * Returns the problems.
 */
export function verifyGoldenSet(dir: string, manifest?: Manifest, exceptions: ExceptionsFile = loadExceptions(), options: { root?: string } = {}): string[] {
  const root = options.root ?? GOLDEN_ROOT;
  const recordPath = join(dir, CAPTURE_RECORD);
  if (!statIsFile(recordPath)) return [`${CAPTURE_RECORD} is missing in ${dir}`];
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as CaptureRecordFile;
  const problems: string[] = [];
  if (record.platform === undefined || !(GOLDEN_PLATFORMS as readonly string[]).includes(record.platform)) {
    problems.push(`${CAPTURE_RECORD} names unknown platform ${String(record.platform)}`);
  }
  if (record.golden_files === undefined) return [...problems, `${CAPTURE_RECORD} has no golden_files manifest`];
  const expected = record.golden_files;
  const actual = goldenSetManifest(dir);
  for (const [path, hash] of Object.entries(expected)) {
    if (actual[path] === undefined) problems.push(`missing file ${path}`);
    else if (actual[path] !== hash) problems.push(`SHA-256 mismatch for ${path}: manifest ${hash}, file ${actual[path]}`);
  }
  for (const path of Object.keys(actual)) if (expected[path] === undefined) problems.push(`file ${path} is not in the manifest`);
  if (manifest === undefined) return problems;
  for (const c of manifest.cases) {
    if (c.os_dependent !== undefined && expected[`${c.tool}/${c.id}/result.json`] === undefined) {
      problems.push(`OS-dependent case ${c.id} has no golden in the set`);
    }
  }
  const platform = record.platform ?? "";
  const listed = platformExceptionCases(exceptions, platform);
  const sharedCases = new Set(exceptions.exceptions.flatMap((e) => (e.cases ?? []).filter((x) => x.win32_golden.source === "shared").map((x) => x.case)));
  const byId = new Map(manifest.cases.map((c) => [c.id, c]));
  const recordDerived = record.derived_goldens ?? [];
  const scratch = mkdtempSync(join(tmpdir(), "buildos-golden-verify-"));
  try {
    for (const c of manifest.cases) {
      const folder = join(dir, c.tool, c.id);
      const where = `${c.tool}/${c.id}`;
      if (sharedCases.has(c.id) && goldenDirExists(folder)) {
        problems.push(`${where} is a shared case of a platform exception class; the set must not hold an OS golden (derived or captured) for it`);
        continue;
      }
      const match = listed.get(c.id);
      const authorized = match !== undefined && match.entry.win32_golden.source !== "shared";
      const mark = readDerived(folder);
      if (mark !== undefined && (!authorized || match.id !== mark.exception || match.entry.win32_golden.source !== mark.source)) {
        problems.push(`derived golden ${where} (${mark.exception}) is not allowed for ${platform} by parity-exceptions.json`);
        continue;
      }
      if (!authorized) continue;
      if (mark === undefined) {
        problems.push(`${match.id}: ${where} must be the derived golden from ${match.entry.win32_golden.source}, but the set ${hasGoldenDir(folder) ? "holds a golden that is not derived" : "has no golden"} for it`);
        continue;
      }
      const entries = recordDerived.filter((r) => r.case === c.id);
      const path = `os/${platform}/${c.tool}/${c.id}`;
      const folderSha = goldenDirDigest(folder);
      const sourceDir = join(root, ...mark.source.split("/"));
      const sourceSha = hasGoldenDir(sourceDir) ? goldenDirDigest(sourceDir) : undefined;
      if (sourceSha === undefined) problems.push(`${match.id}: ${where}: source golden ${mark.source} is missing under ${root}`);
      else if (mark.source_sha256 !== sourceSha) problems.push(`${match.id}: ${where}: result.json source_sha256 ${mark.source_sha256} is not the SHA-256 ${sourceSha} of the committed source ${mark.source}`);
      if (entries.length !== 1) {
        problems.push(`${match.id}: ${where} needs exactly one derived_goldens entry in ${CAPTURE_RECORD}, found ${entries.length}`);
      } else {
        const r = entries[0] as Partial<DerivedGoldenRecord>;
        const want = { case: c.id, path, derived: match.id, source: match.entry.win32_golden.source, source_sha256: sourceSha, sha256: folderSha };
        for (const [field, value] of Object.entries(want)) {
          if (r[field as keyof DerivedGoldenRecord] !== value) problems.push(`${match.id}: ${where}: derived_goldens ${field} is ${JSON.stringify(r[field as keyof DerivedGoldenRecord])}, recomputed ${JSON.stringify(value)}`);
        }
      }
      if (sourceSha !== undefined) {
        try {
          const { observation, derived } = deriveGolden(c, match.id, match.entry, root);
          const fresh = join(scratch, c.tool, c.id);
          writeGolden(c, observation, fresh, derived);
          if (!sameGoldenDirs(folder, fresh)) problems.push(`${match.id}: ${where} differs from a fresh derivation from the committed ${mark.source}`);
        } catch (error) {
          problems.push(`${match.id}: ${(error as Error).message}`);
        }
      }
    }
    // Every entry in the set, not only the manifest cases: a set holds the
    // tool folders and the capture record, and each case folder is an
    // OS-dependent case of cases.json that is either listed in
    // derived_goldens or was captured on this platform (counted in
    // os_goldens). Any other folder is refused, even when golden_files
    // lists its files.
    const caseByFolder = new Map(manifest.cases.map((c) => [`${c.tool}/${c.id}`, c]));
    const derivedCases = new Set(recordDerived.map((r) => String(r.case)));
    const skippedCases = new Set((record.parity_exception_skips ?? []).map((s) => String(s.case)));
    let captured = 0;
    for (const entry of readdirSync(dir).sort()) {
      if (entry === CAPTURE_RECORD) continue;
      if (!(GOLDEN_TOOLS as readonly string[]).includes(entry) || !statSync(join(dir, entry)).isDirectory()) {
        problems.push(`${entry} is not a golden tool folder; a set holds only ${GOLDEN_TOOLS.join(", ")} and ${CAPTURE_RECORD}`);
        continue;
      }
      for (const id of readdirSync(join(dir, entry)).sort()) {
        const where = `${entry}/${id}`;
        const c = caseByFolder.get(where);
        if (!statSync(join(dir, entry, id)).isDirectory()) {
          problems.push(`${where} is not a case folder`);
        } else if (c === undefined) {
          problems.push(`${where} names no case in cases.json; the set must not hold it`);
        } else if (sharedCases.has(id)) {
          // Refused above as a shared case of a platform exception class.
        } else if (c.os_dependent === undefined) {
          problems.push(`${where} is an OS golden of a case that is not OS-dependent; a ${platform} set holds only OS-dependent cases`);
        } else if (derivedCases.has(id) || listed.has(id)) {
          // A derived golden: checked above against parity-exceptions.json and derived_goldens.
        } else if (skippedCases.has(id)) {
          problems.push(`${where}: parity_exception_skips lists ${id}, so it was not captured, and derived_goldens does not list it`);
        } else {
          captured++;
        }
      }
    }
    if (record.os_goldens !== captured) {
      problems.push(`${CAPTURE_RECORD} os_goldens is ${JSON.stringify(record.os_goldens)}, but the set holds ${captured} captured golden folder(s); every folder must be a derived golden or a capture result`);
    }
    for (const r of recordDerived) {
      const match = listed.get(String(r.case));
      if (match === undefined || match.entry.win32_golden.source === "shared") {
        problems.push(`${CAPTURE_RECORD} derived_goldens lists ${String(r.case)}, which no platform exception class lists with a derived golden for ${platform}`);
      }
    }
    const skips = record.parity_exception_skips ?? [];
    for (const [caseId, { id, entry }] of listed) {
      const found = skips.filter((s) => s.case === caseId);
      if (found.length !== 1) {
        problems.push(`${id}: ${CAPTURE_RECORD} needs exactly one parity_exception_skips entry for ${caseId}, found ${found.length}; a fresh capture records it only when Go's observation is the exact recorded defect`);
        continue;
      }
      const s = found[0] as Partial<ParityExceptionSkip>;
      const testCase = byId.get(caseId);
      if (s.observation_sha256 === undefined) {
        problems.push(`${id}: ${caseId}: parity_exception_skips entry has no observation_sha256 (captured before the PE-005 digest rule); run a fresh capture`);
      } else if (s.observation_sha256 !== entry.go_observation_sha256) {
        problems.push(`${id}: ${caseId}: parity_exception_skips observation_sha256 ${s.observation_sha256} is not the recorded defect ${entry.go_observation_sha256}`);
      }
      const want = { kind: `${id.toLowerCase()}-skipped`, exception: id, go_exit: entry.go_exit, manifest_exit: testCase?.exit, golden: testCase === undefined ? undefined : parityExceptionGolden(testCase, entry, platform) };
      for (const [field, value] of Object.entries(want)) {
        if (s[field as keyof ParityExceptionSkip] !== value) problems.push(`${id}: ${caseId}: parity_exception_skips ${field} is ${JSON.stringify(s[field as keyof ParityExceptionSkip])}, expected ${JSON.stringify(value)}`);
      }
    }
    for (const s of skips) {
      if (!listed.has(String(s.case))) problems.push(`${CAPTURE_RECORD} parity_exception_skips lists ${String(s.case)}, which no platform exception class lists for ${platform}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return problems;
}
