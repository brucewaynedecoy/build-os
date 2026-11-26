---
name: buildos-playbook-drafting
description: Create or update draft Build OS playbooks from scenarios, tests, discoveries, or procedures while preserving the review-to-activate gate.
---

# Build OS Playbook Drafting

Use this skill when scenarios or repeated processes should become draft playbooks.

## Required routers and contracts

- `.os/AGENTS.md`
- `playbooks/AGENTS.md`
- `.os/contracts/playbook-contract.md`
- matching `.os/templates/*playbook*.md`

## Rules

- New playbooks must use `status: draft`.
- Do not activate playbooks unless the user explicitly approves the review-to-activate gate.
- Use valid configured `systems`, `environments`, and `owners` from `.os/config/instance.yaml`.
- Place playbooks in the directory matching their category.

## Workflow

1. Identify playbook purpose, category, harness, audience, targets, and produces.
2. Choose execution mode:
   - `explicit-steps`,
   - `guided-objective`,
   - `inferred-actions`,
   - or `n/a` for guardrails.
3. Draft frontmatter and required body sections.
4. Link source anchors and related rows.
5. Create/update approved draft playbooks.
6. Rebuild playbook index:

   ```sh
   .os/scripts/buildos intake index playbooks --repo-root . --playbooks-root playbooks --output .os/indexes/playbooks.json
   ```

   On Windows, run `.os\scripts\buildos.cmd` with the same arguments.

7. Validate the new playbooks appear in `.os/indexes/playbooks.json`.

## Stop conditions

Stop after draft playbooks and the playbook index are updated.
Do not run draft playbooks.
