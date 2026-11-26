import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeBuildInfo } from "../src/core/shared/build-info.ts";
import { createEnvelope, ENVELOPE_FIELDS, serializeEnvelope, WRITE_STATUSES } from "../src/core/shared/envelope.ts";
import { assertIncludes, assertMatchObject } from "./helpers.ts";

describe("JSON envelope", () => {
  it("serializes all nine fields in contract order", () => {
    const envelope = createEnvelope({
      command: "entities.resolve",
      version: "dev",
      sourceRevision: "unknown",
      root: "/project",
      mode: "compat",
      writeStatus: "not_requested",
      result: {},
    });
    const parsed = JSON.parse(serializeEnvelope(envelope)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed), [...ENVELOPE_FIELDS]);
    assert.equal(ENVELOPE_FIELDS.length, 9);
    assert.deepEqual(parsed, {
      ok: true,
      command: "entities.resolve",
      version: "dev",
      source_revision: "unknown",
      root: "/project",
      mode: "compat",
      write_status: "not_requested",
      result: {},
      diagnostics: [],
    });
  });

  it("defaults result to null, diagnostics to [], and strings to empty", () => {
    const parsed = JSON.parse(serializeEnvelope(createEnvelope({ command: "x", version: "dev", sourceRevision: "unknown" })));
    assertMatchObject(parsed, { ok: true, root: "", mode: "", write_status: "not_requested", result: null, diagnostics: [] });
  });

  it("allows exactly the five write statuses", () => {
    assert.deepEqual(WRITE_STATUSES, ["not_requested", "planned", "applied", "canonical_applied_index_failed", "partially_applied"]);
    for (const writeStatus of WRITE_STATUSES) {
      const parsed = JSON.parse(serializeEnvelope(createEnvelope({ command: "x", version: "dev", sourceRevision: "unknown", writeStatus })));
      assert.equal(parsed.write_status, writeStatus);
    }
  });

  it("uses two-space indentation, a trailing newline, and escapes U+2028 and U+2029", () => {
    const text = serializeEnvelope(createEnvelope({ command: "x", version: "dev", sourceRevision: "unknown", result: { s: "a b c<&>" } }));
    assert.equal(text.endsWith("}\n"), true);
    assertIncludes(text, '\n  "ok": true,');
    assertIncludes(text, '"a\\u2028b\\u2029c<&>"');
  });

  it("orders diagnostic fields and drops empty optional fields", () => {
    const envelope = createEnvelope({
      command: "x",
      version: "dev",
      sourceRevision: "unknown",
      diagnostics: [{ correction: "fix it", message: "bad", severity: "error", code: "c1", line: 0, chain: [] }],
    });
    const text = serializeEnvelope(envelope);
    const parsed = JSON.parse(text);
    assert.deepEqual(Object.keys(parsed.diagnostics[0]), ["code", "severity", "message", "correction"]);
  });

  it("reports source builds as dev and unknown", () => {
    assert.deepEqual(normalizeBuildInfo({}), { version: "dev", sourceRevision: "unknown" });
    assert.deepEqual(normalizeBuildInfo({ version: " ", sourceRevision: "" }), { version: "dev", sourceRevision: "unknown" });
    assert.deepEqual(normalizeBuildInfo({ version: "0.1.0", sourceRevision: "abc123" }), { version: "0.1.0", sourceRevision: "abc123" });
  });
});
