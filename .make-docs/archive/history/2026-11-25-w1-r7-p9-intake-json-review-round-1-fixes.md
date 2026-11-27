---
title: "W1 R7 P9 Intake JSON Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-owner2"
summary: "Fixed the review findings on the intake --json envelope (PE-022): an undo after a failed write in JSON mode with partially_applied and exit 10 for what stays, one output form for an unexpected error, the read-back size check in a dry run, intake's cleaned root, project-relative result paths with /, and exact wording for PE-021, help, and stderr."
---

# W1 R7 P9 Intake JSON Review Round 1 Fixes

## Changes

Fix round 1 for the intake `--json` envelope (parity exception PE-022) after the independent review of `4705e52` and `e07b993`, on the branch `rewrite/ts-cli-p9-owner2`. With `--json`, a failed write of `intake convert` or `intake index` now removes each folder and file that the same run made, only while each is still that entry, and never an entry that was there before; what stays (a folder that is not empty, an earlier file that `--force` replaced) is named in `result.not_restored` with `partially_applied` and exit 10, in the form of the other P9 commands, and the text form keeps the Go behavior. An unexpected error gives exactly one output form, the one the leaf parser decided, with the leaf's root, also for `discovery` and `design`. A dry run checks the twin size against the read-back limit before it returns (PE-019). The envelope `root` is intake's cleaned root from the moment the flags parse, and every result path is relative to it with `/` (an allowed outside destination is absolute with `/`), while the text form keeps Go's native paths. PE-021 separates the approved content rule from the pending SD-19 error-token relaxation, and PRD 20, the README, and the guide name the help forms that print text. Each code fix has a test that fails without it. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-review-round-1).

| Area | Summary |
| --- | --- |
| Undo (finding 1) | `WriteLog`, `withUndo`, and `IntakeUndoneFailure` in `src/core/intake/io.ts`; `ConvertOptions.undoOnFailure` and `IndexOptions.undoOnFailure`, set by the CLI with `--json`; `fail` in `go-tool.ts` reports `partially_applied`, `not_restored`, `undo_incomplete`, and exit 10 |
| Unexpected errors (finding 2) | `fail` reports a non-BuildOS error in the leaf's mode and root (`internal_error`), so the dispatcher never rescans the arguments |
| Dry run (finding 3) | `checkTwinSizes` runs before the dry run returns |
| Root and paths (findings 4, 5) | `cleanRoot` for the envelope root after the parse; `reportPath` for every result path |
| Documentation (findings 6, 7) | PE-019, PE-021, and PE-022 in `parity-exceptions.json`; PRD 20 Output and Exit Contract with a requirement history entry; register `D-010`; `SECURITY.md`; the README; guide chapter 4 and the rebuilt guide app |
| Tests (finding 8) | `test/intake-json.test.ts`: 8 new tests, exact index counts and text, fault injection through the `openWriter` seam and the filesystem port factory |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Help forms, one output form for an unexpected error, the ported commands' root and result paths, and the intake undo with `--json`; requirement history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `D-010` resolution: `partially_applied`, the text-mode difference, and the legacy-name notice. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-review-round-1) | The round: findings, tests, and checks. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | Status line for PE-021 and SD-19. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | The intake undo with `--json` and what stays. |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-019 (the dry-run case), PE-021 (SD-19 kept apart), and PE-022 (the full JSON contract and the mode difference). |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | Which help forms print text. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Which help forms print text; `--help` after a subcommand. The guide app `guide/BuildOS-Guide.html` is rebuilt. |
