# The current RISC Zero proof on a single GPU, unchanged

Research report, written 2026-11-10. Scope: keep the guest, its image id, the 260-byte Groth16 seal and the deployed RISC Zero 3.0 verifier exactly as they are, and change only the proving hardware.

Every fact is tagged **[P]** primary source (official docs, source code, release pages, price pages, registries, read by me today), **[S]** secondary source (third-party measurements or statements) or **[I]** inference (my arithmetic or reasoning from the tagged facts). Nothing was proven here: this container has no GPU, and no build, Docker run or proof was started. All sources are listed with URL and date in section 12.

## 0. Answer in brief

- **Time.** One 1e8-cycle run (96 segments of 2^20 cycles) takes about **88 s on one RTX 5090** with unmodified RISC Zero v3.0.6 built with `--features cuda` [I, from a third-party A/B measurement of upstream v3.0.6 on that card: 565.8 ms per segment, 10.70 s to a succinct receipt and 12.67 s to a Groth16 receipt for 12 segments]. On one RTX 4090 it takes about **130 to 165 s** [I]. The repository measured 12.15 h for the same run on 4 CPU cores (96 x 400 s + 96 x 54 s + 170 s), so the GPU is about **500x** (5090) or **265 to 337x** (4090) faster.
- **Groth16 wrap.** About **2 s** on the GPU (1.97 s on a 5090 with upstream v3.0.6; 2.0 s warm and 2.96 s cold on a 4090) [S], against 150 to 170 s in Docker on the CPU. With the `cuda` feature the Docker code path is not compiled at all [P].
- **Cost.** At today's marketplace prices a run costs about **0.012 to 0.029 USD on a rented 5090** and **0.012 to 0.041 USD on a rented 4090** of GPU time [I]. The Boundless price of 0.0000184 ETH is **0.0379 USD** at 2,057.19 USD per ETH [P price, I product]. Renting is therefore 0.3 to 1.1 times the Boundless price: the same order, not a large saving. Hyperscaler GPUs (L4, A10G, T4, A100) cost about as much as Boundless or more: 0.8 to 8 times.
- **Season.** 100 / 1,000 / 10,000 runs on rented 5090s at the Vast.ai median (0.83 USD/h): **2.0 / 20 / 202 USD** and 2.4 / 24.3 / 243 GPU-hours. Boundless: 3.79 / 37.85 / 378.52 USD. CPU (4 vCPU, 0.2016 USD/h): 245 / 2,450 / 24,502 USD and 50.6 / 506 / 5,064 machine-days.
- **Repository change.** One Cargo feature (`risc0-zkvm/cuda`), a lockfile update, a CUDA toolkit on the build machine, and the `risc0-groth16` rzup component (2.34 GB) in place of the Docker image. `prove.rs` needs no code change. The image id and the seal do not depend on the prover hardware [P source code].
- **Mac.** RISC Zero 3.0.x has **no Metal acceleration for the RV32IM circuit**: the Metal branch has been commented out since 2.0 and returns only on the unreleased 5.0 line [P source code]. An Apple Silicon Mac proves on the CPU (about 3.4 kHz on an M1 [P ethproofs]), so a run takes many hours. The Groth16 step has no native Mac route; the Docker image has had a linux/arm64 variant since 2025-04-03 [P Docker Hub], but RISC Zero's documentation still calls Apple Silicon unsupported, and I could not test it.
- **Not confirmed.** RISC Zero publishes no per-GPU throughput for 3.x (its benchmark site no longer resolves; the only datasheet served is from April 2023). Every throughput figure below is third-party or inferred, and none was measured on this project's guest.

## 1. Versions and release lines

| Fact | Tag | Source, date |
|---|---|---|
| `risc0-zkvm` 3.0.6, published 2026-07-17, is the newest stable release. `max_stable_version` is 3.0.6. | P | crates.io API, read 2026-11-10 |
| GitHub marks v3.0.6 "Latest". Its only note is a fix for the Rust 1.97.0 guest build. | P | github.com/risc0/risc0/releases, read 2026-11-10 |
| Newer lines exist only as pre-releases: **3.1.0-rc.1** (2026-10-30, branch `release-3.1`) and **5.0.0-rc.1** (2026-01-14, branch `release-5.0`; `main` is at workspace version 5.0.0, commit `164c64bb`, 2026-10-26). | P | crates.io API; GitHub releases; raw `Cargo.toml` on `main` |
| 3.1.0-rc.1's notes: lockstep bump of `cargo-risczero`, `risc0-r0vm`, `risc0-zkvm`; "All non-lockstep bumps are patches: `cargo-semver-checks` finds no API additions and no breaking changes." | P | release page v3.1.0-rc.1 |
| `risc0/circuit/recursion/src/control_id.rs`, `risc0/groth16/src/verifier.rs` and `risc0/zkvm/src/receipt/groth16.rs` are byte-identical between tag `v3.0.6` and branch `release-3.1`, and differ on `release-5.0`. | P | raw files, sha256 compared 2026-11-10 |
| So 3.1 keeps the 3.0 control ids and Groth16 key (same verifier, selector `0x73c457ba`), and 5.0 does not (a new verifier contract would be needed). | I | from the row above |
| The project pins `risc0-zkvm` and `risc0-build` `=3.0.6`, which lock `risc0-circuit-rv32im` 4.0.5, `risc0-circuit-recursion` 4.0.5, `risc0-zkp` 3.0.5, `risc0-groth16` 3.0.5, `rzup` 0.5.2. | P | `referee/zk/Cargo.lock`, `referee/zk/host/Cargo.toml` |
| Boundless's prover stack (Bento) builds on the same line: `risc0-zkvm = "3.0.4"`, `risc0-groth16 = "3.0.3"`, `risc0-groth16-sys = "0.1.0"`. | P | boundless `Cargo.toml` and `bento/Cargo.toml`, commit `80d84dab`, 2026-11-06 |
| ethproofs lists R0VM 3.0.3 as inactive, with 11 clusters of which 0 are active; the RISC Zero team row shows 0 proofs. ethproofs therefore has no usable RISC Zero number today. | P | ethproofs.org/zkvms and /teams, read 2026-11-10 |

## 2. What the pinned code does on each hardware

I downloaded the pinned crates from crates.io and read them (commit `8c215e2f` per `.cargo_vcs_info.json`).

**Feature flags.** [P, `risc0-zkvm` 3.0.6 `Cargo.toml`]

```toml
cuda  = ["prove", "risc0-circuit-keccak/cuda", "risc0-circuit-recursion/cuda",
         "risc0-circuit-rv32im/cuda", "risc0-groth16/cuda", "risc0-zkp/cuda"]
metal = ["prove"]
```

The README's table says of `cuda`: "Enables CUDA GPU acceleration for the prover. Requires CUDA toolkit to be installed.", and of `metal`: "Deprecated - Metal GPU acceleration for the prover is now enabled by default on Apple Silicon."

**Segment prover.** [P, `risc0-circuit-rv32im` 4.0.5 `src/prove/mod.rs`]

