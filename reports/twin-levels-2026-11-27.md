# Twin-boss levels 10, 13, 15 and 16 (plan M5.19)

Measured on 2026-11-27 on rules version 5 (M5.20: the separation floor), with the release `jiro-tools` of this branch. The levels' sources are in `levels/src/`, their bytes in `levels/*.bin`, and their knobs and renders in `levels/README.md`. Every playtest figure is over 1,000 Training runs per policy and level, seed 1, on the run nonces of `jiro-tools playtest`. The reference mix is that of `levels/targets.json` (bold, committer), unchanged. `splitter`, M5.18's split-seeking test policy, is not in the mix. Its figures are given beside the mix's, for the owner's decision (plan M5.18, "Left for M5.19").

**History of round F7.**

1. **First pass.** The owner cleared doom in 66 ticks with two straight cuts up the middle. That split bosses which spawned on opposite halves, and on rules version 4 any split cleared the level.
2. **Second pass.** Both bosses spawned against the left border. The middle cut then took the empty half instead, on 77 % of maze's seeds.
3. **Third pass (this one).** Rules version 5 makes a split clear only once the claim reaches half the target. A split that comes before that floor is no longer a win, so the layouts are back to the first pass's: one boss on each half. The owner found those good on 10, 13 and 15.

## Summary

- **The layouts.**
  - **Trio, swarm and doom** keep their open field and get a **low gate**: a bar two cells thick on rows 40 and 41, from border to border, with three doors (two on doom), each wider than both bosses. The player starts in the yard below the gate.
  - **Maze** keeps its stacked bars, three instead of five (rows 15, 30 and 45), each with two or three doors, so that no single door joins two parts of the field.
  - **Spawns.** Both bosses start above the gate, or in maze's top band, one on each half of the field.
- **A split is a finisher, not an opener.** The best single straight cut made blind from tick 0 still splits the bosses on 33 % to 47 % of seeds. But with Bold playing on from that split, the level then clears on only 19 % to 34 % of all seeds, with a median clear at tick 255 to 298 (17 to 20 s), not tick 66.
- **The bands hold, in the curve's order.** Mix clear rates:

  | Level | Mix clear (band) |
  |---|---|
  | 10 maze | 29.9 % (23-33) |
  | 13 trio | 22.8 % (19-29) |
  | 15 swarm | 14.0 % (8-18) |
  | 16 doom | 10.4 % (6-16) |

  These sit between their neighbours: 39.8 % (09), 26.0 % (11), 25.9 % (12) and 16.5 % (14). The targets stay at 7,000 bp. The floor barely moves the bots' clear rates, so there was no room to raise them back.
- **The proving cycles stay under M5.11's cap.** A one-cell nibbler paced to reach the work budget takes 49.8 to 51.9 million proving cycles, against a cap of 61.6 million per level. The levels' gate-set vectors take 7.3 to 19.4 million. All of these ran on the rules-version-5 image.
- **`calibration-2.json` is regenerated in place.** P = 17,000 points, and weights run from 21,744 to 63,385 bp, a 2.9× spread.

## The four levels

| # | Name | Layout | Boss 0 | Boss 1 | Minions | Lives | Target |
|---|---|---|---|---|---|---|---|
| 10 | maze | Bars on rows 15, 30 and 45; doors 10 wide: x 1-10, 25-34, 49-58 on rows 15 and 45; x 12-21, 38-47 on row 30 | B 6, period 1, (4, 2)-(20, 4) | B 5, period 3, (34, 3)-(50, 5) | 3 × 1 (R 45), as before | 3 (was 2) | 7,000 (was 9,000) |
| 13 | trio | Low gate, doors 10 wide at x 5-14, 25-34, 45-54 | B 5, period 1, (8, 10)-(22, 20) | B 5, period 3, (36, 10)-(52, 20) | 3 × 2 (R 60), as before | 3 | 7,000 (was 7,500) |
| 15 | swarm | Low gate, doors 11 wide at x 4-14, 24-34, 44-54 | B 7, period 1, (6, 4)-(20, 10) | B 5, period 2, (34, 6)-(48, 12) | 3 × 1 (R 45), as before | 3 | 7,000 (was 7,500) |
| 16 | doom | Low gate, doors 12 wide at x 8-19, 40-51 | B 8, period 1, (6, 4)-(20, 10) | B 6, period 2, (34, 6)-(48, 12) | 3 × 1 (R 45), as before | 3 | 7,000 (was 7,500) |

- **Unchanged knobs.** The minion spawns, minion periods and respawn delays stay as before, and so does the 2,700-tick limit.
- **The bosses.** Every level keeps its first boss. The second boss is smaller and slower, so area play stays possible.
- **Targets and lives.** A second boss makes area play much harder, so the four targets drop to 7,000 bp. Maze also gets a third life: with two bosses, no bot reached its 9,000 bp target by area.

**Why a low gate.** Scratch runs of the other layouts (300 runs per variant, not committed) found:

