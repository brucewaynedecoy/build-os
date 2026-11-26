---
title: "W1 R7 P8 Pin-First Wrappers Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 13 accepted review findings on the pin-first wrappers of f6adf5f: the wrappers no longer start a program to learn its version and run only an npm install of exactly the pinned version or npx, the npx fallback no longer runs a buildos from PATH for a local install without bin links, Windows PATH quotes and documented Command Prompt limits, rollback is the manifest edit alone in every document, the release checklist uses the archive rename and a new repository with one clean commit, and the shipped routers name buildos domains."
---

# W1 R7 P8 Pin-First Wrappers Review Round 1 Fixes

## Changes

Fixed the 13 accepted findings of the review of `f6adf5f` (the pin-first project wrappers), with the orchestrator's design change of 2026-11-25: the wrappers never start a program to learn its version; `pinned-version.cjs` reads `package.json` files only and accepts a local npm install (the project folder, then npm's local project folder) or the first `buildos` on `PATH` only when it is an npm install of exactly the pinned version, then runs that package's bin file with the same Node.js and working folder, else the pinned version through `npx` with npm bin links on; a `dev` pin runs only an installed source build (`0.0.0-dev`) and its message names working steps. Windows `PATH` keeps a `;` inside quotes, relative `sh` `PATH` entries get a leading `./`, every document states that rollback is the manifest edit alone, the release checklist follows the owner's archive-rename and one-clean-commit method with F-P8-02 as one sentence, answers 7 and 8 are recorded with substance, and the shipped routers and the manual intake playbook name `.os/scripts/buildos intake` and `discovery`. Nothing was pushed, published, staged, tagged, or released, and no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [Pin-First Wrappers Review Round 1](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#pin-first-wrappers-review-round-1).

| Area | Summary |
| --- | --- |
| Wrappers (findings 1 to 6, 12) | No probe process; npm-install check from `package.json` (name, exact version, bin file inside the package, regular files, 256 KiB limit, strict JSON); local install first; POSIX real-path rule; Windows shim-folder rule; `node <bin file>` dispatch; `npm_config_bin_links=true` for `npx`; quoted Windows `PATH`; `./` for relative `sh` entries; `dev` rule and message |
| Tests (findings 1, 4 to 8, 12) | `test/wrappers.test.ts` rewritten around fixture npm packages, with start records for every program that must not run; `test/package.test.ts` two real-npm offline cases; `test/init-review-4.test.ts` signal case through `npx`; `test/release-workflow.test.ts` new checklist steps |
| Documents (findings 9 to 11) | Rollback by the manifest edit alone everywhere; legacy project scripts print the notice; owner checklist of 13 steps with the archive rename and the new repository; F-P8-02 sentence in CAPTURE.md, AGENTS.md, SECURITY.md, and the phase file; residual `npx` risk and the Command Prompt quote limit in SECURITY.md |
| Shipped files (finding 13) | Routers under `system/`, the manual intake playbook, and the intake translation contract name `buildos <domain>` |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing` for chapter 4; `guide/BuildOS-Guide.html` rebuilt; no new guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `Q-015` decision and resolution note, R-003 issue and git-history paragraph, R-012 recommendation, frozen baseline note. `D-010` unchanged. |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | Wrapper resolution without a probe; requirement-history entry. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | `dev` pin branches; requirement-history entry. |
| [docs/prd/04-glossary.md](../../../docs/prd/04-glossary.md) | Wrapper resolution term. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Decision rows, answers 7 and 8, `D-010` location, F-P8-02, Pin-First Wrappers Review Round 1. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Entry gate git-history method, dependencies, owner decisions 2, 6, 7, 8. |
| [docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md](../../../docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md) | Note that the order is now pin first. |
| [README.md](../../../README.md) | Wrapper order. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Rollback, project wrappers, residual `npx` risk, owner checklist steps 1 to 13, Known Limits. |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | Frozen baseline sentence; First Publication prerequisites. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Frozen baseline sentence. |
| [docs/assets/maintainer/upgrade-existing-buildos-installation.md](../../../docs/assets/maintainer/upgrade-existing-buildos-installation.md), [docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md](../../../docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md) | Wrapper order, rollback. |

### User

| Path | Description |
| --- | --- |
| [system/.os/scripts/AGENTS.md](../../../system/.os/scripts/AGENTS.md) | Order, install rule, `dev` pin, Command Prompt limit. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md), [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | Wrapper order, rollback, legacy project scripts, Windows quote limit. |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Wrapper order and rollback; `guide/BuildOS-Guide.html` rebuilt. |
| [docs/assets/user/upgrade-an-existing-buildos-project.md](../../../docs/assets/user/upgrade-an-existing-buildos-project.md), [docs/assets/user/build-os-getting-started.md](../../../docs/assets/user/build-os-getting-started.md), [docs/assets/user/convert-source-material-with-buildos-intake.md](../../../docs/assets/user/convert-source-material-with-buildos-intake.md), [docs/assets/user/record-discovery-runs-and-qualify-findings.md](../../../docs/assets/user/record-discovery-runs-and-qualify-findings.md) | Wrapper order and rollback. |
| `system/.os/AGENTS.md`, `system/.os/indexes/AGENTS.md`, `system/assets/AGENTS.md`, `system/workspace/AGENTS.md`, `system/workspace/findings/AGENTS.md`, `system/workspace/runs/AGENTS.md`, `system/playbooks/administrative/manual-intake-conversion.md`, `system/.os/contracts/intake-translation-contract.md`, `system/.os/skills/buildos-preflight/SKILL.md` | `buildos <domain>` through the project wrapper. |
