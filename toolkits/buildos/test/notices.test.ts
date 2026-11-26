// The Go-derived Unicode tables ship in dist/buildos.js, so their BSD-3-Clause
// notice must ship too. These checks fail when src/core/shared/go-isprint.ts exists
// without the notice entry, the inventory row, or its own license header.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { goFoldHeader } from "../scripts/generate-go-fold.ts";
import { goIsprintHeader } from "../scripts/generate-go-isprint.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// .gitattributes checks these files out with LF on every OS. A checkout
// that still converts them to CRLF must not fail the byte-exact checks
// below, so line endings are folded to LF first. Nothing else changes.
const read = (name: string) => readFileSync(join(packageRoot, name), "utf8").replace(/\r\n/g, "\n");

/** SHA-256 of the Go 1.24.1 `LICENSE` file. */
export const GO_LICENSE_SHA256 = "911f8f5782931320f5b8d1160a76365b83aea6447ee6c04fa6d5591467db9dad";
const GO_HEADING = "## Go Standard Library: `strconv` Printable-Rune Tables";

export interface NoticeInput {
  /** Text of src/core/shared/go-isprint.ts, or undefined when the file does not exist. */
  isprint: string | undefined;
  notices: string;
  security: string;
}

/** Returns the problems; an empty list means the Go notice is complete. */
export function checkGoNotice(input: NoticeInput): string[] {
  if (input.isprint === undefined) return [];
  const problems: string[] = [];
  const version = /GO_ISPRINT_VERSION = "([^"]+)"/.exec(input.isprint)?.[1];
  const unicode = /\(Unicode ([^)]+)\)/.exec(input.isprint)?.[1];
  if (version === undefined || unicode === undefined || !input.isprint.startsWith(goIsprintHeader(version, unicode))) {
    problems.push("src/core/shared/go-isprint.ts does not start with the generator's source and license header");
  }
  const at = input.notices.indexOf(GO_HEADING);
  if (at === -1) {
    problems.push(`THIRD_PARTY_NOTICES.md has no "${GO_HEADING}" entry`);
  } else {
    const section = input.notices.slice(at);
    for (const text of ["src/strconv/isprint.go", "src/strconv/makeisprint.go", "src/strconv/quote.go", "BSD-3-Clause", `Go ${version?.replace(/^go/, "")}`]) {
      if (!section.includes(text)) problems.push(`the Go notice does not name ${text}`);
    }
    const license = /```text\n([\s\S]*?)\n```/.exec(section)?.[1];
    if (license === undefined) problems.push("the Go notice has no license text block");
    else if (createHash("sha256").update(`${license}\n`).digest("hex") !== GO_LICENSE_SHA256) {
      problems.push("the Go notice's license text is not the Go 1.24.1 LICENSE file");
    }
  }
  const row = input.security.split("\n").find((line) => line.startsWith("| Go `strconv` printable-rune tables"));
  if (row === undefined) problems.push("SECURITY.md Bundled Runtime Code does not list the Go tables");
  else {
    for (const text of ["| none |", "BSD-3-Clause", "src/core/shared/go-isprint.ts"]) {
      if (!row.includes(text)) problems.push(`SECURITY.md's Go row does not name ${text}`);
    }
  }
  return problems;
}

const real = (): NoticeInput => ({
  isprint: existsSync(join(packageRoot, "src/core/shared/go-isprint.ts")) ? read("src/core/shared/go-isprint.ts") : undefined,
  notices: read("THIRD_PARTY_NOTICES.md"),
  security: read("SECURITY.md"),
});

/** Returns the problems of the Go fold table's notice; an empty list means it is complete. */
export function checkGoFoldNotice(input: { fold: string | undefined; notices: string; security: string }): string[] {
  if (input.fold === undefined) return [];
  const problems: string[] = [];
  const version = /GO_FOLD_VERSION = "([^"]+)"/.exec(input.fold)?.[1];
  const unicode = /\(Unicode ([^)]+)\)/.exec(input.fold)?.[1];
  if (version === undefined || unicode === undefined || !input.fold.startsWith(goFoldHeader(version, unicode))) {
    problems.push("src/core/shared/go-fold.ts does not start with the generator's source and license header");
  }
  const section = input.notices.slice(Math.max(0, input.notices.indexOf(GO_HEADING)));
  for (const text of ["src/core/shared/go-fold.ts", "unicode.SimpleFold", "src/encoding/json/fold.go"]) {
    if (!section.includes(text)) problems.push(`the Go notice does not name ${text}`);
  }
  const row = input.security.split("\n").find((line) => line.startsWith("| Go simple case-folding orbits"));
  if (row === undefined) problems.push("SECURITY.md Bundled Runtime Code does not list the Go fold table");
  else for (const text of ["| none |", "BSD-3-Clause", "src/core/shared/go-fold.ts"]) if (!row.includes(text)) problems.push(`SECURITY.md's Go fold row does not name ${text}`);
  return problems;
}

