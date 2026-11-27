// F-P9-04 review round 3 of pull request 10 (the final fix pass): each
// finding's case, with the outcome that the pinned cm_build.py gave for it
// (run side by side in the fix pass; docs/work/.../evidence.md). Tests that
// make a folder link or a name with a backslash run on POSIX only: Windows
// needs a privilege for a link, and `\` is a separator there.

import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assertIncludes, assertSame, assertSameList } from "./helpers.ts";
import { buildos, canLink, project, temps, tree } from "./skill-script-support.ts";

const posix = process.platform !== "win32";
const SK = ["--skeleton", "cm/CIRC/skeleton.json"];
const PARTS = ["--parts", "cm/CIRC/parts/part-a.json", "cm/CIRC/parts/part-b.json"];
const OUTPUTS = ["circ-capabilities.csv", "circ-capability-model.json", "circ-requirements.csv"];
const files = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : []);
const assemble = (dir: string, out: string, ...rest: string[]) => buildos(["capability-matrix", "--root", dir, "assemble", ...SK, ...PARTS, "--out", out, ...rest], dir);

describe("capability-matrix review round 3, finding 3: option values that start with a minus, as argparse reads them", () => {
  it("a value with a space, or one that looks like a negative number (a Unicode digit too), is a value", async () => {
    for (const out of ["- stash71", "-١desk71"]) {
      const dir = project("capability-matrix", "library");
      const r = await assemble(dir, out);
      assertSame(r.exit, 0, `--out ${out}: exit`);
      assertSameList(files(join(dir, out)), OUTPUTS, `--out ${out}: the three files`);
    }
    for (const date of ["- catalogue 71", "-٣issue71", "-.71extra", "-5", "-.5", "--o x", "-x y"]) {
      const dir = project("capability-matrix", "library");
      const r = await assemble(dir, "o", "--date", date);
      assertSame(r.exit, 0, `--date ${date}: exit`);
      assertSameList(files(join(dir, "o")), OUTPUTS, `--date ${date}: the three files`);
    }
  });

  it("anything else that starts with a minus is an option, so the option before it has no value (exit 2, nothing written)", async () => {
    for (const [option, value] of [["--out", "-.stash71"], ["--date", "-.edition71"], ["--date", "-."], ["--out", "--folio71"], ["--date", "--out"], ["--date", "--out=x y"], ["--date", "-hx"], ["--date", "-a\tb"]] as const) {
      const dir = project("capability-matrix", "library");
      const before = tree(dir);
      const r = option === "--out" ? await assemble(dir, value) : await assemble(dir, "o", "--date", value);
      assertSame(r.exit, 2, `${option} ${value}: exit`);
      assertIncludes(r.stderr, `${option} needs a value`, `${option} ${value}: message`);
      assertSame(JSON.stringify([...tree(dir)]), JSON.stringify([...before]), `${option} ${value}: nothing written`);
    }
  });

  it("a list takes a value with a space, and a stray one is an unexpected argument", async () => {
    const dir = project("capability-matrix", "library");
    cpSync(join(dir, "cm", "CIRC", "parts", "part-b.json"), join(dir, "- b.json"));
    const r = await buildos(["capability-matrix", "--root", dir, "assemble", ...SK, "--parts", "cm/CIRC/parts/part-a.json", "- b.json", "--out", "o"], dir);
    assertSame(r.exit, 0, "--parts with '- b.json': exit");
    const stray = await buildos(["capability-matrix", "--root", dir, "skeleton", ...SK, "- x"], dir);
    assertSame(stray.exit, 2, "a stray '- x': exit");
    assertIncludes(stray.stderr, "unexpected argument - x", "a stray '- x': message");
  });
});

describe("capability-matrix review round 3, finding 4: a backslash in a folder name on POSIX", () => {
  it("a pattern finds a file in a folder whose name ends in a backslash", { skip: !posix }, async () => {
    for (const pattern of ["fold71*/leaf?.json", "fold71\\/leaf?.json"]) {
      const dir = project("capability-matrix", "library");
      mkdirSync(join(dir, "fold71\\"));
      cpSync(join(dir, "cm", "CIRC", "parts", "part-a.json"), join(dir, "fold71\\", "leafA.json"));
      const r = await buildos(["capability-matrix", "--root", dir, "assemble", ...SK, "--parts", pattern, "cm/CIRC/parts/part-b.json", "--out", "o"], dir);
      assertSame(r.exit, 0, `${pattern}: exit`);
      assertSameList(files(join(dir, "o")), OUTPUTS, `${pattern}: the three files`);
    }
  });
});

