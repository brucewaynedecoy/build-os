---
title: "Understand Workspace Artifacts"
path: "understand/workspace/artifacts"
status: draft
version: "2026-06-05"
order: 160
tags:
  - workspace
  - artifacts
  - evidence
applies-to:
  - system/workspace
related:
  - "./build-os-getting-started.md"
  - "./record-discovery-runs-and-qualify-findings.md"
  - "./promote-qualified-findings-to-designs.md"
  - "./validate-system-data-and-indexes.md"
  - "../../../system/.os/contracts/run-record-contract.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../developer/operating-layer-contracts-maintenance.md"
---

# Understand Workspace Artifacts

## Overview

Use this guide when you need to decide where operational artifacts belong. `system/workspace/` stores local run artifacts, qualified finding artifacts, and adopter-owned datasets used during Build OS operation.

The workspace is evidence-oriented. It is not the place for generated indexes, canonical structured entity rows, or build-layer planning records.

## Before You Begin

- Read [Build OS Getting Started](./build-os-getting-started.md) if you are new to the repository.
- Use `buildos-discovery` to create run and finding artifacts instead of hand-writing immutable folders.
- Keep adopter-owned datasets under `system/workspace/datasets/`.
- Keep structured JSONL records under `system/.os/data/`.

## Getting Started

1. Inspect the workspace router:

   ```sh
   sed -n '1,160p' system/workspace/AGENTS.md
   ```

   Expected result: the router points to `runs/`, `findings/`, and `datasets/`.

2. Inspect run routing:

   ```sh
   sed -n '1,160p' system/workspace/runs/AGENTS.md
   ```

   Expected result: runs are described as immutable `RUN-NNN/` artifacts created by `buildos-discovery run discovery`.

3. Inspect finding routing:

   ```sh
   sed -n '1,180p' system/workspace/findings/AGENTS.md
   ```

   Expected result: qualified findings are described as `FIND-NNN/` artifacts created by `buildos-discovery qualify finding`, including the negative-assertion pattern.

4. Inspect dataset routing:

   ```sh
   sed -n '1,140p' system/workspace/datasets/AGENTS.md
   ```

   Expected result: local datasets are explicitly separated from `.os/data` and run/finding evidence.

## Core Workflow

Use these workspace locations:

| Path | Use |
| --- | --- |
| `system/workspace/runs/RUN-NNN/` | Immutable run summary, raw findings, prompts, inputs, evidence, and outcome. |
| `system/workspace/findings/FIND-NNN/` | Qualified finding artifact, deterministic confirmation test reference, confirmation evidence, and qualification notes. |
| `system/workspace/datasets/` | Local adopter-owned datasets consumed by playbooks, discovery runs, or qualification workflows. |

Use these operating-layer locations instead:

| Path | Use |
| --- | --- |
| `system/.os/data/runs.jsonl` | Structured run index rows appended by `buildos-discovery`. |
| `system/.os/data/findings.jsonl` | Structured qualified finding index rows appended by `buildos-discovery`. |
| `system/.os/indexes/` | Rebuildable lookup catalogs. |
| `system/assets/` | Converted source twins and side artifacts from intake conversion. |

Run artifacts and finding artifacts should be treated as immutable once written. If a run discovers a raw observation, leave it in that run's `raw-findings.md` until deterministic qualification promotes it to a `FIND-NNN` artifact.

## Troubleshooting

If a file is a dataset that a playbook consumes, put it under `system/workspace/datasets/` and reference it with a project-relative path.

If a file is evidence from a discovery run, use `buildos-discovery run discovery --evidence <path>` so it is copied into the run artifact.

If a file is confirmation evidence for a qualified finding, use `buildos-discovery qualify finding --confirmation-evidence <path>` so it is copied into the finding artifact.

If a qualified finding needs design or planning hand-off, use `buildos-design promote finding` so the finding keeps evidence traceability while the design lands under `system/docs/designs/`.

If a file is a generated index, keep it under `system/.os/indexes/` and rebuild it from source artifacts.

If a file is disposable manual-test input, use a scratch copy instead of adding it to the live shippable `system/` tree.

## FAQ

**Are raw findings the same as qualified findings?**

No. Raw findings stay inside a run. Qualified findings are promoted only after deterministic confirmation.

**Can datasets live in `.os/data`?**

No. `.os/data` is for system-owned structured records. Adopter datasets live under `system/workspace/datasets/`.

**Should I edit `runs.jsonl` or `findings.jsonl` manually?**

No for normal operation. Use `buildos-discovery` so the artifact folder and JSONL row are created together.

## Related Resources

- [Record Discovery Runs and Qualify Findings](./record-discovery-runs-and-qualify-findings.md)
- [Promote Qualified Findings to Designs](./promote-qualified-findings-to-designs.md)
- [Validate System Data and Indexes](./validate-system-data-and-indexes.md)
- [Workspace Router](../../../system/workspace/AGENTS.md)
- [Run Record Contract](../../../system/.os/contracts/run-record-contract.md)
- [Finding Contract](../../../system/.os/contracts/finding-contract.md)
- [Maintaining Operating Layer Contracts](../developer/operating-layer-contracts-maintenance.md)

## Future Coverage

- Add cleanup, retention, and archiving guidance after Build OS defines operational retention policy for workspace evidence.
