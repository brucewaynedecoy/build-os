/**
 * Discovery runs and finding qualification, ported from the Go tool
 * `toolkits/buildos-discovery/internal/discovery/discovery.go`
 * (`RecordDiscoveryRun`, `QualifyFinding`). Run recording copies evidence,
 * anchors raw findings in `raw-findings.md`, and appends one row to
 * `runs.jsonl`. Qualification checks the raw-finding anchor, copies the
 * confirmation test and evidence, and appends one row to `findings.jsonl`.
 *
 * Playbook, target, and run IDs resolve through the P3 entity core in this
 * process (`GoFiles.openEntityRoot` and `resolveEntity`), never through a
 * subprocess. Every failure is a `GoError` with the Go tool's text.
 *
 * Safety additions with no effect on the output of one command alone (P5
 * review round 1, orchestrator-approved):
 * - The run or finding folder is reserved with an exclusive `mkdir` before
 *   anything is written into it. Go checks with `os.Stat` and then writes, so
 *   two commands at the same time can both pick the same next ID and write
 *   the same folder. Here the second one fails with Go's own text
 *   (`run artifact <path> already exists`) and changes nothing.
 * - Evidence is copied as a stream (Go's `io.Copy`), so a file of 2 GiB or
 *   more copies as in Go.
 * - When a step after the reservation fails, the files and folders this
 *   command created are removed, so the same command can run again. Go
 *   leaves them, and a retry then fails with `already exists`.
 * - Before the first write, every write folder is checked against the root
 *   (parity exception PE-012), so a refusal changes nothing.
 * - The index row is added by an atomic replace, not an append (P5 review
 *   round 2): the same bytes as Go's append, but a failed write leaves the
 *   old index, and a symlink at the index is replaced, never followed
 *   (PE-012: Go appends through the link).
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { checkReadBack, checkRowReadBack, JSONL_ROW_LIMITS, READ_LIMITS } from "../shared/read-limits.ts";
import type { EntityGraph } from "../entities/graph.ts";
import { resolveEntity } from "../entities/resolve.ts";
import type { EntityDiagnostic } from "../entities/types.ts";
import { BuildOsLayout } from "../shared/buildos-layout.ts";
import { GoError, GoFiles, type GoFilesContext } from "../shared/go-files.ts";
import { goCompare, goTrimSpace, goUnmarshal, utf8, concatBytes, type GoDecoded, type GoJsonValue, type GoType } from "../shared/go-json.ts";
import { goBase } from "../shared/go-path.ts";
import { goQuote } from "../shared/go-quote.ts";
import {
  GO_SCANNER_TOO_LONG,
  goContainsText,
  goFromSlash,
  goMarshal,
  goRel,
  goRfc3339Utc,
  goScanLines,
  goToLower,
  goToSlash,
  goTrimSpaceBytes,
} from "../shared/go-text.ts";

export interface DiscoveryContext extends GoFilesContext {
  /** The clock. Defaults to the system time. */
  now?: () => Date;
}

export interface RunDiscoveryOptions {
  repoRoot: string;
  playbookId: string;
  outcome: string;
  title: string;
  targets: string[];
  datasetRefs: string[];
  evidencePaths: string[];
  rawFindingPaths: string[];
  dryRun: boolean;
}

/** Go `EntityResolution`. */
export interface EntityResolution {
  requested_id: string;
  canonical_id: string;
  chain: string[] | null;
}

export interface RunDiscoveryResult {
  runId: string;
  runPath: string;
  runsIndexPath: string;
  requestedTargets: string[];
  canonicalTargets: string[];
  targetResolutions: EntityResolution[];
  evidenceCount: number;
  rawFindingCount: number;
  dryRun: boolean;
  /** The repository root as Go spells it. */
  repoRoot: string;
}

export interface QualifyFindingOptions {
  repoRoot: string;
  runId: string;
  rawFindingRef: string;
  outcome: string;
  title: string;
  confirmationTest: string;
  confirmationEvidence: string;
  dryRun: boolean;
}

export interface QualifyFindingResult {
  findingId: string;
  findingPath: string;
  findingsIndexPath: string;
  requestedRunId: string;
  canonicalRunId: string;
  runResolution: EntityResolution;
  dryRun: boolean;
  repoRoot: string;
}

const RUN_OUTCOMES = new Set(["positive", "negative", "inconclusive"]);
const FINDING_OUTCOMES = new Set(["positive", "negative"]);

const STRINGS = (name = "[]string"): GoType => ({ kind: "slice", name, elem: { kind: "string" } });
const STRING: GoType = { kind: "string" };

const PLAYBOOK_ENTRY: GoType = {
  kind: "struct",
  name: "discovery.PlaybookEntry",
  short: "PlaybookEntry",
  fields: [
    { name: "id", type: STRING },
    { name: "path", type: STRING },
    { name: "title", type: STRING },
    { name: "category", type: STRING },
    { name: "execution_mode", type: STRING },
    { name: "state_nature", type: STRING },
    { name: "status", type: STRING },
    { name: "audience", type: STRING },
    { name: "harness", type: STRINGS() },
    { name: "systems", type: STRINGS() },
    { name: "environments", type: STRINGS() },
    { name: "owners", type: STRINGS() },
    { name: "targets", type: STRINGS() },
    { name: "produces", type: STRINGS() },
    // Go `*string`: a string, or null for nil.
    { name: "source_anchor", type: STRING },
    { name: "version", type: STRING },
    { name: "related", type: STRINGS() },
  ],
};

const PLAYBOOK_INDEX: GoType = {
  kind: "struct",
  name: "discovery.PlaybookIndex",
  short: "PlaybookIndex",
  fields: [
    { name: "version", type: { kind: "int" } },
    { name: "playbooks", type: { kind: "slice", name: "[]discovery.PlaybookEntry", elem: PLAYBOOK_ENTRY } },
    { name: "runnable_playbooks", type: { kind: "slice", name: "[]discovery.PlaybookEntry", elem: PLAYBOOK_ENTRY } },
  ],
};

