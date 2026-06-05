---
date: "2026-06-05"
coordinate: "W1 R0 P6"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Remediated P6 by moving discovery-run and finding-qualification behavior into buildos-discovery and restoring rejected surfaces."
---

# W1 R0 P6 Discovery Runs And Qualification

## Changes

Remediated the P6 toolkit ownership mismatch. The rejected implementation had placed Flow B commands in `buildos-intake` and added run/finding-specific logic to `validate_config.py`; this pass restored those surfaces to their intended ownership and re-homed P6 behavior in a dedicated `buildos-discovery` Go toolkit.

| Area | Change |
| --- | --- |
| Toolkit ownership | Added `toolkits/buildos-discovery/` as the P6 implementation owner. |
| Intake cleanup | Removed P6 command dispatch, runtime code, tests, README claims, and binary drift from `buildos-intake`. |
| Legacy script boundary | Removed P6 run/finding-specific validation from `validate_config.py`; run/finding validation now lives inside `buildos-discovery` write paths. |
| Wrapper and routers | Added the thin `system/.os/scripts/buildos-discovery` wrapper and workspace routers for runs, datasets, and findings. |
| Risk register | Closed D-002 after verifying P6 behavior no longer lives in the rejected surfaces. |

`buildos-discovery run discovery` records immutable `RUN-NNN` artifacts from active discovery playbooks and appends one run row to `system/.os/data/runs.jsonl`. `buildos-discovery qualify finding` promotes only deterministically confirmed raw findings into `FIND-NNN` artifacts and appends one qualified finding row to `system/.os/data/findings.jsonl`. Negative findings include a negative-assertion record tied to the passing confirmation test.

Developer-guide coverage decision: `update-existing`. Existing developer guides already own the toolkit boundary and operating-layer artifact workflow, so no new guide was created. This pass added a `buildos-discovery` command/wrapper reference to the toolkit guide and scratch-copy manual UAT guidance to the operating-layer guide so maintainers can test discovery behavior without adding disposable files to the live shippable `system/` tree.

User-guide coverage decision: `none`. P6 remains a maintainer/operator workflow in the build-layer toolkits and system routers; no end-user docs were introduced. This user-guide coverage pass found no existing `docs/guides/user/` guide to update and no shipped user task, configuration choice, adoption path, or troubleshooting flow that would justify a new user guide. Capability outcomes: `buildos-discovery run discovery` is `developer`, `buildos-discovery qualify finding` is `developer`, scratch-copy manual UAT guidance is `developer`, and user-guide coverage is `none`.

PRD coverage decision: `closed drift, no new PRD`. PRD 16 already supplies the toolkit ownership correction, so no additional PRD revision was needed after implementation. D-002 now records the remediation resolution.

Manual-test coverage decision: worthwhile. P6 adds an administrator-facing CLI and wrapper that write user-observable run and finding artifacts, so a human should exercise the flow outside the automated Go fixtures.

Manual UAT scenario produced: use a scratch copy of the repository, build `buildos-discovery`, activate `PB-005` only in the scratch playbook index, create disposable scratch input files for evidence, raw-finding text, Playwright confirmation, and confirmation evidence, record a negative discovery run, qualify that raw finding, then inspect `run.md`, `raw-findings.md`, `finding.md`, `qualification.md`, `runs.jsonl`, and `findings.jsonl`. These scratch inputs are not product artifacts and should not be added to the live `system/` tree. The scenario was smoke-verified in a temporary copy and produced `RUN-001` plus `FIND-001` with the expected negative-assertion text. User-run manual UAT result: passed; the scratch-copy commands produced the expected results. Live UAT against the current checkout remains blocked because the generated playbook index has no active `category: discovery` playbook; `PB-005` is draft and correctly blocked by the active-only gate.

## Validation

