// The core and CLI boundary rule from PRD 20 Command Surface, as a checker.
//
// Core files (`src/core/`) must not write to process streams, exit, use
// `console`, or import from `src/cli/`, in any spelling. The checker reads
// TypeScript syntax nodes from the TypeScript compiler API (the `typescript`
// dev dependency), not source text, so text inside strings, templates,
// regular expressions, and comments never counts, and casts, parentheses,
// non-null assertions, and optional chaining never hide a use.
//
// It is deliberately strict. In core, these are violations:
//
// - any reference to `process`: the global, `globalThis.process` (and
//   `global`, `self`, `window`) with any wrapping, `globalThis["process"]`,
//   and a binding, parameter, alias, or destructuring named `process`. The
//   only exception is a plain read of a data member in ALLOWED_PROCESS_MEMBERS,
//   such as `process.env.HOME`;
// - any reference to `console`, by the same rules, with no exception;
// - an import of `process`, `node:process`, `console`, `node:console`,
//   `module`, or `node:module` in any form: static, type-only, side-effect,
//   re-export, `import x = require()`, `require()`, dynamic `import()`, or
//   `getBuiltinModule()`;
// - a `require()`, `import()`, or `getBuiltinModule()` call whose specifier
//   is not a string literal, because the checker cannot see what it loads;
// - a reference to the global object (`globalThis`, `global`, `self`,
//   `window`) other than a static member read, because an alias hides what
//   it reads later;
// - `eval` and the `Function` constructor;
// - an import of the CLI layer (`src/cli/`) in any of the import forms above,
//   or as an `import("...")` type;
// - a load of a module that can write to a file descriptor or a stream
//   (CORE_IO_MODULES: `fs`, `fs/promises`, `net`, `tls`, `tty`,
//   `child_process`, `worker_threads`, `stream`, `readline`, `http`, `vm`,
//   `util`, and the rest, with or without `node:`), in any of the import
//   forms above. Core reads and writes the disk only through the filesystem
//   port in `src/core/shared/fs-port.ts`, which the CLI passes in. The rule
//   is structural, so the checker never follows file-descriptor values;
// - a load of any other bare module that is not in CORE_ALLOWED_MODULES
//   (`path`, `url`, `buffer`, `string_decoder`). `crypto` is allowed only in
//   the files listed in CORE_CRYPTO_FILES (W1 R7 P6 review round 4: the init
//   core hashes through the hash port, `src/core/shared/hash-port.ts`);
// - a relative import that leaves `src/core/`, such as `src/adapters/`, so no
//   core file can reach fs through a file outside core. A core file that
//   re-exports fs fails by itself, so a chain of core re-exports cannot hide
//   it either;
// - an fs write API name (`writeSync`, `writevSync`, `writeFileSync`,
//   `appendFileSync`, `createWriteStream`, `WriteStream`, and the other
//   `Sync` fd APIs) on any object, called or not, so an fs object passed in
//   cannot be used either;
// - `require` or `getBuiltinModule` taken as a value, and the CommonJS
//   `module` object;
// - a `constructor` member, which reaches the Function constructor;
// - any string or template text that names a device or console path:
//   `/dev/...` (such as `/dev/stdout`, `/dev/fd/1`, `/dev/tty`), `/proc/...`,
//   `file:///dev/...`, a Windows device path (`\\.\...`, `\\?\...`), or a
//   Windows console name (`CON`, `CONIN$`, `CONOUT$`, any case, any
//   extension).
//
// CLI files (`src/cli/`) and adapters (`src/adapters/`) must not spawn a
// subprocess. The one exception is the process adapter, PROCESS_ADAPTER
// (W1 R7 P6: `buildos init` starts the Make Docs CLI the user chose, PRD 20
// Make Docs Companion Setup). It may load `child_process` and spawn, but it
// may not name a `buildos` program in any string (PROCESS_RULE), so it
// cannot start BuildOS itself (PRD 20 Command Surface).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import {
  isBindingElement,
  isCallExpression,
  isElementAccessExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isNewExpression,
  isNoSubstitutionTemplateLiteral,
  isPropertyAccessExpression,
  isQualifiedName,
  isStringLiteral,
  isTemplateExpression,
  SyntaxKind,
  type Node,
  type SourceFile as TsSourceFile,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

