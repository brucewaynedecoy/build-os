/**
 * Reviewed consolidation, ported from the Go seed
 * (`internal/entities/consolidate.go`). A dry run is the default. With
 * `apply`, the whole prospective graph is validated first; then each changed
 * canonical JSONL file is written through a temporary file in its own folder
 * and renamed over the original, keeping its permissions. This module does
 * not rebuild the derived index; the command does that after a successful
 * canonical write.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { isCoreError } from "../shared/errors.ts";
import type { FsPort } from "../shared/fs-port.ts";
import {
  concatBytes,
  goCompare,
  goDecodeFirst,
  goEncodeString,
  goMarshalRawObject,
  goTrimSpace,
  utf8,
  type GoDecoded,
  type GoType,
  type RawObject,
} from "../shared/go-json.ts";
import { goPathError, goStatOp } from "../shared/go-os-error.ts";
import { goBase } from "../shared/go-path.ts";
import { goQuote } from "../shared/go-quote.ts";
import { checkRowsReadBack, jsonlRowLimit, READ_LIMITS, readBackRefusal } from "../shared/read-limits.ts";
import { buildIndex, marshalIndex } from "./index.ts";
import { below, GOVERNED_DATASETS, loadFromSources, loadGraph, type DatasetSource, type EntityGraph, type Location } from "./graph.ts";
import { GoError, readFile, readFileErrorText, writeAtomic } from "./io.ts";
import { CODE, hasErrors, type EntityDiagnostic, type Mode } from "./types.ts";
import { checkRedirect, validateGraph } from "./validate.ts";

/** Go's sentinel errors. Their text is what Go prints when no diagnostic explains the failure. */
export type ConsolidationErrorKind = "input" | "validation" | "conflict" | "io";

const SENTINEL_TEXT: Record<Exclude<ConsolidationErrorKind, "io">, string> = {
  input: "consolidation input is invalid",
  validation: "consolidation validation failed",
  conflict: "consolidation requires review",
};

/** A consolidation failure: Go's error class and text. */
export class ConsolidationError extends GoError {
  readonly kind: ConsolidationErrorKind;

  constructor(kind: ConsolidationErrorKind, message: string) {
    super(message);
    this.name = "ConsolidationError";
    this.kind = kind;
  }
}

/** Go `fmt.Errorf("%w: ...", sentinel)`. */
function sentinel(kind: Exclude<ConsolidationErrorKind, "io">, detail?: string): ConsolidationError {
  return new ConsolidationError(kind, detail === undefined ? SENTINEL_TEXT[kind] : `${SENTINEL_TEXT[kind]}: ${detail}`);
}

export interface ConsolidationMapping {
  source_id: string;
  target_id: string;
  kind: string;
  decided_at: string;
  decided_by: string;
  reason: string;
  evidence_refs: string[] | null;
}

export interface ConsolidationChange {
  source_id: string;
  target_id: string;
  dataset: string;
  action: "supersede" | "no_op";
}

/** The plan or applied result. `affected_files` and `changes` are null in Go's zero value. */
export interface ConsolidationResult {
  manifest_version: number;
  mapping_count: number;
  change_count: number;
  no_op_count: number;
  affected_files: string[] | null;
  changes: ConsolidationChange[] | null;
  applied: boolean;
}

export const ZERO_CONSOLIDATION: ConsolidationResult = {
  manifest_version: 0,
  mapping_count: 0,
  change_count: 0,
  no_op_count: 0,
  affected_files: null,
  changes: null,
  applied: false,
};

/** Installs one validated canonical dataset replacement. Tests inject failures here. */
export type CanonicalWriter = (fs: FsPort, path: Location, data: Uint8Array, mode: number) => void;

/** The manifest, read through its own port, with the path as the user gave it. */
export interface ManifestSource {
  /** A read-only view of a port: the manifest can be outside the root, so nothing is ever written through it. */
  fs: Pick<FsPort, "readBytes">;
  /** The manifest path as given, for Go's messages. */
  given: string;
  /** The path to read through `fs`. */
  port: string;
}

export interface ConsolidateOutcome {
  result: ConsolidationResult;
  /** The prospective graph on a dry run; the reloaded canonical graph after apply; undefined on failure. */
  graph: EntityGraph | undefined;
  diagnostics: EntityDiagnostic[];
  error: ConsolidationError | undefined;
  /**
   * Set when the canonical rename committed and a typed port error (a
   * refusal, or a read failure) then stopped the reload: its message. The
   * command reports it as an index-completion failure after the canonical
   * write, with the recovery command, never as a failure before it.
   */
  afterCommit?: string;
}

