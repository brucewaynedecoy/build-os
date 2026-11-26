---
name: buildos-docs-handoff
description: Route durable Build OS knowledge into make-docs-managed documentation using local docs routers and the preferred designs-to-plans-to-PRDs-to-work-to-guides lifecycle.
---

# Build OS Docs Handoff

Use this skill when extracted or qualified Build OS knowledge should become durable documentation.

## Required routers

- `.os/AGENTS.md`
- `docs/AGENTS.md`, which exists when Make Docs is set up in the project. It names the docs folders this project has and how to create one that is missing.
- the target docs sub-router, if present, such as `docs/designs/AGENTS.md`, `docs/plans/AGENTS.md`, `docs/prd/AGENTS.md`, or `docs/work/AGENTS.md`. A folder with no router yet (for example a guides folder) is created only as `docs/AGENTS.md` says.

If the project has no `docs/AGENTS.md`, Make Docs is not set up there: do not create `docs/`; tell the user, and ask where the durable output should go or keep it in the reply.

## Lifecycle preference

Use this sequence unless the user explicitly chooses a different route:

1. Designs.
2. Plans.
3. PRDs.
4. Work backlogs.
5. Guides.

Guides may be created earlier when they help explain current product scope, persona-specific behavior, maintainer workflows, or user workflows.

## Workflow

1. Identify the source rows, findings, converted twins, playbooks, or run evidence.
2. Confirm whether the durable output should be:
   - design,
   - plan,
   - PRD/risk register,
   - work backlog,
   - user guide,
   - developer guide.
3. Read the target docs router and required templates/contracts.
4. Prefer updating existing docs when a doc already owns the topic.
5. Draft or update routed docs only after approval.
6. Preserve links back to Build OS rows, source twins, and run/finding evidence.

## Stop conditions

Stop after the approved routed doc update is complete.
Do not write under `docs/` by guessing, and do not create separate risk/question docs when the PRD register owns that purpose.
