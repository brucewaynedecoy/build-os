package intake

import (
	"bytes"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const converterID = "buildos-intake/0.1.0"

func Convert(opts ConvertOptions) (ConvertResult, error) {
	repoRoot, err := cleanRoot(opts.RepoRoot)
	if err != nil {
		return ConvertResult{}, err
	}
	assetsRoot := resolvePath(repoRoot, opts.AssetsRoot)
	sourcePath := resolvePath(repoRoot, opts.Source)
	info, err := os.Stat(sourcePath)
	if err != nil {
		return ConvertResult{}, fmt.Errorf("read source: %w", err)
	}
	sourceType, err := detectType(sourcePath, info, opts.Type)
	if err != nil {
		return ConvertResult{}, err
	}
	sourceRel := repoRelative(repoRoot, sourcePath)
	sourceHash, err := sourceSHA256(sourcePath, info)
	if err != nil {
		return ConvertResult{}, err
	}
	sourceSlug := sourceSlug(sourcePath, info)

	var result ConvertResult
	switch sourceType {
	case "csv":
		body, err := convertCSV(sourcePath)
		if err != nil {
			return ConvertResult{}, err
		}
		result.Outputs = []ConvertedOutput{outputFor(assetsRoot, sourceSlug, assetSlug(sourcePath, ""), ".csv", sourceRel, sourceHash, "csv", body)}
	case "docx":
		body, sideArtifacts, err := convertDOCX(sourcePath, assetsRoot, sourceSlug, opts.DryRun, opts.Force)
		if err != nil {
			return ConvertResult{}, err
		}
		result.Outputs = []ConvertedOutput{outputFor(assetsRoot, sourceSlug, assetSlug(sourcePath, ""), ".md", sourceRel, sourceHash, "markdown", body)}
		result.SideArtifacts = sideArtifacts
	case "xlsx":
		outputs, sideArtifacts, err := convertXLSX(sourcePath, assetsRoot, sourceSlug, sourceRel, sourceHash, opts.DryRun, opts.Force)
		if err != nil {
			return ConvertResult{}, err
		}
		result.Outputs = outputs
		result.SideArtifacts = sideArtifacts
	case "html":
		body, sideArtifacts, err := convertHTMLFile(sourcePath, assetsRoot, sourceSlug, assetSlug(sourcePath, ""), opts.DryRun, opts.Force)
		if err != nil {
			return ConvertResult{}, err
		}
		result.Outputs = []ConvertedOutput{outputFor(assetsRoot, sourceSlug, assetSlug(sourcePath, ""), ".md", sourceRel, sourceHash, "markdown", body)}
		result.SideArtifacts = sideArtifacts
	case "html-dir":
		outputs, sideArtifacts, err := convertHTMLDir(sourcePath, assetsRoot, sourceSlug, sourceRel, sourceHash, opts.DryRun, opts.Force)
		if err != nil {
			return ConvertResult{}, err
		}
		result.Outputs = outputs
		result.SideArtifacts = sideArtifacts
	case "pdf":
		body, err := convertPDF(sourcePath)
		if err != nil {
			return ConvertResult{}, err
		}
		if strings.TrimSpace(body) == "" {
			return ConvertResult{}, errors.New("pdf text extraction produced no usable text")
		}
		result.Outputs = []ConvertedOutput{outputFor(assetsRoot, sourceSlug, assetSlug(sourcePath, ""), ".txt", sourceRel, sourceHash, "text", body)}
	default:
		return ConvertResult{}, fmt.Errorf("unsupported source type %q", sourceType)
	}

	if opts.DryRun {
		return result, nil
	}
	for _, output := range result.Outputs {
		if err := writeConvertedOutput(output, opts.Force); err != nil {
			return ConvertResult{}, err
		}
	}
	return result, nil
}

func outputFor(assetsRoot, sourceSlug, assetSlug, ext, sourceRel, sum, typ, body string) ConvertedOutput {
	return ConvertedOutput{
		Path:   filepath.Join(assetsRoot, sourceSlug, assetSlug+ext),
		Source: filepath.ToSlash(sourceRel),
		SHA256: sum,
		Type:   typ,
		Status: "converted",
		Body:   body,
	}
}

func writeConvertedOutput(output ConvertedOutput, force bool) error {
	if !force {
		if _, err := os.Stat(output.Path); err == nil {
			return fmt.Errorf("output exists, use --force to overwrite: %s", output.Path)
		} else if !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Dir(output.Path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(output.Path, []byte(frontmatter(output)+output.Body), 0o644)
}

func frontmatter(output ConvertedOutput) string {
	return strings.Join([]string{
		"---",
		`source: "` + yamlQuote(output.Source) + `"`,
		`sha256: "` + output.SHA256 + `"`,
		`converter: "` + converterID + `"`,
		`timestamp: "` + time.Now().UTC().Format(time.RFC3339) + `"`,
		`type: "` + output.Type + `"`,
		`status: "` + output.Status + `"`,
		"---",
		"",
	}, "\n")
}

func yamlQuote(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	return strings.ReplaceAll(s, `"`, `\"`)
}

func cleanRoot(root string) (string, error) {
	if root == "" {
		root = "."
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func resolvePath(repoRoot, path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Clean(filepath.Join(repoRoot, path))
}

func repoRelative(repoRoot, path string) string {
	rel, err := filepath.Rel(repoRoot, path)
	if err != nil || strings.HasPrefix(rel, "..") {
		return path
	}
	return rel
}

func detectType(path string, info os.FileInfo, explicit string) (string, error) {
	if explicit == "" {
		explicit = "auto"
	}
	if explicit != "auto" {
		return explicit, nil
	}
	if info.IsDir() {
		return "html-dir", nil
	}
	switch strings.ToLower(filepath.Ext(path)) {
	case ".csv":
		return "csv", nil
	case ".docx":
		return "docx", nil
	case ".xlsx":
		return "xlsx", nil
	case ".pdf":
		return "pdf", nil
	case ".html", ".htm":
		return "html", nil
	default:
		return "", fmt.Errorf("cannot infer source type for %s; use --type", path)
	}
}

func sourceSHA256(path string, info os.FileInfo) (string, error) {
	if info.IsDir() {
		return directorySHA256(path)
	}
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func directorySHA256(root string) (string, error) {
	var rows []string
	if err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		sum, err := sourceSHA256(path, info)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rows = append(rows, filepath.ToSlash(rel)+" "+sum)
		return nil
	}); err != nil {
		return "", err
	}
	sort.Strings(rows)
	h := sha256.New()
	for _, row := range rows {
		io.WriteString(h, row)
		io.WriteString(h, "\n")
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func sourceSlug(path string, info os.FileInfo) string {
	if info.IsDir() {
		return slugify(filepath.Base(path), "source")
	}
	return slugify(strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)), "source")
}

func assetSlug(path, suffix string) string {
	base := slugify(strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)), "asset")
	if suffix == "" {
		return base
	}
	return base + "-" + slugify(suffix, "part")
}

func slugify(s, fallback string) string {
	var b strings.Builder
	lastHyphen := false
	for _, r := range strings.ToLower(s) {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if ok {
			b.WriteRune(r)
			lastHyphen = false
			continue
		}
		if !lastHyphen && b.Len() > 0 {
			b.WriteByte('-')
			lastHyphen = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return fallback
	}
	return out
}

func convertCSV(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	records, err := r.ReadAll()
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	if err := w.WriteAll(records); err != nil {
		return "", err
	}
	w.Flush()
	return buf.String(), w.Error()
}

func readZipXML(entries map[string][]byte, name string, target any) error {
	data, ok := entries[name]
	if !ok {
		return fmt.Errorf("missing %s", name)
	}
	return xml.Unmarshal(data, target)
}
