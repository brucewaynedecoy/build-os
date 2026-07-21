# Extraction Contract

## Purpose

Authority for `.os/data/extractions.jsonl` load-plan rows. An extraction row records which converted source anchor was used, which Build OS entity IDs or dataset references resulted from it, and who or what performed the extraction.

Extraction records event-time provenance for minting, referencing, or updating canonical entities. Canonical structured fields live in the target entity data rows, and narrative documentation lives in `system/docs/`.

## Required Path

- Canonical extraction load plan: `.os/data/extractions.jsonl`.
- Repository location in this checkout: `system/.os/data/extractions.jsonl`.
- Format: one JSON object per line.
- Rows are append-oriented. Correct invalid rows deliberately; do not rewrite history just to reorder load-plan rows.

## Required Fields

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `EXT-NNN` | Extraction row ID from the [entity-records contract](entity-records-contract.md) prefix registry. |
| `type` | `extraction` | Must match the `extractions.jsonl` file type. |
| `status` | lifecycle status | Use the entity-records contract status vocabulary; pending rows use `draft`. |
| `source_anchor` | `system/assets/<source-slug>/<asset-slug>.<ext>#<anchor>` | Anchor into a converted twin, not the original source. |
| `minted` | list of entity IDs | New canonical entity rows created by this extraction. Values must use the entity-records contract prefix registry. |
| `extracted_by` | string | Tool, script, agent, or human identifier responsible for the extraction. |
| `extracted_at` | ISO 8601 UTC datetime | Time the extraction row was produced. |

Optional fields:

| Field | Values / form | Notes |
| --- | --- | --- |
| `dataset_refs` | list of strings | Dataset paths, IDs, or references produced or associated by this extraction. |
| `doc_anchor` | `system/docs/<path>.md#<anchor>` | Required once the extraction row is no longer `draft`. |

Outcome-aware fields:

| Field | Values / form | Notes |
| --- | --- | --- |
| `outcome_contract` | `extraction-outcomes-v1` | Required on new outcome-aware rows. Its presence makes the three outcome lists unambiguous. |
| `referenced` | list of entity IDs | Existing canonical entities reused without changing their canonical rows. Required when `outcome_contract` is present. |
| `updated` | list of entity IDs | Existing canonical entities whose canonical rows were deliberately changed by this extraction. Required when `outcome_contract` is present. |

## Entity Outcome Rules

- New extraction rows that produce or reuse entities must set `outcome_contract` to `extraction-outcomes-v1` and include `minted`, `referenced`, and `updated`, including empty lists.
- `minted` means that the extraction created a new canonical entity row.
- `referenced` means that the extraction reused an existing canonical entity without changing its canonical row.
- `updated` means that the extraction deliberately changed an existing canonical entity row under that entity type's contract. Resolution alone is not an update.
- Every ID in the three outcome lists must use a registered entity-record prefix: `REQ`, `CAP`, `PER`, `TC`, `RES`, `RUN`, `FIND`, `EXT`, or `PB`.
- An entity ID must occur at most once across the three lists in one extraction row. When an existing entity is both found and changed, record it only in `updated`.
- IDs are terminal canonical IDs at extraction time. Resolve approved historical or alias matches before recording a new outcome.
- Preserve each outcome list as event-time provenance. If an entity is consolidated later, do not rewrite the extraction row; resolve its recorded ID when reading it.
- Dataset outputs are recorded in `dataset_refs[]`, not in `minted[]`.
- Use the next available sequence for the relevant prefix; do not derive IDs from source filenames, headings, row numbers, or prose.
- `source_anchor` must point to a converted source twin under `system/assets/`.
- Outcome-list order should match the order in which the extraction produced those outcomes.
- Do not encode entity fields in the extraction row beyond outcome IDs. Put entity-specific fields in the canonical `.os/data/*.jsonl` row for that entity type.
- Do not mark converted twins as extracted or promoted. Conversion status remains owned by the converted source contract.

Rows created before `extraction-outcomes-v1` may omit `outcome_contract`, `referenced`, and `updated`.
Their historical `minted` values retain the former "minted or updated" meaning.
Validators and migrations must not guess a more specific outcome or rewrite those rows without reviewed source evidence.

See the compact [`minted`](examples/extraction-outcomes/minted.json),
[`referenced`](examples/extraction-outcomes/referenced.json),
and [`updated`](examples/extraction-outcomes/updated.json) fixtures.

## Intended Follow-On (Next Step)

After an extraction row is added, load or update the corresponding canonical entity rows in `.os/data/*.jsonl` using the [entity-records contract](entity-records-contract.md). Persona reuse also follows the [persona identity contract](persona-identity-contract.md). Narrative docs may then reference those IDs from `system/docs/`.

## Link Rules

- Use relative Markdown links in contracts and routers.
- `source_anchor` values must resolve to converted twins and stable anchors inside those twins.
- Link narrative docs to canonical entity IDs or their generated references, not to extraction rows unless the provenance trail itself is being discussed.
