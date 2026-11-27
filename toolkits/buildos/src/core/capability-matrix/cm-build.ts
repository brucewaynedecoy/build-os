/**
 * `buildos capability-matrix`: the port of `cm_build.py`, the tool that the
 * capability-matrix skill embedded in its appendix (W1 R7 P9, F-P9-04),
 * deterministic build and validate tooling for capability-matrix runs:
 *
 *   skeleton  check a skeleton before dispatching extractors (ids, prefixes, types, statuses, scope briefs)
 *   assemble  skeleton + extraction parts  ->  <code>-capability-model.json, -capabilities.csv, -requirements.csv
 *   fitgap    scored rows + models          ->  <b>-<t>-fit-gap.json / .csv   (replacement|selection|integration)
 *   validate  model [+narrative] [+fitgap]  ->  PASS/FAIL lines, a failed check is exit 4
 *
 * Every check, message, and written byte is the script's (the block pinned
 * in test/golden/skills/script-sha256.json): JSON is read and written as
 * Python's `json` module does it, CSV as its `csv` module writes it, and
 * every value follows Python's rules (`py-values.ts`, `fitgap/py.ts`), so a
 * value of the wrong type stops where the script crashed. What differs is
 * recorded in test/golden/skills/divergences.json (SD-23 to SD-27): a crash
 * is one plain line; reads, matches, and writes stay inside the project; a
 * failed run writes nothing; the bytes are the same on every system; a
 * system code with a pattern character stops the id check; and a set is
 * sorted from its first-seen order, not Python's hash order.
 */

import { sep } from "node:path";
import { ProjectFileError, type WritePlan } from "../shared/project-files.ts";
import { isDict, isList, pyRepr, pyStrip, pyUniversalNewlines, type PyDict, type PyValue } from "../shared/py-json.ts";
import { PyException, pyDecodeUtf8 } from "../shared/py-text.ts";
import { READ_LIMITS } from "../shared/read-limits.ts";
import { pyCsvRows } from "../extract/py-lines.ts";
import { FitgapInput, load as fitgapLoad, osLookup, pyGlob, type FitgapContext } from "../fitgap/fitgap.ts";
import { FitgapShapeError, fmt, get, iter, truthy, type V } from "../fitgap/py.ts";
import {
  PyMap,
  PySet,
  backslashReplace,
  checkEncodable,
  cmDumpChunks,
  concat,
  counter,
  counterJson,
  counterRepr,
  f,
  getOr,
  gi,
  inStrings,
  indexOf,
  joinBars,
  lower,
  popKey,
  pyDirname,
  pyEqual,
  pyIn,
  pyIntOf,
  pyLength,
  pyOrder,
  pySorted,
  setDefault,
  setItem,
  split,
  type JsonOut,
} from "./py-values.ts";

const TYPES = new Set(["process", "capability", "configuration", "data_entity", "state_model", "workflow", "architecture", "integration", "report", "document"]);
const KINDS = new Set(["rule", "behavior", "data", "setting", "dependency"]);
const SCOPES = new Set(["global", "location", "account", "category", "agreement", "transaction", "document", "role", "rule", "multi"]);
const SCOPE_ALIASES = new Map([
  ["pricing class", "category"],
  ["class", "category"],
  ["template", "rule"],
  ["setup", "rule"],
  ["user", "role"],
  ["contract", "agreement"],
]);
const MATURITY = new Set(["proven", "available", "partial", "planned", "deferred"]);
const ORIGINS = new Set(["captured", "derived", "merged"]);
const VERDICTS = new Set(["native", "partial", "configurable", "gap", "preview_gap"]);
const OVERLAPS = new Set(["exclusive", "duplicate", "complementary", "handoff"]);
const CONF = new Set(["high", "medium", "low"]);
const EFFORT = new Set(["none", "low", "medium", "high", "unknown"]);
const CAP_FIELDS = ["id", "parent_id", "name", "layer_id", "doc_ref", "type", "status", "maturity", "origin", "source_refs", "summary", "personas", "triggers", "outcomes", "entities", "dependencies", "provenance", "source", "tags", "requirements"];
const REQ_FIELDS = ["id", "kind", "status", "maturity", "text", "option_values", "option_default", "option_scope", "source_refs"];
const LISTS = ["source_refs", "personas", "triggers", "outcomes", "entities", "dependencies", "provenance", "source", "tags"];

/** `sorted(...)` of a fixed vocabulary, by code point. */
const sortedNames = (set: ReadonlySet<string>): string[] => [...set].sort((a, b) => pyOrder(a, b));

/** `sys.exit(message)`: the message on stderr (PRD 20: exit 4). */
export class CmStop extends Error {}
/** FAIL lines were printed on stdout (exit 4). */
export class CmFail extends Error {}
/** Divergence SD-26: the system code has a character that a regular expression reads specially (exit 4). */
export class CmPatternCode extends Error {}

export interface CmContext extends FitgapContext {}

function print(ctx: CmContext, line: string): void {
  // Python's print stops on a character it cannot write as UTF-8 (a lone surrogate), after the lines before it.
  checkEncodable(line);
  ctx.out.push(`${line}\n`);
}

function stop(message: string): never {
  throw new CmStop(backslashReplace(message));
}

/** `json.load(open(p, encoding='utf-8'))`; a path that is not a string is the `TypeError` of `open`. */
function load(ctx: CmContext, path: V): PyValue {
  if (typeof path !== "string") throw new FitgapShapeError(`TypeError: expected str, bytes or os.PathLike object, not ${path === null || path === undefined ? "NoneType" : typeof path}`);
  // `open('')` names no file (an empty --model=, --baseline=, ...); BuildOS would resolve it to the project folder.
  if (path === "") throw new FitgapInput("[Errno 2] No such file or directory: ''");
  checkOpen(ctx, path);
  return fitgapLoad(ctx, path);
}

