# 03 Open Questions and Risk Register

## Purpose

Capture drift, unresolved decisions, and rebuild risks for the Build OS PRD namespace that should stay visible instead of being buried in subsystem docs. This is the living register; update it directly as items are discovered or resolved.

## Confirmed Drift

List verified mismatches.

### D-001 make-docs line-break convention conflict

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Reconcile in the make-docs source |

**Issue**: `docs/AGENTS.md` states "source Markdown uses semantic line breaks," while `docs/assets/references/output-contract.md` requires "paragraphs should be one logical source line … line breaks only for semantic Markdown structure." These two make-docs references prescribe incompatible prose line-break styles.

**Why it matters**: Generated `docs/` artifacts (designs, plans, PRDs, work) cannot satisfy both rules; the architecture design and the plan used sentence-per-line while this PRD set and the backlog follow the output contract, so the namespace is internally inconsistent until reconciled.

**Recommendation**: Pick one convention in the make-docs source and align both references; normalize existing `docs/` artifacts to match.

**To close**: A single agreed line-break rule in make-docs and normalized existing docs.

Code anchors:

- `docs/AGENTS.md`
- `docs/assets/references/output-contract.md`

### D-002 P6 toolkit ownership drift

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Flow B deterministic logic is implemented in `buildos-discovery`; P6 behavior was removed from `buildos-intake` and `validate_config.py` | None |

**Issue**: The initial W1 R0 P6 implementation placed discovery-run and finding-qualification logic in `buildos-intake` and added run/finding-specific validation to `system/.os/scripts/validate_config.py`.

**Why it matters**: This violates the packaged-toolkit ownership principle. `buildos-intake` is scoped to intake/conversion, while `validate_config.py` is a legacy unmanaged config/scoped-metadata validator that should eventually migrate to `buildos-config` rather than accumulate new durable domains.

**Recommendation**: Treat the current P6 implementation as rejected architecture. Create `buildos-discovery` for discovery runs, raw-finding anchoring, finding qualification, negative assertions, and run/finding-specific validation; remove the P6 logic from `buildos-intake` and `validate_config.py` during the remediation phase.

**To close**: W1 R0 P6 is remediated so Flow B behavior is implemented by `buildos-discovery`, `buildos-intake` returns to intake/conversion scope, and `validate_config.py` no longer carries P6 run/finding logic.

**Resolution**: W1 R0 P6 remediation created the `buildos-discovery` toolkit, restored `buildos-intake` to intake/conversion/index scope, removed P6 run/finding-specific validation from `validate_config.py`, and added the thin `system/.os/scripts/buildos-discovery` wrapper.

Code anchors:

- `docs/prd/16-revise-toolkit-ownership-boundaries.md`
- `docs/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md`
- `docs/assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md`
- `toolkits/buildos-discovery/`
- `system/.os/scripts/buildos-discovery`

### D-003 user-guide coverage drift

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Build OS product users include adopters, operators, admins, and practitioners who use the shipped `system/` filesystem and first-party `buildos-*` toolkits | None |

**Issue**: W1 R0 P1-P6 closeouts repeatedly recorded user-guide outcome `none` because shipped filesystem, playbook, workspace, and toolkit workflows were classified as maintainer/operator-only rather than user-facing Build OS product workflows.

**Why it matters**: Build OS ships a filesystem-based operating system and first-party CLI toolkits. Adopters need simple task-oriented guides for first successful use, configuration choices, expected filesystem outputs, and troubleshooting. Without those guides, the active history understates a documentation gap and future phases can continue to skip user guidance for real product surfaces.

**Recommendation**: Treat shipped operational surfaces as user-facing when they are part of how an adopter uses Build OS. User-guide coverage prompts and closeout checks should explicitly ask what an adopter can do after the phase, and should trigger user-guide work when a phase adds or changes shipped CLI commands, wrappers, playbook workflows, workspace artifacts, adopter configuration, validation commands, expected results, or troubleshooting paths.

**To close**: The reusable user-guide coverage prompt is updated, W1 R0 P1-P6 user-guide remediation creates or updates the missing draft user guides, and the affected history records clearly mark their earlier `none` decisions as superseded by the remediation outcome.

