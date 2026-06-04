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
	RepoRoot   string
	AssetsRoot string
	Output     string
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
