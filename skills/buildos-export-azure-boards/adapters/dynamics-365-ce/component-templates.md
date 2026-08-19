# Component Templates: Dynamics 365 CE

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
  "Publisher Prefix: jd_",
  {
    "text": "CO DEVL -> Rental -> Tables:",
    "children": [
      {
        "text": "Create table:",
        "children": [
          { "text": "Rental Depreciation Line:", "children": ["Schema: jd_RentalDepreciationLine"] }
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
| Display name | Required | `Name: Rental Depreciation Line` |
| Plural display name | Required | `Plural: Rental Depreciation Lines` |
| Schema | Required | `Schema: jd_RentalDepreciationLine` |
| Logical name | Required | `Logical Name: jd_rentaldepreciationline` |
| Description | Required | `Description: One calculated depreciation result for one equipment record.` |
| Ownership | Required | `Ownership: User or Team` |
| Primary column | Required | `Primary Column: "Name" (jd_name), Text, 100` |
| Enabled features | Conditional when the source enables them | `Enable: Notes, Activities, Auditing` |
| New or modified | Conditional when the table exists | `Existing table. Modify only.` |

```text
Create table:
  Name: Rental Depreciation Line
  Plural: Rental Depreciation Lines
  Schema: jd_RentalDepreciationLine
  Logical Name: jd_rentaldepreciationline
  Description: One calculated depreciation result for one equipment record.
  Ownership: User or Team
  Primary Column: "Name" (jd_name), Text, 100
```

## Configuration: columns

| Property | Status | Form |
| --- | --- | --- |
| Display name | Required | `"Depreciation Type"` as the group heading |
| Schema | Required | `Schema: jd_DepreciationType` |
| Logical name | Required | `Logical Name: jd_depreciationtype` |
| Description | Required | `Description: Selects the calculation method for the pricing class.` |
| Type | Required | `Type: Choice, global choice jd_RentalDepreciationTypes` |
| Requirement | Required | `Requirement: Business Required` or `Requirement: Not required` |
| Precision, length, or target | Conditional by type | `Type: Decimal, precision 2` / `Type: Text, 200` / `Type: Lookup, Equipment` |
| Minimum | Conditional for numeric types when the source sets one | `Min: 0` |
| Maximum | Conditional for numeric types when the source sets one | `Max: 1000000` |
| Default | Conditional when the source sets one | `Default: 0` |
| Auditing or searchable | Conditional when the source sets them | `Auditing: Enabled` |

Type must be exact. `Type: Number` is not sufficient. Use `Whole Number`, `Decimal, precision 2`, `Currency`, `Text, 200`, `Multiline Text, 2000`, `Choice, global choice {schema}`, `Choice, local`, `Yes/No`, `Date Only`, `Date and Time`, `Lookup, {Target Table}`, or `File`.

```text
Create columns:
  "Depreciation Type":
    Schema: jd_DepreciationType
    Logical Name: jd_depreciationtype
    Description: Selects the calculation method for the pricing class.
    Type: Choice, global choice jd_RentalDepreciationTypes
    Requirement: Business Required
  "Depreciation Floor":
    Schema: jd_DepreciationFloor
    Logical Name: jd_depreciationfloor
    Description: Lowest value the equipment may depreciate to.
    Type: Currency
    Requirement: Not required
    Min: 0
```

## Configuration: relationships

| Property | Status | Form |
| --- | --- | --- |
| Type | Required | `Type: Many-to-One` |
| Primary table | Required | `Primary Table: Equipment` |
| Related table | Required | `Related Table: Rental Depreciation Line` |
| Lookup column | Required | `Lookup Column: "Equipment" (jd_equipment)` |
| Schema | Required | `Schema: jd_RentalDepreciationLine_Equipment` |
| Delete behavior | Required | `Behavior: Restrict Delete` |
| Requirement | Required | `Requirement: Business Required` |

## Configuration: global choices

| Property | Status | Form |
| --- | --- | --- |
| Display name | Required | Group heading, `Rental Depreciation Types:` |
| Schema | Required | `Schema: jd_RentalDepreciationTypes` |
| Logical name | Required | `Logical Name: jd_rentaldepreciationtypes` |
| Description | Required | `Description: Classifies how a pricing class depreciates.` |
| Options | Required | One nested item per option, in source order |
| Option values | Conditional when the source or downstream logic pins integer values | `Fixed, value 100000000` |

```text
Create global choices:
  Rental Depreciation Types:
    Schema: jd_RentalDepreciationTypes
    Logical Name: jd_rentaldepreciationtypes
    Description: Classifies how a pricing class depreciates.
    Choices:
      Fixed
      Activity
      Hybrid
```

## Configuration: forms

| Property | Status | Form |
| --- | --- | --- |
| Target form | Required | `Form: Rental Depreciation Line, Main` |
| Rename | Conditional | `Rename the main form from "Information" to "Depreciation Line".` |
| Tab work | Conditional | `Relabel the first tab from "General" to "Depreciation".` |
| Tab technical name | Conditional when a tab is renamed or created | `Set the tab Name to tab_depreciation.` |
| Column placement | Required when columns are added | `Add "Depreciation Type" (jd_depreciationtype) to the Depreciation tab.` |
| Moves | Conditional | `Move "Owner" (ownerid) to the Administration tab.` |
| Visibility | Conditional | `HIDE the Related tab.` |
| Order | Conditional when order matters | `Order the Depreciation tab columns as listed.` |

## Configuration: views

| Property | Status | Form |
| --- | --- | --- |
| Target views | Required | `Views: Active Rental Depreciation Lines, All Rental Depreciation Lines` |
| Added columns | Required when columns are added | `Add all custom columns to each system view except the Lookup view.` |
| Removed columns | Conditional | `Remove "Created On" (createdon) from the system views.` |
| Lookup view | Required | State explicitly whether the Lookup view is included or excluded. |
| Sort | Conditional | `Sort by "Calculated On" (jd_calculatedon) descending.` |
| Filter | Conditional | `Filter: jd_statuscode == "Active"` |

## Development: plug-ins

| Property | Status | Form |
| --- | --- | --- |
| Table | Required | `Entity: Rental Depreciation Line` or `Entity: None` |
| Message | Required | `Message: Create` |
| Stage | Required | `Stage: Post Operation` |
| Execution | Required | `Execution: Synchronous` |
| Filtering columns | Required for `Update` messages | `Columns: jd_equipment, jd_invoiceline` |
| Pre-image | Conditional | `Pre Image: jd_mdpvalue, jd_mdplessdepreciation` |
| Post-image | Conditional | `Post Image: jd_calculatedvalue` |
| Assembly and class | Conditional when the source names them | `Assembly: Jd.Rental.Plugins, Class: DepreciationCalculator` |
| Logic | Required | An ordered nested list of retrieves, branches, and writes |
| Error behavior | Conditional when the source defines it | `On a missing pricing class, throw InvalidPluginExecutionException with a user message.` |

Every retrieve names its path and its columns. Every write names its target table and column.

```text
Create a plug-in:
  Entity: Rental Depreciation Line
  Message: Create
  Stage: Post Operation
  Execution: Synchronous
  Columns: jd_rentaldepreciationlog, jd_equipment, jd_invoiceline
  Logic:
    Retrieve from the Pricing Class (jd_rentaldepreciationlog > jd_pricingclass):
      "Depreciation Type" (jd_depreciationtype)
      "Depreciation Floor" (jd_depreciationfloor)
    IF "Depreciation Type" == "Fixed":
      Call helper function CalculateDepreciationByCost.
    ELSE IF "Depreciation Type" == "Activity":
      Call helper function CalculateDepreciationByRentalRevenuePercent.
    ELSE:
      Write no value and exit.
    Update the Equipment record column "MDP Less Depreciation" (jd_mdplessdepreciation).
```

## Development: custom APIs and actions

| Property | Status | Form |
| --- | --- | --- |
| Label | Required | `Label: Generate Rental Depreciation Logs` |
| Schema | Required | `Schema: jd_GenerateRentalDepreciationLogs` |
| Logical name | Required | `Logical Name: jd_generaterentaldepreciationlogs` |
| Binding | Required | `Binding: Unbound` or `Binding: Entity, Pricing Class` |
| Type | Required | `Type: Action` or `Type: Function` |
| Execution | Required | `Execution: Synchronous` |
| Input parameters | Required, or state `Inputs: None` | `PricingClassIds: String, comma separated GUID list, required` |
| Output parameters | Required, or state `Outputs: None` | `LogsCreated: Integer, count of created logs` |
| Privilege | Conditional | `Privilege: jd_RunDepreciation` |
| Logic | Required | An ordered nested list |

Every parameter names its type and whether it is required.

## Development: JavaScript web resources

| Property | Status | Form |
| --- | --- | --- |
| Schema | Required | `Schema: jd_/scripts/depreciation_form.js` |
| Display name | Required | `Name: Depreciation Form Script` |
| Attachment | Required | `Form: Pricing Class, Main` or `Command bar: Pricing Class grid` |
| Event | Required | `Event: OnChange of "Depreciation Type" (jd_depreciationtype)` |
| Function | Required | `Function: Jd.Rental.PricingClass.onDepreciationTypeChange` |
| Pass execution context | Required | `Pass execution context: Yes` |
| Parameters | Conditional | `Parameters: none` |
| Logic | Required | Nested branches using SHOW, HIDE, LOCK, UNLOCK |

```text
Create JavaScript web resource:
  Schema: jd_/scripts/pricing_class_form.js
  Form: Pricing Class, Main
  Event: OnChange of "Depreciation Type" (jd_depreciationtype)
  Function: Jd.Rental.PricingClass.onDepreciationTypeChange
  Pass execution context: Yes
  Logic:
    IF "Depreciation Type" == "Fixed":
      SHOW the Fixed Depreciation section.
      HIDE the Activity Depreciation section.
    ELSE IF "Depreciation Type" == "Activity":
      HIDE the Fixed Depreciation section.
      SHOW the Activity Depreciation section.
    ELSE:
      HIDE both sections.
```

## Development: helper libraries

| Property | Status | Form |
| --- | --- | --- |
| Namespace | Required | `Namespace: Jd.Rental.Depreciation` |
| Class | Required | `Class: DepreciationCalculator` |
| Function | Required | `Function: CalculateDepreciationByCost` |
| Arguments | Required, or state `Arguments: None` | `mdpValue: Decimal, current MDP value` |
| Return | Required | `Return: Decimal, the depreciation amount for the period` |
| Logic | Required | Ordered nested list |
| Reuse | Conditional | `Called by: the Rental Depreciation Line plug-in.` |

## Integration: Power Automate flows

| Property | Status | Form |
| --- | --- | --- |
| Flow name | Required | `Flow: Scheduled Rental Depreciation Calculation` |
| Solution | Required | `Solution: Rental` |
| Trigger | Required | `Trigger: Schedule, daily at 4:00 AM Eastern` |
| Connections | Required | `Connections: Dataverse, service principal` |
| Actions | Required | Ordered nested list |
| Branches and escapes | Required when logic branches | `IF ... : Escape the flow.` |
| Retrieves | Required | Named table, columns, and filter |
| Downstream call | Conditional | `Call custom action jd_GenerateRentalDepreciationLogs.` |
| Failure handling | Required | `On failure, send a notification to the rental operations mailbox and stop.` |
| Idempotency | Required | `Re-running on the same day creates no duplicate log.` |
| Run-as | Conditional | `Run as: the flow owner.` |

## Integration: external APIs

| Property | Status | Form |
| --- | --- | --- |
| External system | Required | `System: Dealer Pricing Service` |
| Direction | Required | `Direction: Dataverse to external, outbound` |
| Authentication | Required | `Authentication: OAuth 2.0 client credentials, secret in Azure Key Vault` |
| Endpoint | Required | `Endpoint: POST /api/v2/pricing/depreciation` |
| Request shape | Required | Nested list of fields and types |
| Response shape | Required | Nested list of fields and types |
| Mapping | Required | One item per pair, `jd_mdpvalue -> pricing.currentValue` |
| Frequency | Required | `Frequency: on record update, near real time` |
| Retry | Required | `Retry: three attempts, exponential backoff.` |
| Failure handling | Required | Where a failure is recorded and who is notified |
| Throughput limit | Conditional | `Limit: 100 calls per minute.` |

## Data operations

| Property | Status | Form |
| --- | --- | --- |
| Source | Required | `Source: legacy rental database, CSV extract` |
| Target | Required | `Target: Equipment (jd_equipment)` |
| Volume | Required | `Volume: about 42,000 records.` |
| Mapping | Required | One item per pair, with transformation |
| Matching key | Required | `Matching key: "Legacy Id" (jd_legacyid), unique.` |
| Deduplication | Required | `Skip a record whose legacy identifier already exists.` |
| Validation rules | Required | What makes a record valid |
| Failure handling | Required | `Write a failing record to the error table with its reason.` |
| Sequencing | Required | `Run after the Equipment schema work in t2.` |
| Rollback | Required | `Roll back by deleting records whose Import Batch equals this run.` |
| Environment | Required | `Environment: CO TEST first, then CO PROD.` |

## Security

| Property | Status | Form |
| --- | --- | --- |
| Role | Required | `Role: Rental Administrator, new` |
| Privileges | Required | One item per table with privileges and access level |
| Field security profile | Conditional | `Profile: Rental Cost Data` |
| Secured columns | Required with a profile | `"MDP Value" (jd_mdpvalue): Read yes, Update no, Create no` |
| Business units | Conditional | `Business Unit: Rental, child of the root unit.` |
| Teams | Conditional | `Team: Rental Operations, owner team.` |
| Assignment | Required | `Assign the Rental Administrator role to the Rental Operations team.` |
| Denial statement | Required | Which access is explicitly not granted |

```text
Security Roles:
  Rental Administrator, new:
    Rental Depreciation Line: Create, Read, Write, Delete at Business Unit.
    Equipment: Read at Organization, Write at Business Unit.
    Pricing Class: Read at Organization.
    No Delete privilege on Equipment.
```

## Conditional logic form

Use this form everywhere logic branches, in every work type.

```text
IF "Depreciation Type" == "Fixed":
  Call helper function CalculateDepreciationByCost.
ELSE IF "Depreciation Type" == "Activity":
  IF "Activity Depreciation Sub-Type" == "Revenue":
    Call helper function CalculateDepreciationByRentalRevenuePercent.
  ELSE:
    Call helper function CalculateDepreciationByHours.
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
