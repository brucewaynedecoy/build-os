// A small JSON Schema (draft-07) validator for the release SBOM gate (W1 R7
// P8 review round 1, P8-R1-05). Node built-ins only, no new dependency. It
// covers the keywords that the vendored CycloneDX 1.5 schemas use
// (scripts/schemas/cyclonedx-1.5/, see SOURCES.json there):
//
//   $ref (in-document `#/...` and a sibling file such as `spdx.schema.json`
//   or `jsf-0.82.schema.json#/definitions/signature`), type, enum, const,
//   properties, required, additionalProperties, items (one schema or a
//   tuple), additionalItems, allOf, anyOf, oneOf, if/then/else, minItems,
//   maxItems, uniqueItems, minLength, maxLength, minimum, maximum, pattern,
//   and format `date-time`.
//
// `format` `iri-reference` and `idn-email` are annotations here, as draft-07
// allows. Any keyword this validator does not know makes `schemaProblems`
// fail, so a newer schema cannot pass by being half read. The annotation
// keywords ($schema, $id, $comment, title, description, examples, default,
// definitions) are read as annotations.
//
// test/sbom-schema.test.ts checks it against known-good and known-bad
// documents, including the review's failing case (an SPDX expression inside
// `license`).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Schema = boolean | Record<string, unknown>;

const KNOWN = new Set([
  "$ref", "type", "enum", "const", "properties", "required", "additionalProperties", "items", "additionalItems",
  "allOf", "anyOf", "oneOf", "if", "then", "else", "minItems", "maxItems", "uniqueItems", "minLength", "maxLength",
  "minimum", "maximum", "pattern", "format",
  // Annotations.
  "$schema", "$id", "$comment", "title", "description", "examples", "default", "definitions",
]);

export interface ValidationError {
  /** A JSON Pointer into the document. */
  at: string;
  message: string;
}

