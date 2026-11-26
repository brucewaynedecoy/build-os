---
title: "Phase 4: Intake Port"
kind: "work"
status: "active"
coordinate: "W1 R7 P4"
source:
  type: "prd"
  path: "docs/prd/07-intake-and-conversion.md"
---

# Phase 4: Intake Port

## Purpose

Port `buildos-intake` to `buildos intake`, choose the converter packages by evidence, and prove that converted documents keep every section. This is the only port that adds outside packages, so it also carries the supply-chain admission work.

## Overview

The phase first builds a conversion eval set with reference text that a person reviews once. It then compares two candidate packages for each format that needs one. Only after a choice is recorded does the port start. The gate is golden parity (PDF after whitespace normalization) plus the eval gate. OCR for scanned PDFs stays out of scope.

## Entry Gate

- P2 exit gate passed. P4 may run in parallel with P3.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: Promises: converted documents keep every section and stay highly accurate ([PRD 07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data)); intake output matches the Go tool, with PDF text matched after whitespace normalization ([PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)).
- Intended human outcome: An adopter who asks an agent to convert files gets twins with every section of the source, in the same places as before.
- Human-facing surface or indirect effect: Converted twins, `references.json`, the playbooks index, and `buildos intake` output.
- Implementation work: Stages 1 through 3.
- Evidence source or testing type selected under current authority: Conversion eval gate (section coverage and at least 98% text similarity per file against reviewed reference text) and the golden parity suite.
- Executor: Implementing agent; a person reviews the reference text once (t3).
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Eval runner, candidate comparison, ported unit tests, and enforced intake goldens on three operating systems. |
| Performance Testing | `not-needed-now` | Conversion time is `not-needed` in the [plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan); accuracy is the gate. |
| Guided Progress Review | `not-needed-now` | The reference review in t3 is a one-time input to the eval set, not a progress review. |
| Unassisted Goal Testing | `not-needed-now` | The conversion surface is unchanged for adopters. |

Human Experience Review is separate. The agent opens two converted twins, one of them a multi-column PDF, beside their sources and records whether section order and headings read the same. It records conclusions and limits. A short experience handoff is optional: convert one of your own files and check that every section is there.

## Source PRD Docs

