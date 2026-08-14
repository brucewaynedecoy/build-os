# Phase 05: Recovery, Removal, and Compatibility Migration

## Purpose

Qualify Build OS recovery, repair, upgrade, rollback, removal, and legacy compatibility before any destructive migration or deprecation.

## Overview

This phase applies only to Build OS-owned state and distribution behavior. Make Docs reconfiguration or removal remains a later companion-integration program using Make Docs public operations.

## Source PRD Docs

- [PRD 19: Build OS Headless Core, CLI, and MCP Program](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md)
- [PRD 14: Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16: Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 18: Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Candidate Capability Trace

- Lifecycle and compatibility: `PRJ-003`, `OPR-001`, `OPR-002`, `LFC-001`, `SAF-001`, `SAF-002`, `PKG-001`, and the parity obligation in `MCP-001`.
- `CMP-001` and `CMP-002` remain outside this phase; Make Docs lifecycle behavior requires the separate companion-integration gate.

## Stage 1 - Recovery and Repair

### Tasks

- [ ] t1: Implement approved status, verification, recovery-plan, retry, repair, derived-index rebuild, stale-lock, interrupted-write, and receipt-reconciliation operations.
- [ ] t2: Exercise crash injection and concurrent-writer cases at every approved durable-write boundary without relying on a coordinating server.
- [ ] t3: Prove recovery is idempotent, does not repeat successful external effects, and records superseding or linked receipts where required.

### Acceptance criteria

- Every supported partial failure is diagnosable and has an approved recovery path.
- Retry and replay cannot duplicate an already completed operation.
- Recovery remains local-first and server-optional.

### Dependencies

- Phase 04 mutation and provenance contracts.

## Stage 2 - Migration, Upgrade, Rollback, and Removal

### Tasks

- [ ] t4: Prove copied-root compatibility and reversible migration for existing toolkit users, configs, data, aliases, and automation before changing any public routing.
- [ ] t5: Implement only the approved Build OS-owned portions of project initialization, reconfiguration, update, removal, package upgrade and rollback, and machine removal, with explicit preservation and deletion boundaries; keep the standard companion profile unavailable until its separate gate passes.
- [ ] t6: Remove or deprecate a legacy toolkit path only after its accepted parity window, rollback evidence, user guidance, and separate owner approval pass.

### Acceptance criteria

- Existing adopter data and automation have a tested rollback path.
- Build OS removal affects only approved Build OS-owned state and leaves Make Docs intact by default.
- No project lifecycle path invokes or mutates Make Docs before the separate companion-integration gate.
- No legacy implementation is deleted solely because the new operation exists.

### Dependencies

- Stage 1 recovery and repair evidence.
