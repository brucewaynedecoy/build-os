# 13 Adopter-Owned Config Surface

## Purpose

Define the effective PRD requirement for an adopter-owned configuration surface that keeps reusable Build OS docs, contracts, templates, and validators neutral while each deployed instance can define its own systems, environments, and owners.

## Change Type

- Kind: `addition`
- Status: `active`
- Source design: [2026-06-03-adopter-owned-config-surface.md](../designs/2026-06-03-adopter-owned-config-surface.md)
- Source plan: [2026-06-03-w1-r1-adopter-owned-config-surface](../plans/2026-06-03-w1-r1-adopter-owned-config-surface/00-overview.md)

## Capability Addition or Enhancement

Build OS must add an adopter-owned config surface under the operational layer:

- `system/.os/config/instance.yaml` is the canonical instance configuration file owned by the adopting team.
- `system/.os/contracts/config-contract.md` defines schema shape, identifier rules, cross-reference behavior, defaults, and validation requirements.
- `system/.os/templates/instance-config.yaml` provides a neutral starter config with replaceable example values.
- `system/.os/scripts/validate_config.py` validates the instance config and the frontmatter/data references that depend on it.

The effective scoped vocabulary is:

- `systems`: configured systems, platforms, products, or applications in scope for the Build OS instance.
- `environments`: configured deployments, sandboxes, tenants, configurations, or execution contexts.
- `owners`: configured teams, organizations, vendors, internal groups, or other accountable parties.

These fields must be plural lists where artifacts can apply to multiple configured IDs. Legacy scoped vocabulary is superseded for contract purposes: `env`, `for`, `envs`, `target_systems`, and sentinel values such as `both` must not be introduced or retained as effective contract vocabulary.

## Affected Baseline Docs

- [00-index.md](./00-index.md) tracks this addition and connects impacted baseline docs to the effective requirement.
- [02-architecture-overview.md](./02-architecture-overview.md) is enhanced with `system/.os/config/` as a configuration surface and config-backed scoped fields.
- [06-operating-layer-and-routing.md](./06-operating-layer-and-routing.md) is enhanced so config is an operational authority alongside contracts, templates, indexes, data, and scripts.
- [08-data-and-extraction.md](./08-data-and-extraction.md) is enhanced so scoped structured rows use configured `systems`, `environments`, and `owners`.
- [09-playbooks.md](./09-playbooks.md) is superseded where it names `env`/`for` playbook frontmatter; playbooks now use config-backed scoped lists.
- [10-discovery-runs-and-qualification.md](./10-discovery-runs-and-qualification.md), [11-flow-c-integration.md](./11-flow-c-integration.md), and [12-stage-automation.md](./12-stage-automation.md) are enhanced to propagate and validate config-backed scoped metadata.
- [03-open-questions-and-risk-register.md](./03-open-questions-and-risk-register.md) remains the register entry for Q-002, which is closed by the config decision.

## Contracts and Data

`system/.os/contracts/config-contract.md` must define these top-level config properties:

| Property | Requirement |
| --- | --- |
| `version` | Integer schema version. |
| `instance` | Object containing a stable slug `id` and human-readable `name`. |
| `systems` | List of configured system records with unique slug IDs. |
| `environments` | List of configured environment records with unique slug IDs and `systems` references. |
| `owners` | List of configured owner records with unique slug IDs. |
| `defaults` | Optional default lists whose values reference configured IDs. |

Configured IDs must be stable slugs, unique within their collection, and referenced explicitly. `environments[].systems` entries must reference configured `systems[].id` values. `defaults.systems`, `defaults.environments`, and `defaults.owners` must reference configured IDs when present.

Reusable Build OS templates and contracts must not contain customer-, vendor-, product-, or engagement-specific configured values. The starter template may contain neutral example IDs only.

Frontmatter and structured rows that carry scoped metadata must use `systems`, `environments`, and `owners` as list fields. Empty lists are allowed only when the specific artifact contract permits system-neutral, environment-neutral, or owner-neutral scope.

## Integration Impact

The config surface affects operational contracts, generated indexes, playbook frontmatter, data rows, run records, findings, and docs handoff metadata. Artifacts that previously relied on fixed scoped tags must resolve scope through `system/.os/config/instance.yaml` and the config contract.

`system/.os/scripts/validate_config.py` is part of the initial implementation scope, not deferred hardening. It must validate the config file, configured ID uniqueness and slug format, `environments[].systems` references, `defaults.*` references, and scoped frontmatter/data references.

The validator must also include a frontmatter hygiene check for playbooks and other scoped Markdown artifacts. That check must parse Markdown frontmatter, require `systems`, `environments`, and `owners` to be lists of configured IDs, and report legacy scoped fields or unconfigured IDs as errors once the migration lands. The check may live inside `validate_config.py` initially, but it should be callable independently by future index builders or repository hygiene scripts.

## Required Baseline Annotations

- [02-architecture-overview.md](./02-architecture-overview.md) must link this change from `## Configuration Surfaces`.
- [06-operating-layer-and-routing.md](./06-operating-layer-and-routing.md) must link this change from its `.os/` component map or operational authority discussion.
- [08-data-and-extraction.md](./08-data-and-extraction.md) must link this change from `## Contracts and Data`.
- [09-playbooks.md](./09-playbooks.md) must link this change from `## Contracts and Data`.
- [10-discovery-runs-and-qualification.md](./10-discovery-runs-and-qualification.md), [11-flow-c-integration.md](./11-flow-c-integration.md), and [12-stage-automation.md](./12-stage-automation.md) must link this change from the sections that move, hand off, or validate scoped metadata.

## Source Anchors

- [2026-06-03-adopter-owned-config-surface.md](../designs/2026-06-03-adopter-owned-config-surface.md)
- [2026-06-03-w1-r1-adopter-owned-config-surface](../plans/2026-06-03-w1-r1-adopter-owned-config-surface/00-overview.md)
- [01-prd-and-contract-alignment.md](../work/2026-06-03-w1-r1-adopter-owned-config-surface/01-prd-and-contract-alignment.md)
- `docs/prd/03-open-questions-and-risk-register.md`
- `system/.os/contracts/playbook-contract.md`
- `system/.os/config/instance.yaml`
- `system/.os/contracts/config-contract.md`
- `system/.os/templates/instance-config.yaml`
- `system/.os/scripts/validate_config.py`
