/**
 * Design promotion, ported from the Go tool
 * `toolkits/buildos-design/internal/design/promotion.go` (`PromoteFinding`).
 * It resolves a qualified finding through the P3 entity core in this
 * process, renders one design file under `docs/designs/` (or
 * `system/docs/designs/` in the repository layout), and records the design
 * in the finding's `designs` list and finding record. A dry run writes
 * nothing.
 *
 * Boundary (register item R-009, the write path still open): promotion
 * writes exactly one new file under `docs/`, the design, and no Make Docs
 * index. It also replaces the findings index and the finding record, which
 * BuildOS owns. W1 R7 P7 Stage 6 (PE-020): with a design template from the
 * Make Docs 2.0.9 layout the design is in the 2.0.9 form
 * (`make-docs-form.ts`); with a legacy template it is Go's text.
 *
 * The findings index and the finding record are replaced atomically. On
 * Windows the parent folder flush is skipped (parity exception PE-005, P5
 * t11): Go 1.24.1 fails it there with `Access is denied.` after the rename
 * has committed. A failed later step rolls back the earlier replacements, as
 * in Go.
 *
 * A symlink at the finding record (or the index) is replaced, never followed,
 * as Go's `os.Rename` does, wherever it points: no byte is written there (P5
 * review round 1). A write that would land outside the repository root
 * through a symlinked folder is refused (exit 3, parity exception PE-012)
 * unless `--allow-outside-root` is given. Every write folder is checked
 * before the first write, so a refusal changes nothing, and a refusal or
 * failure after a write rolls back the earlier replacements, as Go does for
 * its own errors.
 *
 * P5 review round 2: a rollback restores every replaced entry as it was (a
 * symlink stays a symlink with its target text, a file gets its bytes and
 * mode back), also after a step that fails once its rename has landed.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { checkReadBack, checkRowsReadBack, JSONL_ROW_LIMITS, READ_LIMITS } from "../shared/read-limits.ts";
import { resolveEntity } from "../entities/resolve.ts";
import type { EntityDiagnostic } from "../entities/types.ts";
import { BuildOsLayout } from "../shared/buildos-layout.ts";
import { InputError, isCoreError } from "../shared/errors.ts";
import { MAKE_DOCS_LIMIT } from "../init/init.ts";
import { MAKE_DOCS_RANGE } from "../init/make-docs-range.ts";
import { DesignFormError, DesignSelfCheckError, renderMakeDocsDesign } from "./make-docs-form.ts";
import { parseYamlSubset } from "../validate/yaml-subset.ts";
import { npxMakeDocsDisplay } from "../init/make-docs.ts";
import { runWords } from "../shared/run-command.ts";
import { makeDocsForeignRouters } from "../init/plan.ts";
import { GoError, GoFiles, type GoFilesContext } from "../shared/go-files.ts";
import {
  concatBytes,
  goMarshalRawObject,
  goTrimSpace,
  goUnmarshal,
  goUnmarshalRawObject,
  goFoldName,
  utf8,
  type GoDecoded,
  type GoJsonValue,
  type GoType,
  type RawObject,
} from "../shared/go-json.ts";
import { goQuote } from "../shared/go-quote.ts";
import {
  GO_SCANNER_TOO_LONG,
  goContainsText,
  goFromSlash,
  goLocalDate,
  goMarshal,
  goRel,
  goRfc3339Utc,
  goScanLines,
  goSprintStrings,
  goToLower,
  goToSlash,
  goTrimSpaceBytes,
} from "../shared/go-text.ts";
import { goDir } from "../shared/go-path.ts";

export interface PromoteHooks {
  /**
   * Go `replaceExistingFile` (default: the atomic replace). A rollback passes
   * `restoreMode`, the file's full mode before the command (`mode & 0o7777`).
   */
  replaceExistingFile(files: GoFiles, path: string, data: Uint8Array, restoreMode?: number): void;
  /** Go `createExclusiveFile` (default: `syncNewFile`). */
  createExclusiveFile(files: GoFiles, path: string, data: Uint8Array): void;
}

export interface DesignContext extends GoFilesContext {
  /** The clock. Defaults to the system time. */
  now?: () => Date;
  hooks?: Partial<PromoteHooks>;
}

export interface PromoteFindingOptions {
  repoRoot: string;
  findingId: string;
  route: string;
  title: string;
  slug: string;
  dryRun: boolean;
}

export interface PromoteFindingResult {
  findingId: string;
  requestedFindingId: string;
  canonicalFindingId: string;
  redirectChain: string[] | null;
  designPath: string;
  findingPath: string;
  findingsIndexPath: string;
  designContent: string;
  dryRun: boolean;
  /** The repository root as Go spells it. */
  repoRoot: string;
}

const ALLOWED_ROUTES = new Map([
  ["baseline-plan", "designs-to-plan.prompt.md"],
  ["change-plan", "designs-to-plan-change.prompt.md"],
]);

/** Go `findingIndexOwnedFields`: replaced by the typed row when a row is rewritten. */
const OWNED_FIELDS = [
  "id", "type", "path", "title", "status", "summary", "observed", "basis_refs", "confidence", "implications",
  "outcome", "polarity", "run_id", "origin_run", "raw_anchor", "qualification_test", "confirmation_test",
  "confirmation_evidence", "negative_assertion", "systems", "environments", "owners", "qualified_at", "designs",
  "source_anchor", "doc_anchor", "source_refs", "related", "created_at", "updated_at", "redirect",
];

const STRING: GoType = { kind: "string" };
const STRINGS: GoType = { kind: "slice", name: "[]string", elem: STRING };
const STRING_FIELDS = new Set([
  "id", "type", "path", "title", "status", "summary", "observed", "confidence", "outcome", "polarity", "run_id", "origin_run", "raw_anchor",
  "qualification_test", "confirmation_test", "confirmation_evidence", "negative_assertion", "qualified_at", "source_anchor", "doc_anchor", "created_at", "updated_at",
]);

