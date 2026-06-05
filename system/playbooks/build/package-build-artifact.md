---
id: PB-004
title: Package build artifact
category: build
execution_mode: explicit-steps
state_nature: standing
status: draft
audience: both
harness: [shell]
systems: [primary-system]
environments: [baseline]
owners: [platform-owner]
targets: [REQ-001, CAP-001]
produces: [run-record, build-artifact]
source_anchor: null
version: 1.0.0
related:
  - ../../.os/contracts/playbook-contract.md
  - ../../../docs/prd/09-playbooks.md
---

# Package Build Artifact

## Objective

Create a reproducible package artifact for the baseline system and capture enough evidence for review, handoff, or later run-record storage.

## Steps & Guidance

1. Confirm the package target, version, source revision, and expected output directory before running any build command.
2. Read the local build, packaging, or release instructions that apply to the primary system. If more than one command is available, choose the standing package command over ad hoc shell steps.
3. Start from a clean command context. Record the working directory, command, relevant environment variables, and source revision.
4. Run the package command without changing source-controlled files unless the build instructions explicitly require generated outputs.
5. Capture stdout, stderr, exit status, duration, and the final artifact path.
6. Verify that the artifact exists, is non-empty, and can be identified by name, version, size, and checksum.
7. Record any build warnings that affect reproducibility, portability, or artifact trust.
8. If the package command fails, preserve the first failing command, relevant log excerpt, and any generated partial artifact details.

## Expected Signals

Positive signals:

- The package command exits successfully.
- The artifact path, size, checksum, source revision, and package command are captured.
- Re-running the same command in the same source revision is expected to produce an equivalent artifact.

Negative signals:

- The package command succeeds but no artifact can be located.
- The artifact cannot be tied to a source revision, package command, or version.
- The build requires undocumented manual changes or untracked source edits.

Inconclusive signals:

- The repository does not expose a package command for the baseline system.
- Required credentials, signing keys, or environment dependencies are unavailable.

## Produces

- A package artifact reference with path, size, checksum, version, and source revision.
- Run evidence that can be promoted into a run record when run storage is available.

## Notes / Links

- [Playbook Contract](../../.os/contracts/playbook-contract.md)
- [PRD 09 Playbooks](../../../docs/prd/09-playbooks.md)
