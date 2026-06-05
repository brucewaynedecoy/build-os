---
title: "Validate System Data and Indexes"
path: "validate/system-data/and-indexes"
status: draft
version: "2026-06-05"
order: 130
tags:
  - validation
  - data
  - indexes
applies-to:
  - system/.os/data
  - system/.os/indexes
related:
  - "./build-os-getting-started.md"
  - "./configure-adopter-owned-metadata.md"
  - "./convert-source-material-with-buildos-intake.md"
  - "./use-playbooks-and-active-indexes.md"
  - "../../../system/.os/contracts/entity-records-contract.md"
  - "../../../system/.os/contracts/extraction-contract.md"
  - "../developer/operating-layer-contracts-maintenance.md"
---

# Validate System Data and Indexes

## Overview

Use this guide when you need to check that Build OS config, scoped metadata, structured data, and derived indexes are consistent. The current validator is `system/.os/scripts/validate_config.py`.

Structured system data lives under `system/.os/data/`. Derived lookup catalogs live under `system/.os/indexes/`. Indexes are rebuildable; data rows are the records that other workflows depend on.

## Before You Begin

- Work from the repository root.
- Run validation after changing config, playbook frontmatter, `.os/data/*.jsonl`, converted-source frontmatter, or generated indexes.
- Rebuild indexes from source artifacts before treating an index mismatch as a data failure.
- Keep adopter datasets out of `.os/data`; use `system/workspace/datasets/`.

## Getting Started

1. Run the validator self-test:

   ```sh
   python3 system/.os/scripts/validate_config.py --self-test
   ```

   Expected result: the command exits successfully. A failure means the validator behavior itself needs attention.

2. Run repository validation:

   ```sh
   python3 system/.os/scripts/validate_config.py
   ```

   Expected result: the command exits successfully with no validation errors.

3. Rebuild references after converted sources change:

   ```sh
   system/.os/scripts/buildos-intake index references
   ```

   Expected result: `system/.os/indexes/references.json` is regenerated from converted twin frontmatter.

4. Rebuild playbooks after playbook files change:

   ```sh
   system/.os/scripts/buildos-intake index playbooks
   ```

   Expected result: `system/.os/indexes/playbooks.json` contains the full playbook catalog plus an active-only `runnable_playbooks` list.

5. Run validation again:

   ```sh
   python3 system/.os/scripts/validate_config.py
   ```

   Expected result: config, data, scoped metadata, and generated indexes still agree.

## Core Workflow

Use `.os/data` for canonical structured rows:

| File | Purpose |
| --- | --- |
| `requirements.jsonl` | Requirement rows. |
| `capabilities.jsonl` | Capability rows. |
| `personas.jsonl` | Persona rows. |
| `test-cases.jsonl` | Test-case rows. |
| `results.jsonl` | Result rows. |
| `runs.jsonl` | Discovery run index rows. |
| `findings.jsonl` | Qualified finding index rows. |
| `extractions.jsonl` | Extraction load-plan rows. |

Use `.os/indexes` for derived catalogs:

| File | Rebuild command |
| --- | --- |
| `references.json` | `system/.os/scripts/buildos-intake index references` |
| `playbooks.json` | `system/.os/scripts/buildos-intake index playbooks` |

Do not edit a generated index to make validation pass. Fix the source artifact and rebuild.

## Troubleshooting

If a data row fails because of an ID prefix, compare the row ID to the entity-records contract. Requirement rows use `REQ`, capabilities use `CAP`, personas use `PER`, test cases use `TC`, results use `RES`, runs use `RUN`, findings use `FIND`, extractions use `EXT`, and playbooks use `PB`.

If a row fails because `source_anchor` is missing, add a real source anchor. Do not use placeholder evidence.

If a promoted row fails because `doc_anchor` is missing, either restore draft status when appropriate or add the target-docs anchor required by the contract.

If scoped metadata fails, update `system/.os/config/instance.yaml` or the artifact fields so `systems`, `environments`, and `owners` refer to configured IDs.

If `playbooks.json` is stale, rerun `system/.os/scripts/buildos-intake index playbooks` before editing playbook routers.

## FAQ

**Is `validate_config.py` the final validation architecture?**

No. It is the current shipped validator for config, scoped metadata, entity rows, extraction rows, and related hygiene. A future `buildos-config` toolkit may replace it.

**Should run and finding validation live in `validate_config.py`?**

No. Current discovery-run and finding-qualification write-path validation belongs to `buildos-discovery`.

**Can empty JSONL files be valid?**

Yes. Empty canonical files are valid until source evidence or workflows produce rows.

## Related Resources

- [Build OS Getting Started](./build-os-getting-started.md)
- [Configure Adopter-Owned Metadata](./configure-adopter-owned-metadata.md)
- [Convert Source Material With buildos-intake](./convert-source-material-with-buildos-intake.md)
- [Use Playbooks and Active Indexes](./use-playbooks-and-active-indexes.md)
- [Maintaining Operating Layer Contracts](../developer/operating-layer-contracts-maintenance.md)

## Future Coverage

- Add `buildos-config` instructions when config and structured-data validation move from the transitional Python script into a dedicated toolkit.
