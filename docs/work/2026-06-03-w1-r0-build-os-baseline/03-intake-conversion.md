# Phase 03: Intake / Conversion (Pillar 1)

## Purpose

Deliver deterministic, local-only intake conversion through the packaged `buildos-intake` Go CLI, with thin wrappers and durable manual-fallback guidance. Conversion produces clean text, Markdown, or CSV twins only; structuring remains deferred to extraction.

## Overview

P3 consumes the W1 R2 toolkit deployment standard. Durable converter and reference-index logic lives under `toolkits/buildos-intake/`; `system/.os/scripts/` is only a wrapper/router surface.

The PDF decision is now locked: no Poppler bundle, no `pdftotext` requirement, no `--pdf-engine pdftotext`, and no rich PDF extraction roadmap. Built-in PDF behavior is limited to rudimentary local text extraction with `github.com/ledongthuc/pdf`. When automated output is inadequate, teams use another local tool, manual conversion, or a capable multimodal agent while following the same converted-source and intake-translation contracts.

## Source PRD Docs

- [07 Intake & Conversion](../../prd/07-intake-and-conversion.md)
- [14 Revise Deterministic Toolkit Deployment](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - CLI Contract and Toolkit Core

### Tasks

- [x] t1: Add the Go module and source layout under `toolkits/buildos-intake/`.
- [x] t2: Implement `buildos-intake convert` and `buildos-intake index references`.
- [x] t3: Add common flags for repo root, source path, assets root, type override, force, dry-run, and references-index output.
- [x] t4: Keep command output predictable for wrappers and agents.
- [x] t5: Update `toolkits/buildos-intake/README.md` with the implemented command contract, build instructions, dependency posture, PDF limits, and packaging notes.

### Acceptance criteria

- `buildos-intake` has a documented, local-only command contract.
- The toolkit README states Go implementation, standard-library-first posture, approved dependencies, and no `pdftotext`/Poppler/OCR path.

### Dependencies

- Phase 01 converted-source contract.
- W1 R2 toolkit CLI deployment standard and `toolkits/buildos-intake/` scaffold.

## Stage 2 - Local Conversion Behavior

### Tasks

- [x] t6: Implement deterministic source hashing and converted-output path derivation.
- [x] t7: Implement CSV conversion as a normalized CSV twin with provenance frontmatter.
- [x] t8: Implement DOCX conversion with local OOXML ZIP/XML parsing.
- [x] t9: Implement XLSX conversion as one CSV twin per worksheet.
- [x] t10: Implement HTML and HTML-directory conversion with `golang.org/x/net/html`.
- [x] t11: Implement minimal PDF text extraction with `github.com/ledongthuc/pdf`.
- [x] t12: Ensure PDF conversion does not call `pdftotext`, Poppler, OCR, external utilities, network services, or service APIs.
- [x] t13: Emit converted-source frontmatter for every twin.
- [x] t14: Keep conversion output free of extracted IDs, requirement language, capability classifications, findings, and load-plan decisions.

### Acceptance criteria

- Outputs are clean text, Markdown, or CSV twins only.
- Multi-part sources produce deterministic per-part filenames under `system/assets/<source-slug>/`.
- Unsupported or untrusted conversions fail with precise local errors and do not silently call external services.
- PDF behavior is minimal and explicitly bounded.

### Dependencies

- Stage 1 command contract.
- Converted-source contract.

## Stage 3 - Contracts, Manual Fallback, Indexes, and Wrappers

### Tasks

- [x] t15: Add `system/.os/contracts/intake-translation-contract.md`.
- [x] t16: Update `converted-source-contract.md` to reference intake translation and side-artifact rules.
- [x] t17: Add `system/playbooks/administrative/manual-intake-conversion.md` for manual and agent-assisted fallback.
- [x] t18: Implement `buildos-intake index references` to rebuild `system/.os/indexes/references.json` from converted twin frontmatter.
- [x] t19: Update `system/.os/indexes/AGENTS.md` with the rebuild command.
- [x] t20: Add `system/.os/scripts/buildos-intake` as a call-through wrapper.
- [x] t21: Update `system/.os/scripts/AGENTS.md` so `.os/scripts/` is a wrapper/router surface.
- [x] t22: Add `system/assets/` routing docs to distinguish converted twins and side artifacts from make-docs-owned assets.

### Acceptance criteria

- Manual fallback guidance is operational and does not live in `system/docs/guides/user/`.
- `references.json` is fully rebuildable from converted twin frontmatter and remains derived.
- `.os/scripts/` wrappers are call-through only and fail clearly when `buildos-intake` is unavailable.

### Dependencies

- Stage 2 converted twins and provenance behavior.
- Existing `.os/indexes` and `.os/scripts` routers.

## Stage 4 - Tests, Validation, and Documentation

### Tasks

- [x] t23: Add Go tests for command-adjacent library behavior: path derivation, hashing, frontmatter emission, conversion, and index rebuild behavior.
- [x] t24: Add small local fixtures for CSV, DOCX, references index, and PDF failure behavior.
- [x] t25: Run `go test ./...` and `go build ./...` from `toolkits/buildos-intake/`.
- [x] t26: Update `docs/guides/developer/buildos-toolkit-cli-development.md` with concrete `buildos-intake` examples and approved dependency boundaries.
- [x] t27: Update PRD/design notes as needed to record no-`pdftotext`, minimal-PDF, and manual fallback decisions.
- [x] t28: Record W1 R0 P3 closeout history after implementation validation.
- [x] t29: Run final repository validation: config validator, make-docs path hygiene, touched-doc link check, and `git diff --check`.

### Acceptance criteria

- Tests cover deterministic conversion, failure behavior, provenance, and index rebuilds.
- Validation passes without introducing make-docs-owned template/reference edits.
- Documentation names `buildos-intake` as the implementation surface and `.os/scripts/` as wrappers only.
- Closeout records the durable PDF and manual-fallback decisions.

### Dependencies

- Stages 1-3 complete.
- W1 R2 prerequisite history and plan/work lineage.