const ENTITY_RESOLUTION: GoType = {
  kind: "struct",
  name: "discovery.EntityResolution",
  short: "EntityResolution",
  fields: [
    { name: "requested_id", type: STRING },
    { name: "canonical_id", type: STRING },
    { name: "chain", type: STRINGS() },
  ],
};

const ANY_MAP: GoType = { kind: "map", name: "map[string]interface {}", elem: { kind: "any" } };

/** Go `runIndexRow`, for `readRunIndexRow`. */
const RUN_INDEX_ROW: GoType = {
  kind: "struct",
  name: "discovery.runIndexRow",
  short: "runIndexRow",
  fields: [
    ...["id", "type", "path", "title", "status", "summary", "outcome", "playbook_id", "playbook_version"].map((name) => ({ name, type: STRING })),
    { name: "requested_targets", type: STRINGS() },
    { name: "targets", type: STRINGS() },
    { name: "target_resolutions", type: { kind: "slice", name: "[]discovery.EntityResolution", elem: ENTITY_RESOLUTION } },
    { name: "systems", type: STRINGS() },
    { name: "environments", type: STRINGS() },
    { name: "owners", type: STRINGS() },
    { name: "started_at", type: STRING },
    { name: "ended_at", type: STRING },
    { name: "evidence_count", type: { kind: "int" } },
    { name: "raw_finding_count", type: { kind: "int" } },
    { name: "qualified_findings", type: STRINGS() },
    { name: "dataset_refs", type: STRINGS() },
    { name: "source_anchor", type: STRING },
    { name: "doc_anchor", type: STRING },
    { name: "source_refs", type: STRINGS() },
    { name: "related", type: STRINGS() },
    { name: "created_at", type: STRING },
    { name: "updated_at", type: STRING },
    { name: "inputs", type: ANY_MAP },
    { name: "outputs", type: ANY_MAP },
  ],
};

/** The anonymous `struct { ID string \`json:"id"\` }` of `nextJSONLID`. */
const ID_ROW: GoType = { kind: "struct", name: 'struct { ID string "json:\\"id\\"" }', short: "", fields: [{ name: "id", type: STRING }] };

interface PlaybookEntry {
  id: string;
  path: string;
  category: string;
  status: string;
  systems: string[] | null;
  environments: string[] | null;
  owners: string[] | null;
  targets: string[] | null;
  version: string;
}

interface CopiedArtifact {
  source: string;
  /** P7-R3-01: the file to copy, the path the user named as written (`BuildOsLayout.resolveUserPath`). */
  read: string;
  path: string;
}

const asStrings = (value: GoDecoded): string[] | null => (Array.isArray(value) ? (value as string[]) : null);

