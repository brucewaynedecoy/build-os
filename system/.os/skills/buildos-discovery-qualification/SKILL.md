---
name: buildos-discovery-qualification
description: Guide Build OS discovery/test runs, record evidence, create run/result records, and qualify findings only when confirmation evidence supports them.
---

# Build OS Discovery Qualification

Use this skill when a playbook run, test, or discovery workflow should create evidence or qualify findings.

## Required routers and contracts

- `.os/AGENTS.md`
- `playbooks/AGENTS.md`
- `workspace/runs/AGENTS.md`
- `workspace/findings/AGENTS.md`
- `.os/contracts/entity-records-contract.md`

## Rules

- Only active playbooks are runnable unless the user is explicitly reviewing a draft manually.
- Do not fabricate evidence.
- Candidate findings are not qualified findings.
- Qualification requires recorded evidence and a repeatable confirmation path.
- Native mobile workflows are human-primary unless a browser-accessible surface exists.
- For browser exploration that should become deterministic Playwright automation, route to `buildos-browser-to-playwright`.

## Workflow

1. Confirm target playbook/test/source and whether it is runnable.
2. Capture input context, evidence paths, screenshots/notes, and outcome.
3. Record run/result rows or run artifacts according to the active Build OS workflow.
4. Draft candidate findings with basis refs.
5. For qualification, propose a confirmation test and ask for approval.
6. Write or update `FIND` rows only when confirmation evidence exists.
7. Report run ID, result IDs, finding IDs, and blocked follow-ups.

## Stop conditions

Stop when the run/result/finding gate is complete.
Route docs promotion to `buildos-docs-handoff`.
