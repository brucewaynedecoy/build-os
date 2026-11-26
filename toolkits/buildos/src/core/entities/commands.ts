/**
 * The four `buildos entities` commands, ported from the Go seed
 * (`internal/cli/domain.go`). Each opens the explicit root, does the reads
 * and writes through the filesystem port, and returns typed data: the root
 * as Go spells it, the result payload, the diagnostics, and a typed failure.
 * The CLI adapter turns that into the envelope, the output, and the exit code.
 * Go paths in this comment name the Go sources at the frozen baseline commit
 * 263f5ca (test/golden/CAPTURE.md, Frozen Go Baseline).
 */

import type { Diagnostic } from "../shared/diagnostics.ts";
import { ContractError, IndexRebuildError, InputError, isCoreError, WriteError, type CoreError } from "../shared/errors.ts";
import type { FsPortFactory } from "../shared/fs-port.ts";
import type { GoJsonValue } from "../shared/go-json.ts";
import { goAbs, goJoinAll, goVolumeName, type GoPathPlatform } from "../shared/go-path.ts";
import { goQuote } from "../shared/go-quote.ts";
import { resolveEntityRoot, rootAsGiven } from "../shared/root.ts";
import { consolidate, writeCanonicalAtomic, type CanonicalWriter, type ConsolidationResult } from "./consolidate.ts";
import { loadGraph, type EntityGraph, type Location } from "./graph.ts";
import { applyIndex, buildIndex, checkIndex, IndexTooLargeError, indexCheckJson, ZERO_INDEX_CHECK, type IndexCheckResult, type ResolutionIndex } from "./index.ts";
import { GoError } from "./io.ts";
import { resolveEntity } from "./resolve.ts";
import { hasErrors, parseMode, toCliDiagnostics, type Mode } from "./types.ts";
import { validateGraph } from "./validate.ts";

/** The steps the Go seed lets tests replace (`buildResolutionIndex`, `checkResolutionIndex`, `applyResolutionIndex`, `canonicalDatasetWriter`). */
export interface EntityHooks {
  buildIndex: typeof buildIndex;
  checkIndex: typeof checkIndex;
  applyIndex: typeof applyIndex;
  writeCanonical: CanonicalWriter;
}

export interface EntityContext {
  /** The current folder, as Go's `os.Getwd` spells it. */
  cwd: string;
  openFs: FsPortFactory;
  /** Path rules for the root spelling. Defaults to this platform's. */
  platform?: GoPathPlatform;
  hooks?: Partial<EntityHooks>;
}

/**
 * A command's typed result. `failure` is set when the command failed: a Go
 * error class (`goFailure`, whose one `internal_error` diagnostic the CLI
 * shows only when no other diagnostic explains it, as Go does), or a typed
 * root or path error from the filesystem port.
 */
export interface EntityCommandResult {
  root: string;
  written: boolean;
  /** The result payload, or null for Go's nil. */
  payload: GoJsonValue;
  diagnostics: Diagnostic[];
  failure: CoreError | undefined;
  goFailure: boolean;
}

const INTERNAL = { code: "internal_error", correction: "Review the reported error and retry after correcting the input or root." };
const inputError = (message: string) => new InputError(message, INTERNAL);
const validationError = (message: string) => new ContractError(message, INTERNAL);
const ioError = (message: string) => new WriteError(message, INTERNAL);
const committedIndexError = (message: string) => new IndexRebuildError(message, INTERNAL);

function hostPlatform(): GoPathPlatform {
  return rootAsGiven("a", "/") === "/a" ? "posix" : "win32";
}

interface OpenRoot {
  root: string;
  fs: ReturnType<FsPortFactory>;
  data: Location;
  index: Location;
  platform: GoPathPlatform;
}

/** Go `layout.Resolve`, through the core root model. A root that cannot be loaded is a typed error naming the given root (PE-004). */
function openRoot(context: EntityContext, rootPath: string): OpenRoot {
  const platform = context.platform ?? hostPlatform();
  const { root, fs } = resolveEntityRoot(rootPath, context.cwd, context.openFs);
  return {
    root,
    fs,
    platform,
    data: { port: ".os/data", go: goJoinAll(platform, root, ".os", "data"), platform },
    index: { port: ".os/indexes/entity-resolution.json", go: goJoinAll(platform, root, ".os", "indexes", "entity-resolution.json"), platform },
  };
}

