// W1 R7 P9, F-P9-16 (closes F-P8-09 when its run passes on three systems):
// the commands of the user guide, chapter 4, "From 0.1.0 to 0.2.0" and "Roll
// back from 0.2.0 to 0.1.0" (guide/content/04-install-and-configure-your-instance.md),
// as scripts/rollback-smoke.ts runs them. Pure data and pure functions, so
// test/rollback-smoke.test.ts can check them against the guide text: every
// command marked `guide: "literal"` is in the guide word for word, and every
// command of the guide's sh blocks in those two sections (except the examples
// for an app folder, which the test project does not have) is here.
//
// On Windows the guide says: "In Command Prompt on Windows, use backslashes
// in the paths, `rmdir /s /q` in place of `rm -rf`, `xcopy /e /i /q` in place
// of `cp -R`, `copy` in place of `cp`, `mkdir` without `-p`, and
// `.os\scripts\buildos.cmd` in place of `.os/scripts/buildos`. The `git` and
// `npx` commands are the same." commandPromptForm() makes exactly those
// changes and nothing else.

/** The two versions of the guide's steps. The guide's commands name them, so they are fixed here. */
export const FROM_VERSION = "0.1.0";
export const TO_VERSION = "0.2.0";

/** The four skills and the router that 0.2.0 changes (the guide's table). */
export const CHANGED_SKILLS = ["buildos-bulk-extract", "buildos-export-azure-boards", "capability-matrix", "fit-gap-analysis"] as const;

/** The domains that 0.2.0 adds (guide step 7: `help` lists them). */
export const NEW_DOMAINS = ["extract", "fitgap", "export", "capability-matrix"] as const;

export interface GuideCommand {
  /** The guide step, for example "upgrade 4". */
  step: string;
  /** The command as the guide writes it for macOS and Linux (sh). */
  sh: string;
  /** "literal": the guide has this command word for word. "derived": the guide says to run the step 3 command for each skill with another folder, and shows one or two of them as examples. */
  guide: "literal" | "derived";
}

/** The five compare commands of upgrade step 3, against a clean copy (`old`, `new`) or the backup. */
export function compareCommands(step: string, against: "old" | "new" | "backup", literal: readonly string[]): GuideCommand[] {
  const base = against === "backup" ? "../buildos-upgrade/backup/os-skills" : `../buildos-upgrade/${against}/.os/skills`;
  return [...CHANGED_SKILLS, "AGENTS.md"].map((name) => {
    const sh = `git --no-pager diff --no-index --stat ${base}/${name} .os/skills/${name}`;
    return { step, sh, guide: literal.includes(name) ? "literal" : "derived" };
  });
}

const RM = `rm -rf ${CHANGED_SKILLS.map((s) => `.os/skills/${s}`).join(" ")}`;
const copyFrom = (from: string): string[] => CHANGED_SKILLS.map((s) => `cp -R ${from}/${s} .os/skills/${s}`);

