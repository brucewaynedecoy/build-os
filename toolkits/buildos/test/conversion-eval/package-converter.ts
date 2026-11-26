// The in-package converter under test (W1 R7 P4 t8): the ported intake core
// with the bundled parsers, run as a dry run so nothing is written. The eval
// gate in eval.test.ts uses it when BUILDOS_EVAL_CONVERTER is not set.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { intakeParsers } from "../../src/adapters/intake-parsers.ts";
import { createNodeFsPort, createNodeInPlaceWriter } from "../../src/adapters/node-fs.ts";
import { bodyText, convert } from "../../src/core/intake/convert/convert.ts";
import type { EvalConverter } from "./eval.test.ts";

export const converter: EvalConverter = {
  name: "buildos intake (fflate 0.8.3, Go encoding/xml port, parse5 8.1.1, unpdf 2.1.0)",
  async convert(sourcePath) {
    const root = mkdtempSync(join(tmpdir(), "buildos-eval-"));
    try {
      const result = await convert(
        { cwd: root, openFs: createNodeFsPort, openWriter: createNodeInPlaceWriter, parsers: intakeParsers },
        { repoRoot: root, source: sourcePath, assetsRoot: "assets", type: "auto", force: false, dryRun: true },
      );
      return result.outputs.map(bodyText);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
};
