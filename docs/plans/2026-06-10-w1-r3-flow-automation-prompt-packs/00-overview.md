# Flow Automation Prompt Packs Change Plan

> In v2, plans are directories. This is the `00-overview.md` entry point; phase detail lives in [01-lineage-and-prd-scope.md](01-lineage-and-prd-scope.md), [02-shared-prompt-contract.md](02-shared-prompt-contract.md), [03-flow-pack-authoring.md](03-flow-pack-authoring.md), and [04-validation-and-handoff.md](04-validation-and-handoff.md).

**Date:** 2026-06-10

**Repository:** Build OS (`./`)

**Purpose:** Convert the design in [2026-06-10-phase-one-flow-automation-prompt-packs.md](../../designs/2026-06-10-phase-one-flow-automation-prompt-packs.md) into an execution-ready plan for prompt-based Flow A, Flow B, and Flow C automation before deterministic `buildos-flow` orchestration begins.

## Objective

Create a project-level prompt-pack suite under `agent_processes/` that gives long-running agents a repeatable way to execute Build OS Flow A, Flow B, and Flow C in full-flow or segment modes while preserving deterministic toolkit boundaries, approval gates, validation, and no-change rationale.

This plan does not generate the matching work backlog, PRD change doc, or implementation artifacts. It fixes the downstream output shape and execution sequence so those artifacts can be generated and executed after approval.

## Coordinate Decision

- Coordinate: `W1 R3`.
- Route: `change-plan`.
- Basis: the source design declares `change-plan` and says to treat the baseline P8 stage-automation surface as the related planned capability while sequencing prompt packs ahead of `buildos-flow`. Existing W1 plan directories occupy `r0`, `r1`, and `r2`; this is the next revision of the W1 automation lineage, not a new wave.
- Source design: [2026-06-10-phase-one-flow-automation-prompt-packs.md](../../designs/2026-06-10-phase-one-flow-automation-prompt-packs.md).
- Related baseline plan section: [P8 Stage automation](../2026-06-03-w1-r0-build-os-baseline/01-capability-build.md).
- Downstream work backlog target: `docs/work/2026-06-10-w1-r3-flow-automation-prompt-packs/`.

## Change Classification

- Classification: `enhancement` and `revision`.
- Enhancement: adds a prompt-pack operating layer that supports full-flow and segment execution before deterministic orchestration exists.
- Revision: narrows the immediate stage-automation path by making prompt contracts the first implementation step before hooks, slash commands, plugins, or `buildos-flow`.
- Archive gate: not required. This is active-set evolution against the current PRD namespace, not a full PRD replacement.

## Change Inputs

- [Phase One Flow Automation Prompt Packs](../../designs/2026-06-10-phase-one-flow-automation-prompt-packs.md)
- [USE_CASES_TESTING.md](../../../USE_CASES_TESTING.md)
- [USE_CASES.md](../../../USE_CASES.md)
- Historical input: `agent_processes/3--design-plan-backlogs-build/agent-prompt.md`. Removed in commit `3c7d921` as an outdated agent process guide. The original text remains available in Git history.
- Active PRD docs, especially [11-flow-c-integration.md](../../prd/11-flow-c-integration.md), [12-stage-automation.md](../../prd/12-stage-automation.md), and the flow-adjacent docs `07` through `10`.

## Baseline Context

The active baseline already defines the three flows and the W1 P8 stage-automation goal. The current deterministic toolkit surface covers intake conversion and indexing, discovery run and finding qualification records, and qualified-finding design promotion. The source design intentionally keeps phase-one automation as prompt/process assets and defers shipped deterministic orchestration to the phase-two design.

Current `agent_processes/3--design-plan-backlogs-build/` content is copied from another project and only covers Flow C. The implementation should normalize that material into a Build OS-owned Flow C prompt pack and add sibling Flow A and Flow B prompt packs rather than treating the copied directory as already complete.

## Output Contract

The downstream execution should create or update:

- `agent_processes/1--intake-knowledge/`
- `agent_processes/2--discovery-execution/`
- `agent_processes/3--design-plan-backlogs-build/`
- shared prompt-pack conventions inside those directories, including `AGENTS.md`, `CLAUDE.md`, `agent-prompt.md`, and staged prompt files.
- a PRD change doc, expected as `docs/prd/17-revise-flow-automation-prompt-packs.md` unless another PRD is added first.
- targeted baseline PRD annotations in `docs/prd/12-stage-automation.md` and any other flow PRD docs materially affected by the prompt-pack contract.
- matching delta work backlog under `docs/work/2026-06-10-w1-r3-flow-automation-prompt-packs/` after this plan is approved for execution.
- guide updates only if execution makes prompt-pack operation an adopter or maintainer workflow that belongs in `docs/assets/`.

