# buildos-intake

`buildos-intake` is the planned first-party Build OS intake and conversion toolkit.
This directory is scaffold-only until W1 R0 P3 implements converter and reference-index behavior.

## Planned Scope

- Convert supported source inputs into clean text or CSV twins.
- Preserve deterministic provenance for converted outputs.
- Rebuild or update the references index from converted-source metadata.
- Provide a packaged local CLI surface that operational scripts can call.

## Current Status

No converter logic, Go module, or binary build metadata is included in this prerequisite phase.
Do not add behavior here until the W1 R0 P3 intake/conversion implementation begins.

## Defaults

| Area | Default |
| --- | --- |
| Binary name | `buildos-intake` |
| Implementation language | Go |
| Dependency posture | Standard library first |
| Runtime posture | Local-only |
| Script role | `system/.os/scripts/` wrappers may call the binary after behavior exists |

Any future dependency must be documented here with rationale, license notes, and packaging review notes before it is introduced.

## References

- [Toolkit router](../AGENTS.md)
- [Build OS Toolkit CLI Development](../../docs/guides/developer/buildos-toolkit-cli-development.md)
- [PRD 07 Intake and Conversion](../../docs/prd/07-intake-and-conversion.md)
- [PRD 14 deterministic toolkit deployment revision](../../docs/prd/14-revise-deterministic-toolkit-deployment.md)
- [Toolkit CLI deployment standard design](../../docs/designs/2026-06-04-buildos-toolkit-cli-deployment-standard.md)