/** Go `entities.Redirect`. */
const REDIRECT: GoType = {
  kind: "struct",
  name: "entities.Redirect",
  short: "Redirect",
  fields: [...["target_id", "kind", "decided_at", "decided_by", "reason"].map((name): { name: string; type: GoType } => ({ name, type: STRING })), { name: "evidence_refs", type: STRINGS }],
};

/** The typed fields of Go `findingIndexRow`, in struct order. */
const ROW_FIELDS: { name: string; type: GoType }[] = [
  ...["id", "type", "path", "title", "status", "summary", "observed"].map((name) => ({ name, type: STRING })),
  { name: "basis_refs", type: STRINGS },
  { name: "confidence", type: STRING },
  { name: "implications", type: STRINGS },
  ...["outcome", "polarity", "run_id", "origin_run", "raw_anchor", "qualification_test", "confirmation_test", "confirmation_evidence", "negative_assertion"].map((name) => ({ name, type: STRING })),
  { name: "systems", type: STRINGS },
  { name: "environments", type: STRINGS },
  { name: "owners", type: STRINGS },
  { name: "qualified_at", type: STRING },
  { name: "designs", type: STRINGS },
  { name: "source_anchor", type: STRING },
  { name: "doc_anchor", type: STRING },
  { name: "source_refs", type: STRINGS },
  { name: "related", type: STRINGS },
  { name: "created_at", type: STRING },
  { name: "updated_at", type: STRING },
  // Go `*entities.Redirect`.
  { name: "redirect", type: REDIRECT },
];

const FINDING_ROW: GoType = { kind: "struct", name: "design.findingIndexRow", short: "findingIndexRow", fields: ROW_FIELDS };

interface Redirect {
  target_id: string;
  kind: string;
  decided_at: string;
  decided_by: string;
  reason: string;
  evidence_refs: string[] | null;
}

/** Go `findingIndexRow`: typed fields, the raw object, the raw line, and the dirty flag. */
interface FindingRow {
  fields: Record<string, string | string[] | null>;
  redirect: Redirect | undefined;
  raw: RawObject;
  rawLine: Uint8Array;
  dirty: boolean;
}

const text = (row: FindingRow, name: string): string => row.fields[name] as string;
const list = (row: FindingRow, name: string): string[] | null => row.fields[name] as string[] | null;

