/**
 * The derived entity-resolution index, ported from the Go seed
 * (`internal/entities/index.go`). Canonical JSONL is always authoritative;
 * the index at `.os/indexes/entity-resolution.json` can be thrown away and
 * rebuilt at any time. The bytes are canonical: two-space JSON, keys and
 * members in Go's lexical order (byte order of UTF-8), and one final newline.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { createHash } from "node:crypto";
import type { FsPort } from "../shared/fs-port.ts";
import { goCompare, goDecodeFirst, goMarshalIndent, utf8, type GoDecoded, type GoType } from "../shared/go-json.ts";
import { goPathError, goStatOp } from "../shared/go-os-error.ts";
import { goQuote } from "../shared/go-quote.ts";
import { READ_LIMITS, readBackRefusal } from "../shared/read-limits.ts";
import type { EntityGraph, Location } from "./graph.ts";
import { GoError, mkdirAll, parentOf, readFile, readFileErrorText, writeAtomic } from "./io.ts";
import { resolveEntity } from "./resolve.ts";
import { CODE, hasErrors, type EntityDiagnostic } from "./types.ts";

export const INDEX_VERSION = 1;

/** The derived index. Members are sorted; keys are sorted when written. */
export interface ResolutionIndex {
  version: number;
  /** Null for a JSON `null` (a Go nil map). */
  canonical_by_id: Map<string, string> | null;
  members_by_canonical: Map<string, string[] | null> | null;
}

export type IndexCheckState = "current" | "missing" | "stale" | "malformed" | "non_reproducible";

/**
 * How the index on disk compares with a canonical rebuild. Field order and
 * empty optional fields follow Go's `IndexCheckResult` JSON.
 */
export interface IndexCheckResult {
  state: IndexCheckState | "";
  current: boolean;
  diagnostic_code?: string;
  message: string;
  expected_sha256: string;
  actual_sha256?: string;
  remediation_command?: string;
}

/** Go's zero `IndexCheckResult`. */
export const ZERO_INDEX_CHECK: IndexCheckResult = { state: "", current: false, message: "", expected_sha256: "" };

/** The JSON form of a check result, with Go's `omitempty` fields left out when empty. */
export function indexCheckJson(check: IndexCheckResult): { [key: string]: string | boolean } {
  const out: { [key: string]: string | boolean } = { state: check.state, current: check.current };
  if (check.diagnostic_code) out["diagnostic_code"] = check.diagnostic_code;
  out["message"] = check.message;
  out["expected_sha256"] = check.expected_sha256;
  if (check.actual_sha256) out["actual_sha256"] = check.actual_sha256;
  if (check.remediation_command) out["remediation_command"] = check.remediation_command;
  return out;
}

function newIndex(): ResolutionIndex {
  return { version: INDEX_VERSION, canonical_by_id: new Map(), members_by_canonical: new Map() };
}

/** Go `canonicalIndex`: copies, with each member list sorted. */
function canonicalIndex(index: ResolutionIndex): ResolutionIndex {
  const out = newIndex();
  out.version = index.version;
  for (const [id, target] of index.canonical_by_id ?? []) out.canonical_by_id!.set(id, target);
  for (const [id, members] of index.members_by_canonical ?? []) {
    out.members_by_canonical!.set(id, members === null || members.length === 0 ? null : [...members].sort(goCompare));
  }
  return out;
}

/** Go `BuildIndex`: the forward and reverse projections of a loaded graph, or the resolution failures. */
export function buildIndex(graph: EntityGraph | undefined): { index: ResolutionIndex; diagnostics: EntityDiagnostic[] } {
  if (graph === undefined) {
    return {
      index: { version: 0, canonical_by_id: null, members_by_canonical: null },
      diagnostics: [
        {
          code: CODE.inputContract,
          severity: "error",
          message: "cannot build entity-resolution index without a loaded graph",
          action: "load and validate canonical entity JSONL before rebuilding the index",
        },
      ],
    };
  }
  const index = newIndex();
  const diagnostics: EntityDiagnostic[] = [];
  for (const record of graph.records()) {
    if (record.redirect === undefined) continue;
    const { resolution, diagnostics: found } = resolveEntity(graph, record.id);
    diagnostics.push(...found);
    if (hasErrors(found) || !resolution.resolved || resolution.canonical_id === "") continue;
    index.canonical_by_id!.set(record.id, resolution.canonical_id);
    const members = index.members_by_canonical!.get(resolution.canonical_id) ?? [];
    members.push(record.id);
    index.members_by_canonical!.set(resolution.canonical_id, members);
  }
  if (hasErrors(diagnostics)) return { index: { version: 0, canonical_by_id: null, members_by_canonical: null }, diagnostics };
  return { index: canonicalIndex(index), diagnostics };
}

