# System Operating Router (`.os`)

`.os/` is the brain of this system — the entry point for **operating** it. It holds machinery, not deliverables. Read only what your task needs.

## What lives here

- `contracts/` — the **authority** for every artifact type (entity records, playbook, run-record, finding, converted-source, extraction). Read the specific contract before writing an artifact. Not an output target.
- `config/` — adopter-owned instance configuration for configured systems, environments, and owners. Read `contracts/config-contract.md` before editing.
- `templates/` — starting shapes to copy. Authority is in `contracts/`.
- `indexes/` — derived catalogs; use `indexes/` for routing.
- `data/` — system-owned structured discovery data; use `data/` for routing.
- `scripts/` — thin wrappers, command routers, compatibility shims, and remaining temporary validators. Durable deterministic toolkit logic lives under root `toolkits/`.

## Routing by task

- **Author or run a playbook** → [`../playbooks/`](../playbooks/) (read [`contracts/playbook-contract.md`](contracts/playbook-contract.md) first).
- **Configure systems, environments, or owners** → [`config/`](config/) (read [`contracts/config-contract.md`](contracts/config-contract.md), start from [`templates/instance-config.yaml`](templates/instance-config.yaml) for a fresh instance).
- **Validate config or scoped frontmatter** → run [`scripts/validate_config.py`](scripts/validate_config.py).
- **Intake a source** → use `buildos-intake` or [`scripts/buildos-intake`](scripts/buildos-intake), convert under [`../assets/`](../assets/), rebuild [`indexes/`](indexes/), then extract through `data/`.
- **Write system discovery data** → `data/`.
- **Use or rebuild derived catalogs** → `indexes/`.
- **Record a run / qualify a finding** → `../workspace/runs/` and `../workspace/findings/`; index structured system records through `data/`.
- **Promote a qualified finding to a design** → cross into `../docs/` and obey **its** router (make-docs). Never write under `../docs/**` outside that router.

## Guardrails in force (read before acting)

- [Respect the make-docs plug-in boundary](../playbooks/administrative/respect-make-docs-plugin-boundary.md)
- [Respect configured scoped metadata](../playbooks/administrative/respect-configured-scoped-metadata.md)

## Boundary

Never modify the make-docs trees: `../docs/`, `../../docs/`, `../.make-docs/`, `../../.make-docs/`. Use them via their own routers. `../assets/` (ours) ≠ `../docs/assets/` (make-docs).
