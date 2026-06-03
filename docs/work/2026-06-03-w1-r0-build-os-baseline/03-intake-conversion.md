# Phase 03: Intake / Conversion (Pillar 1)

## Purpose

This phase delivers deterministic, tool-first conversion of unstructured sources into clean text/CSV twins, with no structuring at the conversion step.

## Overview

Implement one converter per source type in `.os/scripts/`, emit provenance frontmatter on every twin in `assets/converted/`, and build the derived `references.json` index. Structuring is explicitly deferred to extraction (Phase 04).

## Source PRD Docs

- [07 Intake & Conversion](../../prd/07-intake-and-conversion.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Converters

### Tasks

- [ ] t1: Implement converter scripts in `system/.os/scripts/` for each source type — `docx`, `xlsx`, `pdf`, `html`, html-directory, `csv` — writing md/csv twins into `system/assets/converted/`, mirroring source paths.
- [ ] t2: Emit provenance frontmatter per twin (`source`, `source_sha256`, `converter`, `converted_at`, `type`, `status: converted`) per the converted-source contract.
- [ ] t3: Define conventions for `xlsx` multi-sheet (one CSV per sheet) and html-directory inputs (mirror vs. stitch), documented in the `assets/converted/` router.

### Acceptance criteria

- Conversion is deterministic and adds no structuring — output is a clean text/CSV twin only.
- Re-conversion is detectable via `source_sha256`; one-off agent conversions follow the same provenance contract.

### Dependencies

- Phase 01 (converted-source provenance contract).

## Stage 2 - Index & routers

### Tasks

- [ ] t4: Build `system/.os/indexes/references.json` from converted-file frontmatter (id, source/converted paths, sha256, type, converter, timestamp).
- [ ] t5: Author the `system/assets/` and `system/assets/converted/` routers.

### Acceptance criteria

- `references.json` is fully rebuildable from frontmatter (derived, not canonical).
- `system/assets/` is clearly distinguished from the make-docs `system/docs/assets/`.

### Dependencies

- Stage 1 twins and provenance exist.
