// The Go intake tool's unit tests, ported to node:test (W1 R7 P4 t11):
// toolkits/buildos-intake/internal/intake/convert_test.go and index_test.go,
// and cmd/buildos-intake/main_test.go, by their Go names. After them, checks
// for the port itself: Go encoding/csv errors, Go flag usage, the in-place
// write, the legacy invocation name, and the PE-008 div rule.
//
// Go paths in this comment name the Go sources at the frozen baseline
// commit 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).

import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { after, describe, it } from "node:test";
import { intakeParsers } from "../src/adapters/intake-parsers.ts";
import { createNodeFsPort, createNodeInPlaceWriter } from "../src/adapters/node-fs.ts";
import { CONVERT_FLAGS, INTAKE_USAGE } from "../src/cli/commands/intake.ts";
import { ALLOW_OUTSIDE_ROOT } from "../src/cli/commands/go-tool.ts";
import { goParseFlags, goPrintDefaults, GoFlagError } from "../src/cli/go-flagset.ts";
import { invocationArgs } from "../src/cli/invocation.ts";
import { run } from "../src/cli/run.ts";
import { convert, type ConvertOptions } from "../src/core/intake/convert/convert.ts";
import { readCsv, writeCsv } from "../src/core/intake/convert/csv.ts";
import { htmlToMarkdown } from "../src/core/intake/convert/html.ts";
import { resolvePackageRelationshipTarget } from "../src/core/intake/convert/xlsx.ts";
import { goUnquoteDouble } from "../src/core/intake/index/frontmatter.ts";
import { buildPlaybooksIndex, buildReferencesIndex, type IndexOptions } from "../src/core/intake/index/index.ts";
import { GoError, type IntakeContext } from "../src/core/intake/io.ts";
import { zip } from "./golden/generate-fixtures.ts";
import { captureIo } from "./helpers.ts";

const roots: string[] = [];
after(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), "buildos-intake-test-"));
  roots.push(root);
  return root;
}

const context = (cwd: string): IntakeContext => ({ cwd, openFs: createNodeFsPort, openWriter: createNodeInPlaceWriter, parsers: intakeParsers });

function Convert(opts: Partial<ConvertOptions> & { repoRoot: string; source: string }) {
  return convert(context(opts.repoRoot), { assetsRoot: "system/assets", type: "auto", force: false, dryRun: false, ...opts });
}

const indexOptions = (o: Partial<IndexOptions> & { repoRoot: string }): IndexOptions => ({ assetsRoot: "", playbooksRoot: "", output: "", ...o });
const BuildReferencesIndex = (o: Partial<IndexOptions> & { repoRoot: string }) => buildReferencesIndex(context(o.repoRoot), indexOptions(o));
const BuildPlaybooksIndex = (o: Partial<IndexOptions> & { repoRoot: string }) => buildPlaybooksIndex(context(o.repoRoot), indexOptions(o));

function writeTextFile(root: string, rel: string, body: string): void {
  const path = join(root, ...rel.split("/"));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}
const writePlaybook = writeTextFile;
const readTextFile = (root: string, rel: string) => readFileSync(join(root, ...rel.split("/")), "utf8");

function writeZip(path: string, files: Record<string, string>): void {
  writeFileSync(path, zip(Object.entries(files)));
}

function escapePdfText(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

/** Go `minimalPDF`. */
function minimalPdf(text: string): Buffer {
  let b = "%PDF-1.4\n";
  const offsets = [0];
  const addObject = (body: string) => {
    offsets.push(b.length);
    b += `${offsets.length - 1} 0 obj\n${body}\nendobj\n`;
  };
  const stream = `BT /F1 24 Tf 100 700 Td (${escapePdfText(text)}) Tj ET`;
  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject("<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>");
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const xref = b.length;
  b += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) b += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  b += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(b, "latin1");
}

function includesAll(text: string, wants: readonly string[]): void {
  for (const want of wants) assert.ok(text.includes(want), `missing ${JSON.stringify(want)} in\n${text}`);
}

