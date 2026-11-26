// Conversion eval runner (W1 R7 P4 t4, acceptance A26; PRD 07 Contracts and Data).
//
// ---------------------------------------------------------------------------
// SIMILARITY METHOD. Declared before any candidate converter runs; do not
// change it to make a candidate pass.
//
// 1. Normalization. Both the reference text and the converter output are put
//    in Unicode NFC. Every run of white space (spaces, tabs, line breaks, and
//    the other characters JavaScript's \s matches) becomes one space, and the
//    ends are trimmed. Nothing else changes: case, punctuation, and Markdown
//    or CSV markup all count.
// 2. Similarity. Character-level: 1 - d / max(|ref|, |out|), where d is the
//    Levenshtein edit distance (insert, delete, or substitute one Unicode
//    code point, each cost 1) between the normalized reference and the
//    normalized output, and |x| is a length in code points. Two empty texts
//    score 1.
// 3. Section coverage. For each reference section, coverage is
//    1 - e / |section|, where e is the smallest edit distance between the
//    normalized section text and any substring of the normalized output.
//    A section is found when its coverage is at least 0.90, and lost when it
//    is below.
// 4. Gate. A file passes when no section is lost and its similarity is at
//    least 0.98. A "no-text" file (a scan with no text layer) passes only
//    when the converter reports no usable text; OCR is out of scope.
//
// The converter output for a file is its twin bodies (no frontmatter), in the
// order of the manifest `parts`, joined with one line break.
// ---------------------------------------------------------------------------
//
// The converter under test is a module named by BUILDOS_EVAL_CONVERTER that
// exports `converter: EvalConverter`. BUILDOS_EVAL_FORMATS (a comma list)
// limits the run to some formats. BUILDOS_EVAL_REPORT names a JSON file for
// the per-file results. With no converter set, the gate runs the in-package
// converter (package-converter.ts, P4 t8).

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { EVAL_ROOT, type EvalFile, loadManifest, loadReference, type ReferenceSection, referenceText } from "./references.ts";

export const METHOD = {
  normalization: "Unicode NFC; every white-space run becomes one space; ends trimmed",
  similarity: "1 - levenshtein(ref, out) / max(len(ref), len(out)), over Unicode code points",
  sectionCoverage: "1 - (min edit distance from the section text to any substring of the output) / len(section)",
  sectionFoundAt: 0.9,
  passSimilarity: 0.98,
} as const;

export interface EvalConverter {
  name: string;
  /** Returns the twin bodies for one eval file, in manifest `parts` order. Throws when it finds no usable text. */
  convert(sourcePath: string, file: EvalFile): Promise<string[]>;
}

export interface SectionResult {
  name: string;
  coverage: number;
  found: boolean;
}

export interface FileResult {
  id: string;
  format: string;
  similarity: number;
  sections: SectionResult[];
  lost: string[];
  pass: boolean;
  error?: string;
}

export function normalize(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function codePoints(text: string): Uint32Array {
  return Uint32Array.from(text, (ch) => ch.codePointAt(0) as number);
}

/** Levenshtein distance. With `anySubstringOfB`, the distance from `a` to the closest substring of `b`. */
function editDistance(a: Uint32Array, b: Uint32Array, anySubstringOfB: boolean): number {
  let prev = new Int32Array(b.length + 1);
  let cur = new Int32Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = anySubstringOfB ? 0 : j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= b.length; j++) {
      const sub = (prev[j - 1] as number) + (ai === b[j - 1] ? 0 : 1);
      const del = (prev[j] as number) + 1;
      const ins = (cur[j - 1] as number) + 1;
      cur[j] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
    }
    [prev, cur] = [cur, prev];
  }
  if (!anySubstringOfB) return prev[b.length] as number;
  let best = a.length;
  for (const v of prev) if (v < best) best = v;
  return best;
}

export function similarity(reference: string, output: string): number {
  const a = codePoints(normalize(reference));
  const b = codePoints(normalize(output));
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b, false) / longest;
}

export function sectionCoverage(section: string, output: string): number {
  const a = codePoints(normalize(section));
  if (a.length === 0) throw new Error("a reference section has no text");
  return 1 - editDistance(a, codePoints(normalize(output)), true) / a.length;
}

