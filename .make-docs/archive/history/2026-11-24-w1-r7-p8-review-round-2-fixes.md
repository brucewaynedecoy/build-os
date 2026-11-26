---
title: "W1 R7 P8 Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the release workflow and documentation findings of review round 2 and the two CI failures: trusted-only privileged jobs, a draft-then-publish release flow with a required reviewer before staging, a clean npm stage call, an environment-only deny-list secret, a strict tar reader, value-comparing SBOM checks, and a guide that matches Make Docs 2.0.9 and runs end to end."
---

# W1 R7 P8 Review Round 2 Fixes

## Changes

Fix round 2 for P8 after the independent review of `b3430d9` (release workflow findings P8-R2-01 to P8-R2-09, documentation findings P8-D-01 to P8-D-10) and the CI failures of runs 45510596967 and 45510597002. Built on `b3430d9` and not committed. Nothing was published, staged, tagged, or released, and no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-review-round-2).

| Area | Summary |
| --- | --- |
| Trust boundary (P8-R2-01) | Every privileged job runs release-control code from the default branch only and reads the ledger by commit and path from git; `.github/CODEOWNERS`; the stage job checks the environment's required reviewer and the run's approval through the API |
| Release flow (P8-R2-05) | Tag and draft release; a prepare run attaches the checked tarball and SBOM to the draft; the maintainer publishes it (immutable); the release run rebuilds and stages the release asset |
| npm call (P8-R2-02) | The tarball's `package.json` may hold no `publishConfig`, `tag`, `private`, lifecycle script, or dependency field; registry and dist-tag on the command line; clean npm environment |
| Deny list (P8-R2-03, -04, -06) | Pack step in `scripts/pack-for-scan.ts`; environment-only secret `BUILDOS_DENY_LIST_ENV`; strict tar reader; every duplicate member read and failed |
| Other fixes (P8-R2-07, -08, -09, notes) | Placeholder in a fresh folder with an exact-content check; ledger must be a mode `100644` blob; timestamp offsets checked; artifact names with the run attempt; discard bound to the run; uploads by release ID |
| Guide and documents (P8-D-01 to -10) | Windows output block; Make Docs 2.0.9 paths and design form; a runnable discovery example; truthful pin, write, JSON, and legacy-name statements; required checks by name; SBOM value checks; npm deprecate and unpublish facts; parity exceptions by behavior; PERF-001 wording |
| Open | Owner actions (visibility, environments, secret migration, rulesets, immutability, vulnerability reporting); GitHub runs of the new flow; owner questions on the PDF reader lazy load, wrapper order, project wrapper names, and the material change to the PRD 20 release flow |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Release steps, trust boundary, SBOM value check, deny-list secret and scanner; one requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `D-010` (`intake` has no `--json`), `Q-015` (wrapper order), `Q-016` (project wrappers with legacy names). |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | P8 CI Runs and Dry Runs on b3430d9; P8 Review Round 2; PERF-001 wording. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Overview, t4, t5, A64, A65, and closeout notes. |
| [README.md](../../../README.md) | Setup, pin, and legacy-name statements. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | Trusted release scripts, release steps, First Publication. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Rollback, Release Checks, Release Procedure, Trust Boundary, Gates, Owner Settings, deny-list check. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Windows output, npx cache, write promises, adoption, wrapper order, JSON scope, legacy names, rollback. |
| [guide/content/08-write-and-run-a-playbook.md](../../../guide/content/08-write-and-run-a-playbook.md) | `PB-005` targets and the run's refusal messages. |
| [guide/content/12-designs-plans-and-prds.md](../../../guide/content/12-designs-plans-and-prds.md) | Make Docs 2.0.9 paths, design and plan form, change rules, archive. |
| [guide/content/](../../../guide/content/) chapters 02, 03, 13, 16, 17, 19, 20, 21, and [guide/BuildOS-Guide.html](../../../guide/BuildOS-Guide.html) | Make Docs 2.0.9 paths, write promises; the guide rebuilt. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md), [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | Pin, writes, JSON scope, legacy names, parity exceptions, rollback. |
