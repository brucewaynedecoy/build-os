---
title: "Maintaining Operating Layer Contracts"
path: "operating-layer/contracts"
status: draft
order: 100
tags:
  - operating-layer
  - contracts
  - routing
applies-to:
  - system/.os
related:
  - "operating-layer-entities-consolidation-and-resolution.md"
  - "../../../system/.os/AGENTS.md"
  - "../../../system/.os/contracts/AGENTS.md"
  - "../../../system/.os/contracts/config-contract.md"
  - "../../../system/.os/contracts/playbook-contract.md"
  - "../../../system/.os/templates/AGENTS.md"
  - "../../../system/.os/data/AGENTS.md"
  - "../../../system/.os/indexes/AGENTS.md"
  - "../../../system/playbooks/AGENTS.md"
  - "../user/build-os-getting-started.md"
  - "../user/configure-adopter-owned-metadata.md"
  - "../user/validate-system-data-and-indexes.md"
  - "../user/use-playbooks-and-active-indexes.md"
  - "../user/record-discovery-runs-and-qualify-findings.md"
  - "../user/understand-workspace-artifacts.md"
  - "../user/entities-consolidation-curate-and-resolve-records.md"
  - "../../../system/.os/contracts/entity-records-contract.md"
  - "../../../system/.os/contracts/entity-consolidation-contract.md"
  - "../../../system/.os/contracts/persona-identity-contract.md"
  - "../../../system/.os/contracts/run-record-contract.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../../../system/.os/contracts/converted-source-contract.md"
  - "../../../system/.os/contracts/extraction-contract.md"
  - "../../prd/16-revise-toolkit-ownership-boundaries.md"
  - "../../prd/18-revise-unified-buildos-cli-and-distribution.md"
  - "../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md"
  - "../../../system/workspace/AGENTS.md"
  - "../../../system/workspace/runs/AGENTS.md"
  - "../../../system/workspace/findings/AGENTS.md"
  - "../../../system/workspace/datasets/AGENTS.md"
  - "../../../system/playbooks/administrative/respect-configured-scoped-metadata.md"
  - "../../../system/.gitignore"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md"
  - "../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md"
  - "../../../.make-docs/archive/history/2026-06-04-w1-r0-p1-operating-layer-contracts.md"
  - "../../../.make-docs/archive/history/2026-06-04-w1-r0-p2-spaces-boundary-shipping.md"
  - "../../../.make-docs/archive/history/2026-06-04-w1-r0-p4-data-layer-extraction.md"
  - "../../../.make-docs/archive/history/2026-06-04-w1-r0-p5-playbooks.md"
  - "../../../.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md"
persona: maintainer
---

# Maintaining Operating Layer Contracts

## Overview

Use this guide when adding or changing Build OS operating-layer contracts, `.os` routers, active guardrails, scoped metadata, workspace run/finding artifacts, or system-owned data/index routing. The current operating layer is contract first: contracts define authority, shape, lifecycle, and link rules; guardrails define always-on safety rules; routers only tell contributors where to go next.

W1 R4 now implements redirect-aware graph loading, terminal resolution, compatibility and strict validation, reviewed consolidation, and deterministic index rebuilding through the source-built `buildos entities` domain. This is not an installed or packaged release. Use it only from an explicit staged binary against fixtures or a recoverable copied root; binary deployment and live-data migration remain separate operator approvals.

Coverage outcome: `developer`. The durable knowledge here is maintainer-facing because it describes source-of-truth boundaries, extension points, validation, shipping boundaries, and safe-change rules. User-facing operation of the shipped filesystem is covered by the companion user guides for getting started, configuration, validation, playbooks, discovery, and workspace artifacts.

## Project Orientation

