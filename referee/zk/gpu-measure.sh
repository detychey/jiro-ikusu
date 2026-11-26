#!/usr/bin/env bash
# M5.9's benchmark on a GPU machine, rented or owned (plan M5.9, README.md, Proving on a GPU). It
# checks the machine, builds zk-host with the cuda feature, then proves a ladder of six committed
# run-mode inputs, of 7 to about 177 segments, three times each in another order per round; then
# run 1 and the heaviest at the segment sizes on either side of the ladder's; first and last, the
# smallest input again, cold and as a sentinel. Each proof runs under peak-memory.sh, with the
# card's telemetry sampled every second, into <out>/proofs/<id>.log (stdout, one proof that
# scripts/contracts/verify-proof.mjs reads), .err (stderr) and .gpu.csv. gpu_bench.py records each
# proof as a line of <out>/results.jsonl, and its summary fits the time against the segments,
# prices a run and checks the acceptance criteria into <out>/summary.md. A failed proof is recorded
# and the others go on; a wrong image id stops it before any proof; a proof that fails a check, or
# any criterion that fails, makes it exit 1 at the end. Run 1's and the heaviest run's first proofs
# also go to gpu-run-1.log and gpu-heaviest.log at the repository's root, each after the machine.
# Run again, it skips the proofs already recorded in <out>, unless --redo names their input. It holds
# no key and sends nothing: it ends by naming the archive of <out> to download, whose proofs
# referee/zk/gpu-onchain.sh checks onchain from any machine.
# It runs from a checkout at /home/runner/work/jiro-ikusu/jiro-ikusu, not reached through a
# symbolic link, since the image id depends on the path (README.md, Reproducible image ids), on
# x86-64 Linux with an NVIDIA card, its driver, the CUDA toolkit, g++, curl, Python 3.11 or newer
# and RISC Zero's Groth16 setup files, rzup's component risc0-groth16 0.1.0. It installs rustup
# when it is missing, then the zk tier of scripts/bootstrap.sh.
# Usage: bash referee/zk/gpu-measure.sh [--segment-po2 <n>] [--rounds <n>] [--out <dir>]
#                                       [--redo <input>]... [--price-usd-per-hour <p>]
set -euo pipefail

readonly FIXED_PATH=/home/runner/work/jiro-ikusu/jiro-ikusu
readonly USAGE="usage: gpu-measure.sh [--segment-po2 <n>] [--rounds <n>] [--out <dir>] [--redo <input>]... [--price-usd-per-hour <p>]"
readonly GROTH16_DIR="${RISC0_HOME:-$HOME/.risc0}/extensions/v0.1.0-risc0-groth16"
readonly GROTH16_FILES=(stark_verify_final.zkey stark_verify_graph.bin preprocessed_coeffs.bin fuzzed_msm_results.bin)
readonly GPU_FIELDS=name,uuid,memory.total,driver_version,vbios_version,compute_cap,power.limit,power.default_limit,power.max_limit,clocks.max.sm,clocks.max.mem,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max,persistence_mode
readonly IDLE_GPU_MIB=1024

fail() {
  echo "gpu-measure: $*" >&2
  exit 1
}

po2=20 rounds=3 out=gpu-bench
redo=() price=()
while [ "$#" -gt 0 ]; do
  [ "$#" -ge 2 ] || fail "$USAGE"
  case "$1" in
    --segment-po2) po2="$2" ;;
    --rounds) rounds="$2" ;;
    --out) out="$2" ;;
    --redo) redo+=(--redo "$2") ;;
    --price-usd-per-hour)
      [[ "$2" =~ ^[0-9]+([.][0-9]+)?$ ]] || fail "--price-usd-per-hour $2: not a price"
      price=(--price-usd-per-hour "$2")
      ;;
    *) fail "$USAGE" ;;
  esac
  shift 2