/** Go `uniqueStrings` of the design tool: trims, drops empty and repeated values, keeps order. */
function uniqueStrings(values: readonly string[] | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values ?? []) {
    const value = goTrimSpace(raw);
    if (value === "" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/** Go `inlineList` of the design tool. */
function inlineList(values: readonly string[] | null): string {
  const unique = uniqueStrings(values);
  return unique.length === 0 ? "none" : unique.join(", ");
}

/** Go `formatEntityDiagnostics`: the first diagnostic only. */
function formatEntityDiagnostics(diagnostics: readonly EntityDiagnostic[]): string {
  const first = diagnostics[0];
  if (first === undefined) return "unknown graph error";
  return `${first.code}: ${first.message}${first.action !== "" ? `; ${first.action}` : ""}`;
}

/** Bytes as a string of one char per byte, so byte offsets and text offsets agree. */
function latin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
}

function fromLatin1(textValue: string): Uint8Array {
  const out = new Uint8Array(textValue.length);
  for (let i = 0; i < textValue.length; i++) out[i] = textValue.charCodeAt(i);
  return out;
}

/** UTF-8 text in the one-char-per-byte form. */
const bin = (value: string): string => latin1(utf8(value));

class Promotion {
  readonly files: GoFiles;
  readonly layout: BuildOsLayout;
  readonly hooks: PromoteHooks;
  readonly now: () => Date;

  constructor(context: DesignContext, repoRootFlag: string) {
    const probe = new GoFiles(context, ".");
    this.files = new GoFiles(context, repoRootFlag === "" ? "." : probe.absolute(repoRootFlag));
    this.layout = BuildOsLayout.detect(this.files);
    this.now = context.now ?? (() => new Date());
    this.hooks = {
      replaceExistingFile: context.hooks?.replaceExistingFile ?? ((files, path, data, restoreMode) => files.atomicReplace(path, data, restoreMode)),
      createExclusiveFile: context.hooks?.createExclusiveFile ?? ((files, path, data) => files.writeNewFile(path, data, { sync: true })),
    };
  }

  slashJoin(...parts: string[]): string {
    return goToSlash(this.files.join(...parts), this.files.platform);
  }
}

/** Go `resolveFinding`. */
function resolveFinding(p: Promotion, requestedId: string): { requestedId: string; canonicalId: string; chain: string[] | null } {
  const entityRoot = p.layout.installedRoot ? p.layout.repoRoot : p.layout.path("system");
  // P7-R3-03: the graph is read inside the root; only the findings index this command replaces may be a link out (PE-014).
  const { graph, diagnostics } = p.files.openEntityRoot(entityRoot, ["findings.jsonl"]);
  if (diagnostics.some((d) => d.severity === "error")) throw new GoError(`finding entity graph is invalid: ${formatEntityDiagnostics(diagnostics)}`);
  const resolved = resolveEntity(graph, requestedId);
  if (resolved.diagnostics.some((d) => d.severity === "error")) throw new GoError(`resolve finding ${requestedId}: ${formatEntityDiagnostics(resolved.diagnostics)}`);
  const chain = resolved.resolution.chain;
  return { requestedId: resolved.resolution.requested_id, canonicalId: resolved.resolution.canonical_id, chain: chain === null || chain.length === 0 ? null : [...chain] };
}

/** True when the last key of `raw` that folds to `name` holds a value other than `null`, as Go sets a pointer field. */
function pointerPresent(raw: RawObject, name: string): boolean {
  let present = false;
  for (const [key, bytes] of raw) {
    if (key !== name && goFoldName(key) !== goFoldName(name)) continue;
    present = latin1(goTrimSpaceBytes(bytes)) !== "null";
  }
  return present;
}

/** Go `readFindingRows`. */
function readFindingRows(p: Promotion, indexPath: string, findingId: string): { rows: FindingRow[]; target: number } {
  const shown = goToSlash(indexPath, p.files.platform);
  const read = p.files.readFile(indexPath, READ_LIMITS.data);
  if ("error" in read) throw new GoError(`read ${shown}: ${read.error}`);
  const rows: FindingRow[] = [];
  const seen = new Map<string, number>();
  let target = -1;
  const scanned = goScanLines(read.data);
  for (const { number, bytes } of scanned.lines) {
    const line = goTrimSpaceBytes(bytes);
    if (line.length === 0) continue;
    const typed = goUnmarshal(line, FINDING_ROW);
    if (typed.error !== undefined) throw new GoError(`${shown} line ${number} invalid JSON: ${typed.error}`);
    const rawObject = goUnmarshalRawObject(line);
    if (rawObject.error !== undefined || rawObject.object === null) throw new GoError(`${shown} line ${number} must be a JSON object`);
    const decoded = typed.value as Record<string, GoDecoded>;
    const fields: Record<string, string | string[] | null> = {};
    for (const { name } of ROW_FIELDS) {
      if (name === "redirect") continue;
      fields[name] = STRING_FIELDS.has(name) ? (decoded[name] as string) : (decoded[name] as string[] | null);
    }
    const redirectValue = decoded["redirect"] as Record<string, GoDecoded>;
    const redirect: Redirect | undefined = pointerPresent(rawObject.object, "redirect")
      ? {
          target_id: redirectValue["target_id"] as string,
          kind: redirectValue["kind"] as string,
          decided_at: redirectValue["decided_at"] as string,
          decided_by: redirectValue["decided_by"] as string,
          reason: redirectValue["reason"] as string,
          evidence_refs: redirectValue["evidence_refs"] as string[] | null,
        }
      : undefined;
    const row: FindingRow = { fields, redirect, raw: rawObject.object, rawLine: bytes, dirty: false };
    const id = text(row, "id");
    if (id === "") throw new GoError(`${shown} line ${number} missing id`);
    const prior = seen.get(id);
    if (prior !== undefined) throw new GoError(`${shown} line ${number} duplicates line ${prior} id ${id}`);
    seen.set(id, number);
    if (id === findingId) target = rows.length;
    rows.push(row);
  }
  if (scanned.tooLong) throw new GoError(GO_SCANNER_TOO_LONG);
  if (target === -1) throw new GoError(`finding ${findingId} not found`);
  return { rows, target };
}

/** Go `marshalFindingRow`: the raw line for a clean row; else the typed fields over the unowned raw fields, keys sorted. */
function marshalFindingRow(row: FindingRow): Uint8Array {
  if (!row.dirty) return row.rawLine.slice();
  const merged: RawObject = new Map();
  for (const [key, value] of row.raw) merged.set(key, value.slice());
  for (const key of OWNED_FIELDS) merged.delete(key);
  for (const { name } of ROW_FIELDS) {
    if (name === "redirect") {
      if (row.redirect !== undefined) merged.set(name, utf8(goMarshal({ ...row.redirect } as GoJsonValue)));
      continue;
    }
    const value = row.fields[name]!;
    if (name === "negative_assertion" && value === "") continue;
    merged.set(name, utf8(goMarshal(value as GoJsonValue)));
  }
  return goMarshalRawObject(merged);
}

/** Go `marshalFindingRows`. */
function marshalFindingRows(rows: readonly FindingRow[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const row of rows) parts.push(marshalFindingRow(row), Uint8Array.of(0x0a));
  return concatBytes(parts);
}

/** Go `normalizeFindingRow`. */
function normalizeFindingRow(p: Promotion, row: FindingRow): void {
  const { layout } = p;
  row.fields["path"] = layout.rel(text(row, "path"));
  row.fields["raw_anchor"] = layout.ref(text(row, "raw_anchor"));
  row.fields["qualification_test"] = layout.ref(text(row, "qualification_test"));
  row.fields["confirmation_test"] = layout.rel(text(row, "confirmation_test"));
  row.fields["confirmation_evidence"] = layout.rel(text(row, "confirmation_evidence"));
  row.fields["source_anchor"] = layout.ref(text(row, "source_anchor"));
  row.fields["doc_anchor"] = layout.ref(text(row, "doc_anchor"));
  row.fields["designs"] = layout.rels(list(row, "designs"));
  row.fields["source_refs"] = layout.refs(list(row, "source_refs"));
  row.fields["related"] = layout.refs(list(row, "related"));
}

/** Go `validateQualificationAnchor`. */
function validateQualificationAnchor(p: Promotion, qualificationPath: string, anchor: string): void {
  const absPath = p.layout.path(qualificationPath);
  const stat = p.files.stat(absPath);
  if (stat.kind !== "ok") throw new GoError(`qualification anchor ${qualificationPath}#${anchor}: ${stat.text}`);
  if (stat.stat.kind === "directory") throw new GoError(`qualification anchor ${qualificationPath}#${anchor} points to a directory`);
  const read = p.files.readFile(absPath, READ_LIMITS.document);
  if ("error" in read) throw new GoError(`read qualification anchor ${qualificationPath}#${anchor}: ${read.error}`);
  if (!goContainsText(read.data, `{#${anchor}}`) && !goContainsText(read.data, `id="${anchor}"`)) {
    throw new GoError(`qualification anchor ${anchor} not found in ${qualificationPath}`);
  }
}

/** Go `designSlug`. */
function designSlug(explicitSlug: string, title: string): string {
  if (explicitSlug !== "") {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(explicitSlug)) throw new GoError(`slug ${goQuote(explicitSlug)} must use lowercase letters, numbers, and hyphens`);
    return explicitSlug;
  }
  const slug = goToLower(goTrimSpace(title)).replace(/[^a-z0-9]+/gu, "-").replace(/^-+/, "").replace(/-+$/, "");
  if (slug === "") throw new GoError("promote finding requires --slug when title cannot produce a slug");
  return slug;
}