/**
 * Go `ConsolidateWithWriter`. It preflights the whole prospective graph and,
 * with `apply`, replaces each changed canonical JSONL file atomically.
 */
export function consolidate(
  fs: FsPort,
  dataDir: Location,
  manifest: ManifestSource,
  mode: Mode,
  apply: boolean,
  writer: CanonicalWriter = writeCanonicalAtomic,
): ConsolidateOutcome {
  const loaded = loadManifest(manifest);
  const diagnostics = [...loaded.diagnostics];
  const fail = (error: ConsolidationError, result: ConsolidationResult = ZERO_CONSOLIDATION): ConsolidateOutcome => ({ result, graph: undefined, diagnostics, error });
  if (loaded.error !== undefined) return fail(loaded.error);
  const { version, mappings } = loaded;

  const current = loadGraph(fs, dataDir);
  diagnostics.push(...current.diagnostics);
  if (hasErrors(current.diagnostics)) return fail(sentinel("validation", "current graph is invalid"));
  const validation = validateGraph(current.graph, mode);
  diagnostics.push(...validation);
  if (hasErrors(validation)) return fail(sentinel("validation", "current graph is invalid"));
  const graph = current.graph;

  const result: ConsolidationResult = { manifest_version: version, mapping_count: mappings.length, change_count: 0, no_op_count: 0, affected_files: [], changes: [], applied: false };
  const changedRows = new Map<string, Map<number, RawObject>>();
  const datasetOf = new Map<string, string>();
  const manifestDatasets = new Set<string>();
  let conflict = false;
  for (const mapping of mappings) {
    const source = graph.record(mapping.source_id);
    if (source === undefined) {
      diagnostics.push({
        code: CODE.entityNotFound,
        severity: "error",
        message: `manifest source entity ${mapping.source_id} does not exist`,
        entity_id: mapping.source_id,
        action: "correct source_id to a governed entity ID and repeat the dry run",
      });
      continue;
    }
    const target = graph.record(mapping.target_id);
    if (target === undefined) {
      diagnostics.push({
        code: CODE.redirectMissingTarget,
        severity: "error",
        message: `manifest target entity ${mapping.target_id} does not exist`,
        dataset: source.dataset,
        path: source.path,
        line: source.line,
        entity_id: source.id,
        target_id: mapping.target_id,
        action: "correct target_id to an existing same-type entity and repeat the dry run",
      });
      continue;
    }
    manifestDatasets.add(source.path);
    const located = { dataset: source.dataset, path: source.path, line: source.line, entity_id: source.id, target_id: target.id };
    if (mapping.source_id === mapping.target_id) {
      diagnostics.push({ code: CODE.redirectSelf, severity: "error", message: `entity ${source.id} cannot redirect to itself`, ...located, action: "choose a different same-type target" });
      continue;
    }
    if (source.type !== target.type) {
      diagnostics.push({
        code: CODE.redirectCrossType,
        severity: "error",
        message: `entity ${source.id} (${source.type}) cannot redirect to ${target.id} (${target.type})`,
        ...located,
        action: "choose a same-type canonical target; use related for non-canonical cross-type links",
      });
      continue;
    }
    const remap = checkRedirect(graph, source.id, target.id);
    if (remap !== undefined) {
      diagnostics.push(remap);
      conflict = true;
      continue;
    }
    if (source.redirect !== undefined && source.redirect.target_id === target.id) {
      result.no_op_count++;
      result.changes!.push({ source_id: source.id, target_id: target.id, dataset: source.dataset, action: "no_op" });
      continue;
    }
    result.change_count++;
    result.changes!.push({ source_id: source.id, target_id: target.id, dataset: source.dataset, action: "supersede" });
    const rows = changedRows.get(source.path) ?? new Map<number, RawObject>();
    changedRows.set(source.path, rows);
    datasetOf.set(source.path, source.dataset);
    const row: RawObject = new Map([...source.raw].map(([k, v]) => [k, v.slice()]));
    row.set("status", utf8('"superseded"'));
    row.set("redirect", marshalRedirect(target.id, mapping));
    row.set("updated_at", utf8(goEncodeString(mapping.decided_at, true)));
    rows.set(source.line, row);
  }

  if (hasErrors(diagnostics)) return fail(conflict ? sentinel("conflict") : sentinel("validation"), result);
  if (manifestDatasets.size !== 1) {
    diagnostics.push({
      code: CODE.inputContract,
      severity: "error",
      message: "version 1 consolidation mappings must affect exactly one canonical dataset",
      action: "split the reviewed mappings into one manifest per canonical JSONL dataset and repeat the dry run",
    });
    return fail(sentinel("conflict", `mappings span ${manifestDatasets.size} canonical datasets`), result);
  }

  const paths = [...changedRows.keys()].sort(goCompare);
  const prepared = new Map<string, Uint8Array>();
  for (const path of paths) {
    const dataset = datasetOf.get(path)!;
    const location = below(dataDir, dataset);
    // Go's requireWithinDataDir holds by construction: each path is a governed dataset below dataDir.
    const read = readFile(fs, location, READ_LIMITS.data);
    if (read.kind !== "data") {
      return fail(new ConsolidationError("io", `read canonical dataset ${goQuote(path)}: ${readFileErrorText(location, read.detail)}`), result);
    }
    const updated = updateJsonlRows(read.data, changedRows.get(path)!);
    if (typeof updated === "string") return fail(sentinel("validation", `update ${goQuote(path)}: ${updated}`), result);
    prepared.set(path, updated);
    result.affected_files!.push(goBase(path, dataDir.platform));
  }
  result.affected_files!.sort(goCompare);

  // Go writes the eight datasets to a temporary folder next to .os/data and
  // loads that. The same bytes are loaded here from memory: the dry run
  // writes nothing (see the P3 evidence report).
  const sources = new Map<string, DatasetSource>();
  for (const { filename } of GOVERNED_DATASETS) {
    const path = below(dataDir, filename).go;
    sources.set(filename, { data: prepared.get(path) ?? current.data.get(filename)! });
  }
  const prospective = loadFromSources(sources, dataDir);
  diagnostics.push(...prospective.diagnostics);
  if (hasErrors(prospective.diagnostics)) return fail(sentinel("validation", "prospective graph does not load"), result);
  const prospectiveValidation = validateGraph(prospective.graph, mode);
  diagnostics.push(...prospectiveValidation);
  if (hasErrors(prospectiveValidation)) return fail(sentinel("validation", "prospective graph is invalid"), result);
  // W1 R7 P7 review round 3 (P7-R3-04): every dataset this command writes,
  // and the entity-resolution index it then rebuilds, is read back with
  // READ_LIMITS.data. A file that would be larger stops the command before
  // its first write (exit 4), the dry run too.
  for (const path of paths) {
    const size = prepared.get(path)!.length;
    if (size > READ_LIMITS.data) return fail(new ConsolidationError("validation", readBackRefusal(path, size, READ_LIMITS.data).message), result);
    // P7-R4-02: each row must also fit the line limit of every reader of this dataset (64 KiB for runs.jsonl and
    // findings.jsonl, which discovery and design scan; 16 MiB for the entity graph).
    try {
      checkRowsReadBack(path, prepared.get(path)!, jsonlRowLimit(goBase(path, dataDir.platform)));
    } catch (error) {
      return fail(new ConsolidationError("validation", (error as Error).message), result);
    }
  }
  if (prepared.size > 0) {
    const built = buildIndex(prospective.graph);
    const size = hasErrors(built.diagnostics) ? 0 : marshalIndex(built.index).length;
    if (size > READ_LIMITS.data) return fail(new ConsolidationError("validation", readBackRefusal(".os/indexes/entity-resolution.json", size, READ_LIMITS.data).message), result);
  }
  if (!apply || prepared.size === 0) return { result, graph: prospective.graph, diagnostics, error: undefined };

  for (const path of paths) {
    const location = below(dataDir, datasetOf.get(path)!);
    let modeBits: number;
    try {
      const stat = fs.stat(location.port);
      if (stat === undefined) throw new ConsolidationError("io", `stat canonical dataset ${goQuote(path)}: ${goPathError(goStatOp(), path, { errno: "ENOENT" })}`);
      modeBits = stat.mode;
    } catch (error) {
      if (error instanceof ConsolidationError) return fail(error, result);
      const detail = (error as { fs?: Parameters<typeof goPathError>[2] }).fs;
      if (detail === undefined) throw error;
      return fail(new ConsolidationError("io", `stat canonical dataset ${goQuote(path)}: ${goPathError(goStatOp(), path, detail)}`), result);
    }
    try {
      writer(fs, location, prepared.get(path)!, modeBits);
    } catch (error) {
      if (!(error instanceof GoError)) throw error;
      return fail(error instanceof ConsolidationError ? error : new ConsolidationError("io", error.message), result);
    }
  }
  result.applied = true;
  let reloaded: ReturnType<typeof loadGraph>;
  try {
    reloaded = loadGraph(fs, dataDir);
  } catch (error) {
    if (!isCoreError(error)) throw error;
    return { result, graph: undefined, diagnostics, error: undefined, afterCommit: error.message };
  }
  diagnostics.push(...reloaded.diagnostics);
  if (hasErrors(reloaded.diagnostics)) return fail(new ConsolidationError("validation", `reload graph after canonical write: ${SENTINEL_TEXT.validation}`), result);
  return { result, graph: reloaded.graph, diagnostics, error: undefined };
}

