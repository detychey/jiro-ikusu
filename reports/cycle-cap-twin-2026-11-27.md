# Proving-cycle cap with two bosses (plan M5.18)

Measured on 2026-11-27 at `7deb29b` (rules version 4). The method is that of [`cycle-cap-2026-11-27.md`](cycle-cap-2026-11-27.md) (M5.11). The binary is the release `zk-host` of RISC Zero 3.1.0, built at the fixed path, verify image id `0xab7e545aad9126e28fd7f26f7d416c1ba73d2347746dd531424bfcbcaaabf6ff`. `RISC0_DEV_MODE` was unset, and only the executor ran (no proof). The inputs are in [`cycle-cap-twin-2026-11-27/`](cycle-cap-twin-2026-11-27/). They are game vectors that `zk-host execute` checks against the native core.

## Summary

- **The cap does not move: 370 million proving cycles per run** (61.6 million per level). A second boss adds about 678 user cycles per tick at its heaviest, with B = 8 moving every tick. A capture costs about 430 more. Even the heaviest level stays well inside M5.11's bound, which allows 3,000 cycles per tick.
- **The per-capture constant is about 23,360 user cycles**, against M5.11's 22,930. The cost per filled cell is unchanged. A separating capture fills both regions, but each cell is still pushed once, and those cells are counted in the work (R4.11-2). The level then ends, so a level has at most one such capture.

## Inputs

Level 16 doom (B = 8, period 1, three minions moving every tick) is given 255 lives so that no input ends early. Its twin adds a second boss with B = 8, period 1 and spawn rectangle (40, 40) to (48, 48). Every input is played with the run nonce keccak256(`"jiro.cycle-cap.twin"`) at `levelIndex` 0. The table gives each input's work, which the native core reports.

| Input | Play | Ticks | Captures | Work | User cycles | Proving cycles | Segments |
|---|---|---:|---:|---:|---:|---:|---:|
| `16-still-single` | stands still | 2,700 | 0 | 0 | 5,789,583 | 6,291,456 | 6 |
| `16-still-twin` | stands still | 2,700 | 0 | 0 | 7,619,444 | 8,388,608 | 8 |
| `16-budget-single` | one-cell nibbles until the work budget | 260 | 87 | 301,890 | 44,809,807 | 47,185,920 | 45 |
| `16-budget-twin` | the same journal's policy, twin level | 260 | 87 | 301,890 | 45,023,343 | 47,185,920 | 45 |

- **Per tick.** (7,619,444 − 5,789,583) / 2,700 = **678 user cycles** for the second boss, which moves every tick: its deflection draw, and two edges of 8 cells, each tested against the grid and against the other body. With the other body in boss 0's edge tests, the standing-still twin level costs about 2,560 cycles a tick, the level's fixed 0.70 million aside. Level 16's fitted per-tick cost in capture-heavy play was 1,673 (M5.11 §1). With a second boss it is at most about 2,350, under the bound's allowance of 3,000.
- **Per capture.** The two budget inputs make the same 87 captures with the same work. The twin costs 213,536 cycles more: 260 × 678 for its boss, and 37,310 for 87 captures, about **430 a capture**. That covers the player's body test against both bosses and the separation test of R4.8-5. So the per-capture constant is about 23,360 against 22,930: 2 %.

## The bound

M5.11's bound per level is 0.70 million + 2,700 ticks × (3,000 + 679) + 153 × (budget + 14,300), times 1.05.

- A second boss fits in the per-tick allowance. With it, the heaviest level spends about 2,350 cycles a tick, leaving 650 × 2,700 = 1.76 million cycles of slack.
- The capture's extra 430 cycles cost at most 1,350 × 430 = 0.58 million per level, since a level makes at most 1,350 captures. That fits in the slack.
- The most one tick can add past the budget is unchanged at 14,300. Both fills of a separation together mark at most the 3,364 interior cells.

So the bound stays **61.6 million proving cycles per level and 370 million per run**, on any valid level, with one boss or two. The twin budget input measures 47.2 million, as the single one does.

## Not verified

- No twin input combines the budget with long respawn searches. M5.11's searches are unchanged by a second boss.
- M5.19's twin levels are not built yet. Their worst-case inputs belong to that item.

## Reproduce

```bash
cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host   # at the fixed path
referee/zk/target/release/zk-host execute reports/cycle-cap-twin-2026-11-27/
```
