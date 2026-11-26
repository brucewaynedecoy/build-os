# 02 Archive, Links, and Index

## Purpose

Fix the exact file moves, the owner decision they need, the rule for every link that a move or rename breaks, and the index and register changes. The archive moves follow the owner's explicit request of 2026-11-23, recorded in [design decision 5](../../designs/2026-11-23-prd-set-authority-cleanup.md#5-archive-and-links). Nothing here runs before the requirement trace check in backlog P3 passes.

## Archive Surface

Run `make-docs project surface ensure archive` before the first archive move. `.make-docs/archive/prds/` does not exist yet. It holds dated directories only, never loose files.

## Moves

Every move uses `git mv` so history follows the file. File and directory names stay unchanged, except the PRD 17 rename.

| Kind | Source | Destination |
| --- | --- | --- |
| Rename in place | `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | `docs/prd/17-entity-identity-and-canonical-resolution.md` |
| Archive PRD | `docs/prd/14-revise-deterministic-toolkit-deployment.md` | `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md` |
| Archive PRD | `docs/prd/15-revise-extraction-draft-lifecycle.md` | `.make-docs/archive/prds/2026-11-23/15-revise-extraction-draft-lifecycle.md` |
| Archive PRD | `docs/prd/16-revise-toolkit-ownership-boundaries.md` | `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md` |
| Archive PRD | `docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | `.make-docs/archive/prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md` |
| Archive PRD | `docs/prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` |
| Archive backlog | `docs/work/2026-06-03-w1-r0-build-os-baseline/` | `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/` |
| Archive backlog | `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/` | `.make-docs/archive/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/` |
| Archive backlog | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/` | `.make-docs/archive/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/` |
| Archive backlog | `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/` | `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/` |
| Archive backlog | `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/` | `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/` |
| Move out of a Make Docs-managed tree, if kept (C-15) | `.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md` | `docs/assets/maintainer/pre-upgrade-entity-consolidation-audit.prompt.md` |

The W1 R1 and W1 R7 backlogs stay in `docs/work/`. All plans stay in `docs/plans/`.

## Owner Decision Before The Archive Moves

Design decision 5 says the archived backlogs keep their text unchanged. The design's evidence list also says a link check over the whole repository, including `.make-docs/archive/`, finds no broken link to a PRD. Both cannot hold at once. The archived files move one directory level deeper, or into a directory without their sibling PRDs, so their own relative links break. A count at commit `59e3a36` found 127 relative links inside the five backlogs (109 of them to PRDs) and 78 relative links inside PRDs 14, 15, 16, 18, and 19.

The orchestrator asks the owner to choose before P4 moves any file:

- **A. Repair link targets only, as a recorded reviewed move (recommended).** Inside the archived copies, change only the path part of each broken relative link so it resolves from the new location. Change no other text. This is the same rule the archive router sets for history records, and it keeps the full link check meaningful.
- **B. Leave the archived copies byte-identical.** The link check then excludes links whose source file is under `.make-docs/archive/prds/2026-11-23/` or `.make-docs/archive/work/`, and the evidence report records the excluded count and the reason.

The default, if the owner does not answer, is to stop P4 at its entry gate. The choice is recorded in the backlog `evidence.md` and in the W1 R8 work index `## Change History` if the backlog has been committed.

## Recorded Reviewed Move

Every move and every link repair inside `.make-docs/archive/` is a recorded reviewed move. The implementer records it in the backlog `evidence.md` under `## Recorded Reviewed Moves`: each source and destination path, and for each repaired link the file, the old target, and the new target. The reviewer checks the list against `git diff --stat -M` and the link check before the P4 commit.

## Link-Update Rules

New owner, by retired legacy PRD:

