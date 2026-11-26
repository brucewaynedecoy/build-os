// W1 R7 P7 t8 and A56: the client-name deny-list check
// (scripts/check-deny-list.mjs; PRD 20 Release and Packaged Skills).
//
// Every term here is invented and is supplied through BUILDOS_DENY_LIST in the
// test's own environment. No real listed name appears in this repository.
// Each failing case checks that the output names the file and line and never
// the term, in any letter case.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve, win32 } from "node:path";
import { after, before, describe, it } from "node:test";
import { strToU8, zlibSync, zipSync } from "fflate";
import { gunzipSync } from "node:zlib";
import { bundle } from "../scripts/build.ts";
import { packEntries } from "../scripts/deny-list-paths.mjs";
import { assertOutputMatches, assertSame, shape } from "./helpers.ts";
import { readTar, TarError } from "../scripts/tar-reader.mjs";
import { TAR_END, tarGz, tarGzRaw, ustarEntry, ustarHeader } from "./tar-fixture.ts";

const PACKAGE = resolve(import.meta.dirname, "..");
const REPO = resolve(PACKAGE, "..", "..");
const SCRIPT = join(PACKAGE, "scripts", "check-deny-list.mjs");

const TERM_ONE = "Quorvex Talliward";
const TERM_TWO = "zentrova";
// An invented name with an ampersand (P7-F-02): written as `&amp;` in XML and HTML-escaped text.
const TERM_AMP = "Brask & Velloran";
const LIST = `${TERM_ONE}\n${TERM_TWO}\n${TERM_AMP}`;

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function fixture(files: Record<string, string | Uint8Array>): string {
  const root = mkdtempSync(join(tmpdir(), "buildos-deny-list-"));
  temps.push(root);
  for (const [path, data] of Object.entries(files)) {
    const full = join(root, ...path.split("/"));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, data);
  }
  return root;
}

function run(args: string[], env: Record<string, string | undefined>) {
  const base: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "BUILDOS_DENY_LIST" && key !== "CI" && key !== "GITHUB_ACTIONS") base[key] = value;
  }
  for (const [key, value] of Object.entries(env)) if (value !== undefined) base[key] = value;
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: base, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, all: `${result.stdout}\n${result.stderr}` };
}

/** The output holds no part of any term, in any letter case. */
function assertNoTerm(output: string): void {
  const lower = output.toLowerCase();
  for (const part of [...TERM_ONE.split(" "), TERM_TWO, "Brask", "Velloran"]) assert.ok(!lower.includes(part.toLowerCase()), `the output shows a deny-list term (${shape(output)})`);
}

const CLEAN = {
  "README.md": "# Library lending\n\nA neutral project about book loans.\n",
  "system/.os/skills/sample/SKILL.md": "---\nname: sample\ndescription: A neutral skill.\n---\n",
};

describe("deny-list check: list source", () => {
  it("fails closed with no list: exit 2 and a plain message", () => {
    const root = fixture(CLEAN);
    const result = run(["--root", root, "--walk"], {});
    assert.equal(result.status, 2);
    assert.match(result.stderr, /deny list not provided/);
  });

  it("--allow-missing skips only outside CI, and says so", () => {
    const root = fixture(CLEAN);
    const local = run(["--root", root, "--walk", "--allow-missing"], {});
    assert.equal(local.status, 0);
    assert.match(local.stdout, /SKIPPED/);
    for (const env of [{ CI: "true" }, { GITHUB_ACTIONS: "true" }]) {
      const ci = run(["--root", root, "--walk", "--allow-missing"], env);
      assert.equal(ci.status, 2, JSON.stringify(env));
      assert.match(ci.stderr, /deny list not provided/);
    }
  });

  it("an empty variable is no list (a missing CI secret is empty)", () => {
    const root = fixture(CLEAN);
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: " \n , " , CI: "true" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /deny list not provided/);
  });

  it("refuses a term shorter than 3 characters without showing it", () => {
    const root = fixture(CLEAN);
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: `${TERM_TWO}\nqx` });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /at least 3 characters/);
    assert.ok(!result.all.includes("qx"));
  });

  it("reads a list file outside the scanned folder, and refuses one inside it", () => {
    const root = fixture({ ...CLEAN, "notes/plan.md": `one\n${TERM_TWO}\n` });
    const outside = fixture({ "list.txt": LIST });
    const ok = run(["--root", root, "--walk", "--list-file", join(outside, "list.txt")], {});
    assert.equal(ok.status, 1);
    assert.match(ok.stdout, /match in notes\/plan\.md:2/);
    assertNoTerm(ok.all);
    writeFileSync(join(root, "list.txt"), LIST);
    const inside = run(["--root", root, "--walk", "--list-file", join(root, "list.txt")], {});
    assert.equal(inside.status, 2);
    assert.match(inside.stderr, /inside the scanned folder/);
    assertNoTerm(inside.all);
  });
});

