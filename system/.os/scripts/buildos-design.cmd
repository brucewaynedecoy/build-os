@echo off
rem BuildOS project wrapper for buildos design (Windows). It writes one
rem notice line to stderr (the name goes away in 0.3.0; PRD 20 Legacy Command
rem Names), then runs buildos.cmd in this folder, which finds BuildOS (see
rem that file).
setlocal DisableDelayedExpansion
>&2 echo Note: the command name "buildos-design" goes away in BuildOS 0.3.0. Use "buildos design" instead.
rem No call here: the arguments are passed on as given, never read twice.
"%~dp0buildos.cmd" design %*
