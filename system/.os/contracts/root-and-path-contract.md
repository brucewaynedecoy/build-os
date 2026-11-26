# Root and Path Contract

## Purpose

Define paths for an initialized BuildOS project. Keep the package's source location separate from the project where users run it.

## Project Root

The project root contains `.os/`, `assets/`, `playbooks/`, `workspace/`, and `docs/`. BuildOS does not require a `system/` directory in that project.

The BuildOS source checkout keeps these files inside a package named `system/`. Initialization places the package contents at the target project root. The source package name is not part of an installed path.

| File or directory | Initialized-project path | Source path in the BuildOS checkout |
| --- | --- | --- |
| Operating layer | `.os/` | `system/.os/` |
| Instance config | `.os/config/instance.yaml` | `system/.os/config/instance.yaml` |
| Converted sources | `assets/` | `system/assets/` |
| Playbooks | `playbooks/` | `system/playbooks/` |
| Run and finding evidence | `workspace/` | `system/workspace/` |
| Adopter documents | `docs/` | none: Make Docs creates `docs/` when the user sets it up |

## Saved Paths and Anchors

New paths in records and derived catalogs are relative to the initialized project root. Use `assets/<source>/<file>#<anchor>` for converted-source evidence. Use `docs/<path>.md#<anchor>` for document evidence. Use `workspace/` paths for run and finding artifacts.

Do not add the source package name to a new saved path. Do not rewrite historical evidence or migrate live records merely to remove an old prefix. A tool that reads a legacy path must handle that case under its own compatibility rules.

## Instructions and Links

Write shipped commands from the initialized project root. Resolve Markdown links from their containing file. Links inside this package must work when its contents move to another project root.

Do not link from shipped guidance to a parent checkout's project records, toolkit source, or skill packages. Those directories are not installed with the filesystem package. Use an installed command or a separately distributed resource when needed.

Use source-checkout paths only in clearly marked maintainer instructions or source evidence. A correct source link is not a runtime path.

## Skills and Tools

First-party skills and Go toolkits are separate source packages. A harness chooses where a skill is installed. A binary installer chooses where a command is installed. Neither location defines the BuildOS project root.

Read the current command's root flags before use. The current unified entity commands require an explicit root containing `.os/data/`. Some legacy tools also support the BuildOS checkout layout. That support does not make `system/` an installed directory.

`buildos validate` checks an initialized project. It reads installed paths only and checks each saved anchor relative to the project root, so it never needs a `system/` folder.

## Portability Check

Use a temporary project for a path-sensitive check. Place the package contents at its root. Do not create a `system/` child to make a command or link pass. Check local links and generated paths from that layout. Test mutations only on copied data.

Document a tool or resource that still depends on the source checkout. Keep that limit separate from a successful package-link check.