/** Go `validateIndexShape`. Go walks maps in no fixed order; here keys go in lexical order. */
function validateIndexShape(index: ResolutionIndex): string | undefined {
  if (index.version !== INDEX_VERSION) return `version must be ${INDEX_VERSION}`;
  if (index.canonical_by_id === null) return "canonical_by_id must be an object";
  if (index.members_by_canonical === null) return "members_by_canonical must be an object";
  const byId = index.canonical_by_id;
  for (const id of [...byId.keys()].sort(goCompare)) {
    const canonical = byId.get(id)!;
    if (id === "" || canonical === "") return "canonical_by_id keys and values must be non-empty";
    if (id === canonical) return `canonical_by_id[${goQuote(id)}] must not target itself`;
  }
  const seen = new Map<string, string>();
  for (const canonical of [...index.members_by_canonical.keys()].sort(goCompare)) {
    const members = index.members_by_canonical.get(canonical) ?? null;
    if (canonical === "") return "members_by_canonical keys must be non-empty";
    if (members === null || members.length === 0) return `members_by_canonical[${goQuote(canonical)}] must not be empty`;
    for (const member of members) {
      if (member === "") return `members_by_canonical[${goQuote(canonical)}] contains an empty member`;
      if (member === canonical) return `members_by_canonical[${goQuote(canonical)}] must exclude the canonical ID`;
      const previous = seen.get(member);
      if (previous !== undefined) return `member ${goQuote(member)} appears under both ${goQuote(previous)} and ${goQuote(canonical)}`;
      seen.set(member, canonical);
      if (byId.get(member) !== canonical) return `member ${goQuote(member)} does not map to canonical ID ${goQuote(canonical)}`;
    }
  }
  for (const member of [...byId.keys()].sort(goCompare)) {
    if ((seen.get(member) ?? "") !== byId.get(member)) return `canonical_by_id member ${goQuote(member)} is absent from members_by_canonical[${goQuote(byId.get(member)!)}]`;
  }
  return undefined;
}

/** Go `MarshalIndex`: canonical v1 bytes, or the shape error. */
export function marshalIndex(index: ResolutionIndex): Uint8Array {
  const canonical = canonicalIndex(index);
  const problem = validateIndexShape(canonical);
  if (problem !== undefined) throw new GoError(problem);
  // Go writes a map's keys in byte order of their UTF-8. A `Map` keeps that
  // order in goMarshalIndent; a plain object would put integer-like IDs such
  // as "2" and "10" first, in numeric order.
  const text = goMarshalIndent(
    {
      version: canonical.version,
      canonical_by_id: canonical.canonical_by_id!,
      members_by_canonical: canonical.members_by_canonical!,
    },
    true,
  );
  return utf8(`${text}\n`);
}

