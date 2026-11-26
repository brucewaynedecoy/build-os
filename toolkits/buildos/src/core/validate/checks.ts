/**
 * The checks of `buildos validate`, on values already read and parsed
 * ([PRD 13 buildos validate checks](../../../../../docs/prd/13-adopter-owned-config-surface.md#buildos-validate-checks)).
 *
 * Each check is a port of the removed legacy validator
 * (`validate_config.py`), in the same order and with the same findings,
 * except where PRD 13 states another rule. Each such difference is a
 * deliberate divergence, recorded in the W1 R7 P7 evidence and in
 * `test/golden/validate/divergences.json`, and marked `PRD 13` below.
 *
 * A finding has a stable `code` and a `field` (the subject: the config
 * field, the frontmatter field, or `line N.<field>` of a data file). Parity
 * with the legacy script is checked on (code, path, field, detail), never on
 * the message, so a message can be plainer than the script's.
 */

import { parseYamlSubset, pyStrip, YamlSubsetError, type YamlMapping, type YamlValue } from "./yaml-subset.ts";

export interface ValidateFinding {
  /** Stable category, for example `unknown_id`. */
  code: string;
  /** Project-relative path with `/`, for example `.os/config/instance.yaml`. */
  path: string;
  /** The subject inside the file, for example `systems[0].id` or `line 3.status`. */
  field: string;
  /** Plain words for a person. Not part of the stable contract. */
  message: string;
  /** The exact value the finding is about, when one helps: an unknown ID, a missing contract term. */
  detail?: string;
}

export const SCOPED_FIELDS = ["systems", "environments", "owners"] as const;
export const LEGACY_SCOPED_FIELDS = ["env", "for", "envs", "target_systems"] as const;
export const CONTRACT_TERMS = [
  "version",
  "instance",
  "systems",
  "environments",
  "owners",
  "defaults",
  "environments[].systems",
  "defaults.systems",
  "defaults.environments",
  "defaults.owners",
] as const;

/** Each canonical entity file under `.os/data/`, with its row `type` and ID prefix, in the legacy order. */
export const ENTITY_FILE_SPECS: readonly (readonly [file: string, type: string, prefix: string])[] = [
  ["requirements.jsonl", "requirement", "REQ"],
  ["capabilities.jsonl", "capability", "CAP"],
  ["personas.jsonl", "persona", "PER"],
  ["test-cases.jsonl", "test-case", "TC"],
  ["results.jsonl", "result", "RES"],
  ["runs.jsonl", "run", "RUN"],
  ["findings.jsonl", "finding", "FIND"],
  ["extractions.jsonl", "extraction", "EXT"],
];

/** The common lifecycle vocabulary (PRD 08). */
export const LIFECYCLE_STATUSES = ["draft", "active", "superseded", "archived"] as const;
/** Entity-specific states (PRD 13, PRD 17): legal only for their own type. The legacy script rejected them. */
export const TYPE_STATUSES: Readonly<Record<string, readonly string[]>> = { finding: ["qualified"], run: ["running", "closed", "aborted"] };

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const ENTITY_ID_RE = /^(REQ|CAP|PER|TC|RES|RUN|FIND|EXT|PB)-[0-9]{3,}$/;
/**
 * PRD 13 (W1 R7 P7 review round 1, P7-R1-03): the RFC 3339 UTC profile.
 * `YYYY-MM-DDTHH:MM:SS`, an optional `.` and one or more fraction digits,
 * then `Z`. ASCII digits, uppercase `T` and `Z`. No basic format, no comma
 * fraction, no offset, no missing seconds. `isRealTime` checks the calendar.
 */
const UTC_DATETIME_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]+))?Z$/;
/** One valid `extracted_at`, shown in every datetime finding. */
export const UTC_DATETIME_EXAMPLE = "2026-01-31T09:30:00Z";

