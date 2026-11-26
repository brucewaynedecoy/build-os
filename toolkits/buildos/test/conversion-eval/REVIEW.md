# Conversion Eval Reference Review

This file records the one-time human review of the conversion eval reference text (W1 R7 P4 t3, acceptance A25). An agent cannot complete this review.

## How to Review

1. Open `review.html` in this folder in a browser. It works offline and runs no scripts. Each eval file has one card: the rendered source on the left, and the draft reference text on the right, split into its named sections.
2. For each file, check that the reference has every visible section of the source, in the same order, with the same words. Use the "What to check" column below and the list on each card.
3. If a reference is wrong, edit `references/<id>.txt`. Keep the `@@ section: <name> @@` marker lines. If you add, remove, or rename a section, also change the section list for that file in `generate-eval.ts`, because `manifest.json` is generated from it. Then run `node test/conversion-eval/generate-eval.ts` from `toolkits/buildos/` to refresh `manifest.json` and `review.html`, and run `npm test`.
4. Fill in the reviewer, the date, and "yes" or "no" for each row. Write "yes" only when the reference is correct as it stands.

The reference is the body that a correct converter writes under the intake translation contract (`system/.os/contracts/intake-translation-contract.md`). It is Markdown for DOCX and HTML, CSV for CSV and XLSX, and plain text for PDF. The eval compares text after white-space normalization, so line breaks, blank lines, and runs of spaces do not matter. Markup characters do count. The agent drafted each reference from the generator's content and checked it against the Go converter. Where the Go converter loses visible text, the reference keeps that text, and the eval reports the loss.

## Checklist

| Eval file | Source | Reference | What to check | Reviewer | Date | Approved |
| --- | --- | --- | --- | --- | --- | --- |
| csv-maintenance-requests | `inputs/csv/maintenance-requests.csv` | `references/csv-maintenance-requests.txt` | All 12 rows and the header. Quoted cells with commas, quotes, and a line break. Empty Unit and Closed cells. | Tyler (project owner) | 2026-11-23 | yes |
| docx-operations-handbook | `inputs/docx/operations-handbook.docx` | `references/docx-operations-handbook.txt` | Heading levels. The lettered sub-list is written as indented `1.` items, the Markdown form the converter uses. The bold and underlined "Emergency Contacts" line is a heading. The table, including the two-paragraph cell. The image is listed under "Embedded Assets" at the end, as the converter does. | Tyler (project owner) | 2026-11-23 | yes |
| docx-committee-minutes | `inputs/docx/committee-minutes.docx` | `references/docx-committee-minutes.txt` | The typed "•" agenda lines become `-` items. The decision table. The numbered actions. | Tyler (project owner) | 2026-11-23 | yes |
| xlsx-annual-budget | `inputs/xlsx/annual-budget.xlsx` | `references/xlsx-annual-budget.txt` | One section per sheet, in sheet order. Formula cells show their cached values. Skipped rows are not written. The rich-text vendor name "Sample Plumbing & Heating" on the Vendors sheet is present. The leading space in " Free delivery over €50" is kept. | Tyler (project owner) | 2026-11-23 | yes |
| html-visitor-policy | `inputs/html/visitor-policy.html` | `references/html-visitor-policy.txt` | No head, style, or script text. Links in `[label](target)` form. The nested parking list is indented. The ordered list uses `1.`. The callout "Note: Guests who stay longer than 30 nights..." is present. Image and Mermaid links use the converter's side-artifact names. | Tyler (project owner) | 2026-11-23 | yes |
| html-dir-help-center | `inputs/html-dir/help-center/` | `references/html-dir-help-center.txt` | One section per page, in sorted path order: `faq.htm`, `guides/getting-started.html`, `guides/paying-charges.html`, `index.html`. The breadcrumb "Help Center" link is left out as site navigation. Decide whether you agree. | Tyler (project owner) | 2026-11-23 | yes |
| pdf-annual-report | `inputs/pdf/annual-report-summary.pdf` | `references/pdf-annual-report.txt` | Both pages. The third Membership paragraph has normal spaces between words; the PDF draws those gaps without space characters. | Tyler (project owner) | 2026-11-23 | yes |
| pdf-newsletter-columns | `inputs/pdf/newsletter-two-columns.pdf` | `references/pdf-newsletter-columns.txt` | Masthead first, then the whole left column, then the whole right column, then the footer. | Tyler (project owner) | 2026-11-23 | yes |
| pdf-rates-table | `inputs/pdf/room-rates-table.pdf` | `references/pdf-rates-table.txt` | One line per table row, cells in left-to-right order. Text before and after the table. | Tyler (project owner) | 2026-11-23 | yes |
| pdf-pet-policy-headers | `inputs/pdf/pet-policy.pdf` | `references/pdf-pet-policy-headers.txt` | The running header and the footer are kept on every page, in page order. The footer's left and right text are on one line. | Tyler (project owner) | 2026-11-23 | yes |
| pdf-signup-with-scan | `inputs/pdf/volunteer-signup-with-scan.pdf` | `references/pdf-signup-with-scan.txt` | Page 1 text only. Page 2 is a scanned image with no text layer. OCR is out of scope, so its text is not in the reference. | Tyler (project owner) | 2026-11-23 | yes |
| pdf-scanned-notice | `inputs/pdf/scanned-repair-notice.pdf` | `references/pdf-scanned-notice.txt` | The reference is empty on purpose. The page is only a scanned image; the converter must report that it found no usable text. | Tyler (project owner) | 2026-11-23 | yes |

## Reviewer Notes

- 2026-11-23, Tyler (project owner): reviewed all 12 reference texts in `review.html` and approved them all without changes ("All 12 approved"). No reference file changed. Relayed to the implementing agent by the orchestrating maintainer chat.
