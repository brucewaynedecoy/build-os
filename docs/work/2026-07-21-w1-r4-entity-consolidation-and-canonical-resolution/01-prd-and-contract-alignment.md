# Phase 01: PRD and Contract Alignment

## Purpose

Translate PRD 17 into shipped entity and extraction contracts before implementing graph behavior or migration tooling.

## Overview

This phase fixes the executable contract for redirect-bearing rows, terminal resolution, compatibility and strict validation, derived index ownership, and extraction outcome metadata. It preserves active PRD lineage and treats PRD 17 as the effective enhancement requirement.

## Source PRD Docs

- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 08: Data Layer and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 15: Revise Extraction Draft Lifecycle](../../prd/15-revise-extraction-draft-lifecycle.md)
- [PRD 16: Revise Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Stage 1 - Entity lifecycle and redirect contract

### Tasks

- [ ] t1: Extend `system/.os/contracts/entity-records-contract.md` with the required `redirect` object, allowed kinds, field meanings, and lifecycle rules for `draft`, `active`, `superseded`, and `archived` rows.
- [ ] t2: Specify graph invariants for existing targets, non-self targets, same-type edges, acyclic chains, active terminals, preserved losing-record fields, derived reverse membership, and non-canonical `related` edges.
- [ ] t3: Specify idempotent replay and reviewed remap-conflict behavior so an identical mapping is safe and a different target cannot overwrite an existing decision implicitly.
- [ ] t4: Add contract examples and fixtures for valid redirects and each invalid graph condition across every governed entity type.

### Acceptance criteria

- A newly written or changed `superseded` row requires exactly one valid redirect.
- `draft`, `active`, and `archived` rows cannot carry redirects, and archived remains the no-successor retention state.
- Losing records retain stable IDs, anchors, evidence, and type-specific fields.
- Cross-type redirects, cycles, missing targets, self-redirects, inactive terminals, and conflicting remaps are unambiguously invalid.

### Dependencies

- PRD 17 and its reconciled baseline annotations are available as the effective requirement.
- Existing entity contract structure and fixture conventions have been inspected before edits begin.

## Stage 2 - Resolution, index, and extraction contracts

### Tasks

- [ ] t5: Define the stable resolver result containing `requested_id`, `canonical_id`, `chain`, and `resolved`, including zero-hop and multi-hop semantics.
- [ ] t6: Define `system/.os/indexes/entity-resolution.json` as a rebuildable canonical-JSONL projection with versioned, lexically ordered `canonical_by_id` and `members_by_canonical` maps.
- [ ] t7: Extend extraction contracts so minted-output metadata distinguishes a new entity from a reference or update to an existing canonical entity.
- [ ] t8: Specify compatibility warnings for legacy superseded rows without redirects and strict failures for all graph, duplicate-ID, remap, and stale-index violations.
- [ ] t9: Reconcile contract links and routers so `references.json` remains the converted-source intake index and `buildos entities` owns entity-graph behavior without changing PRD 07 semantics.
- [ ] t10: Freeze the unified root commands, domain command names, common flags, result envelope, version metadata, exit-code policy, and temporary `pkg/entities` package boundary required by PRD 18.

### Acceptance criteria

- Readers can preserve an originally recorded ID while exposing the terminal canonical identity and full chain.
- New references are contractually required to store the terminal canonical ID.
- Canonical JSONL remains authoritative and the resolution index is explicitly disposable and reproducible.
- Compatibility mode never guesses a successor, and strict mode is identified as the release and post-migration gate.
- Extraction metadata can represent new, reused, and updated entity outcomes without conflating them.
- The W1 R4 command contract creates `buildos entities` and no public `buildos-entities` binary.

### Dependencies

- Stage 1 field names and graph invariants are final.
- Unified CLI and temporary package requirements from PRD 18 revise the earlier separate-toolkit boundary while preserving domain ownership.
