---
title: "W1 R7 P9 Stage 3 Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/p9-stage-3"
summary: "Fixed review round 2 of pull request 7: safe, tested upgrade and rollback steps from 0.1.0 to 0.2.0 that refresh only the three changed skills and keep adopter work, a no-Python check that finds Windows casing, shell operators, and quoted installers, release wording that calls the three commands implemented, and a no-Python image job with a read-only checkout and a user that is not root."
---

# W1 R7 P9 Stage 3 Review Round 2 Fixes

## Changes

Fixed the three findings and the hardening note of review round 2 of pull request 7 on `rewrite/p9-stage-3`. The upgrade from `0.1.0` to `0.2.0` is written once, in the guide, chapter 4 ("From 0.1.0 to 0.2.0" and "Roll back from 0.2.0 to 0.1.0"), and the release-notes draft points to it: a backup first, then only the three skills that change (`buildos-bulk-extract`, `buildos-export-azure-boards`, `fit-gap-analysis`) and the skills router, by name, in the project and in each app copy, with a `git diff --no-index` against a clean `0.1.0` copy to find an adopter's change and keep it by hand; the rollback restores the pin and those skills from the backup, and a diff against the backup fails while a `0.2.0` skill is still in place. The steps were tested forward and back on a project made with the published `build-os@0.1.0`, with an adopter-added skill, an adopter change in a project skill, and one in an app copy, and every one was kept; F-P9-08 records `buildos update` for W2. `scripts/check-no-python.ts` finds Windows casing (`PYTHON.EXE`), a name before a shell operator or a redirection, and a quoted installer started as a program. The release notes call `extract`, `fitgap`, and `export` implemented in the unpublished `0.2.0` draft and the `capability-matrix` Python need a temporary exception. The `no-python-image` job mounts the checkout read-only, runs as the user `node`, and works in a copy. Chapter 14 gives the `0.1.0` script form of the export commands.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-stage-3-review-round-2-2026-11-26).

| Area | Summary |
| --- | --- |
| Upgrade and rollback (finding 1) | `guide/content/04-install-and-configure-your-instance.md` ("Update and roll back", "From 0.1.0 to 0.2.0", "Roll back from 0.2.0 to 0.1.0"); `toolkits/buildos/RELEASE_NOTES.md` (the pointer); `toolkits/buildos/SECURITY.md` ("Rollback by Version Pin"); the guide app |
| No-Python check (finding 2) | `toolkits/buildos/scripts/check-no-python.ts`; `test/check-no-python.test.ts` (two new tests) |
| Release wording (finding 3) | `toolkits/buildos/RELEASE_NOTES.md` (`0.2.0` "Not in this draft yet", `0.1.0` Known limits); the pull request body |
| Image job (hardening) | `.github/workflows/buildos-ci.yml` job `no-python-image`; `toolkits/buildos/scripts/no-python-image.sh`; `test/check-no-python.test.ts`; `SECURITY.md` CI Checks |
| Bot threads | Chapter 14 step 2 (the `0.1.0` script form); the other two threads are findings 1 and 2 |
| Records | The evidence report, the phase file status, the R-003 register entry (F-P9-08) |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapters 4 and 14.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section P9 Stage 3 Review Round 2: the findings, the skill changes between `0.1.0` and `0.2.0`, the upgrade and rollback test, the bot threads, and the checks. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | Stage 3 status points to round 2; no task ticked. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the tested hand steps and follow-up F-P9-08 for W2. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The image job's read-only mount, user, and copy; the skills in a rollback. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | The upgrade and rollback steps. |
| [guide/content/14-export-to-a-work-tracker.md](../../../guide/content/14-export-to-a-work-tracker.md) | The `0.1.0` script form of the export commands. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.2.0` draft: the upgrade pointer and the `capability-matrix` exception; the `0.1.0` sentence. |
