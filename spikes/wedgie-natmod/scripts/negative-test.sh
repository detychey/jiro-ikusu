#!/usr/bin/env bash
# Builds the harness against out/negative/manifest.txt (four corrupted expectations and one good
# control) and checks that it reports exactly the four failures.
set -euo pipefail
S=$(cd "$(dirname "$0")/.." && pwd)
H=$S/natmod/harness
arm-none-eabi-gcc -mthumb -mcpu=cortex-m0 -mfloat-abi=soft -Os -std=c11 -Wall -Wextra -Werror \
  -ffreestanding -ffunction-sections -fdata-sections -nostdlib \
  -DJIRO_MANIFEST="\"$S/out/negative/manifest.txt\"" \
  "$H/startup.c" "$H/main.c" "$S/natmod/glue/call_on_stack.S" "$S/build/jiro_rust.o" \
  -T "$H/link.ld" -Wl,--gc-sections -lgcc -o "$S/build/harness-negative.elf" 2>&1 | grep -v -E "GNU-stack|deprecated" || true
set +e
timeout 600 qemu-system-arm -M microbit -global nrf51-soc.flash-size=1048576 \
  -global nrf51-soc.sram-size=262144 -nographic -monitor null -serial null \
  -semihosting-config enable=on,target=native -icount shift=0 \
  -kernel "$S/build/harness-negative.elf" > "$S/out/negative-run.txt" 2>&1
status=$?
set -e
grep -E "^(ok|FAIL) |^  |vectors:" "$S/out/negative-run.txt"
echo "qemu exit status: $status (1 expected)"
[ "$status" = 1 ] && grep -q "vectors: 5, failed: 4" "$S/out/negative-run.txt"
