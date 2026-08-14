# R6 P3 - Migration, Acceptance, and Backlog Handoff

## Purpose

Translate the reconciled contracts into a reversible dependency order and a clearly non-authoritative implementation candidate without authorizing product changes.

## Dependency Position

- Starts after the complete capability and operation maps exist.
- Depends on accepted compatibility obligations from PRDs 14, 16, 17, 18, and anticipated PRD 19.
- Blocks owner review of the candidate backlog.

## Scope

- Order work read-first and seam-first: authority and fixtures, shared core contracts and entity pilot, read-only state/intake/data operations, mutating discovery and qualification operations, lifecycle recovery and migration, then MCP protocol and distribution completion.
- Require CLI behavior parity and CLI-to-MCP operation parity before any legacy implementation is removed or alias is retired.
- Preserve legacy toolkits and deployed data until copied-root, rollback, upgrade, removal, and compatibility evidence is approved.
- Keep UI, browser capture, optional coordinating server, and Make Docs companion implementation out of the W1 R6 delta candidate and route them to separate later gates.
- Bind each backlog phase to PRD 19 capability identifiers and the constraining baseline PRDs.

## Deliverables

- [W1 R6 delta backlog candidate](../../work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md).
- Dependency and evidence map from every candidate phase to capability identifiers, register items, and PRD sources.
- Compatibility and rollback checkpoints that prevent premature toolkit deletion or adopter-state mutation.
- Explicit execution blocker covering PRD, register, plan, coordinate, backlog, and commit or merge approval.

## Validation

- Backlog phases are dependency ordered and each phase includes `Source PRD Docs`.
- Tasks use phase-local checkbox IDs and acceptance criteria use plain bullets.
- No task can be interpreted as permission to implement, commit, publish, deploy, or alter Make Docs.
- Later surfaces appear only as gated handoffs, not hidden scope inside core or MCP work.

## Exit Gate

The candidate is ready for owner review only when it traces completely to the reconciled contract package and remains explicitly blocked from execution.
