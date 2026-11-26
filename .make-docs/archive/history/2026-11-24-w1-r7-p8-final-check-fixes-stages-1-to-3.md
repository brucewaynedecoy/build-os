---
title: "W1 R7 P8 Final Check Fixes for Stages 1 to 3"
kind: "history"
status: "completed"
date: "2026-11-24"
client: "T3 Code (Claude Code)"
model: "claude-opus-5-5"
coordinate: "W1 R7 P8"
provider: "Anthropic"
repo: "build-os"
branch: "rewrite/ts-cli"
summary: "Fixed the eight findings of review round 3 of 6e8e226: the owner checklist now protects the refs before any secret exists, the staging check requires exactly the tarball and the SBOM and compares the SBOM with the run's own, both GitHub download forms work, CODEOWNERS covers every gate file, the sole-maintainer route is exact, and the Make Docs, dry-run, and npm statements are true."
---

# W1 R7 P8 Final Check Fixes for Stages 1 to 3

## Changes

The final fix pass for P8 Stage 1 (release workflow), Stage 2 (documents), and Stage 3 (Go removal) after review round 3 of `6e8e226` (P8-F-01 to P8-F-08). Built on `6e8e226` and not committed. Under the project stop rule no further review follows. Nothing was published, staged, tagged, or released; no registry-writing npm command ran; no repository or npm setting changed.

Framing: [W1 R7 backlog](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/00-index.md), [P8 phase](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md), and the evidence report sections [P8 CI Runs and Dry Runs on 6e8e226](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-ci-runs-and-dry-runs-on-6e8e226) and [P8 Final Check for Stages 1 to 3](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md#p8-final-check-for-stages-1-to-3).

| Area | Summary |
| --- | --- |
| Owner checklist and trust rule (P8-F-01) | Delete the repository secret first, then the history rewrite, public, branch and tag rulesets, release immutability, a verification, the environments, and only then the environment secret, then npm; write access is a release-trusted role; a new in-job ruleset check (`release-github.ts rulesets`) before the secret and before npm, fail closed |
| Release assets (P8-F-02, P8-F-03) | Exactly the tarball and the SBOM, each with GitHub's digest; the SBOM checked for the digest, the source commit, the CycloneDX schema, and the same bytes as the run's verify SBOM; direct 200 and redirect downloads, no token to the storage host |
| Code owners (P8-F-04) | CODEOWNERS covers the workflows, every script, the tests and gate corpora, the package settings, the SBOM policy documents, and five product files the scripts read; `test/codeowners.test.ts` computes the set |
| Sole maintainer (P8-F-05) | Repository admin role bypass, For pull requests only, on `main`; Repository admin on the tag ruleset; Prevent self-review off; what it protects and what it does not; the two-maintainer route |
| Make Docs text (P8-F-06) | The `init` question and guide chapter 4 say what Make Docs 2.0.9 installs |
| Dry run and npm facts (P8-F-07, P8-F-08) | What a dry run does not exercise; the 72-hour unpublish condition; staged approval in the account settings tab; PRD 20 history entry |
| Closeout | Evidence sections, phase file status, final ordered owner checklist, what only a real prepare or release run shows |

Deferred obligations and Unassisted Goal Testing: `not-needed-now`; no `O-###` or `NUAT-###` applies. Guide coverage: `update-existing` for chapter 4; no new guide.

## Documentation

### Project

| Path | Description |
| --- | --- |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/evidence.md) | CI runs on `6e8e226`; the final check: findings, in-job check limits, the owner checklist, first-exercised items, acceptance status, dry runs, check results. |
| [docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md](../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/08-release-0-1-0.md) | A64 to A70 status; Stage 4 and Stage 5 dependencies; closeout note. |
| [docs/prd/20-buildos-cli-and-distribution.md](../../../docs/prd/20-buildos-cli-and-distribution.md) | Release: the dry run, the staging job's asset checks, the trust rule and in-job ruleset check; Requirement History entry. |

### Maintainer

| Path | Description |
| --- | --- |
| [toolkits/buildos/SECURITY.md](../../../toolkits/buildos/SECURITY.md) | Owner Settings for Releases reordered; Sole Maintainer or Two Maintainers; trust rule; in-job checks and their limits; release assets; unpublish and approval facts. |
| [toolkits/buildos/AGENTS.md](../../../toolkits/buildos/AGENTS.md) | Trusted scripts list, dry-run scope, First Publication prerequisites, approval route, unpublish policy. |
| [docs/assets/maintainer/buildos-toolkit-cli-development.md](../../../docs/assets/maintainer/buildos-toolkit-cli-development.md) | Dry-run scope. |

### User

| Path | Description |
| --- | --- |
| [guide/content/04-install-and-configure-your-instance.md](../../../guide/content/04-install-and-configure-your-instance.md) | What Make Docs adds, and the captured output; `guide/BuildOS-Guide.html` rebuilt. |
