---
id: PB-NNN
title: <imperative title>
category: administrative
execution_mode: inferred-actions
state_nature: stateful
status: draft
audience: both
harness: [none]
systems: []
environments: []
owners: []
targets: []
produces: [run-record]
source_anchor: null
version: 1.0.0
related: []
---

# <Playbook Title>

## Objective

<The stateful outcome an agent should pursue while inferring the necessary actions.>

## Preconditions

- <Required prior state, artifact, approval, environment, or access.>
- <State that must not be present before this procedure starts.>

## Steps & Guidance

State model:

- <Starting state the agent must identify.>
- <Target state the agent should reach.>
- <State changes that are prohibited or require escalation.>

Inference rules:

- <How the agent should select state-changing actions from current evidence.>
- <How the agent should verify, pause, rollback, or escalate after each state change.>

Action record:

- <What state observations, decisions, evidence, or commands the agent must record.>

## Expected Signals

Positive signals:

- <Evidence that the intended state was reached and verified.>

Negative signals:

- <Evidence that inferred actions produced unsafe or unexpected state.>

Inconclusive signals:

- <Evidence that the current state cannot be verified yet.>

## Produces

- <Run record, dataset, finding, or other artifact produced by this procedure.>

## Notes / Links

- <Relative link to relevant contracts, source anchors, or supporting docs.>
