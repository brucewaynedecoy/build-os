---
name: buildos-row-maintenance
description: Update, reconcile, deduplicate, or supersede existing Build OS rows from new evidence while preserving traceability and contract compliance.
---

# Build OS Row Maintenance

Use this skill when new evidence should update existing rows rather than create only new rows.

## Inputs

- Existing row IDs,
- source refs or converted twins,
- duplicate-risk report,
- user request to merge, update, reconcile, or maintain rows.

## Workflow

1. Read `.os/AGENTS.md`, `.os/data/AGENTS.md`, and relevant row contracts.
2. Load existing rows in scope.
3. Compare new evidence against current row fields:
   - `summary`,
   - `description` or `statement`,
   - `source_anchor`,
   - `source_refs`,
   - `related`,
   - `supports`,
   - `limits`,
   - `acceptance_refs`,
   - status.
4. Classify each proposed change:
   - update existing,
   - create new,
   - add related link only,
   - no-op duplicate,
   - defer pending evidence.
5. Draft exact updates and explain why they are not destructive.
6. Ask for explicit approval before writing.
7. Validate approved changes against current rows. Preserve unknown fields and unrelated rows.

## Stop conditions

Stop after approved row updates are applied and validated, or when unresolved duplicate/scope decisions require user input.
