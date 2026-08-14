# 19 Revise Build OS Headless Core, CLI, and MCP Program

## Purpose

Revise the active Build OS requirement set from a CLI-first consolidation program into one cohesive Go product program whose installed `buildos` executable and distribution contain a transport-neutral headless core, the CLI, and the MCP server. This revision supplies the Phase 1 capability-contract inventory required before implementation planning can begin. It treats current directories, routers, and commands as compatibility evidence rather than as a complete product contract, and it keeps the UI and optional coordinating server as separately gated surfaces.

This document uses the approved-for-drafting but currently uncommitted [Build OS Product Boundary and Headless Operating Model](../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md) and [Build OS Phase 0.5 Runtime-Selection Proof](../designs/2026-08-14-build-os-runtime-selection-proof.md) as design inputs. Those files are not committed repository authority at the time of this draft. This PRD revision is therefore non-authoritative until the design inputs, this revision, the required baseline annotations, the PRD index, and the risk-register reconciliation are reviewed, approved, and committed through the repository's normal authority path.

## Change Type

- Kind: `revision`
- Status: `draft`; non-authoritative until approval and commit
- Execution mode: active-set evolution
- Effective change when approved: supersede PRD 18's CLI-first application boundary and incomplete command inventory with one versioned core-operation contract projected through mandatory CLI and MCP adapters in the same Go program, product package, installed executable, and distribution.
- Preserved evidence: PRD 18's one-executable direction, current `buildos entities` behavior, shared result and diagnostic conventions, legacy-toolkit parity obligations, and later packaging requirements remain evidence and compatibility constraints unless this document explicitly revises them.
- Prohibition: no core, CLI, MCP, toolkit, data, installer, migration, packaging, publication, or deployment implementation may begin from this draft.

## Baseline Being Revised or Removed

This revision primarily supersedes [18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md) where PRD 18 locates application behavior in CLI command handlers, freezes a narrow command list before a complete capability pass, treats MCP as absent, and schedules direct migration into command packages. PRD 18's established entity seed, shared output evidence, compatibility window, rollback obligations, and release-hardening requirements remain active constraints, but they must be reconciled against the core-operation and parity model below.

The revision also changes the effective interpretation of the following active baselines:

- [01 Product Overview](./01-product-overview.md) and [02 Architecture Overview](./02-architecture-overview.md): Build OS is a filesystem-native evidence, discovery, and qualification system whose core, CLI, and MCP server ship as one Go product; a server database is not silently promoted to canonical authority.
- [05 Spaces Boundary and Shipping](./05-spaces-boundary-and-shipping.md): Make Docs is a separate companion product and external dependency, not a Build OS-owned downstream subsystem.
- [06 Operating Layer and Routing](./06-operating-layer-and-routing.md): directory and router conventions remain discoverability evidence, not automatically supported core operations.
- [07 Intake and Conversion](./07-intake-and-conversion.md), [08 Data and Extraction](./08-data-and-extraction.md), [09 Playbooks](./09-playbooks.md), [10 Discovery, Runs and Qualification](./10-discovery-runs-and-qualification.md), and [12 Stage Automation](./12-stage-automation.md): existing behavior must be represented as transport-neutral operations before migration, with explicit authority, state, provenance, failure, recovery, and parity contracts.
- [11 Flow C Integration](./11-flow-c-integration.md): direct Build OS creation or mutation of Make Docs-owned designs and indexes conflicts with the approved product boundary. The current `buildos-design` behavior remains compatibility evidence but may not be migrated as a core authoritative write. The replacement handoff operation may export or record Build OS-owned evidence and may call only a separately validated Make Docs public operation.
- [13 Adopter-Owned Config Surface](./13-adopter-owned-config-surface.md): current systems, environments, owners, defaults, and validation semantics remain compatibility evidence; global settings, project identity, and registry state require separate authority decisions.
- [14 Revise Deterministic Toolkit Deployment](./14-revise-deterministic-toolkit-deployment.md) and [16 Revise Toolkit Ownership Boundaries](./16-revise-toolkit-ownership-boundaries.md): domain ownership remains required, but it is enforced inside the cohesive Go program rather than through independently installed products.
- [15 Revise Extraction Draft Lifecycle](./15-revise-extraction-draft-lifecycle.md) and [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md): lifecycle, redirect, resolver, manifest, copied-root safety, and deterministic-index contracts remain active compatibility requirements.

No baseline text is removed by this draft. Required `Superseded by` notes are listed below so the effective lineage can be assembled without silently rewriting history.

## Rationale

The repository contains a strong entity-domain seed and three narrower Go toolkits, but it does not contain a complete cross-domain application core or an MCP server. The current executable exposes help, version, and entity operations through `toolkits/buildos/internal/cli/cli.go`; intake exposes conversion and index operations through `toolkits/buildos-intake/`; discovery exposes run recording and qualification through `toolkits/buildos-discovery/`; and design promotion writes Make Docs-managed artifacts through `toolkits/buildos-design/`. Shipped directories, routers, templates, and manual instructions express additional behavior that is not represented by commands.

Treating that small command set or the directory layout as the future product contract would omit project and global state, configuration, extraction, query, relationships, provenance, lifecycle recovery, companion boundaries, privacy, concurrency, and capability discovery. It would also let transport concerns define business behavior and would leave the mandatory MCP surface to reconstruct semantics after the CLI was frozen.

The retained Phase 0.5 proof supports Go for the current selection because all candidates passed the representative filesystem, subprocess, receipt, retry, and idempotency contract while Go preserved the existing implementation and produced the broadest measured packaging matrix without external modules. The proof did not test MCP transport, security, concurrent writers, crash injection at every write boundary, large datasets, SQLite-derived indexes, signing, clean-machine installation, real Make Docs operations, or full platform execution. It selects a current implementation language; it does not settle those later contracts or make Go irreversible.

Current qualification authority also contains an unresolved tension. PRD 10 and R-002 require a deterministic repeatable confirmation test before promotion, while Q-001 has not decided whether promotion gates are conventions or enforced machinery, and DI-009 has not settled reviewer, agent, override, revocation, or appeal authority. Until that decision closes, the existing verify-to-promote rule remains the compatibility floor, but no new qualification authority or exception path may be inferred.

Code anchors:

- `toolkits/buildos/internal/cli/cli.go`
- `toolkits/buildos/internal/cli/domain.go`
- `toolkits/buildos/internal/entities/`
- `toolkits/buildos-intake/internal/intake/`
- `toolkits/buildos-discovery/internal/discovery/`
- `toolkits/buildos-design/internal/design/promotion.go`
- `system/.os/scripts/validate_config.py`

## Effective Requirement

### Authority and Phase 1 approval gate

This document is a contract draft, not implementation authority. Work may proceed only after all of the following are true:

1. The two design inputs are approved as repository authority and committed.
2. This revision is reviewed, any rejected or revised capability rows are updated, and the final revision is committed.
3. `docs/prd/00-index.md`, impacted baseline `### Change Notes`, and `docs/prd/03-open-questions-and-risk-register.md` are reconciled and committed.
4. Every Phase 1 capability, dependency, compatibility obligation, non-goal, acceptance fixture, unresolved question, and risk has an explicit disposition and accountable owner.
5. The Phase 1 gate approves the core request, plan, result, diagnostic, authorization, verification, receipt, locking, recovery, redaction, and schema-compatibility contracts.
6. Implementation planning is separately authorized after the gate. Approval of this PRD does not itself authorize code or toolkit changes.

Before planning every later phase, the capability map and living risk register must be reconciled again. A later phase may add, remove, defer, or revise a capability only through an explicit delta that records changed surfaces, data ownership, state transitions, dependencies, compatibility effects, non-goals, evidence, questions, and risks.

### Target operating and parity model

Build OS is one cohesive Go program, product package, installed executable, and distribution. The headless core, CLI, and MCP server are internal surfaces of that one product and share one version, upgrade, rollback, and removal lifecycle. The headless core is not a separately installed executable. The MCP server runs from the same installed `buildos` executable and is not a separate product.

Only the headless core may apply Build OS domain rules or authoritative Build OS writes. Both the CLI and MCP server map directly to the same versioned core requests, plans, results, diagnostics, authorization context, verification results, and receipts. Neither adapter may shell through the other. Every CLI domain operation must have a semantically equivalent MCP operation in the same product capability map and release. Transport-only help, schema discovery, progress, cancellation, streaming, pagination, or presentation may differ only when explicitly classified and must not create an alternate domain operation or write path.

Every mutating or external operation follows `resolve -> inspect -> plan -> authorize -> apply -> verify -> record`. Read-only operations may stop after inspect. Plans are deterministic and serializable, identify preconditions and intended effects, and are not authorization. Applied operations verify durable postconditions and append or amend provenance according to the unresolved DI-002 receipt contract. No adapter may convert a failed verification into success.

The UI and optional coordinating server are not part of this executable decision. They remain separately scoped later surfaces and may not add UI-only or server-only domain behavior. Local CLI and MCP operation must remain complete without either surface.

Unless a capability row says otherwise, CLI spellings and MCP names below are proposed placeholders, not frozen public names. The stable item at this gate is the domain-operation identity and parity requirement. Current spellings are marked `current`; future spellings remain `proposed/TBD` until their phase freezes the adapter schema.

### Common contract invariants

The following requirements apply to every capability row:

- **Authority:** project files and structured JSONL are the required default canonical domain authority; indexes, SQLite, caches, server state, and UI projections are derived and rebuildable unless DI-001 approves a specific exception. The exception may not be inferred from implementation convenience.
- **Results:** core requests and results are typed and versioned. CLI JSON and MCP structured content project the same fields, diagnostics, effects, and recovery information. Human output may summarize without dropping machine-readable evidence.
- **Provenance:** mutations and external actions carry an operation ID, request and plan digests, actor/client/transport context when available, product/build identity, project identity, affected canonical IDs and paths, authorization evidence, verification, diagnostics, and recovery disposition. Domain evidence is linked, not duplicated. The exact path, integrity, retention, and amendment contract remains DI-002.
- **Idempotency:** every operation declares its idempotency key or precondition model. Repeating a successful request either returns the prior equivalent result or produces a verified no-op; it must not silently duplicate canonical records or external actions.
- **Dry run:** every mutation or external action provides a non-mutating inspectable plan unless its row explicitly records an approved exception. `--dry-run` and the MCP plan form must have equivalent core output.
- **Errors:** usage/schema errors, missing or invalid input, contract conflicts, authorization refusal, I/O failure, partial canonical success, external dependency failure, cancellation, and concurrency conflict remain distinguishable. Current entity exit codes are compatibility evidence, not permission to collapse MCP errors into process codes.
- **Recovery:** interruption preserves enough durable evidence to identify whether no canonical write, canonical write without derived rebuild, external invocation without verification, or full success occurred. Recovery is an explicit operation, not a blind rerun.
- **Concurrency:** reads may be concurrent when safe. Mutations use DI-016's approved lock or optimistic-concurrency unit and reject stale plans. CLI and MCP invocations share the same guard.
- **Safety:** secrets, credentials, unrestricted environment dumps, and unredacted sensitive process output are never persisted. Destructive, networked, external, or privacy-affecting actions require explicit authorization appropriate to the invoking environment.
- **Compatibility:** current toolkit files, outputs, state transitions, diagnostics, and recovery behavior remain migration evidence until a capability-specific parity matrix is accepted. This draft does not authorize changing or deleting a toolkit.

