package intake

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

func BuildReferencesIndex(opts IndexOptions) (IndexResult, error) {
	repoRoot, err := cleanRoot(opts.RepoRoot)
	if err != nil {
		return IndexResult{}, err
	}
	assetsRoot := resolvePath(repoRoot, opts.AssetsRoot)
	outputPath := resolvePath(repoRoot, opts.Output)
	var entries []ReferenceEntry
	if _, err := os.Stat(assetsRoot); err != nil {
		if os.IsNotExist(err) {
			entries = nil
		} else {
			return IndexResult{}, err
		}
	} else if err := filepath.WalkDir(assetsRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		entry, ok, err := referenceEntry(repoRoot, path)
		if err != nil {
			return err
		}
		if ok {
			entries = append(entries, entry)
		}
		return nil
	}); err != nil {
		return IndexResult{}, err
	}
	previous, err := loadPreviousReferences(outputPath)
	if err != nil {
		return IndexResult{}, err
	}
	// Sort by converted path so new references get numbers in a stable order.
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Converted < entries[j].Converted
	})
	highest := previous.highest
	for i := range entries {
		if id, ok := previous.ids[entries[i].Converted]; ok {
			entries[i].ID = id
			continue
		}
		highest++
		entries[i].ID = fmt.Sprintf("REF-%03d", highest)
	}
	sort.SliceStable(entries, func(i, j int) bool {
		return referenceIDLess(entries[i], entries[j])
	})
	index := ReferenceIndex{Version: 1, NextID: highest + 1, References: entries}
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return IndexResult{}, err
	}
	data = append(data, '\n')
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return IndexResult{}, err
	}
	if err := os.WriteFile(outputPath, data, 0o644); err != nil {
		return IndexResult{}, err
	}
	return IndexResult{OutputPath: outputPath, Count: len(entries)}, nil
}

// previousReferences is what a rebuild keeps from the index it replaces.
type previousReferences struct {
	// ids maps a converted path to the REF ID it had before.
	ids map[string]string
	// highest is the largest REF number ever given out, including numbers of
	// references that were removed since.
	highest int
}

// loadPreviousReferences reads the existing references index, if there is
// one, so that a rebuild keeps the IDs that records and extractions cite.
// A missing or empty file means there is nothing to keep. A file that cannot
// be read as an index is an error: rewriting it would renumber every entry.
func loadPreviousReferences(outputPath string) (previousReferences, error) {
	previous := previousReferences{ids: map[string]string{}}
	data, err := os.ReadFile(outputPath)
	if err != nil {
		if os.IsNotExist(err) {
			return previous, nil
		}
		return previousReferences{}, err
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return previous, nil
	}
	var index ReferenceIndex
	if err := json.Unmarshal(data, &index); err != nil {
		return previousReferences{}, fmt.Errorf("read existing references index %s: %w (fix or move the file before rebuilding so reference IDs are not lost)", outputPath, err)
	}
	if index.NextID > 1 {
		previous.highest = index.NextID - 1
	}
	convertedByID := map[string]string{}
	for _, entry := range index.References {
		if n, ok := refNumber(entry.ID); ok && n > previous.highest {
			previous.highest = n
		}
		if entry.ID == "" || entry.Converted == "" {
			continue
		}
		if other, dup := convertedByID[entry.ID]; dup {
			return previousReferences{}, fmt.Errorf("existing references index %s gives %s to both %s and %s; fix it before rebuilding", outputPath, entry.ID, other, entry.Converted)
		}
		if other, dup := previous.ids[entry.Converted]; dup {
			return previousReferences{}, fmt.Errorf("existing references index %s lists %s twice (%s and %s); fix it before rebuilding", outputPath, entry.Converted, other, entry.ID)
		}
		convertedByID[entry.ID] = entry.Converted
		previous.ids[entry.Converted] = entry.ID
	}
	return previous, nil
}

// refNumber returns N for an ID of the form REF-N.
func refNumber(id string) (int, bool) {
	digits, ok := strings.CutPrefix(id, "REF-")
	if !ok || digits == "" {
		return 0, false
	}
	for _, r := range digits {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(digits)
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

// referenceIDLess orders entries by REF number, so the file reads in the
// order the references were added.
func referenceIDLess(a, b ReferenceEntry) bool {
	an, aok := refNumber(a.ID)
	bn, bok := refNumber(b.ID)
	if aok != bok {
		return aok
	}
	if aok && an != bn {
		return an < bn
	}
	if a.ID != b.ID {
		return a.ID < b.ID
	}
	return a.Converted < b.Converted
}

func referenceEntry(repoRoot, path string) (ReferenceEntry, bool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return ReferenceEntry{}, false, err
	}
	fields, ok := parseFrontmatter(string(data))
	if !ok {
		return ReferenceEntry{}, false, nil
	}
	converted := filepath.ToSlash(repoRelative(repoRoot, path))
	return ReferenceEntry{
		Source:    fields.Scalars["source"],
		Converted: converted,
		SHA256:    fields.Scalars["sha256"],
		Type:      fields.Scalars["type"],
		Converter: fields.Scalars["converter"],
		Timestamp: fields.Scalars["timestamp"],
		Status:    fields.Scalars["status"],
	}, true, nil
}

func BuildPlaybooksIndex(opts IndexOptions) (IndexResult, error) {
	repoRoot, err := cleanRoot(opts.RepoRoot)
	if err != nil {
		return IndexResult{}, err
	}
	playbooksRoot := resolvePath(repoRoot, opts.PlaybooksRoot)
	outputPath := resolvePath(repoRoot, opts.Output)
	entries := []PlaybookEntry{}
	if _, err := os.Stat(playbooksRoot); err != nil {
		if os.IsNotExist(err) {
			entries = []PlaybookEntry{}
		} else {
			return IndexResult{}, err
		}
	} else if err := filepath.WalkDir(playbooksRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}
		entry, ok, err := playbookEntry(repoRoot, path)
		if err != nil {
			return err
		}
		if ok {
			entries = append(entries, entry)
		}
		return nil
	}); err != nil {
		return IndexResult{}, err
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].ID == entries[j].ID {
			return entries[i].Path < entries[j].Path
		}
		return entries[i].ID < entries[j].ID
	})
	index := PlaybookIndex{Version: 1, Playbooks: entries, RunnablePlaybooks: runnablePlaybooks(entries)}
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return IndexResult{}, err
	}
	data = append(data, '\n')
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return IndexResult{}, err
	}
	if err := os.WriteFile(outputPath, data, 0o644); err != nil {
		return IndexResult{}, err
	}
	return IndexResult{OutputPath: outputPath, Count: len(entries)}, nil
}

