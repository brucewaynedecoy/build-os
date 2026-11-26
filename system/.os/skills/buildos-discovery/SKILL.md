---
name: buildos-discovery
description: Record Build OS discovery runs, handle positive and negative finding workflows, apply guardrails, and guide review gates. Use when playbooks produce evidence, raw findings, or candidates for qualification.
---

# Build OS Discovery

Use this skill when running or recording a Build OS discovery workflow from an active playbook.

## Rules

- Read `.os/AGENTS.md`, `playbooks/AGENTS.md`, `workspace/runs/AGENTS.md`, `workspace/findings/AGENTS.md`, and relevant contracts.
- Only active playbooks are runnable.
- Guardrail playbooks constrain the session; do not execute guardrails as discovery runs.
- Do not fabricate evidence.
- Raw findings remain in run artifacts until qualification.
- Qualification requires deterministic confirmation evidence and user approval.

## Run workflow

1. Inspect `.os/indexes/playbooks.json` and confirm the selected playbook is active and runnable.
2. Summarize applicable guardrails.
3. Execute or guide the playbook using the available harness.
4. When evidence and raw finding text exist, record the run:

   ```sh
   .os/scripts/buildos discovery run discovery --playbook-id <PB-NNN> --outcome <positive|negative|inconclusive> --evidence <path> --raw-finding <path> --repo-root .
   ```

   On Windows, run `.os\scripts\buildos.cmd` with the same arguments.

5. Report the run directory, evidence files, raw finding anchors, and runs index update.

## Qualification workflow

1. Identify the raw finding anchor.
2. Propose a repeatable confirmation test.
3. Confirm whether the finding is positive or negative.
4. Wait for user approval.
5. Run:

   ```sh
   .os/scripts/buildos discovery qualify finding --run-id <RUN-NNN> --raw-finding-ref <path#anchor> --outcome <positive|negative> --confirmation-test <path> --confirmation-evidence <path> --repo-root .
   ```

6. Report the `FIND-NNN` path and findings index update.

## Stop conditions

Stop when a run is recorded or when a finding is qualified. Do not promote designs unless the user starts the design/planning workflow.
