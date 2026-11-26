/**
 * A port of a Go `flag.FlagSet` with `ContinueOnError`, as the Go discovery
 * and design tools use it: string, boolean, and repeatable (`flag.Value`
 * list) flags, Go's parse rules, and the exact text Go writes to its output
 * on an error (the message, then `Usage of <name>:` and `PrintDefaults`).
 * The P1 parser (`parse.ts`) has no list flags and no usage printout, so the
 * legacy-tool ports use this one.
 */

import { goQuote } from "../core/shared/go-quote.ts";

export type GoFlagKind = "string" | "bool" | "list";

export interface GoFlagDef {
  name: string;
  kind: GoFlagKind;
  usage: string;
  /** Default of a string flag. */
  default?: string;
}

export interface GoFlagParse {
  strings: Map<string, string>;
  bools: Map<string, boolean>;
  lists: Map<string, string[]>;
  /** The arguments after the flags (the Go tools ignore them). */
  args: string[];
  /** The TypeScript-only switches (`options.extras`) found in flag position. */
  extras: Set<string>;
}

export interface GoParseOptions {
  /**
   * Exact TypeScript-only switches, such as `--json` (PE-011) and
   * `--allow-outside-root` (PE-012), that the Go tool does not define. Each is
   * recognized only as a whole argument in flag position: before the first
   * non-flag argument and before `--`, and never as the value of a flag
   * (`--title --json` sets the title to `--json`, as in Go). They take no
   * value and are not listed in the usage text.
   */
  extras?: readonly string[];
}

/** A parse failure: `output` is what Go wrote to the flag set's output, `message` is the returned error. */
export class GoFlagError extends Error {
  readonly output: string;
  /** The extra switches found in flag position before the error. */
  readonly extras: ReadonlySet<string>;

  constructor(message: string, output: string, extras: ReadonlySet<string> = new Set()) {
    super(message);
    this.name = "GoFlagError";
    this.output = output;
    this.extras = extras;
  }
}

const BOOL_VALUES = new Map([
  ["1", true],
  ["t", true],
  ["T", true],
  ["TRUE", true],
  ["true", true],
  ["True", true],
  ["0", false],
  ["f", false],
  ["F", false],
  ["FALSE", false],
  ["false", false],
  ["False", false],
]);

/** Go `FlagSet.PrintDefaults`, for flags sorted by name. */
export function goPrintDefaults(defs: readonly GoFlagDef[]): string {
  let out = "";
  for (const def of [...defs].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    let line = `  -${def.name}`;
    const typeName = def.kind === "string" ? "string" : def.kind === "list" ? "value" : "";
    if (typeName !== "") line += ` ${typeName}`;
    // Go puts a one-letter flag's usage on the same line.
    line += line.length <= 4 ? "\t" : "\n    \t";
    line += def.usage.replaceAll("\n", "\n    \t");
    if (def.kind === "string" && (def.default ?? "") !== "") line += ` (default ${goQuote(def.default!)})`;
    out += `${line}\n`;
  }
  return out;
}

/** Parses `args` as Go's `FlagSet.Parse` with `ContinueOnError`. Throws `GoFlagError`. */
export function goParseFlags(setName: string, defs: readonly GoFlagDef[], args: readonly string[], options: GoParseOptions = {}): GoFlagParse {
  const byName = new Map(defs.map((d) => [d.name, d]));
  const extras = new Set(options.extras ?? []);
  const result: GoFlagParse = { strings: new Map(), bools: new Map(), lists: new Map(), args: [], extras: new Set() };
  for (const def of defs) {
    if (def.kind === "string") result.strings.set(def.name, def.default ?? "");
    else if (def.kind === "bool") result.bools.set(def.name, false);
    else result.lists.set(def.name, []);
  }
  const usage = () => `Usage of ${setName}:\n${goPrintDefaults(defs)}`;
  const fail = (message: string): never => {
    throw new GoFlagError(message, `${message}\n${usage()}`, result.extras);
  };
  let index = 0;
  while (index < args.length) {
    const arg = args[index]!;
    if (arg.length < 2 || arg[0] !== "-") break;
    let minuses = 1;
    if (arg[1] === "-") {
      minuses++;
      if (arg.length === 2) {
        index++;
        break;
      }
    }
    if (extras.has(arg)) {
      result.extras.add(arg);
      index++;
      continue;
    }
    let name = arg.slice(minuses);
    if (name.length === 0 || name[0] === "-" || name[0] === "=") fail(`bad flag syntax: ${arg}`);
    index++;
    let value: string | undefined;
    const equals = name.indexOf("=", 1);
    if (equals !== -1) {
      value = name.slice(equals + 1);
      name = name.slice(0, equals);
    }
    const def = byName.get(name);
    if (def === undefined) {
      if (name === "help" || name === "h") throw new GoFlagError("flag: help requested", usage(), result.extras);
      fail(`flag provided but not defined: -${name}`);
    }
    if (def!.kind === "bool") {
      if (value === undefined) {
        result.bools.set(name, true);
      } else {
        const parsed = BOOL_VALUES.get(value);
        if (parsed === undefined) fail(`invalid boolean value ${goQuote(value)} for -${name}: parse error`);
        result.bools.set(name, parsed!);
      }
      continue;
    }
    if (value === undefined) {
      if (index >= args.length) fail(`flag needs an argument: -${name}`);
      value = args[index]!;
      index++;
    }
    if (def!.kind === "string") result.strings.set(name, value);
    else result.lists.get(name)!.push(value);
  }
  result.args = args.slice(index);
  return result;
}
