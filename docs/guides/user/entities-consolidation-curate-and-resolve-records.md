---
title: "Curate and Resolve Duplicate Entity Records"
path: "entities/consolidation"
status: draft
version: "2026-07-21"
order: 145
tags:
  - entities
  - personas
  - deduplication
  - migration
applies-to:
  - system/.os/data
  - system/.os/indexes
related:
  - "./understand-workspace-artifacts.md"
  - "./validate-system-data-and-indexes.md"
  - "./convert-source-material-with-buildos-intake.md"
  - "../developer/operating-layer-entities-consolidation-and-resolution.md"
  - "../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md"
  - "../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md"
  - "../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md"
  - "../../assets/history/2026-07-21-w1-r4-p3-reviewed-persona-consolidation-and-copied-root-rehearsal.md"
  - "../../prd/18-revise-unified-buildos-cli-and-distribution.md"
---

# Curate and Resolve Duplicate Entity Records

## Overview

Use this guide when your Build OS data contains several records that describe the same persona or another entity and you want to choose one winner without deleting the others.

Build OS is designed to keep the losing records as history. W1 R4 P2 now provides a source-built `buildos entities` command that validates the complete graph, previews or applies a reviewed redirect, resolves historical IDs, and checks or rebuilds the derived index. It is still development tooling: use an explicit staged binary path and a copied Build OS root. P2 does not authorize changing live data or replacing an installed binary.

The source-built command is `buildos entities`; there is no separate `buildos-entities` program.

| Delivery stage | What an operator can use |
| --- | --- |
| Current W1 R4 | Build `buildos` from source and invoke its explicit path for `entities` commands. Keep the separately installed `buildos-intake`, `buildos-discovery`, and `buildos-design` binaries in place. No package-manager installation or automatic upgrade is available. |
| Future W1 R5 | Package and distribute one `buildos` command, migrate the other domains under it, and provide compatible legacy command routing during the transition. Do not follow those installation steps until a verified release exists. |
| Future W2 | Add project setup, update, backup, removal, and tool-uninstall workflows. These commands do not exist in W1 R4. |

Keeping the legacy binaries installed does not prove that an older deployed version understands redirects. Keep live data unchanged until binary routing has been approved, and do not allow redirect-unaware tools to write after a future migration.

## Before You Begin

Identify these locations before running a command:

1. The source checkout where Build OS can be built.
2. A staging directory for the new source-built binary.
3. The installed Build OS command or wrapper currently used by your environment.
4. The live adopter-owned Build OS root containing `.os/data/` and `.os/indexes/`.
5. An untouched snapshot of that live root.
6. A disposable copied root used for rehearsal.
7. A review-output directory outside every canonical JSONL directory.

Stop if you cannot tell these locations apart. Do not copy the source checkout's `system/` folder over the installed system or your data root.

Create the snapshot and copied root as new paths. Keep the snapshot untouched so an operator can prove restoration later. The examples below use sanitized placeholders; replace every placeholder with a reviewed, explicit path.

## What Winner and Loser Mean

- The **winner** is the active record that should represent the entity going forward.
- A **loser** is a duplicate, consolidated record, or intentionally replaced record that remains available for history and evidence.
- The **canonical record** is the final active winner reached after following all redirects.
- A **review candidate** is only a suggestion. It does not change any record.

A loser is not deleted, emptied, or rewritten into the winner. Its original ID and evidence stay intact. Old references may keep that original ID while future Build OS readers show which canonical record it now resolves to.

## Safe Pre-Upgrade Audit

1. Open the [pre-upgrade entity consolidation audit prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md).
2. Replace every placeholder, including the installed root, source checkout, adopter-owned data root, review-output root, run ID, and entity types.
3. Start with personas unless your team has explicitly approved another entity type.
4. Give the completed prompt to the coding agent in the deployed environment.
5. Review the inventory, proposed duplicate groups, winner and loser suggestions, source evidence, confidence, ambiguous cases, checksums, and proposed migration manifest.
6. Approve, reject, or defer each proposed group. Leave ambiguous groups unresolved.
7. Preserve the review package outside `system/.os/data/` for later copied-root rehearsal.

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

