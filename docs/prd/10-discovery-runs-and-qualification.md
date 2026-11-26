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
| `buildos discovery run` | Record a discovery run and its raw findings |
| `buildos discovery qualify` | Qualify a finding with its confirmation test |

Code anchors:

- `system/workspace/runs/`
- `system/.os/data/findings.jsonl`

## Contracts and Data

A run record is immutable and carries `outcome ∈ {positive, negative, inconclusive}`. **Qualification is the verify-to-promote gate**: a finding is verified-and-reproducible exactly when a deterministic, repeatable test confirms it. Negative findings qualify via a test that *repeatably asserts the negative* — a regression guard against a silent fix. The finding lifecycle is raw (in the run) → qualified (`workspace/findings/`) → design (optional, `11`). For canonical entity resolution, `qualified` is a valid terminal status only for findings; `running`, `closed`, and `aborted` are valid run terminals in addition to the generic entity lifecycle. Design promotion still requires a terminal `qualified` finding.

Discovery resolves governed targets and requested run IDs through the shared resolver before it writes. New run and finding records store canonical targets and canonical run links. They also keep the requested IDs and the complete resolution chains for provenance. Authored playbook rows and historical records stay unchanged. A resolver failure stops the command before any write.

Run and finding records that carry scoped metadata use the `systems`, `environments`, and `owners` lists of configured IDs ([13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md#scoped-vocabulary)). Qualification and promotion keep these lists as they are. They never turn them back into legacy scoped fields.

Code anchors:

- `system/.os/contracts/` (run-record, finding contracts)

## Integrations

Consumes active playbooks (`09`) and `workspace/datasets/` fixtures; writes structured rows to `08`; feeds Flow C (`11`). Uses the external computer-use harness, which the agent's chat app provides. BuildOS ships no harness reference of its own. At runtime, losing playbook or explicit target IDs resolve to terminal canonical IDs without rewriting the authored playbook. Finding qualification resolves a requested run ID, uses the canonical run for governed runtime metadata and new references, and preserves the requested run and raw-finding anchor for audit.

Code anchors:

- `system/workspace/datasets/`

## Rebuild Notes

Keep run records immutable and qualification mandatory. Do not treat an unqualified raw finding as promotable. Preserve the negative-assertion pattern; it is the reason the gate is "verified," not "successful." Read authoritative canonical JSONL rather than trusting a stale derived entity index. Preserve requested IDs and authored raw anchors, but write terminal canonical IDs into new governed run and finding references. Invalid graphs, missing requested IDs, and invalid terminal lifecycle states must fail before any run or finding artifact is written.

Code anchors:

- `system/workspace/findings/`

## Requirement History

### 2026-11-24 — W1 R7 P7

- Affected requirement or section: `## Integrations` (computer-use harness reference)
- Previous contract: The computer-use harness was cited through `system/docs/assets/references/harness-capability-matrix.md`.
- Replacement contract: The agent's chat app provides the computer-use harness. BuildOS ships no harness reference of its own.
- Rationale: The cited file was Make Docs content: it is byte for byte the Make Docs 2.0.9 resource `make-docs://system/reference/harness-capability-matrix.md`, and the Make Docs install manifest listed it. The source package no longer carries a Make Docs copy, so the file was deleted rather than moved.
- Source: [W1 R7 P7 Skills and Validation](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md`
