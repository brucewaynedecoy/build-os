package design

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	entityresolver "github.com/brucewaynedecoy/build-os/toolkits/buildos/pkg/entities"
)

var allowedRoutes = map[string]string{
	"baseline-plan": "designs-to-plan.prompt.md",
	"change-plan":   "designs-to-plan-change.prompt.md",
}

type findingIndexRow struct {
	ID                   string                     `json:"id"`
	Type                 string                     `json:"type"`
	Path                 string                     `json:"path"`
	Title                string                     `json:"title"`
	Status               string                     `json:"status"`
	Summary              string                     `json:"summary"`
	Observed             string                     `json:"observed"`
	BasisRefs            []string                   `json:"basis_refs"`
	Confidence           string                     `json:"confidence"`
	Implications         []string                   `json:"implications"`
	Outcome              string                     `json:"outcome"`
	Polarity             string                     `json:"polarity"`
	RunID                string                     `json:"run_id"`
	OriginRun            string                     `json:"origin_run"`
	RawAnchor            string                     `json:"raw_anchor"`
	QualificationTest    string                     `json:"qualification_test"`
	ConfirmationTest     string                     `json:"confirmation_test"`
	ConfirmationEvidence string                     `json:"confirmation_evidence"`
	NegativeAssertion    string                     `json:"negative_assertion,omitempty"`
	Systems              []string                   `json:"systems"`
	Environments         []string                   `json:"environments"`
	Owners               []string                   `json:"owners"`
	QualifiedAt          string                     `json:"qualified_at"`
	Designs              []string                   `json:"designs"`
	SourceAnchor         string                     `json:"source_anchor"`
	DocAnchor            string                     `json:"doc_anchor"`
	SourceRefs           []string                   `json:"source_refs"`
	Related              []string                   `json:"related"`
	CreatedAt            string                     `json:"created_at"`
	UpdatedAt            string                     `json:"updated_at"`
	Redirect             *entityresolver.Redirect   `json:"redirect,omitempty"`
	Raw                  map[string]json.RawMessage `json:"-"`
	rawLine              []byte                     `json:"-"`
	dirty                bool                       `json:"-"`
}

var (
	replaceExistingFile = atomicReplaceFile
	createExclusiveFile = syncNewFile
	renameAtomicFile    = os.Rename
)

var findingIndexOwnedFields = []string{
	"id", "type", "path", "title", "status", "summary", "observed", "basis_refs", "confidence", "implications",
	"outcome", "polarity", "run_id", "origin_run", "raw_anchor", "qualification_test", "confirmation_test",
	"confirmation_evidence", "negative_assertion", "systems", "environments", "owners", "qualified_at", "designs",
	"source_anchor", "doc_anchor", "source_refs", "related", "created_at", "updated_at", "redirect",
}

