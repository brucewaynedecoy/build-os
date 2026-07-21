# Phase 02: Resolver Toolkit and Index

## Purpose

Build the deterministic entity graph engine, command surface, validator modes, and reproducible resolution index required before any canonical data migration.

## Overview

This phase creates the independently buildable `buildos-entities` Go toolkit. Mutation remains dry-run by default, requires an explicit root and `--apply`, validates the complete graph before writing, and never infers an adopter root from a checkout or current directory.

## Source PRD Docs

- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 02: Architecture Overview](../../prd/02-architecture-overview.md)
- [PRD 08: Data Layer and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16: Revise Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)

## Stage 1 - Toolkit scaffold and graph engine

### Tasks

- [ ] t1: Create `toolkits/buildos-entities/` with Go module metadata, local README and agent routers, build targets, version or source-revision reporting, and a scope contract limited to entity-graph behavior.
- [ ] t2: Implement a whole-graph loader that reads all governed JSONL datasets, rejects invalid JSONL and duplicate IDs, and indexes records by stable ID and entity type.
- [ ] t3: Implement terminal resolution for zero-hop, one-hop, and multi-hop chains with the contractually stable result shape and fail-closed diagnostics.
- [ ] t4: Add graph tests for each entity type, every redirect kind, later winner replacement, same-type enforcement, missing and self targets, cycles, inactive terminals, illegal statuses, and remap conflicts.

### Acceptance criteria

- The toolkit builds independently under the repository's Go conventions and reports its provenance on every command.
- One shared engine supplies resolution and validation behavior rather than command-specific chain implementations.
- Diagnostics identify the offending record and complete problematic chain or cycle where applicable.
- Generic fixtures demonstrate identical graph semantics across all governed entity types.

### Dependencies

- Phase 01 contracts and fixtures are final.
- `toolkits/AGENTS.md`, PRD 14, and PRD 16 have been read before choosing module structure or dependencies.

## Stage 2 - Validation modes and deterministic index

### Tasks

- [ ] t5: Implement `buildos-entities validate --compat` with structured warnings for legacy superseded rows without redirects and no automatic target inference.
- [ ] t6: Implement strict validation for legacy omissions, graph invariants, duplicate IDs, remap conflicts, and stale or non-reproducible indexes.
- [ ] t7: Implement `buildos-entities resolve` with machine-readable and human-readable output for requested ID, canonical ID, chain, and resolution state.
- [ ] t8: Implement `buildos-entities rebuild-index` to emit stable lexical ordering from canonical JSONL only and support a non-writing `--check` mode.
- [ ] t9: Add reproducibility and stale-index tests that compare repeated byte output from unchanged input and report exact remediation commands.

### Acceptance criteria

- Compatibility mode excludes unresolved legacy superseded rows from automatic resolution while continuing the assessment.
- Strict validation rejects every release-blocking condition and passes only a fully valid graph and current index.
- Repeated index builds from identical canonical inputs are byte-identical.
- `--check` detects drift without mutating the index or canonical data.

### Dependencies

- Stage 1 graph loader and resolver are stable.
- Index format and compatibility-to-strict rules from Phase 01 are final.

## Stage 3 - Safe consolidation and recovery

### Tasks

- [ ] t10: Implement `buildos-entities consolidate` as a dry-run operation that requires explicit winner, loser, kind, reason, and adopter-root inputs and displays the exact planned record and index changes.
- [ ] t11: Add explicit `--apply` handling that validates the entire graph before mutation, writes through a same-filesystem temporary file, atomically replaces only the affected canonical JSONL file, and preserves permissions.
- [ ] t12: Rebuild the derived index after a successful canonical write and report an exact recovery command if index generation then fails.
- [ ] t13: Add tests for identical-mapping idempotence, conflicting-target non-writes, ambiguous or missing roots, unwritable roots, interrupted writes, invalid JSONL, and post-write index failure.
- [ ] t14: Add only thin `system/.os/scripts/` routing if required after the CLI stabilizes; do not add durable Python logic or move the domain into an existing unrelated toolkit.

### Acceptance criteria

- No mutation occurs without both an explicit root and `--apply`.
- Preflight graph failures prevent canonical writes.
- Affected JSONL replacement is atomic and preserves permissions; unrelated files remain unchanged.
- Post-write index failure leaves canonical data authoritative and provides a tested recovery path.
- Building and invoking the binary by explicit source path does not alter installed binaries, wrappers, or adopter-owned data.

### Dependencies

- Stages 1 and 2 pass their tests.
- Source checkout, installed program files, and adopter data remain separate roots throughout all tests.
