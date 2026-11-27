/**
 * `buildos extract bulk`: the port of the skill script
 * `buildos-bulk-extract/scripts/work.py` (W1 R7 P9 t4), a Git-free
 * inventory for source reviews in a BuildOS project. Subcommands, as the
 * script has them: `status`, `next`, `show`, `start`, `template`, `check`,
 * `stage`, `stage-update`, `replace-row`, `decide`, and `publish`.
 *
 * The review files, staged rows, publication intent, hashes, IDs, and every
 * message are the script's, byte for byte: JSON is read and written as
 * Python's `json` module does (`py-json.ts`), and the clock is the one the
 * CLI passes in. The rows it writes pass `buildos validate` (the script
 * already applied the CLI's anchor, ID, time, and row-size rules; the rules
 * here are the same as `src/core/validate/checks.ts` and `read-limits.ts`).
 * What differs is recorded in `test/golden/skills/divergences.json`.
 */

import type { FsPortFactory } from "../shared/fs-port.ts";
import type { HashPort } from "../shared/hash-port.ts";
import { pyLoads, PyJsonError, PyJsonDepthError, isDict, isList, pyDeepCopy, pyDumps, pyEquals, pyRepr, pyStr, pyStrip, pySplitlines, type PyDict, type PyValue } from "../shared/py-json.ts";
import { keyError, PyException, pyDecodeUtf8, typeError, valueError } from "../shared/py-text.ts";
import { jsonlRowLimit, READ_LIMITS } from "../shared/read-limits.ts";
import { resolveDefaultRoot } from "../shared/root.ts";
import type { NotRestored } from "../shared/not-restored.ts";
import { BulkFs, BulkWriteError, type LockOwner } from "./bulk-files.ts";
import { checkEntityLines, ENTITY_FILE_SPECS, Findings, type ConfigIndex } from "../validate/checks.ts";
import { CONFIG_PATH, readConfig, VALIDATE_LIMITS } from "../validate/validate.ts";
import {
  APPLY_ACTIONS,
  CHECK_RESULTS,
  COMMON_MEANINGS,
  DATA_FILES,
  DATA_KINDS,
  ENTITY_PREFIX,
  REF_ID,
  REF_OUTCOMES,
  REQUIRED_LIST_FIELDS,
  REVIEW_DECISIONS,
  TYPE_FIELDS,
  candidateTemplate,
  extractionRowIssues,
  get,
  getOr,
  inSet,
  isDate,
  iterate,
  jsonLine,
  listFieldIssues,
  nextId,
  nonblank,
  rowFieldIssues,
  rowHash,
  savedAnchorIssue,
  strNonblank,
  truthy,
  validPublicationReview,
  type V,
} from "./bulk-rules.ts";
import { pyCsvRowCount, pyLineCount, pyStem, pySuffix } from "./py-lines.ts";

export interface Group {
  key: string;
  source: string;
  sha256: PyValue;
  refs: PyDict[];
  filename: string;
}

type Records = Map<string, PyDict>;

/** The command's context: files, the hash, the clock, and who takes a lock. */
interface Ctx {
  fs: BulkFs;
  hash: HashPort;
  now: () => Date;
  owner: LockOwner;
  /** The config index of `buildos validate`, read once (P9-R1-01). */
  index?: ConfigIndex;
  /** The candidate keys and extraction ID of the publication this run is making (P9-F-07). */
  publishing?: { keys: string[]; extractionId: PyValue };
}

/** `datetime.now(utc).isoformat(timespec="seconds")` with `Z`. */
function timestamp(ctx: Ctx): string {
  return ctx.now().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** `d[key]`: the value, or `KeyError`. A non-dict is a `TypeError`. */
function idx(d: V, key: string): PyValue {
  if (!isDict(d)) throw typeError(d === null || d === undefined ? "'NoneType' object is not subscriptable" : `'${typeof d === "string" ? "str" : isList(d) ? "list" : "int"}' object is not subscriptable`);
  if (!d.has(key)) throw keyError(key);
  return d.get(key)!;
}

function asDict(value: V, what: string): PyDict {
  if (!isDict(value)) throw typeError(`${what} must be a JSON object`);
  return value;
}

/** `json.loads(text)` with the script's error texts. */
function loads(text: string): PyValue {
  try {
    return pyLoads(text);
  } catch (error) {
    if (error instanceof PyJsonError) throw new PyException("JSONDecodeError", error.message);
    if (error instanceof PyJsonDepthError) throw new PyException("RecursionError", error.message);
    throw error;
  }
}

function saveJsonBytes(value: PyValue): Uint8Array {
  return new TextEncoder().encode(`${pyDumps(value, { indent: 2, ensureAscii: false })}\n`);
}

// ---------------------------------------------------------------- paths

/** `file_at(root, relative)`: the path inside the root, or `ValueError`. Returns the port path. */
export function fileAt(ctx: Ctx, relative: V): string {
  if (typeof relative !== "string" || relative === "" || /^[/\\]/.test(relative) || (ctx.fs.sep === "\\" && /^[A-Za-z]:/.test(relative))) {
    throw valueError(`Invalid repo-relative path: ${pyRepr(relative)}`);
  }
  if (relative.includes("\0")) throw valueError("embedded null byte");
  const parts: string[] = [];
  for (const part of relative.split(ctx.fs.sep === "\\" ? /[/\\]/ : "/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) throw valueError(`Path leaves repo: ${relative}`);
      parts.pop();
    } else parts.push(part);
  }
  const folded = parts.length === 0 ? "." : parts.join("/");
  try {
    ctx.fs.fs.stat(folded);
  } catch (error) {
    if (error instanceof Error && error.name === "PathRefusedError") throw valueError(`Path leaves repo: ${relative}`);
  }
  return folded;
}

function reviewRel(group: Group): string {
  return `extractions/${group.filename}`;
}

function stageRel(kind: string): string {
  return `extractions/staging/${DATA_FILES[kind]!}`;
}

// ---------------------------------------------------------------- index and data

export function groupsFromIndex(ctx: Ctx): Group[] {
  const index = loads(ctx.fs.readText(".os/indexes/references.json", READ_LIMITS.data));
  if (!isDict(index)) throw valueError("Reference index has no references list");
  let references = index.get("references");
  if (index.has("references") && references === null) references = [];
  if (!isList(references)) throw valueError("Reference index has no references list");
  const bySource = new Map<string, PyDict[]>();
  const seen = new Set<string>();
  for (const ref of references) {
    if (!isDict(ref) || !REF_ID.test(pyStr(getOr(ref, "id", "")))) throw valueError(`Invalid reference record: ${pyRepr(ref)}`);
    const id = ref.get("id") as string;
    if (seen.has(id)) throw valueError(`Duplicate reference ID: ${id}`);
    seen.add(id);
    fileAt(ctx, ref.get("source"));
    fileAt(ctx, ref.get("converted"));
    const source = ref.get("source") as string;
    const list = bySource.get(source);
    if (list === undefined) bySource.set(source, [ref]);
    else list.push(ref);
  }
  const groups: Group[] = [];
  for (const [source, refs] of bySource) {
    const num = (ref: PyDict): bigint => BigInt(REF_ID.exec(ref.get("id") as string)![1]!);
    refs.sort((a, b) => (num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0));
    const hashes: PyValue[] = [];
    for (const ref of refs) {
      const value = getOr(ref, "sha256", null);
      if (isList(value)) throw typeError("unhashable type: 'list'");
      if (isDict(value)) throw typeError("unhashable type: 'dict'");
      if (!hashes.some((h) => pyEquals(h, value))) hashes.push(value);
    }
    if (hashes.length !== 1 || !/^[0-9a-f]{64}$/.test(pyStr(hashes[0]!))) throw valueError(`Inconsistent source hashes: ${source}`);
    const key = refs[0]!.get("id") as string;
    const slug = pyStem(source)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56);
    groups.push({ key, source, sha256: refs[0]!.get("sha256")!, refs, filename: `${key}-${slug || "source"}.json` });
  }
  const num = (g: Group): bigint => BigInt(REF_ID.exec(g.key)![1]!);
  return groups.sort((a, b) => (num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0));
}

function groupFor(groups: Group[], refId: string): Group {
  for (const group of groups) if (group.refs.some((ref) => ref.get("id") === refId)) return group;
  throw valueError(`Unknown reference ID: ${refId}`);
}

function canonicalRecords(ctx: Ctx): Records {
  const records: Records = new Map();
  for (const name of ctx.fs.glob(".os/data", "", ".jsonl")) {
    const rel = `.os/data/${name}`;
    const lines = pySplitlines(ctx.fs.readText(rel, READ_LIMITS.data));
    lines.forEach((line, i) => {
      const number = i + 1;
      if (pyStrip(line) === "") return;
      let row: PyValue;
      try {
        row = loads(line);
      } catch (error) {
        if (error instanceof PyException && error.pyClass === "JSONDecodeError") throw new PyException("ValueError", `Invalid JSONL in ${ctx.fs.abs(rel)}:${number}: ${error.message}`);
        throw error;
      }
      const rowId = isDict(row) ? row.get("id") : null;
      if (typeof rowId !== "string" || records.has(rowId)) throw valueError(`Missing or duplicate ID in ${ctx.fs.abs(rel)}:${number}: ${pyRepr(rowId ?? null)}`);
      records.set(rowId, row as PyDict);
    });
  }
  return records;
}

function digest(ctx: Ctx, rel: string): string {
  return ctx.hash.sha256Hex(ctx.fs.readBytes(rel, READ_LIMITS.intake));
}

// ---------------------------------------------------------------- anchors

function convertedAnchorIssue(ctx: Ctx, anchor: V, paths: Set<string>, counts: Map<string, number>, resolve: boolean): string | null {
  if (typeof anchor !== "string" || !anchor.includes("#")) return "needs a converted path#anchor";
  const saved = savedAnchorIssue(anchor, "assets/");
  if (saved !== null) return saved;
  const hash = anchor.indexOf("#");
  const relative = anchor.slice(0, hash);
  const fragment = anchor.slice(hash + 1);
  if (!paths.has(relative)) return `points outside this source group: ${relative}`;
  if (fragment === "") return "needs a converted path#anchor";
  const suffix = pySuffix(relative).toLowerCase();
  const pattern = suffix === ".md" || suffix === ".txt" ? /^L([1-9][0-9]*)$/ : suffix === ".csv" ? /^row-([1-9][0-9]*)$/ : null;
  const match = pattern === null ? null : pattern.exec(fragment);
  if (match === null) return `cannot resolve #${fragment} in ${relative}`;
  if (!resolve) return null;
  if (!counts.has(relative)) {
    const rel = fileAt(ctx, relative);
    if (!ctx.fs.isFile(rel)) return `converted file is missing: ${relative}`;
    try {
      const text = pyDecodeUtf8(ctx.fs.readBytes(rel, READ_LIMITS.intake));
      counts.set(relative, suffix === ".csv" ? pyCsvRowCount(text) : pyLineCount(text));
    } catch (error) {
      if (error instanceof PyException && (error.pyClass === "UnicodeDecodeError" || error.pyClass === "Error")) return `cannot read converted file ${relative}: ${error.message}`;
      throw error;
    }
  }
  const number = Number(match[1]);
  const count = counts.get(relative)!;
  if (number > count) return `#${fragment} is outside ${relative} (${count} lines or rows)`;
  return null;
}



// ---------------------------------------------------------------- review states

function referenceCoverage(review: PyDict, group: Group, issues: string[]): { expected: Map<string, PyValue>; outcomes: Map<string, PyValue> } {
  const expected = new Map<string, PyValue>(group.refs.map((ref) => [ref.get("id") as string, ref.get("converted")!]));
  const outcomes = new Map<string, PyValue>();
  const coverage = review.get("references");
  if (!isList(coverage)) {
    issues.push("references must be a list");
  } else {
    for (const entry of coverage) {
      if (!isDict(entry) || typeof entry.get("id") !== "string") {
        issues.push("A reference entry is invalid");
        continue;
      }
      const refId = entry.get("id") as string;
      if (outcomes.has(refId)) issues.push(`Duplicate reference entry: ${refId}`);
      outcomes.set(refId, entry.get("outcome") ?? null);
      if (!pyEquals(expected.has(refId) ? expected.get(refId)! : null, entry.has("converted") ? entry.get("converted")! : null)) issues.push(`Wrong converted path: ${refId}`);
      if (!inSet(entry.get("outcome") ?? null, REF_OUTCOMES)) issues.push(`Invalid outcome: ${refId}`);
      if (inSet(entry.get("outcome") ?? null, ["no-new-rows", "blocked"]) && !strNonblank(getOr(entry, "note", ""))) issues.push(`Add a reason for ${refId}`);
    }
    if (!sameKeys(outcomes, expected)) issues.push("Review does not cover exactly the source's reference IDs");
  }
  return { expected, outcomes };
}

