// W1 R7 P9, F-P9-04: `buildos capability-matrix`, the port of cm_build.py,
// beyond the parity goldens (test/skill-script-parity.test.ts): the
// divergences held by their own tests (SD-24, SD-26, SD-27 in
// test/golden/skills/divergences.json), the --json envelope (A78), and the
// Python value rules of the port. Every input is invented (the library
// book-lending topic of the fixtures).

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { HEADING_FOR_TEST } from "../src/core/capability-matrix/cm-build.ts";
import { PyMap, PySet, cmDumps, counter, counterJson, counterRepr, indexOf, pyDirname, pyEqual, pyEqualItem, pyHashKey, pyIn, pyIntOf, pyOrder, pySorted } from "../src/core/capability-matrix/py-values.ts";
import { CAPABILITY_MATRIX_HELP } from "../src/cli/commands/capability-matrix.ts";
import { ENVELOPE_FIELDS } from "../src/core/shared/envelope.ts";
import { PyFloat, PyIntDigitsError, PyJsonError, pyLoads, pyRepr } from "../src/core/shared/py-json.ts";
import { assertIncludes, assertSame, assertSameList } from "./helpers.ts";
import { buildos, project } from "./skill-script-support.ts";

const CIRC_SK = ["--skeleton", "cm/CIRC/skeleton.json"];
const ASSEMBLE = ["capability-matrix", "assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "deliver/CIRC"];
const files = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);

