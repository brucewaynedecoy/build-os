# 08 Data Layer & Extraction

## Purpose

This subsystem is the plain-text knowledge layer and the smart ETL step that populates it, plus the entity model and its semantics.

## Scope

Covered here: the `.os/data/` NDJSON entity store, draft staging before promotion, extraction load-plans, the capability/requirement/finding model, layered canonicity, and the `playbooks.json` index. Conversion is in `07`; routing is in `06`.

Code anchors:

- `system/.os/data/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| Entity files (NDJSON) | `requirements`, `capabilities`, `personas`, `test-cases`, `results`, `runs`, `findings` with a common envelope + per-type IDs |
| Draft staging | `status: draft` rows pending a promotion gate |
| `extractions.jsonl` | First-class load-plan: one source → every minted artifact |
| `playbooks.json` | Derived catalog of instruments |

Code anchors:

- `system/.os/data/extractions.jsonl`
- `system/.os/indexes/playbooks.json`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): the data layer gains redirect-bearing superseded rows, terminal entity resolution, a deterministic entity-resolution index, and reviewed persona-first consolidation.

## Contracts and Data

All data is NDJSON/CSV — no SQLite. Every row carries `source_anchor` and (when promoted) `doc_anchor`. **Layered canonicity**: structured fields are canonical in `.os/data/*.jsonl`, narrative is canonical in `system/docs/` and references IDs, and overlapping doc tables are generated — so there is no drift. The three knowledge types are distinct: **capability** is descriptive (what the product can do), **requirement** is normative (what the adopter needs), **finding** is empirical (what was observed); a capability gap and a bug are adopter deliverables.

Code anchors:

- `system/.os/contracts/` (entity-records, extraction contracts)

### Change Notes

- Enhanced by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): structured rows that carry scoped metadata use `systems`, `environments`, and `owners` as config-backed list fields. Those values resolve to configured IDs in `system/.os/config/instance.yaml`, and validators reject legacy scoped fields or unconfigured IDs after the migration lands.
- Revised by [15 Revise Extraction Draft Lifecycle](./15-revise-extraction-draft-lifecycle.md): entity and extraction rows use `draft` as the pending lifecycle state, and non-`draft` rows require `doc_anchor` in addition to `source_anchor`.
- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): `superseded` rows carry reviewed same-type redirects, reverse membership is derived, `related` remains non-canonical, and compatibility-to-strict graph validation governs migration.

## Integrations

Reads converted twins from `07`; supplies entity IDs as playbook `targets` (`09`); is written to by extraction and by run/finding promotion (`10`).

Code anchors:

- `docs/prd/10-discovery-runs-and-qualification.md`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): readers expose original and canonical IDs, producers store terminal canonical IDs, and extraction distinguishes newly minted entities from canonical references or updates.

## Rebuild Notes

Never reintroduce a binary store. Keep structured fields canonical in JSONL and avoid duplicating them into narrative docs. Extraction is smart and gated; its outputs remain `draft` until promoted, regardless of destination.

Code anchors:

- `system/.os/data/`

### Change Notes

- Enhanced by [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): rebuilds validate the complete redirect graph and reproduce `entity-resolution.json` byte-identically from authoritative JSONL without overloading intake `references.json`.

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md`