/**
 * The folders of the legacy Make Docs layout (Make Docs 0.x, Go era): the
 * workflow, contract, template, and prompts under `docs/assets/`.
 */
const LEGACY_MAKE_DOCS_FOLDERS = ["system/docs/assets/references", "system/docs/assets/templates", "system/docs/assets/prompts"];

/** Where a design input was read: the Make Docs 2.0.9 layout, the legacy `docs/assets/` layout, or the router path both share. */
export type DesignInputSource = "make-docs-2.0.9" | "legacy" | "router";

/** One design input as read. `rel` is relative to the repository root, as messages show it. */
export interface DesignInput {
  label: string;
  rel: string;
  source: DesignInputSource;
  body: Uint8Array;
}

type InputKey = "router" | "workflow" | "contract" | "template" | "prompt";

/**
 * Go `requireDesignRouterInputs`, with the Make Docs 2.0.9 layout first
 * (W1 R7 P7 review round 1, P7-R1-05), and the inputs it read. Each input is
 * resolved in this order:
 *
 * 1. The Make Docs 2.0.9 location: a file under `.make-docs/system/`
 *    (`references/`, `contracts/`, `templates/`, or `prompts/`); the design
 *    router is `docs/designs/AGENTS.md` in both layouts. W1 R7 P7 review
 *    round 3 (P7-R3-05, P7-R3-06): when something is there, it decides. A
 *    body with text is used. An empty body stops the promotion (exit 3) with
 *    the "empty" message (`makeDocsInputStop`): Make Docs keeps a changed
 *    managed file, so its setup does not repair it. A body over
 *    `READ_LIMITS.makeDocsInput` stops it with the size message (exit 1),
 *    and any other read failure with its Go text (exit 1). There is no
 *    silent fall back to a legacy body. Only a missing entry (also a
 *    dangling link, or a folder at the name, as before) goes on.
 * 2. The legacy location under `docs/assets/`, with Go's exact error text,
 *    when the project has the legacy layout: one of
 *    `docs/assets/references/`, `templates/`, or `prompts/` is a folder
 *    (Go-era projects and the repository-layout goldens). In that layout the
 *    router is read as Go read it.
 * 3. Else promotion stops (exit 3) with the "missing" message.
 *
 * W1 R7 P7 review round 2 (P7-R2-02) and round 3 (P7-R3-03): every input is
 * read inside the project root (`GoFiles.readContained`), in every mode; a
 * link that leads out of the root is refused (exit 3). The one exception is
 * the router with `--allow-outside-root` when the designs folder, the write
 * destination, is itself a link out of the root (`readInWriteFolder`, edge
 * golden `design-designs-link-outside-allowed`).
 *
 * Promotion never starts `make-docs` itself. Paths are relative to the
 * BuildOS content root, so in the repository layout the 2.0.9 location is
 * `system/.make-docs/system/`.
 */
function requireDesignRouterInputs(p: Promotion, promptFile: string): Map<InputKey, DesignInput> {
  const required: [key: InputKey, label: string, legacy: string, current: string | undefined][] = [
    ["router", "design router", "system/docs/designs/AGENTS.md", undefined],
    ["workflow", "design workflow", "system/docs/assets/references/design-workflow.md", "system/.make-docs/system/references/design-workflow.md"],
    ["contract", "design contract", "system/docs/assets/references/design-contract.md", "system/.make-docs/system/contracts/design-contract.md"],
    ["template", "design template", "system/docs/assets/templates/design.md", "system/.make-docs/system/templates/design.md"],
    ["prompt", "next prompt", p.slashJoin("system/docs/assets/prompts", promptFile), p.slashJoin("system/.make-docs/system/prompts", promptFile)],
  ];
  const legacyLayout = LEGACY_MAKE_DOCS_FOLDERS.some((rel) => {
    const stat = p.files.stat(p.layout.path(rel));
    return stat.kind === "ok" && stat.stat.kind === "directory";
  });
  const inputs = new Map<InputKey, DesignInput>();
  for (const [key, label, legacy, current] of required) {
    const read = (rel: string) => (key === "router" ? p.files.readInWriteFolder(p.files.dir(p.layout.path(rel)), "AGENTS.md", READ_LIMITS.makeDocsInput) : p.files.readContained(p.layout.path(rel), READ_LIMITS.makeDocsInput));
    if (current !== undefined || !legacyLayout) {
      const rel = current ?? legacy;
      const displayPath = p.layout.rel(rel);
      const got = read(rel);
      if ("data" in got) {
        if (goTrimSpaceBytes(got.data).length === 0) throw makeDocsInputStop(p, label, displayPath, "empty");
        inputs.set(key, { label, rel: displayPath, source: current === undefined ? "router" : "make-docs-2.0.9", body: got.data });
        continue;
      }
      // P7-R3-06: an over-limit body stops here with the size message; it never falls back to a legacy body.
      if ("tooLarge" in got) throw new GoError(`read ${label} ${displayPath}: ${got.error}`);
      if (!got.notExist && got.errno !== "EISDIR") throw new GoError(`read ${label} ${displayPath}: ${got.error}`);
      if (!legacyLayout) throw makeDocsInputStop(p, label, displayPath, "missing");
    }
    const displayPath = p.layout.rel(legacy);
    const got = read(legacy);
    if ("error" in got) throw new GoError(`read ${label} ${displayPath}: ${got.error}`);
    if (goTrimSpaceBytes(got.data).length === 0) throw new GoError(`${label} ${displayPath} is empty`);
    inputs.set(key, { label, rel: displayPath, source: key === "router" ? "router" : "legacy", body: got.data });
  }
  return inputs;
}

/** UTF-8 text of a Make Docs input (bad bytes become U+FFFD). */
const utf8Text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** The Make Docs versions this BuildOS version's 2.0.9 form is for, as text. */
const MAKE_DOCS_RANGE_TEXT = MAKE_DOCS_RANGE;

