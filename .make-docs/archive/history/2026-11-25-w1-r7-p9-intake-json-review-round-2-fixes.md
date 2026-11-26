---
title: "W1 R7 P9 Intake JSON Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-owner3"
summary: "Removed the intake undo after a failed write and replaced it with a truthful report from the write operations themselves (result.left_in_place, partially_applied, exit 10), with fixes for links out of the root, refusals before the open, repeated paths, Windows error text, leading-dot paths, the index diagnostic, help order, and the PRD scope of the one-output-form rule."
---

# W1 R7 P9 Intake JSON Review Round 2 Fixes

## Changes

Fix round 2 for the intake `--json` envelope (parity exception PE-022) after review round 2 of `e1f2154`, on the branch `rewrite/ts-cli-p9-owner3`. The orchestrator decided to remove the undo and report the truth: intake does not undo; the envelope names what stayed. A failed write of `intake convert` or `intake index` removes and puts back nothing, with and without `--json`, as the Go tool. With `--json`, each write operation says what it did (a non-recursive `mkdir` level that succeeded made that folder; the in-place writer says `created`, `changed`, or `untouched`, also in its thrown error), and the envelope lists each created or changed path once in `result.left_in_place` with `partially_applied` and exit 10, or reports `not_requested` with the text form's exit code when nothing changed. Envelope paths use a parent-component check, `outputs[].source` included. PRD 20 limits the one-output-form rule for an unexpected error to `intake`, `discovery`, and `design`; the dispatcher behavior of the other domains is follow-up F-P9-06. Each code fix has a test that fails without it. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-review-round-2).

| Area | Summary |
| --- | --- |
| No undo (findings 1, 2) | `WriteLog`, `withUndo`, and `IntakeUndoneFailure` removed; `WriteRecord`, `withRecord`, and `IntakeWriteFailure` in `src/core/intake/io.ts`; `ConvertOptions.recordWrites` and `IndexOptions.recordWrites`, set by the CLI with `--json` |
| Port result (findings 1 to 5) | `InPlaceEffect`, `withInPlaceEffect`, and `inPlaceEffectOf` in `src/core/shared/fs-port.ts`; `writeFileInPlace` in `src/adapters/node-fs.ts` returns and tags its effect; `mkdirAll` in `src/core/shared/go-fs.ts` tells each folder it made |
| Envelope (findings 1, 7, 8) | `fail` in `go-tool.ts` reports `partially_applied`, `left_in_place`, and exit 10; `reportPath` uses a parent-component check; `outputs[].source` from `ConvertResult.sourcePath`; the index diagnostic names no `--force` |
| Documentation (findings 9, 10) | PE-022; PRD 20 Output and Exit Contract with a requirement history entry; register `D-010`; `SECURITY.md`; the README; guide chapter 4 and the rebuilt guide app; follow-up F-P9-06 |
| Tests (findings 1 to 9) | `test/intake-json.test.ts`: 3 undo tests replaced, 10 new tests; `test/fs-port.test.ts`: 2 new tests; platform error text through `goErrnoText` |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Intake does not undo; `left_in_place`; the scope of the one-output-form rule; help order; requirement history entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `D-010` resolution: no undo, `left_in_place`, and the exit codes. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-intake-json-review-round-2) | The round: findings, tests, and checks; follow-up F-P9-06. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Intake does not undo, and the report comes from the write operations. |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-022: no undo, `left_in_place`, the path rule, and help order. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | `--json` before or after `--help`. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Both flag orders for `--help` and `--json`. The guide app `guide/BuildOS-Guide.html` is rebuilt. |
