# Audit notes: cost and performance of verification

Lens: what it costs, in cycles, gas, ETH and hours, to verify that a Challenge run was completed, and whether any optimization changes the answer to "can the player prove it himself, in the browser?".

Repository: `the repository root` at `f52a60a`, read only. `git status --short` was empty before and after this work. Everything this audit built is under `scratchpad/audit/` (called `audit/` below). The zk host was not built, Docker was not run, nothing was fetched.

## 0. Short answers

1. **Where the cycles go.** 75% of a replay's cycles are capture (README §4.8): 70.6% the flood fill (`core/src/grid.rs:70-96`), which refills the boss's whole remaining region at every capture at about 165 instructions per cell, and 4.8% the pass over the 3,600 cells. Level validation is 4.4%, software keccak 4.4%, and the tick loop with boss, minions, player and hits 15%.
2. **What one verified run costs.** 0.0000345 ETH, 69% of the 0.00005 ETH fee (58% with short journals), before Arbitrum One's L1 data fee, which nobody measured. The rake that pays the operator is 10% (testnet-0) to 20% (cap).
3. **Latency.** 9 to 11 hours of 4-CPU proving per real bot run, 16 to 17 for the heaviest gate-set run, against a grace of 24 h (testnet-0) or 48 h (proposed). A season on CPUs settles a handful of players. The scalable route is a two-prover market that the project has never used.
4. **Optimizations.** A 15-line rewrite of the same fill halves the cycles (measured on a scratch copy, all 75 vectors still reproduce). A fill bounded by the captured side would cut them to about a quarter (estimated). Accelerated keccak saves at most 4.4%. Proving levels separately saves nothing and costs six verifications.
5. **Browser proving.** No. Six empty levels already take 55 minutes on 4 native CPUs with 9.2 GiB, then a 7 GiB x86 Docker step. No cycle optimization closes a gap of that size; only a different verification shape does.
6. **New risk found.** Replay cost has no bound. A legal journal of one-cell captures costs 8 to 31 times the documented per-level maximum: about 2.9 billion cycles for six levels, 15 days of 4-CPU proving, and on Stylus more gas than a transaction may use.

## 1. Method

### What was read

`docs/VERIFICATION.md` (all), `docs/ECONOMY.md` (all), `docs/DEPLOYMENT.md` (all), README §1 to §3, §4.8 to §4.10, §7, §8, the plan's M4.15 and M5.5, `core/src/*.rs` (all 18 files), `referee/zk/README.md`, `referee/zk/guest/src/`, `referee/zk/host/src/prove.rs`, `contracts/src/Challenge.sol`, `contracts/src/ZkReferee.sol`, `web/wasm/src/lib.rs`, `seasons/*.json`, `vectors/README.md`, `reports/playtest-human-1.md`.

### Scratch tools (all in `audit/`, none in the repository)

| Tool | What it does |
|---|---|
| `native-stats/` | Replays every game vector natively through `replay_observed` and counts ticks, events, captures, the boss's remaining region at each capture ("region cells filled"), lives lost, boss and minion moves. Output: `data/stats.tsv`. |
| `parse_cycles.py`, `regress.py` | Parse the SP1, RISC Zero and Stylus tables of `docs/VERIFICATION.md` and fit cycles (or gas) on those counts by least squares. |
| `rv32/guest`, `rv32/emu` | A bare-metal `riscv32im-unknown-none-elf` build of `jiro_core::replay::replay` with the guest's release profile, and an RV32IM interpreter that counts executed instructions per pc. This is **not** RISC Zero's executor. Output: `data/rv32-base.tsv`, `data/hist/`. |
| `profile.py` | Attributes the per-pc counts to core functions through `llvm-symbolizer` inline chains and ELF symbol ranges. |
| `core-opt1/`, `check-opt1/`, `rv32/guest-opt1` | A scratch copy of the core whose `mark_boss_zone` inner loop uses index arithmetic, a native check that it reproduces every vector's Outcome or error code and its `traceKeccak`, and its instruction counts (`data/rv32-opt1.tsv`). |
| `nibbler/` | A scripted policy that maximizes replay cost with legal inputs, played through the core's `Recorder`. Output: `data/nibble.tsv`, `data/rv32-nibble.tsv`. |

### How far the scratch counter can be trusted