/** The note for a copied or moved project, in the words Make Docs 2.0.9 uses (checked with Make Docs 2.0.9). */
const COPIED_PROJECT_NOTE = 'If this project folder was copied or moved, Make Docs stops that command with "Checkout identity needs a path choice." and gives its own next step; do that step first.';

/**
 * The plain stop for a Make Docs design input that is missing (`missing`)
 * or there but empty (`empty`) (exit 3). W1 R7 P7 review round 2 (P7-R2-03):
 * it reuses the rules and the command of `buildos init` and targets the
 * BuildOS content root (the root, or `<root>/system` in the repository
 * layout), the folder whose files the message names. Three cases:
 *
 * - The content root has an `AGENTS.md` or `CLAUDE.md` with no Make Docs
 *   section (`makeDocsForeignRouters`, as `buildos init` decides it): the
 *   pinned Make Docs version refuses to set up such a folder, so the message
 *   says so (`MAKE_DOCS_LIMIT`) and gives no command
 *   (`make_docs_setup_blocked`). This is the case after
 *   `buildos init --skip-make-docs`.
 * - Else, with `.make-docs/` there: Make Docs is set up. For a missing file,
 *   its setup command puts the file back (`make_docs_input_missing`). For an
 *   empty file (W1 R7 P7 review round 3, P7-R3-05), Make Docs 2.0.9 keeps a
 *   changed managed file: its setup exits 0 with `"status": "blocked"` and
 *   changes nothing. So the message says the file is empty, that BuildOS
 *   will not change it, and to delete it before the setup command, which
 *   then writes it again (`make_docs_input_empty`). Both were checked with
 *   Make Docs 2.0.9.
 * - Else: Make Docs is not set up, and its setup command sets it up
 *   (`make_docs_not_set_up`); an empty file there is deleted first too.
 *
 * In a copied or moved project, Make Docs 2.0.9 stops its setup with
 * "Checkout identity needs a path choice." (its checkout identity is in the
 * Make Docs Store, which BuildOS does not read), so the message says so
 * before the command (`COPIED_PROJECT_NOTE`) and does not promise the
 * command works there.
 *
 * The command is the one `buildos init` shows for a later setup
 * (`npxMakeDocsDisplay`: `npx` comes with Node.js, so it works with or
 * without a `make-docs` install), written for `sh`, or for Command Prompt on
 * Windows, as the message says.
 */
function makeDocsInputStop(p: Promotion, label: string, displayPath: string, state: "missing" | "empty"): InputError {
  const contentRoot = p.layout.systemRoot();
  const missing =
    state === "missing"
      ? `the Make Docs ${label} ${displayPath} is missing, so BuildOS cannot write the design.`
      : `the Make Docs ${label} ${displayPath} is empty, so BuildOS cannot write the design. Make Docs keeps a changed copy of a file it manages, and BuildOS does not change this file either.`;
  let foreign: string[];
  try {
    foreign = makeDocsForeignRouters(p.files.openPortAt(contentRoot));
  } catch (error) {
    if (!isCoreError(error)) throw error;
    foreign = ["AGENTS.md", "CLAUDE.md"];
  }
  const setUp = (() => {
    const stat = p.files.stat(p.files.join(contentRoot, ".make-docs"));
    return stat.kind === "ok" && stat.stat.kind === "directory";
  })();
  if (foreign.length > 0) {
    const files = foreign.map((name) => p.layout.rel(p.slashJoin(p.layout.installedRoot ? "" : "system", name))).join(" and ");
    const status = setUp ? "Make Docs cannot put its files back in this folder." : "Make Docs is not set up in this folder, and it cannot be set up here.";
    return new InputError(`${missing} ${status} ${MAKE_DOCS_LIMIT} This folder has such a file: ${files}. BuildOS changed nothing.`, {
      code: "make_docs_setup_blocked",
      correction: "With this Make Docs version, Make Docs cannot be set up in this folder. A newer Make Docs version may set it up; then run this command again.",
      root: p.layout.repoRoot,
    });
  }
  const setup = npxMakeDocsDisplay(contentRoot, p.files.osPlatform);
  const run = runWords(p.files.osPlatform, setup, "run this");
  const first = state === "empty" ? `delete ${displayPath}, then ` : "";
  const [status, todo, code] =
    state === "empty"
      ? [setUp ? "" : "Make Docs is not set up in this folder.", "To get the Make Docs file back", "make_docs_input_empty"]
      : setUp
        ? ["Make Docs is set up in this folder, but this file is missing.", "To put the Make Docs files back", "make_docs_input_missing"]
        : ["Make Docs is not set up in this folder.", "To set up Make Docs", "make_docs_not_set_up"];
  const steps = `${todo}, ${first}${run}, then run this command again: ${setup}`;
  return new InputError(`${missing} ${status === "" ? "" : `${status} `}${setUp ? `${COPIED_PROJECT_NOTE} ` : ""}${steps}`, {
    code,
    correction: steps,
    root: p.layout.repoRoot,
  });
}

/** Go `relativeDesignLink`. */
function relativeDesignLink(p: Promotion, designRelPath: string, target: string): string {
  const platform = p.files.platform;
  const cut = target.indexOf("#");
  const pathPart = cut === -1 ? target : target.slice(0, cut);
  const rel = goToSlash(goRel(goDir(goFromSlash(designRelPath, platform), platform), goFromSlash(pathPart, platform), platform) ?? pathPart, platform);
  return cut === -1 ? rel : `${rel}#${target.slice(cut + 1)}`;
}

