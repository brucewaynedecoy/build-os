// Records what the three skill scripts do on each fixture case (W1 R7 P9
// t2). A maintainer runs it on a machine with Python 3 (and openpyxl for the
// fit-gap workbook) and Node; CI never runs it, and no test needs Python.
//
//   node test/golden/skills/capture.ts [--script bulk-extract|fitgap|azure-boards] [--check] [--python <program>]
//       [--wheel <file>.whl=<sha256>]...
//
// The scripts leave system/.os/skills/ in W1 R7 P9 Stage 3. This reads each
// from git at SCRIPT_REVISION (`git show`) and checks its SHA-256. Each case
// runs in a fresh temporary project (scenario.ts). Python runs with `-P -s`
// (no script folder, current folder, or user site on the module path),
// PYTHONHASHSEED=0 (work.py writes the keys of a Python set; see
// divergence SD-08), TZ=UTC, LC_ALL=C.UTF-8, and a fixed clock,
// 2026-01-15T12:00:00Z: a small runner replaces `datetime.datetime.now`
// (work.py) or `datetime.date.today` (fitgap.py) before it runs the script
// with `runpy`. BuildOS's
// parity test passes the same clock (RunOptions.now). The goldens are
// test/golden/skills/<script>/cases/<case>.json, the kept workbooks are in
// test/golden/skills/fitgap/xlsx/, and capture-record.json names the
// interpreters, the scripts, and the normalizations. `--check` compares and
// fails on any difference, and writes nothing.
//
// W1 R7 P9 review round 1 (P9-R1-17): capture-record.json holds two kinds of
// facts. Reproducible ones (the script revision and hashes, the flags, the
// clock, the case counts, the normalizations) must be the same on every
// machine, and `--check` compares them. Provenance (the Python, Node,
// openpyxl, and et_xmlfile versions, the operating system, and the SHA-256 of
// each downloaded wheel file, given with `--wheel`) says what made the
// goldens; it differs between fresh installs (an installed RECORD file
// names the installer), so `--check` never compares it. A capture without
// `--wheel` keeps the wheel hashes the record already holds.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareWorkbooks, readXlsx, readXlsxFile } from "../../xlsx-compare.ts";
import { GOLDENS, PACKAGE_ROOT, SCRIPTS, goldenPath, loadCases, runCase, sha256, xlsxGoldenPath, type Runner, type ScriptName } from "./scenario.ts";

/** The commit the scripts were captured from (W1 R7 P8 closeout, the base of W1 R7 P9). */
export const SCRIPT_REVISION = "38d1e08";

export const SCRIPT_FILES: Record<ScriptName, { path: string; sha256: string }[]> = {
  "bulk-extract": [{ path: "system/.os/skills/buildos-bulk-extract/scripts/work.py", sha256: "" }],
  fitgap: [{ path: "system/.os/skills/fit-gap-analysis/scripts/fitgap.py", sha256: "" }],
  "azure-boards": [
    { path: "system/.os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs", sha256: "" },
    { path: "system/.os/skills/buildos-export-azure-boards/scripts/adapters/dynamics-365-ce.mjs", sha256: "" },
  ],
};

export const FIXED_NOW = "2026-01-15T12:00:00Z";

const RUNNER = `# The fixed clock of the skill-script goldens (test/golden/skills/capture.ts).
import datetime as _dt, runpy, sys
_FIXED = _dt.datetime(2026, 1, 15, 12, 0, 0, tzinfo=_dt.timezone.utc)
class _DateTime(_dt.datetime):
    @classmethod
    def now(cls, tz=None):
        return _FIXED.astimezone(tz) if tz is not None else _FIXED.replace(tzinfo=None)
class _Date(_dt.date):
    @classmethod
    def today(cls):
        return _dt.date(2026, 1, 15)
# work.py reads datetime.now; fitgap.py reads date.today (openpyxl type-checks
# datetime values, so the workbook run keeps the real datetime class).
if sys.argv[1] == "datetime":
    _dt.datetime = _DateTime
else:
    _dt.date = _Date
script = sys.argv[2]
sys.argv = sys.argv[2:]
runpy.run_path(script, run_name="__main__")
`;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const check = process.argv.includes("--check");
/** `--wheel <file>.whl=<sha256>`, repeated: provenance only (P9-R1-17). */
const givenWheels: Record<string, string> = {};
process.argv.forEach((value, i) => {
  if (value !== "--wheel") return;
  const given = process.argv[i + 1] ?? "";
  const eq = given.lastIndexOf("=");
  if (eq < 1 || !/^[0-9a-f]{64}$/.test(given.slice(eq + 1))) throw new Error("--wheel needs <file>.whl=<sha256>");
  givenWheels[given.slice(0, eq)] = given.slice(eq + 1);
});

