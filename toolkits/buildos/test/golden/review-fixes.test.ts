// Regression tests for the W1 R7 P2 review fixes: root encodings and literal
// tokens in normalization, permission bits, exact exception fields, capture
// drift against existing goldens, the artifact manifest, the capture
// workflow, and case coverage. None of them runs Go.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve, win32 } from "node:path";
import { after, before, describe, it } from "node:test";
import { goQuote } from "../../src/cli/parse.ts";
import {
  GOLDEN_ROOT,
  MODES_SUPPORTED,
  PACKAGE_ROOT,
  checkCapture,
  compareObservations,
  goJsonEscape,
  goldenDir,
  judge,
  loadExceptions,
  loadManifest,
  normalizeText,
  osGoldenDir,
  planCapture,
  readGoldenDir,
  rootEncodings,
  runCase,
  spellingVariants,
  unescapeTokens,
  verifyGoldenSet,
  type GoldenCase,
  type Observation,
  type RunContext,
  type Runner,
} from "./harness.ts";

const manifest = loadManifest();
const byId = (id: string): GoldenCase => {
  const found = manifest.cases.find((c) => c.id === id);
  assert.ok(found !== undefined, `no case ${id}`);
  return found;
};

// ---------------------------------------------------------------- Normalization

describe("root normalization in every encoding (finding 1)", () => {
  // A Windows runner: the temporary folder comes back in 8.3 short form, and
  // its real path is the long form.
  const short = win32.join("C:\\Users\\RUNNER~1\\AppData\\Local\\Temp", "buildos-golden-Ab12", "work");
  const long = win32.join("C:\\Users\\runneradmin\\AppData\\Local\\Temp", "buildos-golden-Ab12", "work");
  const ctx: RunContext = { roots: rootEncodings(spellingVariants([short, long], true)), startMs: 0, endMs: 0, dates: ["2026-11-23"] };
  const rel = ["system", "assets", "team roster", "team-roster.md"];

  for (const [name, root] of [["8.3 short form", short], ["long form", long]] as const) {
    it(`replaces the ${name} raw, with forward slashes, JSON-escaped, and Go-quoted, and keeps the suffix`, () => {
      const full = win32.join(root, ...rel);
      assert.equal(normalizeText(`wrote ${full}\n`, ctx), "wrote {ROOT}\\system\\assets\\team roster\\team-roster.md\n");
      assert.equal(normalizeText(`wrote ${full.replace(/\\/g, "/")}\n`, ctx), "wrote {ROOT}/system/assets/team roster/team-roster.md\n");
      // encoding/json (Go) and JSON.stringify spell a backslash as two.
      assert.equal(normalizeText(`{"path":"${goJsonEscape(full)}"}`, ctx), '{"path":"{ROOT}\\\\system\\\\assets\\\\team roster\\\\team-roster.md"}');
      assert.equal(normalizeText(JSON.stringify({ path: full }), ctx), '{"path":"{ROOT}\\\\system\\\\assets\\\\team roster\\\\team-roster.md"}');
      // %q (strconv.Quote) keeps its quotes and escapes around {ROOT}.
      assert.equal(normalizeText(`open ${goQuote(full)}: denied`, ctx), 'open "{ROOT}\\\\system\\\\assets\\\\team roster\\\\team-roster.md": denied');
      // Drive letter in lower case.
      assert.equal(normalizeText(`c${full.slice(1)}`, ctx), "{ROOT}\\system\\assets\\team roster\\team-roster.md");
    });
  }

  it("replaces a POSIX root and its real path in every encoding", () => {
    const given = "/var/folders/x/T/buildos-golden-Ab12/work";
    const real = `/private${given}`;
    const posixCtx: RunContext = { roots: rootEncodings(spellingVariants([given, real], false)), startMs: 0, endMs: 0, dates: [] };
    for (const root of [given, real]) {
      const full = posix.join(root, "a b", "c\"d.md");
      assert.equal(normalizeText(full, posixCtx), '{ROOT}/a b/c"d.md');
      assert.equal(normalizeText(JSON.stringify(full), posixCtx), '"{ROOT}/a b/c\\"d.md"');
      assert.equal(normalizeText(goQuote(full), posixCtx), '"{ROOT}/a b/c\\"d.md"');
    }
  });

  it("escapes a root that holds characters JSON and %q escape differently", () => {
    const odd = "/tmp/a&b<c>/work";
    const oddCtx: RunContext = { roots: rootEncodings([odd]), startMs: 0, endMs: 0, dates: [] };
    assert.equal(normalizeText(`"${goJsonEscape(`${odd}/x`)}"`, oddCtx), '"{ROOT}/x"');
    assert.equal(normalizeText(goQuote(`${odd}/x`), oddCtx), '"{ROOT}/x"');
  });

  it("normalizes the run date of a design path with any separator", () => {
    assert.equal(normalizeText("designs/2026-11-23-x.md designs\\2026-11-23-x.md designs\\\\2026-11-23-x.md", ctx), "designs/{DATE}-x.md designs\\{DATE}-x.md designs\\\\{DATE}-x.md");
  });

  it("never lets literal {ROOT}, {TIMESTAMP}, or {DATE} text pass for a substituted value", () => {
    const now = Date.parse("2026-11-23T10:00:00Z");
    const window: RunContext = { ...ctx, startMs: now, endMs: now };
    const realRun = normalizeText(`wrote ${short}\\a.md at 2026-11-23T10:00:00Z to designs/2026-11-23-x.md\n`, window);
    const literal = normalizeText("wrote {ROOT}\\a.md at {TIMESTAMP} to designs/{DATE}-x.md\n", window);
    assert.equal(realRun, "wrote {ROOT}\\a.md at {TIMESTAMP} to designs/{DATE}-x.md\n");
    assert.notEqual(literal, realRun);
    assert.equal(literal, "wrote {!ROOT}\\a.md at {!TIMESTAMP} to designs/{!DATE}-x.md\n");
    // Unescaped for display, both read the same.
    assert.equal(unescapeTokens(literal), unescapeTokens(realRun));
    // The escape mark itself is escaped, so the escape stays one-to-one.
    assert.notEqual(normalizeText("{!ROOT}", window), normalizeText("{ROOT}", window));
    assert.equal(unescapeTokens(normalizeText("{!ROOT} {{ROOT}", window)), "{!ROOT} {{ROOT}");
    // A literal brace before a real root stays distinct from a literal token.
    assert.notEqual(normalizeText(`{${short}`, window), normalizeText("{{ROOT}", window));
  });

  it("fails the comparator when a program prints the literal {ROOT} instead of the folder", () => {
    const testCase = byId("intake-convert-csv");
    const golden = readGoldenDir(osGoldenDir(testCase, "darwin"));
    const literal = Buffer.from(golden.stdout.toString("utf8").replace(/\{ROOT\}/g, "{!ROOT}"));
    assert.ok(!literal.equals(golden.stdout));
    const diffs = compareObservations(testCase, golden, { ...golden, stdout: literal });
    assert.deepEqual(diffs.map((d) => d.field), ["stdout"]);
  });
});

