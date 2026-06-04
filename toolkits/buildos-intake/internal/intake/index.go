package intake

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
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
		Source:    fields["source"],
		Converted: converted,
		SHA256:    fields["sha256"],
		Type:      fields["type"],
		Converter: fields["converter"],
		Timestamp: fields["timestamp"],
		Status:    fields["status"],
	}, true, nil
}

func parseFrontmatter(text string) (map[string]string, bool) {
	if !strings.HasPrefix(text, "---\n") {
		return nil, false
	}
	end := strings.Index(text[4:], "\n---")
	if end < 0 {
		return nil, false
	}
	block := text[4 : 4+end]
	fields := map[string]string{}
	for _, line := range strings.Split(block, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"`)
		fields[key] = value
	}
	return fields, true
}
