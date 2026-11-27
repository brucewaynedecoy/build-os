/**
 * The ZIP port of `buildos fitgap workbook` (`src/core/fitgap/workbook.ts`,
 * W1 R7 P9 t5), built from the bundled dev package `fflate` 0.8.3 (admitted
 * in W1 R7 P4 t7; see SECURITY.md). `zip` deflates the Office Open XML
 * parts with `zipSync`, in the order core gives them, with one fixed time
 * (1980-01-01 00:00 local, the first DOS date, the same in every time zone)
 * and the same compression level, so the same parts give the same bytes.
 * `unzip` reads the archive back with the intake ZIP reader (bounded, every
 * entry's size and CRC-32 checked), for the workbook's own check. It
 * imports fflate's browser build, which loads no Node module.
 */

import { zipSync, type Zippable } from "fflate/browser";
import type { XlsxZip } from "../core/fitgap/xlsx-model.ts";
import { intakeParsers } from "./intake-parsers.ts";

const FIXED_TIME = new Date(1980, 0, 1, 0, 0, 0);

export const xlsxZip: XlsxZip = {
  zip(entries) {
    const files: Zippable = {};
    for (const entry of entries) files[entry.name] = [entry.data, { level: 6, mtime: FIXED_TIME }];
    return zipSync(files);
  },
  unzip(data) {
    return intakeParsers.readZip(data).map((entry) => ({ name: entry.name, data: entry.read() }));
  },
};