**Resolution**: W1 R0 user-guide remediation created the draft `docs/guides/user/` suite, recorded a P1-P6 coverage matrix, added reciprocal developer-guide links, and marked the earlier P1-P6 user-guide `none` history outcomes as superseded by `docs/assets/history/2026-06-05-w1-r0-user-guide-remediation.md`.

Code anchors:

- `README.md`
- `docs/guides/AGENTS.md`
- `docs/assets/references/guide-contract.md`
- `docs/assets/history/2026-06-04-w1-r0-p1-operating-layer-contracts.md`
- `docs/assets/history/2026-06-04-w1-r0-p2-spaces-boundary-shipping.md`
- `docs/assets/history/2026-06-04-w1-r0-p3-intake-conversion.md`
- `docs/assets/history/2026-06-04-w1-r0-p4-data-layer-extraction.md`
- `docs/assets/history/2026-06-04-w1-r0-p5-playbooks.md`
- `docs/assets/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md`

## Open Questions

### Q-001 Promotion enforcement: convention vs. machinery

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Resolve qualification authority and enforcement before the Phase 2 qualification-migration gate |

**Question**: Who may qualify, promote, revoke, override, or appeal a result, which gates must be deterministic, and which promotion controls must be enforced by the cohesive core rather than remain documented conventions?

**Why it matters**: Qualification determines downstream authority. An incomplete actor, authorization, override, or enforcement contract could let CLI and MCP callers produce different promotion outcomes or make high-cost confirmation work unauditable.

**Recommendation**: Do not select convention or machinery by default. Define the actor and authorization matrix, deterministic gates, human-review boundaries, revocation and appeal transitions, and receipt evidence before choosing the enforcement mechanism for each transition.

**To close**: The Build OS product/architecture owner approves the qualification authority and state-transition contract, with positive and negative fixtures, reviewer identity and authorization evidence, override and revocation audit evidence, repeatability evidence, and measured confirmation-test cost; PRD 19 and the Phase 2 capability-map delta carry the approved result.

**Owner**: Build OS product/architecture owner.

**Phase/gate**: PRD 19 approval identifies the unresolved contract; the decision is required before Phase 2 qualification migration.

**Required evidence**: Positive and negative qualification fixtures, actor/role matrix, authorization-denial cases, override and revocation receipts, appeal handling, repeatability, and confirmation-cost measurements.

**Disposition**: Existing Q-001 reconciles DI-009; it remains an open PRD question and a Phase 2 design decision.

### Q-002 Generalizing instance-specific tag values

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Use adopter-owned config under the operational layer for systems, environments, and owners | Implement the config contract, starter template, and scoped-field migration |

**Question**: How should an adopter configure the vocabulary used to scope artifacts to systems, environments, and accountable owners?

**Why it matters**: Build OS ships as a general-purpose tool; hard-coded adopter, system, or instance values would leak into reusable contracts, playbooks, data records, and generated indexes.

**Decision**: Add an adopter-owned `system/.os/config/instance.yaml` backed by `system/.os/contracts/config-contract.md` and seeded from `system/.os/templates/instance-config.yaml`. Reusable Build OS contracts define field shape and lookup rules; the instance config owns concrete `systems`, `environments`, and `owners` IDs.

**Closure rationale**: The config surface keeps reusable Build OS docs and contracts neutral while still giving each deployed instance a single authoritative place to describe its target systems, operating environments, and ownership model. Replace legacy scoped frontmatter names with `systems`, `environments`, and `owners`; do not continue `env` or `for` as contract vocabulary.

**Recommendation**: Preserve the approved adopter-owned configuration decision and validate later revisions against its neutral reusable-contract boundary.

**To close**: Closed by the approved config contract, starter template, migration requirement, and PRD 13 lineage already recorded above.

**Resolution**: Concrete scope vocabulary belongs in adopter-owned `system/.os/config/instance.yaml`; reusable Build OS contracts own field shape and lookup rules.

Code anchors:

- `system/.os/contracts/playbook-contract.md`
- `system/.os/contracts/config-contract.md` (planned)
- `system/.os/config/instance.yaml` (planned)
- `system/.os/templates/instance-config.yaml` (planned)
- `docs/designs/2026-06-03-adopter-owned-config-surface.md`

### Q-003 Canonical and derived data authority

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Resolve before approving the Phase 1 storage and recovery contract |

**Question**: Which Build OS project and global records are canonical, which indexes, SQLite stores, server caches, and UI projections are strictly derived and rebuildable, and does any proposed exception require a separate authority design?

**Why it matters**: A second undeclared canonical store would make offline recovery, synchronization, conflict ownership, and migration ambiguous.

**Recommendation**: Preserve filesystem-native project files and JSONL as the incumbent authority unless delete-and-rebuild, round-trip, and recovery evidence demonstrates a justified exception that the owner explicitly approves.

**To close**: The Build OS data-contract owner approves an authority map for every initial record class and accepts delete-and-rebuild, round-trip, schema-evolution, and offline-operation evidence; any exception is linked to an approved follow-on design.

**Owner**: Build OS data-contract owner.

**Phase/gate**: Phase 1 storage and recovery contract gate.

**Required evidence**: Record-class authority matrix, derived-state deletion and rebuild, round-trip fixtures, schema evolution, offline operation, and recovery from missing or corrupt derived state.

**Disposition**: DI-001 becomes a Phase 1 PRD open question and follow-on authority decision.

### Q-004 Operation receipt schema and integrity

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Resolve before approving the Phase 1 request, result, and receipt contracts |

**Question**: What path, schema, stable identifiers, append or amendment rules, integrity protection, retention, redaction, and recovery behavior define a durable Build OS operation receipt?

**Why it matters**: CLI/MCP parity, interruption recovery, auditability, and migration cannot be proven if provenance can be silently rewritten or detached from domain evidence.

**Recommendation**: Specify receipts as a versioned Build OS-owned contract linked to requests, plans, affected domain records, verification results, and diagnostics; choose integrity and amendment semantics only after representative failure and redaction tests.

**To close**: The Build OS data-contract and security owners approve the receipt contract and accept interrupted-write, retry, tamper-detection, amendment, redaction, schema-upgrade, and receipt-to-domain linkage evidence.

**Owner**: Build OS data-contract owner with security/privacy review.

**Phase/gate**: Phase 1 request/result/receipt contract gate.

**Required evidence**: Interrupted writes, replay and idempotent retry, tamper cases, redaction-before-persistence, schema upgrade, stable-ID behavior, and domain-evidence linkage.

**Disposition**: DI-002 becomes a Phase 1 PRD open question and follow-on receipt-contract decision.

### Q-005 Optional synchronization and conflict recovery

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | No coordinating server or synchronization contract is approved | Reconcile only at the conditional Phase 4 entry gate before any remote mutation |

**Question**: If local/server synchronization is approved, what base revision, lease, offline mutation, conflict detection, retry, reconciliation, and loss-of-server recovery semantics apply?

**Why it matters**: Multi-client mutation can silently fork or corrupt filesystem authority if the optional server's coordination role and deterministic reject-or-merge behavior are undefined.

**Recommendation**: Keep local operation server-independent and prohibit remote mutation until a named use case, deterministic conflict policy, and full no-server recovery have been approved.

**To close**: The Phase 4 owner approves a synchronization design after concurrent-client, network-partition, stale-lease, offline-retry, deterministic conflict, and server-loss reconstruction tests.

**Owner**: Future coordinating-server owner with the Build OS data-contract owner.

**Phase/gate**: Conditional Phase 4 synchronization gate.

**Required evidence**: Named multi-client workflow, concurrent mutation simulations, network partitions, stale leases, retry behavior, merge-or-reject determinism, and complete reconstruction after server loss.

**Disposition**: DI-003 remains a deferred PRD question, risk input, and follow-on synchronization design decision.

### Q-006 Project identity and relocation

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Resolve before Phase 1 project initialization and root-resolution implementation |

**Question**: How is a Build OS project identified independently of path across move, rename, symlink, copy, clone, duplicate identity, deleted root, and global-registry repair cases?

