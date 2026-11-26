---
title: "Phase 3: Register and Requirement Trace"
kind: "work"
status: "active"
coordinate: "W1 R8 P3"
source:
  type: "plan"
  path: "docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md"
---

# Phase 3: Register and Requirement Trace

## Purpose

Bring the register in line with the new owners, then prove that no current requirement from PRDs 13–19 is lost before anything is renamed or archived. This phase is the gate for P4.

## Overview

The register gets a new question for the open domain-ownership decisions that `D-002` used to carry, and `Q-001`, `Q-011`, `Q-012`, `R-003`, and `R-004` stop pointing at legacy PRDs as current authority. `D-005` stays `Open` until P5. Then the implementer fills the `Final owner` column of the [requirement inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md) for all 155 rows, and the reviewer samples rows against the owner text.

Stop rule: if any row has no owner, or its named owner section does not state the requirement with the same meaning, P4 does not start. The implementer fixes the owner text in this phase, or the orchestrator asks the owner when no owner is clear.

## Entry Gate

- P2 committed after a reviewer pass.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `indirect`. Promise: no current requirement from PRDs 13–19 is lost, and each one is traceable from the inventory to its new owner section ([plan promise table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md#human-experience-propagation)).
- Intended human outcome: Maintainers and agents can trust that the cleanup changed no current requirement, and can find where each one went.
- Human-facing surface or indirect effect: The `Final owner` column of the inventory, and the register items that readers use for open decisions.
- Implementation work: Stages 1 and 2.
- Evidence source or testing type selected under current authority: The filled trace and the reviewer's row sample in `evidence.md`.
- Executor: Implementer agent, then an independent reviewer agent.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Row-count and empty-cell check of the trace column; validator; path hygiene; link check. |
| Performance Testing | `not-needed-now` | Documentation only. |
| Guided Progress Review | `not-needed-now` | The reviewer's row sample is the reading check. |
| Unassisted Goal Testing | `not-needed-now` | No new human-facing product surface. |

Human Experience Review is separate. The reviewer records, per sampled row, whether a reader of the owner section alone would learn the requirement.

## Source PRD Docs

- [03 Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md), items `D-005`, `Q-001`, `Q-011`, `Q-012`, `R-003`, `R-004`, and the next unused `Q` number
- [02 Architecture Overview](../../prd/02-architecture-overview.md#module-map), section `## Module Map`, for the new question
- Every receiving owner named in the plan [decision matrix](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#candidate-decision-matrix): [02](../../prd/02-architecture-overview.md), [04](../../prd/04-glossary.md), [07](../../prd/07-intake-and-conversion.md), [08](../../prd/08-data-and-extraction.md), [09](../../prd/09-playbooks.md), [10](../../prd/10-discovery-runs-and-qualification.md), [11](../../prd/11-flow-c-integration.md), [20](../../prd/20-buildos-cli-and-distribution.md), PRD 13 at `docs/prd/13-adopter-owned-config-surface.md`, and PRD 17 at `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`

## Plan And Design Lineage

- Plan: [02 Register Changes](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#register-changes) and [03 Checks](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/03-validation-and-review.md#checks), check 2
- Design: [6. Other items](../../designs/2026-11-23-prd-set-authority-cleanup.md#6-other-items) and [7. Order of work and safety](../../designs/2026-11-23-prd-set-authority-cleanup.md#7-order-of-work-and-safety), steps 4 and 5
- Inventory: all of section 2 of the [requirement inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Register updates

### Tasks

- [x] t1: Read the register and find the highest `Q` number at execution time (`Q-013` when the plan was written). Add the next `Q` item, "Domain ownership for playbooks, data and extraction, and stage automation", with `Status` `Open`, `Decision`, `Follow-Up`, `Question`, `Why it matters`, `Recommendation`, `To close`, `Owner`, and `Phase/gate`. Cite [02 Module Map](../../prd/02-architecture-overview.md#module-map) and note that `buildos extract bulk` in PRD 20 already settles one helper (16-05, 16-08).
- [x] t2: In `Q-001`, replace the sentence that says PRD 19 and the Phase 2 capability-map delta carry the approved result with the current owners. Name the PRD 19 archive path `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` as provenance in a code span; P4 checks the path exists.
- [x] t3: In `Q-011` and `Q-012`, state that the PRD 19 capability map and decision inventory are kept at that archive path as input to the future MCP revision.
- [x] t4: In `R-003`, confirm the item names the W2 lifecycle commands (`setup`, `update`, `uninstall`) and the upgrade, rollback, and uninstall smoke tests (18-19, 18-21). Add one sentence if it does not.
- [x] t5: In `R-004`, state that the live-root migration gate is in PRD 17 `### Adoption and live-root migration safety`, and replace "binary cutover" with "package version pin" (17-26, 17-47).
- [x] t6: In `D-005`, keep `Status` `Open`. Update its `Follow-Up` to name the [W1 R8 work backlog](./00-index.md) as the cleanup in progress.

### Acceptance criteria

- B28: The register has the new `Q` item with every required field, at the next unused number, and no existing item was renumbered.
- B29: `Q-001`, `Q-011`, `Q-012`, and `R-004` no longer present PRD 19 or a legacy PRD as current authority, and `R-003` names the W2 lifecycle commands and smoke tests.
- B30: The register keeps `## Confirmed Drift`, `## Open Questions`, `## Rebuild Risks`, and `## Source Anchors`.

### Dependencies

- Entry gate met.

## Stage 2 - Requirement trace check

### Tasks

- [x] t7: Fill the `Final owner` cell of every row in section 2 of `docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md`. Use the form `PRD NN ## Section` or `PRD NN ### Subsection`, or `none: <reason>`, or `register Q-NNN`. Write PRD 17 sections by their names after P1; P4 does not change section names. Do not edit any other cell.
- [x] t8: Check the trace mechanically: count 155 rows and zero empty `Final owner` cells, and confirm each named section heading exists in the named file. Record the counts under `## Requirement Trace` in `evidence.md`.
- [x] t9: For every gap row (13-20, 14-06, 16-05, 18-12), every row of medium or low confidence, and every row where the `Final owner` differs from the `Proposed product owner`, quote the owner sentence under `## Requirement Trace`.
- [x] t10: Apply the stop rule. If a row fails t8 or t9, fix the owner text in this phase and add its `## Requirement History` entry if a prior contract changes. If no owner is clear, the orchestrator asks the owner, names the row, the choices, and the effect, and records the answer under `## Owner Decisions`.

### Acceptance criteria

- B31: All 155 rows have a non-empty `Final owner`, and every named section exists.
- B32: Each gap row's owner section states the requirement: entity flags in PRD 17 `### Entity commands`, the local-only rule in PRD 20 `## Runtime and Package`, the entity hygiene checks in PRD 13 `### buildos validate checks`, and the domain-ownership question in the register.
- B33: No row is left untraced. If the stop rule fired, `evidence.md` records the fix or the owner decision.

### Dependencies

- Stage 1 complete, so register rows can name the new `Q` item.

## Stage 3 - Review and commit

### Tasks

- [x] t11: Run the validator and record the counts. Run path hygiene and a relative-link and anchor check over every changed file.
- [x] t12: An independent reviewer reviews the phase diff against the plan, design, and inventory before commit. The reviewer opens the owner section for every row in t9 and for at least 20 other rows spread across all seven tables, records each sampled row ID and the result under `## Phase Reviews`, and checks the register items against the register rules. The implementer fixes each finding and the reviewer rechecks it.
- [x] t13: Commit the phase with the subject `docs: [W1 R8 P3] PRD Set Authority Cleanup - Register and Requirement Trace` and a one-paragraph body under `make-docs://system/contract/commit-message-convention.md`.

### Acceptance criteria

- B34: The validator total stays at 85 with the P1 counts per code.
- B35: Path hygiene reports zero failing findings, and the link check finds no broken link in a changed file.
- B36: `evidence.md` records a reviewer pass for P3 with the sampled row IDs before the commit.

### Dependencies

- Stage 2 complete with no untraced row.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran: the trace check (155 rows, 0 empty, 220 references resolved after the review round 1 fixes; 212 before them), the validator (85, P1 counts), path hygiene (0 failing), and the link check (0 broken). The reviewer reran the validator (85), path hygiene (0 failing across 169 files), the link check (138 relative links in changed files plus inbound links to PRD 02, PRD 20, and the register, 0 broken), and the trace (155 rows, 119 owners, 36 justified `none`, 172 heading and 48 register references resolved). The other three stay `not-needed-now`.
- Performance evidence: None; not needed.
- Human Experience Review: The independent reviewer checked the trace, the register items, and the changed PRD sections, and passed P3 in round 3. See [Phase Reviews](./evidence.md#phase-reviews).
- Optional experience handoff: Not applicable; indirect impact.
- Explicit human acceptance gate: None needed. The stop rule fired in review round 1. The implementer fixed the owner text in this phase, in PRD 02 `### Domain ownership`, PRD 20 `## Compatibility` and `## Release`, and register items `Q-014` and `R-003`. No owner decision was needed. Review round 2 tightened `D-004`, `D-006`, and `D-007` so that only a parity exception that keeps the governing contracts, or one approved change to every affected owner, can close them. It also added row 19-20 to the quoted owner sentences.
- Evidence report: Implementation evidence is in [`evidence.md`](./evidence.md) under `## Requirement Trace`, `## Validator Counts`, and `## Link Check`. `## Phase Reviews` records the P3 reviewer pass (round 3), which satisfies B36.
- Phase / capability status: Done. Implementation (t1 to t11), independent review (t12, PASS in round 3), and commit (t13) are complete.
