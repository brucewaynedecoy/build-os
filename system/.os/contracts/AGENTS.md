# Contracts Router (`.os/contracts`)

The **authoritative** source for the required shape of each system artifact type. Read only the specific contract your task needs; resolve structure/lifecycle questions here instead of restating them elsewhere. **Not** an output target. Do not modify contracts unless explicitly asked.

## Contracts

- [`config-contract.md`](config-contract.md) — adopter-owned instance config (`systems`, `environments`, `owners`, and defaults).
- [`converted-source-contract.md`](converted-source-contract.md) — converted source artifacts.
- [`entity-records-contract.md`](entity-records-contract.md) — entity records.
- [`extraction-contract.md`](extraction-contract.md) — extracted source evidence.
- [`finding-contract.md`](finding-contract.md) — findings.
- [`intake-translation-contract.md`](intake-translation-contract.md) — converted twin body and side artifact translation rules for automated, manual, and agent-assisted intake.
- [`playbook-contract.md`](playbook-contract.md) — playbooks (incl. the guardrail variant).
- [`run-record-contract.md`](run-record-contract.md) — run records.

## Use

Read the relevant contract **before** creating an artifact, then copy the matching shape from [`../templates/`](../templates/) and conform it to the contract.
