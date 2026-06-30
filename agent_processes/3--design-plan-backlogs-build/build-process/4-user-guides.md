Please perform a user-guide coverage pass for the work just completed.

Use repo-local documentation contracts first:
- Read `docs/guides/AGENTS.md`.
- Read `docs/assets/references/guide-contract.md`.
- Use `docs/assets/templates/guide-user.md` only when creating a new user guide.
- Follow `docs/assets/history/AGENTS.md` and `docs/assets/references/history-record-contract.md` when creating or updating the session history record.

Use `jdocmunch` for project docs and `jcodemunch` for code/search when available. If an index is stale or missing, reindex before falling back to raw file reads.

Decide whether the completed work creates or changes a user-facing task, concept, workflow, expected result, configuration choice, troubleshooting path, or adoption path that belongs in `docs/guides/user/`.

For each relevant capability, choose and record one outcome: `user`, `developer`, `both`, `update-existing`, `link-only`, or `none`.

Prefer updating an existing user guide when it already owns the topic. Create a new user guide only when the user need is distinct enough to deserve its own entry point.

User guides must explain the current usable product from the user’s perspective. They should be procedural, discoverable, and task-oriented. Do not write implementation diaries, phase summaries, or maintainer notes unless the internal detail directly affects user behavior, setup, configuration, expected output, or troubleshooting.

When writing or updating guides:
- Start new guides as `status: draft`.
- Use clear prerequisites, first-success steps, core workflows, troubleshooting, FAQ, and related links where useful.
- Use redacted placeholders for credentials.
- Do not claim unfinished or unshipped capabilities are user-ready.
- Add `## Future Coverage` only for known downstream guide updates.
- Use relative links and keep them resolvable.

Before making or skipping guide changes, determine whether a history record has already been created for the current work session.

- If a history record already exists for the current session, update that existing record.
- If no history record exists for the current session, create a new history record.
- Do this whether the user-guide coverage pass results in new guide creation, existing guide updates, link-only changes, or no guide changes.
- The history record must capture the user-guide coverage decision and rationale.
- If guide changes were made, summarize what was created or updated and why.
- If no guide changes were warranted, explicitly record why no user guide change was needed.
- Do not create duplicate history records for the same current session.

Use the history contract to determine the correct filename, location, structure, and required fields.

After guide and history changes, validate:
- Run the repo’s markdown/style check if available.
- Refresh the docs index.
- Check broken links where practical.
- Confirm no new guide is marked `status: published`.
- Confirm no placeholders such as `TODO`, `TBD`, or `{{...}}` remain.
- Run `git diff --check`.

In the closeout, summarize:
- The user-guide coverage decision.
- Any guide files created or updated.
- The history record created or updated.
- Any validation performed.
- If no user guide change was warranted, say why. Do not skip the user-guide coverage decision silently.
