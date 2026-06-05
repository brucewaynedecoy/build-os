# buildos-discovery Agent Instructions

`buildos-discovery` owns deterministic discovery-run recording, raw-finding anchoring, finding qualification, negative assertions, and run/finding-specific validation.

Read [`README.md`](README.md), [PRD 10](../../docs/prd/10-discovery-runs-and-qualification.md), [PRD 16](../../docs/prd/16-revise-toolkit-ownership-boundaries.md), and the run/finding contracts before changing command behavior.

Do not add intake conversion, source indexing, config validation, stage movement, or design hand-off orchestration here. Route those domains through their owning toolkit or PRD 16 if ownership is unclear.
