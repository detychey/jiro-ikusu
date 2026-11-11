#!/usr/bin/env bash
# M5.9's measurement on a GPU machine, rented or owned (plan M5.9). It builds zk-host with the
# cuda feature, prints the card and the image id, then proves testnet-0's settled run 1 and the
# gate set's heaviest run under peak-memory.sh, into gpu-run-1.log and gpu-heaviest.log at the
# repository's root. It holds no key and sends nothing: verify the proofs from any machine with
# scripts/contracts/verify-proof.mjs (README.md, Proving on a GPU).
# It runs from a checkout at /home/runner/work/jiro-ikusu/jiro-ikusu, since the image id depends on
# the path (README.md, Reproducible image ids), on x86-64 Linux with an NVIDIA card, its driver and
# the CUDA toolkit. It installs rustup when it is missing, then the zk tier of scripts/bootstrap.sh.
# Usage: bash referee/zk/gpu-measure.sh [--segment-po2 <n>]
set -euo pipefail

readonly FIXED_PATH=/home/runner/work/jiro-ikusu/jiro-ikusu
readonly HEAVIEST=(
  vectors/levels/10-worst.json vectors/levels/16-worst.json vectors/levels/04-worst.json
  vectors/levels/08-worst.json vectors/levels/03-worst.json vectors/levels/14-synthetic.json
)

fail() {
  echo "gpu-measure: $*" >&2
  exit 1
}

segment=()
case "$#" in
  0) ;;
  2) [ "$1" = --segment-po2 ] || fail "usage: gpu-measure.sh [--segment-po2 <n>]"; segment=(--segment-po2 "$2") ;;
  *) fail "usage: gpu-measure.sh [--segment-po2 <n>]" ;;
esac

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
[ "$PWD" = "$FIXED_PATH" ] || fail "run it from a checkout at $FIXED_PATH, not $PWD: another path gives another image id"
[ "$(uname -m)" = x86_64 ] || fail "x86-64 only, not $(uname -m)"
command -v nvidia-smi >/dev/null || fail "nvidia-smi is missing: no NVIDIA driver"
command -v nvcc >/dev/null || fail "nvcc is missing: install the CUDA toolkit"
command -v g++ >/dev/null || command -v c++ >/dev/null || fail "a C++ compiler (g++) is missing"

if ! command -v rustup >/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
fi
bash scripts/bootstrap.sh zk
cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host --features cuda
readonly host=referee/zk/target/release/zk-host

echo "=== BEGIN gpu-measure ==="
echo "commit: $(git rev-parse HEAD)"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
nvcc --version | tail -n 1
echo "image id: $("$host" image-id)"
echo "=== END gpu-measure ==="

bash referee/zk/peak-memory.sh "$host" prove --run seasons/testnet-0/runs/run-1.json --season seasons/testnet-0.json "${segment[@]}" > gpu-run-1.log
bash referee/zk/peak-memory.sh "$host" prove --run "${HEAVIEST[@]}" "${segment[@]}" > gpu-heaviest.log
for log in gpu-run-1.log gpu-heaviest.log; do
  echo "--- $log"
  sed -n '/^=== BEGIN zk-prove ===$/,/^=== END zk-prove ===$/p; /^=== BEGIN peak-memory ===$/,/^=== END peak-memory ===$/p' "$log"
done
echo "gpu-measure: attach gpu-run-1.log and gpu-heaviest.log to the M5.9 pull request"
