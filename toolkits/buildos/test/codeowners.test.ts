// W1 R7 P8 final check, P8-F-04: `.github/CODEOWNERS` covers every file that
// decides what a green release check means. The covered set is computed, not
// listed by hand: every file a workflow `run:` line names (globs expanded),
// every file the release and CI scripts import, transitively, and every file
// they read or start by a path in their code (the eval corpus and runner, the
// golden harness, the planted-failure fixtures, the SBOM policy inputs, the
// vendored schemas). A file outside every CODEOWNERS pattern fails the test.

import assert from "node:assert/strict";
import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const PKG = "toolkits/buildos";
const OWNER = "@brucewaynedecoy";
const WORKFLOWS = ["buildos-ci.yml", "buildos-deny-list.yml", "buildos-release.yml"];

/** CODEOWNERS patterns as matchers (the subset this repository uses: an anchored path, a folder with a trailing slash, `*` inside one segment). */
export function codeownersMatchers(text: string): { pattern: string; owners: string[]; matches: (path: string) => boolean }[] {
  const rules = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [pattern = "", ...owners] = line.split(/\s+/);
    assert.ok(pattern.startsWith("/"), `CODEOWNERS pattern ${pattern} is anchored at the repository root`);
    const folder = pattern.endsWith("/");
    const body = pattern.slice(1, folder ? -1 : undefined);
    const source = body
      .split("/")
      .map((segment) => segment.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*"))
      .join("/");
    const regex = new RegExp(folder ? `^${source}/.+$` : `^${source}(?:/.+)?$`);
    rules.push({ pattern, owners, matches: (path: string) => regex.test(path) });
  }
  return rules;
}

