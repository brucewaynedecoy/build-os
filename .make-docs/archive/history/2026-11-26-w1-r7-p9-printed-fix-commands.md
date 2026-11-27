---
title: "W1 R7 P9 Printed Fix Commands Run as Printed (F-P8-11)"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "fix/f-p8-11-printed-commands"
summary: "Fixed F-P8-11 and F-P8-10 for 0.2.0 under the owner decision of 2026-11-26: every command BuildOS prints for the adopter to run starts with npx -y build-os@<running version> (buildos for a source build), the printed root is always quoted for the shell, and parity exception PE-023 records the change against the Go goldens without changing a golden file."
---

# W1 R7 P9 Printed Fix Commands Run as Printed (F-P8-11)

## Changes

Fixed F-P8-11 and F-P8-10 for `0.2.0` under the owner decision of 2026-11-26 (F-P8-11 is fixed in `0.2.0`, with no `0.1.1`; a printed command takes the form `npx -y build-os@<running version> …`). One helper, `toolkits/buildos/src/core/shared/run-command.ts`, builds every command that BuildOS prints for the adopter to run: a release version (a prerelease too) gives `npx -y build-os@<version>`, and a source build (`dev`), `0.0.0-dev`, or a version npm cannot hold exactly (such as `0.2.0+local`) gives `buildos`. A folder path is always quoted for the shell: POSIX single quotes, and Command Prompt double quotes on Windows with each `\` written once, in place of Go's `%q`, which doubled each `\` (F-P8-10). The `entities rebuild-index` recovery command (the `action:` line, `remediation_command`, `recovery_command`, `correction`), `Run … help for command syntax.`, and the "run … again" advice of `validate`, `init`, `extract bulk`, and `export azure-boards` use it; usage lines, help text, and the legacy-name notice keep the name `buildos`, and JSON field names and shapes stay. Parity exception PE-023 is a class rule in `test/golden/parity-exceptions.json` (`printed_command`) that the harness applies to the exact listed goldens and seeds (5 golden cases on darwin and linux, 6 on win32, 7 shared usage cases, 11 entity edge seeds, 5 `$PWD` seeds); no golden file changed, and `test/golden/printed-command.test.ts` checks that the lists are exact and that every other difference still fails. Tests cover each printed-command class from a release build, the helper's edge cases, and the printed rebuild command run as printed in `sh`, Command Prompt, and Windows PowerShell; an end-to-end check with a locally packed, release-stamped tarball ran the printed text; and `scripts/published-smoke.ts` gets step 10, which runs a printed fix command on the next published version.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p8-11-printed-commands-2026-11-26).

| Area | Summary |
| --- | --- |
| Helper | `toolkits/buildos/src/core/shared/run-command.ts`; `quoteAlways` in `src/core/init/make-docs.ts` |
| Printed commands | `src/core/entities/commands.ts`, `src/cli/run.ts`, `src/cli/commands/validate.ts`, `src/core/validate/validate.ts`, `src/core/init/` (`init.ts`, `plan.ts`, `shared-files.ts`, `apply.ts`), `src/cli/commands/init.ts`, `src/core/extract/bulk.ts`, `src/core/export/azure-boards/export.ts`, and the CLI domains that pass the build version |
| Parity exception | `test/golden/parity-exceptions.json` (PE-023), `test/golden/harness.ts` (`applyPrintedCommands`, `withPrintedCommands`, `seedWithPrintedCommands`), `test/golden/compare.test.ts`, `test/golden/printed-command.test.ts`, `test/golden/CAPTURE.md`, `test/golden/self-test.test.ts` |
| Tests | `test/run-command.test.ts`; `test/entities-cli.test.ts`, `test/entities-edge.test.ts`, `test/entities-bundle.test.ts`, `test/skill-script-review-3.test.ts`, `test/skill-script-support.ts` |
| Smoke | `scripts/published-smoke.ts` step 10 |
| Records | PRD 20, the risk register (R-003), the evidence report, the guide chapter 18 and the user guide, the guide app, `RELEASE_NOTES.md`, `SECURITY.md` |

Pull request 9 (`fix/f-p8-11-printed-commands`). CI passed on three systems for the F-P8-11 commit, with the printed rebuild command run in Command Prompt and Windows PowerShell on Windows, and `buildos-smoke` for `0.1.0` passed with step 10. Pull request 8 was opened by mistake from `rewrite/p9-stage-3` and is closed; the evidence records it.

Bot review fix (same day): the harness rule `printedProgram` now states the exact-version limits itself (at most 256 characters, each number at most `Number.MAX_SAFE_INTEGER`, no numeric prerelease identifier with a leading zero), so `0.2.0-01` gives `buildos` there as in the CLI helper; the tests check both agree on these versions.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapter 18 and the entity consolidation user guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section F-P8-11 Printed Commands: the owner decision, the helper, each class, PE-023, the end-to-end check, the Windows quoting, smoke step 10, and the checks; F-P8-10 and F-P8-11 status. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Output and Exit Contract: the printed-command rule; Requirement History entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the printed commands for `0.2.0` and when F-P8-10 and F-P8-11 close. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Windows shown commands: the printed fix commands, PowerShell, and the version a printed command runs. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | Printed Fix Commands (PE-023). |

### User

| Path | Description |
| --- | --- |
| [guide/content/18-what-is-not-built-yet.md](../../../guide/content/18-what-is-not-built-yet.md) | The strict-validation workaround names the wrapper form and the printed command of each version. |
| [docs/assets/user/entities-consolidation-curate-and-resolve-records.md](../../../docs/assets/user/entities-consolidation-curate-and-resolve-records.md) | From `0.2.0` the recovery command runs as printed; the `0.1.0` advice stays. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.2.0` draft: "Fix commands run as printed". |
