// Runs the BuildOS command that replaces a skill script, in this process,
// with the fixed clock of the goldens (W1 R7 P9 t8). The project folder is
// both --root and the current folder, as the script's runs had it.

import { run } from "../../../src/cli/run.ts";
import type { CliIo } from "../../../src/cli/io.ts";
import { StdinTooLargeError } from "../../../src/cli/io.ts";
import type { Runner, ScriptName } from "./scenario.ts";

export const FIXED_NOW = new Date("2026-01-15T12:00:00Z");

export const COMMAND_PREFIX: Record<ScriptName, string[]> = {
  "bulk-extract": ["extract", "bulk"],
  fitgap: ["fitgap"],
  "azure-boards": ["export", "azure-boards"],
  "capability-matrix": ["capability-matrix"],
};

/** The BuildOS arguments for a script's arguments. */
export function buildosArgs(script: ScriptName, args: readonly string[], dir: string): string[] {
  return [...COMMAND_PREFIX[script], "--root", dir, ...args];
}

export function buildosRunner(script: ScriptName, extra: readonly string[] = []): Runner {
  return async (args, dir, stdin) => {
    let stdout = "";
    let stderr = "";
    const io: CliIo = {
      cwd: dir,
      writeStdout: (text) => {
        stdout += text;
      },
      writeStderr: (text) => {
        stderr += text;
      },
      readStdin: (limit) => {
        const data = stdin ?? new Uint8Array();
        if (data.length > limit) throw new StdinTooLargeError(limit);
        return data;
      },
    };
    const exit = await run([...buildosArgs(script, args, dir), ...extra], io, { buildInfo: { version: "dev", sourceRevision: "unknown" }, now: () => FIXED_NOW });
    return { exit, stdout, stderr };
  };
}
