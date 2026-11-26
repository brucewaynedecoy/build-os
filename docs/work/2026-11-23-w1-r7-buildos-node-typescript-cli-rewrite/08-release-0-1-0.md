---
title: "Phase 8: Release 0.1.0"
kind: "work"
status: "active"
coordinate: "W1 R7 P8"
source:
  type: "prd"
  path: "docs/prd/20-buildos-cli-and-distribution.md"
---

# Phase 8: Release 0.1.0

## Purpose

Prepare the first public release, `0.1.0`. Build the release workflow, finish the security document, update the guide and README, record performance evidence, and remove the Go code. Publication happens only after separate maintainer approval.

## Overview

The release flow: a reviewed tarball digest is committed first; a prepare run checks the tagged commit and attaches the tarball and SBOM to a draft GitHub Release; the maintainer publishes it (immutable); the release run rebuilds, and after a required reviewer approves the staging job, `npm stage publish --provenance` stages the release asset with npm trusted publishing (no stored token) for a 2FA approval (review round 2). BuildOS adds a CycloneDX SBOM, scans, and the client-name deny-list check. The staged package must install and run on three operating systems before anyone asks for approval.

## Entry Gate

- P7 exit gate passed.
- [`D-005`](../../prd/03-open-questions-and-risk-register.md#d-005-legacy-editorial-prds-fail-prd-authority-validation) is already closed, because it gates P1.
- The owner has decided on the repository's git history and visibility. On 2026-11-24 the owner made the repository private (it had been public, with 0 forks) and left history as it is for now; old commits still hold the client text removed in P7 and two removed Go binaries with a personal build path. On 2026-11-25 the owner decided the exact method (it replaces the history rewrite of 2026-11-24, because after a force-push in place GitHub can still serve the old commits by their hash): the current repository is renamed to `build-os-archive` and stays private for good, with the old history; a new repository `brucewaynedecoy/build-os` starts with one clean commit of the release tree, which the orchestrator prepares on a copy and the owner reviews before the first push; the deny-list check with the real list runs on that tree before the push; the new repository becomes public before the release, so npm provenance works; and every repository setting of the release checklist (rulesets, environments, secrets, immutable releases, private vulnerability reporting, npm trusted publisher) is made on the new repository ([SECURITY.md](../../../toolkits/buildos/SECURITY.md#owner-settings-for-releases), steps 1 to 17). Commit hashes in these docs from before the public repository (for example the frozen Go baseline `263f5ca`) name commits of the earlier history, which exists only in the private archive repository `brucewaynedecoy/build-os-archive`: the public repository starts from one clean commit (owner decision of 2026-11-25). Not met yet: the rename, the new repository, its first push, and the visibility change are owner actions still to do.
- Repository cutover (pin-first review round 2, finding 8), before the step that creates the new repository: retarget every existing clone, worktree, and automation of the old repository to the archive URL (`git remote set-url origin git@github.com:brucewaynedecoy/build-os-archive.git`) and check each with `git remote -v`, because after the rename their `origin` still names `brucewaynedecoy/build-os`, and an ordinary push of an old branch would publish old history to the new public repository. Start the new repository's work from a fresh clone only. GitHub Free has rulesets only on a public repository, and a branch rule never stops a tag (pin-first final check, finding 4), so there is no ruleset before the first push. Instead: create the new repository private and empty; make the one clean commit in a fresh folder with no other remote and no old objects (`git init -b main`, copy the reviewed tree, one commit), run the real-list deny-list check, and push only `main`; check the remote (`git ls-remote --heads --tags` shows one line, `refs/heads/main`; a mirror clone holds one commit; no tag); make it public; at once add the branch and tag rulesets, release immutability, the environments, the secret, and private vulnerability reporting; then check the remote again ([SECURITY.md](../../../toolkits/buildos/SECURITY.md#owner-settings-for-releases), steps 3 to 16). CI run links in these documents from before the cutover name runs of the earlier repository; after the cutover, those runs are in the private archive repository `brucewaynedecoy/build-os-archive`. Not met yet: owner actions.

## Human Experience Outcome

- Impact and governing promise or preserved boundary: `direct`. Promises: an enterprise reviewer finds every outside package, its version, license, reason, and checks in one document, plus the SBOM and provenance ([PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain), [Release](../../prd/20-buildos-cli-and-distribution.md#release)); one agent-run `buildos init` works from the real package; legacy names are announced as ending in `0.3.0`.
- Intended human outcome: A reviewer can approve BuildOS from `SECURITY.md`, the SBOM, and the provenance without reading code. An adopter follows the guide and needs only Node 24.
- Human-facing surface or indirect effect: `toolkits/buildos/SECURITY.md`, the SBOM, npm provenance, the user guide, `README.md`, release notes, and the staged package.
- Implementation work: Stages 1 through 5.
- Evidence source or testing type selected under current authority: Security-document review against bundle contents, SBOM, and scan output; staged-package smoke tests on three operating systems; `PERF-001` recheck and `PERF-002`.
- Executor: Implementing agent; the maintainer configures trusted publishing, approves publication, and approves the stage with npm 2FA.
- Accepted obligation or deferral route: None.

## Current Testing Decisions

| Testing type | Current decision | Decision record or `not-needed-now` reason |
| --- | --- | --- |
| Automated Implementation Testing | Active | Release workflow checks, staged-package smoke tests on three operating systems, and rollback by version pin on a copied project. |
| Performance Testing | Active (`characterize-now`) | `PERF-001` recheck and `PERF-002`; see the fields below. |
| Guided Progress Review | `not-needed-now` | The maintainer's publication review in Stage 5 is a release approval, not a progress review. |
| Unassisted Goal Testing | `not-needed-now` | No accepted authority activates it. The chat-app trials for `R-012` in t17 are functional environment checks. |

Performance candidate `PERF-001` recheck:

- Base maintenance action: `update-existing`
- Performance applicability: `characterize-now`
- Canonical `PERF-###` profile link or `none`: `PERF-001` in [P1](./01-typescript-package-foundation.md). The build changed materially since P1, so the recheck reruns the profile on the release candidate. If the workload must change to include ported commands, increment the profile version in P1 first.
- Finite evidence budget and stop-rule reference or `not-applicable`: A separate budget event authorized by entry to this phase, with the same limits as P1: two passes, one correction attempt, one review cycle, one working day, no external spend. Stop at budget exhaustion or when a pass does not change the decision.
- Execution packet link or `not-applicable`: Rendered into the `PERF-001` section of this backlog's `evidence.md` by t21.
- Outcome and evidence handoff or `none`: Recorded by t21.
- Gate disposition and supported-scope limit or `not-applicable`: Characterization only. A result can lead to an owner decision on a lazy-load or bundling change before `0.1.0`. It sets no target.

Performance candidate `PERF-002`:

- Base maintenance action: `create`
- Performance applicability: `characterize-now`
- Canonical `PERF-###` profile link or `none`: `PERF-002`, written in this file under `## PERF-002 Profile` by t22 before the first pass. Target class `characterization-baseline`. Protected outcome: the first command in a new chat session completes without the user thinking it failed. Decision informed: whether the package size needs reduction.
- Finite evidence budget and stop-rule reference or `not-applicable`: Two passes on the staged package, one review cycle, half a working day, compute limited to one maintainer machine, no external spend. Stop at budget exhaustion or when a pass does not change the decision. Source: [plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan).
- Execution packet link or `not-applicable`: Rendered into the `PERF-002` section of this backlog's `evidence.md` by t22.
- Outcome and evidence handoff or `none`: Recorded by t23.
- Gate disposition and supported-scope limit or `not-applicable`: Characterization only. Scope: first-run `npx -y` with an empty npm cache on the measured machine and network.

Human Experience Review is separate. The agent reviews `SECURITY.md` against the bundle, SBOM, and scans (A68) and the real staged-package output (t15). A short experience handoff for the reviewer is optional: open `SECURITY.md` from the package page and check that one package can be traced to the SBOM.

## Source PRD Docs

- [PRD 20 Release](../../prd/20-buildos-cli-and-distribution.md#release)
- [PRD 20 Supply Chain](../../prd/20-buildos-cli-and-distribution.md#supply-chain)
- [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package) and [Legacy Command Names](../../prd/20-buildos-cli-and-distribution.md#legacy-command-names)
- [PRD 01 Key Capabilities](../../prd/01-product-overview.md#key-capabilities) and [Current Limitations](../../prd/01-product-overview.md#current-limitations)
- [PRD 05 Installed Project Paths](../../prd/05-spaces-boundary-and-shipping.md#installed-project-paths)
- [PRD 07 Contracts and Data](../../prd/07-intake-and-conversion.md#contracts-and-data) (eval gate on every release that changes a converter)
- [PRD 13 Contracts and Data](../../prd/13-adopter-owned-config-surface.md#contracts-and-data) (`buildos validate` in the guide)
- Register: [`D-005`](../../prd/03-open-questions-and-risk-register.md#d-005-legacy-editorial-prds-fail-prd-authority-validation), [`R-003`](../../prd/03-open-questions-and-risk-register.md#r-003-build-os-packaging-upgrade-rollback-and-removal-hardening), [`R-010`](../../prd/03-open-questions-and-risk-register.md#r-010-supply-chain-exposure-in-enterprise-installs), [`R-012`](../../prd/03-open-questions-and-risk-register.md#r-012-node-24-and-npx-reach-in-chat-app-and-enterprise-environments)

## Plan And Design Lineage

- Plan: [03 Work Backlog Shape, P8 and the Legacy-PRD Cleanup Gate](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-work-backlog-shape.md#legacy-prd-cleanup-gate); [cleanup handoff](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-legacy-prd-cleanup-handoff.md); [performance plan](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan)
- Design: [Decision 13, Release flow](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#13-release-flow) and [Decision 3, One package at a stable path](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md#3-one-package-at-a-stable-path)

## Source Obligations, Scenarios, And Findings

- None. No `O-###`, `NUAT-###`, or finding applies.

## Stage 1 - Release workflow

### Tasks

- [ ] t1: **Needs the maintainer.** The maintainer configures npm trusted publishing for `@brucewaynedecoy/buildos` and the release workflow. No publish token is stored. Owner decision of 2026-11-24 (option A): the maintainer first stages and approves, by hand, a reserved-name placeholder `0.0.0-reserved.0` with dist-tag `reserved` (built from this repository by `scripts/reserved-placeholder.ts`: `package.json`, a README that says it only reserves the name, and `LICENSE`; no code), so the package exists; then configures the trusted publisher for `buildos-release.yml` in the environment `buildos-npm-stage`, staging only, within 2 days of the `0.1.0` release run (an unused configuration expires after 2 days); then sets Publishing access to "Require two-factor authentication and disallow tokens"; then `0.1.0` goes through the workflow with provenance and the dist-tag `latest`. npm does not document whether a first publish with `--tag` also sets `latest`, so the maintainer checks `npm view ... dist-tags` and, if needed, runs `npm dist-tag add @brucewaynedecoy/buildos@0.1.0 latest`; the placeholder versions are deprecated, not unpublished. The exact steps are in `toolkits/buildos/AGENTS.md` (First Publication), verified against docs.npmjs.com on 2026-11-24 ([P8 Review Round 1](evidence.md#first-publication-facts)).
- [x] t2: Make `npm pack` reproducible: the same commit gives the same tarball bytes. Add a CI check that packs twice and compares digests. Done 2026-11-24: esbuild's working folder fixed to the package root; `scripts/reproducible-pack.ts` in CI on three systems, with a report-only cross-OS comparison; byte identity claimed on the reference environment (`ubuntu-24.04`, Node 24.22.3, npm 11.19.1) ([Reproducibility](evidence.md#reproducibility-t2)). On `980b67a` the pack check passed on three systems and the cross-OS report job passed in [`buildos-ci` run 45525496472](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496472).
- [x] t3: Add the release-candidates file `toolkits/buildos/release-candidates.json`. For each release it records the version, the tag, and the reviewed tarball SHA-256. It is committed before the release. Done 2026-11-24: the file (no entry yet), `scripts/release-candidate.ts`, and the maintainer steps ([Release-Candidate Mechanism](evidence.md#release-candidate-mechanism-t3)).
- [x] t4: Add `.github/workflows/buildos-release.yml`, started by a published GitHub Release. It checks that the tag, the `package.json` version, and the committed digest agree, and that the rebuilt tarball's digest equals the committed one. It runs the eval gate, audit, OSV scan, and deny-list check. It runs `npm stage publish --provenance`. Done 2026-11-24, with every gate in `scripts/release-gate.ts`, a dry-run mode, and planted failures ([Release Workflow and Gates](evidence.md#release-workflow-and-gates-t4)). Review round 1 (2026-11-24) rebuilt the job graph around one resolved commit and a trust boundary: the jobs with the real deny list or the OIDC permission run no candidate code ([P8 Review Round 1](evidence.md#p8-review-round-1)). Review round 2 (2026-11-24): every privileged job runs trusted default-branch code only and reads the ledger from git; a draft, prepare run, and required reviewer come before staging; a clean npm call ([P8 Review Round 2](evidence.md#p8-review-round-2)). The verify stage ran on GitHub on `b3430d9` and `6e8e226`. Final check (2026-11-24): the staging check requires exactly the tarball and the SBOM on the published release, compares the SBOM with the run's own verify SBOM, accepts both GitHub download forms, and the privileged jobs check the rulesets in-job ([P8 Final Check for Stages 1 to 3](evidence.md#p8-final-check-for-stages-1-to-3)). On `980b67a` (the final check fixes) the [dry run 45525499690](https://github.com/brucewaynedecoy/build-os/actions/runs/45525499690) on branch `release-dry-run/980b67a` passed: resolve and verify passed, and the privileged jobs were skipped by design ([P8 CI Runs and Dry Run on 980b67a](evidence.md#p8-ci-runs-and-dry-run-on-980b67a)). The prepare and release paths have not run yet; they need the owner settings and a real tag.
- [x] t5: Generate a CycloneDX SBOM with `npm sbom --sbom-format cyclonedx` and attach it to the GitHub Release. Done 2026-11-24: `scripts/sbom.ts` marks the bundled packages ([SBOM Decision](evidence.md#sbom-decision)). Review round 1: the SBOM is validated against the vendored official CycloneDX 1.5 JSON schema. Review round 2: the check compares hash, version, and license values, and the SBOM is attached to the draft release by trusted code after it checked the SBOM records the tarball digest and the source commit.
- [x] t6: Make the release build set the version and source revision, so `buildos version` and every envelope report them. Done 2026-11-24: `scripts/release-build.ts`; a dirty tree is refused, or reported as `<commit>-dirty` with `--allow-dirty` ([Version and Revision](evidence.md#version-and-revision-t6)).

### Acceptance criteria

- A64: A dry run of the workflow on a test tag fails when the tag, version, or digest disagree, and passes when they agree. Met for verification; live prepare and release behavior needs the real release. On the reference runner on `980b67a`, the agreement [dry run 45525499690](https://github.com/brucewaynedecoy/build-os/actions/runs/45525499690) passed (resolve and verify; the privileged jobs skipped by design) ([P8 CI Runs and Dry Run on 980b67a](evidence.md#p8-ci-runs-and-dry-run-on-980b67a)). Earlier, on the reference runner on `6e8e226`, the agreement run 45520465018 passed and the planted digest run 45520468162 stopped at the digest gate; locally after the final check, the agreement run and each plant ([P8 Final Check for Stages 1 to 3](evidence.md#p8-final-check-for-stages-1-to-3)). History: Shown locally on 2026-11-24 (`scripts/release-dry-run.ts`, agreement and planted `tag`, `version`, and `digest`), and again after review round 1 in a scratch clone with version `0.1.0`: a self run (build B checked against an entry from build A) and a fixture `reviewed` entry on a candidates-only commit ([P8 Review Round 1](evidence.md#local-dry-runs-after-review-round-1)); the GitHub dry runs on the reference runner passed on `b3430d9` ([P8 CI Runs and Dry Runs on b3430d9](evidence.md#p8-ci-runs-and-dry-runs-on-b3430d9)), closing A64 for the verify stage; after review round 2, the local dry runs passed again in the new flow.
- A65: The workflow stops before staging when the eval gate, `npm audit`, the OSV scan, or the deny-list check fails, shown by one planted failure each. Met for verification (the verify stage); live prepare and release behavior needs the real release, and the real-list deny-list job is first exercised by a prepare run. On `980b67a` every verify gate passed again in the agreement [dry run 45525499690](https://github.com/brucewaynedecoy/build-os/actions/runs/45525499690), and the invented-list deny-list job passed in [`buildos-deny-list` run 45525496513](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496513). History: Shown locally on 2026-11-24, one planted failure each, before and after review rounds 1 and 2, and on the reference runner on `b3430d9` (runs 45510656388, 45510660339, 45510663900, 45510666162), which closes A65 for the verify stage.
- A66: A release-candidate build reports its real version and source revision in `buildos version`. Shown locally on 2026-11-24 (the packed release build and `test/release.test.ts`), and after review round 1 by the installed golden comparison of the release-stamped tarball (167 of 167, expecting `0.1.0` and the source commit); on the reference runner, the dry run agreement run 45520465018 on `6e8e226` and the agreement [dry run 45525499690](https://github.com/brucewaynedecoy/build-os/actions/runs/45525499690) on `980b67a` passed the version and installed gates (met for verification; `buildos version` of the staged package is checked in t15 and t18).

### Dependencies

- Entry gate met.

## Stage 2 - Security document, guide, and README

### Tasks

- [x] t7: Finish `toolkits/buildos/SECURITY.md`: the final package table, bundling, how to verify npm provenance, where the SBOM is, the release checks, the deny-list check described without names, rollback by version pin, and how to report a vulnerability. Finish `THIRD_PARTY_NOTICES.md`. Done 2026-11-24 ([P8 Stage 2](evidence.md#p8-stage-2)); the report channel needs an owner action (private vulnerability reporting, after the repository is public).
- [x] t8: Update the user guide in `guide/content/`, starting with `04-install-and-configure-your-instance.md`: Node 24 as the one prerequisite, setup with `npx -y @brucewaynedecoy/buildos@<version> init`, the Make Docs choice, `buildos validate` in place of the Python script, an offline install path, and the notice that legacy names stop working in `0.3.0`. Rebuild `guide/BuildOS-Guide.html` with `guide/tools/build-guide.mjs`. Done 2026-11-24: all 22 chapters checked, 18 changed, none merged or removed; the seven `docs/assets/` pages with the Go notice brought to the Node CLI; `USE_CASES.md` links fixed ([P8 Stage 2](evidence.md#changes-by-task)).
- [x] t9: Update the repository `README.md` and write `toolkits/buildos/README.md` for the npm page: install, commands, legacy-name notice, and a link to `SECURITY.md`. Done 2026-11-24; the tarball keeps 173 files.
- [x] t10: Draft the `0.1.0` release notes with the `0.3.0` legacy-name removal notice. Done 2026-11-24: `toolkits/buildos/RELEASE_NOTES.md`, marked draft.

### Acceptance criteria

- A67: A search of `guide/content/` and `README.md` finds no `validate_config.py`, Homebrew, archive download, or `go build` instruction, and finds the `0.3.0` legacy-name notice. Passed locally on 2026-11-24, kept by a test in `test/guide-examples.test.ts` ([A67 Search Proof](evidence.md#a67-search-proof)); the test passed on three systems in [`buildos-ci` run 45525496472](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496472) on `980b67a` (met).
- A68: `SECURITY.md` names every package in the release bundle, and the agent's comparison against the bundle contents, the SBOM, and the scan output finds no gap. Passed locally on 2026-11-24 against a pack of `548f4ea`; the release SBOM and scans of the reviewed candidate are rechecked at t24 ([A68 Security Document Comparison](evidence.md#a68-security-document-comparison)). Met for verification; the bundle and lockfile did not change after `548f4ea`, and the OSV job passed in [`buildos-ci` run 45525496472](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496472) on `980b67a`.

### Dependencies

- Stage 1 workflow exists.

## Stage 3 - Go removal

### Tasks

- [x] t11: Confirm from the evidence report that the entities, intake, discovery, and design parity gates all passed. Done 2026-11-24 ([Go Removal](evidence.md#go-removal-t11-to-t14)).
- [x] t12: Delete `toolkits/buildos/cmd/`, `toolkits/buildos/internal/`, `toolkits/buildos/pkg/`, `toolkits/buildos/go.mod`, `toolkits/buildos-intake/`, `toolkits/buildos-discovery/`, and `toolkits/buildos-design/`. Keep the goldens and the harness, which no longer need Go. Done 2026-11-24; the capture workflow is deleted and the goldens are frozen at Go source commit `263f5ca` (last Go commit `e8a1ec7`).
- [x] t13: Remove the Go recipes from the root `justfile` (`build-buildos`, `test-buildos`, `install-toolkits`, `check-toolkits`, `uninstall-toolkits`), or replace them with npm equivalents. Update `toolkits/AGENTS.md` and `toolkits/README.md`. Done 2026-11-24: npm recipes with the same names.
- [x] t14: Confirm no Python file ships to users outside skill scripts, which P9 removes. Done 2026-11-24: three skill-script files only; `test/package.test.ts` checks it.

### Acceptance criteria

- A69: A search of the repository finds no `.go` file and no `go.mod`, and the `justfile` has no `go` command. Passed locally on 2026-11-24 ([Go Removal](evidence.md#go-removal-t11-to-t14)), and again on `980b67a` (`git ls-files`: no `.go` file and no `go.mod`; no `go` command in the `justfile`) (met).
- A70: The golden harness still passes on three operating systems after the Go removal. Locally on macOS: 167 of 167 from the installed tarball, no golden changed; met on 2026-11-24 by `buildos-ci` run 45520462648 on `6e8e226` (ubuntu, macOS, and Windows passed), and again by [`buildos-ci` run 45525496472](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496472) on `980b67a` (met).

### Dependencies

- Stage 2 complete.

## Stage 4 - Staged-package proof

### Tasks

- [ ] t15: Smoke-test the reviewed tarball on macOS, Linux, and Windows with Node 24, through `npx -y`, in clean folders: `version`, `init --skip-make-docs`, `init` with no TTY (exit `10`), one intake conversion, `entities validate`, `validate`, one legacy name, and a wrapper with Node missing. The agent reviews the real output against the P6 review and records any change.
- [ ] t16: Prove rollback by version pin on a copied project. Pin an earlier release-candidate version in `.os/manifest.json` and confirm the wrapper runs that version.
- [ ] t17: **Needs the maintainer.** Run `buildos init` through at least one chat app with folder access that adopters use, and once on a restricted network. Record the results for `R-012`.
- [ ] t18: Confirm the staged package's provenance and that its digest matches the committed digest.

### Acceptance criteria

- A71: The smoke tests pass on three operating systems, and the captured output matches the P6 reviewed output except for version strings.
- A72: The rollback test runs the pinned earlier version on a copied project.
- A73: The evidence report records the chat-app and restricted-network results, and the guide documents the offline install.

### Dependencies

- Stage 3 complete (done, except t1, which needs the maintainer).
- The owner settings in `toolkits/buildos/SECURITY.md` (Owner Settings for Releases, steps 1 to 17), the archive rename, the new repository with one clean commit, and its public visibility, the placeholder publication and trusted publishing (`toolkits/buildos/AGENTS.md`, First Publication), and a staged `0.1.0` package from a real prepare and release run. None of these exists yet.

## Stage 5 - Performance evidence and publication review

### Tasks

- [x] t19: Render the `PERF-001` recheck packet from the P1 profile, with the new fingerprint. Done 2026-11-24; profile v1.1 unchanged, workload unchanged ([Startup Recheck (PERF-001, P8)](evidence.md#startup-recheck-perf-001-p8)).
- [x] t20: Record the reason for the rerun: the build changed materially since P1. Done 2026-11-24.
- [x] t21: Run the `PERF-001` recheck within its budget. Record the distribution, uncertainty, ledger, outcome, and decision in the evidence report. Done 2026-11-24: one pass, outcome `pass`, BuildOS overhead about 40 ms (58% of a short command); the lazy-load question goes to the owner.
- [ ] t22: Write the `PERF-002` profile under a `## PERF-002 Profile` heading at the end of this file before any measurement. Use `make-docs://system/template/performance-evidence-profile.md`. Declare the staged package version, machine class, network, empty-cache rule, measurement boundary (`npx -y @brucewaynedecoy/buildos@<staged version> version` from start to exit), repetitions, statistic, and raw-evidence location. Set no target. Render its packet into the evidence report.
- [ ] t23: Run at most two `PERF-002` passes on the staged package and hold one review cycle. Record the outcome and decide whether the package size needs reduction.
- [ ] t24: Prepare the publication review for the maintainer: tarball digest, provenance, SBOM, scan results, deny-list result, eval gate, smoke results, performance outcomes, `SECURITY.md`, and the closed `D-005`.
- [ ] t25: **Needs the maintainer.** The maintainer decides on publication. Only after that approval does the maintainer approve the staged package with npm 2FA. No agent publishes.

### Acceptance criteria

- A74: The evidence report shows both performance results within their budgets, each with a stated decision and no target.
- A75: The publication review lists every item in t24, and publication happens only after a recorded maintainer approval.

### Dependencies

- Stage 4 complete. t22 to t25 measure and review the staged package, so they need the same placeholder publication, public repository, and staged package as Stage 4.

### Closeout Notes

- Four testing decisions: Pending phase close.
- Performance evidence: Pending phase close.
- Human Experience Review: Pending phase close.
- Optional experience handoff: Pending phase close.
- Explicit human acceptance gate: Maintainer approval of each publication, per [PRD 20 Release](../../prd/20-buildos-cli-and-distribution.md#release). Scope: the `0.1.0` publication. Reviewer: the BuildOS maintainer. Surface: the publication review from t24. Question: publish this staged package? Effect: blocks publication only.
- Evidence report: Pending phase close.
- Stage 1 and Stage 3 (2026-11-24): built and checked locally, not committed; see [P8 Release 0.1.0](evidence.md#p8-release-010). t1 needs the maintainer and an owner answer on the first publish (the package does not exist on npm yet, so trusted publishing cannot be configured).
- Stage 2 and the `PERF-001` recheck (2026-11-24): built and checked locally, not committed; see [P8 Stage 2](evidence.md#p8-stage-2) and [Startup Recheck (PERF-001, P8)](evidence.md#startup-recheck-perf-001-p8). Two owner questions are open there (startup cost before `0.1.0`; a global `buildos` overrides the pin).
- Review round 1 of Stages 1 and 3 (2026-11-24): every finding fixed with a test, not committed; see [P8 Review Round 1](evidence.md#p8-review-round-1). Two owner questions stay open (lazy-loading the PDF reader before `0.1.0`; whether a global `buildos` overrides the pin).
- Review round 2 (2026-11-24): every finding fixed with a test or stated as an owner question, not committed; see [P8 Review Round 2](evidence.md#p8-review-round-2). The release flow changed (draft, prepare run, required reviewer before staging); the owner confirms it. Owner questions: PDF reader lazy load, wrapper order (`Q-015`), project wrappers with legacy names (`Q-016`), `intake --json` (`D-010`).
- Final check of Stages 1 to 3 (2026-11-24, after review round 3 of `6e8e226`): two blockers and six majors fixed with tests, not committed; no further review under the stop rule; see [P8 Final Check for Stages 1 to 3](evidence.md#p8-final-check-for-stages-1-to-3), which holds the final ordered owner checklist and what only a real prepare or release run can show.
- CI and dry run on `980b67a` and closeout of Stages 1 to 3 (2026-11-24): [`buildos-ci` run 45525496472](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496472), [`buildos-deny-list` run 45525496513](https://github.com/brucewaynedecoy/build-os/actions/runs/45525496513), the [dry run 45525499690](https://github.com/brucewaynedecoy/build-os/actions/runs/45525499690), and its deny-list run 45525499656 passed; the dry-run branch was deleted afterwards. The review loop for Stages 1 to 3 is closed under the project stop rule after three review rounds and the final check; see [P8 CI Runs and Dry Run on 980b67a](evidence.md#p8-ci-runs-and-dry-run-on-980b67a) and [P8 Stages 1 to 3 Closeout](evidence.md#p8-stages-1-to-3-closeout), which holds the acceptance table, follow-ups F-P8-01 to F-P8-05 (with F-P8-S2-01 to F-P8-S2-03), the ordered owner checklist, what only a real prepare or release run can prove, and the open owner questions.
- Pin-first wrappers final check (2026-11-25, after review round 3 of `a474c45`): nine findings fixed with tests, one (the Windows long-line estimate) is follow-up F-P8-08; the three-round review limit is reached, and this pass closes the review; see [Pin-First Wrappers Final Check](evidence.md#pin-first-wrappers-final-check).
- Phase / capability status: In progress: Stages 1 to 3 done; Stages 4 and 5 wait on owner actions. Done: t2 to t14 and t19 to t21; A64 to A70 met for verification (live prepare and release behavior needs the real release). Open: t1 (the maintainer configures npm trusted publishing), Stage 4 (t15 to t18), and Stage 5 t22 to t25. They depend on, in order: the fresh git history with one clean commit (owner decision 2026-11-25; the orchestrator prepares it); a public repository; the GitHub rulesets, environments, and release immutability; the npm placeholder publication and trusted publishing (t1); and a staged `0.1.0` package from a real prepare and release run. The owner answered the questions listed in the closeout on 2026-11-25; see the Owner Decisions 2026-11-25 section below.

## Owner Decisions 2026-11-25

The owner chose option A for each answer. The full record is [Owner Decisions 2026-11-25](evidence.md#owner-decisions-2026-11-25) in the evidence report.

1. Release flow: confirmed (draft release, prepare run, the maintainer publishes the release, a required reviewer approves `buildos-npm-stage`, `npm stage publish`, the maintainer approves on npm with 2FA). No code change.
2. `Q-015`: closed, pin-first. Built in this phase: the project wrappers always run the pinned version, and an installed `buildos` runs only when it is an npm install of exactly that version (pin-first review round 1 replaced the earlier `buildos version --json` check, which started the program; [evidence](evidence.md#pin-first-wrappers-review-round-1)). F-P8-S2-01 is closed.
3. `Q-016`: closed. Built in this phase: the project scripts with the legacy names print the package's legacy-name notice (PE-016, extended) and are removed in `0.3.0` with the package legacy names (F-P8-07). F-P8-S2-02 is closed.
4. `D-010`: `intake --json` comes in `0.2.0`, on the `0.2.0` branch. Not in this phase.
5. Startup cost: `0.1.0` ships as it is; the PDF reader lazy load comes in a later release with a new `PERF-001` recheck (F-P8-06).
6. Git history: the current repository is renamed to `build-os-archive` and stays private for good; a new repository `brucewaynedecoy/build-os` starts with one clean commit of the release tree, prepared by the orchestrator on a copy and reviewed by the owner before the first push (see the Entry Gate).
7. PE-021 approved: `.xlsx` parity is checked by workbook content, not file bytes. Built on the `0.2.0` branch `rewrite/ts-cli-p9`.
8. SD-04 accepted: `fitgap` and `export azure-boards` read only files inside the project. Built on the `0.2.0` branch `rewrite/ts-cli-p9`.

Still open: the sole-maintainer or two-maintainer route (owner checklist step 5), and every owner action and real-run step listed in the closeout.