## Current Source-Build Workflow

This is the current W1 R4 workflow. It is a copied-root rehearsal, not an installed upgrade and not a live-data migration.

Set the paths explicitly. `<staged-buildos>` is the binary you build from the source checkout. `<live-root>` is the adopter-owned Build OS root that contains `.os/data/` and `.os/indexes/`. `<snapshot-root>` and `<copied-root>` must be new, separate paths on storage with enough free space.

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

3. Build `toolkits/buildos/cmd/buildos` into a staging directory outside the checkout:

   ```sh
   cd <source-checkout>/toolkits/buildos
   go build -o <staging-directory>/buildos ./cmd/buildos
   ```

   Use `<staging-directory>/buildos` as `<staged-buildos>` in every command below.

4. Record the exact source revision and binary checksum. A development build reports version `dev` and source revision `unknown` unless build flags injected other values.
5. Confirm the binary and copied root before every command:

   ```sh
   <staged-buildos> version
   <staged-buildos> entities validate --root <copied-root> --mode compat
   ```

6. Resolve a representative historical ID without writing:

   ```sh
   <staged-buildos> entities resolve --root <copied-root> --mode compat --id <entity-id>
   ```

7. Confirm every loser in the version 1 manifest comes from the same canonical JSONL dataset. Split a cross-dataset review into one manifest per dataset. Preview one reviewed manifest; `consolidate` is a dry run unless `--apply` is present:

   ```sh
   <staged-buildos> entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest>
   ```

8. Review the complete plan and diagnostics. Confirm the preview reports no write. Stop on a missing target, cycle, cross-type redirect, inactive terminal, conflicting remap, unclear root, or unexpected affected file.
9. Apply only after the copied root, snapshot, manifest, and dry-run output have been approved. The explicit `--apply` below authorizes a write to `<copied-root>` only:

   ```sh
   <staged-buildos> entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
   ```

10. Require strict validation and a current derived index:

   ```sh
   <staged-buildos> entities validate --root <copied-root> --mode strict
   <staged-buildos> entities rebuild-index --root <copied-root> --mode strict --check
   ```

   If the check says the index is missing or stale, use the exact recovery command in the diagnostic. Its operation is equivalent to:

   ```sh
   <staged-buildos> entities rebuild-index --root <copied-root> --mode strict --apply
   ```

11. Repeat the check and prove rollback without overwriting the tested copy. Create a new `<restored-root>` from the untouched snapshot, compare its data and index checksums with the recorded baseline, and run compatibility validation against `<restored-root>`:

    ```sh
    cp -R <snapshot-root> <restored-root>
    diff -qr <snapshot-root>/.os/data <restored-root>/.os/data
    diff -qr <snapshot-root>/.os/indexes <restored-root>/.os/indexes
    <staged-buildos> entities validate --root <restored-root> --mode compat
    ```

    Expected result: both `diff` commands print nothing and validation succeeds.
12. Save the review packet, then stop. Obtain separate approvals for installed-binary routing and live-data migration. Success on a copy grants neither approval.

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
These commands are source-build-only in W1 R4 and must be invoked by explicit staged path against a copy first.
Do not put the staged binary on `PATH`, replace an installed wrapper, or interpret the absence of `--apply` on one command as permission for a later command.

## What the P3 Rehearsal Proved

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

1. The source revision, staged binary version, and staged binary checksum.
2. The copied-root or snapshot identity and baseline data/index checksums.
3. The reviewed manifest and its checksum.
4. The dry-run plan and every warning.
5. Strict validation, index-check, and representative lookup results.
6. The rollback location and proof that restoration worked.

Keep the binary-routing approval separate from the live-data-migration approval. A successful copy rehearsal does not grant either one.

## Rollback and Safe Stops

Stop without writing when the data root is unclear, the snapshot cannot be restored, a target is missing, two records have different entity types, a chain loops, a chain ends at an inactive record, a proposed mapping conflicts with an earlier decision, or an identity match is ambiguous.

