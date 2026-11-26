/**
 * The `system/` package content that `buildos init` places in a project
 * (PRD 20 Project Initialization and Adoption). The CLI loads it from the
 * package and passes it to core as plain data, so core never reads outside
 * the project root.
 */

export interface PackageFile {
  /** Project-relative path with `/` separators, for example `.os/AGENTS.md`. */
  path: string;
  data: Uint8Array;
  /** Permission bits for the new file: `0o755` for a wrapper script, else `0o644`. */
  mode: number;
}

export interface PackageContent {
  files: PackageFile[];
}

/** The project manifest that `buildos init` writes (PRD 06 Contracts and Data). */
export const MANIFEST_PATH = ".os/manifest.json";

/** The packaged skills folder (PRD 20 Packaged Skills). */
export const SKILLS_DIR = ".os/skills";

/** The wrapper scripts folder (PRD 06; `system/.os/scripts/`). */
export const SCRIPTS_DIR = ".os/scripts";

/**
 * The wrapper files: the `sh` and `.cmd` wrappers and their two helper
 * files. Adoption writes only these, the manifest, and `.os/skills/`.
 */
export const WRAPPER_FILES: readonly string[] = [
  "buildos",
  "buildos-intake",
  "buildos-discovery",
  "buildos-design",
  "buildos.cmd",
  "buildos-intake.cmd",
  "buildos-discovery.cmd",
  "buildos-design.cmd",
  "pinned-version.cjs",
  "node-required.txt",
].map((name) => `${SCRIPTS_DIR}/${name}`);

/** Folders BuildOS must never write into: Make Docs owns them (PRD 20, PRD 05 Integrations). */
export const MAKE_DOCS_OWNED: readonly string[] = ["docs", ".make-docs"];