### Master capability matrix

| ID | Domain and operation set | Classification and disposition | Phase gate | CLI and MCP parity | Authority and named transition |
| --- | --- | --- | --- | --- | --- |
| SYS-001 | Product version, build, schema, and capability discovery | Retain version; add complete discovery | Phase 1 foundation; Phase 3 protocol completion | Current `buildos version`; proposed capability operation mirrored by MCP | Installed binary metadata; `unknown -> discovered -> compatible\|incompatible` |
| PRJ-001 | Global settings and project registry inspect | New required foundation; mutation deferred pending DI-005 | Phase 1 contract | Proposed CLI/MCP inspect parity | Build OS-owned global state; `unknown -> valid\|invalid\|recovery-required` |
| PRJ-002 | Project resolve, identify, recognize, and relocate/repair registration | Generalize current explicit-root behavior; identity unresolved | Phase 1 foundation | Proposed CLI/MCP parity | Project marker plus registry relationship pending DI-004; `unresolved -> recognized\|ambiguous\|missing`, `stale -> repaired` |
| PRJ-003 | Project initialize, reconfigure, update, and remove | Required lifecycle, deferred from initial proof | Phase 6 companion split and Phase 7 lifecycle gate | Proposed CLI/MCP parity before release | Build OS-managed project state; `absent -> planned -> active`, `active -> reconfigured\|removal-planned -> removed` |
| CFG-001 | Inspect, validate, diff, and apply Build OS configuration | Preserve current semantics; add core plan/apply | Phase 1 read/validation contract; Phase 2 migration | Proposed CLI/MCP parity | Project config is canonical; `unknown -> valid\|invalid`, `valid -> planned -> applied -> verified` |
| EVD-001 | Register source and faithfully convert intake | Retain and migrate | Phase 2 | Proposed `intake convert` and MCP equivalent | Source immutable; converted artifact and reference provenance; `located -> converted -> registered` |
| EVD-002 | Build, check, and query intake references | Retain index semantics; classify index as derived | Phase 2 | Proposed CLI/MCP parity | Sources and converted artifacts canonical, reference index derived; `absent\|stale\|corrupt -> current` |
| EXT-001 | Extract provenance-bearing observations from registered evidence | Required expansion from directory/manual behavior | Phase 2 after schema gate | Names TBD; mandatory parity | Extraction event canonical in JSONL; `source-registered -> extraction-recorded` |
| EXT-002 | Generate, review, and disposition extraction candidates | Preserve minted/referenced/updated outcomes; authority unresolved | Phase 2 | Names TBD; mandatory parity | Candidate is non-canonical until review; `proposed -> accepted\|rejected -> minted\|referenced\|updated` |
| DAT-001 | Validate and query canonical datasets | Preserve validation; add bounded query | Phase 1 entity subset; Phase 2 full data | Names TBD; mandatory parity | JSONL and domain files canonical; `unchecked -> valid\|invalid`; query is read-only |
| DAT-002 | Check, rebuild, and query derived indexes | Generalize entity and intake indexes without granting authority | Phase 1 entity proof; Phase 2 remaining indexes | Names TBD; mandatory parity | Canonical sources -> derived index; `absent\|stale\|corrupt -> current` |
| ENT-001 | Resolve entity identity | Retain current behavior | Phase 1 proof | Current `buildos entities resolve`; MCP equivalent required | Eight governed datasets canonical; `requested-id -> canonical-id\|unresolved` |
| ENT-002 | Validate entity graph and lifecycle | Retain current behavior | Phase 1 proof | Current `buildos entities validate`; MCP equivalent required | Canonical entity graph; `unchecked -> valid\|invalid` |
| ENT-003 | Plan and apply reviewed entity consolidation | Retain current dry-run and atomic-write behavior | Phase 1 mutation proof | Current `buildos entities consolidate`; MCP equivalent required | Reviewed manifest authorizes canonical redirect; `canonical-source -> superseded-with-redirect`, or no-op |
| ENT-004 | Check and rebuild entity-resolution index | Retain current recovery behavior | Phase 1 proof | Current `buildos entities rebuild-index`; MCP equivalent required | Entity JSONL canonical, index derived; `absent\|stale\|corrupt -> current` |
| PBK-001 | Enumerate, inspect, validate, and select runnable playbooks | Retain index/registry semantics; expand read contract | Phase 2 | Names TBD; mandatory parity | Playbook source/registry authoritative per existing contract; `unknown -> runnable\|inactive\|invalid` |
| RUN-001 | Plan, record, inspect, close, or abort a discovery run | Retain immutable-run evidence; lifecycle completion requires reconciliation | Phase 2 | Proposed `discovery run` family and MCP equivalent | Run record/evidence canonical; `planned -> running -> closed\|aborted` |
| FND-001 | Record and inspect raw findings | Retain raw-in-run boundary | Phase 2 | Names TBD; mandatory parity | Immutable run evidence canonical; `observed -> raw-recorded` |
| QLF-001 | Evaluate and record qualification | Retain verify-to-promote floor; authority remains open | Phase 2 after DI-009/Q-001/R-002 | Proposed `discovery qualify` and MCP equivalent | Finding and confirmation evidence canonical; `raw -> qualification-planned -> qualified\|not-qualified` |
| QLF-002 | Revoke, override, or appeal qualification | Not approved; explicit deferred contract rather than inferred behavior | DI-009 follow-on gate in Phase 2 | No public operation until approved; then parity mandatory | Transition names and authority TBD; no current mutation allowed |
| HOF-001 | Export or hand off a qualified finding to an external downstream product | Revise direct design promotion; Build OS-owned export/receipt only | Phase 2 boundary contract; Make Docs invocation Phase 6 | Names TBD; mandatory parity for Build OS operation | Qualified finding remains canonical in Build OS; `eligible -> handoff-planned -> exported\|externally-acknowledged\|failed` |
| REL-001 | Query entity and evidence relationships and provenance chains | New read model over existing references | Phase 2 | Names TBD; mandatory parity | Canonical relationships remain in domain records; query is read-only |
| REL-002 | Plan and apply reviewed relationship changes | Required but no generic write authority yet | Phase 2 follow-on design | No operation until authority map approved; then parity mandatory | `proposed -> accepted\|rejected -> applied\|no-op` |
| OPR-001 | Plan, authorize, apply, verify, and record an operation | New cross-domain core contract | Phase 1 foundation | CLI dry-run/apply and MCP plan/apply use identical core request | Operation lifecycle; `inspected -> planned -> authorized -> applying -> verified -> recorded` |
| OPR-002 | Inspect, diagnose, recover, and safely retry an operation | New required recovery contract | Phase 1 foundation | Names TBD; mandatory parity | Receipt/recovery record pending DI-002; `failed\|interrupted -> recovery-required -> recovered\|abandoned` |
| LFC-001 | Diagnose project health and repair or rebuild Build OS-owned state | Generalize existing validation/rebuild behavior | Phase 1 entity subset; Phase 2 full project | Names TBD; mandatory parity | Canonical files remain authority; `healthy\|degraded\|invalid -> planned -> repaired\|recovery-required` |
| CMP-001 | Inspect and recognize configured Make Docs companion state | Required external-boundary read operation; exact contract unverified | Phase 6 | Names TBD; mandatory parity | Build OS receipt/config only; Make Docs markers are read through published interface; `unknown -> absent\|recognized\|mismatch\|invalid` |
| CMP-002 | Ensure/setup, reconfigure, repair, or remove companion integration | Deferred and prohibited until published contract validation | Phase 6 | Interactive CLI and explicit noninteractive CLI/MCP authorization must be equivalent | Build OS records integration receipt; Make Docs owns its state; `authorized -> invoking -> verified\|failed\|recovery-required` |
| SAF-001 | Classify, redact, retain, export, and delete Build OS evidence/receipts | Required policy; exact rules unresolved | Phase 1 policy and Phase 5 browser delta | Names TBD; parity for supported operations | Canonical evidence subject to approved policy; `retained -> exported\|redacted\|deletion-planned -> deleted` |
| SAF-002 | Lock, cancel, detect stale plans, and recover concurrent operations | New cross-domain safety contract | Phase 1 | CLI signals and MCP cancellation map to one core state model | Operation and affected authority units; `planned -> stale\|authorized`, `applying -> cancelled\|interrupted\|verified` |
| MCP-001 | Launch MCP, discover schemas/capabilities, and prove operation parity | Mandatory part of same executable | Phase 1 entity proof; Phase 3 completion | MCP mirrors every CLI domain operation; transport-only functions classified separately | No separate domain authority; `client-unknown -> negotiated\|incompatible` |
| PKG-001 | Install, upgrade, rollback, repair, and remove the cohesive product | Retain PRD 18 hardening but revise package content to include MCP | Phase 7 | CLI and MCP disappear or upgrade together; no separate MCP package | Package manager/system install authority; `absent -> installed -> upgraded\|rolled-back\|removed` |
| SRV-001 | Optional multi-client coordinating server | Separately scoped and conditional; not an initial product capability | Phase 4 measured-use-case gate | Must project existing core operations if approved; no new write path | Never canonical; `not-approved -> approved\|rejected`, then server lifecycle TBD |
| UI-001 | First visual workflow and optional browser evidence capture | Separately scoped and deferred | Phase 5 | UI uses approved operations; browser is explicit capture client only | No direct writes; `not-selected -> workflow-approved`, capture `consented -> submitted\|cancelled` |

### Detailed capability contracts

#### SYS-001 Product, version, and capability discovery

