# Component Templates: Dynamics 365 CE

Example identifiers, paths, and environment names are illustrative. Replace them with source-backed values from the selected project; they are not defaults.

## Purpose

The required property set for each Dynamics 365 CE component category, and the manifest shape that produces it.

Use this file as a checklist while writing `TECHNICAL DETAILS`. A property marked **Required** must appear. A property marked **Conditional** must appear when its condition is true. Omitting a required property is a source gap, not a style choice.

## Contents

- [Manifest shape](#manifest-shape)
- [Configuration: tables](#configuration-tables)
- [Configuration: columns](#configuration-columns)
- [Configuration: relationships](#configuration-relationships)
- [Configuration: global choices](#configuration-global-choices)
- [Configuration: forms](#configuration-forms)
- [Configuration: views](#configuration-views)
- [Development: plug-ins](#development-plug-ins)
- [Development: custom APIs and actions](#development-custom-apis-and-actions)
- [Development: JavaScript web resources](#development-javascript-web-resources)
- [Development: helper libraries](#development-helper-libraries)
- [Integration: Power Automate flows](#integration-power-automate-flows)
- [Integration: external APIs](#integration-external-apis)
- [Data operations](#data-operations)
- [Security](#security)
- [Conditional logic form](#conditional-logic-form)

## Manifest shape

`TECHNICAL DETAILS` is `description.technical_details` in the manifest. Nesting is `{ "text": ..., "children": [...] }`. The emitter escapes all text and builds the HTML.

Every item begins with the prefix line:

```json
"technical_details": [
  "Publisher Prefix: ex_",
  {
    "text": "Example Development -> Lending -> Tables:",
    "children": [
      {
        "text": "Create table:",
        "children": [
          { "text": "Lending Fine Line:", "children": ["Schema: ex_LendingFineLine"] }
        ]
      }
    ]
  }
]
```

Keep the location path as the first nested group after the prefix line.

## Configuration: tables

| Property | Status | Form |
| --- | --- | --- |
| Display name | Required | `Name: Lending Fine Line` |
| Plural display name | Required | `Plural: Lending Fine Lines` |
| Schema | Required | `Schema: ex_LendingFineLine` |
| Logical name | Required | `Logical Name: ex_lendingfineline` |
| Description | Required | `Description: One calculated fine result for one book copy record.` |
| Ownership | Required | `Ownership: User or Team` |
| Primary column | Required | `Primary Column: "Name" (ex_name), Text, 100` |
| Enabled features | Conditional when the source enables them | `Enable: Notes, Activities, Auditing` |
| New or modified | Conditional when the table exists | `Existing table. Modify only.` |

```text
Create table:
  Name: Lending Fine Line
  Plural: Lending Fine Lines
  Schema: ex_LendingFineLine
  Logical Name: ex_lendingfineline
  Description: One calculated fine result for one book copy record.
  Ownership: User or Team
  Primary Column: "Name" (ex_name), Text, 100
```

## Configuration: columns

| Property | Status | Form |
| --- | --- | --- |
| Display name | Required | `"Fine Type"` as the group heading |
| Schema | Required | `Schema: ex_FineType` |
| Logical name | Required | `Logical Name: ex_finetype` |
| Description | Required | `Description: Selects the calculation method for the lending policy.` |
| Type | Required | `Type: Choice, global choice ex_LendingFineTypes` |
| Requirement | Required | `Requirement: Business Required` or `Requirement: Not required` |
| Precision, length, or target | Conditional by type | `Type: Decimal, precision 2` / `Type: Text, 200` / `Type: Lookup, Book Copy` |
| Minimum | Conditional for numeric types when the source sets one | `Min: 0` |
| Maximum | Conditional for numeric types when the source sets one | `Max: 1000000` |
| Default | Conditional when the source sets one | `Default: 0` |
| Auditing or searchable | Conditional when the source sets them | `Auditing: Enabled` |

Type must be exact. `Type: Number` is not sufficient. Use `Whole Number`, `Decimal, precision 2`, `Currency`, `Text, 200`, `Multiline Text, 2000`, `Choice, global choice {schema}`, `Choice, local`, `Yes/No`, `Date Only`, `Date and Time`, `Lookup, {Target Table}`, or `File`.

```text
Create columns:
  "Fine Type":
    Schema: ex_FineType
    Logical Name: ex_finetype
    Description: Selects the calculation method for the lending policy.
    Type: Choice, global choice ex_LendingFineTypes
    Requirement: Business Required
  "Fine Cap":
    Schema: ex_FineCap
    Logical Name: ex_finecap
    Description: Highest fine that one loan may reach. Empty means no cap.
    Type: Currency
    Requirement: Not required
    Min: 0
```

## Configuration: relationships

| Property | Status | Form |
| --- | --- | --- |
| Type | Required | `Type: Many-to-One` |
| Primary table | Required | `Primary Table: Book Copy` |
| Related table | Required | `Related Table: Lending Fine Line` |
| Lookup column | Required | `Lookup Column: "Book Copy" (ex_bookcopy)` |
| Schema | Required | `Schema: ex_LendingFineLine_BookCopy` |
| Delete behavior | Required | `Behavior: Restrict Delete` |
| Requirement | Required | `Requirement: Business Required` |

## Configuration: global choices

| Property | Status | Form |
| --- | --- | --- |
| Display name | Required | Group heading, `Lending Fine Types:` |
| Schema | Required | `Schema: ex_LendingFineTypes` |
| Logical name | Required | `Logical Name: ex_lendingfinetypes` |
| Description | Required | `Description: Classifies how a lending policy charges fines.` |
| Options | Required | One nested item per option, in source order |
| Option values | Conditional when the source or downstream logic pins integer values | `Flat, value 100000000` |

```text
Create global choices:
  Lending Fine Types:
    Schema: ex_LendingFineTypes
    Logical Name: ex_lendingfinetypes
    Description: Classifies how a lending policy charges fines.
    Choices:
      Flat
      Daily
      Capped
```

## Configuration: forms

| Property | Status | Form |
| --- | --- | --- |
| Target form | Required | `Form: Lending Fine Line, Main` |
| Rename | Conditional | `Rename the main form from "Information" to "Fine Line".` |
| Tab work | Conditional | `Relabel the first tab from "General" to "Fine".` |
| Tab technical name | Conditional when a tab is renamed or created | `Set the tab Name to tab_fine.` |
| Column placement | Required when columns are added | `Add "Fine Type" (ex_finetype) to the Fine tab.` |
| Moves | Conditional | `Move "Owner" (ownerid) to the Administration tab.` |
| Visibility | Conditional | `HIDE the Related tab.` |
| Order | Conditional when order matters | `Order the Fine tab columns as listed.` |

## Configuration: views

| Property | Status | Form |
| --- | --- | --- |
| Target views | Required | `Views: Active Lending Fine Lines, All Lending Fine Lines` |
| Added columns | Required when columns are added | `Add all custom columns to each system view except the Lookup view.` |
| Removed columns | Conditional | `Remove "Created On" (createdon) from the system views.` |
| Lookup view | Required | State explicitly whether the Lookup view is included or excluded. |
| Sort | Conditional | `Sort by "Calculated On" (ex_calculatedon) descending.` |
| Filter | Conditional | `Filter: ex_statuscode == "Active"` |

## Development: plug-ins

| Property | Status | Form |
| --- | --- | --- |
| Table | Required | `Entity: Lending Fine Line` or `Entity: None` |
| Message | Required | `Message: Create` |
| Stage | Required | `Stage: Post Operation` |
| Execution | Required | `Execution: Synchronous` |
| Filtering columns | Required for `Update` messages | `Columns: ex_bookcopy, ex_loan` |
| Pre-image | Conditional | `Pre Image: ex_replacementvalue, ex_finebalance` |
| Post-image | Conditional | `Post Image: ex_calculatedvalue` |
| Assembly and class | Conditional when the source names them | `Assembly: Example.Lending.Plugins, Class: FineCalculator` |
| Logic | Required | An ordered nested list of retrieves, branches, and writes |
| Error behavior | Conditional when the source defines it | `On a missing lending policy, throw InvalidPluginExecutionException with a user message.` |

Every retrieve names its path and its columns. Every write names its target table and column.

```text
Create a plug-in:
  Entity: Lending Fine Line
  Message: Create
  Stage: Post Operation
  Execution: Synchronous
  Columns: ex_lendingfinelog, ex_bookcopy, ex_loan
  Logic:
    Retrieve from the Lending Policy (ex_lendingfinelog > ex_lendingpolicy):
      "Fine Type" (ex_finetype)
      "Fine Cap" (ex_finecap)
    IF "Fine Type" == "Flat":
      Call helper function CalculateFineByFlatRate.
    ELSE IF "Fine Type" == "Daily":
      Call helper function CalculateFineByDaysOverdue.
    ELSE:
      Write no value and exit.
    Update the Book Copy record column "Fine Balance" (ex_finebalance).
```

## Development: custom APIs and actions

| Property | Status | Form |
| --- | --- | --- |
| Label | Required | `Label: Generate Lending Fine Logs` |
| Schema | Required | `Schema: ex_GenerateLendingFineLogs` |
| Logical name | Required | `Logical Name: ex_generatelendingfinelogs` |
| Binding | Required | `Binding: Unbound` or `Binding: Entity, Lending Policy` |
| Type | Required | `Type: Action` or `Type: Function` |
| Execution | Required | `Execution: Synchronous` |
| Input parameters | Required, or state `Inputs: None` | `LendingPolicyIds: String, comma separated GUID list, required` |
| Output parameters | Required, or state `Outputs: None` | `LogsCreated: Integer, count of created logs` |
| Privilege | Conditional | `Privilege: ex_RunFineCalculation` |
| Logic | Required | An ordered nested list |

Every parameter names its type and whether it is required.

## Development: JavaScript web resources

| Property | Status | Form |
| --- | --- | --- |
| Schema | Required | `Schema: ex_/scripts/fine_form.js` |
| Display name | Required | `Name: Fine Form Script` |
| Attachment | Required | `Form: Lending Policy, Main` or `Command bar: Lending Policy grid` |
| Event | Required | `Event: OnChange of "Fine Type" (ex_finetype)` |
| Function | Required | `Function: Example.Lending.LendingPolicy.onFineTypeChange` |
| Pass execution context | Required | `Pass execution context: Yes` |
| Parameters | Conditional | `Parameters: none` |
| Logic | Required | Nested branches using SHOW, HIDE, LOCK, UNLOCK |

```text
Create JavaScript web resource:
  Schema: ex_/scripts/lending_policy_form.js
  Form: Lending Policy, Main
  Event: OnChange of "Fine Type" (ex_finetype)
  Function: Example.Lending.LendingPolicy.onFineTypeChange
  Pass execution context: Yes
  Logic:
    IF "Fine Type" == "Flat":
      SHOW the Flat Fine section.
      HIDE the Daily Fine section.
    ELSE IF "Fine Type" == "Daily":
      HIDE the Flat Fine section.
      SHOW the Daily Fine section.
    ELSE:
      HIDE both sections.
```

## Development: helper libraries

| Property | Status | Form |
| --- | --- | --- |
| Namespace | Required | `Namespace: Example.Lending.Fine` |
| Class | Required | `Class: FineCalculator` |
| Function | Required | `Function: CalculateFineByFlatRate` |
| Arguments | Required, or state `Arguments: None` | `replacementValue: Decimal, current replacement value` |
| Return | Required | `Return: Decimal, the fine amount for the period` |
| Logic | Required | Ordered nested list |
| Reuse | Conditional | `Called by: the Lending Fine Line plug-in.` |

## Integration: Power Automate flows

| Property | Status | Form |
| --- | --- | --- |
| Flow name | Required | `Flow: Scheduled Lending Fine Calculation` |
| Solution | Required | `Solution: Lending` |
| Trigger | Required | `Trigger: Schedule, daily at 4:00 AM library local time` |
| Connections | Required | `Connections: Dataverse, service principal` |
| Actions | Required | Ordered nested list |
| Branches and escapes | Required when logic branches | `IF ... : Escape the flow.` |
| Retrieves | Required | Named table, columns, and filter |
| Downstream call | Conditional | `Call custom action ex_GenerateLendingFineLogs.` |
| Failure handling | Required | `On failure, send a notification to the circulation desk mailbox and stop.` |
| Idempotency | Required | `Re-running on the same day creates no duplicate log.` |
| Run-as | Conditional | `Run as: the flow owner.` |

## Integration: external APIs

| Property | Status | Form |
| --- | --- | --- |
| External system | Required | `System: Book Supplier Catalog Service` |
| Direction | Required | `Direction: Dataverse to external, outbound` |
| Authentication | Required | `Authentication: OAuth 2.0 client credentials, secret in Azure Key Vault` |
| Endpoint | Required | `Endpoint: POST /api/v2/lending/fines` |
| Request shape | Required | Nested list of fields and types |
| Response shape | Required | Nested list of fields and types |
| Mapping | Required | One item per pair, `ex_replacementvalue -> lending.currentValue` |
| Frequency | Required | `Frequency: on record update, near real time` |
| Retry | Required | `Retry: three attempts, exponential backoff.` |
| Failure handling | Required | Where a failure is recorded and who is notified |
| Throughput limit | Conditional | `Limit: 100 calls per minute.` |

## Data operations

| Property | Status | Form |
| --- | --- | --- |
| Source | Required | `Source: legacy circulation database, CSV extract` |
| Target | Required | `Target: Book Copy (ex_bookcopy)` |
| Volume | Required | `Volume: about 42,000 records.` |
| Mapping | Required | One item per pair, with transformation |
| Matching key | Required | `Matching key: "Legacy Id" (ex_legacyid), unique.` |
| Deduplication | Required | `Skip a record whose legacy identifier already exists.` |
| Validation rules | Required | What makes a record valid |
| Failure handling | Required | `Write a failing record to the error table with its reason.` |
| Sequencing | Required | `Run after the Book Copy schema work in t2.` |
| Rollback | Required | `Roll back by deleting records whose Import Batch equals this run.` |
| Environment | Required | `Environment: Example Test first, then Example Production.` |

## Security

| Property | Status | Form |
| --- | --- | --- |
| Role | Required | `Role: Lending Administrator, new` |
| Privileges | Required | One item per table with privileges and access level |
| Field security profile | Conditional | `Profile: Lending Cost Data` |
| Secured columns | Required with a profile | `"Replacement Value" (ex_replacementvalue): Read yes, Update no, Create no` |
| Business units | Conditional | `Business Unit: Lending, child of the root unit.` |
| Teams | Conditional | `Team: Circulation Operations, owner team.` |
| Assignment | Required | `Assign the Lending Administrator role to the Circulation Operations team.` |
| Denial statement | Required | Which access is explicitly not granted |

```text
Security Roles:
  Lending Administrator, new:
    Lending Fine Line: Create, Read, Write, Delete at Business Unit.
    Book Copy: Read at Organization, Write at Business Unit.
    Lending Policy: Read at Organization.
    No Delete privilege on Book Copy.
```

## Conditional logic form

Use this form everywhere logic branches, in every work type.

```text
IF "Fine Type" == "Flat":
  Call helper function CalculateFineByFlatRate.
ELSE IF "Fine Type" == "Daily":
  IF "Daily Fine Sub-Type" == "Overdue Days":
    Call helper function CalculateFineByDaysOverdue.
  ELSE:
    Call helper function CalculateFineByHoursOverdue.
ELSE:
  Write no value and exit.
```

Rules:

- `IF`, `ELSE IF`, and `ELSE` are capitals.
- The condition ends with a colon.
- The action is nested one level under its condition.
- Field references use display name and logical name.
- Comparison values keep their source casing inside double quotes.
- `TRUE`, `FALSE`, `NULL`, and `UNDEFINED` are capitals and unquoted.
- Every `IF` chain has a stated final branch. An unhandled path is a gap.
