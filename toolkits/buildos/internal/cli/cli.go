package cli

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
)

type errorClass int

const (
	classInput errorClass = iota
	classValidation
	classIO
	classCommittedIndex
)

type commandError struct {
	class       errorClass
	diagnostics []Diagnostic
	cause       error
}

func (e *commandError) Error() string { return e.cause.Error() }
func (e *commandError) Unwrap() error { return e.cause }

type commandOptions struct {
	root     string
	mode     string
	id       string
	manifest string
	json     bool
	apply    bool
	check    bool
}

type entityService interface {
	Resolve(root, mode, id string) (string, any, []Diagnostic, error)
	Validate(root, mode string) (string, any, []Diagnostic, error)
	Consolidate(root, mode, manifest string, apply bool) (string, bool, any, []Diagnostic, error)
	RebuildIndex(root, mode string, apply bool) (string, bool, any, []Diagnostic, error)
}

var newEntityService = func() entityService { return domainService{} }

// Run executes one BuildOS command and returns a process exit code.
func Run(args []string, stdout, stderr io.Writer, buildInfo BuildInfo) int {
	buildInfo = normalizeBuildInfo(buildInfo)
	if len(args) == 0 {
		_, _ = io.WriteString(stdout, rootHelp)
		return ExitOK
	}

	switch args[0] {
	case "help", "-h", "--help":
		_, _ = io.WriteString(stdout, rootHelp)
		return ExitOK
	case "version":
		return runVersion(args[1:], stdout, stderr, buildInfo)
	case "entities":
		return runEntities(args[1:], stdout, stderr, buildInfo, newEntityService())
	default:
		return writeUsageError(stdout, stderr, buildInfo, false, "buildos", fmt.Sprintf("unknown command %q", args[0]))
	}
}

