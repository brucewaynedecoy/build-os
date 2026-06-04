# Phase 02: Toolkit Scaffold and Validation

## Purpose

Create the repository source namespace for packaged deterministic toolkits and validate that the W1 R2 prerequisite can be consumed by W1 R0 P3.

## Scope

This phase owns `toolkits/`, the scaffold-only `toolkits/buildos-intake/`, root README routing updates, validation, boundary scans, and post-edit index refreshes.

## Workstreams

| Workstream | Output | Dependency | Notes |
| --- | --- | --- | --- |
| Toolkit root | `toolkits/README.md`, `toolkits/AGENTS.md`, `toolkits/CLAUDE.md` | PRD 14 naming | Establishes the source namespace and router. |
| Intake scaffold | `toolkits/buildos-intake/README.md`, `AGENTS.md`, `CLAUDE.md` | Toolkit root | Scaffold only; no converter logic. |
| README routing | `README.md` | Toolkit root | Makes `toolkits/` discoverable from repo orientation. |
| Validation | Config validation, path hygiene, link check, diff check | Docs and scaffold complete | Confirms no make-docs-owned asset/template/reference edits. |
| Index refresh | jdocmunch and jcodemunch refresh | Validation complete | Keeps downstream agents aligned with the new doc/scaffold set. |

## Concurrency

The toolkit root scaffold and README routing can proceed in parallel once PRD 14 settles. The `buildos-intake` scaffold depends on the toolkit root naming but does not depend on guide completion.

Validation and index refresh should run after all docs and scaffold files are present.

## Blockers

- `buildos-intake` must remain scaffold-only in W1 R2.
- No generated binaries, release archives, converted outputs, or sample customer data should be added under `toolkits/`.
- Runtime wrappers under `system/.os/scripts/` should not be added until W1 R0 P3 defines the actual command surface.

## Validation

Run:

```sh
python3 system/.os/scripts/validate_config.py --self-test
python3 system/.os/scripts/validate_config.py
python3 .make-docs/scripts/check_path_hygiene.py --self-test
python3 .make-docs/scripts/check_path_hygiene.py --repo-root . --manifest .make-docs/manifest.json
git diff --check
```

Then confirm:

- Targeted relative-link check reports no missing links in touched docs.
- No prohibited paths changed except the allowed `docs/assets/history/` closeout breadcrumb.
- jdocmunch and jcodemunch indexes are refreshed.
