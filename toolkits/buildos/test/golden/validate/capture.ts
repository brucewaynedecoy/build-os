// Records what the legacy validator, `validate_config.py`, says about each
// validate fixture case (W1 R7 P7 t13). A maintainer runs it; CI never does,
// and no test needs Python.
//
//   node test/golden/validate/capture.ts --script <path> [--check] [--python <program>]
//
// The script was deleted from system/.os/scripts/ in W1 R7 P7 t16, before the
// public repository started, so no commit of this repository holds it.
// `--script` names a copy of `system/.os/scripts/validate_config.py` at
// SCRIPT_REVISION, a commit of the earlier history, which exists only in the
// private archive repository brucewaynedecoy/build-os-archive
// (test/golden/CAPTURE.md, Skill-Script and Validator Sources). The capture
// checks the copy's SHA-256 against SCRIPT_SHA256 and refuses any other.
//
// For each case it builds the source layout of the case project (cases.ts
// `materialize`, normalization N2) in a fresh temporary folder, runs
//
//   <python> -I <script> --repo-root <tmp> --config <tmp>/system/.os/config/instance.yaml
//            --contract <tmp>/system/.os/contracts/config-contract.md --data-dir <tmp>/system/.os/data
//
// and writes test/golden/validate/cases/<id>.json: the exit code, stdout, and
// stderr, normalized (N1: the temporary folder is removed from every path;
// a leading `system/` is removed from each finding path; `\` in a finding
// path becomes `/`). A crash (a Python traceback) is recorded as its last
// line only, so no machine path is kept. `--check` compares instead of
// writing, and fails on any difference. capture-record.json names the
// Python version, the script, and the case count.

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GOLDENS, loadCases, materialize, pythonKeys, type PythonGolden } from "./cases.ts";

/** The last commit that has `system/.os/scripts/validate_config.py`: capture provenance only, never read from git (it is not in this repository). */
export const SCRIPT_REVISION = "0560ba1";
export const SCRIPT_SHA256: string = "20350b47ccde83df980e7b8b42b0c30262226ccd8b48809184afc72c6dbf905c";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const check = process.argv.includes("--check");
const python = arg("--python") ?? "python3";
const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-validate-capture-")));
let failures = 0;
try {
  const scriptPath = join(work, "validate_config.py");
  const given = arg("--script");
  if (given === undefined) throw new Error(`--script <path> is required: a copy of system/.os/scripts/validate_config.py at ${SCRIPT_REVISION} (private archive), SHA-256 ${SCRIPT_SHA256}`);
  const script = readFileSync(given);
  const scriptSha = createHash("sha256").update(script).digest("hex");
  if (scriptSha !== SCRIPT_SHA256) throw new Error(`the legacy script SHA-256 is ${scriptSha}, not ${SCRIPT_SHA256}`);
  writeFileSync(scriptPath, script);
  const pythonVersion = execFileSync(python, ["-I", "--version"], { encoding: "utf8" }).trim();

  const cases = loadCases();
  mkdirSync(join(GOLDENS, "cases"), { recursive: true });
  for (const testCase of cases) {
    const root = join(work, testCase.id);
    materialize(testCase.id, root, "source");
    const result = spawnSync(
      python,
      ["-I", scriptPath, "--repo-root", root, "--config", join(root, "system", ".os", "config", "instance.yaml"), "--contract", join(root, "system", ".os", "contracts", "config-contract.md"), "--data-dir", join(root, "system", ".os", "data")],
      { cwd: work, encoding: "utf8", env: { PATH: process.env["PATH"] ?? "", LANG: "C.UTF-8", PYTHONIOENCODING: "utf-8" } },
    );
    if (result.error !== undefined) throw result.error;
    const golden = normalize(testCase.id, result.status ?? -1, result.stdout, result.stderr, root, work);
    pythonKeys(golden); // every finding must classify
    const file = join(GOLDENS, "cases", `${testCase.id}.json`);
    const text = `${JSON.stringify(golden, null, 2)}\n`;
    if (check) {
      let old = "";
      try {
        old = readFileSync(file, "utf8");
      } catch {
        // missing golden
      }
      if (old !== text) {
        failures++;
        process.stderr.write(`differs: ${testCase.id}\n`);
      }
    } else {
      writeFileSync(file, text);
    }
  }
  const record = {
    "$comment": "Written by test/golden/validate/capture.ts. The legacy validator's result for each validate fixture case, captured on a maintainer machine. CI never runs Python.",
    script: "system/.os/scripts/validate_config.py",
    script_revision: SCRIPT_REVISION,
    script_sha256: scriptSha,
    python: pythonVersion,
    capture_os: `${process.platform} ${process.arch}`,
    node: process.version,
    cases: cases.length,
    command: "<python> -I validate_config.py --repo-root <tmp> --config <tmp>/system/.os/config/instance.yaml --contract <tmp>/system/.os/contracts/config-contract.md --data-dir <tmp>/system/.os/data",
    normalizations: {
      N1: "The temporary folder is removed from every path. A leading system/ is removed from each finding path, and \\ in it becomes /. A crash keeps only its last stderr line.",
      N2: "The case runs in the source layout: the project files under system/, and each saved doc_anchor under docs/ and source_anchor under assets/ spelled system/docs/ and system/assets/, as the source checkout spells them (register D-004).",
    },
  };
  const recordText = `${JSON.stringify(record, null, 2)}\n`;
  const recordFile = join(GOLDENS, "capture-record.json");
  if (check) {
    const old = readFileSync(recordFile, "utf8");
    if (old !== recordText) {
      failures++;
      process.stderr.write("differs: capture-record.json\n");
    }
  } else {
    writeFileSync(recordFile, recordText);
  }
  process.stdout.write(`${check ? "checked" : "captured"} ${cases.length} cases with ${pythonVersion}; script ${scriptSha}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failures > 0) {
  process.stderr.write(`${failures} difference(s)\n`);
  process.exitCode = 1;
}

function normalize(id: string, exit: number, stdout: string, stderr: string, root: string, work: string): PythonGolden {
  const strip = (text: string): string => text.split(`${root}/system/`).join("").split(`${root}/`).join("").split(`${work}/`).join("");
  const crashed = stderr.includes("Traceback (most recent call last):");
  if (crashed) {
    const last = stderr.split("\n").filter((line) => line.trim() !== "").pop() ?? "";
    return { case: id, exit, stdout: strip(stdout), stderr: `${strip(last)}\n`, crashed };
  }
  const lines = stderr.split("\n").map((line) => {
    if (line.startsWith("FAIL: ") || line === "") return strip(line);
    const colon = line.indexOf(":");
    let path = line.slice(0, colon).replaceAll("\\", "/");
    if (path.startsWith("system/")) path = path.slice("system/".length);
    return `${path}${strip(line.slice(colon))}`;
  });
  return { case: id, exit, stdout: strip(stdout), stderr: lines.join("\n"), crashed };
}
