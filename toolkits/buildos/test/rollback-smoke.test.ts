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
// Line ends are read as LF: git checks out guide/content/ with the system's line ends (CRLF on a
// Windows runner), and the section finders below match \n (as guide-walk.test.ts and guide-examples.test.ts do).
const guideText = readFileSync(join(repoRoot, "guide", "content", "04-install-and-configure-your-instance.md"), "utf8").replace(/\r\n/g, "\n");
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

  // Review round 2 of pull request 15, finding 3: a failed guard stops the run before any command on the disqualified route.
  it("with a build-os install above the temporary root, the script stops at the first route guard with exit 1, before any npx command", (t) => {
    const base = realpathSync.native(mkdtempSync(join(tmpdir(), "rollback-guard-")));
    t.after(() => rmSync(base, { recursive: true, force: true }));
    const install = join(base, "node_modules", "build-os");
    mkdirSync(install, { recursive: true });
    writeFileSync(join(install, "package.json"), JSON.stringify({ name: "build-os", version: "0.1.0" }));
    const out = join(base, "out");
    const r = spawnSync(process.execPath, [join(packageRoot, "scripts", "rollback-smoke.ts"), "--out", out], { encoding: "utf8", env: { ...process.env, TMPDIR: base, TEMP: base, TMP: base } });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /\(0 of 1 steps\)\n {2}STOPPED: the route guard \(before any npx command\) failed, so the later steps did not run\n/);
    assert.match(r.stdout, /FAILED: route guard \(before any npx command\): no node_modules\/build-os entry/);
    const os = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : process.platform;
    const report = JSON.parse(readFileSync(join(out, `rollback-${os}.json`), "utf8")) as { steps: { name: string; stderr: string }[] };
    assert.deepEqual(report.steps.map((s) => s.name), ["route guard (before any npx command)"]);
    assert.match(report.steps[0]!.stderr, /found [^\n]*node_modules[\\/]build-os/);
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
    // Review round 2 of pull request 15, finding 3: the first two guards stop the run when they fail (need); the last one records.
    assert.match(script, /\nneed\(routeGuard\("route guard \(before any npx command\)", repositoryHelper, [^\n]*\[root\]\), "the route guard \(before any npx command\)"\);\n/);
    assert.match(script, /\nneed\(routeGuard\("route guard \(before the first wrapper run\)", join\(project, "\.os", "scripts", "pinned-version\.cjs"\), [^\n]*\[project, original\]\), "the route guard \(before the first wrapper run\)"\);\n/);
    assert.match(script, /\nrouteGuard\("route guard \(after the last wrapper run\)", join\(project, "\.os", "scripts", "pinned-version\.cjs"\), [^\n]*\[project, original\]\);\n/);
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
    // Review round 2 of pull request 15, finding 1: the helper and the wrapper do not run under the same cmd.exe, so (b) is consistent, not isolated.
    assert.match(fP917Reading(2, 0, 2), /^cause \(b\) consistent, not isolated: /);
    assert.match(fP917Reading(2, 0, 2), /lost on the wrapper invocation path \(a \.cmd wrapper started through cmd\.exe\)/);
    assert.match(fP917Reading(2, 0, 2), /the batch wrapper's own exit path is the leading hypothesis, not shown$/);
    assert.doesNotMatch(fP917Reading(2, 0, 2), /shown:/);
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
    // F-P9-17 fix: the line after node names the exit code, so cmd /c without call passes it on (test/wrapper-exit-codes.test.ts).
    assert.match(cmd, /node "%~dp0pinned-version\.cjs" --cmd "%~f0" "%~dp0\.\.\\manifest\.json" %\*\r?\nexit \/b %ERRORLEVEL%\r?\n/);
  });
});

