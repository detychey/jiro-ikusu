#!/usr/bin/env bash
# Links build/jiro_rust.o with the bare-metal Cortex-M0 harness for qemu -M microbit.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
H=$S/natmod/harness
arm-none-eabi-gcc -mthumb -mcpu=cortex-m0 -mfloat-abi=soft -Os -std=c11 -Wall -Wextra -Werror \
  -ffreestanding -ffunction-sections -fdata-sections -nostdlib \
  -DJIRO_MANIFEST="\"$S/out/cases/manifest.txt\"" \
  "$H/startup.c" "$H/main.c" "$S/natmod/glue/call_on_stack.S" "$S/build/jiro_rust.o" \
  -T "$H/link.ld" -Wl,--gc-sections -Wl,-Map="$S/build/harness.map" -lgcc -o "$S/build/harness.elf"
arm-none-eabi-size "$S/build/harness.elf"
