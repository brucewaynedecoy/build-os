# 01 PRD Authority Maintenance

## Purpose

Give every receiving change from the [source design](../../designs/2026-11-23-prd-set-authority-cleanup.md#decision) one maintenance decision, name the exact PRD sections to change, specify the PRD 17 rename and the PRD 13 restructure, and list the requirement-history entries. Row numbers such as `17-12` refer to [04 Requirement Inventory](./04-requirement-inventory.md).

## Candidate Decision Matrix

There is no `create` decision. Every receiving change lands in an existing owner, or needs no PRD change. "17" below means PRD 17 after its restructure, at its new name `17-entity-identity-and-canonical-resolution.md`.

| ID | Candidate | Inventory rows | Decision | Owning PRD and section | Reason |
| --- | --- | --- | --- | --- | --- |
| C-01 | Purpose and scope of entity identity: generic, non-destructive consolidation; personas first; other types enabled one at a time; first release scope | 17-01, 17-19, 17-45 | `update-existing` | 17 `## Purpose`, `## Scope` | PRD 17 owns entities; text moves out of editorial headings |
| C-02 | Entities domain owns graph operations; extraction helpers are a separate decision | 16-09 | `update-existing` | 17 `## Scope` | Entity scope belongs with the entity owner |
| C-03 | Entities domain inside `toolkits/buildos/`, commands `consolidate`, `resolve`, `validate`, `rebuild-index`, direct calls from discovery and design | 17-07, 17-08 | `update-existing` | 17 `## Component and Capability Map` | Same owner, template section |
| C-04 | Entity command flag contract: `--root`, `--mode compat\|strict`, `--id`, `--manifest`, `--apply`, `--check`, dry-run default for `consolidate`, check default for `rebuild-index`, `--check` and `--apply` mutually exclusive, explicit root and mode required | 18-12, 17-09, 17-10 | `update-existing` | 17 `## Component and Capability Map`, new `### Entity commands` | Gap: only superseded PRD 18 states it (design decision 2) |
| C-05 | Command reports package version, source revision, resolved root, mode, and write status | 17-13 | `link-only` | 17 links [PRD 20 Output and Exit Contract](../../prd/20-buildos-cli-and-distribution.md#output-and-exit-contract) | PRD 20 already owns the envelope; say "package version" |
| C-06 | Thin wrappers only; no durable Python; no `buildos-entities` name | 17-14 | `none` | Already in [06](../../prd/06-operating-layer-and-routing.md) and [20](../../prd/20-buildos-cli-and-distribution.md#legacy-command-names) | Owned elsewhere |
| C-07 | Lifecycle and redirect rules: losing row intact, one reviewed redirect, derived reverse membership, `related` non-canonical, `superseded` and `archived` meaning, type-aware terminal states | 17-02, 17-03, 15-07, 17-33, 17-43 | `update-existing` | 17 `## Contracts and Data`, `### Lifecycle and redirects` | Same owner |
| C-08 | Redirect object schema and `kind` values | 17-31, 17-32 | `update-existing` | 17 `## Contracts and Data`, `### Redirect object` | Same owner |
| C-09 | Terminal resolution: shared resolver, read and write rules, fail-closed cases, result shape | 17-04, 17-05, 17-06, 17-34 | `update-existing` | 17 `## Contracts and Data`, `### Terminal resolution` | Same owner |
| C-10 | Strict and compatibility modes | 17-15, 17-16 | `update-existing` | 17 `## Contracts and Data`, `### Strict and compatibility modes` | Same owner |
| C-11 | Matching and review policy, `persona-v1`, `extraction-outcomes-v1` | 17-17, 17-18, 17-20 | `update-existing` | 17 `## Contracts and Data`, `### Matching and review policy`; 08 links to it | Resolver-dependent contract stays with the resolver |
| C-12 | Reviewed consolidation manifest, single dataset in version 1, atomic write and permissions | 17-11, 17-35, 17-12 | `update-existing` | 17 `## Contracts and Data`, `### Reviewed consolidation manifest` and `### Atomic writes` | Same owner |
| C-13 | Derived index: scaffold path `system/.os/indexes/entity-resolution.json`, installed path `.os/indexes/entity-resolution.json`, lexical order, rebuildable | 17-36, 18-13 | `update-existing` | 17 `## Contracts and Data`, `### Derived index` | Index path only in superseded PRD 18 today |
| C-14 | Shared terminal resolver across readers, validators, playbooks, extraction, and producers; validation details | 17-38, 17-39, 17-44 | `update-existing` | 17 `## Integrations` | Same owner |
| C-15 | Pre-upgrade audit prompt in a Make Docs-managed tree | 17-46 | `update-existing` or `none` | 17 `## Integrations` links the prompt at `docs/assets/maintainer/`, or the prompt is retired and 17 drops it | Design decision 6; the implementer records which |
| C-16 | Adoption and live-root migration safety, restated for the npm package: separate verify, adopt, and live-data actions; snapshot; compat and dry run on a copy; strict validation; index reproduction; pinned version in `.os/manifest.json`; separate approval to mutate the live root; old tooling read-only for redirect-bearing data until cutover | 17-21, 17-22 (steps 3–7 and 9), 17-23 (second half), 17-47, 14-13 | `update-existing` | 17 `## Rebuild Notes`, `### Adoption and live-root migration safety`; links [20 Project Initialization and Adoption](../../prd/20-buildos-cli-and-distribution.md#project-initialization-and-adoption) and `R-004` | Design decision 3 |
| C-17 | Acceptance list for the entity engine | 17-25 | `update-existing` | 17 `## Rebuild Notes`, `### Acceptance` | Same owner |
| C-18 | Go source-build upgrade steps, Go rehearsal anchors, W1 R4 implementation notes, copied-root rehearsal evidence | 17-21 (Go wording), 17-22 (steps 2 and 8), 17-24, 17-26 (evidence), 17-27 | `update-existing` | 17 `## Requirement History` | Retired from current requirements (design decision 3) |
| C-19 | `draft` lifecycle for `.os/data/*.jsonl` and extraction load-plans; lifecycle vocabulary; promotion gate (`source_anchor` always, `doc_anchor` when not `draft`) | 15-01, 15-02, 15-03, 15-04 | `update-existing` | [08](../../prd/08-data-and-extraction.md#contracts-and-data) `## Contracts and Data` | PRD 08 owns `.os/data` and draft staging |
| C-20 | Consumers keep original IDs and expose canonical plus chain; producers store canonical IDs | 17-39 | `update-existing` | [08](../../prd/08-data-and-extraction.md#integrations) `## Integrations`, linking 17 | Today only a change note |
| C-21 | Converted twins may use `candidate` only under the converted-source contract | 15-05 | `update-existing` | [07](../../prd/07-intake-and-conversion.md#contracts-and-data) `## Contracts and Data` | Conversion state belongs with conversion |
| C-22 | `references.json` is the intake index and never carries entity redirects | 17-37 | `update-existing` | [07](../../prd/07-intake-and-conversion.md#contracts-and-data) `## Contracts and Data`; 17 links | Boundary of the intake index |
| C-23 | Intake subcommand names | 18-15 (intake part) | `none` | Already in 07 | Already inline; implementer confirms |
| C-24 | Domain ownership rule: one package, one CLI, each domain a separate part with its own scope contract; package boundary does not merge domain boundaries; no cross-domain subprocess calls; no unrelated commands | 16-01, 16-03, 14-02, 14-03, 18-02 | `update-existing` | [02](../../prd/02-architecture-overview.md#module-map) `## Module Map` | Architecture rule across owners (design decision 1) |
| C-25 | Short normative procedure before adding logic | 16-02 | `update-existing` | 02 `## Module Map` (short rule); step detail in `docs/assets/maintainer/buildos-toolkit-cli-development.md` | Process detail is a maintainer guide |
| C-26 | Domain ownership inventory, reconciled with the PRD 20 domain table (adds entities, `init`, `validate`, `fitgap`, `export`, `extract bulk`; drops "Planned `buildos-config`") | 16-04 | `update-existing` | 02 `## Module Map` table | Stale in PRD 16 |
| C-27 | PRD 20 links domain ownership | 16-01 | `link-only` | [20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface) links 02 `## Module Map` | Navigation only |
| C-28 | Scoped vocabulary body fix: `env`/`for` tags no longer scope artifacts | 13-07 | `update-existing` | [02](../../prd/02-architecture-overview.md#configuration-surfaces) `## Configuration Surfaces` | Body still states the old rule; only a change note overrides it |
| C-29 | PRD 16 W1 R7 requirement-history entry | 16-11 | `update-existing` | 02 `## Requirement History`, moved with its original date and coordinate | Safety rule 3 |
| C-30 | Local-only rule: the CLI makes no network calls; exceptions are the `npx` package fetch and the user-chosen Make Docs setup; any new network call needs an accepted design and an opt-in flag | 14-06, 19-16 (network part) | `update-existing` | [20 Runtime and Package](../../prd/20-buildos-cli-and-distribution.md#runtime-and-package) | Gap: only PRD 14 holds it (design decision 2) |
| C-31 | PRD 20 links to 13 and 17, and its source anchors for 14, 18, and 19 | — | `link-only` | 20 `## Scope`, `## Command Surface`, `## Compatibility`, `## Source Anchors` | Rename and archive paths |
| C-32 | Config files, contract, starter template, and scoped vocabulary | 13-01, 13-02, 13-03, 13-05, 13-06, 13-07, 13-10, 13-11, 13-12, 13-13 | `update-existing` | 13 restructured, see [PRD 13 restructure spec](#prd-13-restructure-spec) | Same owner, template sections |
| C-33 | `buildos validate` check list: config file, ID uniqueness and slug format, `environments[].systems` and `defaults.*` references, scoped frontmatter and data references, frontmatter hygiene, and entity record hygiene (lifecycle values, `source_anchor`, `doc_anchor`), exactly as `system/.os/scripts/validate_config.py` checks today | 13-04, 13-16, 13-17, 13-20 | `update-existing` | 13 `## Contracts and Data`, `### buildos validate checks` | Gap for entity hygiene (design decision 2); parity rule in PRD 20 |
| C-34 | Scoped-field migration condition ("once the migration lands") | 13-17 | `update-existing` | 13 `## Contracts and Data` | Unconditional if the migration has landed; condition stays if not (design decision 6) |
| C-35 | Validation runs through `buildos validate`; no Python | 13-14 | `update-existing` | 13 links [20 Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface); one statement only | Duplicated in 06 and 20 today |
| C-36 | Scope resolution through `instance.yaml` for contracts, indexes, playbooks, data, runs, findings, and hand-off metadata | 13-15 | `update-existing` | 13 `## Integrations` | Same owner |
| C-37 | Glossary terms `systems`, `environments`, `owners`; `Draft` and entity rows drop the 15 and 17 file paths | 13-05, 15-09 | `update-existing` | [04](../../prd/04-glossary.md) `## Terms` | Glossary owns terms |
| C-38 | Playbook targets that name a losing ID stay auditable and resolve canonically when used | 17-40 | `update-existing` | [09](../../prd/09-playbooks.md#contracts-and-data) `## Contracts and Data` | Exists only as 09 change notes |
| C-39 | Discovery stores canonical targets and run links, keeps requested IDs and chains; names `buildos discovery run` and `buildos discovery qualify` | 17-41, 18-15 (discovery part) | `update-existing` | [10](../../prd/10-discovery-runs-and-qualification.md#contracts-and-data) `## Contracts and Data` and `## Component and Capability Map` | Exists only as a change note; 10 does not name the commands today |
| C-40 | Design promotion resolves a requested finding to a terminal `qualified` finding and writes the back-reference to the canonical finding | 17-42 | `update-existing` | [11](../../prd/11-flow-c-integration.md#contracts-and-data) `## Contracts and Data` | 11 owns `design promote`; not inline today |
| C-41 | Baseline `### Change Notes` bullets in 01–12 that point at PRDs 13–19 (65) | 13-08, 14-15, 15-10, 16-12, 17-48, 19-28 | `update-existing` | Each of 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, in the section that holds the note | Design decision 4 |
| C-42 | Open domain-ownership decisions for playbooks, data and extraction, and stage automation | 16-05, 16-08 (stage part) | `update-existing` | Register: new `Q` item | `D-002` is closed and no item tracks these |
| C-43 | `Q-001` points at PRD 19 for the approved result | 19-20 | `update-existing` | Register `Q-001` | PRD 19 was never approved |
| C-44 | PRD 19 capability matrix as input to the future MCP revision | 19-01, 19-04, 19-18, 19-19 | `update-existing` | Register `Q-011` and `Q-012` cite the archived copy | Design decision 1 |
| C-45 | Live-root migration gate | 17-26, 17-47 | `update-existing` | Register `R-004` links 17 `## Rebuild Notes` | Package version pin replaces binary cutover |
| C-46 | W2 lifecycle remnants and upgrade, rollback, and uninstall smoke tests | 18-19, 18-20, 18-21 | `update-existing` | Register `R-003` names them, if it does not already | Design decision 6 |
| C-47 | `D-005` closure | — | `update-existing` | Register `D-005`: `Closed` with `Resolution` | Done criteria met |
| C-48 | Index Document Map, Reading Order, Audience Paths, Source Anchors, Current Authority Map | — | `link-only` | [PRD index](../../prd/00-index.md) | See [02](./02-archive-links-and-index.md#index-changes) |
| C-49 | Rows superseded by PRD 20 | 14-01, 14-04, 14-05, 14-07, 14-09, 18-01, 18-04 to 18-11, 18-16 to 18-18, 19-03, 19-13, 19-17 | `none` | Already in [20](../../prd/20-buildos-cli-and-distribution.md) | Owned and current |
| C-50 | Rows already inline in another owner | 14-08, 14-11, 15-06, 16-08 (07 and 11 parts), 17-23 (first half, in 20), 19-08, 19-09, 19-22 to 19-27 | `none` | 05, 06, 07, 08, 11, 20 as named in the inventory | Owned and current |
| C-51 | Historical, editorial, or never-approved rows | 13-08, 13-09, 13-18, 14-10, 14-12, 14-14, 14-15, 15-08, 15-09, 15-10, 16-06, 16-07, 16-10, 16-12, 17-28 to 17-30, 17-48, 18-03, 18-14, 18-22, 19-01, 19-02, 19-04 to 19-07, 19-10 to 19-12, 19-14, 19-15, 19-21, 19-28 | `none` | None; the text stays in the archived copy | No current requirement |
| C-52 | PRD 13 W1 R7 requirement-history entry | 13-19 | `none` | 13 `## Requirement History` keeps it as is | Already in valid form |

The trace check in backlog P3 confirms or corrects each row in [04](./04-requirement-inventory.md). A row the matrix does not cover blocks P4.

## Existing PRDs To Update

| Existing PRD | Owning sections | Current normative update | Preserved surrounding authority |
| --- | --- | --- | --- |
| `17-enhance-entity-consolidation-and-canonical-resolution.md` (renamed to `17-entity-identity-and-canonical-resolution.md`) | All; see [PRD 17 rename spec](#prd-17-rename-spec) | C-01 to C-18 | Every current entity contract, unchanged in meaning |
| `13-adopter-owned-config-surface.md` | All; see [PRD 13 restructure spec](#prd-13-restructure-spec) | C-32 to C-36 | Config schema and semantics; the W1 R7 history entry; the `## Contracts and Data` anchor |
| `08-data-and-extraction.md` | `## Contracts and Data`, `## Integrations`, `### Change Notes` in each section | C-19, C-20, C-41 | Layered canonicity, extraction ETL, scope |
| `07-intake-and-conversion.md` | `## Contracts and Data`, `### Change Notes` | C-21, C-22, C-41 | Converter list, provenance fields, accuracy gate |
| `02-architecture-overview.md` | `## Module Map`, `## Configuration Surfaces`, `## Requirement History`, `### Change Notes` | C-24 to C-26, C-28, C-29, C-41 | Topology, runtime boundaries, data flow |
| `20-buildos-cli-and-distribution.md` | `## Runtime and Package`, `## Command Surface`, `## Scope`, `## Compatibility`, `## Source Anchors` | C-30, C-27, C-31 | Every other section |
| `09-playbooks.md` | `## Contracts and Data`, `### Change Notes` | C-38, C-41 | Playbook contract, gates, guardrails |
| `10-discovery-runs-and-qualification.md` | `## Component and Capability Map`, `## Contracts and Data`, `### Change Notes` | C-39, C-41 | Run and qualification model |
| `11-flow-c-integration.md` | `## Contracts and Data`, `### Change Notes` | C-40, C-41 | Export, hand-off, and the W1 R7 promotion limitation |
| `04-glossary.md` | `## Terms`, `### Change Notes` | C-37, C-41 | Existing terms |
| `01-product-overview.md`, `05-spaces-boundary-and-shipping.md`, `06-operating-layer-and-routing.md`, `12-stage-automation.md` | `### Change Notes` in each section, and the body text a note overrides | C-41 | Everything else |
| `03-open-questions-and-risk-register.md` | New `Q` item, `Q-001`, `Q-011`, `Q-012`, `R-003`, `R-004`, `D-005`, and links to PRDs 13–19 | C-42 to C-47 | Fixed sections and numbering |
| `00-index.md` | `## Purpose`, `## Reading Order`, `## Document Map`, `## Source Anchors`, `## Audience Paths`, `## Current Authority Map` | C-48 | Index shape |

Folding rule for C-41, from design decision 4: a note that carries a current requirement moves into the section body; a note that carries a material prior contract becomes a `## Requirement History` entry in that PRD; every other note is deleted. Where the body still states something a note overrides, the body is corrected. A `### Change Notes` section that becomes empty is removed. Notes that do not point at PRDs 13–19 stay as they are.

## Genuinely New Product PRDs

None. Entities and config already have PRD numbers. Renaming PRD 17 in place and restructuring PRD 13 give a product-named owner without a second identity or a gap. Domain ownership, the draft lifecycle, and the local-only rule fit existing owners (02, 08, 20). PRD 19 holds no current requirement that lacks an owner.

## PRD 17 Rename Spec

- New filename: `docs/prd/17-entity-identity-and-canonical-resolution.md`, moved with `git mv` so history follows.
- New H1: `# 17 Entity Identity and Canonical Resolution`.
- Index kind: `subsystem`. Status: `active`. Focus: "Entity identity, non-destructive consolidation, terminal canonical resolution, the derived index, and the `buildos entities` contract." The focus drops "staged source-build migration".
- No document-level `coordinate` frontmatter.
- Section order, from `make-docs://system/template/prd-subsystem.md`:
  1. `## Purpose` (C-01)
  2. `## Scope`: in scope (C-01, C-02, first-release persona scope); out of scope (automatic fuzzy or semantic redirects, destructive bulk rewrites, type-specific matching before reviewed rules, live-root mutation without separate approval)
  3. `## Component and Capability Map` (C-03, C-05), with `### Entity commands` (C-04)
  4. `## Contracts and Data`, with `### Lifecycle and redirects`, `### Redirect object`, `### Terminal resolution`, `### Strict and compatibility modes`, `### Matching and review policy`, `### Reviewed consolidation manifest`, `### Atomic writes`, `### Derived index` (C-07 to C-13); `references.json` is named as intake-owned with a link to 07
  5. `## Integrations` (C-14, C-15, and links to 08, 09, 10, 11, and 20)
  6. `## Rebuild Notes`, with `### Adoption and live-root migration safety` (C-16) and `### Acceptance` (C-17)
  7. `## Requirement History` (C-18; see [entries](#requirement-history-entries))
  8. `## Source Anchors`: the entity contracts under `system/.os/contracts/`, `persona-identity-contract.md`, the entity design, and the TypeScript fixture location once W1 R7 P3 ports it (until then, the Go fixture path with a note that it is pre-port)
- Absorbed from `18-revise-unified-buildos-cli-and-distribution.md`: the entity flag contract from `### W1 R4 seed contract` (18-12) and the installed-root index path (18-13). Nothing else from PRD 18.
- Moved to `## Requirement History`: the side-by-side source-build procedure for Go binaries, the separate approval to reroute binaries, Go rehearsal anchors (`persona_rehearsal_test.go`, `pkg/entities`), the W1 R4 P2 to P5 implementation notes in condensed form, and the copied-root rehearsal evidence.
- Removed with no new home: `## Change Type`, `## Capability Addition or Enhancement` as a heading, `## Affected Baseline Docs`, `## Integration Impact` as a heading (content moves to `## Integrations`), `## Required Baseline Annotations`, every `### Change Notes`, and the PRD 18 and 19 notes (17-29).
- The restructure happens in backlog P1 under the old filename and H1. The rename of filename and H1 happens in P4, together with every link update.

## PRD 13 Restructure Spec

- Filename and H1 stay: `docs/prd/13-adopter-owned-config-surface.md`, `# 13 Adopter-Owned Config Surface`. Both already pass the validator.
- Index kind: `subsystem`. Status: `active`.
- Section order:
  1. `## Purpose`
  2. `## Scope`: in scope (instance config, config contract, starter template, scoped vocabulary, the `buildos validate` check list); out of scope (the `buildos validate` command surface, owned by 20; project identity and global registry, tracked in `Q-006` and `Q-007`)
  3. `## Component and Capability Map`: `system/.os/config/instance.yaml`, `system/.os/contracts/config-contract.md`, `system/.os/templates/instance-config.yaml`, and `buildos validate` as the check runner (C-32)
  4. `## Contracts and Data`, with `### Config schema` (13-10, 13-11), `### Scoped vocabulary` (13-05 to 13-07, 13-13), `### Neutral reusable content` (13-12, linking the PRD 20 `## Release` deny-list check), and `### buildos validate checks` (C-33, C-34, C-35). The `## Contracts and Data` heading text stays exactly the same, so `#contracts-and-data` links keep resolving.
  5. `## Integrations` (C-36; consumers 08 to 12; the command in 20; wrappers in 06)
  6. `## Rebuild Notes`: check parity with `validate_config.py` fixtures; the scoped-field migration state as found by the implementer
  7. `## Requirement History`: the existing 2026-11-23 W1 R7 entry, plus the W1 R8 entries below
  8. `## Source Anchors`
- Removed: `## Change Type`, `## Capability Addition or Enhancement` as a heading (content moves to the sections above), `## Affected Baseline Docs`, `## Integration Impact` as a heading (content moves to `## Integrations`), `## Required Baseline Annotations`, and every `### Change Notes` (13-08 is dropped; `Q-006` and `Q-007` already track the PRD 19 ideas).
- The phrase "initial implementation scope, not deferred hardening" is dropped as editorial.
- Links that use the removed `#capability-addition-or-enhancement` anchor are repaired in the same phase. Today one exists, in the W1 R7 backlog file `07-skills-and-validation.md`.

## Requirement History Entries

All entries use date `2026-11-23`, coordinate `W1 R8`, and source [the PRD Set Authority Cleanup design](../../designs/2026-11-23-prd-set-authority-cleanup.md), except the moved PRD 16 entry, which keeps its own date, coordinate, and source.

| Owning PRD | Date / coordinate | Affected requirement or section | Previous contract | Replacement contract | Rationale | Source |
| --- | --- | --- | --- | --- | --- | --- |
| `17` | 2026-11-23 / W1 R8 | `## Rebuild Notes`, adoption and migration | Build `buildos` from a separate source checkout, verify installed binaries side by side, and get a separate approval to reroute binaries before migrating live data | Adoption uses `buildos init` and the version pinned in `.os/manifest.json`; an explicit `npx` version runs against a copy; live-root migration keeps its snapshot, strict validation, index reproduction, and separate approval | No binaries exist after the npm package | Design decision 3 |
| `17` | 2026-11-23 / W1 R8 | `## Source Anchors`, acceptance evidence | Go rehearsal anchors `persona_rehearsal_test.go` and `pkg/entities`; W1 R4 P2 to P5 implementation and copied-root rehearsal evidence held as change notes | Anchors name the TypeScript package fixtures; the W1 R4 delivery facts are kept here in short form only | The Go code is removed after W1 R7 parity | Design decision 3 |
| `13` | 2026-11-23 / W1 R8 | `## Contracts and Data`, `buildos validate` checks | Config and scoped-reference checks only; entity record hygiene implied by a separate lifecycle record and the Python validator | One full check list in 13, matching `validate_config.py`, including entity record hygiene | Gap closed; parity rule in PRD 20 | Design decision 2 |
| `13` | 2026-11-23 / W1 R8 | Frontmatter hygiene check | Errors on legacy scoped fields "once the migration lands" | Unconditional, only if the implementer finds the migration has landed; otherwise no entry | Repository fact | Design decision 6 |
| `02` | 2026-11-23 / W1 R8 | `## Module Map`, domain ownership | Per-toolkit directories `toolkits/buildos-<slug>/` with their own `README.md` and `AGENTS.md`; an ownership table in a separate record that listed `buildos-config` as planned and lacked entities | One package with per-domain scope contracts; one reconciled domain table in 02 | Ownership rule belongs with architecture | Design decision 1 |
| `02` | 2026-11-23 / W1 R7 (moved) | Domain ownership container | The PRD 16 entry: one cohesive Go program | One TypeScript package | Moved unchanged from PRD 16 | Its original source link |
| `02` | 2026-11-23 / W1 R8 | `## Configuration Surfaces` | `env`/`for` frontmatter tags scope artifacts | `systems`, `environments`, and `owners` list fields of configured IDs, resolved through `instance.yaml` | Body was stale; only a note overrode it | Design decision 4 |
| `08` | 2026-11-23 / W1 R8 | `## Contracts and Data`, lifecycle | Pending extraction rows held a `candidate` status, corrected only by a separate record | `draft` is the pending state; `candidate` is never an entity status | Rule now lives with its owner | Design decision 1 |
| `20` | 2026-11-23 / W1 R8 | `## Runtime and Package`, network use | Network or service calls disallowed unless a design approves them and the CLI uses opt-in flags; no exceptions named | No network calls except the `npx` package fetch and the user-chosen Make Docs setup; a new network call needs an accepted design and an opt-in flag | Gap closed; the exceptions were unstated | Design decision 2 |
| `01`–`12` | 2026-11-23 / W1 R8 | Per folded note | Per note | Per note | Only where a folded note carries a material prior contract; decided per note in backlog P2 | Design decision 4 |
