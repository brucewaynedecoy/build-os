---
title: "Curate and Resolve Duplicate Entity Records"
path: "entities/consolidation"
status: draft
version: "2026-11-26"
order: 145
tags:
  - entities
  - personas
  - deduplication
  - migration
applies-to:
  - .os/data
  - .os/indexes
related:
  - "understand-workspace-artifacts.md"
  - "validate-system-data-and-indexes.md"
  - "convert-source-material-with-buildos-intake.md"
  - "../maintainer/operating-layer-entities-consolidation-and-resolution.md"
  - "../maintainer/pre-upgrade-entity-consolidation-audit.prompt.md"
  - "../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/17-entity-identity-and-canonical-resolution.md"
  - "../../../.make-docs/archive/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md"
  - "../../prd/20-buildos-cli-and-distribution.md"
persona: user
---

# Curate and Resolve Duplicate Entity Records


## Overview

Operational paths in this guide start at the initialized project root. It contains `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/`. Source links below point into the BuildOS checkout; those source directories are not required in your project.

Use this guide when your Build OS data contains several records that describe the same persona or another entity and you want to choose one winner without deleting the others.

Build OS is designed to keep the losing records as history. The `buildos entities` commands validate the complete graph, preview or apply a reviewed redirect, resolve historical IDs, and check or rebuild the derived index. They ship in the `build-os` npm package (Node.js 24 or newer) and run through the project wrapper `.os/scripts/buildos entities ...`. Rehearse every consolidation on a copied Build OS root first: a successful copy does not authorize changing live data.

The command is `buildos entities`; there is no separate `buildos-entities` program. `consolidate` and `rebuild-index` write only with `--apply`.

`buildos discovery` and `buildos design` resolve entity IDs with the same redirect-aware resolver, so after a migration no BuildOS command is redirect-unaware. Keep tools from outside BuildOS that write `.os/data/` away from migrated data.

## Before You Begin

Identify these locations before running a command:

1. The exact BuildOS version you will use, written below as `<buildos>`: `npx -y build-os@<version>`, or the project wrapper `.os/scripts/buildos` of a project that pins that version.
2. The BuildOS version the live project pins in `.os/manifest.json`, if it is a different one.
3. Where the review packet will record the version: run `<buildos> version` and keep its output.
4. The live adopter-owned Build OS root containing `.os/data/` and `.os/indexes/`.
5. An untouched snapshot of that live root.
6. A disposable copied root used for rehearsal.
7. A review-output directory outside every canonical JSONL directory.

Stop if you cannot tell these locations apart. Do not copy any other project's files over your data root.

Create the snapshot and copied root as new paths. Keep the snapshot untouched so an operator can prove restoration later. The examples below use sanitized placeholders; replace every placeholder with a reviewed, explicit path.

## What Winner and Loser Mean

- The **winner** is the active record that should represent the entity going forward.
- A **loser** is a duplicate, consolidated record, or intentionally replaced record that remains available for history and evidence.
- The **canonical record** is the final active winner reached after following all redirects.
- A **review candidate** is only a suggestion. It does not change any record.

A loser is not deleted, emptied, or rewritten into the winner. Its original ID and evidence stay intact. Old references may keep that original ID while future Build OS readers show which canonical record it now resolves to.

## Safe Pre-Upgrade Audit

1. Open the [pre-upgrade entity consolidation audit prompt](../maintainer/pre-upgrade-entity-consolidation-audit.prompt.md).
2. Replace every placeholder, including the installed root, source checkout, adopter-owned data root, review-output root, run ID, and entity types.
3. Start with personas unless your team has explicitly approved another entity type.
4. Give the completed prompt to the coding agent in the deployed environment.
5. Review the inventory, proposed duplicate groups, winner and loser suggestions, source evidence, confidence, ambiguous cases, checksums, and proposed migration manifest.
6. Approve, reject, or defer each proposed group. Leave ambiguous groups unresolved.
7. Preserve the review package outside `.os/data/` for later copied-root rehearsal.

During this audit, the agent must not:

