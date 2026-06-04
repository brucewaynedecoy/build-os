package intake

type ConvertOptions struct {
	RepoRoot   string
	Source     string
	AssetsRoot string
	Type       string
	Force      bool
	DryRun     bool
}

type ConvertedOutput struct {
	Path   string
	Source string
	SHA256 string
	Type   string
	Status string
	Body   string
}

type ConvertResult struct {
	Outputs       []ConvertedOutput
	SideArtifacts []string
}

type IndexOptions struct {
	RepoRoot      string
	AssetsRoot    string
	PlaybooksRoot string
	Output        string
}

type IndexResult struct {
	OutputPath string
	Count      int
}

type ReferenceIndex struct {
	Version    int              `json:"version"`
	References []ReferenceEntry `json:"references"`
}

type ReferenceEntry struct {
	ID        string `json:"id"`
	Source    string `json:"source"`
	Converted string `json:"converted"`
	SHA256    string `json:"sha256"`
	Type      string `json:"type"`
	Converter string `json:"converter"`
	Timestamp string `json:"timestamp"`
	Status    string `json:"status"`
}

type PlaybookIndex struct {
	Version   int             `json:"version"`
	Playbooks []PlaybookEntry `json:"playbooks"`
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
