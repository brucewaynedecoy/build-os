// Conversion eval set checks (W1 R7 P4 t1).
//
// The eval inputs, the manifest, and the review page are generated, not
// hand-made: regenerating them must give the committed bytes. Git must never
// rewrite their bytes on any operating system, so they carry `-text`. The
// review page must work offline: no script, and no outside URL.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { generatedEvalFiles } from "./generate-eval.ts";
import { EVAL_ROOT } from "./references.ts";

function walk(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(EVAL_ROOT, join(e.parentPath, e.name)).split("\\").join("/"))
    .sort();
}

describe("conversion eval generator", () => {
  const generated = generatedEvalFiles();

  it("matches the committed inputs, manifest, and review page byte for byte", () => {
    for (const [rel, data] of generated) {
      const committed = readFileSync(join(EVAL_ROOT, ...rel.split("/")));
      assert.ok(committed.equals(data), `${rel} differs from generate-eval.ts output; run node test/conversion-eval/generate-eval.ts`);
    }
  });

  it("leaves no stale input file behind", () => {
    assert.deepEqual(walk(join(EVAL_ROOT, "inputs")), [...generated.keys()].filter((rel) => rel.startsWith("inputs/")).sort());
  });

  it("writes a review page with no script and no outside link or resource", () => {
    const html = (generated.get("review.html") as Buffer).toString("utf8");
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /<link\b/i);
    assert.doesNotMatch(html, /(src|href)="(https?:)?\/\//i);
    assert.doesNotMatch(html, /@import|url\(/i);
    assert.match(html, /Content-Security-Policy" content="default-src 'none'/);
    for (const id of JSON.parse((generated.get("manifest.json") as Buffer).toString("utf8")).files.map((f: { id: string }) => f.id)) assert.match(html, new RegExp(`id="${id}"`));
  });

  it("is checked out without line-ending or text conversion", (t) => {
    const paths = ["inputs/csv/maintenance-requests.csv", "inputs/docx/operations-handbook.docx", "inputs/pdf/pet-policy.pdf", "references/pdf-rates-table.txt", "review.html", "manifest.json"];
    const probe = spawnSync("git", ["check-attr", "text", "--", ...paths], { cwd: EVAL_ROOT, encoding: "utf8" });
    if (probe.status !== 0) {
      t.skip("git is not available");
      return;
    }
    for (const line of probe.stdout.trim().split("\n")) assert.match(line, /: text: unset$/, line);
  });

  it("keeps the CSV input's CRLF line endings", () => {
    assert.ok(readFileSync(join(EVAL_ROOT, "inputs", "csv", "maintenance-requests.csv")).includes("\r\n"));
  });
});
