# Phase 03: Intake / Conversion (Pillar 1)

## Purpose

This phase delivers deterministic, tool-first conversion of unstructured sources into clean text/CSV twins through the packaged `buildos-intake` Go CLI, with no structuring at the conversion step.

## Overview

Implement `buildos-intake` under `toolkits/buildos-intake/` as the durable converter and reference-index toolkit. The CLI must run entirely locally, prefer the Go standard library, and require explicit README rationale, license notes, and packaging review for any third-party or native dependency. `system/.os/scripts/` may provide thin wrappers or command documentation, but it must not duplicate converter or index logic.

Structuring remains deferred to extraction (Phase 04). Converted twins live under `system/assets/<source-slug>/...` per the converted-source contract, and `system/.os/indexes/references.json` remains derived and rebuildable.

## Source PRD Docs

- [07 Intake & Conversion](../../prd/07-intake-and-conversion.md)
- [14 Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - CLI Contract and Go Toolkit Skeleton

### Tasks

- [ ] t1: Add a Go module and source layout under `toolkits/buildos-intake/` for the `buildos-intake` binary without adding unrelated toolkits.
- [ ] t2: Define the command surface before implementing converters: `buildos-intake convert` for source-to-twin conversion and `buildos-intake index references` for rebuilding `system/.os/indexes/references.json`.
- [ ] t3: Define common flags for repository-root execution, including source path, output/assets root, explicit type override, force/overwrite behavior, dry-run behavior, and machine-readable error output where practical.
- [ ] t4: Document exit-code and stderr/stdout expectations so wrappers and agents can call the CLI deterministically.
- [ ] t5: Update `toolkits/buildos-intake/README.md` from scaffold-only status to planned command contract, build instructions, dependency posture, and packaging notes.

### Acceptance criteria

- `buildos-intake` has a documented command contract before conversion behavior lands.
- The CLI contract is local-only and does not include service calls or network-dependent behavior.
- The toolkit README states that Go is the implementation language and standard library first is the dependency posture.
- Any proposed third-party/native dependency has a written rationale before implementation uses it.

### Dependencies

- Phase 01 converted-source provenance contract.
- W1 R2 toolkit CLI deployment standard and `toolkits/buildos-intake/` scaffold.

## Stage 2 - Local Conversion Behavior

### Tasks

- [ ] t6: Implement deterministic source hashing and converted-output path derivation from `system/.os/contracts/converted-source-contract.md`.
- [ ] t7: Implement `csv` conversion as a local deterministic normalized CSV twin with provenance frontmatter.
- [ ] t8: Implement `docx` conversion locally using Go standard-library OpenXML/ZIP parsing where viable.
- [ ] t9: Implement `xlsx` conversion locally as one CSV twin per sheet with deterministic sheet slugs.
- [ ] t10: Implement `html` and html-directory conversion with deterministic mirror or stitch rules and enough path context to trace each body segment.
- [ ] t11: Implement `pdf` conversion only through an approved local strategy; if a dependency is required, document the dependency rationale, license, packaging impact, and unsupported/failure behavior before adding it.
- [ ] t12: Emit converted-source frontmatter for every twin: `source`, `sha256`, `converter`, `timestamp`, `type`, and `status`.
- [ ] t13: Ensure conversion never adds extracted IDs, requirement language, capability classifications, findings, or load-plan decisions.

### Acceptance criteria

- Conversion is deterministic for the same `source`, `sha256`, and `converter`.
- Outputs are clean text, Markdown, or CSV twins only.
- Multi-part sources produce deterministic per-part filenames under `system/assets/<source-slug>/`.
- Unsupported or untrusted conversions fail with precise local errors and do not silently call external services.
- Re-conversion detects unchanged source hashes and respects the documented overwrite policy.

### Dependencies

- Stage 1 command contract.
- Converted-source contract.

## Stage 3 - References Index and Thin Wrappers

### Tasks

- [ ] t14: Implement `buildos-intake index references` to rebuild `system/.os/indexes/references.json` from converted-file frontmatter.
- [ ] t15: Define the `references.json` row shape with id, source path, converted path, sha256, type, converter, timestamp, and status.
- [ ] t16: Update `system/.os/indexes/AGENTS.md` with the `buildos-intake index references` rebuild command once the command is implemented.
- [ ] t17: Add only thin `system/.os/scripts/` wrappers or command documentation for `buildos-intake`; wrappers must locate/call the binary and must not perform parsing, conversion, or indexing logic.
- [ ] t18: Update `system/.os/scripts/AGENTS.md` so `.os/scripts/` is described as wrappers/routers for packaged toolkits where applicable.
- [ ] t19: Author or update `system/assets/` routing docs to distinguish source assets and converted twins from make-docs-owned `system/docs/assets/`.

### Acceptance criteria

- `references.json` is fully rebuildable from converted twin frontmatter and remains derived, not canonical.
- `.os/scripts/` wrappers are call-through only and fail clearly when `buildos-intake` is unavailable.
- Router docs direct maintainers to the converted-source contract and toolkit README before changing behavior.
- `system/assets/` is clearly distinguished from `system/docs/assets/`.

### Dependencies

- Stage 2 converted twins and provenance behavior.
- Existing `.os/indexes` and `.os/scripts` routers.

## Stage 4 - Tests, Validation, and Documentation

### Tasks

- [ ] t20: Add Go unit tests and golden fixtures for command parsing, path derivation, hashing, frontmatter emission, and index rebuild behavior.
- [ ] t21: Add converter fixtures for each supported type, keeping fixtures small, local, deterministic, and free of customer data.
- [ ] t22: Add wrapper smoke tests or documented manual commands that prove wrappers call the binary without duplicating logic.
- [ ] t23: Run `go test ./...` and `go build ./...` from `toolkits/buildos-intake/`.
- [ ] t24: Run repository validation: config validator, make-docs path hygiene, touched-doc link check, and `git diff --check`.
- [ ] t25: Update `docs/guides/developer/buildos-toolkit-cli-development.md` with concrete `buildos-intake` examples after commands exist.
- [ ] t26: Add or explicitly decline user-guide coverage based on whether P3 exposes a real adopter-facing CLI workflow.
- [ ] t27: Record PRD reconciliation and closeout history for W1 R0 P3 after implementation validation.

### Acceptance criteria

- Tests cover command surface, deterministic conversion, failure behavior, provenance, and index rebuilds.
- Validation passes without introducing make-docs-owned asset/template/reference edits.
- Documentation names `buildos-intake` as the implementation surface and `.os/scripts/` as wrappers only.
- Closeout records whether any PRD changes beyond PRD 14 were required; if none, it states why.

### Dependencies

- Stages 1-3 complete.
- W1 R2 prerequisite history and plan/work lineage.
