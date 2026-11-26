// Builds and packs the package for the deny-list scan (W1 R7 P8 review round
// 2, P8-R2-03). The `invented` job of .github/workflows/buildos-deny-list.yml
// runs exactly this script, so its shell logic is tested here and not in YAML
// (test/deny-list-workflow.test.ts runs it in a clean temp folder).
//
//   node scripts/pack-for-scan.ts --out <folder> [--skip-build]
//
// Creates <folder> (and its parents) when it does not exist, refuses a
// folder that already holds files, runs the build (unless --skip-build),
// packs with `npm pack --ignore-scripts --pack-destination <folder> --json`,
// checks that the tarball npm names is in the folder, and prints
// `tarball=<path>` (also to GITHUB_OUTPUT when set).

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PACKAGE_ROOT, runNpm, writeGithubOutput } from "./release-lib.ts";

export function packForScan(input: { out: string; skipBuild?: boolean; env?: NodeJS.ProcessEnv }): string {
  const out = resolve(input.out);
  if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`the pack folder ${out} is not empty`);
  mkdirSync(out, { recursive: true });
  const env = input.env ?? process.env;
  if (input.skipBuild !== true) {
    const build = spawnSync(process.execPath, [join(PACKAGE_ROOT, "scripts", "build.ts")], { cwd: PACKAGE_ROOT, env, stdio: "inherit" });
    if (build.status !== 0) throw new Error(`the build failed (exit ${String(build.status)})`);
  }
  // A private npm cache, so the user's cache is neither read nor changed.
  const cache = mkdtempSync(join(tmpdir(), "buildos-pack-cache-"));
  let pack;
  try {
    pack = runNpm(["pack", "--ignore-scripts", "--pack-destination", out, "--json"], { cwd: PACKAGE_ROOT, env: { ...env, npm_config_cache: cache, npm_config_update_notifier: "false" } });
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
  if (pack.status !== 0) throw new Error(`npm pack failed (exit ${String(pack.status)}): ${pack.stderr.trim().split("\n").slice(-3).join(" | ")}`);
  let name: unknown;
  try {
    name = (JSON.parse(pack.stdout) as { filename?: unknown }[])[0]?.filename;
  } catch {
    throw new Error("npm pack printed no JSON");
  }
  if (typeof name !== "string" || !/^[A-Za-z0-9._-]+\.tgz$/.test(name)) throw new Error("npm pack printed no tarball name");
  const tarball = join(out, name);
  if (!existsSync(tarball) || !statSync(tarball).isFile()) throw new Error(`npm pack did not write ${tarball}`);
  return tarball;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--out");
  const out = at >= 0 ? argv[at + 1] : undefined;
  const unknown = argv.filter((a, i) => a !== "--out" && a !== "--skip-build" && argv[i - 1] !== "--out");
  if (out === undefined || out.startsWith("--") || unknown.length > 0) {
    process.stderr.write("usage: node scripts/pack-for-scan.ts --out <folder> [--skip-build]\n");
    process.exit(2);
  }
  try {
    const tarball = packForScan({ out, skipBuild: argv.includes("--skip-build") });
    process.stdout.write(`tarball=${tarball}\n`);
    writeGithubOutput({ tarball });
  } catch (error) {
    process.stderr.write(`pack-for-scan: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