- It reproduces the recorded Outcome of all 71 accepted game vectors and the error code of the 4 rejected ones (75 of 75).
- Against the RISC Zero user cycles of `docs/VERIFICATION.md:409-492`: ratio 0.912 to 1.066 per vector, 1.058 on the gate set as a whole (528,530,164 instructions against 499,715,773 user cycles). The gap comes from another rustc (1.98 against RISC Zero's 1.97-dev), another target triple, and RISC Zero's runtime (boot, input reads, the sha of the public values), about 100K cycles per run.
- Out of sample, on the two run files that were really proven: testnet-0 run 1, 12,515,844 instructions against 12,592,566 documented user cycles (−0.6%); the fixture run, 15,513,680 against 15,374,362 (+0.9%).

So shares and ratios below are reliable; absolute figures from the counter are within about ±6% of RISC Zero's.

## 2. What a setup, a tick and a capture cost

### From the document's own tables

RISC Zero user cycles, `docs/VERIFICATION.md:409-492`; captures and region cells from `audit/data/stats.tsv`.

| Vector | Ticks | Events | Captures | Region cells filled | RISC Zero user cycles (doc) | RV32IM instructions (scratch) | With index fill (scratch) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `commit-at-tick-0` | 1 | 1 | 0 | 0 | 1,122,341 | 1,024,533 | 683,038 |
| `fast-cut` | 7 | 3 | 0 | 0 | 1,121,824 | 1,024,458 | 682,838 |
| `open-field-empty` | 2,700 | 0 | 0 | 0 | 2,002,964 | 1,891,644 | 1,533,946 |
| `full-journal` | 2,700 | 2,700 | 0 | 0 | 3,626,078 | 3,541,046 | 3,148,248 |
| `capture-edge-rectangle` | 17 | 4 | 1 | 3,329 | 1,653,456 | 1,602,680 | 855,191 |
| `capture-split-boss-left` | 60 | 2 | 1 | 1,682 | 1,432,104 | 1,357,961 | 810,567 |
| `open-field-capture` | 162 | 104 | 5 | 16,054 | 3,801,297 | 3,929,034 | 1,627,797 |
| `worst-case` | 2,700 | 2,700 | 63 | 128,992 | 27,762,031 | 29,489,534 | 13,355,622 |
| `05-worst` | 2,700 | 319 | 2 | 5,820 | 4,374,793 | 4,369,099 | 3,281,186 |
| `01-synthetic` | 2,458 | 2,458 | 46 | 84,692 | 17,192,157 | 18,293,157 | 7,590,347 |
| `10-worst` | 2,700 | 601 | 113 | 142,387 | 29,588,717 | 31,491,263 | 13,792,684 |

Pairwise readings:

- **Level setup: about 1.12M cycles.** `commit-at-tick-0` ends at tick 1 and takes 1,122,341 cycles; `fast-cut`, 7 ticks without a capture, 1,121,824.
- **Idle tick: about 326 cycles.** (`open-field-empty` − `commit-at-tick-0`) / 2,699 = 326, on the open field with a B = 5 boss moving every second tick and no minion. 2,700 idle ticks cost 0.88M, less than the setup.
- **Event: about 210 cycles plus hashing.** `full-journal` − `open-field-empty` = 1,623,114 for 2,700 events and 60 more keccak blocks; the 60 blocks are about 1.0M, the rest is decoding and moving along the rail.
- **Capture: about half a million cycles early in a level.** `capture-edge-rectangle` − `fast-cut` = 531,632 for one capture of 35 cells with 3,329 cells left to the boss. `capture-split-boss-left`, with 1,682 cells left, costs 310,280. One early capture costs as much as 1,600 idle ticks, and it costs less when it captures more.

### Fitted model

Least squares over the 71 accepted vectors (`audit/regress.py`), R² = 0.9996, median error 1.5%:

```text
user cycles ≈ 1,071,000                       per level, before tick 0
            +     324 × ticks
            +  13,200 × captures
            +     163 × region cells filled   (the boss's remaining region, summed over captures)
            +     252 × minion moves
            +      23 × boss edge cells tested
            +  22,000 × journal keccak blocks (absorbs the per-event cost)
```

On the gate set the region term is 73.5% of the cycles and the per-capture term 3.0%. The same fit on the Stylus gas table (`docs/VERIFICATION.md:64-140`, R² 0.9991) gives 291K gas per level, 40 per tick, 19.7K per capture and 52.6 per region cell: 63% and 12% of the gate set's gas. The same fit on SP1's cycles gives 167 per region cell. All three backends pay for the same loop.

### Measured profile

`audit/profile.py` on the scratch RV32IM build, the 32 gate-set vectors together (528,530,164 instructions):

| Where | Instructions | Share |
|---|---:|---:|
| Flood fill in capture (`Grid::mark_boss_zone`, `core/src/grid.rs:70-96`) | 373,399,588 | 70.6% |
| Capture's pass over the 3,600 cells (`core/src/capture.rs:19-28`) | 25,631,111 | 4.8% |
| keccak256: level id, journal hash, level seed, six draw hashes | 23,510,002 | 4.4% |
| Minions (`right_hand_step`, `orient`, `respawn`) | 16,207,371 | 3.1% |
| Boss (edge tests, body iteration) | 14,836,746 | 2.8% |
| Flood fill in level validation (`core/src/level.rs:193`) | 14,138,572 | 2.7% |
| Player step | 13,277,663 | 2.5% |
| Hits | 12,942,270 | 2.4% |
| `is_rail` (minion steps, rail moves) | 11,415,793 | 2.2% |
| Replay loop and tick dispatch | 10,536,036 | 2.0% |
| Level validation, the rest (grid build, counts, spawn area) | 8,996,672 | 1.7% |
| memcpy and memset, journal decoding, the rest | 3,638,340 | 0.7% |

Why the fill is so expensive (`core/src/grid.rs:81-94`): for each popped cell it turns the index into a `Pos` with a division and a remainder (`core/src/types.rs:146-152`), and for each of the four neighbors it runs two `checked_add_signed`, a range test (`types.rs:22-28`), then `CellIndex::new` with two more range tests, a `checked_mul` and a `checked_add` (`types.rs:123-131`), then a bounds-checked read. That is 165.8 instructions per region cell in `worst-case` (21,390,339 / 128,992). And it visits the wrong side: over the gate set the fill visits 2,255,654 cells to claim 64,745, that is 34.8 cells visited per cell claimed.

Setup, from `commit-at-tick-0` (1,024,533 instructions):

| Where | Instructions | Share |
|---|---:|---:|
| Flood fill of the whole open area, to check it is one region (`level.rs:193`) | 450,800 | 44.0% |
| The rest of validation: grid build from the bitmap, three counts and passes, spawn area | 279,092 | 27.2% |
| keccak256, 12 permutations at 16,445 instructions each, plus absorbing | 205,025 | 20.0% |
| memcpy and memset of the 10 KB game state | 73,309 | 7.2% |

keccak: 197,340 instructions in `keccakf` for 12 permutations in `commit-at-tick-0`, 1,184,040 for 72 in `full-journal`: 16,445 per permutation on RV32IM. A level needs 11 + ⌈(journal bytes + 1) / 136⌉ permutations: 4 for the 472-byte level id, 1 for the level seed, 6 for the draw (`core/src/seed.rs:64-76`), and the journal hash.

The per-tick state hash is not on the proving path (`core/src/hash.rs:1-2`), but it is what any scheme with intermediate state commitments would pay: 948 bytes (`hash.rs:10`) are 7 keccak blocks, about 115K instructions, and RISC Zero's trace guest spends 165K cycles per tick on it (448,195,877 for `open-field-empty` against 2,002,964, `docs/VERIFICATION.md:432`), 500 times the tick itself.

## 3. Cost of one verified run, and of a season

### One run

From `docs/VERIFICATION.md:933-946` (Arbitrum One base fee 0.020036 gwei, ETH at $2,285.67, 2026-11-02):

| Part | Gas or price | ETH | Share of the 0.00005 ETH fee |
|---|---:|---:|---:|
| Groth16 verification | 227,591 gas | 0.0000046 | 9% |
| `settleRun` without the referee, gate-set journals (25,636 bytes of calldata) | 576,603 gas | 0.0000116 | 23% |
| Proof on Boundless, p50 | | 0.0000184 | 37% |
| **Total** | 804,194 gas + proof | **0.0000345** | **69%** |

- With short journals the whole `settleRun` measured on Arbitrum Sepolia took 530,256 gas (`docs/DEPLOYMENT.md:150`): 0.0000106 ETH, so 0.0000290 ETH in all, 58% of the fee.
- The player pays on top of the fee: `startRun` 131,898 + `revealRun` 63,284 + `commitRun` 99,049 (typical) = 294,231 gas, 0.0000059 ETH, 12% of the fee; 1.06M gas with six full journals.
- **Not included anywhere:** Arbitrum One's L1 data fee ("which neither M4.7 nor M4.16 measured", `docs/VERIFICATION.md:933`). Sepolia charges 0 (`docs/DEPLOYMENT.md:24, 120`), and the design sends the journals twice, at commit and at settlement.

### Who pays, and from what

The operator settles each qualified player's best run (README §7.5, `README.md:671`). Its income is the rake: 10% in testnet-0 (`seasons/testnet-0.json:43`), capped at 20% (`README.md:738`), so 0.000005 to 0.00001 ETH per paid run.

- Break-even: 0.0000345 / 0.000005 = **6.9 paid runs per verified wallet** at a 10% rake, 3.45 at the cap.
- If the player paid instead: a one-run player's pot share is about 0.000045 ETH (fee minus a 10% rake), so verification would eat 77% of it.
- **Sybil play removes the exception.** README §8.2 (`README.md:713`) says a player who plays each run from a new wallet "has every run counted" and out-earns a one-wallet player. Then every paid run is some wallet's best run, and "verify by exception" verifies everything: 69% of each fee against a rake of 10 to 20%.

### Season totals

One best run per qualified player, at the figures above:

| Qualified players | Verification cost | Of which Boundless | Gas | Rake income if each bought one run (10%) | 4-CPU machine-hours at 9 to 11 h per run | Machines for a 48 h grace | Cycles at the median run (114.8M) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 0.00345 ETH ($8) | 0.00184 ETH | 80M | 0.0005 ETH | 900 to 1,100 | 19 to 23 | 11.5 billion, 2% of the Boundless week |
| 1,000 | 0.0345 ETH ($79) | 0.0184 ETH | 804M | 0.005 ETH | 9,000 to 11,000 | 188 to 230 | 115 billion, 19% |
| 10,000 | 0.345 ETH ($789) | 0.184 ETH | 8.0 billion | 0.05 ETH | 90,000 to 110,000 | 1,875 to 2,292 | 1.15 trillion, 187% |

Reading: the money is small in absolute terms. What does not scale is proving capacity. CPU proving is hopeless beyond a few players, and from about 1,000 players the project would be the largest buyer on a market whose whole week was 612,544,518,705 cycles and 1,376 fulfilled requests (`docs/VERIFICATION.md:534, 753`).

Aggregation, as the document analyzed it (`docs/VERIFICATION.md:773-780, 948-957`), saves at most 219K gas per run of 804K and no proving price. Two cheaper levers were not considered there:

- **The price is per proof.** The document's own fit is 0.0000153 ETH + 17,383 wei per cycle (line 755, R² 0.19). A run of 115M cycles is 0.0000020 ETH of variable price, so 83 to 88% of what is paid is the fixed part. One guest execution that replays ten runs would cost about 0.0000353 ETH, 0.0000035 per run, and one verification, 22.8K gas per run. The market has served requests of up to 4.6 billion cycles (line 754). Today the guest accepts exactly 1 or 6 levels (`referee/zk/guest/src/lib.rs:18`) and `ZkReferee` exactly 384 or 2,304 bytes (`contracts/src/ZkReferee.sol:22, 69-75`). The fit is weak, so this is a lead to test, not a result.
- **The calldata is redundant on zk.** `settleRun` receives six levels and six journals, and both contracts only hash them (`contracts/src/Challenge.sol:153, 219-223`; `contracts/src/ZkReferee.sol:88-91`): the proof's public values already carry `journalHash` and `levelId`, and the journals were published by `commitRun` (`Challenge.sol:130-143`). With gate-set journals that calldata is 353,908 gas of 804,194 (`docs/VERIFICATION.md:815`), 44%; with short journals about 5%.

## 4. Proving latency against the grace

Measured rates (`docs/VERIFICATION.md:699-710`, `docs/DEPLOYMENT.md:173-178, 239-254`): 295 to 410 s per 2^20-cycle segment on 4 CPUs, 43 to 57 s of recursion per segment, 120 to 170 s of Groth16; 9.2 GiB in the host, then about 7 GiB in the Docker step. That is 2,250 to 3,100 cycles per second.

| Run | Proving cycles | Segments | Hours on 4 CPUs at 467 s per segment | At 338 s per segment |
|---|---:|---:|---:|---:|
| Six levels in the owner's style (2.4M to 3.0M each, §7) | 15 to 18M | 15 to 18 | 2.0 to 2.4 | 1.4 to 1.7 |
| testnet-0 run 1, `--short` (measured) | 13,631,488 | 13 | 1.25 measured | |
| Bot runs that clear six levels (`DEPLOYMENT.md:245-250`) | 69.5 to 84.9M | 67 to 81 | 8.7 to 10.6 | 6.3 to 7.6 |
| Gate set, median and heaviest run | 114.8 to 136.4M | 110 to 131 | 14.3 to 17.0 | 10.4 to 12.3 |
| Six cost-maximizing levels (§6) | about 2.9 billion | about 2,780 | 360 (15 days) | 261 (11 days) |

Against the grace: testnet-0 has 24 h (`seasons/testnet-0.json:45`), README proposes 48 h and allows 30 days (`README.md:740`), and the plan derives testnet-1's grace from the proving route (`IMPLEMENTATION_PLAN.md:1997-2001`).

- A 4-CPU machine proves two real bot runs in 24 h and four or five in 48 h. Best runs are only known at the season's end, so most proving falls inside the grace.
- The plan already records that Actions cannot prove whole runs (`IMPLEMENTATION_PLAN.md:2008`).
- **Nothing full-size was ever proven end to end.** The only run settled on Arbitrum Sepolia used `--short`: five of six levels closed at tick 30, 338 ticks in all, 13 segments (`docs/DEPLOYMENT.md:97, 173-178`). The largest real proof is one level, `worst-case`, 28 segments in 13,177 s (`docs/VERIFICATION.md:700`). The 9 to 17 hour figures are a formula.
- "Any player can still prove and settle their own run" (`README.md:671`) means: build the host for an hour at the fixed path `/home/runner/work/jiro-ikusu/jiro-ikusu`, run Docker on x86, hold 9.2 GiB, and wait 9 hours.

## 5. Sensitivity

### Gas price

The fee is 50,000 gwei. A verified run uses 804,194 gas (530,256 with short journals) and an 18,400 gwei proof.

| Arbitrum base fee | Settlement and verification | With proving | With proving, short journals |
|---:|---:|---:|---:|
| 0.01 gwei | 16% of the fee | 53% | 47% |
| 0.020036 gwei (measured) | 32% | 69% | 58% |
| 0.039 gwei | 63% | **100%** | 78% |
| 0.062 gwei | **100%** | 137% | 103% |
| 0.1 gwei | 161% | 198% | 143% |
| 1 gwei | 1,608% | 1,645% | 1,097% |

The scheme breaks even at twice the base fee measured on 2026-11-02. It only works at Arbitrum's fee floor, and the settlement window (the grace) fixes when the gas must be bought.

### Prover market

- Two requesters and two provers made all the raw Groth16 requests of the measured week (`docs/VERIFICATION.md:754`). The 0.0000184 ETH median comes from one requester's 176 to 196M-cycle requests. The 39 requests nearest our sizes (5.2 to 45M cycles, `DigestMatch`) paid a median of 0.0000550 ETH, 110% of the fee (line 759). SP1's network priced the same proof at about 0.00004 ETH, 80% (line 350).
- "No request was made: it needs a funded Base wallet and a public program URL" (line 771). The route that every real season depends on is untested: the request type, the delivery of a raw seal for the pinned image id, the latency, the failure handling.
- Cycle optimizations barely move this price, because the fixed part dominates. They matter for self-proving, for latency and for the worst case, not for the market bill. Batching runs per proof is what moves the bill (§3).

### Play style

Cost depends on how the player captures, far more than on how long he plays (§2). §7 gives the measured range: 2.4M instructions for a level cleared in four big cuts, 16 to 31M for the gate set's bot journals, 149 to 510M (median 477M) for one-cell captures. The gate set is bot play (`vectors/README.md`); only two human journals exist (`docs/ECONOMY.md:136`).

## 6. The worst case is not a worst case

`docs/VERIFICATION.md:919-926` gives a per-level "maximum" of 30,932,992 proving cycles and a run "maximum" of 137,363,456. Those are maxima over the bots' journals, not over legal journals.

**Mechanism.** A capture costs about 163 cycles per cell that stays with the boss. The smallest capture is one cell: step into an `EMPTY` cell, step back onto the cell just left. Nothing forbids closing a cut on its start cell (`core/src/player.rs:181-186`). It takes 2 ticks; with its moves along the claimed cells, the scripted policy below averages 2.7 ticks per capture. So a level allows about 1,000 captures, each refilling about 2,900 cells on an open level, while the claim stays under the target and the level runs its 2,700 ticks.

**Experiment.** `audit/nibbler` plays that policy through the core's `Recorder`, with a look-ahead on a clone so it never loses a life, on the 16 season levels (level bytes of `vectors/levels/NN-worst.json`). `replay` accepts all 16 journals (code 0). Instruction counts from the scratch counter (`audit/data/rv32-nibble.tsv`):

| Level | Captures | Region cells filled | Instructions | Heavier gate-set vector (scratch) | Ratio | Fitted Stylus `verify` gas |
|---|---:|---:|---:|---:|---:|---:|
| 01 | 918 | 2,666,331 | 466,573,023 | 18,613,504 | 25× | 160M |
| 05 | 892 | 2,375,224 | 418,950,855 | 15,233,296 | 28× | 144M |
| 07 | 1,017 | 2,900,649 | 509,042,750 | 17,316,829 | 29× | 174M |
| 10 | 802 | 1,327,008 | 244,776,267 | 31,491,263 | 8× | 88M |
| 11 (ended at tick 1,288) | 309 | 831,131 | 148,620,610 | 16,342,885 | 9× | 51M |
| 13 | 1,022 | 2,768,310 | 487,750,222 | 15,845,156 | 31× | 167M |
| 15 | 1,036 | 2,888,941 | 509,687,483 | 18,630,105 | 27× | 175M |

The repository's own tool accepts these journals: `target/release/jiro-tools replay --level audit/data/nibble-bin/01-nibble.level --journal audit/data/nibble-bin/01-nibble.jrn` prints a Challenge Outcome on `levels/01-open.bin` (level id `0x73b1…05fe`, the season's slot 0): TimeLimit, claim 2,728 bp, 2,700 ticks.

