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

## Contracts and Data

All data is NDJSON/CSV — no SQLite. Every row carries `source_anchor` and (when promoted) `doc_anchor`. **Layered canonicity**: structured fields are canonical in `.os/data/*.jsonl`, narrative is canonical in the project's Markdown documents (such as the Make Docs `docs/` tree) and references IDs, and overlapping doc tables are generated — so there is no drift. The three knowledge types are distinct: **capability** is descriptive (what the product can do), **requirement** is normative (what the adopter needs), **finding** is empirical (what was observed); a capability gap and a bug are adopter deliverables.

Entity rows that carry scoped metadata use the `systems`, `environments`, and `owners` list fields. Each value is a configured ID from `.os/config/instance.yaml`. Validation rejects an entity row that carries a legacy scoped field (`env`, `for`, `envs`, or `target_systems`), a sentinel value such as `both` in a scoped field, or an unconfigured ID. [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md#scoped-vocabulary) owns the scoped vocabulary and the [`buildos validate` checks](./13-adopter-owned-config-surface.md#buildos-validate-checks).

### Draft lifecycle and anchors

The common entity lifecycle vocabulary is `draft`, `active`, `superseded`, and `archived`. Every entity type uses it. Pending, unpromoted rows in `.os/data/*.jsonl` must use `draft`. `candidate` is never an entity status. Every row must carry `source_anchor`. A row that is not `draft` must also carry `doc_anchor`.

Extraction load-plans in `extractions.jsonl` must use the same lifecycle values. Each load-plan row records the entity and playbook IDs it minted, and may record dataset references.

Some entity types add entity-specific states to the common vocabulary: findings may end `qualified`, and runs may end `running`, `closed`, or `aborted`. [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md#contracts-and-data) owns those entity-specific terminal states, the meaning of `superseded` and `archived`, the redirect rules, and the `extraction-outcomes-v1` outcome lists.

Code anchors:

- `system/.os/contracts/` (entity-records, extraction contracts)

## Integrations

Reads converted twins from `07`; supplies entity IDs as playbook `targets` (`09`); is written to by extraction and by run/finding promotion (`10`).

Entity consumers keep the recorded ID and expose the canonical ID plus the resolution chain. Entity producers store canonical IDs for new references and tell reuse or update of an existing entity apart from minting a new one. The shared resolver is defined in [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md#integrations).

Code anchors:

- `docs/prd/10-discovery-runs-and-qualification.md`

## Rebuild Notes

Never reintroduce a binary store. Keep structured fields canonical in JSONL and avoid duplicating them into narrative docs. Extraction is smart and gated; its outputs remain `draft` until promoted, regardless of destination.

Code anchors:

- `system/.os/data/`

## Requirement History

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Contracts and Data`, lifecycle
- Previous contract: Pending extraction rows held a `candidate` status. A separate record corrected this to `draft`, and the anchor rule was stated here only as a description.
- Replacement contract: `draft` is the pending state for entity and extraction rows. `candidate` is never an entity status. Every row must carry `source_anchor`, and a row that is not `draft` must carry `doc_anchor`.
- Rationale: The lifecycle rule now lives with the data layer that owns it.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md`
