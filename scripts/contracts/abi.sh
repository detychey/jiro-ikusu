#!/usr/bin/env bash
# Writes contracts/abi/<Name>.json, the ABI of every contract, interface and library under
# contracts/src, so the web app never needs the contract toolchain. It builds into a fresh
# directory, so stale artifacts of deleted contracts never reach contracts/abi/.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../contracts"

build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT
forge build --skip test --out "$build_dir/out" --cache-path "$build_dir/cache"

rm -rf abi
mkdir abi
for artifact in "$build_dir"/out/*.sol/*.json; do
  read -r source name < <(jq -r '.metadata.settings.compilationTarget | to_entries[0] | "\(.key) \(.value)"' "$artifact")
  case "$source" in src/*) ;; *) continue ;; esac
  [ ! -e "abi/$name.json" ] || { echo "abi.sh: two contracts are named $name" >&2; exit 1; }
  jq '.abi' "$artifact" > "abi/$name.json"
done
ls abi