- **Surface and parity:** retain current `buildos version`; add a proposed/TBD CLI capability-discovery operation and MCP protocol discovery that report the same product version, build revision, supported domain-operation IDs, schema versions, enabled/disabled dependencies, and compatibility ranges. MCP protocol metadata may add transport features but may not claim a domain operation absent from the CLI map.
- **Authority and transitions:** installed binary metadata and compiled capability descriptors are authoritative for executable capabilities; project state is inspected separately. A client moves from `unknown` to `discovered`, then `compatible` or `incompatible`.
- **Inputs, outputs, and provenance:** optional project root and requested schema range produce typed build and capability descriptors plus diagnostics. Read-only discovery emits no mutation receipt.
- **Execution semantics:** deterministic and idempotent; no dry-run distinction; unavailable optional dependencies are reported as disabled capabilities, not fabricated success. No locks are required.
- **Dependencies and migration:** preserve PRD 18's `dev`/`unknown` source-build metadata and current `BuildInfo` behavior in `toolkits/buildos/internal/cli/output.go`. Phase 3 freezes MCP schema negotiation.
- **Acceptance evidence:** golden CLI/MCP comparison fixtures, unknown-new-capability handling, version-skew tests, and proof that disabled Make Docs/server/UI capabilities do not disable local core operations.
- **Non-goals and gates:** no network update check, plugin marketplace, or server dependency. Linked to DI-014, DI-015, and DI-017.

#### PRJ-001 Global settings and registry inspection

- **Surface and parity:** proposed/TBD `settings inspect` and `projects list|inspect` operations have MCP equivalents. Mutation names are withheld until DI-005 settles location, scope, ownership, and recovery.
- **Authority and transitions:** Build OS owns its global settings and registry, but their filesystem location and user/system scope remain unresolved. Inspection classifies each record `valid`, `invalid`, `stale`, `duplicate`, or `recovery-required` without repair.
- **Inputs, outputs, and provenance:** optional scope and project selector produce sanitized settings, registry entries, ownership/version metadata, and repair plans. Reads do not append receipts; any future repair does.
- **Execution semantics:** read-only and idempotent; dry run is identical to inspection. Parse, permission, duplicate-identity, and missing-root errors remain distinct. Concurrent reads must not create files.
- **Dependencies and migration:** no current global registry implementation is authority. Existing explicit-root CLI behavior remains available during adoption.
- **Acceptance evidence:** empty, corrupt, multi-version, multi-user, stale-path, duplicate-ID, backup/restore, and uninstall-with-projects fixtures on the supported platform matrix.
- **Non-goals and gates:** do not choose a path, mutate another user's settings, or infer registry identity from directory names. Linked to DI-004, DI-005, DI-008, and DI-013.

#### PRJ-002 Project resolution, identity, recognition, and relocation

- **Surface and parity:** proposed/TBD `project inspect|resolve|repair-registration` operations map one-to-one to MCP. Current entity commands' explicit `--root` behavior remains a compatibility-safe fallback.
- **Authority and transitions:** project identity must not be permanently equated with a path. The authority between a project marker and global registry remains DI-004. Operations classify `unresolved -> recognized|ambiguous|missing`; approved repair may move `stale -> repaired`.
- **Inputs, outputs, and provenance:** explicit root, current directory, registry selector, expected identity, and symlink policy produce resolved root, project identity, provenance of resolution, marker/registry consistency, and a repair plan. Repair records before/after identity and path evidence.
- **Execution semantics:** resolution is read-only and idempotent. Repair is dry-run-first, rejects copied/duplicate identities without explicit disposition, verifies after atomic update, and uses the shared concurrency guard.
- **Dependencies and migration:** must recognize both source-scaffold and installed-root layouts currently handled by `toolkits/buildos/internal/layout/layout.go` and domain-specific layout code, without freezing those duplicate implementations.
- **Acceptance evidence:** move, rename, symlink, clone, copied project, duplicate ID, deleted root, corrupt marker, corrupt registry, and cross-platform path fixtures.
- **Non-goals and gates:** no auto-merging cloned identities or silent path rewrite. Linked to DI-004, DI-005, DI-016, and DI-017.

#### PRJ-003 Project initialize, reconfigure, update, and remove

- **Surface and parity:** proposed/TBD project lifecycle operations must have CLI/MCP parity; interactive CLI may prompt, while noninteractive CLI and MCP require explicit profile/authorization fields. Exact names remain later-gated.
- **Authority and transitions:** Build OS owns its project-local installation and registration. `absent -> planned -> active`; `active -> reconfiguration-planned -> active|recovery-required`; `active -> removal-planned -> removed`. Make Docs remains unchanged unless removal of both is explicitly requested and Phase 6 validates the public operation.
- **Inputs, outputs, and provenance:** project root, profile, selected Build OS version, authorization, and companion acknowledgement where the standard profile requires it yield an install/removal plan, classified effects, backup/recovery information, verification, and receipt.
- **Execution semantics:** dry-run-first; repeated initialization at the same compatible version is a no-op or reconfiguration plan, not duplication. Partial writes require recovery classification. Concurrent lifecycle mutations are exclusive.
- **Dependencies and migration:** depends on DI-004/005, lifecycle manifest design, PRD 18 packaging evidence, pre-manifest adoption rules, and Phase 6 Make Docs separation.
- **Acceptance evidence:** clean project, existing source scaffold, pre-manifest project, partial installation, upgrade, downgrade refusal, backup/restore, independent Build OS removal, and copied-root rehearsal.
- **Non-goals and gates:** no implementation in Phase 1; no direct Make Docs writes; no self-update policy before Phase 7. Linked to DI-004, DI-005, DI-012, DI-013, and R-001/R-003/R-004.

#### CFG-001 Configuration inspect, validate, diff, and apply

- **Surface and parity:** proposed/TBD `config inspect|validate|plan|apply` operations and MCP equivalents share one request/result contract. Phase 1 may freeze read and validation contracts; mutation migrates in Phase 2.
- **Authority and transitions:** the project config remains canonical for systems, environments, owners, and defaults. `unknown -> valid|invalid`; an authorized mutation follows `valid -> planned -> applied -> verified`.
- **Inputs, outputs, and provenance:** project root, config path or typed patch, expected digest, mode, and dry-run/apply authorization produce normalized config metadata, findings with source locations, affected references, plan digest, and receipt for apply.
- **Execution semantics:** validation is idempotent and non-mutating. Apply requires a stale-digest check, preserves unknown approved fields, atomically replaces the one canonical config file, validates dependent scoped references, and records recovery on post-write validation failure.
- **Dependencies and migration:** preserve PRD 13 and `system/.os/scripts/validate_config.py` semantics, including systems/environments/owners, slug validation, scoped references, lifecycle statuses, and legacy-field diagnostics. The Python implementation is evidence, not the target core boundary.
- **Acceptance evidence:** current validator fixtures plus unknown field, malformed YAML subset, duplicate slug, invalid scoped reference, stale plan, atomic-write failure, idempotent replay, and CLI/MCP equality tests.
- **Non-goals and gates:** no secret store, cloud policy engine, or global-registry mutation. Linked to DI-001, DI-015, DI-016, and DI-017.

#### EVD-001 Source registration and faithful conversion

- **Surface and parity:** retain the logical `intake.convert` operation behind proposed `buildos intake convert` and an equivalent MCP tool. Exact flags and MCP name are frozen in Phase 2.
- **Authority and transitions:** original source bytes remain immutable evidence; converted artifacts and their source anchors are durable Build OS evidence. `located -> converted -> registered`; unsupported or failed conversion leaves the source unmodified and no false registration.
- **Inputs, outputs, and provenance:** source path, type hint, assets root, force policy, and dry-run/apply yield converted outputs with path, source, SHA-256, type, status, body metadata, and side artifacts, linked by a receipt.
- **Execution semantics:** deterministic for identical source and converter version; existing identical output is a no-op; overwrite requires explicit force and stale-hash checks. Dry run emits intended artifacts and diagnostics. Partial multi-output conversion records cleanup/recovery without rewriting source.
- **Dependencies and migration:** preserve `ConvertOptions`, `ConvertedOutput`, and `ConvertResult` behavior in `toolkits/buildos-intake/internal/intake/types.go`, existing CSV/DOCX/HTML/PDF/XLSX support, and legacy CLI parity until accepted.
- **Acceptance evidence:** existing golden conversions, byte-hash provenance, unsupported/invalid input, collision/force, multi-artifact failure, copied-root, and CLI/MCP parity tests.
- **Non-goals and gates:** no semantic qualification, source mutation, OCR promise, browser scraping, or inferred extraction. Linked to DI-008, DI-011, DI-015, and DI-017.

#### EVD-002 Intake reference index build, check, and query

- **Surface and parity:** preserve logical reference indexing behind proposed `intake index references` plus check/query operations and MCP equivalents.
- **Authority and transitions:** source and converted artifacts are canonical; the reference index is derived. `absent|stale|corrupt -> current` after rebuild; query never writes.
- **Inputs, outputs, and provenance:** root, assets root, output selector, mode, and expected source digests produce versioned entries with IDs, source/converted paths, SHA-256, type, converter, timestamp, status, count, and index digest.
- **Execution semantics:** check and query are idempotent/read-only; rebuild is deterministic and dry-run-first, atomically replaces only the derived index, and remains safely repeatable. A stale plan or changed source rejects apply.
- **Dependencies and migration:** preserve `ReferenceIndex`, `ReferenceEntry`, and `IndexResult` compatibility from `toolkits/buildos-intake/internal/intake/types.go`; do not move entity redirects into `references.json`.
- **Acceptance evidence:** delete-and-rebuild equality, order stability, missing converted artifact, changed source hash, malformed entry, stale plan, write failure, and CLI/MCP parity fixtures.
- **Non-goals and gates:** the index never becomes canonical evidence or a generic relationship graph. Linked to DI-001, DI-011, DI-015, and DI-016.

#### EXT-001 Provenance-bearing extraction

- **Surface and parity:** a new logical `evidence.extract` operation requires proposed/TBD CLI and MCP projections in Phase 2; no current directory name is accepted as its command contract.
- **Authority and transitions:** registered evidence is read-only input; extraction events are append-oriented canonical provenance and link exact source anchors. `source-registered -> extraction-recorded`; failure leaves no canonical entity mutation.
- **Inputs, outputs, and provenance:** source/reference IDs, extractor kind/version, scope, anchors, content digests, and optional actor context produce typed observations, extraction ID, source offsets/anchors, diagnostics, and receipt.
- **Execution semantics:** an extraction idempotency key combines source digest, extractor contract/version, and normalized scope. Dry run returns observations without appending. Unsupported, ambiguous, redacted, and changed-source outcomes are distinct. Concurrent appends use the approved DI-016 unit.
- **Dependencies and migration:** preserve extraction-record and source-anchor contracts under `system/.os/contracts/` and validate compatibility with the current config/entity validator. Exact extraction engines remain separate decisions.
- **Acceptance evidence:** repeated extraction, changed source, ambiguous anchors, redacted input, interrupted append, schema upgrade, and CLI/MCP equality fixtures.
- **Non-goals and gates:** no automatic canonical entity promotion, hidden network model call, or qualification. Linked to DI-001, DI-002, DI-008, DI-015, and DI-016.

