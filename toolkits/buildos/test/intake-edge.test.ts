// W1 R7 P4 intake write-target edge cases, through the packaged binary (the
// esbuild bundle, run under the Go tool's name), against Go 1.24.1
// (test/fixtures/go-seed/intake-edge-goldens.json, from
// scripts/capture-intake-edge-goldens.ts). Each case compares the exit code,
// stdout, stderr, and the file tree of the whole work folder (so a write
// outside the repository root shows):
// - without `--allow-outside-root`, a write target outside `--repo-root`
//   (an absolute `--assets-root` or `--output`, or a folder link out of the
//   root) is refused with exit 3, a message that names the flag, and no
//   change (PE-010);
// - with the flag, the same writes equal Go byte for byte;
// - a link at the written file itself is replaced, never followed, with or
//   without the flag (PE-010; Go writes through it);
// - the flag never relaxes the device refusal, and counts only as a whole
//   argument in flag position, with Go `flag` rules.
// Cases of PE-010 pass only with exactly the differences that
// test/golden/parity-exceptions.json lists under `intake_edge`.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { INTAKE_EDGE_CASES, INTAKE_EDGE_GOLDENS, runIntakeEdgeCase, type EdgeRun } from "../scripts/capture-intake-edge-goldens.ts";
import { edgeExceptionProblems, loadExceptions, stripLegacyNotice } from "./golden/harness.ts";

let dir: string;
let program: string[];

before(
  async () => {
    dir = mkdtempSync(join(tmpdir(), "buildos-p4-edge-"));
    // The legacy entry file the build writes next to the bundle (`node <dist>/buildos-intake.js`).
    await bundle({ outfile: join(dir, "buildos.js") });
    program = [process.execPath, join(dir, "buildos-intake.js")];
  },
  { timeout: 60_000 },
);
after(() => rmSync(dir, { recursive: true, force: true }));

const posix = process.platform !== "win32";

/** Runs a case under the legacy name and removes the PE-016 notice line, which must be there. */
function runOurs(c: (typeof INTAKE_EDGE_CASES)[number]): EdgeRun {
  const run = runIntakeEdgeCase(program, c, false);
  const notice = stripLegacyNotice("buildos-intake", Buffer.from(run.stderr, "utf8"), loadExceptions());
  assert.equal(notice.problem, undefined, notice.problem);
  return { ...run, stderr: notice.stderr.toString("utf8") };
}
const FLAG_HINT = "; pass --allow-outside-root to allow a write outside the repository root";

describe("intake write-target edge cases match Go 1.24.1 (PE-010, --allow-outside-root)", { skip: posix ? false : "POSIX symlinks and /dev/null" }, () => {
  const goldens = JSON.parse(readFileSync(INTAKE_EDGE_GOLDENS, "utf8")) as { goVersion: string; cases: (EdgeRun & { name: string })[] };
  const golden = (name: string) => goldens.cases.find((c) => c.name === name)!;
  const exceptions = loadExceptions();

  it("has Go 1.24.1 goldens for every case", () => {
    assert.equal(goldens.goVersion, "go1.24.1");
    assert.deepEqual(
      goldens.cases.map((c) => c.name),
      INTAKE_EDGE_CASES.map((c) => c.name),
    );
  });

  it("lists each PE-010 case under PE-010 only, and every entry names a known case", () => {
    const names = new Map(INTAKE_EDGE_CASES.map((c) => [c.name, c.exception]));
    const listed = exceptions.exceptions.flatMap((e) => (e.intake_edge ?? []).map((x) => ({ id: e.id, name: x.case, field: x.field })));
    for (const x of listed) {
      assert.ok(names.has(x.name), `${x.id} names unknown intake edge case ${x.name}`);
      assert.equal(names.get(x.name), x.id, `${x.name} is listed under ${x.id}`);
    }
    for (const c of INTAKE_EDGE_CASES.filter((x) => x.exception !== undefined)) assert.ok(listed.some((x) => x.name === c.name), `${c.name} names ${c.exception}, which does not list it`);
  });

  it("the goldens show that Go writes outside the root and follows a link at the file", () => {
    assert.equal(golden("assets-root-outside").exit, 0);
    assert.match(golden("assets-root-outside").tree["./out/assets/data/data.csv"]!, /^file 644 /);
    assert.match(golden("twin-link-outside-force").tree["./repo/system/assets/data/data.csv"]!, /^link /);
    assert.notEqual(golden("twin-link-outside-force").tree["./out/victim.csv"], golden("twin-link-outside-exists").tree["./out/victim.csv"]);
    assert.match(golden("twin-link-dangling").tree["./out/new.csv"]!, /^file 644 /);
    assert.equal(golden("device-output-allowed").stdout, "wrote /dev/null (0 references)\n");
  });

  for (const c of INTAKE_EDGE_CASES) {
    const title = c.exception === undefined ? `${c.name} matches Go byte for byte (${c.covers})` : `${c.name} differs from Go exactly as ${c.exception} allows (${c.covers})`;
    it(title, () => {
      const go = golden(c.name);
      const ours = runOurs(c);
      assert.deepEqual(edgeExceptionProblems(c.name, c.exception, go, ours, exceptions, "intake_edge"), []);
      if (c.exception === undefined) assert.deepEqual(ours, { exit: go.exit, stdout: go.stdout, stderr: go.stderr, tree: go.tree });
    });
  }

  it("refuses an outside write with exit 3, names the flag, and changes nothing", () => {
    for (const name of ["assets-root-outside", "docx-media-outside", "references-output-outside", "playbooks-output-outside", "assets-link-outside", "flag-after-dashdash"]) {
      const c = INTAKE_EDGE_CASES.find((x) => x.name === name)!;
      const ours = runOurs(c);
      assert.equal(ours.exit, 3, name);
      assert.equal(ours.stdout, "", name);
      assert.match(ours.stderr, /^buildos-intake: error: \S+ (?:resolves outside|is outside) the root \{ROOT\}\/repo; pass --allow-outside-root to allow a write outside the repository root\n$/, name);
      const before = runIntakeEdgeCase(["/usr/bin/true"], c, false).tree;
      assert.deepEqual(ours.tree, before, `${name} changed the tree`);
    }
  });

  it("replaces a link at the written file and keeps the file it pointed at", () => {
    for (const name of ["twin-link-outside-force", "twin-link-outside-force-allowed", "twin-link-inside-force", "twin-link-dangling", "references-link-outside"]) {
      const c = INTAKE_EDGE_CASES.find((x) => x.name === name)!;
      const ours = runOurs(c);
      const before = runIntakeEdgeCase(["/usr/bin/true"], c, false).tree;
      assert.equal(ours.exit, 0, name);
      for (const [path, value] of Object.entries(before)) {
        if (value.startsWith("link ")) assert.match(ours.tree[path]!, /^file 644 [0-9a-f]{64}$/, `${name}: ${path} is still a link`);
        else if (path !== "." && !value.startsWith("dir ")) assert.equal(ours.tree[path], value, `${name}: ${path} changed`);
      }
      assert.equal(ours.tree["./out/new.csv"], undefined, `${name}: a dangling link was followed`);
    }
  });

  it("does not relax the device refusal with the flag, and the message does not name the flag", () => {
    const ours = runOurs(INTAKE_EDGE_CASES.find((x) => x.name === "device-output-allowed")!);
    assert.equal(ours.exit, 3);
    assert.ok(!ours.stderr.includes(FLAG_HINT));
  });
});
