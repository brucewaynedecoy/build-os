---
title: "Configure Adopter-Owned Metadata"
path: "configure/adopter-owned/metadata"
status: draft
version: "2026-06-05"
order: 110
tags:
  - config
  - scoped-metadata
  - adoption
applies-to:
  - system/.os/config
related:
  - "./build-os-getting-started.md"
  - "./validate-system-data-and-indexes.md"
  - "../../../system/.os/contracts/config-contract.md"
  - "../../../system/playbooks/administrative/respect-configured-scoped-metadata.md"
  - "../developer/operating-layer-contracts-maintenance.md"
---

# Configure Adopter-Owned Metadata

## Overview

Use this guide when you need Build OS to describe the systems, environments, and owners for your deployed instance. The canonical file is `system/.os/config/instance.yaml`.

This configuration is adopter-owned. Reusable Build OS contracts and templates stay neutral, while your instance config owns concrete IDs such as the target product, baseline environment, tenant, team, vendor, or platform owner.

## Before You Begin

- Read [Build OS Getting Started](./build-os-getting-started.md) if this is your first pass through the repository.
- Decide the smallest useful set of systems, environments, and owners before editing config.
- Use stable slugs. Renaming an ID later is a migration because playbooks, data rows, run records, findings, and docs can reference it.
- Keep credentials, secrets, and private access details out of this file.

## Getting Started

1. Open `system/.os/config/instance.yaml`.

2. Replace the example instance identity:

   ```yaml
   instance:
     id: example-instance
     name: Example Build OS Instance
   ```

   Expected result: `instance.id` is a stable slug and `instance.name` is a human-readable label.

3. Define systems:

   ```yaml
   systems:
     - id: primary-system
       name: Primary System
       description: The main system this Build OS instance is used to understand.
   ```

   Expected result: each `systems[].id` names a system, platform, product, or application in scope.

4. Define environments:

   ```yaml
   environments:
     - id: baseline
       name: Baseline
       systems:
         - primary-system
       description: A baseline or reference environment for comparison.
   ```

   Expected result: every `environments[].systems[]` entry matches a configured system ID.

5. Define owners:

   ```yaml
   owners:
     - id: adopter-team
       name: Adopter Team
       kind: team
   ```

   Expected result: each owner names an accountable team, organization, vendor, group, or equivalent party.

6. Validate the instance:

   ```sh
   python3 system/.os/scripts/validate_config.py
   ```

   Expected result: the command exits successfully with no missing references or scoped metadata errors.

## Core Workflow

Use these fields in scoped artifacts:

| Field | Meaning |
| --- | --- |
| `systems` | List of configured `systems[].id` values. |
| `environments` | List of configured `environments[].id` values. |
| `owners` | List of configured `owners[].id` values. |

Do not use legacy or local fields such as `env`, `envs`, `for`, `target_systems`, or hard-coded product names when the artifact contract expects Build OS scoped metadata.

Defaults under `defaults.systems`, `defaults.environments`, and `defaults.owners` are conveniences only. An artifact can use defaults only when its own contract allows that behavior.

## Troubleshooting

If validation reports an unknown system, environment, or owner, update either the artifact reference or `system/.os/config/instance.yaml` so both use the same configured ID.

If validation reports an environment system reference, check `environments[].systems[]`. Every value there must match a configured system ID.

If you are tempted to use a display name as an ID, create a lowercase slug instead. IDs should use lowercase ASCII letters, digits, and hyphens.

If a rename seems necessary, search for existing references first and treat the change as a migration across playbooks, data rows, run records, findings, indexes, and target docs.

## FAQ

**Can different environments point to the same system?**

Yes. Environments describe execution contexts, deployments, sandboxes, tenants, or configurations, and multiple environments can apply to the same system.

**Can owner IDs represent vendors or external organizations?**

Yes. Use `owners[].kind` to state whether an owner is a team, organization, vendor, group, or another adopter-defined kind.

**Should secrets or credentials be stored here?**

No. Store only identity and scope metadata. Keep credentials in the adopter's approved secret store.

## Related Resources

- [Build OS Getting Started](./build-os-getting-started.md)
- [Validate System Data and Indexes](./validate-system-data-and-indexes.md)
- [Config Contract](../../../system/.os/contracts/config-contract.md)
- [Respect Configured Scoped Metadata](../../../system/playbooks/administrative/respect-configured-scoped-metadata.md)
- [Maintaining Operating Layer Contracts](../developer/operating-layer-contracts-maintenance.md)

## Future Coverage

- Add migration examples after Build OS has a dedicated config toolkit and migration workflow.
