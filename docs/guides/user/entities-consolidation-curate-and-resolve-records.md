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

The source-built command is `buildos entities`.
There will not be a separate `buildos-entities` program.
During W1 R4,
intake,
discovery,
and design will still use their existing separate binaries;
W1 R5 will later consolidate and package them,
and W2 will later add project setup,
update,
backup,
removal,
and tool-uninstall workflows.

## Before You Begin

Identify four different locations:

1. The source checkout where Build OS can be built.
2. The installed Build OS program files currently used by your environment.
3. The adopter-owned data root containing your real records.
4. A review-output directory outside every canonical JSONL directory.

Stop if you cannot tell these locations apart. Do not copy the source checkout's `system/` folder over the installed system or your data root.

Create a recoverable snapshot or copy of the adopter-owned data root. Keep the snapshot untouched so an operator can restore it later.

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

P1 defines a future exact-match path for personas, but it does not add a runnable command yet. A team may approve aliases and one `persona-v1` identity phrase for a persona. Build OS may reuse that persona automatically only when the exact approved value leads to one active canonical persona after following redirects.

Build OS will not treat similar wording as an exact identity. Fuzzy or semantic similarity, punctuation changes, synonym guesses, and ambiguous aliases remain review candidates. They do not create redirects or change records automatically.

When extraction integration arrives in P4, its record will say whether it minted a new entity, referenced an unchanged canonical entity, or deliberately updated an existing one. That history remains tied to the canonical ID known at extraction time.

## Current Source-Build Workflow

Set two paths explicitly. `<staged-buildos>` is the binary you built from this source checkout. `<copied-root>` is a disposable copy of the installed Build OS `system/` root, the directory that contains `.os/data/` and `.os/indexes/`.

1. Build `toolkits/buildos/cmd/buildos` into a staging directory outside the checkout:

   ```sh
   cd <source-checkout>/toolkits/buildos
   go build -o <staging-directory>/buildos ./cmd/buildos
   ```

   Use `<staging-directory>/buildos` as `<staged-buildos>` in every command below.

2. Record the exact source revision and binary checksum. A development build reports version `dev` and source revision `unknown` unless build flags injected other values.
3. Confirm the binary and copied root before every command:

   ```sh
   <staged-buildos> version
   <staged-buildos> entities validate --root <copied-root> --mode compat
   ```

4. Resolve a representative historical ID without writing:

   ```sh
   <staged-buildos> entities resolve --root <copied-root> --mode compat --id <entity-id>
   ```

5. Confirm every loser in the version 1 manifest comes from the same canonical JSONL dataset. Split a cross-dataset review into one manifest per dataset. Preview one reviewed manifest; `consolidate` is a dry run unless `--apply` is present:

   ```sh
   <staged-buildos> entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest>
   ```

6. Review the complete plan and diagnostics. Stop on a missing target, cycle, cross-type redirect, inactive terminal, conflicting remap, unclear root, or unexpected affected file.
7. Apply only after the copied root, snapshot, and manifest have been approved:

   ```sh
   <staged-buildos> entities consolidate --root <copied-root> --mode compat --manifest <reviewed-manifest> --apply
   ```

8. Require strict validation and a current derived index:

   ```sh
   <staged-buildos> entities validate --root <copied-root> --mode strict
   <staged-buildos> entities rebuild-index --root <copied-root> --mode strict --check
   ```

   If the check says the index is missing or stale, use the exact recovery command in the diagnostic. Its operation is equivalent to:

   ```sh
   <staged-buildos> entities rebuild-index --root <copied-root> --mode strict --apply
   ```

9. Repeat the check and prove that the untouched snapshot can restore the original copy.
10. Obtain separate approvals for installed-binary routing and live-data migration. Success on a copy grants neither approval.

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

If a future live migration fails, stop using redirect-unaware tools, preserve the failure output, and follow the verified rollback procedure from the copied-root rehearsal. Do not delete losing rows or hand-edit the generated resolution index.

## Troubleshooting

If the audit writes into `system/.os/data/`, stop it immediately and restore the affected files from the snapshot. The pre-upgrade task is proposal-only.

If a coding agent cannot distinguish the source checkout from the installed files, provide explicit sanitized paths before allowing it to continue.

If many personas look similar, ask reviewers to compare source anchors and intended use. Similar names or descriptions are not enough for an automatic merge.

If an old reference points to a loser, leave the historical reference unchanged. The resolver preserves that requested ID while reporting the canonical winner and chain.

If the real installed root is unavailable, do not use the source checkout's `system/` directory as a substitute. Continue only with the sanitized fixture rehearsal and record that the live step remains unapproved.

If a checksum differs from the approved review packet, stop before `--apply`. Confirm whether the binary, data copy, or manifest changed and obtain a fresh review when needed.

## FAQ

**Can we clean up personas before the feature ships?**

You can inventory, group, and review them now, then use the P2 source-built command against a copied root. Do not mutate live canonical records or references until copied-root rehearsal and separate migration approval are complete.

**Should we delete losing records after choosing a winner?**

No. The losing record preserves history, provenance, and old references.

**Can a winner be replaced later?**

Yes. The future resolver follows the full chain to the newest active canonical record.

**Does a high similarity score create a redirect?**

No. Fuzzy, semantic, or ambiguous matches always require human review.

**Is building from source the same as upgrading the installed environment?**

No. Building produces a separate binary. Replacing installed binary routing and changing live data are separate operator approvals.

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

- Blocked by: W1 R4 P4 extraction and consumer integration. Update when: redirect-aware reads and canonical writes are available. Guide change: show how old references appear, how new references are stored, and how repeated persona extraction reuses a reviewed canonical record.
- Blocked by: W1 R5 package distribution. Update when: a verified `buildos 0.1.0` package and legacy command aliases are available. Guide change: replace source-build-only setup with package installation and upgrade steps.
- Blocked by: W2 project lifecycle. Update when: manifest-backed setup, update, backup, removal, and uninstall commands are available. Guide change: add the automated in-place project lifecycle path while keeping separate data-migration approvals.