// Review round 2 of pull request 15, finding 2: run 3 saw the 0.1.0 usage error with exit 0 through the
// Windows wrapper's npx route (F-P9-17), so the guide names that exception where it says exit code 2.
// Pull request 16 (the F-P9-17 fix): the guide names the versions with the defect. The 0.2.1 version pull request: it says that 0.2.1 fixes the wrapper and points to its upgrade section, which comes before the 0.1.0 to 0.2.0 section, outside the guide text that the tests above read.
describe("review round 2 of pull request 15, finding 2: the guide names the Windows exit code of F-P9-17", () => {
  it("the first description of the failure names the exception, and the repeated claim points to it", () => {
    const first = "a skill command stops with `unknown command` (exit code `2`). On Windows, in BuildOS `0.1.0` and `0.2.0`, the project wrapper `.os\\scripts\\buildos.cmd` and the `.cmd` scripts with the old names give exit code `0` when they are started by `cmd /c` without `call` or by PowerShell, which is how a script or an agent usually starts them. The error text is right, so check the text, not only the code. BuildOS `0.2.1` fixes the wrapper, and a project gets the fixed wrapper only when you copy it: see \"From 0.2.0 to 0.2.1\" above.";
    const repeated = "the command stops with `unknown command` (exit code `2`, or `0` on Windows through the project wrapper of `0.1.0` or `0.2.0`, as above).";
    assert.ok(guideText.includes(first));
    assert.ok(guideText.includes(repeated));
    assert.ok(guideText.indexOf(first) < guideText.indexOf(repeated));
    // No other claim of exit code 2 for unknown command is left without the exception.
    assert.equal((guideText.match(/`unknown command` \(exit code `2`\)/g) ?? []).length, 1);
  });
});

