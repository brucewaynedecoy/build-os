---
title: "W1 R7 P9 Stage 3 Skills and No-Python Check"
kind: "history"
status: "completed"
date: "2026-11-26"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/p9-stage-3"
summary: "Moved three skills onto the buildos extract bulk, fitgap, and export azure-boards commands, deleted the five skill script files, added the no-Python check with one named exception and a CI job that runs the commands with no Python on PATH, fixed F-P8-12 and F-P8-13, and updated the guide, README, and release notes draft."
---

# W1 R7 P9 Stage 3 Skills and No-Python Check

## Changes

Did W1 R7 P9 Stage 3 t9 to t12 on `rewrite/p9-stage-3`, stacked on pull requests 5 and 6. The `buildos-bulk-extract`, `fit-gap-analysis`, and `buildos-export-azure-boards` skills now call `buildos extract bulk`, `buildos fitgap`, and `buildos export azure-boards` through the project wrapper, and the five skill script files are deleted, so the package has 168 files instead of 173; the Azure Boards skill warns about CSV formula prefixes. `scripts/check-no-python.ts` fails on a Python file or call in the packaged skills, with one named exception, `capability-matrix`, until the owner decides F-P9-04. A new CI job runs the three commands on Ubuntu, macOS, and Windows with Node 24 and a PATH that it proves holds no Python. `scripts/measure-npx-first-run.ts` now puts its own Node first on the child PATH (F-P8-12), and `scripts/published-smoke.ts` checks raw output before it cleans the report (F-P8-13). The guide, the package README, and a draft `0.2.0` release notes section describe the commands. No version, release, or publication change.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-stage-3-skills-no-python-check-and-docs-2026-11-26).

| Area | Summary |
| --- | --- |
| Skills (t9) | Three `SKILL.md` files and their references call the commands through `.os/scripts/buildos`; the router; five script files deleted |
| No-Python check (t10) | `toolkits/buildos/scripts/check-no-python.ts`, `test/check-no-python.test.ts`; a step in the CI `test` job |
| No-Python job (t11) | `toolkits/buildos/scripts/no-python-smoke.ts`; job `no-python` in `.github/workflows/buildos-ci.yml` |
| Post-publication scripts | `scripts/node-first-path.ts` (new), `measure-npx-first-run.ts`, `published-smoke.ts`, `test/post-publication-scripts.test.ts` |
| Tests | `test/skills.test.ts`, `package.test.ts`, `test-output-safety.test.ts` follow the removed scripts |
| Docs (t12) | Guide chapters and app, `toolkits/buildos/README.md`, `RELEASE_NOTES.md`, `SECURITY.md`, the maintainer guide |
| Checks | `npm test` 2,749 tests, 0 fail; every `capture.ts --check` mode passes; real-list deny-list check 0 matches |

CI record (same day): CI run 45916436564 of `980ef40` passed the new `no-python` job on Ubuntu, macOS, and Windows with Node 24 and no Python on PATH, so A80 is met; the `buildos-bulk-extract` skill now says that Command Prompt needs double quotes around a name with a space.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section P9 Stage 3: Skills, No-Python Check, and Docs; F-P8-12 and F-P8-13 statuses. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | Entry gate departure, Stage 3 status, closeout status; no task ticked. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Skills without scripts, the no-Python check and job, the CSV formula-prefix note. |
| [docs/assets/maintainer/buildos-toolkit-cli-development.md](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | Layout names the new domains and scripts; the `0.2.0` Future Coverage item is resolved. |

### User

| Path | Description |
| --- | --- |
| [guide/content/14-export-to-a-work-tracker.md](../../../guide/content/14-export-to-a-work-tracker.md) | The export runs `buildos export azure-boards`; the formula-prefix warning. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | The three commands. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | A `0.2.0` section marked draft; the `0.1.0` Python sentence corrected. |
