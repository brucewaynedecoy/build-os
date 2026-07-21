# R5 P5 - Documentation and Deprecation Closeout

## Purpose

Reconcile the authoritative product contracts and naive-reader guides with verified unified CLI behavior, close the bounded legacy transition, and prepare the W2 project-lifecycle initiative.

## Dependency Position

- Requires P4 release-candidate evidence.
- Documentation lanes can draft independently from the same evidence set.
- Cross-link, status, and future-coverage reconciliation is the final serial gate.

## Scope

- Replace multi-tool installation instructions with the canonical `buildos` installation and command model.
- Document compatibility aliases, stderr deprecation guidance, and their exact removal release.
- Document archive and Homebrew install, upgrade, uninstall, verification, and rollback.
- Distinguish binary deployment from project data migration and W2 manifest-backed synchronization.
- Reconcile PRD 18, affected baseline PRDs, the PRD index, the W1 R5 backlog, and R-003.
- Finalize the W2 design, plan, PRD, and work handoff for lifecycle commands inside `buildos`.
- Create the phase history breadcrumb and release-readiness evidence record.

## Parallel Workstreams

| Lane | Write scope | Required perspective |
| ---- | ----------- | -------------------- |
| Developer guides | Maintainer architecture, tests, packaging, release, rollback | New maintainer with no prior module history |
| User guides | Install, verify, migrate command names, upgrade, uninstall | New operator with no Go or repository knowledge |
| Product contracts | PRD 18, annotations, index, R-003, backlog status | Effective current contract only |
| Deprecation and release notes | Alias window, removal target, compatibility notes | Existing installer upgrading safely |
| W2 handoff | Lifecycle design, plan, PRD, backlog | Future work clearly labeled, not current behavior |
| Validation | Links, paths, claims, examples, staged allowlist | Independent evidence audit |

## Deliverables

- Maintainer and user guides for the unified executable and verified distribution channels.
- Explicit compatibility-alias removal documentation.
- Reconciled PRD, backlog, risk, and history records.
- A W2 lifecycle bundle that adds `setup`, `update`, and `uninstall` to `buildos` and introduces no lifecycle binary.
- A final acceptance matrix linking each documented claim to a test or release artifact.

## Validation

- A naive maintainer can locate the module, add a domain command, run tests, build release candidates, and diagnose failures.
- A naive operator can install, verify, upgrade, roll back, and uninstall without touching project data unintentionally.
- All examples use `buildos <domain>` as canonical and label aliases as temporary.
- Current docs do not claim W2 setup, synchronization, backup, or removal behavior is already implemented.
- R-003 status matches verified checksums, SBOMs, signing, archive, and Homebrew evidence.
- Internal links, project-relative paths, command examples, and version claims pass audit.
- `git diff --check`, repository documentation checks, and explicit staged allowlists pass.

## Exit Gate

W1 R5 closes only when implementation, distribution evidence, authoritative contracts, naive-reader guides, deprecation obligations, history, and backlog status agree. The W2 handoff may then proceed as a separately approved implementation initiative.
