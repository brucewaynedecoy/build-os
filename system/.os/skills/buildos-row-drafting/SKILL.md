---
name: buildos-row-drafting
description: Draft new Build OS JSONL rows for requirements, capabilities, personas, test cases, extraction provenance, runs, results, and evidence-backed findings using explicit approval gates.
---

# Build OS Row Drafting

Use this skill to draft source-backed Build OS rows within the approved work scope.

## Required contracts

- `.os/contracts/entity-records-contract.md`
- `.os/contracts/extraction-contract.md`
- `.os/data/AGENTS.md`

## Rules

- Use the next available sequence for each prefix.
- Source anchors must point to converted twins, not raw incoming files.
- Draft exact JSONL rows before writing when the user has not already approved row writes.
- Do not write findings unless there is recorded run/result evidence.
- Keep one JSON object per line.
- Do not overwrite unrelated rows.

## Workflow

1. Read existing `.os/data/*.jsonl` rows and list used IDs.
2. Review approved extraction plan outputs.
3. Draft rows by type:
   - `REQ` for normative behavior,
   - `CAP` for descriptive capabilities,
   - `PER` for personas,
   - `TC` for repeatable verification,
   - `EXT` for extraction provenance,
   - `RUN` and `RES` only when actual execution evidence exists,
   - `FIND` only when evidence supports the finding.
4. Run duplicate checks:
   - same ID,
   - same title/summary,
   - source anchor overlap,
   - new-vs-update decision.
5. Ask for explicit row-write approval unless already granted.
6. Write approved rows to the matching `.os/data/*.jsonl` file. Preserve unrelated rows.
7. Validate JSONL parsing.

## Stop conditions

Stop after rows are drafted or written and validated.
Route updates to existing rows through `buildos-row-maintenance` when the main task is reconciliation rather than new row creation.
