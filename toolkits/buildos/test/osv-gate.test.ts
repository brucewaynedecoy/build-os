// OSV gate self-check. CI runs this file in the OSV job before the real scan,
// so a broken gate fails the job before it can pass a bad scan.
// Fixtures in test/fixtures/osv/ are real osv-scanner 2.7.1 outputs, trimmed:
// - findings-above-threshold.json: lodash 4.17.20, scores 5.3, 6.9, 7.2, 8.1 (exit 1)
// - findings-below-threshold.json: the same run with only the 5.3 and 6.9 groups kept
// - clean.json: this package's lockfile with the OSV API reachable (exit 0)
// - unreachable-api.json: the same lockfile with the OSV API unreachable (exit 127).
//   It is byte-identical to clean.json, which is why the gate needs the exit code.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { collectFindings, evaluateGate, isBlocking, parseCvssScore, parseGateArgs } from "../scripts/osv-gate.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(packageRoot, "test", "fixtures", "osv");
const fixture = (name: string) => readFileSync(join(fixtureDir, name), "utf8");

function runGate(args: string[]) {
  const result = spawnSync(process.execPath, [join(packageRoot, "scripts", "osv-gate.ts"), ...args], { encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("OSV gate decision", () => {
  it("fails on findings above the threshold (exit 1)", () => {
    const decision = evaluateGate({ scannerExitCode: 1, outputText: fixture("findings-above-threshold.json") });
    assert.equal(decision.pass, false);
    assert.equal(decision.findings.length, 4);
    assert.deepEqual(decision.blocking.map((f) => f.maxSeverity), ["7.2", "8.1"]);
  });

  it("passes on findings below the threshold (exit 1)", () => {
    const decision = evaluateGate({ scannerExitCode: 1, outputText: fixture("findings-below-threshold.json") });
    assert.deepEqual(decision.problems, []);
    assert.equal(decision.pass, true);
    assert.equal(decision.findings.length, 2);
  });

  it("passes on a clean scan (exit 0)", () => {
    assert.deepEqual(evaluateGate({ scannerExitCode: 0, outputText: fixture("clean.json") }), {
      pass: true,
      problems: [],
      findings: [],
      blocking: [],
    });
  });

  it("fails when the OSV API is unreachable (exit 127, empty results)", () => {
    const decision = evaluateGate({ scannerExitCode: 127, outputText: fixture("unreachable-api.json") });
    assert.equal(decision.pass, false);
    assert.match(decision.problems.join("\n"), /scanner exited 127 .*did not complete/);
  });

  const operational: [string, number | undefined, string | undefined][] = [
    ["no packages found (exit 128)", 128, fixture("clean.json")],
    ["another non-findings exit code", 2, fixture("clean.json")],
    ["a missing exit code", undefined, fixture("clean.json")],
    ["a missing output file", 0, undefined],
    ["an empty output file", 0, ""],
    ["output that is not JSON", 0, "Error: request failed"],
    ["output without a results array", 0, "{}"],
    ["null results", 0, '{"results": null}'],
    ["a results entry without packages", 0, '{"results": [{}]}'],
    ["exit 1 with no finding in the output", 1, fixture("clean.json")],
    ["exit 0 with findings in the output", 0, fixture("findings-below-threshold.json")],
  ];
  for (const [label, scannerExitCode, outputText] of operational) {
    it(`fails on ${label}`, () => {
      const decision = evaluateGate({ scannerExitCode, outputText });
      assert.equal(decision.pass, false);
      assert.ok(decision.problems.length > 0);
    });
  }

  const severities: [string | undefined, boolean][] = [
    ["9.8", true],
    ["7.0", true],
    ["7", true],
    ["10.0", true],
    ["6.9", false],
    ["0.0", false],
    ["5", false],
    ["", true],
    [undefined, true],
    ["5.3garbage", true],
    ["5.3 ", true],
    [" 5.3", true],
    ["+5.3", true],
    ["-1", true],
    ["5e0", true],
    ["0x5", true],
    ["5.", true],
    [".5", true],
    ["NaN", true],
    ["Infinity", true],
    ["10.1", true],
    ["11", true],
    ["06.9", true],
    // Tenths only: CVSS writes one decimal place.
    ["6.99", true],
    ["6.95", true],
    ["6.90", true],
    ["0.00", true],
    ["10.00", true],
    ["-0.0", true],
    ["07.0", true],
    [" 7.0", true],
    ["7.0 ", true],
    ["6.9\n", true],
    ["7e0", true],
    ["7.0e0", true],
    ["6.9E0", true],
    ["69e-1", true],
    ["MODERATE", true],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L", true],
  ];
  for (const [severity, blocks] of severities) {
    it(`severity ${JSON.stringify(severity) ?? "undefined"} blocks: ${String(blocks)}`, () => {
      const group: Record<string, unknown> = { ids: ["GHSA-x"] };
      if (severity !== undefined) group["max_severity"] = severity;
      const output = { results: [{ packages: [{ package: { name: "p", version: "1.0.0" }, groups: [group], vulnerabilities: [{ id: "GHSA-x" }] }] }] };
      const findings = collectFindings(output);
      assert.equal(findings.length, 1);
      assert.equal(isBlocking(findings[0]!), blocks);
      assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(output) }).pass, !blocks);
    });
  }

  it("parses only complete CVSS base scores in tenths", () => {
    const valid: [string, number][] = [["6.9", 6.9], ["7.0", 7], ["7", 7], ["10.0", 10], ["10", 10], ["0", 0], ["0.0", 0]];
    for (const [text, score] of valid) assert.equal(parseCvssScore(text), score, text);
    const invalid = ["", "5.3garbage", "NaN", "1e1", " 1", "10.5", "10.1", "-0", "-0.0", "6.99", "07.0", " 7.0", "7.0 ", "7e0", "7.0e0", "6.9E0", "10.00"];
    for (const text of invalid) assert.equal(parseCvssScore(text), undefined, text);
  });

  it("fails the reviewer's 6.99 report at exit 1", () => {
    const output = { results: [{ packages: [{ package: { name: "p", version: "1" }, groups: [{ ids: ["G-1"], max_severity: "6.99" }], vulnerabilities: [{ id: "G-1" }] }] }] };
    const decision = evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(output) });
    assert.equal(decision.pass, false);
    assert.deepEqual(decision.blocking.map((f) => f.maxSeverity), ["6.99"]);
  });

  it("treats an ungrouped vulnerability as unscored and blocking", () => {
    const output = { results: [{ packages: [{ package: { name: "p", version: "1" }, vulnerabilities: [{ id: "GHSA-y" }] }] }] };
    assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(output) }).pass, false);
  });

  // Review round 3: three reports the old gate passed.
  const pkg = (extra: Record<string, unknown>) => ({ results: [{ packages: [{ package: { name: "p", version: "1" }, ...extra }] }] });
  const reviewerCases: [string, number, unknown][] = [
    ["exit 0 with packages: [false]", 0, { results: [{ packages: [false] }] }],
    ["exit 1 with severity 5.3garbage", 1, pkg({ groups: [{ ids: ["G-1"], max_severity: "5.3garbage" }], vulnerabilities: [{ id: "G-1" }] })],
    [
      "exit 1 with a vulnerability left out of otherwise low-severity groups",
      1,
      pkg({ groups: [{ ids: ["G-1"], max_severity: "5.3" }], vulnerabilities: [{ id: "G-1" }, { id: "G-2" }] }),
    ],
  ];
  for (const [label, scannerExitCode, output] of reviewerCases) {
    it(`fails on ${label}`, () => {
      const decision = evaluateGate({ scannerExitCode, outputText: JSON.stringify(output) });
      assert.equal(decision.pass, false);
      assert.ok(decision.problems.length > 0);
    });
  }

  it("names the unaccounted vulnerability as blocking", () => {
    const decision = evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(reviewerCases[2]![2]) });
    assert.deepEqual(decision.blocking.map((f) => [f.ids, f.unscored]), [[["G-2"], "not in any group"]]);
  });

  const v1 = [{ id: "G-1" }];
  const g1 = [{ ids: ["G-1"], max_severity: "5.3" }];
  const malformed: [string, unknown][] = [
    ["a top-level array", []],
    ["a top-level null", null],
    ["results as an object", { results: {} }],
    ["a results entry that is null", { results: [null] }],
    ["a results entry that is an array", { results: [[]] }],
    ["packages as an object", { results: [{ packages: {} }] }],
    ["a package record that is null", { results: [{ packages: [null] }] }],
    ["a package record that is a string", { results: [{ packages: ["lodash"] }] }],
    ["a package record that is an array", { results: [{ packages: [[]] }] }],
    ["a package record without package", { results: [{ packages: [{ groups: g1, vulnerabilities: v1 }] }] }],
    ["package info that is a string", { results: [{ packages: [{ package: "p", groups: g1, vulnerabilities: v1 }] }] }],
    ["a package without a name", { results: [{ packages: [{ package: { version: "1" } }] }] }],
    ["a package with an empty name", { results: [{ packages: [{ package: { name: "", version: "1" } }] }] }],
    ["a package with a numeric version", { results: [{ packages: [{ package: { name: "p", version: 1 } }] }] }],
    ["groups as an object", pkg({ groups: {}, vulnerabilities: v1 })],
    ["vulnerabilities as an object", pkg({ groups: g1, vulnerabilities: { id: "G-1" } })],
    ["vulnerabilities as null", pkg({ groups: g1, vulnerabilities: null })],
    ["a vulnerability that is false", pkg({ groups: g1, vulnerabilities: [false] })],
    ["a vulnerability that is a string", pkg({ groups: g1, vulnerabilities: ["G-1"] })],
    ["a vulnerability without an id", pkg({ groups: g1, vulnerabilities: [{}] })],
    ["a vulnerability with a numeric id", pkg({ groups: g1, vulnerabilities: [{ id: 1 }] })],
    ["a vulnerability with an empty id", pkg({ groups: [{ ids: [""], max_severity: "5.3" }], vulnerabilities: [{ id: "" }] })],
    ["a group that is null", pkg({ groups: [null], vulnerabilities: v1 })],
    ["a group without ids", pkg({ groups: [{ max_severity: "5.3" }], vulnerabilities: v1 })],
    ["a group with empty ids", pkg({ groups: [{ ids: [], max_severity: "5.3" }], vulnerabilities: v1 })],
    ["a group with a non-string id", pkg({ groups: [{ ids: [1], max_severity: "5.3" }], vulnerabilities: v1 })],
    ["a group with ids as a string", pkg({ groups: [{ ids: "G-1", max_severity: "5.3" }], vulnerabilities: v1 })],
    ["a group with a numeric max_severity", pkg({ groups: [{ ids: ["G-1"], max_severity: 5.3 }], vulnerabilities: v1 })],
    ["a group with a null max_severity", pkg({ groups: [{ ids: ["G-1"], max_severity: null }], vulnerabilities: v1 })],
    ["a group that names an unreported vulnerability", pkg({ groups: [{ ids: ["G-1", "G-9"], max_severity: "5.3" }], vulnerabilities: v1 })],
    ["groups with no vulnerabilities", pkg({ groups: g1 })],
  ];
  for (const [label, output] of malformed) {
    for (const scannerExitCode of [0, 1]) {
      it(`fails on ${label} (exit ${scannerExitCode})`, () => {
        assert.throws(() => collectFindings(output));
        const decision = evaluateGate({ scannerExitCode, outputText: JSON.stringify(output) });
        assert.equal(decision.pass, false);
        assert.match(decision.problems.join("\n"), /malformed/);
      });
    }
  }

  it("fails on a valid report with one scored group above the threshold among low ones", () => {
    const output = pkg({
      groups: [
        { ids: ["G-1"], max_severity: "5.3" },
        { ids: ["G-2"], max_severity: "7.0" },
      ],
      vulnerabilities: [{ id: "G-1" }, { id: "G-2" }],
    });
    assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(output) }).pass, false);
  });

  it("passes a vulnerability named by two low groups, and fails when either group is unscored", () => {
    const vulns = [{ id: "G-1" }];
    const low = pkg({ groups: [{ ids: ["G-1"], max_severity: "5.3" }, { ids: ["G-1"], max_severity: "4.0" }], vulnerabilities: vulns });
    assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(low) }).pass, true);
    const mixed = pkg({ groups: [{ ids: ["G-1"], max_severity: "5.3" }, { ids: ["G-1"] }], vulnerabilities: vulns });
    assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(mixed) }).pass, false);
  });

  it("passes exit 0 with a package record that holds no vulnerability", () => {
    const output = pkg({});
    assert.equal(evaluateGate({ scannerExitCode: 0, outputText: JSON.stringify(output) }).pass, true);
    assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(output) }).pass, false);
  });

  it("fails exit 0 when a package record holds an unaccounted vulnerability", () => {
    const output = pkg({ vulnerabilities: [{ id: "G-1" }] });
    assert.equal(evaluateGate({ scannerExitCode: 0, outputText: JSON.stringify(output) }).pass, false);
  });

  it("keeps real fixture fields that the gate does not read, such as aliases and purl", () => {
    const output = pkg({ groups: [{ ids: ["G-1"], aliases: ["CVE-1", "G-1"], max_severity: "6.9" }], vulnerabilities: [{ id: "G-1", aliases: ["CVE-1"] }] });
    assert.equal(evaluateGate({ scannerExitCode: 1, outputText: JSON.stringify(output) }).pass, true);
  });
});

