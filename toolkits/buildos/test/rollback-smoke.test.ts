// W1 R7 P9, F-P9-16: the rollback proof of scripts/rollback-smoke.ts runs
// the commands of the user guide, chapter 4 ("From 0.1.0 to 0.2.0" and "Roll
// back from 0.2.0 to 0.1.0"), and on Windows their Command Prompt form. These
// tests check the commands against the guide text, the pure parts of the
// checks, and the usage guard. The run itself needs the registry; the
// buildos-smoke workflow runs it on three systems (source rollback, and every
// pull request that changes the smoke files).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import * as nodePath from "node:path";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ALL_COMMANDS, ancestorInstalls, buildosNames, cacheProblems, changedLines, changePin, CHANGED_SKILLS, commandPromptForm, fP917Reading, helpDomains, pathBuildosPrograms, registryTarball, wrapperLookupFolders, type WrapperHelper } from "../scripts/rollback-steps.ts";

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
    // Review round 1 of pull request 15, finding 3: copy asks before it replaces a file; the guide tells the reader to answer Yes, and the smoke answers it with COPYCMD=/Y.
    assert.ok(section.includes("When `copy` asks whether to overwrite a file, answer `Yes`: these steps replace the version file and the router on purpose."));
    assert.match(script, /\.\.\.\(WINDOWS \? \{ COPYCMD: "\/Y" \} : \{\}\),/);
    for (const c of ALL_COMMANDS.filter((x) => /^cp (?!-R)/.test(x.sh))) assert.match(c.sh, /(\/manifest\.json|\/AGENTS\.md)$/, c.sh);
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
    assert.match(script, /routeGuard\("route guard \(before any npx command\)", repositoryHelper, /);
    assert.doesNotMatch(script, /"install"/);
    // On Windows each guide command runs in Command Prompt, in its guide form.
    assert.match(script, /const line = commandPromptForm\(c\.sh\);\n {4}return run\(`\$\{c\.step\}: \$\{line\}`, line, process\.env\["ComSpec"\] \?\? "cmd\.exe", commandPromptArgs\(line\), expected, cwd, \{ verbatim: true \}\);/);
  });

  // F-P9-17 (run 46054715769): on Windows the .cmd wrapper exited 0 where 0.1.0 stops with exit 2 or 1.
  it("F-P9-17: the wrapper must run the pinned 0.1.0 on every system; the exit code is exact (2 and 1, and 0 on Windows, the true behavior), with the 0.1.0 error text", () => {
    assert.match(script, /const cm = wrapper\("rollback 5 \(also\)", "capability-matrix --help", WINDOWS \? 0 : 2\);\n {2}check\(cm, [^\n]*unknownCommand\(cm\.stderr, FROM_VERSION, "capability-matrix"\)\);/);
    assert.match(script, /const legacy = guide\(\{ step: "rollback 5 \(also\)", sh: "\.os\/scripts\/buildos-intake version", guide: "literal" \}, WINDOWS \? 0 : 1\);/);
    assert.match(script, /legacy\.stderr\.startsWith\(`\$\{LEGACY_NOTICE\}\\n`\) && legacy\.stderr\.includes\('buildos-intake: error: unknown command "version"'\)/);
    assert.match(script, /return stderr\.includes\(`version: \$\{version\}\\n`\) && stderr\.includes\(`ERROR \[usage_error\]: unknown command "\$\{command\}"`\);/);
    // The pin checks stay on all three systems: exit 0, version 0.1.0, its source revision, and no 0.2.0 domain in help.
    assert.match(script, /const v = guide\(ROLLBACK_CHECK_WRAPPER, 0\);\n {2}check\(v, `stdout names version \$\{FROM_VERSION\}`/);
    assert.match(script, /const vj = wrapper\("rollback 5 \(also\)", "version --json", 0\);/);
    assert.match(script, /const help = wrapper\("rollback 5 \(also\)", "help", 0\);/);
    // The Windows exit 0 is named, never a bare expectation.
    assert.equal((script.match(/WINDOWS \? 0 : [12]\)/g) ?? []).length, 2);
    assert.match(script, /F-P9-17: 0\.1\.0 stops with exit 2 here/);
  });

  it("F-P9-17 evidence: the same failure runs through each layer of the wrapper's npx route; Linux and macOS check the exit code, Windows records it", () => {
    assert.match(script, /if \(WINDOWS\) return run\(`\$\{name\}: \$\{windowsLine\}`, windowsLine, process\.env\["ComSpec"\] \?\? "cmd\.exe", commandPromptArgs\(windowsLine\), null, project, \{ verbatim: true \}\);\n {2}return run\(`\$\{name\}: \$\{posixLine\}`, posixLine, "\/bin\/sh", \["-c", posixLine\], posixExit, project\);/);
    assert.match(script, /evidenceLine\("upgrade 7 \(F-P9-17 evidence\)", "\.os\\\\scripts\\\\buildos\.cmd no-such-command", "\.os\/scripts\/buildos no-such-command", 2\);/);
    assert.match(script, /unknownCommand\(bad\.stderr, TO_VERSION, "no-such-command"\)/);
    assert.match(script, /\[\.\.\.t\.prefix, "-y", `build-os@\$\{FROM_VERSION\}`, "capability-matrix", "--help"\], WINDOWS \? null : 2, project/);
    assert.match(script, /evidenceLine\("rollback 5 \(F-P9-17 evidence\)", `npx -y build-os@\$\{FROM_VERSION\} capability-matrix --help`, `npx -y build-os@\$\{FROM_VERSION\} capability-matrix --help`, 2\);/);
    assert.match(script, /`npx -y --prefix "\$\{project\}" --workspaces=false build-os@\$\{FROM_VERSION\} capability-matrix --help`, `npx -y --prefix '\$\{project\}' --workspaces=false build-os@\$\{FROM_VERSION\} capability-matrix --help`, 2\);/);
    assert.match(script, /for \(const s of \[direct, shell, wrapperArgs\]\) check\(s, [^\n]*unknownCommand\(s\.stderr, FROM_VERSION, "capability-matrix"\)\);/);
    // The evidence step names the project folder: the report cleans step names too.
    assert.match(script, /const reported = steps\.map\(\(s\) => \(\{ \.\.\.s, name: clean\(s\.name\), command: scrub\(s\.command\),/);
    // The pinned-version.cjs npx arguments that the evidence step copies.
    const pinned = readFileSync(join(repoRoot, "system", ".os", "scripts", "pinned-version.cjs"), "utf8");
    assert.match(pinned, /return \["-y", "--prefix", process\.cwd\(\), "--workspaces=false", PACKAGE_NAME \+ "@" \+ version\]\.concat\(args\);/);
  });
});

