---
name: capability-matrix
description: "Build joinable capability models for software systems and a scored fit/gap analysis between them."
---

# Capability Matrix

A rigorous, repeatable way to turn a pile of source material about several systems into one joinable set of
capability models and a defensible comparison. The method was developed on a real platform decision
(a custom-built book-lending solution on one platform against a vendor's first-party lending module on another) and every
rule below exists because its absence cost something on that run.

## What it is

This skill builds requirement-level capability models for two or more software systems from documentation
the user has gathered. It also builds a scored fit/gap (or integration overlap) analysis between them.

- **Per system:** a model JSON, capabilities and requirements CSVs, a data dictionary, and a narrative document.
- **Across systems:** the fit/gap as CSV and JSON, with a decision readout.

**When to use it.** Use this skill whenever the user wants to compare systems, platforms, products, modules or
vendors, either against each other or against a requirements baseline. Common reasons:

- migration or replacement
- platform or vendor selection
- "what would we lose or gain"
- coexistence and integration overlap ("which system should own X")
- consolidation
- organising and hydrating captured requirements into one joinable structure

Typical triggers: capability model, capability matrix, fit/gap, gap analysis, requirements traceability,
feature comparison, platform assessment, or "the same treatment" for another system. Use it even for one
system, so the output stays joinable with later systems.

## What comes out

```
deliver/
  <CODE_A>/  <code_a>-capability-model.json      complete model: meta, vocabularies, layers, principles,
                                                   capabilities with nested requirements, navigation tree
             <code_a>-capabilities.csv           one row per capability
             <code_a>-requirements.csv           one row per requirement, joinable on capability_id
             <code_a>-data-dictionary.md         schema, vocabularies, encoding, how it joins to the others
             <System A Name> - Capability Model.md   the narrative: framing, one section per capability,
                                                   cross-cutting principles, inventory, source notes
  <CODE_B>/  … same five files …
  fit-gap/   <a>-<b>-fit-gap.csv / .json         every baseline capability scored against the target,
                                                   plus target-only capabilities (replacement / selection)
             <a>-<b>-integration-map.csv / .json ownership and overlap per capability (integration mode)
             fit-gap-readout.md                  the decision document: what the matrix actually says
build/       working files — skeletons, source dumps, briefs, sub-agent outputs
```

All systems share one layer taxonomy and one field schema, so the CSVs union cleanly and the fit/gap
joins both. Only two things vary per system: the id prefix and the status vocabulary.

## Sequence

| Phase | Who | Output |
|---|---|---|
| 0 Intake decisions | lead | systems, codes, relationship mode, taxonomy, status vocabularies |
| 1 Read and index every source | lead | plain-text dumps + an index note per system |
| 2 Skeletons | lead | `build/<code>/skeleton.json` per system |
| 3 Extract and hydrate requirements | parallel sub-agents | `build/<code>/out_*.json` |
| 4 Assemble models | command | model JSON + two CSVs per system |
| 5 Narrative documents | parallel sub-agents + lead frame | one `.md` per system |
| 6 Data dictionaries | lead | one `.md` per system |
| 7 Fit/gap | parallel sub-agents + lead | matrix CSV/JSON + readout |
| 8 Validate and deliver | command + lead | validated files in the user's folder |

Create a task list with these eight phases before starting (the task-list tool if present, otherwise
`build/TASKS.md`); the run is long and the user will be checking progress. The tool is the
`buildos capability-matrix` command — it checks skeletons, assembles models, merges the fit/gap and
validates everything deterministically, so sub-agent output only has to be right in content, not in
formatting. It needs Node.js 24 or newer and nothing else.

| Name | Means |
|---|---|
| `<project>` | The BuildOS project folder, the one that holds `.os/`; `build/` and `deliver/` are inside it |
| `<buildos>` | The project wrapper `<project>/.os/scripts/buildos` (`<project>\.os\scripts\buildos.cmd` on Windows, with the same arguments) |

Every command below takes `--root <project>`, and its `build/` and `deliver/` paths are relative to
`<project>`. It reads only files inside `<project>`, and it writes outside `<project>` only with
`--allow-outside-root`; use that only when the user asks for an output outside the project. Keep the
quotes around a pattern such as `"build/<code>/out_*.json"`: BuildOS expands it itself (Command Prompt
needs double quotes). Use an absolute `<project>` in every shell command; the working directory does not
reliably persist between calls.

---

## Phase 0 — Intake decisions

Read the user's document collection before deciding anything (Phase 1 overlaps with this). The relationship
between the systems, and what the comparison is for, is usually stated somewhere in that collection. Four
decisions shape every later phase; settle them from the documents, ask the user only where the documents are
silent, and state your assumptions in the first message.

**1. Systems, codes and relationship mode.** Give each system a 2–4 letter uppercase code (`CIRC`, `LIB`, `SAP`,
`LGCY`). If a source's own identifiers already begin with the natural code (`ORB-R-012` in a register for
system ORB), either pick a different code or accept that `source_refs` and model ids will sit side by side
in the CSV, and say which in the data dictionary. Then classify the relationship:

| Mode | Shape | Baseline | Fit/gap question |
|---|---|---|---|
| `replacement` | incumbent → candidate | the incumbent | if we moved, what happens to each thing we have? |
| `selection` | requirements baseline → K candidates | the requirements set (may be a "system" of its own) | which candidate covers what? run the matrix once per candidate |
| `integration` | systems that will coexist | none — the union | who owns each capability, where do they overlap, what must flow between them? |
| `consolidation` | K incumbents → one target | each incumbent in turn | replacement mode run once per incumbent |

The baseline is the system whose capabilities get scored row by row. In integration mode there is no baseline
and the matrix is keyed by a union capability list instead (Phase 7).

**2. One shared taxonomy.** Every system is decomposed into the same layers — typically 6–16, matched to
the breadth of the domain, never to the size of one system. If the baseline's sources already carry a clear
layer structure (an existing capability model, a spec with functional areas, a register with sections),
adopt its layer names and order verbatim so the new models group identically against it; layer ids are
`L1…Ln` and codes are 2–4 uppercase letters, taken from the source where it has them and derived from the
names where it does not. Otherwise derive a neutral domain taxonomy from the union of all sources and apply
it to all systems. Never add a system-specific layer: where a concept has no natural home, place it in the
nearest layer and note the placement in the data dictionary. A shared taxonomy is what makes the
comparison possible; a distorted placement is a note, a missing layer is a broken join.

**3. Per-system status vocabulary.** Each system's sources describe maturity in their own language —
built / in flight / designed for something you built; available in preview / partial / roadmap / deferred for
a vendor preview; GA / beta / deprecated for a product catalogue. Keep each system's `status` in its own
native vocabulary, declared in that system's model, and map it to the fixed cross-system `maturity`
ordinal (`proven` › `available` › `partial` › `planned` › `deferred`). Do not force one status enum across
systems: "we built and validated this" and "the vendor says it works in a pre-release build" are different
kinds of claim, and collapsing them is how a matrix ends up lying. `maturity` gives you the comparable
column; `status` keeps the truth.

Every vocabulary needs one value for *the source is silent, caveated or self-contradictory* — the status
that extraction puts on a requirement recording an absence. Name it `undocumented` unless the source has its
own word for it, map it to maturity `partial`, and avoid naming it `partial` itself: that word already means a
maturity value and a fit/gap verdict, and three meanings on one token is how readers misread the CSVs.

**4. Granularity.** Match the richness of the sources, and let that decision override every figure that
appears later in this skill. The figures below — 80–200 capabilities and 5–12 requirements per capability
per system, 12–18 on dense configuration surfaces, 6–8 extraction packages, 8–12 design principles,
25–60 narrative lines per capability — are calibrated for document-rich sources of roughly 100 KB or more
per system. Thin sources scale everything down proportionally: 190 lines of source is 20-odd capabilities,
2–6 requirements each, one package per layer, and 6–20 lines per section. Write the scaled targets into
`build/intake.md` and into every brief. If the user's sources already enumerate capabilities or
requirements with identifiers, preserve them — carry the identifiers in `source_refs`, mark `origin: captured`, and split or merge only where a captured item is compound or
duplicated. Do not collapse 400 captured requirements into 100 or inflate 50 into 500. The user asked for
their material organised and hydrated, not replaced.

---

## Phase 1 — Read and index every source

Convert everything to plain text first so that you and every sub-agent read the same bytes: workbooks to
one text block per sheet with cells pipe-separated, HTML to markdown (strip scripts and styles, keep
headings, lists and tables), Word and PDF via `pandoc` / `pdftotext`, existing models and CSVs as-is. Put
the dumps in `build/sources/<code>/` and point sub-agents at the dumps, never at the originals.

Then read all of it yourself, end to end, before designing anything. The lead has to know the material to
write a good skeleton, to give each sub-agent the two sentences of package-specific guidance that make the
difference, and to write the narrative frame. Skimming here produces a plausible-looking model with the
wrong shape.