/** Go `rebuildCommand`: the exact recovery command. */
export function rebuildCommand(root: string, mode: Mode): string {
  return `buildos entities rebuild-index --root ${goQuote(root)} --mode ${mode} --apply`;
}

/** Go `indexDiagnostic`. */
function indexDiagnostic(check: IndexCheckResult, mode: Mode): Diagnostic {
  const diagnostic: Diagnostic = { code: check.diagnostic_code ?? "", severity: mode === "strict" ? "error" : "warning", message: check.message };
  if (check.remediation_command) diagnostic.correction = check.remediation_command;
  return diagnostic;
}

function hooksOf(context: EntityContext): EntityHooks {
  return {
    buildIndex: context.hooks?.buildIndex ?? buildIndex,
    checkIndex: context.hooks?.checkIndex ?? checkIndex,
    applyIndex: context.hooks?.applyIndex ?? applyIndex,
    writeCanonical: context.hooks?.writeCanonical ?? writeCanonicalAtomic,
  };
}

/** A failure: a Go class error, or a typed error from the port or the root model. */
function failed(root: string, payload: GoJsonValue, diagnostics: Diagnostic[], failure: CoreError, written = false): EntityCommandResult {
  return { root, written, payload, diagnostics, failure, goFailure: failure.code === INTERNAL.code };
}

function ok(root: string, payload: GoJsonValue, diagnostics: Diagnostic[], written = false): EntityCommandResult {
  return { root, written, payload, diagnostics, failure: undefined, goFailure: false };
}

/** Runs `body`; a typed port or root error ends the command as a failure that names the given root. */
function guarded(context: EntityContext, rootPath: string, payload: () => GoJsonValue, body: () => EntityCommandResult): EntityCommandResult {
  try {
    return body();
  } catch (error) {
    const given = () => rootAsGiven(rootPath, context.cwd, context.platform ?? hostPlatform());
    // Go: any other error is an I/O failure with one internal_error diagnostic.
    if (error instanceof GoError) return failed(given(), payload(), [], ioError(error.message));
    if (!isCoreError(error)) throw error;
    return failed(error.root ?? given(), payload(), [], error);
  }
}

interface ValidatedRoot {
  open: OpenRoot | undefined;
  mode: Mode;
  graph: EntityGraph | undefined;
  diagnostics: Diagnostic[];
  check: IndexCheckResult;
  failure: CoreError | undefined;
}

/** Go `openValidatedRoot` with `validateIndex` true. */
function openValidatedRoot(context: EntityContext, rootPath: string, modeValue: string): ValidatedRoot {
  const hooks = hooksOf(context);
  const open = openRoot(context, rootPath);
  let mode: Mode;
  try {
    mode = parseMode(modeValue);
  } catch (error) {
    return { open, mode: "compat", graph: undefined, diagnostics: [], check: ZERO_INDEX_CHECK, failure: inputError((error as Error).message) };
  }
  const loaded = loadGraph(open.fs, open.data);
  const diagnostics = toCliDiagnostics(loaded.diagnostics);
  const result = (failure: CoreError | undefined, check: IndexCheckResult = ZERO_INDEX_CHECK): ValidatedRoot => ({ open, mode, graph: loaded.graph, diagnostics, check, failure });
  if (hasErrors(loaded.diagnostics)) return result(inputError("entity graph could not be loaded"));
  const validation = validateGraph(loaded.graph, mode);
  diagnostics.push(...toCliDiagnostics(validation));
  if (hasErrors(validation)) return result(validationError("entity graph is invalid"));
  const built = hooks.buildIndex(loaded.graph);
  diagnostics.push(...toCliDiagnostics(built.diagnostics));
  if (hasErrors(built.diagnostics)) return result(validationError("entity-resolution index cannot be derived"));
  let check: IndexCheckResult;
  try {
    check = hooks.checkIndex(open.fs, open.index, built.index, rebuildCommand(open.root, mode));
  } catch (error) {
    if (!(error instanceof GoError)) throw error;
    return result(ioError(error.message));
  }
  if (!check.current) {
    diagnostics.push(indexDiagnostic(check, mode));
    if (mode === "strict") return result(validationError(check.message), check);
  }
  return result(undefined, check);
}