No source-code toolkit implementation is in scope for this plan. Do not create `buildos-flow`, harness plugins, hooks, or new scripts as part of the phase-one prompt-pack implementation.

## Change Doc Strategy

The implementation should create one PRD change doc for the prompt-pack layer. It should classify the change as a process/workflow automation enhancement and revision to the stage-automation sequence. The PRD change should state that prompt packs are the first durable contract, while deterministic flow manifests, a `buildos-flow` CLI, and harness integrations remain deferred to the phase-two orchestrator design.

The PRD change should update [00-index.md](../../prd/00-index.md) and add `### Change Notes` backlinks to [12-stage-automation.md](../../prd/12-stage-automation.md). Add backlinks to [11-flow-c-integration.md](../../prd/11-flow-c-integration.md), [09-playbooks.md](../../prd/09-playbooks.md), [10-discovery-runs-and-qualification.md](../../prd/10-discovery-runs-and-qualification.md), [07-intake-and-conversion.md](../../prd/07-intake-and-conversion.md), or [08-data-and-extraction.md](../../prd/08-data-and-extraction.md) only if the executed prompt-pack content changes those requirement surfaces rather than merely referencing them.

## Baseline Annotation Plan

Annotate [12-stage-automation.md](../../prd/12-stage-automation.md) to show that prompt-pack contracts precede deterministic hooks, slash commands, plugins, and `buildos-flow`. If Flow C prompt-pack normalization changes the handoff expectations from qualified findings into design/planning/build loops, annotate [11-flow-c-integration.md](../../prd/11-flow-c-integration.md). Do not annotate flow PRDs solely because they are linked as source material.

## Worker Ownership

Use the delegation ladder during execution: parallel workers when available, subagents when parallelism is not available, and single-agent execution only as the fallback. The coordinator should own sequencing, conflict detection, and final acceptance, not primary document writing when delegation is available.

| Workstream | Write Scope | Dependencies |
| --- | --- | --- |
| Product and PRD alignment | PRD change doc, PRD index, baseline annotations, guide-coverage decision | Source design and active PRD scan |
| Shared prompt contract | shared prompt-pack schema, common README/AGENTS/CLAUDE conventions | Product and PRD alignment decision |
| Flow A prompt pack | `agent_processes/1--intake-knowledge/` | Shared prompt contract |
| Flow B prompt pack | `agent_processes/2--discovery-execution/` | Shared prompt contract |
| Flow C prompt pack | `agent_processes/3--design-plan-backlogs-build/` | Shared prompt contract and copied Flow C review |
| Assembly and validation | cross-links, style fixes, docs index refresh, touched-doc validation | All writing workstreams |

## MCP Strategy

Refresh `jdocmunch` and `jcodemunch` before execution. Use `jdocmunch` for docs and prompt-pack discovery, and use `jcodemunch` only when prompt text must reference first-party toolkit command surfaces or validation scripts. If a delegated worker cannot access the indexes or finds stale results, it should reindex locally before falling back to direct reads.

## Validation

Required validation for the implementation:

- run scoped Markdown style checks on edited docs and prompt-pack Markdown files.
- run path hygiene with the repo manifest.
- run `git diff --check`.
- refresh `jdocmunch` after docs and prompt-pack edits.
- confirm the prompt-pack directory map matches the design.
- confirm Flow A, Flow B, and Flow C prompt packs each define modes, inputs, deterministic commands, agent-guided steps, approval gates, expected artifacts, validation, and resume checkpoints.
- confirm no prompt claims deterministic automation where the current toolkit surface still requires guided agent or human judgment.

## Phase Map

| Phase | File | Purpose |
| --- | --- | --- |
| 01 | [01-lineage-and-prd-scope.md](01-lineage-and-prd-scope.md) | Set PRD, guide, and coordinate scope before prompt authoring. |
| 02 | [02-shared-prompt-contract.md](02-shared-prompt-contract.md) | Define the shared prompt-pack schema and directory conventions. |
| 03 | [03-flow-pack-authoring.md](03-flow-pack-authoring.md) | Author or normalize Flow A, Flow B, and Flow C prompt packs. |
| 04 | [04-validation-and-handoff.md](04-validation-and-handoff.md) | Assemble, validate, document handoff, and prepare work-backlog execution. |

## Handoff To Execution

Execution can begin after this plan is approved and a matching work backlog is generated under `docs/work/2026-06-10-w1-r3-flow-automation-prompt-packs/`. The implementation must keep phase-one prompt packs separate from the phase-two deterministic orchestrator: no `buildos-flow`, hooks, plugins, or harness-specific automation should be implemented unless the user explicitly expands scope.
