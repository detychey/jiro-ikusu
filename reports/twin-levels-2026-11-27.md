# Twin-boss levels 10, 13, 15 and 16 (plan M5.19)

Measured on 2026-11-27 on rules version 4 (M5.18), with the release `jiro-tools` of this branch. The four levels are the sources of `levels/src/` and the bytes of `levels/*.bin`; `levels/README.md` holds their knobs and renders. Every playtest figure is over 1,000 Training runs per policy and level, seed 1, the run nonces of `jiro-tools playtest`. The reference mix is that of `levels/targets.json` (bold, committer), unchanged. `splitter`, M5.18's split-seeking test policy, is not in the mix; its figures are reported beside it, for the owner's decision (plan M5.18, "Left for M5.19").

This is the second version (round F7). The owner cleared the first version of doom in 66 ticks with two straight cuts up the middle: from the start to the gate, then from the gate to the top border. The first version spawned one boss on each half of every level, so on about half the seeds that middle cut split the bosses at once. Now both bosses start against the left border, one above the other.

## Summary

- **The layouts.**
  - **Trio, swarm and doom** keep their open field and get a **low gate**: a bar two cells thick on rows 40 and 41, from border to border, with three doors (two on doom), each wider than both bosses. The player starts in the yard below the gate.
  - **Maze** keeps its stacked bars, three instead of five (rows 15, 30 and 45), each with two or three doors, so that no single door joins two parts of the field.
  - **Spawns.** Both bosses start in one compartment, against the left border, one above the other, with no wall between their spawn areas. Splitting the spawn areas takes one cut the full width of the field, with no claimed cell to rest on.
- **The middle cut no longer splits the bosses.** Cut straight up from the start with no waiting, as the owner did (columns 27 to 33). It now separates the bosses on 0 % (maze), 5.6 % (trio), 4.9 % (swarm) and 4.0 % (doom) of 1,000 seeds, against 55.0 %, 50.8 %, 42.1 % and 38.6 % in the first version.
- **A separation in the first 150 ticks is still possible with perfect timing.** A probe that knows the bosses' future (the core is deterministic) still finds a straight separating cut by about tick 40 on nearly every seed, on these layouts and on every other one tried, an open field included. The bosses cross the field in about 30 ticks, and any cut from border to border splits it. Without that foresight, splitter separates before tick 150 on 2.3 % to 5.8 % of its runs.
- **The bands hold, in the curve's order.** Mix clear rates: maze 31.9 % (band 23-33), trio 23.6 % (19-29), swarm 15.8 % (8-18), doom 12.0 % (6-16), between their neighbours 39.8 % (09), 26.0 % (11), 25.9 % (12) and 16.5 % (14).
- **The proving cycles stay under M5.11's cap.** A one-cell nibbler paced to reach the work budget takes 50.3 to 52.4 million proving cycles on the four levels, under the cap of 61.6 million per level. Their gate-set vectors take 10.7 to 22.5 million.
- **`calibration-2.json` is regenerated in place.** P = 15,000 points, and weights run from 19,186 to 62,526 bp (3.3×).

## The four levels

| # | Name | Layout | Boss 0 | Boss 1 | Minions | Lives | Target |
|---|---|---|---|---|---|---|---|
| 10 | maze | Bars on rows 15, 30 and 45. Doors 10 wide: x 1-10, 25-34 and 49-58 on rows 15 and 45; x 12-21 and 38-47 on row 30 | B 6, period 1, (1, 16)-(2, 17) | B 5, period 3, (1, 25)-(2, 25) | 3 × 1 (R 45), as before | 3 (was 2) | 7,000 (was 9,000) |
| 13 | trio | Low gate, doors 10 wide at x 5-14, 25-34, 45-54 | B 5, period 1, (1, 2)-(4, 10) | B 5, period 3, (1, 20)-(4, 30) | 3 × 2 (R 60), as before | 3 | 7,000 (was 7,500) |
| 15 | swarm | Low gate, doors 11 wide at x 4-14, 24-34, 44-54 | B 7, period 1, (1, 2)-(3, 8) | B 5, period 2, (1, 20)-(3, 30) | 3 × 1 (R 45), as before | 3 | 7,000 (was 7,500) |
| 16 | doom | Low gate, doors 12 wide at x 8-19, 40-51 | B 8, period 1, (1, 2)-(2, 30) | B 6, period 2, (10, 2)-(13, 30) | 3 × 1 (R 45), as before | 3 | 7,000 (was 7,500) |

