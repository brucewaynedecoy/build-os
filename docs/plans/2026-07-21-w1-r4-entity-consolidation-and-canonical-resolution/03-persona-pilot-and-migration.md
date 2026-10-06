# Phase Detail: Persona Pilot and Migration

## P3 - Reviewed Persona Consolidation and Copied-Root Rehearsal

Prove the generic contract against the high-volume persona use case and establish a recoverable migration procedure for adopters who can build from source beside an existing installation.

## Source Inputs

- P2 staged source-built `buildos` binary and passing CLI, graph, and index tests
- [Pre-upgrade entity consolidation audit prompt](../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- Reviewed, non-mutating persona inventory and proposed mapping manifest
- Representative persona, extraction, and reference fixtures
- Operator-supplied installed-binary, wrapper, adopter-root, snapshot, and rollback locations

## Workstreams

1. Use the pre-upgrade prompt only for read-only inventory, clustering, evidence capture, confidence, ambiguity, checksums, and proposed winner/loser mappings; do not add redirect fields or lifecycle mutations during audit.
2. Define a small reviewed persona proving set covering duplicates, intentional consolidation, replacement, ambiguous lookalikes, one-hop chains, multi-hop chains, a winner later superseded, and a repeated already-applied mapping.
3. Build `buildos` by explicit source path, record source revision and binary checksum, and inventory the still-separate installed intake, discovery, and design paths plus the actual adopter root without replacing any of them.
4. Create a recoverable copy or snapshot of the adopter root. Run compatibility validation and dry-run consolidation against the copy, review the exact diff and warnings, then apply only the approved manifest to the copy.
5. Rebuild and check the resolution index, run strict validation and representative persona lookups, verify the untouched snapshot restores the pre-migration state, and record all evidence needed for separate deployment and live-data approvals.

## Dependencies

- Requires P2's source-built binary, compatibility warnings, strict gate, atomic writes, and deterministic index.
- The mapping manifest requires human or explicitly configured owner approval; confidence scores alone cannot authorize a redirect.
- P4 may use persona matching rules only after ambiguous and unique cases are demonstrated in this pilot.

## Acceptance Checks

- Every losing persona retains its stable ID, source and document anchors, type-specific fields, and reviewed decision evidence.
- Approved mappings resolve to one active persona; ambiguous groups remain unresolved review candidates with no canonical mutation.
- The same manifest is idempotent, while a conflicting winner produces a non-writing conflict.
- Compatibility warnings are captured before mutation and the copied root passes strict validation afterward.
- The staged `buildos` binary is invoked by explicit path, and neither installed binary routing nor live adopter data changes during rehearsal.
- Source revision, binary checksum, root snapshot identity, mapping manifest checksum, validation outputs, index diff, and rollback location are recorded.
- Binary deployment and live-data migration remain two distinct operator approvals outside this repository task.

## Execution Notes

The repository supplies fixtures and procedure contracts, not the adopter's private production records. Sanitize all examples and never commit live mappings, absolute adopter paths, source asset contents, or environment secrets. A failed snapshot, ambiguous root, or graph error is a hard stop for mutation.