/** Upgrade step 1, the commit before the backup ("if git says that there is nothing to commit, that is fine"). */
export const UPGRADE_COMMIT: GuideCommand[] = [
  { step: "upgrade 1", sh: "git add -A", guide: "literal" },
  { step: "upgrade 1", sh: 'git commit -m "Before BuildOS 0.2.0"', guide: "literal" },
];
/** Upgrade step 1: "If this command prints an error, stop." */
export const UPGRADE_WORK_FOLDER: GuideCommand = { step: "upgrade 1", sh: "mkdir ../buildos-upgrade", guide: "literal" };
export const UPGRADE_BACKUP: GuideCommand[] = [
  { step: "upgrade 1", sh: "mkdir ../buildos-upgrade/backup ../buildos-upgrade/old ../buildos-upgrade/new", guide: "literal" },
  { step: "upgrade 1", sh: "cp .os/manifest.json ../buildos-upgrade/backup/manifest.json", guide: "literal" },
  { step: "upgrade 1", sh: "cp -R .os/skills ../buildos-upgrade/backup/os-skills", guide: "literal" },
];
export const UPGRADE_CLEAN_COPIES: GuideCommand[] = [
  { step: "upgrade 2", sh: `npx -y build-os@${FROM_VERSION} init --root ../buildos-upgrade/old --skip-make-docs`, guide: "literal" },
  { step: "upgrade 2", sh: `npx -y build-os@${TO_VERSION} init --root ../buildos-upgrade/new --skip-make-docs`, guide: "literal" },
];
export const UPGRADE_FIND_CHANGES: GuideCommand[] = compareCommands("upgrade 3", "old", [...CHANGED_SKILLS, "AGENTS.md"]);
export const UPGRADE_REFRESH: GuideCommand[] = [
  { step: "upgrade 4", sh: RM, guide: "literal" },
  ...copyFrom("../buildos-upgrade/new/.os/skills").map((sh): GuideCommand => ({ step: "upgrade 4", sh, guide: "literal" })),
  { step: "upgrade 4", sh: "cp ../buildos-upgrade/new/.os/skills/AGENTS.md .os/skills/AGENTS.md", guide: "literal" },
];
/** Upgrade step 7, the wrapper checks. */
export const UPGRADE_CHECK_WRAPPER: GuideCommand[] = [
  { step: "upgrade 7", sh: ".os/scripts/buildos version", guide: "literal" },
  { step: "upgrade 7", sh: ".os/scripts/buildos help", guide: "literal" },
  { step: "upgrade 7", sh: ".os/scripts/buildos export azure-boards adapters", guide: "literal" },
  { step: "upgrade 7", sh: ".os/scripts/buildos capability-matrix --help", guide: "literal" },
];
export const UPGRADE_CHECK_COMPARE: GuideCommand[] = compareCommands("upgrade 7", "new", ["fit-gap-analysis", "AGENTS.md"]);
/** "Then commit." The guide names no command here; these are the ones of step 1. */
export const UPGRADE_FINAL_COMMIT: GuideCommand[] = [
  { step: "upgrade 7", sh: "git add -A", guide: "literal" },
  { step: "upgrade 7", sh: 'git commit -m "BuildOS 0.2.0"', guide: "derived" },
];
export const ROLLBACK_PUT_BACK: GuideCommand[] = [
  { step: "rollback 1", sh: "cp ../buildos-upgrade/backup/manifest.json .os/manifest.json", guide: "literal" },
  { step: "rollback 1", sh: "cp ../buildos-upgrade/backup/os-skills/AGENTS.md .os/skills/AGENTS.md", guide: "literal" },
  { step: "rollback 2", sh: RM, guide: "literal" },
  ...copyFrom("../buildos-upgrade/backup/os-skills").map((sh): GuideCommand => ({ step: "rollback 2", sh, guide: "literal" })),
];
export const ROLLBACK_CHECK_WRAPPER: GuideCommand = { step: "rollback 5", sh: ".os/scripts/buildos version", guide: "literal" };
export const ROLLBACK_CHECK_COMPARE: GuideCommand[] = compareCommands("rollback 5", "backup", ["fit-gap-analysis", "AGENTS.md"]);

/** Every guide command that the run uses, in order (for the test against the guide). */
export const ALL_COMMANDS: GuideCommand[] = [
  ...UPGRADE_COMMIT,
  UPGRADE_WORK_FOLDER,
  ...UPGRADE_BACKUP,
  ...UPGRADE_CLEAN_COPIES,
  ...UPGRADE_FIND_CHANGES,
  ...UPGRADE_REFRESH,
  ...UPGRADE_CHECK_WRAPPER,
  ...UPGRADE_CHECK_COMPARE,
  ...UPGRADE_FINAL_COMMIT,
  ...ROLLBACK_PUT_BACK,
  ROLLBACK_CHECK_WRAPPER,
  ...ROLLBACK_CHECK_COMPARE,
];

