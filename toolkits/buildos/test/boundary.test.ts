import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CLI_RULE, CORE_ALLOWED_MODULES, CORE_CRYPTO_FILES, CORE_RULE, findViolations, PROCESS_ADAPTER, PROCESS_RULE, readSourceTree, type Violation } from "./boundary-rules.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("core and CLI boundary", () => {
  it("passes on the real source tree", () => {
    const files = readSourceTree(packageRoot);
    assert.equal(files.some((file) => file.path.startsWith("src/core/")), true);
    assert.equal(files.some((file) => file.path.startsWith("src/cli/")), true);
    assert.deepEqual(findViolations(files), []);
  });

  const R = CORE_RULE;
  const coreCases: [string, string, string[]][] = [
    ["process.stdout.write", 'process.stdout.write("x");', [R.stdout]],
    ["process.stderr", "process.stderr.write('x');", [R.stderr]],
    ["console", "console.log('x');", [R.console]],
    ["process.exit", "process.exit(1);", [R.exit]],
    ["process.exitCode", "process.exitCode = 3;", [R.exit]],
    ["optional-chain process?.exit", "process?.exit(1);", [R.exit]],
    ["a CLI import", 'import { run } from "../cli/run.ts";', [R.cliImport]],
    ["a dynamic CLI import", 'await import("../../cli/run.ts");', [R.cliImport]],
    // Reviewer case 1: a side-effect import from the CLI layer.
    ["a side-effect CLI import", 'import "../../cli/run.ts";', [R.cliImport]],
    ["a type-only CLI import", 'import type { CliIo } from "../cli/io.ts";', [R.cliImport]],
    ["a re-export from the CLI", 'export * from "../cli/output.ts";', [R.cliImport]],
    ["a require of the CLI", 'const cli = require("../cli/run.ts");', [R.cliImport]],
    // Reviewer case 2: a named import of a process stream.
    ["a named stdout import", 'import { stdout } from "node:process";\nstdout.write("x");', [R.processImport]],
    ["a named exit import", 'import { exit } from "process";\nexit(1);', [R.processImport]],
    ["a namespace process import", 'import * as p from "process";\np.stdout.write("x");', [R.processImport]],
    ["a default process import", 'import proc from "node:process";', [R.processImport]],
    ["a require of node:process", 'const { stdout } = require("node:process");', [R.processImport]],
    ["a dynamic process import", 'const p = await import("node:process");', [R.processImport]],
    ["globalThis.process", 'globalThis.process.stdout.write("x");', [R.stdout]],
    ["computed globalThis process", 'globalThis["process"].exit(1);', [R.processReference]],
    ["destructured process streams", 'const { stdout } = process;\nstdout.write("x");', [R.processReference]],
    ["destructured process exit", "const { exit: quit } = process;", [R.processReference]],
    ["an aliased process", "const p = process;\np.exit(1);", [R.processReference]],
    ["process passed as a value", "useStreams(process);", [R.processReference]],
    ["computed process member", 'process["stdout"].write("x");', [R.processReference]],
    ["process.stdout inside a template expression", "const s = `${process.stdout.columns}`;", [R.stdout]],
    ["an aliased console", 'const c = console;\nc.log("x");', [R.console]],
    ["destructured console", 'const { log } = console;\nlog("x");', [R.console]],
    ["globalThis.console", 'globalThis.console.error("x");', [R.console]],
    ["computed global console", 'global["console"].log("x");', [R.console]],
    ["a console module import", 'import { log } from "node:console";', [R.console]],
    ["a console require", 'const { Console } = require("console");', [R.console]],
    // Review round 3: writes the text scanner missed.
    ["process.getBuiltinModule of node:process", 'process.getBuiltinModule("node:process").stdout.write("x");', [R.processImport, R.processReference]],
    ["a cast globalThis.process.stdout", '(globalThis as typeof globalThis).process.stdout.write("x");', [R.stdout]],
    // More spellings the syntax checker must see through.
    ["a bare getBuiltinModule of process", 'const p = getBuiltinModule("process");', [R.processImport]],
    ["getBuiltinModule of console", 'process.getBuiltinModule("node:console");', [R.console]],
    ["an optional computed cast global process exit", '(globalThis as any)?.["process"]?.exit(1);', [R.exit, R.processReference]],
    ["a non-null global process stdout", 'globalThis!.process.stdout.write("x");', [R.stdout]],
    ["an angle-bracket cast global process exit", "(<any>globalThis).process.exit(1);", [R.exit]],
    ["a satisfies global console", '(globalThis satisfies object).console.log("x");', [R.console]],
    ["a nested globalThis.globalThis.process", "globalThis.globalThis.process.exit(1);", [R.exit]],
    ["a parenthesized process stderr", '(process).stderr.write("x");', [R.stderr]],
    ["a process cast to any", '(process as any).stdout.write("x");', [R.stdout]],
    ["an aliased global object", "const g = globalThis;\ng.process.exit(1);", [R.globalObject]],
    ["a global object passed to Reflect", 'Reflect.get(globalThis, "process");', [R.globalObject]],
    ["a computed global member", "const k = 'process';\nglobalThis[k].exit(1);", [R.globalObject]],
    ["an import-equals require of process", 'import p = require("node:process");', [R.processImport]],
    ["a renamed named process import", 'import { stdout as out } from "node:process";', [R.processImport]],
    ["module.require of process", 'module.require("node:process");', [R.processImport]],
    ["a node:module import", 'import { createRequire } from "node:module";', [R.moduleImport]],
    ["a computed require", "const name = 'node:process';\nrequire(name);", [R.computedImport]],
    ["a computed dynamic import", "const spec = 'x';\nawait import(spec);", [R.computedImport]],
    ["a template dynamic import with a substitution", 'const n = "process";\nawait import(`node:${n}`);', [R.computedImport]],
    ["eval", 'eval("process.exit(1)");', [R.dynamicCode]],
    ["the Function constructor", 'new Function("return process")();', [R.dynamicCode]],
    ["an import type of the CLI", 'type Run = typeof import("../cli/run.ts");', [R.cliImport]],
    ["a named re-export from the CLI", 'export { run } from "../cli/run.ts";', [R.cliImport]],
    ["an import-equals require of the CLI", 'import cli = require("../cli/run.ts");', [R.cliImport]],
    ["a parameter named process", "export function f(process: { exit(code: number): void }) { process.exit(1); }", [R.processReference, R.exit]],
    ["a shorthand process property", "const o = { process };", [R.processReference]],
    ["process.stdin", "process.stdin.read();", [R.processReference]],
    ["process.getBuiltinModule alias", 'const load = process.getBuiltinModule;\nload("node:process");', [R.processReference]],
    ["a computed allowed member", 'const e = process["env"];', [R.processReference]],
    ["optional console", 'console?.log("x");', [R.console]],
    ["a cast console", '(console as any).log("x");', [R.console]],
    ["typeof process in a type", "type P = typeof process;", [R.processReference]],
    // Review round 4 cases. Core may not load fs at all now, so each one
    // fails on the import itself, and the device-path cases fail twice.
    ["the reviewer's writeSync(1) probe", 'import { writeSync } from "node:fs";\nwriteSync(1, "review probe");', [R.ioModule]],
    ["fs.writeSync(2) on a namespace", 'import * as fs from "fs";\nfs.writeSync(2, "x");', [R.ioModule, R.fsWriteApi]],
    ["a default fs import write(1)", 'import fs from "node:fs";\nfs.write(1, "x", () => {});', [R.ioModule]],
    ["an aliased named import", 'import { writeSync as w } from "node:fs";\nw(1, "x");', [R.ioModule]],
    ["a require binding", 'const fs = require("fs");\nfs.writeSync(1, "x");', [R.ioModule]],
    ["an inline require", 'require("node:fs").writeSync(1, "x");', [R.ioModule]],
    ["a destructured require", 'const { writeSync } = require("node:fs");\nwriteSync(1, "x");', [R.ioModule]],
    ["an awaited import()", 'const fs = await import("node:fs");\nfs.writeSync(1, "x");', [R.ioModule]],
    ["writeFileSync(1)", 'import { writeFileSync } from "node:fs";\nwriteFileSync(1, "x");', [R.ioModule]],
    ["writeFile(2)", 'import { writeFile } from "node:fs";\nwriteFile(2, "x", () => {});', [R.ioModule]],
    ["appendFileSync(1)", 'import { appendFileSync } from "node:fs";\nappendFileSync(1, "x");', [R.ioModule]],
    ["appendFile(2)", 'import * as fs from "node:fs";\nfs.appendFile(2, "x", () => {});', [R.ioModule]],
    ["writev(1)", 'import { writevSync } from "node:fs";\nwritevSync(1, []);', [R.ioModule]],
    ["fsyncSync(1)", 'import { fsyncSync } from "node:fs";\nfsyncSync(1);', [R.ioModule]],
    ["fd 0", 'import { writeSync } from "node:fs";\nwriteSync(0, "x");', [R.ioModule]],
    ["a hex fd literal", 'import { writeSync } from "node:fs";\nwriteSync(0x1, "x");', [R.ioModule]],
    ["a negative zero fd", 'import { writeSync } from "node:fs";\nwriteSync(-0, "x");', [R.ioModule]],
    ["a cast fd literal", 'import { writeSync } from "node:fs";\nwriteSync((1 as number), "x");', [R.ioModule]],
    ["a const fd", 'import { writeFileSync } from "node:fs";\nconst out = 1;\nwriteFileSync(out, "x");', [R.ioModule]],
    ["createWriteStream with fd 1", 'import { createWriteStream } from "node:fs";\ncreateWriteStream("", { fd: 1 });', [R.ioModule]],
    ["new WriteStream with fd 2", 'import * as fs from "node:fs";\nnew fs.WriteStream(null, { fd: 2 });', [R.ioModule, R.fsWriteApi]],
    ["promises.writeFile on /dev/stdout", 'import { promises } from "node:fs";\nawait promises.writeFile("/dev/stdout", "x");', [R.ioModule, R.devicePath]],
    ["fs/promises writeFile on /dev/stderr", 'import { writeFile } from "node:fs/promises";\nawait writeFile("/dev/stderr", "x");', [R.ioModule, R.devicePath]],
    ["a FileHandle from open on /dev/stdout", 'import { open } from "node:fs/promises";\nconst h = await open("/dev/stdout", "w");\nawait h.write("x");', [R.ioModule, R.devicePath]],
    ["fs.promises.open on /dev/fd/1", 'import fs from "node:fs";\nawait fs.promises.open("/dev/fd/1", "w");', [R.ioModule, R.devicePath]],
    ["/dev/fd/2", 'import { writeFileSync } from "node:fs";\nwriteFileSync("/dev/fd/2", "x");', [R.ioModule, R.devicePath]],
    ["/proc/self/fd/1", 'import { writeFileSync } from "node:fs";\nwriteFileSync("/proc/self/fd/1", "x");', [R.ioModule, R.devicePath]],
    ["/dev/tty", 'import { createWriteStream } from "node:fs";\ncreateWriteStream("/dev/tty");', [R.ioModule, R.devicePath]],
    ["a non-normal /dev path", 'const p = "/tmp/../dev/stdout";', [R.devicePath]],
    ["a file: URL to /dev/stdout", 'const u = "file:///dev/stdout";', [R.devicePath]],
    ["a /dev template", "const p = `/dev/${name}`;", [R.devicePath]],
    ["Windows CON", 'import { writeFileSync } from "node:fs";\nwriteFileSync("CON", "x");', [R.ioModule, R.devicePath]],
    ["Windows conout$", 'const p = "conout$";', [R.devicePath]],
    ["a Windows device namespace path", String.raw`const p = "\\\\.\\CON";`, [R.devicePath]],
    ["a device path held in a const", 'import { appendFileSync } from "node:fs";\nconst out = "/dev/stdout";\nappendFileSync(out, "x");', [R.ioModule, R.devicePath]],
    ["writeSync with a variable fd", 'import { writeSync } from "node:fs";\nexport function f(fd: number) { writeSync(fd, "x"); }', [R.ioModule]],
    ["fs.write with a variable fd", 'import * as fs from "node:fs";\nexport function f(fd: number) { fs.write(fd, "x", () => {}); }', [R.ioModule]],
    ["writeSync on any object", "export function f(io: any, fd: number) { io.writeSync(fd, 'x'); }", [R.fsWriteApi]],
    ["an aliased fs.writeSync value", 'import * as fs from "node:fs";\nconst w = fs.writeSync;\nw(1, "x");', [R.ioModule, R.fsWriteApi]],
    ["fs.writeSync.call", 'import * as fs from "node:fs";\nfs.writeSync.call(null, 1, "x");', [R.ioModule, R.fsWriteApi]],
    ["a passed named import", 'import { writeSync } from "node:fs";\nReflect.apply(writeSync, null, [1, "x"]);', [R.ioModule, R.fsWriteApi]],
    ["createWriteStream with a variable fd", 'import { createWriteStream } from "node:fs";\nexport function f(fd: number) { createWriteStream("", { fd }); }', [R.ioModule]],
    ["createWriteStream with opaque options", 'import { createWriteStream } from "node:fs";\nexport function f(o: object) { createWriteStream("", o); }', [R.ioModule]],
    // Formerly allowed: core wrote project files through fs. Now it uses the port.
    ["writeFileSync to a project path", 'import { writeFileSync } from "node:fs";\nexport function save(path: string, text: string) { writeFileSync(path, text); }', [R.ioModule]],
    ["promises.writeFile and appendFile to project paths", 'import { appendFile, writeFile } from "node:fs/promises";\nexport async function save(p: string) { await writeFile(p, "x"); await appendFile(`${p}.log`, "y"); }', [R.ioModule]],
    ["a FileHandle from open on a project path", 'import { open } from "node:fs/promises";\nexport async function save(p: string) { const h = await open(p, "w"); await h.write("x"); await h.close(); }', [R.ioModule]],
    ["createWriteStream on a project path", 'import { createWriteStream } from "node:fs";\nexport function s(p: string) { return createWriteStream(p, { flags: "a" }); }', [R.ioModule]],
    ["fs reads", 'import { readFileSync, readSync } from "node:fs";\nexport function r(p: string) { return readFileSync(p, "utf8"); }', [R.ioModule]],
    // Final review: the three fd-tracking escapes. Each fails on the fs import.
    ["a reassigned fd variable", 'import { writeSync } from "node:fs";\nlet fd = 3;\nfd = 1;\nwriteSync(fd, "x");', [R.ioModule]],
    ["writeFileSync with a parameter defaulting to fd 1", 'import { writeFileSync } from "node:fs";\nexport function f(fd = 1) { writeFileSync(fd, "x"); }', [R.ioModule]],
    ["a stream-options spread overriding fd", 'import { createWriteStream } from "node:fs";\nconst base = { fd: 1 };\ncreateWriteStream("out.txt", { fd: 3, ...base });', [R.ioModule]],
    // Every load form of fs.
    ["a side-effect fs import", 'import "node:fs";', [R.ioModule]],
    ["a type-only fs import", 'import type { Stats } from "node:fs";', [R.ioModule]],
    ["an fs import type", 'type F = typeof import("fs");', [R.ioModule]],
    ["an import-equals require of fs", 'import fs = require("fs");', [R.ioModule]],
    ["getBuiltinModule of fs", 'const fs = getBuiltinModule("node:fs");', [R.ioModule]],
    ["globalThis.require of fs", 'globalThis.require("fs");', [R.ioModule]],
    ["a re-export of fs", 'export * from "node:fs";', [R.ioModule]],
    ["a named re-export of fs/promises", 'export { writeFile } from "fs/promises";', [R.ioModule]],
    ["a require taken as a value", 'const r = require;\nr("fs");', [R.computedImport]],
    ["getBuiltinModule taken as a value", "const load = getBuiltinModule;", [R.computedImport]],
    ["the CommonJS module object", 'module.constructor._load("fs");', [R.moduleImport]],
    ["a constructor chain to Function", '({}).constructor.constructor("return process")();', [R.dynamicCode]],
    // Other modules that can write to a file descriptor or a stream.
    ["a net import", 'import { connect } from "node:net";', [R.ioModule]],
    ["a tty import", 'import { WriteStream } from "tty";\nnew WriteStream(1).write("x");', [R.ioModule]],
    ["a child_process require", 'const cp = require("node:child_process");', [R.ioModule]],
    ["a worker_threads import", 'await import("node:worker_threads");', [R.ioModule]],
    ["a stream Writable import", 'import { Writable } from "node:stream";', [R.ioModule]],
    ["a stream/promises import", 'import { pipeline } from "stream/promises";', [R.ioModule]],
    ["a readline import", 'import { createInterface } from "node:readline";', [R.ioModule]],
    ["an http import", 'import http from "node:http";', [R.ioModule]],
    ["a util import (debuglog writes to stderr)", 'import { debuglog } from "node:util";', [R.ioModule]],
    ["a vm import", 'import vm from "node:vm";', [R.ioModule]],
    ["a dgram getBuiltinModule", 'getBuiltinModule("dgram");', [R.ioModule]],
    // Modules outside the allowlist, and files outside core.
    ["an npm package import", 'import pad from "left-pad";', [R.unlistedModule]],
    ["an os import", 'import { EOL } from "node:os";', [R.unlistedModule]],
    ["an adapter import", 'import { createNodeFsPort } from "../adapters/node-fs.ts";', [R.outsideCoreImport]],
    ["a type import of the adapter", 'type P = typeof import("../adapters/node-fs.ts");', [R.outsideCoreImport]],
    ["a test helper import", 'import { x } from "../../test/helpers.ts";', [R.outsideCoreImport]],
  ];
  // All planted files go through one TypeScript API session.
  const corePath = (index: number) => `src/core/planted-${index}.ts`;
  let coreFound: Violation[] | undefined;
  const coreViolationsFor = (index: number) => {
    coreFound ??= findViolations(coreCases.map(([, text], i) => ({ path: corePath(i), text })));
    return coreFound.filter((v) => v.path === corePath(index)).map((v) => v.rule);
  };
  coreCases.forEach(([label, , rules], index) => {
    it(`fails on planted ${label} in src/core/`, () => {
      const found = coreViolationsFor(index);
      assert.ok(found.length > 0, "no violation found");
      for (const rule of rules) assert.ok(found.includes(rule), `${rule} not in ${JSON.stringify(found)}`);
    });
  });

  const allowedCases: [string, string][] = [
    ["rule names in strings", 'const m = "do not call process.stdout or console.log";'],
    ["rule names in templates", "const m = `process.exit and console`;"],
    ["a property named process", "job.process.stdout = 1; const x = { y: task.console };"],
    ["identifiers that start with process", "const processed = processFile(input);"],
    ["an allowed process member", "const home = process.env.HOME;"],
    ["a non-CLI relative import", 'import { x } from "../shared/client.ts";'],
    ["a regex literal with quotes", 'const q = /["\'`]/g; const ok = 1;'],
    // Review round 3: an inert string with import-like text is not an import.
    ["an inert string with import-like text", 'const s = "import { run } from \'../cli/run.ts\'";'],
    ["an inert template with require text", 'const t = `require("node:process") and import("../cli/run.ts") ${1}`;'],
    ["a regex literal with process text", "const r = /process\\.stdout\\.write|console\\.log/;"],
    ["a comment with an import", '// import "../cli/run.ts";\n/* require("node:process") */\nexport const x = 1;'],
    ["a static global member read", "const copy = globalThis.structuredClone({ a: 1 });"],
    ["a destructuring key named process", "const { process: p, console: c } = job;"],
    ["interface members named process and console", "interface J { process: string; console: number }"],
    ["class members named process and console", "class C { process() {} console = 1; get exit() { return 1; } }"],
    ["an enum member named process", "enum E { process, console }"],
    ["typeof globalThis in a type", "type G = typeof globalThis;"],
    ["a qualified type name ending in process", "type P = NodeJS.process;"],
    ["process.platform", "const p = process.platform;"],
    ["a call with a process string argument", 'log("node:process");'],
    // Canonical writes to project paths go through the filesystem port.
    ["a write through the filesystem port", 'import type { FsPort } from "./fs-port.ts";\nexport function save(fs: FsPort, p: string) { fs.writeFileAtomic(p, "x"); fs.rename(p, `${p}.bak`); }'],
    ["reads through the filesystem port", 'import type { FsPort, FsPortFactory } from "../shared/fs-port.ts";\nexport function r(open: FsPortFactory, root: string) { const fs: FsPort = open(root); return fs.exists("a") ? fs.readText("a", 1024) : fs.list("."); }'],
    ["allowlisted built-in modules", 'import { join } from "node:path";\nimport { posix } from "path";\nimport { fileURLToPath } from "node:url";\nimport { Buffer } from "node:buffer";'],
    ["a class constructor declaration", "class C { constructor(readonly n: number) {} }"],
    ["a stream write of text", "export function w(stream: { write(t: string): void }) { stream.write('1'); }"],
    ["a project path that contains dev", 'const p = "docs/dev/notes.md"; const q = "/home/me/dev/x";'],
    ["a word that starts with con", 'const c = "console-free"; const d = "content.md";'],
  ];
  const allowedPath = (index: number) => `src/core/shared/allowed-${index}.ts`;
  let allowedFound: Violation[] | undefined;
  allowedCases.forEach(([label], index) => {
    it(`allows ${label} in src/core/`, () => {
      allowedFound ??= findViolations(allowedCases.map(([, text], i) => ({ path: allowedPath(i), text })));
      assert.deepEqual(allowedFound.filter((v) => v.path === allowedPath(index)), []);
    });
  });

  it("fails a core file that re-exports fs, even when other core files import it", () => {
    const found = findViolations([
      { path: "src/core/shared/io.ts", text: 'export { writeSync } from "node:fs";' },
      { path: "src/core/shared/uses-io.ts", text: 'import { writeSync } from "./io.ts";\nexport const w = () => writeSync;' },
      { path: "src/core/shared/chain.ts", text: 'export * from "./io.ts";' },
    ]);
    assert.ok(found.some((v) => v.path === "src/core/shared/io.ts" && v.rule === R.ioModule), JSON.stringify(found));
    assert.ok(found.some((v) => v.path === "src/core/shared/uses-io.ts" && v.rule === R.fsWriteApi), JSON.stringify(found));
  });

  // W1 R7 P6 review round 4 (P6-R4-08): crypto is not a core module any more; only the two files that used it before P6 may load it.
  it("fails a core file that loads crypto, except the two files listed by path", () => {
    const text = 'import { createHash } from "node:crypto";\nexport const h = createHash;';
    for (const path of ["src/core/init/shared-files.ts", "src/core/init/planted.ts", "src/core/shared/planted.ts"]) {
      assert.deepEqual(findViolations([{ path, text }]).map((v) => v.rule), [CORE_RULE.unlistedModule], path);
    }
    assert.deepEqual(findViolations([{ path: "src/core/init/planted.ts", text: 'const c = require("crypto");' }]).map((v) => v.rule), [CORE_RULE.unlistedModule]);
    for (const path of CORE_CRYPTO_FILES) assert.deepEqual(findViolations([{ path, text }]), [], path);
  });

  it("the real init core loads no built-in module beyond the rules from before review round 3", () => {
    const init = readSourceTree(packageRoot).filter((file) => file.path.startsWith("src/core/init/"));
    assert.ok(init.some((file) => file.path === "src/core/init/shared-files.ts"));
    for (const file of init) {
      const builtins = [...file.text.matchAll(/\bfrom\s+["'](?:node:)?([a-z_/]+)["']|\brequire\(\s*["'](?:node:)?([a-z_/]+)["']\s*\)/g)].map((m) => m[1] ?? m[2] ?? "");
      for (const name of builtins) assert.ok(CORE_ALLOWED_MODULES.has(name), `${file.path} loads ${name}`);
    }
    assert.deepEqual(findViolations(init), []);
  });

  it("checks that no file in the real src/core/ loads an I/O module", () => {
    const core = readSourceTree(packageRoot).filter((file) => file.path.startsWith("src/core/"));
    assert.ok(core.some((file) => file.path === "src/core/shared/fs-port.ts"), "the filesystem port is in core");
    assert.deepEqual(findViolations(core), []);
  });

  it("ignores rule names inside comments", () => {
    const text = "// never call process.stdout here\n/* console.log */\nexport const x = 1;\n";
    assert.deepEqual(findViolations([{ path: "src/core/doc.ts", text }]), []);
  });

  const cliCases: [string, string, string][] = [
    ["child_process import", 'import { spawnSync } from "node:child_process";', CLI_RULE.childProcess],
    ["child_process require", 'const cp = require("child_process");', CLI_RULE.childProcess],
    ["child_process dynamic import", 'await import("node:child_process");', CLI_RULE.childProcess],
    ["spawn of buildos", 'spawn("buildos", ["entities", "validate"]);', CLI_RULE.spawn],
    ["execFile of an adapter", 'execFileSync("buildos-intake", []);', CLI_RULE.spawn],
    ["a member spawn", 'cp.spawnSync("buildos", []);', CLI_RULE.spawn],
  ];
  const cliPath = (index: number) => `src/cli/planted-${index}.ts`;
  let cliFound: Violation[] | undefined;
  cliCases.forEach(([label, , rule], index) => {
    it(`fails when src/cli/ has a ${label}`, () => {
      cliFound ??= findViolations(cliCases.map(([, text], i) => ({ path: cliPath(i), text })));
      assert.deepEqual(cliFound.filter((v) => v.path === cliPath(index)).map((v) => v.rule), [rule]);
    });
  });

  it("applies the CLI spawn rule to src/adapters/", () => {
    const found = findViolations([{ path: "src/adapters/planted.ts", text: 'import { spawnSync } from "node:child_process";\nspawnSync("buildos", []);' }]);
    assert.deepEqual(found.map((v) => v.rule).sort(), [CLI_RULE.childProcess, CLI_RULE.spawn].sort());
  });

  it("lets only the process adapter spawn, and never a buildos program (W1 R7 P6)", () => {
    const spawn = 'import { spawnSync } from "node:child_process";\nexport const run = (p: string) => spawnSync(p, []);';
    assert.deepEqual(findViolations([{ path: PROCESS_ADAPTER, text: spawn }]), []);
    assert.deepEqual(findViolations([{ path: "src/adapters/other-process.ts", text: spawn }]).map((v) => v.rule).sort(), [CLI_RULE.childProcess, CLI_RULE.spawn].sort());
    for (const text of ['spawnSync("buildos", []);', 'spawnSync("buildos-intake", []);', "spawnSync(`buildos-${x}`, []);"]) {
      assert.deepEqual(findViolations([{ path: PROCESS_ADAPTER, text: `${spawn}\n${text}` }]).map((v) => v.rule), [PROCESS_RULE.buildosProgram], text);
    }
    assert.deepEqual(findViolations([{ path: "src/core/planted.ts", text: 'import { spawnSync } from "node:child_process";' }]).map((v) => v.rule), [CORE_RULE.ioModule]);
  });

  it("lets src/adapters/ load fs", () => {
    assert.deepEqual(findViolations([{ path: "src/adapters/fs.ts", text: 'import { writeFileSync } from "node:fs";\nexport const w = writeFileSync;' }]), []);
  });

  it("allows src/cli/ text that only names child_process or spawn", () => {
    const text = 'const s = "node:child_process spawn(x)"; // spawn("buildos")\nconst n = job.spawnCount;';
    assert.deepEqual(findViolations([{ path: "src/cli/allowed.ts", text }]), []);
  });
});
