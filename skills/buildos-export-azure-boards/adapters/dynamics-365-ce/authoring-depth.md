# Authoring Depth: Dynamics 365 CE

## Purpose

The base skill decides which Build OS stage becomes which Azure row. This file decides **how to judge what belongs in each section, and how deep it must go**, before a Dynamics 365 CE work item is considered implementable.

Work through the six steps in order for every Product Backlog Item.

## Contents

- [Step 1: Inventory the stage](#step-1-inventory-the-stage)
- [Step 2: Classify the work type](#step-2-classify-the-work-type)
- [Step 3: Split the stage](#step-3-split-the-stage)
- [Step 4: Write USE CASE](#step-4-write-use-case)
- [Step 5: Write DESCRIPTION](#step-5-write-description)
- [Step 6: Write TECHNICAL DETAILS](#step-6-write-technical-details)
- [Acceptance Criteria coverage](#acceptance-criteria-coverage)
- [Gap handling](#gap-handling)
- [Self-review rubric](#self-review-rubric)

## Step 1: Inventory the stage

Before writing anything, extract these from the Build OS stage and its phase file. Record the source line for each.

| Item | Where it usually lives |
| --- | --- |
| Business trigger and actor | Stage purpose, phase Purpose or Overview, the linked PRD |
| Named components | Stage tasks, task text, referenced PRD sections |
| Component class for each | Inferred from the verb and the noun in the task |
| Environment and solution | Phase file, index, or project `AGENTS.md` |
| Ordering and dependencies | Stage dependency lines and `tN` references |
| Observable end states | Stage acceptance bullets |
| Publisher prefix | The user or the project pin. Never the source text alone unless it is stated there. |

If a component is named but its class is unclear, do not guess. Treat it as a gap.

## Step 2: Classify the work type

Classify by **what artifact the work produces**, not by which team does it.

| Question | If yes | Code |
| --- | --- | --- |
| Does the result exist only as maker configuration in a solution, with no code? | Tables, columns, relationships, forms, views, global choices, business rules, app modules | `CFG` |
| Does the result require compiled or interpreted code that runs on platform events? | Plug-ins, custom APIs, custom actions, JavaScript web resources, helper libraries | `DEV` |
| Does the result move data or calls across a system boundary? | Power Automate flows, connectors, external API calls, webhooks | `INT` |
| Does the result change records rather than schema or logic? | Migration, transformation, bulk update, cleansing, reconciliation | `DATA` |
| Does the result change who can see or do what? | Security roles, field security profiles, business units, teams | `SEC` |

Tie-breakers, applied in order:

1. **Code beats configuration.** A plug-in that also needs one new column is `DEV` for the plug-in and `CFG` for the column. Two items.
2. **Boundary beats code.** A Power Automate flow that calls a custom API is `INT`. The custom API itself is `DEV`. Two items.
3. **Schema beats data.** Creating a column is `CFG`. Filling that column for existing records is `DATA`. Two items.
4. **Security is never folded in.** A role change rides in its own `SEC` item even when it is one line in the source.
5. **Deployment is not a work type.** Deployment of the solution is an outcome and an acceptance criterion inside the item that produces the component, not a separate item, unless the source stage is itself a release stage.

## Step 3: Split the stage

One Product Backlog Item is **one work type plus one component group**.

Split a Build OS stage when any of these is true:

- It produces artifacts in two or more work types.
- It produces two component groups that a different person could build independently, for example a table and an unrelated plug-in.
- Its acceptance bullets test two unrelated outcomes.
- Its `TECHNICAL DETAILS` would exceed roughly forty list items at the required depth.

Do not split when:

- The parts share one property sheet, for example a table and its own columns, its own form, and its own views. That is one `CFG` item.
- One part exists only to serve the other and has no independent acceptance, for example a helper function used by exactly one plug-in. Keep it as a nested group inside the parent item.

When you split:

- Keep the same `Feature Name` in every resulting title.
- Distribute the stage's task IDs across the resulting items. Every source task ID must land in exactly one item.
- Distribute the stage's acceptance bullets the same way. Add adapter-required criteria on top; do not drop a source bullet.
- Record the split and the source stage in each item's `source_trace.stage`, so the base traceability reconciliation still balances.

## Step 4: Write USE CASE

### What this section proves

Why a reviewer should approve the work, in business terms, and what breaks if it is not done.

### Depth rules

- Two to four bullets. One bullet is almost always too thin for this platform.
- Name the actor when the source names one. Use a role, not a person: `Rental administrators`, `The dealer`, `The scheduling flow`.
- Present tense for a standing need. `will be able to` is acceptable when the source frames the value as a future capability.
- At least one bullet must state a business outcome. At least one must state the dependency, that is, what other logic or process consumes this result.
- No implementation steps. No schema names. No trigger names. If a bullet names a logical name, it belongs in `TECHNICAL DETAILS`.

### Questions to answer per work type

| Code | Answer all of these |
| --- | --- |
| `CFG` | Who enters or reads this data? What decision does it drive? Which logic or report reads it later? |
| `DEV` | What manual step or error does the logic remove? When must it run? What happens today without it? |
| `INT` | Which two systems must agree? How current must the data be? What is the cost of a missed or duplicated sync? |
| `DATA` | Why must existing records change? Which downstream process is blocked until they do? What is the record volume? |
| `SEC` | Which roles must be separated? What is the compliance or privacy driver? What is the risk of over-permission? |

If a question has no answer in the source, that is a gap. See [Gap handling](#gap-handling).

## Step 5: Write DESCRIPTION

### What this section proves

The shape and boundary of the work, at a level a delivery lead can plan against without reading the property sheet.

### Depth rules

- Two to five bullets.
- Start each bullet with a command verb: `Create`, `Add`, `Update`, `Configure`, `Deploy`, `Migrate`, `Grant`, `Restrict`, `Preserve`, `Validate`.
- Name the component classes in the plural, not the individual components: `Create global choices`, not `Create the Rental Depreciation Types choice`.
- Name the environment and the solution once, when the source states them: `in the Rental solution in CO DEVL`.
- State the scope boundary when the source sets one: what is explicitly out of scope, or what stays unchanged.
- Include a deployment bullet when the component must reach another environment to be usable.
- No field-level detail. No property values. No conditional logic.

### The line between DESCRIPTION and TECHNICAL DETAILS

Ask: could a delivery lead estimate this item from the bullet without knowing the exact names? If yes, it is a `DESCRIPTION` bullet. If the bullet only makes sense to the person building it, move it down.

| Belongs in DESCRIPTION | Belongs in TECHNICAL DETAILS |
| --- | --- |
| `Create global choices in the Rental solution.` | `Rental Depreciation Types, Schema: jd_RentalDepreciationTypes` |
| `Create a plug-in that calculates depreciation by type.` | `Message: Create. Stage: Post Operation. Execution: Synchronous.` |
| `Deploy the rental solution to upper CO environments.` | `Target environments: CO TEST, CO PROD.` |

## Step 6: Write TECHNICAL DETAILS

### What this section proves

That an implementer who has never read the Build OS source can build the component without asking a question.

### Mandatory opening

The first list item is always:

```text
Publisher Prefix: jd_
```

Substitute the confirmed prefix. This item exists so the prefix is visible in Azure and so the validator can check the rest of the file against it.

### Mandatory structure

After the prefix line, use the location path, then the component category, then each component and its properties:

```text
Publisher Prefix: jd_
CO DEVL -> Rental -> Global Choices:
  Create global choices:
    Rental Depreciation Types:
      Schema: jd_RentalDepreciationTypes
      Logical Name: jd_rentaldepreciationtypes
      Description: Classifies how a pricing class depreciates.
      Choices: Fixed, Activity, Hybrid
```

The location path is `{Environment} -> {Solution} -> {Component Area}`. Omit a segment only when the source does not define it, and say so rather than inventing one.

### Required property sets

Every component category has a mandatory property set. An item that omits a mandatory property is not finished. The full matrix is in [component-templates.md](component-templates.md). Use it as a checklist, not as prose to copy.

### Depth questions per work type

Answer every applicable question inside `TECHNICAL DETAILS`. An unanswered question is a gap.

**`CFG`**

- Which environment, solution, and component area?
- For each table: display name, plural name, schema, logical name, ownership, primary column, description.
- For each column: display name, schema, logical name, data type with precision, length, or target table, requirement level, minimum, maximum, default, description.
- For each relationship: the two tables, the relationship type, the behavior on delete, the lookup column name.
- For each form: which form, which tabs and sections, which columns on which tab, and any rename, move, or hide.
- For each view: which views, which columns added, which removed, sort order, and whether the Lookup view is included.
- For each global choice: schema, logical name, and the full option list in order.
- Is the component new, modified, or only referenced?

**`DEV`**

- Component class: plug-in, custom API, custom action, JavaScript web resource, or helper library.
- For a plug-in: table, message, stage, execution mode, filtering columns, pre-image and post-image with their columns, and whether it runs in a transaction.
- For a custom API: label, schema, logical name, bound or unbound, every input parameter with its type, every output parameter with its type.
- For a web resource: schema name, the form or command it attaches to, and the event, one of OnLoad, OnChange, OnSave, or a command button.
- For a helper library: namespace, class, function, argument types, return type.
- The logic, as an ordered list, with every retrieve, every branch, and every write named.
- Every branch written as `IF ... :`, `ELSE IF ... :`, `ELSE:` with the action nested beneath it.
- Every field read or written given as `"Display Name" (prefix_logicalname)`.
- Error and exception behavior when the source defines it.

**`INT`**

- Integration component: Power Automate flow, connector, or custom code.
- Trigger type and its exact configuration, including schedule, time zone, and frequency.
- Every action in order.
- Every branch and every escape condition.
- Authentication method and where the secret lives.
- Endpoints, methods, and payload shape for an external API.
- The field mapping, one line per pair, as `{prefix}_source -> External.Field`.
- Retry policy, failure handling, and where failures are logged.
- Whether the flow is idempotent, and what makes it so.

**`DATA`**

- Source system, format, and the extract method.
- Target tables and target columns with their prefixes.
- The mapping, one line per pair, including any transformation.
- Record volume estimate.
- Deduplication and matching key.
- Validation rules and what happens to a failing record.
- Sequencing against other data loads and against schema work.
- Rollback approach.

**`SEC`**

- Every role by name, new or existing.
- Per role: the tables, the privileges of Create, Read, Write, Delete, Append, Append To, Assign, and Share, and the access level of User, Business Unit, Parent Child Business Unit, or Organization.
- Field security profiles, the columns they cover, and the read, update, and create flags.
- Business unit structure changes.
- Teams and their memberships.
- Which existing users or roles gain or lose access.

### Nesting and ordering rules

- One property per list item. Do not join two properties with a comma unless they are a genuine list of values, such as choice options.
- Nest a property under the component it describes. Never place a schema name at the same level as the component name.
- Keep the Build OS task ID on the list item that carries the work: `t3: Create the depreciation columns.` Keep the ID form unchanged.
- Put dependencies on their own item: `Dependency: t1 and t2.`
- Preserve gate language from the source: `Blocked until the PRD reconciliation gate passes.`
- Order components as the source orders them. Do not sort alphabetically.

### Never do this

- Never invent a schema name, a logical name, a data type, a message, a stage, an endpoint, or a privilege that the source does not define.
- Never use the `new_` prefix.
- Never write a property as `TBD`, `TODO`, or an empty value.
- Never restate a `DESCRIPTION` bullet here with more adjectives instead of properties.
- Never collapse a branch into prose. A branch is a nested list.

## Acceptance Criteria coverage

Each Product Backlog Item needs at least two criteria and full coverage of its required classes.

| Class | Required for | Form |
| --- | --- | --- |
| Existence | All | `The global choice "Rental Depreciation Types" will exist in the rental solution in CO.` |
| Behavior | `CFG`, `DEV`, `INT`, `SEC` | `The plug-in will update the "MDP Less Depreciation" value on the Equipment record.` |
| Deployment | All that must reach another environment | `The rental solution will be deployed to the upper CO environments.` |
| Branch coverage | `DEV`, `INT` where the logic branches | `When the schedule strategy is "First of month" and today is not the first, the flow will escape without calling the action.` |
| Mapping | `INT`, `DATA` | `Every migrated equipment record will carry the source system identifier in "Legacy Id" (jd_legacyid).` |
| Volume and quality | `DATA` | `No duplicate equipment record will exist for a single legacy identifier.` |
| Denial | `SEC` | `A user holding only the Rental Read role will not be able to update "MDP Value" (jd_mdpvalue).` |

Rules:

- Each criterion is independently testable and names the component it tests.
- Use the same names here as in `TECHNICAL DETAILS`. A criterion that names a component the technical section never defines is an error.
- `will` future form is the accepted convention for this adapter, matching the source specification, and overrides the base preference for present tense.
- One outcome per criterion. Do not join unrelated results with `and`.
- No Markdown checkboxes.
- Do not claim approval, sign-off, or completion that the source does not evidence.

## Gap handling

Classify every unanswered question before you decide what to do.

| Gap class | Example | Action |
| --- | --- | --- |
| Organizational constant | Publisher prefix, environment names, solution name | Ask the user. Do not proceed without it. |
| Material design decision | The data type of a new column, the plug-in stage, the matching key for a migration | Stop. Report the exact source path and the missing decision. This is a source defect, not an export defect. |
| Platform default the source clearly intends | Ownership of a child table that the source calls user-owned everywhere else | Apply the default. State it in `TECHNICAL DETAILS` as an assumption line: `Assumption: user-owned, matching the other rental tables.` |
| Out of scope for this export | A downstream report the phase explicitly defers | Record it in the exclusion report with its source path. Do not create a row for it. |

Never fill a gap with a placeholder. Never fill a gap with a value taken from the examples in this adapter.

## Self-review rubric

Check every Product Backlog Item against this before emitting. Every line must pass.

**Classification**

1. The title carries exactly one valid work type code.
2. The item produces one work type and one component group.
3. Every source task ID and acceptance bullet from the stage landed in exactly one item.

**USE CASE**

4. Two to four bullets.
5. An actor or consuming system is named.
6. A business outcome is stated.
7. No schema name, trigger, or step appears here.

**DESCRIPTION**

8. Two to five bullets, each starting with a command verb.
9. Component classes, environment, and solution are named.
10. No property values appear here.

**TECHNICAL DETAILS**

11. The first item is the publisher prefix line, with the confirmed prefix.
12. The location path is present or its absence is explained.
13. Every mandatory property for the component category is present.
14. Every schema name and logical name uses the confirmed prefix and the correct casing.
15. Every branch is written in capitals with nested actions.
16. Every field reference gives display name and logical name.
17. Task IDs and dependencies are preserved.
18. Nothing is invented beyond the source.

**Acceptance Criteria**

19. At least two criteria.
20. Every required coverage class for the work type is present.
21. Every criterion names a component that `TECHNICAL DETAILS` defines.
22. No criterion states unevidenced approval or completion.

**Cross-field**

23. Title, `DESCRIPTION`, `TECHNICAL DETAILS`, and criteria all name the same components with the same names.
24. `Design Notes` carries the Build OS source trace for the originating stage.
