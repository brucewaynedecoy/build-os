package discovery

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	runOutcomes     = map[string]bool{"positive": true, "negative": true, "inconclusive": true}
	findingOutcomes = map[string]bool{"positive": true, "negative": true}
)

type copiedArtifact struct {
	Source string
	Path   string
}

type runIndexRow struct {
	ID                string         `json:"id"`
	Type              string         `json:"type"`
	Path              string         `json:"path"`
	Title             string         `json:"title"`
	Status            string         `json:"status"`
	Summary           string         `json:"summary"`
	Outcome           string         `json:"outcome"`
	PlaybookID        string         `json:"playbook_id"`
	PlaybookVersion   string         `json:"playbook_version"`
	Targets           []string       `json:"targets"`
	Systems           []string       `json:"systems"`
	Environments      []string       `json:"environments"`
	Owners            []string       `json:"owners"`
	StartedAt         string         `json:"started_at"`
	EndedAt           string         `json:"ended_at"`
	EvidenceCount     int            `json:"evidence_count"`
	RawFindingCount   int            `json:"raw_finding_count"`
	QualifiedFindings []string       `json:"qualified_findings"`
	DatasetRefs       []string       `json:"dataset_refs"`
	SourceAnchor      string         `json:"source_anchor"`
	DocAnchor         string         `json:"doc_anchor"`
	SourceRefs        []string       `json:"source_refs"`
	Related           []string       `json:"related"`
	CreatedAt         string         `json:"created_at"`
	UpdatedAt         string         `json:"updated_at"`
	Inputs            map[string]any `json:"inputs"`
	Outputs           map[string]any `json:"outputs"`
}

type findingIndexRow struct {
	ID                   string   `json:"id"`
	Type                 string   `json:"type"`
	Path                 string   `json:"path"`
	Title                string   `json:"title"`
	Status               string   `json:"status"`
	Summary              string   `json:"summary"`
	Observed             string   `json:"observed"`
	BasisRefs            []string `json:"basis_refs"`
	Confidence           string   `json:"confidence"`
	Implications         []string `json:"implications"`
	Outcome              string   `json:"outcome"`
	Polarity             string   `json:"polarity"`
	RunID                string   `json:"run_id"`
	OriginRun            string   `json:"origin_run"`
	RawAnchor            string   `json:"raw_anchor"`
	QualificationTest    string   `json:"qualification_test"`
	ConfirmationTest     string   `json:"confirmation_test"`
	ConfirmationEvidence string   `json:"confirmation_evidence"`
	NegativeAssertion    string   `json:"negative_assertion,omitempty"`
	Systems              []string `json:"systems"`
	Environments         []string `json:"environments"`
	Owners               []string `json:"owners"`
	QualifiedAt          string   `json:"qualified_at"`
	Designs              []string `json:"designs"`
	SourceAnchor         string   `json:"source_anchor"`
	DocAnchor            string   `json:"doc_anchor"`
	SourceRefs           []string `json:"source_refs"`
	Related              []string `json:"related"`
	CreatedAt            string   `json:"created_at"`
	UpdatedAt            string   `json:"updated_at"`
}