func PromoteFinding(opts PromoteFindingOptions) (PromoteFindingResult, error) {
	repoRoot := cleanRepoRoot(opts.RepoRoot)
	layout := detectLayout(repoRoot)
	if strings.TrimSpace(opts.FindingID) == "" {
		return PromoteFindingResult{}, errors.New("promote finding requires --finding-id")
	}
	route := strings.TrimSpace(opts.Route)
	promptFile, ok := allowedRoutes[route]
	if !ok {
		return PromoteFindingResult{}, errors.New("promote finding requires --route baseline-plan or change-plan")
	}

	findingsIndexPath := layout.path("system/.os/data/findings.jsonl")
	resolution, err := resolveFinding(layout, strings.TrimSpace(opts.FindingID))
	if err != nil {
		return PromoteFindingResult{}, err
	}
	rows, targetIndex, err := readFindingRows(findingsIndexPath, resolution.CanonicalID)
	if err != nil {
		return PromoteFindingResult{}, err
	}
	normalizeFindingRow(layout, &rows[targetIndex])
	row := rows[targetIndex]
	if row.Status != "qualified" {
		return PromoteFindingResult{}, fmt.Errorf("finding %s status is %q; promote finding requires qualified", row.ID, row.Status)
	}
	qualificationPath, qualificationAnchor, err := splitQualificationAnchor(row.QualificationTest)
	if err != nil {
		return PromoteFindingResult{}, fmt.Errorf("finding %s is missing a qualification anchor", row.ID)
	}
	if err := validateQualificationAnchor(repoRoot, qualificationPath, qualificationAnchor); err != nil {
		return PromoteFindingResult{}, err
	}
	if row.Path == "" {
		return PromoteFindingResult{}, fmt.Errorf("finding %s is missing path", row.ID)
	}

	title := strings.TrimSpace(opts.Title)
	if title == "" {
		title = strings.TrimSpace(row.Title)
	}
	if title == "" {
		title = fmt.Sprintf("Design for %s", row.ID)
	}
	slug, err := designSlug(opts.Slug, title)
	if err != nil {
		return PromoteFindingResult{}, err
	}
	designRelPath := layout.rel(filepath.ToSlash(filepath.Join("system/docs/designs", time.Now().Format("2006-01-02")+"-"+slug+".md")))
	designPath := layout.path(designRelPath)
	if _, err := os.Stat(designPath); err == nil {
		return PromoteFindingResult{}, fmt.Errorf("design target %s already exists", designRelPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return PromoteFindingResult{}, err
	}
	if designAlreadyReferenced(layout, rows, designRelPath) {
		return PromoteFindingResult{}, fmt.Errorf("design target %s is already referenced by a finding", designRelPath)
	}
	if err := requireDesignRouterInputs(repoRoot, promptFile); err != nil {
		return PromoteFindingResult{}, err
	}

	updatedRow := row
	updatedRow.Designs = uniqueStrings(append(updatedRow.Designs, designRelPath))
	updatedRow.Related = uniqueStrings(append(updatedRow.Related, designRelPath))
	updatedRow.UpdatedAt = nowUTC()
	updatedRow.dirty = true
	design := renderDesign(title, route, promptFile, updatedRow, designRelPath)
	findingRecordPath := layout.path(filepath.ToSlash(filepath.Join(row.Path, "finding.md")))
	findingRecord, err := os.ReadFile(findingRecordPath)
	if err != nil {
		return PromoteFindingResult{}, fmt.Errorf("read finding record: %w", err)
	}
	updatedFindingRecord, err := replaceDesignsSection(string(findingRecord), updatedRow, row.Path)
	if err != nil {
		return PromoteFindingResult{}, err
	}

	result := PromoteFindingResult{
		FindingID:          row.ID,
		RequestedFindingID: resolution.RequestedID,
		CanonicalFindingID: resolution.CanonicalID,
		RedirectChain:      resolution.Chain,
		DesignPath:         designRelPath,
		FindingPath:        row.Path,
		FindingsIndexPath:  layout.rel("system/.os/data/findings.jsonl"),
		DesignContent:      design,
		DryRun:             opts.DryRun,
	}
	if opts.DryRun {
		return result, nil
	}

	rows[targetIndex] = updatedRow
	updatedIndex, err := marshalFindingRows(rows)
	if err != nil {
		return PromoteFindingResult{}, err
	}
	originalIndex, err := os.ReadFile(findingsIndexPath)
	if err != nil {
		return PromoteFindingResult{}, fmt.Errorf("read findings index for rollback: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(designPath), 0o755); err != nil {
		return PromoteFindingResult{}, err
	}
	if err := replaceExistingFile(findingsIndexPath, updatedIndex); err != nil {
		return PromoteFindingResult{}, fmt.Errorf("replace findings index: %w", err)
	}
	if err := replaceExistingFile(findingRecordPath, []byte(updatedFindingRecord)); err != nil {
		if rollbackErr := replaceExistingFile(findingsIndexPath, originalIndex); rollbackErr != nil {
			return PromoteFindingResult{}, fmt.Errorf("replace finding record: %v; rollback findings index: %w", err, rollbackErr)
		}
		return PromoteFindingResult{}, fmt.Errorf("replace finding record: %w", err)
	}
	if err := createExclusiveFile(designPath, []byte(design)); err != nil {
		rollbackRecordErr := replaceExistingFile(findingRecordPath, findingRecord)
		rollbackIndexErr := replaceExistingFile(findingsIndexPath, originalIndex)
		if rollbackRecordErr != nil || rollbackIndexErr != nil {
			return PromoteFindingResult{}, fmt.Errorf("create design: %v; rollback finding record: %v; rollback findings index: %v", err, rollbackRecordErr, rollbackIndexErr)
		}
		return PromoteFindingResult{}, fmt.Errorf("create design: %w", err)
	}
	return result, nil
}

func requireDesignRouterInputs(repoRoot, promptFile string) error {
	layout := detectLayout(repoRoot)
	required := []struct {
		label string
		rel   string
	}{
		{"design router", "system/docs/designs/AGENTS.md"},
		{"design workflow", "system/docs/assets/references/design-workflow.md"},
		{"design contract", "system/docs/assets/references/design-contract.md"},
		{"design template", "system/docs/assets/templates/design.md"},
		{"next prompt", filepath.ToSlash(filepath.Join("system/docs/assets/prompts", promptFile))},
	}
	for _, item := range required {
		displayPath := layout.rel(item.rel)
		data, err := os.ReadFile(layout.path(item.rel))
		if err != nil {
			return fmt.Errorf("read %s %s: %w", item.label, displayPath, err)
		}
		if strings.TrimSpace(string(data)) == "" {
			return fmt.Errorf("%s %s is empty", item.label, displayPath)
		}
	}
	return nil
}

func readFindingRows(indexPath, findingID string) ([]findingIndexRow, int, error) {
	file, err := os.Open(indexPath)
	if err != nil {
		return nil, -1, fmt.Errorf("read %s: %w", filepath.ToSlash(indexPath), err)
	}
	defer file.Close()

	rows := []findingIndexRow{}
	seen := map[string]int{}
	targetIndex := -1
	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		rawLine := append([]byte(nil), scanner.Bytes()...)
		line := strings.TrimSpace(string(rawLine))
		if line == "" {
			continue
		}
		var row findingIndexRow
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			return nil, -1, fmt.Errorf("%s line %d invalid JSON: %w", filepath.ToSlash(indexPath), lineNumber, err)
		}
		if err := json.Unmarshal([]byte(line), &row.Raw); err != nil || row.Raw == nil {
			return nil, -1, fmt.Errorf("%s line %d must be a JSON object", filepath.ToSlash(indexPath), lineNumber)
		}
		row.rawLine = rawLine
		if row.ID == "" {
			return nil, -1, fmt.Errorf("%s line %d missing id", filepath.ToSlash(indexPath), lineNumber)
		}
		if prior, ok := seen[row.ID]; ok {
			return nil, -1, fmt.Errorf("%s line %d duplicates line %d id %s", filepath.ToSlash(indexPath), lineNumber, prior, row.ID)
		}
		seen[row.ID] = lineNumber
		if row.ID == findingID {
			targetIndex = len(rows)
		}
		rows = append(rows, row)
	}
	if err := scanner.Err(); err != nil {
		return nil, -1, err
	}
	if targetIndex == -1 {
		return nil, -1, fmt.Errorf("finding %s not found", findingID)
	}
	return rows, targetIndex, nil
}

