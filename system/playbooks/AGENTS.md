# Playbooks Router

Playbooks are typed Markdown **instruments** that guide a human or agent. The directory is the
playbook's `category`; frontmatter carries `execution_mode` and `state_nature`.

## Categories

- `administrative/` — system/environment setup, governance guardrails, data loading, running scripts.
- `build/` — compiling, packaging, deploying.
- `discovery/` — exploration; schema / form / UI / discoverability verification.
- `testing/` — unit / integration / end-to-end.

## To author a playbook

1. Read [`../.os/contracts/playbook-contract.md`](../.os/contracts/playbook-contract.md).
2. Copy the matching shape from [`../.os/templates/`](../.os/templates/) (guardrail vs procedure).
3. Place it in the right category directory; filename is a slug, `id: PB-NNN` in frontmatter.
4. Set `status: draft`. Activation (`reviewed → active`) is the **review-to-activate** gate; only
   `active` playbooks run (procedures) or are enforced (guardrails).

## Guardrails in force

- [administrative/respect-make-docs-plugin-boundary](administrative/respect-make-docs-plugin-boundary.md)
- [administrative/respect-configured-scoped-metadata](administrative/respect-configured-scoped-metadata.md)
