# Phase 02: Unified CLI Seed, Resolver, and Index

## Purpose

Seed the unified CLI and build the deterministic entity graph engine, command surface, validator modes, and reproducible resolution index required before any canonical data migration.

## Overview

This phase creates the source-build-only `toolkits/buildos/` Go module and `buildos entities` domain. Mutation remains dry-run by default, requires an explicit root and `--apply`, validates the complete graph before writing, and never infers an adopter root from a checkout or current directory. Intake, discovery, and design remain separate binaries until W1 R5.

## Source PRD Docs

- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 02: Architecture Overview](../../prd/02-architecture-overview.md)
- [PRD 08: Data Layer and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16: Revise Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Stage 1 - Unified CLI scaffold and graph engine

### Tasks

- [x] t1: Create `toolkits/buildos/` with Go module metadata, `cmd/buildos`, local README and agent routers, root help and version behavior, build targets, and source-build defaults of version `dev` and revision `unknown`.
- [x] t2: Implement a whole-graph loader that reads all governed JSONL datasets, rejects invalid JSONL and duplicate IDs, and indexes records by stable ID and entity type.
- [x] t3: Implement terminal resolution for zero-hop, one-hop, and multi-hop chains with the contractually stable result shape and fail-closed diagnostics.
- [x] t4: Add graph tests for each entity type, every redirect kind, later winner replacement, same-type enforcement, missing and self targets, cycles, inactive terminals, illegal statuses, and remap conflicts.
- [x] t5: Expose the resolver temporarily through `toolkits/buildos/pkg/entities` with an interface existing Go modules can import without subprocess calls or duplicated chain logic.

### Acceptance criteria

- The unified seed builds independently under the repository's Go conventions and reports version, source revision, resolved root, mode, and write status on every result.
- One shared engine supplies resolution and validation behavior rather than command-specific chain implementations.
- Diagnostics identify the offending record and complete problematic chain or cycle where applicable.
- Generic fixtures demonstrate identical graph semantics across all governed entity types.

### Dependencies

- Phase 01 contracts and fixtures are final.
- `toolkits/AGENTS.md`, PRD 14, and PRD 16 have been read before choosing module structure or dependencies.

## Stage 2 - Command surface, validation modes, and deterministic index

### Tasks

- [x] t6: Implement `buildos entities validate --root <path> --mode compat|strict [--json]` with structured compatibility warnings and strict graph enforcement.
- [x] t7: Implement `buildos entities resolve --root <path> --mode compat|strict --id <entity-id> [--json]` with requested ID, canonical ID, chain, and resolution state.
- [x] t8: Implement `buildos entities rebuild-index --root <path> --mode compat|strict [--check|--apply] [--json]` to emit stable lexical ordering from canonical JSONL only.
- [x] t9: Implement the shared human-readable result and stable JSON envelope plus common exit-code behavior across help, version, and entity commands.
- [x] t10: Add CLI, reproducibility, stale-index, and no-`buildos-entities` tests that compare repeated byte output and report exact remediation commands.

### Acceptance criteria

- Compatibility mode excludes unresolved legacy superseded rows from automatic resolution while continuing the assessment.
- Strict validation rejects every release-blocking condition and passes only a fully valid graph and current index.
- Repeated index builds from identical canonical inputs are byte-identical.
- `--check` detects drift without mutating the index or canonical data.
- The build emits only the `buildos` executable and the canonical domain spelling is `entities`.

### Dependencies

- Stage 1 CLI root, graph loader, resolver, and temporary exported package are stable.
- Index format and compatibility-to-strict rules from Phase 01 are final.

## Stage 3 - Safe consolidation and recovery

### Tasks

- [x] t11: Implement `buildos entities consolidate --root <path> --mode compat|strict --manifest <path> [--apply] [--json]` as a dry-run operation that displays exact planned row and index changes.
- [x] t12: Add explicit `--apply` handling that validates the entire graph before mutation, writes through a same-filesystem temporary file, atomically replaces only the affected canonical JSONL file, and preserves permissions.
- [x] t13: Rebuild the derived index after a successful canonical write and report an exact recovery command if index generation then fails.
- [x] t14: Add tests for identical-manifest idempotence, conflicting-target non-writes, ambiguous or missing roots, unwritable roots, interrupted writes, invalid JSONL, and post-write index failure.
- [x] t15: Add only thin `system/.os/scripts/` routing if required after the CLI stabilizes; do not add durable Python logic or migrate the legacy domains into `toolkits/buildos/` during W1 R4.

### Acceptance criteria

- No mutation occurs without both an explicit root and `--apply`.
- Preflight graph failures prevent canonical writes.
- Affected JSONL replacement is atomic and preserves permissions; unrelated files remain unchanged.
- Post-write index failure leaves canonical data authoritative and provides a tested recovery path.
- Building and invoking the binary by explicit source path does not alter installed binaries, wrappers, or adopter-owned data.

### Dependencies

- Stages 1 and 2 pass their tests.
- Source checkout, installed program files, and adopter data remain separate roots throughout all tests.
