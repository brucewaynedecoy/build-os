// CycloneDX SBOM of the BuildOS package (W1 R7 P8 t5; PRD 20 Release).
//
//   node scripts/sbom.ts --tarball <file> --revision <commit> --out <file>
//
// Why not plain `npm sbom`: BuildOS has no runtime `dependencies`. esbuild
// bundles `fflate`, `parse5`, `entities`, and `unpdf` (with the pdf.js build
// inside it) into dist/buildos.js, and the bundle also holds TypeScript ports
// of Go code. `npm sbom --omit dev` lists no component at all, and plain
// `npm sbom` lists every package of the lockfile as a development package,
// the build tools and the platform packages too, without saying which code
// ships. Either form would mislead a reviewer.
//
// So this script starts from `npm sbom --sbom-format cyclonedx
// --package-lock-only` (npm makes the document, CycloneDX 1.5, from the
// lockfile, with each package's license, SHA-512, and registry URL) and then:
//
// - marks each package that the esbuild metafile shows in the bundle with
//   scope `required` and the property `buildos:delivery` = bundled, and
//   every other lockfile package (build-time tools, platform packages) with
//   scope `excluded` (CycloneDX: not part of the runtime) and
//   `buildos:delivery` = build-time only;
// - adds pdf.js 6.4.299 as a component inside `unpdf`, with the six
//   third-party components that pdf.js inlines, and the three Go sources
//   whose code is ported into the bundle (no Go code ships);
// - describes the package itself in `metadata.component` with the tarball
//   SHA-256 and the source revision;
// - replaces npm's random serial number and clock time stamp with values
//   from the tarball digest and the commit time, so the same commit gives
//   the same SBOM.
//
// `sbomProblems` validates the result against the official CycloneDX 1.5
// JSON schema (vendored in scripts/schemas/cyclonedx-1.5/, validated by
// scripts/json-schema.ts) and compares values (review round 2, P8-D-08):
// each SHA-512 against the lockfile integrity, and each package's version and
// license across the SBOM, the lockfile, the SECURITY.md tables (Bundled npm
// Packages and Lockfile Inventory, and the package counts), and
// THIRD_PARTY_NOTICES.md; the bundle (esbuild metafile) decides the scope;
// test/release.test.ts and test/sbom-schema.test.ts run it on every CI run.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { esbuildOptions } from "./build.ts";
import { cyclonedxSchemaProblems } from "./json-schema.ts";
import { git, PACKAGE_NAME, PACKAGE_ROOT, readPackageIdentity, runNpm, sha256File } from "./release-lib.ts";

export const DELIVERY = "buildos:delivery";
export const BUNDLED = "bundled into dist/buildos.js";
export const BUILD_ONLY = "build-time only; not in the package";
export const PORTED = "ported to TypeScript and bundled into dist/buildos.js; no Go code ships";

/** The third-party code inside the pdf.js build (SECURITY.md Components Inside pdf.js). */
export const PDFJS_INNER = [
  { name: "Brotli decoder", security: "Brotli decoder (Google)", license: { id: "MIT" } },
  { name: "OpenJPEG decoder loader", security: "OpenJPEG decoder loader", license: { id: "BSD-2-Clause" } },
  { name: "JBIG2 decoder loader", security: "JBIG2 decoder loader (PDFium)", license: { id: "Apache-2.0" } },
  { name: "qcms color management loader", security: "qcms color management loader", license: { id: "MIT" } },
  { name: "Emscripten runtime glue", security: "Emscripten runtime glue", license: { expression: "MIT OR NCSA" } },
  { name: "wasm-bindgen glue", security: "wasm-bindgen glue", license: { expression: "MIT OR Apache-2.0" } },
] as const;

export const PDFJS_VERSION = "6.4.299";

/** Go sources whose code is ported into the bundle (SECURITY.md Other Bundled Code). */
export const GO_PORTS = [
  { name: "Go standard library", version: "1.24.1", purl: "pkg:generic/go@1.24.1?download_url=https://go.dev/dl/" },
  { name: "golang.org/x/net", version: "v0.48.0", purl: "pkg:golang/golang.org/x/net@v0.48.0" },
  { name: "github.com/ledongthuc/pdf", version: "v0.0.0-20250511090121-5959a4027728", purl: "pkg:golang/github.com/ledongthuc/pdf@v0.0.0-20250511090121-5959a4027728" },
] as const;

