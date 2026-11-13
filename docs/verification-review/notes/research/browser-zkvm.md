# Proving the same Rust core in a general-purpose zkVM, in the browser or on consumer hardware

Research date: 2026-11-10. Every external fact below carries a source number (list in section 9) and a confidence tag:
**[P]** primary source (official docs, repository, release notes, benchmark data, the project's own measurements),
**[S]** secondary source (press, third-party write-up, search-engine summary of a page that could not be opened),
**[I]** inference or arithmetic of mine from the cited facts.
Sources older than twelve months (before 2025-11-10) are marked *stale*.

## 1. Answer first

**No.** As of November 2026 no general-purpose zkVM can prove a 7e7 to 1.4e8-cycle RISC-V (or wasm) guest inside a browser tab in minutes and hand back a proof that a contract on Arbitrum One verifies at reasonable gas. Nothing is even close on all three axes at once (throughput, memory, EVM-verifiable output). The facts that decide it:

1. **No production zkVM ships a browser prover.** RISC Zero 3.0.6, SP1 6.10.0, OpenVM 2.1.0, ZisK 1.4.0-alpha, Airbender and Pico 3.1 document native CPU and CUDA provers only; none of their docs, feature lists or release notes mention a wasm or WebGPU prover (S5, S6, S9, S13, S14, S25, S29, S30, S32) [P]. An extended web search for any RISC-V zkVM prover running in a browser found none (2026-11-10) [I: absence of evidence]. The one documented third-party attempt to build the RISC Zero prover for wasm (Anoma, 2025-08-08, *stale*) got as far as compiling parts of it and reported no proof (S11) [P].
2. **The zkVMs that do have an EVM verifier on Arbitrum need a STARK-to-SNARK wrap that cannot run in a tab.** RISC Zero's Groth16 step "requires an x86 architecture and Docker", is unsupported on Apple Silicon "even via Docker" (S6, S8) [P], uses a circuit sized for a 2^23 powers-of-tau file (S10) [P] and took about 7.0 GiB resident in this project's own runs (S42) [P]. SP1 asks 16 GB+ for Groth16 and its proving key is 5.9 GB (S13, S42) [P]. OpenVM's Halo2 aggregation key is "~16 GB" (S27) [P]. A wasm32 tab has 4 GB (S38) [P]. This cost is fixed: it does not shrink with the guest.
3. **The provers that are fast and light enough for client hardware have no EVM verifier.** Jolt (a16z) is the fastest CPU prover found: 1.2 MHz on 8 cores and 2.4 MHz on 24 cores of an EPYC 9254 in its own CI on 2026-11-10 (S20) [P], and over 2 million cycles per second on a laptop per a16z (S16) [P]. But it is alpha (S17), its on-chain verifier and recursion pages read "These docs are under construction" (S21), and it needs about 200 to 310 bytes of RAM per cycle (S16, S18, S20), so a 1.37e8-cycle run would pad to 2^28 rows, the size at which an unmerged Jolt PR measured 81 to 84 GiB (S18) [P for the measurement, I for the mapping]. Ligetron (the only wasm zkVM with a shipping in-browser WebGPU prover) produces multi-megabyte proofs with a verifier whose cost grows with the circuit, and has no Solidity verifier (S1, S34) [P]. Valida ships a browser `prove()` API but its own README says "The prover is unsound" (S37) [P].
4. **On CPUs, the incumbent STARK zkVMs are two orders of magnitude too slow.** This project measured RISC Zero 3.0.6 at one 2^20-cycle segment per ~400 s on 4 vCPUs (2.6 kHz), 16 to 17 hours for the heaviest run (S42) [P]. Five minutes for 1e8 cycles needs 333 kHz end to end.
5. **What does work today on consumer hardware is native, not browser, and needs an NVIDIA GPU.** RISC Zero's Boundless prover docs show an effective 264 kHz on one GPU (model not named; the same page's two 16 GB GPUs reach 431 kHz) (S12) [P]: about 8.6 minutes for 1.37e8 cycles [I]. Succinct reports "~2 million PGU/s" per RTX 4090/5090 node for SP1 (S15) [P]: about 60 s for this project's 119.5M-PGU run before the wrap [I]. Both then need the Groth16 wrap (x86 Docker or CUDA).

**How far the best candidates are from "1e8 cycles, browser tab, about five minutes, Arbitrum-verifiable":**

| Candidate | Throughput on consumer-class hardware | Memory for a 1.37e8-cycle run | Browser prover | EVM verifier on Arbitrum One | Distance |
|---|---|---|---|---|---|
| RISC Zero 3.0.6, CPU | 2.6 kHz on 4 vCPUs (S42) [P] | 4.6 to 9.2 GiB by segment size, plus 7 GiB for Groth16 (S42) [P] | none | yes, router, 227,591 gas (S42) [P] | about 130 to 200 times too slow natively, before any wasm penalty; wrap not portable [I] |
| RISC Zero, one NVIDIA GPU | 264 kHz effective (S12) [P] | 8 GB+ VRAM, 32 GB RAM recommended (S12) [P] | none | yes | native only; about 8.6 min, 1.3 times short of the target rate [I] |
| SP1 6.10.0, RTX 4090/5090 | ~2 M PGU/s (S15) [P] | 24 GB VRAM, 32 GB RAM per GPU, 16 GB+ for Groth16 (S13, S15) [P] | none | yes, gateway, 234,718 gas (S42) [P] | native Linux x86-64 CUDA only; about 1 to 2 min plus wrap [I] |
| Jolt (lattice "Akita" backend) | 1.2 to 2.4 MHz on 8 to 24 server cores (S20) [P]; over 2 MHz on a laptop per a16z (S16) [P]; 9 to 11.5 MHz on an M5 Max with Metal in an unmerged PR (S18) [P] | about 80 GiB at 2^28 rows (S18) [P] | none documented | none (roadmap) (S21) [P] | fast enough; memory 10 to 20 times over a tab; no verifier; alpha [I] |
| Ligetron 1.1.0 | 2.4M constraints in 5.7 s on an M1 (S1) [P] | 126 to 144 MB, flat (S1) [P] | yes, WebGPU (S34) [P] | none found; proofs 3.5 to 7.2 MB already at 0.2M to 2.4M constraints (S1) [P] | wrong shape for onchain verification |

