---
title: "Phase 2: Golden Capture"
kind: "work"
status: "active"
coordinate: "W1 R7 P2"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 2: Golden Capture

## Purpose

Record what the Go tools do today, before any port starts. The goldens are the parity reference for P3 through P6. The comparison harness turns them into a CI gate.

## Overview

The phase builds a synthetic fixture set, captures the output of all four Go tools and the three legacy names, and adds a harness that compares the TypeScript CLI against those goldens. Each domain stays `pending` in the harness until its port phase turns it on. The Go tools stay in place and are built from source only for capture.

## Entry Gate

- P1 exit gate passed: CI is green on three operating systems, and the envelope and exit codes are covered by tests.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: Promise: commands, files, output, and exit codes match the Go tools for the same input, and PDF text matches after whitespace normalization ([PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)). This phase builds the evidence instrument for that promise.
- Intended human outcome: Existing adopters and their agents get the same results after the port. This phase makes any difference visible as a failing case.
- Human-facing surface or indirect effect: Indirect. The harness guards every ported command's output.
- Implementation work: Stages 1 through 3.
- Evidence source or testing type selected under current authority: Golden parity suite with a planted-difference self-test.
- Executor: Implementing agent; the maintainer runs the Go capture.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Golden capture plus the comparison harness and its self-test, run in CI on three operating systems. |
| Performance Testing | `not-needed-now` | No current decision depends on capture or comparison speed. |
| Guided Progress Review | `not-needed-now` | The harness output is maintainer-only and is checked by its self-test. |
| Unassisted Goal Testing | `not-needed-now` | No adopter goal is in this phase. |

Human Experience Review is separate. The agent checks that a failing case names the case, the field, and the first differing line, so a maintainer can act on it. No experience handoff applies.

## Source PRD Docs