export interface SourceFile {
  /** Path relative to the package root, with forward slashes. */
  path: string;
  text: string;
}

export interface Violation {
  path: string;
  rule: string;
}

export const CORE_RULE = {
  stdout: "core uses process.stdout",
  stderr: "core uses process.stderr",
  exit: "core uses process.exit",
  processReference: "core references process outside an allowed member",
  processImport: "core imports node:process",
  console: "core uses console",
  cliImport: "core imports from src/cli",
  moduleImport: "core loads modules at run time (node:module)",
  computedImport: "core loads a module with a computed specifier",
  globalObject: "core references the global object outside a static member read",
  dynamicCode: "core uses eval or the Function constructor",
  ioModule: "core loads a module that can write to file descriptors or streams (use the filesystem port)",
  unlistedModule: "core loads a module that is not on the core allowlist",
  outsideCoreImport: "core imports a file outside src/core",
  fsWriteApi: "core names an fs write API",
  devicePath: "core names a device or console path",
} as const;

export const CLI_RULE = {
  childProcess: "cli spawns a subprocess",
  spawn: "cli spawns buildos or an adapter",
} as const;

/** The one source file that may spawn a process. */
export const PROCESS_ADAPTER = "src/adapters/node-process.ts";

export const PROCESS_RULE = {
  buildosProgram: "the process adapter names a buildos program",
} as const;

/** `process` members that core may read: data only, no streams or exits. */
export const ALLOWED_PROCESS_MEMBERS: ReadonlySet<string> = new Set(["env", "platform", "arch", "versions"]);

/** `process` members with a named rule. Every other member is a plain reference violation. */
const PROCESS_MEMBER_RULE: ReadonlyMap<string, string> = new Map([
  ["stdout", CORE_RULE.stdout],
  ["stderr", CORE_RULE.stderr],
  ["exit", CORE_RULE.exit],
  ["exitCode", CORE_RULE.exit],
  ["reallyExit", CORE_RULE.exit],
  ["abort", CORE_RULE.exit],
  ["kill", CORE_RULE.exit],
]);

const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(["globalThis", "global", "self", "window"]);
const LOADER_NAMES: ReadonlySet<string> = new Set(["require", "getBuiltinModule"]);
const SPAWN_NAMES: ReadonlySet<string> = new Set(["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]);

/** Node kinds that wrap an expression without changing its value. */
const TRANSPARENT_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.ParenthesizedExpression,
  SyntaxKind.AsExpression,
  SyntaxKind.SatisfiesExpression,
  SyntaxKind.NonNullExpression,
  SyntaxKind.TypeAssertionExpression,
  SyntaxKind.PartiallyEmittedExpression,
]);

/** Parent kinds whose `name` is a property key, not a reference. */
const KEY_PARENT_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.PropertyAssignment,
  SyntaxKind.PropertyDeclaration,
  SyntaxKind.PropertySignature,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.MethodSignature,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
  SyntaxKind.EnumMember,
  SyntaxKind.JsxAttribute,
]);

type AnyNode = Node & Record<string, unknown>;
const field = (node: Node, name: string): Node | undefined => (node as AnyNode)[name] as Node | undefined;

/** The node with casts, parentheses, and non-null assertions removed. */
function unwrap(node: Node): Node {
  let current = node;
  while (TRANSPARENT_KINDS.has(current.kind)) current = field(current, "expression")!;
  return current;
}

/** The nearest ancestor that is not a transparent wrapper, and the child under it. */
function outerParent(node: Node): { parent: Node | undefined; child: Node } {
  let child = node;
  while (child.parent !== undefined && TRANSPARENT_KINDS.has(child.parent.kind)) child = child.parent;
  return { parent: child.parent, child };
}