**What a smaller workload changes** (section 6): at 10 times smaller (1.4e7 cycles) nothing changes for a browser; at 100 times smaller (1.4e6 cycles, one or two RISC Zero segments) the STARK part becomes seconds on a GPU or a Jolt-class CPU prover and plausibly fits a tab's memory, but the fixed wrap (item 2) and the missing browser builds remain, so the result is still "a native prover on the player's machine, or a third party wraps", not "a proof from the tab".

## 2. The yardstick

- **Workload.** 70 to 137 million zkVM cycles per six-level run on RISC Zero (130,741,601 user cycles and 136,577,024 proving cycles for the heaviest six levels; SP1 counts 136,915,482 cycles or 119,502,086 PGU for the same run); the heaviest single level is about 3.1e7 cycles (S42) [P].
- **Target rate.** 1e8 cycles in 300 s is 333 kHz sustained, including recursion and the final wrap; 7e7 to 1.4e8 gives 233 to 467 kHz [I].
- **Browser memory.** wasm32 addresses 4 GB. Memory64 shipped in Firefox 134 and Chrome 133, is capped at 16 GB by the WebAssembly JS API, and costs "from just 10% to over 100%" in speed (S38, 2025-01-15, *stale* but structural) [P]. caniuse lists Memory64 as unsupported in the latest stable Safari (27.3) and iOS Safari (27.1 to 27.2), with 75.57% global coverage (S38, read 2026-11-10) [P]. So wasm64 is usable on Chrome, Edge and Firefox only.
- **WebGPU.** Chrome and Edge 113+, iOS Safari 26+, partial in desktop Safari 26 to 27.3, off by default in Firefox per caniuse; 88.6% global coverage including partial (S38) [P].
- **Browser versus native speed.** Mopro 0.3 (Circom/Groth16 circuits, not zkVMs): native rapidsnark is about 7 to 15 times faster than snarkjs in the browser; multi-threaded wasm arkworks is 1.1 to 3 times faster than snarkjs; a Halo2 RSA circuit needing about 5 GB crashes on phones that cap an app at about 3 GB (S39) [P]. A baseline iPhone has 5.7 GB in total (S2) [P].
- **Onchain budget.** The run fee is 0.00005 ETH. At Arbitrum One's 0.020036 gwei base fee of 2026-11-02, one Groth16 verification (227,591 gas) is 0.0000046 ETH and a verified run costs 804,194 gas, 0.0000161 ETH (S42) [P]. A 5.65M-gas direct verifier (the Ethereum Foundation's measured standalone WHIR verifier over a 31-bit field, S4 [P]) would cost 0.000113 ETH, 2.3 times the fee [I].
- **Constraints.** One Rust `no_std` integer core for every target; no trusted signer for validity; light dependencies and operations.

## 3. Client-side proving benchmark efforts

**Ethereum Foundation / PSE client-side proving (CSP) benchmarks** (S1, S2, S3, S4) [P]. Quarterly runs on an AWS `mac2.metal` host (Apple M1, 8 cores, 16 GB), published at ethproofs.org/csp-benchmarks, last updated on 2026-11-02. Sixteen proving systems and zkVMs; the workloads are SHA-256, Keccak, Poseidon/Poseidon2 and ECDSA on 128 to 2,048-byte inputs. They are native runs on a laptop-class CPU, not browser runs; a `mobile/` folder exists and a device farm is a stated plan. zkVM rows for SHA-256 of 2,048 bytes (S1) [P]:

| zkVM | Cycles or constraints | Prove | Verify | Peak memory | Proof size | Properties listed |
|---|---|---|---|---|---|---|
| Jolt (Dory PCS, BN254, RV64IMAC) | 202K cycles | 3.4 s | 171 ms | 295 MB | 85 KB | 100-bit, not audited |
| RISC Zero (RV32IM, BabyBear, FRI) | 6.8K cycles | 18.5 s | 13 ms | 1.48 GB | 218 KB | 96-bit, partially audited |
| Miden | 321K cycles | 1 min | 3 ms | 10.6 GB | 276 KB | 94-bit, not audited |
| Ligetron (wasm, Ligero, BN254) | 2.4M constraints | 5.7 s | 1.5 s | 144 MB | 7.24 MB | 128-bit, not audited |
| Cairo M (Circle STARK, M31) | 631K cycles | 2.5 s | 11 ms | 2.55 GB | 1.05 MB | 88-bit, not audited |
| Stark-V (RV32IM, Circle STARK, M31) | 146K cycles | 2.1 s | 16 ms | 2.01 GB | 1.68 MB | 94-bit, not audited |

