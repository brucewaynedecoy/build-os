# Build OS Use-Case Testing

This script guides a tester through agent-assisted Build OS use-case validation. Run one step at a time. The agent should start in the installed test workspace, and the user should decide when to advance.

The source use cases are grouped as Flow A, Flow B, and Flow C. The agent running the test is not expected to see this file or the original use-case catalog. Copy the prompt template for the current step into the agent session.

## Test Workspace

<!-- make-docs-path-hygiene: allow exact external demo workspace supplied by tester -->

`<demo-root>` is `/Users/tylerkneisly/Developer/Source/Clients/Hitachi/Deere/Rental-Finance/`.

The demo root is an installed Build OS system root. It should contain `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/` at the root. It is not the Build OS development repository, so normal test prompts should not mention `system/` paths.

<!-- make-docs-path-hygiene: allow exact external demo workspace supplied by tester -->

Initial source files for intake should be copied to `/Users/tylerkneisly/Developer/Source/Clients/Hitachi/Deere/Rental-Finance/assets/_incoming/`.

Expected installed-root artifact locations:

- Raw intake inputs: `assets/_incoming/`
- Converted twins: `assets/<source-slug>/`
- Derived indexes: `.os/indexes/`
- Data rows: `.os/data/`
- Playbooks: `playbooks/`
- Run and finding artifacts: `workspace/`
- Design and planning documents: `docs/`

## Preflight

**User Step**

From the Build OS development repository, install the toolkits:

```sh
just install-toolkits
just check-toolkits
```

Copy the initial source files into `<demo-root>/assets/_incoming/`. Then start the agent with its working directory set to `<demo-root>`.

**Agent Prompt**

```text
You are in an installed Build OS test workspace.
Read AGENTS.md and CLAUDE.md if present.
Inspect `.os/`, `assets/`, `docs/`, `playbooks/`, and `workspace/`.
Confirm whether `buildos-intake`, `buildos-discovery`, and `buildos-design` resolve on PATH.
Do not modify files.
Report the workspace layout, the toolkit commands available, and any obvious blockers before we start.
```

**Acceptance Criteria**

- The agent reports that it is in the installed workspace root.
- The agent confirms the three toolkit binaries resolve on PATH.
- The agent identifies `assets/_incoming/` as the raw intake staging folder.
- No files are changed.

**Human Confirmation**

Run `git status --short` only if the demo workspace is a Git checkout. Otherwise, ask the agent to list changed files with `find . -type f -mmin -5` and confirm none were created.

## Known Capability Boundaries

Some use cases require capabilities that are not fully deterministic yet. When no first-party toolkit exists, the test should still proceed as a guided agent workflow and record the gap.

- Extraction to data rows is manual/guided unless a deterministic loader exists in the demo workspace.
- Playbook minting is manual/guided; `buildos-intake index playbooks` can rebuild the catalog after a playbook is written.
- Downstream design-to-plan, PRD maintenance, work backlog maintenance, and build execution may be manual/guided after `buildos-design promote finding`.
- A live computer-use or browser harness is outside the current toolkit binaries; discovery commands record run outcomes after the agent/user has produced evidence and raw findings.

## Flow A: Intake And Knowledge

### A1. Deterministic Bulk Conversion

**Metadata**

- Actor: tool, with agent fallback for one-offs.
- Trigger: new source files land in `system/assets/`.
- Test mapping: source files land in installed-root `assets/_incoming/`.

**What This Tests**

The installed `buildos-intake` binary converts supported source files from the incoming folder into provenance-stamped converted twins under `assets/<source-slug>/`, then rebuilds `references.json`.

**User Step**

Confirm at least one supported file exists in `assets/_incoming/`. Supported types are CSV, DOCX, XLSX, PDF, HTML, and HTML directory.

**Agent Prompt**

```text
Convert the source files staged in `assets/_incoming/` using `buildos-intake`.
First list the files and classify which ones are supported by the deterministic converter.
For each supported file, run a dry run, then run the real conversion if the dry run is clean.
After conversion, run `buildos-intake index references`.
Report every converted output path and the updated references index path.
Do not perform extraction, classification, requirements loading, discovery, or design work in this step.
```

**Expected Artifacts**

- `assets/<source-slug>/<asset-slug>.<ext>`
- `.os/indexes/references.json`

**Acceptance Criteria**