func runVersion(args []string, stdout, stderr io.Writer, buildInfo BuildInfo) int {
	flags := flag.NewFlagSet("version", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	jsonOutput := flags.Bool("json", false, "emit JSON")
	if err := flags.Parse(args); err != nil || flags.NArg() != 0 {
		message := "version accepts only --json"
		if err != nil {
			message = err.Error()
		}
		return writeUsageError(stdout, stderr, buildInfo, *jsonOutput, "buildos version", message)
	}
	payload := struct {
		Version        string `json:"version"`
		SourceRevision string `json:"source_revision"`
	}{buildInfo.Version, buildInfo.SourceRevision}
	envelope := newEnvelope("version", buildInfo, "not_applicable", "not_applicable", WriteNotRequested, nil, payload)
	if *jsonOutput {
		_ = writeJSON(stdout, envelope)
	} else {
		_ = writeHuman(stdout, envelope)
	}
	return ExitOK
}

func runEntities(args []string, stdout, stderr io.Writer, buildInfo BuildInfo, service entityService) int {
	if len(args) == 0 || args[0] == "help" || args[0] == "-h" || args[0] == "--help" {
		_, _ = io.WriteString(stdout, entitiesHelp)
		return ExitOK
	}
	command := args[0]
	commandName := "entities." + command
	options, err := parseEntityOptions(command, args[1:])
	if err != nil {
		return writeUsageError(stdout, stderr, buildInfo, containsJSON(args[1:]), commandName, err.Error())
	}

	var (
		resolvedRoot string
		written      bool
		payload      any
		diagnostics  []Diagnostic
		runErr       error
	)
	service = nonNilService(service)
	switch command {
	case "resolve":
		resolvedRoot, payload, diagnostics, runErr = service.Resolve(options.root, options.mode, options.id)
	case "validate":
		resolvedRoot, payload, diagnostics, runErr = service.Validate(options.root, options.mode)
	case "consolidate":
		resolvedRoot, written, payload, diagnostics, runErr = service.Consolidate(options.root, options.mode, options.manifest, options.apply)
	case "rebuild-index":
		resolvedRoot, written, payload, diagnostics, runErr = service.RebuildIndex(options.root, options.mode, options.apply)
	default:
		return writeUsageError(stdout, stderr, buildInfo, options.json, commandName, fmt.Sprintf("unknown entities command %q", command))
	}

	ok := true
	exitCode := ExitOK
	if runErr != nil {
		ok = false
		exitCode = classifyExit(runErr)
		if len(diagnostics) == 0 {
			diagnostics = []Diagnostic{{Code: "internal_error", Severity: "error", Message: runErr.Error(), Correction: "Review the reported error and retry after correcting the input or root."}}
		}
	}
	writeStatus := WriteNotRequested
	if (command == "consolidate" && !options.apply) || (command == "rebuild-index" && !options.apply && !options.check) {
		writeStatus = WritePlanned
	}
	if options.apply && runErr == nil {
		writeStatus = WriteApplied
	}
	if options.apply && exitCode == ExitCommittedIndex {
		writeStatus = WriteCanonicalAppliedIndexFailed
	}
	_ = written // domain write detail remains represented by the authoritative status enum.
	envelope := newEnvelope(commandName, buildInfo, resolvedRoot, options.mode, writeStatus, diagnostics, payload)
	envelope.OK = ok
	if options.json {
		_ = writeJSON(stdout, envelope)
	} else if runErr != nil {
		_ = writeHuman(stderr, envelope)
	} else {
		_ = writeHuman(stdout, envelope)
	}
	return exitCode
}

func parseEntityOptions(command string, args []string) (commandOptions, error) {
	options := commandOptions{}
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&options.root, "root", "", "explicit BuildOS root")
	flags.StringVar(&options.mode, "mode", "", "compat or strict")
	flags.BoolVar(&options.json, "json", false, "emit JSON")
	if command == "resolve" {
		flags.StringVar(&options.id, "id", "", "entity ID")
	}
	if command == "consolidate" {
		flags.StringVar(&options.manifest, "manifest", "", "reviewed manifest")
		flags.BoolVar(&options.apply, "apply", false, "apply canonical mutation")
	}
	if command == "rebuild-index" {
		flags.BoolVar(&options.check, "check", false, "check index only")
		flags.BoolVar(&options.apply, "apply", false, "write index")
	}
	if err := flags.Parse(args); err != nil {
		return options, err
	}
	if flags.NArg() != 0 {
		return options, fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	if options.root == "" {
		return options, errors.New("--root is required")
	}
	if options.mode != "compat" && options.mode != "strict" {
		return options, errors.New("--mode must be compat or strict")
	}
	switch command {
	case "resolve":
		if options.id == "" {
			return options, errors.New("--id is required")
		}
	case "validate":
	case "consolidate":
		if options.manifest == "" {
			return options, errors.New("--manifest is required")
		}
	case "rebuild-index":
		if options.check && options.apply {
			return options, errors.New("--check and --apply are mutually exclusive")
		}
	default:
		return options, fmt.Errorf("unknown entities command %q", command)
	}
	return options, nil
}

func newEnvelope(command string, info BuildInfo, root, mode, writeStatus string, diagnostics []Diagnostic, result any) Envelope {
	if diagnostics == nil {
		diagnostics = []Diagnostic{}
	}
	return Envelope{
		OK: true, Command: command, Version: info.Version, SourceRevision: info.SourceRevision,
		Root: root, Mode: mode, WriteStatus: writeStatus, Result: result, Diagnostics: diagnostics,
	}
}

func writeUsageError(stdout, stderr io.Writer, info BuildInfo, jsonOutput bool, command, message string) int {
	diagnostic := Diagnostic{Code: "usage_error", Severity: "error", Message: message, Correction: "Run buildos help for command syntax."}
	envelope := newEnvelope(command, info, "", "", WriteNotRequested, []Diagnostic{diagnostic}, nil)
	envelope.OK = false
	if jsonOutput {
		_ = writeJSON(stdout, envelope)
	} else {
		_ = writeHuman(stderr, envelope)
	}
	return ExitUsage
}

func containsJSON(args []string) bool {
	for _, arg := range args {
		if arg == "--json" {
			return true
		}
	}
	return false
}

func classifyExit(err error) int {
	var classified *commandError
	if errors.As(err, &classified) {
		switch classified.class {
		case classInput:
			return ExitInput
		case classValidation:
			return ExitValidation
		case classCommittedIndex:
			return ExitCommittedIndex
		default:
			return ExitIO
		}
	}
	return ExitIO
}

type unavailableService struct{}

func nonNilService(service entityService) entityService {
	if service == nil {
		return unavailableService{}
	}
	return service
}

func (unavailableService) Resolve(string, string, string) (string, any, []Diagnostic, error) {
	return "", nil, nil, &commandError{class: classIO, cause: errors.New("entity service unavailable")}
}
func (unavailableService) Validate(string, string) (string, any, []Diagnostic, error) {
	return "", nil, nil, &commandError{class: classIO, cause: errors.New("entity service unavailable")}
}
func (unavailableService) Consolidate(string, string, string, bool) (string, bool, any, []Diagnostic, error) {
	return "", false, nil, nil, &commandError{class: classIO, cause: errors.New("entity service unavailable")}
}
func (unavailableService) RebuildIndex(string, string, bool) (string, bool, any, []Diagnostic, error) {
	return "", false, nil, nil, &commandError{class: classIO, cause: errors.New("entity service unavailable")}
}
