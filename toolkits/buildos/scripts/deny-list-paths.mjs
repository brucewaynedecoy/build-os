// Disk paths and printable labels for the package files the deny-list check
// reads (scripts/check-deny-list.mjs; W1 R7 P7 final check, P7-F-01).
//
// Each package file keeps two separate values:
//
//   full   its absolute path on disk, joined from the package folder and the
//          path `npm pack` lists. The check opens this path and nothing else.
//   path   its printable label: the path relative to --root when the package
//          folder is inside --root (so a package inside the checkout gets the
//          same label as the tree scan), else `[package]/<packed path>`.
//
// The disk path is never derived from the label. On Windows, `relative()`
// between two drives returns an absolute path; joining that under the root
// gave a path that did not exist, so the old check read no package file at
// all and still passed.
//
// `pathApi` is `node:path` (the platform's rules) or, in a test, `path.win32`
// or `path.posix`.

export const PACKAGE_LABEL = "[package]";

export function packEntries(root, packageDir, packedPaths, pathApi) {
  return packedPaths.map((packagePath) => {
    const full = pathApi.join(packageDir, ...packagePath.split("/"));
    const rel = pathApi.relative(root, full);
    const inside = rel !== "" && rel !== ".." && !rel.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(rel);
    return { full, path: inside ? rel.split(pathApi.sep).join("/") : `${PACKAGE_LABEL}/${packagePath}`, packagePath };
  });
}