describe("OSV gate arguments", () => {
  it("reads --exit-code and the file", () => {
    assert.deepEqual(parseGateArgs(["--exit-code", "127", "out.json"]), { exitCode: 127, file: "out.json" });
    assert.deepEqual(parseGateArgs(["--exit-code=0", "out.json"]), { exitCode: 0, file: "out.json" });
  });

  it("keeps a non-numeric exit code as missing, so the gate fails", () => {
    assert.deepEqual(parseGateArgs(["--exit-code", "", "out.json"]), { exitCode: undefined, file: "out.json" });
  });

  it("rejects usage without an exit code or file", () => {
    assert.equal(parseGateArgs(["out.json"]), undefined);
    assert.equal(parseGateArgs(["--exit-code", "0"]), undefined);
    assert.equal(parseGateArgs(["--exit-code"]), undefined);
  });
});

const tempDir = mkdtempSync(join(tmpdir(), "buildos-osv-gate-"));
after(() => rmSync(tempDir, { recursive: true, force: true }));
function writeTemp(name: string, output: unknown): string {
  const file = join(tempDir, name);
  writeFileSync(file, JSON.stringify(output));
  return file;
}

describe("OSV gate script", () => {
  const cases: [string, string[], number][] = [
    ["findings above threshold", ["--exit-code", "1", join(fixtureDir, "findings-above-threshold.json")], 1],
    ["findings below threshold", ["--exit-code", "1", join(fixtureDir, "findings-below-threshold.json")], 0],
    ["unreachable API", ["--exit-code", "127", join(fixtureDir, "unreachable-api.json")], 1],
    ["clean", ["--exit-code", "0", join(fixtureDir, "clean.json")], 0],
    ["missing output file", ["--exit-code", "0", join(fixtureDir, "does-not-exist.json")], 1],
    ["no exit code (old call form)", [join(fixtureDir, "clean.json")], 2],
    ["exit 0 with packages: [false]", ["--exit-code", "0", writeTemp("packages-false.json", { results: [{ packages: [false] }] })], 1],
    [
      "exit 1 with severity 5.3garbage",
      ["--exit-code", "1", writeTemp("garbage.json", { results: [{ packages: [{ package: { name: "p", version: "1" }, groups: [{ ids: ["G-1"], max_severity: "5.3garbage" }], vulnerabilities: [{ id: "G-1" }] }] }] })],
      1,
    ],
    [
      "exit 1 with an unaccounted vulnerability",
      ["--exit-code", "1", writeTemp("unaccounted.json", { results: [{ packages: [{ package: { name: "p", version: "1" }, groups: [{ ids: ["G-1"], max_severity: "5.3" }], vulnerabilities: [{ id: "G-1" }, { id: "G-2" }] }] }] })],
      1,
    ],
  ];
  for (const [label, args, code] of cases) {
    it(`exits ${code} on ${label}`, () => {
      const result = runGate(args);
      assert.equal(result.code, code, result.stdout + result.stderr);
    });
  }
});
