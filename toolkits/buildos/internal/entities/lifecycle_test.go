package entities

import "testing"

func TestFindingQualifiedIsATypeSpecificCanonicalTerminal(t *testing.T) {
	graph := &Graph{records: map[string]Record{
		"FIND-001": {ID: "FIND-001", Type: "finding", Status: "superseded", Redirect: &Redirect{TargetID: "FIND-002"}},
		"FIND-002": {ID: "FIND-002", Type: "finding", Status: "qualified"},
	}}

	if diagnostics := graph.Validate(ModeStrict); HasErrors(diagnostics) {
		t.Fatalf("qualified finding graph should validate: %#v", diagnostics)
	}
	resolution, diagnostics := graph.Resolve("FIND-001")
	if HasErrors(diagnostics) {
		t.Fatalf("qualified finding should resolve: %#v", diagnostics)
	}
	if resolution.CanonicalID != "FIND-002" {
		t.Fatalf("canonical id = %q, want FIND-002", resolution.CanonicalID)
	}
}

func TestQualifiedDoesNotBecomeAGeneralEntityStatus(t *testing.T) {
	graph := &Graph{records: map[string]Record{
		"REQ-001": {ID: "REQ-001", Type: "requirement", Status: "qualified"},
	}}

	if diagnostics := graph.Validate(ModeStrict); !HasErrors(diagnostics) {
		t.Fatal("qualified requirement should fail validation")
	}
	if _, diagnostics := graph.Resolve("REQ-001"); !HasErrors(diagnostics) {
		t.Fatal("qualified requirement should not resolve as canonical")
	}
}

func TestRunLifecycleStatusesRemainTypeSpecificCanonicalTerminals(t *testing.T) {
	for _, status := range []string{"running", "closed", "aborted"} {
		t.Run(status, func(t *testing.T) {
			graph := &Graph{records: map[string]Record{
				"RUN-001": {ID: "RUN-001", Type: "run", Status: status},
			}}
			if diagnostics := graph.Validate(ModeStrict); HasErrors(diagnostics) {
				t.Fatalf("%s run should validate: %#v", status, diagnostics)
			}
			if _, diagnostics := graph.Resolve("RUN-001"); HasErrors(diagnostics) {
				t.Fatalf("%s run should resolve: %#v", status, diagnostics)
			}
		})
	}
}