const OS_ERRORS = ["OSError", "FileNotFoundError", "PermissionError", "IsADirectoryError", "NotADirectoryError", "FileExistsError"];

function isOsError(error: PyException): boolean {
  return OS_ERRORS.includes(error.pyClass);
}

function sameKeys(a: Map<string, unknown>, b: Map<string, unknown>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a.keys()) if (!b.has(key)) return false;
  return true;
}

function outcomeValues(outcomes: Map<string, PyValue>): PyValue[] {
  return [...outcomes.values()];
}

function hasOutcome(outcomes: Map<string, PyValue>, value: string): boolean {
  return outcomeValues(outcomes).some((v) => pyEquals(v, value));
}

function legacyReviewState(ctx: Ctx, group: Group, records: Records | null, verifyHash: boolean): [string, string[]] {
  const path = reviewRel(group);
  if (!ctx.fs.exists(path)) return ["pending", []];
  let review: PyValue;
  try {
    review = loads(ctx.fs.readText(path, READ_LIMITS.data));
  } catch (error) {
    if (error instanceof PyException && (error.pyClass === "JSONDecodeError" || isOsError(error))) return ["needs-repair", [`Cannot read review JSON: ${error.message}`]];
    throw error;
  }
  if (!isDict(review)) return ["needs-repair", ["Review must be a JSON object"]];
  const isModern = review.has("publication_review");
  const issues: string[] = [];
  if (!pyEquals(review.get("source") ?? null, group.source) || !pyEquals(review.get("source_sha256") ?? null, group.sha256)) issues.push("Source or source hash differs from reference index");
  const sourcePath = fileAt(ctx, group.source);
  if (!ctx.fs.exists(sourcePath)) issues.push(`Original source is missing: ${group.source}`);
  else if (verifyHash && ctx.fs.isFile(sourcePath) && !pyEquals(digest(ctx, sourcePath), group.sha256)) issues.push("Original source hash differs from reference index");
  for (const ref of group.refs) if (!ctx.fs.isFile(fileAt(ctx, ref.get("converted")))) issues.push(`Converted file is missing: ${pyStr(ref.get("converted")!)}`);
  const { expected, outcomes } = referenceCoverage(review, group, issues);
  const sourceCheck = review.get("source_check");
  let checkResult: V = null;
  if (!isDict(sourceCheck)) {
    issues.push("source_check must be an object");
  } else {
    checkResult = sourceCheck.get("result") ?? null;
    if (!inSet(checkResult, CHECK_RESULTS)) issues.push("Invalid source_check result");
    if (typeof sourceCheck.get("notes") !== "string" || !isList(sourceCheck.get("repairs"))) issues.push("source_check needs notes and repairs");
    else if (pyEquals(checkResult, "repaired") && !truthy(sourceCheck.get("repairs"))) issues.push("Record the conversion repair");
    if (inSet(checkResult, ["matched", "repaired"]) && !strNonblank(getOr(sourceCheck, "notes", ""))) issues.push("Describe the source comparison");
  }
  let candidates = review.get("candidates");
  const keys = new Set<string>();
  const anchorPaths = new Set<string>([...expected.values()].filter((v): v is string => typeof v === "string"));
  const anchorCounts = new Map<string, number>();
  const candidatePaths = new Set<string>();
  if (!isList(candidates)) {
    issues.push("candidates must be a list");
    candidates = [];
  }
  for (const candidate of candidates) {
    if (!isDict(candidate)) {
      issues.push("A candidate is invalid");
      continue;
    }
    const key = candidate.get("key");
    const kind = candidate.get("type");
    const row = candidate.get("row");
    if (typeof key !== "string" || key === "" || keys.has(key)) {
      issues.push(`Missing or duplicate candidate key: ${pyRepr(key ?? null)}`);
      continue;
    }
    keys.add(key);
    if (!inSet(kind ?? null, Object.keys(ENTITY_PREFIX)) || !isDict(row)) {
      issues.push(`Invalid candidate type or row: ${key}`);
      continue;
    }
    const k = kind as string;
    const anchor = row.get("source_anchor");
    const anchorIssue = convertedAnchorIssue(ctx, anchor, anchorPaths, anchorCounts, verifyHash);
    if (anchorIssue !== null) issues.push(`Candidate ${key} source_anchor ${anchorIssue}`);
    if (typeof anchor === "string" && anchor.includes("#") && anchorPaths.has(anchor.split("#", 1)[0]!)) candidatePaths.add(anchor.split("#", 1)[0]!);
    if (!pyEquals(row.get("type") ?? null, k)) issues.push(`Candidate ${key} row type differs from candidate type`);
    if (isModern) {
      const action = candidate.get("action") ?? null;
      const decision = candidate.get("review_state") ?? null;
      const target = candidate.get("target_id") ?? null;
      if (!inSet(action, APPLY_ACTIONS) || !inSet(decision, REVIEW_DECISIONS)) issues.push(`Candidate ${key} needs an action and review_state`);
      if (pyEquals(decision, "held") && !strNonblank(getOr(candidate, "review_note", ""))) issues.push(`Candidate ${key} held claim needs a review_note`);
      if (pyEquals(action, "minted")) {
        if (target !== null || (row.get("id") ?? null) !== null || !pyEquals(row.get("status") ?? null, "draft")) issues.push(`Candidate ${key} minted row needs draft status and no global ID`);
      } else if (inSet(action, ["referenced", "updated"])) {
        if (typeof target !== "string" || !new RegExp(`^${ENTITY_PREFIX[k]}-[0-9]{3,}$`).test(target)) issues.push(`Candidate ${key} needs a matching target_id`);
        else if (records !== null && (!records.has(target) || !pyEquals(records.get(target)!.get("type") ?? null, k))) issues.push(`Candidate ${key} target_id is absent or has the wrong type`);
        if (pyEquals(action, "referenced") && ((row.get("id") ?? null) !== null || !pyEquals(row.get("status") ?? null, "draft"))) issues.push(`Candidate ${key} referenced row needs draft status and no global ID`);
        if (pyEquals(action, "updated")) {
          if (!pyEquals(row.get("id") ?? null, target) || !/^[0-9a-f]{64}$/.test(pyStr(getOr(candidate, "base_sha256", "")))) issues.push(`Candidate ${key} updated row needs its target ID and base_sha256`);
          if (records !== null && typeof target === "string" && records.has(target) && [...records.get(target)!.keys()].some((f) => !row.has(f))) issues.push(`Candidate ${key} updated row dropped original fields`);
        }
      }
      issues.push(...rowFieldIssues(row, k, `Candidate ${key}`));
    } else {
      if ((row.get("id") ?? null) !== null || !pyEquals(row.get("status") ?? null, "draft")) issues.push(`Candidate ${key} needs draft status without a global ID`);
      if (!["title", "summary"].every((field) => nonblank(row.get(field)))) issues.push(`Candidate ${key} needs title and summary`);
      issues.push(...listFieldIssues(row, k, `Candidate ${key}`));
    }
    const refs = row.get("source_refs");
    if (isList(refs)) {
      for (const support of refs) {
        if (typeof support === "string" && support.includes("#")) {
          const supportPath = support.split("#", 1)[0]!;
          if (anchorPaths.has(supportPath)) {
            candidatePaths.add(supportPath);
            const supportIssue = convertedAnchorIssue(ctx, support, anchorPaths, anchorCounts, verifyHash);
            if (supportIssue !== null) issues.push(`Candidate ${key} source_refs ${supportIssue}`);
          }
        }
      }
    }
  }
  for (const [refId, converted] of expected) {
    const covered = typeof converted === "string" && candidatePaths.has(converted);
    if (pyEquals(outcomes.get(refId) ?? null, "reviewed") && !covered) issues.push(`Reviewed ${refId} has no candidate`);
    if (!pyEquals(outcomes.get(refId) ?? null, "reviewed") && covered) issues.push(`Candidate cites ${refId} without a reviewed outcome`);
  }
  let unresolved = review.get("unresolved");
  if (!isList(unresolved) || unresolved.some((item) => !nonblank(item))) {
    issues.push("unresolved must be a list of nonempty notes");
    unresolved = [];
  }
  let applied = review.get("applied");
  if (!isDict(applied)) {
    issues.push("applied must be an object");
    applied = new Map();
  }
  const appliedMap = applied as PyDict;
  if ([...appliedMap.keys()].some((k) => !keys.has(k))) issues.push("applied contains an unknown candidate key");
  const expectedOutcomes = new Map<string, Set<string>>(APPLY_ACTIONS.map((a) => [a, new Set()]));
  for (const candidate of candidates) {
    if (!isDict(candidate) || typeof candidate.get("key") !== "string" || !appliedMap.has(candidate.get("key") as string)) {
      if (isDict(candidate) && (isList(candidate.get("key")) || isDict(candidate.get("key")))) throw typeError(`unhashable type: '${isList(candidate.get("key")) ? "list" : "dict"}'`);
      continue;
    }
    const key = candidate.get("key") as string;
    const item = appliedMap.get(key)!;
    if (!isDict(item) || !inSet(item.get("action") ?? null, APPLY_ACTIONS) || typeof item.get("id") !== "string") {
      issues.push(`Invalid applied result: ${key}`);
      continue;
    }
    if (isModern && !pyEquals(item.get("action")!, candidate.get("action") ?? null)) issues.push(`Applied action differs from candidate action: ${key}`);
    if (isModern && !pyEquals(candidate.get("review_state") ?? null, "approved")) issues.push(`Applied candidate is no longer approved: ${key}`);
    if (isModern && !pyEquals(item.get("candidate_sha256") ?? null, rowHash(ctx.hash, candidate.get("row") ?? null))) issues.push(`Applied candidate ${key} changed after publication; stage a new correction`);
    const rowId = item.get("id") as string;
    const type = candidate.get("type");
    const prefix = typeof type === "string" && Object.hasOwn(ENTITY_PREFIX, type) ? ENTITY_PREFIX[type] : "INVALID";
    if (!new RegExp(`^${prefix}-[0-9]+$`).test(rowId)) issues.push(`Wrong applied ID type: ${key}`);
    if (records !== null && !records.has(rowId)) issues.push(`Applied ID is absent from .os/data: ${rowId}`);
    else if (records !== null && inSet(item.get("action")!, ["minted", "updated"]) && typeof type === "string" && Object.hasOwn(REQUIRED_LIST_FIELDS, type)) {
      const saved = records.get(rowId)!;
      if (!pyEquals(saved.get("type") ?? null, type)) issues.push(`Saved ${rowId} has the wrong type`);
      else issues.push(...listFieldIssues(saved, type, `Saved ${rowId}`));
    }
    expectedOutcomes.get(item.get("action") as string)!.add(rowId);
  }
  let extractionIds = review.get("extraction_ids");
  if (!isList(extractionIds)) {
    issues.push("extraction_ids must be a list");
    extractionIds = [];
  }
  const observedOutcomes = new Map<string, Set<string>>(APPLY_ACTIONS.map((a) => [a, new Set()]));
  for (const extId of extractionIds) {
    if (typeof extId !== "string" || !/^EXT-[0-9]+$/.test(extId)) {
      issues.push(`Invalid extraction ID: ${pyRepr(extId)}`);
      continue;
    }
    if (records === null) continue;
    const ext = records.get(extId);
    if (ext === undefined) {
      issues.push(`Extraction ID is absent from .os/data: ${extId}`);
      continue;
    }
    const anchorIssue = convertedAnchorIssue(ctx, ext.get("source_anchor"), anchorPaths, anchorCounts, verifyHash);
    if (anchorIssue !== null) issues.push(`Extraction ${extId} source_anchor ${anchorIssue}`);
    const extRefs = ext.get("source_refs");
    for (const support of isList(extRefs) ? extRefs : []) {
      if (typeof support === "string" && support.includes("#") && anchorPaths.has(support.split("#", 1)[0]!)) {
        const supportIssue = convertedAnchorIssue(ctx, support, anchorPaths, anchorCounts, verifyHash);
        if (supportIssue !== null) issues.push(`Extraction ${extId} source_refs ${supportIssue}`);
      }
    }
    for (const action of APPLY_ACTIONS) {
      const values = getOr(ext, action, []);
      if (!isList(values)) issues.push(`Extraction ${extId} has an invalid ${action} list`);
      else for (const v of values) addHashable(observedOutcomes.get(action)!, v);
    }
  }
  if (records !== null && appliedMap.size > 0 && APPLY_ACTIONS.some((a) => !sameSet(expectedOutcomes.get(a)!, observedOutcomes.get(a)!))) issues.push("Extraction outcomes differ from the applied candidate list");
  if (isModern && ((review.get("publication_review") ?? null) !== null || candidates.some((c) => isDict(c) && pyEquals(c.get("review_state") ?? null, "approved")))) {
    if (!validPublicationReview(review)) issues.push("Review decisions need a separate named, dated publication_review");
  }
  if (truthy(review.get("reviewed_at")) && !isDate(review.get("reviewed_at"))) issues.push("reviewed_at needs an ISO date");
  if (issues.length > 0) return ["needs-repair", issues];
  if (truthy(unresolved) || hasOutcome(outcomes, "blocked") || pyEquals(checkResult, "partial")) return ["blocked", (unresolved as PyValue[]).map((u) => u as string)];
  if (!inSet(checkResult, ["matched", "repaired"]) || hasOutcome(outcomes, "pending") || !strNonblank(getOr(review, "reviewed_by", "")) || !strNonblank(getOr(review, "reviewed_at", ""))) return ["in-progress", []];
  if (candidates.length === 0) {
    const values = outcomeValues(outcomes);
    if (values.length > 0 && values.every((v) => pyEquals(v, "no-new-rows"))) return ["complete", []];
    return ["needs-repair", ["A reviewed reference has no candidate or no-new-rows reason"]];
  }
  if (appliedMap.size === keys.size && truthy(extractionIds)) return ["complete", []];
  return ["ready", []];
}

