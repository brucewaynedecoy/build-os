# Phase Two Deterministic Flow Orchestrator

> Filename: `2026-06-10-phase-two-deterministic-flow-orchestrator.md`.
> This design defines the later stateful orchestration layer that should be implemented after the prompt-pack contracts are stable.

## Purpose

Define a cross-agent, cross-project Build OS flow orchestrator that can run as much of Flow A, Flow B, and Flow C as possible through deterministic commands, state manifests, validation gates, artifact ledgers, and harness-specific prompt emission.

This is the second implementation step because it should encode the stable contracts from [Phase One Flow Automation Prompt Packs](2026-06-10-phase-one-flow-automation-prompt-packs.md) rather than replacing agent judgment before the prompt workflows are proven.

## Context

The prompt-pack design gives operators and agents a consistent way to execute the flows now. It does not provide a durable state machine, resumable run directory, structured artifact ledger, or harness-neutral flow manifest.

Build OS already ships deterministic toolkit commands for core state changes:

- `buildos-intake` for conversion and index rebuilds.
- `buildos-discovery` for discovery run records and finding qualification.
- `buildos-design` for qualified-finding to design promotion.

The remaining automation gap is not just "more prompts." The system needs a runner that can:

- discover the workspace layout.
- select a flow and mode.
- run deterministic commands directly.
- emit the next prompt when a step requires agent or human judgment.
- record approval gates and no-change rationale.
- track created artifacts.
- resume after a long-running agent, harness restart, or human review pause.
- validate the final flow output.

Flow B also has a harness constraint. Playbook execution may require browser or computer-use capability, so the orchestrator must distinguish deterministic recordkeeping from harness-mediated execution. Codex and Claude Code may run more of Flow B directly than GitHub Copilot, but all harnesses should still share the same flow state and artifact ledger.

## Design Lineage

This design extends the Build OS three-flow architecture in [Build OS - Architecture](2026-06-03-build-os-architecture.md), the toolkit CLI deployment standard in [Build OS Toolkit CLI Deployment Standard](2026-06-04-buildos-toolkit-cli-deployment-standard.md), and the first-phase prompt-pack design.

It is the durable automation follow-on to the baseline P8 stage automation intent in [01-capability-build.md](../plans/2026-06-03-w1-r0-build-os-baseline/01-capability-build.md).

## Decision

Create a new first-party Go toolkit named `buildos-flow`. Do not implement this runner as Python. The CLI should live under `toolkits/buildos-flow/` and follow the installed-root behavior already established by the other Build OS toolkits.

The shipped system should include machine-readable flow manifests under:

- `system/.os/flows/flow-a-intake-knowledge.yaml`
- `system/.os/flows/flow-b-discovery-execution.yaml`
- `system/.os/flows/flow-c-design-plan-backlogs-build.yaml`

Each flow manifest should define:

- flow id, title, and supported modes.
- required workspace paths.
- deterministic commands available for each step.
- expected inputs and artifact outputs.
- approval gates.
- harness capability requirements.
- validation commands or checks.
- prompt-pack references for agent-guided steps.
- resume checkpoint rules.

The CLI should expose commands similar to:

```sh
buildos-flow run A --mode all --input assets/_incoming
buildos-flow run B --playbook all-runnable --harness codex
buildos-flow run C --scope from-finding --finding-id FIND-001 --route change-plan
buildos-flow next FLOW-001
buildos-flow status FLOW-001
buildos-flow resume FLOW-001
buildos-flow validate FLOW-001
buildos-flow emit-prompt FLOW-001 --next
```

The runner should write one stateful directory per flow run:

- `workspace/flow-runs/FLOW-NNN/state.json`
- `workspace/flow-runs/FLOW-NNN/artifact-ledger.json`
- `workspace/flow-runs/FLOW-NNN/decisions.md`
- `workspace/flow-runs/FLOW-NNN/prompts/`
- `workspace/flow-runs/FLOW-NNN/validation.md`

