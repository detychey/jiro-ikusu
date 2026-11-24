# Hand-written circuits and folding schemes with in-browser provers

Research note, 2026-11-10. Question: if the replay were expressed as a circuit instead of a zkVM guest, could a browser prove a whole run (up to 16,200 ticks on a 60×60 grid, with flood-fill captures), and could Arbitrum verify it cheaply?

Facts carry a confidence mark:

- **[P]** primary source: official documentation, a repository file at a named tag, a package registry, or a measurement made for this report (section 3);
- **[S]** secondary source: a third party's report of someone else's number;
- **[I]** inference: my own reasoning or arithmetic from the facts cited.

Sources older than twelve months are marked *(stale?)*. All URLs and their dates are in section 10.

## 1. Answer first

**No. A hand-written circuit is not a realistic route for this project, and no variant of it lets a player prove a whole run in a browser tab and settle it cheaply on Arbitrum today.** The facts that decide it:

1. **A hand-written circuit is a second implementation of the rules.** No maintained tool compiles the Rust core to a circuit without a zkVM: the Rust front end of zkLLVM was archived on 2025-02-17 [P]. Every option in this report means rewriting README §4 in Noir, Circom, an AIR or R1CS gadgets, which is what the owner's one-implementation rule excludes. The golden vectors cannot close that gap: they exercise the witness generator, and the typical circuit bug is a missing constraint, which honest test vectors never reach [I].
2. **The game does not fit a fixed-size circuit.** A capture is a whole-grid pass that happens at data-dependent ticks. Measured on a throwaway Noir model: an ordinary tick costs 2,952 to 7,750 UltraHonk gates and a capture 291,789 [P]. A full-length run is 48 to 126 million gates for its ticks alone, 109 to 187 million with 200 captures [I]. A level can hold about 1,000 captures (one cell every 2.5 ticks), which is about 2 billion gates per run [I]: a fixed circuit must either cap captures, a rule change, or be unprovable for valid runs.
3. **A browser proves about 1 to 2 million gates per proof, not 100 million.** Measured with bb.js 5.3.0 on its WASM backend, 4 threads: 2^20 gates in 42.6 s with a 1.6 GiB WASM heap, 2^21 gates in 82 s with 3.4 GiB of the 4 GiB that wasm32 allows [P]; 2^22 would need about twice that and cannot fit [I]. A full-length run therefore needs 50 to 180 chunk proofs: 1 to 3 hours of proving on a 4-thread machine, on a desktop browser only (bb.js caps iOS at 1 GiB, enough for 2^19) [P][I].
4. **Arbitrum can verify one such proof cheaply, but only with unaudited verifiers.** Measured: UltraHonk's optimized Solidity verifier takes 584,348 to 635,468 gas without zero knowledge and 701,966 to 774,881 with it; the standard verifier takes 1.46 to 1.67 million and 2.45 to 2.69 million [P]. At Arbitrum One's 0.02 gwei that is 0.000012 to 0.000054 ETH, 23% to 108% of the 0.00005 ETH run fee, against 227,591 gas (9%) for the Groth16 seal in use. The source of all three Honk verifiers at v5.3.0 is marked "internal audit: planned, external audits: not started" [P].
5. **The systems that prove a repeated step function well have no cheap EVM exit.** Folding (Nova, Sonobe) is the natural model for "one tick, 16,200 times", but the only published onchain deciders are a Groth16 proof over a 9.6 to 12 million-constraint circuit (Sonobe, under 3 minutes on a 16-core laptop, not a browser job, about 800k gas, 2024 figures) [S] and MicroNova (about 2.2 million gas, no public Solidity verifier found) [S]. Sonobe's current release, 0.1.0-alpha.1 of 2026-07-26, has no merged decider at all [P]. A small-field STARK (Plonky3, Stwo) would be the fastest prover by far, but verifying FRI or WHIR in the EVM costs 1 to 5.6 million gas in the only measured verifier found, and no maintained Solidity verifier for Plonky3 or Stwo proofs was found [P][S].
6. **Groth16 by hand (Circom) is the worst fit:** no memory or lookup argument, so about 14,000 constraints per tick [I], about 38 million for one level, a proving key of about 20 GB [I], and a trusted-setup ceremony for every circuit, again at every `RULES_VERSION` bump [P].

What a circuit would buy is real: a hand-written circuit needs two to three orders of magnitude less prover work than the zkVM's 10^8 cycles [I]. It is the price that rules it out: a second rules implementation, a circuit audit on the payout path, unaudited or missing verifiers, and still tens of minutes of proving in the browser.

## 2. What a circuit for this game has to do

Read from README §4, §6 and `core/src/{game,player,boss,minion,capture,grid,hits,level,replay}.rs`.

**State.** The grid, 3,600 cells of 2 bits, plus about 48 bytes of entity state (the 948-byte state-hash preimage of README §6.4).

**An ordinary tick** (`Game::tick`), counted as grid accesses of the Rust code:

| Step | Code | Grid reads | Grid writes |
|---|---|---:|---:|
| 3, player, per sub-step, up to 2 | `Player::sub_step`: the target cell, `is_rail(pos)`, `is_rail(target)`; `is_rail` reads a cell and its 8 neighbors | 19 each, 38 | 1 each, 2 |
| 4, boss, on its move ticks | `Boss::move_axis` twice, B ≤ 8 edge cells each; one `fmix32` draw | 16 | 0 |
| 5, minions, 3 slots, on their move ticks | `right_hand_step`: four `is_rail` | 36 each, 108 | 0 |
| 5, a respawn | `is_rail(spawn)`, else a row-major scan of up to 3,600 `is_rail`, then `orient` (8 reads) | 17 to 32,400 | 0 |

So about 160 reads and 2 writes per tick in the worst case, each at a data-dependent address. A circuit cannot branch, so it pays for both sub-steps, the boss and all three minions on every tick [I].

**Whole-grid passes at data-dependent ticks:**

