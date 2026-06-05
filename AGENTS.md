# Agent Instructions

When asked to create documentation for this project that is not `README.md`, read `docs/AGENTS.md` before writing.

Do not create any new Python scripts. The only Python scripts allowed in this project will always be in `.make-docs/scripts/` and `system/.make-docs/scripts/` (and these will be replaced at some point, so do not edit or add to them).  The only exception is the Python script located in `system/.os/scripts/validate_config.py` which is deprecated and will be replaced with a Go CLI 'toolkit' later.

Everything under `system/` is the scaffolding for what we ship; everything under `toolkits/` are the deterministic tools that we ship along with `system/` that both users and agents will use to automate certain aspects of the `system`.  Everything in the top-level `docs/` is used for our own project/work tracking and documentation purposes; everything in `system/docs/` is to be kept sterile and only used by users who are using the `system`.

Our end users are teams/users/agents who will use the Build OS `system` and `toolkits` to manage their discovery, requirements gathering, design and product planning, and work backlog generation processes; and our `docs/guides/user/` directory which is where we capture those guides that users of the Build OS `system` and `toolkits` (i.e., what ships) will need.
