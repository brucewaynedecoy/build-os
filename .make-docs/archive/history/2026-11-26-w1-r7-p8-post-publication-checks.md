---
title: "W1 R7 P8 Post-Publication Checks of 0.1.0"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "release/0.1.0-post-publication-checks"
summary: "Ran the outstanding Stage 4 and Stage 5 checks on the published build-os 0.1.0 under the owner decision of 2026-11-26 (option 1), added a read-only smoke workflow and the PERF-002 profile, and recorded results, open items, and the t25 question."
---

# W1 R7 P8 Post-Publication Checks of 0.1.0

## Changes

Recorded the owner decision of 2026-11-26 (option 1: run the outstanding checks now on the published `build-os@0.1.0`, whose bytes equal the staged and reviewed tarball, as a dated exception for `0.1.0` only) and ran those checks. t15: the new reusable script `toolkits/buildos/scripts/published-smoke.ts` and the read-only workflow `.github/workflows/buildos-smoke.yml` (`contents: read`, no secret, no environment, pinned actions, install scripts off) smoke-tested `npx -y build-os@0.1.0` in clean folders with a clean npm cache; it passed on macOS here and on `macos-latest`, `ubuntu-latest`, and `windows-latest` with Node 24 (`buildos-smoke` runs 45901774926 and 45902212190), and the record lists ten differences from the P6 reviewed output, each traced to a later recorded decision, so A71's output-match part needs the owner. t16: no earlier runnable public version exists, so the wrapper's pin behaviour was shown on a copied project with a locally built, never-published candidate; t16 stays open, and the public proof waits for `0.2.0` (F-P8-09). t17: an exact owner checklist; the guide already documents the offline install, and its steps work in npm's offline mode. t18: the `stage` job of release run 45894295344 and the published package's attestation, registry signature, and tarball SHA-256 match the `reviewed` entry. t22 and t23: the `PERF-002` profile was committed (`e2bbbc1`) before its one pass; outcome `pass`, first-run median 725.6 ms, decision: no package-size reduction now. t24: a dated retrospective publication review. t25: the exact owner question, with A75's order recorded as missed for `0.1.0`. No checkbox changed under the backlog rule. `R-003` and `R-012` carry the new evidence and follow-ups. No shipped source, `package.json` version, ledger, or release workflow changed; no defect was found in the published package; F-P8-10 records the Windows doubled-backslash remediation command (Go parity).

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [Post-Publication Checks of 0.1.0](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#post-publication-checks-of-010-2026-11-26).

| Area | Summary |
| --- | --- |
| Smoke workflow and script | `.github/workflows/buildos-smoke.yml`, `toolkits/buildos/scripts/published-smoke.ts`; tests in `toolkits/buildos/test/release-workflow.test.ts`; the workflow added to `WORKFLOWS` in `toolkits/buildos/test/codeowners.test.ts` |
| Performance | `PERF-002` profile in the P8 phase file; instrument `toolkits/buildos/scripts/measure-npx-first-run.ts`; packet and result in the evidence |
| Records | P8 task notes, acceptance status, departure bullet, and status; `R-003` and `R-012` |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`. Guide coverage: `not-needed`; the guide was checked and needed no change.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section Post-Publication Checks of 0.1.0: owner decision, `PERF-002`, smoke tests and the P6 comparison, rollback, provenance and digest, offline install, t17 checklist, retrospective review, t25 question, acceptance status, follow-ups. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | `## PERF-002 Profile`; task notes for t15 to t18 and t22 to t25; A71 to A75 status; the departure bullet names the owner decision; status lines. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-003` and `R-012` follow-ups and dated evidence paragraphs. |

### Maintainer

None this session.

### User

None this session.
