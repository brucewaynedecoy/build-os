---
client: "Codex Desktop"
date: "2026-06-04"
coordinate: "W1 R0 P3"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Implemented buildos-intake with minimal local conversion, references indexing, and manual fallback guidance."
---

# W1 R0 P3 Intake Conversion

## Changes

Implemented W1 R0 P3 as the `buildos-intake` Go toolkit plus a thin operating wrapper. The toolkit now supports local conversion for CSV, DOCX, XLSX, HTML, HTML-directory sources, and minimal PDF plain-text extraction; writes converted-source twins under `system/assets/`; and rebuilds `system/.os/indexes/references.json` from converted-source frontmatter.

Locked the PDF stance durably: no Poppler bundle, no `pdftotext` requirement, no OCR, no table reconstruction promise, no embedded-image extraction promise, no layout fidelity promise, and no future rich-PDF extraction roadmap. PDF output is intentionally best-effort text only, with manual or agent-assisted conversion treated as an expected fallback path.

Manual-test coverage decision: outcome `worthwhile`. P3 introduced a user-observable administrator workflow: build or provide the `buildos-intake` binary, run the `.os/scripts` wrapper against source material, inspect converted twins under `system/assets/`, and rebuild `references.json`. Automated tests cover the parser and index mechanics, but a human acceptance pass adds useful judgment about whether the generated converted twin is readable and operationally recognizable.

Manual UAT scenario produced: build `buildos-intake` to a temporary binary, create a temporary Build OS workspace with a small HTML directory source, run `system/.os/scripts/buildos-intake convert`, run `system/.os/scripts/buildos-intake index references`, then inspect the converted Markdown frontmatter/body and the references index. The scenario caught a flattened Markdown-table issue in HTML conversion; that was fixed in `toolkits/buildos-intake/internal/intake/html.go` and covered in `toolkits/buildos-intake/internal/intake/convert_test.go`.

Follow-up Word document manual test feedback found that raw DOCX text extraction was preserving visible text but losing semantic document structure such as visual headings, top-level category bullets, nested list items, and ordered-list intent. `toolkits/buildos-intake/internal/intake/docx.go` was updated to parse paragraph styles, numbering metadata, literal bullet prefixes, bold/underline visual headings, and nested Markdown list grouping. The regression coverage now includes a DOCX outline fixture with headings, parent bullets, nested bullets, and ordered items.

Additional manual tests covered a single-worksheet XLSX, a multi-worksheet XLSX, a simple text-only PDF, a more complex PDF, and two HTML sources. XLSX conversion preserved the expected worksheet split, PDF output stayed within the accepted minimal plain-text posture, and the richer HTML source preserved headings, lists, nested lists, and tables.

HTML diagram feedback found that diagrams-as-code were being dropped from converted Markdown. The reported file contained Mermaid source blocks rather than pre-rendered images, so HTML conversion was updated to preserve Mermaid blocks as `diagrams/*.mmd` side artifacts and fenced `mermaid` blocks in the Markdown body. It now also preserves inline SVG diagrams and local or data-URI image embeds as side artifacts when accessible. Rendering Mermaid into bitmap images remains out of scope for P3 because it would require adding a renderer dependency.

Final user retest confirmed the DOCX structure, XLSX worksheet split, PDF minimal-extraction posture, and HTML embed/diagram preservation changes worked as expected. W1 R0 P3 is considered successful with manual and automated tests passing.

Validation performed:

- `go test ./...` from `toolkits/buildos-intake/` using a temporary Go toolchain.
- `go build ./...` from `toolkits/buildos-intake/` using a temporary Go toolchain.
- Manual UAT command sequence for wrapper-driven HTML-directory conversion and references-index rebuild using a temporary Build OS workspace.
- Wrapper smoke test with `BUILDOS_INTAKE_BIN=/tmp/buildos-intake-test`.
- End-to-end temp conversion and references-index rebuild using the compiled test binary.
- End-to-end temp conversion of the reported Mermaid HTML file, confirming nine `.mmd` side artifacts and fenced Mermaid blocks in the converted Markdown.
- `python3 system/.os/scripts/validate_config.py --self-test`
- `python3 system/.os/scripts/validate_config.py`
- `python3 .make-docs/scripts/check_path_hygiene.py --self-test`
- `python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json`
- Scoped local-link check over touched Markdown files.
- Developer-guide coverage pass found no dedicated Markdown linter configuration in the checkout; used repo config validation, make-docs path hygiene, scoped link checks, placeholder checks, and `git diff --check`.
- Scoped placeholder-token check over the updated developer guide and history record passed.
- Guide status check confirmed no new guide was created and the updated existing guide remains `status: draft`.
- Refreshed the project docs index after the developer-guide coverage update.
- User-guide coverage pass found no existing `docs/guides/user/` guide for intake and did not create one because P3's usable surface is operational rather than a shipped end-user workflow.
- `git diff --check`
- Scoped docs hygiene pass ran `.make-docs/scripts/check_markdown_style.py --format text` over 22 touched Markdown files, fixed source-wrapping drift, repaired truncated continuation text, reran scoped local-link and placeholder checks, and left only the intentional two-line overview blockquote in the truncation sanity scan.
- Boundary check confirmed no edits under `system/.make-docs/`, `system/docs/assets/`, or make-docs-owned `docs/assets/{references,templates,prompts}` during the P3 closeout passes. The current diff still contains the untracked `.make-docs/scripts/check_markdown_style.py` validation helper, which the hygiene pass used but did not modify.

