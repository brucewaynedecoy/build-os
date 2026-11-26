# Keep tax with coupons

## Purpose

Capture the design hand-off for qualified finding `FIND-001` so planning can proceed from repeatable evidence.

## Context

- Finding: [FIND-001](../../workspace/findings/FIND-001/finding.md)
- Origin run: `RUN-001`
- Qualification: [system/workspace/findings/FIND-001/qualification.md#confirmation-test](../../workspace/findings/FIND-001/qualification.md#confirmation-test)
- Raw anchor: [system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1](../../workspace/runs/RUN-001/raw-findings.md#raw-finding-1)
- Systems: sample-shop
- Environments: baseline
- Owners: fixture-team

Finding qualified from run RUN-001.

Raw finding system/workspace/runs/RUN-001/raw-findings.md#raw-finding-1 was deterministically confirmed.

## Decision

Use this design as the make-docs-routed follow-on artifact for the qualified finding. The finding remains the evidence-backed observation; this design owns solution framing, tradeoffs, and downstream planning context.

## Alternatives Considered

- Auto-promoting qualified findings was rejected because design promotion must remain user-gated.
- Writing outside the `system/docs/designs/` router was rejected because Build OS must preserve the make-docs boundary.

## Consequences

- The promoted design carries finding lineage, qualification evidence, configured scope, and owner metadata into the planning path.
- The source finding now records this design in its `designs` list for traceability.
- Stage-mover automation remains a later concern.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](../assets/prompts/designs-to-plan-change.prompt.md)
- Why: This design should feed additive planning from qualified evidence into the active Build OS planning path.
- Coordinate Handoff: unresolved; planner must resolve before writing.