**Why it matters**: Receipts, global registration, recovery, and optional companion integration require durable project identity without making the original filesystem path permanent.

**Recommendation**: Define a stable project identifier and explicit path-binding and repair transitions; do not infer identity solely from directory shape or current absolute path.

**To close**: The lifecycle owner approves the project identity contract and accepts cross-platform move, rename, symlink, copy, clone, duplicate-ID, missing-root, and corrupt-registry fixtures.

**Owner**: Build OS lifecycle/data-contract owner.

**Phase/gate**: Phase 1 project-resolution and initialization gate.

**Required evidence**: Move, rename, symlink, copy, clone, duplicate-ID, missing-root, relocation receipt, and registry-repair fixtures on the supported platform matrix.

**Disposition**: DI-004 becomes a Phase 1 PRD open question and follow-on identity design decision.

### Q-007 Global settings and project registry authority

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Build OS is system-installed and owns its global settings and project registry; exact storage and recovery contracts remain unsettled | Resolve before Phase 1 project initialization implementation |

**Question**: Where and at what user or system scope do Build OS global settings and project registrations live, and what precedence, backup, restore, corruption recovery, portability, multi-version ownership, and uninstall behavior apply?

**Why it matters**: Durable state outside a project can become an unrecoverable hidden authority or cause multiple installed versions to claim the same projects.

**Recommendation**: Define one versioned Build OS-owned global contract with explicit discovery precedence, atomic updates, repair, backup/restore, and uninstall-with-projects-present behavior; do not copy Make Docs registry state into it.

**To close**: The lifecycle owner approves the contract and accepts multi-user, multi-version, atomic-update, corrupt-registry, portable-restore, and uninstall-with-projects-present evidence.

**Owner**: Build OS lifecycle owner.

**Phase/gate**: Phase 1 global-state and initialization gate.

**Required evidence**: Supported-platform path matrix, user/system precedence, multi-version cases, atomic update, corruption recovery, backup/restore, portability, and uninstall while registered projects remain.

**Disposition**: DI-005 becomes a Phase 1 PRD open question and lifecycle risk input.

### Q-008 Coordinating-server need and topology

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | The server remains optional and later-gated; no topology is selected | Require a measured use case at the Phase 4 entry gate |

**Question**: Is a coordinating server needed, and if so should it be an embedded daemon, user-managed local service, or remote service with defined tenancy, authentication, roles, permissions, service identity, and administrative recovery?

**Why it matters**: Server topology changes lifecycle, offline behavior, data exposure, operating cost, and the authorization context passed into core operations.

**Recommendation**: Do not add a server by default. Select topology only after a named multi-client or remote workflow demonstrates a need that the cohesive local Go program cannot meet, then require a separate security design before shared or remote operation.

**To close**: The product owner accepts measured workflow evidence and no-server degradation behavior; if a server is approved, the security owner also approves the tenancy/authentication/authorization and administrative-recovery design.

**Owner**: Build OS product owner; conditional security owner for shared or remote topology.

**Phase/gate**: Conditional Phase 4 use-case and topology gate.

**Required evidence**: Named workflow, measured latency/reliability need, daemon/service lifecycle proof, offline degradation, threat model, project-isolation tests, role/revocation matrix, credential recovery, audit coverage, and authorization mapping to core operations.

**Disposition**: DI-006 and the conditional decision portion of DI-007 remain deferred PRD questions and follow-on server design gates.

### Q-009 First UI workflow and browser-capture boundary

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | UI technology, first workflow, and browser capture remain separately scoped from the Go core/CLI/MCP selection | Resolve at the Phase 5 entry gate |

**Question**: Which single vertical workflow should the first UI prove, and what explicit-consent, user-selected evidence, published-source, submission, and no-direct-write boundary applies to any browser capture client?

**Why it matters**: A generic UI or broad capture extension could duplicate domain logic, create direct filesystem or qualification authority, and expand privacy scope before value is demonstrated.

**Recommendation**: Select one evidence-backed user task and require UI and browser clients to use adapters into the same core semantics; prohibit browser clients from direct qualification or canonical writes.

