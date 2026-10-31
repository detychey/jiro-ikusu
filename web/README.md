# web

The browser game (README §3, plan M2.1): the core compiled to wasm (`web/wasm`, plan M1.11),
driven by a plain-canvas TypeScript shell.

## Stack (plan P8)

Vite and TypeScript with a plain canvas, vitest and ESLint, no UI framework. Versions are pinned
in `package.json`, with `package-lock.json`. TypeScript stays on 6.0, the newest release that
typescript-eslint supports. M2.2 adds one Playwright smoke test, and M5 adds ethers v6.

## Run it

```bash
bash web/wasm/build-wasm.sh          # target/wasm32-unknown-unknown/release/jiro_wasm.wasm
npm --prefix web ci
npm --prefix web run dev             # http://localhost:5173
npm --prefix web run build           # web/dist, a static site
```

The page takes optional query parameters:

- `level`: a level name from the picker;
- `nonce`: a 32-byte run nonce in hex (by default each Training run draws a random one);
- `autoplay`: start without pressing Play.

The canvas exposes `data-state-hash`, `data-ticks-used` and, once the level has ended,
`data-end-reason`, for the smoke test.

## Replay viewer

`replay.html` (plan M2.3) watches and audits a journal: load a game vector with its `.trace`
file, or a level and a journal, each from a file or from hex. The core replays them as the
referee does and gives the Outcome; a journal the core rejects shows its error code. Play,
pause and step move through the ticks, and the slider seeks, which plays the journal again from
tick 0. Each tick shows its state hash and the inputs held, and a vector's trace is compared tick
for tick, with the first tick that differs.

## Controls

The defaults are the arrow keys for the joystick, and the keys A, B and X for the device keys of
the same names: A cuts fast, B slows the player behind the shield, X banks the level (README §2).
The Controls panel rebinds each control to any key and refuses a key already bound to another
control. Bindings are stored in the browser's localStorage when it is available. The journal
records controls, not keys, so a binding never changes a game's outcome (D8).

Each tick samples the controls once (README §6.1). A key pressed and released between two
samples still counts in the next one, so a quick tap of X is never lost.

## Layout

| File | Role |
|---|---|
| `src/core.ts` | Typed loader of the `jiro-wasm` exports |
| `src/loop.ts` | The 15 Hz tick clock: tick k is due at t0 + k × 1000 / 15 ms; late ticks run as soon as possible, none is skipped or run twice |
| `src/input.ts` | Controls, bindings and the held keys |
| `src/session.ts` | One level in play: core, clock and keys on the single input path |
| `src/render.ts` | The 240 × 240 field at an integer scale, redrawing only the changed cells |
| `src/main.ts` | The game page: level picker, HUD, end screen, journal download, bindings panel |
| `src/pages/replay.ts` | The replay viewer: the view of a replayed journal, the trace comparison and the page |
| `src/page.ts` | What the pages share: elements by id, loading the engine, claims in percent |
| `src/journal.ts` | The events of a journal the core has accepted |
| `src/errors.ts` | The core's error codes by name, with their meaning |
| `test/*.test.ts` | vitest: the clock, the bindings, play and replay through the wasm build, the error names |
| `test/vectors.mjs` | The wasm parity runner of M1.11 (plain Node) |
