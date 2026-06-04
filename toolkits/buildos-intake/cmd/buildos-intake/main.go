package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos-intake/internal/intake"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "buildos-intake: error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage(os.Stderr)
		return fmt.Errorf("missing command")
	}

	switch args[0] {
	case "convert":
		return runConvert(args[1:])
	case "index":
		return runIndex(args[1:])
	case "help", "-h", "--help":
		printUsage(os.Stdout)
		return nil
	default:
		printUsage(os.Stderr)
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func runConvert(args []string) error {
	fs := flag.NewFlagSet("convert", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts intake.ConvertOptions
	fs.StringVar(&opts.RepoRoot, "repo-root", ".", "repository root")
	fs.StringVar(&opts.Source, "source", "", "source file or HTML directory to convert")
	fs.StringVar(&opts.AssetsRoot, "assets-root", "system/assets", "converted asset root")
	fs.StringVar(&opts.Type, "type", "auto", "source type: auto, csv, docx, xlsx, pdf, html, html-dir")
	fs.BoolVar(&opts.Force, "force", false, "overwrite existing converted twins")
	fs.BoolVar(&opts.DryRun, "dry-run", false, "print planned outputs without writing")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if opts.Source == "" {
		return fmt.Errorf("convert requires --source")
	}

	result, err := intake.Convert(opts)
	if err != nil {
		return err
	}
	for _, output := range result.Outputs {
		if opts.DryRun {
			fmt.Printf("would write %s\n", output.Path)
		} else {
			fmt.Printf("wrote %s\n", output.Path)
		}
	}
	for _, output := range result.SideArtifacts {
		if opts.DryRun {
			fmt.Printf("would write side artifact %s\n", output)
		} else {
			fmt.Printf("wrote side artifact %s\n", output)
		}
	}
	return nil
}

func runIndex(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("index requires subcommand references or playbooks")
	}
	switch args[0] {
	case "references":
		return runIndexReferences(args[1:])
	case "playbooks":
		return runIndexPlaybooks(args[1:])
	default:
		return fmt.Errorf("index requires subcommand references or playbooks")
	}
}

func runIndexReferences(args []string) error {
	fs := flag.NewFlagSet("index references", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts intake.IndexOptions
	fs.StringVar(&opts.RepoRoot, "repo-root", ".", "repository root")
	fs.StringVar(&opts.AssetsRoot, "assets-root", "system/assets", "converted asset root")
	fs.StringVar(&opts.Output, "output", "system/.os/indexes/references.json", "references index output path")
	if err := fs.Parse(args); err != nil {
		return err
	}

	result, err := intake.BuildReferencesIndex(opts)
	if err != nil {
		return err
	}
	fmt.Printf("wrote %s (%d references)\n", result.OutputPath, result.Count)
	return nil
}

func runIndexPlaybooks(args []string) error {
	fs := flag.NewFlagSet("index playbooks", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts intake.IndexOptions
	fs.StringVar(&opts.RepoRoot, "repo-root", ".", "repository root")
	fs.StringVar(&opts.PlaybooksRoot, "playbooks-root", "system/playbooks", "playbooks root")
	fs.StringVar(&opts.Output, "output", "system/.os/indexes/playbooks.json", "playbooks index output path")
	if err := fs.Parse(args); err != nil {
		return err
	}

	result, err := intake.BuildPlaybooksIndex(opts)
	if err != nil {
		return err
	}
	fmt.Printf("wrote %s (%d playbooks)\n", result.OutputPath, result.Count)
	return nil
}

func printUsage(out *os.File) {
	fmt.Fprintln(out, "Usage:")
	fmt.Fprintln(out, "  buildos-intake convert --source <path> [--repo-root <path>] [--assets-root system/assets] [--type auto|csv|docx|xlsx|pdf|html|html-dir] [--force] [--dry-run]")
	fmt.Fprintln(out, "  buildos-intake index references [--repo-root <path>] [--assets-root system/assets] [--output system/.os/indexes/references.json]")
	fmt.Fprintln(out, "  buildos-intake index playbooks [--repo-root <path>] [--playbooks-root system/playbooks] [--output system/.os/indexes/playbooks.json]")
}
