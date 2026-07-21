# Unified BuildOS CLI and Distribution Change Plan

**Date:** 2026-07-21

**Repository:** Build OS repository root

**Purpose:** Evolve the active BuildOS toolkit architecture from separately distributed domain binaries to one modular `buildos` executable and prepare its first verified public package without implementing project installation lifecycle behavior prematurely.

## Objective

Implement the [unified CLI and distribution design](../../designs/2026-07-21-unified-buildos-cli-and-distribution.md) after W1 R4 is complete. Completion means intake, discovery, design, and entities run through one Go module and executable; legacy names are bounded aliases with parity evidence; version `0.1.0` can be installed from verified archives and Homebrew; and the documentation and risk register distinguish current capability from the W2 project-lifecycle follow-on.

## Coordinate Decision

- Coordinate: `W1 R5`
- Classification: `revision`
- Evidence: W1 R2 established the separate `buildos-*` toolkit deployment standard. The approved architecture explicitly revises that same deployment decision, and W1 R4 seeds the replacement through `buildos entities`. W1 R5 is the next unused revision of W1 and remains tied to W1 R2 even though other initiatives exist.

## Change Classification

- Requested change type: `revision`
- Effective execution mode: `active-set evolution`
- Cleanup rewrite requested: no
- Full backlog regeneration requested: no

## Change Inputs

| Input | Format | Location | Confidence |
| ----- | ------ | -------- | ---------- |
| Unified CLI decision | Design | [Unified BuildOS CLI and Distribution](../../designs/2026-07-21-unified-buildos-cli-and-distribution.md) | Authoritative |
| Prior deployment decision | Design | [Build OS Toolkit CLI Deployment Standard](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md) | Authoritative historical baseline |
| Entity seed | Design and W1 R4 plan | [Entity Consolidation design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md) and [W1 R4 plan](../2026-07-21-w1-r4-entity-consolidation-and-canonical-resolution/00-overview.md) | Authoritative upstream implementation |
| Existing command modules | Go source | `toolkits/buildos-intake/`, `toolkits/buildos-discovery/`, `toolkits/buildos-design/` | Current implementation |
| Release-hardening gap | PRD risk | `docs/prd/03-open-questions-and-risk-register.md` R-003 | Active risk |

No unresolved choice changes the plan shape. Artifact publication, signing-key use, pushing, and replacing an installed executable remain separately authorized release operations.

## Baseline Context

- Active `docs/prd/` status: populated active set; evolve in place without renumbering or archiving.
- Impacted baseline docs: PRD 14 toolkit deployment, PRD 16 toolkit ownership, PRD 17 entity consolidation, PRD index, R-003, and affected developer and user guides.
- Discovery pass required: yes
- Discovery scope if required: verify current command mappings, flags, output and exit behavior, module dependencies, installer recipes, wrapper surfaces, and release automation before migration.

W1 R4 is an implementation prerequisite for W1 R5 code. The W1 R5 planning and PRD bundle is created before W1 R4 so `buildos entities` can seed the correct module, but R5 P1 execution starts only after W1 R4 closeout proves the shared CLI and entity contracts.

## Output Contract

- Plan directory: `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/`
  - entry point: `00-overview.md`
  - phase files: `01-unified-command-and-compatibility-contract.md` through `05-documentation-and-deprecation-closeout.md`
- New change doc: `docs/prd/18-revise-unified-buildos-cli-and-distribution.md`
- Baseline docs to annotate: PRD 14, PRD 16, PRD 17, PRD index, and R-003.
- Delta backlog: `docs/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/`
- Implementation root: `toolkits/buildos/`
- Public executable: `buildos`
- First public package version: `0.1.0`

## Change Doc Strategy

| New doc | Kind | Why it exists | Affected baseline docs |
| ------- | ---- | ------------- | ---------------------- |
| `18-revise-unified-buildos-cli-and-distribution.md` | Revision | Defines the effective one-executable command, migration, compatibility, licensing, packaging, and W2 handoff requirements. | PRD 14, PRD 16, PRD 17, R-003 |

## Baseline Annotation Plan

| Baseline doc | Impacted sections | Note verb | Target change doc |
| ------------ | ----------------- | --------- | ----------------- |
| `docs/prd/14-revise-deterministic-toolkit-deployment.md` | Binary naming, source layout, distribution | revises | `18-revise-unified-buildos-cli-and-distribution.md` |
| `docs/prd/16-revise-toolkit-ownership-boundaries.md` | Domain ownership and integration | revises | `18-revise-unified-buildos-cli-and-distribution.md` |
| `docs/prd/17-add-entity-consolidation-and-canonical-resolution.md` | Entity command and module placement | seeds | `18-revise-unified-buildos-cli-and-distribution.md` |
| `docs/prd/03-open-questions-and-risk-register.md` | R-003 | narrows only after verified release evidence | `18-revise-unified-buildos-cli-and-distribution.md` |
| `docs/prd/00-index.md` | Active change catalog and lineage | adds | `18-revise-unified-buildos-cli-and-distribution.md` |

## Architecture and Migration Target

