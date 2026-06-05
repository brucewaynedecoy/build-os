# Workspace Router

`system/workspace/` stores local run artifacts, finding artifacts, and adopter-owned datasets used during Build OS operation.

Use `buildos-discovery` for discovery-run and qualified-finding writes. Do not hand-edit immutable run or finding artifacts except for deliberate manual recovery recorded in a history note.

## Routing

- Use [`runs/`](runs/) for immutable discovery run records and evidence created by `buildos-discovery run discovery`.
- Use [`findings/`](findings/) for qualified findings promoted by `buildos-discovery qualify finding`.
- Use [`datasets/`](datasets/) for local datasets consumed by playbooks or discovery runs.
- Structured indexes live in [`../.os/data/`](../.os/data/); do not duplicate JSONL records here.

Read the relevant contract before writing artifacts:

- [`../.os/contracts/run-record-contract.md`](../.os/contracts/run-record-contract.md)
- [`../.os/contracts/finding-contract.md`](../.os/contracts/finding-contract.md)
- [`../.os/contracts/entity-records-contract.md`](../.os/contracts/entity-records-contract.md)