/** Go `uniqueStrings`: drops empty and repeated values and sorts the rest. */
export function uniqueStrings(values: readonly string[] | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    if (value === "" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  // sort.Strings: byte order of UTF-8.
  return out.sort(goCompare);
}

class Discovery {
  readonly files: GoFiles;
  readonly layout: BuildOsLayout;
  readonly now: () => Date;

  constructor(context: DiscoveryContext, repoRootFlag: string) {
    this.files = new GoFiles(context, cleanRepoRoot(repoRootFlag, context));
    this.layout = BuildOsLayout.detect(this.files);
    this.now = context.now ?? (() => new Date());
  }

  /** `filepath.ToSlash(filepath.Join(parts...))`. */
  slashJoin(...parts: string[]): string {
    return goToSlash(this.files.join(...parts), this.files.platform);
  }

  activeDiscoveryPlaybook(playbookId: string): PlaybookEntry {
    const indexPath = this.layout.path("system/.os/indexes/playbooks.json");
    const read = this.files.readFile(indexPath, READ_LIMITS.data);
    if ("error" in read) throw new GoError(`read playbook index: ${read.error}`);
    const { value, error } = goUnmarshal(read.data, PLAYBOOK_INDEX);
    if (error !== undefined) throw new GoError(`parse playbook index: ${error}`);
    const index = value as { playbooks: GoDecoded; runnable_playbooks: GoDecoded };
    const entries = (list: GoDecoded): PlaybookEntry[] =>
      (Array.isArray(list) ? list : []).map((raw) => {
        const e = raw as Record<string, GoDecoded>;
        return {
          id: e["id"] as string,
          path: e["path"] as string,
          category: e["category"] as string,
          status: e["status"] as string,
          systems: asStrings(e["systems"]!),
          environments: asStrings(e["environments"]!),
          owners: asStrings(e["owners"]!),
          targets: asStrings(e["targets"]!),
          version: e["version"] as string,
        };
      });
    const catalogMatch = entries(index.playbooks).some((p) => p.id === playbookId);
    for (const playbook of entries(index.runnable_playbooks)) {
      if (playbook.id !== playbookId) continue;
      if (playbook.status !== "active") throw new GoError(`playbook ${playbookId} is ${goQuote(playbook.status)}; run discovery requires active`);
      if (playbook.category !== "discovery") throw new GoError(`playbook ${playbookId} is ${goQuote(playbook.category)}; run discovery requires category discovery`);
      if (playbook.version === "") throw new GoError(`playbook ${playbookId} is missing version`);
      return playbook;
    }
    if (catalogMatch) throw new GoError(`playbook ${playbookId} is not active/runnable`);
    throw new GoError(`playbook ${playbookId} not found in playbook index`);
  }

  /** `replaced`: the index this command replaces (`runs.jsonl` for a run, `findings.jsonl` for a finding), see `GoFiles.openEntityRoot` (P7-R3-03). */
  openEntityGraph(replaced: "runs.jsonl" | "findings.jsonl"): EntityGraph {
    const { graph, diagnostics } = this.files.openEntityRoot(this.layout.systemRoot(), [replaced]);
    if (diagnostics.some((d) => d.severity === "error")) throw new GoError(entityDiagnosticsError("validate entity graph", diagnostics));
    return graph;
  }

  /** Go `nextJSONLID`. */
  nextJsonlId(indexPath: string, prefix: string): string {
    const read = this.files.readFile(indexPath, READ_LIMITS.data);
    if ("error" in read) {
      if (read.notExist) return `${prefix}-001`;
      throw new GoError(read.error);
    }
    const shown = goToSlash(indexPath, this.files.platform);
    const seen = new Map<string, number>();
    let maxId = 0n;
    const scanned = goScanLines(read.data);
    for (const { number, bytes } of scanned.lines) {
      const line = goTrimSpaceBytes(bytes);
      if (line.length === 0) continue;
      const { value, error } = goUnmarshal(line, ID_ROW);
      if (error !== undefined) throw new GoError(`${shown} line ${number} invalid JSON: ${error}`);
      const id = (value as { id: string }).id;
      if (id === "") continue;
      const prior = seen.get(id);
      if (prior !== undefined) throw new GoError(`${shown} line ${number} duplicates line ${prior} id ${id}`);
      seen.set(id, number);
      const numeric = numericSuffix(id, prefix);
      if (numeric !== undefined && numeric > maxId) maxId = numeric;
    }
    if (scanned.tooLong) throw new GoError(GO_SCANNER_TOO_LONG);
    return `${prefix}-${goPad3(BigInt.asIntN(64, maxId + 1n))}`;
  }

  /** Go `os.Stat(path)` for an artifact folder that must not exist yet. */
  requireAbsent(path: string, shown: string, noun: string): void {
    const stat = this.files.stat(path);
    if (stat.kind === "ok") throw new GoError(`${noun} artifact ${shown} already exists`);
    if (stat.kind === "failed") throw new GoError(stat.text);
  }

  /** Go `requireFile(path, label)`. */
  requireFile(path: string, label: string): void {
    const stat = this.files.stat(path);
    if (stat.kind !== "ok") throw new GoError(`${label}: ${stat.text}`);
    if (stat.stat.kind === "directory") throw new GoError(`${label} must be a file`);
  }

  /** Go `planCopiedArtifacts`. */
  planCopiedArtifacts(paths: readonly string[], targetRelDir: string): CopiedArtifact[] {
    const artifacts: CopiedArtifact[] = [];
    const used = new Set<string>();
    paths.forEach((source, i) => {
      if (source === "") return;
      const read = this.layout.resolveUserPath(source);
      this.requireFile(read, source);
      const name = `${goPad3(BigInt(i + 1))}-${sluggedFilename(goBase(source, this.files.platform))}`;
      if (used.has(name)) throw new GoError(`duplicate copied artifact name ${name}`);
      used.add(name);
      artifacts.push({ source: this.layout.userRef(source), read, path: this.slashJoin(goFromSlash(targetRelDir, this.files.platform), name) });
    });
    return artifacts;
  }

  /** Go `rawFindingContent`: the trimmed bytes of each raw finding and its reference. */
  rawFindingContent(paths: readonly string[]): { texts: Uint8Array[]; sources: string[] } {
    const texts: Uint8Array[] = [];
    const sources: string[] = [];
    for (const source of paths) {
      if (source === "") continue;
      const path = this.layout.resolveUserPath(source);
      this.requireFile(path, source);
      texts.push(goTrimSpaceBytes(this.files.mustReadFile(path, READ_LIMITS.document)));
      sources.push(this.layout.userRef(goToSlash(source, this.files.platform)));
    }
    return { texts, sources };
  }

  /** Go `copyFile(source, target)`, as a streaming copy. */
  copyFile(source: string, target: string): void {
    const stat = this.files.stat(target);
    if (stat.kind === "ok") throw new GoError(`artifact ${goToSlash(target, this.files.platform)} already exists`);
    if (stat.kind === "failed") throw new GoError(stat.text);
    this.files.mkdirAll(this.files.dir(target));
    this.files.copyNewFile(source, target);
  }

  /**
   * Reserves the new run or finding folder `path` with an exclusive `mkdir`
   * (mode 0755, as Go's `MkdirAll`). Another command that made it first gives
   * Go's `<noun> artifact <shown> already exists`. Any other failure runs Go's
   * own `os.MkdirAll(<path>/<firstChild>)`, so the error text is Go's; if that
   * succeeds, the folder is not known to be this command's, and the result is
   * false (no cleanup then).
   */
  reserveArtifactFolder(path: string, shown: string, noun: string, firstChild: string): boolean {
    const { files } = this;
    let code = files.mkdirExclusive(path);
    if (code === "ENOENT") {
      try {
        files.mkdirAll(files.dir(path));
        code = files.mkdirExclusive(path);
      } catch (error) {
        if (!(error instanceof GoError)) throw error;
      }
    }
    if (code === undefined) return true;
    if (code === "EEXIST") throw new GoError(`${noun} artifact ${shown} already exists`);
    files.mkdirAll(files.join(path, firstChild));
    return false;
  }

  /**
   * Go's `os.MkdirAll(path, 0o755)` of a folder inside a reserved folder,
   * adding `path` to `created` only when this command made it (P4-P5 merge
   * fix round). The folder is made with an exclusive `mkdir`; when that
   * fails (another process made it first, or a parent is missing), Go's
   * `MkdirAll` runs for its result and its error text, and the folder is not
   * listed, so the cleanup never removes a folder it did not make.
   */
  mkdirOwned(path: string, created: string[]): void {
    const { files } = this;
    if (files.mkdirExclusive(path) === undefined) {
      created.push(path);
      return;
    }
    files.mkdirAll(path);
  }

  /**
   * Runs the writes into a reserved folder. When one fails (a Go error or a
   * port refusal), removes what `created` lists, last first, and rethrows.
   * `created` lists only entries this command created; each write adds its
   * entry after it succeeds, and a failed write removes its own new file.
   * With `owned` false (the folder was not reserved), removes nothing.
   */
  withCleanup(owned: boolean, created: string[], writes: () => void): void {
    try {
      writes();
    } catch (error) {
      if (owned) this.files.removeCreated(created);
      throw error;
    }
  }

  /**
   * Go `appendJSONL(path, row)`, as an atomic replace (P5 review round 2):
   * the index as it is now plus the new line, written to a temporary file in
   * the same folder and renamed over the entry. The bytes are Go's (an
   * append adds the line to the bytes there), but a failed write leaves the
   * old bytes, so the cleanup and a retry work, and a symlink at the index is
   * replaced, never followed (the rule of the entities and promotion
   * writes). It runs inside the run or finding folder reservation, which
   * serializes commands that would add the same ID.
   *
   * W1 R7 P7 final check (P7-F-04, PE-019): when the index does not end in a
   * line feed, a line feed goes before the new row, so the new row never
   * joins the last row on one line (Go appended the row directly, and the
   * next command could not read the index). The bytes come from
   * `appendedIndex`, and the same read-back checks the dry run made run
   * again on exactly these bytes before the write.
   *
   * The new file gets the old one's full mode (`mode & 0o7777`): Go's append
   * keeps the file, so its sticky bit stays. The write then clears setuid
   * and setgid, as the OS does for Go's write in place.
   */
  appendJsonl(path: string, row: GoJsonValue, displayPath: string): void {
    const { files } = this;
    files.mkdirAll(files.dir(path));
    const read = files.readFile(path, READ_LIMITS.data);
    if ("error" in read && !read.notExist) throw new GoError(read.error);
    const existing = "error" in read ? undefined : read.data;
    const data = appendedIndex(existing, row);
    checkAppendedIndex(displayPath, data, this.files.repoRoot);
    if (existing === undefined) {
      files.replaceJsonl(path, data, undefined);
      return;
    }
    const stat = files.stat(path);
    files.replaceJsonl(path, data, stat.kind === "ok" ? stat.stat.fullMode : undefined);
  }

  /**
   * W1 R7 P7 review round 3 (P7-R3-04), final check (P7-F-04): stops before
   * any write, and fails a dry run, when the index BuildOS would write by
   * adding `row` could not be read back: the whole file over the bound its
   * readers use (`READ_LIMITS.data`), or the new row as long as one line may
   * be (64 KiB). It checks the exact bytes the append writes
   * (`appendedIndex`), the separator line feed included.
   */
  checkAppendSize(path: string, row: GoJsonValue, displayPath: string): void {
    const read = this.files.readFile(path, READ_LIMITS.data);
    if ("error" in read && !read.notExist) {
      // The index cannot be read within its bound (too large, or unreadable): the size check reports a too-large file; the write reports any other error.
      const stat = this.files.stat(path);
      const rowBytes = utf8(goMarshal(row)).length;
      checkRowReadBack(displayPath, "the new row", rowBytes, JSONL_ROW_LIMITS.scanner, this.files.repoRoot);
      checkReadBack(displayPath, (stat.kind === "ok" ? stat.stat.size : 0) + 1 + rowBytes + 1, READ_LIMITS.data, this.files.repoRoot);
      return;
    }
    checkAppendedIndex(displayPath, appendedIndex("error" in read ? undefined : read.data, row), this.files.repoRoot);
  }

  /** Go `relativeRunArtifact` and `relativeFindingArtifact`. */
  relativeArtifact(base: string, artifact: string): string {
    const p = this.files.platform;
    const rel = goRel(goFromSlash(base, p), goFromSlash(artifact, p), p);
    return rel === undefined ? goToSlash(artifact, p) : goToSlash(rel, p);
  }

  nowUtc(): string {
    return goRfc3339Utc(this.now());
  }
}

/**
 * The exact bytes of a JSONL index after adding `row` (W1 R7 P7 final check,
 * P7-F-04; PE-019): the existing bytes, a line feed when they are not empty
 * and do not end in one, then the row and its line feed. Both discovery
 * appends (`discovery run` to runs.jsonl, `discovery qualify finding` to
 * findings.jsonl) build their bytes here, for the dry-run check and for the
 * write.
 */
export function appendedIndex(existing: Uint8Array | undefined, row: GoJsonValue): Uint8Array {
  const line = utf8(`${goMarshal(row)}\n`);
  if (existing === undefined || existing.length === 0) return line;
  if (existing[existing.length - 1] === 0x0a) return concatBytes([existing, line]);
  return concatBytes([existing, utf8("\n"), line]);
}

/** The read-back checks on the bytes `appendedIndex` gives: the whole file within READ_LIMITS.data, and its last line (the new row) under the line limit. */
function checkAppendedIndex(displayPath: string, data: Uint8Array, root: string): void {
  const start = data.lastIndexOf(0x0a, data.length - 2) + 1;
  checkRowReadBack(displayPath, "the new row", data.length - 1 - start, JSONL_ROW_LIMITS.scanner, root);
  checkReadBack(displayPath, data.length, READ_LIMITS.data, root);
}

/** Go `cleanRepoRoot`: `.` for an empty flag, else `filepath.Abs`. */
function cleanRepoRoot(repoRoot: string, context: GoFilesContext): string {
  if (repoRoot === "") return ".";
  return new GoFiles(context, ".").absolute(repoRoot);
}

/** Go `strconv.Atoi(strings.TrimPrefix(id, prefix+"-"))` after `HasPrefix`. */
function numericSuffix(id: string, prefix: string): bigint | undefined {
  const text = `${prefix}-`;
  if (!id.startsWith(text)) return undefined;
  const rest = id.slice(text.length);
  if (!/^[+-]?[0-9]+$/.test(rest)) return undefined;
  const n = BigInt(rest.replace(/^\+/, ""));
  if (n < -(2n ** 63n) || n > 2n ** 63n - 1n) return undefined;
  return n;
}

/** Go `%03d`. */
function goPad3(n: bigint): string {
  const negative = n < 0n;
  const digits = (negative ? -n : n).toString();
  return negative ? `-${digits.padStart(2, "0")}` : digits.padStart(3, "0");
}

/** Go `sluggedFilename`. */
export function sluggedFilename(name: string): string {
  let out = goToLower(goTrimSpace(name));
  out = out.replaceAll(" ", "-");
  out = out.replace(/[^a-z0-9._-]+/gu, "-");
  out = out.replace(/^[-._]+/, "").replace(/[-._]+$/, "");
  return out === "" ? "artifact" : out;
}

/** Go `entityDiagnosticsError`: each error diagnostic, joined with ` | `. */
function entityDiagnosticsError(context: string, diagnostics: readonly EntityDiagnostic[]): string {
  const parts = diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => `${d.code}: ${d.message}${d.action !== "" ? `; correction: ${d.action}` : ""}`);
  if (parts.length === 0) return `${context}: unknown entity resolver failure`;
  return `${context}: ${parts.join(" | ")}`;
}

