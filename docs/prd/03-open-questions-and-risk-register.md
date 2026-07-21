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
| Open | None yet | Resolve before hardening stage automation |

**Question**: Should promotion gates (review-to-activate, verify-to-promote) be enforced by tooling/hooks, or remain documented conventions that humans and agents follow?

**Why it matters**: It determines how much of `system/.os/scripts/` and the stage-movers must validate state versus trust the operator, and it shapes the stage-automation phase.

**Recommendation**: None yet; lean toward convention first, with a lightweight index check, hardening to machinery only where drift appears.

**To close**: A decision recorded here and reflected in the stage-automation work.

### Q-002 Generalizing instance-specific tag values

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Closed | Use adopter-owned config under the operational layer for systems, environments, and owners | Implement the config contract, starter template, and scoped-field migration |

**Question**: How should an adopter configure the vocabulary used to scope artifacts to systems, environments, and accountable owners?

**Why it matters**: Build OS ships as a general-purpose tool; hard-coded adopter, system, or instance values would leak into reusable contracts, playbooks, data records, and generated indexes.

**Decision**: Add an adopter-owned `system/.os/config/instance.yaml` backed by `system/.os/contracts/config-contract.md` and seeded from `system/.os/templates/instance-config.yaml`. Reusable Build OS contracts define field shape and lookup rules; the instance config owns concrete `systems`, `environments`, and `owners` IDs.

**Closure rationale**: The config surface keeps reusable Build OS docs and contracts neutral while still giving each deployed instance a single authoritative place to describe its target systems, operating environments, and ownership model. Replace legacy scoped frontmatter names with `systems`, `environments`, and `owners`; do not continue `env` or `for` as contract vocabulary.

Code anchors:

- `system/.os/contracts/playbook-contract.md`
- `system/.os/contracts/config-contract.md` (planned)
- `system/.os/config/instance.yaml` (planned)
- `system/.os/templates/instance-config.yaml` (planned)
- `docs/designs/2026-06-03-adopter-owned-config-surface.md`

## Rebuild Risks

### R-001 make-docs plug-in dependency

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Track make-docs CLI behavior |

**Issue**: The operating-layer entry pointer lives in the co-owned `system/AGENTS.md`, which the make-docs CLI re-touches; a rebuild that ignores the append-only contract could lose the pointer or break `docs/` routing.

**Why it matters**: Loss of the `.os/` pointer makes the operational layer undiscoverable from the top router.

**Recommendation**: Treat top routers as augment-only and keep the `.os/` pointer above the make-docs append marker.

**To close**: Confirmed CLI preservation behavior and a documented augmentation procedure.

### R-002 Qualification cost

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Validate during the discovery phase |

**Issue**: Every promoted finding requires a deterministic, repeatable confirmation test; this is deliberate but costly at volume.

**Why it matters**: A rebuild that skips qualification to save effort would silently weaken the verify-to-promote gate.

**Recommendation**: Keep qualification mandatory; invest in reusable test scaffolds to lower per-finding cost.

**To close**: A qualification harness that makes the test cheap to produce.

Code anchors:

- `system/workspace/findings/`

### R-003 Enterprise toolkit distribution hardening

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | Distribute one Apache-2.0 `buildos 0.1.0` executable through signed release archives and Homebrew after W1 R5 proves packaging and migration behavior | Implement and verify the W1 R5 release pipeline before broad enterprise rollout |

**Issue**: Build OS now has an approved unified CLI and initial distribution contract, but the release pipeline, archive matrix, checksums, SBOMs, signed provenance or attestations, Homebrew formula, installation migration, and clean-machine evidence do not exist yet.

**Why it matters**: Enterprise adopters may block unmanaged binaries or unsigned artifacts even when unmanaged scripts have been removed. Consolidating domains into one executable reduces operational surface area, but it does not prove artifact integrity, installation ownership, upgrade safety, or rollback.

**Recommendation**: Treat unsigned source builds as development-only. Implement W1 R5 against [18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md), publish supported platform archives with SHA-256 checksums, CycloneDX JSON SBOMs, and signed provenance or attestations, then verify the checksum-pinned Homebrew formula and archive workflows through install, upgrade, rollback, uninstall, and clean-machine smoke tests.

**To close**: Verified `buildos 0.1.0` release artifacts and Homebrew installation evidence, including the supported platform matrix, checksums, SBOMs, signatures or attestations, compatibility-alias migration, upgrade, rollback, uninstall, and clean-machine smoke tests. The approved architecture and planning bundle alone are not sufficient to close this risk.

Code anchors:

- `toolkits/`
- `docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/`
- `docs/prd/18-revise-unified-buildos-cli-and-distribution.md`

### R-004 Deployed-instance entity consolidation compatibility

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | W1 R4's source-built resolver, validator, writer, index, integrations, copied-root rehearsal, and operator procedures are validated; do not mutate an installed root until that exact binary is deployed and live-data migration is separately approved | Rehearse the verified source build against a recoverable copy of the actual installed root, then approve binary deployment and live-data migration separately |

**Issue**: The current entity-record contract permits `superseded` status but does not require a canonical target or define resolver behavior.
Manually writing future-schema redirects into records managed by an older installed Build OS may break validators or tools and leave references unresolved.

**Why it matters**: A source rebuild in an environment with an existing installation can expose live records to mixed contract and tooling versions, turning non-destructive cleanup into incompatible or only partially resolved data.

**Recommendation**: Before the compatible feature is deployed, limit cleanup to inventories, candidate groups, proposed winners, and evidence-backed migration proposals outside canonical records.
PRD 17 and the W1 R4 source implementation now provide the required compatible tooling and sanitized copied-root evidence.
An adopter must still verify the exact staged binary against a recoverable copy of its own installed root in compatibility and strict modes,
approve binary deployment separately,
and only then apply approved mappings through a separately authorized and audited live-data migration.

**To close**: The redirect and extraction contracts,
`buildos entities` resolver and writer,
strict validator,
deterministic index,
redirect-aware integrations,
copied-root rollback rehearsal,
and maintainer and user procedures are validated;
the verified binary is deployed under explicit approval;
and approved proposals are migrated to the installed root with audit and rollback evidence.

Code anchors:

- [Entity consolidation and canonical resolution design](../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [PRD 17 Enhance Entity Consolidation and Canonical Resolution](./17-enhance-entity-consolidation-and-canonical-resolution.md)
- [PRD 18 Revise Unified BuildOS CLI and Distribution](./18-revise-unified-buildos-cli-and-distribution.md)
- [W1 R4 entity consolidation and canonical resolution plan](../plans/2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md)
- [Entity records contract](../../system/.os/contracts/entity-records-contract.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/designs/2026-07-21-entity-consolidation-and-canonical-resolution.md`
- `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`
- `docs/assets/references/output-contract.md`
- `docs/assets/references/guide-contract.md`
- `README.md`
