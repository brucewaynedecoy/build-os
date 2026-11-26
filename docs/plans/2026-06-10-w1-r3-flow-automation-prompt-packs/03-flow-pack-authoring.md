# Phase 03: Flow Pack Authoring

## Purpose

Author the three prompt packs that make Flow A, Flow B, and Flow C executable by long-running agents using a shared contract and flow-specific staged prompts.

## Scope

This phase creates or normalizes `agent_processes/1--intake-knowledge/`, `agent_processes/2--discovery-execution/`, and `agent_processes/3--design-plan-backlogs-build/`. It keeps prompt packs project-level and does not promote them into shipped `system/` assets.

## Workstreams

| Workstream | Output | Notes |
| --- | --- | --- |
| Flow A prompt pack | full-flow starter and staged prompts for single, selected, all, and project-doc input modes | Separate conversion, extraction planning, row loading, playbook drafting, and docs-artifact creation. |
| Flow B prompt pack | full-flow starter and staged prompts for selected playbook, category runnable set, all runnable set, guardrails, standing playbooks, and review gates | Include computer-use harness expectations and deterministic-test generation decision criteria. |
| Flow C prompt pack | normalized version of the current copied Flow C process plus staged prompts for full docs, single change, segment-only, from-finding, and build-loop modes | Preserve build-loop closeout order: implementation plan, implementation, manual-test judgment, developer guides, user guides, PRD reconciliation, docs hygiene, optional commit drafting. |
| Shared assembly | cross-flow index or README that explains when to choose each pack | Keep flow naming aligned with `USE_CASES_TESTING.md`. |
| Source traceability | source links from each flow pack to testing scenarios, design docs, PRD docs, and toolkit guides | Do not introduce absolute paths unless path-hygiene rules require an allowed exception. |

## Concurrency

After Phase 02, Flow A, Flow B, and Flow C authoring can run in parallel because their write scopes are disjoint. The assembly worker should wait until all three flow workers finish before normalizing cross-links and shared wording.

## Blockers

- Flow B prompt content must not assume browser or computer-use support in harnesses that lack it.
- Flow A prompts must not write `.os/data/*.jsonl` rows without an identified contract and explicit approval.
- Flow C prompts must not collapse separate gates for design, plan, PRD, work backlog, guide coverage, implementation, and closeout.
- Draft playbooks must not be treated as runnable in prompt text.

## Validation

- Confirm each flow pack has `AGENTS.md`, `CLAUDE.md`, `agent-prompt.md`, and staged prompt files.
- Confirm each staged prompt includes the shared schema sections.
- Confirm Flow A supports single, selected, all, and project-doc input modes.
- Confirm Flow B includes a deterministic-test generation decision and no-test rationale path.
- Confirm Flow C includes full-docs, single-change, design-only, plan-only, PRD-only, work-only, guide-only, from-finding, and build-loop modes.
- Run scoped Markdown style checks on all authored prompt files.
