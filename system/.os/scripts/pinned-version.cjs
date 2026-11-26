// BuildOS project wrapper helper. It runs on any Node.js version and needs
// no package.
//
// Pin first (PRD 06 Wrapper Resolution; owner decision 2026-11-25, Q-015;
// W1 R7 P8 pin-first review rounds 1 and 2): a project always runs the
// BuildOS version pinned in .os/manifest.json. The helper never starts a
// program to learn its version. It reads package.json files only, to choose
// a candidate:
//
// 1. The project's own npm install: node_modules/build-os in
//    the project folder and each folder above it, then in the folder where
//    npm looks for the local project (the first folder up from the current
//    folder that holds a package.json file or a node_modules folder) and
//    each folder above it, as Node.js module resolution looks.
// 2. Only when no local install counts, the first buildos on PATH, when it
//    is an npm install: on macOS and Linux its real path (all links
//    followed) is the "buildos" bin file of the nearest package.json above
//    it; on Windows it is an npm .cmd shim, and the package is
//    node_modules\build-os next to it.
//
// A package counts only when its package.json (a regular file, read with a
// size limit, strict JSON) has the name build-os and exactly
// the pinned version (any version for a dev pin), and its "buildos" bin file
// is a readable regular file inside the package and not inside a
// node_modules folder below it. Then the wrapper runs that bin file with this
// same Node.js (node ENTRY ARGS...), in the same working folder. Any other
// layout (a pnpm, yarn, or Volta shim, a hand-made script, a file that cannot
// be read) does not count, and the pinned version runs through
// npx -y build-os@VERSION. A dev pin has no published
// version: with no package that counts, it stops (exit 3).
//
// The check that decides (review round 2): every start sets
// BUILDOS_REQUIRE_VERSION to the pinned version (or dev), and the BuildOS
// program that starts stops itself (exit 3) when its own version is another
// one (src/cli/required-version.ts). So a candidate chosen here, or a
// program that npx chose, never runs a command at another version.
//
// Usage (sh wrapper): node pinned-version.cjs --sh SELF MANIFEST
//   SELF is the sh wrapper's own path. Prints four lines, "run", the pinned
//   version, this Node.js, and the bin file, when a package counts. Else
//   prints the pinned version, so the wrapper can run npx. Exit 127 with the
//   plain Node.js message (node-required.txt) when this Node is older than
//   24; exit 3 with a plain message when the manifest breaks the manifest
//   contract, or pins dev and no package counts.
//
// Usage (sh wrapper, npx): node pinned-version.cjs --npx NPX VERSION ARGS...
//   Starts NPX (the path the sh wrapper found) with
//   -y --prefix <current folder> --workspaces=false
//   build-os@VERSION ARGS..., npm bin links on, the
//   caller's bin-links settings saved in any case and spelling, and
//   BUILDOS_REQUIRE_VERSION set, and exits with its exit code. The Windows
//   wrapper starts npx the same way (pin-first final check, findings 2 and 5).
//
// Usage (Windows wrapper): node pinned-version.cjs --cmd SELF MANIFEST ARGS...
//   Decides and starts the program itself, with this console and the exact
//   arguments, and exits with its exit code (W1 R7 P6 review round 3). It
//   looks for the first buildos program on PATH, as Windows would run it,
//   but in PATH order only (never the current folder), and skips every
//   BuildOS project wrapper (SELF too). No path goes back to Command Prompt
//   as text, so a folder name in any language reaches the program as it is,
//   whatever the console code page. A command line that Command Prompt
//   cannot take (8,191 characters) stops with a plain message (exit 2).
//
// The manifest contract is PRD 20 Manifest Contract. It is implemented once
// in TypeScript (src/core/init/manifest.ts) and mirrored here exactly; both
// are tested against test/fixtures/manifest-contract.json, from bytes and
// from files on disk.
"use strict";
var fs = require("fs");
var path = require("path");
var childProcess = require("child_process");
var os = require("os");

