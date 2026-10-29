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
| `src/main.ts` | The page: level picker, HUD, end screen, journal download, bindings panel |
| `test/*.test.ts` | vitest: the clock, the bindings, and play through the wasm build |
| `test/vectors.mjs` | The wasm parity runner of M1.11 (plain Node) |