/** Go `json.Marshal(Redirect{...})`: compact, HTML escaped, in contract field order. */
function marshalRedirect(targetId: string, mapping: ConsolidationMapping): Uint8Array {
  const q = (s: string) => goEncodeString(s, true);
  const refs = (mapping.evidence_refs ?? []).map(q).join(",");
  return utf8(
    `{"target_id":${q(targetId)},"kind":${q(mapping.kind)},"decided_at":${q(mapping.decided_at)},"decided_by":${q(mapping.decided_by)},"reason":${q(mapping.reason)},"evidence_refs":[${refs}]}`,
  );
}

/** Go `updateJSONLRows`: replaces the given 1-based lines and keeps everything else, byte for byte. */
function updateJsonlRows(data: Uint8Array, replacements: ReadonlyMap<number, RawObject>): Uint8Array | string {
  const trailingNewline = data.length > 0 && data[data.length - 1] === 0x0a;
  const lines: Uint8Array[] = [];
  let at = 0;
  for (;;) {
    const end = data.indexOf(0x0a, at);
    if (end === -1) {
      lines.push(data.slice(at));
      break;
    }
    lines.push(data.slice(at, end));
    at = end + 1;
  }
  if (trailingNewline) lines.pop();
  for (const line of [...replacements.keys()].sort((a, b) => a - b)) {
    if (line < 1 || line > lines.length) return `line ${line} is outside the dataset`;
    lines[line - 1] = goMarshalRawObject(replacements.get(line)!);
  }
  const parts: Uint8Array[] = [];
  lines.forEach((line, i) => {
    if (i > 0) parts.push(Uint8Array.of(0x0a));
    parts.push(line);
  });
  if (trailingNewline) parts.push(Uint8Array.of(0x0a));
  return concatBytes(parts);
}

