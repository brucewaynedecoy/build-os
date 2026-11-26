# R5 P3 - Legacy Alias and Installation Migration

## Purpose

Make existing executable names resolve safely to the unified command and prove that an installation can migrate and roll back without changing live project data.

## Dependency Position

- Requires P2 parity for every domain.
- Blocks release packaging because archive and formula layouts must include the proven alias behavior.
- Does not authorize replacement of an installed executable or mutation of live adopter data.

## Scope

- Detect the invoked executable basename and route legacy arguments to the canonical domain.
- Provide `buildos-intake`, `buildos-discovery`, and `buildos-design` aliases or symlinks to `buildos`.
- Print bounded deprecation guidance to stderr without altering successful stdout or JSON output.
- Update repository install and uninstall recipes to install one executable plus compatibility aliases.
- Define the one-stable-minor-release alias window and exact rollback to former binaries.
- Rehearse binary migration independently from project data migration.

## Parallel Workstreams

| Lane | Deliverable | Dependency |
| ---- | ----------- | ---------- |
| Basename routing | Legacy invocation adapter and tests | P2 command registry |
| Install recipes | Source-build install, alias creation, uninstall | Alias form selected |
| Rollback | Snapshot and former-binary restoration procedure | Current install inventory |
| Compatibility QA | Human, JSON, stdout, stderr, and exit parity matrix | Routing adapter and fixtures |
| Documentation | Naive maintainer and operator migration steps | Verified recipes only |

## Deliverables

- One executable with three tested legacy entry names.
- Installation recipes that create and remove aliases deterministically.
- A compatibility matrix for canonical and legacy invocations.
- Rollback evidence that restores former binaries without touching project roots.
- A recorded alias removal target tied to a future release rather than an unbounded promise.

## Validation

- All legacy success and failure fixtures retain their functional behavior and exit status.
- Deprecation text appears only on stderr and names the canonical replacement.
- Install and uninstall checks leave no unexpected executable or broken alias.
- Rollback restores recorded versions, revisions, paths, and checksums.
- Copied project roots remain byte-for-byte unchanged during binary-only migration tests.

## Exit Gate

P4 may start only when clean source-build installation, compatibility invocation, uninstallation, and rollback pass on each supported host family available to the project.
