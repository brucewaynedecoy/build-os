package intake

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func convertDOCX(path, assetsRoot, sourceSlug string, dryRun, force bool) (string, []string, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return "", nil, err
	}
	defer zr.Close()

	var document []byte
	var numbering []byte
	var sideArtifacts []string
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			document, err = readZipFile(f)
			if err != nil {
				return "", nil, err
			}
			continue
		}
		if f.Name == "word/numbering.xml" {
			numbering, err = readZipFile(f)
			if err != nil {
				return "", nil, err
			}
			continue
		}
		if strings.HasPrefix(f.Name, "word/media/") && !strings.HasSuffix(f.Name, "/") {
			out := filepath.Join(assetsRoot, sourceSlug, "media", filepath.Base(f.Name))
			sideArtifacts = append(sideArtifacts, out)
			if !dryRun {
				if err := writeZipSideArtifact(f, out, force); err != nil {
					return "", nil, err
				}
			}
		}
	}
	if len(document) == 0 {
		return "", nil, fmt.Errorf("docx missing word/document.xml")
	}
	body, err := documentXMLToMarkdown(document, parseNumbering(numbering))
	if err != nil {
		return "", nil, err
	}
	if len(sideArtifacts) > 0 {
		body += "\n\n## Embedded Assets\n\n"
		for _, artifact := range sideArtifacts {
			body += "- " + filepath.ToSlash(filepath.Join("media", filepath.Base(artifact))) + "\n"
		}
	}
	return body, sideArtifacts, nil
}

type docxParagraph struct {
	text      strings.Builder
	style     string
	numID     string
	ilvl      int
	hasNum    bool
	bold      bool
	underline bool
}

type docxNumbering struct {
	numFormats map[string]map[int]string
}

func documentXMLToMarkdown(data []byte, numbering docxNumbering) (string, error) {
	dec := xml.NewDecoder(bytes.NewReader(data))
	var out []string
	var para docxParagraph
	var cell strings.Builder
	var row []string
	var table [][]string
	inTable := false
	inCell := false
	inParagraph := false
	inText := false
	literalBulletParent := false

	flushPara := func() {
		if !inParagraph {
			return
		}
		if !inTable {
			renderParagraph(&out, para, numbering, &literalBulletParent)
		}
		para = docxParagraph{ilvl: -1}
		inParagraph = false
	}
	flushTable := func() {
		if len(table) == 0 {
			return
		}
		appendBlock(&out, markdownTable(table))
		table = nil
		literalBulletParent = false
	}

	for {
		tok, err := dec.Token()
		if err != nil {
			if err == io.EOF {
				break
			}
			return "", err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "p":
				para = docxParagraph{ilvl: -1}
				inParagraph = true
			case "tbl":
				flushPara()
				inTable = true
				table = nil
			case "pStyle":
				if inParagraph {
					para.style = attrValue(t, "val")
				}
			case "ilvl":
				if inParagraph {
					if n, err := strconv.Atoi(attrValue(t, "val")); err == nil {
						para.ilvl = n
					}
				}
			case "numId":
				if inParagraph {
					para.numID = attrValue(t, "val")
					para.hasNum = para.numID != ""
				}
			case "b":
				if inParagraph && boolElementActive(t) {
					para.bold = true
				}
			case "u":
				if inParagraph && underlineElementActive(t) {
					para.underline = true
				}
			case "tr":
				row = nil
			case "tc":
				inCell = true
				cell.Reset()
			case "t":
				inText = true
			case "tab":
				if inCell {
					cell.WriteByte('\t')
				} else if inParagraph {
					para.text.WriteByte('\t')
				}
			case "br":
				if inCell {
					cell.WriteByte('\n')
				} else if inParagraph {
					para.text.WriteByte('\n')
				}
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "p":
				if inCell {
					if strings.TrimSpace(cell.String()) != "" {
						cell.WriteByte(' ')
					}
				} else {
					flushPara()
				}
			case "tbl":
				inTable = false
				flushTable()
			case "tc":
				inCell = false
				row = append(row, normalizeSpace(cell.String()))
			case "tr":
				if len(row) > 0 {
					table = append(table, row)
				}
			case "t":
				inText = false
			}
		case xml.CharData:
			if inText {
				if inCell {
					cell.Write([]byte(t))
				} else if inParagraph {
					para.text.Write([]byte(t))
				}
			}
		}
	}
	flushPara()
	flushTable()
	return strings.TrimSpace(strings.Join(out, "\n")) + "\n", nil
}

func renderParagraph(out *[]string, para docxParagraph, numbering docxNumbering, literalBulletParent *bool) {
	text := normalizeSpace(para.text.String())
	if text == "" {
		return
	}
	if level := headingLevel(para); level > 0 {
		appendBlock(out, strings.Repeat("#", level)+" "+stripLiteralBullet(text))
		*literalBulletParent = false
		return
	}
	if stripped, ok := literalBulletText(text); ok {
		item := stripped
		if para.bold || para.underline {
			item = "**" + item + "**"
		}
		appendListItem(out, "- "+item)
		*literalBulletParent = true
		return
	}
	if para.hasNum {
		level := para.ilvl
		if level < 0 {
			level = 0
		}
		if *literalBulletParent {
			level++
		}
		appendListItem(out, strings.Repeat("  ", level)+numbering.marker(para.numID, para.ilvl)+" "+text)
		return
	}
	appendBlock(out, text)
	*literalBulletParent = false
}