/** Go `resolveEntityID`. */
function resolveEntityId(graph: EntityGraph, requestedId: string): EntityResolution {
  const { resolution, diagnostics } = resolveEntity(graph, requestedId);
  if (diagnostics.some((d) => d.severity === "error")) throw new GoError(entityDiagnosticsError(`resolve entity ${requestedId}`, diagnostics));
  return { requested_id: resolution.requested_id, canonical_id: resolution.canonical_id, chain: resolution.chain === null || resolution.chain.length === 0 ? null : [...resolution.chain] };
}

function inlineList(values: readonly string[]): string {
  return values.length === 0 ? "[]" : values.join(", ");
}

function resolutionText(r: EntityResolution): string {
  return `${r.requested_id} -> ${r.canonical_id} (${(r.chain ?? []).join(" -> ")})`;
}

/** Go `RecordDiscoveryRun`. */
export function recordDiscoveryRun(context: DiscoveryContext, opts: RunDiscoveryOptions): RunDiscoveryResult {
  const d = new Discovery(context, opts.repoRoot);
  const { layout, files } = d;
  if (opts.playbookId === "") throw new GoError("run discovery requires --playbook-id");
  if (!RUN_OUTCOMES.has(opts.outcome)) throw new GoError("run discovery requires --outcome positive, negative, or inconclusive");

  const playbook = d.activeDiscoveryPlaybook(opts.playbookId);
  const requestedTargets = uniqueStrings(opts.targets.length === 0 ? playbook.targets : opts.targets);
  const graph = d.openEntityGraph("runs.jsonl");
  const canonical: string[] = [];
  const targetResolutions: EntityResolution[] = [];
  for (const requested of requestedTargets) {
    let resolution: EntityResolution;
    try {
      resolution = resolveEntityId(graph, requested);
    } catch (error) {
      if (error instanceof GoError) throw new GoError(`resolve discovery target ${requested}: ${error.message}`);
      throw error;
    }
    canonical.push(resolution.canonical_id);
    targetResolutions.push(resolution);
  }
  const canonicalTargets = uniqueStrings(canonical);

  const runsIndexPath = layout.path("system/.os/data/runs.jsonl");
  const runId = d.nextJsonlId(runsIndexPath, "RUN");
  const runRelPath = layout.rel(`${d.slashJoin("system/workspace/runs", runId)}/`);
  const runPath = layout.path(runRelPath);
  d.requireAbsent(runPath, runRelPath, "run");

  const evidence = d.planCopiedArtifacts(opts.evidencePaths, d.slashJoin(runRelPath, "evidence"));
  const raw = d.rawFindingContent(opts.rawFindingPaths);
  const datasetRefs = uniqueStrings(layout.refs(opts.datasetRefs));
  // W1 R7 P7 review round 4 (P7-R4-01): the playbook path is BuildOS-owned and gets the layout rule; each raw
  // finding source is a path the user named and was already resolved by `userRef`, so it is kept exactly as
  // resolved. Applying `layout.refs` to it again dropped `system/` in a project that owns a `system/` folder,
  // so the run named the other file.
  const sourceRefs = uniqueStrings([layout.ref(playbook.path), ...raw.sources]);

  const now = d.nowUtc();
  let title = goTrimSpace(opts.title);
  if (title === "") title = `Discovery run ${runId}`;
  const rawAnchors = raw.texts.map((_, i) => `raw-findings.md#raw-finding-${i + 1}`);
  const resolutionsJson = targetResolutions.map((r) => ({ requested_id: r.requested_id, canonical_id: r.canonical_id, chain: r.chain }));

  const row = {
    id: runId,
    type: "run",
    path: runRelPath,
    title,
    status: "closed",
    summary: `Discovery run recorded from playbook ${playbook.id}.`,
    outcome: opts.outcome,
    playbook_id: playbook.id,
    playbook_version: playbook.version,
    requested_targets: requestedTargets,
    targets: canonicalTargets,
    target_resolutions: resolutionsJson,
    systems: uniqueStrings(playbook.systems),
    environments: uniqueStrings(playbook.environments),
    owners: uniqueStrings(playbook.owners),
    started_at: now,
    ended_at: now,
    evidence_count: evidence.length,
    raw_finding_count: raw.texts.length,
    qualified_findings: [] as string[],
    dataset_refs: datasetRefs,
    source_anchor: `${d.slashJoin(runRelPath, "run.md")}#run-${goToLower(runId)}`,
    doc_anchor: layout.ref("system/docs/prd/10-discovery-runs-and-qualification.md#run-artifacts"),
    source_refs: sourceRefs,
    related: uniqueStrings([playbook.id, ...canonicalTargets]),
    created_at: now,
    updated_at: now,
    inputs: new Map<string, GoJsonValue>([
      ["playbook_id", playbook.id],
      ["playbook_version", playbook.version],
      ["requested_targets", requestedTargets],
      ["targets", canonicalTargets],
      ["target_resolutions", resolutionsJson],
      ["dataset_refs", datasetRefs],
    ]),
    outputs: new Map<string, GoJsonValue>([
      ["evidence", evidence.map((a) => a.path)],
      ["raw_findings", rawAnchors],
    ]),
  };

  const result: RunDiscoveryResult = {
    runId,
    runPath: runRelPath,
    runsIndexPath: layout.rel("system/.os/data/runs.jsonl"),
    requestedTargets,
    canonicalTargets,
    targetResolutions,
    evidenceCount: evidence.length,
    rawFindingCount: raw.texts.length,
    dryRun: opts.dryRun,
    repoRoot: files.repoRoot,
  };
  // P7-R3-04: the index and the raw findings record are read back (the next run, `qualify finding`), so each must stay within its read bound. A dry run reports it too.
  const runRecord = utf8(formatRunRecord(d, row, evidence, rawAnchors));
  const rawRecord = formatRawFindings(runId, raw.texts);
  d.checkAppendSize(runsIndexPath, row, result.runsIndexPath);
  checkReadBack(layout.rel(`${d.slashJoin(runRelPath, "raw-findings.md")}`), rawRecord.length, READ_LIMITS.document, files.repoRoot);
  if (opts.dryRun) return result;

  files.preflightWrites([files.join(runPath, "run.md"), files.join(runPath, "evidence", "x"), runsIndexPath]);
  const owned = d.reserveArtifactFolder(runPath, runRelPath, "run", "evidence");
  // P4-P5 merge fix round: an entry is listed for the cleanup only after
  // this command created it. A failed create, copy, or write removes its
  // own new file, so an entry that already existed is never removed.
  const created = [runPath];
  d.withCleanup(owned, created, () => {
    d.mkdirOwned(files.join(runPath, "evidence"), created);
    for (const artifact of evidence) {
      d.copyFile(artifact.read, layout.path(artifact.path));
      created.push(layout.path(artifact.path));
    }
    // Go's os.WriteFile(path, data, 0o644) into the folder this command just
    // reserved: nothing else is there, so an exclusive create writes the same
    // file, and the canonical-data port has no write in place (P4 rule; P4
    // and P5 merge).
    files.writeNewFile(files.join(runPath, "run.md"), runRecord);
    created.push(files.join(runPath, "run.md"));
    files.writeNewFile(files.join(runPath, "raw-findings.md"), rawRecord);
    created.push(files.join(runPath, "raw-findings.md"));
    d.appendJsonl(runsIndexPath, row, result.runsIndexPath);
  });
  return result;
}

