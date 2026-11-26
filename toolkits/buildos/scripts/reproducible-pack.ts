// Reproducible pack check (W1 R7 P8 t2). Runs the release build twice, each
// from an empty dist/, packs each, and compares the two tarballs' SHA-256.
//
//   node scripts/release-build.ts is what each round runs; this script:
//   node scripts/reproducible-pack.ts [--manifest <file>] [--allow-dirty]
//   node scripts/reproducible-pack.ts --compare <manifest> <manifest>...
//       Compares manifests from several operating systems with the first one
//       and prints each difference. Report only: it exits 0, because byte
//       identity is claimed on the reference environment only.
//
// Exit 0 when both tarballs have the same bytes, 1 when they differ (it then
// names every file whose content, mode, or order differs). With --manifest
// it writes the tarball's content list (path, type, mode, size, SHA-256 of
// each entry, the tarball SHA-256, and the gzip header bytes), which the CI
// job compares across operating systems.
//
// What makes the bytes the same (see the P8 evidence, Reproducibility):
// npm pack writes every entry with the fixed time 1985-10-26T08:15:00Z, no
// owner, and a sorted file list; the bundle's version and source revision
// come from package.json and git, never from a clock; esbuild runs with the
// package root as its working folder, so no absolute path enters the
// bundle; dist/system.json lists files in a fixed order; .gitattributes
// checks `system/` out with LF on every OS. Byte identity is claimed on the
// reference build environment only (scripts/release-lib.ts: runner image,
// Node, npm), because gzip output can differ between zlib builds.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { releaseBuild } from "./release-build.ts";
import { readTarball, type TarEntry } from "./release-lib.ts";

export interface PackManifest {
  tarball_sha256: string;
  version: string;
  source_revision: string;
  node_version: string;
  npm_version: string;
  platform: string;
  /** The 10-byte gzip header, hex: its OS byte can differ by zlib build. */
  gzip_header: string;
  entries: TarEntry[];
}

export function packManifest(tarball: string, build: { tarball_sha256: string; version: string; source_revision: string; node_version: string; npm_version: string }): PackManifest {
  const bytes = new Uint8Array(readFileSync(tarball));
  return {
    tarball_sha256: build.tarball_sha256,
    version: build.version,
    source_revision: build.source_revision,
    node_version: build.node_version,
    npm_version: build.npm_version,
    platform: `${process.platform}-${process.arch}`,
    gzip_header: Buffer.from(bytes.subarray(0, 10)).toString("hex"),
    entries: readTarball(bytes).entries,
  };
}

/** Lines naming each entry that differs between two manifests (content, mode, size, order, or presence). */
export function manifestDifferences(a: PackManifest, b: PackManifest, options: { modes?: boolean } = {}): string[] {
  const out: string[] = [];
  const byPath = (m: PackManifest) => new Map(m.entries.map((e, i) => [e.path, { ...e, index: i }]));
  const left = byPath(a);
  const right = byPath(b);
  for (const [path, e] of left) {
    const o = right.get(path);
    if (o === undefined) out.push(`${path}: only in the first`);
    else {
      if (e.sha256 !== o.sha256 || e.size !== o.size) out.push(`${path}: content differs`);
      if (options.modes !== false && e.mode !== o.mode) out.push(`${path}: mode ${e.mode.toString(8)} against ${o.mode.toString(8)}`);
      if (e.index !== o.index) out.push(`${path}: position ${e.index} against ${o.index}`);
    }
  }
  for (const path of right.keys()) if (!left.has(path)) out.push(`${path}: only in the second`);
  if (a.gzip_header !== b.gzip_header) out.push(`gzip header ${a.gzip_header} against ${b.gzip_header}`);
  return out;
}

const argv = process.argv.slice(2);
const manifestIndex = argv.indexOf("--manifest");
const manifestFile = manifestIndex >= 0 ? argv[manifestIndex + 1] : undefined;
const allowDirty = argv.includes("--allow-dirty");
const compareIndex = argv.indexOf("--compare");
if (process.argv[1] !== undefined && resolve(process.argv[1]).endsWith("reproducible-pack.ts") && compareIndex >= 0) {
  const files = argv.slice(compareIndex + 1);
  const manifests = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as PackManifest);
  const [base, ...rest] = manifests;
  if (base === undefined || rest.length === 0) {
    process.stdout.write("reproducible pack --compare: needs two or more manifests\n");
    process.exitCode = 2;
  } else {
    for (const m of manifests) process.stdout.write(`${m.platform}: tarball ${m.tarball_sha256}, ${m.entries.length} entries, Node ${m.node_version}, npm ${m.npm_version}\n`);
    for (const other of rest) {
      const contentOnly = manifestDifferences(base, other, { modes: false }).filter((d) => !d.startsWith("gzip header"));
      const all = manifestDifferences(base, other);
      const same = base.tarball_sha256 === other.tarball_sha256;
      process.stdout.write(`${base.platform} against ${other.platform}: tarball bytes ${same ? "identical" : "differ"}; file contents ${contentOnly.length === 0 ? "identical" : "differ"}\n`);
      for (const d of all) process.stdout.write(`  ${d}\n`);
      if (!same) process.stdout.write(`::warning title=Cross-OS pack::${base.platform} and ${other.platform} tarballs differ (${all.length} difference(s)); byte identity is claimed on the reference environment only\n`);
    }
  }
} else if (process.argv[1] !== undefined && resolve(process.argv[1]).endsWith("reproducible-pack.ts")) {
  const scratch = mkdtempSync(join(tmpdir(), "buildos-repro-"));
  try {
    const first = await releaseBuild({ out: join(scratch, "first"), allowDirty });
    const second = await releaseBuild({ out: join(scratch, "second"), allowDirty });
    process.stdout.write(`reproducible pack: first  ${first.tarball_sha256}\nreproducible pack: second ${second.tarball_sha256}\n`);
    const a = packManifest(first.tarball, first);
    const b = packManifest(second.tarball, second);
    if (manifestFile !== undefined) writeFileSync(resolve(manifestFile), `${JSON.stringify(a, null, 2)}\n`);
    if (first.tarball_sha256 !== second.tarball_sha256) {
      process.stdout.write(`reproducible pack: FAIL: two clean builds of one commit gave different tarballs:\n  ${manifestDifferences(a, b).join("\n  ")}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(`reproducible pack: pass: ${a.entries.length} entries, version ${first.version}, revision ${first.source_revision}, Node ${first.node_version}, npm ${first.npm_version}, ${a.platform}\n`);
    }
  } catch (error) {
    process.stdout.write(`reproducible pack: FAIL: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
