# Phase Detail: Migration and Validation

## P3 - Scoped Field Migration and Hygiene

- Goal: migrate scoped artifact vocabulary from fixed fields to config-backed `systems`, `environments`, and `owners`, and make validation part of the initial implementation.
- Deliverables: updated playbook/data contract references, migrated scoped frontmatter, `system/.os/scripts/validate_config.py`, and a frontmatter hygiene check.
- Status: planned.

## Source Inputs

- [Adopter-Owned Config Surface](../../designs/2026-06-03-adopter-owned-config-surface.md)
- `system/.os/config/instance.yaml`
- `system/.os/contracts/config-contract.md`
- `system/.os/contracts/playbook-contract.md`
- `system/playbooks/**`
- future `.os/data/*.jsonl` contracts and indexes as they are created

## Workstreams

| Workstream | Owner | Output | Notes |
| --- | --- | --- | --- |
| Playbook contract migration | Worker C | `system/.os/contracts/playbook-contract.md` | Replace fixed `env`/`for` enum row with `systems`, `environments`, and `owners` lists. |
| Artifact frontmatter migration | Worker C | `system/playbooks/**/*.md` | Migrate scoped playbook frontmatter after the config contract and canonical config exist. |
| Data and index expectations | Worker C | data contract drafts and index builder expectations | Ensure structured rows and generated indexes use the same configured fields. |
| Config validator | Worker D | `system/.os/scripts/validate_config.py` | Validate config shape, uniqueness, slug format, cross references, and default references. |
| Frontmatter hygiene | Worker D | validation logic callable from `validate_config.py` | Parse Markdown frontmatter and reject legacy scoped fields or unconfigured IDs. |
| Validation documentation | Worker D | script help text, README comments, or contract notes as needed | Keep docs short; contract remains the authority. |

## Dependencies

- P2 must create the config contract and canonical config first.
- Playbook migration depends on a neutral config whose IDs can be used in shipped example artifacts.
- The frontmatter hygiene check should be designed so future index builders can call it without shelling out to a broad repository scan.

## Acceptance Checks

- `system/.os/scripts/validate_config.py` runs successfully against the shipped starter config.
- The validator fails duplicate IDs, invalid slug IDs, missing referenced systems, and invalid default references.
- The frontmatter hygiene check accepts configured `systems`, `environments`, and `owners` lists.
- The frontmatter hygiene check reports legacy `env` and `for` fields once migration is active.
- Active scoped docs/contracts no longer prescribe fixed instance-specific vocabulary.
- Any remaining references to legacy terms are either historical notes, explicit migration notes, or planned cleanup items.

## Execution Notes

This phase is complete only when validation runs. Do not treat `validate_config.py` as a later hardening task; it is part of the config contract rollout because configured vocabulary becomes a dependency for playbooks, data records, runs, findings, and generated indexes.
