// F-P8-11 and F-P8-10 (parity exception PE-023; owner decision 2026-11-26):
// every command that BuildOS prints for the adopter to run starts with the
// runnable program of the running build, `npx -y build-os@<version>` for a
// release and `buildos` for a source build (src/core/shared/run-command.ts).
//
// - The helper's edge cases: a source build, a prerelease, build metadata,
//   and the quoting of a folder on POSIX and Windows.
// - The harness's own statement of the PE-023 rule (test/golden/harness.ts)
//   gives the same text as the CLI's helper.
// - One test per printed-command class, through `run` with a release build
//   identity: the printed text, taken as is, starts with the runnable prefix.
// - The printed rebuild command, with the program word replaced by this
//   checkout's bundle, runs as printed in the system shell (sh on POSIX;
//   Command Prompt and PowerShell on Windows), for folders with spaces and
//   shell characters.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { bundle } from "../scripts/build.ts";
import { createInitDomain } from "../src/cli/commands/init.ts";
import { run } from "../src/cli/run.ts";
import { loadSourceContent } from "../src/adapters/package-content.ts";
import { rebuildCommand } from "../src/core/entities/commands.ts";
import { goQuote } from "../src/core/shared/go-quote.ts";
import { isRegistryVersion, printedRun, runCommand, runProgram, SOURCE_RUN } from "../src/core/shared/run-command.ts";
import { applyPrintedCommands, printedProgram } from "./golden/harness.ts";
import { assertIncludes, assertSame, captureIo } from "./helpers.ts";

