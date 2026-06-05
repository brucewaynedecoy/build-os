---
title: "Use Playbooks and Active Indexes"
path: "use/playbooks/and-active-indexes"
status: draft
version: "2026-06-05"
order: 140
tags:
  - playbooks
  - indexes
  - active-gate
applies-to:
  - system/playbooks
  - system/.os/indexes
related:
  - "./build-os-getting-started.md"
  - "./validate-system-data-and-indexes.md"
  - "./record-discovery-runs-and-qualify-findings.md"
  - "../../../system/.os/contracts/playbook-contract.md"
  - "../../../toolkits/buildos-intake/README.md"
  - "../developer/operating-layer-contracts-maintenance.md"
---

# Use Playbooks and Active Indexes

## Overview

Use this guide when you need to find, review, or operate Build OS playbooks. Playbooks are Markdown instruments that guide humans and agents through administrative, build, discovery, and testing work.

The review-to-activate gate matters: only `status: active` playbooks are runnable as procedures or enforced as guardrails. Draft seed candidates are visible for review and authoring, but they should not run.

## Before You Begin

- Work from the repository root.
- Read the playbook's category router before operating it.
- Rebuild `system/.os/indexes/playbooks.json` after playbook frontmatter changes.
- Use `runnable_playbooks` in the generated index to confirm what can run today.

## Getting Started

1. Rebuild the playbook index:

   ```sh
   system/.os/scripts/buildos-intake index playbooks
   ```

   Expected result: the command prints `wrote system/.os/indexes/playbooks.json (<count> playbooks)`.

2. Validate the system:

   ```sh
   python3 system/.os/scripts/validate_config.py
   ```

   Expected result: playbook frontmatter and scoped metadata pass validation.

3. Review the top-level playbook router:

   ```sh
   sed -n '1,200p' system/playbooks/AGENTS.md
   ```

   Expected result: active guardrails, active procedures, and draft seed candidates are listed separately.

4. Inspect the generated runnable list:

   ```sh
   python3 -m json.tool system/.os/indexes/playbooks.json
   ```

   Expected result: `playbooks` contains the full lifecycle catalog, while `runnable_playbooks` contains only active entries.

## Core Workflow

Build OS currently uses these playbook categories:

| Category | Purpose |
| --- | --- |
| `administrative` | System setup, governance guardrails, manual fallback, and operating procedures. |
| `build` | Compiling, packaging, deploying, and build artifact workflows. |
| `discovery` | Exploration, schema checks, UI checks, and discoverability verification. |
| `testing` | Unit, integration, end-to-end, and core validation workflows. |

To operate a playbook:

1. Confirm it is active in the category router and `runnable_playbooks`.
2. Read the playbook frontmatter for `category`, `execution_mode`, `state_nature`, `harness`, `systems`, `environments`, `owners`, `targets`, and `produces`.
3. Follow the body instructions and capture the expected outputs.
4. Route evidence or run artifacts according to the playbook's `produces` field and the relevant workspace guide.

Current seeded discovery, testing, and build playbooks may be draft. A draft playbook is not a failed workflow; it is a candidate waiting for review and activation.

## Troubleshooting

If a playbook is visible in `playbooks` but not `runnable_playbooks`, check its `status`. Only active playbooks are runnable or enforced.

If an active playbook does not appear in the index, rebuild with `system/.os/scripts/buildos-intake index playbooks` and check for frontmatter errors.

If a playbook has unknown scoped metadata IDs, update `system/.os/config/instance.yaml` or the playbook fields so `systems`, `environments`, and `owners` match configured IDs.

If a discovery run command rejects a playbook, confirm the playbook has both `status: active` and `category: discovery`.

## FAQ

**Can I run a draft playbook by hand?**

Not as an active Build OS procedure. Draft playbooks are for review and authoring until they are activated.

**Why does the index include inactive playbooks at all?**

The full catalog helps review lifecycle state. The active-only `runnable_playbooks` list is the execution surface.

**Who decides whether a playbook becomes active?**

The project uses a review-to-activate gate. The exact approval mechanics may be hardened in future stage automation.

## Related Resources

- [Build OS Getting Started](./build-os-getting-started.md)
- [Validate System Data and Indexes](./validate-system-data-and-indexes.md)
- [Record Discovery Runs and Qualify Findings](./record-discovery-runs-and-qualify-findings.md)
- [Playbook Contract](../../../system/.os/contracts/playbook-contract.md)
- [buildos-intake README](../../../toolkits/buildos-intake/README.md)
- [Maintaining Operating Layer Contracts](../developer/operating-layer-contracts-maintenance.md)

## Future Coverage

- Add activation procedure details when Build OS ships stage automation or review-gate tooling.