```rust
pub fn segment_prover() -> Result<Box<dyn SegmentProver>> {
    cfg_if! {
        if #[cfg(feature = "cuda")] {
            self::hal::cuda::segment_prover()
        // } else if #[cfg(any(all(target_os = "macos", target_arch = "aarch64"), target_os = "ios"))] {
        // self::hal::metal::segment_prover(hashfn)
        } else {
            self::hal::cpu::segment_prover()
        }
    }
}
```

- The hardware is chosen at compile time. With `cuda` the segment prover is CUDA; otherwise it is the CPU, on every platform.
- `src/prove/hal/` holds only `cpu.rs` and `cuda.rs`, and `risc0-circuit-rv32im-sys` 4.0.3 ships only `kernels/cuda` and `kernels/cxx`: **there is no Metal implementation of the RV32IM prover in 3.0.x.**
- The same commented-out branch is in `release-2.0`, `release-2.3`, `release-3.0` and `release-3.1`. On `main` (5.0.0), `risc0/circuit/rv32im/src/prove.rs` has `ProverContext::new_metal(po2)` for macOS aarch64. [P]

**Recursion prover.** `risc0-circuit-recursion` 4.0.5 `src/prove/mod.rs` has the same shape (CUDA, else CPU), and `pub mod metal` is commented out in `src/prove/hal/mod.rs`. [P]

**Groth16 wrap.** [P, `risc0-groth16` 3.0.5 `src/prove/mod.rs`]

```rust
#[cfg(feature = "cuda")]
mod cuda;
#[cfg(not(feature = "cuda"))]
mod docker;

pub fn shrink_wrap(identity_p254_seal_bytes: &[u8]) -> Result<Seal> {
    cfg_if::cfg_if! {
        if #[cfg(feature = "cuda")] { self::cuda::shrink_wrap(identity_p254_seal_bytes) }
        else { self::docker::shrink_wrap(identity_p254_seal_bytes) }
    }
}
```

- Without `cuda`: `docker run --rm -v <work>:/mnt risczero/risc0-groth16-prover:v2025-04-03.1`. The comments say "Requires running Docker on an x86 architecture" and "Proving with Groth16 is currently only supported using Docker". There is no runtime architecture check, only these comments.
- With `cuda`: no Docker. `cuda.rs` looks up the rzup component `risc0-groth16` version 0.1.0 and fails with "Missing required `risc0-groth16` rzup component. To install it, ensure that your `rzup` version is >= 0.5.0, and then run `rzup install risc0-groth16`." It computes the witness on the CPU with `circom-witnesscalc` and proves on the GPU through `risc0-groth16-sys` (sppark and blst), reading `stark_verify_final.zkey`, `preprocessed_coeffs.bin`, `fuzzed_msm_results.bin` and `stark_verify_graph.bin` from the component.
- `risc0-groth16-sys` 0.1.0's `build.rs` compiles the CUDA kernel with `-D__ADX__` and links blst. ADX is an x86-64 extension, so the GPU Groth16 route is in practice x86-64 Linux with an NVIDIA card [I]. An ARM host with an NVIDIA GPU (AWS g5g) is unverified.

**Defaults.** `DEFAULT_SEGMENT_LIMIT_PO2 = 20` (`risc0-circuit-rv32im` 4.0.5). `DEFAULT_MAX_PO2 = 22`: "Maximum segment size, as a power of two (po2) that the default verifier parameters will accept." (`risc0-zkvm` 3.0.6 `src/receipt.rs`). So segments of 2^19 to 2^22 all verify under the deployed verifier. [P]

**Build.** `risc0-build-kernel` 2.0.1 compiles CUDA kernels with nvcc and passes `-arch=native` unless `NVCC_PREPEND_FLAGS` or `NVCC_APPEND_FLAGS` is set; cudart is linked statically by default (`RISC0_CUDART_LINKAGE`). A binary built with the default flags targets the build machine's GPU generation only. [P]

## 3. Published throughput

### 3.1 RISC Zero's own pages

| Fact | Tag | Source, date |
|---|---|---|
| The local-proving page (3.0) gives no throughput, VRAM or RAM figure. It says: "Running on NVIDIA GPUS requires the CUDA runtime, and building the GPU kernels requires the NVIDIA toolkit"; "In cases where memory is constrained (i.e. less than 10 GB is available), it may be necessary to change the segment size limit"; "When run for the first time, the GPU (e.g. Metal or CUDA) kernels may need to be JIT compiled. This can take a few minutes". | P | dev.risczero.com/api/generating-proofs/local-proving, read 2026-11-10 |
| Its Ubuntu recipe: `ubuntu-drivers install`, `apt install build-essential libssl-dev`, `apt install cuda-toolkit`, then `RUSTFLAGS="-C target-cpu=native" cargo run -F cuda -r --example datasheet`, with the note "Building the GPU kernels may take a long time." | P | same page |
| The benchmarks page (3.0) only explains how to generate a datasheet (`cargo run --release -F cuda --example datasheet`). The example measures execute, RV32IM at each po2, lift, join, succinct, identity_p254 and groth16. | P | dev.risczero.com/api/zkvm/benchmarks; `risc0/zkvm/examples/datasheet.rs` at v3.0.6 |
| The only datasheet still served is dated "April 2023 -- as of commit cd1a37e" (zkVM 0.x): RTX 3090 Ti 91.7 kHz, RTX A5000 81.8 kHz, Metal on M1 58.4 kHz and on M2 91.2 kHz at 1024k cycles. It predates the current circuit and does not apply to 3.x. | P | dev.risczero.com/datasheet.pdf, read 2026-11-10 |
| `benchmarks.risczero.com` and `reports.risczero.com` no longer resolve, and the data repository their web app read (`raw.githubusercontent.com/risc0/ghpages/...`) returns 404. That app listed RTX 4090, RTX 3090 Ti, g6.xlarge and Apple M2 Pro datasheets. | P | fetch attempts 2026-11-10; web app source at v3.0.6 |
| `risczero.com/blog` returns 404, so the R0VM 2.0 announcement could not be read. | P | fetch attempt 2026-11-10 |
| The changelog on `main` stops at v1.2.1. Its v1.1.3 entry (2024-11-08) says the `poly_divide` kernel "achieves proving speeds of 1.5 MHz on a 4090 GPU for proving rv32im programs" (the 1.x circuit). | P | CHANGELOG.md on main |

**Conclusion: RISC Zero publishes no per-GPU throughput for 3.x today.** Could not find one.

### 3.2 Boundless (Bento) hardware requirements and operator guides