- **A gate across the middle (rows 29 and 30), bosses on the far side.** Bold separated on 8 % to 17 % of its runs, which was half or more of its clears.
- **A vertical gate running up from the player start.** Area play nearly vanished: the mix cleared 3 % to 8 % on doom and trio.
- **The old serpentine, five bars with one door each.** A single 10-cell cut at a door separates the bosses.
- **Bars with two doors each.** Separations made two thirds of the clears.

**The yard is not a safe zone.** With the player standing still (255 lives, so no run ends early), these are the ticks at which the first boss enters the yard (a body cell below row 41), at the 10th, 25th, 50th, 75th and 90th percentiles over 1,000 seeds:

| Level | 10th | 25th | 50th | 75th | 90th |
|---|---|---|---|---|---|
| 13 trio | 25 | 54 | 105 | 204 | 318 |
| 15 swarm | 39 | 54 | 101 | 189 | 289 |
| 16 doom | 38 | 58 | 132 | 266 | 424 |
| 10 maze (bottom band, below row 45) | 96 | 135 | 240 | 388 | 603 |

A boss crosses on every seed.

## Openings

From [`twin-levels-2026-11-27/openings.md`](twin-levels-2026-11-27/openings.md), written by `jiro-tools playtest --openings` over 1,000 seeds.

**What counts as an opening.** An opening is one straight line of cuts:

- a column from the bottom border;
- a row from a side border;
- or every door of one bar.

The player walks to it on the rail and cuts it, resting on each claimed cell it reaches.

**How the probe plays it.**

- **Blind** plays from tick 0, with no waiting.
- **Timed** waits, before each cut, for the first tick from which the cut closes without a hit. That is a player who knows the bosses' future, which the core's determinism allows.
- **The best fixed line** is the one plan that works on the most seeds. It is the seed-independent route the owner found.
- **Any line** takes, on each seed, the best of all plans.

