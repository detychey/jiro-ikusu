---
name: rp2040-firmware
description: Use when writing or reviewing the device side — the wedgie app (MicroPython on a Raspberry Pi Pico RP2040 with the Waveshare Pico-LCD-1.3) and jiro-core's native module jiro_core.mpy — screen, joystick and keys, the 15 Hz tick, RAM and stack budget, building and installing. Not for game rules; those belong to the core (see deterministic-core).
---

# wedgie app and native module (RP2040, Pico-LCD-1.3)

The device is a [wedgie](https://wedgie.dev) and Jiro is an app on it (README §3, §13 D1). The app, in MicroPython, samples inputs, steps the core's Recorder with the mask, and draws what the core reports. It never changes game state itself and never re-implements a rule: the rules live in README §4 and in the core, which runs as a native module. The device plays Training only; Challenge runs are played in the browser (D15).

## Facts

- RP2040: dual Cortex-M0+, 264 KB SRAM, no FPU. The wedgie's firmware (0.3.76, then 0.3.77) runs MicroPython 1.29.0 and boots into one app. About 137 KB of RAM is free for an app, and about 113.6 KB after a power-up, which also starts the wedgie's USB drive (largest block about 96 KB).
- Screen: the firmware's 240×240, 16-color framebuffer (4 bits per pixel, 28,800 B). A full-screen push takes about 25 ms. Pin map and key mapping: README §2. On the case, A is green, B and X are grey, Y is red.
- An app is a folder with `wedgie.json`: at most 30 files and 256 KB, every file name starting with its `mod`. Saves go to `/saves/<mod>/` and survive reinstalls. Install with `python3 wedgie.py install .` and one green press. Holding both grey buttons while plugging in starts the wedgie without its app.
- The rp2 port's C stack is 8 KB, so the glue runs the core on a stack the app allocates: 24 KB for `start`, `step` and `state_hash` (the core builds the Recorder in place, `Recorder::new_in`; `start` peaks at 19,404 B), 48 KB for `replay`, which builds its game on the stack as the referees do (peak 46,820 B).
- Sources for these numbers: [wedgie.dev/skill.md](https://wedgie.dev/skill.md), [code.md](https://wedgie.dev/code.md), [usb.md](https://wedgie.dev/usb.md), and the spike's `spikes/wedgie-natmod/README.md` (PR #42).

## The native module

- `jiro-natmod` builds jiro-core for `thumbv6m-none-eabi` as one position-independent object, with no `.data` and no `.bss`. MicroPython v1.29.0's `mpy_ld` links it with the C glue into `jiro_core.mpy`.
- **Link the glue first.** For armv6m, `mpy_ld` builds the entry trampoline from `mpy_init`'s offset in its own section, so the object that defines `mpy_init` must be linked first. The other order froze a wedgie on its splash screen.
- Check every build in MicroPython's qemu port (Cortex-M0, 8 KB C stack) against the vectors before it reaches a device.

## Never

- Compute or patch game state in Python, or hand raw pins to the core.
- Use floating point in anything that touches game state. Rendering effects may use it if they never feed back.
- Read inputs outside the tick boundary.
- Redraw or push the full screen every tick.
- Allocate per tick, or parse large files at once: the heap fragments, and the stack, the Recorder and the module each need one free block.

## Always

- Take random bytes from `os.urandom`: the firmware's `wedgie.rand` probes the I2C bus for a secure element on its first call and keeps about 13 KB of drivers.
- Allocate the core's stack and the Recorder first, before importing anything else; ship the app's code precompiled with `mpy-cross`; read levels and vectors one at a time.
- Run this sequence every tick, on an absolute 66,667 µs schedule:
  1. Sample all inputs once, into the README §6.1 mask; Y and the joystick press are never in it.
  2. Step the Recorder with the mask; it journals the change.
  3. Redraw the changed 4×4-pixel cells and the entities, and push only the changed regions.
- A late tick is just late: never skip a tick or step twice. The simulation is indexed by tick, not by time.

## Done when

- The module replays every vector in `vectors/` in qemu, bit for bit, and the check app shows PASS on a wedgie.
- The app plays within the 66 ms tick with no overruns, and fits the wedgie's free RAM.