/** Repository paths named in the `run:` scripts of a workflow (relative to toolkits/buildos, to the trusted checkout, or to the root). */
export function runLinePaths(workflow: string): string[] {
  const found = new Set<string>();
  const lines = workflow.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:- )?run: ?(.*)$/.exec(lines[i] ?? "");
    if (m === null) continue;
    const body = [m[2] ?? ""];
    if (m[2] === "|") {
      const indent = (m[1] ?? "").length;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? "";
        if (next.trim() !== "" && next.length - next.trimStart().length <= indent) break;
        body.push(next);
      }
    }
    for (const p of body.join("\n").matchAll(/(?:trusted\/)?(?:toolkits\/buildos\/)?((?:scripts|test|src)\/[A-Za-z0-9_./*-]+\.(?:ts|mjs|cjs|js|json))/g)) found.add(`${PKG}/${p[1] ?? ""}`);
  }
  return [...found];
}

/** Files a script imports, reads, or starts by a path in its code, relative to the repository. */
export function scriptReferences(file: string): string[] {
  const text = readFileSync(join(repoRoot, file), "utf8");
  const dir = posix.dirname(file);
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*)"(\.{1,2}\/[^"]+)"/g)) out.add(posix.normalize(posix.join(dir, m[1] ?? "")));
  // join(PACKAGE_ROOT, "a", "b"), join(packageRoot, ...), and join("test", ...) with string parts only.
  for (const m of text.matchAll(/join\(\s*(?:PACKAGE_ROOT|packageRoot)?\s*,?\s*((?:"[^"]+"\s*,\s*)*"[^"]+")\s*\)/g)) {
    const parts = [...(m[1] ?? "").matchAll(/"([^"]+)"/g)].map((p) => p[1] ?? "");
    if (["test", "scripts", "src"].includes(parts[0] ?? "") || /\.(?:md|json|txt)$/.test(parts.at(-1) ?? "")) out.add(posix.join(PKG, ...parts));
  }
  for (const m of text.matchAll(/"((?:test|scripts)\/[A-Za-z0-9_./*-]+\.(?:ts|mjs|json))"/g)) out.add(posix.join(PKG, m[1] ?? ""));
  return [...out];
}

function expand(path: string): string[] {
  if (path.includes("*")) return globSync(path, { cwd: repoRoot }).map((p) => p.split(sep).join("/"));
  if (!existsSync(join(repoRoot, path))) return [];
  if (statSync(join(repoRoot, path)).isDirectory()) return globSync(`${path}/**/*`, { cwd: repoRoot }).map((p) => p.split(sep).join("/")).filter((p) => statSync(join(repoRoot, p)).isFile());
  return [path];
}

/** The release-relevant set: run-line files, the scripts' transitive references, the vendored schemas, and the workflow and CODEOWNERS files. */
export function releaseRelevantFiles(): string[] {
  const files = new Set<string>([".github/CODEOWNERS", ...WORKFLOWS.map((w) => `.github/workflows/${w}`)]);
  const queue: string[] = [];
  for (const w of WORKFLOWS) for (const p of runLinePaths(readFileSync(join(repoRoot, ".github", "workflows", w), "utf8"))) for (const f of expand(p)) queue.push(f);
  // The release and CI scripts themselves (the workflows start some of them through npm scripts or through other scripts).
  for (const f of expand(`${PKG}/scripts/*.ts`)) queue.push(f);
  for (const f of expand(`${PKG}/scripts/*.mjs`)) queue.push(f);
  while (queue.length > 0) {
    const f = queue.pop() as string;
    if (files.has(f)) continue;
    files.add(f);
    // Follow references out of the scripts and the gate runners; a unit test's imports of src/ are product code, not a gate definition.
    // The gate runners (golden harness, eval runner) import the product code they test from src/; that is the code under test, not a gate definition, so only the scripts' references into src/ (the build's package-content rules) count.
    const fromScripts = f.startsWith(`${PKG}/scripts/`);
    const follow = fromScripts || f.startsWith(`${PKG}/test/golden/`) || f.startsWith(`${PKG}/test/conversion-eval/`);
    if (follow && /\.(?:ts|mjs)$/.test(f) && !f.startsWith(`${PKG}/src/`)) for (const r of scriptReferences(f)) for (const e of expand(r)) if (fromScripts || !e.startsWith(`${PKG}/src/`)) queue.push(e);
  }
  for (const f of expand(`${PKG}/scripts/schemas`)) files.add(f);
  for (const name of ["package.json", "package-lock.json", ".npmrc", "tsconfig.json", "release-candidates.json", "SECURITY.md", "THIRD_PARTY_NOTICES.md"]) files.add(`${PKG}/${name}`);
  return [...files].filter((f) => !f.startsWith(`${PKG}/dist/`)).sort();
}

describe("CODEOWNERS covers every file that decides a release check (P8-F-04)", () => {
  const rules = codeownersMatchers(readFileSync(join(repoRoot, ".github", "CODEOWNERS"), "utf8"));
  const files = releaseRelevantFiles();

  it("every pattern names the maintainer", () => {
    assert.ok(rules.length > 0);
    for (const r of rules) assert.deepEqual(r.owners, [OWNER], r.pattern);
  });

  it("the computed set holds the gate implementations and policy inputs the review found missing", () => {
    for (const f of [
      ".github/CODEOWNERS",
      `${PKG}/scripts/sbom.ts`,
      `${PKG}/scripts/json-schema.ts`,
      `${PKG}/scripts/schemas/cyclonedx-1.5/bom-1.5.schema.json`,
      `${PKG}/scripts/osv-gate.ts`,
      `${PKG}/scripts/check-dependencies.ts`,
      `${PKG}/scripts/dependency-policy.ts`,
      `${PKG}/scripts/reproducible-pack.ts`,
      `${PKG}/scripts/build.ts`,
      `${PKG}/scripts/release-build.ts`,
      `${PKG}/test/conversion-eval/eval.test.ts`,
      `${PKG}/test/conversion-eval/manifest.json`,
      `${PKG}/test/golden/harness.ts`,
      `${PKG}/test/golden/compare.test.ts`,
      `${PKG}/test/deny-list.test.ts`,
      `${PKG}/src/core/init/make-docs-range.ts`,
      `${PKG}/src/adapters/package-content.ts`,
    ]) assert.ok(files.includes(f), `${f} is in the computed set`);
  });

  it("every one of those files is covered by a CODEOWNERS pattern", () => {
    const uncovered = files.filter((f) => !rules.some((r) => r.matches(f)));
    assert.deepEqual(uncovered, []);
  });

  it("the matcher follows the CODEOWNERS forms used here", () => {
    const [folder, glob, file] = codeownersMatchers("/a/b/ @o\n/a/c-* @o\n/a/d.txt @o\n");
    assert.equal(folder?.matches("a/b/x/y.ts"), true);
    assert.equal(folder?.matches("a/bc/x"), false);
    assert.equal(glob?.matches("a/c-1.ts"), true);
    assert.equal(glob?.matches("a/c/1.ts"), false);
    assert.equal(file?.matches("a/d.txt"), true);
    assert.equal(file?.matches("a/d.txtx"), false);
  });
});
