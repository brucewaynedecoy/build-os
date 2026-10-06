---
title: "Upgrade an Existing BuildOS Project"
path: "operations/upgrade-existing-project"
status: draft
version: "2026-07-21"
order: 150
tags:
  - upgrade
  - migration
  - backup
  - source-build
applies-to:
  - system/
  - toolkits/buildos/
  - toolkits/buildos-intake/
  - toolkits/buildos-discovery/
  - toolkits/buildos-design/
related:
  - "../maintainer/upgrade-existing-buildos-installation.md"
  - "entities-consolidation-curate-and-resolve-records.md"
  - "validate-system-data-and-indexes.md"
  - "understand-workspace-artifacts.md"
  - "../maintainer/buildos-toolkit-cli-development.md"
persona: user
---

# Upgrade an Existing BuildOS Project

## Overview

Use this guide when a working BuildOS project cannot use a clean upgrade path, but an operator can clone the current source and build its tools.

W1 R4 does not provide an in-place updater. Treat the upgrade as a reviewed migration into a new candidate root. Do not copy the new checkout's `system/` directory over the current project, replace installed commands during testing, or point a source-built tool at live data first.

Current and future capabilities are different:

| Delivery stage | Upgrade capability |
| --- | --- |
| Current W1 R4 | Build and stage `buildos` plus the still-separate `buildos-intake`, `buildos-discovery`, and `buildos-design` binaries from source. Compare and rehearse manually. `buildos entities` is available only from the staged unified binary. |
| Future W1 R5 | Distribute one packaged `buildos` command and provide verified legacy command routing during migration. Do not assume that package or its installation commands exist until a release is published and verified. |
| Future W2 | Add project setup, update, backup, removal, and tool-uninstall commands. None of those lifecycle commands are available in W1 R4. |

This procedure deliberately keeps three approvals separate:

1. Binary replacement: permission to change installed commands, wrappers, or command routing.
2. Project-root cutover: permission to make a fully reviewed candidate root the active project root.
3. Live redirect-data migration: permission to apply a reviewed entity manifest or otherwise change canonical redirect state in the active project.

Approval of one action does not approve either of the others. A team may deploy redirect-aware binaries and cut over a preserved project root while leaving live canonical data unchanged.

## Before You Begin

Schedule a maintenance window and identify one accountable operator. The operator should be able to restore both the current project and its installed commands.

Use explicit, sanitized paths for each location:

| Placeholder | Meaning |
| --- | --- |
| `<old-source>` | A clean checkout at the revision that best matches the installed project. This is the comparison base. |
| `<current-project>` | The live adopter-owned `system/` root. It contains `.os/`, `workspace/`, project artifacts, and custom instructions. |
| `<new-source>` | A clean checkout of the source revision being evaluated. |
| `<staging-dir>` | A new directory outside both source checkouts and the live project for source-built binaries. |
| `<backup-dir>` | A new directory outside the live project for project, binary, and review backups. |
| `<candidate-parent>` | A new directory whose `system/` child will become the upgrade candidate. |
| `<copied-parent>` | A new directory whose `system/` child is a disposable write-test copy. `<copied-root>` means `<copied-parent>/system`. |
| `<restored-parent>` | A new directory whose `system/` child proves whole-root restoration. `<restored-root>` means `<restored-parent>/system`. |
| `<review-dir>` | A directory outside canonical JSONL and index directories for inventories, diffs, checksums, manifests, and command output. |

Install or confirm access to Git,
Go,
`diff`,
and a SHA-256 tool:
`shasum -a 256` on macOS or `sha256sum` on Linux.
Ensure the backup and candidate locations have enough free space.

Stop before proceeding if:

- any path is unclear, overlaps another role, or points into a source checkout unexpectedly;
- `<old-source>` cannot be tied to the installed project closely enough to serve as a comparison base;
- the live project is changing while snapshots are being taken;
- backups cannot be stored outside the live project or restored independently;
- the current installed command paths cannot be identified; or
- the team has not agreed that this is a rehearsal rather than an automatic upgrade.

## Getting Started

Prove every destination is absent before creating anything. Each command must succeed silently:

