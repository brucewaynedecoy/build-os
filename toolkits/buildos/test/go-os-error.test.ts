/**
 * Go 1.24.1's Windows OS error text, checked on every system (W1 R7 P4-5
 * Windows CI fix). Each row feeds the win32 error that the port's call site
 * gets through the shared mapping (`go-os-error.ts`) and requires the
 * result in the captured win32 golden. The op of each row is the one the
 * port's call site uses for that Go call: `os.Stat` gives `CreateFile`
 * (`os/stat_windows.go`), `os.Open` and `os.ReadFile` give `open`
 * (`os/file_windows.go`), and `os.MkdirAll` over a file gives `mkdir` with
 * Go's `syscall.ENOTDIR`. A last check fails when a win32 golden gains an OS
 * error line that no row covers.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { FsFailureDetail } from "../src/core/shared/errors.ts";
import { goNotDirText, goPathError, goStatOp } from "../src/core/shared/go-os-error.ts";

const W = "win32" as const;
const WIN32_GOLDENS = join(dirname(fileURLToPath(import.meta.url)), "golden", "os", "win32");

const missing: FsFailureDetail = { errno: "ENOENT" };
const parentMissing: FsFailureDetail = { errno: "ENOENT", parentMissing: true };

/** Go `os.Stat(path)` failing with `detail`, as the port spells it. */
const stat = (path: string, detail: FsFailureDetail) => goPathError(goStatOp(false, W), path, detail, W);
/** Go `os.Open` or `os.ReadFile(path)` failing to open, as the port spells it. */
const open = (path: string, detail: FsFailureDetail) => goPathError("open", path, detail, W);
/** Go `os.MkdirAll(dir)` with a file in the way, as the port spells it. */
const mkdirOverFile = (dir: string) => `mkdir ${dir}: ${goNotDirText(W)}`;

interface Row {
  /** `<tool folder>/<case id>/<file>` under the win32 goldens. */
  golden: string;
  /** The text the port prints, built from the mapping. */
  text: string;
}

const ROWS: readonly Row[] = [
  // intake
  { golden: "buildos-intake/intake-convert-missing-source/stderr", text: `buildos-intake: error: read source: ${stat("{ROOT}\\inputs\\absent.csv", missing)}` },
  { golden: "buildos-intake/intake-convert-missing-root/stderr", text: `buildos-intake: error: read source: ${stat("{ROOT}\\absent\\inputs\\team-roster.csv", parentMissing)}` },
  { golden: "buildos-intake/intake-convert-write-failure/stderr", text: `buildos-intake: error: ${mkdirOverFile("{ROOT}\\system\\assets\\team-roster")}` },
  { golden: "buildos-intake/intake-index-playbooks-write-failure/stderr", text: `buildos-intake: error: ${mkdirOverFile("{ROOT}\\blocked")}` },
  // libuv gives EPERM for a read-only file opened for writing; Go sees ERROR_ACCESS_DENIED.
  { golden: "buildos-intake/intake-index-references-write-failure/stderr", text: `buildos-intake: error: ${open("{ROOT}\\system\\.os\\indexes\\references.json", { errno: "EPERM" })}` },
  // discovery
  { golden: "buildos-discovery/discovery-qualify-missing-test-file/stderr", text: `buildos-discovery: error: --confirmation-test: ${stat("{ROOT}\\tests\\absent.spec.ts", missing)}` },
  { golden: "buildos-discovery/discovery-run-missing-raw-file/stderr", text: `buildos-discovery: error: inputs/raw/absent.md: ${stat("{ROOT}\\inputs\\raw\\absent.md", missing)}` },
  { golden: "buildos-discovery/discovery-run-write-failure/stderr", text: `buildos-discovery: error: ${mkdirOverFile("{ROOT}\\system\\workspace\\runs")}` },
  { golden: "buildos-discovery/discovery-qualify-write-failure/stderr", text: `buildos-discovery: error: ${mkdirOverFile("{ROOT}\\system\\workspace\\findings")}` },
  { golden: "buildos-discovery/discovery-run-missing-root/stderr", text: `buildos-discovery: error: read playbook index: ${open("{ROOT}\\absent\\system\\.os\\indexes\\playbooks.json", parentMissing)}` },
  // design
  { golden: "buildos-design/design-promote-missing-router-input/stderr", text: `buildos-design: error: read design template system/docs/assets/templates/design.md: ${open("{ROOT}\\system\\docs\\assets\\templates\\design.md", missing)}` },
  // A file stands where the designs folder goes: Windows gives ERROR_PATH_NOT_FOUND.
  { golden: "buildos-design/design-promote-write-failure/stderr", text: `buildos-design: error: read design router system/docs/designs/AGENTS.md: ${open("{ROOT}\\system\\docs\\designs\\AGENTS.md", parentMissing)}` },
  { golden: "buildos-design/design-promote-missing-finding-record/stderr", text: `buildos-design: error: read finding record: ${open("{ROOT}\\system\\workspace\\findings\\FIND-005\\finding.md", missing)}` },
  { golden: "buildos-design/design-promote-missing-root/stderr", text: `cannot read governed dataset capabilities.jsonl: ${open("{ROOT}\\absent\\system\\.os\\data\\capabilities.jsonl", parentMissing)}` },
  // entities (JSON goldens: the text is JSON-escaped)
  { golden: "buildos/entities-consolidate-missing-manifest-json/stdout", text: `cannot read consolidation manifest: ${open("manifests/absent.json", missing)}` },
  { golden: "buildos/entities-rebuild-apply-write-failure-json/stdout", text: mkdirOverFile("{ROOT}\\root\\.os\\indexes") },
  { golden: "buildos/entities-consolidate-apply-index-failure-json/stdout", text: mkdirOverFile("{ROOT}\\root\\.os\\indexes") },
];

