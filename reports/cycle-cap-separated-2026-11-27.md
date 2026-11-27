# Proving-cycle cap with separated bosses (plan M5.20)

Measured on 2026-11-27 at rules version 5, by the method of [`cycle-cap-twin-2026-11-27.md`](cycle-cap-twin-2026-11-27.md) (M5.18): the release `zk-host` of RISC Zero 3.1.0, built at the fixed path, verify image id `0x9a81d92cbf95714f2637b0a873dd403d2c498ba3db29a4308900e37088fecbdd`, executor only, `RISC0_DEV_MODE` unset. The inputs are in [`cycle-cap-separated-2026-11-27/`](cycle-cap-separated-2026-11-27/): game vectors that `zk-host execute` checks against the native core.

## Why measure again

Under rules version 4 a separating capture ended the level, so a level ran both fills of R4.8-5 at most once. Under rules version 5 a separation under the floor leaves both regions open, and every later capture runs both fills. Their cells are counted in the work (R4.11-2), and together they mark at most the 3,364 interior cells, each pushed once, so a capture's work stays at most 150 + 3,364. What remains to check is that the second fill costs no more per counted cell than the first.

## Inputs

The open field with both bosses still (move period 255) and 255 lives: boss 0 of B = 5 and boss 1 of B = 4. The player cuts up column 30, then nibbles one-cell captures beside the rail, as the `work-budget` vector does, until the work budget ends the level.

| Input | Bosses | Separated | Ticks | Captures | Work | User cycles | Proving cycles | User cycles per unit of work |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `budget-twin-apart` | (5, 10) and (45, 10), either side of column 30 | yes, from the first capture | 273 | 88 | 300,300 | 43,832,925 | 46,137,344 | 146.0 |
| `budget-twin-together` | (35, 10) and (45, 30), both right of column 30 | no | 694 | 178 | 300,019 | 44,524,386 | 46,661,632 | 148.4 |

## Result

With the bosses apart, every capture after the first runs both fills, and the level costs 146 user cycles per unit of work, against 148 with the bosses together, which makes more captures and ticks for the same work. The second fill adds nothing measurable beyond the cells it is charged for, and both stay under M5.11's 152 cycles per unit. So the bound of README §4.11 stays **61.6 million proving cycles per level and 370 million per run**.

## Reproduce

```bash
cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host   # at the fixed path
referee/zk/target/release/zk-host execute reports/cycle-cap-separated-2026-11-27/
```
