# 15 Revise Extraction Draft Lifecycle

## Purpose

Make `draft` the effective pending lifecycle state for structured entity and extraction rows, and keep `candidate` out of the `.os/data` entity status vocabulary.

## Change Type

- Kind: `revision`
- Status: `active`
- Source work: [W1 R0 P4 Data Layer and Extraction](../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md)

## Baseline Being Revised or Removed

The W1 R0 baseline used `candidate` language for ungated extraction output in the architecture flow, glossary, and data-layer PRD. That language is no longer the effective lifecycle vocabulary for rows under `system/.os/data/`.

The converted-source contract may still use `candidate` for untrusted converted twins under `system/assets/`. That status is conversion state only and does not carry into entity or extraction row lifecycle.

## Rationale

W1 R0 P4 introduced the first canonical entity JSONL files and validation. The implemented entity-records contract uses `draft`, `active`, `superseded`, and `archived` as the lifecycle vocabulary, with `draft` representing rows pending promotion. Keeping a separate `candidate` entity status would create two pending states for the same gate and weaken validator behavior.

## Effective Requirement

| Area | Requirement |
| --- | --- |
| Entity lifecycle | Rows in `system/.os/data/*.jsonl` use `draft` for pending, unpromoted records. Do not use `candidate` as an entity row status. |
| Promotion gate | Non-`draft` rows require `doc_anchor`; every row requires `source_anchor`. |
| Extraction load-plans | Rows in `system/.os/data/extractions.jsonl` use the same lifecycle vocabulary and record minted entity or playbook IDs plus optional dataset references. |
| Converted twins | Converted source twins may still use `candidate` only under the converted-source contract, where it means conversion quality is not yet trusted. |
| PRD language | PRD language should describe Flow A extraction outputs as draft entity and extraction rows until promoted. |

## Impacted Docs and Dependencies

- [02 Architecture Overview](./02-architecture-overview.md) now describes Flow A as producing draft entity and extraction rows.
- [04 Glossary](./04-glossary.md) now defines `Draft` as the canonical ungated entity/extraction lifecycle term.
- [08 Data Layer and Extraction](./08-data-and-extraction.md) now describes draft staging and draft extraction outputs.
- `system/.os/contracts/entity-records-contract.md` and `system/.os/contracts/extraction-contract.md` carry the effective lifecycle contract.
- `system/.os/contracts/converted-source-contract.md` remains separate and may still use converted-source `candidate` status.

## Required Baseline Annotations

This PRD revision should be referenced from the impacted baseline PRDs as a change note, because it revises established lifecycle terminology without replacing the full W1 R0 baseline.

## Source Anchors

- `docs/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md`
- `docs/prd/02-architecture-overview.md`
- `docs/prd/04-glossary.md`
- `docs/prd/08-data-and-extraction.md`
- `system/.os/contracts/entity-records-contract.md`
- `system/.os/contracts/extraction-contract.md`
- `system/.os/contracts/converted-source-contract.md`
- `system/.os/scripts/validate_config.py`
