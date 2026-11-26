// Captures Go seed CLI output as golden fixtures for the parity tests.
//
// The Go sources are gone since W1 R7 P8. Build the Go tool from a worktree
// of the frozen baseline commit 263f5ca (test/golden/CAPTURE.md, Frozen Go
// Baseline); the paths below are inside that worktree.
// Build the seed first, from `toolkits/buildos/`:
//   go build -o <scratch>/buildos-go ./cmd/buildos
// Then:
//   node scripts/capture-go-goldens.ts <scratch>/buildos-go
//
// Writes test/fixtures/go-seed/cli-goldens.json. The seed build uses the
// default build identity (version `dev`, source revision `unknown`).

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface GoldenCase {
  args: string[];
  stdout: string;
  stderr: string;
  exit: number;
}

/** Argument lists to capture. Later phases add their domain cases here. */
export const CAPTURE_CASES: readonly string[][] = [
  // Root and help.
  [],
  ["help"],
  ["--help"],
  ["-h"],
  ["help", "--json"],
  ["help", "x"],
  ["help", "version"],
  ["help", "help"],
  ["bogus"],
  ["bogus", "--json"],
  ["--json"],
  ["-x"],
  ["Version"],
  // version: every Go flag spelling, and the usage errors.
  ["version"],
  ["version", "-json"],
  ["version", "--json"],
  ["version", "-json=true"],
  ["version", "--json=true"],
  ["version", "-json=false"],
  ["version", "--json=false"],
  ["version", "--json=1"],
  ["version", "--json=T"],
  ["version", "-json=0"],
  ["version", "--json="],
  ["version", "--json=maybe"],
  ["version", "-json=yes"],
  ["version", "--json", "--json=false"],
  ["version", "-json", "true"],
  ["version", "--bad"],
  ["version", "-bad"],
  ["version", "--bad", "--json"],
  ["version", "--json", "--bad"],
  ["version", "-json", "--bad"],
  ["version", "x"],
  ["version", "--json", "x"],
  ["version", "x", "--json"],
  ["version", "-"],
  ["version", "--"],
  ["version", "--", "x"],
  ["version", "--json", "--", "x"],
  ["version", "---json"],
  ["version", "--=x"],
  ["version", "-=x"],
  ["version", "-help"],
  ["version", "--help"],
  ["version", "-h"],
  ["version", "help"],
  // Object.prototype keys: as boolean values, flag names, and commands. A
  // parser that reads a plain object without an own-property check accepts
  // these; Go rejects every one with a usage error.
  ["version", "--json=constructor"],
  ["version", "--json=toString"],
  ["version", "-json=__proto__"],
  ["version", "--json=hasOwnProperty"],
  ["version", "--json=valueOf"],
  ["version", "--json", "--json=toString"],
  ["version", "--constructor"],
  ["version", "-toString"],
  ["version", "--__proto__"],
  ["version", "--hasOwnProperty"],
  ["version", "--valueOf"],
  ["version", "-constructor=1"],
  ["version", "--__proto__=x"],
  ["version", "--json", "--__proto__"],
  ["constructor"],
  ["__proto__"],
  ["toString", "--json"],
  // Go strconv.Quote escaping in usage errors (review round 4). Go 1.24.1
  // uses Unicode 15.0.0 tables, so a newer character is escaped even where
  // Node's Unicode data calls it printable.
  ["version", "--json=\u{1fae9}"], // emoji, Unicode 16: \U0001fae9
  ["version", "--json=\u{1f600}"], // emoji, Unicode 6.1: kept as is
  ["version", "--json=\u0897"], // Arabic pepet, Unicode 16, BMP: \u0897
  ["version", "--json=\u0378"], // unassigned BMP code point
  ["version", "--json=\u{e0001}"], // language tag (Cf), astral
  ["version", "--json=\x01\x1b\x7f"], // control characters
  ["version", "--json=\x07\b\f\n\r\t\v"], // control characters with letter escapes
  ["version", "--json=e\u0301"], // combining mark: printable
  ["version", "--json=\u00a0\u00ad\u200b\u200d\u2028"], // spaces, soft hyphen, format, line separator
  ["version", "--json=\ufffd"], // replacement character: printable
  // A lone surrogate cannot reach either CLI: spawning with "\ud800" sends
  // the UTF-8 bytes of U+FFFD, the case above.
  ["version", '--json="\\'], // quote and backslash
  ["\u{1fae9}"], // unknown command
  ["bogus\u0301\u200b"],
  // entities: help and usage errors. The domain is ported in P3.
  ["entities"],
  ["entities", "--help"],
  ["entities", "-h"],
  ["entities", "help"],
  ["entities", "bogus"],
  ["entities", "resolve", "--root"],
  ["entities", "resolve", "--json", "--bad"],
  ["entities", "resolve", "-json", "--bad"],
  ["entities", "resolve", "-root=/x", "--mode", "strict", "--id", "a", "--bad"],
  ["entities", "validate", "--root", "a", "--mode", "bad"],
  ["entities", "rebuild-index", "--check", "--apply", "--root", "a", "--mode", "compat"],
];

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const binary = process.argv[2];
  if (binary === undefined) {
    process.stderr.write("usage: node scripts/capture-go-goldens.ts <go-seed-binary>\n");
    process.exit(2);
  }
  const cases: GoldenCase[] = CAPTURE_CASES.map((args) => {
    const result = spawnSync(binary, args, { encoding: "utf8" });
    if (result.error !== undefined || result.status === null) {
      throw new Error(`could not run the Go seed for ${JSON.stringify(args)}: ${result.error?.message ?? "signal"}`);
    }
    return { args, stdout: result.stdout, stderr: result.stderr, exit: result.status };
  });
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "go-seed", "cli-goldens.json");
  const header = {
    source: "Go seed toolkits/buildos/cmd/buildos, default build identity",
    capture: "node scripts/capture-go-goldens.ts <go-seed-binary>",
  };
  writeFileSync(out, `${JSON.stringify({ ...header, cases }, null, 2)}\n`);
  process.stdout.write(`wrote ${cases.length} cases\n`);
}