#### EXT-002 Candidate generation, review, and outcome disposition

- **Surface and parity:** proposed/TBD candidate list, inspect, review-plan, and apply operations must have MCP parity. Exact review authority remains part of Phase 2 reconciliation.
- **Authority and transitions:** candidates are derived proposals, not canonical domain state. A reviewed candidate moves `proposed -> accepted|rejected`; acceptance may result in the established `minted|referenced|updated` extraction outcome against canonical records.
- **Inputs, outputs, and provenance:** extraction IDs, candidate IDs, expected canonical digests, reviewer identity/authorization, and disposition produce a deterministic change plan, outcome records, affected entity IDs, diagnostics, and receipt.
- **Execution semantics:** generation is read-only and replayable; review apply is dry-run-first, rejects stale canonical state or ambiguous persona/entity matches, and treats a repeated accepted mapping as no-op. Concurrency guards span the affected canonical dataset, extraction outcome, index, and receipt unit pending DI-016.
- **Dependencies and migration:** preserve `ValidateExtractionOutcomes`, persona exact matching, and minted/referenced/updated examples in `toolkits/buildos/pkg/entities/` and `system/.os/contracts/examples/extraction-outcomes/`.
- **Acceptance evidence:** repeated persona extraction, ambiguous aliases, invalid outcomes, stale target, concurrent review, crash-after-canonical-write, and deterministic replay fixtures.
- **Non-goals and gates:** no unattended canonicalization or generic AI authority. Linked to DI-009, DI-015, DI-016, and DI-017.

#### DAT-001 Canonical data validation and query

- **Surface and parity:** proposed/TBD `data validate|query` operations mirror over MCP. Phase 1 proves an entity subset; Phase 2 freezes all supported record types and query bounds.
- **Authority and transitions:** canonical JSONL and domain files remain authority pending DI-001. Validation moves `unchecked -> valid|invalid`; query is read-only and returns authority/source metadata.
- **Inputs, outputs, and provenance:** root, dataset/type selector, filters, pagination, projection, mode, and expected schema range produce typed records, canonical IDs, source path/line, validation findings, and continuation metadata. Reads have no mutation receipt.
- **Execution semantics:** deterministic ordering, bounded results, stable pagination, no implicit index rebuild, and explicit derived-index freshness diagnostics. Malformed rows, unknown schema, unsupported query, and partial read are distinct.
- **Dependencies and migration:** reconcile the eight governed entity datasets, runs, findings, extractions, references, playbooks, config, and narrative evidence without pretending one generic schema erases domain contracts.
- **Acceptance evidence:** large fixture, malformed-middle-row, unknown fields, compatibility/strict modes, pagination stability, absent/stale index, and CLI/MCP comparison tests.
- **Non-goals and gates:** no SQL as canonical API, arbitrary filesystem grep, or unrestricted evidence body disclosure. Linked to DI-001, DI-008, DI-015, and DI-017.

#### DAT-002 Derived index check, rebuild, and query

- **Surface and parity:** one logical index family exposes enumerate, inspect, check, rebuild-plan/apply, and bounded query through CLI/MCP; domain-specific index contracts remain visible.
- **Authority and transitions:** indexes are derived from named canonical sources and are deletable/rebuildable. `absent|stale|corrupt -> current`; rebuild never changes canonical source.
- **Inputs, outputs, and provenance:** index kind, root, mode, source digests, expected index digest, and apply authorization produce before/after status, source coverage, deterministic bytes/digest, affected path, and receipt for apply.
- **Execution semantics:** check/query are read-only; rebuild is dry-run-first, deterministic, atomic, idempotent, and rejects changed source. Derived rebuild failure after a separate canonical mutation must preserve that canonical success and emit an exact recovery operation.
- **Dependencies and migration:** preserve entity exit-code-6 semantics, intake reference and playbook indexes, and any current domain-specific validation. SQLite may be used only as derived state after DI-001 approval and delete/rebuild proof.
- **Acceptance evidence:** delete/rebuild byte equality, 10,000-record scale, crash/write failure, source change, concurrent rebuild, corrupt index, and CLI/MCP parity.
- **Non-goals and gates:** no generic canonical database or automatic hidden repair during read. Linked to DI-001, DI-015, and DI-016.

#### ENT-001 Entity identity resolution

- **Surface and parity:** retain current `buildos entities resolve`; add the same typed request/result as an MCP operation in Phase 1. Both call the same core resolver.
- **Authority and transitions:** eight governed canonical datasets and reviewed redirects are authority. The result maps `requested-id -> canonical-id|unresolved` with the full chain and never rewrites authored references during a read.
- **Inputs, outputs, and provenance:** root, compatibility/strict mode, entity ID, and schema range produce `Resolution` fields, source metadata, diagnostics, and executable identity. Read-only; no mutation receipt.
- **Execution semantics:** deterministic, idempotent, no dry-run distinction, whole-graph validation before trusted resolution, and distinct missing, cycle, invalid redirect, and schema errors. Concurrent reads are allowed.
- **Dependencies and migration:** preserve `Resolution`, `Graph`, `ParseMode`, and current resolver behavior in `toolkits/buildos/internal/entities/` and public temporary adapter behavior in `toolkits/buildos/pkg/entities/`.
- **Acceptance evidence:** zero/multi-hop, cycle, missing target, compatibility/strict, copied root, golden CLI JSON, equivalent MCP structured result, and no-write assertion.
- **Non-goals and gates:** no fuzzy identity merge or silent canonical mutation. Linked to DI-011, DI-015, and DI-017.

#### ENT-002 Entity graph and lifecycle validation

- **Surface and parity:** retain current `buildos entities validate` and add an MCP equivalent in Phase 1.
- **Authority and transitions:** canonical entity records are inspected as one immutable graph view; `unchecked -> valid|invalid`. Type-specific finding/run terminal states remain distinct from generic lifecycle states.
- **Inputs, outputs, and provenance:** root, mode, and schema range produce validity, record count, index status, stable diagnostics, and source anchors. Read-only.
- **Execution semantics:** deterministic and idempotent; does not repair. It fails closed on cycles, invalid mappings, normalization collisions, malformed records, and strict-mode gaps. Concurrent reads are allowed.
- **Dependencies and migration:** preserve current validators and `isLegalLifecycleStatus`, `isTerminalCanonical`, and type-specific lifecycle tests in `toolkits/buildos/internal/entities/lifecycle.go`.
- **Acceptance evidence:** all existing valid/invalid graph and lifecycle fixtures plus CLI/MCP diagnostic equality and unknown-schema behavior.
- **Non-goals and gates:** no generalizing `qualified` to all entities or `closed` to findings. Linked to DI-009, DI-011, and DI-015.

#### ENT-003 Reviewed entity consolidation

- **Surface and parity:** retain current `buildos entities consolidate`; the MCP operation accepts the same reviewed manifest request and returns the same plan/result. Apply authorization is explicit in either transport.
- **Authority and transitions:** one versioned manifest authorizes immediate-successor redirects in one canonical dataset. `canonical-source -> superseded-with-redirect`; already equivalent mappings are no-ops.
- **Inputs, outputs, and provenance:** root, mode, manifest bytes/path and digest, apply authorization, actor, and expected graph/index digests produce `ConsolidationResult`, affected files, changes, index status, recovery operation, and receipt.
- **Execution semantics:** dry-run by default; whole prospective graph preflight; at most one atomic canonical-file replacement per current v1 manifest; deterministic no-op replay; conflict refusal; stale-plan rejection; exclusive mutation lock. Canonical success followed by index failure remains a distinct recoverable partial success.
- **Dependencies and migration:** preserve PRD 17, `ConsolidationManifest`, `ConsolidationMapping`, `ConsolidationResult`, copied-root safety, and R-004 deployment separation.
- **Acceptance evidence:** existing consolidation fixtures, reviewed persona scenario, failure injection after every durable step, concurrent CLI/MCP apply, stale manifest, rollback, and equivalent receipts.
- **Non-goals and gates:** no cross-dataset transaction until DI-016 explicitly approves one; no live adopter mutation without separate authorization. Linked to DI-011, DI-016, R-004, and DI-017.

#### ENT-004 Entity-resolution index check and rebuild

- **Surface and parity:** retain current `buildos entities rebuild-index`, including check-by-default behavior, and add the same operation to MCP.
- **Authority and transitions:** entity JSONL and redirects are canonical; `.os/indexes/entity-resolution.json` is derived. `absent|stale|corrupt -> current`.
- **Inputs, outputs, and provenance:** root, mode, check/apply, source and expected index digests produce before/after check status, deterministic index metadata, diagnostics, and receipt on apply.
- **Execution semantics:** check is read-only; apply is deterministic, atomic, idempotent, stale-source guarded, and recoverable. Mutual exclusivity of check/apply remains compatible. Concurrent rebuild and consolidation use the shared affected-state guard.
- **Dependencies and migration:** preserve `BuildIndex`, `MarshalIndex`, check/rebuild behavior, stable ordering, and exact recovery guidance from `toolkits/buildos/internal/entities/index.go` and CLI domain service.
- **Acceptance evidence:** existing deterministic-index tests plus deleted/corrupt index, interrupted write, concurrent consolidate/rebuild, CLI/MCP parity, and 10,000-record scale.
- **Non-goals and gates:** no canonical semantics in the index. Linked to DI-001, DI-015, and DI-016.

#### PBK-001 Playbook enumeration, inspection, validation, and selection