/** Adds a value of an outcome list to a set, as Python's `set.update` (a list or dict is `TypeError`). */
function addHashable(set: Set<string>, value: PyValue): void {
  if (isList(value)) throw typeError("unhashable type: 'list'");
  if (isDict(value)) throw typeError("unhashable type: 'dict'");
  set.add(typeof value === "string" ? value : `\0${pyRepr(value)}`);
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function sourceIssues(ctx: Ctx, group: Group, review: PyDict, verifyHash: boolean): { issues: string[]; expected: Map<string, PyValue>; outcomes: Map<string, PyValue> } {
  const issues: string[] = [];
  if (!pyEquals(review.get("source") ?? null, group.source) || !pyEquals(review.get("source_sha256") ?? null, group.sha256)) issues.push("Source or source hash differs from reference index");
  const source = fileAt(ctx, group.source);
  if (!ctx.fs.isFile(source)) issues.push(`Original source is missing: ${group.source}`);
  else if (verifyHash && !pyEquals(digest(ctx, source), group.sha256)) issues.push("Original source hash differs from reference index");
  const expectedForFiles = group.refs.map((ref) => ref.get("converted")!);
  for (const converted of new Map(group.refs.map((ref) => [ref.get("id") as string, ref.get("converted")!])).values()) {
    if (!ctx.fs.isFile(fileAt(ctx, converted))) issues.push(`Converted file is missing: ${pyStr(converted)}`);
  }
  void expectedForFiles;
  const { expected, outcomes } = referenceCoverage(review, group, issues);
  const check = review.get("source_check");
  if (!isDict(check) || !inSet(check.get("result") ?? null, CHECK_RESULTS)) {
    issues.push("source_check needs a valid result");
  } else {
    if (typeof check.get("notes") !== "string" || !isList(check.get("repairs"))) issues.push("source_check needs notes and repairs");
    if (pyEquals(check.get("result")!, "repaired") && !truthy(check.get("repairs"))) issues.push("Record the conversion repair");
    if (inSet(check.get("result")!, ["matched", "repaired", "partial"]) && !strNonblank(getOr(check, "notes", ""))) issues.push("Describe the source comparison");
  }
  if (truthy(review.get("reviewed_at")) && !isDate(review.get("reviewed_at"))) issues.push("reviewed_at needs an ISO date");
  const unresolved = review.get("unresolved");
  if (!isList(unresolved) || unresolved.some((item) => !nonblank(item))) issues.push("unresolved must be a list of nonempty notes");
  return { issues, expected, outcomes };
}

const STAGE_META_FIELDS = ["key", "action", "review_state", "target_id", "base_sha256", "review_note"];

function candidateIssues(ctx: Ctx, group: Group, candidate: PyDict, row: V, records: Records | null, verifyHash: boolean, anchorCounts: Map<string, number>): string[] {
  const issues: string[] = [];
  const key = candidate.get("key") ?? null;
  const kind = candidate.get("type") ?? null;
  if (!inSet(kind, DATA_KINDS) || !isDict(row)) return [`Invalid candidate type or row: ${pyStr(key)}`];
  const k = kind as string;
  const label = `Candidate ${pyStr(key)}`;
  for (const field of ["authored_by", "reviewed_by"]) {
    if (candidate.has(field) && !nonblank(candidate.get(field))) issues.push(`${label} ${field} must be a nonblank name`);
  }
  if (candidate.has("reviewed_at") && !isDate(candidate.get("reviewed_at"))) issues.push(`${label} reviewed_at must be a date`);
  const anchorPaths = new Set<string>(group.refs.map((ref) => ref.get("converted")).filter((v): v is string => typeof v === "string"));
  const anchorIssue = convertedAnchorIssue(ctx, row.get("source_anchor"), anchorPaths, anchorCounts, verifyHash);
  if (anchorIssue !== null) issues.push(`${label} source_anchor ${anchorIssue}`);
  const refs = getOr(row, "source_refs", []);
  for (const support of isList(refs) ? refs : []) {
    if (typeof support === "string" && support.includes("#") && anchorPaths.has(support.split("#", 1)[0]!)) {
      const problem = convertedAnchorIssue(ctx, support, anchorPaths, anchorCounts, verifyHash);
      if (problem !== null) issues.push(`${label} source_refs ${problem}`);
    }
  }
  if (!pyEquals(row.get("type") ?? null, k)) issues.push(`${label} row type differs from candidate type`);
  if (row.has("_stage")) issues.push(`${label} row must not contain a nested _stage block`);
  const action = candidate.get("action") ?? null;
  const decision = candidate.get("review_state") ?? null;
  if (!inSet(action, APPLY_ACTIONS) || !inSet(decision, REVIEW_DECISIONS)) issues.push(`${label} needs an action and review_state`);
  if (pyEquals(decision, "held") && !strNonblank(getOr(candidate, "review_note", ""))) issues.push(`${label} held claim needs a review_note`);
  const target = candidate.get("target_id") ?? null;
  if (pyEquals(action, "minted")) {
    if (target !== null || (row.get("id") ?? null) !== null || !pyEquals(row.get("status") ?? null, "draft")) issues.push(`${label} minted row needs draft status and no global ID`);
  } else if (inSet(action, ["referenced", "updated"])) {
    if (typeof target !== "string" || !new RegExp(`^${ENTITY_PREFIX[k]}-[0-9]{3,}$`).test(target)) issues.push(`${label} needs a matching target_id`);
    else if (records !== null && (!records.has(target) || !pyEquals(records.get(target)!.get("type") ?? null, k))) issues.push(`${label} target_id is absent or has the wrong type`);
    if (pyEquals(action, "referenced") && ((row.get("id") ?? null) !== null || !pyEquals(row.get("status") ?? null, "draft"))) issues.push(`${label} referenced row needs draft status and no global ID`);
    if (pyEquals(action, "updated")) {
      if (!pyEquals(row.get("id") ?? null, target) || !/^[0-9a-f]{64}$/.test(pyStr(getOr(candidate, "base_sha256", "")))) issues.push(`${label} updated row needs its target ID and base_sha256`);
      if (records !== null && typeof target === "string" && records.has(target) && [...records.get(target)!.keys()].some((f) => !row.has(f))) issues.push(`${label} updated row dropped original fields`);
    }
  }
  issues.push(...rowFieldIssues(row, k, label));
  return issues;
}

type StageRows = Map<string, [string, PyDict]>;

function stageToken(refId: string, key: string): string {
  return `${refId}\0${key}`;
}

function readStage(ctx: Ctx, kind: string): PyDict[] {
  const rel = stageRel(kind);
  if (!ctx.fs.exists(rel)) return [];
  const rows: PyDict[] = [];
  pySplitlines(ctx.fs.readText(rel, READ_LIMITS.data)).forEach((line, i) => {
    const number = i + 1;
    if (pyStrip(line) === "") return;
    let row: PyValue;
    try {
      row = loads(line);
    } catch (error) {
      if (error instanceof PyException && error.pyClass === "JSONDecodeError") throw valueError(`Invalid staged JSONL in ${ctx.fs.abs(rel)}:${number}: ${error.message}`);
      throw error;
    }
    if (!isDict(row) || !isDict(row.get("_stage"))) throw valueError(`Missing _stage block in ${ctx.fs.abs(rel)}:${number}`);
    if (!pyEquals(row.get("type") ?? null, kind)) throw valueError(`Wrong row type in ${ctx.fs.abs(rel)}:${number}`);
    rows.push(row);
  });
  return rows;
}

function allStageRows(ctx: Ctx): StageRows {
  const found: StageRows = new Map();
  for (const kind of DATA_KINDS) {
    for (const row of readStage(ctx, kind)) {
      const meta = row.get("_stage") as PyDict;
      const refId = meta.get("ref_id") ?? null;
      const key = meta.get("key") ?? null;
      const tokenText = `(${pyRepr(refId)}, ${pyRepr(key)})`;
      if (!(typeof refId === "string" && refId !== "" && typeof key === "string" && key !== "")) throw valueError(`Missing or duplicate staged source/key: ${tokenText}`);
      const token = stageToken(refId, key);
      if (found.has(token)) throw valueError(`Missing or duplicate staged source/key: ${tokenText}`);
      found.set(token, [kind, row]);
    }
  }
  return found;
}

function writeStage(ctx: Ctx, kind: string, rows: PyDict[]): void {
  const rel = stageRel(kind);
  ctx.fs.mkdirp("extractions/staging");
  const parts = rows.map(jsonLine);
  const body = concat(parts);
  checkRows(stageRel(kind), parts, READ_LIMITS.data);
  if (ctx.fs.exists(rel) && bytesEqual(ctx.fs.readBytes(rel, READ_LIMITS.data), body)) return;
  ctx.fs.replace(rel, body);
}

/** The staged file must stay readable by the next command: the read bound of a staged file. */
function checkRows(rel: string, parts: Uint8Array[], limit: number): void {
  const size = parts.reduce((n, p) => n + p.length, 0);
  if (size > limit) throw valueError(`${rel} would be ${size} bytes, more than BuildOS reads from one such file; nothing was written`);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function pureRow(row: PyDict): PyDict {
  return new Map([...row].filter(([key]) => key !== "_stage").map(([key, value]) => [key, pyDeepCopy(value)]));
}

function stageMeta(candidate: PyDict, refId: string): PyDict {
  const meta: PyDict = new Map();
  for (const name of STAGE_META_FIELDS) if (candidate.has(name)) meta.set(name, pyDeepCopy(candidate.get(name)!));
  meta.set("ref_id", refId);
  return meta;
}

function modernReviewState(ctx: Ctx, group: Group, review: PyDict, records: Records | null, verifyHash: boolean): [string, string[]] {
  if (records === null && truthy(review.get("extraction_ids"))) records = canonicalRecords(ctx);
  const { issues, expected, outcomes } = sourceIssues(ctx, group, review, verifyHash);
  let candidates = review.get("candidates");
  if (!isList(candidates)) {
    issues.push("candidates must be a list");
    candidates = [];
  }
  const staged = allStageRows(ctx);
  const keys = new Set<string>();
  const citedPaths = new Set<string>();
  let draft = false;
  const counts = new Map<string, number>();
  let applied = review.get("applied");
  if (!isDict(applied)) {
    issues.push("applied must be an object");
    applied = new Map();
  }
  const appliedMap = applied as PyDict;
  const expectedPaths = new Set([...expected.values()].filter((v): v is string => typeof v === "string"));
  for (const candidate of candidates) {
    if (!isDict(candidate)) {
      issues.push("A candidate is invalid");
      continue;
    }
    const key = candidate.get("key") ?? null;
    const kind = candidate.get("type") ?? null;
    if (typeof key !== "string" || key === "" || keys.has(key)) {
      issues.push(`Missing or duplicate candidate key: ${pyRepr(key)}`);
      continue;
    }
    keys.add(key);
    if (!inSet(kind, DATA_KINDS)) {
      issues.push(`Invalid candidate type: ${key}`);
      continue;
    }
    const k = kind as string;
    const stagedPair = staged.get(stageToken(group.key, key));
    let row: V;
    let meta: PyDict;
    if (candidate.has("row")) {
      draft = true;
      if (stagedPair !== undefined) {
        const expectedStage = pyDeepCopy(candidate.get("row")!);
        const stageBlock = stageMeta(candidate, group.key);
        const author = candidate.has("authored_by") ? candidate.get("authored_by")! : ((stagedPair[1].get("_stage") as PyDict).get("authored_by") ?? null);
        if ((stagedPair[1].get("_stage") as PyDict).has("authored_by")) stageBlock.set("authored_by", author);
        if (isDict(expectedStage)) expectedStage.set("_stage", stageBlock);
        if (stagedPair[0] !== k || !pyEquals(stagedPair[1], expectedStage)) issues.push(`Candidate ${key} draft differs from its partial staged write`);
      }
      if (appliedMap.has(key)) issues.push(`Candidate ${key} is both draft and published`);
      row = candidate.get("row");
      meta = candidate;
    } else if (stagedPair !== undefined) {
      if (appliedMap.has(key)) issues.push(`Candidate ${key} is both staged and published`);
      const [stagedKind, full] = stagedPair;
      if (stagedKind !== k) issues.push(`Candidate ${key} staged type differs from review link`);
      row = pureRow(full);
      meta = full.get("_stage") as PyDict;
      if (!pyEquals(meta.get("ref_id") ?? null, group.key) || !pyEquals(meta.get("key") ?? null, key)) issues.push(`Candidate ${key} has the wrong stage link`);
    } else if (appliedMap.has(key)) {
      const item = appliedMap.get(key)!;
      if (!isDict(item) || !inSet(item.get("action") ?? null, APPLY_ACTIONS) || typeof item.get("id") !== "string") {
        issues.push(`Invalid applied result: ${key}`);
      } else {
        const id = item.get("id") as string;
        if (!new RegExp(`^${ENTITY_PREFIX[k]}-[0-9]+$`).test(id)) issues.push(`Applied ${key} has an ID of the wrong type`);
        if (records !== null && (!records.has(id) || !pyEquals(records.get(id)!.get("type") ?? null, k))) issues.push(`Applied ID is absent or has the wrong type in .os/data: ${id}`);
      }
      continue;
    } else {
      issues.push(`Candidate ${key} has no staged row or applied result`);
      continue;
    }
    const merged: PyDict = new Map<string, PyValue>([
      ["key", key],
      ["type", k],
    ]);
    for (const [name, value] of meta) merged.set(name, value);
    const own = candidateIssues(ctx, group, merged, row, records, verifyHash, counts);
    issues.push(...own);
    // P9-R1-01: a row that passes the script's checks must also pass buildos validate (check, stage, decide, publish).
    if (verifyHash && own.length === 0 && isDict(row)) {
      const proposed = proposedRow(ctx, k, row, merged.get("action") ?? null);
      if (proposed !== undefined) issues.push(...validateRowIssues(ctx, k, proposed, `Candidate ${key}`));
    }
    const r = row as PyDict;
    const refs = isDict(r) && isList(r.get("source_refs")) ? (r.get("source_refs") as PyValue[]) : [];
    for (const anchor of [isDict(r) ? (r.get("source_anchor") ?? null) : null, ...refs]) {
      if (typeof anchor === "string" && anchor.includes("#") && expectedPaths.has(anchor.split("#", 1)[0]!)) citedPaths.add(anchor.split("#", 1)[0]!);
    }
  }
  if ([...appliedMap.keys()].some((k) => !keys.has(k))) issues.push("applied contains an unknown candidate key");
  if ([...staged.keys()].some((token) => token.startsWith(`${group.key}\0`) && !keys.has(token.slice(group.key.length + 1)))) issues.push("A staged row has no link in the source review");
  const observedOutcomes = new Map<string, Set<string>>(APPLY_ACTIONS.map((a) => [a, new Set()]));
  for (const extId of iterate(getOr(review, "extraction_ids", []))) {
    const ext = records !== null && typeof extId === "string" ? records.get(extId) : undefined;
    if (records !== null && (typeof extId !== "string" || !/^EXT-[0-9]+$/.test(extId) || ext === undefined)) issues.push(`Invalid or missing extraction ID: ${pyStr(extId)}`);
    if (ext !== undefined) {
      for (const action of APPLY_ACTIONS) {
        const values = ext.get(action);
        if (!isList(values) || values.some((v) => typeof v !== "string")) issues.push(`Extraction ${pyStr(extId)} has an invalid ${action} list`);
        else for (const v of values) observedOutcomes.get(action)!.add(v as string);
      }
      const sourceRefs = ext.get("source_refs");
      const extra = truthy(sourceRefs) ? iterate(sourceRefs) : [];
      for (const anchor of [ext.get("source_anchor") ?? null, ...extra]) {
        if (typeof anchor === "string" && anchor.includes("#") && expectedPaths.has(anchor.split("#", 1)[0]!)) citedPaths.add(anchor.split("#", 1)[0]!);
      }
    }
  }
  if (records !== null) {
    const expectedOutcomes = new Map<string, Set<string>>(APPLY_ACTIONS.map((a) => [a, new Set()]));
    for (const item of appliedMap.values()) {
      if (isDict(item) && typeof item.get("action") === "string" && expectedOutcomes.has(item.get("action") as string) && typeof item.get("id") === "string") {
        expectedOutcomes.get(item.get("action") as string)!.add(item.get("id") as string);
      }
    }
    if (APPLY_ACTIONS.some((a) => !sameSet(expectedOutcomes.get(a)!, observedOutcomes.get(a)!))) issues.push("Extraction outcomes differ from the applied candidate list");
  }
  if (!isList(review.get("extraction_ids"))) issues.push("extraction_ids must be a list");
  for (const [refId, converted] of expected) {
    const cited = typeof converted === "string" && citedPaths.has(converted);
    if (pyEquals(outcomes.get(refId) ?? null, "reviewed") && !cited) issues.push(`Reviewed ${refId} has no candidate evidence`);
    if (!pyEquals(outcomes.get(refId) ?? null, "reviewed") && cited) issues.push(`Candidate cites ${refId} without a reviewed outcome`);
  }
  if ((review.get("publication_review") ?? null) !== null && !validPublicationReview(review)) issues.push("Review decisions need a separate named, dated publication_review");
  if (issues.length > 0) return ["needs-repair", issues];
  if (truthy(review.get("publication"))) return ["publishing", []];
  const sourceCheck = getOr(review, "source_check", new Map());
  const completeSource = strNonblank(getOr(review, "reviewed_by", "")) && isDate(review.get("reviewed_at")) && inSet(get(sourceCheck, "result") ?? null, ["matched", "repaired", "partial"]) && !hasOutcome(outcomes, "pending");
  if (!completeSource) return ["in-progress", []];
  if (draft || !truthy(review.get("staged_at"))) return ["ready-to-stage", []];
  const remaining = [...keys].filter((key) => staged.has(stageToken(group.key, key))).map((key) => staged.get(stageToken(group.key, key))![1].get("_stage") as PyDict);
  if (remaining.length === 0 && !truthy(review.get("unresolved")) && !hasOutcome(outcomes, "blocked") && validPublicationReview(review)) return ["complete", []];
  if (remaining.some((meta) => pyEquals(meta.get("review_state") ?? null, "approved"))) return ["reviewed", []];
  if (remaining.some((meta) => pyEquals(meta.get("review_state") ?? null, "held"))) return ["held", []];
  if (truthy(review.get("unresolved")) || hasOutcome(outcomes, "blocked")) return ["blocked", iterate(getOr(review, "unresolved", [])).map((u) => pyStr(u))];
  return ["staged", []];
}

export function reviewState(ctx: Ctx, group: Group, records: Records | null = null, verifyHash = false): [string, string[]] {
  const path = reviewRel(group);
  if (!ctx.fs.isFile(path)) return ["pending", []];
  let review: PyValue;
  try {
    review = loads(ctx.fs.readText(path, READ_LIMITS.data));
  } catch (error) {
    if (error instanceof PyException && (error.pyClass === "JSONDecodeError" || isOsError(error))) return ["needs-repair", [`Cannot read review JSON: ${error.message}`]];
    throw error;
  }
  if (!isDict(review)) return ["needs-repair", ["Review must be a JSON object"]];
  if (!pyEquals(review.get("format_version") ?? null, 2)) return legacyReviewState(ctx, group, records, verifyHash);
  return modernReviewState(ctx, group, review, records, verifyHash);
}

function requireModern(ctx: Ctx, group: Group): PyDict {
  const path = reviewRel(group);
  if (!ctx.fs.isFile(path)) throw valueError(`Start a review first: ${group.key}`);
  const review = loads(ctx.fs.readText(path, READ_LIMITS.data));
  if (!isDict(review) || !pyEquals(review.get("format_version") ?? null, 2)) throw valueError("This is an older completed review; start a new source for new work");
  return review;
}

function saveReview(ctx: Ctx, group: Group, review: PyDict): void {
  ctx.fs.mkdirp("extractions");
  ctx.fs.replace(reviewRel(group), saveJsonBytes(review));
}

const STAGE_LOCK = "Another staged write is active; retry after it ends";

/** Runs `body` under the lock, then makes its queued writes while the lock is still held (P9-R1-10). */
function withLock<T>(ctx: Ctx, folder: string, message: string, body: () => T): T {
  const lock = ctx.fs.lock(folder, message, ctx.owner, timestamp(ctx));
  try {
    const result = body();
    ctx.fs.apply(READ_LIMITS.data);
    return result;
  } finally {
    ctx.fs.unlock(lock);
  }
}

// ---------------------------------------------------------------- buildos validate on the rows a publication writes

/**
 * The config index `buildos validate` uses (`.os/config/instance.yaml`), read
 * once with validate's own reader (P9-R2-11: the same strict UTF-8 decoding,
 * bound, and link rule). An absent config gives the empty index, as validate
 * checks rows then. A config that validate cannot read as text (not UTF-8, a
 * link, too large, unreadable) stops the command with the same finding
 * (exit 4), before anything is written.
 */
const CONFIG_READ_FINDINGS = new Set(["not_utf8", "not_regular_file", "file_too_large", "outside_root", "unreadable"]);

/** A config `buildos validate` cannot read as text (P9-R2-11); never treated as a row finding (P9-F-06). */
class ConfigUnreadable extends PyException {
  constructor(message: string) {
    super("ValueError", message);
  }
}

function configIndex(ctx: Ctx): ConfigIndex {
  if (ctx.index !== undefined) return ctx.index;
  // Review round 3 (P9-F-05): the index is built with validate's own findings budget, so it is the same index
  // validate builds for this config; the budget of the messages bulk shows never cuts the index short (a
  // config with many findings that do not concern owners still indexes every owner).
  const out = new Findings(VALIDATE_LIMITS.maxFindings);
  const index = readConfig(ctx.fs.fs, out);
  // A config validate cannot read as text (not UTF-8, a link, too large, unreadable) gives validate the empty index too, so it stops here; a finding about the config's own content is validate's to report.
  const refused = out.list.filter((finding) => finding.field === "config" && CONFIG_READ_FINDINGS.has(finding.code));
  if (refused.length > 0) {
    throw new ConfigUnreadable(`${CONFIG_PATH} would not pass buildos validate, so BuildOS cannot check the rows against it; nothing was written: ${refused.map((finding) => `${finding.code}${finding.field === "" || finding.field === "config" ? "" : ` at ${finding.field}`}: ${finding.message}`).join("; ")}. Fix the config, then run the command again`);
  }
  ctx.index = index;
  return index;
}

const PREFIX_OF_FILE = new Map(ENTITY_FILE_SPECS.map(([file, type, prefix]) => [type, { file, prefix }]));

/**
 * W1 R7 P9 review round 1 (P9-R1-01, divergence SD-16): the checks of
 * `buildos validate` (`checkEntityLines`, with the same config index) on
 * each canonical row a publication would write: scoped IDs (systems,
 * environments, owners), sentinels, anchors, times, ID format, status, and
 * the row's own shape. `label` names the row in each message. The script
 * published a row that `buildos validate` then refused (for example an owner
 * that is not in the config).
 */
function validateRowIssues(ctx: Ctx, kind: string, row: PyDict, label: string): string[] {
  const spec = PREFIX_OF_FILE.get(kind);
  if (spec === undefined) return [];
  const out = new Findings(20);
  const line = new TextDecoder().decode(jsonLine(row)).replace(/\n$/, "");
  checkEntityLines(out, `.os/data/${spec.file}`, [line], kind, spec.prefix, configIndex(ctx));
  return out.list.map((finding) => `${label} would not pass buildos validate (${finding.code}${finding.field.replace(/^line 1\.?/, "") === "" ? "" : ` at ${finding.field.replace(/^line 1\.?/, "")}`}): ${finding.message}`);
}

/** The canonical row a candidate becomes when it is published (a minted row gets a placeholder ID of its prefix). */
function proposedRow(ctx: Ctx, kind: string, row: PyDict, action: PyValue): PyDict | undefined {
  if (!pyEquals(action, "minted") && !pyEquals(action, "updated")) return undefined;
  const out = pureRow(row);
  const stamp = timestamp(ctx);
  if (pyEquals(action, "minted")) {
    out.set("id", `${ENTITY_PREFIX[kind]!}-000`);
    if ((out.get("created_at") ?? null) === null) out.set("created_at", stamp);
  }
  out.set("updated_at", stamp);
  return out;
}

// ---------------------------------------------------------------- write commands

function stage(ctx: Ctx, group: Group, author: string | undefined): string {
  if (author !== undefined && pyStrip(author) === "") throw valueError("Give a nonblank author name");
  if (author !== undefined) author = pyStrip(author);
  return withLock(ctx, "extractions/staging", STAGE_LOCK, () => {
    const review = requireModern(ctx, group);
    const records = canonicalRecords(ctx);
    const [state, issues] = modernReviewState(ctx, group, review, records, true);
    if (state === "needs-repair") throw valueError(`Review needs repair: ${issues.join("; ")}`);
    if (state === "in-progress") throw valueError("Finish the named, dated source review before staging");
    if (truthy(review.get("publication"))) throw valueError("Finish the pending publication before staging new rows");
    const additions = new Map<string, PyDict[]>();
    const existing = allStageRows(ctx);
    let drafted = 0;
    for (const candidate of idx(review, "candidates") as PyValue[]) {
      const c = asDict(candidate, "candidate");
      if (!c.has("row")) continue;
      if (!pyEquals(c.get("review_state") ?? null, "pending")) throw valueError(`Stage 1 candidate ${pyStr(idx(c, "key"))} must be pending`);
      const kind = idx(c, "type") as string;
      const key = idx(c, "key") as string;
      const row = pyDeepCopy(idx(c, "row")) as PyDict;
      const meta = stageMeta(c, group.key);
      row.set("_stage", meta);
      const prior = existing.get(stageToken(group.key, key));
      let savedAuthor: PyValue | undefined = c.get("authored_by") ?? null;
      if (savedAuthor === null && prior !== undefined) {
        const priorMeta = prior[1].get("_stage") as PyDict;
        savedAuthor = priorMeta.has("authored_by") ? priorMeta.get("authored_by")! : idx(review, "reviewed_by");
      }
      let candidateAuthor: PyValue;
      if (savedAuthor !== null) {
        if (author !== undefined && !pyEquals(author, savedAuthor)) throw valueError(`Keep the original author for partial staged candidate ${key}`);
        candidateAuthor = savedAuthor;
      } else if (author !== undefined) {
        candidateAuthor = author;
      } else if (!truthy(review.get("staged_at"))) {
        candidateAuthor = idx(review, "reviewed_by");
      } else {
        throw valueError(`New candidate ${key} needs stage --author NAME after the source was staged`);
      }
      if (!nonblank(candidateAuthor)) throw valueError(`Candidate ${key} needs a nonblank author`);
      meta.set("authored_by", candidateAuthor);
      if (prior !== undefined) {
        const comparison = pyDeepCopy(row);
        if (!(prior[1].get("_stage") as PyDict).has("authored_by")) (comparison.get("_stage") as PyDict).delete("authored_by");
        if (prior[0] !== kind || !pyEquals(prior[1], comparison)) throw valueError(`Staged candidate ${key} differs from its draft; settle the partial write`);
      } else {
        const list = additions.get(kind);
        if (list === undefined) additions.set(kind, [row]);
        else list.push(row);
      }
      c.set("authored_by", candidateAuthor);
      drafted += 1;
    }
    if (drafted > 0) saveReview(ctx, group, review);
    for (const [kind, rows] of additions) writeStage(ctx, kind, [...readStage(ctx, kind), ...rows]);
    if (drafted > 0) review.set("publication_review", null);
    review.set(
      "candidates",
      (idx(review, "candidates") as PyValue[]).map(
        (item) =>
          new Map<string, PyValue>([
            ["key", idx(item, "key")],
            ["type", idx(item, "type")],
          ]),
      ),
    );
    review.set("staged_at", timestamp(ctx));
    saveReview(ctx, group, review);
    return `Staged ${drafted} candidates; review: ${ctx.fs.native(reviewRel(group))}`;
  });
}

function stageUpdate(ctx: Ctx, group: Group, rowId: string, key: string): string {
  return withLock(ctx, "extractions/staging", STAGE_LOCK, () => {
    const review = requireModern(ctx, group);
    if (truthy(review.get("publication"))) throw valueError("Finish the pending publication first");
    if (iterate(getOr(review, "candidates", [])).some((candidate) => pyEquals(get(candidate, "key") ?? null, key))) throw valueError(`Candidate key already exists: ${key}`);
    const row = canonicalRecords(ctx).get(rowId);
    if (row === undefined || !inSet(row.get("type") ?? null, Object.keys(ENTITY_PREFIX))) throw valueError(`No supported row with ID ${rowId}`);
    (idx(review, "candidates") as PyValue[]).push(
      new Map<string, PyValue>([
        ["key", key],
        ["type", row.get("type")!],
        ["action", "updated"],
        ["review_state", "pending"],
        ["target_id", rowId],
        ["base_sha256", rowHash(ctx.hash, row)],
        ["row", pyDeepCopy(row)],
      ]),
    );
    saveReview(ctx, group, review);
    return `Copied ${rowId} into ${ctx.fs.native(reviewRel(group))}; edit this draft, then run stage`;
  });
}

function replaceRow(ctx: Ctx, group: Group, key: string, newRow: PyValue): string {
  if (!isDict(newRow) || newRow.has("_stage")) throw valueError("Pass one BuildOS row object without _stage on standard input");
  return withLock(ctx, "extractions/staging", STAGE_LOCK, () => {
    const review = requireModern(ctx, group);
    if (truthy(review.get("publication"))) throw valueError("Finish the pending publication first");
    const links = (idx(review, "candidates") as PyValue[]).filter((item) => pyEquals(get(item, "key") ?? null, key));
    if (links.length !== 1) throw valueError(`No unique candidate link: ${key}`);
    const kind = idx(links[0], "type") as string;
    const rows = readStage(ctx, kind);
    const matches = rows.map((row, n) => [row, n] as const).filter(([row]) => pyEquals((row.get("_stage") as PyDict).get("ref_id") ?? null, group.key) && pyEquals((row.get("_stage") as PyDict).get("key") ?? null, key));
    if (matches.length !== 1) throw valueError(`No unique staged row: ${key}`);
    const number = matches[0]![1];
    const meta = rows[number]!.get("_stage") as PyDict;
    if (pyEquals(meta.get("review_state") ?? null, "approved")) throw valueError("Reset an approved decision before changing its row");
    const merged = new Map<string, PyValue>([
      ["key", key],
      ["type", kind],
    ]);
    for (const [name, value] of meta) merged.set(name, value);
    const problems = candidateIssues(ctx, group, merged, newRow, canonicalRecords(ctx), true, new Map());
    if (problems.length > 0) throw valueError(`Row needs repair: ${problems.join("; ")}`);
    meta.set("review_state", "pending");
    meta.delete("review_note");
    meta.delete("reviewed_by");
    meta.delete("reviewed_at");
    const replaced = pyDeepCopy(newRow);
    replaced.delete("_stage");
    replaced.set("_stage", meta);
    rows[number] = replaced;
    writeStage(ctx, kind, rows);
    return `Replaced staged ${key} in ${ctx.fs.native(stageRel(kind))}`;
  });
}

function decide(ctx: Ctx, group: Group, reviewer: string, decisions: PyValue): string {
  if (pyStrip(reviewer) === "" || !isList(decisions)) throw valueError("Give a reviewer name and a JSON list of decisions");
  return withLock(ctx, "extractions/staging", STAGE_LOCK, () => {
    const review = requireModern(ctx, group);
    if (truthy(review.get("publication"))) throw valueError("Finish the pending publication first");
    if (pyEquals(reviewer, review.get("reviewed_by") ?? null)) throw valueError("The Stage 2 reviewer must differ from the extraction reviewer");
    // P9-R2-05: a decision that only withdraws approval (pending or held) is accepted also when a row no longer passes the checks (an owner
    // retired after approval), so the reviewer can reset it and fix the row with replace-row; an approval still needs a review that passes.
    const withdrawOnly = decisions.length > 0 && decisions.every((decision) => isDict(decision) && inSet(decision.get("review_state") ?? null, ["held", "pending"]));
    // Review round 3 (P9-F-06): a config that validate cannot read stops every decision before anything changes
    // (exit 4, validate's finding), also one that only withdraws approval; a readable config that retired an
    // owner still lets a withdrawal through (P9-R2-05).
    configIndex(ctx);
    let state: string;
    let issues: string[];
    try {
      [state, issues] = modernReviewState(ctx, group, review, canonicalRecords(ctx), true);
    } catch (error) {
      if (!withdrawOnly || !(error instanceof PyException) || error instanceof ConfigUnreadable || !/would not pass buildos validate/.test(error.message)) throw error;
      [state, issues] = ["needs-repair", [error.message]];
    }
    if (state === "needs-repair" && !withdrawOnly) throw valueError(`Review needs repair: ${issues.join("; ")}`);
    if (state === "in-progress" || state === "ready-to-stage") throw valueError("Stage 1 is not finished");
    const linked = new Map<string, string>();
    for (const item of idx(review, "candidates") as PyValue[]) linked.set(idx(item, "key") as string, idx(item, "type") as string);
    const seen = new Set<string>();
    const changes = new Map<string, [string, string, string][]>();
    const stamp = timestamp(ctx);
    for (const decision of decisions) {
      const key = get(decision, "key");
      if (!isDict(decision) || typeof key !== "string" || !linked.has(key) || seen.has(key)) {
        if (isDict(decision) && (isList(key) || isDict(key))) throw typeError(`unhashable type: '${isList(key) ? "list" : "dict"}'`);
        throw valueError("Each decision needs a distinct linked candidate key");
      }
      seen.add(key);
      const choice = decision.get("review_state") ?? null;
      if (!inSet(choice, ["approved", "held", "pending"])) throw valueError(`Invalid review_state for ${key}`);
      const note = getOr(decision, "review_note", "");
      if (typeof note !== "string" || (pyEquals(choice, "held") && pyStrip(note) === "")) throw valueError(`Held candidate ${key} needs a review_note`);
      if ((idx(review, "applied") as PyDict).has(key)) throw valueError(`Candidate ${key} is already published`);
      const kind = linked.get(key)!;
      const list = changes.get(kind);
      const change: [string, string, string] = [key, choice as string, note];
      if (list === undefined) changes.set(kind, [change]);
      else list.push(change);
    }
    for (const [kind, kindChanges] of changes) {
      const rows = readStage(ctx, kind);
      for (const [key, choice, note] of kindChanges) {
        const matches = rows.filter((row) => pyEquals((row.get("_stage") as PyDict).get("ref_id") ?? null, group.key) && pyEquals((row.get("_stage") as PyDict).get("key") ?? null, key));
        if (matches.length !== 1) throw valueError(`Missing or duplicate staged row: ${key}`);
        const meta = matches[0]!.get("_stage") as PyDict;
        meta.set("review_state", choice);
        meta.set("reviewed_by", reviewer);
        meta.set("reviewed_at", stamp);
        if (note !== "") meta.set("review_note", note);
        else meta.delete("review_note");
      }
      writeStage(ctx, kind, rows);
    }
    review.set(
      "publication_review",
      new Map<string, PyValue>([
        ["reviewed_by", reviewer],
        ["reviewed_at", stamp],
      ]),
    );
    saveReview(ctx, group, review);
    return `Recorded ${decisions.length} Stage 2 decisions for ${group.key}`;
  });
}

function pendingPublications(ctx: Ctx): string[] {
  const pending: string[] = [];
  for (const name of ctx.fs.glob("extractions", "REF-", ".json")) {
    const review = loads(ctx.fs.readText(`extractions/${name}`, READ_LIMITS.data));
    if (isDict(review) && pyEquals(review.get("format_version") ?? null, 2) && truthy(review.get("publication"))) pending.push(name);
  }
  return pending;
}

interface Operations {
  replace: PyDict;
  append: PyValue[];
}

function applyOperations(before: Uint8Array, operations: V): Uint8Array {
  const replacements = getOr(operations, "replace", new Map()) as PyDict;
  const appended = getOr(operations, "append", []) as PyValue[];
  const out: Uint8Array[] = [];
  const seen = new Set<string>();
  for (const line of splitBytesKeepEnds(before)) {
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(line);
    if (pyStrip(decodeBytesLine(line, text)) === "") {
      out.push(line);
      continue;
    }
    const row = loads(pyDecodeUtf8(line));
    const rowId = isDict(row) ? (row.get("id") ?? null) : null;
    if (typeof rowId === "string" && replacements.has(rowId)) {
      if (seen.has(rowId)) throw valueError(`Duplicate replacement ID: ${rowId}`);
      out.push(jsonLine(replacements.get(rowId)!));
      seen.add(rowId);
    } else {
      out.push(line);
    }
  }
  const missing = [...replacements.keys()].filter((id) => !seen.has(id));
  if (missing.length > 0) throw valueError(`Replacement IDs are absent: ${pyRepr(missing.sort())}`);
  let body = concat(out);
  if (body.length > 0 && body[body.length - 1] !== 0x0a) body = concat([body, new Uint8Array([0x0a])]);
  return concat([body, ...appended.map(jsonLine)]);
}

/** `bytes.strip()` on a line: ASCII white space only. */
function decodeBytesLine(line: Uint8Array, _text: string): string {
  let s = "";
  for (const b of line) s += b === 0x20 || (b >= 0x09 && b <= 0x0d) ? " " : "x";
  return s.trim() === "" ? "" : "x";
}

/** `bytes.splitlines(keepends=True)`: `\n`, `\r\n`, and `\r` end a line. */
function splitBytesKeepEnds(data: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0x0a) {
      out.push(data.subarray(start, i + 1));
      start = i + 1;
    } else if (data[i] === 0x0d) {
      const end = data[i + 1] === 0x0a ? i + 2 : i + 1;
      out.push(data.subarray(start, end));
      start = end;
      i = end - 1;
    }
  }
  if (start < data.length) out.push(data.subarray(start));
  return out;
}