- delete or merge canonical rows;
- add a `redirect` field;
- change a row to `superseded`;
- rewrite old references;
- edit a generated index;
- run an old tool against redirect-bearing data;
- treat confidence or similarity as approval.

## How to Choose a Winner

Prefer the record that has the clearest identity, strongest source evidence, best maintained narrative, and intended ongoing use. A longer record is not automatically better.

Use `duplicate` when two records mean the same thing, `consolidated` when several overlapping records were deliberately combined into a broader record, and `replaced` when an old record has an intentional successor but is not a duplicate.

If reviewers disagree, keep the records separate. A deferred decision is safer than an incorrect redirect.

## Exact Persona Reuse

P4 adds the shared exact-match rules for persona-producing code, but it does not add a new user-facing extraction command. A team may approve aliases and one `persona-v1` identity phrase for a persona. A producer may reuse that persona automatically only when the exact approved value leads to one active canonical persona after following redirects.

Build OS does not treat similar wording as an exact identity. Fuzzy or semantic similarity, punctuation changes, synonym guesses, malformed stored identity fields, and ambiguous or colliding aliases remain review candidates. They do not create redirects or change records automatically.

The P4 extraction validator distinguishes whether a proposed extraction minted a new entity, referenced an unchanged canonical entity, or deliberately updated an existing one. These lists must be present, separate, and canonical at the time of the extraction. A playbook ID needs the validator that also consults the authoritative playbook registry; the entity graph alone cannot validate playbooks. This validation does not itself write an extraction row or change live data.

## How Existing Tools Use Canonical IDs

The separately built discovery and design tools now use the same resolver package in process. They do not call the `buildos entities` command behind the scenes.

| Operation | What stays as history | What uses the winner |
| --- | --- | --- |
| Start a discovery run | The playbook's authored target and the requested target list remain available for audit. | Runtime execution and the new run's governed target references use terminal canonical IDs. |
| Qualify a finding | The requested run ID and raw-finding anchor remain available for audit. | The new finding links to the terminal canonical run and inherits its governed scope. |
| Promote a finding | The requested finding ID, losing record, and resolution chain remain available for audit. | The design is created from the terminal `qualified` finding, and only that finding receives the design back-reference. |

Command output reports the requested ID, canonical ID, and complete chain so you can see when a historical reference was redirected. If the graph is invalid, an ID is unknown, or the terminal record has the wrong lifecycle state, the operation stops before creating new records.

## Copied-Root Workflow

This is a copied-root rehearsal, not a live-data migration.

Set the paths explicitly. `<buildos>` is the BuildOS command at the exact version you chose, for example `npx -y build-os@0.1.0`. `<live-root>` is the adopter-owned Build OS root that contains `.os/data/` and `.os/indexes/`. `<snapshot-root>` and `<copied-root>` must be new, separate paths on storage with enough free space.

1. Confirm the live root before copying it:

   ```sh
   test -d <live-root>/.os/data
   test -d <live-root>/.os/indexes
   ```

   Stop if either check fails or if `<live-root>` points into the source checkout.

2. Create one untouched snapshot and one disposable working copy. Do not reuse existing destination directories:

   ```sh
   cp -R <live-root> <snapshot-root>
   cp -R <snapshot-root> <copied-root>
   ```

   Record checksums for the snapshot's `.os/data/` and `.os/indexes/`. From this point through the rehearsal, do not modify `<snapshot-root>` or `<live-root>`.

3. Record the BuildOS version and source revision that `<buildos> version` reports. Use the same exact version for every command below.
4. Check the package if your process asks for it: `SECURITY.md` in the package, section "How to Check a Release", checks the provenance and the tarball digest.
5. Confirm the version and the copied root before every command:

   ```sh
   <buildos> version
   <buildos> entities validate --root <copied-root> --mode compat
   ```

6. Resolve a representative historical ID without writing:

   ```sh
   <buildos> entities resolve --root <copied-root> --mode compat --id <entity-id>
   ```

7. Confirm every loser in the version 1 manifest comes from the same canonical JSONL dataset. Split a cross-dataset review into one manifest per dataset. Preview one reviewed manifest; `consolidate` is a dry run unless `--apply` is present:

   ```sh
   <buildos> entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest>
   ```

