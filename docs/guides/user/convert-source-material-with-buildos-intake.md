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
  - system/assets
related:
  - "./build-os-getting-started.md"
  - "./validate-system-data-and-indexes.md"
  - "./use-playbooks-and-active-indexes.md"
  - "../../../toolkits/buildos-intake/README.md"
  - "../../../system/.os/contracts/converted-source-contract.md"
  - "../../../system/.os/contracts/intake-translation-contract.md"
  - "../../../system/playbooks/administrative/manual-intake-conversion.md"
  - "../developer/buildos-toolkit-cli-development.md"
---

# Convert Source Material With buildos-intake

## Overview

Use this guide when you need to turn local source files into Build OS converted twins. Converted twins live under `system/assets/`, carry provenance frontmatter, and become source material for later extraction and review.

`buildos-intake` is intentionally limited to intake and conversion. It does not extract requirements, qualify findings, or run discovery.

## Before You Begin

- Work from the repository root.
- Use local source material only. The converter does not call network services.
- Confirm `system/.os/scripts/buildos-intake` can find a binary. It uses `BUILDOS_INTAKE_BIN`, then an installed `buildos-intake`, then the repo-local `toolkits/buildos-intake/bin/buildos-intake`.
- Decide whether automated conversion is appropriate. Some PDFs and complex documents need the manual fallback playbook.

## Getting Started

1. Check command help:

   ```sh
   system/.os/scripts/buildos-intake help
   ```

   Expected result: the command prints the `convert`, `index references`, and `index playbooks` command surface.

2. Preview a conversion without writing:

   ```sh
   system/.os/scripts/buildos-intake convert --source path/to/source.docx --dry-run
   ```

   Expected result: the command prints one or more `would write ...` lines under `system/assets/`.

3. Convert the source:

   ```sh
   system/.os/scripts/buildos-intake convert --source path/to/source.docx
   ```

   Expected result: the command prints `wrote ...` for the converted twin and any side artifacts.

4. Rebuild the references index:

   ```sh
   system/.os/scripts/buildos-intake index references
   ```

   Expected result: the command prints `wrote system/.os/indexes/references.json (<count> references)`.

5. Validate the system:

   ```sh
   python3 system/.os/scripts/validate_config.py
   ```

   Expected result: the converted source frontmatter, scoped metadata, and structured data remain valid.

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

Rebuild `system/.os/indexes/references.json` after converted twins change. Rebuild `system/.os/indexes/playbooks.json` after playbooks change.

## Troubleshooting

If the wrapper cannot find `buildos-intake`, build the local binary:

```sh
cd toolkits/buildos-intake
go build -o bin/buildos-intake ./cmd/buildos-intake
```

If conversion refuses to overwrite an existing twin, rerun with `--force` only after reviewing the current output. Converted twins are source evidence for later work, so replacement should be deliberate.

If a PDF conversion is empty or unreliable, use another trusted local tool, manual conversion, or a capable local/manual review process, then follow the same converted-source and intake-translation contracts. Do not treat weak PDF output as authoritative.

If `index references` reports bad frontmatter, fix the converted twin frontmatter instead of editing the generated index by hand.

## FAQ

**Where do converted twins go?**

By default, under `system/assets/<source-slug>/`.

**Can I point the converter at a remote URL?**

No. Use local files or a local HTML directory.

**Does `buildos-intake` run OCR or Poppler?**

No. PDF support is minimal local plain-text extraction only.

**Should I manually edit `references.json`?**

No. It is derived from converted twin frontmatter. Rebuild it instead.

## Related Resources

- [Build OS Getting Started](./build-os-getting-started.md)
- [Validate System Data and Indexes](./validate-system-data-and-indexes.md)
- [Use Playbooks and Active Indexes](./use-playbooks-and-active-indexes.md)
- [buildos-intake README](../../../toolkits/buildos-intake/README.md)
- [Manual Intake Conversion](../../../system/playbooks/administrative/manual-intake-conversion.md)
- [Build OS Toolkit CLI Development](../developer/buildos-toolkit-cli-development.md)

## Future Coverage

- Add extraction-loader steps when Build OS ships a dedicated extraction toolkit or user-facing extraction command.
