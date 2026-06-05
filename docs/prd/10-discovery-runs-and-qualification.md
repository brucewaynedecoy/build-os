# 10 Discovery, Runs & Qualification

## Purpose

This subsystem (Pillars 2–3) executes playbooks, records immutable runs, and qualifies findings with deterministic tests — the verify-to-promote gate made operational.

## Scope

Covered here: run records, the computer-use harness, finding qualification, and the negative-assertion pattern. The optional hand-off to engineering is in `11`.

Code anchors:

- `system/workspace/runs/`, `system/workspace/findings/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `workspace/runs/<id>/` | Immutable run record: record + evidence + raw finding |
| `runs.jsonl` | Structured index of runs |
| Qualification | Produce a deterministic Playwright confirmation test |
| `workspace/findings/<id>/` | Qualified finding + its confirmation test |

Code anchors:

- `system/workspace/runs/`
- `system/.os/data/findings.jsonl`

## Contracts and Data

A run record is immutable and carries `outcome ∈ {positive, negative, inconclusive}`. **Qualification is the verify-to-promote gate**: a finding is verified-and-reproducible exactly when a deterministic, repeatable test confirms it. Negative findings qualify via a test that *repeatably asserts the negative* — a regression guard against a silent fix. The finding lifecycle is raw (in the run) → qualified (`workspace/findings/`) → design (optional, `11`).

Code anchors:

- `system/.os/contracts/` (run-record, finding contracts)

### Change Notes

- Enhanced by [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): run and finding records that carry scoped metadata propagate `systems`, `environments`, and `owners` as configured ID lists. Qualification and promotion must preserve those lists rather than translating them back to legacy scoped fields.
- Superseded by [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md) for deterministic implementation ownership: Flow B run recording, raw-finding anchoring, finding qualification, negative assertions, and run/finding-specific validation belong in `buildos-discovery`, not `buildos-intake` or `validate_config.py`.

## Integrations

Consumes active playbooks (`09`) and `workspace/datasets/` fixtures; writes structured rows to `08`; feeds Flow C (`11`). Uses the external computer-use harness (`system/docs/assets/references/harness-capability-matrix.md`).

Code anchors:

- `system/workspace/datasets/`

## Rebuild Notes

Keep run records immutable and qualification mandatory. Do not treat an unqualified raw finding as promotable. Preserve the negative-assertion pattern; it is the reason the gate is "verified," not "successful."

Code anchors:

- `system/workspace/findings/`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md`