Reading: the largest zkVM workload in this suite is 0.6 million cycles, more than 100 times smaller than one run here, and the suite's own Q1'26 report concludes that many systems need 2 to 10 GB of RAM, more than a mobile app can use, and that among zkVMs only Ligetron stays under 600 MB for SHA-256 (S2) [P]. RISC Zero's 18.5 s is a fixed floor (one minimum segment plus the lift to a 218 KB succinct receipt), not a rate [I]. PSE's roadmap also records a standalone small-field WHIR verifier on the EVM at 5.65M gas (4.33M with experimental precompiles) and lists a "full SNARK verifier path" as research (S4) [P].

**FibRace** (arXiv 2510.14693, 2025-10-16, *stale*): 2,195,488 Cairo M proofs of Fibonacci on 1,420 phone models; "most modern smartphones can complete a proof in under 5 seconds"; stable with 3 GB+ of RAM (S36) [P]. A tiny program in a purpose-built VM with its own language.

**zkSecurity, WebGPU for Stwo** (2025-04-25, *stale*): WebGPU gave "5x improvements for evaluating constraint polynomials and 2x for the overall proving pipeline"; WGSL has no native 64-bit integers and CPU-to-GPU transfer is a bottleneck (S36) [P]. A research integration, no end-to-end browser numbers.

**Mopro** (S39) [P]: see section 2. Circuits, not zkVMs.

**Fenbushi zkVM benchmark** (2025-08-29, *stale*, 8 vCPUs, 192 GB, RTX 5090): CPU peak memory for small guests was 9.2 GB (RISC Zero), 8.2 to 11 GB (OpenVM), 20 to 21 GB (Pico, SP1), 28 to 58 GB (Jolt v0.1), ~4 GB (Nexus) (S40) [S].

## 4. Per-system findings

### 4.1 RISC Zero (the referee in use)

- **Release line.** v3.0.6 is the latest release (17 Jul 2026); v3.1.0-rc.1 (30 Oct 2026) and v5.0.0-rc.1 (15 Jan 2026) are pre-releases whose notes list only version bumps and a build fix (S5) [P]. The last feature notes are v3.0.1 (21 Aug 2025): faster execution and preflight, faster GPU recursion and GPU Groth16, an experimental multi-GPU prover.
- **wasm or WebGPU prover.** None. The crate's features are `client`, `prove`, `cuda`, `metal` (deprecated: "Metal GPU acceleration for the prover is now enabled by default on Apple Silicon"), `std`; nothing for wasm or WebGPU (S9) [P]. The local-proving pages of the 3.0 and "Next" docs do not mention a browser (S6) [P]. The Anoma exploration (2025-08-08, *stale*) built non-proving features for `wasm32-unknown-unknown`, found that `prove` needs WASI plus patches to C/C++ dependencies, and reported no browser proof (S11) [P].
- **Local proving guidance.** "RISC Zero proving will run on nearly any modern CPU (x86 or ARM)"; with less than 10 GB available, lower the segment size (S6) [P]. VRAM against segment size on GPUs: 8 GB for 2^19, 16 GB for 2^20, 20 GB for 2^21, 40 GB for 2^22 (S12) [P].
- **Throughput.** CPU: 2.6 kHz on 4 vCPUs, recursion 51 to 56 s per segment, memory 9.2 GiB (2^20 segments) or 4.6 GiB (2^19) (S42) [P]. One NVIDIA GPU: 264 kHz effective on Boundless's Bento; two 16 GB GPUs: 431 kHz (S12, undated, release-2.0 docs) [P]. Apple Silicon with Metal: no current figure published; the only datasheet is from April 2023 (*stale*, pre-1.0 circuit): 55 to 58 kHz on an M1 with Metal, 86 to 99 kHz on an M2, 12 to 15 kHz on M1 CPU only, at 30 GB of RAM for a 4M-cycle proof (S7) [P].
- **Groth16 wrap.** "This feature requires an x86 architecture and Docker installed"; GPU proving "requires a special rzup component" (S8) [P]. "Apple Silicon is currently unsupported (even via Docker)" (S6) [P]. Measured here: 167 to 172 s on 4 CPUs, 7.0 GiB resident (S42) [P]. No native CPU route without Docker; the `cuda` feature replaces Docker with a GPU prover (S42) [P].
- **EVM verifier.** Router `0x0b14…b711` on Arbitrum One and Sepolia, 3.0 Groth16 verifier, 227,591 gas per `verify` (S42) [P].
- **Maturity.** Production; partially audited per the CSP table (S1) [P].

### 4.2 SP1 (Succinct)

- **Version.** v6.10.0, 23 Oct 2026 (S14) [P]; ethproofs lists SP1 as an active real-time prover (S31) [P].
- **Client-side or wasm prover.** None in the docs or the last ten release notes (S13, S14) [P]. A claim that SP1 "already runs in WebAssembly, achieving sub-second proof times" appears only on a marketing blog, without a source (S45) [S, not relied on].
- **Memory.** Local proving needs 16+ cores and 16 GB+ for core, compress and Groth16, 64 GB+ for PLONK; the GPU prover is for Linux x86_64 only, with CUDA 12 and 24 GB of VRAM recommended (S13) [P]. Prover-operator guidance: "at least 32 GB of RAM per concurrent proof", "~2 million PGU/s of proving throughput per GPU node" on RTX 4090/5090 (S15) [P]. This project hit out-of-memory at 13.4 GiB on the compressed proof of its smallest vector (about 1 million cycles), and measured 92 s and 11.6 GiB for that vector's core proof on 4 CPUs (about 11 kHz) (S42) [P].
- **EVM verifier.** Gateway and v6.1.0 Groth16 verifier on Arbitrum One, 234,718 gas (S42) [P].
- **Reading.** A player with an RTX 4090-class Linux PC could prove a run in about one to two minutes plus the wrap [I]; nobody else can.

