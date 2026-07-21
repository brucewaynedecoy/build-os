---
date: "2026-07-21"
client: "Codex Desktop"
coordinate: "W1 R4 P5"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Closed W1 R4 with naive-reader guidance, reconciled product contracts, and validated source-build release evidence."
---

# W1 R4 P5 Naive-Reader Documentation and Release Evidence

## Changes

Close the W1 R4 source-build implementation with naive-reader maintainer and operator procedures, reconcile the authoritative PRDs and open deployed-instance risk, and record passing code, copied-root, data, documentation, link, and path validation without deploying binaries or changing live data.

Maintainer guidance now explains the unified module and temporary shared-package boundary,
the still-separate discovery and design executables,
canonical data and derived-index ownership,
the compatibility-to-strict workflow,
atomic writes,
exit-code-specific recovery,
and the tests required before a source-built binary can be considered for deployment.
No public `buildos-entities` binary exists.

Operator guidance now provides a novice-executable source build and copied-root rehearsal.
It separates proposal-only review,
dry-run preview,
explicit apply,
strict validation,
index recovery,
snapshot rollback,
installed binary routing,
and live-data migration.
It also distinguishes current W1 R4 behavior from future W1 R5 package distribution and W2 project lifecycle automation.
W1 R4 automates exact identity reuse only for personas;
non-persona identity adapters remain deferred and their candidate matches remain review-only.

PRD 17 and PRD 18 record W1 R4 source completion without claiming packaged distribution.
R-004 remains open because the verified binary has not been deployed to an adopter environment and no live redirect-bearing data has been migrated.
Those two actions require separate operator approvals and adopter-root evidence.

## Validation

- `env GOCACHE=/tmp/buildos-w1r4-p5-just-cache just test-buildos` passed the unified CLI, entity, discovery, and design suites.
- `go test -race ./...` and `go vet ./...` passed independently in `toolkits/buildos/`, `toolkits/buildos-discovery/`, and `toolkits/buildos-design/` with isolated temporary caches.
- `go test ./internal/cli -run '^TestPersonaCopiedRootRehearsal$' -count=1 -v` passed compatibility assessment, preview, apply, strict validation, replay, conflict refusal, failure, and rollback coverage.
- A staged `buildos` source build accepted injected version and revision metadata, and `buildos version --json` returned the shared envelope.
- `python3 system/.os/scripts/validate_config.py --self-test` and the full system validation passed configuration, frontmatter, and entity-data hygiene.
- `python3 .make-docs/scripts/check_path_hygiene.py --self-test` and the full repository audit passed with 70 checked files and no errors.
- Incremental documentation indexing, touched-file backlink checks, and touched-file broken-link checks passed after the fixture directory link was made file-specific.
- `git diff --check` passed before staging.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/00-index.md](../../prd/00-index.md) | Added explicit PRD 17 and PRD 18 audience routing and reciprocal backlinks. |
| [docs/prd/03-open-questions-and-risk-register.md](../../prd/03-open-questions-and-risk-register.md) | Kept R-004 open while recording completed source evidence and the remaining deployment and migration gates. |
| [docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md) | Recorded W1 R4 source implementation and validation completion. |
| [docs/prd/18-revise-unified-buildos-cli-and-distribution.md](../../prd/18-revise-unified-buildos-cli-and-distribution.md) | Preserved the W1 R5 packaging and W2 lifecycle boundaries after the W1 R4 seed. |
| [docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md](../../work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md) | Reconciled source lineage and marked only evidenced P5 tasks complete. |
| [system/.os/contracts/entity-consolidation-contract.md](../../../system/.os/contracts/entity-consolidation-contract.md) | Linked the normative fixture corpus through its indexed README. |

### Developer

| Path | Description |
| --- | --- |
| [docs/guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Documented the current unified CLI seed, temporary package sharing, failure semantics, and release gates. |
| [docs/guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Reconciled canonical-data, index, integration, and source-build maintenance procedures. |
| [docs/guides/developer/operating-layer-entities-consolidation-and-resolution.md](../../guides/developer/operating-layer-entities-consolidation-and-resolution.md) | Added a naive-maintainer workflow, test matrix, recovery guidance, and explicit future-coverage boundary. |

### User

| Path | Description |
| --- | --- |
| [docs/guides/user/entities-consolidation-curate-and-resolve-records.md](../../guides/user/entities-consolidation-curate-and-resolve-records.md) | Added the complete copied-root rehearsal, hard stops, rollback, and approval boundaries. |
| [docs/guides/user/validate-system-data-and-indexes.md](../../guides/user/validate-system-data-and-indexes.md) | Reconciled current entity validation and derived-index recovery behavior. |
| [docs/guides/user/understand-workspace-artifacts.md](../../guides/user/understand-workspace-artifacts.md) | Distinguished canonical rows, derived indexes, workspace evidence, and preserved historical references. |
| [docs/guides/user/convert-source-material-with-buildos-intake.md](../../guides/user/convert-source-material-with-buildos-intake.md) | Clarified intake ownership and the absence of a current user-facing extraction writer. |
