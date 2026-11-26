---
title: "Phase 2: Baseline Change-Note Folding"
kind: "work"
status: "active"
coordinate: "W1 R8 P2"
source:
  type: "plan"
  path: "docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md"
---

# Phase 2: Baseline Change-Note Folding

## Purpose

Remove every `### Change Notes` bullet in PRDs 01–12 that points at PRDs 13–19, so no PRD body relies on a note to override it. P1 already wrote the receiving rules into the owners, so each note can now be folded or deleted safely.

## Overview

A read-only count on 2026-11-23 found 65 such bullets: 01 ×6, 02 ×11, 04 ×2, 05 ×4, 06 ×4, 07 ×3, 08 ×10, 09 ×7, 10 ×6, 11 ×6, 12 ×6. Of these, 32 say "Superseded by" PRD 19, which was never approved. Each bullet gets one disposition from [design decision 4](../../designs/2026-11-23-prd-set-authority-cleanup.md#4-baseline-change-notes-folded): a current requirement moves into the section body; a material prior contract becomes a `## Requirement History` entry; anything else is deleted. Where a body still states something a note overrides, the body is corrected. Notes that do not point at PRDs 13–19 stay. The validator does not flag change notes, so its counts do not move in this phase.

## Entry Gate

- P1 committed after a reviewer pass.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `indirect`. Promise: no active PRD body relies on a change note, banner, or another document to override what it says ([plan promise table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md#human-experience-propagation)).
- Intended human outcome: A reader of any of PRDs 01–12 reads the body and learns the current rule, with no pointer to a legacy PRD.
- Human-facing surface or indirect effect: The bodies and `### Change Notes` sections of PRDs 01–12.
- Implementation work: Stages 1 to 4.
- Evidence source or testing type selected under current authority: A per-bullet disposition list in `evidence.md`; a search for pointer notes; reviewer reading of each corrected body.
- Executor: Implementer agent, then an independent reviewer agent.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Pointer search, validator, path hygiene, and link check on the phase diff. |
| Performance Testing | `not-needed-now` | Documentation only. |
| Guided Progress Review | `not-needed-now` | The independent phase review covers the reading check. |
| Unassisted Goal Testing | `not-needed-now` | No new human-facing product surface. |

Human Experience Review is separate. The reviewer reads every section that lost a note and confirms its body states the current rule without help.

## Source PRD Docs

- [01 Product Overview](../../prd/01-product-overview.md), [02 Architecture Overview](../../prd/02-architecture-overview.md), and [04 Glossary](../../prd/04-glossary.md)
- [05 Spaces, Boundary and Shipping](../../prd/05-spaces-boundary-and-shipping.md) and [06 Operating Layer and Routing](../../prd/06-operating-layer-and-routing.md)
- [07 Intake and Conversion](../../prd/07-intake-and-conversion.md), [08 Data Layer and Extraction](../../prd/08-data-and-extraction.md), and [09 Playbooks](../../prd/09-playbooks.md)
- [10 Discovery, Runs and Qualification](../../prd/10-discovery-runs-and-qualification.md), [11 Flow C Integration](../../prd/11-flow-c-integration.md), and [12 Stage Automation](../../prd/12-stage-automation.md)
- [20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md), for notes whose current content now lives there
- PRD 13 at `docs/prd/13-adopter-owned-config-surface.md` and PRD 17 at `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`, as restructured in P1

## Plan And Design Lineage

- Plan: [01 PRD Authority Maintenance](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md), row C-41 and the folding rule under `## Existing PRDs To Update`
- Design: [4. Baseline change notes folded](../../designs/2026-11-23-prd-set-authority-cleanup.md#4-baseline-change-notes-folded)
- Inventory: [04 Requirement Inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md), section 3 counts inside `docs/prd/`, and rows 13-08, 14-15, 15-10, 16-12, 17-48, and 19-28

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Note inventory

### Tasks

- [x] t1: List every `### Change Notes` bullet in `docs/prd/01-*.md` through `docs/prd/12-*.md` that links or names a file `13-*` to `19-*`, under `## Change-Note Dispositions` in `evidence.md`. For each bullet, record the PRD, section, the bullet text in short, and one disposition: `body` (with the target sentence), `history` (with the entry it becomes), or `delete` (with the reason). A bullet whose current content already lives in a body or in PRD 20 is `delete` with that owner named.

### Acceptance criteria

- B19: `evidence.md` lists 65 bullets with the per-file counts in the overview, or records and explains any difference, and every bullet has one disposition.

### Dependencies

- Entry gate met.

## Stage 2 - Core and boundary PRDs

### Tasks

- [x] t2: Fold the notes in `docs/prd/01-product-overview.md` (`## Key Capabilities`, `## System Boundaries`, `## Current Limitations`).
- [x] t3: Fold the notes in `docs/prd/02-architecture-overview.md` (`## Topology`, `## Module Map`, `## Runtime Boundaries`, `## Data Flow`, `## Configuration Surfaces`). Confirm the P1 body fix in `## Configuration Surfaces` now stands alone.
- [x] t4: Fold the notes in `docs/prd/04-glossary.md` (`## Terms`).
- [x] t5: Fold the notes in `docs/prd/05-spaces-boundary-and-shipping.md` (`## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`).
- [x] t6: Fold the notes in `docs/prd/06-operating-layer-and-routing.md` (`## Component and Capability Map`, `## Contracts and Data`).

### Acceptance criteria

- B20: PRDs 01, 02, 04, 05, and 06 have no `### Change Notes` bullet that links or names a file `13-*` to `19-*`.

### Dependencies

- Stage 1 complete.

## Stage 3 - Domain PRDs

### Tasks

- [x] t7: Fold the notes in `docs/prd/07-intake-and-conversion.md` (`## Component and Capability Map`, `## Contracts and Data`).
- [x] t8: Fold the notes in `docs/prd/08-data-and-extraction.md` (`## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`).
- [x] t9: Fold the notes in `docs/prd/09-playbooks.md` (`## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`). Confirm that canonical resolution of playbook targets now lives only in the body written in P1.
- [x] t10: Fold the notes in `docs/prd/10-discovery-runs-and-qualification.md` (`## Component and Capability Map`, `## Contracts and Data`, `## Integrations`).
- [x] t11: Fold the notes in `docs/prd/11-flow-c-integration.md` (`## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`).
- [x] t12: Fold the notes in `docs/prd/12-stage-automation.md` (`## Component and Capability Map`, `## Contracts and Data`). The open stage-ownership decision is not written into 12; it goes to the new register question in P3.

### Acceptance criteria

- B21: PRDs 07 to 12 have no `### Change Notes` bullet that links or names a file `13-*` to `19-*`.

### Dependencies

- Stage 1 complete.

## Stage 4 - History entries and empty sections

### Tasks

- [x] t13: For each `history` disposition, add a `## Requirement History` entry in that PRD with date `2026-11-23`, coordinate `W1 R8`, affected section, previous contract, replacement contract, rationale, and a source link to [the design](../../designs/2026-11-23-prd-set-authority-cleanup.md). Create the section before `## Source Anchors` only in a PRD that needs one.
- [x] t14: Remove every `### Change Notes` section that has no bullet left.
- [x] t15: Run `grep -nE '1[3-9]-(adopter|revise|enhance)' docs/prd/0[1-9]-*.md docs/prd/1[0-2]-*.md` and confirm each hit is a body link to PRD 13, a link to PRD 17 that P4 will rename, or a `## Requirement History` or `## Source Anchors` line. Record the hits in `evidence.md`.

### Acceptance criteria

- B22: No `### Change Notes` section in PRDs 01–12 is empty.
- B23: Every `history` disposition in `evidence.md` has its entry in the named PRD, with all required fields.
- B24: The grep in t15 finds no hit inside a `### Change Notes` section.

### Dependencies

- Stages 2 and 3 complete.

## Stage 5 - Review and commit

### Tasks

- [x] t16: Run the validator and record the counts. Run path hygiene and a relative-link and anchor check over every changed file.
- [x] t17: An independent reviewer reviews the phase diff against the plan, design, and inventory before commit. The reviewer checks every `delete` disposition against the inventory to confirm no current requirement was dropped, reads every changed section in full, and records a pass or findings under `## Phase Reviews`. The implementer fixes each finding and the reviewer rechecks it.
- [x] t18: Commit the phase with the subject `docs: [W1 R8 P2] PRD Set Authority Cleanup - Baseline Change-Note Folding` and a one-paragraph body under `make-docs://system/contract/commit-message-convention.md`.

### Acceptance criteria

- B25: The validator total stays at 85 with the P1 counts per code.
- B26: Path hygiene reports zero failing findings, and the link check finds no broken link in a changed file.
- B27: `evidence.md` records a reviewer pass for P2 before the commit.

### Dependencies

- Stage 4 complete.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran: validator 85 findings (6, 6, 7, 15, 51), path hygiene 0 failing findings, link check 0 broken links in the 14 changed files (122 relative links) and in the 331 inbound links into PRDs 01–13. Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`.
- Performance evidence: None; not needed.
- Human Experience Review: The independent reviewer checked every `delete` disposition against the inventory, read every changed PRD section in full, and passed P2 in round 2. See [Phase Reviews](./evidence.md#phase-reviews).
- Optional experience handoff: Not applicable; indirect impact.
- Explicit human acceptance gate: None.
- Evidence report: [evidence.md](./evidence.md) holds the P2 dispositions, history entries, link check, and new P3 register items. `## Phase Reviews` records the P2 reviewer pass (round 2), which satisfies B27.
- Phase / capability status: Done. Implementation (t1–t16), independent review (t17, PASS in round 2), and commit (t18) are complete. Dispositions, checks, and P3 items are in [`evidence.md`](./evidence.md#change-note-dispositions).
- Scope addition: the review fix for disposition 33 also changes [13 Adopter-Owned Config Surface](../../prd/13-adopter-owned-config-surface.md#buildos-validate-checks). Its Scoped data references check now rejects legacy scoped fields and sentinel values in entity rows, and its W1 R8 check-list history entry names that check. PRD 13 is a changed file of this phase.
