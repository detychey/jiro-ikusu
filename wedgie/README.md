# wedgie

Jiro on a [wedgie](https://wedgie.dev): jiro-core as a MicroPython native module, `jiro_core.mpy`, and the apps that run it (README §2, §3). The wedgie keeps its own firmware (0.3.76, MicroPython 1.29.0), so the module is built for that MicroPython and checked on its qemu port before it reaches a device.

| Path | What |
|---|---|
| `natmod/rust/` | `jiro-natmod`: jiro-core behind an `extern "C"` interface, a `staticlib` for `thumbv6m-none-eabi`, position-independent, with no `.data` and no `.bss`. Its own Cargo workspace. |
| `natmod/glue/` | The C glue (`jiro.c`), the stack switch (`call_on_stack.S`), the interface (`jiro_api.h`) and the Makefile that links `jiro_core.mpy` |
| `scripts/` | The builds, the qemu vector run, and the checks of `mpy_ld`'s rules, of the module's header and of the app limits |
| `check/` | The check app: it replays every golden vector through the module on a wedgie and shows PASS or FAIL per vector |

## Building

```bash
bash scripts/bootstrap.sh wedgie          # arm-none-eabi-gcc, qemu-system-arm, MicroPython v1.29.0, pyelftools 0.32
bash wedgie/scripts/build-qemu.sh         # mpy-cross and the qemu firmware; prints the firmware's path
make -C wedgie/natmod/glue                # jiro_core.mpy, then the mpy_ld rules and header checks
python3 -I wedgie/scripts/qemu_natmod_vectors.py <firmware.elf> wedgie/natmod/glue/jiro_core.mpy . --all
bash wedgie/scripts/build-check.sh        # the check app in wedgie/check/, and its app limits
```

The bootstrap puts MicroPython and pyelftools in `~/.cache/jiro-wedgie` (`JIRO_WEDGIE_HOME` moves it); docs/TOOLING.md records the versions. Run the qemu check under a timeout, as CI does: a module that hard-faults hangs qemu instead of failing. For a vector that fails, it also prints the first tick whose state hash differs from the committed trace (README §6.6), within the first 1,024 ticks: a whole trace does not fit beside the stack in the qemu port's heap.

- **Link order.** For armv6m, MicroPython v1.29.0's `mpy_ld` builds the module's entry trampoline from `mpy_init`'s offset in its own section, before it lays out the sections. That is right only when the object defining `mpy_init` is linked first. The spike's first build linked the Rust object first: its trampoline jumped into the middle of `jiro_recorder_step`, and the module froze a wedgie on its splash screen and hard-faulted on qemu. The Makefile links the glue's objects first.
- **Size.** The module is 15,890 bytes, of which 15,728 bytes of code, and takes 16,460 bytes of heap once imported. `natmod/rust` builds at `opt-level = "s"`, its smallest: 14,356 bytes of Rust code, against 15,474 at `"z"` and 18,296 at `2`.
- **Reproducible.** Two clean builds, in two directories, gave the same sha256; CI prints the size and sha256 of its own build between `=== BEGIN jiro_core.mpy ===` and `=== END jiro_core.mpy ===`.
- **CI** (`wedgie` job of `.github/workflows/ci.yml`) runs these steps and uploads `wedgie/check/` with the module as the `wedgie-check` artifact, kept 90 days.

## The module's interface

`jiro_core` exports `rules_version()`, `recorder_size()`, `start(recorder, level, mode, run_nonce, level_index, stack)`, `step(recorder, mask, stack)`, `journal(recorder)`, `journal_equals(recorder, buffer)`, `state_hash(recorder, stack)` and `replay(level, journal, weight_bp, stack[, trace])`; `natmod/glue/jiro.c` documents the return values. The caller owns all memory: a `bytearray` of at least 64 KB for the stack, and one of `recorder_size()` bytes for the Recorder.

## Stack and RAM

- **Stack.** The rp2 port gives C code an 8 KB stack, and the core builds its large structs on the stack, so every call into the core but `journal` and `journal_equals`, which only read the Recorder, runs on the 64 KB stack the app allocates (`call_on_stack.S`). The qemu port's 8 KB stack size is a soft limit the VM checks, not a physical stack: the qemu run checks that the core stays on the 64 KB buffer and fits it, and the wedgie run is the real check of the rp2 port. The qemu run measures the peaks over all 75 vectors: `start` 62,784 bytes, `step` 344, `replay` 44,040, of 65,536. Interrupts push onto the current stack: in some qemu runs `start` peaked at 62,816 bytes, one 32-byte exception frame more. On the RP2040 that leaves about 2.7 KB for interrupt frames. In-place constructors in the core would shrink the stack (plan M3.10).
- **RAM.** The wedgie reported 137,760 bytes free with no app, and 115,344 during a `wedgie.py debug` job (spike, [PR #42](https://github.com/detychey/jiro-ikusu/pull/42)). An app needs, in large blocks, the 64 KB stack, the 18,564-byte Recorder and the module's 16 KB: 100 KB. So an app allocates the stack and the Recorder first, while the heap is whole, then imports `jiro_core`; ships its code precompiled with `mpy-cross`, so that no parse tree is scattered over the heap; and reads one level or vector at a time.
- **The check app** holds at most one vector at a time: up to 8,172 bytes of journal read from its file, which `journal_equals` compares with the Recorder's in place. On qemu, with the heap filled to leave a given amount free, it passed with 137,760 bytes free in one block or with four 4 KB holes, down to 121,000 in one block and 120,000 with eight 1 KB holes, and failed with a MemoryError (an exception, not a freeze) at 120,000 in one block and 117,000 with the holes. The spike's smaller app, which held at most 5 KB per vector, passed down to 113,792 bytes free.
- **Time.** On qemu's instruction count, replaying the 75 vectors takes 12.1 billion instructions, the worst vector 386 million. At 125 MHz that is about 100 s, and the Recorder pass about as much again, so the check app runs for about 4 minutes. During a long replay the VM runs no scheduled tasks, so USB output stalls; the screen shows which vector runs.

## The check app

`check/` is a wedgie app (`mod` `jiro`, entry `run`). `jiro.py` allocates the core's stack and Recorder, imports `jiro_core`, then `jiro_check.mpy`, compiled from `check/jiro_check.py`. It reads `jiro_vectors.bin`, which `scripts/make_check_vectors.py` writes from every vector of `vectors/game/` and `vectors/levels/`, one record at a time. For each vector it checks replay's code, the Outcome, the tick count, traceKeccak and the last state hash; for a vector replay accepts, it plays the journal's inputs through the Recorder and checks its end reason, journal and final state hash. Before each vector it shows "vector i of 75" on the screen. It prints each result over USB, then shows PASS or FAIL per vector, eight to a page, as `ok 12 ture-split-boss-left`: the vector's number and the end of its name; green turns the page. The qemu run uses the same `read_case` and `check` on records of the same encoder.

`wedgie/scripts/check_app_limits.py` checks the wedgie's app limits on the files `wedgie.json` lists: at most 30 files and 256 KB, every name starting with the `mod`. The check app has 4 files and 228,507 bytes.

## Installing on a wedgie

Download and unzip the `wedgie-check` artifact of a CI run (or build it, above), and from its folder, with wedgie's CLI ([wedgie.dev/wedgie.py](https://wedgie.dev/wedgie.py)):

```bash
python3 wedgie.py install .
```

Press green on the wedgie to accept, then read the progress and the results on its screen. Don't run `python3 wedgie.py debug` while the check runs: it stops the app and restarts it. Run it afterwards, to read `error.log` if the app ended on an error.

**If the wedgie hangs on an app,** for example on its splash screen with USB unresponsive: unplug it, hold both grey buttons (B and X) while plugging it in, which starts it without its app, then run `python3 wedgie.py uninstall`.
