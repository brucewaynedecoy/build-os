---
id: PB-005
title: Inspect UI discoverability
category: discovery
execution_mode: guided-objective
state_nature: stateful
status: draft
audience: both
harness: [browser, computer-use]
systems: [primary-system]
environments: [baseline]
owners: [adopter-team]
targets: [REQ-001, CAP-001]
produces: [finding]
source_anchor: null
version: 1.0.0
related:
  - ../../.os/contracts/playbook-contract.md
  - ../../../docs/prd/09-playbooks.md
---

# Inspect UI Discoverability

## Objective

Determine whether a baseline user can discover the relevant UI entry points, labels, and navigation paths without relying on hidden implementation knowledge.

## Preconditions

- The baseline environment is reachable through an approved browser or computer-use harness.
- The inspection scope is tied to `REQ-001` and `CAP-001`.
- Any required test account, fixture data, or access constraint is known before exploration starts.
- Screenshots, URLs, labels, or notes can be captured as evidence.

## Steps & Guidance

Use the objective to guide exploration rather than following a fixed click script.

- Start from the normal baseline entry point for the primary system.
- Look for visible navigation, search, menus, calls to action, empty states, help surfaces, and labels that should expose the target capability.
- Follow likely user paths before using privileged knowledge, direct URLs, developer tools, or implementation-specific terms.
- Capture the path taken, the labels seen, the current URL or screen name, and any screenshot or transcript evidence that explains the discoverability result.
- Note access blocks, missing permissions, loading failures, or unclear states separately from true absence of a discoverable path.
- Stop when the path is clearly discoverable, clearly not discoverable, or blocked by an environmental condition that prevents a reliable answer.

## Expected Signals

Positive signals:

- A baseline user can find the target capability from visible UI cues.
- Navigation labels and screen copy match the expected task or domain language.
- Evidence includes enough path detail for another reviewer to repeat the inspection.

Negative signals:

- The target capability exists only behind hidden routes, undocumented labels, or implementation-specific terminology.
- Visible navigation points to the wrong task, dead ends, or permission states with no recovery path.
- The inspection requires direct URLs or developer knowledge to find the relevant surface.

Inconclusive signals:

- The baseline environment is unavailable or unstable.
- Required test account permissions or fixture data are missing.
- The inspected UI is clearly incomplete, behind a feature flag, or not representative of the baseline.

## Produces

- A discoverability observation with path evidence and a positive, negative, or inconclusive signal.
- A finding candidate when the target capability cannot be discovered through the baseline UI.

## Notes / Links

- [Playbook Contract](../../.os/contracts/playbook-contract.md)
- [PRD 09 Playbooks](../../../docs/prd/09-playbooks.md)
