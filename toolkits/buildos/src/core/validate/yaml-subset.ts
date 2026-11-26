/**
 * The small YAML subset that `buildos validate` reads: the config file
 * (`.os/config/instance.yaml`) and the frontmatter of scoped Markdown files.
 *
 * It is a port of the subset parser in the removed legacy validator
 * (`validate_config.py`: `yaml_source_lines`, `parse_block`,
 * `parse_mapping`, `parse_sequence`, `split_key_value`, `parse_scalar`), with
 * the same results for the same text. No YAML package is used (PRD 20
 * Supply Chain). The subset:
 *
 * - Block mappings (`key: value`) and block sequences (`- item`), nested by
 *   indentation with spaces. A tab in the indentation is an error.
 * - A sequence item that starts with `key:` opens a mapping; more keys of
 *   that mapping follow on lines indented more than the dash.
 * - Scalars: `null` and `~`, `true` and `false`, ASCII integers, inline
 *   lists (`[a, b]`, split on every comma), text in single or double quotes
 *   (the quotes are removed, nothing is unescaped), and plain text. An
 *   integer is a `number` when it is a safe integer, else a `bigint`, so it
 *   keeps its exact value as Python's `int` did (P7-R1-12).
 * - Empty lines and lines that start with `#` are skipped. A `#` after a
 *   value is part of the value.
 * - A duplicate key in one mapping is an error.
 *
 * Text is split into lines as Python's `str.splitlines` does, and stripped
 * with Python's whitespace set, so the same file gives the same lines.
 *
 * One addition (a deliberate divergence, see the W1 R7 P7 evidence): nesting
 * deeper than `YAML_MAX_DEPTH` levels is an error. The legacy script crashed
 * on deep nesting (Python recursion limit). Block levels and inline list
 * levels share one depth budget (P7-R1-06), so no input can recurse deeper.
 */

/** A parsed value. A mapping is a `Map`, so no key can reach `Object.prototype`. */
export type YamlValue = null | boolean | number | bigint | string | YamlValue[] | YamlMapping;
export type YamlMapping = Map<string, YamlValue>;

/** The deepest nesting the parser accepts: block levels and inline list levels together. */
export const YAML_MAX_DEPTH = 64;

/** A parse error. `message` is `<path>:<line>: <what>`, as the legacy script spells it. */
export class YamlSubsetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YamlSubsetError";
  }
}

interface SourceLine {
  indent: number;
  text: string;
  number: number;
}

/** Python's `str.isspace` characters (`str.strip` with no argument removes these). */
const PY_WHITESPACE = new Set([
  "\t", "\n", "\v", "\f", "\r", "\x1c", "\x1d", "\x1e", "\x1f", " ", "\x85", "\xa0", "\u1680",
  "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200a",
  "\u2028", "\u2029", "\u202f", "\u205f", "\u3000",
]);

/** Python's `str.lstrip()` with no argument. */
export function pyLstrip(text: string): string {
  let start = 0;
  while (start < text.length && PY_WHITESPACE.has(text[start]!)) start++;
  return text.slice(start);
}

/** Python's `str.strip()` with no argument. */
export function pyStrip(text: string): string {
  let end = text.length;
  while (end > 0 && PY_WHITESPACE.has(text[end - 1]!)) end--;
  return pyLstrip(text.slice(0, end));
}

/** Python's `str.splitlines()`: every line break Python knows, no final empty line. */
export function pySplitlines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Parses `text`. `path` is only used in error messages. An empty document is `null`. */
export function parseYamlSubset(text: string, path: string): YamlValue {
  const lines = yamlSourceLines(text, path);
  if (lines.length === 0) return null;
  const [value, index] = parseBlock(lines, 0, lines[0]!.indent, path, 1);
  if (index !== lines.length) throw new YamlSubsetError(`${path}:${lines[index]!.number}: unexpected content`);
  return value;
}

function yamlSourceLines(text: string, path: string): SourceLine[] {
  const lines: SourceLine[] = [];
  pySplitlines(text).forEach((raw, offset) => {
    const number = offset + 1;
    const leading = raw.slice(0, raw.length - pyLstrip(raw).length);
    if (leading.includes("\t")) throw new YamlSubsetError(`${path}:${number}: tabs are not supported`);
    const stripped = pyStrip(raw);
    if (stripped === "" || stripped.startsWith("#")) return;
    let indent = 0;
    while (indent < raw.length && raw[indent] === " ") indent++;
    lines.push({ indent, text: stripped, number });
  });
  return lines;
}

