# Keep the record clean

This page explains why your record files fill up with duplicates, why deleting them is the wrong fix, and what BuildOS does instead.

## What you need first

Read [Pull knowledge out of it](07-pull-knowledge-out-of-it.md) first. This page assumes you have entity records in `.os/data/` and know what a record's `id`, `status`, and `related[]` fields are for. A `[]` on the end of a field name means that field holds a list. You do not need to have finished extracting before you read this, and reading it early saves work later.

## Why duplicates happen

Run extraction over two documents that overlap, or over the same document twice a month apart, and you get the same thing recorded more than once under more than one name. That is the process working normally, rather than a sign that anybody made a mistake.

Personas show it most clearly. A round of intake can end with several times as many personas as were intended, and a second pass over vendor material can push the count higher again. Different job titles in different documents each mint their own record, and a vendor capability list adds more. Everyone follows the procedure correctly and the file still ends up a mess.

The same thing happens to capabilities and requirements, where it goes unnoticed for longer because nobody counts those out loud.

Take two counts early, before the volume makes it painful:

- How many records of each type do you have?
- How many of those describe the same thing?

Ask your agent for both as a table. Do not open the `.jsonl` files yourself.

## Why you must not delete them

The obvious fix is to keep the good rows and delete the rest, and it is the wrong move.

Other records point at the ones you would delete. A requirement's `related[]` names a capability, and a test case's `verifies[]` names a requirement. Findings carry `basis_refs[]` pointing at whatever they were based on. Every ID an extraction minted is listed on the extraction row. Delete a record and each of those pointers now names nothing.

The fear is easy to name: I don't want to forget something, and the model is not going to be smart enough to update it everywhere. That instinct is right, and it is why consolidation waits for a mechanism that cannot lose anything.

You will also hear a comforting claim that does not hold for the shipped system, which is that it checks itself, so covering the same ground twice does not create the same record twice. It does create it twice, because nothing deduplicates on its own.

## How redirects work

BuildOS resolves this by keeping every record and pointing the losers at the winner.

The authority is `.os/contracts/entity-consolidation-contract.md`, with the record-level rules in `.os/contracts/entity-records-contract.md`. Both are in your repository, and they carry the full field list. This section covers the shape and the reasoning.

**Nothing is deleted.** A losing record stays in its original file with its summary, its `source_anchor`, its dates and the rest of its provenance intact. Its `status` changes to `superseded` and it gains one new field.

That field is the **redirect**: a pointer on the losing record saying which record replaced it, who decided, when, and why. It has exactly six parts:

```json
"redirect": {
  "target_id": "PER-101",
  "kind": "duplicate",
  "decided_at": "2026-03-02T16:00:00Z",
  "decided_by": "product-owner",
  "reason": "The two records described the same counter role.",
  "evidence_refs": ["assets/lending-overview/lending-overview.md#roles"]
}
```

`kind` is one of `duplicate`, `consolidated`, or `replaced`. A redirect is required on a `superseded` record and forbidden on `draft`, `active`, and `archived` ones.

**The winner stays ordinary.** It does not get a special status and it does not carry a hand-maintained list of everything that folded into it. The mapping runs one way only, from loser to winner, and everything else is derived from that, which spares you a list on the winner that somebody has to remember to update.

**Chains resolve to a terminal ID.** A redirect can point at a record that itself has a redirect. The **terminal canonical ID** is the record you arrive at after following every hop. Every part of the system that reads an ID resolves it through the same rule, so an old ID in an old document still lands on the current record:

```json
{
  "requested_id": "PER-103",
  "canonical_id": "PER-101",
  "chain": ["PER-103", "PER-102", "PER-101"],
  "resolved": true
}
```

**`archived` is a different thing from `superseded`.** An archived record is retained with nothing having replaced it, whereas a superseded one was replaced by something specific. Do not use archived to hide a duplicate.

> **Watch out.** The model covers merges and has nothing for splits. Splitting an overloaded persona into two, because it has quietly become two roles, is a common and useful decision. A redirect cannot express that, since it points one record at one other record. Splitting is a manual re-authoring job: write the two new records, then decide separately what happens to the original. Expect to do this, and do not go looking for a command.

