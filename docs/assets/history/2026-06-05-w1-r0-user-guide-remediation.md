---
date: "2026-06-05"
coordinate: "W1 R0"
repo: "build-os"
branch: "main"
status: "completed"
summary: "Remediated W1 R0 P1-P6 user-guide coverage by adding draft adopter/operator guides and superseding earlier none decisions."
---

# W1 R0 User Guide Remediation

## Changes

Remediated D-003 by treating shipped Build OS filesystem and toolkit operation as user-facing product behavior for adopters, operators, admins, and practitioners. The pass audited W1 R0 P1-P6 phase work, history records, README guidance, PRD/risk context, shipped `system/` routers and contracts, workspace routers, playbook indexes, and current `buildos-*` toolkit command surfaces before writing guides.

Coverage audit result: seven distinct user guide owners cover the current W1 R0 shipped surface. No additional guide was created because the remaining capabilities fit those owners without needing a separate first-success workflow or troubleshooting path.

| Phase | Shipped surface | Adopter/operator task | Expected result | Troubleshooting need | Guide owner |
| --- | --- | --- | --- | --- | --- |
| P1 | `.os` contracts, routers, data/index scaffold | Understand where Build OS authority, routing, data, indexes, scripts, and workspace artifacts live | Operator can navigate the shipped filesystem and find the right contract or router | Wrong writes to routers, contracts, data, indexes, or workspace | [Build OS Getting Started](../../guides/user/build-os-getting-started.md), [Understand Workspace Artifacts](../../guides/user/understand-workspace-artifacts.md) |
| P2 | `system/.os/config/instance.yaml`, scoped metadata guardrail, runtime-only shipping boundary, datasets placeholder | Configure adopter-owned systems, environments, owners, and dataset location | Scoped artifacts reference configured IDs; adopter datasets have a shipped home | Unknown scoped IDs, legacy fields, accidental data hiding, misplaced datasets | [Configure Adopter-Owned Metadata](../../guides/user/configure-adopter-owned-metadata.md), [Understand Workspace Artifacts](../../guides/user/understand-workspace-artifacts.md) |
| P3 | `buildos-intake convert`, converted twins, references index, manual intake fallback | Convert local source material and rebuild source references | Converted twins under `system/assets/` carry provenance; `references.json` is rebuilt | Missing toolkit binary, weak PDF output, stale reference index, overwrite decisions | [Convert Source Material With buildos-intake](../../guides/user/convert-source-material-with-buildos-intake.md) |
| P4 | `.os/data/*.jsonl`, `validate_config.py`, `buildos-intake index playbooks`, `playbooks.json` | Validate config/data and rebuild derived indexes | Validator passes; references and playbooks indexes agree with source artifacts | Bad ID prefixes, missing anchors, stale indexes, scoped metadata mismatch | [Validate System Data and Indexes](../../guides/user/validate-system-data-and-indexes.md) |
| P5 | Playbook templates, category routers, active-only `runnable_playbooks` | Review which playbooks are active and runnable | Active procedures/guardrails are separated from draft seed candidates | Draft playbooks incorrectly treated as runnable, stale playbook catalog | [Use Playbooks and Active Indexes](../../guides/user/use-playbooks-and-active-indexes.md) |
| P6 | `buildos-discovery run discovery`, `qualify finding`, workspace run/finding artifacts | Record active discovery runs and qualify raw findings with deterministic evidence | `RUN-NNN` and `FIND-NNN` artifacts plus matching JSONL rows are written | No active discovery playbook, missing evidence/test files, missing raw anchor, negative finding guard | [Record Discovery Runs and Qualify Findings](../../guides/user/record-discovery-runs-and-qualify-findings.md), [Understand Workspace Artifacts](../../guides/user/understand-workspace-artifacts.md) |
| P1-P6 | Guide map across shipped `system/` and toolkit surfaces | Find the right first-success guide for the current Build OS task | User can start with validation and move to the relevant workflow guide | Confusion between build-layer docs and shipped-system operation | [Build OS Getting Started](../../guides/user/build-os-getting-started.md) |

