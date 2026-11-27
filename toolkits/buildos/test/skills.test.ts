// W1 R7 P7 Stages 1 to 3: the packaged skills (PRD 20 Packaged Skills).
//
// - A57: no local clutter in system/.os/skills/, and no owner name or owner
//   color constant in the fit-gap-analysis code.
// - A58: a fresh project gets .os/skills/AGENTS.md and every packaged skill,
//   byte for byte, and no app folder (.claude/, .agents/, ...).
// - t7: the package leaves out .DS_Store, __pycache__, *.pyc, and *.pyo.
// - t10: the router lists every skill and says what `buildos init` says at
//   exit 10, in the same words.
// - t11: adoption and rerun rules for .os/skills/.
// - P7-O10 and the CLI references: no skill writes `dataset_refs: null`, and
//   skills call the CLI through .os/scripts/buildos, not the legacy names.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { after, describe, it } from "node:test";
import { listSourceContent } from "../src/adapters/package-content.ts";
import { MAKE_DOCS_QUESTION } from "../src/core/init/make-docs-choice.ts";
import { MAKE_DOCS_LIMIT } from "../src/core/init/init.ts";
import { assertNoProblems, assertSame, assertSameBytes, assertSameList, shape, tag } from "./helpers.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const SYSTEM = resolve(PACKAGE, "..", "..", "system");
const SKILLS = join(SYSTEM, ".os", "skills");
const MAIN = join(PACKAGE, "src", "cli", "main.ts");
const GO_ERA = join(import.meta.dirname, "fixtures", "init", "go-era-project");
const APP_FOLDERS = [".claude", ".agents", ".github", ".copilot", ".codex", ".cursor"];

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), "buildos-skills-"));
  temps.push(dir);
  return dir;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

// The 21 skill folders (A54). A new or renamed skill is added here on purpose;
// an accidental extra folder fails with a tag, not its name (P7S-R2-03).
const EXPECTED_SKILLS = [
  "buildos-browser-to-playwright",
  "buildos-bulk-extract",
  "buildos-design-planning",
  "buildos-discovery",
  "buildos-discovery-qualification",
  "buildos-docs-handoff",
  "buildos-export-azure-boards",
  "buildos-extract",
  "buildos-extraction-plan",
  "buildos-intake",
  "buildos-intake-convert",
  "buildos-playbook-drafting",
  "buildos-preflight",
  "buildos-reference-review",
  "buildos-reporting",
  "buildos-row-drafting",
  "buildos-row-maintenance",
  "buildos-validation-reporting",
  "buildos-workflow",
  "capability-matrix",
  "fit-gap-analysis",
];

/** The skill folders the package ships (the package rules leave out local tool folders such as `.claude/`). */
const skillNames = () => [...new Set(listSourceContent(SYSTEM).map((f) => f.path).filter((p) => p.startsWith(".os/skills/") && p.split("/").length > 3).map((p) => p.split("/")[2]!))].sort();

