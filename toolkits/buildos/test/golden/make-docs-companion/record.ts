// W1 R7 P7 review round 2 (P7-R2-09): how `capture.ts --check` compares the
// capture record. `capture_os` is provenance: it records the OS and CPU the
// capture ran on, so a check on another machine must not compare it.

/** The record fields a capture on any machine reproduces. */
export const REPRODUCIBLE_FIELDS = ["$comment", "make_docs", "command", "files", "make_docs_system_files"] as const;

/** The reproducible fields whose values differ between the saved record and a new one. */
export function recordDifferences(saved: Record<string, unknown>, current: Record<string, unknown>): string[] {
  return REPRODUCIBLE_FIELDS.filter((key) => JSON.stringify(saved[key]) !== JSON.stringify(current[key]));
}