/**
 * Reserved scoped values (PRD 13 Scoped vocabulary, P7-R1-02). A scoped
 * field never holds one, even when the config defines it as an ID, and the
 * config may not define one as an ID. `both` is the one sentinel that PRD 13
 * names and the one the legacy `env` and `for` fields used.
 */
export const RESERVED_SCOPED_VALUES: readonly string[] = ["both"];

export interface ConfigIndex {
  systems: ReadonlySet<string>;
  environments: ReadonlySet<string>;
  owners: ReadonlySet<string>;
}

export const EMPTY_INDEX: ConfigIndex = { systems: new Set(), environments: new Set(), owners: new Set() };

/**
 * Collects findings in order, up to `limit` (P7-R1-07: the budget is kept
 * here, so no check builds more findings than the limit). A finding past the
 * limit is dropped and sets `truncated`.
 */
export class Findings {
  readonly list: ValidateFinding[] = [];
  readonly limit: number;
  truncated = false;
  constructor(limit = Number.POSITIVE_INFINITY) {
    this.limit = limit;
  }
  /**
   * True while another finding fits. A check calls it only when it has more
   * to check, so a false answer means work was left: `truncated` is set.
   */
  room(): boolean {
    if (this.list.length < this.limit) return true;
    this.truncated = true;
    return false;
  }
  add(code: string, path: string, field: string, message: string, detail?: string): void {
    if (!this.room()) {
      this.truncated = true;
      return;
    }
    this.list.push(detail === undefined ? { code, path, field, message } : { code, path, field, message, detail });
  }
}

// ------------------------------------------------------------------ contract

/** The config contract names every schema term. */
export function checkContractText(out: Findings, path: string, text: string): void {
  for (const term of CONTRACT_TERMS) {
    if (!text.includes(term)) out.add("contract_term_missing", path, "contract", `The config contract does not name the term "${term}".`, term);
  }
}

// -------------------------------------------------------------------- config

/** Parses the config text and checks it. Returns the configured IDs for the later checks. */
export function checkConfigText(out: Findings, path: string, text: string): ConfigIndex {
  let data: YamlValue;
  try {
    data = parseYamlSubset(text, path);
  } catch (error) {
    if (!(error instanceof YamlSubsetError)) throw error;
    out.add("config_parse", path, "config", `BuildOS cannot read this file: ${error.message}.`);
    return EMPTY_INDEX;
  }
  return checkConfigData(out, path, data);
}

export function checkConfigData(out: Findings, path: string, data: YamlValue): ConfigIndex {
  if (!isMapping(data)) {
    out.add("config_not_mapping", path, "config", "The config file must hold a mapping of fields (for example `version: 1`).");
    return EMPTY_INDEX;
  }
  // PRD 13: a boolean is not an integer. (Python's bool is an int, so the legacy script accepted `version: true`.)
  const version = data.get("version");
  // P7-R1-12: an integer past 2^53 is a bigint and keeps its exact value.
  if (typeof version !== "bigint" && (typeof version !== "number" || !Number.isInteger(version))) out.add("version_not_integer", path, "version", "`version` must be a whole number, such as 1.");

  const instance = data.get("instance");
  if (!isMapping(instance)) {
    out.add("not_mapping", path, "instance", "`instance` must be a mapping with `id` and `name`.");
  } else {
    requireString(out, path, instance, "instance.id");
    requireString(out, path, instance, "instance.name");
    checkSlug(out, path, instance.get("id"), "instance.id");
  }

  const systemIds = checkCollection(out, path, data, "systems", ["id", "name", "description"]);
  const environmentIds = checkCollection(out, path, data, "environments", ["id", "name", "systems", "description"]);
  const ownerIds = checkCollection(out, path, data, "owners", ["id", "name", "kind"]);

  const environments = data.get("environments");
  if (Array.isArray(environments)) {
    // P7-R2-06: a breakable loop, so no entry is visited once the findings budget is spent.
    for (const [index, environment] of environments.entries()) {
      if (!out.room()) break;
      if (!isMapping(environment)) continue;
      const field = `environments[${index}].systems`;
      const systems = environment.get("systems");
      if (!Array.isArray(systems)) {
        out.add("not_list", path, field, "Each environment's `systems` must be a list of configured system IDs.");
        continue;
      }
      checkReferences(out, path, systems, systemIds, field);
    }
  }

  // PRD 13: `defaults` is optional, and so is each of its lists. The legacy
  // script required all four. A key that is present (also with no value)
  // must have the right shape.
  if (data.has("defaults")) {
    const defaults = data.get("defaults");
    if (!isMapping(defaults)) {
      out.add("not_mapping", path, "defaults", "`defaults` must be a mapping of lists, or be left out.");
    } else {
      checkDefaultList(out, path, defaults, "systems", systemIds);
      checkDefaultList(out, path, defaults, "environments", environmentIds);
      checkDefaultList(out, path, defaults, "owners", ownerIds);
    }
  }
  return { systems: systemIds, environments: environmentIds, owners: ownerIds };
}

