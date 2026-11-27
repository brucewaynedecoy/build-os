# W1 R7 P9, A80 (review round 1 of pull request 7, finding 1): the no-Python
# smoke inside a Linux container image that has Node 24 and no Python at all.
# The no-python-image job of .github/workflows/buildos-ci.yml runs it with
# `sh -eu` inside the official node:24-slim image, pulled by digest, with only
# the repository checkout mounted (the digest is recorded in SECURITY.md).
#
# It does what the no-python job does on the three hosted systems, with the
# image's own PATH: the dependency guards, an install with install scripts
# off, the no-Python check, a build, a pack, a new project with the tarball
# installed, scripts/no-python-smoke.ts, and the skill-script parity test.
# The smoke also searches the whole container filesystem (all but the
# checkout, /proc, /sys, and /dev) for a py, python*, pypy*, or libpython*
# name, so the run fails if the image has Python anywhere, not only on PATH.
#
# The image has no git. Nothing here needs it: the checkout is made on the
# runner, and test/capture-sources.test.ts (which needs git and the full
# history) runs in the test job, not here. Nothing installs Python.
#
# Run from toolkits/buildos/ of the checkout. The current folder is the only
# input; every other folder is a new temporary one.

set -eu

checkout=$(cd ../.. && pwd)
temp=$(mktemp -d)

node --version
npm --version
node scripts/check-dependencies.ts
npm ci --ignore-scripts --no-audit --no-fund
node scripts/check-dependencies.ts --installed
node scripts/check-no-python.ts
npm run build

# The tarball name comes from npm pack --json, never from a glob.
tarball=$(npm pack --pack-destination "$temp" --json | node -e 'let s="";process.stdin.on("data",(d)=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].filename))')
mkdir "$temp/project"
node dist/buildos.js init --root "$temp/project" --skip-make-docs
npm install --offline --ignore-scripts --no-save --no-audit --no-fund --prefix "$temp/project" "$temp/$tarball"

node scripts/no-python-smoke.ts --project "$temp/project" --work "$temp/no-python-work" --filesystem / --skip "$checkout"
node --test --test-reporter=spec test/skill-script-parity.test.ts