describe("convert_test.go", () => {
  it("TestConvertCSVWritesFrontmatterAndBody", async () => {
    const root = tempDir();
    writeFileSync(join(root, "input.csv"), "name,value\nA,1\n");
    const result = await Convert({ repoRoot: root, source: "input.csv" });
    assert.equal(result.outputs.length, 1);
    includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ['source: "input.csv"', 'type: "csv"', 'status: "converted"', "name,value\nA,1\n"]);
  });

  it("TestConvertDOCXExtractsParagraphText", async () => {
    const root = tempDir();
    writeZip(join(root, "sample.docx"), {
      "word/document.xml": `<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t> world</w:t></w:r></w:p></w:body></w:document>`,
    });
    const result = await Convert({ repoRoot: root, source: "sample.docx" });
    includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ["Hello world"]);
  });

  it("TestConvertDOCXPreservesHeadingsAndLists", async () => {
    const root = tempDir();
    writeZip(join(root, "outline.docx"), {
      "word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:rPr><w:b/><w:u w:val="single"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>Section</w:t></w:r></w:p>
<w:p><w:r><w:t>\uf0b7</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> Parent Item</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Child Item</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Grandchild Item</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Next Section</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t>Ordered Item</w:t></w:r></w:p>
</w:body></w:document>`,
      "word/numbering.xml": `<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="10"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="20"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="10"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="20"/></w:num>
</w:numbering>`,
    });
    const result = await Convert({ repoRoot: root, source: "outline.docx" });
    includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ["## Section", "- **Parent Item**\n  - Child Item\n    - Grandchild Item", "## Next Section\n\n1. Ordered Item"]);
  });

  it("TestConvertXLSXWritesOneCSVPerWorksheet", async () => {
    const root = tempDir();
    writeZip(join(root, "book.xlsx"), {
      "xl/workbook.xml": `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet One" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<sst><si><t>Name</t></si><si><t>A</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2</v></c></row><row><c r="A2" t="s"><v>1</v></c><c r="B2"><v>3</v></c></row></sheetData></worksheet>`,
    });
    const result = await Convert({ repoRoot: root, source: "book.xlsx" });
    assert.equal(result.outputs.length, 1);
    includesAll(result.outputs[0]!.path + readFileSync(result.outputs[0]!.path, "utf8"), ["book-sheet-one.csv", "Name,2\nA,3\n"]);
  });

  for (const test of [
    { name: "package root sheet", target: "/xl/worksheets/sheet.xml", entry: "xl/worksheets/sheet.xml" },
    { name: "package root sheet2", target: "/xl/worksheets/sheet2.xml", entry: "xl/worksheets/sheet2.xml" },
    { name: "relative sheet", target: "worksheets/sheet.xml", entry: "xl/worksheets/sheet.xml" },
    { name: "relative sheet2", target: "worksheets/sheet2.xml", entry: "xl/worksheets/sheet2.xml" },
    { name: "relative parent segment", target: "../xl/worksheets/sheet.xml", entry: "xl/worksheets/sheet.xml" },
  ]) {
    it(`TestConvertXLSXResolvesWorksheetRelationshipTargets/${test.name}`, async () => {
      const root = tempDir();
      const source = join(root, "book.xlsx");
      writeZip(source, {
        "xl/workbook.xml": `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="${test.target}"/></Relationships>`,
        "xl/sharedStrings.xml": `<sst><si><t>Value</t></si></sst>`,
        [test.entry]: `<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c></row><row><c r="A2"><v>1</v></c></row></sheetData></worksheet>`,
      });
      const before = readFileSync(source);
      const result = await Convert({ repoRoot: root, source: "book.xlsx" });
      assert.equal(result.outputs.length, 1);
      includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ["Value\n1\n"]);
      assert.ok(readFileSync(source).equals(before), "source XLSX changed during conversion");
    });
  }

  for (const target of ["../../worksheets/sheet.xml", "/../worksheets/sheet.xml"]) {
    it(`TestResolvePackageRelationshipTargetRejectsPackageRootEscape/${target}`, () => {
      assert.throws(() => resolvePackageRelationshipTarget("xl/workbook.xml", target), (e: Error) => e instanceof GoError && e.message.includes("escapes package root"));
    });
  }

  it("TestConvertHTMLWritesMarkdown", async () => {
    const root = tempDir();
    writeFileSync(
      join(root, "page.html"),
      `<html><body><h1>Title</h1><p>See <a href="https://example.test">Example</a>.</p><ul><li>First</li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>`,
    );
    const result = await Convert({ repoRoot: root, source: "page.html" });
    includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ["# Title", "[Example](https://example.test)", "- First", "| A | B |\n| --- | --- |\n| 1 | 2 |"]);
  });

  it("TestConvertHTMLCapturesEmbedsAsSideArtifacts", async () => {
    const root = tempDir();
    writeFileSync(
      join(root, "diagram.html"),
      `<html><body><h1>Diagrams</h1><div class="mermaid">
erDiagram
  BookCopy ||--o{ LendingPolicy : governed_by
</div><img alt="inline logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0PkxvZ288L3RleHQ+PC9zdmc+"/></body></html>`,
    );
    const result = await Convert({ repoRoot: root, source: "diagram.html" });
    assert.equal(result.sideArtifacts.length, 2, JSON.stringify(result.sideArtifacts));
    includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ["[Mermaid diagram source](diagrams/diagram-mermaid-001.mmd)", "```mermaid\nerDiagram", "![inline logo](media/diagram-image-001.svg)"]);
    for (const artifact of result.sideArtifacts) assert.ok(statSync(artifact).isFile(), `missing side artifact ${artifact}`);
  });

  it("TestConvertHTMLDirWritesOneOutputPerHTMLFile", async () => {
    const root = tempDir();
    writeTextFile(root, "site/index.html", "<h1>Home</h1>");
    writeTextFile(root, "site/docs/page.html", "<h1>Docs</h1>");
    const result = await Convert({ repoRoot: root, source: "site" });
    assert.equal(result.outputs.length, 2);
    includesAll(`${result.outputs[0]!.path}\n${result.outputs[1]!.path}`, ["docs-page.md", "index.md"]);
  });

  it("TestConvertPDFExtractsMinimalText", async () => {
    const root = tempDir();
    writeFileSync(join(root, "simple.pdf"), minimalPdf("Hello PDF"));
    const result = await Convert({ repoRoot: root, source: "simple.pdf" });
    includesAll(readFileSync(result.outputs[0]!.path, "utf8"), ['type: "text"', "Hello PDF"]);
  });

  it("TestBuildReferencesIndex", async () => {
    const root = tempDir();
    writeFileSync(join(root, "input.csv"), "name,value\nA,1\n");
    await Convert({ repoRoot: root, source: "input.csv" });
    const result = BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: "system/.os/indexes/references.json" });
    assert.equal(result.count, 1);
    includesAll(readFileSync(result.outputPath, "utf8"), ['"id": "REF-001"', '"source": "input.csv"', '"status": "converted"']);
  });

  it("TestBuildPlaybooksIndex", () => {
    const root = tempDir();
    writePlaybook(root, "system/playbooks/testing/zeta.md", `---
id: PB-010
title: Zeta playbook
category: testing
execution_mode: explicit-steps
state_nature: standing
status: active
audience: both
harness: [shell, mcp]
systems: [crm]
environments: [dev, prod]
owners: [qa]
targets: [REQ-001, TC-002]
produces: [run-record, finding]
source_anchor: docs/prd/09-playbooks.md#scope
version: 1.2.3
related:
  - ../../.os/contracts/playbook-contract.md
  - docs/prd/09-playbooks.md
---
# Zeta
`);
    writePlaybook(root, "system/playbooks/testing/alpha.md", `---
id: PB-002
title: Alpha playbook
category: testing
execution_mode: n/a
state_nature: guardrail
status: active
audience: agent
harness: [none]
systems: []
environments: []
owners: []
targets: []
produces: []
source_anchor: null
version: 1.0.0
related: [REQ-002, docs/prd/09-playbooks.md]
---
## Scope
`);
    writePlaybook(root, "system/playbooks/testing/draft.md", `---
id: PB-003
title: Draft playbook
category: testing
execution_mode: guided-objective
state_nature: stateful
status: draft
audience: human
harness: [shell]
systems: [crm]
environments: [dev]
owners: [qa]
targets: [REQ-003]
produces: [run-record]
source_anchor: null
version: 0.1.0
related: []
---
# Draft
`);
    writePlaybook(root, "system/playbooks/testing/reviewed.md", `---
id: PB-004
title: Reviewed playbook
category: testing
execution_mode: explicit-steps
state_nature: standing
status: reviewed
audience: agent
harness: [mcp]
systems: [crm]
environments: [prod]
owners: [qa]
targets: [REQ-004]
produces: [finding]
source_anchor: null
version: 0.2.0
related: []
---
# Reviewed
`);
    writePlaybook(root, "system/playbooks/testing/AGENTS.md", "# Router\n");
    const result = BuildPlaybooksIndex({ repoRoot: root, playbooksRoot: "system/playbooks", output: "system/.os/indexes/playbooks.json" });
    assert.equal(result.count, 4);
    const data = readFileSync(result.outputPath, "utf8");
    assert.ok(!data.includes('"systems": null'), "empty list fields must serialize as arrays");
    type Entry = Record<string, unknown> & { id: string; status: string; source_anchor: string | null; path: string };
    const index = JSON.parse(data) as { version: number; playbooks: Entry[]; runnable_playbooks: Entry[] };
    assert.equal(index.version, 1);
    assert.deepEqual(index.playbooks.map((p) => p.id), ["PB-002", "PB-003", "PB-004", "PB-010"]);
    assert.equal(index.playbooks[1]!.status, "draft");
    assert.equal(index.playbooks[2]!.status, "reviewed");
    assert.deepEqual(index.runnable_playbooks.map((p) => p.id), ["PB-002", "PB-010"]);
    const alpha = index.playbooks[0]!;
    assert.equal(alpha.path, "system/playbooks/testing/alpha.md");
    for (const key of ["title", "category", "execution_mode", "state_nature", "status", "audience", "version"]) assert.notEqual(alpha[key], "");
    assert.equal(alpha.source_anchor, null);
    for (const key of ["systems", "environments", "owners", "targets", "produces"]) assert.deepEqual(alpha[key], []);
    assert.deepEqual(alpha["harness"], ["none"]);
    assert.deepEqual(alpha["related"], ["REQ-002", "docs/prd/09-playbooks.md"]);
    const zeta = index.playbooks[3]!;
    assert.equal(zeta.source_anchor, "docs/prd/09-playbooks.md#scope");
    assert.deepEqual(zeta["harness"], ["shell", "mcp"]);
    assert.deepEqual(zeta["systems"], ["crm"]);
    assert.deepEqual(zeta["environments"], ["dev", "prod"]);
    assert.deepEqual(zeta["owners"], ["qa"]);
    assert.deepEqual(zeta["targets"], ["REQ-001", "TC-002"]);
    assert.deepEqual(zeta["produces"], ["run-record", "finding"]);
    assert.deepEqual(zeta["related"], ["../../.os/contracts/playbook-contract.md", "docs/prd/09-playbooks.md"]);
  });

  it("TestBuildPlaybooksIndexRejectsMissingRequiredFields", () => {
    const root = tempDir();
    writePlaybook(root, "system/playbooks/testing/broken.md", "---\nid: PB-099\ntitle: Broken playbook\ncategory: testing\n---\n# Broken\n");
    assert.throws(
      () => BuildPlaybooksIndex({ repoRoot: root, playbooksRoot: "system/playbooks", output: "system/.os/indexes/playbooks.json" }),
      (e: Error) => ["broken.md", "execution_mode", "harness", "related"].every((w) => e.message.includes(w)),
    );
  });

  it("TestPDFInvalidInputFails", async () => {
    const root = tempDir();
    writeFileSync(join(root, "bad.pdf"), "%PDF bad");
    await assert.rejects(Convert({ repoRoot: root, source: "bad.pdf" }), GoError);
  });

  it("TestInstalledRootLayoutUsesTopLevelSystemDirs", async () => {
    const root = tempDir();
    for (const rel of [".os", "assets/_incoming", "docs", "playbooks/testing", "workspace"]) mkdirSync(join(root, ...rel.split("/")), { recursive: true });
    writeTextFile(root, "assets/_incoming/input.csv", "name,value\nalpha,1\n");
    const result = await Convert({ repoRoot: root, source: "assets/_incoming/input.csv" });
    assert.equal(result.outputs.length, 1);
    const wantOutput = join(root, "assets", "input", "input.csv");
    assert.equal(result.outputs[0]!.path, wantOutput);
    assert.ok(readFileSync(wantOutput, "utf8").includes('source: "assets/_incoming/input.csv"'));
    const references = BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: "system/.os/indexes/references.json" });
    assert.equal(references.outputPath, join(root, ".os", "indexes", "references.json"));
    assert.ok(readTextFile(root, ".os/indexes/references.json").includes('"converted": "assets/input/input.csv"'));
    writePlaybook(root, "playbooks/testing/sample.md", `---
id: PB-001
title: Sample
category: testing
execution_mode: guided
state_nature: stateless
status: active
audience: both
harness:
  - agent
systems: []
environments: []
owners: []
targets: []
produces: []
source_anchor: null
version: "1.0.0"
related: []
---
# Sample
`);
    const index = BuildPlaybooksIndex({ repoRoot: root, playbooksRoot: "system/playbooks", output: "system/.os/indexes/playbooks.json" });
    assert.equal(index.outputPath, join(root, ".os", "indexes", "playbooks.json"));
    assert.ok(readTextFile(root, ".os/indexes/playbooks.json").includes('"path": "playbooks/testing/sample.md"'));
  });
});