done
out="$(mkdir -p "$out" && cd "$out" && pwd)"

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
# Cargo builds from the physical path, so a symbolic link on the way gives another image id.
[ "$(pwd -P)" = "$FIXED_PATH" ] || fail "run it from a checkout at $FIXED_PATH, not $(pwd -P): another path gives another image id"
[ "$(uname -m)" = x86_64 ] || fail "x86-64 only, not $(uname -m)"
command -v nvidia-smi >/dev/null || fail "nvidia-smi is missing: no NVIDIA driver"
command -v nvcc >/dev/null || fail "nvcc is missing: install the CUDA toolkit"
command -v g++ >/dev/null || command -v c++ >/dev/null || fail "a C++ compiler (g++) is missing"
command -v curl >/dev/null || fail "curl is missing"
python3 -c 'import tomllib' 2>/dev/null || fail "Python 3.11 or newer is missing: scripts/bootstrap.sh reads rust-toolchain.toml with it"
# Before the build, so that a wrong option fails in seconds.
python3 referee/zk/gpu_bench.py plan "$out" --segment-po2 "$po2" --rounds "$rounds" "${redo[@]}" >/dev/null
# With the cuda feature, the Groth16 step reads these files instead of running Docker.
for file in "${GROTH16_FILES[@]}"; do
  [ -s "$GROTH16_DIR/$file" ] || fail "$GROTH16_DIR/$file is missing: install rzup's risc0-groth16 0.1.0 component (referee/zk/README.md, Proving on a GPU)"
done
reasons=clocks_event_reasons.active
nvidia-smi --query-gpu="$reasons" --format=csv,noheader >/dev/null 2>&1 || reasons=clocks_throttle_reasons.active
readonly TELEMETRY="timestamp,clocks.sm,temperature.gpu,power.draw,utilization.gpu,memory.used,$reasons"
nvidia-smi --query-gpu="$TELEMETRY" --format=csv,noheader,nounits -i 0 >/dev/null || fail "nvidia-smi does not report $TELEMETRY"
in_use_mib="$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits -i 0)"
[ "${in_use_mib// /}" -lt "$IDLE_GPU_MIB" ] || fail "the card has $in_use_mib MiB in use: stop what runs on it, such as a zk-host left by Ctrl-C"
gpu_uuid="$(nvidia-smi --query-gpu=uuid --format=csv,noheader -i 0)"
if [ -f "$out/machine-s1.txt" ]; then
  first_uuid="$(sed -n 's/^gpu uuid: //p' "$out/machine-s1.txt")"
  [ "$first_uuid" = "$gpu_uuid" ] || fail "$out holds the proofs of card $first_uuid, not $gpu_uuid: give each card its own --out"
fi
mkdir -p "$out/proofs" "$out/previous"
# The logs of an earlier run hold its build time, which a build that has nothing left to do lacks.
for log in gpu-run-1.log gpu-heaviest.log; do
  [ ! -f "$log" ] || cp "$log" "$out/previous/$(date -u +%Y%m%dT%H%M%SZ)-$log"
done

build_start=$SECONDS
if ! command -v rustup >/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
fi
bash scripts/bootstrap.sh zk
cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host --features cuda
readonly host="${CARGO_TARGET_DIR:-referee/zk/target}/release/zk-host"
readonly build_seconds=$((SECONDS - build_start))

