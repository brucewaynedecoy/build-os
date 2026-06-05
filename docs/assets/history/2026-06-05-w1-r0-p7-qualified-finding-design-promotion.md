---
date: "2026-06-05"
coordinate: "W1 R0 P7"
repo: "build-os"
branch: "codex/w1-r0-p7-flow-c-integration"
status: "completed"
summary: "Implemented the user-gated qualified-finding to design promotion path."
---

# W1 R0 P7 Qualified-Finding Design Promotion

## Changes

Implemented the qualified-finding design promotion path. The pass keeps promotion user-gated, preserves the qualified finding as the evidence record, and routes solution framing into make-docs-managed designs under `system/docs/designs/`.

| Area | Change |
| --- | --- |
| Toolkit | Added `toolkits/buildos-design` with `promote finding`, route validation, qualified-state checks, qualification-anchor validation, design rendering, JSONL rewrite, `finding.md` back-reference updates, dry-run behavior, and unit/CLI tests. |
| Toolkit index | Added `buildos-design` to the root toolkit README so it is discoverable beside `buildos-intake` and `buildos-discovery`. |
| Wrapper | Added `system/.os/scripts/buildos-design` with `BUILDOS_DESIGN_BIN` override support and repo-local binary fallback. |
| Finding contract | Added explicit design-promotion rules for user gating, required finding inputs, make-docs router boundaries, design-link traceability, and stage-automation separation. |
| PRD reconciliation | Updated PRD 11 in place to replace stale `env`/`for` hand-off language with configured `systems`, `environments`, and `owners`, and to name `buildos-design` as the P7 hand-off owner. |
| Toolkit ownership | Updated PRD 16 so `buildos-design` is the implemented P7 design-promotion home while `buildos-stage` remains the candidate owner for later stage-mover orchestration. |
| Developer guide | Added the `buildos-design promote finding` reference, ownership guardrails, and reciprocal links to the P7 user guide and history record. |
| User guides | Added the draft adopter/operator guide for promoting qualified findings to designs and linked it from the getting-started, discovery, and workspace guides. |

Guide coverage decision: `both`. The durable toolkit ownership and command-surface maintenance knowledge belongs in the existing developer guide (`update-existing`), while the shipped qualified-finding to design hand-off is an adopter/operator task that needs a user guide.

PRD coverage decision: `update-existing`. No new PRD document was warranted because PRD 11 already owns qualified-finding design promotion and PRD 16 already owns toolkit-domain boundaries. The closeout updated those active docs in place and did not change the PRD index because no new PRD number or status was introduced.

Manual-test coverage decision: use a scratch repository fixture rather than the live `system/` tree because the live repo currently has no active discovery playbook workflow for end-to-end P6 setup.

## Validation

- Markdown style check for touched docs.
- `go test ./... && go build ./...` in `toolkits/buildos-design`.
- `go test ./... && go build ./...` in `toolkits/buildos-discovery`.
- `go test ./... && go build ./...` in `toolkits/buildos-intake`.
- Wrapper smoke through `BUILDOS_DESIGN_BIN`.
- Scratch-fixture promotion UAT.
- `python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json`
- `python3 system/.os/scripts/validate_config.py --self-test`
- `python3 system/.os/scripts/validate_config.py`
- `git diff --check`

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../../toolkits/buildos-design/README.md](../../../toolkits/buildos-design/README.md) | New toolkit README for the design-promotion command surface, contracts, and local build/test workflow. |
| [../../../toolkits/buildos-design/AGENTS.md](../../../toolkits/buildos-design/AGENTS.md) | New toolkit router that keeps design promotion separate from discovery, intake, and stage automation. |
| [../../../toolkits/buildos-design/CLAUDE.md](../../../toolkits/buildos-design/CLAUDE.md) | New local agent guidance for the `buildos-design` ownership boundary. |
| [../../../toolkits/README.md](../../../toolkits/README.md) | Added `buildos-design` to the current toolkit inventory. |
| [../../../system/.os/scripts/buildos-design](../../../system/.os/scripts/buildos-design) | New wrapper for the shipped operating-layer script surface. |
| [../../../system/.os/contracts/finding-contract.md](../../../system/.os/contracts/finding-contract.md) | Added design-promotion rules and traceability constraints. |
| [../../prd/11-flow-c-integration.md](../../prd/11-flow-c-integration.md) | Updated the qualified-finding design-promotion requirement to use config-backed scope metadata and `buildos-design` ownership. |
| [../../prd/16-revise-toolkit-ownership-boundaries.md](../../prd/16-revise-toolkit-ownership-boundaries.md) | Updated the toolkit inventory and baseline annotation requirements for P7 ownership. |

### Developer

| Path | Description |
| --- | --- |
| [../../guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Added the `buildos-design` reference, route semantics, and design-promotion ownership guardrails. |

### User

| Path | Description |
| --- | --- |
| [../../guides/user/promote-qualified-findings-to-designs.md](../../guides/user/promote-qualified-findings-to-designs.md) | New draft guide for user-gated promotion from qualified findings into make-docs-routed designs. |
| [../../guides/user/build-os-getting-started.md](../../guides/user/build-os-getting-started.md) | Linked design promotion into the shipped-system entry path. |
| [../../guides/user/record-discovery-runs-and-qualify-findings.md](../../guides/user/record-discovery-runs-and-qualify-findings.md) | Added the next-step link from qualified findings into design promotion. |
| [../../guides/user/understand-workspace-artifacts.md](../../guides/user/understand-workspace-artifacts.md) | Added workspace guidance for design hand-offs from qualified findings. |
