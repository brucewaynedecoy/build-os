---
title: "W1 R7 P9 Printed Fix Commands Review Round 3 Fix Pass"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "fix/f-p8-11-printed-commands"
summary: "The final fix pass after review round 3 of pull request 9: design promote names the file to delete under --repo-root, the adoption note's command is for after adoption completes, a Make Docs launch failure keeps the adopter's own init command, and after the cache removal the next fetch must have bin links on."
---

# W1 R7 P9 Printed Fix Commands Review Round 3 Fix Pass

## Changes

Fixed the four findings of review round 3 of pull request 9 in the final fix pass under the project stop rule; no further review round follows (F-P8-11 and F-P8-10, parity exception PE-023, owner decision of 2026-11-26). With `--repo-root` for another folder, the "empty" stop of `design promote` now names the file to delete by its path under the resolved root, so a reader in another project no longer deletes that project's file. The adoption note about the old Python validator now says `After adoption completes, in the project folder <root>, run .os/scripts/buildos validate instead`, which is true for a dry run, where the wrapper is only planned, and for the applied run. The `init` retry words now tell three states apart: Make Docs not requested, Make Docs requested and a process started (the retry adds `--skip-make-docs` and drops `--make-docs`, because Make Docs already ran), and Make Docs requested with no process started (the retry keeps the adopter's own command and says nothing about Make Docs having run); the process port reports `started: false` when nothing started, and a failed `make_docs` result has the new `started` field. The late write-permission correction now carries the flag change once. After a bad `npx` cache copy is removed, the written advice now says that the next fetch must have bin links on (`npm_config_bin_links=true` for that one command, or the project wrapper), as run in `sh` on macOS with npm 11.20.0. No golden file and no parity exception changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#review-round-3-and-the-final-fix-pass-pull-request-9-2026-11-26).

| Area | Summary |
| --- | --- |
| Design promotion | `toolkits/buildos/src/core/design/promote.ts` (`Promotion.rootIsCurrentFolder`, `makeDocsInputStop`) |
| Adoption note | `src/core/init/plan.ts` (`legacyValidatorNote`) |
| Retry states | `src/core/shared/process-port.ts` (`started`), `src/adapters/node-process.ts`, `src/core/init/make-docs.ts`, `src/core/init/init.ts` (`makeDocsRan`, `stopPrefix`, `failedResult`), `src/cli/commands/init.ts` (the late correction) |
| Cache advice | the header of `src/core/shared/run-command.ts` |
| Tests | `test/printed-commands-review-3.test.ts` (new), `test/design.test.ts`, `test/installed-layout.test.ts`, `test/init.test.ts`, `test/printed-commands-review-2.test.ts` |
| Records | PRD 20, the risk register (R-003 entry), the evidence report (new follow-ups F-P9-09 and F-P9-10), the user guide, `RELEASE_NOTES.md`, `SECURITY.md` |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; the entity consolidation user guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | Review Round 3 and the Final Fix Pass: each finding, the old and new text, the proof, the cache runs with their exit codes, the other messages checked, and the new follow-ups. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Output and Exit Contract: the next fetch after the cache removal, the three retry states, the adoption note wording, the file named under `--repo-root`, and the new `started` field; Requirement History entry updated. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | The printed-commands entry: the review round 3 changes. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The `bin-links=false` limit: the next fetch after the removal must have bin links on. |

### User

| Path | Description |
| --- | --- |
| [docs/assets/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | Run a Printed Command: the two tested routes after a bad cache copy is removed. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.2.0` draft: the cache routes, the retry states, the note, the file named under `--repo-root`, and the new field. |
