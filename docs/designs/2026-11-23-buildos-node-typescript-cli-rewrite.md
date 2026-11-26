---
title: "BuildOS Node and TypeScript CLI Rewrite"
kind: "design"
status: "draft"
follow_on:
  route: "change-plan"
  next_prompt: "make-docs://system/prompt/designs-to-plan-change.prompt.md"
  why: "The decision revises the active runtime, toolkit deployment, unified CLI, and headless-program authority, adds project initialization, skills, and release requirements, and needs a scoped migration backlog."
  coordinate_handoff: "W1 R5 (unified BuildOS CLI and distribution) and the Phase 0.5 runtime proof selected Go; W1 R7 is the next unused revision of W1 and supersedes their Go-specific and distribution decisions without rewriting their history."
---

# BuildOS Node and TypeScript CLI Rewrite

> Filename: `2026-11-23-buildos-node-typescript-cli-rewrite.md`. See `.make-docs/system/contracts/design-contract.md` for naming and structural rules.

## Purpose

This design records the decision to rewrite the BuildOS toolkits from Go to Node.js with TypeScript, and to ship them as one `buildos` CLI in one npm package. It also records the decisions that follow from that change: how users install and run the CLI, how a project is set up, how BuildOS sets up Make Docs, how skills ship, how outside packages are trusted, and how we prove that the new CLI matches the old tools.

This design is the authority for W1 R7 planning. It does not itself authorize implementation, publication, or deletion of the Go code.

## Context

### Current state

The repository has four Go modules under `toolkits/`, about 11,500 lines in total:

| Module | Binary | Behavior |
| --- | --- | --- |
| `toolkits/buildos/` | `buildos` | Unified seed: help, version, and `entities` operations (resolve, validate, index, consolidate). |
| `toolkits/buildos-intake/` | `buildos-intake` | `convert` (CSV, DOCX, XLSX, PDF, HTML, HTML directory) and `index references` / `index playbooks`. Uses `github.com/ledongthuc/pdf` and `golang.org/x/net`. |
| `toolkits/buildos-discovery/` | `buildos-discovery` | Discovery runs, raw-finding anchoring, and finding qualification. |
| `toolkits/buildos-design/` | `buildos-design` | Promotion of a qualified finding into a design file under `docs/designs/`. |

The wrapper scripts in `system/.os/scripts/` look for a binary in an environment variable, then on `PATH`, then in `toolkits/<name>/bin/`. They are POSIX `sh` scripts. `system/.os/scripts/validate_config.py` is the only Python in the system package. It checks the adopter config (systems, environments, owners, defaults) and entity record hygiene, and the user guide tells users to run it.

`system/docs/` and `system/.make-docs/` hold a copy of Make Docs 0.1.0 output (68 files). Make Docs is now at 2.0.9 and sets itself up with `make-docs setup`.

### Prior authority

- The [unified CLI design](./2026-07-21-unified-buildos-cli-and-distribution.md) chose one `buildos` executable, one Go module, legacy aliases for one minor release, and signed archives plus Homebrew for `0.1.0`. Its W1 R5 backlog is not started.
- The [runtime-selection proof](./2026-08-14-build-os-runtime-selection-proof.md) compared Go, Node.js with TypeScript, and Rust, and kept Go. Node passed every correctness check. It lost on startup time (about 137 ms against 50 ms at p50), memory, and its need for a Node runtime.
- The [product boundary design](./2026-08-13-build-os-product-boundary-and-headless-operating-model.md) chose one program with a headless core, a CLI, and an MCP server, and made Make Docs an external companion that BuildOS calls only through public commands.

### What changed

1. **Who uses BuildOS.** Most adopters are non-technical product owners and project managers. They use BuildOS through chat apps with folder access, such as Claude Cowork, GitHub Copilot Desktop, and ChatGPT desktop in Work mode. The agent in the chat app runs the commands. These users cannot build Go code or manage binaries on `PATH`.
2. **One stack with Make Docs.** Make Docs is a TypeScript npm package with a CLI and an MCP server. It needs Node.js 24 or newer. A BuildOS user who uses Make Docs already has Node 24. One language and one release flow across both products lowers maintenance cost and lets BuildOS use the official TypeScript MCP SDK when MCP work starts.
3. **npm as the delivery path.** An agent can run `npx -y @brucewaynedecoy/buildos@<version>` with no install step. That is the simplest path for chat-app users. A native binary needs a download, a `PATH` change, and an OS-specific archive.

