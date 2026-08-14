# Phase 04: Discovery, Qualification, and Provenance Migration

## Purpose

Migrate discovery, qualification, handoff, relationship, and operation-provenance mutations through the shared safe lifecycle.

## Overview

This phase preserves immutable run evidence, raw findings, qualification evidence, canonical relationships, user-gated promotion, and external-handoff boundaries while moving approved operations behind the core and exposing them through CLI and MCP together.

## Source PRD Docs

- [PRD 19: Build OS Headless Core, CLI, and MCP Program](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md)
- [PRD 09: Playbooks](../../prd/09-playbooks.md)
- [PRD 10: Discovery Runs and Qualification](../../prd/10-discovery-runs-and-qualification.md)
- [PRD 11: Flow C Integration](../../prd/11-flow-c-integration.md)
- [PRD 17: Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)

## Candidate Capability Trace

- Domain migration: `PBK-001`, `RUN-001`, `FND-001`, `QLF-001`, `QLF-002`, `HOF-001`, `REL-001`, `REL-002`, `OPR-001`, `OPR-002`, `SAF-001`, `SAF-002`, and the parity obligation in `MCP-001`.
- `QLF-002` and `REL-002` produce no public operation until their authority and follow-on design gates are approved; `HOF-001` stops at the Build OS-owned export and receipt boundary.

## Stage 1 - Playbooks, Runs, Evidence, and Findings

### Tasks

- [ ] t1: Freeze current playbook resolution, discovery-run creation, evidence capture, raw-finding, closure, abort, dry-run, and immutable-run failure behavior in parity fixtures.
- [ ] t2: Migrate approved playbook, run, evidence, raw-finding, relationship, and provenance operations behind shared core use cases with explicit authorization and recovery semantics.
- [ ] t3: Prove that CLI and MCP preserve immutable run evidence, canonical entity references, source anchors, diagnostics, and operation receipts.

### Acceptance criteria

- Closed or aborted run evidence remains immutable and inspectable.
- Raw findings are not silently promoted or rewritten.
- CLI and MCP produce equivalent durable effects and receipt links.

### Dependencies

- Phase 03 local-state and data operations.

## Stage 2 - Qualification and External Handoff

### Tasks

- [ ] t4: Migrate approved qualification operations while preserving deterministic evidence thresholds, positive and negative outcomes, canonical run resolution, and qualification evidence.
- [ ] t5: Implement only the approved Build OS-owned export or handoff operation while keeping user authorization explicit; do not migrate the current direct design-write behavior, and keep Make Docs an external, separately owned dependency.
- [ ] t6: Retain legacy discovery and design adapters until behavior parity, migration, rollback, and owner-accepted evidence pass.

### Acceptance criteria

- Qualification authority and promotion workflow match the approved capability and register dispositions.
- Build OS records its handoff without directly writing Make Docs global state or project internals.
- Export-only handoff remains available without Make Docs; only a requested Make Docs invocation returns the approved capability-unavailable diagnostic when the companion is absent, without reducing core Build OS usefulness.

### Dependencies

- Stage 1 discovery and evidence operations.
