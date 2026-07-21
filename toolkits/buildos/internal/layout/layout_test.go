package layout

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveRequiresExplicitRoot(t *testing.T) {
	_, err := Resolve("")
	if err == nil || !strings.Contains(err.Error(), "--root is required") {
		t.Fatalf("Resolve error = %v, want required-root error", err)
	}
}

func TestResolveBuildOSRoot(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, ".os", "data"), 0o755); err != nil {
		t.Fatal(err)
	}

	got, err := Resolve(root)
	if err != nil {
		t.Fatal(err)
	}
	want, err := filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}
	if got.Path != want {
		t.Fatalf("Path = %q, want %q", got.Path, want)
	}
	if got.IndexPath != filepath.Join(want, ".os", "indexes", "entity-resolution.json") {
		t.Fatalf("IndexPath = %q", got.IndexPath)
	}
}
