// Records the Make Docs 2.0.9 companion files that `buildos design promote`
// reads (W1 R7 P7 review round 1, P7-R1-05). A maintainer runs it; CI never
// does, and no test needs Make Docs installed.
//
//   npm run build
//   node test/golden/make-docs-companion/capture.ts [--check]
//
// It runs the built `buildos init --make-docs` in a fresh temporary folder,
// with `make-docs` 2.0.9 on PATH. Make Docs setup opens the Make Docs Store
// in the user's home folder, so a sandbox that blocks it stops the setup
// (run the capture outside such a sandbox). It then copies the design inputs
// (FILES) into test/fixtures/make-docs-companion/, byte for byte, and writes
// capture-record.json: the Make Docs version, the SHA-256 of each copied
// file, and the names of every file Make Docs wrote under .make-docs/system/.
// `--check` compares instead of writing, and fails on any difference in the
// copied files or in the reproducible record fields (REPRODUCIBLE_FIELDS in record.ts);
// `capture_os` records where the capture ran and is not compared.
//
// The files are Make Docs product text. They name no person, organization,
// or client, and hold no machine path.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { recordDifferences } from "./record.ts";

const PACKAGE_ROOT = join(import.meta.dirname, "..", "..", "..");
const FIXTURE = join(PACKAGE_ROOT, "test", "fixtures", "make-docs-companion");
const RECORD = join(import.meta.dirname, "capture-record.json");
export const MAKE_DOCS_VERSION = "2.0.9";

/** The design inputs of `buildos design promote` in the Make Docs 2.0.9 layout. */
export const FILES = [
  "docs/designs/AGENTS.md",
  ".make-docs/system/references/design-workflow.md",
  ".make-docs/system/contracts/design-contract.md",
  ".make-docs/system/templates/design.md",
  ".make-docs/system/prompts/designs-to-plan.prompt.md",
  ".make-docs/system/prompts/designs-to-plan-change.prompt.md",
] as const;

function list(dir: string, prefix: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}${entry.name}`;
    if (entry.isDirectory()) out.push(...list(join(dir, entry.name), `${rel}/`));
    else out.push(rel);
  }
  return out.sort();
}

const check = process.argv.includes("--check");
const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-make-docs-capture-")));
let failures = 0;
try {
  const version = execFileSync("make-docs", ["--version"], { encoding: "utf8" }).trim();
  if (version !== MAKE_DOCS_VERSION) throw new Error(`make-docs is ${version}, not ${MAKE_DOCS_VERSION}`);
  const project = join(work, "project");
  mkdirSync(project);
  execFileSync(process.execPath, [join(PACKAGE_ROOT, "dist", "buildos.js"), "init", "--make-docs", "--root", project, "--json"], { stdio: ["ignore", "pipe", "inherit"] });
  const files: Record<string, string> = {};
  for (const rel of FILES) {
    const source = join(project, ...rel.split("/"));
    const bytes = readFileSync(source);
    files[rel] = createHash("sha256").update(bytes).digest("hex");
    const dest = join(FIXTURE, ...rel.split("/"));
    if (check) {
      let old: Buffer | undefined;
      try {
        old = readFileSync(dest);
      } catch {
        // missing
      }
      if (old === undefined || !old.equals(bytes)) {
        failures++;
        process.stderr.write(`differs: ${rel}\n`);
      }
    } else {
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(source, dest);
    }
  }
  const record: Record<string, unknown> = {
    "$comment": "Written by test/golden/make-docs-companion/capture.ts. The Make Docs 2.0.9 files that buildos design promote reads, copied from a real buildos init --make-docs. CI never runs Make Docs.",
    make_docs: version,
    command: "buildos init --make-docs --root <tmp> (Make Docs setup --project-resources all)",
    capture_os: `${process.platform} ${process.arch}`,
    files,
    make_docs_system_files: list(join(project, ".make-docs", "system"), ".make-docs/system/"),
  };
  const text = `${JSON.stringify(record, null, 2)}\n`;
  if (check) {
    // P7-R2-09: `capture_os` is provenance (where the capture ran); only the reproducible fields are compared.
    const saved = JSON.parse(readFileSync(RECORD, "utf8")) as Record<string, unknown>;
    for (const key of recordDifferences(saved, record)) {
      failures++;
      process.stderr.write(`differs: capture-record.json ${key}\n`);
    }
  } else {
    writeFileSync(RECORD, text);
  }
  process.stdout.write(`${check ? "checked" : "captured"} ${FILES.length} files from make-docs ${version}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
if (failures > 0) {
  process.stderr.write(`${failures} difference(s)\n`);
  process.exitCode = 1;
}
