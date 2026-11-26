---
title: "PRD Set Authority Cleanup PRD Authority Maintenance Plan"
kind: "plan"
status: "draft"
coordinate: "W1 R8"
follow_on:
  route: "prd-generation"
  next_prompt: "make-docs://system/prompt/plan-to-prd-change.prompt.md"
  why: "The PRD set must become fully valid product authority, with every current requirement of PRDs 13–19 in a product-named owner, before W1 R7 implementation uses it. The PRD maintenance runs inside the W1 R8 work backlog."
  coordinate_handoff: "Carry W1 R8 into requirement-history entries, register updates, the W1 R8 work backlog, and its phase commits."
source:
  type: "design"
  path: "docs/designs/2026-11-23-prd-set-authority-cleanup.md"
---

# PRD Set Authority Cleanup PRD Authority Maintenance Plan

**Date:** 2026-11-23

**Repository:** Build OS repository root

**Purpose:** Plan the PRD authority maintenance that makes the BuildOS PRD set fully valid product authority, as decided in the [PRD Set Authority Cleanup design](../../designs/2026-11-23-prd-set-authority-cleanup.md). Every current requirement in the legacy editorial PRDs 13–19 moves to a product-named owner. PRD 17 is renamed in place. PRD 13 is restructured. PRDs 14, 15, 16, 18, and 19 are archived. Stale pointers in PRDs 01–12 are folded into their bodies. The plan closes register item `D-005`.

## Objective

A reader or agent can open any active PRD and trust that it states the current product. There is one owner per topic, no dead pointer, and no document that looks current but is not.

The outputs serve three readers: BuildOS maintainers and the agents that plan and build BuildOS, reviewers who read the PRD set to learn what BuildOS does, and the orchestrated implementer and reviewer agents that will execute W1 R7.

The plan is done when:

- `make-docs run prd authority validate --target-root .` exits `0` with zero findings;
- register item `D-005` is `Closed` with a `Resolution`;
- every one of the 155 rows in [04 Requirement Inventory](./04-requirement-inventory.md) has a filled `Final owner` cell that names an owner section or `none` with a reason, and the reviewer's sample matches the owner text;
- a relative-link check over the whole repository, including `.make-docs/archive/`, finds no broken link to a PRD, a moved backlog, or a moved prompt;
- `make-docs project path-hygiene validate` reports zero failing findings;
- the W1 R7 work backlog cites the new owners, and its `## Change History` records that `D-005` is closed and that W1 R8 satisfies the `D-005` prerequisite for W1 R7 P1.

This plan authorizes documentation maintenance, the archive moves the owner requested on 2026-11-23, and one file move out of a Make Docs-managed tree. It does not authorize code, toolkit behavior changes, publication, or a commit without the per-phase review.

## Lifecycle Departure

The default arc is design, plan, PRD, work, implementation. This plan departs from it, as recorded in the design frontmatter (`departure: plan-to-work-before-prd`). The W1 R8 work backlog is written from this plan before any PRD changes. The PRD maintenance is itself the deliverable, so it is executed as tasks inside the backlog phases. Each phase is reviewed and committed on its own, which keeps every PRD change reviewable. The `follow_on` route stays `prd-generation`, but the PRD generation happens through the [W1 R8 work backlog](../../work/2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md), not as a separate step before it.

## Governing Invariant

> `docs/prd/` describes the current authoritative shape of the product. It must never describe the editorial operation used to change that authority.

The rename, archive, folding, and link-repair language stays in this plan, the backlog, and the evidence report. A PRD reader sees only current requirements and short requirement history. Validator codes, inventory row IDs, and archive mechanics never appear in a PRD body.

## Coordinate Decision