function checkCollection(out: Findings, path: string, data: YamlMapping, name: string, required: readonly string[]): Set<string> {
  const items = data.get(name);
  const ids = new Set<string>();
  if (!Array.isArray(items)) {
    out.add("not_list", path, name, `\`${name}\` must be a list.`);
    return ids;
  }
  const seen = new Map<string, number>();
  for (const [index, item] of items.entries()) {
    if (!out.room()) break;
    const prefix = `${name}[${index}]`;
    if (!isMapping(item)) {
      out.add("not_mapping", path, prefix, `Each entry in \`${name}\` must be a mapping with its own fields.`);
      continue;
    }
    for (const field of required) {
      if (!item.has(field)) out.add("required", path, `${prefix}.${field}`, `\`${field}\` is required.`);
    }
    const id = item.get("id");
    if (typeof id === "string") {
      checkSlug(out, path, id, `${prefix}.id`);
      // P7-R1-02: a reserved sentinel can never be used in a scoped field, so it is not a valid ID either.
      if (RESERVED_SCOPED_VALUES.includes(id)) out.add("reserved_id", path, `${prefix}.id`, `"${id}" is a reserved value and cannot be a configured ID. Choose another ID, such as primary-${name === "systems" ? "system" : name === "environments" ? "environment" : "team"}.`, id);
      const first = seen.get(id);
      if (first !== undefined) {
        out.add("duplicate_id", path, `${prefix}.id`, `The ID "${id}" is already used by ${name}[${first}].`, id);
      } else {
        seen.set(id, index);
        ids.add(id);
      }
    } else {
      out.add("not_string", path, `${prefix}.id`, "`id` must be text.");
    }
    if (name === "owners" && item.has("kind")) {
      const kind = item.get("kind");
      // PRD 13: `kind` is a string slug. The legacy script skipped a `kind` that was not text.
      if (typeof kind === "string") checkSlug(out, path, kind, `${prefix}.kind`);
      else out.add("not_string", path, `${prefix}.kind`, "`kind` must be text, such as `team`.");
    }
  }
  return ids;
}

function requireString(out: Findings, path: string, mapping: YamlMapping, field: string): void {
  const key = field.slice(field.lastIndexOf(".") + 1);
  if (typeof mapping.get(key) !== "string") out.add("not_string", path, field, `\`${field}\` must be text.`);
}

function checkSlug(out: Findings, path: string, value: YamlValue | undefined, field: string): void {
  if (typeof value === "string" && !SLUG_RE.test(value)) {
    out.add("not_slug", path, field, `"${value}" must be a stable slug: lowercase letters, digits, and hyphens, starting with a letter or digit.`, value);
  }
}

function checkDefaultList(out: Findings, path: string, defaults: YamlMapping, name: string, allowed: ReadonlySet<string>): void {
  if (!defaults.has(name)) return;
  const values = defaults.get(name);
  const field = `defaults.${name}`;
  if (!Array.isArray(values)) {
    out.add("not_list", path, field, `\`${field}\` must be a list, or be left out.`);
    return;
  }
  checkReferences(out, path, values, allowed, field);
}

