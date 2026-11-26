<!-- make-docs:begin -->
# Agent Instructions

- When asked to create documentation for this project that is not `README.md`, read the same-named instruction file in `docs/` before writing.
- For documentation lifecycle order or skip/reorder/revisit decisions, use a valid local `.make-docs/system/references/lifecycle.md` first. If that body is absent, read `make-docs://system/reference/lifecycle.md` with `make-docs resource read`, and surface departures from the default arc.
- For governed work and material task updates, decisions, recommendations, error or limit reports, and completion replies, use the applicable lifecycle guidance plus valid local bodies for `.make-docs/system/contracts/human-experience-contract.md` and `.make-docs/system/references/human-experience.md`. If a body is absent, read its matching `make-docs://system/contract/human-experience-contract.md` or `make-docs://system/reference/human-experience.md` resource with `make-docs resource read`.
- A project can use Make Docs without Store access. If a Store-backed operation reports `store-not-configured`, `store-unavailable`, `store-unsafe`, or `store-denied`, stop only that operation, report its exact action, and continue independent Store-free work. Refresh access and retry only that operation after setup or repair. When the task repairs Make Docs setup, MCP, or Store access, missing Store or MCP access is evidence and must not block the repair.
- Before staging or committing changes, use a valid local `.make-docs/system/contracts/commit-message-convention.md` first. If that body is absent, read `make-docs://system/contract/commit-message-convention.md` with `make-docs resource read`.
- Do not infer optional Skills, plugins, Playbooks, Protocols, or unavailable policy from this router.
<!-- make-docs:end -->

# Agent Instructions

When asked to create documentation for this project that is not `README.md`, read `docs/AGENTS.md` before writing.

Do not create any new Python scripts. The only Python scripts allowed in this project will always be in `.make-docs/backup/2026-10-06T13-42-13.026Z/files/.make-docs/scripts/` (and these will be replaced at some point, so do not edit or add to them). The earlier exceptions, `system/.make-docs/scripts/` and `system/.os/scripts/validate_config.py`, were removed in W1 R7 P7: `buildos validate` replaces the validator.

## Source packages and initialized projects

This checkout builds BuildOS. It is not an initialized adopter project. Do not infer installed paths from this checkout's file tree.

| Source path in this checkout | Purpose | Use in an initialized project |
| --- | --- | --- |
| `system/` | Source package for the BuildOS filesystem | Its contents are placed at the project root. The `system/` directory itself is not installed. |
| `system/.os/skills/` | First-party BuildOS skills, the one source home (the top-level `skills/` folder was removed in W1 R7 P7) | `buildos init` copies them to `.os/skills/`. An agent installs one skill into its own app's location through `.os/skills/AGENTS.md`. Do not assume `.agents/skills/` or `.claude/skills/` exists in the target project. |
| `toolkits/` | Source of the `buildos` CLI, the npm package `build-os` (the Go toolkits were removed in W1 R7 P8) | Users run the published package through the project wrappers in `.os/scripts/` (`npx -y build-os@<version>`). Do not assume toolkit source exists in the target project. |
| `docs/` | BuildOS project design, planning, and work records | This checkout's project records are not adopter deliverables. |
| `system/docs/` | Removed in W1 R7 P7. The package no longer ships a copy of Make Docs content. | An initialized project gets `docs/` from Make Docs (`buildos init --make-docs`); Make Docs 2.0.9 keeps its own workflows, contracts, templates, and prompts under `.make-docs/system/`. Do not recreate `system/docs/`. |
| `.agents/skills/` | Skills used to work on this checkout | These are separate from the first-party skills under `system/.os/skills/`. Their presence does not prove product support or installation. |

## Path rules for agents

Before work, state whether the task changes a source package or operates an initialized project. Identify the target root and the audience for each instruction, command, link, and saved path.

- For maintainer file edits and source evidence in this checkout, use the real source path, such as `system/.os/contracts/entity-records-contract.md`.
- For shipped instructions, skill behavior, user commands, and new saved references, use initialized-project paths: `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/`. Do not add `system/` to those paths.
- Resolve Markdown links from the file that contains the link. A link inside the `system/` package must still work after the package contents move to a project root. It must not depend on this checkout's `docs/` or `toolkits/` directories.
- Keep the skill's own resource path separate from the project root it operates on. Use the harness's actual installed skill path. Do not derive it from the BuildOS project layout.
- When a command supports `--root` or `--repo-root`, read that command's current root contract. Do not assume all legacy tools accept the same root. Source-checkout examples must be marked as maintainer examples.
- Existing `system/` references in shipped instructions or record examples are path drift, not proof of the installed layout. Check the [Root and Path Contract](system/.os/contracts/root-and-path-contract.md). Report code that still enforces an old path instead of changing the target layout to fit it.
- Before closing a path-sensitive change, check links and outputs against a temporary initialized-project layout with no `system/` child. Passing checks in this checkout alone does not prove installed use.

Our end users are teams, people, and agents that use the initialized BuildOS files, installed toolkits, and first-party skills for discovery, requirements, design, product planning, and work backlogs. User guides live in `docs/assets/user/` in this checkout. Their normal instructions must use initialized-project paths.
