---
name: buildos-reporting
description: Generate read-only Build OS progress reports, gap tables, assertion coverage, and dashboard snapshots from local indexes, data rows, runs, and findings.
---

# Build OS Reporting

Use this skill when the user asks for progress visibility, gap tracking, roadmap status, assertion coverage, or a dashboard refresh.

## Rules

- Reports are derived readouts. Do not treat report output as canonical.
- Read from `.os/indexes/`, `.os/data/`, `workspace/runs/`, and `workspace/findings/`.
- Do not write under `docs/` or `.make-docs/` (they exist only when Make Docs is set up).
- Do not invent missing statuses. Show unknown, draft, inconclusive, or blocked explicitly.

## Workflow

1. Read the sources listed in Rules directly. This is the default for any progress or status request, and it writes nothing.
2. BuildOS ships no report generator. Run the project's own report script, or any other step that writes files, only when the user asks for those report files or that dashboard, and then only outside `docs/` and `.make-docs/`.
3. Summarize:
   - reference count and converted source status,
   - playbook counts by status and runnable state,
   - requirements/capabilities/test-case coverage,
   - extraction rows and minted entities,
   - runs by outcome,
   - findings by status,
   - open raw findings,
   - gaps and assertions needing evidence.
4. If the user asked for the project's report files and its script wrote a dashboard, open it when the user asks.

## Stop conditions

Stop after report/dashboard refresh and summary. Do not change Build OS source artifacts unless the user starts a separate workflow.