export function evaluate(file: Pick<EvalFile, "id" | "format">, sections: readonly ReferenceSection[], output: string): FileResult {
  const sim = similarity(referenceText(sections), output);
  const results = sections.map((s) => {
    const coverage = sectionCoverage(s.text, output);
    return { name: s.name, coverage, found: coverage >= METHOD.sectionFoundAt };
  });
  const lost = results.filter((r) => !r.found).map((r) => r.name);
  return { id: file.id, format: file.format, similarity: sim, sections: results, lost, pass: lost.length === 0 && sim >= METHOD.passSimilarity };
}

export async function runFile(converter: EvalConverter, file: EvalFile, root = EVAL_ROOT): Promise<FileResult> {
  const sections = loadReference(file, root);
  let parts: string[];
  try {
    parts = await converter.convert(join(root, ...file.source.split("/")), file);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (file.expect === "no-text") return { id: file.id, format: file.format, similarity: 1, sections: [], lost: [], pass: true, error };
    return { id: file.id, format: file.format, similarity: 0, sections: sections.map((s) => ({ name: s.name, coverage: 0, found: false })), lost: sections.map((s) => s.name), pass: false, error };
  }
  const output = parts.join("\n");
  if (file.expect === "no-text") {
    const text = normalize(output);
    return { id: file.id, format: file.format, similarity: text === "" ? 1 : 0, sections: [], lost: [], pass: text === "", ...(text === "" ? {} : { error: `expected no text, got ${text.length} characters` }) };
  }
  return evaluate(file, sections, output);
}

export function formatResults(results: readonly FileResult[]): string {
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const lines = ["file | similarity | sections found | lost | pass"];
  for (const r of results) {
    const found = r.sections.filter((s) => s.found).length;
    lines.push(`${r.id} | ${pct(r.similarity)} | ${found}/${r.sections.length} | ${r.lost.join("; ") || "-"} | ${r.pass ? "yes" : "NO"}${r.error !== undefined ? ` (${r.error})` : ""}`);
  }
  return lines.join("\n");
}

/** Replaces evenly spaced characters so that about `fraction` of the text differs. */
function damage(text: string, fraction: number): string {
  const chars = Array.from(text);
  const k = Math.round(chars.length * fraction);
  for (let j = 0; j < k; j++) {
    const i = Math.floor(((j + 0.5) * chars.length) / k);
    chars[i] = chars[i] === "#" ? "%" : "#";
  }
  return chars.join("");
}

const manifest = loadManifest();