/**
 * The error of `open(path)` that the path's own spelling gives, before
 * BuildOS reads it (review round 2, finding 1): a name before the last that
 * is not a folder (`p.json/`, `p.json/.`, `p.json/../p.json`), a missing
 * one (`gone/../p.json`), or a folder where the file belongs.
 */
function checkOpen(ctx: CmContext, path: string): void {
  const found = osLookup(ctx.files, path);
  if (found === "ENOENT" || found === "dangling") throw new FitgapInput(`[Errno 2] No such file or directory: ${pyRepr(path)}`);
  if (found === "ENOTDIR") throw new FitgapInput(`[Errno 20] Not a directory: ${pyRepr(path)}`);
  if (found === "directory") throw new FitgapInput(`[Errno 21] Is a directory: ${pyRepr(path)}`);
}

/** `sorted(f for p in pats for f in glob.glob(p))`: every match of every pattern, sorted, a file named twice kept twice. */
function globs(ctx: CmContext, patterns: readonly string[]): string[] {
  const found: string[] = [];
  for (const p of patterns) found.push(...pyGlob(ctx, p, { spelled: true }));
  return [...found].sort((a, b) => pyOrder(a, b));
}

/** The text of a UTF-8 file as Python's text mode reads it (universal newlines; a byte order mark kept). */
function readText(ctx: CmContext, path: string): string {
  checkOpen(ctx, path);
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
    return pyUniversalNewlines(pyDecodeUtf8(data));
  } catch (error) {
    if (error instanceof PyException) throw new FitgapInput(`${path} is not UTF-8 text: ${error.message}`);
    throw error;
  }
}