const MANIFEST_TYPE: GoType = {
  kind: "struct",
  name: "entities.ConsolidationManifest",
  short: "ConsolidationManifest",
  fields: [
    { name: "version", type: { kind: "int" } },
    {
      name: "mappings",
      type: {
        kind: "slice",
        name: "[]entities.ConsolidationMapping",
        elem: {
          kind: "struct",
          name: "entities.ConsolidationMapping",
          short: "ConsolidationMapping",
          fields: [
            { name: "source_id", type: { kind: "string" } },
            { name: "target_id", type: { kind: "string" } },
            { name: "kind", type: { kind: "string" } },
            { name: "decided_at", type: { kind: "string" } },
            { name: "decided_by", type: { kind: "string" } },
            { name: "reason", type: { kind: "string" } },
            { name: "evidence_refs", type: { kind: "slice", name: "[]string", elem: { kind: "string" } } },
          ],
        },
      },
    },
  ],
};

function manifestDiagnostic(message: string, action: string): EntityDiagnostic {
  return { code: CODE.inputContract, severity: "error", message, action };
}

/** Go `loadConsolidationManifest`. */
function loadManifest(source: ManifestSource): { version: number; mappings: ConsolidationMapping[]; diagnostics: EntityDiagnostic[]; error: ConsolidationError | undefined } {
  const failed = (diagnostics: EntityDiagnostic[], error: ConsolidationError) => ({ version: 0, mappings: [], diagnostics, error });
  const location: Location = { port: source.port, go: source.given, platform: "posix" };
  const read = readFile(source.fs, location, READ_LIMITS.data);
  if (read.kind !== "data") {
    const text = readFileErrorText(location, read.detail);
    return failed([manifestDiagnostic(`cannot read consolidation manifest: ${text}`, "provide a readable UTF-8 JSON manifest")], sentinel("input", text));
  }
  const decoded = goDecodeFirst(read.data, MANIFEST_TYPE);
  if (decoded.error !== undefined) {
    return failed([manifestDiagnostic(`invalid consolidation manifest: ${decoded.error}`, "correct the manifest to the exact version 1 contract")], sentinel("input", decoded.error));
  }
  if (decoded.trailing !== undefined) {
    const text = decoded.trailing === "multiple" ? "multiple JSON values" : decoded.trailing;
    return failed([manifestDiagnostic(`invalid consolidation manifest trailing content: ${text}`, "remove content after the single manifest object")], sentinel("input", text));
  }
  const value = decoded.value as { [field: string]: GoDecoded };
  const version = value["version"] as number;
  const mappings = ((value["mappings"] as GoDecoded[] | null) ?? []).map((m) => {
    const f = m as { [field: string]: GoDecoded };
    return {
      source_id: f["source_id"] as string,
      target_id: f["target_id"] as string,
      kind: f["kind"] as string,
      decided_at: f["decided_at"] as string,
      decided_by: f["decided_by"] as string,
      reason: f["reason"] as string,
      evidence_refs: f["evidence_refs"] as string[] | null,
    };
  });
  if (version !== 1 || mappings.length === 0) {
    return failed([manifestDiagnostic("manifest version must be 1 and mappings must be a non-empty list", "set version to 1 and include at least one reviewed mapping")], sentinel("input"));
  }
  const diagnostics: EntityDiagnostic[] = [];
  const seen = new Set<string>();
  mappings.forEach((mapping, index) => {
    const problem = validateMapping(mapping);
    if (problem !== undefined) diagnostics.push(manifestDiagnostic(`mapping ${index + 1}: ${problem}`, "correct the named mapping field and repeat the dry run"));
    if (seen.has(mapping.source_id)) diagnostics.push(manifestDiagnostic(`source_id ${mapping.source_id} occurs more than once`, "keep one reviewed immediate-target mapping per source_id"));
    seen.add(mapping.source_id);
  });
  if (hasErrors(diagnostics)) return failed(diagnostics, sentinel("input"));
  // Go sort.SliceStable by source_id.
  const sorted = mappings.map((m, i) => ({ m, i })).sort((a, b) => goCompare(a.m.source_id, b.m.source_id) || a.i - b.i).map(({ m }) => m);
  return { version, mappings: sorted, diagnostics, error: undefined };
}

