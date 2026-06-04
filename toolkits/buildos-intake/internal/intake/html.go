package intake

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/net/html"
)

type htmlConvertContext struct {
	sourcePath     string
	assetsRoot     string
	sourceSlug     string
	assetSlug      string
	dryRun         bool
	force          bool
	sideArtifacts  []string
	mermaidCounter int
	svgCounter     int
	imageCounter   int
}

func convertHTMLFile(path, assetsRoot, sourceSlug, assetSlug string, dryRun, force bool) (string, []string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", nil, err
	}
	defer f.Close()
	doc, err := html.Parse(f)
	if err != nil {
		return "", nil, err
	}
	ctx := &htmlConvertContext{
		sourcePath: path,
		assetsRoot: assetsRoot,
		sourceSlug: sourceSlug,
		assetSlug:  assetSlug,
		dryRun:     dryRun,
		force:      force,
	}
	body, err := htmlToMarkdown(doc, ctx)
	if err != nil {
		return "", nil, err
	}
	return body, ctx.sideArtifacts, nil
}

func convertHTMLDir(path, assetsRoot, sourceSlug, sourceRel, sum string, dryRun, force bool) ([]ConvertedOutput, []string, error) {
	var htmlFiles []string
	if err := filepath.WalkDir(path, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(p))
		if ext == ".html" || ext == ".htm" {
			htmlFiles = append(htmlFiles, p)
		}
		return nil
	}); err != nil {
		return nil, nil, err
	}
	sort.Strings(htmlFiles)
	if len(htmlFiles) == 0 {
		return nil, nil, fmt.Errorf("html directory contains no .html or .htm files")
	}
	var outputs []ConvertedOutput
	var sideArtifacts []string
	for _, file := range htmlFiles {
		rel, err := filepath.Rel(path, file)
		if err != nil {
			return nil, nil, err
		}
		slug := slugify(strings.TrimSuffix(filepath.ToSlash(rel), filepath.Ext(rel)), "html")
		body, artifacts, err := convertHTMLFile(file, assetsRoot, sourceSlug, slug, dryRun, force)
		if err != nil {
			return nil, nil, err
		}
		sideArtifacts = append(sideArtifacts, artifacts...)
		outputs = append(outputs, outputFor(assetsRoot, sourceSlug, slug, ".md", sourceRel, sum, "markdown", body))
	}
	return outputs, sideArtifacts, nil
}

func htmlToMarkdown(root *html.Node, ctx *htmlConvertContext) (string, error) {
	var out []string
	var walk func(*html.Node) error
	walk = func(n *html.Node) error {
		if n.Type == html.ElementNode {
			switch strings.ToLower(n.Data) {
			case "h1", "h2", "h3", "h4", "h5", "h6":
				level := int(n.Data[1] - '0')
				out = append(out, strings.Repeat("#", level)+" "+textContent(n))
				return nil
			case "p":
				addBlock(&out, textContent(n))
				return nil
			case "li":
				text := textContent(n)
				if strings.TrimSpace(text) != "" {
					out = append(out, "- "+normalizeSpace(text))
				}
				return nil
			case "table":
				table := strings.TrimSpace(htmlTable(n))
				if table != "" {
					out = append(out, table)
				}
				return nil
			case "img":
				block, err := ctx.captureImage(n)
				if err != nil {
					return err
				}
				addRawBlock(&out, block)
				return nil
			case "svg":
				block, err := ctx.captureInlineSVG(n)
				if err != nil {
					return err
				}
				addRawBlock(&out, block)
				return nil
			case "br":
				out = append(out, "")
			}
			if hasClass(n, "mermaid") {
				block, err := ctx.captureMermaid(n)
				if err != nil {
					return err
				}
				addRawBlock(&out, block)
				return nil
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			if err := walk(child); err != nil {
				return err
			}
		}
		return nil
	}
	if err := walk(root); err != nil {
		return "", err
	}
	return strings.TrimSpace(strings.Join(out, "\n\n")) + "\n", nil
}

func addBlock(out *[]string, text string) {
	text = normalizeSpace(text)
	if text != "" {
		*out = append(*out, text)
	}
}

func addRawBlock(out *[]string, text string) {
	text = strings.TrimSpace(text)
	if text != "" {
		*out = append(*out, text)
	}
}

func textContent(n *html.Node) string {
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(cur *html.Node) {
		if cur.Type == html.TextNode {
			b.WriteString(cur.Data)
			b.WriteByte(' ')
		}
		if cur.Type == html.ElementNode && strings.ToLower(cur.Data) == "a" {
			label := normalizeSpace(textContentChildren(cur))
			href := attr(cur, "href")
			if label != "" && href != "" {
				b.WriteString("[")
				b.WriteString(label)
				b.WriteString("](")
				b.WriteString(href)
				b.WriteString(") ")
				return
			}
		}
		for child := cur.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(n)
	return normalizeSpace(b.String())
}

func textContentChildren(n *html.Node) string {
	var b strings.Builder
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		b.WriteString(textContent(child))
		b.WriteByte(' ')
	}
	return b.String()
}

func attr(n *html.Node, name string) string {
	for _, a := range n.Attr {
		if strings.EqualFold(a.Key, name) {
			return a.Val
		}
	}
	return ""
}

func hasClass(n *html.Node, className string) bool {
	for _, class := range strings.Fields(attr(n, "class")) {
		if strings.EqualFold(class, className) {
			return true
		}
	}
	return false
}

func (ctx *htmlConvertContext) captureMermaid(n *html.Node) (string, error) {
	code := strings.TrimSpace(rawTextContent(n))
	if code == "" {
		return "", nil
	}
	ctx.mermaidCounter++
	rel := filepath.ToSlash(filepath.Join("diagrams", fmt.Sprintf("%s-mermaid-%03d.mmd", ctx.assetSlug, ctx.mermaidCounter)))
	out := filepath.Join(ctx.assetsRoot, ctx.sourceSlug, filepath.FromSlash(rel))
	if !ctx.dryRun {
		if err := writeSideArtifact(out, []byte(code+"\n"), ctx.force); err != nil {
			return "", err
		}
	}
	ctx.sideArtifacts = append(ctx.sideArtifacts, out)
	return fmt.Sprintf("[Mermaid diagram source](%s)\n\n```mermaid\n%s\n```", rel, code), nil
}

func (ctx *htmlConvertContext) captureInlineSVG(n *html.Node) (string, error) {
	var buf bytes.Buffer
	if err := html.Render(&buf, n); err != nil {
		return "", err
	}
	ctx.svgCounter++
	rel := filepath.ToSlash(filepath.Join("diagrams", fmt.Sprintf("%s-svg-%03d.svg", ctx.assetSlug, ctx.svgCounter)))
	out := filepath.Join(ctx.assetsRoot, ctx.sourceSlug, filepath.FromSlash(rel))
	if !ctx.dryRun {
		if err := writeSideArtifact(out, buf.Bytes(), ctx.force); err != nil {
			return "", err
		}
	}
	ctx.sideArtifacts = append(ctx.sideArtifacts, out)
	return fmt.Sprintf("![SVG diagram](%s)", rel), nil
}

func (ctx *htmlConvertContext) captureImage(n *html.Node) (string, error) {
	src := strings.TrimSpace(attr(n, "src"))
	if src == "" {
		return "", nil
	}
	alt := normalizeSpace(attr(n, "alt"))
	if alt == "" {
		alt = "Embedded image"
	}
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		return fmt.Sprintf("![%s](%s)", alt, src), nil
	}
	data, ext, err := ctx.readImageSource(src)
	if err != nil {
		return fmt.Sprintf("[Uncopied image: %s](%s)", alt, src), nil
	}
	ctx.imageCounter++
	rel := filepath.ToSlash(filepath.Join("media", fmt.Sprintf("%s-image-%03d%s", ctx.assetSlug, ctx.imageCounter, ext)))
	out := filepath.Join(ctx.assetsRoot, ctx.sourceSlug, filepath.FromSlash(rel))
	if !ctx.dryRun {
		if err := writeSideArtifact(out, data, ctx.force); err != nil {
			return "", err
		}
	}
	ctx.sideArtifacts = append(ctx.sideArtifacts, out)
	return fmt.Sprintf("![%s](%s)", alt, rel), nil
}

