---
id: PB-002
title: Respect configured scoped metadata
category: administrative
execution_mode: n/a
state_nature: guardrail
status: active
audience: both
harness: [none]
systems: []
environments: []
owners: []
targets: []
produces: []
source_anchor: null
version: 1.0.0
related:
  - ../../.os/contracts/config-contract.md
  - ../../.os/contracts/playbook-contract.md
  - ../../.os/scripts/validate_config.py
---

## Scope

Applies to every human and agent creating or editing playbook frontmatter or other scoped
metadata that names systems, environments, or owners. Always in force.

## Rules

**MUST NOT**

- Use legacy scoped fields such as `env`, `envs`, `for`, or `target_systems`.
- Invent scoped-value enums inside artifacts, templates, playbooks, or contracts.
- Use sentinel values such as `all`, `any`, or `default` in scoped metadata lists.

**MUST**

- Use the list fields `systems`, `environments`, and `owners` for scoped metadata.
- Reference only configured IDs from `system/.os/config/instance.yaml` when a scope applies.
- Leave the relevant list empty only when that scope is genuinely not applicable.
- Validate config and scoped frontmatter with `system/.os/scripts/validate_config.py` when changing
  scoped metadata or its contracts.

## Rationale

Scoped metadata is useful only when it resolves to adopter-owned configuration. Keeping scope in
the configured list fields prevents parallel vocabularies, ambiguous routing, and validation gaps.