/** Go `validateManifestMapping`. */
function validateMapping(mapping: ConsolidationMapping): string | undefined {
  if (goTrimSpace(mapping.source_id) === "" || goTrimSpace(mapping.target_id) === "") return "source_id and target_id must be non-empty";
  if (mapping.kind !== "duplicate" && mapping.kind !== "consolidated" && mapping.kind !== "replaced") return "kind must be duplicate, consolidated, or replaced";
  const offset = rfc3339Offset(mapping.decided_at);
  if (offset === undefined) return "decided_at must be an ISO 8601 UTC datetime";
  if (offset !== 0) return "decided_at must use UTC";
  if (goTrimSpace(mapping.decided_by) === "" || goTrimSpace(mapping.reason) === "") return "decided_by and reason must be non-empty";
  if (mapping.evidence_refs === null) return "evidence_refs must be a JSON list (an empty list is allowed)";
  for (const ref of mapping.evidence_refs) if (goTrimSpace(ref) === "") return "evidence_refs entries must be non-empty";
  return undefined;
}

const daysIn = (month: number, year: number) => {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
};

/**
 * Go `time.Parse(time.RFC3339, value)`, then the zone offset in seconds, or
 * undefined when Go would not parse it. Go tries its fast RFC 3339 parser
 * first and then its general layout parser, which also takes a one-digit
 * hour and a comma before the fraction.
 */
export function rfc3339Offset(value: string): number | undefined {
  const offset = fastRfc3339(value) ?? layoutRfc3339(value);
  // "-00:00" is offset 0 in Go, not negative zero.
  return offset === 0 ? 0 : offset;
}

const digits = (s: string) => /^[0-9]+$/.test(s);

