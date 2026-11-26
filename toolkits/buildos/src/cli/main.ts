// Entry point for the `buildos` bundle. It owns the process: argv in, exit
// code out. Everything else stays testable in `run.ts`.

// First: end the project wrapper guard before anything else runs.
import "./wrapper-guard.ts";
import { currentBuildInfo } from "./build-info.ts";
import { entryCommandName, invocationArgs, legacyNotice } from "./invocation.ts";
import { nodeRefusal, takeVersionRequirement, versionRefusal } from "./required-version.ts";

try {
  // A legacy name comes only from its own entry file (src/cli/invocation.ts),
  // never from the path the program was started under.
  const name = entryCommandName();
  const args = invocationArgs(name, process.argv.slice(2));
  // W1 R7 P8 pin-first review round 2: the version the project wrapper
  // requires is checked before any command code, output, or file access.
  // The command modules load only after the check.
  // Pin-first final check, finding 3: the Node.js version first.
  const buildInfo = currentBuildInfo();
  const required = takeVersionRequirement(process.env);
  const refusal = nodeRefusal(process.versions.node, buildInfo, args) ?? versionRefusal(required, buildInfo, args);
  if (refusal !== undefined) {
    if (refusal.stdout !== "") process.stdout.write(refusal.stdout);
    if (refusal.stderr !== "") process.stderr.write(refusal.stderr);
    process.exitCode = refusal.exitCode;
  } else {
    const { processIo } = await import("./io.ts");
    const { run } = await import("./run.ts");
    // A legacy name writes its one notice line first. It never changes
    // stdout or the exit code (PRD 20 Output and Exit Contract).
    const notice = legacyNotice(name);
    if (notice !== undefined) process.stderr.write(notice);
    process.exitCode = await run(args, processIo());
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`buildos: internal error: ${message.split(/\r?\n/, 1)[0] ?? ""}\n`);
  process.exitCode = 1;
}
