package intake

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
)

type workbook struct {
	Sheets []workbookSheet `xml:"sheets>sheet"`
}

type workbookSheet struct {
	Name string `xml:"name,attr"`
	RID  string `xml:"http://schemas.openxmlformats.org/officeDocument/2006/relationships id,attr"`
}

type relationships struct {
	Rels []relationship `xml:"Relationship"`
}

type relationship struct {
	ID     string `xml:"Id,attr"`
	Target string `xml:"Target,attr"`
}

type sharedStrings struct {
	Items []sharedStringItem `xml:"si"`
}

type sharedStringItem struct {
	Texts []string `xml:"t"`
}

type worksheet struct {
	Rows []sheetRow `xml:"sheetData>row"`
}

type sheetRow struct {
	Cells []sheetCell `xml:"c"`
}

type sheetCell struct {
	Ref  string `xml:"r,attr"`
	Type string `xml:"t,attr"`
	V    string `xml:"v"`
}

func convertXLSX(path, assetsRoot, sourceSlug, sourceRel, sum string, dryRun, force bool) ([]ConvertedOutput, []string, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return nil, nil, err
	}
	defer zr.Close()

	entries := map[string][]byte{}
	var sideArtifacts []string
	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "/") {
			continue
		}
		if strings.HasPrefix(f.Name, "xl/media/") {
			out := filepath.Join(assetsRoot, sourceSlug, "media", filepath.Base(f.Name))
			sideArtifacts = append(sideArtifacts, out)
			if !dryRun {
				if err := writeZipSideArtifact(f, out, force); err != nil {
					return nil, nil, err
				}
			}
			continue
		}
		data, err := readZipFile(f)
		if err != nil {
			return nil, nil, err
		}
		entries[f.Name] = data
	}

	var wb workbook
	if err := readZipXML(entries, "xl/workbook.xml", &wb); err != nil {
		return nil, nil, err
	}
	var rels relationships
	if err := readZipXML(entries, "xl/_rels/workbook.xml.rels", &rels); err != nil {
		return nil, nil, err
	}
	relTargets := map[string]string{}
	for _, rel := range rels.Rels {
		target := filepath.ToSlash(filepath.Clean(filepath.Join("xl", rel.Target)))
		relTargets[rel.ID] = target
	}
	shared := parseSharedStrings(entries["xl/sharedStrings.xml"])
	var outputs []ConvertedOutput
	for i, sheet := range wb.Sheets {
		target := relTargets[sheet.RID]
		if target == "" {
			target = fmt.Sprintf("xl/worksheets/sheet%d.xml", i+1)
		}
		data, ok := entries[target]
		if !ok {
			return nil, nil, fmt.Errorf("missing worksheet %s", target)
		}
		body, err := worksheetToCSV(data, shared)
		if err != nil {
			return nil, nil, err
		}
		outputs = append(outputs, outputFor(assetsRoot, sourceSlug, assetSlug(path, sheet.Name), ".csv", sourceRel, sum, "csv", body))
	}
	return outputs, sideArtifacts, nil
}

func parseSharedStrings(data []byte) []string {
	if len(data) == 0 {
		return nil
	}
	var ss sharedStrings
	if err := xml.Unmarshal(data, &ss); err != nil {
		return nil
	}
	out := make([]string, 0, len(ss.Items))
	for _, item := range ss.Items {
		out = append(out, strings.Join(item.Texts, ""))
	}
	return out
}

func worksheetToCSV(data []byte, shared []string) (string, error) {
	var ws worksheet
	if err := xml.Unmarshal(data, &ws); err != nil {
		return "", err
	}
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	for _, row := range ws.Rows {
		values := make([]string, rowWidth(row.Cells))
		for _, cell := range row.Cells {
			idx := columnIndex(cell.Ref)
			if idx < 0 {
				idx = len(values)
			}
			if idx >= len(values) {
				next := make([]string, idx+1)
				copy(next, values)
				values = next
			}
			values[idx] = cellValue(cell, shared)
		}
		if err := w.Write(values); err != nil {
			return "", err
		}
	}
	w.Flush()
	return buf.String(), w.Error()
}

func rowWidth(cells []sheetCell) int {
	width := 0
	for _, cell := range cells {
		idx := columnIndex(cell.Ref)
		if idx >= width {
			width = idx + 1
		}
	}
	return width
}

func columnIndex(ref string) int {
	if ref == "" {
		return -1
	}
	n := 0
	seen := false
	for _, r := range ref {
		if r >= 'A' && r <= 'Z' {
			n = n*26 + int(r-'A'+1)
			seen = true
		} else if r >= 'a' && r <= 'z' {
			n = n*26 + int(r-'a'+1)
			seen = true
		} else {
			break
		}
	}
	if !seen {
		return -1
	}
	return n - 1
}

func cellValue(cell sheetCell, shared []string) string {
	if cell.Type == "s" {
		i, err := strconv.Atoi(strings.TrimSpace(cell.V))
		if err == nil && i >= 0 && i < len(shared) {
			return shared[i]
		}
	}
	return cell.V
}
