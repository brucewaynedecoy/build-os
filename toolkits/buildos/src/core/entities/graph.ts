/**
 * The entity graph loader, ported from the Go seed
 * (`internal/entities/graph_loader.go`). It reads every governed JSONL
 * dataset under `.os/data/` through the filesystem port, rejects invalid
 * JSONL and duplicate IDs, and indexes records by ID. Records keep every
 * original field, value for value.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { FsReadFailure } from "../shared/errors.ts";
import type { FsPort } from "../shared/fs-port.ts";
import { goCompare, goIsBlank, goUnmarshal, goUnmarshalRawObject, goTrimSpace, type GoDecoded, type RawObject } from "../shared/go-json.ts";
import { goTrimSpaceBytes } from "../shared/go-text.ts";
import { goPathError, goReadFileError } from "../shared/go-os-error.ts";
import { goJoinAll, type GoPathPlatform } from "../shared/go-path.ts";
import { goQuote } from "../shared/go-quote.ts";
import { READ_LIMITS } from "../shared/read-limits.ts";
import { CODE, hasErrors, sortDiagnostics, type EntityDiagnostic, type EntityRecord, type Redirect } from "./types.ts";

/** The eight governed datasets, in the order the Go seed reads them. */
export const GOVERNED_DATASETS: readonly { filename: string; entityType: string }[] = [
  { filename: "requirements.jsonl", entityType: "requirement" },
  { filename: "capabilities.jsonl", entityType: "capability" },
  { filename: "personas.jsonl", entityType: "persona" },
  { filename: "test-cases.jsonl", entityType: "test-case" },
  { filename: "results.jsonl", entityType: "result" },
  { filename: "runs.jsonl", entityType: "run" },
  { filename: "findings.jsonl", entityType: "finding" },
  { filename: "extractions.jsonl", entityType: "extraction" },
];

/** A folder as the port reads it and as the Go seed spells it in messages. */
export interface Location {
  /** Path relative to the port root, with `/`. */
  port: string;
  /** Absolute path as Go's `filepath.Join` spells it on this platform. */
  go: string;
  platform: GoPathPlatform;
}

/** A path below a location. */
export function below(location: Location, name: string): Location {
  return { port: location.port === "" || location.port === "." ? name : `${location.port}/${name}`, go: goJoinAll(location.platform, location.go, name), platform: location.platform };
}

function cloneRecord(record: EntityRecord): EntityRecord {
  return {
    ...record,
    redirect: record.redirect === undefined ? undefined : { ...record.redirect, evidence_refs: record.redirect.evidence_refs === null ? null : [...record.redirect.evidence_refs] },
    raw: new Map([...record.raw].map(([k, v]) => [k, v.slice()])),
  };
}

/** An immutable, complete view of the governed datasets. Callers get copies. */
export class EntityGraph {
  readonly #records: Map<string, EntityRecord>;

  constructor(records: Map<string, EntityRecord>) {
    this.#records = records;
  }

  /** A copy of the record with `id`, or undefined. */
  record(id: string): EntityRecord | undefined {
    const record = this.#records.get(id);
    return record === undefined ? undefined : cloneRecord(record);
  }

  /** True when a record with `id` exists. */
  has(id: string): boolean {
    return this.#records.has(id);
  }