func writeFindingRows(indexPath string, rows []findingIndexRow) error {
	data, err := marshalFindingRows(rows)
	if err != nil {
		return err
	}
	return replaceExistingFile(indexPath, data)
}

func marshalFindingRows(rows []findingIndexRow) ([]byte, error) {
	var builder strings.Builder
	for _, row := range rows {
		data, err := marshalFindingRow(row)
		if err != nil {
			return nil, err
		}
		builder.Write(data)
		builder.WriteByte('\n')
	}
	return []byte(builder.String()), nil
}

func marshalFindingRow(row findingIndexRow) ([]byte, error) {
	if !row.dirty && row.rawLine != nil {
		return append([]byte(nil), row.rawLine...), nil
	}
	typed, err := json.Marshal(row)
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(typed, &fields); err != nil {
		return nil, err
	}
	merged := make(map[string]json.RawMessage, len(row.Raw)+len(fields))
	for key, value := range row.Raw {
		merged[key] = append(json.RawMessage(nil), value...)
	}
	for _, key := range findingIndexOwnedFields {
		delete(merged, key)
	}
	for key, value := range fields {
		merged[key] = value
	}
	return json.Marshal(merged)
}

func splitQualificationAnchor(value string) (string, string, error) {
	value = strings.TrimSpace(value)
	pathPart, anchor, ok := strings.Cut(value, "#")
	if !ok || strings.TrimSpace(pathPart) == "" || strings.TrimSpace(anchor) == "" {
		return "", "", errors.New("qualification anchor must be path#anchor")
	}
	return pathPart, anchor, nil
}

