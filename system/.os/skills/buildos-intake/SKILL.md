---
name: buildos-intake
description: Convert incoming Build OS assets into provenance-stamped converted twins and rebuild reference indexes. Use for deterministic bulk conversion and one-off/manual conversion fallbacks.
---

# Build OS Intake

Use this skill when the user gives source files to convert, or when a source needs a converted twin under `assets/<source-slug>/`. The sources can be anywhere in the project; use the paths the user gives. A staging folder such as `assets/_incoming/` is optional: `buildos init` does not create one. Create it only when the user wants one, and say so.

## Rules

- Read `.os/AGENTS.md`, `assets/AGENTS.md`, `.os/contracts/converted-source-contract.md`, and `.os/contracts/intake-translation-contract.md`.
- Intake is not extraction. Do not mint requirements, capabilities, findings, test cases, or playbooks in converted twins.
- Use deterministic `buildos intake convert` conversion for supported file types, through the project wrapper `.os/scripts/buildos`.
- For unsupported or inadequate files, create manual converted twins only when the user asks or the deterministic tool cannot produce a trustworthy result.
- Preserve provenance with `source`, `sha256`, `converter`, `timestamp`, `type`, and `status`.

## Deterministic conversion workflow

1. List the source files the user named, or the files in the project's staging folder if it has one (for example `assets/_incoming/`).
2. Classify supported deterministic converter inputs: CSV, DOCX, XLSX, PDF, HTML, and HTML directory.
3. For each supported source, run:

   ```sh
   .os/scripts/buildos intake convert --source <path> --repo-root . --assets-root assets --dry-run
   .os/scripts/buildos intake convert --source <path> --repo-root . --assets-root assets
   ```

   On Windows, run `.os\scripts\buildos.cmd` with the same arguments.

4. Rebuild references (this writes `.os/indexes/references.json`; the file does not exist before the first rebuild):

   ```sh
   .os/scripts/buildos intake index references --repo-root . --assets-root assets --output .os/indexes/references.json
   ```

5. Report converted paths and unsupported files.

## Manual conversion workflow

1. Confirm deterministic conversion failed, is unsupported, or produced inadequate output.
2. Create a converted twin under `assets/<source-slug>/<asset-slug>.<ext>`.
3. Mark `status: converted` only when trustworthy; otherwise use `candidate` or `rejected`.
4. Rebuild `references.json`.
5. Report the deterministic tooling gap and converted output path.

## Stop conditions

Stop after references are rebuilt. Do not perform extraction, discovery, qualification, or docs promotion in this skill.
