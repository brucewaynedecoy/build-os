# Extraction Contract

## Purpose

Authority for `.os/data/extractions.jsonl` load-plan rows. An extraction row records which converted
source anchor was used, which Build OS entity IDs were minted from it, and who or what performed the
extraction.

Extraction records provenance for minting. Canonical structured fields live in the target entity
data rows, and narrative documentation lives in `system/docs/`.

## Required Path

- Canonical extraction load plan: `.os/data/extractions.jsonl`.
- Repository location in this checkout: `system/.os/data/extractions.jsonl`.
- Format: one JSON object per line.
- Rows are append-oriented. Correct invalid rows deliberately; do not rewrite history just to
  reorder load-plan rows.

## Required Fields

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `EXT-NNN` | Extraction row ID from the [entity-records contract](entity-records-contract.md) prefix registry. |
| `source_anchor` | `system/assets/<source-slug>/<asset-slug>.<ext>#<anchor>` | Anchor into a converted twin, not the original source. |
| `minted` | list of entity IDs | IDs minted or updated from this extraction row. Values must use the entity-records contract prefix registry. |
| `extracted_by` | string | Tool, script, agent, or human identifier responsible for the extraction. |
| `extracted_at` | ISO 8601 UTC datetime | Time the extraction row was produced. |

## Minting Rules

- Every `minted[]` value must use a registered entity-record prefix: `REQ`, `CAP`, `PER`, `TC`,
  `RES`, `RUN`, `FIND`, `EXT`, or `PB`.
- Use the next available sequence for the relevant prefix; do not derive IDs from source filenames,
  headings, row numbers, or prose.
- `source_anchor` must point to a converted source twin under `system/assets/`.
- `minted[]` order should match the order in which canonical entity rows are written.
- Do not encode entity fields in the extraction row beyond the minted IDs. Put entity-specific
  fields in the canonical `.os/data/*.jsonl` row for that entity type.
- Do not mark converted twins as extracted or promoted. Conversion status remains owned by the
  converted source contract.

## Intended Follow-On (Next Step)

After an extraction row is added, load or update the corresponding canonical entity rows in
`.os/data/*.jsonl` using the [entity-records contract](entity-records-contract.md). Narrative docs
may then reference those IDs from `system/docs/`.

## Link Rules

- Use relative Markdown links in contracts and routers.
- `source_anchor` values must resolve to converted twins and stable anchors inside those twins.
- Link narrative docs to minted entity IDs or their generated references, not to extraction rows
  unless the provenance trail itself is being discussed.
