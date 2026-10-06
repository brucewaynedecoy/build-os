# Phase Detail: Guides, Validation, and Closeout

## P5 - Naive-Reader Documentation and Release Evidence

Reconcile maintainer and operator documentation around the implemented behavior, prove all product and migration gates, finalize the scoped delta backlog, and record a durable W1 R4 breadcrumb.

## Source Inputs

- Reconciled PRD 17 and affected active baseline docs
- P2 through P4 implemented commands, diagnostics, fixtures, and migration evidence
- Existing `docs/assets/maintainer/` and `docs/assets/user/` coverage discovered under the guide contract
- [Pre-upgrade audit prompt](../../../.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- Repository validation and history-record contracts

## Workstreams

1. Reconcile developer guides for maintainers who need to understand redirect invariants, the unified CLI seed, temporary package sharing, whole-graph validation, atomic mutation, index reproducibility, integration rules, fixtures, failure recovery, and safe release maintenance.
2. Reconcile user guides for operators who need step-by-step pre-upgrade audit, winner review, source build, copied-root rehearsal, compatibility warnings, dry-run review, apply, strict validation, rollback, and separate deployment/migration approvals.
3. Use plain language, explicit prerequisites, expected output, safe-stop conditions, troubleshooting, FAQ coverage, and reciprocal links. Clearly mark the pre-upgrade prompt as proposal-only and never instruct users to copy the checkout's `system/` directory over live data. Distinguish the current W1 R4 source-build-only `buildos entities` posture from the still-separate legacy binaries, future W1 R5 package distribution, and future W2 lifecycle commands.
4. Generate or reconcile the scoped delta backlog under `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/`, preserving phase order and tracing every phase to PRD 17 and affected baseline docs.
5. Run implementation, fixture, failure-injection, copied-root, strict-validation, deterministic-index, documentation, frontmatter, config, path-hygiene, and internal-link checks. Route narrow failures to the owning worker.
6. Create the W1 R4 history record only after gates pass, recording implementation changes, validation commands and outcomes, developer and user guide decisions, remaining operator approvals, and any deferred type adapters.

## Dependencies

- Requires stable behavior and diagnostics from P2 through P4.
- Backlog structure may be generated from P1 but must be reconciled after implementation scope and guide coverage are known.
- History and local commit happen last, after the final diff and validation evidence are complete.

## Acceptance Checks

- A naive maintainer can identify the canonical data source, derived index, unified module owner, temporary shared-package boundary, compatibility/strict distinction, integration contract, and recovery procedure without reading implementation code first.
- A naive operator can audit safely, review a proposed mapping, build and identify the staged `buildos` binary, test only a copied root, understand every approval boundary, and restore the snapshot.
- Guides explicitly distinguish source checkout, installed program files, and adopter-owned data; they use sanitized placeholders rather than environment-specific absolute paths.
- The delta backlog contains an index and ordered phase files with source PRD links, phase-local task IDs, plain-bullet acceptance criteria, and no full-backlog rewrite.
- All tests and documentation checks pass, including `git diff --check` and jdocmunch broken-link validation after reindexing.
- The history breadcrumb reports actual completed scope and validation state, not planned claims, and unresolved live deployment or migration approval remains explicit.

## Execution Notes

Do not publish, push, deploy a binary, or migrate live adopter data as part of closeout. Use the repository's commit-message convention for the final local commit, preserve unrelated user changes, and include only the intended planning, PRD, work, guide, history, contract, implementation, fixture, and validation files that actually belong to this enhancement.