- **Capture** (`capture`, `Grid::mark_boss_zone`): a stack fill of up to 3,364 pops with 4 neighbor tests each, then one pass over 3,600 cells, then `Minions::after_capture` (9 + 8 reads per minion).
- **Trail erase** (`Player::abandon_cut` → `Grid::replace`): a 3,600-cell pass at a commit and at every lost life.
- **Level start** (`level::validate`): a fill for the open-area check and several 3,600-cell passes.

**How many captures.** The shortest cut is one cell: step into `EMPTY`, step back onto `CLAIMED`. From a rail cell with open field on two sides the player can capture two cells in five ticks, so a 2,700-tick level holds about 1,000 captures and a run about 6,500 [I, from R4.5-2, R4.5-5 and `sub_step`; not played out]. The repository's "worst" vectors are not this: their policy is `CaptureBot::new(3, 5)`, "small captures, an event on every tick" (`tools/src/scenarios/game_long.rs`), and at 0.5 million cycles per capture the heaviest level, 29.6 million cycles, is about 50 captures [I].

*Side finding for the current design [I, not measured]:* the same adversarial journal would cost the zkVM about 0.5 million cycles × 1,080 captures ≈ 540 million cycles per level, about 3.2 billion per run, some 25 times the heaviest gate-set run. One test vector would confirm or refute it.

**Hashing.** keccak256 binds everything: each journal (up to 8,171 bytes, 61 blocks of 136 bytes), each level id (472 bytes, 4 blocks), the level seed and the draw. In a circuit that is about 400 keccak-f permutations per run, 2.9 million UltraHonk gates at the measured 7,230 each. Otherwise the journals become public inputs, about 1,600 field elements for six full journals: about 0.5 million more gas in UltraHonk's optimized verifier (measured, section 3.3), and prohibitive in Groth16 at about 7,000 gas each, 11 million gas [I].

**Consequence for the architecture [I].** A monolithic fixed circuit cannot place a 290,000-gate capture at an arbitrary tick without paying for it at every tick. Three shapes remain:

1. chunked proofs with a state commitment between chunks, then recursion or one onchain verification per chunk;
2. IVC or folding with two step circuits, a tick step and a capture step (non-uniform IVC: SuperNova, HyperNova);
3. a multi-table STARK with a memory argument, whose trace length follows the run.

## 3. Measurements made for this report

All on 2026-11-10, in a container with 4 vCPUs (Intel Xeon, 2.10 GHz), 15.7 GiB of RAM, Node v22.23.4, no GPU. Tools: `nargo` 1.0.0-beta.22 (release asset), `@aztec/bb.js` 5.3.0 from npm (published 2026-10-26; its bundled native `bb` prints `5.3.0-nightly.20261020`), Foundry 1.8.6, solc 0.8.28, optimizer at 200 runs, `evm_version` cancun. Noir v1.0.0 was released on 2026-10-29 [P]; its `nargo` binary was not at the release-asset URL tried, so the circuits were compiled with beta.22, whose ACIR bb 5.3.0 accepted, proved and verified.

The circuits are throwaway models written for sizing, **not** faithful ports and not reviewed: they live under `scratchpad/research/measure/circuits/` (`tick`, `tickopt`, `capture`, `flood`, `bench*`, micro-benchmarks), with the scripts in `measure/scripts/`, the Node prover driver in `measure/npm/prove.mjs` and the gas tests in `measure/forge/` and `measure/forge20/`.

### 3.1 Gate counts (UltraHonk, `bb gates`) [P]

| What | Gates | How measured |
|---|---:|---|
| One read of a 3,600-cell memory, `Field` cells | 2.3 | 1,000 against 2,000 reads |
| One `u8` read with an XOR and a range-checked `u32` index | 10.5 | same |
| One `u8` read and write pair | 18.6 | same |
| Initializing a 3,600-cell memory | about 10,800, the circuit's fixed overhead included | intercept |
| `fmix32` draw of R4.6-7 | 100 | 100 against 300 draws |
| keccak-f[1600] permutation | 7,230 (plus about 33,000 once) | 1 against 3 permutations |
| Poseidon2 permutation | 73 | 10 against 30 |
| **Ordinary tick, direct port:** `is_rail` as 9 reads, 213 reads and 2 writes per tick | **7,750** | 8 against 16 ticks |
| **Ordinary tick, with a rail bitmap** rebuilt only at captures (R4.2-3), 61 reads | **2,952** | 8 against 16 ticks |
| The same tick written with the grid passed by value into a function that writes it | 68,717 | 4 against 8 ticks: Noir copies the 3,600-cell array |
| **Capture from a certificate:** per cell a boss-zone mark and a BFS distance, one checked pass, the new grid, the capture size, the rail bitmap and the first rail cell | **291,789** | 1 against 2 captures |
| Capture as the core does it: the stack fill unrolled to its 3,364 pops, then the one pass, without the rail bitmap | 133.8 per pop; **about 566,000** extrapolated | 100 against 200 pops (129,276 and 142,660 gates); the full-size circuit had not finished compiling after 15 minutes of CPU time |
| Verifying one UltraHonk proof inside a Noir circuit (recursion, non-ZK) | 681,879; two proofs 1,426,176 | `std::verify_proof_with_type`, proof type 0 |

The certificate is sound for the rule [I]: every body cell is marked at distance 0; a marked cell is `EMPTY`; every other marked cell has a marked 4-neighbor at distance one less, so it is connected to the body; two adjacent `EMPTY` cells carry the same mark, so the marked set is closed. Together they force the marked set to be exactly the fill of R4.8-3.

### 3.2 Proving in WASM (bb.js 5.3.0, `BackendType.WasmWorker`, 4 threads, target `evm-no-zk`) [P]

The circuit is the rail-bitmap tick repeated T times, on an open-field level with three minions.

| Ticks | Gates | Prove | WASM heap peak | Process peak RSS | Proof |
|---:|---:|---:|---:|---:|---:|
| 9 | 63,853 (2^16) | 3.6 s | 258 MiB | 567 MiB | 7,776 B |
| 31 | 128,795 (2^17) | 9.1 s | 251 MiB | 628 MiB | 8,128 B |
| 76 | 261,634 (2^18) | 12.4 s | 442 MiB | 922 MiB | 8,480 B |
| 164 | 521,411 (2^19) | 23.4 s | 855 MiB | 1,392 MiB | 8,832 B |
| 342 | 1,046,871 (2^20) | 42.6 s | 1,630 MiB | 2,728 MiB | 9,184 B |
| 684 | 2,056,452 (2^21) | 82.0 s | 3,418 MiB | 5,237 MiB | 9,536 B |

