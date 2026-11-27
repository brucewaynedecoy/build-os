// W1 R7 P9 Stage 3 (review round 1 of pull request 7, finding 4): every
// command example of the Azure Boards skill's CSV contract
// (system/.os/skills/buildos-export-azure-boards/references/
// azure-boards-csv-contract.md) runs, in the order the file gives, in a new
// project, and exits 0. Before this test, both adapter examples validated a
// CSV emitted without an adapter and exited 4.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";

const PACKAGE = resolve(import.meta.dirname, "..");
const MAIN = join(PACKAGE, "src", "cli", "main.ts");
const SKILL = join(PACKAGE, "..", "..", "system", ".os", "skills", "buildos-export-azure-boards");
const WRAPPER = ".os/scripts/buildos";

/** The wrapper commands of each `sh` block, in order, with `\` line breaks joined. */
export function shExamples(markdown: string): string[] {
  const commands: string[] = [];
  for (const block of markdown.replace(/\r\n/g, "\n").matchAll(/^```sh\n([\s\S]*?)^```$/gm)) {
    for (const command of block[1]!.replace(/\\\n\s*/g, "").split("\n")) if (command.trim() !== "") commands.push(command.trim());
  }
  return commands;
}

/**
 * Splits a command line the way `sh` does for plain words, single-quoted
 * words, and double-quoted words (where `\"` and `\\` stand for `"` and `\`).
 * F-P9-04 review round 1, finding 4: the examples use double quotes, which
 * Command Prompt reads too.
 */
function words(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/'([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+)/g)) out.push(m[1] ?? (m[2] !== undefined ? m[2].replace(/\\(["\\])/g, "$1") : m[3]!));
  return out;
}

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("Azure Boards skill: the CSV contract examples (review round 1 of pull request 7, finding 4)", () => {
  it("every example runs in order in a new project and exits 0", () => {
    const commands = shExamples(readFileSync(join(SKILL, "references", "azure-boards-csv-contract.md"), "utf8"));
    assert.ok(commands.length >= 6, "the file has its examples");
    const project = mkdtempSync(join(tmpdir(), "buildos-azure-examples-"));
    temps.push(project);
    const init = spawnSync(process.execPath, [MAIN, "init", "--root", project, "--skip-make-docs"], { cwd: project, encoding: "utf8" });
    assert.equal(init.status, 0, init.stdout + init.stderr);
    mkdirSync(join(project, "workspace"), { recursive: true });
    const results: string[] = [];
    for (const command of commands) {
      const [wrapper, ...args] = words(command);
      assert.equal(wrapper, WRAPPER, `${command} runs through the project wrapper`);
      const r = spawnSync(process.execPath, [MAIN, ...args], { cwd: project, encoding: "utf8" });
      results.push(`${args.slice(0, 3).join(" ")}: ${r.status}`);
      assert.equal(r.status, 0, `${command}\n${r.stdout}${r.stderr}`);
    }
    assert.ok(results.filter((r) => r.startsWith("export azure-boards validate")).length >= 3, results.join("\n"));
  });

  it("the adapter examples validate the CSV of the bundled Dynamics 365 CE manifest", () => {
    const commands = shExamples(readFileSync(join(SKILL, "references", "azure-boards-csv-contract.md"), "utf8"));
    const adapter = commands.filter((c) => c.includes("--adapter dynamics-365-ce"));
    assert.ok(adapter.length >= 2);
    for (const c of adapter) assert.match(c, /--input workspace\/dynamics-365-ce\.csv/, c);
    assert.ok(commands.some((c) => c.includes("emit") && c.includes("assets/adapters/dynamics-365-ce-manifest.json") && c.includes("--output workspace/dynamics-365-ce.csv")));
  });
});

/**
 * Splits a Command Prompt line as a Windows program reads it (F-P9-04 review
 * round 3, follow-up note): first `cmd.exe`, where `"` turns quoting on and
 * off and `& | < > ^ ( )` outside quotes and `%` and `!` anywhere are special
 * (the line may have none of them); then the Microsoft C runtime rules that
 * Node.js uses for its arguments: white space outside quotes separates words,
 * 2n backslashes before `"` are n backslashes and the `"` toggles quoting,
 * 2n+1 backslashes before `"` are n backslashes and a literal `"`, and other
 * backslashes are literal.
 */
export function cmdWords(line: string): string[] {
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (c === "%" || c === "!" || (!quoted && "&|<>^()".includes(c))) throw new Error(`Command Prompt reads ${c} in: ${line}`);
  }
  const out: string[] = [];
  let word: string | undefined;
  quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === "\\") {
      let n = 0;
      while (line[i + n] === "\\") n++;
      if (line[i + n] === '"') {
        word = (word ?? "") + "\\".repeat(Math.floor(n / 2));
        if (n % 2 === 1) word += '"';
        else quoted = !quoted;
        i += n;
      } else {
        word = (word ?? "") + "\\".repeat(n);
        i += n - 1;
      }
    } else if (c === '"') {
      word = word ?? "";
      quoted = !quoted;
    } else if (!quoted && (c === " " || c === "\t")) {
      if (word !== undefined) out.push(word);
      word = undefined;
    } else word = (word ?? "") + c;
  }
  if (word !== undefined) out.push(word);
  return out;
}

describe("Dynamics 365 CE adapter: the Command Prompt example (F-P9-04 review round 3, follow-up note)", () => {
  it("splits as Windows reads it into the same words as the sh example, and runs", () => {
    const markdown = readFileSync(join(SKILL, "adapters", "dynamics-365-ce", "ADAPTER.md"), "utf8").replace(/\r\n/g, "\n");
    const bat = [...markdown.matchAll(/^```bat\n([\s\S]*?)^```$/gm)].map((m) => m[1]!.trim());
    assert.equal(bat.length, 1, "one Command Prompt example");
    const [wrapper, ...args] = cmdWords(bat[0]!);
    assert.equal(wrapper, ".os\\scripts\\buildos.cmd");
    const sh = shExamples(markdown).find((c) => c.includes("--adapter-params"))!;
    const shArgs = words(sh).slice(1);
    const drop = (a: string[]): string[] => a.filter((_, i) => a[i] !== "--profile" && a[i - 1] !== "--profile");
    assert.deepEqual(drop(args), drop(shArgs), "the same words as the sh example");
    assert.deepEqual(JSON.parse(args[args.indexOf("--adapter-params") + 1]!), { publisher_prefix: "ex_" });
    const project = mkdtempSync(join(tmpdir(), "buildos-azure-cmd-"));
    temps.push(project);
    assert.equal(spawnSync(process.execPath, [MAIN, "init", "--root", project, "--skip-make-docs"], { cwd: project }).status, 0);
    mkdirSync(join(project, "workspace"), { recursive: true });
    const emit = spawnSync(process.execPath, [MAIN, "export", "azure-boards", "emit", "--input", ".os/skills/buildos-export-azure-boards/assets/adapters/dynamics-365-ce-manifest.json", "--output", "workspace/d.csv", "--profile", "target17-new"], { cwd: project, encoding: "utf8" });
    assert.equal(emit.status, 0, emit.stderr);
    const run = spawnSync(process.execPath, [MAIN, ...args.map((a) => (a === "<azure-boards-import.csv>" ? "workspace/d.csv" : a))], { cwd: project, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  });
});