| Retired file | New owner for "current authority" links |
| --- | --- |
| `14-revise-deterministic-toolkit-deployment.md` | [20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package) |
| `15-revise-extraction-draft-lifecycle.md` | [08 Contracts and Data](../../prd/08-data-and-extraction.md#contracts-and-data) |
| `16-revise-toolkit-ownership-boundaries.md` | [02 Module Map](../../prd/02-architecture-overview.md#module-map) |
| `18-revise-unified-buildos-cli-and-distribution.md` | [20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md); entity flags go to `17-entity-identity-and-canonical-resolution.md#entity-commands` |
| `19-revise-build-os-headless-core-cli-and-mcp-program.md` | [20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) for core and adapter rules; the register `Q-011` for the capability map |

Old PRD 17 section to new PRD 17 section, for anchors and cited section names:

| Old section | New section |
| --- | --- |
| `### Non-destructive consolidation` | `### Lifecycle and redirects` |
| `### Terminal canonical resolution` | `### Terminal resolution` |
| `### Deterministic toolkit and index` | `## Component and Capability Map`, `### Entity commands`, `### Atomic writes`, and `### Derived index` |
| `### Compatibility-to-strict migration` | `### Strict and compatibility modes` |
| `### Matching and review policy` | `### Matching and review policy` |
| `### Side-by-side source-build adoption` | `### Adoption and live-root migration safety` |
| `### Acceptance requirements` | `### Acceptance` |
| `## Integration Impact` | `## Integrations` |

Rules per location:

| Location | Links and mentions of PRD 17 | Links to PRD 13 | Links and mentions of PRDs 14, 15, 16, 18, 19 | Links to archived backlogs |
| --- | --- | --- | --- | --- |
| `docs/prd/` (00–13, 20) | New filename and new anchors | Repair `#capability-addition-or-enhancement` and other removed anchors | Removed from bodies by the P2 folding. Closed register items and `## Source Anchors` point at the archived copy | Index `## Source Anchors` point at the archived path |
| `docs/plans/` | New filename | Repair removed anchors | Where the plan cites the PRD as its historical input, the archived copy; where it sends a reader to current authority, the new owner | Archived copy |
| `docs/work/` (W1 R1, W1 R7) | New filename; in the W1 R7 backlog, code-span cites become links in `## Source PRD Docs`, the Human Experience Trace, and Human Experience Outcome lines | Repair removed anchors | New owner; code-span cites of 16 become links to 02 `## Module Map` | Archived copy, including the W1 R7 index links to the W1 R5 and W1 R6 backlogs |
| `docs/designs/` | New filename | — | New owner | Archived copy |
| `docs/assets/` | New filename; links to the moved audit prompt | — | New owner | Archived copy |
| `toolkits/` | New filename | — | New owner | Archived copy |
| `.make-docs/archive/history/` | New filename (17 has no archived copy) | — | Archived copy | Archived copy |
| Archived copies | Per the owner decision above | Per the owner decision | Per the owner decision | Per the owner decision |

Text that is not a link but names a moved file (code spans and plain paths) follows the same rule. Textual "PRD 16" style mentions without a filename are checked by hand in `toolkits/*` README, `AGENTS.md`, and `CLAUDE.md` files, `docs/assets/maintainer/*`, `docs/assets/user/promote-qualified-findings-to-designs.md`, and the two designs named in the [inventory](./04-requirement-inventory.md#3-cross-references-to-prds-13-to-19). They change only where they send a reader to current authority.

The W1 R7 plan files `00-overview.md` and `01-prd-authority-maintenance.md` follow the `docs/plans/` rule. The W1 R7 backlog and PRD 20 are updated in the same phase as the PRD 17 rename.

## Index Changes

Made in P4, in this order, with the `## Current Authority Map` last:

1. `## Purpose`: drop "evolved through active change docs"; describe the set as the current product authority.
2. `## Document Map`: remove the rows for 14, 15, 16, 18, and 19. Set the 13 row kind to `subsystem`. Replace the 17 row with `17-entity-identity-and-canonical-resolution.md`, kind `subsystem`, status `active`, and the focus from the [rename spec](./01-prd-authority-maintenance.md#prd-17-rename-spec). Replace `15` and `16` in every `Related Docs` cell with the receiving owners (`08`, `02`). No row keeps an editorial kind.
3. `## Reading Order`: drop items 7 and 8. Add `13` and `17` after `05`–`12` as config and entities. Add one sentence: numbers 14, 15, 16, 18, and 19 are retired, and their last text is in `.make-docs/archive/prds/2026-11-23/`.
4. `## Source Anchors`: point the W1 R0 and W1 R2 work paths at `.make-docs/archive/work/`; add this plan and the cleanup design.
5. `## Audience Paths`: replace 16 with `02` `## Module Map` and the old 17 link with the new filename. Remove "Do not implement from `14`, `18`, or `19`" and "Treat `14`, `18`, and `19` as history only".
6. `## Current Authority Map` (last): Domain ownership becomes [02 Architecture Overview](../../prd/02-architecture-overview.md#module-map); Entities becomes `17 Entity Identity and Canonical Resolution`; add Data lifecycle as [08 Data Layer and Extraction](../../prd/08-data-and-extraction.md). Remove every "legacy name" note and the sentence about superseded PRDs. Every row links exactly one active product-named PRD per topic, or a named pair where the topic is split by section, as today.

## Register Changes

Made in P3, except the `D-005` closure in P5 and the link updates in P4. New items take the next unused number in their section and never renumber existing items.

| Item | Change | Phase |
| --- | --- | --- |
| New `Q` item, "Domain ownership for playbooks, data and extraction, and stage automation" | `Open`. Issue: no domain owns playbook helpers, data and extraction helpers beyond `extract bulk`, or stage movers. Why it matters, Recommendation, To close, Owner, Phase/gate. Cites 02 `## Module Map` | P3 |
| `Q-001` | Replace "PRD 19 and the Phase 2 capability-map delta carry the approved result" with the current owners. Cite the archived PRD 19 as provenance only | P3 (text), P4 (path) |
| `Q-011` | The PRD 19 capability map and decision inventory are kept at `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` as input to the future MCP revision | P3 (text), P4 (path) |
| `Q-012` | Same archived-copy pointer for the MCP adapter input | P3 (text), P4 (path) |
| `R-003` | Confirm it names the W2 lifecycle commands and the upgrade, rollback, and uninstall smoke tests; add one sentence if not | P3 |
| `R-004` | The live-root migration gate is stated in 17 `### Adoption and live-root migration safety`; "binary cutover" becomes "package version pin" | P3 (text), P4 (link) |
| `D-002` and other closed items that link PRDs 13–19 | Links point at the archived copy or the new owner; outcomes unchanged | P4 |
| `D-005` | `Closed`. `Resolution`: validator exit `0`, trace check complete, links resolve, the W1 R8 backlog and this plan as evidence. The seed `#### Cleanup inventory` table points at [04](./04-requirement-inventory.md) for the final trace | P5 |
