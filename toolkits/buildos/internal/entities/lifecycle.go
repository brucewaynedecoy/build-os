package entities

// isLegalLifecycleStatus keeps the common entity vocabulary strict while
// preserving the finding qualification gate that predates W1 R4. Qualified is
// a type-specific current state for findings; it is not a general status.
func isLegalLifecycleStatus(record Record) bool {
	switch record.Status {
	case "draft", "active", "superseded", "archived":
		return true
	case "qualified":
		return record.Type == "finding"
	case "running", "closed", "aborted":
		return record.Type == "run"
	default:
		return false
	}
}

// isTerminalCanonical reports whether a row is current and may terminate a
// canonical-resolution chain. Findings retain their established qualified
// promotion gate instead of being rewritten to the generic active status.
func isTerminalCanonical(record Record) bool {
	if record.Status == "active" || (record.Type == "finding" && record.Status == "qualified") {
		return true
	}
	return record.Type == "run" && (record.Status == "running" || record.Status == "closed" || record.Status == "aborted")
}

func lifecycleStatusAction(record Record) string {
	if record.Type == "finding" {
		return "set status to draft, active, qualified, superseded, or archived"
	}
	if record.Type == "run" {
		return "set status to running, closed, aborted, active, superseded, or archived"
	}
	return "set status to draft, active, superseded, or archived"
}
