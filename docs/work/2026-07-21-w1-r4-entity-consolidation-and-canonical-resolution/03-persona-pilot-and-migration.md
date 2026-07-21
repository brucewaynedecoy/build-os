# Phase 03: Persona Pilot and Migration

## Purpose

Prove the generic redirect contract against reviewed persona duplicates and rehearse migration safely on a copied adopter root before broader integration or live cutover.

## Overview

The pre-upgrade prompt may prepare evidence and proposed mappings, but it remains proposal-only until the Phase 02 resolver, validator, writer, and index are available. This phase uses sanitized fixtures and a copied-root procedure; it does not authorize live-data mutation or binary deployment.

## Source PRD Docs

- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)
- [PRD 08: Data Layer and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 15: Revise Extraction Draft Lifecycle](../../prd/15-revise-extraction-draft-lifecycle.md)

## Stage 1 - Proposal-only persona audit

### Tasks

- [ ] t1: Run the [pre-upgrade audit prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md) against an approved read-only or sanitized dataset to inventory personas, inbound references, evidence, and likely duplicate groups.
- [ ] t2: Produce a proposed mapping manifest with winners, losers, redirect kinds, reasons, evidence references, confidence, ambiguity flags, source checksums, and no canonical mutations.
- [ ] t3: Review each proposed mapping with the configured decision owner and separate approved mappings from unresolved or ambiguous groups.
- [ ] t4: Create sanitized persona fixtures for one-hop and multi-hop redirects, a winner later superseded, an identical replay, a conflicting remap, ambiguous aliases, repeated extraction, and provenance preservation.

### Acceptance criteria

- The audit changes no lifecycle state, redirect field, entity reference, canonical row, index, or installed file.
- Every approved mapping has explicit decision ownership and evidence; confidence alone is never treated as approval.
- Ambiguous groups remain non-mutating review candidates.
- No live entity contents, absolute adopter paths, or secrets enter repository fixtures.

### Dependencies

- Phase 02 commands are available before any proposed mapping is converted into a redirect.
- The audit prompt remains optional guidance rather than authoritative product contract.

## Stage 2 - Side-by-side copied-root rehearsal

### Tasks

- [ ] t5: Inventory installed binary paths, wrapper behavior, installed versions, and the actual adopter-owned data root without modifying them.
- [ ] t6: Build `buildos-entities` in a separate source checkout and record the source revision, explicit binary path, and binary checksum without replacing installed binaries.
- [ ] t7: Create and identify a recoverable snapshot or copied working root containing canonical JSONL and current indexes.
- [ ] t8: Invoke the source-built binary by explicit path against the copy in compatibility and dry-run modes, then review warnings, chains, planned row changes, and the projected index diff.
- [ ] t9: Apply only the approved persona manifest to the copy, rebuild the index, run strict validation and representative lookups, and record validation outputs and mapping-manifest checksum.
- [ ] t10: Restore from the untouched snapshot or recreate the copied root and verify that rollback returns the pre-migration identity and index state.

### Acceptance criteria

- Compatibility assessment and all dry runs target only the copied root.
- The copied root passes strict validation and deterministic index checks after approved mappings are applied.
- Every losing persona keeps its stable ID, source evidence, anchors, and type-specific fields while resolving to one active terminal persona.
- The recorded evidence includes source revision, binary checksum, snapshot identity, manifest checksum, validation results, index diff, and rollback location.
- Installed binaries, wrappers, and live adopter data remain unchanged.

### Dependencies

- Stage 1 approved mapping set and Phase 02 mutation/recovery tests are complete.
- Binary deployment and live-data migration remain separate future operator approvals; neither is a task in this rehearsal stage.
