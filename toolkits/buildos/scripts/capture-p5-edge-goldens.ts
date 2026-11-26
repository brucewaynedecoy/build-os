// Captures the Go 1.24.1 discovery and design tools on the edge cases of the
// W1 R7 P5 review (rounds 1 and 2): `--json` as a flag value, after `--`, and after
// a positional argument; a symlink at the finding record, the findings index,
// a finding folder, the designs folder, the runs folder, and the runs index
// (round 2, to a file outside and inside the root); a read-only (0444)
// runs.jsonl or findings.jsonl in a writable folder (round 3); a writable
// (0644) runs.jsonl in a read-only (0555) folder (PE-014); an out-of-range
// number in a run row's `inputs` or `outputs`; and an evidence file over
// 2 GiB. test/p5-edge.test.ts runs the TypeScript bundle on the same cases and
// compares exit code, stdout, stderr, and the file tree.
//
// The Go sources are gone since W1 R7 P8. Build the Go tool from a worktree
// of the frozen baseline commit 263f5ca (test/golden/CAPTURE.md, Frozen Go
// Baseline); the paths below are inside that worktree.
// Build the Go tools first, from the repository root:
//   (cd toolkits/buildos-discovery && go build -o <bin>/buildos-discovery ./cmd/buildos-discovery)
//   (cd toolkits/buildos-design && go build -o <bin>/buildos-design ./cmd/buildos-design)
// Then, from `toolkits/buildos/` (POSIX only):
//   GO_VERSION=go1.24.1 node scripts/capture-p5-edge-goldens.ts <bin>
//
// Writes test/fixtures/go-seed/p5-edge-goldens.json. Each case runs in a new
// scratch folder that holds the fixture copy (`root`) and any file outside
// the root (`outside-*`). Output and the tree are normalized with the golden
// harness rules (`normalizeText`): the scratch folder is `{ROOT}`, a time
// stamp from the run is `{TIMESTAMP}`, and the run date in a design file name
// is `{DATE}`. The tree records every entry of the scratch folder (kind,
// mode, and the SHA-256 of the normalized content, or the link target).
//
// `tsArgs` are added to the TypeScript arguments only: the opt-in
// `--allow-outside-root` (PE-012), which the Go tools do not define. Those
// cases must equal Go's output without the flag. Cases with an approved
// parity exception (PE-011, PE-012, PE-014) name it in `exception`; the test passes
// them only with exactly the differences that
// test/golden/parity-exceptions.json lists under `p5_edge`.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  cpSync,
  ftruncateSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeText, rootEncodings, rootSpellings, type RunContext } from "../test/golden/harness.ts";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export type P5Plant =
  | "record-link-outside"
  | "index-link-outside"
  | "finding-folder-link-outside"
  | "designs-link-outside"
  | "runs-link-outside"
  | "run-inputs-1e400"
  | "run-outputs-nested-1e400"
  | "run-outputs-1e-400"
  | "evidence-2gib"
  | "runs-index-link-outside"
  | "runs-index-link-inside"
  | "runs-index-readonly"
  | "findings-index-readonly"
  | "runs-index-folder-readonly";

export interface P5EdgeCase {
  name: string;
  /** The review finding the case covers. */
  covers: string;
  tool: "discovery" | "design";
  args: string[];
  /** Added to the TypeScript arguments only (PE-012 opt-in). */
  tsArgs?: string[];
  plant?: P5Plant;
  /** The approved parity exception that covers this case's differences from Go. */
  exception?: "PE-011" | "PE-012" | "PE-014";
  /** Writes a file over 2 GiB (needs free disk space). */
  large?: boolean;
  /**
   * The folder (relative to the scratch folder) that Go leaves after the
   * failure and the TypeScript tool removes: the orchestrator-approved
   * cleanup of P5 review round 1 (a retry works; not a parity exception).
   * The test compares the tree without the entries under it; everything
   * else, the exit code, stdout, and stderr included, must equal Go's.
   */
  removesCreated?: string;
}

const PROMOTE = ["promote", "finding", "--finding-id", "FIND-001", "--route", "baseline-plan"];
const RUN = ["run", "discovery", "--playbook-id", "PB-010", "--outcome", "positive"];
const QUALIFY = ["qualify", "finding", "--run-id", "RUN-001", "--raw-finding-ref", "#raw-finding-1", "--outcome", "positive", "--confirmation-test", "tests/confirm-cart-total.spec.ts", "--confirmation-evidence", "evidence/confirmation-run.txt"];

