# Build OS — Architecture

> Filename: `2026-06-03-build-os-architecture.md`.
> This is the self-contained, project-level design of record for the system built under
> `system/`. Implementation-level contracts live alongside the system in `system/.os/contracts/`.

## Purpose

This document captures the architecture of the system we are building — **Build OS**:
a general-purpose, filesystem-based, agent-operable "operating system" a team adopts to run
discovery, testing, requirements capture, design, and backlogging against *any* target system,
platform, or application.
Its first, driving application is the Hitachi Solutions × John Deere engagement around Microsoft's
first-party Rental solution on Dynamics 365 Finance & Operations, which motivates and validates the
design.
It exists so that planning, PRD generation, and backlog work can proceed from a single,
agreed decision record rather than from scattered notes.

## Context

The repository contains two fundamentally different things, and keeping them un-confused is the
central discipline of the design.
The **build layer** (`./docs/`, this tree) is how *we* design and track building the system.
The **system** (`./system/`) is the tool we ship.
The system has its own **target docs** (`./system/docs/`) where its users capture discovery and
design outputs *about their target system* — for the first engagement, Microsoft's Dynamics
Rental; these are the engagement deliverables.

Both documentation trees are powered by the **make-docs** plug-in and look structurally
identical, so routing must make the boundary impossible to miss.
The four make-docs trees (`./docs/`, `./system/docs/`, `./.make-docs/`, `./system/.make-docs/`)
are externally managed: we never modify them; we use them via their own routers, contracts, and
templates.
The top routers (`./AGENTS.md`, `./system/AGENTS.md`, and their `CLAUDE.md` siblings) are
co-owned — augmentable, because the make-docs CLI appends its routing and never overwrites.

Forces shaping the design:
the system must be operable by agents and humans alike;
deterministic where possible and smart only where necessary;
git-native and reviewable;
upgradeable without fighting the make-docs plug-in;
and navigable through progressive disclosure rather than monolithic instructions.

## Decision

### 1 · Three spaces

`./docs/` (build layer, for us) · `./system/` (the shipped tool) · `./system/docs/` (target docs,
about whatever target system is being assessed or built in `./system/`). The canonical structure 
is the `system/` tree itself; this design records the architecture that shapes it.

### 2 · Three pillars

**Convert** (intake): tool-first, deterministic format transform of unstructured sources into
clean text/CSV twins — no structuring.
**Playbooks**: typed Markdown instruments that guide a human or agent.
**Workspace**: deterministic, executable artifacts (e.g., Playwright tests) and run/finding records.

### 3 · Three flows, chained

**Flow A — Intake/Knowledge:** `convert → extract → candidates`.
Conversion is deterministic; **extraction** is user-driven ETL (human or agent) that loads into
one or more destinations: entity rows, playbooks, or docs.
**Flow B — Discovery/Execution:** `active playbook → run → raw finding → qualify → qualified finding`.
**Flow C — Planning/Engineering:** `qualified finding → design → plan → PRD → work backlog`,
powered by make-docs in `system/docs/`.
Flow A produces the instruments Flow B runs; Flow B produces the findings Flow C engineers.

### 4 · Two gates; candidate is a status, not a location

**Verify-to-promote** (evidentiary) gates **findings** (docs/data/specs).
**Review-to-activate** (editorial) gates **instruments** (playbooks, incl. guardrails):
`draft → reviewed → active`; only `active` playbooks run or are enforced.
Anything extracted or drafted is a *candidate* until it clears its gate, regardless of medium.

### 5 · The finding lifecycle; qualification is the gate, operationalized