const literalText = (node: Node | undefined): string | undefined =>
  node !== undefined && (isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;

/** A static member name: `a.name` or `a["name"]`. */
function staticMemberName(access: Node): string | undefined {
  if (isPropertyAccessExpression(access)) return isIdentifier(access.name) ? access.name.text : undefined;
  if (isElementAccessExpression(access)) return literalText(access.argumentExpression);
  return undefined;
}

/** True for `globalThis`, `global`, `self`, `window`, and `globalThis.globalThis`, through any wrapping. */
function isGlobalObject(node: Node): boolean {
  const inner = unwrap(node);
  if (isIdentifier(inner)) return GLOBAL_OBJECTS.has(inner.text);
  if (isPropertyAccessExpression(inner) || isElementAccessExpression(inner)) {
    const name = staticMemberName(inner);
    return name !== undefined && GLOBAL_OBJECTS.has(name) && isGlobalObject(inner.expression);
  }
  return false;
}

/**
 * True when the identifier is a property key or a member name, not a
 * reference: `job.process`, `{ process: 1 }`, `const { process: p } = x`,
 * `NodeJS.process`.
 */
function isKeyPosition(id: Node): boolean {
  const parent = id.parent;
  if (parent === undefined) return false;
  // A member name is never a reference by itself. `globalThis.process` is
  // checked as a whole member access in coreViolations.
  if (isPropertyAccessExpression(parent) && parent.name === id) return true;
  if (isQualifiedName(parent) && parent.right === id) return true;
  if (isBindingElement(parent) && parent.propertyName === id) return true;
  if (KEY_PARENT_KINDS.has(parent.kind) && field(parent, "name") === id) return true;
  return false;
}

/** The name a call or `new` targets: `f(...)`, `a.f(...)`, `a?.["f"](...)`. */
function calleeName(callee: Node): string | undefined {
  const inner = unwrap(callee);
  if (isIdentifier(inner)) return inner.text;
  return staticMemberName(inner);
}

/** Every module that the file names: imports, re-exports, `require()`, `import()`, and import types. */
function moduleSpecifiers(node: Node, add: (specifier: string | undefined, computed: boolean) => void): void {
  if (isImportDeclaration(node) || isExportDeclaration(node)) {
    if (node.moduleSpecifier !== undefined) add(literalText(node.moduleSpecifier), false);
  } else if (isImportEqualsDeclaration(node) && isExternalModuleReference(node.moduleReference)) {
    add(literalText(node.moduleReference.expression), false);
  } else if (isImportTypeNode(node)) {
    add(isLiteralTypeNode(node.argument) ? literalText(node.argument.literal) : undefined, false);
  } else if (isCallExpression(node)) {
    const isImportCall = node.expression.kind === SyntaxKind.ImportKeyword;
    const name = isImportCall ? "import" : calleeName(node.expression);
    if (isImportCall || (name !== undefined && LOADER_NAMES.has(name))) {
      const specifier = literalText(node.arguments[0]);
      add(specifier, specifier === undefined);
    }
  }
}

function isCliSpecifier(filePath: string, specifier: string): boolean {
  if (!specifier.startsWith(".")) return /^src\/cli(?:\/|$)/.test(specifier);
  const resolved = posix.normalize(posix.join(posix.dirname(filePath), specifier));
  if (resolved === "src/cli" || resolved.startsWith("src/cli/")) return true;
  // A path that leaves the tree but still names a `cli` folder counts too.
  return specifier.split("/").includes("cli");
}

/**
 * The rules for a use of the `process` object `use`, from the member it
 * reads. A computed member (`process["stdout"]`) is always a plain reference
 * violation too, and only a static read of an allowed member has no rule.
 */
function processUseRules(use: Node): string[] {
  const { parent, child } = outerParent(use);
  if (parent !== undefined && (isPropertyAccessExpression(parent) || isElementAccessExpression(parent)) && parent.expression === child) {
    const member = staticMemberName(parent);
    const rules: string[] = isElementAccessExpression(parent) ? [CORE_RULE.processReference] : [];
    const named = member === undefined ? undefined : PROCESS_MEMBER_RULE.get(member);
    if (named !== undefined) rules.push(named);
    else if (member === undefined || !ALLOWED_PROCESS_MEMBERS.has(member)) rules.push(CORE_RULE.processReference);
    return rules;
  }
  // An alias, argument, destructuring source, binding, or bare expression.
  return [CORE_RULE.processReference];
}

// ---------------------------------------------------------------------------
// Modules core may load. Core reads and writes the disk only through the
// filesystem port (src/core/shared/fs-port.ts), so it never loads fs or any
// other module that can write to a file descriptor or a stream. The rule is
// structural: the checker does not follow file-descriptor values.

/**
 * Node built-in modules that core may load, without the `node:` prefix. None
 * of them can write to a file descriptor or a stream. Adding one needs a
 * human review and an explicit rule change.
 */
export const CORE_ALLOWED_MODULES: ReadonlySet<string> = new Set(["path", "path/posix", "path/win32", "url", "buffer", "string_decoder"]);

/**
 * W1 R7 P6 review round 4: the core files that may load `crypto`, by path.
 * They hashed with it before P6 (intake conversion and the entities index,
 * Go parity). Every other core file, the init core included, hashes through
 * the hash port. Moving these two to the port is follow-up F-P6-04.
 */
export const CORE_CRYPTO_FILES: ReadonlySet<string> = new Set(["src/core/intake/convert/convert.ts", "src/core/entities/index.ts"]);

/**
 * Node built-in modules that can write to a file descriptor, a stream, a
 * socket, another process, or a thread, or that run code with other powers,
 * without the `node:` prefix. A subpath (such as `fs/promises`) counts too.
 */
export const CORE_IO_MODULES: ReadonlySet<string> = new Set([
  "fs",
  "net",
  "tls",
  "tty",
  "dgram",
  "http",
  "https",
  "http2",
  "child_process",
  "worker_threads",
  "cluster",
  "stream",
  "readline",
  "repl",
  "inspector",
  "wasi",
  "vm",
  "util",
  "sqlite",
  "trace_events",
]);

/** The module name without `node:`. */
const bareModuleName = (specifier: string): string => specifier.replace(/^node:/, "");

function isIoModule(specifier: string): boolean {
  const name = bareModuleName(specifier);
  return CORE_IO_MODULES.has(name.split("/")[0] ?? name);
}

/** Method names that only fs or an fs stream has. Core names none of them, on any object. */
export const FS_WRITE_API_NAMES: ReadonlySet<string> = new Set([
  "writeSync",
  "writevSync",
  "fsyncSync",
  "fdatasyncSync",
  "ftruncateSync",
  "writeFileSync",
  "appendFileSync",
  "createWriteStream",
  "WriteStream",
]);

/**
 * True when the text names a device or console path: a Unix `/dev/` or
 * `/proc/` path (also as a `file:` URL), a Windows device namespace path, or a
 * Windows console device name with any extension.
 */
export function isDevicePath(text: string): boolean {
  const value = text.trim();
  if (/^file:(?:\/\/[^/]*)?\/+(?:dev|proc)(?:\/|$)/i.test(value)) return true;
  if (/^\/+(?:dev|proc)(?:\/|$)/.test(posixNormalize(value))) return true;
  if (/^[\\/]{2}[.?][\\/]/.test(value)) return true;
  const base = value.split(/[\\/]/).pop() ?? "";
  return /^(?:con|conin\$|conout\$)(?:\..*)?$/i.test(base);
}

function posixNormalize(path: string): string {
  return path.startsWith("/") ? posix.normalize(path) : path;
}

/** Parent kinds where an identifier declares a name instead of reading one. */
const DECLARATION_PARENT_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.ImportSpecifier,
  SyntaxKind.ImportClause,
  SyntaxKind.NamespaceImport,
  SyntaxKind.ImportEqualsDeclaration,
  SyntaxKind.VariableDeclaration,
  SyntaxKind.BindingElement,
  SyntaxKind.Parameter,
  SyntaxKind.FunctionDeclaration,
]);

