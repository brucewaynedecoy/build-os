// PE-023 (owner decision 2026-11-26, F-P8-11 and F-P8-10): the class rule
// for printed fix commands (applyPrintedCommands in harness.ts) covers
// exactly the cases it lists, and every other difference still fails.
//
// - Each list in PE-023 `printed_command` is exactly the set of committed
//   goldens (per operating system, the golden that system selects) and Go
//   seeds where the form occurs.
// - The rule leaves every other byte as Go wrote it.
// - A build that prints Go's form, or a bare `buildos` from a release
//   build, or the wrong quoting, does not match the expected text.
// - No exact value pinned by another exception holds a Go-form printed
//   command, so no pinned value needs the rule.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  applyPrintedCommands,
  GOLDEN_PLATFORMS,
  loadExceptions,
  loadManifest,
  printedCommandClass,
  printedProgram,
  readGoldenDir,
  selectGolden,
  seedWithPrintedCommands,
  withPrintedCommands,
} from "./harness.ts";

const manifest = loadManifest();
const exceptions = loadExceptions();
const printed = printedCommandClass(exceptions);
const SEEDS = join(import.meta.dirname, "..", "fixtures", "go-seed");
const seed = (file: string) => JSON.parse(readFileSync(join(SEEDS, file), "utf8")) as { cases: { name: string; stdout: string; stderr: string }[] };
/** The golden folder that `platform` uses for case `id`. */
function goldenOf(id: string, platform: string): string {
  const selection = selectGolden(manifest.cases.find((c) => c.id === id)!, platform);
  assert.notEqual(selection.status, "missing-golden", id);
  return (selection as { dir: string }).dir;
}
const release = printedProgram({ version: "0.2.0", sourceRevision: "0".repeat(40) });

describe("PE-023 printed fix commands: the lists are exact", () => {
  it("names the programs and both forms", () => {
    assert.deepEqual(printed.program, { source_build: "buildos", release: "npx -y build-os@<version>" });
    assert.equal(printedProgram(undefined), "buildos");
    assert.equal(release, "npx -y build-os@0.2.0");
    assert.equal(printedProgram({ version: "0.2.0+local", sourceRevision: "unknown" }), "buildos");
    assert.equal(printedProgram({ version: "0.0.0-dev", sourceRevision: "unknown" }), "buildos");
    assert.equal(printedProgram({ version: "0.3.0-rc.1", sourceRevision: "unknown" }), "npx -y build-os@0.3.0-rc.1");
  });

  for (const platform of GOLDEN_PLATFORMS) {
    it(`the rebuild and usage cases on ${platform} are exactly where the forms occur`, () => {
      const rebuild: string[] = [];
      const usage: string[] = [];
      for (const testCase of manifest.cases) {
        const selection = selectGolden(testCase, platform);
        if (selection.status === "missing-golden") continue;
        const { hits } = withPrintedCommands(readGoldenDir(selection.dir), release, platform);
        if (hits.rebuild > 0) rebuild.push(testCase.id);
        if (hits.usage > 0) usage.push(testCase.id);
      }
      assert.deepEqual(rebuild, printed.rebuild.cases[platform as "darwin" | "linux" | "win32"]);
      assert.deepEqual(usage, printed.usage.cases);
    });
  }

  it("the entity edge seeds and the $PWD seeds are exactly the listed ones", () => {
    for (const [file, key] of [["entity-edge-goldens.json", "edge"], ["pwd-goldens.json", "pwd"]] as const) {
      const hit = seed(file).cases.filter((c) => applyPrintedCommands(`${c.stdout}${c.stderr}`, "buildos", "linux").hits.rebuild > 0).map((c) => c.name);
      assert.deepEqual(hit, printed.rebuild[key], file);
      for (const c of seed(file).cases) assert.doesNotThrow(() => seedWithPrintedCommands(c.name, c, key, exceptions, "linux"), c.name);
    }
  });

  it("the seed check throws for a seed that holds the form but is not listed, and for a listed seed without it", () => {
    const go = 'x "correction": "buildos entities rebuild-index --root \\"{ROOT}/root\\" --mode strict --apply"\n';
    assert.throws(() => seedWithPrintedCommands("not-listed", { stdout: go, stderr: "" }, "edge", exceptions, "linux"), /does not list/);
    assert.throws(() => seedWithPrintedCommands(printed.rebuild.edge[0]!, { stdout: "nothing\n", stderr: "" }, "edge", exceptions, "linux"), /lists/);
  });
});

