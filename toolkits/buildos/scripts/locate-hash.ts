// Finds the item behind a tag that a failing test printed (W1 R7 P7 skills
// review round 2, P7S-R2-03; final check, P7-F-07). Tests that enumerate
// shipped, imported, or guide content never print a discovered name or value;
// they print `#` and the first 8 hex digits of the SHA-256 of it instead
// (test/helpers.ts `tag`), often with a line number.
//
// Usage, from toolkits/buildos/:
//
//   node scripts/locate-hash.ts <tag> [<tag> ...] [--root <folder>]
//
// It walks --root (default: the repository root; `.git` and `node_modules`
// are skipped) and hashes every form a test tags:
//
// - a path: for every file and folder, the path relative to the root, every
//   shorter suffix of it (`skills/x/SKILL.md`, `x/SKILL.md`, ...), the same
//   with a trailing `/`, and each single name in it;
// - a value inside a text file: each line (as it is, and trimmed), and each
//   word-like token of a line (an ID, a key, a placeholder, a heading word),
//   so a tag of an ID in a guide example or a key in a skill's code is found
//   with its file and line.
//
// It prints each match as `<tag> <relative path>[:<line>] (<form>)` on this
// machine only; nothing leaves it.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEXT_LIMIT = 4 * 1024 * 1024;

export const tag = (name: string): string => `#${createHash("sha256").update(name, "utf8").digest("hex").slice(0, 8)}`;

/** Every tag form of `root` that is in `wanted`, as printable lines, sorted. */
export function locate(root: string, wanted: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  const check = (candidate: string, where: string, form: string) => {
    const t = tag(candidate);
    if (wanted.has(t)) found.add(`${t} ${where} (${form})`);
  };
  const visitPath = (relative: string) => {
    const parts = relative.split("/");
    const candidates = new Set<string>([...parts]);
    for (let i = 0; i < parts.length; i += 1) {
      candidates.add(parts.slice(i).join("/"));
      candidates.add(`${parts.slice(i).join("/")}/`);
    }
    for (const candidate of candidates) check(candidate, relative, candidate === relative ? "path" : `path as "${candidate}"`);
  };
  const visitText = (full: string, relative: string) => {
    let data: Buffer;
    try {
      if (statSync(full).size > TEXT_LIMIT) return;
      data = readFileSync(full);
    } catch {
      return;
    }
    if (data.subarray(0, 8192).includes(0)) return;
    const lines = data.toString("utf8").replace(/^﻿/, "").split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (line.trim() === "") continue;
      const where = `${relative}:${index + 1}`;
      check(line, where, "line");
      if (line.trim() !== line) check(line.trim(), where, "line");
      for (const token of line.match(/[^\s"'`,;()[\]{}<>|=]+/g) ?? []) {
        check(token, where, "value");
        const bare = token.replace(/^[^\p{L}\p{N}_#$.-]+|[^\p{L}\p{N}_]+$/gu, "");
        if (bare !== token && bare !== "") check(bare, where, "value");
      }
    }
  };
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      visitPath(relative);
      if (entry.isDirectory()) walk(join(dir, entry.name), relative);
      else if (entry.isFile()) visitText(join(dir, entry.name), relative);
    }
  };
  walk(root, "");
  return [...found].sort();
}

if (process.argv[1] !== undefined && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let root = resolve(import.meta.dirname, "..", "..", "..");
  const wanted = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--root") {
      const next = args[i + 1];
      if (next === undefined) throw new Error("--root needs a folder");
      root = resolve(next);
      i += 1;
    } else wanted.add(arg.startsWith("#") ? arg : `#${arg}`);
  }
  if (wanted.size === 0) {
    process.stderr.write("Usage: node scripts/locate-hash.ts <tag> [<tag> ...] [--root <folder>]\n");
    process.exit(2);
  }
  const found = locate(root, wanted);
  for (const line of found) process.stdout.write(`${line}\n`);
  process.stdout.write(`${found.length} match(es) for ${wanted.size} tag(s) under ${root}\n`);
  process.exitCode = found.length > 0 ? 0 : 1;
}
