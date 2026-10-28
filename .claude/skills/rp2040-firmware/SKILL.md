---
name: rp2040-firmware
description: Use when writing or reviewing firmware for the Raspberry Pi Pico (RP2040) with the Waveshare Pico-LCD-1.3 — LCD driver, joystick and key input, the 15 Hz tick timer, the USB serial link, memory budget. Not for game rules; those belong to the core (see deterministic-core).
---

# RP2040 firmware (Pico-LCD-1.3)

The firmware is a thin shell around the core. It samples inputs, appends them to the journal, steps the core with the journaled input, draws the result and talks USB. It never changes game state itself and never re-implements a rule: the rules live in README §4 and in the core.

## Hardware facts

- RP2040: dual Cortex-M0+, 264 KB SRAM, no FPU (floating point is emulated in software).
- Display: ST7789VW, 240×240, 4-wire SPI. Pin map and key mapping: README §2.
- Keys and joystick are active-low: enable the pull-ups, and a pin reading 0 means pressed.

## Never

- Allocate on the heap: no `malloc`/`new`, no `Vec`/`Box`/`String`, no STL or `alloc` collections.
- Recurse. Fills and searches use loops over statically sized stacks (README §4.8).
- Use floating point in anything that touches game state. Rendering effects may use it if they never feed back.
- Read GPIO outside the tick boundary, or hand raw GPIO to the core.
- Keep a full-screen framebuffer: 115,200 bytes, about 43 % of SRAM.

## Always

- Size static buffers from README §2: grid 3,600 B, capture stack 6,728 B, journal 8,100 B. There is at most one event per tick and levels are capped at 2,700 ticks (README §5), so the journal cannot overflow.
- Run this sequence every tick:
  1. Sample all inputs once.
  2. Append an event to the journal if the mask changed.
  3. Step the core with the journaled mask.
  4. Redraw the changed cells.
  5. Send the new journal events over USB.
- Drive ticks from a hardware timer: 66,667 µs, about 15 Hz. The interrupt handler only sets a flag; the work happens in the main loop. A late tick is just late: never skip a tick or step twice. The simulation is indexed by tick, not by time.
- Redraw only the 4×4-pixel cells that changed, over SPI (DMA if needed). Redraw the full screen only after a capture, and spread that redraw across ticks if it doesn't fit in 66 ms.

## Link to the browser

USB CDC serial on the Pico, Web Serial in the dApp (README §6.5):

- **Receive** the level bytes and the run nonce.
- **Stream** journal events as they happen.
- **At level end,** send the journal and the final state hash.

The commit deadline counts the time the journals actually took to play (README §7.2), so streaming is not optional in paid modes.

## Done when

- The on-device test build replays every vector in `vectors/` and prints state hashes identical to the native build.
- The build's map file shows static memory and stack usage fitting with margin.

## Shell language (D1)

The shell is Rust on `embassy-rp`, in its own Cargo workspace, built with cargo alone into a UF2. It uses the core as an ordinary crate: the core is linked, never ported.
