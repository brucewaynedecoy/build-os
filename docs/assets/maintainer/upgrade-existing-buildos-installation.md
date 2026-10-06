---
title: "Upgrade an Existing BuildOS Installation"
path: "maintenance/upgrade-existing-installation"
status: draft
version: "2026-07-21"
order: 150
tags:
  - upgrade
  - maintenance
  - source-build
  - recovery
applies-to:
  - system/
  - toolkits/buildos/
  - toolkits/buildos-intake/
  - toolkits/buildos-discovery/
  - toolkits/buildos-design/
related:
  - "../user/upgrade-an-existing-buildos-project.md"
  - "buildos-toolkit-cli-development.md"
  - "operating-layer-entities-consolidation-and-resolution.md"
persona: maintainer
---

# Upgrade an Existing BuildOS Installation

## Overview

Use this procedure when BuildOS already exists on a machine or in a project,
but the available upgrade path is to build a newer checkout from source.
Produce a reviewable candidate,
prove it against copies,
and preserve a complete rollback path before touching installed commands or the live project.

W1 R4 is source-build-only.
It adds unified `buildos entities`,
while `buildos-intake`,
`buildos-discovery`,
and `buildos-design` remain separate binaries.
W1 R5 will consolidate and package those commands;
W2 will automate project installation and synchronization.
Do not use future W1 R5 or W2 commands as if they exist now.

This procedure has three independent approval gates:

1. replace or reroute installed binaries;
2. replace the live project root with the reviewed candidate while preserving adopter-owned content;
3. migrate redirect-bearing canonical data.

Approval of one gate never implies approval of either of the others.

## Before You Begin

Choose and record distinct,
sanitized paths for:

- `<old-source>`: the source or release scaffold that originally supplied the installed project;
- `<new-source>`: the new BuildOS checkout;
- `<current-root>`: the adopter-owned live BuildOS project root;
- `<staging-dir>`: a directory that is not on `PATH`;
- `<backup-dir>`: read-only project and binary snapshots;
- `<candidate-parent>`: a new directory whose `system/` child is the merged project candidate;
- `<candidate-root>`: exactly `<candidate-parent>/system`;
- `<copied-root>`: a rehearsal copy of the untouched current root;
- `<restored-root>`: a disposable whole-root restoration used to prove the snapshot;
- `<rollback-root>`: a non-existent sibling path reserved for the pre-cutover project;
- `<failed-root>`: a non-existent sibling path reserved for a failed candidate;
- `<review-dir>`: commands,
  checksums,
  diffs,
  approvals,
  and validation output.

Stop if `<old-source>` cannot be identified.
A direct comparison of the current project with new source cannot distinguish adopter changes from upstream changes.

Inventory each installed command before building:

```sh
command -v buildos || true
command -v buildos-intake
command -v buildos-discovery
command -v buildos-design
buildos version --json || true
buildos-intake help
buildos-discovery help
buildos-design help
git -C <new-source> rev-parse HEAD
```

The three legacy binaries do not currently embed a common BuildOS version and revision envelope.
Tie them to the recorded source revision,
their resolved paths,
and their SHA-256 checksums.
Record the actual `buildos version --json` output;
a normal source build reports `dev` and `unknown` unless build flags inject metadata.

## Build a Staged Toolset

Create `<staging-dir>` without adding it to `PATH`.
Create every working destination once and stop if any already exists:

```sh
test ! -e <staging-dir>
test ! -e <review-dir>
test ! -e <backup-dir>
test ! -e <candidate-parent>
test ! -e <copied-root>
test ! -e <rollback-root>
test ! -e <failed-root>
mkdir <staging-dir>
mkdir <review-dir>
mkdir <backup-dir>
mkdir <backup-dir>/installed-routing
test ! -e <backup-dir>/route-rehearsal
mkdir <backup-dir>/route-rehearsal
mkdir <candidate-parent>
```

Build every current W1 R4 command by explicit output path:

```sh
cd <new-source>/toolkits/buildos
go test ./...
go build -o <staging-dir>/buildos ./cmd/buildos

cd <new-source>/toolkits/buildos-intake
go test ./...
go build -o <staging-dir>/buildos-intake ./cmd/buildos-intake

cd <new-source>/toolkits/buildos-discovery
go test ./...
go build -o <staging-dir>/buildos-discovery ./cmd/buildos-discovery

cd <new-source>/toolkits/buildos-design
go test ./...
go build -o <staging-dir>/buildos-design ./cmd/buildos-design
```