```sh
test ! -e <staging-dir>
test ! -e <review-dir>
test ! -e <backup-dir>
test ! -e <backup-dir>/project-before-upgrade
test ! -e <backup-dir>/installed-routes
test ! -e <backup-dir>/installed-targets
test ! -e <backup-dir>/binary-restore-rehearsal
test ! -e <candidate-parent>
test ! -e <candidate-root>
test ! -e <copied-parent>
test ! -e <copied-root>
test ! -e <restored-parent>
test ! -e <restored-root>
test ! -e <staging-dir>/buildos
test ! -e <staging-dir>/buildos-intake
test ! -e <staging-dir>/buildos-discovery
test ! -e <staging-dir>/buildos-design
test ! -e <review-dir>/old-source-to-current-project.diff
test ! -e <review-dir>/old-source-to-new-source.diff
test ! -e <review-dir>/current-project-to-new-source.diff
```

Create the empty working directories. Use plain `mkdir` so the command fails instead of silently reusing a prior directory:

```sh
mkdir <staging-dir>
mkdir <review-dir>
mkdir <backup-dir>
mkdir <backup-dir>/installed-routes
mkdir <backup-dir>/installed-targets
mkdir <backup-dir>/binary-restore-rehearsal
mkdir <candidate-parent>
mkdir <copied-parent>
mkdir <restored-parent>
```

Stop if any command reports that its destination already exists. Choose new paths and update the upgrade record before continuing.

### 1. Record the current installation

Create an upgrade record under `<review-dir>`. Record the date, operator, purpose, and every resolved path from the table above.

Locate the installed commands without changing them:

```sh
command -v buildos
command -v buildos-intake
command -v buildos-discovery
command -v buildos-design
```

It is normal for `buildos` to be absent in a W1 R4 installation. Record `not installed` instead of inventing a path. For every path that exists, capture route metadata with the commands for the operator's platform:

```sh
ls -l <installed-command-path>
```

If `ls` identifies a symlink, record its link text too:

```sh
readlink <installed-command-path>
```

```sh
# macOS
stat -f '%N|%HT|%Sp|%Su|%Sg|%z|%m' <installed-command-path>
```

```sh
# Linux
stat -c '%n|%F|%A|%U|%G|%s|%Y' <installed-command-path>
```

If the route is a symlink or wrapper, resolve and record its executable target as `<resolved-installed-target>`. Record SHA-256 for a regular wrapper and for every resolved executable target. Use one platform block, not both:

```sh
# macOS
shasum -a 256 <installed-command-path>
shasum -a 256 <resolved-installed-target>
```

```sh
# Linux
sha256sum <installed-command-path>
sha256sum <resolved-installed-target>
```

The checksum tool may follow a symlink, so retain `ls`, `readlink`, and `stat` output with the target checksum. Run only non-writing identification commands:

```sh
<installed-buildos> version
<installed-buildos-intake> help
<installed-buildos-discovery> help
<installed-buildos-design> help
```

If a legacy command does not report a version, record `version not reported`; do not infer one. Record its path, checksum, and the old source revision instead.

Record the comparison revisions:

```sh
git -C <old-source> rev-parse HEAD
git -C <new-source> rev-parse HEAD
```

### 2. Build all current W1 R4 binaries into staging

Build the unified command and each legacy binary. Do not build into an installed binary directory and do not add `<staging-dir>` to `PATH`.

```sh
cd <new-source>/toolkits/buildos
go test ./...
go build -o <staging-dir>/buildos ./cmd/buildos
```

```sh
cd <new-source>/toolkits/buildos-intake
go test ./...
go build -o <staging-dir>/buildos-intake ./cmd/buildos-intake
```

```sh
cd <new-source>/toolkits/buildos-discovery
go test ./...
go build -o <staging-dir>/buildos-discovery ./cmd/buildos-discovery
```

```sh
cd <new-source>/toolkits/buildos-design
go test ./...
go build -o <staging-dir>/buildos-design ./cmd/buildos-design
```

Confirm the staged files by explicit path:

```sh
<staging-dir>/buildos version
<staging-dir>/buildos-intake help
<staging-dir>/buildos-discovery help
<staging-dir>/buildos-design help
shasum -a 256 <staging-dir>/buildos
shasum -a 256 <staging-dir>/buildos-intake
shasum -a 256 <staging-dir>/buildos-discovery
shasum -a 256 <staging-dir>/buildos-design
```

On Linux, use these checksum commands instead of the four `shasum` lines:

```sh
sha256sum <staging-dir>/buildos
sha256sum <staging-dir>/buildos-intake
sha256sum <staging-dir>/buildos-discovery
sha256sum <staging-dir>/buildos-design
```

Record the exact new source revision, every staged path, reported version, reported source revision when present, and SHA-256 checksum. A development `buildos` may report version `dev` and source revision `unknown` unless build metadata was injected; record what it actually reports.

### 3. Snapshot the project and installed commands

Pause project writes. Prove the project snapshot destination is absent; do not reuse or overwrite an earlier backup.

```sh
test ! -e <backup-dir>/project-before-upgrade
cp -R <current-project> <backup-dir>/project-before-upgrade
```

The project snapshot must include, without normalization:

- adopter configuration under `.os/config/`;
- canonical JSONL under `.os/data/`;
- workspace evidence and datasets under `workspace/`;
- adopter backup material under `backups/` when present;
- converted sources and other project assets;
- project requirements, designs, plans, work records, and other project artifacts;
- custom `AGENTS.md`, `CLAUDE.md`, routers, prompts, playbooks, templates, and local instructions; and
- unmanaged extensions such as locally added commands, hooks, integrations, scripts, or tool directories identified by the three-way inventory; and
- current `.os/indexes/` for exact rollback evidence only.

Snapshot each installed route without dereferencing symlinks, then snapshot its resolved executable target separately. Repeat these commands for `buildos`, `buildos-intake`, `buildos-discovery`, and `buildos-design` when present:

```sh
test ! -e <backup-dir>/installed-routes/<command-name>
test ! -e <backup-dir>/installed-targets/<command-name>
cp -Pp <installed-command-path> <backup-dir>/installed-routes/<command-name>
cp -p <resolved-installed-target> <backup-dir>/installed-targets/<command-name>
```

Record route and target backup paths, metadata, and SHA-256 checksums using the macOS `shasum -a 256` or Linux `sha256sum` commands shown above.

```sh
# macOS
shasum -a 256 <backup-dir>/installed-targets/<command-name>
shasum -a 256 <backup-dir>/installed-routes/<regular-wrapper-command-name>
```

```sh
# Linux
sha256sum <backup-dir>/installed-targets/<command-name>
sha256sum <backup-dir>/installed-routes/<regular-wrapper-command-name>
```

Rehearse binary-route restoration into the isolated rehearsal directory,
never into the installed location.
For a symlink,
build a new rehearsal-only link to the copied target and execute through it:

```sh
test ! -e <backup-dir>/binary-restore-rehearsal/<command-name>
mkdir <backup-dir>/binary-restore-rehearsal/<command-name>
cp -p <backup-dir>/installed-targets/<command-name> <backup-dir>/binary-restore-rehearsal/<command-name>/target
ln -s target <backup-dir>/binary-restore-rehearsal/<command-name>/route
test "$(readlink <backup-dir>/binary-restore-rehearsal/<command-name>/route)" = "target"
cmp <backup-dir>/installed-targets/<command-name> <backup-dir>/binary-restore-rehearsal/<command-name>/target
<backup-dir>/binary-restore-rehearsal/<command-name>/route help
```

For a regular binary,
run `help` directly through the copied target.
For a shipped wrapper,
copy the wrapper into its own rehearsal directory,
preserve executable mode,
and run `help` through it with its documented `BUILDOS_*_BIN` override pointing to the copied target.
If a wrapper cannot be safely redirected away from the live target,
stop and require an environment-specific sandbox.
Record restored route metadata and target SHA-256.
Confirm that the project snapshot contains `.os/data/`,
`.os/indexes/`,
`workspace/`,
`backups/` when present,
and every inventoried custom instruction or unmanaged extension before resuming any work.

## Core Workflow

### 1. Perform the three-way comparison