For each system write `build/<code>/index.md` while reading: the documents and their sections; the
system's own capability or requirement identifiers if any; named personas; the maturity language the
sources use; every explicit caveat ("will be refactored", "not implemented", "coming in a later release",
"removed"); every cross-reference to a document that is *not* in the collection; and every statement
about how the systems relate to one another or what the comparison is for. The caveats and the missing
documents become some of the most valuable rows in the model.

---

## Phase 2 — Skeletons

For each system write `build/<code>/skeleton.json`:

```json
{
  "system": {
    "code": "LIB", "name": "Library Platform Lending",
    "title": "…", "description": "…",
    "sources": [{"id": "docs", "name": "…", "detail": "…"}],
    "notes": ["…decisions worth recording: taxonomy adoption, placements, what was excluded…"],
    "status_vocabulary": {"available_preview": "Demonstrable in the preview and documented as working.",
                          "undocumented": "The sources are silent, caveated or contradictory on this point.", "…": "…"},
    "maturity_map": {"available_preview": "available", "undocumented": "partial", "roadmap": "planned", "deferred": "deferred"},
    "converted": false
  },
  "layers": [{"id": "L1", "code": "CFG", "name": "Branch Configuration", "description": "…"}],
  "design_principles": [{"id": "P01", "name": "…", "statement": "…", "evidence": ["LIB-CFG-08"]}],
  "capabilities": [
    {"id": "LIB-CFG-01", "layer_id": "L1", "doc_ref": "2.1", "type": "configuration", "status": "available_preview",
     "name": "Lending Parameters: General and Loan Periods", "origin": "derived", "source_refs": [],
     "scope": "A briefing paragraph for the extractor: what this capability covers, its named settings, its boundaries with neighbours.",
     "sources": ["doc-3 Configure lending parameters > General tab"]}
  ]
}
```

Conventions that the tooling and the narrative depend on:

- `id` is `{CODE}-{LAYER_CODE}-{NN}`; an optional lowercase letter suffix marks a child (`LIB-BIL-03a`, with
  `parent_id`). Every system carries its code as a prefix so the CSVs union without collision.
- `doc_ref` is `{part}.{n}` where part = layer index + 1, because Part I of every narrative is the framing.
  Layer L1 is §2.x, L9 is §10.x. Children share the parent's `doc_ref` in the model and take a
  `#### <doc_ref><suffix> <name>` heading in the narrative (`#### 2.2a Branch-Level Overrides`), so parent
  and child headings never collide.
- `type` is one of the ten capability types in the schema reference — a business rule is a `capability`,
  not a `rule` (that word belongs to requirement kinds).
- `scope` is the extractor's brief. Write it well: it is the difference between a sub-agent that finds the
  right passages and one that wanders. Name the settings, the status values, the boundaries with adjacent
  capabilities.
- Consolidate. A capability is something a user of the system would recognise as a thing. Twenty tabs of
  parameters are three or four capabilities, not twenty. Over-splitting doubles the fit/gap without adding
  information.

Check it before dispatching anyone: `<buildos> capability-matrix skeleton --root <project> --skeleton build/<code>/skeleton.json`
reports counts per layer and fails on duplicate ids, a prefix that does not match the layer, a type or status
outside the vocabulary, or a scope brief too thin to guide an extractor. A skeleton error found after
extraction costs an hour.

**When a system already has a capability model** — the user's collection may include one built earlier, in
this schema or close to it — convert rather than re-extract. Prefix its ids with the system code, declare its
status vocabulary and maturity map, set `origin: captured` with `source_refs` pointing at the original ids,
set `system.converted: true` (which tells the skeleton check not to demand extractor briefs), feed the
converted capabilities to `assemble` as a single parts file, and validate. Re-extract only the
layers the user asks to hydrate further, and keep the original ids in `source_refs` so nothing they
reference elsewhere goes stale.

---

## Phase 3 — Extract and hydrate requirements

Split each skeleton by layer into work packages (6–8 of 18–30 capabilities at full scale), write
`build/<code>/capability_index.json` (id, name, layer of every capability — extractors need it for accurate
`dependencies`), and write `build/<code>/EXTRACTION_BRIEF.md` — one per system, because the template
carries the system's name, sources, status vocabulary and granularity targets — from the template in the
briefs section.

Dispatch one sub-agent per package, all in one message so they run concurrently. Each task message is
short: read the brief in full and follow it; here is your package, the index, the sources, the output path;
then two to four sentences of package-specific guidance from your own reading — what is dense, what is
contradictory between sources, which status model must be enumerated in full, which article is missing.
That guidance is where the lead's reading pays off; do not skip it.