/** Each value is a configured ID. Shared by the config, frontmatter, and data checks. */
export function checkReferences(out: Findings, path: string, values: readonly unknown[], allowed: ReadonlySet<string>, field: string): void {
  for (let index = 0; index < values.length && out.room(); index++) {
    const value = values[index];
    const itemField = `${field}[${index}]`;
    if (typeof value !== "string") out.add("ref_not_string", path, itemField, "Each entry must be a configured ID written as text.");
    // PRD 13 and P7-R1-02: a reserved sentinel fails whether or not the config defines it.
    else if (RESERVED_SCOPED_VALUES.includes(value)) out.add("sentinel_value", path, itemField, `"${value}" is a reserved value, not an ID. List each configured ID instead.`, value);
    else if (!allowed.has(value)) out.add("unknown_id", path, itemField, `"${value}" is not a configured ID in .os/config/instance.yaml.`, value);
  }
}

// --------------------------------------------------------------- frontmatter

/**
 * The frontmatter text of a Markdown file, or `undefined` when the file has
 * none: its first line is `---` and a later line is `---` (each stripped).
 * Lines are split as Python's `str.splitlines`.
 */
export function extractFrontmatter(lines: readonly string[]): string | undefined {
  if (lines.length === 0 || pyStrip(lines[0]!) !== "---") return undefined;
  for (let index = 1; index < lines.length; index++) {
    if (pyStrip(lines[index]!) === "---") return lines.slice(1, index).join("\n");
  }
  return undefined;
}

/** Checks one file's frontmatter text (PRD 13 Frontmatter hygiene). Callable on its own. */
export function checkFrontmatterText(out: Findings, path: string, text: string, index: ConfigIndex): void {
  let data: YamlValue;
  try {
    data = parseYamlSubset(text, path);
  } catch (error) {
    if (!(error instanceof YamlSubsetError)) throw error;
    out.add("frontmatter_parse", path, "frontmatter", `BuildOS cannot read the frontmatter: ${error.message}.`);
    return;
  }
  if (!isMapping(data)) {
    out.add("not_mapping", path, "frontmatter", "The frontmatter must be a mapping of fields.");
    return;
  }
  for (const field of LEGACY_SCOPED_FIELDS) {
    if (data.has(field)) out.add("legacy_scoped_field", path, field, `\`${field}\` is an old scoped field and is not allowed. Use systems, environments, and owners.`, field);
  }
  for (const field of SCOPED_FIELDS) {
    const values = data.get(field);
    if (values === undefined || values === null) {
      out.add("scoped_field_required", path, field, `\`${field}\` is required in scoped frontmatter. Use an empty list ([]) when it does not apply.`);
      continue;
    }
    if (!Array.isArray(values)) {
      out.add("not_list", path, field, `\`${field}\` must be a list.`);
      continue;
    }
    checkReferences(out, path, values, index[field], field);
  }
}

// ------------------------------------------------------------- entity data

/**
 * Checks one entity data file, line by line. `lines` may be a lazy iterable
 * (P7-R1-07: the file is never split into an array); the loop stops when the
 * findings budget is spent.
 */
