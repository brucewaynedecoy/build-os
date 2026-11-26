// Byte-for-byte parity with the Go seed (PRD 20 Compatibility).
// Goldens in test/fixtures/go-seed/cli-goldens.json come from the real Go
// binary through scripts/capture-go-goldens.ts. Every case must match stdout,
// stderr, and the exit code, unless it is listed below as a recorded parity
// exception or as a domain that a later phase ports.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { GO_ISPRINT_VERSION } from "../src/core/shared/go-isprint.ts";
import { goIsPrint, goQuote, parseGoFlags } from "../src/cli/parse.ts";
import { BUILTIN_DOMAINS, run } from "../src/cli/run.ts";
import { captureIo } from "./helpers.ts";
import { CAPTURE_CASES, type GoldenCase } from "../scripts/capture-go-goldens.ts";
import { seedExceptionProblems, type SeedException } from "./golden/harness.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const goldens = JSON.parse(readFileSync(join(packageRoot, "test", "fixtures", "go-seed", "cli-goldens.json"), "utf8")) as {
  cases: GoldenCase[];
};

/**
 * Recorded parity exceptions for the seed goldens. The one list of approved
 * exceptions is test/golden/parity-exceptions.json (`go_seed`); each ID has a
 * reason and an owner decision in the backlog evidence report. PE-001 to
 * PE-003 apply here (owner approval: 2026-11-23). Each entry names the exact
 * allowed value of each field that differs; every other field must equal Go.
 */
const exceptionsFile = JSON.parse(readFileSync(join(packageRoot, "test", "golden", "parity-exceptions.json"), "utf8")) as {
  exceptions: { id: string; go_seed: SeedException[]; golden: { case: string; field: string; actual: string | null }[] }[];
};
const PARITY_EXCEPTIONS: Record<string, { id: string; allowed: SeedException["allowed"] }> = Object.fromEntries(
  exceptionsFile.exceptions.flatMap((e) => e.go_seed.map((s) => [JSON.stringify(s.args), { id: e.id, allowed: s.allowed }] as const)),
);

/** Domains whose Go cases wait for their port phase. */
const PENDING_DOMAINS: Record<string, string> = {};

const key = (args: readonly string[]) => JSON.stringify(args);

async function tsRun(args: readonly string[]) {
  const io = captureIo();
  const exit = await run(args, io, { domains: BUILTIN_DOMAINS, buildInfo: { version: "dev", sourceRevision: "unknown" } });
  return { stdout: io.stdout(), stderr: io.stderr(), exit };
}