describe("index_test.go", () => {
  const OUTPUT = "system/.os/indexes/references.json";

  async function convertTestCsv(root: string, name: string): Promise<string> {
    writeTextFile(root, `${name}.csv`, `name,value\n${name},1\n`);
    const result = await Convert({ repoRoot: root, source: `${name}.csv`, force: true });
    assert.equal(result.outputs.length, 1);
    return relative(root, result.outputs[0]!.path).split(sep).join("/");
  }

  function build(root: string) {
    const result = BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: OUTPUT });
    const index = JSON.parse(readTextFile(root, OUTPUT)) as { next_id: number; references: { id: string; converted: string }[] | null };
    const refs = index.references ?? [];
    assert.equal(result.count, refs.length);
    return { ids: new Map(refs.map((e) => [e.converted, e.id])), order: refs.map((e) => e.id), nextId: index.next_id };
  }

  const remove = (root: string, converted: string) => rmSync(join(root, ...converted.split("/")));

  it("TestBuildReferencesIndexKeepsIDsWhenTwinRemoved", async () => {
    const root = tempDir();
    const twins: Record<string, string> = {};
    for (const name of ["alpha", "bravo", "charlie", "delta"]) twins[name] = await convertTestCsv(root, name);
    const before = build(root);
    ["alpha", "bravo", "charlie", "delta"].forEach((name, i) => assert.equal(before.ids.get(twins[name]!), `REF-00${i + 1}`));
    remove(root, twins["bravo"]!);
    const afterRemoval = build(root);
    assert.equal(afterRemoval.ids.size, 3);
    assert.ok(!afterRemoval.ids.has(twins["bravo"]!));
    for (const name of ["alpha", "charlie", "delta"]) assert.equal(afterRemoval.ids.get(twins[name]!), before.ids.get(twins[name]!));
    assert.equal(afterRemoval.nextId, 5);
    assert.deepEqual(afterRemoval.order, ["REF-001", "REF-003", "REF-004"]);
  });

  it("TestBuildReferencesIndexNeverReusesRemovedIDs", async () => {
    const root = tempDir();
    const alpha = await convertTestCsv(root, "alpha");
    const bravo = await convertTestCsv(root, "bravo");
    build(root);
    remove(root, bravo);
    build(root);
    const charlie = await convertTestCsv(root, "charlie");
    let got = build(root);
    assert.equal(got.ids.get(alpha), "REF-001");
    assert.equal(got.ids.get(charlie), "REF-003");
    await convertTestCsv(root, "bravo");
    got = build(root);
    assert.equal(got.ids.get(bravo), "REF-004");
    assert.equal(got.nextId, 5);
  });

  it("TestBuildReferencesIndexKeepsLegacyInsertionOrderIDs", async () => {
    const root = tempDir();
    const zulu = await convertTestCsv(root, "zulu");
    const alpha = await convertTestCsv(root, "alpha");
    writeTextFile(
      root,
      OUTPUT,
      `{\n  "version": 1,\n  "references": [\n    {"id": "REF-001", "converted": "${zulu}"},\n    {"id": "REF-002", "converted": "${alpha}"},\n    {"id": "REF-003", "converted": "system/assets/gone/gone.csv"}\n  ]\n}\n`,
    );
    const mike = await convertTestCsv(root, "mike");
    const got = build(root);
    assert.equal(got.ids.get(zulu), "REF-001");
    assert.equal(got.ids.get(alpha), "REF-002");
    assert.equal(got.ids.get(mike), "REF-004");
    assert.equal(got.ids.size, 3);
  });

  it("TestBuildReferencesIndexRefusesUnreadableExistingIndex", async () => {
    const root = tempDir();
    await convertTestCsv(root, "alpha");
    writeTextFile(root, OUTPUT, "{not json");
    assert.throws(() => BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: OUTPUT }), GoError);
    assert.equal(readTextFile(root, OUTPUT), "{not json");
  });
});