const RELEASE = "0.2.0";
const PREFIX = `npx -y build-os@${RELEASE} `;
const SYSTEM = join(import.meta.dirname, "..", "..", "..", "system");
const scratch = mkdtempSync(join(tmpdir(), "buildos-run-command-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let counter = 0;

const DATASETS = ["requirements.jsonl", "capabilities.jsonl", "personas.jsonl", "test-cases.jsonl", "results.jsonl", "runs.jsonl", "findings.jsonl", "extractions.jsonl"];

/** A project with empty entity data and no entity index, in a folder named `name`. */
function entityRoot(name = `root-${++counter}`): string {
  const root = join(scratch, name);
  mkdirSync(join(root, ".os", "data"), { recursive: true });
  for (const file of DATASETS) writeFileSync(join(root, ".os", "data", file), "");
  return root;
}

async function cli(args: string[], version: string, cwd = scratch, options: Parameters<typeof run>[2] = {}): Promise<{ exit: number; stdout: string; stderr: string }> {
  const io = captureIo(cwd);
  const exit = await run(args, io, { buildInfo: { version, sourceRevision: "unknown" }, ...options });
  return { exit, stdout: io.stdout(), stderr: io.stderr() };
}

/** The text after `  action: ` on the one action line of `text`. */
function actionLine(text: string): string {
  const lines = text.split("\n").filter((line) => line.startsWith("  action: "));
  assertSame(lines.length, 1, "one action line");
  return lines[0]!.slice("  action: ".length);
}

describe("the printed-command helper (src/core/shared/run-command.ts)", () => {
  it("a release version gives npx -y build-os@<version>; a prerelease too", () => {
    assert.deepEqual(runProgram("0.2.0"), ["npx", "-y", "build-os@0.2.0"]);
    assert.deepEqual(runProgram("1.10.0-rc.1"), ["npx", "-y", "build-os@1.10.0-rc.1"]);
    assert.equal(isRegistryVersion("0.2.0-beta.2"), true);
  });

  it("a source build, 0.0.0-dev, build metadata (+local), and any other text give plain buildos", () => {
    for (const version of ["dev", "0.0.0-dev", "0.2.0+local", "0.2.0-rc.1+abc", "01.2.3", "1.2", "", "latest", "0.2.0 && echo"]) {
      assert.deepEqual(runProgram(version), ["buildos"], version);
      assert.equal(isRegistryVersion(version), false, version);
    }
    assert.deepEqual(SOURCE_RUN.program, ["buildos"]);
  });

  it("POSIX: a folder is always in single quotes, so the shell expands nothing in it", () => {
    const run = printedRun(RELEASE, "linux");
    assert.equal(runCommand(run, ["entities", "rebuild-index", "--root", { path: "/work/plain" }]), `${PREFIX}entities rebuild-index --root '/work/plain'`);
    assert.equal(runCommand(run, ["--root", { path: "/work/a b/$HOME/`x`/it's" }]), `${PREFIX}--root '/work/a b/$HOME/\`x\`/it'\\''s'`);
  });

  it("Windows: Command Prompt double quotes, each backslash single (not Go's %q), % outside the quotes, a trailing backslash doubled", () => {
    const run = printedRun(RELEASE, "win32");
    assert.equal(runCommand(run, ["--root", { path: "D:\\work\\my project" }]), `${PREFIX}--root "D:\\work\\my project"`);
    assert.equal(runCommand(run, ["--root", { path: "D:\\a&b" }]), `${PREFIX}--root "D:\\a&b"`);
    assert.equal(runCommand(run, ["--root", { path: "D:\\a%b%" }]), `${PREFIX}--root "D:\\a"^%"b"^%""`);
    assert.equal(runCommand(run, ["--root", { path: "D:\\" }]), `${PREFIX}--root "D:\\\\"`);
    assert.notEqual(runCommand(run, [{ path: "D:\\work" }]), `${PREFIX}${goQuote("D:\\work")}`);
  });

  it("a plain word is quoted only when it needs it", () => {
    assert.equal(runCommand(SOURCE_RUN, ["extract", "bulk", "publish", "REF-001"]), "buildos extract bulk publish REF-001");
    assert.equal(runCommand(SOURCE_RUN, ["publish", "a b"]), "buildos publish 'a b'");
  });

  it("the harness's own statement of the PE-023 rule gives the same text as the helper", () => {
    for (const version of [RELEASE, "dev", "0.2.0+local", "0.3.0-rc.1"]) {
      assert.equal(printedProgram({ version, sourceRevision: "unknown" }), runProgram(version).join(" "), version);
    }
    const cases: [string, string][] = [
      ["linux", "/work/a b/it's"],
      ["darwin", "/var/x/root"],
      ["win32", "D:\\work\\my project"],
    ];
    for (const [platform, root] of cases) {
      for (const version of [RELEASE, "dev"]) {
        const go = `  action: buildos entities rebuild-index --root ${goQuote(root)} --mode compat --apply\n`;
        const ours = applyPrintedCommands(go, printedProgram({ version, sourceRevision: "unknown" }), platform);
        assert.equal(ours.text, `  action: ${rebuildCommand(printedRun(version, platform), root, "compat")}\n`, `${platform} ${version}`);
        assert.deepEqual(ours.hits, { rebuild: 1, usage: 0 });
      }
    }
  });
});

describe("each printed-command class, from a release build (PE-023)", () => {
  it("entities: the action: line, remediation_command, and correction start with the runnable prefix", async () => {
    const root = entityRoot();
    const human = await cli(["entities", "validate", "--root", root, "--mode", "compat"], RELEASE);
    assertSame(human.exit, 0, "exit");
    const action = actionLine(human.stdout);
    assert.ok(action.startsWith(`${PREFIX}entities rebuild-index --root `), "the action line starts with the prefix");
    assert.equal(action, rebuildCommand(printedRun(RELEASE, process.platform), root, "compat"));
    const json = await cli(["entities", "validate", "--root", root, "--mode", "compat", "--json"], RELEASE);
    const envelope = JSON.parse(json.stdout) as { result: { index: { remediation_command: string } }; diagnostics: { correction?: string }[] };
    assert.equal(envelope.result.index.remediation_command, action);
    assert.deepEqual(envelope.diagnostics.map((d) => d.correction), [action]);
    const strict = await cli(["entities", "rebuild-index", "--root", root, "--mode", "strict", "--check", "--json"], RELEASE);
    assert.ok((JSON.parse(strict.stdout) as { diagnostics: { correction?: string }[] }).diagnostics.some((d) => d.correction?.startsWith(PREFIX) === true), "rebuild-index --check");
  });

  it("a usage error: Run npx -y build-os@<version> help for command syntax.", async () => {
    const human = await cli(["bogus"], RELEASE);
    assertSame(human.exit, 2, "exit");
    assert.equal(actionLine(human.stderr), `Run ${PREFIX}help for command syntax.`);
    const json = await cli(["entities", "resolve", "--json"], RELEASE);
    assert.equal((JSON.parse(json.stdout) as { diagnostics: { correction: string }[] }).diagnostics[0]!.correction, `Run ${PREFIX}help for command syntax.`);
  });

  it("validate: a folder that is not a project, and a project with problems", async () => {
    const empty = join(scratch, `not-a-project-${++counter}`);
    mkdirSync(empty);
    const none = await cli(["validate", "--root", empty, "--json"], RELEASE);
    assertSame(none.exit, 3, "exit");
    assert.equal((JSON.parse(none.stdout) as { diagnostics: { correction: string }[] }).diagnostics[0]!.correction, `Run ${PREFIX}validate in the project folder, or pass --root with the folder that holds .os/.`);
    const broken = join(scratch, `broken-${++counter}`);
    mkdirSync(join(broken, ".os"), { recursive: true });
    const human = await cli(["validate", "--root", broken], RELEASE);
    assertSame(human.exit, 4, "exit");
    assert.ok(human.stdout.endsWith(`\nFix each problem, then run ${PREFIX}validate again.\n`), "the last human line");
    const json = await cli(["validate", "--root", broken, "--json"], RELEASE);
    assert.equal((JSON.parse(json.stdout) as { diagnostics: { correction: string }[] }).diagnostics[0]!.correction, `Fix each finding in result.findings, then run ${PREFIX}validate again.`);
  });

  it("init: the stop for a path that exists, and the source-code folder", async () => {
    const domain = createInitDomain({ loadContent: () => loadSourceContent(SYSTEM), now: () => new Date("2026-11-26T00:00:00Z") });
    const clash = join(scratch, `clash-${++counter}`);
    mkdirSync(clash);
    writeFileSync(join(clash, ".os"), "not a folder\n");
    const human = await cli(["init", "--skip-make-docs"], RELEASE, clash, { domains: [domain] });
    assertSame(human.exit, 10, "exit");
    assertIncludes(human.stdout, `Move or back up these files, then run \`${PREFIX}init\` again.`);
    const json = await cli(["init", "--skip-make-docs", "--json"], RELEASE, clash, { domains: [domain] });
    const envelope = JSON.parse(json.stdout) as { result: { tip: string }; diagnostics: { correction: string }[] };
    assert.equal(envelope.result.tip, `Move or back up these files, then run \`${PREFIX}init\` again.`);
    assert.equal(envelope.diagnostics[0]!.correction, `Move or back up these files, then run ${PREFIX}init again.`);
    const checkout = join(scratch, `checkout-${++counter}`);
    mkdirSync(join(checkout, "system", ".os"), { recursive: true });
    const source = await cli(["init", "--skip-make-docs", "--json"], RELEASE, checkout, { domains: [domain] });
    assert.equal((JSON.parse(source.stdout) as { diagnostics: { correction: string }[] }).diagnostics[0]!.correction, `Run ${PREFIX}init in your project folder, or pass --root with your project folder.`);
  });

  it("export azure-boards: an unknown command names the runnable help command", async () => {
    const project = entityRoot();
    const r = await cli(["export", "azure-boards", "--root", project, "bogus"], RELEASE, project);
    assertSame(r.exit, 2, "exit");
    assertIncludes(r.stderr, `Run "${PREFIX}export azure-boards --help" for the commands.`);
  });

  it("a source build prints plain buildos in the same places", async () => {
    const root = entityRoot();
    const human = await cli(["entities", "validate", "--root", root, "--mode", "compat"], "dev");
    assert.ok(actionLine(human.stdout).startsWith("buildos entities rebuild-index --root "), "entities");
    assert.equal(actionLine((await cli(["bogus"], "dev")).stderr), "Run buildos help for command syntax.");
  });

  it("help usage lines and the legacy-name notice keep the name buildos", async () => {
    const help = await cli(["help"], RELEASE);
    assertIncludes(help.stdout, "  buildos <domain> [flags]\n");
    assertIncludes(help.stdout, 'Run "buildos help <domain>" for domain details.\n');
    assert.ok(!help.stdout.includes("npx"), "no npx form in the root help");
  });
});

describe("the printed rebuild command runs as printed in the system shell (F-P8-10)", () => {
  let program: string;
  before(
    async () => {
      program = await bundle({ outfile: join(scratch, "bundle", "buildos.js") });
    },
    { timeout: 120_000 },
  );

  // The folder names hold a space and characters each shell treats specially outside quotes.
  const names = process.platform === "win32" ? ["plain", "with space", "a&b (c)"] : ["plain", "with space", "a$b `c` it's & (d)"];

  /** The printed command with its program word `buildos` replaced by `node <bundle>`, quoted for the shell. */
  function runnable(printed: string, quote: (text: string) => string): string {
    assert.ok(printed.startsWith("buildos "), "a source build prints buildos");
    return `${quote(process.execPath)} ${quote(program)} ${printed.slice("buildos ".length)}`;
  }

  function checkRan(root: string, result: ReturnType<typeof spawnSync>, shell: string): void {
    assertSame(result.status, 0, `${shell} exit`);
    assert.ok(String(result.stdout).replace(/\r\n/g, "\n").startsWith("entities.rebuild-index: ok\n"), `${shell}: rebuild-index ok`);
    assert.ok(existsSync(join(root, ".os", "indexes", "entity-resolution.json")), `${shell}: the index is written`);
  }

  for (const name of names) {
    it(`a folder named ${JSON.stringify(name)}`, { timeout: 60_000 }, async () => {
      const shells: { shell: string; spawn: (line: string) => ReturnType<typeof spawnSync> }[] =
        process.platform === "win32"
          ? [
              { shell: "Command Prompt", spawn: (line) => spawnSync(process.env["ComSpec"] ?? "cmd.exe", [`/d /s /c "${line}"`], { encoding: "utf8", windowsVerbatimArguments: true }) },
              { shell: "Windows PowerShell", spawn: (line) => spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `& ${line}`], { encoding: "utf8" }) },
            ]
          : [{ shell: "sh", spawn: (line) => spawnSync("/bin/sh", ["-c", line], { encoding: "utf8" }) }];
      for (const { shell, spawn } of shells) {
        const root = entityRoot(`${name}-${++counter}`);
        const printed = actionLine((await cli(["entities", "validate", "--root", root, "--mode", "compat"], "dev")).stdout);
        // Program paths: POSIX single quotes; Command Prompt and PowerShell double quotes (a path without `"`, `%`, `$`, or a backtick).
        const quote = (text: string) => (process.platform === "win32" ? `"${text}"` : `'${text.replace(/'/g, "'\\''")}'`);
        checkRan(root, spawn(runnable(printed, quote)), shell);
        const after = await cli(["entities", "validate", "--root", root, "--mode", "compat"], "dev");
        assert.ok(!after.stdout.includes("index_stale"), `${shell}: no index warning after the run`);
      }
    });
  }
});