/** True when the identifier is the name an import, variable, parameter, or binding declares. */
function isDeclarationName(id: Node): boolean {
  const parent = id.parent;
  return parent !== undefined && DECLARATION_PARENT_KINDS.has(parent.kind) && (field(parent, "name") === id || field(parent, "propertyName") === id);
}

/** True when `node` is the callee of a call or `new` expression. */
function isCallee(node: Node): boolean {
  const { parent, child } = outerParent(node);
  return parent !== undefined && (isCallExpression(parent) || isNewExpression(parent)) && parent.expression === child;
}

/** The rules for one module that a core file loads. */
function coreModuleRules(filePath: string, specifier: string): string[] {
  const rules: string[] = [];
  const name = bareModuleName(specifier);
  if (name === "process") rules.push(CORE_RULE.processImport);
  if (name === "console") rules.push(CORE_RULE.console);
  if (name === "module") rules.push(CORE_RULE.moduleImport);
  if (isCliSpecifier(filePath, specifier)) rules.push(CORE_RULE.cliImport);
  if (specifier.startsWith(".")) {
    // A relative import must stay in src/core/. The CLI layer has its own rule.
    const resolved = posix.normalize(posix.join(posix.dirname(filePath), specifier));
    if (!resolved.startsWith("src/core/") && !rules.includes(CORE_RULE.cliImport)) rules.push(CORE_RULE.outsideCoreImport);
  } else if (isIoModule(specifier)) {
    rules.push(CORE_RULE.ioModule);
  } else if (rules.length === 0 && !CORE_ALLOWED_MODULES.has(name) && !(name === "crypto" && CORE_CRYPTO_FILES.has(filePath))) {
    rules.push(CORE_RULE.unlistedModule);
  }
  return rules;
}

