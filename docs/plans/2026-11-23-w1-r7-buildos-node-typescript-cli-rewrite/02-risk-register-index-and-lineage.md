# 02 Risk Register, Index, and Lineage

## Purpose

Name every change to the shared PRD surfaces and lineage records. The assembly worker owns all of them.

## Risk Register

Target: `docs/prd/03-open-questions-and-risk-register.md`. Keep the fixed sections. Never renumber. Each new item starts with the `Status`, `Decision`, `Follow-Up` table and includes `Question` or `Issue`, `Why it matters`, `Recommendation`, and `To close`.

### Existing items to update

| Item | Change | New status |
| --- | --- | --- |
| `Q-010` Make Docs public companion contract verification | Record the W1 R7 dependency contract: pinned range, `--version`, `project state status --json`, `setup --json`, CI contract test. Make Docs has no published companion contract and rules out a plugin API. | `Open` (narrowed) |
| `Q-011` Initial capability-map and PRD approval gate | PRD 19 was never approved and is superseded by PRD 20 for runtime, package, and command contract. The capability map returns with the MCP revision. | `Deferred`, follow-up: MCP revision planning |
| `R-001` Make Docs companion public-contract dependency | Same contract as `Q-010`; add the risk that Make Docs changes setup flags. | `Open` (mitigated by CI contract test) |
| `R-003` Build OS packaging, upgrade, rollback, and removal hardening | Scope becomes npm packaging, trusted publishing, provenance, SBOM, scans, and rollback by version pin. Archives, Homebrew, and signing keys are withdrawn. `update` and `uninstall` stay with W2. | `Open` |
| `R-004` Existing toolkit and deployed-project migration compatibility | Mitigation: golden parity suite, legacy aliases until `0.3.0`, and `init` adoption that writes only manifest, wrappers, and skills. | `Open` |
| `R-006` Request, result, receipt, and MCP schema compatibility | MCP part deferred with the MCP revision; the JSON envelope in PRD 20 is the current schema to keep stable. | `Open` (narrowed) |

### New items

| Item | Title | Status | Summary |
| --- | --- | --- | --- |
| `D-005` | Legacy editorial PRDs fail PRD authority validation | `Open` | PRDs 13–19 use editorial names, kinds, or headings (93 validator findings on 2026-11-23). PRD 20 and the current-authority map keep the set truthful in the meantime. Follow-up: the prioritized cleanup in [05](./05-legacy-prd-cleanup-handoff.md). To close: `make-docs run prd authority validate` passes with zero findings and every requirement in 13–19 has a product owner. |
| `Q-012` | When to build the MCP adapter | `Open` | The core/CLI seam reserves it. Decide the revision after `0.2.0`, when the core contract is stable. |
| `R-009` | Design promotion writes a Make Docs-owned path | `Open` | `buildos design promote` writes under `docs/designs/`, against the product boundary. Recommendation: ask Make Docs for a public design-create operation, then move promotion onto it. Owner: BuildOS maintainer. Review at every planning gate. |
| `R-010` | Supply-chain exposure in enterprise installs | `Open` | Third-party code in a public package used in enterprise systems. Mitigation: PRD 20 supply-chain rules, bundling, scans, SBOM, provenance, security document. |
| `R-011` | Conversion accuracy after converter change | `Open` | New PDF, DOCX, XLSX, and HTML libraries can lose content. Mitigation: reviewed eval set, two-candidate comparison, section and 98% similarity gate. |
| `R-012` | Node 24 and `npx` reach in chat-app and enterprise environments | `Open` | Some sandboxes or proxies may lack Node 24 or block the npm registry. Mitigation: plain wrapper message, `PATH` first, documented offline install. To close: tested in the chat apps adopters use. Fallback option: a standalone executable. |

## Index

Target: `docs/prd/00-index.md`.

- Add PRD 20 to `## Document Map` with kind `subsystem`, status `active`, its related docs, and focus "The `buildos` command, package, initialization, companion setup, supply chain, release, and packaged skills."
- Set PRDs 14, 18, and 19 to status `superseded` with focus text that names PRD 20 as current authority. Do not change their kinds in this plan; the cleanup owns kind and name changes.
- Add `## Current Authority Map` after `## Document Map`. It lists each topic and its one current owner, so a reader or agent never takes a legacy PRD as current: runtime and package → 20; command and output contract → 20; legacy names → 20; project initialization → 20 and 05; Make Docs companion → 20, 05, 11; wrappers and skills routing → 06; conversion → 07; config validation → 13; domain ownership → 16 (legacy name, current content); entities → 17 (legacy name, current content); architecture → 02.
- Update `## Reading Order` and `## Audience Paths` so CLI and distribution readers go to PRD 20, not 14, 18, or 19.
- Add the rewrite design and this plan to `## Source Anchors`.

## Superseded Banners

Add one short blockquote under the H1 of PRDs 14, 18, and 19. The links are relative to `docs/prd/`:

```md
> **Status: superseded.** This document is not current authority for runtime, deployment, command contract, or distribution. The current authority is [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md). See the [Current Authority Map](./00-index.md#current-authority-map).
```

PRD 19 also notes that it was never approved. No other text in these PRDs changes in this plan.

## Lineage Records

| Record | Change |
| --- | --- |
| `docs/plans/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-overview.md` | Add `## Change History` entry of kind `revision-wave` linking W1 R7 |
| `.make-docs/archive/work/2026-07-21-w1-r5-unified-buildos-cli-and-distribution/00-index.md` | Execution-status line names W1 R7 as the current successor; `## Change History` entry of kind `revision-wave` |
| `docs/plans/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation/00-overview.md` | `## Change History` entry of kind `revision-wave`: superseded by W1 R7; MCP deferred (`Q-012`) |
| `.make-docs/archive/work/2026-08-14-w1-r6-build-os-phase-1-capability-map-prd-reconciliation-delta/00-index.md` | Execution-status line "Superseded by W1 R7. Do not execute."; `## Change History` entry of kind `revision-wave` |
| `docs/designs/2026-07-21-unified-buildos-cli-and-distribution.md`, `docs/designs/2026-08-14-build-os-runtime-selection-proof.md` | No edit. The new design's `## Design Lineage` records the relationship. |

Each `## Change History` entry uses PRD decision `update-existing` and links the rewrite design as source.
