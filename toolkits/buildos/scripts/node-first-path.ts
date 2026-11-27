// W1 R7 P8 follow-up F-P8-12: an environment whose PATH starts with the
// folder of the Node.js that runs the calling script. A program that a child
// starts by the bare name `node` (npx starts the BuildOS bin through its
// `#!/usr/bin/env node` line, or through `node` in its Windows shim) then runs
// under the same Node.js as the script. Node built-ins only.

import { delimiter, dirname } from "node:path";

/**
 * A copy of `env` with the folder of `execPath` first on PATH. Every key that
 * spells PATH in another case (Windows keeps `Path`) is folded into one, so a
 * child never sees two PATH values.
 */
export function withNodeFirst(env: NodeJS.ProcessEnv, execPath = process.execPath, platform: NodeJS.Platform = process.platform): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  const keys = Object.keys(out).filter((key) => key.toUpperCase() === "PATH");
  const separator = platform === "win32" ? ";" : platform === process.platform ? delimiter : ":";
  const rest = keys.map((key) => out[key] ?? "").filter((value) => value !== "").join(separator);
  for (const key of keys) delete out[key];
  const nodeDir = platform === "win32" ? execPath.replace(/[\\/][^\\/]*$/, "") : dirname(execPath);
  out[platform === "win32" ? (keys.find((k) => k === "Path") ?? keys[0] ?? "Path") : "PATH"] = rest === "" ? nodeDir : `${nodeDir}${separator}${rest}`;
  return out;
}