Created the initial `docs/guides/user/` suite with all new guides marked `status: draft`, user-facing prerequisites, first-success steps, command examples, expected results, troubleshooting, FAQ, related links, and future coverage where downstream work is known.

Updated existing developer guides with reciprocal links and corrected the prior framing that treated shipped toolkit/filesystem operation as developer-only.

Closed D-003 after the guide suite, coverage matrix, and P1-P6 supersession notes were complete.

Added concise correction notes to the P1-P6 history records so their earlier user-guide `none` outcomes are explicitly superseded by this remediation record without appending full new session summaries.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [../../prd/03-open-questions-and-risk-register.md](../../prd/03-open-questions-and-risk-register.md) | Closed D-003 after creating the user-guide suite and recording the coverage matrix. |
| [2026-06-04-w1-r0-p1-operating-layer-contracts.md](2026-06-04-w1-r0-p1-operating-layer-contracts.md) | Added a factual supersession note for the earlier P1 user-guide `none` decision. |
| [2026-06-04-w1-r0-p2-spaces-boundary-shipping.md](2026-06-04-w1-r0-p2-spaces-boundary-shipping.md) | Added a factual supersession note for the earlier P2 user-guide `none` decision. |
| [2026-06-04-w1-r0-p3-intake-conversion.md](2026-06-04-w1-r0-p3-intake-conversion.md) | Added a factual supersession note for the earlier P3 user-guide `none` decision. |
| [2026-06-04-w1-r0-p4-data-layer-extraction.md](2026-06-04-w1-r0-p4-data-layer-extraction.md) | Added a factual supersession note for the earlier P4 user-guide `none` decision. |
| [2026-06-04-w1-r0-p5-playbooks.md](2026-06-04-w1-r0-p5-playbooks.md) | Added a factual supersession note for the earlier P5 user-guide `none` decision. |
| [2026-06-05-w1-r0-p6-discovery-runs-qualification.md](2026-06-05-w1-r0-p6-discovery-runs-qualification.md) | Added a factual supersession note for the earlier P6 user-guide `none` decision. |

### Developer

| Path | Description |
| --- | --- |
| [../../guides/developer/buildos-toolkit-cli-development.md](../../guides/developer/buildos-toolkit-cli-development.md) | Added links to the companion user guides for shipped toolkit operation and corrected the guide-coverage framing. |
| [../../guides/developer/operating-layer-contracts-maintenance.md](../../guides/developer/operating-layer-contracts-maintenance.md) | Added links to the companion user guides for shipped filesystem operation and corrected the guide-coverage framing. |

### User

| Path | Description |
| --- | --- |
| [../../guides/user/build-os-getting-started.md](../../guides/user/build-os-getting-started.md) | New draft entry guide for first validation, filesystem orientation, spaces, and guide map. |
| [../../guides/user/configure-adopter-owned-metadata.md](../../guides/user/configure-adopter-owned-metadata.md) | New draft guide for configuring `systems`, `environments`, `owners`, defaults, and scoped metadata validation. |
| [../../guides/user/convert-source-material-with-buildos-intake.md](../../guides/user/convert-source-material-with-buildos-intake.md) | New draft guide for source conversion, converted twins, supported input types, references indexing, and manual fallback. |
| [../../guides/user/validate-system-data-and-indexes.md](../../guides/user/validate-system-data-and-indexes.md) | New draft guide for running validation, understanding `.os/data`, rebuilding indexes, and resolving common failures. |
| [../../guides/user/use-playbooks-and-active-indexes.md](../../guides/user/use-playbooks-and-active-indexes.md) | New draft guide for playbook categories, draft versus active status, `runnable_playbooks`, and active-only operation. |
| [../../guides/user/record-discovery-runs-and-qualify-findings.md](../../guides/user/record-discovery-runs-and-qualify-findings.md) | New draft guide for `buildos-discovery run discovery`, raw findings, qualification, and negative findings. |
| [../../guides/user/understand-workspace-artifacts.md](../../guides/user/understand-workspace-artifacts.md) | New draft guide for runs, findings, datasets, immutable artifacts, and workspace routing. |
