# Administrative Playbooks

Playbooks for system/environment setup, **governance guardrails**, data loading, and running system scripts. `category: administrative`.

To add one, follow [`../AGENTS.md`](../AGENTS.md) and the [playbook contract](../../.os/contracts/playbook-contract.md).

## Review gate

Only playbooks with `status: active` are runnable or enforced. Draft seed candidates are listed separately and do not currently run.

## Active procedures

- [PB-003 manual-intake-conversion](manual-intake-conversion.md) — create consistent converted-source twins when automated intake is unavailable or inadequate.

## Active guardrails

- [PB-001 respect-make-docs-plugin-boundary](respect-make-docs-plugin-boundary.md) — do not modify the make-docs-managed trees; use them via their own routers.
- [PB-002 respect-configured-scoped-metadata](respect-configured-scoped-metadata.md) — use configured `systems`, `environments`, and `owners` lists for scoped metadata.

## Draft seed candidates

- None in this category.
