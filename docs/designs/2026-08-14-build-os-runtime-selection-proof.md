# Build OS Phase 0.5 Runtime-Selection Proof

## Purpose

Record the bounded Phase 0.5 comparison of Go, Node.js with TypeScript, and Rust for a representative Build OS headless-core and CLI slice. The proof determines whether current evidence supports retaining or superseding the prior Go choice without authorizing production implementation, toolkit migration, publication, or deployment.

> **Retention note:** This report was retained from the detached runtime-selection proof worktree. The source report SHA-256 was `cf983d803f985cfd64f343ea6da75f9fd6350c2df614430a212a0a3bc6cf3feb`. The disposable experiment harness, fixtures, build outputs, and benchmark machinery were intentionally not retained; experiment paths below are historical evidence labels rather than live repository links.

## Context

Build OS is filesystem-native and keeps structured authority in JSONL rather than a database. It must preserve provenance and invoke Make Docs only through a public subprocess boundary without writing Make Docs-owned state. The earlier [unified CLI design](2026-07-21-unified-buildos-cli-and-distribution.md) and [deployment standard](2026-06-04-buildos-toolkit-cli-deployment-standard.md) selected Go before the runtime assumption was deliberately reopened. An uncommitted assessment from a separate worktree was treated as user-approved design input, not as committed repository authority.

The experiment was isolated under `experiments/runtime-selection-proof/` in the disposable proof worktree. It did not modify or import an existing toolkit. All candidates implemented one shared contract and used the same input, expected semantic receipts, and harmless Make Docs operation stub.

The representative operation:

1. initializes project-local `.phase-0.5-proof/` state;
2. validates and ingests a byte-preserved JSONL fixture;
3. derives an SHA-256 provenance identity and receipt;
4. lists finding IDs in deterministic lexical order;
5. invokes a fixture public `setup` subprocess and validates its published marker;
6. records a terminal failure, retries it to success, and makes the next run idempotent.

The exact contract was `experiments/runtime-selection-proof/contract/contract.json`. The expected failed and successful receipts were `experiments/runtime-selection-proof/expected/failed-receipt.json` and `experiments/runtime-selection-proof/expected/succeeded-receipt.json`. Each candidate used same-directory temporary files, file synchronization, rename replacement, and directory synchronization for proof-state writes on the measured host.

### Environment and method

The measurement host was macOS 27.0 on arm64 with Go 1.26.4, Node.js 24.10.0, npm 11.6.1, Rust 1.94.0, and Cargo 1.94.0. The proof used only locally available toolchains and cached Rust crates; it performed no downloads. The complete captured environment was `experiments/runtime-selection-proof/results/environment.txt` in the disposable worktree.

Correctness used the three-step failure, retry, and replay sequence plus an invalid-input rejection for every candidate. Timing used 20 fresh-process representative runs and 20 idempotent replays per candidate. Each fresh run includes state initialization, JSONL parsing and hashing, atomic writes with synchronization, and one successful subprocess invocation. Resident memory is a 2 ms sampled parent-process high-water estimate, so it is a practical lower-bound measurement rather than an operating-system accounting total.

The original reproduction sequence from the disposable proof worktree was:

```sh
./experiments/runtime-selection-proof/scripts/build.sh
./experiments/runtime-selection-proof/scripts/verify.sh
./experiments/runtime-selection-proof/scripts/benchmark.sh
```

### Results

All twelve semantic checks passed. The candidates produced receipts semantically identical to the frozen expected outputs, preserved the JSONL fixture bytes, retained four subprocess attempts across failure and retry, and performed no fifth invocation during replay. The exact check matrix is in `experiments/runtime-selection-proof/results/verification.tsv`.

| Candidate | Fresh p50 / p95 | Replay p50 / p95 | p95 sampled RSS | Delivery footprint | Clean build/check | Dependency assumption |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Go | 49.588 / 58.572 ms | 20.070 / 23.482 ms | 5,520 KiB | 2,432,802 B binary; 1,018,024 B gzip | 5,375.568 ms | Native binary; zero external modules |
| Node.js / TypeScript | 137.180 / 146.709 ms | 104.696 / 122.222 ms | 80,976 KiB | 3,355 B npm package plus 117,561,248 B Node runtime | 46.776 ms syntax check | Node.js 24+; zero package dependencies |
| Rust | 48.589 / 56.038 ms | 20.964 / 24.744 ms | 2,064 KiB | 696,336 B binary; 304,699 B gzip | 9,160.226 ms | Native binary; 3 direct and 22 resolved packages |

The raw samples and summaries are preserved in `experiments/runtime-selection-proof/results/benchmark-samples.tsv`, `experiments/runtime-selection-proof/results/benchmark-summary.tsv`, `experiments/runtime-selection-proof/results/artifacts.tsv`, and `experiments/runtime-selection-proof/results/dependencies.tsv`.