PRD coverage decision: outcome `update-existing`. No new PRD number was needed because PRD 14 already established the toolkit deployment standard and PRD 07 already owns intake/conversion. Both were updated to record the no-`pdftotext`, minimal-PDF, local-only, and manual-fallback decisions.

Guide coverage decision: outcome `update-existing`. The developer toolkit guide now includes concrete `buildos-intake` examples and dependency boundaries. User-guide outcome remains `none` for `system/docs/guides/user/`; operational fallback guidance belongs in the administrative playbook.

Developer-guide coverage pass after final manual retest kept the outcome `update-existing`. `docs/guides/developer/buildos-toolkit-cli-development.md` already owns toolkit maintainer behavior, so no new guide was created. The guide was expanded with current `buildos-intake` maintenance rules for converted-source contracts, intake translation, side-artifact directories, HTML image/SVG/Mermaid preservation, minimal-PDF boundaries, manual fallback alignment, and regression-test expectations.

User-guide coverage pass outcome: `none`. The completed P3 work is an operating/admin toolkit workflow and maintainer-facing conversion surface, not a shipped end-user product workflow that belongs in `docs/guides/user/`. The current user-relevant operational fallback remains covered by `system/playbooks/administrative/manual-intake-conversion.md`, and the toolkit command surface is covered by the toolkit README and developer guide.

PRD reconciliation pass after final P3 closeout kept the outcome `baseline-change-note`. No new numbered PRD change doc was warranted because PRD 14 already carries the toolkit deployment revision and PRD 07 already owns intake/conversion. PRD 07 was updated in place to remove the stale `system/assets/converted/` source anchor and to clarify that accessible non-PDF embedded media and diagrams may be copied as side artifacts under the same source directory and linked from converted twins per the intake translation contract. The risk register remained unchanged because R-003 already covers enterprise toolkit distribution hardening and no new gap, open question, or rebuild risk was introduced.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../plans/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md](../../plans/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md) | Added the dedicated P3 implementation plan and orchestration notes. |
| [../../work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md](../../work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md) | Refreshed and completed the P3 backlog for `buildos-intake`. |
| [../../prd/07-intake-and-conversion.md](../../prd/07-intake-and-conversion.md) | Recorded minimal-PDF/manual-fallback stance, source-scoped asset anchors, and side-artifact behavior for intake conversion. |
| [../../prd/14-revise-deterministic-toolkit-deployment.md](../../prd/14-revise-deterministic-toolkit-deployment.md) | Updated initial toolkit target notes now that P3 implementation exists. |
| [../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md) | Added the narrow PDF posture to the toolkit deployment standard. |
| [../../../system/.os/contracts/intake-translation-contract.md](../../../system/.os/contracts/intake-translation-contract.md) | Added conversion body, side-artifact, source-type, and manual-fallback rules. |
| [../../../system/.os/contracts/converted-source-contract.md](../../../system/.os/contracts/converted-source-contract.md) | Linked intake translation and side-artifact rules. |
| [../../../system/playbooks/administrative/manual-intake-conversion.md](../../../system/playbooks/administrative/manual-intake-conversion.md) | Added PB-003 for manual and agent-assisted fallback conversion. |
| [../../../system/assets/AGENTS.md](../../../system/assets/AGENTS.md) | Added routing for converted twins and intake side artifacts. |
| [../../../system/.os/scripts/buildos-intake](../../../system/.os/scripts/buildos-intake) | Added thin wrapper for the packaged toolkit. |
| [../../../toolkits/buildos-intake/README.md](../../../toolkits/buildos-intake/README.md) | Documented command surface, conversion behavior, dependencies, and PDF limits. |
| [../../../toolkits/buildos-intake/go.mod](../../../toolkits/buildos-intake/go.mod) | Added Go module metadata for the toolkit. |

### Developer

| Path | Description |
| --- | --- |
| [../../guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Updated maintainer guide with `buildos-intake` commands, dependency constraints, conversion contracts, side-artifact rules, and regression-test expectations. |
| [../../../toolkits/buildos-intake/internal/intake/html.go](../../../toolkits/buildos-intake/internal/intake/html.go) | Preserved Markdown table newlines in HTML conversion after manual UAT caught flattened table output. |
| [../../../toolkits/buildos-intake/internal/intake/docx.go](../../../toolkits/buildos-intake/internal/intake/docx.go) | Preserved DOCX heading/list structure more faithfully after Word manual test feedback. |
| [../../../toolkits/buildos-intake/internal/intake/convert_test.go](../../../toolkits/buildos-intake/internal/intake/convert_test.go) | Added local conversion, index, PDF behavior, HTML table-shape/embed, and DOCX outline-structure tests. |

### User

None this session.