When packages return, merge and run `assemble`. Expect vocabulary drift between agents on one point in
particular — `option_scope` for the same kind of setting (one agent says `document`, another `rule`) — and
normalise it before assembling. If the environment has no sub-agents, work the packages sequentially
yourself against the same brief; the brief is the quality control, not the parallelism.

---

## Phase 4 — Assemble models

```
<buildos> capability-matrix assemble --root <project> --skeleton build/<code>/skeleton.json \
        --parts "build/<code>/out_*.json" --out deliver/<CODE> --date <YYYY-MM-DD>
```

The command restores skeleton fields the agents may have altered, maps `status` to `maturity`, renumbers
requirement ids sequentially, strips option fields from non-settings, normalises pipe delimiters, and
writes the model JSON and both CSVs with a fixed field order. It refuses to run on a status outside the
system's declared vocabulary, which is the check that catches an agent inventing one.

Now — having read the whole extraction — write the system's **design principles**: eight to twelve
cross-cutting observations that explain *why* the capabilities look the way they do (where behaviour is
configured, what the unit of billing truth is, which statuses actually enforce anything, what the
architecture refuses to let you edit). They are the most quoted part of the narrative and the best
questions to put to a vendor. Put them in `skeleton.json` and re-run `assemble`.

---

## Phase 5 — Narrative documents

Generate per-part work packages from the model (each capability rendered with its summary, lists and full
requirement list, grouped by layer with the Part number and title), write `build/<code>/NARRATIVE_BRIEF.md`
(one per system) from the template, and dispatch one sub-agent per group of one to four Parts, again with
package-specific guidance: the framing argument each Part should carry, which tables to render, which worked examples to
keep. If a sibling narrative already exists for another system, give the agents three sections of it as a
voice reference — matching register across systems is what makes the documents readable side by side.

The lead writes the frame, because it requires having read everything:

- **Title and About** — what the document is and is not; the source-discipline rule; the status marker
  table for this system, with an explicit warning that these markers are not another system's markers.
- **Part I — The Shape of the Solution** — the layer table with capability counts, then the two or three
  structural facts that shape everything below. This is the page a decision maker reads.
- **Parts II onward** — the sub-agents' output, assembled in Part order (split multi-Part outputs on
  `## Part` headings and re-sequence).
- **Cross-Cutting Design Principles** — the principles from the model, rendered in full.
- **Capability Inventory** — status counts for capabilities and requirements, the list of every
  non-nominal capability, and a per-layer table of where requirement-level gaps concentrate.
- **Appendix — Source Notes** — the sources, the documents referenced but absent, what was excluded, and
  the companion files.

Then verify with `validate --narrative`: every root capability must have a `### <doc_ref> <name>` heading
with the name matching the model exactly, and every design principle must appear. Section numbers are the
join between prose and data; a drifted heading breaks it silently.

---

## Phase 6 — Data dictionaries

One per system, modelled on the outline below, and every number in it checked against the data by a
script before delivery — a data dictionary with a wrong count discredits the whole set.

```
# <System> Capability Model — Data Dictionary
Companion files table · Model diagram (Layer → Capability → Requirement, principles outside) ·
Capability fields · Requirement fields · Status vocabulary with counts and the maturity map ·
Requirement kinds with counts · Option scope with counts and what the distribution says about the system ·
Joining this model to the others (shared layers, id prefixes, maturity vs status, the fit/gap as join table) ·
Notes on encoding (pipes, BOM, capability_tree, doc_ref ↔ narrative, placements, recorded contradictions)
```

The "what the distribution says" paragraphs are not filler. On one run, the fact that most
settings were scoped to a setup record and exactly one to an individual agreement *was* the headline
structural finding about the platform, and it fell out of a count.

---

## Phase 7 — Fit/gap

**Replacement and selection.** Split the baseline's capabilities by layer into 4–6 packages carrying their
full requirement lists. Give graders the target's `capability_index.json`, the target's requirements CSV
(the evidence base — the brief tells them to grep it), and the target's source dumps. Write
`build/fit-gap/FITGAP_BRIEF.md` (one per baseline–target pair) from the template and dispatch in parallel
with package-specific guidance about where the two platforms differ philosophically in that layer. For selection with K candidates, run the
whole step once per candidate.

When the graders return, compute the target capabilities that no row cites. Those are the target-only
capabilities — things the target has that the baseline never asked for — and the lead writes their rows
(`build/fit-gap/only.json`) because they are few, they need domain judgment, and they are framed as
opportunity rather than risk. They are not the whole of what the target brings: when the target consolidates
more into fewer capabilities, its extras sit as requirements inside capabilities the baseline rows already
cite. Read the `partial` and `native` evidence for those and carry them into the readout. Then:

```
<buildos> capability-matrix fitgap --root <project> --mode replacement \
        --baseline deliver/<A>/<a>-capability-model.json --target deliver/<B>/<b>-capability-model.json \
        --rows "build/fit-gap/fg_*.json" --only build/fit-gap/only.json --out deliver/fit-gap --date <YYYY-MM-DD>
```

**Integration.** Build the union capability list first: walk both models layer by layer and produce
`build/fit-gap/union.json` — one entry per distinct capability across systems, with the ids each system
contributes. Then dispatch mapping packages with the integration brief; the command writes the map with
`--mode integration --models <a-model> <b-model> [...]`.

**The readout.** Write `deliver/fit-gap/fit-gap-readout.md` last. It is short and it is the document that
gets read:

```
# <Baseline> → <Target> fit/gap readout
What was compared (one paragraph: the two models, their sizes, the mode, the sources' nature and date)
How to read the verdicts — the distribution, with the honest caveat that `partial` dominates by
  construction when a requirement-granular baseline is scored against documentation, and the three
  filters that carry the signal: baseline maturity = proven AND effort in (high, unknown) — the decision
  list, ten rows out of 136 on the reference run; if it is empty on thin sources, say so and use the next
  filter; confidence = low (questions, not conclusions); verdict = gap against proven capabilities (live
  operational losses)
The decision list — every row from the first filter, one line each: what it is, why it gaps, what to do
Findings by layer — three to five per layer that a decision maker would act on, in prose
What the target brings — the target-only rows plus the target-side extras buried in partial and native
  evidence (a target requirement inside a cited capability that the baseline never had), framed as
  opportunity, with the one or two worth phase one
Open questions for the vendor / other team — the low-confidence rows and every recorded source conflict
```

---

## Phase 8 — Validate and deliver

```
<buildos> capability-matrix validate --root <project> --model deliver/<A>/<a>-capability-model.json \
        --narrative "deliver/<A>/<A Name> - Capability Model.md"
<buildos> capability-matrix validate --root <project> --model deliver/<B>/<b>-capability-model.json --narrative "…" \
        --fitgap deliver/fit-gap/<a>-<b>-fit-gap.json --baseline deliver/<A>/… --target deliver/<B>/…
```

`validate` exits 0 when every check passes and 4 when one fails; the `FAIL` lines say which.

Every check must pass. Then spot-read: three narrative sections chosen at random for voice and for
requirements that were listed rather than synthesised, and five fit/gap rows for evidence that names a
mechanism rather than asserting support. Deliver every file with the file-delivery tool and, when the user
has a connected folder, write them there in the layout at the top of this skill, one sub-folder per system
code and one for the fit/gap. Tell the user the three findings you would put in front of a decision maker,
not a recap of the phases.

---

## Schema reference

**Capability** — `id`, `parent_id`, `name`, `layer_id`, `doc_ref`, `type`, `status`, `maturity`, `origin`,
`source_refs[]`, `summary`, `personas[]`, `triggers[]`, `outcomes[]`, `entities[]`, `dependencies[]`,
`provenance[]`, `source[]`, `tags[]`, `requirements[]`.

**Requirement** — `id` (`{capability_id}-R{NN}`), `kind`, `status`, `maturity`, `text`, `option_values`
(pipe-delimited, no spaces, settings only), `option_default`, `option_scope` (settings only), `source_refs[]`.

**Design principle** — `id` (`P01…`), `name`, `statement` (a paragraph), optional `evidence[]` of capability ids.

Three provenance fields that are easy to confuse: `source[]` is which of the system's declared source
documents the capability came from, using the ids in `system.sources` (`["docs","scenarios"]`);
`provenance[]` is the finer pointer within them (`doc-12`, `Scenario 7`, `§3.4`); `source_refs[]` is the
user's own identifiers for the captured capability or requirement, where the sources carry any.

