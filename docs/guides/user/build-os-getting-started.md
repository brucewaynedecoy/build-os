---
title: "Build OS Getting Started"
path: "build/os/getting-started"
status: draft
version: "2026-06-05"
order: 100
tags:
  - build-os
  - getting-started
  - adoption
applies-to:
  - system
  - toolkits
related:
  - "../../../README.md"
  - "./configure-adopter-owned-metadata.md"
  - "./validate-system-data-and-indexes.md"
  - "./convert-source-material-with-buildos-intake.md"
  - "./use-playbooks-and-active-indexes.md"
  - "./record-discovery-runs-and-qualify-findings.md"
  - "./understand-workspace-artifacts.md"
  - "../developer/operating-layer-contracts-maintenance.md"
---

# Build OS Getting Started

## Overview

Use this guide for a first successful pass through the shipped Build OS filesystem. Build OS is the reusable `system/` tree plus first-party `buildos-*` toolkits that help an adopter convert source material, operate playbooks, record discovery runs, qualify findings, and keep structured data reviewable in Git.

This guide is the entry point. It helps you identify the main spaces, run the first validation command, and choose the next guide for your task.

## Before You Begin

- Work from the repository root that contains `system/`, `toolkits/`, and `docs/`.
- Use Python 3 for the current config validator.
- Use the wrapper commands under `system/.os/scripts/` when operating the shipped system.
- Build or install toolkit binaries before using wrappers if the repo-local binaries are missing.

Build OS has four main spaces:

| Space | What it is for |
| --- | --- |
| `system/` | The shipped Build OS operating system that adopters use. |
| `system/.os/` | Contracts, config, templates, structured data, derived indexes, and wrappers. |
| `system/playbooks/` | Active guardrails and procedure playbooks that guide human or agent work. |
| `system/workspace/` | Run artifacts, qualified findings, local datasets, and evidence. |

The build-layer `docs/` directory explains how Build OS itself is designed and built. Do not treat build-layer PRDs or history records as adopter output.

## Getting Started

1. Run the validator self-test:

   ```sh
   python3 system/.os/scripts/validate_config.py --self-test
   ```

   Expected result: the command exits successfully. If it fails, the local validator or its fixtures need maintainer attention before you use the instance.

2. Validate the current shipped system:

   ```sh
   python3 system/.os/scripts/validate_config.py
   ```

   Expected result: the command exits successfully with no config, scoped metadata, or structured data validation errors.

3. Inspect the operating router:

   ```sh
   sed -n '1,160p' system/AGENTS.md
   sed -n '1,200p' system/.os/AGENTS.md
   ```

   Expected result: the routers point you to contracts, config, playbooks, workspace artifacts, and wrappers.

4. Choose the next guide for your task:

   | Task | Guide |
   | --- | --- |
   | Configure systems, environments, and owners | [Configure Adopter-Owned Metadata](./configure-adopter-owned-metadata.md) |
   | Convert documents, spreadsheets, PDFs, or HTML | [Convert Source Material With buildos-intake](./convert-source-material-with-buildos-intake.md) |
   | Validate data and rebuild indexes | [Validate System Data and Indexes](./validate-system-data-and-indexes.md) |
   | Review or operate playbooks | [Use Playbooks and Active Indexes](./use-playbooks-and-active-indexes.md) |
   | Record discovery runs and qualify findings | [Record Discovery Runs and Qualify Findings](./record-discovery-runs-and-qualify-findings.md) |
   | Decide where artifacts belong | [Understand Workspace Artifacts](./understand-workspace-artifacts.md) |

## Core Workflow

The current Build OS flow is:

1. Configure instance scope in `system/.os/config/instance.yaml`.
2. Convert local source material into provenance-stamped twins under `system/assets/`.
3. Rebuild derived indexes when converted sources or playbooks change.
4. Use active playbooks to guide discovery, testing, or administrative work.
5. Record discovery runs under `system/workspace/runs/`.
6. Promote only deterministically confirmed observations to qualified findings under `system/workspace/findings/`.
7. Keep adopter datasets under `system/workspace/datasets/`.

## Troubleshooting

If `validate_config.py` reports a scoped metadata error, check that artifacts use plural `systems`, `environments`, and `owners` fields and that every listed ID exists in `system/.os/config/instance.yaml`.

If a wrapper says a binary is missing, either build the repo-local binary from the matching toolkit directory or set the wrapper's environment variable to an installed binary path. For example, `BUILDOS_INTAKE_BIN` overrides `system/.os/scripts/buildos-intake`, and `BUILDOS_DISCOVERY_BIN` overrides `system/.os/scripts/buildos-discovery`.

If a discovery playbook cannot run, confirm it appears in `system/.os/indexes/playbooks.json` under `runnable_playbooks`, has `status: active`, and has `category: discovery`.

If you are not sure where a file belongs, start with [Understand Workspace Artifacts](./understand-workspace-artifacts.md). Do not add disposable manual-test evidence to the live shippable `system/` tree.

## FAQ

**Is `docs/` part of the shipped system?**

No. `docs/` is the build layer for Build OS itself. Adopters operate `system/` and its shipped toolkits.

**Can I edit `system/.os/config/instance.yaml`?**

Yes. It is adopter-owned configuration. Keep reusable contracts and templates neutral, and validate after editing it.

**Should I edit `system/.os/indexes/*.json` by hand?**

No. Indexes are derived lookup catalogs. Rebuild them from their source artifacts.

**Are run and finding artifacts editable after creation?**

Treat them as immutable. Record a new run or qualified finding instead of rewriting closed evidence, except for deliberate manual recovery that is separately recorded.

## Related Resources

- [Build OS README](../../../README.md)
- [Configure Adopter-Owned Metadata](./configure-adopter-owned-metadata.md)
- [Validate System Data and Indexes](./validate-system-data-and-indexes.md)
- [Understand Workspace Artifacts](./understand-workspace-artifacts.md)
- [Maintaining Operating Layer Contracts](../developer/operating-layer-contracts-maintenance.md)

## Future Coverage

- Add installation and packaged-binary guidance after Build OS has a finalized release and distribution flow.
