---
name: buildos-extraction-plan
description: Create an approval-gated extraction plan for one or many converted twins, identifying data rows, draft playbooks, docs artifacts, findings candidates, duplicate risks, and deterministic vs manual steps.
---

# Build OS Extraction Plan

Use this skill when converted twins should be reviewed before writing rows, playbooks, docs, or findings.

## Required routers and contracts

- `.os/AGENTS.md`
- `.os/data/AGENTS.md`
- `.os/contracts/entity-records-contract.md`
- `.os/contracts/extraction-contract.md`
- `.os/contracts/playbook-contract.md`
- `playbooks/AGENTS.md` when playbooks are possible
- `docs/AGENTS.md` when docs are possible, when Make Docs is set up (the project has that file); otherwise list doc outputs as a question for the user

## Workflow

1. Confirm source scope:
   - one converted twin,
   - selected references,
   - all converted twins,
   - or a named batch.
2. Inventory candidate outputs:
   - requirements,
   - capabilities,
   - personas,
   - test cases,
   - results/runs/findings,
   - draft playbooks,
   - docs artifacts,
   - reports/tables.
3. For each output, state:
   - target contract,
   - target file/path,
   - source anchors,
   - deterministic vs manual/guided status,
   - duplicate/update risks,
   - required approvals,
   - the review and write steps needed for the selected outputs.
4. Recommend a scope:
   - MVP-first,
   - source-by-source,
   - all approved outputs,
   - docs-only,
   - playbooks-only,
   - rows-only.
5. Use the authority given for this work. Ask before a write only when that authority is missing.

## Stop conditions

Stop at the plan/approval gate.
Do not write `.os/data/*.jsonl`, playbooks, docs, or findings as part of plan creation.
