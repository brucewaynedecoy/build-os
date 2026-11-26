# Playbooks Router

Playbooks are typed Markdown **instruments** that guide a human or agent. The directory is the playbook's `category`; frontmatter carries `execution_mode` and `state_nature`.

## Review gate

Playbooks become runnable or enforced only after the review-to-activate gate changes their frontmatter to `status: active`. Category routers keep active playbooks separate from draft seed candidates; only active sections are runnable or enforced.

## Categories

- [`administrative/`](administrative/AGENTS.md) — system/environment setup, governance guardrails, data loading, running scripts.
- [`build/`](build/AGENTS.md) — compiling, packaging, deploying.
- [`discovery/`](discovery/AGENTS.md) — exploration; schema / form / UI / discoverability verification.
- [`testing/`](testing/AGENTS.md) — unit / integration / end-to-end.

## To author a playbook

1. Read [`../.os/contracts/playbook-contract.md`](../.os/contracts/playbook-contract.md).
2. Copy the matching shape from [`../.os/templates/`](../.os/templates/) (guardrail vs procedure).
3. Place it in the right category directory; filename is a slug, `id: PB-NNN` in frontmatter.
4. Set `status: draft`. Activation (`reviewed → active`) is the **review-to-activate** gate; only `active` playbooks run (procedures) or are enforced (guardrails).

## Active guardrails in force

- [PB-001 administrative/respect-make-docs-plugin-boundary](administrative/respect-make-docs-plugin-boundary.md)
- [PB-002 administrative/respect-configured-scoped-metadata](administrative/respect-configured-scoped-metadata.md)

## Active procedures

- [PB-003 administrative/manual-intake-conversion](administrative/manual-intake-conversion.md)

## Draft seed candidates

Draft seed candidates are listed for review and authoring only. Do not run or enforce them until they are reviewed to `status: active`.

- [PB-004 build/package-build-artifact](build/package-build-artifact.md)
- [PB-005 discovery/inspect-ui-discoverability](discovery/inspect-ui-discoverability.md)
- [PB-006 testing/run-core-validation](testing/run-core-validation.md)
