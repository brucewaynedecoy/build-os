# BuildOS Toolkit CLI Deployment Standard Change Plan

> In v2, plans are directories. This is the `00-overview.md` entry point; phase detail lives in [`01-prd-guide-design-lineage.md`](01-prd-guide-design-lineage.md) and [`02-toolkit-scaffold-validation.md`](02-toolkit-scaffold-validation.md).

**Date:** 2026-06-04

**Repository:** Build OS (`./`)

**Purpose:** Preserve the W1 R2 prerequisite lineage for implementing the toolkit CLI deployment standard described in [2026-06-04-buildos-toolkit-cli-deployment-standard.md](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md), so W1 R0 P3 can resume against `buildos-intake` instead of unmanaged converter scripts.

**Backfill Note:** The implementation landed before this plan directory was created. This plan is a closeout/backfill artifact requested to preserve Build OS planning and work-backlog lineage.

## Objective

Close W1 R2 as a prerequisite change that makes packaged first-party CLI toolkits the Build OS standard for durable deterministic logic. The plan captures the PRD revision, affected baseline annotations, developer guidance, make-docs maintainer handoff, root `toolkits/` scaffold, and validation strategy needed before W1 R0 P3 resumes.

## Coordinate Decision

- Coordinate: W1 R2.
- Reason: W1 R0 remains the baseline Build OS rollout, W1 R1 owns adopter-owned config, and this change is a prerequisite revision that interrupts W1 R0 P3 before converter implementation begins.
- Scope boundary: W1 R2 defines and scaffolds the toolkit standard. It does not implement converter behavior, port `validate_config.py`, or modify make-docs-owned references, contracts, templates, or imported assets.

## Change Classification

| Dimension | Decision |
| --- | --- |
| Change kind | PRD revision plus repository scaffold |
| Execution status | Backfilled after implementation |
| User-facing behavior | None yet |
| Developer-facing behavior | New toolkit source namespace and maintainer guidance |
| Runtime behavior | None added |
| Downstream consumer | W1 R0 P3 intake/conversion implementation |

## Change Inputs

- [2026-06-04-buildos-toolkit-cli-deployment-standard.md](../../designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- [2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md](../../designs/2026-06-04-make-docs-buildos-toolkit-cli-import-strategy.md)
- [14-revise-deterministic-toolkit-deployment.md](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [07-intake-and-conversion.md](../../prd/07-intake-and-conversion.md)
- [03-intake-conversion.md](../../work/2026-06-03-w1-r0-build-os-baseline/03-intake-conversion.md)

## Baseline Context

The W1 R0 baseline originally positioned `system/.os/scripts/` as the implementation home for deterministic converter processes. W1 R2 revises that baseline: `system/.os/scripts/` remains a wrapper/router/documentation surface, while durable deterministic logic belongs in packaged `buildos-*` toolkits under `toolkits/`.

This change is deliberately local-first and dependency-minimal:

- Go is the default implementation language for new deterministic toolkits.
- Standard library first is the default dependency posture.
- Network or service calls are disallowed unless a design explicitly approves them and the CLI requires opt-in flags.
- The first downstream toolkit target is `buildos-intake`.

## Output Contract

The prerequisite is complete when these outputs exist and validate:

- PRD 14 defines the effective toolkit deployment requirement.
- The affected baseline PRDs reference PRD 14 through change notes.
- R-003 tracks unresolved enterprise signing, SBOM, installer, and distribution hardening.
- The developer guide documents how to create, revise, and convert deterministic toolkits.
- The make-docs handoff design records what must change upstream before imported make-docs-owned assets move.
- `toolkits/` exists with root routers and scaffold-only `toolkits/buildos-intake/`.
- Root README routes deterministic toolkit contributors to `toolkits/`.

## Change Doc Strategy

Use a PRD revision rather than rewriting the W1 R0 baseline in place. PRD 14 states the effective requirement and the baseline PRDs keep their original context with concise change notes.

The make-docs strategy stays in a design record, not a local asset migration. make-docs-owned references, contracts, templates, and imported assets should change upstream first and then be imported back later.

## Baseline Annotation Plan

| Target | Annotation |
| --- | --- |
| `02-architecture-overview.md` | Add `toolkits/` as the source and build metadata home for packaged deterministic CLIs. |
| `06-operating-layer-and-routing.md` | Revise `.os/scripts/` from durable logic home to wrapper/router surface. |
| `07-intake-and-conversion.md` | Route W1 R0 P3 converter/index logic through `buildos-intake`. |
| `12-stage-automation.md` | Require deterministic command runners to call packaged `buildos-*` toolkits where applicable. |
| `03-open-questions-and-risk-register.md` | Add R-003 for enterprise distribution hardening. |

## Worker Ownership

| Worker | Scope | Write Scope | Dependencies | Deliverables |
| --- | --- | --- | --- | --- |
| Coordinator | PRD reconciliation, naming, integration, validation | Cross-doc integration and final review | Source design and current PRD set | W1 R2 plan/work lineage, final diff review, validation report. |
| Worker A | PRD revision and baseline annotations | `docs/prd/` | Source design and existing W1 R0/W1 R1 PRDs | PRD 14, PRD index entry, baseline change notes, R-003. |
| Worker B | Developer guide and standard design | `docs/guides/developer/`, `docs/designs/` | Guide and design contracts | Toolkit CLI guide and deployment-standard design. |
| Worker C | make-docs handoff | `docs/designs/` | make-docs boundary and future installer direction | Upstream maintainer handoff design with no local asset migration. |
| Worker D | Toolkit scaffold and README routing | `toolkits/`, `README.md` | PRD 14 naming and scope | `toolkits/` routers, scaffold-only `buildos-intake`, root README update. |
| Worker E | Review and validation | Validation commands and diff checks | Workers A-D complete | Boundary scan, link check, config/path validation, index refresh. |

## MCP Strategy

- Use jdocmunch for documentation discovery, router lookup, and contract/example retrieval when available.
- Use jcodemunch for code index refresh and code discovery when code changes exist or the repo instruction requires refresh.
- Fall back to direct file reads only when exact snippets are needed or an indexed content section is unavailable.

## Validation

Run these checks before closeout:

```sh
python3 system/.os/scripts/validate_config.py --self-test
python3 system/.os/scripts/validate_config.py
python3 .make-docs/scripts/check_path_hygiene.py --self-test
python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json
git diff --check
```

Also run a targeted relative-link check for touched docs and confirm no make-docs-owned asset/template/reference paths changed except the allowed history breadcrumb.

## Phase Map

| Phase | Detail | Purpose |
| --- | --- | --- |
| P1 | [PRD, Guide, and Design Lineage](01-prd-guide-design-lineage.md) | Capture the effective requirement, affected baseline notes, developer guidance, and make-docs handoff. |
| P2 | [Toolkit Scaffold and Validation](02-toolkit-scaffold-validation.md) | Add the `toolkits/` source namespace, scaffold `buildos-intake`, update README routing, and validate. |

## Handoff To Execution

After W1 R2 closeout, resume W1 R0 P3 by revising its plan/backlog around `toolkits/buildos-intake/` and the `buildos-intake` binary. Do not continue from the old assumption that durable converter/index behavior belongs directly in unmanaged scripts.
