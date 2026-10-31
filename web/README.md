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
- `autoplay`: start without pressing Play;
- `hex`: a level's bytes in hex, played as "Edited level" (the level editor's Play button sets it).

The canvas exposes `data-state-hash`, `data-ticks-used` and, once the level has ended,
`data-end-reason`, for the smoke test.

## Training

The game page is Training (README §8.1): free, with no wallet, and no network call once the
engine and the levels have loaded. Each attempt draws a random run nonce, as README §6.3 allows
in Training. The picker lists the 16 levels, then the other levels: the open field, walls and
minions, and the editor's level. A level from any source, a file or the editor included, is
scored when it is one of the 16 levels, and plays unscored otherwise.

An attempt on one of the 16 levels scores as a season scores it (README §8.4): the core replays
the attempt's journal with the level's weight from `seasons/calibration-1.json` and gives its
`level_score`. The page refuses to start when its 16 levels are not that file's, under the
engine's rules version. Each level's best score stays in localStorage, under the rules version,
the level id and the weight it was made with, so a best counts only under the scoring it was
made with. Each new score is compared with the bests stored by every tab, not only this one's.
Without storage the page still plays, and keeps the bests for the page only. After each attempt
the end screen offers the journal, which the replay viewer replays.

## Replay viewer

`replay.html` (plan M2.3) watches and audits a journal: load a game vector with its `.trace`
file, or a level and a journal, each from a file or from hex; choosing one source clears the
others, so the page never replays an input left over from earlier. The core replays them as the
referee does and gives the Outcome; a journal the core rejects shows its error code. Play,
pause and step move through the ticks, and the slider seeks, which plays the journal again from
tick 0. Each tick shows its state hash and the inputs held, and a vector's trace is compared tick
for tick, with the first tick that differs.

## Level editor

`editor.html` (plan M2.5) edits a level: paint obstacles, place up to 3 minion spawns, which take
their slots in row-major order as a level source gives them (README §5), and set the boss body
size, its spawn rectangle and the other fields. An imported level gets its spawns numbered the
same way, and the page says so when that changes its bytes; a level with two minions on one
cell, which no source writes, is not imported. The editor has no format of its own: jiro-wasm's
`decode_level` and `encode_level` run the core's level codec on the editor's model, so a level
drawn here has the same bytes and `level_id` as its source compiled by the level tool. After
every change the core validates the bytes and shows the first rule they break, with its code.
It imports and exports `.bin` files and hex, and Play opens the game on the edited level.

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
| `src/storage.ts` | Values kept in localStorage as JSON, with a fallback when storage is missing or refuses |
| `src/session.ts` | One level in play: core, clock and keys on the single input path |
| `src/render.ts` | The 240 × 240 field at an integer scale, redrawing only the changed cells |
| `src/pages/training.ts` | The game page, Training: level picker, HUD, end screen, score and local bests, journal download, bindings panel |
| `src/pages/replay.ts` | The replay viewer: the view of a replayed journal, the trace comparison and the page |
| `src/pages/editor.ts` | The level editor: painting, fields, live validation, import, export and Play |
| `src/level.ts` | The editor's model of a level, its cells and fields, which the core encodes and decodes |
| `src/page.ts` | What the pages share: elements by id, loading the engine, the field's size, error messages, claims in percent |
| `src/journal.ts` | The events of a journal the core has accepted |
| `src/errors.ts` | The core's error codes by name, with their meaning |
| `test/*.test.ts` | vitest: the clock, the bindings, play, Training, replay and the level editor through the wasm build, the error names |
| `test/drive.ts` | Plays a level through the page's session on a fake clock, with the controls of a journal or a script |
| `test/vectors.mjs` | The wasm parity runner of M1.11 (plain Node) |