**To close**: The Phase 5 owner approves a workflow and capture-boundary design after prototype, accessibility, adapter-parity, consent, source-integrity, privacy, and user-acceptance evidence.

**Owner**: Future Build OS UI product owner with security/privacy review.

**Phase/gate**: Phase 5 UI and optional evidence-client entry gate.

**Required evidence**: User-task research, bounded prototype, accessibility UAT, CLI/MCP/core parity comparison, explicit-consent cases, source-integrity checks, and privacy review.

**Disposition**: DI-010 remains a deferred PRD open question and follow-on UI/browser design decision.

### Q-010 Make Docs public companion contract verification

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | Build OS may use only Make Docs-published setup and lifecycle operations and markers; exact public contracts are not yet verified | Verify against supported published Make Docs releases at the Phase 6 gate |

**Question**: What exact published Make Docs commands, flags, version-selection behavior, markers or registration, and setup, recognition, reconfiguration, repair, and removal operations can Build OS rely on?

**Why it matters**: The approved companion lifecycle cannot safely infer or directly write another product's global or project state.

**Recommendation**: Keep exact command and marker names out of the initial implementation contract until live published-release validation is complete; fail closed when a requested lifecycle action lacks a version-pinnable, machine-verifiable public operation.

**To close**: The Make Docs integration owner accepts a published-release matrix for interactive and noninteractive setup, missing/corrupt state, version mismatch, partial failure, reconfiguration, repair, removal, marker verification, and Build OS integration receipts.

**Owner**: Build OS Make Docs integration owner, with confirmation from Make Docs published authority.

**Phase/gate**: Phase 6 integration-validation gate; the standard-profile acknowledgement and product-boundary requirements remain PRD requirements before then.

**Required evidence**: Supported published-release matrix, exact public operations, marker/registration reads, version selection, failure and recovery cases, removal-both opt-in, and Build OS-owned receipts.

**Disposition**: DI-012 becomes a deferred PRD open question paired with existing risk R-001.

### Q-011 Initial capability-map and PRD approval gate

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Confirming | Phase 1 must approve a complete contract inventory for one Go program containing the headless core, CLI, and MCP server before implementation | Owner review of PRD 19, all mapped capabilities, and the reconciled register; commit/authority promotion remains separate |

**Question**: Does PRD 19 enumerate and disposition every initial capability, CLI/MCP projection, authority and state transition, dependency, compatibility obligation, non-goal, acceptance requirement, open question, and risk without inferring the contract from current directories or commands?

**Why it matters**: The current product is largely directory-driven with a small command surface; implementation against an incomplete inferred map would freeze accidental conventions and omit supported behavior.

**Recommendation**: Treat PRD 19 and this register as a reviewable draft gate, not implementation authority, until the owner approves the complete map and explicitly resolves the uncommitted-design authority/commit boundary.

**To close**: The Build OS product/architecture owner reviews every stable capability ID, confirms each disposition and deferred gate, approves PRD 19 plus the reconciled register, and separately authorizes any authority-promoting commit and implementation phase.

**Owner**: Build OS product/architecture owner.

**Phase/gate**: Phase 1 pre-planning and implementation-entry gate; every later phase performs a delta reconciliation against the approved map.

**Required evidence**: Capability-by-capability review showing core use case, CLI command, MCP tool/resource parity, data authority, state transitions, inputs/outputs, receipts, idempotency, dry-run and error behavior, dependencies, compatibility, non-goals, acceptance evidence, open questions, and risks.

**Disposition**: DI-017 remains a mandatory confirming PRD gate. No implementation authority follows from draft completion or validation.

## Rebuild Risks

### R-001 Make Docs companion public-contract dependency

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Make Docs remains a separately installed external dependency; Build OS must use only its published lifecycle operations and markers | Validate the exact public companion contract at the Phase 6 gate |

**Issue**: Build OS initialization, repair, reconfiguration, and optional combined removal depend on Make Docs behavior that is not yet verified as a version-pinnable, machine-readable public contract; the existing co-owned router preservation concern remains one compatibility case within that broader dependency.

**Why it matters**: Inferring markers, mutating Make Docs state directly, or assuming router preservation could corrupt a companion installation, lose Build OS routing, or falsely report successful standard-profile initialization.