### 4.3 Jolt (a16z)

- **Status.** "Jolt is in alpha and is not suitable for production use at this time" (S17) [P]. Guest ISA RV64IMAC, `no_std` supported (S17, S22) [P].
- **Throughput.** a16z, 2026-09-09: lattice Jolt proves over 2 million cycles per second CPU-only on the laptop that earlier did about 700,000, and over 10 million with Apple Metal on a MacBook; neither model is stated (S16) [P]. Jolt's CI, 2026-11-10, AMD EPYC 9254 (24 cores, 188 GiB), Akita backend: 2^18 rows in 1.56 s on 1 core, 2^20 in 0.87 s on 8 cores (1.2 MHz), 2^22 in 1.76 s on 24 cores (2.4 MHz); the default Dory backend takes 25.2 s, 8.1 s and 7.8 s for the same cases (S20) [P]. The 10 MHz Metal figure comes from PR #1848: M5 Max, 128 GiB, trace 2^28, 23 to 30 s, opened 2026-09-08 and closed unmerged on 2026-11-09; PR #2019 (22.3 MHz at 2^29, 110.7 GB peak) was also closed unmerged (S18, S19) [P]. EF's M1 run with Dory: 202K cycles in 3.4 s (S1) [P].
- **Memory.** a16z: prover space fell from about 300 to about 200 bytes per cycle (S16) [P]. Measured: 0.57 GiB at 2^20, 1.15 GiB at 2^22 (S20), 81 to 84 GiB at 2^28 (S18) [P], so about 290 to 310 bytes per padded row [I]. The streaming prover (bounded memory for any length) is still a roadmap item: "Today, the Jolt prover is not streaming" (S21, undated) [P]; it was announced as the "next major implementation target" on 2025-08-14 (S23, *stale*) [P].
- **Proof size and verifier.** 93 to 103 KB with Akita, 82 to 91 KB with Dory; native verification 10 to 15 ms (Akita), 48 to 53 ms (Dory) (S20) [P].
- **wasm or browser.** The current book has no wasm page; quickstart and host pages name only the RISC-V guest target (S22) [P]. An older edition of the docs said only verification was supported in wasm (search summary) [S]. a16z says the memory cut means "you can prove millions of RISC-V cycles on a mobile phone" (S16) [P]: a claim about small programs.
- **EVM verifier or wrapper.** None. The roadmap lists recursion, streaming and an on-chain verifier; the recursion and on-chain verifier pages say only "These docs are under construction" (S21) [P]. The Akita backend "currently supports non-zero-knowledge proofs only" and the generated SDK "currently supports Dory" (S22) [P].
- **Reading.** The same Rust core would compile for it and the raw rate is 3 to 7 times the target on a workstation, but a run needs about 40 GiB (2^27) or 80 GiB (2^28) and there is no way to get its proof onto Arbitrum. Running the Jolt verifier (10 to 53 ms natively) as a guest of RISC Zero or SP1 would add a second zkVM and a guest of unknown size; neither project publishes such a wrapper [I].

### 4.4 OpenVM (Axiom)

- v2.1.0 on 2026-11-04; v2.0.0 (10 Jul 2026) introduced the SWIRL proof system and is the release Axiom recommends for production (S25, S26) [P]. Prebuilt binaries: x86-64 Linux with CUDA 12.9 to 13.1, CPU builds for aarch64 and macOS (S25) [P]. Published numbers are GPU clusters (Ethereum blocks, p99 9.8 s on 8 GPUs) and "8.1s on a single 5090 GPU" for the Halo2 wrap (S26) [P]. No CPU or laptop throughput is published, and no wasm prover is mentioned.
- EVM path: Halo2/KZG wrap; `cargo openvm setup --evm` "requires a large amount of computation and memory (~16 GB)" and the aggregation proving key is "very large (~16 GB)" (S27) [P]. A verification-bypass advisory in `OpenVmHalo2Verifier` (CVE-2026-62334) was fixed in 1.7.0 and 2.0.0-rc.3 (S28) [S]. No deployed verifier address on Arbitrum One was found.

### 4.5 ZisK, ZKsync Airbender, Brevis Pico (GPU-first Ethereum block provers)

- **ZisK** v1.4.0-alpha, 29 Oct 2026; the final SNARK is "pilfflonk" with Solidity verifiers; release notes speak of 21.5 GiB peak CPU memory for one AIR and shared-memory segments of about 15 GiB (S29) [P]. "On macOS, proof generation is not yet optimized" and assembly execution is unsupported there (S29) [P]. v1.4.0 adds only an initial translation layer for wasm guests (S29) [P].
- **Airbender**: 21.8 MHz on one H100 (vendor) (S30) [P]; a CPU backend exists but no rate is published; security level is selectable at 80 or 100 bits; SNARK wrapping is not implemented in the repository and is "expected to be supported soon" (S30) [P]. It runs ZKsync OS's developer-preview testnet (S30) [P]. No releases on GitHub; ethproofs lists "Airbender v3 0.1.0" (S31) [P].
- **Pico** 3.1: multilinear STARK over KoalaBear, CPU prover on Linux and macOS, CUDA on x86-64 Linux, Groth16 on BN254 for the EVM, but "a deployment needs keys and a verifier from a real setup ceremony" (the bundled verifier is from a test setup) and the audit covers 2.x only (S32) [P].
- None has a browser prover, a published laptop rate, or a verifier found on Arbitrum One.

