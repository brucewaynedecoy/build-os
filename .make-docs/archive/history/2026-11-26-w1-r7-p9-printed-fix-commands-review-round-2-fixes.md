---
title: "W1 R7 P9 Printed Fix Commands Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "fix/f-p8-11-printed-commands"
summary: "Fixed the review round 2 findings of pull request 9: the adoption note names the project folder, every init retry advice after Make Docs ran carries --skip-make-docs from one source, every shown Windows command with a folder carries the command-aware label and the PowerShell route opens cmd /v:off, smoke step 10 runs only when both outputs match and then needs a current index, and the bin-links=false limit is stated as tested."
---

# W1 R7 P9 Printed Fix Commands Review Round 2 Fixes

## Changes

Fixed the five findings of review round 2 of pull request 9 (F-P8-11 and F-P8-10, parity exception PE-023, owner decision of 2026-11-26). The adoption note about the old Python validator now names the project folder that the wrapper must run in (`in the project folder <root>, run .os/scripts/buildos validate instead`), so `init --root <other>` from another folder no longer sends the adopter to validate the wrong project. After Make Docs ran, every retry advice of `init` (the result `tip`, each problem `fix`, each diagnostic `correction`, human and JSON) comes from one source (`sameInit`, `retryAdvice`) and says to run the same init command again with `--skip-make-docs` and without `--make-docs`. Every shown Windows command with a folder in it (the `init` choices, the Make Docs later and retry lines, and the Make Docs setup step of `design promote`) gets the command-aware label (`runWords`), so a `!` adds `, with delayed expansion off`; the user guide's PowerShell route opens `cmd /v:off`, the smoke step runs the command with `cmd /d /v:off /s /c`, and the Windows CI test runs both forms for folder names with `!`. Step 10 of the published-package smoke test moved to `scripts/printed-fix-step.ts`: it runs the printed command only when both the JSON field and the human `action:` line are exact, and afterwards requires `result.index.current` true and no index diagnostic, with stubbed tests for both. The `bin-links=false` limit now says what was tested: the failure belongs to an `npx` copy cached without its `bin` link (exit 127 in `sh` on macOS), and the fallback is to remove that copy or use the project wrapper with no such copy cached. The bot thread on the Windows label of the entities CLI test is fixed. No golden file and no parity exception changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-2-pull-request-9).

| Area | Summary |
| --- | --- |
| Adoption note | `toolkits/buildos/src/core/init/plan.ts` (`legacyValidatorNote`), `src/core/init/init.ts` (the plan gets the root) |
| Retry advice | `src/core/init/init.ts` (`makeDocsRan`, `sameInit`, `retryAdvice`), `src/cli/commands/init.ts` |
| Windows label | `src/core/shared/run-command.ts` (`runWords`), `src/cli/commands/init.ts`, `src/core/design/promote.ts` |
| Smoke | `scripts/printed-fix-step.ts` (new), `scripts/published-smoke.ts`, `.github/workflows/buildos-smoke.yml` (path filter) |
| Tests | `test/printed-commands-review-2.test.ts` (new), `test/post-publication-scripts.test.ts`, `test/run-command.test.ts`, `test/entities-cli.test.ts`, and the init tests for the new wording |
| Records | PRD 20, the risk register (R-003 entry), the evidence report, the user guide, `RELEASE_NOTES.md`, `SECURITY.md` |

CI: every job of commit `70ab339` passed on three systems (`buildos-ci` run 45941006127, `buildos-smoke` run 45941006338), with the labelled command run on Windows in Command Prompt, with `/v:off`, and through `cmd /v:off` from PowerShell for folder names with `!`.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; the entity consolidation user guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Review Round 2 (Pull Request 9): each finding, its fix and proof, the bot threads, and the approved-output statement. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Output and Exit Contract: the `bin-links=false` limit as tested, the retry advice after Make Docs ran, the adoption note, and the command-aware label; Requirement History entry updated. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | The printed-commands entry: the review round 2 changes. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The PowerShell route with `cmd /v:off`, the label in every shown Windows command, and the `bin-links=false` limit as tested. |

### User

| Path | Description |
| --- | --- |
| [docs/assets/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | Run a Printed Command: `cmd /v:off`, and the `bin-links=false` limit as tested. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.2.0` draft: `cmd /v:off`, the limit, the retry advice, and the note. |