describe("third-party notices", () => {
  it("holds the Go notice, inventory row, and header for the real go-fold.ts", () => {
    const input = { fold: read("src/core/shared/go-fold.ts"), notices: read("THIRD_PARTY_NOTICES.md"), security: read("SECURITY.md") };
    assert.deepEqual(checkGoFoldNotice(input), []);
    assert.ok(checkGoFoldNotice({ ...input, fold: input.fold.replace("@license BSD-3-Clause", "") }).some((p) => p.includes("license header")));
    assert.ok(checkGoFoldNotice({ ...input, security: input.security.replace("| Go simple case-folding orbits", "| Go folds") }).some((p) => p.includes("does not list")));
  });

  it("holds the Go notice, inventory row, and header for the real go-isprint.ts", () => {
    const input = real();
    assert.notEqual(input.isprint, undefined);
    assert.deepEqual(checkGoNotice(input), []);
  });

  it("fails when go-isprint.ts exists without the notice entry", () => {
    const input = real();
    const notices = input.notices.slice(0, input.notices.indexOf(GO_HEADING));
    assert.ok(checkGoNotice({ ...input, notices }).some((p) => p.includes("has no")));
  });

  it("fails when the license text is changed", () => {
    const input = real();
    const notices = input.notices.replace("Neither the name of Google LLC", "Neither the name of Google");
    assert.ok(checkGoNotice({ ...input, notices }).some((p) => p.includes("not the Go 1.24.1 LICENSE")));
  });

  it("fails when SECURITY.md does not list the Go tables", () => {
    const input = real();
    const security = input.security.replace("| Go `strconv` printable-rune tables", "| Go tables");
    assert.ok(checkGoNotice({ ...input, security }).some((p) => p.includes("does not list the Go tables")));
  });

  it("fails when go-isprint.ts loses its license header", () => {
    const input = real();
    const isprint = input.isprint!.replace("@license BSD-3-Clause", "");
    assert.ok(checkGoNotice({ ...input, isprint }).some((p) => p.includes("license header")));
  });

  it("needs no Go notice when go-isprint.ts does not exist", () => {
    assert.deepEqual(checkGoNotice({ isprint: undefined, notices: "", security: "" }), []);
  });
});

/** The outside npm packages bundled into dist/buildos.js (W1 R7 P4 t7), with the license file whose text must ship. */
export const BUNDLED_NPM_PACKAGES: readonly { name: string; version: string; license: string; files: readonly string[] }[] = [
  { name: "fflate", version: "0.8.3", license: "MIT", files: ["node_modules/fflate/LICENSE"] },
  { name: "parse5", version: "8.1.1", license: "MIT", files: ["node_modules/parse5/LICENSE"] },
  { name: "entities", version: "9.0.0", license: "BSD-2-Clause", files: ["node_modules/entities/LICENSE"] },
  { name: "unpdf", version: "2.1.0", license: "MIT", files: ["node_modules/unpdf/LICENSE", "node_modules/unpdf/dist/licenses/LICENSE_PDFJS"] },
];

