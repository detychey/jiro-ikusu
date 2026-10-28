#!/usr/bin/env bash
# Installs the pinned tools of one tier (docs/TOOLING.md). Idempotent: when the
# tier is already complete, the last line printed is "nothing to install".
set -euo pipefail

readonly TIER="${1:-core}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
readonly BIN_DIR=/usr/local/bin

readonly CARGO_STYLUS_VERSION=0.10.10
readonly ELF2UF2_VERSION=2.2.0
readonly BINARYEN_VERSION=120.0.0
readonly SLITHER_VERSION=0.11.6
readonly FOUNDRY_VERSION=v1.8.6
readonly FOUNDRY_SHA256=58850106984038f3a7200f38a4182c8cb423d3a4f4c7848eacbc2453e6bc35fc
readonly NODE_MAJOR=22
readonly PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium-1243

# Checks must never install a toolchain implicitly: only ensure_rust installs.
export RUSTUP_AUTO_INSTALL=0

installed_something=false

fail() {
  echo "bootstrap: $*" >&2
  exit 1
}

installing() {
  installed_something=true
  echo "bootstrap: installing $*"
}

run_logged() {
  local log
  log="$(mktemp)"
  if ! "$@" >"$log" 2>&1; then
    tail -n 30 "$log" >&2
    rm -f "$log"
    fail "command failed: $*"
  fi
  rm -f "$log"
}

toolchain_field() {
  python3 -c 'import sys, tomllib
value = tomllib.load(open(sys.argv[1], "rb"))["toolchain"][sys.argv[2]]
print(" ".join(value) if isinstance(value, list) else value)' "$REPO_ROOT/rust-toolchain.toml" "$1"
}

ensure_rust() {
  command -v rustup >/dev/null || fail "rustup is missing"
  local toolchain
  toolchain="$(toolchain_field channel)"

  local missing=()
  if ! rustup toolchain list | grep -q "^$toolchain-"; then
    missing+=("toolchain $toolchain")
  else
    local target component
    for target in $(toolchain_field targets); do
      rustup +"$toolchain" target list --installed | grep -qx "$target" || missing+=("target $target")
    done
    for component in $(toolchain_field components); do
      rustup +"$toolchain" component list --installed | grep -q "^$component-" || missing+=("component $component")
    done
  fi
  [ "${#missing[@]}" -eq 0 ] && return

  installing "Rust ${missing[*]}"
  local components targets
  components="$(toolchain_field components | tr " " ,)"
  targets="$(toolchain_field targets | tr " " ,)"
  run_logged rustup toolchain install "$toolchain" --profile minimal \
    --component "$components" --target "$targets" --no-self-update
}

cargo_install() {
  local crate="$1" version="$2"
  (cd "$REPO_ROOT" && cargo install --list) | grep -qx "$crate v$version:" && return
  installing "$crate $version (cargo install, several minutes for cargo-stylus)"
  (cd "$REPO_ROOT" && run_logged cargo install --locked "$crate" --version "$version")
}

ensure_apt_packages() {
  local missing=() package
  for package in "$@"; do
    dpkg -s "$package" >/dev/null 2>&1 || missing+=("$package")
  done
  [ "${#missing[@]}" -eq 0 ] && return
  installing "apt packages ${missing[*]}"
  run_logged apt-get update -qq
  run_logged apt-get install -y -qq "${missing[@]}"
}

ensure_node() {
  command -v node >/dev/null || fail "node is missing; Node $NODE_MAJOR is required"
  [ "$(node -p 'process.versions.node.split(".")[0]')" = "$NODE_MAJOR" ] ||
    fail "Node $NODE_MAJOR is required, found $(node --version)"
}

ensure_playwright_browser() {
  [ -d "$PLAYWRIGHT_CHROMIUM" ] ||
    fail "the preinstalled Chromium $PLAYWRIGHT_CHROMIUM is missing; see docs/TOOLING.md, Playwright"
}

ensure_web_dependencies() {
  [ -f "$REPO_ROOT/web/package-lock.json" ] || return 0
  [ -d "$REPO_ROOT/web/node_modules" ] && return
  installing "web/ npm dependencies"
  run_logged env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "$REPO_ROOT/web"
}

ensure_binaryen() {
  wasm-opt --version 2>/dev/null | grep -q "version ${BINARYEN_VERSION%%.*} " && return
  installing "binaryen $BINARYEN_VERSION (wasm-opt)"
  run_logged npm install --global "binaryen@$BINARYEN_VERSION"
}

ensure_foundry() {
  forge --version 2>/dev/null | grep -q "Version: ${FOUNDRY_VERSION#v}" && return
  installing "Foundry $FOUNDRY_VERSION"
  local download archive
  download="$(mktemp -d)"
  archive="$download/foundry_${FOUNDRY_VERSION}_linux_amd64.tar.gz"
  run_logged curl -fsSL -o "$archive" \
    "https://github.com/foundry-rs/foundry/releases/download/$FOUNDRY_VERSION/foundry_${FOUNDRY_VERSION}_linux_amd64.tar.gz"
  echo "$FOUNDRY_SHA256  $archive" | sha256sum -c --quiet - || fail "Foundry archive checksum mismatch"
  tar -xzf "$archive" --no-same-owner -C "$BIN_DIR" forge cast anvil chisel
  rm -rf "$download"
}

ensure_slither() {
  slither --version 2>/dev/null | grep -qx "$SLITHER_VERSION" && return
  installing "slither $SLITHER_VERSION"
  run_logged pip install --quiet "slither-analyzer==$SLITHER_VERSION"
}

case "$TIER" in
  core)
    ensure_rust
    ;;
  web)
    ensure_rust
    ensure_node
    ensure_playwright_browser
    ensure_web_dependencies
    ;;
  contracts)
    ensure_rust
    ensure_node
    cargo_install cargo-stylus "$CARGO_STYLUS_VERSION"
    ensure_binaryen
    ensure_foundry
    ensure_slither
    ;;
  firmware)
    ensure_rust
    ensure_apt_packages libudev-dev pkg-config
    cargo_install elf2uf2-rs "$ELF2UF2_VERSION"
    ;;
  *)
    fail "unknown tier '$TIER'; expected core, web, contracts or firmware"
    ;;
esac

if [ "$installed_something" = true ]; then
  echo "bootstrap: tier $TIER ready"
else
  echo "nothing to install"
fi
