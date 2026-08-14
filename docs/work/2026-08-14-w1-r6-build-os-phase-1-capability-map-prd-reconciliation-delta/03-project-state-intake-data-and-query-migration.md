# Phase 03: Project State, Intake, Data, and Query Migration

## Purpose

Migrate approved local-state and read-first evidence operations behind the core while preserving established toolkit behavior and filesystem authority.

## Overview

This phase covers approved global and project identity, configuration and registry inspection, evidence intake and conversion, extraction candidates, data/index/query, and validation capabilities. Mutating behavior enters only after its read, plan, dry-run, and recovery contracts are accepted.

## Source PRD Docs

- [PRD 19: Build OS Headless Core, CLI, and MCP Program](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md)
- [PRD 07: Intake and Conversion](../../prd/07-intake-and-conversion.md)
- [PRD 08: Data and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 13: Adopter-Owned Config Surface](../../prd/13-adopter-owned-config-surface.md)
- [PRD 16: Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)

## Candidate Capability Trace

- Domain migration: `PRJ-001`, `PRJ-002`, `CFG-001`, `EVD-001`, `EVD-002`, `EXT-001`, `EXT-002`, `DAT-001`, `DAT-002`, `REL-001`, the full-project portion of `LFC-001`, `SAF-001`, `SAF-002`, and the parity obligation in `MCP-001`.
- `PRJ-003` lifecycle mutations remain assigned to the later lifecycle and companion split rather than being inferred from project recognition.

## Stage 1 - Authority, Identity, and Read Operations

### Tasks

- [ ] t1: Implement approved workspace resolution, project identity, relocation detection, global settings, project registration, configuration inspection, and capability discovery use cases without making a server authoritative.
- [ ] t2: Implement approved read-only data, index, query, relationship, provenance, and validation operations through the shared core, CLI, and MCP mappings.
- [ ] t3: Prove canonical-versus-derived classification, deterministic query results, derived-state rebuildability, privacy filters, and no-write behavior.

### Acceptance criteria

- Local project files remain sufficient authority when no server exists.
- Project relocation and identity ambiguity fail according to approved register dispositions.
- CLI and MCP return equivalent read outcomes and diagnostics.

### Dependencies

- Phase 02 seam and parity contracts.

## Stage 2 - Intake, Convert, Extract, and Index Operations

### Tasks

- [ ] t4: Capture current `buildos-intake` conversion and index behavior in parity fixtures before moving logic behind approved core use cases.
- [ ] t5: Migrate approved intake, faithful conversion, extraction-candidate, and derived-index operations with explicit plans, dry-run semantics, source provenance, idempotency, and recovery.
- [ ] t6: Keep the legacy intake implementation or adapter available until CLI parity, CLI-to-MCP parity, copied-root compatibility, rollback, and owner acceptance are complete.

### Acceptance criteria

- Converted twins and source provenance preserve the accepted current contract.
- Repeated approved operations are idempotent or return the documented conflict behavior.
- No legacy source or compatibility path is removed before the accepted deletion gate.

### Dependencies

- Stage 1 authority and read operations.
