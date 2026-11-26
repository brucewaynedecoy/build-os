// W1 R7 P5 review round 1, through the packaged binary (the esbuild bundle),
// against the Go 1.24.1 discovery and design tools
// (test/fixtures/go-seed/p5-edge-goldens.json, from
// scripts/capture-p5-edge-goldens.ts). Each case compares the exit code,
// stdout, stderr, and the file tree (inside and outside the root) after the
// run with Go's:
// - `--json` as a flag value, after `--`, after a positional argument, and
//   spelled `-json` or `--json=true`: as in Go (finding 1);
// - a symlink at the finding record or the findings index to a file outside
//   the root: the link is replaced and the outside file is kept (finding 2);
// - a symlinked finding, designs, or runs folder that leads outside the
//   root: refused with no change (PE-012), and with `--allow-outside-root`
//   (added to the TypeScript arguments only) exactly Go's write;
// - `1e400` in a run row's `inputs`, nested `-1e400` in `outputs`, and
//   `1e-400` (finding 5);
// - an evidence file over 2 GiB (finding 4; skipped without 8 GiB free);
// - review round 2: a symlink at runs.jsonl, to a file outside or inside the
//   root, with and without `--allow-outside-root`: the link is replaced by a
//   file with Go's bytes (PE-014, approved 2026-11-23), and the snapshot hashes raw bytes, so a
//   UTF-8 BOM added to a file changes the observation;
// - review round 3: a read-only (0444) runs.jsonl or findings.jsonl in a
//   writable folder: exit 1, Go's `permission denied`, bytes and mode kept.
// - a writable (0644) runs.jsonl in a read-only (0555) folder: Go appends
//   in place and exits 0; the port's atomic replace exits 1, keeps the old
//   index, and removes the run folder (PE-014's index-replacement rule).
// The cases of PE-011, PE-012, and PE-014 pass only with exactly the differences that
// test/golden/parity-exceptions.json lists under `p5_edge`.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { P5_EDGE_CASES, runP5EdgeCase } from "../scripts/capture-p5-edge-goldens.ts";
import { edgeExceptionProblems, loadExceptions, type ExceptionsFile, type ParityException } from "./golden/harness.ts";

let dir: string;
let bundlePath: string;

before(
  async () => {
    dir = mkdtempSync(join(tmpdir(), "buildos-p5-edge-"));
    bundlePath = await bundle({ outfile: join(dir, "buildos.js") });
  },
  { timeout: 60_000 },
);
after(() => rmSync(dir, { recursive: true, force: true }));

const posix = process.platform !== "win32";

function freeBytes(): number {
  try {
    const s = statfsSync(tmpdir());
    return s.bavail * s.bsize;
  } catch {
    return 0;
  }
}

