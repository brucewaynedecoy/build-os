# Phase 04: Read, Write, and Extraction Integration

## Purpose

Adopt the shared resolver across entity consumers and producers so historical identity remains auditable and new references use the terminal canonical ID.

## Overview

This phase integrates known-ID resolution broadly and adds deterministic persona matching narrowly. It does not bulk-rewrite historical references and does not apply persona heuristics to other entity types.

## Source PRD Docs

- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 08: Data Layer and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 09: Playbooks](../../prd/09-playbooks.md)
- [PRD 10: Discovery Runs and Qualification](../../prd/10-discovery-runs-and-qualification.md)
- [PRD 15: Revise Extraction Draft Lifecycle](../../prd/15-revise-extraction-draft-lifecycle.md)

## Stage 1 - Consumer and producer inventory

### Tasks

- [x] t1: Use code and documentation indexes to inventory every reader and writer of governed entity IDs, including extraction load plans, playbook targets, discovery or run promotion, validators, generated narratives, and command output.
- [x] t2: Classify each surface as historical read, current read, new write, intentional update, derived output, or review proposal and record its required resolver behavior.
- [x] t3: Identify any consumer that treats `superseded` as active, performs its own chain logic, or cannot expose both requested and canonical identity, and add targeted integration tests before changing it.

### Acceptance criteria

- The inventory covers all governed entity types and known entity-valued playbook targets.
- Every surface has an explicit read, write, or review-only contract.
- Missing consumers or conflicting local resolution logic are visible before implementation begins.

### Dependencies

- Phase 02 resolver API and index format are stable.
- Phase 03 has proven representative persona chains and ambiguity cases.

## Stage 2 - Redirect-aware reads and canonical writes

### Tasks

- [x] t4: Integrate `toolkits/buildos/pkg/entities` into entity readers so output preserves the requested ID and exposes the canonical ID and full chain.
- [x] t5: Integrate resolver checks into new reference creation and intentional updates so writers persist only the terminal canonical ID and fail closed on graph errors.
- [x] t6: Update playbook target use so historical targets remain unchanged for audit while execution resolves losing IDs to the active canonical entity.
- [x] t7: Update extraction outcome metadata to distinguish newly minted IDs from reused or updated canonical IDs.
- [x] t8: Add integration tests for old read-only tooling coexistence, redirect-aware reads, terminal-canonical writes, stale indexes, inactive terminals, and resolver error propagation.
- [x] t9: Wire the existing discovery and design modules to the temporary resolver package through explicit local module dependencies; prohibit subprocess invocation and duplicated graph traversal.

### Acceptance criteria

- Historical source references are not bulk rewritten.
- Readers expose original and canonical identity without treating a superseded record as the active winner.
- New references never persist an intermediate or superseded ID.
- Playbooks with historical losing targets remain auditable and resolve canonically when used.
- Extraction metadata truthfully records new, reused, and updated entity outcomes.

### Dependencies

- Stage 1 inventory and Phase 02 shared resolver are complete.
- Consumer changes land before corresponding producer changes so new canonical writes can be inspected consistently.

## Stage 3 - Persona matching and review boundary

### Tasks

- [x] t10: Define and version persona normalization, approved alias, consolidated-member identity, and deterministic `persona-v1` identity-key rules from the Phase 03 pilot evidence.
- [x] t11: Resolve exact persona IDs and unique approved type-scoped identities automatically to their terminal canonical persona.
- [x] t12: Route fuzzy, semantic, colliding, ambiguous, or otherwise probabilistic persona matches to non-mutating human review with evidence and confidence.
- [x] t13: Add repeated-extraction tests proving an approved persona is reused or updated rather than minted again and ambiguous input remains a proposal.
- [x] t14: Add guard tests preventing persona matching rules from enabling automatic matching for requirements, capabilities, findings, test cases, results, runs, or extractions without later type-specific contracts.

### Acceptance criteria

- Automatic persona matching occurs only for unique, approved, type-scoped deterministic identities.
- Probabilistic or ambiguous matches never create redirects or mutate canonical rows.
- Repeated extraction does not recreate an already approved persona duplicate.
- Other entity types receive known-ID resolution only until separately designed and validated.

### Dependencies

- Phase 03 approved persona cases and Stage 2 canonical read/write behavior are complete.
- Any new type-specific matching beyond personas requires a separate requirements decision and is not absorbed into this backlog.