export function digest(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

const INDEX_TYPE: GoType = {
  kind: "struct",
  name: "entities.ResolutionIndex",
  short: "ResolutionIndex",
  fields: [
    { name: "version", type: { kind: "int" } },
    { name: "canonical_by_id", type: { kind: "map", name: "map[string]string", elem: { kind: "string" } } },
    { name: "members_by_canonical", type: { kind: "map", name: "map[string][]string", elem: { kind: "slice", name: "[]string", elem: { kind: "string" } } } },
  ],
};

/** Go `unmarshalIndex`: one strict JSON value with no unknown fields, then the shape rules. */
function unmarshalIndex(data: Uint8Array): ResolutionIndex | string {
  const decoded = goDecodeFirst(data, INDEX_TYPE);
  if (decoded.error !== undefined) return decoded.error;
  if (decoded.trailing === "multiple") return "multiple JSON values";
  if (decoded.trailing !== undefined) return `trailing content: ${decoded.trailing}`;
  const value = decoded.value as { [field: string]: GoDecoded };
  const index: ResolutionIndex = {
    version: value["version"] as number,
    canonical_by_id: value["canonical_by_id"] as Map<string, string> | null,
    members_by_canonical: value["members_by_canonical"] as Map<string, string[] | null> | null,
  };
  return validateIndexShape(index) ?? index;
}

/** Go's `reflect.DeepEqual` of two canonical indexes. */
function sameIndex(a: ResolutionIndex, b: ResolutionIndex): boolean {
  if (a.version !== b.version) return false;
  const left = a.canonical_by_id!;
  const right = b.canonical_by_id!;
  if (left.size !== right.size) return false;
  for (const [k, v] of left) if (!right.has(k) || right.get(k) !== v) return false;
  const lm = a.members_by_canonical!;
  const rm = b.members_by_canonical!;
  if (lm.size !== rm.size) return false;
  for (const [k, v] of lm) {
    if (!rm.has(k)) return false;
    const w = rm.get(k)!;
    if ((v === null) !== (w === null)) return false;
    if (v !== null && w !== null && (v.length !== w.length || v.some((x, i) => x !== w[i]))) return false;
  }
  return true;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Go `CheckIndex`: compares the index on disk with a canonical rebuild, and
 * names missing, malformed, stale, and non-canonical content apart. It never
 * writes. A read failure other than "missing" throws a `GoError`.
 */
export function checkIndex(fs: FsPort, path: Location, expected: ResolutionIndex, remediationCommand: string): IndexCheckResult {
  let expectedBytes: Uint8Array;
  try {
    expectedBytes = marshalIndex(expected);
  } catch (error) {
    throw new GoError(`prepare expected entity-resolution index: ${(error as Error).message}`);
  }
  const result: IndexCheckResult = { state: "", current: false, message: "", expected_sha256: digest(expectedBytes), remediation_command: remediationCommand };
  const read = readFile(fs, path, READ_LIMITS.data);
  if (read.kind === "missing") {
    return { ...result, state: "missing", diagnostic_code: CODE.indexStale, message: "entity-resolution index is missing" };
  }
  if (read.kind === "failed") throw new GoError(`read entity-resolution index ${goQuote(path.go)}: ${readFileErrorText(path, read.detail)}`);
  const actualBytes = read.data;
  result.actual_sha256 = digest(actualBytes);
  const actual = unmarshalIndex(actualBytes);
  if (typeof actual === "string") {
    return { ...result, state: "malformed", diagnostic_code: CODE.inputContract, message: `entity-resolution index is malformed: ${actual}` };
  }
  if (!sameIndex(canonicalIndex(actual), canonicalIndex(expected))) {
    return { ...result, state: "stale", diagnostic_code: CODE.indexStale, message: "entity-resolution index differs from the canonical graph rebuild" };
  }
  if (!bytesEqual(actualBytes, expectedBytes)) {
    return {
      ...result,
      state: "non_reproducible",
      diagnostic_code: CODE.indexNonReproducible,
      message: "entity-resolution index is semantically current but not canonically serialized",
    };
  }
  const current: IndexCheckResult = { state: "current", current: true, message: "entity-resolution index is current and reproducible", expected_sha256: result.expected_sha256 };
  current.actual_sha256 = result.actual_sha256;
  return current;
}

/** P7-R3-04: the index would be larger than its read bound; nothing was written. */
export class IndexTooLargeError extends GoError {
  constructor(message: string) {
    super(message);
    this.name = "IndexTooLargeError";
  }
}

/**
 * Go `ApplyIndex`: installs the canonical bytes atomically, and returns false
 * when the file already holds them. An existing file keeps its permissions;
 * a new index gets 0644.
 */
export function applyIndex(fs: FsPort, path: Location, index: ResolutionIndex): boolean {
  const encoded = marshalIndex(index);
  // W1 R7 P7 review round 3 (P7-R3-04): `checkIndex` reads it back with READ_LIMITS.data, so a larger index is not written.
  if (encoded.length > READ_LIMITS.data) throw new IndexTooLargeError(readBackRefusal(path.go, encoded.length, READ_LIMITS.data).message);
  const current = readFile(fs, path, READ_LIMITS.data);
  if (current.kind === "data" && bytesEqual(current.data, encoded)) return false;
  if (current.kind === "failed") throw new GoError(`read existing entity-resolution index ${goQuote(path.go)}: ${readFileErrorText(path, current.detail)}`);
  let mode = 0o644;
  try {
    const stat = fs.stat(path.port);
    if (stat !== undefined) mode = stat.mode;
  } catch (error) {
    const detail = (error as { fs?: Parameters<typeof goPathError>[2] }).fs;
    if (detail === undefined) throw error;
    throw new GoError(`stat existing entity-resolution index ${goQuote(path.go)}: ${goPathError(goStatOp(), path.go, detail)}`);
  }
  writeIndexAtomic(fs, path, encoded, mode);
  return true;
}

/** Go `writeIndexAtomic`. */
function writeIndexAtomic(fs: FsPort, path: Location, data: Uint8Array, mode: number): void {
  const dir = parentOf(path);
  try {
    mkdirAll(fs, dir);
  } catch (error) {
    if (!(error instanceof GoError)) throw error;
    throw new GoError(`create entity-resolution index directory ${goQuote(dir.go)}: ${error.message}`);
  }
  writeAtomic(fs, path, data, mode, { prefix: ".entity-resolution-", suffix: ".tmp" }, {
    createTemp: "create same-filesystem entity-resolution temporary file",
    chmod: "preserve entity-resolution index permissions",
    write: "write entity-resolution temporary file",
    sync: "sync entity-resolution temporary file",
    close: "close entity-resolution temporary file",
    rename: (target) => `atomically replace entity-resolution index ${goQuote(target)}`,
    openParent: "open entity-resolution index directory for sync",
    syncParent: "sync entity-resolution index directory",
  });
}
