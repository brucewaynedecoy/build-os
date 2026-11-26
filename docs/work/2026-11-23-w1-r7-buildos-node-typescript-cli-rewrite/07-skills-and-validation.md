---
title: "Phase 7: Skills and Validation"
kind: "work"
status: "active"
coordinate: "W1 R7 P7"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 7: Skills and Validation

## Purpose

Make `system/.os/skills/` the one source of BuildOS skills, free of client content, and replace the Python validator with `buildos validate`. Remove the Make Docs copy from the source package after its BuildOS-owned content is moved.

## Overview

The phase imports 21 adopter-project skills and the 3 repository skills, keeps the newer copy of each after a diff review, and removes client content. A deny-list check guards against new leaks. It adds the skills router, ports `validate_config.py`, and deletes `system/docs/` and `system/.make-docs/` after reviewing `harness-capability-matrix.md`.

## Stage Order

On 2026-11-24 the orchestrator ran Stages 4 and 5 before Stages 1 to 3. This departs from the default stage order and from the `Dependencies` lines below: Stages 4 and 5 do not use the adopter skill files, and t1 blocks Stages 1 to 3. The one overlap is t16: references to the legacy validator inside skills that are not imported yet are handled in Stages 1 to 3. See [P7 Skills and Validation](evidence.md#p7-skills-and-validation).

## Entry Gate

- P6 exit gate passed.
- The owner has supplied a copy of the adopter skill files (t1).

## Human Experience Outcome

- Impact and governing promise or preserved boundary: Promises: the adopter does not need to know where each chat app keeps skills, and the router tells agents to put the Make Docs choice to the user ([PRD 20 Packaged Skills](../../prd/20-buildos-cli-and-distribution.md#packaged-skills)); no user-facing command needs Python ([PRD 13 Contracts and Data](../../prd/13-adopter-owned-config-surface.md#contracts-and-data)).
- Intended human outcome: An agent finds a needed skill in `.os/skills/` and installs it where its app expects. An adopter checks config with `buildos validate` and gets the same findings the Python script gave.
- Human-facing surface or indirect effect: `.os/skills/` contents and router, `buildos validate` output.
- Implementation work: Stages 1 through 5.
- Evidence source or testing type selected under current authority: Deny-list check; `buildos validate` parity with `validate_config.py` on fixtures; `init` tree inspection.
- Executor: Implementing agent; the owner supplies the adopter skill files.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Validate parity tests, deny-list check in CI, pack checks, and `init` tree tests. |
| Performance Testing | `not-needed-now` | No decision depends on validation or copy speed. |
| Guided Progress Review | `not-needed-now` | Router wording is checked by the agent review below. |
| Unassisted Goal Testing | `not-needed-now` | No accepted authority activates it. |

Human Experience Review is separate. The agent reads `.os/skills/AGENTS.md` in a freshly initialized project as an agent would and records whether it can tell how to install one named skill and what to ask the user when `init` exits `10`. It also compares `buildos validate` output for one invalid fixture with the Python output and records whether the problem and its fix are as clear.

## Source PRD Docs

- [PRD 20 Packaged Skills](../../prd/20-buildos-cli-and-distribution.md#packaged-skills) and [Release](../../prd/20-buildos-cli-and-distribution.md#release) (deny list)
- [PRD 20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) (`buildos validate`)
- [PRD 13 Contracts and Data](../../prd/13-adopter-owned-config-surface.md#contracts-and-data)
- [PRD 06 Component and Capability Map](../../prd/06-operating-layer-and-routing.md#component-and-capability-map) and [Contracts and Data](../../prd/06-operating-layer-and-routing.md#contracts-and-data)
- [PRD 05 Installed Project Paths](../../prd/05-spaces-boundary-and-shipping.md#installed-project-paths) and [Scope](../../prd/05-spaces-boundary-and-shipping.md#scope)
- [PRD 10 Integrations](../../prd/10-discovery-runs-and-qualification.md#integrations) (harness capability matrix reference)
- Register: [`Q-013`](../../prd/03-open-questions-and-risk-register.md#q-013-cli-contract-details-left-open-by-the-design) (answer 4), [`R-004`](../../prd/03-open-questions-and-risk-register.md#r-004-existing-toolkit-and-deployed-project-migration-compatibility)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P7](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#phases)
- Design: [Decision 14, Skills ship with the package](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#14-skills-ship-with-the-package) and [Decision 15, No Python for users](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#15-no-python-for-users)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Skills import

### Tasks

- [x] t1: **Needs the owner.** The owner supplies a read-only copy of the 21 skill folders from the adopter project's `.agents/skills/`. An agent does not open the adopter project without this. This task blocks t2 through t4. Done 2026-11-24: the owner supplied them in the repository `https://github.com/brucewaynedecoy/build-os-skills`, folder `skills/`, commit `ef12985`.
- [x] t2: Create `system/.os/skills/` and import the 21 adopter skills and the 3 repository skills from `skills/` (`capability-matrix`, `fit-gap-analysis`, `buildos-export-azure-boards`). The 3 repository skills are 3 of the 21 adopter skills, so the import holds 21 folders (A54).
- [x] t3: For each skill that exists in both places, diff the two copies, keep the newer copy after review, and record the skill, the copies compared, the choice, and notable differences in the evidence report.
- [x] t4: Remove the top-level `skills/` folder once its skills are in `system/.os/skills/`. Update repository links that pointed to it.

### Acceptance criteria

- A54: `system/.os/skills/` holds 24 skill folders, or the evidence report explains each merge that lowered the count. Result: 21 folders; the 3 repository skills exist in the adopter set under the same names, so each pair became one folder ([P7 Stages 1 to 3](evidence.md#p7-stages-1-to-3)). Passed: `test/skills.test.ts` passes on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572) on `42b9782`.
- A55: The evidence report has one newest-copy decision for every skill that existed in both places. Passed: [Newest-Copy Decisions](evidence.md#newest-copy-decisions-t3-a55) has one decision for each of the 3 skills that existed in both places.

### Dependencies

- P6 complete and t1 done.

## Stage 2 - Client content removal and deny-list check

### Tasks

- [x] t5: Change `fit-gap-analysis` so owner names and colors come from config, not code. Read them from the adopter config under `.os/config/` or a skill-local config file, with neutral defaults.
- [x] t6: Replace client-like example topics in skill examples and assets, including `buildos-export-azure-boards`, with one neutral invented topic.
- [x] t7: Remove `.DS_Store`, `__pycache__`, and `*.pyc` files from `system/.os/skills/`. Add them to `.gitignore` and to the package exclusions.
- [x] t8: Add the deny-list check `toolkits/buildos/scripts/check-deny-list.mjs`. It reads the list at run time from a source that is never committed or shipped, such as a CI secret. It scans `system/`, the package file list, and test fixtures. On a match it prints the file and line, not the matched name, and exits non-zero.
- [x] t9: Run the deny-list check in CI on every push. Since review round 3 it runs in its own workflow, `.github/workflows/buildos-deny-list.yml`, with no path filter, and `buildos-ci.yml` keeps its path filter.

### Acceptance criteria

- A56: The deny-list check passes on the tree and fails on a planted fixture that contains a listed name. The CI log of the failing run shows the file and line but not the name. Result: pass locally after the final check (P7-F-01 to P7-F-03: every package file is read, also across drives on Windows; encoded names are found; failing tests print counts and tags only); final on the CI runs of the closing commit ([P7 Closeout](evidence.md#p7-closeout)). Passed: [deny-list run 45489679281](https://github.com/brucewaynedecoy/build-os/actions/runs/45489679281) on `42b9782` passed with the real list from the repository secret, and the deny-list tests and self-test pass on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572), with the package on another drive on Windows ([P7 CI Runs 45489678572 and 45489679281](evidence.md#p7-ci-runs-45489678572-and-45489679281)).
- A57: A search of `system/.os/skills/` finds no `.DS_Store`, `__pycache__`, or `.pyc` file, and no owner name or color constant in `fit-gap-analysis` code. Passed: `test/skills.test.ts` on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572).

### Dependencies

- Stage 1 complete.

## Stage 3 - Skills router

### Tasks

- [x] t10: Write `system/.os/skills/AGENTS.md` and a sibling `CLAUDE.md` that points to it. The router lists the skills, says how an agent installs one skill into its own app's skill location (for example Claude, Codex, or Copilot) when the user or a workflow needs it, and tells the agent to put the Make Docs choice to the user when `buildos init` exits `10`, with the two commands.
- [x] t11: Confirm `buildos init` copies `system/.os/skills/` to `.os/skills/` and writes nothing under `.claude/`, `.agents/`, or any other app folder.

### Acceptance criteria

- A58: A freshly initialized project has `.os/skills/AGENTS.md` and every packaged skill, and a test shows no `.claude/` or `.agents/` folder was created. Passed: `test/skills.test.ts` and `test/init.test.ts` on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572).
- A59: The agent review records that the router names how to install one skill and what to ask the user after exit `10`. Passed: the review is recorded as `satisfied`, with one noted limit ([Human Experience Review](evidence.md#human-experience-review-router-part-a59)).

### Dependencies

- Stage 2 complete.

## Stage 4 - `buildos validate`

### Tasks

- [x] t12: Add validate fixtures under `toolkits/buildos/test/fixtures/validate/`: one valid project and one project per failure category in `system/.os/scripts/validate_config.py` and [PRD 13 Contracts and Data](../../prd/13-adopter-owned-config-surface.md#contracts-and-data), including frontmatter hygiene and entity record hygiene.
- [x] t13: Run `validate_config.py` on each fixture and record its exit code and findings under `toolkits/buildos/test/golden/validate/`.
- [x] t14: Port the checks to `src/core/validate/` and add `src/cli/commands/validate.ts` using the shared envelope and exit codes.
- [x] t15: Add a parity test: for each fixture, `buildos validate` passes or fails the same way and reports the same set of findings as the Python script.
- [x] t16: Replace every `validate_config.py` reference in `system/` routers, contracts, and skills with `buildos validate`. Delete `system/.os/scripts/validate_config.py`. Done for every file under `system/` today; skills imported in Stage 1 get the same replacement then (open item P7-O1).

### Acceptance criteria

- A60: The validate parity test passes for every fixture on three operating systems. Passed: `test/validate-parity.test.ts` passes on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572) on `42b9782`.
- A61: A search of `system/` finds no `validate_config.py` file and no reference to it. Passed: `test/system-content.test.ts` on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572).

### Dependencies

- Stage 3 complete.

## Stage 5 - Remove the Make Docs copy

### Tasks

- [x] t17: Review `system/docs/assets/references/harness-capability-matrix.md`. If it is BuildOS-owned content, move it under `system/.os/` and update the reference in [PRD 10 Integrations](../../prd/10-discovery-runs-and-qualification.md#integrations). If it is Make Docs content, delete it and remove PRD 10's reference. Record the decision and reason in the evidence report.
- [x] t18: List every file in `system/docs/` and `system/.make-docs/`. Move any other BuildOS-owned content to a BuildOS-owned path. Record the inventory and each move in the evidence report.
- [x] t19: Delete `system/docs/` and `system/.make-docs/`. Fix links in `system/` routers that pointed into them. Remove the `system/docs/` code anchors from [PRD 02](../../prd/02-architecture-overview.md#topology) and [PRD 05](../../prd/05-spaces-boundary-and-shipping.md#scope).

### Acceptance criteria

- A62: `system/docs/` and `system/.make-docs/` do not exist, and `npm pack --dry-run` lists no path under them. Passed: `test/package.test.ts` and `test/system-content.test.ts` on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572) (173 package files, none under the removed folders).
- A63: The evidence report shows the `harness-capability-matrix.md` decision, and PRD 10 either points to the moved file or no longer cites it. A link check over `system/` and `docs/prd/` finds no broken link into the removed folders. Passed: the matrix decision is recorded, and the link check passes on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572).

### Dependencies

- Stage 4 complete.

## Stage 6 - Design write format (R-009, owner option B)

The owner chose option B on 2026-11-24 ([register R-009](../../prd/03-open-questions-and-risk-register.md#r-009-design-promotion-writes-a-make-docs-owned-path)). Built on 2026-11-24 with review round 3; see [P7 Stage 6](evidence.md#p7-stage-6).

### Tasks

- [x] t20: In a project with the Make Docs 2.0.9 layout only, write a promoted design in the 2.0.9 form: the 2.0.9 frontmatter, an empty `## Human Experience Intent` section for the planner to fill in, a next-prompt link that resolves, and no `system/docs/` wording. A project with the old `docs/assets/` layout keeps the Go bytes exactly.
- [x] t21: Record the difference as a new parity exception, update PRD 11 and PRD 20 with requirement history, and add tests for both layouts.

### Acceptance criteria

- A63a: A design promoted in a Make Docs 2.0.9 project has the 2.0.9 frontmatter and a `## Human Experience Intent` section, and its next-prompt link resolves. Result: pass (`test/design.test.ts` Stage 6; a real promotion with Make Docs 2.0.9; [P7 Stage 6](evidence.md#p7-stage-6)). The final check (P7-F-05, P7-F-06) closed two gaps: an edited template could put the link inside inline code, and a fenced example lost its meaning; both are fixed and tested ([P7 Final Check](evidence.md#p7-final-check)). Passed on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572).
- A63b: Every design golden for the old layout still matches the Go output byte for byte. Result: pass (167 of 167 golden cases, golden folders unchanged). Passed: the installed-tarball golden step gives 167 of 167 on macOS, Linux, and Windows in [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572).

### Dependencies

- Stage 5 complete.

### Closeout Notes

- Four testing decisions: Automated Implementation Testing active for every stage (parity, hostile-input, link, pack, deny-list, output-safety, and real Make Docs 2.0.9 promotion); Agent Validation recorded (A59); Unassisted Goal Testing and human acceptance not needed now.
- Performance evidence: None; not needed now. The bundle size for the PERF-001 recheck is in the evidence report.
- Human Experience Review: The `buildos validate` comparison is recorded (`satisfied`). The router review (A59) is recorded (`satisfied`, with one noted limit) in [P7 Stages 1 to 3](evidence.md#p7-stages-1-to-3).
- Optional experience handoff: Not applicable; covered by the P6 handoff.
- Explicit human acceptance gate: None.
- Evidence report: [P7 Skills and Validation](evidence.md#p7-skills-and-validation) (Stages 4 and 5) and [P7 Stages 1 to 3](evidence.md#p7-stages-1-to-3).
- Review round 3 and Stage 6 (2026-11-24): 7 findings fixed with tests, 4 minor findings tracked as follow-ups F-P7-01 to F-P7-05, the CI workflow split, and Stage 6 built (PE-020 approved under the option B decision). Parity exceptions PE-018 (HTML images) and PE-019 (explicit paths and read-back sizes) were proposed here; the owner approved both on 2026-11-24 (see review round 4 below). See [P7 Review Round 3](evidence.md#p7-review-round-3) and [P7 Stage 6](evidence.md#p7-stage-6).
- CI of the closing commit `42b9782`: [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572) (`buildos-ci`) passed every job. Tests: Linux 1,952 tests, 1,944 pass, 0 fail, 8 skipped; macOS 1,952 tests, 1,945 pass, 0 fail, 7 skipped; Windows 1,810 tests, 1,713 pass, 0 fail, 97 skipped. The installed-tarball golden step passed 167 of 167 and the conversion and eval suite 287 tests with 0 fail on all three systems; the Make Docs contract job and the OSV scan passed. [deny-list run 45489679281](https://github.com/brucewaynedecoy/build-os/actions/runs/45489679281) (`buildos-deny-list`) passed with the repository secret. See [P7 CI Runs 45489678572 and 45489679281](evidence.md#p7-ci-runs-45489678572-and-45489679281).
- Phase / capability status: Done. Every task is done (t1 to t21), and A54 to A63, A63a, and A63b pass; [CI run 45489678572](https://github.com/brucewaynedecoy/build-os/actions/runs/45489678572) and [deny-list run 45489679281](https://github.com/brucewaynedecoy/build-os/actions/runs/45489679281) on `42b9782` closed the three-OS and real-list parts ([P7 Closeout](evidence.md#p7-closeout)). The review loop is closed under the project stop rule. Follow-ups F-P7-01 to F-P7-07 and the owner items carried to P8 are listed in the closeout.
- Skills review round 1 (2026-11-24): 14 findings on Stages 1 to 3 (`d1f315b`), all fixed with tests. The deny-list check now hides every printed path part through one function, skips nothing silently, reads Office visible text, matches across lines at any size, and fails on a home-folder path; the two committed Go binaries that held a personal build path are deleted (P8 work brought forward); tests print counts instead of file lists or contents; the skills name only paths a new project has or say what to do without them; the bulk-extract helper applies the `buildos validate` anchor rules and accepts an empty references index; the Azure Boards fine-cap example is corrected; the use cases and the guide use the invented lending topic. CI run 45462792437 (`d1f315b`): the deny-list job and ubuntu and macOS passed, Windows failed on the router test, fixed here. On 2026-11-24 the owner made the repository private and left git history as it is for now. See [P7 Skills Review Round 1](evidence.md#p7-skills-review-round-1).
- Review round 1 (2026-11-24): 14 findings, all fixed with tests; see [P7 Review Round 1](evidence.md#p7-review-round-1). The `buildos validate` contract in PRD 13 now states the reserved sentinel `both`, the saved anchor path rules, the RFC 3339 UTC profile for `extracted_at` (an orchestrator decision the owner may veto), ASCII case-insensitive names, and the link rules. `buildos design promote` reads the Make Docs 2.0.9 inputs under `.make-docs/system/` (PRD 11; register R-009), and an adoption notes the old Python validator. The parity set has 84 cases. Open: a three-OS CI run of the round (P7-O7), the R-009 write-format question (P7-O8), and proposed parity exception PE-017 (P7-O9).
- Skills review round 2 and review round 4, the closing check of Stages 4 to 6 (2026-11-24): 13 findings, all fixed with tests. CI run 45474800265 failed on the simulated home path that the bundled PDF reader defines; the local self-test had not scanned the built package, and now does, as CI does. The deny-list check reads XML in its declared encoding, joins actual text nodes, reads ZIP, PDF, and PNG metadata, and matches UNC and Unicode home-folder paths; test messages print hash tags, not names; the guide examples load together and pass `buildos validate`; the CI path filter covers whole folders. Discovery records the raw finding it read; every JSONL writer checks each row against its reader's line limit (exit 4); HTML image addresses are decoded once before the containment check; the Make Docs 2.0.9 design form is checked before filling, escapes finding text, and reads itself back. The owner approved PE-018 and PE-019; both scopes widened in this round (image address decoding; JSONL row limits). See [P7 Skills Review Round 2](evidence.md#p7-skills-review-round-2) and [P7 Review Round 4](evidence.md#p7-review-round-4-closing-check).
- Final check of `d2e45e6` (2026-11-24): 7 findings (4 blockers, 3 majors), all fixed with tests; the last fix pass of P7. CI run 45483759496 failed on Windows because the deny-list package scan, with the package staged on another drive, read none of the 173 package files and still passed; each package file is now read from its own disk path, and the check fails unless it reads every listed file. The deny-list check also finds names written with character references or percent-encoding. A sweep of 381 test assertions on shipped, imported, or guide content leaves none that can print a value, and a meta-test with planted invented values proves it; tags now come with line numbers, and the locator finds every tag form. A JSONL append adds a line feed before the new row when the index does not end in one (Go did not; recorded in PE-019, flagged to the owner). The 2.0.9 design form checks every placeholder position and the exact Next Prompt line, and keeps fenced examples. See [P7 Final Check](evidence.md#p7-final-check) and [P7 Closeout](evidence.md#p7-closeout).
