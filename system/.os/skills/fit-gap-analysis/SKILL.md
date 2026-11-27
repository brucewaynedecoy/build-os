---
name: fit-gap-analysis
description: "Score a requirement-level fit-gap analysis of one system against another, against the project's confirmed goals and objectives, and deliver it as a detailed Excel workbook with prioritised gaps, a decision list and target-only opportunities. Use when both systems already have capability-matrix models and the user wants a fit-gap workbook or spreadsheet, a fit-gap scored against goals or objectives, prioritised gaps, or the workbook rebuilt after changing objectives, weights or scores. Not for building capability models, data dictionaries or capability model documents, not for the capability-level fit/gap readout, and not for integration overlap: use capability-matrix for those, and run it first when either model is missing."
---

# Fit-Gap Analysis

## Job

Score one baseline system against one target system, one requirement at a time, against the project's objectives. Deliver the result as an Excel workbook and the JSON it is built from.

The `capability-matrix` skill builds the models. This skill does not build or change models. It only scores and reports.

Use something else when:

- A system has no capability model yet. Run `capability-matrix` for it first.
- The systems will run side by side and the question is "which system owns X". That is capability-matrix integration mode.

For several candidate targets (selection), run this skill once per candidate, with the same baseline and objectives. Each pair gets its own build folder.

To rebuild the workbook after a change to the objectives, weights or scores, go to step 6.

## Inputs

| Input | Where to find it | Needed |
| --- | --- | --- |
| Baseline model | capability-matrix `deliver/<CODE>/<code>-capability-model.json`, or for an older run the `<code>-capabilities.csv` and `<code>-requirements.csv` pair | Yes |
| Target model | The same, for the target system | Yes |
| Objectives | The project's own documents, then the person's confirmation | Yes |
| Target narrative | capability-matrix `deliver/<CODE>/<Target Name> - Capability Model.md` | Strongly recommended, for graders |
| Target source dumps | capability-matrix `build/sources/<code>/` | Recommended, for exact wording |
| Prior fit/gap | capability-matrix `deliver/fit-gap/<a>-<b>-fit-gap.json` or `.csv` | Optional. Graders treat it as a lead, not an answer. |

## Names Used Below

| Name | Means |
| --- | --- |
| `<project>` | The BuildOS project folder, the one that holds `.os/` |
| `<buildos>` | The project wrapper `<project>/.os/scripts/buildos` (`<project>\.os\scripts\buildos.cmd` on Windows) |
| `<root>` | The folder that holds the capability-matrix `deliver/` and `build/` folders. It is inside `<project>`, and is usually `<project>` itself. |
| `<a>`, `<b>` | The baseline and target codes, in lower case, such as `circ` and `lib` |
| `<build>` | `<root>/build/fit-gap-analysis/<a>-<b>`, the working folder for this pair |
| `<frame>` | `<build>/frame.json` |
| `<deliver>` | `<root>/deliver/fit-gap-analysis` |

Use absolute paths in every command and in every sub-agent task message, because the working folder can reset between calls. Never write into the capability-matrix folders.

The tool is the `buildos fitgap` command, run through `<buildos>`. It needs Node.js 24 or newer and nothing else. Every command below takes `--root "<project>"`. Write each command on one line, and keep the double quotes around `<buildos>` and every path: an absolute path can hold a space, and Command Prompt reads neither a `\` line break nor single quotes. It reads only files inside `<project>`, and it writes outside `<project>` only with `--allow-outside-root`; use that only when the person asks for an output outside the project.

## Outputs

```text
<deliver>/
  <a>-<b>-fit-gap-analysis.xlsx    the workbook (11 sheets; 13 with a delivery plan)
  <a>-<b>-fit-gap-analysis.json    the scored data; the workbook is built from it
<build>/
  frame.json                       systems, mode, objectives, scoring, optional tracks and owners
  packages/pkg-NN.json             grader inputs
  target-index.json                target capabilities, for graders
  target-requirements.csv          target requirements, the graders' evidence base
  objectives.md                    the confirmed objectives, for graders
  SCORING_BRIEF.md                 the filled-in grader brief
  scored/pkg-NN.json               grader outputs
  uncited.json  only.json          the target-only pass
  todos.json                       the to-do list, when the frame has tracks
  findings.json                    the lead's findings