/** Go `QualifyFinding`. */
export function qualifyFinding(context: DiscoveryContext, opts: QualifyFindingOptions): QualifyFindingResult {
  const d = new Discovery(context, opts.repoRoot);
  const { layout, files } = d;
  if (opts.runId === "") throw new GoError("qualify finding requires --run-id");
  if (!FINDING_OUTCOMES.has(opts.outcome)) throw new GoError("qualify finding requires --outcome positive or negative");
  if (opts.confirmationTest === "") throw new GoError("qualify finding requires --confirmation-test");
  if (opts.confirmationEvidence === "") throw new GoError("qualify finding requires --confirmation-evidence");
  d.requireFile(layout.resolveUserPath(opts.confirmationTest), "--confirmation-test");
  d.requireFile(layout.resolveUserPath(opts.confirmationEvidence), "--confirmation-evidence");
  const graph = d.openEntityGraph("findings.jsonl");
  let runResolution: EntityResolution;
  try {
    runResolution = resolveEntityId(graph, opts.runId);
  } catch (error) {
    if (error instanceof GoError) throw new GoError(`resolve qualification run: ${error.message}`);
    throw error;
  }
  const canonicalRun = graph.record(runResolution.canonical_id);
  if (canonicalRun === undefined || canonicalRun.type !== "run") {
    throw new GoError(`resolve qualification run ${opts.runId}: terminal entity ${runResolution.canonical_id} is not a run`);
  }

  const runsIndexPath = layout.path("system/.os/data/runs.jsonl");
  const runRow = readRunIndexRow(d, runsIndexPath, runResolution.canonical_id);
  const rawRef = normalizeRawFindingRef(d, opts.runId, opts.rawFindingRef);
  validateRawFindingAnchor(d, rawRef);

  const findingsIndexPath = layout.path("system/.os/data/findings.jsonl");
  const findingId = d.nextJsonlId(findingsIndexPath, "FIND");
  const findingRelPath = layout.rel(`${d.slashJoin("system/workspace/findings", findingId)}/`);
  const findingPath = layout.path(findingRelPath);
  d.requireAbsent(findingPath, findingRelPath, "finding");

  const testArtifacts = d.planCopiedArtifacts([opts.confirmationTest], d.slashJoin(findingRelPath, "confirmation-test"));
  const evidenceArtifacts = d.planCopiedArtifacts([opts.confirmationEvidence], d.slashJoin(findingRelPath, "evidence"));

  const now = d.nowUtc();
  let title = goTrimSpace(opts.title);
  if (title === "") title = `Qualified finding ${findingId}`;
  const rawAnchor = rawRef;
  const negativeAssertion = opts.outcome === "negative" ? `The confirmation test ${testArtifacts[0]!.path} asserts the negative condition and passed repeatably.` : "";
  const row: FindingRow = {
    id: findingId,
    type: "finding",
    path: findingRelPath,
    title,
    status: "qualified",
    summary: `Finding qualified from run ${runResolution.canonical_id}.`,
    observed: `Raw finding ${rawAnchor} was deterministically confirmed.`,
    basis_refs: [runResolution.canonical_id, rawAnchor],
    confidence: "high",
    implications: [],
    outcome: opts.outcome,
    polarity: opts.outcome,
    requested_run_id: opts.runId,
    run_id: runResolution.canonical_id,
    origin_run: runResolution.canonical_id,
    raw_anchor: rawAnchor,
    qualification_test: `${d.slashJoin(findingRelPath, "qualification.md")}#confirmation-test`,
    confirmation_test: testArtifacts[0]!.path,
    confirmation_evidence: evidenceArtifacts[0]!.path,
    negative_assertion: negativeAssertion === "" ? undefined : negativeAssertion,
    systems: uniqueStrings(runRow.systems),
    environments: uniqueStrings(runRow.environments),
    owners: uniqueStrings(runRow.owners),
    qualified_at: now,
    designs: [],
    source_anchor: rawAnchor,
    doc_anchor: layout.ref("system/docs/prd/10-discovery-runs-and-qualification.md#finding-qualification"),
    source_refs: [rawAnchor],
    related: uniqueStrings([runResolution.canonical_id]),
    created_at: now,
    updated_at: now,
  };

  const result: QualifyFindingResult = {
    findingId,
    findingPath: findingRelPath,
    findingsIndexPath: layout.rel("system/.os/data/findings.jsonl"),
    requestedRunId: opts.runId,
    canonicalRunId: runResolution.canonical_id,
    runResolution,
    dryRun: opts.dryRun,
    repoRoot: files.repoRoot,
  };
  // P7-R3-04: the index and both records are read back (by `design promote finding`), so each must stay within its read bound.
  const findingRecord = utf8(formatFindingRecord(d, row));
  const qualificationRecord = utf8(formatQualificationRecord(d, row));
  d.checkAppendSize(findingsIndexPath, row as unknown as GoJsonValue, result.findingsIndexPath);
  checkReadBack(layout.rel(d.slashJoin(findingRelPath, "finding.md")), findingRecord.length, READ_LIMITS.document, files.repoRoot);
  checkReadBack(layout.rel(d.slashJoin(findingRelPath, "qualification.md")), qualificationRecord.length, READ_LIMITS.document, files.repoRoot);
  if (opts.dryRun) return result;

  files.preflightWrites([
    files.join(findingPath, "finding.md"),
    files.join(findingPath, "confirmation-test", "x"),
    files.join(findingPath, "evidence", "x"),
    findingsIndexPath,
  ]);
  const owned = d.reserveArtifactFolder(findingPath, findingRelPath, "finding", "confirmation-test");
  // As for a run: an entry is listed for the cleanup only after this command created it.
  const created = [findingPath];
  d.withCleanup(owned, created, () => {
    d.mkdirOwned(files.join(findingPath, "confirmation-test"), created);
    d.mkdirOwned(files.join(findingPath, "evidence"), created);
    for (const artifact of [...testArtifacts, ...evidenceArtifacts]) {
      d.copyFile(artifact.read, layout.path(artifact.path));
      created.push(layout.path(artifact.path));
    }
    files.writeNewFile(files.join(findingPath, "finding.md"), findingRecord);
    created.push(files.join(findingPath, "finding.md"));
    files.writeNewFile(files.join(findingPath, "qualification.md"), qualificationRecord);
    created.push(files.join(findingPath, "qualification.md"));
    d.appendJsonl(findingsIndexPath, row as unknown as GoJsonValue, result.findingsIndexPath);
  });
  return result;
}

