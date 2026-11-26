---
title: "Promote Qualified Findings to Designs"
path: "promote/qualified-findings/to-designs"
status: draft
version: "2026-11-24"
order: 170
tags:
  - design-promotion
  - findings
  - designs
applies-to:
  - workspace/findings
  - docs/designs
related:
  - "record-discovery-runs-and-qualify-findings.md"
  - "understand-workspace-artifacts.md"
  - "../maintainer/buildos-toolkit-cli-development.md"
  - "../../prd/02-architecture-overview.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../../prd/11-flow-c-integration.md"
  - "../../prd/20-buildos-cli-and-distribution.md"
persona: user
---

# Promote Qualified Findings to Designs


## Overview

Operational paths in this guide start at the initialized project root. It contains `.os/`, `assets/`, `playbooks/`, and `workspace/`, and `docs/` when Make Docs was set up. Source links below point into the BuildOS checkout; those source directories are not required in your project.

Use this guide after a raw discovery observation has already been qualified as a `FIND-NNN` artifact. Design promotion turns that evidence-backed finding into a design under `docs/designs/` so planning can proceed without losing the run and qualification evidence.

The owning command is `buildos design`, run through the project wrapper `.os/scripts/buildos` (`.os\scripts\buildos.cmd` on Windows). Promotion is always user-gated: Build OS should not create designs automatically just because a finding qualified.

## Before You Begin

- Work from the initialized project root.
- Confirm the project has Make Docs. Promotion reads the Make Docs design inputs (router, workflow, contract, template, and prompt) from the project. In a project that Make Docs 2.0.9 set up, they are under `.make-docs/system/` and `docs/designs/AGENTS.md`, and the design is written in the Make Docs 2.0.9 form. A project with the earlier `docs/assets/` layout gets the earlier text. When an input is missing or empty, the command stops with exit code `3` and says what to do: it shows the Make Docs setup command when Make Docs can still be set up in the folder, and says so when it cannot.
- Confirm `.os/scripts/buildos version` runs. The wrapper needs Node.js 24 or newer.
- Confirm the finding exists under `workspace/findings/FIND-NNN/`.
- Confirm `.os/data/findings.jsonl` has the same finding with `status: "qualified"`.
- Confirm the finding has a qualification test link with an anchor.
- Choose a route:
  - `baseline-plan` for a new baseline planning flow.
  - `change-plan` for additive planning against the active PRD namespace.
- Choose a clear design title and lowercase hyphenated slug.
- Do not hand-write or modify `docs/designs/` outside the make-docs design router.

## Getting Started

1. Check command help:

   ```sh
   .os/scripts/buildos help design
   ```

   Expected result: the command prints `promote finding` usage.

2. Inspect the finding:

   ```sh
   sed -n '1,220p' workspace/findings/FIND-NNN/finding.md
   ```

   Expected result: the finding identifies its origin run, raw finding anchor, qualification test, configured `systems`, `environments`, and `owners`, and has no design link unless it was already promoted.

3. Preview the hand-off:

   ```sh
   .os/scripts/buildos design promote finding --finding-id FIND-NNN --route baseline-plan --title "Design for FIND-NNN" --slug design-for-find-nnn --dry-run
   ```

   Expected result: the command reports the design path it would write without changing the finding or findings index.

4. Promote the finding:

   ```sh
   .os/scripts/buildos design promote finding --finding-id FIND-NNN --route baseline-plan --title "Design for FIND-NNN" --slug design-for-find-nnn
   ```

   Expected result: the command writes a dated design under `docs/designs/` and reports the written path.

5. Inspect the resulting links:

   ```sh
   sed -n '1,260p' workspace/findings/FIND-NNN/finding.md
   ```

   Expected result: the finding's design section links to the new design. The finding remains the evidence record; the design owns solution framing and tradeoffs.

## Core Workflow

Design promotion connects evidence to planning:

| Step | Artifact | Result |
| --- | --- | --- |
| Qualify | `workspace/findings/FIND-NNN/` | The finding has deterministic confirmation evidence. |
| Promote | `.os/scripts/buildos design promote finding` | A user chooses a planning route and design title. |
| Design | `docs/designs/YYYY-MM-DD-<slug>.md` | The design carries finding lineage, qualification evidence, configured scope, and owner metadata. |
| Trace | `finding.md` and `.os/data/findings.jsonl` | The finding records the accepted design link for later audits. |

Use `baseline-plan` when the design should feed a fresh baseline planning flow. Use `change-plan` when the design should feed additive planning against the active Build OS PRD namespace.

You may request promotion with a historical finding ID that now redirects. `buildos design` resolves it to the terminal canonical finding and reports the requested ID, canonical ID, and complete chain. The terminal finding must be `qualified`; `active` or another status is not enough for design promotion.

The losing finding and old references remain unchanged. The new design uses the canonical finding's lineage, qualification evidence, systems, environments, and owners. Only the canonical finding receives the new design back-reference. If resolution or validation fails, the command stops without leaving a partial design or finding update.

Promotion does not run the downstream plan, PRD, or work generation steps. Those remain make-docs workflows after the design exists.

## Troubleshooting

If promotion says the finding must be `qualified`, return to [Record Discovery Runs and Qualify Findings](record-discovery-runs-and-qualify-findings.md) and complete deterministic qualification first.

If promotion says the finding is missing a qualification anchor, inspect `qualification_test` in `.os/data/findings.jsonl` and the finding's qualification link. The hand-off needs a specific anchor, not only a loose file path.

If promotion says the design already exists, choose a different slug or update the existing design through the make-docs design router.

If the wrapper prints that BuildOS needs Node.js 24 or newer, install it and try again. If promotion stops with exit code `3` about a missing Make Docs input, follow the message: set up Make Docs where it says that can work, or write the design by prompt from the Make Docs template.

If promotion reports an invalid entity graph, unknown finding, or non-`qualified` canonical finding, stop and review the canonical data. Historical losing rows are not eligible for direct mutation, and the command will not create a partial promotion.

If you are unsure which route to choose, use `baseline-plan` for a new area of work and `change-plan` for a change to an already active PRD scope.

## FAQ

**Can I promote a raw finding directly?**

No. Raw findings must first become qualified findings with deterministic confirmation evidence.

**Does the design replace the finding?**

No. The finding remains the evidence-backed observation. The design owns solution framing, alternatives, consequences, and downstream planning context.

**Does promotion run the next stage automatically?**

No. Design promotion only creates the design hand-off. Later stage-mover automation is separate work.

**What happens if I promote a finding ID that was consolidated?**

The command follows its redirect chain, shows both the requested and canonical IDs, creates the design from the terminal `qualified` finding, and leaves the losing row unchanged.

## Related Resources

- [Record Discovery Runs and Qualify Findings](record-discovery-runs-and-qualify-findings.md)
- [Understand Workspace Artifacts](understand-workspace-artifacts.md)
- [BuildOS CLI Development](../maintainer/buildos-toolkit-cli-development.md)
- [02 Architecture Overview: Module Map](../../prd/02-architecture-overview.md#module-map)
- [Finding Contract](../../../system/.os/contracts/finding-contract.md)
- [11 Flow C Integration](../../prd/11-flow-c-integration.md), which owns the promotion contract and the Make Docs input order
- [20 BuildOS CLI and Distribution: Command Surface](../../prd/20-buildos-cli-and-distribution.md#command-surface)

## Future Coverage

- Add stage-mover walkthroughs after Build OS ships an approved automation path.
