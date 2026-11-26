// The legacy-name mapping and the Go `flag` FlagSet port used by the
// discovery and design adapters (W1 R7 P5). The golden harness checks the
// full output; these tests pin the rules.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { goParseFlags, goPrintDefaults, GoFlagError, type GoFlagDef } from "../src/cli/go-flagset.ts";
import { invocationArgs, legacyEntrySource, legacyNotice } from "../src/cli/invocation.ts";

describe("invocation name", () => {
  it("maps a legacy Go tool name, passed by its entry file, to its domain and leaves other names alone", () => {
    assert.deepEqual(invocationArgs("buildos-discovery", ["run", "discovery"]), ["discovery", "run", "discovery"]);
    assert.deepEqual(invocationArgs("buildos-design", []), ["design"]);
    assert.deepEqual(invocationArgs("buildos-intake", ["help"]), ["intake", "help"]);
    assert.deepEqual(invocationArgs(undefined, ["discovery"]), ["discovery"]);
    assert.deepEqual(invocationArgs("buildos-entities", ["resolve"]), ["resolve"]);
  });

  it("never reads a name from a path: a path-like name is not a legacy name", () => {
    for (const path of ["/x/buildos-intake", "C:\\npm\\buildos-intake.cmd", "/tmp/buildos-intake.mjs", "/x/dist/buildos-intake.js"]) {
      assert.deepEqual(invocationArgs(path, ["help"]), ["help"]);
      assert.equal(legacyNotice(path), undefined);
    }
  });

  it("writes an entry file that passes its own name and loads the bundle next to it", () => {
    const text = legacyEntrySource("buildos-intake", "buildos.js");
    assert.ok(/^#!\/usr\/bin\/env node\n/.test(text), "shebang");
    assert.ok(/\nglobalThis\[Symbol\.for\("buildos\.commandName"\)\] = "buildos-intake";\nawait import\("\.\/buildos\.js"\);\n$/.test(text), "entry body");
    assert.throws(() => legacyEntrySource("buildos", "buildos.js"), /not a legacy command name/);
    assert.throws(() => legacyEntrySource("buildos-design", "../x.js"), /not a plain file name/);
  });
});

describe("Go flag set", () => {
  const defs: GoFlagDef[] = [
    { name: "repo-root", kind: "string", usage: "repository root", default: "." },
    { name: "target", kind: "list", usage: "a target; may be repeated" },
    { name: "x", kind: "bool", usage: "one letter" },
    { name: "dry-run", kind: "bool", usage: "plan only" },
  ];

  it("prints defaults as Go's PrintDefaults: sorted, type names, one-letter flags on one line, and string defaults", () => {
    assert.equal(
      goPrintDefaults(defs),
      "  -dry-run\n    \tplan only\n  -repo-root string\n    \trepository root (default \".\")\n  -target value\n    \ta target; may be repeated\n  -x\tone letter\n",
    );
  });

  it("repeats list flags, keeps the last string, stops at the first non-flag, and ignores the rest", () => {
    const parsed = goParseFlags("t", defs, ["-target", "A", "--target=B", "--repo-root", "r1", "-repo-root=r2", "--x", "pos", "--dry-run"]);
    assert.deepEqual(parsed.lists.get("target"), ["A", "B"]);
    assert.equal(parsed.strings.get("repo-root"), "r2");
    assert.equal(parsed.bools.get("x"), true);
    assert.equal(parsed.bools.get("dry-run"), false);
    assert.deepEqual(parsed.args, ["pos", "--dry-run"]);
  });

  it("writes Go's error and usage for an unknown flag, and only the usage for -h", () => {
    assert.throws(
      () => goParseFlags("t", defs, ["--bogus"]),
      (error: unknown) => error instanceof GoFlagError && error.message === "flag provided but not defined: -bogus" && error.output === `flag provided but not defined: -bogus\nUsage of t:\n${goPrintDefaults(defs)}`,
    );
    assert.throws(() => goParseFlags("t", defs, ["-h"]), (error: unknown) => error instanceof GoFlagError && error.message === "flag: help requested" && error.output === `Usage of t:\n${goPrintDefaults(defs)}`);
    assert.throws(() => goParseFlags("t", defs, ["--x=maybe"]), (error: unknown) => error instanceof GoFlagError && error.message === 'invalid boolean value "maybe" for -x: parse error');
    assert.throws(() => goParseFlags("t", defs, ["--repo-root"]), (error: unknown) => error instanceof GoFlagError && error.message === "flag needs an argument: -repo-root");
    assert.throws(() => goParseFlags("t", defs, ["---x"]), (error: unknown) => error instanceof GoFlagError && error.message === "bad flag syntax: ---x");
  });
});

describe("TypeScript-only switches in flag position (PE-011, PE-012; P5 review round 1)", () => {
  const defs: GoFlagDef[] = [
    { name: "title", kind: "string", usage: "title" },
    { name: "dry-run", kind: "bool", usage: "dry run" },
  ];
  const extras = ["--json", "--allow-outside-root"];
  const parse = (args: string[]) => goParseFlags("t", defs, args, { extras });

  it("finds a whole --json or --allow-outside-root before the first non-flag argument", () => {
    const flags = parse(["--json", "--dry-run", "--allow-outside-root"]);
    assert.deepEqual([...flags.extras].sort(), ["--allow-outside-root", "--json"]);
    assert.equal(flags.bools.get("dry-run"), true);
  });

  it("never takes a flag value, an argument after --, or an argument after a positional", () => {
    const value = parse(["--title", "--json", "--dry-run"]);
    assert.equal(value.strings.get("title"), "--json");
    assert.equal(value.bools.get("dry-run"), true);
    assert.equal(value.extras.size, 0);
    assert.equal(parse(["--", "--json"]).extras.size, 0);
    assert.deepEqual(parse(["--", "--json"]).args, ["--json"]);
    assert.equal(parse(["x", "--json"]).extras.size, 0);
    assert.equal(parse(["--title=--json"]).extras.size, 0);
  });

  it("leaves -json and --json=true to Go's flag error, and a flag error keeps the switches found before it", () => {
    for (const spelling of ["-json", "--json=true"]) {
      assert.throws(() => parse([spelling]), (error: unknown) => error instanceof GoFlagError && error.message === "flag provided but not defined: -json" && error.extras.size === 0);
    }
    assert.throws(() => parse(["--json", "--bogus", "--allow-outside-root"]), (error: unknown) => error instanceof GoFlagError && [...error.extras].join() === "--json");
  });

  it("lists no switch in the usage text", () => {
    assert.throws(() => parse(["--bogus"]), (error: unknown) => error instanceof GoFlagError && !error.output.includes("json") && !error.output.includes("allow-outside-root"));
  });
});
