# buildos-intake Router

`toolkits/buildos-intake/` owns source and build metadata for the planned `buildos-intake` CLI.

## Routing

- This directory is scaffold-only until W1 R0 P3 begins.
- Before adding behavior, read [README.md](./README.md), [PRD 07](../../docs/prd/07-intake-and-conversion.md), and [PRD 14](../../docs/prd/14-revise-deterministic-toolkit-deployment.md).
- Keep conversion and reference-index logic in the toolkit once implemented.
- Keep `system/.os/scripts/` wrappers thin and avoid duplicating toolkit logic there.
- Do not add generated converted outputs, references indexes, sample customer data, or release binaries to this directory.

## Standards

- Binary name: `buildos-intake`.
- Default language: Go.
- Runtime posture: local-only.
- Dependency posture: standard library first; document any third-party or native dependency before introducing it.
- No network or service calls unless a future design explicitly approves them and adds opt-in CLI flags.
