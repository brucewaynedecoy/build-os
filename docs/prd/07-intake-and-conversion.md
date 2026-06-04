# 07 Intake & Conversion

## Purpose

This subsystem (Pillar 1) turns unstructured sources into clean, provenance-stamped text/CSV twins, deterministically and without structuring.

## Scope

Covered here: converters per source type, the provenance contract, and the `references.json` index. Structuring of converted content is intentionally deferred to extraction (`08`).

Code anchors:

- `system/assets/`, `system/assets/converted/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `buildos-intake` toolkit | Transform `docx`/`xlsx`/`pdf`/`html`/html-dir/`csv` into md/csv twins through a packaged first-party CLI |
| Provenance frontmatter | Stamp each twin with source, hash, converter, timestamp, `status: converted` |
| `references.json` | Derived catalog of sources and their twins |

Code anchors:

- `system/.os/scripts/`
- `toolkits/buildos-intake/`
- `system/.os/indexes/references.json`

## Contracts and Data

Conversion is tool-first and deterministic; agents may do one-offs following the same provenance contract. Output is a clean twin only — no semantics. `xlsx` multi-sheet becomes one CSV per sheet; html-directory inputs follow a documented mirror/stitch convention. `references.json` is rebuildable from twin frontmatter.

Code anchors:

- `system/.os/contracts/` (converted-source contract)

### Change Notes

- Revised by [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md): W1 R0 P3 converter/index logic should be implemented as the `buildos-intake` toolkit under `toolkits/buildos-intake/`; `.os/scripts/` may provide wrappers or command routers but should not become the durable implementation home.

## Integrations

Feeds extraction (`08`), which reads twins as its source. Writes only under `system/assets/`; never under the make-docs `system/docs/assets/`.

Code anchors:

- `docs/prd/08-data-and-extraction.md`

## Rebuild Notes

Keep conversion strictly dumb — any structuring belongs in extraction. Preserve change-detection via source hashes so re-conversion is idempotent.

Code anchors:

- `system/assets/converted/`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md`
- `docs/prd/14-revise-deterministic-toolkit-deployment.md`
