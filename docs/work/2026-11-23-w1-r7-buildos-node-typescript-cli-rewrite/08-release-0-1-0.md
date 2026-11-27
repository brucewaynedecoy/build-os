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

- [x] t1: **Needs the maintainer.** The maintainer configures npm trusted publishing for `build-os` and the release workflow. No publish token is stored. Owner decision of 2026-11-24 (option A): the maintainer first stages and approves, by hand, a reserved-name placeholder `0.0.0-reserved.0` with dist-tag `reserved` (built from this repository by `scripts/reserved-placeholder.ts`: `package.json`, a README that says it only reserves the name, and `LICENSE`; no code), so the package exists; then configures the trusted publisher for `buildos-release.yml` in the environment `buildos-npm-stage`, staging only, within 2 days of the `0.1.0` release run (an unused configuration expires after 2 days); then sets Publishing access to "Require two-factor authentication and disallow tokens"; then `0.1.0` goes through the workflow with provenance and the dist-tag `latest`. npm does not document whether a first publish with `--tag` also sets `latest`, so the maintainer checks `npm view ... dist-tags` and, if needed, runs `npm dist-tag add build-os@0.1.0 latest`; the placeholder versions are deprecated, not unpublished. The exact steps are in `toolkits/buildos/AGENTS.md` (First Publication), verified against docs.npmjs.com on 2026-11-24 ([P8 Review Round 1](evidence.md#first-publication-facts)). Done 2026-11-26 (owner-reported): the placeholder, the trusted publisher, and the publishing-access setting; `0.1.0` then went through the workflow with provenance ([First Publication of 0.1.0](evidence.md#first-publication-of-010-2026-11-26)).
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

- [ ] t15: Smoke-test the reviewed tarball on macOS, Linux, and Windows with Node 24, through `npx -y`, in clean folders: `version`, `init --skip-make-docs`, `init` with no TTY (exit `10`), one intake conversion, `entities validate`, `validate`, one legacy name, and a wrapper with Node missing. The agent reviews the real output against the P6 review and records any change. Performed 2026-11-26 on the published `build-os@0.1.0` under the owner decision of 2026-11-26 (option 1): passed on macOS (this machine and CI), Linux, and Windows with Node 24 in [`buildos-smoke` runs 45901774926 and 45902212190](evidence.md#smoke-tests-on-three-systems-t15); the script `toolkits/buildos/scripts/published-smoke.ts` and the workflow `.github/workflows/buildos-smoke.yml` stay for later releases. Corrected after review round 1 of pull request 5: 5 differences from the P6 reviewed output are not version strings, each with its source (rows 2, 3, 6a, 8, and 9 of the [comparison](evidence.md#comparison-with-the-p6-reviewed-output)); and one defect was found in the published package: the `entities rebuild-index` fix command that `entities validate` prints uses a bare `buildos` and exits 127 for an adopter with no global install (the data and the validation result are correct; workaround `.os/scripts/buildos entities rebuild-index ...` or `npx -y build-os@0.1.0 entities rebuild-index ...`; Go parity; [F-P8-11](evidence.md#defect-the-printed-rebuild-command-needs-a-global-install-f-p8-11), owner decision open). The result stands, pending stage acceptance (A71 to A73).
- [ ] t16: Prove rollback by version pin on a copied project. Pin an earlier release-candidate version in `.os/manifest.json` and confirm the wrapper runs that version. Partly done 2026-11-26: no earlier runnable public version exists, so the wrapper's pin behaviour was shown on a copied project with a locally built, never-published candidate `0.0.1-rc.rollback` ([Rollback by Version Pin (t16)](evidence.md#rollback-by-version-pin-t16)). That proves less than A72 asks for the public path; open. The public proof waits for `0.2.0` rolling back to `0.1.0` (F-P8-09). Owner decision 2026-11-27 ("I accept that order"): the public rollback proof (F-P8-09) comes after the `0.2.0` publication, as a dated owner exception for the `0.2.0` release gate; t16 stays open until the proof ([Owner Decisions of 2026-11-27](evidence.md#owner-decisions-of-2026-11-27-020-release)). Update 2026-11-27, after the `0.2.0` publication: the public rollback `0.2.0` to `0.1.0` through `npx` from the registry passed on a copied project on macOS, by hand, with the guide's steps ([Rollback From 0.2.0 to 0.1.0 Through npx (F-P8-09)](evidence.md#rollback-from-020-to-010-through-npx-f-p8-09)); Linux and Windows are not run, so t16 stays open.
- [ ] t17: **Needs the maintainer.** Run `buildos init` through at least one chat app with folder access that adopters use, and once on a restricted network. Record the results for `R-012`. Not done; the owner checklist is in [Owner Checklist for t17 (R-012)](evidence.md#owner-checklist-for-t17-r-012). The guide already documents the offline install, and its steps work in npm's offline mode. Owner decision 2026-11-27: the owner does this trial personally before `0.2.0`; it is not done yet, and t17 stays open until its results are recorded ([Owner Decisions of 2026-11-27](evidence.md#owner-decisions-of-2026-11-27-020-release)). Done 2026-11-27, owner-reported: a chat-app trial in the ChatGPT/Codex chat app and a restricted-network trial, both as expected, without the detailed captures of the checklist (the owner states that capturing the output and exit codes is not feasible); the results are in [Chat-App and Restricted-Network Trials (t17)](evidence.md#chat-app-and-restricted-network-trials-t17-2026-11-27) and in `R-012`. Owner decision 2026-11-27, later: "I think we can close it now"; `R-012` is closed on these owner-reported results, against the recommendation to keep it open ([`R-012`](../../prd/03-open-questions-and-risk-register.md#r-012-node-24-and-npx-reach-in-chat-app-and-enterprise-environments), Resolution). The checkbox stays unticked: Stage 4 does not pass (A72 is open until the public rollback proof).
- [ ] t18: Confirm the staged package's provenance and that its digest matches the committed digest. Performed 2026-11-26: the staged-only package no longer exists, so the record is the `stage` job of release run 45894295344 (digest, release-asset, and provenance checks; stage ID `8b8c8ef6-9e53-4973-928b-7826f1ddc85d`), and the published package was verified: attestation, `npm audit signatures`, and the registry tarball SHA-256 equal to the `reviewed` entry at the tag ([Provenance and Digest (t18)](evidence.md#provenance-and-digest-t18)). The result stands, pending stage acceptance (A71 to A73).

### Acceptance criteria

- A71: The smoke tests pass on three operating systems, and the captured output matches the P6 reviewed output except for version strings. Status 2026-11-26: the smoke tests pass on three operating systems; the output-match part is not met as written (5 differences that are not version strings, each from a later recorded owner decision, phase scope, or review fix); needs the owner's acceptance of these 5 ([comparison](evidence.md#comparison-with-the-p6-reviewed-output)). The smoke steps do not run printed fix commands; one of them is the defect F-P8-11, which is not a difference from the P6 reviewed output. Owner decision 2026-11-27: "Yes", the owner accepts the 5 differences (rows 2, 3, 6a, 8, and 9) ([Owner Decisions of 2026-11-27](evidence.md#owner-decisions-of-2026-11-27-020-release)).
- A72: The rollback test runs the pinned earlier version on a copied project. Status 2026-11-26: not met; see t16 (F-P8-09). Owner decision 2026-11-27: the public proof comes after the `0.2.0` publication (dated owner exception); A72 stays open until it. Status 2026-11-27, after the `0.2.0` publication: met on macOS (the pinned published `0.1.0` ran through `npx` on a copied project after the rollback from `0.2.0`); not run on Linux and Windows, which F-P8-09 asks for, so A72 stays open.
- A73: The evidence report records the chat-app and restricted-network results, and the guide documents the offline install. Status 2026-11-26: the guide part is met (chapter 04, "Install without access to the npm registry"); the chat-app and restricted-network results wait for t17. Owner decision 2026-11-27: the owner does the trial (t17) personally before `0.2.0`; not done yet. Status 2026-11-27, later: met by its words. The evidence report records the chat-app and restricted-network results (owner-reported, without the detailed captures; [Chat-App and Restricted-Network Trials (t17)](evidence.md#chat-app-and-restricted-network-trials-t17-2026-11-27)), and the guide documents the offline install. `R-012`, which these results serve, was closed by owner decision on 2026-11-27 ([`R-012`](../../prd/03-open-questions-and-risk-register.md#r-012-node-24-and-npx-reach-in-chat-app-and-enterprise-environments)).

### Dependencies

- Stage 3 complete (done, except t1, which needs the maintainer).
- The owner settings in `toolkits/buildos/SECURITY.md` (Owner Settings for Releases, steps 1 to 17), the archive rename, the new repository with one clean commit, and its public visibility, the placeholder publication and trusted publishing (`toolkits/buildos/AGENTS.md`, First Publication), and a staged `0.1.0` package from a real prepare and release run. None of these exists yet.
- Note (2026-11-26): The text above is from before the release. Now: t1 is done (owner-reported). The new repository `brucewaynedecoy/build-os` is public. The real prepare run 45892843313 and release run 45894295344 passed. The release run staged `0.1.0`, and the owner approved the stage, so `build-os@0.1.0` is published on npm and no staged-only `0.1.0` package exists. The Stage 4 checks did not run on the staged package. The owner settings (steps 1 to 17) and the archive rename were not rechecked for this note. See [First Publication of 0.1.0](evidence.md#first-publication-of-010-2026-11-26) and the release-order departure in the Closeout Notes.
- Note (2026-11-26, later): Owner decision 2026-11-26, option 1: the Stage 4 checks run on the published package `build-os@0.1.0`, whose bytes equal the staged and reviewed tarball. Results: [Post-Publication Checks of 0.1.0](evidence.md#post-publication-checks-of-010-2026-11-26).

## Stage 5 - Performance evidence and publication review

### Tasks

- [ ] t19: Render the `PERF-001` recheck packet from the P1 profile, with the new fingerprint. Performed 2026-11-24; profile v1.1 unchanged, workload unchanged ([Startup Recheck (PERF-001, P8)](evidence.md#startup-recheck-perf-001-p8)). The result stands, pending stage acceptance (A74 and A75).
- [ ] t20: Record the reason for the rerun: the build changed materially since P1. Performed 2026-11-24. The result stands, pending stage acceptance (A74 and A75).
- [ ] t21: Run the `PERF-001` recheck within its budget. Record the distribution, uncertainty, ledger, outcome, and decision in the evidence report. Performed 2026-11-24: one pass, outcome `pass`, BuildOS overhead about 40 ms (58% of a short command); the lazy-load question goes to the owner. The `PERF-001` result stands, pending stage acceptance (A74 and A75).
- [ ] t22: Write the `PERF-002` profile under a `## PERF-002 Profile` heading at the end of this file before any measurement. Use `make-docs://system/template/performance-evidence-profile.md`. Declare the staged package version, machine class, network, empty-cache rule, measurement boundary (`npx -y build-os@<staged version> version` from start to exit), repetitions, statistic, and raw-evidence location. Set no target. Render its packet into the evidence report. Performed 2026-11-26: the profile is under [PERF-002 Profile](#perf-002-profile) below, version 1, committed in `e2bbbc1` before any measurement, on the published `0.1.0` under the owner decision of 2026-11-26 (option 1); its packet is in [First-Run npx (PERF-002, P8)](evidence.md#first-run-npx-perf-002-p8). The result stands, pending stage acceptance (A74 and A75).
- [ ] t23: Run at most two `PERF-002` passes on the staged package and hold one review cycle. Record the outcome and decide whether the package size needs reduction. Performed 2026-11-26: one pass (the second could not change the decision), one review cycle, outcome `pass`; first run median 725.6 ms; the standalone tarball fetch, a reference measurement and not an upper bound on a size saving, took a median of 261.8 ms; decision: no package-size reduction needed now ([PERF-002 result](evidence.md#first-run-npx-perf-002-p8)). The result stands, pending stage acceptance (A74 and A75).
- [ ] t24: Prepare the publication review for the maintainer: tarball digest, provenance, SBOM, scan results, deny-list result, eval gate, smoke results, performance outcomes, `SECURITY.md`, and the closed `D-005`. Performed 2026-11-26 as a dated retrospective review: [Retrospective Publication Review (t24)](evidence.md#retrospective-publication-review-t24). The result stands, pending stage acceptance (A75).
- [ ] t25: **Needs the maintainer.** The maintainer decides on publication. Only after that approval does the maintainer approve the staged package with npm 2FA. No agent publishes. Open for the owner; the exact question is in [Question for t25](evidence.md#question-for-t25). A75's order stays missed for `0.1.0` whatever the answer. Still open on 2026-11-27: the owner asked to see the retrospective publication review first ([Retrospective Publication Review (t24)](evidence.md#retrospective-publication-review-t24)); no answer is recorded. Owner decision later on 2026-11-27: "Yes", the owner accepts the retrospective publication review of 2026-11-26 as the publication approval of `build-os@0.1.0`. By the text of [Question for t25](evidence.md#question-for-t25), this closes t25 by the explicit dated exception; A75's order stays recorded as missed for `0.1.0`. The checkbox stays unticked: a task is done only when its stage acceptance criteria pass, and Stage 5 does not pass (A75 is not met and cannot be met for `0.1.0`).

### Acceptance criteria

- A74: The evidence report shows both performance results within their budgets, each with a stated decision and no target. Status 2026-11-26: the text is met (`PERF-001` recheck of 2026-11-24 and `PERF-002` of 2026-11-26, each within budget, each with a decision, no target).
- A75: The publication review lists every item in t24, and publication happens only after a recorded maintainer approval. Status 2026-11-26: the review lists every t24 item (retrospectively); the order is missed for `0.1.0` and cannot be met; not met. Owner decision 2026-11-27 (t25): "Yes", the review is accepted as the publication approval of `0.1.0`, by the explicit dated exception; A75 stays not met, with its order recorded as missed for `0.1.0`.

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
- Release-order departure (2026-11-26): The owner published `0.1.0` and approved the npm stage before t15 to t18 (the Stage 4 checks on the staged package) and t22 to t24 (`PERF-002` and the publication review) were done. The orchestrator's step list put the approval first. This was an orchestration mistake, not an owner decision to skip the checks. A74 and A75 are not met, and t25 stays open. Owner decision 2026-11-26: option 1 ("run them now on the published package"): the outstanding checks run on the published `build-os@0.1.0`, whose bytes equal the staged and reviewed tarball, as a dated exception for `0.1.0` only; no criterion is re-worded, and A75's order stays missed ([Owner Decision 2026-11-26: Option 1](evidence.md#owner-decision-2026-11-26-option-1)). The risk record is [`R-003`](../../prd/03-open-questions-and-risk-register.md#r-003-build-os-packaging-upgrade-rollback-and-removal-hardening); the facts are in [First Publication of 0.1.0](evidence.md#first-publication-of-010-2026-11-26).
- Post-publication checks (2026-11-26, owner decision option 1): t15, t18, t22, t23, and t24 performed on the published package; t16 partly done; t17 and t25 need the owner. Review round 1 of pull request 5 found one defect in the published package (F-P8-11: a printed fix command with a bare `buildos`; owner decision open) and corrected the A71 count to 5 differences. No checkbox changed under the rule in [00-index.md](00-index.md). See [Post-Publication Checks of 0.1.0](evidence.md#post-publication-checks-of-010-2026-11-26) and its [acceptance status](evidence.md#acceptance-status-after-these-checks-a71-to-a75).
- Owner decisions of 2026-11-27 (0.2.0 release gate): A71 "Yes" (the 5 differences accepted); t17 and A73, the owner does the trial personally before `0.2.0` (not done yet); t16 and A72, "I accept that order" (the public rollback proof after the `0.2.0` publication, a dated owner exception). t25 is still open. No checkbox changed under the rule in [00-index.md](00-index.md): Stage 4 still has A72 and A73 open. See [Owner Decisions of 2026-11-27](evidence.md#owner-decisions-of-2026-11-27-020-release).
- Further owner answers of 2026-11-27: t25 "Yes" (the retrospective publication review accepted as the publication approval of `0.1.0`; t25 closed by the explicit dated exception; A75's order stays missed); t17 done, owner-reported, in the ChatGPT/Codex chat app and on a restricted network, without the detailed captures ([Chat-App and Restricted-Network Trials (t17)](evidence.md#chat-app-and-restricted-network-trials-t17-2026-11-27)); A73 met by its words. `R-012` stayed open on an owner question (one chat app, owner-reported); later on 2026-11-27 the owner closed it ("I think we can close it now"), against the recommendation to keep it open. No checkbox changed under the rule in [00-index.md](00-index.md): Stage 4 still has A72 open, and Stage 5 has A75 not met.
- After the `0.2.0` publication (2026-11-27): F-P8-09 passed on macOS only; t16 and A72 stay open for Linux and Windows. F-P8-10 and F-P8-11 are closed by the `0.2.0` registry smoke (run 46045192196, step 10 on three systems). The `PERF-002` profile of this file expired with the `0.2.0` package size; its new version comes before the `0.2.0` measurement, a separate task. No checkbox changed. See [Publication Record for 0.2.0](evidence.md#publication-record-for-020-2026-11-27).
- Phase / capability status: In progress. `build-os@0.1.0` was published on npm on 2026-11-26 with provenance, through the real prepare and release runs; see [First Publication of 0.1.0](evidence.md#first-publication-of-010-2026-11-26). Done: t1 to t14; A64 to A70 met for verification, and the real prepare and release runs passed. Performed, pending stage acceptance: t19 to t21; the `PERF-001` result stands. Performed on the published package under the owner decision of 2026-11-26 (option 1), pending stage acceptance: t15, t18, t22 to t24. Partly done: t16. Open for the owner: t17 and t25 (update 2026-11-27: t17 done, owner-reported; t25 closed by the owner's dated exception; neither checkbox ticked). Open: Stage 4 (t15 to t18) and Stage 5 t19 to t25, because a task is done only when its stage acceptance criteria pass (see the release-order departure above). The owner answered the questions listed in the closeout on 2026-11-25; see the Owner Decisions 2026-11-25 section below.

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

## PERF-002 Profile

This is `PERF-002` version 2, the one canonical `PERF-002` profile (it replaces version 1 in this section). Version 1 expired at the release that changed the package size (1,070,295 bytes and 173 files for `0.1.0`, 1,144,483 bytes and 168 files for `0.2.0`). The protected outcome and the workload are the same, so the ID stays `PERF-002`. Version 1 (digest `sha256:1637ae8a2d143b7e431ace19873c7982c41ffa108d28b6423af9a59495857990`) is kept in git history: `git show e2bbbc1:docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md` holds it, and the awk command of its execution packet gives that digest from it. Its packet, raw samples, fingerprint, and result are in [First-Run npx (PERF-002, P8)](./evidence.md#first-run-npx-perf-002-p8). Version 2 was written and committed before any `PERF-002` measurement of `0.2.0`, so the order is visible in git history. It measures the published `build-os@0.2.0`, whose registry tarball has the SHA-256 of the reviewed entry: the instrument can only measure a published package, and the orchestrator decided on 2026-11-27 on one pass after publication ([Orchestrator Decisions (2026-11-27)](./evidence.md#orchestrator-decisions-2026-11-27); runbook step k). The execution packet, the raw samples, and the result are in [First-Run npx for 0.2.0 (PERF-002, P9)](./evidence.md#first-run-npx-for-020-perf-002-p9).

### Performance Applicability

| Field | Value |
| --- | --- |
| Candidate ID | `PERF-002` |
| Title | First-run `npx -y` fetch and start of the published package |
| Testing Type | Performance Testing |
| Base Maintenance Action | `update-existing` |
| Protected Outcome | The first command in a new chat session completes without the user thinking it failed. |
| Decision Informed | Whether the package size needs reduction after the growth of `0.2.0`. |
| Failure Cost | Moderate. A long first run can look like a hang in a chat app, and the user may stop it; no data is lost, later runs use the npm cache, and a smaller package can ship in a later release. |
| Risk And Reversibility | Low blast radius and reversible: a size change touches the build and the package content only. A false pass could hide a first-run delay on slow networks; a false fail could cause needless size work. |
| Supported Scope | `npx -y build-os@0.2.0 version` with an empty npm cache on the one measured machine and network, at the time of the pass. |
| Product Maturity | Second public release, `0.2.0`, published on npm on 2026-11-27. |
| Source Authority | [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package); [plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan); [P9 Current Testing Decisions](09-skill-script-commands-0-2-0.md#current-testing-decisions); [Orchestrator Decisions (2026-11-27)](./evidence.md#orchestrator-decisions-2026-11-27) |
| Source Evidence | [`PERF-002` version 1 result](./evidence.md#first-run-npx-perf-002-p8) for `0.1.0`, context only (another version, date, and network) |
| Baseline Availability | No comparable baseline. The version 1 result has another fingerprint (package, date, network, instrument). |
| Applicability | `characterize-now` |
| Target Class | `characterization-baseline` |
| Owner | BuildOS maintainer |
| Lifecycle Coordinate | W1 R7 P9 Stage 3 (t13, runbook step k) |
| Gate Effect | Informational. It informs the package-size decision and blocks nothing. `0.2.0` is already published. |
| Reason | The first command an adopter's agent runs is `npx -y build-os@<version>`, so the fetch of the package is part of the first impression in every new chat session, and the package grew in `0.2.0`. |
| Next Record | None |

### PERF-002 First-Run npx Baseline

#### Identity And Authority

| Field | Value |
| --- | --- |
| Profile ID | `PERF-002` |
| Profile Version | `2` |
| Source Digest | SHA-256 of this `## PERF-002 Profile` section from its heading to the end of the Lineage And Traceability table, recorded in the execution packet in the evidence report before the pass |
| Title | First-run `npx -y` fetch and start of the published package |
| Protected Outcome | The first command in a new chat session completes without the user thinking it failed. |
| Source Requirements | [PRD 20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package) |
| Canonical Owner | docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md |
| Product Maturity | Second public release |
| Applicability | `characterize-now` |
| Target Class | `characterization-baseline` |
| Risk And Failure Cost | Moderate user impact, low severity, reversible. A false pass hides a slow first run; a false fail causes needless size work. |
| Owner | BuildOS maintainer |
| Approver | BuildOS owner |

#### Supported Scope

| Field | Value |
| --- | --- |
| Surface | `npx -y build-os@0.2.0 version`, as an agent or a user starts it in a folder with no BuildOS install |
| Platform Or Runtime | Node 24.22.3 with its bundled npm 11.19.1 (the release workflow's reference versions) |
| Deployment Or Device Class | One maintainer machine: Apple M2 Pro, 10 cores, 16 GiB, macOS 27.2.1 on arm64, AC power |
| Scale | One process per run; no project data |
| Account And Network State | No npm login. The machine's normal network connection at the time of the pass, not shaped or throttled, with the default registry `https://registry.npmjs.org/` and no proxy (the commands run outside the agent's network sandbox). The network is described, not controlled. |
| Resource Envelope | Local machine with normal desktop load |
| Exclusions | Linux and Windows; x64; other networks (a slow, metered, or restricted network is the `R-012` trial); a corporate registry mirror or proxy; commands other than `version`; `buildos init` |

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
| Product Build | The published `build-os@0.2.0`: registry tarball SHA-256 `baf54ebf0717a56bf1bb8ac0391adc7559b16375b90f59f4e4b79865a3f20da0`, equal to the `v0.2.0` `reviewed` entry in `toolkits/buildos/release-candidates.json`; source commit `6f395c1` |
| Dependency State | No runtime dependencies; npm 11.19.1 does the fetch |
| Configuration | `npm_config_cache` set to a new empty folder for each repetition; `npm_config_ignore_scripts=true`; npm update notice, fund, and audit messages off; no `BUILDOS_` variable; no `prefer-offline`, `offline`, or `prefer-online` setting; the folder of the Node.js that runs the instrument first on every child's `PATH` (F-P8-12) |
| Qualified Environment | The machine class and network under Supported Scope |
| Dataset Or Fixture | None; `version` reads no project files |
| Workload | Each repetition runs, in this order: (1) `cold`: `npx -y build-os@0.2.0 version` in a new empty folder with a new empty npm cache; (2) `warm`: the same command in another new empty folder with the cache that `cold` just filled; (3) `tarball`: a new Node process that fetches `https://registry.npmjs.org/build-os/-/build-os-0.2.0.tgz` into memory and checks its SHA-256. `cold` is the measured workload; `warm` and `tarball` are reference measurements. |
| Scale | One process per run |
| Concurrency | One process at a time |
| Operation Mix | `cold`, `warm`, `tarball` in each repetition, so network drift affects each one alike |
| Workload Exclusions | None |

#### Measurement Protocol

| Field | Value |
| --- | --- |
| Measurement Boundary | From the parent's `spawnSync` call to child exit: for `cold` and `warm`, npx start, registry metadata, tarball fetch (cold only), unpack, BuildOS start, `version` output, and exit; for `tarball`, Node start, DNS, TLS, the transfer, and the digest |
| Instrument And Version | `toolkits/buildos/scripts/measure-npx-first-run.ts` (with `scripts/node-first-path.ts`), run by Node 24.22.3; npx is started as `node <npm>/bin/npx-cli.js`, the file the `npx` command runs; its SHA-256 goes in the execution packet and the fingerprint |
| Cold Or Warm State | `cold`: empty npm cache and no install. The operating system's DNS cache and file cache are not cleared (clearing them needs root access). `warm`: the npm cache filled by the `cold` run of the same repetition. |
| Warmup Rule | None. Each `cold` run is cold by construction, and the first repetition is kept. |
| Repetitions Or Observation Window | 10 repetitions per pass |
| Statistic | Median wall-clock time of `cold`; the `warm` and `tarball` medians as references |
| Variance Reporting | Minimum, p25, p75, maximum, and interquartile range |
| Uncertainty Reporting | Distribution-free 95% confidence interval for the median from order statistics, computed by the instrument (with 10 runs it is the minimum to the maximum) |
| Outlier Treatment | No statistical trimming. A run is excluded only when it exits non-zero, its stdout lacks `version: 0.2.0`, or (for `tarball`) the digest differs; excluded runs are counted. |
| Comparison Method | Within-pass only. The `tarball` median and the `cold` median minus the `warm` median are reference measurements: each includes work that does not depend on package size (a Node start, DNS, TLS, hashing, registry metadata), and the size also changes work that `tarball` does not do (unpacking and writing the files). They do not split the cold time into a size-dependent part. The version 1 result for `0.1.0` is named as context only: its fingerprint differs, so it is not compared. |
| Raw Evidence Retention | Raw samples, rounded to 0.1 ms, and the instrument's summary in the evidence report, kept with the backlog. No path or user name is recorded. |
| Observer Effects | The parent's spawn cost is in every sample. The `tarball` reference opens its own connection, as npx does. Desktop load and network drift add noise; the order in each repetition spreads it. |

#### Non-Sacrificable Constraints

| Constraint | Required Condition And Evidence |
| --- | --- |
| Correctness | Every counted run exits 0 with `version: 0.2.0`, and every `tarball` digest equals the reviewed digest. |
| Durability | Not affected; the workloads write only to temporary folders, which the instrument removes. |
| Safety | Not affected; no project data is read or written. |
| Security | npm install scripts are off; the package declares none. Only the public registry is contacted. |
| Privacy | The raw record holds timings, the machine class, and the versions, with no paths or user names. |
| Accessibility | Not affected; output text is unchanged. |
| Portability | Any later size change keeps one ESM bundle that runs on Node 24 on macOS, Linux, and Windows. |
| Cost | No external spend. |
| Maintainability | Any later size change keeps the golden harness and the package tests passing. |
| Fixture And Measurement Seam | The instrument checks the exit code, the stdout, and the digest of each run before it counts the sample, and checks before it measures that the `node` on the children's `PATH` is the Node.js that runs it. |

#### Evidence Budget And Stop Rules

| Field | Value |
| --- | --- |
| Authorizing Plan Or Work Scope | [W1 R7 P9 Stage 3](09-skill-script-commands-0-2-0.md#stage-3---skills-docs-and-release) (t13) and runbook step k, under the orchestrator decision of 2026-11-27 (one pass after publication); version 1 names "the work phase of that release" as its requalification authority, and that phase is P9 |
| Budget Event ID | `PERF-002-P9-B1` |
| Characterization Pass Limit | 2 (one planned; the second only if the first is excluded or blocked) |
| Materially Distinct Correction Attempt Limit | 0 |
| Review Cycle Limit | 1 |
| Elapsed Investigation Time Limit | 2 hours |
| Compute Limit | 1 maintainer machine |
| External Resource Spend Limit | 0 USD |
| Unchanged Fingerprint Action | Reuse the prior pass. Do not rerun for a different outcome. |
| Material Change Action | Rerun only within the remaining budget, and only when the change can alter the decision |
| Diminishing Return Rule | Stop when a pass does not change the decision, or when the next pass costs more than the remaining budget |
| Budget Exhaustion Disposition | Record `blocked` or `revise` and route to the owner |

#### Outcome Rules

| Outcome | Exact Condition |
| --- | --- |
| `pass` | The pass recorded the distribution and uncertainty for `cold`, `warm`, and `tarball` under this protocol, with no more than 2 excluded runs per workload, and every non-sacrificable constraint held. A pass means the baseline exists; it sets no target. |
| `fail` | Not used for a characterization baseline: this profile has no target to miss. A broken constraint is recorded as a finding instead. |
| `revise` | The spread is so wide that the decision below cannot be made within the pass, or the protocol proves unfit for the decision. |
| `blocked` | Node 24.22.3, npm, the registry, or the instrument is unavailable, or the budget is exhausted. |
| `waived` | The owner accepts a missing baseline for a bounded scope and time. |

| Field | Value |
| --- | --- |
| Severity Treatment | `minor` unless a constraint breaks; a broken constraint is `major` |
| Reproducibility Treatment | `not-attempted` for a single pass; `reproduced` only when a second pass shows the same decision |
| Finding Route | This work file and the evidence report; a size change routes to the next release |
| Escalation Route | BuildOS owner |

The size decision is a judgement with its reasons, not a target. When the slowest `cold` run is under 2 seconds, the record says that the first run does not put the protected outcome at risk on the measured machine and network, and recommends no size reduction now. When it is 2 seconds or more, the record recommends to the owner that the package size be looked at for the next release. Either way the decision is the owner's; the record states it as a recommendation.

#### Expiry And Reevaluation

| Field | Value |
| --- | --- |
| Material Change Triggers | Another package version or tarball size; another npm or Node version; another machine class or network; a registry change; a change in the instrument or analysis |
| Time Or Release Boundary | Expires at the next release that changes the package size |
| Current-Use Invalidation Rule | Evidence with a different fingerprint is not current for the decision |
| Next Review Condition | A release whose tarball grows, or the `R-012` restricted-network trial |
| Requalification Authority | The work phase of that release |
| Requalification Budget | Set by that phase; this budget does not renew |
| Unchanged-Fingerprint Qualification Limit | One bounded execution |

#### Lineage And Traceability

| Field | Value |
| --- | --- |
| Predecessor | `PERF-002` version 1, this section at commit `e2bbbc1`, digest `sha256:1637ae8a2d143b7e431ace19873c7982c41ffa108d28b6423af9a59495857990` |
| Successor | None |
| Promotion Source | None |
| Promotion Approval | None |
| Supersession Reason | Version 1 expired at the `0.2.0` release, which changed the package size; version 2 also replaces version 1's comparison wording ("the part a smaller package could shorten") with "reference measurement", as the version 1 review asked |
| Plan And Work Links | [Plan performance table](../../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md#performance-evidence-plan); [P9 Current Testing Decisions](09-skill-script-commands-0-2-0.md#current-testing-decisions) |
| Result Links | [First-Run npx for 0.2.0 (PERF-002, P9)](./evidence.md#first-run-npx-for-020-perf-002-p9) |
| Finding Links | None |
| Obligation Links | None |
| History Links | None |
| Support Links | [`PERF-002` version 1 result](./evidence.md#first-run-npx-perf-002-p8), context only |

#### Evidence Fingerprint

Written before the pass, outside the digested part of this section (the digest covers the heading to the end of the Lineage And Traceability table, as the execution packet states).

- Profile ID, version, and digest: `PERF-002` version 2, the digest in the execution packet of [First-Run npx for 0.2.0 (PERF-002, P9)](./evidence.md#first-run-npx-for-020-perf-002-p9)
- Product build and relevant code state: the published `build-os@0.2.0`, registry tarball 1,144,483 bytes, SHA-256 `baf54ebf0717a56bf1bb8ac0391adc7559b16375b90f59f4e4b79865a3f20da0`, 168 files, unpacked size 4,615,040 bytes; source commit `6f395c1`
- Dependency and configuration state: no runtime dependencies; npm 11.19.1; a new empty npm cache per repetition, install scripts off, npm update notice off
- Qualified environment: Apple M2 Pro, 10 cores, 16 GiB, macOS 27.2.1 arm64, AC power; Node 24.22.3; the machine's normal network, no proxy, default registry
- Workload and fixture or dataset: `cold`, `warm`, and `tarball` as in the Environment And Workload table; no fixture
- Instrument version: `toolkits/buildos/scripts/measure-npx-first-run.ts` `sha256:881347c4c7e00aa0e15426065d2db05538d3b1047da054872494a28dc8eb4e05`, with `scripts/node-first-path.ts` `sha256:6010c8e4aba23e96e52936dcc8495995bb8da8200a93616d8cfb9cc718e36522`
- Analysis method: median, p25, p75, IQR, and the order-statistic 95% median interval computed by the instrument
- Comparability result and reasons: not comparable with the version 1 result (another package, instrument, date, and network); not comparable with `PERF-001` (no npm and no network there); within-pass comparison only

#### Result Record

Not measured yet when this profile was committed. The result is in [First-Run npx for 0.2.0 (PERF-002, P9)](./evidence.md#first-run-npx-for-020-perf-002-p9).