## Personas are the special case

Personas are the only record type with a second contract governing identity: `.os/contracts/persona-identity-contract.md`.

An **identity key** is an approved phrase that names a persona. An **alias** is another approved spelling of it. Both live on the persona record, and the aliases list is kept sorted and free of duplicates.

The matching rule is deliberately simple. Normalising a phrase does five things and no more: require valid text, trim the whitespace at the ends, collapse runs of interior whitespace to one space, lowercase the ASCII letters, and leave every other byte alone. Transliteration, punctuation removal, stemming, synonym expansion and fuzzy matching are all absent. So `  enterprise SUPPORT lead ` matches an approved alias of `Enterprise Support Lead`, and nothing beyond that is attempted.

An automatic match is returned only when the normalised phrase resolves to exactly one persona that is active and terminal. If two personas both claim the alias `Buyer`, you get a request for review naming both candidates, and nothing changes until somebody decides.

The rule doing the real work is that **an observed name does not become an approved alias because an extractor saw it.** Somebody has to write it in on purpose, and that deliberate write is the gate. Without it, every job title in every document becomes a persona, which is exactly how dozens of them appear.

Personas need this on top of redirects for a reason that is easy to miss. Redirects only help once you have an ID to follow, and newly extracted text cites no IDs at all. It says "the desk supervisor" in a sentence. Identity keys and aliases are the second layer that catches that.

> **Watch out.** Every other record type has no identity contract, no deterministic matching, and no dedup story. Requirements, capabilities, test cases, results, runs, findings, and extractions all have to be matched by a person looking at them. The contract says so directly: those types require their own versioned identity contracts before any of this can be automated. Budget human judgement for them.

Two more things about personas surprise people. Named individuals and job roles in the same file are what produce the mess, so keep individuals out. There is also no settings page for personas the way there is for owners and systems in `instance.yaml`, because personas are records rather than configuration.

## The procedure, and where it stops

The commands exist, and the contract behind them is specified in more detail than anything else in BuildOS. Eleven named diagnostic codes, a normative test corpus in `.os/contracts/examples/entity-resolution/`, dry-run by default on every mutation.

> **Watch out.** A freshly set-up project fails strict entity validation (exit 4), because the resolution index at `.os/indexes/entity-resolution.json` has never been built. Build it once with `.os/scripts/buildos entities rebuild-index --root . --mode strict --apply`, then strict validation passes. [What is not built yet](18-what-is-not-built-yet.md) has the full list.

Every entity command needs `--root` pointing at a directory that contains `.os/data/`. In a standard layout that is `system`. Mutating commands plan only, unless you add `--apply`.

The four commands:

| Command | Does |
| --- | --- |
| `buildos entities resolve --root . --mode compat --id <entity-id>` | Follows the redirect chain and prints the current canonical ID. |
| `buildos entities validate --root . --mode compat` | Checks the whole record graph. |
| `buildos entities consolidate --root . --mode compat --manifest <path>` | Plans a consolidation. Add `--apply` to write it. |
| `buildos entities rebuild-index --root . --mode compat --apply` | Rebuilds `entity-resolution.json`. `--check` reports instead. |

`--mode` picks how strict the check is. `compat` treats a missing index and an old record without a redirect as warnings. `strict` treats both as errors, which is why it is the mode to run before a release.

Two verified results:

```
.os/scripts/buildos entities validate --root . --mode compat
```

In a new project this exits 0 and reports `valid: true` with three records, plus `WARNING [index_stale]: entity-resolution index is missing`.

```
.os/scripts/buildos entities validate --root . --mode strict
```

The same tree exits 4 and reports `valid: false` with `ERROR [index_stale]`. Building the index once with `rebuild-index --apply` is what closes that.

### The consolidation itself

A consolidation is driven by a **manifest**: a reviewed JSON file listing which record folds into which. You write it, or your agent proposes it and you review it. It looks like this:

```json
{
  "version": 1,
  "mappings": [
    {
      "source_id": "PER-102",
      "target_id": "PER-101",
      "kind": "replaced",
      "decided_at": "2026-03-02T16:00:00Z",
      "decided_by": "product-owner",
      "reason": "The approved coordinator persona replaced the intermediate winner.",
      "evidence_refs": ["assets/lending-overview/lending-overview.md#roles"]
    }
  ]
}
```

Mappings are sorted by `source_id`, and one manifest covers one record type. Every field in it is somebody's decision written down, so the record of who decided and why survives the consolidation. A delete would have thrown all of that away.

The safe sequence:

1. **Commit first.** Nothing else here can be undone.
2. **Run it read-only.** Consolidation plans by default. Read the plan.
3. **Have a fresh agent conversation review the plan before you apply it.** Ask plainly whether it is safe to run. A reviewer with no stake in the proposal catches things the first one glossed over, and it does not have to be a different tool.
4. **Apply.** Add `--apply`.
5. **Rebuild the index**, then validate in `strict` mode.

Remapping a record that already has a redirect to a different target fails closed, by design, rather than quietly rewriting history.

## Keeping BuildOS's own records out of your data

There is one kind of contamination you get for free, on day one, before you extract anything.

`.os/data/` ships with three rows already in it: `REQ-001`, `CAP-001`, and `TC-001`. Each one describes BuildOS's own playbook activation gate rather than anything you are building. They sit at `status: draft` and point at a documentation path that does not exist in your project.

They are easy to recognise and easy to leave alone, and left alone they end up in a delivery backlog as a task a client will ask about.

**Delete all three before you add your own records.** This is the one exception to the rule above, and it holds for a narrow reason: these rows describe BuildOS, so nothing you are building will ever need to point at them.

Inside the data files they point only at each other. Outside the data files, three shipped playbooks name them in their `targets` field: `playbooks/build/package-build-artifact.md`, `playbooks/discovery/inspect-ui-discoverability.md`, and `playbooks/testing/run-core-validation.md`. Clear those `targets` lists at the same time. Nothing validates that field, so nothing will tell you that you missed it.

If you would rather keep the rows, set their `status` to `archived` and add a line to each `summary` saying they describe the tooling. Then re-run:

```
.os/scripts/buildos validate
```

The same contamination runs in both directions and appears in three forms. The tool's records turn up in your product data, its playbooks sit in your repository, and its governance surfaces as work items in your backlog. Watch for all three.

> **Watch out.** Do not clear out everything that mentions BuildOS on reflex. Some of BuildOS's own playbooks are generally useful, and two of them are among the three that ship as `active`. Ask whether a client would count the thing as scope for what you are building, rather than whether it happens to mention the tool.

## Consolidate as you go

Consolidation takes a few minutes while the source is still fresh, and becomes a project once you postpone it. A postponed cleanup tends never to get finished, and the duplicates are still there weeks later.

Three habits, none of which take more than a few minutes:

- After every extraction pass, ask your agent whether anything it minted looks like something you already had. Ask it while the source is fresh in the conversation.
- Approve the identity key and the aliases for a persona when you first accept it. That is a deliberate write whenever you do it, and it is cheapest at the point of acceptance.
- Before you hand anything to anyone outside the team, run validation in `strict` mode and read what it says.

There is a fourth habit that people skip, which is writing down what you decided. Cross-system duplicates were found once by asking an agent, the answer was useful, and nobody recorded it. The redirect's `reason` and `decided_by` fields exist so that the next person does not have to rediscover the same thing.

## What you should have now

- An understanding of why duplicate records appear, and why that is expected
- The reason deleting a record breaks things that point at it
- A working definition of a redirect, a terminal canonical ID, and a consolidation manifest
- Knowledge that only personas have identity keys and aliases, and that every other type needs human judgement
- The three seeded BuildOS rows removed or relabelled from `.os/data/`, and the three shipped playbooks that named them in `targets` updated to match
- The consolidation commands, and the rule that `consolidate` and `rebuild-index` write only with `--apply`

## Next

[Designs, plans and PRDs](12-designs-plans-and-prds.md), which turns what you have collected into documents somebody can act on.