**Recommendation**: Keep Make Docs external, preserve augment-only router behavior, invoke only published operations, verify published postconditions, record Build OS-owned integration receipts, and fail closed where the public contract is absent or incompatible.

**To close**: The integration owner accepts the Phase 6 published-release matrix described by Q-010, including router preservation, exact operations and markers, partial failure, version mismatch, reconfiguration, repair, removal, and receipt behavior.

**Owner**: Build OS Make Docs integration owner.

**Phase/gate**: Phase 6 integration-validation gate; no direct Make Docs writes are permitted in any phase.

**Required evidence**: Exact public-operation and marker matrix, interactive/noninteractive acknowledgement, router preservation, failure recovery, removal-both opt-in, and verified Build OS integration receipts.

**Disposition**: Existing R-001 reconciles DI-012; Q-010 carries the unresolved contract question.

### R-002 Qualification cost

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Deterministic confirmation remains required for promoted findings; actor authority, override, revocation, and cost controls remain unresolved | Validate before the Phase 2 qualification-migration gate |

**Issue**: Every promoted finding requires a deterministic, repeatable confirmation test; at volume, authoring and rerunning that evidence is costly, and an unresolved authority or override workflow could weaken the gate inconsistently.

**Why it matters**: A rebuild that skips qualification to save effort or permits unrecorded overrides would silently weaken verify-to-promote and create CLI/MCP authority differences.

**Recommendation**: Keep deterministic qualification mandatory for promotion, measure its cost, invest in reusable scaffolds, and close Q-001's actor, enforcement, override, revocation, and appeal contract before migration.

**To close**: The product owner accepts positive/negative repeatability evidence, reusable scaffolds, measured confirmation cost, and the Q-001 authority and audit contract.

**Owner**: Build OS qualification-domain owner.

**Phase/gate**: Phase 2 qualification-migration entry and exit gates.

**Required evidence**: Positive/negative fixtures, repeatability, actor authorization, override/revocation receipts, appeal cases, and measured authoring/execution cost.

**Disposition**: Existing R-002 reconciles the cost and workflow-risk portion of DI-009; Q-001 carries the unresolved authority decision.

Code anchors:

- `system/workspace/findings/`

### R-003 Build OS packaging, upgrade, rollback, and removal hardening

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Approved design input selects one cohesive Go program and distribution containing core, CLI, and MCP; exact supported package and lifecycle matrix remains unsettled pending PRD 19 approval | Define and verify package, upgrade, rollback, repair, and removal support at the Phase 7 gate |

**Issue**: Build OS has an incumbent unified-CLI distribution contract and a newer approved design input for a system-installed cohesive Go core/CLI/MCP product with project-local installations, but supported platforms, channels, prerequisites, signing, SBOMs, system/project upgrade ownership, rollback, repair, self-update, orphan handling, and independent or combined removal are not yet verified.

**Why it matters**: A single executable reduces operational surface area but does not prove artifact integrity, installation ownership, project compatibility, upgrade safety, rollback, repair, or removal that leaves Make Docs intact by default.

**Recommendation**: Preserve PRD 18's artifact-integrity requirements where still effective, reconcile its CLI-only lifecycle portions through PRD 19, and select the supported platform/channel and system/project lifecycle matrix only after clean-machine and recoverable-project evidence.

**To close**: The release owner accepts verified artifacts and lifecycle evidence for the approved platform/channel matrix, including checksums, SBOMs, signatures or attestations, compatibility migration, system and project upgrade, rollback, repair, orphan handling, independent Build OS removal, explicit removal-both behavior, uninstall, and clean-machine smoke tests.

**Owner**: Build OS release/lifecycle owner.

**Phase/gate**: Phase 7 distribution and deprecation gate.

**Required evidence**: Supported matrix, artifact verification, clean-machine installation, system/project upgrade, rollback, repair, alias migration, orphaned projects, Build OS-only removal, explicit combined removal through Make Docs public operations, and uninstall.

**Disposition**: Existing R-003 reconciles DI-013 and remains a release-hardening risk; PRD 19 must preserve still-effective PRD 18 integrity requirements while revising lifecycle scope.

