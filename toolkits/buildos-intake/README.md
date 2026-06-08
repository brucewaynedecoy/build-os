# buildos-intake

`buildos-intake` is the first-party Build OS intake and conversion toolkit. It converts supported local source inputs into provenance-stamped converted twins and rebuilds derived operating-layer indexes.

In this development repository the default paths live under `system/`, such as `system/assets/` and `system/.os/indexes/`. In an installed Build OS system root, where `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/` are copied to the root, the same defaults automatically target top-level `assets/`, `.os/indexes/`, and `playbooks/`.

## Command Surface

```sh
buildos-intake convert --source <path> [--repo-root .] [--assets-root system/assets] [--type auto|csv|docx|xlsx|pdf|html|html-dir] [--force] [--dry-run]
buildos-intake index references [--repo-root .] [--assets-root system/assets] [--output system/.os/indexes/references.json]
buildos-intake index playbooks [--repo-root .] [--playbooks-root system/playbooks] [--output system/.os/indexes/playbooks.json]
```

Use the wrapper at `system/.os/scripts/buildos-intake` when operating through the Build OS script surface.

`buildos-intake index playbooks` writes `playbooks.json` with `playbooks` as the full catalog, including `draft`, `reviewed`, `active`, and `archived` entries, and `runnable_playbooks` as the active-only subset used by runnable procedure listings and enforceable guardrail listings.

## Conversion Behavior

| Source | Output | Notes |
| --- | --- | --- |
| CSV | `.csv` twin | Normalizes through Go CSV parsing/serialization and adds converted-source frontmatter. |
| DOCX | `.md` twin | Reads OOXML ZIP/XML locally, preserving paragraphs, headings, simple tables, and accessible embedded media as side artifacts. |
| XLSX | one `.csv` twin per worksheet | Reads OOXML ZIP/XML locally and copies accessible workbook media as side artifacts. |
| HTML | `.md` twin | Uses `golang.org/x/net/html` for local HTML parsing. Preserves local/data-URI image embeds, inline SVG diagrams, and Mermaid diagrams as side artifacts when accessible. |
| HTML directory | one `.md` twin per `.html`/`.htm` file | Uses deterministic relative-path slugs and keeps side artifacts under the shared source directory. |
| PDF | `.txt` twin | Uses `github.com/ledongthuc/pdf` for minimal local plain-text extraction only. |

All conversion is local-only. The CLI does not call network services and does not shell out to `pdftotext`, Poppler, OCR engines, or external converter utilities.

HTML diagram rendering is not part of P3. Mermaid diagrams are preserved as `.mmd` side artifacts and fenced `mermaid` code blocks instead of rendered images, keeping the converter dependency posture local and small.

## PDF Position

PDF support is intentionally limited. Build OS does not promise OCR, rich PDF parsing, table reconstruction, embedded-image extraction, layout fidelity, or a future rich-PDF roadmap.

If a PDF conversion produces no usable text or cannot be trusted, treat that as an expected fallback case. Teams may use another local tool of their choice, convert by hand, or use a capable multimodal agent, then write converted twins that follow the same contracts.

## Contracts

- Converted twin path, frontmatter, and status: [`system/.os/contracts/converted-source-contract.md`](../../system/.os/contracts/converted-source-contract.md)
- Body translation and side artifacts: [`system/.os/contracts/intake-translation-contract.md`](../../system/.os/contracts/intake-translation-contract.md)
- Playbook frontmatter and catalog inputs: [`system/.os/contracts/playbook-contract.md`](../../system/.os/contracts/playbook-contract.md)
- Generated index ownership: [`system/.os/indexes/AGENTS.md`](../../system/.os/indexes/AGENTS.md)
- Manual fallback procedure: [`system/playbooks/administrative/manual-intake-conversion.md`](../../system/playbooks/administrative/manual-intake-conversion.md)

## Dependencies

Default posture remains standard library first. P3 approves only these Go dependencies:

| Dependency | Purpose | License notes | Packaging review |
| --- | --- | --- | --- |
| `golang.org/x/net/html` | HTML parsing/tokenization | BSD-style Go Authors license | Go-project-maintained package; no native dependency. |
| `github.com/ledongthuc/pdf` | Rudimentary local PDF plain-text extraction via `GetPlainText()` | BSD-style Go Authors license in module | Go package only; no Poppler or `pdftotext` dependency. Review output quality with fixtures before expanding use. |

No other third-party or native dependency should be added without updating this README with rationale, license notes, and packaging review notes.

## Build and Test

From this directory:

```sh
go test ./...
go build ./...
```

Build a local runnable binary for the script wrapper:

```sh
mkdir -p bin
go build -o bin/buildos-intake ./cmd/buildos-intake
```

## References

- [Toolkit router](../AGENTS.md)
- [Build OS Toolkit CLI Development](../../docs/guides/developer/buildos-toolkit-cli-development.md)
- [PRD 07 Intake and Conversion](../../docs/prd/07-intake-and-conversion.md)
- [P4 data and extraction backlog](../../docs/work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md)
- [PRD 14 deterministic toolkit deployment revision](../../docs/prd/14-revise-deterministic-toolkit-deployment.md)
- [Toolkit CLI deployment standard design](../../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
