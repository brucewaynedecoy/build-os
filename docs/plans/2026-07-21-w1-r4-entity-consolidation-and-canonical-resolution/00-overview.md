# Entity Consolidation and Canonical Resolution Change Plan

## Objective

Evolve the active Build OS product contracts and implementation backlog so teams can consolidate duplicate or replaced entity records without deleting provenance, resolve every historical or new reference to one terminal active record, and adopt the capability safely from a source build beside an existing installation.

Completion requires a new enhancement PRD, non-destructive annotations to the affected active PRD lineage, a scoped delta backlog, a deterministic `buildos entities` command and derived resolution index inside the unified CLI seed, a persona-first migration proving path, redirect-aware read and write integrations, novice-oriented maintainer and operator guidance, and closeout evidence that strict validation and copied-root rollback succeed.

## Architecture Change Note (2026-07-21)

The [W1 R5 Unified BuildOS CLI and Distribution plan](../2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md)
supersedes this plan's original separate-binary boundary.
W1 R4 creates `toolkits/buildos/` and ships the entity capability as `buildos entities`;
it does not create `toolkits/buildos-entities/` or a public `buildos-entities` executable.
The redirect and migration requirements remain unchanged.

This W1 R4 source-build seed does not consolidate or package the other domains.
`buildos-intake`,
`buildos-discovery`,
and `buildos-design` remain separate binaries until W1 R5 migrates their code into the unified module,
adds temporary compatibility aliases,
and proves Homebrew and signed archive distribution.
W2 installation lifecycle commands remain future work inside the same `buildos` executable.

## Coordinate Decision

- Coordinate: `W1 R4`
- Classification: `revision`
- Source lineage: this work revises the entity data and extraction capability delivered as W1 R0 P4 and recorded in [the W1 R0 P4 closeout](../../assets/history/2026-06-04-w1-r0-p4-data-layer-extraction.md).
- Revision evidence: W1 R1, R2, and R3 are already occupied by adopter configuration, deterministic toolkit deployment, and flow-automation planning respectively, so R4 is the next unused revision in the lineage wave.
- Scope evidence: the accepted [entity consolidation and canonical resolution design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md) explicitly routes to a change plan and extends the same W1 entity, extraction, validation, and toolkit surfaces rather than starting a separate end-to-end product initiative.

## Change Classification

- Requested change type: `enhancement`
- Effective execution mode: `active-set evolution`
- Cleanup rewrite requested: `no`
- Full backlog regeneration requested: `no`
- Backlog form: a new scoped delta backlog that preserves all prior work directories.

## Change Inputs

| Input | Format | Location | Confidence |
| --- | --- | --- | --- |
| Accepted consolidation decision | Design record | [Entity consolidation and canonical resolution](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md) | High |
| Pre-upgrade cleanup boundary | Reusable prompt | [Pre-upgrade entity consolidation audit](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md) | High |
| Entity envelope and lifecycle | Operating contract | `system/.os/contracts/entity-records-contract.md` | High |
| Extraction provenance and minted-output behavior | Operating contract | `system/.os/contracts/extraction-contract.md` and `system/.os/data/extractions.jsonl` | High |
| Existing index roles | Generated data and contracts | `system/.os/indexes/references.json`, `system/.os/indexes/playbooks.json`, and `system/.os/contracts/` | High |
| Deterministic toolkit deployment requirements | Active PRD and design | [PRD 14](../../prd/14-revise-deterministic-toolkit-deployment.md) and [toolkit CLI deployment design](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md) | High |
| Toolkit ownership requirements | Active PRD | [PRD 16](../../prd/16-revise-toolkit-ownership-boundaries.md) | High |
| Unified CLI seed and distribution direction | Active revision and design | [PRD 18](../../prd/18-revise-unified-buildos-cli-and-distribution.md) and [unified CLI design](../../designs/2026-07-21-unified-buildos-cli-and-distribution.md) | High |
| Live-environment upgrade constraint | User-provided operational evidence | Existing installation plus separate clone-and-build source path | High for required safety boundary; environment-specific paths remain operator supplied |

## Baseline Context

- Active `docs/prd/` status: PRD 17 remains the entity enhancement authority and PRD 18 now revises the public CLI and distribution boundary that W1 R4 must seed.
- Primary capability baseline: [PRD 08](../../prd/08-data-and-extraction.md), which defines the entity store, common envelope, layered canonicity, extraction load plans, and generated indexes.
- Connected active change lineage: [PRD 14](../../prd/14-revise-deterministic-toolkit-deployment.md), [PRD 15](../../prd/15-revise-extraction-draft-lifecycle.md), and [PRD 16](../../prd/16-revise-toolkit-ownership-boundaries.md).
- Connected consumer baseline: [PRD 09](../../prd/09-playbooks.md), because playbook targets may retain historical entity IDs and must resolve them before use.
- Core docs requiring effective-lineage updates: [PRD index](../../prd/00-index.md), [product overview](../../prd/01-product-overview.md), [architecture overview](../../prd/02-architecture-overview.md), [risk register](../../prd/03-open-questions-and-risk-register.md), and [glossary](../../prd/04-glossary.md).
- Excluded after live reconciliation: [PRD 07](../../prd/07-intake-and-conversion.md) remains a deterministic converted-source intake contract and does not own semantic entity matching or canonical entity resolution.
- Discovery pass required: `yes`.
- Discovery scope: confirm exact sections and existing change-note order in PRDs 00, 01, 02, 03, 04, 08, 09, 14, 15, and 16; confirm the concrete validator, extraction, playbook-target, wrapper, and toolkit integration anchors before implementation begins.