/**
 * The Command Prompt form of a guide command, with only the changes that the
 * guide names: backslashes in the paths, `rmdir /s /q` for `rm -rf`,
 * `xcopy /e /i /q` for `cp -R`, `copy` for `cp`, and `.os\scripts\<name>.cmd`
 * for `.os/scripts/<name>`. `git` and `npx` stay the same. A word is a path
 * when it holds a `/` and does not start with `-`.
 */
export function commandPromptForm(sh: string): string {
  const words = sh.split(" ");
  let head: string[];
  let rest: string[];
  if (words[0] === "rm" && words[1] === "-rf") [head, rest] = [["rmdir", "/s", "/q"], words.slice(2)];
  else if (words[0] === "cp" && words[1] === "-R") [head, rest] = [["xcopy", "/e", "/i", "/q"], words.slice(2)];
  else if (words[0] === "cp") [head, rest] = [["copy"], words.slice(1)];
  else if (words[0] === "mkdir" && words[1] === "-p") throw new Error(`the guide's Windows form has no mkdir -p: ${sh}`);
  else if (words[0]!.startsWith(".os/scripts/")) [head, rest] = [[`${words[0]!.replace(/\//g, "\\")}.cmd`], words.slice(1)];
  else [head, rest] = [[words[0]!], words.slice(1)];
  return [...head, ...rest.map((w) => (w.startsWith("-") || !w.includes("/") ? w : w.replace(/\//g, "\\")))].join(" ");
}

/** The domain names in the `Domains:` list of `buildos help`. */
export function helpDomains(stdout: string): string[] {
  const lines = stdout.replace(/\r\n/g, "\n").split("\n");
  const start = lines.indexOf("Domains:");
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const m = /^ {2}([a-z][a-z-]*) +\S/.exec(line);
    if (m === null) break;
    out.push(m[1]!);
  }
  return out;
}

/** Changes `"buildos_version": "<from>"` to `<to>` once (upgrade step 6: "Change no other field"); undefined when the text does not hold it exactly once. */
export function changePin(manifest: string, from: string, to: string): string | undefined {
  const field = `"buildos_version": "${from}"`;
  const at = manifest.indexOf(field);
  if (at < 0 || manifest.indexOf(field, at + 1) >= 0) return undefined;
  return `${manifest.slice(0, at)}"buildos_version": "${to}"${manifest.slice(at + field.length)}`;
}

/** The lines that differ between two texts of the same line count, or undefined when the counts differ. */
export function changedLines(a: string, b: string): number | undefined {
  const x = a.split("\n");
  const y = b.split("\n");
  if (x.length !== y.length) return undefined;
  return x.filter((line, i) => line !== y[i]).length;
}

/** The registry tarball URL of a build-os version. */
export function registryTarball(version: string): string {
  return `https://registry.npmjs.org/build-os/-/build-os-${version}.tgz`;
}

/**
 * The problems of the npm cache index after the run: every build-os entry is
 * the registry document (`https://registry.npmjs.org/build-os`) or the
 * registry tarball of one of the two versions with the integrity that the
 * registry names, and both tarballs are there. So every build-os that ran
 * came from the public registry.
 */
export function cacheProblems(entries: readonly { key: string; integrity: string | undefined }[], integrity: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  const tarballs = new Map(Object.keys(integrity).map((v) => [registryTarball(v), v]));
  const seen = new Set<string>();
  for (const e of entries) {
    if (!/build-os/.test(e.key)) continue;
    const url = e.key.replace(/^make-fetch-happen:request-cache:/, "");
    if (url === "https://registry.npmjs.org/build-os") continue;
    const version = tarballs.get(url);
    if (version === undefined) {
      problems.push(`a build-os cache entry that is not from the registry: ${e.key}`);
      continue;
    }
    seen.add(version);
    if (e.integrity !== integrity[version]) problems.push(`the cache entry of build-os ${version} has the integrity ${e.integrity ?? "(none)"}, not the registry's ${integrity[version]}`);
  }
  for (const v of Object.keys(integrity)) if (!seen.has(v)) problems.push(`no cache entry for the registry tarball of build-os ${v}`);
  return problems;
}