Compare the old shipped scaffold, the current adopter project, and the new shipped scaffold. Capture complete diffs, including derived indexes, so the audit proves they were classified rather than silently excluded.

```sh
diff -ruN <old-source>/system <current-project> > <review-dir>/old-source-to-current-project.diff
diff -ruN <old-source>/system <new-source>/system > <review-dir>/old-source-to-new-source.diff
diff -ruN <current-project> <new-source>/system > <review-dir>/current-project-to-new-source.diff
```

`diff` exits with code `1` when differences exist; that is expected. Treat other exit codes as failures.

Classify every relevant path:

| Classification | Action |
| --- | --- |
| Adopter-only | Preserve it in the candidate. |
| Upstream-only | Take the new source version. |
| Changed by both | Stop and merge deliberately with an operator-reviewed diff. Never choose a whole directory automatically. |
| Derived index | Do not migrate it into the candidate. Rebuild it from preserved canonical inputs. |
| Unknown ownership | Stop and identify the owner before copying. |

The old-source comparison is essential: a direct comparison between the current project and new source cannot reliably distinguish adopter work from upstream changes. Explicitly mark every `.os/indexes/` difference as derived, retain it in the audit, and exclude it only from the copy plan.

### 2. Assemble a separate candidate

Create the candidate from the new source without touching the live project:

```sh
cp -R <new-source>/system <candidate-parent>/system
```

Treat `<candidate-parent>/system` as `<candidate-root>`. Apply the reviewed three-way inventory to it:

1. Preserve the adopter's `.os/config/` values. If the new schema changed, merge field by field and retain a diff; do not replace real IDs with example values.
2. Preserve every canonical `.os/data/*.jsonl` row and unknown field. Do not delete, re-ID, deduplicate, or normalize rows as part of the binary upgrade.
3. Preserve `workspace/`, `backups/`, converted assets, project artifacts, custom instructions, and unmanaged extensions according to the inventory.
4. Take new upstream contracts, wrappers, templates, and shipped documentation when they do not overwrite adopter-owned changes.
5. Resolve every changed-by-both path manually. Keep the old, current, and new versions in the review packet.
6. Keep `<backup-dir>` outside `<candidate-root>` and `<current-project>`.
7. Do not copy `.os/indexes/` from the current project or its snapshot into the candidate.

After each preservation step, compare the candidate path to the project snapshot and record whether it was preserved exactly or intentionally migrated.

### 3. Regenerate indexes in the candidate

Run legacy index builders from `<candidate-parent>`, where the candidate is named `system/`. These commands write only derived files inside the candidate:

```sh
cd <candidate-parent>
<staging-dir>/buildos-intake index references
<staging-dir>/buildos-intake index playbooks
```

Check the entity index without writing:

```sh
<staging-dir>/buildos entities validate --root <candidate-root> --mode compat
<staging-dir>/buildos entities rebuild-index --root <candidate-root> --mode strict --check
```

If the tool reports a missing or stale entity index, review its recovery diagnostic, then authorize a candidate-only rebuild explicitly:

```sh
<staging-dir>/buildos entities rebuild-index --root <candidate-root> --mode strict --apply
<staging-dir>/buildos entities validate --root <candidate-root> --mode strict
<staging-dir>/buildos entities rebuild-index --root <candidate-root> --mode strict --check
```

Never hand-edit `references.json`, `playbooks.json`, or `entity-resolution.json` to make validation pass.

### 4. Rehearse entity behavior on a copied current root

Create `<copied-root>` from the untouched project snapshot, not from the checkout's `system/` scaffold:

```sh
test ! -e <copied-root>
cp -R <backup-dir>/project-before-upgrade <copied-root>
```

Run read-only checks first:

```sh
<staging-dir>/buildos entities validate --root <copied-root> --mode compat
<staging-dir>/buildos entities resolve --root <copied-root> --mode compat --id <representative-entity-id>
<staging-dir>/buildos entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest>
```

The final command is a dry run because it omits `--apply`. Confirm that it reports no write and only the approved files and mappings.

If and only if the copied root, snapshot, manifest, and dry-run output are approved, apply to the copy:

```sh
<staging-dir>/buildos entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
<staging-dir>/buildos entities validate --root <copied-root> --mode strict
<staging-dir>/buildos entities rebuild-index --root <copied-root> --mode strict --check
```

Prove replay idempotence. Record SHA-256 for `<affected-canonical-jsonl>` and `.os/indexes/entity-resolution.json`, apply the identical approved manifest a second time, then record both checksums again:

```sh
# macOS: before replay
shasum -a 256 <copied-root>/<affected-canonical-jsonl>
shasum -a 256 <copied-root>/.os/indexes/entity-resolution.json
<staging-dir>/buildos entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
shasum -a 256 <copied-root>/<affected-canonical-jsonl>
shasum -a 256 <copied-root>/.os/indexes/entity-resolution.json
```

```sh
# Linux: before replay, then after replay
sha256sum <copied-root>/<affected-canonical-jsonl>
sha256sum <copied-root>/.os/indexes/entity-resolution.json
<staging-dir>/buildos entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
sha256sum <copied-root>/<affected-canonical-jsonl>
sha256sum <copied-root>/.os/indexes/entity-resolution.json
```

Run only the block for the operator's platform. The before and after hashes must match exactly, and the replay must report no new change.

Exercise one redirect-aware discovery write on the copy. Use a reviewed historical target that resolves to a terminal canonical entity and an active discovery playbook:

```sh
<staging-dir>/buildos-discovery run discovery --playbook-id <PB-NNN> --outcome inconclusive --title "Upgrade rehearsal discovery" --target <historical-entity-id> --repo-root <copied-parent> --dry-run
<staging-dir>/buildos-discovery run discovery --playbook-id <PB-NNN> --outcome inconclusive --title "Upgrade rehearsal discovery" --target <historical-entity-id> --repo-root <copied-parent>
```

Confirm the output records the requested ID, canonical ID, and full chain, while the new run stores the terminal canonical target and preserves requested-ID audit detail.

Exercise one redirect-aware design write using a reviewed historical qualified finding that resolves to its terminal canonical finding:

```sh
<staging-dir>/buildos-design promote finding --finding-id <historical-qualified-finding-id> --route change-plan --title "Upgrade rehearsal design" --slug upgrade-rehearsal-design --repo-root <copied-parent> --dry-run
<staging-dir>/buildos-design promote finding --finding-id <historical-qualified-finding-id> --route change-plan --title "Upgrade rehearsal design" --slug upgrade-rehearsal-design --repo-root <copied-parent>
```

Confirm the design and back-reference use the canonical finding, the output preserves the requested ID and chain, and the losing historical row remains unchanged. These discovery and design commands allocate artifacts, so do not replay them as the idempotence test.

Prove rollback into a new restored copy and retain both the changed and restored roots:

```sh
test ! -e <restored-root>
cp -R <backup-dir>/project-before-upgrade <restored-root>
diff -qr <backup-dir>/project-before-upgrade <restored-root>
diff -qr <backup-dir>/project-before-upgrade/.os/data <restored-root>/.os/data
diff -qr <backup-dir>/project-before-upgrade/.os/indexes <restored-root>/.os/indexes
<staging-dir>/buildos entities validate --root <restored-root> --mode compat
```

All three `diff` commands should print nothing.
This proves content equivalence,
not ownership,
modes,
ACLs,
xattrs,
or all platform metadata.
Record and compare symlink,
executable-path,
platform `stat`,
ACL,
and xattr inventories required by the deployment.
Retain the content diffs,
metadata comparison,
restored-root checksum inventory,
and validation result as whole-root restoration evidence.
A successful copied-root rehearsal authorizes no binary replacement,
project-root cutover,
or live redirect-data migration.

### 5. Review the candidate before requesting approval

Run the project's documented validation and representative read-only workflows against the candidate. Confirm that:

- adopter config values and IDs are preserved;
- canonical data counts, IDs, provenance, and unknown fields are preserved unless a separately reviewed migration says otherwise;
- workspace evidence, datasets, project artifacts, converted assets, `backups/`, custom instructions, and unmanaged extensions are present;
- generated indexes reproduce from the preserved source artifacts;
- staged legacy commands can still perform their read-only or dry-run checks;
- `buildos entities` reports the expected root, mode, requested ID, canonical ID, and chain;
- no command path resolves to the live installed binary accidentally; and
- whole-root content is equivalent and required metadata is separately verified;
- installed route metadata and resolved binary targets can be restored from the binary snapshot.