/** The Go text of each section `renderDesign` writes, and the follow-on values. `routerPath` is the router folder as the text names it. */
function designParts(p: Promotion, route: string, row: FindingRow, designRelPath: string, routerPath: string): { sections: Map<string, string>; why: string; handoff: string } {
  const id = text(row, "id");
  let context = "";
  context += `- Finding: [${id}](${relativeDesignLink(p, designRelPath, p.slashJoin(text(row, "path"), "finding.md"))})\n`;
  context += `- Origin run: \`${text(row, "origin_run")}\`\n`;
  context += `- Qualification: [${text(row, "qualification_test")}](${relativeDesignLink(p, designRelPath, text(row, "qualification_test"))})\n`;
  context += `- Raw anchor: [${text(row, "raw_anchor")}](${relativeDesignLink(p, designRelPath, text(row, "raw_anchor"))})\n`;
  context += `- Systems: ${inlineList(list(row, "systems"))}\n`;
  context += `- Environments: ${inlineList(list(row, "environments"))}\n`;
  context += `- Owners: ${inlineList(list(row, "owners"))}\n`;
  if (goTrimSpace(text(row, "summary")) !== "") context += `\n${text(row, "summary")}\n`;
  if (goTrimSpace(text(row, "observed")) !== "") context += `\n${text(row, "observed")}\n`;
  const sections = new Map<string, string>([
    ["Purpose", `Capture the design hand-off for qualified finding \`${id}\` so planning can proceed from repeatable evidence.\n`],
    ["Context", context],
    [
      "Decision",
      "Use this design as the make-docs-routed follow-on artifact for the qualified finding. The finding remains the evidence-backed observation; this design owns solution framing, tradeoffs, and downstream planning context.\n",
    ],
    [
      "Alternatives Considered",
      `- Auto-promoting qualified findings was rejected because design promotion must remain user-gated.\n- Writing outside the \`${routerPath}\` router was rejected because Build OS must preserve the make-docs boundary.\n`,
    ],
    [
      "Consequences",
      "- The promoted design carries finding lineage, qualification evidence, configured scope, and owner metadata into the planning path.\n- The source finding now records this design in its `designs` list for traceability.\n- Stage-mover automation remains a later concern.\n",
    ],
  ]);
  return route === "baseline-plan"
    ? { sections, why: "This design should feed a fresh baseline planning flow for the promoted finding.", handoff: "not applicable for baseline planning." }
    : { sections, why: "This design should feed additive planning from qualified evidence into the active Build OS planning path.", handoff: "unresolved; planner must resolve before writing." };
}

/** Go `renderDesign`: the legacy form, byte for byte. */
function renderDesign(p: Promotion, title: string, route: string, promptFile: string, row: FindingRow, designRelPath: string): string {
  const { sections, why, handoff } = designParts(p, route, row, designRelPath, "system/docs/designs/");
  let out = `# ${title}\n\n`;
  for (const heading of ["Purpose", "Context", "Decision", "Alternatives Considered", "Consequences"]) out += `## ${heading}\n\n${sections.get(heading)!}\n`;
  out += "## Intended Follow-On\n\n";
  out += `- Route: \`${route}\`\n`;
  out += `- Next Prompt: [${promptFile}](../assets/prompts/${promptFile})\n`;
  out += `- Why: ${why}\n`;
  out += `- Coordinate Handoff: ${handoff}\n`;
  return out;
}

/**
 * W1 R7 P7 Stage 6 (t20, PE-020): the design in the Make Docs 2.0.9 form,
 * built from the project's template and checked against its contract
 * (`renderMakeDocsDesign`). The router is `docs/designs/`, and the Next
 * Prompt link leads to the prompt file promotion read. A template or
 * contract this version does not know stops the promotion (exit 3) before
 * any write.
 */
function renderMakeDocsForm(p: Promotion, title: string, route: string, promptFile: string, row: FindingRow, designRelPath: string, inputs: ReadonlyMap<InputKey, DesignInput>): string {
  const template = inputs.get("template")!;
  const contract = inputs.get("contract")!;
  const prompt = inputs.get("prompt")!;
  const { sections, why, handoff } = designParts(p, route, row, designRelPath, "docs/designs/");
  try {
    return renderMakeDocsDesign(
      utf8Text(template.body),
      utf8Text(contract.body),
      {
        title,
        route,
        promptFile,
        promptLink: relativeDesignLink(p, designRelPath, prompt.rel),
        why,
        coordinateHandoff: handoff,
        sections,
      },
      (frontmatter) => parseYamlSubset(frontmatter, designRelPath),
    );
  } catch (error) {
    if (error instanceof DesignSelfCheckError) return failSelfCheck(p, designRelPath, error.message);
    if (!(error instanceof DesignFormError)) throw error;
    return failForm(p, template.rel, error.message);
  }
}

/** W1 R7 P7 review round 4 (P7-R4-04, P7-R4-05): the design BuildOS made did not read back; nothing is written (exit 3). */
function failSelfCheck(p: Promotion, designRel: string, reason: string): never {
  throw new InputError(
    `the design BuildOS made for ${designRel} did not pass its own check (${reason}), so BuildOS wrote nothing. This is a BuildOS fault; the finding is unchanged.`,
    { code: "design_self_check_failed", correction: "Report this to the BuildOS maintainers with the finding title. As a workaround, pass a plain --title.", root: p.layout.repoRoot },
  );
}

function failForm(p: Promotion, templateRel: string, reason: string): never {
  throw new InputError(
    `the Make Docs design template ${templateRel} has a form this BuildOS version does not know (${reason}), so BuildOS cannot write the design. BuildOS changed nothing. Use the BuildOS version that matches your Make Docs version, or put back the Make Docs ${MAKE_DOCS_RANGE_TEXT} template.`,
    { code: "make_docs_design_form_unknown", correction: `Use the BuildOS version that matches your Make Docs version, or put back the Make Docs ${MAKE_DOCS_RANGE_TEXT} template, then run this command again.`, root: p.layout.repoRoot },
  );
}

/** Go `designList`, in the one-char-per-byte form. */
function designList(p: Promotion, designs: readonly string[], findingRelPath: string): string {
  if (designs.length === 0) return "No design hand-off recorded.\n";
  const platform = p.files.platform;
  let out = "";
  for (const design of designs) {
    const rel = goRel(goFromSlash(findingRelPath, platform), goFromSlash(design, platform), platform) ?? design;
    out += bin(`- [${design}](${goToSlash(rel, platform)})\n`);
  }
  return out;
}

