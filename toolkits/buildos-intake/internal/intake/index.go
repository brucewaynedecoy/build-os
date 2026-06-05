package intake

import (
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
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Converted < entries[j].Converted
	})
	for i := range entries {
		entries[i].ID = fmt.Sprintf("REF-%03d", i+1)
	}
	index := ReferenceIndex{Version: 1, References: entries}
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
