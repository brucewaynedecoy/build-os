/**
 * Build identity. A release build replaces these two identifiers through an
 * esbuild `define`. A source build leaves them undefined and reports `dev`
 * and `unknown`.
 */

import { normalizeBuildInfo, type BuildInfo } from "../core/shared/build-info.ts";

declare const __BUILDOS_VERSION__: string | undefined;
declare const __BUILDOS_SOURCE_REVISION__: string | undefined;

export function currentBuildInfo(): BuildInfo {
  return normalizeBuildInfo({
    version: typeof __BUILDOS_VERSION__ === "string" ? __BUILDOS_VERSION__ : undefined,
    sourceRevision: typeof __BUILDOS_SOURCE_REVISION__ === "string" ? __BUILDOS_SOURCE_REVISION__ : undefined,
  });
}
