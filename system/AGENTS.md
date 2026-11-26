# Agent Instructions

When asked to create documentation for this project that is not `README.md`, read the same-named instruction file in `docs/` before writing.

## Project root and paths

This file is placed at the initialized project root. The BuildOS source checkout stores it in `system/`, but that package directory is not installed. Use `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/` from this root.

Read the [Root and Path Contract](.os/contracts/root-and-path-contract.md) before writing paths, links, or instructions. Skills and toolkit binaries are installed separately. Do not assume this project contains their source packages.

## Operating the system

To **operate** this system — intake sources, author/run playbooks, record runs, qualify
findings — start at [`.os/AGENTS.md`](.os/AGENTS.md), the operating-system router.

Do not modify the make-docs-managed trees (`docs/`, `.make-docs/`). See the active guardrail
[Respect the make-docs plug-in boundary](playbooks/administrative/respect-make-docs-plugin-boundary.md).