```

The file formats, the verdict table and the score formulas are in `references/formats.md`. Read it before step 1.

## Steps

Make a task list with these eight steps before you start. The run is long, and the person checks progress.

### 1. Find the models and write the frame

1. Search the project for `*-capability-model.json`. For an older run, search for `*-capabilities.csv`.
2. Tell the person which system you take as the baseline and which as the target, and the mode (`replacement` or `selection`). The baseline is the system whose capabilities get scored: in a replacement, the system in use today.
3. Write `<frame>` with no objectives yet.
4. Run `"<buildos>" fitgap frame --root "<project>" --frame "<frame>"`. Fix every `FAIL`. It warns that there are no objectives; step 2 fixes that. An older CSV run needs a `maturity_map` only when its CSVs have no `maturity` column.

### 2. Get the objectives confirmed

The objectives set the priority of every row. A wrong weight reorders the whole decision list. So the person confirms them before any scoring starts.

1. Read what the project says about its goals. Look in this order:
   - In a BuildOS project: `docs/` if the project has it (charter, PRD, statement of work, goals; it exists when Make Docs is set up), the description in `.os/config/instance.yaml`, and notes in `workspace/`.
   - The capability-matrix notes: `build/intake.md` and `build/<code>/index.md`, which record what the comparison is for.
   - The baseline narrative, Part I.
2. Draft 4 to 10 objectives. Each one is an outcome the project must deliver, not a feature. Give each an id (`OBJ-01`), a name, a statement, a weight, a measure of success and the source you took it from.
   - `must`: the project fails without it. Keep `must` to about a third of the list.
   - `should`: important, but a trade-off is allowed.
   - `could`: nice to have.
3. Show the person the objectives as a table with your proposed weights. Ask them to confirm or change them. **Stop here until they answer.**
4. Write the confirmed objectives into the frame, and the person's name into `objectives_confirmed_by`. Run `frame` again.

An objective that no capability can serve, such as cost or timeline, still goes in. The workbook shows it with no linked capabilities. Say so in the report.

If the person ranks objectives more finely than must, should and could, keep the weight and add `rank` (1 = most important); rank breaks priority ties.

**Optional delivery plan.** When the person wants phases or a split of work between parties, add `tracks` and `owners` (and `owner_roles`) to the frame. Take the owner names from `owners[].name` in the project config `.os/config/instance.yaml` when it lists the parties; add a party it does not list only when the person confirms it. The To-Dos sheet colors each owner from `<project>/.os/skills/fit-gap-analysis/config/owner-colors.json`, in owner order; the frame may set `owner_colors` instead. Then give every scored row a `track` and `owners`, and write `<build>/todos.json` (format in `references/formats.md`). The workbook then adds Roadmap and To-Dos sheets. Confirm the tracks and owners with the person like the objectives.

### 3. Make the scoring packages

Run `"<buildos>" fitgap packages --root "<project>" --frame "<frame>" --out "<build>"`.

It refuses to run with no objectives. It splits the baseline capabilities, in model order, into packages of about 180 requirements (change it with `--max-requirements`). A package can hold more than one layer. It also writes `target-index.json`, `target-requirements.csv` and `objectives.md`.

### 4. Score the packages

1. Read Part I and the design principles of both narratives, if they exist. You need them for the calibration paragraphs.
2. Write `<build>/SCORING_BRIEF.md` from `references/scoring-brief.md`. Fill every placeholder with an absolute path or a name. Write the 2 to 4 calibration paragraphs yourself, from your own reading of where the two systems differ.
3. Send one sub-agent per package, all in one message, so they run at the same time. Keep each task message short:
   - Read `<build>/SCORING_BRIEF.md` in full and follow it.
   - Your package: `<build>/packages/pkg-NN.json`. Your output: `<build>/scored/pkg-NN.json`.
   - Two to four sentences of guidance for this package: where the systems differ in these layers, which target capabilities matter most, which sources are thin.
4. With no sub-agents, score the packages yourself, in order, against the same brief. The brief is the quality control, not the parallel work.
5. When they return, check them with `merge --draft` and no `--only` (step 6 shows the command). Fix every `FAIL`. Send failing rows back to the agent that wrote them, or fix them yourself. Never weaken a mark only to pass a check.

### 5. Do the target-only pass

1. Run `"<buildos>" fitgap uncited --root "<project>" --frame "<frame>" --rows "<build>/scored/*.json" --out "<build>/uncited.json"`. Keep the quotes: BuildOS expands the pattern itself.
2. Write `<build>/only.json`: one row for each uncited target capability. These are things the target has that the baseline never asked for. Write them as opportunities, not risks. You write them yourself, because there are few and they need judgment. Read each one in the target narrative first.

If you change any marks later, run this step again: the uncited set can change.

### 6. Merge the draft and check it

Run:

```text
"<buildos>" fitgap merge --root "<project>" --frame "<frame>" --rows "<build>/scored/*.json" --only "<build>/only.json" --out "<deliver>" --draft
```

Then read the result before you write any findings:

1. Look at the verdict counts, the top priorities, the decision list and the objectives with the lowest average fit.
2. Spot-check 5 rows. The evidence must name a target mechanism, not only claim support. The marks must match the evidence.
3. Spot-check 5 `not_met` marks. Search `<build>/target-requirements.csv` yourself for their key terms.
4. `merge` prints the average fit for each scored file. If one file is much higher or lower than its neighbours with no clear reason, check it for a generous or harsh grader, and score it again if needed.

### 7. Write the findings

Write `<build>/findings.json` (format in `references/formats.md`):

- `headline`: 3 to 7 findings that a decision maker would act on. Each one carries a number from the data.
- `layers`: one finding per baseline layer, 2 to 4 sentences.
- `opportunities`: what the target brings. Use the target-only rows, and also the target extras inside cited capabilities that the baseline never had.
- `open_questions`: questions for the vendor or the other team. Use the low-confidence rows and every source conflict the graders noted.

Take every number from the merged JSON. Compute it. Do not estimate it.

### 8. Build the final workbook

1. Run the step 6 `merge` again, without `--draft` and with `--findings <build>/findings.json` (and `--todos <build>/todos.json` when the frame has tracks). It refuses until the objectives are confirmed, every uncited target capability has a row, the findings are complete and, with tracks, the to-do list is valid.
2. Run `"<buildos>" fitgap workbook --root "<project>" --frame "<frame>" --fitgap "<deliver>/<a>-<b>-fit-gap-analysis.json"`.
3. Every check must print `PASS`.

After any later change to the frame, the scored rows, `only.json`, `todos.json` or `findings.json`, run the steps from 5 again. The workbook is always built from the JSON, never edited by hand.

**After a review by the person.** Start from the scored rows they reviewed, not a fresh scoring. Change only the marks their comments or new sources affect, and give each changed mark a note naming the review. Mark a requirement `descoped` only when they decided it is not needed in the target.

## Done When

- `merge` passes without `--draft`. That means every baseline requirement has a mark, every capability has evidence, every uncited target capability has a target-only row, the findings are complete and the objectives are confirmed.
- `workbook` prints `PASS` for every check.
- You spot-checked 5 rows and 5 `not_met` marks, and fixed what you found.

## Report

Tell the person:

- the paths of the workbook and the JSON
- the 3 findings you would put in front of a decision maker
- the objectives with the lowest coverage, and any objective with no linked capabilities
- how many rows are listed for a decision, and how many open questions go to the vendor
- anything you could not check

Do not recap the steps.

## Rules

- **Fidelity.** A mark rests only on the target model and its sources. Do not add what the target platform "obviously" does. A wrong `met` is worse than a cautious `partly`, because someone will plan against it.
- **BuildOS decides.** The verdict, fit score, priority and decision flags come from `buildos fitgap`. Never write them by hand. To change a verdict, change the marks, with evidence.
- **Models are read-only.** If a model is wrong or thin, stop and tell the person to fix it with `capability-matrix`. Do not patch it here.
- **Objectives come from the person.** You draft them. The person confirms them.

## Pitfalls

- **`partial` dominates.** One "yes, but" makes a capability `partial`, so expect most rows there. The fit score and the priority tell a small partial from a large one. Say so in the report.
- **Linking every row to a `must` objective** flattens the priority. When you review the scored rows, look for a grader who linked almost everything to one objective.
- **Grader drift.** Agents differ in strictness. The per-file fit check in step 6 catches it.