| Vocabulary | Values |
|---|---|
| `type` | `process` end-to-end flow · `capability` discrete function · `configuration` settings governing behaviour · `data_entity` master or transactional record · `state_model` lifecycle of states · `workflow` human approval or routing · `architecture` structural decision with system-wide consequences · `integration` interface to another system or module · `report` analytical output · `document` generated artifact |
| `kind` | `rule` something enforced · `behavior` an action the system or user performs · `data` a data element, structure or status value · `setting` a configurable option · `dependency` a prerequisite outside the capability |
| `option_scope` | `global` once per installation · `location` per site, store, branch or legal entity · `account` per customer, vendor or party · `category` per product, item, asset or pricing category · `agreement` per contract or order header · `transaction` per document line, transaction or job run · `document` per document or report template · `role` per user, worker or security role · `rule` per setup record (templates, codes, profiles, status rows) · `multi` resolved by hierarchy |
| `maturity` | `proven` implemented and validated in real use · `available` implemented or demonstrable, not validated in production · `partial` present but materially incomplete · `planned` designed, specified or on a roadmap · `deferred` explicitly pulled or not implemented |
| `origin` | `captured` came from the user's own capability/requirement list · `derived` extracted from prose · `merged` several captured items combined |
| `status` | per system, declared in `system.status_vocabulary`, mapped to maturity by `system.maturity_map` |
| fit/gap `verdict` | `native` · `partial` · `configurable` · `gap` · `preview_gap` (named by the target but not present yet — the answer is wait, not build) · `target_only` |
| integration `overlap_type` | `exclusive` one system only · `duplicate` both do it independently · `complementary` each does a different part · `handoff` one starts it and the other finishes it |
| `confidence` / `effort` | `high` `medium` `low` / `none` `low` `medium` `high` `unknown` |

Status models are encoded as `data` requirements, one per value, text `Status: X — meaning`, so the whole
state vocabulary of a system is one query. A requirement's status may differ from its parent's: a working
capability commonly carries absence-status requirements recording specific undocumented corners, and those
rows are the most useful in the file.

---

## Sub-agent briefs

Write each to `build/` with the placeholders filled and point every agent at the file rather than pasting
it into the task message; agents that read a brief in full follow it more faithfully than agents that get
a summary. The calibration paragraphs are the important part — they are what stops an agent from padding,
inventing, or grading generously.

### Extraction brief

```
# Extraction brief — <SYSTEM NAME> capability model
You are extracting a capability and requirements model from the source material listed below. The output
sits alongside equivalent models for other systems so they can be compared, which is why the schema and
vocabularies are fixed.

SOURCES — read these, use nothing else: <paths to dumps, each with its id from system.sources>. Do not add
knowledge of <system/platform> from outside them. Every requirement must trace to a sentence in a source.
If something is obviously true of the platform but not stated here, leave it out or record it as an
`<absence status>` requirement worded to make the absence visible. Fidelity to source is the entire value
of this artifact.

WORK PACKAGE: <path>. Produce exactly one output object per skeleton entry, keeping id, layer_id, doc_ref,
type and name verbatim. Revise status only if the sources clearly contradict the skeleton, and say so in a
`_status_note` field. Full capability index for accurate dependencies: <path>. Output: a JSON array, no
wrapper, no commentary, to <path>. Validate it parses before finishing.

SCHEMA: <paste the capability and requirement field lists and the vocabulary table from the skill>.
Status vocabulary for this system: <paste system.status_vocabulary>; the absence status is `<name>`.
GRANULARITY TARGET for this run: <from build/intake.md — requirements per capability, lines of scope>.

FIELD RULES. summary: your own prose, one to three sentences, specific over generic — "21-day loan
period because course readers keep books for a full term" beats "flexible loan periods". personas: only
roles the sources name. dependencies: only ids from the index; they are validated and a bad id fails the
build. source: the ids of the source documents used, from the list above. provenance: the finer pointer
within them (article, sheet, section). origin and source_refs: if the sources
carry their own identifiers for this capability or requirement, carry them in source_refs and set origin
`captured`; if you split one captured item into several atomic requirements each carries the original
reference; if you merged several, origin `merged`; if you extracted from prose, `derived`. tags: lowercase;
`core` for load-bearing, `gap` for materially incomplete, `preview-feedback` or similar where the source
itself invites scrutiny of a surface.

OPTION SCOPE — use exactly: global (once per installation) · location (site, store, branch, entity) ·
account (customer, vendor, party) · category (product, item, asset or pricing category) · agreement (per
contract or order) · transaction (per document line or job run) · document (per document template) · role
(per user, worker or security role) · rule (per setup record: <name the system's template/rule/profile
objects here>) · multi. A setting without a stated value list keeps option_values null — do not guess.

GRANULARITY: as set above (5–10 requirements per capability and 12–18 for dense configuration at full
scale). Atomic: one testable statement each; a tab with nine settings is nine setting requirements.
Capture especially: every named
setting with values and defaults where stated; every status value in a state model as its own data
requirement ("Status: X — meaning"); every enforced block or validation; every automation trigger and the
setting that governs it; every documented industry practice and the reason the source gives for it; and
every explicit incompleteness — "will be refactored", "not implemented", "removed", a cross-referenced
document missing from the set, a setting named without its values, two sources that disagree. These carry
the absence status (or the system's own deferred/dropped status where it has one) and are the most valuable
rows in the file. Where sources contradict each other, record both sides in one absence-status requirement;
do not resolve it.

TONE: terse, factual, engineer-readable. No marketing adjectives. Where the source is vague, be vague
precisely — "the documentation does not describe X" is a legitimate requirement text.

Return a one-line summary: capability count, requirement count, and anything you had to judge.
```

