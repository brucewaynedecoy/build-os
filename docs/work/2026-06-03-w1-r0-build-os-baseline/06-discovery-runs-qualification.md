# Phase 06: Discovery, Runs & Qualification (Pillars 2–3)

## Purpose

This phase executes active discovery playbooks, records immutable runs, and qualifies findings via deterministic tests — the verify-to-promote gate, operationalized through the correct domain-owned toolkit.

## Overview

Implement P6 through a dedicated `buildos-discovery` Go toolkit. The toolkit owns discovery-run recording, raw-finding anchoring, finding qualification, negative assertions, and run/finding-specific validation. `buildos-intake` must remain intake/conversion scoped, and `validate_config.py` must not accumulate P6 logic while it waits for a future `buildos-config` migration.

Correction status: remediated. The initial P6 implementation placed Flow B behavior in the wrong toolkit/script surfaces; remediation moved that behavior into `buildos-discovery` and restored the rejected surfaces to their intended ownership.

## Source PRD Docs

- [10 Discovery, Runs & Qualification](../../prd/10-discovery-runs-and-qualification.md)
- [16 Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Ownership Constraints

- Owning toolkit: `toolkits/buildos-discovery/` with binary `buildos-discovery`.
- Wrapper surface: a thin `system/.os/scripts/buildos-discovery` wrapper calls through to the packaged toolkit binary.
- Forbidden surfaces: do not implement P6 commands or run/finding behavior in `buildos-intake`; do not add run/finding-specific validation to `validate_config.py`.
- Transitional cleanup: the remediation must remove any P6-specific commands, runtime code, tests, README/guide claims, binary changes, and validation logic from the incorrect surfaces before P6 can close.

## Stage 1 - Toolkit Ownership Correction

### Tasks

- [x] t1: Create `toolkits/buildos-discovery/` with local `README.md`, `AGENTS.md`, `CLAUDE.md`, Go module metadata, and the `buildos-discovery` binary target.
- [x] t2: Remove P6 `run discovery` / `qualify finding` commands and Flow B runtime code from `buildos-intake`, returning that toolkit to intake/conversion/reference-index scope.
- [x] t3: Remove P6 run/finding-specific validation from `validate_config.py`; keep any future run/finding validation inside `buildos-discovery` until a deliberate `buildos-config` migration owns cross-domain validation.
- [x] t4: Update build-layer docs that currently describe P6 as `buildos-intake` behavior so they point to `buildos-discovery` instead.

### Acceptance criteria

- `buildos-intake` no longer exposes or documents P6 run/finding commands.
- `validate_config.py` no longer contains P6 run/finding-specific logic.
- `buildos-discovery` is the only durable implementation surface for P6 Flow B commands.

### Dependencies

- [16 Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md).

## Stage 2 - Runs

### Tasks

- [x] t5: Implement `buildos-discovery run discovery` to require an active `category: discovery` playbook from `system/.os/indexes/playbooks.json`.
- [x] t6: Implement immutable `system/workspace/runs/RUN-NNN/` run artifacts with `run.md`, `raw-findings.md`, copied `evidence/`, playbook version, targets, dataset refs, and outcome.
- [x] t7: Append one `type: "run"` row to `system/.os/data/runs.jsonl` with `outcome`, `playbook_id`, `playbook_version`, target IDs, artifact counts, and object-shaped `inputs`/`outputs`.
- [x] t8: Author or verify the `workspace/`, `workspace/runs/`, and `workspace/datasets/` routers without duplicating contract schema.

### Acceptance criteria

- Run records are immutable and carry an `outcome` of `positive`, `negative`, or `inconclusive`.
- A run references the active playbook and version it executed and the entity `targets` it addressed.
- Raw findings stay in the source run artifact and are not promoted to `FIND-NNN` rows.

### Dependencies

- Phase 04 (data + indexes), Phase 05 (active playbooks to run), Stage 1 ownership correction.

## Stage 3 - Qualification

### Tasks

- [x] t9: Implement `buildos-discovery qualify finding` to require an existing `RUN-NNN`, a source raw-finding anchor, outcome `positive` or `negative`, a deterministic Playwright confirmation test file, and confirmation evidence.
- [x] t10: Allocate the next `FIND-NNN`, create `system/workspace/findings/FIND-NNN/`, copy confirmation artifacts, and append one `status: "qualified"` finding row to `system/.os/data/findings.jsonl`.
- [x] t11: Implement the negative-assertion pattern: a negative finding qualifies only when a passing deterministic test asserts the negative condition as a regression guard.
- [x] t12: Author or verify the `workspace/findings/` router and negative-assertion guidance without duplicating contract schema.

### Acceptance criteria

- A finding is qualified only when a deterministic, repeatable test confirms it.
- Finding rows require `run_id`, raw anchor, confirmation test, confirmation evidence, and `status: "qualified"`.
- Negative findings qualify via a passing test that asserts the negative.

### Dependencies

- Stage 2.

## Stage 4 - Validation And Closeout

### Tasks

- [x] t13: Add `buildos-discovery` Go tests for ID allocation, immutable write refusal, duplicate ID rejection, inactive playbook rejection, outcome enum validation, raw finding not promoted, qualified finding promotion, missing raw-anchor rejection, and negative-assertion qualification.
- [x] t14: Run `go test ./...` from `toolkits/buildos-discovery/`, repository config validation, path hygiene, Markdown style checks for touched docs, and `git diff --check`.
- [x] t15: Correct the P6 history record after remediation, update D-002 in the risk register, and record the guide and PRD reconciliation outcomes.
- [x] t16: Defer live computer-use UAT only if the live harness or an active discovery playbook is unavailable; otherwise execute one active discovery playbook, record a run, then qualify one negative finding with a Playwright confirmation test.

Manual UAT result: deferred because the current generated playbook index has no active `category: discovery` playbook; `PB-005` is a draft discovery playbook and therefore correctly blocked by the active-only gate. Automated fake-harness tests cover run recording and negative finding qualification until a live active discovery playbook is available.

### Acceptance criteria

- Validation proves the correct toolkit owns P6 and the incorrect surfaces are clean.
- The history record does not describe the rejected implementation as a completed phase.
- If live harness UAT is unavailable, the deferral is recorded with a concrete blocker rather than silently skipped.

### Dependencies

- Stages 1–3.
