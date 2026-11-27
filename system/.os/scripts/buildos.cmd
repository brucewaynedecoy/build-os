@echo off
rem BuildOS project wrapper (Windows). Pin first (PRD 06): it always runs
rem the version pinned in .os\manifest.json. With Node.js 24 or newer,
rem Node.js (pinned-version.cjs) looks for an npm install of exactly that
rem version: in the project node_modules folder, or next to the first
rem buildos.cmd npm shim on PATH (PATH order only). It never starts a
rem program to learn its version. It runs the package bin file with the
rem same node; else npx -y build-os@VERSION; else one plain
rem message. Node.js starts the program itself, so no path comes back here
rem as text. Every start sets BUILDOS_REQUIRE_VERSION, and BuildOS stops
rem itself when its own version is another one.
setlocal DisableDelayedExpansion
rem A variable named ERRORLEVEL would hide the code that the last line reads.
set "ERRORLEVEL="
rem Never run a program from the current folder by its bare name.
set "NoDefaultCurrentDirectoryInExePath=1"
rem A wrapper chain that comes back here would never end: stop it instead.
rem BuildOS itself clears this variable when it starts.
if defined BUILDOS_WRAPPER_ACTIVE goto loop
set "BUILDOS_WRAPPER_ACTIVE=1"
where $PATH:node >nul 2>nul || goto node_required
rem No call here: the arguments are passed on as given, never read twice.
rem The exit code (F-P9-17): Command Prompt started as cmd /c with this file
rem and no call gives its caller the code of the last command that ran, and
rem a bare exit /b is such a command, with code 0. So exit /b names the code
rem of node, which is the code of BuildOS.
node "%~dp0pinned-version.cjs" --cmd "%~f0" "%~dp0..\manifest.json" %*
exit /b %ERRORLEVEL%

:loop
echo BuildOS stopped: its project wrappers kept calling each other. Remove the other BuildOS wrapper folders from PATH, then try again. 1>&2
exit /b 127

:node_required
type "%~dp0node-required.txt" 1>&2
exit /b 127