**Unchanged.** The minion spawns, minion periods, respawn delays and the 2,700-tick limit. Every level keeps its first boss.

**Changed.** The second boss is smaller and slower than the first, so area play stays possible. A second boss makes area play much harder, so the four targets drop to 7,000 bp. Maze also gets a third life: with two bosses, no bot reached its 9,000 bp target by area.

**Why a low gate.** Scratch runs (300 per variant, not committed) of the other layouts tried:

- **A gate across the middle** (rows 29 and 30), bosses on the far side: bold separated on 8 % to 17 % of its runs, half or more of its clears. Most of these came from its long cuts across the open lower half, between a boss that had come down and one that had not.
- **A vertical gate from the player start up:** area play nearly vanished (mix 3 % to 8 % on doom and trio).
- **The old serpentine**, five bars with one door each: a single 10-cell cut at the door between the bosses separates them. Splitter separated on 78 % to 86 % of its runs and bold on 60 % to 66 %.
- **Bars with two doors each**, five or three of them, bosses between them: separations made two thirds of the clears, and about a third of bold's separating cuts were 16 cells or fewer.

**Why no wall at the middle.** Every wall tried in round F7 was half a dividing wall: the player rests on it, and a short cut finishes the line.

- A wall across the bosses' half of the field, with both bosses on one side of it, let two short cuts capture the empty side.
- A wall between the bosses' spawn areas let two short cuts split them.

So the bosses start together, and the middle of the field stays open.

**The yard is not a safe zone.** With the player standing still (255 lives, so no run ends early), the first boss enters the yard (a body cell below row 41) at these ticks (10th, 25th, 50th, 75th and 90th percentiles over 1,000 seeds):

| Level | 10th | 25th | 50th | 75th | 90th |
|---|---:|---:|---:|---:|---:|
| 13 trio | 27 | 39 | 106 | 198 | 311 |
| 15 swarm | 18 | 34 | 89 | 172 | 278 |
| 16 doom | 23 | 63 | 128 | 267 | 442 |
| 10 maze, bottom band (below row 45) | 70 | 111 | 201 | 372 | 578 |

A boss crosses on every seed. On these runs, one boss is wholly below the gate while the other is wholly above it on 35 % to 36 % of the ticks (29 % on maze, across the middle bar).

## How early a separation is possible

Three measures, over 1,000 seeds per level, on the first version and on this one. Each comes from a probe that is not committed.

- **The owner's route.** From the start, straight up a column from 27 to 33, resting on each claimed cell it reaches and going on at once, with no waiting.
- **Perfect timing.** The probe knows the bosses' future, because the core is deterministic. It tries a family of plans: every full column from the bottom border up, every full row from either side border, and closing all doors of a bar in order. Each plan walks the rail to its start, waits for the earliest moment its next cut closes without a hit, and rests on each claimed cell. The result is the earliest tick at which any plan separates the bosses. It is a bound on what a player with that foresight could do with straight cuts, not a human measure.
- **Splitter.** The tick at which the split-seeking policy separates the bosses, on its 1,000 playtest runs.

| # | Name | Owner's route separates (seeds) | Owner's route instead claims ≥ 3,000 bp | Perfect timing: min / median / p75 tick | Splitter: before tick 150 / before 300 / earliest |
|---|---|---|---|---|---|
| 10 | maze, first version | 550 | 165 | 31 / 33 / 41 | 10 / 130 / 109 |
| 10 | maze, now | **0** | 775 | 35 / 41 / 52 | 23 / 198 / 86 |
| 13 | trio, first version | 508 | 214 | 30 / 33 / 49 | 43 / 145 / 73 |
| 13 | trio, now | **56** | 274 | 30 / 39 / 46 | 58 / 151 / 81 |
| 15 | swarm, first version | 421 | 180 | 30 / 39 / 60 | 38 / 97 / 82 |
| 15 | swarm, now | **49** | 240 | 31 / 40 / 53 | 52 / 127 / 85 |
| 16 | doom, first version | 386 | 165 | 32 / 42 / 65 | 23 / 89 / 86 |
| 16 | doom, now | **40** | 200 | 33 / 47 / 73 | 44 / 112 / 89 |

