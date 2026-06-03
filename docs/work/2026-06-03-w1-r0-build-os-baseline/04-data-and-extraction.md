# Phase 04: Data Layer & Extraction

## Purpose

This phase delivers the plain-text knowledge layer and the smart ETL step that populates it.

## Overview

Define the per-entity NDJSON store in `.os/data/`, implement candidate staging and the capability/requirement/finding model, make extraction load-plans first-class, and build the derived `playbooks.json`. All data is plain text; structured fields are canonical here under layered canonicity.

## Source PRD Docs

- [08 Data Layer & Extraction](../../prd/08-data-and-extraction.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Entity store

### Tasks

- [ ] t1: Define per-entity NDJSON files in `system/.os/data/` (`requirements`, `capabilities`, `personas`, `test-cases`, `results`, `runs`, `findings`) with the common envelope and per-type IDs.
- [ ] t2: Implement candidate staging (`status: candidate`) and encode the capability/requirement/finding distinction (descriptive / normative / empirical).
- [ ] t3: Implement first-class extraction load-plans in `system/.os/data/extractions.jsonl` (source_anchor, minted[], extracted_by/at).

### Acceptance criteria

- All data is NDJSON/CSV — no SQLite or binary store.
- Every row carries `source_anchor` and (when promoted) `doc_anchor`; candidate vs. promoted status is tracked.
- A single extraction can mint rows, playbooks, and/or datasets, all recorded in its load-plan.

### Dependencies

- Phase 01 (entity-records + extraction contracts), Phase 03 (converted twins as extraction source).

## Stage 2 - Indexes, tagging & discipline

### Tasks

- [ ] t4: Build `system/.os/indexes/playbooks.json` from playbook frontmatter (derived).
- [ ] t5: Enforce layered canonicity — structured fields canonical in `.os/data`; narrative references entity IDs; overlapping doc tables generated, not hand-maintained.
- [ ] t6: Apply `env`/`for` tags across entity rows and add a hygiene check.

### Acceptance criteria

- `playbooks.json` is rebuildable from playbook frontmatter.
- No structured field is duplicated between `.os/data` and narrative docs (no drift path).

### Dependencies

- Stage 1; Phase 05 playbook frontmatter for `playbooks.json` content.
