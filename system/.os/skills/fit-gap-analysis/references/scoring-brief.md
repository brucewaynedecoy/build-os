# Scoring Brief Template

Copy the block below to `<root>/build/fit-gap-analysis/SCORING_BRIEF.md`. Replace every `<placeholder>`. Write the calibration paragraphs yourself. Point every grader at the file. Do not paste a summary of it into the task message: a grader that reads the whole brief follows it more faithfully.

```text
# Scoring brief: <BASELINE NAME> scored against <TARGET NAME>

THE QUESTION. For each <BASELINE NAME> capability in your package: if this organisation
<moved to / chose> <TARGET NAME>, what would happen to each of its requirements? This feeds a platform decision. Someone will plan
against your marks. A wrong `met` is worse than a cautious `partly`. Be conservative and show evidence.

OBJECTIVES. The project's confirmed objectives are in <path to objectives.md>. You link each capability to
the objectives that depend on it.

INPUTS — use these and nothing else:
- Your package: <path to packages/pkg-NN.json>. Each capability carries its full requirement list. Some
  carry `prior`: an earlier capability-level verdict. Treat it as a lead, not an answer. Check every claim.
  Its verdicts use older words: `preview_gap` there is close to `unreleased` here.
- Target capability index: <path to target-index.json>.
- Target requirements: <path to target-requirements.csv>. This is the evidence base. Search it by keyword
  before you mark anything. A keyword absent from every target requirement is strong evidence of
  `not_met`. A keyword present still needs reading.
- Target narrative: <path to the target Capability Model .md, or "none">.
- Target source dumps for exact wording: <paths, or "none">.
Do not add knowledge of <TARGET NAME> from outside these files.

METHOD, for each capability:
1. Read the capability summary and every requirement.
2. For each requirement, search the target requirements by its key terms and their synonyms. Read the
   matching target capabilities.
3. Mark the requirement with exactly one of:
   - met: the target does this out of the box, at comparable depth. The user would recognise it.
   - configured: the target does this after setup or configuration, with no code. The note names the
     configuration.
   - partly: the target does part of this, or a weaker version. The note says what is missing.
   - unreleased: the target sources name this, but it is not in the release assessed (roadmap, deferred,
     a cross-link to a missing document). The note says where it is named. If the sources never name
     it, the mark is not_met.
   - not_met: no counterpart in the target sources. The note says which terms you searched.
   Cite the target capability ids that carry the requirement. Cite capabilities, not target requirements.
   met, configured and partly need at least one citation. not_met has none. unreleased may cite the
   roadmap capability that names it. Every mark except met needs a note of at least 15 characters.
4. Link the capability to the objectives that depend on it (zero or more). Do not link everything to
   a must objective: that flattens the priority list.
5. Set confidence: high (the sources speak directly to the deciding marks), medium (some deciding marks
   rest on inference from nearby documentation), low (the sources are silent or unclear; a documented
   low beats a confident guess).
6. Set effort to close the gap, not to migrate in general: none (nothing to do), low (configuration or a
   small process change; days), medium (several configurations, data work or a small extension; weeks),
   high (a custom build, an ISV product or a large process change; months), unknown.
7. Write:
   - evidence: two to four sentences naming the target capabilities and mechanisms that decide the
     result, quoting or closely paraphrasing the deciding target requirement. This field is the
     deliverable.
   - gap_detail: what is missing in baseline terms, with requirement ids. Empty only when every mark
     is met.
   - migration_note: what the organisation would actually do: configure X, accept the process change,
     wait for GA, build, buy, descope.

The verdict, fit score and priority are computed from your marks by BuildOS. Do not write them. For
your awareness: all met is native; all met or configured is configurable; all unreleased is unreleased;
only not_met and unreleased is gap; anything else is partial.

OUTPUT. A JSON array, one object per capability in package order, to <path to scored/pkg-NN.json>. No
wrapper, no commentary. Check that it parses before you finish.
{"baseline_capability_id", "objective_ids": [], "confidence", "effort",
 "marks": [{"requirement_id", "mark", "target_capability_ids": [], "note"}],
 "evidence", "gap_detail", "migration_note"}
Every requirement in the package gets exactly one mark. Ids must exist in the package and the index.

CALIBRATION.
<Write two to four paragraphs specific to this pair. Examples of what belongs here:
- Where the two configuration philosophies differ. For example: the baseline cascades defaults onto each
  transaction, the target hangs behaviour off a template object. A setting the target offers per
  template is configured. A baseline requirement for per-transaction override that the target offers
  only per template is partly.
- Judge outcomes, not screens. A different mechanism that reaches the same outcome is met or configured.
- Do not credit platform features the target documentation never mentions.
- Baseline capabilities that were never built (maturity planned) are cheaper news when they miss. Mark
  them honestly anyway. The maturity factor weighs them.
- Name the target's setup objects and its thin areas, so graders know where silence means "not
  documented" rather than "not there".>

Return a short summary: capability count, mark counts, any source conflicts you found, and the two or
three findings you would put in front of a decision maker.
```
