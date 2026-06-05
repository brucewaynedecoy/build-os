# Runs Router

`system/workspace/runs/` stores immutable discovery run artifacts.

Create run artifacts with `buildos-discovery run discovery`. The live computer-use or browser harness remains external; this directory records prompts, inputs, raw findings, evidence, and outcomes after the run.

## Required Shape

Each run uses `RUN-NNN/` and contains:

- `run.md` for the human-readable summary.
- `raw-findings.md` for unqualified observations.
- `evidence/` for immutable evidence files.

The structured index row lives in [`../../.os/data/runs.jsonl`](../../.os/data/runs.jsonl). The contract is [`../../.os/contracts/run-record-contract.md`](../../.os/contracts/run-record-contract.md).

Do not edit closed run artifacts to qualify findings. Promote raw findings with `buildos-discovery qualify finding`, which creates a finding under [`../findings/`](../findings/) and appends to `findings.jsonl`.
