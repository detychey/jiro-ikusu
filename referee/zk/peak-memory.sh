#!/usr/bin/env bash
# Runs a command and prints its wall time and peak resident memory, sampled every 0.5 s,
# since /usr/bin/time is not installed in the container: the command's process tree, the
# processes of Docker containers (where SP1 runs the gnark wrapping prover by default), and
# the two together. A sampled peak can miss a spike shorter than the interval.
set -uo pipefail

[ "$#" -gt 0 ] || { echo "usage: peak-memory.sh <command>..." >&2; exit 2; }

rss_kib() { awk '/^VmRSS:/ { print $2 }' "/proc/$1/status" 2>/dev/null || true; }

tree_pids() {
  echo "$1"
  local child
  for child in $(cat /proc/"$1"/task/*/children 2>/dev/null); do tree_pids "$child"; done
}

docker_pids() {
  grep -l -E '/docker[/-]' /proc/[0-9]*/cgroup 2>/dev/null | cut -d/ -f3
}

sum_rss() {
  local total=0 pid kib
  for pid in "$@"; do
    kib="$(rss_kib "$pid")"
    total=$((total + ${kib:-0}))
  done
  echo "$total"
}

start=$(date +%s.%N)
"$@" &
command_pid=$!
peak_tree=0 peak_docker=0 peak_both=0
while kill -0 "$command_pid" 2>/dev/null; do
  tree=$(sum_rss $(tree_pids "$command_pid"))
  docker=$(sum_rss $(docker_pids))
  ((tree > peak_tree)) && peak_tree=$tree
  ((docker > peak_docker)) && peak_docker=$docker
  ((tree + docker > peak_both)) && peak_both=$((tree + docker))
  sleep 0.5
done
wait "$command_pid"
status=$?
end=$(date +%s.%N)

echo "=== BEGIN peak-memory ==="
echo "command: $*"
echo "exit status: $status"
awk -v start="$start" -v end="$end" 'BEGIN { printf "wall time: %.1f s\n", end - start }'
echo "peak RSS, command tree: $((peak_tree / 1024)) MiB"
echo "peak RSS, Docker containers: $((peak_docker / 1024)) MiB"
echo "peak RSS, both: $((peak_both / 1024)) MiB"
echo "=== END peak-memory ==="
exit "$status"
