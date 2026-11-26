import { describeVersion } from "../../core/version/version.ts";
import type { Domain } from "../domain.ts";
import { parseCommandFlags } from "../parse.ts";
import { UsageError } from "../usage-error.ts";

const COMMAND = "buildos version";
const FLAGS = { json: "boolean" } as const;

export const versionDomain: Domain = {
  name: "version",
  summary: "Print the package version and source revision",
  help: `Usage:
  buildos version [--json]

Prints the BuildOS package version and source revision.
A source build reports version "dev" and source revision "unknown".
`,
  run(args, context) {
    // Go seed `runVersion`: a usage error uses JSON when `-json` was parsed
    // before the error, so `--json --bad` is JSON and `--bad --json` is not.
    const { values, positionals } = parseCommandFlags(COMMAND, FLAGS, args, (partial) => partial.json === true);
    const json = values.json === true;
    if (positionals.length !== 0) {
      throw new UsageError("version accepts only --json", { command: COMMAND, json });
    }
    return {
      command: "version",
      json,
      root: "not_applicable",
      mode: "not_applicable",
      writeStatus: "not_requested",
      result: describeVersion(context.buildInfo),
    };
  },
};
