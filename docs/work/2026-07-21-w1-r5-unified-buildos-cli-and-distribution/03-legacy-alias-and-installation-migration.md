# Phase 03: Legacy Alias and Installation Migration

## Purpose

Make existing executable names route safely to the unified binary during the promised compatibility window and prove reversible installation migration.

## Overview

The canonical install contains one executable plus compatibility aliases or symlinks. Invoked-basename routing preserves old command behavior while making deprecation visible and rollback explicit.

## Source PRD Docs

- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16: Revise Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)

## Stage 1 - Legacy invocation routing

### Tasks

- [ ] t1: Implement invoked-basename detection and exact legacy argument mappings for intake, discovery, and design.
- [ ] t2: Emit the canonical replacement command and removal window to stderr without changing successful stdout, structured output, or exit behavior.
- [ ] t3: Update the `justfile` and installation tests to place one `buildos` executable plus the required aliases or symlinks.
- [ ] t4: Add alias tests for help, version, success, validation failures, malformed arguments, JSON output, and paths containing spaces.

### Acceptance criteria

- Every supported legacy invocation reaches the same domain implementation as its canonical command.
- Deprecation guidance is deterministic and does not corrupt stdout automation.
- Installation creates no duplicate domain executable payloads.
- Unsupported or ambiguous legacy arguments fail with an actionable canonical replacement.

### Dependencies

- Phase 02 parity suites pass for every migrated domain.
- Phase 01 compatibility mappings are unchanged or explicitly reconciled before code edits.

## Stage 2 - Installation transition and rollback

### Tasks

- [ ] t5: Define a staging install that records old and new paths, versions, revisions, checksums, alias targets, and rollback locations.
- [ ] t6: Rehearse replacement of the former binaries with the unified executable and aliases without mutating adopter project data.
- [ ] t7: Exercise canonical and legacy smoke tests from the staged install and verify executable ownership and path precedence.
- [ ] t8: Restore the former independent binaries and prove legacy commands return to their pre-migration identities and behavior.
- [ ] t9: Document safe-stop conditions for path ambiguity, alias collisions, checksum drift, permission failures, and mixed-version installs.

### Acceptance criteria

- Installation migration and data migration remain separate approvals and procedures.
- A staged install can move forward and roll back without altering adopter-owned project files.
- Path and alias ownership are observable before any machine-level replacement.
- The former binaries remain recoverable throughout the compatibility rehearsal.

### Dependencies

- Stage 1 aliases pass command-level tests.
- Operator-supplied install paths and rollback storage are explicit and recoverable.
