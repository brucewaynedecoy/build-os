---
name: buildos-browser-to-playwright
description: Execute or guide browser-based Build OS playbook discovery, tie observations to test cases, draft deterministic Playwright tests, record results, and gate finding qualification on evidence.
---

# Build OS Browser to Playwright

Use this skill when a user wants the agent to explore a browser workflow and turn what was learned into deterministic browser automation.

This skill implements the practical path:

1. Run or draft an active browser playbook.
2. Tie the run to a `TC-*` verification target.
3. Record `RUN-*` evidence.
4. Draft a deterministic Playwright test from the observed path.
5. Run or prepare the script and record `RES-*`.
6. Qualify `FIND-*` only if repeatable evidence supports it.

## Required routers and contracts

- `.os/AGENTS.md`
- `playbooks/AGENTS.md`
- `.os/contracts/playbook-contract.md`
- `.os/contracts/entity-records-contract.md`
- `.os/contracts/run-record-contract.md`
- `.os/contracts/finding-contract.md`
- `workspace/runs/AGENTS.md`
- `workspace/findings/AGENTS.md`
- If present, the project's own test router, such as `workspace/tests/AGENTS.md`. BuildOS does not ship one; follow the project's existing test layout instead when it has none.

## Rules

- Do not assume access to the user's already-open personal browser.
  Use only an explicitly available browser/computer-use harness, browser canvas, local dev server preview, or human-provided evidence.
- Do not install Playwright, browsers, Node packages, or unsigned CLIs unless the user explicitly approves and the repo already expects that toolchain.
- Prefer existing repo test conventions.
  If no Playwright setup exists, draft the script/proposal and report the exact setup command or package change that would be needed.
- Only `active` playbooks are runnable through Build OS.
  Draft playbooks may be reviewed manually but should not be recorded as active procedural runs unless promoted.
- A `TC-*` row defines what the deterministic script should verify.
- A `RUN-*` records discovery evidence.
- Playwright test scripts go where the project already keeps its Playwright tests (its Playwright config or test router says where). If the project has none, propose `workspace/tests/playwright/` and create that folder only when the user approves the write. Name scripts `TC-NNN-short-scenario-slug.spec.ts`.
- A `RES-*` records pass/fail/blocked/inconclusive outcome for the test case or run.
- A `FIND-*` requires deterministic repeatable confirmation evidence.

## Workflow

### 1. Select or create the playbook path

1. Read `playbooks/AGENTS.md` and `.os/indexes/playbooks.json`.
2. Identify an active browser-capable playbook with `harness: [browser]`, `harness: [computer-use]`, or both.
3. If no playbook exists, route to `buildos-playbook-drafting` to create a draft playbook and stop at the review-to-activate gate.

### 2. Select the test-case target

1. Identify the `TC-*` row that should be verified.
2. If the behavior is not represented by a test case, route to `buildos-row-drafting` to draft one and stop at row-write approval.
3. Confirm preconditions, expected signal, system, environment, owner, and fixture data.

### 3. Execute browser discovery and record evidence

1. Use the available browser/computer-use harness or human-provided browser evidence.
2. Capture:
   - starting URL or entry point,
   - user role,
   - fixture data,
   - navigation steps,
   - labels/selectors if visible,
   - screenshots or transcript notes,
   - observed outcome,
   - blockers.
3. Record a `RUN-*` through the Build OS run workflow.
4. Keep raw observations as raw findings until qualified.

### 4. Draft the Playwright test

1. Inspect existing test directories and package scripts before creating a new file.
2. Reuse existing helpers, fixtures, auth/session setup, selectors, and naming conventions.
3. Save new Playwright scripts in the project's existing Playwright test folder. If there is none, propose `workspace/tests/playwright/` and create it only after the user approves; an explicit user instruction overrides either path.
4. Name scripts `TC-NNN-short-scenario-slug.spec.ts` and assert the `TC-*` expected signal.
5. Prefer stable selectors and user-visible assertions.
6. Include setup comments only when a manual fixture or credential dependency is unavoidable.

### 5. Run or prepare deterministic validation

1. If Playwright is already available in the repo, run the relevant existing test command.
2. If Playwright is not available, do not install it by default.
   Report the proposed file path, command, and missing setup.
3. Record or draft a `RES-*` row for the test target:
   - `pass`,
   - `fail`,
   - `blocked`,
   - or `inconclusive`.

### 6. Optional finding qualification

1. If the run and deterministic test reveal a durable issue or confirmed behavior, propose a finding.
2. Confirm the repeatable qualification test.
3. Ask for approval before writing or qualifying `FIND-*`.
4. Route durable docs through `buildos-docs-handoff` only after qualification or user-approved design handoff.

## Single vs batch

- Single workflow: one playbook, one `TC-*`, one browser run, one Playwright test.
- Multiple targets: keep evidence and status separate for each target.

## Stop conditions

Stop when:

- no active browser-capable playbook exists,
- no `TC-*` target exists,
- browser access is unavailable,
- Playwright is not installed and installing it would require approval,
- row/doc/finding writes need approval,
- or the deterministic test result has been recorded.