### 4.6 Nexus zkVM

- "The Nexus zkVM is in an experimental stage and is not currently recommended for production use"; built on Stwo; no GitHub releases (S33) [P]. StarkWare's post (2025-06-25, *stale*) lists "WASM and mobile-native prover targets for local proving" among things being built and gives no numbers (S33) [P].
- The Nexus web app did prove in the browser for its testnets: a sandboxed instance of the Nexus zkVM in a Rust wasm runtime, with server-assigned workloads, and CLI provers earning up to 10 times more points per proof (search summaries of docs.nexus.xyz and blog.nexus.xyz, which this session could not open) [S]. The size of those programs is not stated anywhere I could read; Nexus's own benchmark guest is a ~10K-cycle Fibonacci (S33) [S]. No EVM verifier is mentioned.

### 4.7 Ligetron (Ligero)

- **What it is.** A wasm zkVM on the Ligero proof system; guests are C/C++ or Rust built for `wasm32-wasip1`, integer i32/i64 only; "Ligetron uses WebGPU (through Dawn or Emscripten) to accelerate the computation both natively and on browsers", with no fallback without WebGPU and an exception for iPhones (S34) [P]. Apache-2.0, repository updated 2026-10-13.
- **Throughput and memory.** EF, M1: 2.4M constraints in 5.7 s, 126 to 144 MB (S1) [P]. Ligero's docs, M3 Pro, ligero-prover v1.1.0: about 247K constraints in 0.35 to 0.93 s (S34) [P]. The prover runs the program three times and keeps only a slice of the witness in memory (S34) [P]. No constraints-per-wasm-instruction figure is published, so 1e8 instructions cannot be converted; SHA-256 costs about 73K constraints per block here [I].
- **Proof size and verifier.** 2.55 to 12.5 MiB for the 247K-constraint example depending on packing (S34) [P]; 3.51 MB at 198K constraints and 7.24 MB at 2.4M, with verification 0.38 s and 1.5 s (S1) [P]. Ligero's docs say the linear test "prevents the Ligero verifier from achieving a fully sublinear runtime with respect to circuit size"; a preprocessing phase to fix that is being integrated, per the same page (S34) [P].
- **EVM verifier.** None in the organisation's eleven repositories (a Soroban verifier exists) (S34) [P]. The company site lists Ethereum among "on-chain integrations" without saying how (S34) [P].
- **Reading.** It proves in a browser with flat memory, which is its point; for a public replay it gives megabytes of proof and a verifier that still works in proportion to the computation, which is what the Stylus re-execution referee already does [I].

### 4.8 Miden VM

- Branches: 0.35.1, 0.36 on `main`, 1.0 on `next` (S35) [P]. 2^20 VM cycles: 38.9 s single-threaded on an M4 Pro with 6.46 GiB, 4.36 s on its 14 threads, 2.69 s on an M5 Max; proof 192 KiB (S35) [P]. EF: 321K cycles took 1 min and 10.6 GB on an M1 (S1) [P].
- The web client does prove transactions locally in the browser (single- and multi-threaded wasm builds; delegated proving is offered as the alternative) (S35) [P]. Those are small programs.
- Rust reaches Miden through `midenc`, a wasm frontend on a pinned nightly toolchain; "This project is rapidly evolving" (S35) [P]. Miden cycles are not RISC-V cycles; the ratio for this core is unknown.
- No EVM verifier. Memory of about 6.5 GiB per 2^20 cycles rules out 1e8 [I].

### 4.9 Cairo with S-two (Stwo), Cairo M, Stark-V

- S-two 2.0.0 (27 Jan 2026) is semantically versioned, on crates.io, and proves every Starknet block; the announcement gives no steps-per-second, memory or proof-size figures (S36) [P]. Client-side claims: proofs "on any device, even on low-powered ones such as mobile phones" (2025-11-03, *stale*) (S36) [P].
- It proves Cairo programs: the core would have to be rewritten in Cairo, a second implementation, which the owner rules out. No Solidity verifier for S-two proofs and no Arbitrum deployment was found; Stwo's docs describe a verifier suited to onchain deployment as a design goal (search summary) [S].
- Cairo M (KKRT Labs) is "work in progress", has its own language, and its team was reportedly acquired in November 2025 (S36) [S]. Stark-V (RV32IM on a Circle STARK) appears in the EF table as unaudited, 94-bit, 1.68 MB proofs (S1) [P]; I could not find its repository.

### 4.10 Valida (Lita)

- The original repository is archived; releases continue at `lita-xyz/valida-releases`, latest "Valida toolchain 1.0.0" dated 25 Sep (year not shown, 2025 by the sequence of earlier tags) (S37) [P].
- It is the one RISC-style zkVM with a documented browser prover: the `valida-basic-api-wasm` package exposes `run`, `prove(program_bytes, stdin, max_trace_height, max_parallel_segments)` and `verify` "within the browser"; Rust builds with `cargo +valida` (S37) [P].
- But: "The prover is unsound", to "be resolved once some missing constraints are added"; no EVM verifier; no performance numbers (S37) [P].

### 4.11 zkWASM, Ceno, Binius