type Json = Record<string, unknown>;
export interface Sbom extends Json {
  bomFormat: string;
  specVersion: string;
  serialNumber: string;
  metadata: Json;
  components: Json[];
}

/** The npm package names whose code esbuild puts in the bundle, with their bytes in the output. */
export async function bundledPackages(): Promise<Map<string, number>> {
  const built = await build({ ...esbuildOptions(), write: false, metafile: true, logLevel: "silent" });
  const out = new Map<string, number>();
  for (const output of Object.values(built.metafile.outputs)) {
    for (const [path, input] of Object.entries(output.inputs)) {
      const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path.replace(/\\/g, "/"));
      if (match?.[1] !== undefined && input.bytesInOutput > 0) out.set(match[1], (out.get(match[1]) ?? 0) + input.bytesInOutput);
    }
  }
  return out;
}

/** A UUID (version 5 layout) from a SHA-256 of the given text. */
export function stableUuid(text: string): string {
  const h = createHash("sha256").update(text).digest("hex").slice(0, 32).split("");
  h[12] = "5";
  h[16] = ((parseInt(h[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** The commit time of a revision (a `-dirty` suffix is ignored), in UTC. */
export function commitTime(revision: string): string {
  const commit = revision.replace(/-dirty$/, "");
  return new Date(git(["show", "-s", "--format=%cI", commit])).toISOString().replace(/\.\d{3}Z$/, "Z");
}

const property = (name: string, value: string) => ({ name, value });

/**
 * The CycloneDX 1.5 `licenses` value of one license: `[{ license: { id } }]`
 * for an SPDX license ID, or `[{ expression }]` (a tuple of exactly one item)
 * for an SPDX license expression. An expression never goes inside `license`
 * (W1 R7 P8 review round 1, P8-R1-05: the schema refuses that).
 */
export function licenseChoice(license: { id: string } | { expression: string }): Json[] {
  return "id" in license ? [{ license: { id: license.id } }] : [{ expression: license.expression }];
}

export async function generateSbom(input: { tarballSha256: string; revision: string }): Promise<Sbom> {
  const run = runNpm(["sbom", "--sbom-format", "cyclonedx", "--package-lock-only"], { cwd: PACKAGE_ROOT });
  if (run.status !== 0) throw new Error(`npm sbom failed (exit ${String(run.status)}): ${run.stderr.trim()}`);
  const sbom = JSON.parse(run.stdout) as Sbom;
  const bundled = await bundledPackages();
  const { version } = readPackageIdentity();

  for (const component of sbom.components) {
    const name = String(component["name"]);
    const isBundled = bundled.has(name);
    const properties = ((component["properties"] as Json[] | undefined) ?? []).filter((p) => p["name"] !== "cdx:npm:package:development");
    properties.push(property(DELIVERY, isBundled ? BUNDLED : BUILD_ONLY));
    component["properties"] = properties;
    component["scope"] = isBundled ? "required" : "excluded";
    if (name === "unpdf") {
      component["components"] = [
        {
          "bom-ref": `pdf.js@${PDFJS_VERSION}`,
          type: "library",
          name: "pdf.js",
          version: PDFJS_VERSION,
          scope: "required",
          purl: `pkg:github/mozilla/pdf.js@v${PDFJS_VERSION}`,
          licenses: [{ license: { id: "Apache-2.0" } }],
          description: "The pdf.js build inside unpdf/dist/pdfjs.mjs",
          properties: [property(DELIVERY, BUNDLED)],
          components: PDFJS_INNER.map((inner) => ({
            "bom-ref": `pdf.js@${PDFJS_VERSION}/${inner.name}`,
            type: "library",
            name: inner.name,
            scope: "required",
            licenses: licenseChoice(inner.license),
            description: `Inlined by pdf.js ${PDFJS_VERSION} (see SECURITY.md, Components Inside pdf.js)`,
            properties: [property(DELIVERY, BUNDLED)],
          })),
        },
      ];
    }
  }
  for (const go of GO_PORTS) {
    sbom.components.push({
      "bom-ref": `${go.name}@${go.version}`,
      type: "library",
      name: go.name,
      version: go.version,
      scope: "required",
      purl: go.purl,
      licenses: [{ license: { id: "BSD-3-Clause" } }],
      description: "Go code ported to TypeScript for byte-for-byte output parity (see SECURITY.md, Other Bundled Code)",
      properties: [property(DELIVERY, PORTED)],
    });
  }

  const metadata = sbom.metadata;
  const main = (metadata["component"] ?? {}) as Json;
  main["name"] = PACKAGE_NAME;
  main["version"] = version;
  main["hashes"] = [{ alg: "SHA-256", content: input.tarballSha256 }];
  main["properties"] = [property("buildos:source_revision", input.revision), property("buildos:tarball", `${PACKAGE_NAME}@${version} npm tarball`)];
  metadata["component"] = main;
  metadata["timestamp"] = commitTime(input.revision);
  metadata["properties"] = [
    property("buildos:scope-rule", "scope required: code in the package; scope excluded: a lockfile package used only to build or test BuildOS (CycloneDX: not part of the runtime)"),
  ];
  sbom.serialNumber = `urn:uuid:${stableUuid(`${input.tarballSha256}\n${input.revision}`)}`;
  return sbom;
}

const delivery = (c: Json) => ((c["properties"] as Json[] | undefined) ?? []).find((p) => p["name"] === DELIVERY)?.["value"];
const licenseText = (c: Json) =>
  ((c["licenses"] as Json[] | undefined) ?? []).map((l) => {
    const lic = l["license"] as Json | undefined;
    return String(lic?.["id"] ?? l["expression"] ?? lic?.["expression"] ?? "");
  });

/** The hex SHA-512 of an npm integrity value (`sha512-<base64>`), or undefined. */
export function integrityHex(integrity: unknown): string | undefined {
  if (typeof integrity !== "string") return undefined;
  const m = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity.split(/\s+/).find((part) => part.startsWith("sha512-")) ?? "");
  return m?.[1] === undefined ? undefined : Buffer.from(m[1], "base64").toString("hex");
}

/** The body rows of the first Markdown table after a heading, as trimmed cells. */
export function markdownTable(text: string, heading: string): string[][] {
  const start = text.indexOf(`${heading}\n`);
  if (start < 0) return [];
  const lines = text.slice(start).split("\n");
  const first = lines.findIndex((l) => l.startsWith("| "));
  if (first < 0) return [];
  const rows: string[][] = [];
  for (const line of lines.slice(first + 2)) {
    if (!line.startsWith("| ")) break;
    rows.push(line.slice(2, -2).split(" | ").map((c) => c.trim()));
  }
  return rows;
}

/** Every way the SBOM misdescribes the package. Empty when it is accurate. */
export async function sbomProblems(
  sbom: Sbom,
  sources: { security?: string; notices?: string; lock?: Json; bundled?: Map<string, number> } = {},
): Promise<string[]> {
  const security = sources.security ?? readFileSync(join(PACKAGE_ROOT, "SECURITY.md"), "utf8");
  const notices = sources.notices ?? readFileSync(join(PACKAGE_ROOT, "THIRD_PARTY_NOTICES.md"), "utf8");
  const lock = sources.lock ?? (JSON.parse(readFileSync(join(PACKAGE_ROOT, "package-lock.json"), "utf8")) as Json);
  const bundled = sources.bundled ?? (await bundledPackages());
  const problems: string[] = [];
  // The Bundled npm Packages table only, not the lockfile inventory below it.
  const bundledStart = security.indexOf("### Bundled npm Packages");
  const bundledTable = bundledStart < 0 ? "" : security.slice(bundledStart, security.indexOf("\n### ", bundledStart + 1));
  if (sbom.bomFormat !== "CycloneDX") problems.push("bomFormat is not CycloneDX");
  // The official CycloneDX 1.5 JSON schema, vendored (scripts/schemas/cyclonedx-1.5/SOURCES.json).
  problems.push(...cyclonedxSchemaProblems(sbom));

  const packages = Object.entries((lock["packages"] as Record<string, Json>) ?? {}).filter(([path]) => path !== "");
  const npmComponents = sbom.components.filter((c) => String(c["purl"] ?? "").startsWith("pkg:npm/"));
  for (const [path, entry] of packages) {
    const name = path.replace(/^.*node_modules\//, "");
    const component = npmComponents.find((c) => c["name"] === name && c["version"] === entry["version"]);
    if (component === undefined) {
      problems.push(`lockfile package ${name}@${String(entry["version"])} is not in the SBOM`);
      continue;
    }
    if (typeof entry["license"] === "string" && !licenseText(component).includes(entry["license"])) problems.push(`${name}: SBOM license ${licenseText(component).join(",")} is not the lockfile license ${entry["license"]}`);
    const wantBundled = bundled.has(name);
    if (wantBundled !== (delivery(component) === BUNDLED) || (component["scope"] === "required") !== wantBundled) {
      problems.push(`${name}: the SBOM says ${String(delivery(component))} (scope ${String(component["scope"])}), but the bundle ${wantBundled ? "holds" : "does not hold"} it`);
    }
  }
  if (npmComponents.length !== packages.length) problems.push(`the SBOM lists ${npmComponents.length} npm packages, the lockfile ${packages.length}`);

  // Values, not presence (W1 R7 P8 review round 2, P8-D-08): every SBOM hash equals the lockfile integrity,
  // and the version and license of every package agree across the SBOM, the lockfile, SECURITY.md, and the notices.
  for (const [path, entry] of packages) {
    const name = path.replace(/^.*node_modules\//, "");
    const component = npmComponents.find((c) => c["name"] === name && c["version"] === entry["version"]);
    if (component === undefined) continue;
    const want = integrityHex(entry["integrity"]);
    const hashes = ((component["hashes"] as Json[] | undefined) ?? []).filter((h) => h["alg"] === "SHA-512");
    if (want === undefined) problems.push(`lockfile package ${name} has no SHA-512 integrity`);
    else if (hashes.length !== 1 || hashes[0]?.["content"] !== want) problems.push(`${name}: the SBOM SHA-512 is not the lockfile integrity value`);
  }
  const inventory = markdownTable(security, "## Lockfile Inventory");
  for (const [path, entry] of packages) {
    const name = path.replace(/^.*node_modules\//, "");
    const row = inventory.find((r) => r[0] === `\`${name}\``);
    if (row === undefined) problems.push(`SECURITY.md Lockfile Inventory has no row for ${name}`);
    else {
      if (row[1] !== entry["version"]) problems.push(`SECURITY.md Lockfile Inventory gives ${name} version ${String(row[1])}, the lockfile ${String(entry["version"])}`);
      // A note after the identifier ("MIT (bundled pdf.js: Apache-2.0)") is allowed; the identifier must match.
      if ((row[2] ?? "").split(/[;(]/)[0]?.trim() !== entry["license"]) problems.push(`SECURITY.md Lockfile Inventory gives ${name} license ${String(row[2])}, the lockfile ${String(entry["license"])}`);
    }
  }
  if (inventory.length !== packages.length) problems.push(`SECURITY.md Lockfile Inventory has ${inventory.length} rows, the lockfile ${packages.length} packages`);
  if (!security.includes(`any of the ${packages.length} lockfile packages`)) problems.push(`SECURITY.md does not state the lockfile package count ${packages.length} in its scan summary`);
  const buildOnly = packages.length - [...bundled.keys()].filter((n) => packages.some(([p]) => p.replace(/^.*node_modules\//, "") === n)).length;
  if (!security.includes(`${buildOnly} more lockfile packages are build-time only`)) problems.push(`SECURITY.md does not state ${buildOnly} build-time-only lockfile packages`);

  const bundledRows = markdownTable(security, "### Bundled npm Packages");
  for (const name of bundled.keys()) {
    const component = npmComponents.find((c) => c["name"] === name);
    const v = String(component?.["version"] ?? "");
    if (component === undefined) continue;
    const lockLicense = licenseText(component)[0] ?? "";
    const row = bundledRows.find((r) => r[0] === `\`${name}\``);
    if (row === undefined || row[1] !== v) problems.push(`SECURITY.md has no Bundled npm Packages row for ${name} ${v}`);
    else if ((row[2] ?? "").split(/[;(]/)[0]?.trim() !== lockLicense) problems.push(`SECURITY.md Bundled npm Packages gives ${name} license ${String(row[2])}, the SBOM and lockfile ${lockLicense}`);
    const at = notices.indexOf(`## npm Package: \`${name}\` ${v}\n`);
    if (at < 0) problems.push(`THIRD_PARTY_NOTICES.md has no notice for ${name} ${v}`);
    else {
      const license = /\n- License: ([^.\n]+)\./.exec(notices.slice(at, notices.indexOf("\n## ", at + 1) < 0 ? undefined : notices.indexOf("\n## ", at + 1)))?.[1];
      if (license !== lockLicense) problems.push(`THIRD_PARTY_NOTICES.md gives ${name} license ${String(license)}, the SBOM and lockfile ${lockLicense}`);
    }
  }

  const unpdf = sbom.components.find((c) => c["name"] === "unpdf");
  const pdfjs = ((unpdf?.["components"] as Json[] | undefined) ?? []).find((c) => c["name"] === "pdf.js");
  if (pdfjs === undefined) problems.push("the SBOM has no pdf.js component inside unpdf");
  else {
    if (!notices.includes(`## npm Package: pdf.js (Mozilla), inside \`unpdf\``) || !security.includes(`pdf.js ${PDFJS_VERSION}`)) problems.push(`SECURITY.md or THIRD_PARTY_NOTICES.md does not name pdf.js ${PDFJS_VERSION}`);
    const inner = (pdfjs["components"] as Json[] | undefined) ?? [];
    for (const want of PDFJS_INNER) {
      if (!inner.some((c) => c["name"] === want.name)) problems.push(`the SBOM has no ${want.name} inside pdf.js`);
      if (!notices.includes(`## Component inside pdf.js: ${want.name}`)) problems.push(`THIRD_PARTY_NOTICES.md has no notice for ${want.name}`);
      if (!security.includes(`| ${want.security} |`)) problems.push(`SECURITY.md does not name ${want.name}`);
    }
    if (inner.length !== PDFJS_INNER.length) problems.push(`the SBOM lists ${inner.length} components inside pdf.js, SECURITY.md ${PDFJS_INNER.length}`);
  }
  for (const go of GO_PORTS) {
    if (!sbom.components.some((c) => c["name"] === go.name && c["version"] === go.version && delivery(c) === PORTED)) problems.push(`the SBOM has no ported-code component ${go.name} ${go.version}`);
    const label = go.name === "Go standard library" ? "Go 1.24.1" : go.name;
    if (!notices.includes(label) || !security.includes(label)) problems.push(`SECURITY.md or THIRD_PARTY_NOTICES.md does not name ${label}`);
  }
  const main = sbom.metadata["component"] as Json | undefined;
  if (main?.["name"] !== PACKAGE_NAME) problems.push(`metadata.component is not ${PACKAGE_NAME}`);
  if (!/^urn:uuid:[0-9a-f-]{36}$/.test(sbom.serialNumber)) problems.push("serialNumber is not a UUID URN");
  return problems;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const tarball = get("--tarball");
  const revision = get("--revision");
  const out = get("--out");
  if (tarball === undefined || revision === undefined || out === undefined) {
    process.stderr.write("usage: node scripts/sbom.ts --tarball <file> --revision <commit> --out <file>\n");
    process.exit(2);
  }
  const sbom = await generateSbom({ tarballSha256: sha256File(tarball), revision });
  writeFileSync(out, `${JSON.stringify(sbom, null, 2)}\n`);
  const problems = await sbomProblems(sbom);
  for (const p of problems) process.stderr.write(`sbom: ${p}\n`);
  process.stdout.write(`sbom: ${sbom.components.length} components written to ${out}; ${problems.length === 0 ? "checked against the bundle, lockfile, SECURITY.md, and THIRD_PARTY_NOTICES.md" : `${problems.length} problem(s)`}\n`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
