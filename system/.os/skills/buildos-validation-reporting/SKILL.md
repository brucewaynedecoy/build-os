---
name: buildos-validation-reporting
description: Validate Build OS data rows, playbook indexes, skill pack metadata, docs links, and refresh read-only progress reports or dashboard output.
---

# Build OS Validation Reporting

Use this skill after row, playbook, docs, intake, or skill-pack changes.

## Workflow

1. Run `.os/scripts/buildos validate` from the project root (`.os\scripts\buildos.cmd validate` on Windows). It checks the config, the scoped frontmatter of playbooks and playbook templates, and every entity file in `.os/data/`, and changes no file. Exit `0` means no problem; exit `4` lists each problem with its file, field, and fix. Do not add empty companion files.
2. Run `.os/scripts/buildos entities validate --root . --mode compat` to check entity IDs and links across the data rows, duplicate IDs included.
3. Rebuild the references or playbook index when their source artifacts changed (`.os/scripts/buildos intake index references --repo-root . --assets-root assets --output .os/indexes/references.json` or `.os/scripts/buildos intake index playbooks --repo-root . --playbooks-root playbooks --output .os/indexes/playbooks.json`).
4. Validate new playbooks appear in `.os/indexes/playbooks.json`.
5. When skills changed, check each changed skill folder: it has a `SKILL.md` whose frontmatter has `name` equal to the folder name and a non-empty `description`.
6. Refresh reports through `buildos-reporting` when BuildOS source data changed.
7. Report validation status, warnings, and blocked checks.

## Rules

- Reports are read-only derived outputs. Normal reports read canonical data only, never staged proposals.
- After staged application, verify the receipt and exact canonical read-back. A passing check is not user acceptance or cleanup approval.
- Do not invent statuses for missing data.
- If a platform-specific validator cannot run locally, state the exact command the user should run.

## Stop conditions

Stop after validation/reporting outputs are produced and summarized.