func (ctx *htmlConvertContext) readImageSource(src string) ([]byte, string, error) {
	if strings.HasPrefix(src, "data:image/") {
		meta, encoded, ok := strings.Cut(src, ",")
		if !ok || !strings.Contains(meta, ";base64") {
			return nil, "", fmt.Errorf("unsupported image data URI")
		}
		data, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return nil, "", err
		}
		return data, imageExtensionFromDataURI(meta), nil
	}
	path := src
	if cut := strings.IndexAny(path, "?#"); cut >= 0 {
		path = path[:cut]
	}
	if path == "" || strings.Contains(path, "://") {
		return nil, "", fmt.Errorf("unsupported image source")
	}
	source := path
	if !filepath.IsAbs(source) {
		source = filepath.Join(filepath.Dir(ctx.sourcePath), source)
	}
	data, err := os.ReadFile(source)
	if err != nil {
		return nil, "", err
	}
	ext := filepath.Ext(source)
	if ext == "" {
		ext = ".bin"
	}
	return data, ext, nil
}

func imageExtensionFromDataURI(meta string) string {
	switch {
	case strings.HasPrefix(meta, "data:image/svg+xml"):
		return ".svg"
	case strings.HasPrefix(meta, "data:image/png"):
		return ".png"
	case strings.HasPrefix(meta, "data:image/jpeg"), strings.HasPrefix(meta, "data:image/jpg"):
		return ".jpg"
	case strings.HasPrefix(meta, "data:image/gif"):
		return ".gif"
	case strings.HasPrefix(meta, "data:image/webp"):
		return ".webp"
	default:
		return ".bin"
	}
}

func rawTextContent(n *html.Node) string {
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(cur *html.Node) {
		if cur.Type == html.TextNode {
			b.WriteString(cur.Data)
		}
		for child := cur.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(n)
	return b.String()
}

func htmlTable(n *html.Node) string {
	var rows [][]string
	var collectRows func(*html.Node)
	collectRows = func(cur *html.Node) {
		if cur.Type == html.ElementNode && strings.EqualFold(cur.Data, "tr") {
			var row []string
			for c := cur.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && (strings.EqualFold(c.Data, "td") || strings.EqualFold(c.Data, "th")) {
					row = append(row, textContent(c))
				}
			}
			if len(row) > 0 {
				rows = append(rows, row)
			}
			return
		}
		for child := cur.FirstChild; child != nil; child = child.NextSibling {
			collectRows(child)
		}
	}
	collectRows(n)
	return markdownTable(rows)
}
