# Writing Style and HTML Form

## Contents

- [Style summary](#style-summary)
- [Description grammar](#description-grammar)
- [Acceptance Criteria grammar](#acceptance-criteria-grammar)
- [Canonical HTML](#canonical-html)
- [Cross-field review](#cross-field-review)

## Style summary

Use direct, specific, implementation-ready language. Separate the reason, the required outcome, and the detailed work.

Keep source facts, recommendations, and unresolved gaps distinct. Do not hide uncertainty with broad words such as “support,” “handle,” “improve,” or “works.”

## Description grammar

Every Product Backlog Item Description has three sections.

### USE CASE

State the need and the value.

- Use one or two short bullets.
- Use present tense.
- Name the actor or system when known.
- Explain why the result matters.
- Do not list implementation steps.

Preferred forms:

- `The release owner needs one verified package so that all supported install paths use the same build.`
- `The system must preserve stable task IDs so that external work items remain traceable to Build OS.`

### DESCRIPTION

State the bounded outcomes.

- Start each bullet with a command verb.
- Use `Create`, `Add`, `Update`, `Remove`, `Preserve`, `Route`, `Record`, `Validate`, or `Confirm` when accurate.
- Keep one outcome in each bullet.
- Do not include field-level or command-level detail here.

Preferred forms:

- `Create one transport-neutral operation contract.`
- `Route the CLI and MCP adapters through the shared core.`
- `Preserve existing compatibility aliases until parity passes.`

### TECHNICAL DETAILS

State how the outcomes are implemented and checked.

- Keep task IDs.
- Name files, commands, contracts, identifiers, and boundaries.
- Use nested lists for parts of one action.
- Keep dependencies explicit.
- Keep approval and acceptance gates explicit.
- Do not invent a path, API, or test that the source does not define.

Preferred form:

- `t3: Add the shared operation contract.`
  - `Path: toolkits/buildos/internal/operations/contract.go`
  - `Preserve the existing JSON receipt envelope.`
  - `Dependency: t1 and t2.`

## Acceptance Criteria grammar

Write observable end states. Each top-level bullet must be independently testable.

Use forms such as:

- `The shared operation returns the same receipt through CLI and MCP.`
- `All selected task IDs are present in the Build OS source trace.`
- `The compatibility alias remains available until the parity gate passes.`
- `The validation command exits with status 0 for the golden fixture.`

Use present tense for stable facts. Use present perfect for completed evidence. Use `will` only when the team's Azure convention requires future-form acceptance statements.

Do not use:

- task commands such as `Implement the validator`;
- vague results such as `Validation works`;
- combined results joined by several unrelated `and` clauses;
- Markdown checkboxes;
- unverified claims of approval, completion, or deployment.

Nest criteria only after a parent result introduces a bounded set:

- `The validator rejects invalid hierarchy so that:`
  - `a Title 3 row cannot appear before a Title 2 parent;`
  - `a Product Backlog Item cannot populate two title columns.`

## Canonical HTML

The bundled emitter creates this Description form:

```html
<div><div><b>USE CASE</b></div><div><ul><li>...</li></ul></div><div><br></div><div><b>DESCRIPTION</b></div><div><ul><li>...</li></ul></div><div><br></div><div><b>TECHNICAL DETAILS</b></div><div><ul><li>...</li></ul></div></div>
```

It creates this Acceptance Criteria form:

```html
<div><ul><li>...</li><li>...<ul><li>...</li></ul></li></ul></div>
```

Use only `div`, `b`, `ul`, `li`, and `br` in generated fields. The emitter escapes plain-text manifest values.

Do not copy noisy inline style attributes from an Azure export. The semantic tag structure is the contract.

## Cross-field review

Before delivery, compare each title, Description, and Acceptance Criteria field.

Confirm:

- the same component or outcome is named in all three places;
- entity and form names do not change between fields;
- each Description outcome has an acceptance result;
- each acceptance result has source support;
- no criteria refer to another feature by mistake;
- completion and gate language matches the source status.
