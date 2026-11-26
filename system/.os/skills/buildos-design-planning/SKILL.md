---
name: buildos-design-planning
description: Promote qualified Build OS findings into routed design handoffs and continue into user-approved planning steps. Use after a finding has deterministic qualification evidence.
---

# Build OS Design and Planning

Use this skill when a qualified `FIND-NNN` should feed design, planning, PRD, work backlog, or roadmap activity.

## Rules

- Start from a qualified finding, not a raw observation.
- Read `.os/AGENTS.md`, `workspace/findings/AGENTS.md`, and, when Make Docs is set up (the project has `docs/AGENTS.md`), `docs/AGENTS.md` and the relevant docs workflow references before writing docs. Without Make Docs, `buildos design promote` stops and says so; report that to the user.
- Use `buildos design promote` through the project wrapper `.os/scripts/buildos`.
- Design promotion is user-gated.
- Downstream plans, PRDs, and work artifacts require explicit approval.

## Design handoff workflow

1. Inspect `.os/data/findings.jsonl` and the selected `workspace/findings/FIND-NNN/`.
2. Confirm the finding is qualified and has origin run, raw anchor, qualification test, systems, environments, and owners.
3. Ask or confirm the route: `baseline-plan` or `change-plan`.
4. Dry-run:

   ```sh
   .os/scripts/buildos design promote finding --finding-id <FIND-NNN> --route <baseline-plan|change-plan> --title "<title>" --slug <slug> --repo-root . --dry-run
   ```

   On Windows, run `.os\scripts\buildos.cmd` with the same arguments.

5. Report the planned design path and lineage.
6. Wait for approval, then run the non-dry-run command.
7. Report the generated design path and finding back-reference.

## Downstream planning workflow

1. Read the design's intended follow-on section.
2. Explain the next routed planning path and which parts are deterministic vs manual/guided.
3. Wait for approval before creating the next artifact.
4. Preserve links back to the design and qualified finding.

## Stop conditions

Stop after the approved design or next routed artifact is created. Do not invent unsupported stage automation.
