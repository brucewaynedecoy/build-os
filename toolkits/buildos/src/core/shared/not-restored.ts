/**
 * W1 R7 P9 review round 2 (P9-R2-07): what a skill-script command left on
 * disk that it could not put back or clean up, with the exact path and a
 * plain reason, in the shape `buildos init` reports (`NotRestored` in
 * `src/core/init/apply.ts`): `left` is something still there that BuildOS
 * could not undo (a changed file, an earlier file kept under a backup name,
 * a temporary file, a lock file); `unsure` is an earlier file that BuildOS
 * put back but whose save to disk it could not confirm.
 */
export interface NotRestored {
  path: string;
  reason: string;
  state: "left" | "unsure";
}

/** The paths of a list, without repeats, in order. */
export function pathsOf(list: readonly NotRestored[]): string[] {
  const out: string[] = [];
  for (const item of list) if (!out.includes(item.path)) out.push(item.path);
  return out;
}

/** One line per entry: `path (reason)`. */
export function describe(list: readonly NotRestored[]): string {
  return list.map((item) => `${item.path} (${item.reason})`).join("; ");
}
