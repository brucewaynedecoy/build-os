---
title: "Phase 3: Entities Port"
kind: "work"
status: "active"
coordinate: "W1 R7 P3"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 3: Entities Port

## Purpose

Port `buildos entities` from the Go seed to the TypeScript core and CLI, with no intended behavior change. Discovery and design depend on entity resolution, so this port comes before P5.

## Overview

The Go seed in `toolkits/buildos/internal/entities/` and `toolkits/buildos/internal/cli/` provides resolve, validate, index, and consolidate operations. This phase moves that logic to `toolkits/buildos/src/core/entities/`, adds a thin adapter in `toolkits/buildos/src/cli/`, and turns the entities domain to `enforced` in the golden harness. The Go seed stays until P8, because the Go discovery and design modules import it.

## Entry Gate

- P2 exit gate passed: goldens are committed and the harness fails on a planted difference.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: Promise: `buildos entities` gives the same files, output, and exit codes as the Go seed ([PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)). The entity contract in [PRD 17 Entity Identity and Canonical Resolution](../../prd/17-entity-identity-and-canonical-resolution.md) is unchanged.
- Intended human outcome: An adopter or agent who runs entity commands sees the same results and recovery commands as before.
- Human-facing surface or indirect effect: `buildos entities` output, exit codes, and canonical JSONL writes.
- Implementation work: Stages 1 and 2.
- Evidence source or testing type selected under current authority: Golden parity suite for every entities case.
- Executor: Implementing agent.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Ported Go unit tests in `node:test` plus the enforced entities goldens, run on three operating systems. |
| Performance Testing | `not-needed-now` | Startup is characterized by `PERF-001`; no entity-specific decision depends on speed. |
| Guided Progress Review | `not-needed-now` | Parity with an existing surface is proven by goldens. |
| Unassisted Goal Testing | `not-needed-now` | The surface is unchanged, so no new discoverability question exists. |

Human Experience Review is separate. The agent checks that the index-failure diagnostic still names the exact recovery command. No experience handoff applies, because the surface is unchanged.

## Source PRD Docs

