# GPU benchmark summary

- Session 1: 2026-11-26T17:32:31Z, commit 0d5f7c6 (0 tracked files changed), NVIDIA GeForce RTX 4090 GPU-f433bd8a-1ab2-bfb4-7d69-d65da5726404, 24564 MiB, driver 595.112.07, 80 CPUs, zk-host sha256 d12e7856e43b, set-up and build 2099 s

## Warm proofs, at every segment size

| Input | Segment limit | Segments | Proving cycles | Proofs | Sessions | Wall s, median (min–max) | Segment proofs s | Recursion s | Groth16 s | Wall s per segment | Peak GPU MiB | VmHWM GiB | SM clock MHz | GPU busy % | Max °C | CPU s | CPU wait s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| run1 | 2^19 | 27 | 14,155,776 | 1 | 1 | 48.4 (48.4–48.4) | 19.4 | 21.8 | 6.5 | 1.79 | 9,552 | 2.9 | 2,835 | 36 | 73 | 55.5 | 0.0 |
| heaviest | 2^19 | 272 | 142,606,336 | 1 | 1 | 427.2 (427.2–427.2) | 190.7 | 225.3 | 6.5 | 1.57 | 9,364 | 3.0 | 2,820 | 28 | 75 | 483.9 | 0.2 |
| small | 2^20 | 7 | 7,340,032 | 3 | 1 | 22.3 (22.2–22.3) | 9.5 | 5.4 | 6.5 | 3.19 | 13,258 | 3.0 | 2,828 | 20 | 71 | 25.7 | 0.0 |
| run1 | 2^20 | 13 | 13,631,488 | 3 | 1 | 35.3 (35.2–36.0) | 17.3 | 10.4 | 6.6 | 2.72 | 13,356 | 3.0 | 2,820 | 26 | 70 | 40.5 | 0.0 |
| mid | 2^20 | 45 | 46,661,632 | 3 | 1 | 104.2 (103.4–104.7) | 58.7 | 36.6 | 6.7 | 2.32 | 13,368 | 3.0 | 2,820 | 34 | 75 | 118.4 | 0.0 |
| high | 2^20 | 96 | 100,663,296 | 3 | 1 | 214.2 (213.2–214.8) | 124.9 | 79.0 | 6.5 | 2.23 | 13,364 | 3.0 | 2,820 | 34 | 75 | 242.9 | 0.1 |
| heaviest | 2^20 | 131 | 136,577,024 | 3 | 1 | 288.8 (287.5–289.3) | 169.3 | 108.2 | 6.6 | 2.20 | 13,364 | 3.0 | 2,820 | 35 | 78 | 327.0 | 0.1 |
| overcap | 2^20 | 177 | 185,597,952 | 3 | 1 | 388.3 (387.4–399.2) | 230.1 | 145.6 | 6.7 | 2.19 | 13,667 | 3.0 | 2,820 | 38 | 79 | 440.2 | 0.1 |
| run1 | 2^21 | 7 | 13,107,200 | 1 | 1 | 28.4 (28.4–28.4) | 15.7 | 5.4 | 6.5 | 4.06 | 22,470 | 3.0 | 2,820 | 18 | 70 | 32.9 | 0.0 |
| heaviest | 2^21 | 64 | 134,217,728 | 1 | 1 | 219.5 (219.5–219.5) | 155.4 | 52.9 | 6.7 | 3.43 | 22,454 | 3.0 | 2,820 | 44 | 76 | 248.3 | 0.1 |

- small-p20-cold1: ok, wall 22.2 s
- small-p20-sentinel1: ok, wall 22.2 s

## Model at 2^20: wall = a + b × segments

Fit on each input's median wall time: a = 7.3 s, b = 2.15 s per segment, R² = 1.0000.
- small: 7 segments, 22.3 s, fit 22.4 s
- run1: 13 segments, 35.3 s, fit 35.3 s
- mid: 45 segments, 104.2 s, fit 104.2 s
- high: 96 segments, 214.2 s, fit 213.9 s
- heaviest: 131 segments, 288.8 s, fit 289.2 s
- overcap: 177 segments, 388.3 s, fit 388.2 s

Per phase, on the same medians:
- total_s: a = 6.6, b = 2.12 per segment, R² = 1.0000
- segment_proofs_s: a = 0.4, b = 1.30 per segment, R² = 1.0000
- recursion_s: a = -0.4, b = 0.83 per segment, R² = 1.0000
- groth16_s: a = 6.6, b = 0.00 per segment, R² = 0.1520
- vmhwm_kib: a = 3,090,079.5, b = 538.33 per segment, R² = 0.9996

Segment size: stay at 2^20: GPU peak 22454 of 24564 MiB, VmHWM 3.0 of 46.6 GiB, wall 219.5 s against 288.8 s.

## Cost per run at 0.89 USD an hour, ETH at 1,700 USD (estimates)

Settling one run, the same whatever its proving cycles: 530,256 gas for run 1 (7,300 bytes of calldata, measured) to about 1,000,000 for a whole bot run's longer journals (docs/DEPLOYMENT.md, Funding; an estimate), × 0.02 gwei: 0.0000106 to 0.0000200 ETH, 2.7 to 5.0 runs' rake at 80%. Arbitrum's L1 data fee comes on top: 0 on Arbitrum Sepolia today; on Arbitrum One at most 16 gas × 0.05 gwei per calldata byte before compression, 0.0000058 ETH for run 1's bytes, 1.5 runs' rake at 80%.
Rake of one run on testnet-1: 0.0000050 ETH (0.0085 USD), 80% of it 0.0000040 ETH.
Session overhead: set-up and build 2,099 s, cold start 0.0 s more than a warm proof: 2,099 s, 0.519 USD, 0.0173 USD a run when a session proves 30 runs. Grace of 172,800 s.