var NODE_MESSAGE = "BuildOS needs Node.js 24 or newer on this computer.\n";
var NPX_MESSAGE = "BuildOS needs npx to fetch the BuildOS version this project uses. npx comes with Node.js: install Node.js 24 or newer from https://nodejs.org, then try again.\n";
var NO_VERSION_MESSAGE = "BuildOS cannot find its version for this project in .os/manifest.json. Run \"buildos init\" in the project folder, then try again.\n";
var DEV_MESSAGE =
  "This project was set up by a development build of BuildOS (buildos_version \"dev\" in .os/manifest.json). npm has no dev version to fetch. Do one of these, then try again:\n" +
  "- Use the matching development build: in its source folder (toolkits/buildos), run \"npm run build\" and \"npm link\", or install that build in this project with \"npm install <path to that folder>\".\n" +
  "- Pin a published release: set buildos_version in .os/manifest.json to a published version, such as the one that \"npm view build-os version\" shows.\n";

var PACKAGE_NAME = "build-os";
var PACKAGE_JSON_MAX_BYTES = 256 * 1024;
/** How many bytes of a PATH candidate the wrapper check reads (finding 9). */
var WRAPPER_HEAD_BYTES = 1024;

// W1 R7 P8 pin-first review round 2: the variables of the self-check. The
// wrapper sets REQUIRE_VERSION on every start; the CLI checks it and removes
// it (src/cli/required-version.ts). With npm bin links turned on for npx,
// the caller's own settings travel as SAVED_PREFIX + name, and the CLI puts
// them back before it starts any other program.
var REQUIRE_VERSION = "BUILDOS_REQUIRE_VERSION";
var NPM_BIN_LINKS_OVERRIDE = "BUILDOS_NPM_BIN_LINKS_OVERRIDE";
var SAVED_PREFIX = "BUILDOS_SAVED_";
var BIN_LINKS_NAME = /^npm_config_bin[-_]links$/i;
/** Command Prompt's limit on one command line (finding 11). */
var CMD_LINE_LIMIT = 8191;
/** Room kept for npm's own npx.cmd line (its node.exe and npx-cli.js paths), on top of twice the npx.cmd path. */
var NPX_SHIM_RESERVE = 600;

// ---------------------------------------------------------------- Manifest contract

var MANIFEST_MAX_BYTES = 64 * 1024;
var NUMERIC = "0|[1-9][0-9]*";
var PRERELEASE_ID = "(?:" + NUMERIC + "|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
var EXACT_VERSION = new RegExp("^(?:" + NUMERIC + ")\\.(?:" + NUMERIC + ")\\.(?:" + NUMERIC + ")(?:-" + PRERELEASE_ID + "(?:\\." + PRERELEASE_ID + ")*)?$");
var UTC_TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,9})?Z$/;

// The largest MAJOR, MINOR, or PATCH number that npm reads as a version
// (semver's Number.MAX_SAFE_INTEGER bound). npm reads a version with a larger
// one as a dist-tag (W1 R7 P8 pin-first review round 2, finding 6).
var MAX_VERSION_NUMBER = "9007199254740991";

function isSafeVersionNumber(n) {
  return n.length < MAX_VERSION_NUMBER.length || (n.length === MAX_VERSION_NUMBER.length && n <= MAX_VERSION_NUMBER);
}

function isExactVersion(version) {
  if (version.length > 256 || !EXACT_VERSION.test(version)) return false;
  var parts = version.split("-")[0].split(".");
  for (var i = 0; i < parts.length; i++) {
    if (!isSafeVersionNumber(parts[i])) return false;
  }
  return true;
}

function isUtcTimestamp(text) {
  var m = UTC_TIME.exec(text);
  if (m === null) return false;
  var year = Number(m[1]);
  var month = Number(m[2]);
  var day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return false;
  var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= days;
}

function toBuffer(text) {
  return typeof Buffer.from === "function" ? Buffer.from(text, "utf8") : new Buffer(text, "utf8");
}

function allocBuffer(size) {
  return typeof Buffer.alloc === "function" ? Buffer.alloc(size) : new Buffer(size);
}

