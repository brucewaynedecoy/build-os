// W1 R7 P8 review round 1 (P8-R1-05): the SBOM is validated against the
// official CycloneDX 1.5 JSON schema, vendored in scripts/schemas/cyclonedx-1.5/
// with its source and SHA-256 in SOURCES.json, by the small draft-07
// validator in scripts/json-schema.ts. Known-good and known-bad documents,
// including the review's failing case: an SPDX expression inside `license`.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CYCLONEDX_SCHEMA_DIR, cyclonedxSchemaProblems, isDateTime, SchemaSet, validate } from "../scripts/json-schema.ts";
import { licenseChoice } from "../scripts/sbom.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = () => ({
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: "urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79",
  version: 1,
  metadata: { timestamp: "2026-11-24T00:00:00Z", component: { type: "application", name: "build-os", version: "0.1.0" } },
  components: [{ type: "library", name: "a", version: "1.0.0", licenses: [{ license: { id: "MIT" } }] }],
});
type Doc = ReturnType<typeof base> & Record<string, unknown>;
const withLicenses = (licenses: unknown): Doc => {
  const doc = base() as Doc;
  (doc.components[0] as Record<string, unknown>)["licenses"] = licenses;
  return doc;
};

describe("CycloneDX 1.5 schema validation of the SBOM (P8-R1-05)", () => {
  it("the vendored schema files have the SHA-256 that SOURCES.json records", () => {
    const sources = JSON.parse(readFileSync(join(CYCLONEDX_SCHEMA_DIR, "SOURCES.json"), "utf8")) as { tag: string; license: string; files: Record<string, { url: string; sha256: string }> };
    assert.equal(sources.tag, "1.5");
    assert.match(sources.license, /^Apache-2\.0/);
    assert.deepEqual(Object.keys(sources.files).sort(), ["bom-1.5.schema.json", "jsf-0.82.schema.json", "spdx.schema.json"]);
    for (const [name, info] of Object.entries(sources.files)) {
      assert.equal(createHash("sha256").update(readFileSync(join(CYCLONEDX_SCHEMA_DIR, name))).digest("hex"), info.sha256, name);
      assert.match(info.url, new RegExp(`^https://raw\\.githubusercontent\\.com/CycloneDX/specification/1\\.5/schema/${name.replace(/\./g, "\\.")}$`));
    }
  });

  it("accepts a known-good document, an SPDX ID, and an SPDX expression as a one-item tuple", () => {
    assert.deepEqual(cyclonedxSchemaProblems(base()), []);
    assert.deepEqual(cyclonedxSchemaProblems(withLicenses([{ expression: "MIT OR Apache-2.0" }])), []);
    assert.deepEqual(cyclonedxSchemaProblems(withLicenses(licenseChoice({ expression: "MIT OR NCSA" }))), []);
    assert.deepEqual(cyclonedxSchemaProblems(withLicenses(licenseChoice({ id: "BSD-3-Clause" }))), []);
  });

  it("refuses the review's failing case: an SPDX expression inside license", () => {
    const problems = cyclonedxSchemaProblems(withLicenses([{ license: { expression: "MIT OR NCSA" } }]));
    assert.deepEqual(problems, ["CycloneDX 1.5 schema: /components/0/licenses matches 0 of the oneOf choices, not exactly one"]);
  });

  it("refuses other known-bad documents", () => {
    const bad: [string, unknown][] = [
      ["two expressions", withLicenses([{ expression: "MIT" }, { expression: "ISC" }])],
      ["an unknown SPDX ID", withLicenses([{ license: { id: "Not-A-License" } }])],
      ["an unknown top-level field", { ...base(), extra: true }],
      ["no version", (() => { const d = base() as Partial<Doc>; delete d.version; return d; })()],
      ["a string version", { ...base(), version: "1" }],
      ["a bad serial number", { ...base(), serialNumber: "urn:uuid:not-a-uuid" }],
      ["a bad time stamp", { ...base(), metadata: { ...base().metadata, timestamp: "2026-13-40T00:00:00Z" } }],
      ["a wrong bomFormat", { ...base(), bomFormat: "SPDX" }],
      ["a bad component type", { ...base(), components: [{ type: "gadget", name: "a" }] }],
      ["another spec version", { ...base(), specVersion: "1.6" }],
    ];
    for (const [what, doc] of bad) assert.notDeepEqual(cyclonedxSchemaProblems(doc), [], what);
  });

  it("the validator fails on a keyword it does not read, and on a $ref that leaves the schema folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-schema-"));
    try {
      writeFileSync(join(dir, "s.json"), JSON.stringify({ type: "object", patternProperties: { "^x": { type: "string" } } }));
      const set = new SchemaSet(dir);
      assert.match(validate(set, set.load("s.json"), {}, "s.json").map((e) => e.message).join(";"), /uses the keyword patternProperties/);
      writeFileSync(join(dir, "r.json"), JSON.stringify({ $ref: "../outside.json" }));
      assert.throws(() => validate(set, set.load("r.json"), {}, "r.json"), /outside the schema folder/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checks draft-07 keywords: tuple items, additionalItems, oneOf, if/then, uniqueItems, bounds", () => {
    const dir = mkdtempSync(join(tmpdir(), "buildos-schema-"));
    try {
      const schema = {
        type: "object",
        properties: {
          t: { type: "array", items: [{ type: "string" }], additionalItems: false, minItems: 1 },
          o: { oneOf: [{ type: "string" }, { type: "string", minLength: 2 }] },
          u: { type: "array", uniqueItems: true },
          n: { type: "integer", minimum: 1, maximum: 3 },
          c: { if: { const: "a" }, then: { maxLength: 0 } },
        },
      };
      writeFileSync(join(dir, "k.json"), JSON.stringify(schema));
      const set = new SchemaSet(dir);
      const errors = (v: unknown) => validate(set, set.load("k.json"), v, "k.json").map((e) => `${e.at} ${e.message}`);
      assert.deepEqual(errors({ t: ["x"], o: "x", u: [1, 2], n: 2, c: "b" }), []);
      assert.ok(errors({ t: ["x", "y"] }).some((e) => e.startsWith("/t/1 ")));
      assert.ok(errors({ t: [] }).some((e) => /fewer than 1/.test(e)));
      assert.ok(errors({ o: "xy" }).some((e) => /matches 2 of the oneOf/.test(e)));
      assert.ok(errors({ u: [1, 1] }).some((e) => /repeated/.test(e)));
      assert.ok(errors({ n: 4 }).some((e) => /above 3/.test(e)));
      assert.ok(errors({ n: 1.5 }).some((e) => /not integer/.test(e)));
      assert.ok(errors({ c: "a" }).some((e) => /longer than 0/.test(e)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    assert.equal(isDateTime("2026-11-24T12:00:00Z"), true);
    assert.equal(isDateTime("2026-02-30T12:00:00Z"), false);
    assert.equal(isDateTime("2026-11-24 12:00:00"), false);
    // P8-R2-09: the offset hours and minutes are checked too.
    assert.equal(isDateTime("2026-11-24T12:00:00+99:99"), false);
    assert.equal(isDateTime("2026-11-24T12:00:00+24:00"), false);
    assert.equal(isDateTime("2026-11-24T12:00:00-05:60"), false);
    assert.equal(isDateTime("2026-11-24T12:00:00+23:59"), true);
    assert.equal(isDateTime("2026-11-24T12:00:00-05:30"), true);
  });

  it("the SBOM script emits an expression on the license-choice item, never inside license", () => {
    const source = readFileSync(join(packageRoot, "scripts", "sbom.ts"), "utf8");
    assert.match(source, /licenses: licenseChoice\(inner\.license\)/);
    assert.deepEqual(licenseChoice({ expression: "MIT OR Apache-2.0" }), [{ expression: "MIT OR Apache-2.0" }]);
  });
});
