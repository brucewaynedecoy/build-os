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

- `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md`
- `.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md`
- `toolkits/buildos/src/core/discovery/` (the Go `toolkits/buildos-discovery/` was removed in W1 R7 P8; frozen baseline commit `263f5ca`, which exists only in the private archive repository `brucewaynedecoy/build-os-archive`)
- `system/.os/scripts/buildos-discovery`

### D-003 user-guide coverage drift

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Build OS product users include adopters, operators, admins, and practitioners who use the shipped `system/` filesystem and first-party `buildos-*` toolkits | None |

**Issue**: W1 R0 P1-P6 closeouts repeatedly recorded user-guide outcome `none` because shipped filesystem, playbook, workspace, and toolkit workflows were classified as maintainer/operator-only rather than user-facing Build OS product workflows.

**Why it matters**: Build OS ships a filesystem-based operating system and first-party CLI toolkits. Adopters need simple task-oriented guides for first successful use, configuration choices, expected filesystem outputs, and troubleshooting. Without those guides, the active history understates a documentation gap and future phases can continue to skip user guidance for real product surfaces.

**Recommendation**: Treat shipped operational surfaces as user-facing when they are part of how an adopter uses Build OS. User-guide coverage prompts and closeout checks should explicitly ask what an adopter can do after the phase, and should trigger user-guide work when a phase adds or changes shipped CLI commands, wrappers, playbook workflows, workspace artifacts, adopter configuration, validation commands, expected results, or troubleshooting paths.

**To close**: The reusable user-guide coverage prompt is updated, W1 R0 P1-P6 user-guide remediation creates or updates the missing draft user guides, and the affected history records clearly mark their earlier `none` decisions as superseded by the remediation outcome.

**Resolution**: W1 R0 user-guide remediation created the draft `docs/assets/user/` suite, recorded a P1-P6 coverage matrix, added reciprocal developer-guide links, and marked the earlier P1-P6 user-guide `none` history outcomes as superseded by `.make-docs/archive/history/2026-06-05-w1-r0-user-guide-remediation.md`.

Code anchors:

- `README.md`
- `docs/assets/AGENTS.md`
- `docs/assets/references/guide-contract.md`
- `.make-docs/archive/history/2026-06-04-w1-r0-p1-operating-layer-contracts.md`
- `.make-docs/archive/history/2026-06-04-w1-r0-p2-spaces-boundary-shipping.md`
- `.make-docs/archive/history/2026-06-04-w1-r0-p3-intake-conversion.md`
- `.make-docs/archive/history/2026-06-04-w1-r0-p4-data-layer-extraction.md`
- `.make-docs/archive/history/2026-06-04-w1-r0-p5-playbooks.md`
- `.make-docs/archive/history/2026-06-05-w1-r0-p6-discovery-runs-qualification.md`

### D-004 Source-package paths leak into installed-project guidance

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | `system/` is a source package in this checkout. Its contents become root-level BuildOS files in an initialized project. | Resolve the deprecated validator's checkout rules and legacy generated document anchors through the pending toolkit work. |

**Issue**: Shipped contracts, examples, routers, and user guides have used `system/docs/`, `system/assets/`, and other source-checkout paths as installed paths. The old Python validator also defaults to a checkout layout and requires source-prefixed anchors. The packaged playbook index previously contained source-prefixed paths. Legacy discovery code strips the package prefix for an installed root but still generates document anchors to a fixed `docs/prd/10-discovery-runs-and-qualification.md` file. An adopter project does not necessarily contain that BuildOS PRD.

**Why it matters**: Agents can copy those paths into adopter instructions and records. An initialized project has no required `system/` child. Correct source links do not prove that installed instructions work.

**Recommendation**: Use the root agent rules and the [Root and Path Contract](../../system/.os/contracts/root-and-path-contract.md). Keep source evidence paths separate from runtime paths. Test the package contents at a temporary project root with no `system/` child. Keep skill resources and installed binaries separate from that root.

**To close**: Shipped path guidance and examples use project-root paths; their links stay inside the relocated package; user commands state their supported root; the replacement validation flow accepts initialized-project anchors and rejects an anchor with no path, an absolute path, or a path that leaves the project root; its `buildos validate` fixtures cover each anchor form: an initialized-project `doc_anchor` under `docs/` and `source_anchor` under `assets/` are accepted, and `#heading`, an absolute `/…#…` anchor, and an escaping `../…#…` anchor are rejected; each anchor form where it differs from the legacy validator is a recorded parity exception; generated document anchors resolve to adopter-owned evidence under their owning contract; and derived catalogs rebuilt for an initialized project contain project-root paths. Do not close this item from documentation checks alone.

**Current repair**: The root rules now separate the filesystem package, first-party skills, toolkit source, and adopter projects. Shipped contracts, routers, user guide steps, and packaged record examples use initialized paths. Source-only PRD links were removed from shipped playbooks. The playbook index was rebuilt against the package contents as a project root. No installed project or binary was changed.

**Evidence and limits**: `TestPackageAtInitializedRoot` copies the package contents to a temporary root with no `system/` child. It checks root resolution, BuildOS-owned local Markdown link targets, packaged JSON/JSONL path values, and starter-record file targets. The unified Go suite passes. A separate copied-root smoke check ran intake conversion and both intake index commands; all saved paths resolved and no `system/` child was created. The PRD authority check reports the same 93 diagnostics against `HEAD` and this repair, with no new diagnostics. Those existing PRD format errors remain outside this path repair. The deprecated Python validator and legacy discovery code were not changed or run; installed config, full artifact validation, and generated discovery document-anchor validity remain open.