func validateQualificationAnchor(repoRoot, qualificationPath, anchor string) error {
	layout := detectLayout(repoRoot)
	absPath := layout.path(qualificationPath)
	info, err := os.Stat(absPath)
	if err != nil {
		return fmt.Errorf("qualification anchor %s#%s: %w", qualificationPath, anchor, err)
	}
	if info.IsDir() {
		return fmt.Errorf("qualification anchor %s#%s points to a directory", qualificationPath, anchor)
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		return fmt.Errorf("read qualification anchor %s#%s: %w", qualificationPath, anchor, err)
	}
	if !strings.Contains(string(data), "{#"+anchor+"}") && !strings.Contains(string(data), "id=\""+anchor+"\"") {
		return fmt.Errorf("qualification anchor %s not found in %s", anchor, qualificationPath)
	}
	return nil
}

func renderDesign(title, route, promptFile string, row findingIndexRow, designRelPath string) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "# %s\n\n", title)
	builder.WriteString("## Purpose\n\n")
	fmt.Fprintf(&builder, "Capture the design hand-off for qualified finding `%s` so planning can proceed from repeatable evidence.\n\n", row.ID)
	builder.WriteString("## Context\n\n")
	fmt.Fprintf(&builder, "- Finding: [%s](%s)\n", row.ID, relativeDesignLink(designRelPath, filepath.ToSlash(filepath.Join(row.Path, "finding.md"))))
	fmt.Fprintf(&builder, "- Origin run: `%s`\n", row.OriginRun)
	fmt.Fprintf(&builder, "- Qualification: [%s](%s)\n", row.QualificationTest, relativeDesignLink(designRelPath, row.QualificationTest))
	fmt.Fprintf(&builder, "- Raw anchor: [%s](%s)\n", row.RawAnchor, relativeDesignLink(designRelPath, row.RawAnchor))
	fmt.Fprintf(&builder, "- Systems: %s\n", inlineList(row.Systems))
	fmt.Fprintf(&builder, "- Environments: %s\n", inlineList(row.Environments))
	fmt.Fprintf(&builder, "- Owners: %s\n\n", inlineList(row.Owners))
	if strings.TrimSpace(row.Summary) != "" {
		fmt.Fprintf(&builder, "%s\n\n", row.Summary)
	}
	if strings.TrimSpace(row.Observed) != "" {
		fmt.Fprintf(&builder, "%s\n\n", row.Observed)
	}
	builder.WriteString("## Decision\n\n")
	builder.WriteString("Use this design as the make-docs-routed follow-on artifact for the qualified finding. ")
	builder.WriteString("The finding remains the evidence-backed observation; this design owns solution framing, tradeoffs, and downstream planning context.\n\n")
	builder.WriteString("## Alternatives Considered\n\n")
	builder.WriteString("- Auto-promoting qualified findings was rejected because design promotion must remain user-gated.\n")
	builder.WriteString("- Writing outside the `system/docs/designs/` router was rejected because Build OS must preserve the make-docs boundary.\n\n")
	builder.WriteString("## Consequences\n\n")
	builder.WriteString("- The promoted design carries finding lineage, qualification evidence, configured scope, and owner metadata into the planning path.\n")
	builder.WriteString("- The source finding now records this design in its `designs` list for traceability.\n")
	builder.WriteString("- Stage-mover automation remains a later concern.\n\n")
	builder.WriteString("## Intended Follow-On\n\n")
	fmt.Fprintf(&builder, "- Route: `%s`\n", route)
	fmt.Fprintf(&builder, "- Next Prompt: [%s](../assets/prompts/%s)\n", promptFile, promptFile)
	if route == "baseline-plan" {
		builder.WriteString("- Why: This design should feed a fresh baseline planning flow for the promoted finding.\n")
		builder.WriteString("- Coordinate Handoff: not applicable for baseline planning.\n")
	} else {
		builder.WriteString("- Why: This design should feed additive planning from qualified evidence into the active Build OS planning path.\n")
		builder.WriteString("- Coordinate Handoff: unresolved; planner must resolve before writing.\n")
	}
	return builder.String()
}