Code anchors:

- `toolkits/`
- `docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/`
- `docs/prd/18-revise-unified-buildos-cli-and-distribution.md`

### R-004 Existing toolkit and deployed-project migration compatibility

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | W1 R4's entity slice is validated; no broad migration contract is approved for the legacy intake, discovery, and design toolkits or for deployed projects | Freeze parity fixtures, define the compatibility matrix, and rehearse each domain migration before Phase 2 approval |

**Issue**: The entity resolver demonstrates one source-built migration seam, but the current legacy intake, discovery, and design executables, their wrappers, filesystem effects, schemas, outputs, exit behavior, and deployed-project recovery cases have not been frozen as a complete compatibility contract.

**Why it matters**: Migrating only command names or handlers can change canonical files, diagnostics, or recovery behavior and expose installed roots to mixed contract/tooling versions even when the entity slice remains compatible.

**Recommendation**: Preserve the entity compatibility evidence, freeze golden behavior for each legacy toolkit and the unified seed, migrate read-only operations before mutations, keep bounded aliases, rehearse copied-root upgrade and rollback, and require separate approval before any live-data migration or legacy removal.

**To close**: The product owner accepts a domain-by-domain compatibility matrix, golden fixtures, CLI/MCP parity, schema and output compatibility, failure injection, alias duration, copied-root upgrade/rollback, installed-root rehearsal, and audited live-migration evidence; no legacy surface is removed before that evidence and a separate authorization.

**Owner**: Build OS migration owner with each legacy domain owner.

**Phase/gate**: Phase 2 entry and per-domain exit gates; deployed-project mutation remains separately authorized.

**Required evidence**: Golden fixtures for intake, discovery, design, and entity operations; filesystem effects; JSON/text outputs; exit behavior; MCP parity; failure injection; copied-root migration and rollback; alias expiry criteria; and deployed-instance evidence.

**Disposition**: Existing R-004 reconciles DI-011 and retains the deployed-entity compatibility obligations established by PRD 17 and PRD 18.

Code anchors:

