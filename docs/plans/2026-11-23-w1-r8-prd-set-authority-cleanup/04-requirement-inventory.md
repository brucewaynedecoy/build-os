# 04 Requirement Inventory

## Purpose

This is the read-only requirement inventory for the cleanup. It was captured on 2026-11-23 at commit `59e3a36` on branch `rewrite/ts-cli`, before any W1 R8 change. It is the baseline that the requirement trace check in backlog P3 works from. Do not edit the research text. During P3, the implementer fills the `Final owner` column of each per-PRD table in section 2 with the owner section where the requirement now lives, or `none` with a reason. The reviewer samples rows against the owner text as described in [03 Validation and Review](./03-validation-and-review.md#checks).

"17R" in this inventory means PRD 17 renamed in place. Its final name is `17-entity-identity-and-canonical-resolution.md`. Section names in the `Proposed product owner` column are proposals; the decisions are in [01 PRD Authority Maintenance](./01-prd-authority-maintenance.md#candidate-decision-matrix) and the owner choices in the [design](../../designs/2026-11-23-prd-set-authority-cleanup.md#decision). Where they differ, the design and 01 win. For example, the design gives the `buildos validate` entity hygiene check list (13-20) to PRD 13.

Read-only research on branch `rewrite/ts-cli` at commit `59e3a36`, 2026-11-23. Nothing in the repository was edited. Sources read: `docs/prd/03-open-questions-and-risk-register.md` (D-005 with its cleanup inventory, safety rules, and sequencing), `docs/prd/00-index.md` (Document Map and Current Authority Map), `make-docs://system/reference/prd-change-management.md`, `make-docs://system/contract/output-contract.md`, `.make-docs/archive/AGENTS.md`, `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-legacy-prd-cleanup-handoff.md`, PRDs 13 to 19 in full, PRD 20 in full, and PRDs 01 to 12 at section level (02, 04, 06, and 08 read closely).

## Key findings up front

1. All 93 findings come from PRDs 13 to 19, the index rows that describe them, and work-backlog links to them. There are no `PRD-AUTH-006` findings. PRD 13's filename and H1 already pass. Only its retired headings and its index kind fail.
2. **Gap: the per-command entity flag contract has no current owner.** It covers `--root`, `--mode compat|strict`, `--id`, `--manifest`, `--apply`, `--check|--apply`, the dry-run default for `consolidate`, the check default for `rebuild-index`, and the rule that those two flags are mutually exclusive. This contract exists only in superseded PRD 18 (`### W1 R4 seed contract`). PRD 20 defers to PRD 17 ("The entity commands keep the contract in 17"), but PRD 17 does not state the flags. Only the golden-parity promise in PRD 20 holds it in place for now.
3. **Gap: the local-only runtime posture has no current owner.** PRD 14 says "Network or service calls are disallowed unless a design explicitly approves them and the CLI requires opt-in flags." PRD 20 did not restate this, and no other active PRD holds it. Note that PRD 20's Make Docs `npx` fallback is a network call that would need an explicit exception.
4. **Gap: "entity record hygiene" in `buildos validate` has no clear owner.** PRD 20 and PRD 06 say `buildos validate` checks "adopter config and entity record hygiene". PRD 13 defines only the config and scoped-reference checks. The lifecycle hygiene rules (`draft`, `source_anchor`, `doc_anchor`) sit in PRD 15, whose anchor is the now-replaced `validate_config.py`.
5. **Baseline PRDs 01 to 12 hold 65 `### Change Notes` bullets that point at PRDs 13 to 19.** 32 of them say "Superseded by [19 ...]", and PRD 19 was never approved. Several current requirements exist only as those pointer bullets. One example: canonical resolution of playbook targets appears only in PRD 09's change notes. Another: PRD 02 `## Configuration Surfaces` still says "`env`/`for` frontmatter tags scope artifacts" in its body, and only a change note overrides it. The validator does not flag `Change Notes`. Even so, the rule "Do not leave a removed requirement active in the body and rely on a history entry, backlink, or separate removal document to override it" means these bullets must be folded inline during the cleanup.
6. **Conflict between the validator and safety rule 6.** 51 `PRD-AUTH-005` findings sit in completed or superseded work backlogs (W1 R0, R2, R4, R5, R6). The validator keeps them in scope: "A completed work record at its working path remains in scope." Safety rule 6 says "Archived or historical files are not rewritten." The owner must decide whether those backlogs count as historical. If they do, the only zero-finding path is to archive them, and that needs an explicit owner request.
7. Two items in PRD 17 are stale against PRD 20: the side-by-side source-build adoption procedure, which is written for binaries and `go build`, and the Go rehearsal anchors (`persona_rehearsal_test.go`, `pkg/entities`). They need restating for the npm package before PRD 17's text can become product authority.

## 1. Validator breakdown

Command: `make-docs run prd authority validate --target-root . --json`. It exited 1 with `status: failed`. It scanned 21 PRD files and 116 Markdown files (21 PRD, 11 design, 39 plan, 45 work) and 198 links. It found 93 diagnostics: `PRD-AUTH-005` 51, `PRD-AUTH-004` 23, `PRD-AUTH-003` 7, `PRD-AUTH-001` 6, `PRD-AUTH-002` 6, `PRD-AUTH-006` 0.

### By file and code

| File | 001 | 002 | 003 | 004 | 005 | Total |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/prd/00-index.md` (lines 35 to 41) | | | 7 | | | 7 |
| `docs/prd/13-adopter-owned-config-surface.md` | | | | 4 | | 4 |
| `docs/prd/14-revise-deterministic-toolkit-deployment.md` | 1 | 1 | | 3 | | 5 |
| `docs/prd/15-revise-extraction-draft-lifecycle.md` | 1 | 1 | | 3 | | 5 |
| `docs/prd/16-revise-toolkit-ownership-boundaries.md` | 1 | 1 | | 3 | | 5 |
| `docs/prd/17-enhance-entity-consolidation-and-canonical-resolution.md` | 1 | 1 | | 4 | | 6 |
| `docs/prd/18-revise-unified-buildos-cli-and-distribution.md` | 1 | 1 | | 3 | | 5 |
| `docs/prd/19-revise-build-os-headless-core-cli-and-mcp-program.md` | 1 | 1 | | 3 | | 5 |
| `docs/work/2026-06-03-w1-r0-build-os-baseline/` (03, 06) | | | | | 2 | 2 |
| `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/` (01, 02) | | | | | 2 | 2 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/` (01: 5, 02: 4, 03: 3, 04: 2, 05: 3) | | | | | 17 | 17 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/` (01: 4, 02: 2, 03: 3, 04: 2, 05: 4) | | | | | 15 | 15 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/` (01: 2, 02: 3, 03: 2, 04: 2, 05: 4, 06: 2) | | | | | 15 | 15 |
| **Total** | 6 | 6 | 7 | 23 | 51 | **93** |

`PRD-AUTH-005` findings by target PRD: 14 → 12, 15 → 3, 16 → 8, 17 → 10, 18 → 12, 19 → 6. Plans produced no findings. Their links sit outside authority-bearing sections, but they still break on a rename or retirement (see section 3). The W1 R7 work backlog cites PRDs 13, 16, and 17 as code-span paths, not links, so the validator does not flag them. They still need updating.

### Example per code and what clears it

| Code | Example | Clears when |
| --- | --- | --- |
| `PRD-AUTH-001` (6) | `docs/prd/14-revise-deterministic-toolkit-deployment.md:1`, "Active PRD filename ... encodes an editorial operation." | PRDs 14 to 19 are renamed to a product subject (keeping the number), or removed from `docs/prd/`. PRD 13 already passes. |
| `PRD-AUTH-002` (6) | `docs/prd/14-...md:1`, "Active PRD H1 begins with prohibited editorial term `revise`." | Same six files get a product-subject H1, or are retired. |
| `PRD-AUTH-003` (7) | `docs/prd/00-index.md:35`, "Active PRD index declares retired editorial kind `addition`." Lines 36 to 41 are `revision` ×5 and `enhancement` ×1. | Document Map rows for 13 to 19 use product kinds (`core`, `capability`, `subsystem`, `reference`), and rows for retired PRDs are removed. |
| `PRD-AUTH-004` (23) | `docs/prd/13-adopter-owned-config-surface.md:7`, "Heading `Change Type` belongs to a retired editorial change-record template." Others: `Capability Addition or Enhancement` (13, 17), `Affected Baseline Docs` (13, 17), `Baseline Being Revised or Removed` (14, 15, 16, 18, 19), `Required Baseline Annotations` (all seven). | Each surviving PRD is restructured to the subsystem template (`## Purpose`, `## Scope`, `## Component and Capability Map`, `## Contracts and Data`, `## Integrations`, `## Rebuild Notes`, optional `## Requirement History`, `## Source Anchors`), or the file is retired. |
| `PRD-AUTH-005` (51) | `docs/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md:16`, "Active Markdown authority link treats editorial PRD `docs/prd/14-...md` as an authority target." | Each `## Source PRD Docs` link is retargeted to the product owner, or moved into an exempt provenance section (`Provenance`, `Lineage`, `Migration History`, and similar). The alternative is to archive the backlog, which needs explicit owner approval. Retiring the target file does not clear the finding, because the validator matches the action-prefixed name in the link. |
| `PRD-AUTH-006` (0) | None. PRD 20 frontmatter has no top-level `coordinate`. | Not applicable. |

## 2. Requirement inventory per legacy PRD

Status values: `current`, `superseded by 20`, `superseded by <other>`, `historical only`, and `never approved`. "17R" means PRD 17 renamed in place (see section 4). For each row, the proposed owner names where the current normative text should live once the cleanup is done.

### PRD 13 Adopter-Owned Config Surface

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 13-01 | Capability Addition or Enhancement | `system/.os/config/instance.yaml` is the canonical, adopter-owned instance config | current | 13 (restructured) `## Contracts and Data` | High | 06 component map lists `.os/config/`. 05 owns installed paths. | PRD 13 ## Component and Capability Map |
| 13-02 | Capability Addition or Enhancement | `system/.os/contracts/config-contract.md` defines schema shape, ID rules, cross-references, defaults, and validation | current | 13 `## Contracts and Data` | High | Contract file is the code anchor. | PRD 13 ## Component and Capability Map; PRD 13 ### Config schema |
| 13-03 | Capability Addition or Enhancement | `system/.os/templates/instance-config.yaml` is a neutral starter with replaceable example values | current | 13 `## Component and Capability Map` | High | Ships in `system/` via `buildos init` (PRD 20). | PRD 13 ## Component and Capability Map |
| 13-04 | Capability Addition or Enhancement | `buildos validate` validates the config and dependent frontmatter and data references | current | 13 (what is checked); 20 `## Command Surface` (the command) | High | Already split this way. 20 says "13 ... owns what `buildos validate` checks." | PRD 13 ### buildos validate checks; PRD 20 ## Command Surface |
| 13-05 | Capability Addition or Enhancement | Scoped vocabulary definitions: `systems`, `environments`, `owners` | current | 13 `## Contracts and Data`; terms added to 04 | High | 04 Glossary lacks these three terms. | PRD 13 ### Scoped vocabulary; PRD 04 ## Terms |
| 13-06 | Capability Addition or Enhancement | Scoped fields are plural lists where artifacts can apply to several IDs | current | 13 `## Contracts and Data` | High | | PRD 13 ### Scoped vocabulary |
| 13-07 | Capability Addition or Enhancement | Legacy scoped vocabulary (`env`, `for`, `envs`, `target_systems`, sentinel `both`) is not contract vocabulary | current | 13 `## Contracts and Data`; 02 `## Configuration Surfaces` body fixed | High | **Conflict:** 02 body still says "`env`/`for` frontmatter tags scope artifacts". Only a change note overrides it. | PRD 13 ### Scoped vocabulary; PRD 02 ## Configuration Surfaces |
| 13-08 | Change Notes (×3) | Config becomes PRD 19 `CFG`/`PRJ` core operations, validation behind the core, with CLI/MCP parity | never approved | none (history only) | High | Drop. Q-006 and Q-007 already track project identity and global registry. | none: never approved; register Q-006 and Q-007 track project identity and the global registry |
| 13-09 | Affected Baseline Docs | List of baseline PRDs enhanced by the config addition | historical only | none | High | Editorial. Remove. | none: editorial list of baseline PRDs |
| 13-10 | Contracts and Data | Config top-level properties: `version` (int), `instance` {`id`, `name`}, `systems`, `environments`, `owners`, optional `defaults` | current | 13 `## Contracts and Data` (config schema fields table) | High | | PRD 13 ### Config schema |
| 13-11 | Contracts and Data | IDs are stable slugs, unique per collection, and referenced explicitly. `environments[].systems` and `defaults.*` must reference configured IDs | current | 13 `## Contracts and Data` | High | | PRD 13 ### Config schema |
| 13-12 | Contracts and Data | Reusable templates and contracts hold no customer-, vendor-, product-, or instance-specific values. The starter holds neutral example IDs only | current | 13 `## Contracts and Data` | High | Related to the PRD 20 `## Release` client-name deny-list check. Cross-link it. | PRD 13 ### Neutral reusable content |
| 13-13 | Contracts and Data | Scoped frontmatter and structured rows use list fields. Empty lists are allowed only where the artifact contract permits neutral scope | current | 13 (rule); consumers 08 and 09 link to it | High | | PRD 13 ### Scoped vocabulary |
| 13-14 | Contracts and Data | Validation runs through `buildos validate`. `validate_config.py` is not the validator. No Python is needed | current | 20 (command) and 06 (already inline); 13 links | High | Duplicated today in 06 and 20. Keep one statement. | PRD 13 ### buildos validate checks; PRD 06 ## Contracts and Data |
| 13-15 | Integration Impact | Contracts, indexes, playbook frontmatter, data rows, run records, findings, and handoff metadata resolve scope through `instance.yaml` | current | 13 `## Integrations` | High | 08 to 12 currently carry this only as change notes. | PRD 13 ## Integrations |
| 13-16 | Integration Impact | `buildos validate` check list: file, ID uniqueness and slug format, `environments[].systems` refs, `defaults.*` refs, scoped frontmatter and data refs | current | 13 `## Contracts and Data` | High | The phrase "initial implementation scope, not deferred hardening" is editorial. Drop it. | PRD 13 ### buildos validate checks |
| 13-17 | Integration Impact | Frontmatter hygiene check: parse Markdown frontmatter, require list-of-configured-IDs, error on legacy fields and unconfigured IDs "once the migration lands", callable on its own | current (migration state unclear) | 13 `## Contracts and Data` | Medium | Confirm whether the scoped-field migration has landed, so the conditional can be removed. | PRD 13 ### buildos validate checks |
| 13-18 | Required Baseline Annotations | Baselines 02, 06, and 08 to 12 must link "this change" | historical only | none | High | Editorial. Remove. | none: editorial annotation instruction |
| 13-19 | Requirement History | 2026-11-23 W1 R7 entry: `validate_config.py` replaced by `buildos validate` | history | 13 `## Requirement History` (keep) | High | Already in valid form. | PRD 13 ## Requirement History |
| 13-20 | (gap via PRD 20 and 06) | `buildos validate` also checks "entity record hygiene" | current, no owner | 08 (lifecycle and anchor checks) with 17R (graph checks); 13 links | Medium | See key finding 4. | PRD 13 ### buildos validate checks |

### PRD 14 Revise Deterministic Toolkit Deployment

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 14-01 | Effective Requirement: Source home | Toolkit source and build metadata live under root `toolkits/` | superseded by 20 | 20 `## Runtime and Package` (`toolkits/buildos/`) | High | | PRD 20 ## Runtime and Package |
| 14-02 | Effective Requirement: Toolkit structure | Each toolkit has its own dir with `README.md`, `AGENTS.md`, and `CLAUDE.md` | superseded by 16 and 20 | 02 (domain scope contracts inside the package; see 16-03) | High | The rule changed from per-toolkit directories to per-domain scope contracts. | PRD 02 ### Domain ownership |
| 14-03 | Effective Requirement: Toolkit ownership | Each toolkit owns one coherent domain. README and `AGENTS.md` are scope contracts. Unrelated commands need a new owner | current (as domain rule) | 02 `## Module Map` (same row as 16-01 and 16-03) | High | Duplicated by 16. | PRD 02 ### Domain ownership |
| 14-04 | Effective Requirement: Default language | Go is the default language | superseded by 20 | none | High | TypeScript per 20. | none: superseded; PRD 20 ## Runtime and Package states TypeScript |
| 14-05 | Effective Requirement: Dependency posture | Prefer the standard library. Third-party deps need rationale, license notes, and packaging review in the README | superseded by 20 | 20 `## Supply Chain` | High | 20 uses Node built-ins first, six rules, and `SECURITY.md`. | PRD 20 ## Supply Chain |
| 14-06 | Effective Requirement: Runtime posture | Local-only by default. Network or service calls are disallowed unless a design approves them and the CLI uses opt-in flags | **current, no owner** | 20 `## Runtime and Package`, or 02 `## Runtime Boundaries` | Medium | **Gap** (key finding 3). Conflicts with PRD 20's Make Docs `npx` fallback unless an exception is stated. | PRD 20 ## Runtime and Package |
| 14-07 | Effective Requirement: Binary naming | `buildos-<slug>` binaries; a future dispatcher may route to them | superseded by 20 | 20 `## Legacy Command Names` | High | | PRD 20 ## Legacy Command Names |
| 14-08 | Effective Requirement: Script role | `system/.os/scripts/` holds thin wrappers, routers, compatibility shims, and docs. No new durable logic there | current | 06 `## Component and Capability Map` (already inline) | High | `none`, already owned. | PRD 06 ## Component and Capability Map; PRD 02 ### Domain ownership |
| 14-09 | Effective Requirement: Existing scripts | Scripts stay until converted. `validate_config.py` is not ported | superseded by 20 and 06 | none | High | `buildos validate` replaces it, and no Python ships. | none: superseded; PRD 13 ### buildos validate checks names the validator and PRD 06 ## Component and Capability Map says no Python ships |
| 14-10 | Rationale | Enterprise approval and non-technical install as the reason for packaged tooling | historical only | none (20 `## Purpose` already states the adopter outcome) | High | | none: historical rationale; PRD 20 ## Purpose states the adopter outcome |
| 14-11 | Initial Toolkit Target | W1 R0 P3 implements converters in `buildos-intake` with approved Go deps | historical only / superseded by 07 | 07 (converters in TS package; already inline) | High | | PRD 07 ## Contracts and Data |
| 14-12 | Change Notes (from 17) | Entity ops via a `buildos-entities` Go toolkit with dry-run, explicit roots, atomic writes | superseded by 17R and 20 | 17R | High | | PRD 17 ### Entity commands (dry-run default, explicit root); PRD 17 ### Atomic writes; PRD 17 ## Component and Capability Map (version and source revision output); PRD 20 ## Legacy Command Names (no `buildos-entities` name). Retired: the Go toolkit, replaced by the TypeScript package in PRD 20 ## Runtime and Package |
| 14-13 | Change Notes (from 17) | Source checkout, installed binary, and adopter data stay separate. Binary deployment and live-data migration are distinct approvals | current (restated for npm) | 17R `## Rebuild Notes` (adoption safety); 02 `## Runtime Boundaries` already says source checkout, npm package, and data are distinct | Medium | See 17-21. | PRD 17 ### Adoption and live-root migration safety; PRD 02 ## Runtime Boundaries |
| 14-14 | Change Notes (from 18 and 19) | Unified module, aliases, Homebrew `0.1.0`; cohesive Go core, CLI, and MCP distribution | superseded by 20 / never approved | none | High | | none: superseded by PRD 20 or never approved |
| 14-15 | Impacted Docs; Required Baseline Annotations | Baselines 02, 06, 07, 12, and 03 reference "this revision" | historical only | none | High | 02, 06, 07, and 12 still hold "Revised by [14]" notes to fold or remove. | none: editorial annotation instruction |

### PRD 15 Revise Extraction Draft Lifecycle

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 15-01 | Effective Requirement: Entity lifecycle | `.os/data/*.jsonl` rows use `draft` for pending, unpromoted records. `candidate` is never an entity status | current | 08 `## Contracts and Data` (new "draft lifecycle state" paragraph) | High | 08 already has "Draft staging" in its component map. | PRD 08 ### Draft lifecycle and anchors |
| 15-02 | Rationale | Lifecycle vocabulary is `draft`, `active`, `superseded`, `archived` (entity-records contract) | current | 08 `## Contracts and Data` | High | `superseded` and `archived` semantics come from 17 (see 17-32). | PRD 08 ### Draft lifecycle and anchors |
| 15-03 | Effective Requirement: Promotion gate | Non-`draft` rows require `doc_anchor`. Every row requires `source_anchor` | current | 08 `## Contracts and Data` (already says "Every row carries `source_anchor` and (when promoted) `doc_anchor`") | High | Make it normative. Also feeds `buildos validate` entity hygiene (13-20). | PRD 08 ### Draft lifecycle and anchors |
| 15-04 | Effective Requirement: Extraction load-plans | `extractions.jsonl` rows use the same vocabulary and record minted entity and playbook IDs plus optional dataset refs | current | 08 `## Contracts and Data` | High | Reconcile with `extraction-outcomes-v1` minted, referenced, and updated (17-20). | PRD 08 ### Draft lifecycle and anchors |
| 15-05 | Effective Requirement: Converted twins | Converted source twins may use `candidate`, but only under the converted-source contract (conversion quality not yet trusted) | current | 07 `## Contracts and Data` | High | Boundary between conversion state and entity lifecycle. | PRD 07 ## Contracts and Data |
| 15-06 | Effective Requirement: PRD language | PRDs describe Flow A outputs as draft rows until promoted | current (already applied) | none (02 `## Data Flow` and 08 `## Rebuild Notes` already inline) | High | Editorial instruction. Nothing to move. | PRD 02 ## Data Flow; PRD 08 ## Rebuild Notes (Flow A outputs stay draft rows until promoted). Retired: the instruction to PRD authors |
| 15-07 | Change Notes (from 17) | `superseded` means one reviewed redirect to a successor. `archived` means retained without a successor. Neither replaces `draft` | current | 17R `## Contracts and Data`; 08 summary line | High | | PRD 17 ### Lifecycle and redirects; PRD 08 ### Draft lifecycle and anchors |
| 15-08 | Change Notes (from 19) | Lifecycle transitions through core operations with receipts and CLI/MCP parity | never approved | none | High | Drop. | none: never approved |
| 15-09 | Impacted Docs | 02, 04, 08, and the entity-records, extraction, and converted-source contracts carry the lifecycle | historical only | none; 04 `Draft` row Notes column drops the 15 path | High | 04 cites `15-...md` in the Notes column twice. | none: editorial list; the PRD 04 Draft row no longer cites PRD 15 |
| 15-10 | Required Baseline Annotations | Reference from baselines as change notes | historical only | none | High | 04 and 08 "Revised by [15]" notes to fold. | none: editorial annotation instruction |

### PRD 16 Revise Toolkit Ownership Boundaries

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16-01 | Effective Requirement | One TS package at `toolkits/buildos/`, one `buildos` CLI. Each domain is a separate part with its own scope contract, exposed as `buildos <domain>`. The package boundary does not merge domain boundaries | current | 02 `## Module Map` (domain ownership rule) | Medium | 20 already says "Each domain keeps its own ownership boundary inside the one package". The alternative owner is 20 `## Command Surface`. | PRD 02 ### Domain ownership; PRD 20 ## Command Surface |
| 16-02 | Effective Requirement | Six-step procedure before adding logic: identify domain, read scope contract, confirm ownership, create or plan a new domain, keep scripts thin, no durable logic in unmanaged scripts without PRD or design authorization | current | 02 `## Module Map` (normative rule, short form); step detail to the maintainer guide `docs/assets/maintainer/buildos-toolkit-cli-development.md` | Medium | Process detail reads more like a maintainer guide than product authority. | PRD 02 ### Domain ownership |
| 16-03 | Effective Requirement | Domain README and `AGENTS.md` are scope contracts. A domain may not gain unrelated commands because it exists | current | 02 `## Module Map` | High | | PRD 02 ### Domain ownership |
| 16-04 | Effective Requirement | Domain ownership inventory (intake, config/validate, playbooks, extract/data, discovery, design, stage) with status and source PRD | current but stale | 02 `## Module Map` table, reconciled with the 20 `## Command Surface` domain table | Medium | **Stale:** `buildos-config` shows "Planned", entities is missing (added only in change notes), and `init`, `fitgap`, `export`, and `extract bulk` (20, from `0.2.0`) are missing. 20's `buildos extract bulk` effectively settles the "extract or data candidate" row. | PRD 02 ### Domain ownership; register Q-014 (owners of active-only runnable-playbook resolution and playbook contract validation) |
| 16-05 | Effective Requirement; Impacted Docs | Open ownership decisions: playbooks (08 and 09), data and extraction helpers (08), stage-movers (12) | current (open) | 03 register: new `Q-0xx` "Domain ownership for playbooks, data, and stage" | Medium | No register item tracks these today. D-002 is closed. | register Q-014 (playbook runnable resolution and contract validation, data and extraction helpers, stage-movers); PRD 02 ### Domain ownership |
| 16-06 | Effective Requirement | W1 R0 P6 remediation and P7 design notes | historical only | none (D-002 holds it) | High | | none: historical; register D-002 holds it |
| 16-07 | Purpose; Rationale | P6 misplacement into `buildos-intake` and `validate_config.py` | historical only | none (D-002) | High | | none: historical; register D-002 holds it |
| 16-08 | Impacted Docs | PRD 07 is not permission for non-intake commands. PRD 11 owns `buildos design promote`. 12 needs a stage decision | current (partly owned) | 07 and 11 already inline; stage goes to 16-05 register item | High | | PRD 02 ### Domain ownership; PRD 11 ## Contracts and Data; register Q-014 |
| 16-09 | Change Notes (from 17) | Entities domain owns graph operations. Extraction helpers are a separate decision | current | 17R `## Scope`; 02 `## Module Map` | High | | PRD 17 ## Scope; PRD 02 ### Domain ownership |
| 16-10 | Change Notes (from 18 and 19) | Packages and subcommands in one Go module; transport-neutral core with same-change MCP | superseded by 20 / never approved | none | High | Core and adapter rule is already in 20. | none: superseded by PRD 20 or never approved |
| 16-11 | Requirement History | 2026-11-23 entry: Go module to TS package | history | 02 `## Requirement History` (move) | High | Safety rule 3. | PRD 02 ## Requirement History |
| 16-12 | Required Baseline Annotations | 10, 11, 12, and 14 add change notes | historical only | none | High | 10, 11, and 12 still carry "Superseded by [16]" or "Revised by [16]" notes to fold. | none: editorial annotation instruction |

### PRD 17 Enhance Entity Consolidation and Canonical Resolution

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17-01 | Purpose | Generic, non-destructive consolidation. Personas first. Graph and resolver apply to all governed types. Type-specific matching expands only after reviewed rules | current | 17R `## Purpose` / `## Scope` | High | | PRD 17 ## Purpose; PRD 17 ## Scope |
| 17-02 | Non-destructive consolidation | Losing row stays in its original dataset with ID, evidence, anchors, and content intact. Status becomes `superseded` with exactly one reviewed `redirect` | current | 17R `## Contracts and Data` | High | | PRD 17 ### Lifecycle and redirects |
| 17-03 | Non-destructive consolidation | Winner keeps no loser list. Reverse membership is derived. `related` is non-canonical and never resolves | current | 17R `## Contracts and Data` | High | | PRD 17 ### Lifecycle and redirects |
| 17-04 | Terminal canonical resolution | One shared deterministic resolver for validators, domains, and workflows. Returns requested ID, terminal canonical ID, chain, and resolved flag | current | 17R `## Contracts and Data` | High | | PRD 17 ### Terminal resolution |
| 17-05 | Terminal canonical resolution | Reads preserve the recorded ID and expose canonical plus chain. New references and intentional updates store the terminal ID. No destructive bulk rewrite | current | 17R `## Contracts and Data` | High | | PRD 17 ### Terminal resolution |
| 17-06 | Terminal canonical resolution | Fail closed with actionable diagnostics on missing target, self-redirect, cross-type, cycle, or non-terminating chain | current | 17R `## Contracts and Data` | High | | PRD 17 ### Terminal resolution |
| 17-07 | Deterministic toolkit and index | Entities domain inside `toolkits/buildos/` owns graph validation, resolution, consolidation, and the index. Discovery and design call it directly, with no subprocess | current | 17R `## Component and Capability Map`; 02 `## Module Map` | High | Already TS-worded by W1 R7. | PRD 17 ## Component and Capability Map; PRD 02 ### Domain ownership |
| 17-08 | Deterministic toolkit and index | Entity commands: `consolidate`, `resolve`, `validate`, `rebuild-index` | current | 17R `## Component and Capability Map`; 20 `## Command Surface` links | High | | PRD 17 ## Component and Capability Map |
| 17-09 | Deterministic toolkit and index | Mutation is dry-run by default and needs explicit `--apply` | current | 17R (entity command contract) | High | | PRD 17 ### Entity commands |
| 17-10 | Deterministic toolkit and index | Mutation needs an explicit adopter root and loads and validates the whole graph before writing | current | 17R; 20 `## Output and Exit Contract` root model (consistent) | High | | PRD 17 ### Entity commands; PRD 20 ## Output and Exit Contract |
| 17-11 | Deterministic toolkit and index | A version 1 manifest's sources all belong to one canonical JSONL dataset | current | 17R `## Contracts and Data` (manifest) | High | Duplicated in the acceptance list and in 18. | PRD 17 ### Reviewed consolidation manifest |
| 17-12 | Deterministic toolkit and index | Same-filesystem temporary file, atomic replace of one JSONL file, preserve permissions, rebuild the derived index after the canonical write | current | 17R `## Contracts and Data` | High | Exit code `6` recovery in 20. | PRD 17 ### Atomic writes |
| 17-13 | Deterministic toolkit and index | Reports executable version and source revision, resolved root, mode, and write status | current (wording) | 20 `## Output and Exit Contract` (envelope already has these); 17R links | High | Say "package version", not "executable version", per 20. | PRD 17 ## Component and Capability Map; PRD 20 ## Output and Exit Contract |
| 17-14 | Deterministic toolkit and index | Scripts may add thin wrappers. No new durable Python. No `buildos-entities` binary | current | 06 (wrappers), 20 (no Python; no `buildos-entities` name); `none` in 17R | High | Already owned elsewhere. | PRD 06 ## Component and Capability Map (thin wrappers, no Python ships); PRD 20 ## Command Surface (no command needs Python); PRD 20 ## Legacy Command Names (no `buildos-entities` name) |
| 17-15 | Compatibility-to-strict migration | Compat mode treats a legacy redirect-less `superseded` row as a structured warning, excludes it from resolution, and never guesses. New or changed rows always meet strict rules | current | 17R `## Contracts and Data` ("strict vs compat mode") | High | | PRD 17 ### Strict and compatibility modes |
| 17-16 | Compatibility-to-strict migration | Strict rejects redirect-less legacy rows, graph violations, duplicate IDs across datasets, remap conflicts, and stale or non-reproducible indexes. Strict is the release and post-migration gate. Compat is temporary | current | 17R `## Contracts and Data` | High | | PRD 17 ### Strict and compatibility modes |
| 17-17 | Matching and review policy | Four-tier matching order: exact ID, unique type-scoped alias or member, versioned type key, then fuzzy or semantic to human review. Fuzzy and semantic matches never redirect automatically | current | 17R `## Contracts and Data` | High | | PRD 17 ### Matching and review policy |
| 17-18 | Matching and review policy | `persona-v1` identity key and reviewer-approved alias list. Normalization: trim and collapse ASCII whitespace, lowercase ASCII. Everything else is review-only | current | 17R `## Contracts and Data`; anchor `persona-identity-contract.md` | High | | PRD 17 ### Matching and review policy |
| 17-19 | Matching and review policy | Other types (requirements, capabilities, findings, test cases, results, runs, extractions) are enabled one at a time after their identity rules are validated | current (scope limit) | 17R `## Scope` | High | | PRD 17 ## Scope |
| 17-20 | Matching and review policy | `extraction-outcomes-v1`: disjoint `minted`, `referenced`, `updated` terminal-at-event lists. Legacy rows keep earlier provenance and are not rewritten | current | 17R `## Contracts and Data`, with 08 extraction paragraph linking | Medium | Could live in 08 instead. It is an extraction-row contract that depends on the resolver. | PRD 17 ### Matching and review policy; PRD 08 ### Draft lifecycle and anchors |
| 17-21 | Side-by-side source-build adoption | Source build verification, binary deployment, and live-data migration are distinct actions | current in principle, **stale wording** | 17R `## Rebuild Notes` (migration safety), restated for npm: pinned package version in `.os/manifest.json` and explicit `npx` version against a copy | Medium | **Conflict with 20:** written for "build `buildos` from a separate source checkout" and "installed binaries". 20 has no binaries. Owner decision. | PRD 17 ### Adoption and live-root migration safety |
| 17-22 | Side-by-side source-build adoption | Nine-step operator procedure: inventory, separate build, snapshot, compat and dry-run on copy, review, apply on copy plus strict, record revision, checksum, snapshot, and rollback, separate approval to reroute binaries, separate approval to mutate the live root | current in part | Steps 3 to 7 and 9 to 17R `## Rebuild Notes` or the operator guide `docs/assets/user/entities-consolidation-curate-and-resolve-records.md`. Steps 2 and 8 are superseded by 20 | Medium | R-004 tracks live migration. | PRD 17 ### Adoption and live-root migration safety; PRD 17 ## Requirement History |
| 17-23 | Side-by-side source-build adoption | Never copy the source `system/` scaffold wholesale over an installed root. Old tooling is read-only for redirect-bearing datasets until cutover | current (first part owned by 20) | 20 `## Project Initialization and Adoption` (adoption writes only manifest, wrappers, skills); second half to 17R | Medium | "Old tooling" means the Go tools during the legacy-name window. | PRD 20 ## Project Initialization and Adoption; PRD 17 ### Adoption and live-root migration safety |
| 17-24 | Side-by-side source-build adoption | W1 R4 P3 fixture rehearsal evidence (`testdata/persona-pilot/`, `persona_rehearsal_test.go`) | historical only | 17R `## Requirement History` or `## Source Anchors` | High | Go test path. Confirm the TS fixture location after the W1 R7 P3 port. | PRD 17 ## Requirement History; PRD 17 ## Source Anchors |
| 17-25 | Acceptance requirements | Acceptance list: one- and multi-hop, replaced winner, idempotent with conflict, single-dataset v1, actionable failures (incl. inactive terminals and illegal redirect statuses), persona fixtures, generic all-type fixtures, byte-identical index, copied-root integration, failure injection | current | 17R `## Rebuild Notes` (acceptance) | High | | PRD 17 ### Acceptance |
| 17-26 | Acceptance requirements | Copied-root acceptance met by sanitized pilot. Live migration still a prerequisite | current (gate) / historical evidence | 03 R-004 (gate); 17R history | High | | register R-004; PRD 17 ### Adoption and live-root migration safety; PRD 17 ## Requirement History |
| 17-27 | Change Notes | W1 R4 P2, P4, and P5 implementation notes (single-dataset rationale, `pkg/entities` imports, persona adapter, no live migration, closeout evidence) | historical only | 17R `## Requirement History` (condensed) | High | Integration facts from P4 are already in Integration Impact (17-38 to 17-43). | PRD 17 ## Requirement History |
| 17-28 | Change Notes | W1 R7: entity domain in the TS package. Output matches Go output | current | 20 `## Compatibility` (already); 17R one-line link | High | | PRD 20 ## Compatibility; PRD 17 ## Component and Capability Map |
| 17-29 | Change Notes (18 and 19) | Public executable and module topology; core and adapter placement with MCP | superseded by 20 / never approved | none | High | | none: superseded by PRD 20 or never approved |
| 17-30 | Affected Baseline Docs | Table of baselines enhanced. "PRD 07 is not changed" | historical only | none | High | The boundary fact moves to 17-36. | none: editorial table; the boundary fact is in PRD 17 ### Derived index |
| 17-31 | Contracts and Data: Redirect object | Redirect object schema: `target_id`, `kind`, `decided_at` (ISO 8601 UTC), `decided_by`, `reason`, `evidence_refs` (empty only with no evidence) | current | 17R `## Contracts and Data` | High | | PRD 17 ### Redirect object |
| 17-32 | Contracts and Data: Redirect object | `kind` semantics: `duplicate`, `consolidated`, `replaced` | current | 17R `## Contracts and Data` | High | | PRD 17 ### Redirect object |
| 17-33 | Contracts and Data: Redirect object | Lifecycle and graph invariants: one redirect on new `superseded`; none on `draft`, `active`, `archived`; source and target exist, differ, and share a type; acyclic, terminating at one current record; archived means no successor; losing fields intact; derived reverse membership; `related` outside | current | 17R `## Contracts and Data` | High | | PRD 17 ### Lifecycle and redirects |
| 17-34 | Contracts and Data: Resolver result | Resolver result shape `{requested_id, canonical_id, chain, resolved}` | current | 17R `## Contracts and Data` | High | | PRD 17 ### Terminal resolution |
| 17-35 | Contracts and Data: Reviewed consolidation manifest | UTF-8 JSON, `version: 1`, non-empty `mappings`. Each mapping has `source_id`, `target_id`, and the redirect decision fields. Single dataset. Root-independent reviewed input, not authority. Authority changes only on validated atomic apply | current | 17R `## Contracts and Data` | High | | PRD 17 ### Reviewed consolidation manifest |
| 17-36 | Contracts and Data: Derived index | `system/.os/indexes/entity-resolution.json` is a generated projection with lexically ordered `canonical_by_id` and `members_by_canonical`. Deletable and rebuildable. JSONL is authoritative | current | 17R `## Contracts and Data` | High | Add the installed-root path `.os/indexes/entity-resolution.json` from 18 (18-13). | PRD 17 ### Derived index |
| 17-37 | Contracts and Data: Derived index | `references.json` is the intake index and never carries entity redirects | current | 07 `## Contracts and Data` (boundary) with 17R link | High | | PRD 07 ## Contracts and Data; PRD 17 ### Derived index |
| 17-38 | Integration Impact | Readers, validators, playbook target resolution, extraction, and producers share the terminal resolver | current | 17R `## Integrations` | High | | PRD 17 ## Integrations |
| 17-39 | Integration Impact | Consumers keep original IDs and expose canonical plus chain. Producers store canonical IDs and distinguish reuse or update from mint | current | 17R `## Integrations`; 08 `## Integrations` | High | 08 holds this only as a change note today. | PRD 17 ## Integrations; PRD 08 ## Integrations |
| 17-40 | Integration Impact | Playbooks targeting a losing ID stay auditable and resolve when used | current | 09 `## Contracts and Data` / `## Integrations` (inline) | High | Exists only as 09 change notes today. | PRD 09 ## Contracts and Data |
| 17-41 | Integration Impact | Discovery stores canonical targets and run links, and keeps requested IDs and chains. Authored rows and historical records stay unchanged | current | 10 `## Contracts and Data` (inline) | High | 10 holds this only as a change note. | PRD 10 ## Contracts and Data |
| 17-42 | Integration Impact | Design promotion resolves a requested finding ID to a terminal `qualified` finding, reports requested, canonical, and chain, and writes the back-reference only to the canonical finding | current | 11 `## Contracts and Data` (inline) | High | 11 is the `design promote` owner. Check whether this is already inline. | PRD 11 ## Contracts and Data |
| 17-43 | Integration Impact | Type-aware terminal lifecycle: most types end `active`; findings `qualified`; runs `running`, `closed`, or `aborted`. `qualified` is invalid elsewhere | current | 17R `## Contracts and Data` ("draft lifecycle" sibling); 08 summary | High | | PRD 17 ### Lifecycle and redirects; PRD 08 ### Draft lifecycle and anchors |
| 17-44 | Integration Impact | Extraction-outcome validation resolves to terminal IDs. Graph validation ignores `PB-NNN`. The playbook-aware API consults the playbook resolver. The persona matcher is proposal-only | current | 17R `## Integrations` | High | | PRD 17 ## Integrations |
| 17-45 | Integration Impact | First release supports reviewed persona consolidation plus copied-root rehearsal before broader rollout | current (scope) | 17R `## Scope` | High | | PRD 17 ## Scope |
| 17-46 | Integration Impact | Pre-upgrade audit prompt stays proposal-only until the resolver, validator, writer, and index exist | stale | 17R `## Integrations`, reworded, or `none` | Low | The condition now looks met. The prompt lives at `.make-docs/system/prompts/pre-upgrade-entity-consolidation-audit.prompt.md`, a Make Docs-managed tree, which conflicts with the 05 boundary. Owner decision. | PRD 17 ## Integrations |
| 17-47 | Integration Impact | Live-root migration needs a snapshot, strict validation, deterministic index reproduction, and separately approved binary and data cutovers | current (binary wording stale) | 17R `## Rebuild Notes`; 03 R-004 | Medium | Restate "binary cutover" as a package version pin. | PRD 17 ### Adoption and live-root migration safety; register R-004 |
| 17-48 | Change Notes (19); Required Baseline Annotations | Integration via core operations with MCP; add "Enhanced by" notes to 01, 02, 04, 08, 09, 14, 15, 16 | never approved / historical only | none | High | Those "Enhanced by [17]" notes (14 in 01 to 12) must be folded or repointed to 17R. | none: never approved, or an editorial annotation instruction |

### PRD 18 Revise Unified BuildOS CLI and Distribution

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 18-01 | Unified module and domain ownership | One Go module, `cmd/buildos/`, `internal/cli`, `internal/layout`, `internal/<domain>` | superseded by 20 | 20 `## Runtime and Package`; 02 `## Module Map` | High | | PRD 20 ## Runtime and Package; PRD 02 ## Module Map |
| 18-02 | Unified module and domain ownership | Domain boundaries stay contracts. No undifferentiated package. Cross-domain calls use in-package interfaces, never subprocesses | current (language-neutral) | 02 `## Module Map` (with 16-01) | Medium | 20 forbids adapter-to-adapter shelling, but domain-to-domain "no subprocess" is explicit only for entities (17-07). Make it general in 02. | PRD 02 ### Domain ownership |
| 18-03 | Unified module and domain ownership | Temporary `pkg/entities` sharing until W1 R5 | historical only | none | High | | none: historical |
| 18-04 | Canonical command and output contract | Command list incl. `setup`, `update`, `uninstall` | superseded by 20 | 20 `## Command Surface` (`init`; update and uninstall are out of scope for W2) | High | | PRD 20 ## Command Surface; PRD 20 ## Scope |
| 18-05 | Canonical command and output contract | Shared output: human default, `--json`, `--root`, help and version, shared exit codes, diagnostics, envelope | superseded by 20 | 20 `## Output and Exit Contract` | High | | PRD 20 ## Output and Exit Contract |
| 18-06 | Canonical command and output contract | JSON envelope minimum shape | superseded by 20 | 20 (identical) | High | | PRD 20 ## Output and Exit Contract |
| 18-07 | Canonical command and output contract | Exit codes `0`, `2`, `3`, `4`, `5`, `6` | superseded by 20 | 20 (adds `1` and `10`; Q-013 closed) | High | | PRD 20 ## Output and Exit Contract |
| 18-08 | Canonical command and output contract | Diagnostics are JSON records or stderr. Info and deprecation go to stderr and never change stdout or exit | superseded by 20 | 20 | High | | PRD 20 ## Output and Exit Contract |
| 18-09 | Canonical command and output contract | `write_status` values | superseded by 20 | 20 | High | | PRD 20 ## Output and Exit Contract |
| 18-10 | Canonical command and output contract | Source build reports `dev` and `unknown`. Release injects values | superseded by 20 | 20 | High | | PRD 20 ## Output and Exit Contract |
| 18-11 | Canonical command and output contract | No `buildos-entities` or `buildos-lifecycle` binary | superseded by 20 | 20 `## Legacy Command Names` | High | | PRD 20 ## Legacy Command Names |
| 18-12 | W1 R4 seed contract | **Entity invocation contract**: `resolve --root --mode compat\|strict --id [--json]`; `validate --root --mode [--json]`; `consolidate --root --mode --manifest [--apply] [--json]`; `rebuild-index --root --mode [--check\|--apply] [--json]`; consolidate dry-run default; rebuild-index check default, flags mutually exclusive; explicit root and mode required | **current, no owner** | 17R new `## Component and Capability Map` or "Entity commands" subsection | High | **Gap** (key finding 2). Only the PRD 20 golden-parity promise holds it today. | PRD 17 ### Entity commands |
| 18-13 | W1 R4 seed contract | Installed-root index path `.os/indexes/entity-resolution.json`; scaffold path `system/.os/indexes/...`; `references.json` stays intake-owned | current | 17R `## Contracts and Data` | High | | PRD 17 ### Derived index |
| 18-14 | W1 R4 seed contract | W1 R4 P1 to P5 delivery narratives; "source-build-only"; no live migration | historical only | none (history records exist) | High | | none: historical |
| 18-15 | W1 R5 consolidation | Canonical subcommands: `intake convert`, `intake index references`, `intake index playbooks`, `discovery run`, `discovery qualify`, `design promote` | current (mappings) | 07 (intake; already lists `convert` and index rebuild), 10 (discovery; verify inline), 11 (design; already inline with flags); 20 domain table | Medium | Verify that 10 names `discovery run` and `discovery qualify` inline. If not, add them. | PRD 07 ## Component and Capability Map; PRD 10 ## Component and Capability Map; PRD 11 ## Contracts and Data; PRD 20 ## Command Surface |
| 18-16 | W1 R5 consolidation | Parity before removing old modules | superseded by 20 | 20 `## Compatibility` | High | | PRD 20 ## Compatibility (Go code for a domain is removed only after that domain passes its parity gate) |
| 18-17 | W1 R5 consolidation | Legacy aliases for one minor cycle via invoked-basename routing, deprecation to stderr, `justfile` install and rollback | superseded by 20 | 20 `## Legacy Command Names` (through `0.2.x`, removed in `0.3.0`, `bin` map) | High | `justfile` rollback is gone. | PRD 20 ## Legacy Command Names |
| 18-18 | Distribution contract | `0.1.0`, Apache-2.0 | superseded by 20 | 20 | High | | PRD 20 ## Release (first public version `0.1.0`); PRD 20 ## Runtime and Package (Apache-2.0) |
| 18-19 | Distribution contract | Signed archives plus Homebrew; multi-OS archives; SHA-256 manifest; CycloneDX SBOM; signed provenance; formula; release and upgrade notes; install, upgrade, rollback, and uninstall smoke tests; unsigned source is dev-only | superseded by 20 | 20 `## Release`, `## Supply Chain` (npm only, SBOM, provenance, 2FA) | High | Possible lost items: "upgrade compatibility notes" and upgrade, rollback, and uninstall smoke tests. 20 moves update and uninstall to W2. R-003 tracks hardening. | PRD 20 ## Release; PRD 20 ## Supply Chain; register R-003 (upgrade compatibility notes and upgrade, rollback, and uninstall smoke tests deferred to W2) |
| 18-20 | Distribution contract | R-003 closes only on release and install evidence | current | 03 R-003 | High | Register owns it. | register R-003 |
| 18-21 | W2 installation-lifecycle follow-on | `setup`, `setup --dry-run`, `setup backup`, `setup remove`, `update`, `uninstall`; manifest classifications; Homebrew-aware update | superseded by 20 / future W2 | none now. 20 `## Scope` says W2 owns update, uninstall, and sync. The W2 design will own the rest | Medium | "Removing BuildOS leaves Make Docs intact" may need a home when W2 lands. | register R-003 (lifecycle commands and manifest ownership classifications deferred to W2); PRD 20 ## Scope |
| 18-22 | Rationale; Impacted Docs; Required Baseline Annotations; Change Notes (19) | One executable rationale; lineage notes; MCP supersession | historical only / never approved | none | High | | none: historical or never approved |

### PRD 19 Revise Build OS Headless Core, CLI, and MCP Program

| # | Legacy section | Requirement summary | Still current? | Proposed product owner | Conf. | Notes | Final owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 19-01 | Change Type; Authority and Phase 1 approval gate | Draft, non-authoritative. Six-condition approval gate | never approved | none. 03 Q-011 records the disposition | High | | none: never approved; register Q-011 records the disposition |
| 19-02 | Target operating and parity model | One program holds core, CLI, and MCP. MCP runs from the same executable | never approved | Core and CLI part: superseded by 20. MCP: deferred to Q-012 | High | 20 `## Scope`: no MCP server, seam reserved. | none: never approved; PRD 20 ## Scope states no MCP server; register Q-012 tracks MCP |
| 19-03 | Target operating and parity model | Only the core applies domain rules and authoritative writes. Adapters map to the same core. No adapter shells through another | superseded by 20 | 20 `## Command Surface` core rules (adopted) | High | | PRD 20 ## Command Surface |
| 19-04 | Target operating and parity model | Every CLI operation has an MCP twin. Transport-only features are classified | never approved | none. Future MCP revision (Q-012, R-006) | High | | none: never approved; register Q-012 and R-006 |
| 19-05 | Target operating and parity model | `resolve → inspect → plan → authorize → apply → verify → record` pipeline; plans are not authorization | never approved | none. Input to Q-004 and the MCP revision | High | | none: never approved; input to register Q-004 |
| 19-06 | Target operating and parity model | UI and coordinating server separately gated. Local operation complete without them | never approved | none. Q-008 and Q-009 | High | | none: never approved; register Q-008 and Q-009 |
| 19-07 | Target operating and parity model | CLI and MCP names are placeholders | historical only | none | High | | none: historical |
| 19-08 | Common contract invariants: Authority | Files and JSONL canonical; indexes, SQLite, caches derived | partly current | 08 `## Contracts and Data` (layered canonicity; "no SQLite"); Q-003 | Medium | 08 already states the JSONL and no-SQLite posture. | PRD 08 ## Contracts and Data; register Q-003 |
| 19-09 | Common contract invariants: Results | Typed, versioned results; CLI JSON and MCP project the same fields | partly superseded by 20 | 20 (typed results and errors); versioning to R-006 | Medium | | PRD 20 ## Command Surface; register R-006 |
| 19-10 | Common contract invariants: Provenance | Operation ID, digests, actor, identity, and other receipt fields | never approved | none. Q-004 | High | | none: never approved; register Q-004 |
| 19-11 | Common contract invariants: Idempotency | Every operation declares an idempotency or precondition model | never approved | none (17R has entity-specific idempotency) | High | | none: never approved; entity idempotency is in PRD 17 ### Acceptance |
| 19-12 | Common contract invariants: Dry run | Every mutation has an inspectable plan | never approved (partly realized) | none. 20 has `init --dry-run`; 17R has consolidate dry-run | Medium | | none: never approved as a general rule; dry runs exist in PRD 20 ## Project Initialization and Adoption, PRD 17 ### Entity commands, and PRD 11 ## Contracts and Data (`design promote finding --dry-run`) |
| 19-13 | Common contract invariants: Errors | Distinct error classes | superseded by 20 | 20 exit-code classes | High | | PRD 20 ## Output and Exit Contract |
| 19-14 | Common contract invariants: Recovery | Recovery is an explicit operation, not a blind rerun | never approved (partly realized) | none. 20 exit `6` names the recovery command. R-005 | Medium | | none: never approved; register R-005; exit code 6 recovery is in PRD 20 ## Output and Exit Contract |
| 19-15 | Common contract invariants: Concurrency | Lock or optimistic concurrency, reject stale plans | never approved | none. R-005 | High | | none: never approved; register R-005 |
| 19-16 | Common contract invariants: Safety | Never persist secrets or env dumps. Destructive, networked, or privacy-affecting actions need explicit authorization | never approved | none now. Decide with 14-06 whether a runtime safety rule belongs in 20 or 02. R-007 | Medium | Pairs with the local-only gap. | PRD 20 ## Runtime and Package; register R-007 |
| 19-17 | Common contract invariants: Compatibility | Current toolkit outputs are migration evidence until parity accepted | superseded by 20 | 20 `## Compatibility` | High | | PRD 20 ## Compatibility |
| 19-18 | Master capability matrix | 33 rows: SYS, PRJ, CFG, EVD, EXT, DAT, ENT, PBK, RUN, FND, QLF, HOF, REL, OPR, LFC, CMP, SAF, MCP, PKG, SRV, UI | never approved | none in `docs/prd/`. Deferred input to the MCP revision (Q-011) | High | See open question 3. | none: never approved; register Q-011 keeps it as input to the MCP revision |
| 19-19 | Detailed capability contracts | Per-row surface, authority, I/O, execution, migration, acceptance, and non-goals | never approved | Same as 19-18. Facts that are current already sit with 07, 10, 11, and 17R (for example EVD-001 output fields, ENT-001 to ENT-004) | High | | none: never approved; register Q-011; current facts are in PRDs 07, 10, 11, and 17 |
| 19-20 | Decision-inventory reconciliation | DI-001 to DI-017 | historical only | 03 register (Q-001, Q-003 to Q-012, R-001 to R-008). DI-014 (Go runtime) obsolete | High | Register dispositions reference DI IDs. Keep them as history. | register Q-001, Q-003 to Q-011, and R-001 to R-008 (Disposition lines; DI-014 is obsolete) |
| 19-21 | Phase assignment and decision gates | Phases 1 to 7 | never approved / historical | none | High | | none: never approved or historical |
| 19-22 | Global non-goals | No separate core, CLI, or MCP executables | current (implicit) | 20 `## Scope` (one package, one CLI) | Medium | | PRD 20 ## Command Surface; PRD 20 ## Scope |
| 19-23 | Global non-goals | Adapters, UI, and server own no domain rules. Server, SQLite, and cache never canonical by default | partly current | 20 (adapters); 08 (no SQLite); Q-003 | Medium | | PRD 20 ## Command Surface; PRD 08 ## Contracts and Data; register Q-003 |
| 19-24 | Global non-goals | No direct writes into Make Docs-owned trees. Never bundle, vendor, or fork Make Docs | current | 05 and 20 (`system/` carries no Make Docs content; never write Make Docs-owned files); R-009 tracks the `design promote` exception | High | | PRD 05 ## Integrations; PRD 20 ## Make Docs Companion Setup; register R-009 |
| 19-25 | Global non-goals | No publish, release, deploy, binary replacement, or live data mutation without separate authorization | current | 20 `## Release` ("Each publication needs explicit maintainer approval"); 17R (live data) | High | | PRD 20 ## Release; PRD 17 ### Adoption and live-root migration safety |
| 19-26 | Baseline Being Revised: 11 | Direct BuildOS writes of Make Docs designs conflict with the boundary. HOF-001 export replaces promote | current (as limitation) / HOF-001 never approved | 11 and 20 (limitation), 03 R-009 | High | | PRD 11 ## Contracts and Data; PRD 20 ## Command Surface; register R-009 |
| 19-27 | Baseline Being Revised: 05 | Make Docs is a separate companion product, not a BuildOS subsystem | current | 05 and 20 `## Make Docs Companion Setup` (already) | High | | PRD 05 ## Integrations; PRD 20 ## Make Docs Companion Setup |
| 19-28 | Required Baseline Annotations | 32 "Superseded by [19]" notes across 01 to 12 | never approved | none. Remove or replace with links to 20 or the register | High | Misleading active text today. | none: never approved; the notes are gone from PRDs 01 to 12 |

Row count: 20 (PRD 13) + 15 (PRD 14) + 10 (PRD 15) + 12 (PRD 16) + 48 (PRD 17) + 22 (PRD 18) + 28 (PRD 19) = **155 rows**.

Disposition summary:

| PRD | Current rows moving to an owner | Current with no owner today (gaps) | Superseded | Historical or never approved |
| --- | --- | --- | --- | --- |
| 13 | 16 (stay in 13; 13-20 to 08 and 17R) | 13-20 entity hygiene | 0 | 4 |
| 14 | 3 (02, 06, 17R) | 14-06 local-only posture | 7 | 5 |
| 15 | 6 (08, 07, 17R) | none | 0 | 4 |
| 16 | 6 (02, register, 17R) | 16-05 open ownership decisions (needs a register item) | 1 | 5 |
| 17 | about 38 (17R, plus 07, 08, 09, 10, 11, 20) | 17-21 and 17-22 need npm restatement | 2 | about 8 |
| 18 | 4 (17R, 02, 07, 10, 11, register) | 18-12 entity flag contract | 14 | 4 |
| 19 | 6 already owned (20, 05, 08, register) | 19-16 safety (paired with 14-06) | 4 | about 17 |

## 3. Cross-references to PRDs 13 to 19

Method: a filename match for `1[3-9]-(adopter-owned-config-surface|revise-*|enhance-*).md` across the repo, excluding `.git`. "Markdown links" counts `](...)` link targets. The remaining mentions are code-span or plain paths, which still break or go stale on a rename.

Not found in `README.md`, root `AGENTS.md`, `CLAUDE.md`, `USE_CASES*.md`, `guide/` (content, README, or built HTML), `system/`, `skills/`, or `.make-docs/system/`. Textual "PRD 1x" mentions (no filename) also appear in `toolkits/*` README, AGENTS, and CLAUDE files, `docs/assets/maintainer/*`, `docs/assets/user/promote-qualified-findings-to-designs.md`, and two designs (`2026-11-23-buildos-node-typescript-cli-rewrite.md` ×4, `2026-08-13-...headless-operating-model.md` ×4). Recheck these by hand when renumbering wording.

| File | Mentions | Markdown links | By PRD |
| --- | --- | --- | --- |
| `.make-docs/archive/history/2026-06-04-w1-r0-p3-intake-conversion.md` | 2 | 1 | 14×2 |
| `.make-docs/archive/history/2026-06-04-w1-r0-p4-data-layer-extraction.md` | 2 | 1 | 15×2 |
| `.make-docs/archive/history/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard.md` | 2 | 1 | 14×2 |
| `.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md` | 4 | 2 | 14×2, 16×2 |
| `.make-docs/archive/history/2026-06-05-w1-r0-p7-qualified-finding-design-promotion.md` | 2 | 1 | 16×2 |
| `.make-docs/archive/history/2026-07-21-w1-r4-entity-consolidation-planning.md` | 1 | 1 | 17×1 |
| `.make-docs/archive/history/2026-07-21-w1-r4-p1-effective-requirements-and-redirect-contract.md` | 2 | 2 | 17×1, 18×1 |
| `.make-docs/archive/history/2026-07-21-w1-r4-p2-deterministic-graph-engine-and-mutation-surface.md` | 2 | 2 | 17×1, 18×1 |
| `.make-docs/archive/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md` | 4 | 2 | 17×2, 18×2 |
| `.make-docs/archive/history/2026-07-21-w1-r4-p4-canonical-references-across-consumers-and-producers.md` | 4 | 2 | 17×2, 18×2 |
| `.make-docs/archive/history/2026-07-21-w1-r4-p5-naive-reader-documentation-and-release-evidence.md` | 4 | 2 | 17×2, 18×2 |
| `.make-docs/archive/history/2026-07-21-w1-r5-unified-buildos-cli-and-distribution-planning.md` | 1 | 1 | 18×1 |
| `docs/assets/maintainer/buildos-toolkit-cli-development.md` | 7 | 3 | 14×2, 16×3, 17×1, 18×1 |
| `docs/assets/maintainer/operating-layer-contracts-maintenance.md` | 3 | 0 | 16×1, 17×1, 18×1 |
| `docs/assets/maintainer/operating-layer-entities-consolidation-and-resolution.md` | 4 | 2 | 17×2, 18×2 |
| `docs/assets/user/entities-consolidation-curate-and-resolve-records.md` | 4 | 2 | 17×2, 18×2 |
| `docs/assets/user/promote-qualified-findings-to-designs.md` | 2 | 1 | 16×2 |
| `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md` | 1 | 1 | 18×1 |
| `docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface/00-overview.md` | 4 | 0 | 13×4 |
| `docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface/01-prd-and-contract-alignment.md` | 2 | 0 | 13×2 |
| `docs/plans/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/00-overview.md` | 2 | 1 | 14×2 |
| `docs/plans/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 1 | 0 | 14×1 |
| `docs/plans/2026-06-10-w1-r3-flow-automation-prompt-packs/00-overview.md` | 1 | 0 | 17×1 |
| `docs/plans/2026-06-10-w1-r3-flow-automation-prompt-packs/01-lineage-and-prd-scope.md` | 1 | 0 | 17×1 |
| `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md` | 19 | 6 | 14×3, 15×2, 16×3, 17×10, 18×1 |
| `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 1 | 0 | 17×1 |
| `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 3 | 3 | 14×1, 16×1, 18×1 |
| `docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 1 | 1 | 15×1 |
| `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` | 9 | 0 | 14×1, 16×1, 18×7 |
| `docs/plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/00-overview.md` | 32 | 6 | 13×1, 14×2, 15×1, 16×2, 17×2, 18×2, 19×22 |
| `docs/plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/01-authority-and-capability-map-gate.md` | 1 | 1 | 19×1 |
| `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-overview.md` | 2 | 2 | 18×1, 19×1 |
| `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/01-prd-authority-maintenance.md` | 3 | 0 | 13×1, 16×1, 17×1 |
| `docs/work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md` | 1 | 1 | 14×1 |
| `docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md` | 2 | 2 | 16×2 |
| `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/00-index.md` | 1 | 0 | 13×1 |
| `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/01-prd-and-contract-alignment.md` | 4 | 0 | 13×4 |
| `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/02-operating-config-surface.md` | 1 | 0 | 13×1 |
| `docs/work/2026-06-03-w1-r1-adopter-owned-config-surface/03-migration-and-validation.md` | 1 | 0 | 13×1 |
| `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/01-prd-guide-design-lineage.md` | 2 | 1 | 14×2 |
| `docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard/02-toolkit-scaffold-validation.md` | 1 | 1 | 14×1 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-index.md` | 2 | 2 | 17×1, 18×1 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/01-prd-and-contract-alignment.md` | 5 | 5 | 14×1, 15×1, 16×1, 17×1, 18×1 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/02-resolver-toolkit-and-index.md` | 4 | 4 | 14×1, 16×1, 17×1, 18×1 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/03-persona-pilot-and-migration.md` | 3 | 3 | 14×1, 15×1, 17×1 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/04-read-write-and-extraction-integration.md` | 2 | 2 | 15×1, 17×1 |
| `docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/05-guides-validation-and-closeout.md` | 3 | 3 | 14×1, 17×1, 18×1 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | 3 | 3 | 14×1, 16×1, 18×1 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/01-unified-command-and-compatibility-contract.md` | 4 | 4 | 14×1, 16×1, 17×1, 18×1 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/02-domain-migration.md` | 2 | 2 | 17×1, 18×1 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/03-legacy-alias-and-installation-migration.md` | 3 | 3 | 14×1, 16×1, 18×1 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/04-packaging-and-release-hardening.md` | 2 | 2 | 14×1, 18×1 |
| `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/05-documentation-deprecation-and-w2-handoff.md` | 4 | 4 | 14×1, 16×1, 17×1, 18×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | 1 | 1 | 19×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/01-pre-implementation-reconciliation-gate.md` | 2 | 2 | 18×1, 19×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/02-go-core-cli-and-mcp-contract-seam.md` | 3 | 3 | 17×1, 18×1, 19×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/03-project-state-intake-data-and-query-migration.md` | 3 | 3 | 13×1, 16×1, 19×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/04-discovery-qualification-and-provenance-migration.md` | 2 | 2 | 17×1, 19×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/05-recovery-removal-and-compatibility-migration.md` | 4 | 4 | 14×1, 16×1, 18×1, 19×1 |
| `docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/06-mcp-parity-distribution-evidence-and-program-handoffs.md` | 2 | 2 | 18×1, 19×1 |
| `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md` | 2 | 1 | 13×1, 17×1 |
| `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md` | 1 | 0 | 17×1 |
| `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/03-entities-port.md` | 3 | 0 | 16×1, 17×2 |
| `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-discovery-and-design-port.md` | 1 | 0 | 16×1 |
| `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/07-skills-and-validation.md` | 4 | 4 | 13×4 |
| `docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md` | 1 | 1 | 13×1 |
| `toolkits/AGENTS.md` | 3 | 3 | 14×1, 16×1, 18×1 |
| `toolkits/buildos-design/AGENTS.md` | 1 | 1 | 16×1 |
| `toolkits/buildos-design/CLAUDE.md` | 1 | 1 | 16×1 |
| `toolkits/buildos-design/README.md` | 3 | 2 | 16×3 |
| `toolkits/buildos-discovery/AGENTS.md` | 1 | 1 | 16×1 |
| `toolkits/buildos-discovery/README.md` | 3 | 2 | 16×3 |
| `toolkits/buildos-intake/AGENTS.md` | 2 | 2 | 14×1, 16×1 |
| `toolkits/buildos-intake/README.md` | 1 | 1 | 14×1 |
| `toolkits/buildos/AGENTS.md` | 4 | 2 | 17×2, 18×2 |

Group subtotals:

| Group | Files | Mentions |
| --- | --- | --- |
| .make-docs/archive/history (historical; safety rule 6: do not rewrite) | 12 | 30 |
| docs/assets/maintainer | 3 | 14 |
| docs/assets/user | 2 | 6 |
| docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md | 1 | 1 |
| docs/plans/2026-06-03-w1-r1-adopter-owned-config-surface | 2 | 6 |
| docs/plans/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard | 2 | 3 |
| docs/plans/2026-06-10-w1-r3-flow-automation-prompt-packs | 2 | 2 |
| docs/plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution | 4 | 24 |
| docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution | 1 | 9 |
| docs/plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation | 2 | 33 |
| docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite | 2 | 5 |
| docs/work/2026-06-03-w1-r0-build-os-baseline | 2 | 3 |
| docs/work/2026-06-03-w1-r1-adopter-owned-config-surface | 4 | 7 |
| docs/work/2026-06-04-w1-r2-buildos-toolkit-cli-deployment-standard | 2 | 3 |
| docs/work/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution | 6 | 19 |
| docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution | 6 | 18 |
| docs/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta | 7 | 17 |
| docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite | 6 | 12 |
| toolkits/ | 9 | 19 |

Totals outside `docs/prd/`: 75 files, 231 filename mentions, 127 Markdown links. By target PRD: 13: 22, 14: 35, 15: 9, 16: 41, 17: 48, 18: 45, 19: 31

Inside `docs/prd/` (for completeness): 167 filename mentions and 119 Markdown links across all 21 PRDs. Of those, 65 are `### Change Notes` bullets in PRDs 01 to 12 pointing at legacy PRDs: 13 ×8, 14 ×4, 15 ×3, 16 ×4, 17 ×14, 19 ×32. Per file: 01 ×6, 02 ×11, 04 ×2, 05 ×4, 06 ×4, 07 ×3, 08 ×10, 09 ×7, 10 ×6, 11 ×6, 12 ×6. PRD 20 links 13 and 17 in its body (`## Scope`, `## Command Surface`, `## Compatibility`) and lists 14, 18, and 19 in `## Source Anchors`. 03 links 16, 17, and 19 in D-002, D-005, Q-001 ("PRD 19 and the Phase 2 capability-map delta carry the approved result"), Q-011, and R-004. 04 cites 15 and 17 in the glossary Notes column.

Anchored links that a restructure breaks: `../../prd/13-adopter-owned-config-surface.md#contracts-and-data` ×5 and `#capability-addition-or-enhancement` ×1, all in W1 R7 work 07 and 08. The second anchor disappears when PRD 13 is restructured.

## 4. End-state options under the Make Docs rules

### Governing rule text

- Renumbering: "Do not renumber existing PRDs merely because authority changed." (prd-change-management) and "Never renumber or reorder existing active PRDs merely because authority changed." (output contract)
- Renaming is a sanctioned operation: "Update `docs/prd/00-index.md` whenever an authoritative PRD is created, renamed, retired from the active set, or changes navigation relationships." (prd-change-management, Index And Status Rules)
- Identity: "Never use active PRD filenames, H1 titles, index kinds, or document identities that describe editorial operations such as additions, enhancements, revisions, removals, migrations, or reconciliation." Also: "Preserve unaffected text, anchors, links, terminology, and document identity." (An editorial identity is not "unaffected", so changing it is required.)
- Creating: "Create a new numbered PRD only for a coherent, wholesale new capability, subsystem, or product boundary with no suitable existing owner." Also: "If a candidate cuts across several owners, update each owning PRD rather than creating a cross-cutting editorial record."
- Active set: "Every root entry in `docs/prd/` is part of the active namespace." Also: "Status describes the current product authority, not the operation that changed it." And: "Related links connect current authorities to one another. Do not link retired editorial change records as product authority."
- Removal: "Express removals and deprecations as current scope, non-goal, limitation, status, or boundary text in the owning PRD, then preserve the prior contract in requirement history when useful." Also: "Do not leave a removed requirement active in the body and rely on a history entry, backlink, or separate removal document to override it."
- Archive: "Never archive designs, plans, work, or PRDs unless the user explicitly asks." Also: "Apply these rules only when writing a fresh active PRD namespace through `full-set generation`." And: "Do not place loose files directly under `.make-docs/archive/prds/`; it should contain dated directories only." `.make-docs/archive/prds/` does not exist yet.
- Archive links: "Preserve recorded outcomes and coordinates; repair links only through a recorded reviewed move." (`.make-docs/archive/AGENTS.md`)
- Validator remediation, `PRD-AUTH-001`: "Move the current requirement into its owning product PRD, or create a capability-named PRD only when the subject is genuinely new." `PRD-AUTH-005`: "Link to the updated capability-named PRD. Keep former links only in canonical archive or standardized provenance contexts."
- Validator scope: "A completed work record at its working path remains in scope." Also: "A stored copy with a copied header remains outside the source set."
- Gaps: no rule requires contiguous numbers. "Use `05` through `99`" and the ban on renumbering imply that a retired number leaves a gap.

### Options

- **(a) Rename in place, keeping the number.** This is allowed. Renaming the slug and H1 is not renumbering, and the index rule names "renamed" as an expected event. It fits only where the PRD's subject is a coherent product capability with no better owner. Cost: every link to the old filename changes, and section anchors change when editorial headings go.
- **(b) Move content into existing owners and retire the number.** The file leaves `docs/prd/` and its number becomes a gap. Retirement is either deletion (git history keeps it) or archiving. Archiving one PRD is a departure from the archive rules, which are written for whole-set moves into a dated directory, and it needs an explicit owner request. Either way, links from plans, work, guides, and `toolkits/` must be retargeted in the same change set (safety rule 4). History records under `.make-docs/archive/history/` (30 mentions, 18 links) would dangle unless the file is archived and those links are repaired through a "recorded reviewed move".
- **(c) Keep the file as a superseded stub with a product name.** This would pass the validator, but it breaks "Every root entry in `docs/prd/` is part of the active namespace" and "Do not link retired editorial change records as product authority". **Not recommended.**
- **(d) Create a new PRD (21+) and retire the old number.** Allowed only for "a coherent, wholesale new capability ... with no suitable existing owner". For 13 and 17 the subject already has an active PRD number, so (a) achieves the same result without a gap or a second identity.

### Recommendation per PRD

| PRD | Recommended end state | Target | Confidence | Why |
| --- | --- | --- | --- | --- |
| 13 | **(a) without rename.** Keep `13-adopter-owned-config-surface.md` and H1 "13 Adopter-Owned Config Surface". Restructure to the subsystem template, Index kind becomes `subsystem` | 13 | High | Filename and H1 already pass. Config is a coherent capability. 20 and 06 already name 13 as owner. Least link churn (22 outside references, 6 anchored). Optional retitle to "Instance Configuration" is cosmetic. |
| 14 | **(b) retire.** First write 14-06 (local-only posture) into 20 `## Runtime and Package`, or 02 | gap at 14 | High | Everything else is superseded by 20 or already in 06 and 07. |
| 15 | **(b) merge and retire.** Lifecycle to 08 `## Contracts and Data`; converted-twin `candidate` to 07; superseded and archived semantics to 17R | gap at 15 | High | Small, and 08 already owns draft staging and anchors. |
| 16 | **(b) merge and retire.** Ownership rule and domain inventory to 02 `## Module Map`, linked from 20 `## Command Surface`. Open ownership decisions to a new register Q item. Procedure detail to the maintainer guide | gap at 16 | Medium | Domain ownership is an architecture rule across owners. The rule says to update the owning PRDs rather than keep a cross-cutting record. Alternative: (a) rename to `16-domain-ownership-boundaries.md`. |
| 17 | **(a) rename in place** to `17-entity-identity-and-canonical-resolution.md`, H1 "17 Entity Identity and Canonical Resolution", kind `subsystem` (or `capability`). Restructure to the template. Absorb the 18-12 flag contract and 18-13 index path. Restate 17-21, 17-22, and 17-47 for npm. Move W1 R4 notes to `## Requirement History` | 17 | High | Large, coherent capability. Folding about 150 lines into 08 would bury it. Renaming keeps the number and avoids the gap a new `21-...` would leave. If the owner prefers a new number, use `21-entity-identity-and-canonical-resolution.md` and retire 17 (option d). |
| 18 | **(b) retire** after 18-12 and 18-13 land in 17R, 18-02 lands in 02, and 10 names `discovery run` and `discovery qualify` inline | gap at 18 | High | Everything else is superseded by 20. |
| 19 | **(b) retire.** Nothing needs to move. Repoint Q-001 ("PRD 19 ... carry the approved result"), Q-011, and the 32 baseline "Superseded by [19]" notes | gap at 19 | High | Never approved. Current pieces are already in 20, 05, 08, and the register. Capability-matrix handling is open question 3. |

Proposed new PRDs: **none required.** If the owner rejects the rename in place for 17, add `21-entity-identity-and-canonical-resolution.md`. If the owner wants config separated from adopter wording, a retitle of 13 (same number) covers it. A separate config PRD is not needed.

Suggested order within the cleanup, following the safety rules:

1. Write owner text: 17R (incl. 18-12 and 18-13), 08 (15 and 13-20), 07 (15-05, 17-37), 02 (16 and 18-02, plus the 13-07 body fix), 09, 10, and 11 (17-40 to 17-42), and 20 (14-06).
2. Fold or remove the 65 baseline change-note pointers.
3. Add `## Requirement History` entries in the new owners.
4. Add the register Q item for open domain ownership, and repoint Q-001, Q-011, and R-004.
5. Retire 14, 15, 16, 18, and 19, and rename 17.
6. Update links in plans, work, assets, and `toolkits/`.
7. Update the 00-index Document Map, Reading Order, and Audience Paths, then the `## Current Authority Map` last.
8. Run the validator.

## 5. Open questions for an owner decision

1. **Completed and superseded work backlogs versus safety rule 6.** 51 `PRD-AUTH-005` findings sit in W1 R0, R2, R4, R5 (never executed), and R6 (marked "Superseded by W1 R7. Do not execute."). Choose one: (i) retarget their `## Source PRD Docs` links to the new owners, treating working backlogs as not "historical"; (ii) move those links under an exempt `## Provenance` heading; (iii) archive the R5 and R6 backlogs, and perhaps R2 and R4, by explicit request, which takes them out of the validator's scope. Every option except (iii) edits historical working docs.
2. **Retire by deletion or by archive** for 14, 15, 16, 18, and 19? Archiving needs an explicit owner request, and single files must go in a dated directory (`.make-docs/archive/prds/YYYY-MM-DD/`). Archiving would also allow a "recorded reviewed move" link repair in `.make-docs/archive/history/` (30 mentions). Deleting leaves those 18 history links dangling, which rule 6 then forbids fixing.
3. **PRD 19 capability matrix (33 rows, 17 DI items).** Choose one: (i) delete it and cite the last commit SHA in Q-011 and Q-012 as input for the MCP revision; (ii) keep it as a future design input outside `docs/prd/` (for example quoted into the MCP revision design when it starts). A dated design file now would be a new design artifact. (iii) Archive it. The W1 R6 plan already holds the capability-map context and is marked superseded.
4. **Entities owner:** rename 17 in place (recommended) or create a new `21-...` and retire 17? Or fold into 08, which would make 08 large?
5. **Config owner:** keep 13 (recommended), retitle it, or merge it into 06? Merging into 06 would add about 60 lines of schema to the operating-layer PRD.
6. **Domain ownership owner:** 02 `## Module Map` (recommended), 20 `## Command Surface`, or a renamed `16-domain-ownership-boundaries.md`? Also: do playbooks, data and extraction, and stage need a new register Q item now, since D-002 is closed?
7. **Local-only runtime posture (14-06) and runtime safety (19-16):** is "no network calls without a design and an opt-in flag" still a product requirement? If so, does it go in 20 or 02? How is the Make Docs `npx` fallback classified?
8. **Source-build adoption for entities (17-21, 17-22, 17-47):** restate it for npm with pinned versions, move the operator steps to the user guide, or retire them with R-004 as the only gate?
9. **Pre-upgrade audit prompt (17-46):** it lives under `.make-docs/system/prompts/`, a Make Docs-managed tree. Should it move to `system/.os/` or be retired? Is its "proposal-only until ..." condition now met?
10. **Entity record hygiene in `buildos validate` (13-20):** which checks are in scope (anchors, lifecycle, graph strictness)? Does 08 or 17R own the list?
11. **Scoped-field migration (13-17):** has it landed, so that "once the migration lands" can become an unconditional rule?
12. **W2 lifecycle remnants (18-21) and upgrade or rollback smoke tests (18-19):** confirm they need no PRD owner until the W2 design, with R-003 as the only tracker.