describe("main_test.go", () => {
  it("TestRunIndexPlaybooksCommand", async () => {
    const root = tempDir();
    writePlaybook(root, "system/playbooks/testing/sample.md", `---
id: PB-001
title: Sample playbook
category: testing
execution_mode: explicit-steps
state_nature: standing
status: active
audience: both
harness: [shell]
systems: []
environments: []
owners: []
targets: []
produces: [run-record]
source_anchor: null
version: 1.0.0
related: []
---
# Sample
`);
    const output = join(root, "custom", "playbooks.json");
    const io = captureIo(root);
    const code = await run(["intake", "index", "playbooks", "--repo-root", root, "--playbooks-root", "system/playbooks", "--output", output], io);
    assert.equal(code, 0, io.stderr());
    assert.ok(io.stdout().includes(`wrote ${output} (1 playbooks)`), io.stdout());
    includesAll(readFileSync(output, "utf8"), ['"version": 1', '"playbooks":', '"runnable_playbooks":', '"id": "PB-001"', '"path": "system/playbooks/testing/sample.md"']);
  });

  it("TestUsageIncludesPlaybooksIndex", () => {
    assert.ok(INTAKE_USAGE.includes("buildos-intake index playbooks"));
  });
});

describe("port checks", () => {
  const text = (rows: Uint8Array[][]) => rows.map((r) => r.map((f) => Buffer.from(f).toString("utf8")));
  const csvError = (input: string) => {
    try {
      readCsv(Buffer.from(input));
    } catch (error) {
      return (error as Error).message;
    }
    return "no error";
  };

  it("reads CSV as Go encoding/csv does", () => {
    assert.deepEqual(text(readCsv(Buffer.from('a,"b,c"\r\n\r\n"x""y","multi\r\nline"\nlast\r'))), [["a", "b,c"], ['x"y', "multi\nline"], ["last"]]);
    assert.equal(csvError('a,b"c\n'), 'parse error on line 1, column 4: bare " in non-quoted-field');
    assert.equal(csvError('a,"b"c\n'), 'parse error on line 1, column 5: extraneous or missing " in quoted-field');
    assert.equal(csvError('x\n"open\nmore'), 'record on line 2; parse error on line 3, column 5: extraneous or missing " in quoted-field');
  });

  it("writes CSV as Go encoding/csv does", () => {
    const rows = [["", "plain", " lead", "\u3000wide", "q\"uote", "line\nbreak", "\\."].map((f) => Buffer.from(f)), []];
    assert.equal(Buffer.from(writeCsv(rows)).toString("utf8"), ',plain," lead","\u3000wide","q""uote","line\nbreak","\\."\n\n');
  });

  it("prints Go flag usage", () => {
    assert.equal(
      goPrintDefaults([
        { name: "x", kind: "bool", usage: "short" },
        { name: "long", kind: "string", usage: "a value", default: "d" },
      ]),
      '  -long string\n    \ta value (default "d")\n  -x\tshort\n',
    );
  });

  it("unquotes front matter values as Go strconv.Unquote does", () => {
    assert.equal(goUnquoteDouble('"1.0.0"'), "1.0.0");
    assert.equal(goUnquoteDouble('"a\\tb\\u00e9\\x41\\101"'), "a\tbéAA");
    assert.equal(goUnquoteDouble('"a"b"'), undefined);
    assert.equal(goUnquoteDouble("\"it\\'s\""), undefined);
  });

  it("maps the buildos-intake name to buildos intake", () => {
    assert.deepEqual(invocationArgs("buildos-intake", ["convert", "--source", "a"]), ["intake", "convert", "--source", "a"]);
    assert.deepEqual(invocationArgs(undefined, ["version"]), ["version"]);
  });

  it("fails like Go os.WriteFile on a read-only index, where an atomic rename would succeed", { skip: process.platform === "win32" || process.getuid?.() === 0 ? "POSIX non-root only" : false }, async () => {
    const root = tempDir();
    writeTextFile(root, "system/.os/indexes/references.json", "");
    chmodSync(join(root, "system/.os/indexes/references.json"), 0o444);
    assert.throws(() => BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: "system/.os/indexes/references.json" }), (e: Error) => e.message.endsWith("references.json: permission denied") && e.message.startsWith("open "));
    assert.equal(readTextFile(root, "system/.os/indexes/references.json"), "");
  });

  it("PE-008: keeps text directly inside a div, and leaves Go's handling of everything else", () => {
    const tree = intakeParsers.parseHtml(Buffer.from('<div class="callout"><strong>Note:</strong> keep this.<p>Para</p>tail <em>text</em><!-- c --> end</div><div>   </div><div class="mermaid">graph</div>'));
    const out = htmlToMarkdown(tree, { mermaid: (code) => `MERMAID ${code}`, svg: () => "", image: () => "" });
    assert.equal(out, "Note: keep this.\n\nPara\n\ntail text end\n\nMERMAID graph\n");
  });
});

