// Golden capture tool (W1 R7 P2). Since W1 R7 P8 the Go sources are gone and
// the committed goldens are a frozen parity baseline: they were captured
// from the Go sources at commit 263f5ca76082b42ed9a3fb43bab67929889010ed,
// and e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb is the last commit that holds
// the Go sources (see "Frozen Go Baseline" in CAPTURE.md). The capture modes
// that built and ran the Go tools (no option, --write-shared, --report,
// --check) are retired: they print that and exit 2. These need no Go and
// still work, from toolkits/buildos/:
//
//   node test/golden/capture.mjs --record        # rewrite the CAPTURE.md tables from the
//                                                # capture records
//   node test/golden/capture.mjs --verify-artifact <dir>
//                                                # check a golden set against the SHA-256
//                                                # manifest in its capture record
//   node test/golden/capture.mjs --derive        # write the derived goldens of the platform
//                                                # exception classes (PE-005) from their committed
//                                                # source goldens
//
// Golden sets (see CAPTURE.md):
//   <tool>/<case-id>/                shared set, used on every OS without its own golden
//   os/<platform>/<tool>/<case-id>/  one OS's golden set (darwin, linux, win32)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { platform as osPlatform } from "node:os";
import { join, resolve } from "node:path";
import {
  CAPTURE_RECORD,
  GOLDEN_PLATFORMS,
  GOLDEN_ROOT,
  derivedGoldenProblems,
  loadExceptions,
  loadManifest,
  osGoldenRoot,
  verifyGoldenSet,
  writeDerivedGoldens,
} from "./harness.ts";

/** The Go source commit of every committed golden (each capture record's go_source_commit). */
export const FROZEN_GO_SOURCE_COMMIT = "263f5ca76082b42ed9a3fb43bab67929889010ed";
/** The last commit that holds the Go sources; the next commit deletes them (W1 R7 P8 t12). */
export const LAST_GO_COMMIT = "e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb";

/** Capture modes that built and ran the Go tools; retired in W1 R7 P8. */
const RETIRED = new Set(["--check", "--write-shared", "--report"]);

const args = new Set();
let verifyDir;
{
  const argv = process.argv.slice(2);
  const known = new Set(["--record", "--derive", ...RETIRED]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verify-artifact") {
      verifyDir = argv[++i];
      if (verifyDir === undefined || verifyDir === "") {
        process.stderr.write("capture: --verify-artifact needs a folder\n");
        process.exit(2);
      }
    } else if (known.has(a)) {
      args.add(a);
    } else {
      process.stderr.write(`capture: unknown option ${a}\n`);
      process.exit(2);
    }
  }
}
const platform = osPlatform();
const manifest = loadManifest();
const exceptions = loadExceptions();
const capturePath = join(GOLDEN_ROOT, "CAPTURE.md");

if (args.has("--derive")) {
  if (args.size > 1 || verifyDir !== undefined) {
    process.stderr.write("capture: --derive goes alone\n");
    process.exit(2);
  }
  for (const path of writeDerivedGoldens(manifest, exceptions)) process.stdout.write(`capture --derive: wrote derived golden ${path}\n`);
  const problems = derivedGoldenProblems(manifest, exceptions);
  if (problems.length > 0) {
    process.stderr.write(`capture --derive: ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  process.exit(0);
}

if (verifyDir !== undefined) {
  if (args.size > 0) {
    process.stderr.write("capture: --verify-artifact goes alone\n");
    process.exit(2);
  }
  const dir = resolve(verifyDir);
  const problems = verifyGoldenSet(dir, manifest);
  if (problems.length > 0) {
    process.stderr.write(`capture --verify-artifact: ${dir}: ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}\n`);
    process.exit(1);
  }
  const record = JSON.parse(readFileSync(join(dir, CAPTURE_RECORD), "utf8"));
  process.stdout.write(`capture --verify-artifact: ${dir}: ${Object.keys(record.golden_files).length} file(s) match the ${record.platform} manifest\n`);
  process.exit(0);
}

if (!GOLDEN_PLATFORMS.includes(platform)) {
  process.stderr.write(`capture: no golden set for platform ${platform}; expected one of ${GOLDEN_PLATFORMS.join(", ")}\n`);
  process.exit(2);
}

if (args.has("--record") && args.size === 1) {
  writeOsRecordTable();
  process.stdout.write("capture --record: CAPTURE.md lists every capture record\n");
  process.exit(0);
}
// W1 R7 P8 t12: the Go sources are gone, so no Go capture can run here.
process.stderr.write(
  `capture: the Go goldens are a frozen baseline; capture from Go is retired (W1 R7 P8). ` +
    `They were captured from the Go sources at commit ${FROZEN_GO_SOURCE_COMMIT}; ` +
    `the last commit that holds the Go sources is ${LAST_GO_COMMIT}. ` +
    `See "Frozen Go Baseline" in test/golden/CAPTURE.md for how to recover the Go tools from git history. ` +
    `--verify-artifact, --derive, and --record still work and need no Go.\n`,
);
process.exit(2);

/** Rewrites the per-OS table in CAPTURE.md from os/<platform>/capture-record.json. */
function writeOsRecordTable() {
  const rows = [];
  for (const p of GOLDEN_PLATFORMS) {
    const file = join(osGoldenRoot(p), "capture-record.json");
    if (!existsSync(file)) {
      rows.push(`| \`${p}\` | not captured | | | | | |`);
      continue;
    }
    const r = JSON.parse(readFileSync(file, "utf8"));
    const issues = [
      ...r.shared_drift.map((id) => `drift \`${id}\``),
      ...(r.golden_changes ?? []).map((c) => (c.path === undefined ? `${c.kind} \`${c.case}\`` : `${c.kind} \`${c.path}\``)),
      ...r.exit_mismatches.map((id) => `exit \`${id}\``),
      ...(r.parity_exception_skips ?? []).map((k) => `${k.kind} \`${k.case}\``),
      ...(r.parity_exception_mismatches ?? []).map((k) => `exception-mismatch \`${k.case}\``),
      ...(r.derived_goldens ?? []).map((d) => `derived ${d.derived} \`${d.case}\``),
    ];
    rows.push(`| \`${p}\` | \`${r.os}\` | ${r.runner_image}${r.ci_run === null ? "" : ` ([run](${r.ci_run}))`} | \`${r.repository_commit}\` | \`${r.go_version}\` | ${r.os_goldens} | ${issues.length === 0 ? "none" : issues.join(", ")} |`);
  }
  const block = [
    "<!-- OS-CAPTURE-RECORDS:BEGIN (written by capture.mjs from os/<platform>/capture-record.json) -->",
    "| Set | Operating system | Runner image | Repository commit | Go version | OS goldens | Drift, changed goldens, exit mismatches, approved skips, or derived goldens |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "<!-- OS-CAPTURE-RECORDS:END -->",
  ].join("\n");
  replaceBlock(/<!-- OS-CAPTURE-RECORDS:BEGIN[\s\S]*?<!-- OS-CAPTURE-RECORDS:END -->/, block);
}

function replaceBlock(pattern, block) {
  const text = readFileSync(capturePath, "utf8");
  if (!pattern.test(text)) throw new Error(`CAPTURE.md has no block matching ${pattern}`);
  writeFileSync(capturePath, text.replace(pattern, block));
}
