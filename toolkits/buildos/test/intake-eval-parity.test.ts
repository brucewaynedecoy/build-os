// Go parity on the conversion eval set (W1 R7 P4 t12; PRD 20 Compatibility).
//
// The golden harness compares the intake goldens. This test compares every
// eval file's TypeScript twin bodies with the Go 1.24.1 intake tool's bodies
// for the same file (test/fixtures/go-seed/intake-eval-goldens.json, from
// scripts/capture-intake-eval-goldens.ts):
//
// - CSV, DOCX, XLSX, and HTML bodies must be byte-identical, except the
//   exact `eval` entries of parity-exceptions.json (PE-008).
// - Every PDF body must pass the PE-009 class check (approved 2026-11-23,
//   pdfWordGapClass in harness.ts): after white-space normalization, the
//   port's text may differ from Go's only by single spaces where Go has two
//   adjacent non-space characters that the PDF renders as separate words.
//   A PE-009 fixture (`pdf` in parity-exceptions.json) also records the
//   exact spaces the check finds; any other PDF body must equal Go.
// - A failed conversion must fail with Go's text.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { EVAL_GOLDENS, type EvalGoldenFile } from "../scripts/capture-intake-eval-goldens.ts";
import { converter } from "./conversion-eval/package-converter.ts";
import { EVAL_ROOT, loadManifest } from "./conversion-eval/references.ts";
import { intakeParsers } from "../src/adapters/intake-parsers.ts";
import { loadExceptions, pdfSeparations, pdfWordGapClass, pdfWordGapProblems, type EvalException, type PdfWordGap } from "./golden/harness.ts";

const goldens = JSON.parse(readFileSync(EVAL_GOLDENS, "utf8")) as EvalGoldenFile;
const manifest = loadManifest();
const evalEntries: { id: string; entry: EvalException }[] = loadExceptions().exceptions.flatMap((e) => (e.eval ?? []).map((entry) => ({ id: e.id, entry })));

/** PE-009 entries for eval files (approved). */
const pdfWordGaps: { id: string; entry: PdfWordGap }[] = loadExceptions().exceptions.flatMap((p) => (p.pdf ?? []).filter((e) => e.source.startsWith("eval:")).map((entry) => ({ id: p.id, entry })));

/** Go's body with each added block and its following blank line removed once. */
export function withoutBlocks(body: string, blocks: readonly string[]): string {
  let out = body;
  for (const block of blocks) {
    const at = out.indexOf(`${block}\n\n`);
    if (at === -1) return `<block not found: ${block}>`;
    out = out.slice(0, at) + out.slice(at + block.length + 2);
  }
  return out;
}

describe("intake eval set parity with the Go intake tool", () => {
  it("has Go 1.24.1 bodies for every eval file", () => {
    assert.equal(goldens.go_version, "go1.24.1");
    assert.deepEqual(
      goldens.files.map((f) => f.id),
      manifest.files.map((f) => f.id),
    );
  });

  it("names only real PDF eval twins in the PE-009 fixtures", () => {
    for (const { id, entry } of pdfWordGaps) {
      const golden = goldens.files.find((f) => `eval:${f.id}` === entry.source);
      assert.ok(golden?.parts?.some((p) => p.name === entry.part), `${id} names ${entry.source} ${entry.part}, which has no Go body`);
      assert.equal(entry.context.length, entry.inserted_spaces.length);
    }
  });

  it("lists only real eval twins in the eval exceptions", () => {
    for (const { id, entry } of evalEntries) {
      const golden = goldens.files.find((f) => f.id === entry.file);
      assert.ok(golden?.parts?.some((p) => p.name === entry.part), `${id} names ${entry.file} ${entry.part}, which has no Go body`);
      assert.ok(entry.added_blocks.length > 0, `${id} must name the blocks it adds`);
    }
  });

  for (const file of manifest.files) {
    it(`${file.id}: matches Go`, async () => {
      const golden = goldens.files.find((f) => f.id === file.id);
      assert.ok(golden !== undefined);
      const source = join(EVAL_ROOT, ...file.source.split("/"));
      if (golden.error !== undefined) {
        await assert.rejects(converter.convert(source, file), (error: Error) => error.message === golden.error);
        return;
      }
      const bodies = await converter.convert(source, file);
      const separations = file.format === "pdf" ? pdfSeparations(await intakeParsers.pdfText(new Uint8Array(readFileSync(source)))) : undefined;
      const parts = golden.parts ?? [];
      assert.equal(bodies.length, parts.length);
      parts.forEach((part, i) => {
        const ours = bodies[i]!;
        const entry = evalEntries.find((x) => x.entry.file === file.id && x.entry.part === part.name);
        if (entry !== undefined) {
          assert.equal(ours, entry.entry.actual, `${entry.id}: ${file.id} ${part.name} must be exactly the allowed body`);
          assert.notEqual(part.body, ours, `${entry.id}: ${file.id} ${part.name} now equals Go; remove the entry`);
          assert.equal(withoutBlocks(ours, entry.entry.added_blocks), part.body, `${entry.id}: the only difference from Go must be the added blocks`);
          return;
        }
        if (file.format !== "pdf") {
          assert.equal(ours, part.body, `${file.id} ${part.name} must equal Go byte for byte`);
          return;
        }
        const gap = pdfWordGaps.find((x) => x.entry.source === `eval:${file.id}` && x.entry.part === part.name);
        if (gap !== undefined) {
          assert.deepEqual(pdfWordGapProblems(gap.id, gap.entry, part.body, ours, separations!), []);
          return;
        }
        const { problems, removed } = pdfWordGapClass(part.body, ours, separations!);
        assert.deepEqual(problems, [], `${file.id} ${part.name} must pass the PE-009 class check`);
        assert.deepEqual(removed, [], `${file.id} ${part.name} adds spaces Go lacks; record it as a PE-009 fixture`);
      });
    });
  }
});
