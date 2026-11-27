/**
 * `buildos fitgap`: the port of the skill script
 * `fit-gap-analysis/scripts/fitgap.py` (W1 R7 P9 t5), deterministic tooling
 * for fit-gap-analysis runs:
 *
 *   frame     check the frame: both systems load, objectives are valid, layers line up
 *   packages  split the baseline into scoring packages; write the target index and evidence CSV
 *   uncited   list target capabilities that no mark cites (input to the target-only pass)
 *   merge     scored rows + target-only rows + findings -> <a>-<b>-fit-gap-analysis.json
 *   workbook  merged JSON + both models -> <a>-<b>-fit-gap-analysis.xlsx (`workbook.ts`)
 *
 * Every check, number, message, and written byte is the script's: JSON is
 * read and written as Python's `json` module does, and the verdict, fit
 * score, and priority are computed with Python's arithmetic (`py.ts`). Owner
 * names come from the frame (the agent fills them from `owners[].name` in
 * `.os/config/instance.yaml`); owner colors from the frame's `owner_colors`,
 * else the skill's palette `.os/skills/fit-gap-analysis/config/owner-colors.json`
 * in the project (W1 R7 P7 t5). No owner name or color is in this code.
 * What differs is recorded in `test/golden/skills/divergences.json`.
 */

import { basename, dirname, isAbsolute, join, normalize, posix, sep } from "node:path";
import type { FsPortFactory } from "../shared/fs-port.ts";
import { ProjectFileError, ProjectFiles, type WritePlan } from "../shared/project-files.ts";
import type { NotRestored } from "../shared/not-restored.ts";
import { isDict, isList, isPyNumber, PyFloat, PyIntDigitsError, PyJsonDepthError, PyJsonError, pyDumps, pyLoads, pyRepr, pyStrip, pyLen, type PyDict, type PyValue } from "../shared/py-json.ts";
import { PyException, pyDecodeUtf8 } from "../shared/py-text.ts";
import { READ_LIMITS } from "../shared/read-limits.ts";
import { pyCsvRows } from "../extract/py-lines.ts";
import {
  FitgapShapeError,
  dict,
  fmt,
  get,
  getN,
  hashKey,
  idx,
  inList,
  iter,
  joinStr,
  num,
  or,
  pyCompare,
  pyEq,
  pyRound,
  pySum,
  reprPairs,
  sortedBy,
  splitList,
  str,
  strip,
  stripOrEmpty,
  truthy,
  type Num,
  type V,
} from "./py.ts";
import { buildWorkbook, type XlsxZip } from "./workbook.ts";

import { DESCOPED, MARKS, SCORED_MARKS, VERDICTS } from "./vocab.ts";

export { DESCOPED, MARKS, SCORED_MARKS, VERDICTS };
const CONF = ["high", "medium", "low"];
const EFFORT = ["none", "low", "medium", "high", "unknown"];
const WEIGHTS = ["must", "should", "could"];
export const MATURITY = ["proven", "available", "partial", "planned", "deferred"];
export const WHY = ["decision", "must_objective_gap", "live_loss", "open_question"];
const CITE_REQUIRED = ["met", "configured", "partly"];
const NOTE_REQUIRED = ["configured", "partly", "unreleased", "not_met", DESCOPED];
const TODO_TYPES = ["decision", "research", "build", "configure", "vendor_question", "test", "data"];
const WHOLE = "-WHOLE";

function defaultScoring(): PyDict {
  return dict([
    ["mark_points", dict([["met", 100], ["configured", 90], ["partly", 50], ["unreleased", 25], ["not_met", 0]])],
    ["objective_factor", dict([["must", new PyFloat(1.0)], ["should", new PyFloat(0.6)], ["could", new PyFloat(0.3)], ["none", new PyFloat(0.2)]])],
    ["maturity_factor", dict([["proven", new PyFloat(1.0)], ["available", new PyFloat(0.8)], ["partial", new PyFloat(0.6)], ["planned", new PyFloat(0.4)], ["deferred", new PyFloat(0.2)]])],
  ]);
}

/** `die(msg)`: `fitgap: <msg>` on stderr, exit 1 (PRD 20: 4). */
export class FitgapDie extends Error {}
/** `fail_on`: the problems were printed on stdout, exit 1 (PRD 20: 4). */
export class FitgapFail extends Error {}
/** A file could not be read or parsed (the script: a traceback). */
export class FitgapInput extends Error {}

export interface FitgapContext {
  files: ProjectFiles;
  out: string[];
  zip: XlsxZip;
  /** Today's date as `YYYY-MM-DD` (the `--date` default, local time). */
  today: string;
  /** Paths written (for the JSON result). */
  written: string[];
  /** Notices for stderr after a successful write (a backup BuildOS could not remove). */
  notices: string[];
  /** The backups BuildOS could not delete after a complete write, with exact paths (P9-R2-07). */
  leftBehind: NotRestored[];
  /** `pkg-*.json` files `packages` kept because they are not its own output (P9-R2-02). */
  kept: string[];
}

/** Commits a plan; records what it wrote and any backup it could not remove (P9-R1-04). */
export function commitPlan(ctx: FitgapContext, plan: WritePlan): void {
  const { leftBehind } = plan.commit();
  ctx.written.push(...plan.written);
  ctx.leftBehind.push(...leftBehind);
  for (const left of leftBehind) ctx.notices.push(`fitgap: BuildOS wrote the output, but could not delete ${left.path} (${left.reason}).`);
}

export function die(msg: string): never {
  throw new FitgapDie(`fitgap: ${msg}`);
}

export function print(ctx: FitgapContext, line: string): void {
  ctx.out.push(`${line}\n`);
}

function failOn(ctx: FitgapContext, errors: string[], what: string): void {
  if (errors.length === 0) return;
  print(ctx, `${what}: ${errors.length} problem(s)`);
  for (const e of errors.slice(0, 60)) print(ctx, `  FAIL  ${e}`);
  if (errors.length > 60) print(ctx, `  \u2026 and ${errors.length - 60} more`);
  throw new FitgapFail(what);
}

// ---------------------------------------------------------------- files

/** `load(p)`: `json.load` of a UTF-8 text file. */
export function load(ctx: FitgapContext, path: string): PyValue {
  let data: Uint8Array;
  try {
    data = ctx.files.readBytes(path, READ_LIMITS.data);
  } catch (error) {
    if (error instanceof ProjectFileError) {
      if (error.errno === "ENOENT") throw new FitgapInput(`[Errno 2] No such file or directory: ${pyRepr(path)}`);
      if (error.errno === "EISDIR") throw new FitgapInput(`[Errno 21] Is a directory: ${pyRepr(path)}`);
      throw new FitgapInput(error.message);
    }
    throw error;
  }
  try {
    return pyLoads(pyDecodeUtf8(data).replace(/\r\n?/g, "\n"));
  } catch (error) {
    if (error instanceof PyJsonError) throw new FitgapInput(`${path} is not valid JSON: ${error.message}`);
    if (error instanceof PyJsonDepthError) throw new FitgapInput(`${path}: ${error.message}`);
    if (error instanceof PyIntDigitsError) throw new FitgapInput(`${path}: ${error.message}`);
    if (error instanceof PyException) throw new FitgapInput(`${path} is not UTF-8 text: ${error.message}`);
    throw error;
  }
}

/** `json.dump(o, f, indent=1, ensure_ascii=False)` (no final line break), with the folders made. */
function dumpTo(plan: WritePlan, value: PyValue, path: string): void {
  plan.write(path, pyDumps(value, { indent: 1, ensureAscii: false }), { limit: READ_LIMITS.data });
}

/**
 * Python's `glob.glob(pattern)` inside the project (hidden names need a
 * leading `.`), with results spelled as the pattern spells its folders and
 * `/` between the names it adds (divergence SD-07).
 *
 * W1 R7 P9 review round 1 (P9-R1-02): the expansion starts at the literal
 * prefix of the pattern (the folders before the first part with `*`, `?`,
 * or `[`), as typed (relative to the root, or absolute), and that prefix must
 * be inside the project folder; every match is checked again, so a `..`
 * after a wildcard cannot leave it. A pattern outside the project folder is
 * a refusal (exit 3), never an empty match. A pattern inside it that matches
 * nothing gives no files, as the script's `glob.glob` did.
 *
 * F-P9-04 review round 1 (finding 3): an empty pattern matches nothing, as
 * `glob.glob('')` returns `[]` (it named the project folder before).
 * `buildos fitgap` is unchanged: its `globs` still keeps a pattern that names
 * an existing path when nothing matches.
 */