`state.json` should be the machine-readable source of truth for step status, current checkpoint, selected mode, inputs, harness, approvals, and blockers. `artifact-ledger.json` should record every expected and observed artifact path, the command or prompt that produced it, and whether validation confirmed it. `decisions.md` should preserve human-readable approval gates, no-change rationale, test-generation decisions, PRD decisions, and guide coverage decisions.

The orchestrator should run deterministic toolkit commands directly when the manifest marks a step deterministic. When a step requires judgment, the orchestrator should emit the smallest next prompt from the prompt-pack contract and wait for the operator or agent to continue the run.

Flow A orchestration should support single item, selected items, all incoming items, and project-doc input modes. It should run conversion and index rebuilds directly, then prompt for extraction planning and approved writes.

Flow B orchestration should support one playbook, runnable playbooks by category, and all runnable playbooks. It should never treat draft playbooks as runnable. It should apply guardrail playbooks as constraints, not discovery targets. It should record run and finding artifacts through `buildos-discovery` after evidence exists. It should include a structured test-generation decision for each run.

Flow C orchestration should support full-docs, single-change, segment-only, from-finding, and build-loop scopes. It should call `buildos-design` for finding promotion when possible, then use prompt emission and validators for downstream design, plan, PRD, work backlog, guide, implementation, and closeout steps until deterministic tooling exists.

Harness integrations should be layered on top of the CLI:

- Codex skill or plugin entry points for all flows, including computer-use capable Flow B execution where available.
- Claude Code slash commands or skills for prompt emission and resume.
- Copilot instructions for Flow A and Flow C, plus Flow B recordkeeping when computer-use execution is not available.
- optional hooks that block invalid transitions such as running draft playbooks, promoting findings without approval, skipping PRD coverage decisions, or writing docs outside routed destinations.

The CLI is the state authority. Harness integrations should not each invent their own flow state.

## Alternatives Considered

Use only the prompt-pack layer indefinitely. That keeps the system simple, but it cannot provide reliable resume behavior, artifact ledgers, deterministic validation, or cross-harness state handoff.

Build separate harness-specific automations. That would let Codex, Claude Code, and Copilot each use their native extension surfaces, but it would fragment the flow contract and make the same Build OS workspace behave differently depending on the harness.

Make Flow B fully deterministic. That is not realistic while playbook execution may require browser or computer-use interaction. The runner should deterministically manage state, evidence, prompts, and record commands while allowing harness-specific execution.

Extend each existing toolkit separately. Adding more subcommands to `buildos-intake`, `buildos-discovery`, and `buildos-design` would blur domain boundaries. `buildos-flow` should orchestrate those tools rather than absorbing them.

## Consequences

Build OS gains a stable automation surface for long-running agents without locking into one agent harness. The runner can execute deterministic steps, emit prompts for judgment steps, and resume from recorded state.

The state directory becomes an important user-facing artifact. User guides and developer guides will need to explain how flow runs are started, paused, resumed, validated, and diagnosed.

The implementation will require new contracts for flow manifests, flow-run state, artifact ledgers, prompt emission, and harness capability declarations. It will also require tests that prove installed-root behavior and state resume work across all three flows.

The orchestrator should not claim complete automation where Build OS still needs human approval or agent judgment. Instead, it should make the manual/guided boundary explicit and record every approval, blocker, and no-change outcome.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](../assets/prompts/designs-to-plan-change.prompt.md)
- Why: This is an additive automation capability built on the active Build OS toolkit and flow architecture. It should become the planned deterministic successor to the first-phase prompt packs after those contracts are stable.
- Coordinate Handoff: unresolved; planner must resolve before writing. Treat this as downstream of the prompt-pack design and the baseline P8 stage automation intent. Do not plan `buildos-flow` before the phase-one prompt-pack contract is implemented or explicitly accepted as stable.
