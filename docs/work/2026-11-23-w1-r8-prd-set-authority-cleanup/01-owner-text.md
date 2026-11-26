---
title: "Phase 1: Owner Text"
kind: "work"
status: "active"
coordinate: "W1 R8 P1"
source:
  type: "plan"
  path: "docs/plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md"
---

# Phase 1: Owner Text

## Purpose

Write the current requirements of PRDs 13–19 into their product owners before anything is renamed or archived. This follows `D-005` safety rule 1: owner text first. It covers entities, data, conversion, architecture, the CLI, and config, plus the receiving items in 09, 10, 11, and 04.

## Overview

PRD 17 is restructured to the subsystem template in place. Its filename and H1 stay until P4, so no link breaks yet. PRD 13 is restructured to the same template. The three gaps get owners: the entity command flags in 17, the local-only rule in 20, and the full `buildos validate` check list in 13. PRDs 08, 07, 02, 09, 10, 11, and 04 receive the rules that today live only in PRDs 15, 16, 17, or 18, or in change notes. The legacy PRDs 14, 15, 16, 18, and 19 are not edited.

## Entry Gate

- The owner has approved the [W1 R8 plan](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md) and this backlog.
- `make-docs run prd authority validate --target-root . --json` reports the 93-finding baseline.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `indirect`. Promises: no active PRD body relies on another document to override it, and no current requirement is lost ([plan promise table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md#human-experience-propagation)).
- Intended human outcome: A reader of PRD 17, 13, 08, 07, 02, 20, 09, 10, 11, or 04 finds each current rule stated in the body of its own section.
- Human-facing surface or indirect effect: PRD bodies that maintainers and agents read before planning or building.
- Implementation work: Stages 1 to 6.
- Evidence source or testing type selected under current authority: Validator counts; reviewer reading of each changed section against the plan decision matrix and the inventory.
- Executor: Implementer agent, then an independent reviewer agent.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | The PRD authority validator, path hygiene, and a relative-link and anchor check run on the phase diff. |
| Performance Testing | `not-needed-now` | Documentation only; no runtime change. |
| Guided Progress Review | `not-needed-now` | The independent phase review covers the reading check. |
| Unassisted Goal Testing | `not-needed-now` | No new human-facing product surface. |

Human Experience Review is separate. The reviewer reads every changed PRD section in full and records whether a reader can find each current rule without following a note or another PRD.

## Source PRD Docs

- [02 Architecture Overview](../../prd/02-architecture-overview.md), sections `## Module Map`, `## Configuration Surfaces`, `## Requirement History`
- [04 Glossary](../../prd/04-glossary.md), section `## Terms`
- [07 Intake and Conversion](../../prd/07-intake-and-conversion.md#contracts-and-data), section `## Contracts and Data`
- [08 Data Layer and Extraction](../../prd/08-data-and-extraction.md), sections `## Contracts and Data`, `## Integrations`
- [09 Playbooks](../../prd/09-playbooks.md#contracts-and-data), [10 Discovery, Runs and Qualification](../../prd/10-discovery-runs-and-qualification.md#contracts-and-data), and [11 Flow C Integration](../../prd/11-flow-c-integration.md#contracts-and-data), section `## Contracts and Data`
- [20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md), sections `## Runtime and Package`, `## Command Surface`
- PRD 13 at `docs/prd/13-adopter-owned-config-surface.md`, all sections (restructured here)
- PRD 17 at `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`, all sections (restructured here; renamed in P4)
- Source text only, not authority: `docs/prd/15-revise-extraction-draft-lifecycle.md`, `docs/prd/16-revise-toolkit-ownership-boundaries.md`, `docs/prd/18-revise-unified-buildos-cli-and-distribution.md` (`### W1 R4 seed contract`), and `docs/prd/14-revise-deterministic-toolkit-deployment.md` (`## Effective Requirement`, runtime posture)

## Plan And Design Lineage

- Plan: [01 PRD Authority Maintenance](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md), rows C-01 to C-40, the [PRD 17 rename spec](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#prd-17-rename-spec), and the [PRD 13 restructure spec](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#prd-13-restructure-spec)
- Design: [1. End state per legacy PRD](../../designs/2026-11-23-prd-set-authority-cleanup.md#1-end-state-per-legacy-prd), [2. Gaps filled](../../designs/2026-11-23-prd-set-authority-cleanup.md#2-gaps-filled), [3. Entity upgrade steps retired](../../designs/2026-11-23-prd-set-authority-cleanup.md#3-entity-upgrade-steps-retired), and [6. Other items](../../designs/2026-11-23-prd-set-authority-cleanup.md#6-other-items)
- Inventory: [04 Requirement Inventory](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md), tables for PRDs 13, 15, 16, 17, and rows 14-06, 14-13, 18-02, 18-12, 18-13, 18-15

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Evidence report and baseline

### Tasks

- [x] t1: Create `evidence.md` in this backlog folder with the sections `## Validator Counts`, `## Owner Decisions`, `## Requirement Trace`, `## Change-Note Dispositions`, `## Recorded Reviewed Moves`, `## Link Check`, `## Human Experience Evidence`, `## Phase Reviews`, and `## Owner Summary`. Add a link to it in the `## Usage Notes` of [the index](./00-index.md).
- [x] t2: Run `make-docs run prd authority validate --target-root . --json` and record the counts by code under `## Validator Counts` as the baseline.

### Acceptance criteria

- B1: `evidence.md` exists, the index links it, and it records the baseline: `PRD-AUTH-001` 6, `PRD-AUTH-002` 6, `PRD-AUTH-003` 7, `PRD-AUTH-004` 23, `PRD-AUTH-005` 51, total 93.

### Dependencies

- Entry gate met.

## Stage 2 - PRD 17 restructured in place

### Tasks

- [x] t3: In `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md`, keep the filename and H1. Write `## Purpose` and `## Scope` from rows 17-01, 17-19, 17-45, and 16-09, with the out-of-scope list from the rename spec.
- [x] t4: Write `## Component and Capability Map`: the entities domain inside `toolkits/buildos/`, its four commands, and direct calls from discovery and design (17-07, 17-08). Link [20 Output and Exit Contract](../../prd/20-buildos-cli-and-distribution.md#output-and-exit-contract) for the reported package version, source revision, root, mode, and write status (17-13).
- [x] t5: Add `### Entity commands` under `## Component and Capability Map`. State the flag contract from `### W1 R4 seed contract` in `docs/prd/18-revise-unified-buildos-cli-and-distribution.md` (18-12): `resolve`, `validate`, `consolidate`, and `rebuild-index` with `--root`, `--mode compat|strict`, `--id`, `--manifest`, `--apply`, `--check`, and `--json`; dry run by default for `consolidate`; check by default for `rebuild-index`; `--check` and `--apply` mutually exclusive; explicit root and mode required. Confirm each flag against the Go command definitions in `toolkits/buildos/internal/cli/` (read only) and record any difference in `evidence.md`.
- [x] t6: Write `## Contracts and Data` with `### Lifecycle and redirects`, `### Redirect object`, `### Terminal resolution`, `### Strict and compatibility modes`, `### Matching and review policy`, `### Reviewed consolidation manifest`, `### Atomic writes`, and `### Derived index`. Move the current text from `## Capability Addition or Enhancement` and the existing `## Contracts and Data` subsections into them (C-07 to C-13). Add the `superseded` and `archived` meanings (15-07) and the installed-root index path `.os/indexes/entity-resolution.json` (18-13). Name `references.json` as the intake index and link [07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data).
- [x] t7: Write `## Integrations` from `## Integration Impact` (17-38, 17-39, 17-44), with links to [08](../../prd/08-data-and-extraction.md), [09](../../prd/09-playbooks.md), [10](../../prd/10-discovery-runs-and-qualification.md), and [11](../../prd/11-flow-c-integration.md).
- [x] t8: Decide the pre-upgrade audit prompt (C-15). Check whether the resolver, validator, writer, and index it waits for now exist, and whether PRD 17 still needs the prompt. Record "move" or "retire" with the reason under `## Owner Decisions` in `evidence.md`. If "move", `## Integrations` names `docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` as a code path; P4 moves the file and makes it a link. If "retire", PRD 17 does not mention it.
- [x] t9: Write `## Rebuild Notes` with `### Adoption and live-root migration safety`, restated for the npm package (C-16: rows 17-21, 17-22 steps 3–7 and 9, 17-23 second half, 17-47, 14-13), linking [20 Project Initialization and Adoption](../../prd/20-buildos-cli-and-distribution.md#project-initialization-and-adoption) and register `R-004`. Add `### Acceptance` from 17-25.
- [x] t10: Add `## Requirement History` with the two PRD 17 entries from the plan's [requirement history table](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#requirement-history-entries) (C-18). Update `## Source Anchors` per the rename spec.
- [x] t11: Delete `## Change Type`, the `## Capability Addition or Enhancement` and `## Integration Impact` headings, `## Affected Baseline Docs`, `## Required Baseline Annotations`, and every `### Change Notes`. Before each deletion, confirm in the inventory that every sentence is placed in a current section, a history entry, or a `none` row of the plan matrix.

### Acceptance criteria

- B2: PRD 17 has, in order, `## Purpose`, `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`, `## Requirement History`, and `## Source Anchors`, and none of the five retired headings or a `### Change Notes` section.
- B3: `### Entity commands` states every flag, default, and exclusion listed in t5, and `evidence.md` records that they match the Go command definitions or lists each difference.
- B4: Outside `## Requirement History`, PRD 17 states no Go build step, installed binary, or `pkg/entities` path as a current requirement.
- B5: The audit-prompt decision is recorded in `evidence.md`.

### Dependencies

- Stage 1 complete.

## Stage 3 - Data and conversion owners

### Tasks

- [x] t12: In [08 Contracts and Data](../../prd/08-data-and-extraction.md#contracts-and-data), add the `draft` lifecycle as normative text: pending rows in `.os/data/*.jsonl` use `draft`; `candidate` is never an entity status; the lifecycle values are `draft`, `active`, `superseded`, and `archived`; every row needs `source_anchor`; a row that is not `draft` needs `doc_anchor`; extraction load-plans use the same values and record minted entity and playbook IDs (15-01 to 15-04). Add one summary line for type-aware terminal states (17-43) and link PRD 17 for `superseded`, `archived`, and `extraction-outcomes-v1`.
- [x] t13: In 08 `## Integrations`, state that consumers keep the recorded ID and expose canonical plus chain, and producers store canonical IDs and tell reuse or update apart from mint (17-39), linking PRD 17.
- [x] t14: Add `## Requirement History` to PRD 08, before `## Source Anchors`, with the 08 lifecycle entry from the plan table.
- [x] t15: In [07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data), state that converted twins may use `candidate` only under the converted-source contract (15-05), and that `references.json` is the intake index and never carries entity redirects (17-37). Confirm that 07 already names the intake subcommands (18-15) and record the result.

### Acceptance criteria

- B6: PRD 08 `## Contracts and Data` states the `draft` rule and the anchor rule with "must" wording, and PRD 08 has a `## Requirement History` entry for it.
- B7: PRD 07 `## Contracts and Data` states the `candidate` boundary and the `references.json` boundary.

### Dependencies

- Stage 2 complete, so the PRD 17 sections that 08 and 07 link exist.

## Stage 4 - Architecture and CLI owners

### Tasks

- [x] t16: In [02 Module Map](../../prd/02-architecture-overview.md#module-map), state the domain ownership rule: one package at `toolkits/buildos/`, one `buildos` CLI, each domain a separate part with its own scope contract exposed as `buildos <domain>`, the package boundary does not merge domain boundaries, cross-domain calls use in-package interfaces and never subprocesses, and a domain gains no unrelated command (16-01, 16-03, 14-02, 14-03, 18-02). Add the short rule from 16-02: identify the owning domain and read its scope contract before adding logic; plan a new domain when none owns it; keep scripts thin.
- [x] t17: Add a domain table to 02 `## Module Map`, reconciled with the domain table in [20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface): every domain in 20 appears, including entities, `init`, `validate`, and the `0.2.0` commands, and no row says "Planned `buildos-config`" (16-04).
- [x] t18: Move the six-step procedure detail of 16-02 into `docs/assets/maintainer/buildos-toolkit-cli-development.md`. Leave its legacy links for P4.
- [x] t19: In [02 Configuration Surfaces](../../prd/02-architecture-overview.md#configuration-surfaces), replace the statement that `env`/`for` frontmatter tags scope artifacts with the current rule: `systems`, `environments`, and `owners` list fields of configured IDs, resolved through `instance.yaml`, as defined in PRD 13 (13-07).
- [x] t20: In 02 `## Requirement History`, copy the PRD 16 `### 2026-11-23 — W1 R7` entry unchanged, then add the two W1 R8 entries for 02 from the plan table.
- [x] t21: In [20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package), add the local-only rule: the CLI makes no network calls; the only exceptions are the `npx` package fetch and the Make Docs setup that the user chooses; any new network call needs an accepted design and an opt-in flag (14-06). In 20 `## Command Surface`, link 02 `## Module Map` for domain ownership. Add `## Requirement History` to PRD 20 before `## Source Anchors` with the 20 entry from the plan table.

### Acceptance criteria

- B8: Every domain in the PRD 20 `## Command Surface` domain table has a row in the PRD 02 `## Module Map` domain table, and the 02 table has no "Planned" row for a domain that 20 lists.
- B9: PRD 20 `## Runtime and Package` states the no-network rule with exactly the two named exceptions and the design-plus-flag condition.
- B10: PRD 02 `## Configuration Surfaces` no longer states that `env` or `for` tags scope artifacts.

### Dependencies

- Stage 2 complete.

## Stage 5 - Config owner

### Tasks

- [x] t22: Find out whether the scoped-field migration has landed. Search `system/`, `system/playbooks/`, and `system/.os/data/` frontmatter and rows for `env`, `for`, `envs`, `target_systems`, and the sentinel `both`, and read how `system/.os/scripts/validate_config.py` treats them. Record the result under `## Owner Decisions` in `evidence.md`.
- [x] t23: Restructure `docs/prd/13-adopter-owned-config-surface.md` to the [PRD 13 restructure spec](../../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/01-prd-authority-maintenance.md#prd-13-restructure-spec). Keep the filename, the H1, and the exact `## Contracts and Data` heading.
- [x] t24: Write `### buildos validate checks` under `## Contracts and Data`. Read `system/.os/scripts/validate_config.py` and list each check it makes, and no other: config file and schema, ID uniqueness and slug format, `environments[].systems` and `defaults.*` references, scoped frontmatter and data references, frontmatter hygiene, and entity record hygiene (lifecycle values, `source_anchor`, `doc_anchor`). Make the frontmatter hygiene rule unconditional only if t22 found the migration landed. Link [20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) once for the command itself.
- [x] t25: Delete `## Change Type`, the `## Capability Addition or Enhancement` and `## Integration Impact` headings, `## Affected Baseline Docs`, `## Required Baseline Annotations`, and every `### Change Notes`, after their current text is placed. Add the W1 R8 entries for 13 from the plan table after the existing W1 R7 entry.
- [x] t26: Repair every link that uses a removed PRD 13 anchor. Search the repository for `13-adopter-owned-config-surface.md#`. Today the W1 R7 file `07-skills-and-validation.md` links `#capability-addition-or-enhancement`; point it at `#contracts-and-data`.

### Acceptance criteria

- B11: PRD 13 has the subsystem sections in the order of B2, keeps its filename and H1, and has none of the five retired headings or a `### Change Notes` section.
- B12: Each check in `validate_config.py` appears once in `### buildos validate checks`, and the list has no check the script does not make. `evidence.md` lists the script's checks beside the PRD lines.
- B13: No link in the repository targets an anchor that PRD 13 no longer has.

### Dependencies

- Stage 3 complete, so PRD 08 states the lifecycle rules the hygiene checks enforce.

## Stage 6 - Receiving items in 09, 10, 11, and 04

### Tasks

- [x] t27: In [09 Contracts and Data](../../prd/09-playbooks.md#contracts-and-data), state that a playbook target that names a losing entity ID stays auditable and resolves to the terminal canonical ID when used (17-40), linking PRD 17.
- [x] t28: In [10 Contracts and Data](../../prd/10-discovery-runs-and-qualification.md#contracts-and-data), state that discovery stores canonical targets and run links, keeps requested IDs and chains, and leaves authored rows and history unchanged (17-41). In 10 `## Component and Capability Map`, name `buildos discovery run` and `buildos discovery qualify`, matching [20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) (18-15).
- [x] t29: In [11 Contracts and Data](../../prd/11-flow-c-integration.md#contracts-and-data), state that design promotion resolves a requested finding ID to a terminal `qualified` finding, reports requested ID, canonical ID, and chain, and writes the back-reference only to the canonical finding (17-42).
- [x] t30: In [04 Terms](../../prd/04-glossary.md), add `systems`, `environments`, and `owners` (13-05). In the Notes column, replace the PRD 15 and PRD 17 file paths with the owner names "PRD 08" and "PRD 17" (15-09).

### Acceptance criteria

- B14: PRDs 09, 10, and 11 state the rules of t27 to t29 in their section bodies, not only in a `### Change Notes` bullet.
- B15: PRD 04 defines `systems`, `environments`, and `owners`, and its Notes column names no `15-` or `17-` file path.

### Dependencies

- Stage 2 complete.

## Stage 7 - Review and commit

### Tasks

- [x] t31: Run the validator and record the counts under `## Validator Counts`. Run `make-docs project path-hygiene validate`. Run a relative-link and anchor check over every changed file and record the result.
- [x] t32: An independent reviewer reviews the phase diff against the plan, design, and inventory before commit. The reviewer re-runs t31, reads every changed PRD section in full, checks rows C-01 to C-40 of the plan matrix against the text, and records a pass or findings under `## Phase Reviews`. The implementer fixes each finding and the reviewer rechecks it.
- [x] t33: Commit the phase with the subject `docs: [W1 R8 P1] PRD Set Authority Cleanup - Owner Text` and a one-paragraph body under `make-docs://system/contract/commit-message-convention.md`.

### Acceptance criteria

- B16: The validator reports `PRD-AUTH-001` 6, `PRD-AUTH-002` 6, `PRD-AUTH-003` 7, `PRD-AUTH-004` 15, `PRD-AUTH-005` 51, total 85, and no finding in a file this phase created.
- B17: Path hygiene reports zero failing findings, and the link check finds no broken link in a changed file.
- B18: `evidence.md` records a reviewer pass for P1 before the commit.

### Dependencies

- Stages 1 to 6 complete.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran: validator 85 findings (6, 6, 7, 15, 51), path hygiene 0 failing findings, link check 0 broken links in the 15 changed files. Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`.
- Performance evidence: None; not needed.
- Human Experience Review: The independent reviewer read every changed PRD section in full and passed P1 in round 3. See [Phase Reviews](./evidence.md#phase-reviews).
- Optional experience handoff: Not applicable; indirect impact.
- Explicit human acceptance gate: None.
- Evidence report: [evidence.md](./evidence.md) holds the P1 counts, owner decisions, flag and check comparisons, placement record, and link check. `## Phase Reviews` records the P1 reviewer pass (round 3).
- Phase / capability status: Done. Implementation (t1–t31), independent review (t32, PASS in round 3), and commit (t33) are complete.