function rowLimitIssues(relative: string, operations: Operations): string[] {
  const name = relative.slice(relative.lastIndexOf("/") + 1);
  const limit = jsonlRowLimit(name);
  const rows = [...operations.replace.values(), ...operations.append];
  const issues: string[] = [];
  for (const row of rows) {
    const size = jsonLine(row).length - 1;
    if (size >= limit) issues.push(`${relative}: row ${pyRepr(get(row, "id") ?? null)} would be ${size} bytes; BuildOS reads at most ${limit - 1} bytes in one line of this file`);
  }
  return issues;
}

/** The buildos validate issues of the rows a publication writes into `relative` (P9-R1-01, P9-R2-04). */
function plannedRowIssues(ctx: Ctx, relative: string, rows: readonly PyValue[]): string[] {
  const kind = relative === ".os/data/extractions.jsonl" ? "extraction" : (Object.entries(DATA_FILES).find(([, name]) => `.os/data/${name}` === relative)?.[0] ?? "");
  const issues: string[] = [];
  for (const row of rows) if (isDict(row)) issues.push(...validateRowIssues(ctx, kind, row, `Row ${pyStr(row.get("id") ?? null)}`));
  return issues;
}

function publicationPlan(ctx: Ctx, group: Group, review: PyDict, records: Records, approved: [string, PyDict][]): PyDict {
  if (approved.length === 0) throw valueError("No approved, unpublished candidates");
  const stamp = timestamp(ctx);
  const known: Records = new Map(records);
  const operations = new Map<string, Operations>();
  const outcomes = new Map<string, string[]>(APPLY_ACTIONS.map((name) => [name, []]));
  const assignments: PyDict = new Map();
  const anchors: string[] = [];
  const authors: PyValue[] = [];
  const remove: PyValue[] = [];
  const ops = (rel: string): Operations => {
    let o = operations.get(rel);
    if (o === undefined) {
      o = { replace: new Map(), append: [] };
      operations.set(rel, o);
    }
    return o;
  };
  for (const [kind, staged] of approved) {
    const meta = staged.get("_stage") as PyDict;
    const key = idx(meta, "key") as string;
    const action = idx(meta, "action") as string;
    const row = pureRow(staged);
    let rowId: string;
    if (action === "minted") {
      rowId = nextId(known, ENTITY_PREFIX[kind]!);
      // A new key goes last, and an existing key keeps its place, as in a Python dict.
      row.set("id", rowId);
      if ((row.get("created_at") ?? null) === null) row.set("created_at", stamp);
      row.set("updated_at", stamp);
      known.set(rowId, row);
      ops(`.os/data/${DATA_FILES[kind]}`).append.push(row);
    } else {
      rowId = idx(meta, "target_id") as string;
      if (!records.has(rowId)) throw valueError(`Missing target row: ${rowId}`);
      if (action === "updated") {
        if (!pyEquals(rowHash(ctx.hash, records.get(rowId)!), idx(meta, "base_sha256"))) throw valueError(`Source row changed after staging: ${rowId}; review the update again`);
        row.set("updated_at", stamp);
        ops(`.os/data/${DATA_FILES[kind]}`).replace.set(rowId, row);
      }
    }
    const author = meta.has("authored_by") ? meta.get("authored_by")! : idx(review, "reviewed_by");
    if (!authors.some((a) => pyEquals(a, author))) authors.push(author);
    const publicationReview = idx(review, "publication_review");
    assignments.set(
      key,
      new Map<string, PyValue>([
        ["id", rowId],
        ["action", action],
        ["candidate_sha256", rowHash(ctx.hash, pureRow(staged))],
        ["authored_by", author],
        ["reviewed_by", meta.has("reviewed_by") ? meta.get("reviewed_by")! : idx(publicationReview, "reviewed_by")],
        ["reviewed_at", meta.has("reviewed_at") ? meta.get("reviewed_at")! : idx(publicationReview, "reviewed_at")],
      ]),
    );
    outcomes.get(action)!.push(rowId);
    remove.push(
      new Map<string, PyValue>([
        ["kind", kind],
        ["key", key],
        ["sha256", rowHash(ctx.hash, staged)],
      ]),
    );
    const sourceRefs = staged.get("source_refs");
    for (const anchor of [staged.get("source_anchor") ?? null, ...(truthy(sourceRefs) ? iterate(sourceRefs) : [])]) {
      if (typeof anchor === "string" && !anchors.includes(anchor)) anchors.push(anchor);
    }
  }
  const outcomeIds = [...outcomes.values()].flat();
  if (outcomeIds.length !== new Set(outcomeIds).size) throw valueError("One entity cannot be both referenced and updated in one extraction; keep only the updated candidate");
  const extId = nextId(known, "EXT");
  const ext: PyDict = new Map<string, PyValue>([
    ["id", extId],
    ["type", "extraction"],
    ["title", `${group.key} source extraction`],
    ["status", "draft"],
    ["summary", `Reviewed source-backed rows from ${group.key}.`],
    ["source_anchor", idx(approved[0]![1], "source_anchor")],
    ["doc_anchor", null],
    ["source_refs", anchors],
    ["related", []],
    ["created_at", stamp],
    ["updated_at", stamp],
    ["outcome_contract", "extraction-outcomes-v1"],
    ...[...outcomes].map(([name, ids]) => [name, ids] as [string, PyValue]),
    ["extracted_by", authors.map((a) => pyStr(a)).join("; ")],
    ["extracted_at", stamp],
  ]);
  if (authors.some((a) => typeof a !== "string")) throw typeError("sequence item 0: expected str instance");
  const extIssues = extractionRowIssues(ext);
  if (extIssues.length > 0) throw valueError(`The extraction row would not pass buildos validate: ${extIssues.join("; ")}`);
  ops(".os/data/extractions.jsonl").append.push(ext);
  // P9-R1-01: every row this publication writes passes buildos validate, with the config as it is now; else nothing is written (exit 4).
  const invalid: string[] = [];
  for (const [relative, change] of operations) invalid.push(...plannedRowIssues(ctx, relative, [...change.replace.values(), ...change.append]));
  if (invalid.length > 0) throw valueError(`A published row would not pass buildos validate; nothing was written: ${invalid.join("; ")}`);
  const tooLong = [...operations].flatMap(([relative, change]) => rowLimitIssues(relative, change));
  if (tooLong.length > 0) throw valueError(`A row would be too long for BuildOS to read back; nothing was written: ${tooLong.join("; ")}`);
  const files: PyDict = new Map();
  for (const [relative, change] of operations) {
    const before = ctx.fs.readBytes(fileAt(ctx, relative), READ_LIMITS.data);
    const changeDict = new Map<string, PyValue>([
      ["replace", change.replace],
      ["append", change.append],
    ]);
    const after = applyOperations(before, changeDict);
    if (after.length > READ_LIMITS.data) throw valueError(`${relative} would be ${after.length} bytes, more than BuildOS reads from one such file; nothing was written`);
    files.set(
      relative,
      new Map<string, PyValue>([
        ["before_sha256", ctx.hash.sha256Hex(before)],
        ["after_sha256", ctx.hash.sha256Hex(after)],
        ["operations", changeDict],
      ]),
    );
  }
  return new Map<string, PyValue>([
    ["version", 2],
    ["review_sha256", rowHash(ctx.hash, review)],
    ["assignments", assignments],
    ["extraction_id", extId],
    ["files", files],
    ["remove", remove],
    ["created_at", stamp],
  ]);
}