- Converted twins include provenance frontmatter with `source`, `sha256`, `converter`, `timestamp`, `type`, and `status`.
- Converted paths do not include a nested `system/` prefix.
- `.os/indexes/references.json` lists the converted twins.
- Unsupported files are reported rather than silently skipped.

**Human Confirmation**

Open one converted twin and inspect the frontmatter. Open `.os/indexes/references.json` and confirm the converted path starts with `assets/`.

### A2. One-Off Agent Conversion

**Metadata**

- Actor: agent.
- Trigger: a source type or shape no converter handles cleanly.

**What This Tests**

The agent can create a manual converted twin that follows the same provenance contract as deterministic conversion, while clearly recording the deterministic-tooling gap.

**User Step**

Select one source that failed conversion or produced an inadequate result. If every source converted cleanly, choose the richest converted file and ask the agent to evaluate whether manual conversion is necessary.

**Agent Prompt**

```text
Evaluate the selected source for one-off manual conversion.
If deterministic conversion failed or produced an inadequate twin, create a manual converted twin under the correct `assets/<source-slug>/` folder using the same frontmatter contract as `buildos-intake`.
Preserve traceability to the original `assets/_incoming/` source.
If no manual conversion is justified, do not create a file; instead report why deterministic conversion is sufficient.
After any manual twin is created, run `buildos-intake index references`.
```

**Expected Artifacts**

- Optional manual converted twin under `assets/<source-slug>/`
- Updated `.os/indexes/references.json` if a manual twin is written
- A short gap note in the agent report when deterministic conversion was inadequate

**Acceptance Criteria**

- Manual twins follow the converted-source frontmatter shape.
- The source path points back to `assets/_incoming/`.
- The agent does not write ad hoc converted files outside `assets/`.
- If no file is written, the agent gives a concrete no-change rationale.

**Human Confirmation**

Compare the manual twin to the original source. Confirm the output is readable and that `.os/indexes/references.json` includes it when applicable.

### A3. Extraction To Structured Rows

**Metadata**

- Actor: user (ETL).
- Trigger: converted content contains structured knowledge such as requirements, capabilities, personas, or test cases.

**What This Tests**

The agent can inspect converted content, propose structured candidate rows, preserve source anchors, and surface that deterministic loading is not yet fully implemented when no loader is present.

**User Step**

Choose one converted twin that contains structured knowledge.

**Agent Prompt**

```text
Inspect the selected converted twin and identify candidate structured rows.
Look for requirements, capabilities, personas, decisions, test cases, entities, or other data shapes supported by the local `.os/contracts/` and `.os/data/` files.
Do not invent a deterministic loader.
If a safe existing data file and contract are present, propose exact JSONL rows for review before writing.
If the load path is not implemented or not safe, write no rows and provide a load plan with row candidates, target data file, source anchors, duplicate risks, and review questions.
```

**Expected Artifacts**

- Reviewed candidate row plan in the agent report, or user-approved rows in `.os/data/*.jsonl`
- Source anchors back to converted twins under `assets/`

**Acceptance Criteria**

- Candidate rows cite their source file and anchor.
- The agent distinguishes extraction from conversion.
- The agent does not write rows without identifying the applicable contract and receiving explicit user approval.
- Gaps in deterministic loading are recorded as blockers, not hidden.

**Human Confirmation**

Check each proposed row against the source text. If rows were written, inspect the target `.os/data/*.jsonl` file and run the local validator if available.

### A4. Extraction To New Playbooks

**Metadata**

- Actor: user (ETL).
- Trigger: a source describes procedures or scenarios.

**What This Tests**

The agent can turn scenario/procedure content into draft playbooks, keep them inactive until review, and rebuild the playbook index.

**User Step**

Choose a converted twin that describes a procedure, test scenario, exploration script, or operational guardrail.

**Agent Prompt**

```text
Inspect the selected converted twin for procedures or scenarios that should become Build OS playbooks.
Read the local playbook contract and relevant playbook routers.
Draft one or more playbooks under the appropriate `playbooks/` category with `status: draft`.
Do not mark new playbooks active unless I explicitly approve activation.
After drafting, run `buildos-intake index playbooks` and report whether the draft playbooks appear in `.os/indexes/playbooks.json`.
```

**Expected Artifacts**

- Draft playbook under `playbooks/<category>/`
- Updated `.os/indexes/playbooks.json`

**Acceptance Criteria**

