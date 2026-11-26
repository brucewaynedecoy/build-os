// The reserved-name placeholder for the first publication (W1 R7 P8 t1;
// owner decision 2026-11-24, option A). npm configures a trusted publisher
// only for a package that exists, so the maintainer first stages and
// approves this placeholder by hand; see toolkits/buildos/AGENTS.md, First
// Publication. This script only builds and packs it. It never publishes or
// stages anything.
//
//   node scripts/reserved-placeholder.ts --out <new or empty folder outside the repository>
//
// The out folder must not exist or must be empty (P8-R2-07). The package is
// built and packed in a private temporary folder; the tarball must hold
// exactly the three expected regular files with the expected content before
// it is copied to the out folder and the staging line is printed.
//
// The placeholder holds three files and no code: a package.json with no
// `bin`, no `scripts`, and no dependencies; a README that says the version
// only reserves the name; and the package LICENSE. Prints the tarball path,
// its SHA-256, and its file list, for the maintainer to inspect before
// staging.

import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertOutsideRepository } from "./release-candidate.ts";
import { PACKAGE_NAME, PACKAGE_ROOT, readPackageIdentity, readTarball, REPO_ROOT, runNpm, sha256, sha256File } from "./release-lib.ts";

export const PLACEHOLDER_VERSION = "0.0.0-reserved.0";
/** The dist-tag the placeholder is staged with: never `latest`. npm 11 refuses a prerelease without an explicit tag. */
export const PLACEHOLDER_DIST_TAG = "reserved";

export const PLACEHOLDER_README = `# ${PACKAGE_NAME} ${PLACEHOLDER_VERSION}

This version only reserves the package name. It holds no program and does nothing.

Install BuildOS 0.1.0 or newer: \`npx -y ${PACKAGE_NAME}@latest init\`.
`;

/** The placeholder's package.json: no bin, no scripts, no dependencies; the repository URL of the real package (npm compares it case-sensitively). */
export function placeholderPackageJson(): Record<string, unknown> {
  const { repositoryUrl } = readPackageIdentity();
  return {
    name: PACKAGE_NAME,
    version: PLACEHOLDER_VERSION,
    description: "Reserved name for BuildOS. Not for use: install 0.1.0 or newer.",
    license: "Apache-2.0",
    repository: { type: "git", url: repositoryUrl, directory: "toolkits/buildos" },
    files: ["README.md", "LICENSE"],
  };
}

/** The three files of the placeholder tarball and their exact bytes. */
export function placeholderFiles(): Record<string, Buffer> {
  return {
    "package/LICENSE": readFileSync(join(PACKAGE_ROOT, "LICENSE")),
    "package/README.md": Buffer.from(PLACEHOLDER_README, "utf8"),
    "package/package.json": Buffer.from(`${JSON.stringify(placeholderPackageJson(), null, 2)}\n`, "utf8"),
  };
}

/**
 * Problems with a packed placeholder (W1 R7 P8 review round 2, P8-R2-07): it
 * must hold exactly the three expected regular files, each with the expected
 * SHA-256. npm may rewrite package.json when it packs, so that file is
 * compared as parsed JSON with the expected object.
 */
export function placeholderTarballProblems(bytes: Uint8Array): string[] {
  let read;
  try {
    read = readTarball(bytes);
  } catch (error) {
    return [`the placeholder tarball cannot be read: ${(error as Error).message}`];
  }
  const want = placeholderFiles();
  const problems: string[] = [];
  const files = read.entries.filter((e) => e.type === "file").map((e) => e.path).sort();
  if (read.entries.some((e) => e.type !== "file")) problems.push("the placeholder tarball holds an entry that is not a regular file");
  if (JSON.stringify(files) !== JSON.stringify(Object.keys(want).sort())) problems.push(`the placeholder tarball holds ${files.join(", ")}, not exactly ${Object.keys(want).sort().join(", ")}`);
  for (const [path, body] of Object.entries(want)) {
    const got = read.files.get(path);
    if (got === undefined) continue;
    if (path === "package/package.json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(got.toString("utf8"));
      } catch {
        parsed = undefined;
      }
      if (JSON.stringify(parsed) !== JSON.stringify(placeholderPackageJson())) problems.push("the placeholder package.json is not the expected one");
    } else if (sha256(new Uint8Array(got)) !== sha256(new Uint8Array(body))) problems.push(`${path} does not have the expected SHA-256`);
  }
  return problems;
}

/**
 * Builds the placeholder in a private temporary folder, packs it there,
 * checks the tarball, and only then copies the tarball into `out`, which must
 * not exist yet or be an empty folder (P8-R2-07: a reused folder could add
 * stray files to the pack, or hold an older tarball).
 */
export function buildPlaceholder(out: string): { tarball: string; sha256: string; files: string[] } {
  if (existsSync(out)) {
    if (!lstatSync(out).isDirectory()) throw new Error(`${out} is not a folder`);
    if (readdirSync(out).length > 0) throw new Error(`${out} is not empty; give a new or empty folder`);
  }
  const work = mkdtempSync(join(tmpdir(), "buildos-reserved-work-"));
  try {
    const pkgDir = join(work, "package");
    mkdirSync(pkgDir);
    for (const [path, body] of Object.entries(placeholderFiles())) writeFileSync(join(work, path), body);
    const packDir = join(work, "pack");
    mkdirSync(packDir);
    const env = { ...process.env, npm_config_cache: join(work, "npm-cache"), npm_config_ignore_scripts: "true", npm_config_update_notifier: "false" };
    const run = runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", packDir], { cwd: pkgDir, env });
    if (run.status !== 0) throw new Error(`npm pack failed (exit ${String(run.status)}): ${run.stderr.trim()}`);
    const name = (JSON.parse(run.stdout) as { filename: string }[])[0]?.filename;
    if (name === undefined || readdirSync(packDir).join() !== name) throw new Error("npm pack did not write exactly one tarball");
    const bytes = new Uint8Array(readFileSync(join(packDir, name)));
    const problems = placeholderTarballProblems(bytes);
    if (problems.length > 0) throw new Error(problems.join("; "));
    mkdirSync(out, { recursive: true });
    const tarball = join(out, name);
    writeFileSync(tarball, bytes, { flag: "wx" });
    const files = readTarball(bytes).entries.map((e) => e.path).sort();
    return { tarball, sha256: sha256File(tarball), files };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const outIndex = argv.indexOf("--out");
  const out = resolve(outIndex >= 0 && argv[outIndex + 1] !== undefined ? (argv[outIndex + 1] as string) : join(mkdtempSync(join(tmpdir(), "buildos-reserved-")), "out"));
  if (argv.some((a, i) => a !== "--out" && argv[i - 1] !== "--out")) {
    process.stderr.write("usage: node scripts/reserved-placeholder.ts [--out <new or empty folder outside the repository>]\n");
    process.exit(2);
  }
  try {
    assertOutsideRepository(join(out, "placeholder"), REPO_ROOT, "the placeholder is built only outside the repository");
    const r = buildPlaceholder(out);
    process.stdout.write(`reserved placeholder: ${r.tarball}\nSHA-256 ${r.sha256}\nfiles (exactly these three, checked): ${r.files.join(", ")}\nstage it only by hand, with: npm stage publish <tarball> --access public --tag ${PLACEHOLDER_DIST_TAG} (see AGENTS.md, First Publication)\n`);
  } catch (error) {
    process.stderr.write(`reserved placeholder: ${(error as Error).message}\n`);
    process.exit(1);
  }
}
