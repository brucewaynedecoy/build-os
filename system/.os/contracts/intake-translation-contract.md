# Intake Translation Contract

## Purpose

Authority for the body shape of intake conversions, whether produced by `buildos-intake`, another approved local tool, a human operator, or an agent. The converted-source contract governs path, frontmatter, provenance, and status; this contract governs how source content is represented inside converted twins and how side artifacts are referenced.

## Required Relationship

- Every converted twin must also satisfy [converted-source-contract.md](converted-source-contract.md).
- This contract applies only to intake translation. It must not add extracted entity records, requirements, capabilities, findings, load plans, or extraction classifications.
- Manual conversions and multimodal-agent conversions must follow the same rules as automated conversions so downstream extraction can treat the twins consistently.

## Source Directory and Part Rules

- Each source file, source bundle, or HTML directory uses one directory: `system/assets/<source-slug>/`.
- Each converted body part uses one deterministic filename under that directory: `system/assets/<source-slug>/<asset-slug>.<ext>`.
- Use lowercase hyphenated slugs derived from the source stem and, when relevant, sheet name, HTML relative path, section name, or part name.
- Multi-sheet spreadsheet sources produce one `.csv` twin per worksheet.
- Multi-file HTML sources produce one `.md` twin per HTML file unless a later design approves a stitched format.
- Side artifacts live below the same source directory, usually under `media/`, `diagrams/`, or `charts/`.
- Converted twins reference side artifacts with relative Markdown links from the twin location.

## Status Rules

- Use `status: converted` only when the converted body is reliable enough for downstream reading.
- Use `status: candidate` when the body is useful but needs review before extraction.
- Use `status: rejected` when the body is known to be unusable and should not feed extraction.
- If a converter cannot produce trustworthy content, fail clearly or write a `candidate` or `rejected` twin. Do not write misleading `converted` output.

## Sections and Headings

- Preserve visible heading order and hierarchy where the source exposes it.
- Use Markdown headings for document and HTML bodies.
- Do not invent headings to imply semantics that the source did not provide.
- When a source has no headings, preserve paragraph order without adding artificial section labels.
- Preserve page, slide, worksheet, or part boundaries when they are needed to trace source context.

## Lists and Tables

- Preserve ordered lists as numbered Markdown lists and unordered lists as hyphen bullets.
- Preserve nesting when visible. If nesting cannot be represented cleanly, keep item order and add a short plain-text note inside the converted body.
- Represent simple document and HTML tables as Markdown tables when row and column boundaries are clear.
- Represent worksheet-style tabular data as CSV.
- For nested tables, either preserve the inner table inline when the Markdown remains readable or split it into a deterministic sibling part and link to it from the parent body.
- Do not reconstruct missing table structure from visual guesses. If table extraction is unreliable, mark the twin `candidate` or use manual conversion.

## Worksheets, CSV, and Formulas

- Convert each worksheet to one CSV twin with rows in source order.
- Preserve empty cells needed for column position.
- Prefer displayed or cached cell values over formula text for baseline intake.
- Do not infer pivot-table semantics, data types, validations, hidden worksheet logic, or chart data unless the source exposes them as visible tables.

## TOCs, Links, Images, and Charts

- Preserve source tables of contents as visible lists or links when present. Do not generate a new TOC when the source lacks one.
- Preserve links in Markdown label-plus-target form.
- For bare URLs, keep the URL text as the label and target.
- Copy embedded images from non-PDF sources when the converter can access them deterministically.
- Reference copied images with relative Markdown image links such as `![caption](media/image1.png)`.
- Use visible captions or stable filenames as image alt text. Do not create separate entity records for copied images.
- Preserve inline SVG diagrams from non-PDF sources as deterministic `diagrams/*.svg` side artifacts when the converter can access them deterministically.
- Preserve diagrams-as-code from non-PDF sources, such as Mermaid blocks, as deterministic `diagrams/*.mmd` side artifacts and include a matching fenced code block in the converted body when practical.
- Do not require diagram rendering to bitmap output unless a future design explicitly approves a renderer dependency. Code-based diagram preservation is sufficient for P3.
- Preserve charts as copied side artifacts when they are embedded images. If the chart's source data is visible in a table or worksheet, convert that data separately; do not infer values from the image.

## Source-Type Notes

- DOCX: convert paragraphs, headings, lists, visible tables, and accessible embedded images. Preserve reading order as exposed by the document XML.
- XLSX: convert each worksheet to CSV and copy accessible embedded media as side artifacts. Do not promise formatting or chart reconstruction.
- CSV: normalize with deterministic CSV serialization and provenance frontmatter.
- HTML: convert visible text, headings, lists, links, and clear tables. Preserve accessible local or data-URI image embeds, inline SVG diagrams, and recognized diagrams-as-code. Ignore scripts, styles, layout-only containers, and hidden metadata.
- HTML directory: convert each HTML file independently with deterministic relative slugs.
- PDF: built-in support is minimal plain-text or Markdown-oriented extraction only. Build OS does not promise OCR, table reconstruction, embedded-image extraction, layout fidelity, rich parsing, or future rich PDF extraction. If PDF output is empty, malformed, encrypted, or not useful, use another local tool, manual conversion, or a sufficiently capable multimodal agent and mark status honestly.

## Manual Fallback

Manual or agent-assisted intake is an intentional fallback path. When automated output is inadequate, follow [manual-intake-conversion.md](../../playbooks/administrative/manual-intake-conversion.md) and keep the converted twin shape identical to automated output.

## Link Rules

- Use relative Markdown links for repository paths.
- Use source-native URLs only when the converted source itself contains the external target.