- **zkWASM (Delphinus)**: "This is a WIP project, only sample code are provided here"; batching and Solidity verifier generation live in a separate continuation batcher; proving is offered as a service (S37) [P].
- **Ceno (Scroll)**: "currently under construction and not suitable for use in production"; inactive on ethproofs (S31, S37) [P].
- **Binius**: PetraVM was "archived by the owner on Jan 8, 2026"; Binius64 is a circuit SNARK over 64-bit words, not a zkVM, with no wasm or EVM verifier mentioned (S37) [P].

## 5. Which, if any, could prove a 1e8-cycle guest in a browser in about five minutes

None.

- **By throughput alone**, only Jolt-class sumcheck provers reach 333 kHz on laptop CPUs (S16, S20) [P]. A wasm build would lose some of that (128-bit SIMD only, Memory64 penalty of 10% to over 100% if more than 4 GB is needed, S38), but the native margin is 3 to 7 times [I].
- **By memory**, Jolt needs about 40 to 80 GiB for one run and about 10 GiB for the heaviest single level (2^25 rows) [I from S18, S20]; a tab has 4 GB, or 16 GB with Memory64 on Chrome and Firefox (S38) [P]. Only chunks of about 2^23 rows (8M cycles, about 2.5 GiB) fit wasm32, which means 17 to 33 separate proofs per run [I].
- **By verifiability**, Jolt, Ligetron, Miden, Nexus, Valida and the Stwo family have no EVM verifier (sections 4.3, 4.6 to 4.10) [P].
- **The systems with an Arbitrum verifier** (RISC Zero, SP1, and OpenVM in principle) have no browser prover, CPU rates in the low kHz to low tens of kHz (S42) [P], and a wrap that needs 7 to 16 GB and x86 or CUDA (section 1, item 2) [P].

On an ordinary laptop without an NVIDIA GPU, natively: RISC Zero takes hours (S42); Jolt would take minutes if the laptop had 64 to 128 GB of RAM, and its proof still could not be settled [I]. On a phone: no.

On a consumer NVIDIA GPU, natively: yes, in minutes, with RISC Zero (about 8.6 min at 264 kHz) or SP1 (about 1 to 2 min on a 24 GB card), then the Groth16 wrap (S12, S15) [I]. That is "a prover program the player installs", with Linux, CUDA and Docker, not a browser.

## 6. What a 10x or 100x smaller workload would change

| Workload | RISC Zero on 4 vCPUs (S42) | RISC Zero on one NVIDIA GPU (S12) | Jolt-class CPU prover (S20) | Fixed wrap |
|---|---|---|---|---|
| 1.4e8 cycles (today) | 16 to 17 h, 131 segments [P] | about 8.6 min [I] | about 1 to 4 min, 40 to 80 GiB [I] | Groth16: 170 s on 4 CPUs, 7 GiB, x86 Docker [P] |
| 1.4e7 (10x smaller) | about 1.8 h (7.3M proving cycles measured at 55 min) [P/I] | about 53 s [I] | about 7 to 14 s, about 5 GiB (2^24) [I] | unchanged |
| 1.4e6 (100x smaller) | 21 min for the whole chain on 4 CPUs, 36 min on 2 vCPUs (measured on a 1.1M-cycle vector) [P] | about 5 s [I] | about 1 to 2 s, about 0.6 GiB (2^21) [I] | unchanged |

- **10x smaller** changes nothing for the browser. It brings a consumer GPU under a minute and keeps a laptop CPU in the hour range with RISC Zero.
- **100x smaller** is where the STARK part stops being the problem: one or two RISC Zero segments, or a sub-GiB Jolt trace that would fit a tab. What remains is exactly the part that does not scale down: the Groth16 wrap (7 GiB, x86 or CUDA, about 3 minutes on 4 CPUs) and the absence of a browser build of any prover with an Arbitrum verifier. So even at 1e6 cycles the realistic shape is "the player's machine or browser makes a STARK, any untrusted party wraps it", which is trustless for validity but still needs someone's x86 box for liveness [I]. Verifying the STARK directly onchain instead of wrapping is a research item: no Solidity verifier for RISC Zero's succinct receipt was found, and the one measured small-field verifier costs 5.65M gas, 2.3 times the run fee (S4) [P/I].
- **How one would get 100x** is outside this topic, but the numbers in the context show where it could come from: a single tick costs about 400 cycles idle and about 0.5 million with a capture, level setup about 1 million, and the core already emits a state hash per tick, so a proof of one disputed tick (or of a short tick range between two committed state hashes) is a 1e6-cycle guest, where a proof of a whole run is 1e8 [I].

## 7. What a small team can deploy today, in order

1. **Keep the RISC Zero guest; let players prove natively if they want.** The `zk-host` prover already exists; on an NVIDIA GPU a run is minutes (S12), on a CPU it is 9 to 17 hours (S42). No new trust, no new dependency, no rule change. Not a browser, and only a minority of players have the hardware.
2. **Watch Jolt.** If its streaming prover and an on-chain verifier ship, it is the first system that could plausibly prove this core on a laptop CPU in minutes. Today it is alpha with neither (S17, S21).
3. **Do not switch zkVM for client-side reasons.** SP1, OpenVM, ZisK, Airbender and Pico are faster on GPUs but heavier on memory and no closer to a browser; Ligetron, Miden, Nexus, Valida and the Stwo family are closer to a browser but cannot settle on Arbitrum.

Outside this topic, but it bears on "the player does it himself": a player without hardware can already obtain the same Groth16 seal from a proof market (Boundless sold comparable proofs for about 0.0000184 ETH in early November 2026, S42 [P]); the proof's validity does not depend on who made it [I].

