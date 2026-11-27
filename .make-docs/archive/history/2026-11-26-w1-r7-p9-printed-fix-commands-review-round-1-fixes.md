---
title: "W1 R7 P9 Printed Fix Commands Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "fix/f-p8-11-printed-commands"
summary: "Fixed the review round 1 findings of pull request 9: the Windows action line names Command Prompt, retry advice says to run the same command again, the smoke step runs only the exact expected command, the bin-links=false limit is stated with its fallback, and the extract and export help and the adoption note no longer name a bare buildos."
---

# W1 R7 P9 Printed Fix Commands Review Round 1 Fixes

## Changes

Fixed the five findings and two wording fixes of review round 1 of pull request 9 (F-P8-11 and F-P8-10, parity exception PE-023, owner decision of 2026-11-26). On Windows the human `action:` line of the printed `entities rebuild-index` command now names its shell with the words `buildos init` uses (`run this in Command Prompt: <command>`, plus `, with delayed expansion off` when the command holds a `!`), while the JSON fields keep the command alone; the shell contract (POSIX `sh` on Linux and macOS, Command Prompt with delayed expansion off on Windows) is in PRD 20 and `SECURITY.md`, and the user guide gives the PowerShell user a tested route (type `cmd`, paste, `exit`). PE-023 gets a `label` list with its one golden case (`entities-validate-missing-index-strict` on win32), stated on its own in the harness; no golden file changed. The "run … again" advice of `init`, `validate`, and `extract bulk` now says to run the same command again, so it never drops the adopter's root or Make Docs choice; the help command of `export azure-boards` stays printed because it needs no root. Step 10 of `scripts/published-smoke.ts` compares the whole printed command with the exact expected one and runs nothing on a mismatch. The `bin-links=false` limit of the `npx` form (exit 127, and a cached copy that keeps failing until `npm cache npx rm <key>`) was reproduced and is stated with the project wrapper as the fallback. The `extract` and `export` help screens direct to the runnable help command, and the adoption note names the project wrapper alone. The evidence no longer says that an exact version stamp proves the same build, and PRD 20 says which printed folders are always quoted.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-1-pull-request-9).

| Area | Summary |
| --- | --- |
| Shell label | `toolkits/buildos/src/core/shared/run-command.ts` (`shellLabel`, `labelledCommand`), `src/cli/diagnostics.ts`, `src/cli/commands/entities.ts` |
| Retry advice | `src/core/init/` (`init.ts`, `plan.ts`, `shared-files.ts`, `apply.ts`), `src/cli/commands/init.ts`, `src/cli/commands/validate.ts`, `src/core/validate/validate.ts`, `src/core/extract/bulk.ts` |
| Help directions and note | `src/cli/commands/extract.ts`, `src/cli/commands/export.ts`, `src/cli/domain.ts`, `src/cli/run.ts`, `src/core/init/plan.ts` |
| Parity exception | `test/golden/parity-exceptions.json` (PE-023 `label`), `test/golden/harness.ts`, `test/golden/compare.test.ts`, `test/golden/printed-command.test.ts`, `test/golden/CAPTURE.md` |
| Tests | `test/run-command.test.ts` (with the Windows shell runs), `test/post-publication-scripts.test.ts`, `test/skill-script-review-3.test.ts`, and the init and validate tests for the new wording |
| Smoke | `scripts/published-smoke.ts` step 10 |
| Records | PRD 20, the risk register (R-003), the evidence report, the user guide, guide chapters 4 and 18, the guide app, `RELEASE_NOTES.md`, `SECURITY.md` |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; the entity consolidation user guide and guide chapters 4 and 18.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Review Round 1 (Pull Request 9): each finding, its fix and proof, the Windows output, the golden case under PE-023, and the shell-field proposal; the class table and the "same build" wording corrected. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Output and Exit Contract: the shell contract, the label, the rerun wording, the `bin-links=false` limit, and the quoting scope; Requirement History entry updated. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the review round 1 changes. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The shell contract of a printed command, PowerShell, the tested Windows routes, and the `bin-links=false` limit. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | The Windows label rule of PE-023. |

### User

| Path | Description |
| --- | --- |
| [docs/assets/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | Run a Printed Command: the shell per system, the PowerShell route, and the limits. |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | The `validate` output examples. |
| [guide/content/18-what-is-not-built-yet.md](../../../guide/content/18-what-is-not-built-yet.md) | The shell of the printed rebuild command. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.2.0` draft: the shell, the limit, and the rerun wording. |