- **Surface and parity:** proposed/TBD `playbooks list|inspect|validate` and selection operations map to MCP. Current intake playbook-index generation is preserved as migration evidence.
- **Authority and transitions:** authoritative playbook source and registry rules remain PRD 9's contract; the runnable index is derived. An item classifies `unknown -> runnable|inactive|invalid` without mutation.
- **Inputs, outputs, and provenance:** root, playbook ID, scope filters, target IDs, and schema range yield playbook metadata, runnable status, resolved canonical targets, harness/dependency requirements, and diagnostics.
- **Execution semantics:** list/inspect/validate are read-only, deterministic, and bounded; selection rejects inactive, invalid, incompatible, or ambiguous scope. No automatic run starts.
- **Dependencies and migration:** preserve `PlaybookIndex`/`PlaybookEntry` fields, active-only runnable behavior, playbook-aware `PB-NNN` identity, and `BuildPlaybooksIndex` semantics.
- **Acceptance evidence:** active/inactive/invalid, missing target, redirect target, scope mismatch, deterministic index, and CLI/MCP parity fixtures.
- **Non-goals and gates:** no arbitrary prompt execution, hidden harness install, or treating the derived index as authority. Linked to DI-011, DI-015, and DI-017.

#### RUN-001 Discovery run planning, recording, inspection, close, and abort

- **Surface and parity:** retain current logical `discovery.run` recording behavior behind a reconciled run operation family and MCP equivalents. Whether execution and recording are one operation or separate use cases must be frozen in Phase 2.
- **Authority and transitions:** immutable run folder evidence and the canonical run row remain authority. The intended lifecycle is `planned -> running -> closed|aborted`; current record-at-terminal behavior must be mapped explicitly rather than silently changed.
- **Inputs, outputs, and provenance:** playbook ID, requested and canonical targets, datasets, evidence paths, raw findings, outcome, title, execution context, and dry-run/apply yield run ID/path, index effect, copied-evidence hashes, resolutions, counts, diagnostics, and receipt.
- **Execution semantics:** dry run plans identifiers and writes; successful immutable run creation is idempotent only through an explicit request key; collision or existing immutable folder fails closed. Partial evidence copy or index update must have defined rollback/recovery. Concurrent creation cannot reuse an ID.
- **Dependencies and migration:** preserve `RunDiscoveryOptions`, `RunDiscoveryResult`, requested/canonical resolution provenance, immutable evidence, installed/source layout support, and current toolkit parity.
- **Acceptance evidence:** existing run tests plus collision, partial copy, abort, stale playbook, redirect target, negative/inconclusive outcome, crash, and CLI/MCP parity fixtures.
- **Non-goals and gates:** no qualification or design promotion during run recording. Linked to DI-002, DI-009, DI-011, DI-015, and DI-016.

#### FND-001 Raw finding recording and inspection

- **Surface and parity:** proposed/TBD raw-finding record/inspect operations mirror over MCP; they may be embedded in RUN-001 only if Phase 2 records that composition explicitly.
- **Authority and transitions:** raw findings live in immutable run evidence. `observed -> raw-recorded`; raw is not qualified or canonical design authority.
- **Inputs, outputs, and provenance:** run ID, source anchor, observation, outcome/polarity, evidence references, and content digests produce a raw-finding reference, run-relative path/anchor, validation findings, and receipt when written.
- **Execution semantics:** dry-run-first; explicit idempotency key; validates anchor containment and immutable-run rules; rejects changed run/evidence, duplicate conflicting content, or path escape. Concurrent writes to immutable runs are prohibited or serialized per approved lifecycle.
- **Dependencies and migration:** preserve raw-anchor normalization and validation behavior in `toolkits/buildos-discovery/internal/discovery/discovery.go` and PRD 10's raw-in-run boundary.
- **Acceptance evidence:** path traversal, missing evidence, duplicate observation, immutable folder, changed run, negative finding, crash, and CLI/MCP parity tests.
- **Non-goals and gates:** no automatic qualified finding, candidate canonicalization, or downstream handoff. Linked to DI-008, DI-009, DI-015, and DI-016.

#### QLF-001 Qualification evaluation and recording

- **Surface and parity:** retain logical `discovery.qualify` behind proposed CLI/MCP parity. Exact reviewer/agent authorization and whether test execution is bundled remain unresolved by DI-009.
- **Authority and transitions:** current compatibility floor is deterministic confirmation evidence and user-gated promotion. `raw -> qualification-planned -> qualified|not-qualified`; no result is qualified solely because an agent asserts it.
- **Inputs, outputs, and provenance:** requested/canonical run ID, raw anchor, outcome, title, confirmation-test contract, confirmation evidence, reviewer/actor authorization, and dry-run/apply produce finding ID/path, qualification assertion, resolution chain, evidence links, diagnostics, and receipt.
- **Execution semantics:** dry-run-first; deterministic replay must not duplicate a finding; changed run, raw anchor, test, or evidence invalidates a stale plan. Qualification failure is not a transport failure. Concurrent qualification of the same raw finding must converge or conflict explicitly.
- **Dependencies and migration:** preserve PRD 10's verify-to-promote requirement, `QualifyFindingOptions`/`QualifyFindingResult`, negative qualification semantics, Q-001, and R-002 until reconciled. Do not weaken the gate merely to reduce cost.
- **Acceptance evidence:** positive/negative/inconclusive fixtures, repeated tests, reviewer identity, conflicting concurrent attempts, stale evidence, copied root, cost measurement, and CLI/MCP result equality.
- **Non-goals and gates:** no override, appeal, revocation, or direct design creation in this operation. Linked to DI-009, Q-001, R-002, DI-015, and DI-016.

#### QLF-002 Qualification revocation, override, and appeal

- **Surface and parity:** no public operation is approved. If DI-009 approves any transition, its CLI and MCP projections must ship together and call the same core policy.
- **Authority and transitions:** reviewer roles, agent authority, override grounds, revocation effect, appeal states, and downstream consequences are TBD. Existing qualified records must not be silently edited while unresolved.
- **Inputs, outputs, and provenance:** future contract must include target finding, current digest/status, decision kind, actor authority, reason, evidence, affected handoffs, and receipt. No current inputs authorize mutation.
- **Execution semantics:** future mutation must be dry-run-first, append evidence rather than erase history, reject stale state, and define idempotent repeated decisions, recovery, and concurrency with handoff operations.
- **Dependencies and migration:** depends on Q-001, R-002, identity/permissions, privacy retention, and downstream Make Docs/export behavior.
- **Acceptance evidence:** positive and abusive-role matrices, revocation after handoff, appeal ordering, stale decision, replay, and cross-transport parity.
- **Non-goals and gates:** this row is an explicit prohibition against inventing an answer. Linked to DI-007, DI-008, DI-009, and DI-015.

#### HOF-001 Qualified-finding export and external handoff

- **Surface and parity:** define a Build OS-owned export/handoff operation with proposed/TBD CLI and MCP names. It replaces, rather than migrates unchanged, the current direct `buildos-design promote finding` write boundary.
- **Authority and transitions:** the qualified finding and Build OS handoff receipt remain Build OS authority. `eligible -> handoff-planned -> exported|externally-acknowledged|failed`. Any downstream design, plan, PRD, or work artifact remains owned by Make Docs or another external product.
- **Inputs, outputs, and provenance:** qualified finding ID, intended downstream product/profile, export format or validated public operation, selected version, user authorization, and expected finding digest produce an evidence package or external invocation plan/result, external identity when returned, diagnostics, and receipt.
- **Execution semantics:** export is deterministic and idempotent by finding digest/profile. External invocation is dry-run/authorization gated, never blindly retried after an ambiguous result, verifies published markers, and records partial failure/recovery. Concurrent handoffs use operation keys and do not duplicate external projects/artifacts.
- **Dependencies and migration:** PRD 11 and `toolkits/buildos-design/internal/design/promotion.go` are compatibility evidence for fields and traceability, but their direct writes under `system/docs/` conflict with the approved boundary. Phase 6 is required for Make Docs invocation.
- **Acceptance evidence:** export-only without Make Docs, missing companion, stale finding, duplicate request, external timeout before/after effect, marker mismatch, no-direct-write assertion, and CLI/MCP parity.
- **Non-goals and gates:** Build OS does not own or write Make Docs designs, planning routes, registry, markers, configuration, or internals. Linked to DI-009, DI-012, R-001, and the PRD 11 supersession gate.

#### REL-001 Relationship and provenance query

- **Surface and parity:** proposed/TBD relationship/provenance inspect and trace operations map to MCP with identical typed graph edges; pagination/streaming may be transport-specific presentation only.
- **Authority and transitions:** relationships remain in their owning canonical records, such as entity redirects, requested/canonical IDs, source anchors, extraction outcomes, run/finding references, and handoff receipts. Query is read-only.
- **Inputs, outputs, and provenance:** starting IDs/anchors, edge types, direction, depth and bounds, schema range, and privacy context produce nodes, typed edges, authority/source anchors, redaction markers, diagnostics, and continuation.
- **Execution semantics:** deterministic traversal and ordering; bounded depth/size; explicit missing, cycle, redacted, stale-derived-index, and unsupported-edge diagnostics. No hidden repair or locks beyond consistent snapshot rules.
- **Dependencies and migration:** reuse entity resolver chains and domain provenance without copying evidence bodies into a new canonical graph.
- **Acceptance evidence:** multi-hop redirect, source-to-extraction-to-finding-to-handoff trace, cycles, missing/redacted evidence, large graph bounds, and CLI/MCP equality.
- **Non-goals and gates:** no canonical graph database, inferred relationship writes, or unrestricted evidence disclosure. Linked to DI-001, DI-008, and DI-015.

#### REL-002 Reviewed relationship change

- **Surface and parity:** no generic public relationship mutation is approved. Domain-specific reviewed changes, such as entity consolidation or extraction outcome acceptance, remain the only current paths. A future generic operation requires CLI/MCP parity.
- **Authority and transitions:** the owning domain must be named before mutation. The generic conceptual transition is `proposed -> accepted|rejected -> applied|no-op`, but it does not grant authority.
- **Inputs, outputs, and provenance:** a future request must identify edge type, owning canonical record, endpoints, evidence, reviewer authorization, expected digests, and plan. Current requests must return capability unavailable.
- **Execution semantics:** future behavior is dry-run-first, idempotent, stale-state guarded, recoverable, and locked at the owning-domain unit; cross-domain transactions require DI-016.
- **Dependencies and migration:** depends on the complete authority map, QLF/ENT/EXT domain policies, receipt design, and schema compatibility.
- **Acceptance evidence:** domain-specific positive/negative fixtures, authority confusion refusal, stale edge, concurrent review, crash recovery, and parity.
- **Non-goals and gates:** no catch-all edge editor or UI-only mutation. Linked to DI-001, DI-002, DI-009, DI-015, and DI-016.

#### OPR-001 Operation planning, authorization, application, verification, and receipt