### Narrative brief

```
# Narrative brief — <SYSTEM NAME>
You are writing Parts of a prose document that sits alongside a structured capability model. An
implementation lead, a solution architect and an operations manager will all read it. <If a sibling
document exists:> The equivalent document exists for <OTHER SYSTEM> at <path>; read three sections of it
for voice and match the register, not the content.

INPUT: <work package path>, containing your Parts' capabilities with summaries, lists and full
requirement lists. Everything you write comes from that file — the model was extracted under a strict
fidelity rule and the document must not undo it.

STRUCTURE for each Part: `## Part <ROMAN> — <Title>`, then one or two framing paragraphs (what the layer
governs and the single most important thing to understand about how this system approaches it — the
sentence a reader quotes in a meeting), then `### <doc_ref> <Capability name> **[Marker]**` per
root capability with doc_ref and name exactly as given, and `#### <doc_ref><suffix> <Child name>
**[Marker]**` for a child capability (`#### 2.2a …`) inside its parent's section. Markers: <map each
status value to a bracketed marker, e.g. available_preview → [In preview], undocumented → [Undocumented]>. A compound marker such as
**[In preview; gaps noted]** is allowed where genuinely informative.

HOW TO WRITE A SECTION: a synthesis of the requirements, not a list of them. Lead with the mechanism, not
the menu path. Bold the named settings, statuses and options. Tables for enumerations — a status model
with eight values is a table. Keep every worked example the sources give; numbers pin down semantics that
prose leaves ambiguous. Keep the reasoning the sources give for industry practice. Surface the
incompleteness: absence-status, deferred and roadmap requirements are the highest-value rows — work them
into the flow and, where a section has several, close with a short "Not documented:" or "Open questions:" run.
Where you observe something the sources do not literally state — a design consequence, a likely friction,
an interaction between settings — mark it as your reading: "The consequence is…", "In practice…".

VOICE: declarative, dense, unhedged, present tense. No filler, no "powerful / seamless / robust /
comprehensive", no "it is important to note", no addressing the reader as "you", no closing recaps.
Length <target from build/intake.md; 25–60 lines per capability at full scale> scaled to what the model
carries; a thin capability gets a short honest section, not padding.

OUTPUT: markdown only, starting at the first `## Part` heading, to <path>. Return a one-line summary.
```

### Fit/gap scoring brief (replacement and selection)

```
# Fit/gap brief — <BASELINE> capabilities scored against <TARGET>
THE QUESTION: for each <BASELINE> capability you are given, if this organisation <moved to / adopted>
<TARGET>, what would happen to it? This feeds a platform decision. A wrong `native` is worse than a
cautious `partial` — someone will plan against your verdicts. Be conservative and show evidence.

INPUTS: your package of <BASELINE> capabilities with full requirements: <path>. <TARGET> capability
index: <path>. <TARGET> requirements CSV — grep it; it is the evidence base and the only way to check
whether a specific baseline requirement has a counterpart: <path>. <TARGET> source dumps for exact
wording: <paths>. Search the requirements CSV by keyword before deciding anything. Absence of a keyword
across every requirement is strong evidence of a gap; presence needs reading.

VERDICTS — exactly these: native (out of the box at comparable depth; the user would recognise their
capability) · partial (a substantial part, but something the baseline treats as required is missing or
materially weaker — the honest verdict whenever you write "yes, but") · configurable (not a named
feature but reachable by configuring what the target has, with no code — say exactly which configuration)
· gap (no counterpart in either source; extension, ISV or process change) · preview_gap (the target names
it but it is not present yet — roadmap, deferred, or a cross-link to a missing document; the answer is
wait, not build). CONFIDENCE: high (sources speak directly to it) · medium (reasonable inference from
adjacent documentation) · low (sources silent or ambiguous; your judgement — use it freely, a documented
low beats a confident guess). EFFORT to close the gap, not to migrate generally: none · low · medium ·
high · unknown.

