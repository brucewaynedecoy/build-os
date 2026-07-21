package entities_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos/pkg/entities"
)

func TestOpenRootExposesInProcessResolver(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, ".os", "data")
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		t.Fatal(err)
	}
	datasets := []string{"requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"}
	for _, dataset := range datasets {
		content := []byte(nil)
		if dataset == "personas.jsonl" {
			content = []byte("{\"id\":\"PER-001\",\"type\":\"persona\",\"status\":\"active\",\"x_consumer_field\":true}\n")
		}
		if err := os.WriteFile(filepath.Join(dataDir, dataset), content, 0o600); err != nil {
			t.Fatal(err)
		}
	}

	graph, diagnostics := entities.OpenRoot(root, entities.ModeStrict)
	if entities.HasErrors(diagnostics) {
		t.Fatalf("OpenRoot diagnostics = %#v", diagnostics)
	}
	result, diagnostics := graph.Resolve("PER-001")
	if entities.HasErrors(diagnostics) || result.CanonicalID != "PER-001" || result.Resolved {
		t.Fatalf("Resolve result = %#v, diagnostics = %#v", result, diagnostics)
	}
	record, ok := graph.Record("PER-001")
	if !ok || record.Raw["x_consumer_field"] == nil {
		t.Fatal("temporary facade did not preserve consumer-owned field")
	}
}