func relativeDesignLink(designRelPath, target string) string {
	pathPart, anchor, hasAnchor := strings.Cut(target, "#")
	rel, err := filepath.Rel(filepath.Dir(filepath.FromSlash(designRelPath)), filepath.FromSlash(pathPart))
	if err != nil {
		rel = pathPart
	}
	rel = filepath.ToSlash(rel)
	if hasAnchor {
		return rel + "#" + anchor
	}
	return rel
}

func replaceDesignsSection(content string, row findingIndexRow, findingRelPath string) (string, error) {
	marker := "## Designs"
	start := strings.Index(content, marker)
	if start == -1 {
		content = strings.TrimRight(content, "\n")
		if content != "" {
			content += "\n\n"
		}
		return content + marker + "\n\n" + designList(row.Designs, findingRelPath), nil
	}
	afterStart := start + len(marker)
	next := strings.Index(content[afterStart:], "\n## ")
	end := len(content)
	if next != -1 {
		end = afterStart + next
	}
	replacement := marker + "\n\n" + designList(row.Designs, findingRelPath)
	if end < len(content) && !strings.HasSuffix(replacement, "\n\n") {
		replacement += "\n"
	}
	return content[:start] + replacement + content[end:], nil
}

func designList(designs []string, findingRelPath string) string {
	if len(designs) == 0 {
		return "No design hand-off recorded.\n"
	}
	var builder strings.Builder
	for _, design := range designs {
		rel, err := filepath.Rel(filepath.FromSlash(findingRelPath), filepath.FromSlash(design))
		if err != nil {
			rel = design
		}
		fmt.Fprintf(&builder, "- [%s](%s)\n", design, filepath.ToSlash(rel))
	}
	return builder.String()
}