- [PRD 07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data) (converter rules, accuracy gate, OCR out of scope)
- [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain) and [Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility)
- [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface)
- Register: [`R-011`](../../prd/03-open-questions-and-risk-register.md#r-011-conversion-accuracy-after-converter-change), [`R-010`](../../prd/03-open-questions-and-risk-register.md#r-010-supply-chain-exposure-in-enterprise-installs), [`R-004`](../../prd/03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P4](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases)
- Design: [Decision 11](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#11-parity-and-conversion-quality) and [Decision 12](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#12-outside-packages-and-supply-chain-safety)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Conversion eval set

### Tasks

- [x] t1: Build the eval set under `toolkits/buildos/test/conversion-eval/`. Add realistic invented files for CSV, DOCX, multi-sheet XLSX, HTML, an HTML directory, and PDF. The PDF files cover plain text, columns, tables, headers, and footers. Give each file a list of its sections.
- [x] t2: Draft the reference text for each file from its source content.
- [x] t3: **Needs a human reviewer.** A person reviews the reference text for each eval file once and corrects it. Record the reviewer, the date, and each file's approval in `toolkits/buildos/test/conversion-eval/REVIEW.md`. An agent cannot complete this task.
- [x] t4: Add the eval runner `toolkits/buildos/test/conversion-eval/eval.test.ts`. Declare the similarity method in the file before any candidate runs: character-level similarity after whitespace normalization. For each file, report every reference section found or lost and the similarity score. Fail when any section is lost or any score is below 98%.

### Acceptance criteria

- A25: `REVIEW.md` names a human reviewer and an approval date for every eval file.
- A26: The eval runner fails on a planted reference with one extra section and on a planted output with 97% similarity.

### Dependencies

- P2 complete.

## Stage 2 - Converter choice

### Tasks

- [x] t5: List the formats that Node built-in modules cannot handle. For each one, pick two candidate packages that pass every [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain) admission rule before evaluation. Expected candidates include `unpdf` for PDF text, `fflate` for DOCX and XLSX archives, and `parse5` for HTML, each against one alternative.
- [x] t6: Run the eval set with each candidate. Record per-file section coverage and similarity, bundle size, transitive packages, license, and scan status in the `Converter comparison` section of this backlog's `evidence.md`.
- [x] t7: Choose one package per format and state the reason. Pin it to an exact version in `package-lock.json`. Add it to `toolkits/buildos/SECURITY.md` with version, license, reason, transitive packages, scan status, and a short comparison summary. Add its license text to `THIRD_PARTY_NOTICES.md`.

### Acceptance criteria

- A27: For each format that needs an outside package, the evidence report shows two candidates compared on the full eval set and one choice with a reason.
- A28: `SECURITY.md` lists each chosen package with all required fields. `npm audit` and the OSV scan pass. `package.json` still has no `dependencies`, and the bundle contains the chosen code. Passed: `npm audit` and the dependency guards on all three test jobs and the OSV scan job of [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690).

### Dependencies

- Stage 1 eval set and reviewed references exist.

## Stage 3 - Port and parity gate

### Tasks

- [x] t8: Port the converters to `src/core/intake/convert/`: CSV, DOCX, XLSX with one CSV per sheet, minimal PDF text extraction, HTML, and the HTML-directory mirror convention. Keep embedded-media side artifacts as the intake translation contract describes.
- [x] t9: Port the `index references` and `index playbooks` rebuilds to `src/core/intake/index/`.
- [x] t10: Add `src/cli/commands/intake.ts` with the same arguments as `buildos-intake` (`convert`, `index references`, `index playbooks`).
- [x] t11: Port the Go unit tests from `toolkits/buildos-intake/internal/intake/*_test.go` to `node:test`.
- [x] t12: Turn the intake domain to `enforced` in the golden harness. Fix every difference. PDF cases compare after whitespace and line-break normalization. Add a parity exception only with a reason and an owner decision.
  - Status: done. Intake is `enforced` and matches the shared, darwin, linux, and win32 goldens (55/55; approved exceptions PE-001 to PE-010, PE-013, and PE-015; none pending) in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690) on macOS, Linux, and Windows (A29).
- [x] t13: Confirm the scanned-page PDF case behaves as the golden shows and that no OCR code or Poppler dependency is added.
- [x] t14: Leave `toolkits/buildos-intake/` in place. Record in the evidence report that the intake gate passed and that Go removal waits for P8.

### Acceptance criteria

- A29: Every intake golden case passes on three operating systems: byte for byte for all formats except PDF, and after whitespace normalization for PDF. Passed: [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690).
- A30: The eval gate passes with the chosen converters: no eval file loses a section, and every file scores at least 98%. The per-file table is in the evidence report.
- A31: The agent's review of two twins against their sources is recorded with its conclusion and limits.

### Dependencies

- Stage 2 choice is recorded.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran: the eval runner and gate (12/12 files pass with the chosen converters), the candidate comparison, the ported Go unit tests (`test/intake-core.test.ts`), the eval-set Go parity test (`test/intake-eval-parity.test.ts`), the hostile and malformed input tests (`test/intake-hostile.test.ts`, 96 tests), the intake write-target edge cases against Go (`test/intake-edge.test.ts`, 31 tests), and the enforced intake goldens (55/55, every PDF twin under the PE-009 class check in both directions). All of them, with the eval gate, the hostile tests, and the dependency guards, pass on macOS, Linux, and Windows with Node 24 in [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690). Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`.
- Performance evidence: None needed now. The bundle is 3,028,756 bytes after review round 3 (3,000,883 after the owner decision round, 2,996,289 after the review fix round, 3,187,594 before it); the P8 `PERF-001` recheck must measure it, and the reviewer's note (PDF initialization already deferred; a minified build reduced 3.19 MB to 2.04 MB) is recorded for P8. See the evidence report, P4 Closeout Numbers.
- Human Experience Review: Done by the agent on two twins (a two-column PDF and the DOCX handbook). Section order and headings read the same as the sources. Limits: two files, macOS only. See A31 in the evidence report.
- Optional experience handoff: Convert one of your own files with `buildos intake convert --source <file>` and check that every section is there. No reply needed.
- Explicit human acceptance gate: None. The owner's t3 reference review ("All 12 approved", 2026-11-23) is recorded in `REVIEW.md`.
- Evidence report: [P4 Intake Port](./evidence.md#p4-intake-port).
- Phase / capability status: Done. t1 to t14 are done and checked, and A25 to A31 pass. [CI run 45340971690](https://github.com/brucewaynedecoy/build-os/actions/runs/45340971690) on `52655a0` passed all four jobs (tests on macOS, Linux, and Windows with Node 24, and the OSV scan) and closed t12 (A29) and the CI part of A28. Review rounds 1 to 3 are fixed (see [P4 Review](./evidence.md#p4-review)): round 3 checks every write condition before the first write (PE-013 gains four preflight cases) and runs the PE-009 class check in both directions. Owner decisions of 2026-11-23: PE-008, PE-009, PE-010 with `--allow-outside-root`, PE-013, and PE-015 are approved; no exception is pending. After round 3, review continued on the merged P4 and P5 branch: the merge review (CHANGES) was fixed in `65b7ee7`, and the verification review (CHANGES) and the Windows OS error text were fixed in `52655a0` (see [P4 Review](./evidence.md#p4-review)). Earlier CI runs 45336979268 and 45339414591 failed on Windows and are superseded. Follow-ups carried forward are in [P4 Open Items](./evidence.md#p4-open-items).