export function checkEntityLines(out: Findings, path: string, lines: Iterable<string>, type: string, prefix: string, index: ConfigIndex): void {
  const seenIds = new Map<string, number>();
  let lineNumber = 0;
  for (const raw of lines) {
    if (!out.room()) return;
    lineNumber++;
    const lineField = `line ${lineNumber}`;
    if (pyStrip(raw) === "") {
      out.add("blank_line", path, lineField, "Blank lines are not allowed in a data file. Remove the empty line.");
      continue;
    }
    const tooDeep = jsonNestingTooDeep(raw);
    if (tooDeep) {
      out.add("invalid_json", path, lineField, `This line is not valid JSON: it nests more than ${JSON_MAX_DEPTH} levels deep.`);
      continue;
    }
    let row: unknown;
    try {
      row = JSON.parse(raw);
    } catch (error) {
      out.add("invalid_json", path, lineField, `This line is not valid JSON (${error instanceof Error ? error.message : String(error)}).`);
      continue;
    }
    if (!isPlainObject(row)) {
      out.add("not_object", path, lineField, "Each line must be one JSON object ({...}).");
      continue;
    }
    const id = own(row, "id");
    if (typeof id === "string") {
      const first = seenIds.get(id);
      if (first !== undefined) out.add("duplicate_id", path, `${lineField}.id`, `The ID "${id}" is already used on line ${first}.`, id);
      else seenIds.set(id, lineNumber);
    }
    checkEntityRow(out, path, lineNumber, row, type, prefix, index);
  }
}

function checkEntityRow(out: Findings, path: string, lineNumber: number, row: Record<string, unknown>, type: string, prefix: string, index: ConfigIndex): void {
  const base = `line ${lineNumber}`;
  if (own(row, "type") !== type) out.add("wrong_type", path, `${base}.type`, `\`type\` must be "${type}" in this file.`, type);

  const id = own(row, "id");
  if (!isNonEmptyString(id) || !new RegExp(`^${prefix}-[0-9]{3,}$`).test(id)) {
    out.add("bad_id_prefix", path, `${base}.id`, `\`id\` must look like ${prefix}-001 (${prefix}, a hyphen, and at least three digits).`, prefix);
  }

  // PRD 13: the common vocabulary, or a state that this entity type allows.
  const allowed = [...LIFECYCLE_STATUSES, ...(TYPE_STATUSES[type] ?? [])];
  const status = own(row, "status");
  const statusValid = typeof status === "string" && allowed.includes(status);
  if (!statusValid) out.add("bad_status", path, `${base}.status`, `\`status\` must be one of: ${[...allowed].sort().join(", ")}.`);

  checkAnchor(out, path, own(row, "source_anchor"), `${base}.source_anchor`, { required: true, under: type === "extraction" ? "assets/" : undefined });

  const docAnchor = own(row, "doc_anchor");
  if (statusValid && status !== "draft") {
    checkAnchor(out, path, docAnchor, `${base}.doc_anchor`, { required: true, under: "docs/" });
  } else if (Object.hasOwn(row, "doc_anchor") && docAnchor !== null) {
    checkAnchor(out, path, docAnchor, `${base}.doc_anchor`, { required: false, under: "docs/" });
  }

  for (const field of SCOPED_FIELDS) {
    if (!Object.hasOwn(row, field)) continue;
    const values = row[field];
    const itemField = `${base}.${field}`;
    if (!Array.isArray(values)) {
      out.add("not_list", path, itemField, `\`${field}\` must be a list.`);
      continue;
    }
    checkReferences(out, path, values, index[field], itemField);
  }
  // PRD 13 Scoped data references: no legacy scoped field in an entity row. The legacy script did not check this.
  for (const field of LEGACY_SCOPED_FIELDS) {
    if (Object.hasOwn(row, field)) out.add("legacy_scoped_field", path, `${base}.${field}`, `\`${field}\` is an old scoped field and is not allowed. Use systems, environments, and owners.`, field);
  }

  if (type === "extraction") checkExtractionRow(out, path, row, base);
}

/**
 * A saved anchor is a `path#anchor` reference relative to the project root
 * (PRD 13, the Root and Path Contract, register D-004). The legacy script
 * checked only for a `#`, and its prefixes were the source-checkout ones
 * (`system/docs/`, `system/assets/`).
 */
