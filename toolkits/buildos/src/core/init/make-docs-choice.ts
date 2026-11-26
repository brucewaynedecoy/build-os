/** The Make Docs choice of `buildos init` (PRD 20 Make Docs Companion Setup). */

export type MakeDocsChoice =
  /** `--make-docs`, or Yes at the prompt. */
  | "yes"
  /** `--skip-make-docs`, or No at the prompt. */
  | "no"
  /** No flag, in an interactive terminal: ask `MAKE_DOCS_QUESTION`. */
  | "ask"
  /** No flag and no interactive terminal: stop before any write (exit code 10). */
  | "stop";

export const MAKE_DOCS_QUESTION = "Set up Make Docs in this project? [Y/n] ";

/** What the flags and the terminal decide. Both flags together are a usage error, checked by the CLI. */
export function makeDocsChoice(input: { makeDocs: boolean; skipMakeDocs: boolean; interactive: boolean }): MakeDocsChoice {
  if (input.makeDocs) return "yes";
  if (input.skipMakeDocs) return "no";
  return input.interactive ? "ask" : "stop";
}

/** Reads an answer to `MAKE_DOCS_QUESTION`: empty is Yes (the default); `undefined` when the answer is not yes or no. */
export function parseMakeDocsAnswer(answer: string): "yes" | "no" | undefined {
  const text = answer.trim().toLowerCase();
  if (text === "" || text === "y" || text === "yes") return "yes";
  if (text === "n" || text === "no") return "no";
  return undefined;
}