Go cross-built macOS arm64/x64, Linux x64, and Windows x64 artifacts on the measurement host. Rust built macOS arm64/x64 artifacts, but installed Linux musl targets failed at the host linker and the Linux GNU and Windows MSVC targets were not installed. Node produced a dependency-free npm tarball, but that artifact requires Node.js 24 or newer and is not a zero-prerequisite executable. The packaging matrix is in `experiments/runtime-selection-proof/results/packaging.tsv`.

Source size was similar: Go 395 lines, Node/TypeScript 354 lines, and Rust 371 lines. Node had the shortest build path, but the host lacked `tsc`; the proof therefore used Node 24 native TypeScript execution, runtime semantic checks, and `node --check`, not a static TypeScript type-check. Rust produced the smallest and lowest-memory native artifact but added a new 22-package resolved graph, a slower clean build, host-linker friction, and a complete rewrite from the existing Go implementation.

## Decision

Retain Go for the Build OS headless core and CLI at the next planning gate. This proof explicitly retains, but does not broaden, the prior Go authority in the unified CLI and deployment designs. It does not authorize production work.

Confidence is moderate-high for retention now, not for an irreversible lifetime language choice. Go and Rust were effectively tied on representative wall time, and both met the filesystem, provenance, subprocess, failure, retry, and idempotency contract. Rust's approximately 0.70 MB binary and 2.0 MiB sampled RSS are real advantages, but Go's approximately 2.43 MB binary and 5.4 MiB sampled RSS are already lightweight for the demonstrated workload. Those savings do not offset Rust's current rewrite cost, dependency graph, longer clean build, and less complete packaging result.

Node.js remains a credible adapter or server technology, especially where npm ecosystem alignment matters, but it is not the preferred lightweight local core under the measured managed-runtime path. Its small npm package hides a 117.6 MB runtime prerequisite, and its measured parent-process RSS and startup were materially higher.

The choice follows the gate's intended rule: among candidates that pass correctness, prefer the lowest demonstrated lifecycle and migration cost rather than the fastest isolated benchmark. Go passed while retaining existing implementation and parity-test leverage and produced the broadest packaging matrix with no external module dependency.

## Alternatives Considered

### Select Rust now

Rust won artifact size and sampled memory and matched Go on wall time. It was not selected because the representative slice did not show a product need that Go's footprint fails, while a Rust choice would replace the only existing implementation, introduce a new dependency and contributor surface, and require more release-host work. Rust remains the strongest challenger if a later explicit binary-size, memory, or safety requirement makes Go unacceptable.

### Select Node.js with TypeScript now

Node offered the smallest source package, no package dependencies, the shortest validation step, and direct npm ecosystem alignment. It was not selected because the measured delivery path requires Node.js 24+, had the highest startup and memory footprint, lacked an available static type-checker in the bounded offline environment, and did not produce a standalone executable.

### Declare the proof inconclusive

The proof does not justify a permanent language guarantee, but it is conclusive for the immediate retain-versus-rewrite decision. Every candidate passed semantic parity, while migration and packaging evidence distinguish Go from the challengers enough to reject a rewrite now.

## Consequences

- Phase 1 planning may continue to treat Go as the selected core and CLI language only after separate planning authorization.
- Existing Go behavior and tests remain reusable rather than becoming a migration oracle for a rewrite.
- Rust remains the measured native-footprint challenger; a future reconsideration needs an explicit requirement that the retained Go footprint fails.
- Node.js remains available for separately gated adapters, MCP/server work, or UI tooling without becoming the canonical core.
- The experiment remained non-production and was not retained in this assessment worktree; disposal of the source worktree is separately gated cleanup.
- No existing toolkit contract, Make Docs state, production code, commit, publication, or deployment changed.

This bounded proof did not include a real Make Docs invocation, Windows execution, clean-machine installation, signing, SBOM or vulnerability scans, static TypeScript checking, concurrent writers, crash injection at every durable-write boundary, 10,000-record or SQLite-derived-index work, MCP transport, or signal handling. Those remain validation work for their relevant later gates and prevent this document from claiming permanent or complete platform qualification.

## Design Lineage

- Update Mode: `new-doc-related`
- Prior Design Docs: [Unified BuildOS CLI and Distribution](2026-07-21-unified-buildos-cli-and-distribution.md), [Build OS Toolkit CLI Deployment Standard](2026-06-04-buildos-toolkit-cli-deployment-standard.md)
- Reason: The prior designs selected Go before runtime choice was reopened; this separate proof retains that choice using representative comparative evidence.

## Intended Follow-On

- Route: `change-plan`
- Next Prompt: [designs-to-plan-change.prompt.md](make-docs://system/prompt/designs-to-plan-change.prompt.md)
- Why: If separately authorized, the retained runtime decision should revise the active headless-core and CLI planning path rather than create an unrelated baseline.
- Coordinate Handoff: unresolved; planner must resolve before writing.