interface CaptureRecord {
  $comment: string;
  script_revision: string;
  scripts: Record<string, string>;
  python_flags: string;
  clock: string;
  cases: Record<string, number>;
  provenance?: { $comment: string; python: string; openpyxl: string; openpyxl_note: string; wheels: Record<string, string>; wheels_note: string; node: string; capture_os: string };
  normalizations: Record<string, string>;
}
const python = arg("--python") ?? "python3";
const only = arg("--script") as ScriptName | undefined;
const shaFile = join(GOLDENS, "script-sha256.json");
const pinned = JSON.parse(readFileSync(shaFile, "utf8")) as Record<string, string>;
const env = { PATH: process.env["PATH"] ?? "", LANG: "C.UTF-8", LC_ALL: "C.UTF-8", PYTHONIOENCODING: "utf-8", PYTHONHASHSEED: "0", PYTHONDONTWRITEBYTECODE: "1", TZ: "UTC" };

const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-skills-capture-")));
let failures = 0;
try {
  const skill = join(work, "skill");
  const runnerPath = join(work, "fixed_clock.py");
  writeFileSync(runnerPath, RUNNER);
  const scripts: Record<string, string> = {};
  for (const script of SCRIPTS) {
    for (const file of SCRIPT_FILES[script]) {
      const data = execFileSync("git", ["show", `${SCRIPT_REVISION}:${file.path}`], { cwd: PACKAGE_ROOT, maxBuffer: 1 << 26 });
      const sum = sha256(data);
      if (pinned[file.path] !== sum) throw new Error(`${file.path} at ${SCRIPT_REVISION} has SHA-256 ${sum}, not the pinned ${pinned[file.path] ?? "(none)"}`);
      const target = join(skill, file.path.replace("system/.os/skills/", ""));
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, data);
      scripts[file.path] = sum;
    }
  }
  const palette = execFileSync("git", ["show", `${SCRIPT_REVISION}:system/.os/skills/fit-gap-analysis/config/owner-colors.json`], { cwd: PACKAGE_ROOT });
  const pythonVersion = execFileSync(python, ["-I", "--version"], { encoding: "utf8" }).trim();
  const openpyxl = spawnSync(python, ["-P", "-s", "-c", "import openpyxl, et_xmlfile; print(openpyxl.__version__, et_xmlfile.__version__)"], { encoding: "utf8", env });
  const nodeVersion = process.version;

  const run = (cmd: string, args: string[], dir: string, stdin: Buffer | undefined) => {
    const result = spawnSync(cmd, args, { cwd: dir, env, ...(stdin === undefined ? { stdio: ["ignore", "pipe", "pipe"] } : { input: stdin }), maxBuffer: 1 << 28 });
    if (result.error !== undefined) throw result.error;
    return { exit: result.status ?? -1, stdout: result.stdout.toString("utf8"), stderr: result.stderr.toString("utf8") };
  };
  const runners: Record<ScriptName, (paletteOn: boolean) => Runner> = {
    "bulk-extract": () => async (args, dir, stdin) => run(python, ["-P", "-s", runnerPath, "datetime", join(skill, "buildos-bulk-extract/scripts/work.py"), "--repo-root", dir, ...args], dir, stdin),
    fitgap: (paletteOn) => async (args, dir, stdin) => {
      const config = join(skill, "fit-gap-analysis/config");
      rmSync(config, { recursive: true, force: true });
      if (paletteOn) {
        mkdirSync(config, { recursive: true });
        writeFileSync(join(config, "owner-colors.json"), palette);
      }
      return run(python, ["-P", "-s", runnerPath, "date", join(skill, "fit-gap-analysis/scripts/fitgap.py"), ...args], dir, stdin);
    },
    "azure-boards": () => async (args, dir, stdin) => run(process.execPath, [join(skill, "buildos-export-azure-boards/scripts/azure_boards_csv.mjs"), ...args], dir, stdin),
  };

  const counts: Record<string, number> = {};
  for (const script of only === undefined ? SCRIPTS : [only]) {
    const cases = loadCases(script);
    counts[script] = cases.length;
    const casesDir = join(GOLDENS, script, "cases");
    const xlsxDir = join(GOLDENS, script, "xlsx");
    if (!check) {
      rmSync(casesDir, { recursive: true, force: true });
      rmSync(xlsxDir, { recursive: true, force: true });
      mkdirSync(casesDir, { recursive: true });
    }
    for (const testCase of cases) {
      const kept: [string, Buffer][] = [];
      const golden = await runCase(script, testCase, join(work, "projects", script), runners[script](testCase.palette !== false), (dir) => [dir, realpathSync(dir)], (path, data, step) => kept.push([xlsxGoldenPath(script, testCase.id, step, path), data]));
      const text = `${JSON.stringify(golden, null, 2)}\n`;
      const file = goldenPath(script, testCase.id);
      if (check) {
        let old = "";
        try {
          old = readFileSync(file, "utf8");
        } catch {
          // missing
        }
        // openpyxl writes the current time into a workbook, so a workbook is checked by content (N3), not by its hash.
        const unhashed = (t: string): string => t.replace(/"xlsx": "[0-9a-f]{64}"/g, '"xlsx": "<content>"');
        if (unhashed(old) !== unhashed(text)) {
          failures++;
          process.stderr.write(`differs: ${script}/${testCase.id}\n`);
        }
        for (const [path, data] of kept) {
          const diffs = compareWorkbooks(readXlsxFile(path), readXlsx(data));
          if (diffs.length > 0) {
            failures++;
            process.stderr.write(`differs: ${script}/${testCase.id} workbook content (${diffs.length} differences)\n`);
          }
        }
      } else {
        writeFileSync(file, text);
        for (const [path, data] of kept) {
          mkdirSync(xlsxDir, { recursive: true });
          writeFileSync(path, data);
        }
      }
    }
  }
  const recordFile = join(GOLDENS, "capture-record.json");
  let previous: CaptureRecord | undefined;
  try {
    previous = JSON.parse(readFileSync(recordFile, "utf8")) as CaptureRecord;
  } catch {
    previous = undefined;
  }
  const wheels = Object.keys(givenWheels).length > 0 ? givenWheels : (previous?.provenance?.wheels ?? {});
  const record: CaptureRecord = {
    $comment: "Written by test/golden/skills/capture.ts (W1 R7 P9 t2; review round 1, P9-R1-17). What the three skill scripts did on each fixture case, captured on a maintainer machine. CI never runs Python. capture.ts --check compares every field except provenance.",
    script_revision: SCRIPT_REVISION,
    scripts,
    python_flags: "-P -s (PYTHONHASHSEED=0, TZ=UTC, LC_ALL=C.UTF-8, PYTHONIOENCODING=utf-8)",
    clock: FIXED_NOW,
    cases: counts,
    provenance: {
      $comment: "What made the goldens. Not compared by --check: it differs between machines and fresh installs.",
      python: pythonVersion,
      openpyxl: openpyxl.status === 0 ? openpyxl.stdout.trim() : "not available",
      openpyxl_note: "The openpyxl and et_xmlfile versions, from a throwaway virtual environment under the temporary folder; never committed.",
      wheels,
      wheels_note: "The SHA-256 of each wheel file installed into that environment, as PyPI publishes it (given with --wheel).",
      node: nodeVersion,
      capture_os: `${process.platform} ${process.arch}`,
    },
    normalizations: {
      N1: "The project folder path (as given and as resolved) becomes <root>; in BuildOS output on Windows, \\ after <root> becomes /.",
      N2: "A Python traceback keeps its last line only, so no machine path or line number is kept.",
      N3: "A written .xlsx is recorded by its SHA-256 and kept in <script>/xlsx/; the parity test compares workbook content, not bytes (parity exception PE-021).",
      N4: "The clock is fixed at 2026-01-15T12:00:00Z for the script (a runner that replaces datetime.datetime.now for work.py and datetime.date.today for fitgap.py) and for BuildOS (RunOptions.now).",
    },
  };
  const recordText = `${JSON.stringify(record, null, 2)}\n`;
  const reproducible = (r: CaptureRecord | undefined): string => JSON.stringify(r === undefined ? null : { ...r, provenance: undefined });
  if (only === undefined) {
    if (check) {
      if (reproducible(previous) !== reproducible(record)) {
        failures++;
        process.stderr.write("differs: capture-record.json\n");
      }
    } else writeFileSync(recordFile, recordText);
  }
  process.stdout.write(`${check ? "checked" : "captured"} ${Object.entries(counts).map(([s, n]) => `${s} ${n}`).join(", ")} with ${pythonVersion} and Node ${nodeVersion}\n`);
  void readdirSync;
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failures > 0) {
  process.stderr.write(`${failures} difference(s)\n`);
  process.exitCode = 1;
}