- **Limits.** bb.js creates its memory with a maximum of 65,536 pages, 4,096 MiB, and 16,384 pages, 1,024 MiB, on iPhone and iPad (`barretenberg_wasm_main/index.ts` at v5.3.0) [P]. So 2^21 is the ceiling on a desktop and 2^19 on iOS [I]. These runs were in Node's V8, the engine of Chrome; a real tab adds its own limits, which were not tested.
- **Times include** the verification key, which `generateProof` computes each time. Native `bb prove` of the 2^20 circuit with a precomputed key took 11.95 s (`evm-no-zk`) and 13.45 s (`evm`), about 1.5 GiB [P]: WASM is 3 to 3.6 times slower.
- **One thread** (`BackendType.Wasm`), 2^18 gates: 30.5 s, against 12.4 s on four, measured while a build used another core [P].
- **Downloads [P]:** the WASM is 3.07 MB gzipped; the CRS is 32 bytes per point, 32 MiB for 2^20 and 64 MiB for 2^21; the circuit bytecode was 13.5 MB (2^20) and 26.9 MB (2^21) as JSON.

### 3.3 Verification gas (`bb write_solidity_verifier`, forge test, one public input) [P]

Gas of the `verify(bytes, bytes32[])` call alone, without the transaction's intrinsic and calldata gas.

| Verifier | Target | 2^16-gate circuit | 2^20-gate circuit | Proof bytes (2^16, 2^20) | Runtime code (2^20) |
|---|---|---:|---:|---|---:|
| standard | `evm` (keccak, ZK) | 2,447,641 | 2,693,938 | 8,768, 10,304 | 18,492 B |
| `--optimized` | `evm` (keccak, ZK) | 701,966 | 774,881 | same | 17,457 B |
| standard | `evm-no-zk` | 1,459,235 | 1,673,957 | 7,776, 9,184 | 17,438 B |
| `--optimized` | `evm-no-zk` | 584,348 | 635,468 | same | 15,894 B |

- Calldata adds about 147,000 gas for a 9,184-byte proof at 16 gas per byte, so one optimized non-ZK verification is about 0.8 million gas as a transaction [I]. Arbitrum's L1 data fee is extra and was not measured.
- The game needs no zero knowledge: journals are public. So `evm-no-zk` is the relevant target.
- **Public inputs [P].** A 2,152-gate circuit with 1,601 public inputs, the size of six full journals packed at 31 bytes per element, verified for 1,053,948 gas with the optimized non-ZK verifier and 3,727,176 with the standard one. Against the trend of the table that is roughly 330 and 1,550 gas per public input [I].
- **Audit status [P]:** `honk_contract.hpp`, `honk_zk_contract.hpp` and `honk_optimized_contract.hpp` at tag `v5.3.0` each open with `AUDIT STATUS: internal: Planned; external_1: not started; external_2: not started`.

### 3.4 Arbitrum One gas price [P]

`cast gas-price` on `arb1.arbitrum.io/rpc`: 20,034,000 wei (0.020034 gwei) at block 522,988,445, 2026-11-10 13:23 UTC. The repository read 0.020036 gwei on 2026-11-02 (`docs/VERIFICATION.md`).

## 4. Option by option

### 4.1 Noir with Barretenberg (bb.js, UltraHonk)

- **Versions [P].** `@aztec/bb.js` 5.3.0, 2026-10-26; `@noir-lang/noir_js` 1.0.0, 2026-10-29; Noir v1.0.0 on GitHub, 2026-10-29. Aztec's `bbup` map (`bb-versions.json` on `master`) stops at Noir 1.0.0-beta.22 ↔ bb 5.0.0-nightly.20260522.
- **Largest circuit in a browser.** Until at least bb.js 2.0.2 (2025) the README said "Max circuit size is 2^19 gates (524,288). This is due to the underlying WASM 4GB memory limit" [P, stale?]. The 5.3.0 README no longer states a limit [P], and 2^21 gates were proven here in 3.4 GiB [P]. Memory64 would lift the 4 GiB cap, but bb.js 5.3.0 is wasm32, and Memory64 is in Chrome 133 and Firefox 134 and in no Safari through 27.3 [P, caniuse].
- **Proving time at 2^18 to 2^20 [P]:** 12.4 s, 23.4 s and 42.6 s on 4 threads (section 3.2). Others' figures: Mopro measured bb 0.82.2 in a laptop browser at 4.1 to 17.0 s for circuits that take 0.2 to 1.4 s natively, 8 to 12 times slower [P, stale?]; Base measured Noir's WASM at 3.5 to 4 times native (2025-09-02) [S, stale?].
- **Threads [P].** Multithreading needs `SharedArrayBuffer`, which browsers enable only on cross-origin-isolated pages: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Without them bb.js falls back to its single-threaded WASM. The README warns that these headers "will disable loading of external scripts" and suggests proving in a separate page inside an iframe; for a dApp that opens wallet pop-ups and loads wallet scripts, that is real integration work [I].
- **WebGPU.** None in bb.js 5.3.0: no occurrence of "webgpu" in its `dest/` [P]. The npm package `webgpu_bbjs` is a 2023 fork of bb.js 0.12.0 by an individual [P, stale?].
- **Verifier gas [P]:** section 3.3. Others' figures agree with the standard ZK verifier: 2.45 to 2.51 million gas for 48,000 to 80,000-gate circuits (Aztec forum, 2026-06-15) [S]; 2,396,575 gas (Base, 2025-09-02) [S, stale?]; 1.86 to 2.06 million with bb 0.82.2 (HashCloak, 2025) [S, stale?].
- **Cheaper flavors [P]:** `evm-no-zk` (about 40% less on the standard verifier) and `--optimized` (a hand-written assembly verifier, 2.5 to 3.5 times less). All four combinations are unaudited (section 3.3).
- **Recursion in the browser [P]:** 681,879 gates to verify one proof in-circuit, two thirds of a 2^20 proof.
- **Setup.** A universal KZG setup, no ceremony per circuit [P, observed: bb fetched one BN254 CRS and proved every circuit of section 3 with it].
- **Elsewhere [S].** The EF client-side proving team's Q1 2026 report measured Barretenberg natively at 584 MB of peak RAM for SHA-256, with 15.8 KB proofs, and lists it among the systems that are not post-quantum (KZG).