A finding moves **raw** (in `workspace/runs/<id>/`) → **qualified** (`workspace/findings/<id>/`)
→ **design** (optional, `system/docs/designs/`, the user's choice).
Qualification *is* the verify-to-promote gate made concrete:
a finding is "verified & reproducible" exactly when a **deterministic, repeatable confirmation
test** (e.g., Playwright) exists for it.
Negative findings qualify via a test that *repeatably asserts the negative* — a regression guard
against a silent fix.

### 6 · Data layer — plain text, layered canonicity

All data is **NDJSON(JSONL)/CSV** — no SQLite or binary store.
Two homes by ownership:
`system/.os/data/` holds system data *about the discovery process* (entity records + candidate
staging);
`system/workspace/datasets/` holds user-owned data *for/from the target system*.
**Layered canonicity:** structured entity fields are canonical in `.os/data/*.jsonl`
(status-tracked); narrative is canonical in `system/docs/` and references entity IDs;
any overlapping doc table is generated from the JSONL, so there is no drift.

### 7 · Entity model and semantics

The entity types are
requirement, capability, persona, test-case, result, run, finding, and extraction (load plan),
each carrying a common envelope and a per-type sequence ID (`REQ-001`, `RUN-001`, …);
their contracts live in `system/.os/contracts/`.
The three knowledge types answer different questions and carry different truths:
**capability** is *descriptive* (what the product can do — the matrix);
**requirement** is *normative* (what Deere needs);
**finding** is *empirical* (what we observed).
The gaps between them are the deliverable: a **capability gap** is a requirement with no
satisfying capability; a **bug** is a capability that misbehaves — the engagement's
vanilla-environment deliverables.

### 8 · Contracts

Authority for each artifact type lives in `system/.os/contracts/`.
The **playbook contract** carries three orthogonal axes — `category` (directory),
`execution_mode`, `state_nature` — plus a lifecycle and a separate **guardrail body variant**
(Scope/Rules/Rationale; guardrails constrain, they do not run).
Playbook IDs are flat (`PB-NNN`); category is a property, not encoded in the ID.

### 9 · Agent routing

`.os/` is the operating-system router (the entry to the operational layer).
Routers are thin dispatchers; authority lives in contracts, and each contract carries
**forward-routing** ("Next Step"), so the pipeline is self-propelling.
**`AGENTS.md` is canonical; `CLAUDE.md` is a one-line pointer to it** in every router we own.
Crossing into a `docs/` tree is always a hand-off that obeys make-docs's own router.
The plug-in boundary itself is enforced by the first `active` **guardrail playbook**, surfaced
from the relevant routers (guardrails-as-routing).

### 10 · Shipping boundary

What we ship is the contents of `system/`: a fresh-start, filesystem-based pseudo-OS users adopt
for their own target system.
Users own their data and whether to track or ignore it; the OS imposes no data gitignore.

### 11 · First slice (validation)

The plug-in-boundary guardrail (`system/playbooks/administrative/respect-make-docs-plugin-boundary.md`,
`PB-001`, `active`) plus its routers, the first `.os/contracts/playbook-contract.md`, and the
`.os/templates/` shapes were built first to validate the contracts and routing conventions
against real files.
They held with no friction.

## Alternatives Considered

**Database-first (SQLite as source of truth, docs generated from it).**
Rejected: the deliverables *are* the markdown, and a binary store fights git review, merges, and
every other make-docs convention.

**SQLite as a disposable query index over markdown.**
Superseded: standardizing on plain-text NDJSON/CSV removed the binary entirely, simplified the
substrate, and made the data user-ownable; cross-entity queries run via scripts over JSONL.

**A single promotion "ladder."**
Replaced by three explicit flows once conversion and extraction were separated; the single-ladder
framing conflated intake with discovery.

**One promotion gate.**
Replaced by two gates, because instruments and findings clear different bars (editorial vs.
evidentiary).

**A dedicated `system/docs/findings/` area for findings.**
Rejected: it would create a new directory under a make-docs tree and dilute it; findings live in
`workspace/findings/` and promote into `system/docs/designs/` only via the make-docs router.

**Encoding playbook category in the ID; reusable prompt files for stage-movers; authoring our own
top routers.**
Rejected respectively in favor of category-as-property, hooks/slash-commands (make-docs is
deprecating prompts), and augmenting the co-owned top routers.

## Consequences

The system is git-native, reviewable, and agent-operable; the make-docs plug-in stays
upgradeable; and the model produces concrete deliverables (capability gaps and bugs) rather than
an undifferentiated pile of records.

Trade-offs and risks:
plain-text data trades SQL ergonomics for simplicity and ownership (queries become scripts over
JSONL);
every promoted finding must earn a deterministic confirmation test (qualification has a cost,
deliberately);
the operating-layer entry pointer depends on the make-docs CLI preserving our augmentations to
the co-owned top routers.

Deferred / follow-on work:
promotion *enforcement* (documented convention vs. tooling/machinery) is intentionally open;
the converter inventory and provenance contract are not yet written;
the remainder of the `.os/contracts/` file set (entity-records, run-record, finding,
converted-source, extraction) and the rest of the `system/` scaffold remain to be built;
stage-movers (intake→extract, run→qualify, qualify→design) are to be implemented as hooks and
slash commands.

## Intended Follow-On

- Route: `baseline-plan`
- Next Prompt: [designs-to-plan.prompt.md](../assets/prompts/designs-to-plan.prompt.md)
- Why: This is a greenfield architecture with no active PRD namespace; it should feed a fresh
  baseline planning flow that sequences building the system — remaining contracts, converters,
  the `system/` scaffold, and the hook/slash-command stage-movers.
- Coordinate Handoff: N/A — baseline plan; no prior coordinate to revise.
