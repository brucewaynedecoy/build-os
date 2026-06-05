package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos-design/internal/design"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "buildos-design: error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage(os.Stderr)
		return fmt.Errorf("missing command")
	}

	switch args[0] {
	case "promote":
		return runPromote(args[1:])
	case "help", "-h", "--help":
		printUsage(os.Stdout)
		return nil
	default:
		printUsage(os.Stderr)
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func runPromote(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("promote requires subcommand finding")
	}
	switch args[0] {
	case "finding":
		return runPromoteFinding(args[1:])
	default:
		return fmt.Errorf("promote requires subcommand finding")
	}
}

func runPromoteFinding(args []string) error {
	fs := flag.NewFlagSet("promote finding", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts design.PromoteFindingOptions
	fs.StringVar(&opts.RepoRoot, "repo-root", ".", "repository root")
	fs.StringVar(&opts.FindingID, "finding-id", "", "qualified finding ID")
	fs.StringVar(&opts.Route, "route", "", "design follow-on route: baseline-plan or change-plan")
	fs.StringVar(&opts.Title, "title", "", "design title")
	fs.StringVar(&opts.Slug, "slug", "", "design slug; lowercase letters, numbers, and hyphens")
	fs.BoolVar(&opts.DryRun, "dry-run", false, "print planned design hand-off without writing")
	if err := fs.Parse(args); err != nil {
		return err
	}

	result, err := design.PromoteFinding(opts)
	if err != nil {
		return err
	}
	if result.DryRun {
		fmt.Printf("would write %s (%s)\n", result.DesignPath, result.FindingID)
	} else {
		fmt.Printf("wrote %s (%s)\n", result.DesignPath, result.FindingID)
	}
	return nil
}

func printUsage(out *os.File) {
	fmt.Fprintln(out, "Usage:")
	fmt.Fprintln(out, "  buildos-design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]")
}