- Coordinate: `W1 R8`
- Classification: `revision-wave`
- Evidence: The owner directed the cleanup on 2026-11-23, and the design's `## Intended Follow-On` hands off W1 R8 as the next unused revision of W1 (W1 R7 is the highest). The change redoes PRD outputs of several completed W1 phases: the baseline PRDs 01–12 and PRDs 14, 15, and 16 from [W1 R0](../2026-06-03-w1-r0-build-os-baseline/00-overview.md), PRD 13 from [W1 R1](../2026-06-03-w1-r1-adopter-owned-config-surface/00-overview.md), PRD 14 from [W1 R2](../2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/00-overview.md), and PRDs 17 and 18 from [W1 R4](../2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md). That passes the revision Wave test on two counts: it redoes the results of two or more completed phases, and it needs its own design and a plan with several phases. Register item `D-005`, opened by W1 R7, is the handoff.

W1 R8 needs a new work backlog because it is a revision Wave. The wave model asks the prior backlog to record a `revision-wave` entry. The W1 R0, R2, and R4 backlogs are archived unchanged by design decision 5, so they get no entry. The active [W1 R7 work backlog](../../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md) is the current W1 backlog. It already records the gate move in its `## Change History`, and W1 R8 P5 adds the closure entry.

## Maintenance Inputs