// The manifest as read, or undefined when its bytes break the contract.
function parseManifest(bytes) {
  if (bytes.length > MANIFEST_MAX_BYTES) return undefined;
  var start = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  var body = bytes.slice(start);
  var text = body.toString("utf8");
  // Bytes that are not valid UTF-8 do not survive the round trip.
  if (!toBuffer(text).equals(body)) return undefined;
  var value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  var version = value.buildos_version;
  var time = value.initialized_at;
  if (value.schema_version !== 1 || typeof version !== "string" || typeof time !== "string") return undefined;
  if (!(version === "dev" || isExactVersion(version)) || !isUtcTimestamp(time)) return undefined;
  return { schema_version: 1, buildos_version: version, initialized_at: time };
}

// W1 R7 P6 review round 4: true when two bigint stat results name the same
// entry. An inode of 0 means the OS reports no identity, so it never matches.
function sameFileStats(a, b) {
  return typeof a.ino === "bigint" && typeof b.ino === "bigint" && a.ino !== BigInt(0) && a.dev === b.dev && a.ino === b.ino;
}

// W1 R7 P6 review round 3: the manifest file as buildos init reads it. Only
// a regular file at the name (a link is never followed), opened once, checked
// to be the entry at the name, and read with a bound: a file over the limit
// is refused without reading it. Returns the manifest, or undefined.
function readManifestFile(file) {
  var bytes = readBoundedFile(file, MANIFEST_MAX_BYTES);
  return bytes === undefined ? undefined : parseManifest(bytes);
}

// ---------------------------------------------------------------- Installed package check

// The bytes of a regular file at `file` (a link at the name is never
// followed), opened once, checked to be the entry at the name, and read with
// the bound `max`: a file over the bound is refused without reading it.
// Returns the bytes, or undefined.
function readBoundedFile(file, max) {
  var named;
  try {
    named = fs.lstatSync(file, { bigint: true });
  } catch (error) {
    return undefined;
  }
  if (!named.isFile() || Number(named.size) > max) return undefined;
  var nofollow = (fs.constants && fs.constants.O_NOFOLLOW) || 0;
  var fd;
  try {
    fd = fs.openSync(file, ((fs.constants && fs.constants.O_RDONLY) || 0) | nofollow);
  } catch (error) {
    return undefined;
  }
  try {
    var opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || !sameFileStats(opened, named) || Number(opened.size) > max) return undefined;
    var buffer = allocBuffer(max + 1);
    var got = 0;
    while (got < buffer.length) {
      var n = fs.readSync(fd, buffer, got, buffer.length - got, null);
      if (n === 0) break;
      got += n;
    }
    if (got > max) return undefined;
    return buffer.slice(0, got);
  } catch (error) {
    return undefined;
  } finally {
    fs.closeSync(fd);
  }
}

function realPath(file) {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    return undefined;
  }
}

// True when `inner` is `outer` or a path inside it.
function isInside(outer, inner) {
  var relative = path.relative(outer, inner);
  return relative === "" || (relative !== ".." && relative.slice(0, 3) !== ".." + path.sep && !path.isAbsolute(relative));
}

// A path that the sh wrapper can read back as one line: no control character.
function isPlainPath(file) {
  return typeof file === "string" && file !== "" && !/[\u0000-\u001f\u007f]/.test(file);
}

