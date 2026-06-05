# Finding Contract

## Purpose

Authority for findings promoted from run records. A finding is a qualified, reproducible observation that can be carried forward into design or implementation work without losing its originating run evidence.

Routers may send qualified findings onward, but this contract owns the finding shape, lifecycle, and qualification rules.

Design promotion is an optional, user-gated follow-on. It may append design links to the finding, but it does not replace the finding as the evidence-backed observation.

## Required Path

- Qualified finding directory: `system/workspace/findings/<FIND-NNN>/`
- Finding record: `system/workspace/findings/<FIND-NNN>/finding.md`
- Qualification record: `system/workspace/findings/<FIND-NNN>/qualification.md`

`<FIND-NNN>` uses the `FIND` per-type prefix and a zero-padded sequence.

Raw findings do not receive `FIND` IDs. They live as local anchors inside `system/workspace/runs/<RUN-NNN>/raw-findings.md` until qualification promotes them.

## Required Shape

Each qualified finding directory contains the promoted finding and the repeatable qualification test that justified promotion.

| Artifact | Required | Notes |
| --- | --- | --- |
| `finding.md` | yes | Human-readable finding record with origin, summary, impact, scope, current status, and follow-on links. |
| `qualification.md` | yes | Deterministic repeatable confirmation test, expected assertion, actual result, and evidence links. |

`finding.md` must identify:

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `FIND-NNN` | Matches the finding directory. |
| `title` | string | Concise finding label. |
| `status` | `qualified` \| `designed` \| `archived` | `qualified` is the entry status after promotion. |
| `polarity` | `positive` \| `negative` | Whether the finding confirms presence or repeatable absence/failure. |
| `origin_run` | `RUN-NNN` | Run that produced the raw finding. |
| `raw_anchor` | relative Markdown link | Anchor in the originating run's `raw-findings.md`. |
| `qualification_test` | relative Markdown link | Usually `qualification.md`. |
| `systems` | list of configured `systems[].id` values | Use configured IDs from the config contract. |
| `environments` | list of configured `environments[].id` values | Use configured IDs from the config contract. |
| `owners` | list of configured `owners[].id` values | Empty when ownership is not applicable. |
| `qualified_at` | ISO 8601 timestamp | Time the repeatable test qualified the finding. |
| `designs` | list of relative links | Empty until optional user-gated design promotion records accepted design links. |
| `related` | list of links / ids | Requirements, capabilities, test cases, results, runs, designs, or design hand-off artifacts. |

`qualification.md` must identify:

| Field | Values / form | Notes |
| --- | --- | --- |
| `test_type` | string | Command, manual procedure, harness, script, or other deterministic method. |
| `procedure` | steps / command | The exact repeatable confirmation path. |
| `assertion` | string | What must be true for the finding to qualify. |
| `result` | `pass` | A qualified finding requires a passing repeatable confirmation. |
| `evidence` | list of relative links | Links to immutable run evidence or qualification evidence. |

## Lifecycle

`raw -> qualified -> design` where `design` is optional.

- `raw`: unqualified observation anchored inside a run record.
- `qualified`: promoted finding with `FIND-NNN`, `finding.md`, and `qualification.md`.
- `design`: optional user-gated follow-on design work under `system/docs/designs/` after routing through the make-docs design router.

Archiving a qualified finding preserves its origin run and qualification links.

## Qualification Rules

- Qualification requires a deterministic, repeatable confirmation test.
- One-off observation, intuition, or unrepeatable evidence is not enough to qualify a finding.
- Positive findings qualify when the repeatable test confirms the asserted behavior or condition.
- Negative findings qualify when the repeatable test asserts the negative and passes repeatably.
- The qualification test must be specific enough that a later agent or human can rerun it and reach the same pass/fail conclusion.
- Qualification links to immutable run evidence; it does not rewrite the originating run.

## Design Promotion Rules

- Promotion is deliberate and user-gated; a qualified finding is never auto-promoted.
- Only a `qualified` finding with a deterministic qualification anchor may enter design promotion.
- Promotion passes the finding id, origin run, raw finding anchor, qualification test anchor, and configured `systems`, `environments`, and `owners` into the design hand-off.
- Promotion writes design artifacts only through the make-docs design router under `system/docs/designs/`.
- Promotion records accepted design links in `finding.md` and the finding index, but does not rewrite the origin run, raw finding, or qualification evidence.
- Stage-mover automation after the design hand-off is a separate concern.

## Intended Follow-On (Next Step)

Qualified findings that require solution framing, design tradeoffs, or implementation direction hand off to `system/docs/designs/` through the make-docs design router. The hand-off route must identify whether the design should feed baseline planning or an additive change-planning flow.

The finding remains the evidence-backed observation. The design owns proposed changes and decision logic.

## Link Rules

- Use relative Markdown links.
- Link every qualified finding back to the originating `RUN-NNN` and raw finding anchor.
- Link qualification evidence to immutable run artifacts or qualification artifacts.
- Link designs from `finding.md` only after the make-docs design router creates or accepts the design artifact, and keep those links project-relative from the finding directory.
- Reference make-docs material read-only; never modify make-docs-managed files from this contract.
