---
name: buildos-preflight
description: Inspect an installed Build OS workspace before running intake, extraction, discovery, or design workflows. Use to confirm routers, layout, toolkit availability, and blockers without modifying files.
---

# Build OS Preflight

Use this skill at the start of a Build OS session or before a major workflow when the user asks to verify readiness.

## Rules

- Start at `AGENTS.md`, then `.os/AGENTS.md` if present.
- Treat `docs/` and `.make-docs/` as managed by their routers. They exist only when Make Docs is set up in the project; a project set up with `buildos init --skip-make-docs` has neither, and that is not a blocker.
- Do not modify files during preflight.
- Report blockers plainly instead of working around missing tools or folders.

## Workflow

1. Confirm the current directory is the Build OS workspace root.
2. Inspect expected roots: `.os/`, `assets/`, `playbooks/`, and `workspace/`. Check `docs/` only when Make Docs is set up (the project has `.make-docs/` or `docs/AGENTS.md`); otherwise report "Make Docs: not set up".
3. Note whether the project keeps a staging folder for raw source files, such as `assets/_incoming/`. `buildos init` does not create one, and intake works from any source path the user gives, so a missing staging folder is not a blocker.
4. Check that the project wrapper `.os/scripts/buildos` exists (`.os\scripts\buildos.cmd` on Windows) and that `.os/scripts/buildos version` runs. The wrapper always runs the version pinned in `.os/manifest.json`: an npm install of exactly that version when there is one, else that version through `npx`; it needs Node.js 24 or newer. `buildos version` changes no file.
5. Read only the routers needed to identify boundaries and next-step commands.
6. Report:
   - workspace root,
   - available toolkit commands,
   - expected artifact paths,
   - active guardrails,
   - obvious blockers,
   - whether files were changed.

## Stop conditions

Stop after the readiness report. Do not run conversion, extraction, discovery, design, or validation unless the user starts a separate workflow.