**Fit: possible in pieces, not for a run.** One level's ticks alone are 8 to 21 million gates, 4 to 10 proofs of 2^21 [I].

### 4.2 Circom with snarkjs or rapidsnark (Groth16, PLONK, FFLONK)

- **Versions [P].** snarkjs 0.7.6, 2026-01-12; `circom2` 0.2.23, 2026-06-30; `ark-circom` 0.6.0, 2026-04-26.
- **Systems and setup [P, snarkjs README].** "snarkjs supports 3 proving systems: Groth16, PLONK, and FFLONK (Beta version)." "Groth16 requires a trusted ceremony for each circuit. PLONK and FFLONK do not require it, it's enough with the powers of tau ceremony which is universal." Powers of tau exist up to 2^28 constraints.
- **rapidsnark in WASM:** not offered. It is a native C++ prover with x86_64, arm64, Android and iOS builds [S]. In a browser the provers are snarkjs and arkworks compiled to WASM.
- **Proving times [P, Mopro, stale?].** snarkjs against rapidsnark on an M1 Max: Keccak256 3.9 s against 0.53 s, Anon Aadhaar 19.8 s against 2.4 s. In a phone browser: snarkjs 5.2 s and arkworks-with-rayon 1.7 s for Keccak256 on an iPhone 16 Pro; no browser result is listed for Anon Aadhaar.
- **Proving-key size.** The EF Q1 2026 report gives Circom's preprocessing as 592 MB for SHA-256 of 2,048 bytes and 1.25 GB for Keccak of 2,048 bytes [S]; ethproofs' benchmark table, read as its default SHA-256 target, lists 95,000 constraints for 128 bytes, three blocks (2026-11-02) [P]. The 2,048-byte SHA-256 circuit is then about 1.0 million constraints, so about 0.6 GB of key per million constraints [I].
- **Practical browser ceiling.** No authoritative figure found. ZK Email reported on 2026-02-13 that "browser-based local proving isn't yet feasible for all email types because WebAssembly's memory limitations restrict it" and began server-side proving [S]. From the key sizes, about 1 to 2 million constraints on a desktop [I].
- **Verification gas.** Groth16: about 207,700 + 7,160 per public input; FFLONK: about 200,000 + 900 per public input (Orbiter Research, measured with Hardhat, undated) [S]. PLONK in snarkjs: about 290,000 against 230,000 for Groth16 per an iden3 post, which could not be opened [S, unverified]. For scale, RISC Zero's Groth16 verifier takes 227,591 gas in this repository's tests [P].
- **This game in R1CS [I].** No lookup or memory argument: a cell read is a 60-way row multiplexer, a 120-bit decomposition and a 60-way column multiplexer, about 400 constraints, and about 1,300 for a 3×3 neighborhood. With a rail bitmap that is about 14,000 constraints per tick and about 250,000 per capture. One 2,700-tick level: about 38 million constraints before any capture, a key of about 20 GB. Chunks of 64 ticks would be about 0.9 million constraints each, 250 proofs per full-length run and as many onchain verifications.

**Fit: no.** Cheapest verifier, worst prover fit, and a ceremony per circuit and per rules version.

### 4.3 Halo2 in WASM

- **Status [P].** PSE's fork, the one with the KZG backend and a Solidity verifier, "is in maintenance mode starting January 2025" and points feature work to Axiom's fork (README). Zcash's `halo2_proofs` is active (0.4.1, 2026-10-27) but uses IPA and has no EVM verifier. PSE's `halo2-solidity-verifier` README: "This repo has NOT been audited and is NOT intended for a production environment yet."
- **Browser [P, stale?].** The Halo2 book: WASM's hard limit is 4 GB; with the memory raised to it, circuits "up to K = 15 or so" work; threads need `wasm-bindgen-rayon`, nightly Rust and WASM atomics. Mopro: Keccak256 in 26.6 s on the web against 10.3 s native; an RSA circuit "needs around 5GB" and is "not supported" on the web.
- **Verification gas.** No authoritative figure found; a draft pull request reports 363,218 gas for a toy circuit [S, unverified].

**Fit: weak.** The same second implementation as Noir, on a toolchain in maintenance, with a smaller browser ceiling.

### 4.4 Plonky2, Plonky3, Stwo, and verifying FRI in the EVM

- **Plonky2 [P].** Deprecated: "Plonky2 is being deprecated and will no longer receive updates or support. Please consider using Plonky3" (README). Last crate release 1.1.0, 2025-05-12.
- **Plonky3 [P].** `p3-uni-stark` 0.8.0, 2026-09-23, and 0.9.0-rc.2, 2026-10-16. The README lists univariate, multilinear and batched STARKs, FRI, STIR and WHIR commitments and LogUp lookups, which is what a memory argument needs. It gives no timings and no EVM verifier.
- **Stwo [P].** `stwo` 2.3.0, 2026-06-25; development moved to `starkware-libs/proving` at the end of July 2026. The README calls it production, lists a WebAssembly SIMD backend, a `no_std` verifier "small enough to embed in on-chain environments, including Ethereum (Solidity) and Starknet (Cairo)" and a Keccak256 channel "suitable for Solidity-friendly Fiat-Shamir". No Solidity verifier with a gas figure was found.
- **In the browser.** No published browser benchmark of Plonky3 or Stwo on a custom AIR was found. A community package, `stwo-cairo` 1.1.1 (2025-09-10), proves Cairo programs in the browser and needs cross-origin isolation [P, stale?]. An undated third-party note reports Stwo's WASM build proving 2^18 Poseidon instances in about 6.5 s on an M3 Pro for the four phases it ported, about 5 times faster with WebGPU for those phases [S, undated].
- **This game as an AIR [I].** With a LogUp memory table, a tick is 60 to 220 memory rows and a capture about 7,200: a full-length run with 200 captures is 2.4 to 5.0 million rows of a few dozen columns, against 10^8 cycles of a zkVM whose every cycle is already dozens of columns. That is plausibly seconds to a minute in a browser, well inside 4 GiB, but it is an estimate, not a measurement.
- **Verifying it on Arbitrum.** The only measured EVM verifier of this family found is the EF client-side proving team's WHIR verifier over KoalaBear (ethresear.ch, 2026-05-19) [P]: 5,646,080 gas as a transaction, of which 856,336 calldata, for a 2^22 polynomial at 100 bits of provable soundness, with a 54 KB proof and bytecode over the EIP-170 limit; 975,202 gas at 80 bits. It is a polynomial-commitment verifier, not a whole STARK. StarkWare's own L1 verification is cited at about 5 to 6 million gas [S]. The alternative, wrapping the STARK in Groth16, is what SP1 and RISC Zero do with a multi-gigabyte prover (the repository measured 7 GiB for RISC Zero's and found SP1's 5.9 GB key), which no browser runs.

