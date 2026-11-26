// Captures the Go intake tool's result for each intake write-target edge case
// (W1 R7 P4, parity exception PE-010 and the `--allow-outside-root` flag).
// test/intake-edge.test.ts runs the same cases through the bundle and
// compares exit code, stdout, stderr, and the file tree with Go 1.24.1's.
//
// The Go sources are gone since W1 R7 P8. Build the Go tool from a worktree
// of the frozen baseline commit 263f5ca (test/golden/CAPTURE.md, Frozen Go
// Baseline); the paths below are inside that worktree.
// Build the Go tool first, from `toolkits/buildos-intake/`:
//   go build -o <scratch>/buildos-intake ./cmd/buildos-intake
// Then, from `toolkits/buildos/`:
//   GO_VERSION=go1.24.1 node scripts/capture-intake-edge-goldens.ts <scratch>/buildos-intake
//
// Writes test/fixtures/go-seed/intake-edge-goldens.json. Go has no
// `--allow-outside-root`: its run uses `goArgs`, which by default is the
// case's arguments with each `--allow-outside-root` removed (with the flag,
// the parity target is Go's own write). The work folder is `{ROOT}` in
// every text and file, and each twin's front matter time stamp is `{TIME}`
// before its file is hashed. The tree covers the whole work folder, so a write
// outside the repository root (`{ROOT}/repo`) shows.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const INTAKE_EDGE_GOLDENS = join(HERE, "..", "test", "fixtures", "go-seed", "intake-edge-goldens.json");
const DOCX = join(HERE, "..", "test", "conversion-eval", "inputs", "docx", "operations-handbook.docx");
const FLAG = "--allow-outside-root";

export interface IntakeEdgeCase {
  name: string;
  covers: string;
  /** The approved parity exception whose `intake_edge` entries list this case, if it differs from Go. */
  exception?: "PE-010";
  /** Builds the fixture inside `work` (`repo/` is the current folder of the run). */
  setup: (work: string) => void;
  /** The TypeScript arguments after `buildos-intake`; `{ROOT}` is the work folder. */
  args: string[];
  /** Go's arguments, when not `args` without `--allow-outside-root`. */
  goArgs?: string[];
}

const write = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

/** `repo/data.csv`, an empty `repo/system/assets/`, and an empty `out/` beside the repository. */
const base = (work: string) => {
  mkdirSync(join(work, "repo", "system", "assets"), { recursive: true });
  mkdirSync(join(work, "out"));
  write(join(work, "repo", "data.csv"), "a,b\n1,2\n");
};
const withPlaybooks = (work: string) => {
  base(work);
  mkdirSync(join(work, "repo", "system", "playbooks"));
};
const assetsLink = (work: string) => {
  base(work);
  rmSync(join(work, "repo", "system", "assets"), { recursive: true });
  symlinkSync("../../out", join(work, "repo", "system", "assets"));
};
const twinLink = (target: string, plant?: (work: string) => void) => (work: string) => {
  base(work);
  plant?.(work);
  mkdirSync(join(work, "repo", "system", "assets", "data"));
  symlinkSync(target, join(work, "repo", "system", "assets", "data", "data.csv"));
};
const outsideVictim = (work: string) => write(join(work, "out", "victim.csv"), "keep\n");
const insideVictim = (work: string) => write(join(work, "repo", "keep", "inside.csv"), "keep\n");
const withDocx = (work: string) => {
  base(work);
  copyFileSync(DOCX, join(work, "repo", "handbook.docx"));
};