  /** Copies of every record, sorted by ID as Go's `sort.Strings`. */
  records(): EntityRecord[] {
    return [...this.#records.keys()].sort(goCompare).map((id) => cloneRecord(this.#records.get(id)!));
  }

  get size(): number {
    return this.#records.size;
  }
}

/** One dataset to load: its bytes, or the failure the port reported. */
export type DatasetSource = { data: Uint8Array } | { failure: FsReadFailure };

/** The result of a load: the graph (never absent, as in Go), its diagnostics, and the bytes read. */
export interface LoadResult {
  graph: EntityGraph;
  diagnostics: EntityDiagnostic[];
  /** The bytes of each dataset that could be read, by file name. */
  data: Map<string, Uint8Array>;
}

/**
 * Go `Load(dataDir)`: reads every governed dataset through `fs`. A port
 * refusal (`PathRefusedError`) passes through; any other read failure is a
 * diagnostic, as in Go.
 */
export function loadGraph(fs: FsPort, dataDir: Location): LoadResult {
  const sources = new Map<string, DatasetSource>();
  for (const { filename } of GOVERNED_DATASETS) {
    try {
      sources.set(filename, { data: fs.readBytes(below(dataDir, filename).port, READ_LIMITS.data) });
    } catch (error) {
      if (!(error instanceof FsReadFailure)) throw error;
      sources.set(filename, { failure: error });
    }
  }
  return loadFromSources(sources, dataDir);
}

/** Go's `bufio.Scanner` limit in `Load`: a 16 MiB token buffer. */
const MAX_TOKEN = 16 * 1024 * 1024;

/** Loads a graph from dataset bytes, with `dataDir` for paths in diagnostics. */
export function loadFromSources(sources: ReadonlyMap<string, DatasetSource>, dataDir: Location): LoadResult {
  const records = new Map<string, EntityRecord>();
  const diagnostics: EntityDiagnostic[] = [];
  const locations = new Map<string, { dataset: string; path: string; line: number }[]>();
  const data = new Map<string, Uint8Array>();

  for (const dataset of GOVERNED_DATASETS) {
    const path = below(dataDir, dataset.filename).go;
    const source = sources.get(dataset.filename);
    if (source === undefined) throw new Error(`no source for ${dataset.filename}`);
    if ("failure" in source) {
      const detail = source.failure.fs;
      if (detail.errno === "EISDIR") {
        // Go's os.Open opens a folder; the scanner's first read fails.
        diagnostics.push(inputDiagnostic(dataset.filename, path, 0, `read JSONL: ${goPathError("read", path, detail)}`, "repair the dataset so every row can be read completely"));
        continue;
      }
      diagnostics.push({
        code: CODE.inputContract,
        severity: "error",
        message: `cannot read governed dataset ${dataset.filename}: ${goReadFileError(path, detail)}`,
        dataset: dataset.filename,
        path,
        action: `restore a readable JSONL dataset at ${path}`,
      });
      continue;
    }
    data.set(dataset.filename, source.data);
    const bytes = source.data;
    let line = 0;
    let at = 0;
    while (at < bytes.length) {
      let end = bytes.indexOf(0x0a, at);
      const terminated = end !== -1;
      if (!terminated) end = bytes.length;
      if (end - at >= MAX_TOKEN) {
        diagnostics.push(inputDiagnostic(dataset.filename, path, line, "read JSONL: bufio.Scanner: token too long", "repair the dataset so every row can be read completely"));
        break;
      }
      line++;
      // bufio.ScanLines drops one carriage return before the newline.
      let payloadEnd = end;
      if (payloadEnd > at && bytes[payloadEnd - 1] === 0x0d) payloadEnd--;
      const payload = bytes.slice(at, payloadEnd);
      at = terminated ? end + 1 : end;
      if (goIsBlank(payload)) {
        diagnostics.push(inputDiagnostic(dataset.filename, path, line, "blank JSONL row", "remove the blank line or replace it with one complete JSON object"));
        continue;
      }
      const { record, diagnostics: recordDiagnostics } = decodeRecord(payload, dataset, path, line);
      diagnostics.push(...recordDiagnostics);
      if (record.id !== "") {
        const list = locations.get(record.id) ?? [];
        list.push({ dataset: dataset.filename, path, line });
        locations.set(record.id, list);
      }
      if (hasErrors(recordDiagnostics)) continue;
      if (!records.has(record.id)) records.set(record.id, record);
    }
  }

  for (const id of [...locations.keys()].sort(goCompare)) {
    const occurrences = locations.get(id)!;
    if (occurrences.length < 2) continue;
    const message = `entity ID ${id} occurs more than once: ${occurrences.map((o) => `${o.path}:${o.line}`).join(", ")}`;
    for (const o of occurrences) {
      diagnostics.push({
        code: CODE.duplicateId,
        severity: "error",
        message,
        dataset: o.dataset,
        path: o.path,
        line: o.line,
        entity_id: id,
        action: "assign one globally unique stable ID to each governed entity row",
      });
    }
  }

  sortDiagnostics(diagnostics);
  return { graph: new EntityGraph(records), diagnostics, data };
}

function inputDiagnostic(dataset: string, path: string, line: number, message: string, action: string): EntityDiagnostic {
  return { code: CODE.inputContract, severity: "error", message, dataset, path, line, action };
}

/** Go `json.Unmarshal(raw, &s)` for a string: the value, or undefined on an error. A JSON `null` leaves "". */
function decodeString(raw: Uint8Array): string | undefined {
  const { value, error } = goUnmarshal(raw, { kind: "string" });
  return error === undefined ? (value as string) : undefined;
}

/** Go `decodeRecord`. Go reads the three fields from a map, in no fixed order; here the order is id, type, status. */
function decodeRecord(payload: Uint8Array, dataset: { filename: string; entityType: string }, path: string, line: number): { record: EntityRecord; diagnostics: EntityDiagnostic[] } {
  const empty: EntityRecord = { id: "", type: "", status: "", redirect: undefined, dataset: "", path: "", line: 0, raw: new Map() };
  const { object, error } = goUnmarshalRawObject(payload);
  if (error !== undefined) {
    return { record: empty, diagnostics: [inputDiagnostic(dataset.filename, path, line, `invalid JSON object: ${error}`, "replace the row with one complete JSON object")] };
  }
  if (object === null) {
    return { record: empty, diagnostics: [inputDiagnostic(dataset.filename, path, line, "JSONL row must be an object", "replace the row with one complete JSON object")] };
  }
  const diagnostics: EntityDiagnostic[] = [];
  const fields: Record<"id" | "type" | "status", string> = { id: "", type: "", status: "" };
  for (const key of ["id", "type", "status"] as const) {
    const raw = object.get(key);
    const value = raw === undefined ? undefined : decodeString(raw);
    if (value !== undefined) fields[key] = value;
    if (value === undefined || goTrimSpace(value) === "") {
      diagnostics.push(inputDiagnostic(dataset.filename, path, line, `field ${goQuote(key)} must be a non-empty string`, `set ${key} to the value required by the entity records contract`));
    }
  }
  const record: EntityRecord = { ...fields, redirect: undefined, dataset: dataset.filename, path, line, raw: new Map([...object].map(([k, v]) => [k, v.slice()])) };

  if (record.type !== "" && record.type !== dataset.entityType) {
    diagnostics.push(
      inputDiagnostic(
        dataset.filename,
        path,
        line,
        `record type ${goQuote(record.type)} does not match dataset type ${goQuote(dataset.entityType)}`,
        `move the row to its governed dataset or set type to ${goQuote(dataset.entityType)}`,
      ),
    );
  }

  const redirectRaw = object.get("redirect");
  if (redirectRaw !== undefined) {
    if (isNullLiteral(redirectRaw)) {
      diagnostics.push(inputDiagnostic(dataset.filename, path, line, "redirect must be an object, not null", "remove redirect or provide the complete redirect object"));
    } else {
      const decoded = decodeRedirect(redirectRaw, record);
      record.redirect = decoded.redirect;
      diagnostics.push(...decoded.diagnostics);
    }
  }
  return { record, diagnostics };
}

/**
 * Go `bytes.Equal(bytes.TrimSpace(raw), []byte("null"))`, on the bytes. A
 * leading U+FEFF is not a space for Go, so BOM + `null` is not the null
 * literal (W1 R7 P6 t29). The default `TextDecoder` drops a leading U+FEFF,
 * so this works on the bytes, with Go's `bytes.TrimSpace`, and decodes nothing.
 */
export function isNullLiteral(raw: Uint8Array): boolean {
  const t = goTrimSpaceBytes(raw);
  return t.length === 4 && t[0] === 0x6e && t[1] === 0x75 && t[2] === 0x6c && t[3] === 0x6c;
}

const REDIRECT_FIELDS = new Set(["target_id", "kind", "decided_at", "decided_by", "reason", "evidence_refs"]);

/** Go `decodeRedirect`. Go walks maps in no fixed order; here unknown fields come in input order and the string fields in contract order. */
function decodeRedirect(payload: Uint8Array, record: EntityRecord): { redirect: Redirect | undefined; diagnostics: EntityDiagnostic[] } {
  const { object, error } = goUnmarshalRawObject(payload);
  if (error !== undefined || object === null) {
    return { redirect: undefined, diagnostics: [inputDiagnostic(record.dataset, record.path, record.line, "redirect must be a JSON object", "replace redirect with the complete contract object")] };
  }
  const diagnostics: EntityDiagnostic[] = [];
  for (const key of (object as RawObject).keys()) {
    if (!REDIRECT_FIELDS.has(key)) {
      diagnostics.push(inputDiagnostic(record.dataset, record.path, record.line, `redirect contains unknown field ${goQuote(key)}`, "remove the field; redirect objects contain exactly the six contract fields"));
    }
  }
  const redirect: Redirect = { target_id: "", kind: "", decided_at: "", decided_by: "", reason: "", evidence_refs: null };
  for (const key of ["target_id", "kind", "decided_at", "decided_by", "reason"] as const) {
    const raw = object.get(key);
    const value = raw === undefined ? undefined : decodeString(raw);
    if (value !== undefined) redirect[key] = value;
    if (value === undefined || goTrimSpace(value) === "") {
      diagnostics.push(inputDiagnostic(record.dataset, record.path, record.line, `redirect.${key} must be a non-empty string`, `set redirect.${key} to the value required by the entity records contract`));
    }
  }
  const refsRaw = object.get("evidence_refs");
  let refsOk = false;
  if (refsRaw !== undefined) {
    const { value, error: refsError } = goUnmarshal(refsRaw, { kind: "slice", name: "[]string", elem: { kind: "string" } });
    redirect.evidence_refs = value as string[] | null;
    refsOk = refsError === undefined && value !== null;
    if (refsError !== undefined && Array.isArray(value)) redirect.evidence_refs = value as GoDecoded[] as string[];
  }
  if (!refsOk) {
    diagnostics.push(inputDiagnostic(record.dataset, record.path, record.line, "redirect.evidence_refs must be an array of strings", "set redirect.evidence_refs to an array, which may be empty only when no evidence exists"));
  }
  if (redirect.kind !== "" && redirect.kind !== "duplicate" && redirect.kind !== "consolidated" && redirect.kind !== "replaced") {
    diagnostics.push(inputDiagnostic(record.dataset, record.path, record.line, `redirect.kind ${goQuote(redirect.kind)} is not allowed`, "set redirect.kind to duplicate, consolidated, or replaced"));
  }
  return { redirect, diagnostics };
}
