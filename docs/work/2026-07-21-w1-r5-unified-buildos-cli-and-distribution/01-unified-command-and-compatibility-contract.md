# Phase 01: Unified Command and Compatibility Contract

## Purpose

Freeze the shared command, layout, output, diagnostic, version, licensing, and legacy-alias rules before moving existing domains.

## Overview

This phase turns the W1 R4 CLI seed into the stable foundation every later migration and release task must reuse. It establishes one executable contract while preserving coherent domain packages.

## Source PRD Docs

- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 16: Revise Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)

## Stage 1 - Shared CLI and package boundaries

### Tasks

- [ ] t1: Freeze canonical mappings for `buildos intake`, `discovery`, `design`, and `entities`, including exact subcommands, arguments, global flags, and help nesting.
- [ ] t2: Define shared root resolution, human-readable output, stable JSON envelopes, diagnostics, exit codes, help behavior, version metadata, and source-revision injection.
- [ ] t3: Define Go interfaces for cross-domain operations and prohibit subprocess calls between domain packages.
- [ ] t4: Define the final `toolkits/buildos/internal/` package boundaries and the migration path that removes W1 R4's temporary `pkg/entities` export and local replacements.

### Acceptance criteria

- Every canonical command and global flag has one unambiguous owner and stable result contract.
- Domain packages remain isolated and cannot bypass the shared CLI, layout, diagnostic, or version policy.
- Cross-domain calls use typed Go interfaces rather than executable invocation.
- W1 R4 behavior has an explicit internalization path with no duplicate graph engine.

### Dependencies

- W1 R4 CLI, entity contracts, and consumer integrations are complete and validated.
- PRD 18 is the effective architecture authority.

## Stage 2 - Compatibility, licensing, and release identity

### Tasks

- [ ] t5: Specify invoked-basename routing for `buildos-intake`, `buildos-discovery`, and `buildos-design`, including argument mappings and stderr-only deprecation guidance.
- [ ] t6: Set the compatibility window to one stable minor-release cycle and define the exact removal release signal and documentation obligations.
- [ ] t7: Add Apache-2.0 licensing and release metadata for one `buildos` product and one semantic version.
- [ ] t8: Define `0.1.0` as the first packaged public version and distinguish signed public artifacts from development source builds.
- [ ] t9: Add contract tests for canonical invocation, legacy basename routing, stdout stability, stderr deprecation output, exit-code parity, help, version, and JSON envelopes.

### Acceptance criteria

- Legacy aliases do not change successful stdout or exit behavior beyond deprecation guidance on stderr.
- Alias lifetime and removal criteria are visible and testable.
- Apache-2.0 and `0.1.0` metadata are consistent across build, help, version, packaging, and documentation surfaces.
- No compatibility contract is created for `buildos-entities` or `buildos-lifecycle` because neither was a shipped public binary.

### Dependencies

- Stage 1 command and output contracts are final.
- Legal and product owners have accepted the PRD 18 licensing and version decisions.
