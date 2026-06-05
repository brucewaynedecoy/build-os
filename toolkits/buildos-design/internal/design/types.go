package design

type PromoteFindingOptions struct {
	RepoRoot  string
	FindingID string
	Route     string
	Title     string
	Slug      string
	DryRun    bool
}

type PromoteFindingResult struct {
	FindingID         string
	DesignPath        string
	FindingPath       string
	FindingsIndexPath string
	DesignContent     string
	DryRun            bool
}
