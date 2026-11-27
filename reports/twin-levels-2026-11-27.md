# Twin-boss levels 10, 13, 15 and 16 (plan M5.19)

Measured on 2026-11-27 on rules version 4 (M5.18), with the release `jiro-tools` of this branch. The four levels are the sources of `levels/src/` and the bytes of `levels/*.bin`; `levels/README.md` holds their knobs and renders. Every playtest figure is over 1,000 Training runs per policy and level, seed 1, the run nonces of `jiro-tools playtest`. The reference mix is that of `levels/targets.json` (bold, committer), unchanged. `splitter`, M5.18's split-seeking test policy, is not in the mix; its figures are reported beside it, for the owner's decision (plan M5.18, "Left for M5.19").

## Summary

- **The layouts.** Trio, swarm and doom keep their open field and get a **low gate**: a bar two cells thick on rows 40 and 41, from border to border, with three doors (two on doom), each wider than both bosses. Both bosses start above it, in the big field, and the player starts in the yard below it. Maze keeps its stacked bars, three instead of five (rows 15, 30 and 45), each with two or three doors, so that no single door joins two parts of the field; both bosses start in the top band.
- **The separation route.** To split the bosses, a player closes every door of one bar while a boss is on each side of it: two or three cuts across doors, the last one timed, at a door the bosses use. A careless cut seldom does it: bold separates on 4.3 % to 10.4 % of its runs, mostly with long cuts (median 44 to 50 cells on 13, 15 and 16), and splitter, which takes a separating cut whenever one is safe, separates two to three times as often.
- **The bands hold, in the curve's order.** Mix clear rates: maze 30.0 % (band 23-33), trio 23.1 % (19-29), swarm 14.7 % (8-18), doom 10.7 % (6-16), between their neighbours 39.8 % (09), 26.0 % (11), 25.9 % (12) and 16.5 % (14). About a quarter to a third of the mix's clears are separations.
- **The proving cycles stay under M5.11's cap.** A one-cell nibbler paced to reach the work budget near the time limit takes 50.3 to 52.4 million proving cycles on the four levels, under the 61.6 million per level; their gate-set vectors take 7.3 to 19.9 million.
- **`calibration-2.json` is regenerated in place.** The lowest median, doom's, rises from 1,664 bp to 2,688 bp, so P rises from 10,000 to 17,000 points and every weight moves: 21,744 to 63,244 bp, a spread of 2.9× instead of 4.7×.

## The four levels

| # | Name | Layout | Boss 0 | Boss 1 | Minions | Lives | Target |
|---|---|---|---|---|---|---|---|
| 10 | maze | Bars on rows 15, 30 and 45: doors 10 wide at x 1-10, 25-34, 49-58 (rows 15, 45) and 12-21, 38-47 (row 30) | B 6, period 1, (4, 2)-(20, 4) | B 5, period 3, (34, 3)-(50, 5) | 3 × 1 (R 45), as before | 3 (was 2) | 7,000 (was 9,000) |
| 13 | trio | Low gate, doors 10 wide at x 5-14, 25-34, 45-54 | B 5, period 1, (8, 10)-(22, 20) | B 5, period 3, (36, 10)-(52, 20) | 3 × 2 (R 60), as before | 3 | 7,000 (was 7,500) |
| 15 | swarm | Low gate, doors 11 wide at x 4-14, 24-34, 44-54 | B 7, period 1, (6, 4)-(20, 10) | B 5, period 2, (34, 6)-(48, 12) | 3 × 1 (R 45), as before | 3 | 7,000 (was 7,500) |
| 16 | doom | Low gate, doors 12 wide at x 8-19, 40-51 | B 8, period 1, (6, 4)-(20, 10) | B 6, period 2, (34, 6)-(48, 12) | 3 × 1 (R 45), as before | 3 | 7,000 (was 7,500) |

The minion spawns, minion periods, respawn delays and the 2,700-tick limit are unchanged. Every level keeps its first boss; the second is smaller and slower, so area play stays possible. A second boss makes area play much harder, so the four targets drop to 7,000 bp, and maze, whose 9,000 bp target no bot reached by area with two bosses, also gets a third life.

**Why a low gate.** Scratch runs (300 per variant, not committed) of the other layouts tried:

- A gate across the middle (rows 29 and 30), bosses on the far side: bold separated on 8 % to 17 % of its runs, half or more of its clears, mostly when its long cuts across the open lower half ran between a boss that had come down and one that had not.
- A vertical gate from the player start up: area play nearly vanished (mix 3 % to 8 % on doom and trio).
- The old serpentine, five bars with one door each: a single 10-cell cut at the door between the bosses separates them; splitter separated on 78 % to 86 % of its runs and bold on 60 % to 66 %.
- Bars with two doors each, five or three of them, bosses between them: separations made two thirds of the clears, and about a third of bold's separating cuts were 16 cells or fewer.

