---
title: "Convert Source Material With buildos-intake"
path: "convert/source-material/with-buildos-intake"
status: draft
version: "2026-06-05"
order: 120
tags:
  - intake
  - conversion
  - source-material
applies-to:
  - buildos-intake
  - assets
related:
  - "entities-consolidation-curate-and-resolve-records.md"
  - "build-os-getting-started.md"
  - "validate-system-data-and-indexes.md"
  - "use-playbooks-and-active-indexes.md"
  - "../../../system/.os/contracts/converted-source-contract.md"
  - "../../../system/.os/contracts/intake-translation-contract.md"
  - "../../../system/playbooks/administrative/manual-intake-conversion.md"
  - "../maintainer/buildos-toolkit-cli-development.md"
  - "../maintainer/operating-layer-entities-consolidation-and-resolution.md"
persona: user
---

# Convert Source Material With buildos-intake

## Overview

Operational paths in this guide start at the initialized project root. It contains `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/`. Source links below point into the BuildOS checkout; those source directories are not required in your project.

Use this guide when you need to turn local source files into Build OS converted twins. Converted twins live under `assets/`, carry provenance frontmatter, and become source material for later extraction and review.

`buildos-intake` is intentionally limited to intake and conversion. It does not extract requirements, qualify findings, or run discovery.

Entity matching and canonical resolution remain outside `buildos-intake`. The `buildos` package provides the resolver and `buildos entities`, but intake conversion does not call them and no user-facing extraction writer is available yet. Pre-upgrade auditing remains proposal-only; reviewed consolidation is a separate copied-root-first workflow.

Run conversion as `.os/scripts/buildos intake ...`. The `.os/scripts/buildos-intake` wrapper and the legacy name `buildos-intake` give the same result; the legacy name stops working in BuildOS `0.3.0`. W2 will add project update and backup workflows.

## Before You Begin

- Work from the initialized project root.
- Use local source material only. The converter does not call network services.
- Confirm `.os/scripts/buildos intake help` runs. The wrapper always runs the version pinned in `.os/manifest.json`: an npm install of that version when there is one, else that version through `npx`. Both need Node.js 24 or newer.
- Decide whether automated conversion is appropriate. Some PDFs and complex documents need the manual fallback playbook.

## Getting Started

1. Check command help:

   ```sh
   .os/scripts/buildos intake help
   ```

   Expected result: the command prints the `convert`, `index references`, and `index playbooks` command surface.

2. Preview a conversion without writing:

   ```sh
   .os/scripts/buildos intake convert --source path/to/source.docx --dry-run
   ```

   Expected result: the command prints one or more `would write ...` lines under `assets/`.

3. Convert the source:

   ```sh
   .os/scripts/buildos intake convert --source path/to/source.docx
   ```

   Expected result: the command prints `wrote ...` for the converted twin and any side artifacts.

4. Rebuild the references index:

   ```sh
   .os/scripts/buildos intake index references
   ```

   Expected result: the command prints `wrote .os/indexes/references.json (<count> references)`.

5. Check the saved twin's provenance and index entry against the converted-source contract. Use a validator that supports your initialized project root. Read [Validate System Data and Indexes](validate-system-data-and-indexes.md) for the old Python validator's current limits.

## Core Workflow

Supported conversion inputs are:

| Input | Output |
| --- | --- |
| CSV | Normalized `.csv` twin with converted-source frontmatter. |
| DOCX | Markdown twin from local OOXML parsing. |
| XLSX | One CSV twin per worksheet. |
| HTML file | Markdown twin from local HTML parsing. |
| HTML directory | One Markdown twin per `.html` or `.htm` file. |
| PDF | Minimal plain-text `.txt` twin. |

Converted twins should contain source text, tables, and local side artifacts that support later extraction. They should not contain newly invented requirement IDs, capability classifications, findings, or load-plan decisions.

After redirect-aware extraction is implemented, an exact known entity ID will resolve to its terminal canonical ID before a new reference is stored. A unique approved alias or a versioned type-specific identity key may also reuse a canonical record. Fuzzy, semantic, colliding, or ambiguous matches must remain non-writing review candidates. These rules do not change converted-source intake or `references.json`.

Rebuild `.os/indexes/references.json` after converted twins change. Rebuild `.os/indexes/playbooks.json` after playbooks change.

## Troubleshooting

If the wrapper cannot run BuildOS, install Node.js 24 or newer. On a machine without registry access, also install the pinned version with npm (`npm install -g build-os@<pinned version>`, or from its tarball). Then run the command again. The wrapper prints the same advice.

If conversion refuses to overwrite an existing twin, rerun with `--force` only after reviewing the current output. Converted twins are source evidence for later work, so replacement should be deliberate.

If a PDF conversion is empty or unreliable, use another trusted local tool, manual conversion, or a capable local/manual review process, then follow the same converted-source and intake-translation contracts. Do not treat weak PDF output as authoritative.

If `index references` reports bad frontmatter, fix the converted twin frontmatter instead of editing the generated index by hand.

## FAQ

**Where do converted twins go?**

By default, under `assets/<source-slug>/`.

**Can I point the converter at a remote URL?**

No. Use local files or a local HTML directory.

**Does `buildos-intake` run OCR or Poppler?**

No. PDF support is minimal local plain-text extraction only.

**Should I manually edit `references.json`?**

No. It is derived from converted twin frontmatter. Rebuild it instead.

**Will conversion deduplicate personas?**

No. Conversion preserves source material. W1 R4 validates exact persona reuse behavior in the shared entity layer, but intake does not perform that match and there is not yet a user-facing extraction writer. Uncertain similarity always requires human review.

## Related Resources

- [Build OS Getting Started](build-os-getting-started.md)
- [Validate System Data and Indexes](validate-system-data-and-indexes.md)
- [Use Playbooks and Active Indexes](use-playbooks-and-active-indexes.md)
- [Curate and Resolve Duplicate Entity Records](entities-consolidation-curate-and-resolve-records.md)
- [BuildOS CLI README](../../../toolkits/buildos/README.md)
- [Manual Intake Conversion](../../../system/playbooks/administrative/manual-intake-conversion.md)
- [Build OS Toolkit CLI Development](../maintainer/buildos-toolkit-cli-development.md)
- [Entity Consolidation Maintainer Guide](../maintainer/operating-layer-entities-consolidation-and-resolution.md)

## Future Coverage

- Add extraction-loader steps when Build OS ships a dedicated extraction toolkit or user-facing extraction command.
- Blocked by: a user-facing extraction writer. Update when: it persists validated `minted`, `referenced`, and `updated` outcomes. Guide change: add verified extraction examples without implying that intake conversion owns entity matching.