describe("Go seed parity", () => {
  it("lists the seed exceptions PE-001 to PE-003 in parity-exceptions.json", () => {
    assert.deepEqual([...new Set(Object.values(PARITY_EXCEPTIONS).map((e) => e.id))].sort(), ["PE-001", "PE-002", "PE-003"]);
    assert.equal(Object.keys(PARITY_EXCEPTIONS).length, 11);
    for (const [args, e] of Object.entries(PARITY_EXCEPTIONS)) {
      assert.ok(Object.keys(e.allowed).length > 0, `${e.id} ${args} allows no field`);
      for (const field of Object.keys(e.allowed)) assert.ok(["exit", "stdout", "stderr"].includes(field), `${e.id} ${args}: unknown field ${field}`);
    }
  });

  it("allows the same exact values for a seed case as for its golden-harness case", () => {
    const golden = (id: string, c: string, field: string) =>
      exceptionsFile.exceptions.find((e) => e.id === id)?.golden.find((g) => g.case === c && g.field === field)?.actual;
    assert.equal(PARITY_EXCEPTIONS[key(["help"])]?.allowed.stdout, golden("PE-001", "cli-help", "stdout"));
    assert.equal(PARITY_EXCEPTIONS[key(["help", "version"])]?.allowed.stdout, golden("PE-002", "cli-help-version", "stdout"));
    const versionHelp = PARITY_EXCEPTIONS[key(["version", "--help"])]?.allowed;
    assert.equal(String(versionHelp?.exit), golden("PE-003", "cli-version-help", "exit"));
    assert.equal(versionHelp?.stdout, golden("PE-003", "cli-version-help", "stdout"));
    assert.equal(versionHelp?.stderr, golden("PE-003", "cli-version-help", "stderr"));
  });

  // Review fix: an exception case used to pass on any difference at all.
  it("fails an exception case that adds stderr, changes the exit code, or drifts in an allowed field", () => {
    const go = goldens.cases.find((c) => key(c.args) === key(["-h"]));
    const e = PARITY_EXCEPTIONS[key(["-h"])];
    assert.ok(go !== undefined && e !== undefined);
    const approved = { exit: go.exit, stdout: e.allowed.stdout ?? "", stderr: go.stderr };
    assert.deepEqual(seedExceptionProblems("PE-001 -h", go, approved, e.allowed), []);
    const extraStderr = seedExceptionProblems("PE-001 -h", go, { ...approved, stderr: `${go.stderr}warning\n` }, e.allowed);
    assert.equal(extraStderr.length, 1);
    assert.match(extraStderr[0] ?? "", /stderr .* does not allow a difference in stderr/);
    const exitChanged = seedExceptionProblems("PE-001 -h", go, { ...approved, exit: go.exit + 1 }, e.allowed);
    assert.match(exitChanged[0] ?? "", /exit .* does not allow a difference in exit/);
    const otherStdout = seedExceptionProblems("PE-001 -h", go, { ...approved, stdout: `${approved.stdout} ` }, e.allowed);
    assert.match(otherStdout[0] ?? "", /the exception allows exactly/);
    const stale = seedExceptionProblems("PE-001 -h", go, { ...approved, stdout: go.stdout }, { stdout: go.stdout });
    assert.match(stale[0] ?? "", /now equals Go/);
  });

  it("has a golden for every capture case", () => {
    assert.deepEqual(goldens.cases.map((c) => key(c.args)), CAPTURE_CASES.map(key));
  });

  for (const golden of goldens.cases) {
    const id = key(golden.args);
    const first = golden.args[0] ?? "";
    const pending = Object.hasOwn(PENDING_DOMAINS, first) ? PENDING_DOMAINS[first] : undefined;
    const exception = Object.hasOwn(PARITY_EXCEPTIONS, id) ? PARITY_EXCEPTIONS[id] : undefined;
    if (pending !== undefined) {
      it(`buildos ${golden.args.join(" ")}`, { skip: pending }, () => {});
      continue;
    }
    if (exception !== undefined) {
      // The allowed fields must hold their exact approved values and still
      // differ from Go; every other field must equal Go.
      it(`buildos ${golden.args.join(" ") || "(no args)"} differs only as recorded in ${exception.id}`, async () => {
        const actual = await tsRun(golden.args);
        assert.deepEqual(seedExceptionProblems(`${exception.id} ${id}`, golden, actual, exception.allowed), []);
      });
      continue;
    }
    it(`buildos ${golden.args.join(" ")} matches the Go seed byte for byte`, async () => {
      const actual = await tsRun(golden.args);
      assert.equal(actual.exit, golden.exit, "exit code");
      assert.equal(actual.stdout, golden.stdout, "stdout");
      assert.equal(actual.stderr, golden.stderr, "stderr");
    });
  }

  it("keeps the TypeScript root help a superset of the seed's command lines that exist", async () => {
    const { stdout } = await tsRun(["help"]);
    assert.match(stdout, /^BuildOS deterministic project tooling\n/);
    assert.match(stdout, /\n {2}version {2,}Print the package version and source revision\n/);
  });
});

