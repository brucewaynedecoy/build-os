---
title: "PRD Set Authority Cleanup Work Backlog"
kind: "work"
status: "active"
coordinate: "W1 R8"
follow_on:
  route: "implementation-loop"
  next_prompt: ".make-docs/system/references/execution-workflow.md"
  why: "The backlog is the task list that executes the PRD maintenance planned for W1 R8."
  coordinate_handoff: "Carry this backlog's W/R coordinate into phase commits, adding the active P coordinate for each phase."
source:
  type: "plan"
  path: "docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md"
---

# PRD Set Authority Cleanup Work Backlog

## Purpose

This backlog makes the BuildOS PRD set fully valid product authority. It moves every current requirement out of the legacy editorial PRDs 13–19 into product owners, restructures PRD 13, renames PRD 17 in place, archives PRDs 14, 15, 16, 18, and 19 and five finished or superseded backlogs, folds stale pointers out of PRDs 01–12, and updates every link. It ends with `make-docs run prd authority validate` passing with zero findings and register item `D-005` closed.

Sequencing and decisions come from the [W1 R8 plan](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md). The source design is [PRD Set Authority Cleanup](../../designs/2026-11-23-prd-set-authority-cleanup.md). The requirement baseline is the plan's [requirement inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md). Open items live in the [open questions and risk register](../../prd/03-open-questions-and-risk-register.md).