export const P5_EDGE_CASES: P5EdgeCase[] = [
  { name: "design-json-as-title-value", covers: "finding 1: --json is the value of --title", tool: "design", args: [...PROMOTE, "--title", "--json", "--dry-run"] },
  { name: "design-json-after-terminator", covers: "finding 1: --json after --", tool: "design", args: [...PROMOTE, "--", "--json", "--dry-run"] },
  { name: "design-json-after-positional", covers: "finding 1: --json after a positional argument", tool: "design", args: [...PROMOTE, "--dry-run", "x", "--json"] },
  { name: "design-json-in-title-equals", covers: "finding 1: --title=--json", tool: "design", args: [...PROMOTE, "--title=--json", "--dry-run"] },
  { name: "design-json-single-dash", covers: "finding 1: -json is not the switch", tool: "design", args: [...PROMOTE, "-json", "--dry-run"] },
  { name: "design-json-with-value", covers: "finding 1: --json=true is not the switch", tool: "design", args: [...PROMOTE, "--json=true", "--dry-run"] },
  { name: "design-json-in-flag-position", covers: "PE-011: --json in flag position", tool: "design", args: [...PROMOTE, "--json", "--dry-run"], exception: "PE-011" },
  { name: "discovery-json-as-title-value", covers: "finding 1: --json is the value of --title", tool: "discovery", args: [...RUN, "--title", "--json", "--dry-run"] },
  { name: "discovery-json-after-terminator", covers: "finding 1: --json after --", tool: "discovery", args: [...RUN, "--dry-run", "--", "--json"] },
  { name: "discovery-json-in-flag-position", covers: "PE-011: --json in flag position", tool: "discovery", args: [...RUN, "--json", "--dry-run"], exception: "PE-011" },
  { name: "design-record-link-outside", covers: "finding 2: finding.md is a symlink to a file outside the root", tool: "design", args: PROMOTE, plant: "record-link-outside" },
  { name: "design-index-link-outside", covers: "finding 2: findings.jsonl is a symlink to a file outside the root", tool: "design", args: PROMOTE, plant: "index-link-outside" },
  { name: "design-finding-folder-link-outside", covers: "finding 2, PE-012: the finding folder is a symlink to outside the root", tool: "design", args: PROMOTE, plant: "finding-folder-link-outside", exception: "PE-012" },
  { name: "design-finding-folder-link-outside-allowed", covers: "PE-012: --allow-outside-root keeps Go's write", tool: "design", args: PROMOTE, tsArgs: ["--allow-outside-root"], plant: "finding-folder-link-outside" },
  { name: "design-designs-link-outside", covers: "finding 2, PE-012: the designs folder is a symlink to outside the root", tool: "design", args: PROMOTE, plant: "designs-link-outside", exception: "PE-012" },
  { name: "design-designs-link-outside-allowed", covers: "PE-012: --allow-outside-root keeps Go's write", tool: "design", args: PROMOTE, tsArgs: ["--allow-outside-root"], plant: "designs-link-outside" },
  { name: "discovery-runs-link-outside", covers: "PE-012: the runs folder is a symlink to outside the root", tool: "discovery", args: RUN, plant: "runs-link-outside", exception: "PE-012" },
  { name: "discovery-runs-link-outside-allowed", covers: "PE-012: --allow-outside-root keeps Go's write", tool: "discovery", args: RUN, tsArgs: ["--allow-outside-root"], plant: "runs-link-outside" },
  { name: "discovery-qualify-inputs-1e400", covers: "finding 5: 1e400 in a run row's inputs", tool: "discovery", args: QUALIFY, plant: "run-inputs-1e400" },
  { name: "discovery-qualify-outputs-nested-1e400", covers: "finding 5: nested -1e400 in a run row's outputs", tool: "discovery", args: QUALIFY, plant: "run-outputs-nested-1e400" },
  { name: "discovery-qualify-outputs-1e-400", covers: "finding 5: 1e-400 rounds to 0, as in Go", tool: "discovery", args: QUALIFY, plant: "run-outputs-1e-400" },
  { name: "discovery-runs-index-link-outside", covers: "review round 2 finding 1, PE-014: runs.jsonl is a symlink to a file outside the root", tool: "discovery", args: RUN, plant: "runs-index-link-outside", exception: "PE-014" },
  { name: "discovery-runs-index-link-outside-allowed", covers: "review round 2 finding 1, PE-014: --allow-outside-root never follows a symlink at runs.jsonl", tool: "discovery", args: RUN, tsArgs: ["--allow-outside-root"], plant: "runs-index-link-outside", exception: "PE-014" },
  { name: "discovery-runs-index-link-inside", covers: "review round 2 finding 1, PE-014: runs.jsonl is a symlink to a file inside the root", tool: "discovery", args: RUN, plant: "runs-index-link-inside", exception: "PE-014" },
  { name: "discovery-runs-index-readonly", covers: "review round 3 finding 2: a read-only (0444) runs.jsonl in a writable folder fails with permission denied and keeps its bytes", tool: "discovery", args: RUN, plant: "runs-index-readonly", removesCreated: "root/system/workspace/runs/RUN-003" },
  { name: "discovery-findings-index-readonly", covers: "review round 3 finding 2: a read-only (0444) findings.jsonl in a writable folder fails with permission denied and keeps its bytes", tool: "discovery", args: QUALIFY, plant: "findings-index-readonly", removesCreated: "root/system/workspace/findings/FIND-001" },
  {
    name: "discovery-runs-index-folder-readonly",
    covers: "PE-014: a writable (0644) runs.jsonl in a read-only (0555) folder: Go appends in place and succeeds; the atomic replace needs a writable folder, so the port exits 1 and removes the run folder",
    tool: "discovery",
    args: RUN,
    plant: "runs-index-folder-readonly",
    exception: "PE-014",
  },
  { name: "discovery-run-evidence-2gib", covers: "finding 4: an evidence file over 2 GiB", tool: "discovery", args: [...RUN, "--evidence", "inputs/evidence/big.bin"], plant: "evidence-2gib", large: true },
];

