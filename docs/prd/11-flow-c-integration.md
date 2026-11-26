# 11 Flow C Integration

## Purpose

This subsystem is the user-gated hand-off from a qualified finding into the planning/engineering leg, crossing into the make-docs target docs without modifying them.

## Scope

Covered here: the qualified-finding → design promotion and how it obeys the make-docs design router. The downstream plan → PRD → work pipeline is make-docs' own; this subsystem only provides the on-ramp.

Code anchors:

- `toolkits/buildos/`
- `system/workspace/findings/`
- `docs/designs/`

## Component and Capability Map

| Component | Capability |
| --- | --- |
| `buildos design promote` | Take a qualified finding into a design under `docs/designs/` |
| Promotion hand-off | Pass finding id, qualification anchor, and configured scope metadata into the design |
| Finding traceability | Record accepted design links back on the qualified finding and findings index |
| Forward-routing | The finding contract's "Next Step" points at the make-docs design router and downstream planning route |

Code anchors:

- `system/.os/contracts/` (finding contract)
- `toolkits/buildos/`

## Contracts and Data

Promotion is user-gated: a qualified finding is not auto-promoted. The hand-off reads the make-docs design workflow, contract, and template, then writes only through that router, passing the finding id, origin run, raw finding anchor, qualification anchor, and configured `systems`, `environments`, and `owners` lists. Nothing under the project's Make Docs `docs/**` tree is written outside the make-docs router (`PB-001`).

Promotion needs five Make Docs inputs: the design router `docs/designs/AGENTS.md`, the design workflow, the design contract, the design template, and the next prompt of the route (`designs-to-plan.prompt.md` or `designs-to-plan-change.prompt.md`). It resolves each one in this order:

1. The Make Docs 2.0.9 layout: `.make-docs/system/references/design-workflow.md`, `.make-docs/system/contracts/design-contract.md`, `.make-docs/system/templates/design.md`, or `.make-docs/system/prompts/<prompt>`. The router is `docs/designs/AGENTS.md` in both layouts. Make Docs 2.0.9 setup with `--project-resources all`, as `buildos init --make-docs` runs it, writes these bodies. When a file is there, it decides: a body with text is used; an empty body stops promotion with exit code `3` (step 3, "empty"); a body over 4 MiB stops it with exit code `1` and the size message; any other read failure stops it with exit code `1` and the read error. Promotion never falls back from such a file to a legacy body. Only a missing entry, a dangling link, or a folder at the name goes on to step 2.
2. The legacy location under `docs/assets/` (`references/`, `templates/`, `prompts/`), when the project has that layout (one of those three folders exists). Promotion then reads it with the Go error text and exit code `1`, so Go-era projects keep their results.
3. Otherwise promotion stops before any write with exit code `3`. The message names the input, its path, and whether it is missing or empty, and says what to do, by the rules `buildos init` uses for the folder that holds the BuildOS content (the project root, or `system/` in the repository layout). When that folder has a root `AGENTS.md` or `CLAUDE.md` with no Make Docs section, the tested Make Docs version cannot set it up, so the message says so and gives no command. Otherwise it says whether Make Docs is set up there (a `.make-docs/` folder) with a file missing, or not set up, and gives the Make Docs setup command that `buildos init` shows for a later setup, which puts the files back or sets Make Docs up. For an empty file, the message says that Make Docs keeps a changed copy of a file it manages (its setup then reports `"status": "blocked"` and changes nothing) and that BuildOS does not change the file either, and the steps are: delete the file, then run the setup command. When Make Docs is set up, the message also says that in a copied or moved project folder Make Docs stops that command with "Checkout identity needs a path choice." and gives its own next step, which comes first. BuildOS cannot see that case, because Make Docs keeps the checkout identity in its Store.

Promotion never starts `make-docs` to read a missing body. In the repository layout every path above has the `system/` prefix. Every input, in both layouts, is read inside the project only and up to 4 MiB, with or without `--allow-outside-root`: a link is read only when it leads to a regular file inside the project, and a link that leads out of it stops the command with exit code `3`. The message says that BuildOS reads the file only inside the project; it does not offer the write switch. The one exception keeps a write-destination case: with `--allow-outside-root`, when the designs folder itself is a link out of the project (the folder the design is written to), the router `AGENTS.md` in it is read through that link, as the earlier Go tool read it. The entity data that promotion resolves the finding from is read inside the project too; only the findings index, which promotion replaces and never writes through, may be a link at its own name to a file outside the project.

