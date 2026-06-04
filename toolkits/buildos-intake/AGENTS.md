# buildos-intake Router

`toolkits/buildos-intake/` owns source and build metadata for the `buildos-intake` CLI.

## Routing

- Before changing behavior, read [README.md](./README.md), [PRD 07](../../docs/prd/07-intake-and-conversion.md), [PRD 14](../../docs/prd/14-revise-deterministic-toolkit-deployment.md), and the intake contracts under `system/.os/contracts/`.
- Keep conversion and reference-index logic in this toolkit.
- Keep `system/.os/scripts/` wrappers thin and avoid duplicating toolkit logic there.
- Do not add generated converted outputs, references indexes, sample customer data, or release binaries to this directory.
- Test command parsing, path derivation, hashing, frontmatter, conversion, side-artifact handling, and index rebuild behavior when changing the CLI.

## Standards

- Binary name: `buildos-intake`.
- Default language: Go.
- Runtime posture: local-only.
- Approved P3 dependencies: `golang.org/x/net/html` and `github.com/ledongthuc/pdf`.
- No `pdftotext`, Poppler, OCR engine, external converter utility, network call, or service call is part of the P3 command surface.
- Any additional dependency requires README rationale, license notes, and packaging review notes before code is introduced.
