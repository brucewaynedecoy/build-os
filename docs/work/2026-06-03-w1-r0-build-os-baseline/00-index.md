# Build OS — Baseline Build Backlog

> In v2, work backlogs are directories. This `00-index.md` is the entry point; phase detail lives in the sibling `0N-<phase>.md` files.

## Purpose

This backlog implements Build OS in `./system/`, derived from [the baseline build plan](../../plans/2026-06-03-w1-r0-build-os-baseline/00-overview.md) and [the design of record](../../designs/2026-06-03-build-os-architecture.md). Phases are dependency-ordered; tasks already satisfied by the validated first slice are checked off so the backlog reflects true remaining work.

## Phase Map

| File | Purpose |
| --- | --- |
| [01-foundation.md](./01-foundation.md) | Operating layer & contracts — complete `.os/contracts/*` and scaffold routers |
| [02-boundary-and-shipping.md](./02-boundary-and-shipping.md) | Make-docs boundary guardrails, `system/.gitignore`, co-owned-router augmentation |
| [03-intake-conversion.md](./03-intake-conversion.md) | `buildos-intake` Go CLI, thin wrappers, provenance, `references.json` |
| [04-data-and-extraction.md](./04-data-and-extraction.md) | Entity JSONL, candidate staging, load-plans, `playbooks.json` |
| [05-playbooks.md](./05-playbooks.md) | Playbook templates, category routers, seed playbooks, review-to-activate |
| [06-discovery-runs-qualification.md](./06-discovery-runs-qualification.md) | Runs, finding qualification (Playwright), computer-use |
| [07-flow-c-integration.md](./07-flow-c-integration.md) | Qualified-finding → `system/docs/designs/` hand-off via make-docs |
| [08-stage-automation.md](./08-stage-automation.md) | Hooks + slash-commands for the stage-movers |

## Usage Notes

- Read phases in order; they are dependency-ordered (P1 foundation first; P8 automation last).
- Reference a task externally as `w1 r0 p{P} t{T}` (e.g. `w1 r0 p3 t2`), inferring P from the phase file.
- The PRD source-of-truth is deferred; until it exists, each phase's `## Source PRD Docs` points at the design and this plan as the governing sources.
- Checked (`- [x]`) tasks are already delivered by the validated first slice; do not re-do them.
- Open decision carried by this backlog: **promotion enforcement** (documented convention vs. tooling/machinery). It is unresolved and intentionally does not block any phase; resolve it before hardening `08-stage-automation.md`.
- No task may modify a make-docs-managed tree (`docs/`, `system/docs/`, `.make-docs/`, `system/.make-docs/`); cross those boundaries only via their routers per `PB-001`.