/** A data file of a pending publication that changed in a way BuildOS cannot resolve (exit 10, the intent kept; P9-F-02). */
export class PublicationConflict extends PyException {
  constructor(message: string) {
    super("ValueError", message);
  }
}

interface PublicationFile {
  relative: string;
  /**
   * `before`: the bytes recorded before the publication; `after`: the bytes it writes; `present`: changed since,
   * and every row it writes is there exactly once (already applied); `absent`: changed since, and no row it
   * writes is there (each updated row still as it was before); `conflict`: anything else.
   */
  state: "before" | "after" | "present" | "absent" | "conflict";
  data: Uint8Array;
  ids: string[];
  why: string;
}

/**
 * W1 R7 P9 review round 3 (P9-F-02, divergence SD-22): where a pending
 * publication stands in one data file. The whole-file hashes the intent
 * records decide first. A file that matches neither (someone added an
 * unrelated row, for example) is read row by row and each row the
 * publication writes is looked up by its ID, which the intent fixed: an
 * appended row is there when exactly one row has its ID and it equals the
 * recorded row, and absent when no row has its ID; an updated row is there
 * when its one row equals the recorded update, and absent when that row's
 * hash is still the base hash its staged candidate recorded. All there:
 * `present`; none there: `absent`; anything else (a mix, an ID used twice, a
 * row with the ID that is neither, a line that is not JSON): `conflict`.
 */
