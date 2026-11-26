---
title: "Phase 1: TypeScript Package Foundation"
kind: "work"
status: "active"
coordinate: "W1 R7 P1"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 1: TypeScript Package Foundation

## Purpose

Create the TypeScript package that every later phase builds on. This phase sets the build, tests, CI, the core and CLI split, and the shared output and exit contract. It also lands the license, the first security document, the supply-chain checks, and the `PERF-001` startup baseline.

## Overview

The package lives at `toolkits/buildos/`, beside the Go seed, which stays in place until P8. No domain command is ported here. The phase proves the shared contract with tests, so each port in P3 through P5 only adds domain logic.

## Entry Gate

- The W1 R7 PRD maintenance passed the [plan validation](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/04-validation-and-review.md), and the owner approved it.
- The owner approved this backlog for execution.
- [`D-005`](../../prd/03-open-questions-and-risk-register.md#d-005-legacy-editorial-prds-fail-prd-authority-validation) is closed by W1 R8 ([backlog](../2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md)): `make-docs run prd authority validate` exits zero. No P1 task starts before this.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `direct` for enterprise reviewers. Promise: a reviewer finds every outside package, its version, license, reason, and checks in one document ([PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain)). This phase writes the first version. P8 finishes it.
- Intended human outcome: A reviewer opens `toolkits/buildos/SECURITY.md` and can account for every package in the lockfile without reading code.
- Human-facing surface or indirect effect: `toolkits/buildos/SECURITY.md`; CI scan output. Indirect effect for adopters: a consistent exit code and envelope that agents can script against.
- Implementation work: Stages 1 through 4.
- Evidence source or testing type selected under current authority: Security-document review against `npm ls --all`, the lockfile, and the CI scan output; `node:test` contract tests for the envelope and exit codes.
- Executor: Implementing agent; review by the maintainer agent.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | `node:test` contract tests for envelope, exit codes, help, version, root handling, and the core boundary rule, run in CI on macOS, Linux, and Windows. |
| Performance Testing | Active (`characterize-now`) | `PERF-001` baseline; see the fields below. |
| Guided Progress Review | `not-needed-now` | No adopter-facing flow exists yet. Contract tests and the document review answer the current questions. |
| Unassisted Goal Testing | `not-needed-now` | No accepted authority activates it, and no adopter goal can be completed with this phase alone. |

Performance candidate `PERF-001`:

- Base maintenance action: `create`
- Performance applicability: `characterize-now`
- Canonical `PERF-###` profile link or `none`: `PERF-001`, written in this file under `## PERF-001 Profile` by t17 before the first pass. Target class `characterization-baseline`. Protected outcome: an agent-run command still feels immediate to a chat-app user. Decision informed: whether any command needs a lazy-load or bundling change before `0.1.0`. Comparable reference: the Go and Node startup figures in the [runtime-selection proof](../../designs/2026-08-14-build-os-runtime-selection-proof.md), used as context only unless the fingerprint matches.
- Finite evidence budget and stop-rule reference or `not-applicable`: Two characterization passes, one materially distinct correction attempt, one review cycle, one working day of elapsed investigation, compute limited to one maintainer machine plus the existing CI matrix, no external spend. Stop at budget exhaustion, or when a pass does not change the decision. Source: [plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan).
- Execution packet link or `not-applicable`: Rendered from the profile into the `PERF-001` section of this backlog's `evidence.md` by t18.
- Outcome and evidence handoff or `none`: Recorded by t19. The P8 recheck reuses this profile.
- Gate disposition and supported-scope limit or `not-applicable`: Characterization only. It informs a decision and does not block the phase. Scope: `buildos version` and `buildos help` from the bundled file on Node 24, on the measured machine class.

Human Experience Review is separate. The agent reviews `SECURITY.md` against the lockfile and scan output and records conclusions and limits. No experience handoff is needed, because no adopter-facing flow changes in this phase.

## Source PRD Docs

- [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package)
- [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) (core and CLI rules)
- [PRD 20 Output and Exit Contract](../../prd/20-buildos-cli-and-distribution.md#output-and-exit-contract)
- [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain)
- [PRD 02 Module Map](../../prd/02-architecture-overview.md#module-map) and [Runtime Boundaries](../../prd/02-architecture-overview.md#runtime-boundaries)
- Register: [`Q-013`](../../prd/03-open-questions-and-risk-register.md#q-013-cli-contract-details-left-open-by-the-design) (exit codes `10` and `1`, security document path), [`R-010`](../../prd/03-open-questions-and-risk-register.md#r-010-supply-chain-exposure-in-enterprise-installs), [`Q-012`](../../prd/03-open-questions-and-risk-register.md#q-012-when-to-build-the-mcp-adapter)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P1](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases); [performance plan](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan)
- Design: [Decisions 1 to 4, 12, and 16](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#decision)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Package scaffold and build

### Tasks

- [x] t1: Create `toolkits/buildos/package.json` for `@brucewaynedecoy/buildos` with `"type": "module"`, `"engines": { "node": ">=24.0.0" }`, `"license": "Apache-2.0"`, a `bin` entry `buildos` that points to the bundled entry file, and no `dependencies`. Pin every dev dependency (`typescript`, `esbuild`, `@types/node`) to an exact version and commit `package-lock.json`. Leave the Go files in place.
- [x] t2: Add `toolkits/buildos/tsconfig.json` with `strict` on and ESM module resolution for Node 24. Add npm scripts for `typecheck` (`tsc --noEmit`), `test` (`node --test`, Node's built-in test runner), and `build` (esbuild bundle of `src/cli/main.ts` into one ESM file with a Node shebang).
- [x] t3: Create the source layout: `toolkits/buildos/src/core/` for domain logic and `toolkits/buildos/src/cli/` for argument parsing with a small built-in parser that follows Go's `flag` package rules, output formatting, and exit mapping. Add no CLI framework or outside parsing package.
- [x] t4: Add a boundary test that fails when any file under `src/core/` uses `process.stdout`, `process.stderr`, `console`, or `process.exit`, or imports from `src/cli/`. The same test fails when `src/cli/` spawns `buildos` or another adapter to do domain work.
- [x] t5: Add the Apache-2.0 `LICENSE` at the repository root and at `toolkits/buildos/LICENSE`. Add an empty third-party notice file, `toolkits/buildos/THIRD_PARTY_NOTICES.md`, that later phases fill as packages land.
- [x] t6: Set the package `files` list so the tarball holds the bundle, `LICENSE`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, and `README.md`, and no Go source, `system/docs/`, or `system/.make-docs/`.

### Acceptance criteria

- A1: `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, and `npm run build` pass in `toolkits/buildos/` on Node 24.
- A2: `package.json` shows the engines floor, the Apache-2.0 license, an empty or absent `dependencies` field, and only exact dev-dependency versions. `LICENSE` exists at the repository root and in the package.
- A3: The boundary test fails on a planted `process.stdout.write` call in a file under `src/core/` and passes on the real tree.
- A4: `npm pack --dry-run` lists `LICENSE`, `SECURITY.md`, and `THIRD_PARTY_NOTICES.md`, and lists no `.go` file, `go.mod`, `system/docs/` path, or `system/.make-docs/` path.

### Dependencies

- Entry gate met.

## Stage 2 - Shared output and exit contract

### Tasks

- [x] t7: Add the root model in `src/core/shared/root.ts`. `--root` sets the root. Entity commands require an explicit `--root` whose `.os/data/` exists and never infer it. A command that defaults to the current folder never walks up to a parent folder.
- [x] t8: Add the JSON envelope type and serializer in `src/core/shared/envelope.ts` with `ok`, `command`, `version`, `source_revision`, `root`, `mode`, `write_status`, `result`, and `diagnostics`. `write_status` is one of `not_requested`, `planned`, `applied`, or `canonical_applied_index_failed`.
- [x] t9: Add the central exit code table in `src/cli/exit-codes.ts`: `0` success, `1` internal or unexpected failure, `2` usage error, `3` root or input cannot be loaded, `4` contract or validation conflict, `5` I/O or canonical-write failure, `6` canonical write committed but index rebuild failed, and `10` needs operator review. Map typed core errors to codes in one place. An uncaught error exits `1` with one short stderr line and no stack trace.
- [x] t10: Add `buildos help`, `buildos <domain> --help`, and `buildos version`. A source build reports version `dev` and source revision `unknown`. A release build injects both through an esbuild define.
- [x] t11: Add the diagnostics formatter. JSON mode emits stable diagnostic records. Human mode writes short messages to stderr. Informational notices go to stderr and never change stdout or the exit code of a successful command.
- [x] t12: Add `node:test` tests for every envelope field, every exit code including `10` and `1`, parse errors mapping to `2`, help and version in each registered domain, and the no-walk-up root rule.

### Acceptance criteria

- A5: `node dist/buildos.js version` prints `dev` and `unknown`. `node dist/buildos.js version --json` prints an envelope with all nine fields.
- A6: Tests drive each exit code through a test-only command or a stubbed core error. Code `10` is produced only by a needs-operator-review error. An injected unexpected error exits `1` and prints one stderr line with no stack trace.
- A7: A test run from a nested folder under a project root shows that the default-root model uses the current folder and does not use the parent's `.os/`.

### Dependencies

- Stage 1 builds and tests run.

## Stage 3 - CI and supply-chain checks

### Tasks

- [x] t13: Add `.github/workflows/buildos-ci.yml`. It runs on macOS, Linux, and Windows with Node 24 in `toolkits/buildos/`: `npm ci --ignore-scripts`, typecheck, test, build, and a smoke run of `node dist/buildos.js version`.
- [x] t14: Add an `npm audit --audit-level=high` step and an OSV scan of `toolkits/buildos/package-lock.json` to the workflow. A high or critical finding fails the job.
- [x] t15: Add a CI check that fails when `package.json` gains a `dependencies` entry or a dev dependency without an exact version.

### Acceptance criteria

- A8: One CI run, linked in the evidence report, is green on macOS, Linux, and Windows.
- A9: The workflow file shows `--ignore-scripts`, the audit step, and the OSV step. A test branch that pins a package with a known high finding fails the job; the run link is recorded.

### Dependencies

- Stage 2 tests pass locally.

## Stage 4 - Security document

### Tasks

- [x] t16: Write the first `toolkits/buildos/SECURITY.md`. State its readers (maintainers and enterprise engineering reviewers). State the [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain) admission rules. List every package in the lockfile with version, license, reason, transitive packages, and scan status, split into bundled runtime code (none yet) and build-time tools. Explain the bundling rule and the CI checks. Name provenance, SBOM, and release checks as coming in P8. Say how to report a vulnerability. Add an admission checklist that every new outside package must pass in the phase that adds it.

### Acceptance criteria

- A10: A reviewer compares `SECURITY.md` with `npm ls --all` and the latest CI scan output and finds no package missing and no version, license, or scan status that disagrees. The agent records the review, its conclusion, and its limits in the evidence report.

### Dependencies

- Stage 3 scan output exists.

## Stage 5 - PERF-001 startup baseline

### Tasks

- [x] t17: Write the `PERF-001` profile under a `## PERF-001 Profile` heading at the end of this file before any measurement. Use the shape in `make-docs://system/template/performance-evidence-profile.md`. Declare the build, Node version, machine class, cold and warm state, workload (`buildos version` and `buildos help` from the bundle, plus a no-op `--json` call), repetitions, statistic, uncertainty, outlier rule, comparison method, and raw-evidence location. Copy the budget above. Set no target.
- [x] t18: Render the execution packet into the `PERF-001` section of this backlog's `evidence.md`, with the fingerprint and the budget ledger.
- [x] t19: Run at most two passes and at most one correction attempt. Record the distribution, uncertainty, exclusions, ledger, and outcome. State the decision: either no lazy-load or bundling change is needed before `0.1.0`, or name the change and the phase that makes it. Hold one review cycle and stop.

### Acceptance criteria

- A11: The `PERF-001` profile exists in this file before the first pass, and its digest is recorded in the packet.
- A12: The evidence report shows at most two passes, at most one correction attempt, one review, no external spend, and a stated decision about lazy loading or bundling.

### Dependencies

- Stage 1 bundle builds.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing is active; the `node:test` suite (648 tests: 637 pass, 11 Go seed `entities` parity cases skipped until P3, after the final review fix round) passes locally on macOS with Node 24. [CI run 45282558470](https://github.com/brucewaynedecoy/build-os/actions/runs/45282558470) on `f505935` passed on macOS, Linux, and Windows with Node 24 (687 tests, 0 fail; 14 skipped on macOS and Linux, 34 on Windows) and passed the OSV job. Performance Testing ran as `characterize-now` (below). Guided Progress Review and Unassisted Goal Testing stay `not-needed-now` for the reasons in the testing table.
- Performance evidence: `PERF-001` pass 1 outcome `pass`. BuildOS adds about 1.3 to 1.7 ms over a bare Node start of about 29 ms. Decision: no lazy-load or bundling change before `0.1.0` on current evidence; P8 rechecks after the domain ports. Profile version 1.1 is an editorial completion with no measurement change.
- Human Experience Review: the agent reviewed `toolkits/buildos/SECURITY.md` against the lockfile, `npm ls --all`, `npm audit`, the OSV API query, and the CI scan output of run 45282558470 (`npm audit` 0 vulnerabilities on three operating systems; `osv-scanner` 2.7.1 scanned 50 packages with 0 findings, gate pass), and found no package, version, license, or scan-status disagreement. One stale line remains: the `SECURITY.md` Scan Record row for the CI OSV job still reads `Pending`; see [Security Document Review](./evidence.md#security-document-review). The owner's 2026-11-23 test-runner decision resolved the MPL-2.0 license finding; every lockfile package is now MIT or Apache-2.0 (see [Owner Decisions](./evidence.md#owner-decisions)). The bundled Go Unicode tables are BSD-3-Clause; `THIRD_PARTY_NOTICES.md` holds their notice and `SECURITY.md` lists them.
- Optional experience handoff: Not applicable; no adopter-facing flow changes in this phase.
- Explicit human acceptance gate: None.
- Independent review: PASS on final verification after four CHANGES rounds (rounds 1 to 3 and the final review). The rounds, owner decisions, and reviewer numbers are in [Phase Reviews](./evidence.md#p1-review). The CI fix rounds were reviewed too; the review of `f505935` confirmed the Windows fixes and left one non-blocking follow-up, moved to [P3](./03-entities-port.md) t13.
- Evidence report: [evidence.md](./evidence.md#p1-typescript-package-foundation); review record in [Phase Reviews](./evidence.md#phase-reviews).
- Phase / capability status: Done. Stages 1 to 5 are done and checked (t1 to t19). Implementation, independent review, and commit are complete, and [CI run 45282558470](https://github.com/brucewaynedecoy/build-os/actions/runs/45282558470) closed A8, A9, and A10. A9 has no separate failing test-branch run; its negative control is the CI OSV gate self-check plus the local `lodash` controls (see [A9](./evidence.md#acceptance-criteria)).

## PERF-001 Profile

This is the one canonical `PERF-001` profile. Version 1 was written before any measurement. Version 1.1 is an editorial completion made after pass 1; it changes no measurement setting (see Lineage And Traceability). The execution packet and raw samples live in the [startup baseline section of the evidence report](./evidence.md#startup-baseline-perf-001). The P8 recheck reuses this profile.

### Performance Applicability

| Field | Value |
| --- | --- |
| Candidate ID | `PERF-001` |
| Title | CLI startup and per-command latency under Node 24 |
| Testing Type | Performance Testing |
| Base Maintenance Action | `create` |
| Protected Outcome | An agent-run BuildOS command still feels immediate to a chat-app user. |
| Decision Informed | Whether any command needs a lazy-load or bundling change before `0.1.0`. |
| Failure Cost | Moderate. Slow startup adds delay to every agent tool call, but no data is lost and the cause can be fixed in a later release. |
| Risk And Reversibility | Low blast radius and fully reversible: a bundling change touches only the build. A false pass could hide startup cost until P8; a false fail could cause needless lazy-load work. |
| Supported Scope | `buildos version`, `buildos help`, and `buildos version --json` run from the esbuild bundle on Node 24, on the measured machine class only. |
| Product Maturity | Pre-release foundation. No domain command is ported yet. |
| Source Authority | [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package); [plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan); [backlog Performance Evidence](./00-index.md#performance-evidence) |
| Source Evidence | [Runtime-selection proof](../../designs/2026-08-14-build-os-runtime-selection-proof.md), context only |
| Baseline Availability | No comparable baseline. The runtime proof measured a different workload (state setup, JSONL parsing, writes) and a different build, so its figures are context only. |
| Applicability | `characterize-now` |
| Target Class | `characterization-baseline` |
| Owner | BuildOS maintainer |
| Lifecycle Coordinate | W1 R7 P1 baseline; W1 R7 P8 recheck |
| Gate Effect | Informational. It informs a decision and does not block P1. |
| Reason | The startup path is stable now (bundle, dispatcher, envelope), so a baseline can inform the P8 bundling decision before domain code adds weight. |
| Next Record | None |

### PERF-001 CLI Startup Baseline

#### Identity And Authority

| Field | Value |
| --- | --- |
| Profile ID | `PERF-001` |
| Profile Version | `1.1` |
| Source Digest | SHA-256 of this `## PERF-001 Profile` section, recorded in the execution packet in the evidence report |
| Title | CLI startup and per-command latency under Node 24 |
| Protected Outcome | An agent-run BuildOS command still feels immediate to a chat-app user. |
| Source Requirements | [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package) |
| Canonical Owner | docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-typescript-package-foundation.md |
| Product Maturity | Pre-release foundation |
| Applicability | `characterize-now` |
| Target Class | `characterization-baseline` |
| Risk And Failure Cost | Moderate user impact, low severity, fully reversible. A false pass hides cost until P8. A false fail causes needless work. |
| Owner | BuildOS maintainer |
| Approver | BuildOS owner |

#### Supported Scope

| Field | Value |
| --- | --- |
| Surface | `node dist/buildos.js` with `version`, `help`, and `version --json` |
| Platform Or Runtime | Node 24 (the measured release is recorded in the fingerprint) |
| Deployment Or Device Class | One maintainer machine: Apple M2 Pro, 10 cores, 16 GiB, macOS on arm64, AC power |
| Scale | One command per process; no project data |
| Account And Network State | No network use; no account |
| Resource Envelope | Local machine with normal desktop load |
| Exclusions | Linux and Windows; x64; `npx` fetch time (owned by `PERF-002` in P8); cold file cache; domain commands not yet ported |

#### Baseline And Target

| Field | Value |
| --- | --- |
| Comparable Baseline | None |
| Target | None |
| Unit | Milliseconds of wall-clock time |
| Direction | Lower is better (descriptive only) |
| Tolerance | None |
| Target Source | None |
| Target Approval | None |

#### Environment And Workload

| Field | Value |
| --- | --- |
| Product Build | Source build of `toolkits/buildos/dist/buildos.js` from the P1 working tree, built with `npm run build` and no release define |
| Dependency State | `package-lock.json` as committed in P1; esbuild 0.28.2; no runtime dependencies |
| Configuration | Default build (`npm run build`), no release define |
| Qualified Environment | The machine class under Supported Scope |
| Dataset Or Fixture | None; the commands read no project files |
| Workload | Four process launches: a bare Node control (`node -e` that prints one line), `buildos version`, `buildos help`, and `buildos version --json` |
| Scale | One process per run |
| Concurrency | One process at a time |
| Operation Mix | Round-robin across the four workloads in each repetition |
| Workload Exclusions | None |

#### Measurement Protocol

| Field | Value |
| --- | --- |
| Measurement Boundary | From the parent's `spawnSync` call to child exit, including Node startup, bundle load, command run, and output |
| Instrument And Version | `toolkits/buildos/scripts/measure-startup.ts`, run by the same Node binary; its SHA-256 goes in the fingerprint |
| Cold Or Warm State | Warm file cache. Cold state is not measured, because clearing the cache needs root access. |
| Warmup Rule | 5 runs of each workload, discarded from the statistics and kept in the raw record |
| Repetitions Or Observation Window | 50 measured runs of each workload |
| Statistic | Median wall-clock time; p90 as a tail view |
| Variance Reporting | Minimum, p25, p75, p90, maximum, and interquartile range |
| Uncertainty Reporting | Distribution-free 95% confidence interval for the median from order statistics |
| Outlier Treatment | No statistical trimming. A run is excluded only when it exits non-zero or its stdout lacks the expected text; excluded runs are counted. |
| Comparison Method | Within-pass comparison with the Node control only. BuildOS overhead is the difference of medians. Overhead counts as distinguishable from noise only when the workload's median interval lies wholly above the control's median interval. |
| Raw Evidence Retention | Raw samples, rounded to 0.01 ms, in the `PERF-001` section of the evidence report, kept with the backlog |
| Observer Effects | The parent's spawn cost is in every sample, the control included, so it cancels in the difference. Other desktop load can add noise; the round-robin order spreads it evenly. |

#### Non-Sacrificable Constraints

| Constraint | Required Condition And Evidence |
| --- | --- |
| Correctness | Every counted run exits 0 with the expected stdout; the full Vitest suite passes on the measured build. |
| Durability | Not affected; the workloads write nothing. |
| Safety | Not affected; no project data is read or written. |
| Security | No network call and no new package; the dependency guard passes. |
| Privacy | The raw record holds timings and machine class only, with no paths or user names. |
| Accessibility | Not affected; output text is unchanged. |
| Portability | Any later change must keep one ESM bundle that runs on Node 24 on macOS, Linux, and Windows. |
| Cost | No external spend. |
| Maintainability | Any later change keeps the core and CLI boundary test passing. |
| Fixture And Measurement Seam | The instrument checks exit code and stdout of each run before it counts the sample. |

#### Evidence Budget And Stop Rules

| Field | Value |
| --- | --- |
| Authorizing Plan Or Work Scope | [W1 R7 P1 Stage 5](#stage-5---perf-001-startup-baseline); [plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan) |
| Budget Event ID | `PERF-001-P1-B1` |
| Characterization Pass Limit | 2 |
| Materially Distinct Correction Attempt Limit | 1 |
| Review Cycle Limit | 1 |
| Elapsed Investigation Time Limit | 8 hours (one working day) |
| Compute Limit | 4 machines: 1 maintainer machine plus the 3 existing CI runners |
| External Resource Spend Limit | 0 USD |
| Unchanged Fingerprint Action | Reuse the prior pass. Do not rerun for a different outcome. |
| Material Change Action | Rerun only the affected workloads within the remaining budget |
| Diminishing Return Rule | Stop when a pass does not change the decision, or when the next pass costs more than the remaining budget |
| Budget Exhaustion Disposition | Record `blocked` or `revise` and route to the owner |

#### Outcome Rules

| Outcome | Exact Condition |
| --- | --- |
| `pass` | The pass recorded the distribution and uncertainty for every workload under this protocol, with no more than 5 excluded runs per workload, and every non-sacrificable constraint held. A pass means the baseline exists; it sets no target. |
| `fail` | Not used for a characterization baseline: this profile has no target to miss. A broken constraint is recorded as a finding instead. |
| `revise` | The variance or interval width is too large to tell BuildOS overhead from the control, or the protocol proves unfit for the decision. |
| `blocked` | Node 24, the bundle, or the instrument is unavailable, or the budget is exhausted. |
| `waived` | The owner accepts a missing baseline for a bounded scope and time. |

| Field | Value |
| --- | --- |
| Severity Treatment | `minor` unless a constraint breaks; a broken constraint is `major` |
| Reproducibility Treatment | `not-attempted` for a single pass; `reproduced` only when a second pass with a material change shows the same decision |
| Finding Route | This work file and the evidence report; a bundling change routes to P8 |
| Escalation Route | BuildOS owner through the phase closeout |

#### Expiry And Reevaluation

| Field | Value |
| --- | --- |
| Material Change Triggers | A ported domain in the bundle; a new bundled package; a change in esbuild options; a Node major or minor change; another machine class; a change in the instrument or analysis |
| Time Or Release Boundary | Expires at the P8 recheck before `0.1.0` |
| Current-Use Invalidation Rule | Evidence with a different fingerprint is not current for the decision |
| Next Review Condition | P8 release preparation |
| Requalification Authority | W1 R7 P8, which owns the recheck |
| Requalification Budget | Set by P8; this budget does not renew |
| Unchanged-Fingerprint Qualification Limit | One bounded execution |

#### Lineage And Traceability

| Field | Value |
| --- | --- |
| Predecessor | None |
| Successor | None yet; the P8 recheck reuses this profile |
| Promotion Source | None |
| Promotion Approval | None |
| Supersession Reason | Version 1.1 supersedes version 1 for structure only: numeric units for the same three limits, a repository-relative canonical owner, a concrete product build, and the fingerprint, ledger, and result records. No scope, workload, protocol, analysis, or outcome rule changed, so the pass 1 result made under version 1 carries forward. |
| Plan And Work Links | [Plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan); [backlog Performance Evidence](./00-index.md#performance-evidence); [P8](./08-release-0-1-0.md) |
| Result Links | [Evidence report startup baseline](./evidence.md#startup-baseline-perf-001) |
| Finding Links | None |
| Obligation Links | None |
| History Links | None |
| Support Links | [Runtime-selection proof](../../designs/2026-08-14-build-os-runtime-selection-proof.md), context only |

#### Evidence Fingerprint

The profile digests below cover this section from its `## PERF-001 Profile` heading to the end of the Lineage And Traceability table. Version 1: `sha256:e575bbdd60205f94b4a409bef909ac039d6efb11ccd23f615beaf3cedc4bc69b`, recorded in the evidence packet before pass 1. Version 1.1: `sha256:67de4a287df0a5f6d7cd648181c8751ff2a26ecb73aa3b3bde09363b79c00761`.

- Profile ID, version, and digest: `PERF-001` version 1, `sha256:e575bbdd60205f94b4a409bef909ac039d6efb11ccd23f615beaf3cedc4bc69b`, for pass 1
- Product build and relevant code state: `toolkits/buildos/dist/buildos.js`, 12,810 bytes, `sha256:0f75779837acd7fbd32b0251d32412c661e22d89aa716d59c5204dfbc638bf5d`; P1 working tree on commit `8e1846b`; `src/` tree digest `sha256:03da754d6dd1e48a09a24fbefb2ccab3dde6972f09fa9f6681f4c3301000776e`
- Dependency and configuration state: `package-lock.json` `sha256:027b20e986a77358648aa4a43decedc99a9f1daa94827beb97ca0c7f26d37e94`; esbuild 0.28.2; default build with no release define
- Qualified environment: Apple M2 Pro, 10 cores, 16 GiB, macOS 27.2 arm64, AC power; Node 24.22.3
- Workload and fixture or dataset: Node control, `buildos version`, `buildos help`, `buildos version --json`; no fixture
- Instrument version: `toolkits/buildos/scripts/measure-startup.ts` `sha256:688d7030efd3f7a40c2ae1ff172bfa853c2565cf0fb766900c1db07f923c7fd2`
- Analysis method: median, p90, IQR, and the order-statistic 95% median interval computed by the instrument
- Comparability result and reasons: not-comparable with the runtime-selection proof, because the workload, build, and instrument differ; within-pass comparison with the Node control only

#### Budget Ledger

- Authorizing scope and budget event: [W1 R7 P1 Stage 5](#stage-5---perf-001-startup-baseline), `PERF-001-P1-B1`
- Requalification authorization: none
- Declared limits: 2 passes, 1 correction attempt, 1 review cycle, 8 hours, 4 machines, 0 USD
- Materially distinct attempts: pass 1 on 2026-11-23; no correction attempt
- Affected checks: all four workloads in pass 1
- Time, compute, and external spend: under 1 hour; 1 machine; 0 USD
- Review cycles used: 1
- Remaining budget: 1 pass, 1 correction attempt, 0 review cycles
- Unchanged evidence reused: none
- Stop reason and escalation: diminishing return; a second pass on the same fingerprint could not change the decision; no escalation

#### Result Record

- Result ID: `PERF-001-P1-R1`
- Exact profile binding: `PERF-001` version 1, `sha256:e575bbdd60205f94b4a409bef909ac039d6efb11ccd23f615beaf3cedc4bc69b`; carried forward to version 1.1, which changed no measurement setting
- Build and evidence fingerprint: [Evidence Fingerprint](#evidence-fingerprint) above
- Environment and workload: as in the fingerprint above
- Raw and analyzed evidence: [evidence report raw samples and summary](./evidence.md#startup-baseline-perf-001)
- Observed distribution: medians of 28.74 ms for the Node control, 30.40 ms for `version`, 30.11 ms for `help`, and 29.99 ms for `version --json`; BuildOS overhead of 1.25 to 1.66 ms
- Uncertainty and exclusions: every BuildOS median 95% interval lies wholly above the control interval; the overhead is uncertain to about 1 ms; no run excluded
- Budget ledger: [Budget Ledger](#budget-ledger) above
- Outcome: `pass`
- Findings: none
- Owner or reviewer disposition: agent review recorded in the evidence report; owner review open through the phase closeout
- Supported-scope limit: the three commands from the bundle on Node 24.22.3 on the one measured Apple M2 Pro macOS arm64 machine with a warm file cache
- Expiry: at the P8 recheck, or sooner at any material change trigger (expired at the P8 recheck on 2026-11-24)
- Later result: `PERF-001-P8-R1`, outcome `pass`, in the [P8 recheck](./evidence.md#startup-recheck-perf-001-p8)
