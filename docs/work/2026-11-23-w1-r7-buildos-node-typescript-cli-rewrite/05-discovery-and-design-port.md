---
title: "Phase 5: Discovery and Design Port"
kind: "work"
status: "active"
coordinate: "W1 R7 P5"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 5: Discovery and Design Port

## Purpose

Port `buildos-discovery` to `buildos discovery` and `buildos-design` to `buildos design promote`, with no intended behavior change. Design promotion keeps writing under `docs/designs/`, so the boundary conflict tracked as `R-009` stays open.

## Overview

Both Go modules import the Go entities seed for canonical resolution. In the TypeScript package they call the P3 core entity resolver directly, never through a subprocess. The phase ends when both domains are `enforced` in the golden harness.

## Entry Gate

- P2 exit gate passed.
- P3 exit gate passed, because discovery and design resolve entities through the core.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: Promise: discovery and design promotion give the same files, output, and exit codes as the Go tools ([PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)). Preserved boundary: promotion still writes one design file under `docs/designs/` and nothing else in Make Docs-owned paths ([PRD 11 Contracts and Data](../../prd/11-flow-c-integration.md#contracts-and-data)).
- Intended human outcome: An adopter's discovery runs, findings, and promoted designs look the same as before.
- Human-facing surface or indirect effect: `buildos discovery` and `buildos design promote` output and written files.
- Implementation work: Stages 1 and 2.
- Evidence source or testing type selected under current authority: Golden parity suite for discovery and design cases.
- Executor: Implementing agent.
- Accepted obligation or deferral route: None. `R-009` stays an open register item, not an obligation of this backlog.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Ported Go unit tests and enforced discovery and design goldens on three operating systems. |
| Performance Testing | `not-needed-now` | No decision depends on discovery or promotion speed. |
| Guided Progress Review | `not-needed-now` | Parity with an existing surface is proven by goldens. |
| Unassisted Goal Testing | `not-needed-now` | The surface is unchanged. |

Human Experience Review is separate. The agent confirms that a dry-run promotion still shows the target design path before anything is written. No experience handoff applies, because the surface is unchanged.

## Source PRD Docs

- [PRD 10 Contracts and Data](../../prd/10-discovery-runs-and-qualification.md#contracts-and-data) and [Integrations](../../prd/10-discovery-runs-and-qualification.md#integrations)
- [PRD 11 Component and Capability Map](../../prd/11-flow-c-integration.md#component-and-capability-map) and [Contracts and Data](../../prd/11-flow-c-integration.md#contracts-and-data)
- [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) and [Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)
- [PRD 02 Module Map](../../prd/02-architecture-overview.md#module-map)
- Register: [`R-009`](../../prd/03-open-questions-and-risk-register.md#r-009-design-promotion-writes-a-make-docs-owned-path), [`R-004`](../../prd/03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P5](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases)
- Design: [Decision 10, Design promotion stays as it is](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#10-design-promotion-stays-as-it-is-with-a-tracked-risk)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Discovery port

### Tasks

- [x] t1: Port run recording, raw-finding anchoring, and finding qualification from `toolkits/buildos-discovery/internal/discovery/` to `src/core/discovery/`. Resolve playbook, target, and run IDs through `src/core/entities/` directly.
- [x] t2: Add `src/cli/commands/discovery.ts` with the same subcommands and arguments as `buildos-discovery` (`run` and `qualify`).
- [x] t3: Port the Go unit tests to `node:test`.
  - Status: done. `test/discovery.test.ts` passes on macOS, Linux, and Windows in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690).
- [x] t4: Turn the discovery domain to `enforced` in the golden harness. Fix every difference. Add a parity exception only with a reason and an owner decision.
  - Status: done. `discovery` is enforced and matches the shared, darwin, linux, and win32 goldens (43/43) in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690) (A32).

### Acceptance criteria

- A32: Every discovery golden case passes byte for byte on three operating systems. Passed: [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690).
- A33: A test shows that discovery resolves entities without spawning a process.

### Dependencies

- P3 complete.

## Stage 2 - Design promotion port

### Tasks

- [x] t5: Port promotion from `toolkits/buildos-design/internal/design/` to `src/core/design/promote.ts`. Keep the same design file path, content, and dry-run behavior.
- [x] t6: Add `src/cli/commands/design.ts` for `buildos design promote finding --finding-id <id> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]`.
- [x] t7: Port the Go unit tests to `node:test`.
  - Status: done. `test/design.test.ts` passes on macOS, Linux, and Windows in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690).
- [x] t8: Turn the design domain to `enforced` in the golden harness. Fix every difference.
  - Status: done. `design` is enforced and matches the shared, darwin, linux, and win32 goldens (25/25) in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690) (A34).
- [x] t9: Make no boundary fix for `R-009`. Promotion writes no Make Docs index and no file under `docs/` other than the one design file. Confirm at phase close that `R-009` is still open with its follow-up unchanged.
- [x] t10: Leave `toolkits/buildos-discovery/` and `toolkits/buildos-design/` in place. Record in the evidence report that both gates passed and that Go removal waits for P8.
- [x] t11: Make the TypeScript atomic replace of the findings index in `design promote` sync the parent folder in a way that works on Windows. Go 1.24.1 `syncDirectory` opens the folder read-only and calls `Sync`, which Windows refuses with `Access is denied.` after the rename has committed, and leaves a half-done promotion ([parity exception PE-005](./evidence.md#pe-005-derived-goldens)). For example, skip the folder sync on Windows, or open the folder with the flags Windows needs. Add a test that runs on the Windows CI job: a successful promotion exits 0, writes the design file, the finding record, and the findings index row, and leaves no half-applied state (no temporary file and no index row without its design file). On Windows, `design-promote-baseline`, `design-promote-change-redirected`, and `design-installed-promote` compare with the shared golden.
  - Status: done. The t11 test and the Windows-only test pass on the Windows job of [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690), and the three PE-005 design cases match the shared golden on Windows.

### Acceptance criteria

- A34: Every design golden case passes byte for byte on three operating systems, including the written design file. Passed: [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690).
- A35: A dry-run promotion writes nothing and reports `write_status` `planned` in JSON mode.
- A36: A file-tree diff of a promotion case shows exactly one new file under `docs/designs/` and no other change under `docs/` or `.make-docs/`.
- A37: The register shows `R-009` open, and its follow-up names the request for a public Make Docs design-create operation.

### Dependencies

- Stage 1 passes.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran. The ported Go unit tests (`test/discovery.test.ts`, `test/design.test.ts`) pass, and the golden harness enforces discovery (43/43) and design (25/25), on macOS, Linux, and Windows with Node 24 in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690). That run closed t3, t4, t7, t8, and t11. Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`.
- Performance evidence: None; not needed now. The bundle grew to 238,646 bytes in P5 and is 3,127,995 bytes after the P4-P5 merge; the P8 `PERF-001` recheck covers it.
- Human Experience Review: Done on macOS. `buildos design promote finding ... --dry-run` prints `would write system/docs/designs/<date>-<slug>.md (...)` before anything is written, and with `--json` it reports `write_status` `planned` and the same `design_path`. A file-tree check shows that the dry run writes nothing.
- Optional experience handoff: Not applicable; surface unchanged.
- Explicit human acceptance gate: None.
- Evidence report: [P5 Discovery and Design Port](./evidence.md#p5-discovery-and-design-port).
- Review round 1: two blockers and three major findings fixed and checked against the Go 1.24.1 tools (22 P5 edge goldens). The owner approved PE-011 (`--json` in flag position) and PE-012 (writes outside the root through a link are refused unless `--allow-outside-root`). See [P5 Review Fix Round 1](./evidence.md#p5-review-fix-round-1) and [P5 Merge Notes](./evidence.md#p5-merge-notes).
- Review round 2: two blockers and three major findings fixed: atomic index writes in discovery, an exact rollback in promotion (links stay links), `--allow-outside-root` for writes only, a retry when a folder appears during resolution, and raw-byte digests in the edge harness. See [P5 Review Fix Round 2](./evidence.md#p5-review-fix-round-2).
- Review round 3: two defects fixed: a promotion rollback keeps each link's own mode whatever the umask (macOS), and discovery fails as Go does on a read-only `runs.jsonl` or `findings.jsonl` (two new P5 edge goldens). The rollback's start-state restore and the index-link replacement are PE-014, approved (2026-11-23). See [P5 Review Fix Round 3](./evidence.md#p5-review-fix-round-3).
- Merge review and fixes: after the P4-P5 merge (`e1dc814`), the merge review (CHANGES: cleanup ownership, failed stream close, symlink rollback cleanup) was fixed in `65b7ee7`, and the verification review (CHANGES: cleanup naming, test pins) and the Windows OS error operation names were fixed in `52655a0`. See [P5 Review](./evidence.md#p5-review).
- Phase / capability status: Done. t1 to t11 are done and checked, and A32 to A37 pass. [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690) on `52655a0` passed all four jobs (tests on macOS, Linux, and Windows with Node 24, and the OSV scan). Earlier CI runs 45336979268 and 45339414591 failed on Windows and are superseded. `R-009` stays open. Follow-ups carried forward are in [P5 Open Items](./evidence.md#p5-open-items).
