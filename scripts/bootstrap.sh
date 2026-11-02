#!/usr/bin/env bash
# Installs the pinned tools of one tier (docs/TOOLING.md). Idempotent: when the
# tier is already complete, the last line printed is "nothing to install".
set -euo pipefail

[ "$#" -le 1 ] || { echo "usage: bootstrap.sh [core|web|contracts|firmware|zk]" >&2; exit 1; }
readonly TIER="${1-core}"
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
readonly RISC0_RUST=1.97.0
readonly RISC0_RUST_TAG=r0.1.97.0
readonly RISC0_RUST_SHA256=100b597d605b706bec94e1d32bfaaf5851df8d75173f986d4b56a3e90916be53
readonly RISC0_HOME_DIR="${RISC0_HOME:-$HOME/.risc0}"
readonly RISC0_TOOLCHAIN_DIR="$RISC0_HOME_DIR/toolchains/v$RISC0_RUST-rust-x86_64-unknown-linux-gnu"

# Checks must never install a toolchain implicitly: only ensure_rust installs.
export RUSTUP_AUTO_INSTALL=0
# Keeps rustup and cargo errors readable in the tail that run_logged prints.
export RUST_BACKTRACE=0

installed_something=false
download_dir=""
trap '[ -z "$download_dir" ] || rm -rf "$download_dir"' EXIT

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

# Usage: ensure <description> <check function> <install function> [arguments for both]
ensure() {
  local description="$1" check="$2" install="$3"
  shift 3
  "$check" "$@" && return
  installing "$description"
  "$install" "$@"
  "$check" "$@" || fail "$description was installed, but the check '$check${*:+ $*}' still fails (is it on PATH?)"
}

toolchain_field() {
  python3 -c 'import sys, tomllib
value = tomllib.load(open(sys.argv[1], "rb"))["toolchain"][sys.argv[2]]
print(" ".join(value) if isinstance(value, list) else value)' "$REPO_ROOT/rust-toolchain.toml" "$1"
}

rust_complete() {
  local toolchain="$1" targets="$2" components="$3" target component
  rustup toolchain list | grep "^$toolchain-" >/dev/null || return 1
  for target in $targets; do
    rustup +"$toolchain" target list --installed | grep -x "$target" >/dev/null || return 1
  done
  for component in $components; do
    rustup +"$toolchain" component list --installed |
      grep -xE "$component(-x86_64-unknown-linux-gnu)?" >/dev/null || return 1
  done
}

install_rust() {
  local toolchain="$1" targets="$2" components="$3"
  run_logged rustup toolchain install "$toolchain" --profile minimal \
    --component "${components// /,}" --target "${targets// /,}" --no-self-update
}

ensure_rust() {
  command -v rustup >/dev/null || fail "rustup is missing"
  local toolchain targets components
  toolchain="$(toolchain_field channel)"
  targets="$(toolchain_field targets)"
  components="$(toolchain_field components)"
  ensure "Rust $toolchain with its targets and components" rust_complete install_rust \
    "$toolchain" "$targets" "$components"
}

crate_installed() {
  (cd "$REPO_ROOT" && cargo install --list) | grep -x "$1 v$2:" >/dev/null && command -v "$1" >/dev/null
}

install_crate() {
  (cd "$REPO_ROOT" && run_logged cargo install --locked "$1" --version "$2")
}

packages_installed() {
  local package
  for package in "$@"; do
    dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -x 'install ok installed' >/dev/null || return 1
  done
}