describe("bundled npm package notices", () => {
  const lock = JSON.parse(read("package-lock.json")) as { packages: Record<string, { version?: string; license?: string }> };
  const notices = read("THIRD_PARTY_NOTICES.md");
  const security = read("SECURITY.md");
  for (const pkg of BUNDLED_NPM_PACKAGES) {
    it(`${pkg.name}: lockfile version, license text in THIRD_PARTY_NOTICES.md, and SECURITY.md rows`, () => {
      const entry = lock.packages[`node_modules/${pkg.name}`];
      assert.equal(entry?.version, pkg.version);
      assert.equal(entry?.license, pkg.license);
      for (const file of pkg.files) assert.ok(notices.includes(read(file).replace(/\n+$/, "")), `THIRD_PARTY_NOTICES.md must hold the text of ${file}`);
      assert.ok(security.split("\n").some((line) => line.startsWith(`| \`${pkg.name}\` | ${pkg.version} |`)), `SECURITY.md must list ${pkg.name} ${pkg.version}`);
    });
  }

  it("bundles exactly these packages", async () => {
    const { build } = await import("esbuild");
    const result = await build({ entryPoints: [join(packageRoot, "src", "cli", "main.ts")], bundle: true, platform: "node", format: "esm", target: "node24", write: false, metafile: true, logLevel: "silent", outfile: "out.js" });
    const names = new Set<string>();
    for (const input of Object.keys(result.metafile.inputs)) {
      const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
      if (match !== null) names.add(match[1]!);
    }
    assert.deepEqual([...names].sort(), BUNDLED_NPM_PACKAGES.map((p) => p.name).sort());
  });

  it("has no @xmldom/xmldom: XML is read by the Go encoding/xml port, under the Go notice", () => {
    assert.ok(!read("package.json").includes("xmldom"));
    assert.ok(!read("package-lock.json").includes("xmldom"));
    assert.ok(!notices.includes("xmldom"), "THIRD_PARTY_NOTICES.md still names @xmldom/xmldom");
    for (const text of ["`src/encoding/xml/xml.go`", "`src/encoding/xml/read.go`", "`src/core/intake/convert/go-xml.ts`"]) assert.ok(notices.includes(text), `THIRD_PARTY_NOTICES.md must cite ${text}`);
    const row = security.split("\n").find((line) => line.startsWith("| Port of the Go `encoding/xml` decoder"));
    assert.ok(row !== undefined && row.includes("BSD-3-Clause") && row.includes("src/encoding/xml/xml.go") && row.includes("src/core/intake/convert/go-xml.ts"));
    assert.match(read("src/core/intake/convert/go-xml.ts"), /@license BSD-3-Clause/);
  });
});

/**
 * Third-party components that pdf.js 6.4.299 inlines into
 * `unpdf/dist/pdfjs.mjs` (inventory from the bundled sources and pdf.js
 * v6.4.299 `external/`). `marker` is a name that appears in the esbuild
 * output only when the component is bundled. Each license text is a file
 * in node_modules, or the SHA-256 of a text taken from pdf.js v6.4.299
 * `external/` (or the toolchain's own LICENSE file) and pinned here.
 */
export const PDFJS_COMPONENTS: readonly { heading: string; marker: string; row: string; files: readonly string[]; sha256: readonly string[] }[] = [
  { heading: "## Component inside pdf.js: Brotli decoder", marker: "makeBrotliDecode", row: "| Brotli decoder (Google) |", files: [], sha256: ["2a57418d6b10947fe0dfbec3a600269e2745136c125cbf15b256e5ae18af23cb"] },
  { heading: "## Component inside pdf.js: OpenJPEG decoder loader", marker: "async function OpenJPEG(", row: "| OpenJPEG decoder loader |", files: ["node_modules/unpdf/dist/licenses/LICENSE_OPENJPEG", "node_modules/unpdf/dist/licenses/LICENSE_PDFJS_OPENJPEG"], sha256: [] },
  { heading: "## Component inside pdf.js: JBIG2 decoder loader", marker: "jbig2_decode", row: "| JBIG2 decoder loader (PDFium) |", files: ["node_modules/unpdf/dist/licenses/LICENSE_JBIG2", "node_modules/unpdf/dist/licenses/LICENSE_PDFJS_JBIG2"], sha256: [] },
  {
    heading: "## Component inside pdf.js: qcms color management loader",
    marker: "qcms_convert_array",
    row: "| qcms color management loader |",
    files: [],
    sha256: ["15ded6b861790e9ebffe2092617ef711e08ebaead94232394dbd972546beabe4", "1847e0e0698142ed4347c1441a9fa81c8fbddd44b1d8bbcd5e3647f991759d7f"],
  },
  { heading: "## Component inside pdf.js: Emscripten runtime glue", marker: "_emscripten_get_now", row: "| Emscripten runtime glue |", files: [], sha256: ["ade0cde45d85897f0264b37e651256428b77b45ef0363d5b97be8fecb4b6805a"] },
  { heading: "## Component inside pdf.js: wasm-bindgen glue", marker: "__wbindgen_malloc", row: "| wasm-bindgen glue |", files: [], sha256: ["84e1bbfebd74e4196cfa0ea5cf58e677aa24b47c6661adbb19fb07920d089d1d"] },
];

