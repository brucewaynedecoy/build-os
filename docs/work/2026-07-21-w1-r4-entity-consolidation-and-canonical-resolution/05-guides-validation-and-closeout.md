# Phase 05: Guides, Validation, and Closeout

## Purpose

Make the enhancement executable for naive maintainers and end users, run the full release and migration gates, and record an accurate W1 R4 closeout breadcrumb.

## Overview

Documentation must separate source checkout, installed program files, and adopter-owned data; explain proposal-only audit work; and preserve the two approvals for binary deployment and live-data migration. Closeout occurs only after strict validation, deterministic rebuild, integration, failure, documentation, and rollback checks pass.

## Source PRD Docs

- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 01: Product Overview](../../prd/01-product-overview.md)
- [PRD 02: Architecture Overview](../../prd/02-architecture-overview.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)
- [PRD 04: Glossary](../../prd/04-glossary.md)
- [PRD 08: Data Layer and Extraction](../../prd/08-data-and-extraction.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)

## Stage 1 - Developer guide reconciliation

### Tasks

- [ ] t1: Reconcile `docs/guides/developer/` coverage for redirect invariants, unified CLI ownership, temporary package sharing, graph loading, resolver behavior, compatibility and strict validation, atomic writes, deterministic indexes, failure recovery, fixtures, and integration expectations.
- [ ] t2: Add or update a maintainer workflow that shows where canonical rows, derived indexes, toolkit code, wrappers, tests, and contracts live and how changes propagate safely.
- [ ] t3: Document safe release verification, including invalid-graph diagnostics, index reproducibility, post-write index recovery, and the prohibition on new durable Python logic.
- [ ] t4: Add reciprocal related-guide links and `Future Coverage` for verified downstream dependencies, including W1 R5 packaging and W2 lifecycle automation without describing either as current behavior.

### Acceptance criteria

- A naive maintainer can identify the authoritative data, derived index, unified module, temporary resolver package, validation modes, and recovery path before reading implementation internals.
- Examples preserve provenance and never imply that historical records or references should be deleted or bulk rewritten.
- Guide commands and expected diagnostics match the implemented CLI.

### Dependencies

- Phases 01, 02, and 04 have stable contracts, commands, and error output.
- The guide contract and existing overlapping guides are inspected before creating new files.

## Stage 2 - User guide and migration reconciliation

### Tasks

- [ ] t5: Reconcile `docs/guides/user/` with novice-executable procedures for inventory, proposal review, explicit source build, copied-root setup, compatibility validation, dry-run review, approved apply, strict validation, rollback, and post-migration checks.
- [ ] t6: State prominently that the pre-upgrade prompt is proposal-only and must not change lifecycle states, redirect fields, references, canonical JSONL, indexes, installed binaries, or live data.
- [ ] t7: Document the distinct source checkout, installed binary or wrapper, copied working root, snapshot, and live adopter root using sanitized placeholders.
- [ ] t8: Document hard-stop conditions for ambiguous roots, missing snapshots, invalid graphs, ambiguous mappings, failed writes, failed index rebuilds, or unresolved strict errors.
- [ ] t9: Explain that binary deployment and live-data migration require separate operator approvals and that the checkout's `system/` scaffold must never be copied over installed or adopter-owned data.
- [ ] t10: Explain that W1 R4 supplies only a source-built `buildos entities` seed, while intake, discovery, and design remain separately installed until W1 R5 and upgrade automation remains deferred to W2.

### Acceptance criteria

- A naive operator can follow the copied-root rehearsal without touching installed binaries or live data.
- Every mutating example requires an explicit root and `--apply`; every preceding example is clearly non-writing.
- Troubleshooting identifies recovery commands, evidence to retain, and when to stop rather than improvise.
- No environment-specific absolute paths, live data, or secrets appear in the guides.
- Current source-build behavior is visibly separated from future W1 R5 package distribution and future W2 project lifecycle commands.

### Dependencies

- Phase 03 copied-root evidence and rollback procedure are available.
- Stage 1 terminology and actual CLI output are stable.

## Stage 3 - Validation and history closeout

### Tasks

- [ ] t11: Run unified CLI unit, graph fixture, persona fixture, integration, failure-injection, and deterministic index tests and capture exact commands and outcomes.
- [ ] t12: Run compatibility assessment, approved copied-root persona consolidation, strict validation, representative read/write checks, and rollback verification without touching the live root.
- [ ] t13: Run repository configuration, frontmatter, entity-data, path-hygiene, internal-link, and `git diff --check` validation; route failures back to the owning scope and repeat until clean.
- [ ] t14: Verify PRD 17 and PRD 18 lineage, PRD index routing, R-004 state, baseline backlinks, guide reciprocal links, and delta-backlog traceability without rewriting prior PRDs or backlogs.
- [ ] t15: Create the W1 R4 history breadcrumb with actual changes, validation evidence, developer and user guide decisions, remaining operator approvals, and deferred non-persona identity adapters.
- [ ] t16: Review the final diff against this scoped backlog and prepare the local commit using the repository commit-message convention, excluding unrelated user changes and performing no push, publish, deployment, or live-data migration.

### Acceptance criteria

- Strict validation, deterministic index reproduction, representative canonical read/write behavior, and rollback all pass on controlled data.
- Failure tests cover invalid JSONL, cycles, missing or cross-type targets, inactive terminals, unwritable or interrupted writes, stale indexes, and post-write index failure.
- Documentation and link validators pass with no unresolved in-scope errors.
- The history record describes completed evidence only and leaves separate live binary and data approvals explicit.
- The local commit contains only intended W1 R4 artifacts and implementation; no remote mutation occurs.

### Dependencies

- Phases 01 through 04 and Stages 1 and 2 are complete.
- History creation and local commit are last; neither may precede full validation.
