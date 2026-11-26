// Shared code for the `buildos validate` parity goldens (W1 R7 P7 t12 to t15).
//
// - `loadCases` reads test/fixtures/validate/cases.json.
// - `materialize` builds one case project: base/ with the case overlay laid
//   over it. The installed layout is what `buildos validate` checks. The
//   source layout is what the legacy validator (`validate_config.py`) read:
//   the same files under `system/`, with each saved anchor under `docs/` or
//   `assets/` spelled with the `system/` prefix of the source checkout
//   (normalization N2, register D-004).
// - `pythonFindings` and `classifyPython` turn a recorded legacy result into
//   parity keys: (code, path, field, detail). Messages are never compared.
//
// No Python runs here. Only capture.ts runs Python, on a maintainer machine.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const PACKAGE_ROOT = join(import.meta.dirname, "..", "..", "..");
export const FIXTURES = join(PACKAGE_ROOT, "test", "fixtures", "validate");
export const GOLDENS = join(PACKAGE_ROOT, "test", "golden", "validate");

export interface ValidateCase {
  id: string;
  about: string;
  remove?: string[];
}

export interface PythonGolden {
  case: string;
  exit: number;
  stdout: string;
  /** Normalized stderr; for a crash, only its last line. */
  stderr: string;
  crashed: boolean;
}

export interface ParityKey {
  code: string;
  path: string;
  field: string;
  detail?: string;
}

export function loadCases(): ValidateCase[] {
  return (JSON.parse(readFileSync(join(FIXTURES, "cases.json"), "utf8")) as { cases: ValidateCase[] }).cases;
}

export function loadGolden(id: string): PythonGolden {
  return JSON.parse(readFileSync(join(GOLDENS, "cases", `${id}.json`), "utf8")) as PythonGolden;
}

/**
 * Writes the case project into `dest` (which must not exist), in the
 * installed or the source layout. The case `base` is the valid project alone;
 * it gets the source-layout anchors too (P7-R1-11), like every other case.
 */
export function materialize(id: string, dest: string, layout: "installed" | "source" = "installed"): void {
  const target = layout === "source" ? join(dest, "system") : dest;
  copyTree(join(FIXTURES, "base"), target);
  const testCase = loadCases().find((c) => c.id === id);
  if (testCase === undefined) throw new Error(`no validate case ${id}`);
  for (const path of testCase.remove ?? []) rmSync(join(target, ...path.split("/")), { recursive: true, force: true });
  copyTree(join(FIXTURES, "cases", id), target);
  if (layout === "source") liftAnchors(join(target, ".os", "data"));
}

function copyTree(from: string, to: string): void {
  if (!existsSync(from)) return;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name === ".keep") continue;
    const source = join(from, entry.name);
    const dest = join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, dest);
    else {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(source, dest);
    }
  }
}

