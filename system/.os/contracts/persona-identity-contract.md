# Persona Identity Contract

## Purpose

Authority for deterministic persona-only identity keys and approved aliases.
This contract defines when an exact persona candidate may resolve to one canonical persona and when it must stop for review.
It supplements the persona record shape in the [entity records contract](entity-records-contract.md); it does not define identity heuristics for any other entity type.

## Versioned Persona Fields

A persona row may include these optional fields:

```json
{
  "identity": {
    "scheme": "persona-v1",
    "key": "customer support manager | enterprise saas"
  },
  "aliases": [
    "Enterprise Support Lead"
  ]
}
```

- `identity.scheme` must be exactly `persona-v1`.
- `identity.key` is a reviewer-approved identity phrase that includes the role and any context needed to distinguish the persona. It must already be in normalized form.
- `aliases` is a lexically sorted, de-duplicated list of non-empty strings that reviewers have explicitly approved for this persona.
- An observed name, title, or phrase is not an approved alias merely because an extractor encountered it. Approval requires a deliberate write to the canonical persona row.
- Identity keys and aliases are scoped to `persona`. They must never match another entity type.

## `persona-v1` Normalization

Normalize an identity phrase or alias for comparison in this exact order:

1. Require valid UTF-8.
2. Trim leading and trailing ASCII whitespace: space, tab, line feed, carriage return, form feed, and vertical tab.
3. Replace every interior run of that ASCII whitespace with one ASCII space.
4. Replace ASCII letters `A` through `Z` with `a` through `z`.
5. Leave every other UTF-8 byte unchanged.

The normalizer does not apply Unicode normalization, transliteration, punctuation removal, stemming, token reordering, synonym expansion, or fuzzy comparison.
Those transformations can merge distinct people or roles and are review-only.

The normalized result must not be empty.
Stored `identity.key` values must equal their normalized result.
Stored aliases preserve the approved display spelling, but alias uniqueness is evaluated by normalized value.

## Validation Invariants

- A persona row has at most one `identity` object and one `aliases` list.
- Every alias must be non-empty after normalization.
- Two aliases on the same persona must not normalize to the same value.
- Repeated raw aliases must not appear in a persona's `aliases` list.
- `aliases` entries use ascending lexical order by their stored UTF-8 string values.
- Two identity keys that resolve to different terminal canonical personas must not normalize to the same value. This is an identity collision and blocks deterministic matching.
- An alias may appear on more than one historical row only when every matching row resolves to the same terminal canonical persona. Otherwise the alias is ambiguous and remains review-only.
- A redirect does not transfer or delete persona fields. Historical aliases and identity keys remain on their original rows for provenance and are evaluated through terminal resolution.

## Exact Match Procedure

Persona-producing workflows evaluate candidates in this order:

1. If the candidate supplies an exact `PER-NNN` ID, resolve that ID through the entity redirect graph.
2. Otherwise, normalize an observed persona alias and collect exact matches from approved `aliases` on persona rows. Resolve every matched row to its terminal canonical ID.
3. If no approved alias matches and the candidate supplies `persona-v1`, normalize its identity phrase and collect exact `identity.key` matches. Resolve every matched row to its terminal canonical ID.
4. Return an automatic match only when the resulting set contains exactly one active terminal canonical persona.
5. Return a review result when the set is empty, contains more than one terminal canonical persona, contains an invalid or inactive terminal, or encounters an identity collision.

Several historical rows that all resolve to the same active terminal count as one canonical match.
An exact unique match is a resolution result only: it does not create a redirect, add an alias, update the matched persona, or mutate any canonical file.
The extraction workflow records a matched but unchanged persona as `referenced`, or as `updated` only after a separate deliberate canonical update.

Fuzzy, semantic, probabilistic, or normalization-expanding matches may produce review candidates with evidence and confidence.
They never create redirects, approve aliases, mint identity keys, or mutate canonical records automatically.

## Examples

Compact positive and negative fixtures demonstrate:

- [an approved alias resolving to one terminal persona](examples/persona-identity/unique-alias.json);
- [an exact alias that must stop for review](examples/persona-identity/ambiguous-alias.json);
- [a unique `persona-v1` identity match](examples/persona-identity/exact-identity-key.json); and
- [identity inputs that collide after normalization and fail validation](examples/persona-identity/normalization-collision.json).

## Scope Boundary

`persona-v1` applies only to persona records and `PER-NNN` candidates.
Requirements, capabilities, findings, test cases, results, runs, extractions, and playbooks require separate versioned identity contracts before any identity-key or alias matching can be automated.