Verify by explicit path:

```sh
<staging-dir>/buildos version --json
<staging-dir>/buildos help
<staging-dir>/buildos-intake help
<staging-dir>/buildos-discovery help
<staging-dir>/buildos-design help
```

Record the source revision,
reported metadata,
resolved paths,
and SHA-256 checksums in `<review-dir>`.
On macOS use `shasum -a 256`;
on Linux use `sha256sum`.
Do this for all staged and currently installed binaries.

Do not run `just install-toolkits` for this rehearsal.
That recipe writes legacy binaries to an installation directory and does not install unified `buildos`.

## Snapshot Before Comparison

Create recoverable,
separate snapshots of:

- the entire `<current-root>`;
- each installed binary or wrapper;
- installed command paths and checksums;
- the old and new source revisions;
- adopter configuration;
- canonical `.os/data/*.jsonl`;
- `workspace/`;
- project artifacts such as `docs/`;
- existing `backups/`;
- custom instructions,
  local agent files,
  and unmanaged extensions.

Create the whole-project snapshot at a new destination:

```sh
test ! -e <backup-dir>/project-before-upgrade
cp -R <current-root> <backup-dir>/project-before-upgrade
```

Snapshot wrapper or symlink routing separately from its resolved target:

```sh
ls -l <installed-command> > <review-dir>/installed-command-routing.txt
readlink <installed-command> >> <review-dir>/installed-command-routing.txt || true
cp -Pp <installed-command> <backup-dir>/installed-routing/<command-name>
cp -p <resolved-installed-target> <backup-dir>/installed-routing/<command-name>.target
```

Repeat that block for every installed BuildOS command.
For a symlink,
copy the target into an isolated rehearsal directory,
create a new rehearsal-only link to that copied target,
and execute through the link:

```sh
mkdir <backup-dir>/route-rehearsal/<command-name>
cp -p <backup-dir>/installed-routing/<command-name>.target <backup-dir>/route-rehearsal/<command-name>/target
ln -s target <backup-dir>/route-rehearsal/<command-name>/route
test "$(readlink <backup-dir>/route-rehearsal/<command-name>/route)" = "target"
<backup-dir>/route-rehearsal/<command-name>/route help
```

For a shipped wrapper,
copy it into the rehearsal directory,
preserve its executable mode,
and run `help` through that copied wrapper with its documented `BUILDOS_*_BIN` override pointing to the copied target.
If a wrapper cannot be safely rerouted away from the live target,
stop and require an environment-specific sandbox before approving rollback.
For a regular installed binary,
execute the restored target directly.
Compare restored-target checksums in every case.
Do not approve cutover until this routing restoration rehearsal passes.

Do not treat `.os/indexes/` as canonical.
Retain its pre-upgrade copy for audit and rollback evidence,
but regenerate candidate indexes from preserved canonical inputs.

Verify that a fresh restoration from `<backup-dir>` is possible before continuing.
Restore the whole project snapshot to a new `<restored-root>`,
run `diff -qr` against the snapshot,
and validate that restored root in compatibility mode.
The whole-root content diff must be empty;
checking only `.os/data/` or `.os/indexes/` is not sufficient.

```sh
test ! -e <restored-root>
cp -R <backup-dir>/project-before-upgrade <restored-root>
diff -qr <backup-dir>/project-before-upgrade <restored-root>
<staging-dir>/buildos entities validate --root <restored-root> --mode compat
```

`cp -R` plus `diff -qr` does not prove ownership,
modes,
ACLs,
xattrs,
or every platform-specific attribute.
Record symlinks,
executable paths,
and platform-appropriate `stat`,
ACL,
and xattr inventories for the snapshot and restoration.
Compare every attribute the deployment requires and call the result content-equivalent plus metadata-verified,
not byte-identical.

## Perform the Three-Way Comparison

Compare the old shipped scaffold,
the current adopter project,
and the new shipped scaffold.
Capture full diffs so no unrelated directory named `indexes` is hidden.
Classify only the exact `.os/indexes/` subtree as derived during review:

```sh
diff -ruN <current-root> <old-source>/system > <review-dir>/current-vs-old.diff
diff -ruN <new-source>/system <old-source>/system > <review-dir>/new-vs-old.diff
diff -ruN <current-root> <new-source>/system > <review-dir>/current-vs-new.diff
```

For `diff`,
exit code `0` means no differences and `1` means reviewed differences exist.
Any other code is a failure.

