---
title: "W1 R7 P8 Pin-First Wrappers Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the 15 accepted review findings on the pin-first wrappers of 9913d62 with a version self-check: every wrapper start sets BUILDOS_REQUIRE_VERSION, and the BuildOS program stops itself with exit 3 when its own build identity is another version; node and npx start by path (ubuntu dash failure), the PATH search runs after the local lookup with a bounded read, the version numbers are bounded to npm's safe range, the repository cutover steps protect the reused name, and the docs follow."
---

# W1 R7 P8 Pin-First Wrappers Review Round 2 Fixes

## Changes

Fixed the 15 accepted findings of the review of `9913d62` (the pin-first project wrappers after round 1), with the orchestrator's decision of 2026-11-25 that the program that runs checks itself: every project wrapper start (a local install, a `buildos` on `PATH`, or `npx`) sets `BUILDOS_REQUIRE_VERSION` to the pin, and the BuildOS program (`src/cli/required-version.ts`, first in `src/cli/main.ts`, before any command code, output, or file access, also for the legacy-name entries) stops with nothing on stdout, one plain message that names both versions and the two fixes, and exit code 3 (the JSON failure envelope with `version_mismatch` under `--json`) when its own build identity is another version, then removes the variable and puts back the caller's npm bin-links settings before it starts any other program; the wrapper's `package.json` read only chooses a candidate (any version for a `dev` pin, no bin under a nested `node_modules`, a readable bin, a `node_modules` folder and not a file), the `sh` wrapper starts `node` and `npx` by path so dash no longer reads a `-` folder as options, the `PATH` search runs in the helper after the local lookup with at most 1,024 bytes read, both manifest readers bound the version numbers to 9007199254740991, a Windows `npx` line over 8,191 characters stops with exit 2, the real-npm tests use a fixture version and pass with a temporary `0.1.0` bump, the release checklist retargets old clones and adds a `cutover` ruleset before the new repository exists, and the threat model and user docs follow. Nothing was pushed, published, staged, tagged, or released, and no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and [Pin-First Wrappers Review Round 2](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#pin-first-wrappers-review-round-2).

| Area | Summary |
| --- | --- |
| CLI (findings 2, 3, 5, 12) | `src/cli/required-version.ts` (new): read, check, and remove `BUILDOS_REQUIRE_VERSION`; restore the caller's npm bin-links settings; refusal text and JSON envelope. `src/cli/main.ts` checks first and loads the command modules after the check. |
| Wrappers (findings 1, 3, 7, 9 to 12) | `system/.os/scripts/buildos`: `node` and `npx` by path, the variable on every start, the saved bin-links settings, four-line helper result. `pinned-version.cjs`: POSIX `PATH` search after the local lookup with a bounded head read, any version for a `dev` pin, nested `node_modules` and read-access checks, type checks for npm's local project folder, program and npx environments, the Windows long-line check. `buildos.cmd`: comment only. |
| Manifest contract (finding 6) | `src/core/init/manifest.ts` and `pinned-version.cjs` bound `MAJOR`, `MINOR`, and `PATCH`; six new fixture rows. |
| Tests (all findings) | `test/required-version.test.ts` (new); `test/wrappers.test.ts` (dash, self-check end to end, bounded read, environment, current-folder and executable fixes); `test/package.test.ts` (fixture version, real-npm `+local` and release-bump cases, host-independent global case); `test/manifest-contract.test.ts` (npm's `semver` cross-check); `test/release.test.ts` (new helper usage). |
| Documents (findings 8, 15) | Threat model in `SECURITY.md` and PRD 06; PRD 20 exit-code rule and number bound; owner checklist with the clone retarget and `cutover` ruleset (14 steps); user guides use `.os/scripts/buildos <domain>`; acceptance by layout; PRD 03 marks the first design historical. |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing` for chapter 4; `guide/BuildOS-Guide.html` rebuilt; no new guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/06-operating-layer-and-routing.md](../../../docs/prd/06-operating-layer-and-routing.md) | Wrapper resolution with the self-check and the threat model; requirement-history entry. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Self-check rule and exit code 3 in the Output and Exit Contract; number bound and `dev` pin in the manifest contract; requirement-history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `Q-015`: the first design marked historical; round 2 note. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Pin-First Wrappers Review Round 2: design, findings table, checks, limits. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | Entry Gate: repository cutover prerequisite; step numbers. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Rollback, project wrappers, the self-check, bin links, threat model, owner checklist steps 1 to 14, Windows line limit. |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | First Publication prerequisites with the new step numbers. |
| [docs/assets/maintainer/operating-layer-contracts-maintenance.md](../../../docs/assets/maintainer/operating-layer-contracts-maintenance.md) | Discovery commands through `.os/scripts/buildos discovery`. |

### User

| Path | Description |
| --- | --- |
| [system/.os/scripts/AGENTS.md](../../../system/.os/scripts/AGENTS.md) | Order, install rule, the self-check, `dev` pin, Command Prompt limit. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md), [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | Acceptance by layout; the self-check. |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Acceptance by layout; the self-check; `guide/BuildOS-Guide.html` rebuilt. |
| [docs/assets/user/upgrade-an-existing-buildos-project.md](../../../docs/assets/user/upgrade-an-existing-buildos-project.md) | Go-era program note without the old probe. |
| [docs/assets/user/convert-source-material-with-buildos-intake.md](../../../docs/assets/user/convert-source-material-with-buildos-intake.md), [docs/assets/user/record-discovery-runs-and-qualify-findings.md](../../../docs/assets/user/record-discovery-runs-and-qualify-findings.md), [docs/assets/user/understand-workspace-artifacts.md](../../../docs/assets/user/understand-workspace-artifacts.md), [docs/assets/user/use-playbooks-and-active-indexes.md](../../../docs/assets/user/use-playbooks-and-active-indexes.md), [docs/assets/user/validate-system-data-and-indexes.md](../../../docs/assets/user/validate-system-data-and-indexes.md) | Commands through `.os/scripts/buildos <domain>`. |
