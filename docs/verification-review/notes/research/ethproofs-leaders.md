# The zkVMs that lead real-time proving, sized for a 1e8-cycle game replay

Research date: 2026-11-10. Everything marked "read 2026-11-10" was fetched that day; live Ethproofs figures were read at about 13:10 UTC.

Each fact carries a class: **[P]** primary source (official docs, repository file, release notes, the benchmark site's own data, or this project's own recorded measurement), **[S]** secondary source (third-party page, or a search engine's extract of a primary page that could not be opened), **[I]** inference or arithmetic of mine. Sources are numbered and listed with dates in section 11.

## 1. Bottom line

- **Running the current RISC Zero 3.0.6 proof on one GPU is the best option, and switching zkVM is not worth it today.** Estimated time for one 1e8-cycle run, Groth16 wrap included: about **2 minutes** (1.4 to 2.7 minutes for the 70 to 137 million-cycle range), against 9 to 17 hours on 4 CPU cores: about **370 times faster** [I, from S figures]. GPU rental for that time: about **0.02 to 0.03 USD** per run at 0.634 USD per RTX 5090 hour [I from P]. Guest, image id, verifier contract, 260-byte seal and 227,591 gas stay exactly as they are; the host gains one cargo feature (`cuda`), which also removes Docker from the wrapping step [P].
- **The leaders are 3 to 10 times faster than that, but only two of the five have a production path to an Arbitrum contract today**: SP1 6.x (verifier gateway already on Arbitrum One, about 0.5 to 1 minute per run) and OpenVM 2.1 (self-deployed Halo2 verifier, 316K gas, about 10 to 40 s per run) [P for the facts, I for the times].
- **The other three are blocked or not ready for onchain use**: Airbender v3 (4 s for 1e8 cycles on one RTX 5090, the fastest, but its SNARK wrapper "is not implemented yet"), Pico 3.1 (Groth16 keys are test keys only; "a deployment needs keys from a real setup ceremony"), ZisK 1.4.0-alpha (alpha, audits in progress, AGPL verifier wrapper, 64 GB hosts) [P].
- Going from 2 minutes to 20 seconds buys nothing for a game that verifies each player's best run once per season. A switch costs a new guest wrapper, host, verifier adapter, proof fixtures, tooling trial and reproducible-build rule: roughly the plan items M1.16/M1.17, M1.12, M4.8, M4.10 and M4.14 done again [I].
- All block-proving numbers below come from warm, tuned clusters that output a STARK, not an EVM proof. They bound throughput; they do not include cold start, key loading or the SNARK wrap.

## 2. What the workload is

From `docs/VERIFICATION.md` and `referee/zk/README.md` [P, project records, 2026-10-31 to 2026-11-02]:

- One run is six levels. Over the gate set (each level's heavier vector): 91.8 to 130.8 million RISC Zero user cycles, 96.7 to 137.4 million proving cycles (median 114.8 million); the heaviest measured run is 130,741,601 user cycles, 136,445,952 proving cycles, 131 segments of 2^20. On SP1 (RV64IM) the same run is 136,915,482 cycles, 119,502,086 PGU. The task's brief gives 70 to 137 million for a run; this report sizes everything at 1e8.
- Software keccak (tiny-keccak), no precompiles. Public values: 2,304 bytes for a run.
- CPU proving, 4 cores: about 400 s per 2^20-cycle segment, 51 to 57 s of recursion per segment, 167 to 172 s of Groth16 in Docker; 16 to 17 hours for the heaviest run.
- Onchain: RISC Zero 3.0 Groth16 verifier behind its emergency stop on Arbitrum One and Sepolia, 227,591 gas, 260-byte seal.
- The host depends on `risc0-zkvm = { version = "=3.0.6", features = ["prove"] }` (`referee/zk/host/Cargo.toml`). The zk code is small: guest 125 lines, host 830 lines, `ZkReferee.sol` 95 lines, its tests 336 lines [P, counted 2026-11-10].
- Earlier prices recorded by the project: Boundless raw Groth16 seal p50 0.0000184 ETH (0.042 USD, 2026-11-02); Succinct Prover Network 0.433 PROVE (0.090 USD, 2026-10-31) [P].

## 3. What Ethproofs says (read 2026-11-10)

### 3.1 Provers page: long-run averages [P, source 1]

Parsed from the data embedded in `https://ethproofs.org/provers` (`/clusters` redirects there).

| Prover | zkVM, version, ISA | GPUs | Type | Guest | Avg time | Avg cost per proof | Listed since |
|---|---|---:|---|---|---:|---:|---|
| Airbender v3 4x5090 | ZKsync Airbender v3 0.1.0, rv32im | 4 | 1:1 cloud | ZKsync OS | 2.46 s | 0.00168 USD | 2026-10-04 |
| Axiom 16x5090 | OpenVM 2.1 Preview 2.1.0-preview, rv64im_zicclsm | 16 | 1:1 cloud | revm | 3.27 s | 0.00986 USD | 2026-04-07 |
| Zilkworm Airbender v3 2x5090 on-prem | ZKsync Airbender v3 0.1.0, rv32im | 2 | 1:1 on-prem | zilkworm | 3.41 s | 0.00123 USD | 2026-10-14 |
| zkDTVM 4x5090 | zkDTVM 0.8.0, rv32im | 4 | 1:1 cloud | evmone | 4.68 s | 0.00319 USD | 2026-08-13 |
| ZisK 2x5090 | ZisK 1.4.0-alpha, rv64ima | 2 | 1:10 on-prem | ziskethone | 5.82 s | 0.00201 USD | 2026-07-22 |
| Airbender v3 1x5090 | ZKsync Airbender v3 0.1.0, rv32im | 1 | 1:1 cloud | ZKsync OS | 6.00 s | 0.00104 USD | 2026-10-12 |
| Pico 3.0 4x5090 | Pico 3.0.0, rv64im | 4 | 1:1 cloud | revm | 6.28 s | 0.00448 USD | 2026-10-20 |
| Zisk 4x5090 | ZisK 1.4.0-alpha, rv64ima | 4 | 1:1 cloud | ziskethone | 7.33 s | 0.00639 USD | 2025-11-17 |
| Succinct Twin Peaks 2x5090 | SP1 6.3.1, rv64im | 2 | 1:10 on-prem | revm | 28.90 s | 0.00937 USD | 2026-08-03 |
| Pico 2x5090 | Pico 2.0.0, rv64im | 2 | 1:10 on-prem | revm | 29.73 s | 0.00914 USD | 2026-07-01 |

- The averages run over each prover's whole listing, older versions included, so they lag current performance (see 3.2).
- No RISC Zero prover is active. R0VM 3.0.3 is in the inactive list with Ceno, OpenVM 1.4.1, SP1 Turbo 5.2.1, venus, Ziren and Airbender 0.7.0 [P, source 2].
- **Cost model.** Each proof carries a GPU price index; on 2026-11-09 it read `RTX 5090, hourly_price 0.634` [P, source 3]. Cost per proof = time × GPUs × that price: Airbender 1x5090, 6.004 s × 1 × 0.634 / 3600 = 0.00106 USD, against 0.00104 listed [I].
- `proving_time` is "Time in milliseconds taken to generate the proof including witness generation. It excludes time taken for data fetching and any latency to submit the proof"; `proving_cycles` is self-reported by the prover [P, source 4].

### 3.2 The 20 most recent blocks: cycles, time, throughput, proof size [P data, I arithmetic, source 3]

Blocks 26,384,710 to 26,384,729, 2026-11-10 13:08:11 to 13:11:59 UTC; gas used 9.6 to 42.1 million, mean 28.9 million. Throughput = reported cycles ÷ proving time. The last three columns are an ordinary least-squares fit of time on cycles over those blocks.

| Prover | Proofs | Cycles per block, median (range) | Time, median | Cycles per second | Per GPU | Proof size, median | Fit: fixed + per million cycles | Fitted time at 1e8 cycles | GPU-seconds at 1e8 |
|---|---:|---|---:|---:|---:|---:|---|---:|---:|
| Airbender v3 1x5090 | 19 | 197.9 M (81.1 to 289.2) | 5.79 s | 34.3 M | 34.3 M | 992 KiB | 2.22 s + 18.2 ms | 4.0 s | 4.0 |
| Airbender v3 4x5090 | 19 | 197.9 M | 2.76 s | 74.4 M | 18.6 M | 997 KiB | 1.25 s + 7.4 ms | 2.0 s | 8.0 |
| Zilkworm Airbender v3 2x5090 | 19 | 138.0 M | 3.31 s | 43.3 M | 21.7 M | 997 KiB | 1.38 s + 13.6 ms | 2.7 s | 5.5 |
| Axiom 16x5090 (OpenVM 2.1 Preview) | 19 | 184.6 M (95.2 to 269.0) | 2.22 s | 83.3 M | 5.2 M | 271 KiB | 1.27 s + 5.5 ms | 1.8 s | 29.1 |
| Pico 3.0 4x5090 | 19 | 150.5 M (86.4 to 217.7) | 5.47 s | 27.5 M | 6.9 M | 467 KiB | 1.70 s + 25.6 ms | 4.3 s | 17.1 |
| ZisK 2x5090 | 20 | 56.9 M (21.9 to 84.1) | 4.40 s | 12.7 M | 6.3 M | 245 KiB | 2.56 s + 34.6 ms | 6.0 s | 12.1 |
| Zisk 4x5090 | 20 | 56.9 M | 3.06 s | 18.3 M | 4.6 M | 245 KiB | 1.82 s + 23.8 ms | 4.2 s | 16.8 |
| zkDTVM 4x5090 | 8 | 219.6 M | 4.25 s | 51.2 M | 12.8 M | 263 KiB | 1.32 s + 13.8 ms | 2.7 s | 10.8 |
| Succinct Twin Peaks 2x5090 (SP1 6.3.1) | 2 | 315.5 M and 513.2 M | 23.3 s and 34.7 s | 14.2 M | 7.1 M | 1,243 KiB | two points only | about 7 to 11 s | 14 to 22 |
| Pico 2x5090 (Pico 2.0.0) | 2 | 358.5 M and 576.6 M | 26.1 s and 41.4 s | 13.8 M | 6.9 M | 967 KiB | two points only | about 7 s | about 14 |

Reading:

- **A block is the same order of magnitude as one run of this game**: 57 to 470 million reported cycles per block against 70 to 137 million per run. So the block benchmarks are closer to this workload than to a toy program, and the fixed part of a warm proof is 1.3 to 2.6 s [I].
- **Cycle counts are not comparable across zkVMs.** For the same blocks, reported cycles per gas run from 1.9 (ZisK, ziskethone) to 6.4 (OpenVM, revm), 7.0 (Airbender, ZKsync OS), 12.5 (SP1, revm) and 14.2 (Pico 2, revm). The guests and the amount of work pushed into precompiles differ; a 2025 Succinct statement put a block above 600 million cycles, and SP1 6.3.1 reported 316 and 513 million here.
- **Precompiles.** Block guests move keccak, secp256k1, BN254, SHA-256, modexp and BLS12-381 into precompile chips, whose proving work is in the time but hardly in the cycle count. This project's guest uses none, so for it every cycle is a plain RISC-V cycle: the per-cycle slope of a block prover is, if anything, pessimistic for it, most of all for ZisK [I].
- **Only Airbender v3 is listed on a single RTX 5090.** The smallest listed machine is 2x5090 for ZisK and SP1, 4x5090 for Pico 3.0 and 16x5090 for OpenVM.

### 3.3 Real-time cohort scores, last 50,237 block slots (about one week) [P, source 5]

| Prover | Blocks proven | Under 10 s | Performance score | Eligible | Cost per proof |
|---|---:|---:|---:|---|---:|
| Axiom 16x5090 | 50,233 | 50,233 | 99.99 | yes | 0.0076 USD |
| Zisk 4x5090 | 50,215 | 50,215 | 99.96 | yes | 0.0025 USD |
| ZisK 2x5090 | 50,188 | 50,188 | 99.90 | yes | 0.0018 USD |
| zkDTVM 4x5090 | 50,172 | 49,921 | 99.37 | yes | 0.0037 USD |
| Zilkworm Airbender v3 2x5090 | 47,419 | 47,419 | 94.39 | no | 0.0014 USD |
| Airbender v3 1x5090 | 23,895 | 23,157 | 46.10 | no | 0.0012 USD |
| Pico 3.0 4x5090 | 20,914 | 20,047 | 39.90 | no | 0.0048 USD |
| Airbender v3 4x5090 | 16,833 | 16,833 | 33.51 | no | 0.0022 USD |
| Succinct Twin Peaks 2x5090 | 5,023 | 290 | 0.58 | no | 0.0118 USD |
| Pico 2x5090 | 2,020 | 148 | 0.29 | no | 0.0124 USD |

An eleventh prover, Ziren 4X5090 (a MIPS zkVM), is left out. The home page's roadmap puts the site in phase 0.2, "security sprint", "working on M2: 100-bit provable / 600 KiB".

### 3.4 Security metrics, milestones and soundcalc

The milestones come from the Ethereum Foundation's post of 2025-12-18 [P, source 6]: M1 "soundcalc integration" (end of February 2026); M2 "Glamsterdam" (end of May 2026): "100-bit provable security (as estimated by soundcalc)", "Final proof size ≤ 600 KiB", a compact description of the recursion architecture; M3 "H-star" (end of 2026): "128-bit provable security", "Final proof size ≤ 300 KiB", a formal security argument for recursion. soundcalc is "a tool that estimates zkVM security based on the latest cryptographic security bounds and proof system parameters".

Ethproofs zkVM page, per zkVM [P, source 2]:

| zkVM (version listed) | Security target bits | soundcalc integrated | Proof size | M1 | M2 bits | M2 size | M3 bits | M3 size | Bounty | Implementation soundness |
|---|---:|---|---:|---|---|---|---|---|---:|---|
| ZisK 1.4.0-alpha | 128 | yes | 260 KB | achieved | achieved | achieved | achieved | achieved | 0 | red |
| OpenVM 2.1 Preview | 100 | yes | 300 KB | achieved | achieved | achieved | in progress | achieved | 0 | red |
| Pico 3.0.0 | 100 | yes | 478 KB | achieved | achieved | achieved | in progress | in progress | 0 | red |
| SP1 6.3.1 | 98 | yes | 850 KB | achieved | in progress | in progress | in progress | in progress | 64,000 USD | yellow |
| ZKsync Airbender v3 0.1.0 | not filled | not filled | 1,000 KB | not yet | not yet | in progress | not yet | in progress | not filled | not filled |
| R0VM 3.0.3 (inactive) | 0 (not reported) | no | 512 KB | not charted | | | | | 64,000 USD | yellow |

soundcalc's own reports, `main` branch [P, sources 7]:

| zkVM in soundcalc | Bits | Regime | Proof size | Note |
|---|---:|---|---:|---|
| ZisK 1.4.0-alpha | 128 | Johnson bound | 240 KiB expected, 247 worst | current |
| OpenVM2 2.0.0 | 100 | mixed | 270 KiB | current major version |
| SP1 6.1.0 | 100 | unique decoding | 524 KiB expected, 555 worst | Ethproofs still shows 98 |
| Pico | 53 | Johnson bound | 236 KiB | describes an older FRI-based Pico, not 3.x |
| Airbender | 64 (UDR), 67 (JBR) | | 1,834 KiB | describes the older FRI configuration, not v3 |
| RISC Zero | absent | | | not supported by soundcalc |

**What this means for an Arbitrum verifier** [I]: these metrics rate the hash-based STARK that Ethereum L1 would verify natively. A contract on Arbitrum verifies a pairing SNARK wrapped around it, so the security of the settled proof is the minimum of the STARK's bits, BN254's level and the trust in the wrapper's setup. A 128-bit STARK inside a Groth16 wrapper over BN254 is not a 128-bit onchain proof.

### 3.5 Client-side proving benchmark (Apple M1, 8 cores, 16 GB) [P, source 8]

RISC Zero is the only zkVM of this study in it: 18.5 s and 1.47 GiB for 4,591 to 6,834 cycles (sha256 target), 101 s and 3.73 GiB for 9,285 to 40,146 cycles (keccak target), 87.6 s for 296,161 cycles (ecdsa); listed at 96 security bits, "partially_audited". The time does not move with the cycle count inside a target: at this size the fixed cost is the whole cost. It says nothing about GPU throughput.

### 3.6 The API [P, source 4]

Base `https://ethproofs.org/api/v0`. `GET /clusters` and `GET /proofs` answer `401 No API key provided` without a key; only `GET /blocks/{block}` is open. The figures above therefore come from the data the site embeds in its own pages, which carries the same fields (`proving_cycles`, `proving_time`, `size_bytes`, `gpu_price_index`).

## 4. Each zkVM against the six questions

### 4.1 ZKsync Airbender v3 (Matter Labs)

1. **Block time and throughput.** One RTX 5090: 6.0 s average, 5.79 s median, 197.9 million cycles, 34.3 million cycles per second, 0.0010 USD per block [P, sources 1, 3]. The vendor page claims "21.8 MHz on a single H100" for an earlier version [P, source 14].
2. **Arbitrary guest.** Yes: `airbender-platform` is "a Rust toolkit for writing RISC-V zk-provable programs"; guests are `no_std` by default (`#[airbender::main]`), RV32IM, built with `cargo airbender build` on `nightly-2026-08-09`; `cargo airbender run` executes on the CPU (cycle limit, cycle markers, JIT on x86-64); the `dev` backend is a "mock proof envelope, no GPU needed"; `--reproducible` builds in a pinned Docker image. Real proving: "NVIDIA GPU with 32GB+ VRAM, 64GB+ RAM"; the CPU backend proves the base layer only. Output is 8 words (32 bytes), so a guest commits a hash [P, sources 9, 10].
3. **EVM proof.** Not available for v3. `docs/end_to_end.md` on `main`: "Wrapping that artifact into a SNARK is not implemented yet, but it is expected to be supported soon" [P, source 11]. The existing wrapper `zkos-wrapper` (Airbender STARK → Boojum → compression → KZG SNARK, 2^24 CRS from Matter Labs' storage, GPU through `BELLMAN_CUDA`, 4 GB compact CRS, 7 GB of precomputations) pins `zksync-airbender` tag `v0.5.2`, not v3 [P, source 12]. No verifier on Arbitrum; the v3 proof is about 1 MB.
4. **Security.** The Ethereum prover produces "security-100 unified proofs"; `cargo airbender prove` defaults to 100 bits, 80 is "legacy" [P, sources 9, 13]. Ethproofs has no metrics for v3 and marks M1 "not yet"; soundcalc's Airbender report (64 to 67 bits) predates v3 [P, sources 2, 7]. Bug bounty through Immunefi [P, source 11]. A Veridise tooling assessment of Airbender ran from 2026-02-16 to 2026-04-15 [S, search extract, source 30].
5. **License.** MIT or Apache-2.0, GPU prover included [P, sources 9, 11].
6. **Hosted proving.** None found for arbitrary programs.

### 4.2 ZisK 1.4.0-alpha (Polygon / ZisK)

1. **Block time and throughput.** Smallest listed machine 2x5090 (Threadripper PRO 24 cores): 5.8 s long-run average, 4.40 s median now, 56.9 million steps, 12.7 million steps per second; 99.9% of blocks under 10 s last week. 4x5090: 3.06 s median [P, sources 1, 3, 5]. Its guest leans on precompiles more than any other (1.9 steps per gas).
2. **Arbitrary guest.** Yes: `ziskos::entrypoint!(main)`, target `riscv64ima-zisk-zkvm-elf`, toolchain installed by `ziskup`; `ziskemu` runs on the CPU and reports steps (`-m`) and a cost profile (`-p summary`); `ziskup --nokey` installs the tools without keys. No mock prover is documented. The install is heavy: Ubuntu 22.04 or later, a long apt list (OpenMPI, qemu, gRPC, libsodium, nasm, `gcc-riscv64-unknown-elf`), unlimited locked memory, a 17 GB proving key, "about 43 GB for a STARK proof of the Quickstart example", 64 GB of physical memory for the assembly executor. The Quickstart's CPU proof of a 2,374-step program took 918 s [P, sources 15, 16, 17].
3. **EVM proof.** Final SNARK `pilfflonk` ("the only proof type the Solidity verifier accepts"), over BN254 with a KZG setup from the Hermez powers of tau (`powersOfTau28_hez_final_24.ptau`), circuit domain 2^20; SNARK key "a 4.67 GB download that takes about 6.3 GB on disk", not available on macOS; CPU wrap peaks at "more than 60 GB", with a GPU prover since 1.4.0-alpha. Proof: 211 words, 6,752 bytes. Verifier: `zisk-contracts/<hash family>/ZiskVerifier.sol` over `PilfflonkVerifier.sol`, tested with Hardhat, to be self-deployed; no deployed address is published. Its gas is not published. PLONK is possible but "ZisK publishes no PLONK key and no PLONK Solidity verifier" [P, sources 15, 18, 19].
4. **Security.** 128 bits in soundcalc (Johnson bound regime), all three Ethproofs milestones achieved, 245 KiB proofs [P, sources 2, 3, 7]. The README's first line: "currently undergoing security and correctness audits"; every release is tagged alpha; 1.3.2-alpha (2026-10-13) was a soundness fix [P, sources 15, 20].
5. **License.** MIT or Apache-2.0 for the crates and `PilfflonkVerifier.sol`; `ZiskVerifier.sol` and `IZiskVerifier.sol` carry `SPDX-License-Identifier: AGPL-3.0` [P, sources 15, 18].
6. **Hosted proving.** None found; the "remote" client targets a coordinator you run yourself (`http://localhost:7000`) [P, source 19].

### 4.3 OpenVM 2.x (Axiom), v2.1.0 released 2026-11-04

1. **Block time and throughput.** Smallest listed machine 16x5090: 3.27 s long-run average, 2.22 s median now, 184.6 million cycles, 83.3 million cycles per second (5.2 million per GPU); 99.99% of blocks under 10 s [P, sources 1, 3, 5]. Vendor: 8 GPUs 5.4 s average and 16 GPUs 3.9 s (2026-07-10); CoreMark "adapted to RV32IM", which has no precompiles, at "19.4 MHz on a single 5090 GPU" (2026-04-15) [P, sources 23, 24].
2. **Arbitrary guest.** Yes: "OpenVM fully supports `no_std` Rust" (`openvm::entry!(main)`); the guest target of v2.1.0 is `riscv32im-risc0-zkvm-elf`, the target this project already builds; `cargo openvm` installs with `cargo install` on Rust 1.91 plus a nightly with `rust-src`, with no GPU; `cargo openvm run --mode pure|meter|segment` executes on the CPU. No mock or dev prover is documented. Public values are fixed at 32 bytes in the default configuration, so the guest commits a hash. Ethproofs lists the Axiom cluster under "OpenVM 2.1 Preview", `rv64im_zicclsm`, while the released v2.1.0 documents RV32IM [P, sources 1, 21, 22].
3. **EVM proof.** The root STARK is wrapped "using halo2 with a KZG backend"; trusted setup is the universal Perpetual Powers of Tau (`challenge_0085`), with no circuit-specific ceremony. `cargo openvm setup --evm --download` fetches the Halo2 proving key and the verifier; generating them locally needs about 16 GB. GPU wrap: "Expect peak GPU memory usage to be at least 25 GB, and we recommend using a GPU with at least 32 GB"; "Currently only single GPU support is available through the CLI". Wrap time: 8.1 s on a single 5090 (2026-07-10), "sub-four-second SNARK proving" in v2.0.2 (2026-08-14). Proof data: (12 + 43) × 32 = 1,760 bytes. Gas: "316K gas" (2026-04-15, vendor). Verifier: `OpenVmHalo2Verifier` from `openvm-solidity-sdk` (`v2.1-base`), to be deployed with `forge create`; Solidity 0.8.19 only; no deployed addresses are published [P, sources 21, 22, 23, 24, 25].
4. **Security.** "OpenVM targets 100 bits of provable security" (SWIRL with WHIR over BabyBear, no proximity-gap conjectures); 100 bits in soundcalc. "OpenVM v2.0.0 completed an external audit by zkSecurity"; the RV32IM extension was "formally verified in Lean by Nethermind Research" (v1.5.0); the verifier generation was audited by Cantina (v1.5.0, January 2026). v2.1.0 fixes several advisories, among them "RV32IM transpilation can allow execution to continue past abort instructions"; an earlier advisory covered a selector clash in the Solidity wrapper, fixed in 1.7.0 and 2.0.0 [P, sources 7, 21, 22, 25; S for the CVE summary, source 31].
5. **License.** MIT or Apache-2.0; the Solidity verifier is MIT [P, sources 21, 25].
6. **Hosted proving.** The Axiom Proving API: "Get proofs for mainnet blocks in under 30 seconds", "under $0.001 per transaction"; access through a contact form; no per-cycle price is published [P, source 26].

### 4.4 Brevis Pico 3 (3.0.0 of 2026-10-19; 3.1.1 of 2026-11-05)

1. **Block time and throughput.** Smallest listed machine for Pico 3: 4x5090 (EPYC 9575F): 6.28 s average, 5.47 s median, 150.5 million cycles, 27.5 million cycles per second (6.9 million per GPU) with 3.0's 100-bit parameters; it proved 20,914 of 50,237 blocks last week. The 2x5090 prover still runs Pico 2.0.0: 29.7 s [P, sources 1, 3, 5]. Vendor, 3.1: 8.47 s at the 99th percentile on four RTX 5090, and "an earlier build of 3.1 took 13% longer than the 100-bit GPU prover" [P, source 27].
2. **Arbitrary guest.** Yes: target `riscv64im-pico-zkvm-elf`, Rust `nightly-2026-09-27`, guest toolchain from `cargo pico install`; the default build is the CPU prover "and needs no CUDA Toolkit or GPU"; `cargo pico execute` "runs the guest to its halt and reports its committed bytes and cycles". No mock prover is documented [P, source 27].
3. **EVM proof.** RISCV → CONVERT → COMBINE → COMPRESS → EMBED → WRAP, then Groth16 on BN254 through gnark (a `pico-gnark` binary or an image you build; "No prebuilt image is published"). Wrap circuit 7,243,820 R1CS constraints; "prove 23 s, 11.2 GB peak" and setup 3 min 48 s on a 124-core server; proof 12 words (384 bytes); `verifyPicoProof` "359,000–361,000" gas. **"Keys made with `cargo pico prove --evm --setup` are test keys ... A deployment needs keys from a real setup ceremony"**: no production key set or deployed verifier exists for 3.x. The GPU prover covers RISCV to COMPRESS; `single_node_mle.sh` "does not write the proof out", and outside whitelist-mode `prove` the SDK proves CONVERT and COMBINE on the CPU. The EVM path is whitelist mode only [P, source 27].
4. **Security.** 3.1 "targets 128 bits of provable round-by-round soundness ... a computed bound, not a formal verification"; Ethproofs lists Pico at 100 bits (3.0); soundcalc's Pico report is stale. "A security review of Pico 2.x by Sherlock ... predates and does not cover the 3.x proof system"; pico-gpu "has not been audited and is not recommended for production use" [P, sources 2, 7, 27, 28].
5. **License.** MIT or Apache-2.0; pico-gpu the same, with sppark-derived files under Apache-2.0 [P, sources 27, 28].
6. **Hosted proving.** Brevis ProverNet prices by auction in BREV; no price was found [S, source 32].

### 4.5 SP1 6.x (Succinct), v6.10.0 of 2026-10-23

1. **Block time and throughput.** Smallest listed machine 2x5090 with SP1 6.3.1: 28.9 s average; two recent blocks, 315.5 million cycles in 23.3 s and 513.2 million in 34.7 s: 14.2 million cycles per second, 7.1 million per GPU. It is a 1:10 on-prem prover: it proved 5,023 of 50,237 blocks, 290 of them under 10 s [P, sources 1, 3, 5]. "An average Ethereum block is about 300-500M PGUs ... Programs under 2M PGUs are considered small, where fixed proving overhead dominates latency" [P, source 34].
2. **Arbitrary guest.** Yes, and already shown by this project: RV64IM (`riscv64im-succinct-zkvm-elf`), 75 of 75 vectors reproduced in the executor with cycle counts and PGU, mock Groth16 round trip in 7.84 s; CPU proving did not fit 13.4 GiB [P, project record, 2026-10-31]. GPU: "at least 24 GB of VRAM", CUDA 12, Linux x86-64; "The SDK automatically downloads and manages a native `sp1-gpu-server` binary. Docker and the NVIDIA Container Toolkit are no longer required"; CPU 16+ cores, 16 GB+ [P, source 33].
3. **EVM proof.** Groth16 or PLONK over BN254 through gnark: about 14 GB for Groth16 and 60 GB for PLONK; 6.2 GB of Groth16 artifacts; optional `groth16-cuda` feature through Icicle. On the network, wrapping adds "fixed overhead of about 6s and 70s respectively". Groth16 uses "a circuit-specific ceremony run by Succinct with 18 contributors"; PLONK uses Aztec Ignition, a universal setup. Gateways and v6.1.0 verifiers are live on Arbitrum One and Sepolia (checked onchain by this project on 2026-10-31); 234,718 gas for Groth16 and 291,639 for PLONK in SP1's own Foundry tests [P, sources 33, 34, 35, 36; project record].
4. **Security.** Hypercube "does not rely on proximity gap conjectures"; 100 bits in soundcalc (v6.1.0, unique decoding), 98 on Ethproofs, which marks M2 "in progress" on both counts (98 bits listed; an 850 KB proof against the 600 KiB limit). "SP1 has undergone audits from Veridise, Cantina, Zellic, and KALOS and is recommended for production use" [P, sources 2, 7, 35, 37].
5. **License.** MIT or Apache-2.0 [P, source 37].
6. **Hosted proving.** Succinct Prover Network: 0.433 PROVE (0.090 USD) for a Groth16 proof of the heaviest run, of which 84% is the base fee; PROVE on Ethereum mainnet, minimum deposit 0.01 PROVE [P, project record, 2026-10-31].

### 4.6 RISC Zero R0VM 3.0.6 (the comparison)

1. **Block time and throughput.** No active prover on Ethproofs; R0VM 3.0.3 is inactive [P, source 2]. RISC Zero's datasheet for an RTX 4090 with CUDA, as extracted by a search engine (the page itself could not be opened): rv32im 1.39 MHz at 2^20 cycles (756.54 ms per segment), executor 50.52 MHz, lift 207.83 ms, join 214.82 ms, succinct 465.68 ms, identity_p254 246.43 ms, shrink_wrap 3.47 s, groth16 4.27 s with 2.22 GB [S, source 38]. A third-party page: a Ryzen 9 9950X with an RTX 5090 proves its 200-event workload in 19.53 s against 848.63 s on a 32-vCPU c6i.8xlarge, 43 times faster, with a floor of 3.84 s for the smallest proof [S, source 39]. Another: RISC Zero 3.0.6 on an RTX 4090, 16.33 s against 1,731 s on a CPU, 106 times [S, source 40]. Boundless's own guide shows 264 kHz to 431 kHz effective on 16 GB cards [P, source 41].
2. **Arbitrary guest.** In use: RV32IM, executor with cycle counts, dev mode in 0.17 s, CPU-only CI [P, project record].
3. **EVM proof.** Groth16; with the `cuda` feature `risc0-groth16` runs natively on the GPU and needs the `risc0-groth16` rzup component (`rzup install risc0-groth16`, rzup 0.5.0 or later); without it, it runs `docker run risczero/risc0-groth16-prover:v2025-04-03.1` on x86 [P, source 42]. Release notes of v3.0.1: "New much faster Groth16 implementation that run on GPU", "New much faster recursion witness generation that runs on GPU", "5090 support in Bento", an "Experimental multi-GPU default prover" (`RISC0_PROVER=actor`) [P, source 43]. Segment size against VRAM: 8 GB → 2^19, 16 GB → 2^20, 20 GB → 2^21, 40 GB → 2^22 [P, source 41]. Verifier live on Arbitrum One; 227,591 gas; 260-byte seal [P, project record]. In the measured week on Boundless, 1,370 fulfilled requests delivered 260-byte seals with the 3.0 selector; Boundless provers run RISC Zero's GPU stack, so GPU-made Groth16 seals most likely verify under the deployed verifier as the Docker-made ones do [P, project record; I for the conclusion].
4. **Security.** 96 bits for the RV32IM prover and 99 for recursion, under the "Toy Problem Conjecture" (conjectured, not provable); Groth16 over BN254 with RISC Zero's ceremony; latest audits listed: 2023-10-31 (zkVM and recursion), 2024-05-20 (STARK to SNARK), 2024-06-05 (contracts), by Hexens. The README says "98 bits of conjectured security". Not in soundcalc; Ethproofs shows no security target [P, sources 2, 44, 45].
5. **License.** Apache-2.0 for the 3.0 workspace, `risc0-groth16-sys` and the CUDA kernels included [P, source 45].
6. **Hosted proving.** Boundless: p50 0.0000184 ETH (0.042 USD) for a raw Groth16 seal, on a thin market of two provers [P, project record, 2026-11-02].
7. **Maintenance.** Releases since 3.0.0: patches only (3.0.4 in November 2025, 3.0.5 on 2026-02-03, 3.0.6 on 2026-07-17), 5.0.0-rc.1 on 2026-01-15 with no final release since, 3.1.0-rc.1 on 2026-10-30 [P, source 43]. A third-party fork merged a fix on 2026-10-12 for "a ~1% data-corruption bug seen only on RTX 5090 (sm_120, Blackwell)" in its own GPU pipeline on `release-3.0`; whether stock 3.0.6 is affected is not established [S, source 46].

## 5. One 1e8-cycle run on one RTX 5090, wrap included

All of this is inference. No GPU was used in this research. The RTX 5090 rental price is Ethproofs' index, 0.634 USD per hour (2026-11-09); trackers put marketplace prices at 0.35 to 0.70 USD per hour [S, source 47].

### 5.1 RISC Zero 3.0.6 with `cuda` (no change to the proof)

From the RTX 4090 datasheet figures [S, source 38], 2^20-cycle segments:

- segments: ⌈1e8 ÷ 1,048,576⌉ = 96
- segment proofs: 96 × 0.757 s = 72.6 s
- lift: 96 × 0.208 s = 20.0 s; join: 95 × 0.215 s = 20.4 s
- identity_p254 0.25 s; shrink_wrap 3.47 s + groth16 4.27 s = 7.74 s
- **total 121 s, about 2.0 minutes**; 87 s for 70 million cycles (67 segments); 162 s for the heaviest run (131 segments)
- GPU rental: 121 s × 0.634 ÷ 3600 = **0.021 USD**; 0.015 to 0.029 USD over the range

Cross-check from the third-party RTX 5090 page [S, source 39]: 43 times a 32-vCPU machine; if 32 vCPUs are about 8 times this project's 4 cores, the GPU is about 348 times the container: 32,400 s ÷ 348 = 93 s and 61,200 s ÷ 348 = 176 s. The two routes agree on 1.5 to 3 minutes. Against today: 32,400 ÷ 87 = 373 times, 61,200 ÷ 162 = 377 times.

Caveats: the datasheet is for an RTX 4090 on RISC Zero's `main`, not a 5090 on 3.0.6; each figure is a stand-alone benchmark; CPU preflight is extra; the first run compiles GPU kernels ("can take a few minutes, but should only happen once" [P, source 48]).

### 5.2 The leaders

| zkVM | STARK part for 1e8 cycles on one 5090 | Wrap | Total | Basis |
|---|---|---|---|---|
| Airbender v3 | 4.0 s (2.22 s + 100 × 18.2 ms), measured on a one-GPU prover | none exists | cannot produce an EVM proof | section 3.2 |
| OpenVM 2.1 | 5.2 s (1e8 ÷ 19.4 MHz, CoreMark, app layer) to 29 s (16 GPUs × 1.82 s, the cluster's GPU-seconds) | Halo2 on the GPU: under 4 s to 8.1 s | **about 10 to 40 s** | sections 3.2, 4.3 |
| SP1 6.x | 14 to 22 s (2 GPUs × 7 to 11 s) | Groth16: about 6 s on network provers; local time not found | **about 20 to 50 s** | sections 3.2, 4.5 |
| ZisK 1.4.0-alpha | about 12 s (2 GPUs × 6.0 s), pessimistic for a guest without precompiles | pilfflonk on the GPU: time not published | **12 s plus an unknown wrap** | sections 3.2, 4.2 |
| Pico 3.1.1 | about 20 s (4 GPUs × 4.27 s × 1.15 for the 128-bit parameters) | EMBED, WRAP and Groth16: 23 s on a 124-core server | **about 45 to 90 s**, with test keys only | sections 3.2, 4.4 |

GPU rental at 0.634 USD per hour: 20 s is 0.0035 USD, 35 s is 0.006 USD, 60 s is 0.011 USD. At these sizes the rental's minimum billing, the machine's boot and the key downloads (6.2 GB for SP1's Groth16, 17 GB plus 4.67 GB for ZisK) cost more than the proving.

"GPU-seconds" assumes one GPU does a cluster's work one piece after another. It overstates single-GPU time where a cluster trades efficiency for latency (OpenVM: 16 GPUs give 5.2 million cycles per second each on blocks, against 19.4 million on one GPU for CoreMark) and understates it where one card must also hold what several shared.

## 6. Hosted proving and proof markets, for about 1e8 cycles

| zkVM | Service | Price for one run | Class |
|---|---|---|---|
| RISC Zero | Boundless (ETH on Base) | 0.0000184 ETH, 0.042 USD, p50 for a raw Groth16 seal | P, project record 2026-11-02 |
| SP1 | Succinct Prover Network (PROVE on Ethereum) | 0.433 PROVE, 0.090 USD, Groth16 | P, project record 2026-10-31 |
| OpenVM | Axiom Proving API | no public price; access on request | P, source 26 |
| Pico | Brevis ProverNet | auction in BREV; no price found | S, source 32 |
| ZisK | none found | | |
| Airbender | none found | | |

A rented RTX 5090 undercuts both published markets per proof (0.02 to 0.03 USD against 0.042 and 0.090 USD) only if runs are batched: one hour, 0.634 USD, holds about 20 to 30 RISC Zero runs.

## 7. What switching from RISC Zero 3.0.6 would cost this project

Common to every switch [I, from the repository's layout and its CLAUDE.md sync table]:

- **Guest wrapper** (125 lines today): new entry macro, input reading and commitment. OpenVM and Airbender expose 32 bytes of public output, so the guest would hash the 2,304-byte public values and the contract would recompute that hash, as it computes the SHA-256 digest today.
- **Host** (830 lines): execute, execute-run, difffuzz, image id, prove, fixtures, dev-mode round trip.
- **Verifier adapter**: a new `ZkReferee` (95 lines, 336 lines of tests) against another interface and another program identity (verifying-key hash, `appExeCommit` and `appVmCommit`, `programVK`, or program id); new real-proof fixtures, which need a GPU or a paid network; a new season to bind it (README §8.4).
- **Tooling trial**: the four checks of README §7.3 again, in the CPU-only container, then cycles for the 75 game vectors and the 32 gate-set vectors.
- **Reproducible build**: the fixed-path rule exists because Cargo hashes the core's absolute path. Each zkVM needs its own check that two machines derive the same program identity; Airbender ships `cargo airbender build --reproducible`, and SP1's trial never compared two builds.
- **Docs**: README §7.3, `docs/VERIFICATION.md`, `docs/ECONOMY.md` (prover trust, emergency stop), `deployments/`.

Specific to each:

| Switch to | Extra cost or risk |
|---|---|
| SP1 6.x | Least work: the kept branch `zk-trial-sp1` already has the guest, host, executor table and mock round trip, and the verifier gateway is on Arbitrum. RV64. Real proofs need a 24 GB GPU or the network. |
| OpenVM 2.1 | New trial. The project deploys and owns the verifier: no vendor router and no emergency stop, so `docs/ECONOMY.md`'s pause path must be rebuilt. 316K gas against 227,591; 1,760 bytes of proof against 260. Solidity pinned to 0.8.19 against the project's 0.8.28: deploy the published bytecode. |
| ZisK | Alpha with audits in progress; a 64 GB host; AGPL-3.0 verifier wrapper to be reviewed against the project's license; Hardhat tests to port to Foundry; 6,752 bytes of proof; gas unknown; keys change with releases. |
| Pico 3.1 | Blocked: the project would have to run or trust a Groth16 ceremony. Keys, whitelist and verifier changed between 3.0 and 3.1 and change again on `main`. |
| Airbender v3 | Blocked until a v3 SNARK wrapper ships. |

By contrast, **moving the current proof to a GPU** changes the host's `risc0-zkvm` features to add `cuda` (keeping the CPU build for CI), and needs the CUDA toolkit, `rzup install risc0-groth16` and an NVIDIA card on the proving machine. Guest, image id (`0xa3013dc4…02b1` at the fixed build path), public values, `ZkReferee`, verifier and gas do not change, and the Docker image `risczero/risc0-groth16-prover` is no longer needed on that machine [P for the mechanism, source 42].

## 8. Ranking

1. **RISC Zero 3.0.6 on a GPU** (fit: strong). About 2 minutes and 0.02 USD per run, nothing to redeploy. Boundless at 0.042 USD remains the route with no hardware at all.
2. **SP1 6.x** (fit: possible). About 0.5 to 1 minute; verifier already on Arbitrum; trial already done; 100-bit provable STARK and four audit firms. Not worth a switch for speed alone; it is the fallback if RISC Zero's 3.0 line stops being maintained.
3. **OpenVM 2.1** (fit: possible). The fastest complete path to an EVM proof on one RTX 5090, a universal setup, 100-bit provable, audited, and the guest target the project already builds. Costs: self-deployed verifier without a vendor stop, more gas and calldata, a new trial.
4. **ZisK 1.4.0-alpha** (fit: weak). Best security figures and fast, but alpha, heavy to install, AGPL wrapper, unpublished verifier gas and wrap time.
5. **Pico 3.1** (fit: weak). Test-only Groth16 keys, unaudited GPU prover, breaking changes every release.
6. **Airbender v3** (fit: no, today). The fastest prover on a single RTX 5090 and the easiest tooling of the newcomers, with no way to verify its proof on Arbitrum.

**Is switching worth it?** No. A GPU alone takes the proof from hours to minutes, which is all the use case needs, with zero protocol change. Switching would move minutes to tens of seconds at the price of redoing the zk milestone and, for every option except SP1, of owning a verifier deployment. Revisit if the owner wants provable rather than conjectured STARK security (SP1, OpenVM), if RISC Zero 3.0.x stops receiving fixes, or once Airbender v3 ships a wrapper with a deployed verifier.

## 9. Which numbers may not transfer

- **Every Ethproofs time is a block benchmark**: a warm prover with keys loaded, a guest tuned around precompiles, a STARK as output, no EVM wrap, no cold start. The fitted fixed part (1.3 to 2.6 s) is the warm fixed cost only.
- **Cycles per second from blocks** mixes RISC-V rows with precompile work. For a guest with no precompiles it should be a floor, but that was not measured on any of the five.
- **Single-GPU figures exist only for Airbender v3** (measured) and OpenVM (vendor CoreMark). SP1, ZisK and Pico figures are scaled from 2 or 4 GPUs.
- **Small programs behave differently**: RISC Zero needs 18.5 s on an M1 for 5 thousand cycles, ZisK's CPU Quickstart 918 s for 2,374 steps, and SP1 calls anything under 2 million PGU "small, where fixed proving overhead dominates". A 1e8-cycle run is not small, so throughput dominates, but one level proved alone (14 to 31 million cycles) sits nearer the fixed costs.
- **RISC Zero's GPU figures** are for an RTX 4090, from a search engine's extract of the vendor datasheet, plus two third-party pages.

## 10. Could not verify

- `benchmarks.risczero.com` and `reports.risczero.com` did not resolve from this session; they must be allowed in the session's network settings to read the datasheet directly. Its figures here are a search engine's extract.
- No GPU was available: no proving time in section 5 is measured.
- RISC Zero 3.0.6 throughput on an RTX 5090, and whether the 5090 data-corruption issue reported in a third-party fork affects stock 3.0.6.
- Whether the `risc0-groth16` rzup component reproduces the exact seal format of the Docker prover on this project's host (expected, since Boundless provers deliver such seals; not run).
- OpenVM: the gas of `OpenVmHalo2Verifier` v2.1 beyond the vendor's "316K" of April 2026; any officially deployed verifier address; aggregation time on one GPU; whether the released v2.1.0 supports the `rv64im_zicclsm` target Ethproofs lists.
- ZisK: the gas of `ZiskVerifier`, the pilfflonk wrap time on a GPU, the VRAM it needs.
- Pico: whether Brevis has published or plans production Groth16 keys for 3.x; single-GPU time for the EVM path.
- SP1: local Groth16 wrap time and single-GPU time for a 1.2e8-PGU program; the size of its onchain proof bytes.
- Airbender v3: any date for the SNARK wrapper; audit status of v3.
- Mock or dev provers for ZisK, OpenVM and Pico: none is documented in the pages read; their absence is not proven.
- Hosted proving prices for OpenVM (Axiom), Pico (ProverNet), ZisK and Airbender.
- Ethproofs' documented API needs a key for clusters and proofs; data came from the pages' embedded payloads instead.

## 11. Sources

Access date is 2026-11-10 for all. "Source date" is the date the page or data carries.

| # | URL | Source date | Class |
|---:|---|---|---|
| 1 | https://ethproofs.org/provers (and https://ethproofs.org/clusters, which redirects to it) | live, 2026-11-10 | P |
| 2 | https://ethproofs.org/zkvms | live, 2026-11-10; metric rows updated 2025-07-10 to 2026-10-21 | P |
| 3 | https://ethproofs.org/blocks | blocks 26,384,710 to 26,384,729, 2026-11-10 13:08 to 13:12 UTC; GPU price index of 2026-11-09 | P |
| 4 | https://ethproofs.org/api.html (and probes of https://ethproofs.org/api/v0/clusters, /proofs, /blocks) | undated | P |
| 5 | https://ethproofs.org/ | live, 2026-11-10 | P |
| 6 | https://blog.ethereum.org/2025/12/18/zkevm-security-foundations | 2025-12-18 | P |
| 7 | https://raw.githubusercontent.com/ethereum/soundcalc/main/README.md ; https://raw.githubusercontent.com/ethereum/soundcalc/main/reports/summary.md ; .../reports/zisk.md ; .../reports/openvm2.md ; .../reports/sp1.md ; .../reports/pico.md ; .../reports/airbender.md | `main` on 2026-11-10 | P |
| 8 | https://ethproofs.org/csp-benchmarks | undated | P |
| 9 | https://raw.githubusercontent.com/matter-labs/airbender-platform/main/README.md ; .../docs/src/01-installation-and-hello-world.md ; .../docs/src/02-host-program-api.md ; .../docs/src/03-guest-program-api.md ; .../docs/src/05-cli-reference.md | `main` on 2026-11-10 | P |
| 10 | https://raw.githubusercontent.com/matter-labs/zksync-airbender/main/docs/tutorial.md ; .../docs/gpu.md ; .../tools/cli/README.md ; .../rust-toolchain.toml | `main` on 2026-11-10 | P |
| 11 | https://raw.githubusercontent.com/matter-labs/zksync-airbender/main/docs/end_to_end.md ; .../README.md ; .../SECURITY.md ; https://github.com/matter-labs/zksync-airbender | `main` on 2026-11-10 | P |
| 12 | https://raw.githubusercontent.com/matter-labs/zkos-wrapper/main/README.md ; .../docs/overview.md ; .../docs/end_to_end.md ; .../Cargo.toml | `main` on 2026-11-10 | P |
| 13 | https://raw.githubusercontent.com/matter-labs/ethereum-prover/main/README.md ; .../CHANGELOG.md ; .../.github/stack-revisions.env ; https://github.com/matter-labs/ethereum-prover | 0.2.0 of 2026-10-05 | P |
| 14 | https://zksync.io/airbender | undated | P (vendor claim) |
| 15 | https://raw.githubusercontent.com/0xPolygonHermez/zisk/main/README.md ; .../book/getting_started/installation.md ; .../book/getting_started/quickstart.md ; .../book/getting_started/writing_programs.md ; .../book/developer/limits.md | `main` on 2026-11-10 | P |
| 16 | https://0xpolygonhermez.github.io/zisk-docs/developer/getting-started/install-linux ; https://0xpolygonhermez.github.io/zisk-docs/ | undated | P |
| 17 | https://0xpolygonhermez.github.io/zisk-docs/developer/proving-programs/your-first-proof | undated | P |
| 18 | https://raw.githubusercontent.com/0xPolygonHermez/zisk/main/zisk-contracts/README.md ; .../zisk-contracts/blake3/ZiskVerifier.sol ; .../blake3/IZiskVerifier.sol ; .../blake3/PilfflonkVerifier.sol ; .../test/ZiskVerifier.test.js | `main` on 2026-11-10; verifier `VERSION` "v1.4.0-alpha" | P |
| 19 | https://0xpolygonhermez.github.io/zisk-docs/developer/proving-programs/choosing-a-proof-format ; .../verifying-a-proof ; .../choosing-a-prover-client | undated | P |
| 20 | https://github.com/0xPolygonHermez/zisk/releases ; https://github.com/0xPolygonHermez/zisk/releases/tag/v1.4.0-alpha | v1.4.0-alpha 2026-10-29; v1.3.2-alpha 2026-10-13 | P |
| 21 | https://raw.githubusercontent.com/openvm-org/openvm/main/README.md ; .../Cargo.toml ; .../docs/vocs/docs/pages/book/getting-started/install.mdx ; .../book/writing-apps/writing-a-program.mdx ; .../compiling-a-program.mdx ; .../running-a-program.mdx ; .../generating-proofs.mdx ; .../verifying-proofs.mdx ; .../solidity-sdk.mdx ; .../book/advanced-usage/sdk.mdx | `main` at v2.1.0, 2026-11-10 | P |
| 22 | https://raw.githubusercontent.com/openvm-org/openvm/main/docs/vocs/docs/pages/specs/security/security-model.mdx ; .../specs/security/audits.mdx ; https://github.com/openvm-org/openvm/releases | v2.1.0 2026-11-04; v2.0.2 2026-08-14; v2.0.0 2026-07-10 | P |
| 23 | https://axiom.xyz/blog/openvm-2-production | 2026-07-10 | P (vendor) |
| 24 | https://axiom.xyz/blog/openvm-2-beta | 2026-04-15 | P (vendor) |
| 25 | https://raw.githubusercontent.com/openvm-org/openvm-solidity-sdk/main/README.md ; .../foundry.toml ; .../src/v2.0-base/OpenVmHalo2Verifier.sol ; .../src/v2.1-base/OpenVmHalo2Verifier.sol | `main` on 2026-11-10 | P |
| 26 | https://www.axiom.xyz/proving-api | undated | P (vendor) |
| 27 | https://raw.githubusercontent.com/brevis-network/pico/main/README.md ; .../docs/support-matrix.md ; .../docs/requirements.md ; .../docs/release-notes/3.1.md ; .../docs/release-notes/3.0.md ; .../docs/release-notes/unreleased.md ; .../gnark/README.md ; .../contracts/README.md ; https://github.com/brevis-network/pico/releases ; https://pico-docs.brevis.network/ | v3.1.1 and v3.1.0 2026-11-05; v3.0.0 2026-10-19 | P |
| 28 | https://raw.githubusercontent.com/brevis-network/pico-gpu/main/README.md | `main` on 2026-11-10 | P |
| 29 | `docs/VERIFICATION.md` ; `referee/zk/README.md` ; `referee/zk/host/Cargo.toml` | 2026-10-31 to 2026-11-02 | P (project records) |
| 30 | Web search extract citing a Veridise assessment of Airbender (veridise.com), 2026-02-16 to 2026-04-15 | 2026 | S |
| 31 | Web search extract of CVE-2026-62334 (tenable.com, mend.io): OpenVM Solidity wrapper dispatch issue, fixed in 1.7.0 and 2.0.0-rc.3 | 2026 | S |
| 32 | Web search extract on Brevis ProverNet pricing (binance.com research pages, techflowpost.com) | 2026 | S |
| 33 | https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements | undated | P |
| 34 | https://docs.succinct.xyz/docs/sp1/prover-network/faq | undated | P |
| 35 | https://docs.succinct.xyz/docs/sp1/security/security-model | undated | P |
| 36 | https://raw.githubusercontent.com/succinctlabs/sp1/dev/crates/sdk/README.md ; .../sp1-gpu/README.md ; https://github.com/succinctlabs/sp1/releases | v6.10.0 2026-10-23 | P |
| 37 | https://raw.githubusercontent.com/succinctlabs/sp1/dev/README.md | `dev` on 2026-11-10 | P |
| 38 | Web search extracts of https://benchmarks.risczero.com/main/datasheet and https://reports.risczero.com/main/datasheet (neither host resolved from this session) | undated, `main` | S |
| 39 | https://essential-contributions.github.io/void-reference-impl/readmes/benchmarks-zk-proving-risczero.html | undated | S |
| 40 | https://forum.logos.co/t/independent-risc-zero-sp1-gpu-benchmarks-for-lez-free-for-builders/1811 | 2026-07-21 | S |
| 41 | https://docs.boundless.network/provers/quick-start ; https://docs.boundless.network/provers/performance-optimization.md | undated | P |
| 42 | https://raw.githubusercontent.com/risc0/risc0/release-3.0/risc0/groth16/src/prove/mod.rs ; .../prove/cuda.rs ; .../prove/docker.rs ; .../risc0/groth16/Cargo.toml ; .../risc0/groth16/README.md ; .../risc0/zkvm/Cargo.toml | `release-3.0` on 2026-11-10 (risc0-groth16 3.0.5) | P |
| 43 | https://github.com/risc0/risc0/releases | v3.1.0-rc.1 2026-10-30; v3.0.6 2026-07-17; v3.0.5 2026-02-03; v5.0.0-rc.1 2026-01-15; v3.0.1 2025-08-21 | P |
| 44 | https://dev.risczero.com/api/security-model | version 3.0, undated | P |
| 45 | https://raw.githubusercontent.com/risc0/risc0/release-3.0/README.md ; .../Cargo.toml ; .../LICENSE | `release-3.0` on 2026-11-10 | P |
| 46 | https://github.com/hemilabs/risc0/pull/13 | 2026-10-12 | S |
| 47 | Web search extract of RTX 5090 rental trackers (computeprices.com, gpus.io, gpuperhour.com, lium.io, flopper.io) | July to August 2026 | S |
| 48 | https://dev.risczero.com/api/generating-proofs/local-proving ; https://dev.risczero.com/api/generating-proofs/proving-options | version 3.0, undated | P |

Raw downloads and the parsed Ethproofs payloads are in `scratchpad/research/raw/`.