// ---------------------------------------------------------------- Permission bits

describe("permission bits (finding 4a)", () => {
  it("records modes in every POSIX-captured golden that writes files", () => {
    for (const testCase of manifest.cases) {
      for (const dir of [goldenDir(testCase), osGoldenDir(testCase, "darwin"), osGoldenDir(testCase, "linux")]) {
        let golden: Observation;
        try {
          golden = readGoldenDir(dir);
        } catch {
          continue;
        }
        assert.ok(golden.modes !== undefined, `${dir} has no modes; recapture it`);
        for (const c of [...golden.added, ...golden.changed]) assert.ok(golden.modes.has(c.path), `${dir}: no mode for ${c.path}`);
      }
    }
  });

  it("fails one changed permission bit in a written file and passes when modes are not recorded", () => {
    const testCase = byId("intake-convert-csv");
    const golden = readGoldenDir(osGoldenDir(testCase, "darwin"));
    assert.equal(golden.modes?.get("system/assets/team-roster/team-roster.csv"), "0644");
    const modes = new Map(golden.modes);
    modes.set("system/assets/team-roster/team-roster.csv", "0600");
    const diffs = compareObservations(testCase, golden, { ...golden, modes });
    assert.deepEqual(diffs.map((d) => `${d.field} ${d.detail}`), ["mode:system/assets/team-roster/team-roster.csv expected mode 0644, actual mode 0600"]);
    const { modes: _ignored, ...withoutModes } = golden;
    assert.deepEqual(compareObservations(testCase, golden, withoutModes), []);
  });

  it("fails end to end when a program writes the same bytes with other permission bits", { skip: MODES_SUPPORTED ? false : "Windows has no POSIX permission bits" }, () => {
    const testCase: GoldenCase = { id: "mode-probe", tool: "buildos", domain: "cli", invocation: "buildos", args: [], fixture: null, kind: "success", exit: 0 };
    const writer = (mode: number): Runner => ({
      command: () => [process.execPath, ["-e", `require("node:fs").writeFileSync("out.txt", "same\\n", { mode: ${mode} })`]],
    });
    const go = runCase(testCase, writer(0o666)).observation;
    const ts = runCase(testCase, writer(0o600)).observation;
    assert.equal(go.modes?.get("out.txt"), "0644", "cases run under umask 022");
    assert.equal(ts.modes?.get("out.txt"), "0600");
    assert.deepEqual(compareObservations(testCase, go, ts).map((d) => d.field), ["mode:out.txt"]);
  });
});