describe("capability-matrix review round 3, findings 1 and 5: the --out folder", () => {
  it("an authorized output through a folder link writes through it; without the switch it is refused (SD-24)", { skip: !posix || !canLink }, async () => {
    const dir = project("capability-matrix", "library");
    const outside = join(dir, "..", "approved71");
    mkdirSync(outside);
    symlinkSync(outside, join(dir, "review-delivery"), "dir");
    const refused = await assemble(dir, "review-delivery");
    assertSame(refused.exit, 3, "no switch: exit");
    assertIncludes(refused.stderr, "--allow-outside-root", "no switch: names the switch");
    assertSameList(files(outside), [], "no switch: nothing written");
    const allowed = await buildos(["capability-matrix", "--root", dir, "--allow-outside-root", "assemble", ...SK, ...PARTS, "--out", "review-delivery"], dir);
    assertSame(allowed.exit, 0, "with the switch: exit");
    assertSameList(files(outside), OUTPUTS, "with the switch: the three files, through the link");
    assertSame(lstatSync(join(dir, "review-delivery")).isSymbolicLink(), true, "the link stays a link");
    const deeper = await buildos(["capability-matrix", "--root", dir, "--allow-outside-root", "assemble", ...SK, ...PARTS, "--out", "review-delivery/sub"], dir);
    assertSame(deeper.exit, 0, "a new folder in the linked folder, with the switch: exit");
    assertSameList(files(join(outside, "sub")), OUTPUTS, "a new folder in the linked folder: the three files");
  });

  it("a link at --out that leads nowhere is makedirs' FileExistsError (exit 3), and nothing is made", { skip: !posix || !canLink }, async () => {
    const dir = project("capability-matrix", "library");
    symlinkSync("missing-folder", join(dir, "unresolved71"), "dir");
    for (const extra of [[], ["--allow-outside-root"]]) {
      const r = await buildos(["capability-matrix", "--root", dir, ...extra, "assemble", ...SK, ...PARTS, "--out", "unresolved71"], dir);
      assertSame(r.exit, 3, `${extra.join(" ")}: exit`);
      assertIncludes(r.stderr, "[Errno 17] File exists: 'unresolved71'", `${extra.join(" ")}: Python's text`);
      assertSame(existsSync(join(dir, "missing-folder")), false, `${extra.join(" ")}: nothing made`);
    }
  });

  it("after a missing folder, a `..` climbs back and the rest is checked (exit 3 with Python's text)", { skip: !posix }, async () => {
    for (const [out, named] of [
      ["planned71/../cm/CIRC/skeleton.json/inner", "planned71/../cm/CIRC/skeleton.json/inner"],
      ["planned71/../cm/CIRC/skeleton.json/inner/deeper", "planned71/../cm/CIRC/skeleton.json/inner"],
      ["planned71/../cm/CIRC/skeleton.json/./inner", "planned71/../cm/CIRC/skeleton.json/."],
      ["a/b/../../cm/CIRC/skeleton.json/x", "a/b/../../cm/CIRC/skeleton.json/x"],
    ] as const) {
      const dir = project("capability-matrix", "library");
      const before = tree(dir);
      const r = await assemble(dir, out);
      assertSame(r.exit, 3, `${out}: exit`);
      assertIncludes(r.stderr, `[Errno 20] Not a directory: '${named}'`, `${out}: Python's text`);
      assertSame(JSON.stringify([...tree(dir)]), JSON.stringify([...before]), `${out}: nothing written`);
    }
    const dir = project("capability-matrix", "library");
    const file = await assemble(dir, "planned71/../cm/CIRC/skeleton.json");
    assertSame(file.exit, 3, "the folded destination is a file: exit");
    assertIncludes(file.stderr, "[Errno 17] File exists: 'planned71/../cm/CIRC/skeleton.json'", "the folded destination is a file: Python's text");
  });

  it("the recorded SD-24 outcomes stay: a missing folder and `..` before a new folder write the folded destination", async () => {
    for (const [out, at] of [["paper71/../actual71", "actual71"], ["gone/../o", "o"]] as const) {
      const dir = project("capability-matrix", "library");
      const r = await assemble(dir, out);
      assertSame(r.exit, 0, `${out}: exit`);
      assertSameList(files(join(dir, at)), OUTPUTS, `${out}: the three files at ${at}`);
      assertSame(existsSync(join(dir, out.split("/")[0]!)), false, `${out}: the missing folder is not made (SD-24)`);
    }
  });
});

