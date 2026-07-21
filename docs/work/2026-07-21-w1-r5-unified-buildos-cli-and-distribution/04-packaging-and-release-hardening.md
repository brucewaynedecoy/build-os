# Phase 04: Packaging and Release Hardening

## Purpose

Produce verifiable BuildOS `0.1.0` archives and a Homebrew formula only after installation, upgrade, rollback, and clean-machine behavior are proven.

## Overview

Public distribution consists of one versioned executable, cross-platform archives, a SHA-256 manifest, CycloneDX JSON SBOMs, signed provenance or attestations, and a checksum-verifying Homebrew formula.

## Source PRD Docs

- [PRD 18: Revise Unified BuildOS CLI and Distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- [PRD 14: Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [PRD 03: Open Questions and Risk Register](../../prd/03-open-questions-and-risk-register.md)

## Stage 1 - Reproducible artifact pipeline

### Tasks

- [ ] t1: Define the supported macOS, Linux, and Windows AMD64 and ARM64 target matrix and explicit exceptions.
- [ ] t2: Build versioned archives with injected `0.1.0` version and source revision, stable filenames, required license files, and no compatibility-alias payload duplication.
- [ ] t3: Generate one SHA-256 checksum manifest and one CycloneDX JSON SBOM per release policy, then validate archive contents against them.
- [ ] t4: Produce and verify signed provenance or attestations for every public artifact.
- [ ] t5: Add release-pipeline failure tests for missing targets, unexpected files, checksum mismatch, version drift, incomplete SBOMs, and failed signature verification.

### Acceptance criteria

- Every supported artifact reports `0.1.0` and the intended source revision.
- Checksums, SBOMs, and attestations cover exactly the published files.
- Archive contents are license-complete, minimal, and installable without a source checkout.
- A failed integrity or provenance check blocks publication.

### Dependencies

- Phase 03 unified installation and rollback behavior is proven.
- Release signing authority and supported target policy are available.

## Stage 2 - Archive and Homebrew release rehearsal

### Tasks

- [ ] t6: Rehearse clean archive installation, canonical commands, compatibility aliases, upgrade from the staged legacy install, rollback, and removal on supported targets.
- [ ] t7: Create a Homebrew formula that selects the correct archive, verifies its checksum, installs one executable plus required aliases, and exposes canonical version output.
- [ ] t8: Rehearse Homebrew install, upgrade, rollback or pin guidance, uninstall, and alias cleanup without changing project data.
- [ ] t9: Run clean-machine smoke tests for help, version, every domain's representative success and failure command, JSON envelopes, and no-network runtime behavior.
- [ ] t10: Prepare versioned release notes and compatibility notes that state the alias window, source-build status, and explicit project-data migration boundary.

### Acceptance criteria

- Archive and formula installs pass on the supported matrix or have documented blocking exceptions.
- Homebrew verifies the published checksum before installation.
- Upgrade and uninstall affect tool installation only and never imply project scaffold or data changes.
- Publication remains blocked until clean install, upgrade, rollback, and uninstall evidence is complete.

### Dependencies

- Stage 1 artifacts and verification metadata are complete.
- Publication credentials are not required for rehearsal and are used only after separate release approval.
