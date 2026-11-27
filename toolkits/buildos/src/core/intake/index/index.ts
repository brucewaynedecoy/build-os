/**
 * `buildos intake index references` and `index playbooks`, ported from the
 * Go intake tool (`index.go`). The references rebuild keeps every REF ID
 * the existing index gave a converted path, gives new paths the next
 * numbers in converted-path order, and never reuses a number: `next_id`
 * only grows.
 */

import { GoError } from "../../shared/go-fs.ts";
import { goCompare, goIsBlank, goMarshalIndent, goUnmarshal, type GoDecoded, type GoJsonValue, type GoType } from "../../shared/go-json.ts";
import { goIsNotExist, goPathError, goStatOp } from "../../shared/go-os-error.ts";
import { goJoinAll, type GoPathPlatform } from "../../shared/go-path.ts";
import { cleanRoot, hostPlatform, INTAKE_DEFAULT_PATHS, repoRelative, resolvePath } from "../convert/convert.ts";
import { goAtoiExact, goEqualFold, goExt, goIntAdd, goPad3, goToSlash, utf8Bytes, utf8Text } from "../go-text.ts";
import { IntakeFs, withRecord, WriteRecord, type IntakeContext } from "../io.ts";
import { checkReadBack, READ_LIMITS } from "../../shared/read-limits.ts";
import { parseFrontmatter, type FrontmatterFields } from "./frontmatter.ts";

export interface IndexOptions {
  repoRoot: string;
  assetsRoot: string;
  playbooksRoot: string;
  output: string;
  /** Keep a record of what the write made or changed (`--json`, PE-022; see `ConvertOptions.recordWrites`). Intake never undoes a write. */
  recordWrites?: boolean;
}

export interface IndexResult {
  outputPath: string;
  count: number;
}

interface ReferenceEntry {
  id: string;
  source: string;
  converted: string;
  sha256: string;
  type: string;
  converter: string;
  timestamp: string;
  status: string;
}

const REFERENCE_FIELDS = ["id", "source", "converted", "sha256", "type", "converter", "timestamp", "status"] as const;

const REFERENCE_INDEX_TYPE: GoType = {
  kind: "struct",
  name: "intake.ReferenceIndex",
  short: "ReferenceIndex",
  fields: [
    { name: "version", type: { kind: "int" } },
    { name: "next_id", type: { kind: "int", exact: true } },
    {
      name: "references",
      type: {
        kind: "slice",
        name: "[]intake.ReferenceEntry",
        elem: { kind: "struct", name: "intake.ReferenceEntry", short: "ReferenceEntry", fields: REFERENCE_FIELDS.map((name) => ({ name, type: { kind: "string" } as GoType })) },
      },
    },
  ],
};

/**
 * Go `filepath.WalkDir(root, fn)` from a root the caller has stat'd: the
 * root, then each entry in name order, depth first. A symlink is not a folder.
 */
function walk(fs: IntakeFs, root: string, rootIsDir: boolean, fn: (path: string, isDir: boolean) => void): void {
  const visit = (path: string, isDir: boolean) => {
    fn(path, isDir);
    if (!isDir) return;
    for (const entry of fs.readDir(path)) visit(goJoinAll(fs.platform, path, entry.name), entry.kind === "directory");
  };
  visit(root, rootIsDir);
}

/** Go `os.Stat` then `WalkDir` over an index source root; a missing root is no files. */
function walkRoot(fs: IntakeFs, root: string, fn: (path: string, isDir: boolean) => void): void {
  const info = fs.stat(root);
  if (!info.ok) {
    if (goIsNotExist(info.detail)) return;
    throw new GoError(goPathError(goStatOp(), root, info.detail));
  }
  walk(fs, root, info.stat.kind === "directory", fn);
}

/** Go `refNumber`. */
function refNumber(id: string): bigint | undefined {
  if (!id.startsWith("REF-")) return undefined;
  const digits = id.slice(4);
  if (!/^[0-9]+$/.test(digits)) return undefined;
  const n = goAtoiExact(digits);
  return n === undefined || n <= 0n ? undefined : n;
}

