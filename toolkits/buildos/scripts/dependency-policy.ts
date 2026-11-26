// Supply-chain rules for package.json, package-lock.json, .npmrc, and the
// installed package manifests. See PRD 20, Supply Chain, and
// toolkits/buildos/SECURITY.md, Install-Script Exception.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** Exact semver: no range, tag, URL, or workspace specifier. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Fields that would make npm resolve packages on a user's machine. */
const RUNTIME_FIELDS = ["dependencies", "optionalDependencies", "peerDependencies", "bundleDependencies", "bundledDependencies"];

/**
 * Every npm lifecycle script that `npm install` or `npm ci` can run, taken
 * from npm 11 (`lib/commands/install.js`, `lib/commands/ci.js`, and
 * `@npmcli/arborist` reify and rebuild):
 *
 * - `preinstall`, `install`, `postinstall`: each installed package, and the root;
 * - `prepublish`, `preprepare`, `prepare`, `postprepare`: the root, and git or
 *   linked dependencies;
 * - `predependencies`, `dependencies`, `postdependencies`: the root, after
 *   `node_modules` changes.
 *
 * The root package.json may declare none of them. An installed manifest may
 * declare none of them, except the closed esbuild `postinstall` exception.
 * npm also runs an implicit `install` (`node-gyp rebuild`) for a package with
 * a `binding.gyp` and no `preinstall` or `install` script; the installed
 * check treats that as `install`, and the lockfile marks it `hasInstallScript`.
 */
export const INSTALL_LIFECYCLE_SCRIPTS: readonly string[] = Object.freeze([
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

export interface InstallScriptException {
  name: string;
  version: string;
  /** The only lifecycle script the package may declare, and its exact command. */
  script: string;
  command: string;
}

/**
 * The closed install-script exception from PRD 20, Supply Chain. It holds
 * exactly one entry. Adding an entry or changing the version needs a new
 * owner decision recorded in PRD 20. Agents may not change this list.
 */
export const INSTALL_SCRIPT_EXCEPTION: readonly InstallScriptException[] = Object.freeze([
  Object.freeze({ name: "esbuild", version: "0.28.2", script: "postinstall", command: "node install.js" }),
]);

export interface PolicyInput {
  packageJson: Record<string, unknown>;
  lockfile?: Record<string, unknown>;
  /** Text of toolkits/buildos/.npmrc. Checked when given; null means the file is missing. */
  npmrc?: string | null;
  /** Installed manifests keyed by their node_modules path. Checked when given. */
  installedManifests?: Record<string, Record<string, unknown>>;
  /**
   * True when a `binding.gyp` file sits beside the root package.json. npm runs
   * it as an implicit `install` (`node-gyp rebuild`), so the root may not have
   * one. check-dependencies.ts reads it in both modes.
   */
  rootBindingGyp?: boolean;
  /** Test seam only. CI always uses INSTALL_SCRIPT_EXCEPTION. */
  exception?: readonly InstallScriptException[];
}

/** Package name for a lockfile path such as node_modules/a/node_modules/@b/c. */
function nameFromPath(path: string): string {
  const marker = "node_modules/";
  const at = path.lastIndexOf(marker);
  return at === -1 ? path : path.slice(at + marker.length);
}

function declaredScripts(manifest: Record<string, unknown>, names: readonly string[]): string[] {
  const scripts = manifest["scripts"];
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) return [];
  return names.filter((name) => Object.hasOwn(scripts, name));
}

function scriptCommand(manifest: Record<string, unknown>, name: string): unknown {
  const scripts = manifest["scripts"];
  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts) || !Object.hasOwn(scripts, name)) return undefined;
  return (scripts as Record<string, unknown>)[name];
}

/** `ignore-scripts` and every spelling npm or a reader might confuse with it. */
const looksLikeIgnoreScripts = (key: string) => key.toLowerCase().replace(/_/g, "-").replace(/\[\]$/, "") === "ignore-scripts";

/**
 * Checks that .npmrc text sets `ignore-scripts=true` where npm reads it as the
 * effective top-level value. npm reads .npmrc as INI: a key under a `[section]`
 * is not a top-level setting, a `#` or `;` line is a comment, and a later
 * duplicate overrides an earlier one. The rule is strict, so no reading of the
 * file can leave scripts on:
 *
 * - exactly one non-comment line names `ignore-scripts` in any spelling (case,
 *   `_` for `-`, a `[]` suffix, or a bare key with no `=`);
 * - that line is exactly `ignore-scripts=true`, with optional spaces around
 *   the key and value, and no quotes or inline comment;
 * - it comes before the first `[section]` line.
 *
 * Returns the problems found; an empty list means the setting is effective.
 */