## Output Contract

- Plan directory: `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/`
  - entry point: [00-overview.md](./00-overview.md)
  - ordered phase files: [01-prd-and-contract-alignment.md](./01-prd-and-contract-alignment.md), [02-resolver-toolkit-and-index.md](./02-resolver-toolkit-and-index.md), [03-persona-pilot-and-migration.md](./03-persona-pilot-and-migration.md), [04-read-write-and-extraction-integration.md](./04-read-write-and-extraction-integration.md), and [05-guides-validation-and-closeout.md](./05-guides-validation-and-closeout.md)
- New change doc: `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` using the addition/enhancement template.
- Baseline annotations: non-destructive `Enhanced by` notes in the impacted sections named below; no baseline text deletion, renumbering, or cleanup rewrite.
- Risk register: update existing R-004 in `docs/prd/03-open-questions-and-risk-register.md`; do not create a duplicate risk item or a `Change Notes` block in the register.
- Delta backlog: `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/` with `00-index.md` and phase files matching this plan's dependency order.
- Shipped contracts and implementation: additive redirect semantics, `system/.os/indexes/entity-resolution.json`, the source-build-only `toolkits/buildos/` unified CLI seed, redirect-aware integrations, fixtures, tests, and only thin wrappers under `system/.os/scripts/` if routing is needed.
- Guides and breadcrumb: reconciled developer and user guides plus a W1 R4 phase history record after implementation and validation.

## Change Doc Strategy

| New doc | Kind | Why it exists | Affected baseline docs |
| --- | --- | --- | --- |
| `17-enhance-entity-consolidation-and-canonical-resolution.md` | enhancement | Defines one coherent cross-cutting contract for non-destructive redirects, terminal resolution, deterministic index and toolkit behavior, compatibility-to-strict migration, matching policy, and source-build adoption. | 00, 01, 02, 03, 04, 08, 09, 14, 15, and 16 |

One change doc is sufficient because all affected behaviors enforce the same canonical-identity invariant and share one delivery sequence. Type-specific identity adapters beyond personas remain later enhancements unless implementation discovers a contract ambiguity that materially changes their rationale or sequencing.

## Baseline Annotation Plan

| Baseline doc | Impacted sections | Note verb | Target change doc |
| --- | --- | --- | --- |
| `docs/prd/01-product-overview.md` | `Key Capabilities`, `Current Limitations` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/02-architecture-overview.md` | `Module Map`, `Runtime Boundaries`, `Data Flow` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/04-glossary.md` | `Terms` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/08-data-and-extraction.md` | `Component and Capability Map`, `Contracts and Data`, `Integrations`, `Rebuild Notes` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/09-playbooks.md` | `Contracts and Data`, `Integrations`, `Rebuild Notes` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/14-revise-deterministic-toolkit-deployment.md` | `Effective Requirement`, `Impacted Docs and Dependencies` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/15-revise-extraction-draft-lifecycle.md` | `Effective Requirement`, `Impacted Docs and Dependencies` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |
| `docs/prd/16-revise-toolkit-ownership-boundaries.md` | `Effective Requirement`, `Impacted Docs and Dependencies` | `Enhanced by` | `17-enhance-entity-consolidation-and-canonical-resolution.md` |

`docs/prd/00-index.md` receives navigation, status, related-doc, and audience-path updates rather than a baseline `Change Notes` block. `docs/prd/03-open-questions-and-risk-register.md` receives an in-place R-004 state update. Execution must confirm each section is genuinely affected before inserting a note and must preserve chronological order when a section already has change notes.

## Worker Ownership

The execution harness should use delegation-ready, disjoint scopes. If delegation is available, the coordinator owns orchestration and merge order only and has no document-writing scope.