session=$(($(find "$out" -maxdepth 1 -name 'machine-s*.txt' | wc -l) + 1))
readonly machine="$out/machine-s$session.txt"
expected_image_id="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["imageId"])' seasons/testnet-0/runs/run-1.proof.json)"
image_id="$("$host" image-id)"
{
  echo "=== BEGIN gpu-measure ==="
  echo "session: $session"
  echo "utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "commit: $(git rev-parse HEAD)"
  echo "tracked files changed: $(git status --porcelain --untracked-files=no | wc -l)"
  echo "image id: $image_id"
  echo "expected image id: $expected_image_id"
  echo "zk-host sha256: $(sha256sum "$host" | cut -d' ' -f1)"
  echo "risc0-zkvm: $(awk '/^name = "risc0-zkvm"$/ { getline; gsub(/"/, "", $3); print $3 }' referee/zk/Cargo.lock)"
  echo "rustc: $(rustc --version)"
  echo "rustc +risc0: $(rustc +risc0 --version)"
  echo "nvcc: $(nvcc --version | grep release)"
  echo "driver's CUDA: $(nvidia-smi | grep -o 'CUDA Version: [0-9.]*' | cut -d' ' -f3)"
  echo "cards: $(nvidia-smi --query-gpu=uuid --format=csv,noheader | wc -l), the first measured"
  nvidia-smi --query-gpu="$GPU_FIELDS" --format=csv,noheader,nounits -i 0 |
    awk -F', ' -v fields="$GPU_FIELDS" '{ n = split(fields, name, ","); for (i = 1; i <= n; i++) print "gpu " name[i] ": " $i }'
  echo "cpu: $(awk -F': ' '/^model name/ { print $2; exit }' /proc/cpuinfo)"
  echo "cpus: $(nproc)"
  echo "cgroup cpu.max: $(cat /sys/fs/cgroup/cpu.max 2>/dev/null || echo none)"
  echo "memory: $(awk '/^MemTotal:/ { print $2 }' /proc/meminfo) kB"
  echo "cgroup memory.max: $(cat /sys/fs/cgroup/memory.max 2>/dev/null || echo none)"
  echo "free disk for $out: $(df -h --output=avail "$out" | tail -n 1)"
  echo "kernel: $(uname -r)"
  echo "os: $(sed -n 's/^PRETTY_NAME=//p' /etc/os-release | tr -d '"')"
  # Never the whole environment: RunPod may keep an API key there.
  echo "runpod pod: ${RUNPOD_POD_ID:-none}"
  echo "set-up and build: $build_seconds s"
  echo "ladder: 2^$po2, $rounds rounds"
  echo "=== END gpu-measure ==="
} | tee "$machine"
[ "$image_id" = "$expected_image_id" ] ||
  fail "image id $image_id, not the deployed ZkReferee's $expected_image_id: no proof made. Check pwd -P, rustc +risc0 --version and the commit"

plan="$(python3 referee/zk/gpu_bench.py plan "$out" --segment-po2 "$po2" --rounds "$rounds" "${redo[@]}")"
proofs=()
[ -z "$plan" ] || mapfile -t proofs <<<"$plan"
ids=("${proofs[@]%% *}")
sampler=""
trap '[ -z "$sampler" ] || kill "$sampler" 2>/dev/null' EXIT
for i in "${!proofs[@]}"; do
  read -r id prove_line <<<"${proofs[i]}"
  read -ra prove_args <<<"$prove_line"
  echo "gpu-measure: proof $((i + 1)) of ${#proofs[@]}, $id"
  nvidia-smi --query-gpu="$TELEMETRY" --format=csv,noheader,nounits -i 0 -lms 1000 >"$out/proofs/$id.gpu.csv" &
  sampler=$!
  status=0
  bash referee/zk/peak-memory.sh "$host" prove "${prove_args[@]}" >"$out/proofs/$id.log" 2>"$out/proofs/$id.err" || status=$?
  # The sampler runs until this kill; one that stopped early leaves too few samples, which A5 reports.
  kill "$sampler" 2>/dev/null || true
  wait "$sampler" || true
  sampler=""
  python3 referee/zk/gpu_bench.py record "$out" "$id" "$status" --left "${ids[@]:i+1}"
  case "$id" in
    "run1-p$po2-r1") cat "$machine" "$out/proofs/$id.log" >gpu-run-1.log ;;
    "heaviest-p$po2-r1") cat "$machine" "$out/proofs/$id.log" >gpu-heaviest.log ;;
  esac
done

summary_status=0
python3 referee/zk/gpu_bench.py summary "$out" --segment-po2 "$po2" "${price[@]}" || summary_status=$?
archive="$(dirname "$out")/gpu-bench-$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short=7 HEAD).tar.gz"
tar -czf "$archive" -C "$(dirname "$out")" "$(basename "$out")"
echo "gpu-measure: download $archive and attach it to the M5.9 pull request; then, from any machine, bash referee/zk/gpu-onchain.sh <its directory>"
[ "$summary_status" -eq 0 ] || echo "gpu-measure: an acceptance criterion failed: see the summary above" >&2
exit "$summary_status"
