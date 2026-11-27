---
title: "W1 R7 P9 Owner Answers on SD-26, the Windows Label, and R-012"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/smoke-a-tarball"
summary: "Recorded three owner decisions of 2026-11-27: SD-26 decided as option A (stop with a clear message), the Windows label wording of PE-023 confirmed, and R-012 closed by the owner against the recommendation to keep it open; the runbook's step 0 status now names one open precondition, the merge of pull request 12."
---

# W1 R7 P9 Owner Answers on SD-26, the Windows Label, and R-012

## Changes

Recorded three owner answers of 2026-11-27 as owner decisions, with no behaviour change. SD-26 (owner question Q1 of F-P9-04) is decided as option A, "Yes, agreed: Stop with a clear message.": the SD-26 record in `toolkits/buildos/test/golden/skills/divergences.json` (its `authority` text only), the SD-26 bullet of the `0.2.0` notes, the evidence report, the P9 phase file, and `R-003` now say so. The Windows label wording on the human `action:` line (PE-023, F-P8-11) is confirmed, "I accept "run this in Command Prompt:"", in the evidence sections of pull request 9 and the runbook; the record says that the answer names the short form and that the long form is the same label with the documented addition. `R-012` is closed in the register ("I think we can close it now"), with a Resolution that names what the closing rests on and that the owner closed it knowing that the recommendation was to keep it open; the P8 phase file and the evidence report no longer call it open. The runbook's step 0 status line now says that every precondition is met except the merge of pull request 12, and that the next step after that merge is the owner's go for the dry run (step b).

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [owner decisions of 2026-11-27](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-of-2026-11-27-020-release).

| Area | Summary |
| --- | --- |
| Divergence record | `toolkits/buildos/test/golden/skills/divergences.json`: the SD-26 `authority` text (decided by the owner on 2026-11-27, option A) |
| Release notes | `toolkits/buildos/RELEASE_NOTES.md`: the SD-26 bullet says that the owner decided the stop on 2026-11-27 |
| Register | `R-012` closed with a Resolution; `R-003`: Q1 decided |
| Records | The evidence report (F-P9-04 and pull request 9 sections, the t17 section, the open-items table, step 0, the facts table, the decisions lists and table); the P8 and P9 phase files |

On pull request 12 (`feat/smoke-a-tarball`), which is open. No source file under `src/`, workflow, version, `release-candidates.json`, golden output, parity exception, acceptance criterion, or gate text changed; no checkbox changed. Nothing is published, staged, or tagged. The archived history records keep their own words (SD-26 "owner decision open, built as A" was true when they were written).

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `no-change`; no guide source changed.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | The three owner decisions, the t17 section, the open-items table, step 0 and its status line, and the facts table. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | The t17 and A73 status notes and the closeout note: `R-012` closed by the owner. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | t13 status: SD-26 decided. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | `R-012` closed with a Resolution; `R-003`: Q1 decided. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The SD-26 bullet of the `0.2.0` notes. |

### User

None this session.