// ---------------------------------------------------------------- Exceptions

describe("parity exceptions allow only the listed fields (finding 4b)", () => {
  const exceptions = loadExceptions();

  it("fails an excepted case that also adds stderr or changes the exit code", () => {
    const testCase = byId("cli-help");
    const golden = readGoldenDir(goldenDir(testCase));
    const allowed = exceptions.exceptions.find((e) => e.id === "PE-001")?.golden[0]?.actual;
    assert.ok(typeof allowed === "string");
    const approved: Observation = { ...golden, stdout: Buffer.from(allowed) };
    const clean = judge(testCase, compareObservations(testCase, golden, approved), exceptions);
    assert.equal(clean.unexplained.length + clean.stale.length, 0);
    const extraStderr = judge(testCase, compareObservations(testCase, golden, { ...approved, stderr: Buffer.from("warning\n") }), exceptions);
    assert.deepEqual(extraStderr.unexplained.map((d) => d.field), ["stderr"]);
    const exitChanged = judge(testCase, compareObservations(testCase, golden, { ...approved, exit: 2 }), exceptions);
    assert.deepEqual(exitChanged.unexplained.map((d) => d.field), ["exit"]);
  });

  it("fails an excepted exit code that is not the exact allowed value", () => {
    const testCase = byId("cli-version-help");
    const golden = readGoldenDir(goldenDir(testCase));
    const entry = (field: string) => exceptions.exceptions.find((e) => e.id === "PE-003")?.golden.find((g) => g.field === field)?.actual ?? "";
    const approved: Observation = { ...golden, exit: Number(entry("exit")), stdout: Buffer.from(entry("stdout")), stderr: Buffer.from(entry("stderr")) };
    assert.equal(judge(testCase, compareObservations(testCase, golden, approved), exceptions).unexplained.length, 0);
    const wrongExit = judge(testCase, compareObservations(testCase, golden, { ...approved, exit: 3 }), exceptions);
    assert.deepEqual(wrongExit.unexplained.map((d) => d.field), ["exit"]);
  });
});

// ---------------------------------------------------------------- Capture drift

