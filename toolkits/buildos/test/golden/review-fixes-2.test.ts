// Regression tests for the second W1 R7 P2 review fix round: JSON-aware root
// normalization (Go %q inside JSON, malformed JSON), incomplete goldens in
// --report, the fixture root's own permission bits, and symbolic links in
// the tree snapshot. None of them runs Go.

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, win32 } from "node:path";
import { after, before, describe, it } from "node:test";
import { goQuote } from "../../src/cli/parse.ts";
import {
  GOLDEN_ROOT,
  MODES_SUPPORTED,
  checkCapture,
  compareObservations,
  goJsonEscape,
  goldenDir,
  loadManifest,
  normalizeJsonText,
  normalizeStdout,
  osGoldenDir,
  planCapture,
  readGoldenDir,
  rootEncodings,
  runCase,
  spellingVariants,
  type GoldenCase,
  type RunContext,
  type Runner,
} from "./harness.ts";

const manifest = loadManifest();
const byId = (id: string): GoldenCase => {
  const found = manifest.cases.find((c) => c.id === id);
  assert.ok(found !== undefined, `no case ${id}`);
  return found;
};

/** The Go JSON envelope of entities-validate-missing-root-json, with `message` as given. */
const envelope = (message: string) =>
  `{\n  "ok": false,\n  "diagnostics": [\n    {\n      "code": "internal_error",\n      "message": "${goJsonEscape(message)}"\n    }\n  ]\n}\n`;