/** Go `findingIndexRow` of the discovery tool, in field order. `negative_assertion` is `omitempty`. */
interface FindingRow {
  id: string;
  type: string;
  path: string;
  title: string;
  status: string;
  summary: string;
  observed: string;
  basis_refs: string[];
  confidence: string;
  implications: string[];
  outcome: string;
  polarity: string;
  requested_run_id: string;
  run_id: string;
  origin_run: string;
  raw_anchor: string;
  qualification_test: string;
  confirmation_test: string;
  confirmation_evidence: string;
  negative_assertion: string | undefined;
  systems: string[];
  environments: string[];
  owners: string[];
  qualified_at: string;
  designs: string[];
  source_anchor: string;
  doc_anchor: string;
  source_refs: string[];
  related: string[];
  created_at: string;
  updated_at: string;
}

/** Go `readRunIndexRow`: the systems, environments, and owners of the run row with `runId`. */
function readRunIndexRow(d: Discovery, indexPath: string, runId: string): { systems: string[] | null; environments: string[] | null; owners: string[] | null } {
  const data = d.files.mustReadFile(indexPath, READ_LIMITS.data);
  const scanned = goScanLines(data);
  for (const { bytes } of scanned.lines) {
    const line = goTrimSpaceBytes(bytes);
    if (line.length === 0) continue;
    const { value, error } = goUnmarshal(line, RUN_INDEX_ROW);
    if (error !== undefined) throw new GoError(error);
    const row = value as Record<string, GoDecoded>;
    if (row["id"] === runId) return { systems: asStrings(row["systems"]!), environments: asStrings(row["environments"]!), owners: asStrings(row["owners"]!) };
  }
  if (scanned.tooLong) throw new GoError(GO_SCANNER_TOO_LONG);
  throw new GoError(`run ${runId} not found`);
}

