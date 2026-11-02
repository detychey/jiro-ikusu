#!/usr/bin/env bash
# Builds MicroPython v1.29.0's mpy-cross and its qemu port for the MICROBIT board (nRF51,
# Cortex-M0, armv6m) in the clone that `scripts/bootstrap.sh wedgie` makes: native .mpy loading
# enabled (MICROPY_EMIT_THUMB=1) as on the rp2 port, an 8 KB C stack as the rp2 port's
# PICO_STACK_SIZE=0x2000, a 200 KB heap, and no frozen manifest, which would need the
# micropython-lib submodule. The board's QEMU_ARGS give the machine 256 KB of RAM. Prints the
# firmware's path.
set -euo pipefail

mpy_dir="${JIRO_WEDGIE_HOME:-$HOME/.cache/jiro-wedgie}/micropython"
log="$mpy_dir/build-qemu.log"

build() {
  if ! "$@" >>"$log" 2>&1; then
    tail -n 30 "$log" >&2
    echo "build-qemu: failed: $*" >&2
    exit 1
  fi
}

: >"$log"
build make -C "$mpy_dir/mpy-cross" -j"$(nproc)"
build make -C "$mpy_dir/ports/qemu" BOARD=MICROBIT FROZEN_MANIFEST= \
  MICROPY_HEAP_SIZE=204800 MICROPY_STACK_SIZE=8192 \
  CFLAGS_EXTRA="-DMICROPY_EMIT_THUMB=1 -DMICROPY_EMIT_INLINE_THUMB=1" -j"$(nproc)"
echo "$mpy_dir/ports/qemu/build-MICROBIT/firmware.elf"