Save the comparison diffs, inventory, versions, revisions, paths, checksums, validation output, candidate checksums, copied-root results, and rollback proof in `<review-dir>`.

### 6. Close every redirect-unaware write path

Before any live redirect-bearing data is allowed, inventory every way the environment can write: installed commands and wrappers, shell aliases, scheduled jobs, CI jobs, services, hooks, agent instructions, automation, and direct scripts. For each path, record the resolved executable and checksum.

Every old or redirect-unaware tool must be either removed from the write path or explicitly constrained to read-only use. Prove that every remaining discovery, design, consolidation, and other governed write path resolves to reviewed redirect-aware code. If any writer is unknown, still routes to an old binary, or can bypass canonical resolution, keep live data unchanged.

### 7. Request three separate approvals

Request binary-replacement approval with:

- old and staged binary paths and checksums;
- wrapper and symlink routing before and after the proposed change;
- the exact staged versions and source revision;
- legacy command compatibility results; and
- the binary rollback commands and backup locations.

Request project-root-cutover approval separately with:

- the exact current and candidate roots;
- the completed three-way ownership inventory and all resolved changed-by-both paths;
- proof that config, canonical data, workspace, `backups/`, project artifacts, custom instructions, and unmanaged extensions were preserved;
- regenerated-index and candidate-validation evidence;
- the environment-specific root-routing cutover steps; and
- a root-routing rollback procedure that returns to the untouched current root and verifies it against the whole-root snapshot.

Immediately before approving and performing the cutover,
pause every project writer and compare the live `<current-project>` with the approved final-current snapshot and checksum inventory.
If anything changed after candidate assembly,
invalidate the approval,
reconcile those adopter changes into the candidate,
regenerate indexes,
and repeat candidate,
copied-root,
rollback,
and approval checks.
Keep the project frozen continuously from the final clean drift check through the maintainer runbook's sibling swap and post-swap validation.

Request live redirect-data migration approval separately with:

- the exact live root and snapshot identity;
- the reviewed manifest and checksum;
- dry-run and strict-validation output;
- the affected canonical file list;
- index regeneration evidence; and
- whole-root rollback proof.

