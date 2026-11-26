# Phase Detail — Capability Build

> The Build OS capability areas to implement in `./system/`, in dependency order.
> Each is a feature area, not a document; the backlog ([`02-derived-outputs.md`](02-derived-outputs.md))
> turns these into tasks. Status reflects the validated first slice already in `./system/`.

## P1 · Operating layer & contracts

- **Goal:** complete `.os/` as the authority + routing brain so every later phase has a contract to read before writing.
- **Deliverables:** the remaining `.os/contracts/` files — `entity-records`, `run-record`, `finding`, `converted-source` (provenance), `extraction` (load-plan); system data/index/workspace directories; any missing operating routers.
- **Depends on:** — (extends the built slice).
- **Status:** partial — `.os/contracts/playbook-contract.md`, `.os/` + `.os/contracts` + `.os/templates` routers, and the guardrail-playbook template already exist.

## P2 · Spaces, boundary & shipping

- **Goal:** make the build/system/target-docs boundary impossible to cross by accident, and define what "shipping `system/`" means.
- **Deliverables:** additional boundary/guardrail playbooks as needed; a runtime-only `system/.gitignore` for generated runtime artifacts; co-owned-router augmentation procedure.
- **Depends on:** P1.
- **Status:** partial — `PB-001` (plug-in-boundary guardrail) built and active.

## P3 · Intake / conversion (Pillar 1)

- **Goal:** deterministic, tool-first conversion of unstructured sources into clean text/CSV twins — no structuring.
- **Deliverables:** the `buildos-intake` Go CLI under `toolkits/buildos-intake/`; command surface for `convert` and `index references`; local-only converters for `docx`, `xlsx`, minimal plain-text `pdf`, `html`, html-directory, and `csv`; standard-library-first dependency policy with approved Go dependencies only for HTML parsing and rudimentary PDF text extraction; provenance frontmatter on every converted twin under `system/assets/`; the derived `references.json` index; thin `.os/scripts/` wrappers or command documentation; intake translation contract coverage; manual/operator fallback guidance; tests and docs updates.
- **Depends on:** P1 (converted-source contract) and W1 R2 (toolkit CLI deployment standard).
- **Status:** revised by W1 R2 — durable converter/index logic belongs in `buildos-intake`; `.os/scripts/` is a wrapper/router surface only. P3 explicitly defers `pdftotext` and rich PDF support in favor of minimal local extraction plus manual fallback.

## P4 · Data layer & extraction

- **Goal:** the plain-text knowledge layer and the smart ETL step that populates it.
- **Deliverables:** per-entity NDJSON shapes in `.os/data/` (requirements, capabilities, personas, test-cases, results, runs, findings) with the common envelope; first-class extraction load-plans (`extractions.jsonl`); the derived `playbooks.json`; the capability/requirement/finding model honored; layered-canonicity discipline.
- **Depends on:** P1 (entity-records + extraction contracts), P3 (converted twins as extraction source).

## P5 · Playbooks (Pillar 2)

- **Goal:** the instruments that guide humans/agents, with the review-to-activate lifecycle.
- **Deliverables:** procedure-playbook template(s) per category/mode; category routers for `build/`, `discovery/`, `testing/`; seed playbooks; `draft → reviewed → active` flow surfaced through routers.
- **Depends on:** P1 (playbook contract — built), P4 (targets reference entity IDs).

## P6 · Discovery, runs & qualification (Pillars 2–3)

- **Goal:** execute playbooks, record immutable runs, and qualify findings via deterministic tests — the verify-to-promote gate, operationalized.
- **Deliverables:** `workspace/runs/<id>/` run-record artifacts + `runs.jsonl` index; the qualification flow producing `workspace/findings/<id>/` with deterministic test evidence (including the negative-assertion pattern) + `findings.jsonl`; computer-use harness integration; the `workspace/` routers.
- **Depends on:** P4 (data + indexes), P5 (active playbooks to run).

## P7 · Flow C integration

- **Goal:** the user-gated hand-off from a qualified finding into the planning/engineering leg.
- **Deliverables:** the qualified-finding → `system/docs/designs/` promotion path that **obeys the make-docs design router** (reads its workflow/contract/template and preserves the source anchor); the forward-routing "Next Step" wired through the finding contract.
- **Depends on:** P6.

## P8 · Stage automation

- **Goal:** make the flow self-propelling without manual prompting.
- **Deliverables:** hooks + slash-commands for the stage-movers — intake→extract, run→qualify, qualify→design — replacing the deprecated make-docs prompt mechanism where appropriate.
- **Depends on:** P3–P7 (the stages they move between must exist first).

## Cross-cutting

- **Scoping:** configured `systems`, `environments`, and `owners` lists applied across artifacts; a hygiene check.
- **Open decision (Q4):** promotion **enforcement** — documented convention vs. tooling/machinery. Recorded as an open question; does not block the backlog.