With the gate low, the bosses start far from the player, bold's first cuts fill the yard, and the open field above is still split only by a long cut.

**The yard is not a safe zone.** With the player standing still (255 lives, so no run ends early), the first boss enters the yard (a body cell below row 41) at tick 25 / 54 / 105 / 204 / 318 (10th, 25th, 50th, 75th, 90th percentiles over 1,000 seeds) on trio, 39 / 54 / 101 / 189 / 289 on swarm and 38 / 58 / 132 / 266 / 424 on doom; on maze the first boss reaches the bottom band (below row 45) at 96 / 135 / 240 / 388 / 603. On every seed a boss crosses. On these runs a boss is wholly below the gate while the other is wholly above it on 35 % to 37 % of the ticks (29 % on maze, across the middle bar).

## Clear rates by route

Clear rate, of which by area / by separation; then death rate, and the effective claim's median. From `reports/playtest-eebbc0206140.md` (the reference report) and `twin-levels-2026-11-27/splitter/playtest-f832cda54832.md`.

| # | Name | Mix | Bold | Committer | Splitter |
|---|---|---|---|---|---|
| 10 | maze | 30.0 % (22.0 / 7.9); 30.5 %; 4,510 | 38.9 % (28.5 / 10.4); 61.1 %; 0 | 21.1 % (15.6 / 5.5); 0 %; 5,082 | 47.7 % (23.5 / 24.2); 52.3 %; 0 |
| 13 | trio | 23.1 % (16.0 / 7.0); 34.5 %; 3,370 | 31.0 % (22.2 / 8.8); 69.0 %; 0 | 15.2 % (9.9 / 5.3); 0 %; 4,510 | 39.0 % (17.4 / 21.6); 61.0 %; 0 |
| 15 | swarm | 14.7 % (11.4 / 3.3); 39.8 %; 3,017 | 20.4 % (16.1 / 4.3); 79.6 %; 0 | 9.1 % (6.8 / 2.3); 0 %; 4,378 | 27.9 % (13.9 / 14.0); 72.1 %; 0 |
| 16 | doom | 10.7 % (7.4 / 3.3); 42.4 %; 2,688 | 15.2 % (10.8 / 4.4); 84.8 %; 0 | 6.3 % (4.1 / 2.2); 0 %; 4,205 | 23.0 % (9.7 / 13.3); 77.0 %; 0 |

Before M5.19 the mix cleared 27.9 %, 23.7 %, 13.4 % and 11.2 % of these slots, all by area, with medians of 7,119, 2,749, 1,816 and 1,664 bp.

**The separating cuts.** The cells of the trail that separated the bosses, the closing step included, over the same runs:

| # | Name | Bold: separations, median cells (Q1-Q3), ≤ 16 cells | Committer | Splitter |
|---|---|---|---|---|
| 10 | maze | 104, 24 (10-38), 39 | 55, 32 (12-44), 15 | 242, 26 (14-32), 87 |
| 13 | trio | 88, 48 (30-62), 12 | 53, 50 (38-66), 3 | 216, 34 (26-44), 13 |
| 15 | swarm | 43, 50 (36-66), 3 | 23, 58 (44-64), 1 | 140, 34 (26-42), 11 |
| 16 | doom | 44, 44 (14-62), 11 | 22, 54 (40-62), 3 | 133, 32 (24-40), 16 |

On trio, swarm and doom, a short accidental separation, the last door closed by a cut of 16 cells or fewer, happens on 0.3 % to 1.2 % of bold's runs; the rest are long cuts across the field. Maze is the weak spot: its bands are 14 rows tall, so 3.9 % of bold's runs separate with a short cut, once its captures have closed all but one door of a bar.

## Proving cycles

Method of [`cycle-cap-2026-11-27.md`](cycle-cap-2026-11-27.md) and [`cycle-cap-twin-2026-11-27.md`](cycle-cap-twin-2026-11-27.md): the release `zk-host` of RISC Zero 3.1.0, verify image id `0xab7e545aad9126e28fd7f26f7d416c1ba73d2347746dd531424bfcbcaaabf6ff`, `RISC0_DEV_MODE` unset, executor only.

**Worst-case inputs** ([`twin-levels-2026-11-27/`](twin-levels-2026-11-27/)): each level with 255 lives, as M5.18 measured level 16, so that no input ends early. A generator kept out of the repository, as M5.11's was, steps from the rail into one open cell and back, capturing that cell, walks the rail to the nearest cell with an open neighbour, checks each move with the core over the next eight ticks, and paces its captures to reach the work budget near the time limit; the heaviest of six run nonces per level (keccak256(`"jiro.cycle-cap.m519"` ‖ k)).

