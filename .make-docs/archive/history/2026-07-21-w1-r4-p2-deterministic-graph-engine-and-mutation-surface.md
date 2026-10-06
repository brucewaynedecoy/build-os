---
date: "2026-07-21"
client: "Codex Desktop"
coordinate: "W1 R4 P2"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Seeded the unified source-built BuildOS CLI with deterministic entity resolution, validation, indexing, and reviewed mutation."
---

# W1 R4 P2 Deterministic Graph Engine and Mutation Surface

## Changes

Seed the unified source-built `buildos` CLI with explicit-root entity resolution, compatibility and strict graph validation, deterministic index checking and rebuilding, and dry-run-first reviewed consolidation. Preserve unknown entity fields and file permissions through single-dataset atomic writes, report stable human and JSON results with shared exit codes, and retain canonical writes with an exact recovery command when derived-index rebuilding fails.

The phase adds the temporary Go resolver package for later domain consumers, a thin shipped source-tree wrapper, and automated coverage for graph invariants, reproducible indexes, command parsing, failure paths, write isolation, and the absence of a public entity-specific binary. P2 remains source-build-only; copied-root persona rehearsal is P3, current intake/discovery/design binaries remain separate until W1 R5, and no installed binary or live adopter data changed.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [PRD 17](../../../docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md) | Reconciled implemented graph, index, mutation, recovery, and single-dataset manifest behavior. |
| [PRD 18](../../../docs/prd/18-revise-unified-buildos-cli-and-distribution.md) | Recorded the implemented unified CLI seed while preserving W1 R5 distribution as future work. |
| [P2 backlog](../../../docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md) | Closed only tasks supported by P2 implementation and validation evidence. |
| [Entity consolidation contract](../../../system/.os/contracts/entity-consolidation-contract.md) | Limited each version 1 manifest to one canonical dataset so one apply operation remains atomic. |
| [Toolkits README](../../../toolkits/README.md) | Documented the runnable source-built seed and the continuing legacy-binary transition. |

### Developer

| Path | Description |
| --- | --- |
| [Entity consolidation maintenance](../../../docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md) | Added source-build commands, graph and mutation boundaries, output and exit behavior, and index recovery for naive maintainers. |
| [BuildOS toolkit CLI development](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | Added the verified module build, command, output, test, and failure-handling workflow. |

### User

| Path | Description |
| --- | --- |
| [Curate and resolve duplicate entity records](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | Added an explicit staged-binary workflow for copied-root validation, preview, apply, strict checks, and recovery. |