- [../../../system/.os/AGENTS.md](../../../system/.os/AGENTS.md) is the root operating-layer router. It should stay thin and route contributors to the more specific area router or contract.
- [../../../system/.os/contracts/AGENTS.md](../../../system/.os/contracts/AGENTS.md) lists authority contracts. Add a contract link here when a new authority contract lands.
- [../../../system/.os/data/AGENTS.md](../../../system/.os/data/AGENTS.md) routes system-owned structured JSONL files. It points writers back to the relevant contract, keeps user datasets out of `.os/data`, and treats empty canonical files as valid until converted source twins produce real rows.
- [../../../system/.os/indexes/AGENTS.md](../../../system/.os/indexes/AGENTS.md) routes rebuildable derived catalogs such as `playbooks.json`. Indexes are not authority; maintain the rebuild command with the index contract.
- [../../../system/.os/templates/AGENTS.md](../../../system/.os/templates/AGENTS.md) routes starter shapes for system artifacts. Procedure playbook templates are split by `execution_mode` and `state_nature`; copy a template, then conform the result to the playbook contract.
- [../../../system/playbooks/AGENTS.md](../../../system/playbooks/AGENTS.md) is the top playbook router. Category routers under `administrative/`, `build/`, `discovery/`, and `testing/` must keep active runnable or enforced entries separate from draft seed candidates.
- [../../../system/workspace/AGENTS.md](../../../system/workspace/AGENTS.md) routes operational artifacts. Runs, qualified findings, and local datasets live under `system/workspace/`; structured JSONL indexes for runs and findings live under `system/.os/data/`.
- [../../../system/workspace/runs/AGENTS.md](../../../system/workspace/runs/AGENTS.md) routes immutable `RUN-NNN/` artifacts and points writers to the run-record contract.
- [../../../system/workspace/findings/AGENTS.md](../../../system/workspace/findings/AGENTS.md) routes `FIND-NNN/` artifacts and documents the negative-assertion qualification pattern.
- [../../../system/workspace/datasets/AGENTS.md](../../../system/workspace/datasets/AGENTS.md) keeps adopter-owned datasets out of `.os/data`.
- [../../../system/playbooks/administrative/respect-configured-scoped-metadata.md](../../../system/playbooks/administrative/respect-configured-scoped-metadata.md) is the active guardrail for config-backed scoped metadata.
- `system/.gitignore` is part of the shipped `system/` boundary. It ignores runtime ephemera only; data tracking or ignoring remains the adopter's choice.
- The repository root `.gitignore` also has broad build-output rules. Keep the `system/playbooks/build/` exception in place so the build playbook category remains source-controlled.
- `CLAUDE.md` files in these directories are one-line pointers to the matching `AGENTS.md`. Do not duplicate routing rules in them.

The current operating-layer contract set includes:

| Contract | Owns |
| --- | --- |
| [config-contract.md](../../../system/.os/contracts/config-contract.md) | Adopter-owned instance config shape, configured `systems`, `environments`, and `owners`, defaults, and scoped metadata reference rules. |
| [playbook-contract.md](../../../system/.os/contracts/playbook-contract.md) | Playbook frontmatter, guardrail/procedure body shapes, lifecycle, and scoped metadata expectations for playbooks. |
| [entity-records-contract.md](../../../system/.os/contracts/entity-records-contract.md) | Canonical `.os/data/*.jsonl` entity envelopes, ID prefixes, anchors, per-type fields, lifecycle, reviewed redirects, and terminal canonical-resolution rules. |
| [entity-consolidation-contract.md](../../../system/.os/contracts/entity-consolidation-contract.md) | Version 1 reviewed manifests, single-dataset atomic mutation, compatibility/strict validation, deterministic index projection, and post-write recovery. |
| [persona-identity-contract.md](../../../system/.os/contracts/persona-identity-contract.md) | Persona-only exact ID, approved-alias, and `persona-v1` identity matching; ambiguous or probabilistic matches remain review-only. |
| [run-record-contract.md](../../../system/.os/contracts/run-record-contract.md) | Run artifact directories, immutable run evidence, outcome values, raw findings, and `.os/data/runs.jsonl` index fields. |
| [finding-contract.md](../../../system/.os/contracts/finding-contract.md) | Raw to qualified to optional design lifecycle, deterministic qualification tests, and negative-finding qualification. |
| [converted-source-contract.md](../../../system/.os/contracts/converted-source-contract.md) | Converted twin provenance frontmatter for source, hash, converter, timestamp, type, and status. |
| [extraction-contract.md](../../../system/.os/contracts/extraction-contract.md) | Extraction rows with source anchors, minted entity or playbook IDs, optional dataset references, extractor identity, and extraction timestamps. |