/** Bytes of the large evidence file: 2 GiB and 5 bytes, sparse. */
export const LARGE_EVIDENCE_BYTES = 2 * 1024 ** 3 + 5;

function plantRunRow(root: string, extra: string): void {
  const file = join(root, "system/.os/data/runs.jsonl");
  const text = readFileSync(file, "utf8");
  const needle = '"owners":["fixture-team"]}';
  if (!text.includes(needle)) throw new Error("runs.jsonl fixture changed");
  writeFileSync(file, text.replace(needle, `"owners":["fixture-team"],${extra}}`));
}

function moveOutside(work: string, root: string, rel: string, name: string): void {
  renameSync(join(root, rel), join(work, name));
  symlinkSync(join(work, name), join(root, rel));
}

/** Writes the fixture for `c` under a new scratch folder; returns the folder and its root. */
export function makeP5Fixture(c: P5EdgeCase): { work: string; root: string } {
  const work = realpathSync(mkdtempSync(join(tmpdir(), "buildos-p5-edge-")));
  const root = join(work, "root");
  cpSync(join(PACKAGE_ROOT, "test", "fixtures", "golden", c.tool), root, { recursive: true });
  switch (c.plant) {
    case "record-link-outside":
      moveOutside(work, root, "system/workspace/findings/FIND-001/finding.md", "outside-finding.md");
      chmodSync(join(work, "outside-finding.md"), 0o640);
      break;
    case "index-link-outside":
      moveOutside(work, root, "system/.os/data/findings.jsonl", "outside-findings.jsonl");
      chmodSync(join(work, "outside-findings.jsonl"), 0o640);
      break;
    case "finding-folder-link-outside":
      moveOutside(work, root, "system/workspace/findings/FIND-001", "outside-FIND-001");
      break;
    case "designs-link-outside":
      moveOutside(work, root, "system/docs/designs", "outside-designs");
      break;
    case "runs-link-outside":
      moveOutside(work, root, "system/workspace/runs", "outside-runs");
      break;
    case "run-inputs-1e400":
      plantRunRow(root, '"inputs":{"a":1e400}');
      break;
    case "run-outputs-nested-1e400":
      plantRunRow(root, '"outputs":{"a":[{"b":-1e400}]}');
      break;
    case "run-outputs-1e-400":
      plantRunRow(root, '"outputs":{"a":1e-400}');
      break;
    case "runs-index-link-outside":
      moveOutside(work, root, "system/.os/data/runs.jsonl", "outside-runs.jsonl");
      chmodSync(join(work, "outside-runs.jsonl"), 0o640);
      break;
    case "runs-index-link-inside":
      renameSync(join(root, "system/.os/data/runs.jsonl"), join(root, "system/runs-target.jsonl"));
      symlinkSync("../../runs-target.jsonl", join(root, "system/.os/data/runs.jsonl"));
      break;
    case "runs-index-readonly":
      chmodSync(join(root, "system/.os/data/runs.jsonl"), 0o444);
      break;
    case "findings-index-readonly":
      chmodSync(join(root, "system/.os/data/findings.jsonl"), 0o444);
      break;
    case "runs-index-folder-readonly":
      chmodSync(join(root, "system/.os/data"), 0o555);
      break;
    case "evidence-2gib": {
      const fd = openSync(join(root, "inputs/evidence/big.bin"), "w");
      ftruncateSync(fd, LARGE_EVIDENCE_BYTES);
      closeSync(fd);
      break;
    }
    default:
      break;
  }
  return { work, root };
}

