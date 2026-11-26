/**
 * The repository and installed BuildOS layouts (Go `detectLayout`,
 * `buildOSLayout`, and the intake tool's `resolvePath`). In the repository
 * layout, BuildOS content lives under `system/`. In the installed layout, the
 * root itself is the content root, and `system/` prefixes are dropped.
 * `isInstalledLayout` is the one detector for every domain (W1 R7 P7 review
 * round 2, P7-R2-01).
 */

import type { GoFiles } from "./go-files.ts";
import { goFromSlash, goIsAbs, goToSlash } from "./go-text.ts";

export class BuildOsLayout {
  readonly files: GoFiles;
  readonly installedRoot: boolean;
  #rootHasSystem: boolean | undefined;

  private constructor(files: GoFiles, installedRoot: boolean) {
    this.files = files;
    this.installedRoot = installedRoot;
  }

  /** Go `detectLayout(repoRoot)`, with the installed-root rule of `isInstalledLayout`. */
  static detect(files: GoFiles): BuildOsLayout {
    return new BuildOsLayout(
      files,
      isInstalledLayout((rel) => {
        const stat = files.stat(files.join(files.repoRoot, ...rel.split("/")));
        return stat.kind === "ok" ? stat.stat.kind : undefined;
      }),
    );
  }

  get repoRoot(): string {
    return this.files.repoRoot;
  }

  /** Go `layout.rel`: `ToSlash`, then drop `system/` in the installed layout. */
  rel(path: string): string {
    const slashed = goToSlash(path, this.files.platform);
    if (this.installedRoot && slashed.startsWith("system/")) return slashed.slice("system/".length);
    return slashed;
  }

  rels(values: readonly string[] | null): string[] {
    return (values ?? []).map((value) => this.rel(value));
  }

  /** Go `layout.ref`: `rel` of the part before the first `#`, with the anchor kept. */
  ref(value: string): string {
    const cut = value.indexOf("#");
    if (cut === -1) return this.rel(value);
    return `${this.rel(value.slice(0, cut))}#${value.slice(cut + 1)}`;
  }

  refs(values: readonly string[] | null): string[] {
    return (values ?? []).map((value) => this.ref(value));
  }

  /** Go `layout.path`: `filepath.Join(repoRoot, filepath.FromSlash(layout.rel(rel)))`. */
  path(rel: string): string {
    return this.files.join(this.repoRoot, goFromSlash(this.rel(rel), this.files.platform));
  }

  /** Go `layout.systemRoot`. */
  systemRoot(): string {
    return this.installedRoot ? this.repoRoot : this.files.join(this.repoRoot, "system");
  }

  /** Go `resolveRepoPath`: an absolute path as given, else `layout.path`. For BuildOS-owned paths and saved references only; a file the user names goes through `resolveUserPath`. */
  resolveRepoPath(path: string): string {
    if (goIsAbs(path, this.files.platform)) return path;
    return this.path(path);
  }

  /** P7-R3-01: `ref` for a path the user named: `userPathRel` of the part before the first `#`, with the anchor kept. */
  userRef(value: string): string {
    const cut = value.indexOf("#");
    const pathPart = goToSlash(cut === -1 ? value : value.slice(0, cut), this.files.platform);
    this.#rootHasSystem ??= this.files.stat(this.files.join(this.repoRoot, "system")).kind !== "missing";
    const rel = userPathRel(pathPart, this.installedRoot, this.#rootHasSystem);
    return cut === -1 ? rel : `${rel}#${value.slice(cut + 1)}`;
  }

  /**
   * W1 R7 P7 review round 3 (P7-R3-01): a file the user names on the command
   * line (`--evidence`, `--raw-finding`, `--confirmation-test`,
   * `--confirmation-evidence`). An absolute path is used as given; a relative
   * one is joined to the root as written (`userPathRel`), so a project that
   * owns a `system/` folder never has `system/<x>` turned into `<x>`.
   */
  resolveUserPath(path: string): string {
    if (goIsAbs(path, this.files.platform)) return path;
    this.#rootHasSystem ??= this.files.stat(this.files.join(this.repoRoot, "system")).kind !== "missing";
    return this.files.join(this.repoRoot, goFromSlash(userPathRel(goToSlash(path, this.files.platform), this.installedRoot, this.#rootHasSystem), this.files.platform));
  }
}

/**
 * W1 R7 P7 review round 3 (P7-R3-01): the root-relative spelling of a path
 * the user names (`/`-separated). The Go tools dropped a leading `system/`
 * from every relative path in an installed project, also from a path the
 * user named, so in a project that owns a `system/` folder an explicit
 * `system/inputs/report.csv` silently read `inputs/report.csv`. The rule
 * now:
 *
 * - The source layout, or an installed project with an entry named `system`
 *   at its root (a folder the user owns): the path as written.
 * - An installed project with no `system` entry: a leading `system/` is the
 *   legacy spelling of the source package (the Go-era skills and notes used
 *   it), and it is dropped, as Go did. The path as written cannot exist there.
 *
 * BuildOS-owned defaults (such as `--assets-root system/assets`) and saved
 * references keep `BuildOsLayout.rel`.
 */
export function userPathRel(rel: string, installedRoot: boolean, rootHasSystem: boolean): string {
  if (installedRoot && !rootHasSystem && rel.startsWith("system/")) return rel.slice("system/".length);
  return rel;
}

/** What the layout rule sees at a path below the root (`/`-separated), following links as Go's `os.Stat` does. */
export type LayoutProbe = (rel: string) => "file" | "directory" | undefined;

/** Go `isInstalledSystemRoot`: the five folders the Go tools required. */
const GO_INSTALLED_FOLDERS = [".os", "assets", "docs", "playbooks", "workspace"];

/**
 * True when the root is an installed BuildOS project (W1 R7 P7 review round
 * 2, P7-R2-01). Go required all five of `.os/`, `assets/`, `docs/`,
 * `playbooks/`, and `workspace/`, but `docs/` exists only when Make Docs is
 * set up (PRD 05 Installed Project Paths), so a project made by
 * `buildos init --skip-make-docs` was read as a source checkout. The rule:
 *
 * 1. Go's rule: all five are folders. Installed (every Go-era project and
 *    every installed golden).
 * 2. Else a root `.os/` folder means installed, unless `system/.os/` is a
 *    folder too and `.os/manifest.json` (which `buildos init` writes) is not
 *    a file: such a root is a source checkout with a stray `.os/`, as in Go.
 * 3. Else the source layout (Go). With neither `.os/` nor `system/.os/`,
 *    a command fails where it first reads BuildOS data under `system/`, as
 *    Go does; one that reads only files the user names still works.
 */
export function isInstalledLayout(probe: LayoutProbe): boolean {
  if (GO_INSTALLED_FOLDERS.every((rel) => probe(rel) === "directory")) return true;
  if (probe(".os") !== "directory") return false;
  return probe("system/.os") !== "directory" || probe(".os/manifest.json") === "file";
}