| Worker | Scope | Write Scope | Dependencies | Deliverables |
| --- | --- | --- | --- | --- |
| Change-contract worker | PRD 17 and operating contract changes | `docs/prd/17-*.md`, `system/.os/contracts/`, contract fixtures | Accepted design; live contract discovery | Decision-complete PRD and redirect/index/resolution contract text |
| Baseline-lineage worker | Baseline annotations and living risk state | PRDs 01, 02, 03, 04, 08, 09, 14, 15, and 16 | PRD 17 path and final terminology | Ordered `Enhanced by` links and updated R-004 |
| PRD assembly worker | Active PRD navigation and cross-doc status | `docs/prd/00-index.md` | PRD 17 plus baseline-lineage output | Index map, related-doc links, reading and audience routes |
| Unified CLI and resolver worker | Root CLI seed, generic graph engine, index generator, and tests | `toolkits/buildos/`, owned wrappers, entity-resolution fixtures | Final contract invariants and PRD 18 root/output policy | `buildos entities`, shared help/version/output, dry-run/apply behavior, compat/strict validation, atomic writes, reproducible index |
| Persona-migration worker | Persona adapter, reviewed fixtures, copied-root rehearsal, and recovery evidence | persona fixtures and migration-test artifacts only | Resolver toolkit complete | Persona pilot with one-hop, multi-hop, remap-conflict, ambiguity, and rollback coverage |
| Integration worker | Redirect-aware consumers and entity-producing workflows | extraction, entity-reference, and playbook-target integration surfaces plus tests | Resolver API stable; persona pilot passing | Original-plus-canonical reads and terminal-canonical writes |
| Guide worker | Maintainer and end-user reconciliation | `docs/guides/developer/`, `docs/guides/user/` | Stable CLI and migration behavior | Naive-reader procedures, safety warnings, troubleshooting, reciprocal links |
| Backlog worker | Scoped implementation backlog | `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/` | Reconciled PRD 17 and baseline annotations | Dependency-ordered delta backlog with source PRD links |
| Validation and closeout worker | Cross-scope validation, narrow fixes, and history | validation-only fixes plus W1 R4 history record | All other deliverables complete | Full validation report, link cleanup, closeout breadcrumb |

## MCP Strategy

- Preferred servers available: use `jdocmunch` for project-document discovery, backlinks, and link validation; use `jcodemunch` for toolkit and integration symbol discovery, function signatures, and blast-radius checks.
- Stale-index rule: reindex the affected documentation or code root immediately, then repeat the query before using direct reads or repository search.
- Fallback plan: if reindexing fails, use targeted `rg --files`, `rg`, and bounded direct reads; record the fallback in execution notes so validation can recheck missed consumers.

## Validation

Execution validation must confirm all of the following:

- PRD 17 uses the enhancement template, owns the effective requirement, and links to every affected baseline without renumbering the active set.
- Every genuine baseline impact has one ordered `Enhanced by` backlink; the index exposes the newest lineage; R-004 is updated in place.
- `superseded` plus `redirect` invariants, terminal-active resolution, same-type enforcement, cycle rejection, remap conflicts, and preservation of losing-record provenance are tested across all governed entity types.
- Compatibility mode warns on legacy superseded rows without guessing targets; strict mode rejects them; newly changed superseded rows always satisfy strict rules.
- Consolidation is dry-run by default, requires `--apply`, requires an explicit root, validates the whole graph before mutation, writes canonical JSONL atomically, preserves permissions, and is idempotent for an identical mapping.
- `entity-resolution.json` is derived only from canonical JSONL, stable-sorted, byte-reproducible, and detects stale output with `--check`.
- Persona fixtures prove one-hop and multi-hop resolution, later winner replacement, ambiguous aliases, repeated extraction, and original provenance retention.
- Reads preserve the requested ID while exposing the canonical ID and chain; new writes store only the terminal canonical ID; probabilistic similarity remains review-only.
- A source-built binary can run by explicit path against a copied adopter root without changing installed binaries, wrappers, or live data; binary deployment and data migration remain separate approvals.
- Strict validation, deterministic rebuild, representative read/write tests, failure injection, copied-root rollback, documentation validation, path hygiene, and internal link checks pass before closeout.

## Phase Map

| Phase | File | Outcome | Depends on |
| --- | --- | --- | --- |
| P1 | [01-prd-and-contract-alignment.md](./01-prd-and-contract-alignment.md) | Effective product and operating contracts plus active-set lineage | Accepted design |
| P2 | [02-resolver-toolkit-and-index.md](./02-resolver-toolkit-and-index.md) | Unified CLI seed, generic deterministic engine, validation modes, and derived index | P1 and the W1 R5 architecture contract |
| P3 | [03-persona-pilot-and-migration.md](./03-persona-pilot-and-migration.md) | Reviewed persona proving set and side-by-side copied-root migration rehearsal | P2 |
| P4 | [04-read-write-and-extraction-integration.md](./04-read-write-and-extraction-integration.md) | Redirect-aware consumers, terminal-canonical producers, and matching policy | P2 and P3 |
| P5 | [05-guides-validation-and-closeout.md](./05-guides-validation-and-closeout.md) | Naive-user guidance, full gates, delta backlog reconciliation, and history breadcrumb | P1 through P4 |

## Handoff to Execution

The user has authorized execution through plan, PRD reconciliation, scoped backlog generation, guide reconciliation, history, and a local commit. Execute phases in dependency order, preserve all unrelated dirty-worktree changes, keep writes within assigned scopes, and do not push, publish, overwrite an installed Build OS root, or mutate live adopter data.
