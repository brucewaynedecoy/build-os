---
title: "Promote Qualified Findings to Designs"
path: "promote/qualified-findings/to-designs"
status: draft
version: "2026-06-05"
order: 170
tags:
  - design-promotion
  - findings
  - designs
applies-to:
  - system/workspace/findings
  - system/docs/designs
related:
  - "./record-discovery-runs-and-qualify-findings.md"
  - "./understand-workspace-artifacts.md"
  - "../developer/buildos-toolkit-cli-development.md"
  - "../../prd/16-revise-toolkit-ownership-boundaries.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../../../system/docs/designs/AGENTS.md"
  - "../../../system/docs/assets/references/design-workflow.md"
  - "../../../system/docs/assets/references/design-contract.md"
---

# Promote Qualified Findings to Designs

## Overview

Use this guide after a raw discovery observation has already been qualified as a `FIND-NNN` artifact. Design promotion turns that evidence-backed finding into a design under `system/docs/designs/` so planning can proceed without losing the run and qualification evidence.

The owning toolkit is `buildos-design`. Promotion is always user-gated: Build OS should not create designs automatically just because a finding qualified.

## Before You Begin

- Work from the repository root.
- Confirm `system/.os/scripts/buildos-design` can find a binary. It uses `BUILDOS_DESIGN_BIN`, then an installed `buildos-design`, then the repo-local `toolkits/buildos-design/bin/buildos-design`.
- Confirm the finding exists under `system/workspace/findings/FIND-NNN/`.
- Confirm `system/.os/data/findings.jsonl` has the same finding with `status: "qualified"`.
- Confirm the finding has a qualification test link with an anchor.
- Choose a route:
  - `baseline-plan` for a new baseline planning flow.
  - `change-plan` for additive planning against the active PRD namespace.
- Choose a clear design title and lowercase hyphenated slug.
- Do not hand-write or modify `system/docs/designs/` outside the make-docs design router.

## Getting Started

1. Check command help:

   ```sh
   system/.os/scripts/buildos-design help
   ```

   Expected result: the command prints `promote finding` usage.

2. Inspect the finding:

   ```sh
   sed -n '1,220p' system/workspace/findings/FIND-NNN/finding.md
   ```

   Expected result: the finding identifies its origin run, raw finding anchor, qualification test, configured `systems`, `environments`, and `owners`, and has no design link unless it was already promoted.

3. Preview the hand-off:

   ```sh
   system/.os/scripts/buildos-design promote finding --finding-id FIND-NNN --route baseline-plan --title "Design for FIND-NNN" --slug design-for-find-nnn --dry-run
   ```

   Expected result: the command reports the design path it would write without changing the finding or findings index.

4. Promote the finding:

   ```sh
   system/.os/scripts/buildos-design promote finding --finding-id FIND-NNN --route baseline-plan --title "Design for FIND-NNN" --slug design-for-find-nnn
   ```

   Expected result: the command writes a dated design under `system/docs/designs/` and reports the written path.

5. Inspect the resulting links:

   ```sh
   sed -n '1,260p' system/workspace/findings/FIND-NNN/finding.md
   ```

   Expected result: the finding's design section links to the new design. The finding remains the evidence record; the design owns solution framing and tradeoffs.

## Core Workflow

Design promotion connects evidence to planning:

| Step | Artifact | Result |
| --- | --- | --- |
| Qualify | `system/workspace/findings/FIND-NNN/` | The finding has deterministic confirmation evidence. |
| Promote | `system/.os/scripts/buildos-design promote finding` | A user chooses a planning route and design title. |
| Design | `system/docs/designs/YYYY-MM-DD-<slug>.md` | The design carries finding lineage, qualification evidence, configured scope, and owner metadata. |
| Trace | `finding.md` and `system/.os/data/findings.jsonl` | The finding records the accepted design link for later audits. |

Use `baseline-plan` when the design should feed a fresh baseline planning flow. Use `change-plan` when the design should feed additive planning against the active Build OS PRD namespace.

Promotion does not run the downstream plan, PRD, or work generation steps. Those remain make-docs workflows after the design exists.

## Troubleshooting

If promotion says the finding must be `qualified`, return to [Record Discovery Runs and Qualify Findings](./record-discovery-runs-and-qualify-findings.md) and complete deterministic qualification first.

If promotion says the finding is missing a qualification anchor, inspect `qualification_test` in `system/.os/data/findings.jsonl` and the finding's qualification link. The hand-off needs a specific anchor, not only a loose file path.

If promotion says the design already exists, choose a different slug or update the existing design through the make-docs design router.

If `buildos-design` is not found, use the packaged toolkit binary from your Build OS distribution, set `BUILDOS_DESIGN_BIN`, or ask a maintainer to build `toolkits/buildos-design/bin/buildos-design`.

If you are unsure which route to choose, use `baseline-plan` for a new area of work and `change-plan` for a change to an already active PRD scope.

## FAQ

**Can I promote a raw finding directly?**

No. Raw findings must first become qualified findings with deterministic confirmation evidence.

**Does the design replace the finding?**

No. The finding remains the evidence-backed observation. The design owns solution framing, alternatives, consequences, and downstream planning context.

**Does promotion run the next stage automatically?**

No. Design promotion only creates the design hand-off. Later stage-mover automation is separate work.

## Related Resources

- [Record Discovery Runs and Qualify Findings](./record-discovery-runs-and-qualify-findings.md)
- [Understand Workspace Artifacts](./understand-workspace-artifacts.md)
- [Build OS Toolkit CLI Development](../developer/buildos-toolkit-cli-development.md)
- [PRD 16 Toolkit Ownership Boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [Finding Contract](../../../system/.os/contracts/finding-contract.md)
- [Designs Router](../../../system/docs/designs/AGENTS.md)
- [Design Workflow](../../../system/docs/assets/references/design-workflow.md)
- [Design Contract](../../../system/docs/assets/references/design-contract.md)

## Future Coverage

- Add stage-mover walkthroughs after Build OS ships an approved automation path.
