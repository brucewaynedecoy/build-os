<!-- make-docs:begin -->
# Agent Instructions

- When asked to create documentation for this project that is not `README.md`, read the same-named instruction file in `docs/` before writing.
- For documentation lifecycle order or skip/reorder/revisit decisions, use a valid local `.make-docs/system/references/lifecycle.md` first. If that body is absent, read `make-docs://system/reference/lifecycle.md` with `make-docs resource read`, and surface departures from the default arc.
- For governed work and material task updates, decisions, recommendations, error or limit reports, and completion replies, use the applicable lifecycle guidance plus valid local bodies for `.make-docs/system/contracts/human-experience-contract.md` and `.make-docs/system/references/human-experience.md`. If a body is absent, read its matching `make-docs://system/contract/human-experience-contract.md` or `make-docs://system/reference/human-experience.md` resource with `make-docs resource read`.
- A project can use Make Docs without Store access. If a Store-backed operation reports `store-not-configured`, `store-unavailable`, `store-unsafe`, or `store-denied`, stop only that operation, report its exact action, and continue independent Store-free work. Refresh access and retry only that operation after setup or repair. When the task repairs Make Docs setup, MCP, or Store access, missing Store or MCP access is evidence and must not block the repair.
- Before staging or committing changes, use a valid local `.make-docs/system/contracts/commit-message-convention.md` first. If that body is absent, read `make-docs://system/contract/commit-message-convention.md` with `make-docs resource read`.
- Do not infer optional Skills, plugins, Playbooks, Protocols, or unavailable policy from this router.
<!-- make-docs:end -->

# Agent Instructions

When asked to create documentation for this project that is not `README.md`, read `docs/AGENTS.md` before writing.

Do not create any new Python scripts. The only Python scripts allowed in this project will always be in `.make-docs/backup/2026-10-06T13-42-13.026Z/files/.make-docs/scripts/` and `system/.make-docs/scripts/` (and these will be replaced at some point, so do not edit or add to them).  The only exception is the Python script located in `system/.os/scripts/validate_config.py` which is deprecated and will be replaced with a Go CLI 'toolkit' later.

Everything under `system/` is the scaffolding for what we ship; everything under `toolkits/` are the deterministic tools that we ship along with `system/` that both users and agents will use to automate certain aspects of the `system`.  Everything in the top-level `docs/` is used for our own project/work tracking and documentation purposes; everything in `system/docs/` is to be kept sterile and only used by users who are using the `system`.

Our end users are teams/users/agents who will use the Build OS `system` and `toolkits` to manage their discovery, requirements gathering, design and product planning, and work backlog generation processes; and our `docs/assets/user/` directory which is where we capture those guides that users of the Build OS `system` and `toolkits` (i.e., what ships) will need.