/** A `csv.writer` field: `None` is empty, any other value its `str()`. */
function csvField(v: V): string {
  const text = v === null || v === undefined ? "" : f(v);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One `csv.writer` row (excel dialect, `\r\n`). */
function csvRow(values: readonly V[]): string {
  const fields = values.map(csvField);
  if (fields.length === 1 && fields[0] === "") return '""\r\n';
  return `${fields.join(",")}\r\n`;
}

/** The fixed part of the id pattern after `<code>-`: `[A-Z]{2,4}-\d{2,3}[a-z]?` with Python's `\d` (any Unicode decimal digit). */
const ID_SUFFIX = /^[A-Z]{2,4}-\p{Nd}{2,3}[a-z]?$/u;

/** A character that Python's `re` reads specially in the system code (SD-26). */
const PATTERN_CHARACTER = /[\\.^$*+?{}[\]|()]/;

/**
 * `re.fullmatch(rf'{code}-[A-Z]{{2,4}}-\d{{2,3}}[a-z]?', id)`, checked from
 * the first id on, as the script compiled the pattern there. A code with no
 * pattern character is plain text in Python's pattern, so the id must start
 * with the code and a dash, as a literal prefix, and the rest must match the
 * fixed suffix. No pattern is built from the code (review round 1, SD-26).
 */
function idPattern(code: V): (id: V) => boolean {
  let prefix: string | undefined;
  return (id: V): boolean => {
    if (prefix === undefined) {
      const text = f(code);
      // SD-26: Python reads the code as part of its pattern. A code with a pattern character stops here instead.
      if (PATTERN_CHARACTER.test(text)) throw new CmPatternCode(`the system code ${pyRepr(code ?? null)} has a character that the id check reads as a pattern (one of \\ . ^ $ * + ? { } [ ] | ( )). Use a code of letters and digits.`);
      prefix = `${text}-`;
    }
    if (typeof id !== "string") throw new FitgapShapeError(`TypeError: expected string or bytes-like object, got '${id === null || id === undefined ? "NoneType" : isList(id) ? "list" : isDict(id) ? "dict" : typeof id === "boolean" ? "bool" : typeof id === "number" || typeof id === "bigint" ? "int" : "float"}'`);
    return id.startsWith(prefix) && ID_SUFFIX.test(id.slice(prefix.length));
  };
}

/** `{key(x): value(x) for x in items}`. */
function mapOf<T>(items: readonly PyValue[], key: (x: PyValue) => V, value: (x: PyValue) => T): PyMap<T> {
  const out = new PyMap<T>();
  for (const x of items) {
    const k = key(x);
    out.set(k, value(x));
  }
  return out;
}

/**
 * Writes the chunks that the script handed to `f.write` one at a time (the
 * JSON encoder's chunks, or one CSV row each), each checked as UTF-8 first:
 * the script crashed on a lone surrogate, at a position counted in its chunk.
 * A CSV file starts with the byte order mark of `utf-8-sig`.
 */
function planWrite(plan: WritePlan, path: string, chunks: readonly string[], bom = false): void {
  for (const chunk of chunks) checkEncodable(chunk);
  plan.write(path, `${bom ? "\ufeff" : ""}${chunks.join("")}`, { limit: READ_LIMITS.data });
}

/**
 * The errors of `os.makedirs(out, exist_ok=True)`, before BuildOS plans a
 * write (review round 2): an empty name; `out` itself a file (`[Errno 17]
 * File exists`, or `[Errno 20]` with a final separator, as macOS's `mkdir`
 * reports it); a file before its last name, named with the folder that
 * `makedirs` tried to make in it (`[Errno 20] Not a directory: 'p.json/x'`).
 * A missing folder is made when the run writes; `.` and `..` are folded as
 * text (SD-24).
 */
function checkOut(ctx: CmContext, out: string): void {
  if (out === "") throw new FitgapInput("[Errno 2] No such file or directory: ''");
  const separator = sep === "\\" ? /[\\/]/ : /\//;
  const names: { end: number }[] = [];
  const pattern = sep === "\\" ? /[^\\/]+/g : /[^/]+/g;
  for (const m of out.matchAll(pattern)) names.push({ end: m.index + m[0].length });
  const trailing = separator.test(out.slice(-1));
  for (let k = 0; k < names.length; k++) {
    const at = out.slice(0, names[k]!.end);
    if (ctx.files.inside(at) === undefined) continue;
    const found = osLookup(ctx.files, at);
    if (found === "directory") continue;
    if (found !== "file") return;
    if (k === names.length - 1) throw new FitgapInput(trailing ? `[Errno 20] Not a directory: ${pyRepr(out)}` : `[Errno 17] File exists: ${pyRepr(out)}`);
    const made = k + 1 === names.length - 1 ? out : out.slice(0, names[k + 1]!.end);
    throw new FitgapInput(`[Errno 20] Not a directory: ${pyRepr(made)}`);
  }
}

function commit(ctx: CmContext, plan: WritePlan): void {
  const { leftBehind } = plan.commit();
  ctx.written.push(...plan.written);
  ctx.leftBehind.push(...leftBehind);
  for (const left of leftBehind) ctx.notices.push(`capability-matrix: BuildOS wrote the output, but could not delete ${left.path} (${left.reason}).`);
}

// ---------------------------------------------------------------- skeleton

export function cmSkeleton(ctx: CmContext, skeletonPath: string): void {
  const sk = load(ctx, skeletonPath);
  const code = gi(gi(sk, "system"), "code");
  const LC = mapOf(iter(gi(sk, "layers")), (l) => gi(l, "id"), (l) => gi(l, "code"));
  const caps = gi(sk, "capabilities");
  const bad: string[] = [];
  const ids = iter(caps).map((c) => gi(c, "id"));
  if (ids.length !== new PySet(ids).size) bad.push("duplicate ids");
  const matches = idPattern(code);
  const system = () => gi(sk, "system");
  for (const c of iter(caps)) {
    if (!matches(gi(c, "id"))) bad.push(`${f(gi(c, "id"))}: id format`);
    if (!pyEqual(gi(split(gi(c, "id"), "-"), 1), LC.get(gi(c, "layer_id")) ?? null)) bad.push(`${f(gi(c, "id"))}: prefix does not match layer ${f(gi(c, "layer_id"))}`);
    if (!inStrings(gi(c, "type"), TYPES)) bad.push(`${f(gi(c, "id"))}: type '${f(gi(c, "type"))}'`);
    if (!pyIn(gi(c, "status"), gi(system(), "status_vocabulary"))) bad.push(`${f(gi(c, "id"))}: status '${f(gi(c, "status"))}'`);
    if (!pyIn(gi(c, "status"), gi(system(), "maturity_map"))) bad.push(`${f(gi(c, "id"))}: status '${f(gi(c, "status"))}' has no maturity_map entry`);
    if (!truthy(getOr(system(), "converted")) && pyLength(truthy(getOr(c, "scope")) ? getOr(c, "scope") : "") < 60) bad.push(`${f(gi(c, "id"))}: scope brief too thin for an extractor`);
  }
  for (const pr of iter(getOr(sk, "design_principles", []))) {
    if (!["id", "name", "statement"].every((k) => truthy(getOr(pr, k)))) bad.push(`design principle ${f(getOr(pr, "id"))}: needs id, name, statement`);
  }
  const by = counter(iter(caps).map((c) => gi(c, "layer_id")));
  for (const l of iter(gi(sk, "layers"))) print(ctx, `  ${fmt(gi(l, "id"), 4)} ${fmt(gi(l, "code"), 5)} ${fmt(by.get(gi(l, "id")) ?? 0, 4)}  ${f(gi(l, "name"))}`);
  print(ctx, `skeleton[${f(code)}]: ${pyLength(caps)} capabilities, status=${counterRepr(counter(iter(caps).map((c) => gi(c, "status"))))}`);
  if (bad.length > 0) {
    // One print of the joined lines, as the script printed them.
    print(ctx, bad.map((b) => `  FAIL  ${b}`).join("\n"));
    throw new CmFail("skeleton");
  }
  print(ctx, "  skeleton OK");
}

// ---------------------------------------------------------------- assemble

export interface AssembleArgs {
  skeleton: string;
  parts: string[];
  out: string;
  date: string;
}

export function cmAssemble(ctx: CmContext, a: AssembleArgs): void {
  const sk = load(ctx, a.skeleton);
  const sysb = gi(sk, "system");
  const code = gi(sysb, "code");
  const low = lower(code);
  const smap = gi(sysb, "maturity_map");
  const svocab = gi(sysb, "status_vocabulary");
  const order = iter(gi(sk, "capabilities")).map((c) => gi(c, "id"));
  const skel = mapOf(iter(gi(sk, "capabilities")), (c) => gi(c, "id"), (c) => c);
  const caps: PyValue[] = [];
  for (const file of globs(ctx, a.parts)) caps.push(...iter(load(ctx, file)));
  const got = new PySet(caps.map((c) => gi(c, "id")));
  const want = new PySet(order);
  const miss = want.minus(got);
  const extra = got.minus(want);
  if (miss.size > 0 || extra.size > 0) {
    const sortedRepr = (s: PySet): string => pyRepr(pySorted(s.keys(), (x) => x));
    stop(`assemble: skeleton/parts mismatch  missing=${sortedRepr(miss)} extra=${sortedRepr(extra)}`);
  }
  const sortedCaps = pySorted(caps, (c) => indexOf(order, gi(c, "id")));
  const warn = new PyMap<number>();
  const bump = (key: string): void => warn.set(key, (warn.get(key) ?? 0) + 1);
  for (const c of sortedCaps) {
    const s = skel.at(gi(c, "id"));
    for (const field of ["layer_id", "doc_ref", "type", "name"]) {
      const sv = gi(s, field);
      if (!pyEqual(getOr(c, field), sv)) {
        bump(`restored_${field}`);
        setItem(c, field, gi(s, field));
      }
    }
    popKey(c, "_status_note");
    setDefault(c, "parent_id", null);
    setDefault(c, "origin", getOr(s, "origin", "derived") as PyValue);
    setDefault(c, "source_refs", getOr(s, "source_refs", []) as PyValue);
    if (!pyIn(gi(c, "status"), svocab)) stop(`assemble: ${f(gi(c, "id"))} status '${f(gi(c, "status"))}' not in system.status_vocabulary`);
    setItem(c, "maturity", gi(smap, gi(c, "status")));
    for (const lf of LISTS) {
      const v = getOr(c, lf);
      setItem(c, lf, truthy(v) ? v! : []);
    }
    const reqs: PyValue[] = [];
    iter(getOr(c, "requirements", []) ?? null).forEach((r, index) => {
      const rid = `${f(gi(c, "id"))}-R${String(index + 1).padStart(2, "0")}`;
      if (truthy(get(r, "id")) && !pyEqual(gi(r, "id"), rid)) bump("renumbered_req");
      setItem(r, "id", rid);
      if (!pyIn(gi(r, "status"), svocab)) stop(`assemble: ${rid} status '${f(gi(r, "status"))}' not in vocabulary`);
      setItem(r, "maturity", gi(smap, gi(r, "status")));
      for (const k of ["option_values", "option_default", "option_scope"]) setDefault(r, k, null);
      const scope = gi(r, "option_scope");
      if (inStrings(scope, new Set(SCOPE_ALIASES.keys()))) {
        bump(`scope_alias_${scope as string}`);
        setItem(r, "option_scope", SCOPE_ALIASES.get(scope as string)!);
      }
      if (!pyEqual(gi(r, "kind"), "setting")) {
        if (truthy(gi(r, "option_scope")) || truthy(gi(r, "option_values"))) bump("scope_stripped_nonsetting");
        setItem(r, "option_values", null);
        setItem(r, "option_default", null);
        setItem(r, "option_scope", null);
      } else if (truthy(gi(r, "option_values"))) {
        setItem(
          r,
          "option_values",
          f(gi(r, "option_values"))
            .split("|")
            .map((p) => pyStrip(p))
            .join("|"),
        );
      }
      const refs = getOr(r, "source_refs");
      setItem(r, "source_refs", truthy(refs) ? refs! : []);
      reqs.push(new Map(REQ_FIELDS.map((k) => [k, getOr(r, k) ?? null])));
    });
    setItem(c, "requirements", reqs);
  }
  const outCaps: PyDict[] = sortedCaps.map((c) => new Map(CAP_FIELDS.map((k) => [k, getOr(c, k) ?? null])));
  const reqs: PyValue[] = outCaps.flatMap((c) => iter(c.get("requirements")));
  if (!isDict(sysb)) throw new FitgapShapeError("TypeError: list indices must be integers or slices, not str");
  const meta = new Map<string, JsonOut>();
  for (const [k, v] of sysb) if (k !== "maturity_map" && k !== "status_vocabulary") meta.set(k, v);
  const counts = new Map<string, JsonOut>([
    ["layers", pyLength(gi(sk, "layers"))],
    ["capabilities", outCaps.length],
    ["requirements", reqs.length],
    ["design_principles", pyLength(getOr(sk, "design_principles", []))],
    ["capabilities_by_status", counterJson(counter(outCaps.map((c) => c.get("status"))))],
    ["requirements_by_status", counterJson(counter(reqs.map((r) => gi(r, "status"))))],
    ["capabilities_by_maturity", counterJson(counter(outCaps.map((c) => c.get("maturity"))))],
  ]);
  const vocabularies = new Map<string, JsonOut>([
    ["status", svocab],
    ["maturity_map", smap],
    ["maturity", sortedNames(MATURITY)],
    ["capability_type", sortedNames(TYPES)],
    ["requirement_kind", sortedNames(KINDS)],
    ["option_scope", sortedNames(SCOPES)],
    ["origin", sortedNames(ORIGINS)],
  ]);
  meta.set("generated", a.date);
  meta.set("counts", counts);
  meta.set("vocabularies", vocabularies);
  const model = new Map<string, JsonOut>([
    ["schema_version", "4"],
    ["meta", meta],
    ["layers", gi(sk, "layers")],
    ["design_principles", getOr(sk, "design_principles", []) ?? null],
    ["capabilities", outCaps],
    ["capability_tree", outCaps.map((c) => new Map<string, PyValue>([["id", c.get("id")!], ["name", c.get("name")!], ["status", c.get("status")!], ["maturity", c.get("maturity")!], ["layer_id", c.get("layer_id")!], ["requirement_count", pyLength(c.get("requirements"))]]))],
  ]);
  checkOut(ctx, a.out);
  const plan = ctx.files.plan();
  plan.folder(a.out);
  planWrite(plan, `${a.out}/${low}-capability-model.json`, cmDumpChunks(model));
  const LM = mapOf(iter(gi(sk, "layers")), (l) => gi(l, "id"), (l) => l);
  const capsCsv = [csvRow(["system", "capability_id", "parent_id", "layer_id", "layer_code", "layer_name", "doc_ref", "capability_type", "status", "maturity", "origin", "source_refs", "name", "summary", "personas", "triggers", "outcomes", "entities", "dependencies", "provenance", "source", "tags", "requirement_count"])];
  for (const c of outCaps) {
    const L = LM.at(c.get("layer_id"));
    const parent = c.get("parent_id");
    capsCsv.push(csvRow([
      code,
      c.get("id"),
      truthy(parent) ? parent : "",
      c.get("layer_id"),
      gi(L, "code"),
      gi(L, "name"),
      c.get("doc_ref"),
      c.get("type"),
      c.get("status"),
      c.get("maturity"),
      c.get("origin"),
      joinBars(c.get("source_refs")),
      c.get("name"),
      c.get("summary"),
      ...["personas", "triggers", "outcomes", "entities", "dependencies", "provenance", "source", "tags"].map((k) => joinBars(c.get(k))),
      pyLength(c.get("requirements")),
    ]));
  }
  planWrite(plan, `${a.out}/${low}-capabilities.csv`, capsCsv, true);
  const reqsCsv = [csvRow(["system", "requirement_id", "capability_id", "capability_name", "layer_id", "layer_code", "layer_name", "doc_ref", "requirement_kind", "status", "maturity", "text", "option_values", "option_default", "option_scope", "source_refs"])];
  for (const c of outCaps) {
    const L = LM.at(c.get("layer_id"));
    for (const r of iter(c.get("requirements"))) {
      const or = (key: string): PyValue => (truthy(gi(r, key)) ? gi(r, key) : "");
      reqsCsv.push(csvRow([code, gi(r, "id"), c.get("id"), c.get("name"), c.get("layer_id"), gi(L, "code"), gi(L, "name"), c.get("doc_ref"), gi(r, "kind"), gi(r, "status"), gi(r, "maturity"), gi(r, "text"), or("option_values"), or("option_default"), or("option_scope"), joinBars(gi(r, "source_refs"))]));
    }
  }
  planWrite(plan, `${a.out}/${low}-requirements.csv`, reqsCsv, true);
  const line = `assemble[${f(code)}]: ${outCaps.length} capabilities, ${reqs.length} requirements -> ${a.out}/${low}-*  warnings=${counterRepr(warn)}`;
  checkEncodable(line);
  commit(ctx, plan);
  print(ctx, line);
}

// ---------------------------------------------------------------- fitgap

interface Indexed {
  m: PyValue;
  caps: PyMap<PyValue>;
  layers: PyMap<PyValue>;
}

/** `_idx(model)`: the model, its capabilities by id, its layers by id. */
function idx(ctx: CmContext, path: V): Indexed {
  const m = load(ctx, path);
  const layers = mapOf(iter(gi(m, "layers")), (l) => gi(l, "id"), (l) => l);
  const caps = mapOf(iter(gi(m, "capabilities")), (c) => gi(c, "id"), (c) => c);
  return { m, caps, layers };
}

export interface FitgapArgs {
  mode: string;
  baseline: string | undefined;
  target: string | undefined;
  models: string[] | undefined;
  rows: string[];
  only: string[] | undefined;
  out: string;
  date: string;
}

const rowsOf = (ctx: CmContext, patterns: readonly string[]): PyValue[] => globs(ctx, patterns).flatMap((file) => iter(load(ctx, file)));

export function cmFitgap(ctx: CmContext, a: FitgapArgs): void {
  checkOut(ctx, a.out);
  if (a.mode === "integration") return fitgapIntegration(ctx, a);
  const b = idx(ctx, a.baseline);
  const t = idx(ctx, a.target);
  const bcode = gi(gi(b.m, "meta"), "code");
  const tcode = gi(gi(t.m, "meta"), "code");
  const rows = rowsOf(ctx, a.rows);
  const only = a.only !== undefined && a.only.length > 0 ? rowsOf(ctx, a.only) : [];
  const targetsOf = (r: PyValue): PyValue[] => {
    const v = get(r, "target_capability_ids");
    return iter(truthy(v) ? v : []);
  };
  for (const r of rows) {
    if (!b.caps.has(gi(r, "baseline_capability_id"))) stop(`fitgap: unknown baseline id ${f(gi(r, "baseline_capability_id"))}`);
    for (const i of targetsOf(r)) if (!t.caps.has(i)) stop(`fitgap: row ${f(gi(r, "baseline_capability_id"))} cites unknown target id ${f(i)}`);
  }
  for (const r of only) if (!t.caps.has(gi(r, "target_capability_id"))) stop(`fitgap: target-only row cites unknown target id ${f(gi(r, "target_capability_id"))}`);
  const border = iter(gi(b.m, "capabilities")).map((c) => gi(c, "id"));
  const sortedRows = pySorted(rows, (r) => indexOf(border, gi(r, "baseline_capability_id")));
  const torder = iter(gi(t.m, "capabilities")).map((c) => gi(c, "id"));
  const sortedOnly = pySorted(only, (r) => indexOf(torder, gi(r, "target_capability_id")));
  const hdr = ["baseline_system", "target_system", "direction", "baseline_capability_id", "baseline_name", "layer_id", "layer_code", "layer_name", "baseline_status", "baseline_maturity", "baseline_requirement_count", "verdict", "confidence", "effort", "target_capability_ids", "target_capability_names", "target_statuses", "target_maturities", "target_requirement_count", "evidence", "gap_detail", "migration_note"];
  const stem = `${a.out}/${lower(bcode)}-${lower(tcode)}-fit-gap`;
  const csv = [csvRow(hdr)];
  for (const r of sortedRows) {
    const c = b.caps.at(gi(r, "baseline_capability_id"));
    const L = b.layers.at(gi(c, "layer_id"));
    const v = get(r, "target_capability_ids");
    const tl = truthy(v) ? v! : [];
    const ts = iter(tl);
    const uniqueSorted = (field: string): PyValue[] => pySorted(new PySet(ts.map((i) => gi(t.caps.at(i), field))).keys(), (x) => x);
    const total = (): number => {
      let n = 0;
      for (const i of ts) n += pyLength(gi(t.caps.at(i), "requirements"));
      return n;
    };
    csv.push(csvRow([
      bcode,
      tcode,
      "baseline_to_target",
      gi(c, "id"),
      gi(c, "name"),
      gi(c, "layer_id"),
      gi(L, "code"),
      gi(L, "name"),
      gi(c, "status"),
      gi(c, "maturity"),
      pyLength(gi(c, "requirements")),
      gi(r, "verdict"),
      gi(r, "confidence"),
      get(r, "effort", ""),
      joinBars(tl),
      joinBars(ts.map((i) => gi(t.caps.at(i), "name"))),
      joinBars(uniqueSorted("status")),
      joinBars(uniqueSorted("maturity")),
      total(),
      gi(r, "evidence"),
      get(r, "gap_detail", ""),
      get(r, "migration_note", ""),
    ]));
  }
  for (const r of sortedOnly) {
    const c = t.caps.at(gi(r, "target_capability_id"));
    const L = t.layers.at(gi(c, "layer_id"));
    const fallback = get(r, "migration_note", "");
    csv.push(csvRow([bcode, tcode, "target_only", "", "", gi(c, "layer_id"), gi(L, "code"), gi(L, "name"), "", "", "", "target_only", gi(r, "confidence"), get(r, "effort", ""), gi(c, "id"), gi(c, "name"), gi(c, "status"), gi(c, "maturity"), pyLength(gi(c, "requirements")), gi(r, "evidence"), "", get(r, "opportunity", fallback as PyValue)]));
  }
  const verdicts = counter(sortedRows.map((r) => gi(r, "verdict")));
  const out = new Map<string, JsonOut>([
    [
      "meta",
      new Map<string, JsonOut>([
        ["mode", a.mode],
        ["baseline_system", bcode],
        ["target_system", tcode],
        ["generated", a.date],
        ["row_counts", new Map<string, JsonOut>([["baseline_to_target", sortedRows.length], ["target_only", sortedOnly.length]])],
        ["verdicts", counterJson(verdicts)],
      ]),
    ],
    ["baseline_to_target", sortedRows],
    ["target_only", sortedOnly],
  ]);
  const plan = ctx.files.plan();
  plan.folder(a.out);
  planWrite(plan, `${stem}.csv`, csv, true);
  planWrite(plan, `${stem}.json`, cmDumpChunks(out));
  const line = `fitgap[${f(bcode)}->${f(tcode)}]: ${sortedRows.length} scored + ${sortedOnly.length} target-only -> ${stem}.csv/.json  verdicts=${counterRepr(counter(sortedRows.map((r) => gi(r, "verdict"))))}`;
  checkEncodable(line);
  commit(ctx, plan);
  print(ctx, line);
}

function fitgapIntegration(ctx: CmContext, a: FitgapArgs): void {
  if (a.models === undefined) throw new FitgapShapeError("TypeError: 'NoneType' object is not iterable");
  const models = a.models.map((m) => idx(ctx, m));
  const codes = models.map((m) => gi(gi(m.m, "meta"), "code"));
  const IDX = new PyMap<PyMap<PyValue>>();
  for (const m of models) IDX.set(gi(gi(m.m, "meta"), "code"), m.caps);
  const rows = rowsOf(ctx, a.rows);
  const hdr = ["capability_key", "name", "layer_id", "layer_code", "overlap_type", "proposed_owner", "integration_need", "data_flow", "effort", "confidence", ...codes.map((c) => `${f(c)}_capability_ids`), ...codes.map((c) => `${f(c)}_capability_names`), "evidence", "notes"];
  const stem = `${a.out}/${codes.map((c) => lower(c)).join("-")}-integration-map`;
  if (models.length === 0) throw new FitgapShapeError("IndexError: list index out of range");
  const LM = mapOf(iter(gi(models[0]!.m, "layers")), (l) => gi(l, "id"), (l) => l);
  const csv = [csvRow(hdr)];
  for (const r of rows) {
    const ids = new PyMap<PyValue>();
    for (const c of codes) {
      const systems = get(r, "systems", new Map());
      const v = getOr(systems, c);
      ids.set(c, truthy(v) ? v! : []);
    }
    csv.push(csvRow([
      gi(r, "capability_key"),
      gi(r, "name"),
      gi(r, "layer_id"),
      gi(LM.at(gi(r, "layer_id")), "code"),
      gi(r, "overlap_type"),
      get(r, "proposed_owner", ""),
      get(r, "integration_need", ""),
      get(r, "data_flow", ""),
      get(r, "effort", ""),
      gi(r, "confidence"),
      ...codes.map((c) => joinBars(ids.at(c))),
      ...codes.map((c) => joinBars(iter(ids.at(c)).map((i) => gi(IDX.at(c).at(i), "name")))),
      gi(r, "evidence"),
      get(r, "notes", ""),
    ]));
  }
  const out = new Map<string, JsonOut>([
    [
      "meta",
      new Map<string, JsonOut>([
        ["mode", "integration"],
        ["systems", codes],
        ["generated", a.date],
        ["row_count", rows.length],
        ["overlap_types", counterJson(counter(rows.map((r) => gi(r, "overlap_type"))))],
      ]),
    ],
    ["rows", rows],
  ]);
  const plan = ctx.files.plan();
  plan.folder(a.out);
  planWrite(plan, `${stem}.csv`, csv, true);
  planWrite(plan, `${stem}.json`, cmDumpChunks(out));
  const line = `integration[${codes.map((c) => f(c)).join("+")}]: ${rows.length} rows -> ${stem}.csv/.json`;
  checkEncodable(line);
  commit(ctx, plan);
  print(ctx, line);
}

// ---------------------------------------------------------------- validate

export interface ValidateArgs {
  model: string;
  narrative: string | undefined;
  fitgap: string | undefined;
  baseline: string | undefined;
  target: string | undefined;
}

/** `all(test(x) for x in items)`, stopping at the first false one, as Python does. */
function all<T>(items: Iterable<T>, test: (x: T) => boolean): boolean {
  for (const x of items) if (!test(x)) return false;
  return true;
}

/** The items of a filtered generator, evaluated one at a time. */
function* where(items: readonly PyValue[], keep: (x: PyValue) => boolean): Generator<PyValue> {
  for (const x of items) if (keep(x)) yield x;
}

/** `csv.DictReader(open(path, encoding='utf-8-sig'))` rows; undefined when the file is missing (FileNotFoundError). */
function dictRows(ctx: CmContext, path: string): PyDict[] | undefined {
  // SD-24: a companion path outside the project counts as missing; BuildOS never reads there.
  if (ctx.files.inside(path) === undefined) return undefined;
  let text: string;
  try {
    text = readText(ctx, path);
  } catch (error) {
    if (error instanceof FitgapInput && error.message.startsWith("[Errno 2] ")) return undefined;
    throw error;
  }
  if (text.startsWith("﻿")) text = text.slice(1);
  let rows: string[][];
  try {
    rows = pyCsvRows(text);
  } catch (error) {
    throw new FitgapShapeError(`_csv.Error: ${(error as Error).message}`);
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

/** Python's `\s` (a Unicode white-space character of `str.isspace`). */
const WS = "[\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
/** `re.findall(r'^#{3,4} §?([\d.]+[a-z]?) (.+?)(?:\s+\*\*\[|\s*$)', doc, re.M)`, with Python's `^`, `$`, `.`, `\d`, and `\s`. */
const HEADING = new RegExp(`(?:^|(?<=\\n))#{3,4} §?([\\p{Nd}.]+[a-z]?) ([^\\n]+?)(?:${WS}+\\*\\*\\[|${WS}*(?=\\n|$))`, "gu");

/** The heading pattern, for its unit test. */
export const HEADING_FOR_TEST = HEADING;

export function cmValidate(ctx: CmContext, a: ValidateArgs): void {
  const fails: string[] = [];
  const chk = (ok: boolean, msg: string): void => {
    print(ctx, `${ok ? "  PASS  " : "  FAIL  "}${msg}`);
    if (!ok) fails.push(msg);
  };
  const m = load(ctx, a.model);
  const code = gi(gi(m, "meta"), "code");
  const caps = iter(gi(m, "capabilities"));
  const reqs = caps.flatMap((c) => iter(gi(c, "requirements")));
  const ids = new PySet(caps.map((c) => gi(c, "id")));
  const LC = mapOf(iter(gi(m, "layers")), (l) => gi(l, "id"), (l) => gi(l, "code"));
  const V = gi(gi(m, "meta"), "vocabularies");
  print(ctx, `== model ${f(code)} ==`);
  chk(ids.size === caps.length, "capability ids unique");
  chk(new PySet(reqs.map((r) => gi(r, "id"))).size === reqs.length, "requirement ids unique");
  const matches = idPattern(code);
  chk(
    all(caps, (c) => matches(gi(c, "id"))),
    `capability id format ${f(code)}-LAYER-NN`,
  );
  chk(
    all(caps, (c) => pyEqual(gi(split(gi(c, "id"), "-"), 1), LC.get(gi(c, "layer_id")) ?? null)),
    "id layer segment matches layer code",
  );
  chk(
    all(caps, (c) => all(iter(gi(c, "dependencies")), (d) => ids.has(d))),
    "all dependencies resolve",
  );
  chk(
    all(
      where(caps, (c) => truthy(gi(c, "parent_id"))),
      (c) => ids.has(gi(c, "parent_id")),
    ),
    "all parent_ids resolve",
  );
  chk(
    all(caps, (c) => inStrings(gi(c, "type"), TYPES)),
    "capability types in vocabulary",
  );
  chk(all(caps, (c) => pyIn(gi(c, "status"), gi(V, "status"))) && all(reqs, (r) => pyIn(gi(r, "status"), gi(V, "status"))), "statuses in system vocabulary");
  chk(all(caps, (c) => inStrings(gi(c, "maturity"), MATURITY)) && all(reqs, (r) => inStrings(gi(r, "maturity"), MATURITY)), "maturity in fixed vocabulary");
  chk(
    all(caps, (c) => inStrings(gi(c, "origin"), ORIGINS)),
    "origin in vocabulary",
  );
  chk(
    all(reqs, (r) => inStrings(gi(r, "kind"), KINDS)),
    "requirement kinds in vocabulary",
  );
  chk(
    all(
      where(reqs, (r) => pyEqual(gi(r, "kind"), "setting")),
      (r) => inStrings(gi(r, "option_scope"), SCOPES),
    ),
    "every setting has a valid option_scope",
  );
  chk(
    all(
      where(reqs, (r) => !pyEqual(gi(r, "kind"), "setting")),
      (r) => gi(r, "option_scope") === null && gi(r, "option_values") === null,
    ),
    "non-settings carry no option fields",
  );
  const orEmpty = (v: PyValue): PyValue => (truthy(v) ? v : "");
  chk(
    all(caps, (c) => pyLength(orEmpty(gi(c, "summary"))) >= 40),
    "every capability has a substantive summary",
  );
  chk(
    all(reqs, (r) => pyLength(orEmpty(gi(r, "text"))) >= 10),
    "every requirement has text",
  );
  chk(
    all(caps, (c) => pyLength(gi(c, "requirements")) >= 1),
    "no empty capabilities",
  );
  const roots = caps.filter((c) => !truthy(gi(c, "parent_id")));
  const kids = caps.filter((c) => truthy(gi(c, "parent_id")));
  chk(new PySet(roots.map((c) => gi(c, "doc_ref"))).size === roots.length, "doc_refs unique among root capabilities");
  const PM = mapOf(caps, (c) => gi(c, "id"), (c) => c);
  chk(
    all(kids, (c) => pyEqual(gi(c, "doc_ref"), gi(PM.at(gi(c, "parent_id")), "doc_ref")) || !new PySet(roots.map((r) => gi(r, "doc_ref"))).has(gi(c, "doc_ref"))),
    "child capabilities share their parent doc_ref or carry a unique one",
  );
  chk(pyLength(gi(m, "capability_tree")) === caps.length, "capability_tree complete");
  chk(
    all(iter(gi(m, "design_principles")), (p) => truthy(get(p, "id")) && truthy(get(p, "name")) && truthy(get(p, "statement"))),
    "design principles carry id, name, statement",
  );
  const base = pyDirname(a.model);
  const low = lower(code);
  const cc = dictRows(ctx, `${base}/${low}-capabilities.csv`);
  const rr = cc === undefined ? undefined : dictRows(ctx, `${base}/${low}-requirements.csv`);
  if (cc === undefined || rr === undefined) chk(false, "companion CSVs present beside the model");
  else {
    chk(cc.length === caps.length && rr.length === reqs.length, "CSV row counts match JSON");
    let total = 0n;
    for (const c of cc) total += pyIntOf(gi(c, "requirement_count"));
    chk(total === BigInt(reqs.length), "requirement_count column sums to requirement rows");
  }
  // `if a.narrative:` and `if a.fitgap:`: an empty value (`--narrative=`) skips the checks, as Python's truthiness did.
  if (a.narrative !== undefined && a.narrative !== "") {
    print(ctx, `== narrative ${f(code)} ==`);
    const doc = readText(ctx, a.narrative);
    const heads = new PyMap<string>();
    for (const match of doc.matchAll(HEADING)) heads.set(match[1]!, match[2]!);
    chk(
      all(roots, (c) => heads.has(gi(c, "doc_ref"))),
      "every root capability has a narrative section (### <doc_ref> <name>)",
    );
    const bad = roots.filter((c) => !pyEqual(pyStrip(heads.has(gi(c, "doc_ref")) ? heads.get(gi(c, "doc_ref"))! : ""), gi(c, "name"))).map((c) => gi(c, "doc_ref"));
    chk(bad.length === 0, `section headings match root capability names exactly (mismatches: ${pyRepr(bad.slice(0, 5))})`);
    chk(
      all(kids, (c) => pyIn(gi(c, "name"), doc)),
      "every child capability is named in the narrative",
    );
    chk(
      all(iter(gi(m, "design_principles")), (p) => pyIn(gi(p, "name"), doc)),
      "every design principle appears in narrative",
    );
    chk(doc.includes("## Part I") && doc.includes("Capability Inventory"), "narrative has Part I framing and a capability inventory");
  }
  if (a.fitgap !== undefined && a.fitgap !== "") {
    const fg = load(ctx, a.fitgap);
    const mode = get(gi(fg, "meta"), "mode");
    print(ctx, `== fit/gap ${f(mode)} ==`);
    if (pyEqual(mode, "integration")) {
      const rows = iter(gi(fg, "rows"));
      chk(
        all(rows, (r) => inStrings(gi(r, "overlap_type"), OVERLAPS)),
        "overlap types in vocabulary",
      );
      chk(
        all(rows, (r) => pyLength(get(r, "evidence", "")) >= 60),
        "every row has substantive evidence",
      );
    } else {
      const b = idx(ctx, a.baseline);
      const t = idx(ctx, a.target);
      const rowsValue = gi(fg, "baseline_to_target");
      const onlyValue = gi(fg, "target_only");
      const rows = iter(rowsValue);
      const targetsOf = (r: PyValue): PyValue[] => {
        const v = get(r, "target_capability_ids");
        return iter(truthy(v) ? v : []);
      };
      chk(new PySet(rows.map((r) => gi(r, "baseline_capability_id"))).equals(new PySet(b.caps.keys())) && rows.length === b.caps.size, "every baseline capability scored exactly once");
      chk(
        all(rows, (r) => all(targetsOf(r), (i) => t.caps.has(i))),
        "all cited target ids resolve",
      );
      chk(
        all(rows, (r) => inStrings(gi(r, "verdict"), VERDICTS)),
        "verdicts in vocabulary",
      );
      chk(
        all(concat(rowsValue, onlyValue), (r) => inStrings(gi(r, "confidence"), CONF)),
        "confidence in vocabulary",
      );
      chk(
        all(rows, (r) => inStrings(get(r, "effort"), EFFORT)),
        "effort in vocabulary",
      );
      chk(
        all(
          where(rows, (r) => pyEqual(gi(r, "verdict"), "gap")),
          (r) => !truthy(get(r, "target_capability_ids")),
        ),
        "gap rows cite no target capabilities",
      );
      chk(
        all(
          where(rows, (r) => pyIn(gi(r, "verdict"), ["native", "partial", "configurable"])),
          (r) => truthy(get(r, "target_capability_ids")),
        ),
        "native/partial/configurable rows cite targets",
      );
      chk(
        all(concat(rowsValue, onlyValue), (r) => pyLength(get(r, "evidence", "")) >= 80),
        "every row has substantive evidence (>=80 chars)",
      );
      const cited = new PySet(rows.flatMap((r) => targetsOf(r)));
      chk(new PySet(t.caps.keys()).minus(cited).equals(new PySet(iter(onlyValue).map((r) => gi(r, "target_capability_id")))), "target_only rows == exactly the uncited target capabilities");
    }
  }
  print(ctx, fails.length === 0 ? "\nALL CHECKS PASSED" : `\n*** ${fails.length} FAILURE(S) ***`);
  if (fails.length > 0) throw new CmFail("validate");
}