describe("next_id keeps Go's 64-bit integer semantics", () => {
  // Go 1.24.1 buildos-intake output for two new twins (a.txt, b.txt) and an
  // existing index with this next_id (captured with the Go seed binary).
  const cases: [string, string, string[]][] = [
    ["9007199254740992", "9007199254740994", ["REF-9007199254740992", "REF-9007199254740993"]],
    ["9223372036854775806", "-9223372036854775808", ["REF-9223372036854775806", "REF-9223372036854775807"]],
    ["9223372036854775807", "-9223372036854775807", ["REF-9223372036854775807", "REF--9223372036854775808"]],
  ];
  for (const [given, next, ids] of cases) {
    it(`next_id ${given} gives ${ids.join(" and ")} and next_id ${next}`, () => {
      const root = tempDir();
      for (const name of ["a", "b"]) {
        writeTextFile(root, `system/assets/x/${name}.txt`, `---\nsource: "s/${name}"\nsha256: "x"\nconverter: "c"\ntimestamp: "t"\ntype: "text"\nstatus: "converted"\n---\nbody\n`);
      }
      writeTextFile(root, "system/.os/indexes/references.json", `{"version":1,"next_id":${given},"references":null}`);
      BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: "system/.os/indexes/references.json" });
      const text = readFileSync(join(root, "system", ".os", "indexes", "references.json"), "utf8");
      assert.match(text, new RegExp(`"next_id": ${next.replace("-", "\\-")},`));
      assert.deepEqual([...text.matchAll(/"id": "([^"]+)"/g)].map((m) => m[1]), ids);
    });
  }
});

