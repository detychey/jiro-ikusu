#!/usr/bin/env bash
# Builds the Stylus referee (README §7.3, plan M4.1), jiro-referee-stylus, and checks it against
# Arbitrum's contract size limit: 24 KB brotli, 128 KB uncompressed.
#
# The output bytes depend on the rustc build, the wasm-opt release and the paths embedded in
# the module, so all three are pinned, as ethblockdigger's referee/build-wasm.sh does: rustc by
# rust-toolchain.toml, wasm-opt by the npm binaryen version below, and $CARGO_HOME and the
# repository root remapped to fixed prefixes, so two builds in any checkout give the same
# sha256. Dependencies come from Cargo.lock (--locked).
#
# Requires: rustup, node and npm.
# Usage: referee/build-wasm.sh; the module is $CARGO_TARGET_DIR (default target/)
# /jiro_referee_stylus.opt.wasm. Deploy with: cargo stylus deploy --wasm-file <that file>.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

channel="$(sed -n 's/^channel = "\(.*\)"$/\1/p' rust-toolchain.toml)"
if [[ "$(rustc --version)" != "rustc $channel "* ]]; then
  echo "build-wasm: need rustc $channel (rust-toolchain.toml), got: $(rustc --version)" >&2
  exit 1
fi
wasm_opt=(npm exec --yes --package=binaryen@120.0.0 -- wasm-opt)
echo "$(rustc --version); $("${wasm_opt[@]}" --version)"

# CARGO_ENCODED_RUSTFLAGS separates flags with 0x1f, so paths with spaces stay whole.
unset RUSTFLAGS
export CARGO_ENCODED_RUSTFLAGS="--remap-path-prefix=${CARGO_HOME:-$HOME/.cargo}=/cargo"$'\x1f'"--remap-path-prefix=$repo_root=/jiro"
cargo build -p jiro-referee-stylus --profile stylus --locked --target wasm32-unknown-unknown

target="${CARGO_TARGET_DIR:-$repo_root/target}"
raw="$target/wasm32-unknown-unknown/stylus/jiro_referee_stylus.wasm"
opt="$target/jiro_referee_stylus.opt.wasm"
[[ -f "$raw" ]] || { echo "build-wasm: $raw is missing after the build" >&2; exit 1; }
"${wasm_opt[@]}" -Oz \
  --enable-bulk-memory --enable-sign-ext \
  --enable-mutable-globals --enable-nontrapping-float-to-int \
  "$raw" -o "$opt"

node - "$opt" <<'JS'
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const wasm = fs.readFileSync(process.argv[2]);
const brotli = zlib.brotliCompressSync(wasm, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
const [rawLimit, brotliLimit] = [128 * 1024, 24 * 1024];
const sha = crypto.createHash("sha256").update(wasm).digest("hex");
console.log(`jiro-referee-stylus: ${wasm.length} bytes raw (limit ${rawLimit}), ${brotli.length} bytes brotli (limit ${brotliLimit}), sha256 ${sha}`);
if (wasm.length > rawLimit) {
  console.error("build-wasm: over the 128 KB uncompressed limit");
  process.exit(1);
}
if (brotli.length > brotliLimit) {
  console.error("build-wasm: over the 24 KB brotli limit");
  process.exit(1);
}
JS
