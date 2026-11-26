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
  - "configure-adopter-owned-metadata.md"
  - "validate-system-data-and-indexes.md"
  - "convert-source-material-with-buildos-intake.md"
  - "use-playbooks-and-active-indexes.md"
  - "record-discovery-runs-and-qualify-findings.md"
  - "promote-qualified-findings-to-designs.md"
  - "understand-workspace-artifacts.md"
  - "../maintainer/operating-layer-contracts-maintenance.md"
persona: user
---

# Build OS Getting Started

## Overview

Operational paths in this guide start at the initialized project root. It contains `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/`. Source links below point into the BuildOS checkout; those source directories are not required in your project.

Use this guide for a first successful pass through the shipped Build OS filesystem. Build OS uses the contents of its filesystem package plus separately installed first-party toolkits that help an adopter convert source material, operate playbooks, record discovery runs, qualify findings, promote qualified findings to designs, and keep structured data reviewable in Git.

This guide is the entry point. It helps you identify the main spaces, run the first validation command, and choose the next guide for your task.

## Before You Begin

- Work from your initialized project root. It does not need the `system/` or `toolkits/` source directories. BuildOS skills are in `.os/skills/`.
- Read the current validation limits in [Validate System Data and Indexes](validate-system-data-and-indexes.md).
- Use the wrapper commands under `.os/scripts/` when operating the shipped system.
- Make the toolkit binaries available through PATH or the wrapper's documented override.

Build OS has four main spaces:

| Space | What it is for |
| --- | --- |
| Project root | The location of the initialized BuildOS files. |
| `.os/` | Contracts, config, templates, structured data, derived indexes, and wrappers. |
| `playbooks/` | Active guardrails and procedure playbooks that guide human or agent work. |
| `workspace/` | Run artifacts, qualified findings, local datasets, and evidence. |

The build-layer `docs/` directory explains how Build OS itself is designed and built. Do not treat build-layer PRDs or history records as adopter output.

## Getting Started

1. Open `.os/config/instance.yaml` and read [Configure Adopter-Owned Metadata](configure-adopter-owned-metadata.md).
2. Run `.os/scripts/buildos help intake` (`.os\scripts\buildos.cmd help intake` on Windows). The command should show conversion and index commands. The wrapper needs Node.js 24 or newer.
3. Follow [Convert Source Material With buildos-intake](convert-source-material-with-buildos-intake.md) for a source-backed conversion.
4. Read [Validate System Data and Indexes](validate-system-data-and-indexes.md) before selecting a validation command. Use `.os/scripts/buildos validate`; the old Python validator is no longer used.

## Core Workflow

The current Build OS flow is:

1. Configure instance scope in `.os/config/instance.yaml`.
2. Convert local source material into provenance-stamped twins under `assets/`.
3. Rebuild derived indexes when converted sources or playbooks change.
4. Use active playbooks to guide discovery, testing, or administrative work.
5. Record discovery runs under `workspace/runs/`.
6. Promote only deterministically confirmed observations to qualified findings under `workspace/findings/`.
7. Promote qualified findings into designs under `docs/designs/` when solution framing or planning should start from the evidence.
8. Keep adopter datasets under `workspace/datasets/`.

## Troubleshooting

If `buildos validate` reports a scoped metadata error, check that artifacts use plural `systems`, `environments`, and `owners` fields and that every listed ID exists in `.os/config/instance.yaml`.

If a wrapper says that BuildOS needs Node.js 24 or newer, install Node.js 24 or newer and run it again. The wrapper always runs the version that `.os/manifest.json` pins. It uses an installed `buildos` only when it is an npm install of exactly that version: in the project's `node_modules` folder, or the first `buildos` on `PATH`. It reads only the package files and starts no program to check the version. A global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version through `npx`.

If a discovery playbook cannot run, confirm it appears in `.os/indexes/playbooks.json` under `runnable_playbooks`, has `status: active`, and has `category: discovery`.

If you are not sure where a file belongs, start with [Understand Workspace Artifacts](understand-workspace-artifacts.md). Do not add disposable manual-test evidence to your live project.

## FAQ

**Is `docs/` part of the shipped system?**

Yes. In your initialized project, `docs/` holds your adopter deliverables. The BuildOS source checkout has a separate top-level `docs/` for work on BuildOS itself. That maintainer directory is not copied into your project.

**Can I edit `.os/config/instance.yaml`?**

Yes. It is adopter-owned configuration. Keep reusable contracts and templates neutral, and validate after editing it.

**Should I edit `.os/indexes/*.json` by hand?**

No. Indexes are derived lookup catalogs. Rebuild them from their source artifacts.

**Are run and finding artifacts editable after creation?**

Treat them as immutable. Record a new run or qualified finding instead of rewriting closed evidence, except for deliberate manual recovery that is separately recorded.

## Related Resources

- [Build OS README](../../../README.md)
- [Configure Adopter-Owned Metadata](configure-adopter-owned-metadata.md)
- [Validate System Data and Indexes](validate-system-data-and-indexes.md)
- [Promote Qualified Findings to Designs](promote-qualified-findings-to-designs.md)
- [Understand Workspace Artifacts](understand-workspace-artifacts.md)
- [Maintaining Operating Layer Contracts](../maintainer/operating-layer-contracts-maintenance.md)

## Future Coverage

- Add installation and packaged-binary guidance after Build OS has a finalized release and distribution flow.