function parseBlock(lines: SourceLine[], index: number, indent: number, path: string, depth: number): [YamlValue, number] {
  const line = lines[index]!;
  if (depth > YAML_MAX_DEPTH) throw new YamlSubsetError(`${path}:${line.number}: nesting is deeper than ${YAML_MAX_DEPTH} levels`);
  if (line.indent !== indent) throw new YamlSubsetError(`${path}:${line.number}: expected indent ${indent}`);
  if (line.text.startsWith("- ")) return parseSequence(lines, index, indent, path, depth);
  return parseMapping(lines, index, indent, path, depth);
}

function parseMapping(lines: SourceLine[], start: number, indent: number, path: string, depth: number): [YamlMapping, number] {
  const result: YamlMapping = new Map();
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YamlSubsetError(`${path}:${line.number}: unexpected indent`);
    if (line.text.startsWith("- ")) break;
    const [key, rawValue] = splitKeyValue(line.text, path, line.number);
    if (result.has(key)) throw new YamlSubsetError(`${path}:${line.number}: duplicate key ${key}`);
    let value: YamlValue;
    if (rawValue === "") {
      const next = lines[index + 1];
      if (next !== undefined && next.indent > indent) {
        [value, index] = parseBlock(lines, index + 1, next.indent, path, depth + 1);
      } else {
        value = null;
        index += 1;
      }
    } else {
      value = parseScalar(rawValue, depth, path, line.number);
      index += 1;
    }
    result.set(key, value);
  }
  return [result, index];
}

function parseSequence(lines: SourceLine[], start: number, indent: number, path: string, depth: number): [YamlValue[], number] {
  const result: YamlValue[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YamlSubsetError(`${path}:${line.number}: unexpected indent`);
    if (!line.text.startsWith("- ")) break;
    const itemText = pyStrip(line.text.slice(2));
    if (itemText === "") {
      const next = lines[index + 1];
      let value: YamlValue;
      if (next !== undefined && next.indent > indent) {
        [value, index] = parseBlock(lines, index + 1, next.indent, path, depth + 1);
      } else {
        value = null;
        index += 1;
      }
      result.push(value);
      continue;
    }
    if (/^[A-Za-z0-9_-]+:/.test(itemText)) {
      // P7-R2-05: `- key: value` opens a mapping one level below the list, so the depth is checked here, also for a last item with no more lines.
      if (depth + 1 > YAML_MAX_DEPTH) throw new YamlSubsetError(`${path}:${line.number}: nesting is deeper than ${YAML_MAX_DEPTH} levels`);
      const [key, rawValue] = splitKeyValue(itemText, path, line.number);
      const item: YamlMapping = new Map([[key, rawValue === "" ? null : parseScalar(rawValue, depth + 1, path, line.number)]]);
      index += 1;
      const next = lines[index];
      if (next !== undefined && next.indent > indent) {
        let extra: YamlMapping;
        [extra, index] = parseMapping(lines, index, next.indent, path, depth + 1);
        for (const [extraKey, extraValue] of extra) {
          if (item.has(extraKey)) throw new YamlSubsetError(`${path}:${lines[index - 1]!.number}: duplicate key ${extraKey}`);
          item.set(extraKey, extraValue);
        }
      }
      result.push(item);
      continue;
    }
    result.push(parseScalar(itemText, depth, path, line.number));
    index += 1;
  }
  return [result, index];
}

function splitKeyValue(text: string, path: string, lineNumber: number): [string, string] {
  const colon = text.indexOf(":");
  if (colon < 0) throw new YamlSubsetError(`${path}:${lineNumber}: expected key/value pair`);
  const key = pyStrip(text.slice(0, colon));
  if (key === "") throw new YamlSubsetError(`${path}:${lineNumber}: empty key`);
  return [key, pyStrip(text.slice(colon + 1))];
}

/**
 * A scalar in a block at `depth`. An inline list nests one level below the
 * block that holds it, and each inner list one more (P7-R1-06), within the
 * same `YAML_MAX_DEPTH` budget.
 */
function parseScalar(raw: string, depth: number, path: string, lineNumber: number): YamlValue {
  const value = pyStrip(raw);
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    if (depth + 1 > YAML_MAX_DEPTH) throw new YamlSubsetError(`${path}:${lineNumber}: nesting is deeper than ${YAML_MAX_DEPTH} levels`);
    const inner = pyStrip(value.slice(1, -1));
    if (inner === "") return [];
    return inner.split(",").map((item) => parseScalar(pyStrip(item), depth + 1, path, lineNumber));
  }
  if (value.length >= 1 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1);
  }
  if (/^-?[0-9]+$/.test(value)) {
    // P7-R1-12: Python's int keeps every digit; a JavaScript number does not past 2^53.
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : BigInt(value);
  }
  return value;
}
