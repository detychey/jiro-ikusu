# Bold bot sweep (plan M2.11)

The reference mix of Bold and Committer, and Greedy alone, on single test levels: 300 runs each,
seed 1, `jiro-tools` at fe7718d (rules version 2). Each level is `levels/src/01-open.txt` (an
open field, 5-cell boss spawning in 20,20,34,34, time limit 2,700, target 7,500 bp) with 3 lives
and the knobs listed; `m` cells are minion spawns. To reproduce a row, write its source, then run
`jiro-tools level build <dir>/src <dir>` and
`jiro-tools playtest --levels <dir> --runs 300 --seed 1 --out <dir>/out`, with
`levels/targets.json` copied into `<dir>`; add `--policy greedy` for the last column.

| Level | Knobs | Mix clear rate | Mix median effective claim | Greedy clear rate |
|---|---|---|---|---|
| L01 | `boss_period=3, lives=5` | 95.5 % | 7749 bp | 100.0 % |
| boss period 3 | `boss_period=3` | 72.5 % | 7636 bp | 100.0 % |
| boss period 2 | `boss_period=2` | 56.5 % | 7517 bp | 100.0 % |
| boss period 1 | `boss_period=1` | 36.8 % | 4714 bp | 100.0 % |
| boss period 1, three period-1 minions | `boss_period=1, minion_period=1, respawn_delay=30, m at (15,0), (45,59), (0,30)` | 28.8 % | 3504 bp | 96.0 % |
| 7-cell boss, period 1 | `boss_size=7, boss_period=1` | 19.8 % | 2488 bp | 100.0 % |
| 7-cell boss, period 1, two period-1 minions | `boss_size=7, boss_period=1, minion_period=1, respawn_delay=45, m at (15,0), (45,59)` | 19.5 % | 2607 bp | 98.6 % |
| 8-cell boss, period 1, three period-1 minions | `boss_size=8, boss_spawn=20,20,30,30, boss_period=1, minion_period=1, respawn_delay=30, m at (15,0), (45,59), (0,30)` | 18.6 % | 2461 bp | 95.3 % |
| the same, with 5 lives | `as above, lives=5` | 54.1 % | 7508 bp | 100.0 % |
| boss period 1, comb corridors | `boss_size=4, boss_spawn=5,40,50,50, boss_period=1, # at x = 8, 16, ..., 48 for y = 1 to 34` | 66.6 % | 7560 bp | 100.0 % |

- Boss speed and size, and lives, set the mix's clear rate. Minions lower it by a few points.
- Corridors raise it: with the boss confined to one corridor, the bots capture the others whole.
- Greedy alone clears 95 % to 100 % of every row.