/** Go `replaceDesignsSection`, on bytes: only the `## Designs` section changes. */
function replaceDesignsSection(p: Promotion, record: Uint8Array, designs: readonly string[], findingRelPath: string): Uint8Array {
  let content = latin1(record);
  const marker = "## Designs";
  const start = content.indexOf(marker);
  if (start === -1) {
    content = content.replace(/\n+$/, "");
    if (content !== "") content += "\n\n";
    return fromLatin1(`${content}${marker}\n\n${designList(p, designs, findingRelPath)}`);
  }
  const afterStart = start + marker.length;
  const next = content.slice(afterStart).indexOf("\n## ");
  const end = next === -1 ? content.length : afterStart + next;
  let replacement = `${marker}\n\n${designList(p, designs, findingRelPath)}`;
  if (end < content.length && !replacement.endsWith("\n\n")) replacement += "\n";
  return fromLatin1(content.slice(0, start) + replacement + content.slice(end));
}

/** Go `PromoteFinding`. */
export function promoteFinding(context: DesignContext, opts: PromoteFindingOptions): PromoteFindingResult {
  const p = new Promotion(context, opts.repoRoot);
  const { layout, files, hooks } = p;
  if (goTrimSpace(opts.findingId) === "") throw new GoError("promote finding requires --finding-id");
  const route = goTrimSpace(opts.route);
  const promptFile = ALLOWED_ROUTES.get(route);
  if (promptFile === undefined) throw new GoError("promote finding requires --route baseline-plan or change-plan");

  const findingsIndexPath = layout.path("system/.os/data/findings.jsonl");
  const resolution = resolveFinding(p, goTrimSpace(opts.findingId));
  const { rows, target } = readFindingRows(p, findingsIndexPath, resolution.canonicalId);
  normalizeFindingRow(p, rows[target]!);
  const row = rows[target]!;
  const id = text(row, "id");
  if (text(row, "status") !== "qualified") throw new GoError(`finding ${id} status is ${goQuote(text(row, "status"))}; promote finding requires qualified`);
  const qualification = goTrimSpace(text(row, "qualification_test"));
  const cut = qualification.indexOf("#");
  const qualificationPath = cut === -1 ? qualification : qualification.slice(0, cut);
  const qualificationAnchor = cut === -1 ? "" : qualification.slice(cut + 1);
  if (cut === -1 || goTrimSpace(qualificationPath) === "" || goTrimSpace(qualificationAnchor) === "") throw new GoError(`finding ${id} is missing a qualification anchor`);
  validateQualificationAnchor(p, qualificationPath, qualificationAnchor);
  if (text(row, "path") === "") throw new GoError(`finding ${id} is missing path`);

  let title = goTrimSpace(opts.title);
  if (title === "") title = goTrimSpace(text(row, "title"));
  if (title === "") title = `Design for ${id}`;
  const slug = designSlug(opts.slug, title);
  const designRelPath = layout.rel(p.slashJoin("system/docs/designs", `${goLocalDate(p.now())}-${slug}.md`));
  const designPath = layout.path(designRelPath);
  const existing = files.stat(designPath);
  if (existing.kind === "ok") throw new GoError(`design target ${designRelPath} already exists`);
  if (existing.kind === "failed") throw new GoError(existing.text);
  if (rows.some((r) => (list(r, "designs") ?? []).some((d) => layout.rel(d) === designRelPath))) {
    throw new GoError(`design target ${designRelPath} is already referenced by a finding`);
  }
  const inputs = requireDesignRouterInputs(p, promptFile);

  const updated: FindingRow = { ...row, fields: { ...row.fields }, dirty: true };
  updated.fields["designs"] = uniqueStrings([...(list(row, "designs") ?? []), designRelPath]);
  updated.fields["related"] = uniqueStrings([...(list(row, "related") ?? []), designRelPath]);
  updated.fields["updated_at"] = goRfc3339Utc(p.now());
  // W1 R7 P7 Stage 6 (PE-020): the form follows the template that promotion read. A template from the Make Docs 2.0.9 layout gives the 2.0.9 form; a legacy template keeps Go's bytes.
  const design = inputs.get("template")!.source === "make-docs-2.0.9" ? renderMakeDocsForm(p, title, route, promptFile, updated, designRelPath, inputs) : renderDesign(p, title, route, promptFile, updated, designRelPath);
  const findingRecordPath = layout.path(p.slashJoin(text(row, "path"), "finding.md"));
  const recordRead = files.readFile(findingRecordPath, READ_LIMITS.document);
  if ("error" in recordRead) throw new GoError(`read finding record: ${recordRead.error}`);
  const findingRecord = recordRead.data;
  const updatedRecord = replaceDesignsSection(p, findingRecord, list(updated, "designs") ?? [], text(row, "path"));

  const result: PromoteFindingResult = {
    findingId: id,
    requestedFindingId: resolution.requestedId,
    canonicalFindingId: resolution.canonicalId,
    redirectChain: resolution.chain,
    designPath: designRelPath,
    findingPath: text(row, "path"),
    findingsIndexPath: layout.rel("system/.os/data/findings.jsonl"),
    designContent: design,
    dryRun: opts.dryRun,
    repoRoot: files.repoRoot,
  };
  // P7-R3-04: the findings index and the finding record are read back (the next promotion, discovery), so each must stay within its read bound. A dry run reports it too.
  const updatedIndex = marshalFindingRows(rows.map((r, i) => (i === target ? updated : r)));
  checkReadBack(result.findingsIndexPath, updatedIndex.length, READ_LIMITS.data, files.repoRoot);
  // P7-R4-02: the next promotion and discovery read the index line by line (64 KiB a line), so every row must still fit in one line.
  checkRowsReadBack(result.findingsIndexPath, updatedIndex, JSONL_ROW_LIMITS.scanner, files.repoRoot);
  checkReadBack(layout.rel(p.slashJoin(text(row, "path"), "finding.md")), updatedRecord.length, READ_LIMITS.document, files.repoRoot);
  if (opts.dryRun) return result;

  rows[target] = updated;
  const originalRead = files.readFile(findingsIndexPath, READ_LIMITS.data);
  if ("error" in originalRead) throw new GoError(`read findings index for rollback: ${originalRead.error}`);
  const originalIndex = originalRead.data;
  // PE-012: a refusal of any write folder comes before the first write.
  files.preflightWrites([findingsIndexPath, findingRecordPath, designPath]);
  files.mkdirAll(files.dir(designPath));
  /**
   * Runs one write step. A Go error returns its text. A typed refusal or
   * failure of the port (which Go never makes) returns it as `refused`, so the
   * caller rolls back as for a Go error and then rethrows it unchanged.
   */
  const attempt = (action: () => void): { text: string; refused?: unknown } | undefined => {
    try {
      action();
      return undefined;
    } catch (error) {
      if (error instanceof GoError) return { text: error.message };
      if (isCoreError(error)) return { text: error.message, refused: error };
      throw error;
    }
  };
  const fail = (failure: { text: string; refused?: unknown }, message: string): never => {
    if (failure.refused !== undefined) throw failure.refused;
    throw new GoError(message);
  };
  /*
   * P5 review round 2: each entry is restored to exactly what it was (a
   * regular file with its bytes and mode, or a symlink with its target text)
   * whenever its replacement landed, also when the step failed after its
   * rename (a folder flush). Go rolls back only the replacements of the
   * earlier steps, and with Go's `replaceExistingFile`, which turns a
   * symlink into a regular file; Go also keeps the replacement of a step
   * that fails after its rename. Here every failure ends in the state before
   * the command, which Go also ends in when the design creation fails on
   * regular files. The error text is Go's.
   *
   * Review round 3: a restored symlink also gets its own original mode back
   * where the OS keeps link modes (macOS), whatever the umask; a restored
   * regular file gets its original mode through the replace's `fchmod`, which
   * the umask does not change.
   *
   * W1 R7 P5 fix: a restored regular file gets its full original mode, with
   * the setuid, setgid, and sticky bits (`mode & 0o7777`), recorded here
   * before the first write. Go's rollback replaces it with
   * `Chmod(info.Mode().Perm())` and drops them; here the file ends as it
   * was (PE-014).
   */
  const linkOf = (path: string) => {
    const link = files.link(path);
    const stat = link === undefined ? files.stat(path) : undefined;
    return { link: link?.target, linkMode: link?.mode, fileMode: stat?.kind === "ok" ? stat.stat.fullMode : undefined };
  };
  const originals = [
    { path: findingsIndexPath, ...linkOf(findingsIndexPath), data: originalIndex },
    { path: findingRecordPath, ...linkOf(findingRecordPath), data: findingRecord },
  ];
  /** True when the entry at `original.path` is no longer the original: its replacement landed. */
  const landed = (original: (typeof originals)[number]): boolean => {
    const link = files.linkText(original.path);
    if (original.link !== undefined || link !== undefined) return link !== original.link;
    const now = files.readFile(original.path, READ_LIMITS.data);
    return "error" in now || !bytesEqual(now.data, original.data);
  };
  const restore = (original: (typeof originals)[number]) =>
    attempt(() => (original.link !== undefined ? files.restoreLink(original.path, original.link, original.linkMode) : hooks.replaceExistingFile(files, original.path, original.data, original.fileMode)));
  /** Restores the entries whose replacement landed, last first (Go's order); the rollback error of each, last first, or `undefined`. */
  const rollBack = (replaced: readonly (typeof originals)[number][]) => [...replaced].reverse().map((original) => (landed(original) ? restore(original) : undefined));

  const indexError = attempt(() => hooks.replaceExistingFile(files, findingsIndexPath, updatedIndex));
  if (indexError !== undefined) {
    const [rollbackIndex] = rollBack([originals[0]!]);
    if (rollbackIndex !== undefined) fail(indexError, `replace findings index: ${indexError.text}; rollback findings index: ${rollbackIndex.text}`);
    fail(indexError, `replace findings index: ${indexError.text}`);
  }
  const recordError = attempt(() => hooks.replaceExistingFile(files, findingRecordPath, updatedRecord));
  if (recordError !== undefined) {
    const [rollbackRecord, rollbackIndex] = rollBack(originals);
    if (rollbackRecord !== undefined) {
      fail(recordError, `replace finding record: ${recordError.text}; rollback finding record: ${rollbackRecord.text}; rollback findings index: ${rollbackIndex?.text ?? "<nil>"}`);
    }
    if (rollbackIndex !== undefined) fail(recordError, `replace finding record: ${recordError.text}; rollback findings index: ${rollbackIndex.text}`);
    fail(recordError, `replace finding record: ${recordError.text}`);
  }
  // The create step removes its own file when a step after the open fails, as Go's syncNewFile.
  const createError = attempt(() => hooks.createExclusiveFile(files, designPath, utf8(design)));
  if (createError !== undefined) {
    const [rollbackRecord, rollbackIndex] = rollBack(originals);
    if (rollbackRecord !== undefined || rollbackIndex !== undefined) {
      fail(createError, `create design: ${createError.text}; rollback finding record: ${rollbackRecord?.text ?? "<nil>"}; rollback findings index: ${rollbackIndex?.text ?? "<nil>"}`);
    }
    fail(createError, `create design: ${createError.text}`);
  }
  return result;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The line Go's `main` prints. */
export function formatPromoteOutput(result: PromoteFindingResult): string {
  return `${result.dryRun ? "would write" : "wrote"} ${result.designPath} (requested=${result.requestedFindingId} canonical=${result.canonicalFindingId} chain=${goSprintStrings(result.redirectChain)})\n`;
}

export { GoError };