describe("discovery and design edge cases match the Go tools (P5 review round 1)", { skip: posix ? false : "POSIX symlinks" }, () => {
  const goldens = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "go-seed", "p5-edge-goldens.json"), "utf8")) as {
    goVersion: string;
    cases: { name: string; exit: number; stdout: string; stderr: string; tree: Record<string, string> }[];
  };
  const loaded = loadExceptions();
  const p5Entries = (loaded.exceptions as unknown as { p5_edge?: { case: string; field: string; actual: string }[] }[]).map((e) => e.p5_edge ?? []);
  const all = { exceptions: loaded.exceptions.map((e, i) => ({ id: e.id, p5_edge: p5Entries[i]! })) };
  // edgeExceptionProblems reads `edge`: give it this suite's `p5_edge` entries.
  const exceptions: ExceptionsFile = { exceptions: loaded.exceptions.map((e, i) => ({ ...e, edge: p5Entries[i]! as NonNullable<ParityException["edge"]> })) };

  it("has Go 1.24.1 goldens for every case, in order", () => {
    assert.equal(goldens.goVersion, "go1.24.1");
    assert.deepEqual(
      goldens.cases.map((c) => c.name),
      P5_EDGE_CASES.map((c) => c.name),
    );
  });

  it("lists each exception case under exactly its approved exception", () => {
    const names = new Map(P5_EDGE_CASES.map((c) => [c.name, c.exception]));
    const listed = all.exceptions.flatMap((e) => e.p5_edge.map((x) => ({ id: e.id, name: x.case, field: x.field })));
    for (const x of listed) {
      assert.ok(names.has(x.name), `${x.id} names unknown P5 edge case ${x.name}`);
      assert.equal(names.get(x.name), x.id, `${x.name} is listed under ${x.id}`);
    }
    for (const c of P5_EDGE_CASES.filter((x) => x.exception !== undefined)) assert.ok(listed.some((x) => x.name === c.name), `${c.name} names ${c.exception}, which does not list it`);
    assert.deepEqual([...new Set(listed.map((x) => x.id))].sort(), ["PE-011", "PE-012", "PE-014"]);
  });

  it("the goldens show the Go behavior the fixes and exceptions describe", () => {
    const go = (name: string) => goldens.cases.find((c) => c.name === name)!;
    assert.match(go("design-json-as-title-value").stdout, /^would write system\/docs\/designs\/\{DATE\}-json\.md /);
    assert.equal(go("design-json-in-flag-position").exit, 1);
    assert.match(go("design-json-in-flag-position").stderr, /^flag provided but not defined: -json\n/);
    assert.match(go("design-record-link-outside").tree["root/system/workspace/findings/FIND-001/finding.md"]!, /^file 640 /);
    assert.ok(Object.keys(go("design-designs-link-outside").tree).some((k) => /^outside-designs\/\{DATE\}-/.test(k)), "Go writes the design outside the root");
    assert.match(go("discovery-qualify-inputs-1e400").stderr, /runIndexRow\.inputs of type float64/);
    assert.match(go("discovery-run-evidence-2gib").tree["root/system/workspace/runs/RUN-003/evidence/001-big.bin"]!, /^file 644 /);
    assert.equal(go("discovery-runs-index-link-outside").tree["root/system/.os/data/runs.jsonl"], "link {ROOT}/outside-runs.jsonl", "Go appends through the link");
    // Review round 3: Go opens a read-only index for writing in place and fails; the bytes and mode stay.
    for (const index of ["runs", "findings"]) {
      const c = go(`discovery-${index}-index-readonly`);
      assert.equal(c.exit, 1);
      assert.equal(c.stderr, `buildos-discovery: error: open {ROOT}/root/system/.os/data/${index}.jsonl: permission denied\n`);
      assert.match(c.tree[`root/system/.os/data/${index}.jsonl`]!, /^file 444 /);
    }
    // PE-014: Go appends in place to a writable index in a read-only folder and succeeds.
    const folder = go("discovery-runs-index-folder-readonly");
    assert.equal(folder.exit, 0);
    assert.equal(folder.tree["root/system/.os/data"], "dir 555");
    assert.equal(folder.tree["root/system/workspace/runs/RUN-003"], "dir 755");
  });

  it("a UTF-8 BOM added to finding.md during a run changes the observation (P5 review round 2)", () => {
    const c = P5_EDGE_CASES.find((x) => x.name === "design-json-in-flag-position")!;
    const golden = goldens.cases.find((g) => g.name === c.name)!;
    const addBom = `const f = require("node:fs"); const p = "system/workspace/findings/FIND-001/finding.md"; f.writeFileSync(p, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), f.readFileSync(p)]));`;
    const ours = runP5EdgeCase(() => [process.execPath, "-e", addBom], c);
    const key = "root/system/workspace/findings/FIND-001/finding.md";
    assert.notEqual(ours.tree[key], golden.tree[key], "the BOM changes the digest");
    assert.deepEqual({ ...ours.tree, [key]: golden.tree[key] }, golden.tree, "nothing else changed");
  });

  for (const c of P5_EDGE_CASES) {
    const title = c.exception === undefined ? `${c.name} matches Go byte for byte (${c.covers})` : `${c.name} differs from Go exactly as ${c.exception} allows (${c.covers})`;
    const skip =
      c.large === true && freeBytes() < 8 * 1024 ** 3
        ? "needs 8 GiB free for a 2 GiB copy"
        : c.plant?.endsWith("-readonly") === true && process.getuid?.() === 0
          ? "root writes a 0444 file, in Go too; the goldens are from a normal user"
          : false;
    it(title, { skip, timeout: 120_000 }, () => {
      const golden = goldens.cases.find((g) => g.name === c.name)!;
      const ours = runP5EdgeCase((tool) => [process.execPath, bundlePath, tool], c, c.tsArgs ?? []);
      // Review round 3: the approved cleanup removes the folder Go leaves; nothing else may differ.
      const prefix = c.removesCreated;
      if (prefix !== undefined) assert.ok(prefix in golden.tree, `Go leaves ${prefix}`);
      const goTree = prefix === undefined ? golden.tree : Object.fromEntries(Object.entries(golden.tree).filter(([key]) => key !== prefix && !key.startsWith(`${prefix}/`)));
      assert.deepEqual(edgeExceptionProblems(c.name, c.exception, { ...golden, tree: goTree }, ours, exceptions), []);
      if (c.exception === undefined) {
        assert.equal(ours.exit, golden.exit, "exit code");
        assert.equal(ours.stdout, golden.stdout, "stdout");
        assert.equal(ours.stderr, golden.stderr, "stderr");
        assert.deepEqual(ours.tree, goTree, "file tree");
      }
    });
  }
});
