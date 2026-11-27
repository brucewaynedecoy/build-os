---
name: buildos-export-azure-boards
description: Convert Build OS docs/work backlog directories and phase/stage Markdown into hierarchical Azure Boards or Azure DevOps import CSV files with Epic, Feature, and Product Backlog Item rows, Title 1-3 hierarchy, normalized HTML Description and Acceptance Criteria fields, source traceability, and deterministic validation. Applies platform adapters, such as Dynamics 365 CE and Dataverse, that set the required work item title grammar, naming conventions, authoring depth, and property sets. Use when a user asks to export, refactor, reconcile, or prepare Build OS work backlogs for Azure Boards CSV import or update, or to draft platform requirements that follow a product's conventions.
---

# BuildOS Azure Boards Export

Convert one approved Build OS work backlog into a validated Azure Boards CSV. Preserve the source files. Do not modify `docs/work/` while exporting.

## Required workflow

1. Resolve the project root and the requested `docs/work/<backlog>/` directory. Work backlogs live in `docs/work/`, which exists when Make Docs is set up. If the project has no `docs/work/` or no backlog in it, stop and tell the user: the export needs an approved backlog.
2. Read every applicable `AGENTS.md` file, the backlog `00-index.md`, and all phase files in the selected directory.
3. Read [references/source-selection.md](references/source-selection.md). Stop if backlog authority or scope is unclear.
4. Read [references/backlog-mapping.md](references/backlog-mapping.md). Build the Epic, Feature, and Product Backlog Item row plan in source order.
5. Read [adapters/00-adapter-registry.md](adapters/00-adapter-registry.md). Select an adapter, confirm it with the user, and collect its required parameters. Stop if a required parameter is missing.
6. Read [references/writing-style.md](references/writing-style.md). Rewrite each selected stage into the required field grammar.
7. Read the selected adapter's files. Apply its classification, split, depth, property, and naming rules on top of the base grammar. Skip this step only when no adapter applies.
8. Read [references/azure-boards-csv-contract.md](references/azure-boards-csv-contract.md). Choose the correct import profile and create the structured JSON manifest.
9. Emit the CSV with `.os/scripts/buildos export azure-boards emit`.
10. Validate the CSV with `.os/scripts/buildos export azure-boards validate`.
11. Inspect the final CSV. Confirm the headers, row count, title hierarchy, and representative rich-text fields. Read the file as plain text, or with a CSV reader that treats every cell as text and never runs a formula. Do not open it in a spreadsheet program unless you trust every text in the manifest (see [CSV formula prefixes](#csv-formula-prefixes)).
12. Return the CSV, the selected profile, the selected adapter, item counts by type, unresolved adapter warnings, any excluded or blocked source material, and the [CSV formula prefixes](#csv-formula-prefixes) note.

Do not import or save work items in Azure Boards unless the user gives separate approval for that external change.

CSV delivery does not require Azure preview access. The Azure import preview is a gate before the separate action that saves work items in Azure Boards.

## Authority gate

Treat `docs/work/` as work history, not as one automatically executable backlog.

Proceed only when one backlog is clearly selected and its index permits the requested use. Stop and report the exact evidence when the selected backlog is:

- a candidate or planning artifact only;
- superseded or retained as history;
- blocked by owner, PRD, plan, acceptance, or repository-authority gates;
- incomplete or missing referenced phase files;
- in conflict with another active backlog; or
- outside the user's requested scope.

An export does not authorize implementation. Preserve gate language in the Azure item content when it constrains the work.

A completed backlog can be exported when the user selects it. Treat it as a historical backlog export, state the completion status in the Epic summary, and keep Azure `State` blank in a new-item profile.

## Default hierarchy

Use this mapping unless the user supplies a different target-process contract:

| Build OS source | Azure Boards type | Title column |
| --- | --- | --- |
| Selected work directory | Epic | `Title 1` |
| Phase file | Feature | `Title 2` |
| Stage section | Product Backlog Item | `Title 3` |
| Reserved future task row | Task | `Title 4` |

Write rows in preorder. Place each Feature after its Epic. Place each Product Backlog Item after its Feature. Populate exactly one `Title N` cell in each row.

Do not create Task rows by default. Fold phase-local task items into the Product Backlog Item `TECHNICAL DETAILS` section. Keep their stable `tN` identifiers.

## Adapters

An adapter adds target-platform authoring rules on top of this contract. The base skill decides which Build OS source becomes which Azure row. An adapter decides how deep each Description section must go, what property set each work item must carry, and what naming and title grammar the platform requires.

Use an adapter when the backlog describes work on a named commercial platform. Use no adapter for platform-neutral software work.

Registered adapters:

| Adapter id | Target platform |
| --- | --- |
| `dynamics-365-ce` | Microsoft Dynamics 365 Customer Engagement, Dataverse, and Power Platform |

Selection rules:

- Read [adapters/00-adapter-registry.md](adapters/00-adapter-registry.md) after backlog selection and before manifest creation.
- Scan the index, the phase files, and the referenced PRD titles for the registry's trigger signals.
- State the chosen adapter and its evidence. Get user confirmation. Never select an adapter silently.
- Stop and ask when two adapters match, or when a required adapter parameter is missing. Do not guess a parameter and do not reuse a value from an example.
- Apply one adapter to one export. An adapter covers the whole Epic, not one phase.
- Record the choice in the manifest as `adapter` and `adapter_params` so the export is auditable.

An adapter tightens the rules below. It never relaxes them. When an adapter rule and a base rule conflict on style, the adapter wins for content targeted at that platform, and the adapter states the deviation and its reason.

## Required Product Backlog Item fields

Create each Product Backlog Item from one Build OS stage.

The Description must contain these sections once and in this order:

1. `USE CASE`
2. `DESCRIPTION`
3. `TECHNICAL DETAILS`

The Acceptance Criteria must be an HTML unordered list of observable end states. Use nested lists only for conditions that belong to one parent result.

The Design Notes must contain a `BUILD OS SOURCE` trace with the work directory, phase file, stage name, and task IDs. Add source PRD paths when the phase supplies them.

Do not paste Markdown checkboxes into Azure fields. Do not invent technical details that the source does not support. Stop on a material content gap.

## Import profiles

Use `target17-new` by default for the approved Build OS target shape. It keeps the 17-column example contract and leaves `ID`, `State`, and `Assigned To` blank.

Use `new` when the target follows Microsoft's smaller new-item import contract and does not accept the blank compatibility columns.

Use `update` only when the user supplies valid existing Azure work item IDs or explicitly requests a mixed create/update file.

Never copy IDs, state values, iteration paths, tags, or identities from an unrelated source project. Treat source wave, revision, phase, status, and domain labels as tag candidates only. Put them in `Tags` only when the user or target process approves those exact values. Otherwise, leave `Tags` blank and keep the labels in the source trace when they help traceability.

## Deterministic commands

Create a manifest as described in [references/azure-boards-csv-contract.md](references/azure-boards-csv-contract.md), then run:

```sh
.os/scripts/buildos export azure-boards emit \
  --input <manifest.json> \
  --output <azure-boards-import.csv> \
  --profile target17-new

.os/scripts/buildos export azure-boards validate \
  --input <azure-boards-import.csv> \
  --profile target17-new
```

The emitter reads `adapter` and `adapter_params` from the manifest and runs the adapter checks during `emit`. Adapter errors block the write. To re-check a delivered CSV, name the adapter on `validate`:

```sh
.os/scripts/buildos export azure-boards validate \
  --input <azure-boards-import.csv> \
  --profile target17-new \
  --adapter dynamics-365-ce

.os/scripts/buildos export azure-boards adapters
```

Run these from the project root through the project wrapper (`.os\scripts\buildos.cmd` on Windows, with the same arguments). The command needs Node.js 24 or newer and nothing else. It reads only files inside the project, and it writes `--output` outside the project only with `--allow-outside-root`; use that only when the user asks for it. On Windows, write each command on one line: Command Prompt does not read the `\` line breaks above.

## Hard validation gates

Do not deliver the CSV unless all checks pass:

- The selected profile has the exact header order.
- The file has a UTF-8 byte-order mark.
- The file has 1 to 1,000 work item rows.
- Each row has exactly one populated title level.
- Every child follows a valid parent row.
- Work item type matches title level.
- Every Product Backlog Item has all three Description sections.
- Every Product Backlog Item has at least one Acceptance Criteria list item.
- HTML uses the supported tag set and has balanced tags.
- No `TODO`, `TBD`, template marker, or Markdown checkbox remains.
- New-item profiles contain no ID, state, or assigned-user values.
- Every Product Backlog Item contains Build OS source trace data.
- Description, Acceptance Criteria, and title refer to the same outcome.
- The selected adapter reports no errors.

When an adapter applies, also confirm:

- The manifest records the adapter and its parameters.
- Every adapter warning is either fixed or explained in the delivery report.
- Every item passes the adapter's self-review rubric.

The command checks structural rules and the adapter's deterministic rules. Perform the final cross-field meaning check yourself.

## CSV formula prefixes

The command adds no guard character to a field that starts with `=`, `+`, `-`, or `@`, so the file imports into Azure Boards unchanged. A spreadsheet program that opens the CSV may read such a field as a formula and run it. Import the file with Azure Boards' CSV import. To inspect it, read it as plain text or with a CSV reader that treats every cell as text. Open it in a spreadsheet program only when you trust every text in the manifest. Tell the user this when you deliver the CSV.

## Bundled resources

Paths below are inside this skill's folder (`.os/skills/buildos-export-azure-boards/` in a BuildOS project).

- [references/source-selection.md](references/source-selection.md): authority, scope, and exclusion rules.
- [references/backlog-mapping.md](references/backlog-mapping.md): source-to-row mapping and traceability.
- [references/writing-style.md](references/writing-style.md): required style, voice, HTML form, and examples.
- [references/azure-boards-csv-contract.md](references/azure-boards-csv-contract.md): profiles, manifest schema, commands, and validation.
- `assets/new-items-template.csv`: Microsoft-safe new-item header.
- `assets/target-17-column-template.csv`: the approved 17-column target header.
- `assets/synthetic-manifest.json`: synthetic source for a forward test.
- `assets/synthetic-golden-example.csv`: expected target-profile output from the synthetic manifest.
- [adapters/00-adapter-registry.md](adapters/00-adapter-registry.md): registered adapters, trigger signals, selection procedure, and how to add an adapter.
- [adapters/dynamics-365-ce/ADAPTER.md](adapters/dynamics-365-ce/ADAPTER.md): Dynamics 365 CE parameters, work type taxonomy, title grammar, text conventions, and checks.
- [adapters/dynamics-365-ce/authoring-depth.md](adapters/dynamics-365-ce/authoring-depth.md): how to classify, split, and judge the required depth of each section.
- [adapters/dynamics-365-ce/component-templates.md](adapters/dynamics-365-ce/component-templates.md): required property set for each Dynamics 365 CE component category.
- [adapters/dynamics-365-ce/examples.md](adapters/dynamics-365-ce/examples.md): worked CFG, DEV, and INT items.
- `assets/adapters/dynamics-365-ce-manifest.json`: synthetic Dynamics 365 CE source for a forward test.
- `assets/adapters/dynamics-365-ce-golden-example.csv`: expected output from that manifest.
