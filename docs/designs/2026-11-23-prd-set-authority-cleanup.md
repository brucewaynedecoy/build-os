---
title: "PRD Set Authority Cleanup"
kind: "design"
status: "draft"
follow_on:
  route: "change-plan"
  next_prompt: "make-docs://system/prompt/designs-to-plan-change.prompt.md"
  why: "The cleanup restructures, renames, merges, and retires existing PRD owners, and needs a scoped plan and a task backlog that an orchestrated implementer and reviewer can execute."
  coordinate_handoff: "W1 R7 created register item D-005 and its cleanup inventory seed. W1 R8 is the next unused revision of W1; it redoes PRD outputs of several completed W1 phases (R0, R1, R2, R4), which passes the revision Wave test."
lifecycle:
  default_arc: "design -> plan -> PRD -> work -> implementation"
  departure: "plan-to-work-before-prd"
  reason: "The PRD maintenance is itself the deliverable. The work backlog is the task list that executes the PRD maintenance, so it is written from the plan before the PRD changes, and the PRD changes happen inside the backlog phases."
---

# PRD Set Authority Cleanup

> Filename: `2026-11-23-prd-set-authority-cleanup.md`. See `.make-docs/system/contracts/design-contract.md` for naming and structural rules.

## Purpose

This design records how the BuildOS PRD set becomes fully valid product authority. It moves every current requirement out of the legacy editorial PRDs 13–19 into product owners, retires or renames those PRDs, removes stale pointers from the baseline PRDs, and ends with `make-docs run prd authority validate` passing with zero findings. It closes register item `D-005`.

The PRD is the product authority. While legacy PRDs hold stale or misleading text, the next agent cannot tell what is real. This cleanup must not lose, weaken, or silently change any current requirement.

## Context

The [BuildOS Node and TypeScript CLI Rewrite](./2026-11-23-buildos-node-typescript-cli-rewrite.md) and its W1 R7 PRD maintenance made [PRD 20](../prd/20-buildos-cli-and-distribution.md) the owner of the CLI and distribution, marked PRDs 14, 18, and 19 superseded, and added a `## Current Authority Map` to the [PRD index](../prd/00-index.md). It also opened `D-005` in the [register](../prd/03-open-questions-and-risk-register.md), with a cleanup inventory seed, six safety rules, and a gate.

The Make Docs PRD router says the authority validator must exit zero before downstream work uses the PRD set. The owner therefore moved the gate: W1 R7 implementation (P1 onward) starts only after this cleanup closes `D-005`.

A read-only inventory on 2026-11-23 found:

- **93 validator findings**, all tied to PRDs 13–19: 51 `PRD-AUTH-005` (work-backlog links to legacy PRDs, all in the W1 R0, R2, R4, R5, and R6 backlogs), 23 `PRD-AUTH-004` (retired change-record headings inside PRDs 13–19), 7 `PRD-AUTH-003` (editorial kinds in index rows), 6 `PRD-AUTH-001` (editorial filenames, PRDs 14–19), and 6 `PRD-AUTH-002` (editorial titles, PRDs 14–19). PRD 13's filename and title already pass.
- **155 requirement rows** across PRDs 13–19 (13: 20, 14: 15, 15: 10, 16: 12, 17: 48, 18: 22, 19: 28).
- **Three requirements with no current owner:** the entity command flag contract (only in superseded PRD 18), the local-only "no network calls" rule (only in PRD 14), and the entity record hygiene checks of `buildos validate` (only implied by PRD 15 and the Python validator).
- **65 `### Change Notes` bullets in PRDs 01–12** that point at PRDs 13–19. 32 say "Superseded by 19", and PRD 19 was never approved. Some current requirements live only in those bullets.
- **231 filename mentions outside `docs/prd/`** across 75 files (plans 82, work 79, archived history 30, `docs/assets` 20, `toolkits/` 19, designs 1).
- Make Docs allows renaming a PRD file (its index rules name "renamed" as an event). It bans renumbering. Archiving needs an explicit owner request.

The full inventory is carried into the W1 R8 plan as its requirement inventory.

## Human Experience Intent

Impact: `indirect`

Affected humans: BuildOS maintainers and the agents that plan and build BuildOS; reviewers who read the PRD set to understand what BuildOS does; the orchestrated implementer and reviewer agents that will execute W1 R7.

Human goal or effect: A reader can open any active PRD and trust that it states the current product. There is one owner per topic, no dead pointers, and no document that looks current but is not.

Experience promises:

- Every topic in the `## Current Authority Map` points to exactly one active PRD with a product name.
- No active PRD body relies on a change note, banner, or another document to override what it says.
- Every link from plans, work, designs, assets, toolkits, and archived history to a moved or retired PRD resolves, either to the new owner or to the archived copy.
- No current requirement from PRDs 13–19 is lost; each one is traceable from the inventory to its new owner section.

Complexity kept out of the human path:

- Validator codes, inventory row IDs, and archive mechanics stay in the plan and backlog. A PRD reader sees only current requirements and short requirement history.

Evidence required:

- `make-docs run prd authority validate --target-root .` exits zero.
- A requirement trace check: every inventory row ends in a named owner section or an explicit `none` with a reason, and a reviewer samples rows against the owner text.
- A link check over the whole repository, including `.make-docs/archive/`, finds no broken link to a PRD.
- `make-docs project path-hygiene validate` reports zero failing findings.

## Decision

### 1. End state per legacy PRD

| PRD | End state | Receiving owners |
| --- | --- | --- |
| 13 Adopter-Owned Config Surface | Keep the file name and number. Restructure it to the Make Docs subsystem template. Index kind becomes `subsystem`. It owns `buildos validate` and its full check list. | 13 |
| 14 Deterministic toolkit deployment | Move remaining current text out, then archive. | 20 (local-only rule), 02, 06, 07 |
| 15 Extraction draft lifecycle | Fold into owners, then archive. | 08 (draft lifecycle, anchors), 07 (converted-twin `candidate` state), 17 (superseded and archived semantics) |
| 16 Toolkit ownership boundaries | Fold into owners, then archive. | 02 `## Module Map` (domain ownership rule and inventory), linked from 20 `## Command Surface` |
| 17 Entity consolidation and canonical resolution | Rename in place to `17-entity-identity-and-canonical-resolution.md`, H1 "17 Entity Identity and Canonical Resolution", kind `subsystem`. Restructure to the template. It absorbs the entity command flag contract and index path from 18. | 17 |
| 18 Unified CLI and distribution | Move remaining current text out, then archive. | 17 (entity flags, index path), 02, 10 |
| 19 Headless core, CLI, and MCP program | Archive. Nothing current needs to move. Its never-approved capability matrix stays findable in the archive as input for the future MCP revision. | Register `Q-011` and `Q-012` point to the archived copy |

No new PRD number is created. Retired numbers leave gaps; Make Docs does not require contiguous numbers.

### 2. Gaps filled

- **Entity command flags:** PRD 17 states the `buildos entities` flag contract (`--root`, `--mode compat|strict`, `--id`, `--manifest`, `--apply`, `--check`, the dry-run default for `consolidate`, the check default for `rebuild-index`, and the mutual exclusion of `--check` and `--apply`).
- **Local-only rule:** PRD 20 `## Runtime and Package` states: the CLI makes no network calls. The only exceptions are the `npx` package fetch and Make Docs setup, which the user chooses. Any new network call needs an accepted design and an opt-in flag.
- **`buildos validate` checks:** PRD 13 lists the checks. They are exactly what `system/.os/scripts/validate_config.py` checks today (config schema and scoped frontmatter, plus entity record hygiene such as lifecycle values and anchors), which matches the parity rule in PRD 20.

### 3. Entity upgrade steps retired

The side-by-side source-build upgrade steps in PRD 17 assume building and swapping Go binaries. They are retired from current requirements and kept in PRD 17's `## Requirement History`. `buildos init` adoption and the version pin in PRD 20 do this job now. Go-specific rehearsal anchors in PRD 17 are restated for the TypeScript package or moved to history.

### 4. Baseline change notes folded