**What the owner's route does now.** With both bosses on one side, the middle cut usually takes the empty half instead of splitting the bosses. That gives a big area gain, not a clear: the half is 5,000 bp against a 7,000 bp target, and the rest must come from the half that holds both bosses.

- **Maze.** The bars keep the bosses on the left long enough that the middle cut takes the right half on 77.5 % of the seeds.
- **Trio, swarm and doom.** The middle cut claims 3,000 bp or more on 20 % to 27 % of the seeds, against 16 % to 21 % in the first version.

**Why 150 ticks is out of reach with perfect timing.** No layout tried keeps a perfectly timed player from separating the bosses before tick 150 on every seed; the target was met on none of them.

- On an open field, with spawns stacked at the centre or in the corners, the perfect-timing probe's earliest separation is 30 to 50 ticks on almost every seed.
- The fast boss crosses the field in about 30 ticks, and any cut from border to border splits the field.
- A wall only adds a resting point.

The fix therefore removes the seed-independent route, the one that worked without reading the bosses. It does not remove every early split that a player who reads the bosses can time. Splitter, which reads the bosses tick by tick but not their future, separates before tick 150 on 2.3 % to 5.8 % of its runs.

## Clear rates by route

Each cell gives the clear rate with its split by area / by separation, then the death rate, then the median effective claim. From the reference report `reports/playtest-65bd82e4d3ea.md` and `twin-levels-2026-11-27/splitter/playtest-338a768b2452.md`.

| # | Name | Mix | Bold | Committer | Splitter |
|---|---|---|---|---|---|
| 10 | maze | 31.9 % (21.1 / 10.8); 29.9 %; 4,363 | 40.1 % (26.9 / 13.2); 59.9 %; 0 | 23.8 % (15.4 / 8.4); 0 %; 4,954 | 50.2 % (21.0 / 29.2); 49.8 %; 7,000 |
| 13 | trio | 23.6 % (18.3 / 5.3); 34.9 %; 3,624 | 30.2 % (23.6 / 6.6); 69.8 %; 0 | 17.0 % (13.0 / 4.0); 0 %; 4,724 | 39.4 % (16.9 / 22.5); 60.6 %; 0 |
| 15 | swarm | 15.8 % (9.7 / 6.1); 39.7 %; 2,757 | 20.6 % (13.1 / 7.5); 79.4 %; 0 | 11.1 % (6.4 / 4.7); 0 %; 4,224 | 29.6 % (11.6 / 18.0); 70.4 %; 0 |
| 16 | doom | 12.0 % (8.5 / 3.5); 41.7 %; 2,399 | 16.5 % (12.1 / 4.4); 83.5 %; 0 | 7.6 % (4.9 / 2.7); 0 %; 3,992 | 25.5 % (10.2 / 15.3); 74.5 %; 0 |

Before M5.19 the mix cleared 27.9 %, 23.7 %, 13.4 % and 11.2 % of these slots, all by area, with medians of 7,119, 2,749, 1,816 and 1,664 bp.

**The separating cuts.** The number of cells in the trail that separated the bosses, the closing step included, over the same runs:

| # | Name | Bold: separations, median cells (Q1-Q3), ≤ 16 cells | Committer | Splitter |
|---|---|---|---|---|
| 10 | maze | 132, 28 (12-50), 47 | 84, 28 (12-60), 27 | 292, 26 (14-34), 109 |
| 13 | trio | 66, 44 (26-62), 13 | 40, 48 (36-62), 6 | 225, 34 (24-46), 30 |
| 15 | swarm | 75, 42 (26-58), 11 | 47, 48 (30-62), 6 | 180, 36 (26-42), 15 |
| 16 | doom | 44, 40 (16-58), 11 | 27, 40 (12-52), 8 | 153, 32 (22-40), 23 |

- **Trio, swarm and doom.** A short accidental separation, the last door closed by a cut of 16 cells or fewer, happens on about 1 % of bold's runs; its other separations are long cuts across the field.
- **Maze is the weak spot.** Its bands are 14 rows tall, so 4.7 % of bold's runs separate with a short cut, once its captures have closed all but one door of a bar.

## Proving cycles