OUTPUT: JSON array, one object per baseline capability in the order given, to <path>:
{"baseline_capability_id", "verdict", "confidence", "effort", "target_capability_ids": [every target
capability carrying any part of this; empty for gap; ids must exist in the index], "evidence": two to
four sentences naming specific target capabilities and mechanisms and quoting or closely paraphrasing the
requirement that decides the verdict — this field is the deliverable, the verdict is its label,
"gap_detail": what specifically is missing in baseline terms (empty for native), "migration_note": what
the organisation would actually do — configure X, accept the process change, wait for GA, build, descope}.

CALIBRATION. <Write two to four paragraphs specific to this pair, e.g.:> The two configuration philosophies
differ: <baseline> cascades defaults onto transactions, <target> hangs behaviour off <template object>;
many settings therefore land as configurable with "the answer is more templates" — but a baseline
requirement for per-transaction override of a defaulted value that the target only offers per-template
is partial, not configurable. Do not credit the target for platform features its documentation never
mentions; a generic platform security model is not a lending security model. Do not penalise a different
mechanism reaching the same outcome — judge outcomes, not screens. Baseline capabilities that were never
built (maturity planned) are cheaper news when they gap; score honestly either way, the maturity column
lets the reader weigh it. The target has things the baseline does not; they are handled separately — but
if one of them satisfies a baseline capability, cite it.

Return a one-line summary: row count, verdict distribution, and the two or three findings you would put
in front of a decision maker.
```

### Integration mapping brief (integration mode)

```
# Integration map brief — <SYSTEM A> and <SYSTEM B> coexisting
THE QUESTION: both systems will run. For each capability in the union list, which system should own it,
where do they overlap, and what has to flow between them? INPUTS: union package <path> (each entry names
the capability and the ids each system contributes), both models' indexes and requirements CSVs <paths>,
the documents describing the intended relationship <paths> — read those first; the intended division of
responsibility is usually stated and your job is to test each capability against it.

OUTPUT per entry: {"capability_key", "name", "layer_id", "systems": {"<A>": [ids], "<B>": [ids]},
"overlap_type": exclusive · duplicate · complementary · handoff, "proposed_owner": system code or "split",
"integration_need": none · reference data · event · transaction · bidirectional sync, "data_flow": one
sentence naming what moves in which direction and when, "effort", "confidence", "evidence": which
requirements on each side establish the overlap and why the ownership follows, "notes": conflicts with
the stated intent, open questions}. Score duplicates hardest: two systems both believing they own a
status, a price or a customer record is where integrations fail. Return a one-line summary with the
duplicates you would escalate.
```

---

## Pitfalls seen in practice

- **Fidelity is the product.** The moment an agent adds what the platform "obviously" does, the model
  stops being evidence about the documentation and becomes opinion. Every brief says so; say it again in
  the task message for any layer where the documentation is thin.
- **Thin layers are findings.** Credit, security, reporting and signature were each reduced to a passing
  mention on the reference run. Recording that precisely — "the introduction promises to explain credit
  checks and the article never returns to it" — was more useful than anything a fuller layer produced.
- **Do not share status vocabularies across systems**, and do not put `absent` on any system's own
  capabilities; it belongs only to the fit/gap.
- **Contradictions between sources are recorded, never resolved.** A dozen appeared on the reference run,
  mostly about where a setting lives. Each is one absence-status requirement naming both sides and a
  question for the vendor or the preview environment.
- **Target-only is a separate pass.** Compute uncited target capabilities after grading; do not let
  graders force them into baseline rows.
- **`partial` will dominate the fit/gap** — 76% on the reference run — because "yes, but" scores partial by
  design. The count is near meaningless alone; the readout must say so and give the filters that matter
  (`maturity = proven` with `effort` high or unknown; `confidence = low`).
- **Agents drift on `option_scope`** for the same object. Name the system's setup objects in the brief and
  normalise after merge.
- **Keep numeric worked examples.** They survive every summarisation step and they pin down semantics.
- **Verify every count you write** in a data dictionary or readout with a script. One wrong number
  discredits the set.
- **Validators have bugs too.** A single-group `re.findall` returns strings, not tuples; a check that fails
  on good data wastes an hour. Test a new check against known-good data before trusting a FAIL.
- **Working directories reset.** Use absolute paths; keep everything under one `build/` and one `deliver/`
  root; the deliverables on the user's device are the durable copy.
- **The container may be reclaimed between turns.** Deliver and commit to the user's folder as soon as a
  full set exists; re-stage from there if you need to continue.
