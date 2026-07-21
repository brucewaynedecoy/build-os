# Phase Detail: Unified CLI Seed, Resolver, and Index

## P2 - Unified CLI Seed, Deterministic Graph Engine, and Mutation Surface

Seed the unified `buildos` Go module and implement the generic, type-safe entity engine that makes redirect-bearing data safe to inspect, validate, mutate, and rebuild.

## Source Inputs

- PRD 17 and the revised operating contracts from P1
- [Deterministic toolkit deployment requirements](../../prd/14-revise-deterministic-toolkit-deployment.md)
- [Toolkit ownership boundaries](../../prd/16-revise-toolkit-ownership-boundaries.md)
- [PRD 18 unified CLI and distribution](../../prd/18-revise-unified-buildos-cli-and-distribution.md)
- `toolkits/AGENTS.md` and the live toolkit build/test conventions
- Existing entity datasets, validators, wrappers, and derived-index generators discovered with `jcodemunch`

## Workstreams

1. Create `toolkits/buildos/` with `cmd/buildos`, shared CLI, layout, and output packages, build metadata, source-build defaults of version `dev` and revision `unknown`, and root `help` and `version` behavior.
2. Implement one whole-graph loader and resolver that indexes all governed IDs, follows redirect chains, returns requested ID plus canonical ID plus full chain, and fails closed on every invariant violation.
3. Implement compatibility and strict validators. Compatibility emits structured warnings for legacy superseded rows without redirects; strict rejects them; both reject invariant violations that cannot be safely ignored.
4. Implement dry-run-default consolidation with explicit `--root` and `--apply`, same-filesystem temporary writes, atomic canonical JSONL replacement, permission preservation, identical-mapping idempotence, and different-target conflict rejection.
5. Generate `system/.os/indexes/entity-resolution.json` from canonical JSONL only, with stable lexical ordering, forward and reverse projections, a reproducibility check, and explicit recovery output if canonical write succeeds but index rebuild fails.
6. Expose `buildos entities resolve`, `validate`, `consolidate`, and `rebuild-index` with the frozen `--root`, `--mode`, `--id`, `--manifest`, `--apply`, `--check`, and `--json` contracts; create no `buildos-entities` binary.
7. Expose the resolver temporarily through `toolkits/buildos/pkg/entities` and wire existing consumers with explicit local module dependencies; no domain may invoke the resolver through a subprocess.
8. Keep any `system/.os/scripts/` changes as thin command routing only; introduce no Python implementation and do not absorb intake, discovery, or design into the unified module during W1 R4.

## Dependencies

- Requires P1's final field names, graph invariants, validation modes, and PRD 18 CLI boundary.
- Graph engine and CLI shell may proceed in parallel after the internal API is fixed; index generation depends on the graph loader.
- P3 and P4 cannot apply mappings or integrate writes until strict validation, dry-run behavior, and deterministic index rebuild tests pass.

## Acceptance Checks

- Unit and fixture tests cover zero-hop, one-hop, multi-hop, later winner replacement, every redirect kind, same-type enforcement, cycles, missing targets, inactive terminals, duplicate IDs, illegal redirects, and remap conflicts.
- Generic fixtures include every governed entity type and prove that no entity type silently gains different graph semantics.
- Identical input yields byte-identical index output and `--check` detects stale or non-reproducible output without writing.
- Mutation never infers a root from the checkout or current directory, never writes during dry-run, and never begins when preflight validation fails.
- Failure injection covers invalid JSONL, unwritable roots, interrupted writes, and a successful canonical write followed by failed index generation with a usable recovery command.
- No `buildos-entities` binary exists, and existing installed intake, discovery, and design binaries and wrappers are not changed by building or invoking the staged `buildos` binary by explicit path.

## Execution Notes

Treat the source checkout, installed program files, and adopter-owned data as three separate roots. Tests may use fixtures and temporary copied roots only. Never copy the checkout's `system/` tree onto adopter data, and never broaden root discovery to make a failing command appear convenient.