// The real path of the "buildos" bin file of the npm package in folder
// `dir`, when that package is build-os at exactly `version`
// (any version when `version` is null: a dev pin, W1 R7 P8 pin-first review
// round 2, finding 3); else undefined. package.json must be a regular file
// (no link), at most PACKAGE_JSON_MAX_BYTES, valid UTF-8 with no byte order
// mark, and strict JSON. The bin file must be a regular file inside the
// package (all links followed), not inside a node_modules folder below the
// package (finding 7), and readable (finding 10). This only chooses a
// candidate: the program that starts checks its own version
// (BUILDOS_REQUIRE_VERSION).
function packageEntry(dir, version) {
  var bytes = readBoundedFile(path.join(dir, "package.json"), PACKAGE_JSON_MAX_BYTES);
  if (bytes === undefined) return undefined;
  var text = bytes.toString("utf8");
  if (!toBuffer(text).equals(bytes)) return undefined;
  var manifest;
  try {
    manifest = JSON.parse(text);
  } catch (error) {
    return undefined;
  }
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) return undefined;
  if (manifest.name !== PACKAGE_NAME || typeof manifest.version !== "string") return undefined;
  if (version !== null && manifest.version !== version) return undefined;
  // An object "bin" names the buildos bin file. A string "bin" is the one
  // bin file of the package (npm links it under the package name, build-os),
  // and it counts as the buildos bin file too.
  var bin = manifest.bin;
  var relative = typeof bin === "string" ? bin : typeof bin === "object" && bin !== null && !Array.isArray(bin) && Object.prototype.hasOwnProperty.call(bin, "buildos") ? bin.buildos : undefined;
  if (typeof relative !== "string" || relative === "" || path.isAbsolute(relative) || path.win32.isAbsolute(relative)) return undefined;
  var root = realPath(dir);
  if (root === undefined) return undefined;
  var entry = realPath(path.resolve(root, relative));
  if (entry === undefined || !isInside(root, entry) || !isPlainPath(entry)) return undefined;
  var below = path.relative(root, entry).split(path.sep);
  for (var i = 0; i < below.length - 1; i++) {
    if (below[i].toLowerCase() === "node_modules") return undefined;
  }
  var stats;
  try {
    stats = fs.statSync(entry);
    fs.accessSync(entry, (fs.constants && fs.constants.R_OK) || 4);
  } catch (error) {
    return undefined;
  }
  return stats.isFile() ? entry : undefined;
}

// The folder where npm looks for the local project, as npm's own config
// does: the first folder up from `cwd` that holds a package.json file or a
// node_modules folder (links followed; a file named node_modules does not
// count, W1 R7 P8 pin-first review round 2, finding 10), else `cwd`.
function npmLocalPrefix(cwd) {
  var dir = path.resolve(cwd);
  for (;;) {
    if (isType(path.join(dir, "package.json"), "file") || isType(path.join(dir, "node_modules"), "directory")) return dir;
    var parent = path.dirname(dir);
    if (parent === dir) return path.resolve(cwd);
    dir = parent;
  }
}

function isType(file, type) {
  try {
    var stats = fs.statSync(file);
    return type === "file" ? stats.isFile() : stats.isDirectory();
  } catch (error) {
    return false;
  }
}

function packageFolder(base) {
  return path.join(base, "node_modules", "build-os");
}

// The bin file of a local npm install of the pinned package (W1 R7 P8
// pin-first review round 1, finding 1: npx would take that install as found
// and then start its bin, "build-os" since the package name of 2026-11-26,
// by name from PATH when its bin link is missing).
// As Node.js module resolution does, it looks in the node_modules folder of
// the project folder and of each folder above it, then of npm's local
// project folder and of each folder above it, and takes the first package
// that counts. So a package that npm hoisted to the root of a workspace
// counts too (pin-first final check, finding 1).
function localEntry(projectRoot, version) {
  var starts = [path.resolve(projectRoot), path.resolve(npmLocalPrefix(process.cwd()))];
  var seen = {};
  for (var i = 0; i < starts.length; i++) {
    for (var dir = starts[i]; ; dir = path.dirname(dir)) {
      if (!Object.prototype.hasOwnProperty.call(seen, dir)) {
        seen[dir] = true;
        var entry = packageEntry(packageFolder(dir), version);
        if (entry !== undefined) return entry;
      }
      if (path.dirname(dir) === dir) break;
    }
  }
  return undefined;
}