export const INTAKE_EDGE_CASES: readonly IntakeEdgeCase[] = [
  { name: "assets-root-outside", covers: "PE-010: an absolute --assets-root outside the repository root is refused", exception: "PE-010", setup: base, args: ["convert", "--source", "data.csv", "--assets-root", "{ROOT}/out/assets"] },
  { name: "assets-root-outside-allowed", covers: "--allow-outside-root: an absolute --assets-root outside the root is written as Go writes it", setup: base, args: ["convert", FLAG, "--source", "data.csv", "--assets-root", "{ROOT}/out/assets"] },
  { name: "docx-media-outside", covers: "PE-010: a twin and its media outside the root are refused before the first write", exception: "PE-010", setup: withDocx, args: ["convert", "--source", "handbook.docx", "--assets-root", "{ROOT}/out/assets"] },
  { name: "docx-media-outside-allowed", covers: "--allow-outside-root: a twin and its media side artifact outside the root", setup: withDocx, args: ["convert", "--source", "handbook.docx", FLAG, "--assets-root", "{ROOT}/out/assets"] },
  { name: "references-output-outside", covers: "PE-010: index references --output outside the root is refused", exception: "PE-010", setup: base, args: ["index", "references", "--output", "{ROOT}/out/references.json"] },
  { name: "references-output-outside-allowed", covers: "--allow-outside-root after the other flags", setup: base, args: ["index", "references", "--output", "{ROOT}/out/references.json", FLAG] },
  { name: "playbooks-output-outside", covers: "PE-010: index playbooks --output outside the root is refused", exception: "PE-010", setup: withPlaybooks, args: ["index", "playbooks", "--output", "{ROOT}/out/playbooks.json"] },
  { name: "playbooks-output-outside-allowed", covers: "--allow-outside-root with a Go single-dash flag", setup: withPlaybooks, args: ["index", "playbooks", "-output", "{ROOT}/out/playbooks.json", FLAG] },
  { name: "assets-link-outside", covers: "PE-010: a write through a folder link that leads out of the root is refused", exception: "PE-010", setup: assetsLink, args: ["convert", "--source", "data.csv"] },
  { name: "assets-link-outside-allowed", covers: "--allow-outside-root: a write through a folder link out of the root follows it, as Go does", setup: assetsLink, args: ["convert", FLAG, "--source", "data.csv"] },
  { name: "twin-link-outside-force", covers: "PE-010: a link at the twin to a file outside the root is replaced, never followed (Go writes through it)", exception: "PE-010", setup: twinLink("../../../../out/victim.csv", outsideVictim), args: ["convert", "--source", "data.csv", "--force"] },
  { name: "twin-link-outside-force-allowed", covers: "PE-010: the flag does not make a link at the twin be followed", exception: "PE-010", setup: twinLink("../../../../out/victim.csv", outsideVictim), args: ["convert", FLAG, "--source", "data.csv", "--force"] },
  { name: "twin-link-inside-force", covers: "PE-010: a link at the twin to a file inside the root is replaced, never followed", exception: "PE-010", setup: twinLink("../../../keep/inside.csv", insideVictim), args: ["convert", "--source", "data.csv", "--force"] },
  { name: "twin-link-dangling", covers: "PE-010: a dangling link at the twin is replaced (Go creates the file it points at)", exception: "PE-010", setup: twinLink("../../../../out/new.csv"), args: ["convert", "--source", "data.csv"] },
  { name: "twin-link-outside-exists", covers: "Go's --force check follows the link: the twin exists", setup: twinLink("../../../../out/victim.csv", outsideVictim), args: ["convert", "--source", "data.csv"] },
  {
    name: "references-link-outside",
    covers: "PE-010: a link at the references index to a file outside the root is replaced, never followed",
    exception: "PE-010",
    setup: (work) => {
      base(work);
      write(join(work, "out", "victim.json"), "{}\n");
      mkdirSync(join(work, "repo", "system", ".os", "indexes"), { recursive: true });
      symlinkSync("../../../../out/victim.json", join(work, "repo", "system", ".os", "indexes", "references.json"));
    },
    args: ["index", "references"],
  },
  { name: "device-output-allowed", covers: "PE-010: the flag does not relax the device refusal", exception: "PE-010", setup: base, args: ["index", "references", FLAG, "--output", "/dev/null"] },
  { name: "flag-after-dashdash", covers: "PE-010: --allow-outside-root after -- is not a switch, so the write is refused", exception: "PE-010", setup: base, args: ["convert", "--source", "data.csv", "--assets-root", "{ROOT}/out/assets", "--", FLAG] },
  { name: "flag-as-source-value", covers: "--source --allow-outside-root names a source, as in Go", setup: base, args: ["convert", "--source", FLAG], goArgs: ["convert", "--source", FLAG] },
  { name: "flag-after-positional", covers: "--allow-outside-root after a non-flag argument is ignored, as Go ignores it", setup: base, args: ["convert", "--source", "data.csv", "extra", FLAG, "--assets-root", "{ROOT}/out/assets"], goArgs: ["convert", "--source", "data.csv", "extra", FLAG, "--assets-root", "{ROOT}/out/assets"] },
  { name: "flag-with-value", covers: "--allow-outside-root=true is not the switch: Go's undefined-flag error", setup: base, args: ["convert", `${FLAG}=true`, "--source", "data.csv"], goArgs: ["convert", `${FLAG}=true`, "--source", "data.csv"] },
  {
    name: "source-outside",
    covers: "a source file outside the repository root is read (Go parity): the path checks cover writes only",
    setup: (work) => {
      base(work);
      write(join(work, "out", "elsewhere.csv"), "c,d\n3,4\n");
    },
    args: ["convert", "--source", "{ROOT}/out/elsewhere.csv"],
  },
  {
    name: "source-outside-allowed",
    covers: "--allow-outside-root: a source file outside the root is read the same way; the flag concerns writes only",
    setup: (work) => {
      base(work);
      write(join(work, "out", "elsewhere.csv"), "c,d\n3,4\n");
    },
    args: ["convert", FLAG, "--source", "{ROOT}/out/elsewhere.csv"],
  },
  { name: "dry-run-outside", covers: "a dry run writes nothing, so an outside target is only planned, as in Go", setup: base, args: ["convert", "--dry-run", "--source", "data.csv", "--assets-root", "{ROOT}/out/assets"] },
  {
    name: "missing-repo-root",
    covers: "a missing --repo-root is created, as Go's os.MkdirAll does",
    setup: (work) => {
      mkdirSync(join(work, "repo"));
      write(join(work, "src", "data.csv"), "a,b\n1,2\n");
    },
    args: ["convert", "--source", "{ROOT}/src/data.csv", "--repo-root", "new-root"],
  },
];

