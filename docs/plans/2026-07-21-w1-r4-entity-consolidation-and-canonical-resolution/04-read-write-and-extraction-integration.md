# Phase Detail: Read, Write, and Extraction Integration

## P4 - Canonical References Across Consumers and Producers

Make Build OS consumers redirect-aware and ensure new entity-producing workflows write terminal canonical IDs without erasing what historical inputs originally referenced.

## Source Inputs

- P1 effective PRD and operating contracts
- P2 resolver API and deterministic index
- P3 approved persona rules and ambiguity fixtures
- `system/.os/data/extractions.jsonl`, extraction contracts, playbook target contracts, validators, and entity-reference consumers discovered with `jcodemunch`
- [PRD 08 data and extraction](../../prd/08-data-and-extraction.md), [PRD 09 playbooks](../../prd/09-playbooks.md), and [PRD 15 extraction lifecycle](../../prd/15-revise-extraction-draft-lifecycle.md)

## Workstreams

1. Inventory every reader and writer of governed entity IDs, including extraction load plans, playbook targets, discovery/run promotion surfaces, validators, generated narratives, and command output.
2. Update reads to preserve and expose the requested historical ID while also returning terminal canonical ID and full redirect chain through `toolkits/buildos/pkg/entities`; never silently replace source provenance.
3. Update new writes and intentional edits to resolve known IDs first and persist only the terminal canonical ID. Fail closed on unresolved graph errors or ambiguity.
4. Implement persona-first exact matching: exact ID, unique approved type-scoped alias or consolidated member identity, and an explicitly versioned persona identity key may resolve automatically; fuzzy, semantic, colliding, or ambiguous matches create review candidates only.
5. Update extraction output metadata so a reused or updated canonical ID is distinguishable from a newly minted ID and repeated extraction does not recreate an approved duplicate.
6. Keep other entity types on ID-based resolution only until each receives a separately reviewed, type-specific identity contract; do not generalize persona normalization heuristics across requirements, capabilities, findings, tests, results, runs, or extractions.
7. Add explicit local Go module dependencies for the existing discovery and design consumers; do not shell out to `buildos entities`, duplicate graph logic, or migrate those domains into the unified module before W1 R5.

## Dependencies

- Requires P2's stable resolver and P3's persona ambiguity boundary.
- Consumer updates may proceed in parallel by disjoint module after the resolver API freezes.
- Producer changes must land after corresponding read behavior so stored canonical IDs can be inspected and explained.
- Guide finalization waits for actual command output and error text from this phase.

## Acceptance Checks

- Existing historical references remain byte-preserved unless an explicit targeted migration is separately approved, yet all representative reads expose the correct terminal active record.
- New references never store an intermediate or superseded ID.
- Repeated extraction against a known persona updates or references the canonical persona and records that outcome rather than claiming a new mint.
- Exact approved aliases resolve only when unique within the entity type; collisions and probabilistic matches produce non-mutating review output.
- Playbook targets and other runtime consumers do not treat superseded entities as active winners.
- Integration tests cover old consumers in read-only coexistence, new consumer resolution, new producer canonicalization, stale index handling, and resolver failure propagation.

## Execution Notes

Use the temporary exported resolver package as the single source of graph behavior; do not reimplement chain following inside each consumer or call the CLI as a subprocess. Preserve the distinction between source observation and current canonical identity in command output, extraction metadata, and narrative generation. W1 R5 internalizes this package after moving the consumers into `toolkits/buildos/`.