**Fit: the best prover, no verifier.** A small team would have to write and audit both the AIR and a Solidity FRI or WHIR verifier.

### 4.5 o1js recursion

- **Version [P].** o1js 3.1.0, 2026-09-23.
- **Browser [P, o1Labs, 2026-02-24].** The browser path is WASM with a 4 GB ceiling and 2^16 rows per circuit without chunking; the native prover that reaches 2^18 rows with chunking runs on Node only.
- **Recursion [P].** `ZkProgram` with `SelfProof` gives recursion (Kimchi and Pickles), so "one proof per chunk of ticks, folded into one" is expressible.
- **EVM.** No cheap verifier: Kimchi proofs are over the Pasta curves, and the Mina-to-Ethereum bridges wrap or batch them; LambdaClass's bridge README still lists its final verification as pending [S].

**Fit: no.** TypeScript rules, a proof Arbitrum cannot check.

### 4.6 Folding and IVC

- **Nova (Microsoft) [P].** `nova-snark` 0.76.0, 2026-09-03. BN254/Grumpkin among its curve cycles; HyperKZG and Mercury commitments on a universal powers-of-tau setup; Spartan-based compression of the IVC proof; an `evm` feature described as "EVM-friendly serialization"; NeutronNova behind `experimental`. The README names MicroNova as "an on-chain efficient version of Nova" whose HyperKZG and MicroSpartan parts are open-sourced. It ships no Solidity verifier.
- **MicroNova [S].** The paper (ePrint 2024/2099, IEEE S&P 2025) reports proofs "verified on the Ethereum blockchain" for about 2.2 million gas. The PDF could not be opened; a search summary says the verifier is about 3,300 lines of Solidity. No public repository of it was found.
- **Sonobe (PSE and 0xPARC) [P].** Rewritten: `sonobe` 0.1.0-alpha.1, 2026-07-26, "Pre-release code, use with caution", 35 downloads. Stable: Nova and CycleFold on Pedersen commitments with the arkworks front end. "To be merged" or "to be revamped": HyperNova, ProtoGalaxy, Ova, Mova, the LegoGroth16 decider, KZG, and the Circom front end; the Noir front end is "WIP". Targets include `wasm32-unknown-unknown`. The README says this branch went through three review rounds, one by human auditors.
- **Sonobe's onchain decider, in the older code [S, stale].** A Groth16 proof over BN254 of a "decider circuit" plus KZG checks in the contract. Its size is about 3x + 10.5 million constraints for a step circuit of x constraints (the design page's formula; the page rounds it to "11.9M" for x = 500,000); the 2024 slides give 9.6 million constraints, "under 3 minutes on a 16-core, 32 GB laptop", and about 800,000 gas with a goal of 600,000. That docs page still says "experimental and has not been audited".
- **SuperNova [P, stale?].** Arecibo, the fork that implements it, last published a crate on 2023-12-15 (0.1.1); its repository is not archived.
- **Nexus [S, stale?].** The one team that shipped a folding-based zkVM moved off it: zkVM 3.0 "reimplemented the zkVM's arithmetization" as AIRs on Stwo and "delivers dramatic improvements over our previous implementations that were based on folding" (StarkWare's blog, 2025-06-25). Its own pages could not be opened.
- **Speed.** Old numbers only: Nova on an M1 Max, 1,000 folds of a 30,000-constraint step in 125 to 240 s, about 0.2 million constraints per second; 1.1 million per second on 72 cores with large steps (undated, about 2023) [S, stale]. No browser benchmark of a folding prover was found; a 2023 demo estimated 2 to 6 ECDSA signatures per second [S, stale].
- **This game [I].** Folding is R1CS, so section 4.2's 14,000 constraints per tick apply, plus the recursion overhead and the hashing of a 120-element state at every step, which pushes toward 16 or more ticks per step. A full-length run with 200 captures is about 280 million constraints: 5 to 15 minutes natively at the rates above, more than that in WASM, and it needs two step circuits (tick, capture), so a non-uniform scheme of the SuperNova type.
- **The exit is the problem.** The final compression must become something the EVM checks: Sonobe's 10 million-constraint Groth16 decider (a ceremony, and not a browser job), MicroNova's 2.2 million gas without a public verifier, or nothing.

**Fit: the right computational model, no deployable path to Arbitrum.**

### 4.7 Rust to circuits without a zkVM

- **zkLLVM [P].** =nil; Foundation's compiler from LLVM IR to circuits. Its Rust front end, `zkllvm-rslang`, "was archived by the owner on Feb 17, 2025"; `zkllvm` itself is not archived but shows no release, and its README assumes =nil;'s own Placeholder proof system.
- **Ligetron [S].** Proves WASM programs, so it would take the core's existing wasm build, with very little memory (126 to 140 MB for SHA-256 in the EF benchmarks), but its proofs are megabytes (3.5 MB at 128 bytes of SHA-256; 3 to 12 MB in the Q1 2026 report) and verify in hundreds of milliseconds to seconds. No EVM verifier was found, and it is in effect a WASM zkVM.
- **Noir, Circom, o1js, Cairo, Leo** are their own languages. **CirC**-style compilers take C subsets and ZoKrates, not Rust [I, not rechecked].

**Result: none.** Keeping one implementation means a virtual machine: a RISC-V or WASM zkVM, or Stylus. Whether one of those runs in a browser is another report's question.

## 5. Size of the circuit for this game

Order-of-magnitude estimates. UltraHonk figures are measured on the throwaway model (section 3.1); the others are derived [I].

| | Per ordinary tick | Per capture | Fixed per run |
|---|---:|---:|---|
| UltraHonk gates (Noir) | 2,952 to 7,750 [P] | 291,789 with a certificate, about 566,000 with the core's stack fill [P]; a hand-tuned certificate perhaps 100,000 to 150,000 [I] | about 2.9 million for about 400 keccak-f, or public-input packing [I] |
| R1CS constraints (Circom, Nova) | about 14,000 | about 250,000 | about 400 hash blocks at 30,000 constraints or more each (ethproofs: 95,000 for three SHA-256 blocks), 12 million or more: so public inputs or a SNARK-friendly commitment instead |
| STARK trace rows (LogUp memory) | 60 to 220 | about 7,200 | small |
| RISC Zero cycles today (repository) | about 400 idle | about 500,000 | about 1 million per level |

Runs, in UltraHonk gates:

| Run | Ticks | Captures | Gates | Proofs of 2^21 gates, proving time on 4 threads |
|---|---:|---:|---:|---|
| "Typical" (an assumption, no player data exists) | 10,000 | 60 | 50 to 98 million | 24 to 47 proofs, 33 to 64 min; chained by recursion 36 to 70 proofs, 49 to 96 min |
| Full-length, heavy, like the gate set | 16,200 | 200 | 109 to 187 million | 53 to 90 proofs, 72 to 123 min; chained 78 to 133 proofs, 107 to 182 min |
| Adversarial (two 1-cell captures per 5 ticks) | 16,200 | about 6,500 | about 2 billion | about 950 proofs, about 21 hours |

- A hand-optimized tick might reach 1,000 to 2,000 gates [I]; the full-length run would still be 16 to 32 million gates of ticks, 8 to 16 proofs of 2^21.
- Without recursion, each chunk proof is verified onchain: 24 to 90 verifications of about 0.8 million gas, 19 to 72 million gas, 8 to 29 times the run fee at 0.02 gwei, and beyond Arbitrum's 32 million gas per transaction [I].
- For comparison, the zkVM's 70 to 137 million cycles take 9 to 17 hours on the same 4 cores. A Noir circuit would be five to ten times faster to prove on that machine, and a custom STARK AIR perhaps a thousand times [I].

## 6. The owner's constraints

**One implementation.** Every option here adds a second one, in a language whose semantics differ from Rust's exactly where the rules are delicate: wrapping `u8` and `u16` arithmetic, the order of the two sub-steps, the minion scan order, the "first rail cell in row-major order". The measured 68,717-against-7,750-gate difference from one array-passing choice shows how far the circuit's shape would drift from the core's.

**Consensus risk is asymmetric [I].** If the circuit accepts something the core rejects, a payout is forged. If it rejects something the core accepts, a valid best run cannot settle. Differential fuzzing against the state-hash traces finds the second kind and never the first: an under-constrained circuit passes every honest vector, because vectors go through the witness generator. zkSecurity's survey of zkVM bugs makes the same point about circuits in general: "Missing even one constraint can allow the prover to generate an incorrect trace" (2024-11-21) [S, stale?]. With a zkVM that risk sits in RISC Zero's circuits, which every program on that zkVM shares; with a hand-written circuit it sits in this project's code alone.

**Audit burden [I].** The new trusted code would be: the circuit (the rules, the capture certificate, the journal binding, the chunk chaining), the verifier contract (unaudited for Honk at v5.3.0 [P]; to be written for a STARK), and the recursion or aggregation layer. Each `RULES_VERSION` bump re-opens the first.

**Completeness.** A fixed circuit bounds captures per level. The honest bound is about 1,000; anything lower rejects valid runs or needs a new rule in the core.

**Trusted setup.**

| Family | Setup |
|---|---|
| Groth16 (Circom, Sonobe's decider) | a ceremony per circuit, repeated at every rules change; if the operator runs it alone, the operator can forge proofs, which is the trusted signer the owner excludes [I] |
| UltraHonk, PLONK, FFLONK, HyperKZG | one universal KZG ceremony (one honest participant suffices) [P] |
| FRI and WHIR STARKs | none |
| Today: RISC Zero's Groth16 wrap | RISC Zero's own ceremony for its one fixed wrapper circuit, 238 contributions per its blog [S] |

**Dependencies and operations.** The circuit route does not remove a dependency, it swaps RISC Zero for Noir and Barretenberg (or Plonky3 plus a home-made verifier), adds cross-origin isolation to the web app, tens of megabytes of CRS and circuit downloads, and a second test matrix.

## 7. Cost on Arbitrum One at 0.02 gwei

| Verification | Gas | ETH | Share of the 0.00005 ETH fee |
|---|---:|---:|---:|
| RISC Zero Groth16, as deployed (repository) [P] | 227,591 | 0.0000046 | 9% |
| snarkjs Groth16, one public input [S] | about 215,000 | 0.0000043 | 9% |
| snarkjs FFLONK [S] | about 201,000 | 0.0000040 | 8% |
| UltraHonk `evm-no-zk`, `--optimized`, 2^20 gates [P] | 635,468 | 0.0000127 | 25% |
| UltraHonk `evm`, `--optimized`, 2^20 gates [P] | 774,881 | 0.0000155 | 31% |
| Sonobe's Nova decider (2024) [S] | about 800,000 | 0.000016 | 32% |
| WHIR over KoalaBear, 80 bits [P] | 975,202 | 0.0000195 | 39% |
| UltraHonk `evm-no-zk`, standard, 2^20 gates [P] | 1,673,957 | 0.0000335 | 67% |
| MicroNova (paper) [S] | about 2,200,000 | 0.000044 | 88% |
| UltraHonk `evm`, standard, 2^20 gates [P] | 2,693,938 | 0.000054 | 108% |
| WHIR over KoalaBear, 100 bits provable [P] | 5,646,080 | 0.000113 | 226% |

At Arbitrum's gas price, a single proof of any of these is affordable under verify-by-exception. The cost is not what blocks this route: the number of proofs per run, the missing or unaudited verifiers and the second implementation are.

## 8. Conclusion

- **Could a browser prove a whole run?** Not as one proof in any deployed SNARK. As about 35 to 130 chained UltraHonk proofs of 2^21 gates, yes on a desktop, in one to three hours on four threads, with a 3.4 GiB WASM heap. As a custom STARK, probably within a minute or so, but no measurement of it was found or made, and Arbitrum cannot check it cheaply. As a folding proof, in tens of minutes, with no deployable way to settle it.
- **Could Arbitrum verify it cheaply?** One UltraHonk proof, yes: 0.58 to 0.77 million gas with the optimized verifier, which is unaudited. A Groth16 or FFLONK proof, yes at about 0.2 million gas, but those are the systems a browser cannot use for this workload. A STARK or a folding proof, no.
- **Is it realistic for a small team?** No. It trades a prover that is slow but runs the one Rust core, behind the verifier RISC Zero itself deployed on Arbitrum, for a faster prover that runs a second implementation of rules that decide payouts, behind verifiers that are unaudited or do not exist. The current design's weakness, that a player cannot prove their own run, is real; this family does not fix it at an acceptable price.
- **What would change the answer:** an audited Solidity verifier for a small-field STARK under about 1 million gas; or bb.js proving 2^24 gates or more in a browser (Memory64 or WebGPU) with an audited verifier; or a maintained Rust-to-circuit compiler. None exists today. A prover that keeps the one core, a zkVM light enough for a browser, is the adjacent question and outside this note.

## 9. What could not be verified

- **No real browser was used.** The WASM figures come from Node's V8 with worker threads. Tab memory limits, Safari and phones were not tested.
- **The throwaway circuits are not faithful ports.** They leave out the trail erase, level validation, the journal decoding and the hashing, and were not checked against the vectors. Gate counts are order-of-magnitude.
- **The direct flood-fill capture circuit** was not counted at full size: with 3,364 unrolled pops `nargo compile` had not finished after 15 minutes of CPU time. The 566,000 gates are extrapolated from 100 and 200 pops.
- **R1CS, AIR and folding sizes are estimates;** nothing was written in Circom, Plonky3, Stwo or Nova.
- **In-browser speed of Plonky3, Stwo, Nova and Sonobe:** no published benchmark found.
- **A Solidity verifier for Plonky3 or Stwo proofs,** and its gas: none found.
- **MicroNova's Solidity verifier:** the ePrint PDF returned 403; the 2.2 million gas and the 3,300 lines come from the abstract and a search summary; no public code found.
- **Nexus:** `blog.nexus.xyz` and `docs.nexus.xyz` did not resolve from this session; the move from folding to Stwo is from StarkWare's blog.
- **iden3's PLONK post** (290,000 against 230,000 gas) returned HTTP 521.
- **Halo2 verifier gas:** no authoritative figure found.
- **snarkjs's practical browser ceiling:** no authoritative figure; the 1 to 2 million constraints are my inference from key sizes.
- **The audit status of bb's Solidity verifiers** is read from source-file headers at v5.3.0; an audit published elsewhere was not found, and was not ruled out.
- **Noir 1.0.0's `nargo`** was not used: the release-asset URL tried returned 404, so beta.22 compiled the circuits.
- **Arbitrum's L1 data fee** for 8 to 10 KB of proof calldata was not measured.
- **The adversarial capture rate** (about 1,000 per level) and its zkVM cost are derived from the rules, not played.

## 10. Sources

Measurements of this report: section 3, files under `scratchpad/research/measure/`, 2026-11-10.

Repository (read-only): `README.md` §4, §6, §7; `docs/VERIFICATION.md` (zk costs, 2026-11-02); `core/src/*.rs`; `tools/src/scenarios/game_long.rs`.

| Source | URL | Date |
|---|---|---|
| npm registry, `@aztec/bb.js` (5.3.0) | https://registry.npmjs.org/@aztec%2Fbb.js | 5.3.0 published 2026-10-26 |
| bb.js README at v5.3.0 | https://raw.githubusercontent.com/AztecProtocol/aztec-packages/v5.3.0/barretenberg/ts/README.md | tag of 2026-10 |
| bb.js README at v2.0.2 (the 2^19 limit) | https://raw.githubusercontent.com/AztecProtocol/aztec-packages/v2.0.2/barretenberg/ts/README.md | 2025 (stale?) |
| bb.js WASM memory defaults | https://raw.githubusercontent.com/AztecProtocol/aztec-packages/v5.3.0/barretenberg/ts/src/barretenberg_wasm/barretenberg_wasm_main/index.ts | tag of 2026-10 |
| bb Solidity verifier sources (audit headers) | https://raw.githubusercontent.com/AztecProtocol/aztec-packages/v5.3.0/barretenberg/cpp/src/barretenberg/dsl/acir_proofs/honk_optimized_contract.hpp (and `honk_contract.hpp`, `honk_zk_contract.hpp`) | tag of 2026-10 |
| bbup version map | https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/bb-versions.json | read 2026-11-10 |
| Barretenberg docs: browser, CLI, Solidity verifier | https://barretenberg.aztec.network/docs/how_to_guides/on-the-browser , https://barretenberg.aztec.network/docs/bb-cli-reference , https://barretenberg.aztec.network/docs/how_to_guides/how-to-solidity-verifier | docs v0.87.0, page built 2026-01-13 |
| npm registry, `@noir-lang/noir_js` | https://registry.npmjs.org/@noir-lang%2Fnoir_js | 1.0.0 published 2026-10-29 |
| Noir releases | https://github.com/noir-lang/noir/releases | v1.0.0, 2026-10-29 |
| caniuse, WebAssembly Memory64 | https://caniuse.com/wf-wasm-memory64 | read 2026-11-10 |
| Aztec forum, UltraHonk verifier gas | https://forum.aztec.network/t/noir-rlwe-gadgets-verifiable-bfv-encryption-rlwe-in-noir-with-an-on-chain-ultrahonk-verifier/8591 | 2026-06-15 |
| Base, benchmarking ZKP systems | https://base.org/blog/benchmarking-zkp-systems | 2025-09-02 (stale?) |
| HashCloak, Semaphore Noir benchmarks | https://hashcloak.github.io/semaphore-noir-final-report/benchmarks.html | undated, bb 0.82.2, 2025 (stale?) |
| Mopro, performance | https://zkmopro.org/docs/performance | undated, bb 0.82.2 (stale?) |
| EF client-side proving, benchmarks report Q1'26 | https://hackmd.io/@clientsideproving/report-q1 | Q1 2026 |
| ethproofs, client-side proving benchmarks | https://ethproofs.org/csp-benchmarks | updated 2026-11-02 |
| EF client-side proving, WHIR EVM verifier | https://ethresear.ch/t/evm-verification-of-whir-over-a-31-bit-field/24902 , https://hackmd.io/@clientsideproving/whir-evm-verifier | 2026-05-19 |
| EF client-side proving, "The Definitive CSP" | https://hackmd.io/@clientsideproving/whir-based | undated, living document |
| npm registry, snarkjs, circom2, o1js, stwo-cairo | https://registry.npmjs.org/snarkjs (and `/circom2`, `/o1js`, `/stwo-cairo`) | 2026-01-12, 2026-06-30, 2026-09-23, 2025-09-10 |
| snarkjs README 0.7.6 | https://cdn.jsdelivr.net/npm/snarkjs@0.7.6/README.md | 2026-01 |
| Orbiter Research, Groth16 and FFLONK gas | https://hackmd.io/Fa4A8lVKRM2TwVh1dhUb1Q | undated |
| ZK Email, ENS progress update | https://discuss.ens.domains/t/spp2-zk-email-application/20450/15 | 2026-02-13 |
| "Proving in the browser, by the numbers" (blog) | https://daxblogv2.pages.dev/blog/proving_in_the_browser_by_the_numbers | 2025-11-27 |
| PSE halo2 README (maintenance mode) | https://raw.githubusercontent.com/privacy-scaling-explorations/halo2/main/README.md | read 2026-11-10 |
| PSE halo2-solidity-verifier README | https://raw.githubusercontent.com/privacy-scaling-explorations/halo2-solidity-verifier/main/README.md | read 2026-11-10 |
| The Halo2 book, WASM | https://zcash.github.io/halo2/user/wasm-port.html | undated (stale?) |
| crates.io: halo2_proofs, plonky2, p3-uni-stark, stwo, nova-snark, sonobe, arecibo, ark-circom, webgpu-groth16 | https://crates.io/api/v1/crates/<name> | versions and dates as cited, read 2026-11-10 |
| Plonky2 README (deprecation) | https://raw.githubusercontent.com/0xPolygonZero/plonky2/main/README.md | read 2026-11-10 |
| Plonky3 README | https://raw.githubusercontent.com/Plonky3/Plonky3/main/README.md | read 2026-11-10 |
| Stwo README | https://raw.githubusercontent.com/starkware-libs/stwo/dev/README.md | read 2026-11-10 |
| Stwo WebGPU note | https://hackmd.io/XM9z2p8sSIS1w_rV1O0uDA | undated |
| o1Labs, native prover | https://www.o1labs.org/blog/o1js-native-prover | 2026-02-24 |
| o1js recursion docs | https://docs.o1labs.org/o1js/advanced-concepts/recursion | read 2026-11-10 |
| LambdaClass, Mina bridge | https://www.github.com/lambdaclass/mina_bridge | via search, not opened |
| Nova README | https://raw.githubusercontent.com/microsoft/Nova/main/README.md | read 2026-11-10 |
| MicroNova | https://eprint.iacr.org/2024/2099 | 2024-12-31, revised 2025-04-24 |
| Sonobe README | https://raw.githubusercontent.com/privacy-scaling-explorations/sonobe/main/README.md | read 2026-11-10 |
| Sonobe docs: onchain decider, WASM, decider, Solidity verifier | https://sonobe.pse.dev/design/nova-decider-onchain.html , https://sonobe.pse.dev/usage/wasm.html , https://sonobe.pse.dev/usage/decider.html , https://sonobe.pse.dev/usage/solidity-verifier.html | undated, older code (stale?) |
| Sonobe slides, zkBarcelona | https://git.arnaucube.com/arnaucube/math/raw/branch/folding-slides/slides_sonobe-zkbarcelona-2024-04-22.pdf | 2024-04-22 (stale), via search |
| Folding-schemes team update | https://hackmd.io/KbswQCxFRaONum6MFGYucg | 2024-10 (stale) |
| Arecibo | https://github.com/argumentcomputer/arecibo | read 2026-11-10 |
| Nova benchmarks | https://hackmd.io/@oskarth/rJmSaOtZ2 | undated, about 2023 (stale) |
| nova-browser-ecdsa | https://github.com/dmpierre/nova-browser-ecdsa | undated, about 2023 (stale) |
| StarkWare blog, Nexus × S-two | https://starkware.co/blog/nexus-stwo-zkvm-scalable-verifiable-computation/ | 2025-06-25 (stale?) |
| zkLLVM and its Rust front end | https://github.com/NilFoundation/zkllvm , https://github.com/NilFoundation/zkllvm-rslang | archived 2025-02-17 |
| RISC Zero, trusted setup ceremony | https://risczero.com/blog/verifying-risc-zeros-trusted-setup-ceremony | undated; attestations from 2023-12; via search, not opened |
| zkSecurity, zkVM security | https://blog.zksecurity.xyz/posts/zkvm-security/index.html | 2024-11-21 (stale?) |
| SoK: security vulnerabilities in SNARKs | https://arxiv.org/abs/2402.15293 | 2024-07-11 (stale?) |
| Arbitrum One public RPC | https://arb1.arbitrum.io/rpc | block 522,988,445, 2026-11-10 13:23 UTC |