| Input | Ticks | Captures | Work | User cycles | Proving cycles | Segments |
|---|---:|---:|---:|---:|---:|---:|
| `10-budget` | 2,667 | 89 | 300,375 | 48,598,714 | 50,855,936 | 49 |
| `13-budget` | 2,667 | 88 | 300,388 | 47,911,410 | 50,331,648 | 48 |
| `15-budget` | 2,671 | 88 | 300,916 | 49,585,010 | 51,904,512 | 50 |
| `16-budget` | 2,688 | 89 | 302,689 | 49,904,433 | 52,428,800 | 50 |

Each ends at the work budget and stays under the bound of 61.6 million proving cycles per level, within M5.11's measured 51.5 to 54.5 million for budget-paced inputs. The bound holds on any valid level with one boss or two (README §4.11), so a run stays under 370 million.

**Gate set** (`vectors/levels/`, regenerated by `calibrate`): `10-worst` 7,340,032 and `10-synthetic` 13,631,488 proving cycles; `13-worst` 7,340,032 and `13-synthetic` 19,922,944; `15-worst` 18,874,368 and `15-synthetic` 17,825,792; `16-worst` 17,956,864 and `16-synthetic` 11,534,336. All 32 pass `zk-host execute vectors/levels/`. The heaviest gate vector is now `12-worst` (27,787,264), no longer `10-worst`.

## Calibration

`calibrate --check --out seasons/calibration-2.json` passes and rewrites the file, its report and the gate set in place: no season references `calibration-2.json` yet. `seasons/testnet-1.json` takes its level ids and weights. Under the v1 payout every weight is 10,000 (README §13 D18), and M5.16 rewrites `testnet-1.json` for it, so these weights reach no player.

| # | Name | Median (bp), before / after | Weight (bp), before / after |
|---|---|---|---|
| 10 | maze | 7,119 / 4,510 | 14,046 / 37,694 |
| 13 | trio | 2,749 / 3,370 | 36,376 / 50,445 |
| 15 | swarm | 1,816 / 3,017 | 55,066 / 56,347 |
| 16 | doom | 1,664 / 2,688 | 60,096 / 63,244 |

P = 17,000 points (was 10,000), so the twelve single-boss levels keep their medians and get new weights.

## Bot advantage

`playtest --policy search`, 100 Training runs per level, seed 1, on the four levels ([`twin-levels-2026-11-27/search/`](twin-levels-2026-11-27/search/)), about 2.5 h on 4 CPUs. Search clears every run. The study of [`bot-advantage.md`](bot-advantage.md) (plan M4.13, 200 Challenge runs) was not rerun: it plays six-level runs on the old levels.

| # | Name | Search: clear (area / separation); claim Q1 / median / Q3 (bp) | Mix median | Search median / mix median | Before: search mean / mix median |
|---|---|---|---|---|---|
| 10 | maze | 100 % (90 / 10); 8,171 / 8,724 / 9,073 | 4,510 | 1.93 | 9,816 / 7,119 = 1.38 |
| 13 | trio | 100 % (99 / 1); 9,177 / 9,334 / 9,449 | 3,370 | 2.77 | 9,817 / 2,749 = 3.57 |
| 15 | swarm | 100 % (100 / 0); 8,732 / 8,992 / 9,203 | 3,017 | 2.98 | 9,662 / 1,816 = 5.32 |
| 16 | doom | 100 % (100 / 0); 8,574 / 8,737 / 8,980 | 2,688 | 3.25 | 9,580 / 1,664 = 5.76 |

The "before" column takes search's mean claim from the M4.13 study and the mix median of the last reference report on the old levels (`playtest-b0b72cb41408`); the report gives no mean, so the new column uses search's median. On trio, swarm and doom the gap narrows, from about 3.6 to 5.8 times the mix median to 2.8 to 3.3: two bosses cost search about 500 to 1,100 bp of claim, while the mix's banked claims rise. On maze it widens, from 1.38 to 1.93, as the mix loses the 9,000 bp target that lifted its median. Search ignores the separation, which pays only the target, except on maze (10 % of its clears) and trio (1 %).

## Reproduce

```bash
cargo run -p jiro-tools --release --locked -- level build levels/src levels
cargo run -p jiro-tools --release --locked -- playtest --check levels/targets.json
cargo run -p jiro-tools --release --locked -- level build levels/src levels
cargo run -p jiro-tools --release --locked -- calibrate --check --out seasons/calibration-2.json
mkdir -p twin && cp levels/{10-maze,13-trio,15-swarm,16-doom}.bin twin/
cargo run -p jiro-tools --release --locked -- playtest --levels twin --policy splitter --out reports/twin-levels-2026-11-27/splitter
cargo run -p jiro-tools --release --locked -- playtest --levels twin --policy search --runs 100 --out reports/twin-levels-2026-11-27/search
referee/zk/target/release/zk-host execute reports/twin-levels-2026-11-27/ vectors/levels/
```

## Not verified

- The separating-cut lengths, the gate crossings and the rejected layouts come from probes and scratch runs that are not committed.
- No human journal on the new levels yet: the owner plays them on the PR preview (round F7).
