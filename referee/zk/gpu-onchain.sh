#!/usr/bin/env bash
# The onchain check of M5.9's benchmark, criterion A3 (README.md, Proving on a GPU): each proof that
# gpu_bench.py's summary listed in <benchmark directory>/onchain.txt goes through the deployed
# ZkReferee with scripts/contracts/verify-proof.mjs, an eth_call of verifyRun that costs nothing,
# and must be accepted with the run score listed there; run 1's is 20310, the score it settled with.
# First, as a control, run 1's CPU proof on RISC Zero 3.1.0 (M5.10) must be accepted: if it is not, the deployed
# verifier refuses every proof, and it stops there. Then run 1's GPU proof, each input's first round
# and the segment-size sweep, so that a rate-limited RPC still checks those. It prints one line per
# proof and exits 1 when any is refused.
# It runs on any machine with Node 22, after `npm --prefix scripts/contracts ci`, on the benchmark
# directory unpacked from the archive that gpu-measure.sh made.
# Usage: bash referee/zk/gpu-onchain.sh <benchmark directory>
set -euo pipefail

[ "$#" -eq 1 ] || { echo "usage: gpu-onchain.sh <benchmark directory>" >&2; exit 2; }
[ -f "$1/onchain.txt" ] || { echo "gpu-onchain: no $1/onchain.txt: run gpu_bench.py summary on it first" >&2; exit 1; }
bench="$(cd "$1" && pwd)"
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

if ! control="$(node scripts/contracts/verify-proof.mjs --network arbitrum-sepolia --proof seasons/testnet-0/runs/run-1.risc0-3.1.proof.json \
  --run seasons/testnet-0/runs/run-1.json --season seasons/testnet-0.json 2>&1)"; then
  echo "$control"
  echo "gpu-onchain: the deployed ZkReferee refuses run 1's 3.1.0 CPU proof, so it would refuse any proof: no GPU proof checked" >&2
  echo "gpu-onchain: revert data 0xd93c0665 is EnforcedPause(), RISC Zero's emergency stop paused (docs/DEPLOYMENT.md, What forces a new generation)" >&2
  exit 1
fi

checked=0 refused=0
while read -r -u 3 id score verify_line; do
  read -ra verify_args <<<"$verify_line"
  checked=$((checked + 1))
  if output="$(node scripts/contracts/verify-proof.mjs --network arbitrum-sepolia --proof "$bench/proofs/$id.log" "${verify_args[@]}" 2>&1)" &&
    grep -q "^verifyRun accepts the proof: run score $score," <<<"$output"; then
    echo "$id: accepted, run score $score"
  else
    refused=$((refused + 1))
    echo "$id: NOT ACCEPTED with run score $score:"
    echo "$output"
  fi
done 3<"$bench/onchain.txt"
echo "gpu-onchain: $((checked - refused)) of $checked proofs accepted"
[ "$refused" -eq 0 ] || exit 1
