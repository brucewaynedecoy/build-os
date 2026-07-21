package entities

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// Mode controls how legacy gaps are classified during validation.
type Mode string

const (
	ModeCompat Mode = "compat"
	ModeStrict Mode = "strict"
)

// ParseMode validates a command or API mode value.
func ParseMode(value string) (Mode, error) {
	mode := Mode(strings.ToLower(strings.TrimSpace(value)))
	switch mode {
	case ModeCompat, ModeStrict:
		return mode, nil
	default:
		return "", fmt.Errorf("unsupported entity validation mode %q (want compat or strict)", value)
	}
}

// Redirect is the reviewed immediate-successor decision stored on a
// superseded entity record.
type Redirect struct {
	TargetID     string   `json:"target_id"`
	Kind         string   `json:"kind"`
	DecidedAt    string   `json:"decided_at"`
	DecidedBy    string   `json:"decided_by"`
	Reason       string   `json:"reason"`
	EvidenceRefs []string `json:"evidence_refs"`
}

// Record contains the graph-owned fields plus the complete original object.
// Raw is intentionally retained so writers can preserve unknown and
// type-specific fields value-for-value.
type Record struct {
	ID       string                     `json:"id"`
	Type     string                     `json:"type"`
	Status   string                     `json:"status"`
	Redirect *Redirect                  `json:"redirect,omitempty"`
	Dataset  string                     `json:"dataset"`
	Path     string                     `json:"path"`
	Line     int                        `json:"line"`
	Raw      map[string]json.RawMessage `json:"-"`
}

// Resolution is the stable terminal-resolution result contract.
type Resolution struct {
	RequestedID string   `json:"requested_id"`
	CanonicalID string   `json:"canonical_id"`
	Chain       []string `json:"chain"`
	Resolved    bool     `json:"resolved"`
}

// Graph is an immutable, complete view of the eight governed entity datasets.
// Callers receive cloned records so mutations cannot corrupt graph state.
type Graph struct {
	records map[string]Record
}

// Record returns a safe copy of the record with id.
func (g *Graph) Record(id string) (Record, bool) {
	if g == nil {
		return Record{}, false
	}
	record, ok := g.records[id]
	if !ok {
		return Record{}, false
	}
	return cloneRecord(record), true
}

// Records returns all records sorted by stable ID.
func (g *Graph) Records() []Record {
	if g == nil {
		return nil
	}
	ids := make([]string, 0, len(g.records))
	for id := range g.records {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	records := make([]Record, 0, len(ids))
	for _, id := range ids {
		records = append(records, cloneRecord(g.records[id]))
	}
	return records
}

func cloneRecord(record Record) Record {
	cloned := record
	if record.Redirect != nil {
		redirect := *record.Redirect
		redirect.EvidenceRefs = append([]string(nil), record.Redirect.EvidenceRefs...)
		cloned.Redirect = &redirect
	}
	cloned.Raw = cloneRawObject(record.Raw)
	return cloned
}

func cloneRawObject(object map[string]json.RawMessage) map[string]json.RawMessage {
	if object == nil {
		return nil
	}
	cloned := make(map[string]json.RawMessage, len(object))
	for key, value := range object {
		cloned[key] = append(json.RawMessage(nil), value...)
	}
	return cloned
}