/**
 * Win32 goldens whose OS error the port does not print by design: the
 * missing entities root is parity exception PE-004 (the port gives
 * `root_not_found`, not Go's `resolve root` text).
 */
const NOT_MIRRORED = new Set(["buildos/entities-validate-missing-root-human/stderr", "buildos/entities-validate-missing-root-json/stdout"]);

const readGolden = (golden: string): string => readFileSync(join(WIN32_GOLDENS, ...golden.split("/")), "utf8");
const inGolden = (golden: string, text: string): boolean => {
  const body = readGolden(golden);
  return golden.endsWith("/stdout") && body.trimStart().startsWith("{") ? body.includes(JSON.stringify(text).slice(1, -1)) : body.includes(text);
};

/** A Go `*PathError` line in a golden: `<op> <path>: <Win32 text>.` */
const OS_ERROR = /\b(CreateFile|GetFileAttributesEx|FindFirstFile|GetFileInformationByHandle|open|mkdir|rename|remove|readlink|readdir|stat|lstat|read|write|close|sync|chmod) [^ ]+: [A-Z][^.]*\./;

describe("Go 1.24.1 OS error text on Windows, against the win32 goldens", () => {
  it("os.Stat fails with op CreateFile on Windows, stat or lstat elsewhere", () => {
    assert.equal(goStatOp(false, "win32"), "CreateFile");
    assert.equal(goStatOp(true, "win32"), "CreateFile");
    assert.equal(goStatOp(false, "darwin"), "stat");
    assert.equal(goStatOp(false, "linux"), "stat");
    assert.equal(goStatOp(true, "linux"), "lstat");
  });

  for (const row of ROWS) {
    it(`${row.golden}: the mapping gives the captured text`, () => {
      assert.ok(inGolden(row.golden, row.text), `expected ${JSON.stringify(row.text)} in ${row.golden}:\n${readGolden(row.golden)}`);
    });
  }

  it("every win32 golden with an OS error line has a row", () => {
    const covered = new Set(ROWS.map((row) => row.golden));
    const found: string[] = [];
    for (const tool of readdirSync(WIN32_GOLDENS, { withFileTypes: true })) {
      if (!tool.isDirectory()) continue;
      for (const id of readdirSync(join(WIN32_GOLDENS, tool.name))) {
        for (const file of ["stdout", "stderr"]) {
          const golden = `${tool.name}/${id}/${file}`;
          let body: string;
          try {
            body = readGolden(golden);
          } catch {
            continue;
          }
          if (OS_ERROR.test(body)) found.push(golden);
        }
      }
    }
    assert.ok(found.length >= ROWS.length, "the scan finds the goldens");
    assert.deepEqual(found.filter((golden) => !covered.has(golden) && !NOT_MIRRORED.has(golden)), []);
  });

  it("no call site in src passes a fixed stat op: each uses goStatOp", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const offenders: string[] = [];
    const visit = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) visit(full);
        else if (name.endsWith(".ts") && /goPathError\(\s*(?:[^,]*\?\s*)?"(?:stat|lstat|CreateFile)"/.test(readFileSync(full, "utf8"))) offenders.push(full);
      }
    };
    visit(src);
    assert.deepEqual(offenders, []);
  });
});
