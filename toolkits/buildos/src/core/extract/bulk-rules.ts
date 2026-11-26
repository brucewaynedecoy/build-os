/**
 * The row and review rules of `buildos extract bulk`, ported from the skill
 * script `buildos-bulk-extract/scripts/work.py` (W1 R7 P9 t4): the saved
 * anchor rules (the same as `buildos validate`, PRD 13), the extraction-row
 * check, the field checks of a candidate row, the candidate template, and
 * the hashes. Messages, order, and Python value texts (`repr`) are the
 * script's. The file access and the commands are in `bulk.ts`.
 */

import type { HashPort } from "../shared/hash-port.ts";
import { pyIsoformatParses } from "../shared/py-datetime.ts";
import { isDict, isList, pyDumps, pyEquals, pyRepr, pyStr, pyStrip, type PyDict, type PyValue } from "../shared/py-json.ts";
import { typeError } from "../shared/py-text.ts";

export type V = PyValue | undefined;

export const REF_ID = /^REF-([0-9]+)$/;
export const ENTITY_PREFIX: Record<string, string> = {
  requirement: "REQ",
  capability: "CAP",
  persona: "PER",
  "test-case": "TC",
  result: "RES",
  run: "RUN",
  finding: "FIND",
};
export const REF_OUTCOMES = ["pending", "reviewed", "no-new-rows", "blocked"];
export const CHECK_RESULTS = ["unverified", "matched", "repaired", "partial"];
/**
 * The script's `APPLY_ACTIONS` is a Python set, so its iteration order (the
 * key order of an extraction row's outcome lists, and the order of some
 * messages) depended on the string hash seed of each run. BuildOS uses one
 * fixed order: the order Python gives with `PYTHONHASHSEED=0`, which the
 * goldens were captured with (divergence SD-08).
 */
export const APPLY_ACTIONS = ["minted", "updated", "referenced"];
export const REVIEW_DECISIONS = ["pending", "approved", "held"];
export const DATA_FILES: Record<string, string> = {
  requirement: "requirements.jsonl",
  capability: "capabilities.jsonl",
  persona: "personas.jsonl",
  "test-case": "test-cases.jsonl",
  result: "results.jsonl",
  run: "runs.jsonl",
  finding: "findings.jsonl",
};
export const DATA_KINDS = Object.keys(DATA_FILES);

export const COMMON_MEANINGS: [string, string][] = [
  ["key", "Local candidate key; unique within this review"],
  ["action", "minted=new row, referenced=reuse without change, updated=correct saved row"],
  ["review_state", "pending in extraction; approved or held only in separate review"],
  ["row.status", "BuildOS lifecycle: draft, active, superseded, archived; not review state"],
  ["row.title", "Nonempty text"],
  ["row.summary", "Nonempty text"],
  ["row.source_anchor", "This source's converted assets/path#Lnumber or #row-number"],
  ["row.source_refs", "List of supporting path#anchor values or entity IDs"],
  ["row.related", "List of entity IDs"],
  ["row.doc_anchor", "Null for a draft, docs/path.md#anchor otherwise"],
  ["row.created_at", "ISO 8601 date or datetime, or null"],
  ["row.updated_at", "ISO 8601 date or datetime, or null"],
  ["unresolved", "Open questions belong in the review's unresolved list, not a row reference field"],
];

export const TYPE_FIELDS: Record<string, [string, string][]> = {
  requirement: [
    ["statement", "text"],
    ["rationale", "text"],
    ["acceptance_refs", "references"],
  ],
  capability: [
    ["description", "text"],
    ["supports", "references"],
    ["limits", "text list"],
  ],
  persona: [
    ["description", "text"],
    ["goals", "text list"],
    ["needs", "text list"],
  ],
  "test-case": [
    ["verifies", "IDs"],
    ["preconditions", "text list"],
    ["steps", "text list"],
    ["expected", "text"],
  ],
  result: [
    ["target_id", "ID"],
    ["outcome", "pass|fail|blocked|inconclusive"],
    ["evidence_refs", "references"],
  ],
  run: [
    ["playbook_id", "PB ID or null"],
    ["started_at", "ISO date"],
    ["ended_at", "ISO date or null"],
    ["inputs", "object"],
    ["outputs", "object or list"],
  ],
  finding: [
    ["observed", "text"],
    ["basis_refs", "references"],
    ["confidence", "low|medium|high"],
    ["implications", "related IDs or narrative references"],
  ],
};

