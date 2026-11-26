# 01 PRD Authority Maintenance

## Purpose

Give every candidate requirement from the [source design](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md) one maintenance decision, name the exact PRD sections to change, define the new product PRD, and list the requirement-history entries.

## Candidate Decision Matrix

| ID | Candidate | Decision | Owning PRD or new product subject | Reason | Evidence |
| --- | --- | --- | --- | --- | --- |
| C-01 | Runtime: Node.js 24 or newer, strict TypeScript compiled with `tsc`, ESM | `create` + `update-existing` | PRD 20 (runtime and package); PRD 02 `## Runtime Boundaries` | No product-named owner exists for the CLI and its runtime; PRD 02 states the runtime boundary | Design §1 |
| C-02 | One npm package `@brucewaynedecoy/buildos`, Apache-2.0, macOS/Linux/Windows on x64 and arm64 | `create` | PRD 20 | New product subject | Design §4 |
| C-03 | Core and CLI split; core returns typed results and never writes stdout or exits | `create` + `update-existing` | PRD 20; PRD 02 `## Module Map` | Retains the PRD 19 core/adapter rule without the unapproved capability map | Design §2 |
| C-04 | Shared command contract: root resolution, `--root`, `--json`, help, version with source revision, JSON envelope, central exit codes, built-in Go `flag`-rules argument parser | `create` | PRD 20 | Current authority sits only in editorial PRD 18 `### Canonical command and output contract`; PRD 20 becomes its owner | Design §2; PRD 18 |
| C-05 | Domain ownership as packages inside one CLI | `update-existing` | [PRD 02 `## Module Map`](../../prd/02-architecture-overview.md#module-map) (language-neutral wording); historical input: [archived PRD 16](../../../.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md) `## Effective Requirement` | PRD 02 `## Module Map` owns domain boundaries; PRD 16 owned them when this plan was written; only the "Go program" wording is stale | Design §2 |
| C-06 | Source location `toolkits/buildos/`; Go code removed after parity | `update-existing` | PRD 02 `## Module Map` | Architecture owner of toolkit source | Design §3 |
| C-07 | Legacy names through npm `bin` aliases with stderr deprecation; removal in `0.3.0` | `create` | PRD 20 | Command-surface subject | Design §6 |
| C-08 | Wrapper resolution: `PATH`, then pinned `npx`, then plain Node message; `sh` and `.cmd` wrappers | `update-existing` | PRD 06 `## Component and Capability Map` (script wrappers) and `## Contracts and Data` | PRD 06 owns script wrappers | Design §5 |
| C-09 | `buildos init`, `.os/manifest.json`, adoption that never changes user data, `--dry-run` | `create` + `update-existing` | PRD 20 (initialization and adoption); PRD 05 `## Installed Project Paths` and `## Scope` | Shipping model in 05 changes; the command contract is new | Design §7 |
| C-10 | `system/docs/` and `system/.make-docs/` removed from the source package | `update-existing` | PRD 05 `## Scope`, `## Component and Capability Map`, `## Integrations` | PRD 05 owns what ships | Design §7 |
| C-11 | Make Docs companion setup in `init`: Y/n prompt, flags, no-TTY stop with plain choices, explicit setup flags, `--project-resources all`, failure is non-fatal | `create` + `update-existing` | PRD 20; PRD 05 `## Integrations`; PRD 11 `## Integrations` | Companion flow is new; the boundary text lives in 05 and 11 | Design §8 |
| C-12 | Make Docs dependency contract: pinned range, three commands, CI contract test | `create` | PRD 20 | New integration requirement | Design §9 |
| C-13 | Design promotion keeps current behavior, conflicts with the product boundary | `update-existing` | PRD 11 `## Contracts and Data` (current limitation) | PRD 11 owns promotion; the conflict is stated as a current limitation and tracked in the register | Design §10 |
| C-14 | Output parity with the Go tools for the same input; PDF compared after whitespace normalization | `create` | PRD 20 (compatibility) | Product promise to existing adopters | Design §11 |
| C-15 | Conversion accuracy gate: reviewed reference text, two-candidate comparison, no lost section, 98% similarity; OCR out of scope | `update-existing` | PRD 07 `## Contracts and Data` and `## Rebuild Notes` | PRD 07 owns conversion fidelity | Design §11 |
| C-16 | Golden-capture machinery | `none` | None | Implementation evidence method; lives in the work backlog | Design §11 |
| C-17 | Outside-package rules, bundling, no runtime dependencies, license notice, security document | `create` | PRD 20 (supply chain) | New product subject | Design §12 |
| C-18 | Release flow, SBOM, scans, client-name deny list, maintainer approval | `create` | PRD 20 (release) | New product subject | Design §13 |
| C-19 | Skills ship in `system/.os/skills/`, copied to `.os/skills/`; router at `.os/skills/AGENTS.md`; `init` never writes app folders | `create` + `update-existing` | PRD 20 (package contents); PRD 06 (router and skills install behavior) | Packaging is PRD 20; agent routing is PRD 06 | Design §14 |
| C-20 | Client content removed from skills | `none` | None for PRD body beyond C-18's deny-list rule | Implementation cleanup | Design §14 |
| C-21 | `buildos validate` replaces `validate_config.py` | `update-existing` | PRD 13 `## Contracts and Data`; PRD 06 `## Component and Capability Map` | PRD 13 owns config validation | Design §15 |
| C-22 | Skill scripts become `buildos extract bulk`, `buildos fitgap`, `buildos export azure-boards` in `0.2.0` | `create` | PRD 20 (command surface, with version scope) | New commands | Design §15 |
| C-23 | Users are mostly non-technical adopters working through chat apps; Node 24 is a prerequisite | `update-existing` | PRD 01 `## Users`, `## Current Limitations` | PRD 01 owns users and limits | Design Context |
| C-24 | No MCP server in the current product; core/adapter seam reserves it | `update-existing` | PRD 01 `## Current Limitations`; PRD 02 `## Runtime Boundaries` | Current scope statement | Owner decision on W1 R6 |
| C-25 | Glossary terms: adoption, companion setup, golden output, skills router, wrapper resolution, bundled package | `update-existing` | PRD 04 `## Terms` | PRD 04 owns terms | Design |
| C-26 | Entities command contract names Go build and test steps | `update-existing` | PRD 17 sections that name Go commands | Only build and test wording changes; the entity contract stays | Discovery scan |
| C-27 | Stale Go, Homebrew, or Python mentions in 08, 10, 12, 15 | `update-existing` where normative; `none` where historical | Each owner | Decide per hit in the discovery pass | Discovery scan |
| C-28 | PRDs 14, 18, 19 no longer hold current authority for runtime, deployment, command contract, or distribution | `link-only` | Index status `superseded`; banner at top of each | They stay as legacy evidence until the cleanup; readers must see PRD 20 first | Owner decision |
| C-29 | Topic-to-current-owner map for readers and agents | `link-only` | PRD 00 new `## Current Authority Map` | Navigation only; protects authority while legacy PRDs remain | Owner caveat on cleanup |
| C-30 | Performance characterization of startup and `npx` fetch | `none` | None | Engineering characterization owned by work, not a product target | Plan performance table |
| C-31 | Legacy editorial PRD naming and structure (13–19) | `none` in this plan | Register `D-005`; handoff in [05](./05-legacy-prd-cleanup-handoff.md) | Out of R7 scope by owner decision; must be prioritized next | Validator baseline |

## Genuinely New Product PRDs

| New PRD | Product-oriented kind | Coherent subject | Why no existing owner is suitable |
| --- | --- | --- | --- |
| `docs/prd/20-buildos-cli-and-distribution.md` | `subsystem` | The `buildos` command: runtime, package, command surface and output contract, legacy names, project initialization and adoption, Make Docs companion setup, compatibility, supply chain, release, and packaged skills | The only current statements of this subject are in editorial PRDs 14, 18, and 19, which cannot be valid product owners. No baseline PRD owns the CLI as a product surface. |

Planned PRD 20 outline (subsystem template from `make-docs://system/template/prd-subsystem.md`):

1. `## Purpose`
2. `## Scope` — in scope, out of scope (MCP server, standalone executables, `update`/`uninstall`/sync, OCR)
3. `## Runtime and Package` — Node 24+, TypeScript, ESM, package name, license, platforms, no runtime dependencies
4. `## Command Surface` — domains (`entities`, `intake`, `discovery`, `design`, `init`, `validate`, `version`, `help`), the `0.2.0` commands, and the core/CLI rule
5. `## Output and Exit Contract` — retained from PRD 18: envelope fields, exit codes, root resolution, help and version
6. `## Legacy Command Names` — aliases, deprecation text, removal in `0.3.0`
7. `## Project Initialization and Adoption` — `init`, manifest, adoption limits, `--dry-run`
8. `## Make Docs Companion Setup` — prompt, flags, no-TTY behavior, setup flags, failure handling, dependency contract
9. `## Compatibility` — output parity with the Go tools; PDF normalization rule
10. `## Supply Chain` — package rules, bundling, license notice, security document
11. `## Release` — flow, provenance, SBOM, scans, deny list, maintainer approval
12. `## Packaged Skills` — source home, copy target, router, no app-folder writes
13. `## Human Experience Outcomes` — the observable promises PRD 20 owns, linked to the Human Experience Contract, not copied
14. `## Requirement History` — empty at creation
15. `## Source Anchors`

PRD 20 must not use the words revise, revision, add, addition, enhance, enhancement, remove, removal, deprecate, deprecation, reconcile, or reconciliation in its filename or H1, and must not use `Change Type`, `Baseline Being Revised or Removed`, `Affected Baseline Docs`, or `Required Baseline Annotations` headings.

## Existing PRDs To Update

| Existing PRD | Owning sections | Current normative update | Preserved surrounding authority |
| --- | --- | --- | --- |
| `01-product-overview.md` | `## Users`, `## Current Limitations`, `## Key Capabilities` | Non-technical chat-app adopters as the main users; Node 24 prerequisite; no MCP server yet; one `buildos` CLI from npm | Product purpose, boundaries |
| `02-architecture-overview.md` | `## Topology`, `## Module Map`, `## Runtime Boundaries` | One TypeScript package at `toolkits/buildos/`; core and CLI adapter; Node runtime; MCP reserved | Data flow, configuration surfaces |
| `04-glossary.md` | `## Terms` | Terms from C-25 | Existing terms |
| `05-spaces-boundary-and-shipping.md` | `## Installed Project Paths`, `## Scope`, `## Component and Capability Map`, `## Integrations` | npm delivery; `buildos init` places the system package; no shipped Make Docs content; Make Docs set up only through its public CLI | Three-spaces model |
| `06-operating-layer-and-routing.md` | `## Component and Capability Map`, `## Contracts and Data`, `## Integrations` | Wrapper resolution order and Windows wrappers; `.os/manifest.json`; `.os/skills/` and its router; `buildos validate` | `.os/` brain and routing model |
| `07-intake-and-conversion.md` | `## Contracts and Data`, `## Rebuild Notes` | Conversion accuracy gate and PDF normalization; converters implemented in the TypeScript package with vetted bundled packages | Converter list, provenance fields, twin layout |
| `11-flow-c-integration.md` | `## Integrations`, `## Contracts and Data` | Make Docs companion setup boundary; design promotion as a stated current limitation linked to the register | Export and hand-off flow |
| `13-adopter-owned-config-surface.md` | `## Contracts and Data` | Validation runs through `buildos validate` | Config schema and semantics |
| `02-architecture-overview.md` (current owner; historical input: [archived PRD 16](../../../.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md)) | [`## Module Map`](../../prd/02-architecture-overview.md#module-map) | Domain ownership enforced inside the one TypeScript package | All ownership rules |
| `17-entity-identity-and-canonical-resolution.md` | Sections that name Go build or test steps | Build and test wording points to the TypeScript package | Entity contracts |
| `08`, `10`, `12`, `15` | Per discovery hit | Only current normative stale text | Everything else |

## Requirement History Entries

All entries use date `2026-11-23`, coordinate `W1 R7`, and source [the rewrite design](../../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md).

| Owning PRD | Affected requirement or section | Previous contract | Replacement contract | Rationale |
| --- | --- | --- | --- | --- |
| `02` | `## Runtime Boundaries`, `## Module Map` | Go toolkits; one Go module at `toolkits/buildos/` with a cohesive Go core, CLI, and MCP program planned | One TypeScript package at the same path on Node 24+; MCP deferred | Adopter reach, Make Docs stack alignment, npm delivery |
| `05` | `## Scope`, `## Integrations` | Source package shipped Make Docs scaffold content (`system/docs/`, `system/.make-docs/`) | No Make Docs content ships; `init` offers Make Docs setup through its public CLI | Product boundary; Make Docs owns its content |
| `06` | Script wrappers | Wrappers resolved a binary by env var, `PATH`, or `toolkits/*/bin/`; POSIX only | `PATH`, then pinned `npx`, then plain Node message; `sh` and `.cmd` | Chat-app agents and Windows users |
| `07` | Conversion contract | Go converters; output defined by Go implementation | Byte parity except PDF, plus a reviewed-reference accuracy gate | Node PDF extraction cannot match bytes; accuracy must still be proven |
| `13` | Validation | `system/.os/scripts/validate_config.py` | `buildos validate` | No Python for users |
| `16` | Domain ownership container | One cohesive Go program | One TypeScript package | Runtime change |
| `01` | Users and limitations | Users not described as chat-app adopters; no Node prerequisite | Chat-app adopters; Node 24 prerequisite; no MCP server yet | Current adopter base |
