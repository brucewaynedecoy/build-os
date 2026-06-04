---
id: PB-003
title: Manual intake conversion
category: administrative
execution_mode: explicit-steps
state_nature: standing
status: active
audience: both
harness: [none]
systems: []
environments: []
owners: []
targets: []
produces: [converted-source]
source_anchor: null
version: 1.0.0
related:
  - ../../.os/contracts/converted-source-contract.md
  - ../../.os/contracts/intake-translation-contract.md
  - ../../../toolkits/buildos-intake/README.md
---

# Manual Intake Conversion

## Objective

Create trustworthy converted-source twins when automated intake is unavailable, fails, or produces output that is not good enough for downstream extraction.

## Steps & Guidance

1. Read [converted-source-contract.md](../../.os/contracts/converted-source-contract.md) and [intake-translation-contract.md](../../.os/contracts/intake-translation-contract.md).
2. Create or select `system/assets/<source-slug>/` for the source file or bundle.
3. Add frontmatter to every converted twin with `source`, `sha256`, `converter`, `timestamp`, `type`, and `status`.
4. Use `converter: "manual-intake/1.0.0"` for human/manual conversion, or identify the local tool or agent that produced the body.
5. For Word documents, preserve visible sections, headings, paragraphs, lists, links, tables, and accessible embedded images in Markdown. Store copied images under `media/` and reference them relatively.
6. For Excel workbooks, create one CSV twin per worksheet. Preserve row order, column position, and visible cell values. Store accessible embedded images or charts as side artifacts when they are useful context.
7. For HTML files, convert visible headings, paragraphs, lists, links, and clear tables to Markdown. Preserve accessible image embeds, inline SVG diagrams, and diagrams-as-code as side artifacts under `media/` or `diagrams/`. When preserving Mermaid or similar code-based diagrams, link the side artifact and include the fenced diagram code in the Markdown body when practical. Ignore scripts, styles, hidden metadata, and layout-only containers.
8. For HTML directories, convert each `.html` or `.htm` file to a deterministic sibling Markdown twin using the file's relative path as slug context.
9. For CSV files, preserve CSV shape and normalize serialization only when needed for consistency.
10. For PDFs, do only simple text or Markdown-oriented conversion. Do not promise OCR, table reconstruction, embedded-image extraction, layout fidelity, or rich parsing. If PDF output is incomplete or hard to trust, use `status: candidate` or `status: rejected`.
11. For embedded tables, nested tables, charts, diagrams, and images, follow the intake translation contract: preserve what is visible, split complex parts into deterministic sibling files when needed, and reference side artifacts from the converted body.
12. After writing converted twins, rebuild the references index with `buildos-intake index references` or the thin wrapper under `system/.os/scripts/`.

## Expected Signals

Positive signals:

- Every converted twin starts with valid converted-source frontmatter.
- Body content preserves source order and visible structure without adding extraction semantics.
- Side artifacts are stored under the same `system/assets/<source-slug>/` directory and linked relatively.
- Unreliable conversions are clearly marked `candidate` or `rejected`.

Negative signals:

- The converted body adds requirements, capabilities, findings, or other extraction output.
- PDF output implies table, image, OCR, or layout fidelity that was not actually preserved.
- Side artifacts are stored outside the source directory or treated as extracted entity records.
- A failed or low-quality conversion is marked `converted`.

Inconclusive signals:

- The source file cannot be opened or inspected by available local tools.
- A multimodal agent can read the source but cannot provide a traceable conversion body.

## Produces

- Converted-source twins under `system/assets/<source-slug>/`.
- Optional side artifacts under the same source directory.
- A rebuilt references index when converted twins are ready for lookup.

## Notes / Links

- [Converted Source Contract](../../.os/contracts/converted-source-contract.md)
- [Intake Translation Contract](../../.os/contracts/intake-translation-contract.md)
- [buildos-intake README](../../../toolkits/buildos-intake/README.md)