install_packages() {
  run_logged apt-get update -qq
  run_logged apt-get install -y -qq "$@"
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

web_dependencies_installed() {
  [ ! -f "$REPO_ROOT/web/package-lock.json" ] || npm ls --prefix "$REPO_ROOT/web" >/dev/null 2>&1
}

install_web_dependencies() {
  run_logged env PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "$REPO_ROOT/web"
}

binaryen_installed() {
  wasm-opt --version 2>/dev/null | grep "version ${BINARYEN_VERSION%%.*} " >/dev/null
}

install_binaryen() {
  run_logged npm install --global "binaryen@$BINARYEN_VERSION"
}

foundry_installed() {
  forge --version 2>/dev/null | grep -x "forge Version: ${FOUNDRY_VERSION#v}" >/dev/null
}

install_foundry() {
  download_dir="$(mktemp -d)"
  local archive="$download_dir/foundry_${FOUNDRY_VERSION}_linux_amd64.tar.gz"
  run_logged curl -fsSL -o "$archive" \
    "https://github.com/foundry-rs/foundry/releases/download/$FOUNDRY_VERSION/foundry_${FOUNDRY_VERSION}_linux_amd64.tar.gz"
  echo "$FOUNDRY_SHA256  $archive" | sha256sum -c --quiet - || fail "Foundry archive checksum mismatch"
  run_logged tar -xzf "$archive" --no-same-owner -C "$BIN_DIR" forge cast anvil chisel
}

slither_installed() {
  slither --version 2>/dev/null | grep -x "$SLITHER_VERSION" >/dev/null
}

install_slither() {
  run_logged pip install --quiet "slither-analyzer==$SLITHER_VERSION"
}

risc0_toolchain_unpacked() {
  "$RISC0_TOOLCHAIN_DIR/bin/rustc" --version 2>/dev/null | grep "^rustc $RISC0_RUST-dev " >/dev/null
}

# rzup queries api.github.com, which is refused, so the toolchain comes from its release asset
# (docs/TOOLING.md, zkVM toolchains).
install_risc0_toolchain() {
  download_dir="$(mktemp -d)"
  local archive="$download_dir/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz"
  run_logged curl -fsSL -o "$archive" \
    "https://github.com/risc0/rust/releases/download/$RISC0_RUST_TAG/rust-toolchain-x86_64-unknown-linux-gnu.tar.gz"
  echo "$RISC0_RUST_SHA256  $archive" | sha256sum -c --quiet - || fail "RISC Zero toolchain archive checksum mismatch"
  rm -rf "$RISC0_TOOLCHAIN_DIR"
  mkdir -p "$RISC0_TOOLCHAIN_DIR"
  run_logged tar -xzf "$archive" --no-same-owner -C "$RISC0_TOOLCHAIN_DIR"
}

# risc0-build finds the toolchain through rzup's settings, and `cargo +risc0` through rustup.
risc0_toolchain_registered() {
  grep -x "rust = \"$RISC0_RUST\"" "$RISC0_HOME_DIR/settings.toml" >/dev/null 2>&1 &&
    rustc +risc0 --version 2>/dev/null | grep "^rustc $RISC0_RUST-dev " >/dev/null
}

register_risc0_toolchain() {
  printf '[default_versions]\nrust = "%s"\n' "$RISC0_RUST" >"$RISC0_HOME_DIR/settings.toml"
  run_logged rustup toolchain link risc0 "$RISC0_TOOLCHAIN_DIR"
}

cxx_present() {
  command -v g++ >/dev/null || command -v c++ >/dev/null
}

case "$TIER" in
  core)
    ensure_rust
    ;;
  web)
    ensure_rust
    ensure_node
    ensure_playwright_browser
    ensure "web/ npm dependencies" web_dependencies_installed install_web_dependencies
    ;;
  contracts)
    ensure_rust
    ensure_node
    ensure "cargo-stylus $CARGO_STYLUS_VERSION (several minutes)" crate_installed install_crate \
      cargo-stylus "$CARGO_STYLUS_VERSION"
    ensure "binaryen $BINARYEN_VERSION (wasm-opt)" binaryen_installed install_binaryen
    ensure "Foundry $FOUNDRY_VERSION" foundry_installed install_foundry
    ensure "slither $SLITHER_VERSION" slither_installed install_slither
    ;;
  firmware)
    ensure_rust
    ensure "apt packages libudev-dev and pkg-config" packages_installed install_packages \
      libudev-dev pkg-config
    ensure "elf2uf2-rs $ELF2UF2_VERSION" crate_installed install_crate elf2uf2-rs "$ELF2UF2_VERSION"
    ;;
  zk)
    ensure_rust
    cxx_present || fail "a C++ compiler (g++) is missing: risc0-zkvm's prover compiles its circuit kernels with it"
    ensure "RISC Zero Rust toolchain $RISC0_RUST_TAG" risc0_toolchain_unpacked install_risc0_toolchain
    ensure "rzup settings and the risc0 rustup toolchain" risc0_toolchain_registered register_risc0_toolchain
    ;;
  *)
    fail "unknown tier '$TIER'; expected core, web, contracts, firmware or zk"
    ;;
esac

if [ "$installed_something" = true ]; then
  echo "bootstrap: tier $TIER ready"
else
  echo "nothing to install"
fi
