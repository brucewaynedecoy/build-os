# R6 P1 - Authority and Capability-Map Gate

## Purpose

Establish the complete, reviewable Phase 1 contract inventory and its authority boundary before any implementation plan can become executable.

## Dependency Position

- Starts from the live active PRD namespace, current code, the unexecuted W1 R5 lineage, and the two approved-but-uncommitted design inputs.
- Blocks every product-code, toolkit, migration, packaging, publication, and deployment activity.
- Requires no archive and makes no change to W1 R5.

## Scope

- Verify the active PRD index, living register, current W1 R5 plan and work state, current Go module boundaries, and current command and lifecycle evidence.
- Draft anticipated [PRD 19](../../prd/19-revise-build-os-headless-core-cli-and-mcp-program.md) as the coherent revision that carries the complete initial capability map.
- Inventory all initial domains, operations, manual conventions, deferred surfaces, and non-goals without inferring support from directories or command names.
- Give every unresolved question and risk an owner, phase, evidence requirement, and blocking or deferred disposition in the living register.
- Record that the two design inputs, PRD package, plan, register, and W1 R6 coordinate require owner approval and commit or merge authority before implementation.

## Parallel Workstreams

| Lane | Deliverable | Integration dependency |
| --- | --- | --- |
| Repository authority | Active-lineage and code-evidence inventory | Current HEAD and worktree allowlist |
| Capability coverage | Complete capability catalog with stable identifiers | Repository authority inventory |
| Register reconciliation | Questions, risks, owners, evidence, phases, dispositions | Capability coverage |
| PRD assembly | PRD 19 plus required baseline lineage | Capability and register drafts |

## Deliverables

- Complete initial capability inventory in PRD 19.
- Reconciled `docs/prd/03-open-questions-and-risk-register.md` entries for every unresolved decision and risk.
- Updated PRD index and non-destructive baseline annotations owned by the PRD assembly lane.
- Explicit authority table distinguishing current evidence, approved design recommendations, and unverified assumptions.

## Validation

- Every initial capability is included or explicitly excluded.
- Every directory-driven or manual behavior has a supported, manual, deferred, or excluded disposition.
- Every unresolved item has owner, phase, evidence, and disposition.
- PRD 19 does not claim the designs are committed authority before their separately authorized commit or merge.
- W1 R5 remains untouched and unexecuted.

## Exit Gate

This documentation phase closes only when the owner can review one coherent PRD 19, capability map, register, index, and baseline-lineage package. No implementation phase may start until that package and its repository-authority state are separately approved.
