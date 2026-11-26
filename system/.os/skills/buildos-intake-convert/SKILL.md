---
name: buildos-intake-convert
description: Classify incoming Build OS source files, convert supported assets into provenance-stamped converted twins, handle manual fallbacks, and rebuild the references index. Use for one file or many files before extraction.
---

# Build OS Intake Conversion

Use this skill when a user gives source files to convert or asks to convert assets into Build OS converted twins. Use the source paths the user gives; they can be anywhere in the project. A staging folder such as `assets/_incoming/` is optional: `buildos init` does not create one. Create it only when the user wants one, and say so.

## Required routers and contracts

- `.os/AGENTS.md`
- `assets/AGENTS.md`
- `.os/contracts/converted-source-contract.md`
- `.os/contracts/intake-translation-contract.md`

## Rules

- Intake is not extraction.
- Do not mint requirements, capabilities, findings, test cases, or playbooks.
- Prefer deterministic `buildos intake convert` conversion, through the project wrapper `.os/scripts/buildos`.
- For `.msg` files, extract message body/content to Markdown or text before processing.
- For PDFs, use deterministic conversion when available; otherwise extract text manually only when the user approves or the tool cannot produce trustworthy output.
- Preserve source path, hash/provenance, converter, timestamp, type, and conversion status.

## Workflow

1. List source files in scope.
2. Classify each as deterministic, manual/guided, unsupported, duplicate, or blocked.
3. For deterministic files, run dry-run first.
4. Run real conversion only when dry-run is clean or the user approves an overwrite/force path.
5. For manual fallbacks, create converted twins only under the proper `assets/<source-slug>/` location.
6. Rebuild references (this writes `.os/indexes/references.json`; the file does not exist before the first rebuild):

   ```sh
   .os/scripts/buildos intake index references --repo-root . --assets-root assets --output .os/indexes/references.json
   ```

   On Windows, run `.os\scripts\buildos.cmd` with the same arguments.

7. Report:
   - source file,
   - classification,
   - converted output path,
   - references index path,
   - unsupported/blocked files.

## Single vs batch

- Single source: report one source decision and one converted output.
- Batch: report a table and keep blocked files separate from converted files.

## Stop conditions

Stop after references are rebuilt.
Do not perform extraction, row writing, discovery, docs routing, or playbook creation.