- New playbooks use required frontmatter fields.
- New playbooks preserve source traceability.
- Draft playbooks appear in the full `playbooks` catalog.
- Draft playbooks do not appear in `runnable_playbooks`.

**Human Confirmation**

Open the draft playbook and inspect its frontmatter. Open `.os/indexes/playbooks.json` and confirm the playbook is listed but not runnable while draft.

### A5. Extraction To A Durable Docs Artifact

**Metadata**

- Actor: user (ETL).
- Trigger: a source is best captured as a durable document.

**What This Tests**

The agent can route extracted knowledge into the installed `docs/` tree while preserving make-docs-style router boundaries and source evidence.

**User Step**

Choose a converted twin that is better represented as a design, reference, or planning document than as only rows or playbooks.

**Agent Prompt**

```text
Use the selected converted twin to propose a durable `docs/` artifact.
Read the relevant local docs router before writing anything.
Tell me which docs path you plan to use, which template or contract applies, and what source anchors will be preserved.
Wait for my approval before creating the document.
After approval, create only the routed document and report the path and source links.
```

**Expected Artifacts**

- A routed document under `docs/`, usually `docs/designs/` when design framing is appropriate
- Links or source references back to `assets/<source-slug>/`

**Acceptance Criteria**

- The agent reads and follows the target docs router.
- The document is created under `docs/`, not under `system/docs/`.
- The document preserves source lineage.
- The agent does not create unrelated PRD, work, or history files unless explicitly requested.

**Human Confirmation**

Open the new document. Confirm the heading structure matches the local router/template and source links resolve from the document location.

### A6. Combined Extraction

**Metadata**

- Actor: user (ETL).
- Trigger: one rich source feeds several destinations at once.

**What This Tests**

The agent can coordinate conversion outputs into a combined extraction plan that may include candidate rows, draft playbooks, and a routed docs artifact, while separating implemented tooling from manual/guided work.

**User Step**

Choose the richest converted twin from the intake set.

**Agent Prompt**

```text
Treat the selected converted twin as a combined extraction source.
Identify which outputs it can support: data rows, draft playbooks, and a docs artifact.
Create an extraction plan first.
For each output, state whether the workspace has deterministic tooling or whether the step is manual/guided.
Proceed only with the outputs I approve.
For any approved playbooks, keep them draft and rebuild the playbook index.
For any approved docs artifact, follow the local docs router.
For any approved data rows, cite the applicable contract and wait for explicit row-write approval.
```

**Expected Artifacts**

- Combined extraction plan
- Optional candidate rows, draft playbooks, and docs artifact as approved by the user
- Updated indexes when artifacts are created

**Acceptance Criteria**

- Every output traces back to the same source.
- The agent records which outputs are deterministic and which are manual/guided.
- No candidate is promoted or activated without user approval.
- The plan identifies duplicate and review risks.

**Human Confirmation**

Review the source lineage across every created artifact. Confirm indexes were rebuilt when playbooks or references changed.

## Flow B: Discovery And Execution

### B1. Discovery Run To Positive Finding

**Metadata**

- Actor: agent with computer-use, human-reviewed.
- Trigger: a discovery or standing playbook, for example creating a rental account in FO.

**What This Tests**

The agent can record a positive discovery run, then qualify a raw finding with confirmation evidence.

**User Step**

Select an active discovery playbook from `.os/indexes/playbooks.json`. Prepare or approve evidence files and raw finding text.

**Agent Prompt**

```text
Run the selected discovery scenario as far as the available harness allows.
Do not fabricate evidence.
When evidence and raw finding text exist, record the run with `buildos-discovery run discovery`.
Use `--outcome positive` only if the observed behavior is confirmed.
After the run is recorded, identify the raw finding anchor and propose a deterministic confirmation test and confirmation evidence for qualifying the finding.
Wait for my approval before running `buildos-discovery qualify finding`.
```

**Expected Artifacts**

- `workspace/runs/RUN-NNN/run.md`
- `workspace/runs/RUN-NNN/raw-findings.md`
- `workspace/runs/RUN-NNN/evidence/`
- `.os/data/runs.jsonl`
- After qualification, `workspace/findings/FIND-NNN/` and `.os/data/findings.jsonl`

**Acceptance Criteria**

- The run row has `outcome: "positive"`.
- Raw findings remain inside the run artifact until qualification.
- The finding row has `status: "qualified"`.
- Qualification evidence is copied into the finding artifact.

