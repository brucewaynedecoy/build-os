set shell := ["bash", "-uc"]

default:
    @just --list

install-toolkits:
    #!/usr/bin/env bash
    set -euo pipefail
    bin_dir="${BUILDOS_INSTALL_BIN_DIR:-$HOME/.local/bin}"
    case ":$PATH:" in
      *":$bin_dir:"*) ;;
      *)
        printf 'error: %s is not on PATH\n' "$bin_dir" >&2
        printf 'set BUILDOS_INSTALL_BIN_DIR to a PATH directory or add %s to PATH before installing\n' "$bin_dir" >&2
        exit 1
        ;;
    esac
    mkdir -p "$bin_dir"
    for toolkit in buildos-intake buildos-discovery buildos-design; do
      (cd "toolkits/$toolkit" && go build -o "$bin_dir/$toolkit" "./cmd/$toolkit")
      chmod 0755 "$bin_dir/$toolkit"
    done
    for toolkit in buildos-intake buildos-discovery buildos-design; do
      resolved="$(command -v "$toolkit" || true)"
      expected="$bin_dir/$toolkit"
      if [ "$resolved" != "$expected" ]; then
        printf 'error: %s resolves to %s, expected %s\n' "$toolkit" "${resolved:-<not found>}" "$expected" >&2
        exit 1
      fi
      printf '%s -> %s\n' "$toolkit" "$resolved"
    done

check-toolkits:
    #!/usr/bin/env bash
    set -euo pipefail
    for toolkit in buildos-intake buildos-discovery buildos-design; do
      command -v "$toolkit"
      "$toolkit" help >/dev/null
    done

uninstall-toolkits:
    #!/usr/bin/env bash
    set -euo pipefail
    bin_dir="${BUILDOS_INSTALL_BIN_DIR:-$HOME/.local/bin}"
    for toolkit in buildos-intake buildos-discovery buildos-design; do
      rm -f "$bin_dir/$toolkit"
      printf 'removed %s\n' "$bin_dir/$toolkit"
    done