## Development Workflow

1. Start at the nearest `AGENTS.md` router before editing a `.os` area.
2. Identify the authority contract before changing a data shape, lifecycle, status value, path rule, or generated artifact boundary.
3. Update the contract first when behavior needs a new authority rule. Keep the contract format consistent: `Purpose`, `Required Path`, `Required Shape/Fields`, lifecycle or status rules where relevant, `Intended Follow-On (Next Step)`, and `Link Rules`.
4. Update the router only after the contract is correct. Routers should explain where to write and what contract to consult; they should not restate schema details.
5. Keep `CLAUDE.md` as a pointer only.
6. When changing scoped metadata, read `config-contract.md`, use `systems`, `environments`, and `owners` as list fields, and reference only configured IDs from `system/.os/config/instance.yaml` when scope applies.
7. When a phase creates canonical `.os/data` JSONL files, create the file shape first and keep rows empty unless converted source twins or other real source evidence exist.
8. For entity rows, use the common envelope, require `source_anchor`, and require `doc_anchor` once `status` is not `draft`.
9. For consolidation work, preserve every losing row and its provenance. Use `superseded` only with one reviewed redirect to an immediate same-type successor; never use `related` as a canonical pointer or hand-maintain reverse members on the winner.
10. Build the W1 R4 `buildos` seed under `toolkits/buildos/` and invoke it by explicit path. Preview reviewed manifests without `--apply`, and apply only to a recoverable copied root unless separate live-data approval has been recorded.
11. Rebuild indexes with the command named by the owning router. Do not hand-maintain derived JSON catalogs.
12. After the edit, update the active work backlog and history record only after validation.

## Playbook Maintenance

Use this workflow when adding or revising playbooks, procedure templates, or category routers:

1. Read [playbook-contract.md](../../../system/.os/contracts/playbook-contract.md) before choosing fields or body headings.
2. Choose the category directory from the playbook's purpose: `administrative`, `build`, `discovery`, or `testing`.
3. For procedure playbooks, start from the template matching both `execution_mode` and `state_nature` under [`.os/templates`](../../../system/.os/templates/AGENTS.md). Guardrails use the guardrail template and `execution_mode: n/a`.
4. Mint the next flat `PB-NNN` id. Do not encode category in the id.
5. Set new playbooks to `status: draft`. Only `status: active` playbooks are runnable as procedures or enforced as guardrails.
6. Link `targets` to existing `REQ-*`, `CAP-*`, or `TC-*` rows in `.os/data`. If no appropriate row exists, add the smallest source-backed draft entity row rather than inventing an untracked target.
7. Update the relevant category router after the playbook exists. Active procedures and guardrails belong in active sections; draft playbooks belong only in draft seed candidate sections.
8. Rebuild `system/.os/indexes/playbooks.json` and verify the full `playbooks` catalog includes every lifecycle state while `runnable_playbooks` includes only active entries.

## Discovery Runs And Finding Qualification

Use this workflow when maintaining run-record or finding-qualification behavior:

1. Read [run-record-contract.md](../../../system/.os/contracts/run-record-contract.md), [finding-contract.md](../../../system/.os/contracts/finding-contract.md), and [entity-records-contract.md](../../../system/.os/contracts/entity-records-contract.md) before changing run/finding row shape.
2. Treat `system/workspace/runs/RUN-NNN/` as immutable once a run closes. Store the human summary in `run.md`, raw observations in `raw-findings.md`, and copied evidence under `evidence/`.
3. Keep raw findings inside the source run until a deterministic repeatable confirmation test promotes one to `system/workspace/findings/FIND-NNN/`.
4. Record discovery runs through `buildos-discovery run discovery`. It requires an active `category: discovery` playbook from `system/.os/indexes/playbooks.json`, resolves authored and explicit governed targets through `toolkits/buildos/pkg/entities`, records requested targets and complete chains, stores terminal canonical targets in the new run, allocates the next `RUN-NNN`, writes the run folder, and appends to `system/.os/data/runs.jsonl`. Never rewrite the authored playbook target.
5. Record qualified findings through `buildos-discovery qualify finding`. It resolves the requested source run to a terminal `running`, `closed`, or `aborted` run; requires a raw finding anchor, a Playwright confirmation test file, confirmation evidence, and a positive or negative outcome before allocating the next `FIND-NNN`. Preserve `requested_run_id` and the raw anchor, but write the canonical run into new governed references.
6. For negative findings, make the passing confirmation test assert the negative condition. This is a regression guard against silent fixes or accidental behavior changes.
7. Keep the computer-use harness boundary explicit. The live harness is external; this repository records playbook metadata, targets, dataset refs, evidence, raw findings, confirmation tests, and outcomes.
8. Do not write adopter datasets to `.os/data`. Use `system/workspace/datasets/` and reference them from run rows with project-relative paths.
9. Treat `qualified` as a finding-only terminal status. Do not accept it for a run or another entity type, and do not promote a finding unless its resolved canonical row is `qualified`.
10. Resolve from authoritative canonical JSONL even when `.os/indexes/entity-resolution.json` is stale. Invalid graphs, unknown IDs, or invalid terminal states must fail before any run, finding, or design write.