| Fact | Tag | Source, date |
|---|---|---|
| Recommended minimum for a prover: 16 CPU threads above 3 GHz, 32 GB RAM, 200 GB NVMe, "at least one NVIDIA GPU with >= 8GB of VRAM", Ubuntu 24.04. "In testing, we've found the best performance on the following NVIDIA GPUs: 4090, and L4." "we recommend at least 10 GPUs to run a competitive prover". | P | docs.boundless.network/provers/quick-start, read 2026-11-10 |
| VRAM rule of thumb: "1 million cycles requires 9~10GB of GPU VRAM", 2 million 17~18 GB, 4 million 32~34 GB. | P | docs.boundless.network/provers/bento |
| Maximum `SEGMENT_SIZE` by VRAM: 8 GB 19, 16 GB 20, 20 GB 21, 40 GB 22. Bento's compose default is 21. | P | docs.boundless.network/provers/performance-optimization and /quick-start |
| The CLI wizard is one step more conservative: up to 8 GB 18, up to 16 GB 19, up to 20 GB 20, above 20 GB 21. | P | boundless `crates/boundless-cli/src/commands/prover/generate_config.rs`, commit `80d84dab` |
| The docs' worked examples are from October 2024 on `risc0-zkp` 1.1.1: about 400 kHz effective on one system, 264 kHz for one 16 GB GPU, 431 kHz for two. They predate the 2.0/3.0 circuit. | P | performance-optimization page |
| The GPU agent image is built on `nvidia/cuda:13.0.2-devel-ubuntu24.04` with `cargo build ... -F cuda`, runs `rzup install risc0-groth16`, and sets `NVCC_APPEND_FLAGS` to generate code for `sm_75`, `sm_86`, `sm_89` and `sm_120`. | P | boundless `dockerfiles/agent.dockerfile` |
| Bento's SNARK task calls `agent.prover.compress(&ProverOpts::groth16(), &receipt)` in a crate whose `cuda` feature is `risc0-zkvm/cuda`: the same call as this project's `prove.rs`. | P | boundless `bento/crates/workflow/src/tasks/snark.rs` and `Cargo.toml` |
| "The following tutorial will not work on standard dockerized cloud providers such as Vast.ai as the proving stack relies on Docker." This is about Bento's Docker Compose stack, not about a single binary built with `cuda`. | P quote, I reading | quick-start page |

### 3.3 Independent measurements

**A. Upstream v3.0.6 on an RTX 5090** [S: hemilabs/risc0 pull request 21, description dated 2026-10-16, merged 2026-10-17; the merge commit title is in the fork's git history, the table is in the PR description]. Upstream was "unmodified, built with `--features cuda` on the same RTX 5090 and run alternately with this branch, same workload, medians". The workload is the `SimpleLoop` benchmark guest with 2,900,000 iterations, which is 12 segments at po2 20 [I: PR 20's table gives 4.04 s composite at 325 ms per segment, and 2.17 s at 182 ms].

| Workload | Upstream v3.0.6 | The fork |
|---|---:|---:|
| Composite, po2 20 | 565.8 ms per segment | 113.8 ms |
| Composite, po2 21 | 1,119 ms per segment | 246 ms |
| Succinct, whole proof, po2 20 / 21 | 10.70 s / 8.20 s | 1.80 s / 1.64 s |
| Groth16, whole proof, po2 20 / 21 | 12.67 s / 10.90 s | 2.18 s / 2.00 s |

Derived for upstream v3.0.6 on a 5090 [I]:
- segment proving: 2^20 / 0.5658 s = **1.85 MHz**;
- recursion and execution: (10.70 - 12 x 0.5658) / 12 = **0.326 s per segment**;
- to a succinct receipt: 12 x 2^20 / 10.70 s = **1.18 MHz** at po2 20, and 6 x 2^21 / 8.20 s = 1.53 MHz at po2 21;
- identity_p254 and Groth16 wrap: 12.67 - 10.70 = **1.97 s**.

**B. Upstream 3.0.5 and 3.0.6 on an RTX 4090** [S: NthMOMENT/ghostprover-benchmarks and kaspa-pq-bench-results, 2026-07-16 and 2026-07-21; raw logs in the repositories]. CUDA 12.8, `--features cuda`, a RunPod instance. No cycle counts are given.

| Program | Composite | Succinct compress | Total |
|---|---:|---:|---:|
| SLH-DSA-128s verification, 3.0.6, 5 runs | 11.15 to 11.92 s | 4.48 to 4.99 s | 16.33 s mean |
| ML-DSA-44 verification, 3.0.6 | 3.87 to 4.00 s | 1.36 to 1.46 s | 5.35 s mean |
| Falcon-512 verification, 3.0.6 | 1.30 to 1.37 s | 0.56 to 0.63 s | 1.91 s mean |

The same SLH-DSA proof took 1,731.67 s on a "CPU (cloud baseline)": 106 times slower. Recursion costs 35 to 45% of the composite time on this card.

**C. A fork of release-3.0 on an RTX 4090 and an RTX 5080** [S: hemilabs/zk-miner at `cde78152`, 2026-11-09, source comments with measurement dates]. Its worker makes the same three calls as `prove.rs` (composite, compress to succinct, compress to Groth16).
- RTX 4090, 2026-10-06: "1.3-1.4M [cycles/s] for every real program", where the rate covers execution, segment proofs and recursion. A 62M-cycle Groth16 proof "took 44.0 / 57.6 / 87.2 s at po2 20 / 19 / 18".
- Groth16 wrap on the 4090, 2026-10-06: "2.96 s for the first, then 2.02 / 2.00 / 2.01 / 2.02 / 2.02 s"; the first is slower "mostly the first read of the 3.45 GB proving key".
- RTX 5080 (16 GB): about 1.0e6 cycles/s at 341 W, against 1.4e6 at 455 W for the 4090. A 46M-cycle Groth16 proof at po2 20 completes in about 41 s and peaks at 12,436 MiB. Wraps take 2.08 to 2.12 s.
- VRAM: "po2 20 peaks around 12.1 GiB"; the Groth16 prover's key cache stays resident at about 7.25 GB after a wrap; po2 21 and 22 do not fit on 16 GB; the fork's Groth16 proof at po2 21 peaks at 27.1 GB.
- The fork was already faster than upstream on those dates: its baseline before pull request 20 ran 325 ms per segment on the 5090, against 565.8 ms for upstream (1.74x). So **these 4090 and 5080 rates overstate upstream v3.0.6** [I].
- The fork claims "~5x over upstream v3.0.6 on RTX 5090", that "The proof format is unchanged" and that "Every kernel change is bit-exact against the previous kernel". The pull request shows "No reviews".

**D. Upstream ^3.0.3, one workload on three machines** [S: essential-contributions/void-reference-impl, commit `4829cd27`, 2025-10-01]. Each measurement proves with `ProverOpts::succinct()` and then compresses to Groth16, with `-F cuda` on the GPU machines. No cycle counts are given.

| Machine | 1 event | 1,000 events | 10,000 events |
|---|---:|---:|---:|
| Ryzen 9 9950X + RTX 5090 | 3.84 s | 74.62 s | 566.03 s |
| AWS g6.xlarge (L4, 4 vCPU, 16 GiB) | 6.23 s | 126.09 s | 942.56 s |
| AWS c6i.8xlarge (32 vCPU, CPU and Docker) | 66.61 s | 848.63 s for 200 events | not run |

- The L4 instance takes 1.67 to 1.69 times the 5090's time on whole proofs, and 1.86 times on the marginal cost per event (84.4 ms against 45.5 ms).
- A complete small Groth16 proof takes 6.23 s on a g6.xlarge, so the GPU wrap fits a 22 GiB L4 with 16 GiB of host RAM and takes a few seconds there.

