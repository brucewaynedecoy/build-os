# Phase 01: Lineage and PRD Scope

## Purpose

Set the product-documentation and execution scope for the prompt-pack implementation before any prompt directories are rewritten or created.

## Scope

This phase covers coordinate confirmation, PRD change classification, baseline annotation targets, guide-coverage decisions, and the work-backlog shape for execution. It does not author the prompt packs themselves.

## Workstreams

| Workstream | Output | Notes |
| --- | --- | --- |
| Coordinate confirmation | W1 R3 rationale in the work backlog and history record | Keep W1 lineage because the source design revises stage automation. |
| PRD change planning | planned `17-revise-flow-automation-prompt-packs.md` content outline | Create during execution, not in this plan-generation turn. |
| Baseline annotation review | list of baseline docs that need `### Change Notes` backlinks | Start with PRD 12; annotate PRD 11 or flow PRDs only on material impact. |
| Guide coverage review | `developer`, `user`, `both`, `update-existing`, `link-only`, or `none` outcome | Prompt-pack operation may be maintainer-facing first and adopter-facing only after promotion into `system/`. |
| Work backlog scaffold | downstream `docs/work/2026-06-10-w1-r3-flow-automation-prompt-packs/` scope | Do not generate work files until plan approval. |

## Concurrency

This phase can use read-only exploration in parallel: one worker reviews active PRDs, one reviews current `agent_processes/`, and one reviews guides for overlap. The coordinator should merge findings and fix the final PRD and guide scope.

## Blockers

- If another PRD change doc is added before execution, renumber the expected PRD change doc from `17` to the next available number.
- If the user decides prompt packs should ship immediately under `system/`, this plan must be revised because the guide and validation scope changes materially.
- If the copied Flow C material is removed before execution, rebuild Flow C from `USE_CASES_TESTING.md` and repo contracts rather than depending on the copied starter.

## Validation

- Confirm the active PRD index still lists PRD `12` as the stage-automation baseline.
- Confirm no newer W1 revision has occupied `r3`.
- Confirm the selected PRD and guide coverage outcomes are recorded in the eventual history record.
- Refresh `jdocmunch` after PRD or guide edits during implementation.