For manual UAT, prefer a scratch copy of the repository when the current checkout has no active discovery playbook or when the evidence, raw finding, or confirmation test would be disposable. Activate or seed a discovery playbook only in the scratch copy, create temporary evidence and confirmation files there, run `buildos-discovery run discovery`, run `buildos-discovery qualify finding`, then inspect the `RUN-NNN/`, `FIND-NNN/`, `runs.jsonl`, and `findings.jsonl` outputs. Do not add scratch-only playbook index edits, evidence files, raw findings, or confirmation tests to the live shippable `system/` tree.

## Safe-Change Rules

- Treat contracts as authority and indexes as derived.
- Preserve NDJSON, JSONL, or CSV as the only system-owned structured data formats under `.os/data`.
- Keep user datasets out of `.os/data`; route them to `system/workspace/datasets/`.
- Use configured scoped metadata fields: `systems`, `environments`, and `owners`. Do not use legacy fields such as `env`, `envs`, `for`, or `target_systems`, and do not invent local scoped-value enums.
- Keep `system/.gitignore` runtime-only. It may ignore ephemera such as `node_modules/`, `.playwright/`, and `test-results/`, but it must not hide `.os/data/` or `workspace/datasets/` by default.
- Do not add new ID prefixes without updating [entity-records-contract.md](../../../system/.os/contracts/entity-records-contract.md).
- Preserve the originally recorded entity ID on historical reads while exposing the terminal canonical ID and full resolution chain. W1 R4 discovery and design integrations store terminal canonical IDs in new governed references while retaining requested IDs and chains for provenance.
- Reject missing redirect targets, self-links, cross-type targets, cycles, inactive terminals, duplicate IDs, illegal redirect statuses, and conflicting remaps. Never guess a successor for a legacy `superseded` row.
- Treat `entity-resolution.json` as a derived index built only from canonical JSONL. Do not put entity aliases or redirects in `references.json`.
- Keep `draft` as the pending promotion state for entity and extraction rows. Do not introduce a separate `candidate` status unless the contract and PRD vocabulary are deliberately revised together.
- Require `source_anchor` on every entity row. Require `doc_anchor` under `system/docs/` for rows promoted out of `draft`.
- Keep `extractions.jsonl` load plans explicit about `minted` IDs, `extracted_by`, and `extracted_at`; use `dataset_refs` only for optional dataset paths.
- Do not add outcome, lifecycle, or status values in only one contract when another contract depends on the same vocabulary.
- Do not write directly into make-docs managed `system/docs` trees unless the relevant router or phase explicitly permits it.
- Do not route draft, reviewed, or archived playbooks through runnable procedure or enforced guardrail sections. Keep the active-only gate visible in routers and derived indexes.
- Do not remove the root `.gitignore` exception for `system/playbooks/build/`; otherwise the build category can disappear from Git status and index rebuilds.
- Do not index raw findings as qualified findings. A `FIND-NNN` row requires the source run, raw anchor, deterministic confirmation test, confirmation evidence, and `status: qualified`.
- Do not implement run/finding commands in `buildos-intake` or add run/finding-specific validation to `validate_config.py`; PRD 16 assigns that ownership to `buildos-discovery`.