function checkAnchor(out: Findings, path: string, value: unknown, field: string, rule: { required: boolean; under: string | undefined }): void {
  if (!isNonEmptyString(value)) {
    if (rule.required) out.add("required", path, field, `\`${lastName(field)}\` is required: a path#anchor reference.`);
    else out.add("anchor_empty", path, field, `\`${lastName(field)}\` must be a path#anchor reference when it is set, or null.`);
    return;
  }
  // P7-R2-04: the path ends at the first `#`. The fragment after it must not
  // be empty and may itself hold `#` (a heading ID such as `C#`). PRD 13
  // constrains the spelling only: the file and the fragment are not looked up.
  const hash = value.indexOf("#");
  const anchorPath = hash < 0 ? value : value.slice(0, hash);
  const fragment = hash < 0 ? "" : value.slice(hash + 1);
  const normalized = normalizeAnchorPath(anchorPath);
  const rawParts = anchorPath.split(/[/\\]/);
  const lastPart = rawParts[rawParts.length - 1];
  if (hash < 0 || fragment === "") {
    out.add("anchor_format", path, field, `"${value}" must be a path#anchor reference, such as docs/notes.md#summary.`, value);
  } else if (URI_SCHEME_RE.test(anchorPath)) {
    // P7-R1-01: a web address or other URI is not a project file.
    out.add("anchor_format", path, field, `"${value}" must name a file in the project folder, not a web address or other URI.`, value);
  } else if (anchorPath === "" || normalized === undefined || normalized === "") {
    // PRD 13 and register D-004: no empty path, no absolute path, no path that leaves the project folder,
    // and (P7-R1-01) no path that folds to the project folder itself.
    out.add("anchor_format", path, field, `"${value}" must name a file inside the project folder, relative to it, before the #.`, value);
  } else if (normalized === "system" || normalized.startsWith("system/") || rawParts.find((part) => part !== ".") === "system") {
    // PRD 13 and register D-004 (P7-R1-01): `system/` is the source-package prefix, never part of a saved anchor.
    // P7-R2-04: checked on the path as written too, so `system/../docs/a.md` fails.
    const shown = normalized.startsWith("system/") ? normalized.slice("system/".length) : normalized === "system" ? "" : normalized;
    out.add("anchor_format", path, field, `"${value}" starts with system/, the source-package folder. Write the path from the project folder, such as ${shown || "docs/notes.md"}#${fragment}.`, value);
  } else if (lastPart === "" || lastPart === "." || lastPart === "..") {
    // P7-R2-04: a path that ends in `/`, `.`, or `..` names a folder, never a file.
    out.add("anchor_format", path, field, `"${value}" must name a file before the #, not a folder.`, value);
  }
  if (rule.under === "assets/" && !(normalized || anchorPath).startsWith("assets/")) {
    out.add("anchor_not_assets", path, field, `"${value}" must point to a converted source twin under assets/.`, value);
  }
  if (rule.under === "docs/" && !(normalized || anchorPath).startsWith("docs/")) {
    out.add("anchor_not_docs", path, field, `"${value}" must point to a document under docs/.`, value);
  }
}

/** A URI scheme before the first `/` (RFC 3986: a letter, then letters, digits, `+`, `-`, or `.`, then `:`). A one-letter scheme is a Windows drive, which `normalizeAnchorPath` refuses as absolute. */
const URI_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]+:/;

