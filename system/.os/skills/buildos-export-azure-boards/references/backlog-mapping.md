# Backlog Mapping

## Default tree

Map one selected Build OS work directory to one Azure tree.

| Level | Build OS source | Work item type | Title field |
| --- | --- | --- | --- |
| 1 | Work directory and `00-index.md` | Epic | `Title 1` |
| 2 | `0N-<phase>.md` | Feature | `Title 2` |
| 3 | `## Stage N - Name` | Product Backlog Item | `Title 3` |
| 4 | Reserved | Task | `Title 4` |

Write the tree in dependency order. Use the index Phase Map first. Use file-number order only when the Phase Map is absent and the source contract permits it.

## Epic mapping

Use the work index title as the Epic title.

Use the index Purpose and status as a short Epic Description when useful. Do not apply the Product Backlog Item three-section grammar to the Epic.

Put the work directory and index path in Design Notes.

## Feature mapping

Create one Feature for each phase file.

Use the phase heading without a duplicate `Phase NN:` prefix when the title remains clear.

Use the phase Purpose or Overview as a short Feature Description. Preserve the phase number in tags or Design Notes.

Put the phase file and Source PRD Docs in Design Notes.

## Product Backlog Item mapping

Create one Product Backlog Item for each stage.

Use the stage name as the title. Add the phase name only when titles would otherwise collide inside the same export.

Map source content as follows:

| Source content | Azure field destination |
| --- | --- |
| Stage purpose and surrounding phase outcome | Description `USE CASE` |
| Stage task group outcome | Description `DESCRIPTION` |
| Stage tasks, task IDs, paths, commands, and dependencies | Description `TECHNICAL DETAILS` |
| Stage acceptance bullets | Acceptance Criteria |
| Work path, phase file, stage, task IDs, source PRDs | Design Notes `BUILD OS SOURCE` |
| Approved target wave, revision, phase, status, and domain labels | Tags |

Keep completed task state as content only when it matters. Do not set Azure `State` from Markdown checkboxes in a new-item import.

Treat source labels as tag candidates. Add them to `Tags` only when the user or target process approves those exact values. Otherwise, leave `Tags` blank and keep useful labels in the source trace.

## Adapter splits

A target-platform adapter can require one Build OS stage to become two or more Product Backlog Items, because the platform treats the parts as different work classes. The Dynamics 365 CE adapter does this, for example when one stage creates a table and a plug-in.

When an adapter splits a stage:

- Every resulting item keeps the same originating `source_trace.stage` value.
- Every source task ID lands in exactly one resulting item.
- Every source acceptance bullet lands in exactly one resulting item. The adapter may add criteria on top; it may not drop one.
- The reconciliation rule below changes from one Product Backlog Item per stage to at least one Product Backlog Item per stage, with the task ID and acceptance bullet counts still balancing exactly.

Record every split and its reason in the delivery report.

## Row-order rules

Use preorder traversal:

1. Epic row.
2. First Feature row.
3. All Product Backlog Item rows for that Feature.
4. Next Feature row and its Product Backlog Item rows.

Populate one title cell only. Leave all other `Title N` cells blank.

Do not use a `Parent` column. Azure creates parent-child links from title-column indentation and row order.

## Traceability rules

Every Product Backlog Item must trace back to source evidence.

Include:

- work directory;
- phase file;
- exact stage heading;
- phase-local task IDs;
- Source PRD Docs when present; and
- useful wave, revision, phase, status, or domain values in `source_trace.labels` when those values are not approved Azure tags.

Keep task IDs in source order. Do not renumber them for Azure.

After row planning, reconcile counts:

- one Epic per selected work directory;
- one Feature per included phase;
- one Product Backlog Item per included stage, or more when an adapter splits the stage;
- every selected task ID appears in exactly one Product Backlog Item;
- every selected acceptance bullet appears in exactly one Product Backlog Item.

## Target-specific fields

Set `Iteration Path`, `Tags`, `Effort`, `Solution Type`, and identities only from the target project's accepted values or explicit user input.

Do not copy target-specific values from an example project.

Leave unknown optional values blank. Stop when a required target field has no valid value.
