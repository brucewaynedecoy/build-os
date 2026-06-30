Please perform a PRD coverage and reconciliation pass for the work just completed.

Use repo-local documentation contracts first:
- Read `docs/AGENTS.md`.
- Read `docs/prd/AGENTS.md`.
- Read `docs/assets/references/execution-workflow.md`.
- Read `docs/assets/references/output-contract.md`.
- Read `docs/assets/references/prd-change-management.md`.
- Follow `docs/assets/history/AGENTS.md` and `docs/assets/references/history-record-contract.md` when creating or updating the session history record.

Use `jdocmunch` for project docs and `jcodemunch` for code/search when available. If an index is stale or missing, reindex before falling back to raw file reads.

Decide whether the completed work changes the active product requirements, requirement status, implementation assumptions, known gaps, confirmed drift, open questions, rebuild risks, or source anchors captured in `docs/prd/`.

For each relevant capability or finding, choose and record one outcome:
- `prd-change-doc`
- `baseline-change-note`
- `risk-register-update`
- `index-only`
- `link-only`
- `none`

Prefer updating the existing active PRD namespace in place. Do not regenerate or archive the active PRD set unless the user explicitly asks.

If the completed work introduced a net-new capability, enhancement, revision, or removal that changes requirements:
- Classify it using `docs/assets/references/prd-change-management.md`.
- Add the next available numbered PRD change doc using the appropriate template.
- Do not renumber or reorder existing PRD docs.
- Update impacted baseline PRD docs with `### Change Notes` backlinks where required.
- Update `docs/prd/00-index.md` so status, kind, related docs, focus, and lineage are clear.

If the completed work resolved or discovered a gap, drift item, open question, decision, or rebuild risk:
- Update `docs/prd/03-open-questions-and-risk-register.md` directly.
- Update the existing item when one already covers the issue.
- Do not create separate questions, decisions, risks, gaps, or architecture-decision files unless the user explicitly asks.
- Preserve existing item numbers and statuses according to the PRD contract.

If no PRD changes are warranted, explicitly record why the completed work only implemented existing requirements and did not change the requirement surface.

Before making or skipping PRD changes, determine whether a history record has already been created for the current work session.

- If a history record already exists for the current session, update that existing record.
- If no history record exists for the current session, create a new history record.
- Do this whether the PRD coverage pass results in PRD changes, risk-register updates, link-only changes, or no PRD changes.
- The history record must capture the PRD coverage decision and rationale.
- If PRD changes were made, summarize what was created or updated and why.
- If no PRD changes were warranted, explicitly record why no PRD update was needed.
- Do not create duplicate history records for the same current session.

After PRD and history changes, validate:
- Run the repo’s markdown/style check if available.
- Refresh the docs index.
- Check broken links where practical.
- Confirm new PRD docs use the next available number.
- Confirm no existing PRD docs were renumbered.
- Confirm affected baseline docs link to the newest effective change doc where applicable.
- Confirm `docs/prd/00-index.md` reflects any new or changed PRD docs.
- Confirm `docs/prd/03-open-questions-and-risk-register.md` has no duplicated items for the same gap/question/risk.
- Confirm no placeholders such as `TODO`, `TBD`, or `{{...}}` remain unless they are intentionally preserved existing PRD register content.
- Run `git diff --check`.

In the closeout, summarize:
- The PRD coverage decision.
- Any PRD files created or updated.
- Any risk-register items created, updated, closed, or explicitly left unchanged.
- The history record created or updated.
- Any validation performed.
- If no PRD change was warranted, say why. Do not skip the PRD coverage decision silently.