In W1 R4,
a human operator performs any approved binary replacement or project-root cutover using the exact,
environment-reviewed routes and the recoverable sibling-swap pattern in [the maintainer approval and cutover runbook](../maintainer/upgrade-existing-buildos-installation.md#approval-and-cutover).
The approval must name the commands,
approvers,
observation checks,
and rollback triggers.
This guide does not itself authorize replacement,
cutover,
or mutation.

## Rollback and Safe Stops

Keep the current project, candidate, copied root, restored root, review packet, and backups separate until the new installation has passed its agreed observation period.

For a binary-only failure, follow the approved route-specific rollback: restore each saved wrapper or symlink with its original metadata, restore or reroute to the saved resolved target, then verify `command -v`, `ls`, `readlink` when applicable, platform-appropriate SHA-256, and non-writing `help` or `version` output. Retain this as binary-routing restoration evidence. Do not change live canonical data during binary rollback.

For a candidate failure before cutover, abandon the candidate and leave the live project unchanged. Diagnose from the retained diffs; do not repair the live project in place. For a project-root failure after an approved cutover, follow the approved root-routing rollback to the untouched former root, then prove the restored root against the whole-root snapshot and rerun validation before reopening writes.

For an approved live migration failure, preserve the failure output and affected root, stop redirect-unaware writers, and follow the whole-root rollback procedure proved during rehearsal. Do not restore only one canonical JSONL file or hand-edit a derived index.

Exit code `6` from `buildos entities` means canonical data committed but index rebuilding failed. Preserve the output and run the exact reported `rebuild-index` recovery command against the same approved root. Do not rerun consolidation blindly.

Stop without continuing when any of these occurs:

- a source, project, candidate, backup, or installed-binary path is ambiguous;
- a snapshot is missing, incomplete, writable by an unexpected process, or cannot be restored;
- a checksum, revision, version, path, manifest, or reviewed diff changes after approval;
- the live project differs from the approved final-current snapshot at cutover;
- the three-way comparison reveals an unresolved changed-by-both or unknown-ownership file;
- adopter config, canonical data, workspace evidence, project artifacts, `backups/`, custom instructions, or unmanaged extensions are missing from the candidate;
- an index was copied or edited instead of regenerated;
- a whole-root restoration diff is nonempty or binary route/target restoration metadata cannot be reproduced;
- the repeated approved manifest changes canonical or index bytes;
- a representative redirect-aware discovery or design write fails, writes a historical loser ID as canonical, rewrites the losing row, or loses requested-ID audit detail;
- any old or redirect-unaware tool remains on a live write path;
- compatibility or strict validation reports a missing target, cycle, cross-type redirect, invalid terminal, conflicting remap, or stale index;
- a dry run reports an unexpected write, file, mapping, or root;
- a canonical write or index rebuild fails;
- an installed legacy command does not pass its compatibility check; or
- the binary-replacement, project-root-cutover, or live redirect-data migration approval is absent for the specific action being considered.

## Troubleshooting

If the old source revision is unknown, use installation records, checksums, release metadata, and repository history to identify the closest defensible base. If no defensible base exists, stop automated merging and perform a path-by-path manual ownership review.

If `command -v` returns an unexpected path, inspect wrappers and symlinks before proceeding. Do not assume the first executable on `PATH` is the installed BuildOS command that the project uses.

If a staged legacy command fails because it cannot find `system/`, confirm that it is being run from `<candidate-parent>` and that the candidate path is exactly `<candidate-parent>/system`.

If an index differs, compare its canonical inputs and rerun the owning index builder. Never copy the old index into the candidate as a shortcut.

If the new source requires a configuration field that the adopter project lacks, add only the reviewed field and retain existing values. Do not replace the entire config with the new source example.

If the candidate works but rollback does not reproduce the snapshot, the upgrade is not ready. Keep installed routing and live data unchanged.

## FAQ

**Can I copy the new `system/` directory over my project?**

No. That can overwrite adopter configuration, canonical data, workspace evidence, project artifacts, and custom instructions. Build a separate candidate and use the three-way comparison.

**Should indexes be included in the backup?**

Yes, for exact rollback evidence. Do not migrate them into the candidate; regenerate them from preserved canonical inputs.

**Can I replace binaries after copied-root entity tests pass?**

Only with separate binary-replacement approval. Copied-root success does not authorize command routing changes.

**Can I make the candidate the active project after its checks pass?**

Only with separate project-root-cutover approval and an environment-specific routing and rollback runbook. Candidate success does not authorize binary replacement or live redirect-data migration.

**Can I migrate live data after the new binaries are installed?**

Only with separate live redirect-data migration approval and a still-valid review packet. Binary deployment and project-root cutover do not authorize data mutation.

**Can I use a package manager for this procedure?**

Not for the W1 R4 source-build workflow. Wait for a verified W1 R5 package and installation guide; W2 lifecycle automation is later still.

## Related Resources

- [Upgrade an Existing BuildOS Installation - Maintainer Guide](../maintainer/upgrade-existing-buildos-installation.md)
- [Curate and Resolve Duplicate Entity Records](entities-consolidation-curate-and-resolve-records.md)
- [Validate System Data and Indexes](validate-system-data-and-indexes.md)
- [Understand Workspace Artifacts](understand-workspace-artifacts.md)
- [BuildOS Toolkit CLI Development](../maintainer/buildos-toolkit-cli-development.md)

## Future Coverage

- Blocked by: W1 R5 packaged distribution. Update when: a verified `buildos` package, installation metadata, and legacy aliases are released. Guide change: replace manual binary staging and routing steps with the verified package workflow while preserving snapshot, comparison, and separate data-migration approval gates.
- Blocked by: W2 project lifecycle. Update when: project setup, update, backup, removal, and tool-uninstall commands are implemented. Guide change: document those exact commands, dry-run output, rollback guarantees, and preservation behavior instead of implying that they exist today.
