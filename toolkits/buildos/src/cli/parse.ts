/**
 * The shared flag parser. It follows the Go `flag` package rules that the Go
 * seed (`internal/cli/`) uses, so every flag spelling and every usage error
 * message matches the seed byte for byte:
 *
 * - `-name` and `--name` are the same flag. `-name=value` and `--name=value`
 *   set a value inline.
 * - A boolean flag takes no separate value. `-json=<v>` accepts Go
 *   `strconv.ParseBool` values: 1, t, T, TRUE, true, True, 0, f, F, FALSE,
 *   false, False.
 * - A string flag takes its value inline or from the next argument, even when
 *   that argument starts with `-`.
 * - Parsing stops at the first non-flag argument, at a lone `-`, or after
 *   `--`. Everything after that is positional.
 * - The last value of a repeated flag wins.
 * - Parsing stops at the first error. Flags parsed before it keep their value.
 *   An invalid boolean value sets that flag to false first, as Go
 *   `boolValue.Set` does, so `--json --json=maybe` reports the error as text.
 * - Flag names and boolean values match own entries only, so a name or value
 *   such as `constructor` or `__proto__` never matches `Object.prototype`.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import { goQuote } from "../core/shared/go-quote.ts";
import { UsageError } from "./usage-error.ts";

export type FlagKind = "boolean" | "string";
export type FlagSpec = Readonly<Record<string, FlagKind>>;
export type FlagValues<S extends FlagSpec> = { -readonly [K in keyof S]?: S[K] extends "boolean" ? boolean : string };

export interface ParsedFlags<S extends FlagSpec> {
  values: FlagValues<S>;
  /** Arguments after the flags, in order. */
  positionals: string[];
}

/** A Go `flag` parse error. `partial` holds the flags parsed before it. */
export class FlagParseError<S extends FlagSpec = FlagSpec> extends Error {
  readonly partial: ParsedFlags<S>;

  constructor(message: string, partial: ParsedFlags<S>) {
    super(message);
    this.name = "FlagParseError";
    this.partial = partial;
  }
}

/** Go `flag.ErrHelp` text, for `-h`, `-help`, and `--help` when not defined. */
export const GO_FLAG_HELP_REQUESTED = "flag: help requested";

/**
 * Go `strconv.ParseBool` values. A `Map`, not an object, so a value such as
 * `constructor`, `toString`, or `__proto__` cannot match an inherited
 * `Object.prototype` member.
 */
const GO_BOOL_VALUES: ReadonlyMap<string, boolean> = new Map([
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

/** The kind of flag `name`, from the spec's own properties only. */
function flagKind(spec: FlagSpec, name: string): FlagKind | undefined {
  if (!Object.hasOwn(spec, name)) return undefined;
  const kind: unknown = spec[name];
  return kind === "boolean" || kind === "string" ? kind : undefined;
}

/** Sets an own property, so a flag named `__proto__` cannot reach the prototype. */
function setValue(values: Record<string, boolean | string>, name: string, value: boolean | string): void {
  Object.defineProperty(values, name, { value, writable: true, enumerable: true, configurable: true });
}

/** Parses `args` with Go `flag` rules. Throws `FlagParseError`. */
export function parseGoFlags<S extends FlagSpec>(spec: S, args: readonly string[]): ParsedFlags<S> {
  const values: Record<string, boolean | string> = {};
  const parsed = { values: values as FlagValues<S>, positionals: [] as string[] };
  let index = 0;
  while (index < args.length) {
    const arg = args[index]!;
    if (arg.length < 2 || !arg.startsWith("-")) break;
    let minuses = 1;
    if (arg[1] === "-") {
      minuses = 2;
      if (arg.length === 2) {
        index++;
        break;
      }
    }
    let name = arg.slice(minuses);
    if (name.length === 0 || name.startsWith("-") || name.startsWith("=")) {
      throw new FlagParseError(`bad flag syntax: ${arg}`, parsed);
    }
    index++;
    let value: string | undefined;
    const equals = name.indexOf("=", 1);
    if (equals !== -1) {
      value = name.slice(equals + 1);
      name = name.slice(0, equals);
    }
    const kind = flagKind(spec, name);
    if (kind === undefined) {
      if (name === "help" || name === "h") throw new FlagParseError(GO_FLAG_HELP_REQUESTED, parsed);
      throw new FlagParseError(`flag provided but not defined: -${name}`, parsed);
    }
    if (kind === "boolean") {
      if (value === undefined) {
        setValue(values, name, true);
      } else {
        const boolean = GO_BOOL_VALUES.get(value);
        if (boolean === undefined) {
          setValue(values, name, false);
          throw new FlagParseError(`invalid boolean value ${goQuote(value)} for -${name}: parse error`, parsed);
        }
        setValue(values, name, boolean);
      }
      continue;
    }
    if (value === undefined) {
      if (index >= args.length) throw new FlagParseError(`flag needs an argument: -${name}`, parsed);
      value = args[index]!;
      index++;
    }
    setValue(values, name, value);
  }
  parsed.positionals = args.slice(index);
  return parsed;
}

/**
 * True when `args` holds the literal `--json`. This is the Go seed
 * `containsJSON` rule, which picks the output form of a usage error before
 * any flag is parsed.
 */
export function wantsJson(args: readonly string[]): boolean {
  return args.includes("--json");
}

/**
 * Parses a command's flags with Go rules and turns a parse error into a
 * `UsageError`. `jsonOnError` picks the output form of that error from the
 * flags parsed before it, or from the raw arguments.
 */
export function parseCommandFlags<S extends FlagSpec>(
  command: string,
  spec: S,
  args: readonly string[],
  jsonOnError: (partial: FlagValues<S>, args: readonly string[]) => boolean,
): ParsedFlags<S> {
  try {
    return parseGoFlags(spec, args);
  } catch (error) {
    if (error instanceof FlagParseError) {
      throw new UsageError(error.message, { command, json: jsonOnError((error as FlagParseError<S>).partial.values, args) });
    }
    throw error;
  }
}

export { goIsPrint, goQuote } from "../core/shared/go-quote.ts";