8. Review the complete plan and diagnostics. Confirm the preview reports no write. Stop on a missing target, cycle, cross-type redirect, inactive terminal, conflicting remap, unclear root, or unexpected affected file.
9. Apply only after the copied root, snapshot, manifest, and dry-run output have been approved. The explicit `--apply` below authorizes a write to `<copied-root>` only:

   ```sh
   <buildos> entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
   ```

10. Require strict validation and a current derived index:

   ```sh
   <buildos> entities validate --root <copied-root> --mode strict
   <buildos> entities rebuild-index --root <copied-root> --mode strict --check
   ```

   If the check says the index is missing or stale, use the exact recovery command in the diagnostic. From BuildOS `0.2.0`, the command starts with `npx -y build-os@<version>`, where `<version>` is the version that printed it. Run it in the shell it is written for (see [Run a Printed Command](#run-a-printed-command)). In BuildOS `0.1.0` the command starts with a bare `buildos`, which needs a global install; with `0.1.0`, run it with `<buildos>` in place of `buildos`, so the recovery uses the version you selected (a global install can be another version). Its operation is equivalent to:

   ```sh
   <buildos> entities rebuild-index --root <copied-root> --mode strict --apply
   ```

11. Repeat the check and prove rollback without overwriting the tested copy. Create a new `<restored-root>` from the untouched snapshot, compare its data and index checksums with the recorded baseline, and run compatibility validation against `<restored-root>`:

    ```sh
    cp -R <snapshot-root> <restored-root>
    diff -qr <snapshot-root>/.os/data <restored-root>/.os/data
    diff -qr <snapshot-root>/.os/indexes <restored-root>/.os/indexes
    <buildos> entities validate --root <restored-root> --mode compat
    ```

    Expected result: both `diff` commands print nothing and validation succeeds.
12. Save the review packet, then stop. Obtain a separate approval for the live-data migration. Success on a copy does not grant it.

Add `--json` to any entity command when an agent or script needs the stable automation envelope. It reports `ok`, the dotted command name, version, source revision, resolved root, mode, write status, result, and diagnostics. Human output is the default.

Exit codes identify the failure class:

| Code | Meaning |
| --- | --- |
| `0` | Success, including a clean check or dry run. |
| `2` | Invalid command or flags. |
| `3` | The root or required input could not be loaded or parsed. |
| `4` | Validation or a reviewed-remap conflict blocked the operation. |
| `5` | A canonical write could not be committed. |
| `6` | Canonical data committed, but index rebuilding failed; run the reported recovery command. |

The implemented command family is `buildos entities resolve`,
`validate`,
`consolidate`,
and `rebuild-index`.
Run them against a copy first.
Do not interpret the absence of `--apply` on one command as permission for a later command.

## What the P3 Rehearsal Proved

This rehearsal ran in W1 R4 with the earlier Go build of `buildos entities`, which the npm package replaced with the same behavior (its goldens are the parity baseline).

Build OS maintainers completed a reference rehearsal with a source-built binary and a disposable copy of sanitized persona fixtures. They did not change an installed binary or live adopter data. The actual adopter-owned root was unavailable, so the rehearsal stopped at the safe fixture boundary.

The reference build reported version `dev`, carried source revision `ce5aafb62bcd233a4671ca0d6eb4fe39ea38dca5`, and had SHA-256 `f28a1b83ba20065a39035f38fec045b04863212ee5173e4a019a1d8a04596946`. The approved example manifest had SHA-256 `db5642e06bb950fb56e3c917305ab5540b75734cad161efb62640860aeca55f2`. The untouched fixture, snapshot, and working copy shared tree SHA-256 `a24550f9329324372b4533d2d8a0b8086198b423fd45ede0d06523686a65c326`; after apply, the copied tree had SHA-256 `f8a716a5b54c205cc35375b0123328c986832c71b28038cfba26aeffd67543dc`; recreating the copy from the snapshot restored the baseline tree hash exactly. These values identify the reference evidence only; your locally built binary, reviewed manifest, and copied root need their own recorded checksums.

The rehearsal proved that:

- compatibility validation can assess the copy without changing it;
- preview leaves persona and index bytes unchanged;
- only explicitly approved persona mappings are applied;
- an ambiguous persona remains active and resolves to itself;
- strict validation and representative lookups succeed after apply;
- old evidence, anchors, and extra fields remain on losing rows;
- an identical apply is byte-stable;
- a conflicting remap fails without writing;
- an injected write failure leaves canonical data unchanged; and
- restoring the snapshot returns persona and index bytes exactly to their baseline state.

Before asking for any live-data approval, save a review packet containing:

1. The BuildOS version and source revision that `<buildos> version` reports.
2. The copied-root or snapshot identity and baseline data/index checksums.
3. The reviewed manifest and its checksum.
4. The dry-run plan and every warning.
5. Strict validation, index-check, and representative lookup results.
6. The rollback location and proof that restoration worked.

A successful copy rehearsal does not grant the live-data-migration approval.

## Rollback and Safe Stops

Stop without writing when the data root is unclear, the snapshot cannot be restored, a target is missing, two records have different entity types, a chain loops, a chain ends at an inactive record, a proposed mapping conflicts with an earlier decision, or an identity match is ambiguous.

To rehearse rollback, restore the entire copied `.os/data/` and `.os/indexes/` state from the untouched snapshot, compare their checksums with the recorded baseline, then rerun compatibility validation. If any baseline checksum differs, the rollback is not proven and live migration must remain blocked.

Prefer proving rollback into a new `<restored-root>` rather than deleting or overwriting the failed rehearsal. If a future live migration fails, stop using redirect-unaware tools, preserve the failure output and affected root, and follow the separately approved rollback procedure from the copied-root rehearsal. Do not delete losing rows or hand-edit the generated resolution index.

Exit code `6` is a special safe stop: canonical data committed, but index rebuilding failed. Do not restore only one file or rerun consolidation blindly. Preserve the output and run the exact `rebuild-index` recovery command reported by the tool against the same approved root. From `0.2.0` it starts with `npx -y build-os@<version>`; run it as [Run a Printed Command](#run-a-printed-command) says. With `0.1.0`, run it with `<buildos>` in place of its leading `buildos`, as in step 10 of the Copied-Root Workflow.

## Run a Printed Command

From BuildOS `0.2.0`, the recovery command in a diagnostic starts with `npx -y build-os@<version>`. The same text is in the JSON fields `remediation_command`, `recovery_command`, and `correction`. Each holds the command alone.

- Linux and macOS: the command is for a POSIX shell (`sh`, `bash`, or `zsh`). Run it as printed. The folder is in single quotes, so the shell changes nothing in it.
- Windows: the command is for Command Prompt with delayed expansion off (the default setting). The `action:` line says so: `action: run this in Command Prompt: <command>`. When the command holds a `!`, the label ends with `, with delayed expansion off`. Copy only the text after the label, and run it in Command Prompt. If you are not sure how delayed expansion is set on your computer, type `cmd /v:off` and press Enter first. This opens a Command Prompt with delayed expansion off.
- Windows PowerShell and PowerShell 7: do not paste the command there. PowerShell reads `$`, a backtick, and typographic quotation marks in its own way. In a folder name with `$` or a backtick, PowerShell can change the folder or run other text. Instead, type `cmd /v:off` and press Enter. This opens Command Prompt with delayed expansion off in the same window. A plain `cmd` uses the computer's own setting, which can be on. Paste the command and press Enter. Then type `exit` to go back to PowerShell.

Limits:

- The npm setting `bin-links=false` can break the `npx` form. When npx must download the package while the setting is on, it puts the package in its cache without its link. That run stops with `sh: build-os: command not found` (exit 127; tested in `sh` on macOS with npm 11.20.0). The problem then stays with that cached copy: it fails the same way later, also after you change the setting, and also through the project wrapper. A copy that npx cached with its link still runs when the setting is on. To fix a bad copy, remove it: `npm cache npx ls` lists the keys, and `npm cache npx rm <key>` removes the one for `build-os@<version>`. The next fetch must then have bin links on. If `bin-links=false` is still set and you only run the command again, npx caches a bad copy again (exit 127). Use one of these two routes. Each was tested in `sh` on macOS with npm 11.20.0 and a new npm cache, and each exits 0:
  - Put `npm_config_bin_links=true` in front of the command for that one run: `npm_config_bin_links=true npx -y build-os@<version> …`. This value overrides the `bin-links=false` setting for that command only.
  - Type the same arguments after the project wrapper, `.os/scripts/buildos`. The wrapper turns bin links on for its own `npx` run.

  After either route, the cached copy has its link, and the printed command runs as printed, also with `bin-links=false` set. Other systems and shells were not tested for this limit.
- The printed command names the version of the program that printed it. For a published release, that is the same package. A build from source prints `buildos`, because no npm version names it.
- BuildOS prints no PowerShell form of the command.

## Troubleshooting

If the audit writes into `.os/data/`, stop it immediately and restore the affected files from the snapshot. The pre-upgrade task is proposal-only.

If a coding agent cannot distinguish the source checkout from the installed files, provide explicit sanitized paths before allowing it to continue.

If many personas look similar, ask reviewers to compare source anchors and intended use. Similar names or descriptions are not enough for an automatic merge.

If an old reference points to a loser, leave the historical reference unchanged. The resolver preserves that requested ID while reporting the canonical winner and chain.

If the real installed root is unavailable, do not use the BuildOS source repository's `system/` folder as a substitute. Continue only with the sanitized fixture rehearsal and record that the live step remains unapproved.

If a checksum differs from the approved review packet, stop before `--apply`. Confirm whether the BuildOS version, data copy, or manifest changed and obtain a fresh review when needed.

## FAQ

**Can we begin cleanup before the live migration?**

You can inventory, group, and review personas now, then run `buildos entities` against a copied root.
Do not mutate live canonical records or references until copied-root rehearsal and separate migration approval are complete.

**Should we delete losing records after choosing a winner?**

No. The losing record preserves history, provenance, and old references.

**Can a winner be replaced later?**

Yes. The resolver follows the full chain to the newest active canonical record.

**Does a high similarity score create a redirect?**

No. Fuzzy, semantic, or ambiguous matches always require human review.

**Is a successful rehearsal the same as a migration?**

No. The rehearsal changes only the copy. Changing live data is a separate operator approval.

**How do I get the command?**

It is part of the `build-os` npm package. In a project, run `.os/scripts/buildos entities ...`; for a copied root, `npx -y build-os@<version> entities ... --root <copied-root>` works without an install. See [Upgrade an Existing BuildOS Project](upgrade-an-existing-buildos-project.md) to move a Go-era project to the package.

## Related Resources

- [Pre-Upgrade Entity Consolidation Audit Prompt](../maintainer/pre-upgrade-entity-consolidation-audit.prompt.md)
- [Understand Workspace Artifacts](understand-workspace-artifacts.md)
- [Validate System Data and Indexes](validate-system-data-and-indexes.md)
- [Convert Source Material With buildos-intake](convert-source-material-with-buildos-intake.md)
- [Maintainer Guide](../maintainer/operating-layer-entities-consolidation-and-resolution.md)
- [Entity Consolidation Design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Entity Identity and Canonical Resolution PRD](../../prd/17-entity-identity-and-canonical-resolution.md)
- [BuildOS CLI and Distribution PRD](../../prd/20-buildos-cli-and-distribution.md)

## Future Coverage

- Blocked by: a concrete outcome-aware extraction writer. Update when: a user-facing producer persists validated `minted`, `referenced`, and `updated` outcomes. Guide change: add its exact reviewed workflow without implying that the shared validator writes records.
- Blocked by: W1 R5 package distribution. Update when: a verified `buildos 0.1.0` package and legacy command aliases are available. Guide change: replace source-build-only setup with package installation and upgrade steps.
- Blocked by: W2 project lifecycle. Update when: manifest-backed setup, update, backup, removal, and uninstall commands are available. Guide change: add the automated in-place project lifecycle path while keeping separate data-migration approvals.
