# BuildOS CLI Package Router

This folder is the npm package `build-os` (unscoped, npm account `brucewaynedecoy`; owner decision of 2026-11-26): the `buildos` command in TypeScript (strict, ESM), bundled by esbuild for Node.js 24 or newer, with no runtime `dependencies`. It owns every BuildOS domain (`entities`, `intake`, `discovery`, `design`, `init`, `validate`) and the legacy names `buildos-intake`, `buildos-discovery`, and `buildos-design`. The earlier Go tools were removed in W1 R7 P8. The package also has the `bin` `build-os`, the same file as `buildos` (`dist/buildos.js`), because `npx -y build-os@<version>` runs the `bin` named after the package; it is not a legacy name.

## Routing

- `src/cli/` owns argument parsing, output, exit codes, and the command names. `src/core/` owns domain logic and may not write to a file descriptor or stream itself; it writes through the filesystem port (`src/core/shared/fs-port.ts`, `src/adapters/node-fs.ts`).
- `scripts/build.ts` builds `dist/`. `scripts/release-build.ts`, `scripts/release-gate.ts`, `scripts/release-candidate.ts`, `scripts/sbom.ts`, `scripts/reproducible-pack.ts`, and `scripts/release-dry-run.ts` are the release flow (W1 R7 P8); `.github/workflows/buildos-release.yml` runs them. The trusted release jobs run only `scripts/release-stage-check.ts`, `scripts/release-github.ts`, `scripts/release-ledger.ts`, `scripts/json-schema.ts` (with the vendored schemas in `scripts/schemas/cyclonedx-1.5/`), `scripts/tar-reader.mjs`, and `scripts/check-deny-list.mjs` (with `scripts/deny-list-paths.mjs`), from the default branch, with Node built-ins only; keep those files free of any other import. `.github/CODEOWNERS` must cover every file a workflow `run:` line names and every file the scripts import or read (`test/codeowners.test.ts`).
- `test/golden/` is the frozen Go parity baseline. Read `test/golden/CAPTURE.md` before touching a golden; goldens never change by hand.
- Comments that name a Go file (`internal/...`, `cmd/...`, `toolkits/buildos-*/...`) name the Go sources at the frozen baseline commit `263f5ca` (see `test/golden/CAPTURE.md`). That commit exists only in the private archive repository `brucewaynedecoy/build-os-archive`: the public repository starts from one clean commit (owner decision of 2026-11-25).

## Constraints

- No runtime `dependencies`. An outside package follows PRD 20 Supply Chain and is recorded in `SECURITY.md` and `THIRD_PARTY_NOTICES.md`. Every install in this repository's build and CI uses `--ignore-scripts`, and this folder's `.npmrc` sets `ignore-scripts=true`; the published package declares no lifecycle script.
- Output must match the Go goldens byte for byte unless a parity exception with an owner decision says otherwise (`test/golden/parity-exceptions.json`).
- Keep mutations dry-run by default and require explicit `--apply` where the Go tools did.
- Use copied or temporary BuildOS roots for tests. Never point tests at live adopter data.

## Validation