function publicationFileState(ctx: Ctx, group: Group, intent: PyDict, relative: string): PublicationFile {
  const item = idx(intent.get("files")!, relative);
  const data = ctx.fs.readBytes(fileAt(ctx, relative), READ_LIMITS.data);
  const checksum = ctx.hash.sha256Hex(data);
  const operations = idx(item, "operations");
  const replace = getOr(operations, "replace", new Map()) as PyDict;
  const append = iterate(getOr(operations, "append", []));
  const ids = [...append.map((row) => pyStr(get(row, "id") ?? null)), ...[...replace.keys()]];
  const base: PublicationFile = { relative, state: "before", data, ids, why: "" };
  if (pyEquals(checksum, idx(item, "after_sha256"))) return { ...base, state: "after" };
  if (pyEquals(checksum, idx(item, "before_sha256"))) return base;
  const conflict = (why: string): PublicationFile => ({ ...base, state: "conflict", why });
  const rows = new Map<string, string[]>();
  for (const line of splitBytesKeepEnds(data)) {
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(line);
    if (pyStrip(decodeBytesLine(line, text)) === "") continue;
    let row: PyValue;
    try {
      row = loads(pyDecodeUtf8(line));
    } catch (error) {
      if (error instanceof PyException) return conflict("a line of the file is not a JSON row");
      throw error;
    }
    const id = isDict(row) ? (row.get("id") ?? null) : null;
    if (typeof id !== "string") continue;
    const list = rows.get(id);
    const digest = rowHash(ctx.hash, row);
    if (list === undefined) rows.set(id, [digest]);
    else list.push(digest);
  }
  let there = 0;
  let missing = 0;
  for (const row of append) {
    const id = pyStr(get(row, "id") ?? null);
    const found = rows.get(id) ?? [];
    if (found.length === 0) missing++;
    else if (found.length === 1 && found[0] === rowHash(ctx.hash, row)) there++;
    else return conflict(found.length > 1 ? `the ID ${id} is there more than once` : `a row with the ID ${id} is there but is not the publication's row`);
  }
  const baseHashes = updatedBaseHashes(ctx, group, intent);
  for (const [id, row] of replace) {
    const found = rows.get(id) ?? [];
    if (found.length !== 1) return conflict(found.length === 0 ? `the updated row ${id} is not there` : `the ID ${id} is there more than once`);
    if (found[0] === rowHash(ctx.hash, row)) there++;
    else if (baseHashes.get(id) !== undefined && found[0] === baseHashes.get(id)) missing++;
    else return conflict(`the row ${id} is neither the publication's update nor the row as it was before`);
  }
  if (missing === 0) return { ...base, state: "present" };
  if (there === 0) return { ...base, state: "absent" };
  return conflict("some of the publication's rows are there and some are not");
}

/** The base hash each updated row of a pending publication was staged against, by row ID (from the staged candidates, which stay until it ends). */
function updatedBaseHashes(ctx: Ctx, group: Group, intent: PyDict): Map<string, string> {
  const out = new Map<string, string>();
  const kinds = new Map<string, string>();
  for (const item of iterate(getOr(intent, "remove", []))) if (isDict(item)) kinds.set(pyStr(item.get("key") ?? null), pyStr(item.get("kind") ?? null));
  const assignments = getOr(intent, "assignments", new Map());
  if (!isDict(assignments)) return out;
  for (const [key, outcome] of assignments) {
    if (!isDict(outcome) || !pyEquals(outcome.get("action") ?? null, "updated")) continue;
    const kind = kinds.get(key);
    if (kind === undefined || !Object.hasOwn(DATA_FILES, kind)) continue;
    for (const row of readStage(ctx, kind)) {
      const meta = row.get("_stage");
      if (isDict(meta) && pyEquals(meta.get("ref_id") ?? null, group.key) && pyEquals(meta.get("key") ?? null, key)) {
        const digest = meta.get("base_sha256");
        if (typeof digest === "string") out.set(pyStr(outcome.get("id") ?? null), digest);
      }
    }
  }
  return out;
}