describe("capture compares existing goldens before replacing them (finding 3)", () => {
  let root: string;
  let fresh: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "buildos-golden-drift-"));
    cpSync(GOLDEN_ROOT, join(root, "goldens"), { recursive: true });
    fresh = join(root, "fresh");
    // The fresh captures equal the committed goldens, as a repeat capture would.
    for (const id of ["intake-convert-csv", "discovery-help"]) {
      const testCase = byId(id);
      const source = testCase.os_dependent === undefined ? goldenDir(testCase) : osGoldenDir(testCase, "darwin");
      cpSync(source, goldenDir(testCase, fresh), { recursive: true });
    }
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports nothing when every existing golden equals the fresh capture", () => {
    const goldens = join(root, "goldens");
    for (const id of ["intake-convert-csv", "discovery-help"]) {
      const testCase = byId(id);
      for (const writeShared of [false, true]) {
        assert.deepEqual(planCapture(testCase, goldenDir(testCase, fresh), { platform: "darwin", writeShared, root: goldens }).drift, []);
      }
      assert.deepEqual(checkCapture(testCase, goldenDir(testCase, fresh), { platform: "darwin", root: goldens }), []);
    }
  });

  it("reports a planted change in an existing darwin golden, and --check fails on it", () => {
    const goldens = join(root, "goldens");
    const testCase = byId("intake-convert-csv");
    const planted = join(osGoldenDir(testCase, "darwin", goldens), "stdout");
    const original = readFileSync(planted);
    writeFileSync(planted, Buffer.concat([original, Buffer.from("planted\n")]));
    try {
      for (const writeShared of [false, true]) {
        const plan = planCapture(testCase, goldenDir(testCase, fresh), { platform: "darwin", writeShared, root: goldens });
        assert.deepEqual(plan.drift, [{ case: "intake-convert-csv", kind: "changed-os-golden" }]);
        assert.equal(plan.write, "own");
      }
      assert.match(checkCapture(testCase, goldenDir(testCase, fresh), { platform: "darwin", root: goldens }).join("\n"), /fresh capture differs from the darwin golden/);
    } finally {
      writeFileSync(planted, original);
    }
  });

  it("reports a changed shared golden, a shared-drift case, and an OS golden it would remove", () => {
    const goldens = join(root, "goldens");
    const testCase = byId("discovery-help");
    const planted = join(goldenDir(testCase, goldens), "stdout");
    const original = readFileSync(planted);
    writeFileSync(planted, Buffer.concat([original, Buffer.from("x")]));
    try {
      const freshDir = goldenDir(testCase, fresh);
      assert.deepEqual(planCapture(testCase, freshDir, { platform: "darwin", writeShared: true, root: goldens }).drift, [{ case: "discovery-help", kind: "changed-shared-golden" }]);
      assert.deepEqual(planCapture(testCase, freshDir, { platform: "darwin", writeShared: false, root: goldens }).drift, [{ case: "discovery-help", kind: "shared-drift" }]);
      assert.match(checkCapture(testCase, freshDir, { platform: "darwin", root: goldens }).join("\n"), /shared-drift/);
    } finally {
      writeFileSync(planted, original);
    }
    // A stale OS golden for a shared case is removed, and that is reported.
    cpSync(goldenDir(testCase, fresh), osGoldenDir(testCase, "darwin", goldens), { recursive: true });
    try {
      const plan = planCapture(testCase, goldenDir(testCase, fresh), { platform: "darwin", writeShared: false, root: goldens });
      assert.deepEqual(plan.drift, [
        { case: "discovery-help", kind: "removed-stale", path: "os/darwin/buildos-discovery/discovery-help", reason: "os-golden-for-shared-case" },
      ]);
      assert.equal(plan.removeOwn, true);
    } finally {
      rmSync(osGoldenDir(testCase, "darwin", goldens), { recursive: true, force: true });
    }
  });

  it("ignores only the modes field when a Windows capture is compared with a POSIX shared golden", () => {
    const goldens = join(root, "goldens");
    const testCase = byId("discovery-help");
    const result = join(goldenDir(testCase, fresh), "result.json");
    const original = readFileSync(result, "utf8");
    const parsed = JSON.parse(original) as Record<string, unknown>;
    delete parsed["modes"];
    writeFileSync(result, `${JSON.stringify(parsed, null, 2)}\n`);
    try {
      assert.deepEqual(planCapture(testCase, goldenDir(testCase, fresh), { platform: "win32", writeShared: false, root: goldens }).drift, []);
      assert.deepEqual(planCapture(testCase, goldenDir(testCase, fresh), { platform: "darwin", writeShared: false, root: goldens }).drift, [{ case: "discovery-help", kind: "shared-drift" }]);
    } finally {
      writeFileSync(result, original);
    }
  });
});

