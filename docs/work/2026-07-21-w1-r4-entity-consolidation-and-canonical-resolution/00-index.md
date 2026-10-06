# Entity Consolidation and Canonical Resolution Delta Backlog

## Purpose

Provide the scoped W1 R4 implementation backlog for non-destructive entity consolidation, terminal canonical resolution, persona-first migration, redirect-aware integrations, and safe side-by-side source-build adoption.

This backlog implements [PRD 17](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md) in the order defined by the [W1 R4 plan](../../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md). It is an additive delta backlog and does not replace or rewrite earlier Build OS backlogs.

Architecture change note: [PRD 18](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
and the [W1 R5 unified CLI plan](../../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md)
supersede the original separate entity-binary boundary.
W1 R4 now seeds `toolkits/buildos/` and implements `buildos entities`;
it creates no public `buildos-entities` binary.
The existing intake,
discovery,
and design binaries remain separate until W1 R5.

## Phase Map

| Phase | Work file | Outcome | Entry dependency |
| --- | --- | --- | --- |
| 01 | [PRD and Contract Alignment](./01-prd-and-contract-alignment.md) | Shipped entity and extraction contracts define redirect, resolution, migration, and toolkit ownership behavior. | Reconciled PRD 17 and active baseline lineage |
| 02 | [Unified CLI Seed, Resolver, and Index](./02-resolver-toolkit-and-index.md) | `buildos entities` provides whole-graph resolution, compatibility and strict validation, safe consolidation, and reproducible index generation. | Phase 01 and the W1 R5 architecture contract |
| 03 | [Persona Pilot and Migration](./03-persona-pilot-and-migration.md) | Reviewed persona fixtures and a copied-root rehearsal prove migration, rollback, and source-build isolation. | Phase 02 |
| 04 | [Read, Write, and Extraction Integration](./04-read-write-and-extraction-integration.md) | Consumers expose original and canonical identities while producers store terminal canonical IDs and preserve review boundaries. | Phases 02 and 03 |
| 05 | [Guides, Validation, and Closeout](./05-guides-validation-and-closeout.md) | Maintainer and operator guidance, full validation gates, and the W1 R4 breadcrumb close the delta safely. | Phases 01 through 04 |

## Usage Notes

- Execute phases in numeric dependency order. Parallelize only tasks with disjoint write scopes and satisfied dependencies.
- Task IDs are phase-local. Reference a task as `w1 r4 pN tN`.
- All tasks are intentionally open. Mark them complete only after their stage acceptance criteria pass.
- Treat the [pre-upgrade audit prompt](../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md) as proposal-only: it may inventory and recommend mappings but must not mutate canonical data.
- Treat the source checkout, installed program files, and adopter-owned data root as separate locations. Never copy the checkout's `system/` scaffold over installed or adopter-owned data.
- Build verification, binary deployment, and live-data migration are separate actions. This repository backlog does not authorize deployment or mutation of a live adopter root.
- Compatibility mode is a temporary read-oriented assessment aid. Strict validation is the release and post-migration gate.
- Preserve losing rows, historical references, and provenance. Do not introduce bulk historical rewrites or automatic probabilistic merges.
- Treat W1 R4 as source-build-only. Homebrew, signed archives, legacy executable aliases, and lifecycle commands belong to W1 R5 or W2 and are not acceptance claims for this backlog.
