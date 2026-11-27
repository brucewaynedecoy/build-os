// W1 R7 P9, F-P9-16: the rollback proof of scripts/rollback-smoke.ts runs
// the commands of the user guide, chapter 4 ("From 0.1.0 to 0.2.0" and "Roll
// back from 0.2.0 to 0.1.0"), and on Windows their Command Prompt form. These
// tests check the commands against the guide text, the pure parts of the
// checks, and the usage guard. The run itself needs the registry; the
// buildos-smoke workflow runs it on three systems (source rollback, and every
// pull request that changes the smoke files).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ALL_COMMANDS, cacheProblems, changedLines, changePin, CHANGED_SKILLS, commandPromptForm, helpDomains, registryTarball } from "../scripts/rollback-steps.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const guideText = readFileSync(join(repoRoot, "guide", "content", "04-install-and-configure-your-instance.md"), "utf8");
const start = guideText.indexOf("### From 0.1.0 to 0.2.0");
const end = guideText.indexOf("> **Not available yet.** There is no `buildos update` command yet.", start);
const section = guideText.slice(start, end);
const shLines = [...section.matchAll(/```sh\n([^]*?)\n *```/g)].flatMap((m) => m[1]!.split("\n").map((l) => l.trim())).filter((l) => l !== "");
const script = readFileSync(join(packageRoot, "scripts", "rollback-smoke.ts"), "utf8");

