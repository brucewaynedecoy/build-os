# 08 Data Layer & Extraction

## Purpose

This subsystem is the plain-text knowledge layer and the smart ETL step that populates it, plus the entity model and its semantics.

## Scope

Covered here: the `.os/data/` NDJSON entity store, candidate staging, extraction load-plans, the capability/requirement/finding model, layered canonicity, and the `playbooks.json` index. Conversion is in `07`; routing is in `06`.

Code anchors:

- `system/.os/data/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| Entity files (NDJSON) | `requirements`, `capabilities`, `personas`, `test-cases`, `results`, `runs`, `findings` with a common envelope + per-type IDs |
| Candidate staging | `status: candidate` rows pending a gate |
| `extractions.jsonl` | First-class load-plan: one source → every minted artifact |
| `playbooks.json` | Derived catalog of instruments |

Code anchors:

- `system/.os/data/extractions.jsonl`
- `system/.os/indexes/playbooks.json`

## Contracts and Data

All data is NDJSON/CSV — no SQLite. Every row carries `source_anchor` and (when promoted) `doc_anchor`. **Layered canonicity**: structured fields are canonical in `.os/data/*.jsonl`, narrative is canonical in `system/docs/` and references IDs, and overlapping doc tables are generated — so there is no drift. The three knowledge types are distinct: **capability** is descriptive (what the product can do), **requirement** is normative (what the adopter needs), **finding** is empirical (what was observed); a capability gap and a bug are the engagement deliverables.

Code anchors:

- `system/.os/contracts/` (entity-records, extraction contracts)

### Change Notes

- Enhanced by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): structured rows that carry scoped metadata use `systems`, `environments`, and `owners` as config-backed list fields. Those values resolve to configured IDs in `system/.os/config/instance.yaml`, and validators reject legacy scoped fields or unconfigured IDs after the migration lands.

## Integrations

Reads converted twins from `07`; supplies entity IDs as playbook `targets` (`09`); is written to by extraction and by run/finding promotion (`10`).

Code anchors:

- `docs/prd/10-discovery-runs-and-qualification.md`

## Rebuild Notes

Never reintroduce a binary store. Keep structured fields canonical in JSONL and avoid duplicating them into narrative docs. Extraction is smart and gated; its outputs are candidates regardless of destination.

Code anchors:

- `system/.os/data/`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md`
