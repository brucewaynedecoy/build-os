---
title: "Upgrade an Existing BuildOS Installation"
path: "maintenance/upgrade-existing-installation"
status: draft
version: "2026-11-24"
order: 150
tags:
  - upgrade
  - maintenance
  - rollback
  - release
applies-to:
  - system/
  - toolkits/buildos/
related:
  - "../user/upgrade-an-existing-buildos-project.md"
  - "buildos-toolkit-cli-development.md"
  - "operating-layer-entities-consolidation-and-resolution.md"
  - "../../prd/20-buildos-cli-and-distribution.md"
  - "../../../toolkits/buildos/SECURITY.md"
persona: maintainer
---

# Upgrade an Existing BuildOS Installation

This guide is for maintainers and operators who move a team's machines and projects from the earlier Go tools to the `buildos` npm package, or from one package version to another. The adopter-side steps are in [Upgrade an Existing BuildOS Project](../user/upgrade-an-existing-buildos-project.md). The release rules are in [PRD 20 Release](../../prd/20-buildos-cli-and-distribution.md#release), and the checks a reviewer runs are in [`SECURITY.md`](../../../toolkits/buildos/SECURITY.md).

## What an installation is now

- The command: `@brucewaynedecoy/buildos` on npm, run with `npx -y @brucewaynedecoy/buildos@<version>` (nothing installed) or installed with `npm install -g`. It needs Node.js 24 or newer and has no runtime dependencies.
- The project files: what `buildos init` copied from the package's `system/` content into the project root, plus `.os/manifest.json`, which pins the version.
- The wrappers: `.os/scripts/buildos` and `.os\scripts\buildos.cmd` always run the pinned version (pin first). They use an installed `buildos` only when it is an npm install of exactly the pinned version: in the project's `node_modules` folder, or the first `buildos` on `PATH` that is not a project wrapper. They read only the package files (no program starts to check a version), and they run that package's bin file with the same `node`. Else `npx -y @brucewaynedecoy/buildos@<pinned version>`.

There is no `buildos update`, `buildos uninstall`, or project sync yet (W2). The earlier Go toolkits and the Python validator are gone from the repository.

## Move a team from the Go tools

1. Pick the version and check it as `SECURITY.md`, "How to Check a Release", says: registry signature and provenance (`npm audit signatures`), the tarball SHA-256 against `toolkits/buildos/release-candidates.json`, and the SBOM on the GitHub Release.
2. Remove the Go binaries (`buildos-intake`, `buildos-discovery`, `buildos-design`, and any staged Go `buildos`) from every machine and from `PATH`. The new wrappers never run a Go-era `buildos` binary on `PATH`, because it is not an npm install of the pinned version; they do not start it to check it either.
3. In each project, commit or back up first, then run `npx -y @brucewaynedecoy/buildos@<version> init --dry-run`, review the plan, and run it without `--dry-run`. Adoption writes only `.os/manifest.json`, the wrappers, and `.os/skills/`; data, runs, findings, indexes, and config stay byte for byte.
4. Run `.os/scripts/buildos validate` and `.os/scripts/buildos entities validate --root . --mode compat`. Commit the adoption.
5. Update team notes and playbooks to `buildos <domain>`: the legacy names stop working in `0.3.0`.

## Machines without registry access

Fetch the tarball once with `npm pack @brucewaynedecoy/buildos@<version>` on a connected machine, check its SHA-256, and distribute the file. Install it with `npm install -g --offline ./brucewaynedecoy-buildos-<version>.tgz`. When its version is the pinned version, the wrappers then use that global `buildos` without the registry. A team npm mirror that serves the same tarball works too, since the digest and provenance are the same.

## Roll back

- Set `buildos_version` in `.os/manifest.json` back to the earlier exact version and commit it. This is the only rollback step: the pin always decides. You do not need to change or remove a global install. The wrapper uses a global install only when it is an npm install of exactly the pinned version; otherwise it fetches the pinned version through `npx`.
- Machines without registry access: install the earlier tarball as in the previous section, so the pinned version is there offline.
- A bad release: the maintainer marks it with `npm deprecate`, so installs warn; earlier versions stay installable. A deprecated pinned version still installs, so move projects off it.

Adoption itself is reversible from git: it only added or replaced the paths above.

## Entity data

Adoption does not change entity data. Redirect-aware consolidation is a separate, reviewed step on a copy first; see [Entity Consolidation and Canonical Resolution Maintenance](operating-layer-entities-consolidation-and-resolution.md).

## Future Coverage

- Blocked by: W2 lifecycle commands. Update when: `buildos update` and `buildos uninstall` ship. Guide change: replace the manual pin change and the manual removal steps with those commands, and describe how copied project files are refreshed.