Classify every changed path:

| Class | Required action |
| --- | --- |
| Adopter-owned | Preserve the current project version. |
| Upstream-managed | Take the reviewed new-source version. |
| Changed by both | Merge deliberately and retain the reviewed diff. |
| Derived | Do not copy; regenerate from canonical inputs. |
| Unknown | Stop until ownership is established. |

Never replace `<current-root>` with `<new-source>/system`.
The candidate must preserve adopter configuration,
canonical data,
workspace evidence,
project artifacts,
backups,
custom instructions,
and unmanaged extensions.

## Assemble and Validate a Candidate

Create `<candidate-root>` from new source at the already empty parent:

```sh
test ! -e <candidate-root>
cp -R <new-source>/system <candidate-root>
```

Apply the reviewed three-way ownership inventory to that copy.
Review its ownership classification before running any writer.

Regenerate intake-owned derived indexes from the candidate's canonical inputs.
These commands expect the candidate to be named `system/` under its parent:

```sh
cd <candidate-parent>
<staging-dir>/buildos-intake index references
<staging-dir>/buildos-intake index playbooks
```

Then check or rebuild the entity index:

```sh
<staging-dir>/buildos entities validate --root <candidate-root> --mode compat
<staging-dir>/buildos entities rebuild-index --root <candidate-root> --mode strict --check
```

If the index is missing or stale,
review the recovery diagnostic before authorizing a candidate-only rebuild:

```sh
<staging-dir>/buildos entities rebuild-index --root <candidate-root> --mode strict --apply
<staging-dir>/buildos entities validate --root <candidate-root> --mode strict
<staging-dir>/buildos entities rebuild-index --root <candidate-root> --mode strict --check
```

Never hand-edit or copy `references.json`,
`playbooks.json`,
or `entity-resolution.json` to silence validation.

Run repository-specific tests and representative discovery/design workflows only against the candidate or another copy.
Keep installed commands and `<current-root>` unchanged.

## Rehearse Entity Migration on a Copy

Create `<copied-root>` from the untouched current-root snapshot,
not from the new checkout's `system/` directory.

Run read-only checks and a consolidation preview:

```sh
<staging-dir>/buildos entities validate --root <copied-root> --mode compat
<staging-dir>/buildos entities resolve --root <copied-root> --mode compat --id <representative-entity-id>
<staging-dir>/buildos entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest>
```

The preview omits `--apply` and must report no write.
Only after reviewers approve the copied root,
snapshot,
manifest,
and preview may the copy be changed:

```sh
<staging-dir>/buildos entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
<staging-dir>/buildos entities validate --root <copied-root> --mode strict
<staging-dir>/buildos entities rebuild-index --root <copied-root> --mode strict --check
```

Repeat the rehearsal to prove idempotence,
including the same `consolidate --apply` invocation with byte-identical canonical data and index output.
Then run representative redirect-aware discovery and design write operations,
and restore another copy from the untouched snapshot.
The restored canonical data must be byte-identical to the snapshot,
and compatibility validation must pass.

For discovery,
use a reviewed historical loser as `--target` and the staged discovery binary through the copied root's wrapper.
Verify that the new run stores the terminal canonical target while its command output retains the requested ID and chain.
For design,
use a copied-root fixture with a redirected qualified finding,
preview and then promote through the staged design binary,
and verify that only the canonical finding receives the design back-reference.
Use the exact command forms in the linked discovery and design user guides;
never create these proof writes in the live project.

Before any redirect-bearing data can become live,
inventory every writer of governed entity IDs.
Old or redirect-unaware binaries,
agents,
scheduled jobs,
and wrappers must be made read-only or removed from every write path.
Record the replacement writer and its checksum in the review packet.
An unknown writer is a safe stop.

## Approval and Cutover

Prepare one review packet containing:

- old,
  current,
  new,
  candidate,
  copied-root,
  staging,
  and backup paths;
- source revisions,
  binary paths,
  version output,
  and checksums;
- three-way diffs and ownership decisions;
- test,
  compatibility,
  strict,
  index,
  copied-root,
  and rollback evidence;
- reviewed manifests;
- the exact binary rollback and whole-root rollback commands.

Request binary-replacement approval first.
For each approved regular-file target,
copy the staged binary to a sibling temporary path,
verify its checksum,
and atomically rename it over the resolved target:

