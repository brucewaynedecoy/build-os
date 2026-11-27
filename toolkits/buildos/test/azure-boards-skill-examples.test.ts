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

/** Splits a command line the way `sh` does for plain words and single-quoted words. */
function words(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2]!);
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