**E. Other.**
- ZKsync's Airbender page claims "Proving throughput (H100)": Airbender 21.8 MHz, SP1 Turbo 3.45 MHz, Risc Zero 1.1 MHz. A competitor's undated claim, with no version or stage. [S, zksync.io/airbender, read 2026-11-10]
- Fenbushi (2025-08-29) measured RISC Zero's GPU prover on an RTX 5090 (3.6 s for the 100k-th Fibonacci, 7.3 s for 100 ETH transfers) without version or cycle counts. [S]
- An ethresear.ch study (2026-01-27) ran risc0-v3.0.4 on 4 RTX 4090s with `RISC0_KECCAK_PO2=15` "to prevent provers from crashing"; it gives no throughput. This project's guest uses a software keccak, so that flag does not concern it. [S]

### 3.4 Working estimates for upstream v3.0.6, per card

One run is 1e8 cycles: 96 segments at po2 20. Time = 96 x (segment + recursion) + wrap.

Two assumptions carry measurement A, a busy loop, over to this project's guest [I]:
- **A segment costs the same whatever it executes.** The repository's CPU proofs support this: 396 s, 408 s and 410 s per 2^20-cycle segment for three different inputs. The guest uses no precompile, so no keccak or bigint side proofs are added.
- **The host CPU is not the bottleneck.** The in-process prover handles segments one after the other, with a CPU step (preflight) before each GPU step. The CPU of the machine behind measurement A is not stated; a rented card with few or slow cores will be slower.

| Card | VRAM | Segment po2 | One 1e8-cycle run | Basis | Tag |
|---|---:|---:|---|---|---|
| RTX 5090 | 32 GB | 20 | **87.6 s** = 96 x (0.5658 + 0.3259) + 1.97 | A | I from S |
| RTX 5090 | 32 GB | 21 | 68.3 s = 48 x (8.20 / 6) + 2.70 | A; upstream VRAM at po2 21 unverified | I from S |
| RTX 4090 | 24 GB | 20 | **130 to 165 s** | A scaled by 1.66 to 1.85 (the 5090-to-4090 ratio in C), or C's 1.35 MHz divided by 1.74; B is consistent with about 1.0 s per segment | I |
| RTX 5080, 4080 | 16 GB | 20, or 19 if memory is short | 180 to 240 s | 4090 x 1.4 (C) | I |
| RTX 3090 | 24 GB | 20 | 220 to 290 s | 4090 at 0.55 to 0.65; no RISC Zero 3.x source | I |
| L4 | 24 GB (22 GiB on AWS) | 20 | 150 to 420 s | lower bound: D's 1.67x of the 5090; upper bound: raw compute scaling | I |
| A10G | 24 GB (22 GiB) | 20 | 180 to 360 s | no source; between L4 and 3090 | I |
| T4 | 16 GB | 19 | 360 to 1,200 s | no source; a 2018 card, 2 to 3 times slower than an L4 | I |
| A100 40 GB | 40 GB | 20 or 21 | 145 to 290 s | no source; between 3090 and 4090 | I |
| Apple Silicon | unified | 20 | hours (section 3.5) | CPU only | P and I |

Other step times:
- **Recursion.** 0.33 s per segment on a 5090 (A) and about 0.44 s on a 4090 (B: 11 lifts and 10 joins in 4.5 to 5.0 s, if SLH-DSA is 11 segments) [I], against 51 to 57 s on 4 CPU cores [P, repository].
- **Smaller segments.** One step down costs about 30% more time and halves the STARK's VRAM: 44.0 s, 57.6 s, 87.2 s at po2 20, 19, 18 for the same proof (C).
- **Run sizes.** 70M to 137M cycles scale linearly: about 62 to 119 s on a 5090, and 91 to 226 s on a 4090 [I].
- **Recommended segment size.** Keep RISC Zero's default, po2 20, on cards with 16 GB or more. Use 19 on a 16 GB card if the wrap runs out of memory, 18 or 19 below that, and 21 only on 32 GB or more.
- **Host RAM.** No published figure for the single-binary GPU route. Evidence: D ran on 16 GiB with 4 vCPUs; Boundless asks for 32 GB and 16 threads for its whole stack. 16 GB is a floor and 32 GB is comfortable [I].

### 3.5 Apple Silicon

- **No Metal for the RISC-V circuit in 3.0.x** (section 2). The docs page still says "RISC Zero will use the integrated Metal compute cores"; the code does not do so for the segment prover or the recursion prover. [P]
- **CPU rate.** ethproofs' client-side proving benchmark (Apple M1, 8 cores, 16 GB; data file updated 2026-11-02) lists risc0 ECDSA at 296,161 cycles in 87.6 s with 4.97 GB peak: **3.38 kHz**. The sha256 rows (about 5 thousand cycles in 18.5 s) are fixed overhead. The RISC Zero version used is not stated. [P]
- **One run on an M1.** 1e8 / 3,380 = 29,586 s = 8.2 h of segment proving, plus recursion: roughly 9 to 13 h [I]. A recent M-series chip with 10 to 16 cores may be 2 to 4 times faster; I found no measurement.
- Metal acceleration returns on the 5.0 line, which needs a different verifier (section 1) [P, I].

## 4. Does the Groth16 wrap need Docker or x86? Can an Apple Silicon Mac produce the seal?