describe("PE-023 printed fix commands: the rule changes only the command text", () => {
  const golden = readGoldenDir(goldenOf("entities-validate-missing-index-strict", "linux"));
  const goText = golden.stderr.toString("utf8");

  it("POSIX: the program and the quoting of the root change, every other byte stays", () => {
    const dev = applyPrintedCommands(goText, "buildos", "linux").text;
    assert.ok(goText.includes('  action: buildos entities rebuild-index --root "{ROOT}/root" --mode strict --apply\n'));
    assert.ok(dev.includes("  action: buildos entities rebuild-index --root '{ROOT}/root' --mode strict --apply\n"));
    assert.ok(dev.includes(`"remediation_command": "buildos entities rebuild-index --root '{ROOT}/root' --mode strict --apply"`));
    assert.equal(dev.replaceAll("'{ROOT}/root'", '"{ROOT}/root"').replace('--root "{ROOT}/root" --mode strict --apply"', '--root \\"{ROOT}/root\\" --mode strict --apply"'), goText);
    const ours = applyPrintedCommands(goText, release, "linux").text;
    assert.equal(ours, dev.replaceAll("buildos entities rebuild-index", "npx -y build-os@0.2.0 entities rebuild-index"));
  });

  it("Windows: Go's doubled backslash becomes one, in the line and in the JSON string", () => {
    const win = readGoldenDir(goldenOf("entities-validate-missing-index-strict", "win32")).stderr.toString("utf8");
    const ours = applyPrintedCommands(win, release, "win32").text;
    assert.ok(win.includes('--root "{ROOT}\\\\root" --mode strict --apply\n'), "Go doubles the backslash");
    assert.ok(ours.includes('  action: npx -y build-os@0.2.0 entities rebuild-index --root "{ROOT}\\root" --mode strict --apply\n'));
    assert.ok(ours.includes('"remediation_command": "npx -y build-os@0.2.0 entities rebuild-index --root \\"{ROOT}\\\\root\\" --mode strict --apply"'));
  });

  it("Go's own text, a bare buildos from a release build, and a double-quoted POSIX root no longer match", () => {
    const expected = applyPrintedCommands(goText, release, "linux").text;
    assert.notEqual(goText, expected, "Go's text");
    assert.notEqual(applyPrintedCommands(goText, "buildos", "linux").text, expected, "a release build that prints bare buildos");
    assert.notEqual(goText.replaceAll("buildos entities rebuild-index", "npx -y build-os@0.2.0 entities rebuild-index"), expected, "the right program with Go's %q root");
  });

  it("the usage form changes only for a release build", () => {
    const usage = readGoldenDir(goldenOf("cli-unknown-command", "linux")).stderr.toString("utf8");
    assert.equal(applyPrintedCommands(usage, "buildos", "linux").text, usage);
    assert.equal(applyPrintedCommands(usage, release, "linux").text, usage.replace("Run buildos help for command syntax.", "Run npx -y build-os@0.2.0 help for command syntax."));
  });

  it("no exact value pinned by another exception holds a Go-form printed command", () => {
    for (const e of exceptions.exceptions) {
      for (const g of e.golden) {
        if (g.actual === null) continue;
        const { hits } = applyPrintedCommands(g.actual, release, g.platform ?? "linux");
        assert.deepEqual(hits, { rebuild: 0, usage: 0 }, `${e.id} ${g.case} ${g.field}`);
      }
    }
  });
});
