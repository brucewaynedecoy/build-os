package main

import (
	"os"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos/internal/cli"
)

var (
	version        = "dev"
	sourceRevision = "unknown"
)

func main() {
	os.Exit(cli.Run(os.Args[1:], os.Stdout, os.Stderr, cli.BuildInfo{
		Version:        version,
		SourceRevision: sourceRevision,
	}))
}