/** Go `referenceIDLess`. */
function referenceIdLess(a: ReferenceEntry, b: ReferenceEntry): number {
  const an = refNumber(a.id);
  const bn = refNumber(b.id);
  if ((an !== undefined) !== (bn !== undefined)) return an !== undefined ? -1 : 1;
  if (an !== undefined && bn !== undefined && an !== bn) return an < bn ? -1 : 1;
  if (a.id !== b.id) return goCompare(a.id, b.id);
  return goCompare(a.converted, b.converted);
}

/** Go `loadPreviousReferences`. */
function loadPreviousReferences(fs: IntakeFs, outputPath: string): { ids: Map<string, string>; highest: bigint } {
  const previous = { ids: new Map<string, string>(), highest: 0n };
  const read = fs.tryReadFile(outputPath);
  if (!read.ok) {
    if (read.notExist) return previous;
    throw read.error;
  }
  const data = read.data;
  if (goIsBlank(data)) return previous;
  const decoded = goUnmarshal(data, REFERENCE_INDEX_TYPE);
  if (decoded.error !== undefined) {
    throw new GoError(`read existing references index ${outputPath}: ${decoded.error} (fix or move the file before rebuilding so reference IDs are not lost)`);
  }
  // Go's int: 64 bits, exact past 2^53 (a bigint here).
  const index = decoded.value as { next_id: bigint; references: GoDecoded[] | null };
  if (index.next_id > 1n) previous.highest = index.next_id - 1n;
  const convertedById = new Map<string, string>();
  for (const raw of index.references ?? []) {
    const entry = raw as unknown as ReferenceEntry;
    const n = refNumber(entry.id);
    if (n !== undefined && n > previous.highest) previous.highest = n;
    if (entry.id === "" || entry.converted === "") continue;
    const other = convertedById.get(entry.id);
    if (other !== undefined) throw new GoError(`existing references index ${outputPath} gives ${entry.id} to both ${other} and ${entry.converted}; fix it before rebuilding`);
    const otherId = previous.ids.get(entry.converted);
    if (otherId !== undefined) throw new GoError(`existing references index ${outputPath} lists ${entry.converted} twice (${otherId} and ${entry.id}); fix it before rebuilding`);
    convertedById.set(entry.id, entry.converted);
    previous.ids.set(entry.converted, entry.id);
  }
  return previous;
}

const scalar = (fields: FrontmatterFields, key: string) => fields.scalars.get(key) ?? "";

/**
 * Go `json.MarshalIndent(v, "", "  ")` plus a final newline, written with
 * `os.MkdirAll` and `os.WriteFile`. W1 R7 P7 review round 3 (P7-R3-04): an
 * index larger than `readLimit`, the bound of the command that reads it
 * back, is not written (exit 4).
 */
function writeIndex(fs: IntakeFs, outputPath: string, value: GoJsonValue, readLimit: number, recordWrites: boolean | undefined): void {
  const data = utf8Bytes(`${goMarshalIndent(value, true)}\n`);
  checkReadBack(goToSlash(repoRelative(fs.repoRoot, outputPath, fs.platform), fs.platform), data.length, readLimit, fs.repoRoot);
  const record = recordWrites === true ? new WriteRecord() : undefined;
  withRecord(record, () => fs.writeFileWithParents(outputPath, data, record));
}

