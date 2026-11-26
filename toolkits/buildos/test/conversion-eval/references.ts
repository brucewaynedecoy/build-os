// Shared shapes for the conversion eval set (W1 R7 P4 t1 to t4).
//
// manifest.json lists every eval file, its format, its sections, and where
// its reference text lives. generate-eval.ts writes it. A reference file is
// plain UTF-8 text split into named sections. Each section starts with one
// marker line and runs to the next marker or the end of the file:
//
//   @@ section: <name> @@
//
// Marker lines are not part of the reference text. Text before the first
// marker is not allowed. eval.test.ts checks that the markers in each
// reference match the section list in the manifest, in order.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const EVAL_ROOT = dirname(fileURLToPath(import.meta.url));

export type EvalFormat = "csv" | "docx" | "xlsx" | "html" | "html-dir" | "pdf";

export interface EvalFile {
  /** Stable id. The reference file is references/<id>.txt. */
  id: string;
  format: EvalFormat;
  /** Source path relative to the eval root. */
  source: string;
  /** Reference path relative to the eval root. */
  reference: string;
  /** Twin body type that the converter writes for this file. */
  twin: "csv" | "markdown" | "text";
  /** "text": the converter must produce text. "no-text": it must produce none (OCR is out of scope). */
  expect: "text" | "no-text";
  /** Section names, in reference order. Empty for a "no-text" file. */
  sections: string[];
  /** Twin parts the converter writes, in order (one per sheet or HTML page). */
  parts: string[];
  /** What the file exercises. */
  covers: string[];
  /** Visible source content that the reference leaves out on purpose, with the reason. */
  outOfScope: string[];
}

export interface EvalManifest {
  version: 1;
  files: EvalFile[];
}

export interface ReferenceSection {
  name: string;
  text: string;
}

export const SECTION_MARKER = /^@@ section: (.+) @@$/;

/** Splits reference text into named sections. Throws on text before the first marker. */
export function parseReference(text: string): ReferenceSection[] {
  const sections: ReferenceSection[] = [];
  let current: { name: string; lines: string[] } | undefined;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, i) => {
    const marker = SECTION_MARKER.exec(line);
    if (marker !== null) {
      if (current !== undefined) sections.push({ name: current.name, text: current.lines.join("\n") });
      current = { name: marker[1] as string, lines: [] };
      return;
    }
    if (current === undefined) {
      if (line.trim() !== "") throw new Error(`reference line ${i + 1} is outside any section`);
      return;
    }
    current.lines.push(line);
  });
  if (current !== undefined) sections.push({ name: current.name, text: current.lines.join("\n") });
  return sections;
}

/** The reference text without marker lines: what a correct converter writes, in order. */
export function referenceText(sections: readonly ReferenceSection[]): string {
  return sections.map((s) => s.text).join("\n");
}

export function loadManifest(root = EVAL_ROOT): EvalManifest {
  return JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as EvalManifest;
}

export function loadReference(file: EvalFile, root = EVAL_ROOT): ReferenceSection[] {
  return parseReference(readFileSync(join(root, ...file.reference.split("/")), "utf8"));
}