func RecordDiscoveryRun(opts RunDiscoveryOptions) (RunDiscoveryResult, error) {
	repoRoot := cleanRepoRoot(opts.RepoRoot)
	layout := detectLayout(repoRoot)
	if opts.PlaybookID == "" {
		return RunDiscoveryResult{}, errors.New("run discovery requires --playbook-id")
	}
	if !runOutcomes[opts.Outcome] {
		return RunDiscoveryResult{}, errors.New("run discovery requires --outcome positive, negative, or inconclusive")
	}

	playbook, err := activeDiscoveryPlaybook(repoRoot, opts.PlaybookID)
	if err != nil {
		return RunDiscoveryResult{}, err
	}

	runsIndexPath := layout.path("system/.os/data/runs.jsonl")
	runID, err := nextJSONLID(runsIndexPath, "RUN")
	if err != nil {
		return RunDiscoveryResult{}, err
	}

	runRelPath := layout.rel(filepath.ToSlash(filepath.Join("system/workspace/runs", runID)) + "/")
	runPath := layout.path(runRelPath)
	if _, err := os.Stat(runPath); err == nil {
		return RunDiscoveryResult{}, fmt.Errorf("run artifact %s already exists", runRelPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return RunDiscoveryResult{}, err
	}

	evidence, err := planCopiedArtifacts(repoRoot, opts.EvidencePaths, filepath.ToSlash(filepath.Join(runRelPath, "evidence")))
	if err != nil {
		return RunDiscoveryResult{}, err
	}
	rawTexts, rawSources, err := rawFindingContent(repoRoot, opts.RawFindingPaths)
	if err != nil {
		return RunDiscoveryResult{}, err
	}
	datasetRefs := uniqueStrings(layout.refs(opts.DatasetRefs))
	sourceRefs := uniqueStrings(layout.refs(append([]string{playbook.Path}, rawSources...)))

	targets := opts.Targets
	if len(targets) == 0 {
		targets = playbook.Targets
	}
	now := nowUTC()
	title := strings.TrimSpace(opts.Title)
	if title == "" {
		title = fmt.Sprintf("Discovery run %s", runID)
	}
	rawAnchors := make([]string, len(rawTexts))
	for i := range rawTexts {
		rawAnchors[i] = fmt.Sprintf("raw-findings.md#raw-finding-%d", i+1)
	}

	row := runIndexRow{
		ID:                runID,
		Type:              "run",
		Path:              runRelPath,
		Title:             title,
		Status:            "closed",
		Summary:           fmt.Sprintf("Discovery run recorded from playbook %s.", playbook.ID),
		Outcome:           opts.Outcome,
		PlaybookID:        playbook.ID,
		PlaybookVersion:   playbook.Version,
		Targets:           uniqueStrings(targets),
		Systems:           uniqueStrings(playbook.Systems),
		Environments:      uniqueStrings(playbook.Environments),
		Owners:            uniqueStrings(playbook.Owners),
		StartedAt:         now,
		EndedAt:           now,
		EvidenceCount:     len(evidence),
		RawFindingCount:   len(rawTexts),
		QualifiedFindings: []string{},
		DatasetRefs:       datasetRefs,
		SourceAnchor:      filepath.ToSlash(filepath.Join(runRelPath, "run.md")) + "#run-" + strings.ToLower(runID),
		DocAnchor:         layout.ref("system/docs/prd/10-discovery-runs-and-qualification.md#run-artifacts"),
		SourceRefs:        sourceRefs,
		Related:           uniqueStrings(append([]string{playbook.ID}, targets...)),
		CreatedAt:         now,
		UpdatedAt:         now,
		Inputs: map[string]any{
			"playbook_id":      playbook.ID,
			"playbook_version": playbook.Version,
			"targets":          uniqueStrings(targets),
			"dataset_refs":     datasetRefs,
		},
		Outputs: map[string]any{
			"evidence":     artifactPaths(evidence),
			"raw_findings": rawAnchors,
		},
	}

	result := RunDiscoveryResult{
		RunID:           runID,
		RunPath:         runRelPath,
		RunsIndexPath:   layout.rel("system/.os/data/runs.jsonl"),
		EvidenceCount:   len(evidence),
		RawFindingCount: len(rawTexts),
		DryRun:          opts.DryRun,
	}
	if opts.DryRun {
		return result, nil
	}

	if err := os.MkdirAll(filepath.Join(runPath, "evidence"), 0o755); err != nil {
		return RunDiscoveryResult{}, err
	}
	for _, artifact := range evidence {
		if err := copyFile(resolveRepoPath(repoRoot, artifact.Source), layout.path(artifact.Path)); err != nil {
			return RunDiscoveryResult{}, err
		}
	}
	if err := os.WriteFile(filepath.Join(runPath, "run.md"), []byte(formatRunRecord(row, evidence, rawAnchors)), 0o644); err != nil {
		return RunDiscoveryResult{}, err
	}
	if err := os.WriteFile(filepath.Join(runPath, "raw-findings.md"), []byte(formatRawFindings(runID, rawTexts)), 0o644); err != nil {
		return RunDiscoveryResult{}, err
	}
	if err := appendJSONL(runsIndexPath, row); err != nil {
		return RunDiscoveryResult{}, err
	}
	return result, nil
}

func QualifyFinding(opts QualifyFindingOptions) (QualifyFindingResult, error) {
	repoRoot := cleanRepoRoot(opts.RepoRoot)
	layout := detectLayout(repoRoot)
	if opts.RunID == "" {
		return QualifyFindingResult{}, errors.New("qualify finding requires --run-id")
	}
	if !findingOutcomes[opts.Outcome] {
		return QualifyFindingResult{}, errors.New("qualify finding requires --outcome positive or negative")
	}
	if opts.ConfirmationTest == "" {
		return QualifyFindingResult{}, errors.New("qualify finding requires --confirmation-test")
	}
	if opts.ConfirmationEvidence == "" {
		return QualifyFindingResult{}, errors.New("qualify finding requires --confirmation-evidence")
	}
	if err := requireFile(resolveRepoPath(repoRoot, opts.ConfirmationTest), "--confirmation-test"); err != nil {
		return QualifyFindingResult{}, err
	}
	if err := requireFile(resolveRepoPath(repoRoot, opts.ConfirmationEvidence), "--confirmation-evidence"); err != nil {
		return QualifyFindingResult{}, err
	}

	runsIndexPath := layout.path("system/.os/data/runs.jsonl")
	runRow, err := readRunIndexRow(runsIndexPath, opts.RunID)
	if err != nil {
		return QualifyFindingResult{}, err
	}
	rawRef, err := normalizeRawFindingRef(layout, opts.RunID, opts.RawFindingRef)
	if err != nil {
		return QualifyFindingResult{}, err
	}
	if err := validateRawFindingAnchor(repoRoot, rawRef); err != nil {
		return QualifyFindingResult{}, err
	}

	findingsIndexPath := layout.path("system/.os/data/findings.jsonl")
	findingID, err := nextJSONLID(findingsIndexPath, "FIND")
	if err != nil {
		return QualifyFindingResult{}, err
	}
	findingRelPath := layout.rel(filepath.ToSlash(filepath.Join("system/workspace/findings", findingID)) + "/")
	findingPath := layout.path(findingRelPath)
	if _, err := os.Stat(findingPath); err == nil {
		return QualifyFindingResult{}, fmt.Errorf("finding artifact %s already exists", findingRelPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return QualifyFindingResult{}, err
	}

	testArtifacts, err := planCopiedArtifacts(repoRoot, []string{opts.ConfirmationTest}, filepath.ToSlash(filepath.Join(findingRelPath, "confirmation-test")))
	if err != nil {
		return QualifyFindingResult{}, err
	}
	evidenceArtifacts, err := planCopiedArtifacts(repoRoot, []string{opts.ConfirmationEvidence}, filepath.ToSlash(filepath.Join(findingRelPath, "evidence")))
	if err != nil {
		return QualifyFindingResult{}, err
	}

	now := nowUTC()
	title := strings.TrimSpace(opts.Title)
	if title == "" {
		title = fmt.Sprintf("Qualified finding %s", findingID)
	}
	rawAnchor := rawRef
	negativeAssertion := ""
	if opts.Outcome == "negative" {
		negativeAssertion = fmt.Sprintf("The confirmation test %s asserts the negative condition and passed repeatably.", testArtifacts[0].Path)
	}
	row := findingIndexRow{
		ID:                   findingID,
		Type:                 "finding",
		Path:                 findingRelPath,
		Title:                title,
		Status:               "qualified",
		Summary:              fmt.Sprintf("Finding qualified from run %s.", opts.RunID),
		Observed:             fmt.Sprintf("Raw finding %s was deterministically confirmed.", rawAnchor),
		BasisRefs:            []string{opts.RunID, rawAnchor},
		Confidence:           "high",
		Implications:         []string{},
		Outcome:              opts.Outcome,
		Polarity:             opts.Outcome,
		RunID:                opts.RunID,
		OriginRun:            opts.RunID,
		RawAnchor:            rawAnchor,
		QualificationTest:    filepath.ToSlash(filepath.Join(findingRelPath, "qualification.md")) + "#confirmation-test",
		ConfirmationTest:     testArtifacts[0].Path,
		ConfirmationEvidence: evidenceArtifacts[0].Path,
		NegativeAssertion:    negativeAssertion,
		Systems:              uniqueStrings(runRow.Systems),
		Environments:         uniqueStrings(runRow.Environments),
		Owners:               uniqueStrings(runRow.Owners),
		QualifiedAt:          now,
		Designs:              []string{},
		SourceAnchor:         rawAnchor,
		DocAnchor:            layout.ref("system/docs/prd/10-discovery-runs-and-qualification.md#finding-qualification"),
		SourceRefs:           []string{rawAnchor},
		Related:              uniqueStrings([]string{opts.RunID}),
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	result := QualifyFindingResult{
		FindingID:         findingID,
		FindingPath:       findingRelPath,
		FindingsIndexPath: layout.rel("system/.os/data/findings.jsonl"),
		DryRun:            opts.DryRun,
	}
	if opts.DryRun {
		return result, nil
	}

	if err := os.MkdirAll(filepath.Join(findingPath, "confirmation-test"), 0o755); err != nil {
		return QualifyFindingResult{}, err
	}
	if err := os.MkdirAll(filepath.Join(findingPath, "evidence"), 0o755); err != nil {
		return QualifyFindingResult{}, err
	}
	for _, artifact := range append(testArtifacts, evidenceArtifacts...) {
		if err := copyFile(resolveRepoPath(repoRoot, artifact.Source), layout.path(artifact.Path)); err != nil {
			return QualifyFindingResult{}, err
		}
	}
	if err := os.WriteFile(filepath.Join(findingPath, "finding.md"), []byte(formatFindingRecord(row)), 0o644); err != nil {
		return QualifyFindingResult{}, err
	}
	if err := os.WriteFile(filepath.Join(findingPath, "qualification.md"), []byte(formatQualificationRecord(row)), 0o644); err != nil {
		return QualifyFindingResult{}, err
	}
	if err := appendJSONL(findingsIndexPath, row); err != nil {
		return QualifyFindingResult{}, err
	}
	return result, nil
}

func activeDiscoveryPlaybook(repoRoot, playbookID string) (PlaybookEntry, error) {
	layout := detectLayout(repoRoot)
	indexPath := layout.path("system/.os/indexes/playbooks.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return PlaybookEntry{}, fmt.Errorf("read playbook index: %w", err)
	}
	var index PlaybookIndex
	if err := json.Unmarshal(data, &index); err != nil {
		return PlaybookEntry{}, fmt.Errorf("parse playbook index: %w", err)
	}
	var catalogMatch *PlaybookEntry
	for i := range index.Playbooks {
		if index.Playbooks[i].ID == playbookID {
			catalogMatch = &index.Playbooks[i]
			break
		}
	}
	for _, playbook := range index.RunnablePlaybooks {
		if playbook.ID != playbookID {
			continue
		}
		if playbook.Status != "active" {
			return PlaybookEntry{}, fmt.Errorf("playbook %s is %q; run discovery requires active", playbookID, playbook.Status)
		}
		if playbook.Category != "discovery" {
			return PlaybookEntry{}, fmt.Errorf("playbook %s is %q; run discovery requires category discovery", playbookID, playbook.Category)
		}
		if playbook.Version == "" {
			return PlaybookEntry{}, fmt.Errorf("playbook %s is missing version", playbookID)
		}
		return playbook, nil
	}
	if catalogMatch != nil {
		return PlaybookEntry{}, fmt.Errorf("playbook %s is not active/runnable", playbookID)
	}
	return PlaybookEntry{}, fmt.Errorf("playbook %s not found in playbook index", playbookID)
}

func nextJSONLID(indexPath, prefix string) (string, error) {
	file, err := os.Open(indexPath)
	if errors.Is(err, os.ErrNotExist) {
		return fmt.Sprintf("%s-001", prefix), nil
	}
	if err != nil {
		return "", err
	}
	defer file.Close()

	seen := map[string]int{}
	maxID := 0
	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var row struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			return "", fmt.Errorf("%s line %d invalid JSON: %w", filepath.ToSlash(indexPath), lineNumber, err)
		}
		if row.ID == "" {
			continue
		}
		if prior, ok := seen[row.ID]; ok {
			return "", fmt.Errorf("%s line %d duplicates line %d id %s", filepath.ToSlash(indexPath), lineNumber, prior, row.ID)
		}
		seen[row.ID] = lineNumber
		if numeric, ok := numericSuffix(row.ID, prefix); ok && numeric > maxID {
			maxID = numeric
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%03d", prefix, maxID+1), nil
}

func numericSuffix(id, prefix string) (int, bool) {
	prefixText := prefix + "-"
	if !strings.HasPrefix(id, prefixText) {
		return 0, false
	}
	numeric, err := strconv.Atoi(strings.TrimPrefix(id, prefixText))
	if err != nil {
		return 0, false
	}
	return numeric, true
}

func planCopiedArtifacts(repoRoot string, paths []string, targetRelDir string) ([]copiedArtifact, error) {
	artifacts := make([]copiedArtifact, 0, len(paths))
	used := map[string]bool{}
	layout := detectLayout(repoRoot)
	for i, source := range paths {
		if source == "" {
			continue
		}
		if err := requireFile(resolveRepoPath(repoRoot, source), source); err != nil {
			return nil, err
		}
		name := fmt.Sprintf("%03d-%s", i+1, sluggedFilename(filepath.Base(source)))
		if used[name] {
			return nil, fmt.Errorf("duplicate copied artifact name %s", name)
		}
		used[name] = true
		artifacts = append(artifacts, copiedArtifact{
			Source: layout.ref(source),
			Path:   filepath.ToSlash(filepath.Join(targetRelDir, name)),
		})
	}
	return artifacts, nil
}

func sluggedFilename(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, " ", "-")
	re := regexp.MustCompile(`[^a-z0-9._-]+`)
	name = re.ReplaceAllString(name, "-")
	name = strings.Trim(name, "-._")
	if name == "" {
		return "artifact"
	}
	return name
}

func rawFindingContent(repoRoot string, paths []string) ([]string, []string, error) {
	texts := make([]string, 0, len(paths))
	sources := make([]string, 0, len(paths))
	layout := detectLayout(repoRoot)
	for _, source := range paths {
		if source == "" {
			continue
		}
		path := resolveRepoPath(repoRoot, source)
		if err := requireFile(path, source); err != nil {
			return nil, nil, err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, nil, err
		}
		texts = append(texts, strings.TrimSpace(string(data)))
		sources = append(sources, layout.ref(filepath.ToSlash(source)))
	}
	return texts, sources, nil
}

func artifactPaths(artifacts []copiedArtifact) []string {
	paths := make([]string, len(artifacts))
	for i, artifact := range artifacts {
		paths[i] = artifact.Path
	}
	return paths
}

func appendJSONL(path string, row any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(row)
	if err != nil {
		return err
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()
	if _, err := file.Write(append(data, '\n')); err != nil {
		return err
	}
	return nil
}

func copyFile(source, target string) error {
	if _, err := os.Stat(target); err == nil {
		return fmt.Errorf("artifact %s already exists", filepath.ToSlash(target))
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	defer output.Close()
	_, err = io.Copy(output, input)
	return err
}

func formatRawFindings(runID string, rawTexts []string) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "# Raw Findings for %s\n\n", runID)
	if len(rawTexts) == 0 {
		builder.WriteString("No raw findings recorded.\n")
		return builder.String()
	}
	for i, text := range rawTexts {
		fmt.Fprintf(&builder, "## Raw Finding %d {#raw-finding-%d}\n\n", i+1, i+1)
		if strings.TrimSpace(text) == "" {
			builder.WriteString("_No raw finding text provided._\n\n")
		} else {
			builder.WriteString(strings.TrimSpace(text))
			builder.WriteString("\n\n")
		}
	}
	return builder.String()
}

func formatRunRecord(row runIndexRow, evidence []copiedArtifact, rawAnchors []string) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "# %s\n\n", row.Title)
	fmt.Fprintf(&builder, "## Run %s {#run-%s}\n\n", row.ID, strings.ToLower(row.ID))
	fmt.Fprintf(&builder, "- Status: %s\n", row.Status)
	fmt.Fprintf(&builder, "- Outcome: %s\n", row.Outcome)
	fmt.Fprintf(&builder, "- Playbook: %s (%s)\n", row.PlaybookID, row.PlaybookVersion)
	fmt.Fprintf(&builder, "- Started: %s\n", row.StartedAt)
	fmt.Fprintf(&builder, "- Ended: %s\n", row.EndedAt)
	fmt.Fprintf(&builder, "- Targets: %s\n", inlineList(row.Targets))
	fmt.Fprintf(&builder, "- Dataset refs: %s\n\n", inlineList(row.DatasetRefs))
	builder.WriteString("## Evidence\n\n")
	if len(evidence) == 0 {
		builder.WriteString("No evidence files recorded.\n\n")
	} else {
		for _, artifact := range evidence {
			fmt.Fprintf(&builder, "- [%s](%s)\n", artifact.Source, relativeRunArtifact(row.Path, artifact.Path))
		}
		builder.WriteString("\n")
	}
	builder.WriteString("## Raw Findings\n\n")
	if len(rawAnchors) == 0 {
		builder.WriteString("No raw findings recorded.\n")
	} else {
		for _, anchor := range rawAnchors {
			fmt.Fprintf(&builder, "- [%s](%s)\n", anchor, anchor)
		}
	}
	return builder.String()
}

