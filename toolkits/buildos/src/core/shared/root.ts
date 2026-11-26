/**
 * The one root model for every BuildOS domain.
 *
 * The root is the project folder that holds `.os/`. No function here walks up
 * to a parent folder. Core reads the disk only through the filesystem port;
 * each function binds a port to the root it resolves.
 *
 * `root` is the path as the Go seed spells it: `filepath.Abs` against the
 * current folder, which cleans the text (see `rootAsGiven`). It is what
 * output and every error report. `fs.root` is the real path the port
 * enforces (symlinks and `..` resolved by the OS; on Windows, the long
 * on-disk form, never an 8.3 short name). Containment and every refusal use
 * `fs.root`. Output never reports `fs.root`.
 */

import { sep as hostSep } from "node:path";
import { InputError } from "./errors.ts";
import type { FsPort, FsPortFactory } from "./fs-port.ts";
import { goAbs } from "./go-path.ts";

export interface DefaultRootInput {
  /** Value of `--root`, when the caller gave one. */
  root?: string | undefined;
  /** Current working directory, passed in by the adapter. */
  cwd: string;
  /** Opens the filesystem port for the resolved root. */
  openFs: FsPortFactory;
}

export interface DefaultRoot {
  /** Absolute, cleaned root path, as the Go seed spells it (not resolved through symlinks). */
  root: string;
  /** True when `<root>/.os/` is a folder. A parent's `.os/` never counts. */
  hasOsFolder: boolean;
  /** Filesystem port bound to the root. */
  fs: FsPort;
}

export interface EntityRoot {
  /** Absolute, cleaned root path, as the Go seed spells it (not resolved through symlinks). */
  root: string;
  /** Filesystem port bound to the root. */
  fs: FsPort;
}

/**
 * Root for a command that defaults to the current folder, such as
 * `buildos init`. `--root` wins. With no `--root`, the root is `cwd` itself.
 */
export function resolveDefaultRoot(input: DefaultRootInput): DefaultRoot {
  // With no --root, the root is the current folder itself, spelled as given.
  const given = input.root === undefined || input.root === "" ? input.cwd : input.root;
  // The adapter checks the spelling as given before anything resolves it.
  const fs = input.openFs(given, input.cwd);
  const root = rootAsGiven(given, input.cwd);
  return { root, hasOsFolder: isDirectory(fs, ".os"), fs };
}

/**
 * Root for an entity command. The caller must pass an explicit `--root`
 * whose `.os/data/` folder exists. The root is never inferred.
 */
export function resolveEntityRoot(root: string, cwd: string, openFs: FsPortFactory): EntityRoot {
  if (root.trim() === "") {
    throw new InputError("an explicit --root is required", {
      code: "root_required",
      correction: "Pass --root with the project folder that holds .os/data/.",
    });
  }
  // The adapter checks the spelling as given before anything resolves it.
  const fs = openFs(root, cwd);
  const resolved = rootAsGiven(root, cwd);
  if (!isDirectory(fs, ".os/data")) {
    throw new InputError(`root ${resolved} has no .os/data/ folder`, {
      code: "root_not_found",
      correction: "Pass --root with the project folder that holds .os/data/.",
      root: resolved,
    });
  }
  return { root: resolved, fs };
}

/**
 * The root as the Go seed reports it: Go's `filepath.Abs` for the platform,
 * against `cwd`. It is lexical only (see `go-path.ts`): it folds `.`, `..`,
 * and repeated separators, and never follows a symlink, so `link/..` names
 * the folder that holds `link`, as in Go. On Windows it also takes volume
 * names, UNC shares, rooted (`\x`) and drive-relative (`D:x`) paths, and
 * trailing dots and spaces as `GetFullPathNameW` does. It is never empty.
 */
export function rootAsGiven(root: string, cwd: string, platform: "posix" | "win32" = hostSep === "\\" ? "win32" : "posix"): string {
  return goAbs(root, cwd, platform);
}

function isDirectory(fs: FsPort, path: string): boolean {
  return fs.stat(path)?.kind === "directory";
}