describe("Go flag parser", () => {
  const spec = { json: "boolean", root: "string" } as const;

  it("accepts single and double dash, inline values, and next-argument values", () => {
    assert.deepEqual(parseGoFlags(spec, ["-json", "--root", "-x"]), { values: { json: true, root: "-x" }, positionals: [] });
    assert.deepEqual(parseGoFlags(spec, ["--json=false", "-root=a=b"]), { values: { json: false, root: "a=b" }, positionals: [] });
  });

  it("stops at the first non-flag, a lone dash, or after --", () => {
    assert.deepEqual(parseGoFlags(spec, ["x", "--json"]).positionals, ["x", "--json"]);
    assert.deepEqual(parseGoFlags(spec, ["-", "--json"]).positionals, ["-", "--json"]);
    assert.deepEqual(parseGoFlags(spec, ["--", "--json"]).positionals, ["--json"]);
  });

  it("reports Go error text and keeps flags parsed before the error", () => {
    const cases: [string[], string][] = [
      [["--root"], "flag needs an argument: -root"],
      [["--nope"], "flag provided but not defined: -nope"],
      [["-help"], "flag: help requested"],
      [["--h=1"], "flag: help requested"],
      [["---json"], "bad flag syntax: ---json"],
      [["--json=no"], 'invalid boolean value "no" for -json: parse error'],
    ];
    for (const [args, message] of cases) assert.throws(() => parseGoFlags(spec, args), { message });
    assert.throws(() => parseGoFlags(spec, ["--json", "--nope"]), (error: { partial: { values: object } }) => {
      assert.deepEqual(error.partial.values, { json: true });
      return true;
    });
  });

  const prototypeKeys = ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf", "isPrototypeOf", "toLocaleString"];
  for (const key of prototypeKeys) {
    it(`rejects the Object.prototype key ${key} as a boolean value and as a flag name`, () => {
      assert.throws(() => parseGoFlags(spec, [`--json=${key}`]), { message: `invalid boolean value "${key}" for -json: parse error` });
      assert.throws(() => parseGoFlags(spec, [`-${key}`]), { message: `flag provided but not defined: -${key}` });
      assert.throws(() => parseGoFlags(spec, [`--${key}=1`]), { message: `flag provided but not defined: -${key}` });
    });
  }

  it("sets a boolean flag to false on an invalid value, as Go boolValue.Set does", () => {
    assert.throws(() => parseGoFlags(spec, ["--json", "--json=toString"]), (error: { partial: { values: object } }) => {
      assert.deepEqual(error.partial.values, { json: false });
      return true;
    });
  });

  it("stores a flag named __proto__ as an own value, not as the prototype", () => {
    const protoSpec = JSON.parse('{"__proto__": "string"}') as Record<string, "string">;
    const parsed = parseGoFlags(protoSpec, ["--__proto__=x"]);
    assert.equal(Object.hasOwn(parsed.values, "__proto__"), true);
    assert.equal(Object.getPrototypeOf(parsed.values), Object.prototype);
    assert.equal(({} as Record<string, unknown>)["x"], undefined);
  });

  it("quotes like Go %q", () => {
    assert.equal(goQuote('a"b\\c'), '"a\\"b\\\\c"');
    assert.equal(goQuote("tab\tnl\n\x01\x7f"), '"tab\\tnl\\n\\x01\\x7f"');
    assert.equal(goQuote("é😀"), '"é😀"');
    assert.equal(goQuote("​"), '"\\u200b"');
  });

  // Review round 4: Go 1.24.1 escapes characters newer than its Unicode 15.0.0
  // tables, even where Node's Unicode data calls them printable.
  it("quotes characters newer than Go's Unicode tables as Go does", () => {
    assert.equal(goQuote("\u{1fae9}"), '"\\U0001fae9"');
    assert.equal(goQuote("\u0897"), '"\\u0897"');
    assert.equal(goQuote("\u{e0001}"), '"\\U000e0001"');
    assert.equal(goQuote("e\u0301\ufffd"), '"e\u0301\ufffd"');
    assert.equal(goQuote("\ud800"), '"\\ufffd"');
    assert.equal(goQuote("\u00a0\u00ad"), '"\\u00a0\\u00ad"');
  });

  it("matches Go 1.24.1 strconv.IsPrint for every code point", () => {
    // The Go side: every rune r in 0..0x10FFFF where strconv.IsPrint(r), one
    // decimal per line, from Go 1.24.1. 148998 runes, sha256 below.
    assert.equal(GO_ISPRINT_VERSION, "go1.24.1");
    const printable: number[] = [];
    for (let code = 0; code <= 0x10ffff; code++) if (goIsPrint(code)) printable.push(code);
    assert.equal(printable.length, 148998);
    const digest = createHash("sha256").update(`${printable.join("\n")}\n`).digest("hex");
    assert.equal(digest, "c9c4678e8df32b99c9755e15e988199037f25f3cd0166740540323689c8f9666");
  });
});
