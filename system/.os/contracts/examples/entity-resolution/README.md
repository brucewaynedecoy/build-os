# Entity Resolution Contract Fixtures

These files are compact, deterministic examples for the [entity consolidation contract](../../entity-consolidation-contract.md).
They are contract fixtures rather than adopter data and may combine entity types in one JSONL file so a graph test can load one corpus.

## Valid fixtures

- `valid-all-types.jsonl` contains one active winner and one redirected loser for each governed JSONL entity type.
  Every losing row retains required type-specific fields and an unknown `x_fixture_extension` object.
- `valid-multi-hop.jsonl` covers active zero-hop resolution and a two-edge chain.
- `valid-resolver-results.json` freezes zero-hop and multi-hop result shapes.
- `valid-consolidation-manifest.json` freezes the reviewed manifest shape and lexical mapping order.
- `valid-index.json` is the canonical index for `valid-multi-hop.jsonl`.

## Invalid fixtures

`invalid-graph-cases.json` contains independent record sets for every graph, duplicate-ID, legacy, and remap conflict.
`invalid-index-cases.json` contains stale and non-reproducible candidates compared with `valid-index.json` for the unchanged `valid-multi-hop.jsonl` input.
`expected-diagnostics.json` maps every negative fixture to its required stable diagnostic and validation-mode result.

Fixture readers must preserve unknown fields.
They must not treat these combined corpora as the canonical per-type file layout used by an adopter root.
