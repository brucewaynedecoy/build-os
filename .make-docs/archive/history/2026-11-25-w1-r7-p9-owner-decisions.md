---
title: "W1 R7 P9 Owner Decisions: Intake JSON Envelope and Approved Parity Rules"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-owner1"
summary: "Built the owner decisions of 2026-11-25: buildos intake prints the shared JSON envelope with --json (register D-010, parity exception PE-022), the .xlsx content rule PE-021 is approved and moved to parity-exceptions.json, and the contained reads of SD-04 are recorded as owner-accepted."
---

# W1 R7 P9 Owner Decisions: Intake JSON Envelope and Approved Parity Rules

## Changes

Built the owner decisions of 2026-11-25 (option A for each) on the branch `rewrite/ts-cli-p9-owner1` from `befc751`. `buildos intake convert`, `intake index references`, and `intake index playbooks` now print the shared JSON envelope with `--json`, with the rules that `discovery` and `design` use: the switch counts only as a whole argument in flag position, stdout holds only the envelope, stderr is empty, a conversion warning becomes a `warning` diagnostic, and the exit code is the one of the text form; without `--json` the output is the Go text, byte for byte, and help keeps the Go usage text. Parity exception PE-022 records the difference from the Go intake tool, and register `D-010` is closed. The `.xlsx` content rule PE-021 moved from `proposed-exceptions.json` to `parity-exceptions.json` with the owner decision, so no exception is pending, and SD-04 (contained reads) records the owner acceptance. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-owner-decisions-2026-11-25).

| Area | Summary |
| --- | --- |
| Intake envelope (`D-010`, PE-022) | `runIntake` uses the shared `go-tool.ts` output (`succeed`, `fail`, `usageFailure`, `GO_TOOL_EXTRAS`); commands `intake.convert`, `intake.index.references`, `intake.index.playbooks`; `planned`, `applied`, or `not_requested`; warnings as `image_not_copied` diagnostics |
| Usage errors after the flags | `usageFailure` keeps the switches already found on the run, so `intake convert --json` without `--source` prints the envelope; `discovery` and `design` call it only before the flags are parsed, so their output does not change |
| Parity exceptions | PE-021 approved and moved, with its `xlsx` entry (the `ParityException` type gains `xlsx`); PE-022 new; `proposed-exceptions.json` is empty |
| Skill divergences | SD-04 has the owner decision; the PE-021 notes in `divergences.json`, `capture.ts`, and `capture-record.json` no longer say proposed |
| Tests | `test/intake-json.test.ts` (new, 13 tests); `test/golden/self-test.test.ts` and `test/skill-script-parity.test.ts` check PE-021 as approved |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `D-010` closed with the owner decision and its resolution. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Output and Exit Contract names every command that takes `--json`; a requirement history entry records the previous contract. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/test/golden/parity-exceptions.json](../../../toolkits/buildos/test/golden/parity-exceptions.json) | PE-021 approved and PE-022 new, each with its reason and the owner decision. |
| [toolkits/buildos/test/golden/skills/divergences.json](../../../toolkits/buildos/test/golden/skills/divergences.json) | SD-04 owner-accepted; PE-021 named as approved. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | `intake` is in the list of commands that print the envelope (from `0.2.0`); the guide app is rebuilt. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | The same list in the package README. |