function resumePublication(ctx: Ctx, group: Group, review: PyDict): string {
  const intent = review.get("publication");
  if (!isDict(intent) || !pyEquals(intent.get("version") ?? null, 2)) throw valueError("Invalid pending publication");
  const unchanged = new Map(review);
  unchanged.delete("publication");
  if (!pyEquals(intent.get("review_sha256") ?? null, rowHash(ctx.hash, unchanged))) throw valueError("Review changed during publication; resolve the pending write first");
  const files = intent.get("files");
  const allowed = new Set([...Object.values(DATA_FILES).map((name) => `.os/data/${name}`), ".os/data/extractions.jsonl"]);
  if (!isDict(files) || !files.has(".os/data/extractions.jsonl") || [...files.keys()].some((name) => !allowed.has(name))) throw valueError("Pending publication has invalid system data files");
  const ordered = [...[...files.keys()].filter((name) => name !== ".os/data/extractions.jsonl").sort(), ".os/data/extractions.jsonl"];
  const assigned = intent.get("assignments");
  ctx.publishing = { keys: isDict(assigned) ? [...assigned.keys()] : [], extractionId: intent.get("extraction_id") ?? null };
  // Review round 3 (P9-F-02, divergence SD-22): the state of each data file of the publication, before any write.
  const states = ordered.map((relative) => publicationFileState(ctx, group, intent, relative));
  const conflicts = states.filter((item) => item.state === "conflict");
  if (conflicts.length > 0) {
    const review = ctx.fs.native(reviewRel(group));
    const named = conflicts.map((item) => `${item.relative} (rows ${item.ids.join(", ")}: ${item.why})`).join("; ");
    throw new PublicationConflict(
      `The pending publication in ${review} cannot go on: ${conflicts.length === 1 ? "a data file" : "data files"} changed since the publication started, and BuildOS cannot tell whether the publication's rows are in ${conflicts.length === 1 ? "it" : "them"}: ${named}. Nothing was written, and the publication stays pending with the row IDs it gave. ` +
        `Open each file named and look for those IDs. Where a row with one of them is there more than once, or is not the publication's row, put it right by hand: keep exactly one copy of the publication's row, or remove that ID's rows; for an updated row, keep the row either as the publication wrote it or as it was before. ` +
        `Then run the same publish command again: it adds a row only when its ID is not in the file yet, so it never writes a row twice. Do not delete the "publication" entry from ${review}: the next publication would give the rows new IDs.`,
    );
  }
  // P9-R2-04: a pending publication is finished only when its recorded rows still pass buildos validate with the config as it is now.
  const invalid: string[] = [];
  for (const relative of ordered) {
    const operations = idx(files.get(relative)!, "operations");
    invalid.push(...plannedRowIssues(ctx, relative, [...(getOr(operations, "replace", new Map()) as PyDict).values(), ...iterate(getOr(operations, "append", []))]));
  }
  if (invalid.length > 0) {
    const review = ctx.fs.native(reviewRel(group));
    // P9-F-02: withdrawal is offered only when every data file is exactly as it was before the publication started.
    const notBefore = states.filter((item) => item.state !== "before");
    const done = states.filter((item) => item.state === "after" || item.state === "present").map((item) => item.relative);
    const next =
      notBefore.length === 0
        ? `No data file holds a row of it yet. Either restore what the config defined (for example the owner) and run the same publish command again, or withdraw the publication: BuildOS has no command for that, so delete the "publication" entry from ${review} by hand; the approved rows stay staged, and you can reset a decision with decide and fix a row with replace-row`
        : done.length > 0
          ? `${done.join(", ")} already ${done.length === 1 ? "holds" : "hold"} rows of it, so restore what the config defined (for example the owner) and run the same publish command again to finish it; do not delete the "publication" entry`
          : `${notBefore.map((item) => item.relative).join(", ")} changed since the publication started, so restore what the config defined (for example the owner) and run the same publish command again to finish it; do not delete the "publication" entry`;
    throw valueError(`The pending publication in ${review} would write rows that do not pass buildos validate with the config as it is now; nothing was written and the publication stays pending: ${invalid.join("; ")}. ${next}`);
  }
  for (const item of states) {
    if (item.state === "after" || item.state === "present") continue;
    const operations = idx(files.get(item.relative)!, "operations");
    const after = applyOperations(item.data, operations);
    if (item.state === "before") {
      if (!pyEquals(ctx.hash.sha256Hex(after), idx(files.get(item.relative)!, "after_sha256"))) throw valueError(`Pending publication does not match ${item.relative}`);
    } else if (after.length > READ_LIMITS.data) {
      throw valueError(`${item.relative} would be ${after.length} bytes, more than BuildOS reads from one such file; nothing was written`);
    }
    ctx.fs.replace(fileAt(ctx, item.relative), after);
  }
  const removeList = iterate(idx(intent, "remove"));
  const kinds: string[] = [];
  for (const item of removeList) {
    const kind = idx(item, "kind") as string;
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  for (const kind of kinds) {
    const rows = readStage(ctx, kind);
    const remove = new Map<string, PyValue>();
    for (const item of removeList) if (pyEquals(idx(item, "kind"), kind)) remove.set(idx(item, "key") as string, idx(item, "sha256"));
    const kept: PyDict[] = [];
    for (const row of rows) {
      const meta = row.get("_stage") as PyDict;
      const key = pyEquals(meta.get("ref_id") ?? null, group.key) ? (meta.get("key") ?? null) : null;
      if (typeof key === "string" && remove.has(key)) {
        if (!pyEquals(rowHash(ctx.hash, row), remove.get(key)!)) throw valueError(`Staged row ${key} changed during publication`);
        continue;
      }
      kept.push(row);
    }
    if (kept.length !== rows.length) writeStage(ctx, kind, kept);
  }
  const assignments = idx(intent, "assignments") as PyDict;
  const appliedMap = idx(review, "applied") as PyDict;
  for (const [key, outcome] of assignments) appliedMap.set(key, outcome);
  const extId = idx(intent, "extraction_id");
  const extIds = idx(review, "extraction_ids") as PyValue[];
  if (!extIds.some((id) => pyEquals(id, extId))) extIds.push(extId);
  review.delete("publication");
  saveReview(ctx, group, review);
  return `Published ${assignments.size} candidates as ${pyStr(extId)}.`;
}

function publish(ctx: Ctx, group: Group): string {
  return withLock(ctx, "extractions/staging", STAGE_LOCK, () =>
    withLock(ctx, ".os/data", "Another publication is active; retry after it ends", () => {
      const review = requireModern(ctx, group);
      const pending = pendingPublications(ctx);
      if (pending.length > 0 && !(pending.length === 1 && pending[0] === group.filename)) throw valueError(`Resume pending publication first: ${pending[0]}`);
      if (truthy(review.get("publication"))) return resumePublication(ctx, group, review);
      const records = canonicalRecords(ctx);
      const [state, issues] = modernReviewState(ctx, group, review, records, true);
      if (state === "needs-repair") throw valueError(`Review needs repair: ${issues.join("; ")}`);
      if (state === "pending" || state === "in-progress" || state === "ready-to-stage") throw valueError("Stage 1 needs a named, dated source review and staged rows");
      if (!validPublicationReview(review)) throw valueError("A separate named Stage 2 review is required");
      if ((idx(review, "references") as PyValue[]).some((ref) => pyEquals(get(ref, "outcome") ?? null, "pending"))) throw valueError("Review every converted reference before publication");
      const staged = allStageRows(ctx);
      const approved: [string, PyDict][] = [];
      for (const link of idx(review, "candidates") as PyValue[]) {
        const pair = staged.get(stageToken(group.key, idx(link, "key") as string));
        if (pair !== undefined && pyEquals((pair[1].get("_stage") as PyDict).get("review_state") ?? null, "approved")) approved.push(pair);
      }
      if (approved.length === 0) {
        const references = idx(review, "references") as PyValue[];
        if (state === "complete" || ((idx(review, "candidates") as PyValue[]).length === 0 && !truthy(review.get("unresolved")) && references.every((ref) => pyEquals(idx(ref, "outcome"), "no-new-rows")))) return "Review complete; no rows to publish";
        return "No approved, unpublished candidates; held and pending rows remain staged";
      }
      const intent = publicationPlan(ctx, group, review, records, approved);
      review.set("publication", intent);
      saveReview(ctx, group, review);
      return resumePublication(ctx, group, review);
    }),
  );
}

// ---------------------------------------------------------------- arguments and main

export interface BulkInput {
  /** The arguments after `extract bulk`, without `--root` and `--json`. */
  args: readonly string[];
  root?: string | undefined;
  cwd: string;
  openFs: FsPortFactory;
  hash: HashPort;
  now: () => Date;
  /** Standard input as text (bounded by the CLI), for `replace-row` and `decide`. */
  readStdin: () => string;
  /** The path separator of this system. */
  sep: string;
  /** Who takes a lock (the process and the host), written into the lock file (SD-09). */
  owner?: LockOwner;
}

export type BulkOutcome = "ok" | "usage" | "input" | "contract" | "io" | "review";

export interface BulkRun {
  command: string;
  outcome: BulkOutcome;
  stdout: string;
  stderr: string;
  root: string;
  result: unknown;
  wrote: boolean;
  /** What the run left that it could not put back or clean up, with exact paths (exit 10, `partially_applied`; P9-R2-07, P9-R2-08). */
  notRestored?: NotRestored[];
  /** The arguments did not parse (the script's `argparse` error); `stderr` holds the reason. */
  argparse?: boolean;
}

export const BULK_SUBCOMMANDS = ["status", "next", "show", "start", "check", "stage", "publish", "template", "stage-update", "replace-row", "decide"] as const;

interface Spec {
  positionals: string[];
  options: Record<string, { required?: boolean; choices?: string[]; int?: boolean }>;
}

const SPECS: Record<string, Spec> = {
  status: { positionals: [], options: {} },
  next: { positionals: [], options: { "--count": { int: true }, "--stage": { choices: ["extract", "review"] } } },
  show: { positionals: ["ref_id"], options: {} },
  start: { positionals: ["ref_id"], options: {} },
  check: { positionals: ["ref_id"], options: {} },
  stage: { positionals: ["ref_id"], options: { "--author": {} } },
  publish: { positionals: ["ref_id"], options: {} },
  template: { positionals: ["type"], options: {} },
  "stage-update": { positionals: ["ref_id", "row_id"], options: { "--key": { required: true } } },
  "replace-row": { positionals: ["ref_id", "key"], options: {} },
  decide: { positionals: ["ref_id"], options: { "--reviewer": { required: true } } },
};

class Usage extends Error {}

/** An `argparse`-like parse of one subcommand: positionals and `--name value` (or `--name=value`) in any order. */
function parseSub(command: string, args: readonly string[]): Record<string, string> {
  const spec = SPECS[command]!;
  const values: Record<string, string> = {};
  const positionals: string[] = [];
  let onlyPositionals = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!onlyPositionals && arg === "--") {
      onlyPositionals = true;
      continue;
    }
    if (!onlyPositionals && arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq < 0 ? arg : arg.slice(0, eq);
      const option = Object.hasOwn(spec.options, name) ? spec.options[name] : undefined;
      if (option === undefined) throw new Usage(`${command}: unknown option ${name}`);
      const given: string | undefined = eq < 0 ? args[i + 1] : arg.slice(eq + 1);
      if (given === undefined || (eq < 0 && given.startsWith("-") && !/^-[0-9]/.test(given))) throw new Usage(`${command}: ${name} needs a value`);
      if (eq < 0) i++;
      const value: string = given;
      if (option.choices !== undefined && !option.choices.includes(value)) throw new Usage(`${command}: ${name} must be one of ${option.choices.join(", ")}; got ${value}`);
      if (option.int === true && !/^[-+]?[0-9]+$/.test(pyStrip(value))) throw new Usage(`${command}: ${name} needs a whole number; got ${value}`);
      values[name] = value;
      continue;
    }
    if (!onlyPositionals && arg.startsWith("-") && arg.length > 1 && !/^-[0-9]/.test(arg)) throw new Usage(`${command}: unknown option ${arg}`);
    positionals.push(arg);
  }
  if (positionals.length < spec.positionals.length) throw new Usage(`${command} needs ${spec.positionals.slice(positionals.length).join(" and ")}`);
  if (positionals.length > spec.positionals.length) throw new Usage(`${command}: unexpected argument ${positionals[spec.positionals.length]}`);
  spec.positionals.forEach((name, i) => (values[name] = positionals[i]!));
  for (const [name, option] of Object.entries(spec.options)) if (option.required === true && values[name] === undefined) throw new Usage(`${command} needs ${name}`);
  if (command === "template" && !Object.hasOwn(ENTITY_PREFIX, values["type"]!)) throw new Usage(`template: the type must be one of ${Object.keys(ENTITY_PREFIX).join(", ")}; got ${values["type"]}`);
  return values;
}

