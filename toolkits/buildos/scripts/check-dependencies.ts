// CI guard: fails when package.json gains a runtime dependency, a dev
// dependency without an exact version, an install script, a root binding.gyp
// (an implicit node-gyp install script), or workspaces; when a lockfile
// or installed package other than the closed esbuild exception declares an
// install script; when esbuild's version leaves the exception; or when
// .npmrc does not set ignore-scripts=true as the effective top-level value.
// It also asks npm for the effective value from this folder, with an empty
// user config, so a setting that npm does not read as true fails here too.
//
// Usage: node scripts/check-dependencies.ts [--installed]
// Without --installed it checks only files in the repository, so CI runs it
// before `npm ci`. With --installed it also requires node_modules and checks
// every installed manifest, so CI runs it again after `npm ci --ignore-scripts`.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDependencyPolicy, npmEffectiveIgnoreScripts, readInstalledManifests } from "./dependency-policy.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const installed = process.argv.includes("--installed");
const readJson = (name: string) => JSON.parse(readFileSync(join(packageRoot, name), "utf8")) as Record<string, unknown>;
const npmrcPath = join(packageRoot, ".npmrc");

const problems: string[] = [];
if (installed && !existsSync(join(packageRoot, "node_modules"))) {
  problems.push("--installed was given, but node_modules is missing");
}
problems.push(
  ...checkDependencyPolicy({
    packageJson: readJson("package.json"),
    lockfile: readJson("package-lock.json"),
    npmrc: existsSync(npmrcPath) ? readFileSync(npmrcPath, "utf8") : null,
    rootBindingGyp: existsSync(join(packageRoot, "binding.gyp")),
    installedManifests: installed ? readInstalledManifests(packageRoot) : undefined,
  }),
);
const effective = npmEffectiveIgnoreScripts(packageRoot);
if (effective.error !== undefined) {
  problems.push(`could not confirm ignore-scripts with npm: ${effective.error}`);
} else if (effective.value !== "true") {
  problems.push(`npm reads ignore-scripts as ${JSON.stringify(effective.value)} in ${packageRoot}; it must be "true"`);
}
if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`dependency policy: ${problem}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`dependency policy: ok${installed ? " (lockfile, .npmrc, npm ignore-scripts, and installed manifests)" : " (lockfile, .npmrc, and npm ignore-scripts)"}\n`);
}
