package cli

const rootHelp = `BuildOS deterministic project tooling

Usage:
  buildos help
  buildos version [--json]
  buildos entities <command> [flags]

Entity commands:
  resolve        Resolve an entity ID to its active canonical record
  validate       Validate the complete governed entity graph
  consolidate    Plan or apply a reviewed consolidation manifest
  rebuild-index  Check or rebuild the derived entity-resolution index

Run "buildos entities help" for entity command details.
`

const entitiesHelp = `Usage:
  buildos entities resolve --root <path> --mode compat|strict --id <entity-id> [--json]
  buildos entities validate --root <path> --mode compat|strict [--json]
  buildos entities consolidate --root <path> --mode compat|strict --manifest <path> [--apply] [--json]
  buildos entities rebuild-index --root <path> --mode compat|strict [--check|--apply] [--json]

Mutation commands are dry-run/check-only unless --apply is supplied.
Every entity command requires an explicit BuildOS root and validation mode.
`
