# Build OS Product Boundary and Headless Operating Model

## Purpose

This assessment defines the intended product boundary and target operating model for Build OS. It reconciles the current filesystem-native evidence system with one cohesive Go program, product package, and distribution containing the headless core, CLI, and MCP server, while keeping an optional coordinating server and UI as separately scoped surfaces. It also replaces the implied ownership relationship between Build OS and Make Docs with an optional external companion-install contract.

This document is design authority only. It does not authorize implementation, changes to existing toolkits, changes to Make Docs-managed trees, backlog revision, release work, publication, or deployment.

The evidence labels used below are normative:

- **Established current evidence** describes behavior or authority verified in the current repository.
- **Confirmed design decision** describes target behavior explicitly accepted for this design record.
- **Design recommendation** describes the intended target or a proposed program boundary.
- **Unverified assumption** identifies a dependency that must be confirmed before planning or implementation.

## Context

### Established Current Evidence

The [repository overview](../../README.md) defines Build OS as a filesystem-based, agent-operable system for converting source material, running discovery playbooks, qualifying findings, and handing qualified evidence into design and planning workflows. The [Build OS architecture](./2026-06-03-build-os-architecture.md) makes files the durable authority, keeps structured entity records in JSONL, keeps run evidence in immutable run directories, and places lifecycle contracts under `system/.os/contracts/`.

The current lifecycle is already broader than a command-line utility:

1. Intake converts supported sources into faithful twins and indexes them.
2. Extraction produces candidate requirements, capabilities, personas, tests, findings, and references with source anchors.
3. Discovery creates immutable run records and raw evidence.
4. Qualification promotes sufficiently supported raw findings into durable qualified findings.
5. Entity operations resolve, validate, consolidate, and index canonical structured records.
6. Design promotion hands selected qualified evidence into the documentation workflow.

The repository currently contains three legacy domain toolkits for intake, discovery, and design, plus a seeded unified `toolkits/buildos/` Go module. The unified module currently provides shared CLI plumbing and entity operations, while the legacy modules remain the current implementation for the other domains.

The current data and lifecycle contracts establish several durable invariants:

- `.os/data/*.jsonl` stores canonical structured records with stable IDs, source anchors, document anchors, relationships, timestamps, lifecycle status, and redirect semantics.
- Converted twins record source identity, source hashes, converter identity and version, conversion time, and conversion status.
- Extraction outcomes retain event-time provenance and resolve through redirect chains without rewriting historical source events.
- Each discovery run retains its immutable run declaration, evidence, and raw findings after closure or abortion.
- A qualified finding retains both the finding and the qualification evidence used to promote it.
- Promotion from evidence into design remains user-gated.

The checked-in `.make-docs/manifest.json` and `system/.make-docs/manifest.json` identify `make-docs` and record an installed package version, profile, capabilities, and harness selections. Those manifests provide current evidence that a Make Docs-managed workspace can expose machine-readable identity and version metadata. They do not, by themselves, establish a stable public installer, update, uninstall, or compatibility contract.

### Capability Inventory

| Capability | Current location and status | Assessment |
| --- | --- | --- |
| Source conversion and intake indexing | `toolkits/buildos-intake/` | Established behavior to preserve behind the future core. |
| Discovery run creation and evidence capture | `toolkits/buildos-discovery/` | Established behavior to preserve, including immutable run evidence. |
| Finding qualification | `toolkits/buildos-discovery/` | Established behavior to preserve with deterministic qualification and user-gated promotion. |
| Design handoff | `toolkits/buildos-design/` | Established boundary to retain, but its relationship to Make Docs must become explicitly external. |
| Entity resolution, validation, consolidation, and indexing | `toolkits/buildos/` | Established unified-module seed and the strongest current example of shared domain behavior. |
| Shared CLI root, help, version, output, diagnostics, and exit behavior | `toolkits/buildos/` and W1 R5 authority | Partially established; useful as an adapter contract, not sufficient as the application-core boundary. |
| Cross-domain application core | Not present as an explicit boundary | Design recommendation; must own use cases independently of every transport. |
| Durable operation plans and receipts | Not established as a cross-domain contract | Design recommendation; existing entity and evidence provenance is necessary but does not yet describe every mutation or external invocation. |
| MCP server | No implemented repository authority found | Confirmed built-in surface of the cohesive Go program and distribution; it must mirror the CLI operation surface over MCP through internal adapter boundaries. |
| Optional coordinating server | No implemented repository authority found | Distinct, decision-gated future workstream. |
| App UI | No implemented repository authority found | Distinct future client workstream. |
| Browser extension or browser evidence client | No implemented repository authority found | Optional client only; not part of the core or an initial requirement. |
| Make Docs recognition and companion installation | Manifests are present; a Build OS-owned external companion contract is not | Distinct integration workstream that depends on Make Docs' published interface. |

**Established current evidence:** the indexed command surface is narrow: the unified `buildos` seed currently exposes help, version, and entity operations; the intake toolkit exposes conversion and index operations; the discovery toolkit exposes run and qualification operations; and the design toolkit exposes finding promotion. Many other lifecycle expectations are expressed through shipped directories, routers, contracts, templates, and manual workflow conventions. This inventory is therefore evidence for a complete capability-map pass, not permission to infer the future core, CLI, or MCP contract from directory names or the current command count.

### Existing W1 R5 and P5 Assessment

The [unified CLI design](./2026-07-21-unified-buildos-cli-and-distribution.md), [PRD 18](../prd/18-revise-unified-buildos-cli-and-distribution.md), and [W1 R5 change plan](../plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md) establish a useful but narrower program. The current W1 R5 backlog remains unchecked and the repository remains at the W1 R4 unified-module seed plus legacy domain implementations.

| W1 R5 area | Disposition | Rationale |
| --- | --- | --- |
| One canonical `buildos` executable | Retain | A stable CLI remains the reference human and automation adapter. |
| Shared root discovery, output envelopes, diagnostics, exit semantics, help, and version | Retain and generalize | These contracts should project transport-neutral core results rather than define core behavior inside the CLI layer. |
| Coherent intake, discovery, design, and entity domains | Retain | The domain partition remains useful for both internal organization and public tools. |
| In-process Go composition instead of subprocess chaining between Build OS domains | Retain | Domain use cases should share a core without shelling through sibling commands. |
| Behavior-parity gates before legacy deletion | Retain | Migration must preserve files, evidence, diagnostics, exit behavior, and recovery semantics. |
| Legacy aliases for a bounded compatibility window | Retain | Existing users need a reversible transition. |
| CLI-first internal signatures | Revise | Core request, plan, result, diagnostic, and receipt contracts must be transport-neutral before CLI signatures are frozen. |
| P2 direct domain migration into command handlers | Revise | Existing logic should move behind application-core use cases, with command handlers reduced to adapters. |
| P3 installation migration | Split | Build OS distribution and Make Docs companion installation have different ownership, supply-chain, and lifecycle contracts. |
| P4 packaging and release hardening | Retain later | Packaging remains necessary after core and adapter contracts stabilize; release and publication remain separate approvals. |
| P5 documentation, deprecation, and W2 lifecycle handoff | Revise and expand | The headless core, provenance, adapter, and external-dependency decisions must be made before closeout rather than deferred entirely to P5. |
| MCP server | Bring into the cohesive Go program and distribution | MCP is a required agent-facing projection of the same operation map as the CLI, not a separate product, separately installed executable, or incidental follow-on. |
| Optional coordinating server, UI, browser evidence client, and Make Docs companion integration | Move to distinct program workstreams | These surfaces have independent gates and remain separately scoped from the required core, CLI, and MCP distribution. |