// ---------------------------------------------------------------- Artifact manifest

describe("capture artifact manifest (finding 2)", () => {
  const darwin = join(GOLDEN_ROOT, "os", "darwin");
  const verify = (dir: string) => spawnSync(process.execPath, [join(GOLDEN_ROOT, "capture.mjs"), "--verify-artifact", dir], { cwd: PACKAGE_ROOT, encoding: "utf8" });
  let copy: string;

  before(() => {
    copy = mkdtempSync(join(tmpdir(), "buildos-golden-artifact-"));
  });

  after(() => {
    rmSync(copy, { recursive: true, force: true });
  });

  const fresh = (name: string) => {
    const dir = join(copy, name);
    cpSync(darwin, dir, { recursive: true });
    return dir;
  };

  it("lists every file of the darwin set, hidden .os files included, with its SHA-256", () => {
    const record = JSON.parse(readFileSync(join(darwin, "capture-record.json"), "utf8")) as { golden_files: Record<string, string> };
    const hidden = Object.keys(record.golden_files).filter((p) => p.includes("/.os/"));
    assert.ok(hidden.length > 0, "the manifest must list files under .os/");
    assert.deepEqual(verifyGoldenSet(darwin, manifest), []);
    const run = verify(darwin);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /file\(s\) match the darwin manifest/);
  });

  it("fails a downloaded set with a changed byte, a missing hidden file, an extra file, or no record", () => {
    const record = JSON.parse(readFileSync(join(darwin, "capture-record.json"), "utf8")) as { golden_files: Record<string, string> };
    const hiddenFile = Object.keys(record.golden_files).find((p) => p.includes("/.os/"));
    assert.ok(hiddenFile !== undefined);

    const changed = fresh("changed");
    const target = join(changed, ...hiddenFile.split("/"));
    writeFileSync(target, Buffer.concat([readFileSync(target), Buffer.from("x")]));
    const a = verify(changed);
    assert.equal(a.status, 1);
    assert.match(a.stderr, new RegExp(`SHA-256 mismatch for ${hiddenFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

    const dropped = fresh("dropped");
    unlinkSync(join(dropped, ...hiddenFile.split("/")));
    const b = verify(dropped);
    assert.equal(b.status, 1);
    assert.match(b.stderr, /missing file .*\/\.os\//);

    const extra = fresh("extra");
    writeFileSync(join(extra, ".planted"), "x");
    const c = verify(extra);
    assert.equal(c.status, 1);
    assert.match(c.stderr, /file \.planted is not in the manifest/);

    const norecord = fresh("norecord");
    unlinkSync(join(norecord, "capture-record.json"));
    const d = verify(norecord);
    assert.equal(d.status, 1);
    assert.match(d.stderr, /capture-record\.json is missing/);
  });
});

// ---------------------------------------------------------------- Workflow

// W1 R7 P8 t12: the Go sources and the capture workflow are gone. The goldens
// are a frozen baseline; capture.mjs refuses every mode that ran Go.
describe("frozen Go baseline (W1 R7 P8 t12)", () => {
  const repo = resolve(PACKAGE_ROOT, "..", "..");
  const capture = (args: string[]) => spawnSync(process.execPath, [join(PACKAGE_ROOT, "test", "golden", "capture.mjs"), ...args], { cwd: PACKAGE_ROOT, encoding: "utf8" });

  it("the capture workflow and the Go sources are gone", () => {
    assert.equal(existsSync(join(repo, ".github", "workflows", "buildos-golden-capture.yml")), false);
    for (const path of ["toolkits/buildos/cmd", "toolkits/buildos/internal", "toolkits/buildos/pkg", "toolkits/buildos/go.mod", "toolkits/buildos-intake", "toolkits/buildos-discovery", "toolkits/buildos-design"]) {
      assert.equal(existsSync(join(repo, ...path.split("/"))), false, path);
    }
  });

  it("every capture mode that ran Go exits 2 and names the frozen commits", () => {
    for (const args of [[], ["--check"], ["--write-shared"], ["--report"]]) {
      const run = capture(args);
      assert.equal(run.status, 2, args.join(" "));
      assert.match(run.stderr, /capture from Go is retired \(W1 R7 P8\)/);
      assert.match(run.stderr, /263f5ca76082b42ed9a3fb43bab67929889010ed/);
      assert.match(run.stderr, /e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb/);
    }
  });

  it("each capture record names the frozen Go source commit, and CAPTURE.md records both commits", () => {
    for (const platform of ["darwin", "linux", "win32"]) {
      const record = JSON.parse(readFileSync(join(GOLDEN_ROOT, "os", platform, "capture-record.json"), "utf8")) as Record<string, unknown>;
      assert.equal(record["go_source_commit"], "263f5ca76082b42ed9a3fb43bab67929889010ed", platform);
    }
    const doc = readFileSync(join(GOLDEN_ROOT, "CAPTURE.md"), "utf8");
    assert.match(doc, /## Frozen Go Baseline/);
    assert.match(doc, /`e8a1ec7d02b0bfdf838d556c45f69e2b4e2ec1bb`/);
  });

  it("--verify-artifact still checks the committed linux set without Go", () => {
    const run = capture(["--verify-artifact", join(GOLDEN_ROOT, "os", "linux")]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /match the linux manifest/);
  });
});

// ---------------------------------------------------------------- Coverage

describe("case coverage (finding 5)", () => {
  /** Every flag of every Go legacy command (from the Go sources at capture). */
  const FLAGS: { tool: string; command: string[]; flags: string[] }[] = [
    { tool: "buildos-intake", command: ["convert"], flags: ["repo-root", "source", "assets-root", "type", "force", "dry-run"] },
    { tool: "buildos-intake", command: ["index", "references"], flags: ["repo-root", "assets-root", "output"] },
    { tool: "buildos-intake", command: ["index", "playbooks"], flags: ["repo-root", "playbooks-root", "output"] },
    {
      tool: "buildos-discovery",
      command: ["run", "discovery"],
      flags: ["repo-root", "playbook-id", "outcome", "title", "target", "dataset-ref", "evidence", "raw-finding", "dry-run"],
    },
    {
      tool: "buildos-discovery",
      command: ["qualify", "finding"],
      flags: ["repo-root", "run-id", "raw-finding-ref", "outcome", "title", "confirmation-test", "confirmation-evidence", "dry-run"],
    },
    { tool: "buildos-design", command: ["promote", "finding"], flags: ["repo-root", "finding-id", "route", "title", "slug", "dry-run"] },
  ];

  for (const { tool, command, flags } of FLAGS) {
    it(`covers every flag of ${tool} ${command.join(" ")} in a successful or failing case`, () => {
      const cases = manifest.cases.filter((c) => c.tool === tool && command.every((word, i) => c.args[i] === word));
      for (const flag of flags) {
        assert.ok(
          cases.some((c) => c.args.some((a) => a === `--${flag}` || a.startsWith(`--${flag}=`))),
          `${tool} ${command.join(" ")}: no case uses --${flag}`,
        );
      }
    });
  }

  it("has a write-failure case for each command that writes", () => {
    for (const command of [["buildos-intake", "convert"], ["buildos-intake", "index references"], ["buildos-intake", "index playbooks"], ["buildos-discovery", "run discovery"], ["buildos-discovery", "qualify finding"], ["buildos-design", "promote finding"]]) {
      const [tool, words] = command as [string, string];
      assert.ok(
        manifest.cases.some((c) => c.tool === tool && c.kind === "write-failure" && c.args.join(" ").startsWith(words)),
        `${tool} ${words} has no write-failure case`,
      );
    }
  });
});
