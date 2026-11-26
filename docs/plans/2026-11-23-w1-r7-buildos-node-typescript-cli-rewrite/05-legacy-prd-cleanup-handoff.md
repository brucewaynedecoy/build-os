# 05 Legacy PRD Cleanup Handoff

## Purpose

The PRD is the product authority. If legacy PRDs keep stale or misleading text, the next agent will not know that they do not describe reality. This file sets the through-line from the W1 R7 maintenance to the full cleanup of the legacy editorial PRDs, so the cleanup is prioritized and cannot damage or lose current authority.

## What W1 R7 Does Now

- Keeps the set truthful. Every current requirement that W1 R7 changes is stated inline in a product owner (PRD 20 or an existing baseline owner). Stale Go, Homebrew, Python, and shipped-Make-Docs text found by the discovery pass is corrected where it is normative.
- Marks PRDs 14, 18, and 19 as superseded with a banner and an index status.
- Adds the `## Current Authority Map` to the index, which names one current owner per topic.
- Opens register item `D-005` with the cleanup as its follow-up.
- Seeds the cleanup inventory described below.

## What W1 R7 Does Not Do

It does not rename, renumber, merge, split, delete, or restructure PRDs 13–19, and it does not move their remaining requirements.

## Cleanup Inventory Seed

The assembly worker adds a `### Cleanup inventory` subsection under `D-005` in the register. For each PRD 13–19, it lists every current normative requirement group and its proposed product owner, for example:

| Legacy PRD | Requirement group | Proposed product owner | Status after W1 R7 |
| --- | --- | --- | --- |
| 13 | Adopter config schema, defaults, validation | A product-named config PRD, or 06 | Current in 13 |
| 14 | Toolkit deployment standard | 20 | Superseded by 20 |
| 15 | `draft` lifecycle state for entity and extraction rows | 08 | Current in 15 |
| 16 | Domain ownership boundaries | 02 or 20 | Current in 16 (wording updated) |
| 17 | Entity consolidation, canonical resolution, index, `buildos entities` | A product-named entity PRD, or 08 | Current in 17 |
| 18 | Command and output contract, aliases, distribution | 20 | Superseded by 20 |
| 19 | Core/adapter rules, capability map (never approved) | 20 (rules); MCP revision (capability map) | Superseded; capability map deferred |

The cleanup confirms or corrects these rows. The seed is a starting map, not a decision.

## Cleanup Safety Rules

The cleanup design must adopt these rules:

1. Before any legacy PRD is renamed, merged, or retired, every normative requirement in it is mapped to exactly one product owner, and the owner text is written first.
2. A diff check confirms that no requirement in the inventory is lost: each row ends in a current owner section or an explicit `none` with a reason.
3. Prior contracts move only into `## Requirement History` entries of the new owners.
4. Links from plans, work, designs, and the guide are updated in the same change set, and the index `## Current Authority Map` is updated last.
5. `make-docs run prd authority validate` passes with zero findings at the end.
6. Archived or historical files are not rewritten.

## Priority and Sequencing

- The cleanup starts right after the W1 R7 work backlog is generated. It has its own [design](../../designs/2026-11-23-prd-set-authority-cleanup.md) and runs as W1 R8 ([plan](../2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md), [work](../../work/2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md)). Its coordinate is a W1 revision Wave, as the design resolves it.
- It runs before W1 R7 work P1. W1 R7 P1, and so every later phase, waits until the cleanup is complete and `D-005` is closed.
- The reason: the Make Docs PRD router requires `make-docs run prd authority validate` to exit zero before downstream work uses the PRD set. The public package must also ship on a clean, fully valid PRD set.
- If the cleanup finds that a W1 R7 PRD change was wrong or incomplete, it records the fix in the owning PRD's requirement history and notifies the W1 R7 backlog through its `## Change History`.