// macOS and Linux: the bin file when `candidate` (the first buildos on PATH)
// is an npm install of the pinned package: its real path is the "buildos"
// bin file of the nearest package.json above it.
function posixCandidateEntry(candidate, version) {
  var real = realPath(candidate);
  if (real === undefined) return undefined;
  var dir = path.dirname(real);
  for (;;) {
    var named;
    try {
      named = fs.lstatSync(path.join(dir, "package.json"));
    } catch (error) {
      named = undefined;
    }
    if (named !== undefined) {
      var entry = packageEntry(dir, version);
      return entry !== undefined && entry === real ? entry : undefined;
    }
    var parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

// Windows: the bin file when `candidate` (the first buildos on PATH) is an
// npm .cmd shim of the pinned package: the package is
// node_modules\build-os next to the shim (a global install),
// or, for a shim in a node_modules\.bin folder (a local install),
// build-os in that node_modules folder. The shim itself
// never runs.
function windowsCandidateEntry(candidate, version) {
  if (!/\.cmd$/i.test(candidate)) return undefined;
  var dir = path.dirname(candidate);
  var entry = packageEntry(packageFolder(dir), version);
  if (entry !== undefined) return entry;
  var parent = path.dirname(dir);
  if (path.basename(dir).toLowerCase() === ".bin" && path.basename(parent).toLowerCase() === "node_modules") return packageEntry(path.join(parent, "build-os"), version);
  return undefined;
}

// ---------------------------------------------------------------- macOS and Linux PATH search

// The first bytes of `file`, read with a bound, as Latin-1 text; "" when it cannot be read.
function fileHead(file) {
  try {
    var fd = fs.openSync(file, "r");
    try {
      var buffer = allocBuffer(WRAPPER_HEAD_BYTES);
      var n = fs.readSync(fd, buffer, 0, WRAPPER_HEAD_BYTES, 0);
      return buffer.slice(0, n).toString("binary");
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return "";
  }
}

// True when `file` is a BuildOS project wrapper of any shipped sh
// generation, which would only search PATH again: this generation (its
// second line starts with "# BuildOS project wrapper"), or the Go-era wrapper
// (it starts with these exact lines and runs the first buildos on PATH, often
// itself). Only the first WRAPPER_HEAD_BYTES bytes are read (finding 9).
function isShWrapper(file) {
  var lines = fileHead(file).split("\n");
  if (lines.length > 1 && lines[1].slice(0, 25) === "# BuildOS project wrapper") return true;
  return lines.length > 3 && lines[0] === "#!/usr/bin/env sh" && lines[1] === "set -eu" && lines[3] === 'if [ "${BUILDOS_BIN:-}" ]; then';
}

function bigStat(file) {
  try {
    return fs.statSync(file, { bigint: true });
  } catch (error) {
    return undefined;
  }
}

// The first buildos on PATH, as POSIX reads PATH (an empty entry is the
// current folder, a relative entry is relative to it), that is an executable
// file, not the wrapper `self` (by file identity, so another spelling or a
// link to it counts too), and not a project wrapper. It never starts here.
// W1 R7 P8 pin-first review round 2, finding 9: this runs only after the
// Node.js check, the manifest, and the local lookup.
function findPosixBuildos(self) {
  var value = process.env.PATH;
  if (value === undefined) return undefined;
  var me = bigStat(self);
  var dirs = value.split(":");
  for (var i = 0; i < dirs.length; i++) {
    var candidate = path.resolve(dirs[i] === "" ? "." : dirs[i], "buildos");
    var stats = bigStat(candidate);
    if (stats === undefined || !stats.isFile()) continue;
    try {
      fs.accessSync(candidate, (fs.constants && fs.constants.X_OK) || 1);
    } catch (error) {
      continue;
    }
    if (me !== undefined && sameFileStats(stats, me)) continue;
    if (isShWrapper(candidate)) continue;
    return candidate;
  }
  return undefined;
}

// ---------------------------------------------------------------- Windows PATH search and start

// True when the file is a BuildOS project wrapper of any shipped .cmd
// generation: one of its first lines starts with "rem BuildOS project wrapper".
function isCmdWrapper(file) {
  var head;
  try {
    var fd = fs.openSync(file, "r");
    try {
      var buffer = allocBuffer(1024);
      var n = fs.readSync(fd, buffer, 0, 1024, 0);
      head = buffer.slice(0, n).toString("binary");
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return false;
  }
  var lines = head.split(/\r?\n/).slice(0, 4);
  for (var i = 0; i < lines.length; i++) {
    if (/^\s*@?rem BuildOS project wrapper/i.test(lines[i])) return true;
  }
  return false;
}

function realLower(file) {
  var real = realPath(file);
  return real === undefined ? undefined : real.toLowerCase();
}

// The folders of a Windows PATH value, in order: a ; inside double quotes is
// part of the folder name, and the quotes go away (W1 R7 P8 pin-first review
// round 1, finding 5). Empty entries go away too.
function splitWindowsPath(value) {
  var dirs = [];
  var current = "";
  var quoted = false;
  for (var i = 0; i < value.length; i++) {
    var c = value.charAt(i);
    if (c === '"') quoted = !quoted;
    else if (c === ";" && !quoted) {
      dirs.push(current);
      current = "";
    } else current += c;
  }
  dirs.push(current);
  return dirs.filter(function (dir) {
    return dir !== "";
  });
}

// The first program `name` on PATH, in PATH order only (never the current
// folder), as Windows would run it (PATHEXT, limited to programs). `skip`
// says which candidates to pass over.
function findOnPath(name, skip) {
  var pathValue = process.env.PATH || process.env.Path || "";
  var allowed = [".COM", ".EXE", ".BAT", ".CMD"];
  var extensions = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(function (ext) {
    return allowed.indexOf(ext.toUpperCase()) >= 0;
  });
  var dirs = splitWindowsPath(pathValue);
  for (var d = 0; d < dirs.length; d++) {
    var dir = path.resolve(dirs[d]);
    for (var e = 0; e < extensions.length; e++) {
      var candidate = path.join(dir, name + extensions[e]);
      var stats;
      try {
        stats = fs.statSync(candidate);
      } catch (error) {
        continue;
      }
      if (!stats.isFile()) continue;
      if (skip !== undefined && skip(candidate)) continue;
      return candidate;
    }
  }
  return undefined;
}

// The first buildos program on PATH that is not a BuildOS project wrapper.
function findBuildos(self) {
  var me = realLower(self);
  return findOnPath("buildos", function (candidate) {
    if (me !== undefined && realLower(candidate) === me) return true;
    return /\.(cmd|bat)$/i.test(candidate) && isCmdWrapper(candidate);
  });
}

// Command Prompt's special characters: each is escaped with ^ in a cmd.exe line.
var CMD_META = /([()\][%!^"`<>&|;, *?])/g;

// The program path for a cmd.exe line: each special character escaped once.
function escapeCmdCommand(command) {
  return command.replace(CMD_META, "^$1");
}

// One argument for a .cmd or .bat program run by cmd.exe /d /s /c: quoted for
// the Windows argument rules, then every special character escaped with ^
// twice (once for the cmd.exe line, once for the batch file's own %* line),
// as cross-spawn does for npm's .cmd shims.
function escapeCmdArg(arg) {
  var quoted = '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1") + '"';
  return quoted.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

// The environment for the program the wrapper starts: this environment with
// REQUIRE_VERSION set to the pinned version (W1 R7 P8 pin-first review round
// 2), and none of the self-check variables a caller left behind.
function programEnvironment(version) {
  var env = {};
  for (var key in process.env) {
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    if (key.toUpperCase() === REQUIRE_VERSION || key.toUpperCase() === NPM_BIN_LINKS_OVERRIDE || key.toUpperCase().slice(0, SAVED_PREFIX.length) === SAVED_PREFIX) continue;
    env[key] = process.env[key];
  }
  env[REQUIRE_VERSION] = version;
  return env;
}

// The environment for npx: npm always makes the bin links of the package it
// installs, whatever the user's npm config says, so npx starts the bin file
// of the pinned package. The caller's own bin-links settings travel as
// SAVED_PREFIX + name, and BuildOS puts them back when it starts (finding 12).
function npxEnvironment(version) {
  var env = programEnvironment(version);
  for (var key in env) {
    if (Object.prototype.hasOwnProperty.call(env, key) && BIN_LINKS_NAME.test(key)) {
      env[SAVED_PREFIX + key] = env[key];
      delete env[key];
    }
  }
  env.npm_config_bin_links = "true";
  env[NPM_BIN_LINKS_OVERRIDE] = "1";
  return env;
}

// One argument as the npx.cmd shim passes it on in its own line: escaped once.
function escapeCmdArgOnce(arg) {
  var quoted = '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1") + '"';
  return quoted.replace(CMD_META, "^$1");
}

// True when Command Prompt cannot take the line that starts the .cmd
// `program` with `args`: the cmd.exe line, or the line that npm's npx.cmd
// shim builds from it (twice the shim's path, NPX_SHIM_RESERVE more, and the
// arguments), is longer than CMD_LINE_LIMIT (W1 R7 P8 pin-first review round
// 2, finding 11).
function cmdLineTooLong(program, args) {
  var line = '"' + [escapeCmdCommand(program)].concat(args.map(escapeCmdArg)).join(" ") + '"';
  var shim = 2 * program.length + NPX_SHIM_RESERVE + args.map(escapeCmdArgOnce).join(" ").length;
  return line.length > CMD_LINE_LIMIT || shim > CMD_LINE_LIMIT;
}

// The npx arguments for the pinned version (pin-first final check, finding
// 2): npm runs the program in this folder (--prefix), and never changes to
// an npm workspace folder above it (--workspaces=false).
function npxArguments(version, args) {
  return ["-y", "--prefix", process.cwd(), "--workspaces=false", PACKAGE_NAME + "@" + version].concat(args);
}

function longLineMessage(version) {
  return "BuildOS cannot start npx with these arguments: Windows Command Prompt takes at most 8,191 characters on one command line. Use shorter arguments, or install BuildOS in the project folder (npm install " + PACKAGE_NAME + "@" + version + "), then try again.\n";
}

// Starts `program` with `args`, this console, and `env` (else this
// environment), and exits with its exit code. A .cmd or .bat program runs
// through cmd.exe, as Windows needs; any other program starts directly.
function start(program, args, env) {
  var result;
  var options = { stdio: "inherit" };
  if (env !== undefined) options.env = env;
  if (/\.(cmd|bat)$/i.test(program)) {
    var line = [escapeCmdCommand(program)].concat(args.map(escapeCmdArg)).join(" ");
    var comspec = process.env.ComSpec || path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");
    options.windowsVerbatimArguments = true;
    result = childProcess.spawnSync(comspec, ["/d", "/v:off", "/s", "/c", '"' + line + '"'], options);
  } else {
    result = childProcess.spawnSync(program, args, options);
  }
  if (result.error) {
    process.stderr.write("BuildOS could not start " + program + ": " + result.error.message + "\n");
    process.exit(1);
  }
  if (result.status === null) {
    // W1 R7 P6 review round 4: a program ended by a signal: one plain line, and 128 plus the signal number where it is known.
    var signal = result.signal || "an unknown signal";
    var number = result.signal && os.constants && os.constants.signals ? os.constants.signals[result.signal] : undefined;
    process.stderr.write(signalMessage(program, signal));
    process.exit(typeof number === "number" ? 128 + number : 1);
  }
  process.exit(result.status);
}

// The line for a program that a signal ended.
function signalMessage(program, signal) {
  return program + " was stopped by " + signal + " before it finished.\n";
}

// ---------------------------------------------------------------- Main

function nodeIsTooOld() {
  var major = Number(String(process.versions.node).split(".")[0]);
  return !(major >= 24);
}

function nodeMessage() {
  try {
    return fs.readFileSync(path.join(__dirname, "node-required.txt"), "utf8");
  } catch (error) {
    return NODE_MESSAGE;
  }
}

// What the wrapper runs (pin first): { entry, version } for the bin file of
// an installed package that counts (local first, then `candidateEntry`,
// which finds and checks the first buildos on PATH); else { version } for
// npx; or the exit code after the plain message. A dev pin has no published
// version, so it runs only a package that counts, of any version: the
// program that starts checks its own version (finding 3). With
// `allowEntry` false, no package counts.
function decide(manifestFile, allowEntry, candidateEntry) {
  if (nodeIsTooOld()) {
    process.stderr.write(nodeMessage());
    return 127;
  }
  var manifest = readManifestFile(manifestFile);
  if (manifest === undefined) {
    process.stderr.write(NO_VERSION_MESSAGE);
    return 3;
  }
  var wanted = manifest.buildos_version === "dev" ? null : manifest.buildos_version;
  // The manifest is PROJECT/.os/manifest.json.
  var projectRoot = path.dirname(path.dirname(path.resolve(manifestFile)));
  var entry = allowEntry ? localEntry(projectRoot, wanted) : undefined;
  if (entry === undefined && allowEntry) entry = candidateEntry(wanted);
  if (entry !== undefined) return { entry: entry, version: manifest.buildos_version };
  if (manifest.buildos_version === "dev") {
    process.stderr.write(DEV_MESSAGE);
    return 3;
  }
  return { version: manifest.buildos_version };
}

function main(argv) {
  if (argv[0] === "--sh") {
    var shSelf = argv[1];
    // The sh wrapper reads the result back as lines, so this Node.js path must be one line.
    var decision = decide(argv[2], isPlainPath(process.execPath), function (version) {
      var candidate = findPosixBuildos(shSelf);
      return candidate === undefined ? undefined : posixCandidateEntry(candidate, version);
    });
    if (typeof decision === "number") process.exit(decision);
    if (decision.entry !== undefined) {
      process.stdout.write("run\n" + decision.version + "\n" + process.execPath + "\n" + decision.entry + "\n");
      return;
    }
    process.stdout.write(decision.version + "\n");
    return;
  }
  if (argv[0] === "--npx") {
    // The sh wrapper's npx start (pin-first final check, finding 5): the same
    // case-insensitive save of the caller's npm bin-links settings as on
    // Windows. NPX is the path that the sh wrapper found; VERSION is the pin.
    if (typeof argv[1] !== "string" || argv[1] === "" || typeof argv[2] !== "string" || !isExactVersion(argv[2])) {
      process.stderr.write(NO_VERSION_MESSAGE);
      process.exit(3);
    }
    start(argv[1], npxArguments(argv[2], argv.slice(3)), npxEnvironment(argv[2]));
  }
  if (argv[0] !== "--cmd") {
    process.stderr.write("usage: node pinned-version.cjs --sh SELF MANIFEST | --npx NPX VERSION ARGS... | --cmd SELF MANIFEST ARGS...\n");
    process.exit(2);
  }
  var self = argv[1];
  var manifestFile = argv[2];
  var args = argv.slice(3);
  var result = decide(manifestFile, true, function (version) {
    var found = findBuildos(self);
    return found === undefined ? undefined : windowsCandidateEntry(found, version);
  });
  if (typeof result === "number") process.exit(result);
  if (result.entry !== undefined) start(process.execPath, [result.entry].concat(args), programEnvironment(result.version));
  var npx = findOnPath("npx");
  if (npx === undefined) {
    process.stderr.write(NPX_MESSAGE);
    process.exit(127);
  }
  var npxArgs = npxArguments(result.version, args);
  if (/\.(cmd|bat)$/i.test(npx) && cmdLineTooLong(npx, npxArgs)) {
    process.stderr.write(longLineMessage(result.version));
    process.exit(2);
  }
  start(npx, npxArgs, npxEnvironment(result.version));
}

// For the shared contract tests: the same rules as src/core/init/manifest.ts, the cmd.exe escapes, and the installed package check.
module.exports = {
  parseManifest: parseManifest,
  readManifestFile: readManifestFile,
  sameFileStats: sameFileStats,
  signalMessage: signalMessage,
  isExactVersion: isExactVersion,
  isUtcTimestamp: isUtcTimestamp,
  escapeCmdCommand: escapeCmdCommand,
  escapeCmdArg: escapeCmdArg,
  splitWindowsPath: splitWindowsPath,
  packageEntry: packageEntry,
  localEntry: localEntry,
  windowsCandidateEntry: windowsCandidateEntry,
  posixCandidateEntry: posixCandidateEntry,
  npmLocalPrefix: npmLocalPrefix,
  findPosixBuildos: findPosixBuildos,
  isShWrapper: isShWrapper,
  cmdLineTooLong: cmdLineTooLong,
  programEnvironment: programEnvironment,
  npxEnvironment: npxEnvironment,
  CMD_LINE_LIMIT: CMD_LINE_LIMIT,
  NPX_MESSAGE: NPX_MESSAGE,
  DEV_MESSAGE: DEV_MESSAGE,
};

if (require.main === module) main(process.argv.slice(2));
