set shell := ["bash", "-uc"]

# BuildOS is one npm package, @brucewaynedecoy/buildos, in toolkits/buildos/
# (Node.js 24 or newer). W1 R7 P8 replaced the Go recipes with npm ones of the
# same names. Every install runs with install scripts off (PRD 20 Supply Chain).

default:
    @just --list

# Shared by every BuildOS recipe (W1 R7 P8 review round 1, P8-R1-09): checks
# the dependency policy, installs the pinned dev dependencies with install
# scripts off when node_modules is missing or older than package-lock.json
# (a stamp holds the lockfile SHA-256), and checks the installed manifests.
[private]
buildos-deps:
    #!/usr/bin/env bash
    set -euo pipefail
    cd toolkits/buildos
    node scripts/check-dependencies.ts
    want="$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync("package-lock.json")).digest("hex"))')"
    have="$(cat node_modules/.buildos-lock-sha256 2>/dev/null || true)"
    if [ "$want" != "$have" ]; then
      npm ci --ignore-scripts
      printf '%s' "$want" > node_modules/.buildos-lock-sha256
    fi
    node scripts/check-dependencies.ts --installed

# Installs the pinned dev dependencies (install scripts off) and builds dist/.
build-buildos: buildos-deps
    #!/usr/bin/env bash
    set -euo pipefail
    cd toolkits/buildos
    npm run build
    node dist/buildos.js version

# Typecheck and the whole test suite (unit, golden parity, conversion eval).
test-buildos: buildos-deps
    #!/usr/bin/env bash
    set -euo pipefail
    cd toolkits/buildos
    npm run typecheck
    npm test

# Packs the package and installs the tarball globally with npm (buildos and the three legacy names).
install-toolkits: buildos-deps
    #!/usr/bin/env bash
    set -euo pipefail
    out="$(mktemp -d "${TMPDIR:-/tmp}/buildos-install.XXXXXX")"
    (cd toolkits/buildos && npm run build >/dev/null && npm pack --ignore-scripts --pack-destination "$out" >/dev/null)
    tarball="$(ls "$out"/*.tgz)"
    npm install --global --ignore-scripts "$tarball"
    rm -rf "$out"
    for name in buildos buildos-intake buildos-discovery buildos-design; do
      printf '%s -> %s\n' "$name" "$(command -v "$name" || echo '<not found>')"
    done

# Checks that the installed buildos and the three legacy names run.
check-toolkits:
    #!/usr/bin/env bash
    set -euo pipefail
    buildos version
    for name in buildos-intake buildos-discovery buildos-design; do
      command -v "$name"
      "$name" help >/dev/null 2>&1
    done

# Removes the globally installed BuildOS package: npm removes buildos and the three legacy names with it.
uninstall-toolkits:
    npm uninstall --global @brucewaynedecoy/buildos

# Release dry run: every release gate, never staging (scripts/release-dry-run.ts; --plant <gate>).
release-dry-run *args: buildos-deps
    cd toolkits/buildos && node scripts/release-dry-run.ts {{args}}
