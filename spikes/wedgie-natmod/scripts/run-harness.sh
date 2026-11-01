#!/usr/bin/env bash
# Runs the harness on qemu's micro:bit (nRF51, Cortex-M0, armv6m) with 256 KB of RAM.
# -icount shift=0: one instruction per virtual nanosecond, so SysTick counts instructions.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
exec timeout 1800 qemu-system-arm -M microbit \
  -global nrf51-soc.flash-size=1048576 -global nrf51-soc.sram-size=262144 \
  -nographic -monitor null -serial null \
  -semihosting-config enable=on,target=native -icount shift=0 \
  -kernel "$S/build/harness.elf"
