# Jiro-ikusu

A deterministic, onchain-verifiable area-capture game in the spirit of *Qix* and *Volfied*. It runs on a Raspberry Pi Pico fitted with a Waveshare Pico-LCD-1.3, and in the browser.

> **Status: specification, rules frozen (milestone M0, 2026-10-28), no game code yet.** This README is the project specification. It is built from [`plan-draft.md`](plan-draft.md), the original draft (kept for reference). It also fixes the parts of the draft that would break determinism or the economics, and records the decisions, taken and still open, in [§13](#13-open-decisions). A rule tied to a decision is tagged with its ID, e.g. *(D3)*.

## Contents

1. [Concept](#1-concept)
2. [Hardware target](#2-hardware-target)
3. [Architecture](#3-architecture)
4. [Game rules](#4-game-rules)
5. [Levels](#5-levels)
6. [Input journal and byte formats](#6-input-journal-and-byte-formats)
7. [Verification and trust model](#7-verification-and-trust-model)
8. [Game modes and economy](#8-game-modes-and-economy)
9. [Roadmap](#9-roadmap)
10. [Reuse from ethblockdigger](#10-reuse-from-ethblockdigger)
11. [Reference implementations](#11-reference-implementations)
12. [Agent skills](#12-agent-skills)
13. [Open decisions](#13-open-decisions)

## 1. Concept

The player moves along the edge of a 60×60 field. Leaving the edge draws a trail, and reaching the edge again captures every region without the boss. The boss bounces around the open field and kills the player if it touches the trail, while minions patrol the edges. Claiming enough of the field clears the level.

Every game must be replayable, bit for bit, by a smart contract:

- **A game is a pure function** of (level, seed, input journal). It uses integer math only, no wall-clock time, and a fixed 15 Hz tick.
- **The device records only input changes** (the journal). A referee replays the journal and computes the score itself, so a submitted score is never trusted.
- **One core implementation** runs on the Pico, in the browser and in the referee.

There are three modes ([§8](#8-game-modes-and-economy)):

- **Training:** free, all 16 levels.
- **Challenge:** 0.00005 ETH for 6 random levels, with a seasonal ranking and rewards.
- **Superchallenge:** player-minted maps with bounties, deferred ([`TODO.md`](TODO.md)).

## 2. Hardware target

| | |
|---|---|
| Board | Raspberry Pi Pico: RP2040, dual Cortex-M0+, 264 KB SRAM, **no FPU**. The hat also fits the Pico 2 (RP2350). |
| Display | [Waveshare Pico-LCD-1.3](https://www.waveshare.com/wiki/Pico-LCD-1.3): 240×240 IPS, ST7789VW controller, 4-wire SPI |
| Inputs | 5-way joystick (4 directions + press) and keys A, B, X, Y, all active-low |
| Power and link | USB, which is also the data link to the browser ([§6.5](#65-device-to-browser-link)) |

Pin map, from the Waveshare wiki:

| LCD signal | GPIO | Input | GPIO |
|---|---|---|---|
| DIN (MOSI) | GP11 | Keys A / B / X / Y | GP15 / GP17 / GP19 / GP21 |
| CLK | GP10 | Joystick up / down | GP2 / GP18 |
| CS | GP9 | Joystick left / right | GP16 / GP20 |
| DC | GP8 | Joystick press | GP3 |
| RST | GP12 | | |
| BL (backlight) | GP13 | | |

The draft names the keys Key0–Key3. They map to A, B, X, Y in that order *(D8)*:

| Control | Action |
|---|---|
| Joystick | Move one cell per tick |
| Key0 = A | **Fast cut:** two cells per tick while cutting |
| Key1 = B | **Slow shield:** one cell every second tick, absorbs one hit *(D6)* |
| Key2 = X | **Commit:** end the level now and keep its claim |
| Key3 = Y, joystick press | Unused and not journaled |

The draft's Key2 is "Commit/Forfeit (ends game immediately)". Here it ends the current level, not the whole run, and the level keeps its claim.

**In the browser, the keys are configurable** *(D8)*: each control can be bound to any key, and the choice is stored per browser. The journal records controls, not keys, so remapping never changes a game's outcome.

Everything is allocated statically. The RP2040 has 270,336 bytes of SRAM:

| Buffer | Bytes |
|---|---|
| Grid: 3,600 cells × 1 byte | 3,600 |
| Capture stack: at most 3,364 cells × 2 bytes ([§4.8](#48-capture)) | 6,728 |
| Journal: at most 1 event per tick × 2,700 ticks × 3 bytes ([§6.2](#62-events)) | 8,100 |
| Full-screen RGB565 framebuffer (not used) | 115,200, about 43 % of SRAM |

A tick changes only a handful of cells. So the renderer redraws the changed 4×4-pixel cells instead of keeping a framebuffer.

## 3. Architecture

**One deterministic core, compiled for every target.** The draft implies three implementations of the rules: C++ on the Pico, the browser version, and Solidity in the verifier. Any disagreement between them would silently invalidate games. With a single core there is nothing to keep in sync, and golden test vectors prove that every build still agrees (M1 in [§9](#9-roadmap)).

```text
                 ┌──────────────────────────────────────────────────┐
                 │  core: Rust, no_std, no heap, integer-only       │
                 │  rules · capture · scoring · codec · seeds       │
                 └──────────────────────────────────────────────────┘
                      │              │              │             │
                      ▼              ▼              ▼             ▼
                  firmware       web (wasm)      referee        native
                  RP2040 shell   game, replays,  Stylus or      tests, vectors,
                                 editor, dApp    zkVM guest     playtest bots
                      │              │    │          ▲
                      └─ USB serial ─┘    └─ wallet ─┴─ contracts (Solidity)
```

| Directory (planned) | Built from the core as | Responsibilities outside the core |
|---|---|---|
| `core/` | the crate itself | All game rules, capture, scoring, journal codec, seed derivation, state hash |
| `shell/` | `no_std` library, `jiro-shell` | Code shared by the firmware and the web app that is not consensus: the USB link codec and the dirty-cell diff. Never hashed. |
| `tools/` | native binary, `jiro-tools` | The native target: vectors, replay, level tool, playtest bots, calibration, differential fuzzing, vector pack. `tools/xcheck/` (Node and ethers) computes the worked examples and fixtures independently of the core. |
| `firmware/` | `thumbv6m-none-eabi` library | LCD, inputs, 15 Hz timer, USB link |
| `web/` | `wasm32` module | Canvas rendering, keyboard, replay viewer, level editor, wallet, Web Serial bridge |
| `referee/` | Stylus contract or zkVM guest *(D2)* | `IReferee`: `verifyRun`, `verify` and `rulesVersion` ([§7.3](#73-verification-cost)) |
| `contracts/` | (Solidity) | Payments, entropy, runs, seasons, maps |
| `levels/` | (data) | The 16 levels |
| `vectors/` | output of the native build | Golden test vectors that every target must reproduce |

**Core language: Rust** *(D1, decided)*. The draft specifies C++; the core is written in Rust instead, for three reasons:

- **Existing pipeline.** ethblockdigger already has a `no_std` Rust referee crate, its Stylus packaging, pinned wasm builds and cross-language conformance tests ([§10](#10-reuse-from-ethblockdigger)). Jiro can reuse that pipeline instead of building one.
- **On-chain targets are Rust-first.** Stylus contracts and zkVM guests (RISC Zero, SP1) are written in Rust, so the core can become the onchain referee or a proof guest without a port.
- **No undefined behavior.** Overflow can be made explicit everywhere: `wrapping_*` and `checked_*` in the code, plus `overflow-checks = true` in every build profile so that debug and release builds behave the same.

**Firmware shell: Rust on `embassy-rp`** *(D1)*. The shell uses the core as an ordinary Rust dependency, and the firmware builds with cargo alone, without `arm-none-eabi-gcc`. The draft's C++ on the Pico SDK would have linked the core as a static library through a C ABI. Either way, the rules exist exactly once.

## 4. Game rules

These rules are normative. Every target implements them through the core, and the golden vectors pin them down.

Every rule carries a stable tag that tests and vectors cite: `[R4.<n>-<k>]`, or `[PIN-<nn>]` for a detail pinned in M0.5. A new rule takes the next free number, and a removed rule's tag is never reused. A paragraph or bullet that only gives a rationale, history or an example ends with the marker `<!-- rationale -->`, which does not render. `scripts/check-rule-tags.sh` prints every other line from §4.1 to the end of §4 that carries no tag, and every repeated or misplaced tag. Tables in §4 use outer pipes.

### 4.1 Grid

- **Layout.** 60×60 cells in a flat `u8` array, row-major: `index = y * 60 + x`. (0, 0) is the top-left corner, x grows to the right and y grows down. Each cell is drawn as a 4×4-pixel square. Up and N step to (x, y − 1), right and E to (x + 1, y), down and S to (x, y + 1), left and W to (x − 1, y). A neighbor outside the grid is neither open field nor a rail cell. [R4.1-1]
- **Cell states:** [R4.1-2]

  | Value | State | Drawn as |
  |---|---|---|
  | 0 | `EMPTY`: open field, boss territory | black [R4.1-3] |
  | 1 | `CLAIMED`: solid (the border, obstacles, captured cells) | blue [R4.1-4] |
  | 2 | `TRAIL`: the cut being drawn, vulnerable | red [R4.1-5] |
  | 3 | `BOSS_ZONE`: temporary marker, exists only during a capture | not drawn [R4.1-6] |

- **Level start.** The border (x = 0, x = 59, y = 0, y = 59) and the level's obstacles are `CLAIMED`. Everything else is `EMPTY`. [R4.1-7]
- **Claim** is measured in basis points of the cells that were `EMPTY` at level start: `claim_bp = captured_cells * 10_000 / claimable_cells`, with integer division. The border and obstacles never count. On a level without obstacles, `claimable_cells` is the 58×58 interior: 3,364 cells. [R4.1-8]

### 4.2 Rail

A **rail cell** is a `CLAIMED` cell with at least one `EMPTY` or `TRAIL` cell among its 8 neighbors. The player and the minions walk on the rail. [R4.2-1]

- **Diagonal neighbors count,** so the rail stays connected around corners. With only 4 neighbors, the four corners of the starting border would not be rail cells, and the rail would break there. [R4.2-2]
- **`TRAIL` counts as open,** so the rail changes only on capture, never while a cut is being drawn. [R4.2-3]

### 4.3 Entities

All entity fields are small integers: [R4.3-1]

| Entity | State |
|---|---|
| Player | position; cutting flag; cut start cell; lives; shield charges; invulnerability ticks; previous direction; `press_tick` [R4.3-2] |
| Boss | position (the top-left cell of its body); body size B (set per level); vx, vy ∈ {−1, +1}; move period (moves every N ticks, set per level) [R4.3-3] |
| Minions (0–3 per level; the draft has 3) | position; heading 0–3 (N, E, S, W); move period; respawn countdown [R4.3-4] |

- **Field values.** The cut start keeps the last cut's start cell between cuts. Invulnerability ticks counts the protected ticks left: the player is invulnerable at step 6 while it is above 0; after the hits are resolved, a life lost sets it to 30, and otherwise it drops by one if above 0; starting a cut sets it to 0 at step 3. `press_tick` is the tick on which B last went from released to held, 0 before any press. A destroyed minion's position and heading are 0 until it respawns, and a live minion's respawn countdown is 0. [R4.3-5]

### 4.4 Tick order

- **Tick numbering.** Ticks are numbered from 0 within each level. A level with a time limit of T ticks runs at most ticks 0 to T − 1. [R4.4-1]
- **Periodic movement.** An entity with a move period of N moves on the ticks where `tick % N == 0`. The phase is global and never resets. [R4.4-2]
- **Order.** The order of steps is part of the rules: a different order is a different game. [R4.4-3]
- **Ending a level.** The level ends at the first step where an end condition occurs ([§4.10](#410-end-of-level)), and the remaining steps don't run on that tick. [R4.4-4]

Once per tick, in this order: [R4.4-5]

1. **Input.** A journal event at this tick replaces the current input mask ([§6](#6-input-journal-and-byte-formats)). [R4.4-6]
2. **Commit.** If X is pressed, the level ends. An unfinished cut is discarded: its trail is erased, the player returns to the cut start and stops cutting, and nothing is captured. [R4.4-7]
3. **Player.** The player moves 0, 1 or 2 sub-steps ([§4.5](#45-player)). A cut that reaches `CLAIMED` captures at once ([§4.8](#48-capture)), and the player moves no further this tick. If the capture brings the claim to the level's target, the level is cleared. [R4.4-8]
4. **Boss.** The boss moves ([§4.6](#46-boss)). If it bumps into `TRAIL`, the player is hit. [R4.4-9]
5. **Minions.** The minions move, in index order ([§4.7](#47-minions)). Respawn countdowns also tick down here. [R4.4-10]
6. **Collisions.** The tick's hits are resolved ([§4.9](#49-hits-lives-and-respawn)). [R4.4-11]
7. **Time.** If this was tick T − 1, the level ends. [R4.4-12]

### 4.5 Player

- **Initial state.** At level start the player stands on cell (30, 59), which level validity keeps a rail cell ([§5](#5-levels)), with the level's lives, 1 shield charge, invulnerability 0, previous direction none, not cutting, cut start (30, 59), and `press_tick` 0. [PIN-01]
- **Direction.** The direction is resolved on every tick, whether or not the player moves. If the direction resolved on the previous tick is still held, keep it. Otherwise take the first held direction in the order up, down, left, right. If none is held, the direction is none, and the player stands still. The draft doesn't say what happens when two directions are held, but a 5-way joystick reports two at once while rolling from one direction to the next. [R4.5-1]
  - A move that doesn't happen (onto the own trail, onto the boss's body, or off the rail) still keeps the resolved direction as the previous direction. [PIN-05]
- **On the rail,** the player moves only from rail cell to rail cell *(D3)*. Stepping into `EMPTY` starts a cut: the cell the player leaves becomes the **cut start**, and every `EMPTY` cell entered becomes `TRAIL`. [R4.5-2]
- **Off the rail.** A capture can leave the player's own cell off the rail, for example when a cut closes into a pocket next to an obstacle. While off the rail, the player may step onto any `CLAIMED` cell, until back on the rail. [R4.5-3]
- **Own trail.** The player cannot step onto `TRAIL`; the move is ignored *(D4)*. The draft only forbids moving backward, which is one case of this rule. [R4.5-4]
- **Closing a cut.** Stepping from `TRAIL` onto `CLAIMED` completes the cut and triggers a capture: from that sub-step on, the player is no longer cutting. That cell is a rail cell at that moment, though the capture can take it off the rail (see "Off the rail" above). [R4.5-5]
- **Fast cut (A).** If the player is cutting at the start of the tick and A is held, the player takes two sub-steps. On the rail, speed stays normal. [R4.5-6]
  - If sub-step 1 is blocked by the own trail, hits the boss's body, or closes the cut, there is no sub-step 2. [PIN-04]
- **Slow shield (B).** While B is held, the player moves only on the ticks where `(tick − press_tick) % 2 == 0`. `press_tick` is the tick on which B went from released to held. If A and B are both held, B wins. [R4.5-7]
  - When the journal's event at tick 0 holds B, `press_tick` is 0. [PIN-03]
- **Stopping mid-cut** is allowed: there is no *Qix*-style fuse *(D4)*. [R4.5-8]

### 4.6 Boss

The boss is a square body of B × B cells *(D9)*, closer to *Volfied* than the draft's single cell. B is set per level ([§5](#5-levels)); its position (x, y) is the top-left cell of the body. The body only ever covers `EMPTY` cells. [R4.6-1]

The boss moves one axis at a time, testing the whole leading edge of its body, and inverts the velocity component that hits something: [R4.6-2]

```text
# [R4.6-3]
if the boss moves this tick:
    edge = the B cells of column x + B (if vx = +1) or x − 1 (if vx = −1), rows y to y + B − 1
    if any edge cell is CLAIMED or TRAIL:  vx = -vx;  if any is TRAIL: the player is hit
    else:                                  x = x + vx
    edge = the B cells of row y + B (if vy = +1) or y − 1 (if vy = −1), columns x to x + B − 1
                                           # uses the x just computed
    if any edge cell is CLAIMED or TRAIL:  vy = -vy;  if any is TRAIL: the player is hit
    else:                                  y = y + vy
```

The edge cells always exist: the body stays inside the border, which is `CLAIMED`. With B = 1 the procedure tests single cells. [R4.6-4]

The draft tests `grid[next_x][y]` and `grid[x][next_y]` from the same starting cell, then moves diagonally. That puts the boss inside a wall in two cases: <!-- rationale -->

- **Outside corner:** both side cells are open but the diagonal cell is solid. <!-- rationale -->
- **Corridor as wide as the boss:** after flipping, the new direction points into the opposite wall. <!-- rationale -->

Testing one axis at a time, with the second test made after the first move, never enters a solid cell and needs no special cases. This is how the Xonix reference moves its enemies ([§11](#11-reference-implementations)). A quick simulation (not committed) ran bodies with B = 2, 3, 5 and 7 for 3,000 ticks on 232 random boards, and no body ever covered a cell that wasn't `EMPTY`. <!-- rationale -->

The draft starts the boss at (30, 30). Here the level defines a spawn area, the set of cells where the body's top-left cell may start. The level seed picks the start position inside it and the diagonal direction ([§6.4](#64-seeds-and-commitments)). [R4.6-5]

**Seeded deflections** *(D14)*. The level seed keeps steering the boss through the level, so that no two runs share a game ([§7.4](#74-bots)). On each tick the boss moves, a draw computed from the level seed and the tick may invert vx or vy, before the first edge test of R4.6-3. [R4.6-6]

```text
# [R4.6-7]
at level start:
    key = the big-endian u32 of level seed bytes 5 to 8     # byte 5 is the most significant
if the boss moves this tick, before the first edge test of R4.6-3:
    r = fmix32(key XOR tick) >> 26         # tick (R4.4-1) as a u32; r is 0 to 63
    if r = 0:  vx = -vx
    if r = 1:  vy = -vy
```

`fmix32` is the 32-bit finalizer of MurmurHash3. Every value in it is a u32, `>>` shifts right and fills with zeros, and a multiplication keeps the low 32 bits of the product: [R4.6-8]

```text
# [R4.6-9]
fmix32(h):
    h = h XOR (h >> 16)
    h = (h × 0x85ebca6b) mod 2^32
    h = h XOR (h >> 13)
    h = (h × 0xc2b2ae35) mod 2^32
    h = h XOR (h >> 16)
    return h
```

- **The edge tests are unchanged.** A deflection only inverts vx or vy, which stay ±1. It never sets a position and never skips a move. R4.6-3 then runs as written with the new velocity, so the body still only ever covers `EMPTY` cells. A deflection toward a blocked edge is undone by that edge's own test on the same move, and if that edge holds `TRAIL`, the player is hit, as with any bounce. [R4.6-10]
- **No state.** The draw is a pure function of the key and the tick, used only by R4.6-7, and a tick on which the boss doesn't move draws nothing. The key is a constant of the level, derived from the level seed like the boss start. It is not boss state, and it is not in the state hash ([§6.4](#64-seeds-and-commitments)). [R4.6-11]
- **Divergence** *(D14)*. Two level seeds with the same bytes 0 to 4, so the same boss start and direction, but different keys give boss trajectories, the (x, y, vx, vy) after each move, that part at the first move on which their draws differ in effect, on any board and journal they share. For two different random keys, that move comes by the boss's 400th move (N = 400) except with probability about 1.1 × 10^−11, that is by tick 399 × the move period in a level that lasts that long. M1.5's property test checks N = 400 on seed pairs whose bytes 5 to 8 are drawn at random and differ. [R4.6-12]
- **Why it diverges on any board.** Two bosses that share a board and a journal move alike until the first move on which their draws differ in effect: one draw is 0 or 1 and the other is not, or one is 0 and the other 1. On that move, one boss tests the opposite edge of one axis from the other. Whatever the two edges hold, the bosses leave that axis with a different coordinate or a different velocity component, and the other axis's test changes neither. <!-- rationale -->
- **Why 400.** For two different random keys, the draws of a move differ in effect with probability q = 1 − (62/64)^2 − 2 × (1/64)^2 ≈ 0.061, independently from move to move, so a pair agrees on its first 400 moves with probability (1 − q)^400 ≈ 1.1 × 10^−11. A throwaway prototype for M1.18 measured a median of 12 moves and a maximum of 248 over 6,000,000 key pairs at move periods 1 to 6, and no unsafe body on 5,000 random boards × 2,700 ticks for each B from 2 to 8. <!-- rationale -->
- **Limits of N.** Two equal keys never part; two keccak256-derived seeds share a key with probability 2^−32. Keys that differ only in their low 12 bits diverge about half as fast (up to 433 moves measured); two such seeds give such keys with probability 2^−20. A level with move period 7 or more has fewer than 400 boss moves, and two of its runs still end on the same trajectory with probability 6 × 10^−10 at period 8 and 2 × 10^−5 at period 16. M1.5's test therefore draws two different random values for bytes 5 to 8 and uses move periods 1 to 6. <!-- rationale -->
- **Why fmix32.** It is a bijection on u32 in which each input bit flips each output bit with probability close to 1/2, for two multiplications per move. With no generator state, the draw for any tick stands alone, and every key, 0 included, is valid. <!-- rationale -->
- **Play.** A deflection is a quarter turn, as if the boss bounced off an invisible wall, and comes on 1 move in 32: about 42 times in a 2,700-tick level at move period 2. Without deflections, the boss repeats one closed loop for a given start and direction, and on the open-field level three quarters of the interior is never under its body: a safe zone that a player or a bot could learn. With them, the body passes over 95% of the interior. <!-- rationale -->

### 4.7 Minions

- **Movement.** Minions walk on rail cells only, one cell per move. [R4.7-1]
- **Right-hand rule** (from the draft). A minion tries to turn right, then to go straight, then to turn left, then to turn back, and takes the first direction whose target is a rail cell. [R4.7-2]
  - A minion with no direction leading to a rail cell, for example on a one-cell obstacle, stays in place and keeps its heading. [PIN-18]
- **Orientation.** At spawn, at respawn and after every capture, a minion turns to the first heading, in the order N, E, S, W, that has open field (`EMPTY` or `TRAIL`) on its right and a rail cell ahead. If no heading qualifies, it keeps its current heading. With the field on their right, minions circle it clockwise. [R4.7-3]
  - For a tested heading h, "ahead" is the 4-neighbor of the minion's cell in direction h, and "on its right" is its 4-neighbor a quarter turn clockwise from h: E for N, S for E, W for S, N for W. [PIN-06]
  - At level start and at every respawn, a minion's heading is set to N just before its orientation step, so a minion for which no heading qualifies faces N. A destroyed minion keeps no heading. Every minion runs the orientation step at level start. [PIN-16]
- **Known gap** *(D7)*. Where the rail is two cells thick (2-wide peninsulas, junctions), a minion whose right side faces the band instead of the field circles a 2×2 block forever. A quick simulation on random boards (not committed) measured this: <!-- rationale -->
  - with random starting headings, the draft's rule trapped minions in about 2% of runs; <!-- rationale -->
  - with the orientation step, about 0.15% of runs were still trapped. <!-- rationale -->

  The orientation step helps but is not a guarantee. M1 must either prove the rule with the coverage property below or replace it, for example with contour tracing of the field's boundary. <!-- rationale -->
- **Coverage property** *(D7)*, which M1's property test checks. [PIN-14]
  - Let C be the 4-connected component of rail cells that contains the minion's cell. Its target cells are all the cells of C, the border corners and other cells that touch open field only diagonally included. [R4.7-4]
  - After its spawn and after each capture, while the rail stays unchanged, a minion is **trapped** if its (cell, heading) state repeats before it has visited every cell of C. [R4.7-5]
  - There are at most 4 × |C| states, so this is the same as coverage being incomplete after 4 × |C| moves. [R4.7-6]
- **Stranded minions** *(D7)*, a case the draft doesn't cover: after a capture, a minion whose cell is no longer on the rail is destroyed, and respawns later as the lifecycle below defines. It respawns, oriented, at its spawn cell, or at the first rail cell in row-major order if the spawn is no longer on the rail. [R4.7-7]
- **Lifecycle,** step by step. [PIN-17]
  - At a capture (step 3), each live minion whose cell is no longer a rail cell is destroyed, with its countdown set to R. Every other live minion runs the orientation step. [R4.7-8]
  - At step 5, minions are processed in index order. A destroyed minion's countdown drops by one, from the tick of its destruction on. At zero, the minion respawns, oriented, and does not move on that tick: a minion destroyed at tick t respawns at step 5 of tick t + R − 1. [R4.7-9]
  - A live minion moves when `tick % period == 0`. [R4.7-10]
  - A respawn cell always exists: the boss's body is always on `EMPTY` cells, so the rail is never empty. [R4.7-11]

### 4.8 Capture

When a cut reaches `CLAIMED`: [R4.8-1]

1. Mark every cell of the boss's body `BOSS_ZONE` and push it on a stack. With several bosses, do this for each one. [R4.8-2]
2. Pop a cell. Mark each of its 4 neighbors that is `EMPTY` as `BOSS_ZONE`, and push it. Repeat until the stack is empty. `TRAIL` and `CLAIMED` stop the fill, so the trail acts as a wall. [R4.8-3]
3. Make one pass over all 3,600 cells: `BOSS_ZONE` becomes `EMPTY`, and `EMPTY` and `TRAIL` become `CLAIMED`. The number of cells that became `CLAIMED` is the capture size. [R4.8-4]

Why this procedure: <!-- rationale -->

- **No recursion.** A cell is marked when it is pushed, not when it is popped, so it is pushed at most once. A static stack of 3,364 entries can therefore never overflow. A recursive fill needs up to 3,364 nested calls, far beyond the RP2040's small default stack. <!-- rationale -->
- **Visit order doesn't matter.** The result depends only on which `EMPTY` cells are 4-connected to the boss's body. A stack, a queue or a scanline fill all give the same grid. <!-- rationale -->
- **The boss's side stays open, as one region.** Since the boss moves one axis at a time, it cannot cross a gap that is only diagonal, so it never reaches a cell that the fill treats as a separate region. The fill may include pockets narrower than the body, which the boss can't physically enter. They stay open because they connect to the boss's side: as in *Qix* and *Volfied*, a capture takes the regions without the boss, not the cells the boss can't reach. <!-- rationale -->
- **One pass instead of three.** The draft's steps 3–5 (claim unreached cells, convert the trail, revert `BOSS_ZONE`) collapse into the single pass of step 3. <!-- rationale -->

### 4.9 Hits, lives and respawn

- **Hits.** The player is hit in these cases: [R4.9-1]
  - the boss bumps into `TRAIL`; [R4.9-2]
  - the player tries to step onto a cell of the boss's body. The move doesn't happen, so the body never covers the trail. [R4.9-3]
  - a minion meets the player at step 5: they share a cell, swap cells, or the minion stops on the cell a fast cut passed through, as the predicate below defines. [R4.9-4]

  Hits set a single flag for the tick, so several hits in one tick count as one. [R4.9-5]
- **Minion hits,** exactly. [PIN-15]
  - Let P0 be the player's cell at the start of step 3, and P1 … Pn the cells it actually entered at step 3, with n = 0, 1 or 2. [R4.9-6]
  - For each minion present after step 5, let a be its cell at the start of step 5 and b its cell at the end of step 5. a = b if it did not move; a = b = its respawn cell if it respawned this tick. A destroyed minion has no cell and cannot hit. [R4.9-7]
  - The minion hits the player if any of these holds: [R4.9-8]
    - **share:** b = Pn; [R4.9-9]
    - **swap:** a = Pk and b = Pk−1, for some k in 1 … n; [R4.9-10]
    - **pass:** b = Pk for some k in 1 … n − 1, the intermediate fast-cut cell. [R4.9-11]
  - When n ≥ 1, a minion that moves into P0 from any cell other than P1 does not hit: once the player has left P0, only the swap case can involve it. [R4.9-12]
  - A minion that respawns at step 5 onto the player's cell hits the player, by the share case. [PIN-11]
- **Resolution** (at step 6), in this order: [R4.9-13]
  1. If the player is invulnerable, nothing happens. [R4.9-14]
  2. Otherwise, if B is held and a shield charge is left, the charge is spent and nothing else happens *(D6)*. [R4.9-15]
  3. Otherwise, the player loses a life (see the next point). All its effects apply even to the last life; the level then ends at step 6 ([§4.10](#410-end-of-level)). [R4.9-16]
- **Losing a life.** The trail is erased. If the player is still cutting when the hit is resolved, they return to the cut start; otherwise, including after a cut closed at step 3 of the same tick, they stay in place. They are then invulnerable during the 30 ticks (2 s) after the hit tick, or until they start a cut, whichever comes first. Without that limit, invulnerability would be a window for a risk-free cut. [R4.9-17]
  - A life lost at tick h makes the player invulnerable on ticks h + 1 to h + 30 inclusive. Starting a cut ends that invulnerability at step 3 of that tick, before that tick's collisions. [PIN-02]
- **Respawn point.** The draft respawns the player at (30, 59). That stops working after the first capture along the bottom border: (30, 59) is no longer a rail cell, so a rail-bound player would be stuck there. The cut start, by contrast, is always a rail cell, because the rail only changes on capture. <!-- rationale -->

### 4.10 End of level

The first condition met ends the level, in tick-step order: [R4.10-1]

| Condition | Step | Result |
|---|---|---|
| X pressed | 2 | Committed: claim kept, unfinished cut discarded [R4.10-2] |
| `claim_bp` ≥ the level's target (default 7,500) | 3 | Cleared [PIN-10] |
| No lives left (default 3) | 6 | Over, and the level scores zero *(D5)* [R4.10-3] |
| Tick T − 1 processed (default T = 2,700, i.e. 3 min) | 7 | Over, claim kept [R4.10-4] |

- **X at tick 0.** If the event at tick 0 holds X, the level is committed with claim 0, and ticks used is 1. [PIN-07]
- **A clear wins the tick.** A clear at step 3 ends the level before that tick's hits are resolved. [PIN-09]

Scoring zero when the lives run out is what gives Commit its purpose: bank the claim, or risk it for more. <!-- rationale -->

**Ticks used** is t + 1 when the level ends during tick t, whatever the step that ends it: the number of ticks processed. The core computes the level score from the season's scoring parameters ([§8.4](#84-season-scoring)). [PIN-08]

## 5. Levels

A level is data, not code. The 16 built-in levels use this format, and so will Superchallenge maps if that mode comes back ([`TODO.md`](TODO.md)):

| Field | Meaning |
|---|---|
| Obstacles | Cells that start `CLAIMED` (a 3,600-bit bitmap, 450 bytes) |
| Boss | Body size B, the side of the square body (B = 2 to 8, default 5); spawn area, the cells where the body's top-left cell may start; move period |
| Minions | Count (0–3); spawn cells; move period; respawn delay R |
| Rules | Time limit (at most 2,700 ticks), lives, target claim. Defaults: 2,700 ticks, 3 lives, 7,500 bp. |

`level_id = keccak256(level bytes)`. Contracts store level ids, clients ship the level bytes, and the referee checks the bytes against the id.

**Level bytes v1** are 472 bytes, big-endian. The core reads them in this order and rejects the first broken rule with its code:

| Offset | Field | Type | Rule (code) |
|---|---|---|---|
| | whole level | 472 bytes | exactly 472 bytes (20) |
| 0 | version | u8 | 1 (21) |
| 1 | obstacle bitmap | 450 bytes | cell i = y × 60 + x is bit 7 − i % 8 of byte i / 8, so the first byte's high bit is cell (0, 0); a set bit is an obstacle; border bits must be 0 (22) |
| 451 | boss body size B | u8 | 2 to 8 *(D9)*; the level tool defaults to 5 (23) |
| 452 | boss spawn rectangle | 4 × u8: x0, y0, x1, y1 | the top-left cells the body may start on, inclusive. x0 ≤ x1 and y0 ≤ y1 (24). x0 ≥ 1, y0 ≥ 1, x1 ≤ 59 − B and y1 ≤ 59 − B, so the body stays inside the border; B is checked first, so 59 − B cannot underflow (25) |
| 456 | boss move period | u8 | at least 1 (26) |
| 457 | minion count | u8 | 0 to 3 (27) |
| 458 | minion spawns | 3 × (u8 x, u8 y) | the first `count` slots: both coordinates below 60 (28). The other slots: all zero (29) |
| 464 | minion move period | u8 | at least 1 with minions, 0 without (30) |
| 465 | respawn delay R | u16 | at least 1 with minions, 0 without (31) |
| 467 | time limit T | u16 | 1 to 2,700, the size of the static journal buffer ([§6.2](#62-events)) (32) |
| 469 | lives | u8 | at least 1 (33) |
| 470 | target | u16, basis points | 1 to 10,000 (34) |

The zero rules keep the bytes canonical, so a level has exactly one id.

**Validity.** After the bytes, the core checks the level itself, in this order. A valid level meets these conditions:

- the open area, the cells `EMPTY` at level start, is a single 4-connected region (35), of at least 1,682 cells, half of the 3,364-cell interior (36). An empty open area is not a region;
- from every cell of the boss spawn rectangle, the B × B body covers only open cells (37);
- the spawn of each of the first `count` minion slots is a rail cell (38);
- the player start (30, 59) is a rail cell (39).

**Worked example.** The **open-field level** is the reference level of the worked examples and of the `open-field-*` vectors: no obstacles, B = 5, spawn rectangle (20, 20) to (34, 34), boss move period 2, no minions, T = 2,700, 3 lives and a 7,500 bp target. Its bytes are `0x01`, then 450 zero bytes, then bytes 451 to 471 below. Obstacles at (29, 58), (30, 58) and (31, 58) set the low three bits of the bitmap byte printed below, whose level offset is one more, and leave the player start with no open neighbor. [`tools/xcheck/worked-examples.mjs`](tools/xcheck/worked-examples.mjs) prints these lines; validity 0 means valid:

```text
open-field level bytes 451-471: 0x051414222202000000000000000000000a8c031d4c
open-field level_id: 0x04e24fd698778a8dbcf62ab0c9ed0228d67be3ddd3aeb682f4a67a53410dacc9
open-field validity: 0
blocked-start bitmap byte 438: 0x07
blocked-start validity: 39
```

**The 16 levels** ramp up difficulty with the knobs in the table above: boss body size, boss and minion periods, minion count, obstacle layouts that create corridors, time limit and target. Each level gets a target clear rate for scripted playtest bots, the method ethblockdigger uses for balancing ([§10](#10-reuse-from-ethblockdigger)). The bots' completion data also seeds the scoring weights of the testnet seasons and of the first mainnet season ([§8.4](#84-season-scoring)).

**The level editor** in the browser produces level bytes, and the 16 levels are authored with it. The Superchallenge map generator is deferred with its mode.

## 6. Input journal and byte formats

### 6.1 Input mask

| Bit | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Input | Up | Down | Left | Right | A (fast cut) | B (shield) | X (commit) | Reserved, must be 0 |

Inputs are sampled once per tick, at the tick boundary. Sampling at 15 Hz also debounces the buttons, whose contacts bounce for a few milliseconds.

### 6.2 Events

- **Format.** An event is `(u16 tick, u8 mask)`, recorded only when the mask changes, as in the draft. A mask applies from its tick until the next event. Before the first event, the mask is 0, so every event must change the mask; a first event with mask 0 is invalid.
- **Capacity.** Ticks strictly increase, so a level has at most one event per tick. Time limits are capped at 2,700 ticks ([§5](#5-levels)), so a static array of 2,700 events (8,100 bytes) can never overflow. This replaces the "dynamic array" that the draft's Phase 2 asks for, which contradicts the draft's own no-heap rule.
- **Single input path.** The core reads the journal, never the raw inputs: inputs → journal → core, on every target. The device and the referee therefore run on identical inputs by construction.

### 6.3 Journal bytes (v1)

The encoding is big-endian and fixed-width: a 71-byte header, then 3 bytes per event.

```text
u8       version       1: the format version
u16      rulesVersion  the core's RULES_VERSION the journal was played under
u8       mode          0 training · 1 challenge · 2 reserved (superchallenge)
bytes32  runNonce      from the chain in paid modes; any value in training
bytes32  levelId       keccak256 of the level bytes
u8       levelIndex    position of the level in the run
u16      eventCount
eventCount × (u16 tick, u8 mask)
```

**Rules version.** `RULES_VERSION` starts at 1 [PIN-13]. It is bumped on every behavior change: a change that alters the outcome, error code or trace of a committed vector, or that implements an edit to §4-§6 rule text made after the rule was first implemented. Implementing a frozen rule for the first time is not a behavior change. Each season names the rules version it accepts, and the referee rejects any other, so a journal is always replayed under the rules it was played with.

**Decoding.** The decoder rejects what the bytes alone show. It checks in this order and returns the first broken rule's code:

1. fewer than 71 bytes: truncated (1);
2. `version` other than 1 (3);
3. `rulesVersion` other than the core's `RULES_VERSION` (4);
4. `mode` 2 or above (5): unknown modes, and
   - mode 2, reserved for Superchallenge: v1 decoders reject it until that mode returns [PIN-12];
5. `levelIndex` 6 or above (6);
6. `eventCount` above 2,700 (7);
7. fewer than 71 + 3 × `eventCount` bytes: truncated (1); more: trailing bytes (2);
8. the events, one at a time in journal order. For each event, the first of these rules it breaks: a tick of 2,700 or more (8), a tick not above the previous event's (9), reserved bit 7 set (10), a mask equal to the previous one, which is 0 before the first event (11).

**Replay** knows the level. Before play, it checks in this order and returns the first broken rule's code: the journal, as above (1 to 11); the level bytes and the level's validity, in the order of [§5](#5-levels) (20 to 39); a `levelId` other than keccak256 of the level bytes (12); an event at or after the level's time limit (13). Then it plays the level. After play, it rejects an event after the tick on which the level ended (14).

**Worked example.** The journal of `open-field-empty`, a training run of the open-field level at `levelIndex` 0 with no events, played under the worked-example `runNonce` of [§6.4](#64-seeds-and-commitments):

```text
open-field-empty journal: 0x01000100277b9e3cebd776c6d46a8b4eb9b83ac165961f4b46a79baef5df1514bb5219cd04e24fd698778a8dbcf62ab0c9ed0228d67be3ddd3aeb682f4a67a53410dacc9000000
```

**No struct dumps.** Never serialize an event as a C struct: padding makes `struct { uint16_t tick; uint8_t mask; }` 4 bytes long, not 3.

**Absolute ticks.** The draft's State Mapper prompt suggests packing tick deltas. This format keeps absolute ticks, which make decoding trivial, and a full journal is at most about 8 KB. Revisit only if calldata cost matters.

### 6.4 Seeds and commitments

- **Level seed:** `keccak256("jiro.level" ‖ runNonce ‖ levelIndex)`.
  - **What it decides.** The boss's start position (its body's top-left cell) inside the level's spawn rectangle, the boss's diagonal direction, and the key of the boss's deflections, which keep steering the boss through the whole level, so that no two runs share a game *(D14)* ([§4.6](#46-boss)). Minions start at their level-defined spawn cells, with headings from the orientation step ([§4.7](#47-minions)).
  - **Boss start.** The candidates are the cells of the spawn rectangle in row-major order: y from y0 to y1, and within each row x from x0 to x1. Validity ensures the body covers only `EMPTY` cells at any of them. With index = the big-endian u32 of seed bytes 0 to 3, modulo the number of candidates, the start is candidate number index, counting from 0. vx = +1 if bit 0 of seed byte 4 is set, otherwise −1; vy is the same, from bit 1. There are at most 57 × 57 = 3,249 candidates, under 2^12, so the modulo bias stays below 2^12 / 2^32 = 2^−20.
  - **Deflection key** *(D14)*. The big-endian u32 of seed bytes 5 to 8, byte 5 the most significant ([§4.6](#46-boss), R4.6-7). Bits 2 to 7 of byte 4 and bytes 9 to 31 are unused.
  - **Once per level.** keccak256 runs once per level, never per tick. Any randomness during play comes from an integer PRNG seeded from the level seed *(D14)*: the boss's deflection draw, fmix32(key XOR tick) with 32-bit wrapping multiplications ([§4.6](#46-boss), R4.6-7 to R4.6-9). It keeps no state.
  - **Packing.** Every derivation in this section packs its inputs as Solidity's `abi.encodePacked` would: tags as ASCII bytes, `bytes32` values such as `runNonce` as 32 bytes, `levelIndex` as one byte, and `runId` as a 32-byte `uint256`.
  - **Domain tags.** Every tagged derivation (level seed, run nonce, draw) has its own tag, so two of them never share an input.
- **Run nonce** (Challenge): `keccak256("jiro.run" ‖ entropy ‖ runId)`, where `entropy` is the `bytes32` that the entropy source returns for the run ([§7.2](#72-run-flow)) and `runId` is the run's `uint256` id. Only the `Challenge` contract computes it, when the player reveals the run. The core takes `runNonce` as an input and never derives it.
- **The chain chooses the seed** in paid modes ([§7.2](#72-run-flow)), never the client. Otherwise a player could try seeds offline until the spawns were easy.
- **Run commitment** (Challenge): `keccak256(keccak256(journal₀) ‖ … ‖ keccak256(journal₅))`. `Challenge` computes it from the six journals at commit ([§7.2](#72-run-flow)). Settlement checks the journals against it, for the whole run at once or one level at a time.
- **State hash** (tests and debugging): keccak256 over a fixed-order, fixed-width serialization of the whole state: tick, grid at 2 bits per cell, player, boss, minions, counters. Version 1 is the 948-byte preimage below.
- **Settlement submits the level bytes and the journals,** plus a proof on zk ([§7.2](#72-run-flow)). The weights come from the season. The seed is never submitted, because the chain already has the run nonce, and neither is the score, because the referee computes it. The draft's Phase 6 submits seed, score, claim and events; a score or claim may still travel along for display, offchain and never in a contract call, but nothing trusts it.

The draft also asks for a C++ PRNG that matches "the state-transition hashing logic of keccak256" in Solidity. With one core, and keccak used only to derive seeds, there is no second implementation to match.

**State hash v1.** The core records keccak256 of this preimage after every processed tick, the ending tick included. Fields follow the order of [§4.3](#43-entities), at fixed widths, big-endian:

| Bytes | Field | Encoding |
|---|---|---|
| 1 | version | 1 |
| 2 | tick | u16, the tick just processed |
| 1 | input mask | u8, the mask in force on that tick ([§6.1](#61-input-mask)) |
| 900 | grid | 2 bits per cell: cell i is in byte i / 4, its value's high bit at bit 7 − 2 × (i % 4) |
| 2 | player position | u8 x, u8 y |
| 1 | cutting | u8, 1 if cutting, else 0 |
| 2 | cut start | u8 x, u8 y |
| 1 | lives | u8 |
| 1 | shield charges | u8 |
| 1 | invulnerability ticks | u8 ([§4.3](#43-entities)) |
| 1 | previous direction | u8: 0 none, 1 up, 2 down, 3 left, 4 right; the direction resolved at this tick's step 3, unchanged on a tick that ends at step 2 |
| 2 | `press_tick` | u16 |
| 2 | boss position | u8 x, u8 y, the body's top-left cell |
| 1 | boss body size B | u8 |
| 2 | vx, vy | i8 each: +1 is `0x01`, −1 is `0xff` |
| 1 | boss move period | u8 |
| 21 | 3 minion slots of 7 bytes, in index order | u8 presence (0 unused slot, 1 live, 2 destroyed), u8 x, u8 y, u8 heading (0 N, 1 E, 2 S, 3 W), u8 move period, u16 respawn countdown. An unused slot is all zero. |
| 2 | captured cells | u16, cells captured so far in the level |
| 2 | claimable cells | u16 ([§4.1](#41-grid)) |
| 2 | next event index | u16, the index of the first journal event not yet applied |

The preimage is 948 bytes in all. The deflection key ([§4.6](#46-boss)) is not in it: like the boss start, it is a function of the level seed, and a deflection leaves nothing behind but the boss's velocity.

**Worked examples.** The examples use `runNonce` = keccak256(`"jiro.example.9"`), chosen so that the draw of [§8.2](#82-challenge-000005-eth-per-run) both keeps a card in place and revisits a swapped position. For the open-field level ([§5](#5-levels)) at `levelIndex` 0, the seed, the boss start, and the state after tick 0 of `open-field-empty` are:

```text
runNonce: 0x277b9e3cebd776c6d46a8b4eb9b83ac165961f4b46a79baef5df1514bb5219cd
level seed (levelIndex 0): 0x3747fcd23494676303f1ee35d499ae727c0d8e373f013491d394bd9fcaacd7d7
boss start: candidates 225, index 33, top-left (23, 22), vx -1, vy -1
boss start (levelIndex 2): candidates 225, index 180, top-left (20, 32), vx +1, vy -1
boss start (spawn rectangle (20, 20) to (34, 25)): candidates 90, index 78, top-left (23, 25), vx -1, vy -1
deflection key (levelIndex 0): 0x94676303
fmix32 test values: fmix32(0x00000000) 0x00000000, fmix32(0x00000001) 0x514e28b7, fmix32(0xffffffff) 0x81f16f39
open-field-empty tick 0 boss: top-left (22, 21), vx -1, vy -1
open-field-empty tick 0 preimage length: 948
open-field-empty tick 0 state hash: 0xc9775c491d677d941c3ac733e1b47b51a64024cb4da22f9c05ceea58d93c76d1
open-field-empty tick 0 deflection draw: fmix32(0x94676303) 0x5cb2ceac, r 23, no deflection
open-field-empty first deflection: tick 82, r 1 inverts vy; boss after the move: top-left (20, 19), vx +1, vy -1
open-field-empty second deflection: tick 140, r 0 inverts vx; boss after the move: top-left (47, 11), vx -1, vy +1
open-field-empty boss after tick 2699: top-left (3, 18), vx +1, vy -1, after 43 deflections
```

The second and third lines check the bit order of seed byte 4 and the row-major order of a non-square rectangle. On tick 0 the boss moves (0 % 2 = 0) one step diagonally, from its start to the `tick 0 boss` position, and the player stands still. The tick-0 deflection draw is 23, neither 0 nor 1, so the boss doesn't deflect on tick 0. With the player standing still for the whole level, the boss first deflects on tick 82, then on tick 140, and 43 times in all by the last tick, 2,699.

The run nonce of run 1, with the entropy keccak256(`"jiro.example.entropy"`):

```text
run nonce entropy: 0xdf60591bfe4f361c147f862a9a94eb17a8a7288bfc32fe85e746df6da70babd8
run nonce (runId 1): 0xde7b230b4cdb45439578e3b94628bb69f470fd84bf8424e123e8db198378fbd8
```

### 6.5 Device-to-browser link

The Pico has no network, but it is powered over USB anyway, so USB is the link:

- **Transport:** CDC serial on the Pico, the Web Serial API in the dApp. Web Serial works in desktop Chrome and Edge, not in Firefox or Safari.
- **Down:** the dApp sends the level bytes and the run nonce.
- **Up:** the Pico streams journal events as they happen.
- **Commit:** the dApp commits the six journals as soon as the run ends, and the contract derives the run commitment from them ([§6.4](#64-seeds-and-commitments), [§7.2](#72-run-flow)).

This has to happen live: the commit deadline counts the time the journals actually took to play ([§7.2](#72-run-flow)), so a journal cannot wait for a later sync.

### 6.6 Vector files

Golden vectors live in `vectors/`, one JSON file per vector, and every target must reproduce them. Each vector file has a `kind` key. Byte strings are lowercase hex with a `0x` prefix, and error codes are those of [§5](#5-levels) and [§6.3](#63-journal-bytes-v1).

- **`journal`** (`vectors/format/journal-*.json`): `name`, `input`, and either `reencoded`, the decoded journal encoded again, or `error`.
- **`level`** (`vectors/format/level-*.json`): `name`, `input`, and either `levelId` and `reencoded`, or `error`.
- **`game`** (`vectors/game/*.json`, and the M4 gas-gate set in `vectors/levels/*.json`):
  - `name`, and `covers`, the README sections and rule tags it exercises;
  - the inputs: `rulesVersion`, `level`, `runNonce`, `levelIndex`, `mode`, `weightBp` and `journal`;
  - either `outcome`, the expected `Outcome` of [§7.3](#73-verification-cost) as an object whose keys are its eleven field names (`journalHash`, `levelId`, `runNonce`, `levelIndex`, `drawSlot`, `mode`, `rulesVersion`, `endReason`, `claimBp`, `ticksUsed`, `levelScore`), or `error`, the code replay returns;
  - `trace`, the file name of its trace, and `traceKeccak`, the keccak256 of that file.

  Integers, inside `outcome` and out, are JSON numbers.

A **trace** (`.trace`, binary) holds the 32-byte state hash of every processed tick, in tick order. A vector that replay rejects before play has an empty trace; one rejected after play (14) holds the hashes of the ticks it played. Derivation fixtures (level seeds, level ids, boss starts, draws, run commitments, and later run nonces and deadline cases) live in `vectors/derivations.json`, a single fixture file without a `kind` key.

**Diagnosis.** A target that disagrees with a vector reports the first tick whose hash differs. A target that can expose its state (native, wasm, the emulator) also prints its state-hash preimage at that tick. `jiro-tools replay --dump-tick <t> --diff <hex>` decodes that preimage, compares it with the native one, and names the fields that differ.

## 7. Verification and trust model

### 7.1 What verification proves

The referee replays (level, run nonce, journal) and computes the claim and score itself. That proves the journal produces the score. It does **not** prove that a human, or a Pico, produced the journal: any program can write a journal.

In paid modes, the Pico is therefore a controller and a screen, not a security device. A journal from the browser verifies exactly like one from the Pico. The RP2040 has no secure boot or attestation. An RP2350 (Pico 2) could sign journals with a device key, which would raise the bar for cheating without closing it.

### 7.2 Run flow

The flow is the same keyless one as ethblockdigger's `Vault`. It is split between two contracts: `Challenge` runs it, and `Season` holds the money and each season's parameters ([§8.4](#84-season-scoring)). Every step emits an event. Runs are numbered from 1 with a `uint256` `runId`, across all seasons, and a player may hold several runs at once.

1. **Pay.** `startRun(uint256 season)` is `payable`. It reverts unless `season` is the season accepting runs, so a run never lands in a season the player didn't choose. It also reverts unless `msg.value` equals that season's run fee exactly *(D12)*. The run belongs to that season, and its fee joins that season's pot for good. The payment also commits to entropy from an Arbitrum block 40 blocks ahead (`ArbBlockhashEntropy`).
2. **Reveal.** Once that block exists, usually 10 to 20 seconds later, the player calls `revealRun(runId)`. It derives the run nonce from the block's hash ([§6.4](#64-seeds-and-commitments)) and records `revealedAt = block.timestamp`. The hash did not exist when the player paid, so nobody can preview the levels and pay only for easy ones.
   - **Only the player reveals and commits:** the reveal starts the deadline clock, and the single commit fixes the run's journals.
   - **A lapsed reveal forfeits the run.** The hash stays readable for 256 blocks, about a minute at 0.25 s per block. After that, the run can never be revealed, and its fee stays in the pot. There is no re-anchor, which would move the run to a fresh entropy block and so give a free re-roll.
3. **Play and commit.** The player plays the six drawn levels ([§8.2](#82-challenge-000005-eth-per-run)), then calls `commitRun(runId, bytes[6] journals)` once, after the reveal, with the journals in `levelIndex` order. The contract computes the run commitment from them ([§6.4](#64-seeds-and-commitments)), and records it with `committedAt = block.timestamp`. It never parses the journals: they are in the call to publish them *(P5)*. Anyone can replay a committed run from the call's data, read from the transaction, or from its trace if a smart-account wallet made the call. The commitment proves that this data is what was committed.
   - **Deadline.** A run is on time if

     ```text
     committedAt ≤ revealedAt + (Σ ticksUsed + 14) / 15 + commitSlack
     ```

     The values are `uint64` seconds of `block.timestamp`, and the division is integer division. Σ ticksUsed sums the six levels' ticks used ([§4.10](#410-end-of-level)) and is at most 16,200. The playing time at 15 Hz is therefore rounded up to a whole second, and is at most 1,080 s. `commitSlack` is a season parameter that covers level transitions and transaction latency ([§8.4](#84-season-scoring)). For example, 5,432 ticks round up to 363 s:

     ```text
     deadline (revealedAt 1,000,000, ticks used 1 + 2,700 + 1,800 + 900 + 15 + 16, commitSlack 120): 1,000,483
     ```
   - **Checked at settlement.** The ticks used are known only once the journals are replayed, so the deadline is checked at settlement. At commit, the only time check is a bound: `commitRun` reverts if `block.timestamp > revealedAt + 1,080 + commitSlack`, when no run can be on time any more.
   - **Why the actual duration.** A fixed window, like ethblockdigger's 450 s, would give even an unmodified client every early-ending level's unused minutes for free. The player could replay a level whose seed they already know and commit the best attempt, or practice the next level before playing it for real.
     - With a deadline that follows the journals' own length, that time has to appear in the journals as ticks used. A player can still put it there, by idling instead of ending a level early, or with a client that writes the X later than it was pressed. The contract cannot tell idle ticks from play.
     - So the deadline bounds a run's wall time by the drawn levels' time limits plus `commitSlack`, at most 1,080 s plus `commitSlack`, and padding costs only the fewer-ticks tiebreak.
     - Fresh entropy per level ([§7.4](#74-bots)) would remove practice on later levels.
   - **Real-time play.** Inputs must therefore be produced within that time, which stops slow-motion play and long offline search after the reveal. Inputs prepared before the run are covered by D14 ([§7.4](#74-bots)).
   - **Closing a level early.** The client closes a level that has not ended but will not be played on: an unplayed or abandoned level, or one interrupted by a USB disconnect or a page reload. It appends one event, with mask `0x40` (X alone), at tick c = max(n, e + 1). Here n is the number of the level's ticks the client knows were processed, and e is the tick of the journal's last event, or −1 if there is none. An unplayed level therefore gets an X at tick 0 ([§4.10](#410-end-of-level)).
     - The client first replays the journal it holds through tick c − 1. If the level ends by then, the journal is complete as it is, and nothing is appended. This covers every c at or past the level's time limit T.
     - A closed level keeps its claim, and its ticks used, c + 1, follow the time actually spent. The time until the run resumes isn't counted, so it uses up `commitSlack`.
     - The contract cannot tell a closed level from a played one. Closing is how an honest client keeps its deadline.
4. **Settle,** only when money depends on the run ([§7.3](#73-verification-cost)). Anyone may submit a settlement, and the credit always goes to the run's player. Settlement submits the level bytes and the journals, plus a proof on zk; the weights come from the season. `settleRun(runId, bytes[6] levels, bytes[6] journals, bytes proof)` checks, in this order, and reverts on the first failure:
   1. the run is committed and not yet settled, and `block.timestamp ≤ end + grace` for the run's season;
   2. `keccak256(keccak256(journals[0]) ‖ … ‖ keccak256(journals[5]))` equals the commitment;
   3. each `keccak256(levels[i])` is one of the season's 16 `levelIds`. Its index there is the level's slot, `slot[i]`, and the season's `weightsBp[slot[i]]` is its weight, `weight[i]`;
   4. `verifyRun(levels, journals, weight, proof)`, on the referee of the run's season ([§7.3](#73-verification-cost)), returns six Outcomes;
   5. each Outcome i has `journalHash = keccak256(journals[i])`, `levelId = keccak256(levels[i])`, the run's `runNonce`, `levelIndex = i`, `mode = 1`, the season's `rulesVersion`, and `drawSlot = slot[i]`. This last check is the draw check *(P17)*: the contracts never compute the draw.

   Settlement then records the run:
   - its score, the sum of the six `levelScore` values, a `uint32`, at most 393,210;
   - its ticks, the sum of the six `ticksUsed` values, a `uint32`, at most 16,200;
   - its clears, the number of levels whose `endReason` is Cleared, a `uint8`.

   If the deadline is missed, the run is marked late for good, and earns nothing; this is a result, not a revert. Otherwise `Season` ranks the run ([§8.4](#84-season-scoring)). A settled or late run cannot be settled again.

   **Fallback: `settleLevel(runId, uint8 i, bytes32[6] journalHashes, bytes level, bytes journal, bytes proof)`**, for a run that does not fit in one transaction.
   - On every call, `keccak256(journalHashes[0] ‖ … ‖ journalHashes[5])` must equal the commitment, and `keccak256(journal)` must equal `journalHashes[i]`. The checks above then run for level i alone, through `verify`.
   - Each level settles once.
   - `settleRun` stays available after a partial `settleLevel`, so a third party cannot force the run onto the six-transaction path.
   - A run counts only once all six levels are settled, by `end + grace` inclusive.

### 7.3 Verification cost

The draft's gas skill asks for full replay verification under 1,000,000 gas. A replay written in Solidity can't meet that. A 3-minute level is 2,700 ticks, so 1M gas leaves about 370 gas per tick: a few dozen opcodes to cover the player, the boss, three minions and the collision checks. For scale, ethblockdigger's gas spike measured a synthetic Solidity tick of its tower-defense simulation (`contracts/src/spike/ReplayTickSpike.sol`) at 11.6k–54.6k gas, with 10 to 50 enemies. A Solidity referee would also be a second implementation of the rules, which the one-engine decision rules out ([§3](#3-architecture)).

So the verifier runs the Rust core itself, in one of two ways:

| Path | How it works | Cost | Status |
|---|---|---|---|
| **Stylus referee** | The core, compiled to wasm, is deployed as an Arbitrum Stylus contract that replays the journal. | Measured by ethblockdigger on Arbitrum Sepolia: 0.84M–3.25M gas per full replay of its heavier game, with games of up to 6 minutes ([`docs/DEPLOYMENT.md`](https://github.com/detychey/ethblockdigger/blob/main/docs/DEPLOYMENT.md) B2). A 3-minute Jiro level should land around or below the draft's 1M target. | New Stylus activations on Arbitrum One, Nova and Sepolia [are paused since 2026-10-02](https://cryptobriefing.com/arbitrum-pauses-new-stylus-activations/), with no reopening date announced |
| **zkVM proof** | The core, compiled to RISC-V, runs as the guest of a RISC-V zkVM (RISC Zero, SP1 or another), and a proof of the replay is verified onchain. | About 300k gas per verification, on any chain, and many proofs can be aggregated into one. Proving cost and latency are still to be measured. | Available |

**zkVM target: standard RISC-V.**

- **The target.** Most zkVMs prove RISC-V programs. The Ethereum Foundation's [zkVM standards v0](https://zkevm.ethereum.foundation/blog/zkevm-standards-v0-release) (February 2026) make RV64IM their common target, and eight zkVMs are working toward it. The core needs nothing beyond RV64IM: it uses integers only, no floats and no heap.
- **Thin wrappers.** Each zkVM still needs its own build, because memory layouts differ. So the core has no zkVM dependency, and each zkVM gets a thin guest wrapper: read the journal, replay it, commit the outcome. The prover stays replaceable behind the same verifier interface.
- **Choosing the zkVM: tooling first.** The framework is the one whose tooling the coding agent can rely on best. In practice, it must pass four checks:
  - it installs and runs in the agent's cloud environment;
  - it executes guests locally, with cycle counts and without a GPU;
  - it has a fast mock or dev mode for tests;
  - it has a verifier contract on Arbitrum, with Foundry test support.

  Among the frameworks that pass, measured cycles and price decide. If the best-tooled zkVM still targets 32-bit RISC-V, that's fine: the core builds unchanged for either width.
- **A naming clash.** Brevis's zkVM is also called Pico. In this repository, "Pico" always means the Raspberry Pi board.

**Agreed approach *(D2)*:**

1. **Measure first.** In M1, try two or three zkVMs hands-on, pick the one with the best tooling, and run the golden vectors in its executor. Executors run a guest without proving it, which yields cycle counts per level, and cycles set the proving cost. In M4, measure Stylus gas per level on a local Arbitrum node, which the public chains' pause shouldn't affect.
2. **Verify by exception.** Playing a run costs one commit transaction, whose calldata publishes the six journals *(P5)*, so anyone can replay them offchain for free. A run is verified onchain only when money depends on it, typically each player's best run of the season. Verifying every six-level run would cost on the order of its 0.00005 ETH entry fee, even on Stylus. The payout curve *(D10)* sets how many runs need verifying.
3. **One verifier interface,** `IReferee` (below), backed either by the Stylus referee or by a proof verifier. The money contracts don't change when the backend does.
4. **Stylus first, zk as the fallback.** If activations reopen, the Stylus referee needs no prover infrastructure. If they don't, each verified run gets a zk proof, and a season's proofs are aggregated so verification gas stays nearly constant.

The draft's 1M-gas figure stays as the M4 gate, applied per level on Stylus rather than to a whole game in Solidity. The approach is also the draft's "optimistic" model in its simplest form: nothing is verified until money depends on it, and then it is proven rather than disputed.

**The verifier interface** *(P4)*. The draft's `verify(journal) → outcome` is not enough: the referee also needs the level bytes, because a journal carries only the level id, and the level's weight, because the core computes the score ([§8.4](#84-season-scoring)). It returns the decoded header fields and the draw slot, so the contracts never parse journal bytes or recompute the draw.

```solidity
struct Outcome {
    bytes32 journalHash;  // keccak256 of the journal bytes
    bytes32 levelId;      // the header's levelId, which replay checks against the level bytes
    bytes32 runNonce;     // from the header
    uint8 levelIndex;     // from the header
    uint8 drawSlot;       // draw(runNonce)[levelIndex] (§8.2), computed by the core
    uint8 mode;           // from the header
    uint16 rulesVersion;  // from the header
    uint8 endReason;      // 1 Committed, 2 Cleared, 3 out of lives, 4 time limit (§4.10)
    uint16 claimBp;       // claim_bp when the level ended
    uint16 ticksUsed;     // §4.10
    uint32 levelScore;    // claimBp × weightBp / 10_000, rounded down; 0 if endReason is 3
}

interface IReferee {
    function verifyRun(bytes[6] calldata levels, bytes[6] calldata journals,
        uint16[6] calldata weightsBp, bytes calldata proof)
        external view returns (Outcome[6] memory);
    function verify(bytes calldata level, bytes calldata journal, uint16 weightBp,
        bytes calldata proof) external view returns (Outcome memory);
    function rulesVersion() external view returns (uint16);
}
```

- **Rejections revert.** Every function is `view`, and no Outcome is ever returned for a journal or a level that replay rejects ([§6.3](#63-journal-bytes-v1)).
  - On Stylus, the call reverts with replay's error code. On zk, no valid proof can exist, so the call reverts on the proof.
  - A revert records nothing. A settlement that failed on what the settler submitted, such as wrong level bytes or a bad proof, can therefore be submitted again.
  - Replay is deterministic, so a run whose committed journal replay rejects can never settle, and its fee stays in the pot.
- **Independent replays.** `verifyRun` replays its six levels in order, each as `verify` would, with no check across them. Binding the six to one run is the contract's job ([§7.2](#72-run-flow)).
- **`proof`** is empty on Stylus, where a non-empty proof reverts. On zk it carries the proof, whose public values bind keccak256 of each level and journal, each weight and each Outcome. M4.8 of the [plan](IMPLEMENTATION_PLAN.md) fixes their byte encoding.
- **`rulesVersion()`** is the core's `RULES_VERSION`. A season accepts only a referee that reports the season's rules version ([§8.4](#84-season-scoring)).

**Settlement shape** *(P16)*. A run settles in one transaction, `settleRun`, which calls `verifyRun` once.
- **On Stylus,** the referee replays the six levels in that one transaction. Six replays at the 1M-gas gate fit well within Arbitrum's cap of 32M L2 gas per transaction. A full `settleRun`, with about 53 KB of calldata, also fits within the sequencer's 95,000-byte transaction size limit.
- **On zk,** one guest execution replays the six levels and commits six Outcomes, so each verified run gets one proof, as point 4 above says. To fit within that size limit, the proof must be wrapped: compressed into the small SNARK that the frameworks' onchain verifiers check.
- **Fallback.** `settleLevel` settles one level per transaction, for a run that does not fit in one.
- **Later.** Season aggregation is measured in M4.8 and decided with D2 in M4.9.

### 7.4 Bots

The game is deterministic and the simulation is tiny. Once the run nonce is revealed, a bot can search for strong inputs *within* the commit deadline, which only stops slow search. ethblockdigger reached the same conclusion: nothing cryptographic stops a competent real-time bot.

**Copied and precomputed inputs** *(D14)*. If the seed chose only the boss's start cell and direction, a level would be one of at most 4 × 3,249 games: 900 on the open-field level. Committed journals are public, and so are the 16 levels. A bot could then reuse another run's events on a matching game, under its own header, or precompute strong inputs for every game before the season, and commit as soon as it reveals. Binding journals to their run stops the reuse of journal bytes, not of their events. So under D14, the level seed keeps driving the boss through the level, and no two runs share a game: it keys the boss's deflections ([§4.6](#46-boss), R4.6-6 to R4.6-12). Two runs with the same boss start and direction part after a median of 12 boss moves.

The levers are economic and social:

- an entry fee per run;
- qualification thresholds;
- public journals that anyone can replay and inspect;
- fresh entropy per level, the designed upgrade, so a bot cannot plan beyond the level it is playing.

**This is the main product risk of the paid modes.**

### 7.5 Later version: proving service

Planned on 2026-10-28 for a version after v1, and not scheduled ([§9](#9-roadmap)). In v1, whoever settles a run produces its proof. On Stylus there is no proof. On zk, players hand their run files to the operator before a cutoff, and the operator proves and settles them, on its own machines or through a hosted prover network on its own capped account ([`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) M4.8, M5.5). In the later version, a third-party proving service replaces that handoff. The player, or the dApp, sends the run file (run id, run nonce, level bytes, journals) to the service's API, and the service returns the proof and settles the run. Prover marketplaces such as Succinct's prover network and RISC Zero's Boundless already sell proofs this way. Neither the Pico nor the browser ever proves anything: proving needs gigabytes of memory, and ideally a GPU.

**The service is an untrusted prover, not an oracle.** An oracle's answer is believed; a proof is checked by the contract. So:

- **No new trust.** A proof only attests the outcome the journals actually produce, so a compromised service cannot mint prizes. The worst it can do is refuse or delay. The contracts never accept the service's signature or word in place of a proof: that is the oracle design ethblockdigger rejected, where one compromised key could pay out.
- **The payout goes to the run's player, whoever submits.** As in v1's settlement ([§7.2](#72-run-flow)), anyone may submit and the credit goes to the run's player: each outcome carries the run nonce and its journal hash, which settlement checks against the run's stored nonce and commitment. The service can therefore settle a run without being able to redirect the money. The same journal bytes fail in another run, because journals are bound to their run's nonce ([§6.4](#64-seeds-and-commitments)).
- **Gasless claims need a new `Season`.** v1's claim pays only its caller and takes no fee. For the service to claim on a player's behalf and keep a relay fee, a new `Season` generation adds a claim that pays the player's share minus a fee the player signed (EIP-712), and a relay-fee cap among the parameters each season commits at open. Without the player's signature, anyone could claim for any player and take the fee.
- **Someone pays for proving:** the player up front, the payout (through that signed claim), or the protocol (from the rake). Verify by exception still applies: only runs that money depends on need a proof ([§7.3](#73-verification-cost)).
- **The commit never waits for the service.** The dApp commits the run itself, as in v1 ([§7.2](#72-run-flow)), and the service only receives the run after the commit. Proving can happen any time before the season's end plus its settlement grace: days after the commit, for a run played early in the season.
- **Proving stays permissionless.** If the service refuses, the player, a second provider or the operator can produce the same proof.
- **Effect on the backend.** v1 can already use zk without running prover infrastructure, through the operator's hosted-prover account. The service takes the operator out of the loop: players no longer hand off run files before a cutoff, and proving is paid per run *(D2)*. The deciding number is the proving price per verified run, which M1 and M4 measure, against the payout it unlocks, which the testnet season shows (M5).
- **The device.** Nothing changes on the standard Pico: the journals still reach the dApp over USB, and the dApp commits them ([§6.5](#65-device-to-browser-link)). A Pico W or Pico 2 W could upload the run file to the service over Wi-Fi after the commit. Leaving the browser only to buy the run would need another contract change: v1's reveal and commit accept only the player, so the device would need a reveal and a commit signed by the player, or a session key the player registers.

**Unchanged:** determinism, the journal format, the one core, and the bot risk ([§7.4](#74-bots)). A proof shows that a score is reachable, not that a human played.

## 8. Game modes and economy

Amounts are in native ETH *(D12)*, and the contracts hold them in wei: 0.00005 ETH = `50_000_000_000_000` wei. Each season commits its fee when it opens ([§8.4](#84-season-scoring)), so the fee can follow the ETH price from one season to the next.

### 8.1 Training: free

All 16 levels, offline, on the Pico or in the browser. Scores stay local and no wallet is needed. Training uses the current season's rules and scoring, so practice carries over.

### 8.2 Challenge: 0.00005 ETH per run

- **Draw.** Six different levels out of the 16, drawn from the run nonce after payment by a forward partial Fisher–Yates shuffle. Only the core computes it:
  1. The deck is [0, 1, …, 15].
  2. For i = 0 to 5: j = i + (h mod (16 − i)), where h is `keccak256("jiro.draw" ‖ runNonce ‖ i)` read as a 256-bit big-endian unsigned integer, with `i` packed as one byte, so i ≤ j ≤ 15. Swap deck[i] and deck[j].
  3. The run's levels are deck[0] to deck[5]: the **draw slots**, indices into the season's 16 levels. The level at `levelIndex` k plays slot deck[k].

  With the worked-example `runNonce` of [§6.4](#64-seeds-and-commitments):

  ```text
  draw j: 1, 1, 10, 14, 12, 10
  draw slots: 1, 0, 10, 14, 12, 2
  ```

- **Draw check** *(P17)*. The contracts never compute the draw. The core returns each level's draw slot in its Outcome ([§7.3](#73-verification-cost)), and settlement checks that the season's level in that slot is the level that was played ([§7.2](#72-run-flow)). A Solidity copy of the draw would be a second implementation of a core procedure.
- **Score.** The run score is the sum of the six level scores ([§8.4](#84-season-scoring)).
- **Ranking** *(D10)*. Players are ranked by their best settled run of the season. Qualifying runs, those that cleared at least the season's `minClears` levels (1 by default), rank first. Among them, the higher score ranks first, and ties go to fewer ticks. Ranking by cumulative score would let spending buy rank, although best runs only limit a wallet's rank, not a player's (Sybils, below).
- **Rewards** *(D10)*. The players' pot is the season's run fees, minus a rake capped at 20 %, plus any rollover from earlier seasons that had no qualified points. It is shared pro-rata by best-run score among the qualified players, those with a qualifying settled run ([§8.4](#84-season-scoring)). ethblockdigger's `Season` has the same rake cap, rollover and pro-rata claims; it chose pro-rata because top-heavy payouts invite collusion when there are few players.
- **Sybils.** Fees are paid at run start, so every point costs money. But best runs are kept per wallet, and wallets are free. A player who plays each run from a new wallet has every run counted, as cumulative scoring would, and out-earns a one-wallet player of the same skill and spend. In a large season without rollover, a new wallet's run pays off once its score exceeds about the season's qualified points per paid run divided by (1 − rake): 1.25 times at a 20 % rake. This is an accepted residual, which `docs/ECONOMY.md` tracks; paying on every qualifying run instead would need every rewarded run verified.
- **Several runs at once.** A player may buy several runs, reveal them all, and play only the one with the best draw. Each attempt is paid, and only the best run counts, so this is a paid re-roll, accepted like any other extra run.

### 8.3 Superchallenge: deferred

Player-minted maps with bounties are deferred. The draft's design, its problems and a redesign proposal are kept in [`TODO.md`](TODO.md).

### 8.4 Season scoring

The draft adjusts the per-level scoring formula, which is based on completion, each season from what players actually achieved. To keep that fair:

- **Fixed for the season.** The season's parameters are published, versioned and committed onchain when the season opens, and never changed mid-season. Scores are only comparable within a season.
- **Computed, never claimed.** The core computes level scores; the client never claims one. `level_score = claim_bp × weight_bp / 10_000`, rounded down, and 0 when the lives ran out ([§4.10](#410-end-of-level)). `weight_bp` is the level's weight in basis points, a season parameter. A run's score is the sum of its six level scores, and ties go to the run that used fewer ticks.
- **Purpose: normalize difficulty,** so that the random six-level draw doesn't decide the ranking. For example, set the weights so that the median claim observed on each level is worth the same number of points. The input is the previous season's public journals; the first mainnet season uses playtest-bot data.
- **Testnet seasons** are named `testnet-N`. They take their weights from playtest-bot data, and their journals never feed mainnet weights.

**Season parameters.** `Season.open`, which only the operator may call, commits them, and nothing changes them afterwards. The operator is an address set in `Season`'s constructor. Each `Season` contract numbers its seasons from 1 (`uint256`), in the order `open` runs; season-file names such as `testnet-N` are labels, not these numbers. The season files under `seasons/` own the values; the proposals below are defaults.

| Parameter | Solidity type | Rule |
|---|---|---|
| `referee` | `IReferee` | the referee every run of the season settles through ([§7.3](#73-verification-cost)). `open` reverts unless `referee.rulesVersion()` equals `rulesVersion`, and records the referee's codehash, so players can check it against the reproducible build. |
| `rulesVersion` | `uint16` | the `RULES_VERSION` the season accepts ([§6.3](#63-journal-bytes-v1)) |
| `levelIds` | `bytes32[16]` | the 16 level ids, in draw-slot order ([§8.2](#82-challenge-000005-eth-per-run)): non-zero and all different. Each must be a valid level ([§5](#5-levels)). `open` cannot check that, so the operator checks it with the level tool before opening: a run that draws an invalid level could never settle. |
| `weightsBp` | `uint16[16]` | each slot's weight, at least 1 |
| `runFee` | `uint256` | the run fee in wei, above 0. 0.00005 ETH is `50_000_000_000_000` *(D12)*. No upper bound: the exact-fee rule shows a wrong fee to every player before they pay. |
| `rakeBp` | `uint16` | at most 2,000 (20 %) |
| `length` | `uint64` | seconds, from 1 s to 90 days (7,776,000 s). 14 days on testnet, apart from the 1-day `testnet-0` rehearsal *(D12)*. |
| `grace` | `uint64` | the settlement period after the end, in seconds, from 1 s to 30 days (2,592,000 s). Proposed: 48 h. A grace shorter than the reveal window plus 1,080 s plus `commitSlack` strands runs bought just before the end; only test seasons on a local node use one. |
| `commitSlack` | `uint64` | seconds, from 1 to 3,600. Proposed: 120 s, which is 60 s of transaction latency plus 6 × 10 s of level transitions. |
| `minClears` | `uint8` | the levels a run must clear to qualify, from 1 to 6. 1 by default *(D10)*. |

The upper bounds catch a typo in a season that nothing can pause or edit.

**Sequencing.**
- **Open.** `open(params)` takes the parameters above and returns the new season's number. A season starts when `open` runs, at `start = block.timestamp`, and ends at `end = start + length`. `open(s + 1)` requires `block.timestamp ≥ end(s)`, so a season overlaps only the grace periods of earlier seasons.
- **Runs.** Season s accepts runs while `start ≤ block.timestamp < end`. A run belongs to the season of its `startRun`: its fee joins that season's pot, and it settles through that season's referee, until `end + grace` inclusive ([§7.2](#72-run-flow)). A new rules version or a new backend therefore means a new season, and the runs of the previous season keep settling under their own rules.
- **Best runs** *(D10)*. For each player address, `Season` keeps the best settled, on-time run. It compares qualification first (a qualifying run beats one that doesn't), then the higher score, then fewer ticks; on a full tie, the run settled first stays. Anyone may settle any committed run, and the journals are public, so this order matters: settling another of a player's runs can never lower that player's payout. `Season` keeps `totalQualifiedPoints`, a `uint256`, the sum of the qualified players' best scores.
- **Close.** `closeSeason()` is callable by anyone once `block.timestamp > end + grace`, so it never overlaps settlement. Seasons close in order. Closing computes:
  - `rake = fees × rakeBp / 10_000`, rounded down, over the season's own run fees only, credited to the treasury;
  - `playersPot = fees − rake + rollover`, where `rollover` is the players' pot of earlier seasons that had no qualified points.

  If `totalQualifiedPoints` is 0, the whole `playersPot` rolls over to the next season to close, and is never raked again. Qualified players need the close before they can claim, which gives them a reason to call it, and the operator's scheduled season workflow calls it too.
- **Claims.** `claim(s)` pays a qualified caller `bestScore × playersPot / totalQualifiedPoints`, rounded down, once. It reverts for a season that rolled over, whose `totalQualifiedPoints` is 0. The rounding dust stays in the contract. Shares don't expire in v1.
- **Treasury.** `Season`'s constructor takes an immutable treasury address. `withdrawRake()`, which anyone may call, zeroes the rake credited so far, then sends it to the treasury. A treasury that rejects ETH therefore never blocks a close or a claim.
- **Custody.** `Season` holds all the ETH: `startRun` forwards each fee to it. Only `claim` and `withdrawRake` send ETH out of `Season`, both after their state changes (checks-effects-interactions). The solvency invariant: the balance covers the fees of the seasons not yet closed, the rollover, the rake not yet withdrawn, and the unclaimed players' pots of closed seasons.

## 9. Roadmap

The draft builds hardware first (its Phases 1–7). This roadmap puts the core and its test vectors first instead: they are the contract every other target is checked against, and a 240×240 screen with a flash cycle is the slowest place to debug game rules. Hardware bring-up (LCD and keys) can still run in parallel at any time.

[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) breaks these milestones into work items, one pull request each, with their dependencies, acceptance checks and the steps that need the owner.

| Milestone | Deliverable | Draft phases | Done when |
|---|---|---|---|
| **M0** Rules freeze | Close the open decisions. Freeze the tick order, journal v1, level format and validity thresholds, seed and draw procedures, state hash and commit slack. | none | No open decision blocks M1 |
| **M1** Core | Rust core: grid, player, boss, minions, capture, scoring, codec, seeds; golden vectors; property tests; a hands-on tooling trial of two or three zkVMs, and cycle counts per level in the one chosen | 3, 4, 5, and the codec half of 6 | Tests pass; vectors committed; zkVM chosen; cycle counts recorded |
| **M2** Browser | wasm build, canvas renderer, keyboard controls, replay viewer, level editor; the 16 levels, calibrated with bots; served at [jiro-ikusu.win](https://jiro-ikusu.win) | browser version, 16 levels | All 16 levels playable; bot clear rates on target |
| **M3** Pico | Firmware shell; vector run on the device | 1, 2 | Device state-hash traces match the native build |
| **M4** Referee and contracts | Stylus gas per level on a local node, then backend choice *(D2)*; the verifier interface; pay, reveal, commit and settle; Challenge contracts on Arbitrum Sepolia | the ABI half of 6, and 7 | A run settled end to end on testnet. A level verifies within 1M gas on Stylus, or the zk fallback's costs are measured. |
| **M5** dApp and season 1 | Wallet, Web Serial bridge to the Pico, Challenge UX, a testnet season | none | A full season closes and pays out on testnet |
| **M6** Superchallenge | Deferred, see [`TODO.md`](TODO.md) | none | Not scheduled |
| **Later** Proving service | A third-party service proves and settles runs through an API, with gasless claims ([§7.5](#75-later-version-proving-service)) | none | Not scheduled |

## 10. Reuse from ethblockdigger

[ethblockdigger](https://github.com/detychey/ethblockdigger) already solves most of this project's onchain problems. The draft names three things to reuse: $1 map mints, $0.01 plays, and the season and payout concepts. There is more:

| ethblockdigger component | Source | Use in Jiro-ikusu |
|---|---|---|
| Pay-then-reveal entropy | `contracts/src/ArbBlockhashEntropy.sol`, `contracts/src/interfaces/IEntropySource.sol` | Run nonces and map seeds |
| `Vault`: USDC ledger, solvency invariant, the start → reveal → commit → settle flow | `contracts/src/Vault.sol` | Challenge runs, paid in native ETH instead of USDC. ethblockdigger ties runs to the map owner and pays out the map's backing; Jiro runs are bought by any player and record a score. |
| `Season`: rake capped at 20%, empty-season rollover, pro-rata claims | `contracts/src/Season.sol` | Challenge seasons. Its points still come from an oracle-posted Merkle root. ethblockdigger plans to accrue points onchain instead; Jiro needs that from the start (best settled score per player). |
| `MapNFT` with an onchain-rendered `tokenURI` | `contracts/src/MapNFT.sol`, `referee/map-renderer` | Superchallenge maps, if that mode comes back ([`TODO.md`](TODO.md)) |
| Referee crate: `no_std` Rust core, Stylus `verify(bytes)`, pinned wasm build | `referee/core`, `referee/stylus`, `referee/build-wasm.sh` | Template for the Jiro core and referee |
| Determinism rules, strict input-log codec, conformance fixtures | `docs/DETERMINISM.md`, `src/sim/logCodec.ts`, `referee/core/src/codec.rs`, `src/sim/fixtures/replay` | Journal v1 and `vectors/` |
| Replay viewer ("the onchain bytes *are* the match") | `src/ui/ReplayPage.tsx`, `src/game/replayPlayer.ts` | Watching and auditing any settled run |
| Scripted playtest bots and balancing harness | `scripts/playtest.ts`, `src/sim/policies`, `balancing.md` | Level calibration and season 1 weights |
| Contract test harness (solc from npm, ethereumjs, vitest) and deployment tooling | `scripts/contracts/`, `docs/DEPLOYMENT.md` | Tests and deployments |
| Threat table and design-decision log | `docs/TOKENOMICS.md` §6.3, `docs/DESIGN_CHOICES.md` | Template for Jiro's own economy document |

Before reusing, note:

- **Prices and currency differ.** ethblockdigger charges 0.02 USDC per run, against the draft's $0.10 Challenge run and $0.01 Superchallenge run. Jiro charges 0.00005 ETH per Challenge run in native ETH *(D12)*, so `Vault`'s SafeERC20 transfers become a `msg.value` check at run start and pull-based payouts.
- **Not audited, not live.** ethblockdigger's testnet deployment is superseded and waiting for a full redeploy, which needs Stylus activations ([§7.3](#73-verification-cost)). Its own docs require a professional audit before mainnet.
- **Known residuals come along.** For example, a player can compute their run nonce up to 256 Arbitrum blocks before the reveal starts the commit deadline: about a minute at 0.25 s per block (ethblockdigger `TOKENOMICS.md` §6.2).
- **Chain coupling.** `ArbBlockhashEntropy` relies on Arbitrum's ArbSys precompile; `block.prevrandao` is a constant on Arbitrum. Moving off Arbitrum needs a new entropy source.

## 11. Reference implementations

The draft lists four references, plus a general pointer to the many Xonix and Qix clones in JavaScript on GitHub, which vary too much to assess as a group. It asks to study three mechanics in them: grid representation, iterative flood fill and integer enemy reflection. All four references exist, but they don't all show what the draft says:

| Reference | What it is | Adopt | Avoid |
|---|---|---|---|
| [yanbrod/volfied_clone](https://github.com/yanbrod/volfied_clone) | TypeScript and Canvas | Flat `Uint8Array` grid, `y * w + x`, 4-pixel cells, border pre-claimed. Iterative fill with an explicit stack, seeded from every enemy, cells marked when pushed, one sweep afterwards. | Enemies don't reflect: a blocked enemy picks a random new direction with `Math.random()`, and 10% of moves are random anyway. Enemies ignore the trail, which is kept as a separate list of pixel positions. Updates are timed by `requestAnimationFrame`. |
| [Przemekkkth/Xonix_Qt-Cpp](https://github.com/Przemekkkth/Xonix_Qt-Cpp) | C++ and Qt, `int grid[25][40]` | One-axis-at-a-time reflection: move, test, and undo with `dx = -dx` on a hit. One sweep after the fill (−1 becomes 0, everything else becomes 1). | The flood fill (`Game::drop`) is **recursive**: the stack overflow the draft warns about, in the very C++ reference it cites. Velocities are pixel-scale values from `rand()` and can be zero. Timing uses a float accumulator. |
| [aferust/drawee](https://github.com/aferust/drawee) | D, SDL and OpenGL | Nothing for the rules | No grid at all: the field is a polygon. A capture splices the polygon along the cut and keeps the larger piece, by float area; point-in-polygon tests then remove the enemies left outside. Enemies are bodies in the Chipmunk physics engine, with float velocities. |
| [Qixie](https://milasoft64.itch.io/qixie) by milasoft64 | 6502 assembly, Commodore PET | Fill the enemy's side with an invisible marker, then swap it back: the same idea as `BOSS_ZONE`. Size the explicit stack for the worst case: theirs overflowed the 6502's 256-byte stack after 128 cells, and moving it to a 16-bit stack in zero page fixed it. | (none) |

Corrections to the draft:

- The C++ clone uses a recursive fill, not a queue.
- Qixie runs on the Commodore PET; it is based on a C64 Qix. Its devlog describes a stack that was too small, not "linear sweeps and buffer swapping".
- drawee works with polygons, not "raw pixel/grid buffers".

What Jiro takes from them, by mechanic:

- **Grid:** volfied_clone's flat byte array, with the trail stored in the grid (state 2) instead of a list. "Does the boss touch the trail?" then costs one lookup per cell of the boss's leading edge instead of a scan of the whole trail.
- **Flood fill:** volfied_clone's explicit stack and multi-seed start, Xonix's single sweep, and Qixie's lesson: size the explicit stack for the worst case before the hardware finds it for you ([§4.8](#48-capture)).
- **Enemy reflection:** Xonix's one-axis-at-a-time inversion, on cells and with fixed ±1 velocities ([§4.6](#46-boss)).
- **Avoid in all of them:** frame-timed updates (`requestAnimationFrame`, or a `QTimer` with a float accumulator), platform `rand()`, and float physics.

## 12. Agent skills

### Project skills

The draft's five system prompts, revised, live in [`.claude/skills/`](.claude/skills/) as Claude Code skills. They point to this README for the rules instead of restating them, so each rule has exactly one home.

| Skill | Draft prompt | Main changes |
|---|---|---|
| [`rp2040-firmware`](.claude/skills/rp2040-firmware/SKILL.md) | Embedded C++ Optimizer | Adds the real pin map and memory budget, and drops the full framebuffer. Inputs are sampled once per tick and reach the core through the journal. The firmware never re-implements a rule, and runs the test vectors on the device. |
| [`deterministic-core`](.claude/skills/deterministic-core/SKILL.md) | Deterministic Engine Architect | Adds what breaks determinism besides floats: tick order, iteration order, hidden inputs, panics, and rule changes without a version bump. |
| [`onchain-referee`](.claude/skills/onchain-referee/SKILL.md) | EVM / Solidity Gas Optimizer | Drops the Solidity replay: verification runs the one core, on Stylus or behind a zk proof, with the draft's 1M gas as a per-level gate on Stylus. Never trusts a client seed or score, and binds journals to their run so their bytes can't be reused. |
| [`journal-codec`](.claude/skills/journal-codec/SKILL.md) | Cryptographic State Mapper | One codec for all targets, with strict decoding. keccak256 serves for seed derivation and commitments only, not as a per-tick PRNG. |
| [`parity-testing`](.claude/skills/parity-testing/SKILL.md) | State-Machine Debugger | Per-tick state-hash traces instead of a final hash only. Adds shared golden vectors, property tests, differential fuzzing and bot playtests. |

### ethskills

[`skills-import.md`](skills-import.md) lists the ethskills to import: the `ship` index/router skill, which is already vetted and committed in ethblockdigger, and 20 topic skills. ethskills.com was unreachable from ethblockdigger's sandbox, but it is reachable from this repository's cloud sessions, so the import can now be done directly.

By milestone:

- **M4:** `security`, `testing`, `gas`, `l2s`, `addresses`, `standards`.
- **M5:** `wallets`, `frontend-ux`, `frontend-playbook`.
- **Reviews:** `qa`, `audit`.

Treat their advice as input, not as rules for this project. For example, `ship` recommends deploying on Ethereum mainnet unless an L2's particular strength fits the app. For Jiro, that strength is Arbitrum, where ethblockdigger's contracts and entropy source already run.

## 13. Open decisions

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Language of the core and of the firmware shell | **Decided:** one Rust core for every target; firmware shell: Rust on `embassy-rp`, built with cargo alone (owner, 2026-10-28), confirmed by M0.2's blinky build ([`docs/TOOLING.md`](docs/TOOLING.md#d1-evidence-embassy-rp-blinky)). |
| D2 | Verification backend | **Agreed on 2026-10-28:** Stylus referee first and zkVM proofs as the fallback, verifying a run only when money depends on it ([§7.3](#73-verification-cost)). The zkVM framework is chosen for its tooling first, then for cost. Confirm with the M1 and M4 measurements. |
| D3 | Player movement on claimed cells | **Decided:** rail only, as in *Qix* and *Volfied*, which keeps minions dangerous. |
| D4 | Trail rules | **Decided:** the own trail blocks movement (*Qix*) rather than killing (*Xonix*); no fuse in v1. |
| D5 | Level defaults, and running out of lives | **Decided:** 3 lives, 2,700 ticks and a 75% target, adjustable per level. Running out of lives scores zero, which makes Commit meaningful. |
| D6 | Shield (B) | **Decided:** one charge per level; an absorbed hit costs the charge and nothing else. |
| D7 | Minion patrol rule, and minions stranded by a capture | **Agreed on 2026-10-28, provisional:** the right-hand rule with the orientation step ([§4.7](#47-minions)), kept if M1's coverage property test finds no traps; otherwise replaced in M1, or kept with a bounded trap rate the owner accepts. Stranded minions are destroyed, and respawn when their countdown of R, which counts the tick of destruction, reaches zero: at tick t + R − 1 ([§4.7](#47-minions), PIN-17). |
| D8 | Key mapping | **Decided:** Key0–3 = A, B, X, Y. Y and the joystick press stay unused: a pause button would give human players free thinking time in paid modes. In the browser, players can rebind the keyboard keys ([§2](#2-hardware-target)). |
| D9 | Boss size | **Decided:** a square body of B × B cells, closer to *Volfied*, with B set per level ([§4.6](#46-boss)): B = 2 to 8, default 5. |
| D10 | Challenge ranking and payout | **Decided:** best settled run per season; pro-rata payout among qualified players (owner, 2026-10-28). Decided in M0.7: ties go to fewer ticks, and a qualifying run is a settled run that cleared at least `minClears` levels, a season parameter that defaults to 1. Qualifying runs rank first, so settling another of a player's runs never lowers that player's payout ([§8.4](#84-season-scoring)). |
| D11 | Superchallenge design | **Deferred** with the mode, see [`TODO.md`](TODO.md) |
| D12 | Chain, currency, season length | **Decided:** native ETH on Arbitrum One (Arbitrum Sepolia for testnet), reusing what is reusable from ethblockdigger's contracts; a Challenge run costs 0.00005 ETH ([§8](#8-game-modes-and-economy)); 14-day seasons on testnet (apart from a 1-day rehearsal season), likely on mainnet too. |
| D13 | Names | **Decided:** Jiro-ikusu (ジロイクス, see [`name.md`](name.md)). Keep *Volfied* and *Qix*, which are Taito titles, out of product and contract names: the draft's `VolfiedVerifier` becomes `Referee`. Crates: `jiro-core`, `jiro-shell`, `jiro-tools`, `jiro-wasm`, `jiro-firmware`, `jiro-firmware-drivers`, `jiro-referee-stylus`. Contracts: `IReferee`, `Referee`, `ZkReferee`, `Challenge`, `Season`. |
| D14 | Seed space | **Decided** (owner, 2026-10-29): the level seed keeps driving the boss through the level, so that no two runs share a game and inputs can be neither copied from another run nor precomputed ([§7.4](#74-bots)). [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) M1.18 wrote the rule, seeded deflections ([§4.6](#46-boss), R4.6-6 to R4.6-12; [§6.4](#64-seeds-and-commitments)): a stateless draw from level seed bytes 5 to 8 and the tick turns the boss a quarter turn on 1 move in 32. |

M0.7 also closed five contract decisions of the plan ([`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) §11):

- **P4,** the verifier interface ([§7.3](#73-verification-cost));
- **P5,** the journals published in the commit's calldata ([§7.2](#72-run-flow));
- **P6,** the commit slack as a season parameter, `commitSlack` ([§8.4](#84-season-scoring)), whose testnet value comes later;
- **P16,** one settlement transaction per run, with a per-level fallback ([§7.3](#73-verification-cost));
- **P17,** the draw check by slot, with the draw computed only by the core ([§8.2](#82-challenge-000005-eth-per-run)).

## Repository files

- [`plan-draft.md`](plan-draft.md): the original draft this README is built from.
- [`GUIDELINES.md`](GUIDELINES.md): workflow rules for coding agents.
- [`skills-import.md`](skills-import.md): the ethskills import list.
- [`TODO.md`](TODO.md): deferred work, starting with Superchallenge mode.
- [`name.md`](name.md): the name in Japanese and Chinese.
- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md): the work breakdown of milestones M0 to M5.
- [`CLAUDE.md`](CLAUDE.md): the project instructions every agent session loads.
- [`.claude/AGENTS_COMETH.md`](.claude/AGENTS_COMETH.md): Cometh's code philosophy, imported by `CLAUDE.md`.
- [`LICENSE`](LICENSE): MIT.
