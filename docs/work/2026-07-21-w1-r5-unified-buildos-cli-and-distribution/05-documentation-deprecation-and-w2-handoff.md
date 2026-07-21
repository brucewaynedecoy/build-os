# Phase 05: Documentation, Deprecation, and W2 Handoff

## Purpose

Make unified installation and command behavior understandable to naive maintainers and end users, close only verified distribution risks, and hand project lifecycle work to W2 inside the same executable.

## Overview

Closeout replaces multi-tool installation guidance with tested `buildos` procedures, documents the temporary aliases and their removal signal, and distinguishes machine-level tool management from project-level BuildOS files and data.

## Source PRD Docs

- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16: Revise Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)

## Stage 1 - Naive-reader guide reconciliation

### Tasks

- [ ] t1: Replace maintainer multi-binary build and installation guidance with the verified unified module, domain package, test, archive, Homebrew, alias, and rollback procedures.
- [ ] t2: Update end-user command guides to lead with canonical `buildos <domain>` commands and explain legacy aliases without requiring architecture knowledge.
- [ ] t3: Document source builds as development-only, public artifacts as signed release outputs, and version/revision/checksum evidence users should retain.
- [ ] t4: State the compatibility alias removal release and show users how to update scripts before that release.
- [ ] t5: Reconcile reciprocal guide links, frontmatter, examples, troubleshooting, safe-stop conditions, and current-versus-future coverage.

### Acceptance criteria

- A novice can install or upgrade the tool through one verified channel and run a first canonical command.
- A maintainer can trace a domain command to its package, contracts, tests, release artifact, and compatibility mapping.
- Documentation never treats legacy aliases as separate product payloads or permanent command names.
- Tool installation is visibly separate from project scaffold synchronization and live-data migration.

### Dependencies

- Phases 01 through 04 supply stable commands, diagnostics, artifacts, formula behavior, and rollback evidence.
- Existing overlapping developer and user guides are inspected before new files are created.

## Stage 2 - Risk, deprecation, and W2 lifecycle handoff

### Tasks

- [ ] t6: Reconcile R-003 against actual archive, checksum, SBOM, signing, Homebrew, clean-install, upgrade, rollback, and uninstall evidence; keep it open for any unverified obligation.
- [ ] t7: Record the exact compatibility-alias removal trigger and assign the follow-up documentation and test cleanup.
- [ ] t8: Finalize the W2 design, plan, PRD, and work handoff for `buildos setup`, `setup backup`, `setup remove`, `update`, and `uninstall` inside the unified executable.
- [ ] t9: Require W2 to distinguish project-level setup removal from machine-level uninstall and package-manager-owned upgrades from archive replacement guidance.
- [ ] t10: Remove every roadmap reference to a public `buildos-lifecycle` binary and require manifest-backed project ownership before automated synchronization.

### Acceptance criteria

- R-003 is closed or revised only from recorded verification evidence.
- Alias removal has a stable release trigger and cannot happen silently.
- W2 has one executable boundary and distinct project and machine scopes.
- No lifecycle behavior is described as implemented during W1 R5 closeout.

### Dependencies

- Stage 1 docs and Phase 04 release evidence are complete.
- W2 planning begins only after packaged command and compatibility behavior are proven.

## Stage 3 - Final validation and closeout

### Tasks

- [ ] t11: Run consolidated module tests, parity suites, alias tests, archive and formula smoke tests, integrity checks, and supported-platform evidence review.
- [ ] t12: Run repository configuration, frontmatter, path, internal-link, and `git diff --check` validation and resolve in-scope failures.
- [ ] t13: Verify PRD 18 lineage, affected baseline annotations, R-003 status, guide coverage, deprecation notes, and W2 handoff traceability.
- [ ] t14: Create the W1 R5 history breadcrumb with actual changes, exact validation outcomes, publication status, alias window, remaining risks, and W2 boundaries.
- [ ] t15: Stage an explicit allowlist and prepare the local commit from the repository convention without pushing, publishing, deploying, or changing adopter projects.

### Acceptance criteria

- All verified release gates and documentation checks pass or the release remains explicitly blocked.
- The history record distinguishes rehearsal from publication and tool installation from project migration.
- The final diff contains no second public binary architecture and no premature W2 implementation claims.
- Remote publication and external installation require separate authorization.

### Dependencies

- Stages 1 and 2 and every prior phase are complete.
- History and local commit occur only after final validation.