- **Surface and parity:** every mutation/external action supports core inspect/plan/apply forms; CLI dry-run/apply and MCP plan/apply serialize the same plan and result. Exact generic command names are TBD because domain commands may project these stages without a separate user-facing `operations apply` command.
- **Authority and transitions:** operation metadata follows `inspected -> planned -> authorized -> applying -> verified -> recorded`; refusal returns `planned|authorization-refused`; failure or interruption returns a precise partial state.
- **Inputs, outputs, and provenance:** versioned domain request, project identity/root, expected authority digests, actor/client/transport, requested authorization, idempotency key, and capability/schema versions produce deterministic plan, required authorization, effects, result, verification, diagnostics, receipt identity, and recovery.
- **Execution semantics:** plan is read-only and stale-digest bound; apply validates authorization and preconditions, uses DI-016 concurrency, does not replan silently, and records no-op equivalence. Receipt persistence failure after verified canonical success is a distinct recoverable condition, not success without audit.
- **Dependencies and migration:** generalize current entity plan/apply/write-status and runtime-proof receipt/replay behavior without treating the disposable proof schema as production authority.
- **Acceptance evidence:** plan determinism, stale plan, authorization refusal, replay, crash after every step, canonical-success/index-failure, receipt failure, concurrent CLI/MCP invocation, and redaction tests.
- **Non-goals and gates:** no authorization by mere invocation, hidden destructive default, or transport-specific write path. Linked to DI-002, DI-008, DI-015, DI-016, and DI-017.

#### OPR-002 Operation inspection, diagnosis, recovery, and retry

- **Surface and parity:** proposed/TBD operation inspect, recovery-plan, recover, and abandon operations map one-to-one to MCP. Blind re-execution of a domain command is not the recovery contract.
- **Authority and transitions:** operation/recovery evidence follows `failed|interrupted -> recovery-required -> recovered|abandoned`; prior evidence is preserved. Exact receipt path and amendment mechanism remain DI-002.
- **Inputs, outputs, and provenance:** operation ID or recovery token, project identity, expected current digests, requested recovery action, and authorization produce observed effects, ambiguity classification, safe next actions, plan, result, and appended disposition.
- **Execution semantics:** inspection is read-only; recovery is dry-run-first, idempotent, rejects mismatched project/state, and holds the same lock as the interrupted operation. Ambiguous external effects require verification, not automatic retry.
- **Dependencies and migration:** current entity exact recovery command and proof replay-without-fifth-subprocess behavior are evidence; broader semantics need Phase 1 design.
- **Acceptance evidence:** no-write interruption, canonical-only success, missing receipt, corrupt receipt, external ambiguous success, stale lock, repeated recovery, and CLI/MCP equality.
- **Non-goals and gates:** no erasing failed history or retrying destructive/external work without authorization. Linked to DI-002, DI-012, DI-015, and DI-016.

#### LFC-001 Diagnose and repair Build OS-owned project state

- **Surface and parity:** proposed/TBD `doctor`, repair-plan/apply, and rebuild-derived-state operations mirror over MCP. Phase 1 proves entity validation/index recovery; Phase 2 expands only after each domain maps repair authority.
- **Authority and transitions:** canonical files remain authority. Diagnosis classifies `healthy|degraded|invalid`; approved actions move `degraded -> planned -> repaired|recovery-required`. Repair may rebuild derived state but may not invent missing canonical content.
- **Inputs, outputs, and provenance:** root/project identity, scope, expected digests, repair policy, and authorization produce findings, authority/derived classification, repair plan, backups when required, verification, and receipt.
- **Execution semantics:** diagnosis is read-only; repair is dry-run-first, idempotent, stale-state guarded, atomic per approved unit, and conservative under ambiguity. Concurrency is exclusive for affected state.
- **Dependencies and migration:** compose CFG, DAT, ENT, project registry, and operation recovery contracts; preserve current validators and exact entity recovery behavior.
- **Acceptance evidence:** missing/corrupt derived index, invalid canonical row, stale registry, partial prior operation, unsupported schema, crash, backup restore, and CLI/MCP parity.
- **Non-goals and gates:** no automatic deletion, schema downgrade, companion repair, or canonical reconstruction from a cache. Linked to DI-001, DI-002, DI-004, DI-005, and DI-016.

#### CMP-001 Make Docs companion inspection and recognition

- **Surface and parity:** proposed/TBD companion inspect/recognize operations map to MCP, but exact commands and marker fields remain unavailable until Phase 6 validates a published Make Docs release.
- **Authority and transitions:** Build OS may read the configured dependency and Make Docs' published project markers/registration through public interfaces. Build OS stores only its own integration config/receipt. Recognition classifies `unknown -> absent|recognized|mismatch|invalid`.
- **Inputs, outputs, and provenance:** project identity/root, configured dependency specification/version, and supported compatibility range produce observed Make Docs version/identity/state from published interfaces, capability status, diagnostics, and next-step plan. Read-only.
- **Execution semantics:** idempotent; no dry-run distinction; missing dependency is capability unavailable, not Build OS failure. Marker ambiguity or unsupported version fails closed. No registry or marker write occurs.
- **Dependencies and migration:** depends on DI-012 and R-001. Checked-in Make Docs-managed trees are compatibility evidence, not a public API contract.
- **Acceptance evidence:** published release matrix for absent, recognized, mismatched, corrupt, reconfigured, and removed state; machine-readable verification; no-direct-write audit; CLI/MCP parity.
- **Non-goals and gates:** no inference of exact public commands or markers in this PRD. Linked to DI-012 and R-001.

#### CMP-002 Make Docs ensure/setup, reconfigure, repair, and removal

- **Surface and parity:** exact CLI and MCP operations are prohibited until Phase 6 integration validation. When approved, the standard Build OS project profile explicitly informs the user that Build OS will ensure/use the configured Make Docs system dependency and invoke Make Docs' public project setup operation; noninteractive CLI and MCP require an explicit profile/flag/authorization acknowledging the companion action.
- **Authority and transitions:** Build OS invokes only Make Docs public lifecycle operations and then verifies published markers. Build OS records its own integration receipt. `authorized -> invoking -> verified|failed|recovery-required`. Removing Build OS leaves Make Docs intact unless the user explicitly requests both removals.
- **Inputs, outputs, and provenance:** project identity/root, configured exact or deterministic dependency selection, operation kind, authorization, expected prior marker state, and redaction policy produce invocation plan, selected/observed version, project identity, command outcome, verified marker state, time, diagnostics, and Build OS receipt.
- **Execution semantics:** dry-run returns the external action without invoking it; idempotency verifies recognition before setup and uses public reconfiguration/repair/remove operations. Ambiguous timeout requires inspection. Build OS never edits Make Docs state to simulate success. Concurrent companion actions are serialized by project/operation key.
- **Dependencies and migration:** requires published setup, recognition, version selection, reconfiguration, repair, removal, failure, and unsupported-version contracts; supply-chain controls; and partial-failure tests.
- **Acceptance evidence:** interactive/noninteractive authorization, clean setup, already present, mismatch, corrupt state, failure before/after external effect, retry without duplicate invocation, reconfiguration, independent removals, and CLI/MCP parity.
- **Non-goals and gates:** no bundling, copying, vendoring, forking, direct global/project writes, or reimplementation of Make Docs internals. Linked to DI-008, DI-012, DI-013, and R-001.

#### SAF-001 Evidence privacy, redaction, retention, export, and deletion

- **Surface and parity:** classification and policy inspection are Phase 1 requirements; export/redact/delete operation names remain TBD and require CLI/MCP parity if approved. Browser capture adds a separate Phase 5 delta.
- **Authority and transitions:** evidence and receipts remain canonical subject to an approved policy. Potential transitions are `retained -> exported|redacted|deletion-planned -> deleted`, but exact retention, tombstone, and relationship behavior remain DI-008.
- **Inputs, outputs, and provenance:** project/evidence selector, classification, purpose, actor authorization, retention rule, export/redaction/delete scope, and expected digests produce affected evidence graph, disclosure preview, plan, irreversible effects, verification, and receipt.
- **Execution semantics:** inspection/export planning is read-only; redaction/deletion is never implicit, requires explicit authorization, rejects stale graph state, and defines referential integrity and recovery limits. Concurrency guards affected evidence and receipts.
- **Dependencies and migration:** applies to source paths, identities, process output, browser content, Make Docs diagnostics, receipts, logs, and any future server cache. Domain retention cannot be overridden accidentally by presentation adapters.
- **Acceptance evidence:** secret-bearing fixtures, paths/identities, redaction-before-persistence, retention expiry, legal/policy hold if adopted, export completeness, deletion verification, broken-reference prevention, and CLI/MCP equality.
- **Non-goals and gates:** no policy answer is invented here; no unrestricted environment capture or claim that deletion is recoverable. Linked to DI-002, DI-007, DI-008, DI-010, and DI-012.

#### SAF-002 Concurrency, stale plans, cancellation, and interruption

- **Surface and parity:** concurrency metadata is part of every core plan/result. Proposed/TBD lock/status/cancel/recover operations must have parity; CLI signals and MCP cancellation may differ only as transport inputs to the same core transition.
- **Authority and transitions:** planned operations become `authorized` only if authority digests and lock/lease preconditions remain current; otherwise `stale`. Applying work becomes `verified`, `cancelled`, `interrupted`, or `recovery-required` with durable disposition.
- **Inputs, outputs, and provenance:** operation ID, project identity, affected authority units, expected revisions/digests, timeout/cancellation context, and authorization produce concurrency decision, lock/lease metadata safe to persist, effects, and recovery.
- **Execution semantics:** stale plans fail closed; locks cannot be silently stolen; stale-lock recovery is explicit; cancellation is cooperative and cannot misreport a committed write as cancelled. Concurrent reads use a consistent documented snapshot model.
- **Dependencies and migration:** DI-016 must choose lock/transaction units across canonical JSONL, derived indexes, receipts, and external actions. Optional server leases cannot weaken local guarantees.
- **Acceptance evidence:** concurrent CLI/MCP mutation, stale plan, cancellation before/during/after write, process crash, stale lock, lock-owner loss, index rebuild race, and deterministic recovery.
- **Non-goals and gates:** no global lock by convenience without evidence, no server-only lease authority, and no multi-file transaction claim before proof. Linked to DI-003, DI-015, and DI-016.

#### MCP-001 Built-in MCP launch, schema discovery, and parity

