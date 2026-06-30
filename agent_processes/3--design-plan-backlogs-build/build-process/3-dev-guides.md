Please perform a developer-guide coverage pass for the work just completed.

Use the repo-local documentation contracts and instructions first:
- Read `docs/guides/AGENTS.md`.
- Read `docs/assets/references/guide-contract.md`.
- Use `docs/assets/templates/guide-developer.md` only when creating a new developer guide.
- Follow `docs/assets/history/AGENTS.md` and `docs/assets/references/history-record-contract.md` when creating or updating the session history record.

Use `jdocmunch` for project docs and `jcodemunch` for code/search when available. If an index is stale or missing, reindex before falling back to raw file reads.

Decide whether the completed work creates durable maintainer knowledge that belongs in `docs/guides/developer/`. Prefer updating an existing guide when it already owns the topic. Create a new guide only when there is a distinct maintainer workflow, contract, extension point, setup/configuration concern, validation process, troubleshooting path, or safe-change rule that future contributors will need.

Guides must describe current maintainable behavior, not session history. Use plans, work files, PRDs, code, tests, and history records as evidence, but write the guide around what a developer should do next.

For each documentation-worthy capability, choose and record one outcome: `developer`, `user`, `both`, `update-existing`, `link-only`, or `none`. New developer guides must start as `status: draft`, include useful `related` links, and use relative links that resolve.

Determine whether a history record has already been created for the current work session. If a history record already exists for the current session, update that existing record. If no history record exists for the current session, create a new history record. Do this whether the developer-guide coverage pass results in new guide creation, existing guide updates, link-only changes, or no guide changes. Do not create duplicate history records for the same current session.

The history record must capture the developer-guide coverage decision and rationale. If guide changes were made, summarize what was created or updated and why. If no developer guide changes were warranted, explicitly record why no guide change was needed.

After guide and history changes, validate:
- Run the repo’s markdown/style check if available.
- Refresh the docs index.
- Check for broken links where practical.
- Confirm no new guide is marked `status: published`.
- Confirm no placeholders such as `TODO`, `TBD`, or `{{...}}` remain.
- Run `git diff --check`.

In the closeout, summarize:
- The developer-guide coverage decision.
- Any guide files created or updated.
- The history record created or updated.
- Any validation performed.
- If no developer guide change was warranted, say why. Do not skip the guide coverage decision silently.