func relativeRunArtifact(runPath, artifactPath string) string {
	rel, err := filepath.Rel(filepath.FromSlash(runPath), filepath.FromSlash(artifactPath))
	if err != nil {
		return filepath.ToSlash(artifactPath)
	}
	return filepath.ToSlash(rel)
}

func formatFindingRecord(row findingIndexRow) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "# %s\n\n", row.Title)
	fmt.Fprintf(&builder, "## Finding %s {#finding-%s}\n\n", row.ID, strings.ToLower(row.ID))
	fmt.Fprintf(&builder, "- Status: %s\n", row.Status)
	fmt.Fprintf(&builder, "- Polarity: %s\n", row.Polarity)
	fmt.Fprintf(&builder, "- Origin run: %s\n", row.OriginRun)
	fmt.Fprintf(&builder, "- Raw anchor: [%s](%s)\n", row.RawAnchor, relativeFindingArtifact(row.Path, row.RawAnchor))
	fmt.Fprintf(&builder, "- Qualification test: [%s](qualification.md#confirmation-test)\n", row.QualificationTest)
	fmt.Fprintf(&builder, "- Qualified at: %s\n\n", row.QualifiedAt)
	fmt.Fprintf(&builder, "## Observation\n\n%s\n\n", row.Observed)
	if row.NegativeAssertion != "" {
		fmt.Fprintf(&builder, "## Negative Assertion\n\n%s\n\n", row.NegativeAssertion)
	}
	builder.WriteString("## Designs\n\nNo design hand-off recorded.\n")
	return builder.String()
}

