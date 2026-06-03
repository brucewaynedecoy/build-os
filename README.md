# Build OS

Build OS is a filesystem-based, agent-operable operating system for running discovery,
testing, requirements capture, design, and backlogging against a target system, platform, or
application.

It turns unstructured source material and hands-on exploration into verified, reproducible
knowledge and engineering-ready artifacts while staying plain-text, git-native, reviewable, and
usable by both human practitioners and agents.

## Repository Model

This repository contains two related layers:

- `docs/` is the build layer for this project. It records how Build OS itself is designed,
  planned, and implemented.
- `system/` is the reusable Build OS system that an adopting team operates.
- `system/docs/` is the target-docs layer inside the shipped system. It is where adopters capture
  discovery, design, PRD, plan, and work artifacts about their own configured systems.

The `docs/`, `.make-docs/`, `system/docs/`, and `system/.make-docs/` trees are managed by the
make-docs documentation system. Treat their local routers and contracts as authoritative when
working inside them.

## What Build OS Does

Build OS is organized around three pillars:

- Convert: deterministic intake that transforms source files such as documents, spreadsheets,
  PDFs, and HTML into clean text or CSV twins with provenance.
- Playbooks: typed Markdown instruments that guide humans and agents through discovery,
  testing, qualification, and guardrails.
- Workspace: executable and evidentiary artifacts such as run records, findings, datasets, and
  deterministic tests.

Those pillars support three chained flows:

- Intake and knowledge: `convert -> extract -> candidates`.
- Discovery and execution: `active playbook -> run -> raw finding -> qualify -> qualified finding`.
- Planning and engineering: `qualified finding -> design -> plan -> PRD -> work backlog`.

## Important Paths

| Path | Purpose |
| --- | --- |
| `system/AGENTS.md` | Entry point for operating the shipped system. |
| `system/.os/` | Operational layer for contracts, config, templates, indexes, data, and scripts. |
| `system/.os/contracts/` | Authority for Build OS artifact shapes and lifecycle rules. |
| `system/.os/config/instance.yaml` | Adopter-owned instance configuration. |
| `system/.os/templates/instance-config.yaml` | Neutral starter config for new instances. |
| `system/.os/scripts/validate_config.py` | Validator for config references and scoped frontmatter hygiene. |
| `system/playbooks/` | Typed playbooks and guardrails. |
| `system/workspace/` | Planned home for run records, findings, datasets, and execution artifacts. |
| `system/docs/` | Adopter deliverables about configured target systems. |
| `docs/designs/` | Build-layer design records for Build OS itself. |
| `docs/prd/` | Build-layer product requirements for Build OS itself. |

## Adopter-Owned Configuration

Reusable Build OS contracts and templates stay neutral. Instance-specific vocabulary belongs in
`system/.os/config/instance.yaml`, where adopters define:

- `systems`: the systems, platforms, products, or applications being discovered, tested,
  documented, or built.
- `environments`: deployments, sandboxes, tenants, configurations, or other execution contexts.
- `owners`: teams, organizations, vendors, internal groups, or other accountable parties.

Scoped artifacts refer to configured IDs through plural fields: `systems`, `environments`, and
`owners`. Legacy placeholder fields such as `env`, `envs`, `for`, and hard-coded target names are
not Build OS contract vocabulary.

## Working In This Repo

Start with the router nearest the work:

- For system operation, read `system/AGENTS.md`, then follow `system/.os/AGENTS.md`.
- For contracts, read the specific file under `system/.os/contracts/` before creating or changing
  that artifact type.
- For adopter-owned configuration, read `system/.os/contracts/config-contract.md` and validate
  changes with `system/.os/scripts/validate_config.py`.
- For build-layer planning, design, PRD, or work artifacts, use the corresponding router under
  `docs/`.
- For target-system deliverables, cross into `system/docs/` and obey that make-docs router.

## Validation

Run the config validator after changing config, playbook frontmatter, structured data references,
or scoped artifact vocabulary:

```sh
python3 system/.os/scripts/validate_config.py
```

Run the validator self-test after changing the validator or config contract behavior:

```sh
python3 system/.os/scripts/validate_config.py --self-test
```

For Markdown and repository hygiene work, also use the relevant make-docs validators from the
router for the documentation tree you changed.

## Design Records

The current architecture and config-surface decisions are captured in:

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-06-03-adopter-owned-config-surface.md`

The active product requirements live under `docs/prd/`.