| Input | Format | Location | Confidence |
| --- | --- | --- | --- |
| Cleanup decisions | Design, draft, owner-directed | [PRD Set Authority Cleanup](../../designs/2026-11-23-prd-set-authority-cleanup.md) | High |
| Requirement inventory (155 rows), validator breakdown, cross-references, end-state options | Read-only research at commit `59e3a36` | [04 Requirement Inventory](./04-requirement-inventory.md) | High; medium-confidence rows are listed there |
| `D-005` seed inventory, safety rules, and sequencing | Register item | [Open questions and risk register](../../prd/03-open-questions-and-risk-register.md), item `D-005` | High |
| Current authority map | PRD index | [PRD index Current Authority Map](../../prd/00-index.md#current-authority-map) | High |
| CLI and distribution owner | Product PRD | [PRD 20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md) | High |
| Legacy editorial PRDs | PRD files | `docs/prd/13-adopter-owned-config-surface.md` through `docs/prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | High as text; status per inventory row |
| Current `buildos validate` behavior | Source | `system/.os/scripts/validate_config.py` | High |
| PRD authority validator baseline | Tool output | `make-docs run prd authority validate --target-root . --json` exited `1` with 93 findings on 2026-11-23 | High |
| W1 R7 gate text | Work backlog | [W1 R7 work index](../../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md): P1 waits for `D-005` closed by W1 R8 | High |

Open points that the implementer settles from the repository, not by owner decision: whether the PRD 13 scoped-field migration has landed (design decision 6), and whether the pre-upgrade audit prompt moves or is retired (design decision 6). One point needs an owner decision before the archive moves: how the relative links inside the archived copies are handled. See [02 Archive, Links, and Index](./02-archive-links-and-index.md#owner-decision-before-the-archive-moves).

## Human Experience Propagation

Source intent: the `## Human Experience Intent` section of the [source design](../../designs/2026-11-23-prd-set-authority-cleanup.md#human-experience-intent). Impact is `indirect`. Authority for the standard is `make-docs://system/contract/human-experience-contract.md`.

| Promise | Existing or planned owning PRD | Human-facing surface or indirect effect | Work phase | Evidence source or selected testing type | Accepted obligation, if any |
| --- | --- | --- | --- | --- | --- |
| Every topic in the `## Current Authority Map` points to exactly one active PRD with a product name | [PRD index](../../prd/00-index.md#current-authority-map) | A reader picks the right PRD from the index without knowing the cleanup history | P4; confirmed in P5 | Validator zero for `PRD-AUTH-001` to `PRD-AUTH-004`; reviewer reads every map row and opens its target | None |
| No active PRD body relies on a change note, banner, or another document to override what it says | PRDs 01–13, 17, and 20 | A reader of any PRD body sees the current requirement in place | P1 and P2 | Search finds no `### Change Notes` bullet in 01–12 that links PRDs 13–19, and no superseded banner in `docs/prd/`; reviewer reads the corrected bodies named in [01](./01-prd-authority-maintenance.md) | None |
| Every link from plans, work, designs, assets, toolkits, and archived history to a moved or retired PRD resolves, to the new owner or the archived copy | Receiving owners and the archived copies | A reader following an old link lands on a real file | P4; confirmed in P5 | Full-repository relative-link and anchor check, including `.make-docs/archive/` | None |
| No current requirement from PRDs 13–19 is lost; each one is traceable from the inventory to its new owner section | Receiving owners named in [01](./01-prd-authority-maintenance.md) | Maintainers and agents can trust that the cleanup changed no current requirement | P3; rechecked in P5 | Requirement trace check: every inventory row has a `Final owner`; reviewer samples rows against the owner text | None |

## Performance Evidence Plan

Governing contract: `make-docs://system/contract/performance-evidence-governance.md`.

| Candidate | Base maintenance action | Performance applicability | Target class | Canonical `PERF-###` or next record | Finite budget and stop reference | Lifecycle point |
| --- | --- | --- | --- | --- | --- | --- |
| None. The cleanup is documentation only and changes no runtime behavior. | `none` | `not-needed` | none | None | Not applicable | None |

## Active Authority Baseline

- Active `docs/prd/` status: active set `00`–`20`. PRDs 14, 18, and 19 carry a superseded banner, and 19 was never approved. PRDs 13, 15, 16, and 17 hold current requirements under legacy editorial filenames, titles, kinds, or headings.
- Current index: `docs/prd/00-index.md`
- Discovery pass required: yes
- Discovery scope if required: PRDs 13–19 in full, PRD 20 in full, the `### Change Notes` sections of PRDs 01–12, and every filename mention of PRDs 13–19 across the repository. The read-only pass on 2026-11-23 is recorded in [04 Requirement Inventory](./04-requirement-inventory.md).
- Known noncompliance or legacy editorial PRDs: PRDs 13–19. The validator reports 93 findings: `PRD-AUTH-005` 51, `PRD-AUTH-004` 23, `PRD-AUTH-003` 7, `PRD-AUTH-001` 6, `PRD-AUTH-002` 6. The 51 `PRD-AUTH-005` findings sit in the W1 R0, R2, R4, R5, and R6 backlogs. The baseline PRDs 01–12 hold 65 `### Change Notes` bullets that point at PRDs 13–19, which the validator does not flag.

## Phase Map

| File | Purpose |
| --- | --- |
| [01-prd-authority-maintenance.md](./01-prd-authority-maintenance.md) | Candidate decision matrix, existing PRDs to update, the PRD 17 rename spec, the PRD 13 restructure spec, and requirement-history entries |
| [02-archive-links-and-index.md](./02-archive-links-and-index.md) | Archive moves, link-update rules, index changes, and register changes |
| [03-validation-and-review.md](./03-validation-and-review.md) | Checks per phase and at the end, and the per-phase review protocol |
| [04-requirement-inventory.md](./04-requirement-inventory.md) | The read-only requirement inventory baseline, with a `Final owner` column for the trace check |

## Output Contract

- Plan directory: `docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/`
- Existing authoritative PRDs to update: `00`, `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `17` (renamed in place to `17-entity-identity-and-canonical-resolution.md`), and `20`
- Genuinely new authoritative PRDs: none
- PRDs retired from the active set: `14`, `15`, `16`, `18`, and `19`, archived to `.make-docs/archive/prds/2026-11-23/` with unchanged file names
- Requirement-history entries: as listed in [01](./01-prd-authority-maintenance.md#requirement-history-entries)
- Shared PRD surfaces: `docs/prd/00-index.md`, `docs/prd/03-open-questions-and-risk-register.md`
- Archived backlogs: the W1 R0, R2, R4, R5, and R6 work backlogs, moved to `.make-docs/archive/work/` with unchanged directory names
- Other touched surfaces: plans, `docs/assets/`, `docs/designs/`, `toolkits/`, the W1 R7 plan and backlog, and link repairs in `.make-docs/archive/history/`, as listed in [02](./02-archive-links-and-index.md)
- Work backlog (new, revision Wave): `docs/work/2026-11-23-w1-r8-prd-set-authority-cleanup/`

## Dependencies

- The source design is directed by the owner. Its file is still `draft` and uncommitted.
- The owner requested the archive moves on 2026-11-23 through the design.
- The owner decides how links inside the archived copies are handled before P4 moves any file. See [02](./02-archive-links-and-index.md#owner-decision-before-the-archive-moves).
- Make Docs 2.0.9 or newer is available for `make-docs run prd authority validate`, `make-docs project path-hygiene validate`, and `make-docs project surface ensure archive`.
- The parallel W1 R7 edits that move the `D-005` gate to W1 R7 P1 are in place before W1 R8 P5 writes its closure entry.
- No code dependency.

## Worker Ownership

The cleanup runs as an orchestrated loop: one implementer agent and one independent reviewer agent per phase. The reviewer reviews each phase diff before its commit. The planning chat that wrote the design, this plan, and the backlog does not execute them.

| Worker | Scope | Write Scope | Dependencies | Deliverables |
| --- | --- | --- | --- | --- |
| Orchestrator | Starts each phase, hands the phase file to the implementer, routes the diff to the reviewer, and stops on a failed gate | None | Owner approval of this plan and backlog | Phase handoffs and stop reports |
| Implementer | Executes one backlog phase at a time | The files named by that phase's tasks, plus the phase's section of the backlog `evidence.md` | Previous phase committed | Phase diff, validator counts, and evidence entries |
| Reviewer | Reviews the phase diff against this plan, the design, and the [inventory](./04-requirement-inventory.md). Samples trace rows. Re-runs the phase checks | The phase's review entry in the backlog `evidence.md` only | Implementer reports the phase done | Pass, or a list of findings for the implementer to fix |

A phase is committed only after the reviewer passes it. The commit uses the subject `docs: [W1 R8 Pn] PRD Set Authority Cleanup - <phase name>` under `make-docs://system/contract/commit-message-convention.md`.

## MCP Strategy

- Preferred servers available: the `make-docs` CLI and MCP (`prd_validate`, `paths_validate`, `surface_ensure`); `jdocmunch` for section lookup and broken-link discovery after a reindex.
- Fallback plan if unavailable: run the same checks through the `make-docs` CLI. Use `grep` for pointer and filename searches and a temporary relative-link and anchor check script kept in `$TMPDIR`, not in the repository.

## Validation

See [03 Validation and Review](./03-validation-and-review.md). In short: the validator exits `0`; every inventory row is traced; links resolve across the whole repository including `.make-docs/archive/`; path hygiene passes; no PRD was renumbered; PRDs 13 and 17 follow the subsystem template; no `### Change Notes` pointer to PRDs 13–19 remains in 01–12; the W1 R7 backlog links the new owners; and each Human Experience promise above has its evidence.

## Intended Follow-On

This handoff is advisory-default-but-overridable: it is authoritative unless the user explicitly overrides it, and it is not a gate or precondition.

- Route: `prd-generation`
- Next step: Update the active PRD set from this plan with `make-docs://system/prompt/plan-to-prd-change.prompt.md`. Execution runs through the [W1 R8 work backlog](../../work/2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md), phase by phase, because the PRD maintenance is the backlog's deliverable.
- Why: The PRD set must be fully valid authority before W1 R7 implementation uses it.
- Coordinate Handoff: Carry `W1 R8` into requirement-history entries, register updates, and the commits of each backlog phase. When `D-005` closes, W1 R8 will satisfy the `D-005` prerequisite for W1 R7 P1.

## Change History

### 2026-11-23 — W1 R8

- Kind: `edit`
- Affected scope: Success outcome for the W1 R7 work backlog and the `## Intended Follow-On` coordinate handoff
- Previous scope: The text said the W1 R7 `## Change History` records that W1 R7 P1 may start, and that W1 R7 P1 may start when `D-005` closes.
- Replacement scope: The text says W1 R8 satisfies, or will satisfy, the `D-005` prerequisite for W1 R7 P1. It no longer says P1 may start.
- Rationale: Closing `D-005` meets only one W1 R7 P1 entry-gate condition. P1 also needs the owner's approval of the W1 R7 PRD maintenance and backlog, so the old text overstated the hand-off.
- PRD decision: `none` — wording of the handoff claim only.
- Owner approval: not required (wording correction).
- Source: [W1 R8 work index](../../work/2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md)