The end state is one module at `toolkits/buildos/` with `cmd/buildos` and isolated internal packages for CLI, layout, intake, discovery, design, entities, and later lifecycle behavior. Existing domain commands migrate only after parity fixtures capture their current behavior. No package shells out to another BuildOS command. The temporary W1 R4 `pkg/entities` API and local replacements are removed after all consumers live in the unified module.

Canonical routes include:

```text
buildos intake convert
buildos intake index references
buildos intake index playbooks
buildos discovery run
buildos discovery qualify
buildos design promote
buildos entities ...
```

Legacy executable names map to the same command for one stable minor-release cycle. The initial package channels are signed release archives and Homebrew under Apache-2.0. W2 later adds `setup`, `update`, and `uninstall` lifecycle behavior to this executable.

## Dependencies

1. The W1 R5 design, PRD 18, delta backlog, and reconciliation bundle must be authoritative before W1 R4 code starts.
2. W1 R4 must close with a proven `buildos` seed, entity package, and copied-root evidence before R5 P1 implementation.
3. R5 P1 freezes shared interfaces before any domain migration.
4. R5 P2 proves command parity before old module code is removed.
5. R5 P3 proves aliases and installation rollback before packaging.
6. R5 P4 proves release artifacts and Homebrew workflows before public publication or R-003 closeout.
7. R5 P5 closes documentation and creates the W2 lifecycle handoff only from verified behavior.

## Worker Ownership

Execution should use disjoint, dependency-aware workers. The coordinator owns sequencing, interface arbitration, integration review, and commit allowlists but has no document-writing scope while delegation is available.

| Worker lane | Scope | Write Scope | Dependencies | Deliverables |
| ----------- | ----- | ----------- | ------------ | ------------ |
| Shared command contracts | CLI, layout, output, diagnostics, version, license metadata | Shared packages and their tests | W1 R4 closeout | Frozen interfaces |
| Domain migration lanes | Intake, discovery, design, and entities parity migrations | One isolated domain package per lane | Shared interfaces | Domain code and parity tests |
| Compatibility and install lane | Basename routing, aliases, install and rollback recipes | Compatibility package, recipes, and tests | Domain parity | Alias and migration evidence |
| Release lane | Cross-platform archives, checksums, SBOMs, attestations, Homebrew | Release configuration and smoke tests | Alias install evidence | Reproducible release candidates |
| Documentation lane | PRDs, guides, release and deprecation docs, W2 handoff | Assigned documentation paths only | Verified phase behavior | Naive-reader docs and reconciliation |
| Validation lane | Contract, path, link, parity, install, and staged-diff review | Fix scope assigned after audit | All producer lanes | Acceptance report and bounded fixes |

Within each phase, independent lanes may run concurrently after their shared inputs are frozen. Integration and deletion of superseded code remain serial gates.

## MCP Strategy

- Preferred servers available: jcodemunch for code discovery and signature inspection; jdocmunch for documentation discovery, section reads, and link audits.
- Fallback plan if unavailable: reindex the appropriate local source first; use `rg`, targeted direct reads, and repository-native tests only if reindexing fails.

## Validation

Overall acceptance requires:

- all Go modules and the unified module build and test during migration;
- parity tests for every migrated command before old implementation removal;
- one shared help, JSON envelope, exit-code map, root model, and version contract;
- no public `buildos-entities` or `buildos-lifecycle` binary;
- legacy aliases routed to the same executable with deprecation text on stderr;
- clean archive and Homebrew install, upgrade, uninstall, and rollback checks;
- SHA-256 manifests, CycloneDX JSON SBOMs, and signed provenance or attestations;
- supported cross-platform smoke tests;
- current-versus-future documentation language that does not overclaim W2 behavior;
- PRD, guide, risk, history, path, link, and staged-diff reconciliation;
- `git diff --check` and explicit commit allowlists.

## Phase Map

| File | Purpose |
| ---- | ------- |
| [01-unified-command-and-compatibility-contract.md](./01-unified-command-and-compatibility-contract.md) | Freeze shared command, output, diagnostic, version, compatibility, and licensing contracts. |
| [02-domain-migration.md](./02-domain-migration.md) | Move existing domains into the unified module with parity gates. |
| [03-legacy-alias-and-installation-migration.md](./03-legacy-alias-and-installation-migration.md) | Route old executable names to `buildos` and prove install and rollback behavior. |
| [04-packaging-and-release-hardening.md](./04-packaging-and-release-hardening.md) | Produce and verify the `0.1.0` archive and Homebrew release candidate. |
| [05-documentation-and-deprecation-closeout.md](./05-documentation-and-deprecation-closeout.md) | Reconcile guides and contracts, record deprecation obligations, and hand off W2 lifecycle work. |

## Handoff to Execution

This plan is approved for creation as part of the architecture gate, but W1 R5 consolidation code is explicitly deferred until W1 R4 completes. Each R5 phase requires its own tests, documentation reconciliation, history breadcrumb, explicit staged allowlist, and local commit. No push, package publication, signing-key use, or installed-binary replacement is authorized by this plan.