Method of [`cycle-cap-2026-11-27.md`](cycle-cap-2026-11-27.md) and [`cycle-cap-twin-2026-11-27.md`](cycle-cap-twin-2026-11-27.md): the release `zk-host` of RISC Zero 3.1.0, verify image id `0xab7e545aad9126e28fd7f26f7d416c1ba73d2347746dd531424bfcbcaaabf6ff`, `RISC0_DEV_MODE` unset, executor only.

**Worst-case inputs** ([`twin-levels-2026-11-27/`](twin-levels-2026-11-27/)). Each level runs with 255 lives, as M5.18 measured level 16, so that no input ends early. A generator kept out of the repository, as M5.11's was, does the following:

- it steps from the rail into one open cell and back, capturing that cell;
- it walks the rail to the nearest cell with an open neighbour;
- it checks each move with the core over the next eight ticks;
- it paces its captures to reach the work budget near the time limit.

Each input is the heaviest of six run nonces per level, keccak256(`"jiro.cycle-cap.m519"` ‖ k).

| Input | Ticks | Work | User cycles | Proving cycles | Segments |
|---|---:|---:|---:|---:|---:|
| `10-budget` | 2,667 | 300,375 | 48,585,010 | 50,855,936 | 49 |
| `13-budget` | 2,667 | 300,388 | 47,899,413 | 50,331,648 | 48 |
| `15-budget` | 2,671 | 300,916 | 49,549,880 | 51,904,512 | 50 |
| `16-budget` | 2,688 | 302,689 | 49,958,248 | 52,428,800 | 50 |

Each input ends at the work budget and stays under the bound of 61.6 million proving cycles per level. M5.11's budget-paced inputs measured 51.5 to 54.5 million. The bound holds on any valid level with one boss or two (README §4.11), so a run stays under 370 million.

**Gate set** (`vectors/levels/`, regenerated by `calibrate`), in proving cycles:

| Level | `-worst` | `-synthetic` |
|---|---:|---:|
| 10 | 22,544,384 | 12,845,056 |
| 13 | 17,825,792 | 10,747,904 |
| 15 | 17,039,360 | 22,544,384 |
| 16 | 22,282,240 | 18,874,368 |

All 32 gate-set vectors pass `zk-host execute vectors/levels/`. The heaviest is `12-worst` (27,787,264).

## Calibration

`calibrate --check --out seasons/calibration-2.json` passes. It rewrites the calibration file, its report and the gate set in place, since no season references `calibration-2.json` yet. `seasons/testnet-1.json` takes its level ids and weights. Under the v1 payout every weight is 10,000 (README §13 D18), and M5.16 rewrites `testnet-1.json` for it, so these weights reach no player.

| # | Name | Median (bp), before M5.19 / now | Weight (bp), before M5.19 / now |
|---|---|---|---|
| 10 | maze | 7,119 / 4,363 | 14,046 / 34,380 |
| 13 | trio | 2,749 / 3,624 | 36,376 / 41,390 |
| 15 | swarm | 1,816 / 2,757 | 55,066 / 54,406 |
| 16 | doom | 1,664 / 2,399 | 60,096 / 62,526 |

P = 15,000 points (was 10,000). The twelve single-boss levels keep their medians and get new weights.

## Bot advantage

Pending: `playtest --policy search` on these four levels is running; its figures follow in this PR.

## Reproduce

```bash
cargo run -p jiro-tools --release --locked -- level build levels/src levels
cargo run -p jiro-tools --release --locked -- playtest --check levels/targets.json
cargo run -p jiro-tools --release --locked -- level build levels/src levels
cargo run -p jiro-tools --release --locked -- calibrate --check --out seasons/calibration-2.json
mkdir -p twin && cp levels/{10-maze,13-trio,15-swarm,16-doom}.bin twin/
cargo run -p jiro-tools --release --locked -- playtest --levels twin --policy splitter --out reports/twin-levels-2026-11-27/splitter
cargo run -p jiro-tools --release --locked -- playtest --levels twin --policy search --runs 100 --out reports/twin-levels-2026-11-27/search
referee/zk/target/release/zk-host execute reports/twin-levels-2026-11-27/*-budget.json vectors/levels/
```

## Not verified

- These come from probes and scratch runs that are not committed:
  - the early-separation measures;
  - the separating-cut lengths;
  - the gate crossings;
  - the rejected layouts.
- Humans have played only the first version: the owner's four journals of round F7. The second version is for round F7's second pass on the PR preview.
