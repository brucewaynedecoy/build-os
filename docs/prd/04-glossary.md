# 04 Glossary

## Purpose

Define the canonical vocabulary used across the Build OS PRD set so humans and coding assistants interpret the same terms the same way.

## Terms

| Term | Definition | Notes |
| --- | --- | --- |
| Build OS | The general-purpose, filesystem-based, agent-operable discovery/testing/design system shipped under `system/`. | `README.md` |
| Build layer | `docs/` — how *we* build the system. One of the three spaces. | make-docs tree |
| Target docs | The initialized project's `docs/` tree — outputs *about the configured target system*, for the adopter. Make Docs creates it when the user chooses companion setup; BuildOS does not ship it. | make-docs tree, `05-spaces-boundary-and-shipping.md` |
| Pillar | One of Convert, Playbooks, Workspace. | `02-architecture-overview.md` |
| Flow A / B / C | Intake / Discovery / Planning-Engineering; the three chained flows. | `02-architecture-overview.md` |
| Convert | Deterministic, tool-first transform of a source into a clean text/CSV twin; no structuring. | `07-intake-and-conversion.md` |
| Extract | User-driven ETL that loads converted content into entities, playbooks, or docs. | `08-data-and-extraction.md` |
| Playbook | A typed Markdown instrument that guides a human or agent. | `09-playbooks.md` |
| State-nature | A playbook axis: `stateful` · `standing` · `guardrail`. | `system/.os/contracts/playbook-contract.md` |
| Guardrail | A non-executing playbook that constrains behavior (Scope/Rules/Rationale). | `system/playbooks/administrative/` |
| Draft | The pending lifecycle state for entity and extraction rows that are extracted or authored but not yet promoted. `candidate` is never an entity or extraction row status; only a converted source twin uses it. | PRD 08, PRD 07 |
| Review-to-activate | The editorial gate for instruments (`draft → reviewed → active`). | `09-playbooks.md` |
| Verify-to-promote | The evidentiary gate for findings; satisfied by qualification. | `10-discovery-runs-and-qualification.md` |
| Run record | Immutable artifact of one execution in `system/workspace/runs/<id>/`. | `10-…` |
| Raw / Qualified finding | A finding observed in a run / confirmed by a deterministic repeatable test in `system/workspace/findings/<id>/`. | `10-…` |
| Capability / Requirement / Finding | Descriptive (what the product can do) / normative (what the adopter needs) / empirical (what was observed). | `08-data-and-extraction.md` |
| Capability gap / Bug | A requirement with no capability / a capability that misbehaves. | adopter deliverables |
| Layered canonicity | Structured fields canonical in `.os/data/*.jsonl`; narrative canonical in the project's target `docs/` tree; overlaps generated. | `08-…` |
| Canonical entity | The terminal active entity that current workflows use after following zero or more reviewed redirects. | PRD 17 |
| Entity redirect | A directed successor link carried by a superseded entity; it is distinct from a non-canonical `related` edge. | PRD 17 |
| Resolution chain | The ordered entity IDs from the requested historical identity to its terminal canonical entity. | PRD 17 |
| Entity-resolution index | The rebuildable forward and reverse projection of canonical entity redirects under `system/.os/indexes/`. | PRD 17 |
| Compatibility / Strict validation | Temporary read-oriented legacy assessment / the release and post-migration enforcement gate for redirect graphs. | PRD 17 |
| Systems | The config-backed scoped field that lists configured systems, platforms, products, or applications in scope. Its values are `systems[].id` values in `instance.yaml`. | `13-adopter-owned-config-surface.md` |
| Environments | The config-backed scoped field that lists configured deployments, sandboxes, tenants, configurations, or execution contexts. Its values are `environments[].id` values in `instance.yaml`. | `13-adopter-owned-config-surface.md` |
| Owners | The config-backed scoped field that lists configured teams, organizations, vendors, internal groups, or other accountable parties. Its values are `owners[].id` values in `instance.yaml`. | `13-adopter-owned-config-surface.md` |
| make-docs boundary | The externally managed Make Docs trees (`docs/` and `.make-docs/`) that must not be modified directly. | `05-spaces-boundary-and-shipping.md` |
| Adoption | What `buildos init` does in a project that already has `.os/`. It writes only `.os/manifest.json`, the wrapper scripts, and `.os/skills/`, and never changes user data, runs, findings, indexes, or config. | `05-spaces-boundary-and-shipping.md`, `20-buildos-cli-and-distribution.md` |
| Companion setup | The optional Make Docs setup that `buildos init` offers. The user chooses Yes or No before anything is written. For Yes, Make Docs setup runs before BuildOS writes its files, and BuildOS runs it only through the public Make Docs CLI. | `05-spaces-boundary-and-shipping.md`, `20-buildos-cli-and-distribution.md` |
| Golden output | The written files, stdout, stderr, JSON output, and exit codes captured from the Go tools for a fixed fixture set. Each ported command must match it. | `20-buildos-cli-and-distribution.md` |
| Skills router | `.os/skills/AGENTS.md`, the file that tells an agent how to install a packaged skill into its own app's skill location when a user or workflow needs it. | `06-operating-layer-and-routing.md` |
| Wrapper resolution | The order in which a `.os/scripts/` wrapper finds the CLI, always at the version pinned in `.os/manifest.json` (pin first): an npm install of exactly that version (in the project's `node_modules` folder, or the first `buildos` on `PATH`), then pinned `npx`, then one plain message that names what to install. | `06-operating-layer-and-routing.md` |
| Bundled package | The published `@brucewaynedecoy/buildos` package. All runtime code, including outside packages, is bundled into its files, so it has no runtime dependencies. | `20-buildos-cli-and-distribution.md` |

### Change Notes

- Extended by [20 BuildOS CLI and Distribution](./20-buildos-cli-and-distribution.md) and the [BuildOS Node and TypeScript CLI Rewrite design](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md): adoption, companion setup, golden output, skills router, wrapper resolution, and bundled package define the CLI and distribution vocabulary. Target docs and the make-docs boundary now name the project `docs/` and `.make-docs/` trees, because BuildOS ships no Make Docs content.

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `system/.os/contracts/playbook-contract.md`
