/**
 * The central exit code table. Every exit code is assigned here and nowhere
 * else. See PRD 20, Output and Exit Contract.
 */

import { isCoreError, type CoreErrorKind } from "../core/shared/errors.ts";
import { UsageError } from "./usage-error.ts";

export const EXIT_CODES = {
  /** The operation completed, including a clean check or a dry run. */
  ok: 0,
  /** An internal or unexpected failure stopped the command. */
  internal: 1,
  /** Command or flag usage is invalid. */
  usage: 2,
  /** The root or a required input cannot be loaded or parsed. */
  input: 3,
  /** A contract, validation, graph, or reviewed-remap conflict. */
  contract: 4,
  /** An I/O or canonical-write failure stopped a valid write from committing. */
  io: 5,
  /** A canonical write committed but the derived index rebuild failed. */
  canonicalAppliedIndexFailed: 6,
  /** The command needs operator review before it can continue. */
  needsOperatorReview: 10,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

const CORE_ERROR_EXIT: Record<CoreErrorKind, ExitCode> = {
  input: EXIT_CODES.input,
  contract: EXIT_CODES.contract,
  io: EXIT_CODES.io,
  "canonical-applied-index-failed": EXIT_CODES.canonicalAppliedIndexFailed,
  "needs-operator-review": EXIT_CODES.needsOperatorReview,
};

/** Maps any thrown value to its exit code. Unknown values map to `1`. */
export function exitCodeFor(error: unknown): ExitCode {
  if (error instanceof UsageError) {
    return EXIT_CODES.usage;
  }
  if (isCoreError(error)) {
    return Object.hasOwn(CORE_ERROR_EXIT, error.kind) ? CORE_ERROR_EXIT[error.kind] : EXIT_CODES.internal;
  }
  return EXIT_CODES.internal;
}