describe("F-P9-16: the rollback proof runs the guide's commands", () => {
  it("finds both guide sections", () => {
    assert.ok(start >= 0 && end > start, "the sections are in chapter 4");
    assert.ok(section.includes("#### Roll back from 0.2.0 to 0.1.0"));
    assert.ok(shLines.length >= 25, String(shLines.length));
  });

  it("every literal command is in the guide word for word", () => {
    for (const c of ALL_COMMANDS.filter((x) => x.guide === "literal")) assert.ok(section.includes(c.sh), c.sh);
  });

  it("every command of the guide's sh blocks runs, except the examples for an app folder (the test project has none)", () => {
    const ran = new Set(ALL_COMMANDS.map((c) => c.sh));
    for (const line of shLines) {
      if (/claude-skills|\.claude\//.test(line)) continue;
      assert.ok(ran.has(line), line);
    }
  });

  it("the derived commands are the step 3 compare command for each skill, with the clean 0.2.0 copy or the backup", () => {
    for (const c of ALL_COMMANDS.filter((x) => x.guide === "derived" && x.sh.startsWith("git --no-pager diff"))) {
      assert.match(c.sh, /^git --no-pager diff --no-index --stat \.\.\/buildos-upgrade\/(new\/\.os\/skills|backup\/os-skills)\/([a-z-]+|AGENTS\.md) \.os\/skills\/\2$/, c.sh);
    }
    for (const skill of [...CHANGED_SKILLS, "AGENTS.md"]) {
      for (const base of ["old/.os/skills", "new/.os/skills", "backup/os-skills"]) assert.ok(ALL_COMMANDS.some((c) => c.sh === `git --no-pager diff --no-index --stat ../buildos-upgrade/${base}/${skill} .os/skills/${skill}`), `${base} ${skill}`);
    }
  });

  it("the Windows form makes only the changes that the guide names", () => {
    assert.ok(section.includes("In Command Prompt on Windows, use backslashes in the paths, `rmdir /s /q` in place of `rm -rf`, `xcopy /e /i /q` in place of `cp -R`, `copy` in place of `cp`, `mkdir` without `-p`, and `.os\\scripts\\buildos.cmd` in place of `.os/scripts/buildos`. The `git` and `npx` commands are the same."));
    assert.equal(commandPromptForm("mkdir ../buildos-upgrade"), "mkdir ..\\buildos-upgrade");
    assert.equal(commandPromptForm("cp .os/manifest.json ../buildos-upgrade/backup/manifest.json"), "copy .os\\manifest.json ..\\buildos-upgrade\\backup\\manifest.json");
    assert.equal(commandPromptForm("cp -R .os/skills ../buildos-upgrade/backup/os-skills"), "xcopy /e /i /q .os\\skills ..\\buildos-upgrade\\backup\\os-skills");
    assert.equal(commandPromptForm("rm -rf .os/skills/a .os/skills/b"), "rmdir /s /q .os\\skills\\a .os\\skills\\b");
    assert.equal(commandPromptForm(".os/scripts/buildos version --json"), ".os\\scripts\\buildos.cmd version --json");
    assert.equal(commandPromptForm(".os/scripts/buildos-intake version"), ".os\\scripts\\buildos-intake.cmd version");
    assert.equal(commandPromptForm("npx -y build-os@0.1.0 init --root ../buildos-upgrade/old --skip-make-docs"), "npx -y build-os@0.1.0 init --root ..\\buildos-upgrade\\old --skip-make-docs");
    assert.equal(commandPromptForm("git --no-pager diff --no-index --stat ../a/b .os/c"), "git --no-pager diff --no-index --stat ..\\a\\b .os\\c");
    assert.equal(commandPromptForm('git commit -m "Before BuildOS 0.2.0"'), 'git commit -m "Before BuildOS 0.2.0"');
    assert.throws(() => commandPromptForm("mkdir -p a/b"), /mkdir -p/);
    for (const c of ALL_COMMANDS) assert.doesNotMatch(commandPromptForm(c.sh), /\/(?![sqeiY]\b)/, c.sh);
  });

  it("reads the domains of help, changes only the pin, and counts changed lines", () => {
    const help = "BuildOS\n\nDomains:\n  help       Print help\n  extract    Track\n  capability-matrix  Build\n  version    Print\n\nAdd --json\n";
    assert.deepEqual(helpDomains(help), ["help", "extract", "capability-matrix", "version"]);
    assert.deepEqual(helpDomains("no list\n"), []);
    const manifest = '{\n  "schema_version": 1,\n  "buildos_version": "0.1.0",\n  "initialized_at": "x"\n}\n';
    const next = changePin(manifest, "0.1.0", "0.2.0");
    assert.equal(next, manifest.replace('"0.1.0"', '"0.2.0"'));
    assert.equal(changedLines(manifest, next!), 1);
    assert.equal(changePin('{"buildos_version": "0.3.0"}', "0.1.0", "0.2.0"), undefined);
    assert.equal(changePin('"buildos_version": "0.1.0" "buildos_version": "0.1.0"', "0.1.0", "0.2.0"), undefined);
    assert.equal(changedLines("a\nb", "a"), undefined);
  });

  it("the cache check accepts only registry entries of build-os with the registry's integrity", () => {
    const integrity = { "0.1.0": "sha512-AA==", "0.2.0": "sha512-BB==" };
    const key = (url: string) => `make-fetch-happen:request-cache:${url}`;
    const good = [
      { key: key("https://registry.npmjs.org/build-os"), integrity: "sha512-doc" },
      { key: key(registryTarball("0.1.0")), integrity: "sha512-AA==" },
      { key: key(registryTarball("0.2.0")), integrity: "sha512-BB==" },
      { key: key("https://registry.npmjs.org/other"), integrity: "sha512-x" },
    ];
    assert.deepEqual(cacheProblems(good, integrity), []);
    assert.equal(cacheProblems(good.slice(0, 2), integrity).length, 1, "a missing tarball");
    assert.equal(cacheProblems([...good, { key: "pacote:tarball:file:build-os-0.2.0.tgz", integrity: "sha512-BB==" }], integrity).length, 1, "a file entry");
    assert.equal(cacheProblems([good[0]!, good[1]!, { key: key(registryTarball("0.2.0")), integrity: "sha512-CC==" }], integrity).length, 1, "another integrity");
    assert.equal(cacheProblems([...good, { key: key("https://mirror.example/build-os/-/build-os-0.2.0.tgz"), integrity: "sha512-BB==" }], integrity).length, 1, "another registry");
  });

  it("the script refuses a bad usage before any npm call", () => {
    for (const args of [[], ["--out"], ["--out", ""], ["--version", "0.2.0", "--out", join(tmpdir(), "never-written")], ["--out", "--x"]]) {
      const r = spawnSync(process.execPath, [join(packageRoot, "scripts", "rollback-smoke.ts"), ...args], { encoding: "utf8" });
      assert.equal(r.status, 2, JSON.stringify(args));
      assert.match(r.stderr, /Usage: node scripts\/rollback-smoke\.ts --out <folder>/, JSON.stringify(args));
    }
  });

  it("the script uses a new npm cache and an empty global prefix, turns install scripts off, checks PATH for buildos, and makes no npm install", () => {
    assert.match(script, /const cache = join\(root, "npm-cache"\);\nconst globalPrefix = join\(root, "npm-prefix"\);\nmkdirSync\(cache\);\nmkdirSync\(globalPrefix\);/);
    assert.match(script, /npm_config_cache: cache,\n {2}npm_config_prefix: globalPrefix,\n {2}npm_config_ignore_scripts: "true",/);
    assert.match(script, /evidenceStep\("no buildos on PATH"/);
    assert.doesNotMatch(script, /"install"/);
    // On Windows each guide command runs in Command Prompt, in its guide form.
    assert.match(script, /const line = commandPromptForm\(c\.sh\);\n {4}return run\(`\$\{c\.step\}: \$\{line\}`, line, process\.env\["ComSpec"\] \?\? "cmd\.exe", commandPromptArgs\(line\), expected, cwd, \{ verbatim: true \}\);/);
  });
});