/**
 * SHA-256 of a file's raw bytes, read in chunks (a file may be over 2 GiB).
 * A small UTF-8 file has only the scratch folder, time stamps, and dates
 * replaced first (normalizeText); every other byte, a UTF-8 BOM included, is
 * hashed as it is on disk (P5 review round 2: the decoder must keep the BOM,
 * so a BOM added to a file changes its digest).
 */
function digest(full: string, size: number, ctx: RunContext): string {
  if (size <= 16 * 1024 * 1024) {
    const data = readFileSync(full);
    let text: string | undefined;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(data);
    } catch {
      text = undefined;
    }
    // The decode must be lossless; else hash the raw bytes.
    if (text !== undefined && !Buffer.from(text, "utf8").equals(data)) text = undefined;
    return createHash("sha256").update(text === undefined ? data : Buffer.from(normalizeText(text, ctx), "utf8")).digest("hex");
  }
  const hash = createHash("sha256");
  const fd = openSync(full, "r");
  try {
    const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      if (n === 0) break;
      hash.update(buffer.subarray(0, n));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

/** Every entry of the scratch folder: kind, mode, and content digest or link target, normalized. */
export function snapshot(work: string, ctx: RunContext): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const stats = lstatSync(full);
      const mode = (stats.mode & 0o777).toString(8);
      const key = normalizeText(childRel, ctx);
      if (stats.isSymbolicLink()) out[key] = `link ${normalizeText(readlinkSync(full), ctx)}`;
      else if (stats.isDirectory()) {
        out[key] = `dir ${mode}`;
        walk(full, childRel);
      } else out[key] = `file ${mode} ${digest(full, stats.size, ctx)}`;
    }
  };
  walk(work, "");
  return out;
}

const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Runs `program(tool)` on `c` in a fresh fixture: exit code, normalized output, and the tree afterwards. */
export function runP5EdgeCase(program: (tool: P5EdgeCase["tool"]) => string[], c: P5EdgeCase, extraArgs: readonly string[] = []): { exit: number; stdout: string; stderr: string; tree: Record<string, string> } {
  const { work, root } = makeP5Fixture(c);
  try {
    const [command, ...lead] = program(c.tool);
    const startMs = Date.now();
    const previous = process.umask(0o022);
    let result;
    try {
      result = spawnSync(command!, [...lead, ...c.args, ...extraArgs], { cwd: root, encoding: "utf8", env: { ...process.env, TZ: "UTC", PWD: root, NO_COLOR: "1" }, maxBuffer: 64 * 1024 * 1024 });
    } finally {
      process.umask(previous);
    }
    const endMs = Date.now();
    if (result.error !== undefined) throw result.error;
    const ctx: RunContext = { roots: rootEncodings(rootSpellings(work)), startMs, endMs, dates: [...new Set([utcDate(startMs), utcDate(endMs)])] };
    return { exit: result.status ?? -1, stdout: normalizeText(result.stdout, ctx), stderr: normalizeText(result.stderr, ctx), tree: snapshot(work, ctx) };
  } finally {
    // A read-only folder must be writable again before its entries can be removed.
    if (c.plant === "runs-index-folder-readonly") chmodSync(join(root, "system/.os/data"), 0o755);
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bin = process.argv[2];
  if (bin === undefined) {
    process.stderr.write("usage: node scripts/capture-p5-edge-goldens.ts <folder with buildos-discovery and buildos-design>\n");
    process.exit(2);
  }
  const go = (tool: P5EdgeCase["tool"]) => [join(resolve(bin), `buildos-${tool}`)];
  const cases = P5_EDGE_CASES.map((c) => ({ name: c.name, covers: c.covers, ...runP5EdgeCase(go, c) }));
  const out = join(PACKAGE_ROOT, "test", "fixtures", "go-seed", "p5-edge-goldens.json");
  writeFileSync(out, `${JSON.stringify({ source: "scripts/capture-p5-edge-goldens.ts with the Go tools built from toolkits/buildos-discovery and toolkits/buildos-design", goVersion: process.env["GO_VERSION"] ?? "", cases }, null, 2)}\n`);
  process.stdout.write(`wrote ${out}\n`);
}