- [PRD 17 Component and Capability Map](../../prd/17-entity-identity-and-canonical-resolution.md#component-and-capability-map), [Entity commands](../../prd/17-entity-identity-and-canonical-resolution.md#entity-commands), [Atomic writes](../../prd/17-entity-identity-and-canonical-resolution.md#atomic-writes), [Derived index](../../prd/17-entity-identity-and-canonical-resolution.md#derived-index), [Terminal resolution](../../prd/17-entity-identity-and-canonical-resolution.md#terminal-resolution), and [Acceptance](../../prd/17-entity-identity-and-canonical-resolution.md#acceptance)
- [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface), [Output and Exit Contract](../../prd/20-buildos-cli-and-distribution.md#output-and-exit-contract), and [Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)
- [PRD 02 Module Map](../../prd/02-architecture-overview.md#module-map)
- Register: [`R-004`](../../prd/03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P3](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases)
- Design: [Decision 2, Port first](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#2-port-first-with-a-core-and-cli-split)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Core entity engine

### Tasks

- [x] t1: Port the graph loader to `src/core/entities/graph.ts`. Read every governed JSONL dataset under `.os/data/`, reject invalid JSONL and duplicate IDs, and index records by ID and entity type.
- [x] t2: Port terminal resolution to `src/core/entities/resolve.ts` with the same result shape, chain, and fail-closed diagnostics.
- [x] t3: Port compatibility and strict validation to `src/core/entities/validate.ts`.
- [x] t4: Port index rebuild to `src/core/entities/index.ts` with the same lexical ordering, `--check`, and `--apply` behavior.
- [x] t5: Port consolidation to `src/core/entities/consolidate.ts`. Keep dry run as the default. With `--apply`, validate the whole graph first, write through a temporary file on the same filesystem, replace only the affected JSONL file, and keep its permissions. When the index rebuild then fails, return `canonical_applied_index_failed` and the exact recovery command.
- [x] t6: Port the Go unit tests from `toolkits/buildos/internal/entities/*_test.go` to `node:test`. Add a Windows test for replacing an existing file during an apply.
  Status: done. The ported tests pass on macOS, Linux, and Windows in [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279) (A20), with the Windows apply test.

### Acceptance criteria

- A20: The ported unit tests pass on macOS, Linux, and Windows. Passed: [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279).
- A21: The core entity modules pass the P1 boundary test: no stdout, no `process.exit`, and no import from `src/cli/`.

### Dependencies

- P2 complete.

## Stage 2 - CLI adapter and parity gate

### Tasks

- [x] t7: Add `src/cli/commands/entities.ts`. Accept the Go flags (`--root`, `--mode`, `--id`, `--manifest`, `--check`, `--apply`, `--json`) and require `--root`.
- [x] t8: Turn the entities domain to `enforced` in the golden harness. Fix every difference. Add a parity exception only with a reason and an owner decision.
  Status: done. `entities` is enforced and matches the shared, darwin, linux, and win32 goldens (win32 with the PE-005 derived goldens) in [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279) (A22).
- [x] t9: Confirm that no `buildos-entities` or `buildos-lifecycle` name is added.
- [x] t10: Leave the Go seed in place. Record in the evidence report that the entities gate passed and that Go removal waits for P8.
- [x] t11: Repeat the P1 root-error checks for `entities` through the packaged binary. For `EACCES`, `ENOTDIR`, `ELOOP`, and `ENAMETOOLONG` roots, each `entities` command exits 3 and its JSON envelope names the given root, as [parity exception PE-004](./evidence.md#parity-exceptions) records. P1 checked these cases only at the dispatcher, through a test domain.
  Status: done. The bundled root-error checks pass on macOS, Linux, and Windows, with the Windows PE-004 values, in [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279).
- [x] t12: Read `$PWD` in the CLI adapter for the current-folder base, so a relative `--root` matches Go's `filepath.Abs` when the current folder is reached through a symlink. Add a Go golden for this case.
- [x] t13: Fix the Windows UNC root spelling for doubled separators in `src/core/shared/go-path.ts`. Parse the UNC server and the share, which can be empty, before collapsing repeated separators, as `GetFullPathNameW` does. Then `//foo//bar/..` is spelled `\\foo\`, as `GetFullPathNameW` then Go's `Clean` give, not `\\foo\bar`. Add `//foo//bar/..` and `//foo/bar/..` to the Windows native `GetFullPathNameW` comparison test. The defect is display-only, because containment uses the real path the OS resolves. It came from the independent review of `f505935` in [P1](./evidence.md#p1-review).
  Status: done. The unit test and the Windows native `GetFullPathNameW` comparison pass in [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279).
- [x] t14: Make the TypeScript atomic writes of `entities` (the entity-resolution index in `rebuild-index` and `consolidate`, and the canonical JSONL in `consolidate --apply`) sync the parent folder in a way that works on Windows. Go 1.24.1 opens the folder read-only and calls `Sync`, which Windows refuses with `Access is denied.` after the rename has committed ([parity exception PE-005](./evidence.md#pe-005-derived-goldens)). For example, skip the folder sync on Windows, or open the folder with the flags Windows needs. Add a test that runs on the Windows CI job: a successful `rebuild-index --apply` and `consolidate --apply` exit 0, report `write_status` `applied`, and leave no half-applied state (no temporary file, and the index matches the canonical data). The win32 goldens of `entities-rebuild-apply-missing-json`, `entities-consolidate-apply-json`, and `entities-consolidate-apply-index-failure-json` are the PE-005 derived goldens.
  Status: done. The atomic-apply tests pass on every operating system, and the Windows-only test passes on the Windows job, in [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279).

### Acceptance criteria

- A22: Every entities golden case passes byte for byte on three operating systems, including stdout, stderr, exit code, and written files. Passed: [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279).
- A23: The post-write index-failure case exits `6`, and its diagnostic names the exact recovery command, matching the golden.
- A24: `parity-exceptions.json` has no entities entry, or each entry links an owner decision.

### Dependencies

- Stage 1 passes its tests.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran: the ported Go unit tests and the enforced entities goldens pass on macOS, Linux, and Windows in [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279). Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`, as planned.
- Performance evidence: None; not needed now. The bundle grew from 40,626 to 159,026 bytes (143,621 before the first review fix round, 156,841 after it); `PERF-001` was not re-run, and the P8 recheck must measure the current bundle ([P3 Open Items](./evidence.md#p3-open-items)).
- Human Experience Review: Done for the index-failure diagnostic. `entities-consolidate-apply-index-failure-json` matches its golden byte for byte (exit 6, `canonical_applied_index_failed`, and the exact `buildos entities rebuild-index --root "<root>" --mode strict --apply` recovery command in the diagnostic and in `recovery_command`), and four ported tests check the same for injected index failures.
- Optional experience handoff: Not applicable; surface unchanged.
- Explicit human acceptance gate: None.
- Evidence report: [P3 Entities Port](./evidence.md#p3-entities-port).
- Review fix round: the seven findings of the independent P3 review are fixed, each with a regression test against Go 1.24.1 output; t1, t4, and t5 were reopened and re-ticked after the checks ([P3 Review Fix Round](./evidence.md#p3-review-fix-round)).
- Review: three rounds returned CHANGES, and each fix has regression tests. The production code matched Go on all 67 reviewer fixtures. See [P3 Review](./evidence.md#p3-review) The CI fix round for `a227420` changed tests only, and its review passed ([P3 CI Fix Round](./evidence.md#p3-ci-fix-round)).
- Phase / capability status: Done. Stages 1 and 2 are done and checked (t1 to t14), and A20 to A24 pass. [CI run 45312281279](https://github.com/brucewaynedecoy/build-os/actions/runs/45312281279) passed all four jobs on macOS, Linux, and Windows with Node 24 plus OSV, and closed t6, t8, t11, t13, and t14 (A20, A22, and the Windows-only tests). The narrow review of the CI test fixes (`a227420`) passed. The owner approved PE-006, PE-007, and the PE-004 scope extension on 2026-11-23; see [P3 Review Fix Round 2](./evidence.md#p3-review-fix-round-2).
