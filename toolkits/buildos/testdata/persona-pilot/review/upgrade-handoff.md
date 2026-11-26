# Upgrade Handoff

This is sanitized rehearsal evidence. Marker values in angle brackets must be replaced by the operator for a real copied-root rehearsal.

## Recorded Fixture Evidence

| Evidence | Value |
| --- | --- |
| Environment | `sanitized-fixture` |
| Canonical root | `root/` |
| Reviewed apply manifest | `manifests/approved-persona-consolidations-v1.json` |
| Idempotence manifest | `manifests/approved-existing-replay-v1.json` |
| Unsafe conflict manifest | `manifests/intentionally-conflicting-remap-v1.json` |
| Snapshot identity | `<record-temporary-copy-checksum-or-snapshot-id>` |
| Rollback location | `<record-temporary-rollback-location>` |
| Staged binary path | `<record-explicit-staged-buildos-path>` |
| Source revision | `<record-source-revision>` |
| Binary SHA-256 | `<record-staged-binary-sha256>` |
| Installed binary inventory | `<record-without-replacing-installed-tools>` |
| Compatibility validation output | `<attach-rehearsal-output>` |
| Strict validation output | `<attach-rehearsal-output>` |
| Index diff | `<attach-rehearsal-output>` |

## Approval Boundary

Approval to use this synthetic manifest in a copied fixture is not approval to replace an installed binary or mutate adopter data. Binary deployment and live-data migration require separate operator decisions. Stop if the resolved root is not the intended disposable copy, if a checksum differs from the reviewed input, if validation reports an error, or if the diff contains any file other than the expected persona dataset and derived index.

## Rollback Expectation

Keep the baseline copy untouched. After testing, replace the disposable working copy from that baseline and verify the canonical dataset and index hashes against `checksums.txt`. Never attempt to repair a failed rehearsal by editing canonical rows by hand.
