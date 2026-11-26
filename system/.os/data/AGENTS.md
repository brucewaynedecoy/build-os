# Data Router (`.os/data`)

System-owned structured data about discovery lives here. This directory accepts only NDJSON,
JSONL, or CSV artifacts. User datasets live in `../../workspace/datasets/`.

## Before Writing

Read the relevant contract before creating or editing system data:

- [`../contracts/entity-records-contract.md`](../contracts/entity-records-contract.md) - entity records.
- [`../contracts/extraction-contract.md`](../contracts/extraction-contract.md) - extracted source evidence.
- [`../contracts/run-record-contract.md`](../contracts/run-record-contract.md) - run records.
- [`../contracts/finding-contract.md`](../contracts/finding-contract.md) - findings.

If the data is not system-owned discovery data, or it is not NDJSON, JSONL, or CSV, route it
outside this directory.