### Product-Boundary Conflict

The [Make Docs import strategy](./2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md) explored a tighter relationship in which Make Docs would gain Build OS-specific installation behavior and Build OS would import upstream Make Docs asset changes. That direction blurs product ownership and creates avoidable coupling between release cycles.

The target relationship is instead asymmetric and explicit:

- Build OS owns evidence intake, discovery, qualification, canonical entities, provenance, and the handoff boundary.
- Make Docs owns its documentation capabilities, templates, routers, contracts, installer, upgrades, and uninstall behavior.
- Build OS may coordinate an optional Make Docs installation, but does not become a distribution channel for Make Docs internals.

## Decision

### Product Boundary

**Design recommendation:** Build OS is a filesystem-native, agent-operable evidence, discovery, and qualification system. Its durable product value is the evidence graph and lifecycle recorded in a project workspace, not any single process, protocol, UI, or database.

**Confirmed design decision:** Build OS is distributed as a system-installed product and owns its global settings and registry. Build OS project initialization creates a project-local Build OS installation and registration whose durable state remains filesystem-native.

**Confirmed architecture decision:** the Build OS product is one cohesive Go program, product package, installed executable, and distribution containing the headless core, CLI, and MCP server. Those three are internal architectural surfaces of one product, not separate products or separately installed executables.

Build OS owns:

- workspace discovery and root resolution for Build OS data;
- faithful source conversion and intake indexes;
- extraction events and their source provenance;
- discovery playbooks, runs, evidence, and raw findings;
- deterministic qualification and qualified findings;
- canonical entity identity, redirects, validation, consolidation, and derived indexes;
- transport-neutral inspection, planning, application, verification, diagnostics, and operation receipts;
- explicit handoff records to external downstream products.

Make Docs remains a separate product and external dependency. Build OS may recognize a Make Docs workspace and may optionally invoke Make Docs' own published installer flow, but it must not bundle, copy, fork, modify, or claim ownership of Make Docs internals.

Build OS may record which configured Make Docs system dependency and project integration it uses, but it must never directly write Make Docs global state, registration, project markers, configuration, or other project internals.

Build OS must remain useful when Make Docs is absent. In that state, evidence, discovery, qualification, and export remain available, while Make Docs-specific handoff or initialization returns a clear capability-unavailable diagnostic and an inspectable plan for the optional next step.

The existing checked-in Make Docs-managed trees are current repository dependencies and compatibility evidence. This design does not authorize their removal or rewrite.

### Target Operating Model

**Confirmed architecture decision:** the CLI and MCP server are built-in adapters within the same cohesive Go program and call a shared headless application core. Only that core may apply Build OS domain rules or perform authoritative Build OS workspace mutations. The optional coordinating server and UI remain separately scoped surfaces and, if approved later, must call the same core contracts through explicit adapters.

Every operation follows the same conceptual sequence:

1. **Resolve:** identify the target workspace, active contracts, configuration, capabilities, and dependency state.
2. **Inspect:** read canonical records and evidence without mutation.
3. **Plan:** produce a deterministic, serializable description of intended writes, external actions, preconditions, and diagnostics.
4. **Authorize:** obtain the approval required for mutations, network activity, external installers, or destructive transitions.
5. **Apply:** execute the approved plan through the headless core with concurrency and integrity guards.
6. **Verify:** re-read durable state and compare it with the plan's postconditions.
7. **Record:** append a durable receipt that links the request, authorization, effects, result, and evidence.

Read-only operations may end after inspect and return a result without a mutation receipt. Mutating and external operations must not bypass plan, authorization, verification, and recording.

The headless core exposes versioned application use cases, typed requests, plans, results, diagnostics, and receipts. It does not depend on CLI parsing, MCP schemas, HTTP concepts, UI state, or a long-running server. This internal dependency boundary does not make the headless core a separately installed program: the core, CLI, and MCP server ship together in one Go executable and distribution.

The MCP server mirrors the CLI domain-operation surface over MCP. Both adapters map directly to the same core requests and results; the MCP server must not shell through the CLI, and the CLI must not shell through the MCP server. Transport-only discovery, progress, cancellation, or presentation capabilities may differ only when the capability map explicitly identifies them and they do not create an alternate domain operation or write path.

### Durable Local-First Provenance Model

**Established current evidence:** Build OS already records domain provenance for converted sources, extraction events, run evidence, findings, qualification, entity redirects, and canonical records.

**Design recommendation:** add a cross-domain operation-provenance contract without replacing those domain authorities. The exact filesystem path and encoding are planning decisions, but the record must remain local, inspectable, append-oriented, recoverable, and usable without a server.

Each applied mutation or external action records at least:

- operation schema version, operation ID, operation kind, status, and timestamps;
- actor or agent identity when available, client identity, and transport identity;
- Build OS version and build revision;
- resolved workspace root and relevant contract versions;
- request digest, referenced input IDs or source anchors, and plan digest;
- authorization evidence appropriate to the invoking environment;
- affected paths and canonical entity IDs;
- before and after content hashes for managed writes when safe and applicable;
- verification results, diagnostics, recovery guidance, and final disposition;
- external package specification, selected version, observed version, command outcome, and redacted process diagnostics for companion operations;
- links to domain evidence rather than duplicated evidence bodies.

Operation records must not silently rewrite prior receipts. Interrupted or failed operations append their disposition and recovery information while preserving the earlier evidence. Writes must use atomic replacement, locks or optimistic concurrency, and precondition checks appropriate to the affected contract. Secrets, credentials, unrestricted environment dumps, and sensitive process output must not be persisted.

A coordinating server may maintain caches or ephemeral job state, but those records are not the canonical Build OS workspace and must be reconstructible from durable local files.

### Delivery-Surface Roles

