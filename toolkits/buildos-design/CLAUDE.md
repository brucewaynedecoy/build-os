# buildos-design Agent Instructions

`buildos-design` owns deterministic hand-offs between qualified Build OS artifacts and the make-docs-routed planning/design surface.

Read [`README.md`](README.md), [PRD 16](../../docs/prd/16-revise-toolkit-ownership-boundaries.md), the finding contract, and the system design router before changing command behavior.

Do not add discovery-run recording, finding qualification, intake conversion, source indexing, config validation, or entity-row validation here. Stage-mover hooks and slash commands belong to the future automation phase unless an explicit PRD/design revision moves them into this toolkit.
