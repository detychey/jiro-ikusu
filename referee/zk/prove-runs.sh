#!/usr/bin/env bash
# Proves each run file of a directory that has no proof yet, with zk-host, into
# <run file>.proof.json, as web/scripts/settle.mjs keeps proofs (plan M5.9). It is for the
# operator's GPU machine, which holds no key: `settle.mjs --export` writes the run files on a
# machine that reads the chain, this script proves them here, and settle.mjs settles with the
# proofs from the operator's machine (docs/SEASON_RUNBOOK.md). A proof is public data.
# zk-host must be built at the fixed path (README.md, Reproducible image ids), with
# `--features cuda` on a GPU. Each run's prover output goes to <run file>.log.
# Usage: bash referee/zk/prove-runs.sh <runs directory> <season file> [--segment-po2 <n>]
set -euo pipefail

usage() {
  echo "usage: prove-runs.sh <runs directory> <season file> [--segment-po2 <n>]" >&2
  exit 2
}

[ "$#" -eq 2 ] || [ "$#" -eq 4 ] || usage
readonly runs_dir="$1" season_file="$2"
segment=()
if [ "$#" -eq 4 ]; then
  [ "$3" = --segment-po2 ] || usage
  segment=(--segment-po2 "$4")
fi
[ -d "$runs_dir" ] || { echo "prove-runs: no directory $runs_dir" >&2; exit 1; }
[ -f "$season_file" ] || { echo "prove-runs: no season file $season_file" >&2; exit 1; }

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly host="${CARGO_TARGET_DIR:-$repo_root/referee/zk/target}/release/zk-host"
[ -x "$host" ] || { echo "prove-runs: no zk-host at $host: build it first (referee/zk/README.md)" >&2; exit 1; }

proven=0
for run_file in "$runs_dir"/run-*.json; do
  [ -e "$run_file" ] || continue
  case "$run_file" in *.proof.json) continue ;; esac
  proof_file="${run_file%.json}.proof.json"
  if [ -f "$proof_file" ]; then
    echo "prove-runs: $proof_file exists"
    continue
  fi
  echo "prove-runs: proving $run_file"
  bash "$repo_root/referee/zk/peak-memory.sh" "$host" prove --run "$run_file" --season "$season_file" "${segment[@]}" > "${run_file%.json}.log"
  # zk-host prints the proof as one line of JSON between its zk-fixture markers.
  fixture="$(sed -n '/^=== BEGIN zk-fixture ===$/{n;p;q}' "${run_file%.json}.log")"
  [ -n "$fixture" ] || { echo "prove-runs: zk-host printed no proof for $run_file; see ${run_file%.json}.log" >&2; exit 1; }
  printf '%s\n' "$fixture" > "$proof_file"
  echo "prove-runs: $proof_file"
  proven=$((proven + 1))
done
echo "prove-runs: $proven run(s) proven in $runs_dir"