export function checkNpmrc(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  const matches: { line: number; raw: string; inSection: boolean }[] = [];
  let inSection = false;
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#") || line.startsWith(";")) return;
    if (/^\[.*\]$/.test(line)) {
      inSection = true;
      return;
    }
    const eq = line.indexOf("=");
    const key = (eq === -1 ? line : line.slice(0, eq)).trim();
    if (looksLikeIgnoreScripts(key)) matches.push({ line: index + 1, raw: line, inSection });
  });
  if (matches.length === 0) return [".npmrc must set ignore-scripts=true at top level; no uncommented ignore-scripts line was found"];
  if (matches.length > 1) {
    return [`.npmrc must set ignore-scripts=true exactly once; found ${matches.length} ignore-scripts lines (${matches.map((m) => `line ${m.line}`).join(", ")}), and a later one overrides an earlier one`];
  }
  const [match] = matches as [(typeof matches)[number]];
  if (match.inSection) return [`.npmrc line ${match.line} sets ignore-scripts under an INI [section], so npm does not read it as the top-level setting`];
  if (!/^ignore-scripts\s*=\s*true$/.test(match.raw)) {
    return [`.npmrc line ${match.line} must read exactly ignore-scripts=true, found ${JSON.stringify(match.raw)}`];
  }
  return [];
}

/**
 * Asks npm for the effective `ignore-scripts` value in `packageRoot`, with an
 * empty user config, so the user's own npm config is neither read nor changed.
 * The project .npmrc, the global config, and `npm_config_*` environment
 * variables still apply, as they do for a real `npm ci`. npm runs as
 * `node npm-cli.js` beside the running Node, with a scratch cache and no log
 * files. Returns the trimmed value, or an error text when npm cannot run.
 */