## 8. Could not verify

- `docs.nexus.xyz` and `blog.nexus.xyz` did not resolve from this session, so Nexus's current version (search results say v0.3.4), the size of programs its browser nodes proved, and its roadmap come from search summaries only.
- `reports.risczero.com` and `benchmarks.risczero.com` did not resolve, and RISC Zero's 1.0 benchmark post returned 404. No current RISC Zero throughput for Apple Silicon with Metal or for laptop CPUs was found; the only datasheet is from April 2023.
- The laptop model behind a16z's figure of over 2 million cycles per second for Jolt; a date for Jolt's streaming prover; whether the Jolt prover builds for wasm at all; why PRs #1848 and #2019 were closed.
- SP1 v6 CPU-only or Apple Silicon throughput. A marketing claim that SP1 proves in WebAssembly has no primary source.
- Airbender's CPU rate and VRAM need (a secondary article says more than 22 GB), and where its SNARK wrapper lives.
- Deployed verifier contracts on Arbitrum One for OpenVM, ZisK, Pico or Airbender: none found, which is not proof that none exist.
- Ligetron's constraints per wasm instruction, its proof size at 1e8 instructions, and what the company's "Ethereum" integration consists of.
- A Solidity verifier or gas figure for S-two proofs; S-two throughput on laptops; the owner and repository of "Stark-V".
- The year of Valida toolchain 1.0.0 and whether Lita still maintains it.
- The Fenbushi results table (an image), and the Mopro GPU post (404).
- Whether Memory64 has shipped in a stable Safari after caniuse's listing.
- The GitHub connector of this session is limited to the project's repository, so other repositories were read through their public web pages only.

## 9. Sources

