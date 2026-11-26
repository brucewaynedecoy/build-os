import type { BuildInfo } from "../shared/build-info.ts";

export interface VersionResult {
  version: string;
  source_revision: string;
}

/** Domain logic for `buildos version`: report the build identity. */
export function describeVersion(info: BuildInfo): VersionResult {
  return { version: info.version, source_revision: info.sourceRevision };
}