Cross-check from the document alone, without the scratch counter: one small early capture costs 531,632 cycles (`capture-edge-rectangle` − `fast-cut`, `docs/VERIFICATION.md:417, 427`) and 182,178 gas on Stylus (lines 70, 80). A thousand of them are about 0.5 billion cycles and 180M gas.

The other nine levels are between 356M and 509M. Median of the 16: 477M. The six heaviest sum to 3.03 billion instructions; the cycle model of §2 gives 2.91 billion RISC Zero user cycles, 22 times the documented heaviest run (130,741,601). 94% of it is the fill.

**Consequences.**

- **zk, CPU:** about 2,780 segments, 15 days on 4 CPUs for one run.
- **zk, market:** by the document's fit, 0.0000153 + 2.9e9 × 17,383 wei = 0.000066 ETH, about 130% of the fee; at the week's mean variable price of 43,101 wei per cycle (line 535), about 0.00013 ETH.
- **Stylus:** the gas fit gives 51M to 175M per level, above the 32M cap per transaction on every one of the 16 levels (`README.md:649`). `settleLevel` is the fallback for a run that does not fit; nothing is the fallback for a level that does not fit. On a Stylus season such a run could never settle, though it is valid and paid. The plan's rule is still "Stylus whenever activations are open" (`docs/VERIFICATION.md:880`).
- **Who is exposed:** the operator's proving budget and the grace (one wallet, one fee, 22 times the work), and honest players with a cautious style. Small captures along the edge are the classic safe way to play this genre. A level cleared with 150 small captures costs on the order of 50M cycles, twenty times the owner's own journals.
- The operator can see a run's cycle count in seconds with the executor and prove cheapest first. That protects the queue. It does not pay the expensive player.

