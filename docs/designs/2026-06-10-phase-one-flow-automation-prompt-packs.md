# Phase One Flow Automation Prompt Packs

> Filename: `2026-06-10-phase-one-flow-automation-prompt-packs.md`.
> This design defines the quick prompt-based automation layer that should be implemented before deterministic flow orchestration.

## Purpose

Define a prompt-pack structure that lets an operator ask a long-running agent to run Flow A, Flow B, or Flow C end-to-end while preserving Build OS routing, approval gates, validation expectations, and no-change rationale.

This design originally proposed reusing the operator-facing scenarios in [USE_CASES_TESTING.md](../../USE_CASES_TESTING.md) and the Flow C process starter without waiting for a new flow runner or harness-specific plugin.

Historical input: `agent_processes/3--design-plan-backlogs-build/agent-prompt.md`. Removed in commit `3c7d921` as an outdated agent process guide. The original text remains available in Git history.

## Context

Build OS already defines three chained flows:

- Flow A - Intake and Knowledge.
- Flow B - Discovery and Execution.
- Flow C - Design, Plan, Backlogs, Build.

The current test script proves the desired operator shape: each scenario has a user step, copy-ready agent prompt, expected artifacts, acceptance criteria, and human confirmation. The copied Flow C process bundle adds the closeout discipline needed after implementation: manual-test judgment, developer-guide coverage, user-guide coverage, PRD reconciliation, docs hygiene, and optional commit drafting.

The deterministic toolkit surface is intentionally narrower than the full flow:

- `buildos-intake` handles conversion and reference/playbook indexing.
- `buildos-discovery` records discovery runs and qualifies findings.
- `buildos-design` promotes qualified findings into design handoff documents.

Extraction, rich playbook creation, test generation, downstream planning, PRD maintenance, work backlog maintenance, guide coverage, and build execution still need agent judgment. The prompt-pack layer should steer that judgment through explicit contracts rather than pretending those steps are already deterministic.

## Design Lineage

This design extends the architecture decision in [Build OS - Architecture](2026-06-03-build-os-architecture.md), where Flow A, Flow B, and Flow C are chained through intake artifacts, playbooks, findings, designs, plans, PRD docs, and work backlogs.

It also prepares the ground for the baseline P8 stage automation surface in [01-capability-build.md](../plans/2026-06-03-w1-r0-build-os-baseline/01-capability-build.md), but does not implement hooks, commands, or new deterministic runners.

## Decision

Create a top-level `agent_processes/` prompt-pack suite with one ordered pack per flow:

- `agent_processes/1--intake-knowledge/`
- `agent_processes/2--discovery-execution/`
- `agent_processes/3--design-plan-backlogs-build/`

The existing Flow C directory should be treated as the starting point for the third pack, then normalized to match the first two packs. Each pack should include:

- `AGENTS.md` and `CLAUDE.md` harness orientation files.
- `agent-prompt.md` as the full-flow starter.
- numbered stage prompts for smaller resumable segments.
- a `README.md` or `00-index.md` that lists supported modes, required inputs, deterministic commands, approval gates, expected artifacts, and validation.

Each staged prompt should use the same local schema:

```text
Mode:
Inputs:
Deterministic Commands:
Agent-Guided Steps:
Approval Gates:
Expected Artifacts:
Validation:
Resume Checkpoint:
```

Flow A must support:

- one source item.
- a selected list of source items.
- every item in `assets/_incoming/`.
- project docs as source input when the operator wants to turn existing design, planning, architecture, or guide material into intake knowledge.

Flow A prompts must keep conversion, extraction, playbook drafting, data-row loading, and docs-artifact creation separate. They should run deterministic conversion and indexing when available, then make the agent propose extraction outputs before writing rows, playbooks, or docs.

Flow B must support:

- one selected playbook.
- every active runnable playbook in a category.
- every active runnable playbook in the workspace when the operator explicitly chooses broad execution.
- guardrail and standing playbooks as constraints or reusable procedures, not automatically as discovery targets.

Flow B prompts must include a post-run deterministic-test decision. The agent should recommend creating or updating tests only when the playbook is repeatable, has stable assertions, can run without destructive side effects, and maps to an available test harness such as Playwright, a project test target, or a first-party Build OS toolkit command. When those conditions are not met, the agent must record a no-test rationale.

Flow C must support:

- full project documentation generation.
- a single feature or change request.
- design-only work.
- plan-only work.
- PRD-only reconciliation or generation when explicitly approved.
- work-backlog-only generation or maintenance.
- guide-only coverage.
- full documentation from qualified findings.
- full build execution from an approved work backlog.

Flow C prompts must preserve the current distinction between planning-only segments and build-loop segments. For build-loop segments, the prompt pack should retain the staged closeout order: implementation planning, implementation, manual-test judgment, developer-guide coverage, user-guide coverage, PRD reconciliation, docs hygiene, and optional commit drafting when the user is in the loop.

The prompt packs are not the shipped deterministic automation layer. They are the first stable contract for how agents should run the flows across Codex, Claude Code, GitHub Copilot, and other harnesses. Any later shipped prompt material should be promoted deliberately into `system/` after the process proves stable.

## Alternatives Considered

Build the deterministic flow runner first. This would create a stronger long-term automation surface, but it would freeze open questions before the team has watched agents execute the flow prompts against real projects and playbooks.

Keep using only `USE_CASES_TESTING.md`. That file is excellent for testing one end-to-end item, but it is not organized as reusable runtime guidance for single, multiple, all, category, segment, or resume modes.

Embed all automation in harness-specific hooks immediately. Hooks can enforce gates later, but they would be fragmented across harnesses before the common flow vocabulary, modes, and checkpoints are stable.

Move all prompt packs directly into shipped `system/` docs. That would make the prompts look product-ready too early. The first version should remain a project-level process asset until the stable subset is identified.

## Consequences

Agents get a dead-simple execution entry point before the deterministic orchestrator exists. Operators can run full flows or narrower segments without assembling prompts from the testing guide by hand.

The prompt packs become the source material for later flow manifests, harness skills, slash commands, hooks, and CLI prompt emission. They should therefore be written as contracts, not conversational examples.

The approach still depends on agent judgment. It cannot guarantee deterministic state transitions, complete artifact ledgers, or cross-session resume behavior. Those capabilities belong in the second design.

Because the prompt packs live outside `system/` initially, follow-on planning must decide which parts are internal project process and which parts should be shipped to Build OS adopters.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](make-docs://system/prompt/designs-to-plan-change.prompt.md)
- Why: This is an additive process and documentation change against the active Build OS baseline. It should be implemented before the deterministic orchestrator so the later runner can encode proven prompt contracts instead of inventing its own flow language.
- Coordinate Handoff: unresolved; planner must resolve before writing. Treat the baseline P8 stage automation surface as the related planned capability, but sequence this prompt-pack implementation ahead of any `buildos-flow` toolkit or harness-plugin work.