This backlog departs from the default lifecycle arc. It is written from the plan before any PRD changes, because the PRD maintenance is itself the deliverable. Each phase changes PRDs as its tasks, and each phase is reviewed and committed on its own. The departure is recorded in the design frontmatter and the [plan overview](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md#lifecycle-departure).

W1 R8 is a revision Wave of W1. [W1 R7](../2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md) P1 waits until this backlog closes `D-005`.

## Human Experience Trace

Authority: `make-docs://system/contract/human-experience-contract.md`. Impact is `indirect`. Each promise comes from the `## Human Experience Intent` section of the [source design](../../designs/2026-11-23-prd-set-authority-cleanup.md#human-experience-intent) and the [plan promise table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md#human-experience-propagation).

| Impact or promise | Source design and plan | Owning PRD or preserved boundary | Work phase | Evidence source or selected testing type | Implementation gate | Accepted obligation, if any |
| --- | --- | --- | --- | --- | --- | --- |
| Every topic in the `## Current Authority Map` points to exactly one active PRD with a product name | Design Human Experience Intent; plan promise table | [PRD index Current Authority Map](../../prd/00-index.md#current-authority-map) | [P4](./04-rename-archive-links-and-index.md); confirmed in [P5](./05-final-validation-and-closure.md) | Validator zero for `PRD-AUTH-001` to `PRD-AUTH-004`; reviewer opens every map target | P4 and P5 exit gates | None |
| No active PRD body relies on a change note, banner, or another document to override what it says | Design decision 4; plan promise table | PRDs 01–13, 17, and 20 | [P1](./01-owner-text.md) and [P2](./02-baseline-change-note-folding.md) | Search finds no pointer note to PRDs 13–19 in 01–12 and no superseded banner; reviewer reads the corrected bodies | P2 exit gate; rechecked in P5 | None |
| Every link to a moved or retired PRD resolves, to the new owner or the archived copy | Design decision 5; plan promise table | Receiving owners and archived copies | [P4](./04-rename-archive-links-and-index.md); confirmed in [P5](./05-final-validation-and-closure.md) | Full-repository relative-link and anchor check, including `.make-docs/archive/` | P4 and P5 exit gates | None |
| No current requirement from PRDs 13–19 is lost; each one is traceable to its new owner section | Design `D-005` safety rules 1 and 2; plan promise table | Receiving owners in the [plan decision matrix](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#candidate-decision-matrix) | [P3](./03-register-and-requirement-trace.md); rechecked in [P5](./05-final-validation-and-closure.md) | Requirement trace check with a filled `Final owner` column; reviewer row sample | P3 stop rule; P5 exit gate | None |

## Performance Evidence

No performance candidate. The cleanup is documentation only.

## Phase Map

| Phase | Work file | Outcome | Entry dependency |
| --- | --- | --- | --- |
| P1 | [Owner Text](./01-owner-text.md) | PRD 17 and PRD 13 follow the subsystem template under their current filenames. PRDs 08, 07, 02, 20, 09, 10, 11, and 04 state the requirements they receive. The three gaps (entity flags, local-only rule, `buildos validate` checks) have owners. | Owner approves the plan and this backlog |
| P2 | [Baseline Change-Note Folding](./02-baseline-change-note-folding.md) | No `### Change Notes` bullet in PRDs 01–12 points at PRDs 13–19. Bodies state the current rule. | P1 committed |
| P3 | [Register and Requirement Trace](./03-register-and-requirement-trace.md) | The register has the domain-ownership question and updated `Q-001`, `Q-011`, `Q-012`, `R-003`, and `R-004`. Every inventory row has a final owner. | P2 committed |
| P4 | [Rename, Archive, Links, and Index](./04-rename-archive-links-and-index.md) | PRD 17 is renamed. PRDs 14, 15, 16, 18, 19 and five backlogs are archived. Every link resolves. The index is current. The validator reports zero findings. | P3 committed with a passed trace check, and the owner decision on links inside archived copies |
| P5 | [Final Validation and Closure](./05-final-validation-and-closure.md) | All checks pass. `D-005` is closed. The W1 R7 backlog records that W1 R8 satisfies the `D-005` prerequisite for W1 R7 P1. | P4 committed |

## Usage Notes

- Phases run in order. No two phases run at once, because they touch the same PRDs.
- Task IDs are phase-local. Reference a task as `w1 r8 pN tN`. Acceptance case IDs (`B1`, `B2`, and so on) are unique across this backlog.
- Mark a task done only when its stage acceptance criteria pass.
- Each phase ends with an independent review: a reviewer agent reviews the phase diff against the plan, the design, and the inventory before the commit. The implementer fixes each finding. The phase is committed only after the reviewer passes it.
- Commit subjects use `docs: [W1 R8 Pn] PRD Set Authority Cleanup - <phase name>` with a one-paragraph body, under `make-docs://system/contract/commit-message-convention.md`.
- Each phase writes the `## Requirement History` entries for the changes it makes, so no prior contract is dropped between phases. All entries exist before the P3 trace check.
- P1 creates [`evidence.md`](./evidence.md) in this folder and links it here. It holds validator counts, the trace record, owner decisions, recorded reviewed moves, link-check results, and phase reviews.
- Expected validator totals: 93 at the start, 85 after P1 through P3, and 0 after P4. See the plan's [validator counts by phase](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/03-validation-and-review.md#validator-counts-by-phase).
- PRD text never names the cleanup, a validator code, or an inventory row ID. That language stays here, in the plan, and in `evidence.md`.
- Two points need a person. P4 needs the owner's choice on links inside archived copies. P3 needs an owner decision only if a requirement has no clear owner.
- Archive moves were requested by the owner on 2026-11-23 through the design. No other file is archived.
- No `O-###` obligation and no `NUAT-###` scenario applies.

## Intended Follow-On

This handoff is advisory-default-but-overridable: it is authoritative unless the user explicitly overrides it, and it is not a gate or precondition.

- Route: `implementation-loop`
- Next step: Start with [P1](./01-owner-text.md) after the owner approves the plan and this backlog, and continue phase by phase. After P5, W1 R8 has satisfied the `D-005` prerequisite for W1 R7 P1.
- Why: The backlog is the task list that executes the PRD maintenance planned for W1 R8.
- Coordinate Handoff: Carry `W1 R8` into each phase commit, adding the active P coordinate.

## Change History

### 2026-11-23 — W1 R8 P4

- Kind: `edit`
- Affected scope: P4 entry gate
- Previous scope: P4 waited at its entry gate for the owner's choice on links inside the archived copies.
- Replacement scope: Option A is recorded. Inside the archived copies, P4 repairs only the path part of each broken relative link, as a recorded reviewed move. No other text changes.
- Rationale: The archived PRDs and backlogs move to new directories, so their own relative links break. Option A keeps the full link check meaningful with no exclusion.
- PRD decision: `none` — the change is navigation and archive maintenance only and changes no product requirement.
- Owner approval: Owner decision of 2026-11-23, before any P4 file move.
- Source: [W1 R8 evidence: Owner Decisions](./evidence.md#owner-decisions)

### 2026-11-23 — W1 R8

- Kind: `edit`
- Affected scope: Phase Map P5 row, `## Intended Follow-On` next step, and P5 purpose, overview, Stage 3 heading, and task t9
- Previous scope: The text said that after P5, or once `D-005` closes, W1 R7 P1 may start.
- Replacement scope: The text says W1 R8 satisfies the `D-005` prerequisite for W1 R7 P1. It no longer says P1 may start.
- Rationale: Closing `D-005` meets only one W1 R7 P1 entry-gate condition. P1 also needs the owner's approval of the W1 R7 PRD maintenance and backlog, so the old text overstated the hand-off.
- PRD decision: `none` — wording of the handoff claim only.
- Owner approval: not required (wording correction).
- Source: [W1 R8 work index](./00-index.md)