export function pyGlob(ctx: FitgapContext, pattern: string, options: { spelled?: boolean } = {}): string[] {
  if (pattern === "") return [];
  const spelled = options.spelled === true;
  const magic = /[*?[]/;
  const parts = pattern.split(sep === "\\" ? /[/\\]/ : "/");
  const first = parts.findIndex((part) => magic.test(part));
  if (first === -1) {
    if (!spelled) return ctx.files.kindStrict(pattern) === undefined ? [] : [pattern];
    // `glob.glob` of a plain path: `os.path.lexists(path)`, or `os.path.isdir` of its folder when it ends with a separator.
    const found = osLookup(ctx.files, pattern);
    return found === "file" || found === "directory" || found === "dangling" ? [pattern] : [];
  }
  let prefix = parts.slice(0, first).join("/");
  if (isAbsolute(pattern) && (prefix === "" || /^[A-Za-z]:$/.test(prefix))) prefix = sep === "\\" ? `${prefix}\\` : "/";
  const contained = (path: string): void => {
    if (ctx.files.inside(path === "" ? "." : path) === undefined) throw ctx.files.refusal(pattern, false);
  };
  contained(prefix);
  // F-P9-04 review round 3 (finding 4): for capability-matrix (`spelled`), `\\` is a separator only on Windows, as
  // `os.path.join` reads it; on POSIX it is part of a name (a folder `fold71\\`). `buildos fitgap` keeps its join (F-P9-12).
  const separatorAtEnd = (base: string): boolean => base.endsWith("/") || (base.endsWith("\\") && (!spelled || sep === "\\"));
  const join = (base: string, name: string): string => (base === "" ? name : separatorAtEnd(base) ? `${base}${name}` : `${base}/${name}`);
  /** What `os.lstat` (a name) or `os.path.isdir` (a folder) finds at `path`. */
  const exists = (path: string): boolean => {
    if (!spelled) return ctx.files.kindStrict(path === "" ? "." : path) !== undefined;
    const found = osLookup(ctx.files, path);
    return found === "file" || found === "directory" || found === "dangling";
  };
  const isFolder = (path: string): boolean => (spelled ? osLookup(ctx.files, path === "" ? "." : path) === "directory" : ctx.files.kindStrict(path === "" ? "." : path) === "directory");
  let results: string[] = [prefix];
  for (let i = first; i < parts.length; i++) {
    const part = parts[i]!;
    const last = i === parts.length - 1;
    const next: string[] = [];
    for (const base of results) {
      if (!magic.test(part)) {
        if (part === "" && base !== "") {
          // F-P9-04 review round 2 (finding 1): a final separator matches only a folder, spelled with the separator
          // (`os.path.join(folder, '')`); between two names it adds nothing.
          if (spelled && last) {
            if (isFolder(base)) next.push(join(base, ""));
            continue;
          }
          next.push(base);
          continue;
        }
        const candidate = join(base, part);
        contained(candidate);
        if (exists(candidate)) next.push(candidate);
        continue;
      }
      const folder = base === "" ? "." : base;
      if (!isFolder(folder)) continue;
      const re = fnmatchRegex(part);
      for (const name of ctx.files.listStrict(folder)) {
        if (name.startsWith(".") && !part.startsWith(".")) continue;
        if (!re.test(name)) continue;
        const candidate = join(base, name);
        if (!last && ctx.files.kindStrict(candidate) !== "directory") continue;
        next.push(candidate);
      }
    }
    results = next;
  }
  return results;
}

/**
 * F-P9-04 review round 2 (finding 1): what the operating system finds at
 * `path` as the user spelled it, one name at a time, as `open` and
 * `os.lstat` resolve it on macOS and Linux: every name before the last (and
 * the last one too, when the path ends with a separator) must be a folder,
 * so `p.json/`, `p.json/.`, and `p.json/../p.json` are `ENOTDIR` when
 * `p.json` is a file, and `gone/../p.json` is `ENOENT` when `gone` is
 * missing. `.` and `..` are then folded as text, as every BuildOS path is
 * (divergence SD-24: a `..` right after a folder link names the link's
 * parent, where the OS goes to the parent of the link's target). A folder
 * before the project folder in a relative path (`../<project>/...`) is not
 * looked at: BuildOS reads nothing outside the project, and the path must
 * still end inside it (else the refusal, exit 3). For an absolute path,
 * `files.inside` looks at the metadata of each folder of it (device and
 * inode, never content or a listing), also outside the project, to
 * recognize the project folder under another spelling (P9-R2-10; SD-24 as
 * review round 3 corrected it). Windows folds `.` and `..` as text before it
 * looks at the disk, so there only the whole path is looked up (and a final
 * separator after a file is `ENOTDIR`, as `glob` reads it everywhere).
 */
export function osLookup(files: ProjectFiles, path: string, options: { forWrite?: boolean } = {}): "file" | "directory" | "dangling" | "ENOENT" | "ENOTDIR" {
  // F-P9-04 review round 3 (finding 1): `forWrite` looks at a write destination (`--out` and its folders) through the
  // write-authorized port (`destinationKind`), so an authorized folder link is followed, as the write follows it.
  const forWrite = options.forWrite === true;
  const kindOf = (p: string): "file" | "directory" | undefined => (forWrite ? files.destinationKind(p === "" ? "." : p) : files.kindStrict(p === "" ? "." : p));
  const entryExists = (p: string): boolean => (forWrite ? files.destinationEntryExists(p === "" ? "." : p) : files.entryExists(p === "" ? "." : p));
  if (path === "") return "ENOENT";
  /** The last name: what is there, or a link that leads nowhere (`os.lstat` finds it, `open` does not). */
  const last = (p: string): "file" | "directory" | "dangling" | "ENOENT" => kindOf(p) ?? (entryExists(p) ? "dangling" : "ENOENT");
  if (sep === "\\") {
    // `glob` itself honours a final separator on every system (`os.path.isdir` of the folder).
    if (/[\\/]$/.test(path)) {
      const kind = kindOf(path);
      return kind === "directory" ? kind : kind === undefined ? "ENOENT" : "ENOTDIR";
    }
    return last(path);
  }
  // F-P9-04 review round 3 (finding 2): the installed-path rule first (`userRel`: a leading `system/` names the root
  // of an initialized project with no `system` entry), then the walk. A mapped path is walked from `./`, so the
  // rule is not applied a second time to the names it walks. Callers keep the path as typed for their messages.
  const mapped = files.userRel(path);
  const walked = mapped === path ? path : `./${mapped}`;
  const names = walked.split("/").filter((name) => name !== "");
  const trailing = walked.endsWith("/");
  let at = walked.startsWith("/") ? "/" : "";
  for (let k = 0; k < names.length; k++) {
    // The names as typed, not `path.join` (which would fold `gone/..` before `gone` is looked at).
    at = at === "" ? names[k]! : at.endsWith("/") ? `${at}${names[k]!}` : `${at}/${names[k]!}`;
    const needFolder = k < names.length - 1 || trailing;
    if (needFolder && files.inside(at) === undefined) continue;
    if (!needFolder) return last(at);
    const kind = kindOf(at);
    if (kind === undefined) return "ENOENT";
    if (kind !== "directory") return "ENOTDIR";
  }
  return last(at);
}

/**
 * Python's `fnmatch.translate` (3.12 and later), as a JavaScript regular
 * expression with the `u` flag (W1 R7 P9 review round 2, P9-R2-12): `?` is
 * one code point (a supplementary character too), `*` any run, `[...]` a set
 * with `!` for negation and a leading `]` as a member, a `-` between two
 * members a range, a range whose ends are reversed dropped (so `[z-a]` matches
 * nothing), an empty set matching nothing, `[!]` any one character, and every
 * other character literal (no regular-expression syntax gets through). On
 * Windows the match ignores case, as `fnmatch` compares `os.path.normcase`
 * names there.
 */
export function fnmatchRegex(pattern: string, ignoreCase = sep === "\\"): RegExp {
  const pat = [...pattern];
  const n = pat.length;
  const literal = (c: string): string => c.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
  /** One set member: everything is literal inside a JavaScript set except `\`, `]`, `[`, `^`, and `-`, which are escaped. */
  const member = (text: string): string => [...text].map((c) => (c === "\\" || c === "]" || c === "[" || c === "^" || c === "-" ? `\\${c}` : c)).join("");
  let out = "";
  let i = 0;
  while (i < n) {
    const c = pat[i]!;
    i++;
    if (c === "*") {
      // Python folds a run of `*` into one.
      if (!out.endsWith(".*")) out += ".*";
    } else if (c === "?") out += ".";
    else if (c === "[") {
      let j = i;
      if (j < n && pat[j] === "!") j++;
      if (j < n && pat[j] === "]") j++;
      while (j < n && pat[j] !== "]") j++;
      if (j >= n) {
        out += "\\[";
        continue;
      }
      // The members as Python splits them at each range `-`: chunks[k] ends a range that chunks[k + 1] starts.
      let negate = false;
      let start = i;
      if (pat[start] === "!") {
        negate = true;
        start++;
      }
      const body = pat.slice(start, j);
      let set: string;
      if (!body.includes("-")) set = member(body.join(""));
      else {
        const chunks: string[][] = [];
        let from = start;
        let k = start + 1;
        for (;;) {
          k = pat.indexOf("-", k);
          if (k < 0 || k >= j) break;
          chunks.push(pat.slice(from, k));
          from = k + 1;
          k += 3;
        }
        const chunk = pat.slice(from, j);
        if (chunk.length > 0) chunks.push(chunk);
        else chunks[chunks.length - 1]!.push("-");
        // Remove empty ranges (reversed ends), as Python does.
        for (let m = chunks.length - 1; m > 0; m--) {
          const prev = chunks[m - 1]!;
          const next = chunks[m]!;
          if (prev.length > 0 && next.length > 0 && prev[prev.length - 1]!.codePointAt(0)! > next[0]!.codePointAt(0)!) {
            chunks[m - 1] = [...prev.slice(0, -1), ...next.slice(1)];
            chunks.splice(m, 1);
          }
        }
        set = chunks.map((part) => member(part.join(""))).join("-");
      }
      i = j + 1;
      if (set === "") out += negate ? "." : "(?!)";
      else out += `[${negate ? "^" : ""}${set}]`;
    } else out += literal(c);
  }
  return new RegExp(`^(?:${out})$`, ignoreCase ? "isu" : "su");
}

/** `globs(pats)`: every match of every pattern (or the path when it exists), sorted, once. */
function globs(ctx: FitgapContext, patterns: readonly string[]): string[] {
  const found = new Set<string>();
  for (const p of patterns) {
    const matches = pyGlob(ctx, p);
    for (const f of matches.length > 0 ? matches : ctx.files.kindStrict(p) !== undefined ? [p] : []) found.add(f);
  }
  return [...found].sort((a, b) => pyCompare(a, b));
}

// ---------------------------------------------------------------- loading

export interface Frame {
  data: PyDict;
  base: string;
  scoring: PyDict;
}

export function readFrame(ctx: FitgapContext, path: string): Frame {
  const data = load(ctx, path);
  if (!isDict(data)) throw new FitgapShapeError(`TypeError: '${isList(data) ? "list" : "str"}' object does not support item assignment`);
  const base = dirname(ctx.files.abs(path));
  const sc = defaultScoring();
  const given = or(get(data, "scoring"), new Map());
  if (!isDict(given)) throw new FitgapShapeError(`AttributeError: '${isList(given) ? "list" : "str"}' object has no attribute 'items'`);
  for (const [k, v] of given) {
    if (!sc.has(k)) die(`frame scoring: unknown key '${k}' (allowed: ${[...sc.keys()].join(", ")})`);
    if (!isDict(v)) throw new FitgapShapeError("TypeError: cannot convert dictionary update sequence element #0 to a sequence");
    const target = sc.get(k) as PyDict;
    for (const [kk, vv] of v) target.set(kk, vv);
  }
  return { data, base, scoring: sc };
}

function resolvePath(fr: Frame, p: V): string {
  if (typeof p !== "string") throw new FitgapShapeError(`TypeError: expected str, bytes or os.PathLike object, not ${p === null || p === undefined ? "NoneType" : typeof p}`);
  return isAbsolute(p) ? p : normalize(join(fr.base, p));
}

/**
 * `csv.DictReader` rows of a UTF-8 file with an optional byte order mark.
 * W1 R7 P9 review round 1 (P9-R1-14): as `DictReader`, a data row with more
 * fields than the header keeps the surplus aside (under its `restkey`, which
 * no step reads, so it is dropped here), and a shorter row gets `None` for
 * each missing field. An empty row is skipped.
 */
function readCsv(ctx: FitgapContext, path: string): PyDict[] {
  let data: Uint8Array;
  try {
    data = ctx.files.readBytes(path, READ_LIMITS.data);
  } catch (error) {
    if (error instanceof ProjectFileError && error.errno === "ENOENT") throw new FitgapInput(`[Errno 2] No such file or directory: ${pyRepr(path)}`);
    if (error instanceof ProjectFileError) throw new FitgapInput(error.message);
    throw error;
  }
  let text: string;
  try {
    text = pyDecodeUtf8(data);
  } catch (error) {
    throw new FitgapInput(`${path} is not UTF-8 text: ${(error as Error).message}`);
  }
  if (text.startsWith("\ufeff")) text = text.slice(1);
  let rows: string[][];
  try {
    rows = pyCsvRows(text);
  } catch (error) {
    throw new FitgapInput(`${path} is not a readable CSV file: ${(error as Error).message}`);
  }
  const out: PyDict[] = [];
  let fieldnames: string[] | undefined;
  for (const row of rows) {
    if (fieldnames === undefined) {
      fieldnames = row;
      continue;
    }
    if (row.length === 0) continue;
    const d: PyDict = new Map();
    fieldnames.forEach((name, i) => d.set(name, i < row.length ? row[i]! : null));
    out.push(d);
  }
  return out;
}

function layerSort(l: PyDict): number {
  const m = /^L(\p{Nd}+)$/u.exec(str(idx(l, "id")));
  return m ? Number([...m[1]!].map((d) => String(Number.parseInt(d, 10) || digitValue(d))).join("")) : 999;
}

function digitValue(d: string): number {
  const cp = d.codePointAt(0)!;
  for (const zero of [0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0, 0xf20, 0x1040, 0xff10]) {
    if (cp >= zero && cp <= zero + 9) return cp - zero;
  }
  return 0;
}

export interface Cap {
  d: PyDict;
  id: string;
  requirements: PyDict[];
}

export interface System {
  code: PyValue;
  name: PyValue;
  source: string;
  layers: PyDict[];
  caps: PyDict[];
  cap: Map<string, PyDict>;
}

function capKey(value: V): string {
  return hashKey(value);
}

export function loadSystem(ctx: FitgapContext, fr: Frame, role: string): System {
  const spec = or(get(fr.data, role), null);
  if (!truthy(spec)) die(`frame has no '${role}' entry`);
  let code: PyValue;
  let name: PyValue;
  let layers: PyDict[];
  let caps: PyDict[];
  let source: string;
  if (truthy(get(spec, "model"))) {
    const path = resolvePath(fr, get(spec, "model"));
    const m = load(ctx, path);
    const meta = get(m, "meta", new Map()) ?? null;
    code = or(get(spec, "code"), or(get(meta, "code"), null));
    if (!truthy(code)) die(`${role}: model meta has no code`);
    name = or(get(spec, "name"), or(get(meta, "name"), or(get(meta, "title"), code)));
    layers = iter(idx(m, "layers")).map((l) =>
      dict([
        ["id", idx(l, "id")],
        ["code", idx(l, "code")],
        ["name", idx(l, "name")],
      ]),
    );
    caps = [];
    for (const c of iter(idx(m, "capabilities"))) {
      caps.push(
        dict([
          ["id", idx(c, "id")],
          ["parent_id", getN(c, "parent_id")],
          ["name", idx(c, "name")],
          ["layer_id", idx(c, "layer_id")],
          ["doc_ref", getN(c, "doc_ref")],
          ["type", getN(c, "type")],
          ["status", getN(c, "status")],
          ["maturity", getN(c, "maturity")],
          ["summary", or(get(c, "summary"), "")],
          [
            "requirements",
            iter(get(c, "requirements", []) ?? null).map((r) =>
              dict([
                ["id", idx(r, "id")],
                ["kind", getN(r, "kind")],
                ["status", getN(r, "status")],
                ["maturity", getN(r, "maturity")],
                ["text", or(get(r, "text"), "")],
                ["option_values", getN(r, "option_values")],
              ]),
            ),
          ],
        ]),
      );
    }
    source = basename(str(idx(spec, "model")));
  } else {
    for (const k of ["capabilities_csv", "requirements_csv", "code", "name"]) {
      if (!truthy(get(spec, k))) die(`${role}: give 'model', or all of capabilities_csv, requirements_csv, code, name`);
    }
    code = idx(spec, "code");
    name = idx(spec, "name");
    const mm = or(get(spec, "maturity_map"), new Map());
    const crow = readCsv(ctx, resolvePath(fr, idx(spec, "capabilities_csv")));
    const rrow = readCsv(ctx, resolvePath(fr, idx(spec, "requirements_csv")));
    const mat = (row: PyDict, rid: PyValue): PyValue => {
      const own = stripOrEmpty(get(row, "maturity"));
      const v: PyValue = own !== "" ? own : (get(mm, str(get(row, "status") ?? null)) ?? null);
      if (!inList(v, MATURITY)) die(`${role} ${str(rid)}: status '${str(getN(row, "status"))}' has no maturity. Add it to ${role}.maturity_map in the frame.`);
      return v;
    };
    const lay = new Map<string, PyDict>();
    for (const r of crow) {
      const k = capKey(idx(r, "layer_id"));
      if (!lay.has(k))
        lay.set(
          k,
          dict([
            ["id", idx(r, "layer_id")],
            ["code", idx(r, "layer_code")],
            ["name", idx(r, "layer_name")],
          ]),
        );
    }
    layers = sortedBy([...lay.values()], layerSort);
    const reqs = new Map<string, PyDict[]>();
    for (const r of rrow) {
      const k = capKey(idx(r, "capability_id"));
      const entry = dict([
        ["id", idx(r, "requirement_id")],
        ["kind", getN(r, "requirement_kind")],
        ["status", getN(r, "status")],
        ["maturity", mat(r, idx(r, "requirement_id"))],
        ["text", or(get(r, "text"), "")],
        ["option_values", or(get(r, "option_values"), null)],
      ]);
      const list = reqs.get(k);
      if (list === undefined) reqs.set(k, [entry]);
      else list.push(entry);
    }
    caps = crow.map((r) =>
      dict([
        ["id", idx(r, "capability_id")],
        ["parent_id", or(get(r, "parent_id"), null)],
        ["name", idx(r, "name")],
        ["layer_id", idx(r, "layer_id")],
        ["doc_ref", getN(r, "doc_ref")],
        ["type", getN(r, "capability_type")],
        ["status", idx(r, "status")],
        ["maturity", mat(r, idx(r, "capability_id"))],
        ["summary", or(get(r, "summary"), "")],
        ["requirements", reqs.get(capKey(idx(r, "capability_id"))) ?? []],
      ]),
    );
    source = basename(str(idx(spec, "capabilities_csv")));
  }
  const lm = new Map<string, PyDict>();
  for (const l of layers) lm.set(capKey(l.get("id")), l);
  for (const c of caps) {
    const layer = lm.get(capKey(c.get("layer_id")));
    if (layer === undefined) die(`${role} ${str(c.get("id"))}: layer '${str(c.get("layer_id"))}' is not in the layer list`);
    if (!inList(c.get("maturity"), MATURITY)) die(`${role} ${str(c.get("id"))}: maturity '${str(c.get("maturity"))}' is not one of ${MATURITY.join(", ")}`);
    c.set("layer_code", layer.get("code")!);
    c.set("layer_name", layer.get("name")!);
    if (role === "baseline" && !truthy(c.get("requirements"))) {
      const id = c.get("id");
      if (typeof id !== "string") throw new FitgapShapeError(`TypeError: unsupported operand type(s) for +: '${id === null ? "NoneType" : "int"}' and 'str'`);
      const summary = c.get("summary");
      if (typeof summary !== "string") throw new FitgapShapeError("TypeError: can only concatenate str (not \"int\") to str");
      c.set("requirements", [
        dict([
          ["id", id + WHOLE],
          ["kind", "capability"],
          ["status", c.get("status")!],
          ["maturity", c.get("maturity")!],
          ["option_values", null],
          ["text", `(No requirements of its own. Mark the capability as a whole.) ${summary}`],
        ]),
      ]);
    }
  }
  const cap = new Map<string, PyDict>();
  for (const c of caps) cap.set(capKey(c.get("id")), c);
  if (cap.size !== caps.length) die(`${role}: duplicate capability ids`);
  // Review round 3 (P9-F-04, divergence SD-21): a requirement ID is scoped to
  // its capability (merge, the marks check, and the workbook join marks to
  // requirements within one capability, as the script did), so the same ID
  // under two capabilities is valid. Within one capability a repeated ID would
  // be dropped from scoring silently (merge keys each mark by its ID), so every
  // command that loads a model refuses it (the script did not check).
  for (const c of caps) {
    const seen = new Set<string>();
    for (const q of reqsOf(c)) {
      const id = isDict(q) ? (q.get("id") ?? null) : null;
      // An ID that is a list or a mapping keeps the script's own later failure (SD-03).
      if (isList(id) || isDict(id)) continue;
      const key = capKey(id);
      if (seen.has(key)) die(`${role} ${str(c.get("id"))}: the requirement id '${str(id)}' is used more than once in this capability. Give each requirement of a capability its own id, then run the command again.`);
      seen.add(key);
    }
  }
  return { code, name, source, layers, caps, cap };
}

/** The requirements of a capability. */
export function reqsOf(c: PyDict): PyDict[] {
  return iter(c.get("requirements")) as PyDict[];
}

export function hasCap(s: System, id: V): boolean {
  return s.cap.has(capKey(id));
}

export function capOf(s: System, id: V): PyDict {
  const c = s.cap.get(capKey(id));
  if (c === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(id ?? null)}`);
  return c;
}

function loadPrior(ctx: FitgapContext, fr: Frame, b: System, t: System): Map<string, PyDict> {
  const p0 = get(fr.data, "prior_fit_gap");
  if (!truthy(p0)) return new Map();
  const p = resolvePath(fr, p0);
  let rows: PyValue[];
  if (p.endsWith(".json")) {
    const d = load(ctx, p);
    const value = isDict(d) ? (d.has("baseline_to_target") ? d.get("baseline_to_target")! : d) : d;
    rows = iter(value);
  } else {
    rows = readCsv(ctx, p);
  }
  const bk = ["baseline_capability_id", `${lower(b.code)}_capability_id`];
  const tk = ["target_capability_ids", `${lower(t.code)}_capability_ids`];
  const out = new Map<string, PyDict>();
  for (const r of rows) {
    const bk0 = bk.find((k) => truthy(get(r, k)));
    const bid = bk0 === undefined ? null : idx(r, bk0);
    if (hasCap(b, bid)) {
      const tk0 = tk.find((k) => truthy(get(r, k)));
      out.set(
        capKey(bid),
        dict([
          ["verdict", getN(r, "verdict")],
          ["evidence", getN(r, "evidence")],
          ["gap_detail", getN(r, "gap_detail")],
          ["target_capability_ids", splitList(tk0 === undefined ? "" : idx(r, tk0))],
        ]),
      );
    }
  }
  return out;
}

export function lower(value: V): string {
  if (typeof value !== "string") throw new FitgapShapeError(`AttributeError: '${value === null ? "NoneType" : "int"}' object has no attribute 'lower'`);
  return value.toLowerCase();
}

function loadRows(ctx: FitgapContext, patterns: readonly string[], what: string): PyValue[] {
  const rows: PyValue[] = [];
  for (const f of globs(ctx, patterns)) {
    const d = load(ctx, f);
    if (!isList(d)) die(`${f}: ${what} file must hold a JSON array`);
    for (const x of d) if (isDict(x)) x.set("_file", basename(f));
    rows.push(...d);
  }
  return rows;
}

// ---------------------------------------------------------------- owner colors

const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;

export function colorPair(v: V): [string, string] | null {
  if (isDict(v) && ["fill", "font"].every((k) => typeof v.get(k) === "string" && HEX_COLOR.test(v.get(k) as string))) {
    return [(v.get("fill") as string).toUpperCase(), (v.get("font") as string).toUpperCase()];
  }
  return null;
}

function ownerColorProblems(fr: Frame): string[] {
  const e: string[] = [];
  const given = getN(fr.data, "owner_colors");
  if (given === null) return e;
  if (!isDict(given)) return ['owner_colors must map each owner to {"fill": "RRGGBB", "font": "RRGGBB"}'];
  const owners = iter(or(get(fr.data, "owners"), []));
  for (const [o, v] of given) {
    if (!inList(o, owners)) e.push(`owner_colors: '${o}' is not in the frame owners`);
    if (colorPair(v) === null) e.push(`owner_colors.${o} must be {"fill": "RRGGBB", "font": "RRGGBB"}`);
  }
  return e;
}

/** The skill palette in the project, read as the script read its own file (any failure: no palette). */
export const OWNER_COLORS_FILE = ".os/skills/fit-gap-analysis/config/owner-colors.json";

export function ownerColors(ctx: FitgapContext, owners: PyValue[], givenColors: V): Map<string, [string, string]> {
  const given = isDict(givenColors) ? givenColors : new Map<string, PyValue>();
  let palette: [string, string][] = [];
  try {
    const data = ctx.files.kind(OWNER_COLORS_FILE) === "file" ? load(ctx, OWNER_COLORS_FILE) : null;
    if (isDict(data)) palette = iter(or(data.get("palette"), [])).map(colorPair).filter((p): p is [string, string] => p !== null);
  } catch (error) {
    if (!(error instanceof FitgapInput || error instanceof FitgapShapeError)) throw error;
    palette = [];
  }
  const out = new Map<string, [string, string]>();
  owners.forEach((o, i) => {
    const pair = colorPair(typeof o === "string" ? given.get(o) : undefined) ?? (palette.length > 0 ? palette[i % palette.length]! : null);
    if (pair !== null) out.set(str(o), pair);
  });
  return out;
}

// ---------------------------------------------------------------- frame

function counterRepr(values: PyValue[]): string {
  const pairs: [PyValue, PyValue][] = [];
  const keys: string[] = [];
  for (const v of values) {
    const k = hashKey(v);
    const at = keys.indexOf(k);
    if (at === -1) {
      keys.push(k);
      pairs.push([v, 1]);
    } else pairs[at]![1] = (pairs[at]![1] as number) + 1;
  }
  return reprPairs(pairs);
}

function counts(values: PyValue[]): [PyValue, number][] {
  const keys: string[] = [];
  const out: [PyValue, number][] = [];
  for (const v of values) {
    const k = hashKey(v);
    const at = keys.indexOf(k);
    if (at === -1) {
      keys.push(k);
      out.push([v, 1]);
    } else out[at]![1] += 1;
  }
  return out;
}

const UNICODE_DIGITS = "\\p{Nd}";

export function cmdFrame(ctx: FitgapContext, framePath: string): void {
  const fr = readFrame(ctx, framePath);
  const b = loadSystem(ctx, fr, "baseline");
  const t = loadSystem(ctx, fr, "target");
  const e: string[] = [];
  const w: string[] = [];
  const sc = fr.scoring;
  if (pyEq(b.code, t.code)) e.push("baseline and target have the same code");
  if (!inList(get(fr.data, "mode", "replacement"), ["replacement", "selection"])) e.push("mode must be 'replacement' or 'selection'");
  const objs = iter(or(get(fr.data, "objectives"), []));
  if (objs.length === 0) w.push("no objectives yet. Draft them and get the person to confirm them before packages.");
  for (const [k, n] of counts(objs.map((o) => getN(o, "id")))) if (n > 1) e.push(`objective id ${str(k)} is used ${n} times`);
  for (const o of objs) {
    const oid = or(get(o, "id"), "?");
    if (typeof oid !== "string") throw new FitgapShapeError("TypeError: expected string or bytes-like object, got 'int'");
    if (!new RegExp(`^OBJ-${UNICODE_DIGITS}{2,3}$`, "u").test(oid)) e.push(`objective id '${oid}' must look like OBJ-01`);
    if (!inList(getN(o, "weight"), WEIGHTS)) e.push(`${oid}: weight '${str(getN(o, "weight"))}' must be one of ${WEIGHTS.join(", ")}`);
    for (const k of ["name", "statement"]) if (stripOrEmpty(get(o, k)) === "") e.push(`${oid}: ${k} is empty`);
    if (stripOrEmpty(get(o, "measure")) === "") w.push(`${oid}: no measure of success`);
    if (getN(o, "rank") !== null && !isPyNumber(getN(o, "rank"))) e.push(`${oid}: rank must be a number (1 = most important)`);
  }
  const tracks = iter(or(get(fr.data, "tracks"), []));
  for (const tr of tracks) {
    if (!(truthy(get(tr, "id")) && truthy(get(tr, "name")) && isPyNumber(getN(tr, "order")))) e.push(`track ${str(or(get(tr, "id"), "?"))}: needs id, name and a numeric order`);
  }
  for (const [k, n] of counts(tracks.map((tr) => getN(tr, "id")))) if (n > 1) e.push(`track id ${str(k)} is used ${n} times`);
  if (truthy(get(fr.data, "tracks")) && !truthy(get(fr.data, "owners"))) e.push("the frame has tracks but no owners list");
  e.push(...ownerColorProblems(fr));
  const between = (d: PyDict, k: string, hi: number): boolean => {
    const v = d.has(k) ? d.get(k)! : -1;
    if (!isPyNumber(v)) throw new FitgapShapeError(`TypeError: '<=' not supported between instances of 'int' and '${isList(v) ? "list" : "str"}'`);
    return num(v) >= 0 && num(v) <= hi;
  };
  for (const k of SCORED_MARKS) if (!between(sc.get("mark_points") as PyDict, k, 100)) e.push(`scoring.mark_points.${k} must be 0 to 100`);
  for (const k of [...WEIGHTS, "none"]) if (!between(sc.get("objective_factor") as PyDict, k, 1)) e.push(`scoring.objective_factor.${k} must be 0 to 1`);
  for (const k of MATURITY) if (!between(sc.get("maturity_factor") as PyDict, k, 1)) e.push(`scoring.maturity_factor.${k} must be 0 to 1`);
  if (!truthy(get(fr.data, "objectives_confirmed_by"))) {
    w.push("objectives_confirmed_by is empty. The person has not confirmed the objectives and weights yet. merge refuses a final build until they do.");
  }
  const bl = new Set(b.layers.map((l) => str(l.get("code"))));
  const tl = new Set(t.layers.map((l) => str(l.get("code"))));
  if (bl.size !== tl.size || [...bl].some((x) => !tl.has(x))) {
    const only = (x: Set<string>, y: Set<string>): string => {
      const d = [...x].filter((v) => !y.has(v)).sort((p, q) => pyCompare(p, q));
      return d.length > 0 ? pyRepr(d) : "-";
    };
    w.push(`layer codes differ. Baseline only: ${only(bl, tl)}. Target only: ${only(tl, bl)}. Layer views follow the baseline.`);
  }
  if (truthy(get(fr.data, "prior_fit_gap"))) print(ctx, `prior fit-gap: ${loadPrior(ctx, fr, b, t).size} baseline rows found`);
  for (const [role, s] of [
    ["baseline", b],
    ["target", t],
  ] as [string, System][]) {
    const n = s.caps.reduce((acc, c) => acc + reqsOf(c).length, 0);
    const whole = s.caps.reduce((acc, c) => acc + reqsOf(c).filter((r) => str(r.get("id")).endsWith(WHOLE)).length, 0);
    print(ctx, `${fmt(role, 8)} ${fmt(s.code, 5)} ${str(s.name)}: ${s.layers.length} layers, ${s.caps.length} capabilities, ${n} requirements${whole > 0 ? ` (${whole} whole-capability marks)` : ""}`);
  }
  print(ctx, `objectives: ${objs.length} (${counterRepr(objs.map((o) => getN(o, "weight")))}), confirmed by: ${str(or(get(fr.data, "objectives_confirmed_by"), "-"))}`);
  if (truthy(get(fr.data, "tracks"))) print(ctx, `tracks: ${tracks.length}; owners: ${joinStr(", ", iter(or(get(fr.data, "owners"), [])))}`);
  for (const x of w) print(ctx, `  WARN  ${x}`);
  failOn(ctx, e, "frame");
  print(ctx, "  frame OK");
}

// ---------------------------------------------------------------- packages

/** `os.path.join(a, b)`, with `/` on every system (divergence SD-07). */
function pyJoinPath(a: string, b: string): string {
  if (isAbsolute(b)) return b;
  if (a === "") return b;
  return a.endsWith("/") || a.endsWith(sep) ? `${a}${b}` : `${a}/${b}`;
}

/** Python's `csv.writer` (excel dialect) row: quotes a field with a comma, a quote, CR, or LF; `\r\n` at the end. */
function csvRow(values: PyValue[]): string {
  const fields = values.map((v) => {
    const text = v === null ? "" : str(v);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  });
  if (fields.length === 1 && fields[0] === "") return '""\r\n';
  return `${fields.join(",")}\r\n`;
}

/** The keys of one package item, in the order `packages` writes them (`prior` is last, when there is one). */
const PACKAGE_ITEM_KEYS = ["id", "name", "layer_code", "layer_name", "type", "status", "maturity", "summary", "requirements"];
const PACKAGE_REQUIREMENT_KEYS = ["id", "kind", "status", "text", "option_values"];
/** The names `packages` writes: `pkg-01.json` to `pkg-99.json`, then `pkg-100.json` and up (`f'pkg-{i:02d}.json'`, i from 1). */
const PACKAGE_NAME = /^pkg-(?:0[1-9]|[1-9][0-9]+)\.json$/;

const sameKeys = (value: unknown, keys: readonly string[]): boolean => typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).join("\0") === keys.join("\0");

/**
 * W1 R7 P9 review round 2 (P9-R2-02): why the `pkg-*.json` entry at `path`
 * is not one that `packages` wrote, or undefined when it is. BuildOS's own
 * output has a numbered name as the generator writes it, is a regular file
 * (a write replaces a link, so BuildOS never leaves one), is UTF-8 JSON, and
 * is a non-empty list of package items with exactly the generated keys in
 * the generated order (each requirement too). The file is read once, with a
 * bound and no link followed, through the destination's own port.
 */
function notOwnPackage(ctx: FitgapContext, path: string, entry: { name: string; kind: string }): string | undefined {
  if (!PACKAGE_NAME.test(entry.name)) return "its name is not one BuildOS writes (pkg-01.json, pkg-02.json, and so on)";
  if (entry.kind !== "file") return entry.kind === "symlink" ? "it is a link, and BuildOS never leaves a link at a package name" : "it is not a regular file";
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(ctx.files.readDestination(path, READ_LIMITS.data)));
  } catch (error) {
    if (error instanceof ProjectFileError) return `BuildOS could not read it to check it (${error.message.replace(/\.$/, "")})`;
    return "it is not the JSON that BuildOS writes";
  }
  if (!Array.isArray(value) || value.length === 0) return "it is not a list of package items";
  for (const item of value) {
    const keys = typeof item === "object" && item !== null && Object.hasOwn(item, "prior") ? [...PACKAGE_ITEM_KEYS, "prior"] : PACKAGE_ITEM_KEYS;
    if (!sameKeys(item, keys)) return "its items do not have the fields BuildOS writes";
    const requirements = (item as Record<string, unknown>)["requirements"];
    if (!Array.isArray(requirements) || !requirements.every((r) => sameKeys(r, PACKAGE_REQUIREMENT_KEYS))) return "its requirements do not have the fields BuildOS writes";
  }
  return undefined;
}

export function cmdPackages(ctx: FitgapContext, framePath: string, outDir: string, maxRequirements: number): void {
  const fr = readFrame(ctx, framePath);
  if (!truthy(get(fr.data, "objectives"))) die("the frame has no objectives. Draft them, get the person to confirm them, then run packages.");
  const b = loadSystem(ctx, fr, "baseline");
  const t = loadSystem(ctx, fr, "target");
  const prior = loadPrior(ctx, fr, b, t);
  const groups: PyDict[][] = [];
  let cur: PyDict[] = [];
  let n = 0;
  for (const c of b.caps) {
    const k = reqsOf(c).length;
    if (cur.length > 0 && n + k > maxRequirements) {
      groups.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(c);
    n += k;
  }
  if (cur.length > 0) groups.push(cur);
  const pdir = pyJoinPath(outDir, "packages");
  const plan = ctx.files.plan();
  plan.folder(pdir);
  // `glob.glob(os.path.join(pdir, 'pkg-*.json'))` then `os.remove`: W1 R7 P9
  // review round 1 (P9-R1-06): the names come from the destination folder
  // itself (inside the root, or an authorized folder outside it), and the
  // removals are steps of the same plan, so a failure puts them back.
  // Review round 2 (P9-R2-02, divergence SD-20): only a file BuildOS can tell
  // is its own earlier output is removed; every other `pkg-*.json` is kept
  // and named (the script removed them all).
  // Review round 3 (P9-F-01, divergence SD-20): every name this run writes
  // is known before any change. A file BuildOS did not write at one of those
  // names would be overwritten, so the command stops first (exit 4) and
  // names each one; a kept file is never one this run then replaces.
  const generated = new Set(groups.map((_, i0) => `pkg-${String(i0 + 1).padStart(2, "0")}.json`));
  const kept: [string, string][] = [];
  const collisions: [string, string][] = [];
  for (const entry of ctx.files.listDestination(pdir)) {
    if (!/^pkg-.*\.json$/s.test(entry.name)) continue;
    const path = pyJoinPath(pdir, entry.name);
    const why = notOwnPackage(ctx, path, entry);
    if (why === undefined) plan.remove(path);
    else if (generated.has(entry.name)) collisions.push([path, why]);
    else kept.push([path, why]);
  }
  if (collisions.length > 0) {
    die(
      `packages would write over ${collisions.length === 1 ? "a file" : `${collisions.length} files`} that BuildOS did not write, so it changed nothing: ${collisions.map(([path, why]) => `${path} (${why})`).join("; ")}. Move or rename ${collisions.length === 1 ? "that file" : "those files"} (for example to notes-pkg-01.json), or choose another --out folder, then run packages again.`,
    );
  }
  for (const [path, why] of kept) {
    ctx.kept.push(path);
    ctx.notices.push(`fitgap: kept ${path}: ${why}. BuildOS deletes only the package files it wrote; delete or rename this file if it is stale.`);
  }
  groups.forEach((caps, i0) => {
    const i = i0 + 1;
    const items = caps.map((c) => {
      const item = dict([
        ["id", c.get("id")!],
        ["name", c.get("name")!],
        ["layer_code", c.get("layer_code")!],
        ["layer_name", c.get("layer_name")!],
        ["type", c.get("type")!],
        ["status", c.get("status")!],
        ["maturity", c.get("maturity")!],
        ["summary", c.get("summary")!],
        [
          "requirements",
          reqsOf(c).map((r) =>
            dict([
              ["id", idx(r, "id")],
              ["kind", idx(r, "kind")],
              ["status", idx(r, "status")],
              ["text", idx(r, "text")],
              ["option_values", idx(r, "option_values")],
            ]),
          ),
        ],
      ]);
      const p = prior.get(capKey(c.get("id")));
      if (p !== undefined) item.set("prior", p);
      return item;
    });
    const name = `pkg-${String(i).padStart(2, "0")}.json`;
    dumpTo(plan, items, pyJoinPath(pdir, name));
    const lays: PyValue[] = [];
    for (const c of caps) if (!lays.some((l) => pyEq(l, c.get("layer_code")))) lays.push(c.get("layer_code")!);
    print(ctx, `  pkg-${String(i).padStart(2, "0")}: ${fmt(caps.length, 3)} capabilities, ${fmt(caps.reduce((a, c) => a + reqsOf(c).length, 0), 4)} requirements, layers ${joinStr(", ", lays)}`);
  });
  dumpTo(
    plan,
    t.caps.map((c) =>
      dict([
        ["id", c.get("id")!],
        ["name", c.get("name")!],
        ["layer_code", c.get("layer_code")!],
        ["status", c.get("status")!],
        ["maturity", c.get("maturity")!],
        ["summary", c.get("summary")!],
        ["requirement_count", reqsOf(c).length],
      ]),
    ),
    pyJoinPath(outDir, "target-index.json"),
  );
  let csv = `\ufeff${csvRow(["requirement_id", "capability_id", "capability_name", "layer_code", "kind", "status", "text", "option_values"])}`;
  for (const c of t.caps) {
    for (const r of reqsOf(c)) {
      csv += csvRow([idx(r, "id"), c.get("id")!, c.get("name")!, c.get("layer_code")!, idx(r, "kind"), idx(r, "status"), idx(r, "text"), or(idx(r, "option_values"), "")]);
    }
  }
  plan.write(pyJoinPath(outDir, "target-requirements.csv"), csv, { limit: READ_LIMITS.data });
  let md = "| id | weight | name | statement | measure |\n| --- | --- | --- | --- | --- |\n";
  for (const o of iter(or(get(fr.data, "objectives"), []))) {
    md += `| ${str(idx(o, "id"))} | ${str(idx(o, "weight"))} | ${str(idx(o, "name"))} | ${str(idx(o, "statement"))} | ${str(or(get(o, "measure"), ""))} |\n`;
  }
  plan.write(pyJoinPath(outDir, "objectives.md"), md);
  commitPlan(ctx, plan);
  print(ctx, `packages[${str(b.code)}->${str(t.code)}]: ${groups.length} packages, prior rows ${prior.size} -> ${outDir}`);
  print(ctx, `  also wrote target-index.json (${t.caps.length} capabilities), target-requirements.csv, objectives.md`);
}

// ---------------------------------------------------------------- uncited

/**
 * `cited_targets(rows)`. W1 R7 P9 review round 1 (P9-R1-07, divergence
 * SD-15): a mark's `target_capability_ids` goes through `split_list`, as
 * `merge` reads it, so a `" | "`-separated string names IDs. The script
 * iterated such a string by character, so the IDs it named were not cited.
 */
function citedTargets(rows: PyValue[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) for (const m of iter(or(get(r, "marks"), []))) for (const t of splitList(get(m, "target_capability_ids") ?? null)) out.add(hashKey(t));
  return out;
}

export function cmdUncited(ctx: FitgapContext, framePath: string, rowPatterns: string[], outFile: string | undefined): void {
  const fr = readFrame(ctx, framePath);
  const t = loadSystem(ctx, fr, "target");
  const cited = citedTargets(loadRows(ctx, rowPatterns, "scored rows"));
  const un = t.caps.filter((c) => !cited.has(hashKey(c.get("id"))));
  for (const c of un) print(ctx, `  ${fmt(c.get("id"), 14)} ${fmt(c.get("layer_code"), 5)} ${fmt(c.get("status"), 18)} ${str(c.get("name"))}`);
  print(ctx, `uncited: ${un.length} of ${t.caps.length} target capabilities have no mark citing them`);
  if (outFile !== undefined && outFile !== "") {
    const plan = ctx.files.plan();
    dumpTo(
      plan,
      un.map((c) =>
        dict([
          ["id", c.get("id")!],
          ["name", c.get("name")!],
          ["layer_code", c.get("layer_code")!],
          ["status", c.get("status")!],
          ["summary", c.get("summary")!],
        ]),
      ),
      outFile,
    );
    commitPlan(ctx, plan);
  }
}

// ---------------------------------------------------------------- merge

export function deriveVerdict(marks: PyDict[]): string {
  const s = new Set(marks.map((m) => str(m.get("mark"))));
  s.delete(DESCOPED);
  if (s.size === 0) return DESCOPED;
  const subset = (allowed: string[]): boolean => [...s].every((x) => allowed.includes(x));
  if (s.size === 1 && s.has("met")) return "native";
  if (subset(["met", "configured"])) return "configurable";
  if (s.size === 1 && s.has("unreleased")) return "unreleased";
  if (subset(["not_met", "unreleased"])) return "gap";
  return "partial";
}

export interface MergeArgs {
  frame: string;
  rows: string[];
  only: string[];
  findings: string | undefined;
  todos: string[];
  out: string;
  date: string;
  draft: boolean;
}

function avgOf(values: V[]): PyValue {
  const xs = values.filter((x) => x !== null && x !== undefined);
  if (xs.length === 0) return null;
  return pyRound(num(pySum(xs)) / xs.length);
}

function lenStrip(value: V): number {
  return pyLen(stripOrEmpty(value));
}

function inMap(map: Map<string, unknown>, value: V): boolean {
  return map.has(hashKey(value));
}

export function cmdMerge(ctx: FitgapContext, a: MergeArgs): void {
  const fr = readFrame(ctx, a.frame);
  const sc = fr.scoring;
  const b = loadSystem(ctx, fr, "baseline");
  const t = loadSystem(ctx, fr, "target");
  const objs = new Map<string, PyDict>();
  for (const o of iter(or(get(fr.data, "objectives"), []))) objs.set(hashKey(idx(o, "id")), o as PyDict);
  const tracks = new Map<string, PyDict>();
  for (const tr of iter(or(get(fr.data, "tracks"), []))) tracks.set(hashKey(idx(tr, "id")), tr as PyDict);
  const owners = iter(or(get(fr.data, "owners"), []));
  const e: string[] = [];
  const seen = new Map<string, PyDict>();
  const trackIds = (): string => joinStr(", ", [...tracks.values()].map((tr) => tr.get("id")!));
  for (const r of loadRows(ctx, a.rows, "scored rows")) {
    const bid = getN(r, "baseline_capability_id");
    if (!hasCap(b, bid)) {
      e.push(`'${str(bid)}': not a baseline capability id`);
      continue;
    }
    if (seen.has(hashKey(bid))) {
      e.push(`${str(bid)}: scored more than once`);
      continue;
    }
    const row = r as PyDict;
    seen.set(hashKey(bid), row);
    const c = capOf(b, bid);
    if (!inList(getN(row, "confidence"), CONF)) e.push(`${str(bid)}: confidence '${str(getN(row, "confidence"))}' must be one of ${CONF.join(", ")}`);
    if (!inList(getN(row, "effort"), EFFORT)) e.push(`${str(bid)}: effort '${str(getN(row, "effort"))}' must be one of ${EFFORT.join(", ")}`);
    row.set("objective_ids", splitList(getN(row, "objective_ids")));
    for (const o of iter(row.get("objective_ids"))) if (!inMap(objs, o)) e.push(`${str(bid)}: objective ${str(o)} is not in the frame`);
    row.set("owners", splitList(getN(row, "owners")));
    if (tracks.size > 0) {
      if (!inMap(tracks, getN(row, "track"))) e.push(`${str(bid)}: track '${str(getN(row, "track"))}' is not a frame track (${trackIds()})`);
      if (!truthy(row.get("owners"))) e.push(`${str(bid)}: owners is empty (the first owner leads)`);
      for (const o of iter(row.get("owners"))) if (!inList(o, owners)) e.push(`${str(bid)}: owner '${str(o)}' is not in the frame owners (${joinStr(", ", owners)})`);
    }
    const want = reqsOf(c).map((q) => idx(q, "id"));
    const marks = iter(or(get(row, "marks"), []));
    const got = marks.map((m) => getN(m, "requirement_id"));
    const missing = want.filter((x) => !inList(x, got));
    const extra = got.filter((x) => !inList(x, want));
    const dup = counts(got)
      .filter(([, k]) => k > 1)
      .map(([x]) => x);
    if (missing.length > 0) e.push(`${str(bid)}: no mark for ${joinStr(", ", missing.slice(0, 6))}${missing.length > 6 ? ` and ${missing.length - 6} more` : ""}`);
    if (extra.length > 0) e.push(`${str(bid)}: marks for requirements it does not have: ${extra.slice(0, 6).map((x) => str(x)).join(", ")}`);
    if (dup.length > 0) e.push(`${str(bid)}: requirements marked twice: ${dup.slice(0, 6).map((x) => str(x)).join(", ")}`);
    for (const m0 of marks) {
      const m = m0 as PyDict;
      const mk = getN(m, "mark");
      const rid = getN(m, "requirement_id");
      if (!inList(mk, MARKS)) {
        e.push(`${str(rid)}: mark '${str(mk)}' must be one of ${MARKS.join(", ")}`);
        continue;
      }
      m.set("target_capability_ids", splitList(getN(m, "target_capability_ids")));
      for (const tc of iter(m.get("target_capability_ids"))) if (!hasCap(t, tc)) e.push(`${str(rid)}: cites '${str(tc)}', which is not a target capability id`);
      const cites = truthy(m.get("target_capability_ids"));
      if (CITE_REQUIRED.includes(mk as string) && !cites) e.push(`${str(rid)}: a ${str(mk)} mark must cite at least one target capability`);
      if (mk === "not_met" && cites) e.push(`${str(rid)}: a not_met mark cites no target capabilities`);
      if (mk === DESCOPED && cites) e.push(`${str(rid)}: a descoped mark cites no target capabilities`);
      if (NOTE_REQUIRED.includes(mk as string) && lenStrip(get(m, "note")) < 15) e.push(`${str(rid)}: a ${str(mk)} mark needs a note (what is configured, missing, coming, or where you looked)`);
    }
    if (lenStrip(get(row, "evidence")) < 80) e.push(`${str(bid)}: evidence is missing or under 80 characters`);
    if (stripOrEmpty(get(row, "migration_note")) === "") e.push(`${str(bid)}: migration_note is empty`);
  }
  for (const c of b.caps) if (!seen.has(hashKey(c.get("id")))) e.push(`${str(c.get("id"))}: not scored`);
  failOn(ctx, e, "merge (scored rows)");

  const mp = sc.get("mark_points") as PyDict;
  const ofac = sc.get("objective_factor") as PyDict;
  const mfac = sc.get("maturity_factor") as PyDict;
  const rows: PyDict[] = [];
  for (const c of b.caps) {
    const r = seen.get(hashKey(c.get("id")))!;
    const order = new Map<string, number>();
    reqsOf(c).forEach((q, i) => order.set(hashKey(idx(q, "id")), i));
    const marks = sortedBy(iter(idx(r, "marks")) as PyDict[], (m) => {
      const o = order.get(hashKey(idx(m, "requirement_id")));
      if (o === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(idx(m, "requirement_id"))}`);
      return o;
    });
    const v = deriveVerdict(marks);
    const scored = marks.filter((m) => m.get("mark") !== DESCOPED);
    const pointsOf = (mark: PyValue): PyValue => {
      const p = mp.get(str(mark));
      if (p === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(mark)}`);
      return p;
    };
    const fit: number | null = scored.length > 0 ? pyRound(num(pySum(scored.map((m) => pointsOf(m.get("mark")!)))) / scored.length) : null;
    const ws = iter(r.get("objective_ids")).map((o) => idx(objs.get(hashKey(o)), "weight"));
    const factor = (key: PyValue): PyValue => {
      const f = ofac.get(str(key));
      if (f === undefined || typeof key !== "string") throw new FitgapShapeError(`KeyError: ${pyRepr(key)}`);
      return f;
    };
    const factors = ws.length > 0 ? ws.map(factor) : [factor("none")];
    let of: PyValue = factors[0]!;
    for (const f of factors.slice(1)) if (pyCompare(f, of) > 0) of = f;
    const maturityFactor = mfac.get(str(c.get("maturity")));
    if (maturityFactor === undefined) throw new FitgapShapeError(`KeyError: ${pyRepr(c.get("maturity")!)}`);
    const pr = fit === null ? 0 : pyRound((100 - fit) * num(of) * num(maturityFactor));
    const tids: PyValue[] = [];
    for (const m of marks) for (const tc of iter(m.get("target_capability_ids"))) if (!tids.some((x) => pyEq(x, tc))) tids.push(tc);
    const why: PyValue[] = [];
    const effort = idx(r, "effort");
    if (inList(c.get("maturity"), ["proven", "available"]) && inList(effort, ["high", "unknown"]) && v !== "native" && v !== DESCOPED) why.push("decision");
    if (ws.some((x) => pyEq(x, "must")) && fit !== null && fit < 50) why.push("must_objective_gap");
    if (v === "gap" && pyEq(c.get("maturity"), "proven")) why.push("live_loss");
    if (pyEq(idx(r, "confidence"), "low") && v !== DESCOPED) why.push("open_question");
    if (v !== "native" && v !== DESCOPED && stripOrEmpty(get(r, "gap_detail")) === "") e.push(`${str(c.get("id"))}: verdict ${v} needs gap_detail (what is missing, in baseline terms)`);
    const ranks = iter(r.get("objective_ids"))
      .map((o) => objs.get(hashKey(o))!)
      .filter((o) => isPyNumber(getN(o, "rank")))
      .map((o) => idx(o, "rank"));
    let minRank: PyValue = null;
    for (const rk of ranks) if (minRank === null || pyCompare(rk, minRank) < 0) minRank = rk;
    const tr = or(tracks.get(hashKey(getN(r, "track"))) ?? null, new Map()) as PyDict;
    const statuses = [...new Map(tids.map((tc) => [hashKey(capOf(t, tc).get("status")), capOf(t, tc).get("status")!])).values()];
    rows.push(
      dict([
        ["baseline_capability_id", c.get("id")!],
        ["baseline_name", c.get("name")!],
        ["layer_id", c.get("layer_id")!],
        ["layer_code", c.get("layer_code")!],
        ["baseline_status", c.get("status")!],
        ["baseline_maturity", c.get("maturity")!],
        ["requirement_count", marks.length],
        ["verdict", v],
        ["fit_score", fit],
        ["priority", pr],
        ["objective_rank", ranks.length > 0 ? minRank : null],
        ["track", getN(r, "track")],
        ["track_name", getN(tr, "name")],
        ["track_order", getN(tr, "order")],
        ["owners", r.get("owners")!],
        ["confidence", idx(r, "confidence")],
        ["effort", effort],
        ["objective_ids", r.get("objective_ids")!],
        ["mark_counts", dict(MARKS.map((k) => [k, marks.filter((m) => m.get("mark") === k).length]))],
        ["target_capability_ids", tids],
        ["target_capability_names", tids.map((tc) => capOf(t, tc).get("name")!)],
        ["target_statuses", sortedBy(statuses, (x) => x)],
        ["evidence", strip(idx(r, "evidence"))],
        ["gap_detail", stripOrEmpty(get(r, "gap_detail"))],
        ["migration_note", strip(idx(r, "migration_note"))],
        ["why_listed", why],
        [
          "marks",
          marks.map((m) =>
            dict([
              ["requirement_id", m.get("requirement_id")!],
              ["mark", m.get("mark")!],
              ["target_capability_ids", m.get("target_capability_ids")!],
              ["note", stripOrEmpty(get(m, "note"))],
            ]),
          ),
        ],
      ]),
    );
  }

  const cited = new Set<string>();
  for (const r of rows) for (const tc of iter(r.get("target_capability_ids"))) cited.add(hashKey(tc));
  const expected = t.caps.map((c) => c.get("id")!).filter((id) => !cited.has(hashKey(id)));
  const only = new Map<string, PyDict>();
  for (const r0 of loadRows(ctx, a.only, "target-only rows")) {
    const tid = getN(r0, "target_capability_id");
    if (!hasCap(t, tid)) {
      e.push(`target-only '${str(tid)}': not a target capability id`);
      continue;
    }
    if (only.has(hashKey(tid))) {
      e.push(`target-only ${str(tid)}: listed twice`);
      continue;
    }
    const r = r0 as PyDict;
    only.set(hashKey(tid), r);
    r.set("objective_ids", splitList(getN(r, "objective_ids")));
    for (const o of iter(r.get("objective_ids"))) if (!inMap(objs, o)) e.push(`target-only ${str(tid)}: objective ${str(o)} is not in the frame`);
    if (!inList(getN(r, "confidence"), CONF)) e.push(`target-only ${str(tid)}: confidence '${str(getN(r, "confidence"))}' must be one of ${CONF.join(", ")}`);
    if (!inList(getN(r, "effort"), EFFORT)) e.push(`target-only ${str(tid)}: effort '${str(getN(r, "effort"))}' must be one of ${EFFORT.join(", ")}`);
    if (lenStrip(get(r, "evidence")) < 60) e.push(`target-only ${str(tid)}: evidence is missing or under 60 characters`);
    if (stripOrEmpty(get(r, "opportunity")) === "") e.push(`target-only ${str(tid)}: opportunity is empty`);
  }
  const onlyIds = [...only.values()].map((r) => r.get("target_capability_id")!);
  const miss = expected.filter((x) => !only.has(hashKey(x)));
  const extraOnly = onlyIds.filter((x) => !expected.some((y) => pyEq(y, x)) && hasCap(t, x));
  if (a.draft && a.only.length === 0) print(ctx, `  note: target-only pass not done yet (${expected.length} uncited target capabilities)`);
  else if (miss.length > 0) e.push(`target-only pass: no row for ${miss.length} uncited target capabilities: ${joinStr(", ", miss.slice(0, 8))}${miss.length > 8 ? " \u2026" : ""}. Run uncited to list them.`);
  if (extraOnly.length > 0) e.push(`target-only rows for capabilities that marks already cite: ${joinStr(", ", extraOnly.slice(0, 8))}`);

  const f = a.findings !== undefined && a.findings !== "" ? load(ctx, a.findings) : null;
  if (f === null && !a.draft) e.push("no findings file. Pass --findings, or --draft for a working build");
  if (f !== null) {
    const h = iter(or(get(f, "headline"), [])).filter((x) => pyStrip(str(x)) !== "");
    if (!(h.length >= 3 && h.length <= 7)) e.push(`findings.headline needs 3 to 7 entries (has ${h.length})`);
    const have = new Set(
      iter(or(get(f, "layers"), []))
        .filter((x) => stripOrEmpty(get(x, "text")) !== "")
        .map((x) => hashKey(getN(x, "layer_code"))),
    );
    const need: PyValue[] = [];
    for (const c of b.caps) if (!need.some((x) => pyEq(x, c.get("layer_code")))) need.push(c.get("layer_code")!);
    const lack = need.filter((x) => !have.has(hashKey(x)));
    if (lack.length > 0) e.push(`findings.layers has no text for baseline layers: ${joinStr(", ", lack)}`);
    for (const k of ["opportunities", "open_questions"]) if (!isList(get(f, k, []) ?? null)) e.push(`findings.${k} must be a list of strings`);
  }
  if (!a.draft && !truthy(get(fr.data, "objectives_confirmed_by"))) {
    e.push("objectives_confirmed_by is empty in the frame. The person must confirm the objectives and weights before the final build (use --draft until then)");
  }

  const r0 = new Map<string, PyDict>(rows.map((r) => [hashKey(r.get("baseline_capability_id")), r]));
  const todos = a.todos.length > 0 ? loadRows(ctx, a.todos, "to-do rows") : [];
  if (tracks.size > 0 && todos.length === 0 && !a.draft) e.push("the frame has tracks and owners but no to-do list. Pass --todos, or --draft for a working build");
  const tidsSeen = counts(todos.map((td) => getN(td, "id")));
  const tidKeys = new Set(tidsSeen.map(([k]) => hashKey(k)));
  for (const [k, n] of tidsSeen) if (n > 1) e.push(`to-do id ${str(k)} is used ${n} times`);
  for (const td0 of todos) {
    const td = td0 as PyDict;
    const tid = or(get(td, "id"), "?");
    if (typeof tid !== "string") throw new FitgapShapeError("TypeError: expected string or bytes-like object, got 'int'");
    if (!new RegExp(`^TD-${UNICODE_DIGITS}{2,3}$`, "u").test(tid)) e.push(`to-do id '${tid}' must look like TD-01`);
    if (stripOrEmpty(get(td, "title")) === "") e.push(`${tid}: title is empty`);
    if (lenStrip(get(td, "detail")) < 30) e.push(`${tid}: detail is missing or under 30 characters`);
    if (!inList(getN(td, "owner"), owners)) e.push(`${tid}: owner '${str(getN(td, "owner"))}' is not in the frame owners`);
    td.set("support", splitList(getN(td, "support")));
    for (const o of iter(td.get("support"))) if (!inList(o, owners)) e.push(`${tid}: support '${str(o)}' is not in the frame owners`);
    if (!inMap(tracks, getN(td, "track"))) e.push(`${tid}: track '${str(getN(td, "track"))}' is not a frame track`);
    if (!inList(getN(td, "type"), TODO_TYPES)) e.push(`${tid}: type '${str(getN(td, "type"))}' must be one of ${TODO_TYPES.join(", ")}`);
    for (const [k_, ok] of [
      ["capability_ids", (x: PyValue) => hasCap(b, x)],
      ["objective_ids", (x: PyValue) => inMap(objs, x)],
      ["depends_on", (x: PyValue) => tidKeys.has(hashKey(x))],
    ] as [string, (x: PyValue) => boolean][]) {
      td.set(k_, splitList(getN(td, k_)));
      for (const x of iter(td.get(k_))) if (!ok(x)) e.push(`${tid}: ${k_} has unknown id ${str(x)}`);
    }
  }
  failOn(ctx, e, "merge");

  const rankOf = (r: PyDict): PyValue => (r.get("objective_rank") !== null ? r.get("objective_rank")! : 99);
  const olist: PyDict[] = [];
  for (const o0 of iter(or(get(fr.data, "objectives"), []))) {
    const o = o0 as PyDict;
    const linked = rows.filter((r) => inList(o.get("id"), iter(r.get("objective_ids"))));
    const top = sortedBy(
      linked.filter((r) => r.get("verdict") !== "native" && r.get("verdict") !== DESCOPED),
      (r) => -(r.get("priority") as number),
    ).slice(0, 5);
    const entry = dict(["id", "name", "weight", "rank", "statement", "measure", "source"].map((k) => [k, getN(o, k)]));
    entry.set("linked_capabilities", linked.length);
    entry.set("average_fit", avgOf(linked.map((r) => r.get("fit_score"))));
    entry.set("verdicts", dict(VERDICTS.map((v) => [v, linked.filter((r) => r.get("verdict") === v).length])));
    entry.set(
      "top_gaps",
      top.map((r) => r.get("baseline_capability_id")!),
    );
    entry.set(
      "target_only",
      [...only.values()].filter((x) => inList(o.get("id"), iter(x.get("objective_ids")))).map((x) => x.get("target_capability_id")!),
    );
    olist.push(entry);
  }
  const tlist0: PyDict[] = [];
  for (const td0 of todos) {
    const td = td0 as PyDict;
    const linked = iter(td.get("capability_ids")).map((cid) => r0.get(hashKey(cid))!);
    const tr = tracks.get(hashKey(td.get("track")))!;
    let maxPriority: PyValue = null;
    const priorities = linked.length > 0 ? linked.map((r) => r.get("priority")!) : [null];
    let best: PyValue = priorities[0]!;
    for (const p of priorities.slice(1)) if (num(or(p, 0)) > num(or(best, 0))) best = p;
    maxPriority = best;
    tlist0.push(
      dict([
        ["id", idx(td, "id")],
        ["title", strip(idx(td, "title"))],
        ["owner", idx(td, "owner")],
        ["support", td.get("support")!],
        ["track", idx(td, "track")],
        ["track_name", idx(tr, "name")],
        ["track_order", idx(tr, "order")],
        ["sequence", getN(td, "sequence")],
        ["type", idx(td, "type")],
        ["detail", strip(idx(td, "detail"))],
        ["capability_ids", td.get("capability_ids")!],
        ["objective_ids", td.get("objective_ids")!],
        ["depends_on", td.get("depends_on")!],
        ["max_priority", maxPriority],
      ]),
    );
  }
  const tlist = sortedBy(tlist0, (td) => [td.get("track_order"), td.get("sequence") !== null ? td.get("sequence") : 999, td.get("id")]);
  for (const r of rows) {
    r.set(
      "todo_ids",
      tlist.filter((td) => inList(r.get("baseline_capability_id"), iter(td.get("capability_ids")))).map((td) => td.get("id")!),
    );
  }
  const tonly: PyDict[] = expected
    .filter((tc) => only.has(hashKey(tc)))
    .map((tc) => {
      const cap = capOf(t, tc);
      const o = only.get(hashKey(tc))!;
      return dict([
        ["target_capability_id", tc],
        ["target_name", cap.get("name")!],
        ["layer_code", cap.get("layer_code")!],
        ["target_status", cap.get("status")!],
        ["target_maturity", cap.get("maturity")!],
        ["requirement_count", reqsOf(cap).length],
        ["objective_ids", o.get("objective_ids")!],
        ["confidence", idx(o, "confidence")],
        ["effort", idx(o, "effort")],
        ["evidence", strip(idx(o, "evidence"))],
        ["opportunity", strip(idx(o, "opportunity"))],
      ]);
    });
  const allm = rows.flatMap((r) => iter(r.get("marks")) as PyDict[]);
  const tracksSorted = sortedBy([...tracks.values()], (tr) => idx(tr, "order"));
  const meta = dict([
    ["schema", "fit-gap-analysis/1"],
    ["title", or(get(fr.data, "title"), `${str(b.name)} to ${str(t.name)}`)],
    ["mode", get(fr.data, "mode", "replacement") ?? null],
    ["generated", a.date],
    ["draft", a.draft],
    ["objectives_confirmed_by", or(get(fr.data, "objectives_confirmed_by"), "")],
    [
      "baseline",
      dict([
        ["code", b.code],
        ["name", b.name],
        ["source", b.source],
        ["capabilities", b.caps.length],
        ["requirements", allm.length],
      ]),
    ],
    [
      "target",
      dict([
        ["code", t.code],
        ["name", t.name],
        ["source", t.source],
        ["capabilities", t.caps.length],
        ["requirements", t.caps.reduce((n, c) => n + reqsOf(c).length, 0)],
      ]),
    ],
    ["scoring", sc],
    ["tracks", tracksSorted],
    ["owners", owners],
    ["owner_roles", or(get(fr.data, "owner_roles"), new Map())],
    [
      "counts",
      dict([
        ["verdicts", dict(VERDICTS.map((v) => [v, rows.filter((r) => r.get("verdict") === v).length]))],
        ["marks", dict(MARKS.map((k) => [k, allm.filter((m) => m.get("mark") === k).length]))],
        ["average_fit", avgOf(rows.map((r) => r.get("fit_score")))],
        ["why_listed", dict(WHY.map((k) => [k, rows.filter((r) => iter(r.get("why_listed")).includes(k)).length]))],
        ["target_only", tonly.length],
        ["todos", tlist.length],
        ["todos_by_owner", dict(owners.map((o) => [str(o), tlist.filter((td) => pyEq(td.get("owner"), o)).length]))],
      ]),
    ],
  ]);
  const out = pyJoinPath(a.out, `${lower(b.code)}-${lower(t.code)}-fit-gap-analysis.json`);
  const plan = ctx.files.plan();
  dumpTo(
    plan,
    dict([
      ["meta", meta],
      ["objectives", olist],
      ["rows", rows],
      ["target_only", tonly],
      ["todos", tlist],
      [
        "findings",
        truthy(f)
          ? f!
          : dict([
              ["headline", []],
              ["layers", []],
              ["opportunities", []],
              ["open_questions", []],
            ]),
      ],
    ]),
    out,
  );
  commitPlan(ctx, plan);
  const c = meta.get("counts") as PyDict;
  print(ctx, `merge[${str(b.code)}->${str(t.code)}]${a.draft ? " DRAFT" : ""}: ${rows.length} rows, ${allm.length} marks, ${tonly.length} target-only, ${tlist.length} to-dos -> ${out}`);
  print(ctx, `  verdicts ${pyRepr(c.get("verdicts")!)}`);
  print(ctx, `  marks    ${pyRepr(c.get("marks")!)}`);
  print(ctx, `  average fit ${pyRepr(c.get("average_fit")!)}, listed ${pyRepr(c.get("why_listed")!)}, to-dos by owner ${pyRepr(c.get("todos_by_owner")!)}`);
  const byFile = new Map<string, PyValue[]>();
  for (const r of rows) {
    const file = str(seen.get(hashKey(r.get("baseline_capability_id")))!.get("_file") ?? null);
    const list = byFile.get(file);
    if (list === undefined) byFile.set(file, [r.get("fit_score")!]);
    else list.push(r.get("fit_score")!);
  }
  print(
    ctx,
    `  average fit by file (check outliers for grader drift): ${[...byFile]
      .sort((x, y) => pyCompare(x[0], y[0]))
      .map(([file, v]) => `${file} ${pyRepr(avgOf(v))}`)
      .join(", ")}`,
  );
  for (const r of sortedBy(rows, (r) => [-(r.get("priority") as number), rankOf(r)]).slice(0, 5)) {
    print(ctx, `  top: ${fmt(r.get("priority"), 3)}  ${fmt(r.get("baseline_capability_id"), 12)} ${fmt(r.get("verdict"), 12)} fit ${pyRepr(r.get("fit_score")!)}  ${str(r.get("baseline_name"))}`);
  }
}

// ---------------------------------------------------------------- workbook

export function cmdWorkbook(ctx: FitgapContext, framePath: string, fitgapPath: string, outPath: string | undefined): boolean {
  const fr = readFrame(ctx, framePath);
  const b = loadSystem(ctx, fr, "baseline");
  const t = loadSystem(ctx, fr, "target");
  const g = load(ctx, fitgapPath);
  return buildWorkbook(ctx, fr, b, t, g, fitgapPath, outPath);
}

export type { Num };
