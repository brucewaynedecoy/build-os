// W1 R7 P7 acceptance A61, A62, and A63 on the source tree:
//
// - A61: `system/` holds no `validate_config.py` and no text that names it.
// - A62: `system/docs/` and `system/.make-docs/` do not exist (the pack
//   check in package.test.ts covers `npm pack`).
// - A63: every relative Markdown link in `system/` and `docs/prd/` resolves
//   to a file or folder, and none points into the removed folders.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { assertNoProblems, assertSame, assertSameList, tag } from "./helpers.ts";

const REPO = resolve(import.meta.dirname, "..", "..", "..");
const SYSTEM = join(REPO, "system");

/** Links that resolve only in an initialized project: `buildos init` writes the target. */
const PROJECT_ONLY_TARGETS = new Set(["system/.os/scripts/AGENTS.md -> ../manifest.json"]);

function files(dir: string, keep: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...files(full, keep));
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

/** Relative Markdown link targets outside code, without the `#anchor`, each with its 1-based line (P7-F-07). */
export function markdownLinkLines(text: string): { target: string; line: number }[] {
  // Code is blanked, not removed, so every link keeps its line number.
  const blank = (code: string) => code.replace(/[^\n]/g, " ");
  const prose = text.replace(/```[\s\S]*?```/g, blank).replace(/`[^`\n]*`/g, blank);
  const out: { target: string; line: number }[] = [];
  for (const match of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1]!;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) continue;
    const path = decodeURI(target.split("#")[0]!);
    if (path !== "") out.push({ target: path, line: prose.slice(0, match.index).split("\n").length });
  }
  return out;
}

/** Relative Markdown link targets outside code, without the `#anchor`. */
export function markdownLinks(text: string): string[] {
  return markdownLinkLines(text).map((link) => link.target);
}

const posix = (path: string): string => path.split(sep).join("/");

/** The buildos-ci.yml push path filter as a matcher (`**` any depth, `*` within one folder). */
function ciPathFilter(): (path: string) => boolean {
  const workflow = readFileSync(join(REPO, ".github", "workflows", "buildos-ci.yml"), "utf8").replace(/\r\n/g, "\n");
  const block = /\n {2}push:\n {4}paths:\n((?: {6}- "[^"]+"\n)+)/.exec(workflow);
  assert.ok(block, "buildos-ci.yml has a push path filter");
  const globs = [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  const patterns = globs.map((glob) => new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`));
  // A folder the tests read is covered when everything under it is.
  return (path) => patterns.some((p) => p.test(path) || p.test(`${path.replace(/\/$/, "")}/x`));
}

/**
 * The repository paths a test source names (P7S-R2-06): a climb from the
 * test folder (`import.meta.dirname`, three `..` from test/, four from
 * test/golden/) or from the package folder (two `..`) to the repository root,
 * or a join from a repository-root constant, followed by string segments.
 */
export function repoPathsIn(source: string, folder: "test" | "test/golden" | "test/conversion-eval"): string[] {
  const out: string[] = [];
  const climb = folder === "test" ? 3 : 4;
  const seg = String.raw`\s*"([^"]+)"`;
  const segs = String.raw`((?:\s*,\s*"[^"]+")+)`;
  const pick = (list: string) => [...list.matchAll(new RegExp(seg, "g"))].map((m) => m[1]!).join("/");
  const forms = [
    new RegExp(String.raw`import\.meta\.dirname${String.raw`\s*,\s*"\.\."`.repeat(climb)}${segs}`, "g"),
    new RegExp(String.raw`\b(?:PACKAGE|packageRoot|PACKAGE_ROOT)${String.raw`\s*,\s*"\.\."`.repeat(2)}${segs}`, "g"),
    new RegExp(String.raw`\b(?:REPO|repoRoot)${segs}`, "g"),
  ];
  for (const form of forms) {
    for (const m of source.matchAll(form)) {
      const path = pick(m[1]!);
      // A command-line flag after a root constant is not a path (`["--root", REPO, "--pack", ...]`).
      if (!path.startsWith("-")) out.push(path);
    }
  }
  return out;
}

function testRepoPaths(): string[] {
  const out: string[] = [];
  const pkg = join(REPO, "toolkits", "buildos");
  for (const folder of ["test", "test/golden", "test/conversion-eval"] as const) {
    for (const name of readdirSync(join(pkg, ...folder.split("/"))).filter((n) => n.endsWith(".ts"))) {
      // The self-test lines of this check hold sample sources, not paths this suite reads.
      const source = readFileSync(join(pkg, ...folder.split("/"), name), "utf8").split("\n").filter((line) => !line.includes("repoPathsIn(`")).join("\n");
      out.push(...repoPathsIn(source, folder));
    }
  }
  return out;
}

describe("system/ package content after W1 R7 P7", () => {
  it("A61: no validate_config.py file and no reference to it under system/", () => {
    const all = files(SYSTEM, () => true);
    // P7S-R2-03: a failure prints counts and tags, never a shipped path.
    assertSameList(all.filter((f) => f.endsWith("validate_config.py")).map((f) => posix(relative(REPO, f))), [], "validate_config.py files");
    const naming = all.filter((f) => readFileSync(f).toString("latin1").includes("validate_config"));
    assertSameList(naming.map((f) => posix(relative(REPO, f))), [], "files that name validate_config");
  });

  it("A62: system/docs/ and system/.make-docs/ do not exist", () => {
    assert.equal(existsSync(join(SYSTEM, "docs")), false);
    assert.equal(existsSync(join(SYSTEM, ".make-docs")), false);
  });

  it("A63: every relative Markdown link in system/ and docs/prd/ resolves, and none points into the removed folders", () => {
    // P7-F-07: a broken link is named by its source file's tag and its line, which
    // `node scripts/locate-hash.ts <tag>` finds; never by the path or the target.
    const broken: string[] = [];
    let count = 0;
    for (const file of [...files(SYSTEM, (n) => n.endsWith(".md")), ...files(join(REPO, "docs", "prd"), (n) => n.endsWith(".md"))]) {
      const source = posix(relative(REPO, file));
      for (const { target, line } of markdownLinkLines(readFileSync(file, "utf8"))) {
        count++;
        const resolved = resolve(dirname(file), target);
        const removed = posix(relative(SYSTEM, resolved));
        if (removed === "docs" || removed.startsWith("docs/") || removed === ".make-docs" || removed.startsWith(".make-docs/")) broken.push(`${tag(source)} line ${line}: a link into a removed folder`);
        else if (!existsSync(resolved) && !PROJECT_ONLY_TARGETS.has(`${source} -> ${target}`)) broken.push(`${tag(source)} line ${line}: a link to a missing file`);
      }
    }
    assertNoProblems(broken, "broken relative links (file tag and line)");
    assert.ok(count > 100, `checked ${count} links`);
  });

  it("P7S-R2-06: every repository path a test reads is inside the buildos-ci.yml path filter", () => {
    const filter = ciPathFilter();
    const outside: string[] = [];
    // 1. Every link target the A63 check resolves.
    for (const file of [...files(SYSTEM, (n) => n.endsWith(".md")), ...files(join(REPO, "docs", "prd"), (n) => n.endsWith(".md"))]) {
      for (const target of markdownLinks(readFileSync(file, "utf8"))) {
        const path = posix(relative(REPO, resolve(dirname(file), target)));
        if (!path.startsWith("../") && !PROJECT_ONLY_TARGETS.has(`${posix(relative(REPO, file))} -> ${target}`) && !filter(path)) outside.push(path);
      }
    }
    // 2. Every repository path a test or test helper names in its source.
    for (const path of testRepoPaths()) if (!filter(path)) outside.push(path);
    assertSameList([...new Set(outside)].sort(), [], "repository paths the tests read that the CI path filter leaves out");
  });

  it("P7S-R2-06: the path-filter check finds a path the filter leaves out", () => {
    const filter = ciPathFilter();
    assert.equal(filter("toolkits/buildos/src/a.ts"), true);
    assert.equal(filter("README.md"), true);
    assert.equal(filter("docs/designs/x.md"), true);
    assert.equal(filter("tools/build-guide.mjs"), false);
    assert.equal(filter("toolkits/buildos-intake/x.go"), false);
    assert.equal(filter("sub/README.md"), false);
    assertSame(repoPathsIn(`const A = join(import.meta.dirname, "..", "..", "..", "tools", "x.mjs");\nconst B = resolve(PACKAGE, "..", "..", "guide", "content");\nconst C = join(REPO, "USE_CASES.md");`, "test"), ["tools/x.mjs", "guide/content", "USE_CASES.md"]);
  });

  it("the link reader skips code, URLs, and anchors", () => {
    assert.deepEqual(markdownLinks("[a](x.md#h) `[b](no.md)` [c](https://e.test) [d](#top)\n```\n[e](no2.md)\n```\n[f](../y%20z.md)"), ["x.md", "../y z.md"]);
  });
});
