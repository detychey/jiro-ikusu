# Spike: jiro-core as a wedgie native module

Not a plan item and not for merging as is: the record of the spike that tests whether Jiro can run as a [wedgie](https://wedgie.dev) app, which keeps the wedgie's own MicroPython firmware instead of flashing ours (the owner's choice, 2026-10-31).

## Results so far

- **The core on Cortex-M0: PASS.** `natmod/rust` builds jiro-core for `thumbv6m-none-eabi` as one position-independent object with no `.data` and no `.bss`. A bare-metal harness (`natmod/harness`), linked against that same object, replays all 75 golden vectors (43 game, 32 gate set) on qemu's `microbit` machine, bit for bit: Outcome, every tick's state hash, traceKeccak, and the recorded journal. See `out/harness-run.txt`.
- **The native module: built.** MicroPython v1.29.0's `mpy_ld`, the version the wedgie runs, links `natmod/glue` plus the core into `out/jiro_core.mpy`: 15,572 B of text, 0 bss, 5 GOT entries, header `4d 06 13 1f` (mpy v6.3, armv6m), the same header as the wedgie firmware's own native modules.
- **Import into MicroPython on qemu: FAIL, cause unknown.** `import jiro_core` hard-faults with an INVSTATE UsageFault: the CPU branched to 0x20018D70, inside the module's code, without the Thumb bit (`out/qemu-import-hardfault.txt`). Upstream disables the native emitter on qemu's nRF51 board, and `scripts/build-qemu.sh` forces it on, so the fault may be the emulator setup rather than the module. Not yet settled.
- **Cost:** the worst tick is about 1.8 M instructions, about 22 ms at 125 MHz, against a 66.7 ms tick; a mean tick about 0.18 ms.
- **Stack:** `replay` needs about 44 KB and `start` about 63 KB of stack, against the rp2 port's 8 KB C stack. `natmod/glue/call_on_stack.S` runs the core on a 64 KB heap buffer; in-place constructors in the core would remove the need.

## Next

The owner tests `out/jiro_core.mpy` on a real wedgie (RP2040, the rp2 port, where native modules are supported). That settles GO or NO-GO before README §2, §3, §9 and the M3 items are amended.

## Reproducing

The scripts expect MicroPython v1.29.0 (github.com/micropython/micropython, commit 0fd6c573) at `dl/micropython`, pyelftools 0.32 for `mpy_ld`, `arm-none-eabi-gcc` and `qemu-system-arm`: `scripts/build-core.sh`, `make -C natmod/glue`, `scripts/build-harness.sh` and `scripts/run-harness.sh`, `scripts/build-qemu.sh`, then `scripts/qemu_natmod_vectors.py <firmware.elf> <jiro_core.mpy> <repo> <vector>...`.