/** `buildos entities resolve`. */
export function resolveCommand(context: EntityContext, rootPath: string, modeValue: string, id: string): EntityCommandResult {
  return guarded(context, rootPath, () => null, () => {
    const v = openValidatedRoot(context, rootPath, modeValue);
    const root = v.open!.root;
    if (v.failure !== undefined) return failed(root, null, v.diagnostics, v.failure);
    const { resolution, diagnostics: found } = resolveEntity(v.graph!, id);
    const diagnostics = [...v.diagnostics, ...toCliDiagnostics(found)];
    if (hasErrors(found)) return failed(root, null, diagnostics, validationError("entity resolution failed"));
    return ok(root, { requested_id: resolution.requested_id, canonical_id: resolution.canonical_id, chain: resolution.chain, resolved: resolution.resolved, index: indexCheckJson(v.check) }, diagnostics);
  });
}

function validationPayload(valid: boolean, recordCount: number, check: IndexCheckResult): GoJsonValue {
  return { valid, record_count: recordCount, index: indexCheckJson(check) };
}

/** `buildos entities validate`. */
export function validateCommand(context: EntityContext, rootPath: string, modeValue: string): EntityCommandResult {
  return guarded(context, rootPath, () => validationPayload(false, 0, ZERO_INDEX_CHECK), () => {
    const v = openValidatedRoot(context, rootPath, modeValue);
    const payload = validationPayload(v.failure === undefined, v.graph?.size ?? 0, v.check);
    if (v.failure !== undefined) return failed(v.open!.root, payload, v.diagnostics, v.failure);
    return ok(v.open!.root, payload, v.diagnostics);
  });
}

function consolidationJson(result: ConsolidationResult): GoJsonValue {
  return {
    manifest_version: result.manifest_version,
    mapping_count: result.mapping_count,
    change_count: result.change_count,
    no_op_count: result.no_op_count,
    affected_files: result.affected_files,
    changes: result.changes === null ? null : result.changes.map((c) => ({ ...c })),
    applied: result.applied,
  };
}

/** The manifest, read through its own read-only port bound to the volume that holds it, as Go reads any path. */
function manifestSource(context: EntityContext, given: string, platform: GoPathPlatform) {
  const absolute = platform === "win32" ? goAbs(given, context.cwd, "win32") : given.startsWith("/") ? given : `${context.cwd}/${given}`;
  const volume = platform === "win32" ? `${goVolumeName(absolute, "win32")}\\` : "/";
  const fs = context.openFs(volume, context.cwd);
  return { fs: { readBytes: (path: string, limit: number) => fs.readBytes(path, limit) }, given, port: absolute };
}

/** `buildos entities consolidate`. */
export function consolidateCommand(context: EntityContext, rootPath: string, modeValue: string, manifestPath: string, apply: boolean): EntityCommandResult {
  return guarded(context, rootPath, () => null, () => {
    const hooks = hooksOf(context);
    const open = openRoot(context, rootPath);
    const root = open.root;
    let mode: Mode;
    try {
      mode = parseMode(modeValue);
    } catch (error) {
      return failed(root, null, [], inputError((error as Error).message));
    }
    const outcome = consolidate(open.fs, open.data, manifestSource(context, manifestPath, open.platform), mode, apply, hooks.writeCanonical);
    const diagnostics = toCliDiagnostics(outcome.diagnostics);
    const payload: { consolidation: GoJsonValue; index?: GoJsonValue; recovery_command?: string } = { consolidation: consolidationJson(outcome.result) };
    if (outcome.error !== undefined) {
      const { kind, message } = outcome.error;
      const failure = kind === "input" ? inputError(message) : kind === "conflict" || kind === "validation" ? validationError(message) : ioError(message);
      return failed(root, payload, diagnostics, failure, outcome.result.applied);
    }
    if (!apply) return ok(root, payload, diagnostics);

    const recovery = rebuildCommand(root, mode);
    const afterCanonical = (cause: string): EntityCommandResult => {
      if (!outcome.result.applied) return failed(root, payload, diagnostics, ioError(cause));
      diagnostics.push({ code: "index_stale", severity: "error", message: `canonical entity data was applied, but index completion failed: ${cause}`, correction: recovery });
      payload.recovery_command = recovery;
      return failed(root, payload, diagnostics, committedIndexError("canonical write succeeded but index completion failed"), true);
    };
    if (outcome.afterCommit !== undefined) return afterCanonical(outcome.afterCommit);
    const built = hooks.buildIndex(outcome.graph);
    diagnostics.push(...toCliDiagnostics(built.diagnostics));
    if (hasErrors(built.diagnostics)) return afterCanonical("index graph derivation failed");
    // After the canonical rename, every failure is an index-completion
    // failure (exit 6, with the recovery command): a Go error, and also a
    // typed refusal or read failure from the filesystem port.
    const step = <T>(action: () => T): T | GoError => {
      try {
        return action();
      } catch (error) {
        if (error instanceof GoError) return error;
        if (isCoreError(error)) return new GoError(error.message);
        throw error;
      }
    };
    const index: ResolutionIndex = built.index;
    const before = step(() => hooks.checkIndex(open.fs, open.index, index, recovery));
    if (before instanceof GoError) return afterCanonical(before.message);
    const changed = step(() => hooks.applyIndex(open.fs, open.index, index));
    if (changed instanceof GoError) {
      payload.index = indexCheckJson(before);
      return afterCanonical(changed.message);
    }
    const after = step(() => hooks.checkIndex(open.fs, open.index, index, recovery));
    if (after instanceof GoError) return afterCanonical(after.message);
    payload.index = indexCheckJson(after);
    return ok(root, payload, diagnostics, outcome.result.applied || changed);
  });
}

