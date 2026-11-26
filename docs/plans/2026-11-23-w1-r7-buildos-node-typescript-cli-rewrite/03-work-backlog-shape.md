# 03 Work Backlog Shape

## Purpose

Fix the phase structure, gates, and PRD citations for the W1 R7 work backlog at `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`. The backlog is generated after the PRD maintenance, and each phase cites the updated PRDs, not this plan.

## Phases

| Phase | Outcome | Cites | Entry gate | Exit gate |
| --- | --- | --- | --- | --- |
| P1 TypeScript package foundation | `toolkits/buildos/` builds with `tsc` and esbuild, tests run with Node's built-in test runner (`node:test`), CI runs on macOS, Linux, and Windows with Node 24. Core/CLI split, root resolution, envelope, exit codes, help, and version exist. Supply-chain checks (`--ignore-scripts`, audit, OSV) run in CI. `LICENSE` (Apache-2.0) and the first security document exist. `PERF-001` baseline recorded. | 20, 02 | PRD maintenance validated and the legacy-PRD cleanup gate below | CI green on 3 OSes; envelope and exit codes covered by tests |
| P2 Golden capture | Golden outputs for all four Go tools and legacy names on a fixed fixture set: files, stdout, stderr, JSON, exit codes. A comparison harness runs in CI. | 20, 07, 17 | P1 | Goldens committed; harness fails on a planted difference |
| P3 Entities port | `buildos entities` matches its goldens | 17, 20 | P2 | Golden parity for every entities case |
| P4 Intake port | Converter comparison (two candidates per format) chosen and recorded; conversion eval set with reviewed reference text; `buildos intake` matches goldens (PDF after normalization) | 07, 20 | P2 | Parity plus eval gate: no lost section, 98% similarity |
| P5 Discovery and design port | `buildos discovery` and `buildos design promote` match goldens | 10, 11, 20 | P2 | Golden parity; `R-009` still tracked |
| P6 Names, wrappers, and initialization | npm `bin` aliases; `sh` and `.cmd` wrappers; `buildos init` with adoption, `--dry-run`, `.os/manifest.json`; Make Docs companion setup with prompt, flags, no-TTY stop, and non-fatal failure; Make Docs CI contract test | 20, 05, 06, 11 | P3–P5 | Functional tests on 3 OSes; adoption byte check; Human Experience Review of `init` output |
| P7 Skills and validation | Skills imported into `system/.os/skills/` with newest-copy review; client content removed; router at `.os/skills/AGENTS.md`; `buildos validate` replaces the Python validator; `system/docs/` and `system/.make-docs/` deleted | 20, 06, 13 | P6 | Deny-list check passes; `buildos validate` matches the Python results on fixtures |
| P8 Release `0.1.0` | Release workflow (trusted publishing, tarball digest, staged provenance, maintainer 2FA), SBOM, scans, deny-list check, final security document, user guide and README updates, `PERF-001` recheck and `PERF-002`, Go modules and Python removed | 20, 01, 05, 07, 13 | P7 (the cleanup gate is already met at P1) | Staged package installs and runs on 3 OSes; publication only with separate maintainer approval |
| P9 Skill-script commands `0.2.0` | `buildos extract bulk`, `buildos fitgap` (xlsx through `fflate`), `buildos export azure-boards`; skills call the CLI | 20, 06, 08 | P8 | Parity with the scripts on fixtures; no Python left in skills |

## Cross-Phase Rules

- Ports follow golden capture. No intended behavior change during a port; a needed change is recorded as an explicit parity exception with a reason and an owner decision.
- Go code for a domain is deleted only after its parity gate passes, and all Go removal finishes in P8.
- Every new outside package passes the PRD 20 rules before it lands, and the security document is updated in the same phase.
- Nothing is published, and no installed binary or live adopter project is changed, without separate maintainer approval.

## Legacy-PRD Cleanup Gate

P1 must not start until the legacy-PRD cleanup in [05](./05-legacy-prd-cleanup-handoff.md) is complete and `D-005` is closed. The cleanup runs as W1 R8 ([plan](../2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md)). Every later phase follows P1, so no W1 R7 phase runs during the cleanup. The Make Docs PRD router requires `make-docs run prd authority validate` to exit zero before downstream work uses the PRD set.

## Human Experience Traceability

Each backlog phase that implements a promise from the [plan overview](./00-overview.md#human-experience-propagation) carries that promise into its acceptance criteria as an observable check, not as "UX is good."
