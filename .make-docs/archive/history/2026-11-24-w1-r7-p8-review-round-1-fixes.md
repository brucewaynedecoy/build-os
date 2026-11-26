---
title: "W1 R7 P8 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed every finding of the independent review of the P8 release workflow and Go removal: one resolved release commit, a trust boundary for the deny list and staging jobs, CycloneDX schema validation, reviewed and self ledger entries, a dry run that reads identity first, release-stamped golden comparison, and shared just dependencies."
---

# W1 R7 P8 Review Round 1 Fixes

## Changes

Fix round 1 for P8 Stage 1 (release workflow) and Stage 3 (Go removal) after the independent review of `548f4ea`, built on `57254f2` and not committed. Nothing was published, staged, tagged, or released, and no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-review-round-1).

| Area | Summary |
| --- | --- |
| One release commit (P8-R1-01) | A `resolve` job validates every event value and resolves one SHA (event commit equals the tag's commit, on the default branch) before repository code runs; every job checks out that SHA |
| Trust boundary (P8-R1-01, -02, -04) | The real deny list lives in the environment `buildos-deny-list` and reaches only default-branch and release jobs that run the scanner with Node built-ins; the stage job runs `scripts/release-stage-check.ts` (Node built-ins) and `npm stage publish` from an empty folder; the scanner no longer needs `fflate` |
| Ledger (P8-R1-03, -06) | Schema version 2 with `kind` `reviewed` or `self`; the committed ledger and releases take `reviewed` only; `compute` takes the inspected tarball |
| Artifacts and output (P8-R1-07) | Upload only after every gate passed, for 1 or 3 days; a `discard` job deletes it after a deny-list failure; redacted locations kept in the log and job summary |
| Dry run (P8-R1-08) | Arguments checked first; identity before any build; build B checked against an entry from build A; a candidates-only commit verifies; `tests` and `installed` gates |
| Release-stamped goldens | The harness expects the release identity in four exact places; 167 of 167 from the release-stamped tarball; no golden changed |
| SBOM (P8-R1-05) | SPDX expressions on the license-choice item; validated against the vendored CycloneDX 1.5 schema with a small validator |
| Recipes (P8-R1-09) | One guarded `buildos-deps` step for every BuildOS recipe |
| Gates (P8-R1-10, -11) | Eval needs the whole corpus to run; audit uses the high threshold and checks the exit status; maintainer steps name the artifact by run ID; register item `D-009` names the TypeScript domains |
| Owner decisions | First publication and repository: option A ("A, A"); the reserved-name placeholder script and the First Publication steps; the SHA mapping task after the history rewrite |
| Open | Owner actions (rulesets, immutable releases, environments, visibility, vulnerability reporting, npm steps); GitHub dry runs; two open owner questions (PDF reader lazy load, global `buildos` and the pin) |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Release steps, first publication, trust boundary, SBOM schema check, deny-list check in CI; one requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `D-009` names the TypeScript domains; an `R-003` note with the owner decisions. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Two owner decisions; P8 CI Runs 45498097577 and 45498097675; P8 Review Round 1. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Entry gate, t1, t4, t5, A64 to A66, and closeout notes. |
| [USE_CASES_TESTING.md](../../../USE_CASES_TESTING.md) | Preflight dependency note; cleanup removes all four commands. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | Release steps and First Publication. |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Release Trust Boundary, Release Gates, Owner Settings for Releases, Maintainer Checklist; the deny-list check's environment and tarball input. |

### User

| Path | Description |
| --- | --- |
| None | No user-facing text changed. |
