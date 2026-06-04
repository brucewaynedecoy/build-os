package intake

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConvertCSVWritesFrontmatterAndBody(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "input.csv")
	if err := os.WriteFile(source, []byte("name,value\nA,1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "input.csv", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Outputs) != 1 {
		t.Fatalf("outputs=%d", len(result.Outputs))
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, want := range []string{`source: "input.csv"`, `type: "csv"`, `status: "converted"`, "name,value\nA,1\n"} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in\n%s", want, text)
		}
	}
}

func TestConvertDOCXExtractsParagraphText(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "sample.docx")
	writeZip(t, source, map[string]string{
		"word/document.xml": `<w:document xmlns:w="urn:w"><w:body><w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t> world</w:t></w:r></w:p></w:body></w:document>`,
	})
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "sample.docx", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "Hello world") {
		t.Fatalf("missing docx text:\n%s", string(data))
	}
}

func TestConvertDOCXPreservesHeadingsAndLists(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "outline.docx")
	writeZip(t, source, map[string]string{
		"word/document.xml": `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:rPr><w:b/><w:u w:val="single"/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/></w:rPr><w:t>Section</w:t></w:r></w:p>
<w:p><w:r><w:t></w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> Parent Item</w:t></w:r></w:p>
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
	})
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "outline.docx", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, want := range []string{
		"## Section",
		"- **Parent Item**\n  - Child Item\n    - Grandchild Item",
		"## Next Section\n\n1. Ordered Item",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in\n%s", want, text)
		}
	}
}

func TestConvertXLSXWritesOneCSVPerWorksheet(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "book.xlsx")
	writeZip(t, source, map[string]string{
		"xl/workbook.xml":            `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet One" sheetId="1" r:id="rId1"/></sheets></workbook>`,
		"xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
		"xl/sharedStrings.xml":       `<sst><si><t>Name</t></si><si><t>A</t></si></sst>`,
		"xl/worksheets/sheet1.xml":   `<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2</v></c></row><row><c r="A2" t="s"><v>1</v></c><c r="B2"><v>3</v></c></row></sheetData></worksheet>`,
	})
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "book.xlsx", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Outputs) != 1 {
		t.Fatalf("outputs=%d", len(result.Outputs))
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, want := range []string{"book-sheet-one.csv", "Name,2\nA,3\n"} {
		if !strings.Contains(result.Outputs[0].Path+text, want) {
			t.Fatalf("missing %q in path/body\npath=%s\n%s", want, result.Outputs[0].Path, text)
		}
	}
}

func TestConvertHTMLWritesMarkdown(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "page.html")
	if err := os.WriteFile(source, []byte(`<html><body><h1>Title</h1><p>See <a href="https://example.test">Example</a>.</p><ul><li>First</li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>`), 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "page.html", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, want := range []string{"# Title", "[Example](https://example.test)", "- First", "| A | B |\n| --- | --- |\n| 1 | 2 |"} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in\n%s", want, text)
		}
	}
}

func TestConvertHTMLCapturesEmbedsAsSideArtifacts(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "diagram.html")
	if err := os.WriteFile(source, []byte(`<html><body><h1>Diagrams</h1><div class="mermaid">
erDiagram
  RentalItem ||--o{ RentalClass : classified_by
</div><img alt="inline logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0PkxvZ288L3RleHQ+PC9zdmc+"/></body></html>`), 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "diagram.html", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.SideArtifacts) != 2 {
		t.Fatalf("side artifacts=%d: %#v", len(result.SideArtifacts), result.SideArtifacts)
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, want := range []string{
		"[Mermaid diagram source](diagrams/diagram-mermaid-001.mmd)",
		"```mermaid\nerDiagram",
		"![inline logo](media/diagram-image-001.svg)",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in\n%s", want, text)
		}
	}
	for _, artifact := range result.SideArtifacts {
		if _, err := os.Stat(artifact); err != nil {
			t.Fatalf("missing side artifact %s: %v", artifact, err)
		}
	}
}