export interface EdgeRun {
  exit: number;
  stdout: string;
  stderr: string;
  tree: Record<string, string>;
}

/**
 * The file tree of the work folder: `dir <mode>`, `file <mode> <sha256>`, or
 * `link <target>`. Before a file is hashed, the work folder in its text is
 * `{ROOT}` and a twin's front matter time stamp is `{TIME}`.
 */
export function snapshot(work: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (rel: string) => {
    const full = join(work, rel);
    const stats = lstatSync(full);
    const mode = (stats.mode & 0o777).toString(8);
    if (stats.isSymbolicLink()) out[rel] = `link ${readlinkSync(full)}`;
    else if (stats.isDirectory()) {
      out[rel] = `dir ${mode}`;
      for (const name of readdirSync(full).sort()) visit(rel === "." ? `./${name}` : `${rel}/${name}`);
    } else {
      const text = readFileSync(full).toString("latin1").replaceAll(work, "{ROOT}").replace(/^(---\n(?:[^\n]*\n)*?timestamp: ")[^"\n]*(")/, "$1{TIME}$2");
      out[rel] = `file ${mode} ${createHash("sha256").update(Buffer.from(text, "latin1")).digest("hex")}`;
    }
  };
  visit(".");
  return out;
}

const fill = (args: readonly string[], work: string) => args.map((a) => a.replaceAll("{ROOT}", work));

/** Runs one case with `program` (Go: `goArgs`). Texts and the tree name the work folder `{ROOT}`. */
export function runIntakeEdgeCase(program: readonly string[], c: IntakeEdgeCase, go: boolean): EdgeRun {
  const work = realpathSync.native(mkdtempSync(join(tmpdir(), "buildos-intake-edge-")));
  try {
    c.setup(work);
    const args = go ? (c.goArgs ?? c.args.filter((a) => a !== FLAG)) : c.args;
    const run = spawnSync(program[0]!, [...program.slice(1), ...fill(args, work)], { cwd: join(work, "repo"), encoding: "utf8" });
    if (run.error !== undefined) throw run.error;
    const norm = (text: string) => text.replaceAll(work, "{ROOT}");
    return { exit: run.status ?? -1, stdout: norm(run.stdout), stderr: norm(run.stderr), tree: snapshot(work) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const program = process.argv[2];
  if (program === undefined) throw new Error("usage: node scripts/capture-intake-edge-goldens.ts <go buildos-intake>");
  const cases = INTAKE_EDGE_CASES.map((c) => ({ name: c.name, covers: c.covers, ...runIntakeEdgeCase([program], c, true) }));
  const file = {
    $comment: "Go 1.24.1 buildos-intake results for the intake write-target edge cases (scripts/capture-intake-edge-goldens.ts). {ROOT} is the work folder; twin time stamps are {TIME} before hashing.",
    goVersion: process.env["GO_VERSION"] ?? "unknown",
    cases,
  };
  writeFileSync(INTAKE_EDGE_GOLDENS, `${JSON.stringify(file, null, 2)}\n`);
  process.stdout.write(`wrote ${cases.length} cases\n`);
}
