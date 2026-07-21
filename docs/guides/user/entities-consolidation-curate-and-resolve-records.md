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
  - "../../prd/18-revise-unified-buildos-cli-and-distribution.md"
---

# Curate and Resolve Duplicate Entity Records

## Overview

Use this guide when your Build OS data contains several records that describe the same persona or another entity and you want to choose one winner without deleting the others.

Build OS is designed to keep the losing records as history. A future redirect will point each loser toward its reviewed successor, and Build OS will follow that chain to one active canonical record. This capability is not implemented in the current checkout. For now, you may audit and propose mappings, but you must not change live entity data.

When W1 R4 is implemented,
the source-built command will be `buildos entities`.
There will not be a separate `buildos-entities` program.
At that stage,
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

## Expected Future Workflow

After the feature is implemented, the safe path will be:

1. Build `buildos` into a staging directory from a separate source checkout.
2. Record the exact source revision and binary checksum.
3. Invoke that exact binary path against a copied data root, never the live root first.
4. Run compatibility assessment and a non-writing preview.
5. Review every warning, proposed redirect, resolution chain, and index change.
6. Apply only an approved mapping to the copy.
7. Run strict validation, rebuild and check the derived resolution index, and test representative reads and writes.
8. Prove that the untouched snapshot can restore the original state.
9. Obtain separate approval to change installed binary routing.
10. Obtain separate approval to change live adopter-owned data.

Success in the copy does not automatically authorize either live action.

The planned command family is `buildos entities resolve`,
`validate`,
`consolidate`,
and `rebuild-index`.
These names describe the accepted contract only;
do not attempt to run them until your source build contains the implemented W1 R4 command and your team has verified it on a copied root.

## Rollback and Safe Stops

Stop without writing when the data root is unclear, the snapshot cannot be restored, a target is missing, two records have different entity types, a chain loops, a chain ends at an inactive record, a proposed mapping conflicts with an earlier decision, or an identity match is ambiguous.

If a future live migration fails, stop using redirect-unaware tools, preserve the failure output, and follow the verified rollback procedure from the copied-root rehearsal. Do not delete losing rows or hand-edit the generated resolution index.

## Troubleshooting

If the audit writes into `system/.os/data/`, stop it immediately and restore the affected files from the snapshot. The pre-upgrade task is proposal-only.

If a coding agent cannot distinguish the source checkout from the installed files, provide explicit sanitized paths before allowing it to continue.

If many personas look similar, ask reviewers to compare source anchors and intended use. Similar names or descriptions are not enough for an automatic merge.

If an old reference points to a loser, leave the historical reference unchanged for now. The future resolver will preserve that requested ID while reporting the canonical winner and chain.

## FAQ

**Can we clean up personas before the feature ships?**

You can inventory, group, and review them now. Do not mutate canonical records or references until the compatible tooling is implemented and verified.

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

- Blocked by: W1 R4 P2 unified CLI seed. Update when: the source-built `buildos entities` command surface and diagnostics pass validation. Guide change: add exact preview, apply, resolve, validate, and index-check commands with verified example output.
- Blocked by: W1 R4 P3 copied-root persona rehearsal. Update when: the persona pilot and restore test pass. Guide change: add a complete sanitized operator walkthrough, review checklist, expected warnings, and rollback steps.
- Blocked by: W1 R4 P4 extraction and consumer integration. Update when: redirect-aware reads and canonical writes are available. Guide change: show how old references appear, how new references are stored, and how repeated persona extraction reuses a reviewed canonical record.
- Blocked by: W1 R5 package distribution. Update when: a verified `buildos 0.1.0` package and legacy command aliases are available. Guide change: replace source-build-only setup with package installation and upgrade steps.
- Blocked by: W2 project lifecycle. Update when: manifest-backed setup, update, backup, removal, and uninstall commands are available. Guide change: add the automated in-place project lifecycle path while keeping separate data-migration approvals.