```sh
cp <staging-dir>/<command-name> <resolved-installed-target>.next
chmod 0755 <resolved-installed-target>.next
<sha256-command> <resolved-installed-target>.next
mv <resolved-installed-target>.next <resolved-installed-target>
```

Do not overwrite a symlink path or wrapper with this pattern.
Update only the approved resolved target,
then verify the wrapper,
resolved path,
checksum,
and non-writing help/version behavior.
Do not change project files or canonical data during binary cutover.

Request project-root-cutover approval separately.
It must name the candidate checksum inventory,
`<current-root>`,
`<rollback-root>`,
`<failed-root>`,
maintenance window,
and rollback commands.
All four paths must be on the same filesystem and both destination paths must not exist.
Immediately before approval and again before the swap,
pause every writer and compare `<current-root>` with the approved final-current snapshot and checksum inventory.
If any adopter write occurred after candidate assembly,
invalidate the approval,
reconcile that change into the candidate,
regenerate indexes,
and rerun all candidate and copied-root gates.
Keep the project frozen continuously from the final clean comparison through the swap and post-swap checks.
After that final drift gate,
perform the recoverable sibling swap:

```sh
test ! -e <rollback-root>
test ! -e <failed-root>
mv <current-root> <rollback-root>
mv <candidate-root> <current-root>
```

Immediately run config,
compatibility,
strict,
index,
and representative read checks against the new `<current-root>`.
If any check fails,
restore before writes resume:

```sh
mv <current-root> <failed-root>
mv <rollback-root> <current-root>
```

Keep `<rollback-root>` until the observation period ends.
This project-root cutover preserves canonical data and does not authorize redirect migration.

Request live-data-migration approval as the third gate.
That approval must name the verified binary checksum,
live root,
snapshot,
manifest,
expected writes,
recovery command,
rollback location,
and evidence that no redirect-unaware writer can mutate governed data.
Without it,
keep the live data unchanged.

## Rollback and Safe Stops

For a binary-only failure,
restore the saved binaries and wrappers,
verify their original paths and checksums,
and rerun non-writing checks.
Do not modify canonical data during binary rollback.

For a candidate failure,
discard the candidate and diagnose from retained evidence.
Do not repair the live project in place.

For a project-root cutover failure,
move the failed candidate to `<failed-root>` and restore `<rollback-root>` to the exact live path before any writer resumes.
Re-verify whole-root identity,
installed routing,
and non-writing validation.

For an approved live migration failure,
stop redirect-unaware writers,
retain the failed root and output,
and restore the whole root using the rehearsal-proven procedure.
Do not restore only one JSONL file or hand-edit an index.

Exit code `6` means the canonical write committed but entity-index rebuilding failed.
Do not rerun consolidation blindly.
Run the exact recovery command reported by `buildos` against the same approved root.

Stop before cutover when:

- any source,
  root,
  staging,
  backup,
  wrapper,
  or binary path is ambiguous;
- a snapshot is incomplete or restoration has not been proved;
- a revision,
  version,
  checksum,
  manifest,
  or diff changes after approval;
- a changed-by-both or unknown-ownership path remains unresolved;
- adopter configuration,
  canonical data,
  workspace,
  project artifacts,
  backups,
  or custom instructions are missing;
- an index was copied or edited instead of regenerated;
- compatibility or strict validation reports an unresolved error;
- a dry run reports an unexpected root,
  file,
  mapping,
  or write;
- an atomic write or index rebuild fails without an approved recovery;
- any redirect-unaware writer remains active after redirect-bearing data would become live;
- any of the three required approvals is absent.

## Related Resources

- [Upgrade an Existing BuildOS Project](../user/upgrade-an-existing-buildos-project.md)
- [Build OS Toolkit CLI Development](buildos-toolkit-cli-development.md)
- [Entity Consolidation and Canonical Resolution Maintenance](operating-layer-entities-consolidation-and-resolution.md)
- [Record Discovery Runs and Qualify Findings](../user/record-discovery-runs-and-qualify-findings.md)
- [Promote Qualified Findings to Designs](../user/promote-qualified-findings-to-designs.md)

## Future Coverage

W1 R5 will replace the four-binary source-build posture with packaged `buildos 0.1.0` and temporary legacy aliases after distribution gates pass.
W2 will add manifest-backed project setup,
update,
backup,
removal,
and uninstall behavior inside `buildos`.
Until those features are implemented and verified,
this manual staged-build,
three-way comparison,
copied-root rehearsal,
and three-gate approval procedure remains authoritative.
