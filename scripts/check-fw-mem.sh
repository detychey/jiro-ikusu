#!/usr/bin/env bash
# Static memory gate of a firmware ELF (plan M3.1). Prints its .text, .data and .bss sizes, and
# fails unless .data + .bss is at most 64 KiB and the linker map the build writes next to the
# ELF (<elf>.map, from firmware/app/build.rs) has no __rust_alloc symbol, the mark of a global
# allocator. Usage: check-fw-mem.sh <elf>
set -euo pipefail

[ "$#" -eq 1 ] || { echo "usage: check-fw-mem.sh <elf>" >&2; exit 2; }
readonly LIMIT=65536
elf="$(realpath "$1")"
map="$elf.map"
name="$(basename "$elf")"
[ -f "$elf" ] || { echo "check-fw-mem: $elf not found" >&2; exit 2; }
[ -f "$map" ] || { echo "check-fw-mem: $map not found; build with firmware/app/build.rs listing the binary" >&2; exit 2; }

cd "$(dirname "${BASH_SOURCE[0]}")/.."
host="$(rustc -vV | sed -n 's/^host: //p')"
llvm_size="$(rustc --print sysroot)/lib/rustlib/$host/bin/llvm-size"
[ -x "$llvm_size" ] || { echo "check-fw-mem: llvm-size missing; install the llvm-tools component" >&2; exit 2; }

sections="$("$llvm_size" -A "$elf")"
size_of() {
  awk -v section="$1" '$1 == section { print $2; found = 1 } END { exit !found }' <<<"$sections" ||
    { echo "check-fw-mem: $elf has no $1 section" >&2; exit 2; }
}
text="$(size_of .text)"
data="$(size_of .data)"
bss="$(size_of .bss)"
static=$((data + bss))

echo "=== BEGIN fw-mem $name ==="
printf '%-14s %8s\n' .text "$text" .data "$data" .bss "$bss" ".data + .bss" "$static" limit "$LIMIT"
echo "=== END fw-mem $name ==="

found=0
if [ "$static" -gt "$LIMIT" ]; then
  echo "check-fw-mem: .data + .bss is $static bytes, over the $LIMIT-byte limit"
  found=1
fi
if grep -n '__rust_alloc' "$map"; then
  echo "check-fw-mem: $map links a global allocator (the __rust_alloc lines above)"
  found=1
fi
[ "$found" -eq 1 ] || echo "check-fw-mem: $name passes: $static of $LIMIT static bytes, no __rust_alloc"
exit "$found"