describe("JSON output: a root in Go %q inside JSON (review round 2, finding 1)", () => {
  const short = win32.join("C:\\Users\\RUNNER~1\\AppData\\Local\\Temp", "buildos-golden-Ab12", "work");
  const long = win32.join("C:\\Users\\runneradmin\\AppData\\Local\\Temp", "buildos-golden-Ab12", "work");
  const ctx: RunContext = { roots: rootEncodings(spellingVariants([short, long], true)), startMs: 0, endMs: 0, dates: [] };
  // What Go prints for a missing root, as a function of the root text.
  const missing = (root: string) => {
    const full = `${root}\\absent`;
    return `resolve root ${goQuote(full)}: CreateFile ${full}: The system cannot find the file specified.`;
  };

  for (const [name, root] of [["8.3 short form", short], ["long form", long]] as const) {
    it(`normalizes the ${name} inside %q inside JSON, keeping every suffix byte`, () => {
      // Golden: the same message with {ROOT} in place of the folder, encoded the same way.
      assert.equal(normalizeJsonText(envelope(missing(root)), ctx), envelope(missing("{ROOT}")));
      assert.match(normalizeJsonText(envelope(missing(root)), ctx), /resolve root \\"\{ROOT\}\\\\\\\\absent\\": CreateFile \{ROOT\}\\\\absent:/);
    });

    it(`normalizes the ${name} at any nesting of %q inside JSON`, () => {
      for (const depth of [2, 3, 4]) {
        const nested = (r: string) => {
          let text = missing(r);
          for (let i = 1; i < depth; i++) text = `wrap ${goQuote(text)}`;
          return text;
        };
        assert.equal(normalizeJsonText(envelope(nested(root)), ctx), envelope(nested("{ROOT}")), `depth ${depth}`);
        assert.equal(normalizeJsonText(JSON.stringify({ message: nested(root) }), ctx), JSON.stringify({ message: nested("{ROOT}") }), `depth ${depth}, JSON.stringify`);
      }
    });
  }

  it("leaves a POSIX golden as it was (no backslashes to unwrap)", () => {
    const root = "/private/var/folders/x/T/buildos-golden-Ab12/work";
    const posixCtx: RunContext = { roots: rootEncodings(spellingVariants([root], false)), startMs: 0, endMs: 0, dates: [] };
    const message = (r: string) => `resolve root ${goQuote(posix.join(r, "absent"))}: stat ${posix.join(r, "absent")}: no such file or directory`;
    assert.equal(normalizeJsonText(envelope(message(root)), posixCtx), envelope(message("{ROOT}")));
    const golden = readGoldenDir(osGoldenDir(byId("entities-validate-missing-root-json"), "darwin"));
    assert.ok(golden.stdout.toString("utf8").includes(`"message": "${goJsonEscape(message("{ROOT}"))}"`));
  });

  it("never lets malformed JSON with raw backslashes normalize like valid JSON", () => {
    const valid = `{"path":"${goJsonEscape(`${long}\\absent`)}"}`;
    const malformed = `{"path":"${long}\\\\absent"}`; // the root's backslashes are raw
    assert.throws(() => JSON.parse(malformed));
    assert.throws(() => normalizeJsonText(malformed, ctx));
    const good = normalizeStdout(Buffer.from(valid), ctx, true);
    const bad = normalizeStdout(Buffer.from(malformed), ctx, true);
    assert.equal(good.jsonError, undefined);
    assert.match(bad.jsonError ?? "", /not valid JSON/);
    // As plain text both read the same, which is why the JSON check exists.
    assert.equal(normalizeStdout(Buffer.from(valid), ctx, false).stdout.toString(), normalizeStdout(Buffer.from(malformed), ctx, false).stdout.toString());
    const testCase = byId("entities-validate-missing-root-json");
    const golden = { exit: 3, stdout: good.stdout, stderr: Buffer.alloc(0), added: [], changed: [], removed: [], files: new Map() };
    const diffs = compareObservations(testCase, golden, { ...golden, stdout: bad.stdout, stdoutJsonError: bad.jsonError as string });
    assert.ok(diffs.some((d) => d.field === "stdout:json"), JSON.stringify(diffs));
  });

  it("fails a JSON case end to end when the program prints invalid JSON", () => {
    const testCase: GoldenCase = { id: "json-probe", tool: "buildos", domain: "cli", invocation: "buildos", args: [], fixture: null, kind: "success", exit: 0, json: true };
    const printer = (text: string): Runner => ({ command: () => [process.execPath, ["-e", `process.stdout.write(${JSON.stringify(text)})`]] });
    const go = runCase(testCase, printer('{"ok":true}\n')).observation;
    const ts = runCase(testCase, printer('{"ok":true,}\n')).observation;
    assert.equal(go.stdoutJsonError, undefined);
    assert.match(ts.stdoutJsonError ?? "", /not valid JSON/);
    assert.ok(compareObservations(testCase, go, ts).some((d) => d.field === "stdout:json"));
    assert.deepEqual(compareObservations(testCase, go, go), []);
  });
});

describe("--report treats an incomplete existing golden as drift (review round 2, finding 2)", () => {
  let root: string;
  let fresh: string;
  const testCase = () => byId("entities-validate-missing-root-json");

  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-golden-incomplete-"));
    cpSync(GOLDEN_ROOT, join(root, "goldens"), { recursive: true });
    fresh = join(root, "fresh");
    cpSync(osGoldenDir(testCase(), "darwin"), goldenDir(testCase(), fresh), { recursive: true });
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports nothing for a complete equal golden", () => {
    const options = { platform: "darwin", writeShared: false, root: join(root, "goldens") };
    assert.deepEqual(planCapture(testCase(), goldenDir(testCase(), fresh), options).drift, []);
  });

  it("lists a golden folder with no result.json and a changed stderr as changed-os-golden, and --check fails on it", () => {
    const goldens = join(root, "goldens");
    const own = osGoldenDir(testCase(), "darwin", goldens);
    rmSync(join(own, "result.json"));
    writeFileSync(join(own, "stderr"), "changed\n");
    const plan = planCapture(testCase(), goldenDir(testCase(), fresh), { platform: "darwin", writeShared: false, root: goldens });
    assert.deepEqual(plan.drift, [{ case: "entities-validate-missing-root-json", kind: "changed-os-golden" }]);
    assert.equal(plan.write, "own");
    assert.match(checkCapture(testCase(), goldenDir(testCase(), fresh), { platform: "darwin", root: goldens }).join("\n"), /incomplete golden folder os\/darwin\/buildos\/entities-validate-missing-root-json has no result\.json/);
  });

  it("lists an incomplete shared golden of a shared case as drift for --write-shared and a plain capture", () => {
    const goldens = join(root, "goldens");
    const shared = byId("discovery-help");
    const freshDir = goldenDir(shared, fresh);
    cpSync(goldenDir(shared), freshDir, { recursive: true });
    rmSync(join(goldenDir(shared, goldens), "result.json"));
    assert.deepEqual(planCapture(shared, freshDir, { platform: "darwin", writeShared: true, root: goldens }).drift, [{ case: "discovery-help", kind: "changed-shared-golden" }]);
    assert.deepEqual(planCapture(shared, freshDir, { platform: "darwin", writeShared: false, root: goldens }).drift, [{ case: "discovery-help", kind: "shared-drift" }]);
  });
});

