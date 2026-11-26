# 07 Intake & Conversion

## Purpose

This subsystem (Pillar 1) turns unstructured sources into clean, provenance-stamped text/CSV twins, deterministically and without structuring.

## Scope

Covered here: converters per source type, the provenance contract, and the `references.json` index. Structuring of converted content is intentionally deferred to extraction (`08`).

Code anchors:

- `system/assets/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `buildos intake` commands | Transform `docx`/`xlsx`/minimal-text `pdf`/`html`/html-dir/`csv` into md/txt/csv twins with `buildos intake convert`, and rebuild derived catalogs with `buildos intake index references` and `buildos intake index playbooks`. The legacy `buildos-intake` name is an alias until `0.3.0` ([PRD 20](./20-buildos-cli-and-distribution.md#legacy-command-names)). |
| Provenance frontmatter | Stamp each twin with source, hash, converter, timestamp, `status: converted` |
| `references.json` | Derived catalog of sources and their twins |

Code anchors:

- `system/.os/scripts/`
- `toolkits/buildos/`
- `system/.os/indexes/references.json`

## Contracts and Data

Conversion is tool-first and deterministic; agents may do one-offs following the same provenance contract and intake translation contract. Output is a clean twin only — no semantics. `xlsx` multi-sheet becomes one CSV per sheet; html-directory inputs follow a documented mirror convention. Accessible non-PDF embedded media and diagrams may be copied as side artifacts under the same source directory and linked from converted twins, per the intake translation contract. PDF conversion is minimal text extraction only. `references.json` is rebuildable from twin frontmatter.

`references.json` is the intake index of sources and their twins. It never carries entity redirects. The entity-resolution index is separate and is defined in [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md#contracts-and-data).

A converted source twin may use the `candidate` status only under the converted-source contract, where it means that conversion quality is not yet trusted. This is a conversion state, not an entity lifecycle state. Entity and extraction rows use `draft` for pending records, as [08 Data Layer and Extraction](./08-data-and-extraction.md#contracts-and-data) states.

The converters live in the BuildOS TypeScript package at `toolkits/buildos/`. They use Node built-in modules first. Where Node cannot do the job, they use only vetted outside packages that are bundled into the published files, under the rules in [PRD 20 Supply Chain](./20-buildos-cli-and-distribution.md#supply-chain).

Conversion output must match the output of the former Go converters byte for byte for the same input ([PRD 20 Compatibility](./20-buildos-cli-and-distribution.md#compatibility)). PDF text is the one exception. It is compared after whitespace and line-break normalization.

Conversion accuracy has its own release gate:

- A conversion eval set holds realistic files for every supported format. For PDF it covers plain text, columns, tables, headers, and footers.
- A person reviews the correct text for each eval file once. That text is the reference answer.
- For each format that needs an outside package, two candidate packages are compared on the eval set before one is chosen.
- A release is blocked if any eval file loses a section, or if its text similarity to the reference falls below 98%.

Scanned PDFs that need OCR are out of scope. There is no Poppler bundle, no `pdftotext` requirement, no table reconstruction promise, and no plan for richer PDF extraction. Manual or agent-assisted conversion stays the fallback when automated output is not good enough. Conversion accuracy is tracked as `R-011` in the [risk register](./03-open-questions-and-risk-register.md).

Code anchors:

- `system/.os/contracts/converted-source-contract.md`
- `system/.os/contracts/intake-translation-contract.md`

### Change Notes

- W1 R0 P3 locks PDF posture to no Poppler bundle, no `pdftotext` requirement, no OCR, no table reconstruction promise, and no future rich-PDF extraction roadmap. Built-in PDF behavior is limited to rudimentary local text extraction through an approved Go package; manual or agent-assisted conversion is an intentional fallback when automated output is inadequate.
- 2026-11-23 (W1 R7): the Go package named in the W1 R0 P3 note above is not current authority. Converters live in the TypeScript package, with byte parity except normalized PDF text and the conversion accuracy gate stated in this section. See `## Requirement History`.

## Integrations

Feeds extraction (`08`), which reads twins as its source. Writes only under `system/assets/`; never under Make Docs-owned paths such as `docs/`.

Code anchors:

- `docs/prd/08-data-and-extraction.md`

## Rebuild Notes

Keep conversion strictly dumb — any structuring belongs in extraction. Preserve change-detection via source hashes so re-conversion is idempotent.

Rebuild the converters in the TypeScript package. Prove byte parity against captured output from the former Go converters, with PDF text compared after whitespace and line-break normalization. Choose each outside package only after comparing two candidates on the conversion eval set, and do not release while any eval file loses a section or falls below 98% text similarity to its reviewed reference.

Code anchors:

- `system/assets/`

## Requirement History

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Contracts and Data`, `## Rebuild Notes` (conversion contract)
- Previous contract: Converters were Go code in the `buildos-intake` toolkit, with PDF text extraction through an approved Go package. Conversion output was defined by the Go implementation.
- Replacement contract: Converters live in the TypeScript package at `toolkits/buildos/` and use only vetted, bundled outside packages. Output matches the former Go output byte for byte, except PDF text, which is compared after whitespace and line-break normalization. A reviewed-reference eval set gates each release: no lost section and at least 98% text similarity per file. Commands are `buildos intake convert` and `buildos intake index`; `buildos-intake` is an alias until `0.3.0`.
- Rationale: Node PDF extraction cannot match Go bytes, so accuracy must be proven against reviewed reference text instead.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md`
- `.make-docs/archive/prds/2026-11-23/14-revise-deterministic-toolkit-deployment.md`
- `system/.os/contracts/intake-translation-contract.md`
- `system/playbooks/administrative/manual-intake-conversion.md`
- [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)