- [PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)
- [PRD 20 Legacy Command Names](../../prd/20-buildos-cli-and-distribution.md#legacy-command-names)
- [PRD 07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data) (PDF normalization rule)
- [PRD 17 Component and Capability Map](../../prd/17-entity-identity-and-canonical-resolution.md#component-and-capability-map), [Entity commands](../../prd/17-entity-identity-and-canonical-resolution.md#entity-commands), [Atomic writes](../../prd/17-entity-identity-and-canonical-resolution.md#atomic-writes), and [Derived index](../../prd/17-entity-identity-and-canonical-resolution.md#derived-index)
- Register: [`R-004`](../../prd/03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P2 and cross-phase rules](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#cross-phase-rules)
- Design: [Decision 11, Parity and conversion quality](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#11-parity-and-conversion-quality)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Fixtures and case manifest

### Tasks

- [x] t1: Build a synthetic fixture set under `toolkits/buildos/test/fixtures/`. Cover entities (reuse `toolkits/buildos/testdata/persona-pilot/`), intake inputs for CSV, DOCX, multi-sheet XLSX, PDF (plain text, columns, tables, headers, footers, and one scanned page), HTML, and an HTML directory, references and playbooks index rebuilds, discovery runs, raw-finding anchoring, qualification, and design promotion for both routes. Use invented content only.
- [x] t2: Write the case manifest `toolkits/buildos/test/golden/cases.json`. Each case names an ID, the Go tool, the invocation name, arguments, fixture, and expected exit code. Cover success, dry run, usage error, missing root, invalid input, conflict, write failure, and index failure wherever the Go tool supports them, plus help and version for each tool.
- [x] t3: Mark in the manifest which commands had no JSON mode in Go. Their `--json` envelope is covered by the P1 contract tests, not by goldens.

### Acceptance criteria

- A13: The manifest has at least one success case and one error-exit case for each of the four Go tools, and help and version cases for each invocation name.
- A14: A reviewer scan of the fixtures finds no real client, person, or organization name. The agent records the scan in the evidence report.

### Dependencies

- P1 complete.

## Stage 2 - Capture from the Go tools

### Tasks

- [x] t4: Add a maintainer capture script, `toolkits/buildos/test/golden/capture.mjs`. It builds each Go tool from source into a temporary folder, never from an installed binary. For each case it copies the fixture into a fresh temporary folder, runs the case, and records stdout, stderr, exit code, any JSON output, and every added, changed, or removed file with its bytes under `toolkits/buildos/test/golden/<tool>/<case-id>/`.
- [x] t5: Capture all four Go tools: `buildos` (entities), `buildos-intake`, `buildos-discovery`, and `buildos-design`. Include every legacy-name invocation the wrappers in `system/.os/scripts/` use today.
- [x] t6: Normalize only values the Go output changes from run to run, such as temporary paths and timestamps. List each normalization in the manifest with its reason. Record the Go commit, Go version, and operating system in `toolkits/buildos/test/golden/CAPTURE.md`. Where Go output differs by operating system, capture per system or record a parity exception.
  - Status: done. Normalizations, `CAPTURE.md`, and all three per-OS sets are committed: `darwin` (local), `linux` (capture run 45293367433), and `win32` (capture run 45298345720, with the three PE-005 derived goldens). See [P2 Windows Goldens Import](./evidence.md#p2-windows-goldens-import).

### Acceptance criteria

- A15: Goldens exist for every manifest case. `CAPTURE.md` names the commit, Go version, and operating system for each capture.
- A16: Running the capture twice on the same commit gives identical golden files.

### Dependencies

- Stage 1 manifest is complete.

## Stage 3 - Comparison harness

### Tasks

- [x] t7: Add the harness `toolkits/buildos/test/golden/compare.test.ts`. It runs the bundled CLI for each case under the case's invocation name in a fresh fixture copy. It compares stdout, stderr, exit code, JSON, and the file tree byte for byte. For cases flagged as PDF text, it compares after whitespace and line-break normalization only.
- [x] t8: Add `toolkits/buildos/test/golden/parity-exceptions.json`. Each entry names the case, the field, the exact allowed difference, the reason, and a link to the owner decision. The harness fails on any difference without an entry, and on any entry that no longer matches a real difference.
- [x] t9: Give each domain a `pending` or `enforced` state. Pending domains are listed in the harness summary and do not fail CI. Turning a domain to `enforced` is the parity gate of its port phase.
- [x] t10: Make each failure name the case, the field, and the first differing line or byte offset.
- [x] t11: Add a planted-difference self-test. It changes one byte in a copy of a golden for stdout, stderr, a written file, and the exit code, and asserts that the harness fails each time. It also asserts that a whitespace-only PDF change passes and a changed PDF word fails.
- [x] t12: Run the harness in `.github/workflows/buildos-ci.yml` on all three operating systems. Write the refresh rule in `CAPTURE.md`: goldens change only by recapture from the Go tools with a recorded reason, never by copying the new CLI's output.
  - Status: done. The harness step and the refresh rule are in place, and [CI run 45298341110](https://github.com/brucewaynedecoy/build-os/actions/runs/45298341110) is green on three operating systems (A18).

### Acceptance criteria

- A17: The self-test fails for each planted difference and passes for the whitespace-only PDF change.
- A18: CI is green on three operating systems with all four domains `pending`, and the summary lists them.
- A19: A failure message from the self-test names the case, the field, and the first differing line.

### Dependencies

- Stage 2 goldens are committed.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran as decided: 158 golden cases (150, plus 8 from the review fix round), the comparison harness, the planted-difference self-test, and the fixture checks, all passing locally on macOS. Performance Testing, Guided Progress Review, and Unassisted Goal Testing stayed `not-needed-now`; nothing in this phase changed those reasons.
- Performance evidence: None; not needed now.
- Human Experience Review: Done by the implementing agent. Each failure line names the case, the field, and the first differing line with its byte offset, and shows the expected and actual line, for example `golden case cli-version, field stdout: first difference at line 4, byte offset 63: expected "version: eev", actual "version: dev"`. A maintainer can act on it without reading the harness. See the [evidence report](./evidence.md#p2-golden-capture).
- Optional experience handoff: Not applicable; maintainer-only surface.
- Explicit human acceptance gate: None.
- Per-OS goldens: by orchestrator decision, the 73 OS-dependent cases use goldens captured on each operating system, and the `buildos-golden-capture` workflow, run by a push to a `golden-capture/**` branch, captures the `linux`, `win32`, and `darwin` sets. See [Per-OS Goldens](./evidence.md#per-os-goldens) and the [P2 Review Fix Round](./evidence.md#p2-review-fix-round).
- Evidence report: [P2 Golden Capture](./evidence.md#p2-golden-capture).
- Phase / capability status: Done. Stages 1 to 3 are done and checked (t1 to t12), A13 to A19 pass, and the `darwin`, `linux`, and `win32` golden sets are committed. Five review rounds returned CHANGES; each fix is in the [P2 Review Fix Round](./evidence.md#p2-review-fix-round), [P2 Review Fix Round 2](./evidence.md#p2-review-fix-round-2), [P2 Stale Golden Fix](./evidence.md#p2-stale-golden-fix), [PE-005 Review Fix Round](./evidence.md#pe-005-review-fix-round), and [P2 Windows Goldens Import](./evidence.md#p2-windows-goldens-import). [CI run 45298341110](https://github.com/brucewaynedecoy/build-os/actions/runs/45298341110) closed A18. At commit time, the reviewer's check of the last round and the first CI run with the committed win32 set are pending. See [P2 Review](./evidence.md#p2-review).