/** Go `parseRFC3339`. */
function fastRfc3339(s: string): number | undefined {
  if (s.length < 19) return undefined;
  const num = (a: number, b: number, min: number, max: number) => {
    const part = s.slice(a, b);
    if (!/^[0-9]*$/.test(part)) return undefined;
    const x = Number(part === "" ? "0" : part);
    return x < min || x > max ? undefined : x;
  };
  const year = num(0, 4, 0, 9999);
  const month = num(5, 7, 1, 12);
  const day = num(8, 10, 1, daysIn(month ?? 1, year ?? 0));
  const hour = num(11, 13, 0, 23);
  const min = num(14, 16, 0, 59);
  const sec = num(17, 19, 0, 59);
  if ([year, month, day, hour, min, sec].includes(undefined)) return undefined;
  if (!(s[4] === "-" && s[7] === "-" && s[10] === "T" && s[13] === ":" && s[16] === ":")) return undefined;
  let rest = s.slice(19);
  if (rest.length >= 2 && rest[0] === "." && /[0-9]/.test(rest[1]!)) {
    let n = 2;
    while (n < rest.length && /[0-9]/.test(rest[n]!)) n++;
    rest = rest.slice(n);
  }
  if (rest === "Z") return 0;
  if (rest.length !== 6) return undefined;
  const hr = Number(rest.slice(1, 3));
  const mm = Number(rest.slice(4, 6));
  if (!digits(rest.slice(1, 3)) || !digits(rest.slice(4, 6)) || hr > 23 || mm > 59) return undefined;
  if (!((rest[0] === "-" || rest[0] === "+") && rest[3] === ":")) return undefined;
  const offset = (hr * 60 + mm) * 60;
  return rest[0] === "-" ? -offset : offset;
}

/** Go's general `parse` for the layout `2006-01-02T15:04:05Z07:00`. */
function layoutRfc3339(value: string): number | undefined {
  let v = value;
  const take = (n: number) => {
    const part = v.slice(0, n);
    v = v.slice(n);
    return part;
  };
  const literal = (text: string) => {
    if (!v.startsWith(text)) return false;
    v = v.slice(text.length);
    return true;
  };
  // stdLongYear: four characters, the first a digit, all of them a number.
  if (v.length < 4 || !/[0-9]/.test(v[0]!)) return undefined;
  const yearText = take(4);
  if (!digits(yearText)) return undefined;
  const year = Number(yearText);
  const fixed2 = () => {
    if (!/^[0-9]{2}/.test(v)) return undefined;
    return Number(take(2));
  };
  if (!literal("-")) return undefined;
  const month = fixed2();
  if (month === undefined || month < 1 || month > 12) return undefined;
  if (!literal("-")) return undefined;
  const day = fixed2();
  if (day === undefined) return undefined;
  if (!literal("T")) return undefined;
  // stdHour: one or two digits.
  if (!/^[0-9]/.test(v)) return undefined;
  const hour = Number(/^[0-9]{2}/.test(v) ? take(2) : take(1));
  if (hour > 23) return undefined;
  if (!literal(":")) return undefined;
  const minute = fixed2();
  if (minute === undefined || minute > 59) return undefined;
  if (!literal(":")) return undefined;
  const second = fixed2();
  if (second === undefined || second > 59) return undefined;
  if (v.length >= 2 && (v[0] === "." || v[0] === ",") && /[0-9]/.test(v[1]!)) {
    let n = 2;
    while (n < v.length && /[0-9]/.test(v[n]!)) n++;
    take(n);
  }
  let offset: number;
  if (v.startsWith("Z")) {
    take(1);
    offset = 0;
  } else {
    if (v.length < 6 || v[3] !== ":") return undefined;
    const sign = v[0];
    const hh = v.slice(1, 3);
    const mm = v.slice(4, 6);
    take(6);
    if (!digits(hh) || !digits(mm) || hh.length !== 2 || mm.length !== 2) return undefined;
    const hr = Number(hh);
    const mi = Number(mm);
    if (hr > 24 || mi > 60) return undefined;
    if (sign !== "+" && sign !== "-") return undefined;
    offset = (hr * 60 + mi) * 60 * (sign === "-" ? -1 : 1);
  }
  if (v.length > 0) return undefined;
  if (day < 1 || day > daysIn(month, year)) return undefined;
  return offset;
}

/** Go `writeCanonicalAtomic`. */
export function writeCanonicalAtomic(fs: FsPort, path: Location, data: Uint8Array, mode: number): void {
  writeAtomic(fs, path, data, mode, { prefix: ".buildos-consolidation-", suffix: ".tmp" }, {
    createTemp: "create same-filesystem canonical temporary file",
    chmod: "preserve canonical dataset permissions",
    write: "write canonical temporary file",
    sync: "sync canonical temporary file",
    close: "close canonical temporary file",
    rename: (target) => `atomically replace canonical dataset ${goQuote(target)}`,
    openParent: "open canonical directory for sync",
    syncParent: "sync canonical directory",
  });
}