**What removes it.** A fill whose work follows the captured side, not the boss's side, bounds a level at O(ticks + area). The index-arithmetic fill of §7 only divides the constant by 3.8: the same journals still cost 47M to 157M (`audit/data/rv32-nibble-opt1.tsv`).

Caveats: scratch counter, not RISC Zero's executor; Stylus gas and RISC Zero cycles are linear extrapolations, 20 times beyond the fitted range, of a mechanism that is linear by construction; the policy is one simple script, not an optimum.

## 7. Optimizations: what each one buys

| Lever | Effect on cycles | Status | Notes |
|---|---|---|---|
| Same stack fill with index arithmetic (`core/src/grid.rs:81-94`) | Gate set ×0.457 (528.5M to 241.3M); `worst-case` 29.5M to 13.4M; setup 1.02M to 0.68M; fill 165.8 to 43.7 instructions per cell | **Measured** on `audit/core-opt1`: all 75 vectors reproduce their Outcome or error and their `traceKeccak`; same results on the 16 cost-maximizing journals | 15 lines. Same procedure as README §4.8 (same order, mark on push), so no rule text changes; it is the kind of change M4.15 allows ("without changing any outcome"). It relies on a popped cell being interior, which holds because only `EMPTY` cells are pushed and the border is `CLAIMED` for good. A new image id means a new `ZkReferee` and season (`docs/DEPLOYMENT.md:195`). |
| Fill the captured side, or race the sides | Estimated ×0.25 to ×0.30 overall: the gate set visits 2,255,654 cells to claim 64,745 | **Estimated**, not built | Needs per-component tracking: a trail can leave several regions on either side. More code in the consensus core, and README §4.8's rule text R4.8-2 to R4.8-4 describes the current procedure, so by `CLAUDE.md`'s definition its edit is a behavior change even if no vector moves. It is the only lever that bounds the worst case of §6. |
| Cheaper pass over the 3,600 cells | At most 4.8% (10.6% once the fill is fixed) | Estimated | 6.9 instructions per cell today. |
| Accelerated keccak (RISC Zero's keccak circuit, "not tried", `docs/VERIFICATION.md:407`) | At most 4.4% of the gate set; 20% of an empty level | Upper bound from the profile | 19 to 72 permutations per level. The accelerator has its own proof and recursion cost, not measured. Not a lever. |
| sha256 instead of keccak256 | At most the same 4.4% | Upper bound | Would change the journal hash, level id, seed and draw: new format versions and `RULES_VERSION`, and the contracts. Not worth it for replay. It would matter only for a scheme that commits to many intermediate states (§2). |
| Skipping level validation in the guest | 0.73M of each level's 1.02M setup | Not recommended | The 16 level ids are committed at `open`, but "no Outcome for an invalid level" is what makes `Season.open`'s unchecked ids safe (`README.md:735`). |
| Proving levels separately | None: the run measured 130,741,601 cycles against 130,755,557 summed (`docs/VERIFICATION.md:917`) | From the document | Six verifications (1.37M gas) and six market prices, 220% of the fee (line 769). Segments are already the unit of parallel proving. |
| The plan's M4.15 levers: rail bitmap, no full-grid scan per tick, keccak once per level, no per-tick hashing (`IMPLEMENTATION_PLAN.md:1539`) | Under 10% together | From the profile | The plan says they were "not measured by M4.9" (line 1536). keccak is already once per level, `verify` hashes no tick, and there is no per-tick grid scan; `is_rail` and minions are 5.3%. The hot path is not on the list. |

Where the floor is: with capture free, the gate set still costs (528.5 − 373.4 − 25.6) / 32 = 4.0M instructions per level, 3.7M with the faster fill in validation: about 23M per run, 3 hours on 4 CPUs.

The two human journals in the repository (`reports/playtest-human-1/`, replayed in `audit/data/human.tsv`): `11-labyrinth`, cleared in 163 ticks with 4 captures, 2,386,149 instructions; `open-field`, cleared in 333 ticks with 5 captures, 2,962,247. With the index fill: 1,246,112 and 1,408,064. A run in that style is 15 to 18M cycles, of which 6.4M is the six setups.

## 8. Could the player prove it himself, in the browser?

With this stack, no, and not by a small margin.

- **The fixed work alone is too much.** Six levels of 1 to 20 ticks, 6.7M user cycles: 3,297 s on 4 CPUs at 9.2 GiB, then 7.0 GiB in Docker; 10,168 s on 2 vCPUs with 2^19 segments at 4.6 GiB (`docs/VERIFICATION.md:699-702`). A browser tab has at most 4 GiB of wasm memory and no Docker.
- **Memory follows the segment size, not the program** (`docs/VERIFICATION.md:504, 707`): 9.2 GiB at 2^20, 4.6 GiB at 2^19. Smaller segments mean more segments and more recursion (144 to 192 s each on the runner).
- **The Groth16 wrap has no browser route:** an x86 Docker image of 5.2 GB, or CUDA; "there is no native CPU route" (`docs/VERIFICATION.md:508`).
- **Rate:** 2,250 to 3,100 cycles per second on 4 native CPUs. A ten-minute proof is 1.4 to 1.9M cycles: one empty level and a half.
- **Best case after every optimization:** a run in the owner's style with the index fill is about 8M cycles, an hour on 4 CPUs. Still a native install, 9 GiB and Docker.
- A player with an NVIDIA GPU and a native app might prove a run in minutes with RISC Zero's CUDA prover. Nothing in the repository measures a GPU (`docs/VERIFICATION.md:162, 361, 674`), and that is not a browser.

What the browser can do today, for free: replay. All 75 vectors, 88,847 ticks, replay natively in about 50 ms, and in about 480 ms with a keccak state hash on every tick. `web/wasm/src/lib.rs:733-758` already returns the Outcome and the trace of state hashes. So the cheap resource is re-execution by anyone, and the expensive one is a succinct proof of all of it. A lighter scheme would spend the first to avoid the second: a claimed Outcome that anyone can check in milliseconds and contest, with a proof only for a contested run, or for one contested tick. A single tick is about 0.3K to 2K cycles, tens of thousands when a minion respawns (the fit gives about 51K per respawn, for the row-major scan of `core/src/minion.rs:159-166`), and about 0.55M with a capture on an open field, so one step fits one segment; on Stylus it would be under 0.5M gas, if activations reopen. That design belongs to another lens; the numbers it needs are in §9.

## 9. Facts for whoever designs the alternative

1. Replay is nearly free off chain: about 0.5 µs per tick natively; the wasm build exposes `replay` with the Outcome and the per-tick trace (`web/wasm/src/lib.rs:733-758`).
2. Cycle model: 1.07M per level + 324 per tick + 252 per minion move + 13K per capture + 163 per region cell (`core/src/grid.rs:70-96`); keccak-f is 16.4K instructions, 11 + ⌈(journal bytes + 1)/136⌉ per level.
3. One tick: about 0.3K to 2K cycles, tens of thousands when a minion respawns (`core/src/minion.rs:159-166`), about 0.55M with a capture on an open field (`core/src/capture.rs:12-30`). One segment. The proof of `commit-at-tick-0`, one segment plus padding, took 1,282 s on 4 CPUs and 2,128 s on a 2-vCPU 7.9 GB runner (`docs/VERIFICATION.md:502, 701`).
4. A state commitment costs more than the tick: 948 bytes (`core/src/hash.rs:10`), 7 keccak blocks, about 115K instructions; 165K cycles per tick in the trace guest (`docs/VERIFICATION.md:432`). Checkpoints must be sparse, or the state hash must change.
5. Stylus, by the same fit: 0.29M gas per level setup, 40 to 73 gas per idle tick, at most about 0.2M for a capture tick (`docs/VERIFICATION.md:64-140`). Activations are paused on both chains (lines 7-12).
6. Per-proof costs are fixed: 227,591 gas (`docs/VERIFICATION.md:745`), 0.0000153 ETH + 17,383 wei per cycle (line 755), a 120 to 170 s, 7 GiB, x86 Docker wrap (lines 699-702). The guest takes 1 or 6 levels (`referee/zk/guest/src/lib.rs:18`).
7. On zk the contracts need hashes, not bytes (`contracts/src/Challenge.sol:153, 219-223`; `contracts/src/ZkReferee.sol:88-91`). Journals are public from `commitRun` (`Challenge.sol:130-143`). `Challenge` needs 11 Outcome fields behind `IReferee` (`Challenge.sol:241-260`); a new backend is a new referee and a new season (`docs/DEPLOYMENT.md:191-195`).
8. Budget: the rake is 0.000005 ETH per paid run in testnet-0 (`seasons/testnet-0.json:42-43`), which buys 250K gas at 0.02 gwei and no proof. Measured play spans 2.4M to 510M instructions per level, so any scheme that re-executes or proves needs a bound on capture work (`core/src/player.rs:181-186`).

## 10. What the current design gets right

- **One core, golden vectors.** Every backend reproduces 75 of 75 vectors (`docs/VERIFICATION.md:203, 401`), and so did an independent RV32IM build here. The cost model fits at R² 0.9996 because the core is deterministic and small. Keep it: any lighter scheme reuses it unchanged.
- **Verify by exception, journals in calldata** (README §7.3, `Challenge.sol:130-143`). Play costs one commit of 99K gas, and anyone can replay anything for free.
- **Constant, small onchain verification.** 227,591 gas whatever the journal; the whole `settleRun` was 530,256 gas on Sepolia (`docs/DEPLOYMENT.md:150`), against 19.5 to 31.2M on Stylus.
- **`IReferee` and hash-bound Outcomes** (`README.md:613-646`, `Challenge.sol:241-260`). The backend can change with a season; settlement is permissionless and pays the run's player; a proof cannot be redirected.
- **Measurement discipline.** Every figure has a command, a commit and an environment, and the document corrects itself (M4.8 on M1.17's market reading, `docs/VERIFICATION.md:753`).

## 11. Findings

| Id | Severity | Finding |
|---|---|---|
| latency-1 | high | CPU proving cannot settle a season inside the grace: 9 to 17 h per run on 4 CPUs, and no full-length run was ever proven end to end. |
| cost-bound-1 | high | Replay cost has no bound: legal one-cell-capture journals cost 8 to 31 times the documented per-level maximum, 15 days of CPU proving per run, and more than a transaction's gas on Stylus. |
| market-1 | high | The only scalable route is a two-prover market that was never used; near our sizes it charged 110% of the fee; 10,000 runs are 1.9 times its measured week. |
| econ-1 | medium | A verified run costs 58 to 69% of its fee before L1 data fees; the rake is 10 to 20%; break-even at 0.039 gwei; Sybil play makes every run a best run. |
| hotpath-1 | medium | 75% of the cycles are one unoptimized flood-fill loop; a 15-line rewrite halves the cycles; the deferred optimization item lists other levers. |
| batch-1 | medium | The price and the gas are per proof, yet the shape is one proof per run; the guest and the referee cannot share a proof between runs. |
| browser-1 | medium | No cycle optimization brings proving to a browser: the fixed work of six empty levels is 55 minutes on 4 CPUs at 9.2 GiB. "Anyone may settle" is nominal. |
| unmeasured-1 | medium | The 69% figure omits the L1 data fee, assumes a price never paid, and rests on bot journals; human journals cost a sixth; no GPU and no full run were measured. |
| calldata-1 | low | On zk, settlement re-sends levels and journals only to hash them: up to 44% of a verified run's gas. |

## 12. Reproducing the scratch measurements

```bash
A=scratchpad/audit
# native counts per vector
(cd $A/native-stats && CARGO_TARGET_DIR=$A/target cargo +1.98.0 build --release --offline)
$A/target/release/native-stats $A/data/vectors.tsv > $A/data/stats.tsv
# the fit on the document's tables
python3 $A/parse_cycles.py $A/data/cycles.json && python3 $A/regress.py $A r0_user
# RV32IM instruction counts and the profile
(cd $A/rv32/guest && CARGO_TARGET_DIR=$A/target-rv32 cargo +1.98.0 build --release --offline --target riscv32im-unknown-none-elf)
(cd $A/rv32/emu && CARGO_TARGET_DIR=$A/target cargo build --release --offline)
$A/target/release/rv32-emu $A/target-rv32/riscv32im-unknown-none-elf/release/rv32-guest $A/data/vectors.tsv $A/data/hist > $A/data/rv32-base.tsv
python3 $A/compare.py $A $A/data/rv32-base.tsv
python3 $A/profile.py $A $A/target-rv32/riscv32im-unknown-none-elf/release/rv32-guest $A/data/hist $(cut -f1 $A/data/vectors.tsv | grep '^levels/')
# the index-arithmetic fill: equivalence, then counts
(cd $A/check-opt1 && CARGO_TARGET_DIR=$A/target cargo +1.98.0 build --release --offline) && $A/target/release/check-opt $A/data/vectors-expected.tsv
# the cost-maximizing journals
(cd $A/nibbler && CARGO_TARGET_DIR=$A/target cargo +1.98.0 build --release --offline) && $A/target/release/nibbler $A/data/vectors.tsv > $A/data/nibble.tsv
```

`data/vectors.tsv` holds each game vector's level and journal, extracted from `vectors/game/*.json` and `vectors/levels/*.json`; `data/runs.tsv` the two proven run files; `data/human.tsv` the two human journals.