/** The ```text blocks of one notices section. */
function sectionBlocks(notices: string, heading: string): string[] {
  const at = notices.indexOf(heading);
  if (at === -1) return [];
  const next = notices.indexOf("\n## ", at + heading.length);
  const section = notices.slice(at, next === -1 ? undefined : next);
  return [...section.matchAll(/```text\n([\s\S]*?)\n```/g)].map((m) => m[1]!);
}

/** Returns the problems of the pdf.js component notices for a built bundle; empty means complete. */
export function checkPdfjsComponents(input: { bundle: string; notices: string; security: string; readFile: (name: string) => string }): string[] {
  const problems: string[] = [];
  for (const c of PDFJS_COMPONENTS) {
    if (!input.bundle.includes(c.marker)) continue;
    const blocks = sectionBlocks(input.notices, c.heading);
    if (blocks.length === 0) problems.push(`the bundle holds ${c.marker} but THIRD_PARTY_NOTICES.md has no "${c.heading}" license text`);
    const hashes = new Set(blocks.map((b) => createHash("sha256").update(b).digest("hex")));
    for (const sha of c.sha256) if (!hashes.has(sha)) problems.push(`${c.heading}: no license text with SHA-256 ${sha}`);
    for (const file of c.files) if (!blocks.includes(input.readFile(file).replace(/\n+$/, ""))) problems.push(`${c.heading}: does not hold the text of ${file}`);
    if (!input.security.split("\n").some((line) => line.startsWith(c.row))) problems.push(`SECURITY.md Components Inside pdf.js has no row ${c.row}`);
  }
  return problems;
}

describe("pdf.js component notices", () => {
  let bundle = "";
  it("builds the bundle", async () => {
    const { build } = await import("esbuild");
    const result = await build({ entryPoints: [join(packageRoot, "src", "cli", "main.ts")], bundle: true, platform: "node", format: "esm", target: "node24", write: false, logLevel: "silent", outfile: "out.js" });
    bundle = result.outputFiles[0]!.text;
    for (const c of PDFJS_COMPONENTS) assert.ok(bundle.includes(c.marker), `${c.marker} is no longer bundled; review the pdf.js component inventory`);
  });

  it("lists every bundled component with its license text and inventory row", () => {
    assert.deepEqual(checkPdfjsComponents({ bundle, notices: read("THIRD_PARTY_NOTICES.md"), security: read("SECURITY.md"), readFile: read }), []);
  });

  it("fails when a component's license text or row is missing or changed", () => {
    const notices = read("THIRD_PARTY_NOTICES.md");
    const security = read("SECURITY.md");
    const input = { bundle, notices, security, readFile: read };
    assert.ok(checkPdfjsComponents({ ...input, notices: notices.replace("## Component inside pdf.js: Brotli decoder", "## Brotli") }).some((p) => p.includes("makeBrotliDecode")));
    assert.ok(checkPdfjsComponents({ ...input, notices: notices.replace("Copyright (C) 1998-2007 Marti Maria", "Copyright Marti Maria") }).some((p) => p.includes("SHA-256")));
    assert.ok(checkPdfjsComponents({ ...input, notices: notices.replace("Copyright (c) 2002-2014, Professor Benoit Macq", "") }).some((p) => p.includes("LICENSE_OPENJPEG")));
    assert.ok(checkPdfjsComponents({ ...input, security: security.replace("| wasm-bindgen glue |", "| glue |") }).some((p) => p.includes("wasm-bindgen")));
  });
});

describe("Go encoding/xml and ledongthuc/pdf port notices", () => {
  it("go-xml.ts carries its license header and the notices name both ports", () => {
    const xml = read("src/core/intake/convert/go-xml.ts");
    assert.ok(xml.startsWith("/*! XML decoder ported from the Go standard library (go1.24.1)"));
    assert.ok(xml.includes("@license BSD-3-Clause"));
    const notices = read("THIRD_PARTY_NOTICES.md");
    assert.ok(notices.includes("src/core/intake/convert/go-xml.ts"));
    const blocks = sectionBlocks(notices, "## Go Module: `github.com/ledongthuc/pdf`");
    assert.deepEqual(blocks.map((b) => createHash("sha256").update(b).digest("hex")), ["4214d8afcc3620b7fb7aa9c7695e8f659a90011a830caf0e0c72a385d7d3b2a5"]);
    const security = read("SECURITY.md");
    assert.ok(security.split("\n").some((l) => l.startsWith("| Port of the Go `encoding/xml` decoder")));
    assert.ok(security.split("\n").some((l) => l.startsWith("| Port of the first `pdf.NewReader` checks")));
  });
});