/** Loads a schema file and every sibling file it names in a `$ref`. */
export class SchemaSet {
  private readonly files = new Map<string, Record<string, unknown>>();
  private readonly regexes = new Map<string, RegExp>();
  private readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
  }

  load(name: string): Record<string, unknown> {
    let schema = this.files.get(name);
    if (schema === undefined) {
      if (!/^[A-Za-z0-9._-]+\.json$/.test(name)) throw new Error(`schema $ref names a file outside the schema folder: ${name}`);
      schema = JSON.parse(readFileSync(join(this.dir, name), "utf8")) as Record<string, unknown>;
      this.files.set(name, schema);
    }
    return schema;
  }

  /** Resolves `$ref` from the file `base`. Returns the schema and the file it is in. */
  resolve(ref: string, base: string): { schema: Schema; file: string } {
    const [filePart = "", pointer = ""] = ref.split("#");
    const file = filePart === "" ? base : filePart;
    let node: unknown = this.load(file);
    if (pointer !== "") {
      for (const raw of pointer.split("/").slice(1)) {
        const key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
        if (typeof node !== "object" || node === null || !(key in node)) throw new Error(`schema $ref ${ref} does not resolve`);
        node = (node as Record<string, unknown>)[key];
      }
    }
    return { schema: node as Schema, file };
  }

  regex(pattern: string): RegExp {
    let re = this.regexes.get(pattern);
    if (re === undefined) {
      try {
        re = new RegExp(pattern, "u");
      } catch {
        re = new RegExp(pattern);
      }
      this.regexes.set(pattern, re);
    }
    return re;
  }
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function typeMatches(value: unknown, type: string): boolean {
  const actual = typeOf(value);
  return actual === type || (type === "number" && actual === "integer");
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return deepEqual(ka, kb) && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** RFC 3339 date-time, as draft-07 `format: date-time` names it. */
export function isDateTime(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(text);
  if (m === null) return false;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  // RFC 3339 time-numoffset: hours 00 to 23, minutes 00 to 59 (W1 R7 P8 review round 2, P8-R2-09).
  if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return false;
  return days !== undefined && d >= 1 && d <= days && h <= 23 && mi <= 59 && s <= 60;
}

const pointer = (at: string, key: string | number) => `${at}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;

/** Validates `value` against `schema` (in file `file` of `set`). Returns every error found. */
export function validate(set: SchemaSet, schema: Schema, value: unknown, file: string, at = ""): ValidationError[] {
  if (schema === true) return [];
  if (schema === false) return [{ at, message: "no value is allowed here" }];
  const errors: ValidationError[] = [];
  const err = (message: string, where = at) => errors.push({ at: where, message });
  for (const key of Object.keys(schema)) if (!KNOWN.has(key)) err(`the schema uses the keyword ${key}, which this validator does not read`);

  if (typeof schema["$ref"] === "string") {
    // Draft-07: $ref takes the place of every other keyword of the same object.
    const target = set.resolve(schema["$ref"], file);
    return validate(set, target.schema, value, target.file, at);
  }
  const type = schema["type"];
  if (type !== undefined) {
    const types = Array.isArray(type) ? (type as string[]) : [type as string];
    if (!types.some((t) => typeMatches(value, t))) {
      err(`is ${typeOf(value)}, not ${types.join(" or ")}`);
      return errors;
    }
  }
  if (Array.isArray(schema["enum"]) && !(schema["enum"] as unknown[]).some((e) => deepEqual(e, value))) err(`is not one of the allowed values`);
  if ("const" in schema && !deepEqual(schema["const"], value)) err(`is not ${JSON.stringify(schema["const"])}`);

  if (typeof value === "string") {
    const length = [...value].length;
    if (typeof schema["minLength"] === "number" && length < schema["minLength"]) err(`is shorter than ${schema["minLength"]} characters`);
    if (typeof schema["maxLength"] === "number" && length > schema["maxLength"]) err(`is longer than ${schema["maxLength"]} characters`);
    if (typeof schema["pattern"] === "string" && !set.regex(schema["pattern"]).test(value)) err(`does not match the pattern ${schema["pattern"]}`);
    if (schema["format"] === "date-time" && !isDateTime(value)) err("is not an RFC 3339 date-time");
  }
  if (typeof value === "number") {
    if (typeof schema["minimum"] === "number" && value < schema["minimum"]) err(`is below ${schema["minimum"]}`);
    if (typeof schema["maximum"] === "number" && value > schema["maximum"]) err(`is above ${schema["maximum"]}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema["minItems"] === "number" && value.length < schema["minItems"]) err(`has fewer than ${schema["minItems"]} items`);
    if (typeof schema["maxItems"] === "number" && value.length > schema["maxItems"]) err(`has more than ${schema["maxItems"]} items`);
    if (schema["uniqueItems"] === true && value.some((x, i) => value.findIndex((y) => deepEqual(x, y)) !== i)) err("has repeated items");
    const items = schema["items"];
    if (Array.isArray(items)) {
      value.forEach((item, i) => {
        if (i < items.length) errors.push(...validate(set, items[i] as Schema, item, file, pointer(at, i)));
        else if (schema["additionalItems"] !== undefined) errors.push(...validate(set, schema["additionalItems"] as Schema, item, file, pointer(at, i)));
      });
    } else if (items !== undefined) {
      value.forEach((item, i) => errors.push(...validate(set, items as Schema, item, file, pointer(at, i))));
    }
  }
  if (typeOf(value) === "object") {
    const record = value as Record<string, unknown>;
    const properties = (schema["properties"] ?? {}) as Record<string, Schema>;
    if (Array.isArray(schema["required"])) for (const key of schema["required"] as string[]) if (!(key in record)) err(`has no ${key}`);
    for (const [key, v] of Object.entries(record)) {
      if (key in properties) errors.push(...validate(set, properties[key] as Schema, v, file, pointer(at, key)));
      else if (schema["additionalProperties"] === false) err(`has the property ${key}, which is not allowed here`, pointer(at, key));
      else if (typeof schema["additionalProperties"] === "object") errors.push(...validate(set, schema["additionalProperties"] as Schema, v, file, pointer(at, key)));
    }
  }
  if (Array.isArray(schema["allOf"])) for (const s of schema["allOf"] as Schema[]) errors.push(...validate(set, s, value, file, at));
  if (Array.isArray(schema["anyOf"]) && !(schema["anyOf"] as Schema[]).some((s) => validate(set, s, value, file, at).length === 0)) err("matches none of the anyOf choices");
  if (Array.isArray(schema["oneOf"])) {
    const matches = (schema["oneOf"] as Schema[]).filter((s) => validate(set, s, value, file, at).length === 0).length;
    if (matches !== 1) err(`matches ${matches} of the oneOf choices, not exactly one`);
  }
  if (schema["if"] !== undefined) {
    const passes = validate(set, schema["if"] as Schema, value, file, at).length === 0;
    const branch = passes ? schema["then"] : schema["else"];
    if (branch !== undefined) errors.push(...validate(set, branch as Schema, value, file, at));
  }
  return errors;
}

export const CYCLONEDX_SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), "schemas", "cyclonedx-1.5");

/** Validates a CycloneDX document against the vendored CycloneDX 1.5 schema. Problems name the JSON Pointer of each error. */
export function cyclonedxSchemaProblems(document: unknown, dir: string = CYCLONEDX_SCHEMA_DIR): string[] {
  const set = new SchemaSet(dir);
  const spec = (document as Record<string, unknown> | null)?.["specVersion"];
  if (spec !== "1.5") return [`the SBOM specVersion is ${String(spec)}; the vendored schema is CycloneDX 1.5`];
  return validate(set, set.load("bom-1.5.schema.json"), document, "bom-1.5.schema.json").map((e) => `CycloneDX 1.5 schema: ${e.at === "" ? "the document" : e.at} ${e.message}`);
}