function coreViolations(file: SourceFile, sourceFile: TsSourceFile): Set<string> {
  const rules = new Set<string>();
  const visit = (node: Node): void => {
    if ((isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) && isDevicePath(node.text)) rules.add(CORE_RULE.devicePath);
    if (isTemplateExpression(node) && isDevicePath(node.head.text)) rules.add(CORE_RULE.devicePath);
    moduleSpecifiers(node, (specifier, computed) => {
      if (computed || specifier === undefined) {
        rules.add(CORE_RULE.computedImport);
        return;
      }
      for (const rule of coreModuleRules(file.path, specifier)) rules.add(rule);
    });

    // `io.writeSync(...)`, `const w = x.createWriteStream`: an fs write API
    // on any object, called or not. Core gets no fs object to call it on.
    if ((isPropertyAccessExpression(node) || isElementAccessExpression(node)) && FS_WRITE_API_NAMES.has(staticMemberName(node) ?? "")) {
      rules.add(CORE_RULE.fsWriteApi);
    }
    if (isIdentifier(node) && !isKeyPosition(node) && FS_WRITE_API_NAMES.has(node.text)) rules.add(CORE_RULE.fsWriteApi);
    // `const r = require; r("fs")`: a loader taken as a value hides what it loads.
    if (isIdentifier(node) && !isKeyPosition(node) && LOADER_NAMES.has(node.text) && !isDeclarationName(node) && !isCallee(node)) {
      rules.add(CORE_RULE.computedImport);
    }
    // `module.constructor._load("fs")` in CommonJS: core is ESM and never needs `module`.
    if (isIdentifier(node) && !isKeyPosition(node) && node.text === "module" && !isDeclarationName(node)) rules.add(CORE_RULE.moduleImport);
    // `({}).constructor.constructor("code")` reaches the Function constructor.
    if ((isPropertyAccessExpression(node) || isElementAccessExpression(node)) && staticMemberName(node) === "constructor") {
      rules.add(CORE_RULE.dynamicCode);
    }

    if (isIdentifier(node) && !isKeyPosition(node)) {
      const name = node.text;
      if (name === "process") {
        for (const rule of processUseRules(node)) rules.add(rule);
      } else if (name === "console") {
        rules.add(CORE_RULE.console);
      } else if (name === "eval" || name === "Function") {
        rules.add(CORE_RULE.dynamicCode);
      } else if (GLOBAL_OBJECTS.has(name)) {
        // Only a static member read is safe; that member is checked below.
        const { parent, child } = outerParent(node);
        const isStaticRead =
          parent !== undefined &&
          (isPropertyAccessExpression(parent) || isElementAccessExpression(parent)) &&
          parent.expression === child &&
          staticMemberName(parent) !== undefined;
        const isTypeQuery = parent !== undefined && parent.kind === SyntaxKind.TypeQuery;
        if (!isStaticRead && !isTypeQuery) rules.add(CORE_RULE.globalObject);
      }
    }

    // `globalThis.process`, `(globalThis as any)["console"]`, and the like.
    if ((isPropertyAccessExpression(node) || isElementAccessExpression(node)) && isGlobalObject(node.expression)) {
      const member = staticMemberName(node);
      if (member === "process") {
        // A computed spelling is always a plain reference violation, and its
        // member use is reported too.
        if (isElementAccessExpression(node)) rules.add(CORE_RULE.processReference);
        for (const rule of processUseRules(node)) rules.add(rule);
      } else if (member === "console") {
        rules.add(CORE_RULE.console);
      } else if (member === "eval" || member === "Function") {
        rules.add(CORE_RULE.dynamicCode);
      }
    }

    if ((isNewExpression(node) || isCallExpression(node)) && calleeName(node.expression) === "Function") {
      rules.add(CORE_RULE.dynamicCode);
    }

    node.forEachChild((child) => {
      visit(child);
      return undefined;
    });
  };
  visit(sourceFile);
  return rules;
}

