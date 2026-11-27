// Where the skill-script golden capture (capture.ts) reads the scripts and
// the fit-gap palette. A separate module, so a test can check it without
// running a capture (P9 review round 1 on the public repository, finding 1).
//
// SCRIPT_REVISION is the first commit of the public repository. The
// committed goldens were captured from commit 38d1e08 of the earlier
// history, which exists only in the private archive repository
// brucewaynedecoy/build-os-archive (test/golden/CAPTURE.md, Skill-Script and
// Validator Sources). The four scripts and the palette have the same SHA-256
// at both commits (script-sha256.json), so the goldens are unchanged.
//
// F-P9-04 (2026-11-26): the capability-matrix tool `cm_build.py` is not a
// file. The skill embeds it in its appendix as a fenced `python` block, and
// told the agent to write the block to a file and run it. The capture reads
// SKILL.md at the same revision, checks the SHA-256 of the whole file, takes
// the block out (`embeddedScript`), and checks the block's own SHA-256
// (script-sha256.json, the key `<path>#cm_build.py`). The capability-matrix
// goldens were captured from that revision directly.

import type { ScriptName } from "./scenario.ts";

/** The full SHA of the first commit of the public repository. */
export const SCRIPT_REVISION = "085927e3c1324fc73fe57af9493ca0b01fcaed18";

/** A script file, or a script embedded in a Markdown file (`embedded`: the script's file name, under the heading `## Appendix — \`<name>\``). */
export interface ScriptFile {
  path: string;
  embedded?: string;
}

export const SCRIPT_FILES: Record<ScriptName, ScriptFile[]> = {
  "bulk-extract": [{ path: "system/.os/skills/buildos-bulk-extract/scripts/work.py" }],
  fitgap: [{ path: "system/.os/skills/fit-gap-analysis/scripts/fitgap.py" }],
  "azure-boards": [
    { path: "system/.os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs" },
    { path: "system/.os/skills/buildos-export-azure-boards/scripts/adapters/dynamics-365-ce.mjs" },
  ],
  "capability-matrix": [{ path: "system/.os/skills/capability-matrix/SKILL.md", embedded: "cm_build.py" }],
};

/** The fit-gap owner palette that the capture copies next to fitgap.py. */
export const PALETTE_PATH = "system/.os/skills/fit-gap-analysis/config/owner-colors.json";

/** The key in script-sha256.json of an embedded script. */
export function embeddedKey(file: ScriptFile): string {
  return `${file.path}#${file.embedded}`;
}

/**
 * The script embedded in `markdown` under the heading `## Appendix — \`<name>\``:
 * the lines of its first fenced `python` block, each with its line break,
 * without the fences. Throws when the heading or the block is missing.
 */
export function embeddedScript(markdown: string, name: string): string {
  const heading = `\n## Appendix — \`${name}\`\n`;
  const at = markdown.indexOf(heading);
  if (at < 0) throw new Error(`no heading for the embedded ${name}`);
  const open = markdown.indexOf("\n```python\n", at);
  if (open < 0) throw new Error(`no python block for the embedded ${name}`);
  const start = open + "\n```python\n".length;
  const close = markdown.indexOf("\n```\n", start - 1);
  if (close < 0) throw new Error(`the python block of the embedded ${name} is not closed`);
  return markdown.slice(start, close + 1);
}
