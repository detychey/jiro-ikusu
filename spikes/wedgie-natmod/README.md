# Spike: jiro-core as a wedgie native module

Not a plan item and not for merging as is: the record of the spike that tests whether Jiro can run as a [wedgie](https://wedgie.dev) app, which keeps the wedgie's own MicroPython firmware instead of flashing ours (the owner's choice, 2026-10-31).

## Results so far

- **The core on Cortex-M0: PASS.** `natmod/rust` builds jiro-core for `thumbv6m-none-eabi` as one position-independent object with no `.data` and no `.bss`. A bare-metal harness (`natmod/harness`), linked against that same object, replays all 75 golden vectors (43 game, 32 gate set) on qemu's `microbit` machine, bit for bit: Outcome, every tick's state hash, traceKeccak, and the recorded journal. See `out/harness-run.txt`.
- **The native module: built.** MicroPython v1.29.0's `mpy_ld`, the version the wedgie runs, links `natmod/glue` plus the core into `out/jiro_core.mpy`: 15,572 B of text, 0 bss, 5 GOT entries, header `4d 06 13 1f` (mpy v6.3, armv6m), the same header as the wedgie firmware's own native modules.
- **Import into MicroPython: fixed; it was our link order.** The first build froze the wedgie on its splash screen with USB unresponsive (wedgie firmware 0.3.76, MicroPython 1.29.0). The owner recovered it by holding both grey buttons and running `wedgie.py uninstall`. On qemu the same module hard-faulted on `import jiro_core` with an INVSTATE UsageFault (`out/qemu-import-hardfault.txt`). Cause: for armv6m, MicroPython v1.29.0's `mpy_ld` builds the module's entry trampoline before it lays out sections, from `mpy_init`'s offset in its own section. That is right only when the object holding `mpy_init` is linked first, and `natmod/glue/Makefile` linked the Rust object first. So the trampoline (`b.n` to text 0x364) landed inside `jiro_recorder_step`, which skipped its prologue and popped the caller's frame into PC. Fix: the Makefile now links `jiro.o` and `call_on_stack.o` before `build/jiro_rust.o`, and `mpy_init` sits at text 0x364. Same text size (15,572 B) and GOT; the module is 15,712 B. On qemu, `import jiro_core` succeeds and `scripts/qemu_natmod_vectors.py` passes all 75 vectors in one session. `scripts/qemu_app_check.py` runs the app's own `run()` (`app/jiro.py` with `lcd` and `ui` stubbed), which passes its 4 vectors. Not yet rerun on the wedgie.
- **Cost:** the worst tick is about 1.8 M instructions, about 22 ms at 125 MHz, against a 66.7 ms tick; a mean tick about 0.18 ms.
- **Stack:** `replay` needs about 44 KB and `start` about 63 KB of stack, against the rp2 port's 8 KB C stack. `natmod/glue/call_on_stack.S` runs the core on a 64 KB heap buffer; in-place constructors in the core would remove the need.
- **RAM:** the app holds a 64 KB stack buffer in one block, an 18.5 KB Recorder, the 16 KB module and about 13 KB of vectors JSON. `app/jiro.py` now allocates the stack before the import and one Recorder right after it, then reuses that Recorder. `scripts/qemu_app_check.py` measures this on qemu, with a ballast that leaves a given amount of heap free. The old order failed even on the full 162 KB heap: the per-case Recorder found no 18.5 KB block once the JSON was parsed. The new order passes at 162 KB and at 137 KB. It fails with a MemoryError at 145 KB, 140 KB and 135 KB or less, depending on where the heap's holes fall. Loading the JSON first is worse: no 64 KB block is left. The wedgie's `debug` output reports 115 KB free, so a MemoryError on the device is likely. It would be a Python exception, not a freeze. The remedy is less RAM: a smaller stack (in-place constructors in the core) or vectors read one at a time.
- **Not shown by qemu:** code in RAM is not a concern; the RP2040 runs it, as it does the wedgie's own native modules. Interrupts on the RP2040 push onto the current stack, which is the heap buffer while the core runs. `start` peaks at 62,784 B of the 64 KB, which leaves about 2.7 KB for interrupt frames. A 2,700-tick replay is about 340 M instructions, a few seconds of one native call at 125 MHz. During it the VM runs no scheduled tasks, so USB output stalls and Ctrl-C waits. No watchdog is evident: the frozen wedgie hung rather than reset, but that is an inference.

## Next

The owner reinstalls the app with the relinked `app/jiro_core.mpy` and tests it on a real wedgie (RP2040, the rp2 port, where native modules are supported). That settles GO or NO-GO before README §2, §3, §9 and the M3 items are amended.

## Reproducing

The scripts expect MicroPython v1.29.0 (github.com/micropython/micropython, commit 0fd6c573) at `dl/micropython`, pyelftools 0.32 for `mpy_ld`, `arm-none-eabi-gcc` and `qemu-system-arm`: `scripts/build-core.sh`, `make -C natmod/glue`, `scripts/build-harness.sh` and `scripts/run-harness.sh`, `scripts/build-qemu.sh`, then `scripts/qemu_natmod_vectors.py <firmware.elf> <jiro_core.mpy> <repo> <vector>...` under a timeout (it hangs if the module hard-faults). `scripts/make_cases.py <repo> out/cases` must run before `scripts/build-harness.sh`.

## The wedgie test app

`app/` is a wedgie app (`mod` `jiro`, entry `run`): it imports `jiro_core.mpy`, replays four golden vectors (`app/jiro_vectors.json`, from `scripts/make_app_vectors.py`) and checks the code, the Outcome, the tick count, traceKeccak and the last state hash, then replays each played vector through the Recorder and checks its journal, end reason and final state hash. It shows PASS or FAIL per vector, prints details and the replay time over USB, and waits for green to finish.

Install it from this folder with wedgie's CLI (https://wedgie.dev/wedgie.py), which asks the red FULL CONTROL question on the wedgie:

```bash
python3 wedgie.py install spikes/wedgie-natmod/app
```

Read the USB output with `python3 wedgie.py debug`, or on the wedgie's page at wedgie.dev/connect.