func headingLevel(para docxParagraph) int {
	style := strings.ToLower(para.style)
	if strings.HasPrefix(style, "heading") {
		for _, r := range style {
			if r >= '1' && r <= '6' {
				return int(r - '0')
			}
		}
		return 2
	}
	if style == "title" {
		return 1
	}
	if !para.hasNum && para.bold && para.underline {
		return 2
	}
	return 0
}

func literalBulletText(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)
	for _, bullet := range []string{"", "•", "·", "◦", "▪", ""} {
		if strings.HasPrefix(trimmed, bullet) {
			return normalizeSpace(strings.TrimSpace(strings.TrimPrefix(trimmed, bullet))), true
		}
	}
	return text, false
}

func stripLiteralBullet(text string) string {
	if stripped, ok := literalBulletText(text); ok {
		return stripped
	}
	return text
}

func appendBlock(out *[]string, block string) {
	block = strings.TrimSpace(block)
	if block == "" {
		return
	}
	if len(*out) > 0 && (*out)[len(*out)-1] != "" {
		*out = append(*out, "")
	}
	*out = append(*out, strings.Split(block, "\n")...)
}

func appendListItem(out *[]string, line string) {
	if len(*out) > 0 && (*out)[len(*out)-1] != "" && !isMarkdownListLine((*out)[len(*out)-1]) {
		*out = append(*out, "")
	}
	*out = append(*out, line)
}

func isMarkdownListLine(line string) bool {
	trimmed := strings.TrimLeft(line, " ")
	return strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "1. ")
}

func (n docxNumbering) marker(numID string, ilvl int) string {
	if levels, ok := n.numFormats[numID]; ok {
		if format := levels[ilvl]; orderedNumberFormat(format) {
			return "1."
		}
	}
	return "-"
}

func orderedNumberFormat(format string) bool {
	switch strings.ToLower(format) {
	case "decimal", "decimalzero", "lowerletter", "upperletter", "lowerroman", "upperroman":
		return true
	default:
		return false
	}
}

func parseNumbering(data []byte) docxNumbering {
	numbering := docxNumbering{numFormats: map[string]map[int]string{}}
	if len(data) == 0 {
		return numbering
	}
	var parsed wordNumbering
	if err := xml.Unmarshal(data, &parsed); err != nil {
		return numbering
	}
	abstractFormats := map[string]map[int]string{}
	for _, abstract := range parsed.AbstractNums {
		levels := map[int]string{}
		for _, level := range abstract.Levels {
			if n, err := strconv.Atoi(level.ILvl); err == nil {
				levels[n] = level.NumFmt.Val
			}
		}
		abstractFormats[abstract.ID] = levels
	}
	for _, num := range parsed.Nums {
		if formats, ok := abstractFormats[num.AbstractNumID.Val]; ok {
			numbering.numFormats[num.ID] = formats
		}
	}
	return numbering
}

type wordNumbering struct {
	AbstractNums []wordAbstractNum `xml:"abstractNum"`
	Nums         []wordNum         `xml:"num"`
}

type wordAbstractNum struct {
	ID     string          `xml:"abstractNumId,attr"`
	Levels []wordLevelInfo `xml:"lvl"`
}

type wordLevelInfo struct {
	ILvl   string      `xml:"ilvl,attr"`
	NumFmt wordValAttr `xml:"numFmt"`
}

type wordNum struct {
	ID            string      `xml:"numId,attr"`
	AbstractNumID wordValAttr `xml:"abstractNumId"`
}

type wordValAttr struct {
	Val string `xml:"val,attr"`
}

func attrValue(el xml.StartElement, local string) string {
	for _, attr := range el.Attr {
		if attr.Name.Local == local {
			return attr.Value
		}
	}
	return ""
}

func boolElementActive(el xml.StartElement) bool {
	switch strings.ToLower(attrValue(el, "val")) {
	case "0", "false", "off":
		return false
	default:
		return true
	}
}

func underlineElementActive(el xml.StartElement) bool {
	switch strings.ToLower(attrValue(el, "val")) {
	case "0", "false", "off", "none":
		return false
	default:
		return true
	}
}

func markdownTable(rows [][]string) string {
	width := 0
	for _, row := range rows {
		if len(row) > width {
			width = len(row)
		}
	}
	if width == 0 {
		return ""
	}
	var b strings.Builder
	writeRow := func(row []string) {
		b.WriteByte('|')
		for i := 0; i < width; i++ {
			cell := ""
			if i < len(row) {
				cell = strings.ReplaceAll(row[i], "|", "\\|")
			}
			b.WriteByte(' ')
			b.WriteString(cell)
			b.WriteString(" |")
		}
		b.WriteByte('\n')
	}
	writeRow(rows[0])
	b.WriteByte('|')
	for i := 0; i < width; i++ {
		b.WriteString(" --- |")
	}
	b.WriteByte('\n')
	for _, row := range rows[1:] {
		writeRow(row)
	}
	return strings.TrimRight(b.String(), "\n")
}

func normalizeSpace(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func readZipFile(f *zip.File) ([]byte, error) {
	r, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var buf bytes.Buffer
	_, err = buf.ReadFrom(r)
	return buf.Bytes(), err
}

func writeZipSideArtifact(f *zip.File, out string, force bool) error {
	data, err := readZipFile(f)
	if err != nil {
		return err
	}
	return writeSideArtifact(out, data, force)
}

func writeSideArtifact(out string, data []byte, force bool) error {
	if !force {
		if _, err := os.Stat(out); err == nil {
			return fmt.Errorf("side artifact exists, use --force to overwrite: %s", out)
		}
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return err
	}
	return os.WriteFile(out, data, 0o644)
}
