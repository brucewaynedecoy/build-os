# Config Contract

## Purpose

Authority for `config/instance.yaml`, the adopter-owned configuration file that defines the systems, environments, and owners used by this Build OS instance. Reusable Build OS contracts and templates define shape and lookup rules; this config file owns concrete configured values.

## Required Path

- Canonical config: `config/instance.yaml`
- Starter template: `templates/instance-config.yaml`
- Contract: `contracts/config-contract.md`

## Ownership Boundary

- `config/instance.yaml` is adopter-owned and may contain the deployed instance's real system, environment, and owner values.
- Reusable contracts and templates must stay neutral and must not contain customer-, vendor-, product-, or engagement-specific values.
- Artifact contracts must reference configured IDs from `config/instance.yaml`; they must not define their own scoped-value enums.

## Required Shape

| Field | Values / form | Notes |
| --- | --- | --- |
| `version` | integer | Config schema version. |
| `instance.id` | slug | Stable identifier for this Build OS instance. |
| `instance.name` | string | Human-readable instance name. |
| `systems` | list of system records | Systems, platforms, products, or applications in scope. |
| `environments` | list of environment records | Deployments, sandboxes, tenants, configurations, or execution contexts. |
| `owners` | list of owner records | Teams, organizations, vendors, internal groups, or other accountable parties. |
| `defaults.systems` | list of configured `systems[].id` values | Optional default scope for artifacts whose contract permits defaults. |
| `defaults.environments` | list of configured `environments[].id` values | Optional default scope for artifacts whose contract permits defaults. |
| `defaults.owners` | list of configured `owners[].id` values | Optional default scope for artifacts whose contract permits defaults. |

Each `systems` record must contain:

- `id` — stable slug, unique within `systems`.
- `name` — human-readable label.
- `description` — concise description of the configured system.

Each `environments` record must contain:

- `id` — stable slug, unique within `environments`.
- `name` — human-readable label.
- `systems` — list of configured `systems[].id` values this environment applies to.
- `description` — concise description of the configured environment.

Each `owners` record must contain:

- `id` — stable slug, unique within `owners`.
- `name` — human-readable label.
- `kind` — owner kind, such as `team`, `organization`, `vendor`, `group`, or another adopter-defined lowercase slug.

## ID Rules

- IDs are stable slugs: lowercase ASCII letters, digits, and hyphens only.
- IDs must start with a lowercase letter or digit.
- IDs must not contain spaces, underscores, path separators, or display punctuation.
- IDs must be unique within their own top-level collection.
- IDs are not globally unique across collections; readers must resolve them by field context.
- Rename IDs only as a migration, because playbooks, data rows, findings, run records, indexes, and docs handoffs may reference them.

## Cross-Reference Rules

- Every `environments[].systems[]` value must match one configured `systems[].id`.
- Every `defaults.systems[]` value must match one configured `systems[].id`.
- Every `defaults.environments[]` value must match one configured `environments[].id`.
- Every `defaults.owners[]` value must match one configured `owners[].id`.
- Defaults are optional conveniences, not automatic scope for every artifact. Each artifact contract decides whether defaults are allowed and whether an empty list is valid.

## Artifact Reference Rules

Artifacts that carry scoped metadata use these fields:

| Field | Values / form | Notes |
| --- | --- | --- |
| `systems` | list of configured `systems[].id` values | Empty only when the artifact contract allows system-neutral scope. |
| `environments` | list of configured `environments[].id` values | Explicit list; do not use sentinel values such as `both`. |
| `owners` | list of configured `owners[].id` values | Empty only when ownership is not applicable or the artifact contract allows owner-neutral scope. |

Legacy scoped fields such as `env`, `for`, `envs`, and `target_systems` are not effective contract vocabulary for new or migrated artifacts.

## Template Rules

- `templates/instance-config.yaml` must be copyable directly to `config/instance.yaml`.
- The template must include neutral example IDs for `systems`, `environments`, `owners`, and `defaults`.
- The template must not include adopter-, vendor-, product-, or engagement-specific examples.
- New instances should replace example IDs and labels before using Build OS against a real target system.

## Intended Follow-On

After editing `config/instance.yaml`, run the config validator from the repository root once
available:

- `python3 system/.os/scripts/validate_config.py`

Until that validator exists, check this contract manually before relying on configured IDs in playbooks, data rows, run records, findings, indexes, or docs handoffs.

## Link Rules

- Use relative Markdown links in contracts and routers.
- Reference this contract from artifact contracts instead of restating config schema details.
