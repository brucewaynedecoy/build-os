package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

// Exit codes are shared by every BuildOS command domain.
const (
	ExitOK             = 0
	ExitUsage          = 2
	ExitInput          = 3
	ExitValidation     = 4
	ExitIO             = 5
	ExitCommittedIndex = 6
)

const (
	WriteNotRequested                = "not_requested"
	WritePlanned                     = "planned"
	WriteApplied                     = "applied"
	WriteCanonicalAppliedIndexFailed = "canonical_applied_index_failed"
)

// BuildInfo is injected at build time. Source builds deliberately use
// version=dev and source_revision=unknown.
type BuildInfo struct {
	Version        string `json:"version"`
	SourceRevision string `json:"source_revision"`
}

// Diagnostic is the CLI-stable representation of a domain diagnostic.
type Diagnostic struct {
	Code       string   `json:"code"`
	Severity   string   `json:"severity"`
	Message    string   `json:"message"`
	Dataset    string   `json:"dataset,omitempty"`
	Line       int      `json:"line,omitempty"`
	EntityID   string   `json:"entity_id,omitempty"`
	TargetID   string   `json:"target_id,omitempty"`
	Chain      []string `json:"chain,omitempty"`
	Correction string   `json:"correction,omitempty"`
}

// Envelope is the shared automation contract for all commands.
type Envelope struct {
	OK             bool         `json:"ok"`
	Command        string       `json:"command"`
	Version        string       `json:"version"`
	SourceRevision string       `json:"source_revision"`
	Root           string       `json:"root"`
	Mode           string       `json:"mode"`
	WriteStatus    string       `json:"write_status"`
	Result         any          `json:"result"`
	Diagnostics    []Diagnostic `json:"diagnostics"`
}

func normalizeBuildInfo(info BuildInfo) BuildInfo {
	if strings.TrimSpace(info.Version) == "" {
		info.Version = "dev"
	}
	if strings.TrimSpace(info.SourceRevision) == "" {
		info.SourceRevision = "unknown"
	}
	return info
}

func writeJSON(w io.Writer, envelope Envelope) error {
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	return encoder.Encode(envelope)
}

func writeHuman(w io.Writer, envelope Envelope) error {
	status := "error"
	if envelope.OK {
		status = "ok"
	}
	if _, err := fmt.Fprintf(w, "%s: %s\n", envelope.Command, status); err != nil {
		return err
	}
	if envelope.Root != "" {
		if _, err := fmt.Fprintf(w, "root: %s\n", envelope.Root); err != nil {
			return err
		}
	}
	if envelope.Mode != "" {
		if _, err := fmt.Fprintf(w, "mode: %s\n", envelope.Mode); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintf(w, "version: %s\nsource revision: %s\nwrite status: %s\n",
		envelope.Version, envelope.SourceRevision, envelope.WriteStatus); err != nil {
		return err
	}
	for _, diagnostic := range envelope.Diagnostics {
		if _, err := fmt.Fprintf(w, "%s [%s]: %s", strings.ToUpper(diagnostic.Severity), diagnostic.Code, diagnostic.Message); err != nil {
			return err
		}
		if diagnostic.Correction != "" {
			if _, err := fmt.Fprintf(w, "\n  action: %s", diagnostic.Correction); err != nil {
				return err
			}
		}
		if _, err := fmt.Fprintln(w); err != nil {
			return err
		}
	}
	if envelope.Result != nil {
		encoded, err := json.MarshalIndent(envelope.Result, "", "  ")
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintln(w, string(encoded)); err != nil {
			return err
		}
	}
	return nil
}