func designSlug(explicitSlug, title string) (string, error) {
	if explicitSlug != "" {
		if !regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`).MatchString(explicitSlug) {
			return "", fmt.Errorf("slug %q must use lowercase letters, numbers, and hyphens", explicitSlug)
		}
		return explicitSlug, nil
	}
	slug := strings.ToLower(strings.TrimSpace(title))
	slug = regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return "", errors.New("promote finding requires --slug when title cannot produce a slug")
	}
	return slug, nil
}

func designAlreadyReferenced(layout buildOSLayout, rows []findingIndexRow, designRelPath string) bool {
	for _, row := range rows {
		for _, existing := range row.Designs {
			if layout.rel(existing) == designRelPath {
				return true
			}
		}
	}
	return false
}

func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

func inlineList(values []string) string {
	values = uniqueStrings(values)
	if len(values) == 0 {
		return "none"
	}
	return strings.Join(values, ", ")
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func atomicReplaceFile(path string, data []byte) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	temp, err := os.CreateTemp(dir, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return err
	}
	tempPath := temp.Name()
	closed := false
	defer func() {
		if !closed {
			_ = temp.Close()
		}
		_ = os.Remove(tempPath)
	}()
	if err := temp.Chmod(info.Mode().Perm()); err != nil {
		return err
	}
	if written, err := temp.Write(data); err != nil {
		return err
	} else if written != len(data) {
		return io.ErrShortWrite
	}
	if err := temp.Sync(); err != nil {
		return err
	}
	if err := temp.Close(); err != nil {
		closed = true
		return err
	}
	closed = true
	if err := renameAtomicFile(tempPath, path); err != nil {
		return err
	}
	return syncDirectory(dir)
}

func syncNewFile(path string, data []byte) error {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	remove := true
	closed := false
	defer func() {
		if !closed {
			_ = file.Close()
		}
		if remove {
			_ = os.Remove(path)
		}
	}()
	if written, err := file.Write(data); err != nil {
		return err
	} else if written != len(data) {
		return io.ErrShortWrite
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		closed = true
		return err
	}
	closed = true
	if err := syncDirectory(filepath.Dir(path)); err != nil {
		return err
	}
	remove = false
	return nil
}

func syncDirectory(path string) error {
	dir, err := os.Open(path)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func cleanRepoRoot(repoRoot string) string {
	if repoRoot == "" {
		return "."
	}
	abs, err := filepath.Abs(repoRoot)
	if err != nil {
		return filepath.Clean(repoRoot)
	}
	return filepath.Clean(abs)
}

func normalizeFindingRow(layout buildOSLayout, row *findingIndexRow) {
	row.Path = layout.rel(row.Path)
	row.RawAnchor = layout.ref(row.RawAnchor)
	row.QualificationTest = layout.ref(row.QualificationTest)
	row.ConfirmationTest = layout.rel(row.ConfirmationTest)
	row.ConfirmationEvidence = layout.rel(row.ConfirmationEvidence)
	row.SourceAnchor = layout.ref(row.SourceAnchor)
	row.DocAnchor = layout.ref(row.DocAnchor)
	row.Designs = layout.rels(row.Designs)
	row.SourceRefs = layout.refs(row.SourceRefs)
	row.Related = layout.refs(row.Related)
}

type buildOSLayout struct {
	repoRoot      string
	installedRoot bool
}

func detectLayout(repoRoot string) buildOSLayout {
	return buildOSLayout{repoRoot: repoRoot, installedRoot: isInstalledSystemRoot(repoRoot)}
}

func (layout buildOSLayout) rel(path string) string {
	path = filepath.ToSlash(path)
	if layout.installedRoot && strings.HasPrefix(path, "system/") {
		return strings.TrimPrefix(path, "system/")
	}
	return path
}

func (layout buildOSLayout) rels(values []string) []string {
	out := make([]string, len(values))
	for i, value := range values {
		out[i] = layout.rel(value)
	}
	return out
}

func (layout buildOSLayout) ref(value string) string {
	pathPart, anchor, hasAnchor := strings.Cut(value, "#")
	rel := layout.rel(pathPart)
	if hasAnchor {
		return rel + "#" + anchor
	}
	return rel
}

func (layout buildOSLayout) refs(values []string) []string {
	out := make([]string, len(values))
	for i, value := range values {
		out[i] = layout.ref(value)
	}
	return out
}

func (layout buildOSLayout) path(rel string) string {
	return filepath.Join(layout.repoRoot, filepath.FromSlash(layout.rel(rel)))
}

func isInstalledSystemRoot(repoRoot string) bool {
	required := []string{".os", "assets", "docs", "playbooks", "workspace"}
	for _, rel := range required {
		info, err := os.Stat(filepath.Join(repoRoot, rel))
		if err != nil || !info.IsDir() {
			return false
		}
	}
	return true
}

func nowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}
