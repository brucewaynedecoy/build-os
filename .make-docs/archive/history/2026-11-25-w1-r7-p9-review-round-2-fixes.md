---
title: "W1 R7 P9 Review Round 2 Fixes"
kind: "history"
status: "completed"
date: "2026-11-25"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli-p9-fix2"
summary: "Fixed the findings of the second independent review of the P9 skill-script commands: undo of writes that took effect before they failed, an idempotent publication resume checked against the current config, exact leftover reports, kept permission bits, owned-only package cleanup, path identity, Python's fnmatch, an order-independent model check, one XML-safe text rule, and the Windows test failure."
---

# W1 R7 P9 Review Round 2 Fixes

## Changes

Fix round 2 for P9 Stages 1 and 2 after the independent review of `9f5aee9`, on the branch `rewrite/ts-cli-p9-fix2`. A write that took effect before a later part of it failed (the folder flush after a rename) is now undone too, in `extract bulk` and in the shared writer of `fitgap` and `export azure-boards`; `publish` keeps its intent while any of its data is not surely back, and a resumed publication writes each row once and is checked against the config as it is then. Every leftover is named with its exact path (exit 10 and `partially_applied` when something could not be put back, a warning when only a harmless backup stays), and lock errors are classified by what happened. Replaced outputs keep their permission bits, and a read-only output is refused as the scripts refused it. `fitgap packages` deletes only its own earlier package files. Typed absolute paths name the project folder by identity, patterns follow Python's `fnmatch`, the workbook compares models by ID in any order, and one XML-safe text rule covers every workbook part. The Windows CI failure (a test that searched JSON for single backslashes) is fixed. Nothing was pushed, merged, published, staged, tagged, or released.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-review-round-2).

| Area | Summary |
| --- | --- |
| Bulk transaction (P9-R2-01) | `BulkFs.apply` journals the port's `committed` entry before the undo; each undo of a path expects the entry the later step put back; the undo stops at the first file it cannot put back for sure (`unsure` or `left`), so the intent stays |
| Resume and decisions (P9-R2-04, -05) | A resumed publication checks its recorded rows with the current config and says how to go on; a decision that only withdraws approval is accepted on an invalid row |
| Config reader (P9-R2-11) | `extract bulk` reads `.os/config/instance.yaml` with `buildos validate`'s `readConfig`; a config validate cannot read as UTF-8 text stops it with validate's finding |
| Lock (P9-R2-08) | Only `EEXIST` is another writer; any other create failure is exit 5 at the lock path; a lock that cannot be removed is exit 10 with its path |
| Shared writer (P9-R2-06, -07) | Kept permission bits (`NewFileOptions.exactMode`); a read-only destination stops before the first change; a committed temporary file or a rename that took effect is undone; every leftover with its exact path (`NotRestored`, `result.not_restored`, `result.left_behind`) |
| Package cleanup (P9-R2-02) | Only numbered, package-shaped regular files are removed (`readDestination`); every other `pkg-*.json` is kept and named (SD-20) |
| Paths and patterns (P9-R2-10, -12) | Identity-based containment for typed absolute paths; a faithful port of `fnmatch.translate` with a table checked against Python 3.14.10 |
| Workbook (P9-R2-09, -13) | Models compared by ID in any order, with each mark's requirement under its capability; one XML-safe rule for free text, refusal for codes, a guard in the writer |
| Tests (P9-R2-03) | The JSON report is parsed before its path is compared; the emit case is tested; `test/skill-script-review-2.test.ts` (33 tests, faults injected before and after the commit point); shared helpers in `test/skill-script-support.ts` |
| Divergences | SD-05, SD-09, SD-13, SD-16, SD-18, SD-19 updated; SD-20 new; the parity test pins SD-20's stderr |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

None this session (the evidence report and the phase file change in the closing documentation commit).

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Path identity, kept modes and read-only refusal, exact leftovers, owned-only package cleanup and its one destination read, the post-commit undo and resume checks, the config reader, lock classification, and the workbook text rule. |
| [toolkits/buildos/test/golden/skills/divergences.json](../../../toolkits/buildos/test/golden/skills/divergences.json) | Updated divergences and the new SD-20, with an owner recommendation. |

### User

None this session.