The runtime proof measured a real cost: Node starts slower and uses more memory. For a CLI that an agent calls a few times per task, about 100 ms more per call does not change the human experience. The proof did not weigh user reach or stack alignment, which now decide the question.

### Make Docs facts that shape this design

These facts come from Make Docs 2.0.9 and its repository:

- `make-docs setup --yes` approves only a fully specified plan. It never fills in a missing choice. A tool must pass every choice.
- The document areas (designs, plans, PRD, work) are always installed. They are not a setup choice.
- By default, templates, contracts, and prompts are not copied into the project. Agents read them with `make-docs resource read make-docs://...`. The `--project-resources all` flag copies them in.
- Make Docs publishes no contract for companion tools and rules out a plugin API. The commands a companion can rely on in practice are `make-docs --version`, `make-docs project state status --json`, and `make-docs setup --json`.
- No Make Docs command writes a design doc for another tool.
- Make Docs releases from a GitHub Release with npm trusted publishing, a committed tarball digest, `npm stage publish --provenance`, and a maintainer 2FA approval. It produces no SBOM.

### Skills

The repository has three skills in `skills/`: `capability-matrix`, `fit-gap-analysis`, and `buildos-export-azure-boards`. An adopter project has 21 skills in `.agents/skills/`, 18 of which are BuildOS workflow skills (intake, extract, bulk extract, row drafting, discovery, qualification, design planning, docs handoff, reporting, validation, and others). Those skills are not in this repository. Two skills carry Python scripts: `buildos-bulk-extract/scripts/work.py` (about 1,470 lines) and `fit-gap-analysis/scripts/fitgap.py` (about 1,260 lines). `buildos-export-azure-boards` carries a Node script. `fit-gap-analysis` names real client organizations, and some Azure Boards examples use a client-like business topic.

## Human Experience Intent

Impact: `direct`

Affected humans: Non-technical BuildOS adopters (product owners and project managers) who work through a chat app with folder access; technical adopters who run BuildOS from a terminal; enterprise security and engineering reviewers who approve BuildOS for use; BuildOS maintainers who build, test, and release it.

Human goal or effect: An adopter can say "set up BuildOS here" or "convert these files" in a chat app and have it work, with no manual install, no build step, and no Python. An enterprise reviewer can see exactly what code ships and why it is safe. Existing adopters keep their data and get the same results as before.

Experience promises:

- An adopter with Node 24 or newer can initialize a new project with one agent-run command, `buildos init`, and needs no other install step.
- When BuildOS cannot run because Node is missing or too old, the adopter sees one plain message that names what to install. They do not see a stack trace.
- Before `buildos init` sets up Make Docs, the user decides Yes or No. When an agent runs `init` with no terminal, the command stops before it writes anything and gives the agent a short, plain explanation of both choices to put to the user.
- When Make Docs setup fails, BuildOS setup still completes. The output says that Make Docs is not set up and shows the exact command to retry.
- An existing project that used the Go tools can move to the new CLI with `buildos init`. Its data files, runs, findings, and config do not change.
- Commands, files, output, and exit codes stay the same as the Go tools for the same input. PDF text matches after whitespace normalization.
- The old command names still work for one minor release and say which new command to use.
- An enterprise reviewer can find, in one document, every outside package, its version, license, reason, and the checks it passed, plus the SBOM and provenance for each release.
- Converted documents keep every section and stay highly accurate, measured against reviewed reference text.

Complexity kept out of the human path:

- The adopter does not need to know about npm, `npx`, `PATH`, Node versions, bundling, or which wrapper runs.
- The adopter does not need to know where each chat app keeps skills. The agent installs a skill when it is needed.
- The adopter does not need to know the Make Docs setup flags.
- Golden-test machinery, converter selection, and release staging stay maintainer-only.

Evidence required:

- Run `buildos init` on a clean machine profile with Node 24 through `npx`, in an interactive terminal and with no TTY, on macOS, Linux, and Windows. Inspect the real output for the Yes, No, no-TTY, Make Docs failure, and missing-Node cases.
- Run `buildos init` against a copy of an existing Go-era project and compare every pre-existing user data file byte for byte before and after.
- Run the golden parity suite for every ported command and alias.
- Run the conversion eval set and record per-file section coverage and text similarity.
- Review the published dependency and security document against the bundled package contents, the SBOM, and the scan results.
- Prepare a Human Experience Review of the `init` and conversion output from a non-technical adopter's point of view, with one short experience handoff for the user.

## Performance Evidence Candidates

| Candidate | Base maintenance action | Performance applicability | Protected outcome | Decision informed | Canonical owner or next record |
| --- | --- | --- | --- | --- | --- |
| CLI startup and per-command latency under Node 24, compared with the Go baseline from the runtime proof | `create` | `characterize-now` | An agent-run command still feels immediate to a chat-app user | Whether any command needs a lazy-load or bundling change before `0.1.0` | W1 R7 plan, P1 and P9 work phases |
| First-run `npx` fetch time for the published package | `create` | `characterize-now` | The first command in a new chat session completes without the user thinking it failed | Whether the package size needs reduction | W1 R7 plan, P9 work phase |
| Conversion time for the largest eval-set files | `none` | `not-needed` | None beyond the Go baseline | No current decision depends on it; accuracy is the gate | None |

## Decision

### 1. Rewrite in Node.js with strict TypeScript

BuildOS is rewritten in TypeScript with `strict` on, compiled with `tsc`, and shipped as ESM. The package requires Node.js 24 or newer (`"engines": { "node": ">=24.0.0" }`), the same as Make Docs. This supersedes the language choice in the runtime proof and the Go-specific parts of the unified CLI design.

### 2. Port first, with a core and CLI split

The scope of W1 R7 is a behavior port of the four Go toolkits into one `buildos` CLI. Inside the package, domain logic lives in a transport-neutral core. The CLI is a thin adapter that parses arguments, calls the core, and formats results. The core returns typed results and errors; it never writes to stdout or calls `process.exit`. This keeps the PRD 19 core and adapter boundary ready for a later MCP adapter. The MCP server and the full PRD 19 capability map are out of scope for W1 R7.

The CLI keeps the W1 R5 shared contracts: one root-resolution model, `--root`, `--json`, help, version with source revision, one JSON result envelope, and central exit codes (success, usage error, contract or validation failure, needs operator review, internal failure). Arguments are parsed by a small built-in parser that follows Go's `flag` package rules, so existing commands and flag spellings keep working. No CLI framework or outside parsing package is used. On 2026-11-23 the owner chose this parser over `node:util` `parseArgs`, because `parseArgs` splits Go `flag`-style spellings such as `-json` into short flags, and Go output parity requires them.

### 3. One package at a stable path

The npm package lives at `toolkits/buildos/`, beside the Go seed during migration. Go files and TypeScript files share the folder until each Go part passes its parity gate. Then `cmd/`, `internal/`, `pkg/`, `go.mod`, and the three legacy modules are deleted. Git history keeps the Go code.

Tooling is npm, `tsc`, Node's built-in test runner (`node:test`), and esbuild for the published bundle. On 2026-11-23 the owner chose `node:test` over Vitest, because Vitest's dependency tree includes MPL-2.0 packages that the PRD 20 Supply Chain license list does not allow, and because PRD 20 prefers Node built-ins.

### 4. Distribution

- Package name: `@brucewaynedecoy/buildos`, published from the maintainer's personal npm account.
- License: Apache-2.0. A `LICENSE` file is added at the repository root and in the package.
- Supported platforms: macOS, Linux, and Windows, each on x64 and arm64 where Node 24 supports them. CI runs on all three.
- Homebrew formulas and per-OS signed archives from the W1 R5 design are dropped.
- `0.1.0` ships when the port, `init`, skills, `validate`, and release hardening are done. The ported skill scripts ship in `0.2.0`.

### 5. How agents and users run the CLI

The project wrapper scripts in `.os/scripts/` resolve the CLI in this order:

1. `buildos` on `PATH`.
2. `npx -y @brucewaynedecoy/buildos@<pinned version>`, where the pinned version comes from `.os/manifest.json`.
3. If Node is missing or older than 24, print one plain message that names what to install and stop with a non-zero exit code.

