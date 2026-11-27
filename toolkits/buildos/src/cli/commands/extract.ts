/**
 * The `buildos extract` adapter (W1 R7 P9 t4, t7). One operation today:
 * `buildos extract bulk`, the port of the skill script
 * `buildos-bulk-extract/scripts/work.py`. Human output is the script's own
 * text (stdout, and `Error: <message>` on stderr); `--json` gives the
 * shared envelope. Exit codes (PRD 20): 0 done, 2 usage, 3 an input cannot
 * be read or parsed (also standard input over 128 MiB), 4 a check failed
 * (also `check` on a review that is not ready), 5 a write failed, 10 a failed
 * write that could not be undone.
 */

import { hostname } from "node:os";
import { sep } from "node:path";
import { nodeHash } from "../../adapters/node-hash.ts";
import { BULK_SUBCOMMANDS, runBulk } from "../../core/extract/bulk.ts";
import { PyException } from "../../core/shared/py-text.ts";
import { READ_LIMITS } from "../../core/shared/read-limits.ts";
import type { CommandContext, CommandOutcome, Domain } from "../domain.ts";
import { StdinTooLargeError } from "../io.ts";
import { UsageError } from "../usage-error.ts";
import { renderSkillRun, takeSharedFlags, wantsHelp, wantsJson } from "./skill-output.ts";

export const EXTRACT_BULK_HELP = `Usage:
  buildos extract bulk [--root <folder>] [--json] <subcommand> [arguments]

Tracks the source reviews of a bulk extraction in a BuildOS project, for the
buildos-bulk-extract skill. It reads .os/indexes/references.json and keeps
one review file per source in extractions/, staged rows in
extractions/staging/, and published rows in .os/data/.

Subcommands:
  status                               counts of sources by review state
  next [--count N] [--stage extract|review]
                                       the next sources to extract or review
  show REF-ID                          a source, its converted files, and its candidates
  start REF-ID                         creates the review file of a source
  template TYPE                        an empty candidate of a row type
  check REF-ID                         checks a review and every link it names
  stage REF-ID [--author NAME]         stages the reviewed candidates (Stage 1)
  stage-update REF-ID ROW-ID --key KEY copies a saved row into the review to correct it
  replace-row REF-ID KEY               replaces a staged row with the JSON row on standard input
  decide REF-ID --reviewer NAME        records Stage 2 decisions (JSON list on standard input)
  publish REF-ID                       publishes approved rows to .os/data/

TYPE is one of requirement, capability, persona, test-case, result, run, finding.

  --root <folder>   the project folder (default: the current folder)
  --json            print the stable JSON envelope

Exit codes:
  0  done
  2  the command was not written correctly
  3  a file cannot be read or parsed
  4  a check failed, or check found a review that is not ready
  5  a write failed (every change was put back)
  10 a write failed and BuildOS could not put back every change
`;

export const EXTRACT_HELP = `Usage:
  buildos extract bulk [--root <folder>] [--json] <subcommand> [arguments]

Extraction work.

Operations:
  bulk   source reviews of a bulk extraction (status, next, show, start,
         template, check, stage, stage-update, replace-row, decide, publish)

Run "buildos extract bulk --help" for the subcommands.
`;

export const extractDomain: Domain = {
  name: "extract",
  summary: "Track the source reviews of a bulk extraction",
  help: EXTRACT_HELP,
  run: runExtract,
};

function runExtract(args: readonly string[], context: CommandContext): CommandOutcome {
  const [operation, ...rest] = args;
  const json = wantsJson(args);
  if (operation !== "bulk") {
    context.setCommand("extract");
    throw new UsageError(operation === undefined ? "extract needs an operation: bulk" : `unknown extract operation "${operation}"; the operation is bulk`, { command: "buildos extract", json });
  }
  const flags = takeSharedFlags(rest, false);
  const subcommand = flags.rest[0];
  const command = subcommand !== undefined && (BULK_SUBCOMMANDS as readonly string[]).includes(subcommand) ? `extract.bulk.${subcommand}` : "extract.bulk";
  context.setCommand(command);
  if (flags.error !== undefined) throw new UsageError(flags.error, { command: "buildos extract bulk", json: flags.json });
  // P9-R1-15: `--help` at any level (`extract bulk next --help`) prints the help and exits 0, as argparse did.
  if (wantsHelp(flags.rest) || subcommand === "help") return { rendered: { stdout: EXTRACT_BULK_HELP, stderr: "", exitCode: 0 }, command, json: false };
  const run = runBulk({
    args: flags.rest,
    root: flags.root,
    cwd: context.io.cwd,
    openFs: context.openFs,
    hash: nodeHash,
    now: context.now ?? (() => new Date()),
    sep,
    owner: { pid: process.pid, host: hostname() },
    readStdin: () => {
      if (context.io.readStdin === undefined) return "";
      try {
        return decodeStdin(context.io.readStdin(READ_LIMITS.data));
      } catch (error) {
        // P9-R1-16: oversized standard input is an input that cannot be read (exit 3), as an oversized file is.
        if (error instanceof StdinTooLargeError) throw new PyException("OSError", `standard input is larger than ${READ_LIMITS.data / (1024 * 1024)} MiB, so BuildOS did not read it`);
        throw error;
      }
    },
  });
  if (run.argparse === true) throw new UsageError(run.stderr.trim(), { command: "buildos extract bulk", json: flags.json });
  return renderSkillRun({ command: run.command, root: run.root, outcome: run.outcome, stdout: run.stdout, stderr: run.stderr, result: run.result, wrote: run.wrote, notRestored: run.notRestored }, flags.json, context);
}

/** `json.load(sys.stdin)`: standard input read as UTF-8 text, with Python's universal newlines. */
function decodeStdin(data: Uint8Array): string {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(data).replace(/\r\n?/g, "\n");
}