/** The anchor path with `.` and `..` folded, or `undefined` when it is absolute or leaves the project folder. */
function normalizeAnchorPath(anchorPath: string): string | undefined {
  if (anchorPath === "") return "";
  if (/^[/\\]/.test(anchorPath) || /^[A-Za-z]:/.test(anchorPath)) return undefined;
  const parts: string[] = [];
  for (const part of anchorPath.split(/[/\\]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return undefined;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function checkExtractionRow(out: Findings, path: string, row: Record<string, unknown>, base: string): void {
  const minted = own(row, "minted");
  if (!Array.isArray(minted)) {
    out.add("not_list", path, `${base}.minted`, "`minted` must be a list of entity IDs.");
  } else {
    for (const [index, entityId] of (minted as unknown[]).entries()) {
      if (!out.room()) break;
      const field = `${base}.minted[${index}]`;
      if (!isNonEmptyString(entityId)) out.add("minted_id_empty", path, field, "Each `minted` entry must be an entity ID.");
      else if (!ENTITY_ID_RE.test(entityId)) out.add("minted_bad_prefix", path, field, `"${entityId}" must use a registered ID prefix (REQ, CAP, PER, TC, RES, RUN, FIND, EXT, or PB) and at least three digits.`, entityId);
    }
  }
  if (!isNonEmptyString(own(row, "extracted_by"))) out.add("empty_string", path, `${base}.extracted_by`, "`extracted_by` must be non-empty text.");
  checkUtcDatetime(out, path, own(row, "extracted_at"), `${base}.extracted_at`);
  // PRD 13: when the field is present, its value is a list. The legacy script treated `null` as absent.
  if (Object.hasOwn(row, "dataset_refs")) {
    const refs = row["dataset_refs"];
    const field = `${base}.dataset_refs`;
    if (!Array.isArray(refs)) out.add("not_list", path, field, "`dataset_refs` must be a list of paths, or be left out.");
    else {
      for (const [index, ref] of (refs as unknown[]).entries()) {
        if (!out.room()) break;
        if (!isNonEmptyString(ref)) out.add("empty_string", path, `${field}[${index}]`, "Each `dataset_refs` entry must be non-empty text.");
      }
    }
  }
}

function checkUtcDatetime(out: Findings, path: string, value: unknown, field: string): void {
  if (!isNonEmptyString(value)) {
    out.add("datetime_missing", path, field, `\`extracted_at\` is required: a UTC time such as ${UTC_DATETIME_EXAMPLE}.`);
    return;
  }
  const match = UTC_DATETIME_RE.exec(value);
  if (match === null) {
    out.add("datetime_format", path, field, `"${value}" must be a UTC time written as YYYY-MM-DDTHH:MM:SSZ, such as ${UTC_DATETIME_EXAMPLE}. A fraction of a second may come before the Z (.5).`, value);
    return;
  }
  if (!isRealTime(match)) out.add("datetime_invalid", path, field, `"${value}" is not a real date and time. Use a UTC time such as ${UTC_DATETIME_EXAMPLE}.`, value);
}

/**
 * A real calendar date and time (RFC 3339 `date-time`): year 0001 to 9999,
 * the days of the month (leap years), hour 00 to 23, minute and second 00 to
 * 59. No leap second (`:60`) and no `24:00:00` (P7-R1-03; the legacy script
 * accepted `24:00:00` as the next day, VD-07).
 */
function isRealTime(match: RegExpExecArray): boolean {
  const [year, month, day, hour, minute, second] = [1, 2, 3, 4, 5, 6].map((group) => Number(match[group])) as [number, number, number, number, number, number];
  if (year < 1 || month < 1 || month > 12) return false;
  if (day < 1 || day > daysIn(year, month)) return false;
  return hour <= 23 && minute <= 59 && second <= 59;
}

function daysIn(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// ----------------------------------------------------------------- helpers

/** The deepest JSON nesting a data line may have. */
export const JSON_MAX_DEPTH = 512;

/** True when the line nests arrays and objects deeper than `JSON_MAX_DEPTH`, counted outside strings. */
function jsonNestingTooDeep(line: string): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) i++;
      else if (c === 0x22) inString = false;
    } else if (c === 0x22) inString = true;
    else if (c === 0x5b || c === 0x7b) {
      if (++depth > JSON_MAX_DEPTH) return true;
    } else if (c === 0x5d || c === 0x7d) depth--;
  }
  return false;
}

function isMapping(value: YamlValue | undefined): value is YamlMapping {
  return value instanceof Map;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(row: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(row, key) ? row[key] : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && pyStrip(value) !== "";
}

function lastName(field: string): string {
  return field.slice(field.lastIndexOf(".") + 1);
}
