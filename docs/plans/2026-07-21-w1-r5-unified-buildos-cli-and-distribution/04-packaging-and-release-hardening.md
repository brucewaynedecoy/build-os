# R5 P4 - Packaging and Release Hardening

## Purpose

Produce a verifiable `buildos 0.1.0` release candidate through archives and Homebrew, with the supply-chain evidence required for public distribution.

## Dependency Position

- Requires P3's final executable and compatibility alias layout.
- Packaging lanes can run concurrently after the release matrix and artifact naming contract are frozen.
- Public publication is a separate authorization and does not occur merely because release candidates pass.
- Blocks final documentation and R-003 disposition.

## Scope

- Build supported macOS, Linux, and Windows AMD64 or ARM64 artifacts.
- Package the `buildos` executable, license, notices, and platform-appropriate compatibility aliases.
- Generate a SHA-256 checksum manifest and CycloneDX JSON SBOMs.
- Generate signed provenance or attestations for release artifacts.
- Create and test a Homebrew formula that verifies the selected archive checksum.
- Exercise archive and Homebrew install, upgrade, uninstall, rollback, and clean-machine smoke paths.
- Inject semantic version `0.1.0` and exact source revision into packaged binaries.

## Parallel Workstreams

| Lane | Deliverable | Shared input |
| ---- | ----------- | ------------ |
| Build matrix | Platform archives and smoke tests | Version and artifact naming |
| Integrity | Checksum manifest and verification tests | Final archive bytes |
| SBOM | CycloneDX JSON per release artifact or release set | Dependency graph and archive contents |
| Provenance | Signed provenance or attestations | Final artifact identities |
| Homebrew | Formula, checksum verification, install lifecycle tests | macOS archive and checksum |
| Release QA | Clean-machine, upgrade, rollback, and negative tests | All candidate artifacts |

Final signing and integrity metadata depend on immutable archive bytes, so build outputs freeze before those lanes complete.

## Deliverables

- Versioned cross-platform release-candidate archives.
- SHA-256 checksum manifest.
- CycloneDX JSON SBOMs.
- Signed provenance or attestations and verification instructions.
- A checksum-pinned Homebrew formula.
- Installation, upgrade, uninstall, rollback, and clean-machine evidence.

## Validation

- Every packaged binary reports `0.1.0` and the exact source revision.
- Archive contents and executable permissions are correct per platform.
- Checksums fail closed on modified artifacts.
- SBOMs parse and cover the shipped executable dependencies.
- Provenance or attestations verify against the documented identity and artifact digests.
- Homebrew install, upgrade, uninstall, and rollback behavior preserves package-manager ownership.
- Legacy aliases invoke the same installed executable and retain P3 behavior.
- No release candidate mutates project data during installation tests.

## Exit Gate

P5 may start when the release evidence is complete and reviewable. Public release creation still requires explicit authorization, and R-003 may close or narrow only to the extent supported by the verified evidence.