/** Go `normalizeRawFindingRef`. */
function normalizeRawFindingRef(d: Discovery, runId: string, rawRef: string): string {
  if (rawRef === "") throw new GoError("qualify finding requires --raw-finding-ref");
  if (rawRef.startsWith("#")) return d.layout.rel(d.slashJoin("system/workspace/runs", runId, "raw-findings.md") + rawRef);
  if (rawRef.startsWith("raw-findings.md#")) return d.layout.rel(d.slashJoin("system/workspace/runs", runId, rawRef));
  if (rawRef.includes("#")) return d.layout.rel(goToSlash(rawRef, d.files.platform));
  throw new GoError(`raw finding reference ${goQuote(rawRef)} must be a path#anchor`);
}

/** Go `validateRawFindingAnchor`. */
function validateRawFindingAnchor(d: Discovery, rawRef: string): void {
  const cut = rawRef.indexOf("#");
  const pathPart = cut === -1 ? rawRef : rawRef.slice(0, cut);
  const anchor = cut === -1 ? "" : rawRef.slice(cut + 1);
  if (cut === -1 || anchor === "") throw new GoError(`raw finding reference ${goQuote(rawRef)} must be a path#anchor`);
  const read = d.files.readFile(d.layout.resolveRepoPath(pathPart), READ_LIMITS.document);
  if ("error" in read) throw new GoError(`read raw finding reference ${rawRef}: ${read.error}`);
  if (!goContainsText(read.data, anchor)) throw new GoError(`raw finding anchor ${anchor} not found in ${pathPart}`);
}