## Validation

Run the operating-layer checks after changing `.os` contracts or routers:

```sh
python3 system/.os/scripts/validate_config.py --self-test
python3 system/.os/scripts/validate_config.py
```

These Python commands do not prove that redirect-bearing data is safe. Whole-graph and redirect certification belongs to the source-built `buildos entities validate`; there is no public `buildos-entities` executable. A successful source-build test still does not authorize installed-binary replacement or live-data migration.

Run the unified module checks after changing entity contracts, graph behavior, canonical mutation, or the derived index:

```sh
cd toolkits/buildos
go test ./...
go test -race ./...
go vet ./...
go build ./...
go test ./internal/cli -run TestPersonaCopiedRootRehearsal -count=1
```

Run discovery and design module tests when shared resolution or governed-reference behavior changes, because W1 R4 temporarily shares `toolkits/buildos/pkg/entities` through explicit local module dependencies. W1 R5 removes that temporary boundary after those domains migrate into the unified module.

Then refresh the project documentation index and check links where practical. Review the diff for:

- valid relative links from new or changed documents
- thin routers with no duplicated contract schema
- one-line `CLAUDE.md` pointers
- scoped metadata using `systems`, `environments`, and `owners` list fields backed by `system/.os/config/instance.yaml`
- a runtime-only `system/.gitignore` that does not ignore `.os/data/` or `workspace/datasets/`
- no fabricated rows in canonical `.os/data/*.jsonl` files
- populated entity rows with the expected file/type pairing, ID prefix, lifecycle status, anchors, and scoped IDs
- generated catalogs only under `.os/indexes`, with a deterministic rebuild command and no authority-only fields invented in the index
- playbook catalogs with `playbooks` as the full lifecycle catalog and `runnable_playbooks` as the active-only subset
- run rows with `outcome`, `playbook_id`, `playbook_version`, target IDs, artifact counts, and object-shaped `inputs`/`outputs`
- finding rows with `status: qualified`, `run_id`, `confirmation_test`, `confirmation_evidence`, and negative assertions for negative findings
- no direct edits to make-docs managed trees outside the phase scope

Finish with:

```sh
git diff --check
```

## Troubleshooting

If a router starts accumulating field definitions, move the field details into the owning contract and leave a short link in the router.

If a new data file seems necessary, first decide whether it is authority data, a rebuildable index, a user dataset, or a run artifact. `.os/data` is for system-owned structured authority or index records only; `.os/indexes` is for derived catalogs only; user datasets belong under `system/workspace/datasets/`.

If `validate_config.py` reports a JSONL row failure, fix the source-of-truth row instead of suppressing validation. Common causes are file/type mismatches, bad ID prefixes, `candidate` status, missing `source_anchor`, missing promoted `doc_anchor`, or scoped IDs that are not configured in `system/.os/config/instance.yaml`.

If a generated index is stale, rerun the owning rebuild command and inspect the deterministic order before editing the output. A generated index should be explainable from its source files.

If `buildos entities` exits `5`, the canonical write did not complete; preserve the diagnostic and verify that copied-root bytes remain unchanged. If it exits `6`, the canonical row update completed but index rebuilding failed; do not roll back or hand-edit the index automatically. Run the exact `buildos entities rebuild-index ... --apply` correction reported by the diagnostic, then repeat strict validation and the index check.

If a build category playbook does not appear in Git status or the generated playbook index, check the root `.gitignore` exception for `system/playbooks/build/` before changing the playbook scanner.

If `buildos-discovery run discovery` rejects a playbook, rebuild `system/.os/indexes/playbooks.json` and confirm the playbook is in `runnable_playbooks`, has `status: active`, and has `category: discovery`.

If `buildos-discovery qualify finding` rejects a raw finding reference, use either `#raw-finding-N`, `raw-findings.md#raw-finding-N`, or the full `system/workspace/runs/RUN-NNN/raw-findings.md#raw-finding-N` form for the source run being qualified.

If `--confirmation-test` or an evidence flag fails a path check during manual UAT, create the disposable file inside the scratch copy or point to a real deterministic test/evidence artifact from the target system. Do not stage scratch-only artifacts in the live product tree.