export const ENTITY_ID = /^(?:REQ|CAP|PER|TC|RES|RUN|FIND|EXT|PB)-[0-9]{3,}$/;
export const REQUIRED_LIST_FIELDS: Record<string, string[]> = {
  requirement: ["acceptance_refs"],
  capability: ["supports", "limits"],
  persona: ["goals", "needs"],
  "test-case": ["verifies", "preconditions", "steps"],
  result: ["evidence_refs"],
  run: [],
  finding: ["basis_refs", "implications"],
};
const OPTIONAL_LIST_FIELDS = ["systems", "environments", "owners", "tags"];
const SCOPED_FIELDS = ["systems", "environments", "owners"];
const RESERVED_SCOPED_VALUES = ["both"];
const LEGACY_SCOPED_FIELDS = ["env", "for", "envs", "target_systems"];
const UTC_DATETIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?Z$/;
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]+:/;

/** `dict.get` on a value that is a dict. */
export function get(d: V, key: string): V {
  return isDict(d) ? d.get(key) : undefined;
}

/** `d.get(key, default)`. */
export function getOr(d: V, key: string, fallback: PyValue): PyValue {
  if (!isDict(d)) return fallback;
  return d.has(key) ? d.get(key)! : fallback;
}

/** `x in {...}`: Python's set membership, with `TypeError` for a list or a dict. */
export function inSet(value: V, set: readonly string[]): boolean {
  if (isList(value)) throw typeError("unhashable type: 'list'");
  if (isDict(value)) throw typeError("unhashable type: 'dict'");
  return typeof value === "string" && set.includes(value);
}

/** `isinstance(value, str) and value.strip()` as a test. */
export function nonblank(value: V): boolean {
  return typeof value === "string" && pyStrip(value) !== "";
}

/** `str(value).strip()` is not empty. */
export function strNonblank(value: V): boolean {
  return pyStrip(pyStr(value ?? null)) !== "";
}

export function fullmatch(re: RegExp, value: V): boolean {
  return typeof value === "string" && re.test(value);
}

