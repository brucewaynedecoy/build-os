package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/brucewaynedecoy/build-os/toolkits/buildos-discovery/internal/discovery"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "buildos-discovery: error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage(os.Stderr)
		return fmt.Errorf("missing command")
	}

	switch args[0] {
	case "run":
		return runRun(args[1:])
	case "qualify":
		return runQualify(args[1:])
	case "help", "-h", "--help":
		printUsage(os.Stdout)
		return nil
	default:
		printUsage(os.Stderr)
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func runRun(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("run requires subcommand discovery")
	}
	switch args[0] {
	case "discovery":
		return runDiscovery(args[1:])
	default:
		return fmt.Errorf("run requires subcommand discovery")
	}
}

func runDiscovery(args []string) error {
	fs := flag.NewFlagSet("run discovery", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts discovery.RunDiscoveryOptions
	var targets stringListFlag
	var datasetRefs stringListFlag
	var evidencePaths stringListFlag
	var rawFindingPaths stringListFlag
	fs.StringVar(&opts.RepoRoot, "repo-root", ".", "repository root")
	fs.StringVar(&opts.PlaybookID, "playbook-id", "", "active discovery playbook ID")
	fs.StringVar(&opts.Outcome, "outcome", "", "run outcome: positive, negative, inconclusive")
	fs.StringVar(&opts.Title, "title", "", "run title")
	fs.Var(&targets, "target", "entity target addressed by the run; may be repeated")
	fs.Var(&datasetRefs, "dataset-ref", "dataset reference used by the run; may be repeated")
	fs.Var(&evidencePaths, "evidence", "evidence file to copy into the run; may be repeated")
	fs.Var(&rawFindingPaths, "raw-finding", "raw finding text/markdown file; may be repeated")
	fs.BoolVar(&opts.DryRun, "dry-run", false, "print planned run without writing")
	if err := fs.Parse(args); err != nil {
		return err
	}
	opts.Targets = []string(targets)
	opts.DatasetRefs = []string(datasetRefs)
	opts.EvidencePaths = []string(evidencePaths)
	opts.RawFindingPaths = []string(rawFindingPaths)

	result, err := discovery.RecordDiscoveryRun(opts)
	if err != nil {
		return err
	}
	if result.DryRun {
		fmt.Printf("would write %s (%s)\n", result.RunPath, result.RunID)
	} else {
		fmt.Printf("wrote %s (%s)\n", result.RunPath, result.RunID)
	}
	return nil
}

func runQualify(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("qualify requires subcommand finding")
	}
	switch args[0] {
	case "finding":
		return runQualifyFinding(args[1:])
	default:
		return fmt.Errorf("qualify requires subcommand finding")
	}
}

func runQualifyFinding(args []string) error {
	fs := flag.NewFlagSet("qualify finding", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	var opts discovery.QualifyFindingOptions
	fs.StringVar(&opts.RepoRoot, "repo-root", ".", "repository root")
	fs.StringVar(&opts.RunID, "run-id", "", "origin run ID")
	fs.StringVar(&opts.RawFindingRef, "raw-finding-ref", "", "raw finding reference under the origin run")
	fs.StringVar(&opts.Outcome, "outcome", "", "finding outcome: positive or negative")
	fs.StringVar(&opts.Title, "title", "", "finding title")
	fs.StringVar(&opts.ConfirmationTest, "confirmation-test", "", "deterministic Playwright confirmation test file")
	fs.StringVar(&opts.ConfirmationEvidence, "confirmation-evidence", "", "confirmation evidence file")
	fs.BoolVar(&opts.DryRun, "dry-run", false, "print planned finding without writing")
	if err := fs.Parse(args); err != nil {
		return err
	}

	result, err := discovery.QualifyFinding(opts)
	if err != nil {
		return err
	}
	if result.DryRun {
		fmt.Printf("would write %s (%s)\n", result.FindingPath, result.FindingID)
	} else {
		fmt.Printf("wrote %s (%s)\n", result.FindingPath, result.FindingID)
	}
	return nil
}

func printUsage(out *os.File) {
	fmt.Fprintln(out, "Usage:")
	fmt.Fprintln(out, "  buildos-discovery run discovery --playbook-id <PB-NNN> --outcome positive|negative|inconclusive [--title <text>] [--target <ID>] [--dataset-ref <path>] [--evidence <path>] [--raw-finding <path>] [--repo-root <path>] [--dry-run]")
	fmt.Fprintln(out, "  buildos-discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome positive|negative [--title <text>] --confirmation-test <path> --confirmation-evidence <path> [--repo-root <path>] [--dry-run]")
}

type stringListFlag []string

func (f *stringListFlag) String() string {
	return fmt.Sprint([]string(*f))
}

func (f *stringListFlag) Set(value string) error {
	*f = append(*f, value)
	return nil
}