describe("tree snapshot: root permission bits and symbolic links (review round 2, findings 3 and 4)", () => {
  const probe: GoldenCase = { id: "tree-probe", tool: "buildos", domain: "cli", invocation: "buildos", args: [], fixture: null, kind: "success", exit: 0 };
  const node = (code: string): Runner => ({ command: () => [process.execPath, ["-e", code]] });

  it("fails when the program changes the fixture root's own mode to 0777", { skip: MODES_SUPPORTED ? false : "Windows has no POSIX permission bits" }, () => {
    const go = runCase(probe, node("")).observation;
    const ts = runCase(probe, node('require("node:fs").chmodSync(".", 0o777)')).observation;
    assert.deepEqual(go.changed, []);
    assert.deepEqual(ts.changed, [{ path: ".", kind: "dir" }]);
    assert.equal(ts.modes?.get("."), "0777");
    assert.deepEqual(compareObservations(probe, go, ts).map((d) => d.field), ["tree"]);
    assert.deepEqual(compareObservations(probe, go, go), []);
  });

  it("fails when a generated PNG is a symbolic link to the source instead of a regular file", { skip: process.platform === "win32" ? "symbolic links need extra rights on Windows" : false }, () => {
    const setup = 'const fs=require("node:fs");fs.mkdirSync("in");fs.writeFileSync("in/logo.png","\\x89PNG\\r\\n");';
    const go = runCase(probe, node(`${setup}fs.mkdirSync("out");fs.copyFileSync("in/logo.png","out/logo.png")`)).observation;
    const ts = runCase(probe, node(`${setup}fs.mkdirSync("out");fs.symlinkSync("../in/logo.png","out/logo.png")`)).observation;
    assert.deepEqual(go.added.find((c) => c.path === "out/logo.png"), { path: "out/logo.png", kind: "file" });
    assert.deepEqual(ts.added.find((c) => c.path === "out/logo.png"), { path: "out/logo.png", kind: "symlink" });
    assert.equal(ts.links?.get("out/logo.png"), "../in/logo.png");
    assert.equal(ts.files.has("out/logo.png"), false, "a link's target bytes are never read as the link's own");
    assert.ok(compareObservations(probe, go, ts).some((d) => d.field === "tree"));
  });

  it("fails when a symbolic link points somewhere else, and records an absolute target under {ROOT}", { skip: process.platform === "win32" ? "symbolic links need extra rights on Windows" : false }, () => {
    const setup = 'const fs=require("node:fs"),p=require("node:path");fs.writeFileSync("a","a");fs.writeFileSync("b","b");';
    const go = runCase(probe, node(`${setup}fs.symlinkSync(p.join(process.cwd(),"a"),"link")`)).observation;
    const ts = runCase(probe, node(`${setup}fs.symlinkSync(p.join(process.cwd(),"b"),"link")`)).observation;
    assert.equal(go.links?.get("link"), "{ROOT}/a");
    assert.deepEqual(compareObservations(probe, go, ts).map((d) => d.field), ["link:link"]);
  });
});