/** The anchor path with `.` and `..` folded, or null when it is absolute or leaves the project folder. */
export function normalizeAnchorPath(path: string): string | null {
  if (path === "") return "";
  if (/^[/\\]/.test(path) || /^[A-Za-z]:/.test(path)) return null;
  const parts: string[] = [];
  for (const part of path.split(/[/\\]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

/** The `buildos validate` rules for a saved path#anchor (PRD 13). */
export function savedAnchorIssue(value: V, under?: string): string | null {
  if (typeof value !== "string" || value === "") return "needs a path#anchor reference";
  const hash = value.indexOf("#");
  const path = hash < 0 ? value : value.slice(0, hash);
  const fragment = hash < 0 ? "" : value.slice(hash + 1);
  if (hash < 0 || fragment === "") return "needs a path#anchor reference with text after the first #";
  if (URI_SCHEME.test(path)) return "must name a file in the project folder, not a web address or other URI";
  const normalized = normalizeAnchorPath(path);
  if (path === "" || normalized === null || normalized === "") return "must name a file inside the project folder, relative to it, before the #";
  const raw = path.split(/[/\\]/);
  const first = raw.find((part) => part !== ".") ?? "";
  if (normalized === "system" || normalized.startsWith("system/") || first === "system") return "must not start with system/, the source-package folder";
  const last = raw[raw.length - 1]!;
  if (last === "" || last === "." || last === "..") return "must name a file before the #, not a folder";
  if (under !== undefined && !(normalized || path).startsWith(under)) return `must point under ${under}`;
  return null;
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  const days = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  return day >= 1 && day <= days;
}

/** A real UTC time in the profile `buildos validate` requires. */
export function utcDatetimeOk(value: V): boolean {
  const match = typeof value === "string" ? UTC_DATETIME.exec(value) : null;
  if (match === null) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [number, number, number, number, number, number];
  if (!validDate(year, month, day)) return false;
  return year >= 1 && hour <= 23 && minute <= 59 && second <= 59;
}

/** The `buildos validate` extraction-row checks. */
export function extractionRowIssues(ext: PyDict): string[] {
  const issues: string[] = [];
  const id = ext.get("id");
  if (typeof id !== "string" || !/^EXT-[0-9]{3,}$/.test(id)) issues.push(`id ${pyRepr(id)} does not match the extraction ID pattern EXT-NNN`);
  const minted = getOr(ext, "minted", []);
  for (const value of iterate(minted)) {
    if (typeof value !== "string" || !ENTITY_ID.test(value)) issues.push(`minted ID ${pyRepr(value)} does not match the ID pattern`);
  }
  if (!nonblank(ext.get("extracted_by"))) issues.push("extracted_by needs nonempty text");
  if (!utcDatetimeOk(ext.get("extracted_at"))) issues.push(`extracted_at ${pyRepr(ext.get("extracted_at"))} is not a UTC time such as 2026-01-31T09:30:00Z`);
  if (ext.has("dataset_refs") && !isList(ext.get("dataset_refs"))) issues.push("dataset_refs must be a list or left out, never null");
  const problem = savedAnchorIssue(ext.get("source_anchor"), "assets/");
  if (problem !== null) issues.push(`source_anchor ${problem}`);
  return issues;
}

/** Python iteration over a value: a list's items, a dict's keys, a string's characters. */
export function iterate(value: V): PyValue[] {
  if (isList(value)) return value;
  if (isDict(value)) return [...value.keys()];
  if (typeof value === "string") return [...value];
  if (value === null || value === undefined) throw typeError("'NoneType' object is not iterable");
  throw typeError(`'${pyTypeName(value)}' object is not iterable`);
}

/** Python's type name of a JSON value. */
export function pyTypeName(value: V): string {
  if (value === null || value === undefined) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number" || typeof value === "bigint") return "int";
  if (typeof value === "string") return "str";
  if (isList(value)) return "list";
  if (isDict(value)) return "dict";
  return "float";
}

/** `json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":"))`, hashed. */
export function rowHash(hash: HashPort, row: V): string {
  return hash.sha256Hex(new TextEncoder().encode(pyDumps(row ?? null, { sortKeys: true, ensureAscii: false, separators: [",", ":"] })));
}

/** `json.dumps(row, ensure_ascii=False) + "\n"` as bytes. */
export function jsonLine(row: PyValue): Uint8Array {
  return new TextEncoder().encode(`${pyDumps(row, { ensureAscii: false })}\n`);
}

export function listFieldIssues(row: PyDict, kind: string, label: string): string[] {
  const issues: string[] = [];
  const required = ["source_refs", "related", ...REQUIRED_LIST_FIELDS[kind]!];
  for (const field of [...required, ...OPTIONAL_LIST_FIELDS.filter((name) => row.has(name))]) {
    const value = row.get(field);
    if (!isList(value) || value.some((item) => typeof item !== "string")) {
      issues.push(`${label} ${field} must be a list of strings`);
    } else if (SCOPED_FIELDS.includes(field)) {
      for (const item of value) {
        if (RESERVED_SCOPED_VALUES.includes(item as string)) issues.push(`${label} ${field} holds the reserved value ${pyRepr(item)}; list each configured ID instead`);
      }
    }
  }
  for (const field of LEGACY_SCOPED_FIELDS) {
    if (row.has(field)) issues.push(`${label} ${field} is an old scoped field; use systems, environments, and owners`);
  }
  return issues;
}

/** `is_date`: an ISO 8601 date or datetime (`Z` as `+00:00`). */
export function isDate(value: V): boolean {
  if (typeof value !== "string" || value === "") return false;
  return pyIsoformatParses(value.replaceAll("Z", "+00:00"));
}

function isReference(value: string): boolean {
  return ENTITY_ID.test(value) || ((value.startsWith("assets/") || value.startsWith("docs/")) && value.includes("#"));
}

function isNarrativeReference(value: string): boolean {
  const s = pyStrip(value);
  // Python's `\b` is Unicode-aware: a letter or digit of any script continues the word.
  return s !== "" && !s.endsWith("?") && !/^(what|why|how|which|whether|should|could|need to)(?![\p{L}\p{N}_])/iu.test(s);
}

const TEXT_MEANINGS = ["text", "ID", "ISO date", "pass|fail|blocked|inconclusive", "low|medium|high"];
const LIST_MEANINGS = ["references", "text list", "IDs", "related IDs or narrative references"];

export function rowFieldIssues(row: PyDict, kind: string, label: string): string[] {
  const issues = listFieldIssues(row, kind, label);
  for (const field of ["created_at", "updated_at"]) {
    if (!row.has(field)) issues.push(`${label} needs ${field} (ISO date or null)`);
  }
  const statuses = ["draft", "active", "superseded", "archived"];
  if (kind === "finding") statuses.push("qualified");
  if (kind === "run") statuses.push("running", "closed", "aborted");
  if (!inSet(row.get("status"), statuses)) issues.push(`${label} status is not valid for ${kind}`);
  if (pyEquals(row.get("status"), "superseded") && !isDict(row.get("redirect"))) issues.push(`${label} superseded row needs a redirect`);
  if (!pyEquals(row.get("status"), "superseded") && row.has("redirect")) issues.push(`${label} redirect is only for a superseded row`);
  for (const field of ["title", "summary"]) {
    if (!nonblank(row.get(field))) issues.push(`${label} ${field} needs nonempty text`);
  }
  for (const field of ["created_at", "updated_at"]) {
    if (row.has(field) && row.get(field) !== null && !isDate(row.get(field))) issues.push(`${label} ${field} needs an ISO date or null`);
  }
  const docAnchor = row.get("doc_anchor");
  const docProblem = docAnchor !== null && docAnchor !== undefined ? savedAnchorIssue(docAnchor, "docs/") : null;
  if (docProblem !== null) issues.push(`${label} doc_anchor ${docProblem}; use docs/path.md#anchor, or null`);
  if (!pyEquals(row.get("status"), "draft") && !truthy(docAnchor)) issues.push(`${label} non-draft row needs doc_anchor`);
  const related = row.get("related");
  if (isList(related)) {
    for (const value of related) if (typeof value === "string" && !ENTITY_ID.test(value)) issues.push(`${label} related needs entity IDs: ${pyRepr(value)}`);
  }
  const sourceRefs = row.get("source_refs");
  if (isList(sourceRefs)) {
    for (const value of sourceRefs) if (typeof value === "string" && !isReference(value)) issues.push(`${label} source_refs needs path#anchor or entity ID: ${pyRepr(value)}`);
  }
  for (const [field, meaning] of TYPE_FIELDS[kind]!) {
    const value = row.get(field);
    if (TEXT_MEANINGS.includes(meaning) && !nonblank(value)) issues.push(`${label} ${field} needs ${meaning}`);
    if (LIST_MEANINGS.includes(meaning) && (!isList(value) || value.some((x) => !nonblank(x)))) issues.push(`${label} ${field} needs a list of nonempty strings`);
  }
  if (kind === "finding") {
    if (!inSet(row.get("confidence"), ["low", "medium", "high"])) issues.push(`${label} confidence needs low, medium, or high`);
    const implications = row.get("implications");
    for (const value of isList(implications) ? implications : []) {
      if (typeof value === "string" && !(/^(?:REQ|CAP|TC)-[0-9]+$/.test(value) || isNarrativeReference(value))) {
        issues.push(`${label} implications is for related IDs or narrative references; put questions in unresolved: ${pyRepr(value)}`);
      }
    }
    const basis = row.get("basis_refs");
    for (const value of isList(basis) ? basis : []) {
      if (typeof value === "string" && !(/^(?:RUN|RES|EXT)-[0-9]+$/.test(value) || value.startsWith("assets/") || value.startsWith("docs/"))) {
        issues.push(`${label} basis_refs needs a RUN, RES, EXT, or file reference: ${pyRepr(value)}`);
      }
    }
  }
  if (kind === "result") {
    if (!/^(?:TC|REQ|CAP|RUN|FIND)-[0-9]+$/.test(pyStr(getOr(row, "target_id", "")))) issues.push(`${label} target_id has the wrong ID type`);
    if (!inSet(row.get("outcome"), ["pass", "fail", "blocked", "inconclusive"])) issues.push(`${label} outcome is invalid`);
    const evidence = row.get("evidence_refs");
    for (const value of isList(evidence) ? evidence : []) {
      if (typeof value === "string" && !(/^(?:RUN|FIND)-[0-9]+$/.test(value) || value.startsWith("assets/") || value.startsWith("docs/"))) {
        issues.push(`${label} evidence_refs needs a RUN, FIND, or file reference: ${pyRepr(value)}`);
      }
    }
  }
  if (kind === "run") {
    const playbook = row.get("playbook_id");
    if (playbook !== null && playbook !== undefined && !/^PB-[0-9]+$/.test(pyStr(playbook))) issues.push(`${label} playbook_id needs a PB ID or null`);
    const ended = row.get("ended_at");
    if (!isDate(row.get("started_at")) || (ended !== null && ended !== undefined && !isDate(ended))) issues.push(`${label} run dates need ISO dates`);
    const outputs = row.get("outputs");
    if (!isDict(row.get("inputs")) || !(isDict(outputs) || isList(outputs))) issues.push(`${label} inputs and outputs have the wrong types`);
  }
  for (const [field, allowed] of [
    ["acceptance_refs", /^(?:TC|RES|FIND)-[0-9]+$/],
    ["verifies", /^(?:REQ|CAP)-[0-9]+$/],
  ] as [string, RegExp][]) {
    const values = row.get(field);
    if (isList(values)) {
      for (const value of values) {
        if (typeof value === "string" && !(allowed.test(value) || (field === "acceptance_refs" && value.startsWith("docs/")))) {
          issues.push(`${label} ${field} has an invalid reference: ${pyRepr(value)}`);
        }
      }
    }
  }
  return issues;
}

/** Python truthiness. */
export function truthy(value: V): boolean {
  if (value === undefined || value === null || value === false || value === 0 || value === 0n || value === "") return false;
  if (isList(value)) return value.length > 0;
  if (isDict(value)) return value.size > 0;
  if (typeof value === "object" && "value" in value) return value.value !== 0;
  return true;
}

/** `candidate_template(kind)`. */
export function candidateTemplate(kind: string): PyDict {
  const row: PyDict = new Map<string, PyValue>([
    ["type", kind],
    ["title", ""],
    ["status", "draft"],
    ["summary", ""],
    ["source_anchor", ""],
    ["doc_anchor", null],
    ["source_refs", []],
    ["related", []],
    ["created_at", null],
    ["updated_at", null],
  ]);
  for (const [field, meaning] of TYPE_FIELDS[kind]!) {
    row.set(field, LIST_MEANINGS.includes(meaning) ? [] : meaning === "object" ? new Map() : meaning.includes("or null") ? null : "");
  }
  if (kind === "finding") row.set("confidence", "medium");
  if (kind === "result") row.set("outcome", "inconclusive");
  if (kind === "run") {
    row.set("inputs", new Map());
    row.set("outputs", new Map());
  }
  return new Map<string, PyValue>([
    ["key", ""],
    ["type", kind],
    ["action", "minted"],
    ["review_state", "pending"],
    ["row", row],
  ]);
}

export function validPublicationReview(review: PyDict): boolean {
  const marker = review.get("publication_review");
  return isDict(marker) && nonblank(marker.get("reviewed_by")) && !pyEquals(marker.get("reviewed_by"), review.get("reviewed_by")) && isDate(marker.get("reviewed_at"));
}

/** `next_id(records, prefix)`: one more than the largest number of that prefix, at least three digits. */
export function nextId(records: Map<string, PyDict>, prefix: string): string {
  let max = 0n;
  const re = new RegExp(`^${prefix}-[0-9]+$`);
  for (const value of records.keys()) {
    if (re.test(value)) {
      const n = BigInt(value.slice(value.indexOf("-") + 1));
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1n).padStart(3, "0")}`;
}
