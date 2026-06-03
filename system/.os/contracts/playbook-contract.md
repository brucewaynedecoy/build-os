# Playbook Contract

## Purpose

Authority for playbooks under `playbooks/**`. A playbook is a typed Markdown **instrument** that
guides a human or agent. Apply this contract to newly authored playbooks and to substantial edits.

## Required Path

- `playbooks/<category>/<slug>.md`
- `<category>` ∈ `administrative` · `build` · `discovery` · `testing` (the directory **is** the
  category).
- `<slug>` lowercase, hyphens only. The category is a property + the directory — **not** encoded
  in the `id`.

## Required Frontmatter

| Field | Values / form | Notes |
| --- | --- | --- |
| `id` | `PB-NNN` | flat per-type sequence; category not encoded |
| `title` | string | |
| `category` | `administrative` \| `build` \| `discovery` \| `testing` | = directory |
| `execution_mode` | `explicit-steps` \| `guided-objective` \| `inferred-actions` \| `n/a` | `n/a` for guardrails |
| `state_nature` | `stateful` \| `standing` \| `guardrail` | |
| `status` | `draft` \| `reviewed` \| `active` \| `archived` | review-to-activate; only `active` runs/enforces |
| `audience` | `human` \| `agent` \| `both` | |
| `harness` | list: `browser`, `computer-use`, `mcp`, `shell`, `none` | see make-docs `harness-capability-matrix.md` |
| `env` / `for` | `vanilla\|deere\|both` / `microsoft\|deere\|both` | |
| `targets` | list of entity ids (REQ/CAP/TC) | may be empty |
| `produces` | list: `run-record`, `dataset`, `finding`, … | empty for guardrails |
| `source_anchor` | `path#id` \| null | if minted by an extraction |
| `version` | semver | |
| `related` | list of links / ids | |

## Required Body — procedure playbooks (`stateful` / `standing`)

- `## Objective`
- `## Preconditions` *(required when `stateful`)*
- `## Steps & Guidance` *(shape follows `execution_mode`)*
- `## Expected Signals` *(positive / negative / inconclusive)*
- `## Produces`
- `## Notes / Links` *(optional)*

## Required Body — guardrail playbooks (`state_nature: guardrail`)

Guardrails do **not** run and produce nothing (`harness: [none]`, `produces: []`,
`execution_mode: n/a`). They constrain humans & agents and are surfaced via routing.

- `## Scope` — when it applies
- `## Rules` — `MUST` / `MUST NOT`
- `## Rationale`

## Lifecycle

`draft → reviewed → active → archived`. Only `active` playbooks are runnable (procedures) or
enforced (guardrails). Indexed in `../indexes/playbooks.json` (derived, rebuildable).

## Intended Follow-On (Next Step)

- A **procedure** playbook, when run, produces a **run record** in `workspace/runs/<id>/`
  (run-record contract) → qualify into `workspace/findings/<id>/` (finding contract) → optionally
  promote to a design under `system/docs/designs/` via the make-docs design router.
- A **guardrail** playbook, once `active`, is surfaced from the relevant directory `AGENTS.md`
  routers; it has no run.

## Link Rules

- Use relative Markdown links. Reference make-docs material **read-only**; never modify it.
