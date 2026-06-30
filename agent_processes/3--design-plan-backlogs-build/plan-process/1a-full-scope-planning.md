Process a full set of design(s), plans, a full PRD, and work backlogs for the project. If `docs/architecture/` is available, it will contain specifications, roadmaps, and other project planning artifacts that you can use to guide your planning; otherwise, use the working directory's `README.md` and any input from the user to guide your planning.

Goal:
Research, reconcile, discuss with the user (IF USER IS IN THE LOOP), and then document the entire project by using the "design -> plan -> work-backlog" pipeline. Do not modify source code or implement anything new; this is only a planning and documentation process. IF THE USER IS IN THE LOOP, documentation generation is allowed only after the relevant discussion/approval gate is reached.

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

2. Research the the project and all its requirements before proposing artifacts.
   - Search current docs for existing decisions, related designs, related plans, active PRDs, guides, history records, and known risks.
   - Search current code (if any exists) for relevant implementation surfaces, commands, adapter contracts, profile schema, lifecycle hooks, auth/cache behavior, harness-specific behavior, tests, and validation helpers.

3. [IF USER IS IN THE LOOP]: Stop for a research/brainstorming gate before writing artifacts.
   Present a concise research brief with:
   - requirements interpretation
   - current-state findings with file/doc references
   - likely implementation surfaces
   - PRD/doc impact assessment (if any existing PRD docs exist)
   - open questions
   - recommended solution shape(s)
   - risks and validation needs

   Then ask for user confirmation or correction before drafting the design doc.

4. Draft the design doc(s).
   - Write one or more design doc(s) in `docs/designs/YYYY-MM-DD-<slug>.md`.
   - Use today's date; do not backdate.
   - Follow the design contract.
   - Add `## Design Lineage` only when the change relates materially to prior design intent.
   - Make the design comprehensive enough to derive a full downstream plan set.
   - Include a coordinate handoff when W/R lineage is known; otherwise mark it unresolved for the planner.

5. [IF USER IS IN THE LOOP]: Stop for design approval before generating plans.

6. Generate one or more derived plan sets in `docs/plans/` (one per design doc).
   - Plans are directories, not flat files:
     - `docs/plans/YYYY-MM-DD-w{W}-r{R}-<slug>/00-overview.md`
     - one or more `0N-<phase>.md` files
   - Resolve W/R using `docs/assets/references/wave-model.md`.
   - Preserve source lineage over “highest existing wave” when this is a revision or follow-on.
   - Include coordinate decision, repo summary, output contract, execution mode, PRD lifecycle handling, coordinator/delegation policy, impacted docs/code surfaces, validation plan, and phase map.
   - Do not implement code.

7. [IF USER IS IN THE LOOP]: Stop for plan approval before generating the work backlog.

8. Generate or update the PRD set in `docs/prd/` based on the plan(s).

9. [IF USER IS IN THE LOOP]: Stop for PRD approval before generating the work backlog.

10. Generate one or more derived work backlogs in `docs/work/` (one per plan).
   - Work backlogs are directories, not flat files:
     - `docs/work/YYYY-MM-DD-w{W}-r{R}-<slug>/00-index.md`
     - matching `0N-<phase>.md` files
   - Preserve the plan's phase structure and dependency order.
   - Ensure the plan references the appropriate requirements, questions, and risks captured in the PRD set in `docs/prd/`.
   - In each phase file, use task syntax exactly:
     - `- [ ] t1: {{TASK}}`
   - Keep `### Acceptance criteria` as plain unordered bullets.
   - Number task IDs phase-locally and continuously across the whole phase file.
   - Include source traceability to relevant design, plan, PRD/baseline docs, and affected implementation surfaces.

11. Validate documentation-only output.
   - Check required headings and destination conventions.
   - Check relative links.
   - Run lightweight formatting/link sanity checks if the repo provides them.
   - Refresh `jdocmunch` after meaningful doc writes.
   - Report created files, remaining open questions, and any deferred PRD/doc/code implications.

Hard constraints:
- Do not modify source code.
- Do not archive anything unless explicitly asked.
- Do not collapse the gates. Research, design approval, plan approval, PRD approval, and work-backlog approval are separate decisions (especially when the user is in the loop).
- Prefer repo-local contracts/templates over memory or generic advice.
