#!/usr/bin/env bash
# Builds jiro-wasm (README §3) for wasm32-unknown-unknown, and prints its size and sha256.
#
# The output bytes depend on the rustc build and on the paths embedded in the module, so the
# rustc release is pinned by rust-toolchain.toml, and $CARGO_HOME and the repository root are
# remapped to fixed prefixes, as ethblockdigger's referee/build-wasm.sh does: two builds, in any
# checkout, give the same sha256. No post-processing (wasm-opt) runs.
#
# Usage: web/wasm/build-wasm.sh; the module is $CARGO_TARGET_DIR (default target/)
# wasm32-unknown-unknown/release/jiro_wasm.wasm.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

channel="$(sed -n 's/^channel = "\(.*\)"$/\1/p' rust-toolchain.toml)"
if [[ "$(rustc --version)" != "rustc $channel "* ]]; then
  echo "build-wasm: need rustc $channel (rust-toolchain.toml), got: $(rustc --version)" >&2
  exit 1
fi

# CARGO_ENCODED_RUSTFLAGS separates flags with 0x1f, so paths with spaces stay whole.
unset RUSTFLAGS
export CARGO_ENCODED_RUSTFLAGS="--remap-path-prefix=${CARGO_HOME:-$HOME/.cargo}=/cargo"$'\x1f'"--remap-path-prefix=$repo_root=/jiro"
cargo build -p jiro-wasm --release --locked --target wasm32-unknown-unknown

wasm="${CARGO_TARGET_DIR:-$repo_root/target}/wasm32-unknown-unknown/release/jiro_wasm.wasm"
[[ -f "$wasm" ]] || { echo "build-wasm: $wasm is missing after the build" >&2; exit 1; }
size="$(wc -c <"$wasm")"
sha="$(sha256sum "$wasm" | cut -d' ' -f1)"
echo "jiro-wasm: $size bytes, sha256 $sha"