/** Go `BuildReferencesIndex`. */
export function buildReferencesIndex(context: IntakeContext, opts: IndexOptions): IndexResult {
  const platform: GoPathPlatform = context.platform ?? hostPlatform();
  const repoRoot = cleanRoot(opts.repoRoot, context.cwd, platform);
  const fs = new IntakeFs(context, repoRoot, platform);
  const assetsRoot = resolvePath(fs, opts.assetsRoot, INTAKE_DEFAULT_PATHS.assetsRoot);
  const outputPath = resolvePath(fs, opts.output, INTAKE_DEFAULT_PATHS.referencesOutput);
  const entries: ReferenceEntry[] = [];
  walkRoot(fs, assetsRoot, (path, isDir) => {
    if (isDir) return;
    const fields = parseFrontmatter(utf8Text(fs.readFile(path)));
    if (fields === undefined) return;
    entries.push({
      id: "",
      source: scalar(fields, "source"),
      converted: goToSlash(repoRelative(repoRoot, path, platform), platform),
      sha256: scalar(fields, "sha256"),
      type: scalar(fields, "type"),
      converter: scalar(fields, "converter"),
      timestamp: scalar(fields, "timestamp"),
      status: scalar(fields, "status"),
    });
  });
  const previous = loadPreviousReferences(fs, outputPath);
  entries.sort((a, b) => goCompare(a.converted, b.converted));
  let highest = previous.highest;
  for (const entry of entries) {
    const id = previous.ids.get(entry.converted);
    if (id !== undefined) {
      entry.id = id;
      continue;
    }
    highest = goIntAdd(highest, 1n);
    entry.id = `REF-${goPad3(highest)}`;
  }
  entries.sort(referenceIdLess);
  const references: GoJsonValue = entries.length === 0 ? null : entries.map((e) => ({ ...e }));
  // The next `intake index references` reads this index back (READ_LIMITS.intake).
  writeIndex(fs, outputPath, { version: 1, next_id: goIntAdd(highest, 1n), references }, READ_LIMITS.intake, opts.recordWrites);
  return { outputPath, count: entries.length };
}

const REQUIRED_SCALARS = ["id", "title", "category", "execution_mode", "state_nature", "status", "audience", "source_anchor", "version"];
const REQUIRED_LISTS = ["harness", "systems", "environments", "owners", "targets", "produces", "related"];

/** Go `BuildPlaybooksIndex`. */
export function buildPlaybooksIndex(context: IntakeContext, opts: IndexOptions): IndexResult {
  const platform: GoPathPlatform = context.platform ?? hostPlatform();
  const repoRoot = cleanRoot(opts.repoRoot, context.cwd, platform);
  const fs = new IntakeFs(context, repoRoot, platform);
  const playbooksRoot = resolvePath(fs, opts.playbooksRoot, INTAKE_DEFAULT_PATHS.playbooksRoot);
  const outputPath = resolvePath(fs, opts.output, INTAKE_DEFAULT_PATHS.playbooksOutput);
  const entries: { [key: string]: GoJsonValue; id: string; path: string; status: string }[] = [];
  walkRoot(fs, playbooksRoot, (path, isDir) => {
    if (isDir || goExt(path, platform) !== ".md") return;
    const fields = parseFrontmatter(utf8Text(fs.readFile(path)));
    if (fields === undefined) return;
    const rel = goToSlash(repoRelative(repoRoot, path, platform), platform);
    const missing: string[] = [];
    for (const key of REQUIRED_SCALARS) {
      const value = fields.scalars.get(key);
      if (value === undefined || (key !== "source_anchor" && value === "")) missing.push(key);
    }
    for (const key of REQUIRED_LISTS) if (!fields.lists.has(key)) missing.push(key);
    if (missing.length > 0) throw new GoError(`playbook ${rel} missing required frontmatter fields: ${missing.join(", ")}`);
    const list = (key: string) => [...(fields.lists.get(key) ?? [])];
    const anchor = scalar(fields, "source_anchor");
    entries.push({
      id: scalar(fields, "id"),
      path: rel,
      title: scalar(fields, "title"),
      category: scalar(fields, "category"),
      execution_mode: scalar(fields, "execution_mode"),
      state_nature: scalar(fields, "state_nature"),
      status: scalar(fields, "status"),
      audience: scalar(fields, "audience"),
      harness: list("harness"),
      systems: list("systems"),
      environments: list("environments"),
      owners: list("owners"),
      targets: list("targets"),
      produces: list("produces"),
      source_anchor: anchor === "" || goEqualFold(anchor, "null") ? null : anchor,
      version: scalar(fields, "version"),
      related: list("related"),
    });
  });
  entries.sort((a, b) => (a.id === b.id ? goCompare(a.path, b.path) : goCompare(a.id, b.id)));
  // Discovery reads this index back (READ_LIMITS.data).
  writeIndex(fs, outputPath, { version: 1, playbooks: entries, runnable_playbooks: entries.filter((e) => e.status === "active") }, READ_LIMITS.data, opts.recordWrites);
  return { outputPath, count: entries.length };
}