describe("conversion eval set", () => {
  it("declares its method before any candidate runs", () => {
    assert.equal(METHOD.passSimilarity, 0.98);
    assert.equal(METHOD.sectionFoundAt, 0.9);
    assert.equal(normalize("  a\t\r\n b  c d "), "a b c d");
    assert.equal(normalize("é"), "é");
    assert.equal(similarity("kitten", "sitting"), 1 - 3 / 7);
    assert.equal(similarity("", ""), 1);
    assert.equal(sectionCoverage("abc", "xxabcxx"), 1);
  });

  it("has a reference for every eval file, with the manifest's sections in order", () => {
    assert.ok(manifest.files.length >= 12);
    const formats = new Set(manifest.files.map((f) => f.format));
    for (const format of ["csv", "docx", "xlsx", "html", "html-dir", "pdf"]) assert.ok(formats.has(format as EvalFile["format"]), `no ${format} eval file`);
    for (const file of manifest.files) {
      const sections = loadReference(file);
      assert.deepEqual(sections.map((s) => s.name), file.sections, file.id);
      for (const s of sections) assert.notEqual(normalize(s.text), "", `${file.id}: section ${s.name} is empty`);
      if (file.expect === "no-text") assert.equal(sections.length, 0, `${file.id} must have an empty reference`);
    }
  });

  it("has a human reviewer, a date, and an approval for every eval file in REVIEW.md (A25)", () => {
    const rows = readFileSync(join(EVAL_ROOT, "REVIEW.md"), "utf8").split("\n").filter((line) => line.startsWith("| ") && !line.startsWith("| Eval file") && !line.startsWith("| ---"));
    for (const file of loadManifest().files) {
      const cells = rows.find((line) => line.startsWith(`| ${file.id} |`))?.split("|").map((c) => c.trim());
      assert.ok(cells !== undefined, `REVIEW.md has no row for ${file.id}`);
      const [reviewer, date, approved] = cells.slice(-4, -1);
      assert.ok(reviewer !== undefined && reviewer !== "", `${file.id} has no reviewer`);
      assert.match(date ?? "", /^\d{4}-\d{2}-\d{2}$/, `${file.id} has no review date`);
      assert.equal(approved, "yes", `${file.id} is not approved`);
    }
  });

  it("passes a converter that writes exactly the reference text", async () => {
    const exact: EvalConverter = { name: "reference", convert: async (_s, file) => (file.expect === "no-text" ? [] : [referenceText(loadReference(file))]) };
    for (const file of manifest.files) {
      const r = await runFile(exact, file);
      assert.ok(r.pass, `${file.id}: ${formatResults([r])}`);
      assert.equal(r.similarity, 1);
    }
  });

  it("fails on a planted reference with one extra section (A26)", () => {
    const file = manifest.files.find((f) => f.id === "docx-committee-minutes") as EvalFile;
    const sections = loadReference(file);
    const planted = [...sections, { name: "Planted extra section", text: "Any other business: the committee agreed to repaint the lobby in spring." }];
    const r = evaluate(file, planted, referenceText(sections));
    assert.equal(r.pass, false);
    assert.deepEqual(r.lost, ["Planted extra section"]);
  });

  it("fails on a planted output with 97% similarity and passes one at 98.5% (A26)", () => {
    const file = manifest.files.find((f) => f.id === "pdf-annual-report") as EvalFile;
    const sections = loadReference(file);
    const text = normalize(referenceText(sections));
    const at97 = evaluate(file, sections, damage(text, 0.03));
    assert.ok(at97.similarity >= 0.965 && at97.similarity <= 0.975, `planted similarity ${at97.similarity}`);
    assert.deepEqual(at97.lost, []);
    assert.equal(at97.pass, false);
    const at985 = evaluate(file, sections, damage(text, 0.015));
    assert.ok(at985.similarity >= 0.98, `planted similarity ${at985.similarity}`);
    assert.equal(at985.pass, true);
  });

  it("fails a scan-only file when a converter returns text for it", async () => {
    const file = manifest.files.find((f) => f.expect === "no-text") as EvalFile;
    const ocr: EvalConverter = { name: "ocr", convert: async () => ["SAMPLE HOUSING COOPERATIVE REPAIR NOTICE"] };
    assert.equal((await runFile(ocr, file)).pass, false);
    const none: EvalConverter = { name: "none", convert: async () => { throw new Error("pdf text extraction produced no usable text"); } };
    assert.equal((await runFile(none, file)).pass, true);
  });

  // The in-package converter (package-converter.ts, W1 R7 P4 t8) unless BUILDOS_EVAL_CONVERTER names another.
  const converterPath = process.env["BUILDOS_EVAL_CONVERTER"] ?? join(EVAL_ROOT, "package-converter.ts");
  it("gate: every eval file keeps every section and scores at least 98%", async (t) => {
    const mod = (await import(pathToFileURL(resolve(converterPath as string)).href)) as { converter: EvalConverter };
    const formats = process.env["BUILDOS_EVAL_FORMATS"]?.split(",").map((f) => f.trim()).filter((f) => f !== "");
    const files = manifest.files.filter((f) => formats === undefined || formats.includes(f.format));
    assert.ok(files.length > 0, "no eval file matches BUILDOS_EVAL_FORMATS");
    const results: FileResult[] = [];
    for (const file of files) results.push(await runFile(mod.converter, file));
    t.diagnostic(`converter: ${mod.converter.name}\n${formatResults(results)}`);
    const report = process.env["BUILDOS_EVAL_REPORT"];
    if (report !== undefined) writeFileSync(report, `${JSON.stringify({ converter: mod.converter.name, method: METHOD, results }, null, 2)}\n`);
    const failed = results.filter((r) => !r.pass);
    assert.deepEqual(failed.map((r) => r.id), [], formatResults(failed));
  });
});