/** `buildos entities rebuild-index`. Without `apply` it only checks (`--check` and the plan are the same here). */
export function rebuildIndexCommand(context: EntityContext, rootPath: string, modeValue: string, apply: boolean): EntityCommandResult {
  return guarded(context, rootPath, () => null, () => {
    const hooks = hooksOf(context);
    const open = openRoot(context, rootPath);
    const root = open.root;
    let mode: Mode;
    try {
      mode = parseMode(modeValue);
    } catch (error) {
      return failed(root, null, [], inputError((error as Error).message));
    }
    const loaded = loadGraph(open.fs, open.data);
    const diagnostics = toCliDiagnostics(loaded.diagnostics);
    if (hasErrors(loaded.diagnostics)) return failed(root, null, diagnostics, inputError("entity graph could not be loaded"));
    const validation = validateGraph(loaded.graph, mode);
    diagnostics.push(...toCliDiagnostics(validation));
    if (hasErrors(validation)) return failed(root, null, diagnostics, validationError("entity graph is invalid"));
    const built = hooks.buildIndex(loaded.graph);
    diagnostics.push(...toCliDiagnostics(built.diagnostics));
    if (hasErrors(built.diagnostics)) return failed(root, null, diagnostics, validationError("entity-resolution index cannot be derived"));
    const recovery = rebuildCommand(root, mode);
    let before: IndexCheckResult;
    try {
      before = hooks.checkIndex(open.fs, open.index, built.index, recovery);
    } catch (error) {
      if (!(error instanceof GoError)) throw error;
      return failed(root, null, diagnostics, ioError(error.message));
    }
    const payload: { before: GoJsonValue; after: GoJsonValue } = { before: indexCheckJson(before), after: indexCheckJson(before) };
    if (!apply) {
      if (!before.current) {
        diagnostics.push(indexDiagnostic(before, mode));
        if (mode === "strict") return failed(root, payload, diagnostics, validationError(before.message));
      }
      return ok(root, payload, diagnostics);
    }
    let written: boolean;
    try {
      written = hooks.applyIndex(open.fs, open.index, built.index);
    } catch (error) {
      if (!(error instanceof GoError)) throw error;
      // P7-R3-04: an index over its read bound is a contract stop (exit 4), and nothing was written.
      return failed(root, payload, diagnostics, error instanceof IndexTooLargeError ? validationError(error.message) : ioError(error.message));
    }
    try {
      payload.after = indexCheckJson(hooks.checkIndex(open.fs, open.index, built.index, recovery));
    } catch (error) {
      if (!(error instanceof GoError)) throw error;
      return failed(root, payload, diagnostics, ioError(error.message), written);
    }
    return ok(root, payload, diagnostics, written);
  });
}