| Question | Answer | Tag |
|---|---|---|
| Docker with the `cuda` feature? | **No.** The Docker module is compiled only without `cuda`. The docs' shrink-wrapping page says: "The Groth16 shrink-wrapping requires the prover install a certain `rzup` component ... `rzup install risc0-groth16`". A RISC Zero contributor wrote on 2026-02-05: "On CUDA systems you can create Groth16 receipts without docker." | P |
| What replaces the image? | The rzup component `risc0-groth16` 0.1.0: target-agnostic, 2,335,797,480 bytes (uploaded 2025-08-01), sha256 `4b4f2b2f...e72e4d`, served from `risc0-artifacts.s3.us-west-2.amazonaws.com/rzup/components/risc0-groth16/`, installed in `~/.risc0/extensions/v0.1.0-risc0-groth16`. About 5 GB unpacked [S]. A 0.2.0 exists since 2026-10-22; 3.0.5 asks for 0.1.0. | P |
| Can it be installed without rzup? | rzup only looks for the directory `extensions/v0.1.0-risc0-groth16` (`paths.rs`), so a checked download unpacked there should do, as the project already does for the toolchain. A third-party tool does exactly this [S]. Not tested. | I |
| x86 with `cuda`? | In practice yes: x86-64 Linux with an NVIDIA GPU. The kernel is compiled with `-D__ADX__`, and rzup's installer covers "x86-64 Linux and arm64 macOS". | P and I |
| Without `cuda`? | Docker with `risczero/risc0-groth16-prover:v2025-04-03.1`. **That tag is a multi-arch image: linux/amd64 (2,399,158,367 bytes) and linux/arm64 (2,401,600,243 bytes)**, both pushed 2025-04-03. The same contributor wrote on 2026-02-05: "we have removed the x86 requirement from the docker image." The repository's README says "on x86 only"; the registry disagrees. | P |
| Apple Silicon, native? | **No.** Metal has no Groth16 prover (`risc0-groth16-sys` has `metal = []` and only CUDA kernels), on every branch including `main`. | P |
| Apple Silicon, through Docker? | Probably, with the arm64 image and a Docker VM with 8 GB or more (the container peaked at 7.0 to 7.2 GiB in the repository's x86 measurements). RISC Zero's 3.0 docs still say "Apple Silicon is currently unsupported (even via Docker)", a callout from June 2024 that predates the arm64 image. Issues 1520 and 1749 are still open. **Not tested by anyone I could find.** | I |

## 5. What would change in the repository

Read: `referee/zk/host/Cargo.toml`, `referee/zk/host/src/prove.rs`, `referee/zk/host/src/lib.rs`, `referee/zk/README.md`, `referee/zk/Cargo.lock`, `.github/workflows/zk-prove.yml`, `scripts/bootstrap.sh`, `docs/VERIFICATION.md`.

1. **`referee/zk/host/Cargo.toml`: one opt-in feature.**
   ```toml
   [features]
   cuda = ["risc0-zkvm/cuda"]
   ```
   Build with `cargo build --release --locked --manifest-path referee/zk/Cargo.toml -p zk-host --features cuda`. An opt-in feature keeps the CPU build, CI and `zk-prove.yml` as they are: GitHub's runners have no GPU and no nvcc.
2. **`referee/zk/Cargo.lock` grows.** It holds none of the CUDA-only crates today. The feature adds `cust` 0.3.2 and `cust_raw` 0.11.3, `sppark` 0.1.12, `blst` 0.3.15, `risc0-groth16-sys` 0.1.0, `circom-witnesscalc` 0.2.1, `wtns-file` 0.1.5 and their dependencies. The guest has its own workspace and lockfile, which do not change.
3. **`host/src/prove.rs`: no code change.** `default_prover()` still returns the in-process prover; the three calls (`prove_with_opts` composite, `compress` succinct, `compress` groth16) pick CUDA at compile time. Only the module comment and the README's "on the CPU" and "(Docker)" wording become conditional. `--segment-po2` already exists. `peak_rss()` still reports host memory; VRAM would have to come from `nvidia-smi`.
4. **Build machine.** x86-64 Linux, NVIDIA driver, CUDA toolkit with nvcc, g++, the RISC Zero Rust toolchain as today. Boundless builds on CUDA 13.0.2; the 4090 measurements above used CUDA 12.8. The kernels compile slowly: the repository's CPU-only host already takes about an hour on 2 to 4 vCPUs, and a third party reports 1,094 s at `-j8` for a CUDA build [S]. Build on the GPU machine, or set `NVCC_APPEND_FLAGS` as Boundless does to cover several GPU generations.
5. **Groth16 component instead of Docker.** `rzup install risc0-groth16` (rzup 0.5.0 or newer), or the direct download of section 4, since `bootstrap.sh` avoids rzup. `peak-memory.sh`'s Docker sampling and the workflow's "Groth16 prover image" step do not apply to a GPU build.
6. **Reproducible image id.** Unchanged rule: build at the fixed path (bind mount), then compare `zk-host image-id` with the pinned id. The docs' example sets `RUSTFLAGS="-C target-cpu=native"` for the host; check the image id after any flag change.
7. **Documentation.** `referee/zk/README.md` and `docs/VERIFICATION.md` would gain the GPU measurements, and the README's "on x86 only" for the Docker image should be rechecked against Docker Hub (section 4).

## 6. The image id and the seal do not depend on the hardware

- **Image id.** RISC Zero's terminology: "Image ID: A small cryptographic identifier that indicates the method or boot image for zkVM execution." It is computed from the guest ELF by `risc0-build` in the host's build script. `cuda` is a feature of the host's prover crates; the guest is a separate workspace built for `riscv32im-risc0-zkvm-elf` with `default-features = false, features = ["std"]`. [P]
- **Seal and selector.** `succinct_to_groth16` in `risc0-zkvm` 3.0.6 is the same code for both routes:
  ```rust
  let seal = shrink_wrap(&seal_bytes)?.to_vec();
  Ok(Groth16Receipt { seal, claim: receipt.claim.clone(),
      verifier_parameters: Groth16ReceiptVerifierParameters::default().digest() })
  ```
  Both `shrink_wrap` implementations return the same `Seal` type parsed from the same `ProofJson`. The verifier parameters are the control root, `BN254_IDENTITY_CONTROL_ID` and `risc0_groth16::verifying_key()`: constants of the release, not of the hardware. The selector is the first four bytes of their digest, so it stays `0x73c457ba`. [P]
- **Segment size.** Any po2 up to `DEFAULT_MAX_PO2 = 22` verifies under the default verifier parameters [P]. The repository already proved at po2 19 and 20 under one image id.
- **Production evidence.** Boundless provers run this very path (section 3.2), and the repository's own reading of the Boundless indexer on 2026-11-02 found 1,370 fulfilled requests in a week delivering 260-byte seals with selector `73c457ba`. [P code, P repository]
- **No single documentation sentence** states "the receipt is independent of the prover hardware". The confirmation is the definitions above plus the source. `prove.rs` already calls `groth16.verify(VERIFY_ID)` after proving, which settles it on the first GPU run.

## 7. Rental prices, read 2026-11-10

**Marketplaces.**

| GPU | Vast.ai, verified on-demand single-GPU offers: count, min, p25, median (USD/h) | Vast.ai interruptible, median minimum bid | RunPod community / secure (USD/h) |
|---|---|---:|---|
| RTX 5090, 32 GB | 43 offers: 0.476, 0.603, **0.830** | 0.533 | **0.69** / 1.19 |
| RTX 4090, 24 GB | 47 offers: 0.343, 0.469, **0.536** | 0.387 | **0.34** / 0.89 |
| RTX 3090, 24 GB | 33 offers: 0.116, 0.202, 0.230 | 0.187 | 0.22 / 0.50 |
| RTX 5080, 16 GB | 17 offers: 0.221, 0.285, 0.322 | 0.200 | not listed |
| RTX 4080 / 4080S, 16 GB | 8 and 11 offers: medians 0.240 and 0.256 | 0.213 / 0.160 | not listed |
| RTX 4060 Ti, 16 GB | 21 offers: 0.109, 0.131, 0.164 | 0.135 | not listed |
| L4, 24 GB | 4 offers: 0.252, 0.307, 0.708 | 0.513 | 0.44 / 0.59 |
| A100 | PCIe: 5 offers, 0.403, 0.507, 0.808. SXM4 80 GB: 7 offers, median 1.123 | 0.189 / 0.460 | 80 GB PCIe 1.19 / 1.79 |
| T4, A10 | no offers | | not listed |

- Vast.ai: public offers endpoint, read at 13:29 UTC. [P]
- RunPod: pricing page, "Updated November 4, 2026", per-second billing. [P]
- A RunPod pod is a container. A binary built with `cuda` needs no Docker inside it, and measurement B ran upstream 3.0.5 with `--features cuda` on a RunPod instance.
- Ethproofs' own "5090 Price Index" post (December 2025) gave a typical range of 0.37 to 0.47 USD/h for a 5090. Today's medians are higher. [S]
- Lambda: A10 24 GB 1.29, A100 40 GB 1.99, Quadro RTX 6000 0.69 USD per GPU-hour; "These prices take effect November 16, 2026". [P]

**Hyperscalers, on demand.**

| Instance | GPU | vCPU, RAM | USD/h | Source |
|---|---|---|---:|---|
| AWS g4dn.xlarge | 1 x T4, 16 GiB | 4, 16 GiB | 0.526 | AWS price file published 2026-11-07, US East (N. Virginia), Linux |
| AWS g5.xlarge | 1 x A10G, 22 GiB | 4, 16 GiB | 1.006 | same |
| AWS g6.xlarge | 1 x L4, 22 GiB | 4, 16 GiB | 0.8048 | same |
| AWS g6.2xlarge | 1 x L4, 22 GiB | 8, 32 GiB | 0.9776 | same |
| AWS p4d.24xlarge | 8 x A100 40 GiB | 96, 1,152 GiB | 21.957642 (2.745 per GPU) | same; AWS has no single-A100 instance |
| GCP g2-standard-4 | 1 x L4 | 4, 16 GiB | 0.706832276 | Google Cloud pricing page, default region |
| GCP a2-highgpu-1g | 1 x A100 40 GB | 12, 85 GiB | 3.673385 | same |
| GCP T4 | GPU only, added to an N1 VM | | 0.35 | Google Cloud GPU pricing page |
| AWS m7i.xlarge (CPU reference) | none | 4, 16 GiB | 0.2016 | AWS price file |

GPU models and memory per AWS instance are from AWS's instance-type specifications. [P]

**ETH.** 2,057.185 USD (Coinbase spot, 2026-11-10 13:33 UTC) [P]. The Boundless p50 of 0.0000184 ETH is 0.03785 USD; the 0.00005 ETH run fee is 0.1029 USD [I]. The Boundless price itself is the repository's 2026-11-02 measurement, not re-read today.

## 8. Time and cost

### 8.1 One run of 1e8 cycles

GPU time only, with upstream v3.0.6. Cost = seconds / 3,600 x hourly price.

| Hardware | Time | USD per run | Times the Boundless price (0.0379 USD) |
|---|---:|---:|---:|
| RTX 5090, Vast.ai median 0.83 | 87.6 s | 0.0202 | 0.53 |
| RTX 5090, Vast.ai cheapest 0.476 | 87.6 s | 0.0116 | 0.31 |
| RTX 5090, RunPod community 0.69 / secure 1.19 | 87.6 s | 0.0168 / 0.0289 | 0.44 / 0.76 |
| RTX 4090, Vast.ai median 0.536 | 130 to 165 s | 0.0194 to 0.0246 | 0.51 to 0.65 |
| RTX 4090, RunPod community 0.34 / secure 0.89 | 130 to 165 s | 0.0123 to 0.0156 / 0.0321 to 0.0408 | 0.32 to 0.41 / 0.85 to 1.08 |
| RTX 3090, Vast.ai median 0.23 | 220 to 290 s | 0.014 to 0.019 | 0.37 to 0.49 |
| L4, AWS g6.xlarge 0.8048 | 150 to 420 s | 0.034 to 0.094 | 0.89 to 2.5 |
| L4, GCP g2-standard-4 0.7068 | 150 to 420 s | 0.029 to 0.082 | 0.78 to 2.2 |
| A10G, AWS g5.xlarge 1.006 | 180 to 360 s | 0.050 to 0.101 | 1.3 to 2.7 |
| T4, AWS g4dn.xlarge 0.526 | 360 to 1,200 s | 0.053 to 0.175 | 1.4 to 4.6 |
| A100 40 GB, GCP a2-highgpu-1g 3.673 | 145 to 290 s | 0.148 to 0.296 | 3.9 to 7.8 |
| A100, Vast.ai median 0.808 | 145 to 290 s | 0.033 to 0.065 | 0.86 to 1.7 |
| 4 vCPU, measured in the repository; AWS m7i.xlarge 0.2016 | 43,754 s = 12.15 h | 2.45 | 65 |
| Boundless, p50 for a raw Groth16 seal | market latency | 0.0379 (0.0000184 ETH) | 1 |

- **A single on-demand rental costs more than its proof.** With about 10 minutes of start-up (boot, a container image holding the binary and the 2.3 GB component, first-run kernel compilation), one run on a 5090 at 0.83 USD/h costs (600 + 88) / 3,600 x 0.83 = 0.16 USD: more than Boundless (0.038) and more than the run fee (0.103). Renting pays only in batches, which fits "only each player's best run of a season is verified".
- **Consistency check.** Boundless's p50 is for requests of 176 to 196 million cycles. At upstream speed on a 5090 that is about 165 s, or 0.038 USD at 0.83 USD/h: the market price equals the rental cost of the GPU time. This supports the 1.18 MHz estimate and explains why renting saves little. [I]
- **Owned hardware.** A 4090 drawing 455 W [S] for 150 s uses 0.019 kWh: about 0.003 USD at an assumed 0.15 USD/kWh [I].

### 8.2 One season

| Runs | One RTX 5090, upstream, 0.83 USD/h | One RTX 4090, upstream, 0.536 USD/h | Boundless | 4 vCPU, 0.2016 USD/h |
|---:|---|---|---|---|
| 100 | 2.4 h, 2.02 USD | 3.6 to 4.6 h, 1.94 to 2.46 USD | 0.00184 ETH = 3.79 USD | 1,215 h (50.6 days), 245 USD |
| 1,000 | 24.3 h, 20.2 USD | 36 to 46 h, 19.4 to 24.6 USD | 0.0184 ETH = 37.85 USD | 12,154 h (506 days), 2,450 USD |
| 10,000 | 243 h (10.1 days), 202 USD | 361 to 458 h (15 to 19 days), 194 to 246 USD | 0.184 ETH = 378.52 USD | 121,539 h, 24,502 USD |

- GPU-hours divide across cards: 10,000 runs take about one day on ten 5090s for the same 202 USD.
- Add the start-up of each rental session (about 0.15 USD each).
- Verification gas (227,591 per proof) and settlement are the same on every row.

### 8.3 The faster fork, for reference

The hemilabs fork (section 3.3 A and C) reports 1.80 s to a succinct receipt for 12 segments on a 5090, which is 6.99 MHz, and 2.18 s with the wrap. One 1e8-cycle run would take 96 x 0.15 + 0.38 = **14.8 s**, or 0.0034 USD at 0.83 USD/h: 0.34 / 3.4 / 34 USD for 100 / 1,000 / 10,000 runs [I from S].

- It changes only the prover. A wrong prover cannot make a false proof verify, since the onchain verifier and `groth16.verify(VERIFY_ID)` check the seal; the risks are failed proofs and running unreviewed third-party code on the proving machine.
- It is not upstream, the pull request has no review, and I did not verify that its receipts verify under the deployed verifier.

## 9. A player proving their own run

**Gaming PC.**

| Need | Detail | Tag |
|---|---|---|
| GPU vendor | NVIDIA only. Upstream has CUDA, and Metal only on 5.0. AMD and Intel cards are not supported upstream; the third-party fork adds them. | P |
| VRAM | 16 GB or more for the default po2 20: the STARK peaks near 12.1 to 12.4 GiB and the Groth16 prover holds about 7.25 GB, one after the other. 24 GB or more is comfortable. 12 GB at po2 19 is unverified. On 8 GB the STARK may fit at po2 18 or 19, but the GPU wrap probably does not. | S and I |
| How many players have that | Steam survey, October 2026: 8 GB 26.92%, 12 GB 12.91%, 16 GB 26.35%, 24 GB 5.40%. So about 32% have 16 GB or more, of any vendor. Windows 93.70%, Linux 3.95%, macOS 2.35%. | P |
| Operating system | RISC Zero's installer covers "x86-64 Linux and arm64 macOS"; Windows is not mentioned. A Windows player would need WSL2 with NVIDIA's CUDA support; I found no official statement and no test. | P and I |
| Download | A prebuilt `zk-host` with `cuda`, compiled for several GPU generations (not the default `-arch=native`), with the guest ELF embedded so the image id is the pinned one; the NVIDIA driver and CUDA runtime; the 2.34 GB Groth16 component (about 5 GB on disk). No Docker, no Rust, no toolchain. | I |
| Time, one 1e8-cycle run | RTX 5090 about 1.5 min; RTX 4090 about 2.2 to 2.8 min; 16 GB cards of the 4080 or 5080 class about 3 to 4 min; RTX 4060 Ti 16 GB class perhaps 8 to 15 min. Add the first-run kernel compilation ("a few minutes", once). | I |
| Trust | The player's prover is untrusted by design: the contract checks the seal against the pinned image id. | I |

**Recent Mac.**

- Proving runs on the CPU in 3.0.x: about 9 to 13 h on an M1 for 1e8 cycles (section 3.5), a few hours at best on a larger chip (no source).
- The Groth16 step needs Docker Desktop and the 2.4 GB arm64 image, in a VM with 8 GB or more: unverified, and documented by RISC Zero as unsupported.
- So a Mac cannot prove a run in minutes with the unchanged proof. A Mac player would use Boundless (0.0000184 ETH per proof) or the operator's prover.

## 10. Recipe

1. **Machine.** x86-64 Linux, one NVIDIA card with 24 GB or more (RTX 4090 or 5090; an L4 on a hyperscaler works at a higher price), 32 GB of RAM, NVIDIA driver and CUDA toolkit (12.8 or newer; 13.0 is what Boundless builds on), g++, Rust, the RISC Zero toolchain `r0.1.97.0` as today.
2. **Measure before changing anything.** On that machine, in a checkout of risc0 at `v3.0.6`: `cargo run -F cuda -r --example datasheet`. It prints RV32IM throughput per po2 and the lift, join, succinct, identity_p254 and groth16 times: the official numbers that RISC Zero no longer publishes.
3. **Component.** `rzup install risc0-groth16`, or the checked direct download into `~/.risc0/extensions/v0.1.0-risc0-groth16`.
4. **Repository.** Add the opt-in `cuda` feature and update `Cargo.lock` (section 5). Build at the fixed path with `--features cuda`. Check `zk-host image-id` against `cast call <ZkReferee> 'imageId()(bytes32)'`.
5. **Prove.** `zk-host prove --run <run file> --season <season file>` with the default po2 20; `--segment-po2 19` if a 16 GB card runs out of memory; 21 only on 32 GB after checking VRAM. The host already verifies the receipt and prints the selector: expect `0x73c457ba` and `verified: yes`.
6. **Settle** as today: same seal, same public values, same contracts.
7. **Seasons.** Prove each season's best runs in one batch after the season ends, on N rented cards, from a container image that holds the binary and the component.

**Remaining dependencies.**
- NVIDIA's proprietary driver and CUDA toolkit, on x86-64 Linux.
- RISC Zero 3.0.6 crates with their C++ and CUDA kernels (a long build), plus `sppark`, `blst`, `cust`, `circom-witnesscalc`.
- The `risc0-groth16` component (2.34 GB) from RISC Zero's artifact store: the same Groth16 key as before, in another package.
- The RISC Zero Rust toolchain for the guest and the fixed build path, as today.
- RISC Zero's 3.0 Groth16 verifier and emergency stop on Arbitrum, as today.
- A GPU: owned, or rented from a marketplace per season.
- No Docker, and no prover market.

**What this recipe does not give.** It is not lighter in dependencies than today's CPU route: it trades Docker for CUDA. It does not remove RISC Zero's trusted Groth16 setup or its verifier contract. It makes proving practical: minutes and about two cents per run, instead of half a day.

## 11. What could not be confirmed

1. **No measurement here.** No GPU in this container. Every GPU figure is third-party or derived, and none is for this project's guest.
2. **No official RISC Zero throughput for 3.x.** `benchmarks.risczero.com` and `reports.risczero.com` do not resolve, `risc0/ghpages` returns 404, `risczero.com/blog` returns 404, the served datasheet is from April 2023, and web.archive.org could not be fetched from here.
3. **RTX 4090 with upstream v3.0.6.** 130 to 165 s is an inference from a 5090 measurement, a 5090-to-4090 ratio taken from a fork, and logs without cycle counts.
4. **L4, A10G, T4, A100, RTX 3090.** No RISC Zero 3.x throughput found. The L4 range rests on one third-party workload of unknown cycle count; the T4, A10G, A100 and 3090 ranges are scaling guesses.
5. **T4 (sm_75) with upstream 3.0.6.** Boundless generates sm_75 code, but a fork reports a ptxas failure for sm_75 in its own sppark fork. Not tested.
6. **VRAM limits with upstream.** Whether the in-process sequence (STARK, then wrap) fits 16 GB at po2 20, and whether 12 GB or 8 GB cards can do the GPU wrap at all. The published peaks are from a fork with its own buffer pool.
7. **The segment count of measurement A** (12) is derived from the fork's own tables, not stated by it.
8. **Windows and WSL2.** No official statement found.
9. **Apple Silicon.** Whether the arm64 Docker image works on a Mac for the Groth16 step; CPU throughput of 3.0.6 on current M-series chips; the RISC Zero version behind ethproofs' M1 figure.
10. **Direct install of the Groth16 component without rzup.** Inferred from rzup's path lookup and a third party's practice.
11. **3.1.0-rc.1.** Same control-id and verifier-key files as 3.0.6, but I did not check the RV32IM control ids or prove with it. It is a release candidate.
12. **The fork's "~5x over upstream".** The author's own measurement, unreviewed.
13. **The Boundless price** (0.0000184 ETH) is the repository's 2026-11-02 figure, not re-measured.
14. **Lambda's prices** take effect on 2026-11-16; Vast.ai's are a live marketplace snapshot; Google's default region and column meanings were read from the page layout, not from a labelled export.
15. **Host RAM** for the GPU route has no published figure.

## 12. Sources

All read on 2026-11-10 unless a date is given. "Date" is the publication or last-modified date where the source gives one.

**RISC Zero, primary.**
- crates.io API, versions, dates and features: https://crates.io/api/v1/crates/risc0-zkvm and https://crates.io/api/v1/crates/risc0-groth16 (3.0.6 on 2026-07-17; 3.1.0-rc.1 on 2026-10-30; 5.0.0-rc.1 on 2026-01-14). Also `/risc0-groth16-sys`, `/risc0-sys`, `/risc0-zkp`, `/risc0-circuit-rv32im`, `/risc0-circuit-recursion`.
- Crate sources, from `https://static.crates.io/crates/<name>/<name>-<version>.crate`: `risc0-zkvm` 3.0.6, `risc0-groth16` 3.0.5, `risc0-groth16-sys` 0.1.0, `risc0-circuit-rv32im` 4.0.5, `risc0-circuit-rv32im-sys` 4.0.3, `risc0-circuit-recursion` 4.0.5, `risc0-zkp` 3.0.5, `risc0-sys` 1.5.0, `risc0-build-kernel` 2.0.1, `rzup` 0.5.2.
- Releases: https://github.com/risc0/risc0/releases , https://github.com/risc0/risc0/releases/tag/v3.1.0-rc.1 , https://github.com/risc0/risc0/releases/tag/v5.0.0-rc.1
- Repository files via `https://raw.githubusercontent.com/risc0/risc0/<ref>/...`: `Cargo.toml` (main, v3.0.6); `CHANGELOG.md` (main); `risc0/circuit/rv32im/src/prove/mod.rs` (release-2.0, 2.3, 3.0, 3.1); `risc0/circuit/rv32im/src/prove.rs` (main); `risc0/groth16/src/prove/docker.rs` and `mod.rs` (release-3.0, v3.0.6, release-3.1, release-5.0, main); `risc0/zkp/src/hal/cuda.rs`; `risc0/zkvm/examples/datasheet.rs` (v3.0.6); `risc0/circuit/recursion/src/control_id.rs`, `risc0/groth16/src/verifier.rs`, `risc0/zkvm/src/receipt/groth16.rs` (v3.0.6, release-3.1, release-5.0). Tag v3.0.6 is commit `1cc70cf0` (2026-07-17); main is `164c64bb` (2026-10-26).
- Docs: https://dev.risczero.com/api/generating-proofs/local-proving (version 3.0; source `website/api_versioned_docs/version-3.0/generating-proofs/local-proving.md` on main); https://dev.risczero.com/api/zkvm/benchmarks ; https://dev.risczero.com/datasheet.pdf (April 2023); at tag v3.0.6: `website/api/blockchain-integration/shrink-wrapping.md`, `website/api/zkvm/install.md`, `website/api/zkvm/receipts.md`, `website/docs/terminology.md`, `README.md`.
- Issues: https://github.com/risc0/risc0/issues/1749 (opened 2024-04-30, open; contributor comment 2026-02-05) and https://github.com/risc0/risc0/issues/1520 (opened 2024-03-06, open).
- Docker Hub tags: https://hub.docker.com/v2/repositories/risczero/risc0-groth16-prover/tags?page_size=25 (tag `v2025-04-03.1`, 2025-04-03, amd64 and arm64).
- Groth16 component manifest: https://risc0-artifacts.s3.us-west-2.amazonaws.com/rzup/components/risc0-groth16/distribution_manifest.json (Last-Modified 2026-10-22); blob `.../sha256/4b4f2b2fb8380369ed14f0dc48380a1bbcbc82c7d553f1888b47d0a9f8e72e4d` (2,335,797,480 bytes, 2025-08-01).
- Unreachable: https://benchmarks.risczero.com/main/datasheet , https://reports.risczero.com/ , https://raw.githubusercontent.com/risc0/ghpages/main/dev/datasheet/ , https://risczero.com/blog/introducing-R0VM-2.0

**Boundless, primary.**
- Docs, through https://docs.boundless.network/llms-full.txt : https://docs.boundless.network/provers/quick-start , /provers/performance-optimization , /provers/bento , /provers/broker , /zkc/mining/enable
- Repository https://github.com/boundless-xyz/boundless at `80d84dab` (2026-11-06): `dockerfiles/agent.dockerfile`, `Cargo.toml`, `bento/Cargo.toml`, `bento/crates/workflow/Cargo.toml`, `bento/crates/workflow/src/tasks/snark.rs`, `crates/boundless-cli/src/commands/prover/generate_config.rs`.
- Blog: https://boundlessfdn.org/blog/zk-mining-on-boundless (2025-06-11).

**ethproofs, primary.**
- https://ethproofs.org/zkvms , https://ethproofs.org/teams , https://ethproofs.org/clusters , https://ethproofs.org/csp-benchmarks (data file updated 2026-11-02).
- Ethproofs, "The Ethproofs 5090 Price Index", https://hackmd.io/@willcorcoran/Sk8lhzXfbe (December 2025).

**Independent measurements, secondary.**
- https://github.com/hemilabs/risc0/pull/21 (2026-10-16, merged 2026-10-17) and https://github.com/hemilabs/risc0/pull/20 (merged 2026-10-15); merge commits `5ff3f70` and `ba2a042` on branch `release-3.0`; `risc0/zkvm/examples/prove_busy.rs` and `prove_e2e.rs`.
- https://github.com/hemilabs/zk-miner at `cde78152` (2026-11-09): `crates/zkminer-prover/src/benchmark.rs`, `crates/zkminer-prover/tests/risc0_groth16_vram.rs`, `crates/zkminer-strategy/src/cost_model.rs`, `crates/zkminer-prove-risc0/src/main.rs`, `README.md`, `Cargo.toml`; https://github.com/hemilabs/zk-miner/pull/30 (2026-11-09).
- https://github.com/NthMOMENT/ghostprover-benchmarks (`bd29207`, 2026-07-21) and https://github.com/NthMOMENT/kaspa-pq-bench-results (2026-07-16); https://forum.logos.co/t/independent-risc-zero-sp1-gpu-benchmarks-for-lez-free-for-builders/1811 (2026-07-21).
- https://essential-contributions.github.io/void-reference-impl/readmes/benchmarks-zk-proving-risczero.html ; repository `4829cd27` (2025-10-01).
- https://zksync.io/airbender (undated).
- https://fenbushi.vc/2025/08/29/benchmarking-zkvms-current-state-and-prospects/ (2025-08-29).
- https://ethresear.ch/t/measuring-per-opcode-proving-time/23955 (2026-01-27).

**Prices, primary.**
- RunPod: https://www.runpod.io/pricing ("Updated November 4, 2026").
- Vast.ai: https://console.vast.ai/api/v0/bundles/ (2026-11-10 13:29 UTC; verified, rentable, single-GPU offers).
- AWS: https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/ec2/USD/current/ec2-ondemand-without-sec-sel/US%20East%20(N.%20Virginia)/Linux/index.json (published 2026-11-07); https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html
- Google Cloud: https://cloud.google.com/products/compute/gpus-pricing and https://cloud.google.com/products/compute/pricing/accelerator-optimized
- Lambda: https://lambda.com/pricing (prices effective 2026-11-16).
- ETH: https://api.coinbase.com/v2/prices/ETH-USD/spot (2026-11-10 13:33 UTC: 2,057.185 USD).
- Steam Hardware and Software Survey, October 2026: https://store.steampowered.com/hwsurvey/Steam-Hardware-Software-Survey-Welcome-to-Steam

**Repository files read (unchanged).** `referee/zk/host/Cargo.toml`, `referee/zk/host/src/prove.rs`, `referee/zk/host/src/lib.rs`, `referee/zk/host/build.rs`, `referee/zk/guest/Cargo.toml`, `referee/zk/Cargo.toml`, `referee/zk/Cargo.lock`, `referee/zk/README.md`, `docs/VERIFICATION.md`, `.github/workflows/zk-prove.yml`, `scripts/bootstrap.sh`.

**Working files.** Downloads, clones and the two scripts behind the tables (`scripts/compute.py`, `scripts/vast_stats.py`) are under `scratchpad/research/risc0-gpu-src/`.