| Run | Proving cycles | Segments | Wall s | Runs per hour | Proving USD | Proving USD, set-up shared by 30 | Proving + settling: runs' rake at 80% | Runs in the grace, margin 2 |
|---|---|---|---|---|---|---|---|---|
| small | 7,340,032 | 7 | 22.3 | 161.4 | 0.0055 | 0.0228 | 6.0–8.4 | 3,827 |
| run1 | 13,631,488 | 13 | 35.3 | 102.0 | 0.0087 | 0.0260 | 6.5–8.8 | 2,417 |
| mid | 46,661,632 | 45 | 104.2 | 34.5 | 0.0258 | 0.0431 | 9.0–11.3 | 819 |
| high | 100,663,296 | 96 | 214.2 | 16.8 | 0.0530 | 0.0703 | 13.0–15.3 | 398 |
| heaviest | 136,577,024 | 131 | 288.8 | 12.5 | 0.0714 | 0.0887 | 15.7–18.0 | 295 |
| overcap | 185,597,952 | 177 | 388.3 | 9.3 | 0.0960 | 0.1133 | 19.3–21.7 | 219 |
| search bot, mean | 16,000,000 | 16 | 41.7 | 86.2 | 0.0103 | 0.0276 | 6.7–9.1 | 2,044 |
| random-walk, mean | 20,600,000 | 20 | 50.4 | 71.5 | 0.0124 | 0.0297 | 7.0–9.4 | 1,694 |
| random-walk, max | 42,000,000 | 41 | 95.5 | 37.7 | 0.0236 | 0.0409 | 8.7–11.0 | 893 |
| bold/committer, mean | 44,600,000 | 43 | 99.8 | 36.1 | 0.0247 | 0.0420 | 8.8–11.2 | 854 |
| bold/committer, max | 61,000,000 | 59 | 134.3 | 26.8 | 0.0332 | 0.0505 | 10.1–12.4 | 635 |
| greedy bot, mean | 54,400,000 | 52 | 119.2 | 30.2 | 0.0295 | 0.0468 | 9.5–11.9 | 715 |
| greedy bot, max | 79,000,000 | 76 | 170.9 | 21.1 | 0.0422 | 0.0595 | 11.4–13.8 | 499 |
| edge-nibbler, mean | 69,700,000 | 67 | 151.5 | 23.8 | 0.0375 | 0.0547 | 10.7–13.1 | 563 |
| edge-nibbler, max | 102,000,000 | 98 | 218.2 | 16.5 | 0.0539 | 0.0712 | 13.1–15.5 | 391 |
| proposed cap | 150,000,000 | 144 | 317.2 | 11.4 | 0.0784 | 0.0957 | 16.7–19.1 | 269 |
| cost-maximising legal run (estimate), not measured: 16x the largest input | 2,900,000,000 | 2766 | 5,959.1 | 0.6 | 1.4732 | 1.4905 | 221.8–224.2 | 14 |

## Against 4 CPUs

- small, segment_proofs_s: 2,772.9 s on 4 CPUs, 9.5 s here, 292x
- small, recursion_s: 357.0 s on 4 CPUs, 5.4 s here, 66x
- small, groth16_s: 167.3 s on 4 CPUs, 6.5 s here, 26x
- small, total_s: 3,297.2 s on 4 CPUs, 21.4 s here, 154x
- run1, segment_proofs_s: 3,831.8 s on 4 CPUs, 17.3 s here, 221x
- run1, recursion_s: 561.0 s on 4 CPUs, 10.4 s here, 54x
- run1, groth16_s: 122.5 s on 4 CPUs, 6.6 s here, 19x
- run1, total_s: 4,515.3 s on 4 CPUs, 34.2 s here, 132x

## Acceptance criteria

| # | Criterion | Verdict | Detail |
|---|---|---|---|
| A1 | image id | PASS | every proof: 0xc9634ada0eab5e9a7bb0a9ddce14df5634f7dddd2caac79416ae3cd8eda915a8 |
| A2 | local proofs (C2, C3, C4) | PASS | verified with a 260-byte seal, the same public values per input, run 1's equal to the CPU proof's |
| A3 | onchain (C5) | PENDING | off the pod: bash referee/zk/gpu-onchain.sh gpu-bench, run 1 at 20310 |
| A4 | repeat spread within 5% or 3 s | PASS | small 0.4%, run1 2.3%, mid 1.2%, high 0.7%, heaviest 0.6%, overcap 3.0% |
| A5 | no slowdown, steady clock, idle card before each proof | PASS | 19 proofs, no slowdown; inputs' median clocks 2820 to 2831 MHz; power limit 450.00 W, default 450.00 W |
| A6 | linear model | PASS | R^2 1.0000; residuals over 5% and 3 s: none; overcap predicted without it within -0.1% |
| A7 | complete | PASS | 3 or more warm proofs of every input |
| A8 | drift within 5% (the sentinel: or 3 s) | PASS | 1 sentinel(s) and 3 round(s) within 5% |
