# Contracts Router (`.os/contracts`)

The **authoritative** source for the required shape of each system artifact type. Read only the
specific contract your task needs; resolve structure/lifecycle questions here instead of
restating them elsewhere. **Not** an output target. Do not modify contracts unless explicitly asked.

## Contracts

- [`config-contract.md`](config-contract.md) — adopter-owned instance config (`systems`,
  `environments`, `owners`, and defaults).
- [`playbook-contract.md`](playbook-contract.md) — playbooks (incl. the guardrail variant).
- _to be added: entity-records, run-record, finding, converted-source, extraction._

## Use

Read the relevant contract **before** creating an artifact, then copy the matching shape from
[`../templates/`](../templates/) and conform it to the contract.
