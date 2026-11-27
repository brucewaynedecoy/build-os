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

import type { ScriptName } from "./scenario.ts";

/** The full SHA of the first commit of the public repository. */
export const SCRIPT_REVISION = "085927e3c1324fc73fe57af9493ca0b01fcaed18";

export const SCRIPT_FILES: Record<ScriptName, { path: string }[]> = {
  "bulk-extract": [{ path: "system/.os/skills/buildos-bulk-extract/scripts/work.py" }],
  fitgap: [{ path: "system/.os/skills/fit-gap-analysis/scripts/fitgap.py" }],
  "azure-boards": [
    { path: "system/.os/skills/buildos-export-azure-boards/scripts/azure_boards_csv.mjs" },
    { path: "system/.os/skills/buildos-export-azure-boards/scripts/adapters/dynamics-365-ce.mjs" },
  ],
};

/** The fit-gap owner palette that the capture copies next to fitgap.py. */
export const PALETTE_PATH = "system/.os/skills/fit-gap-analysis/config/owner-colors.json";