The deterministic hand-off is:

```sh
buildos design promote finding --finding-id <FIND-NNN> --route baseline-plan|change-plan [--title <text>] [--slug <slug>] [--repo-root <path>] [--dry-run]
```

The legacy `buildos-design` name still runs this command until `0.3.0` ([PRD 20](./20-buildos-cli-and-distribution.md#legacy-command-names)).

Promotion resolves the requested finding ID to one terminal `qualified` finding through the shared resolver in [17 Entity Identity and Canonical Resolution](./17-entity-identity-and-canonical-resolution.md#contracts-and-data). It reports the requested ID, the canonical ID, and the resolution chain. It writes the design back-reference only to the canonical finding.

The written design follows the design template that promotion read:

- A template from the Make Docs 2.0.9 layout gives the Make Docs 2.0.9 form, built from the project's own template and checked against the project's own design contract. The frontmatter is the template's, with `title`, `follow_on.route`, `follow_on.next_prompt` (`make-docs://system/prompt/<prompt>`), `follow_on.why`, and `follow_on.coordinate_handoff` filled and the template's comment lines left out. Then come `# <title>` and every `##` section of the template, in the template's order. Purpose, Context (the finding, origin run, qualification, raw anchor, `systems`, `environments`, `owners`, and the finding summary and observation), Decision, Alternatives Considered, Consequences, and Intended Follow-On carry the finding's facts; every other section, such as Human Experience Intent, is the template's own text, unfilled, for the planner. The Next Prompt line has a relative link to the prompt file promotion read, so it resolves, and the `make-docs://` URI. No text names `system/docs/`.
- A template from the legacy `docs/assets/` layout gives the earlier Go text, byte for byte.
- A template or contract of a form this BuildOS version does not know stops promotion before any write with exit code `3` and says so. BuildOS checks the template before it puts in any value: its frontmatter lines are the 2.0.9 lines exactly, each value BuildOS fills double-quoted; the contract's required headings are the 2.0.9 list in the 2.0.9 order, and the template holds them in that order; every placeholder is one the 2.0.9 template has, in the section where the 2.0.9 template has it; the follow-on lines are there once each, and the Next Prompt line is the 2.0.9 line exactly, so the prompt link goes where the design contract wants a relative Markdown link. After it fills the template, BuildOS checks that the Next Prompt line is that relative link. BuildOS never writes a design that does not match the project's Make Docs form.
- Values are put in once. A finding title or other finding text that holds `{{...}}` stays as text. The frontmatter title is a YAML double-quoted value with every character outside YAML's printable set escaped, so it reads back as the exact title. The `# <title>` line is one line: line breaks become spaces, and a leading `#` is escaped. In each section BuildOS fills, a fenced code block in the finding text (with a closing fence) is kept byte for byte, so an example keeps its meaning; outside such blocks, a line start that Markdown reads as a heading, a setext underline, a code fence with no closing fence, or an HTML block is escaped with a backslash, so finding text can never add, hide, or move a section. BuildOS reads the result back (the frontmatter with its YAML subset reader and a strict double-quoted reader, and the title and section headings) and writes nothing when the check fails (exit code `3`).

Current limitation: `buildos design promote` still writes the design file under `docs/designs/` itself. That path is owned by Make Docs, so this behavior conflicts with the boundary in `## Integrations`. The conflict is tracked as `R-009` in the [risk register](./03-open-questions-and-risk-register.md). The next step is to ask Make Docs for a public design-create operation and then move promotion onto it.

The `baseline-plan` route prepares a design for a fresh baseline planning flow. The `change-plan` route prepares a design for additive planning against the active PRD namespace. Both routes preserve the qualified finding as the evidence record and let the design own solution framing, tradeoffs, and downstream planning context.

Code anchors:

- `system/playbooks/administrative/respect-make-docs-plugin-boundary.md`
- `system/.os/scripts/`
- `toolkits/buildos/`

## Integrations

Consumes qualified findings (`10`); enters the make-docs pipeline in the project's `docs/` tree (designs → plans → prd → work). The hand-off may be invoked directly by an operator or by later stage-mover automation (`12`), but the P7 contract does not require Flow D automation to exist.

Make Docs is a separate product. BuildOS ships no Make Docs content. Make Docs is set up in a project only through its public CLI, and only after the user chooses it during `buildos init` ([PRD 20 Make Docs Companion Setup](./20-buildos-cli-and-distribution.md#make-docs-companion-setup)). BuildOS writes no Make Docs-owned files and no Make Docs global state. The one current exception is design promotion, described as a current limitation in `## Contracts and Data`.

Code anchors:

- `make-docs://system/reference/design-workflow.md`
- `make-docs://system/contract/design-contract.md`
- `make-docs://system/template/design.md`

### Change Notes

- 2026-11-23 (W1 R7): Make Docs setup and the no-write boundary are now stated in the body of this section. See `## Requirement History`.

## Rebuild Notes

Never bypass the make-docs router to write a design directly. Keep promotion a deliberate, user-gated act, carry the qualification anchor so the design traces back to reproducible evidence, and keep stage automation separate until PRD 12 work introduces it.

Code anchors:

- `docs/designs/`
- `system/.os/contracts/finding-contract.md`

## Requirement History

### 2026-11-24 — W1 R7 P7 final check

- Affected requirement or section: `## Contracts and Data` (the written design in the 2.0.9 form)
- Previous contract: Only the presence of the follow-on lines and the placeholders of the Next Prompt line were checked, so a template with the Next Prompt placeholder inside inline code, or with an unknown placeholder on another follow-on line, was accepted, the unknown placeholder was dropped, and the prompt link was written as code. Every code fence in finding text was escaped, so a fenced example lost its meaning.
- Replacement contract: Every placeholder of the template must be a 2.0.9 placeholder in its 2.0.9 section, each follow-on line must be there once, and the Next Prompt line must be the 2.0.9 line exactly, or promotion stops with exit `3` before any write; after filling, the Next Prompt line is checked to be the relative link. A balanced fenced code block in finding text is kept byte for byte; only headings, setext underlines, unclosed fences, and HTML block openers outside such blocks are escaped.
- Rationale: Final check of W1 R7 P7 (P7-F-05, P7-F-06). Parity exception PE-020 covers the 2.0.9 form; a design for an ordinary finding is byte for byte as before.
- Source: [P7 Final Check](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-final-check)

### 2026-11-24 — W1 R7 P7 review round 4 (closing check)

- Affected requirement or section: `## Contracts and Data` (the written design in the 2.0.9 form)
- Previous contract: The template's frontmatter keys were checked, not the quoting of each value, and the contract's required headings were checked for presence, not order. Placeholders were checked after the finding's values were put in, and finding text went into the design as written.
- Replacement contract: The template's frontmatter lines and the contract's required headings and their order must be the 2.0.9 form, checked before any value is put in; values are put in once; the title is escaped for YAML and is one Markdown line; block openers in finding text are escaped; the result is read back before any write.
- Rationale: Closing check of W1 R7 P7 Stage 6 (P7-R4-04, P7-R4-05): a single-quoted template title with an apostrophe gave invalid YAML with exit `0`, a moved section passed, a title with `{{x}}` stopped promotion, and a multi-line title made two Decision sections. Parity exception PE-020 (the same form).
- Source: [P7 Review Round 4](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-4-closing-check)

### 2026-11-24 — W1 R7 P7 Stage 6

- Affected requirement or section: `## Contracts and Data` (the written design)
- Previous contract: Promotion wrote the earlier Go text in every project: no frontmatter, no `## Human Experience Intent` section, a Next Prompt link `../assets/prompts/<prompt>`, and the source path `system/docs/designs/` in its text.
- Replacement contract: A design template from the Make Docs 2.0.9 layout gives the 2.0.9 form, built from the project's template and checked against its contract; the Human Experience Intent section is the template's text for the planner; the Next Prompt link resolves; a template or contract of an unknown form stops promotion with exit `3`. A legacy template keeps the Go bytes.
- Rationale: The owner chose option B for register `R-009` on 2026-11-24: every design promoted in a Make Docs 2.0.9 project broke the 2.0.9 design contract. Parity exception PE-020.
- Source: [P7 Stage 6](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-stage-6)

### 2026-11-24 — W1 R7 P7 review round 3

- Affected requirement or section: `## Contracts and Data` (input order step 1, step 3, and input reads)
- Previous contract: An empty or over-limit 2.0.9 body counted as missing and could fall back to a legacy body; an empty file got the same setup command as a deleted one; `--allow-outside-root` let every design input be read through a link out of the project; the entity data was read through any link.
- Replacement contract: A file at a 2.0.9 location decides: empty stops with exit `3` and the delete-then-setup steps, over 4 MiB or unreadable stops with exit `1`. The copied-project case is named. The switch does not widen input reads, except for the router in a designs folder that is a link out (a write destination). The entity data is read inside the project, except a link at the findings index itself.
- Rationale: Review findings P7-R3-03, P7-R3-05, and P7-R3-06, checked with Make Docs 2.0.9: an empty managed file blocks its setup (`"status": "blocked"`, exit `0`), and a copied project needs a checkout-identity choice.
- Source: [P7 Review Round 3](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-3)

### 2026-11-24 — W1 R7 P7 review round 2

- Affected requirement or section: `## Contracts and Data` (Make Docs input order, step 3, and input reads)
- Previous contract: A missing input always gave the Make Docs setup command for the project root, also where Make Docs 2.0.9 refuses that folder and in the repository layout. Inputs were read through any link, with no size bound.
- Replacement contract: The stop tells three cases apart by the `buildos init` rules and targets the folder that holds the BuildOS content; where Make Docs cannot be set up, it says so and shows no command. Inputs are read inside the project, up to 4 MiB, and a link out of the project stops with exit `3` unless `--allow-outside-root` is given.
- Rationale: Review findings P7-R2-02 and P7-R2-03: after `buildos init --skip-make-docs`, the printed command failed, and a link could lead the read out of the project.
- Source: [P7 Review Round 2](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-2)

### 2026-11-24 — W1 R7 P7 review round 1

- Affected requirement or section: `## Contracts and Data` (design promotion inputs)
- Previous contract: Promotion read the design workflow, contract, template, and next prompt only from `docs/assets/`, the layout of the Make Docs copy that the package once shipped.
- Replacement contract: Promotion reads each input from a valid local Make Docs 2.0.9 body under `.make-docs/system/` first, then from the legacy `docs/assets/` layout with the Go behavior, and otherwise stops with exit `3`, the missing input, and the Make Docs setup command. It never starts `make-docs`.
- Rationale: Make Docs 2.0.9 keeps these files under `.make-docs/system/`, so promotion failed in every project set up with `buildos init --make-docs` (review finding P7-R1-05, register `R-009`).
- Source: [P7 Review Round 1](../work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p7-review-round-1)

### 2026-11-23 — W1 R7

- Affected requirement or section: `## Integrations`, `## Contracts and Data` (Make Docs boundary and design promotion)
- Previous contract: The source package shipped a copy of Make Docs content under `system/docs/`. The `buildos-design` hand-off read that copy's design router and wrote the design under `system/docs/designs/`.
- Replacement contract: BuildOS ships no Make Docs content. Make Docs is set up only through its public CLI, after the user chooses it during `buildos init`. BuildOS writes no Make Docs-owned files, except that `buildos design promote` still writes a design under `docs/designs/` as a stated current limitation, tracked as `R-009`.
- Rationale: Make Docs owns its content and sets itself up. Promotion keeps its behavior for output parity until Make Docs offers a public design-create operation.
- Source: [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)

### 2026-11-23 — W1 R8

- Affected requirement or section: `## Contracts and Data`, hand-off scope metadata
- Previous contract: The Flow C hand-off passed `env`/`for` tags as the scoped metadata of a promoted finding.
- Replacement contract: The hand-off passes the configured `systems`, `environments`, and `owners` lists with the finding ID and the qualification anchor.
- Rationale: The config surface replaced the fixed tags. The prior contract was kept only in a pointer note.
- Source: [PRD Set Authority design](../designs/2026-11-23-prd-set-authority-cleanup.md)

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `.make-docs/archive/work/2026-06-03-w1-r0-build-os-baseline/07-flow-c-integration.md`
- `docs/prd/13-adopter-owned-config-surface.md`
- `.make-docs/archive/prds/2026-11-23/16-revise-toolkit-ownership-boundaries.md`
- [BuildOS Node and TypeScript CLI Rewrite](../designs/2026-11-23-buildos-node-typescript-cli-rewrite.md)