func runnablePlaybooks(entries []PlaybookEntry) []PlaybookEntry {
	runnable := []PlaybookEntry{}
	for _, entry := range entries {
		if entry.Status == "active" {
			runnable = append(runnable, entry)
		}
	}
	return runnable
}

func playbookEntry(repoRoot, path string) (PlaybookEntry, bool, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return PlaybookEntry{}, false, err
	}
	fields, ok := parseFrontmatter(string(data))
	if !ok {
		return PlaybookEntry{}, false, nil
	}
	if missing := missingRequiredPlaybookFields(fields); len(missing) > 0 {
		rel := filepath.ToSlash(repoRelative(repoRoot, path))
		return PlaybookEntry{}, false, fmt.Errorf("playbook %s missing required frontmatter fields: %s", rel, strings.Join(missing, ", "))
	}
	return PlaybookEntry{
		ID:            fields.Scalars["id"],
		Path:          filepath.ToSlash(repoRelative(repoRoot, path)),
		Title:         fields.Scalars["title"],
		Category:      fields.Scalars["category"],
		ExecutionMode: fields.Scalars["execution_mode"],
		StateNature:   fields.Scalars["state_nature"],
		Status:        fields.Scalars["status"],
		Audience:      fields.Scalars["audience"],
		Harness:       frontmatterList(fields, "harness"),
		Systems:       frontmatterList(fields, "systems"),
		Environments:  frontmatterList(fields, "environments"),
		Owners:        frontmatterList(fields, "owners"),
		Targets:       frontmatterList(fields, "targets"),
		Produces:      frontmatterList(fields, "produces"),
		SourceAnchor:  sourceAnchor(fields.Scalars["source_anchor"]),
		Version:       fields.Scalars["version"],
		Related:       frontmatterList(fields, "related"),
	}, true, nil
}

func missingRequiredPlaybookFields(fields frontmatterFields) []string {
	var missing []string
	for _, key := range []string{"id", "title", "category", "execution_mode", "state_nature", "status", "audience", "source_anchor", "version"} {
		value, ok := fields.Scalars[key]
		if !ok || (key != "source_anchor" && value == "") {
			missing = append(missing, key)
		}
	}
	for _, key := range []string{"harness", "systems", "environments", "owners", "targets", "produces", "related"} {
		if _, ok := fields.Lists[key]; !ok {
			missing = append(missing, key)
		}
	}
	return missing
}

func frontmatterList(fields frontmatterFields, key string) []string {
	values := fields.Lists[key]
	if len(values) == 0 {
		return []string{}
	}
	return append([]string(nil), values...)
}

func sourceAnchor(value string) *string {
	if value == "" || strings.EqualFold(value, "null") {
		return nil
	}
	return &value
}

type frontmatterFields struct {
	Scalars map[string]string
	Lists   map[string][]string
}

func parseFrontmatter(text string) (frontmatterFields, bool) {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	if !strings.HasPrefix(text, "---\n") {
		return frontmatterFields{}, false
	}
	end := strings.Index(text[4:], "\n---")
	if end < 0 {
		return frontmatterFields{}, false
	}
	block := text[4 : 4+end]
	fields := frontmatterFields{Scalars: map[string]string{}, Lists: map[string][]string{}}
	currentListKey := ""
	for _, line := range strings.Split(block, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "- ") && currentListKey != "" {
			fields.Lists[currentListKey] = append(fields.Lists[currentListKey], cleanFrontmatterValue(strings.TrimSpace(line[2:])))
			continue
		}
		currentListKey = ""
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if values, ok := parseBracketList(value); ok {
			fields.Lists[key] = values
			continue
		}
		if value == "" {
			fields.Lists[key] = []string{}
			currentListKey = key
			continue
		}
		fields.Scalars[key] = cleanFrontmatterValue(value)
	}
	return fields, true
}

func parseBracketList(value string) ([]string, bool) {
	if !strings.HasPrefix(value, "[") || !strings.HasSuffix(value, "]") {
		return nil, false
	}
	value = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(value, "["), "]"))
	if value == "" {
		return []string{}, true
	}
	var values []string
	for _, part := range strings.Split(value, ",") {
		part = cleanFrontmatterValue(part)
		if part != "" {
			values = append(values, part)
		}
	}
	return values, true
}

func cleanFrontmatterValue(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
		if unquoted, err := strconv.Unquote(value); err == nil {
			return unquoted
		}
	}
	if len(value) >= 2 && value[0] == '\'' && value[len(value)-1] == '\'' {
		return value[1 : len(value)-1]
	}
	return value
}
