---
title: "Record Discovery Runs and Qualify Findings"
path: "record/discovery-runs/and-qualify-findings"
status: draft
version: "2026-06-05"
order: 150
tags:
  - discovery
  - runs
  - findings
applies-to:
  - buildos-discovery
  - system/workspace
related:
  - "./build-os-getting-started.md"
  - "./use-playbooks-and-active-indexes.md"
  - "./understand-workspace-artifacts.md"
  - "../../../toolkits/buildos-discovery/README.md"
  - "../../../system/.os/contracts/run-record-contract.md"
  - "../../../system/.os/contracts/finding-contract.md"
  - "../developer/buildos-toolkit-cli-development.md"
---

# Record Discovery Runs and Qualify Findings

## Overview

Use this guide when you need to record a discovery run and promote a raw observation into a qualified finding. The owning toolkit is `buildos-discovery`.

The live browser or computer-use harness remains external to this repository. Build OS records the playbook, targets, inputs, evidence, raw findings, outcomes, confirmation tests, and qualified finding artifacts on disk.

## Before You Begin

- Work from the repository root.
- Confirm `system/.os/scripts/buildos-discovery` can find a binary. It uses `BUILDOS_DISCOVERY_BIN`, then an installed `buildos-discovery`, then the repo-local `toolkits/buildos-discovery/bin/buildos-discovery`.
- Rebuild `system/.os/indexes/playbooks.json` and confirm an active `category: discovery` playbook exists in `runnable_playbooks`.
- Keep disposable manual-test files in a scratch copy or outside the live shippable `system/` tree unless they are real adopter evidence.
- Prepare deterministic confirmation test and evidence files before qualifying a finding.

## Getting Started

1. Check command help:

   ```sh
   system/.os/scripts/buildos-discovery help
   ```

   Expected result: the command prints `run discovery` and `qualify finding` usage.

2. Confirm an active discovery playbook:

   ```sh
   python3 -m json.tool system/.os/indexes/playbooks.json
   ```

   Expected result: `runnable_playbooks` includes at least one entry with `category: discovery`. If none exists, discovery-run recording is correctly blocked until a discovery playbook is reviewed and activated.

3. Record a discovery run:

   ```sh
   system/.os/scripts/buildos-discovery run discovery \
     --playbook-id PB-NNN \
     --outcome negative \
     --title "Discovery run title" \
     --target REQ-001 \
     --evidence path/to/evidence.png \
     --raw-finding path/to/raw-finding.md
   ```

   Expected result: the command prints `wrote system/workspace/runs/RUN-NNN (RUN-NNN)`, creates the immutable run folder, copies evidence, writes `run.md` and `raw-findings.md`, and appends one row to `system/.os/data/runs.jsonl`.

4. Qualify a raw finding:

   ```sh
   system/.os/scripts/buildos-discovery qualify finding \
     --run-id RUN-NNN \
     --raw-finding-ref raw-findings.md#raw-finding-1 \
     --outcome negative \
     --title "Qualified finding title" \
     --confirmation-test path/to/confirm.spec.ts \
     --confirmation-evidence path/to/confirmation-evidence.txt
   ```

   Expected result: the command prints `wrote system/workspace/findings/FIND-NNN (FIND-NNN)`, creates the finding folder, copies confirmation artifacts, writes qualification records, and appends one `status: "qualified"` row to `system/.os/data/findings.jsonl`.

## Core Workflow

A discovery run can have `positive`, `negative`, or `inconclusive` outcome. A qualified finding can have `positive` or `negative` outcome.

Raw findings stay in the run artifact. They do not receive `FIND-NNN` IDs and are not indexed as qualified findings until `qualify finding` confirms one with deterministic evidence.

For negative findings, the confirmation test must assert the negative condition and pass. This turns the absence or failure mode into a regression guard.

Use one of these raw-finding reference forms when qualifying:

| Form | Meaning |
| --- | --- |
| `#raw-finding-1` | Anchor inside the source run's `raw-findings.md`. |
| `raw-findings.md#raw-finding-1` | Explicit file and anchor inside the source run. |
| `system/workspace/runs/RUN-NNN/raw-findings.md#raw-finding-1` | Full project-relative raw finding reference. |

## Troubleshooting

If `run discovery` says the playbook is not active or runnable, rebuild `playbooks.json`, confirm the playbook is in `runnable_playbooks`, and confirm `category: discovery`.

If there is no active discovery playbook, do not force the current draft seed playbook into a live run. Review and activate a discovery playbook through the project gate, or use a scratch copy for manual testing.

If an evidence path fails, point the command to a real file that already exists. The toolkit copies evidence; it does not invent evidence files.

If `qualify finding` cannot find the raw anchor, inspect `system/workspace/runs/RUN-NNN/raw-findings.md` and use an anchor that exists in that run.

If a negative finding lacks a deterministic confirmation test, keep it as a raw finding until a repeatable test exists.

## FAQ

**Does Build OS run the browser or computer-use harness for me?**

No. The harness remains external. Build OS records the resulting evidence and outcome.

**Can I qualify a finding from notes that are not in a run?**

No. Qualified findings must trace back to a source `RUN-NNN` raw finding.

**Can an inconclusive run produce a qualified finding?**

Only if a raw finding from that run later has deterministic positive or negative confirmation evidence.

## Related Resources

- [Use Playbooks and Active Indexes](./use-playbooks-and-active-indexes.md)
- [Understand Workspace Artifacts](./understand-workspace-artifacts.md)
- [buildos-discovery README](../../../toolkits/buildos-discovery/README.md)
- [Run Record Contract](../../../system/.os/contracts/run-record-contract.md)
- [Finding Contract](../../../system/.os/contracts/finding-contract.md)
- [Build OS Toolkit CLI Development](../developer/buildos-toolkit-cli-development.md)

## Future Coverage

- Add live harness setup and manual UAT walkthroughs after Build OS ships an approved harness integration path and active discovery playbook workflow.
