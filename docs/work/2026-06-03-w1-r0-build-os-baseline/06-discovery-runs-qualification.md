# Phase 06: Discovery, Runs & Qualification (Pillars 2–3)

## Purpose

This phase executes playbooks, records immutable runs, and qualifies findings via deterministic tests — the verify-to-promote gate, operationalized.

## Overview

Implement the run-record artifact and index, integrate the computer-use harness for discovery runs, and build the qualification flow that produces a deterministic confirmation test per finding (including the negative-assertion pattern).

## Source PRD Docs

- [10 Discovery, Runs & Qualification](../../prd/10-discovery-runs-and-qualification.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Runs

### Tasks

- [ ] t1: Implement `system/workspace/runs/<id>/` run-record artifacts (record + evidence + raw finding) and the `runs.jsonl` index.
- [ ] t2: Integrate the computer-use harness for executing active discovery playbooks, hydrating from `workspace/datasets/` as needed.
- [ ] t3: Author the `workspace/`, `workspace/runs/`, and `workspace/datasets/` routers.

### Acceptance criteria

- Run records are immutable and carry an `outcome` of `positive`, `negative`, or `inconclusive`.
- A run references the playbook and version it executed and the entity `targets` it addressed.

### Dependencies

- Phase 04 (data + indexes), Phase 05 (active playbooks to run).

## Stage 2 - Qualification

### Tasks

- [ ] t4: Implement the qualification flow producing `system/workspace/findings/<id>/` with a deterministic Playwright confirmation test and the `findings.jsonl` index.
- [ ] t5: Implement the negative-assertion pattern — a test that repeatably asserts the negative outcome (bug/gap) as a regression guard.
- [ ] t6: Author the `workspace/findings/` router and wire status (`qualified`) into `findings.jsonl`.

### Acceptance criteria

- A finding is qualified only when a deterministic, repeatable test confirms it; raw findings without a test stay in the run record.
- Negative findings qualify via a passing test that asserts the negative.

### Dependencies

- Stage 1.
