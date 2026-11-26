---
name: buildos-extract
description: Turn converted Build OS sources into reviewed extraction plans, structured rows, draft playbooks, or routed documentation. Use after intake when a converted twin contains requirements, capabilities, procedures, scenarios, or durable knowledge.
---

# Build OS Extraction

Use this skill when a converted twin under `assets/<source-slug>/` needs to feed structured data, draft playbooks, or routed docs.

## Rules

- Read `.os/AGENTS.md`, `.os/data/AGENTS.md`, and the relevant contracts before writing rows.
- Source anchors must point to converted twins, not raw incoming files.
- Do not write structured rows without identifying the target contract and receiving explicit approval when the row content is newly proposed.
- Keep new playbooks `status: draft` unless the user explicitly approves activation.
- Route all docs work through `docs/AGENTS.md`; do not write under `docs/` by guessing. If the project has no `docs/AGENTS.md`, Make Docs is not set up there: do not create `docs/`; tell the user, and ask where the durable output should go or keep it in the reply.

## Workflow

1. Inspect the selected converted twin and list candidate outputs:
   - requirements,
   - capabilities,
   - personas,
   - test cases,
   - results,
   - draft playbooks,
   - durable docs artifacts,
   - datasets or gap notes.
2. Identify the applicable contract and destination for each candidate.
3. Produce an extraction plan with:
   - source anchors,
   - target files,
   - proposed IDs or next-ID ranges,
   - duplicate risks,
   - review questions,
   - deterministic vs manual/guided status.
4. Proceed only with user-approved outputs.
5. For approved JSONL rows, append one object per line to the matching `.os/data/*.jsonl` file. Add or update an extraction row in `.os/data/extractions.jsonl`.
6. For approved playbooks, read `playbooks/AGENTS.md` and `.os/contracts/playbook-contract.md`, create draft playbooks, then run:

   ```sh
   .os/scripts/buildos intake index playbooks --repo-root . --playbooks-root playbooks --output .os/indexes/playbooks.json
   ```

   On Windows, run `.os\scripts\buildos.cmd` with the same arguments.

7. For approved docs artifacts, follow the selected docs router and template.

## Stop conditions

Stop before activating playbooks, qualifying findings, or promoting designs unless the user explicitly asks for that gate.