describe("capability-matrix review round 3, finding 2: installed paths in an initialized project", () => {
  /** A project made by `buildos init` with the capability-matrix library fixtures copied in. */
  async function initialized(): Promise<string> {
    const parent = realpathSync(mkdtempSync(join(tmpdir(), "buildos-cm-installed-")));
    temps.push(parent);
    const dir = join(parent, "project");
    mkdirSync(dir);
    const init = await buildos(["init", "--skip-make-docs", "--root", dir], dir);
    assertSame(init.exit, 0, "init: exit");
    cpSync(join(import.meta.dirname, "fixtures", "skills", "capability-matrix", "bases", "library"), dir, { recursive: true });
    return dir;
  }
  const CIRC_MODEL = "deliver/CIRC/circ-capability-model.json";
  const LIB_MODEL = "deliver/LIB/lib-capability-model.json";
  /** Every path option of every subcommand, as the pipeline fixture case runs them. */
  const STEPS: string[][] = [
    ["skeleton", "--skeleton", "cm/CIRC/skeleton.json"],
    ["assemble", "--skeleton", "cm/CIRC/skeleton.json", "--parts", "cm/CIRC/parts/part-a.json", "cm/CIRC/parts/part-b.json", "--out", "deliver/CIRC", "--date", "2026-01-15"],
    ["assemble", "--skeleton", "cm/LIB/skeleton.json", "--parts", "cm/LIB/parts/*.json", "--out", "deliver/LIB"],
    ["fitgap", "--mode", "replacement", "--baseline", CIRC_MODEL, "--target", LIB_MODEL, "--rows", "analysis/scored/*.json", "--only", "analysis/target-only.json", "--out", "deliver/fit-gap", "--date", "2026-01-15"],
    ["fitgap", "--mode", "integration", "--models", CIRC_MODEL, LIB_MODEL, "--rows", "analysis/integration.json", "--out", "deliver/integration"],
    ["validate", "--model", CIRC_MODEL, "--narrative", "deliver/CIRC/Current Circulation System - Capability Model.md"],
    ["validate", "--model", CIRC_MODEL, "--fitgap", "deliver/fit-gap/circ-lib-fit-gap.json", "--baseline", CIRC_MODEL, "--target", LIB_MODEL],
    ["validate", "--model", LIB_MODEL, "--fitgap", "deliver/integration/circ-lib-integration-map.json"],
  ];
  const VALUE_OPTIONS = new Set(["--skeleton", "--parts", "--out", "--baseline", "--target", "--models", "--rows", "--only", "--model", "--narrative", "--fitgap"]);
  /** The step with `system/` before every path (each value of a path option). */
  const withSystem = (step: string[]): string[] => {
    let pathOption = false;
    return step.map((arg) => {
      if (arg.startsWith("--")) {
        pathOption = VALUE_OPTIONS.has(arg);
        return arg;
      }
      return pathOption && !["replacement", "integration"].includes(arg) ? `system/${arg}` : arg;
    });
  };

  it("every path option of every subcommand reads and writes the same with a leading system/ as without it", async () => {
    const plain = await initialized();
    const installed = await initialized();
    for (const step of STEPS) {
      const a = await buildos(["capability-matrix", ...step], plain);
      const b = await buildos(["capability-matrix", ...withSystem(step)], installed);
      // Exit 4 is a check of the fixture that fails (a FAIL line), the same with and without system/.
      assertSame([0, 4].includes(a.exit), true, `${step.slice(0, 2).join(" ")}: exit without system/ (got ${a.exit})`);
      assertSame(b.exit, a.exit, `${step.slice(0, 2).join(" ")}: the same exit with system/ (got ${b.stderr})`);
      assertSame(b.stdout.replaceAll("system/", ""), a.stdout, `${step.slice(0, 2).join(" ")}: the same output`);
    }
    assertSame(existsSync(join(installed, "system")), false, "no system folder is made");
    for (const out of ["deliver/CIRC", "deliver/LIB", "deliver/fit-gap", "deliver/integration"]) {
      for (const name of files(join(plain, out))) {
        assertSame(readFileSync(join(installed, out, name), "utf8"), readFileSync(join(plain, out, name), "utf8"), `${out}/${name}: the same bytes`);
      }
    }
  });

  it("a system/ path names the same errors as the root path: a missing file, a file as --out, a folder as a file", async () => {
    const dir = await initialized();
    for (const [step, text] of [
      [["skeleton", "--skeleton", "system/cm/CIRC/missing.json"], "[Errno 2] No such file or directory: 'system/cm/CIRC/missing.json'"],
      [["assemble", "--skeleton", "system/cm/CIRC/skeleton.json", "--parts", "system/cm/CIRC/parts/*.json", "--out", "system/cm/CIRC/skeleton.json"], "[Errno 17] File exists: 'system/cm/CIRC/skeleton.json'"],
      [["assemble", "--skeleton", "system/cm/CIRC/skeleton.json", "--parts", "system/cm/CIRC/parts/*.json", "--out", "system/cm/CIRC/skeleton.json/inner/deeper"], "[Errno 20] Not a directory: 'system/cm/CIRC/skeleton.json/inner'"],
      [["skeleton", "--skeleton", "system/cm/CIRC"], "[Errno 21] Is a directory: 'system/cm/CIRC'"],
    ] as const) {
      const r = await buildos(["capability-matrix", ...step], dir);
      assertSame(r.exit, 3, `${step.join(" ")}: exit`);
      assertIncludes(r.stderr, text, `${step.join(" ")}: the path as typed`);
    }
  });
});
