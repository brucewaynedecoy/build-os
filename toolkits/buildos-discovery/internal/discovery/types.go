package discovery

type RunDiscoveryOptions struct {
	RepoRoot        string
	PlaybookID      string
	Outcome         string
	Title           string
	Targets         []string
	DatasetRefs     []string
	EvidencePaths   []string
	RawFindingPaths []string
	DryRun          bool
}

type RunDiscoveryResult struct {
	RunID           string
	RunPath         string
	RunsIndexPath   string
	EvidenceCount   int
	RawFindingCount int
	DryRun          bool
}

type QualifyFindingOptions struct {
	RepoRoot             string
	RunID                string
	RawFindingRef        string
	Outcome              string
	Title                string
	ConfirmationTest     string
	ConfirmationEvidence string
	DryRun               bool
}

type QualifyFindingResult struct {
	FindingID         string
	FindingPath       string
	FindingsIndexPath string
	DryRun            bool
}

type PlaybookIndex struct {
	Version           int             `json:"version"`
	Playbooks         []PlaybookEntry `json:"playbooks"`
	RunnablePlaybooks []PlaybookEntry `json:"runnable_playbooks"`
}

type PlaybookEntry struct {
	ID            string   `json:"id"`
	Path          string   `json:"path"`
	Title         string   `json:"title"`
	Category      string   `json:"category"`
	ExecutionMode string   `json:"execution_mode"`
	StateNature   string   `json:"state_nature"`
	Status        string   `json:"status"`
	Audience      string   `json:"audience"`
	Harness       []string `json:"harness"`
	Systems       []string `json:"systems"`
	Environments  []string `json:"environments"`
	Owners        []string `json:"owners"`
	Targets       []string `json:"targets"`
	Produces      []string `json:"produces"`
	SourceAnchor  *string  `json:"source_anchor"`
	Version       string   `json:"version"`
	Related       []string `json:"related"`
}
