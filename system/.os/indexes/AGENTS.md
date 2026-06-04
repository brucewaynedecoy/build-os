# Indexes Router (`.os/indexes`)

Derived system catalogs live here. Examples include `references.json` and `playbooks.json`.
Indexes are rebuildable and non-authoritative; use them for lookup only, and regenerate them from
source artifacts when they drift.

## Use

- Read indexes for navigation and lookup, not as source-of-truth records.
- Rebuild the relevant catalog after source artifacts change.
- Resolve artifact shape and lifecycle questions in source artifacts and contracts, not here.
