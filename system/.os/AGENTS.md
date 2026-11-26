# System Operating Router (`.os`)

`.os/` is the brain of this system — the entry point for **operating** it. It holds machinery, not deliverables. Read only what your task needs.

Read the [Root and Path Contract](contracts/root-and-path-contract.md) before writing paths or instructions. This directory is `.os/` at an initialized project root. The source checkout's `system/` package name is not an installed prefix.

## What lives here

- `contracts/` — the **authority** for every artifact type (entity records, playbook, run-record, finding, converted-source, extraction). Read the specific contract before writing an artifact. Not an output target.
- `config/` — adopter-owned instance configuration for configured systems, environments, and owners. Read `contracts/config-contract.md` before editing.
- `templates/` — starting shapes to copy. Authority is in `contracts/`.
- `indexes/` — derived catalogs; use `indexes/` for routing.
- `data/` — system-owned structured discovery data; use `data/` for routing.
- `skills/` — the BuildOS skills. Read [`skills/AGENTS.md`](skills/AGENTS.md) to pick one, to install one into your app, or to answer `buildos init` exit `10`.
- `scripts/` — thin wrappers, command routers, and compatibility shims. Durable tool logic, validation included, is in the BuildOS CLI (`buildos`), which the wrappers find and run. The BuildOS source checkout holds that logic in its separate `toolkits/` package.

## Routing by task

- **Author or run a playbook** → [`../playbooks/`](../playbooks/) (read [`contracts/playbook-contract.md`](contracts/playbook-contract.md) first).
- **Configure systems, environments, or owners** → [`config/`](config/) (read [`contracts/config-contract.md`](contracts/config-contract.md), start from [`templates/instance-config.yaml`](templates/instance-config.yaml) for a fresh instance).
- **Validate config, scoped frontmatter, or entity records** → run `.os/scripts/buildos validate` from the project root; see [`scripts/AGENTS.md`](scripts/AGENTS.md#validate).
- **Intake a source** → use `.os/scripts/buildos intake ...` (the wrapper [`scripts/buildos`](scripts/buildos); `.os\scripts\buildos.cmd intake ...` on Windows), convert under [`../assets/`](../assets/), rebuild [`indexes/`](indexes/), then extract through `data/`.
- **Use or install a BuildOS skill** → [`skills/AGENTS.md`](skills/AGENTS.md).
- **Write system discovery data** → `data/`.
- **Use or rebuild derived catalogs** → `indexes/`.
- **Record a run / qualify a finding** → `../workspace/runs/` and `../workspace/findings/`; index structured system records through `data/`.
- **Promote a qualified finding to a design** → cross into `../docs/` and obey **its** router (make-docs). Never write under `../docs/**` outside that router.

## Guardrails in force (read before acting)

- [Respect the make-docs plug-in boundary](../playbooks/administrative/respect-make-docs-plugin-boundary.md)
- [Respect configured scoped metadata](../playbooks/administrative/respect-configured-scoped-metadata.md)

## Boundary

Use `../docs/` and `../.make-docs/` only through their own Make Docs routers. Do not reach into a parent checkout's documentation tree. `../assets/` (ours) ≠ `../docs/assets/` (make-docs).
