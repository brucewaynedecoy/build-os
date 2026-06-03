# Phase Detail — Capability Build

> The Build OS capability areas to implement in `./system/`, in dependency order.
> Each is a feature area, not a document; the backlog ([`02-derived-outputs.md`](02-derived-outputs.md))
> turns these into tasks. Status reflects the validated first slice already in `./system/`.

## P1 · Operating layer & contracts

- **Goal:** complete `.os/` as the authority + routing brain so every later phase has a contract to
  read before writing.
- **Deliverables:** the remaining `.os/contracts/` files — `entity-records`, `run-record`, `finding`,
  `converted-source` (provenance), `extraction` (load-plan); the `.os/` data/indexes/scripts routers;
  any missing operating routers.
- **Depends on:** — (extends the built slice).
- **Status:** partial — `.os/contracts/playbook-contract.md`, `.os/` + `.os/contracts` + `.os/templates`
  routers, and the guardrail-playbook template already exist and are validated.

## P2 · Spaces, boundary & shipping

- **Goal:** make the build/system/target-docs boundary impossible to cross by accident, and define
  what "shipping `system/`" means.
- **Deliverables:** additional boundary/guardrail playbooks as needed; a runtime-only `system/.gitignore`
  (ignores `node_modules`, `.playwright`, `test-results`; leaves user data tracked); documented
  co-owned-router augmentation procedure.
- **Depends on:** P1.
- **Status:** partial — `PB-001` (plug-in-boundary guardrail) built and active.

## P3 · Intake / conversion (Pillar 1)

- **Goal:** deterministic, tool-first conversion of unstructured sources into clean text/CSV twins —
  no structuring.
- **Deliverables:** a converter per source type (`docx`, `xlsx`, `pdf`, `html`, html-directory, `csv`)
  in `.os/scripts/`; provenance frontmatter on every converted twin; the derived `references.json`
  index; the `assets/` + `assets/converted/` routers.
- **Depends on:** P1 (converted-source contract).

## P4 · Data layer & extraction

- **Goal:** the plain-text knowledge layer and the smart ETL step that populates it.
- **Deliverables:** per-entity NDJSON shapes in `.os/data/` (requirements, capabilities, personas,
  test-cases, results, runs, findings) with the common envelope + per-type IDs; candidate staging;
  first-class extraction load-plans (`extractions.jsonl`); the derived `playbooks.json`; the
  capability/requirement/finding model honored; layered-canonicity discipline.
- **Depends on:** P1 (entity-records + extraction contracts), P3 (converted twins as extraction source).

## P5 · Playbooks (Pillar 2)

- **Goal:** the instruments that guide humans/agents, with the review-to-activate lifecycle.
- **Deliverables:** procedure-playbook template(s) per category/mode; category routers for
  `build/`, `discovery/`, `testing/` (administrative exists); seed playbooks; the
  `draft → reviewed → active` flow surfaced through routers.
- **Depends on:** P1 (playbook contract — built), P4 (targets reference entity IDs).

## P6 · Discovery, runs & qualification (Pillars 2–3)

- **Goal:** execute playbooks, record immutable runs, and qualify findings via deterministic tests —
  the verify-to-promote gate, operationalized.
- **Deliverables:** `workspace/runs/<id>/` run-record artifacts + `runs.jsonl` index; the qualification
  flow producing `workspace/findings/<id>/` with a deterministic Playwright confirmation test (incl.
  the negative-assertion pattern) + `findings.jsonl`; computer-use harness integration; the
  `workspace/` routers.
- **Depends on:** P4 (data + indexes), P5 (active playbooks to run).

## P7 · Flow C integration

- **Goal:** the user-gated hand-off from a qualified finding into the planning/engineering leg.
- **Deliverables:** the qualified-finding → `system/docs/designs/` promotion path that **obeys the
  make-docs design router** (reads its workflow/contract/template; provides finding id + qualification
  anchor); the forward-routing "Next Step" wired through the finding contract.
- **Depends on:** P6.

## P8 · Stage automation

- **Goal:** make the flow self-propelling without manual prompting.
- **Deliverables:** hooks + slash-commands for the stage-movers — intake→extract, run→qualify,
  qualify→design — replacing the deprecated make-docs prompt mechanism.
- **Depends on:** P3–P7 (the stages they move between must exist first).

## Cross-cutting

- **Scoping:** configured `systems`, `environments`, and `owners` lists applied across artifacts;
  a hygiene check.
- **Open decision (Q4):** promotion **enforcement** — documented convention vs. tooling/machinery.
  Recorded as an open question; does not block the backlog.
