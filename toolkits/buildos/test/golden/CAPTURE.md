# Golden Capture

These goldens record what the four Go tools did. They are the parity reference for the TypeScript CLI since W1 R7 P3. The phase that made them is [W1 R7 P2 Golden Capture](../../../../docs/work/2026-11-23-w1-r7-buildos-node-typescript-cli-rewrite/02-golden-capture.md). W1 R7 P8 removed the Go sources, so the goldens are now a frozen baseline: see [Frozen Go Baseline](#frozen-go-baseline).

## Capture Record

The capture script writes these tables. The first names the capture that made the shared set (`capture.mjs --write-shared`). The second lists each operating system's set from its `os/<platform>/capture-record.json`: the operating system, the runner image, the commit, the Go version, the number of OS goldens, and any drift, changed golden, exit-code mismatch, approved PE-005 skip, or derived golden.

<!-- CAPTURE-RECORD:BEGIN (written by capture.mjs --write-shared) -->
| Field | Value |
| --- | --- |
| Repository commit (HEAD) | `83cc9b624c255fc85dd94d55fd5f84375407f7f2` |
| Last commit that changed the Go sources | `263f5ca76082b42ed9a3fb43bab67929889010ed` |
| Go version | `go version go1.24.1 darwin/arm64` |
| Operating system | `darwin 27.2.0 arm64` |
| Node version (capture driver) | `v24.22.3` |
| Shared cases | 85 |
<!-- CAPTURE-RECORD:END -->

<!-- OS-CAPTURE-RECORDS:BEGIN (written by capture.mjs from os/<platform>/capture-record.json) -->
| Set | Operating system | Runner image | Repository commit | Go version | OS goldens | Drift, changed goldens, exit mismatches, approved skips, or derived goldens |
| --- | --- | --- | --- | --- | --- | --- |
| `darwin` | `darwin 27.2.0 arm64` | local (not a CI runner) | `83cc9b624c255fc85dd94d55fd5f84375407f7f2` | `go version go1.24.1 darwin/arm64` | 73 | none |
| `linux` | `linux 7.0.0-1020-azure x64` | ubuntu26 20261116.202.1 ([run](https://github.com/brucewaynedecoy/build-os/actions/runs/45293367433)) | `8be0b7089a3daaac60e878d40597f4ff9083949e` | `go version go1.24.1 linux/amd64` | 73 | none |
| `win32` | `win32 10.0.26100 x64` | win25-vs2026 20261116.315.1 ([run](https://github.com/brucewaynedecoy/build-os/actions/runs/45298345720)) | `733e428de4926daf18a1dec48ef7788c5facf036` | `go version go1.24.1 windows/amd64` | 70 | pe-005-skipped `entities-rebuild-apply-missing-json`, pe-005-skipped `entities-consolidate-apply-json`, pe-005-skipped `entities-consolidate-apply-index-failure-json`, pe-005-skipped `design-promote-baseline`, pe-005-skipped `design-promote-change-redirected`, pe-005-skipped `design-installed-promote`, derived PE-005 `entities-rebuild-apply-missing-json`, derived PE-005 `entities-consolidate-apply-json`, derived PE-005 `entities-consolidate-apply-index-failure-json` |
<!-- OS-CAPTURE-RECORDS:END -->

## Layout

| Path | What it holds |
| --- | --- |
| `cases.json` | The case manifest: domains and their `pending` or `enforced` state, normalizations, the JSON-mode table, and every case. |
| `<tool>/<case-id>/` | The shared set: one golden per case whose Go output is the same on every operating system. Each golden holds `stdout`, `stderr`, `result.json` (exit code, file tree changes, SHA-256 of each output, and `modes`: the permission bits of every added or changed file and folder), and `files/<path>` with the bytes of every added or changed file. |
| `os/<platform>/<tool>/<case-id>/` | One operating system's set (`darwin`, `linux`, or `win32`), in the same form. It holds every OS-dependent case, plus any shared case whose Go output differed on that system. |
| `os/<platform>/capture-record.json` | The record of that set's capture: operating system, runner image, CI run, commit, Go version, case umask, drift, changed goldens, exit-code mismatches, `parity_exception_skips` (cases skipped under PE-005, each with its `observation_sha256`), `parity_exception_mismatches` (PE-005 cases whose Go observation was not the recorded defect), `derived_goldens` (each derived golden with its source and SHA-256), and `golden_files`, the SHA-256 of every file in the set (hidden files included). |
| `os/win32/buildos/<case-id>/` with `derived` in `result.json` | A derived golden (see [Platform Exception Classes](#platform-exception-classes-pe-005)): made by `capture.mjs --derive` from a committed source golden, never captured from Go. |
| `parity-exceptions.json` | Approved differences from the Go output, each with its owner decision. A `golden` entry holds the exact allowed TypeScript value of one field of one case; an entry with `platform` (`darwin`, `linux`, or `win32`) applies only on that operating system, for an OS-dependent case whose value differs by system (PE-004 since P3). PE-005 is a platform exception class: its `cases` list is the only allow-list for capture skips and derived goldens. PE-023 is the class rule for printed fix commands: see [Printed Fix Commands (PE-023)](#printed-fix-commands-pe-023). |
| `proposed-exceptions.json` | Proposed parity exceptions that wait for an owner decision and are not approved (PE-009 to PE-011 since P4). The harness holds each to its exact pinned value: a `golden` entry matches one field of one case exactly and the compare summary lists it as pending; an owner approval moves an entry to `parity-exceptions.json`. PE-009 (approved) is a class exception: every PDF comparison with Go runs `pdfWordGapClass` in `harness.ts`, and its `pdf` entries are regression fixtures that record the exact spaces the class check finds. |
| `evidence/pe-005-win32/<tool>/<case-id>/` | The real Go 1.24.1 defect observation of each PE-005 case on Windows, copied unchanged from the `buildos-goldens-win32` artifact of capture run 45293367433. It is evidence, not a golden: no golden set reads it. `pe-005.test.ts` recomputes each `go_observation_sha256` from it. |
| `harness.ts` | Shared code for capture and comparison. |
| `capture.mjs` | The maintainer capture script. Since W1 R7 P8 it only checks (`--verify-artifact`), derives (`--derive`), and writes the record tables (`--record`); its Go capture modes are retired. |
| `compare.test.ts` | The comparison harness that CI runs. |
| `self-test.test.ts` | The planted-difference self-test. |
| `printed-command.test.ts` | PE-023: each list of the printed-command class is exactly where the form occurs, and every other difference still fails. |
| `selection.test.ts` | Tests that pick the shared or per-OS golden and report `missing-golden`. |
| `review-fixes.test.ts` | Regression tests for the P2 review fixes: root encodings and literal tokens, permission bits, exact exception fields, capture drift, the artifact manifest, the capture workflow, and flag coverage. |
| `pe-005.test.ts` | Simulated win32 tests for PE-005: golden selection, the exact-digest capture skip, the rule that a derived golden counts only for a PE-005 case, and the `--verify-artifact` PE-005 rules. |
| `fixtures.test.ts` | Checks that the binary fixtures match the generator, stay small, hold no carriage return, and carry `-text`. |
| `generate-fixtures.ts` | Writes the binary fixtures under `test/fixtures/golden/`. |
| `../fixtures/golden/` | Synthetic fixture projects for intake, discovery, and design, in the repository layout and the installed layout. Entity cases reuse the synthetic `testdata/persona-pilot/` fixture in place; keep it when P8 removes the Go code. |

## Golden Selection

Each case uses the golden captured on the running operating system when `os/<platform>/` has one. Otherwise it uses the shared golden. A case marked `os_dependent` in `cases.json` has no shared golden: without a golden for the running operating system, the harness reports it as `missing-golden`. That fails an enforced domain and is listed for a pending domain.

`cases.json` names each OS-dependent case's group in `os_dependent_groups`, with the reason:

- `OSD-1`: the output prints an absolute path inside the fixture copy, joined with the system separator (`\` on Windows).
- `OSD-2`: the output prints an operating system file error, such as `no such file or directory`, next to such a path. Windows has different error text.

The Go output on each operating system is the parity target (PRD 20 Compatibility). So these cases get per-OS goldens from the real Go tools on each system, not parity exceptions. The one approved departure is PE-005, below.

A golden whose `result.json` has a `derived` field was not captured from Go. The harness uses it only when a platform exception class in `parity-exceptions.json` lists that case with a derived golden for that operating system, from the same source folder. Any other derived golden is `missing-golden`, and `compare.test.ts`, `capture.mjs`, and `--verify-artifact` report it.

## Platform Exception Classes (PE-005)

PE-005, "Go Windows directory-sync defect", is an owner decision (2026-11-23, option A). Go 1.24.1 on Windows fails in six cases after the rename has already committed: it opens the parent folder read-only and calls `Sync`, and Windows returns `Access is denied.`. On Windows, the parity target of these cases is the Go result on Linux and macOS. The TypeScript CLI must not reproduce the defect (P3 t14, P5 t11). The cases, with the golden Windows uses:

| Case | Go on win32 | Windows golden |
| --- | --- | --- |
| `entities-rebuild-apply-missing-json` | exit 5, `sync entity-resolution index directory: ... Access is denied.` | derived, `os/win32/buildos/entities-rebuild-apply-missing-json/` |
| `entities-consolidate-apply-json` | exit 5, `sync canonical directory: ... Access is denied.` | derived, `os/win32/buildos/entities-consolidate-apply-json/` |
| `entities-consolidate-apply-index-failure-json` | exit 5, `sync canonical directory: ... Access is denied.` | derived, `os/win32/buildos/entities-consolidate-apply-index-failure-json/` |
| `design-promote-baseline` | exit 1, `replace findings index: sync ... Access is denied.` | the shared golden |
| `design-promote-change-redirected` | exit 1, `replace findings index: sync ... Access is denied.` | the shared golden |
| `design-installed-promote` | exit 1, `replace findings index: sync ... Access is denied.` | the shared golden |

Capture on Windows: the allow-list is PE-005's `cases` in `parity-exceptions.json`; there is no second list. Each case records `go_observation_sha256`, the digest of the complete normalized Go defect observation, and `go_observation_evidence`, where it comes from. `go_exit` and `go_text` (in `go_stream`) only describe the defect for readers. A listed case is skipped only when the digest of its observation equals `go_observation_sha256` exactly. Then it is not written or compared, is not an exit mismatch, and is listed in `parity_exception_skips` as `pe-005-skipped`, with the golden Windows uses instead and its `observation_sha256`. Any other observation of a listed case (a second error, other stderr or stdout, another exit code, or another filesystem effect) is a parity exception mismatch. The capture lists it in `parity_exception_mismatches` and fails, even with `--report`. If Go stops failing, the capture fails too, so PE-005 gets reviewed. Every other case still fails on any mismatch or drift.

The digest (`observationDigest` in `harness.ts`) is the SHA-256 of the JSON text of `{exit, stdout_sha256, stderr_sha256, added, changed, removed, files, links, modes}`. `stdout_sha256` and `stderr_sha256` are the SHA-256 of the full normalized streams. `added`, `changed`, and `removed` are `[path, kind]` pairs in snapshot order. `files` (the SHA-256 of each added or changed file), `links`, and `modes` (null on Windows) are `[path, value]` pairs sorted by path. The six digests come from the real win32 observations in the `buildos-goldens-win32` artifact of capture run 45293367433 (commit `8be0b70`, before the skip existed). That run wrote Go's defect output as goldens. Copies are in `evidence/pe-005-win32/`. Capture run 45296349916 (commit `bd67f5e`, same Go source commit, Go version, and runner image, and no change to the fixtures or the normalization) confirms them: it skipped the same six cases with the same exit codes. To compute a digest from a downloaded golden folder, run this from `toolkits/buildos/`: `node -e 'import("./test/golden/harness.ts").then((h) => console.log(h.goldenObservationDigest(process.argv[1])))' <folder>`.

Derived goldens: the three design cases are shared cases. Go prints only `/`-separated relative paths there (`filepath.ToSlash`), and their files hold no path text that depends on the system, so Windows uses the shared golden. The three entity cases are `os_dependent`, so `node test/golden/capture.mjs --derive` (runs no Go) writes each one's win32 golden from its committed linux golden, which must equal its darwin golden. The transformation:

1. Each `windows_text` entry in PE-005 replaces its `from` text with its `to` text. `raw` entries apply to the stream as printed, first. `json-string` entries apply inside each decoded JSON string. Each `from` must occur exactly once. Only `entities-consolidate-apply-index-failure-json` has entries: the Windows error text of the index step, and the `index` object Go adds when that step fails at the write instead of the read. Each entry records its evidence.
2. Windows path spelling: in stdout and stderr, with each JSON string decoded first, every `{ROOT}` followed by `/`-separated segments gets `\` separators, or `\\` when the `{ROOT}` directly follows a `"` (a Go `%q` string). Changed JSON strings are encoded again with Go's `encoding/json` escaping.
3. `modes` is dropped, because Windows has no permission bits. Exit code, file tree, and every file stay as captured.

The derived `result.json` holds `derived`: the exception ID, the source folder, and `source_sha256` (the SHA-256 of the source folder's sorted `<path> <SHA-256>` lines). A capture keeps the derived goldens and lists them in `derived_goldens` with their own SHA-256. `capture.mjs`, `--check`, and `compare.test.ts` fail when a derived golden is missing, differs from a fresh derivation, or is not allowed. After a change to a source golden or to PE-005, run `--derive` again.

`--verify-artifact` enforces PE-005 on a downloaded set, against the committed goldens:

- The derived goldens are exactly the three that PE-005 lists for the set's platform. Each has the PE-005 mark and source, and exactly one matching `derived_goldens` entry. No other case has a derived golden or a `derived_goldens` entry.
- It recomputes the SHA-256 of each derived golden folder and of its committed source golden. Both must equal the record entry and the `result.json` mark (so an all-zero SHA-256 fails). The folder must also equal a fresh derivation from the committed source.
- The three shared design cases have no folder in any set, derived or captured.
- `parity_exception_skips` lists exactly the six PE-005 cases of the platform. Each has the PE-005 kind, exit codes, and golden, and an `observation_sha256` equal to PE-005's `go_observation_sha256`. A record from before this rule has no `observation_sha256`, so it fails and needs a fresh capture.

## Printed Fix Commands (PE-023)

PE-023 (owner decision 2026-11-26, F-P8-11 and F-P8-10) changes the printed fix commands, not the goldens. `applyPrintedCommands` in `harness.ts` turns each Go form in a golden into the form the port prints, in the text as printed and inside each JSON string (decoded, then encoded again with Go's escaping):

- `buildos entities rebuild-index --root <Go %q root> --mode <mode> --apply` becomes `<program> entities rebuild-index --root <quoted root> --mode <mode> --apply`. The quoted root is `'<root>'` on Linux and macOS and `"<root>"` with each `\` written once on Windows.
- `Run buildos help for command syntax.` becomes `Run <program> help for command syntax.`.
- On Windows only, a rebuild command on a human `action:` line (the text as printed, never a JSON string) gets the shell label: `  action: run this in Command Prompt: <command>`, with `, with delayed expansion off` after `Command Prompt` when the command holds a `!` (F-P8-11 review round 1). The `label` list names the one case: `entities-validate-missing-index-strict` on win32.

`<program>` is `buildos` for the goldens' development identity and `npx -y build-os@<version>` for a release identity (`BUILDOS_GOLDEN_EXPECT_VERSION`). `compare.test.ts` applies the rule to every selected golden and fails when a form occurs in a case that PE-023 does not list for the running system, or not in a listed one. The entity edge seeds and the `$PWD` seeds get the same rule with `buildos` (`seedWithPrintedCommands`). No golden file changes.

## Frozen Go Baseline

W1 R7 P8 (t11 to t13) removed the Go sources after the entities, intake, discovery, and design parity gates had passed on three operating systems. The committed goldens are now the frozen parity baseline. No golden changes again, because no Go tool remains to capture from.

Commit hashes in these docs from before the public repository (for example the frozen Go baseline `263f5ca`) name commits of the earlier history, which exists only in the private archive repository `brucewaynedecoy/build-os-archive`: the public repository starts from one clean commit (owner decision of 2026-11-25).

| Fact | Value |
| --- | --- |
| Go source commit of every golden (each capture record's `go_source_commit`) | `263f5ca76082b42ed9a3fb43bab67929889010ed` |
| Last commit that holds the Go sources | `e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb` |
| Go version | `go1.24.1` |
| Go changes between the two commits | One line of one Go test file (`buildos-intake/internal/intake/convert_test.go`) and the removal of two committed binaries; no Go tool code |

Comments in the TypeScript sources and tests that name a Go file (for example `internal/entities/consolidate.go` or `toolkits/buildos-intake/internal/intake/convert.go`) name that file at `263f5ca`. They are historical references.

What still runs without Go: `compare.test.ts` (every golden against the bundle and, in CI, against the installed tarball), `self-test.test.ts`, the fixture checks, and these `capture.mjs` modes, from `toolkits/buildos/`:

```sh
node test/golden/capture.mjs --verify-artifact <dir>  # checks a golden set against its manifest
node test/golden/capture.mjs --derive        # writes the PE-005 derived goldens from their source goldens
node test/golden/capture.mjs --record        # rewrites the Capture Record tables
```

`node test/golden/capture.mjs` with no option, `--write-shared`, `--report`, or `--check` prints that capture is retired and exits 2. The capture workflow `buildos-golden-capture.yml` is deleted. The `scripts/capture-*.ts` drivers keep their case lists, which the tests import; their capture entry points take the path of a Go binary that you build yourself, as below.

To recover the Go tools from git history (for example to check a parity question):

```sh
git worktree add <scratch-folder> 263f5ca76082b42ed9a3fb43bab67929889010ed
cd <scratch-folder>/toolkits/buildos && go build -trimpath -o <bin>/buildos ./cmd/buildos
cd ../buildos-intake && go build -trimpath -o <bin>/buildos-intake ./cmd/buildos-intake
cd ../buildos-discovery && go build -trimpath -o <bin>/buildos-discovery ./cmd/buildos-discovery
cd ../buildos-design && go build -trimpath -o <bin>/buildos-design ./cmd/buildos-design
```

Use Go 1.24.1 with `GOTOOLCHAIN=local`, `GOFLAGS=-mod=readonly`, and `CGO_ENABLED=0`, as the capture did. These commit SHAs are in the earlier history, which exists only in the private archive repository `brucewaynedecoy/build-os-archive` (owner decision of 2026-11-25; see [Frozen Go Baseline](#frozen-go-baseline)). A difference between the port and the Go output still needs a parity exception with an owner decision (PRD 20 Compatibility), never a golden change.

### How the Goldens Were Captured

This is the record of the retired process, for a reader of the capture records. The per-OS sets came from the capture workflow (`.github/workflows/buildos-golden-capture.yml`, deleted in W1 R7 P8). It ran on a push to a branch named `golden-capture/**`, built the four Go tools from source on Linux, Windows, and macOS with a checksum-pinned Go 1.24.1, captured every case with `capture.mjs --report`, proved that a second capture was byte-identical (`--check`), and uploaded each system's set as an artifact. A maintainer verified each downloaded artifact with `--verify-artifact` and committed it with the reason in the commit message and the evidence report. The shared set came from a local `capture.mjs --write-shared` on macOS. Each case ran in a fresh temporary copy of its fixture, with the working folder set to the copy (`PWD` too), `TZ=UTC`, and umask `022`, and the capture recorded stdout, stderr, the exit code, and every added, changed, or removed file and folder. Drift, changed goldens, stale golden folders, and exit-code mismatches failed a capture unless `--report` recorded them for review.

## Skill-Script and Validator Sources

Two Python-backed capture tools, outside the Go baseline, read old scripts. Neither runs in CI, and no test needs Python. `test/capture-sources.test.ts` checks that every commit a capture tool reads is in this repository.

| Fact | Value |
| --- | --- |
| Skill scripts and palette are read from (the first commit of the public repository) | `085927e3c1324fc73fe57af9493ca0b01fcaed18` |
| Skill-script goldens were captured from (capture provenance) | `38d1e08` |
| Validator goldens were captured from (capture provenance) | `0560ba1` |

The skill-script capture (`test/golden/skills/capture.ts`, `test/golden/skills/script-source.ts`) reads the four skill scripts and the fit-gap palette with `git show` at the first public commit. It checks each file's SHA-256 against `test/golden/skills/script-sha256.json`. The committed goldens were captured from `38d1e08`, where the five files have the same SHA-256, so the goldens did not change when the source commit changed (W1 R7 P9 review round 1 on the public repository).

Since F-P9-04 (2026-11-26) it also reads the capability-matrix tool `cm_build.py`, which is not a file: `system/.os/skills/capability-matrix/SKILL.md` embedded it in its appendix ("Appendix — `cm_build.py`") as a fenced `python` block. The capture reads `SKILL.md` at the same first public commit, checks its SHA-256, takes the block out (`embeddedScript` in `script-source.ts`), checks the block's own SHA-256 (the key `system/.os/skills/capability-matrix/SKILL.md#cm_build.py` in `script-sha256.json`), and runs it with `-P -s` as `cm_build.py`, as the skill ran it. Its goldens (`test/golden/skills/capability-matrix/`) were captured from that commit directly; `capture-record.json` records the capture under `provenance.captures`. `capture.ts --script capability-matrix` writes only those goldens and keeps the other three scripts' goldens and record entries.

The validator capture (`test/golden/validate/capture.ts`) needs `--script <path>`: a copy of `system/.os/scripts/validate_config.py` at `0560ba1`, with the SHA-256 that the tool pins. The script was deleted in W1 R7 P7, before the public repository started, so no commit here holds it.

`38d1e08` and `0560ba1` are in the earlier history, which exists only in the private archive repository `brucewaynedecoy/build-os-archive` (owner decision of 2026-11-25; see [Frozen Go Baseline](#frozen-go-baseline)). No tool reads them from git.

## Normalizations

Only values that change from run to run are normalized. `cases.json` lists each one with its reason:

- N1 `{ROOT}`: the temporary fixture copy, in every spelling and encoding. Spellings: the given path, its real path, and its native real path (on Windows, the 8.3 short form such as `RUNNER~1` and the long form), each with `/` and, on Windows, `\` separators and both drive-letter cases. Encodings of each: as printed, JSON-escaped (Go `encoding/json`, which doubles each `\` and escapes `<`, `>`, and `&`), and Go-quoted (`%q`). Only the root is replaced; the separators and the relative path after `{ROOT}` stay as printed. `%q` or JSON quoting applied again to an already quoted root, at any depth, is found too.

JSON output: stdout of a case with `json: true` must be one valid JSON document, else the case fails (field `stdout:json`) and `capture.mjs` exits 1. The harness decodes each JSON string, normalizes the decoded text (so a root inside a `%q`-quoted message is found as Go wrote it), and encodes it again with the escaping the string used. Every byte outside a substituted value stays as printed, so invalid JSON can never normalize to the same bytes as valid JSON.
- N2 `{TIMESTAMP}`: an RFC 3339 UTC time stamp inside the run window. Fixture time stamps stay exact.
- N3 `designs/{DATE}-`: the run date at the start of a promoted design file name, after `/`, `\`, or JSON-escaped `\\`.

Literal tokens: before any substitution, output that already holds the text `{ROOT}`, `{TIMESTAMP}`, or `{DATE}` (or the escape mark `{!`) gets `{!` in place of its `{`. So a program that prints the literal text `{ROOT}` never matches a golden where Go printed the fixture folder. The escape is one-to-one, so the harness compares the escaped bytes; error messages may show the text with `{!` turned back into `{`.

File tree: the harness reads every entry with `lstat` and never follows a symbolic link. It records the entry type (`file`, `dir`, `symlink`, or `other`), so a link where Go writes a regular file is a tree difference. `result.json` has `links`, the target text of every added or changed link, only when there is one (field `link:<path>`). The fixture copy folder itself is entry `.`, so a change to its own mode is a change.

Permission bits: on POSIX systems the harness records the mode of every added or changed file and folder, and of the fixture copy folder, in `result.json` (`modes`), and fails a case whose mode differs (field `mode:<path>`). Every case runs under umask `022`. Windows has no POSIX permission bits, so a Windows run neither records nor compares them.

PDF text cases (`pdf_text`) compare the body of each written `.txt` file after whitespace and line-break normalization, as PRD 07 allows. Their front matter, stdout, stderr, exit code, and file tree stay byte for byte.

## Operating Systems

Goldens are stored with `-text` in `.gitattributes`, so git never changes their bytes on any operating system. The retired capture workflow also turned off `core.autocrlf` before checkout.

The `darwin` set comes from a local macOS capture. It is the same Go output as the shared set's capture. The CI darwin capture of run 45293367433 had the same bytes in every golden file. The `linux` set comes from the capture workflow (run 45293367433). The `win32` set comes from the capture workflow (run 45298345720): 70 captured goldens and the three PE-005 derived goldens (see [Platform Exception Classes](#platform-exception-classes-pe-005) and the evidence report, P2 Windows Goldens Import). Each port phase needs every operating system's set for its domain before it turns the domain to `enforced`.

## Refresh Rule

Since W1 R7 P8 the goldens do not change: the Go tools they record are gone (see [Frozen Go Baseline](#frozen-go-baseline)). Never copy the TypeScript CLI's output into a golden. Never edit a golden by hand. A derived golden comes only from `capture.mjs --derive`, for a case that a platform exception class lists. A difference that the port must keep needs a parity exception with an owner decision, not a golden change. A new Go parity case after P8 needs the Go tools recovered from history as described above, a capture with the `capture.mjs` of that recovered commit (it still has the capture modes), a recorded reason, and an evidence report entry.

## Domain States

A domain is `pending` until its port phase turns it to `enforced`. A pending domain's cases still run, and the harness lists their match count in its summary, but they do not fail CI. Turning a domain to `enforced` is the parity gate of its port phase: P3 for `entities`, P4 for `intake`, and P5 for `discovery` and `design`. The `cli` domain (`buildos version` and `help`) is enforced from P2, because P1 already brought it to parity. The `entities` domain is enforced from P3.