**Human Confirmation**

Open the run and finding folders. Confirm evidence files exist and the raw finding anchor cited in the finding resolves back to the run.

### B2. Discovery Run To Negative Finding

**Metadata**

- Actor: agent with computer-use, human-reviewed.
- Trigger: a discovery playbook where the system cannot do the expected thing.

**What This Tests**

The agent can record a negative discovery run and qualify a finding whose confirmation test asserts the negative condition.

**User Step**

Select a discovery playbook with an expected behavior that may fail. Prepare or approve evidence showing the failure.

**Agent Prompt**

```text
Execute the selected discovery scenario and collect evidence without changing the environment beyond the playbook scope.
If the expected behavior cannot be completed, record the run with `buildos-discovery run discovery --outcome negative`.
Then propose a confirmation test that asserts the failure condition and confirmation evidence proving that assertion passed.
Wait for my approval before running `buildos-discovery qualify finding --outcome negative`.
```

**Expected Artifacts**

- Negative `RUN-NNN` artifact and `.os/data/runs.jsonl` row
- Qualified `FIND-NNN` artifact and `.os/data/findings.jsonl` row
- Negative assertion in the finding qualification record

**Acceptance Criteria**

- The run row has `outcome: "negative"`.
- The finding row has `polarity` or `outcome` set to negative.
- The qualification artifact includes a negative assertion.
- The confirmation test asserts the failure rather than the desired success path.

**Human Confirmation**

Open `workspace/findings/FIND-NNN/qualification.md`. Confirm it explains the negative assertion and links to evidence.

### B3. Standing Playbook Invoked Anytime

**Metadata**

- Actor: user.
- Trigger: a reusable, lifecycle-independent capability is needed mid-stream.

**What This Tests**

The agent can locate a reusable active playbook, run it as a precondition or mid-stream task, and avoid promoting artifacts when none are warranted.

**User Step**

Ask the agent to find active standing or reusable playbooks. If none exist, record the blocker and do not force the test.

**Agent Prompt**

```text
Inspect `.os/indexes/playbooks.json` for active reusable or standing playbooks.
If one exists, explain its purpose and ask me which one to run.
After I choose, execute or guide the playbook using the available harness.
Record a discovery run only if the playbook produces evidence or raw findings that should be captured.
If no active standing playbook exists, report the blocker and recommend the source artifact or draft playbook needed to enable this test.
```

**Expected Artifacts**

- Either a run artifact when evidence is produced, or a clear no-artifact rationale

**Acceptance Criteria**

- The agent does not treat draft playbooks as runnable.
- The agent distinguishes precondition execution from promotable discovery.
- The blocker is explicit when no active standing playbook exists.

**Human Confirmation**

Inspect `.os/indexes/playbooks.json`. Confirm any selected playbook is active before accepting a run.

### B4. Guardrail Playbook Governs A Session

**Metadata**

- Actor: user, constrained by the guardrail.
- Trigger: any run.

**What This Tests**

The agent can apply guardrail playbooks as session constraints without executing or promoting them as findings.

**User Step**

Ask the agent to identify guardrail playbooks before a discovery run.

**Agent Prompt**

```text
Inspect the playbook index and local playbook routers for guardrail playbooks.
Summarize the guardrails that apply to the next discovery session.
Apply those constraints while planning the run.
Do not execute the guardrail as a discovery run and do not promote it into a finding.
If no guardrail playbook exists, report that and identify whether a draft guardrail should be created later.
```

**Expected Artifacts**

- No required artifact
- Optional agent report listing applicable guardrails

**Acceptance Criteria**

- Guardrails are treated as constraints, not executable discovery targets.
- The agent cites the guardrail source path when one exists.
- The agent refuses actions that violate an applicable guardrail.

**Human Confirmation**

Check the cited guardrail playbook. Confirm the agent's planned actions respect it.

### B5. Human Verify Or Review Gate

**Metadata**

- Actor: human reviewer.
- Trigger: candidates such as findings or instruments await the gate.

**What This Tests**

The user can steer an agent through the correct gate: evidence-backed verification for findings, review-to-activate for playbooks.

**User Step**

Choose one candidate finding or draft playbook created earlier in the test.

**Agent Prompt**

