# Source Selection

## Purpose

Select one coherent Build OS work backlog without changing source authority. Treat the export as a derived artifact.

## Required reads

Start at the project root. Read:

1. Root and scoped `AGENTS.md` files.
2. `docs/AGENTS.md` and `docs/work/AGENTS.md` when present.
3. The selected work directory's `00-index.md`.
4. Every phase file listed in its Phase Map.
5. Each phase's `Source PRD Docs` when a task or criterion cannot be understood from the phase file alone.
6. Referenced plan or PRD status only when the index makes it a gate.

Use indexed project-document tools when available. Refresh a stale index before direct file fallback.

## Selection rules

Accept a work directory only when all conditions are true:

- The user named it, or the current authority clearly identifies it.
- Its index and phase map agree on the phase files.
- Each referenced phase file exists.
- The phase and stage order is clear.
- The export scope does not combine unrelated waves or revisions.
- The requested output does not erase gate or dependency meaning.

If several plausible directories exist, show their titles and status evidence. Ask the user to select one. Do not choose by date alone.

## Status rules

Do not treat these labels as executable authority:

- candidate;
- planning artifact only;
- draft awaiting approval;
- superseded;
- historical or compatibility evidence;
- retained but not executed;
- blocked;
- requires separate implementation instruction.

The user can still ask for a planning, review, or historical export. In that case, keep the status in the Epic summary and in `source_trace.labels`. Add it to `Tags` only when the user or target process approves that exact tag value. Do not present it as an executable backlog.

## Scope inventory

Build a read-only inventory before rewriting:

| Source | Required data |
| --- | --- |
| Work index | backlog title, purpose, status, phase order, usage notes |
| Phase file | phase number, title, purpose, overview, source PRDs |
| Stage | stage number, title, tasks, acceptance criteria, dependencies |
| Task | stable `tN` ID, completion state, action text |

Record exclusions with the source path and reason. Do not silently omit a phase, stage, task, or acceptance criterion.

## Stop conditions

Stop before manifest creation when:

- a phase listed by the index is missing;
- two indexes claim the same execution coordinate;
- a stage lacks tasks or acceptance criteria;
- task IDs are missing, repeated, or reset incorrectly;
- source documents disagree on a material outcome;
- source status cannot be represented safely; or
- the result would exceed 1,000 Azure rows and cannot split at an Epic boundary.
