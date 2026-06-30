Process exactly one feature/change request as described below. If `docs/architecture/BACKLOG.md` is available, you may also reference the backlog item you are processing; otherwise, proceed without it.

Selected requirement:
<BACKLOG_ITEM>

Goal:
Research, reconcile, discuss with user (IF USER IS IN THE LOOP), and then document this single requirement through the repo’s design -> plan -> work-backlog pipeline. Do not modify source code or implement the feature. Documentation generation is allowed only after the relevant discussion/approval gate is reached (IF USER IS IN THE LOOP; OTHERWISE CONTINUE).

Process requirements:

1. Start by reading repo-local instructions and contracts.
   - Use `jdocmunch` for project docs and `jcodemunch` for code/function discovery when available.
   - If either index is missing or stale, reindex first, then retry before falling back to direct file reads.
   - Read the selected requirement in `docs/architecture/BACKLOG.md`.
   - Read destination instructions before writing:
     - `docs/designs/AGENTS.md`
     - `docs/plans/AGENTS.md`
     - `docs/work/AGENTS.md`
   - Read the applicable repo contracts/templates they reference, especially:
     - `docs/assets/references/design-workflow.md`
     - `docs/assets/references/design-contract.md`
     - `docs/assets/templates/design.md`
     - `docs/assets/references/planning-workflow.md`
     - `docs/assets/references/wave-model.md`
     - `docs/assets/references/execution-workflow.md`
     - relevant `docs/assets/templates/` plan/work templates

2. Research the selected requirement before proposing artifacts.
   - Quote or summarize the exact backlog item being processed.
   - Classify it as one or more of: bug/fix, enhancement, architectural change, UX/CLI change, workflow capability, SDK/API surface, docs/tooling support, speculative/needs-validation.
   - Search current docs for existing decisions, related designs, related plans, active PRDs, guides, history records, and known risks.
   - Search current code for the relevant implementation surfaces, commands, adapter contracts, profile schema, lifecycle hooks, auth/cache behavior, harness-specific behavior, tests, and validation helpers.
   - Identify overlaps or dependencies with other backlog items, but keep this run scoped to the selected requirement.
   - For fix-like requests, ground symptoms in current docs/code and state what is confirmed, likely, unclear, or obsolete.
   - For enhancement-like requests, identify the narrowest viable solution that fits current architecture and avoids breaking changes.

3. [IF USER IS IN THE LOOP]: Stop for a research/brainstorming gate before writing artifacts.
   Present a concise research brief with:
   - requirement interpretation
   - current-state findings with file/doc references
   - likely implementation surfaces
   - PRD/doc impact assessment
   - open questions
   - 2-3 possible solution shapes
   - recommended minimal targeted direction
   - risks and validation needs

   Then ask for user confirmation or correction before drafting the design doc.

4. Draft the design doc.
   - Write one design doc in `docs/designs/YYYY-MM-DD-<slug>.md`.
   - Use today’s date; do not backdate.
   - Follow the required headings from the design contract:
     - `## Purpose`
     - `## Context`
     - `## Decision`
     - `## Alternatives Considered`
     - `## Consequences`
     - `## Intended Follow-On`
   - Add `## Design Lineage` only when the change relates materially to prior design intent.
   - Make the design comprehensive enough to derive a full downstream plan set.
   - Use `Route: change-plan` unless the research proves this is a true baseline/new-product planning case.
   - Include a coordinate handoff when W/R lineage is known; otherwise mark it unresolved for the planner.

5. [IF USER IS IN THE LOOP]: Stop for design approval before generating plans.

6. Generate the derived plan set in `docs/plans/`.
   - Plans are directories, not flat files:
     - `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/00-overview.md`
     - one or more `0N-<phase>.md` files
   - Resolve W/R using `docs/assets/references/wave-model.md`.
   - Preserve source lineage over “highest existing wave” when this is a revision or follow-on.
   - Include coordinate decision, repo summary, output contract, execution mode, PRD lifecycle handling, coordinator/delegation policy, impacted docs/code surfaces, validation plan, and phase map.
   - Do not implement code.

7. [IF USER IS IN THE LOOP]: Stop for plan approval before generating the work backlog.

8. Generate the derived work backlog in `docs/work/`.
   - Work backlogs are directories, not flat files:
     - `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/00-index.md`
     - matching `0N-<phase>.md` files
   - Preserve the plan’s phase structure and dependency order.
   - In each phase file, use task syntax exactly:
     - `- [ ] t1: {{TASK}}`
   - Keep `### Acceptance criteria` as plain unordered bullets.
   - Number task IDs phase-locally and continuously across the whole phase file.
   - Include source traceability to relevant design, plan, PRD/baseline docs, and affected implementation surfaces.

9. Validate documentation-only output.
   - Check required headings and destination conventions.
   - Check relative links.
   - Run lightweight formatting/link sanity checks if the repo provides them.
   - Refresh `jdocmunch` after meaningful doc writes.
   - Report created files, remaining open questions, and any deferred PRD/doc/code implications.

Hard constraints:
- Do not modify source code.
- Do not archive anything unless explicitly asked.
- Do not generate PRD change docs unless the user explicitly adds PRD generation to this run.
- Do not collapse the gates. Research, design approval, plan approval, and work-backlog approval are separate decisions (especially when the user is in the loop).
- Prefer repo-local contracts/templates over memory or generic advice.
- If the selected requirement appears redundant, obsolete, or not actually needed, say that clearly and recommend whether to document a no-op/deferral instead of forcing a design.