To rehearse rollback, restore the entire copied `.os/data/` and `.os/indexes/` state from the untouched snapshot, compare their checksums with the recorded baseline, then rerun compatibility validation. If any baseline checksum differs, the rollback is not proven and live migration must remain blocked.

Prefer proving rollback into a new `<restored-root>` rather than deleting or overwriting the failed rehearsal. If a future live migration fails, stop using redirect-unaware tools, preserve the failure output and affected root, and follow the separately approved rollback procedure from the copied-root rehearsal. Do not delete losing rows or hand-edit the generated resolution index.

Exit code `6` is a special safe stop: canonical data committed, but index rebuilding failed. Do not restore only one file or rerun consolidation blindly. Preserve the output and run the exact `rebuild-index` recovery command reported by the tool against the same approved root.

## Troubleshooting

If the audit writes into `system/.os/data/`, stop it immediately and restore the affected files from the snapshot. The pre-upgrade task is proposal-only.

If a coding agent cannot distinguish the source checkout from the installed files, provide explicit sanitized paths before allowing it to continue.

If many personas look similar, ask reviewers to compare source anchors and intended use. Similar names or descriptions are not enough for an automatic merge.

If an old reference points to a loser, leave the historical reference unchanged. The resolver preserves that requested ID while reporting the canonical winner and chain.

If the real installed root is unavailable, do not use the source checkout's `system/` directory as a substitute. Continue only with the sanitized fixture rehearsal and record that the live step remains unapproved.

If a checksum differs from the approved review packet, stop before `--apply`. Confirm whether the binary, data copy, or manifest changed and obtain a fresh review when needed.

## FAQ

**Can we begin cleanup before package distribution and live deployment?**

You can inventory,
group,
and review personas now,
then use the current W1 R4 source-built command against a copied root.
Do not mutate live canonical records or references until copied-root rehearsal and separate migration approval are complete.

**Should we delete losing records after choosing a winner?**

No. The losing record preserves history, provenance, and old references.

**Can a winner be replaced later?**

Yes. The current source-built resolver follows the full chain to the newest active canonical record.

**Does a high similarity score create a redirect?**

No. Fuzzy, semantic, or ambiguous matches always require human review.

**Is building from source the same as upgrading the installed environment?**

No. Building produces a separate binary. Replacing installed binary routing and changing live data are separate operator approvals.

**Can I install this with a package manager?**

Not in W1 R4. Use the explicitly staged source build for copied-root rehearsal. Wait for a verified W1 R5 package before following package-manager or in-place upgrade instructions.

## Related Resources

- [Pre-Upgrade Entity Consolidation Audit Prompt](../../assets/prompts/pre-upgrade-entity-consolidation-audit.prompt.md)
- [Understand Workspace Artifacts](./understand-workspace-artifacts.md)
- [Validate System Data and Indexes](./validate-system-data-and-indexes.md)
- [Convert Source Material With buildos-intake](./convert-source-material-with-buildos-intake.md)
- [Maintainer Guide](../developer/operating-layer-entities-consolidation-and-resolution.md)
- [Entity Consolidation Design](../../designs/2026-07-21-entity-consolidation-and-canonical-resolution.md)
- [Entity Consolidation PRD](../../prd/17-enhance-entity-consolidation-and-canonical-resolution.md)
- [Unified BuildOS CLI and Distribution PRD](../../prd/18-revise-unified-buildos-cli-and-distribution.md)

## Future Coverage

- Blocked by: a concrete outcome-aware extraction writer. Update when: a user-facing producer persists validated `minted`, `referenced`, and `updated` outcomes. Guide change: add its exact reviewed workflow without implying that the shared validator writes records.
- Blocked by: W1 R5 package distribution. Update when: a verified `buildos 0.1.0` package and legacy command aliases are available. Guide change: replace source-build-only setup with package installation and upgrade steps.
- Blocked by: W2 project lifecycle. Update when: manifest-backed setup, update, backup, removal, and uninstall commands are available. Guide change: add the automated in-place project lifecycle path while keeping separate data-migration approvals.