- `go test ./...` from `toolkits/buildos-intake/`
- `go test ./...` from `toolkits/buildos-discovery/`
- `go build -o bin/buildos-intake ./cmd/buildos-intake` from `toolkits/buildos-intake/`
- `go build -o bin/buildos-discovery ./cmd/buildos-discovery` from `toolkits/buildos-discovery/`
- `python3 system/.os/scripts/validate_config.py --self-test`
- `python3 system/.os/scripts/validate_config.py`
- `python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json`
- Markdown style check for touched docs
- `git diff --check`
- Scratch-copy manual UAT recipe smoke-verified `buildos-discovery run discovery` and `buildos-discovery qualify finding` without mutating the live checkout.
- User-run scratch-copy manual UAT passed with the expected output.
- Developer-guide coverage pass: Markdown style, path hygiene, placeholder search, guide published-status check, docs-index refresh, and `git diff --check` passed. The indexed broken-link scan still reports repository-wide baseline/tool limitations for template placeholders, directory links, and non-Markdown executable links; direct checks confirmed the touched P6 guide/history links resolve on disk.
- User-guide coverage pass: no user guide was created or updated because the implemented behavior remains maintainer/operator-facing. Markdown style, path hygiene, placeholder search, guide published-status check, docs-index refresh, and `git diff --check` passed. The indexed broken-link scan still reports the same repository-wide baseline/tool limitations and no new user-guide links were added.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../prd/16-revise-toolkit-ownership-boundaries.md](../../prd/16-revise-toolkit-ownership-boundaries.md) | New PRD revision that makes toolkit-domain ownership explicit and inventories the candidate/required toolkits from the active PRD set. |
| [../../prd/00-index.md](../../prd/00-index.md) | Added PRD 16 to the active namespace map and related-doc lineage. |
| [../../prd/03-open-questions-and-risk-register.md](../../prd/03-open-questions-and-risk-register.md) | Added D-002 for the P6 toolkit ownership drift. |
| [../../prd/10-discovery-runs-and-qualification.md](../../prd/10-discovery-runs-and-qualification.md) | Added the PRD 16 change note naming `buildos-discovery` as the Flow B implementation owner. |
| [../../prd/12-stage-automation.md](../../prd/12-stage-automation.md) | Added the PRD 16 change notes for stage-mover routing and transitional config validation. |
| [../../prd/14-revise-deterministic-toolkit-deployment.md](../../prd/14-revise-deterministic-toolkit-deployment.md) | Added toolkit-domain ownership as an effective requirement and linked to PRD 16. |
| [../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md](../../work/2026-06-03-w1-r0-build-os-baseline/06-discovery-runs-qualification.md) | Marked the corrective `buildos-discovery` remediation tasks complete and recorded manual UAT deferral. |
| [../../../toolkits/AGENTS.md](../../../toolkits/AGENTS.md) | Added toolkit scope-contract and ownership preflight guardrails. |
| [../../../toolkits/buildos-intake/AGENTS.md](../../../toolkits/buildos-intake/AGENTS.md) | Added intake-specific guardrails forbidding non-intake Flow B/config/stage behavior. |
| [../../../toolkits/buildos-discovery/](../../../toolkits/buildos-discovery/) | Added the dedicated P6 discovery-run and finding-qualification toolkit. |
| [../../../system/.os/scripts/buildos-discovery](../../../system/.os/scripts/buildos-discovery) | Added the thin wrapper for the packaged discovery toolkit. |
| [../../../system/workspace/](../../../system/workspace/) | Added workspace routers for run, dataset, and finding artifacts. |

### Developer

| Path | Description |
| --- | --- |
| [../../guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Added toolkit ownership guardrails, removed incorrect `buildos-intake` run/finding guidance, recorded `buildos-discovery` as the implemented P6 home, and added the command/wrapper reference for maintainers. |
| [../../guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Updated discovery-run and finding-qualification maintenance guidance to use `buildos-discovery` and added scratch-copy manual UAT guidance for sterile live `system/` maintenance. |

### User

None this session.
