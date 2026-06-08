# Design Use Cases — Scenarios, Journeys & Cases

> **Purpose.** A catalog of the user/product journeys the system must support. We use these
> to dig into the design concretely — tracing a case end-to-end is the cheapest way to find
> what the model can't yet carry. Pairs with [`DESIGN_PROGRESS.md`](DESIGN_PROGRESS.md) and
> [`GLOSSARY.md`](GLOSSARY.md).
>
> **Actors.** `tool` (deterministic script) · `agent` (AI, incl. computer-use) ·
> `human` · `user` (human **or** agent).
>
> **Status.** 🌱 stub (named, not detailed) · 🔨 in progress · ✅ traced end-to-end.
>
> **Flows.** **A — Intake/Knowledge** (`convert → extract → verify → promote`) ·
> **B — Discovery/Execution** (`playbook → run → verify → promote`). Flow A can produce the
> instruments Flow B runs.

_Last updated: 2026-06-03_

---

## Flow A — Intake / Knowledge

### UC-A1 · Deterministic bulk conversion 🌱
- **Actor:** tool (agent fallback for one-offs).
- **Trigger:** new source files land in `system/assets/`.
- **Sketch:** a converter script per type (docx · xlsx · pdf · html · html-dir · csv) emits a
  clean md/csv twin into `system/assets/converted/`, mirroring source paths, with provenance
  frontmatter (source hash, converter+version, timestamp).
- **Output:** clean text twin only — **no structuring** (P3).
- **Open:** xlsx multi-sheet → multiple CSVs? html-dir → stitch vs mirror? re-conversion
  detection on source change?

### UC-A2 · One-off agent conversion 🌱
- **Actor:** agent.
- **Trigger:** a source type/shape no converter handles cleanly.
- **Sketch:** agent produces the clean twin manually, following the same output/provenance
  contract as UC-A1 so downstream can't tell the difference.
- **Open:** how to flag "convert this deterministically later" (tool gap backlog)?

### UC-A3 · Extraction → DB rows (structured knowledge) 🌱
- **Actor:** user (ETL).
- **Trigger:** converted content contains structured knowledge (requirements, capabilities,
  personas, test cases).
- **Sketch:** user extracts + transforms into typed rows (DATA_SHAPES) and **loads as
  candidates** into `system/data/`. Rows carry anchors back to source + (eventually) docs.
- **Output:** candidate DB rows (unverified).
- **Open:** load contract / "load plan"; dedup vs existing rows.

### UC-A4 · Extraction → new Playbook(s) (instruments) 🌱
- **Actor:** user (ETL).
- **Trigger:** a source describes procedures/scenarios (e.g., a scenarios `.xlsx`, an
  "Exploration Session Features" `.docx`).
- **Sketch:** user extracts scenarios and **mints discovery/testing Playbooks** — choosing
  category, execution-mode, and state-nature. These become instruments for Flow B.
- **Output:** candidate playbook(s) (`draft`).
- **Gate:** *review-to-activate* — a reviewer moves `draft→reviewed→active`; only **active**
  playbooks are runnable in Flow B (D9/P6).

### UC-A5 · Extraction → `docs/` artifact 🌱
- **Actor:** user (ETL).
- **Trigger:** a source is best captured as a durable document (e.g.,
  `RentalManagement_DataModel.xlsx` → a design doc).
- **Sketch:** user extracts + transforms into a `system/docs/` artifact via make-docs workflow.
- **Output:** candidate doc (unverified until reviewed/verified).

### UC-A6 · Extraction → combination (the realistic case) 🔨
- **Actor:** user (ETL).
- **Trigger:** one rich source feeds several destinations at once.
- **Sketch:** e.g., a private-preview feedback `.xlsx` yields **DB rows** (requirements) +
  **playbooks** (scenarios to test) + a **doc** (summary of feedback) in a single extraction.
- **Why it matters:** this is the normal case, and it stresses the "load plan" contract (Q2)
  and the candidate-status model (P5) hardest.

---

## Flow B — Discovery / Execution

### UC-B1 · Discovery run → positive finding + spec ✅target
- **Actor:** agent (computer-use), human-reviewed.
- **Trigger:** a discovery/standing playbook (e.g., "create a rental account in FO").
- **Sketch:** agent runs the playbook against the environment → emits an immutable **run
  record** with `outcome: positive` → **verify-gate** → promotes a **finding** to
  `system/docs`, **rows** to `system/data`, and a **Playwright spec** to `system/workspace`.
- **Status:** candidate for the first full end-to-end trace (#10).

### UC-B2 · Discovery run → negative finding + negative spec 🌱
- **Actor:** agent (computer-use), human-reviewed.
- **Trigger:** a discovery playbook where the system **can't** do the expected thing.
- **Sketch:** run record `outcome: negative` → verify-gate → promotes a **bug/gap finding**
  + a Playwright spec that **asserts the failure** (guards against silent "fixes").
- **Why it matters:** validates the escape hatch (P4) — the reason the gate is "verified,
  not successful".

### UC-B3 · Standing playbook invoked anytime 🌱
- **Actor:** user.
- **Trigger:** a reusable, lifecycle-independent capability is needed mid-stream (e.g.,
  "create a rental account in FO" as a precondition for another run).
- **Sketch:** standing playbook runs idempotently regardless of lifecycle position; may or
  may not emit a promotable artifact.

### UC-B4 · Guardrail playbook governs a session 🌱
- **Actor:** user (constrained by it).
- **Trigger:** any run.
- **Sketch:** a `guardrail` (stateless) playbook constrains behavior of humans & agents
  (e.g., "never modify prod config during discovery"). It does **not** execute or promote —
  it's governance, surfaced via routing.

### UC-B5 · Promote/verify review by a human 🌱
- **Actor:** human reviewer.
- **Trigger:** candidates (findings or instruments) await the gate.
- **Sketch:** reviewer inspects a candidate + its run record/source. Which gate applies
  depends on the candidate type (D9/P6): **findings** → *verify-to-promote* (evidentiary);
  **instruments/playbooks** → *review-to-activate* (`draft→reviewed→active`).
- **Open:** how the decision is recorded (who/when/evidence); convention vs machinery (Q4).

---

## Flow C - Design, Plan, Backlogs, Build

> NOTE: This flow is a work-in-progress.  Only the high-level *thread* is defined, but use cases can be inferred from the detail that has been captured so far.

**Thread:** `Config and setup list.pdf` (UC-A1) → converted twin → **extraction** (UC-A6) that
mints a discovery playbook *and* seeds requirement rows → **run** of that playbook to
"configure a rental setup in FO" (UC-B1 or UC-B2) → run record → **verify-gate** → promote
finding + spec + rows. Tracing this forces concrete answers to data-layer (#1), run-records
(#3), schema (#4), playbook contract (#5), and promotion mechanics (#7).

---

## Cross-cutting cases

### UC-X1 · Tagging every artifact 🌱
- `env:` {vanilla · deere · both} and `for:` {microsoft · deere · both} applied across
  findings, rows, playbooks, runs; validated by a path/frontmatter hygiene check.

### UC-X2 · Agent orientation on entry 🌱
- An agent enters a directory and the local AGENTS.md/CLAUDE.md router tells it which **space**
  it's in and what it may/may not do — the front line of P1.