function cliViolations(sourceFile: TsSourceFile): Set<string> {
  const rules = new Set<string>();
  const visit = (node: Node): void => {
    moduleSpecifiers(node, (specifier) => {
      if (specifier === "child_process" || specifier === "node:child_process") rules.add(CLI_RULE.childProcess);
    });
    if ((isCallExpression(node) || isNewExpression(node)) && SPAWN_NAMES.has(calleeName(node.expression) ?? "")) {
      rules.add(CLI_RULE.spawn);
    }
    node.forEachChild((child) => {
      visit(child);
      return undefined;
    });
  };
  visit(sourceFile);
  return rules;
}

/** The process adapter may spawn, but no string or template text in it may start with `buildos`. */
function processAdapterViolations(sourceFile: TsSourceFile): Set<string> {
  const rules = new Set<string>();
  const visit = (node: Node): void => {
    if ((isStringLiteral(node) || isNoSubstitutionTemplateLiteral(node)) && /^buildos/.test(node.text)) rules.add(PROCESS_RULE.buildosProgram);
    if (isTemplateExpression(node) && /^buildos/.test(node.head.text)) rules.add(PROCESS_RULE.buildosProgram);
    node.forEachChild((child) => {
      visit(child);
      return undefined;
    });
  };
  visit(sourceFile);
  return rules;
}

const VIRTUAL_ROOT = "/buildos-boundary";

/** Parses each file with the TypeScript compiler API, in one virtual project. */
function parseFiles(files: readonly SourceFile[]): Map<string, TsSourceFile> {
  const virtualFiles: Record<string, string> = {
    [`${VIRTUAL_ROOT}/tsconfig.json`]: JSON.stringify({
      compilerOptions: { allowJs: true, noLib: true, types: [], noResolve: true, noEmit: true, module: "nodenext", target: "esnext" },
      include: ["**/*"],
    }),
  };
  for (const file of files) virtualFiles[`${VIRTUAL_ROOT}/${file.path}`] = file.text;
  const api = new API({ cwd: VIRTUAL_ROOT, fs: createVirtualFileSystem(virtualFiles) });
  try {
    const snapshot = api.updateSnapshot({ openProject: `${VIRTUAL_ROOT}/tsconfig.json` });
    const project = snapshot.getProject(`${VIRTUAL_ROOT}/tsconfig.json`);
    if (project === undefined) throw new Error("the TypeScript API did not open the boundary project");
    const parsed = new Map<string, TsSourceFile>();
    for (const file of files) {
      const sourceFile = project.program.getSourceFile(`${VIRTUAL_ROOT}/${file.path}`);
      if (sourceFile === undefined) throw new Error(`the TypeScript API did not parse ${file.path}`);
      parsed.set(file.path, sourceFile);
    }
    return parsed;
  } finally {
    api.close();
  }
}

export function findViolations(files: readonly SourceFile[]): Violation[] {
  const checked = files.filter((file) => file.path.startsWith("src/core/") || file.path.startsWith("src/cli/") || file.path.startsWith("src/adapters/"));
  if (new Set(checked.map((file) => file.path)).size !== checked.length) throw new Error("findViolations needs unique file paths");
  if (checked.length === 0) return [];
  const parsed = parseFiles(checked);
  const violations: Violation[] = [];
  for (const file of checked) {
    const sourceFile = parsed.get(file.path)!;
    const rules = file.path.startsWith("src/core/") ? coreViolations(file, sourceFile) : file.path === PROCESS_ADAPTER ? processAdapterViolations(sourceFile) : cliViolations(sourceFile);
    for (const rule of rules) violations.push({ path: file.path, rule });
  }
  return violations;
}

export function readSourceTree(packageRoot: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(?:[cm]?ts|[cm]?js)$/.test(name)) {
        files.push({ path: relative(packageRoot, full).split(sep).join("/"), text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(join(packageRoot, "src"));
  return files;
}