// The 0.2.1 version pull request: the guide's "From 0.2.0 to 0.2.1" section copies the fixed Windows
// wrapper (F-P9-17). It stands before "From 0.1.0 to 0.2.0", so the rollback smoke's guide text above
// (from that heading to the "Not available yet" note) does not hold it, and the smoke runs only 0.1.0 and 0.2.0.
describe("the guide's 0.2.0 to 0.2.1 section (the F-P9-17 wrapper copy)", () => {
  const from = guideText.indexOf("### From 0.2.0 to 0.2.1");
  const to = guideText.indexOf("### From 0.1.0 to 0.2.0");
  const part = guideText.slice(from, to);
  const WINDOWS_CHECK = ['set "ERRORLEVEL="', "cmd /d /c .os\\scripts\\buildos.cmd no-such-command", "echo %ERRORLEVEL%"];
  const blocks = (language: string) => [...part.matchAll(new RegExp("```" + language + "\\n([^]*?)\\n *```", "g"))].flatMap((m) => m[1]!.split("\n").map((l) => l.trim())).filter((l) => l !== "");

  it("comes before the 0.1.0 to 0.2.0 section, which the rollback smoke reads, and has its rollback", () => {
    assert.ok(from > 0 && to > from);
    assert.equal(guideText.indexOf("### From 0.2.0 to 0.2.1", from + 1), -1);
    assert.ok(part.includes("#### Roll back from 0.2.1 to 0.2.0"));
    assert.ok(!section.includes("0.2.1 init"), "the rollback smoke's section holds no 0.2.1 command");
  });

  it("copies the one wrapper file from a clean 0.2.1 copy, with a backup first, and puts it back on rollback", () => {
    const sh = blocks("sh");
    for (const line of [
      "mkdir ../buildos-upgrade-0.2.1",
      "cp .os/scripts/buildos.cmd ../buildos-upgrade-0.2.1/backup/buildos.cmd",
      "npx -y build-os@0.2.1 init --root ../buildos-upgrade-0.2.1/new --skip-make-docs",
      "cp ../buildos-upgrade-0.2.1/new/.os/scripts/buildos.cmd .os/scripts/buildos.cmd",
      "cp ../buildos-upgrade-0.2.1/backup/buildos.cmd .os/scripts/buildos.cmd",
    ]) assert.ok(sh.includes(line), line);
    assert.ok(sh.indexOf("cp .os/scripts/buildos.cmd ../buildos-upgrade-0.2.1/backup/buildos.cmd") < sh.indexOf("cp ../buildos-upgrade-0.2.1/new/.os/scripts/buildos.cmd .os/scripts/buildos.cmd"), "the backup comes first");
    // Only the version file and the wrapper are copied; no skill.
    for (const line of sh.filter((l) => l.startsWith("cp "))) assert.match(line, /(manifest\.json|buildos\.cmd)$/, line);
    assert.ok(part.includes('change `"buildos_version"` from `"0.2.0"` to `"0.2.1"`'));
  });

  it("each sh command has its Command Prompt form, made by the guide's rule, in the same order", () => {
    const sh = blocks("sh");
    const bat = blocks("bat").filter((l) => !WINDOWS_CHECK.includes(l));
    assert.deepEqual(bat, sh.map((l) => commandPromptForm(l)));
  });

  // Review round 1 of pull request 17, findings 1 to 4.
  const blockList = (doc: string, language: string) => [...doc.matchAll(new RegExp("```" + language + "\\n([^]*?)\\n *```", "g"))].map((m) => m[1]!.split("\n").map((l) => l.trim()).filter((l) => l !== ""));
  const notesText = readFileSync(join(packageRoot, "RELEASE_NOTES.md"), "utf8").replace(/\r\n/g, "\n");
  const notes021 = notesText.slice(notesText.indexOf("\n## 0.2.1\n"), notesText.indexOf("\n## 0.2.0\n"));

  it("the work-folder guard runs alone: the first mkdir is a block of its own in sh and in Command Prompt, in the guide and the notes", () => {
    for (const [name, doc] of [["guide", part], ["notes", notes021]] as const) {
      for (const [language, guard] of [["sh", "mkdir ../buildos-upgrade-0.2.1"], ["bat", "mkdir ..\\buildos-upgrade-0.2.1"]] as const) {
        const list = blockList(doc, language);
        assert.deepEqual(list[0], [guard], `${name} ${language}: the guard is the first block, alone`);
        assert.equal(list.flat().filter((l) => l === guard).length, 1, `${name} ${language}: one guard`);
      }
    }
  });

  it("the rollback names the cases without a work folder of this project before the copy from the backup, in the guide and the notes", () => {
    const rollback = part.slice(part.indexOf("#### Roll back from 0.2.1 to 0.2.0"));
    const copy = rollback.indexOf("cp ../buildos-upgrade-0.2.1/backup/manifest.json .os/manifest.json");
    assert.ok(copy > 0);
    for (const s of ["**You changed only the version**", "**Someone else did the upgrade**", "git checkout <commit> -- .os/manifest.json .os/scripts/buildos.cmd"]) {
      assert.ok(rollback.indexOf(s) > 0 && rollback.indexOf(s) < copy, s);
    }
    const notesRollback = notes021.slice(notes021.indexOf("### Roll back\n"));
    const notesCopy = notesRollback.indexOf("copy ..\\buildos-upgrade-0.2.1\\backup\\manifest.json .os\\manifest.json");
    assert.ok(notesCopy > 0);
    for (const s of ["If you changed only the pin (macOS or Linux), you made no backup and no work folder, so copy nothing.", "If someone else did the upgrade", "git checkout <commit> -- .os/manifest.json .os/scripts/buildos.cmd"]) {
      assert.ok(notesRollback.indexOf(s) > 0 && notesRollback.indexOf(s) < notesCopy, s);
    }
    // An offline npm install must go back to 0.2.0 too, in every case.
    for (const doc of [rollback, notesRollback]) assert.match(doc, /In every case|in every case/);
    for (const doc of [rollback, notesRollback]) assert.ok(doc.includes("`ENOTCACHED`"));
  });

  it("the Windows exit-code check clears a variable named ERRORLEVEL first and echoes on its own line, in the guide and the notes; own wrapper changes get the full diff", () => {
    for (const doc of [part, notes021]) {
      assert.ok(blockList(doc, "bat").some((b) => JSON.stringify(b) === JSON.stringify(WINDOWS_CHECK)));
      assert.ok(doc.includes("not inside a block in parentheses"));
      assert.ok(!/no-such-command` prints an error.{0,80}, and then `echo %ERRORLEVEL%`/.test(doc), "no probe and echo in one sentence");
    }
    assert.ok(part.includes("`git --no-pager diff --no-index ../buildos-upgrade-0.2.1/new/.os/scripts/buildos.cmd .os/scripts/buildos.cmd` shows the full difference"));
    assert.ok(notes021.includes("`git --no-pager diff --no-index ..\\buildos-upgrade-0.2.1\\new\\.os\\scripts\\buildos.cmd .os\\scripts\\buildos.cmd`, and make sure that it shows only your own changes"));
  });

  // Review round 2 of pull request 17, findings 1, 2, and 4.
  const between = (doc: string, from: string, to: string) => {
    const a = doc.indexOf(from);
    const b = doc.indexOf(to, a + from.length);
    assert.ok(a >= 0 && b > a, `${from} ... ${to}`);
    return doc.slice(a, b);
  };
  const notesRollbackText = notes021.slice(notes021.indexOf("### Roll back\n"));

  it("the git rollback restores both files from a commit before the whole upgrade, HEAD when it is not committed, in the guide and the notes", () => {
    for (const doc of [part.slice(part.indexOf("#### Roll back from 0.2.1 to 0.2.0")), notesRollbackText]) {
      assert.ok(!doc.includes("<commit>~1"), "no parent of one upgrade commit");
      assert.ok(doc.includes("`git checkout <commit> -- .os/manifest.json .os/scripts/buildos.cmd`"));
      assert.ok(doc.includes("If the upgrade is not committed, `<commit>` is `HEAD`."));
      assert.ok(doc.includes("git log --oneline -- .os/manifest.json .os/scripts/buildos.cmd"));
      assert.ok(doc.includes("the commits of the upgrade (one or two) are at the top") || doc.includes("The commits of the upgrade (one or two) are at the top."));
      assert.ok(doc.includes("is the first commit below them, the one before the first commit of the upgrade."));
      // Final fix pass of pull request 17, finding 6: a partly committed upgrade also needs the commit before its first change.
      assert.ok(doc.includes("If it is committed, also only in part (for example, only one of the two files)"));
    }
  });

  it("the rollback check proves that the old wrapper is back, in sh and in Command Prompt, in every case, in the guide and the notes", () => {
    const wrapper = readFileSync(join(repoRoot, "system", ".os", "scripts", "buildos.cmd"), "utf8");
    assert.equal(wrapper.split("F-P9-17").length - 1, 1, "the 0.2.1 wrapper holds the marker once");
    // The guide's rollback check is the end of the section (part stops at "### From 0.1.0 to 0.2.0").
    const guideCheck = part.slice(part.indexOf("3. **Check.** In every case, both must be true:"));
    assert.ok(guideCheck.length > 0 && part.indexOf("3. **Check.** In every case, both must be true:") > part.indexOf("#### Roll back from 0.2.1 to 0.2.0"));
    const notesCheck = notesRollbackText.slice(notesRollbackText.indexOf("Check, in every case:"));
    assert.ok(notesRollbackText.indexOf("Check, in every case:") > 0);
    for (const doc of [guideCheck, notesCheck]) {
      assert.ok(doc.includes("prints `version: 0.2.0`"));
      assert.ok(doc.includes("`grep F-P9-17 .os/scripts/buildos.cmd`"));
      assert.ok(doc.includes("`findstr F-P9-17 .os\\scripts\\buildos.cmd`"));
      assert.ok(doc.includes(") prints nothing."));
      assert.ok(!doc.includes("<commit>~1"), "no diff against the parent of one upgrade commit, which a wrong revision also passes");
      // Final fix pass of pull request 17, finding 6: the marker check is the stock check; a wrapper with your own
      // changes is compared with the file that was put back, from the backup or from the <commit> of the git rule.
      assert.ok(doc.includes("If the wrapper held your own changes, this marker check is not enough: a new wrapper with changes can lack the marker."));
      assert.ok(doc.includes("`cmp ../buildos-upgrade-0.2.1/backup/buildos.cmd .os/scripts/buildos.cmd` prints nothing"));
      assert.ok(doc.includes("`fc /b ..\\buildos-upgrade-0.2.1\\backup\\buildos.cmd .os\\scripts\\buildos.cmd` prints `FC: no differences encountered`"));
      assert.ok(doc.includes("`git --no-pager diff --exit-code <commit> -- .os/scripts/buildos.cmd` prints nothing (the same command in Command Prompt)"));
      assert.ok(doc.indexOf("If the wrapper held your own changes") > doc.indexOf("`grep F-P9-17 .os/scripts/buildos.cmd`"));
    }
  });

  it("the upgrade doc sends a rollback and an npm install to the guide's version-specific rollback", () => {
    const upgradeDoc = readFileSync(join(repoRoot, "docs", "assets", "user", "upgrade-an-existing-buildos-project.md"), "utf8").replace(/\r\n/g, "\n");
    const change = between(upgradeDoc, "## Change the version later", "## If something goes wrong");
    assert.ok(change.includes("- To roll back, follow the rollback part of the guide section for your version: chapter 4, \"Roll back from 0.2.1 to 0.2.0\" or \"Roll back from 0.2.0 to 0.1.0\"."));
    assert.ok(change.includes("so do not only set the earlier version"));
    assert.ok(change.includes("do what the rollback part of the same guide section says"));
    assert.ok(!change.includes("You do not need to change or remove a global install"));
  });

  it("the Windows probe expects exit code 2, and the rollback reinstalls 0.2.0, within their steps, in the guide and the notes", () => {
    const guideProbe = between(part, "   - On Windows, in Command Prompt, also after your own changes", "   Then commit.");
    assert.ok(guideProbe.includes("the third line prints `2`. With the old wrapper it prints `0`."));
    assert.ok(notes021.includes("```\n\nThe second line prints an error, and the third prints `2` (the old wrapper gives `0`)."));
    const guideReinstall = between(part, "2. **Put back the npm install,** in every case:", "3. **Check.**");
    const notesReinstall = between(notesRollbackText, "In every case, if you installed `0.2.1` with npm", "Check, in every case:");
    for (const doc of [guideReinstall, notesReinstall]) {
      assert.ok(doc.includes("install `0.2.0` there again."));
      assert.ok(!/keep|leave/i.test(doc), "no instruction to keep the 0.2.1 install");
      assert.ok(doc.includes("npm can then stop with `ENOTCACHED`: whether it does depends on what the npm cache holds."));
    }
  });

  it("the clean copy has an offline form with the 0.2.1 file, in the guide and the notes", () => {
    const offline = "`npx -y --offline --package <file> -- buildos init --root ";
    assert.ok(between(part, "2. **Get a clean copy of `0.2.1`:**", "3. **Replace the wrapper:**").includes(`${offline}../buildos-upgrade-0.2.1/new --skip-make-docs\``));
    assert.ok(notes021.includes(`${offline}..\\buildos-upgrade-0.2.1\\new --skip-make-docs\``));
    for (const doc of [part, notes021]) assert.ok(doc.includes("can stop with `ENOTCACHED`. Use the `0.2.1` file"));
  });

  it("the notes' update and rollback hold the guide's commands, in the same order, in sh and in Command Prompt", () => {
    const steps = notes021.slice(notes021.indexOf("### Update a project from 0.2.0"), notes021.indexOf("### Known limits")) + notes021.slice(notes021.indexOf("### Roll back\n"));
    for (const language of ["sh", "bat"]) assert.deepEqual(blockList(steps, language).flat(), blocks(language), language);
  });
});