| # | URL | Date of source | Used for |
|---|---|---|---|
| S1 | https://ethproofs.org/csp-benchmarks | last updated 2026-11-02 | EF/PSE client-side benchmark table and system properties |
| S2 | https://hackmd.io/@clientsideproving/report-q1 | Q1 2026 (no exact date) | CSP report conclusions, phone memory |
| S3 | https://github.com/privacy-ethereum/csp-benchmarks (served as `ethereum/csp-benchmarks`) | 2026, undated | Benchmark method and hardware |
| S4 | https://pse.dev/mastermap/csp | undated, read 2026-11-10 | CSP roadmap, WHIR EVM verifier 5.65M gas |
| S5 | https://github.com/risc0/risc0/releases | v3.0.6 2026-07-17; v3.1.0-rc.1 2026-10-30; v5.0.0-rc.1 2026-01-15; v3.0.1 2025-08-21 | RISC Zero release line |
| S6 | https://dev.risczero.com/api/generating-proofs/local-proving and https://dev.risczero.com/api/next/generating-proofs/local-proving | 3.0 and Next docs, undated | Local proving, Groth16 x86 only |
| S7 | https://dev.risczero.com/datasheet.pdf | April 2023 (stale) | Old Metal and CPU rates |
| S8 | https://github.com/risc0/risc0/tree/main/risc0/groth16 | main, read 2026-11-10 | Groth16 needs x86 and Docker |
| S9 | https://docs.rs/crate/risc0-zkvm/latest/features and https://github.com/risc0/risc0/blob/main/risc0/zkvm/README.md | 3.0.6 | Feature flags, Metal default |
| S10 | https://dev.risczero.com/api/trusted-setup-ceremony | artifacts 2024-04-04 (stale, structural) | 2^23 powers of tau, 32 GB heap to verify |
| S11 | https://forum.anoma.net/t/anomabeta-exploration-of-browser-side-risc0-arm/2107 | 2025-08-08 (stale) | Attempt to build the prover for wasm |
| S12 | https://docs.boundless.network/provers/performance-optimization and https://docs.boundless.network/provers/quick-start | release-2.0 docs, undated | GPU rates, VRAM table, prover requirements |
| S13 | https://docs.succinct.xyz/docs/sp1/getting-started/hardware-requirements | undated (v6 era) | SP1 hardware requirements |
| S14 | https://github.com/succinctlabs/sp1/releases | v6.10.0 2026-10-23 | SP1 version |
| S15 | https://docs.succinct.xyz/docs/provers/setup/faq | undated; example logs 2025 | PGU/s per GPU, RAM per proof |
| S16 | https://a16zfrontier.com/posts/article/lattice-snarks-jolt-post-quantum-faster (redirect from a16zcrypto.com) | 2026-09-09 | Lattice Jolt claims |
| S17 | https://github.com/a16z/jolt | read 2026-11-10 | Alpha status, ISA |
| S18 | https://github.com/a16z/jolt/pull/1848 | opened 2026-09-08, closed unmerged 2026-11-09 | Metal benchmark, memory at 2^28 |
| S19 | https://github.com/a16z/jolt/pull/2019 | 2026-10-07, closed unmerged | 22.3 MHz at 2^29, 110.7 GB |
| S20 | https://a16z.github.io/jolt/dev/prover-history/runs/github-e21affaeaf0d2c0a4630b958a883a4ac877acbfd-42813760538-1.json (index: …/prover-history/history.json) | 2026-11-10 08:51 UTC | Jolt CI benchmark |
| S21 | https://jolt.a16zcrypto.com/roadmap/roadmap.html, /roadmap/streaming.html, /roadmap/recursion.html, /roadmap/on-chain-verifier.html | undated, read 2026-11-10 | Roadmap status |
| S22 | https://jolt.a16zcrypto.com/usage/quickstart.html and /usage/guests_hosts/hosts.html | undated, read 2026-11-10 | Dory default, Akita not ZK, no wasm page |
| S23 | https://a16zfrontier.com/posts/article/jolt-6x-speedup (2025-08-14) and /64-bit-proving-jolt (2025-10-15) | stale | Earlier Jolt rates, streaming goal |
| S24 | https://thequantuminsider.com/2026/09/09/a16z-crypto-rebuilds-jolt-proof-system-with-post-quantum-security-and-faster-performance/ | 2026-09-09 | Secondary coverage of S16 |
| S25 | https://github.com/openvm-org/openvm/releases | v2.1.0 2026-11-04; v2.0.0 2026-07-10 | OpenVM versions, targets |
| S26 | https://axiom.xyz/blog/openvm-2-production | 2026-07-10 | OpenVM 2.0 numbers |
| S27 | https://docs.openvm.dev/book/advanced-usage/sdk | undated | 16 GB Halo2 key |
| S28 | https://github.com/openvm-org/openvm/security/advisories/GHSA-j29p-wr24-hp4f (via search summary; CVE-2026-62334) | 2026 | Verifier advisory |
| S29 | https://github.com/0xPolygonHermez/zisk/releases and https://0xpolygonhermez.github.io/zisk/getting_started/installation.html | v1.4.0-alpha 2026-10-29 | ZisK |
| S30 | https://zksync.io/airbender; https://raw.githubusercontent.com/matter-labs/zksync-airbender/main/docs/end_to_end.md, /docs/tutorial.md, /tools/cli/README.md; https://docs.zksync.io/zksync-network/zksync-os | undated, read 2026-11-10 | Airbender |
| S31 | https://ethproofs.org/zkvms | read 2026-11-10 | Active zkVM list and versions |
| S32 | https://github.com/brevis-network/pico (README) | Pico 3.1, read 2026-11-10 | Pico |
| S33 | https://github.com/nexus-xyz/nexus-zkvm; https://starkware.co/blog/nexus-stwo-zkvm-scalable-verifiable-computation/ (2025-06-25, stale); search summaries of docs.nexus.xyz and blog.nexus.xyz | read 2026-11-10 | Nexus |
| S34 | https://github.com/ligeroinc/ligero-prover; https://github.com/ligeroinc; https://docs.ligetron.com/docs/introduction/performance, /zkvm, /ligero-protocol; https://www.ligero-inc.com; https://csrc.nist.gov/presentations/2026/mpts2026-4c3 (2026-01-29) | repo updated 2026-10-13 | Ligetron |
| S35 | https://github.com/0xMiden/miden-vm; https://github.com/0xMiden/compiler; https://docs.rs/crate/miden-client-web/0.15.9/source/src/models/provers.rs | read 2026-11-10 | Miden |
| S36 | https://starkware.co/blog/s-two-2-0-0-prover-for-developers/ (2026-01-27); https://www.starknet.io/blog/s-two-is-live-on-starknet-mainnet-the-fastest-prover-for-a-more-private-future/ (2025-11-03, stale); https://arxiv.org/abs/2510.14693 (2025-10-16, stale); https://blog.zksecurity.xyz/posts/webgpu/ (2025-04-25, stale) | as listed | S-two, FibRace, WebGPU |
| S37 | https://github.com/valida-xyz/valida; https://github.com/lita-xyz/valida-releases and /releases/tag/v1.0.0; https://github.com/DelphinusLab/zkWasm; https://github.com/scroll-tech/ceno; https://github.com/PetraProver/PetraVM; https://github.com/binius-zk/binius64 | read 2026-11-10 | Valida, zkWASM, Ceno, Binius |
| S38 | https://spidermonkey.dev/blog/2025/01/15/is-memory64-actually-worth-using.html (2025-01-15, stale); https://caniuse.com/mdn-webassembly_memory64; https://caniuse.com/webgpu | read 2026-11-10 | Browser memory and WebGPU |
| S39 | https://zkmopro.org/docs/performance/ | Mopro 0.3, undated (2026 footer) | Native versus browser proving |
| S40 | https://fenbushi.vc/?p=795 | 2025-08-29 (stale) | CPU memory of zkVMs |
| S41 | https://wavect.io/blog/zero-knowledge-proofs-production-2026.md | 2026-07-05, updated 2026-09-02 | Secondary overview |
| S42 | `docs/VERIFICATION.md` (sections "zkVM trials", "zk costs", "Costs side by side") and `docs/ECONOMY.md` | measured 2026-10-31 to 2026-11-02 | The project's own cycles, timings, memory, gas, prices |
| S43 | https://daxblogv2.pages.dev/blog/proving_in_the_browser_by_the_numbers | 2025-11-27 | Secondary: browser Groth16 timings (wasm field arithmetic 20 to 35 Mops/s against 70 to 100+ native); not used for a decision |
| S44 | https://docs.rs/crate/webgpu-groth16/latest | 0.2.0, 2026-03-04 | A WebGPU Groth16 prover exists for BLS12-381 circuits up to 100K constraints (2.3 s natively on an M3 Max); no BN254, no browser numbers |
| S45 | https://www.chainscorelabs.com/blog/layer-2-wars-arbitrum-optimism-base-and-beyond/zk-rollup-proving-systems/the-future-of-proving-is-client-side-and-browser-based | undated | Unsupported claim that SP1 proves in WebAssembly; not relied on |
