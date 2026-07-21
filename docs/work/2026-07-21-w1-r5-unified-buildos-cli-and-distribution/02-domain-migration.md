# Phase 02: Domain Migration

## Purpose

Move the existing intake, discovery, design, and entity implementations into isolated packages inside the unified module without changing proven behavior.

## Overview

Parity is the migration gate. Existing source is removed from old modules only after canonical subcommands reproduce fixtures, outputs, files, errors, and exit behavior required by the active product contracts.

## Source PRD Docs

- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [PRD 07: Intake and Conversion](../../prd/07-intake-and-conversion.md)
- [PRD 10: Discovery Runs and Qualification](../../prd/10-discovery-runs-and-qualification.md)
- [PRD 11: Flow C Integration](../../prd/11-flow-c-integration.md)
- [PRD 17: Enhance Entity Consolidation and Canonical Resolution](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)

## Stage 1 - Parallel domain ports

### Tasks

- [ ] t1: Port intake conversion and reference/playbook indexing behind `buildos intake` while preserving converted-source and derived-index contracts.
- [ ] t2: Port discovery run recording and finding qualification behind `buildos discovery` while preserving run, finding, and negative-assertion behavior.
- [ ] t3: Port qualified-finding promotion behind `buildos design` while preserving user gating, design routing, and finding-link updates.
- [ ] t4: Move the entity implementation into `internal/entities`, update consumers to internal interfaces, and remove temporary cross-module `replace` directives and exported-package dependencies.
- [ ] t5: Keep the four domain ports in disjoint packages and integrate them only through the frozen root and interface contracts.

### Acceptance criteria

- Canonical commands exist for every previously shipped operation and every W1 R4 entity operation.
- No domain shells out to the same executable or imports another domain's internal implementation directly.
- The temporary W1 R4 package and local replacement directives are gone.
- Parallel ports do not introduce overlapping ownership or a catch-all package.

### Dependencies

- Phase 01 root contracts and internal package map are frozen.
- Each domain's current fixtures, contracts, and command baselines are captured before movement.

## Stage 2 - Parity and old-module retirement

### Tasks

- [ ] t6: Build parity fixtures comparing legacy and canonical intake outputs, errors, files, ordering, and exit codes.
- [ ] t7: Build equivalent parity fixtures for discovery and design operations, including failure and idempotence paths.
- [ ] t8: Re-run entity graph, mutation, failure-injection, copied-root, and consumer integration suites after internalization.
- [ ] t9: Remove implementation code from old modules only after its parity suite passes and the compatibility router owns the old invocation shape.
- [ ] t10: Run module-boundary, dependency, race, unit, integration, and repository validation across the consolidated module.

### Acceptance criteria

- Canonical commands match required legacy behavior on supported fixtures and failure cases.
- Old source is not deleted before equivalent behavior and rollback evidence exist.
- One module builds and tests without local cross-module replacement directives.
- Entity behavior remains byte-reproducible and copied-root safe after internalization.

### Dependencies

- Stage 1 domain ports compile independently behind the shared interfaces.
- Legacy fixtures remain available until Phase 03 installation rollback is proven.