In PRDs 01–12, every `### Change Notes` bullet that points at PRDs 13–19 is handled this way: any current requirement in it moves into the section body; a material prior contract becomes a `## Requirement History` entry; the rest is deleted. Where the body still states something a note overrides (for example PRD 02 `## Configuration Surfaces` on `env`/`for` tags, and canonical playbook targets that live only in PRD 09's notes), the body is corrected. `### Change Notes` sections that become empty are removed.

### 5. Archive and links

On the owner's explicit request (given 2026-11-23):

- PRDs 14, 15, 16, 18, and 19 move to `.make-docs/archive/prds/2026-11-23/` with their file names unchanged, after their content has moved.
- The finished or superseded work backlogs W1 R0, R2, R4, R5, and R6 move to `.make-docs/archive/work/` with their directory names unchanged. Their text is not edited. This removes the 51 `PRD-AUTH-005` findings without rewriting history.
- Plans stay in `docs/plans/`. Their links to retired PRDs are updated to the new owner or the archived copy. Links in `docs/assets/`, `docs/designs/`, `toolkits/`, and the W1 R7 backlog are updated to the new owners.
- Links in `.make-docs/archive/history/` are repaired only to point at the archived copies, as a recorded reviewed move. Their text is otherwise unchanged.
- Run `make-docs project surface ensure archive` before the first archive move.

### 6. Other items

- `.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` is BuildOS content inside a Make Docs-managed tree. It moves to `docs/assets/maintainer/` and PRD 17 links it there, or it is retired if PRD 17 no longer needs it. The implementer records which.
- Whether PRD 13's scoped-field migration has landed is a fact the implementer checks in the repository. If it has, the rule becomes unconditional; if not, the condition stays.
- W2 lifecycle remnants and upgrade or rollback smoke tests need no PRD owner until the W2 design; `R-003` tracks them.
- A new register question records open domain-ownership decisions for playbooks, data and extraction, and stage automation, which `D-002` used to carry.

### 7. Order of work and safety

The order follows the `D-005` safety rules:

1. Write owner text first: PRD 17 (renamed), 08, 07, 02, 09, 10, 11, 13, and 20.
2. Fold the baseline change notes in 01–12.
3. Add requirement history entries in the receiving owners.
4. Update the register: new domain-ownership question, `Q-001`, `Q-011`, `Q-012`, `R-004`, and `D-005`.
5. Run the requirement trace check. Stop if any inventory row has no owner.
6. Rename 17. Archive 14, 15, 16, 18, 19 and the five backlogs.
7. Update links everywhere, then the index Document Map, Reading Order, and Audience Paths, and the `## Current Authority Map` last.
8. Run the validator, path hygiene, and a full link check. Close `D-005`.
9. Update the W1 R7 plan, backlog, and register to record that W1 R8 satisfies the `D-005` prerequisite for P1.

### 8. Execution model

The cleanup is executed by an orchestrated implementer agent and a separate reviewer agent, with one review per phase before its commit. The planning chat that wrote this design does not execute it. The owner approves archive moves through this design; no other owner gate is expected unless the trace check finds a requirement with no clear owner.

## Alternatives Considered

**Create new product PRDs (21+) for entities and config.** Rejected. Both subjects already have a PRD number. Renaming 17 in place and restructuring 13 give the same clarity without a second identity or a gap.

**Keep legacy PRDs as superseded stubs with product names.** Rejected. Every root file in `docs/prd/` is active authority under Make Docs; a stub that holds no current requirement would mislead.

**Delete retired PRDs instead of archiving.** Rejected. Archived history records link to them and must not be rewritten. Archiving keeps those links resolvable.

**Edit links inside the finished backlogs, or move them under a provenance heading.** Rejected. Both rewrite historical records. Archiving the backlogs keeps them unchanged.

**Start W1 R7 P1 before the cleanup, with a recorded exception.** Rejected by the owner. The PRD router requires a passing validator before downstream work, and the cleanup is short documentation work.

**Fold entities into PRD 08.** Rejected. PRD 17 is large and coherent; folding it would bury it inside the data PRD.

## Consequences

- W1 R7 implementation waits for this cleanup. The cleanup is documentation work only.
- PRD numbers 14, 15, 16, 18, and 19 become gaps. Readers find them through the archive and the index's authority map.
- Five backlogs leave `docs/work/`. Their plans stay, so lineage remains readable.
- Many files change links. A full-repository link check is required, not a sample.
- PRD 17 anchors change because its editorial headings go. The W1 R7 backlog and PRD 20 links to PRD 17 must be updated in the same change set.
- After the cleanup, every new PRD change must keep the validator at zero.

## Design Lineage

- Update Mode: `new-doc-related`
- Prior Design Docs: [BuildOS Node and TypeScript CLI Rewrite](./2026-11-23-buildos-node-typescript-cli-rewrite.md), [Entity Consolidation and Canonical Resolution](./2026-07-21-entity-consolidation-and-canonical-resolution.md), [Adopter-Owned Config Surface](./2026-06-03-adopter-owned-config-surface.md)
- Reason: The rewrite design created `D-005` and its handoff. This design settles how the legacy change-record PRDs from earlier designs become product-named authority.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](make-docs://system/prompt/designs-to-plan-change.prompt.md). Read `make-docs://system/prompt/designs-to-plan-change.prompt.md` with `make-docs resource read`.
- Why: The cleanup restructures, renames, merges, and retires existing PRD owners and needs a plan plus a task backlog for orchestrated execution.
- Coordinate Handoff: W1 R7 opened `D-005`. W1 R8 is the next unused revision of W1. It redoes the PRD outputs of several completed W1 phases (R0, R1, R2, R4), which passes the revision Wave test. W1 R7 P1 waits for W1 R8 to close `D-005`.
