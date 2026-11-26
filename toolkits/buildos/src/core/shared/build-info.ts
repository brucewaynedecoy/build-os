/** Package version and source revision reported by every command. */
export interface BuildInfo {
  version: string;
  sourceRevision: string;
}

export const SOURCE_BUILD_INFO: BuildInfo = { version: "dev", sourceRevision: "unknown" };

/** A source build reports version `dev` and source revision `unknown`. */
export function normalizeBuildInfo(input: { version?: string | undefined; sourceRevision?: string | undefined }): BuildInfo {
  const version = input.version?.trim() ?? "";
  const sourceRevision = input.sourceRevision?.trim() ?? "";
  return {
    version: version === "" ? SOURCE_BUILD_INFO.version : version,
    sourceRevision: sourceRevision === "" ? SOURCE_BUILD_INFO.sourceRevision : sourceRevision,
  };
}