func TestConvertHTMLDirWritesOneOutputPerHTMLFile(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "site", "docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	files := map[string]string{
		"site/index.html":     `<h1>Home</h1>`,
		"site/docs/page.html": `<h1>Docs</h1>`,
	}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(root, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "site", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Outputs) != 2 {
		t.Fatalf("outputs=%d", len(result.Outputs))
	}
	got := result.Outputs[0].Path + "\n" + result.Outputs[1].Path
	for _, want := range []string{"docs-page.md", "index.md"} {
		if !strings.Contains(got, want) {
			t.Fatalf("missing %q in\n%s", want, got)
		}
	}
}

func TestConvertPDFExtractsMinimalText(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "simple.pdf")
	if err := os.WriteFile(source, minimalPDF("Hello PDF"), 0o644); err != nil {
		t.Fatal(err)
	}
	result, err := Convert(ConvertOptions{RepoRoot: root, Source: "simple.pdf", AssetsRoot: "system/assets"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(result.Outputs[0].Path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	for _, want := range []string{`type: "text"`, "Hello PDF"} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %q in\n%s", want, text)
		}
	}
}

func TestBuildReferencesIndex(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "input.csv")
	if err := os.WriteFile(source, []byte("name,value\nA,1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Convert(ConvertOptions{RepoRoot: root, Source: "input.csv", AssetsRoot: "system/assets"}); err != nil {
		t.Fatal(err)
	}
	result, err := BuildReferencesIndex(IndexOptions{RepoRoot: root, AssetsRoot: "system/assets", Output: "system/.os/indexes/references.json"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Count != 1 {
		t.Fatalf("count=%d", result.Count)
	}
	data, err := os.ReadFile(result.OutputPath)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`"id": "REF-001"`, `"source": "input.csv"`, `"status": "converted"`} {
		if !strings.Contains(string(data), want) {
			t.Fatalf("missing %q in\n%s", want, string(data))
		}
	}
}

func TestBuildPlaybooksIndex(t *testing.T) {
	root := t.TempDir()
	writePlaybook(t, root, "system/playbooks/testing/zeta.md", `---
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
`)
	writePlaybook(t, root, "system/playbooks/testing/alpha.md", `---
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
`)
	writePlaybook(t, root, "system/playbooks/testing/AGENTS.md", "# Router\n")

	result, err := BuildPlaybooksIndex(IndexOptions{RepoRoot: root, PlaybooksRoot: "system/playbooks", Output: "system/.os/indexes/playbooks.json"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Count != 2 {
		t.Fatalf("count=%d", result.Count)
	}
	data, err := os.ReadFile(result.OutputPath)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), `"systems": null`) {
		t.Fatalf("empty list fields must serialize as arrays, got\n%s", string(data))
	}
	var index PlaybookIndex
	if err := json.Unmarshal(data, &index); err != nil {
		t.Fatal(err)
	}
	if index.Version != 1 {
		t.Fatalf("version=%d", index.Version)
	}
	if len(index.Playbooks) != 2 {
		t.Fatalf("playbooks=%d", len(index.Playbooks))
	}
	if got := index.Playbooks[0].ID + "," + index.Playbooks[1].ID; got != "PB-002,PB-010" {
		t.Fatalf("sort order=%s", got)
	}

	alpha := index.Playbooks[0]
	if alpha.Path != "system/playbooks/testing/alpha.md" {
		t.Fatalf("alpha path=%q", alpha.Path)
	}
	for _, want := range []string{alpha.Title, alpha.Category, alpha.ExecutionMode, alpha.StateNature, alpha.Status, alpha.Audience, alpha.Version} {
		if want == "" {
			t.Fatalf("required scalar missing in %#v", alpha)
		}
	}
	if alpha.SourceAnchor != nil {
		t.Fatalf("source_anchor=%q", *alpha.SourceAnchor)
	}
	if len(alpha.Systems) != 0 || len(alpha.Environments) != 0 || len(alpha.Owners) != 0 || len(alpha.Targets) != 0 || len(alpha.Produces) != 0 {
		t.Fatalf("empty bracket lists parsed incorrectly: %#v", alpha)
	}
	assertStringSlice(t, alpha.Harness, []string{"none"})
	assertStringSlice(t, alpha.Related, []string{"REQ-002", "docs/prd/09-playbooks.md"})

	zeta := index.Playbooks[1]
	if zeta.SourceAnchor == nil || *zeta.SourceAnchor != "docs/prd/09-playbooks.md#scope" {
		t.Fatalf("zeta source_anchor=%v", zeta.SourceAnchor)
	}
	assertStringSlice(t, zeta.Harness, []string{"shell", "mcp"})
	assertStringSlice(t, zeta.Systems, []string{"crm"})
	assertStringSlice(t, zeta.Environments, []string{"dev", "prod"})
	assertStringSlice(t, zeta.Owners, []string{"qa"})
	assertStringSlice(t, zeta.Targets, []string{"REQ-001", "TC-002"})
	assertStringSlice(t, zeta.Produces, []string{"run-record", "finding"})
	assertStringSlice(t, zeta.Related, []string{"../../.os/contracts/playbook-contract.md", "docs/prd/09-playbooks.md"})
}

func TestBuildPlaybooksIndexRejectsMissingRequiredFields(t *testing.T) {
	root := t.TempDir()
	writePlaybook(t, root, "system/playbooks/testing/broken.md", `---
id: PB-099
title: Broken playbook
category: testing
---
# Broken
`)
	_, err := BuildPlaybooksIndex(IndexOptions{RepoRoot: root, PlaybooksRoot: "system/playbooks", Output: "system/.os/indexes/playbooks.json"})
	if err == nil {
		t.Fatal("expected missing required fields to fail")
	}
	for _, want := range []string{"broken.md", "execution_mode", "harness", "related"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("missing %q in error %q", want, err.Error())
		}
	}
}

