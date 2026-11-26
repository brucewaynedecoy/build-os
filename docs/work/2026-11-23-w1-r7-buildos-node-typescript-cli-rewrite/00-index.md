---
title: "BuildOS Node and TypeScript CLI Rewrite Work Backlog"
kind: "work"
status: "active"
coordinate: "W1 R7"
follow_on:
  route: "implementation-loop"
  next_prompt: ".make-docs/system/references/execution-workflow.md"
  why: "The backlog is the implementation queue derived from the plan and PRD contract."
  coordinate_handoff: "Carry this backlog's W/R coordinate into phase history records and commits, adding the active P coordinate for each phase."
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# BuildOS Node and TypeScript CLI Rewrite Work Backlog

## Purpose

This backlog builds BuildOS as one Node.js and TypeScript CLI, `buildos`, shipped as the npm package `@brucewaynedecoy/buildos`. It ports the four Go tools with byte-for-byte parity, adds `buildos init` with adoption and optional Make Docs setup, moves the skills into the package, replaces the Python validator with `buildos validate`, and builds a release flow that an enterprise reviewer can audit. It ends with the skill-script commands in `0.2.0`, after which an adopter needs Node and nothing else.

Product authority is [PRD 20 BuildOS CLI and Distribution](../../prd/20-buildos-cli-and-distribution.md) and the baseline PRDs it names. Sequencing comes from the [W1 R7 plan](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md) and its [work backlog shape](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md). The source design is [BuildOS Node and TypeScript CLI Rewrite](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md). Open items live in the [open questions and risk register](../../prd/03-open-questions-and-risk-register.md).

W1 R7 is a revision Wave of the W1 unified-distribution line. It supersedes the [W1 R5 backlog](../../../.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md) and the [W1 R6 backlog](../../../.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md). Those two backlogs stay in place as history. Do not execute them.

## Human Experience Trace