/** Go `formatRawFindings`, as bytes: the raw text is written as read. */
function formatRawFindings(runId: string, rawTexts: readonly Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = [utf8(`# Raw Findings for ${runId}\n\n`)];
  if (rawTexts.length === 0) {
    parts.push(utf8("No raw findings recorded.\n"));
    return concatBytes(parts);
  }
  rawTexts.forEach((text, i) => {
    parts.push(utf8(`## Raw Finding ${i + 1} {#raw-finding-${i + 1}}\n\n`));
    const trimmed = goTrimSpaceBytes(text);
    if (trimmed.length === 0) parts.push(utf8("_No raw finding text provided._\n\n"));
    else parts.push(trimmed, utf8("\n\n"));
  });
  return concatBytes(parts);
}

interface RunRowText {
  id: string;
  title: string;
  path: string;
  status: string;
  outcome: string;
  playbook_id: string;
  playbook_version: string;
  started_at: string;
  ended_at: string;
  requested_targets: string[];
  targets: string[];
  target_resolutions: EntityResolution[];
  dataset_refs: string[];
}

/** Go `formatRunRecord`. */
function formatRunRecord(d: Discovery, row: RunRowText, evidence: readonly CopiedArtifact[], rawAnchors: readonly string[]): string {
  let out = `# ${row.title}\n\n`;
  out += `## Run ${row.id} {#run-${goToLower(row.id)}}\n\n`;
  out += `- Status: ${row.status}\n`;
  out += `- Outcome: ${row.outcome}\n`;
  out += `- Playbook: ${row.playbook_id} (${row.playbook_version})\n`;
  out += `- Started: ${row.started_at}\n`;
  out += `- Ended: ${row.ended_at}\n`;
  out += `- Requested targets: ${inlineList(row.requested_targets)}\n`;
  out += `- Targets: ${inlineList(row.targets)}\n`;
  for (const resolution of row.target_resolutions) out += `- Target resolution: ${resolutionText(resolution)}\n`;
  out += `- Dataset refs: ${inlineList(row.dataset_refs)}\n\n`;
  out += "## Evidence\n\n";
  if (evidence.length === 0) {
    out += "No evidence files recorded.\n\n";
  } else {
    for (const artifact of evidence) out += `- [${artifact.source}](${d.relativeArtifact(row.path, artifact.path)})\n`;
    out += "\n";
  }
  out += "## Raw Findings\n\n";
  if (rawAnchors.length === 0) out += "No raw findings recorded.\n";
  else for (const anchor of rawAnchors) out += `- [${anchor}](${anchor})\n`;
  return out;
}

/** Go `formatFindingRecord`. */
function formatFindingRecord(d: Discovery, row: FindingRow): string {
  let out = `# ${row.title}\n\n`;
  out += `## Finding ${row.id} {#finding-${goToLower(row.id)}}\n\n`;
  out += `- Status: ${row.status}\n`;
  out += `- Polarity: ${row.polarity}\n`;
  out += `- Requested run: ${row.requested_run_id}\n`;
  out += `- Origin run: ${row.origin_run}\n`;
  out += `- Raw anchor: [${row.raw_anchor}](${d.relativeArtifact(row.path, row.raw_anchor)})\n`;
  out += `- Qualification test: [${row.qualification_test}](qualification.md#confirmation-test)\n`;
  out += `- Qualified at: ${row.qualified_at}\n\n`;
  out += `## Observation\n\n${row.observed}\n\n`;
  if (row.negative_assertion !== undefined) out += `## Negative Assertion\n\n${row.negative_assertion}\n\n`;
  out += "## Designs\n\nNo design hand-off recorded.\n";
  return out;
}

/** Go `formatQualificationRecord`. */
function formatQualificationRecord(d: Discovery, row: FindingRow): string {
  let out = `# Qualification for ${row.id}\n\n`;
  out += "## Confirmation Test {#confirmation-test}\n\n";
  out += "- Test type: Playwright\n";
  out += `- Procedure: rerun \`${row.confirmation_test}\`\n`;
  out += `- Assertion: ${row.polarity === "negative" ? "The deterministic test asserts the negative condition and passes." : "The deterministic test confirms the asserted behavior and passes."}\n`;
  out += "- Result: pass\n";
  out += `- Evidence: [${row.confirmation_evidence}](${d.relativeArtifact(row.path, row.confirmation_evidence)})\n`;
  if (row.negative_assertion !== undefined) out += `\n## Negative Assertion\n\n${row.negative_assertion}\n`;
  return out;
}

/** The line Go's `main` prints for a run. */
export function formatRunOutput(result: RunDiscoveryResult): string {
  let out = `${result.dryRun ? "would write" : "wrote"} ${result.runPath} (${result.runId})\n`;
  for (const resolution of result.targetResolutions) out += `target ${resolutionText(resolution)}\n`;
  return out;
}

/** The lines Go's `main` prints for a qualification. */
export function formatQualifyOutput(result: QualifyFindingResult): string {
  return `${result.dryRun ? "would write" : "wrote"} ${result.findingPath} (${result.findingId})\nrun ${result.requestedRunId} -> ${result.canonicalRunId} (${(result.runResolution.chain ?? []).join(" -> ")})\n`;
}

export { GoError };