| Surface | Intended role | Boundary |
| --- | --- | --- |
| Headless application core | Internal Go packages implementing domain use cases, validation, planning, mutation, verification, and receipts | The only layer allowed to own Build OS business rules and authoritative writes; it is not a separately installed product. |
| CLI | Built-in interface for people, scripts, CI, recovery, and local automation | Parses flags and renders core requests/results inside the installed `buildos` executable; it does not become a second domain implementation. |
| MCP server | Built-in agent-facing projection of the complete CLI domain-operation surface over MCP | Runs from the same installed `buildos` executable, maps MCP schemas and authorization context directly to the same core use cases, and does not shell through the CLI. |
| Optional coordinating server | Provides multi-client coordination, job lifecycle, subscriptions, caching, or remote access when a demonstrated use case requires them | Optional and later-gated; it must not become required for local operation or replace filesystem authority with a private canonical database. |
| App UI | Visualizes workspace state, evidence, plans, diagnostics, approvals, and operation history | Calls the core directly in-process or through an adapter; it does not write Build OS files itself. |
| Browser extension or evidence client | Captures user-selected browser evidence and submits a provenance-bearing request | Optional client; it owns no qualification logic, canonical state, or direct filesystem authority. |

Equivalent operations must have equivalent domain semantics across CLI, MCP, server, and UI. Presentation, streaming, pagination, and interactive approval may differ, but core postconditions and durable receipts must not. The required core, CLI, and MCP server share one Go program, version, installation, upgrade, removal, and distribution lifecycle; the UI and optional coordinating server remain separately scoped surfaces.

### Optional Make Docs Companion-Install Contract

**Confirmed design decision:** the standard Build OS project profile includes a Make Docs companion lifecycle while preserving separate product ownership.

Build OS has two scopes of installation authority:

- The system-installed Build OS product owns its executable or runtime, global settings, dependency selections, Build OS project registry, and defaults.
- A project-local Build OS installation owns that project's Build OS identity, configuration, evidence state, and integration receipts.

The Build OS global registry may identify the configured Make Docs system dependency and known Build OS projects, but it is not a Make Docs registry and must not duplicate or mutate Make Docs-owned global or project state.

**Design recommendation:** Build OS supports an optional companion state machine with at least these states:

- `absent`;
- `recognized`;
- `version-mismatch`;
- `install-planned`;
- `install-complete`;
- `install-failed`.

Recognition must use Make Docs-published, machine-readable markers rather than heuristic inspection of copied content. The current manifests demonstrate a plausible marker shape, but the supported marker contract must be confirmed with Make Docs authority.

Standard-profile project initialization must follow these rules:

1. Build OS resolves the target project, existing project-local Build OS state, configured Make Docs system dependency and selected version, existing Make Docs project state, requested capabilities, and compatibility constraints.
2. In an interactive flow, Build OS explicitly informs the user that the standard profile will ensure or use the configured Make Docs system dependency, invoke Make Docs' own public setup operation in the project, verify Make Docs-published project markers or registration, and record a Build OS integration receipt.
3. In a noninteractive flow, Build OS requires an explicit project profile or flag that acknowledges the Make Docs companion operation; selecting an unrelated noninteractive default must not silently authorize it.
4. Build OS creates an inspectable plan that separates project-local Build OS writes from the published Make Docs operation and names the Make Docs dependency selection, exact version, working directory, expected published markers, network requirement, and approval basis.
5. After authorization, Build OS creates or updates only the project-local Build OS installation through Build OS-owned contracts.
6. Build OS ensures the configured Make Docs system dependency is available only through Make Docs-published or package-manager interfaces, then invokes Make Docs' own public setup operation in the project.
7. Build OS does not embed the Make Docs installer, reproduce its templates, patch its output, or directly write Make Docs global state, registration, project markers, configuration, or other project internals.
8. Build OS re-reads Make Docs' published project markers or registration after the public operation exits and compares the observed state with the selected dependency and planned postconditions.
9. Build OS records a project-local integration receipt under Build OS authority containing the selected dependency identity and version, observed version when published, Build OS project identity, Make Docs operation kind, verification result, final result, and completion time.
10. A failed public operation or selected-versus-observed mismatch records a failed or incomplete receipt, preserves recovery diagnostics, and does not claim that the standard project profile initialized successfully.

Companion reconfiguration, repair, and removal must call Make Docs' corresponding public operations and verify their published postconditions. Removing a project-local or system-installed Build OS product leaves the Make Docs system dependency and Make Docs project installation intact by default. Build OS may coordinate removal of both products only when the user explicitly requests both, and the Make Docs portion must still run through Make Docs' public removal operation.

The exact public commands, flags, version-selection semantics, project markers or registration, and setup, reconfiguration, repair, and removal contracts remain an integration-validation gate. If Make Docs does not provide version-pinnable, machine-verifiable public operations for a requested lifecycle action, Build OS must fail closed and provide user guidance rather than approximating the contract or writing Make Docs-owned state.

### Technology and Runtime Selection

#### Established Runtime Baseline

**Established current evidence:** the repository contains four Go 1.24.1 toolkit modules and 49 indexed Go source files. The unified module already implements command parsing, JSONL-backed entity behavior, per-file atomic replacement, and injected-failure tests, while the legacy modules remain the current behavior and parity oracle. The indexed code does not yet implement SQLite-backed state or Make Docs subprocess orchestration. The current unified CLI and deployment designs selected Go, one executable, signed cross-platform archives, and a standard-library-first policy, but those selections predate the headless-core, MCP, optional-server, UI, and external-companion boundary in this design.

**Confirmed architecture decision:** the completed Phase 0.5 proof selected Go for the Build OS headless core, CLI, and MCP server. Go is the current architecture selection because it satisfied the representative proof and preserves the lowest demonstrated migration cost from the existing modules. This is a current evidence-based selection, not an irreversible guarantee that Go must remain the language regardless of future product evidence.

#### Comparative Assessment

