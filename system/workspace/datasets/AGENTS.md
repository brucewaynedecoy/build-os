# Datasets Router

`system/workspace/datasets/` stores local datasets used by playbooks, discovery runs, and qualification workflows.

## Use

- Keep adopter-owned or run-specific datasets here, not in `.os/data/`.
- Reference datasets from run records with project-relative paths such as `system/workspace/datasets/example.csv`.
- Do not store generated run evidence here; route evidence to [`../runs/`](../runs/).
- Do not store qualified finding evidence here; route it to [`../findings/`](../findings/).
