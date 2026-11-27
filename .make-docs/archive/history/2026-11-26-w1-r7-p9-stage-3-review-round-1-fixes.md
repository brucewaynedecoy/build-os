---
title: "W1 R7 P9 Stage 3 Review Round 1 Fixes"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/p9-stage-3"
summary: "Fixed review round 1 of pull request 7: a CI job runs the no-Python smoke inside the node:24-slim image and searches its filesystem for Python, the upgrade steps from 0.1.0 are written and tested, the no-Python check finds path-qualified and quoted names, the Azure Boards examples run, SECURITY.md is current, and the owner decisions of 2026-11-26 are recorded."
---

# W1 R7 P9 Stage 3 Review Round 1 Fixes

## Changes

Fixed the five findings and two notes of review round 1 of pull request 7 on `rewrite/p9-stage-3`. A new CI job, `no-python-image`, runs `scripts/no-python-image.sh` inside the official `node:24-slim` image, pinned by digest and recorded in `SECURITY.md`: the guards, the install, the build, the smoke, and the parity test, with `no-python-smoke.ts --filesystem /` first searching the whole container filesystem for a Python name; the `no-python` job stays, and A80 waits for the job's CI run. The release-notes draft and the guide now give tested steps to move a `0.1.0` project to `0.2.0` (the pin, the skills, app copies of skills, an npm install, a check), because `buildos init` on an existing project keeps the pin and the skills. `scripts/check-no-python.ts` finds a Python name after a folder or in quotes. The Azure Boards contract validates the CSV of the bundled Dynamics 365 CE manifest, a new test runs every contract example in order, and the skill inspects a CSV as text. `SECURITY.md` says 168 package files and no Python allowance. The owner decisions of 2026-11-26 on F-P8-11 and F-P9-04 are recorded; neither is built here, and the `capability-matrix` exception stays with its new status text.

CI fix (same day): the first run of the `no-python-image` job (run 45920836350) failed on `/usr/share/gcc/python`, a folder of GDB helper sources that Debian's `libstdc++6` installs, because the filesystem search failed on any entry with a Python name. The search now fails only on a Python that can run (a `py`, `python*`, or `pypy*` program or link, a `libpython*` library, or a `python<N>` library folder) and lists the other entries; `test/check-no-python.test.ts` plants both kinds.

CI record (same day): CI run 45921131235 of `bf6db38` passed every job; the `no-python-image` job searched 8,321 entries of the `node:24-slim` image and found no Python that can run, and the smoke and the 65 parity tests passed in it, so A80 is met for Linux by the image and for macOS and Windows by the restricted `PATH`.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-stage-3-review-round-1-2026-11-26).

| Area | Summary |
| --- | --- |
| A80 image job (finding 1) | `.github/workflows/buildos-ci.yml` job `no-python-image`; `toolkits/buildos/scripts/no-python-image.sh` (new); `scripts/no-python-smoke.ts` (`--filesystem`, `--skip`, `searchDisk`) |
| Upgrade steps (finding 2) | `toolkits/buildos/RELEASE_NOTES.md`; `guide/content/04-install-and-configure-your-instance.md` ("From 0.1.0 to 0.2.0"), chapters 17 and 18; the guide app |
| No-Python check (finding 3) | `toolkits/buildos/scripts/check-no-python.ts`; `test/check-no-python.test.ts` |
| Azure Boards skill (finding 4) | `references/azure-boards-csv-contract.md`, `SKILL.md` step 11 and the formula-prefix note; `test/azure-boards-skill-examples.test.ts` (new); `test/skills.test.ts` (one example output classified) |
| `SECURITY.md` (finding 5) | Package Contents count and the Python rule; the no-Python check and image job rows; the CSV note |
| Owner decisions | Evidence, the phase file, the R-003 register entry, the exception's status text, the guide and release-notes sentences on Python |
| Checks | See the evidence report |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapter 4 gains the upgrade section.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section P9 Stage 3 Review Round 1; the Stage 3 A80 row, departure, owner question, and follow-up statuses point to it; the F-P8-11 status. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | Stage 3 status and closeout status; no task ticked. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003 records the owner decisions on F-P8-11 and F-P9-04. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | 168 files; no Python file ships; the image job with its digest; the check's new spellings; the CSV text reader. |
| [docs/assets/maintainer/buildos-toolkit-cli-development.md](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | The image script; the exception's status. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | "From 0.1.0 to 0.2.0"; the Skills note. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | The `0.2.0` draft: the upgrade steps, the `capability-matrix` plan, the spreadsheet note; the `0.1.0` sentence. |
| [system/.os/skills/buildos-export-azure-boards/SKILL.md](../../../system/.os/skills/buildos-export-azure-boards/SKILL.md) | Step 11 and the formula-prefix note. |
