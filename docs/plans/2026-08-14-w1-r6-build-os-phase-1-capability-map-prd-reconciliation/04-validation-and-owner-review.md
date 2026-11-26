# R6 P4 - Validation and Owner Review

## Purpose

Verify the active-set evolution package, expose all remaining gates, and stop before implementation.

## Dependency Position

- Starts after PRD, register, baseline assembly, plan, and delta-candidate drafting are complete.
- Produces review evidence only.
- Ends the authorized planning and documentation workstream.

## Scope

- Reindex documentation and code evidence, then verify that claims still match the live worktree and current implementation boundaries.
- Validate required headings, active-set numbering, `Change Notes`, register structure, source anchors, relative links, Markdown style, path hygiene, and exact diffs.
- Audit capability coverage, field completeness, CLI/MCP parity, phase assignments, non-goals, dependencies, evidence, and dispositions.
- Confirm no production code, toolkit, Make Docs state, archive, commit, push, publication, or deployment changed.
- Present the owner with separate decisions for artifact approval, W1 R6 coordinate acceptance, commit or merge authorization, W1 R5 supersession, candidate-backlog approval, and later implementation authorization.

## Deliverables

- Validation report naming every touched artifact and check result.
- Exact list of blocking and deferred register items.
- Owner-decision checklist that keeps documentation approval separate from implementation authority.

## Validation

- Repository-native document checks pass for touched files.
- Internal links resolve, or any link to a concurrently drafted target is identified as a blocking assembly defect.
- The exact diff contains only authorized documentation artifacts.
- The candidate backlog remains entirely unchecked and explicitly non-authoritative.

## Exit Gate

Stop after reporting the validated draft package. No implementation follows without a new, explicit owner instruction after the required authority gates are satisfied.
