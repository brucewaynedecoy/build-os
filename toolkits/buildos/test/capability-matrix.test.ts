// W1 R7 P9, F-P9-04: `buildos capability-matrix`, the port of cm_build.py,
// beyond the parity goldens (test/skill-script-parity.test.ts): the
// divergences held by their own tests (SD-24, SD-26 in
// test/golden/skills/divergences.json), the --json envelope (A78), and the
// Python value rules of the port. Every input is invented (the library
// book-lending topic of the fixtures).

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { HEADING_FOR_TEST } from "../src/core/capability-matrix/cm-build.ts";
import { PyMap, cmDumps, counter, counterJson, counterRepr, pyDirname, pyIntOf } from "../src/core/capability-matrix/py-values.ts";
import { ENVELOPE_FIELDS } from "../src/core/shared/envelope.ts";
import { PyFloat, pyLoads } from "../src/core/shared/py-json.ts";
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
