// Bundles src/cli/main.ts into one ESM file with a Node shebang, writes one
// small entry file per legacy command name next to it (`buildos-intake.js`,
// `buildos-discovery.js`, `buildos-design.js`: each passes its name and loads
// the bundle; owner decision 2026-11-24, src/cli/invocation.ts), and copies
// the `system/` package content next to it (W1 R7 P6 t11): `system/` and
// `system.json` in the bundle's folder, without `system/docs/`,
// `system/.make-docs/`, or local clutter (src/adapters/package-content.ts).
//
// A source build reports version "dev" and source revision "unknown".
// A release build sets BUILDOS_RELEASE_VERSION and BUILDOS_SOURCE_REVISION,
// and this script injects both through an esbuild define
// (scripts/release-build.ts sets them; W1 R7 P8 t6).
//
// Reproducible output (W1 R7 P8 t2): esbuild writes each input path as a
// comment relative to its working folder, so the working folder is always
// the package root (`absWorkingDir`), whatever folder the build starts in.
// Before, a build started from another folder wrote `../../..` paths that
// held the absolute path of the checkout. The esbuild options live in
// `esbuildOptions`, which the SBOM script (scripts/sbom.ts) also uses to
// find the outside packages that are really bundled.

import { build, type BuildOptions } from "esbuild";
import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listSourceContent, sha256, storedName, type ContentManifest } from "../src/adapters/package-content.ts";
import { LEGACY_NAMES, legacyEntrySource } from "../src/cli/invocation.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The repository's `system/` folder: the source of the package content. */
export const SYSTEM_SOURCE = resolve(packageRoot, "..", "..", "system");

export interface BundleOptions {
  outfile?: string;
  version?: string | undefined;
  sourceRevision?: string | undefined;
}

/** The package root (`toolkits/buildos/`). */
export const PACKAGE_ROOT = packageRoot;

/** The esbuild options of the bundle. The working folder is always the package root. */
export function esbuildOptions(options: BundleOptions = {}): BuildOptions {
  const define: Record<string, string> = {};
  if (options.version !== undefined && options.version !== "") {
    define["__BUILDOS_VERSION__"] = JSON.stringify(options.version);
  }
  if (options.sourceRevision !== undefined && options.sourceRevision !== "") {
    define["__BUILDOS_SOURCE_REVISION__"] = JSON.stringify(options.sourceRevision);
  }
  return {
    absWorkingDir: packageRoot,
    entryPoints: [join(packageRoot, "src", "cli", "main.ts")],
    outfile: options.outfile ?? join(packageRoot, "dist", "buildos.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    banner: { js: "#!/usr/bin/env node" },
    define,
    legalComments: "inline",
    logLevel: "warning",
  };
}

export async function bundle(options: BundleOptions = {}): Promise<string> {
  const outfile = options.outfile ?? join(packageRoot, "dist", "buildos.js");
  await build(esbuildOptions({ ...options, outfile }));
  chmodSync(outfile, 0o755);
  writeLegacyEntries(outfile);
  copyPackageContent(dirname(outfile));
  return outfile;
}

/** Writes `<name>.js` next to `outfile` for each legacy name. Returns their paths. */
export function writeLegacyEntries(outfile: string): string[] {
  const out: string[] = [];
  for (const name of LEGACY_NAMES.keys()) {
    const entry = join(dirname(outfile), `${name}.js`);
    if (resolve(entry) === resolve(outfile)) throw new Error(`the bundle may not be named ${basename(outfile)}: a legacy entry file has that name`);
    writeFileSync(entry, legacyEntrySource(name, basename(outfile)));
    chmodSync(entry, 0o755);
    out.push(entry);
  }
  return out;
}

/** Copies the package content into `<outDir>/system/` and writes `<outDir>/system.json`. Returns the manifest. */
export function copyPackageContent(outDir: string, systemDir: string = SYSTEM_SOURCE): ContentManifest {
  const target = join(outDir, "system");
  rmSync(target, { recursive: true, force: true });
  const manifest: ContentManifest = { schema_version: 1, files: [] };
  for (const file of listSourceContent(systemDir)) {
    const stored = storedName(file.path);
    const destination = join(target, ...stored.split("/"));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file.source, destination);
    chmodSync(destination, file.mode);
    manifest.files.push({ path: file.path, stored, mode: file.mode, sha256: sha256(new Uint8Array(readFileSync(destination))) });
  }
  writeFileSync(join(outDir, "system.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await bundle({
    version: process.env["BUILDOS_RELEASE_VERSION"],
    sourceRevision: process.env["BUILDOS_SOURCE_REVISION"],
  });
}