From this folder:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
node dist/buildos.js version
```

## Release

The maintainer steps for a release are in the header of `scripts/release-candidate.ts` and in `SECURITY.md` (Release Procedure), which also describes every job and its trust boundary. In short: set the version; push the commit to `release-dry-run/<short-sha>` (a dry run on the reference runner); download that run's artifact and inspect the tarball; compute the `reviewed` entry from that tarball (`node scripts/release-candidate.ts compute --tarball <file> --build <release-build.json> ...`) and commit it to `release-candidates.json` (nothing else in that change); create the tag `v<version>` on that commit and a draft GitHub Release for it; run the workflow from the default branch with purpose `prepare` and the tag, which checks everything and attaches the tarball and the SBOM to the draft; review the draft and publish it; a required reviewer approves the `buildos-npm-stage` job in GitHub; the workflow stages the release asset on npm; the maintainer approves the stage with 2FA only after the recorded publication approval. `node scripts/release-dry-run.ts --allow-dirty` runs the candidate gates of the `verify` job locally, in workflow order, and never stages. A dry run (local or on GitHub) uses an invented deny list and reports the provenance preconditions as warnings. It does not exercise the real-list scan, the ruleset and environment checks, `attach`, the required reviewer's approval, the release-asset checks, or staging: the first prepare run exercises the real-list scan, the ruleset and environment checks, and `attach`; the first release run exercises the approval, the release-asset checks, and staging.

No agent publishes, stages, tags, creates a release, runs `npm trust`, or changes repository or npm settings. The steps below are for the maintainer.

### First Publication

Owner decision of 2026-11-24 (option A). npm configures a trusted publisher only for a package that already exists, and `build-os` does not exist yet. So the maintainer creates the package with a placeholder, then sets up trusted publishing, then releases `0.1.0` through the workflow. Facts are from docs.npmjs.com (`npm-stage`, `npm-trust`, `npm-dist-tag`, `npm-deprecate`, Trusted publishing, Staged publishing, Unpublish policy, Deprecating packages), read on 2026-11-24.

Before you start:

- Your npm account has two-factor authentication on. Staging and trusted-publishing setup need it, and every stage approval asks for it.
- The owner settings in `SECURITY.md` (Owner Settings for Releases) steps 1 to 16 are done, in their order: the old repository secret deleted, the current repository renamed to `build-os-archive` and kept private, every existing clone, worktree, and automation retargeted to the archive URL, the new repository `brucewaynedecoy/build-os` created private and empty, one reviewed clean commit made in a fresh folder that passed the real-list deny-list check and pushed as `main` only, the remote checked (one commit, one branch `main`, no tag), the repository made public (npm makes provenance only for a public repository; GitHub Free has rulesets only on a public repository), then at once the branch and tag rulesets and release immutability on and verified, the environments `buildos-deny-list` and `buildos-npm-stage`, only then the environment secret, private vulnerability reporting, and the remote checked again. Trusted publishing is step 17 of that list, and these First Publication steps are it. Every setting here is on the new repository.
- For steps 4 to 6, `0.1.0` is ready: its dry run passed and its `reviewed` entry is merged. Trusted publishing expires after 2 days if its first publish does not succeed, so do steps 4 to 6 on the same day.
- Do steps 1 to 3 (reserve the name) as early as you can, before `0.1.0` is ready. `build-os` is an unscoped name: until the placeholder is published, any npm account can take it, and this public repository tells readers to run `npx -y build-os@0.1.0`. After step 3, only the owner's account can publish under the name.

Steps:

1. Build the placeholder from this repository, into a new or empty folder outside it: `node scripts/reserved-placeholder.ts --out <folder>`. The script builds and packs it in a private temporary folder, checks that the tarball holds exactly the three expected files with the expected content, and only then copies the tarball into `<folder>`; it refuses a folder that already holds files. It holds only `package.json` (version `0.0.0-reserved.0`, no `bin`, no `scripts`, no dependencies), a `README.md` that says the version only reserves the name, and `LICENSE`. Inspect it: `tar -tzvf <folder>/build-os-0.0.0-reserved.0.tgz`.
2. Stage it from your machine, logged in to npm: `npm stage publish <folder>/build-os-0.0.0-reserved.0.tgz --access public --tag reserved`. `--access public` is already the default for an unscoped package; it stays so that the command matches the workflow's `stage` job. npm 11 refuses a prerelease version without `--tag`, and the dist-tag of a stage cannot change later. Staging creates the package when it does not exist; npm's documentation says it then also shows a placeholder version `0.0.0-stage`. No provenance: this is not a workflow run.
3. Approve it: `npm stage list build-os`, then `npm stage approve <stage-id>`; or, on npmjs.com signed in, open the Staged Packages tab in your account settings, find the version, and click Approve. Both ask for 2FA. Then run `npm view build-os@reserved dist-tags versions --json` and record what it prints (with only the `reserved` tag, a query without a version or tag can print nothing), and record what `latest` points to. npm documents that a publish sets `latest` unless `--tag` is given; it does not document a first publish with `--tag`, so check, do not assume.
4. Configure the trusted publisher: npmjs.com > the package > Settings > Trusted Publisher > GitHub Actions: owner `brucewaynedecoy`, repository `build-os`, workflow file `buildos-release.yml`, environment `buildos-npm-stage`; allow staged publishing only, not `npm publish`, and leave "Allow npm dist-tag" off. The CLI form is `npm trust github build-os --file buildos-release.yml --repo brucewaynedecoy/build-os --env buildos-npm-stage --allow-stage-publish`.
5. Restrict token publishing: npmjs.com > the package > Settings > Publishing access > "Require two-factor authentication and disallow tokens" > Update Package Settings. npm recommends this once trusted publishing is set up.
6. Release `0.1.0` with the release procedure above: tag `v0.1.0`, a draft release, the `prepare` run, your review of the draft, then publish it. Approve the `buildos-npm-stage` job when GitHub asks. The workflow stages `0.1.0` with provenance and the dist-tag `latest`. After the recorded publication approval, approve the stage with 2FA.
7. Check `latest`: `npm view build-os dist-tags`. If `latest` is not `0.1.0`, run `npm dist-tag add build-os@0.1.0 latest` (interactive, 2FA). Then remove the placeholder tag: `npm dist-tag rm build-os reserved`.
8. Deprecate the placeholder versions: `npm deprecate build-os@0.0.0-reserved.0 "Reserved name only. Install 0.1.0 or newer."`, and the same for `0.0.0-stage` if npm made it. Deprecation does not stop an install: npm prints the message to anyone who installs such a version, and an exact pin such as `@0.0.0-reserved.0` still installs it (it holds no program, so it does nothing). With `latest` on `0.1.0`, an install without a version gets `0.1.0`. Do not unpublish them: an unpublished version number can never be used again, and an unpublish cannot be undone. Under the npm Unpublish Policy, within the first 72 hours an owner can unpublish a new package only when no other package in the npm public registry depends on it; after that, only when no other package in the public registry depends on it, it had fewer than 300 downloads in the last week, and it has a single owner or maintainer.
9. Record in the P8 evidence: the placeholder SHA-256, the stage IDs, the dist-tags before and after, and the trusted-publisher settings.

## Authorities

- [`docs/prd/20-buildos-cli-and-distribution.md`](../../docs/prd/20-buildos-cli-and-distribution.md)
- [`docs/prd/17-entity-identity-and-canonical-resolution.md`](../../docs/prd/17-entity-identity-and-canonical-resolution.md)
- [`system/.os/contracts/entity-consolidation-contract.md`](../../system/.os/contracts/entity-consolidation-contract.md)
- [`system/.os/contracts/entity-records-contract.md`](../../system/.os/contracts/entity-records-contract.md)
- [`SECURITY.md`](SECURITY.md)