```text
Review the selected candidate and identify which gate applies.
If it is a finding, verify the source run, raw anchor, confirmation test, and evidence before proposing promotion or qualification changes.
If it is a playbook, inspect the draft and explain what is needed to move it from draft to reviewed or active.
Do not change status until I explicitly approve the gate decision.
After approval, make only the status or qualification change that the local contract allows, then rebuild any affected index.
```

**Expected Artifacts**

- Updated finding or playbook status only after approval
- Updated `.os/indexes/playbooks.json` when playbook status changes
- Updated `.os/data/findings.jsonl` only through supported qualification or promotion commands

**Acceptance Criteria**

- The agent chooses the correct gate for the candidate type.
- The agent cites evidence or review rationale.
- Status changes are user-approved.
- Indexes remain consistent with source artifacts.

**Human Confirmation**

Inspect the changed artifact and index row. Confirm the status change and evidence trail match the approved decision.

## Flow C: Design, Plan, Backlogs, Build

### C1. Qualified Finding To Design Handoff

**Metadata**

- Actor: inferred from the high-level thread: user-steered agent with human review.
- Trigger: a qualified finding is ready to feed design and planning.

**What This Tests**

The agent can use `buildos-design` to create a user-gated design handoff from a qualified finding, then identify which downstream planning steps remain manual/guided.

**User Step**

Select a qualified `FIND-NNN` from `.os/data/findings.jsonl`. Decide whether the design should route to `baseline-plan` or `change-plan`.

**Agent Prompt**

```text
Inspect `.os/data/findings.jsonl` and the selected `workspace/findings/FIND-NNN/` artifact.
Confirm the finding is qualified and has a qualification anchor.
Dry-run a design promotion with `buildos-design promote finding --finding-id FIND-NNN --route <baseline-plan-or-change-plan> --title "<title>" --slug <slug> --dry-run`.
Report the design path, route, prompt link, finding lineage, systems, environments, and owners that would be carried forward.
Wait for my approval before running the non-dry-run command.
After approval, run the promotion and report the new design path and the updated finding back-reference.
```

**Expected Artifacts**

- `docs/designs/YYYY-MM-DD-<slug>.md`
- Updated `.os/data/findings.jsonl`
- Updated `workspace/findings/FIND-NNN/finding.md` `## Designs` section

**Acceptance Criteria**

- The design path starts with `docs/designs/`.
- The design preserves finding ID, origin run, raw anchor, qualification link, systems, environments, and owners.
- The design includes an intended follow-on route and route-specific prompt link.
- The finding row's `designs` list includes the design path.
- The finding markdown links back to the design.

**Human Confirmation**

Open the generated design and finding record. Confirm the links resolve and the selected route is correct.

### C2. Downstream Planning Thread

**Metadata**

- Actor: inferred from the high-level thread: user-steered agent with human review.
- Trigger: a promoted design should feed plan, PRD, work backlog, and build activity.

**What This Tests**

The agent can continue from the generated design into the next routed planning step while clearly separating shipped deterministic handoff from incomplete downstream automation.

**User Step**

Choose the design created in C1. Decide whether to continue into planning during this test or stop after proving the handoff.

**Agent Prompt**

```text
Continue from the selected design.
Read the design's intended follow-on section and the linked prompt or router.
Explain the next planning path and which parts are deterministic versus manual/guided in this workspace.
Do not create plans, PRDs, work backlogs, or build changes until I explicitly approve the next artifact.
If I approve, create only the next routed artifact and preserve links back to the design and finding.
```

**Expected Artifacts**

- Optional next routed planning artifact, only if approved
- Clear no-change report if the test stops after design handoff

**Acceptance Criteria**

- The agent follows the route recorded in the design.
- The agent does not invent unsupported stage automation.
- Any next artifact links back to the design and qualified finding.
- If no downstream artifact is created, the agent records why stopping after handoff is acceptable.

**Human Confirmation**

Inspect any new artifact for route compliance and lineage. If no artifact was created, confirm the handoff evidence from C1 is complete.

## Cleanup

**User Step**

When testing is complete, optionally remove installed toolkit binaries from the install directory:

```sh
just uninstall-toolkits
```

This removes only `buildos-intake`, `buildos-discovery`, and `buildos-design` from `${BUILDOS_INSTALL_BIN_DIR:-$HOME/.local/bin}`.

**Acceptance Criteria**

- `command -v buildos-intake buildos-discovery buildos-design` no longer resolves from the removed install directory.
- The demo workspace artifacts remain intact for review unless the tester deletes them separately.