- [Entity consolidation and canonical resolution design](../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [PRD 17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md)
- [W1 R4 entity consolidation and canonical resolution plan](../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md)
- [Entity records contract](../../system/.os/contracts/entity-records-contract.md)

### R-005 Cross-file transaction, locking, and interruption recovery

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Per-file atomic replacement is incumbent evidence; the multi-file transaction and locking unit is not yet defined | Resolve before approving any Phase 1 mutation capability |

**Issue**: A domain operation may affect canonical JSONL, receipts, and derived indexes, while current evidence demonstrates per-file atomic replacement rather than a complete cross-file transaction, lock, or stale-lock recovery contract.

**Why it matters**: Concurrent CLI and MCP invocations or a crash between writes can leave internally inconsistent canonical state, receipts, and projections.

**Recommendation**: Define the smallest authoritative transaction unit, lock ownership and expiry, write ordering, rollback or roll-forward recovery, derived-state rebuild, and idempotent retry before enabling mutations through both transports.

**To close**: The core/data owner accepts crash-after-each-step, concurrent CLI/MCP, stale-lock, retry, partial-receipt, rollback/roll-forward, and derived-rebuild evidence for every Phase 1 mutation class.

**Owner**: Build OS core/data-contract owner.

**Phase/gate**: Phase 1 mutation and recovery gate.

**Required evidence**: Failure injection after every write step, cross-process concurrency, stale locks, idempotent retries, canonical/receipt consistency, rollback or roll-forward, and rebuild of all derived state.

**Disposition**: DI-016 becomes a distinct Phase 1 rebuild risk and follow-on transaction/locking design decision.

### R-006 Request, result, receipt, and MCP schema compatibility

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | CLI and MCP must share one release and equivalent domain semantics; version-skew behavior is not yet defined | Define compatibility rules at Phase 1 and complete protocol validation at Phase 3 |

**Issue**: Versioned projects and external MCP clients may encounter old/new requests, results, diagnostics, receipts, capability discovery, unknown fields, downgrade, or partial-upgrade states even though CLI and MCP ship in one program.

**Why it matters**: Unspecified schema skew can turn a safe read into misinterpretation or make a mutation unrecoverable across upgrade and rollback.

**Recommendation**: Version shared schemas explicitly, define unknown-field and downgrade behavior, fail closed on unsafe mutation skew, and expose capability negotiation without creating a second MCP-only domain contract.

**To close**: The core/MCP owner accepts old/new fixture matrices, forward/backward compatibility, unknown-field behavior, request/result/diagnostic/receipt alignment, capability negotiation, downgrade, and partial-upgrade recovery.

**Owner**: Build OS core/MCP contract owner.

**Phase/gate**: Phase 1 shared-schema gate and Phase 3 MCP protocol-completion gate.

**Required evidence**: Old/new schema matrix, unknown fields, safe read and fail-closed mutation behavior, downgrade, partial upgrade, capability discovery/negotiation, and CLI/MCP result equivalence.

**Disposition**: DI-015 becomes a distinct compatibility risk and follow-on schema/protocol design decision.

### R-007 Evidence privacy, retention, redaction, and deletion

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | No complete classification, retention, redaction, or deletion policy is approved | Define core provenance policy in Phase 1 and extend it before Phase 5 browser capture |

**Issue**: Build OS can persist confidential source material, local paths, identities, subprocess output, receipts, and potentially browser-selected content without a settled classification, consent, retention, export, redaction, or verified-deletion contract.

**Why it matters**: Durable provenance can unintentionally retain secrets or identifying context, and post-persistence redaction may not remove data from receipts, derived indexes, backups, or exports.

**Recommendation**: Classify evidence and receipt fields, minimize identity and path data, redact before persistence, make retention/deletion/export behavior explicit, and prohibit browser capture until its stricter consent and source-integrity policy is approved.

**To close**: The security/privacy owner accepts a threat model plus secret-bearing, pre-persistence redaction, retention expiry, verified deletion, derived-state rebuild, backup/export review, and browser-consent evidence.

**Owner**: Build OS security/privacy owner with the data-contract owner.

**Phase/gate**: Phase 1 provenance/privacy gate and Phase 5 browser-capture extension gate.

**Required evidence**: Data classification, threat model, secret fixtures, redaction before persistence, receipt/index cleanup, retention expiry, verified deletion, backup/export handling, identity/path minimization, and explicit capture consent.

**Disposition**: DI-008 becomes a distinct privacy and retention risk with Phase 1 and Phase 5 follow-on design gates.

### R-008 Conditional server tenancy, authentication, and authorization

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | No shared or remote server is approved | Activate only if Q-008 approves a shared or remote Phase 4 topology |

**Issue**: A future coordinating server could expose evidence or mutation authority without defined tenant isolation, authentication, project roles, permissions, service identity, revocation, audit, and administrative recovery.

**Why it matters**: A transport adapter must not broaden core authorization or permit cross-project evidence access merely because it runs remotely.

**Recommendation**: Keep this risk deferred while no server exists; if Q-008 approves a shared or remote topology, require threat modeling and permission-to-core-authorization mapping before any evidence access or mutation.

**To close**: If activated, the security owner accepts tenant-isolation tests, cross-project denials, role/revocation matrix, credential and administrative recovery, audit completeness, service identity, and core-authorization propagation.

**Owner**: Conditional coordinating-server security owner.

**Phase/gate**: Conditional Phase 4 security gate after Q-008 topology approval.

**Required evidence**: Threat model, tenant/project isolation, authentication lifecycle, roles and permissions, service identity, revocation, audit, credential recovery, administrative recovery, and authorization propagation to core operations.

**Disposition**: The security-risk portion of DI-007 becomes a distinct deferred risk; it does not authorize or require a server.

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-07-21-entity-consolidation-and-canonical-resolution.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md`
- `docs/designs/2026-08-14-build-os-runtime-selection-proof.md`
- `docs/prd/19-revise-build-os-headless-core-cli-and-mcp-program.md`
- `docs/assets/references/output-contract.md`
- `docs/assets/references/guide-contract.md`
- `README.md`
