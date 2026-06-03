# Adopter-Owned Config Surface

> Filename: `2026-06-03-adopter-owned-config-surface.md`.
> This design extends the Build OS architecture by adding a neutral, adopter-owned configuration
> surface for systems, environments, and ownership vocabularies.

## Purpose

Define how Build OS instances let adopting teams configure their own systems, environments, and
ownership vocabulary without baking engagement-specific values into reusable contracts, templates,
playbooks, or data records.

## Context

Build OS is intended to ship as a reusable filesystem system under `system/`, with operational
authority currently under `system/.os/`.
The first baseline slice validated routers, `system/.os/contracts/playbook-contract.md`, playbook
templates, and the guardrail playbook, but the playbook contract still treats scoped frontmatter
values as fixed enum values.
That is the wrong ownership boundary: reusable Build OS contracts should define field shape and
lookup rules, while adopters should own the concrete values that describe their systems and teams.

The current PRD risk register tracks this as Q-002, and `docs/prd/02-architecture-overview.md`
already identifies configuration surfaces as part of the architecture.
This design closes the vocabulary question by adding a first-class config surface instead of
deferring the decision until another adopter appears.

## Decision

Add an adopter-owned config directory under the operational layer:

- `system/.os/config/` holds adopter-owned configuration files.
- `system/.os/config/instance.yaml` is the canonical instance configuration file.
- `system/.os/contracts/config-contract.md` defines the required config shape, identifier rules,
  and reference behavior.
- `system/.os/templates/instance-config.yaml` provides a neutral starter file that new adopters can
  copy into `system/.os/config/instance.yaml`.
- `system/.os/scripts/validate_config.py` validates the config and the artifact frontmatter that
  references it.

The config contract should define these top-level collections:

| Collection | Purpose | Referenced by |
| --- | --- | --- |
| `systems` | The systems, platforms, products, or applications being discovered, tested, documented, or built. | Playbooks, entity records, findings, run records, docs handoffs |
| `environments` | Deployments, configurations, sandboxes, tenants, or other execution contexts for one or more systems. | Playbooks, runs, findings, extracted records |
| `owners` | Teams, organizations, vendors, internal groups, or other accountable parties. | Work items, findings, requirements, remediation records |

Use plural frontmatter and data fields everywhere the values can be multi-valued:

- Replace `env` with `environments`.
- Replace `for` with `owners`.
- Add `systems` wherever artifacts need to scope to one or more configured systems.
- Do not introduce `envs`, `for`, `target_systems`, or `both` as contract vocabulary.

Each value in `systems`, `environments`, and `owners` is a configured ID, not a hard-coded enum from
Build OS.
When an artifact applies to multiple values, list each configured ID explicitly.
When the scope is not applicable, use an empty list and let the artifact contract state whether an
empty list is valid for that artifact type.

The template config should be neutral and replaceable:

```yaml
version: 1

instance:
  id: example-instance
  name: Example Build OS Instance

systems:
  - id: primary-system
    name: Primary System
    description: The main system this Build OS instance is used to understand.

environments:
  - id: baseline
    name: Baseline
    systems:
      - primary-system
    description: A baseline or reference environment for comparison.
  - id: customized
    name: Customized
    systems:
      - primary-system
    description: An adopter-specific configured environment.

owners:
  - id: adopter-team
    name: Adopter Team
    kind: team
  - id: platform-owner
    name: Platform Owner
    kind: team

defaults:
  systems:
    - primary-system
  environments:
    - baseline
  owners: []
```

The config contract should require:

- `version` as an integer schema version.
- `instance.id` as a stable slug and `instance.name` as a human-readable label.
- Unique slug IDs within each top-level collection.
- `environments[].systems` entries that reference configured `systems[].id` values.
- `defaults.*` values that reference configured IDs and remain optional per artifact contract.
- No customer-, vendor-, product-, or engagement-specific values in reusable templates or contracts.

The playbook contract should change its scoped frontmatter rows from the current fixed `env` / `for`
enum to config-backed fields:

| Field | Values / form | Notes |
| --- | --- | --- |
| `systems` | list of configured `systems[].id` values | may be empty only when the playbook is system-neutral |
| `environments` | list of configured `environments[].id` values | explicit list; no `both` sentinel |
| `owners` | list of configured `owners[].id` values | empty when ownership is not applicable |

The same naming should be used for structured data rows, finding records, run records, generated
indexes, and docs handoff metadata.
Downstream validators should reject legacy `env` and `for` fields once the migration lands.

The initial implementation must include `system/.os/scripts/validate_config.py`, not defer validation
to a later hardening phase.
The validator should:

1. Validate `system/.os/config/instance.yaml` against `config-contract.md`.
2. Check uniqueness and slug format for all configured IDs.
3. Check cross-references from `environments[].systems` and `defaults.*`.
4. Scan playbook frontmatter and structured data for configured `systems`, `environments`, and
   `owners` IDs.
5. Report legacy `env` and `for` fields as migration errors once the new fields are accepted.

Add a frontmatter hygiene check as part of the same implementation.
That check should parse Markdown frontmatter for playbooks and other scoped artifacts, verify that
`systems`, `environments`, and `owners` are lists of configured IDs, and fail when legacy scoped
fields or unconfigured IDs appear.
The check can live inside `validate_config.py` initially, but it should be structured so it can be
called independently by future index builders or repository hygiene scripts.

## Alternatives Considered

**Keep fixed enum examples in each artifact contract.**
Rejected because it puts adopter vocabulary in reusable Build OS contracts and guarantees leakage
into future instances.

**Seed templates with first-engagement values and instruct adopters to replace them.**
Rejected because examples in authoritative contracts become de facto requirements for agents and
validators.

**Use `target_systems` instead of `systems`.**
Rejected for the config surface because teams deploying Build OS will read `systems` in the context
of their instance.
The shorter name is clearer in frontmatter and avoids turning every record into an explanation of
Build OS terminology.

**Keep `env` and `for` but make their values configurable.**
Rejected because both names are too terse for durable docs and data.
`environments` and `owners` are clearer, support multi-value lists naturally, and read better in
frontmatter, JSONL rows, generated indexes, and validation messages.

**Rename `system/.os/` as part of this change.**
Deferred.
The config surface can be implemented under the current operational namespace and mechanically
moved later if the project chooses a broader directory rename.
That keeps this decision focused on vocabulary ownership instead of mixing it with path migration.

## Consequences

Build OS contracts become neutral: they define structure, not adopter-specific values.
Adopters get one obvious place to configure the terms that make an instance fit their systems,
environments, and ownership model.
Playbook frontmatter and data rows become more verbose, but the field names are explicit enough to
survive generated docs, index rows, and validator output without extra explanation.

The migration has real blast radius.
It touches `system/.os/contracts/playbook-contract.md`, future data contracts, existing playbook
frontmatter, PRD references, work tasks that mention scoped tags, and any scripts that build indexes
from frontmatter.
The implementation should land as a planned contract/config migration, not as a search-and-replace.
Because configured vocabulary becomes a contract dependency, the migration is not complete until
`system/.os/scripts/validate_config.py` and the frontmatter hygiene check run successfully against
the shipped starter config and updated scoped artifacts.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](../assets/prompts/designs-to-plan-change.prompt.md)
- Why: This revises an already generated baseline architecture and work backlog by replacing fixed
  scoped vocabulary with adopter-owned configuration, including first-pass validation and
  frontmatter hygiene.
- Coordinate Handoff: W1 R0 baseline; planner should slot implementation across the operating-layer
  contract work, boundary/tagging work, data-layer extraction work, and playbook work rather than
  treating it as a new greenfield plan. The handoff should include `system/.os/scripts/validate_config.py`
  and the frontmatter hygiene check in the same implementation scope as the config contract and
  starter template.

## Design Lineage

- Update Mode: `new-doc-related`
- Prior Design Docs: [2026-06-03-build-os-architecture.md](./2026-06-03-build-os-architecture.md)
- Reason: This design extends the baseline architecture with the adopter-owned configuration surface
  needed to close Q-002 in [03-open-questions-and-risk-register.md](../prd/03-open-questions-and-risk-register.md).
