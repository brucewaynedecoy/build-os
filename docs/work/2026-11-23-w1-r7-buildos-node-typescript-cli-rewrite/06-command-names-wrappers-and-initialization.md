---
title: "Phase 6: Command Names, Wrappers, and Initialization"
kind: "work"
status: "active"
coordinate: "W1 R7 P6"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 6: Command Names, Wrappers, and Initialization

## Purpose

Give adopters one way in. This phase adds the legacy command names, the `sh` and `.cmd` wrappers, `buildos init` with adoption of Go-era projects, and the optional Make Docs companion setup. It carries most of the direct Human Experience promises.

## Overview

All four domains are ported before this phase starts. The phase wires them to the names and scripts adopters already use, then adds `buildos init`. Every flow is tested on macOS, Linux, and Windows from a packed tarball through `npx`. The phase ends with a Human Experience Review of the real `init` output.

## Entry Gate

- P3, P4, and P5 exit gates passed: every domain is `enforced` in the golden harness.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `direct`. Promises from [PRD 20 Human Experience Outcomes](../../prd/20-buildos-cli-and-distribution.md#human-experience-outcomes): one agent-run `buildos init` sets up a project; missing or old Node gives one plain message; the user decides Make Docs setup, and with no TTY `init` stops and explains both choices; Make Docs failure does not fail BuildOS setup and shows the retry command; adoption changes no user data; legacy names work and name the new command.
- Intended human outcome: An adopter says "set up BuildOS here" in a chat app. The agent runs one command, sees a plain question about Make Docs, asks the adopter, and finishes. A Go-era project keeps every data file.
- Human-facing surface or indirect effect: `buildos init` human and JSON output, the resulting project tree, wrapper messages, and legacy-name stderr.
- Implementation work: Stages 1 through 5.
- Evidence source or testing type selected under current authority: Functional tests on three operating systems through `npx`; output inspection; adoption byte comparison; alias parity tests; Make Docs CI contract test; Human Experience Review of `init` no-TTY output with a short experience handoff.
- Executor: Implementing agent; Human Experience Review by the agent.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Functional tests for names, wrappers, `init`, adoption, and Make Docs setup on three operating systems; alias parity; Make Docs CI contract test. |
| Performance Testing | `not-needed-now` | First-run fetch time is `PERF-002` in P8 on the staged package. |
| Guided Progress Review | `not-needed-now` | The Human Experience Review of real output and the optional handoff answer the current question. |
| Unassisted Goal Testing | `not-needed-now` | No accepted authority activates it. Real chat-app trials are in P8 under `R-012`. |

Human Experience Review is separate and required here. See Stage 5.

## Source PRD Docs

- [PRD 20 Legacy Command Names](../../prd/20-buildos-cli-and-distribution.md#legacy-command-names)
- [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package)
- [PRD 20 Project Initialization and Adoption](../../prd/20-buildos-cli-and-distribution.md#project-initialization-and-adoption)
- [PRD 20 Make Docs Companion Setup](../../prd/20-buildos-cli-and-distribution.md#make-docs-companion-setup)
- [PRD 20 Output and Exit Contract](../../prd/20-buildos-cli-and-distribution.md#output-and-exit-contract) (exit code `10`, no walk-up)
- [PRD 20 Human Experience Outcomes](../../prd/20-buildos-cli-and-distribution.md#human-experience-outcomes)
- [PRD 05 Installed Project Paths](../../prd/05-spaces-boundary-and-shipping.md#installed-project-paths) and [Integrations](../../prd/05-spaces-boundary-and-shipping.md#integrations)
- [PRD 06 Component and Capability Map](../../prd/06-operating-layer-and-routing.md#component-and-capability-map) and [Contracts and Data](../../prd/06-operating-layer-and-routing.md#contracts-and-data) (wrapper resolution, `.os/manifest.json`)
- [PRD 11 Integrations](../../prd/11-flow-c-integration.md#integrations) (Make Docs boundary)
- Register: [`Q-013`](../../prd/03-open-questions-and-risk-register.md#q-013-cli-contract-details-left-open-by-the-design), [`Q-010`](../../prd/03-open-questions-and-risk-register.md#q-010-make-docs-public-companion-contract-verification), [`R-001`](../../prd/03-open-questions-and-risk-register.md#r-001-make-docs-companion-public-contract-dependency), [`R-004`](../../prd/03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility), [`R-012`](../../prd/03-open-questions-and-risk-register.md#r-012-node-24-and-npx-reach-in-chat-app-and-enterprise-environments)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P6](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases); [promise table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#human-experience-propagation)
- Design: [Decisions 5 to 9](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#5-how-agents-and-users-run-the-cli) and [Human Experience Intent](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#human-experience-intent)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Legacy command names

### Tasks

- [x] t1: Add `buildos-intake`, `buildos-discovery`, and `buildos-design` to the `bin` map in `toolkits/buildos/package.json`. All four names point to the same entry file. Changed by t30: each legacy name now has its own entry file.
- [x] t2: Add `src/cli/invocation.ts`. It maps legacy arguments to the matching `buildos <domain>` command. Since t30 it takes the name from the legacy entry file, not from `process.argv[1]`. Done: the tests pass on macOS, Linux, and Windows in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- [x] t3: For a legacy name, write one stderr line that says the name goes away in `0.3.0` and names the exact new command. Keep stdout and the exit code unchanged.
- [x] t4: Add one parity exception to `toolkits/buildos/test/golden/parity-exceptions.json` for that line. The harness removes exactly that one line from stderr for legacy-name cases and compares the rest byte for byte. Link [PRD 20 Legacy Command Names](../../prd/20-buildos-cli-and-distribution.md#legacy-command-names) as the reason.
- [x] t5: Run every legacy-name golden case under its legacy name from an installed tarball on three operating systems. Done: the CI step "Golden parity from the installed tarball" passed 167 of 167 on macOS, Linux, and Windows in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561); on Windows it runs npm's real `.cmd` shims through `cmd.exe` (review round 1).

- [x] t30: Owner decision 2026-11-24 (question 2, option A): write one small entry file per legacy name (`dist/buildos-intake.js`, `dist/buildos-discovery.js`, `dist/buildos-design.js`) that passes the name to the same bundle explicitly; point the `bin` entries at them; ship them; test each name in the npm Windows shim form and with a renamed entry file. Done: the tests pass on macOS, Linux, and Windows in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561); see [P6 Legacy Entry Files](./evidence.md#p6-legacy-entry-files).

### Acceptance criteria

- A38: Every legacy-name golden case passes on three operating systems, with only the one recorded stderr line added. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A39: The stderr line for each legacy name names the matching `buildos <domain>` command and `0.3.0`, and a successful command still exits `0` with unchanged stdout. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A40: The installed package exposes no `buildos-entities` or `buildos-lifecycle` command. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).

### Dependencies

- P3, P4, and P5 complete.

## Stage 2 - Wrapper scripts

### Tasks

- [x] t6: Rewrite the POSIX `sh` wrappers in `system/.os/scripts/` (`buildos`, `buildos-intake`, `buildos-discovery`, `buildos-design`). Order: use `buildos` on `PATH`; else, when Node 24 or newer is present, read the pinned version from `.os/manifest.json` with Node and run `npx -y @brucewaynedecoy/buildos@<version>`; else print one plain message and exit non-zero.
- [x] t7: Add Windows `.cmd` wrappers with the same names and order in `system/.os/scripts/`.
- [x] t8: Write the plain message once and use it in both forms. It names Node.js 24 or newer as what to install and says where to get it. It shows no stack trace and no internal terms.
- [x] t9: Add wrapper tests on three operating systems for: `buildos` on `PATH`; no `buildos` but Node 24, with a stub `npx` that records its arguments; Node absent; and Node 22. Done: the `sh` forms pass on macOS and Linux and the `.cmd` forms pass on Windows in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- [x] t10: Update `system/.os/scripts/AGENTS.md` to describe the new order and drop the old environment variable and `toolkits/*/bin/` lookups.

### Acceptance criteria

- A41: With Node absent and with Node 22, each wrapper prints the same plain message, shows no stack trace, and exits non-zero on all three operating systems. The real output is captured in the evidence report. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A42: With Node 24 and no `buildos` on `PATH`, the stub records `npx -y @brucewaynedecoy/buildos@<version>` with the version read from `.os/manifest.json`. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).

### Dependencies

- Stage 1 complete.

## Stage 3 - Project initialization and adoption

### Tasks

- [x] t11: Add a build step that copies the `system/` package content into the package, excluding `system/docs/` and `system/.make-docs/`. Extend the P1 pack check to confirm both are absent.
- [x] t12: Add `src/core/init/plan.ts`. Resolve the root from `--root`, or else the current folder, and never walk up. With no `.os/`, plan a new project: place the `system/` content at the root, write `.os/manifest.json`, the wrappers, and `.os/skills/`. With an existing `.os/`, plan an adoption that writes only `.os/manifest.json`, the wrappers, and `.os/skills/`.
- [x] t13: In a non-empty folder without `.os/`, plan a new project next to the existing files. When any planned path already exists, write nothing, exit `10`, and list every clashing path in human and JSON output with the tip from [PRD 20 Project Initialization and Adoption](../../prd/20-buildos-cli-and-distribution.md#project-initialization-and-adoption). Since t31, the root `AGENTS.md`, `CLAUDE.md`, and `.gitignore` never clash.
- [x] t14: Write `.os/manifest.json` with the package version, the manifest schema version, and the time of initialization.
- [x] t15: Show the planned writes, with the resolved root first, before writing. `buildos init --dry-run` shows the plan, writes nothing, and reports `write_status` `planned`.
- [x] t16: Add `src/cli/commands/init.ts` with `--root`, `--dry-run`, `--json`, `--make-docs`, and `--skip-make-docs`.
- [x] t31: Owner decision 2026-11-24 (question 1, option A): treat the root `AGENTS.md`, `CLAUDE.md`, and `.gitignore` as shared files with a marked BuildOS section; stop before any write on malformed markers, a link, or a file over 4 MiB; run Make Docs before BuildOS writes; undo every section write on a failure; report each file in human, dry-run, and JSON output. See [P6 Shared Files and Make Docs Order](./evidence.md#p6-shared-files-and-make-docs-order).
- [x] t17: Add the adoption byte check. Build a copied Go-era project fixture with config, entity data, runs, findings, indexes, and assets (since review round 1, short placeholder files only). Record a SHA-256 for every file, run `buildos init --skip-make-docs`, and record them again. Every pre-existing file must match. Every new or changed path must be in the allowed adoption set. Run it on three operating systems. Done: passed on macOS, Linux, and Windows in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).

### Acceptance criteria

- A43: The adoption byte check passes on three operating systems. Its report lists zero changes outside the allowed adoption set and only allowed new paths. Inside the set, adoption replaces exactly four pre-existing files, the Go-era wrappers `.os/scripts/buildos`, `.os/scripts/buildos-intake`, `.os/scripts/buildos-discovery`, and `.os/scripts/buildos-design`. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A44: `buildos init --dry-run` in an empty folder lists the resolved root and every planned path, writes nothing, and exits `0`. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A44a: In a folder with unrelated files and no `.os/`, `buildos init --skip-make-docs` adds the BuildOS files and leaves every existing file byte for byte. In a folder where a planned path already exists, it writes nothing, exits `10`, and both outputs list the clashing paths and the tip. The root `AGENTS.md`, `CLAUDE.md`, and `.gitignore` get only the BuildOS section, and every line outside it stays byte for byte. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A45: Run from a child folder of an initialized project, `buildos init --dry-run` targets the child folder, not the parent. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A46: A new project contains `.os/`, `assets/`, `playbooks/`, `workspace/`, and `.os/manifest.json` with all three fields. It has no `docs/` or `.make-docs/` when Make Docs is skipped. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).

### Dependencies

- Stage 2 complete.

## Stage 4 - Make Docs companion setup

### Tasks

- [x] t18: Add the choice logic in `src/core/init/make-docs-choice.ts` and TTY detection in the CLI. In a TTY, ask `Set up Make Docs in this project? [Y/n]` with Yes as the default. `--make-docs` and `--skip-make-docs` answer without a prompt. Both flags together are a usage error.
- [x] t19: With no TTY and no flag, stop before any write and exit `10`. The human output and the JSON output both say, in plain words, what Make Docs adds, whether the user can set it up later with the tested Make Docs version (from the Make Docs sections in the root routers, review round 2), and the two exact commands to run, including the resolved `--root`, with the shell they are written for.
- [x] t20: For Yes, run Make Docs only through its public CLI: `make-docs` on `PATH`, else `npx -y @brucewaynedecoy/make-docs@<pinned range>`. Pass exactly `make-docs setup --target <project> --codex-method none --claude-code-method none --no-github-copilot --no-skills --project-resources all --yes --json`. Spawn correctly on Windows.
- [x] t21: When Make Docs setup fails, finish BuildOS setup and exit `0`. Say that Make Docs is not set up and show the exact retry command. In JSON, set `ok` to `true` and `result.status` to `partial`, with the retry command.
- [x] t22: Keep the pinned Make Docs range in one constant in `src/core/init/make-docs-range.ts`. BuildOS calls only `make-docs --version`, `make-docs project state status --json`, and `make-docs setup --json`.
- [x] t23: Add a Make Docs contract job to `.github/workflows/buildos-ci.yml`. It installs Make Docs at the bounds of the pinned range, runs the three commands in a temporary folder, and fails when a flag or a JSON field BuildOS reads changes. The check passed by hand against Make Docs 2.0.9, and the job passed in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- [x] t24: Add functional tests on three operating systems for an injected Yes answer, an injected No answer, each flag, no TTY with no flag, and a failing Make Docs stub. Assert that BuildOS writes no file under `docs/` or `.make-docs/` itself. Done: passed on macOS, Linux, and Windows in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- [x] t25: From a packed tarball, run `npx -y <tarball> init --skip-make-docs` and `npx -y <tarball> init` with no TTY in empty folders on three operating systems with Node 24. Done: passed on macOS, Linux, and Windows with Node 24 (`npx -y --package=<tarball> buildos init`) in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).

### Acceptance criteria

- A47: With no TTY and no flag, `init` exits `10`, writes nothing, and both outputs name what Make Docs adds, say truthfully whether it can be set up later with the tested Make Docs version, and give both exact commands with the shell they are written for. The real output is captured in the evidence report. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A48: For Yes, the recorded Make Docs call has exactly the PRD 20 arguments. Only the Make Docs process writes under `docs/` or `.make-docs/`. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A49: With a failing Make Docs stub, BuildOS setup completes with exit `0`, the output says Make Docs is not set up, the JSON reports `result.status` `partial`, and the shown retry command succeeds when run against a working stub. Passed on macOS, Linux, and Windows: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A50: The Make Docs contract job passes at both bounds of the pinned range and fails on a stub with a renamed setup flag. Passed: the job "Make Docs contract (pinned range bounds)" and the self-test in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).
- A51: The `npx` runs from the tarball complete on three operating systems with Node 24 and no other install step. Passed: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561).

### Dependencies

- Stage 3 complete.

## Stage 5 - Human Experience Review

### Tasks

- [x] t26: Capture the real human and JSON output of `buildos init` for a new project, an adoption, a dry run, no TTY, Yes, No, a Make Docs failure, and the wrapper with Node missing. Store it in the evidence report.
- [x] t27: Review the captures from a non-technical adopter's point of view. Record for each case whether the project folder is named before any detail, whether complete, partial, and stopped states read differently, whether the next action is visible, and whether any npm, `npx`, `PATH`, or flag knowledge is needed to choose. Record conclusions as `satisfied`, `material gap`, or `insufficient evidence`, with limits.
- [x] t28: Write a short experience handoff: in a chat app with folder access, ask the agent to set up BuildOS in an empty folder; notice the plain Make Docs question the agent brings back; reply with any feedback. A missing reply does not block closure.
- [x] t29: Fix the BOM handling in `src/core/entities/graph.ts` found during P4, with a Go golden. `isNullLiteral` decodes with a default `TextDecoder`, which drops a leading U+FEFF, so a raw value of BOM + `null` reads as `null`, where Go's `bytes.TrimSpace` keeps the BOM. See [P4 Open Items](./evidence.md#p4-open-items).

### Acceptance criteria

- A52: The review covers every captured case and records a conclusion for each promise in this phase, with no open `material gap`. Met: every captured case has a conclusion and no `material gap` is open; the Windows `.cmd` and three-OS cases passed in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561). The last gap (the "set up Make Docs later" text) is closed by the orchestrator's option A decision, which the owner may still veto; see [P6 Review Round 1](./evidence.md#p6-review-round-1).
- A53: In the no-TTY capture, the subject (the project folder), the stopped state, and the two choices with their exact commands appear before any diagnostic code.

### Dependencies

- Stage 4 complete.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing ran on macOS (`test/init.test.ts`, `test/wrappers.test.ts`, `test/package.test.ts`, `test/make-docs-contract.test.ts`, the golden harness under the legacy names and from an installed tarball). All of them pass on macOS, Linux, and Windows with Node 24 in [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561) on `9e2f8a2`, with the installed-tarball golden step at 167 of 167 on each system, the Make Docs contract job, and the OSV scan. Performance Testing, Guided Progress Review, and Unassisted Goal Testing stay `not-needed-now`.
- Performance evidence: None; `PERF-002` runs in P8. The bundle is 3,171,282 bytes at P6 (after the 2026-11-24 decisions) for the `PERF-001` recheck.
- Human Experience Review: Done for every captured case, on macOS. The owner decided both earlier `material gap` conclusions on 2026-11-24 (t30, t31); they are closed on macOS. The last `material gap` ("set up Make Docs later" fails with Make Docs 2.0.9) is closed for honesty by the orchestrator's option A decision, pending an owner veto: every output now says plainly what works with the pinned Make Docs version. The limit itself stays open as register `Q-010`. A52 is met: [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561) closed the three-OS part. The option A decision stays recorded as an orchestrator decision that the owner may still veto. See [P6 Review Round 1](./evidence.md#p6-review-round-1).
- Optional experience handoff: Written; no reply yet. See [P6 Experience Handoff](./evidence.md#p6-experience-handoff-t28).
- Explicit human acceptance gate: None.
- Evidence report: [P6 Command Names, Wrappers, and Initialization](./evidence.md#p6-command-names-wrappers-and-initialization), with parity exception PE-016.
- Review round 1: 19 findings fixed with tests; see [P6 Review Round 1](./evidence.md#p6-review-round-1).
- Review round 2 and CI run 45412403531: 17 findings and 7 CI failures fixed with tests (the `.cmd` wrappers rewritten, one ownership rule for the shared-file sections, one manifest contract, a journal that checks what this run wrote); see [P6 Review Round 2](./evidence.md#p6-review-round-2) and [P6 CI Run 45412403531](./evidence.md#p6-ci-run-45412403531). The Windows `.cmd` wrappers still have no green Windows run.
- Review round 3 and CI run 45420565710: 17 findings and 4 Windows test failures fixed with tests. Shared-file sections now carry an integrity line, and BuildOS replaces only a section whose hash matches; a file BuildOS would replace with more than one hard link stops; every path BuildOS writes must look the same after Make Docs ran; the Windows wrapper helper starts the program itself; the installed-tarball CI step no longer globs after a Windows path. See [P6 Review Round 3](./evidence.md#p6-review-round-3) and [P6 CI Run 45420565710](./evidence.md#p6-ci-run-45420565710). Open follow-ups: F-P6-01, F-P6-02, F-P6-03.
- CI run 45429667932 on `22d5970`: Linux and Windows green, the Windows installed-tarball golden step 167/167; F-P6-03 is closed. See [P6 CI Run 45429667932](./evidence.md#p6-ci-run-45429667932).
- Review round 4 (closing check): no blockers; 3 majors and 7 minors fixed with tests. A current section is never written again; a commented example with a stale hash no longer stops `init`; the rerun summary names each file it could not check; a bare CR is text, and a CR-only file stops before any write; the init core hashes through a port. The P6 review loop is closed under the project stop rule. See [P6 Review Round 4 (closing check)](./evidence.md#p6-review-round-4-closing-check). Open follow-ups: F-P6-01, F-P6-02, F-P6-04.
- CI run 45433974561 on `9e2f8a2`: all five jobs passed. Tests: Linux 1,644 tests, 1,636 pass, 0 fail, 8 skipped; macOS 1,644 tests, 1,637 pass, 0 fail, 7 skipped; Windows 1,502 tests, 1,412 pass, 0 fail, 90 skipped. The installed-tarball golden step passed 167 of 167 and the conversion and eval suite 284 tests with 0 fail on all three systems; the Make Docs contract job and the OSV scan passed. See [P6 CI Run 45433974561](./evidence.md#p6-ci-run-45433974561).
- Phase / capability status: Done. t1 to t31 are done and checked, and A38 to A53 pass. [CI run 45433974561](https://github.com/brucewaynedecoy/build-os/actions/runs/45433974561) on `9e2f8a2` closed t2, t5, t9, t17, t24, t25, and t30 and the three-OS parts of A38 to A52. The P6 review loop closed after review rounds 1 to 3 and the closing check. The option A decision on the "set up Make Docs later" wording ([P6 open item 9](./evidence.md#p6-open-items-after-the-decisions)) is recorded as an orchestrator decision that the owner may still veto. Follow-ups carried forward are in [P6 Follow-ups](./evidence.md#p6-follow-ups).
