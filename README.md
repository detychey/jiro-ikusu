# Jiro-ikusu

A deterministic, onchain-verifiable area-capture game in the spirit of *Qix* and *Volfied*. It runs on a Raspberry Pi Pico fitted with a Waveshare Pico-LCD-1.3, and in the browser.

> **Status: specification, no code yet.** This README is the project specification. It is built from [`plan-draft.md`](plan-draft.md), the original draft (kept for reference). It also fixes the parts of the draft that would break determinism or the economics, and records the decisions, taken and still open, in [§13](#13-open-decisions). A rule tied to a decision is tagged with its ID, e.g. *(D3)*.

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
| `firmware/` | `thumbv6m-none-eabi` library | LCD, inputs, 15 Hz timer, USB link |
| `web/` | `wasm32` module | Canvas rendering, keyboard, replay viewer, level editor, wallet, Web Serial bridge |
| `referee/` | Stylus contract or zkVM guest *(D2)* | `verify(journal) → outcome` |
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

### 4.1 Grid

- **Layout.** 60×60 cells in a flat `u8` array, row-major: `index = y * 60 + x`. (0, 0) is the top-left corner, x grows to the right and y grows down. Each cell is drawn as a 4×4-pixel square.
- **Cell states:**

  | Value | State | Drawn as |
  |---|---|---|
  | 0 | `EMPTY`: open field, boss territory | black |
  | 1 | `CLAIMED`: solid (the border, obstacles, captured cells) | blue |
  | 2 | `TRAIL`: the cut being drawn, vulnerable | red |
  | 3 | `BOSS_ZONE`: temporary marker, exists only during a capture | not drawn |

- **Level start.** The border (x = 0, x = 59, y = 0, y = 59) and the level's obstacles are `CLAIMED`. Everything else is `EMPTY`.
- **Claim** is measured in basis points of the cells that were `EMPTY` at level start: `claim_bp = captured_cells * 10_000 / claimable_cells`, with integer division. The border and obstacles never count. On a level without obstacles, `claimable_cells` is the 58×58 interior: 3,364 cells.

### 4.2 Rail

A **rail cell** is a `CLAIMED` cell with at least one `EMPTY` or `TRAIL` cell among its 8 neighbors. The player and the minions walk on the rail.

- **Diagonal neighbors count,** so the rail stays connected around corners. With only 4 neighbors, the four corners of the starting border would not be rail cells, and the rail would break there.
- **`TRAIL` counts as open,** so the rail changes only on capture, never while a cut is being drawn.

### 4.3 Entities

All entity fields are small integers:

| Entity | State |
|---|---|
| Player | position; cutting flag; cut start cell; lives; shield charges; invulnerability ticks; previous direction; slow-move phase |
| Boss | position (the top-left cell of its body); body size B (set per level); vx, vy ∈ {−1, +1}; move period (moves every N ticks, set per level) |
| Minions (0–3 per level; the draft has 3) | position; heading 0–3 (N, E, S, W); move period; respawn countdown |

### 4.4 Tick order

- **Tick numbering.** Ticks are numbered from 0 within each level. A level with a time limit of T ticks runs at most ticks 0 to T − 1.
- **Periodic movement.** An entity with a move period of N moves on the ticks where `tick % N == 0`. The phase is global and never resets.
- **Order.** The order of steps is part of the rules: a different order is a different game.
- **Ending a level.** The level ends at the first step where an end condition occurs ([§4.10](#410-end-of-level)), and the remaining steps don't run on that tick.

Once per tick, in this order:

1. **Input.** A journal event at this tick replaces the current input mask ([§6](#6-input-journal-and-byte-formats)).
2. **Commit.** If X is pressed, the level ends. An unfinished cut is discarded: its trail is erased and nothing is captured.
3. **Player.** The player moves 0, 1 or 2 sub-steps ([§4.5](#45-player)). A cut that reaches `CLAIMED` captures at once ([§4.8](#48-capture)), and the player moves no further this tick. If the capture brings the claim to the level's target, the level is cleared.
4. **Boss.** The boss moves ([§4.6](#46-boss)). If it bumps into `TRAIL`, the player is hit.
5. **Minions.** The minions move, in index order ([§4.7](#47-minions)). Respawn countdowns also tick down here.
6. **Collisions.** The tick's hits are resolved ([§4.9](#49-hits-lives-and-respawn)).
7. **Time.** If this was tick T − 1, the level ends.

### 4.5 Player

- **Direction.** The direction is resolved on every tick, whether or not the player moves. If the direction resolved on the previous tick is still held, keep it. Otherwise take the first held direction in the order up, down, left, right. If none is held, the direction is none, and the player stands still. The draft doesn't say what happens when two directions are held, but a 5-way joystick reports two at once while rolling from one direction to the next.
- **On the rail,** the player moves only from rail cell to rail cell *(D3)*. Stepping into `EMPTY` starts a cut: the cell the player leaves becomes the **cut start**, and every `EMPTY` cell entered becomes `TRAIL`.
- **Off the rail.** A capture can leave the player's own cell off the rail, for example when a cut closes into a pocket next to an obstacle. While off the rail, the player may step onto any `CLAIMED` cell, until back on the rail.
- **Own trail.** The player cannot step onto `TRAIL`; the move is ignored *(D4)*. The draft only forbids moving backward, which is one case of this rule.
- **Closing a cut.** Stepping from `TRAIL` onto `CLAIMED` completes the cut and triggers a capture. That cell is a rail cell at that moment, though the capture can take it off the rail (see "Off the rail" above).
- **Fast cut (A).** If the player is cutting at the start of the tick and A is held, the player takes two sub-steps. On the rail, speed stays normal.
- **Slow shield (B).** While B is held, the player moves only on the ticks where `(tick − press_tick) % 2 == 0`. `press_tick` is the tick on which B went from released to held. If A and B are both held, B wins.
- **Stopping mid-cut** is allowed: there is no *Qix*-style fuse *(D4)*.

### 4.6 Boss

The boss is a square body of B × B cells *(D9)*, closer to *Volfied* than the draft's single cell. B is set per level ([§5](#5-levels)); its position (x, y) is the top-left cell of the body. The body only ever covers `EMPTY` cells.

The boss moves one axis at a time, testing the whole leading edge of its body, and inverts the velocity component that hits something:

```text
if the boss moves this tick:
    edge = the B cells of column x + B (if vx = +1) or x − 1 (if vx = −1), rows y to y + B − 1
    if any edge cell is CLAIMED or TRAIL:  vx = -vx;  if any is TRAIL: the player is hit
    else:                                  x = x + vx
    edge = the B cells of row y + B (if vy = +1) or y − 1 (if vy = −1), columns x to x + B − 1
                                           # uses the x just computed
    if any edge cell is CLAIMED or TRAIL:  vy = -vy;  if any is TRAIL: the player is hit
    else:                                  y = y + vy
```

The edge cells always exist: the body stays inside the border, which is `CLAIMED`. With B = 1 the procedure tests single cells.

The draft tests `grid[next_x][y]` and `grid[x][next_y]` from the same starting cell, then moves diagonally. That puts the boss inside a wall in two cases:

- **Outside corner:** both side cells are open but the diagonal cell is solid.
- **Corridor as wide as the boss:** after flipping, the new direction points into the opposite wall.

Testing one axis at a time, with the second test made after the first move, never enters a solid cell and needs no special cases. This is how the Xonix reference moves its enemies ([§11](#11-reference-implementations)). A quick simulation (not committed) ran bodies with B = 2, 3, 5 and 7 for 3,000 ticks on 232 random boards, and no body ever covered a cell that wasn't `EMPTY`.

The draft starts the boss at (30, 30). Here the level defines a spawn area, the set of cells where the body's top-left cell may start. The level seed picks the start position inside it and the diagonal direction ([§6.4](#64-seeds-and-commitments)).

### 4.7 Minions

- **Movement.** Minions walk on rail cells only, one cell per move.
- **Right-hand rule** (from the draft). A minion tries to turn right, then to go straight, then to turn left, then to turn back, and takes the first direction whose target is a rail cell.
- **Orientation.** At spawn, at respawn and after every capture, a minion turns to the first heading, in the order N, E, S, W, that has open field (`EMPTY` or `TRAIL`) on its right and a rail cell ahead. If no heading qualifies, it keeps its current heading. With the field on their right, minions circle it clockwise.
- **Known gap** *(D7)*. Where the rail is two cells thick (2-wide peninsulas, junctions), a minion whose right side faces the band instead of the field circles a 2×2 block forever. A quick simulation on random boards (not committed) measured this:
  - with random starting headings, the draft's rule trapped minions in about 2% of runs;
  - with the orientation step, about 0.15% of runs were still trapped.

  The orientation step helps but is not a guarantee. M1 must either prove the rule with the coverage property test (see the `parity-testing` skill) or replace it, for example with contour tracing of the field's boundary.
- **Stranded minions.** After a capture, a minion whose cell is no longer on the rail is destroyed *(D7)*. The draft doesn't cover this case. Its respawn countdown starts at the level's respawn delay R and drops by one at step 5 of each tick. When it reaches zero, the minion respawns, oriented, at its spawn cell. If the spawn is no longer on the rail, it respawns at the first rail cell in row-major order instead.

### 4.8 Capture

When a cut reaches `CLAIMED`:

1. Mark every cell of the boss's body `BOSS_ZONE` and push it on a stack. With several bosses, do this for each one.
2. Pop a cell. Mark each of its 4 neighbors that is `EMPTY` as `BOSS_ZONE`, and push it. Repeat until the stack is empty. `TRAIL` and `CLAIMED` stop the fill, so the trail acts as a wall.
3. Make one pass over all 3,600 cells: `BOSS_ZONE` becomes `EMPTY`, and `EMPTY` and `TRAIL` become `CLAIMED`. The number of cells that became `CLAIMED` is the capture size.

Why this procedure:

- **No recursion.** A cell is marked when it is pushed, not when it is popped, so it is pushed at most once. A static stack of 3,364 entries can therefore never overflow. A recursive fill needs up to 3,364 nested calls, far beyond the RP2040's small default stack.
- **Visit order doesn't matter.** The result depends only on which `EMPTY` cells are 4-connected to the boss's body. A stack, a queue or a scanline fill all give the same grid.
- **The boss's side stays open, as one region.** Since the boss moves one axis at a time, it cannot cross a gap that is only diagonal, so it never reaches a cell that the fill treats as a separate region. The fill may include pockets narrower than the body, which the boss can't physically enter. They stay open because they connect to the boss's side: as in *Qix* and *Volfied*, a capture takes the regions without the boss, not the cells the boss can't reach.
- **One pass instead of three.** The draft's steps 3–5 (claim unreached cells, convert the trail, revert `BOSS_ZONE`) collapse into the single pass of step 3.

### 4.9 Hits, lives and respawn

- **Hits.** The player is hit in four cases:
  - the boss bumps into `TRAIL`;
  - the player tries to step onto a cell of the boss's body. The move doesn't happen, so the body never covers the trail.
  - the player and a minion share a cell after the minions have moved;
  - a minion and the player swap cells in the same tick. Without this rule they would pass through each other. With fast cut, both sub-step cells count.

  Hits set a single flag for the tick, so several hits in one tick count as one.
- **Resolution** (at step 6), in this order:
  1. If the player is invulnerable, nothing happens.
  2. Otherwise, if B is held and a shield charge is left, the charge is spent and nothing else happens *(D6)*.
  3. Otherwise, the player loses a life (see the next point).
- **Losing a life.** The trail is erased. The player returns to the cut start, or stays in place if they were not cutting. They are then invulnerable during the 30 ticks (2 s) after the hit tick, or until they start a cut, whichever comes first. Without that limit, invulnerability would be a window for a risk-free cut.
- **Respawn point.** The draft respawns the player at (30, 59). That stops working after the first capture along the bottom border: (30, 59) is no longer a rail cell, so a rail-bound player would be stuck there. The cut start, by contrast, is always a rail cell, because the rail only changes on capture.

### 4.10 End of level

The first condition met ends the level, in tick-step order:

| Condition | Step | Result |
|---|---|---|
| X pressed | 2 | Committed: claim kept, unfinished cut discarded |
| `claim_bp` reaches the level's target (default 7,500) | 3 | Cleared |
| No lives left (default 3) | 6 | Over, and the level scores zero *(D5)* |
| Tick T − 1 processed (default T = 2,700, i.e. 3 min) | 7 | Over, claim kept |

Scoring zero when the lives run out is what gives Commit its purpose: bank the claim, or risk it for more.

**Ticks used** is the number of ticks processed: the index of the last tick, plus one. The core computes the level score from the season's scoring parameters ([§8.4](#84-season-scoring)).

## 5. Levels

A level is data, not code. The 16 built-in levels use this format, and so will Superchallenge maps if that mode comes back ([`TODO.md`](TODO.md)):

| Field | Meaning |
|---|---|
| Obstacles | Cells that start `CLAIMED` (a 3,600-bit bitmap, 450 bytes) |
| Boss | Body size B, the side of the square body (B = 2 to 8, default 5); spawn area, the cells where the body's top-left cell may start; move period |
| Minions | Count (0–3); spawn cells; move period; respawn delay R |
| Rules | Time limit (at most 2,700 ticks), lives, target claim. Defaults: 2,700 ticks, 3 lives, 7,500 bp. |

`level_id = keccak256(level bytes)`. Contracts store level ids, clients ship the level bytes, and the referee checks the bytes against the id.

**Validity.** The core checks every level before play. A valid level meets five conditions:

- the open area is a single 4-connected region, at least a minimum size (threshold frozen in M0);
- from every cell of the boss spawn area, the B × B body lies inside that region;
- every minion spawn is a rail cell;
- the player start (30, 59) is a rail cell;
- the time limit is at most 2,700 ticks, the size of the static journal buffer ([§6.2](#62-events)).

**The 16 levels** ramp up difficulty with the knobs in the table above: boss body size, boss and minion periods, minion count, obstacle layouts that create corridors, time limit and target. Each level gets a target clear rate for scripted playtest bots, the method ethblockdigger uses for balancing ([§10](#10-reuse-from-ethblockdigger)). The bots' completion data also seeds the season 1 scoring weights ([§8.4](#84-season-scoring)).

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

The encoding is big-endian and fixed-width. It is frozen in M0:

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

**Rules version.** `RULES_VERSION` is bumped on every rule change. Each season names the rules version it accepts, and the referee rejects any other, so a journal is always replayed under the rules it was played with.

**Strict decoding.** The decoder rejects a journal with any of these, as ethblockdigger's codec does:

- an unknown format version, rules version or mode;
- a reserved bit set;
- ticks that don't increase;
- an event that doesn't change the mask;
- events after the level ended;
- truncated input or trailing bytes.

**No struct dumps.** Never serialize an event as a C struct: padding makes `struct { uint16_t tick; uint8_t mask; }` 4 bytes long, not 3.

**Absolute ticks.** The draft's State Mapper prompt suggests packing tick deltas. This format keeps absolute ticks, which make decoding trivial, and a full journal is at most about 8 KB. Revisit only if calldata cost matters.

### 6.4 Seeds and commitments

- **Level seed:** `keccak256("jiro.level" ‖ runNonce ‖ levelIndex)`.
  - **What it decides.** The core derives two things from it with a fixed procedure, frozen in M0: the boss's start position (its body's top-left cell) inside the level's spawn area, and the boss's diagonal direction. Minions start at their level-defined spawn cells, with headings from the orientation step ([§4.7](#47-minions)).
  - **Once per level.** keccak256 runs once per level, never per tick: v1 has no per-tick randomness.
  - **Packing.** Inputs are packed as Solidity's `abi.encodePacked` would pack them: the tag as ASCII bytes, `runNonce` as 32 bytes, `levelIndex` as one byte.
  - **Domain tags.** Every derivation has its own tag, so two derivations never share an input.
- **The chain chooses the seed** in paid modes ([§7.2](#72-run-flow)), never the client. Otherwise a player could try seeds offline until the spawns were easy.
- **Run commitment** (Challenge): `keccak256(keccak256(journal₀) ‖ … ‖ keccak256(journal₅))`. Each level can then be replayed in its own transaction.
- **State hash** (tests and debugging): keccak256 over a fixed-order, fixed-width serialization of the whole state: tick, grid at 2 bits per cell, player, boss, minions, counters. The layout is frozen and versioned in M0.
- **Only the journal bytes are submitted.** The seed is not, because the chain already has it. The score is not, because the referee computes it. The draft's Phase 6 submits seed, score, claim and events; a score or claim may still travel along for display, but nothing trusts it.

The draft also asks for a C++ PRNG that matches "the state-transition hashing logic of keccak256" in Solidity. With one core, and keccak used only to derive seeds, there is no second implementation to match.

### 6.5 Device-to-browser link

The Pico has no network, but it is powered over USB anyway, so USB is the link:

- **Transport:** CDC serial on the Pico, the Web Serial API in the dApp. Web Serial works in desktop Chrome and Edge, not in Firefox or Safari.
- **Down:** the dApp sends the level bytes and the run nonce.
- **Up:** the Pico streams journal events as they happen.
- **Commit:** the dApp commits the run commitment ([§6.4](#64-seeds-and-commitments)) as soon as the run ends.

This has to happen live: the commit deadline counts the time the journals actually took to play ([§7.2](#72-run-flow)), so a journal cannot wait for a later sync.

## 7. Verification and trust model

### 7.1 What verification proves

The referee replays (level, run nonce, journal) and computes the claim and score itself. That proves the journal produces the score. It does **not** prove that a human, or a Pico, produced the journal: any program can write a journal.

In paid modes, the Pico is therefore a controller and a screen, not a security device. A journal from the browser verifies exactly like one from the Pico. The RP2040 has no secure boot or attestation. An RP2350 (Pico 2) could sign journals with a device key, which would raise the bar for cheating without closing it.

### 7.2 Run flow

The flow is the same keyless one as ethblockdigger's `Vault`:

1. **Pay.** The payment transaction commits to entropy from a future Arbitrum block (`ArbBlockhashEntropy`).
2. **Reveal.** About 10 seconds later, the run nonce is derived from that block's hash. The hash did not exist when the player paid, so nobody can preview the levels and pay only for easy ones.
3. **Play and commit.** The player commits the run commitment ([§6.4](#64-seeds-and-commitments)) before a deadline. The deadline is the reveal time, plus the time the journals actually took to play (their ticks used, at 15 Hz), plus a small slack for level transitions and transaction latency (frozen in M0). The contract records the commit time and checks the deadline at settlement, once the journals' lengths are known.
   - **Why the actual duration.** A fixed window, like ethblockdigger's 450 s, would leave every early-ending level's unused minutes free. The player could replay a level whose seed they already know and commit the best attempt, or practice the next level before playing it for real. With a deadline that follows the journals' own length, any time spent that way makes the commit late.
   - **Real-time play.** Inputs must therefore be produced at roughly real-time speed, which is what stops slow-motion play and offline search.
4. **Settle,** only when money depends on the run ([§7.3](#73-verification-cost)). The journal bytes are submitted, and the contract checks them against the commitment, the run's nonce and the level ids. Then the verifier either replays them (Stylus) or checks a proof of their replay (zkVM).

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
2. **Verify by exception.** Playing a run costs one small commit transaction, and its journals are published so anyone can replay them offchain for free. A run is verified onchain only when money depends on it, typically each player's best run of the season. Verifying every six-level run would cost on the order of its 0.00005 ETH entry fee, even on Stylus. The payout curve *(D10)* sets how many runs need verifying.
3. **One verifier interface.** Settlement calls `verify(journal) → outcome`, like ethblockdigger's `IReferee`, backed either by the Stylus referee or by a proof verifier. The money contracts don't change when the backend does.
4. **Stylus first, zk as the fallback.** If activations reopen, the Stylus referee needs no prover infrastructure. If they don't, each verified run gets a zk proof, and a season's proofs are aggregated so verification gas stays nearly constant.

The draft's 1M-gas figure stays as the M4 gate, applied per level on Stylus rather than to a whole game in Solidity. The approach is also the draft's "optimistic" model in its simplest form: nothing is verified until money depends on it, and then it is proven rather than disputed.

### 7.4 Bots

The game is deterministic and the simulation is tiny. Once the run nonce is revealed, a bot can search for strong inputs *within* the commit deadline, which only stops slow search. ethblockdigger reached the same conclusion: nothing cryptographic stops a competent real-time bot.

The levers are economic and social:

- an entry fee per run;
- qualification thresholds;
- public journals that anyone can replay and inspect;
- fresh entropy per level, the designed upgrade, so a bot cannot plan beyond the level it is playing.

**This is the main product risk of the paid modes.**

### 7.5 Later version: proving service

Planned on 2026-10-28 for a version after v1, and not scheduled ([§9](#9-roadmap)). In v1, whoever settles a run also produces its proof. In the later version, a third-party proving service does it for the player. The player sends the run's inputs (level bytes, run nonce, journals) to the service's API, the way a contract asks an oracle, and the service returns the proof and settles the run. Prover marketplaces such as Succinct's prover network and RISC Zero's Boundless already work this way. Neither the Pico nor the browser ever proves anything: proving needs gigabytes of memory, and ideally a GPU.

**The service is an untrusted prover, not an oracle.** An oracle's answer is believed; a proof is checked by the contract. So:

- **No new trust.** A proof only attests the outcome the journals actually produce, so a compromised service cannot mint prizes. The worst it can do is refuse or delay. The contracts never accept the service's signature or word in place of a proof: that is the oracle design ethblockdigger rejected, where one compromised key could pay out.
- **The payout goes to the run's player, whoever submits.** The proof's public outputs include the run id, and settlement credits the run's player. The service can therefore submit the proof without being able to redirect the money, and claims can be gasless for players: the service takes a relay fee from the payout, capped by the season. A journal copied into another run fails, because journals are bound to their run's nonce ([§6.4](#64-seeds-and-commitments)).
- **Someone pays for proving:** the payout (deducted at claim), the protocol (from the rake), or the player up front. Verify by exception still applies: only runs that money depends on need a proof ([§7.3](#73-verification-cost)).
- **The commit never waits for the service.** The commit must land before its deadline even when the service is down ([§7.2](#72-run-flow)). The dApp commits the run commitment itself, or the player signs it and any relayer submits it. Proving can happen hours later, within the season's settlement grace.
- **Proving stays permissionless.** If the service refuses, the player, a second provider or a backup prover can produce the same proof.
- **Effect on the backend.** A proving service makes zk practical without running prover infrastructure, which matters while Stylus activations stay paused *(D2)*. The deciding number is the proving price per verified run against the payout it unlocks, which M1 and M4 measure.
- **The device.** Nothing changes on the standard Pico. A Pico W or Pico 2 W could stream the journal to the service over Wi-Fi, leaving the browser only to buy the run. The commit would still need the player's authorization, through a signed commit or a session key.

**Unchanged:** determinism, the journal format, the one core, and the bot risk ([§7.4](#74-bots)). A proof shows that a score is reachable, not that a human played.

## 8. Game modes and economy

Amounts are in native ETH *(D12)*, and the contracts hold them in wei: 0.00005 ETH = `50_000_000_000_000` wei. Each season commits its fee when it opens ([§8.4](#84-season-scoring)), so the fee can follow the ETH price from one season to the next.

### 8.1 Training: free

All 16 levels, offline, on the Pico or in the browser. Scores stay local and no wallet is needed. Training uses the current season's rules and scoring, so practice carries over.

### 8.2 Challenge: 0.00005 ETH per run

- **Draw.** Six different levels out of the 16, drawn from the run nonce after payment by a Fisher–Yates shuffle driven by `keccak256("jiro.draw" ‖ runNonce ‖ i)`, with `i` packed as one byte. The exact procedure is frozen in M0.
- **Score.** The run score is the sum of the six level scores.
- **Ranking.** Players are ranked by their best settled run of the season *(D10)*. Ranking by cumulative score would let spending buy rank.
- **Rewards.** The season pot is the entry fees minus a rake capped at 20%, as in ethblockdigger's `Season`, including its rollover of empty seasons and its claims. The pot is shared pro-rata among qualified players *(D10)*; ethblockdigger chose pro-rata because top-heavy payouts invite collusion when there are few players.
- **Sybils.** Fees are paid at run start, so every point costs money, and extra wallets only pay off if they also play well.

### 8.3 Superchallenge: deferred

Player-minted maps with bounties are deferred. The draft's design, its problems and a redesign proposal are kept in [`TODO.md`](TODO.md).

### 8.4 Season scoring

The draft adjusts the per-level scoring formula, which is based on completion, each season from what players actually achieved. To keep that fair:

- **Fixed for the season.** The season's parameters are published, versioned and committed onchain when the season opens, and never changed mid-season. Scores are only comparable within a season.
- **Computed, never claimed.** The core computes level scores; the client never claims one. Proposed formula shape: `level_score = claim_bp * weight[level] / 10_000`, where `weight[level]` (in basis points) is the season parameter. Ties go to the run that used fewer ticks.
- **Purpose: normalize difficulty,** so that the random six-level draw doesn't decide the ranking. For example, set the weights so that the median claim observed on each level is worth the same number of points. The input is the previous season's public journals; season 1 uses playtest-bot data.

## 9. Roadmap

The draft builds hardware first (its Phases 1–7). This roadmap puts the core and its test vectors first instead: they are the contract every other target is checked against, and a 240×240 screen with a flash cycle is the slowest place to debug game rules. Hardware bring-up (LCD and keys) can still run in parallel at any time.

[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) breaks these milestones into work items, one pull request each, with their dependencies, acceptance checks and the steps that need the owner.

| Milestone | Deliverable | Draft phases | Done when |
|---|---|---|---|
| **M0** Rules freeze | Close the open decisions. Freeze the tick order, journal v1, level format and validity thresholds, seed and draw procedures, state hash and commit slack. | none | No open decision blocks M1 |
| **M1** Core | Rust core: grid, player, boss, minions, capture, scoring, codec, seeds; golden vectors; property tests; a hands-on tooling trial of two or three zkVMs, and cycle counts per level in the one chosen | 3, 4, 5, and the codec half of 6 | Tests pass; vectors committed; zkVM chosen; cycle counts recorded |
| **M2** Browser | wasm build, canvas renderer, keyboard controls, replay viewer, level editor; the 16 levels, calibrated with bots | browser version, 16 levels | All 16 levels playable; bot clear rates on target |
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
| [`onchain-referee`](.claude/skills/onchain-referee/SKILL.md) | EVM / Solidity Gas Optimizer | Drops the Solidity replay: verification runs the one core, on Stylus or behind a zk proof, with the draft's 1M gas as a per-level gate on Stylus. Never trusts a client seed or score, and binds journals to their run so they can't be copied. |
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
| D1 | Language of the core and of the firmware shell | **Decided:** one Rust core for every target; firmware shell: Rust on `embassy-rp`, built with cargo alone (owner, 2026-10-28). M0.2's blinky build confirms it. |
| D2 | Verification backend | **Agreed on 2026-10-28:** Stylus referee first and zkVM proofs as the fallback, verifying a run only when money depends on it ([§7.3](#73-verification-cost)). The zkVM framework is chosen for its tooling first, then for cost. Confirm with the M1 and M4 measurements. |
| D3 | Player movement on claimed cells | **Decided:** rail only, as in *Qix* and *Volfied*, which keeps minions dangerous. |
| D4 | Trail rules | **Decided:** the own trail blocks movement (*Qix*) rather than killing (*Xonix*); no fuse in v1. |
| D5 | Level defaults, and running out of lives | **Decided:** 3 lives, 2,700 ticks and a 75% target, adjustable per level. Running out of lives scores zero, which makes Commit meaningful. |
| D6 | Shield (B) | **Decided:** one charge per level; an absorbed hit costs the charge and nothing else. |
| D7 | Minion patrol rule, and minions stranded by a capture | **Agreed on 2026-10-28, provisional:** the right-hand rule with the orientation step ([§4.7](#47-minions)), kept if M1's coverage property test finds no traps; otherwise replaced in M1, or kept with a bounded trap rate the owner accepts. Stranded minions are destroyed and respawn after R ticks. |
| D8 | Key mapping | **Decided:** Key0–3 = A, B, X, Y. Y and the joystick press stay unused: a pause button would give human players free thinking time in paid modes. In the browser, players can rebind the keyboard keys ([§2](#2-hardware-target)). |
| D9 | Boss size | **Decided:** a square body of B × B cells, closer to *Volfied*, with B set per level ([§4.6](#46-boss)): B = 2 to 8, default 5. |
| D10 | Challenge ranking and payout | **Decided:** best settled run per season; pro-rata payout among qualified players. **Proposed** qualification, settled in M0.7: the player's best run cleared at least one level. |
| D11 | Superchallenge design | **Deferred** with the mode, see [`TODO.md`](TODO.md) |
| D12 | Chain, currency, season length | **Decided:** native ETH on Arbitrum One (Arbitrum Sepolia for testnet), reusing what is reusable from ethblockdigger's contracts; a Challenge run costs 0.00005 ETH ([§8](#8-game-modes-and-economy)); 14-day seasons on testnet (apart from a 1-day rehearsal season), likely on mainnet too. |
| D13 | Names | **Decided:** Jiro-ikusu (ジロイクス, see [`name.md`](name.md)). Keep *Volfied* and *Qix*, which are Taito titles, out of product and contract names: the draft's `VolfiedVerifier` becomes, for example, `Referee`. |

## Repository files

- [`plan-draft.md`](plan-draft.md): the original draft this README is built from.
- [`GUIDELINES.md`](GUIDELINES.md): workflow rules for coding agents.
- [`skills-import.md`](skills-import.md): the ethskills import list.
- [`TODO.md`](TODO.md): deferred work, starting with Superchallenge mode.
- [`name.md`](name.md): the name in Japanese and Chinese.
- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md): the work breakdown of milestones M0 to M5.