function init(root: string, args: string[]) {
  const result = spawnSync(process.execPath, [MAIN, "init", "--root", root, ...args], { encoding: "utf8", env: { ...process.env, PATH: "" }, stdio: ["ignore", "pipe", "pipe"] });
  return { exit: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("packaged skills: source folder (A54, A57, t7)", () => {
  it("holds exactly the 21 expected skills, each with a SKILL.md whose name is its folder name", () => {
    // P7S-R2-03: a failure prints counts and tags only, never a folder name (an extra folder could be client-named).
    const names = skillNames();
    assertSameList(names, EXPECTED_SKILLS, "packaged skill folders");
    const problems: string[] = [];
    for (const name of names) {
      const text = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
      const front = /^---\n([\s\S]*?)\n---\n/.exec(text);
      if (!front) problems.push(`${tag(name)}: no frontmatter`);
      else {
        if (!front[1]!.split("\n").includes(`name: ${name}`)) problems.push(`${tag(name)}: the name is not the folder name`);
        if (!/^description: \S/m.test(front[1]!)) problems.push(`${tag(name)}: no description`);
      }
    }
    assertNoProblems(problems, "SKILL.md frontmatter");
  });

  it("has no .DS_Store, __pycache__, .pyc, or .pyo file", () => {
    const clutter = filesUnder(SKILLS).filter((p) => /(^|\/)(\.DS_Store|__pycache__)(\/|$)|\.py[co]$/.test(p));
    assertSameList(clutter, [], "local clutter files");
  });

  it("the package leaves out local clutter at any depth", () => {
    const dir = temp();
    const files: Record<string, string> = {
      ".os/skills/s/SKILL.md": "---\nname: s\ndescription: d\n---\n",
      ".os/skills/s/.DS_Store": "x",
      ".os/skills/s/scripts/__pycache__/tool.cpython-314.pyc": "x",
      ".os/skills/s/scripts/tool.pyc": "x",
      ".os/skills/s/scripts/tool.pyo": "x",
      ".os/skills/s/Thumbs.db": "x",
    };
    for (const [path, data] of Object.entries(files)) {
      mkdirSync(join(dir, ...path.split("/").slice(0, -1)), { recursive: true });
      writeFileSync(join(dir, ...path.split("/")), data);
    }
    assertSame(listSourceContent(dir).map((f) => f.path), [".os/skills/s/SKILL.md"]);
  });

  // W1 R7 P9 t9: the fit-gap code is the `buildos fitgap` command (src/core/fitgap/), not a skill script.
  it("fit-gap-analysis code holds no owner name and no owner color; owner colors come from config", () => {
    const dir = join(PACKAGE, "src", "core", "fitgap");
    const code = readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    // Every literal (fill, font) color pair belongs to a verdict or mark vocabulary entry, never to an owner.
    // `colors` is the heat-map color scale of the workbook, not an owner.
    const vocabulary = new Set(["native", "configurable", "partial", "unreleased", "gap", "met", "configured", "partly", "not_met", "[DESCOPED]", "colors"]);
    const pairs = [...code.matchAll(/(['"]?)(\[?\w+\]?)\1: \["[0-9A-Fa-f]{6}", "[0-9A-Fa-f]{6}"\]/g)];
    assert.ok(pairs.length >= 12, `the verdict and mark color pairs are found (${pairs.length})`);
    for (const match of pairs) assert.ok(vocabulary.has(match[2]!), `color constant for ${tag(String(match[2]))}`);
    assert.ok(/export const OWNER_COLORS_FILE = "\.os\/skills\/fit-gap-analysis\/config\/owner-colors\.json";/.test(code), "OWNER_COLORS_FILE");
    assert.ok(/const ocol = ownerColors\(/.test(code), "ownerColors call");
    const config = JSON.parse(readFileSync(join(SKILLS, "fit-gap-analysis", "config", "owner-colors.json"), "utf8")) as Record<string, unknown>;
    assertSame(Object.keys(config).sort(), ["$comment", "palette"], "the palette has no owner names");
    assert.ok(Array.isArray(config["palette"]) && config["palette"].length > 0);
  });
});

describe("packaged skills: instructions (t10, P7-O10)", () => {
  const texts = () => filesUnder(SKILLS).filter((p) => /\.(md|mjs|py|json|ya?ml|csv)$/.test(p)).map((p) => ({ path: p, text: readFileSync(join(SKILLS, ...p.split("/")), "utf8") }));

  it("call the CLI through the project wrapper, never a legacy command, the Python validator, or source paths", () => {
    const problems: string[] = [];
    for (const { path, text } of texts()) {
      if (/(^|[\s`])buildos-(intake|discovery|design) (convert|index|run|qualify|promote)\b/m.test(text)) problems.push(`${tag(path)}: legacy command name`);
      if (/validate_config/.test(text)) problems.push(`${tag(path)}: the Python validator`);
      if (/(^|[\s`"(])system\/(docs|\.os|assets|playbooks)\//m.test(text)) problems.push(`${tag(path)}: a source-checkout path`);
      if (/\.agents\/skills\/buildos/.test(text) || /(^|[\s`])skills\/buildos-/m.test(text.replaceAll(".os/skills/", ""))) problems.push(`${tag(path)}: an old skill path`);
      if (/\.ps1\b/.test(text)) problems.push(`${tag(path)}: a PowerShell script BuildOS does not ship`);
    }
    assertNoProblems(problems, "skill instructions");
  });

  // W1 R7 P9 t9: the skill's command is `buildos export azure-boards`, run here in a fresh project
  // as the skill runs it, from the project root with the skill's own manifests.
  it("buildos export azure-boards rebuilds both golden CSVs of the skill byte for byte (CRLF kept by .gitattributes)", () => {
    const skill = join(SKILLS, "buildos-export-azure-boards");
    const root = temp();
    assert.equal(init(root, ["--skip-make-docs"]).exit, 0);
    for (const [manifest, golden] of [["assets/synthetic-manifest.json", "assets/synthetic-golden-example.csv"], ["assets/adapters/dynamics-365-ce-manifest.json", "assets/adapters/dynamics-365-ce-golden-example.csv"]] as const) {
      const result = spawnSync(process.execPath, [MAIN, "export", "azure-boards", "emit", "--input", `.os/skills/buildos-export-azure-boards/${manifest}`, "--output", "workspace/out.csv"], { cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" } });
      assert.equal(result.status, 0, shape(result.stderr));
      assertSame(readFileSync(join(root, "workspace", "out.csv")), readFileSync(join(skill, golden)), tag(String(golden)));
    }
  });

  it("no skill writes dataset_refs as null (owner decision D-007 item 1)", () => {
    for (const { path, text } of texts()) assert.ok(!/["']?dataset_refs["']?\s*[:=]\s*(null|None)\b/.test(text), tag(path));
  });

  it("the router lists every skill and gives the exit 10 question, limit, and both commands as buildos init does", () => {
    const router = readFileSync(join(SKILLS, "AGENTS.md"), "utf8");
    assertNoProblems(skillNames().filter((name) => !router.includes(`[\`${name}\`](${name}/SKILL.md)`)).map((name) => `${tag(name)}: not in the router`), "router skill list");
    assert.ok(router.includes(MAKE_DOCS_QUESTION.replace(" [Y/n] ", "")), "question");
    assert.ok(router.includes(MAKE_DOCS_LIMIT), "limit");
    assert.ok(router.includes("buildos init --root <project> --make-docs") && router.includes("buildos init --root <project> --skip-make-docs"), "commands");
    assertSameBytes(readFileSync(join(SKILLS, "CLAUDE.md"), "utf8"), "# CLAUDE\n\nRead [`AGENTS.md`](AGENTS.md) in this directory and follow it.\n", "CLAUDE.md");
    // The same words come from the CLI's own exit 10 stop. The folder name has a space, so the CLI
    // quotes it for the platform's shell (Command Prompt on Windows); the test takes the commands
    // from the structured JSON choices and checks that the human output prints the same commands
    // (W1 R7 P7 skills review round 1, P7S-R1-06: the test used to expect an unquoted path).
    const root = join(temp(), "project with space");
    mkdirSync(root);
    const json = init(root, ["--json"]);
    assert.equal(json.exit, 10, shape(json.stderr));
    const result = (JSON.parse(json.stdout) as { result: { question: string; choices: { answer: string; command: string }[] } }).result;
    assertSame(result.question, MAKE_DOCS_QUESTION.replace(" [Y/n] ", ""));
    assertSame(result.choices.map((c) => c.answer), ["yes", "no"]);
    const [yes, no] = result.choices.map((c) => c.command.replace(/ --json$/, ""));
    assert.ok(yes!.endsWith(" --make-docs") && no!.endsWith(" --skip-make-docs"), "the choices end in the two flags");
    assert.ok(yes!.includes(" init --root ") && no!.includes(" init --root "), "the choices run buildos init with the folder");
    // P7S-R2-07: each command targets this temporary project, quoted for the platform's shell,
    // checked here on its own and not through the CLI's quoting code.
    assert.ok(!/["%]/.test(root), "the test folder has no character that needs more than plain quoting");
    const quoted = process.platform === "win32" ? `"${root}"` : `'${root.replaceAll("'", "'\\''")}'`;
    assert.ok(yes!.endsWith(` init --root ${quoted} --make-docs`), "the yes command targets the temporary project");
    assert.ok(no!.endsWith(` init --root ${quoted} --skip-make-docs`), "the no command targets the temporary project");
    const stop = init(root, []);
    assert.equal(stop.exit, 10, shape(stop.stderr));
    assert.ok(stop.stdout.includes(result.question), "the human output asks the same question");
    assert.ok(stop.stdout.includes(`\n  ${yes}\n`) && stop.stdout.includes(`\n  ${no}\n`), "the human output prints the same commands as the JSON choices");
  });
});

describe("packaged skills: buildos init (A58, t11)", () => {
  it("a new project gets .os/skills/AGENTS.md and every packaged skill byte for byte, and no app folder", () => {
    const root = temp();
    const result = init(root, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    const installed = join(root, ".os", "skills");
    assert.ok(existsSync(join(installed, "AGENTS.md")));
    assertSameList(filesUnder(installed), filesUnder(SKILLS), "installed skill files");
    for (const path of filesUnder(SKILLS)) assertSameBytes(readFileSync(join(installed, ...path.split("/"))), readFileSync(join(SKILLS, ...path.split("/"))), tag(path));
    for (const app of APP_FOLDERS) assert.equal(existsSync(join(root, app)), false, tag(String(app)));
  });

  it("an adoption writes every packaged skill file, keeps the adopter's own skill, and creates no app folder", () => {
    const root = temp();
    cpSync(GO_ERA, root, { recursive: true });
    mkdirSync(join(root, ".os", "skills", "my-own-skill"), { recursive: true });
    writeFileSync(join(root, ".os", "skills", "my-own-skill", "SKILL.md"), "---\nname: my-own-skill\ndescription: The adopter's own skill.\n---\n");
    mkdirSync(join(root, ".os", "skills", "buildos-intake"), { recursive: true });
    writeFileSync(join(root, ".os", "skills", "buildos-intake", "SKILL.md"), "an older packaged copy\n");
    const result = init(root, ["--skip-make-docs"]);
    assert.equal(result.exit, 0, shape(result.stderr));
    for (const path of filesUnder(SKILLS)) assertSameBytes(readFileSync(join(root, ".os", "skills", ...path.split("/"))), readFileSync(join(SKILLS, ...path.split("/"))), tag(path));
    assertSame(readFileSync(join(root, ".os", "skills", "my-own-skill", "SKILL.md"), "utf8"), "---\nname: my-own-skill\ndescription: The adopter's own skill.\n---\n");
    for (const app of APP_FOLDERS) assert.equal(existsSync(join(root, app)), false, tag(String(app)));
  });

  it("a rerun writes nothing under .os/skills/: a changed or removed skill file stays as the user left it", () => {
    const root = temp();
    assert.equal(init(root, ["--skip-make-docs"]).exit, 0);
    const changed = join(root, ".os", "skills", "buildos-intake", "SKILL.md");
    writeFileSync(changed, "changed by the user\n");
    rmSync(join(root, ".os", "skills", "buildos-reporting"), { recursive: true });
    const rerun = init(root, ["--skip-make-docs"]);
    assert.equal(rerun.exit, 0, shape(rerun.stderr));
    assertSame(readFileSync(changed, "utf8"), "changed by the user\n");
    assert.equal(existsSync(join(root, ".os", "skills", "buildos-reporting")), false);
  });
});

// W1 R7 P7 skills review round 1 (P7S-R1-07, P7S-R1-08): every project path a
// skill tells an agent to read or write is checked against the two installed
// layouts. A path in a fresh `buildos init --skip-make-docs` project passes.
// Any other path must be classified below; a new unclassified path fails.
// MAKE_DOCS_209 is what Make Docs 2.0.9 adds under `docs/` and `.make-docs/`
// in a real `buildos init --make-docs` run (2026-11-24): it creates no guides
// router and no `docs/assets/` folder.
const MAKE_DOCS_209 = new Set(["docs", "docs/AGENTS.md", "docs/designs/AGENTS.md", "docs/plans/AGENTS.md", "docs/prd/AGENTS.md", "docs/work", "docs/work/AGENTS.md", ".make-docs"]);
const SKILL_PATH_KINDS: Record<string, "make-docs" | "conditional" | "output" | "skill" | "example"> = {
  // Only with Make Docs; the skill says what to do without it.
  "docs/": "make-docs",
  "docs/AGENTS.md": "make-docs",
  "docs/designs/AGENTS.md": "make-docs",
  "docs/plans/AGENTS.md": "make-docs",
  "docs/prd/AGENTS.md": "make-docs",
  "docs/work": "make-docs",
  "docs/work/": "make-docs",
  "docs/work/AGENTS.md": "make-docs",
  ".make-docs/": "make-docs",
  // Shipped by neither: the skill reads it only if the project has it.
  "assets/_incoming/": "conditional",
  "workspace/tests/AGENTS.md": "conditional",
  "workspace/tests/playwright/": "conditional",
  // Written by a BuildOS command or by the workflow itself.
  ".os/indexes/references.json": "output",
  "workspace/findings/FIND-NNN/": "output",
  // The Azure Boards contract's example outputs (W1 R7 P9 t9): inside the project, as the command requires.
  "workspace/azure-boards.csv": "output",
  "workspace/azure-boards-template.csv": "output",
  "workspace/dynamics-365-ce.csv": "output",
  // Inside the skill's own folder.
  "assets/new-items-template.csv": "skill",
  "assets/target-17-column-template.csv": "skill",
  "assets/synthetic-manifest.json": "skill",
  "assets/synthetic-golden-example.csv": "skill",
  "assets/adapters/dynamics-365-ce-manifest.json": "skill",
  "assets/adapters/dynamics-365-ce-golden-example.csv": "skill",
  // Worked examples of an adopter's own files.
  "docs/charter.md": "example",
  "docs/prd/20-example.md": "example",
  "docs/work/example-backlog": "example",
  "docs/work/example-backlog/00-index.md": "example",
  "docs/work/example-backlog/01-configuration.md": "example",
  "docs/work/example-backlog/01-export.md": "example",
  "docs/work/example-backlog/02-development.md": "example",
  "docs/work/example-backlog/03-integration.md": "example",
};
const CONDITIONAL_WORDING = /when Make Docs is set up|if present|when present|if the project has|exists (?:only )?(?:when|after)|does not create one|BuildOS ships none|BuildOS does not ship|if it is missing|does not exist before/i;

function skillPaths(): { file: string; path: string }[] {
  const pattern = /(?<![\w./<>-])((?:\.os|assets|docs|playbooks|workspace|\.make-docs)\/[\w./*<>#-]*|AGENTS\.md|CLAUDE\.md)/g;
  const out: { file: string; path: string }[] = [];
  for (const file of filesUnder(SKILLS).filter((f) => f.endsWith(".md") && f.includes("/"))) {
    for (const match of readFileSync(join(SKILLS, ...file.split("/")), "utf8").matchAll(pattern)) {
      const path = match[1]!.replace(/[.,);:]+$/, "");
      if (!/[<*#]/.test(path)) out.push({ file, path });
    }
  }
  return out;
}

describe("packaged skills: paths they name exist in the installed layouts (P7S-R1-08)", () => {
  it("every path is in a fresh --skip-make-docs project, or is classified, and the skill says what to do without it", () => {
    const root = temp();
    assert.equal(init(root, ["--skip-make-docs"]).exit, 0);
    const problems: string[] = [];
    const pairs = new Set<string>();
    for (const { file, path } of skillPaths()) {
      pairs.add(`${file.split("/")[0]} ${path}`);
      const bare = path.replace(/\/$/, "");
      if (existsSync(join(root, ...bare.split("/")))) continue;
      const kind = SKILL_PATH_KINDS[path];
      const text = readFileSync(join(SKILLS, ...file.split("/")), "utf8");
      if (kind === undefined) problems.push(`${tag(file)} ${tag(path)}: in neither installed layout and not classified`);
      else if (kind === "make-docs" && !MAKE_DOCS_209.has(bare)) problems.push(`${tag(file)} ${tag(path)}: not created by Make Docs 2.0.9`);
      else if ((kind === "make-docs" || kind === "conditional") && !CONDITIONAL_WORDING.test(text)) problems.push(`${tag(file)} ${tag(path)}: required without saying what to do when it is missing`);
      else if (kind === "skill" && !existsSync(join(SKILLS, file.split("/")[0]!, ...bare.split("/")))) problems.push(`${tag(file)} ${tag(path)}: not in the skill folder`);
    }
    assertNoProblems(problems, "skill path problems");
    assert.ok(pairs.size > 100, `checked ${pairs.size} skill and path pairs`);
  });

  it("no skill requires a router that neither BuildOS nor Make Docs 2.0.9 creates", () => {
    for (const { file, path } of skillPaths()) {
      if (path === "docs/guides/AGENTS.md") assert.fail(`${tag(file)} names a guides router that Make Docs 2.0.9 does not create`);
    }
  });
});

describe("packaged skills: worked examples and read-only defaults (P7S-R1-11, P7S-R1-12)", () => {
  it("the Dynamics 365 CE example treats Fine Cap as a maximum, with an acceptance criterion on both sides of the cap", () => {
    const adapter = join(SKILLS, "buildos-export-azure-boards");
    for (const file of ["assets/adapters/dynamics-365-ce-manifest.json", "adapters/dynamics-365-ce/examples.md"]) {
      const text = readFileSync(join(adapter, ...file.split("/")), "utf8");
      assert.ok(!/below \\"Fine Cap\\"/.test(text), `${tag(String(file))}: a cap never raises a smaller fine`);
      assert.ok(/IF \\"Fine Cap\\" contains data AND the calculated value is above \\"Fine Cap\\":/.test(text), `${tag(String(file))}: the cap lowers a larger fine`);
      const criterion = /Fine Cap\\" is (\d+\.\d+), a calculated fine of (\d+\.\d+) will be saved as (\d+\.\d+) and a calculated fine of (\d+\.\d+) will be saved as (\d+\.\d+)/.exec(text);
      assert.ok(criterion, `${tag(String(file))}: an acceptance criterion with amounts on both sides of the cap`);
      const [cap, high, highSaved, low, lowSaved] = criterion.slice(1).map(Number) as [number, number, number, number, number];
      assert.ok(high > cap && highSaved === cap, `${tag(String(file))}: a fine above the cap is saved as the cap`);
      assert.ok(low < cap && lowSaved === low, `${tag(String(file))}: a fine below the cap is saved unchanged`);
    }
  });

  it("a progress report reads indexes and records by default and runs a file-writing generator only when the user asks", () => {
    const text = readFileSync(join(SKILLS, "buildos-reporting", "SKILL.md"), "utf8");
    const workflow = text.slice(text.indexOf("## Workflow"), text.indexOf("## Stop conditions"));
    const first = workflow.split("\n").find((line) => line.startsWith("1. ")) ?? "";
    assert.ok(!/\brun\b/i.test(first), "the first step runs nothing");
    assert.ok(/writes nothing/.test(first), "the first step says it writes nothing");
    assert.ok(/only when the user asks/.test(workflow), "a generator runs only on request");
  });
});

// W1 R7 P7 skills review round 2 (P7S-R2-03): a failing enumeration prints
// counts and tags, never a discovered name. The folder name below is invented.
describe("packaged skills: failure messages never print a discovered name (P7S-R2-03)", () => {
  const INVENTED = "qzvorbel-skill";
  const messageOf = (fn: () => void): string => {
    try {
      fn();
    } catch (error) {
      return (error as Error).message;
    }
    return "";
  };

  it("an extra skill folder fails the skill list with its tag only", () => {
    const message = messageOf(() => assertSameList([...EXPECTED_SKILLS, INVENTED].sort(), EXPECTED_SKILLS, "packaged skill folders"));
    assert.ok(message.includes("1 extra") && message.includes(tag(INVENTED)), "the message names the count and the tag");
    assert.ok(!message.includes(INVENTED) && !message.includes("qzvorbel"), "the message never names the folder");
    const problems = messageOf(() => assertNoProblems([`${tag(INVENTED)}: no frontmatter`], "SKILL.md frontmatter"));
    assert.ok(problems.includes(tag(INVENTED)) && !problems.includes("qzvorbel"));
  });

  it("the locate helper finds the item behind a tag on this machine", () => {
    const root = temp();
    mkdirSync(join(root, "system", ".os", "skills", INVENTED), { recursive: true });
    writeFileSync(join(root, "system", ".os", "skills", INVENTED, "SKILL.md"), "x\n");
    const result = spawnSync(process.execPath, [join(PACKAGE, "scripts", "locate-hash.ts"), tag(INVENTED), "--root", root], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`${tag(INVENTED)} system/.os/skills/${INVENTED}`), "the helper prints the local path");
  });
});