Authority: `make-docs://system/contract/human-experience-contract.md`. Impact is `direct`. Each promise comes from the `## Human Experience Intent` section of the [source design](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#human-experience-intent) and the [plan promise table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#human-experience-propagation).

| Impact or promise | Source design and plan | Owning PRD or preserved boundary | Work phase | Evidence source or selected testing type | Implementation gate | Accepted obligation, if any |
| --- | --- | --- | --- | --- | --- | --- |
| One agent-run `buildos init` sets up a new project with Node 24 and no other install | Design Decision 7; plan promise table | [PRD 20 Project Initialization and Adoption](../../prd/20-buildos-cli-and-distribution.md#project-initialization-and-adoption); [PRD 05 Installed Project Paths](../../prd/05-spaces-boundary-and-shipping.md#installed-project-paths) | [P6](./06-command-names-wrappers-and-initialization.md); smoke recheck in [P8](./08-release-0-1-0.md) | Functional tests on macOS, Linux, and Windows through `npx`; inspection of real output | P6 exit gate; P8 staged-package smoke tests | None |
| Missing or old Node gives one plain install message | Design Decision 5; plan promise table | [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package); [PRD 06 Contracts and Data](../../prd/06-operating-layer-and-routing.md#contracts-and-data) | [P6](./06-command-names-wrappers-and-initialization.md) | Wrapper tests with Node absent and Node 22 on three operating systems; inspection of real output | P6 exit gate | None |
| The user decides Make Docs setup; with no TTY, `init` stops and gives the agent both choices in plain words | Design Decision 8; plan promise table | [PRD 20 Make Docs Companion Setup](../../prd/20-buildos-cli-and-distribution.md#make-docs-companion-setup); [PRD 05 Integrations](../../prd/05-spaces-boundary-and-shipping.md#integrations) | [P6](./06-command-names-wrappers-and-initialization.md); router text in [P7](./07-skills-and-validation.md) | Functional tests for Yes, No, flags, and no-TTY; Human Experience Review of the no-TTY output with a short experience handoff | P6 exit gate | None |
| Make Docs failure does not fail BuildOS setup, and the retry command is shown | Design Decision 8; plan promise table | [PRD 20 Make Docs Companion Setup](../../prd/20-buildos-cli-and-distribution.md#make-docs-companion-setup) | [P6](./06-command-names-wrappers-and-initialization.md) | Functional test with a failing Make Docs stub; output inspection | P6 exit gate | None |
| Adoption of a Go-era project changes no user data | Design Decision 7; plan promise table | [PRD 20 Project Initialization and Adoption](../../prd/20-buildos-cli-and-distribution.md#project-initialization-and-adoption); [PRD 05 Installed Project Paths](../../prd/05-spaces-boundary-and-shipping.md#installed-project-paths) | [P6](./06-command-names-wrappers-and-initialization.md) | Byte comparison of every pre-existing file before and after adoption on a copied project | P6 exit gate | None |
| Commands, files, output, and exit codes match the Go tools; PDF matches after whitespace normalization | Design Decision 11; plan promise table | [PRD 20 Compatibility](../../prd/20-buildos-cli-and-distribution.md#compatibility); [PRD 07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data); [PRD 17 Entity commands](../../prd/17-entity-identity-and-canonical-resolution.md#entity-commands) | [P2](./02-golden-capture.md) through [P5](./05-discovery-and-design-port.md) | Golden parity suite | Parity gate of each port phase | None |
| Legacy names work until `0.3.0` and name the new command | Design Decision 6; plan promise table | [PRD 20 Legacy Command Names](../../prd/20-buildos-cli-and-distribution.md#legacy-command-names) | [P6](./06-command-names-wrappers-and-initialization.md); removal notice in [P8](./08-release-0-1-0.md) | Alias parity tests; output inspection | P6 exit gate | None |
| An enterprise reviewer finds every outside package, version, license, reason, and check in one document, plus SBOM and provenance | Design Decisions 12 and 13; plan promise table | [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain); [PRD 20 Release](../../prd/20-buildos-cli-and-distribution.md#release) | First version in [P1](./01-typescript-package-foundation.md); final in [P8](./08-release-0-1-0.md) | Security-document review against bundle contents, SBOM, and scan output | P1 exit gate (first version); P8 exit gate (final) | None |
| Converted documents keep every section and stay highly accurate | Design Decision 11; plan promise table | [PRD 07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data) | [P4](./04-intake-port.md) | Conversion eval gate: no lost section and at least 98% text similarity against reviewed reference text | P4 exit gate; every release that changes a converter | None |
| An adopter needs Node and nothing else; no user-facing command needs Python | Design Decision 15 | [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface); [PRD 13 Contracts and Data](../../prd/13-adopter-owned-config-surface.md#contracts-and-data) | [P7](./07-skills-and-validation.md) (`buildos validate`); [P9](./09-skill-script-commands-0-2-0.md) (skill scripts) | Parity with `validate_config.py` and the skill scripts on fixtures; a check that no Python file or call remains in shipped skills | P7 and P9 exit gates | None |

## Performance Evidence

Governing contract: `make-docs://system/contract/performance-evidence-governance.md`. No candidate creates a product target.

| Candidate | Base action | Applicability | Target class | Canonical profile owner | Budget | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| CLI startup and per-command latency under Node 24 | `create` | `characterize-now` | `characterization-baseline` | `PERF-001`, owned by [P1](./01-typescript-package-foundation.md) | Two passes, one correction attempt, one review cycle, one working day, no external spend | Baseline in P1; recheck in [P8](./08-release-0-1-0.md) |
| First-run `npx` fetch time for the published package | `create` | `characterize-now` | `characterization-baseline` | `PERF-002`, owned by [P8](./08-release-0-1-0.md) | Two passes on the staged package, one review cycle, half a working day, no external spend | P8 |
| Conversion time for large eval files | `none` | `not-needed` | none | None; accuracy is the gate | Not applicable | None |

## Phase Map

| Phase | Work file | Outcome | Entry dependency |
| --- | --- | --- | --- |
| P1 | [TypeScript Package Foundation](./01-typescript-package-foundation.md) | `toolkits/buildos/` builds with `tsc` and esbuild and tests with Node's built-in test runner (`node:test`). CI runs on three operating systems with Node 24. The core and CLI split, root handling, envelope, exit codes, help, and version exist. Supply-chain checks run in CI. `LICENSE` and the first `toolkits/buildos/SECURITY.md` exist. The `PERF-001` baseline is recorded. | PRD maintenance validated and approved by the owner, and `D-005` closed by W1 R8 |
| P2 | [Golden Capture](./02-golden-capture.md) | Golden outputs from all four Go tools and the legacy names are committed. A comparison harness runs in CI and fails on a planted difference. | P1 |
| P3 | [Entities Port](./03-entities-port.md) | `buildos entities` matches its goldens. | P2 |
| P4 | [Intake Port](./04-intake-port.md) | Converters are chosen by a recorded two-candidate comparison. `buildos intake` matches its goldens and passes the conversion eval gate. | P2 |
| P5 | [Discovery and Design Port](./05-discovery-and-design-port.md) | `buildos discovery` and `buildos design promote` match their goldens. `R-009` stays open. | P2 and P3 |
| P6 | [Command Names, Wrappers, and Initialization](./06-command-names-wrappers-and-initialization.md) | Legacy names, `sh` and `.cmd` wrappers, `buildos init` with adoption, and Make Docs companion setup work on three operating systems. | P3, P4, and P5 |
| P7 | [Skills and Validation](./07-skills-and-validation.md) | Skills live in `system/.os/skills/` without client content. `buildos validate` replaces the Python validator. `system/docs/` and `system/.make-docs/` are gone. | P6 and the owner's copy of the adopter skills |
| P8 | [Release 0.1.0](./08-release-0-1-0.md) | The release workflow, SBOM, scans, final security document, guide and README updates, performance evidence, and Go removal are done. The staged package runs on three operating systems. | P7 |
| P9 | [Skill-Script Commands 0.2.0](./09-skill-script-commands-0-2-0.md) | `buildos extract bulk`, `buildos fitgap`, and `buildos export azure-boards` match the scripts. Skills call the CLI. No Python is left in skills. | P8 |

## Usage Notes

- Read phases in order. P3 and P4 may run in parallel after P2, because their write scopes do not overlap. P5 needs P3 because discovery resolves entities through the core.
- Task IDs are phase-local and never reset inside a phase file. Reference a task as `w1 r7 pN tN`. Acceptance case IDs (`A1`, `A2`, and so on) are unique across this backlog.
- Mark a task done only when its stage acceptance criteria pass.
- Nothing is published, no installed binary changes, and no live adopter project changes without separate maintainer approval. Tests use copied or synthetic project folders only.
- Ports follow golden capture. A port makes no intended behavior change. A needed change is an explicit parity exception with a reason and an owner decision.
- Go code for a domain is removed only after that domain's parity gate passes. Discovery and design import the Go entities seed, so all Go removal happens together in P8, after every gate has passed.
- Every new outside package passes the [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain) rules before it lands. The same phase updates `toolkits/buildos/SECURITY.md`.
- Nothing in P1 starts until [`D-005`](../../prd/03-open-questions-and-risk-register.md#d-005-legacy-editorial-prds-fail-prd-authority-validation) is closed. The legacy-PRD cleanup runs first as W1 R8 ([backlog](../2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md)). No W1 R7 phase runs during the cleanup. See the [plan's cleanup gate](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#legacy-prd-cleanup-gate) and the [cleanup handoff](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-legacy-prd-cleanup-handoff.md).
- The MCP adapter is out of scope. The core must stay transport-neutral so a later revision can add it ([`Q-012`](../../prd/03-open-questions-and-risk-register.md#q-012-when-to-build-the-mcp-adapter)).
- Three tasks need a person and cannot be finished by an agent alone: the owner supplies the adopter skill files (P7), a person reviews the conversion reference text once (P4), and the maintainer approves each publication with npm 2FA (P8 and P9).
- The evidence report is [evidence.md](./evidence.md). P1 created it. Each phase adds its own sections. No `O-###` obligation and no `NUAT-###` scenario applies at generation time.

## Intended Follow-On

This handoff is advisory-default-but-overridable: it is authoritative unless the user explicitly overrides it, and it is not a gate or precondition.

- Route: `implementation-loop`
- Next step: Start with [P1](./01-typescript-package-foundation.md) after the owner approves the PRD maintenance and this backlog and W1 R8 closes `D-005`. Continue phase by phase.
- Why: The backlog is the implementation queue derived from the plan and PRD contract.
- Coordinate Handoff: Carry `W1 R7` into phase history records and commits, adding the active P coordinate for each phase.

## Change History

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: Phase Map entry dependencies for P1 and P8; Usage Notes; [P1](./01-typescript-package-foundation.md) and [P8](./08-release-0-1-0.md) entry gates.
- Previous scope: P1 through P7 could run while the legacy-PRD cleanup ran. Only P8 waited for `D-005` to close.
- Replacement scope: The cleanup runs as W1 R8 and must close `D-005` before P1 starts. Every later phase follows P1. P8 needs no separate `D-005` condition.
- Rationale: The Make Docs PRD router requires `make-docs run prd authority validate` to exit zero before downstream work uses the PRD set.
- PRD decision: `update-existing` — register `D-005` sequencing.
- Owner approval: Owner decision on 2026-11-23 in the planning chat.
- Source: [PRD set authority cleanup design](../../designs/2026-11-23-prd-set-authority-cleanup.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: The `## Source PRD Docs`, Human Experience lines, and backlog links that W1 R8 P4 updated in this backlog; the [P1](./01-typescript-package-foundation.md) entry gate.
- Previous scope: Phases cited the legacy PRDs 16 and 17 by code path, and P1 waited for `D-005` to close.
- Replacement scope: Phases link [02 `## Module Map`](../../prd/02-architecture-overview.md#module-map) and the renamed [PRD 17 Entity Identity and Canonical Resolution](../../prd/17-entity-identity-and-canonical-resolution.md) with its new section names. [`D-005`](../../prd/03-open-questions-and-risk-register.md#d-005-legacy-editorial-prds-fail-prd-authority-validation) is closed and `make-docs run prd authority validate` exits zero. W1 R8 has satisfied the D-005 prerequisite for W1 R7 P1. The other P1 entry-gate conditions, the owner's approval of the W1 R7 PRD maintenance and of this backlog, are still open.
- Rationale: W1 R8 made the PRD set valid product authority, which the P1 entry gate requires before downstream work uses it.
- PRD decision: `update-existing` — the register closes `D-005`, and the owner PRDs and the index were updated in W1 R8.
- Owner approval: The owner-directed [PRD set authority cleanup design](../../designs/2026-11-23-prd-set-authority-cleanup.md).
- Source: [W1 R8 work backlog](../2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: Phase Map P1 outcome; [P1](./01-typescript-package-foundation.md) t1, t2, t12, the Human Experience evidence line, and the testing table; [P3](./03-entities-port.md) testing table and t6; [P4](./04-intake-port.md) t11; [P5](./05-discovery-and-design-port.md) t3 and t7.
- Previous scope: Tests run with Vitest, and Vitest is a pinned dev dependency.
- Replacement scope: Tests run with Node's built-in test runner (`node:test`) and `node:assert/strict`. The pinned dev dependencies are `typescript`, `esbuild`, and `@types/node`. Task meanings are otherwise unchanged.
- Rationale: Vitest's dependency tree includes MPL-2.0 `lightningcss` packages, which the PRD 20 Supply Chain license list does not allow, and PRD 20 prefers Node built-ins.
- PRD decision: `update-existing` — PRD 20 `## Runtime and Package` now names `node:test`.
- Owner approval: Owner decision on 2026-11-23, relayed by the orchestrating maintainer chat.
- Source: [W1 R7 P1 TypeScript Package Foundation](./01-typescript-package-foundation.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [P1](./01-typescript-package-foundation.md) t3 (argument parsing in `toolkits/buildos/src/cli/`).
- Previous scope: t3 parses arguments with `node:util` `parseArgs` and adds no CLI framework.
- Replacement scope: t3 parses arguments with a small built-in parser that follows Go's `flag` package rules and adds no CLI framework or outside parsing package. The task meaning is otherwise unchanged, and t3 stays done because the parser exists and follows the new requirement.
- Rationale: `node:util` `parseArgs` cannot parse Go `flag`-style spellings such as `-json`. It splits them into short flags. Go output parity requires those spellings.
- PRD decision: `update-existing` — PRD 20 `## Runtime and Package` now names the built-in Go `flag`-rules parser and records the change in `## Requirement History`.
- Owner approval: Owner decision on 2026-11-23, relayed by the orchestrating maintainer chat.
- Source: [W1 R7 P1 TypeScript Package Foundation](./01-typescript-package-foundation.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [P3](./03-entities-port.md) Stage 2 tasks t11 and t12.
- Previous scope: P3 Stage 2 had t7 to t10. No task repeated the P1 root-error checks for `entities`, and no task covered a relative `--root` when the current folder is reached through a symlink.
- Replacement scope: t11 repeats the packaged-binary root-error checks for `entities` (`EACCES`, `ENOTDIR`, `ELOOP`, and `ENAMETOOLONG` roots exit 3 and name the given root, per PE-004). t12 reads `$PWD` in the CLI adapter for the current-folder base, so a relative `--root` matches Go's `filepath.Abs` through a symlinked current folder, with a golden. Existing tasks are unchanged.
- Rationale: The P1 CI and path-port fix rounds verified root errors only at the dispatcher through a test domain, because `entities` is not registered until P3. Go's `filepath.Abs` uses `$PWD` when it names the current folder, and Node's `process.cwd()` returns the resolved path.
- PRD decision: `none` — implementation follow-ups within the existing PRD 20 Compatibility parity requirement.
- Owner approval: Not required.
- Source: [W1 R7 evidence report](./evidence.md)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [P3](./03-entities-port.md) Stage 2 task t13.
- Previous scope: P3 Stage 2 had t7 to t12. No task covered the Windows UNC root spelling for doubled separators.
- Replacement scope: t13 parses the UNC server and the possibly empty share before collapsing repeated separators, so `//foo//bar/..` is spelled `\\foo\` as `GetFullPathNameW` then Go's `Clean` give, and adds `//foo//bar/..` and `//foo/bar/..` to the Windows native comparison. Existing tasks are unchanged.
- Rationale: The independent review of `f505935` found that the port spells `//foo//bar/..` as `\\foo\bar`. It collapses the doubled separator before it identifies the UNC server and share. The defect is display-only, because containment uses the real path the OS resolves, so it did not block the P1 closeout.
- PRD decision: `none` — an implementation follow-up within the existing PRD 20 Compatibility parity requirement.
- Owner approval: Not required (owner's stop rule for non-blocking findings).
- Source: [W1 R7 evidence report, P1 Review](./evidence.md#p1-review)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [P3](./03-entities-port.md) Stage 2 task t14; [P5](./05-discovery-and-design-port.md) Stage 2 task t11.
- Previous scope: P3 Stage 2 had t7 to t13, and P5 Stage 2 had t5 to t10. No task covered the parent-folder sync of the TypeScript atomic writes on Windows.
- Replacement scope: P3 t14 and P5 t11 make the TypeScript atomic writes of `entities` and `design promote` sync the parent folder in a way that works on Windows, with a Windows CI test that proves a successful apply exits 0 and leaves no half-applied state. Existing tasks are unchanged.
- Rationale: The P2 win32 capture showed that Go 1.24.1 fails its post-rename folder sync on Windows with `Access is denied.` in six cases. The owner chose the Linux and macOS Go behavior as the Windows parity target (PE-005), so the TypeScript CLI must not reproduce the defect.
- PRD decision: `none` — implementation detail under PRD 20 Windows support and PRD 17/11 atomic writes.
- Owner approval: Owner decision 2026-11-23 (PE-005).
- Source: [W1 R7 evidence report, PE-005 Derived Goldens](./evidence.md#pe-005-derived-goldens)

### 2026-11-23 — W1 R7

- Kind: `edit`
- Affected scope: [P6](./06-command-names-wrappers-and-initialization.md) Stage 5 task t29.
- Previous scope: P6 Stage 5 had t26 to t28. No task covered the BOM handling of `src/core/entities/graph.ts`.
- Replacement scope: t29 fixes the BOM handling in `src/core/entities/graph.ts` found during P4, with a Go golden. Existing tasks are unchanged.
- Rationale: During P4, `isNullLiteral` was found to decode with a default `TextDecoder`, which drops a leading U+FEFF, so a raw value of BOM + `null` reads as `null`, where Go's `bytes.TrimSpace` keeps the BOM. The defect is in P3 code and out of P4 scope.
- PRD decision: `none` — an implementation follow-up within the existing PRD 20 Compatibility parity requirement.
- Owner approval: Not required.
- Source: [W1 R7 evidence report, P4 Open Items](./evidence.md#p4-open-items)