The following assessment records the comparison frame used by the completed Phase 0.5 proof and identifies broader release evidence that may still belong to later gates. Official references confirm that [Go can target multiple operating-system and architecture combinations](https://go.dev/doc/install/source#environment), [Cargo accepts explicit compilation targets](https://doc.rust-lang.org/cargo/commands/cargo-build.html), and the [official MCP SDK program](https://modelcontextprotocol.io/docs/2026-07-28/sdk) currently classifies TypeScript and Go as Tier 1 and Rust as Tier 2 while supporting local and remote transports across all three. Node.js offers a [single-executable facility](https://nodejs.org/api/single-executable-applications.html), but its current documentation labels the facility active development and documents platform and native-addon constraints; the Node 24 [`node:sqlite` API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html) is also still release candidate rather than stable. These platform capabilities supported the comparison but did not substitute for the completed Build OS-specific proof.

| Target need | Go incumbent | Node.js / TypeScript challenger | Rust challenger | Gate and follow-on evidence |
| --- | --- | --- | --- | --- |
| Portable single or bundled delivery | Native executable and existing repository release intent provide the shortest path from current code. | npm and `npx` provide familiar managed-runtime delivery; Node single-executable applications may bundle delivery but are not yet a stable, unrestricted replacement for a runtime. | Native executable and explicit Cargo targets support a small runtime footprint, subject to linker and platform-build complexity. | Clean-machine artifacts, signing, compressed size, startup, and support-matrix proof for each candidate. |
| Filesystem and subprocess behavior | Current JSONL and atomic-file code is reusable; Make Docs process invocation is straightforward but unimplemented. | Filesystem, streams, and child-process APIs fit the workload and align directly with an `npx` companion flow. | Strong filesystem, process, serialization, and error-handling libraries fit the workload, with no repository implementation to reuse. | Identical crash, concurrent-write, path, signal, subprocess, and redaction fixtures. |
| JSONL, SQLite, and provenance operations | Current JSONL behavior exists; SQLite would add a dependency and may only be introduced after its authority is decided. | JSONL is natural; built-in `node:sqlite` maturity or a third-party/native dependency must be evaluated before relying on SQLite. | Serialization is strong; SQLite crate, linking, migration, and update choices add a new dependency decision. | Golden JSONL results, disposable derived-index rebuild, transaction recovery, schema evolution, and dependency review. |
| MCP, optional server, and adapter integration | Official Tier 1 MCP support and mature HTTP libraries make the shared-core model viable. | Official Tier 1 MCP support and the broadest web/server ecosystem reduce adapter friction and may permit schema tooling reuse. | Official Tier 2 MCP support is viable but carries less formal support commitment today; server integration requires more repository-new code. | One read-only MCP tool over the same core request/result contract and one transport-independent test suite. |
| Make Docs Node ecosystem compatibility | Public-operation subprocess isolation preserves the product boundary but requires cross-ecosystem packaging and diagnostics. | Direct npm and `npx` ecosystem alignment simplifies dependency resolution and subprocess testing, but must not become access to Make Docs internals. | Public-operation subprocess isolation preserves the boundary with cross-ecosystem packaging comparable to Go. | Version-pinned public-operation stub, exit and signal handling, published-marker verification, and redacted receipt parity. |
| Operational footprint | Expected low runtime footprint and small dependency graph, but the built-in MCP implementation and any SQLite dependency still require release-level measurement. | Managed runtime and dependency-tree footprint may be larger; bundling can reduce prerequisites while increasing artifact and update complexity. | Expected low runtime footprint and memory safety, but compile and native-dependency costs must be measured. | Cold-start percentiles, peak resident memory, artifact sizes, transitive dependency counts, and update cadence. |
| Cross-platform packaging | Existing design and Go target support reduce migration risk, but repository release automation is incomplete. | npm delivery is broad; zero-prerequisite binaries, native add-ons, code signing, and Node runtime ownership require proof. | Cargo targets are broad; cross-linking, system libraries, code signing, and release-host requirements require proof. | macOS arm64 and x64, Linux x64, and Windows x64 build, install, upgrade, rollback, and uninstall evidence. |
| Contribution and maintenance cost | Lowest expected cost because current behavior, tests, and contributor workflow are Go-based. | Repository has no Node product implementation; TypeScript may broaden web contributors but creates a rewrite and dependency-maintenance cost. | Repository has no Rust implementation; language and build expertise would be a new maintenance requirement. | Time-boxed implementation effort, review burden, build reproducibility, contributor readiness, and long-term ownership assessment. |
| Migration cost from current modules | Lowest because established code can move behind application seams incrementally. | High because all current toolkit behavior must be ported or bridged without creating a two-language canonical core. | High because all current toolkit behavior must be ported or bridged without creating a two-language canonical core. | Parity scope, bridge lifetime, rollback path, and measured effort for the representative slice. |
| Testability and recovery proof | Existing Go tests and injected-failure seams are reusable. | Strong unit and integration tooling; packaged-runtime and single-executable behavior need separate tests. | Strong type and test tooling; compile time and platform-specific failure injection need evaluation. | Deterministic golden fixtures plus crash-after-each-write-step and concurrent-invocation tests in packaged artifacts. |
| Security and update surface | Native binary and current small dependency set reduce runtime surface; MCP, SQLite, and updater dependencies still require review. | Runtime, npm dependencies, bundling, and native modules expand update and supply-chain decisions, offset by mature ecosystem tooling. | Memory safety reduces some defect classes; crates, unsafe or native code, compiler cadence, and supply chain remain material. | SBOM, license and vulnerability scan, dependency provenance, patch/update procedure, and supported-version policy. |

#### Selected Runtime and Re-evaluation Gate

**Confirmed architecture decision:** Go is selected for the Build OS headless core, CLI, and MCP server. They form one cohesive Go program, product package, installed executable, and distribution. Internal Go package boundaries must keep the headless core independent of CLI parsing and MCP schemas, while built-in CLI and MCP modes call the same core operations directly. The MCP server is not a second executable, optional plugin, separately installed package, or shell wrapper around the CLI.

The completed [Phase 0.5 runtime-selection proof](./2026-08-14-build-os-runtime-selection-proof.md) compared one bounded, non-production representative core-and-CLI operation in Go, Node.js with TypeScript, and Rust. All candidates initialized disposable project-local state, validated and byte-preserved a JSONL fixture, derived SHA-256 provenance, produced deterministic output, invoked a harmless Make Docs setup stub, verified its marker, recorded a terminal failure, retried to success, and replayed idempotently. All twelve semantic checks passed. The proof also captured 20-run fresh-process and replay timing, sampled resident memory, artifact size, dependency assumptions, clean build or check duration, available cross-build results, source size, and migration implications.

Go was selected on demonstrated lifecycle and migration cost rather than a single isolated benchmark, resolving DI-014 and retaining Go authority with the expanded core, CLI, and MCP scope defined here. The proof itself did not exercise MCP transport or server behavior, a real Make Docs invocation, Windows execution, clean-machine installation, signing, SBOM or vulnerability scans, static TypeScript checking, concurrent writers, crash injection at every durable-write boundary, 10,000-record or SQLite-derived-index work, or signal handling. Applying the selected Go runtime to the built-in MCP mode is an architecture decision in this design; Phase 1 capability reconciliation and Phase 3 protocol-parity evidence must validate that surface before it is treated as implemented or qualified.

Go may be re-evaluated only when material evidence changes the decision basis: an approved platform or packaging requirement cannot be met; the required CLI and MCP operation parity cannot be sustained safely; security, update, performance, or operational-footprint evidence breaches an accepted threshold; maintenance or contribution cost becomes unsustainable; or an approved product requirement cannot be expressed through the internal adapter boundary. Re-evaluation requires a new representative proof, an explicit design-authority update, migration and rollback evidence, and user approval. A trigger does not authorize a mixed-language split or rewrite by itself.

#### UI Technology Remains Separate

The Go selection for the core, CLI, and MCP server does not select an app UI, browser-extension technology, or optional coordinating-server runtime. Phase 5 must choose UI delivery based on the first approved workflow, accessibility, operating-system support, sandbox and update behavior, privacy, and the versioned adapter boundary. A TypeScript web UI may call the Go core through an approved adapter; potential type sharing does not move canonical rules out of the Go core. The optional coordinating server may use Go for operational simplicity, but it remains a separately justified surface and is not part of the required cohesive distribution unless a later approved design explicitly changes that boundary.

### Migration Strategy from Existing Toolkits

**Design recommendation:** migrate by extracting application-core seams from established behavior, not by copying command handlers into a new transport package.

The migration order is:

1. Freeze current filesystem effects, outputs, diagnostics, exit behavior, and recovery cases in parity fixtures.
2. Define transport-neutral request, plan, result, diagnostic, and receipt contracts for one bounded use case, plus its CLI command and MCP tool or resource mappings.
3. Place existing domain logic behind that use case while preserving its current files and lifecycle invariants.
4. Make the built-in CLI and MCP server call the same core use case, prove CLI parity against the legacy executable, and prove CLI-to-MCP operation parity.
5. Migrate read-only operations before mutations, then migrate mutations through plan, authorization, apply, verify, and receipt behavior.
6. Repeat by domain, keeping intake, discovery, design handoff, and entity ownership coherent.
7. Complete MCP protocol discovery, schema, progress, cancellation, and diagnostic behavior after the relevant core operations are stable; add optional UI or coordinating-server adapters only through their later gates.
8. Retain legacy executables or aliases through a bounded compatibility window and remove them only after parity, upgrade, rollback, and release evidence is accepted.

The existing entity implementation is the preferred first seam because it already lives in the unified module and exercises canonical resolution and mutation. No existing toolkit should be deleted, behaviorally changed, or repackaged merely to prove the design.

The Make Docs boundary migration is separate from Build OS domain migration. Any future cleanup of checked-in Make Docs-managed assets requires its own compatibility inventory, transition plan, and user approval.

### Decision Inventory for PRD Reconciliation

**Established current evidence:** the current architecture makes structured project files and JSONL records authoritative and excludes SQLite; current toolkit mutations provide per-file atomic replacement but not a demonstrated cross-file transaction; qualification is a deterministic confirmation gate; and the existing PRD risk register contains only promotion enforcement, qualification cost, release hardening, and deployed-instance migration concerns relevant to this program. The following inventory converts the remaining gaps into concrete reconciliation work rather than treating them as inferred examples.

| ID | Decision to settle | Why it matters | Recommended gate or phase | Evidence or validation needed | Disposition |
| --- | --- | --- | --- | --- | --- |
| DI-001 | Confirm whether project files and JSONL remain the only canonical domain state and whether SQLite, indexes, server caches, and UI projections are strictly derived and rebuildable; any exception requires an explicit authority design. | A second canonical store would break offline recovery and make conflict ownership ambiguous. | Phase 0 PRD reconciliation and before the Phase 1 storage contract; the completed proof's disposable derived index did not select authority. | Delete-and-rebuild tests, round-trip and schema-evolution fixtures, offline operation, and an authority map for every record class. | PRD open question and follow-on design decision. |
| DI-002 | Define the exact operation-receipt path, schema, append and amendment semantics, stable IDs, integrity protection, retention, and recovery behavior. | Cross-surface provenance cannot be audited or migrated until its durable contract is precise. | Phase 1 contract gate. | Interrupted-write, replay, tamper-evidence, redaction, schema-upgrade, and receipt-to-domain-evidence linkage tests. | Follow-on design decision and risk. |
| DI-003 | Define optional local/server synchronization, base-revision and lease semantics, conflict detection, offline mutation, retry, reconciliation, and loss-of-server recovery. | Multi-client coordination can corrupt or silently fork canonical files if server authority and conflicts are vague. | Conditional Phase 4 gate, before any remote mutation. | Concurrent-client and network-partition simulations, stale-lease tests, deterministic merge or reject outcomes, and full reconstruction after server loss. | PRD open question, risk, and follow-on design decision. |
| DI-004 | Define project identity independently of path, including relocation, rename, symlink, copied project, clone, duplicate identity, deleted root, and global-registry repair semantics. | The global registry, provenance receipts, and companion integration must identify a project durably without making its original path permanent. | Phase 0 and the Phase 1 project-resolution contract. | Move, rename, symlink, copy, clone, duplicate-ID, missing-root, and corrupted-registry fixtures on every supported platform. | PRD open question and follow-on design decision. |
| DI-005 | Define Build OS global settings and registry locations, user-versus-system scope, backup and restore, corruption handling, portability, discovery precedence, and multi-version ownership. | The confirmed system-installed product model creates durable state outside a project that needs a recovery and upgrade authority. | Phase 0, before project initialization implementation. | Multi-user and multi-version scenarios, portable restore, atomic update, corruption recovery, and uninstall-with-projects-present tests. | PRD open question and risk. |
| DI-006 | Decide whether a coordinating server is needed and, if so, whether it is an embedded local daemon, a user-managed local service, or a remote service. | Server topology determines lifecycle, offline behavior, data exposure, and operating cost. | Phase 4 measured-use-case gate. | Named multi-client or remote workflow, measured latency and reliability need, daemon lifecycle proof, and no-server degradation test. | PRD open question and follow-on design decision. |
| DI-007 | If a remote or shared server is approved, define tenancy, authentication, project isolation, roles, permissions, service identity, authorization propagation, and administrative recovery. | A coordinating service cannot safely expose evidence or mutation authority without a concrete isolation model. | Conditional Phase 4 security gate. | Threat model, cross-project access tests, role and revocation matrix, credential recovery, audit coverage, and permission-to-core-authorization mapping. | Risk and follow-on design decision. |
| DI-008 | Classify evidence and receipts; set capture consent, retention, deletion, export, redaction, path and identity minimization, and browser-content handling rules. | Build OS may store confidential source material, local paths, identities, process output, and captured browser content. | Phase 1 for core provenance and Phase 5 for browser capture. | Privacy threat model, secret-bearing fixtures, redaction-before-persistence tests, retention and deletion verification, and export review. | PRD open question, risk, and follow-on design decision. |
| DI-009 | Define who may qualify, promote, revoke, override, or appeal a result; which gates are deterministic; and how human review and agent evidence are recorded. | Qualification controls downstream authority, but current Q-001 leaves enforcement open and R-002 identifies confirmation-test cost. | Phase 0 PRD reconciliation and Phase 2 qualification migration. | Positive and negative qualification fixtures, reviewer identity and authorization, override and revocation audit, repeatability, and measured confirmation-test cost. | PRD open question Q-001 and risk R-002. |
| DI-010 | Select the first app UI vertical workflow and bound browser capture to explicit user-selected evidence and published source anchors, with no direct qualification or file writes. | A generic UI or broad capture extension would duplicate domain logic before one valuable workflow is proven and would expand privacy scope prematurely. | Phase 5 entry gate. | User-task evidence, prototype and accessibility UAT, adapter parity, consent and source-integrity tests, and privacy review. | PRD open question and follow-on design decision. |
| DI-011 | Define the compatibility matrix, data-schema obligations, alias duration, rollback, and migration sequencing for the three legacy toolkits and the unified seed across any selected language. | Existing tools are the current behavior; a core extraction or rewrite can change filesystem effects and deployed projects even when command names remain. | Phase 2 entry and exit gates. | Golden fixtures for each legacy CLI, copied-root migration rehearsals, output and exit parity, failure injection, rollback, and R-004 deployed-instance evidence. | Risk R-004 and follow-on migration design. |
| DI-012 | Verify the exact published Make Docs setup, recognition, version selection, reconfiguration, repair, and removal operations and marker or registration contracts. | The confirmed companion lifecycle cannot safely infer or write another product's state. | Phase 6 integration-validation gate. | Published-release matrix covering interactive and noninteractive setup, missing and corrupt state, version mismatch, partial failure, reconfiguration, removal, marker verification, and Build OS receipts. | PRD open question and risk R-001. |
| DI-013 | Define supported platforms and architectures, package channels, prerequisites, signing, SBOMs, system and project upgrade ownership, rollback, self-update policy, and independent or combined removal. | A system-installed product and project-local installation create lifecycle obligations beyond producing a binary. | Phase 7 release-hardening gate. | Clean-machine install, upgrade, rollback, repair, and uninstall on the approved matrix; orphaned-project handling; artifact verification; and R-003 evidence. | Risk R-003 and follow-on distribution design. |
| DI-014 | Record Go as the selected language for the cohesive headless core, CLI, and MCP server, and define the evidence triggers that may reopen the choice. | Language choice affects delivery footprint, migration risk, MCP support, Make Docs integration, contributor cost, and the update surface. | Phase 0.5 completed; reopen only through the explicit re-evaluation gate. | Accepted representative proof, retained selection record, and new proof plus migration and rollback evidence for any future trigger. | Resolved architecture decision; PRD reconciliation must record the selection and re-evaluation triggers. |
| DI-015 | Define schema and protocol compatibility for requests, plans, results, diagnostics, receipts, capability discovery, and MCP projection, including downgrade and partial-upgrade behavior. | Versioned projects and external clients need predictable behavior across schema and protocol skew even though the CLI and MCP server share one release. | Phase 1 contract gate and Phase 3 protocol gate. | Old-and-new fixture matrix, unknown-field behavior, forward and backward compatibility, capability negotiation, and partial-upgrade recovery. | Risk and follow-on design decision. |
| DI-016 | Define the mutation transaction and locking unit across canonical JSONL, derived indexes, operation receipts, and other affected files. | Current per-file atomic replacement does not by itself prevent a multi-file operation from leaving internally inconsistent state after interruption or concurrent invocation. | Phase 1 recovery gate. | Crash-after-each-step, concurrent CLI and MCP invocation, stale-lock recovery, idempotent retry, and derived-state rebuild tests. | Risk and follow-on design decision. |
| DI-017 | Approve a complete initial capability map for the cohesive core, CLI, and MCP server before Phase 1 implementation, then reconcile every later addition, removal, or change against it. | The current system is largely directory-driven and exposes only a small command surface; inferring the product contract from directory conventions or existing commands would omit supported behavior and freeze accidents as architecture. | Phase 1 pre-planning and implementation-entry gate; delta reconciliation before every later phase. | Capability-by-capability mapping of core use case, CLI command, MCP tool or resource, data authority, state transitions, dependencies, compatibility, non-goals, acceptance evidence, open questions, and risks. | Mandatory PRD open question and acceptance gate until the initial map is approved. |

Every PRD open question above must receive an owner and acceptance evidence during reconciliation. Risks must enter the PRD risk register with mitigation and validation gates. Follow-on design decisions may remain later-phased, but their dependent roadmap phase must not begin while the decision is unresolved.

### Pre-Phase Reconciliation Discipline

**Confirmed process decision:** before planning or starting every phase, the owner must reconcile the active PRD open questions and risk register and perform a complete capability-map pass for the phase's scope. A phase may proceed only after the following are explicitly enumerated and dispositioned:

- in-scope capabilities and user or agent outcomes;
- headless-core use cases and their CLI commands and MCP tools or resources;
- data ownership, canonical-versus-derived state, affected paths, and state transitions;
- internal and external dependencies, authorization needs, and failure behavior;
- compatibility, migration, versioning, upgrade, rollback, and removal obligations;
- exclusions and non-goals;
- required acceptance evidence and validation environments;
- unresolved questions with owners and decision deadlines;
- risks with mitigation, validation, and escalation gates.

The capability map must use stable capability identifiers and make the core-to-CLI-to-MCP mapping explicit. Every domain operation in the CLI must have a semantically equivalent MCP projection in the same Go program and release; any transport-only discovery, progress, cancellation, or presentation surface must be identified separately and must not create a second domain contract.

Directory presence, router text, templates, manual steps, and current toolkit commands are discovery evidence, not an inferred contract. For every observed directory-driven behavior, reconciliation must decide whether it becomes a supported core operation, remains an explicitly documented manual convention, is deferred with an owner and gate, or is intentionally excluded. Silence is not a disposition.

Phase 1 must produce and approve the complete initial core, CLI, and MCP capability map before implementation begins. Every later phase must compare its proposed additions, removals, and changes against that baseline, update the map and PRD risk register, and record accepted compatibility effects before planning or execution. No phase gate may pass with an undispositioned in-scope capability, open question, or risk.

### Phased Roadmap and Decision Gates

This roadmap describes workstreams under one program. It is not an executable plan and does not assign a wave or revision coordinate. Every phase, including optional phases, is subject to the pre-phase reconciliation discipline above before planning and again before implementation starts.

#### Phase 0: Authority Reconciliation

- Reconcile this boundary with the architecture design, the Make Docs import strategy, the unified CLI design, PRD 18, W1 R5 plans, and the risk register.
- Decide whether W1 R5 is revised in place or superseded by a new program coordinate.
- Define compatibility obligations for current shipped `system/` contents and existing users.

**Gate:** product ownership, authoritative documents, retained W1 R5 scope, successor coordinate, and forbidden coupling are explicitly approved.

#### Phase 0.5: Core, CLI, and MCP Technology Selection (Completed)

- A contract-neutral fixture and acceptance rubric bounded the representative Go, Node.js, and Rust proof.
- The proof slice evaluated JSONL preservation, provenance identity, deterministic results, durable local writes, subprocess failure and retry, idempotent replay, timing, sampled memory, artifact size, dependency assumptions, available cross-build packaging, source size, and migration cost without migrating production toolkits.
- The retained [proof report](./2026-08-14-build-os-runtime-selection-proof.md) preserves the measurements and explicitly bounds the MCP, security, recovery, platform-execution, and release-qualification work that was not performed.
- Go was selected for one cohesive program, product package, installed executable, and distribution containing the headless core, CLI, and MCP server.
- The selection retains internal adapter boundaries and the explicit evidence-based re-evaluation gate.

**Gate result:** completed for the bounded retain-versus-rewrite decision. Go is the current architecture selection; later phase gates must supply the unperformed MCP, security, recovery, platform, and release evidence. This result does not authorize implementation and does not make Go irreversible if a documented re-evaluation trigger is later met.

#### Phase 1: Initial Core, CLI, and MCP Capability Contract

- Reconcile every Phase 1 open question and risk and approve the complete initial core, CLI, and MCP capability map before implementation begins.
- Enumerate each supported domain capability, state transition, data authority, core use case, CLI command, MCP tool or resource, dependency, compatibility obligation, non-goal, and acceptance fixture.
- Define core use-case, plan, result, diagnostic, authorization, verification, and receipt contracts.
- Define local atomicity, locking, idempotency, interruption, recovery, and redaction behavior.
- Define internal Go package boundaries and the single-executable CLI and MCP launch modes without making the core or MCP server separately installed products.
- Prove the model with bounded entity read and mutation operations through both CLI and MCP without changing established filesystem behavior.

**Gate:** the complete initial capability map is approved with no undispositioned in-scope capability, question, or risk; the internal core packages test without transport dependencies; the packaged Go program contains both CLI and MCP modes; the mapped operation surfaces are semantically equivalent; local files remain sufficient authority; and interrupted mutations are diagnosable and recoverable.

#### Phase 2: Core, CLI, and MCP Domain Migration

- Reconcile all proposed Phase 2 capability additions, removals, and changes against the approved initial map and PRD risk register.
- Migrate intake, discovery, qualification, design handoff, and entity operations domain by domain into the Go core.
- Expose each migrated domain operation through the built-in CLI and MCP server in the same change, version, executable, and distribution.
- Retain legacy adapters until parity and rollback evidence is accepted.

**Gate:** filesystem effects, canonical records, evidence, diagnostics, CLI exit semantics, MCP results and errors, operation-surface parity, and recovery behavior satisfy the reconciled capability map and an approved parity matrix.

#### Phase 3: MCP Protocol Completion and Parity

- Reconcile Phase 3 protocol additions and changes against the same core, CLI, and MCP capability map.
- Complete the built-in MCP server's versioned tools and resources so its domain operations mirror the CLI operation surface.
- Define schema compatibility, capability discovery, authorization context, cancellation, progress, and diagnostic mapping within the same Go program and release lifecycle.

**Gate:** the single installed `buildos` executable contains the CLI and MCP server; CLI and MCP produce equivalent core outcomes and receipts for every mapped domain operation; transport-only MCP capabilities are explicitly classified; and MCP exposes no bypass around authorization or filesystem guards.

#### Phase 4: Optional Coordinating Server

- Validate whether multi-client coordination, remote access, long-running jobs, or event subscriptions justify a server.
- If justified, define server lifecycle, authentication, workspace leases, cache reconstruction, and offline degradation.

**Gate:** a measured use case requires the coordinating server, and local core, CLI, and MCP operation remains complete without it. If the gate fails, no coordinating server is built.

#### Phase 5: App UI and Optional Evidence Clients

- Define UI workflows for inspection, evidence review, planning, approval, verification, recovery, and provenance history.
- Evaluate browser evidence capture only as a bounded client capability.
- Reconcile any UI-requested operation against the approved core, CLI, and MCP capability map rather than adding UI-only domain behavior.

**Gate:** every mutation routes through an approved core plan, accessibility and privacy requirements are defined, and no client owns duplicate domain logic.

#### Phase 6: Make Docs Companion Integration

- Define the Build OS global settings and registry entries for the configured Make Docs dependency without treating them as Make Docs state.
- Confirm Make Docs' public system-dependency, project setup, recognition, reconfiguration, repair, and removal operations; exact version-selection behavior; supported markers or registration; compatibility semantics; and failure contract.
- Validate interactive disclosure and noninteractive explicit-profile or flag acknowledgement before any Make Docs project operation.
- Implement recognition before setup, verify every lifecycle action against published markers, and record project-local Build OS integration receipts.
- Keep Build OS behavior complete when the companion is absent and preserve Make Docs by default during Build OS removal.

**Gate:** exact public commands and markers, pinned dependency selection, interactive and noninteractive authorization, machine-readable verification, receipt fields, separate ownership, partial-failure recovery, reconfiguration, removal independence, supply-chain controls, and unsupported-version behavior are demonstrated against a published Make Docs release.

#### Phase 7: Distribution and Deprecation

- Reconcile the retained W1 R5 packaging, release-hardening, alias, documentation, and deprecation work with the accepted core and adapter contracts.
- Package, install, version, upgrade, rollback, and remove the Go headless core, CLI, and MCP server as one cohesive `buildos` executable and distribution; do not create a separately installed MCP product.
- Produce separate release, publication, and migration approvals.

**Gate:** compatibility, rollback, provenance, release artifacts, user guidance, and independent validation are complete. Passing this gate does not itself authorize publication or deployment.

### Dependencies

- Make Docs must publish authoritative system-dependency, project setup, recognition, version-selection, marker or registration, compatibility, reconfiguration, repair, and removal contracts before Build OS can implement the confirmed companion lifecycle safely.
- The repository must choose the successor coordinate and reconcile PRD 18 and W1 R5 before implementation planning.
- Every phase depends on a current open-question and risk-register reconciliation plus an approved capability-map pass for that phase's scope.
- Phase 1 implementation depends on approval of the complete initial core, CLI, and MCP capability map; current directory conventions and toolkit commands are evidence inputs, not a sufficient contract.
- Core contracts require an accepted workspace-root, schema-version, locking, atomic-write, recovery, redaction, and compatibility policy.
- The built-in MCP server requires stable tool and resource schema versioning, an authorization model appropriate to local agents, and operation parity with the CLI inside the same Go release.
- A coordinating server, if approved, requires authentication, workspace leasing, cancellation, observability, and cache-reconstruction contracts.
- App UI and browser evidence capture require explicit privacy, accessibility, and provenance requirements.
- Distribution requires reproducible builds, artifact verification, supported-platform policy, one-executable CLI and MCP lifecycle validation, and separately authorized publication.

### Risks

- Current directory conventions or a small set of commands could be mistaken for a complete product contract, silently omitting manual, agent, lifecycle, recovery, or compatibility capabilities.
- The capability map could become ceremonial or stale unless every phase records additions, removals, changes, questions, and risks before planning and implementation.
- Transport-specific behavior could leak into the core and create semantic drift across the built-in CLI and MCP server or later server and UI surfaces.
- Shipping the core, CLI, and MCP server in one executable could encourage package coupling unless internal dependency and parity tests enforce the adapter boundaries.
- A coordinating server could accidentally become the canonical authority and weaken offline or recovery behavior.
- Companion installation introduces network, package-resolution, supply-chain, and subprocess risks outside Build OS ownership.
- Operation receipts could expose sensitive paths, environment data, or captured evidence unless redaction is contractual.
- Provenance could become noisy or expensive if receipts duplicate evidence rather than link to it.
- Direct domain migration could change stable filesystem effects before parity is measured.
- Existing checked-in Make Docs-managed trees may require a longer compatibility transition than the target boundary suggests.
- Freezing release packaging before the core and adapter contracts stabilize could create avoidable compatibility debt.

### Unverified Assumptions

- Make Docs exposes public system-dependency and project setup, reconfiguration, repair, and removal operations that accept an exact dependency version or otherwise publish deterministic version-selection semantics.
- Make Docs treats a manifest or another published project registration surface as a supported recognition and post-operation verification interface.
- The published markers or registration expose enough identity and compatibility information to distinguish supported, absent, mismatched, reconfigured, and removed project states.
- The selected Go package boundaries can preserve transport independence as the complete CLI and MCP operation surface grows; Phase 1 and later parity tests must keep verifying this property.
- Single-user local workflows do not require a coordinating server.
- The operation receipt can be append-oriented without introducing an additional canonical database.
- Existing legacy behavior can be parity-tested without first modifying the legacy toolkits.
- Browser evidence capture is valuable enough to justify a client after the core evidence-ingestion contract is stable.

Each assumption must be verified, rejected, or converted into a decision before its dependent phase is planned.

### Non-Goals

- Implementing the unified CLI, headless core, MCP server, coordinating server, app UI, or browser extension.
- Changing, deleting, consolidating, or repackaging existing toolkits.
- Creating separately installed headless-core, CLI, or MCP products or executables.
- Choosing a UI framework, MCP library, server framework, database, cloud platform, or authentication vendor.
- Replacing filesystem authority with a service database.
- Bundling, copying, vendoring, forking, or owning Make Docs internals.
- Reimplementing Make Docs installation, update, repair, or uninstall behavior.
- Removing or rewriting current Make Docs-managed trees.
- Revising PRDs, plans, work items, release artifacts, or user guides in this design pass.
- Committing, pushing, publishing, releasing, deploying, or performing a live migration.

## Alternatives Considered

### Keep the Existing CLI-First Program Unchanged

This would preserve the current W1 R5 sequence and introduce other surfaces after domain migration. It was rejected because transport-neutral use cases and durable cross-domain receipts would then be retrofitted around CLI-specific boundaries.

### Make a Coordinating Server the Primary Authority

This would simplify subscriptions, multi-client coordination, and remote access. It was rejected because it would weaken the existing local-first contract, make recovery dependent on a service, and risk splitting authority between files and a database.

### Bundle Make Docs into Build OS

This would give Build OS a single installer and a superficially simpler initial setup. It was rejected because it duplicates ownership, couples releases, obscures supply-chain responsibility, and makes Build OS responsible for another product's internal lifecycle.

### Merge Build OS and Make Docs into One Product

This would remove the integration boundary. It was rejected because evidence discovery and documentation lifecycle management are separately valuable products with different authorities and release concerns.

### Rewrite All Toolkits into the New Core at Once

This could reach a cleaner package layout sooner. It was rejected because it removes the parity oracle, increases migration risk, and combines product-boundary decisions with behavioral rewrites.

### Allow Each Surface to Write the Filesystem Directly

This would reduce adapter work for early prototypes. It was rejected because domain rules, authorization, verification, and provenance would drift across clients and become difficult to audit or recover.

### Select a Core Language Without Representative Evidence

Retaining Go solely because it was present, moving to Node.js solely because Make Docs uses the Node ecosystem, or moving to Rust solely for native footprint would each collapse a multi-dimensional product decision into one attractive attribute. All three shortcuts were rejected in favor of the completed bounded Phase 0.5 proof, which selected Go and established explicit re-evaluation triggers.

## Consequences

The unified CLI and MCP server are required product surfaces over the same shared application core. They ship with that core as one cohesive Go program, product package, installed executable, and distribution rather than becoming separate products. W1 R5 retains substantial value as the migration, compatibility, packaging, and deprecation slice, but its phase order and contracts require revision before execution.

Go is now the selected language for the headless core, CLI, and MCP server based on the completed Phase 0.5 proof. The selection preserves the current Go toolkits as the parity oracle and avoids an unmeasured rewrite, while the explicit evidence triggers prevent the current choice from becoming an irreversible language guarantee.

MCP implementation is part of the required cohesive Go program and distribution and is not a separately installed product or optional later adapter. The optional coordinating server, app UI, optional browser evidence capture, and Make Docs companion integration remain separately scoped workstreams with independent decision gates.

Build OS gains a clearer ownership model and a durable audit path across human, agent, local, and coordinated use. The cost is additional contract work before broad migration and a requirement to keep adapters deliberately thin.

Make Docs can evolve and release independently. Build OS depends only on Make Docs' public lifecycle and recognition contracts, and companion absence does not disable Build OS evidence workflows.

Build OS owns the user disclosure, project-profile selection, orchestration plan, and integration receipt for the companion relationship, but it owns none of the Make Docs effects. Default Build OS removal preserves Make Docs, which prevents one product's lifecycle from silently destroying the other's installation or project state.

Existing users and checked-in scaffolding are not migrated by this decision alone. Compatibility, cleanup, release, and publication remain separately planned and authorized work.

PRD reconciliation now has a concrete decision inventory rather than a generic gap list. Some decisions intentionally remain later-phased, but each has an explicit gate, evidence expectation, and disposition so that unresolved assumptions cannot silently become implementation defaults.

Every phase now incurs an explicit reconciliation cost before planning and implementation. That cost is intentional: it prevents the current directory-driven system and narrow command set from becoming an incomplete core, CLI, or MCP contract, and it keeps later scope changes visible against one approved capability baseline.

## Design Lineage

- **Update Mode:** updated-existing
- **Prior Design Docs:**
  - [Build OS Architecture](./2026-06-03-build-os-architecture.md)
  - [Make Docs BuildOS Toolkit CLI Import Strategy](./2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md)
  - [Unified BuildOS CLI and Distribution](./2026-07-21-unified-buildos-cli-and-distribution.md)
- **Reason:** this living design now records the completed Go selection, the required single-distribution core, CLI, and MCP boundary, and the mandatory pre-phase capability and risk reconciliation while preserving the earlier product-boundary and Make Docs decisions.

## Intended Follow-On

- **Route:** change-plan
- **Next Prompt:** [Designs to Change Plan](../assets/prompts/designs-to-plan-change.prompt.md)
- **Why:** the accepted next step must reconcile this design into the architecture authority, the Make Docs import strategy, PRD 18, the W1 R5 plan and backlog, the complete initial core, CLI, and MCP capability map, and the risk register before any implementation begins.
- **Coordinate Handoff:** W1 R4 is the completed implementation baseline and W1 R5 is the current unexecuted CLI and distribution plan under revision; the successor coordinate is intentionally unresolved, and the planner must decide whether to revise W1 R5 or establish a distinct program coordinate before authoring downstream plans.
