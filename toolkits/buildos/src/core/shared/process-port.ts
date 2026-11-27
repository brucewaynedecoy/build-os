/**
 * The process port. Core never loads `child_process` (the boundary check in
 * `test/boundary-rules.ts` enforces this). When a command must start another
 * program, as `buildos init` does for the Make Docs companion setup the user
 * chose (PRD 20 Make Docs Companion Setup), core asks this port, which the
 * CLI passes in. `src/adapters/node-process.ts` implements it, and it is the
 * only file that may spawn a process. It never starts BuildOS itself.
 */

export interface ProcessResult {
  /** The exit code, or `null` when the program did not finish (a signal or a timeout). */
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Why the program could not start or finish, in plain words, when it could not. */
  failure?: string;
  /**
   * `false` when no process started: the run was refused before a start, or
   * the system could not start the program (F-P8-11 review round 3, finding
   * 3). Absent when a process started, whether it finished or not.
   */
  started?: false;
}

export interface ProcessPort {
  /** The full path of `name` on `PATH` (with a Windows program extension), or `undefined`. */
  find(name: string): string | undefined;
  /** Runs `program` with `args` in `cwd`, with no shell, no input, and the caller's environment. */
  run(program: string, args: readonly string[], options: { cwd: string; timeoutMs?: number }): ProcessResult;
}