| # | Name | Best fixed line splits | Then clears (all seeds), median tick | Best fixed line captures ≥ 3,000 bp | Any line splits | Any line captures ≥ 3,000 bp | Timed split: min / median tick |
|---|---|---|---|---|---|---|---|
| 10 | maze | 46.8 % (column 30) | 33.6 %, 298 | 84.7 % (row 41) | 94.3 % | 96.4 % | 31 / 33 |
| 13 | trio | 47.0 % (column 29) | 29.1 %, 268 | 69.6 % (row 41) | 90.1 % | 96.0 % | 30 / 33 |
| 15 | swarm | 34.8 % (column 31) | 20.9 %, 265 | 69.7 % (the gate's doors) | 81.6 % | 95.4 % | 30 / 39 |
| 16 | doom | 33.2 % (column 37) | 19.3 %, 255 | 72.8 % (the gate's doors) | 75.9 % | 94.6 % | 32 / 42 |

**What the large captures are.** The largest fixed-line captures close the gate's doors from below, or cut along row 41. Both take the yard, about 30 % of the field, while both bosses are still above. That capture is an opening, not a clear.

**Why no layout removes the openings.** M5.19's second and third passes tried many layouts at 100 seeds:

- spawns against one border;
- spawns stacked at the centre;
- central doors;
- pens around the bosses;
- a smaller yard;
- an open field.

None brought the fixed-line split under 22 % and the fixed-line capture under 35 % together. Two disjoint bodies always leave a row or a column between them, and any line that closes without a hit either runs between the bosses or leaves the side away from them to be captured. This is why rules version 5 makes the split a finisher instead (README §4.8, "Why a floor").

## Clear rates by route

Each cell gives the clear rate, of which by area / by separation at the floor; then the death rate; then the median effective claim. From the reference report `reports/playtest-eebbc0206140.md` and `twin-levels-2026-11-27/splitter/playtest-f832cda54832.md`.

| # | Name | Mix | Bold | Committer | Splitter |
|---|---|---|---|---|---|
| 10 | maze | 29.9 % (22.3 / 7.5); 30.6 %; 4,495 | 38.8 % (28.9 / 9.9); 61.2 %; 0 | 21.0 % (15.8 / 5.2); 0 %; 5,082 | 47.2 % (23.6 / 23.6); 52.8 %; 0 |
| 13 | trio | 22.8 % (16.1 / 6.6); 34.5 %; 3,340 | 30.9 % (22.4 / 8.5); 69.1 %; 0 | 14.7 % (9.9 / 4.8); 0 %; 4,483 | 37.7 % (17.4 / 20.3); 62.3 %; 0 |
| 15 | swarm | 14.0 % (11.4 / 2.5); 40.2 %; 2,975 | 19.5 % (16.1 / 3.4); 80.5 %; 0 | 8.5 % (6.8 / 1.7); 0 %; 4,345 | 26.3 % (13.9 / 12.4); 73.7 %; 0 |
| 16 | doom | 10.4 % (7.5 / 2.9); 42.6 %; 2,682 | 14.8 % (10.9 / 3.9); 85.2 %; 0 | 6.1 % (4.2 / 1.9); 0 %; 4,199 | 21.4 % (9.8 / 11.6); 78.6 %; 0 |

- A clear by separation is a capture that leaves the bosses apart with the claim at the floor, half the target, but under the target.
- Before M5.19 the mix cleared 27.9 %, 23.7 %, 13.4 % and 11.2 % of these slots, all by area, with medians of 7,119, 2,749, 1,816 and 1,664 bp.

## Proving cycles

The method is that of [`cycle-cap-2026-11-27.md`](cycle-cap-2026-11-27.md), [`cycle-cap-twin-2026-11-27.md`](cycle-cap-twin-2026-11-27.md) and [`cycle-cap-separated-2026-11-27.md`](cycle-cap-separated-2026-11-27.md): the release `zk-host` of RISC Zero 3.1.0, executor only, with `RISC0_DEV_MODE` unset. Its verify image id is `0x9a81d92cbf95714f2637b0a873dd403d2c498ba3db29a4308900e37088fecbdd`, rules version 5.

**Worst-case inputs** ([`twin-levels-2026-11-27/`](twin-levels-2026-11-27/)). Each level runs with 255 lives, as M5.18 measured level 16, so that no input ends early. A generator kept out of the repository, as M5.11's was, does the following:

- it steps from the rail into one open cell and back, capturing that cell;
- it walks the rail to the nearest cell with an open neighbour;
- it checks each move with the core over the next eight ticks;
- it paces its captures to reach the work budget near the time limit.

Each input is the heaviest of six run nonces per level (keccak256(`"jiro.cycle-cap.m519"` ‖ k)).

| Input | Ticks | Work | User cycles | Proving cycles | Segments |
|---|---:|---:|---:|---:|---:|
| `10-budget` | 2,667 | 300,375 | 48,311,599 | 50,593,792 | 49 |
| `13-budget` | 2,667 | 300,388 | 47,624,133 | 49,807,360 | 48 |
| `15-budget` | 2,671 | 300,916 | 49,297,205 | 51,511,296 | 50 |
| `16-budget` | 2,688 | 302,689 | 49,615,004 | 51,904,512 | 50 |

Each input ends at the work budget and stays under the bound of 61.6 million proving cycles per level. The bound holds on any valid level with one boss or two (README §4.11), so a run stays under 370 million.

**Gate set** (`vectors/levels/`, regenerated by `calibrate`), in proving cycles:

| Level | `NN-worst` | `NN-synthetic` |
|---|---:|---:|
| 10 | 7,340,032 | 13,631,488 |
| 13 | 7,340,032 | 19,398,656 |
| 15 | 18,874,368 | 17,301,504 |
| 16 | 17,858,560 | 11,534,336 |

All 32 gate-set vectors pass `zk-host execute vectors/levels/`. The heaviest is `12-worst` (27,525,120).

## Calibration

`calibrate --check --out seasons/calibration-2.json` passes. It rewrites the file, its report and the gate set in place, since no season references `calibration-2.json` yet. `seasons/testnet-1.json` takes the new level ids, weights and rules version 5. Under the v1 payout every weight is 10,000 (README §13 D18), and M5.16 rewrites `testnet-1.json` for it, so these weights reach no player.

| # | Name | Median (bp), before M5.19 / now | Weight (bp), before M5.19 / now |
|---|---|---|---|
| 10 | maze | 7,119 / 4,495 | 14,046 / 37,819 |
| 13 | trio | 2,749 / 3,340 | 36,376 / 50,898 |
| 15 | swarm | 1,816 / 2,975 | 55,066 / 57,142 |
| 16 | doom | 1,664 / 2,682 | 60,096 / 63,385 |

P = 17,000 points, up from 10,000. The twelve single-boss levels keep their medians and get new weights.

## Bot advantage

Pending. `playtest --policy search` (100 runs per level) is rerunning on these four levels; its figures follow in this PR. The second pass measured search median over mix median at 1.93 (maze), 2.77 (trio), 2.98 (swarm) and 3.25 (doom) on rules version 4.

## Reproduce

```bash
cargo run -p jiro-tools --release --locked -- level build levels/src levels
cargo run -p jiro-tools --release --locked -- playtest --check levels/targets.json
cargo run -p jiro-tools --release --locked -- level build levels/src levels
cargo run -p jiro-tools --release --locked -- calibrate --check --out seasons/calibration-2.json
cargo run -p jiro-tools --release --locked -- playtest --openings --out reports/twin-levels-2026-11-27/openings.md
mkdir -p twin && cp levels/{10-maze,13-trio,15-swarm,16-doom}.bin twin/
cargo run -p jiro-tools --release --locked -- playtest --levels twin --policy splitter --out reports/twin-levels-2026-11-27/splitter
cargo run -p jiro-tools --release --locked -- playtest --levels twin --policy search --runs 100 --out reports/twin-levels-2026-11-27/search
referee/zk/target/release/zk-host execute reports/twin-levels-2026-11-27/*-budget.json vectors/levels/
```

## Not verified

- These come from probes and scratch runs that are not committed:
  - the gate crossings;
  - the rejected layouts;
  - the budget-input generator.
- The owner has played the first and second versions on rules version 4. This version is for round F7's third pass.