- **Surface and parity:** the same installed `buildos` executable launches MCP in a proposed/TBD mode. Every approved CLI domain-operation ID has an MCP projection using the same typed core request/result. MCP resources may provide read-only views; tools perform operations. Exact protocol names and transport are Phase 3 decisions.
- **Authority and transitions:** MCP owns no domain state. Client negotiation moves `unknown -> negotiated|incompatible`; domain transitions are exactly those of the mapped core operation.
- **Inputs, outputs, and provenance:** initialization/capability negotiation, client identity, authorization context, schema range, cancellation/progress context, and domain request produce supported schemas, structured core result, diagnostics/error mapping, receipt link, and transport metadata.
- **Execution semantics:** no shelling through CLI; no authorization bypass; cancellation maps to SAF-002; retries use operation idempotency keys; server restart does not make in-memory state authoritative. Long operations expose progress without changing outcome semantics.
- **Dependencies and migration:** Phase 1 proves entity read and mutation through CLI and MCP. Phase 3 completes protocol compatibility, all migrated domains, resources, progress/cancellation, and security mapping. The runtime proof did not test MCP.
- **Acceptance evidence:** automated operation-ID parity matrix, equal canonical effects/receipts, schema skew, client disconnect, cancellation, concurrent CLI/MCP apply, malformed request, unauthorized request, restart, and no-transport-dependency core tests.
- **Non-goals and gates:** no separately installed MCP product, MCP-only domain operation, private canonical database, UI, or coordinating server. Linked to DI-007, DI-014, DI-015, DI-016, and DI-017.

#### PKG-001 Product install, upgrade, rollback, repair, and removal

- **Surface and parity:** packaging installs one `buildos` executable containing CLI and MCP launch modes. Any lifecycle command surface is mirrored where it is a domain operation; package-manager actions themselves are not fabricated as MCP operations.
- **Authority and transitions:** package manager or verified archive installation owns executable files; Build OS owns its global settings/registry and project installations according to later contracts. `absent -> installed -> upgraded|rolled-back|repaired|removed`.
- **Inputs, outputs, and provenance:** package/version/channel, platform/architecture, expected checksums/signatures/SBOM, ownership, migration profile, and authorization produce verified artifacts, installation effects, compatibility result, rollback/removal plan, and receipts where Build OS state changes.
- **Execution semantics:** clean install and upgrade are idempotent for an identical verified version; downgrade and ownership changes require explicit plans; failures preserve prior executable or exact rollback. Project state and Make Docs remain intact by default on machine removal unless separately authorized.
- **Dependencies and migration:** retain PRD 18's archive, checksum, SBOM, signing/attestation, Homebrew, platform, alias, rollback, and clean-machine evidence, but update artifact content to include the built-in MCP server and accepted core contracts.
- **Acceptance evidence:** supported platform/architecture matrix, archive and package-manager clean install, upgrade, rollback, repair, uninstall, alias migration, orphaned projects, signature/SBOM verification, and CLI/MCP version parity.
- **Non-goals and gates:** no publication, deployment, self-update, or separate MCP package from PRD approval alone. Linked to DI-005, DI-011, DI-013, R-003, and R-004.

#### SRV-001 Optional coordinating server

- **Surface and parity:** no server is approved. Phase 4 must first prove a measured multi-client, remote, job, or subscription need. If approved, it projects existing core operations and cannot introduce server-only domain writes.
- **Authority and transitions:** server caches, queues, and leases are never canonical and must reconstruct from local durable state. Decision moves `not-approved -> approved|rejected`; topology and lifecycle remain TBD.
- **Inputs, outputs, and provenance:** future contract must define workspace selection, tenancy, identity, authorization, lease, offline state, and core request/result. Current requests return capability unavailable.
- **Execution semantics:** future server must preserve local idempotency/recovery, tolerate server loss, reject cross-project access, and degrade to complete local CLI/MCP operation.
- **Dependencies and migration:** conditional on DI-003, DI-006, DI-007, privacy classification, threat model, and measured use case.
- **Acceptance evidence:** no-server workflow, partition/concurrent-client tests, server-loss reconstruction, tenancy isolation, revocation, cache deletion/rebuild, and authorization propagation.
- **Non-goals and gates:** not part of Phase 1 implementation or the mandatory Go executable selection. No server database becomes canonical. Linked to DI-003, DI-006, DI-007, and DI-008.

#### UI-001 First visual workflow and browser capture boundary

- **Surface and parity:** no UI workflow or technology is selected. Phase 5 must choose one evidenced vertical workflow that calls approved operations. Browser capture, if justified, submits only explicit user-selected evidence with consent and source anchors.
- **Authority and transitions:** UI/browser owns no canonical state, qualification, or direct writes. UI gate moves `not-selected -> workflow-approved`; capture moves `consented -> submitted|cancelled` through an evidence operation.
- **Inputs, outputs, and provenance:** future contract includes user task, selected project/evidence, consent, source identity, privacy classification, approved operation request, and accessible presentation state.
- **Execution semantics:** no direct filesystem mutation; offline behavior and retries use core idempotency; cancelled capture writes nothing; privacy/redaction occurs before persistence where required.
- **Dependencies and migration:** depends on DI-008, DI-010, approved core capability map, UI UAT/accessibility evidence, and separately selected UI technology. It does not affect Go core/CLI/MCP language selection.
- **Acceptance evidence:** user-task study, prototype UAT, accessibility review, consent, source-integrity, privacy, offline/retry, and adapter-parity tests.
- **Non-goals and gates:** no generic dashboard, broad browser scraping, automatic qualification, or UI-only domain operation. Linked to DI-008, DI-010, and DI-017.

### Decision-inventory reconciliation

The owner roles below are proposed accountability roles for review and do not name a person or settle the decision. Existing Q/R IDs are linked only where the current register already contains them. Every row marked `register reconciliation required` must be added to or reconciled with `docs/prd/03-open-questions-and-risk-register.md`; this document does not invent future Q/R numbers.

| Decision | Requirement, question, risk, or follow-on | Proposed owner | Phase or gate | Evidence required | Current disposition |
| --- | --- | --- | --- | --- | --- |
| DI-001 Canonical versus derived data authority | Common authority invariant; open question and follow-on storage design | Product/data architecture owner | Phase 1 entry | Per-record authority map, delete/rebuild, schema evolution, offline proof | Open; register reconciliation required; no exception to filesystem/JSONL default is approved |
| DI-002 Operation receipt contract | OPR-001/002 requirement; provenance/security risk; follow-on design | Core architecture owner with security/privacy owner | Phase 1 gate | Path/schema, append/amend, integrity, replay, interruption, redaction, upgrade fixtures | Open; register reconciliation required |
| DI-003 Local/server synchronization | Conditional server question and conflict/recovery risk | Server architecture owner | Phase 4 only | Partition, stale lease, concurrent client, deterministic conflict, server-loss reconstruction | Deferred; no remote mutation or sync is approved; register reconciliation required |
| DI-004 Project identity and relocation | PRJ-002 requirement and lifecycle design | Product lifecycle owner | Phase 1 project-resolution gate | Move, rename, symlink, clone, copy, duplicate ID, missing root, corrupt registry | Open; register reconciliation required |
| DI-005 Global settings and registry | PRJ-001/003 requirement and lifecycle risk | Product lifecycle and release owners | Phase 1 contract before initialization | Scope/location, multi-user/version, backup/restore, corruption, uninstall fixtures | Open; register reconciliation required |
| DI-006 Coordinating-server need/topology | SRV-001 measured-use-case question | Product owner | Phase 4 entry | Named workflow, measured need, daemon/service proof, no-server degradation | Deferred; server not approved; register reconciliation required |
| DI-007 Server tenancy/auth/permissions | Conditional security risk and follow-on design | Security owner | Conditional Phase 4 security gate | Threat model, isolation, role/revocation, audit, authorization propagation | Deferred; no shared server approved; register reconciliation required |
| DI-008 Evidence privacy/retention/redaction | SAF-001 requirement and cross-phase privacy risk | Security/privacy owner | Phase 1 policy; Phase 5 capture delta | Classification, consent, secret fixtures, pre-persistence redaction, retention/deletion/export | Open; register reconciliation required |
| DI-009 Qualification authority/workflow | QLF-001/002 requirement; existing Q-001 and R-002 | Product owner with discovery/qualification owner | Before Phase 2 qualification plan | Reviewer/agent authority, deterministic gates, override/revocation/appeal, repeatability, cost | Open; preserve verify-to-promote floor; Q-001 and R-002 remain open |
| DI-010 First UI workflow/browser boundary | UI-001 question and follow-on design | UX/product owner with privacy owner | Phase 5 entry | User-task evidence, accessible prototype UAT, consent, source integrity, adapter parity | Deferred; no UI/browser implementation approved; register reconciliation required |
| DI-011 Toolkit compatibility/migration | Every Phase 2 domain parity requirement; existing R-004 | Migration owner | Phase 2 entry/exit | Golden CLI/filesystem/exit fixtures, copied-root rehearsal, failure injection, rollback | Open risk; R-004 remains open; no toolkit change authorized |
| DI-012 Companion integration verification | CMP-001/002 question and risk; existing R-001 | Make Docs integration owner | Phase 6 gate | Published commands/markers/version semantics, partial failure, reconfigure/repair/remove, receipts | Open; exact contract unverified; R-001 remains open |
| DI-013 Packaging/upgrade/removal | PKG-001 follow-on design and existing R-003 | Release owner | Phase 7 gate | Supported matrix, signing, SBOM, install/upgrade/rollback/repair/uninstall, orphan handling | Open risk; R-003 remains open; publication separately authorized |
| DI-014 Go runtime selection/reopen triggers | Current architecture decision | Technical architecture owner | Phase 0.5 complete; explicit re-evaluation only | Retained proof; new representative proof plus migration/rollback if reopened | Resolved for current core/CLI/MCP selection; proof did not validate MCP/security/scale |
| DI-015 Schema/protocol compatibility | SYS-001/MCP-001/common result requirement and risk | Core/MCP contract owner | Phase 1 schema gate; Phase 3 protocol gate | Old/new fixtures, unknown fields, negotiation, downgrade, partial-upgrade recovery | Open; register reconciliation required |
| DI-016 Transaction and locking unit | SAF-002/common mutation requirement and risk | Core reliability owner | Phase 1 recovery gate | Crash after each step, concurrent CLI/MCP, stale lock, retry, derived rebuild | Open; no cross-file transaction claim approved; register reconciliation required |
| DI-017 Complete capability map and recurring reconciliation | This revision and mandatory acceptance gate | Product and architecture owners | Phase 1 implementation entry; every later phase | Approved row-by-row map, owners, evidence, risks/questions, accepted deltas | This draft supplies the review inventory; remains open until approved and committed |