Wrappers ship as POSIX `sh` scripts and as Windows `.cmd` scripts.

The owner decision of 2026-11-25 (register `Q-015`) changed this order to pin first: a wrapper always runs the pinned version, and uses an installed `buildos` only when it is an npm install of exactly that version. [PRD 06](../prd/06-operating-layer-and-routing.md#contracts-and-data) states the current order.

### 6. Legacy command names

The package `bin` map lists `buildos`, `buildos-intake`, `buildos-discovery`, and `buildos-design`, all pointing to the same entry file. The program checks the name it was started with, maps legacy arguments to the matching `buildos <domain>` command, keeps the legacy output and exit behavior, and writes one deprecation line to stderr that names the new command. The legacy names are removed in `0.3.0`, and the removal is announced in release notes and the user guide first.

### 7. Project initialization and adoption

The package carries the `system/` package content. `buildos init` places it at the project root and writes `.os/manifest.json` with at least the BuildOS package version, the schema version, and the time of initialization. W2 extends this same file for update and sync; W1 R7 does not add update, sync, or uninstall.

When `buildos init` finds an existing `.os/` directory, it adopts the project. Adoption writes only `.os/manifest.json`, the wrapper scripts, and `.os/skills/`. It never changes user data, runs, findings, indexes, or config. It shows the planned writes before it writes them, and `--dry-run` shows the plan only.

`system/docs/` and `system/.make-docs/` are deleted from the source package. BuildOS no longer ships Make Docs content.

### 8. Make Docs setup during `init`

After BuildOS setup, `buildos init` offers to set up Make Docs:

- In an interactive terminal, it asks `Set up Make Docs in this project? [Y/n]`. Yes is the default.
- `--make-docs` and `--skip-make-docs` answer the question without a prompt.
- With no TTY and no flag, `init` stops before it writes anything. It exits with the "needs operator review" exit code. Its human output and its JSON output both explain the two choices in plain words (what Make Docs adds, and that the user can set it up later) and give the two exact commands to run. The skills router tells agents to put this choice to the user.

When the answer is Yes, BuildOS runs Make Docs through its public CLI only. It uses `make-docs` on `PATH`, or else `npx -y @brucewaynedecoy/make-docs@<pinned range>`. It passes every setup choice explicitly:

```sh
make-docs setup --target <project> --codex-method none --claude-code-method none --no-github-copilot --no-skills --project-resources all --yes --json
```

`--project-resources all` copies templates and contracts into the project, so agents in chat apps can read them without reaching the Make Docs CLI. If Make Docs setup fails, BuildOS setup still counts as complete. The output says that Make Docs is not set up and shows the exact retry command. BuildOS never writes Make Docs-owned files or global state itself.

### 9. Make Docs dependency contract

BuildOS pins a tested Make Docs version range. It relies only on `make-docs --version`, `make-docs project state status --json`, and `make-docs setup --json`. A CI contract test runs these commands against the pinned range and fails when their shape changes. This narrows open question Q-010 and risk R-001 but does not close them.

### 10. Design promotion stays as it is, with a tracked risk

`buildos design promote` (the port of `buildos-design`) keeps its current behavior so that parity holds. It still writes a design file under `docs/designs/`, which Make Docs owns. This conflicts with the product boundary, so the PRD risk register gains an owned item with the named next step: ask Make Docs for a public `designs create` operation, then move promotion onto it. Every later planning gate reviews this item.

### 11. Parity and conversion quality

Before any port starts, the maintainer captures golden outputs from all four Go tools for a fixed fixture set: written files, stdout, stderr, JSON output, and exit codes, including the legacy names. Each ported command must match its golden output byte for byte, except PDF text, which must match after whitespace and line-break normalization.

Conversion accuracy has its own gate:

1. A conversion eval set holds realistic files for every format. For PDF it covers plain text, columns, tables, headers, and footers.
2. A person reviews the correct text for each file once. That text becomes the reference answer.
3. For each format that needs an outside package, two candidate packages are compared on the eval set before one is chosen.
4. A release is blocked if any eval file loses a section or if its text similarity to the reference falls below 98%.

Scanned PDFs that need OCR stay out of scope, as today.

### 12. Outside packages and supply-chain safety

Node built-in modules come first. An outside package is allowed only when Node cannot do the job, and only when it meets every rule below:

- It is widely used and actively maintained.
- Its license is MIT, Apache-2.0, BSD, or ISC.
- It has few or no dependencies of its own.
- It is pinned to an exact version and recorded in the lockfile.
- It has no install scripts. CI installs with `--ignore-scripts`.
- `npm audit` and an OSV scan pass with no high or critical findings.

All runtime code, including outside packages, is bundled with esbuild into the published files. The published package has no runtime `dependencies`, so `npm install` and `npx` fetch only `@brucewaynedecoy/buildos` and never resolve new third-party versions on a user's machine. A third-party license notice file ships with the package.

A maintainer-facing and reviewer-facing security document lists every outside package with its version, license, reason, transitive packages, and scan status, and explains the bundling, provenance, SBOM, and release checks. It is written for enterprise engineering reviewers.

Expected candidates, still subject to the comparison in section 11, are `unpdf` or an equivalent for PDF text, `fflate` for DOCX and XLSX archives, and `parse5` for HTML.

### 13. Release flow

BuildOS uses the Make Docs release flow: a GitHub Release starts a GitHub Actions workflow, npm trusted publishing removes stored tokens, a reviewed tarball SHA-256 is committed before release, the workflow checks the tag, version, and digest, `npm stage publish --provenance` stages the package, and the maintainer approves the stage with 2FA. BuildOS adds a CycloneDX SBOM attached to each release, the dependency scans from section 12, and a release check that fails when the package contains any name on a maintained client-name deny list. Each publication still needs explicit maintainer approval.

### 14. Skills ship with the package

`system/.os/skills/` becomes the one source of truth for BuildOS skills. It holds the 21 adopter-project skills and the three skills now in `skills/`. Where a skill exists in both places, the newer copy wins after a review of the differences. `buildos init` copies the skills to `.os/skills/` in the project.

A router file, `.os/skills/AGENTS.md`, tells an agent how to install a skill into its own app's skill location (for example Claude, Codex, or Copilot) when the user or a BuildOS workflow needs it. `buildos init` never writes into app folders such as `.claude/` or `.agents/`.

Before the skills ship, client content is removed:

- Owner names and colors in `fit-gap-analysis` come from config, not code.
- Client-like example topics are replaced with a neutral invented topic.
- `.DS_Store` and `__pycache__` files are removed.
- The deny-list release check from section 13 guards against new leaks.

### 15. No Python for users

`validate_config.py` is ported to `buildos validate` and the Python file is deleted. In `0.2.0`, the skill scripts become CLI commands: `buildos extract bulk` (from `work.py`), `buildos fitgap` (from `fitgap.py`, writing `.xlsx` with `fflate`), and `buildos export azure-boards` (from `azure_boards_csv.mjs`). The skills then call the CLI. After `0.2.0`, an adopter needs Node and nothing else.

### 16. Work order

The W1 R7 work backlog uses this order, after this design, the plan, and the PRD change are accepted:

1. TypeScript package setup: build, tests, CI on three OSes, package rules, core and CLI split, shared envelope, root handling, and exit codes, plus `LICENSE`.
2. Golden capture from all four Go tools.
3. Port `entities`.
4. Port `intake`, with the converter comparison and the eval set.
5. Port `discovery` and `design`.
6. Legacy aliases, wrapper scripts, `buildos init` and adoption, Make Docs setup, and `.os/manifest.json`.
7. Skills import, cleanup, router, and `buildos validate`.
8. Release pipeline, SBOM, scans, security document, user guide updates, and Go removal. Then `0.1.0`.
9. Skill-script ports. Then `0.2.0`.

## Alternatives Considered

**Keep Go, as the runtime proof chose.** Rejected. Go gives the smallest and fastest binary, but non-technical chat-app users cannot easily install native binaries, and Go keeps BuildOS on a different stack from Make Docs. The measured startup cost of Node does not matter at the rate an agent calls the CLI.

**Rust.** Rejected for the same delivery reasons as Go, plus a full rewrite with a new dependency graph.

**Build the full PRD 19 program (core, CLI, and MCP) now.** Rejected for W1 R7. It would mix a language port with a large capability expansion and make parity hard to prove. The core and CLI split keeps MCP ready for a later revision.

**Ship a standalone executable with Node embedded (Node SEA or Bun compile).** Deferred. It removes the Node prerequisite but adds per-OS artifacts, signing, and larger downloads. npm with Node 24 serves the current users, and Make Docs already requires Node 24.

**Support Node 22.** Rejected. Make Docs requires Node 24, so a lower floor reaches no extra BuildOS user.

**Keep the Go code frozen in the repository.** Rejected. Git history keeps it, and two live implementations invite drift.

**Install skills straight into each chat app's folder during `init`.** Rejected. Each app uses a different location, and writing app folders without need adds risk. The router lets the agent install only what is needed, where its app expects it.

**Let `init` choose Yes for Make Docs when no TTY is present.** Rejected. The user wants to make this choice, and an agent can ask for them.

**Unbundled runtime dependencies.** Rejected. A user's `npm install` would resolve third-party versions at install time, which enterprise reviewers cannot pin or audit as easily.

**Move design promotion onto Make Docs now.** Rejected for W1 R7. No Make Docs command exists for it. The tracked risk keeps the boundary conflict visible.

## Consequences

- Adopters need Node 24 or newer. Users without it see a clear install message. A standalone executable remains a later option if this blocks real users.
- Per-command startup is slower than Go by about 100 ms. The P1 and P9 characterization confirms that this stays acceptable.
- Byte-for-byte parity for most outputs is a strict bar. Any intended behavior change must wait until after the port, or be recorded as an explicit parity exception with a reason.
- PDF output changes in small ways. The eval gate guards accuracy and section coverage, not byte equality.
- Bundling moves dependency security work to release time: maintainers must rebuild and republish to pick up a fixed upstream package.
- The package becomes public. Client content in skills must be removed before the first publish, and the deny-list check must stay current.
- `system/docs/` and `system/.make-docs/` leave the source package. Adopters who decline Make Docs get no document scaffold from BuildOS.
- Removing the Python validator changes a command users run today. The user guide must move to `buildos validate` in the same release.
- W1 R5 work items close as superseded, and its packaging requirements (archives, Homebrew, signing keys) are withdrawn. R-003 narrows to npm packaging, provenance, SBOM, and rollback by version pin.
- The product boundary conflict in design promotion remains until Make Docs offers a public operation.
- PRD 14, 18, and 19 need a revision record (PRD 20). The index, change notes, and risk register need reconciliation, including Q-010, R-001, R-003, R-004, and the new design-promotion item.

## Design Lineage

- Update Mode: `new-doc-related`
- Prior Design Docs: [Unified BuildOS CLI and Distribution](./2026-07-21-unified-buildos-cli-and-distribution.md), [Build OS Phase 0.5 Runtime-Selection Proof](./2026-08-14-build-os-runtime-selection-proof.md), [Build OS Product Boundary and Headless Operating Model](./2026-08-13-build-os-product-boundary-and-headless-operating-model.md), [Build OS Toolkit CLI Deployment Standard](./2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- Reason: This design keeps the one-command, shared-contract, alias, parity, core-and-adapter, and Make Docs boundary decisions from those designs. It supersedes their Go language choice, the one-Go-module source layout, the archive and Homebrew distribution plan, and the runtime proof's retain-Go decision, because the adopter base, Make Docs alignment, and npm delivery now outweigh the measured native-runtime advantages.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](make-docs://system/prompt/designs-to-plan-change.prompt.md). Read `make-docs://system/prompt/designs-to-plan-change.prompt.md` with `make-docs resource read`.
- Why: The decision revises the active runtime, deployment, unified CLI, and headless-program requirements in PRD 14, 18, and 19, adds initialization, skills, supply-chain, and release requirements, and needs a scoped migration backlog.
- Coordinate Handoff: W1 R5 (unified BuildOS CLI and distribution) selected Go and is not started; W1 R6 reconciled the Phase 1 capability map. W1 R7 is the next unused revision of W1 and supersedes the Go-specific and distribution parts of W1 R5 under the revision Wave test, because the outcome (one public `buildos` command for the same domains) stays the same while its implementation and delivery change.