// Review round 1 of pull request 15, finding 1: with build-os@0.1.0 installed in a node_modules folder above the
// temporary project, every step passed and the post-rollback wrapper commands ran that install, not npx.
describe("review round 1 of pull request 15, finding 1: the route guard and the launch probe of the rollback smoke", () => {
  const helper = createRequire(import.meta.url)(join(repoRoot, "system", ".os", "scripts", "pinned-version.cjs")) as WrapperHelper;
  const exists = (p: string): boolean => {
    try {
      lstatSync(p);
      return true;
    } catch {
      return false;
    }
  };

  it("finds a node_modules/build-os in a folder above the project, as the wrapper's helper looks (the ancestor case)", (t) => {
    const base = realpathSync.native(mkdtempSync(join(tmpdir(), "rollback-guard-")));
    t.after(() => rmSync(base, { recursive: true, force: true }));
    const project = join(base, "tmp", "buildos-rollback-x", "project");
    mkdirSync(project, { recursive: true });
    const folders = wrapperLookupFolders(project, project, helper, nodePath);
    // The project folder and each folder above it, up to the file system root, in that order, each once.
    assert.equal(folders[0], project);
    assert.ok(folders.includes(join(base, "tmp")) && folders.includes(base));
    assert.equal(folders.at(-1), nodePath.parse(project).root);
    assert.equal(new Set(folders).size, folders.length);
    assert.deepEqual(ancestorInstalls(folders, exists, nodePath), [], "nothing installed yet");
    // The ancestor install of the review: two folders above the project.
    const install = join(base, "tmp", "node_modules", "build-os");
    mkdirSync(install, { recursive: true });
    writeFileSync(join(install, "package.json"), JSON.stringify({ name: "build-os", version: "0.1.0", bin: { buildos: "dist/buildos.js" } }));
    assert.deepEqual(ancestorInstalls(folders, exists, nodePath), [install]);
    // The helper's own lookup takes that install for the 0.1.0 pin: the guard rejects exactly what the wrapper would run.
    mkdirSync(join(install, "dist"));
    writeFileSync(join(install, "dist", "buildos.js"), "");
    assert.equal((helper as unknown as { packageEntry(dir: string, v: string | null): string | undefined }).packageEntry(install, "0.1.0"), realpathSync.native(join(install, "dist", "buildos.js")));
  });

  it("an entry of any kind and any version counts, and npm's local project folder for the current folder is read too", (t) => {
    const base = realpathSync.native(mkdtempSync(join(tmpdir(), "rollback-guard-")));
    t.after(() => rmSync(base, { recursive: true, force: true }));
    const project = join(base, "p", "project");
    const other = join(base, "q", "work", "sub");
    mkdirSync(project, { recursive: true });
    mkdirSync(other, { recursive: true });
    // npm's local project folder for `other` is q/work (it holds a package.json); its node_modules holds a plain file named build-os.
    writeFileSync(join(base, "q", "work", "package.json"), "{}");
    mkdirSync(join(base, "q", "work", "node_modules"));
    writeFileSync(join(base, "q", "work", "node_modules", "build-os"), "not a package");
    const folders = wrapperLookupFolders(project, other, helper, nodePath);
    assert.ok(folders.includes(join(base, "q", "work")) && folders.includes(join(base, "q")), "npm's local project folder and each folder above it");
    assert.ok(!folders.includes(other), "the current folder itself is not read when npm's local project folder is above it");
    assert.deepEqual(ancestorInstalls(folders, exists, nodePath), [join(base, "q", "work", "node_modules", "build-os")]);
  });

  it("reads PATH as the wrapper's helper does: an empty or relative entry is relative to the current folder", (t) => {
    const base = realpathSync.native(mkdtempSync(join(tmpdir(), "rollback-guard-")));
    t.after(() => rmSync(base, { recursive: true, force: true }));
    const cwd = join(base, "project");
    mkdirSync(join(cwd, "rel"), { recursive: true });
    mkdirSync(join(base, "abs"));
    assert.deepEqual(pathBuildosPrograms(`${join(base, "abs")}::rel`, cwd, false, helper, exists, nodePath), []);
    writeFileSync(join(cwd, "buildos"), "");
    writeFileSync(join(cwd, "rel", "buildos"), "");
    writeFileSync(join(base, "abs", "buildos"), "");
    assert.deepEqual(pathBuildosPrograms(`${join(base, "abs")}::rel`, cwd, false, helper, exists, nodePath), [join(base, "abs", "buildos"), join(cwd, "buildos"), join(cwd, "rel", "buildos")]);
    // Windows: the helper's own split (a ; inside double quotes is part of the folder name) and each PATHEXT program name.
    assert.deepEqual(helper.splitWindowsPath('"C:\\a;b";C:\\c'), ["C:\\a;b", "C:\\c"]);
    for (const n of ["buildos.com", "buildos.exe", "buildos.bat", "buildos.cmd"]) assert.ok(buildosNames(true).includes(n), n);
  });

  it("the script guards before any npx command, before the first wrapper run, and after the last one, and checks the launch probe of every wrapper run", () => {
    assert.match(script, /routeGuard\("route guard \(before any npx command\)", repositoryHelper, [^\n]*\[root\]\);\n/);
    assert.equal((script.match(/routeGuard\("route guard \((before the first wrapper run|after the last wrapper run)\)", join\(project, "\.os", "scripts", "pinned-version\.cjs"\), [^\n]*\[project, original\]\);/g) ?? []).length, 2);
    assert.ok(script.indexOf('routeGuard("route guard (before any npx command)"') < script.indexOf("// 1. The reference versions, from the registry."));
    assert.ok(script.indexOf('routeGuard("route guard (before the first wrapper run)"') < script.indexOf("// Upgrade step 7: the checks, then commit."));
    assert.ok(script.indexOf('routeGuard("route guard (after the last wrapper run)"') > script.indexOf('const v = wrapper("original", "version", 0, original);'));
    assert.match(script, /NODE_OPTIONS: probeNodeOptions\(probe\),\n {2}npm_config_node_options: probeNodeOptions\(probe\),/);
    assert.match(script, /if \(opts\.wrapperRoute === true \|\| \/\^\\\.os\[\\\\\/\]scripts\[\\\\\/\]\/\.test\(shown\)\) wrapperRuns\.push/);
    assert.match(script, /evidenceStep\(\n {4}"launch probe: each wrapper run started the pinned build-os from the npx cache",/);
    assert.match(script, /problems: wrapperRuns\.length === 0 \? \["no wrapper run was recorded"\] : problems/);
  });
});

// Review round 1 of pull request 15, finding 2: the F-P9-17 diagnostic of the helper started directly.
describe("review round 1 of pull request 15, finding 2: the F-P9-17 diagnostic", () => {
  it("reads the two exit codes as cause (a), cause (b), or neither", () => {
    assert.match(fP917Reading(2, 0, 2), /^cause \(b\) shown/);
    assert.match(fP917Reading(0, 0, 2), /^cause \(a\) shown/);
    assert.match(fP917Reading(2, 2, 2), /^neither pattern/);
    assert.match(fP917Reading(null, 0, 2), /^neither pattern/);
  });

  it("on Windows it starts the project's helper with node.exe (no batch file) and records the code; on Linux and macOS it starts the helper's npx route and checks exit 2", () => {
    assert.match(script, /const args = \[helperFile, "--cmd", self, manifest, "capability-matrix", "--help"\];\n {4}const direct = run\([^\n]*, process\.execPath, args, null, project, \{ extraEnv: \{ BUILDOS_WRAPPER_ACTIVE: "1", NoDefaultCurrentDirectoryInExePath: "1" \}, wrapperRoute: true \}\);/);
    assert.match(script, /const manifest = join\(project, "\.os", "scripts", "\.\.", "manifest\.json"\);/);
    assert.match(script, /fP917Reading\(direct\.exit, cm\.exit, 2\)/);
    assert.match(script, /const args = \[helperFile, "--npx", join\(npmRoot, "bin", "npx-cli\.js"\), FROM_VERSION, "capability-matrix", "--help"\];\n {4}const direct = run\([^\n]*, process\.execPath, args, 2, project,/);
    // The batch wrapper starts node with these arguments, so the direct form matches it.
    const cmd = readFileSync(join(repoRoot, "system", ".os", "scripts", "buildos.cmd"), "utf8");
    assert.match(cmd, /node "%~dp0pinned-version\.cjs" --cmd "%~f0" "%~dp0\.\.\\manifest\.json" %\*\r?\nexit \/b/);
  });
});