describe("deny-list check: matches (A56)", () => {
  it("passes on a clean tree", () => {
    const root = fixture(CLEAN);
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 0, result.all);
    assert.match(result.stdout, /0 match\(es\)/);
  });

  it("fails on a planted term in any letter case and shows only the file and line", () => {
    const root = fixture({ ...CLEAN, "system/.os/skills/sample/notes.md": `first\nsecond\nA note about ${TERM_ONE.toUpperCase()} here.\n` });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /deny-list: match in system\/\.os\/skills\/sample\/notes\.md:3\n/);
    assert.ok(!result.stdout.includes("A note about"), "the line text is not shown");
    assertNoTerm(result.all);
  });

  it("finds a term split across lines or by extra white space, and a comma-separated list works", () => {
    const root = fixture({ ...CLEAN, "test/fixtures/split.txt": `x\nQuorvex\n   talliward\n`, "data.csv": `a,b\n1,"Quorvex   Talliward"\n` });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: `${TERM_ONE},${TERM_TWO}` });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in test\/fixtures\/split\.txt:2\n/);
    assert.match(result.stdout, /match in data\.csv:2\n/);
    assertNoTerm(result.all);
  });

  it("opens ZIP-based files such as .docx and names the entry and line", () => {
    const docx = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(`<w:document><w:t>${TERM_TWO}</w:t></w:document>`) });
    const root = fixture({ ...CLEAN, "test/fixtures/report.docx": docx });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in test\/fixtures\/report\.docx!word\/document\.xml:1\n/);
    assertNoTerm(result.all);
  });

  it("checks file and folder names and hides the matching part of the path", () => {
    const root = fixture({ ...CLEAN, [`system/.os/skills/${TERM_TWO}-notes/SKILL.md`]: "neutral\n" });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in system\/\.os\/skills\/\[name on the deny list\]\/SKILL\.md:name\n/);
    assertNoTerm(result.all);
  });

  it("fails closed on a binary file in system/ that it cannot fully read, and only notes one elsewhere", () => {
    const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0xff]);
    const shipped = run(["--root", fixture({ ...CLEAN, "system/assets/picture.png": binary }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(shipped.status, 1);
    assert.match(shipped.stdout, /not fully scanned .* system\/assets\/picture\.png/);
    const elsewhere = run(["--root", fixture({ ...CLEAN, "test/fixtures/picture.png": binary }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(elsewhere.status, 0, elsewhere.all);
    assert.match(elsewhere.stdout, /1 not fully scanned \(1 binary file: read as raw bytes only\); 0 shipped file\(s\) not fully scanned/);
  });

  it("finds a term in the raw bytes of a binary file (image metadata)", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, ...strToU8(`tEXtAuthor\u0000${TERM_TWO}`), 0x00]);
    const result = run(["--root", fixture({ ...CLEAN, "test/fixtures/meta.png": png }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in test\/fixtures\/meta\.png:1\n/);
    assertNoTerm(result.all);
  });

});

// W1 R7 P7 skills review round 1 (P7S-R1-01 to P7S-R1-05). Every term and the
// account name below are invented. A home-folder path is built at run time, so
// this file holds no path of that shape itself.
const ACCOUNT = "qzvhomeacct";
const homePath = (account: string) => ["", "Users", account, "go", "src", "main.go"].join("/");
const linuxHome = (account: string) => ["", "home", account, "build"].join("/");
const windowsHome = (account: string) => ["C:", "Users", account, "AppData"].join("\\\\");

function assertNothingSecret(output: string): void {
  assertNoTerm(output);
  assert.ok(!output.toLowerCase().includes(ACCOUNT), `the output shows the home folder name:\n${output.length} characters`);
}

describe("deny-list check: home-folder paths (P7S-R1-01)", () => {
  it("fails on a personal build path inside a binary file, a text file, and a JSON-escaped Windows path, and never prints the folder name", () => {
    const binary = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x00, ...strToU8(homePath(ACCOUNT)), 0x00, 0x01]);
    const root = fixture({
      ...CLEAN,
      "tools/bin/tool": binary,
      "docs/notes.md": `one\nbuilt in ${linuxHome(ACCOUNT)} yesterday\n`,
      "test/fixtures/config.json": `{"path": "${windowsHome(ACCOUNT)}"}\n`,
    });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /home folder path in tools\/bin\/tool:1\n/);
    assert.match(result.stdout, /home folder path in docs\/notes\.md:2\n/);
    assert.match(result.stdout, /home folder path in test\/fixtures\/config\.json:1\n/);
    assert.match(result.stdout, /3 home folder path\(s\)/);
    assertNothingSecret(result.all);
  });

  it("allows generic CI runner accounts and placeholders, and URLs that only contain /home/", () => {
    const text = [homePath("runner"), linuxHome("runner"), windowsHome("runneradmin"), linuxHome("me"), "https://example.com/home/index.html", "/srv/home/data", "/Users/<name>/project"].join("\n");
    const result = run(["--root", fixture({ ...CLEAN, "docs/paths.md": `${text}\n` }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /0 home folder path\(s\)/);
  });

  it("finds a home-folder path in an archive member's name and content and hides the folder name in the label", () => {
    const zip = zipSync({ [`Users/${ACCOUNT}/notes.txt`]: strToU8("neutral\n"), "inner.txt": strToU8(`${linuxHome(ACCOUNT)}\n`) });
    const result = run(["--root", fixture({ ...CLEAN, "test/fixtures/bundle.zip": zip }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /home folder path in test\/fixtures\/bundle\.zip!Users\/\[home folder name\]\/notes\.txt:name\n/);
    assert.match(result.stdout, /home folder path in test\/fixtures\/bundle\.zip!inner\.txt:1\n/);
    assertNothingSecret(result.all);
  });
});

describe("deny-list check: labels (P7S-R1-02)", () => {
  it("redacts a matching archive member name and every nested archive label part, and a failing run never prints a term anywhere", () => {
    const inner = zipSync({ [`${TERM_TWO}-sheet.csv`]: strToU8("neutral\n"), "plain.txt": strToU8(`a ${TERM_TWO} line\n`) });
    const outer = zipSync({ [`${TERM_ONE}/inner.zip`]: inner, [`notes-${TERM_TWO}.txt`]: strToU8("neutral\n") });
    const root = fixture({
      ...CLEAN,
      [`system/.os/skills/${TERM_TWO}-skill/SKILL.md`]: `---\nname: x\n---\nabout ${TERM_ONE}\n`,
      [`test/fixtures/${TERM_ONE}/archive.zip`]: outer,
    });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    const R = "\\[name on the deny list\\]";
    assert.match(result.stdout, new RegExp(`match in system/\\.os/skills/${R}/SKILL\\.md:name\\n`));
    assert.match(result.stdout, new RegExp(`match in system/\\.os/skills/${R}/SKILL\\.md:4\\n`));
    assert.match(result.stdout, new RegExp(`match in test/fixtures/${R}/archive\\.zip!${R}/inner\\.zip:name\\n`));
    assert.match(result.stdout, new RegExp(`match in test/fixtures/${R}/archive\\.zip!${R}/inner\\.zip!${R}:name\\n`));
    assert.match(result.stdout, new RegExp(`match in test/fixtures/${R}/archive\\.zip!${R}/inner\\.zip!plain\\.txt:1\\n`));
    assert.match(result.stdout, new RegExp(`match in test/fixtures/${R}/archive\\.zip!${R}:name\\n`));
    assertNoTerm(result.all);
  });

  it("an unread (too large) archive member is named only through the same redaction, and fails the run in a shipped path", () => {
    const zip = zipSync({ [`${TERM_TWO}.txt`]: strToU8("x".repeat(4096)), "small.txt": strToU8("neutral\n") });
    const shipped = run(["--root", fixture({ ...CLEAN, "system/assets/pack.zip": zip }), "--walk", "--max-entry-bytes", "1024"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(shipped.status, 1);
    assert.match(shipped.stdout, /not fully scanned \(archive member too large to read\) in a shipped path: system\/assets\/pack\.zip!\[name on the deny list\]\n/);
    assertNoTerm(shipped.all);
  });

  it("never echoes an unknown argument (a list pasted on the command line by mistake)", () => {
    const result = run(["--root", fixture(CLEAN), "--walk", TERM_ONE], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown argument \(not shown\)/);
    assertNoTerm(result.all);
  });

  it("debug options and an internal error print no term and no stack", () => {
    const root = fixture({ ...CLEAN, "notes.md": `${TERM_TWO}\n` });
    const env = { BUILDOS_DENY_LIST: LIST, NODE_DEBUG: "fs,module,child_process,esm,net,timer", NODE_OPTIONS: "--trace-uncaught --trace-warnings --stack-trace-limit=50" };
    const failing = run(["--root", root, "--walk"], env);
    assert.equal(failing.status, 1);
    assertNoTerm(failing.all);
    // --root names a file, so reading it as a folder fails inside the check.
    const broken = run(["--root", join(root, "notes.md"), "--walk"], env);
    assert.equal(broken.status, 2);
    assert.match(broken.stderr, /internal error \(ENOTDIR\); the check failed closed/);
    assert.ok(!broken.all.includes("    at "), "no stack trace");
    assertNoTerm(broken.all);
  });

  it("git runs without the list in its environment", { skip: process.platform === "win32" ? "a fake git needs a POSIX shell" : false }, () => {
    const root = fixture(CLEAN);
    const bin = fixture({});
    const record = join(bin, "env.txt");
    writeFileSync(join(bin, "git"), `#!/bin/sh\nenv > "${record}"\nexit 1\n`, { mode: 0o755 });
    const result = run(["--root", root], { BUILDOS_DENY_LIST: LIST, PATH: `${bin}:${process.env["PATH"] ?? ""}` });
    assert.equal(result.status, 0, result.stdout);
    const seen = readFileSync(record, "utf8");
    assert.ok(!seen.includes("BUILDOS_DENY_LIST"), "git saw the list variable");
    assertNoTerm(seen);
  });
});

describe("deny-list check: no silent skips (P7S-R1-04, P7S-R1-05)", () => {
  it("a too-large archive member outside shipped paths is counted, not silently omitted", () => {
    const zip = zipSync({ "big.txt": strToU8("x".repeat(4096)) });
    const result = run(["--root", fixture({ ...CLEAN, "test/fixtures/big.zip": zip }), "--walk", "--max-entry-bytes", "1024"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 0, result.stdout);
    assert.match(result.stdout, /1 not fully scanned \(1 archive member too large to read\); 0 shipped file\(s\) not fully scanned/);
  });

  it("a too-large file in a shipped path fails, and elsewhere is counted", () => {
    const shipped = run(["--root", fixture({ ...CLEAN, "system/big.md": "y".repeat(4096) }), "--walk", "--max-file-bytes", "1024"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(shipped.status, 1);
    assert.match(shipped.stdout, /not fully scanned \(file too large to read\) in a shipped path: system\/big\.md\n/);
    const other = run(["--root", fixture({ ...CLEAN, "docs/big.md": "y".repeat(4096) }), "--walk", "--max-file-bytes", "1024"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(other.status, 0);
    assert.match(other.stdout, /1 not fully scanned \(1 file too large to read\)/);
  });

  it("finds a term split across formatting runs in .docx, .pptx, and .xlsx shared strings (visible text), which the raw scan misses", () => {
    const run3 = (tag: string, a: string, b: string, c: string) => `<${tag}:r><${tag}:t>${a}</${tag}:t></${tag}:r><${tag}:r><${tag}:rPr/><${tag}:t>${b}</${tag}:t></${tag}:r><${tag}:r><${tag}:t>${c}</${tag}:t></${tag}:r>`;
    const docx = zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(`<w:document><w:body><w:p>${run3("w", "Quor", "vex Tal", "liward")}</w:p></w:body></w:document>`) });
    const pptx = zipSync({ "ppt/slides/slide1.xml": strToU8(`<p:sld><a:p>${run3("a", "zen", "tr", "ova")}</a:p></p:sld>`) });
    const xlsx = zipSync({ "xl/sharedStrings.xml": strToU8(`<sst><si><t>neutral</t></si><si><r><t>Zen</t></r><r><rPr><b/></rPr><t>trova</t></r></si></sst>`) });
    const root = fixture({ ...CLEAN, "test/fixtures/a.docx": docx, "test/fixtures/b.pptx": pptx, "test/fixtures/c.xlsx": xlsx });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in test\/fixtures\/a\.docx!word\/document\.xml:text 1\n/);
    assert.match(result.stdout, /match in test\/fixtures\/b\.pptx!ppt\/slides\/slide1\.xml:text 1\n/);
    assert.match(result.stdout, /match in test\/fixtures\/c\.xlsx!xl\/sharedStrings\.xml:text 2\n/);
    assert.ok(!/a\.docx!word\/document\.xml:1\n/.test(result.stdout), "the raw markup alone holds no continuous term");
    assertNoTerm(result.all);
  });

  it("matches a term split across lines at a window edge and in a file above the old 8 Mi-character limit", () => {
    // The first split term crosses the first window edge (1 Mi folded characters); the second is past 9 Mi characters.
    const edge = 1024 * 1024 + 10;
    const text = `${"x".repeat(edge)} Quorvex\nTalliward\n${"y".repeat(9 * 1024 * 1024)} quorvex\n   TALLIWARD end\n`;
    const result = run(["--root", fixture({ ...CLEAN, "docs/large.txt": text }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in docs\/large\.txt:1\n/);
    assert.match(result.stdout, /match in docs\/large\.txt:3\n/);
    assertNoTerm(result.all);
  });

  it("decodes UTF-16BE and UTF-16LE text with a byte order mark as fully read text, and finds UTF-16BE in raw binary bytes", () => {
    const be = (text: string) => {
      const le = Buffer.from(text, "utf16le");
      le.swap16();
      return le;
    };
    const root = fixture({
      ...CLEAN,
      "system/notes-be.txt": new Uint8Array([0xfe, 0xff, ...be(`one\nabout ${TERM_TWO}\n`)]),
      "system/notes-le.txt": new Uint8Array([0xff, 0xfe, ...Buffer.from(`one\ntwo\n${TERM_TWO}\n`, "utf16le")]),
      "test/fixtures/blob.bin": new Uint8Array([0x00, 0x01, 0x02, ...be(`x ${TERM_TWO} y`), 0x00]),
      "test/fixtures/blob-odd.bin": new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, ...be(`x ${TERM_TWO} y`), 0x00]),
    });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in system\/notes-be\.txt:2\n/);
    assert.match(result.stdout, /match in system\/notes-le\.txt:3\n/);
    assert.match(result.stdout, /match in test\/fixtures\/blob\.bin:1\n/);
    assert.match(result.stdout, /match in test\/fixtures\/blob-odd\.bin:1\n/);
    assert.ok(!/not fully scanned \([^)]*\) in a shipped path: system\/notes-/.test(result.stdout), "BOM text is fully read");
    assertNoTerm(result.all);
  });
});

// W1 R7 P7 skills review round 2 (P7S-R2-01, P7S-R2-02, P7S-R2-04). Every
// term, account name, and server name is invented.
const utf16leBom = (text: string) => new Uint8Array([0xff, 0xfe, ...Buffer.from(text, "utf16le")]);
const utf16beNoBom = (text: string) => {
  const bytes = Buffer.from(text, "utf16le");
  bytes.swap16();
  return new Uint8Array(bytes);
};
const indentRuns = (tag: string, parts: string[]) => parts.map((part) => `\n    <${tag}:r>\n      <${tag}:rPr/>\n      <${tag}:t>${part}</${tag}:t>\n    </${tag}:r>`).join("");

describe("deny-list check: XML encodings and indentation (P7S-R2-01)", () => {
  it("finds a term split across runs and across indentation in compact, indented, UTF-16LE, and UTF-16BE docx, xlsx, pptx, and generic XML", () => {
    const docxIndented = `<?xml version="1.0" encoding="UTF-8"?>\n<w:document>\n  <w:body>\n  <w:p>${indentRuns("w", ["Quor", "vex Tal", "liward"])}\n  </w:p>\n  </w:body>\n</w:document>\n`;
    const sst = `<?xml version="1.0" encoding="UTF-16"?>\n<sst>\n  <si>\n    <t>neutral</t>\n  </si>\n  <si>\n    <r>\n      <t>Zen</t>\n    </r>\n    <r>\n      <rPr><b/></rPr>\n      <t>trova</t>\n    </r>\n  </si>\n</sst>\n`;
    const sheet = `<?xml version="1.0" encoding="UTF-16"?>\n<worksheet>\n  <sheetData>\n    <row r="1">\n      <c r="A1" t="inlineStr">\n        <is>\n          <r><t>zen</t></r>\n          <r><t>TROVA</t></r>\n        </is>\n      </c>\n    </row>\n  </sheetData>\n</worksheet>\n`;
    const slide = `<?xml version="1.0" encoding="UTF-16"?>\n<p:sld>\n  <p:txBody>\n    <a:p>${indentRuns("a", ["Quorvex", " Talli", "ward"])}\n    </a:p>\n  </p:txBody>\n</p:sld>\n`;
    const custom = `<?xml version="1.0"?>\n<record>\n  <name>Quor<b>vex</b>\n      Talliward</name>\n</record>\n`;
    const root = fixture({
      ...CLEAN,
      "test/fixtures/compact.docx": zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>Quor</w:t></w:r><w:r><w:t>vex Talliward</w:t></w:r></w:p></w:body></w:document>`) }),
      "test/fixtures/indented.docx": zipSync({ "word/document.xml": strToU8(docxIndented) }),
      "test/fixtures/le.xlsx": zipSync({ "xl/sharedStrings.xml": utf16leBom(sst), "xl/worksheets/sheet1.xml": utf16leBom(sheet) }),
      "test/fixtures/be.pptx": zipSync({ "ppt/slides/slide1.xml": utf16beNoBom(slide) }),
      "test/fixtures/custom.docx": zipSync({ "customXml/item1.xml": strToU8(custom) }),
      "test/fixtures/record-le.xml": utf16leBom(custom),
    });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    for (const label of [
      "test/fixtures/compact.docx!word/document.xml:text 1",
      "test/fixtures/indented.docx!word/document.xml:text 1",
      "test/fixtures/le.xlsx!xl/sharedStrings.xml:text 2",
      "test/fixtures/le.xlsx!xl/worksheets/sheet1.xml:text 1",
      "test/fixtures/be.pptx!ppt/slides/slide1.xml:text 1",
      "test/fixtures/custom.docx!customXml/item1.xml:text 1",
      "test/fixtures/record-le.xml:text 1",
    ]) assert.ok(result.stdout.includes(`deny-list: match in ${label}\n`), `missing ${label}`);
    // UTF-16 members are read as text, not as unread binary members.
    assert.match(result.stdout, /0 not fully scanned/);
    assertNoTerm(result.all);
  });

  it("does not join the text of two paragraphs, cells, or string items", () => {
    const docx = zipSync({ "word/document.xml": strToU8(`<w:document>\n  <w:p><w:r><w:t>zen</w:t></w:r></w:p>\n  <w:p><w:r><w:t>trova</w:t></w:r></w:p>\n</w:document>`) });
    const xlsx = zipSync({ "xl/sharedStrings.xml": strToU8(`<sst>\n  <si><t>zen</t></si>\n  <si><t>trova</t></si>\n</sst>`) });
    const result = run(["--root", fixture({ ...CLEAN, "test/fixtures/apart.docx": docx, "test/fixtures/apart.xlsx": xlsx }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 0, result.stdout);
  });
});

describe("deny-list check: metadata channels (P7S-R2-02)", () => {
  it("finds a term in a ZIP archive comment, a member comment, and an extra field, and never prints it", () => {
    const termBytes = strToU8(TERM_TWO);
    const zip = zipSync({ "notes.txt": [strToU8("neutral\n"), { comment: `about ${TERM_ONE}`, extra: { 0x6375: new Uint8Array([1, ...termBytes]) } }], "plain.txt": strToU8("neutral\n") });
    const comment = Buffer.from(`made for ${TERM_TWO}`, "utf8");
    const withComment = new Uint8Array([...zip.subarray(0, zip.length - 2), comment.length & 0xff, comment.length >> 8, ...comment]);
    const result = run(["--root", fixture({ ...CLEAN, "test/fixtures/meta.zip": withComment, "system/assets/meta.docx": withComment }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    for (const path of ["test/fixtures/meta.zip", "system/assets/meta.docx"]) {
      for (const where of [":archive comment 1", "!notes.txt:member comment 1", "!notes.txt:extra field 1", "!notes.txt:local extra field 1"]) assert.ok(result.stdout.includes(`deny-list: match in ${path}${where}\n`), `missing ${path}${where}`);
    }
    assertNoTerm(result.all);
  });

  it("reads PDF Info strings (UTF-16BE hex and escaped literals) and XMP metadata, plain or inflated", () => {
    const hexTitle = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(utf16beNoBom(TERM_ONE))]).toString("hex").toUpperCase();
    const info = `%PDF-1.7\n1 0 obj\n<< /Title <${hexTitle}> /Author (Zen\\164rova) >>\nendobj\n`;
    const xmp = `<x:xmpmeta><rdf:RDF><dc:creator>${TERM_TWO}</dc:creator></rdf:RDF></x:xmpmeta>`;
    const deflated = zlibSync(strToU8(xmp));
    const xmpPdf = new Uint8Array([...strToU8("%PDF-1.7\n2 0 obj\n<< /Type /Metadata /Filter /FlateDecode >>\nstream\n"), ...deflated, ...strToU8("\nendstream\nendobj\n")]);
    const objectStream = zlibSync(strToU8(`<< /Title <${hexTitle}> >>`));
    const objPdf = new Uint8Array([...strToU8("%PDF-1.7\n3 0 obj\n<< /Type /ObjStm /Filter /FlateDecode >>\nstream\n"), ...objectStream, ...strToU8("\nendstream\nendobj\n")]);
    const root = fixture({ ...CLEAN, "test/fixtures/info.pdf": strToU8(info), "test/fixtures/xmp.pdf": xmpPdf, "test/fixtures/objstm.pdf": objPdf });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /match in test\/fixtures\/info\.pdf:pdf string 1\n/);
    assert.match(result.stdout, /match in test\/fixtures\/info\.pdf:pdf string 2\n/);
    assert.match(result.stdout, /match in test\/fixtures\/xmp\.pdf:1\n/);
    assert.match(result.stdout, /match in test\/fixtures\/objstm\.pdf:pdf string \d+\n/);
    assertNoTerm(result.all);
  });

  it("reads PNG zTXt and iTXt chunks, and JPEG COM, EXIF, and XMP bytes in UTF-8 and UTF-16", () => {
    const chunk = (type: string, body: Uint8Array) => {
      const head = Buffer.alloc(8);
      head.writeUInt32BE(body.length, 0);
      head.write(type, 4, "latin1");
      return new Uint8Array([...head, ...body, 0, 0, 0, 0]);
    };
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const ztxt = new Uint8Array([...signature, ...chunk("zTXt", new Uint8Array([...strToU8("Author"), 0, 0, ...zlibSync(strToU8(TERM_ONE))]))]);
    const itxt = new Uint8Array([...signature, ...chunk("iTXt", new Uint8Array([...strToU8("Title"), 0, 1, 0, ...strToU8("en"), 0, 0, ...zlibSync(strToU8(`a ${TERM_TWO}`))]))]);
    const segment = (marker: number, body: Uint8Array) => new Uint8Array([0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]);
    const jpegCom = new Uint8Array([0xff, 0xd8, ...segment(0xfe, Buffer.from(TERM_TWO, "utf16le")), 0xff, 0xd9]);
    const jpegExif = new Uint8Array([0xff, 0xd8, ...segment(0xe1, new Uint8Array([...strToU8("Exif"), 0, 0, 0x49, 0x49, 0x2a, 0, ...Buffer.from(TERM_ONE, "utf16le")])), 0xff, 0xd9]);
    const jpegXmp = new Uint8Array([0xff, 0xd8, ...segment(0xe1, strToU8(`http://ns.adobe.com/xap/1.0/\u0000<x:xmpmeta>${TERM_TWO}</x:xmpmeta>`)), 0xff, 0xd9]);
    const root = fixture({ ...CLEAN, "test/fixtures/z.png": ztxt, "test/fixtures/i.png": itxt, "test/fixtures/com.jpg": jpegCom, "test/fixtures/exif.jpg": jpegExif, "test/fixtures/xmp.jpg": jpegXmp });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    for (const label of ["z.png:png text 1", "i.png:png text 1", "com.jpg:1", "exif.jpg:1", "xmp.jpg:1"]) assert.ok(result.stdout.includes(`deny-list: match in test/fixtures/${label}\n`), `missing ${label}`);
    assertNoTerm(result.all);
  });
});

describe("deny-list check: home-folder path shapes (P7S-R2-04)", () => {
  it("finds UNC, escaped UNC, and drive and POSIX profiles whose names start with a non-ASCII letter, and reads the whole name", () => {
    const unc = ["", "", "qzvserver", "Users", ACCOUNT, "Documents"].join("\\");
    const uncEscaped = ["", "", "qzvserver", "c$", "Users", ACCOUNT].join("\\\\");
    const lines = [
      `share ${unc}`,
      `{"p": "${uncEscaped}"}`,
      ["C:", "Users", "Øqzvacct", "AppData"].join("\\"),
      ["", "Users", "Ünqzvacct", "src"].join("/"),
      ["", "home", "meqzv", "src"].join("/"),
      ["", "Users", "runner", "work"].join("/") + "-and " + ["", "Users", "runnerqzv", "work"].join("/"),
      ["C:", "Users", "First Qzvlast", "Desktop"].join("\\"),
    ];
    const root = fixture({ ...CLEAN, "docs/shapes.md": `${lines.join("\n")}\n` });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    for (let line = 1; line <= lines.length; line += 1) assert.ok(result.stdout.includes(`home folder path in docs/shapes.md:${line}\n`), `line ${line}`);
    assertNothingSecret(result.all);
  });

  it("still allows placeholders, generic runner accounts, and URLs", () => {
    const text = [
      "/Users/<name>/project",
      "/home/$USER/project",
      "C:\\Users\\%USERNAME%\\AppData",
      "/Users/.../project",
      "\\\\build\\Users\\runneradmin\\work",
      "C:\\Users\\RUNNER~1\\AppData",
      "https://example.com/Users/someone-else/page",
      "file://server/Users/<user>/x",
    ].join("\n");
    const result = run(["--root", fixture({ ...CLEAN, "docs/ok.md": `${text}\n` }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 0, result.stdout);
  });
});

/** The numbers of the scanner's summary line only (P7-F-03): safe to print, whatever the files hold. */
function summaryCounts(stdout: string): string {
  const summary = stdout.split("\n").find((line) => line.startsWith("deny-list: checked ")) ?? "";
  const numbers = [...summary.matchAll(/\d+/g)].map((m) => m[0]);
  return numbers.length === 0 ? "no summary line" : `summary numbers ${numbers.join(" ")}`;
}

describe("deny-list check: package files are read from their own disk paths (P7-F-01)", () => {
  it("keeps the disk path apart from the label when the package folder is on another drive (Windows rules, on every OS)", () => {
    const root = "D:\\a\\build-os\\build-os";
    const stage = "C:\\Users\\runneradmin\\AppData\\Local\\Temp\\stage";
    const [entry] = packEntries(root, stage, ["dist/buildos.js"], win32);
    assertSame(entry!.full, `${stage}\\dist\\buildos.js`, "the disk path of a package file on another drive");
    assertSame(entry!.path, "[package]/dist/buildos.js", "the label of a package file on another drive");
    // The old derivation joined the cross-drive relative path (an absolute path) under the root: a path that does not exist.
    const old = win32.join(root, ...win32.relative(root, entry!.full).split(win32.sep));
    assert.ok(old !== entry!.full, "the old derivation gives another path");
    const [inside] = packEntries("C:\\repo", "C:\\repo\\toolkits\\buildos", ["dist/system/x.md"], win32);
    assertSame([inside!.full, inside!.path], ["C:\\repo\\toolkits\\buildos\\dist\\system\\x.md", "toolkits/buildos/dist/system/x.md"], "a package inside the root");
    const [outside] = packEntries("/work/repo", "/tmp/stage", ["dist/a.js"], posix);
    assertSame([outside!.full, outside!.path], ["/tmp/stage/dist/a.js", "[package]/dist/a.js"], "a package outside the root");
    const [sibling] = packEntries("/work/repo", "/work/repo-stage", ["dist/a.js"], posix);
    assertSame(sibling!.path, "[package]/dist/a.js", "a sibling folder whose name starts with the root name");
  });

  it("reads a package folder outside the root, counts every file read, and finds a term there", () => {
    const cache = fixture({});
    const root = fixture(CLEAN);
    const pack = packageFixture({ "dist/buildos.js": "neutral\n", "dist/notes.js": `// ${TERM_TWO}\n` });
    const result = run(["--root", root, "--walk", "--pack", pack], { BUILDOS_DENY_LIST: LIST, ...npmEnv(cache) });
    assert.equal(result.status, 1);
    assertOutputMatches(result.stdout, /match in \[package\]\/dist\/notes\.js:1\n/);
    assertOutputMatches(result.stdout, /; 3 of 3 package files read\.\n/);
    assertNoTerm(result.all);
  });

  const fakeNpm = (json: string) => {
    const bin = fixture({});
    writeFileSync(join(bin, "npm"), `#!/bin/sh\nprintf '%s' '${json}'\n`, { mode: 0o755 });
    return bin;
  };
  const posixOnly = { skip: process.platform === "win32" ? "a fake npm needs a POSIX shell" : false };

  it("fails when a listed package file cannot be opened, and when the list is empty", posixOnly, () => {
    const root = fixture(CLEAN);
    const pack = fixture({ "package.json": "{}" });
    const missing = run(["--root", root, "--walk", "--pack", pack], { BUILDOS_DENY_LIST: LIST, PATH: `${fakeNpm('[{"files":[{"path":"package.json"},{"path":"dist/gone.js"}]}]')}:${process.env["PATH"] ?? ""}` });
    assert.equal(missing.status, 1);
    assertOutputMatches(missing.stdout, /not fully scanned \(package file could not be opened\) in a shipped path: \[package\]\/dist\/gone\.js\n/);
    assertOutputMatches(missing.stdout, /only 1 of 2 package files could be read\n/);
    assertOutputMatches(missing.stdout, /; 1 of 2 package files read\.\n/);
    const empty = run(["--root", root, "--walk", "--pack", pack], { BUILDOS_DENY_LIST: LIST, PATH: `${fakeNpm('[{"files":[]}]')}:${process.env["PATH"] ?? ""}` });
    assert.equal(empty.status, 1);
    assertOutputMatches(empty.stdout, /listed no package files/);
    assertOutputMatches(empty.stdout, /; 0 of 0 package files read\.\n/);
  });
});

describe("deny-list check: character references and percent-encoding (P7-F-02)", () => {
  it("finds a name with an ampersand written as &amp; in an xlsx sheet name, in an HTML-escaped CSV field, and as numeric references", () => {
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>\n<workbook>\n  <sheets>\n    <sheet name="Brask &amp; Velloran" sheetId="1" r:id="rId1"/>\n  </sheets>\n</workbook>\n`;
    const root = fixture({
      ...CLEAN,
      "test/fixtures/board.xlsx": zipSync({ "xl/workbook.xml": strToU8(workbook), "xl/sharedStrings.xml": strToU8("<sst><si><t>neutral</t></si></sst>") }),
      "system/.os/skills/sample/assets/items.csv": `Title,Description\nItem,"<p>Built for Brask &amp; Velloran</p>"\n`,
      "docs/decimal.md": "one\nBrask &#38; Velloran\n",
      "docs/hex.html": "<p>Brask &#x26; Velloran</p>\n<p>&#x7A;&#101;ntrova</p>\n",
    });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    for (const label of ["test/fixtures/board.xlsx!xl/workbook.xml:decoded 4", "system/.os/skills/sample/assets/items.csv:decoded 2", "docs/decimal.md:decoded 2", "docs/hex.html:decoded 1", "docs/hex.html:decoded 2"]) {
      assert.ok(result.stdout.includes(`deny-list: match in ${label}\n`), `missing ${label}`);
    }
    // The raw text alone holds none of them.
    assertOutputMatches(result.stdout, /; 5 match\(es\);/);
    assertNoTerm(result.all);
  });

  it("finds a percent-encoded name in a Markdown link and a query string, and in a file name, which it redacts", () => {
    const root = fixture({
      ...CLEAN,
      "docs/links.md": "# Links\n\n[board](https://example.com/search?q=Brask%20%26%20Velloran)\n\n[other](https://example.com/?q=Quorvex+Talliward)\n",
      "docs/notes-zen%74rova.md": "neutral\n",
    });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1);
    assertOutputMatches(result.stdout, /match in docs\/links\.md:url-decoded 3\n/);
    assertOutputMatches(result.stdout, /match in docs\/links\.md:url-decoded 5\n/);
    assertOutputMatches(result.stdout, /match in docs\/\[name on the deny list\]:name\n/);
    assert.ok(!result.all.includes("%74rova"), "the encoded file name is redacted");
    assertNoTerm(result.all);
  });

  it("does not report a decoded line twice when the raw line already matched, and passes clean encoded text", () => {
    const clean = run(["--root", fixture({ ...CLEAN, "docs/ok.md": "Fish &amp; chips at 50%25 off: a+b\n" }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(clean.status, 0, shape(clean.all));
    const both = run(["--root", fixture({ ...CLEAN, "docs/both.md": `${TERM_TWO} &amp; more\n` }), "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(both.status, 1);
    assertOutputMatches(both.stdout, /match in docs\/both\.md:1\n/);
    assertOutputMatches(both.stdout, /; 1 match\(es\);/);
    assertNoTerm(both.all);
  });
});

// The allowed dependency text (scripts/check-deny-list.mjs ALLOWED_DEPENDENCY_HOME).
const SIMULATED_HOME = ["", "home", "web_user"].join("/");
const ALLOWED_TEXT = `HOME: \`${SIMULATED_HOME}\``;
const npmEnv = (cache: string) => ({ npm_config_cache: cache, npm_config_offline: "true", npm_config_update_notifier: "false" });

function packageFixture(files: Record<string, string>): string {
  return fixture({ "package.json": JSON.stringify({ name: "qzv-pack", version: "1.0.0", files: ["dist/"] }), ...files });
}

describe("deny-list check: the allowed dependency path (P7S-R2-04)", () => {
  it("allows the exact text only in the package's dist/buildos.js", () => {
    const cache = fixture({});
    const ok = packageFixture({ "dist/buildos.js": `var e = { USER: \`web_user\`, ${ALLOWED_TEXT}, PATH: \`/\` };\n` });
    const allowed = run(["--root", ok, "--walk", "--pack", ok], { BUILDOS_DENY_LIST: LIST, ...npmEnv(cache) });
    assert.equal(allowed.status, 0, allowed.all);
    assert.match(allowed.stdout, /1 allowed dependency home path\(s\)/);
    const elsewhere = packageFixture({ "dist/buildos.js": "neutral\n", "dist/other.js": `${ALLOWED_TEXT}\n` });
    const other = run(["--root", elsewhere, "--walk", "--pack", elsewhere], { BUILDOS_DENY_LIST: LIST, ...npmEnv(cache) });
    assert.equal(other.status, 1);
    assert.match(other.stdout, /home folder path in dist\/other\.js:1\n/);
    const changed = packageFixture({ "dist/buildos.js": `${ALLOWED_TEXT}\nHOME: \`${SIMULATED_HOME}2\`\n` });
    const drift = run(["--root", changed, "--walk", "--pack", changed], { BUILDOS_DENY_LIST: LIST, ...npmEnv(cache) });
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /home folder path in dist\/buildos\.js:2\n/);
  });

  it("the bundled dependency still defines exactly that text, once (fails when unpdf changes it)", () => {
    const source = readFileSync(join(PACKAGE, "node_modules", "unpdf", "dist", "pdfjs.mjs"), "utf8");
    assert.equal(source.split(SIMULATED_HOME).length - 1, 1, "unpdf's pdf.js build names the simulated home once");
    assert.ok(source.includes(ALLOWED_TEXT.replace(": ", ":")), "unpdf's pdf.js build defines HOME as the allowed text");
  });
});

describe("deny-list check: the repository and the built package, as CI runs it (P7S-R2-04)", () => {
  let stage: string;
  let cache: string;
  before(
    async () => {
      stage = fixture({});
      cache = fixture({});
      await bundle({ outfile: join(stage, "dist", "buildos.js") });
      for (const name of ["package.json", "LICENSE", "SECURITY.md", "THIRD_PARTY_NOTICES.md", "README.md", ".npmrc"]) writeFileSync(join(stage, name), readFileSync(join(PACKAGE, name)));
    },
    { timeout: 180_000 },
  );

  it("the built bundle holds the allowed text once and the simulated home nowhere else", () => {
    const built = readFileSync(join(stage, "dist", "buildos.js"), "utf8");
    assertSame(built.split(ALLOWED_TEXT).length - 1, 1, "the bundle defines the allowed text once");
    assertSame(built.split(SIMULATED_HOME).length - 1, 1, "the simulated home appears only in the allowed text");
  });

  it("passes on this repository's tracked and untracked files and the package file list with a term that is in none of them", { timeout: 180_000 }, () => {
    const term = `qzv${randomBytes(8).toString("hex")}`;
    const result = run(["--root", REPO, "--pack", stage], { BUILDOS_DENY_LIST: term, ...npmEnv(cache) });
    // P7-F-03: the list is random, so the scanner's labels are not redacted for real names; a failure
    // prints the summary counts only, never the captured output.
    const counts = summaryCounts(result.stdout);
    assert.equal(result.status, 0, `exit ${String(result.status)}; ${counts}`);
    assertOutputMatches(result.stdout, /1 allowed dependency home path\(s\)/, `summary (${counts})`);
    assertOutputMatches(result.stdout, /0 match\(es\); 0 home folder path\(s\);.* 0 shipped file\(s\) not fully scanned/, `summary (${counts})`);
    // P7-F-01: every package file was read, also when the staged package is on another drive (Windows CI).
    const read = /; (\d+) of (\d+) package files read\./.exec(result.stdout);
    assert.ok(read !== null && Number(read[1]) > 0 && read[1] === read[2], `package files read (${counts})`);
    assert.ok(!result.all.includes(term), "the output never shows the term");
  });
});

describe("deny-list check: crafted archives (W1 R7 P8 review round 2, P8-R2-06)", () => {
  /** A stored ZIP with the given members in this order (names may repeat), built by hand. */
  function storedZip(members: [string, string][]): Uint8Array {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const [name, text] of members) {
      const nameBytes = Buffer.from(name, "utf8");
      const body = Buffer.from(text, "utf8");
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt32LE(body.length, 18);
      local.writeUInt32LE(body.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt32LE(body.length, 20);
      central.writeUInt32LE(body.length, 24);
      central.writeUInt16LE(nameBytes.length, 28);
      central.writeUInt32LE(offset, 42);
      locals.push(local, nameBytes, body);
      centrals.push(central, nameBytes);
      offset += 30 + nameBytes.length + body.length;
    }
    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(members.length, 8);
    end.writeUInt16LE(members.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return new Uint8Array(Buffer.concat([...locals, directory, end]));
  }

  it("reads both copies of a ZIP member name that occurs twice, so a term in the first copy is found, and fails for a shipped path", () => {
    const zip = storedZip([["word/document.xml", `<w:t>${TERM_TWO}</w:t>`], ["word/document.xml", "<w:t>neutral</w:t>"]]);
    const root = fixture({ ...CLEAN, "system/assets/report.docx": zip });
    const result = run(["--root", root, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1, result.all);
    assertOutputMatches(result.stdout, /deny-list: match in system\/assets\/report\.docx!word\/document\.xml:1/);
    assertOutputMatches(result.stdout, /not fully scanned \(archive member name occurs more than once\) in a shipped path: system\/assets\/report\.docx!word\/document\.xml/);
    assertNoTerm(result.all);
    // A repeated name with no term still fails in a shipped path.
    const quiet = fixture({ ...CLEAN, "system/assets/twice.docx": storedZip([["a.xml", "<a>one</a>"], ["a.xml", "<a>two</a>"]]) });
    const second = run(["--root", quiet, "--walk"], { BUILDOS_DENY_LIST: LIST });
    assert.equal(second.status, 1, second.all);
    assertOutputMatches(second.stdout, /archive member name occurs more than once/);
  });

  it("reads every copy of a tarball path that occurs twice and fails, even when only the first copy holds a term", () => {
    const root = fixture(CLEAN);
    const tgz = join(root, "..", `${randomBytes(4).toString("hex")}.tgz`);
    temps.push(tgz);
    writeFileSync(tgz, tarGzRaw([ustarEntry("package/notes.txt", `a ${TERM_TWO} line\n`), ustarEntry("package/notes.txt", "neutral\n"), TAR_END]));
    const result = run(["--root", root, "--walk", "--tarball", tgz], { BUILDOS_DENY_LIST: LIST });
    assert.equal(result.status, 1, result.all);
    assertOutputMatches(result.stdout, /deny-list: match in \[tarball\]\/notes\.txt:1/);
    assertOutputMatches(result.stdout, /not fully scanned \(path occurs more than once in the tarball\) in a shipped path: \[tarball\]\/notes\.txt/);
    assertNoTerm(result.all);
  });

  it("fails closed on a malformed or truncated tarball instead of scanning the part it could parse", () => {
    const root = fixture(CLEAN);
    const good = ustarEntry("package/a.txt", "neutral\n");
    const cases: [string, Buffer[], RegExp][] = [
      ["truncated body", [ustarEntry("package/a.txt", "x".repeat(2000)).subarray(0, 1024)], /truncated/],
      ["no end block", [good], /no end-of-archive block/],
      ["bad size", [ustarEntry("package/a.txt", "x", { sizeField: "0000000001z\0" }), TAR_END], /size field is not an octal number/],
      ["base-256 size", [Buffer.concat([ustarHeader("package/a.txt", 0, { sizeField: "\u0080" + "\0".repeat(11) })]), TAR_END], /checksum|base-256/],
      ["bad checksum", [ustarEntry("package/a.txt", "x", { badChecksum: true }), TAR_END], /checksum does not match/],
      ["no magic", [ustarEntry("package/a.txt", "x", { noMagic: true }), TAR_END], /no ustar magic/],
      ["bytes after the end", [good, TAR_END, ustarEntry("package/hidden.txt", `${TERM_TWO}\n`)], /bytes follow the end-of-archive block/],
      ["pax size", [ustarEntry("package/PaxHeader", "13 size=9999\n", { typeFlag: "x" }), good, TAR_END], /pax header sets the size/],
    ];
    for (const [label, pieces, pattern] of cases) {
      const tgz = join(root, "..", `${randomBytes(4).toString("hex")}.tgz`);
      temps.push(tgz);
      writeFileSync(tgz, tarGzRaw(pieces));
      const result = run(["--root", root, "--walk", "--tarball", tgz], { BUILDOS_DENY_LIST: LIST });
      assert.equal(result.status, 2, `${label}: ${result.all}`);
      assertOutputMatches(result.stderr, pattern, label);
      assertOutputMatches(result.stderr, /the check failed closed/, label);
      assertNoTerm(result.all);
    }
  });

  it("the strict reader accepts a real npm tarball (the reproducible pack's reader agrees)", () => {
    const entries = readTar(new Uint8Array(gunzipSync(tarGz({ "package/package.json": "{}", "package/dist/a.js": "x" }))));
    assert.deepEqual(entries.map((e) => e.path), ["package/package.json", "package/dist/a.js"]);
    assert.throws(() => readTar(new Uint8Array(Buffer.alloc(512, 1))), TarError);
  });
});
