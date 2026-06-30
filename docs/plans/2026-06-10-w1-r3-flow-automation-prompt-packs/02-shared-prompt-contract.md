# Phase 02: Shared Prompt Contract

## Purpose

Define the common contract every flow prompt pack must follow so Flow A, Flow B, and Flow C can be authored in parallel without drifting into incompatible structures.

## Scope

This phase covers the shared directory conventions, cross-harness orientation files, staged prompt schema, mode vocabulary, approval gates, validation language, and resume checkpoint expectations. It should not write flow-specific deep prompts except as examples needed to prove the contract.

## Workstreams

| Workstream | Output | Notes |
| --- | --- | --- |
| Directory convention | required file map for each `agent_processes/<flow>/` directory | Include `AGENTS.md`, `CLAUDE.md`, `agent-prompt.md`, and stage prompt names. |
| Prompt schema | canonical `Mode`, `Inputs`, `Deterministic Commands`, `Agent-Guided Steps`, `Approval Gates`, `Expected Artifacts`, `Validation`, and `Resume Checkpoint` sections | Keep section names stable so future tooling can parse or emit them. |
| Harness language | shared guidance for Codex, Claude Code, GitHub Copilot, and harness-limited execution | Do not assume every harness can perform Flow B computer-use work. |
| Boundary language | shared phrasing for deterministic versus guided steps | Prevent prompt text from claiming extraction, test generation, PRD maintenance, or build loops are deterministic when they are not. |
| Cross-link strategy | links back to `USE_CASES_TESTING.md`, source design, PRD docs, and later work backlog | Use relative links that resolve from the prompt-pack files. |

## Concurrency

The shared contract should be written before flow-pack workers begin. Once the contract is stable, Flow A, Flow B, and Flow C workers can proceed independently with disjoint directories.

## Blockers

- If the shared schema is too loose, later `buildos-flow` manifests will not have a stable source vocabulary.
- If the schema is too rigid, it may prevent Flow C build-loop prompts from carrying phase-closeout requirements.
- If AGENTS and CLAUDE files diverge materially, cross-harness behavior will become inconsistent.

## Validation

- Confirm each required schema section appears exactly once in the shared contract.
- Confirm harness notes avoid harness-specific claims that are not true for all agents.
- Confirm the shared contract does not introduce shipped `system/` paths for phase-one project-level prompt packs.
- Run scoped Markdown style checks on edited prompt-contract files.