export function npmEffectiveIgnoreScripts(packageRoot: string, options: { npmCli?: string } = {}): { value?: string; error?: string } {
  const npmCli = options.npmCli ?? findNpmCli();
  if (npmCli === undefined) return { error: "npm-cli.js was not found beside the running Node" };
  const scratch = mkdtempSync(join(tmpdir(), "buildos-npm-config-"));
  try {
    const userconfig = join(scratch, "user-npmrc");
    writeFileSync(userconfig, "");
    // npm finds the project from the working folder. `npm run` exports the
    // caller's prefix, so drop it; every other npm_config_* value applies.
    const env: NodeJS.ProcessEnv = { ...process.env, npm_config_cache: join(scratch, "cache"), npm_config_update_notifier: "false" };
    for (const key of Object.keys(env)) {
      if (/^npm_config_(?:local_)?prefix$/i.test(key)) delete env[key];
    }
    const result = spawnSync(process.execPath, [npmCli, "config", "get", "ignore-scripts", "--userconfig", userconfig, "--logs-max=0"], {
      cwd: packageRoot,
      encoding: "utf8",
      env,
    });
    if (result.error !== undefined || result.status !== 0) {
      return { error: `npm config get ignore-scripts failed: ${result.error?.message ?? `exit ${String(result.status)}: ${result.stderr.trim()}`}` };
    }
    return { value: result.stdout.trim() };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** npm-cli.js of the running Node install, or of the npm running this script. */
export function findNpmCli(): string | undefined {
  const fromEnv = process.env["npm_execpath"];
  const candidates = [
    fromEnv !== undefined && /npm-cli\.js$/.test(fromEnv) ? fromEnv : undefined,
    join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  return candidates.find((candidate) => candidate !== undefined && existsSync(candidate));
}

export function checkDependencyPolicy(input: PolicyInput): string[] {
  const problems: string[] = [];
  const pkg = input.packageJson;
  const exception = input.exception ?? INSTALL_SCRIPT_EXCEPTION;

  if (exception.length !== 1) {
    problems.push(`the install-script exception must hold exactly one entry, found ${exception.length}; a change needs an owner decision in PRD 20`);
  }
  const allowed = exception[0];
  const isAllowed = (name: string, version: unknown) =>
    exception.length === 1 && allowed !== undefined && name === allowed.name && version === allowed.version;
  const describeException = () => (allowed === undefined ? "none" : `${allowed.name}@${allowed.version} ${allowed.script} only`);

  for (const field of RUNTIME_FIELDS) {
    const value = pkg[field];
    if (value === undefined) continue;
    const count = Array.isArray(value) ? value.length : typeof value === "object" && value !== null ? Object.keys(value).length : 1;
    if (count > 0) {
      problems.push(`package.json has a "${field}" entry; the published package must have no runtime dependencies`);
    }
  }
  const dev = pkg["devDependencies"];
  if (dev !== undefined) {
    if (typeof dev !== "object" || dev === null || Array.isArray(dev)) {
      problems.push('package.json "devDependencies" must be an object');
    } else {
      for (const [name, version] of Object.entries(dev as Record<string, unknown>)) {
        if (typeof version !== "string" || !EXACT_VERSION.test(version)) {
          problems.push(`dev dependency ${name} must use an exact version, found ${JSON.stringify(version)}`);
        }
      }
    }
  }
  for (const script of declaredScripts(pkg, INSTALL_LIFECYCLE_SCRIPTS)) {
    problems.push(`package.json declares a "${script}" script; BuildOS itself may not declare an install lifecycle script`);
  }
  // npm runs `node-gyp rebuild` as an implicit install script for the root
  // too. The root is stricter than an installed package: `gypfile: false` does
  // not excuse a root binding.gyp, because BuildOS has no native code.
  if (input.rootBindingGyp === true) {
    problems.push("the package root has a binding.gyp, which npm runs as an implicit install script (node-gyp rebuild); BuildOS itself may not declare an install lifecycle script");
  }
  if (pkg["gypfile"] === true) {
    problems.push('package.json sets "gypfile": true, which makes npm run an implicit install script (node-gyp rebuild); BuildOS itself may not declare an install lifecycle script');
  }
  // Workspace packages install as links that the installed check does not
  // walk, so the guard allows only the one root package.
  if (pkg["workspaces"] !== undefined) {
    problems.push('package.json declares "workspaces"; the dependency guard checks one root package only, so workspaces are not allowed');
  }

  if (input.lockfile !== undefined) {
    const packages = input.lockfile["packages"];
    if (typeof packages === "object" && packages !== null) {
      let allowedSeen = false;
      for (const [path, entry] of Object.entries(packages as Record<string, Record<string, unknown>>)) {
        if (path === "") {
          // The root entry mirrors package.json, checked above. npm also marks
          // it when the root has an implicit node-gyp install script.
          if (entry["hasInstallScript"] === true) problems.push('package-lock.json marks the root package with hasInstallScript; BuildOS itself may not declare an install lifecycle script');
          continue;
        }
        const name = typeof entry["name"] === "string" ? entry["name"] : nameFromPath(path);
        if (allowed !== undefined && name === allowed.name) {
          allowedSeen = true;
          if (entry["version"] !== allowed.version) {
            problems.push(`${path} is version ${JSON.stringify(entry["version"])}, but the install-script exception allows only ${allowed.name}@${allowed.version}; a version change needs an owner decision in PRD 20`);
          }
        }
        if (entry["hasInstallScript"] === true && !isAllowed(name, entry["version"])) {
          problems.push(`${path} declares an install script and is not the install-script exception (${describeException()})`);
        }
      }
      if (allowed !== undefined && !allowedSeen) {
        problems.push(`the install-script exception names ${allowed.name}@${allowed.version}, which is not in the lockfile; remove the exception with an owner decision in PRD 20`);
      }
    } else {
      problems.push("package-lock.json has no packages map");
    }
  }

  if (input.installedManifests !== undefined) {
    for (const [path, manifest] of Object.entries(input.installedManifests)) {
      const name = typeof manifest["name"] === "string" ? manifest["name"] : nameFromPath(path);
      const scripts = declaredScripts(manifest, INSTALL_LIFECYCLE_SCRIPTS);
      // npm runs `node-gyp rebuild` as an implicit install script.
      if (manifest["gypfile"] === true && !scripts.includes("install") && !scripts.includes("preinstall")) scripts.push("install (implicit node-gyp rebuild)");
      if (scripts.length === 0) continue;
      if (!isAllowed(name, manifest["version"]) || allowed === undefined) {
        problems.push(`${path}/package.json declares ${scripts.join(", ")} and is not the install-script exception (${describeException()})`);
        continue;
      }
      // The exception covers one script with one command, nothing more.
      const extra = scripts.filter((script) => script !== allowed.script);
      if (extra.length > 0) {
        problems.push(`${path}/package.json declares ${extra.join(", ")}; the install-script exception allows only ${allowed.name}@${allowed.version} ${allowed.script}`);
      }
      const command = scriptCommand(manifest, allowed.script);
      if (command !== undefined && command !== allowed.command) {
        problems.push(`${path}/package.json ${allowed.script} is ${JSON.stringify(command)}; the install-script exception allows only ${JSON.stringify(allowed.command)}`);
      }
    }
  }

  if (input.npmrc !== undefined) {
    if (input.npmrc === null) {
      problems.push(".npmrc is missing; it must set ignore-scripts=true");
    } else {
      problems.push(...checkNpmrc(input.npmrc));
    }
  }
  return problems;
}

/** Reads every installed package.json under node_modules, keyed like lockfile paths. */
export function readInstalledManifests(packageRoot: string): Record<string, Record<string, unknown>> {
  const manifests: Record<string, Record<string, unknown>> = {};
  const walk = (relDir: string) => {
    const absDir = join(packageRoot, relDir);
    if (!existsSync(absDir)) return;
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@")) {
        for (const scoped of readdirSync(join(absDir, entry.name), { withFileTypes: true })) {
          if (scoped.isDirectory()) visit(`${relDir}/${entry.name}/${scoped.name}`);
        }
      } else {
        visit(`${relDir}/${entry.name}`);
      }
    }
  };
  const visit = (relPkg: string) => {
    const manifestPath = join(packageRoot, relPkg, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
      // npm reads a binding.gyp as an implicit `node-gyp rebuild` install script.
      if (existsSync(join(packageRoot, relPkg, "binding.gyp")) && manifest["gypfile"] !== false) manifest["gypfile"] = true;
      manifests[relPkg] = manifest;
    }
    walk(`${relPkg}/node_modules`);
  };
  walk("node_modules");
  return manifests;
}