function templateJson(kind: string): PyValue {
  return new Map<string, PyValue>([
    ["candidate", candidateTemplate(kind)],
    ["field_meanings", new Map<string, PyValue>(TYPE_FIELDS[kind]!)],
    ["common_field_meanings", new Map<string, PyValue>(COMMON_MEANINGS)],
  ]);
}

/** Runs one subcommand. User errors are a result, never a throw. */
export function runBulk(input: BulkInput): BulkRun {
  const [command, ...rest] = input.args;
  const { root, fs } = resolveDefaultRoot({ root: input.root, cwd: input.cwd, openFs: input.openFs });
  const bfs = new BulkFs(fs, root, input.sep);
  const ctx: Ctx = { fs: bfs, hash: input.hash, now: input.now, owner: input.owner ?? { pid: 0, host: "unknown" } };
  const run: BulkRun = { command: `extract.bulk${command === undefined ? "" : `.${command}`}`, outcome: "ok", stdout: "", stderr: "", root, result: null, wrote: false };
  const out: string[] = [];
  const print = (line: string): void => {
    out.push(`${line}\n`);
  };
  try {
    if (command === undefined || !(BULK_SUBCOMMANDS as readonly string[]).includes(command)) {
      throw new Usage(command === undefined ? "extract bulk needs a subcommand" : `extract bulk: unknown subcommand ${command}`);
    }
    const args = parseSub(command, rest);
    const groups = groupsFromIndex(ctx);
    if (command === "template") {
      const value = templateJson(args["type"]!);
      print(pyDumps(value, { indent: 2 }));
      run.result = JSON.parse(pyDumps(value));
      return finish(run, out, bfs);
    }
    if (command === "status" || command === "next") {
      const states = groups.map((group) => [group, ...reviewState(ctx, group)] as const);
      if (command === "status") {
        const counts = new Map<string, number>();
        for (const [, state] of states) counts.set(state, (counts.get(state) ?? 0) + 1);
        const records = groups.reduce((n, group) => n + group.refs.length, 0);
        print(`${groups.length} sources; ${records} converted records`);
        print("Progress comes from root review files and tagged staged rows; check REF-ID verifies links.");
        const order = ["complete", "ready-to-stage", "staged", "reviewed", "held", "publishing", "in-progress", "blocked", "needs-repair", "pending"];
        for (const state of order) print(`${state}: ${counts.get(state) ?? 0}`);
        run.result = { sources: groups.length, converted_records: records, states: Object.fromEntries(order.map((s) => [s, counts.get(s) ?? 0])) };
      } else {
        let count = args["--count"] === undefined ? 1 : Number.parseInt(pyStrip(args["--count"]), 10);
        const stageName = args["--stage"] ?? "extract";
        if (count < 1) throw valueError("--count must be positive");
        const items: unknown[] = [];
        for (const [group, state] of states) {
          const path = reviewRel(group);
          if (stageName === "extract" && bfs.exists(path)) continue;
          if (stageName === "review") {
            if (!bfs.isFile(path)) continue;
            const review = loads(bfs.readText(path, READ_LIMITS.data));
            if (!pyEquals(get(review, "format_version") ?? null, 2) || !truthy(get(review, "staged_at")) || state === "complete") {
              if (!isDict(review)) throw new PyException("AttributeError", `'${isList(review) ? "list" : "str"}' object has no attribute 'get'`);
              continue;
            }
          }
          print(`${group.key}\t${state}\t${group.refs.length} twins\t${group.source}`);
          items.push({ key: group.key, state, twins: group.refs.length, source: group.source });
          count -= 1;
          if (count === 0) break;
        }
        run.result = { items };
      }
      return finish(run, out, bfs);
    }
    const group = groupFor(groups, args["ref_id"]!);
    const path = reviewRel(group);
    if (command === "show") {
      const candidates: PyValue[] = [];
      if (bfs.isFile(path)) {
        const review = loads(bfs.readText(path, READ_LIMITS.data));
        if (pyEquals(get(review, "format_version") ?? null, 2)) {
          const staged = allStageRows(ctx);
          for (const link of iterate(getOr(review, "candidates", []))) {
            const key = get(link, "key") ?? null;
            const kind = get(link, "type") ?? null;
            const pair = typeof key === "string" ? staged.get(stageToken(group.key, key)) : undefined;
            const location = isDict(link) && link.has("row") ? "draft review" : pair !== undefined ? bfs.native(stageRel(kind as string)) : "published";
            candidates.push(
              new Map<string, PyValue>([
                ["key", key],
                ["type", kind],
                ["location", location],
                ["stage", pair !== undefined ? pair[1].get("_stage")! : null],
                ["applied", get(getOr(review, "applied", new Map()), key as string) ?? null],
              ]),
            );
          }
        } else if (!isDict(review)) throw new PyException("AttributeError", `'${isList(review) ? "list" : "str"}' object has no attribute 'get'`);
      }
      const value = new Map<string, PyValue>([
        ["key", group.key],
        ["source", group.source],
        ["references", group.refs.map((ref) => new Map<string, PyValue>([["id", ref.get("id")!], ["converted", ref.get("converted")!]]))],
        ["review", bfs.native(path)],
        ["candidates", candidates],
      ]);
      print(pyDumps(value, { indent: 2 }));
      run.result = JSON.parse(pyDumps(value));
      return finish(run, out, bfs);
    }
    if (command === "start") {
      bfs.mkdirp("extractions");
      const skeleton = new Map<string, PyValue>([
        ["format_version", 2],
        ["source", group.source],
        ["source_sha256", group.sha256],
        ["reviewed_by", ""],
        ["reviewed_at", ""],
        [
          "source_check",
          new Map<string, PyValue>([
            ["result", "unverified"],
            ["notes", ""],
            ["repairs", []],
          ]),
        ],
        [
          "references",
          group.refs.map(
            (ref) =>
              new Map<string, PyValue>([
                ["id", ref.get("id")!],
                ["converted", ref.get("converted")!],
                ["outcome", "pending"],
                ["note", ""],
              ]),
          ),
        ],
        ["candidates", []],
        ["unresolved", []],
        ["applied", new Map()],
        ["extraction_ids", []],
        ["publication_review", null],
      ]);
      const created = bfs.createExclusive(path, new TextEncoder().encode(`${pyDumps(skeleton, { indent: 2 })}\n`));
      bfs.apply(READ_LIMITS.data);
      print(created ? `Created: ${bfs.abs(path)}` : `Review already exists: ${bfs.abs(path)}`);
      run.wrote = bfs.changed > 0;
      run.result = { created, review: bfs.native(path) };
      return finish(run, out, bfs);
    }
    if (command === "stage-update") {
      const message = stageUpdate(ctx, group, args["row_id"]!, args["--key"]!);
      print(message);
      run.result = { message };
      return finish(run, out, bfs);
    }
    if (command === "stage") {
      const message = stage(ctx, group, args["--author"]);
      print(message);
      run.result = { message };
      return finish(run, out, bfs);
    }
    if (command === "replace-row" || command === "decide") {
      const value = loads(input.readStdin());
      const message = command === "replace-row" ? replaceRow(ctx, group, args["key"]!, value) : decide(ctx, group, args["--reviewer"]!, value);
      print(message);
      run.result = { message };
      return finish(run, out, bfs);
    }
    if (command === "publish") {
      const message = publish(ctx, group);
      print(message);
      run.result = { message };
      return finish(run, out, bfs);
    }
    const [state, issues] = reviewState(ctx, group, canonicalRecords(ctx), true);
    print(`${group.key}: ${state} (${bfs.abs(path)})`);
    for (const issue of issues) print(`- ${issue}`);
    run.result = { key: group.key, state, review: bfs.native(path), issues };
    if (["needs-repair", "in-progress", "pending", "publishing"].includes(state)) run.outcome = "contract";
    return finish(run, out, bfs);
  } catch (error) {
    bfs.removeMadeFolders();
    run.stdout = out.join("");
    run.result = null;
    if (error instanceof Usage) {
      run.outcome = "usage";
      run.argparse = true;
      run.stderr = `${error.message}\n`;
      run.wrote = false;
      return run;
    }
    if (error instanceof PyException) {
      run.stderr = `Error: ${error.message}\n`;
      run.outcome = classify(error);
      // P9-R1-10: a failed write that was undone changed nothing; one that could not be undone names what stays (exit 10).
      run.wrote = false;
      const left = [...(error instanceof BulkWriteError ? error.notRestored : []), ...bfs.lockLeft];
      if (left.length > 0) {
        run.notRestored = left;
        // P9-R2-01: the intent stays in the review while a data file of the publication is not surely back, and publish finishes it.
        const reviewLeft = left.find((item) => item.path.startsWith("extractions/REF-"));
        if (command === "publish" && reviewLeft !== undefined) run.stderr += `${reviewAfterFailure(ctx, reviewLeft.path, input.args[1] ?? "REF-ID")}\n`;
        for (const item of bfs.lockLeft) run.stderr += `BuildOS could not remove ${item.path}: delete it before the next command.\n`;
      }
      return run;
    }
    throw error;
  }
}

/**
 * W1 R7 P9 review round 3 (P9-F-07): what the review holds after a publish
 * whose undo was incomplete, read from the file as it is now: a pending
 * publication, a complete one, one put back as it was before, or, when
 * BuildOS cannot read or place it, a plain "cannot tell" with the command
 * that shows it.
 */
function reviewAfterFailure(ctx: Ctx, rel: string, ref: string): string {
  const uncertain = `BuildOS cannot tell what the review ${rel} holds now. Run the same command with check in place of publish to see its state before you run publish again.`;
  let review: PyValue;
  try {
    review = loads(ctx.fs.readText(rel, READ_LIMITS.data));
  } catch (error) {
    if (error instanceof PyException) return uncertain;
    throw error;
  }
  if (!isDict(review)) return uncertain;
  if (truthy(review.get("publication"))) return `The review ${rel} still holds the pending publication. Fix the problem above, then run the same publish command again to finish it.`;
  const publishing = ctx.publishing;
  const applied = review.get("applied");
  const extIds = review.get("extraction_ids");
  if (publishing === undefined || publishing.keys.length === 0 || !isDict(applied) || !isList(extIds)) return uncertain;
  const published = publishing.keys.filter((key) => applied.has(key)).length;
  const listed = extIds.some((id) => pyEquals(id, publishing.extractionId));
  if (published === publishing.keys.length && listed) return `The review ${rel} shows the publication as complete: all ${published} rows are published as ${pyStr(publishing.extractionId)}, and no publication is pending. Check the paths listed above; do not publish again.`;
  if (published === 0 && !listed) return `The review ${rel} holds no pending publication, and none of its rows is published: it is as it was before this publish. Check the paths listed above, fix the problem, then run the same publish command again.`;
  return uncertain;
}

/** The run's output; `write_status` says `applied` only when a file really changed (P9-R1-10). */
function finish(run: BulkRun, out: string[], bfs: BulkFs): BulkRun {
  bfs.apply(READ_LIMITS.data);
  run.stdout = out.join("");
  run.wrote = bfs.changed > 0;
  // P9-R2-08: the writes completed, but a lock file that stays stops the next command: exit 10 with its exact path.
  if (bfs.lockLeft.length > 0) {
    run.notRestored = [...bfs.lockLeft];
    for (const item of bfs.lockLeft) run.stderr += `Error: the command's changes are complete, but BuildOS could not remove its lock file ${item.path}; delete it before the next command.\n`;
  }
  return run;
}

/** PRD 20 exit class of a script error (the script exited 2 for every one; divergence SD-01). */
function classify(error: PyException): BulkOutcome {
  if (error instanceof PublicationConflict) return "review";
  if (error.pyClass === "ValueError" && error.message === "--count must be positive") return "usage";
  if (error.forWrite) return "io";
  if (["JSONDecodeError", "UnicodeDecodeError", "KeyError", "TypeError", "AttributeError", "RecursionError", "FileNotFoundError", "PermissionError", "IsADirectoryError", "NotADirectoryError", "OSError"].includes(error.pyClass)) return "input";
  if (/^Invalid (staged )?JSONL in |^Missing or duplicate ID in |^Missing _stage block in |^Wrong row type in |^Reference index has no references list$|^Invalid reference record: |^Duplicate reference ID: |^Inconsistent source hashes: |^Invalid repo-relative path: |^Path leaves repo: |^embedded null byte$/.test(error.message)) return "input";
  return "contract";
}