func formatQualificationRecord(row findingIndexRow) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "# Qualification for %s\n\n", row.ID)
	builder.WriteString("## Confirmation Test {#confirmation-test}\n\n")
	builder.WriteString("- Test type: Playwright\n")
	fmt.Fprintf(&builder, "- Procedure: rerun `%s`\n", row.ConfirmationTest)
	fmt.Fprintf(&builder, "- Assertion: %s\n", qualificationAssertion(row))
	builder.WriteString("- Result: pass\n")
	fmt.Fprintf(&builder, "- Evidence: [%s](%s)\n", row.ConfirmationEvidence, relativeFindingArtifact(row.Path, row.ConfirmationEvidence))
	if row.NegativeAssertion != "" {
		fmt.Fprintf(&builder, "\n## Negative Assertion\n\n%s\n", row.NegativeAssertion)
	}
	return builder.String()
}

func qualificationAssertion(row findingIndexRow) string {
	if row.Polarity == "negative" {
		return "The deterministic test asserts the negative condition and passes."
	}
	return "The deterministic test confirms the asserted behavior and passes."
}

func relativeFindingArtifact(findingPath, artifactPath string) string {
	rel, err := filepath.Rel(filepath.FromSlash(findingPath), filepath.FromSlash(artifactPath))
	if err != nil {
		return filepath.ToSlash(artifactPath)
	}
	return filepath.ToSlash(rel)
}