func TestPDFInvalidInputFails(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "bad.pdf")
	if err := os.WriteFile(source, []byte("%PDF bad"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := Convert(ConvertOptions{RepoRoot: root, Source: "bad.pdf", AssetsRoot: "system/assets"}); err == nil {
		t.Fatal("expected invalid pdf to fail")
	}
}

func writePlaybook(t *testing.T, root, rel, body string) {
	t.Helper()
	path := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertStringSlice(t *testing.T, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("len(%#v)=%d want %d", got, len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("slice[%d]=%q want %q in %#v", i, got[i], want[i], got)
		}
	}
}

func writeZip(t *testing.T, path string, files map[string]string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	for name, body := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
}

func minimalPDF(text string) []byte {
	var b strings.Builder
	offsets := []int{0}
	addObject := func(body string) {
		offsets = append(offsets, b.Len())
		fmt.Fprintf(&b, "%d 0 obj\n%s\nendobj\n", len(offsets)-1, body)
	}

	b.WriteString("%PDF-1.4\n")
	stream := fmt.Sprintf("BT /F1 24 Tf 100 700 Td (%s) Tj ET", escapePDFText(text))
	addObject("<< /Type /Catalog /Pages 2 0 R >>")
	addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	addObject("<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>")
	addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
	addObject(fmt.Sprintf("<< /Length %d >>\nstream\n%s\nendstream", len(stream), stream))

	xref := b.Len()
	fmt.Fprintf(&b, "xref\n0 %d\n", len(offsets))
	b.WriteString("0000000000 65535 f \n")
	for i := 1; i < len(offsets); i++ {
		fmt.Fprintf(&b, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&b, "trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", len(offsets), xref)
	return []byte(b.String())
}

func escapePDFText(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `(`, `\(`)
	return strings.ReplaceAll(s, `)`, `\)`)
}
