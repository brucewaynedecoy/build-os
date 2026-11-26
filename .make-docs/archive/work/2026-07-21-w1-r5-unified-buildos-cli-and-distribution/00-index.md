# Unified BuildOS CLI and Distribution Delta Backlog

> **Execution status:** Superseded for execution. The current successor is [W1 R7](../../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md). The intermediate [W1 R6 candidate backlog](../2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md) is also superseded.
> W1 R5 was not executed and is retained in place as historical and compatibility evidence.
> Do not execute this backlog or any of its phase files.

## Purpose

Provide the dependency-ordered W1 R5 implementation backlog for consolidating the current Go toolkits into one modular `buildos` executable, preserving existing commands through temporary aliases, and releasing BuildOS `0.1.0` through verified archives and Homebrew.

This backlog implements [PRD 18](../../prds/2026-11-23/18-revise-unified-buildos-cli-and-distribution.md) under the [W1 R5 plan](../../../../docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md). It revises the distribution boundary established by [PRD 14](../../prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md) and [PRD 16](../../prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md) without weakening their deterministic, domain-ownership, or wrapper boundaries.

## Phase Map

| Phase | Work file | Outcome | Entry dependency |
| --- | --- | --- | --- |
| 01 | [Unified Command and Compatibility Contract](./01-unified-command-and-compatibility-contract.md) | Shared CLI, layout, diagnostics, version, licensing, and compatibility behavior are frozen before migration. | Completed W1 R4 and reconciled PRD 18 |
| 02 | [Domain Migration](./02-domain-migration.md) | Intake, discovery, design, and entities run as isolated domains inside one Go module with parity evidence. | Phase 01 |
| 03 | [Legacy Alias and Installation Migration](./03-legacy-alias-and-installation-migration.md) | Old executable names route to the same binary for one stable minor cycle with tested rollback. | Phase 02 |
| 04 | [Packaging and Release Hardening](./04-packaging-and-release-hardening.md) | Cross-platform archives, checksums, SBOMs, attestations, and Homebrew install paths are release-ready. | Phase 03 |
| 05 | [Documentation, Deprecation, and W2 Handoff](./05-documentation-deprecation-and-w2-handoff.md) | Naive-reader docs, risk closeout, alias removal criteria, and the in-executable lifecycle handoff are authoritative. | Phases 01 through 04 |

## Usage Notes

- Execute phases in dependency order; parallelize only disjoint tasks whose input contracts are already frozen.
- Task IDs are phase-local. Reference work as `w1 r5 pN tN`.
- All tasks are open until their stage acceptance criteria and phase validation pass.
- `buildos <domain>` is the canonical public surface. Do not add new public domain binaries.
- Compatibility aliases exist only for already shipped `buildos-intake`, `buildos-discovery`, and `buildos-design` names and remain for one stable minor-release cycle.
- W1 R5 does not implement project setup, synchronization, backup, removal, update, or machine uninstall. Those are W2 domains inside the same executable; no `buildos-lifecycle` binary is planned.
- Public release requires signed artifacts and clean installation evidence. Unsigned source builds remain development-only.
- No task in this backlog authorizes publishing, replacing an installed binary, migrating adopter data, or pushing repository changes without separate approval.

## Change History

### 2026-11-23 — W1 R7

- Kind: `revision-wave`
- Affected scope: W1 R5 backlog, phases 01–05
- Previous scope: One Go module and executable for intake, discovery, design, and entities, with bounded legacy aliases and a `0.1.0` release from signed archives and Homebrew.
- Replacement scope: [W1 R7](../../../../docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md) ports the same domains to one Node.js and TypeScript CLI, shipped as the npm package `@brucewaynedecoy/buildos`. The shared command contract, legacy names, and parity rules carry forward. Archives, Homebrew, and signing keys are withdrawn. W1 R5 stays unexecuted and is kept in place as historical evidence.
- Rationale: Adopters run BuildOS through chat-app agents that cannot easily install native binaries. npm delivery and one stack with Make Docs now outweigh the measured native-runtime advantages of Go.
- PRD decision: `update-existing`
- Owner approval: Owner decision in the 2026-11-23 design interview for the rewrite design.
- Source: [BuildOS Node and TypeScript CLI Rewrite design](../../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)
