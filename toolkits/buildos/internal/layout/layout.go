package layout

import (
	"fmt"
	"os"
	"path/filepath"
)

// Root identifies one explicit BuildOS system root. The root contains the
// authoritative .os directory; callers must not infer it from their cwd.
type Root struct {
	Path      string
	DataDir   string
	IndexDir  string
	IndexPath string
}

// Resolve validates and canonicalizes an explicit BuildOS system root.
func Resolve(path string) (Root, error) {
	if path == "" {
		return Root{}, fmt.Errorf("--root is required")
	}

	abs, err := filepath.Abs(path)
	if err != nil {
		return Root{}, fmt.Errorf("resolve root: %w", err)
	}
	abs = filepath.Clean(abs)

	info, err := os.Stat(abs)
	if err != nil {
		return Root{}, fmt.Errorf("resolve root %q: %w", abs, err)
	}
	if !info.IsDir() {
		return Root{}, fmt.Errorf("resolve root %q: not a directory", abs)
	}

	dataDir := filepath.Join(abs, ".os", "data")
	dataInfo, err := os.Stat(dataDir)
	if err != nil {
		return Root{}, fmt.Errorf("resolve root %q: expected .os/data: %w", abs, err)
	}
	if !dataInfo.IsDir() {
		return Root{}, fmt.Errorf("resolve root %q: .os/data is not a directory", abs)
	}

	indexDir := filepath.Join(abs, ".os", "indexes")
	return Root{
		Path:      abs,
		DataDir:   dataDir,
		IndexDir:  indexDir,
		IndexPath: filepath.Join(indexDir, "entity-resolution.json"),
	}, nil
}