If link checking reports repository-wide noise, separate baseline failures from touched-file failures. Fix every broken link introduced by the current change, and record any unrelated baseline noise in the closeout instead of hiding it.

## Related Resources

- [P1 work backlog](../../work/2026-06-03-w1-r0-build-os-baseline/01-foundation.md)
- [P1 history record](../../../.make-docs/archive/history/2026-06-04-w1-r0-p1-operating-layer-contracts.md)
- [P2 boundary and shipping backlog](../../work/2026-06-03-w1-r0-build-os-baseline/02-boundary-and-shipping.md)
- [P2 history record](../../../.make-docs/archive/history/2026-06-04-w1-r0-p2-spaces-boundary-shipping.md)
- [P4 data and extraction backlog](../../work/2026-06-03-w1-r0-build-os-baseline/04-data-and-extraction.md)
- [P4 history record](../../../.make-docs/archive/history/2026-06-04-w1-r0-p4-data-layer-extraction.md)
- [P5 playbooks backlog](../../work/2026-06-03-w1-r0-build-os-baseline/05-playbooks.md)
- [P5 history record](../../../.make-docs/archive/history/2026-06-04-w1-r0-p5-playbooks.md)
- [P6 discovery runs backlog](../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md)
- [P6 history record](../../../.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md)
- [Build OS Getting Started](../user/build-os-getting-started.md)
- [Configure Adopter-Owned Metadata](../user/configure-adopter-owned-metadata.md)
- [Validate System Data and Indexes](../user/validate-system-data-and-indexes.md)
- [Use Playbooks and Active Indexes](../user/use-playbooks-and-active-indexes.md)
- [Record Discovery Runs and Qualify Findings](../user/record-discovery-runs-and-qualify-findings.md)
- [Understand Workspace Artifacts](../user/understand-workspace-artifacts.md)
- [Curate and Resolve Duplicate Entity Records](../user/entities-consolidation-curate-and-resolve-records.md)
- [Entity Consolidation Maintainer Guide](operating-layer-entities-consolidation-and-resolution.md)
- [Operating router](../../../system/.os/AGENTS.md)
- [Contracts router](../../../system/.os/contracts/AGENTS.md)
- [Config contract](../../../system/.os/contracts/config-contract.md)
- [Playbook contract](../../../system/.os/contracts/playbook-contract.md)
- [Templates router](../../../system/.os/templates/AGENTS.md)
- [Playbooks router](../../../system/playbooks/AGENTS.md)
- [Entity records contract](../../../system/.os/contracts/entity-records-contract.md)
- [Extraction contract](../../../system/.os/contracts/extraction-contract.md)
- [Configured scoped metadata guardrail](../../../system/playbooks/administrative/respect-configured-scoped-metadata.md)
- [Data router](../../../system/.os/data/AGENTS.md)
- [Indexes router](../../../system/.os/indexes/AGENTS.md)
- [Workspace router](../../../system/workspace/AGENTS.md)
- [Runs router](../../../system/workspace/runs/AGENTS.md)
- [Findings router](../../../system/workspace/findings/AGENTS.md)
- [Datasets router](../../../system/workspace/datasets/AGENTS.md)

## Future Coverage

- Blocked by: Later phases that implement extraction loaders, additional index rebuilds, live computer-use harness adapters, and operational recovery paths. Update when: those phases introduce runnable commands, generated artifacts, or recovery paths beyond the current filesystem-first run/finding recorders. Guide change: Add adapter-specific command examples, generator ownership rules, artifact cleanup guidance, and troubleshooting for failed conversions, harness execution, or index rebuilds.
- Blocked by: W1 R5 unified CLI consolidation and distribution. Update when: intake, discovery, and design command parity, temporary legacy-name aliases, signed `buildos 0.1.0` archives, checksums, SBOMs, provenance, and Homebrew workflows pass. Guide change: replace the source-build and temporary cross-module boundary with the verified packaged maintenance workflow.
- Blocked by: W2 installation lifecycle. Update when: manifest-backed setup, update, backup, project removal, and machine uninstall behavior passes. Guide change: add managed/adopter-owned/derived file classifications and verified lifecycle recovery procedures.
