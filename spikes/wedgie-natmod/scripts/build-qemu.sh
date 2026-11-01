#!/usr/bin/env bash
# Builds mpy-cross and MicroPython v1.29.0's qemu port for the MICROBIT board (nRF51, Cortex-M0,
# armv6m), with native .mpy loading enabled as on the rp2 port (MICROPY_EMIT_THUMB=1), an 8 KB C
# stack like the rp2 port's PICO_STACK_SIZE=0x2000, and no frozen manifest (it needs the
# micropython-lib submodule). The board's qemu RAM is raised to 256 KB by its QEMU_ARGS.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
MPY=$S/dl/micropython
HEAP=${HEAP:-204800}
make -C "$MPY/mpy-cross" -j"$(nproc)" >"$S/out/mpy-cross.log" 2>&1
make -C "$MPY/ports/qemu" BOARD=MICROBIT FROZEN_MANIFEST= \
  MICROPY_HEAP_SIZE="$HEAP" MICROPY_STACK_SIZE=8192 \
  CFLAGS_EXTRA="-DMICROPY_EMIT_THUMB=1 -DMICROPY_EMIT_INLINE_THUMB=1" \
  -j"$(nproc)" >"$S/out/qemu-build.log" 2>&1
ls -la "$MPY/ports/qemu/build-MICROBIT/firmware.elf"
arm-none-eabi-size "$MPY/ports/qemu/build-MICROBIT/firmware.elf"