### Phase assignment and decision gates

#### Phase 1: Core contract, parity foundation, and bounded entity proof

Approve SYS-001, PRJ-001/002, CFG-001 read/validation, DAT-001/002 entity subsets, ENT-001 through ENT-004, OPR-001/002, LFC-001 entity recovery, SAF-001 policy, SAF-002, and MCP-001's entity subset. Freeze transport-neutral package boundaries, requests, plans, results, diagnostics, authorization, verification, receipt, schema, redaction, idempotency, locking, interruption, and recovery contracts. Prove entity read and mutation through CLI and MCP without changing established filesystem effects.

**Gate:** design inputs and PRD authority are committed; no in-scope row, DI item, register item, dependency, compatibility obligation, non-goal, or acceptance fixture is undispositioned; the single Go program contains CLI and MCP modes; the core has no CLI/MCP dependency; CLI/MCP entity results, effects, errors, and receipts are semantically equivalent; canonical local files remain sufficient; and interruption is diagnosable and recoverable. Passing the documentation gate still requires separate implementation authorization.

#### Phase 2: Domain migration

Reconcile and then migrate CFG-001 mutation, EVD-001/002, EXT-001/002, full DAT-001/002, PBK-001, RUN-001, FND-001, QLF-001 and any approved QLF-002 delta, HOF-001 export-only boundary, REL-001 and any approved REL-002 domain operations, and full LFC-001. Each domain ships core, CLI, and MCP projections together while legacy toolkits remain until parity and rollback evidence is accepted.

**Gate:** golden fixtures prove canonical files, evidence, provenance, state transitions, diagnostics, CLI exit semantics, MCP errors/results, idempotency, concurrency, recovery, and rollback. Qualification cannot enter planning while DI-009/Q-001/R-002 remain undispositioned. Direct Make Docs writes are not migrated.

#### Phase 3: MCP protocol completion

Complete MCP-001 schema negotiation, all Phase 2 operation projections, resources, authorization-context mapping, progress, cancellation, diagnostic/error mapping, client compatibility, and automated parity inventory.

**Gate:** every approved CLI domain-operation ID has an MCP equivalent in the same executable and release; transport-only features are explicitly classified; no MCP authorization or filesystem bypass exists; and client disconnect/restart/cancellation cannot corrupt or misreport operations.

#### Phase 4: Optional coordinating server

Evaluate SRV-001 only after DI-003/006/007 evidence. If the measured-use-case gate fails, no server is built. If it passes, create a separate design/PRD delta that preserves local authority and complete no-server operation.

#### Phase 5: UI and optional evidence clients

Evaluate UI-001 and DI-010 only after the core operation and privacy contracts are stable. Select UI technology independently from the Go core/CLI/MCP decision. Browser capture remains explicit, consented evidence submission and never qualification or direct writes.

#### Phase 6: Make Docs companion integration

Validate CMP-001/002 and DI-012 against a published Make Docs release. Standard Build OS project initialization must disclose that it will ensure/use the configured system dependency, invoke Make Docs' public project setup operation, verify published markers/registration, and record a Build OS integration receipt. Noninteractive operation requires explicit acknowledgement. Reconfiguration and removal use public operations; removing Build OS preserves Make Docs unless both are explicitly requested.

#### Phase 7: Distribution and deprecation

Reconcile PKG-001 with retained PRD 18 packaging, compatibility alias, rollback, release-hardening, documentation, and deprecation work. Package core, CLI, and MCP as one executable/distribution. Separate approvals remain required for release, publication, installation migration, and deployment.

### Global non-goals

- Implementing or planning implementation from this unapproved draft.
- Treating a directory, router, template, existing command, or disposable proof harness as the complete product contract.
- Creating separately installed core, CLI, or MCP products or executables.
- Allowing CLI or MCP adapters, UI, browser client, or optional server to own domain rules or authoritative writes.
- Making a coordinating server, SQLite database, cache, or UI projection canonical by default.
- Choosing UI, server, MCP-library, database, cloud, identity-provider, or browser-extension technology in this revision.
- Changing, deleting, consolidating, or repackaging current toolkits before approved parity and rollback evidence.
- Weakening the current verify-to-promote gate while qualification authority remains unresolved.
- Migrating direct Build OS writes into Make Docs-owned designs, plans, PRDs, work, global state, registration, markers, configuration, or internals.
- Bundling, copying, vendoring, forking, altering, or owning Make Docs.
- Committing, pushing, publishing, releasing, deploying, replacing installed binaries, or mutating live adopter data without separate authorization.

Code anchors:

- `toolkits/buildos/`
- `toolkits/buildos-intake/`
- `toolkits/buildos-discovery/`
- `toolkits/buildos-design/`
- `system/.os/contracts/`
- `system/.os/config/instance.yaml`
- `system/.os/indexes/`
- `system/workspace/`

## Impacted Docs and Dependencies

- `docs/prd/00-index.md` must add PRD 19 as the newest draft revision in the active namespace and connect reciprocal lineage without presenting it as approved authority.
- `docs/prd/03-open-questions-and-risk-register.md` must preserve Q-001 and R-001 through R-004, update their scope where appropriate, and add or reconcile the DI items that currently lack register coverage. No new Q/R number is asserted by this document.
- PRDs 01, 02, and 05 through 18 remain visible baseline or change history; only the headings listed below require direct lineage annotations.
- The two uncommitted design records are approved drafting inputs but remain an explicit authority dependency until committed.
- Current Go entities code and tests are the Phase 1 proof seed; current intake, discovery, config, and design code are Phase 2 compatibility or conflict evidence, not authorization to edit them.
- The retained runtime proof selects Go now but leaves MCP, security, concurrency, crash boundaries, large data, clean installation, supply chain, real Make Docs, and platform execution to later gates.
- Make Docs public operations and markers are an external dependency not verified by this repository evidence.
- A delta implementation backlog may be drafted only as non-authoritative planning output and may not schedule product implementation before the Phase 1 capability/PRD gate is approved and separately authorized.

Code anchors:

- `docs/prd/00-index.md`
- `docs/prd/03-open-questions-and-risk-register.md`
- `docs/prd/18-revise-unified-buildos-cli-and-distribution.md`
- `toolkits/buildos/internal/cli/`
- `toolkits/buildos/internal/entities/`
- `toolkits/buildos-intake/internal/intake/`
- `toolkits/buildos-discovery/internal/discovery/`
- `toolkits/buildos-design/internal/design/`

## Required Baseline Annotations

- `01-product-overview.md`: add `Superseded by` under product capabilities/boundaries for the cohesive core/CLI/MCP product and external Make Docs relationship.
- `02-architecture-overview.md`: add `Superseded by` under topology/runtime/data flow for core-only authority, mandatory CLI/MCP parity, and canonical-versus-derived gates.
- `05-spaces-boundary-and-shipping.md`: add `Superseded by` where Make Docs is treated as a Build OS-owned downstream space or bundled shipping concern.
- `06-operating-layer-and-routing.md`: add `Superseded by` where directories/routers or script wrappers can be read as the application operation contract.
- `07-intake-and-conversion.md`: add `Superseded by` for migration behind transport-neutral core operations while preserving converter/provenance semantics.
- `08-data-and-extraction.md`: add `Superseded by` for explicit authority, query, derived-index, extraction-event/candidate, receipt, and recovery contracts.
- `09-playbooks.md`: add `Superseded by` for explicit playbook inspect/validate/select operations and derived-index classification.
- `10-discovery-runs-and-qualification.md`: add `Superseded by` for run/finding operation contracts and the unresolved qualification-authority gate; retain verify-to-promote as the compatibility floor.
- `11-flow-c-integration.md`: add `Superseded by` to direct Make Docs-owned design/index writes and replace them with HOF-001's Build OS-owned export/handoff boundary plus the Phase 6 public-operation gate.
- `12-stage-automation.md`: add `Superseded by` where stage movers can bypass core plans, authorization, verification, receipts, or CLI/MCP parity.
- `13-adopter-owned-config-surface.md`: add `Superseded by` for core config operations and separate global/project identity authority, while preserving existing config fields and validation semantics.
- `14-revise-deterministic-toolkit-deployment.md`: add `Superseded by` for the cohesive core/CLI/MCP distribution; retain later hardening evidence through PRD 18/19 lineage.
- `15-revise-extraction-draft-lifecycle.md`: add `Superseded by` only where extraction candidates/events/outcomes require the explicit core transition and authority model; preserve `draft` lifecycle history.
- `16-revise-toolkit-ownership-boundaries.md`: add `Superseded by` for transport-neutral core ownership and same-change CLI/MCP projection while preserving coherent domain packages.
- `17-enhance-entity-consolidation-and-canonical-resolution.md`: add `Superseded by` only for adapter/core placement and MCP parity; preserve all entity data, resolver, manifest, safety, and migration contracts.
- `18-revise-unified-buildos-cli-and-distribution.md`: add `Superseded by` to CLI-first internals, frozen narrow command inventory, direct domain migration, and package content; retain entity seed, shared output evidence, compatibility/rollback, and release-hardening constraints through PRD 19.
- `00-index.md`: list PRD 19 as the newest draft revision in the active namespace and add reciprocal `Related Docs` metadata without presenting it as approved authority.
- `03-open-questions-and-risk-register.md`: reconcile DI-001 through DI-017 in place using existing IDs where applicable and newly assigned register IDs only in that canonical register; never add `### Change Notes` there.

## Source Anchors

- [Build OS Product Boundary and Headless Operating Model](../designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md)
- [Build OS Phase 0.5 Runtime-Selection Proof](../designs/2026-08-14-build-os-runtime-selection-proof.md)
- [18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md)
- [17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md)
- [10 Discovery, Runs and Qualification](./10-discovery-runs-and-qualification.md)
- [11 Flow C Integration](./11-flow-c-integration.md)
- [03 Open Questions and Risk Register](./03-open-questions-and-risk-register.md)
- `toolkits/buildos/internal/cli/cli.go`
- `toolkits/buildos/internal/cli/domain.go`
- `toolkits/buildos/internal/cli/output.go`
- `toolkits/buildos/internal/entities/`
- `toolkits/buildos/pkg/entities/`
- `toolkits/buildos-intake/internal/intake/types.go`
- `toolkits/buildos-discovery/internal/discovery/types.go`
- `toolkits/buildos-design/internal/design/promotion.go`
- `system/.os/scripts/validate_config.py`
- `system/.os/contracts/`
- `system/.os/config/instance.yaml`
- `system/.os/indexes/`
- `system/workspace/`
