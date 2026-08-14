# Phase 01: Pre-Implementation Reconciliation Gate

## Purpose

Fail closed unless the complete initial capability map, register, plan, backlog, coordinate, and repository-authority gates are current and approved.

## Overview

This phase contains no product implementation. It revalidates the exact contracts and evidence immediately before any later phase could receive separate execution authority.

## Source PRD Docs

- [PRD 19: Build OS Headless Core, CLI, and MCP Program](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md)
- [Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)
- [PRD 18: Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Candidate Capability Trace

- Gate coverage: the entire ordered PRD 19 capability inventory beginning with `SYS-001` and ending with `UI-001`, plus every linked decision-inventory or register item.
- Implementation effect: none; this phase freezes the separately authorized phase subset and dispositions before product work can begin.

## Stage 1 - Authority and Active-Lineage Verification

### Tasks

- [ ] t1: Verify the approved PRD 19, capability map, register, W1 R6 plan, delta backlog, and design inputs are present in the authorized commit or merge state and record their exact revisions.
- [ ] t2: Verify W1 R5 remains unexecuted and record the owner's explicit supersession or coexistence decision without editing W1 R5.
- [ ] t3: Reindex documentation and code, confirm the dirty-state allowlist, and stop if current authority or unrelated user work differs from the approved implementation preflight.

### Acceptance criteria

- Every implementation input is approved repository authority at an identified revision.
- W1 R5 disposition is explicit and no W1 R5 artifact is silently rewritten.
- The worktree and write allowlist are safe for the separately authorized phase.

### Dependencies

- Owner approval of PRD 19, the register, W1 R6 coordinate, plan, and candidate backlog.
- Separately authorized commit or merge that makes the approved artifacts repository authority.
- Separate implementation authorization.

## Stage 2 - Capability and Risk Reconciliation

### Tasks

- [ ] t4: Compare every in-scope capability and operation against approved PRD 19 and record additions, removals, changes, and unchanged obligations by stable capability identifier.
- [ ] t5: Reconcile all in-scope register items, owners, evidence, deadlines, and blocking or deferred dispositions for this phase.
- [ ] t6: Freeze the phase acceptance-evidence matrix, non-goals, dependencies, compatibility obligations, and exact code/test write scope before implementation begins.

### Acceptance criteria

- No in-scope capability, question, or risk is undispositioned.
- Every phase task traces to approved capability identifiers and acceptance evidence.
- Directory convention or current command presence is never used as the sole contract source.

### Dependencies

- Stage 1 authority verification.
