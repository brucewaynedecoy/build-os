# Azure Boards CSV Contract

## Contents

- [Profiles](#profiles)
- [Manifest schema](#manifest-schema)
- [Structured list values](#structured-list-values)
- [Optional item fields](#optional-item-fields)
- [Commands](#commands)
- [Encoding rules](#encoding-rules)
- [Validation split](#validation-split)

## Profiles

### `target17-new`

Use this profile for the approved 17-column Build OS target shape. It preserves these columns in this order:

```text
ID,Work Item Type,Title 1,Title 2,Title 3,Title 4,State,Effort,Iteration Path,Repro Steps,Description,Acceptance Criteria,Design Notes,Solution,Solution Type,Tags,Assigned To
```

Every `ID`, `State`, and `Assigned To` value must be blank. CSV delivery can occur without Azure access. Run an Azure import preview before the separate action that saves items.

### `new`

Use this profile when the target follows the smaller Microsoft new-item contract:

```text
Work Item Type,Title 1,Title 2,Title 3,Title 4,Effort,Iteration Path,Repro Steps,Description,Acceptance Criteria,Design Notes,Solution,Solution Type,Tags
```

This profile omits `ID`, `State`, and `Assigned To`.

### `update`

Use the 17-column shape for existing-item updates or mixed create/update work. Existing rows can have IDs. New rows must leave IDs blank.

Use this profile only with explicit user intent and target-project values.

## Manifest schema

The emitter accepts one JSON object:

```json
{
  "profile": "target17-new",
  "defaults": {
    "iteration_path": "Target Project\\Backlog",
    "tags": ["BuildOS"]
  },
  "items": [
    {
      "work_item_type": "Epic",
      "level": 1,
      "title": "Example backlog",
      "summary": "One approved Build OS backlog.",
      "source_trace": {
        "work_directory": "docs/work/2026-08-18-w1-r0-example",
        "index_file": "docs/work/2026-08-18-w1-r0-example/00-index.md",
        "labels": ["W1", "R0", "Approved"]
      }
    },
    {
      "work_item_type": "Product Backlog Item",
      "level": 3,
      "title": "Emit the import file",
      "description": {
        "use_case": ["The delivery owner needs one validated import file."],
        "outcomes": ["Create the Azure Boards CSV."],
        "technical_details": [
          {
            "text": "t1: Emit the CSV.",
            "children": ["Use the selected target profile."]
          }
        ]
      },
      "acceptance_criteria": [
        "The CSV passes the structural validator."
      ],
      "source_trace": {
        "work_directory": "docs/work/2026-08-18-w1-r0-example",
        "phase_file": "docs/work/2026-08-18-w1-r0-example/01-export.md",
        "stage": "Stage 1 - Emit the import file",
        "task_ids": ["t1"],
        "source_prd_docs": ["docs/prd/20-example.md"],
        "labels": ["Phase 1", "Export"]
      }
    }
  ]
}
```

Use `source_trace.labels` for useful source labels that do not have approved Azure `Tags` values. The emitter writes them into the `BUILD OS SOURCE` list in Design Notes.

## Structured list values

`use_case`, `outcomes`, `technical_details`, and `acceptance_criteria` accept strings or nested objects:

```json
{
  "text": "One parent result.",
  "children": [
    "First required condition.",
    "Second required condition."
  ]
}
```

Do not put raw HTML in the manifest. The emitter escapes all text and creates the HTML.

## Optional item fields

The emitter accepts:

- `id`
- `state`
- `effort`
- `iteration_path`
- `repro_steps`
- `solution`
- `solution_type`
- `tags`
- `assigned_to`

Use target-project values only. `tags` can be a string or an array.

## Commands

Emit:

```sh
node scripts/azure_boards_csv.mjs emit \
  --input assets/synthetic-manifest.json \
  --output /tmp/azure-boards.csv \
  --profile target17-new
```

Validate:

```sh
node scripts/azure_boards_csv.mjs validate \
  --input /tmp/azure-boards.csv \
  --profile target17-new
```

Create a header-only target template:

```sh
node scripts/azure_boards_csv.mjs template \
  --output /tmp/azure-boards-template.csv \
  --profile target17-new
```

## Encoding rules

The emitter writes:

- UTF-8 with a byte-order mark;
- exact profile header order;
- comma delimiters;
- doubled quotes inside quoted fields;
- CRLF record separators;
- no terminal blank record.

It quotes fields that contain commas, quotes, carriage returns, or line feeds.

## Validation split

The script validates deterministic structure. The agent validates meaning.

The script checks:

- encoding and headers;
- row width and count;
- title-level hierarchy;
- type-to-level mapping;
- new-item field safety;
- Description headings;
- Acceptance Criteria list form;
- supported and balanced HTML;
- placeholders and Markdown checkboxes;
- Build OS source trace.

The agent checks:

- authority and scope;
- complete source coverage;
- writing style and voice;
- cross-field consistency;
- target-process field values;
- Azure import preview results before saving work items. Preview access is not a CSV delivery gate.