describe("capability-matrix: contained, atomic reads and writes (SD-24)", () => {
  it("refuses a file outside the project, and an output outside it without --allow-outside-root", async () => {
    const dir = project("capability-matrix", "library");
    writeFileSync(join(dir, "..", "outside.json"), "{}");
    const read = await buildos(["capability-matrix", "--root", dir, "skeleton", "--skeleton", "../outside.json"], dir);
    assertSame(read.exit, 3, "read outside: exit");
    assertIncludes(read.stderr, "is outside the project folder", "read outside: message");
    const write = await buildos(["capability-matrix", "--root", dir, "assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "../out"], dir);
    assertSame(write.exit, 3, "write outside: exit");
    assertIncludes(write.stderr, "--allow-outside-root", "write outside: names the switch");
    assertSame(existsSync(join(dir, "..", "out")), false, "write outside: nothing written");
    const allowed = await buildos(["capability-matrix", "--root", dir, "--allow-outside-root", "assemble", ...CIRC_SK, "--parts", "cm/CIRC/parts/*.json", "--out", "../out"], dir);
    assertSame(allowed.exit, 0, "write outside, allowed: exit");
    assertSameList(files(join(dir, "..", "out")), ["circ-capabilities.csv", "circ-capability-model.json", "circ-requirements.csv"], "write outside, allowed: files");
  });

  it("a pattern that leaves the project is refused, never an empty match", async () => {
    const dir = project("capability-matrix", "library");
    const r = await buildos(["capability-matrix", "--root", dir, "assemble", ...CIRC_SK, "--parts", "../*.json", "--out", "deliver/CIRC"], dir);
    assertSame(r.exit, 3, "exit");
    assertSameList(files(join(dir, "deliver", "CIRC")), ["Current Circulation System - Capability Model.md", "narrative-wrong.md"], "no output beside the narratives");
  });

  it("assemble writes nothing when a capability names a layer the layers list lacks (the script wrote the model JSON, then crashed)", async () => {
    const dir = project("capability-matrix", "library");
    const sk = pyLoads(readFileSync(join(dir, "cm", "CIRC", "skeleton.json"), "utf8")) as Map<string, unknown>;
    (sk.get("layers") as unknown[]).pop();
    writeFileSync(join(dir, "cm", "CIRC", "skeleton.json"), cmDumps(sk as never));
    const r = await buildos(["capability-matrix", "--root", dir, ...ASSEMBLE.slice(1)], dir);
    assertSame(r.exit, 3, "exit");
    assertIncludes(r.stderr, "KeyError: 'L3'", "names the missing layer");
    assertSameList(files(join(dir, "deliver", "CIRC")), ["Current Circulation System - Capability Model.md", "narrative-wrong.md"], "no file beside the narratives");
  });

  it("assemble writes nothing when a value holds a lone surrogate (the script left a half-written JSON file)", async () => {
    const dir = project("capability-matrix", "library");
    const part = readFileSync(join(dir, "cm", "CIRC", "parts", "part-b.json"), "utf8").replace("A card number is never given twice.", "A card \\ud800 number.");
    writeFileSync(join(dir, "cm", "CIRC", "parts", "part-b.json"), part);
    const r = await buildos(["capability-matrix", "--root", dir, ...ASSEMBLE.slice(1)], dir);
    assertSame(r.exit, 3, "exit");
    assertIncludes(r.stderr, "UnicodeEncodeError", "names the encode error");
    assertSameList(files(join(dir, "deliver", "CIRC")), ["Current Circulation System - Capability Model.md", "narrative-wrong.md"], "nothing written beside the narratives");
  });

  it("fitgap writes nothing when a verdict is a list (the script wrote the CSV, then crashed on the count)", async () => {
    const dir = project("capability-matrix", "library");
    for (const code of ["CIRC", "LIB"]) {
      const r = await buildos(["capability-matrix", "--root", dir, "assemble", "--skeleton", `cm/${code}/skeleton.json`, "--parts", `cm/${code}/parts/*.json`, "--out", `deliver/${code}`], dir);
      assertSame(r.exit, 0, `assemble ${code}`);
    }
    writeFileSync(join(dir, "analysis", "list-verdict.json"), JSON.stringify([{ baseline_capability_id: "CIRC-CORE-01", target_capability_ids: [], verdict: ["gap"], confidence: "low", evidence: "x" }]));
    const r = await buildos(["capability-matrix", "--root", dir, "fitgap", "--baseline", "deliver/CIRC/circ-capability-model.json", "--target", "deliver/LIB/lib-capability-model.json", "--rows", "analysis/list-verdict.json", "--out", "deliver/fit-gap"], dir);
    assertSame(r.exit, 3, "exit");
    assertIncludes(r.stderr, "unhashable type: 'list'", "names the error");
    assertSame(existsSync(join(dir, "deliver", "fit-gap")), false, "no out folder, no file");
  });

  it("validate: a companion CSV path outside the project counts as missing (a FAIL line, as the script's look at the top of the disk)", async () => {
    const dir = project("capability-matrix", "library");
    mkdirSync(join(dir, "flat"));
    writeFileSync(join(dir, "flat", "hm-capability-model.json"), readFileSync(join(dir, "models", "lone", "hm-capability-model.json")));
    const r = await buildos(["capability-matrix", "--root", join(dir, "flat"), "validate", "--model", "hm-capability-model.json"], join(dir, "flat"));
    assertSame(r.exit, 4, "exit");
    assertIncludes(r.stdout, "  FAIL  companion CSVs present beside the model\n", "FAIL line");
    assertIncludes(r.stdout, "\n*** 1 FAILURE(S) ***\n", "one failure");
  });

  it("a folder where a file belongs is an input error (exit 3)", async () => {
    const dir = project("capability-matrix", "library");
    const r = await buildos(["capability-matrix", "--root", dir, "skeleton", "--skeleton", "cm/bad"], dir);
    assertSame(r.exit, 3, "exit");
    assertSame(r.stdout, "", "no stdout");
  });
});

describe("capability-matrix: a system code with a pattern character (SD-26)", () => {
  const withCode = (dir: string, code: string): void => {
    const path = join(dir, "cm", "LIB", "skeleton.json");
    writeFileSync(path, readFileSync(path, "utf8").replace('"code": "LIB"', `"code": ${JSON.stringify(code)}`).replaceAll('"LIB-', `"${code}-`));
  };

  for (const code of ["L.B", "L(B", "L+", "[LIB]"]) {
    it(`skeleton stops on the code ${code} (exit 4), after reading the file`, async () => {
      const dir = project("capability-matrix", "library");
      withCode(dir, code);
      const r = await buildos(["capability-matrix", "--root", dir, "skeleton", "--skeleton", "cm/LIB/skeleton.json"], dir);
      assertSame(r.exit, 4, "exit");
      assertIncludes(r.stderr, "capability-matrix skeleton: the system code", "message");
      assertSame(r.stdout, "", "no stdout");
    });
  }

  it("a code of letters, digits, a space, an underscore, and a non-ASCII letter is matched as Python matched it", async () => {
    const dir = project("capability-matrix", "library");
    withCode(dir, "Bü_2 X");
    const r = await buildos(["capability-matrix", "--root", dir, "skeleton", "--skeleton", "cm/LIB/skeleton.json"], dir);
    assertSame(r.exit, 0, "exit");
    assertIncludes(r.stdout, "skeleton[Bü_2 X]: 4 capabilities", "summary line");
  });

  it("no pattern is built from the code: the code is a literal prefix and the rest a fixed pattern (review round 1 of pull request 10)", () => {
    const source = readFileSync(new URL("../src/core/capability-matrix/cm-build.ts", import.meta.url), "utf8");
    const built = [...source.matchAll(/new RegExp\(([^\n]*)/g)].map((m) => m[1]!);
    assertSame(built.length, 1, "one RegExp is built at run time");
    assert.ok(built[0]!.startsWith("`(?:^|(?<=\\\\n))#{3,4}"), "and it is the fixed heading pattern");
  });

  it("an id that only a pattern reading of a plain code would match is refused, as Python's literal match refused it", async () => {
    const dir = project("capability-matrix", "library");
    writeFileSync(join(dir, "cm", "dash.json"), JSON.stringify({ system: { code: "A-B", converted: true, status_vocabulary: ["on"], maturity_map: { on: "proven" } }, layers: [{ id: "L1", code: "CD", name: "One" }], capabilities: [{ id: "A-B-CD-01", layer_id: "L1", type: "process", status: "on" }, { id: "A-BB-CD-01", layer_id: "L1", type: "process", status: "on" }, { id: "a-B-CD-01", layer_id: "L1", type: "process", status: "on" }] }));
    const r = await buildos(["capability-matrix", "--root", dir, "skeleton", "--skeleton", "cm/dash.json"], dir);
    assertSame(r.exit, 4, "exit");
    // cm_build.py printed exactly this (Python 3.14): the id check matches only A-B-CD-01, and the prefix check
    // reads split('-')[1], which is "B" or "BB" for a code with a dash.
    assertSame(r.stdout, "  L1   CD       3  One\nskeleton[A-B]: 3 capabilities, status={'on': 3}\n  FAIL  A-B-CD-01: prefix does not match layer L1\n  FAIL  A-BB-CD-01: id format\n  FAIL  A-BB-CD-01: prefix does not match layer L1\n  FAIL  a-B-CD-01: id format\n  FAIL  a-B-CD-01: prefix does not match layer L1\n", "stdout as the script printed it");
  });

  it("a skeleton with no capabilities never compiles the pattern, so it passes", async () => {
    const dir = project("capability-matrix", "library");
    writeFileSync(join(dir, "cm", "empty.json"), JSON.stringify({ system: { code: "A(", converted: true, status_vocabulary: [], maturity_map: {} }, layers: [], capabilities: [] }));
    const r = await buildos(["capability-matrix", "--root", dir, "skeleton", "--skeleton", "cm/empty.json"], dir);
    assertSame(r.exit, 0, "exit");
    assertSame(r.stdout, "skeleton[A(]: 0 capabilities, status={}\n  skeleton OK\n", "stdout");
  });
});

describe("capability-matrix: --json and help (A78)", () => {
  const check = (stdout: string, command: string, ok: boolean, writeStatus: string): Record<string, unknown> => {
    const envelope = JSON.parse(stdout) as Record<string, unknown>;
    assertSameList(Object.keys(envelope), [...ENVELOPE_FIELDS], `${command} envelope fields`);
    assertSame(envelope["ok"], ok, "ok");
    assertSame(envelope["command"], command, "command");
    assertSame(envelope["write_status"], writeStatus, "write_status");
    assert.equal(Array.isArray(envelope["diagnostics"]), true);
    assertSame((envelope["diagnostics"] as unknown[]).length === 0, ok, "diagnostics");
    return envelope;
  };

  it("assemble, a failed validate, and a crash each give the envelope", async () => {
    const dir = project("capability-matrix", "library");
    const done = await buildos(["capability-matrix", "--root", dir, "--json", ...ASSEMBLE.slice(1)], dir);
    assertSame(done.exit, 0, "assemble exit");
    const envelope = check(done.stdout, "capability-matrix.assemble", true, "applied");
    assertSameList((envelope["result"] as { written: string[] }).written, ["deliver/CIRC/circ-capability-model.json", "deliver/CIRC/circ-capabilities.csv", "deliver/CIRC/circ-requirements.csv"], "written");
    const failed = await buildos(["capability-matrix", "--root", dir, "--json", "validate", "--model", "models/lone/hm-capability-model.json"], dir);
    assertSame(failed.exit, 4, "validate exit");
    const fe = check(failed.stdout, "capability-matrix.validate", false, "not_requested");
    assertSame((fe["diagnostics"] as { code: string }[])[0]!.code, "check_failed", "diagnostic code");
    const crashed = await buildos(["capability-matrix", "--root", dir, "--json", "skeleton", "--skeleton", "cm/bad/skeleton-no-layers.json"], dir);
    assertSame(crashed.exit, 3, "crash exit");
    const ce = check(crashed.stdout, "capability-matrix.skeleton", false, "not_requested");
    assertSame((ce["diagnostics"] as { code: string }[])[0]!.code, "input_unreadable", "diagnostic code");
  });

  it("--help at every level prints the help (exit 0), and the root help lists the domain", async () => {
    const dir = project("capability-matrix", "library");
    for (const args of [["capability-matrix", "--help"], ["capability-matrix", "fitgap", "--help"], ["capability-matrix", "assemble", "-h"], ["help", "capability-matrix"]]) {
      const r = await buildos(args, dir);
      assertSame(r.exit, 0, `${args.join(" ")}: exit`);
      assertIncludes(r.stdout, "buildos capability-matrix skeleton --skeleton <skeleton.json>", `${args.join(" ")}: help`);
    }
    assertIncludes(CAPABILITY_MATRIX_HELP, "  10 a write failed and BuildOS could not put back every file; each one left is named\n", "exit 10 in the help");
    const root = await buildos(["help"], dir);
    assert.match(root.stdout, /^ {2}capability-matrix {2}Build and check capability models and their fit\/gap$/m);
  });
});

describe("capability-matrix: Python value rules", () => {
  it("int() of a CSV count: white space, a sign, Unicode digits, and underscores; anything else is a ValueError", () => {
    assertSame(pyIntOf(" 12 "), 12n, "padded");
    assertSame(pyIntOf("+7"), 7n, "sign");
    assertSame(pyIntOf("-0"), 0n, "negative zero");
    assertSame(pyIntOf("1_000"), 1000n, "underscore");
    assertSame(pyIntOf("٣٤"), 34n, "Arabic-Indic digits");
    assertSame(pyIntOf("\u{1d7d9}"), 1n, "a mathematical digit one (a run of tens next to other runs)");
    assertSame(pyIntOf("12345678901234567890"), 12345678901234567890n, "big");
    for (const bad of ["", "1_", "_1", "1__0", "1.0", "one", "0x10"]) assert.throws(() => pyIntOf(bad), /ValueError: invalid literal for int\(\) with base 10/, bad);
    // Python 3.14 (review round 1 of pull request 10, finding 2): int() strips ASCII " \t\n\v\f\r" and the non-ASCII
    // white space of str.isspace (turned into a space first), but not the separators U+001C to U+001F.
    assertSame(pyIntOf("\u000b\u000c1\r\n"), 1n, "ASCII white space");
    assertSame(pyIntOf("\u00a0\u20281\u3000\u0085"), 1n, "non-ASCII white space");
    for (const bad of ["\u001c1", "1\u001f", "\u001d1\u001e", "1\u200b", "- 1", "1\u0000"]) assert.throws(() => pyIntOf(bad), /ValueError: invalid literal for int\(\) with base 10/, JSON.stringify(bad));
    // The 4300-digit limit of int() (sys.int_info.default_max_str_digits): leading zeros count, underscores and the sign do not.
    assertSame(pyIntOf("0".repeat(4299) + "1"), 1n, "4300 digits");
    assertSame(pyIntOf("-" + "1_" + "0".repeat(4299)), -(10n ** 4299n), "4300 digits with a sign and an underscore");
    assert.throws(() => pyIntOf("0".repeat(4300) + "1"), /: ValueError: Exceeds the limit \(4300 digits\) for integer string conversion: value has 4301 digits; use sys.set_int_max_str_digits\(\) to increase the limit$/, "4301 digits");
    // A bad literal is checked before the limit, and its repr is cut to 200 characters (%.200R).
    assert.throws(() => pyIntOf("1".repeat(4301) + "x"), (e: Error) => e.message === `ValueError: invalid literal for int() with base 10: '${"1".repeat(199)}`, "bad literal before the limit");
    assert.throws(() => pyIntOf(null), /TypeError: int\(\) argument must be/);
  });

  it("os.path.dirname as posixpath does it", { skip: process.platform === "win32" }, () => {
    assertSame(pyDirname("model.json"), "", "no folder");
    assertSame(pyDirname("deliver/CIRC/m.json"), "deliver/CIRC", "folder");
    assertSame(pyDirname("deliver//m.json"), "deliver", "repeated slash");
    assertSame(pyDirname("/m.json"), "/", "top");
    assertSame(pyDirname("//m.json"), "//", "all slashes stay");
  });

  it("a Counter keeps Python's key rules: 1, 1.0, and True are one key, json writes each key as text, and 1 and '1' stay two keys", () => {
    const c = counter([1, true, new PyFloat(1), "1", null, false]);
    assertSame(counterRepr(c), "{1: 3, '1': 1, None: 1, False: 1}", "repr");
    assertSame(cmDumps(new Map([["c", counterJson(c)]])), '{\n "c": {\n  "1": 3,\n  "1": 1,\n  "null": 1,\n  "false": 1\n }\n}', "json");
    const m = new PyMap<number>();
    m.set(true, 1);
    m.set(1, 2);
    assertSame(m.keys()[0], true, "the first key stays");
    assertSame(m.get(1), 2, "the last value");
  });

  it("json.dump(indent=1, ensure_ascii=False): floats, big integers, and text as Python writes them", () => {
    const v = pyLoads('{"a": 1.0, "b": 1e16, "c": 12345678901234567890, "d": "é\\u0007\\u2028", "e": [], "f": {}, "g": NaN}');
    assertSame(cmDumps(v), '{\n "a": 1.0,\n "b": 1e+16,\n "c": 12345678901234567890,\n "d": "é\\u0007 ",\n "e": [],\n "f": {},\n "g": NaN\n}', "dump");
  });

  it("the narrative heading pattern uses Python's ^, $, ., \\d, and \\s", () => {
    const heads = (doc: string): string[] => [...doc.matchAll(HEADING_FOR_TEST)].map((m) => `${m[1]}=${m[2]}`);
    assertSameList(heads("### 1.1 Name\n#### 2 Other  \n##### 3 Five\n### 4 Bold **[x]**\n"), ["1.1=Name", "2=Other", "4=Bold"], "basic");
    assertSameList(heads("### 1 A\u2028B\n"), ["1=A\u2028B"], "U+2028 is not a line end for . or $");
    assertSameList(heads("### 6 Tail\u2028\n"), ["6=Tail"], "U+2028 is white space to \\s");
    assertSameList(heads("### 1 A\rB\n"), ["1=A\rB"], "a lone CR is not a line end for . or $");
    assertSameList(heads("### ١ Arabic one\n"), ["١=Arabic one"], "\\d is any Unicode digit");
    assertSameList(heads("### 5 Name\n**[next line]**\n"), ["5=Name"], "\\s+ reaches the next line");
    assertSameList(heads("x ### 1 Not at a line start\n"), [], "^ only at a line start");
  });
});

describe("capability-matrix: Python's numbers, exactly (review round 1 of pull request 10, finding 1)", () => {
  const big = (text: string): unknown => pyLoads(text);
  it("== keeps every digit of an integer above 2^53, and compares a float by its exact value", () => {
    assertSame(pyEqual(big("9007199254740992") as never, big("9007199254740993") as never), false, "2**53 != 2**53 + 1");
    assertSame(pyEqual(big("9007199254740993") as never, big("9007199254740992.0") as never), false, "2**53 + 1 != 2.0**53");
    assertSame(pyEqual(big("9007199254740992") as never, big("9007199254740992.0") as never), true, "2**53 == 2.0**53");
    assertSame(pyEqual(1, new PyFloat(1)), true, "1 == 1.0");
    assertSame(pyEqual(true, 1), true, "True == 1");
    assertSame(pyEqual(new PyFloat(-0), 0), true, "-0.0 == 0");
    assertSame(pyEqual(new PyFloat(0.5), 0), false, "0.5 != 0");
    assertSame(pyEqual("1", 1), false, "'1' != 1");
    assertSame(pyEqual(big("1e400") as never, big("1e400") as never), true, "inf == inf");
  });

  it("json's NaN is one object: unequal to itself in ==, equal inside a list, a dict, `in`, and list.index", () => {
    const [a, b] = big("[NaN, NaN]") as [never, never];
    assertSame(pyEqual(a, b), false, "nan != nan");
    assertSame(pyEqualItem(a, b), true, "identity first");
    assertSame(pyEqual(big("[NaN]") as never, big("[NaN]") as never), true, "[nan] == [nan]");
    assertSame(pyEqual(big('{"k": NaN}') as never, big('{"k": NaN}') as never), true, "{'k': nan} == {'k': nan}");
    assertSame(pyIn(a, [1, b]), true, "nan in [1, nan]");
    assertSame(indexOf([1, b], a), 1, "[1, nan].index(nan)");
    assertSame(new PySet([a, b, 1, new PyFloat(1), true]).size, 2, "{nan, nan, 1, 1.0, True} has two items");
  });

  it("a dict or set key keeps every digit; 1, 1.0, and True are one key; '1' and 1 are two", () => {
    assert.notEqual(pyHashKey(big("9007199254740992") as never), pyHashKey(big("9007199254740993") as never));
    assertSame(pyHashKey(big("9007199254740992.0") as never), pyHashKey(big("9007199254740992") as never), "a whole float and its integer");
    assertSame(pyHashKey(new PyFloat(-0)), pyHashKey(0), "-0.0 and 0");
    assertSame(pyHashKey(true), pyHashKey(new PyFloat(1)), "True and 1.0");
    assert.notEqual(pyHashKey("1"), pyHashKey(1));
    const m = new PyMap<number>();
    m.set(big("12345678901234567890") as never, 1);
    assertSame(m.has(big("12345678901234567891") as never), false, "a neighbour is not there");
    assertSame(counterRepr(counter([big("9007199254740993") as never, big("9007199254740992") as never, big("9007199254740993") as never])), "{9007199254740993: 2, 9007199254740992: 1}", "Counter");
  });

  it("an unhashable value names its use, in Python 3.14's words", () => {
    assert.throws(() => new PySet([[1]]), /: TypeError: cannot use 'list' as a set element \(unhashable type: 'list'\)$/);
    assert.throws(() => new PyMap<number>().set(new Map(), 1), /: TypeError: cannot use 'dict' as a dict key \(unhashable type: 'dict'\)$/);
    assert.throws(() => counter([[1]]), /: TypeError: unhashable type: 'list'$/, "Counter hashes first");
  });

  it("sorted() orders numbers by exact value and strings by code point; None < None is a TypeError", () => {
    const ids = ["9007199254740993", "9007199254740992", "1.5", "9007199254740994"].map((t) => big(t) as never);
    assertSame(pySorted(ids, (x) => x).map((x) => pyRepr(x)).join(" "), "1.5 9007199254740992 9007199254740993 9007199254740994", "exact order");
    assertSame(pyOrder(big("9007199254740993") as never, new PyFloat(9007199254740992)), 1, "2**53 + 1 > 2.0**53");
    assertSame(pyOrder(new PyFloat(2.5), 2), 1, "2.5 > 2");
    assertSame(pyOrder(new PyFloat(-2.5), -2), -1, "-2.5 < -2");
    assertSame(pyOrder(new PyFloat(Number.POSITIVE_INFINITY), big("1" + "0".repeat(400)) as never), 1, "inf > 10**400");
    assertSame(pyOrder("é", "z"), 1, "by code point");
    assert.throws(() => pyOrder(null, null), /TypeError: '<' not supported between instances of 'NoneType' and 'NoneType'/);
  });

  it("SD-27: a set that cannot be ordered is sorted from its first-seen order, so the message is the same on every run", () => {
    // Python: sorted({1, 'a'}) iterates the set in hash order, which changes with PYTHONHASHSEED, so the
    // TypeError names 'str' and 'int' on some runs and 'int' and 'str' on others. BuildOS compares the later
    // item with the earlier one, as Python's sort does, in first-seen order: always the same message.
    for (let run = 0; run < 3; run++) {
      assert.throws(() => pySorted(new PySet([1, "a"]).keys(), (x) => x), /TypeError: '<' not supported between instances of 'str' and 'int'/);
      assert.throws(() => pySorted(new PySet(["a", 1]).keys(), (x) => x), /TypeError: '<' not supported between instances of 'int' and 'str'/);
    }
  });
});

describe("capability-matrix: the JSON reader at Python's integer limit (review round 1 of pull request 10, finding 2)", () => {
  it("reads an integer of 4096 and of 4300 digits and a float of any length; refuses 4301 digits with int()'s ValueError, not a JSONDecodeError", () => {
    assertSame(pyLoads("7".repeat(4096)), BigInt("7".repeat(4096)), "4096 digits");
    assertSame(pyLoads("-" + "7".repeat(4300)), -BigInt("7".repeat(4300)), "4300 digits and a sign");
    assertSame((pyLoads("1." + "5".repeat(5000)) as PyFloat).value, 1.5555555555555556, "a long float");
    assert.throws(() => pyLoads("[" + "7".repeat(4301) + "]"), (e: unknown) => e instanceof PyIntDigitsError && !(e instanceof PyJsonError) && e.pyText === "Exceeds the limit (4300 digits) for integer string conversion: value has 4301 digits; use sys.set_int_max_str_digits() to increase the limit");
    assert.throws(() => pyLoads("[" + "7".repeat(4301) + "x]"), PyIntDigitsError, "the number is converted before the rest is read, as Python's scanner does");
  });
});

describe("capability-matrix: empty values (review round 1 of pull request 10, finding 3)", () => {
  it("an empty pattern matches nothing (glob.glob('') is []), and buildos fitgap keeps its own rule for it", async () => {
    const { pyGlob } = await import("../src/core/fitgap/fitgap.ts");
    const dir = project("capability-matrix", "library");
    const { ProjectFiles } = await import("../src/core/shared/project-files.ts");
    const { createNodeFsPort } = await import("../src/adapters/node-fs.ts");
    const ctx = { files: new ProjectFiles({ root: dir, cwd: dir, openFs: createNodeFsPort as never, allowOutsideRoot: false }) } as never;
    assertSameList(pyGlob(ctx, ""), [], "empty pattern");
    assertSameList(pyGlob(ctx, "cm/CIRC/parts/part-a.json"), ["cm/CIRC/parts/part-a.json"], "a plain path");
  });
});
