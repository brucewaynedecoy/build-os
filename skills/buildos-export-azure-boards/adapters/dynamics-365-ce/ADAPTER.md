# Adapter: Dynamics 365 CE

Adapter id: `dynamics-365-ce`

## Contents

- [Applies to](#applies-to)
- [Required parameters](#required-parameters)
- [Work type taxonomy](#work-type-taxonomy)
- [Title grammar](#title-grammar)
- [Text conventions](#text-conventions)
- [Section depth contract](#section-depth-contract)
- [Deterministic checks](#deterministic-checks)
- [Base-contract deviations](#base-contract-deviations)
- [Commands](#commands)
- [Bundled files](#bundled-files)

## Applies to

Microsoft Dynamics 365 Customer Engagement and the Dataverse and Power Platform components it is built on: tables, columns, relationships, forms, views, global choices, plug-ins, custom APIs, JavaScript web resources, helper libraries, Power Automate flows, external API integrations, data migration, security roles, field security profiles, business units, and teams.

Do not use this adapter for Dynamics 365 Finance and Operations. That platform has a different component model and a different work item shape.

## Required parameters

| Parameter | Required | Rule |
| --- | --- | --- |
| `publisher_prefix` | Yes | The organization's Dataverse publisher prefix, written with its trailing underscore, for example `jd_`. |

**Stop-and-ask gate.** When `publisher_prefix` is absent, stop before manifest creation and ask for it. State that the default `new_` prefix is never acceptable. Do not infer a prefix from the project name, from the repository, from an example in this skill, or from a prior export.

Accepted prefix form: two to eight leading characters, starting with a letter, followed by an underscore. Longer prefixes are permitted but reported as a warning because most organizations use two to five characters.

Rejected outright: `new_`, an empty value, a value without a trailing underscore, and a value containing a character outside `A-Z`, `a-z`, and `0-9`.

## Work type taxonomy

Every Product Backlog Item carries exactly one work type code.

| Code | Work type | Covers |
| --- | --- | --- |
| `CFG` | Configuration | Tables, columns, relationships, forms, views, global choices, business rules, app modules, and other no-code component work. |
| `DEV` | Development | Plug-ins, custom APIs and custom actions, JavaScript web resources, helper function libraries, and other custom-code work. |
| `INT` | Integration | Power Automate flows, external API integrations, connectors, and cross-system data flow. |
| `DATA` | Data | Migration, transformation, bulk load, cleansing, and reconciliation of records. |
| `SEC` | Security | Security roles, field security profiles, business units, teams, and access boundaries. |

**One code per work item.** A Build OS stage that mixes configuration and development becomes two or more Product Backlog Items. See [authoring-depth.md](authoring-depth.md) for the split rules and the classification decision table.

## Title grammar

```text
{Feature Name} ({CODE}) - {Short Description}
```

Rules:

- `Feature Name` is the business feature or module in Title Case, for example `Depreciation` or `Equipment Management`. Use the same feature name across every item in one Feature.
- `CODE` is one of `CFG`, `DEV`, `INT`, `DATA`, `SEC`, in capitals, in parentheses.
- The separator is a space, a hyphen, and a space.
- `Short Description` names the component being produced. For `DEV` items, lead with the component class, for example `Plugin: Do depreciation calculation by type`.

Examples:

- `Depreciation (CFG) - Create Global Choices`
- `Depreciation (DEV) - Plugin: Do depreciation calculation by type`
- `Depreciation (INT) - Power Automate: Scheduled depreciation calculation`
- `Equipment Management (DATA) - Migrate legacy equipment master records`
- `Depreciation (SEC) - Field security for cost columns`

Epic and Feature titles do not take the work type code. Feature titles carry the feature or phase name only.

## Text conventions

| Element | Convention | Example |
| --- | --- | --- |
| Tables and entities | Title Case, display name | `Equipment Move Requests` |
| System components and views | Title Case, display name | `All Active Accounts` |
| Field display names | Double quotes | `"Depreciation Type"` |
| Field logical names | Parentheses after the display name | `"Depreciation Type" (jd_depreciationtype)` |
| Schema names | `Schema: {prefix}{PascalCase}` | `Schema: jd_DepreciationType` |
| Logical names | `Logical Name: {prefix}{lowercase}` | `Logical Name: jd_depreciationtype` |
| Condition outcomes | Capitals, unquoted | `TRUE`, `FALSE`, `NULL`, `UNDEFINED` |
| UI actions | Capitals | `SHOW`, `HIDE`, `LOCK`, `UNLOCK` |
| String values | Lowercase inside double quotes | `"some text value"` |
| Choice values | Double quotes, source casing | `"Fixed"`, `"First of month"` |
| Conditional logic | Capitals, one clause per list item | `IF ... :`, `ELSE IF ... :`, `ELSE:` |
| Entity groups | Named group with its members in parentheses | `the sales lines group (Opportunity Line, Quote Item, Order Line)` |

The logical name is always the schema name in lowercase. Write both when the item creates or renames the component. Write the logical name alone when the item only references an existing component.

## Section depth contract

The base skill requires the three Description sections. This adapter sets what each section must **prove** before the item is implementable. The full rules, per work type, are in [authoring-depth.md](authoring-depth.md). The required property sets, per component category, are in [component-templates.md](component-templates.md).

Summary of the contract:

| Section | Must prove |
| --- | --- |
| `USE CASE` | Who needs the change, what business outcome it produces, and which downstream logic or process depends on it. Two to four bullets. No implementation steps. |
| `DESCRIPTION` | The component classes to be produced, the environment and solution they land in, and the scope boundary. Two to five bullets. No field-level detail. |
| `TECHNICAL DETAILS` | Every property an implementer needs to build the component without asking a question. Starts with the publisher prefix line. Uses the component category templates. Nested to the depth the component requires. |
| `Acceptance Criteria` | Existence, behavior, and deployment, at minimum. Integration and data-quality coverage when the work type requires them. |

`TECHNICAL DETAILS` is the section that fails most often. It is not a restatement of `DESCRIPTION` in more words. It is the property sheet. An item whose `TECHNICAL DETAILS` does not name a schema name, a trigger, a parameter set, a mapping, or a permission is not finished.

## Deterministic checks

`scripts/adapters/dynamics-365-ce.mjs` enforces these. They run in addition to the base structural checks.

Errors:

1. Every Product Backlog Item title matches the title grammar with a valid work type code.
2. The `TECHNICAL DETAILS` section's first list item is `Publisher Prefix: {prefix}`.
3. Every declared publisher prefix in the file is the same value.
4. The prefix matches the accepted prefix form.
5. The text `new_` does not appear as a prefix anywhere in the file.
6. Every `Schema:` value matches `{prefix}` followed by letters and digits.
7. Every `Logical Name:` value matches `{prefix}` followed by lowercase letters and digits.
8. A `Logical Name:` that follows a `Schema:` in the same nested group equals that schema name in lowercase.
9. No Markdown emphasis markers, `**` or `__`, and no Pandoc span syntax, `{.underline}`, remain in any field.
10. Every Product Backlog Item has at least two Acceptance Criteria items.
11. A `CFG`, `DEV`, or `INT` item declares at least one schema name, logical name, or named existing component in `TECHNICAL DETAILS`.

Warnings:

1. The publisher prefix is longer than five characters plus the underscore.
2. A list item starts with a lowercase `if`, `else if`, or `else`.
3. A condition outcome appears as `true`, `false`, or `null` in lowercase.
4. A `DEV` item does not name an execution mode of `Synchronous` or `Asynchronous`.
5. A `CFG` item that creates columns does not state a `Requirement:` value.
6. No Acceptance Criteria item mentions deployment, an environment, or a solution.

Warnings do not block delivery. Read every warning and either fix it or state why it is correct for this backlog.

## Base-contract deviations

The source specification uses Markdown emphasis for entity names and Pandoc underline spans for entity groups. Azure Boards fields in this skill are generated HTML restricted to `div`, `b`, `ul`, `li`, and `br`, and all manifest text is escaped. Inline emphasis inside a list item is therefore not available.

This adapter resolves that as follows:

- Entity and component names use Title Case and carry no emphasis markers. Title Case plus the quoting rules above is the distinguishing signal.
- Entity groups are written as a named group with its members in parentheses instead of an underline span.
- Literal `**` and `{.underline}` are validation errors, because they render as noise in Azure.

Everything else in the source specification is preserved.

## Commands

Emit with an adapter. The adapter and its parameters come from the manifest:

```sh
node skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs emit \
  --input <manifest.json> \
  --output <azure-boards-import.csv> \
  --profile target17-new
```

Validate with an adapter. The prefix is read from the file unless it is supplied:

```sh
node skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs validate \
  --input <azure-boards-import.csv> \
  --profile target17-new \
  --adapter dynamics-365-ce

node skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs validate \
  --input <azure-boards-import.csv> \
  --adapter dynamics-365-ce \
  --adapter-params '{"publisher_prefix":"jd_"}'
```

## Bundled files

- [authoring-depth.md](authoring-depth.md): classification, split rules, and the per-section and per-work-type depth rules. Read this before writing any item.
- [component-templates.md](component-templates.md): the required property set for each component category, with manifest shapes.
- [examples.md](examples.md): worked `CFG`, `DEV`, and `INT` items as manifest fragments.
- `../../assets/adapters/dynamics-365-ce-manifest.json`: a synthetic manifest that passes adapter validation.