**Validator anchor rules**: The legacy Python validator defaults its `--config`, `--contract`, and `--data-dir` paths to `system/`. It rejects an installed-project anchor: a `doc_anchor` under `docs/` fails with "must point under system/docs/", and an extraction `source_anchor` under `assets/` fails with "must point to a converted source twin under system/assets/". It also accepts a `source_anchor` with no path part (`#heading`), an absolute path, or a path that leaves the project root (`../outside.md#a`). [PRD 13](./13-adopter-owned-config-surface.md#buildos-validate-checks) requires every path and saved anchor to be a `path#anchor` reference relative to the initialized project root. The [Root and Path Contract](../../system/.os/contracts/root-and-path-contract.md#saved-paths-and-anchors) also requires saved paths and anchors relative to the initialized project root. So matching the legacy anchor behavior is not an option: it would break that contract as well as PRD 13. `buildos validate` keeps the installed-path rule. Each anchor form where it differs from the legacy validator is a recorded parity exception, with a fixture for each form.

**W1 R7 P7 evidence**: `buildos validate` replaces the legacy validator and checks installed paths only. Its fixtures cover each anchor form: a `doc_anchor` under `docs/` and an extraction `source_anchor` under `assets/` pass (fixture `base`), and `#heading`, `/abs/...#a`, `C:/...#a`, `../outside.md#a`, and `docs/../../outside.md#a` fail (fixture `anchor-forms`). Each form where it differs from the legacy validator is a recorded divergence (VD-02 and VD-10 in `toolkits/buildos/test/golden/validate/divergences.json`). The other conditions of this item (generated document anchors and derived catalogs for an initialized project) stay open. See the [P7 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-and-validation).

**Human Experience Review**: The affected users are maintainers, skill authors, and adopter operators. The intended result is one clear choice of root and no need to create a source-package directory to use installed guidance. The repaired rules and upgrade steps show that choice. The moved-package check supports link and saved-path portability. It does not prove a person's ease of use, a live upgrade, or the pending toolkit release. No human acceptance gate is added.

Code anchors:

- `AGENTS.md`
- `README.md`
- `system/.os/contracts/root-and-path-contract.md`
- `system/.os/scripts/validate_config.py`
- `system/.os/indexes/playbooks.json`
- `docs/assets/user/`
- `toolkits/buildos/test/installed-layout.test.ts` and `toolkits/buildos/test/system-content.test.ts` (the Go `package_portability_test.go` was removed in W1 R7 P8)
- `toolkits/buildos/src/core/discovery/discovery.ts` (the Go `discovery.go` was removed in W1 R7 P8)

### D-005 Legacy editorial PRDs fail PRD authority validation

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Every current requirement of PRDs 13–19 has one product owner. PRD 13 and [PRD 17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md) keep their numbers under product names. The last text of PRDs 14, 15, 16, 18, and 19 is kept in the archive and is not current authority. The index [`## Current Authority Map`](./00-index.md#current-authority-map) names one active owner per topic. | None. W1 R8 has satisfied the D-005 prerequisite for W1 R7 P1. |

**Issue**: PRDs 13–19 use editorial filenames, titles, kinds, or headings. On 2026-11-23, `make-docs run prd authority validate` failed with 93 findings. All of them come from these PRDs, from index rows that list their editorial kinds, or from plan and work links that treat them as authority.

**Why it matters**: The PRD set is the product authority. A legacy PRD that keeps stale or misleading text can lead a reader or agent to take a superseded contract as current. The validator cannot pass while these PRDs remain. The first public BuildOS package must ship on a clean, fully valid PRD set.

**Recommendation**: Treat the cleanup as a priority. Map every current requirement in PRDs 13–19 to one product owner, write the owner text first, and only then rename, merge, or retire a legacy PRD. Follow the safety rules below. Until the cleanup ends, read the index `## Current Authority Map` to find the current owner of each topic.

**To close**: `make-docs run prd authority validate` passes with zero findings, and every requirement in PRDs 13–19 has a current product owner.

**Owner**: BuildOS maintainer.

**Phase/gate**: This item gated W1 R7 work P1, and so every later W1 R7 phase. This condition of the gate is met: the item closed on 2026-11-23.

**Resolution**: Closed on 2026-11-23. `make-docs run prd authority validate --target-root .` passes with zero findings. Every requirement of PRDs 13–19 has a current owner section, or an explicit `none` with a reason, traced in the W1 R8 [requirement inventory](../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md#2-requirement-inventory-per-legacy-prd). PRD 17 is renamed to [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md). PRDs 14, 15, 16, 18, and 19 are archived at `.make-docs/archive/prds/2026-11-23/`, and the five finished or superseded backlogs are archived at `.make-docs/archive/work/`. A relative-link and anchor check over the whole repository, including `.make-docs/archive/`, finds no broken link to a PRD, a moved backlog, or the moved audit prompt. W1 R8 has satisfied the D-005 prerequisite for W1 R7 P1. The other P1 entry-gate conditions, the owner's approval of the W1 R7 PRD maintenance and backlog, are not part of this item. Evidence: the W1 R8 [work backlog](../work/2026-11-23-w1-r8-prd-set-authority-cleanup/00-index.md), its [evidence report](../work/2026-11-23-w1-r8-prd-set-authority-cleanup/evidence.md), and the W1 R8 [plan](../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md).

#### Cleanup inventory

This seed is a starting map, not a decision. The cleanup confirms or corrects each row. The final trace is the `Final owner` column of the W1 R8 [requirement inventory](../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/04-requirement-inventory.md#2-requirement-inventory-per-legacy-prd), which names the owner section of every requirement. The seed table below is kept as the starting map.

| Legacy PRD | Requirement group | Proposed product owner | Status after W1 R7 |
| --- | --- | --- | --- |
| 13 | Adopter config schema, defaults, validation | A product-named config PRD, or 06 | Current in 13 |
| 14 | Toolkit deployment standard | 20 | Superseded by 20 |
| 15 | `draft` lifecycle state for entity and extraction rows | 08 | Current in 15 |
| 16 | Domain ownership boundaries | 02 or 20 | Current in 16 (wording updated) |
| 17 | Entity consolidation, canonical resolution, index, `buildos entities` | A product-named entity PRD, or 08 | Current in 17 |
| 18 | Command and output contract, aliases, distribution | 20 | Superseded by 20 |
| 19 | Core/adapter rules, capability map (never approved) | 20 (rules); MCP revision (capability map) | Superseded; capability map deferred |

#### Cleanup safety rules

1. Before any legacy PRD is renamed, merged, or retired, every normative requirement in it is mapped to exactly one product owner, and the owner text is written first.
2. A diff check confirms that no requirement in the inventory is lost. Each row ends in a current owner section or an explicit `none` with a reason.
3. Prior contracts move only into `## Requirement History` entries of the new owners.
4. Links from plans, work, designs, and the guide are updated in the same change set. The index `## Current Authority Map` is updated last.
5. `make-docs run prd authority validate` passes with zero findings at the end.
6. Archived or historical files are not rewritten.

#### Cleanup priority and sequencing

- The cleanup starts right after the W1 R7 work backlog is generated. It runs as W1 R8, a W1 revision Wave, with its own design and [plan](../plans/2026-11-23-w1-r8-prd-set-authority-cleanup/00-overview.md).
- It must close this item before W1 R7 work P1 starts. Every later W1 R7 phase follows P1.
- The reason: the Make Docs PRD router requires `make-docs run prd authority validate` to exit zero before downstream work uses the PRD set.
- If the cleanup finds that a W1 R7 PRD change was wrong or incomplete, it records the fix in the owning PRD's `## Requirement History` and notifies the W1 R7 work backlog through its `## Change History`.

Code anchors:

- [W1 R7 legacy PRD cleanup handoff](../plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/05-legacy-prd-cleanup-handoff.md)
- `docs/prd/00-index.md`
- `docs/prd/13-adopter-owned-config-surface.md` and `docs/prd/17-entity-identity-and-canonical-resolution.md`
- `.make-docs/archive/prds/2026-11-23/` (the last text of PRDs 14, 15, 16, 18, and 19)

### D-006 Legacy validator config and frontmatter checks differ from PRD 13

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open (item 1 closed 2026-11-24) | [PRD 13](./13-adopter-owned-config-surface.md#buildos-validate-checks) states the intended `buildos validate` checks, and its `## Rebuild Notes` say that its check list governs where the legacy script differs. Item 1: the owner chose form (a) on 2026-11-24; a config with no `defaults` section passes. | Items 2 and 3 wait for an owner decision. Item 2 is a recorded divergence (VD-04, VD-05); item 3 stays latent. |

**Issue**: The legacy Python validator differs from the PRD 13 config and frontmatter checks in three ways:

1. It rejects a config with no `defaults` mapping (`defaults: must be a mapping`), and a config that lacks one of `defaults.systems`, `defaults.environments`, or `defaults.owners` (`defaults.<name>: must be a list`). PRD 13 and the config contract make `defaults` and each of its lists optional.
2. It accepts an integer owner `kind`, because it checks the slug only when `kind` is a string. It accepts `version: true`, because a Python boolean passes its integer check. PRD 13 requires `kind` to be a string slug and `version` to be an integer that is not a boolean.
3. It checks scoped frontmatter only in playbooks under `playbooks/` and in playbook templates under `.os/templates/`. PRD 13 covers every Markdown artifact whose contract carries scoped metadata. No such file exists outside the playbook scope today, so this gap is latent.

**Why it matters**: [PRD 20 Compatibility](./20-buildos-cli-and-distribution.md#compatibility) requires parity with the former tools, and any other difference needs an explicit parity exception with a recorded reason. A port that copies the script keeps behavior that PRD 13 does not allow. A port that follows PRD 13 with no recorded exception shows up as a parity defect. In both cases, `buildos validate` can give an adopter a result that the PRD does not promise.

**Recommendation**: Follow PRD 13 and the [config contract](../../system/.os/contracts/config-contract.md), which both make `defaults` and its lists optional. Record each difference as a parity exception with its reason, and cover it with a parity fixture. Do not change PRD 13 alone to match the legacy behavior. For the frontmatter check, define the full file set from the artifact contracts.

**To close**: The owner decides each difference, and each decision takes one of two forms. (a) The `buildos validate` parity fixtures cover the difference, and a recorded parity exception keeps the governing PRD 13 and contract rules, including a config with no `defaults` and a config with only some `defaults` lists. (b) One approved change updates every affected owner, both the PRD and the contract, records the change in each owner's history, and updates the fixtures. A change to PRD 13 alone does not close this item.

**Owner**: BuildOS maintainer.

**Phase/gate**: Before W1 R7 work P7 ports `buildos validate`.

**Required evidence**: A reproduction of each difference against `validate_config.py`, and parity fixtures that show the chosen behavior of `buildos validate`.

**W1 R7 P7 evidence**: The port follows PRD 13 and the config contract (form a), pending the owner's decision. Each difference is reproduced against the legacy script (Python 3.14.10) and is a recorded divergence with a parity fixture: item 1 is VD-03 (`defaults-absent`, `defaults-partial`), item 2 is VD-04 (`version-boolean`) and VD-05 (`owner-kind-number`). Item 3 stays latent: the frontmatter check reads the playbook set that PRD 13 now states. The legacy script is removed from `system/`. See the [P7 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-and-validation).

**W1 R7 P7 review round 1 (2026-11-24)**: Item 2 also covers an owner `kind` with no value (null) or a mapping, which the legacy script skipped too (VD-05, `owner-kind-null-mapping`). Two further differences are recorded under the same form (a): a config that defines the reserved sentinel `both` as an ID now fails, and `both` fails in every scoped list even when configured (VD-19, `sentinel-configured`; PRD 13 Scoped vocabulary), and file names in the frontmatter set match ASCII case-insensitively on every OS, where the legacy script matched by exact case on macOS and Linux (VD-20, orchestrator decision, `name-case`). A `version` past 2^53 now keeps its exact value, as the legacy script did (`version-beyond-2-53`, `version-310-digits`, no divergence). The owner question for item 1 is unchanged. See [P7 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1).

**Owner decision (2026-11-24)**: Item 1 is closed under form (a). `defaults` is optional: a config with no `defaults` section passes `buildos validate`, and so does a config with only some `defaults` lists. PRD 13 and the config contract already state this; divergence VD-03 and the parity cases `defaults-absent` and `defaults-partial` keep it. Items 2 and 3 stay open. See [Owner Decisions](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions).

**W1 R7 P7 review round 2 (2026-11-24)**: An integer `version` with more than 4,300 digits passes; Python 3.14 raised `ValueError` (its default integer string limit), so the legacy script crashed (VD-23, `version-4301-digits`; PRD 13 allows an integer of any size).

Code anchors:

- `system/.os/scripts/validate_config.py` (removed in W1 R7 P7; git history keeps it)
- `toolkits/buildos/test/golden/validate/divergences.json`
- `system/.os/contracts/config-contract.md`

### D-007 Legacy validator entity and extraction row checks differ from PRD 13

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open (items 1 and 2 closed 2026-11-24) | [PRD 13](./13-adopter-owned-config-surface.md#buildos-validate-checks) states the intended entity and extraction row checks, and its `## Rebuild Notes` say that its check list governs where the legacy script differs. Items 1 and 2: the owner chose form (a) on 2026-11-24. | Item 3 (the RFC 3339 `extracted_at` profile, an orchestrator decision) waits for the owner, who may veto it. Item 4 is a recorded divergence (VD-09, VD-19). When Stage 1 imports the adopter skills, check whether any skill writes `dataset_refs: null`; if one does, return to the owner. |

**Issue**: The legacy Python validator differs from the PRD 13 entity record hygiene, extraction row, and scoped data checks in four ways:

1. It treats `"dataset_refs": null` in an extraction row as an absent field. PRD 13 requires a list of non-empty strings when the field is present.
2. It allows only `draft`, `active`, `superseded`, and `archived` in every entity file. It rejects a finding with `status: qualified` and a run with `status: running`, `closed`, or `aborted`. [PRD 08](./08-data-and-extraction.md#draft-lifecycle-and-anchors) and [PRD 17](./17-entity-identity-and-canonical-resolution.md#lifecycle-and-redirects) allow these entity-specific states, and PRD 13 checks against both. The shipped findings and runs data files are empty, so no shipped row shows the conflict.
3. It requires seconds in `extracted_at`. It rejects `2026-01-01T01:02Z` and accepts `2026-01-01T01:02:03Z`. PRD 13 accepted any ISO 8601 UTC datetime that ends in `Z`, and ISO 8601 allows a time with hours and minutes only. Resolved in wording on 2026-11-24 (see the review round 1 note below): PRD 13 now states the RFC 3339 UTC profile, which needs seconds.
4. It does not reject a legacy scoped field (`env`, `for`, `envs`, or `target_systems`) in an entity row. It rejects `both` in a scoped row field only because `both` is not a configured ID. PRD 08 and PRD 13 require validation to reject both cases. No shipped data row holds a legacy scoped field, so this gap is latent.

**Why it matters**: [PRD 20 Compatibility](./20-buildos-cli-and-distribution.md#compatibility) requires parity with the former tools, and any other difference needs an explicit parity exception with a recorded reason. A port that copies the script would reject valid findings and runs, and accept rows that PRD 08 and PRD 13 forbid. A port that follows PRD 13 with no recorded exception shows up as a parity defect.

**Recommendation**: Follow PRD 13 for each difference. Record each one as a parity exception with its reason, and cover each entity-specific state, each `extracted_at` form, and each legacy scoped field with a parity fixture. A `qualified` finding must stay valid: PRD 17 allows it, and design promotion in [PRD 11](./11-flow-c-integration.md#contracts-and-data) needs it. If the owner wants seconds in `extracted_at`, change every owner of that rule in one approved change, with its fixtures. Do not change PRD 13 alone to match the legacy behavior.

**To close**: The owner decides each difference, and each decision takes one of two forms. (a) The `buildos validate` parity fixtures cover the difference, and a recorded parity exception keeps the governing rules in PRD 08, PRD 13, PRD 17, and the entity records and extraction contracts, including a `qualified` finding and each run state. (b) One approved change updates every affected owner, each PRD and contract, records the change in each owner's history, and updates the fixtures. A change to PRD 13 alone does not close this item.

**Owner**: BuildOS maintainer with the data-contract owner.

**Phase/gate**: Before W1 R7 work P7 ports `buildos validate`.

**Required evidence**: A reproduction of each difference against `validate_config.py`, and parity fixtures that show the chosen behavior of `buildos validate`.

**W1 R7 P7 evidence**: The port follows PRD 13 (form a), pending the owner's decision. Each difference is reproduced against the legacy script (Python 3.14.10) and is a recorded divergence with a parity fixture: item 1 is VD-08 (`dataset-refs-null`), item 2 is VD-06 (`type-specific-status`: a `qualified` finding and `closed`, `running`, and `aborted` runs pass; a `qualified` requirement fails), item 3 is VD-07 (`extracted-at-minutes`), and item 4 is VD-09 (`entity-legacy-fields`). Item 2 changes the result for every project with a discovery run, which the legacy script failed. See the [P7 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-and-validation).

**W1 R7 P7 review round 1 (2026-11-24)**: Item 3 changed. The check never accepted every ISO 8601 form: the basic format (`20261124T102030Z`) and a comma fraction failed in both the legacy script and the port, so the PRD 13 words were wider than the check. Orchestrator decision, which the owner may veto: keep the narrow check and state it. PRD 13 now states the RFC 3339 UTC profile `YYYY-MM-DDTHH:MM:SS`, an optional `.` and one or more fraction digits, then `Z`; ASCII digits, uppercase `T` and `Z`, a real calendar date in 0001 to 9999, hour 00 to 23, no leap second. A time with no seconds now fails, as in the legacy script, so `extracted-at-minutes` is no longer a divergence. The one remaining difference is `24:00:00`, which the legacy script passed as the next day and the port rejects (VD-07, `extraction-extracted-at`, `extracted-at-forms`). If the owner vetoes, the alternative is to accept every ISO 8601 UTC form, which needs a wider parser and new fixtures. Item 4: `both` now fails in every scoped list also when the config defines it (VD-19). Further recorded differences: saved anchor paths with a URI scheme, the `system/` prefix, or a path that folds to the project folder fail (VD-18, `anchor-invalid-forms`); an ID, minted ID, or `extracted_at` that ends in an escaped line feed fails (VD-21); a `status` that is an object fails, where the legacy script crashed (VD-22); two rows separated by a lone CR fail as one line (VD-15, `entity-lone-cr`). The owner questions for items 1 and 2 are unchanged. See [P7 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1).

**Owner decision (2026-11-24)**: Items 1 and 2 are closed under form (a). Item 2: a closed or running run and a qualified finding pass `buildos validate`; PRD 13 wins over the Python script (VD-06, `type-specific-status`). Item 1: `dataset_refs: null` fails (VD-08, `dataset-refs-null`). Follow-up from the orchestrator: when W1 R7 P7 Stage 1 imports the adopter skills, check whether any skill writes `dataset_refs: null`; if one does, return to the owner. Item 3 (the RFC 3339 profile) stays an orchestrator decision that the owner may veto. See [Owner Decisions](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions).

**W1 R7 P7 review round 2 (2026-11-24)**: A saved anchor now splits at its first `#`, and the fragment after it must not be empty (it may itself hold `#`, as a heading ID such as `C#`); the `system/` prefix is checked on the path as written as well as folded, so `system/../docs/a.md` fails; a path that ends in `/`, `.`, or `..` names a folder and fails. The check reads the spelling only: it never looks up the file or the fragment (VD-18; PRD 13).

Code anchors:

- `system/.os/scripts/validate_config.py` (removed in W1 R7 P7; git history keeps it)
- `toolkits/buildos/test/golden/validate/divergences.json`
- `system/.os/contracts/entity-records-contract.md`
- `system/.os/contracts/extraction-contract.md`

### D-008 Legacy playbook catalog rebuild accepts unresolved target redirect chains

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | [PRD 09 Rebuild Notes](./09-playbooks.md#rebuild-notes) state the intended redirect-chain rule for playbook validation and catalog rebuilds, and the rule depends on the [PRD 17 terminal resolution](./17-entity-identity-and-canonical-resolution.md#terminal-resolution) rule. No parity exception is recorded yet. | Decide before W1 R7 work P4 ports `buildos intake index playbooks`: keep the PRD 09 and PRD 17 rules and record the difference below as a parity exception, or change every affected owner and its fixtures in one approved change. |

**Issue**: [PRD 09 Rebuild Notes](./09-playbooks.md#rebuild-notes) require playbook validation and catalog rebuilds to reject a target whose redirect chain is unresolved or invalid. The legacy Go playbook indexer copies `targets` from frontmatter as strings and checks only that the required fields exist. It never reads `.os/data/` or resolves a target. It catalogs a playbook whose target is a `superseded` row with a missing redirect successor, and it reports no error.

**Why it matters**: [PRD 20 Compatibility](./20-buildos-cli-and-distribution.md#compatibility) requires the port of `buildos intake index playbooks` to match the Go output byte for byte, unless a parity exception is recorded. A port that copies the Go indexer keeps a catalog entry that PRD 09 forbids, so a playbook can be selected against a target that does not resolve. A port that follows PRD 09 with no recorded exception shows up as a parity defect. No domain owns playbook contract validation beyond the catalog rebuild yet (Q-014).

**Recommendation**: Follow PRD 09 and the PRD 17 terminal resolution rule, which fails closed on a missing target. Record the legacy difference as a parity exception with its reason, and cover it with a parity fixture whose target redirects to a missing successor. Do not change PRD 09 alone to match the legacy behavior.

**To close**: The owner decides the difference, and the decision takes one of two forms. (a) The `buildos intake index playbooks` parity fixtures cover the difference, and a recorded parity exception keeps the governing PRD 09 and PRD 17 rules, including a fixture where a target whose redirect successor is missing is rejected. (b) One approved change updates every affected owner, each PRD and contract, records the change in each owner's history, and updates the fixtures. A change to PRD 09 alone does not close this item.

**Owner**: BuildOS intake domain owner with the entities domain owner.

**Phase/gate**: Before W1 R7 work P4 ports `buildos intake index playbooks`.

**Required evidence**: A fixture playbook whose target is a `superseded` row with a missing successor, and the catalog rebuild result for the Go indexer and for `buildos intake index playbooks`.

Code anchors:

- `toolkits/buildos/src/core/intake/index/index.ts` (the Go `index.go` was removed in W1 R7 P8)
- `system/.os/indexes/playbooks.json`

### D-009 PRD 01 Current Limitations describe a greenfield build

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Restate [PRD 01 Current Limitations](./01-product-overview.md#current-limitations) from the implemented domains. |

**Issue**: PRD 01 `## Current Limitations` says that only the first slice is built, and that intake, the data layer, discovery and qualification, Flow C, and stage automation are designed but not implemented. The TypeScript CLI in this checkout already implements intake (`toolkits/buildos/src/core/intake/`), discovery (`toolkits/buildos/src/core/discovery/`), design promotion (`toolkits/buildos/src/core/design/`), and the entity commands (`toolkits/buildos/src/core/entities/`), with golden parity to the earlier Go tools, which W1 R7 P8 removed (frozen baseline commit `263f5ca`). [PRD 20 Command Surface](./20-buildos-cli-and-distribution.md#command-surface) is the release contract for the TypeScript CLI. It is not evidence that a command is implemented.

**Why it matters**: A reader or agent who trusts the stale limitation can skip a working tool or build a second one. The product overview is the first PRD that most readers open.

**Recommendation**: Restate the current limitations from the domains that are implemented today, and keep them apart from the PRD 20 release contract. Record the previous text in PRD 01 `## Requirement History`.

**To close**: PRD 01 `## Current Limitations` names the implemented domains and the remaining limits, and PRD 01 `## Requirement History` records the previous text.

**Owner**: BuildOS product owner.

**Phase/gate**: The next maintenance of PRD 01, and before `0.1.0` ships.

Code anchors:

- `docs/prd/01-product-overview.md`
- `toolkits/`

### D-010 `buildos intake` has no `--json` form

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | `buildos intake convert`, `intake index references`, and `intake index playbooks` print the shared JSON envelope with `--json` from `0.2.0`. Parity exception PE-022 records the difference from the Go intake tool. [PRD 20 Output and Exit Contract](./20-buildos-cli-and-distribution.md#output-and-exit-contract) names every command that takes `--json`. | None. |

**Issue**: [PRD 20 Output and Exit Contract](./20-buildos-cli-and-distribution.md#output-and-exit-contract) says that every command shares one output contract and that `--json` gives a stable automation form. `buildos intake convert`, `index references`, and `index playbooks` refused `--json` (`flag provided but not defined: -json`, exit 1), as the earlier Go tool did, and help printed text with `--json` too (PE-001 and PE-002 keep the Go help text). The W1 R7 P4 evidence recorded the intake behavior as Go parity; no parity exception or PRD text recorded it as an approved difference.

**Why it matters**: An agent that follows PRD 20 and adds `--json` to an intake command got a usage error. The guide and the package README said which commands print the envelope (W1 R7 P8 review round 2, P8-D-06), so no document promised more than the CLI did.

**Recommendation**: Add the shared JSON envelope to the intake commands in a later release (a parity exception with owner approval, since the Go tool had none), or state in PRD 20 that `intake` and help print text only.

**To close**: Either `intake` prints the envelope with `--json`, with a parity exception, or PRD 20 Output and Exit Contract names the commands without it.

**Owner**: BuildOS product owner.

**Phase/gate**: Before `0.2.0`. This condition of the gate is met.

**Resolution**: Closed on 2026-11-25. The owner chose option A: `buildos intake` gains the shared `--json` envelope in `0.2.0`. W1 R7 P9 built it with the same envelope, field rules, flag-position rule, and exit codes as `discovery` and `design`: the commands `intake.convert`, `intake.index.references`, and `intake.index.playbooks`; `write_status` `planned` for a dry run, `applied` for a write, and `not_requested` for a failure that left nothing; a conversion warning as a `warning` diagnostic; nothing on stderr under the canonical name `buildos intake` (the legacy name `buildos-intake` adds its one notice line, PE-016); and the exit code of the human form. The intake JSON review rounds 1 and 2 of 2026-11-25 added: intake does not undo; the envelope names what stayed. A failed write removes nothing, with or without `--json` (as the Go tool). With `--json`, when the run's write operations created or changed something, the envelope reports `partially_applied`, names each such path once in `result.left_in_place` (reason `created` or `changed`), and exits `10`; when they changed nothing, it reports `not_requested` with the text form's exit code (1, or 3 for a refusal). `root` is intake's cleaned project root, and result paths are relative to it with `/`. The text form without `--json` is unchanged, and the Go parity goldens pass. Help keeps the Go text. Parity exception PE-022 in `toolkits/buildos/test/golden/parity-exceptions.json` records the difference, and `toolkits/buildos/test/intake-json.test.ts` pins it. PRD 20 Output and Exit Contract, the guide, and the package README name the intake commands. Evidence: [P9 Owner Decisions 2026-11-25](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-owner-decisions-2026-11-25).

Code anchors:

- `toolkits/buildos/src/cli/commands/intake.ts`
- `toolkits/buildos/src/cli/commands/go-tool.ts`
- `docs/prd/20-buildos-cli-and-distribution.md`

## Open Questions

### Q-001 Promotion enforcement: convention vs. machinery

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Resolve qualification authority and enforcement before the Phase 2 qualification-migration gate |

**Question**: Who may qualify, promote, revoke, override, or appeal a result, which gates must be deterministic, and which promotion controls must be enforced by the cohesive core rather than remain documented conventions?

**Why it matters**: Qualification determines downstream authority. An incomplete actor, authorization, override, or enforcement contract could let CLI and MCP callers produce different promotion outcomes or make high-cost confirmation work unauditable.

**Recommendation**: Do not select convention or machinery by default. Define the actor and authorization matrix, deterministic gates, human-review boundaries, revocation and appeal transitions, and receipt evidence before choosing the enforcement mechanism for each transition.

**To close**: The Build OS product/architecture owner approves the qualification authority and state-transition contract, with positive and negative fixtures, reviewer identity and authorization evidence, override and revocation audit evidence, repeatability evidence, and measured confirmation-test cost. [PRD 10 Contracts and Data](./10-discovery-runs-and-qualification.md#contracts-and-data) carries the approved qualification contract, and [PRD 11 Contracts and Data](./11-flow-c-integration.md#contracts-and-data) carries the approved promotion contract. The archived PRD 19 at `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` is provenance only.

**Owner**: Build OS product/architecture owner.

**Phase/gate**: The decision is required before stage-movers are hardened ([PRD 12 Rebuild Notes](./12-stage-automation.md#rebuild-notes)) and before Phase 2 qualification migration.

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

**Recommendation**: Do not add a server by default. Select topology only after a named multi-client or remote workflow demonstrates a need that the local `buildos` program cannot meet, then require a separate security design before shared or remote operation.

**To close**: The product owner accepts measured workflow evidence and no-server degradation behavior; if a server is approved, the security owner also approves the tenancy/authentication/authorization and administrative-recovery design.

**Owner**: Build OS product owner; conditional security owner for shared or remote topology.

**Phase/gate**: Conditional Phase 4 use-case and topology gate.

**Required evidence**: Named workflow, measured latency/reliability need, daemon/service lifecycle proof, offline degradation, threat model, project-isolation tests, role/revocation matrix, credential recovery, audit coverage, and authorization mapping to core operations.

**Disposition**: DI-006 and the conditional decision portion of DI-007 remain deferred PRD questions and follow-on server design gates.

### Q-009 First UI workflow and browser-capture boundary

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | UI technology, first workflow, and browser capture remain separately scoped from the BuildOS core and CLI runtime selection | Resolve at the Phase 5 entry gate |

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
| Open | BuildOS pins a tested Make Docs version range and relies on only `make-docs --version`, `make-docs project state status --json`, and `make-docs setup --json`, as stated in [PRD 20](./20-buildos-cli-and-distribution.md#make-docs-companion-setup). Make Docs publishes no companion contract and rules out a plugin API. | A CI contract test runs the three commands against the pinned range in W1 R7 work P6. Ask Make Docs to publish a companion contract for them, and for a setup mode that accepts a root `AGENTS.md` or `CLAUDE.md` with a marked section that Make Docs did not write. |

**Question**: Will Make Docs publish a stable companion contract for the three commands BuildOS uses, and until it does, is a pinned version range plus a CI contract test enough to rely on them? Will that contract let Make Docs set up a folder whose root `AGENTS.md` or `CLAUDE.md` holds a marked section it did not write?

**Why it matters**: `buildos init` runs Make Docs setup for the user. BuildOS cannot safely infer or directly write another product's global or project state. Without a published contract, a Make Docs release can change these commands without notice.

**Recommendation**: Use only the three commands in PRD 20. Pass every setup choice explicitly. Pin a tested version range. Run a CI contract test that fails when the shape of a command changes. Never write Make Docs-owned files or global state. Keep reconfiguration, repair, and removal of Make Docs out of BuildOS until Make Docs publishes operations for them.

**To close**: Make Docs publishes a companion contract that covers the three commands, or the owner accepts the pinned range plus the CI contract test as the lasting contract. In both cases the CI contract test passes on the pinned range.

**Owner**: BuildOS Make Docs integration owner, with confirmation from Make Docs published authority.

**Phase/gate**: W1 R7 work P6, where the CI contract test lands; reviewed again at each Make Docs range bump.

**Required evidence**: CI contract test results on the pinned range, `buildos init` tests for Yes, No, no-TTY, and failed setup, and a record of the Make Docs version range in each BuildOS release.

**W1 R7 P6 orchestrator decision (2026-11-24, pending owner veto)**: Make Docs 2.0.9 refuses a root `AGENTS.md` or `CLAUDE.md` that it did not write, so after a No answer, and in any folder with the user's own router files, Make Docs cannot be set up later. Option A was applied: every `buildos init` output says plainly what works with the pinned Make Docs version and what does not, and gives a later or retry command only with that note ([PRD 20](./20-buildos-cli-and-distribution.md#make-docs-companion-setup)). BuildOS builds no step that moves its section aside. This question stays open until Make Docs accepts sections it did not write, or the owner accepts the limit.

**Disposition**: DI-012 stays an open question paired with R-001. W1 R7 narrowed it from a full lifecycle matrix to the three commands above.

### Q-011 Initial capability-map and PRD approval gate

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Deferred | PRD 19 was never approved. PRD 20 is the current authority for the runtime, package, and command contract. The capability map is not needed for the W1 R7 behavior port and returns with the MCP revision. | MCP revision planning (see Q-012) |

**Question**: When the MCP adapter is planned, does a capability map enumerate and disposition every capability, CLI and MCP projection, authority and state transition, dependency, compatibility obligation, non-goal, acceptance requirement, open question, and risk without inferring the contract from current directories or commands?

**Why it matters**: The current product is largely directory-driven with a small command surface. An MCP surface built against an incomplete inferred map would freeze accidental conventions and omit supported behavior.

**Recommendation**: Do not implement from PRD 19. Build the capability map in the MCP revision, from PRD 20 and the transport-neutral core that W1 R7 delivers, and review it then. The PRD 19 capability map and decision inventory are kept at `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` as input to the MCP revision. They are not current authority.

**To close**: The plan for the MCP revision includes an owner-approved capability map, or the owner decides that no map is needed.

**Owner**: BuildOS product and architecture owner.

**Phase/gate**: MCP revision planning gate, after Q-012 is decided.

**Required evidence**: Capability-by-capability review showing core use case, CLI command, MCP tool or resource parity, data authority, state transitions, inputs and outputs, dry-run and error behavior, dependencies, compatibility, non-goals, acceptance evidence, open questions, and risks.

**Disposition**: DI-017 is deferred by W1 R7. No implementation authority follows from PRD 19.

### Q-012 When to build the MCP adapter

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | The MCP adapter is out of scope for W1 R7. The core and CLI seam in [PRD 20](./20-buildos-cli-and-distribution.md#command-surface) reserves it. | Decide the revision after `0.2.0`, when the core contract is stable. Update 2026-11-27: `0.2.0` is published, so the gate of this question is now due. |

**Question**: When should BuildOS build the MCP adapter, and in which revision?

**Why it matters**: An MCP adapter would let agents call BuildOS without a shell. Building it before the core contract is stable would freeze an unproven contract in a second transport. Never deciding leaves the reserved seam unused and Q-011 and R-006 open with no owner.

**Recommendation**: Keep the core transport-neutral, as PRD 20 requires. After `0.2.0` ships, review real agent use and decide whether to start an MCP revision. That revision owns the capability map (Q-011) and the MCP schema rules (R-006). The PRD 19 capability map and decision inventory, kept at `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md`, are input to that revision for the MCP adapter. They are not current authority.

**To close**: The owner records a decision in a design: a coordinate for the MCP revision, or a decision not to build MCP.

**Owner**: BuildOS product and architecture owner.

**Phase/gate**: First planning gate after `0.2.0`.

### Q-013 CLI contract details left open by the design

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Exit code `10` means needs operator review and `1` means internal failure. The security document is `toolkits/buildos/SECURITY.md` and ships in the package. `buildos init` with no `--root` targets the current working directory. [PRD 20](./20-buildos-cli-and-distribution.md#output-and-exit-contract) states these answers. | W1 R7 work tests cover the exit codes and the default root. R-004 tracks the review of `harness-capability-matrix.md` in W1 R7 work P7. |

**Question**: The rewrite design leaves four CLI contract details open:

1. Which numeric exit code means "needs operator review"? The Go tools use `0`, `2`, `3`, `4`, `5`, and `6`.
2. Which numeric exit code means internal failure in the unified CLI? The legacy binaries use `1`.
3. Where does the enterprise security document live in the repository and in the package?
4. Which target root does `buildos init` use when `--root` is absent?

**Why it matters**: Exit codes and the default root are public contracts that agents script against. Changing them after `0.1.0` breaks callers. Enterprise reviewers need to find the security document in a stable place in both the repository and the package.

**Recommendation**: Keep `1` for internal failure, to match the legacy binaries. Give "needs operator review" an unused code that never reuses another meaning. Keep the security document at one path that is also in the package file list. For `buildos init`, either use the current folder or require `--root`; in both cases, show the resolved root in the planned writes before anything is written.

**To close**: Closed by the owner decision of 2026-11-23. PRD 20 states the answers. W1 R7 work tests cover the exit codes and the default root.

**Owner**: BuildOS maintainer.

**Phase/gate**: W1 R7 work P1 for the exit codes and the security document; W1 R7 work P6 for the `buildos init` default root.

**Resolution**: Closed on 2026-11-23 by owner decision. The owner accepted four answers:

1. Exit code `10` means "needs operator review", for example `buildos init` with no TTY and no Make Docs flag. No other code uses `10`. Exit code `1` stays internal or unexpected failure, as in the legacy tools. Codes `0`, `2`, `3`, `4`, `5`, and `6` keep their meanings.
2. The enterprise security document lives at `toolkits/buildos/SECURITY.md` and ships inside the npm package.
3. `buildos init` with no `--root` targets the current working directory. It never walks up to a parent folder to find a root.
4. `system/docs/assets/references/harness-capability-matrix.md`, which [PRD 10](./10-discovery-runs-and-qualification.md) cites, is reviewed in W1 R7 work P7 before `system/docs/` is deleted. If it is BuildOS-owned content, it moves under `system/.os/` and PRD 10's reference is updated then. If it is Make Docs content, it is deleted. R-004 tracks this step.

Answer 4 was carried out in W1 R7 work P7 on 2026-11-24: the file is Make Docs content (byte for byte the Make Docs 2.0.9 resource `make-docs://system/reference/harness-capability-matrix.md`, listed in the Make Docs install manifest), so it was deleted with `system/docs/`, and PRD 10 no longer cites it. See the [P7 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-and-validation).

[PRD 20](./20-buildos-cli-and-distribution.md) states answers 1 to 3 in `## Output and Exit Contract`, `## Project Initialization and Adoption`, `## Make Docs Companion Setup`, and `## Supply Chain`.

### Q-014 Domain ownership for playbooks, data and extraction, and stage automation

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet. [02 Module Map](./02-architecture-overview.md#module-map) states that no domain owns these areas yet. `buildos extract bulk` in [PRD 20 Command Surface](./20-buildos-cli-and-distribution.md#command-surface) already settles the owner of bulk extraction. | Decide the owner of each area before a durable command is added for it. |

**Question**: Which `buildos` domain owns each of these areas?

1. Playbook behavior beyond the intake catalog rebuild: active-only runnable-playbook resolution, which [PRD 09](./09-playbooks.md#contracts-and-data) requires when it says that only `active` playbooks run or are enforced, and playbook contract validation, including the target-resolution rule in [PRD 09](./09-playbooks.md#rebuild-notes).
2. Extraction load-plan and data helpers beyond `buildos extract bulk`, for [PRD 08](./08-data-and-extraction.md).
3. Stage-mover orchestration for [PRD 12](./12-stage-automation.md). PRD 12 states only that stage-movers call the owning domain commands and keep no durable logic in scripts.

**Why it matters**: The domain ownership rule in [02 Domain ownership](./02-architecture-overview.md#domain-ownership) says that a domain must not gain an unrelated command because it already exists, and that durable logic does not go into unmanaged scripts. With no owner, the next helper lands in the nearest domain or in a script, and ownership drifts. Stage-movers need an owning domain to call. The playbook target rule needs an owner before it can be enforced (D-008).

**Recommendation**: Decide each owner in the design that plans the first durable command for that area. Record the decision as a row in the 02 domain table, and update the 02 sentence that lists unowned areas.

**To close**: The 02 domain table names an owning domain for each of the three areas, or 02 states that an area has no command and why.

**Owner**: BuildOS product and architecture owner.

**Phase/gate**: Before a durable command is added for any of the three areas, and before stage-movers are implemented.

**Disposition**: This item tracks the domain-ownership decisions that were left open when `D-002` closed. `D-002` stays closed.

### Q-015 Wrapper order: the pinned version or a `buildos` on `PATH` first

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Pin-first. A project wrapper always runs the version pinned in `.os/manifest.json`. An installed `buildos` runs only when it is an npm install of exactly the pinned version (in the project's `node_modules` folder, or the first `buildos` on `PATH`), and no program starts to check it; else the wrapper runs the pinned version through `npx`. [PRD 06](./06-operating-layer-and-routing.md#contracts-and-data) wrapper resolution states the order. | None. The wrappers, their tests, and the documents follow it (W1 R7 P8). |

**Question**: Should a project wrapper run the version pinned in `.os/manifest.json` before a `buildos` program on `PATH` (pin-first), or keep running the program on `PATH` first (global-first)?

**Why it matters**: Rollback by version pin works only when no `buildos` is on `PATH`; with a global install, the project runs the global version whatever it pins. Pin-first makes the pin decide always, at the cost of an `npx` fetch on every first run of a version. Global-first lets an offline install work without the registry.

**Recommendation**: Pin-first. (Historical: the first design used the program on `PATH` only when it reported the pinned version. That version probe is gone; see Resolution.)

**To close**: Closed by the owner decision of 2026-11-25. PRD 06 wrapper resolution states the chosen order, and the wrappers and documents follow it.

**Owner**: BuildOS product owner.

**Phase/gate**: Before `0.1.0` ships.

**Resolution**: Closed on 2026-11-25 by owner decision (option A, pin-first). Current rule: see [PRD 06](./06-operating-layer-and-routing.md#contracts-and-data) and the last two sentences of this entry. The rest of this paragraph up to them is historical and no longer describes the wrappers. Historical first design: the wrapper found the first `buildos` program on `PATH` that is not a project wrapper and runs `buildos version --json` on it. It ran that program only when the command exited `0` and its envelope reports `ok` true, command `version`, and exactly the pinned version. In all other cases (another version, a failure, no output, output that is not the envelope, or no answer in 20 seconds) the wrapper ran the pinned version through `npx`. A `dev` pin ran only a program that reported `dev`. Every earlier safety rule stays: the PATH search skips the wrapper itself and every project wrapper, an empty or unsafe pin is refused, the Node.js version message is the same, `!` in a folder name is safe in the `.cmd` form, and the exit code passes through exactly. See [W1 R7 P8 owner decisions](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-2026-11-25). Changed on 2026-11-25 by the pin-first review round 1 (orchestrator decision): the version check that started the program on `PATH` is gone, because it ran code from `PATH` to decide whether to run it. The wrapper now reads `package.json` files only. It runs a local npm install of exactly the pinned version first, then the first `buildos` on `PATH` only when it is an npm install of exactly the pinned version, as `node <bin file>` with the same Node.js; any other layout runs the pinned version through `npx`. A `dev` pin runs only an installed source build (`0.0.0-dev`). [PRD 06](./06-operating-layer-and-routing.md#contracts-and-data) states the rules; see [Pin-First Wrappers Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#pin-first-wrappers-review-round-1). Changed again on 2026-11-25 by the pin-first review round 2 (orchestrator decision): the program that runs checks itself. Every start sets `BUILDOS_REQUIRE_VERSION` to the pin, and the BuildOS program stops with exit code `3` when its own version is another one; the `package.json` read only chooses a candidate, and a `dev` pin takes a package of any `package.json` version, so the program decides. See [Pin-First Wrappers Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#pin-first-wrappers-review-round-2).

### Q-016 Project wrappers with the legacy names

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | The project scripts print the same one-line legacy-name notice as the package legacy names (parity exception PE-016) and are removed in `0.3.0` together with the package legacy names. [PRD 20 Legacy Command Names](./20-buildos-cli-and-distribution.md#legacy-command-names) states the rule. | Remove the scripts and the package legacy names in `0.3.0`. |

**Question**: Should the project scripts `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design` (and their `.cmd` forms) print the legacy-name notice and stop working in `0.3.0`, as the package commands of those names do?

**Why it matters**: Today these scripts run `.os/scripts/buildos <domain>` and print no notice, so a skill or playbook that calls them gets no warning before `0.3.0`. PRD 20 is silent on them.

**Recommendation**: Yes: print the same one-line notice and remove them with the package names in `0.3.0`, so a single message covers every old name.

**To close**: Closed by the owner decision of 2026-11-25. PRD 20 Legacy Command Names states the rule for the project scripts, and the scripts and guide follow it.

**Owner**: BuildOS product owner.

**Phase/gate**: Before `0.1.0` ships, or with the `0.3.0` removal plan.

**Resolution**: Closed on 2026-11-25 by owner decision (option A). `.os/scripts/buildos-intake`, `buildos-discovery`, and `buildos-design`, and their `.cmd` forms, write the package's legacy-name notice line first on stderr, once, with the same words. Then they run `.os/scripts/buildos <domain>` with the arguments unchanged. Their stdout and exit code are those of the real command. They are removed in `0.3.0` together with the package legacy names. See [W1 R7 P8 owner decisions](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-2026-11-25).

### Q-017 npm package name

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | The npm package is `build-os`, unscoped, under the npm account `brucewaynedecoy`. The command stays `buildos`, and the package also has a `bin` named `build-os` for `npx -y build-os@<version>`. [PRD 20 Runtime and Package](./20-buildos-cli-and-distribution.md#runtime-and-package) states the name. | The maintainer creates the package with the placeholder `build-os@0.0.0-reserved.0` (First Publication in `toolkits/buildos/AGENTS.md`). |

**Question**: Should the package keep the scoped name `@brucewaynedecoy/buildos`, or use the unscoped name `build-os`?

**Why it matters**: The name is what people type. With `build-os`, `npm install build-os` and `npm install -g build-os` work. A package name cannot change after it is published without a second package and a deprecation.

**Recommendation**: `build-os`, before the first publish. On 2026-11-26, `build-os`, `buildos`, and `@brucewaynedecoy/buildos` did not exist on npm.

**To close**: Closed by the owner decision of 2026-11-26. PRD 20 and PRD 06 state the name, and the package, wrappers, release scripts, workflows, tests, and documents use it.

**Owner**: BuildOS product owner.

**Phase/gate**: Before `0.1.0` ships.

**Resolution**: Closed on 2026-11-26 by owner decision. The package is `build-os`. Orchestrator decisions of the same day: the command name stays `buildos` and the three legacy names stay; a `bin` named `build-os` points to `dist/buildos.js` and runs exactly as `buildos`, because npx runs the `bin` named after the package; the tarball is `build-os-<version>.tgz`, and the SBOM file stays `buildos-<version>.cdx.json`. A project wrapper refuses a package with any other name, the earlier scoped name too. See [Package Name `build-os`](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#package-name-build-os-2026-11-26).

## Rebuild Risks

### R-001 Make Docs companion public-contract dependency

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Make Docs stays a separate external product. BuildOS runs it only through the three public commands in [PRD 20](./20-buildos-cli-and-distribution.md#make-docs-companion-setup), within a pinned and tested version range. A CI contract test mitigates the risk. | Land the CI contract test in W1 R7 work P6. Rerun it at every Make Docs range bump. |

**Issue**: `buildos init` depends on Make Docs behavior that Make Docs does not publish as a companion contract. Make Docs may change `setup` flags or JSON output between releases. `buildos init` passes every setup choice explicitly, so a renamed or removed flag breaks Make Docs setup. The existing co-owned router preservation concern is one case within this dependency.

**Why it matters**: Inferring Make Docs state, writing it directly, or assuming router preservation could corrupt a Make Docs installation, lose BuildOS routing, or report a successful setup that did not happen.

**Recommendation**: Keep Make Docs external. Preserve augment-only router behavior. Call only the three public commands. Pin a tested version range. Run the CI contract test against that range, so a changed flag fails in CI before users see it. When Make Docs setup fails, finish BuildOS setup and show the exact retry command, as PRD 20 requires.

**To close**: Q-010 is closed, and the CI contract test has passed across at least one Make Docs range bump.

**Owner**: BuildOS Make Docs integration owner.

**Phase/gate**: W1 R7 work P6; reviewed at each Make Docs range bump. No direct Make Docs writes are permitted in any phase.

**Required evidence**: CI contract test results, `buildos init` tests for Yes, No, no-TTY, and failed setup, and router preservation checks.

**Disposition**: Existing R-001 reconciles DI-012; Q-010 carries the open contract question.

**W1 R7 P6 evidence (2026-11-24)**: The CI contract check passes against Make Docs 2.0.9 in an empty folder. In a folder that `buildos init` has just set up, the same `make-docs setup` call exits 1 (`backup-and-reinstall`, or `manual-review-required` when the files hold no Make Docs text), because Make Docs 2.0.9 refuses a root `AGENTS.md` or `CLAUDE.md` that it did not write, and the BuildOS package content holds both. So a Yes answer ends as `partial` in every new project today. This is the co-owned router case of this risk. It needed an owner decision; see the [W1 R7 evidence report](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p6-open-items).

**W1 R7 P6 owner decision (2026-11-24)**: The owner chose shared files with marked sections ([PRD 20](./20-buildos-cli-and-distribution.md#project-initialization-and-adoption)). Make Docs setup now runs before BuildOS writes anything, and BuildOS adds its own `buildos:begin` and `buildos:end` section to the `AGENTS.md` and `CLAUDE.md` that Make Docs writes. Observed with Make Docs 2.0.9: Yes in an empty folder now ends `complete`; a second `make-docs setup` in that folder passes and leaves `AGENTS.md` unchanged; `make-docs project state status --json` reports `ready`. The co-owned router case stays open in two forms, both because Make Docs 2.0.9 refuses a root `AGENTS.md` or `CLAUDE.md` it did not write: a folder with the user's own `AGENTS.md` or `CLAUDE.md` still ends `partial` (now with a plain tip), and the "set up later" command after a No answer fails, because the BuildOS section is then already there. See the [W1 R7 evidence report](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p6-shared-files-and-make-docs-order).

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
| Open | npm is the only channel. The scope is npm packaging, trusted publishing, provenance, SBOM, scans, and rollback by version pin, as stated in [PRD 20](./20-buildos-cli-and-distribution.md#release). Archives, Homebrew, and signing keys are withdrawn. `buildos update` and `buildos uninstall` stay with W2. | Verify the release flow and rollback by version pin in W1 R7 work P8. The deadline "before `0.1.0`" was missed: `0.1.0` was published on 2026-11-26 before the Stage 4 checks and the publication review. Owner decision 2026-11-26, option 1: the outstanding checks run on the published `build-os@0.1.0`. Done on 2026-11-26: smoke tests on three systems, provenance and digest, `PERF-002`, and a retrospective publication review. Still open: the public rollback proof, which waits for the second runnable release (`0.2.0` rolling back to `0.1.0`, F-P8-09); the owner's acceptance of the 5 smoke-output differences (A71); the owner's decision on F-P8-11 (the printed fix command `buildos entities rebuild-index ...` uses a bare `buildos` and exits 127 without a global install; candidate for `0.1.1` or `0.2.0`); and t25. Update 2026-11-27 (owner decisions): A71's five differences accepted; t25 closed by the explicit dated exception ("Yes": the retrospective publication review is the publication approval of `0.1.0`; A75's order stays missed); the public rollback proof comes after the `0.2.0` publication (dated owner exception). F-P8-11 was decided on 2026-11-26 (fixed in `0.2.0`, no `0.1.1`). Still open: the public rollback proof (F-P8-09). Update 2026-11-27: `0.2.0` is published; the npm stage approval again came before the checks and the recorded approval of the runbook, and the owner's publication approval of `0.2.0` is asked after the fact. F-P8-09 passed on macOS only. Still open: F-P8-09 on Linux and Windows, the `0.2.0` publication approval, and the W2 handoff. |

**Issue**: BuildOS ships as the npm package `build-os` (`Q-017`). The release flow, provenance, SBOM, and scans are built, and `0.1.0` was published through them on 2026-11-26. The checks on the staged package and rollback by version pin are not yet proven. Project wrappers run the version pinned in `.os/manifest.json`, so rollback depends on that pin and on earlier versions staying installable. Since the owner decision of 2026-11-25 (`Q-015`, pin-first), the pin always decides: a global install is used only when it is an npm install of exactly the pinned version; otherwise the wrapper fetches the pinned version. So rollback is the manifest edit alone, on every machine.

**Why it matters**: One npm package reduces the release surface, but it does not prove package integrity, a safe first publish, or that a project can return to an earlier version after a bad release.

**Recommendation**: Build the release flow in PRD 20: trusted publishing, a committed tarball digest, a staged publish with provenance, maintainer 2FA approval, a CycloneDX SBOM, and `npm audit` and OSV scans. Prove rollback by pinning an earlier version in `.os/manifest.json` on a copied project. Leave update, uninstall, and project sync to W2. W2 owns the remaining installation-lifecycle commands, `setup` backup and removal beyond `buildos init`, `buildos update`, and `buildos uninstall`, and their upgrade, rollback, and uninstall smoke tests. W2 also owns the managed, adopter-owned, derived, and merge-required file classifications in `.os/manifest.json`, and the upgrade compatibility notes that the earlier archive and Homebrew release contract required with each release. No PRD owns these items until the W2 design, and this item tracks them until then.

**To close**: The release owner accepts a staged package that installs and runs on macOS, Linux, and Windows, with verified provenance, SBOM, passing scans, a matching tarball digest, and a rollback by version pin on a copied project. The W2 design also accepts the handoff of the installation-lifecycle commands, their smoke tests, the upgrade compatibility notes, and the manifest ownership classifications. This item does not close before that acceptance.

**Owner**: BuildOS release owner.

**Phase/gate**: W1 R7 work P8, before `0.1.0` (this gate was missed on 2026-11-26; see the first-publication paragraph below); the W2 design for update, uninstall, sync, and the other deferred installation-lifecycle items.

**Required evidence**: Staged-package smoke tests on three operating systems, provenance and digest checks, SBOM, scan results, rollback by version pin on a copied project, and maintainer approval of the publish.

**W1 R7 P8 Stage 1 evidence**: The release workflow (`.github/workflows/buildos-release.yml`), the committed reviewed-digest file (`toolkits/buildos/release-candidates.json`), the reproducible pack check, the SBOM, and the release gates exist, and a local dry run shows each gate stopping the flow before staging. npm's documentation (checked 2026-11-24) adds a first-publish limit: a trusted publisher can only be configured for a package that already exists on npm, and `@brucewaynedecoy/buildos` does not exist yet. So the first publish needs an owner decision on how the package is created. Staged-package proof, provenance, and rollback stay open. See the [P8 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-release-010).

**W1 R7 P8 review round 1 (2026-11-24)**: The owner answered the two P8 questions with "A, A". First publication: the maintainer stages and approves a reserved-name placeholder (`0.0.0-reserved.0`, built by `toolkits/buildos/scripts/reserved-placeholder.ts`, dist-tag `reserved`) by hand, then configures npm trusted publishing for staging only, then `0.1.0` goes through the full workflow with provenance; the steps are in `toolkits/buildos/AGENTS.md` (First Publication). Repository: the orchestrator prepares a git-history rewrite on a copy (removing the removed client text and the two deleted Go binaries from old commits), the owner reviews it, the owner force-pushes it, and the owner makes the repository public before the release. Every commit SHA then changes, so SHAs cited in docs (the frozen Go baseline commits in `toolkits/buildos/test/golden/CAPTURE.md`, CI run links to commits, history records) need a mapping note after the rewrite; the P8 evidence tracks that task. The review also hardened the release workflow's trust boundary (one resolved commit, no candidate code in a job with the real list or the OIDC permission, the real list in a protected environment) and added owner settings for branch, tag, release, and environment protection ([P8 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-review-round-1)).

**W1 R7 P8 git history (2026-11-25)**: The owner replaced the history rewrite with an exact method, because after a force-push in place GitHub can still serve old commits by their hash. The current repository is renamed to `build-os-archive` and stays private for good, with the old history. A new repository `brucewaynedecoy/build-os` starts with one clean commit of the release tree, which the orchestrator prepares on a copy and the owner reviews before the first push. The deny-list check with the real list runs on that tree before the push. The new repository becomes public before the release, and every repository setting of the release checklist is made on it ([SECURITY.md](../../toolkits/buildos/SECURITY.md#owner-settings-for-releases), steps 1 to 16). No SHA mapping note is needed: commit hashes in the docs from before the public repository name commits that exist only in the private archive, and the docs say so in one sentence ([CAPTURE.md](../../toolkits/buildos/test/golden/CAPTURE.md#frozen-go-baseline)).

**Package name (2026-11-26)**: The owner chose the unscoped npm name `build-os` (`Q-017`). The first-publication steps, the placeholder, the trusted publisher, and every release check use that name. Nothing was published under the earlier name. See [Package Name `build-os`](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#package-name-build-os-2026-11-26).

**W1 R7 P8 first publication (2026-11-26)**: `build-os@0.1.0` is published on npm with provenance, through the real prepare and release runs. The release gate was missed: the owner published `0.1.0` and approved the npm stage before the Stage 4 checks on the staged package (t15 to t18) and before `PERF-002` and the publication review (t22 to t24). The orchestrator's step list put the approval first. This was an orchestration mistake, not an owner decision to skip the checks. A74 and A75 are not met, and t25 stays open. The owner decided on 2026-11-26 (option 1; see the next paragraph). This item stays open. See the [release-order departure](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md#closeout-notes) and [First Publication of 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#first-publication-of-010-2026-11-26).

**W1 R7 P8 post-publication checks (2026-11-26)**: Owner decision 2026-11-26, option 1 ("run them now on the published package"): the outstanding checks ran on the published `build-os@0.1.0`, whose bytes equal the staged and reviewed tarball, as a dated exception for `0.1.0` only. The smoke tests passed on macOS, Linux, and Windows with Node 24 through `npx -y build-os@0.1.0` (`buildos-smoke` runs 45901774926 and 45902212190); the output differs from the P6 reviewed output in 5 ways that are not version strings, each from a later recorded owner decision, phase scope, or review fix, so A71 needs the owner's acceptance. Review round 1 of pull request 5 found one defect in the published package: the `entities rebuild-index` fix command that `entities validate` prints uses a bare `buildos`, which exits 127 for an adopter with no global install; the data and the validation result are correct, the project wrapper and `npx -y build-os@0.1.0` forms of the command work, and the Go tool printed the same command (F-P8-11, owner decision open). The provenance, the registry signature, and the tarball digest are verified against the `reviewed` entry. Rollback by version pin is shown on a copied project only with a locally built, never-published earlier candidate; no earlier runnable public version exists, so the public rollback proof waits for `0.2.0` rolling back to `0.1.0` (F-P8-09). The publication review is retrospective, and A75's order stays missed for `0.1.0`. See [Post-Publication Checks of 0.1.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#post-publication-checks-of-010-2026-11-26).

**W1 R7 P9 owner decisions (2026-11-26, recorded in review round 1 of pull request 7)**: F-P8-11 is fixed in `0.2.0`, with no `0.1.1`, and BuildOS prints each fix command as `npx -y build-os@<running version> …`; a separate pull request builds it. F-P9-04: the `capability-matrix` skill gets its own BuildOS command in `0.2.0`, so that no skill needs Python; a separate pull request builds it, and the named exception of the no-Python check stays until then. See the [evidence report](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-stage-3-review-round-1-2026-11-26).

**W1 R7 P9 upgrade from 0.1.0 (2026-11-26, review round 2 of pull request 7)**: `0.2.0` changes three skills and the skills router. The guide (chapter 4, "From 0.1.0 to 0.2.0") gives tested hand steps: a backup first, only those three skills refreshed by name in the project and in each app copy, adopter changes found with a diff and made again by hand, and a rollback from the backup that a diff checks. New follow-up F-P9-08 for W2: `buildos update` refreshes only the first-party skills that changed, by name, in the project and in app copies, keeps adopter-added skills, reports adopter changes before it writes, and can undo the refresh. See the [evidence report](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p9-stage-3-review-round-2-2026-11-26).

**W1 R7 printed commands, F-P8-11 and F-P8-10 (2026-11-26)**: Built for `0.2.0` under the owner decision of 2026-11-26 (not released). Every command that BuildOS prints for the adopter to run starts with `npx -y build-os@<running version>` (a source build prints `buildos`), so it runs with no global install. The root in the printed `entities rebuild-index` command is always quoted for the shell (POSIX single quotes; Command Prompt double quotes with each `\` written once), which fixes the doubled Windows backslashes of F-P8-10. Usage lines, help text, and the legacy-name notice keep the name `buildos`. Parity exception PE-023 records the change against the Go goldens; no golden file changed. `0.1.0` keeps the defect: its readers run the printed command with the project wrapper or `npx -y build-os@0.1.0` in place of the bare `buildos`. F-P8-11 and F-P8-10 close when `0.2.0` is published and its smoke test runs a printed fix command (step 10 of `scripts/published-smoke.ts`). Review round 1 of pull request 9: on Windows the `action:` line names Command Prompt (a printed command is for `sh` on Linux and macOS and for Command Prompt with delayed expansion off on Windows, and PowerShell is not supported for it); a stop that asks for a rerun says to run the same command again; and with the npm setting `bin-links=false` an `npx` run that caches the package without its link exits 127 (tested in `sh` on macOS), and that cached copy keeps failing until it is removed. Review round 2: every shown Windows command with a folder carries the command-aware label, the PowerShell route opens `cmd /v:off`, every `init` retry advice after Make Docs ran carries `--skip-make-docs`, the adoption note names the project folder, and the smoke step runs the printed command only when the JSON field and the human line both match, then requires a current index. Review round 3, the final fix pass under the stop rule: `design promote` with `--repo-root` names the empty file to delete under that root, the adoption note's command is for after adoption completes, a Make Docs launch failure keeps the adopter's own `init` command (with `--make-docs`), and after the bad cache copy is removed the next fetch must have bin links on (`npm_config_bin_links=true` for that command, or the project wrapper; both run in `sh` on macOS). See the [evidence report](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p8-11-printed-commands-2026-11-26).

**W1 R7 P9 capability-matrix command, F-P9-04 (2026-11-26)**: Built for `0.2.0` under the owner decision of 2026-11-26 (not released). `buildos capability-matrix skeleton|assemble|fitgap|validate` replaces the Python tool `cm_build.py` that the skill embedded; it matches the pinned tool on 20 invented fixture cases (93 steps) byte for byte, with divergences SD-23 to SD-27 (review round 1 of pull request 10 added three cases and SD-27; review round 2 added one case and the path rules of SD-24; review round 3, the last under the stop rule, added one case, the `--out` rules of SD-24, and its corrected record of what is looked at outside the root). The skill calls it through the project wrapper, no skill needs Python, and the no-Python check has no exception, so A79 is met. The upgrade from `0.1.0` now refreshes four skills. Owner question Q1, a system code with a pattern character (SD-26), was built as option A while the decision was open; decided by the owner on 2026-11-27, option A: "Yes, agreed: Stop with a clear message." ([Owner Decisions of 2026-11-27](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-of-2026-11-27-020-release)). See the [evidence report](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#f-p9-04-capability-matrix-command-2026-11-26).

**W1 R7 P9 owner decisions (2026-11-27)**: For the `0.2.0` release gate, the owner accepted the five smoke output differences of A71 ("Yes"; rows 2, 3, 6a, 8, and 9 of the comparison) and recorded the dated owner exception for t16 and A72 ("I accept that order"): the public rollback proof through `npx` (F-P8-09) comes after the `0.2.0` publication, and t16 and A72 stay open until it. This entry stays open. See [Owner Decisions of 2026-11-27](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-of-2026-11-27-020-release).

**W1 R7 P8 t25 (2026-11-27)**: Owner decision, later on 2026-11-27, after the orchestrator showed the owner the retrospective publication review: "Yes", the owner accepts the retrospective publication review of 2026-11-26 as the publication approval of `build-os@0.1.0`. This closes t25 by the explicit dated exception. It does not make A75 met: for `0.1.0`, "publication happens only after a recorded maintainer approval" stays recorded as missed. The t25 checkbox stays unticked, because Stage 5 does not pass (A75). This entry stays open: the public rollback proof (F-P8-09) and the W2 handoff are still to come. See [Question for t25](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#question-for-t25).

**W1 R7 P9 publication of 0.2.0 (2026-11-27)**: `build-os@0.2.0` is published on npm (2026-11-27T17:49:05.907Z) with provenance, through dry run 46020963025, prepare run 46043008348, and release run 46043810434 (stage `6b67a1e5-e85b-49d7-a7b5-046bcb7288ca`); the registry tarball has the SHA-256 of the reviewed entry (`baf54ebf…f20da0`), and the registry smoke passed on macOS, Linux, and Windows (run 46045192196), which closes F-P8-10 and F-P8-11. Before the approval, every gate, the smoke on the dry-run tarball on three systems, and rollback by pin on that tarball (macOS) passed, and the owner accepted the tarball. The release order was missed again: the owner approved the npm stage right after the stage job, before the runbook's checks h1, h2 (second run), h4, and h5 and before the recorded publication approval (step i). The runbook already said that this gate is owner-enforced and that nothing technical stops an early approval. A81 is not met for `0.2.0`; a retrospective publication review is written, and the owner's approval is an open question. The public rollback `0.2.0` to `0.1.0` through `npx` (F-P8-09) passed on a copied project on macOS; Linux and Windows are not run, so t16 and A72 stay open. This entry stays open. See [Publication Record for 0.2.0](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#publication-record-for-020-2026-11-27).

**Disposition**: Existing R-003 reconciles DI-013. W1 R7 narrowed it from an archive, Homebrew, and signing matrix to npm packaging and rollback by version pin.

Code anchors:

- `toolkits/buildos/`
- `docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md`
- `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`
- `docs/prd/20-buildos-cli-and-distribution.md`

### R-004 Existing toolkit and deployed-project migration compatibility

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | The Node port must match the earlier Go tools, as stated in [PRD 20](./20-buildos-cli-and-distribution.md#compatibility). Mitigation: a golden parity suite, legacy command names until `0.3.0`, and `buildos init` adoption that writes only `.os/manifest.json`, the wrapper scripts, and `.os/skills/`. | Capture goldens in W1 R7 work P2. Prove parity per domain in P3–P5 and adoption in P6. In P7, before `system/docs/` is deleted, review `harness-capability-matrix.md` per the Q-013 decision and move other BuildOS-owned content out of `system/docs/`. |

**Issue**: W1 R7 replaces the Go intake, discovery, design, and entity tools with one Node package. Their wrappers, filesystem effects, outputs, exit behavior, and deployed-project cases must stay the same. Projects set up with the Go tools must keep every data file when `buildos init` adopts them. W1 R7 work P7 also deletes `system/docs/` from the source package. [PRD 10](./10-discovery-runs-and-qualification.md) still refers to `system/docs/assets/references/harness-capability-matrix.md`, and other BuildOS-owned content may sit inside `system/docs/`.

**Why it matters**: A port can change canonical files, diagnostics, or exit codes without anyone noticing. Adoption that touches user data could lose work. Deleting `system/docs/` without moving BuildOS-owned content would break PRD 10's reference and remove guidance that adopters and agents use.

**Recommendation**: Capture golden outputs from all four Go tools and the legacy names before any port. Match them byte for byte, except PDF text after whitespace normalization. Record any other difference as an explicit parity exception with a reason. Keep legacy names through the `0.2.x` releases. Byte-compare every pre-existing file before and after adoption on a copied project. Before `system/docs/` is deleted, list its BuildOS-owned content and move it to a BuildOS-owned path. Per the owner decision of 2026-11-23 (Q-013), W1 R7 work P7 reviews `system/docs/assets/references/harness-capability-matrix.md` before the deletion. If it is BuildOS-owned content, it moves under `system/.os/` and PRD 10's reference is updated then. If it is Make Docs content, it is deleted and PRD 10's reference is removed. Until P7, the file stays where it is and PRD 10 keeps its current reference. The live-root migration gate for redirect-bearing entity data is stated in [PRD 17 Adoption and live-root migration safety](./17-entity-identity-and-canonical-resolution.md#adoption-and-live-root-migration-safety): snapshot evidence, strict validation, deterministic index reproduction, and separate approvals for the package version pin and the live-data migration.

**To close**: The golden parity suite passes for every domain and legacy name. The adoption byte check passes on a copied Go-era project. BuildOS-owned content from `system/docs/` has moved. `harness-capability-matrix.md` has been moved under `system/.os/` or deleted, and PRD 10's reference matches the outcome. No live adopter project is changed without separate authorization.

**Owner**: BuildOS migration owner with each domain owner.

**Phase/gate**: W1 R7 work P2–P6 for parity and adoption; before W1 R7 work P7 deletes `system/docs/`.

**Required evidence**: Golden fixtures for intake, discovery, design, and entity operations and the legacy names; filesystem effects; JSON and text outputs; exit codes; the adoption byte check; and the `system/docs/` content inventory with its moves.

**W1 R7 P7 evidence**: The `system/docs/` and `system/.make-docs/` inventory is done: 70 files, all Make Docs-owned (69 match the Make Docs install manifest byte for byte, and the 70th is that manifest). No file was BuildOS-owned, so nothing moved. `harness-capability-matrix.md` was deleted, and PRD 10's reference was removed. Both folders are gone from the source package. The parity and adoption conditions were met in P2 to P6. This item stays open until the owner closes it. See the [P7 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-skills-and-validation).

**Disposition**: Existing R-004 reconciles DI-011 and keeps the deployed-entity compatibility obligations established by PRD 17, now under the PRD 20 compatibility contract.

Code anchors:

- [Entity consolidation and canonical resolution design](../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [PRD 17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md)
- [PRD 20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md)
- `system/docs/assets/references/harness-capability-matrix.md` (deleted in W1 R7 P7)
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
| Open | The JSON envelope in [PRD 20](./20-buildos-cli-and-distribution.md#output-and-exit-contract) is the current schema to keep stable. The MCP part of this risk is deferred with the MCP revision (Q-012). | Define envelope versioning and unknown-field rules before `0.1.0`; return to MCP schema rules in the MCP revision |

**Issue**: Agents and scripts read the `--json` envelope, diagnostics, and exit codes. Projects pin a BuildOS version in `.os/manifest.json`, so callers can meet old and new envelopes, unknown fields, or a downgrade. A later MCP adapter would add a second transport over the same results.

**Why it matters**: Unspecified schema skew can turn a safe read into misinterpretation or make a mutation unrecoverable across upgrade and rollback.

**Recommendation**: Keep the PRD 20 envelope stable. Add fields without changing the meaning of existing ones. Define unknown-field and downgrade behavior for the envelope. When the MCP revision starts, reuse the same core results so MCP never gets a second domain contract.

**To close**: The core contract owner accepts old and new envelope fixtures, unknown-field behavior, and downgrade behavior for the CLI. The MCP revision later accepts CLI and MCP result equivalence.

**Owner**: BuildOS core contract owner.

**Phase/gate**: W1 R7 work P1 for the envelope; the MCP revision for MCP schema rules.

**Required evidence**: Envelope fixtures across versions, unknown-field cases, safe read and fail-closed mutation behavior, downgrade, and, in the MCP revision, CLI and MCP result equivalence.

**Disposition**: DI-015 stays a distinct compatibility risk. W1 R7 narrowed it to the CLI envelope and deferred the MCP part.

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

### R-009 Design promotion writes a Make Docs-owned path

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open (write path only) | The design format is resolved: in a Make Docs 2.0.9 project the design follows the project's 2.0.9 template and contract (owner option B, built in W1 R7 P7 Stage 6, parity exception PE-020); the earlier layout keeps the Go text. `buildos design promote` still writes the design file under `docs/designs/` itself, which Make Docs owns. | Ask Make Docs for a public design-create operation, then move promotion onto it. Review this item at every planning gate. |

**Issue**: [PRD 20](./20-buildos-cli-and-distribution.md#command-surface) and [PRD 11](./11-flow-c-integration.md) let `buildos design promote` write under `docs/designs/`. That path belongs to Make Docs, so the command conflicts with the product boundary.

**Why it matters**: BuildOS writing a Make Docs-owned path can break Make Docs conventions or state. It also weakens the rule that BuildOS uses Make Docs only through public commands.

**Recommendation**: Keep the current behavior during the port. Ask Make Docs for a public design-create operation. When one exists, move promotion onto it and stop writing `docs/designs/` directly.

**To close**: `buildos design promote` creates designs only through a public Make Docs operation, or the owner accepts a documented exception with Make Docs agreement.

**Owner**: BuildOS maintainer.

**Phase/gate**: Every planning gate.

**W1 R7 P7 review round 1 (2026-11-24)**: Facts established with a real `buildos init --make-docs` and Make Docs 2.0.9 (`--project-resources all`). Read side: Make Docs 2.0.9 writes the design workflow at `.make-docs/system/references/design-workflow.md`, the design contract at `.make-docs/system/contracts/design-contract.md` (no longer under `references/`), the design template at `.make-docs/system/templates/design.md`, the prompts at `.make-docs/system/prompts/`, and the design router at `docs/designs/AGENTS.md`. It writes nothing under `docs/assets/`. `make-docs resource read make-docs://system/reference/design-workflow.md` returns the packed provider body (exit 0) when the local body is absent; with `--origin local` it fails (`resource-not-found`). `make-docs resource ensure` does not restore a deleted body (`projection-not-selected`); the same `make-docs setup` command that `buildos init` runs restores it. The file `.make-docs/system-resources.catalog.json` does not exist in 2.0.9, although the Make Docs router names it; `make-docs resource list` is the catalog. Promotion failed in every such project because it read only `docs/assets/`; it now reads the 2.0.9 bodies first, then the legacy layout, and otherwise stops with exit 3 and the setup command ([PRD 11](./11-flow-c-integration.md#contracts-and-data); proposed parity exception PE-017 for a project with neither layout). Write side, not changed in this round: the target `docs/designs/YYYY-MM-DD-<slug>.md` matches the 2.0.9 design contract, but the written design does not meet it. (1) The 2.0.9 template starts with YAML frontmatter (`title`, `kind: "design"`, `status: "draft"`, and `follow_on` with `route`, `next_prompt` as a `make-docs://system/prompt/...` URI, `why`, and `coordinate_handoff`); BuildOS writes none. (2) The 2.0.9 contract requires a `## Human Experience Intent` heading between `## Context` and `## Decision`; BuildOS writes none. (3) The 2.0.9 contract says the `Next Prompt` link must resolve; BuildOS writes `../assets/prompts/<prompt>`, which does not resolve in a 2.0.9 project. (4) The design text names the source path `system/docs/designs/` (the D-004 class of leak). Make Docs 2.0.9 still has no public design-create operation (`make-docs run` lists none). The owner question is recorded in the [P7 Review Round 1 evidence](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1).

**W1 R7 P7 review round 2 (2026-11-24)**: Read side only; the write format question is still with the owner. A project made by `buildos init --skip-make-docs` has no `docs/`, and promotion read it as a source checkout; every domain now treats a root `.os/` as an installed project ([PRD 05](./05-spaces-boundary-and-shipping.md#installed-project-paths)). The exit-3 stop now tells three cases apart with the rules `buildos init` uses, checked against Make Docs 2.0.9: Make Docs set up with a file missing (its setup command puts the file back), Make Docs not set up in a folder it accepts (the setup command), and a folder whose root `AGENTS.md` or `CLAUDE.md` holds no Make Docs section, which 2.0.9 refuses (the message says so and shows no command; this is the state after `buildos init --skip-make-docs`). The command is the `npx` form that `buildos init` shows, for the content root. Each design input is read inside the project only, with a 4 MiB bound; a link that leads out of the project stops with exit 3 unless `--allow-outside-root` is given. These differences from Go are in parity exception PE-017, which the owner approved on 2026-11-24.

**Owner decision (2026-11-24)**: The owner chose option B for the design write format. In a project with the Make Docs 2.0.9 layout only, a promoted design is written in the 2.0.9 form: the 2.0.9 frontmatter, an empty `## Human Experience Intent` section for the planner to fill in, a next-prompt link that resolves, and no `system/docs/` wording. A project with the old `docs/assets/` layout keeps the Go bytes exactly. This change needs a new parity exception. It is not built yet: it is a tracked task for the next W1 R7 P7 implementation pass (open item P7-O8). The write-path question above (a public Make Docs design-create operation) stays open.

**W1 R7 P7 review round 3 and Stage 6 (2026-11-24)**: Resolved: the design format. A design template read from the Make Docs 2.0.9 layout gives the 2.0.9 form, built from that template and checked against the project's design contract: the template's frontmatter filled (`title`, `kind: "design"`, `status: "draft"`, `follow_on` with route, `make-docs://system/prompt/<prompt>`, why, and coordinate handoff), every template section in order, the Human Experience Intent and Performance Evidence Candidates sections left as the template's text for the planner, a Next Prompt link to the prompt file promotion read (it resolves), and no `system/docs/` text. A template or contract of a form this BuildOS version does not know stops promotion with exit 3 before any write. A legacy template keeps the Go bytes, so every golden is unchanged (PE-020). Make Docs 2.0.9 has no command that validates a design document (its `validateDesignBody` is an internal API); `make-docs project path-hygiene validate` passes on a project with a promoted design. Also resolved on the read side: an empty Make Docs input now stops with its own message (Make Docs 2.0.9 keeps a changed managed file, so the repair is delete, then setup, checked with 2.0.9), an over-limit input stops with the size message, `--allow-outside-root` no longer widens input reads, and a copied project's checkout-identity stop is named. Still open: the write path (no public Make Docs design-create operation in 2.0.9), and the version boundary: the 2.0.9 form is checked only against the template and contract of the project, so a later Make Docs layout that moves these files or changes the template keys stops promotion (fail safe) until a BuildOS release supports it. See [P7 Stage 6](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-stage-6).

### R-010 Supply-chain exposure in enterprise installs

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | The rules in [PRD 20](./20-buildos-cli-and-distribution.md#supply-chain) apply: Node built-ins first, strict rules for outside packages, bundling, scans, SBOM, provenance, and one security document. | Write the first security document in W1 R7 work P1 and finish it in P8. |

**Issue**: BuildOS is a public package that adopters run inside enterprise systems. Any third-party code in the bundle becomes part of that exposure.

**Why it matters**: A compromised or vulnerable outside package would reach every adopter. Enterprise reviewers will not approve a package they cannot audit.

**Recommendation**: Apply the PRD 20 package rules before any outside package lands. Bundle all runtime code so `npx` never resolves new third-party versions. Install with `--ignore-scripts` in CI. Run `npm audit` and an OSV scan on every release. Keep the security document current in the same phase that adds a package.

**To close**: An enterprise engineering reviewer checks the security document against the bundle contents, the SBOM, and the scan output for `0.1.0` and finds no gap.

**Owner**: BuildOS maintainer.

**Phase/gate**: W1 R7 work P1 and P8; every release after that.

**W1 R7 P9 release of 0.2.0 (2026-11-27)**: The `0.2.0` release run 46043810434 ran the same checks: `npm audit` 0 at every level, OSV 0 findings, the SBOM valid with 57 components (7 shipped, each a row of `SECURITY.md`), the real-list deny-list scan with 0 matches, and provenance with a verified registry signature and attestation. No outside runtime package was added in `0.2.0`. See [Retrospective Publication Review (0.2.0)](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#retrospective-publication-review-020).

### R-011 Conversion accuracy after converter change

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | [PRD 07](./07-intake-and-conversion.md) owns the conversion accuracy gate. | Build the eval set and compare two candidate packages per format in W1 R7 work P4. |

**Issue**: The port replaces the Go converters with new PDF, DOCX, XLSX, and HTML libraries. A new library can drop sections, tables, headers, or footers.

**Why it matters**: Converted twins feed extraction and discovery. Lost content would silently weaken every later step.

**Recommendation**: Build a reviewed eval set with realistic files for every format. Compare two candidate packages per format on it before choosing one. Block a release when any eval file loses a section or falls below 98% text similarity to the reviewed reference.

**To close**: The chosen converters pass the eval gate for every format, and the comparison is recorded.

**Owner**: BuildOS intake domain owner.

**Phase/gate**: W1 R7 work P4; every release that changes a converter.

### R-012 Node 24 and `npx` reach in chat-app and enterprise environments

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | BuildOS requires Node 24 or newer and runs through `npx`, as stated in [PRD 20](./20-buildos-cli-and-distribution.md#runtime-and-package). Closed on 2026-11-27 by owner decision ("I think we can close it now"), against the recommendation to keep it open; see the Resolution below. | None. The earlier follow-up was the trial in the chat apps adopters use and once on a restricted network (W1 R7 P8 t17); its deadline "before `0.1.0`" was missed (`0.1.0` was published on 2026-11-26). On 2026-11-27 the owner reported one chat-app trial (the ChatGPT/Codex chat app) and one restricted-network trial done, as expected, without the detailed captures. |

**Issue**: Some chat-app sandboxes or enterprise proxies may lack Node 24 or block the npm registry.

**Why it matters**: If the agent cannot run `npx`, the adopter cannot set up or run BuildOS at all.

**Recommendation**: Wrappers use an npm install of exactly the pinned version (pin-first, `Q-015`), so an offline install of that version runs without the registry. When Node is missing or too old, the wrapper prints one plain message. Document an offline install. Keep a standalone executable with Node embedded as a fallback option if real users are blocked.

**To close**: BuildOS is tested in the chat apps adopters use, including at least one restricted network, and the offline install is documented.

**Owner**: BuildOS maintainer.

**Phase/gate**: W1 R7 work P6 and P8.

**W1 R7 P8 post-publication checks (2026-11-26)**: The guide documents the offline install (chapter 04, "Install without access to the npm registry"). Its steps ran on macOS with Node 24.22.3 in npm's offline mode with an empty cache: a global install from the registry tarball, `buildos init --skip-make-docs`, and the project wrapper ran the installed `0.1.0` with no npx. That is not a restricted-network trial. The chat-app and restricted-network trials (t17) are not done; the exact owner checklist and where its result goes are in [Owner Checklist for t17 (R-012)](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-checklist-for-t17-r-012). `PERF-002` measured the first `npx -y build-os@0.1.0 version` on one machine and network (median 725.6 ms); slow or restricted networks are outside its scope.

**W1 R7 P9 owner decision (2026-11-27)**: The owner does the chat-app and restricted-network trial (t17, A73) personally before `0.2.0`. It is not done yet, so this entry stays open until its results are recorded. See [Owner Decisions of 2026-11-27](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-of-2026-11-27-020-release).

**W1 R7 P8 t17 trials (2026-11-27, owner-reported)**: The owner did the trials of the owner checklist on 2026-11-27 and reported them in the orchestrator's chat; no agent ran or saw them. Chat-app trial: done in the ChatGPT/Codex chat app; everything went as expected, and the outputs were what the build should give. The very first time the `npx` command ran, it took about 1 minute and 18 seconds before the chat appeared to run the command again; the (apparent) second time, the agent read the output almost immediately. The chat app hides most command output from the user. Restricted-network trial: done; everything went as expected, and it did not appear that any command tried to reach the registry. The owner states that capturing the actual output and exit codes is not feasible, so the app version, operating system, permission prompts, full command text, the Make Docs answer, the folder listing, the SHA-256 line, and the error texts are not recorded. The first run of about 78 seconds is an observation whose cause is not established: the first run downloads the package, the measured first run of `PERF-002` on the maintainer's machine had a median of 725.6 ms (under one second), and the chat app's own handling of the command was not visible. With these results, A73 is met by its words. The "To close" text asks for tests "in the chat apps adopters use, including at least one restricted network", and the offline install documented: the restricted network and the offline install are covered, and one chat app was tried, owner-reported, without captures. Whether that is enough is a judgement call for the owner, so this entry stayed open. Owner question: is the one owner-reported ChatGPT/Codex trial enough to close `R-012` (A), or does `R-012` stay open until a trial in each other chat app that adopters use is recorded (B)? See [Chat-App and Restricted-Network Trials (t17)](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#chat-app-and-restricted-network-trials-t17-2026-11-27). The owner answered later on 2026-11-27 and closed this entry (Resolution below).

**Resolution**: Closed on 2026-11-27 by owner decision. The question to the owner was: the "To close" text says "tested in the chat apps adopters use, including at least one restricted network, and the offline install documented", and one chat app was tried; keep `R-012` open until more chat apps are tried, or close it now. The implementer and the orchestrator recommended keeping it open. The owner answered: "I think we can close it now." The owner closed it knowing that the recommendation was to keep it open. The closing rests on this evidence only: one chat-app trial, in the ChatGPT/Codex chat app, owner-reported, without captures; one restricted-network trial, owner-reported, without captures; and the offline install, documented in guide chapter 04 ("Install without access to the npm registry") and tested (its steps ran on macOS with Node 24.22.3 in npm's offline mode with an empty cache on 2026-11-26). No other chat app was tried, and no agent ran or saw the two trials. The first `npx` run of about 78 seconds in the chat-app trial stays recorded as an observation whose cause is not established (the `PERF-002` first-run median on the maintainer's machine and network was 725.6 ms). The standalone executable with Node embedded stays the fallback option of the Recommendation if real users are blocked. See [Owner Decisions of 2026-11-27](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#owner-decisions-of-2026-11-27-020-release) and [Chat-App and Restricted-Network Trials (t17)](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#chat-app-and-restricted-network-trials-t17-2026-11-27).

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-07-21-entity-consolidation-and-canonical-resolution.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/designs/2026-08-13-build-os-product-boundary-and-headless-operating-model.md`
- `docs/designs/2026-08-14-build-os-runtime-selection-proof.md`
- `.make-docs/archive/prds/2026-11-23/19-revise-build-os-headless-core-cli-and-mcp-program.md` (superseded legacy evidence; never approved)
- `docs/designs/2026-11-23-buildos-node-typescript-cli-rewrite.md`
- `docs/plans/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/`
- `docs/prd/20-buildos-cli-and-distribution.md`
- `docs/assets/references/output-contract.md`
- `docs/assets/references/guide-contract.md`
- `README.md`
