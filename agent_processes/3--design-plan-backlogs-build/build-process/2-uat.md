[USE ONLY IF THE USER IS IN THE LOOP SO THAT THE USER CAN PERFORM UAT/MANUAL TESTING ON THE COMPLETED WORK; OTHERWISE CONTINUE WORKING]

Please perform a manual-test coverage pass for the work just completed.

Use the repo-local documentation contracts and instructions first:
- Follow `docs/assets/history/AGENTS.md` and `docs/assets/references/history-record-contract.md` when creating or updating the session history record.

Use `jcodemunch` for code/search and `jdocmunch` for project docs when available. If an index is stale or missing, reindex before falling back to raw file reads.

Review the changes in the diff and decide whether the completed work warrants manual end-user testing. Consider manual testing NOT worthwhile when:
- The change has no user-observable surface (internal refactor, type-only change, comments/docs, build plumbing).
- The behavior is already fully covered by automated tests and a human running it by hand would do nothing meaningfully different from those tests — there is no real-usage or human-judgment element to add.
- Reproducing the effect by hand is not practical (it requires conditions a human cannot readily set up).

If manual testing is not worthwhile, say so in one or two sentences.

If manual testing is worthwhile, design a user-acceptance test. Strongly prefer a real end-user scenario over a script: test the way an actual end user or administrator would use the product, not a rerun of the verification already performed. A copy-paste script that merely reruns the project's own test logic adds little, since the built-in suite can already be run directly. This preference gets STRONGER, not weaker, when automated coverage already exists — if the change is already covered by automated tests or test scripts, a hand-run script is largely redundant, so lean harder into a genuine user-facing scenario.

One legitimate exception: if the project has a built-in, user-runnable test target that produces human-readable output a person would actually read and evaluate, pointing to that counts as a real scenario. That is different from a bespoke one-shot harness that just repeats the verification.

A good user-facing scenario includes:
- How to build and run the thing (commands are expected here).
- The exact steps a user performs, in order.
- The specific observable result to check at each meaningful step.
- What to report back on pass vs. fail.

Fall back to a standalone script/command ONLY when there is no practical user-facing scenario for the change. In that case, state briefly why, then provide the script. Make it hermetic and copy-pasteable: create a temp root; set an isolated `HOME`, `PILE_CONFIG`, and runtime/cache env vars; `cd` into a temp workdir before creating profiles and running `pile start`; and invoke the locally built repo binary by absolute path. Do not rely on the current cwd, global profiles, or real user config. Include the expected output for each command.

Determine whether a history record has already been created for the current work session. If a history record already exists for the current session, update that existing record. If no history record exists for the current session, create a new history record. Do this whether the manual-test coverage pass results in a real end-user scenario, a fallback script, or no test being warranted. Do not create duplicate history records for the same current session.

The history record must capture the manual-test coverage decision and rationale. If a test was produced, summarize the scenario or script and why. If no manual test was warranted, explicitly record why none was needed.

In the closeout, summarize:
- The manual-test coverage decision.
- The user-acceptance scenario or fallback script produced, if any.
- The history record created or updated.
- If no manual test was warranted, say why. Do not skip the coverage decision silently.
