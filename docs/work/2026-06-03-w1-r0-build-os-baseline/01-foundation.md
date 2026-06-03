# Phase 01: Operating Layer & Contracts

## Purpose

This phase completes `.os/` as the authority-and-routing brain so every later phase has a contract to read before it writes. It extends the validated first slice rather than starting from scratch.

## Overview

Author the remaining artifact contracts in `system/.os/contracts/` and scaffold the operating routers and directories that the rest of the build depends on. Contracts are the authority; routers stay thin and defer to them.

## Source PRD Docs

- [06 Operating Layer & Routing](../../prd/06-operating-layer-and-routing.md)
- [02 Architecture Overview](../../prd/02-architecture-overview.md)

## Stage 1 - Contracts

### Tasks

- [x] t1: Author `system/.os/contracts/playbook-contract.md` (frontmatter axes, lifecycle, guardrail variant).
- [ ] t2: Author the entity-records contract (common envelope, ID prefix registry, status vocab, per-type fields for requirement/capability/persona/test-case/result/run/finding/extraction).
- [ ] t3: Author the run-record contract (`workspace/runs/<id>/` artifact shape + `runs.jsonl` index fields).
- [ ] t4: Author the finding contract (raw → qualified → design lifecycle; qualification = deterministic repeatable test; forward-routing "Next Step" to the make-docs design router).
- [ ] t5: Author the converted-source provenance contract (frontmatter: source, sha256, converter, timestamp, type, status).
- [ ] t6: Author the extraction load-plan contract (`extractions.jsonl`: source_anchor, minted[], extracted_by/at).

### Acceptance criteria

- Each contract states its required path, required fields/headings, and an `Intended Follow-On` ("Next Step"), mirroring the make-docs contract format.
- Structured entity fields are defined as canonical in `.os/data/*.jsonl`; contracts do not restate router-level routing.
- IDs follow the per-type prefix registry (`REQ`, `CAP`, `PER`, `TC`, `RES`, `RUN`, `FIND`, `EXT`, `PB`).

### Dependencies

- Extends the built first slice (`playbook-contract.md` already present).

## Stage 2 - Operating routers & scaffold

### Tasks

- [x] t7: Operating router `system/.os/AGENTS.md` (+ `CLAUDE.md` pointer).
- [x] t8: `.os/contracts/` and `.os/templates/` routers (+ `CLAUDE.md` pointers).
- [ ] t9: Scaffold `.os/data/` and `.os/indexes/` routers.
- [ ] t10: Scaffold `.os/scripts/` router.

### Acceptance criteria

- Every router carries routing only in `AGENTS.md`; the sibling `CLAUDE.md` is a one-line pointer to it.
- Routers are thin dispatchers that defer authority to `.os/contracts/`.

### Dependencies

- Stage 1 contracts must exist for the routers to reference.
