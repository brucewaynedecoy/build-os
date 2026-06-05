---
id: PB-006
title: Run core validation
category: testing
execution_mode: inferred-actions
state_nature: standing
status: draft
audience: both
harness: [shell]
systems: [primary-system]
environments: [baseline]
owners: [platform-owner]
targets: [REQ-001, TC-001]
produces: [run-record, result]
source_anchor: null
version: 1.0.0
related:
  - ../../.os/contracts/playbook-contract.md
  - ../../../docs/prd/09-playbooks.md
---

# Run Core Validation

## Objective

Run the smallest trustworthy core validation set for the baseline system and capture pass, fail, or blocked evidence for `TC-001`.

## Steps & Guidance

Infer the concrete commands from the current repository rather than inventing a new validation flow.

- Find the standing validation entry points from local scripts, task runners, package metadata, Makefiles, justfiles, CI configuration, or project documentation.
- Prefer commands that validate configuration, contracts, unit behavior, and core integration paths over broad exploratory checks.
- Run the commands from the documented working directory with the baseline environment selected or recorded.
- Keep command output intact enough to explain the first failure and the final status.
- If a command is unavailable, choose the nearest documented equivalent and record why it was selected.
- Stop after the core validation set reaches a clear pass, fail, or blocked result.

## Expected Signals

Positive signals:

- The inferred command set is traceable to repository-owned validation entry points.
- Core validation commands complete successfully for the baseline environment.
- Output includes command, working directory, exit status, and enough log context for review.

Negative signals:

- A core validation command fails with a reproducible assertion, configuration, contract, or integration error.
- The available validation entry points conflict with each other or target the wrong system.
- Required baseline configuration is missing or invalid.

Inconclusive signals:

- No repository-owned validation entry point can be found.
- Required external services, credentials, or fixture data are unavailable.
- The command set cannot distinguish product failure from environment setup failure.

## Produces

- A validation result for `TC-001`.
- Run evidence that can be promoted into a run record when run storage is available.

## Notes / Links

- [Playbook Contract](../../.os/contracts/playbook-contract.md)
- [PRD 09 Playbooks](../../../docs/prd/09-playbooks.md)