describe("--allow-outside-root in flag position only (PE-010)", () => {
  /** The arguments Go's flag set leaves after the flags, and whether the switch was taken; or the flag error. */
  const take = (args: string[]): { args: string[]; found: boolean } | { error: string } => {
    try {
      const parsed = goParseFlags("convert", CONVERT_FLAGS, args, { extras: [ALLOW_OUTSIDE_ROOT] });
      return { args: parsed.args, found: parsed.extras.has(ALLOW_OUTSIDE_ROOT) };
    } catch (error) {
      if (!(error instanceof GoFlagError)) throw error;
      return { error: error.message };
    }
  };
  it("takes the whole switch before, between, and after the other flags", () => {
    assert.deepEqual(take(["--allow-outside-root", "--source", "a.csv"]), { args: [], found: true });
    assert.deepEqual(take(["--source", "a.csv", "--allow-outside-root", "--force"]), { args: [], found: true });
    assert.deepEqual(take(["-source=a.csv", "--allow-outside-root"]), { args: [], found: true });
  });
  it("leaves it as a value, after --, after a non-flag argument, and after a flag Go refuses", () => {
    assert.deepEqual(take(["--source", "--allow-outside-root"]), { args: [], found: false });
    assert.deepEqual(take(["--source", "a.csv", "--", "--allow-outside-root"]), { args: ["--allow-outside-root"], found: false });
    assert.deepEqual(take(["--source", "a.csv", "extra", "--allow-outside-root"]), { args: ["extra", "--allow-outside-root"], found: false });
    assert.deepEqual(take(["--bogus", "--allow-outside-root"]), { error: "flag provided but not defined: -bogus" });
    assert.deepEqual(take(["-allow-outside-root", "--allow-outside-root=true"]), { error: "flag provided but not defined: -allow-outside-root" });
  });
  it("is not in the usage text", () => {
    assert.ok(!INTAKE_USAGE.includes("allow-outside-root"));
    assert.ok(!goPrintDefaults(CONVERT_FLAGS).includes("allow-outside-root"));
  });
});


describe("intake folder modes (P4 and P5 merge)", () => {
  it("creates folders as Go's MkdirAll(dir, 0o755) under umask 002", { skip: process.platform === "win32" ? "no POSIX permission bits" : false }, async () => {
    const root = tempDir();
    writeTextFile(root, "inputs/roster.csv", "name,role\nAda,lead\n");
    const previous = process.umask(0o002);
    try {
      await Convert({ repoRoot: root, source: "inputs/roster.csv" });
      BuildReferencesIndex({ repoRoot: root, assetsRoot: "system/assets", output: "new/deep/references.json" });
    } finally {
      process.umask(previous);
    }
    // Go 1.24.1 buildos-intake, same commands under umask 002: every folder 0755, every file 0644.
    for (const rel of ["system", "system/assets", "system/assets/roster", "new", "new/deep"]) {
      assert.equal(statSync(join(root, rel)).mode & 0o777, 0o755, rel);
    }
    assert.equal(statSync(join(root, "system/assets/roster/roster.csv")).mode & 0o777, 0o644);
    assert.equal(statSync(join(root, "new/deep/references.json")).mode & 0o777, 0o644);
  });
});
