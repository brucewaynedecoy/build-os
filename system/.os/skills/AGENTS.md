# Skills Router (`.os/skills`)

This folder holds the BuildOS skills. `buildos init` copies them here from the BuildOS package. Each skill is one folder with a `SKILL.md`. Read this router before you install or run a skill.

## Skills

| Skill | Use it to |
| --- | --- |
| [`buildos-workflow`](buildos-workflow/SKILL.md) | Pick the right BuildOS skill when the user names an outcome, not a skill. Start here. |
| [`buildos-preflight`](buildos-preflight/SKILL.md) | Check that the project is ready before a workflow. Changes no file. |
| [`buildos-intake`](buildos-intake/SKILL.md) | Convert incoming files into converted twins and rebuild the references index. |
| [`buildos-intake-convert`](buildos-intake-convert/SKILL.md) | Classify and convert one or many incoming files, with manual fallbacks. |
| [`buildos-reference-review`](buildos-reference-review/SKILL.md) | Check converted twins and the references index before extraction. |
| [`buildos-extraction-plan`](buildos-extraction-plan/SKILL.md) | Plan what to extract from converted twins, and stop for approval. |
| [`buildos-extract`](buildos-extract/SKILL.md) | Turn a converted twin into approved rows, draft playbooks, or routed docs. |
| [`buildos-bulk-extract`](buildos-bulk-extract/SKILL.md) | Extract from many sources in small sets: stage rows, then review and publish them in a separate task. |
| [`buildos-row-drafting`](buildos-row-drafting/SKILL.md) | Draft new data rows in `.os/data/`. |
| [`buildos-row-maintenance`](buildos-row-maintenance/SKILL.md) | Update, merge, or supersede existing data rows from new evidence. |
| [`buildos-playbook-drafting`](buildos-playbook-drafting/SKILL.md) | Draft playbooks and rebuild the playbooks index. New playbooks stay `draft`. |
| [`buildos-discovery`](buildos-discovery/SKILL.md) | Record discovery runs and qualify findings with the CLI. |
| [`buildos-discovery-qualification`](buildos-discovery-qualification/SKILL.md) | Guide discovery and test runs, and qualify a finding only with confirmation evidence. |
| [`buildos-browser-to-playwright`](buildos-browser-to-playwright/SKILL.md) | Turn browser discovery into deterministic Playwright tests. |
| [`buildos-design-planning`](buildos-design-planning/SKILL.md) | Promote a qualified finding into a design, then continue into approved planning. |
| [`buildos-docs-handoff`](buildos-docs-handoff/SKILL.md) | Route durable knowledge into the Make Docs documents under `docs/`. |
| [`buildos-validation-reporting`](buildos-validation-reporting/SKILL.md) | Run `buildos validate` and the entity checks after a change, and report the result. |
| [`buildos-reporting`](buildos-reporting/SKILL.md) | Build a read-only progress report from the indexes, data, runs, and findings. |
| [`buildos-export-azure-boards`](buildos-export-azure-boards/SKILL.md) | Turn a work backlog under `docs/work/` into an Azure Boards import CSV. |
| [`capability-matrix`](capability-matrix/SKILL.md) | Build joinable capability models of two or more systems, and a fit/gap between them. |
| [`fit-gap-analysis`](fit-gap-analysis/SKILL.md) | Score a requirement-level fit-gap of one system against another and deliver an Excel workbook. |

## What a skill needs

- Every skill runs BuildOS commands through the project wrapper: `.os/scripts/buildos <domain> ...` from the project root (`.os\scripts\buildos.cmd` on Windows). The wrapper needs Node.js 24 or newer.
- `buildos-bulk-extract`, `fit-gap-analysis`, `buildos-export-azure-boards`, and `capability-matrix` run the commands `buildos extract bulk`, `buildos fitgap`, `buildos export azure-boards`, and `buildos capability-matrix` through that wrapper. They need only Node.js. No skill needs Python.

## Install one skill

Install a skill only when the user asks for it, or when a BuildOS workflow needs it and the user agrees. Install only that skill, not the whole folder.

1. Copy the whole skill folder, `.os/skills/<skill>/`, with its folder name unchanged. Leave `.os/skills/` as it is: it is the source copy.
2. Put the copy where your app reads skills. Use the project location, so the skill stays with this project:

   | App | Project location | Personal location (all projects) |
   | --- | --- | --- |
   | Claude Code | `.claude/skills/<skill>/` | `~/.claude/skills/<skill>/` |
   | Codex (CLI, IDE extension, desktop app) | `.agents/skills/<skill>/` | `~/.agents/skills/<skill>/` |
   | GitHub Copilot | `.github/skills/<skill>/` (Copilot also reads `.claude/skills/` and `.agents/skills/`) | `~/.copilot/skills/<skill>/` |

3. For any other app, read that app's own documentation for its skill folder. If it has none, do not install: read the skill's `SKILL.md` from `.os/skills/` and follow it.
4. Tell the user what you copied and where. Some apps find a new skill only after a restart.

A skill's commands use `.os/skills/<skill>/` paths from the project root, so they work from any installed copy. After a BuildOS update changes `.os/skills/`, copy the skill again.

## When `buildos init` exits `10`

Exit `10` with `make_docs_choice_needed` means `buildos init` stopped before it changed anything. It needs one answer from the user. Do not choose for the user.

1. Ask the user the question that `buildos init` printed: "Set up Make Docs in this project?"
2. Give the user its two lines in plain words: what Make Docs adds, and whether Make Docs can be set up later. With the tested Make Docs version, it often cannot: This Make Docs version does not set up a folder that has an AGENTS.md or CLAUDE.md file that Make Docs did not write.
3. Run the one command that `buildos init` printed for the answer, exactly as printed. In `--json` output it is `result.choices[].command`.
   - Yes: `buildos init --root <project> --make-docs`
   - No: `buildos init --root <project> --skip-make-docs`

On Windows, run the command in Command Prompt, as the output says.
