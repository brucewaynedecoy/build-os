---
title: "Phase 4: Rename, Archive, Links, and Index"
kind: "work"
status: "active"
coordinate: "W1 R8 P4"
source:
  type: "plan"
  path: "docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md"
---

# Phase 4: Rename, Archive, Links, and Index

## Purpose

Give PRD 17 its product name, take the legacy PRDs and the finished or superseded backlogs out of the active set, and make every link resolve. The owner requested these archive moves on 2026-11-23 through the [design](../../designs/2026-11-23-prd-set-authority-cleanup.md#5-archive-and-links). This phase brings the validator to zero.

## Overview

PRD 17 is renamed in place. PRDs 14, 15, 16, 18, and 19 move to `.make-docs/archive/prds/2026-11-23/`. The W1 R0, R2, R4, R5, and R6 backlogs move to `.make-docs/archive/work/`. If P1 kept the pre-upgrade audit prompt, it moves to `docs/assets/maintainer/`. Every link and filename mention is then updated by the [link-update rules](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#link-update-rules), including the W1 R7 backlog and PRD 20 links to PRD 17 in the same change set. The index is updated last, and its `## Current Authority Map` is the final edit.

## Entry Gate

- P3 committed after a reviewer pass, with all 155 inventory rows traced.
- The owner has chosen option A or B in [Owner Decision Before The Archive Moves](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#owner-decision-before-the-archive-moves), and the choice is recorded under `## Owner Decisions` in `evidence.md`. Without it, the phase stops here.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `indirect`. Promises: every `## Current Authority Map` topic points to one active product-named PRD, and every link to a moved or retired PRD resolves ([plan promise table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md#human-experience-propagation)).
- Intended human outcome: A reader picks the right PRD from the index, and an old link from a plan, guide, toolkit note, or history record lands on a real file.
- Human-facing surface or indirect effect: The PRD index, and links across plans, work, designs, assets, toolkits, and archived history.
- Implementation work: Stages 1 to 4.
- Evidence source or testing type selected under current authority: Validator zero; full-repository link check; reviewer reading of the index.
- Executor: Implementer agent, then an independent reviewer agent; the orchestrator asks the owner for the entry-gate decision.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Validator, path hygiene, rename-similarity check of the moves, and a full-repository relative-link and anchor check including `.make-docs/archive/`. |
| Performance Testing | `not-needed-now` | Documentation only. |
| Guided Progress Review | `not-needed-now` | The independent phase review reads the index and samples links. |
| Unassisted Goal Testing | `not-needed-now` | No new human-facing product surface. |

Human Experience Review is separate. The reviewer opens every `## Current Authority Map` target and follows a sample of repaired links from each location group.

## Source PRD Docs

- [00 PRD Index](../../prd/00-index.md), all sections
- [03 Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md), items `D-002`, `Q-001`, `Q-011`, `Q-012`, `R-004`, and any other item that links PRDs 13–19
- [02 Architecture Overview](../../prd/02-architecture-overview.md#module-map), [08 Data Layer and Extraction](../../prd/08-data-and-extraction.md#contracts-and-data), and [20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md) as new link targets
- PRD 13 at `docs/prd/13-adopter-owned-config-surface.md`
- PRD 17 at `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`, renamed in this phase to `docs/prd/17-entity-identity-and-canonical-resolution.md`

## Plan And Design Lineage

- Plan: [02 Archive, Links, and Index](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md) and the [PRD 17 rename spec](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#prd-17-rename-spec)
- Design: [5. Archive and links](../../designs/2026-11-23-prd-set-authority-cleanup.md#5-archive-and-links) and [7. Order of work and safety](../../designs/2026-11-23-prd-set-authority-cleanup.md#7-order-of-work-and-safety), steps 6 and 7
- Inventory: section 3, cross-references, of the [requirement inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md#3-cross-references-to-prds-13-to-19)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Owner decision and archive surface

### Tasks

- [x] t1: The orchestrator asks the owner to choose option A (repair link paths only inside archived copies, as a recorded reviewed move) or option B (leave archived copies byte-identical and exclude their links from the link check). The question names the choice, the reason (the archived copies' own relative links break when they move), and the effect. Record the answer under `## Owner Decisions`.
- [ ] t2: Run `make-docs project surface ensure archive`. Confirm `.make-docs/archive/prds/` and `.make-docs/archive/work/` are usable.

### Acceptance criteria

- B37: `evidence.md` records the owner's choice with its date before any file moves.

### Dependencies

- Entry gate met.

## Stage 2 - Rename and moves

### Tasks

- [x] t3: `git mv docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md docs/prd/17-entity-identity-and-canonical-resolution.md`. Change its H1 to `# 17 Entity Identity and Canonical Resolution`.
- [x] t4: `git mv` PRDs 14, 15, 16, 18, and 19 from `docs/prd/` to `.make-docs/archive/prds/2026-11-23/` with unchanged file names, exactly as listed in the plan's [moves table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#moves).
- [x] t5: `git mv` the five backlog directories `2026-06-03-w1-r0-build-os-baseline`, `2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard`, `2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution`, `2026-07-21-w1-r5-unified-buildos-cli-and-distribution`, and `2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta` from `docs/work/` to `.make-docs/archive/work/` with unchanged names.
- [x] t6: Apply the P1 audit-prompt decision: `git mv .make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` if kept, or `git rm` it if retired. If kept, turn its PRD 17 mention into a relative link.
- [x] t7: Record every move under `## Recorded Reviewed Moves`: source path, destination path, and the `git diff --stat -M` similarity.

### Acceptance criteria

- B38: `docs/prd/` holds exactly `00`–`13`, `17-entity-identity-and-canonical-resolution.md`, `20-buildos-cli-and-distribution.md`, and the `AGENTS.md` and `CLAUDE.md` routers.
- B39: `.make-docs/archive/prds/2026-11-23/` holds the five archived PRDs and nothing else, and `.make-docs/archive/work/` holds the five backlog directories with their original file sets.
- B40: `git diff -M` shows each move as a rename. Under option B, each archived file is byte-identical. Under option A, each archived file differs only in link targets.

### Dependencies

- Stage 1 complete.

## Stage 3 - Links and mentions

### Tasks

- [x] t8: Update `docs/prd/`: links to PRD 17 in 01–13 and 20 use the new filename and new anchors; PRD 20 `## Scope`, `## Command Surface`, and `## Compatibility` link the renamed 17; PRD 20 `## Source Anchors` name the archived paths of 14, 18, and 19; register items `D-002`, `D-005` (code anchors), `Q-001`, `Q-011`, `Q-012`, and `R-004` point at the new owner or the archived copy; PRD 04 names no legacy filename.
- [x] t9: Update the W1 R7 backlog in `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`: in `00-index.md`, `02-golden-capture.md`, `03-entities-port.md`, `05-discovery-and-design-port.md`, `07-skills-and-validation.md`, and `08-release-0-1-0.md`, turn every code-span cite of PRD 16 or PRD 17 into a link to [02 Module Map](../../prd/02-architecture-overview.md#module-map) or to `17-entity-identity-and-canonical-resolution.md` with the new section names from the plan's section map. Drop the "legacy editorial PRD; it stays the current owner until the `D-005` cleanup" notes. Point the `00-index.md` links to the W1 R5 and W1 R6 backlogs at their archived copies.
- [x] t10: Update the W1 R7 plan files `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md`, `01-prd-authority-maintenance.md`, and `02-risk-register-index-and-lineage.md` by the `docs/plans/` rule.
- [x] t11: Update the other plans named in section 3 of the inventory, under `docs/plans/2026-06-03-w1-r0-*`, `2026-06-03-w1-r1-*`, `2026-06-04-w1-r2-*`, `2026-06-10-w1-r3-*`, `2026-07-21-w1-r4-*`, `2026-07-21-w1-r5-*`, and `2026-08-14-w1-r6-*`, plus every plan link to an archived backlog, by the `docs/plans/` rule.
- [x] t12: Update `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md`, the five files in `docs/assets/maintainer/` and `docs/assets/user/` named in the inventory, and the three `docs/assets/maintainer/` files that link archived backlogs. Check the textual "PRD 1x" mentions named in the plan by hand.
- [x] t13: Update the nine `toolkits/` files named in the inventory (`toolkits/AGENTS.md`, `toolkits/buildos/AGENTS.md`, and the `buildos-design`, `buildos-discovery`, and `buildos-intake` README, `AGENTS.md`, and `CLAUDE.md` files), plus the `toolkits/buildos-intake/README.md` link to an archived backlog.
- [x] t14: Repair links in `.make-docs/archive/history/` as a recorded reviewed move: links to PRDs 14, 15, 16, 18, and 19 point at `../prds/2026-11-23/<file>`, links to PRD 17 use its new filename, and links to an archived backlog point at `../work/<directory>/<file>`. Change nothing else. List each repaired link under `## Recorded Reviewed Moves`.
- [x] t15: Under option A, repair the broken relative links inside the archived PRDs and backlogs the same way, path only, and list them under `## Recorded Reviewed Moves`. Under option B, change nothing in them and record the count of links the link check will exclude.
- [x] t16: Search the whole repository, excluding `.git/`, for `17-enhance-entity-consolidation-and-canonical-resolution`, `docs/prd/14-`, `docs/prd/15-`, `docs/prd/16-`, `docs/prd/18-`, `docs/prd/19-`, `prd/1[4-9]-revise`, and the five old backlog paths under `docs/work/`. Every hit left is inside an archived copy under option B, or is a deliberate archived-path mention. Record the result.

### Acceptance criteria

- B41: No file in `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/` names `17-enhance-entity-consolidation-and-canonical-resolution.md`, `16-revise-toolkit-ownership-boundaries.md`, or a removed PRD 17 or PRD 13 section, and its `## Source PRD Docs` sections link only product-named PRDs.
- B42: The search in t16 finds no live link or path to an old location outside the cases it allows.
- B43: `evidence.md` lists every repaired link in `.make-docs/archive/`, with old and new targets.

### Dependencies

- Stage 2 complete.

## Stage 4 - Index and Current Authority Map

### Tasks

- [x] t17: Update [the index](../../prd/00-index.md) `## Purpose` and `## Document Map` as listed in the plan's [index changes](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/02-archive-links-and-index.md#index-changes), items 1 and 2: remove rows 14, 15, 16, 18, and 19; set 13 and 17 to `subsystem`; replace `15` and `16` in `Related Docs`.
- [x] t18: Update the index `## Reading Order`, `## Source Anchors`, and `## Audience Paths`, items 3 to 5.
- [x] t19: Update the index `## Current Authority Map` last, item 6. Each topic links one active product-named PRD, or a named pair split by section. No "legacy name" note remains.

### Acceptance criteria

- B44: The index `## Document Map` has no editorial kind, no row for 14, 15, 16, 18, or 19, and a `subsystem` row for `17-entity-identity-and-canonical-resolution.md`.
- B45: Every `## Current Authority Map` row links an active product-named PRD that exists, and Domain ownership, Entities, Config validation, and Data lifecycle each have one owner.

### Dependencies

- Stage 3 complete.

## Stage 5 - Review and commit

### Tasks

- [x] t20: Run the validator and record the counts. Run path hygiene. Run the full-repository relative-link and anchor check, including `.make-docs/archive/`, and record the result under `## Link Check`.
- [x] t21: An independent reviewer reviews the phase diff against the plan, design, and inventory before commit. The reviewer checks the moves against `## Recorded Reviewed Moves`, re-runs t20, reads the index in full, opens every `## Current Authority Map` target, follows at least three repaired links from each location group, and records a pass or findings under `## Phase Reviews`. The implementer fixes each finding and the reviewer rechecks it.
- [x] t22: Commit the phase with the subject `docs: [W1 R8 P4] PRD Set Authority Cleanup - Rename, Archive, Links, and Index` and a one-paragraph body under `make-docs://system/contract/commit-message-convention.md`.

### Acceptance criteria

- B46: `make-docs run prd authority validate --target-root .` exits `0`, and `PRD-AUTH-001`, `PRD-AUTH-002`, `PRD-AUTH-003`, `PRD-AUTH-004`, and `PRD-AUTH-005` are each 0.
- B47: Path hygiene reports zero failing findings.
- B48: The full link check finds no broken link to a PRD, a moved backlog file, or the moved prompt, apart from the excluded count recorded under option B.
- B49: `evidence.md` records a reviewer pass for P4 before the commit.

### Dependencies

- Stage 4 complete.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran: validator 0 findings (exit `0`), path hygiene 0 failing findings, all 38 moves shown as renames, and the full-repository link check with 0 broken links to a PRD, a moved backlog file, or the moved prompt, and 0 malformed links. The 11 other broken links existed before P4 and are reported in `evidence.md`. Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`.
- Performance evidence: None; not needed.
- Human Experience Review: The independent reviewer checked the moves, the repaired links, the index, and every `## Current Authority Map` target, and passed P4 in round 3. See [Phase Reviews](./evidence.md#phase-reviews).
- Optional experience handoff: Not applicable; indirect impact.
- Explicit human acceptance gate: The owner chose option A on 2026-11-23, recorded under `## Owner Decisions` in [`evidence.md`](./evidence.md).
- Evidence report: [`evidence.md`](./evidence.md) `## Validator Counts`, `## Owner Decisions`, `## Recorded Reviewed Moves`, `## Link Check` `### P4`, and `## Human Experience Evidence` `### P4`. `## Phase Reviews` records the P4 reviewer pass (round 3: validator 0 findings, exit `0`; path hygiene 0 failing across 133 files; 799 links to PRDs, archived backlogs, and the moved prompt resolve, 0 malformed), which satisfies B49.
- Phase / capability status: Done. Implementation, independent review (t21, PASS in round 3), and commit (t22) are complete. t2 did not run: `make-docs project surface ensure archive` needs Store installation evidence, and `make-docs setup reconfigure` is an interactive owner step. The archive surface and its routers already exist, and the reviewer judged them adequate. The open item is under `## Owner Summary` in `evidence.md`.