/** N2: `"doc_anchor":"docs/...` and `"source_anchor":"assets/...` gain the `system/` prefix. Every other byte stays. */
function liftAnchors(dataDir: string): void {
  if (!existsSync(dataDir)) return;
  for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const path = join(dataDir, entry.name);
    const bytes = readFileSync(path);
    const text = bytes.toString("latin1");
    const lifted = text.replace(/("(?:doc_anchor|source_anchor)"\s*:\s*")(docs|assets)\//g, "$1system/$2/");
    if (lifted !== text) writeFileSync(path, Buffer.from(lifted, "latin1"));
  }
}

/** The findings of a recorded legacy result: `path:field: message` lines before `FAIL: ...`. */
export function pythonFindings(golden: PythonGolden): { path: string; field: string; message: string }[] {
  if (golden.crashed || golden.exit === 0) return [];
  const lines = golden.stderr.split("\n").filter((line) => line !== "");
  const last = lines.pop() ?? "";
  if (!/^FAIL: \d+ validation error\(s\)$/.test(last)) throw new Error(`${golden.case}: unexpected last stderr line ${JSON.stringify(last)}`);
  return lines.map((line) => {
    const colon = line.indexOf(":");
    const rest = line.slice(colon + 1);
    const sep = rest.indexOf(": ");
    if (colon < 0 || sep < 0) throw new Error(`${golden.case}: cannot read finding ${JSON.stringify(line)}`);
    return { path: line.slice(0, colon), field: rest.slice(0, sep), message: rest.slice(sep + 2) };
  });
}

const EXACT: Readonly<Record<string, string>> = {
  "config contract file is missing": "contract_missing",
  "expected top-level mapping": "config_not_mapping",
  "must be an integer": "version_not_integer",
  "must be a mapping": "not_mapping",
  "must be a string": "not_string",
  "must be a stable slug: lowercase letters, digits, and hyphens": "not_slug",
  "must be a list": "not_list",
  "must be a list of configured systems[].id values": "not_list",
  "must be a list of registered entity IDs": "not_list",
  "is required": "required",
  "must be a string configured ID": "ref_not_string",
  "legacy scoped field is not allowed; use systems, environments, and owners": "legacy_scoped_field",
  "is required for scoped frontmatter": "scoped_field_required",
  "canonical entity JSONL file is missing": "entity_file_missing",
  "must be a JSONL file": "entity_file_not_file",
  "blank lines are not valid JSONL rows": "blank_line",
  "must be a JSON object": "not_object",
  "must be a non-empty path#anchor reference when set": "anchor_empty",
  "must be a path#anchor reference": "anchor_format",
  "must point to a converted source twin under system/assets/": "anchor_not_assets",
  "must be a registered entity ID": "minted_id_empty",
  "must use a registered entity ID prefix": "minted_bad_prefix",
  "must be a non-empty string": "empty_string",
  "must be an ISO 8601 UTC datetime": "datetime_missing",
  "must be an ISO 8601 UTC datetime ending in Z": "datetime_format",
  "must be a valid ISO 8601 UTC datetime": "datetime_invalid",
};

/** Codes whose parity key also compares `detail`: the legacy message carries the value, or (`sentinel_value`, `reserved_id`, P7-R1-02) the reserved value is the point of the finding. */
export const DETAIL_CODES = new Set(["contract_term_missing", "unknown_id", "wrong_type", "bad_id_prefix", "legacy_scoped_field", "sentinel_value", "reserved_id"]);

/** The stable code (and detail) of one legacy finding. Throws for a message it does not know. */
export function classifyPython(finding: { path: string; field: string; message: string }): ParityKey {
  const { path, field, message } = finding;
  const key = (code: string, detail?: string): ParityKey => (detail === undefined ? { code, path, field } : { code, path, field, detail });
  if (Object.hasOwn(EXACT, message)) {
    const code = EXACT[message]!;
    return code === "legacy_scoped_field" ? key(code, field.slice(field.lastIndexOf(".") + 1)) : key(code);
  }
  let m: RegExpExecArray | null;
  if ((m = /^missing contract term (.+)$/.exec(message))) return key("contract_term_missing", m[1]);
  if (/^\[Errno 2\] /.test(message)) return key("config_missing");
  if (/^\[Errno 21\] /.test(message)) return key("not_regular_file");
  if (/^[^:]*:\d+: /.test(message) && (field === "config" || field === "frontmatter")) return key(field === "config" ? "config_parse" : "frontmatter_parse");
  if (/^duplicates /.test(message)) return key("duplicate_id");
  if ((m = /^unknown configured ID (.+)$/.exec(message))) return key("unknown_id", pyReprString(m[1]!));
  if (/^invalid JSON: /.test(message)) return key("invalid_json");
  if ((m = /^must be '(.+)' for this file$/.exec(message))) return key("wrong_type", m[1]);
  if ((m = /^must use ([A-Z]+)-NNN ID prefix$/.exec(message))) return key("bad_id_prefix", m[1]);
  if (/^must be one of: /.test(message)) return key("bad_status");
  if (/^must point under /.test(message)) return key("anchor_not_docs");
  throw new Error(`unknown legacy finding message ${JSON.stringify(message)}`);
}

/** The text of a Python `repr` of a string, for the simple values the fixtures use. */
function pyReprString(repr: string): string {
  const quote = repr[0];
  if ((quote !== "'" && quote !== '"') || repr[repr.length - 1] !== quote) throw new Error(`not a Python string repr: ${repr}`);
  return repr.slice(1, -1).replace(/\\(.)/g, "$1");
}

/** A parity key as one sortable string. */
export function keyText(key: ParityKey): string {
  return JSON.stringify([key.code, key.path, key.field, DETAIL_CODES.has(key.code) ? (key.detail ?? null) : null]);
}

/** The legacy parity keys of one case, sorted. */
export function pythonKeys(golden: PythonGolden): string[] {
  return pythonFindings(golden).map(classifyPython).map(keyText).sort();
}