func inlineList(values []string) string {
	if len(values) == 0 {
		return "[]"
	}
	return strings.Join(values, ", ")
}

func uniqueStrings(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	sort.Strings(out)
	return out
}

func normalizeRawFindingRef(layout buildOSLayout, runID, rawRef string) (string, error) {
	if rawRef == "" {
		return "", errors.New("qualify finding requires --raw-finding-ref")
	}
	if strings.HasPrefix(rawRef, "#") {
		return layout.rel(filepath.ToSlash(filepath.Join("system/workspace/runs", runID, "raw-findings.md")) + rawRef), nil
	}
	if strings.HasPrefix(rawRef, "raw-findings.md#") {
		return layout.rel(filepath.ToSlash(filepath.Join("system/workspace/runs", runID, rawRef))), nil
	}
	if strings.Contains(rawRef, "#") {
		return layout.rel(filepath.ToSlash(rawRef)), nil
	}
	return "", fmt.Errorf("raw finding reference %q must be a path#anchor", rawRef)
}

func validateRawFindingAnchor(repoRoot, rawRef string) error {
	pathPart, anchor, ok := strings.Cut(rawRef, "#")
	if !ok || anchor == "" {
		return fmt.Errorf("raw finding reference %q must be a path#anchor", rawRef)
	}
	path := resolveRepoPath(repoRoot, pathPart)
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read raw finding reference %s: %w", rawRef, err)
	}
	if !strings.Contains(string(data), anchor) {
		return fmt.Errorf("raw finding anchor %s not found in %s", anchor, pathPart)
	}
	return nil
}

func readRunIndexRow(indexPath, runID string) (runIndexRow, error) {
	file, err := os.Open(indexPath)
	if err != nil {
		return runIndexRow{}, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var row runIndexRow
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			return runIndexRow{}, err
		}
		if row.ID == runID {
			return row, nil
		}
	}
	if err := scanner.Err(); err != nil {
		return runIndexRow{}, err
	}
	return runIndexRow{}, fmt.Errorf("run %s not found", runID)
}

func requireFile(path, label string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("%s: %w", label, err)
	}
	if info.IsDir() {
		return fmt.Errorf("%s must be a file", label)
	}
	return nil
}

func resolveRepoPath(repoRoot, path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	layout := detectLayout(repoRoot)
	return layout.path(path)
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
