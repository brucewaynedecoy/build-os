---
title: "W1 R7 P8 Pin-First Wrappers and Owner Decisions of 2026-11-25"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Built the owner decisions of 2026-11-25 for 0.1.0: the project wrappers run the pinned version first and use a buildos on PATH only when it reports exactly that version, the project scripts with the legacy names print the legacy-name notice and go away in 0.3.0, Q-015 and Q-016 are closed, and every document states pin-first."
---

# W1 R7 P8 Pin-First Wrappers and Owner Decisions of 2026-11-25

## Changes

Built the owner decisions of 2026-11-25 (option A for each) on `38d1e08`: the project wrappers are pin-first, so they always run the version pinned in `.os/manifest.json` and use a `buildos` on `PATH` only when its `buildos version --json` envelope reports exactly that version (one extra program start, only when one is there), else they run the pinned version through `npx`; the project scripts `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design` and their `.cmd` forms print the package's legacy-name notice once, first on stderr, and go away in `0.3.0` with the package legacy names (PE-016 extended); `Q-015` and `Q-016` are closed, and the confirmed release flow, `D-010`, the startup cost, and the git-history answers are recorded. Nothing was published, staged, tagged, pushed, or released, and no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [Owner Decisions 2026-11-25](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-2026-11-25).

| Area | Summary |
| --- | --- |
| Wrappers (`Q-015`) | `pinned-version.cjs` reads the pin first, then runs `buildos version --json` on the PATH candidate (no input, stderr not shown, 20-second limit, 64 KiB output limit) and uses it only for `ok` true, command `version`, and the exact pinned version; a `dev` pin runs only a program that reports `dev`; every earlier safety rule stays |
| Legacy project scripts (`Q-016`) | The sh and `.cmd` scripts write the PE-016 line to stderr, then run the `buildos` wrapper with the domain; stdout and the exit code are unchanged |
| Tests | `test/wrappers.test.ts`: pinned version runs, another version does not, six failed checks, dev pin both ways, notice once, guard, Windows cases for `!` folders; `test/init-review-4.test.ts` P6-R4-09 pins a version first |
| Register and PRDs | `Q-015` and `Q-016` closed; PRD 06 wrapper resolution states pin-first; PRD 20 Legacy Command Names states the rule for the project scripts; release flow confirmation in PRD 20 history; R-012 recommendation |
| Documents | Every "Current behavior, pending an owner decision" sentence and the rollback-by-pin text now state pin-first; PE-016 extended; evidence and phase file record all eight answers, F-P8-S2-01 and F-P8-S2-02 closed, F-P8-06 and F-P8-07 added |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing` for chapter 4; no new guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `Q-015` and `Q-016` closed (owner decision 2026-11-25); R-012 recommendation. |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | Wrapper resolution is pin-first; one requirement-history entry. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Legacy Command Names: the project scripts; one requirement-history entry; release flow confirmed. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Owner Decisions table rows; Owner Decisions 2026-11-25; Pin-First Wrappers; follow-ups and open lists. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Owner Decisions 2026-11-25; status line. |
| [README.md](../../../README.md) | Pin-first and the legacy project scripts. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Rollback by Version Pin states pin-first and the check cost. |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-016 covers the project scripts (owner decision 2026-11-25). |
| [docs/assets/maintainer/upgrade-existing-buildos-installation.md](../../../docs/assets/maintainer/upgrade-existing-buildos-installation.md) | Wrapper order and Go-era binaries. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Wrapper order, legacy project scripts, offline install, update and roll back; `guide/BuildOS-Guide.html` rebuilt. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md), [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | Pin-first statements; Go-era binary step. |
| [system/.os/scripts/AGENTS.md](../../../system/.os/scripts/AGENTS.md) | Pin-first order, legacy scripts, examples with `buildos <domain>`. |
| [docs/assets/user/upgrade-an-existing-buildos-project.md](../../../docs/assets/user/upgrade-an-existing-buildos-project.md), [docs/assets/user/build-os-getting-started.md](../../../docs/assets/user/build-os-getting-started.md), [docs/assets/user/convert-source-material-with-buildos-intake.md](../../../docs/assets/user/convert-source-material-with-buildos-intake.md) | Pin-first statements; legacy project scripts. |
