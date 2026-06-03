# 03 Open Questions and Risk Register

## Purpose

Capture drift, unresolved decisions, and rebuild risks for the Build OS PRD namespace that should stay visible instead of being buried in subsystem docs. This is the living register; update it directly as items are discovered or resolved.

## Confirmed Drift

List verified mismatches.

### D-001 make-docs line-break convention conflict

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Reconcile in the make-docs source |

**Issue**: `docs/AGENTS.md` states "source Markdown uses semantic line breaks," while `docs/assets/references/output-contract.md` requires "paragraphs should be one logical source line … line breaks only for semantic Markdown structure." These two make-docs references prescribe incompatible prose line-break styles.

**Why it matters**: Generated `docs/` artifacts (designs, plans, PRDs, work) cannot satisfy both rules; the architecture design and the plan used sentence-per-line while this PRD set and the backlog follow the output contract, so the namespace is internally inconsistent until reconciled.

**Recommendation**: Pick one convention in the make-docs source and align both references; normalize existing `docs/` artifacts to match.

**To close**: A single agreed line-break rule in make-docs and normalized existing docs.

Code anchors:

- `docs/AGENTS.md`
- `docs/assets/references/output-contract.md`

## Open Questions

### Q-001 Promotion enforcement: convention vs. machinery

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Resolve before hardening stage automation |

**Question**: Should promotion gates (review-to-activate, verify-to-promote) be enforced by tooling/hooks, or remain documented conventions that humans and agents follow?

**Why it matters**: It determines how much of `system/.os/scripts/` and the stage-movers must validate state versus trust the operator, and it shapes the stage-automation phase.

**Recommendation**: None yet; lean toward convention first, with a lightweight index check, hardening to machinery only where drift appears.

**To close**: A decision recorded here and reflected in the stage-automation work.

### Q-002 Generalizing engagement-specific tag values

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Revisit when a second adopter appears |

**Question**: The `env` values (`vanilla`/`deere`) and `for` values (`microsoft`/`deere`) are specific to the first engagement. How should an adopter configure their own tag vocabularies?

**Why it matters**: Build OS ships as a general-purpose tool; hard-coded engagement values would leak into every adopter's data.

**Recommendation**: Make tag vocabularies a per-adopter configuration surface; keep the first engagement's values as the seeded example.

**To close**: A configuration mechanism for tag vocabularies.

Code anchors:

- `system/.os/contracts/playbook-contract.md`

## Rebuild Risks

### R-001 make-docs plug-in dependency

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Track make-docs CLI behavior |

**Issue**: The operating-layer entry pointer lives in the co-owned `system/AGENTS.md`, which the make-docs CLI re-touches; a rebuild that ignores the append-only contract could lose the pointer or break `docs/` routing.

**Why it matters**: Loss of the `.os/` pointer makes the operational layer undiscoverable from the top router.

**Recommendation**: Treat top routers as augment-only and keep the `.os/` pointer above the make-docs append marker.

**To close**: Confirmed CLI preservation behavior and a documented augmentation procedure.

### R-002 Qualification cost

| Status | Decision | Follow-Up |
| --- | --- | --- |
| Open | None yet | Validate during the discovery phase |

**Issue**: Every promoted finding requires a deterministic, repeatable confirmation test; this is deliberate but costly at volume.

**Why it matters**: A rebuild that skips qualification to save effort would silently weaken the verify-to-promote gate.

**Recommendation**: Keep qualification mandatory; invest in reusable test scaffolds to lower per-finding cost.

**To close**: A qualification harness that makes the test cheap to produce.

Code anchors:

- `system/workspace/findings/`

## Source Anchors

- `docs/designs/2026-06-03-build-os-architecture.md`
- `docs/assets/references/output-contract.md`
