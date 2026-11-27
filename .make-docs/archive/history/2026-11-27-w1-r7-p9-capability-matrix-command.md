---
title: "W1 R7 P9 Capability-Matrix Command (F-P9-04)"
kind: "history"
status: "completed"
date: "2026-11-27"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P9"
provider: "Anthropic"
repo: "build-os"
branch: "feat/capability-matrix-command"
summary: "Built buildos capability-matrix skeleton|assemble|fitgap|validate for 0.2.0 under the owner decision of 2026-11-26 (F-P9-04): the port of the Python tool cm_build.py that the capability-matrix skill embedded, byte for byte on 15 captured fixture cases; the skill calls it through the project wrapper, and the no-Python check has no exception, so A79 is met."
---

# W1 R7 P9 Capability-Matrix Command (F-P9-04)

## Changes

Built `buildos capability-matrix skeleton|assemble|fitgap|validate` for `0.2.0` under the owner decision of 2026-11-26 (F-P9-04: the `capability-matrix` skill gets its own BuildOS command, so that no skill needs Python). It is the port of `cm_build.py`, the Python tool that `system/.os/skills/capability-matrix/SKILL.md` embedded in its appendix, pinned at the first public commit `085927e` (block SHA-256 `559ccc27826acbb1dea53ebc829de0242922366672964beea218edd5f56d38a8`), built by the method of P9 Stages 1 and 2: core logic in `toolkits/buildos/src/core/capability-matrix/` on the shared Python ports (JSON read and written as Python's `json` does, CSV as its `csv` module writes it, Python's key, membership, and formatting rules), a CLI adapter in `src/cli/commands/capability-matrix.ts` with the script's options, `--root`, `--json`, `--allow-outside-root`, and the PRD 20 exit codes, and writes through the planned, contained, atomic write plan. Invented fixtures (15 cases, 66 steps over the four subcommands) were captured from the pinned block with Python 3.14.10 through the skill-script capture, which gains a fourth script without changing the other three's goldens, and the parity test matches every golden byte for byte. Divergences SD-23 to SD-26 record what differs: a crash is one plain line with exit 3; reads, matches, and writes stay in the project and a failed run writes nothing; the bytes are the same on every system; and a system code with a pattern character stops the id check (owner question Q1). The skill now calls `.os/scripts/buildos capability-matrix …` (with the `.cmd` form named) and holds no Python; `scripts/check-no-python.ts` has no exception, so A79 is met; the no-Python smoke runs the fourth command; and the guide's upgrade from `0.1.0` refreshes four skills.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P9 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md), and the [evidence report](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p9-04-capability-matrix-command-2026-11-26).

| Area | Summary |
| --- | --- |
| Command | `toolkits/buildos/src/core/capability-matrix/cm-build.ts`, `py-values.ts`; `src/cli/commands/capability-matrix.ts`; `src/cli/run.ts`; `pyGlob` exported from `src/core/fitgap/fitgap.ts` |
| Fixtures and goldens | `test/fixtures/skills/generate-capability-matrix.ts`, `test/fixtures/skills/capability-matrix/`, `test/golden/skills/capability-matrix/`, `script-source.ts`, `script-sha256.json`, `capture.ts`, `capture-record.json`, `scenario.ts`, `buildos-runner.ts`, `test/capture-sources.test.ts`, `test/golden/CAPTURE.md` |
| Divergences and exceptions | `test/golden/skills/divergences.json` (SD-01, SD-02, SD-23 to SD-26); `test/golden/parity-exceptions.json` (PE-001 root help) |
| Tests | `test/capability-matrix.test.ts`; `test/check-no-python.test.ts`; `test/validate.test.ts`; `test/skill-script-support.ts` |
| Skill, check, and smoke | `system/.os/skills/capability-matrix/SKILL.md`, `system/.os/skills/AGENTS.md`; `scripts/check-no-python.ts`; `scripts/no-python-smoke.ts`; `.github/workflows/buildos-ci.yml` |
| Records | PRD 20, the risk register (R-003), the P9 phase file, the evidence report, the guide (chapters 3, 4, 10, 16, 17, 18) and the guide app, `RELEASE_NOTES.md`, `SECURITY.md`, the package README |

Stacked on pull request 9 (`fix/f-p8-11-printed-commands`), which was not merged when this work started. No version, release candidate, tag, release, or stage changed.

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing`; chapters 3, 4, 10, 16, 17, and 18.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | New section F-P9-04 Capability-Matrix Command: the tool, the design before the code, what was built, fixtures and goldens, divergences, owner question Q1, acceptance criteria, the upgrade check, and the check results. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/09-skill-script-commands-0-2-0.md) | Overview, entry-gate departure, Stage 3 status (A79 met), closeout status. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Command Surface table, Packaged Skills; Requirement History entry. |
| [docs/prd/03-open-questions-and-risk-register.md](../../../docs/prd/03-open-questions-and-risk-register.md) | R-003: the capability-matrix command and owner question Q1. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Skills, the no-Python check, the no-Python job, Read Safety, Skill-Script Commands, Skill scripts, CSV formula prefixes. |
| [toolkits/buildos/test/golden/CAPTURE.md](../../../toolkits/buildos/test/golden/CAPTURE.md) | The embedded `cm_build.py` source and its capture. |
| [toolkits/buildos/RELEASE_NOTES.md](../../../toolkits/buildos/RELEASE_NOTES.md) | `0.2.0` draft: four commands, no skill needs Python, the upgrade refreshes four skills; `0.1.0` Known limits sentence. |
| [toolkits/buildos/README.md](../../../toolkits/buildos/README.md) | The command table and `--json`. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | Domains, Skills, and "From 0.1.0 to 0.2.0" with four skills in every step, check, and rollback step. |
| [guide/content/03-before-you-start.md](../../../guide/content/03-before-you-start.md), [16](../../../guide/content/16-harness-independence-and-trust.md), [17](../../../guide/content/17-when-things-go-wrong.md), [18](../../../guide/content/18-what-is-not-built-yet.md), [10](../../../guide/content/10-compare-two-systems.md) | No skill needs Python from `0.2.0`; the capability-matrix command. |
| [system/.os/skills/capability-matrix/SKILL.md](../../../system/.os/skills/capability-matrix/SKILL.md) | The skill runs `buildos capability-matrix` through the project wrapper; the appendix is gone. |
