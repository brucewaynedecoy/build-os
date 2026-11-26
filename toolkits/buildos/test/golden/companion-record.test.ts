// W1 R7 P7 review round 2 (P7-R2-09): `make-docs-companion/capture.ts --check`
// compares only the record fields a capture on any machine reproduces, so a
// check on another OS or CPU passes when the Make Docs files match.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { recordDifferences, REPRODUCIBLE_FIELDS } from "./make-docs-companion/record.ts";

describe("Make Docs companion capture record (P7-R2-09)", () => {
  const saved = JSON.parse(readFileSync(join(import.meta.dirname, "make-docs-companion", "capture-record.json"), "utf8")) as Record<string, unknown>;

  it("a capture on another OS and CPU, with the same files, has no difference", () => {
    assert.ok(typeof saved["capture_os"] === "string");
    assert.deepEqual(recordDifferences(saved, { ...saved, capture_os: "win32 x64" }), []);
    assert.ok(!(REPRODUCIBLE_FIELDS as readonly string[]).includes("capture_os"));
  });

  it("a changed file digest, version, or file list is a difference", () => {
    const files = { ...(saved["files"] as Record<string, string>), "docs/designs/AGENTS.md": "0".repeat(64) };
    assert.deepEqual(recordDifferences(saved, { ...saved, files }), ["files"]);
    assert.deepEqual(recordDifferences(saved, { ...saved, make_docs: "2.0.10" }), ["make_docs"]);
    assert.deepEqual(recordDifferences(saved, { ...saved, make_docs_system_files: [] }), ["make_docs_system_files"]);
  });
});
