---
name: buildos-workflow
description: Low-friction Build OS workflow router. Use when a user asks to process assets, extract rows, update records, create playbooks, route docs, run discovery, validate artifacts, or report progress without naming a specific skill.
---

# Build OS Workflow Router

Use this skill as the default entry point for Build OS work.
Users should be able to describe the outcome they want; the agent chooses the right sub-workflow and asks only for missing inputs or approval gates.

## Route by intent

| User intent | Route |
| --- | --- |
| "Intake these files", "convert incoming assets" | `buildos-intake-convert` |
| "Check converted twins", "what sources are usable?" | `buildos-reference-review` |
| "Extract what we can", "make an extraction plan" | `buildos-extraction-plan` |
| "Draft rows", "create requirements/capabilities/tests" | `buildos-row-drafting` |
| "Update existing rows", "dedupe rows", "merge new evidence" | `buildos-row-maintenance` |
| "Create playbooks from scenarios" | `buildos-playbook-drafting` |
| "Run discovery", "qualify finding", "record evidence" | `buildos-discovery-qualification` |
| "Use the browser", "write a Playwright test", "turn browser discovery into a deterministic test" | `buildos-browser-to-playwright` |
| "Turn this into docs", "make durable docs" | `buildos-docs-handoff` |
| "Validate", "refresh dashboard", "show progress" | `buildos-validation-reporting` |

## Always start here

1. Read `.os/AGENTS.md`.
2. Inspect the user's request for:
   - source scope: one file, one converted twin, selected rows, all incoming files, or a batch,
   - desired outputs: references, data rows, playbooks, docs, findings, reports,
   - write permission: plan-only, draft-only, or approved writes.
3. Select the smallest skill that can complete the next safe step.
4. Preserve Build OS boundaries:
   - intake is not extraction,
   - extraction is not finding qualification,
   - docs route through `docs/AGENTS.md` when Make Docs is set up (the project has that file); without it, do not create `docs/`, and ask the user where durable docs belong,
   - deterministic test scripts follow the project's existing test layout, and its test router (such as `workspace/tests/AGENTS.md`) if it has one; BuildOS ships none,
   - new playbooks stay `status: draft`,
   - findings require recorded evidence.

## Approval gates

Stop and ask before:

- writing or updating `.os/data/*.jsonl`,
- creating or updating docs under `docs/`,
- activating playbooks,
- qualifying findings,
- running destructive or environment-changing actions,
- proceeding from an extraction plan into row/playbook/doc creation.

## Batch behavior

For multiple inputs, keep a short visible work state:

- source list,
- per-source conversion/reference status,
- duplicate/update risks,
- proposed outputs,
- approved outputs,
- validation results,
- blocked follow-ups.

## Stop conditions

Stop when the requested outcome is complete, an approval gate is reached, or a required input/tool/access is missing.
Report the next exact skill or workflow step rather than guessing.
