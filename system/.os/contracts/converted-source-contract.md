# Converted Source Contract

## Purpose

Authority for deterministic converted twins under `system/assets/`. A converted source is a
frontmatter-bearing text artifact that preserves provenance and normalized source content for later
review or extraction.

Conversion records what the source became. It does not mint Build OS entities, infer requirements,
or record extraction results.

## Required Path

- Converted twins live under `system/assets/`.
- Path form: `system/assets/<source-slug>/<asset-slug>.<ext>`.
- `<source-slug>` is a stable lowercase slug for the original source file, bundle, or source set.
- `<asset-slug>` is deterministic from the original file stem and, when needed, the sheet, page,
  section, or part name.
- Multi-part sources use one directory under `system/assets/<source-slug>/` and one converted twin
  per deterministic part.
- Converted extensions should match the normalized body format, such as `.md`, `.csv`, or `.txt`.

## Required Frontmatter

Every converted twin must start with YAML frontmatter. For tabular bodies, readers must strip the
frontmatter before handing the body to CSV tooling.

| Field | Values / form | Notes |
| --- | --- | --- |
| `source` | relative path or URI | Original source identifier. Use a repo-relative path for local source material. |
| `sha256` | lowercase 64-character hex digest | Hash of the original source input. For bundles, hash the deterministic source manifest. |
| `converter` | string | Tool, script, or agent identifier plus version when available. |
| `timestamp` | ISO 8601 UTC datetime | Time the converted twin was produced. |
| `type` | `markdown` \| `csv` \| `text` \| `html` \| `image` \| `other` | Normalized body type; not an extracted entity type. |
| `status` | `candidate` \| `converted` \| `superseded` \| `rejected` | Conversion state only. Do not use extraction, loading, or promotion states here. |

## Conversion Rules

- Conversion must be deterministic for the same `source`, `sha256`, and `converter`.
- Preserve source ordering, headings, labels, table structure, and visible text unless the
  normalized body type requires a documented transformation.
- Spreadsheet inputs convert to one CSV twin per sheet with deterministic sheet slugs.
- Directory-style HTML sources convert by deterministic mirror or stitch rules and must keep enough
  path context to trace each body segment back to the original source.
- Do not add extracted IDs, requirement language, capability classifications, findings, or load-plan
  decisions to converted twins.
- If the conversion cannot be trusted, leave the twin as `candidate` or mark it `rejected`; do not
  use extraction semantics to describe the failure.

## Intended Follow-On (Next Step)

Accepted converted twins feed load-plan rows in `.os/data/extractions.jsonl` under the
[extraction contract](extraction-contract.md). Extraction rows reference converted twins through
`source_anchor` and mint entity IDs in canonical `.os/data/*.jsonl` files.

## Link Rules

- Use relative Markdown links in contracts and routers.
- `source` may be a repo-relative path or external URI; it is provenance, not a Markdown link.
- Extraction links must point to converted twin anchors, not directly to unconverted source material.
